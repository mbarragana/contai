# CONTAI-039 Home ganha layout desktop — régua fixa de posição fiscal + fila de trabalho em grid

## Tipo e Prioridade
feature — **P1, fricção de processo** — não há obrigação fiscal nem multa em
jogo (é reposicionamento visual de dado já calculado), mas a tela que mais se
usa no **cenário principal do produto** (gestão, em casa, sentado) hoje trava
em 430px de largura mesmo num monitor de notebook, obrigando rolagem contínua
para relacionar a posição fiscal (custo confirmado/em risco/INSS) com a fila
de pendências que justifica revisar. É a régua de cenário do `CLAUDE.md`
aplicada à tela mais visitada do app, não convenção estética.

## Dor de Origem
`CLAUDE.md`, correção de 2026-08-18 (tabela de cenários), palavras do Mateus
já registradas ali:

> *"eu vou usar mais em casa do que no canteiro… **quem gerencia a obra, não
> gerencia do canteiro**"*

A dor concreta desta tela — a home renderiza como se todo uso fosse celular,
mesmo quando o Mateus está sentado num monitor largo revisando a posição
fiscal antes de agir — não tinha ainda entrada própria no diário: fechada
nesta rodada entre `designer`, `cto-obra` e `po`, registrada em
`docs/backlog/43-2026-09-21-convergencia-home-desktop.md` (Conceito 2, "Régua
fixa + fila de trabalho", escolhido sobre alternativas com abas ou colunas
independentes — ver Pre-mortem e Out of Scope para os cortes).

## User Story
Como dono da obra revisando a posição fiscal **em casa, sentado, com calma**
— o cenário principal do produto — quero ver a régua de custo
confirmado/em risco/INSS fixa na tela enquanto percorro a fila de
pendências e despesas, para relacionar os dois sem perder de vista o número
que a fila está corrigindo, num monitor que sobra largura para isso. No
celular, a tela continua exatamente como hoje — o piso de 375px não muda.

## Critérios de Aceite

**✅ Entregue em 2026-09-21, 12/12 critérios** (Gate 2 com 1 rodada de
REQUEST CHANGES do `cto-obra` — o aside sticky escondia `CardAfericaoInss`
quando a régua era mais alta que a viewport, e o `lg:max-w`/`BarraAdicionar`
viraram opt-in por página em vez de globais, eliminando o efeito colateral
nas outras 43 telas sem precisar de dívida nova). 839 unitários + 242 E2E
(240 mobile + 2 desktop) + validação manual no browser em 1280px. Gate 4
(`po`) PASS. Sem migration. Ver nota no Out of Scope sobre o fallback de
scroll, que deixou de ser hipotético.

**`app/layout.tsx`**
1. A casca (`<div className="mx-auto flex h-dvh w-full max-w-[430px] ...">`)
   ganha `lg:max-w-[1120px]` (ou o valor equivalente que o `/design` fixar).
   Abaixo de `lg`, nenhuma classe nova se aplica — o DOM e o comportamento
   são idênticos, bit a bit, ao de antes deste ticket.

**`app/_components/ui.tsx`**
2. `Card`, `Chip`, `Consequencia`, `Dica`, `BotaoLink` e `Passo` não mudam de
   assinatura nem de comportamento visual em nenhuma largura — nenhum dos
   seis ganha prop nova ou classe alterada por este ticket.
3. `Corpo` ganha `className?: string` opcional. O valor default preserva
   exatamente a classe atual (`"flex flex-1 flex-col gap-3 overflow-y-auto
   px-[18px] py-4"`) para toda tela que chama `<Corpo>` sem o prop novo — 43
   arquivos hoje (`grep -rl "<Corpo" app --include="*.tsx" | wc -l`), nenhum
   deles muda de pixel.
4. Componente novo `Secao`: recebe um ou mais blocos "`Passo` + card(s)" como
   filhos e os organiza em grid de 2 colunas só a partir de `lg`
   (`lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start`, ou equivalente que o
   `/design` fixar); abaixo de `lg`, os filhos empilham exatamente como
   empilham hoje — sem `grid`, sem `display` alternativo, sem mudança de
   ordem no DOM.

