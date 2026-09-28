# Relato processado — 2026-09-28 — Agenda no menu lateral; Faturas fica de fora

**Origem**: relato direto do Mateus, seguido de investigação de código antes de
qualquer pergunta (fato da obra/código não se pergunta: se consulta).

## Relato

> "temos que adicionar no menu da lateral, faturas e compromissos, ou agenda
> para ter de fácil acesso as rotas existentes"

## Dor extraída

Duas rotas de gestão existem mas não estão no menu lateral
(`VIEWS_DE_GESTAO`, `lib/gestao/navegacao.ts:30-35` — hoje 4 itens: "Visão
geral" `/`, "Despesas" `/despesas`, "Pendências" `/pendencias`, "Obras"
`/obras`):

- **Agenda/Compromissos** (`/compromisso`,
  `app/(gestao)/compromisso/page.tsx`) — tela completa e funcional (`Agenda`,
  "ver todos (N)"), hoje só alcançável clicando num link específico dentro da
  Home. Mais de um clique para uma tela que o Mateus quer revisar direto, sem
  passar pela Home.
- **Faturas** — o relato pede o mesmo tratamento, mas a investigação achou uma
  discrepância: **não existe hoje uma tela de lista de faturas.** Só existe
  `/fatura/[id]` (detalhe de UMA fatura específica, sempre com id). O próprio
  `lib/gestao/navegacao.ts:177` já documenta isso: *"`/fatura` não existem sem
  id"*. Item de menu que não abre nada é link morto (mesma régua do
  `CONTAI-040`).

A dor de fundo é a mesma nos dois casos: **item de navegação de baixo
alcance** (2+ cliques a partir da Home) para tela que o Mateus usa com
frequência na gestão — não é fricção de captura, é fricção de acesso rápido
em uso sentado, em casa.

## Discrepância apresentada ao Mateus, e decisão dele

Antes de prosseguir, a discrepância (Faturas não tem rota de lista) foi
levada ao Mateus com 3 opções:

1. Criar tela nova de lista de faturas.
2. Adicionar só Agenda por enquanto, Faturas fica de fora.
3. Apontar "Faturas" no menu para `/despesas` (que já lista tudo, faturas
   inclusive, misturado com o resto).

**Mateus escolheu a opção 2**: só Agenda entra nesta rodada. Faturas continua
acessível como hoje (via despesa ou via compromisso de cartão que leva ao
detalhe da fatura), sem representação própria no menu.

## Classificação de prioridade

**P2 — conveniência de navegação.** Não é obrigação fiscal (nenhum documento
sem tratamento, nenhuma saída anual afetada) nem fricção que bloqueia
processo (a Agenda já é alcançável hoje, só exige passar pela Home antes) —
é atalho para tela existente. Confirma a classificação sugerida no relato.

## User story

**Persona**: o dono da obra em casa, sentado, gerenciando a obra (cenário
principal de gestão) — quer chegar direto na agenda de compromissos sem
passar pela Home primeiro.

**Gatilho**: o Mateus está em qualquer tela do shell de gestão e quer ver a
agenda de compromissos (agendados, vencidos, futuros).

**Ação**: clica no item novo do menu lateral (nome final — "Agenda",
"Compromissos" ou equivalente — a critério do `designer`/`cto-obra` no
`/tickets-req`; não é decisão de produto, é rótulo).

**Resultado esperado**: chega em `/compromisso` em 1 clique, de qualquer tela
do shell, sem depender de link dentro da Home.

**Critério de aceite**:
1. `VIEWS_DE_GESTAO` (`lib/gestao/navegacao.ts:30-35`) ganha um 5º item
   apontando para `/compromisso`, com rótulo a definir.
2. O item aparece no menu lateral (desktop) e na faixa estreita (mobile) em
   toda tela do grupo `(gestao)` — mesma garantia que os 4 itens atuais já
   têm (nenhum item de navegação nasce/morre por conteúdo condicional,
   conforme o docblock do próprio arquivo).
3. `/compromisso` continua acessível pelo link dentro da Home também (não é
   substituição, é caminho adicional).
4. Nenhuma mudança em `/fatura/[id]` nem invenção de rota de lista de
   faturas nesta rodada.
5. Verificável por `navegacao.test.ts` (ou teste equivalente que já cobre
   `VIEWS_DE_GESTAO`) mais uma checagem E2E/manual de que o item navega para
   `/compromisso` a partir de outra tela do shell (ex.: a partir de
   `/despesas`).

Ordem exata do item na lista (antes ou depois de "Obras"?) e comportamento
específico na faixa estreita mobile ficam para o `cto-obra`/`designer`
decidirem no `/tickets-req` — não são decisão de produto, são de
apresentação/hierarquia visual.

## Filtro de escopo

**Dentro**: item novo em `VIEWS_DE_GESTAO` apontando para a rota `/compromisso`
já existente. Trivial — rota e tela já existem, é navegação, não feature
nova.

**Fora, explicitamente, nesta rodada — Faturas**:
- Não existe tela de lista de faturas hoje; construir uma é feature nova
  (não "adicionar item de menu"), fora do pedido mínimo que o relato faz.
- As 3 opções levantadas ficam registradas para retomada futura, quando/se o
  Mateus quiser voltar ao assunto:
  1. tela de lista de faturas nova;
  2. (escolhida para Agenda, não se aplica a Faturas nesta rodada — N/A);
  3. apontar "Faturas" do menu para `/despesas`.
- Nenhuma das três serve às três metas do produto de forma direta (não é
  documento hábil, não é saída anual, não é acervo) — é navegação pura, e a
  ausência de tela de lista não bloqueia nenhuma meta hoje: fatura já é
  alcançável via detalhe (`/fatura/[id]`) a partir de `/despesas` ou de um
  compromisso de cartão.

## Perguntas de esclarecimento

Nenhuma pergunta em aberto — o escopo já foi decidido pelo próprio Mateus
durante a investigação (opção 2, Agenda entra, Faturas fica de fora). Falta
só o rótulo final do item de menu, que fica delegado ao `designer`/`cto-obra`
por ser apresentação, não requisito.

## Encaminhamento

Pronto para `/tickets-req`: sem Gate Fiscal (é navegação pura, zero campo
fiscal envolvido, `contador` não precisa ser consultado), sem migration,
complexidade trivial (rota e tela já existem). Candidato a nível 1/2 de
design (troca de lista de itens, sem estado novo).
