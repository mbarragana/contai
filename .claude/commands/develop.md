# Develop — Fila de Tickets pelo Pipeline Completo

Executa tickets um a um pelos gates: mock → implementação → review (técnico +
fiscal) → teste → validação.

## CRÍTICO — Regras Inegociáveis

- **Persona obrigatória por gate**: cada gate roda como o subagent daquele
  passo (`subagent_type`), nunca como você mesmo "incorporando" a persona.
  A definição do agente **já é** o system prompt dele — não leia
  `.claude/agents/*.md` no seu contexto: isso paga a persona duas vezes e
  entope o contexto do orquestrador, que é reenviado a cada chamada
- **Um ticket por vez**: todos os gates de um ticket antes do próximo. Sem batch
- **Nunca pule gate**: "é mudança pequena" não é motivo. Sem exceções
- **Nunca se auto-aprove**: review aplica os critérios reais da persona, não um
  "PASS" de carimbo
- **Testes são executados, não só escritos**
- **Desvio só com permissão**: se acredita que tickets podem ser agrupados ou
  gates simplificados, apresente o raciocínio, o pipeline alternativo, o que se
  perde, e ESPERE aprovação explícita do Mateus. Silêncio não é sim
- **Máximo 2 loops por gate**: no 3º retorno ao mesmo gate, pare e escale
- Se se pegar atalhando: pare, admita, refaça o passo direito

## Economia de contexto — regra dura

O contexto do orquestrador é reenviado a cada tool call de cada gate. Tudo que
entra nele é pago N vezes; o que fica dentro de um subagent é pago uma vez e
descartado. Portanto:

- **Você (orquestrador) NÃO lê**: o `CLAUDE.md` (já está no seu contexto e no de
  todo subagent — reler são 5k tokens jogados fora), o corpo do ticket, os
  mocks HTML, o código-fonte, os pareceres.
- **Você lê apenas o cabeçalho do ticket** para saber o que roteia:
  `sed -n '1,60p' docs/tickets/[ID].md` — tipo, prioridade, critérios de aceite,
  se tem UI, se tem Gate Fiscal. O corpo completo é trabalho de quem executa o
  gate, no contexto descartável dele.
- **Cada subagent lê o que precisa por conta própria** e não recebe conteúdo de
  arquivo colado no prompt — recebe caminhos, IDs e o feedback do gate anterior.

### Contrato de retorno de gate (obrigatório)

Todo subagent de gate devolve **no máximo 30 linhas**, neste formato, e **é
proibido colar código, diff, HTML de mock ou trecho de arquivo no retorno**:

```
VEREDITO: [APPROVE | REQUEST CHANGES | PASS | FAIL | DONE]
ARQUIVOS: [caminhos tocados, um por linha]
O QUE MUDOU: [≤5 linhas]
TESTES: [comando rodado + resultado real]
PENDÊNCIAS: [o que ficou aberto, ou "nenhuma"]
```

Se o gate reprovou, as notas de correção entram em PENDÊNCIAS como itens
acionáveis — não como narrativa.

### Retrabalho continua o MESMO agente, não spawna outro

Quando um gate devolve REQUEST CHANGES/FAIL e o ticket volta ao Gate 1, use
**`SendMessage` para o lead-engineer que já implementou**, passando só as notas
do gate reprovador. Ele mantém o contexto (ticket, mock, código já lidos) e a
correção custa o delta.

**Spawnar um lead-engineer novo no retrabalho é o erro mais caro do pipeline**:
ele recomeça do zero e relê ticket + mock + código para aplicar cinco linhas.
Só spawne agente novo quando não houver um vivo para aquele papel neste ticket.

## Instruções

1. Contexto, premissas e comandos de build/teste: o `CLAUDE.md` já está
   carregado — **não o releia**
2. Liste os tickets alvo e leia **só o cabeçalho** de cada um
   (`sed -n '1,60p' docs/tickets/[ID].md`)
3. Respeite ordem de dependências

## Pipeline (por ticket)

### Gate 0: Proposta Aprovada (só para tickets com UI)
- O ticket tem mudança visível ao usuário? Então precisa de
  "Proposta aprovada em [data]" (ou "Mock aprovado em [data]", nos tickets
  anteriores a 2026-08-22) registrado no ticket, apontando para `design/mocks/`
- **Sem aprovação → PARE.** Rode `/design` e obtenha a aprovação do Mateus antes
  de escrever qualquer código. Esta é a premissa nº 1 do projeto
- **A proposta não é sempre HTML** (mudou em 2026-08-22). O `/design` entrega em
  três níveis: **1** HTML navegável (tela nova), **2** spec + ASCII do bloco
  (campo/estado a mais), **3** tabela antes/depois (só texto). O que o Gate 0
  exige é a **aprovação**, não o formato
- **O que os Gates 1 e 4 leem é sempre o spec `design/mocks/[ID].md`** — nos
  três níveis ele existe e declara o nível na primeira linha. O `.html`, quando
  existe, só se abre quando a dúvida for de pixel
- Se o spec não existir (ticket anterior a 2026-08-22), gere-o a partir do HTML
  antes de seguir — mock de 150 KB lido três vezes são ~100k tokens

### Gate 1: Implementar — lead-engineer (modelo: opus)
- 🎭 Rode como subagent `lead-engineer` (pinado em opus no frontmatter dele)
- No prompt, passe: ID do ticket, caminho do spec do mock, notas do gate
  anterior se for retrabalho. **Caminhos, não conteúdo** — ele lê o que precisa