**`app/page.tsx`**
5. Os quatro blocos de posição fiscal — `AfirmacaoObra`, o `Card` "Custo
   confirmado em {ano} · {obra}", `CardCustoEmRisco`, `CardAfericaoInss` —
   movem para dentro de um `<aside>` com `lg:sticky lg:top-0 lg:self-start`,
   preservando a ordem relativa entre os quatro. Abaixo de `lg`, o `<aside>`
   não tem `position` nem largura própria — renderiza empilhado no topo do
   `Corpo`, como hoje.
6. O restante do conteúdo (notas hábeis sem pagamento, despesas comprovadas,
   correções a tratar, pendências, vínculo entre obras, terreno pago sem
   comprovante, documentos — pendências, terreno sem data, terreno com duas
   datas, financiamento sem informe, financiamento do ano, `BlocoAgendados`,
   os dois `Dica` finais) mantém a **mesma ordem vertical de hoje** e passa a
   ser filho de `Secao`. Nenhum item recebe `order` CSS nem qualquer outra
   propriedade que desalinhe a ordem visual da ordem do DOM — "mesma ordem
   fiscal" quer dizer ordem visual, não só presença no markup.
7. Nenhum texto de `Consequencia`, `Dica`, `Chip` ou de qualquer pendência
   muda de conteúdo — a mudança é só de posição/layout.
8. Nenhum atributo `data-*` usado hoje muda de nome, de valor, ou some —
   confirmado por `data-pendencia`, `data-falta-lancar`, `data-custo-em-
   risco`, `data-afericao-inss`, `data-agendado`, `data-bloco`, `data-marca`
   e `data-pergunta` (lista não exaustiva; `grep -rn "data-[a-z-]*="
   app/page.tsx app/_components/{custo-em-risco,documento-sem-arquivo,
   agendado,pago-sem-comprovante,datas-do-desembolso}.tsx` antes e depois do
   diff devolve o mesmo conjunto de pares atributo/expressão). O DOM que
   carrega esses atributos é o mesmo, só reposicionado por CSS.
9. Nenhuma `Consequencia` fica truncada, cortada por `overflow: hidden`, nem
   escondida atrás de interação nova (aba, accordion, tooltip) em nenhuma
   largura — ligação direta com **D46/D47** (pendência não pode perder
   superfície).

**`BarraAdicionar`**
10. Em `lg`+, `BarraAdicionar` (rodapé fixo com "+ Adicionar") recebe um
    ajuste próprio de largura/alinhamento em vez de esticar para os 1120px
    da casca — o valor exato (alinhado à coluna direita, ou `lg:max-w-`
    próprio) é decidido e descrito por escrito no `/design` (ver Perguntas
    Abertas). Abaixo de `lg`, comportamento idêntico ao de hoje.

**Testes**
11. Novo projeto Playwright `desktop` em `playwright.config.ts` (viewport
    ~1280×800, sem `devices["iPhone SE"]`), rodando **ao lado** do projeto
    mobile existente — sem alterar `workers: 1`, `fullyParallel: false` nem
    o `globalSetup` (mesmo banco, mesmo seed). UM smoke test novo confirma,
    na home: (a) o `<aside>` está presente e com `position: sticky`
    computado; (b) os quatro blocos de posição fiscal (critério 5) estão
    dentro dele, nomeados um a um — não só "aside existe"; (c) o grid de 2
    colunas da `Secao` está ativo (dois filhos diretos em linhas/colunas
    diferentes, por `boundingBox`); (d) nenhum texto de `Consequencia`
    presente no cenário do seed tem `scrollWidth > clientWidth` (cortado).
    Este teste **não duplica** a suíte mobile inteira.
12. A suíte mobile existente (`iPhone SE`) roda sem nenhuma alteração de
    asserção e continua verde — prova de que abaixo de `lg` nada mudou.

## Out of Scope
- Telas de gestão além da home (`/documento/[id]`, `/pagamento/[id]`,
  correção, detalhe de obra etc.) — ficam para rodada futura, reusando o
  padrão `aside` + `Secao` se este ticket for bem-sucedido.
- Abas por tipo de pendência — cortado pelo `cto-obra` nesta convergência:
  esconderia pendência atrás de clique, o oposto do que a régua fixa busca.
