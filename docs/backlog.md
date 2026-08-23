# Backlog — contai

Backlog vivo. Dores extraídas dos relatos do Mateus, stories priorizadas
(P0 fiscal / P1 fricção / P2 conveniência), perguntas abertas e cortes.

**Este arquivo é o ÍNDICE. O conteúdo está em `docs/backlog/`, uma entrada por
data.** O diário chegou a 150 KB e toda leitura integral custava ~38k tokens —
quebrado em 2026-08-22, sem reescrever uma linha do conteúdo: só movido.

## Como ler isto sem queimar contexto

1. Este índice (≈5 KB) diz onde está cada coisa
2. `grep -rn '<termo>' docs/backlog/` acha a entrada
3. Abra **só** o arquivo da entrada

Nunca leia `docs/backlog/` inteiro — a soma continua sendo 150 KB.

Ticket e parecer antigos citam `docs/backlog.md` com o nome da seção (*"seção de perguntas respondidas"*, *"5ª revisão da fila"*, *"Gates 2 a 4 do
CONTAI-021"*). Esses nomes continuam existindo **literalmente** nas entradas: `grep -rn '<nome da seção>' docs/backlog/` resolve a citação. Nenhum registro
histórico foi reescrito na quebra.

---
## DECISÕES PENDENTES DO MATEUS (Gate 4 do CONTAI-001, 2026-08-08)

*Bloco destacado: nada aqui avança sem resposta explícita do Mateus.*

1. ~~**Headline "Em pendência"**~~ — **DECIDIDA em 2026-08-17: R$ 49.850.**
   Fechada pelo **contador + PO**, sob a delegação do Mateus do mesmo dia
   (decisão técnica é do Lead+CTO; fiscal e de produto, do Contador+PO — ele
   decide só mock, fatos que só ele sabe, ações fora do app e push).
   O contador **não carimbou nem os 92.850 nem os 47.850**; carimbou a
   recomendação do PO. Parecer completo em
   `docs/pareceres/2026-08-16-gate-fiscal-contai-004-005.md`, Parte 2, com os
   textos de tela prontos e três ressalvas bloqueantes — sendo a maior a R5: o
   *"Custo confirmado R$ 0,00"* ao lado do headline é **estrutural**, e como
   está a home afirma que 100% do que foi gasto está em risco.
   **O `CONTAI-005` está destravado** (ver `docs/tickets/CONTAI-005.md`,
   alternativa (a)). Texto original da pendência, preservado para histórico:

   **Headline "Em pendência" — recomendação do PO: nem 92.850, nem 47.850.**
   Os R$ 47.850 do mock são aritmética de antes do card "pago sem nota"
   existir; os R$ 92.850 somam quatro moedas diferentes (perda de custo,
   conta a pagar e base de INSS). Proposta: headline = **"Custo em risco no
   IR"** = quarentena + pago sem nota (R$ 49.850 no cenário do mock);
   exposição INSS em linha separada expressa **em base** ("R$ 18.000 de NF de
   serviço sem retenção"), sem reais perdidos até o contador fechar o cálculo
   na US-004; boleto sai do headline e fica só como card (o lugar dele é a
   fila "a pagar" da US-002). Efeito colateral: some o double-count apontado
   pelo cto-obra. → **CONTAI-005 [P0]**. Raciocínio completo no Gate 4 do
   ticket CONTAI-001.
2. **Divergências menores do mock — recomendação do PO por item** (detalhe no
   Gate 4 do ticket):
   - linha de imposto da tela 6 → **ratificar a omissão**; volta com a
     fórmula do contador ("até R$ X", com disclaimer);
   - "Destinatário: AJE" omitido → **backlog, anexado à US-008** (a extração
     entrega de graça; perguntar hoje custa mais um campo no caminho ruim);
   - botão "Anotar: falar com o empreiteiro" → **cortar em definitivo**
     (comunicação com empreiteiro é escopo declarado fora do produto);
   - botão "Pedir nota corrigida" → **backlog P2 com trava**: só deep-link de
     WhatsApp com texto pronto, zero estado no sistema;
   - FAB "+ Adicionar" → **ratificar e corrigir o mock** (o mock é que
     ficou com o rótulo da v2);
   - tela 8 parametrizada por porta → **ratificar**;
   - "Favorecido (recente)" → **backlog P1**, primeiro da fila depois do
     login (não é conveniência: CNPJ digitado errado parte a agregação
     CPF-por-CPF da US-004 em dois).
3. ~~**Priorização da fila proposta pelo PO**~~ — **OBSOLETA** (2026-08-09).
   Valia enquanto o produto era de uma obra só. Vale a **"Fila revista — 3ª
   revisão"**, no Gate 2 do CONTAI-003 (fim deste arquivo). As decisões 1 e 2
   acima seguem abertas.

### ⚠️ Q14 — A PERGUNTA MAIS CARA EM ABERTO (acrescentada em 2026-08-10)

> **"A obra sem CNO é empreitada TOTAL — a construtora fornece o material e
> assina a ART da obra inteira?"**

Custa uma frase de resposta e decide **de quem é a obrigação do CNO**. Se for
empreitada total, o CNO é **da construtora**, e o texto que o CONTAI-003 põe em
produção **cobra do Mateus uma obrigação de terceiro** — mandando a pessoa
errada agir e deixando a certa parada, na **única janela de força que existe**
(antes de liberar a próxima parcela; depois do último pagamento não há mais o
que segurar).

- **Não bloqueia** o CONTAI-003 nem a implementação
- **Bloqueia o texto em tela**, junto de uma 2ª condição cumulativa:
  **confirmar na IN vigente de quem é o titular do CNO em empreitada total**
- O `contador` **já redigiu o texto alternativo completo** para o caso de
  empreitada total (título, frase do prazo, próximo passo, rótulo do campo de
  CNO). Ele saiu no review fiscal do Gate 2 e **ainda não está em arquivo** —
  materializar em `docs/pareceres/2026-08-09-obra-sem-cno.md` antes de usar
- **Também muda a ação nº 0 da fila** (registrar o CNO no e-CAC): se for
  empreitada total, essa ação **troca de dono**

---

---

## Estado vigente — o que vale hoje

| O que | Onde |
|---|---|
| **Ordem de execução e status dos tickets** | **`docs/tickets/README.md`** — é o dono. Não mora aqui |
| Decisões travando avanço | bloco **DECISÕES PENDENTES DO MATEUS**, acima neste arquivo |
| Última adjudicação fiscal | `docs/backlog/15-2026-08-21-adjudicacao-fiscal-contai-027.md` |
| Último Gate 4 fechado | `docs/backlog/23-2026-08-23-gate4-contai-027.md` — `CONTAI-027`, **PASS COM RESSALVA**, veredito critério a critério **no corpo do ticket** |
| Ticket ainda por criar | `15-…-adjudicacao-fiscal-contai-027.md` → *"Ticket novo a criar — correção de valor de desembolso do terreno"*; e **`CONTAI-022`** (D26, cartão de crédito, **P0 fiscal**) e **`CONTAI-031`** (E2E da condição 6, P1, que **bloqueia a fatia 5 do `CONTAI-028`**) e **`CONTAI-032`** (D44, default de `data` e `meio`, **P0**, dependente do `CONTAI-025`) — nenhum dos três existe como arquivo. ➕ **`CONTAI-033`** (D49/D52, *nota grava sem o arquivo*, **P0**, com as **três guardas** do parecer como critério) |

✅ **7ª revisão aplicada em 2026-08-23**, direto em `docs/tickets/README.md`. O
**porquê** — movimentos, cortes, a dívida da premissa paga e a **D44** — está em
`docs/backlog/21-2026-08-23-setima-revisao-da-fila.md`, que **não repete a
ordem**.

✅ **Adendo do mesmo dia aplicado (23/08)**, também direto em
`docs/tickets/README.md`: o parecer
`docs/pareceres/2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md`
destravou o `008` no fiscal, criou o **`CONTAI-032`** e trouxe o **`CONTAI-025`**
para dentro da fila como **pré-requisito** dele. O porquê está em
`docs/backlog/22-2026-08-23-adendo-a-setima-revisao.md`. **Não é 8ª revisão** — é
a aplicação de um fato aos itens que ele toca.

⚠️ **As 6 "Fila revista" do diário são REGISTRO HISTÓRICO, não a ordem de hoje.**
Desde 2026-08-23 a ordem vive em `docs/tickets/README.md`, e só lá. As filas do
diário ficam como o raciocínio datado de cada reordenação — 1ª e 2ª em
`05-…-relato-003.md`, 3ª e 4ª em `06-…-gate2-contai-003.md`, 5ª em
`07-…-gate4-contai-002.md`, 6ª em `08-…-incidente-producao-e-fila-vigente.md`.

**Citar qualquer uma delas como ordem vigente é erro**, inclusive a 6ª: ela é de
18/08 e seus dois primeiros itens já estão em produção. Foi essa divergência que
motivou a mudança.

**Fila do diário não se edita** — ela é registro datado. Fila nova é entrada
nova, e este ponteiro passa a apontar para ela.

⚠️ **Status de entrega NÃO mora aqui.** Quem sabe o que foi entregue, com hash de gate por ticket, é
`docs/tickets/README.md` — ele é o mapa. Este índice aponta para **decisões e dores**; duplicar status
nos dois faria os dois divergirem, e ninguém saberia qual mente.

## Fato da obra — consulte aqui ANTES de perguntar ao Mateus

Regra do `CLAUDE.md`: fato da obra se consulta, não se pergunta. As respostas
que já existem estão em:

| Entrada | Seção |
|---|---|
| `02-2026-08-07-relato-001.md` | Perguntas respondidas (2026-08-07) |
| `03-2026-08-07-relato-002.md` | Perguntas fechadas pelo contador (2026-08-08) |
| `05-2026-08-09-relato-003.md` | Perguntas Q11–Q13 — respondidas pelo Mateus em 2026-08-09 |
| `14-2026-08-21-relato-004.md` | Fato da obra registrado (para não ser reperguntado) |
| `24-2026-08-23-relato-005.md` | Fato da obra registrado — **de que conta saiu o dinheiro do terreno** |

Perguntas **ainda abertas**: `03-…-relato-002.md` → *"Perguntas abertas"*;
`05-…-relato-003.md` → *"Perguntas e riscos que o 2º parecer abriu"*; e a Q14
no bloco de decisões pendentes acima.

## Dívidas nomeadas — onde cada uma foi registrada

| Dívida | Entrada |
|---|---|
| D28, D29, D30, D32 | `10-2026-08-18-dividas-gate2-contai-019.md` |
| D31 | `09-2026-08-18-d31-regime-de-caixa.md` |
| D19 (reaberta) | `12-2026-08-19-gate1-contai-021.md` |
| R1–R5 do CONTAI-021 | `13-2026-08-21-gates2-4-contai-021.md` |
| D35 | `14-2026-08-21-relato-004.md` |
| D39 | `15-2026-08-21-adjudicacao-fiscal-contai-027.md` |
| D41 — 4 textos desatualizados em mocks aprovados (login, defaults, carimbo) | `17-2026-08-22-o-que-a-extracao-dos-specs-achou.md` |
| **D42 — condição fiscal 6 sem rede NENHUMA** (nem unit, nem E2E): correção de classificação pode inventar retificadora | `19-2026-08-23-duas-condicoes-fiscais-sem-rede.md` → **`CONTAI-031` (E2E), P1**, decidido em `20-2026-08-23-gate4-contai-029.md`. **Bloqueia a fatia 5 do `CONTAI-028`** |
| D43 — formato do rastro (`p_depois`) é expressão anônima dentro da RPC, com **uma única** asserção E2E a protegê-lo | `19-…-duas-condicoes-fiscais-sem-rede.md`; **dividida em duas no Gate 4** (`20-…-gate4-contai-029.md`): o comentário-guarda em `e2e/correcao.spec.ts:96` vai no **`CONTAI-031`** (custo zero, hoje); a extração de `textoDoRastro` fica na **fatia 5 do `CONTAI-028`** |
| **D44 — RESPONDIDA em 23/08** (`docs/pareceres/2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md` §1): default de `data` E `meio` em produção (`app/adicionar/pagamento/page.tsx:163`, `:169`). A data afirma **dois** fatos — `decidirRegistro` escolhe a ENTIDADE por ela — e o `meio` pré-selecionado torna a recusa do cartão **inalcançável pela inação** | → **`CONTAI-032`**, que **depende do `CONTAI-025`**: tirar o default sem o terceiro estado troca data errada em silêncio por **data inventada pelo dedo**, que é pior |
| **D45 — o bloqueio de mover NF de serviço está errado no saldo** (`docs/pareceres/2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md` §2): protege uma aferição que o app **nem calcula**, ao preço de travar o custo de aquisição no imóvel errado — o único dos dois que já produz passivo, em **duas** vendas futuras. A restrição nunca teve carimbo de parecer | → `CONTAI-008` **destravado** (independente da Q14); a trava migra para a apuração, no `CONTAI-004` |
| **D46 — condição fiscal em ticket sem parecer que a carimbe** (classe, não incidente — a **D32** já nomeara a mesma forma): o critério 13 do `CONTAI-003` levava *"**Restrição fiscal**"* em negrito citando **um ticket**, nenhum parecer; o código a endureceu de *revalidar* para **recusar** e ela travou um **P0** por 13 dias | `22-2026-08-23-adendo-a-setima-revisao.md` → *"O achado de processo"*. **Remédio redigido** (três inserções no `/tickets-req`); **instalar em `.claude/commands/tickets-req.md` é do Mateus**. Varredura retroativa: **uma** linha ofensora hoje, já revogada |
| **D47 — a pergunta que o app sabe que deve fazer, e não faz em superfície nenhuma**: `perguntaPendente`/`perguntaRepresada` só são lidas pelo formulário de anexar — um "sim" superado **não acende em card nem na home**. Agravante: `completarDesembolsoTerreno` faz **duas escritas sem transação**, e a justificativa escrita para isso invoca uma superfície que não existe | `23-2026-08-23-gate4-contai-027.md`. → **ticket novo**, que ⛔ **nasce com parecer do `contador` para o texto do chip ANTES do mock** |
| **D48 — o critério 12b do `CONTAI-027` carrega frase que nenhum parecer carimbou** (*"a resposta nova é gravada sem apagar a anterior"*, atribuída ao §4d **sem estar lá**). É a **D46 na forma inversa** — e **muda a contagem da varredura retroativa da D46: são duas linhas ofensoras, não uma, e a segunda está viva** | `23-2026-08-23-gate4-contai-027.md`. → **pergunta aberta nº 3 ao `contador`**, no corpo do `CONTAI-027` |
| **D49 — travas de anexo-PROVA recusando fato consumado, sem parecer que as carimbe** (superfícies 3 e 4). **Terceira ofensora da classe D46/D48**, e a de espécie diferente: as outras produziram texto errado, esta **produziu abandono do produto** | `24-2026-08-23-relato-005.md`. Resolvida pelo parecer `docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md` (**ADENDO 1 vence o corpo**) → **US-A** no `CONTAI-025`, **US-B** em ticket novo |
| **D50 — `lib/fiscal/terreno.ts` soma por `estado`+`data`, sem olhar anexo**: liberada a gravação, passa a somar custo não demonstrável **em silêncio**, na direção do **D34** | `24-…-relato-005.md` → **mesma entrega da D49**, não depois |
| **D51 — não existe onde registrar de qual conta o dinheiro saiu** (parte dos desembolsos do terreno saiu da conta do cônjuge). Comprovante de terceiro *não se descarta e não se converte* | `24-…-relato-005.md` → **US-D**, ⛔ **bloqueada pelas 3 perguntas ao Mateus** |
| **D52 — a superfície 3 exige migration**: `documento.arquivo_path` é `not null` na `0001` e `status_documento` não tem valor para "registrado sem arquivo"; ⚠️ **`quarentena` não pode ser reaproveitada** | `24-…-relato-005.md` → dentro do ticket da **US-B**; a decisão de modelo é do `cto-obra`, não do `po` |
| D40 — `lib/data.ts` monolítico (2065 linhas, 44 importadores) | `16-2026-08-22-custo-de-contexto-do-pipeline.md` → **`CONTAI-028`**; status em `18-2026-08-23-gate4-contai-028-fatia1.md` (**parcialmente paga**: 2065 → 1803) |

O status de cada uma está na própria entrada — este índice aponta, não duplica.

---

## Entradas do diário (ordem cronológica de registro)

### `01-2026-08-08-gate4-contai-001.md` — 136 linhas
**Gate 4 do CONTAI-001 — 2026-08-08 — validação do PO**
- Fila recomendada pelo PO
- Novos tickets / stories
- Risco de projeto (não é feature, mas é decisão de priorização)
- Ajustes em itens existentes
- Cortado no Gate 4 (com justificativa)

### `02-2026-08-07-relato-001.md` — 161 linhas
**Relato 001 — 2026-08-07 — "Planilha, agenda e o medo do IR"**
- Dores extraídas
- Hipótese de solução do usuário (não é requisito)
- User stories
- Ação imediata (antes de qualquer código)
- Cortado (com justificativa)
- Perguntas respondidas (2026-08-07)

### `03-2026-08-07-relato-002.md` — 69 linhas
**Relato 002 — 2026-08-07 — "PIX mensal pra AJE, nota depois (talvez única)"**
- Dores extraídas
- User stories
- Ação do Mateus (fora do app)
- Perguntas fechadas pelo contador (2026-08-08, review fiscal do CONTAI-001)
- Perguntas abertas

### `04-2026-08-08-gate2-contai-001.md` — 60 linhas
**Gate 2 do CONTAI-001 — 2026-08-08 — reviews aprovados com ressalvas**
- Novos tickets propostos (a priorizar pelo Mateus)
- Requisitos anotados em stories existentes

### `05-2026-08-09-relato-003.md` — 446 linhas
**Relato 003 — 2026-08-09 — "Duas obras ao mesmo tempo: uma para vender, outra para morar"**
- Dores extraídas
- Hipóteses do relato que **não** viraram requisito
- O que o contador respondeu (parecer 2026-08-09)
- Tickets criados
- Fila revista — 2026-08-09 (1ª revisão) — **SUPERADA**
- Novas stories
- Ajustes em stories existentes
- Perguntas Q11–Q13 — respondidas pelo Mateus em 2026-08-09
- 2º parecer do contador — 2026-08-09 — obra em andamento SEM CNO
- Fila revista — 2026-08-09 (2ª revisão, depois das respostas Q11–Q13)
- Por que a fila mudou (e o que eu errei antes)
- Dores novas, extraídas das respostas de 2026-08-09
- Ajustes adicionais em stories existentes (2026-08-09, 2ª revisão)
- Perguntas e riscos que o 2º parecer abriu (não viram requisito hoje)
- Cortado (com justificativa)

### `06-2026-08-10-gate2-contai-003.md` — 304 linhas
**Gate 2 do CONTAI-003 — 2026-08-10 — reviews aprovados com ressalvas**
- A ressalva bloqueante que caiu — o backfill de `data_inicio_obra`
- Dores extraídas das ressalvas
- Tickets criados
- Acrescentado ao CONTAI-007 (sem ticket novo)
- Dívidas nomeadas do CONTAI-003 (nenhuma segura o Gate 2)
- Fila revista — 2026-08-10 (3ª revisão)
- O que mudou em relação à 2ª revisão, e por quê
- Cortado no Gate 2 (com justificativa)
- Fila revista — 2026-08-16 (4ª revisão)
- O que mudou em relação à 3ª revisão, e por quê
- Achados de 2026-08-16 que viram item de backlog

### `07-2026-08-16-gate4-contai-002.md` — 213 linhas
**Gate 4 do CONTAI-002 — 2026-08-16 — DONE COM RESSALVAS**
- Aprovação do Mateus registrada neste gate (escopo exato)
- Tickets novos propostos (precisam passar pelo `/tickets-req`)
- Decisão tomada no gate (não vira ticket)
- Dívidas da implementação fora de ordem (002 antes de 004, 007 e 009)
- Ressalvas R5–R7 do Gate 4 do CONTAI-002 — gravadas em 2026-08-17
- Fila revista — 2026-08-17 (5ª revisão)
- O que mudou, e por quê
- ⚠️ O CONTAI-007 precisa de revisão antes do `/develop` — seis pontos
- Migrations: uma por ticket

### `08-2026-08-17-incidente-producao-e-fila-vigente.md` — 283 linhas
**Incidente de produção — 2026-08-17 — `permission denied for table obra`**
- O achado de processo — a regra de E2E contra o Postgres local tem ponto cego
- Fila revista — 2026-08-18 (6ª revisão) — **SUPERADA**
- US-002 — REESCRITA, não fundida
- O que o uso real produziu em 24 horas
- Dores levantadas no Gate 2 do CONTAI-018 (2026-08-18)
- Dores da correção de documento — 2026-08-18 (origem: adendo + commit `b807901`)

### `09-2026-08-18-d31-regime-de-caixa.md` — 70 linhas
**D31 — "regime de caixa" ainda em três telas que o CONTAI-019 não tocou**

### `10-2026-08-18-dividas-gate2-contai-019.md` — 121 linhas
**Dívidas nomeadas no Gate 2 do CONTAI-019 — 2026-08-18**
- D28 — a tela promete que o relatório trava, e hoje nada trava
- D29 — `getByRole(..., { name })` sem `exact` erra na direção de APROVAR
- D30 — `pagamento_diferenca` aceita UPDATE no valor, e não deveria
- D32 — enum fiscal sem contrapartida no parecer é classe, não incidente

### `11-2026-08-18-terreno-financiado.md` — 67 linhas
**Terreno financiado — 2026-08-18 (absorvidas pelo `CONTAI-010`)**

### `12-2026-08-19-gate1-contai-021.md` — 56 linhas
**Gate 1 do `CONTAI-021` — 2026-08-19 — quatro decisões de escopo do `po` + um achado de código**
- D19 volta à vida — e o `CONTAI-008` foi reaberto

### `13-2026-08-21-gates2-4-contai-021.md` — 110 linhas
**Gates 2 a 4 do `CONTAI-021` — 2026-08-21 — o que ficou em pé, e onde**
- R1 — o array do move aceita duplicata e aceita ato contraditório
- R2 — `alocarCusto` deveria REPORTAR o vínculo órfão, não engoli-lo
- R3 — três dívidas menores, todas do `CONTAI-008`
- R4 — pendência do `contador`, e ela morde a META 2, não este ticket
- R5 — `p_depois is null` recusado, ratificado com validade condicionada
- Achado do Gate 3 (já consertado, `e517cc2`)
- Flake conhecido, para não virar caça a fantasma
- Dores novas achadas no Gate 4 do `CONTAI-021` — 2026-08-21

### `14-2026-08-21-relato-004.md` — 75 linhas
**Relato 004 — 2026-08-21 — *"eu fiz mais de uma transferência"***
- ⚠️ A dor relatada NÃO é a dor do caso dele — e as duas são diferentes
- Fato da obra registrado (para não ser reperguntado)
- Dores extraídas
- O que este relato NÃO virou requisito, e por quê
- D35 sai da lista de dores sem ticket

### `15-2026-08-21-adjudicacao-fiscal-contai-027.md` — 103 linhas
**Adjudicação fiscal do `CONTAI-027` — 2026-08-21 — o critério 13 cai, e três coisas mudam de dono**
- O que aconteceu, e por que fica registrado
- O argumento que está PROIBIDO de voltar
- Regra geral nova, que vale para toda pendência futura
- D39 — a regra de cor mudou, e a decisão é do `po`
- Ticket novo a criar — correção de valor de desembolso do terreno
- O que ficou mais fraco, dito por extenso

### `16-2026-08-22-custo-de-contexto-do-pipeline.md` — 86 linhas
**Custo de contexto do pipeline — 2026-08-22 — o `/develop` estava pagando a mesma leitura N vezes**
- O que foi medido (2026-08-22)
- As quatro causas, e o conserto de cada uma
- Este arquivo é consequência do item que sobrou
- D40 — `lib/data.ts` com 2065 linhas é o custo que sobrou
- O que este item NÃO é

### `17-2026-08-22-o-que-a-extracao-dos-specs-achou.md` — 82 linhas
**Auditoria não planejada — 2026-08-22 — extrair spec dos mocks virou revisão de texto fiscal**
- O achado grave: erro fiscal **em produção**
- O erro estava no PARECER também — e a ordem de conserto importa
- Os outros quatro achados, todos ainda abertos
- A lição de processo

### `18-2026-08-23-gate4-contai-028-fatia1.md` — 147 linhas
**Gate 4 do `CONTAI-028` — 2026-08-23 — fatia 1 ACEITA, ticket segue ABERTO**
- O que este gate provou por conta própria (não por relato)
- Dois números do ticket que estavam errados, e devem ser corrigidos
- Os critérios que NÃO fecham com a fatia 1
- Os dois desvios, julgados
- Prioridade — as fatias 2-7 VOLTAM PARA O FIM DA FILA
- O preço de parar na fatia 1, dito por extenso
- Pendências que este gate abre
- D40 — status

### `19-2026-08-23-duas-condicoes-fiscais-sem-rede.md` — 96 linhas
**Duas condições fiscais sem rede — 2026-08-23 — achado do Gate 2 do `CONTAI-029`**
- D42 — a condição 6 não tem rede NENHUMA, nem unitária nem E2E ⚠️
- D43 — o formato do rastro é uma expressão anônima dentro de uma RPC
- O mapa que sobrou: 10 das 16 condições só têm E2E
- A correção da condição 4, e o erro era de redação

### `20-2026-08-23-gate4-contai-029.md` — 88 linhas
**Gate 4 do `CONTAI-029` — 2026-08-23 — ENTREGUE, com um critério reescrito**
- O critério 4 estava errado (pedia bug); reescrito em 4a/4b
- O critério 2 era literalmente impossível — o mapa das 16 condições vale mais
- Duas ressalvas que viram trabalho de outro ticket
- O que este gate decidiu sobre a fila: **D42 → `CONTAI-031` P1**, D43 dividida
- Redação proposta para o Gate 4 do `develop.md`

### `21-2026-08-23-setima-revisao-da-fila.md` — 206 linhas
**7ª revisão da fila — 2026-08-23 — a primeira que não mora aqui**
- O que mudou em relação à 6ª revisão, e por quê (sete movimentos)
- ⛔ A ordem do release foi invertida — `0009`/`0010` e código já pushado
- 🕯️ D44 — default em campo fiscal, em produção
- O que eu cortei, e por quê · a dívida da premissa de 18/08, PAGA caso a caso
- O que continua parado esperando o Mateus · o que a revisão NÃO fez

⚠️ **A ordem NÃO está nesta entrada** — está em `docs/tickets/README.md`.

### `22-2026-08-23-adendo-a-setima-revisao.md` — 219 linhas
**Adendo à 7ª revisão — 2026-08-23 — o parecer chegou no mesmo dia e mudou quatro postos**
- Por que é adendo e não 8ª revisão (o teste: revisão reexamina tudo; adendo aplica um fato)
- Os quatro movimentos — `025` sobe a pré-requisito, `032` nasce, `022` mantém o posto com o **diagnóstico corrigido**, `008` destrava no fiscal e **não sobe**
- O `032` continua **P0**, por três razões (ano, entidade, guarda desativada) — mudou o custo, não a gravidade
- A metade `meio` do `032` não depende do `025` — **linha do `contador`**, não do `po`
- O achado de processo: **`po` não emite condição fiscal** — redação proposta para o `/tickets-req`
- O que este adendo NÃO fez

### `23-2026-08-23-gate4-contai-027.md` — 118 linhas
**Gate 4 do CONTAI-027 — 2026-08-23 — PASS COM RESSALVA**
- Placar (20 PASS · 1 PENDENTE · 1 CORTADO) e o que foi **reverificado**, não herdado — 488 unitários e 132 E2E rodados no gate
- O ruído de ambiente do Kong que reprovou 38 testes e **não é código**
- **D47** — a pergunta pendente sem superfície, e a justificativa da escrita não-atômica que invoca tela inexistente
- **D48** — frase fiscal no critério 12b **sem parecer que a carimbe** (D46 invertida); a varredura da D46 passa a ter **duas** ofensoras
- A lição de processo: *"Gate 1 não é fim de nada"* é necessária e **insuficiente** — as quatro recomendações, sendo a primeira **tirar o `git push` do Gate 1**
- Pré-autorização de revisor **adjudicada**, com a fronteira escrita

### `24-2026-08-23-relato-005.md` — 328 linhas
**Relato 005 — 2026-08-23 — *"fui bloqueado pelos comprovantes e daí parei de usar"*** ⚠️ **o Mateus abandonou o app**
- A dor relatada não é a dor — e o texto de bloqueio citado é de **outra entidade**
- A régua que faltava: anexo-**PROVA** × anexo-**FONTE**, e o teste de duas perguntas
- **Inventário das 6 superfícies de registro**, com veredito uma a uma (2 já certas, 2 liberar, **2 mantêm a recusa**)
- Dores **D49–D52** · US-A a US-E · o que eu **recusei** ao Mateus, contra o pedido explícito dele
- Fato da obra: **parte dos desembolsos do terreno saiu da conta do cônjuge**
- Achado de processo: a **D46 tem terceira ofensora**, e duas lições novas (critério que **viaja entre entidades**; **falta de inventário** de regra transversal)

---

## Ao acrescentar ao backlog

Nova entrada = **arquivo novo** em `docs/backlog/`, nomeado
`NN-AAAA-MM-DD-assunto.md`, mais uma linha neste índice. Não volte a engordar
um arquivo único: foi exatamente assim que ele chegou a 150 KB.
