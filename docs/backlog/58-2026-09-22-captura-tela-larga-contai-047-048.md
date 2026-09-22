# Captura ganha tela larga — 2026-09-22 — resposta à pergunta aberta do CONTAI-039/desktop-first

## Contexto

Pergunta que ficara em aberto desde `45-2026-09-21-cenario-desktop-first-
contai-039.md` (pergunta 2: "a permissão de quebra vale só para telas de
GESTÃO ou também para a tela de CAPTURA?"). O Mateus respondeu hoje, ao ver
`/adicionar/documento` — intocada em toda a rodada de shell (`CONTAI-040`,
`043`-`046`) — esticada num monitor largo sem aproveitar a largura: **as
telas de captura também devem ganhar tratamento desktop**, motivo declarado
dele mesmo *"eu uso mais em casa do que no canteiro"*.

Já registrado em `CLAUDE.md`, seção "Cenários de uso — 2ª correção", bloco
"✅ RESPONDIDA em 2026-09-22".

## A dor

`app/(captura)/layout.tsx` fixa `max-w-[430px]` para **todas** as rotas do
grupo — hoje só `/adicionar/*`, `/obras/nova`, `/conta`, `/entrar` (as telas
de detalhe migraram para `(gestao)` nos `043`-`046`). Seam concreto: o
`MenuNovoRegistro` do shell (`CONTAI-040`) já oferece as 3 opções de registro
a partir de uma tela larga, mas os `href`s aterrissam na mesma coluna de
430px de sempre — o usuário clica a partir do dashboard largo e cai numa
faixa estreita centralizada, o mesmo sintoma visual que motivou a rejeição do
`CONTAI-039`.

## Classificação
Fricção de processo — não é obrigação fiscal (nenhuma das 3 metas do produto
depende disto) nem conveniência pura (é o mesmo tipo de correção de doutrina
que já rendeu ticket P1 nos `043`-`046`).

## Consulta técnica ao `cto-obra` (2026-09-22)

Antes de escopar, o `po` perguntou ao `cto-obra` se a rota certa era mover
`/adicionar/*` para dentro de `(gestao)` (reaproveitando `ColunaDeDetalhe`/
`shell.tsx`, como os `043`-`046` fizeram com as telas de detalhe) ou manter a
rota em `(captura)` e dar a ela uma segunda casca larga própria.

**Resposta, resumida** (opinião técnica completa preservada no transcript da
consulta; decisão formal vai nos tickets):

- **Rejeita mover para `(gestao)`.** Três razões concretas: (1) o
  `ShellDeGestao` abaixo de `lg` já não é "sem shell" — renderiza faixa de
  navegação e topbar, o que traria chrome de gestão para dentro do canteiro,
  piorando o "Teste do Canteiro" em vez de preservá-lo; (2) `(gestao)/
  layout.tsx` embrulha tudo em `ProvedorDeGestao` (fetch de dashboard/
  pendências) — colocaria rede de gestão no caminho da captura e criaria
  DUAS fontes de "obra ativa" (`useGestao` × `useObraDoRegistro`), reabrindo
  o Pre-mortem 3 do `CONTAI-040`; (3) mapear as sub-telas de substituição
  inteira dos 3 formulários (`TelaTrocarObra`, `Registrado`, bloqueio de CNO,
  diálogo de saída) para os componentes de `(gestao)` é refactor de
  estrutura, não de largura.
- **Recomenda manter em `(captura)`**, dando ao `layout.tsx` um segundo
  breakpoint largo (~720px, não full-width — a lição do Gate 2 do
  `CONTAI-039` de que largura cheia mede pior que coluna limitada se repete
  aqui, mesmo raciocínio que fixou `ColunaDeDetalhe` em 640px). Dentro das
  páginas, só os campos escalares curtos (data, valor, meio, número da nota)
  ganham `lg:grid-cols-2`; blocos de pergunta fiscal (`Escolha` + texto de
  consequência) ficam em coluna única, para não repetir o erro de
  legibilidade do `CONTAI-039`.
- **Achado por conta própria, promovido a ticket separado**: o ganho real de
  estar no desktop não é "campos lado a lado" — é **ver o anexo (PDF/foto) ao
  lado do formulário** enquanto confere a extração. É viável sem migration
  (blob URL client-side), mas é **feature nova**, não casca — vira
  `CONTAI-048`, com `/design` próprio, não bloqueante.
- Sem migration em nenhum dos dois. Precisa atualizar `e2e/
  shell-desktop.spec.ts` (asserts de largura 430px em `/adicionar/pagamento`
  e `/obras/nova` mudam de valor em viewport largo; o assert de ausência de
  `[data-shell]` continua valendo).
- Sugestão de fatiamento: **1 ticket** para a casca (layout + grids + hub
  herdado de graça + `/entrar` autolimitado + specs), com contingência de
  fatiar em dois se `documento/page.tsx` (o maior, com bloqueio de CNO e
  extração) deixar o Gate 1 grande demais — decisão do `po` no próprio
  Gate 0, não fechada aqui.

## Decisão do `po`

Dois tickets, nenhum bloqueia o outro:

- **`CONTAI-047`** — casca de tela larga para `/adicionar/documento`,
  `/adicionar/pagamento`, `/adicionar/compra-cartao` (+ hub, `/obras/nova`,
  `/entrar` autolimitado). Reflow de layout, zero mudança de campo/validação/
  texto fiscal — mesma disciplina dos `043`-`046`. P1, fricção de processo.
  Gate 0 (`/design`) ainda não fechado.
- **`CONTAI-048`** — anexo visível ao lado do formulário em
  `/adicionar/documento`, em telas largas. Feature nova (não casca), P1
  fricção de processo mas **não bloqueante** — nasce sem mock, backlog
  "Depois" até o `designer` desenhar. Reaproveita a largura que o `047` cria,
  mas não depende dele para ser escopado.

## O que ficou explicitamente fora, e por quê

- **Mover `/adicionar/*` para `(gestao)`** — avaliado e rejeitado pelo
  `cto-obra` (ver seção acima). Fica registrado para ninguém reabrir sem
  citar por que foi descartado.
- **Full-width sem coluna** — mesma lição do Gate 2 do `CONTAI-039`.
- **Mudar qualquer campo, passo, validação ou texto fiscal** — os dois
  tickets são estritamente aditivos em cima do que já existe.
- **Aplicar o anexo lado a lado a `pagamento`/`compra-cartao`** — esses dois
  fluxos não têm extração para conferir campo a campo; fica fora do `048` até
  um relato pedir.

## Perguntas abertas
Nenhuma para o Mateus neste momento — as duas perguntas técnicas que
existiam (mover rota vs. casca própria; o que fazer com o achado do anexo)
foram fechadas pela consulta ao `cto-obra` e pela decisão de escopo acima. O
que resta é decisão de `/design` (Gate 0 dos dois tickets), não pergunta de
produto.

## Fora de escopo desta entrada
Não fecha o Gate 0 de nenhum dos dois tickets — isso é trabalho do
`designer`, registrado como dependência em cada ticket.
