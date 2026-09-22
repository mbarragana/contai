# CONTAI-046 entregue — 2026-09-22 — obra e terreno migram para o shell

Quarto e último ticket da migração de telas de detalhe para o shell de
gestão desktop (`043`-`046`). `obras/[id]` (cadastro/detalhe), `obras/[id]/
terreno` (+ `desembolsos`, `financiamento`, `informe/[anoBase]`),
`obras/[id]/discriminacao/[ano]` e `obras/[id]/notas-sem-cno` saem de
`app/(captura)/` e entram em `app/(gestao)/`, mesma casca dos três
tickets anteriores. Era o seam mais direto de todos: a própria sidebar do
CONTAI-040 já linkava "Obras" e "Terreno" desde o dia 1, derrubando o
usuário na casca velha a cada clique.

`discriminacao/[ano]` — a tela cujo texto alimenta a ficha Bens e Direitos
diretamente — foi a que exigiu Gate 2 mais profundo (pedido pelo próprio
ticket). Ficou em 640px sem exceção de largura: o bloco copiável é `<pre
whitespace-pre-wrap break-words>`, não trunca nem exige scroll horizontal.
`podeGerarRelatorioAnual` (CONTAI-036) continua sendo a única porta que
decide se a discriminação pode ser gerada. O `ano` recebido por parâmetro
de rota (`discriminacao/[ano]`, `informe/[anoBase]`) não interfere no
`ano` único do shell (Gate Fiscal do CONTAI-042 §5) — `useGestao().ano` é
`hojeIso()` puro, sem setter, nenhuma tela escreve nele.

**Achado que fecha uma dívida de dois dias atrás**: o E2E de
`discriminacao.spec.ts` tinha uma falha intermitente desde o CONTAI-005
(2026-09-20, `docs/backlog/35-...md`), nunca corrigida, sempre descartada
como "pré-existente e não-relacionada" nos tickets seguintes. Como o
CONTAI-046 tocava exatamente essa rota, o `lead-engineer` investigou a
fundo em vez de repetir o descarte: é bug de FUSO HORÁRIO no teste
(`Date.now() - 86_400_000` em UTC vs. `hojeIso()` local — entre 21h e
23h59 local, "ontem" em UTC vira "hoje" em local). O `cto-obra` decidiu
explicitamente corrigir dentro deste ticket, não empurrar de novo: helpers
`hoje()`/`maisDias()` (mesma família de `terreno.spec.ts`/
`compromisso.spec.ts`), prova numérica com `TZ=Pacific/Midway` dentro da
janela exata do bug. **A suíte inteira fecha 265/265, sem nenhuma falha
conhecida, pela primeira vez nesta sessão.**

Testado: 890 unitários + 265/265 E2E + validação manual extensa no
browser (sidebar, formulário de desembolsos, discriminação sem corte de
texto, notas-sem-cno, breadcrumbs em 2 níveis, `/adicionar`/`/obras/nova`
intocados). Gate 4 (`po`) PASS, 6/6 critérios. Sem migration.

Com este ticket, a rodada "desktop shell" iniciada pela rejeição do
CONTAI-039 está completa: `042` (pendências unificadas) → `040` (shell +
dashboard) → `041` (despesas, ainda pendente) → `043`/`044`/`045`/`046`
(telas de detalhe migradas). Único item restante da rodada: `CONTAI-041`.

## Dívidas nomeadas

- `app/(captura)/obras/_campos.tsx` continua em `(captura)` mas é
  importado por telas de `(gestao)` — mover tocaria `/obras/nova`, Fora de
  Escopo. Candidato a `app/_components/obra-campos.tsx` numa limpeza
  futura, sem urgência.
