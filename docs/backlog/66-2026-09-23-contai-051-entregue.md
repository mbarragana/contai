# CONTAI-051 entregue — 2026-09-23 — `/obras` migra para o padrão de reflow do shell

## O que foi entregue

`ColunaDeEscolha` (local, `app/(gestao)/obras/page.tsx`) envolve os quatro
estados da tela (carregando, erro, vazio, pronto) com `max-w-[640px]` — a
mesma medida de "coluna de leitura confortável" que `ColunaDeDetalhe` já usa,
reaproveitada como número, não como componente semântico de detalhe
(critério 1: `/obras` é família "lista/escolha de nível superior da sidebar",
irmã de `/despesas`/`/pendencias`, não de detalhe de registro).

Os dois `max-w-[430px]` isolados — "Cadastrar a primeira obra" (estado vazio)
e "+ Nova obra" (estado populado) — saíram; os dois botões agora vivem dentro
do mesmo envoltório da lista, na mesma largura dela. `ListaDeEscolha`
(`app/_components/obra.tsx`) não foi tocada: o teto mora só no envoltório da
página, para não vazar para `TelaTrocarObra` (mesma lista, usada dentro da
coluna de formulário de `(captura)`).

Zero mudança de lógica, campo ou texto — confirmado por diff: as únicas
alterações em `obras/page.tsx` trocam `<>...</>` por `<ColunaDeEscolha>` e
removem os dois `max-w-[430px]`; nenhuma string de `Banner`/`Dica`/estado
vazio muda.

## Gates

- **Gate 1** (`lead-engineer`): DONE.
- **Gate 2 técnico** (`cto-obra`): REQUEST CHANGES na 1ª rodada — o docblock
  de `ColunaDeEscolha` justificava os 640px dizendo que era "a largura do
  destino do clique", mas o clique em um card chama `escolher()` e vai para
  `/` (full-width), não para `/obras/[id]`. Corrigido só o comentário (zero
  mudança de código/teste). Reconfirmado por escrito: **APPROVE**.
- **Gate Fiscal**: não se aplica — reflow puro, declarado no próprio ticket.
- **Gate 3** (validação manual no navegador, orquestrador): em 1440px, card
  "Casa Cachoeira" e botão "+ Nova obra" medem exatamente 640px via JS
  (`getBoundingClientRect().width`), mesma coluna, sem `[data-coluna="detalhe"]`
  no DOM. Em ~490px, `scrollWidth === clientWidth` (zero scroll horizontal),
  card e botão ocupam a largura útil sem overflow. 940 unitários + 296 E2E
  verdes, incluindo os 3 testes novos (desktop populado, desktop vazio, piso
  375px).
- **Gate 4** (`po`, este registro): PASS, 6/6 critérios.

## Critério a critério

1. **Família lista/escolha, não detalhe** — PASS. `ColunaDeEscolha` local,
   sem `ColunaDeDetalhe`/`CabecalhoDaTela`; título continua vindo da rota
   (`tituloDaView`), sem `<h1>` na página.
2. **Teto de largura sensato (640px)** — PASS. Confirmado por medição manual
   (Gate 3) e por `e2e/shell-desktop.spec.ts` (coluna, cards e "+ Nova obra"
   todos em 640px, mesmo eixo x).
3. **Remover os dois `max-w-[430px]` soltos** — PASS. Confirmado por diff:
   os dois desaparecem do arquivo, botões passam a herdar a largura do
   envoltório.
4. **Zero mudança de lógica/campo/texto fiscal** — PASS. Diff mostra só troca
   de casca estrutural (Fragment → `ColunaDeEscolha`) e remoção dos
   `max-w-[430px]`; nenhuma string tocada. `e2e/shell-desktop.spec.ts` trava
   o texto do estado vazio palavra por palavra.
5. **375px deixa de travar a decisão, mas não pode quebrar objetivamente** —
   PASS. `e2e/obra.spec.ts` prova, no piso de 375px, que a coluna ocupa a
   largura útil inteira do `main`, sem scroll horizontal e sem texto
   truncado, e que a escolha de obra continua funcionando.
6. **Nenhuma mudança em `ListaDeEscolha` além do teto do envoltório** — PASS.
   `app/_components/obra.tsx` e `app/_components/shell.tsx` não aparecem no
   diff — confirmado por `git status`/`git diff`.

## Efeito na fila

`CONTAI-051` sai da fila ativa, entregue. **Fila de implementação fica
vazia** (`docs/tickets/README.md`) — o trio "Export do acervo" continua em
espera por decisão do Mateus (`63-2026-09-23-export-acervo-em-espera.md`) e
`CONTAI-014` continua parado aguardando aprovação de arte/teste no aparelho.
