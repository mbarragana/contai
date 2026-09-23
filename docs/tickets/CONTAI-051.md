# CONTAI-051 — `/obras` ("Trocar obra") migra para o padrão de reflow do shell

## Tipo e Prioridade
chore/refactor de UI — **P1, fricção de processo**. Mesma natureza e mesma
disciplina dos `CONTAI-043`/`044`/`045`/`046`: reflow puro, zero mudança de
campo/lógica/texto. Não é dívida nova do produto — é uma **lacuna** da
própria rodada de migração para o shell desktop: `app/(gestao)/obras/
page.tsx` nunca entrou em nenhum dos tickets `040`, `043`-`046` ou `047`.

## Dor de Origem
Achado do coordenador ao auditar, em 2026-09-23, quais rotas já foram
adaptadas para desktop. Confirmado por leitura direta do código:

- A página não usa `ColunaDeDetalhe`/`CabecalhoDaTela` nem nenhum outro teto
  de largura — retorna um Fragment cru, e `app/(gestao)/layout.tsx` não
  impõe teto nenhum no `<main>` (cada página é responsável pelo próprio).
- `ListaDeEscolha` (`app/_components/obra.tsx`) renderiza os cards de obra
  (`<button>` por obra) sem largura máxima nenhuma — numa tela larga eles
  esticam para a largura toda do shell.
- Os botões **"Cadastrar a primeira obra"** (estado vazio) e **"+ Nova
  obra"** (estado populado) estão hardcoded em `max-w-[430px]`, resquício
  isolado da era pré-shell.
- Resultado prático numa tela larga: lista esticada ao lado de botão
  apertado — **a mesma inconsistência visual que motivou a rejeição do
  Conceito 1 do `CONTAI-039`**, reintroduzida numa tela que passou batido.

Esta é a porta de entrada quando não há obra ativa confiável, e o destino do
link **"Trocar obra"** da sidebar (`app/_components/shell.tsx`, sempre
`href="/obras"`) — ou seja, é alcançável a qualquer momento a partir de
qualquer tela de gestão.

## User Story
Como dono da obra trocando a obra ativa (ou cadastrando a primeira) em tela
larga, quero que a lista de obras e os botões de ação tenham o mesmo
acabamento visual do resto do shell de gestão, em vez de uma lista esticada
ao lado de um botão preso em 430px.

**Critério de aceite verificável**: nenhum elemento da tela (lista de cards
nem botões de ação) ultrapassa a largura escolhida no critério 2 abaixo; os
dois `max-w-[430px]` isolados deixam de existir no arquivo.

## Escopo e Critérios de Aceite

✅ **Entregue em 2026-09-23, 6/6 critérios (Gate 4 PASS).** Detalhe:
`docs/backlog/66-2026-09-23-contai-051-entregue.md`.

1. [x] **`/obras` segue a família "lista/escolha de nível superior da sidebar"
   (`/despesas`, `/pendencias`), não a família "detalhe de um registro"
   (`/obras/[id]`, `/documento/[id]`).** `ColunaDeDetalhe`/`CabecalhoDaTela`
   (`app/_components/detalhe.tsx`, do spec `detalhe-no-shell-v1.md`) são
   para telas cujo título é DADO carregado (nome do documento, da obra
   aberta) e que têm UMA ação de página — não é o caso aqui: `/obras` é a
   tela que se visita **antes** de haver uma obra aberta para detalhar, e o
   título já vem da rota via `tituloDaView` (nenhuma tela desta família
   chama `CabecalhoDaTela`). Não aplicar esses dois componentes a esta
   página.
2. [x] **Dar um teto de largura sensato à `ListaDeEscolha`** — não precisa ser
   full-width (a lista de botões simples, sem coluna alguma de dado extra,
   fica esparsa e ilegível esticada por 900px+, o mesmo defeito medido no
   Gate 2 do `039`), nem 430px. Ponto de partida para o Gate 1 (a decidir
   com o `cto-obra`, sem bloquear em novo Gate 0 — ver seção Dependências):
   um envoltório único ao redor da lista e dos botões de ação com
   `max-w-[640px]` — a mesma **medida** que `ColunaDeDetalhe` já usa como
   "coluna de leitura confortável" (reaproveitar o número, não o
   componente semântico de detalhe).
