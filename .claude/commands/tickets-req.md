# Ticket & Requirements — Do Backlog ao Ticket Pronto para Desenvolvimento

Gera um ticket estruturado e acionável, com validação fiscal e de design
embutidas nos gates.

## Instruções

1. **Cada passo roda como o subagent do seu dono**, na sequência abaixo —
   `po` → `contador` → `cto-obra` → `designer`. A definição de cada agente já é
   o system prompt dele: **não leia `.claude/agents/*.md`** para "incorporar" a
   persona. Isso paga a persona duas vezes e amontoa quatro personas no mesmo
   contexto, que é reenviado a cada chamada até o fim do comando
2. O `CLAUDE.md` já está carregado — **não o releia**
3. **Nunca leia `docs/backlog/` inteiro** (~150 KB / ~38k tokens). Todo ticket
   nasce de uma dor registrada lá; localize-a assim:
   - leia `docs/backlog.md` — é o ÍNDICE (≈5 KB), não o conteúdo
   - `grep -rn -i '<termo>' docs/backlog/` — acha a entrada da dor de origem
   - abra **só** o arquivo daquela entrada. Nunca a pasta inteira (150 KB)
   Se a dor não está no backlog, rode `/relato` primeiro ou justifique a exceção
4. Cada subagent devolve **só a sua seção do ticket**, pronta para colar — sem
   narrativa de processo, sem colar arquivos lidos no retorno

## Input

Pergunte ao Mateus (ou extraia do backlog):
- **O que construir**: feature, bug, chore ou spike — e qual dor do backlog atende
- **Prioridade**: P0 (fiscal) / P1 (fricção) / P2 (conveniência)
- **Dependências**: bloqueia ou é bloqueado por algo?

Antes de perguntar **fato da obra** (como as notas chegam, meios de pagamento,
quem são os prestadores, valores já registrados): `grep` no backlog, nos
pareceres e nos tickets primeiro. Fato da obra se consulta, não se pergunta.

## Processo

### Passo 1: PO — Framing e Story  (subagent `po`)
1. "Que dor real da obra isso resolve?" — cite o relato de origem
2. Pre-mortem: "3 meses depois, isso falhou. Por quê?" (3 riscos)
3. User story + critérios de aceite testáveis (Given/When/Then, verificáveis
   na interface, não no código)
4. Out of scope explícito — aplique o filtro das três metas
5. **O `po` não emite condição fiscal.** Critério de aceite que contenha
   obrigação, proibição ou revalidação de natureza tributária **cita o parecer
   pelo caminho** (`docs/pareceres/AAAA-MM-DD-assunto.md`) na mesma frase.
   **Citar outro ticket não serve** — ticket é requisito, não fonte fiscal.
   Sem parecer, a condição **sai do critério** e vira **pergunta do Passo 2**.
   O ticket não espera por isso: ele nasce **sem** a condição, e a pergunta
   aberta é o que a traz de volta.
   *Regra escrita pelo próprio `po` em 2026-08-23, depois de uma restrição da
   caneta dele — rotulada "restrição fiscal", sem parecer nenhum atrás — travar
   o `CONTAI-008` (P0) por 13 dias. Segundo caso da mesma forma; o primeiro foi
   a D32, em 18/08.* do produto

### Passo 2: Contador — Gate Fiscal  (subagent `contador`)
1. O ticket toca regra fiscal (classificação, datas/regime de caixa, retenção,
   documentação hábil, relatórios)? Se não, declare "sem impacto fiscal" e siga
2. Se sim: especifique a regra exata que a implementação deve obedecer, com a
   condição no formato "se X e Y → Z"
3. Marque o que é apuração automática vs. o que trava para revisão humana
4. Número/alíquota sem certeza do valor vigente → registre como "confirmar na
   legislação", nunca como fato
5. Regra que já tem parecer em `docs/pareceres/` se **cita pelo caminho e se
   copia**, não se rederiva — parecer só existe em arquivo, nunca em memória
6. **Condição fiscal se escreve com o verbo exato** — *revalidar*, *avisar*,
   *marcar* e *recusar* são quatro coisas diferentes, e **quem implementa, na
   dúvida, escolhe a mais dura**. Diga qual das quatro, e diga o que acontece
   com o registro quando a condição falha. **Recusa só se o parecer recusar por
   escrito.**
   *No `CONTAI-003` estava escrito "revalidar" e virou **recusa total** no
   código — condição fiscal sem parecer não só entra, **cresce no caminho**,
   porque apertar parece o lado seguro.*

