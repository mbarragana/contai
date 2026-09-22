# CONTAI-046 Obra e Terreno — detalhe migra para o shell de gestão

## Tipo e Prioridade
chore/refactor de UI — **P1, fricção de processo**. Mesma natureza dos
`CONTAI-043`/`044`/`045`. **Quarto e último ticket** da dívida do
`CONTAI-040` (ordem sugerida: `043` → `044` → `045` → `046` — este vem por
último por ser o de maior superfície e menor frequência de uso: terreno e
discriminação anual se tocam poucas vezes por ano, não a cada conciliação).

## Dor de Origem
Mesma dívida nomeada em `app/(captura)/layout.tsx`. O seam mais direto de
todos: `app/_components/shell.tsx` — o próprio shell entregue pelo
`CONTAI-040` — linka `/obras/${obra.id}` e `/obras/${obra.id}/terreno` a
partir da **sidebar permanente**. Todo clique nesses dois itens de menu, que
existem desde o dia 1 do shell, sai do shell.

## User Story
Como dono da obra revisando o cadastro, o terreno financiado ou a
discriminação anual pronta para a declaração, quero abrir esses detalhes a
partir da sidebar sem trocar de casca — inclusive quando reviso a posição do
financiamento ano a ano.

## Escopo e Critérios de Aceite

**✅ Entregue em 2026-09-22, 6/6 critérios.** `obras/[id]`, `terreno/*`,
`discriminacao/[ano]` e `notas-sem-cno` migraram para o shell, coluna 640px
(inclusive discriminação, sem exceção — o texto é `<pre>` que não trunca).
Gate 2 com 1 rework: corrigido de vez o teste flaky de fuso horário de
`discriminacao.spec.ts` (dívida desde 2026-09-20). Suíte fecha **265/265
E2E, sem nenhuma falha conhecida** pela primeira vez na sessão. Gate 4
(`po`) PASS. Sem migration. **Fecha os quatro tickets da dívida do
CONTAI-040 (043→044→045→046).**

1. Mover para `app/(gestao)/`: `obras/[id]` (cadastro/detalhe da obra),
   `obras/[id]/terreno` (+ `desembolsos`, `financiamento`,
   `informe/[anoBase]`), `obras/[id]/discriminacao/[ano]`,
   `obras/[id]/notas-sem-cno`. Comportamento idêntico, casca nova.
2. Coluna ~560px para as telas de formulário/cadastro. **Pergunta aberta
   para o `designer`**: `discriminacao/[ano]` é a tela de saída anual (texto
   de Bens e Direitos pronto para colar na declaração) — decidir no Gate 0 se
   o texto longo cabe bem em 560px ou se, como a alocação de fatura do
   `CONTAI-044`, é candidata a exceção de largura com justificativa própria
   (texto de discriminação não pode ficar truncado nem exigir scroll
   horizontal — regra de legibilidade fiscal vale mais que a régua de
   largura).
3. Nenhum texto fiscal muda. Atenção redobrada aqui: `discriminacao/[ano]` e
   `notas-sem-cno` são as duas telas com mais texto fiscal por área de tela
   do produto inteiro (texto de Bens e Direitos, posição da aferição INSS,
   aviso de CNO). Prova de aceite: comparação byte a byte, sem exceção.
4. `podeGerarRelatorioAnual` (porta única com veto por bloco, `CONTAI-036`)
   continua sendo a única fonte que decide se a discriminação pode ser
   gerada — a migração de casca não pode criar um segundo caminho de decisão.
5. Sidebar, obra ativa e ano lidos de `useGestao()`. Atenção: `terreno/
   informe/[anoBase]` e `discriminacao/[ano]` recebem o ano por **parâmetro
   de rota**, não pelo `ano` do shell — o CONTAI-042 (§5, Gate Fiscal) fixou
   que "o ano também é um só" dentro do shell; confirmar com o `cto-obra` no
   Gate 1 que navegar para um ano diferente do ano do shell (ex.: revisar a
   discriminação de um ano anterior) não corrompe o `ano` que o dashboard e
   `/pendencias` leem depois de voltar.
6. `375px` deixa de ser piso obrigatório. `/obras/nova` (assistente de
   cadastro) **não migra** — decisão deste ticket, ver Fora de Escopo.

## Fora de Escopo
- `/obras/nova` — é captura pontual (assistente de cadastro usado uma vez
  por obra, não recorrente), não gestão recorrente. Fica em `(captura)`.
- `/conta` e `/entrar` — fora desta rodada inteira de migração, não só deste
  ticket. `/entrar` é pré-autenticação: não existe obra ativa, sidebar nem
  contexto de shell para uma tela de login habitar — permanece
  estruturalmente fora do shell de gestão, não é dívida a pagar depois.
  `/conta` é uma tela de configuração de baixa frequência que hoje não é
  destino de nenhum link do shell novo (diferente das outras quatro
  famílias, não há seam em produção) — candidata a um ticket próprio, pequeno
  e sem prioridade definida, se o Mateus sentir a mesma fricção; não faz
  parte dos quatro tickets desta dívida.
- Qualquer mudança na lógica de terreno/financiamento (`lib/fiscal/
  terreno.ts` ou equivalente) ou na composição da discriminação.

## Gate Fiscal (Contador)
Sem regra fiscal nova. Gate 2 do `contador` obrigatório e com maior
profundidade que os três irmãos: `discriminacao/[ano]` é a tela cujo texto
alimenta a ficha Bens e Direitos diretamente — qualquer reflow que corte,
reordene ou reformate esse texto é candidato a erro fiscal, não só
cosmético.

## Pre-mortem
1. **Texto de discriminação truncado ou exigindo scroll horizontal dentro de
   560px** — mesma classe de erro que motivou a régua de 560px (legibilidade
   perdida), só que na direção oposta: coluna estreita demais para texto
   longo. Ver pergunta 2 do escopo.
2. **`ano` do parâmetro de rota vazando para o `ano` do shell** (ou
   vice-versa) ao navegar entre `discriminacao/2025` e `discriminacao/2026`
   dentro do mesmo shell — o Gate Fiscal do `042` existe exatamente para
   evitar dois anos divergentes entre badge/fila e o que a tela mostra.
3. **`/obras/nova` sendo arrastado para o shell por engano** por estar sob o
   mesmo prefixo `/obras/` das rotas que migram — reforçar no Gate 1 que é
   exclusão deliberada, não esquecimento.

## Dependências
- **Gate 0 RESOLVIDO em 2026-09-21**: mesmo spec "detalhe dentro do shell"
  (`design/mocks/detalhe-no-shell-v1.md`/`.html`, coluna 640px)
  do `CONTAI-043`, mais a pergunta específica da largura de
  `discriminacao/[ano]` (item 2 do escopo).
- Não bloqueia nem é bloqueado pelos irmãos `043`/`044`/`045`.

## Cenário e checagem final
**Gestão** — em casa, sentado, revisando terreno/financiamento ou preparando
a declaração. O "Teste do Canteiro" não se aplica.
