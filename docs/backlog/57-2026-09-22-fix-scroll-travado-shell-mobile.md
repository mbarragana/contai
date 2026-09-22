# Fix: scroll do shell travava antes do fim em telas estreitas — 2026-09-22

Relato do Mateus, com print de `/obras/[id]/terreno/desembolsos`: "o scroll
está indo para baixo dos botões" — e "os cards de anexo, estranho alinhados
à esquerda, alinhe no meio".

Investigação ao vivo (browser, ~575×780, abaixo do breakpoint `lg`) mostrou
que o problema era mais grave que cosmético: em qualquer tela migrada nos
CONTAI-043/044/045/046 com conteúdo longo o bastante, a página parava de
rolar ANTES do fim real do conteúdo — o formulário "Registrar um
desembolso" (com o botão de gravar) ficava **inacessível**, sem forma de
chegar até ele por scroll.

Duas causas reais, nenhuma delas a hipótese inicial (`sticky`/`h-dvh`):

1. **`app/_components/shell.tsx`** — a coluna de conteúdo do shell (`flex
   min-w-0 flex-1 flex-col`) herdava `min-height: auto` de item flex: não
   conseguia encolher abaixo da altura do próprio conteúdo, crescia dentro
   do `h-dvh`, e o `<main overflow-y-auto>` ficava sem nada para rolar
   internamente — era a PÁGINA inteira que tentava rolar em vez do `main`.
   Em `lg` (desktop) isso não aparecia, porque lá a coluna é item do eixo
   transversal e o `stretch` já limitava a altura — por isso o bug
   atravessou os 4 tickets de migração sem ninguém notar. Fix: `min-h-0`.
2. **`app/_components/campos.tsx`** — o rádio `sr-only` do componente
   `Escolha` é `position: absolute` sem ancestral posicionado; o `<label>`
   virava o `static` mais próximo, o rádio escapava do `overflow-hidden`
   do shell e esticava o DOCUMENTO inteiro até a posição estática dele —
   um vazio em branco enorme na página, exatamente o sintoma do print.
   Fix: `relative` no `<label>`.

Fix 2 (visual, do print): `items-start` → `items-center` em `ItemDeAnexo`
(`app/_components/anexo.tsx`) — os cards de anexo (ícone/nome/chip/botão
"Abrir") ficam alinhados pelo centro, não pelo topo.

Guarda nova: `e2e/rolagem-no-shell.spec.ts` (4 casos) mede geometricamente
quem rola (html vs. `main`) e se o rodapé de ação cabe na janela — não usa
`click()`/locator sozinho, porque clique rola a página automaticamente e
mascararia a regressão. Provado não-vacuoso (falha sem o fix via `git
stash`, passa com).

Revisado pelo `cto-obra` (APPROVE): confirmou que `relative` sem offset não
muda layout nem stacking context, testou a mesma correção em 3 rotas de
`(captura)` (que também usam `Escolha`) sem efeito colateral. 925
unitários + 278 E2E + 4 novos. Sem regra fiscal tocada — layout puro.

## Dívida nomeada

- `app/(gestao)/despesas/page.tsx:307` tem outro `sr-only` (`<span>Ação</span>`)
  sem ancestral posicionado — mesma classe de bug, hoje inofensivo (o
  `thead` some abaixo de `lg`, e em `lg` a coluna já é limitada). Se esse
  `thead` um dia aparecer no mobile, aplicar `relative` no `ThFixo` antes
  de reabrir este incidente.
