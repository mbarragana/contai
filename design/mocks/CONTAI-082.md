# CONTAI-082 — filtro de urgência + busca por favorecido na Agenda

Cenário: gestão (tela `/compromisso`, dentro de `ColunaDeDetalhe`, 640px).

Delta sobre a tela existente (`app/(gestao)/compromisso/page.tsx` +
`app/_components/agendado.tsx`) — o resto do comportamento (BlocoAgendados,
CartaoVencido, LinhaAberta, banner verde) não muda.

## Telas e estados

- **Sem obra aberta** — inalterado (banner âmbar "Nenhuma obra aberta...").
- **Genuinamente vazia** (nenhum compromisso `aberto` na obra, sem filtro
  aplicado) — inalterado: banner **verde**, `role="status"`, sem barra de
  filtro nenhuma acima dele (mesma regra do `semRegistro` em `/despesas`: não
  mostra controle de filtro quando não há o que filtrar).
- **Com agendamentos** — nova `BarraDeFiltros` aparece **acima** do
  `BlocoAgendados`, sempre que a agenda não for genuinamente vazia (mesmo
  que o filtro atual esconda tudo). Ordem vertical, de cima para baixo:
  1. `BarraDeFiltros` (select + input + contagem)
  2. banner âmbar de **vazio-por-filtro** (só quando o filtro zera a lista) OU
     `BlocoAgendados` normalmente
  3. `Dica` de rodapé ("Nenhum destes valores entra em soma nenhuma...") —
     inalterada, sempre por último