- ~~Scroll independente de qualquer coluna como **requisito**~~ — **corrigido
  no Gate 2**: o cenário "régua mais alta que a viewport" não era hipótese
  futura, acontecia no cenário mínimo do seed (aside de 1111px contra
  viewport útil de 654px), escondendo `CardAfericaoInss` — pendência
  perdendo superfície (D46/D47). Implementado como `lg:max-h-full
  lg:overflow-y-auto` no `<aside>` (referência ao `main`, não `100dvh`),
  com o smoke test do critério 11 estendido para provar que o card fica
  alcançável.
- Qualquer mudança em regra de cálculo, cor de gravidade, texto de
  consequência ou ordem fiscal dos blocos — reposicionamento visual apenas.
- O piso de 375px, o `viewport` do `layout.tsx`, ou qualquer tela de captura
  (`/adicionar/*`) — o "Teste do Canteiro" não se aplica a este ticket e
  essas telas não mudam.
- O valor exato de `lg:max-w-` da `BarraAdicionar` e o particionamento exato
  dos blocos "`Passo` + cards" em células do grid da `Secao` (ex.: uma lista
  longa como "Despesas comprovadas" vira uma célula alta, ou os itens da
  lista viram células próprias?) — não decidido aqui, decidido no `/design`
  (ver Perguntas Abertas).

## Gate Fiscal (Contador) — FECHADO
**Sem regra fiscal nova — reposicionamento visual de dado já calculado e já
adjudicado.** Nenhum fato fiscal nasce, nenhum custo é recalculado, nenhuma
pendência muda de condição de abertura/fechamento ou de gravidade. É a mesma
composição de tela que já está em produção, só disposta em duas colunas a
partir de `lg`.

O único ponto com peso fiscal é de **superfície, não de regra** (critério 9):
nenhuma `Consequencia` pode perder legibilidade — mesma exigência que já
vale hoje, aplicada a um layout novo. Automático, sem exigência de revisão
humana (CRC) — não há texto novo para o `contador` carimbar.

## Pre-mortem
1. **CSS Grid reordena visualmente sem mexer no DOM.** Se a implementação
   usar `order` ou `grid-auto-flow: dense` para "equilibrar" as duas colunas
   visualmente, a "mesma ordem fiscal" do critério 6 vira mentira visual
   mesmo com o DOM correto — quem lê a tela vê uma sequência que não é a que
   o código declara. Guarda: critério 6 proíbe `order` explicitamente, e o
   smoke test do critério 11 verifica posição por `boundingBox`, não só
   presença.
2. **`Corpo` com `className?` vira porta para densificar tela de captura.**
   O prop nasce para a home (gestão), mas nada no TypeScript impede alguém
   de usá-lo depois em `/adicionar/*` achando que "agora cabe mais campo".
   Guarda: nenhuma; é doutrina, não trava de código — a régua de cenário do
   `CLAUDE.md` continua sendo o que decide, e revisão de PR é quem aplica.
3. **`BarraAdicionar` e a casca dessincronizam no futuro.** Se o `lg:max-w-`
   da barra for um número mágico independente do `lg:max-w-[1120px]` da
   casca, o dia em que alguém mudar um sem lembrar do outro produz um rodapé
   maior ou menor que a área de conteúdo. Guarda: recomendação ao `/design`
   e ao `lead-engineer` — derivar os dois do mesmo token/constante, não
   duplicar o número.
4. **Smoke test verde por presença, não por composição.** Um teste que só
   confere "existe `<aside>`" passaria mesmo se `CardAfericaoInss` sumisse
   do agrupamento por engano de refactor. Guarda: critério 11(b) nomeia os
   quatro blocos individualmente.

## Viabilidade (CTO)
Especificação técnica já fechada nesta convergência (`designer` + `cto-obra`
+ `po`); a Viabilidade abaixo é transcrição operacional dela — não é decisão
nova deste ticket.

**Arquivos a tocar**: `app/layout.tsx`, `app/_components/ui.tsx`,
`app/page.tsx`, `playwright.config.ts`, um spec E2E novo (nome sugerido:
`e2e/home-desktop.spec.ts`). Nenhuma migration, nenhum arquivo em `lib/`.

**Sem mudança de modelo de dados nem de `lib/fiscal/*`** — `resumo.ts`,
`gravidade.ts`, `vinculo.ts` etc. continuam produzindo exatamente o que
produzem hoje; o ticket consome o mesmo `PainelDados`/`ResumoObra` já
carregado por `carregarPainel`.