- Ele lê o código existente da área afetada antes de mudar
- Implementa pelos critérios de aceite; segue o mock aprovado quando houver
- Trata os 4 estados (loading/erro/vazio/sucesso) em tudo que é UI
- Escreve testes junto; roda typecheck + testes (comandos no `CLAUDE.md`)
- Retorna no contrato de 30 linhas

### Gate 2: Review Técnico + Fiscal — cto-obra (modelo: fable)
- 🎭 Rode como subagent `cto-obra` (pinado em fable). **Quem implementou
  (lead-engineer) nunca revisa o próprio código** — o revisor roda em modelo
  mais forte que o implementador por design
- **O objeto do review é o DIFF, não a base de código.** Ele começa por
  `git diff` (ou `git diff main...HEAD`) e só abre por inteiro os arquivos que
  o diff toca, quando a mudança não se entende sozinha. Reler a área inteira
  para revisar 200 linhas alteradas é o segundo maior gasto do pipeline
- Revisa: arquitetura, legibilidade, modelo de dados, rastreabilidade
  pagamento↔documento
- 🎭 **Se o cabeçalho do ticket indica Gate Fiscal**: rode um subagent
  `contador` sobre o mesmo diff, para conferir a implementação contra as regras
  exatas do ticket — classificação, regime de caixa (data de pagamento!),
  retenção, documentação hábil. Erro fiscal silencioso é bug P0 mesmo com todos
  os testes verdes
- Veredito: APPROVE ou REQUEST CHANGES → volta ao Gate 1 **pelo `SendMessage`
  ao lead-engineer existente**, com as notas

### Gate 3: Testes de Fluxo
- Teste os fluxos do usuário de ponta a ponta (ferramenta conforme stack no
  `CLAUDE.md`). Cubra: caminho feliz, erro, vazio, edge cases
- 375px é o piso, não o alvo: nenhuma tela pode quebrar no celular, mas tela de
  gestão pode ter densidade — o "Teste do Canteiro" vale para **captura**
- Bug encontrado → Gate 1 pelo `SendMessage`, com report

### Gate 4: Validação do PO

**Campo obrigatório, antes de qualquer coisa — "Arquivos alterados após o último
APPROVE":** `nenhum`, ou a lista. Havendo lista, **cada revisor que aprovou
devolve uma linha sobre o diff final**, transcrita no gate. **Campo em branco =
Gate 4 não fecha.**

Vale para **documentação também**: ticket, backlog e parecer são onde a
adjudicação fiscal mora. Redação de condição fiscal alterada depois do APPROVE
**exige** a linha do `contador`, **citando a redação nova**.

Por que é campo e não lembrete (regra escrita pelo `po` em 2026-08-23, depois de
duas ocorrências no mesmo dia): no `CONTAI-028` a árvore mudou depois do APPROVE
do Gate 2 e ninguém percebeu até o Gate 4; no `CONTAI-029` uma afirmação fiscal
errada tinha **duas cópias** no ticket, e os dois revisores passaram por cima da
segunda porque liam os critérios. **Campo obrigatório é mecânico; "lembrar de
perguntar" não é.**

- 🎭 Rode como subagent `po`
- Passe critério por critério do ticket: PASS/FAIL explícito. Ele lê os
  critérios do ticket e o spec do mock — não a base de código
- Compare o implementado com a proposta aprovada (o spec, e o HTML se houver) —
  divergência é FAIL, a menos que o Mateus tenha aprovado a mudança
- FAIL → Gate 1 pelo `SendMessage`, com feedback específico | PASS → ticket DONE

## Prova de Conformidade (antes de cada gate)

```
📋 Gate [N] — [Nome]
🎭 subagent_type: [lead-engineer | cto-obra | contador | po]  (novo | continuado)
🎟️ Ticket: [ID e título]
```

"continuado" significa `SendMessage` a um agente vivo deste ticket.

## Status (após cada gate)

| # | Ticket | Status | Gate atual | Notas |
|---|--------|--------|-----------|-------|

## Ticket que fecha, ou que PARA no meio

**Gate fechado atualiza `docs/tickets/README.md` — o resumo do topo E a seção
longa.** O resumo é cópia declarada; cópia que ninguém atualiza é a próxima a
mentir.

⚠️ **Gate 1 não é fim de nada.** Se o pipeline não vai continuar — limite de
cota, fim de sessão, o Mateus pediu para parar — o estado vai para o **corpo do
ticket** ANTES de qualquer push: em que gate parou, o que falta, e o hash do que
foi feito.

*Por que esta regra existe: em 2026-08-21 às 23:28 o Gate 1 do `CONTAI-027` foi
commitado; às 23:42 a sessão bateu o limite de cota e escreveu o checkpoint. O
Gate 2 nunca rodou. O ticket no disco continuou com 1 de 16 critérios marcados e
nenhum log de gate — parecendo intocado. Consequências, todas descobertas dois
dias depois: código pushado que nenhum revisor viu, a migration `0010` fora do
banco remoto com o código dependente no ar, e a fila listando o ticket como se
esperasse mock. O estado do pipeline vivia na conversa, e a conversa morreu.*

## Ao Terminar a Fila

Resumo final: tickets entregues (complexidade, loops de feedback), arquivos
modificados, testes adicionados, dívidas criadas e follow-ups sugeridos.
