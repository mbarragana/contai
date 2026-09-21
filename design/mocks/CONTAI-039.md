# CONTAI-039 — Home ganha layout desktop (régua fixa + fila de trabalho)

## Cenário
**Gestão** — em casa, sentado, monitor largo, revisando a posição fiscal com
calma antes de agir (`CLAUDE.md`, correção 2026-08-18). O "Teste do
Canteiro" não se aplica: nenhuma tela de captura muda, o piso de 375px
continua intocado abaixo de `lg` (idêntico bit a bit ao de hoje).

## Telas e estados
Uma tela só (`app/page.tsx`), dois estados de layout por breakpoint `lg`
(1024px, padrão Tailwind, não redefinido aqui):

- **< lg**: exatamente o app de hoje. `Corpo` empilha em coluna única,
  `<aside>` sem `position`/largura própria, `Secao` sem `grid`. Os três
  estados de `Estado` (carregando/erro/pronto) não mudam.
- **≥ lg**: `Corpo` vira `flex-row`; aside sticky com a régua fiscal à
  esquerda, `Secao` com a fila de trabalho em grid 2 colunas à direita.
  Carregando/erro seguem ocupando `Corpo` inteiro (split faria pouco
  sentido com aside vazio).

## Campos
- SEM CAMPOS — reposicionamento visual, nenhum campo novo, nenhum dado novo
  capturado ou exibido.

## Textos com consequência fiscal
**Nenhum muda.** Todo texto de `Consequencia`, `Dica`, `Chip`, `Banner` e
pendência mantém exatamente o conteúdo de hoje (critério 7 do ticket) — não
houve necessidade de consultar o `contador`, porque não há texto novo nem
texto reescrito, só reposicionado.

## Navegação
Não aplicável — nenhuma rota nova, nenhum link muda de destino.

## Decisões de design (respondem as 3 Perguntas Abertas do ticket)

### 1 — `lg:max-w` da casca: **`1280px`** (ajusta a referência de 1120px)
Critério: a largura de cada card na fila de trabalho não deve encolher em
relação ao que já é testado e tunado hoje (394px de conteúdo — 430px menos
18px de padding por lado). Orçamento em `lg`: `1280 − 36 (padding)` = 1244
→ `aside 400px` + `gap-8 (32px)` + `Secao 812px` → cada coluna da `Secao`:
`(812 − 16 [gap-4]) / 2 ≈ 398px` — praticamente a mesma largura de hoje, só
que duas lado a lado, sem retunar tipografia. Com 1120px cada coluna cairia
a ~332px, mais estreita que o mobile — o oposto do que "sobra de largura"
pede. `aside`: `lg:w-[400px] lg:flex-none`; gap aside↔conteúdo: `lg:gap-8`.

### 2 — Particionamento do grid da `Secao`: regra mecânica, sem exceção por bloco
Uma única `<Secao>` envolve tudo da lista (de `AvisoEquiparacao` até o
último `Dica` de rodapé), como filhos diretos em ordem de DOM — sem
`Secao` por grupo. Dentro dela, cada filho recebe span pela **própria
natureza do elemento**, nunca por decisão caso a caso:
- **`Passo`** (rótulo de seção) → `lg:col-span-2` — funciona como quebra de
  linha, nunca fica sozinho ao lado de um card.
- **`Card`** (inclusive cada item de uma lista `.map()`, inclusive o card
  "headline" de um bloco, inclusive os que já vêm prontos de outro
  componente — `CardPagoSemComprovante`, `CardDocumentosSemArquivo`) →
  **span 1 (padrão, sem classe)** — cada card é a própria célula. Uma lista
  longa (ex.: "Despesas comprovadas" com N cards) preenche as duas colunas
  linha a linha, em vez de virar uma célula única alta e desbalancear as
  colunas — é a resposta direta ao risco que a Pergunta 2 levantava.
- **Tudo que não é `Card`** — `Banner` (inclusive "Nenhuma pendência"),
  `BlocoAgendados` (já atômico, com Passo + lista própria por dentro — não
  se decompõe pela grade do pai) e os dois `Dica` de rodapé (navegação para
  Obra/Terreno/Conta) → `lg:col-span-2`.
`grid-auto-flow` fica no padrão (`row`, não `dense`): preserva a ordem do
DOM sem preencher buracos fora de ordem — é o que a proibição de `order`
do critério 6 exige na prática.

### 3 — Alinhamento da `BarraAdicionar` em `lg`+: acompanha a coluna direita (`Secao`)
"+ Adicionar" cria pendência nova — pertence à fila de trabalho (coluna
direita), não à régua de posição fiscal (aside, só leitura). Em `lg`, o
`Rodape` vira `lg:flex lg:flex-row lg:gap-8` com um spacer invisível
`lg:w-[400px] lg:flex-none` (mesma largura do `aside`) à esquerda e o botão
em `lg:flex-1` à direita — fica exatamente sob a `Secao` (812px), não
esticado até os 1280px da casca. O spacer usa a **mesma string de classe**
`lg:w-[400px]` do `aside`, com comentário cruzado nos dois arquivos — Tailwind
exige string literal, então "mesma constante" aqui é "mesma grafia, comentário
de sincronia", não variável JS compartilhada (Pre-mortem 3 do ticket).

## Wireframe ASCII — `app/page.tsx` em `lg`+

```
┌─ casca lg:max-w-[1280px], mx-auto ────────────────────────────────┐
│ AppBar ("contai" · obra · CNO · ano)                               │
├─ Corpo (lg:flex lg:flex-row lg:gap-8) ─────────────────────────────┤
│ aside 400px sticky          │ Secao 812px, grid-cols-2 gap-4       │
│  AfirmacaoObra              │ Passo ────────────────── (col-2)     │
│  Card "Custo confirmado…"   │ AvisoEquiparacao/PendenciaCno (2)    │
│  CardCustoEmRisco           │ Passo "Notas s/pagto"(2)+headline+N  │
│  CardAfericaoInss           │  Card │ Card │ Card │ Card (1 cada)  │
│                              │ Passo "Despesas comprovadas" (2)+N  │
│                              │ Passo "Pendências" (2) + Banner(2)? │
│                              │  Card │ Card ... ordem de hoje ...  │
│                              │ BlocoAgendados (2, bloco atômico)   │
│                              │ Dica "Obra/Terreno" (2) · "Conta"(2)│
├──────────────────────────────┴──────────────────────────────────────┤
│ Rodape: [spacer 400px] [BarraAdicionar "+Adicionar" 812px, sob Secao]│
└───────────────────────────────────────────────────────────────────────┘
```