### Layout da barra (ASCII, coluna de 640px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Urgência ▾]     [Buscar favorecido..............]   4 de 7 agendamentos │
└──────────────────────────────────────────────────────────────────────┘
```

- `<div data-filtros="agenda" class="flex flex-wrap items-center gap-2.5">`
  — mesma classe de wrap de `BarraDeFiltros` de `/despesas`, não generalizada
  (componente próprio, conforme cto-obra).
- `<select aria-label="Urgência">`, largura natural (`min-w-[150px]`),
  mesma classe `CAMPO` de `/despesas` (44px alto em mobile / 16px fonte pra
  não dar zoom no Safari; 36px/13px em `lg:`).
- `<input aria-label="Buscar favorecido" placeholder="Buscar favorecido…">`,
  `w-[200px]`, mesma classe `CAMPO`.
- Contagem: `<span data-contagem="agenda">`, `text-[12px] text-mut`, com
  `lg:ml-auto` (empurra pra direita quando cabe na mesma linha).
- **Piso 375px**: os três itens ficam em `flex-wrap` — não cabem numa linha
  só em tela estreita, então quebram em até 3 linhas (select / input /
  contagem), cada um com sua largura natural — mesmo comportamento que
  `/despesas` já tem hoje, não é regressão nova.

### Empilhamento em 375px (ASCII)

```
[Urgência ▾            ]
[Buscar favorecido.....]
4 de 7 agendamentos
```

## Campos

- `filtroUrgencia` "Urgência" — select — opcional — **DEFAULT DECLARADO: o
  padrão é `"todos"`, que NÃO filtra nada.** Não é campo fiscal: não afirma
  fato nenhum sobre a obra, só recorta o que a tela mostra — e o único default
  aceitável é o que mostra tudo, porque qualquer outro esconderia um vencido na
  chegada. Valores/rótulos na ORDEM abaixo (severidade decrescente, decisão do
  `po`):
  | valor          | rótulo        |
  |----------------|---------------|
  | `todos`        | Todos         |
  | `vencido`      | Vencidos      |
  | `vence_hoje`   | Vence hoje    |
  | `vence_amanha` | Vence amanhã  |
  | `comum`        | Agendados     |
- `buscaFavorecido` "Buscar favorecido" — texto livre — opcional — **DEFAULT
  DECLARADO: o padrão é `""`, a busca vazia, que não filtra nada** (mesma razão
  do campo acima). Substring, case-insensitive, contra
  `compromisso.favorecidoNome`. Compromisso sem favorecido (`null`) só aparece
  quando a busca está vazia — não é decisão fiscal, é comportamento de busca de
  texto comum.
- NÃO É CONTROLE — os dois vivem em `useState` local da tela, **nunca
  persistidos** (decisão já fechada pelo cto-obra): toda chegada em
  `/compromisso` reseta para `{ filtroUrgencia: "todos", buscaFavorecido: "" }`.

## Contagem "N de M agendamentos"

- Onde: dentro da `BarraDeFiltros`, à direita (mobile: última linha,
  alinhada à esquerda por efeito do wrap — sem `ml-auto` forçado quando
  quebra).
- `M` = total de compromissos `aberto` na obra, **sem filtro nenhum**
  (vencidos + abertos, sem teto — mesma base que `/compromisso` já usa com
  `Infinity`). `N` = mesma soma depois do filtro.
- Formato, espelhando o padrão já em produção em `/despesas`
  (`visiveis === total`):
  - `N === M` → **`"M agendamentos"`** (singular quando `M === 1`:
    `"1 agendamento"`) — **omite o "de M"**, não escreve "M de M".
  - `N !== M` → **`"N de M agendamentos"`** — plural fixo em "agendamentos"
    mesmo quando `N === 1` (`"1 de 7 agendamentos"`), igual à convenção já
    usada para lançamentos em `/despesas`.

## Textos com consequência fiscal

Nenhum texto fiscal novo. Reaproveita, sem reescrever:
- Banner verde "Nenhum agendamento em aberto. Tudo que estava marcado já foi
  respondido." — inalterado, de `app/(gestao)/compromisso/page.tsx`.
- `CABECALHO_BLOCO_AGENDADOS` e `VENCIDO_SEM_RESPOSTA` dentro de
  `BlocoAgendados` — inalterados.

## Texto do vazio-por-filtro (novo, âmbar, `role="status"`)

Distinto do banner verde — este afirma que **existe** agendamento, só não
aparece por causa do filtro:

> **Nenhum agendamento com estes filtros.** Há {M} {M===1 ? "agendamento" :
> "agendamentos"} em aberto — o filtro é que está escondendo.
> [Mostrar todos]

- Botão `Botao variante="ghost"`, texto **"Mostrar todos"** (mesmo rótulo e
  variante de `/despesas`), `onClick` reseta os dois campos ao padrão
  (`{ filtroUrgencia: "todos", buscaFavorecido: "" }`).
- Renderiza só quando: agenda **completa** não é vazia (`M > 0`) **e** agenda
  **filtrada** é vazia (`N === 0`).

## Navegação

Nenhuma nova. A barra vive só dentro de `/compromisso`.

## Confirmação — item 4 do pedido

O `Passo` dentro de `BlocoAgendados` ("Agendados · {agenda.contagem}", ex.:
"2 ainda não pagos, 2 já venceram") continua recebendo a **agenda já
filtrada** — `montarAgendaDaHome` é chamada com o resultado de
`filtrarAgenda`, então essa contagem por natureza descreve o subconjunto
visível, não o total da obra. Isso é aceitável e **não muda**: a barra acima
já expõe "N de M agendamentos" para quem quiser o total; duplicar o total
dentro do `Passo` misturaria as duas contagens (subconjunto vs. universo) no
mesmo rótulo.

## Decisões de design e perguntas abertas

- Ordem do select segue severidade decrescente (Vencidos → Vence hoje →
  Vence amanhã → Agendados), não a ordem alfabética/interna de
  `UrgenciaDoAgendamento` — é o que o `po` já fechou nos rótulos.
- Nenhuma pergunta aberta: campos, ordenação, agrupamento e persistência já
  vieram fechados do `po`/`cto-obra`; este spec só resolve layout e texto.