**Complexidade: M.** Não é XS porque toca um componente compartilhado
(`ui.tsx`, usado por 43 telas) e a config do Playwright (infraestrutura de
teste, não só produto); não é L porque não há schema, não há RPC, não há
tela nova — é reflow de uma tela existente mais um componente e uma config
novos, ambos pequenos.

**Dívidas que este ticket não paga, e por quê**: a divergência entre
`alocado.pagamentos` e `pagamentosVinculados` (dívida pré-existente, citada
no `CONTAI-037`) não é tocada — este ticket não muda dado, só layout.

## Dependências
- Bloqueado por: nenhum ticket — a fila de implementação está vazia em
  2026-09-21 (`docs/tickets/README.md`).
- Bloqueado por (2): **rodar `/design`** — **RESOLVIDO em 2026-09-21.** A
  descrição escrita está em `design/mocks/CONTAI-039.md` (padrão vigente
  desde 2026-09-20: sem HTML, sem gate de aprovação), com as 3 Perguntas
  Abertas respondidas — ver seção abaixo. Nada mais bloqueia o Gate 1.
- Bloqueia: a extensão do mesmo padrão (`aside` + `Secao`) às telas de
  detalhe de documento/pagamento — mencionada como possível rodada seguinte
  nesta convergência, sem ticket próprio ainda.

## Perguntas Abertas — RESPONDIDAS por `design/mocks/CONTAI-039.md`

1. `lg:max-w-[1120px]` foi o valor de referência desta convergência — o
   `/design` confirma esse número ou ajusta com base na largura real do
   notebook/monitor que o Mateus usa em casa?
   **Resposta: ajustado para `lg:max-w-[1280px]`.** Critério: cada coluna
   da `Secao` não pode ficar mais estreita que o card mobile de hoje
   (394px). Com 1120px cada coluna cairia a ~332px (mais estreita que o
   mobile); com 1280px (`aside 400px` + `gap-8` + `Secao 812px`, 2 colunas
   de ~398px) a largura do card fica praticamente igual à de hoje.

2. Particionamento exato dos blocos "`Passo` + cards" em células do grid da
   `Secao`: cada `Passo` (ex.: "Despesas comprovadas", que pode ter N cards)
   vira uma célula única, potencialmente alta e desbalanceando as duas
   colunas, ou os itens de uma lista longa podem virar células próprias? O
   `/design` precisa fixar isso por escrito, bloco a bloco.
   **Resposta: regra mecânica, uma `<Secao>` só.** `Passo` e tudo que não é
   `Card` (`Banner`, `BlocoAgendados`, os `Dica` de rodapé) viram
   `lg:col-span-2` (quebra de linha); cada `Card` — inclusive cada item de
   uma lista `.map()` — vira célula própria (span 1), sem `order`, grid
   `auto-flow: row` padrão.

3. Alinhamento da `BarraAdicionar` em `lg`+: acompanhar a largura da coluna
   direita (a que tem a `Secao`) ou ter `lg:max-w-` independente das duas
   colunas? Decisão do `/design`.
   **Resposta: acompanha a coluna direita (`Secao`, 812px).** "+Adicionar"
   pertence à fila de trabalho, não à régua de leitura do `aside`. O
   `Rodape` vira `lg:flex lg:flex-row lg:gap-8` com um spacer invisível
   `lg:w-[400px]` (mesma largura do `aside`, comentário cruzado entre os
   dois arquivos) e o botão em `lg:flex-1`.

**Ticket pronto para `/develop`** — as 3 dependências de design que
bloqueavam o Gate 1 estão fechadas; ver spec completo, wireframe ASCII e
justificativa de cada número em `design/mocks/CONTAI-039.md`.

## Cenário e checagem final
**Gestão** — em casa, sentado, tela larga, revisando a posição fiscal com
calma antes de agir. O "Teste do Canteiro" não se aplica: nenhuma tela de
captura (`/adicionar/*`) muda neste ticket, e o piso de 375px permanece
intocado — provado pela suíte mobile existente continuando 100% verde
(critério 12).

**Veredito: APROVADO, com 1 dependência que bloqueia o Gate 1** — não é
falha de requisito: rodar `/design` para produzir a descrição escrita que
fixa os três pontos das Perguntas Abertas (valor de `lg:max-w`,
particionamento do grid da `Secao`, alinhamento da `BarraAdicionar`). Gate
Fiscal fechado e automático; Viabilidade técnica fechada nesta convergência.