### Passo 3: CTO — Viabilidade  (subagent `cto-obra`)
1. Impacto no modelo de dados (Pagamento/Documento/Favorecido/Obra)
2. Arquivos prováveis, complexidade (S/M/L), dívidas criadas
3. Tabela nova? Então o ticket já nasce com o `GRANT` explícito na migration e
   a atualização de `e2e/privilegios.spec.ts` como critério de aceite
4. Discorde do ticket se a solução proposta for ruim — com alternativa

### Passo 4: Designer — Gate de Mock (se houver UI)  (subagent `designer`)
1. Ticket com qualquer mudança visível ao usuário exige **proposta aprovada
   pelo Mateus antes do desenvolvimento** — vire critério de aceite nº 1
2. **Proponha o nível** e diga por quê (o `/design` decide, mas o ticket já
   sinaliza): **1** HTML navegável se há tela ou fluxo NOVO; **2** spec + ASCII
   do bloco se é campo/estado/aviso a mais em tela existente; **3** tabela
   antes/depois se só o texto muda. Na dúvida entre dois, proponha o maior
3. Referencie a proposta existente pelo **spec** (`design/mocks/[ID].md`), não
   pelo HTML, ou marque "PENDENTE: rodar /design antes de /develop"
4. Diga qual dos dois cenários a tela serve: **gestão** (em casa, sentado — o
   principal) ou **captura** (canteiro, celular, uma mão — eventual)

### Passo 5: Checagem final
- Isso serve a uma das três metas? (nenhum pagamento sem documento hábil /
  relatórios anuais prontos / acervo que sobrevive ao **prazo de decadência do
  CTN art. 173, I** — "venda + 5 anos" é atalho errado, corrigido em 2026-08-16)
- **Teste do Canteiro só se aplica a ticket de captura.** Medir conciliação,
  agendamento ou revisão anual pela régua de "uma mão, com pressa" é medir a
  coisa errada — foi o erro de 2026-08-17/18
- **Varredura de condição fiscal órfã**, e ela é um *finder*, não um
  verificador — o casamento é por linha e critério de aceite ocupa várias, então
  cada achado se lê à mão:

  ```sh
  grep -rniE 'restri[çc][ãa]o fiscal|regra fiscal|exig[êe]ncia fiscal|fiscalmente (obriga|exige|pro[íi]be)' docs/tickets/*.md
  ```

  Achou linha sem `docs/pareceres/` no mesmo critério? Ou entra o caminho do
  parecer, ou a condição vira pergunta do Gate Fiscal.
  ⚠️ **Não vire isto num `grep` bloqueante.** O verificador dos quatro hashes
  casa linha de tabela inteira e por isso é decidível; este casaria fragmentos
  de critérios multi-linha e falharia por construção. O projeto já aprendeu, no
  ajuste de 18/08, que **verificador que falha sempre é verificador que ninguém
  roda**.
- Veredito: APROVADO / PRECISA MUDAR / REJEITADO

## Formato de Saída

```markdown
# [TICKET-ID] [Título]

## Tipo e Prioridade
[feature/bug/chore/spike] — [P0/P1/P2] — [justificativa]

## Dor de Origem
[Citação do relato/backlog]

## User Story
Como [dono da obra...], quero [capacidade] para [benefício].

## Critérios de Aceite
1. [ ] [Se houver UI: "Proposta nível N em design/mocks/X.md aprovada pelo Mateus"]
2. [ ] [Critério testável]
...

## Out of Scope
- [O que NÃO inclui]

## Gate Fiscal (Contador)
[Sem impacto fiscal | Regras exatas no formato condição → consequência,
com automático vs. revisão humana | Pareceres de origem: docs/pareceres/...]

## Pre-mortem
1. [Risco] 2. [Risco] 3. [Risco]

## Viabilidade (CTO)
- Modelo de dados: [impacto]
- Arquivos: [lista]
- Complexidade: [S/M/L]

## Dependências
- Bloqueado por / Bloqueia: [IDs ou "nenhum"]

## Perguntas Abertas
- [O que precisa de resposta antes de implementar]

## Cenário e checagem final
[gestão | captura] — [veredito e justificativa]
```

**As primeiras 60 linhas do ticket são lidas pelo orquestrador do `/develop`
para rotear os gates** — tipo, prioridade, critérios de aceite, se tem UI e se
tem Gate Fiscal precisam caber aí. Discussão, alternativas descartadas e
histórico vão depois, no corpo.

Salve o ticket em `docs/tickets/[TICKET-ID].md`.