3. [x] **Remover os dois `max-w-[430px]` soltos** — "Cadastrar a primeira obra"
   (estado vazio, linha ~95 de `obras/page.tsx`) e "+ Nova obra" (estado
   populado, linha ~144) — e trazê-los para dentro do mesmo envoltório do
   critério 2, para pararem de ficar estranhamente estreitos ao lado da
   lista.
4. [x] **Zero mudança de lógica, campo, texto fiscal ou comportamento.** O
   `Banner` ("Escolha a obra..."), a `Dica` (sem valor em dinheiro,
   critério 14 do `CONTAI-003`), o texto do estado vazio e do estado de
   primeiro acesso continuam **idênticos**. Prova de aceite: comparação
   byte a byte, mesma disciplina do critério 3 do `CONTAI-046`.
5. [x] **`375px` deixa de ser piso obrigatório** para a decisão de largura desta
   tela (mesma permissão já dada aos `043`-`047`) — mas continua não
   podendo quebrar objetivamente no celular; só deixa de travar a decisão
   de desktop.
6. [x] Nenhuma mudança em `ListaDeEscolha` além do que o teto de largura do
   envoltório já resolve — não adicionar `max-width` interno ao componente
   em si, porque ele também é usado dentro de `TelaTrocarObra`
   (`app/_components/obra.tsx`, escape de captura em `(captura)`, dentro da
   coluna de formulário de 430/720px) — mudar o componente por dentro
   vazaria a decisão de largura do shell para a casca de captura.

## Fora de Escopo
- `app/_components/obra.tsx` (`ListaDeEscolha` em si) — só o envoltório em
  `obras/page.tsx` muda, nunca o componente (ver critério 6).
- `/obras/nova` (assistente de cadastro) — vive em `app/(captura)/`,
  exclusão já registrada e justificada no `CONTAI-046` ("é captura pontual,
  não gestão recorrente"); esta rodada não reabre essa decisão.
- Adicionar valor em dinheiro à lista de escolha — o critério 14 do
  `CONTAI-003` (sem soma entre matrículas/CNOs na mesma tela) continua
  valendo e não é tocado por este ticket.
- Qualquer mudança em `app/_components/shell.tsx` ou no link "Trocar obra"
  da sidebar.

## Gate Fiscal (Contador)
**Não se aplica.** Reflow puro, nenhum texto fiscal, nenhum campo, nenhuma
regra tocada — mesma classificação dos `043`-`046` (Gate Fiscal fechado,
automático).

## Pre-mortem
1. **Aplicar `ColunaDeDetalhe`/`CabecalhoDaTela` por reflexo, só porque é o
   padrão mais recente e mais documentado** — seria o erro simétrico ao que
   motivou este ticket: encaixar uma tela de lista na moldura de detalhe
   porque "é o que todo mundo está usando agora", sem checar que a família
   certa é a de `/despesas`/`/pendencias`. O critério 1 existe para isso.
2. **Mudar `max-width` dentro de `ListaDeEscolha`** em vez de num
   envoltório em `obras/page.tsx` — vazaria para `TelaTrocarObra` (usada
   dentro do formulário de captura, coluna estreita) e quebraria a
   composição lá. Ver critério 6.
3. **Reescrever o texto do Banner/Dica "para ficar mais bonito ao lado do
   novo layout"** — zero tolerância; é o mesmo risco que o `CONTAI-046`
   nomeou para `discriminacao/[ano]`, aqui em escala menor mas com a mesma
   disciplina de prova byte a byte.

## Dependências
**Gate 0 fechado por reaproveitamento — não precisa do `designer`.** Este é
um reflow menor e mais simples que os quatro tickets `043`-`046`: não há
campo novo, não há decisão de qual componente de detalhe usar (decidido no
critério 1: nenhum), e a única variável de desenho — a largura do
envoltório — já tem um número de partida justificado (640px, criticado
acima) para o `lead-engineer` resolver com o `cto-obra` no próprio Gate 1,
igual a como o `cto-obra` já resolve ajustes de medida sem novo mock em
tickets desta família (ex.: `640px` vs `~560px` no spec original do
`detalhe-no-shell-v1.md`). Não bloqueia nem é bloqueado por nenhum ticket
em aberto.

## Cenário e checagem final
**Gestão** — em casa, sentado, trocando de obra ou revisando qual obra abrir.
O "Teste do Canteiro" não se aplica (mesma doutrina dos `043`-`047`).
