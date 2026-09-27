# CONTAI-063 Filtro "Sem pagamento ligado" no dropdown de Situação (`/despesas`)

## Tipo e Prioridade
feature — P1 — fricção de processo confirmada pelo `po`: hoje não há como
isolar a situação "Sem pagamento ligado" sem recorrer a um atalho de busca por
texto. Sem impacto fiscal (filtro de leitura/apresentação de tabela já
calculada).

## Dor de Origem
Relato de 2026-09-26 (`docs/backlog/76-2026-09-26-filtro-sem-pagamento-despesas.md`):
Mateus estava em `/despesas`, precisou digitar "casa" no campo de busca de
texto só para conseguir isolar as 4 notas com situação "Sem pagamento ligado",
porque o dropdown de Situação hoje só oferece `Todas as situações` /
`Comprovadas` / `Pendência` — nenhuma opção isola esse estado neutro
(`CHIP_SEM_PAGAMENTO`, `lib/fiscal/despesas.ts:119`). Nas palavras dele:
*"aqui deveria ter um filtro: 'sem pagamento'"*.

Não é bug de cálculo nem de classificação — a situação já existe e já é
exibida corretamente linha a linha; falta só a opção de filtro dedicada.

## User Story
Como Mateus, em casa e sentado, revisando `/despesas` para decidir quais notas
já validadas ainda precisam de pagamento agendado ou registrado, quero
selecionar, no dropdown de Situação já existente, uma quarta opção que isola
as linhas "Sem pagamento ligado" — sem precisar digitar nada na busca — para
achar essas notas em lote mais rápido.

## Critérios de Aceite
1. [x] Proposta nível 2 em `design/mocks/CONTAI-063.md` — rótulo, posição e
   comportamento da nova opção já fechados nela (não precisa de novo Gate 0).
2. [x] O dropdown de Situação em `/despesas` ganha uma quarta opção, com o
   rótulo exato **"Sem pagamento ligado"**, posicionada **no fim da lista**
   (depois de "Só com pendência"), sem alterar rótulo, posição relativa ou
   comportamento das três opções existentes ("Todas as situações", "Só
   comprovadas", "Só com pendência").
3. [x] Com a nova opção selecionada, toda linha visível na tabela carrega o
   chip `CHIP_SEM_PAGAMENTO` ("Sem pagamento ligado") e nenhuma outra situação
   aparece — reproduz, só com o filtro de Situação (sem digitar texto de
   busca), o mesmo resultado que hoje só se obtém filtrando por "casa" na
   busca (o cenário exato do relato de origem).
4. [x] A nova opção compõe em E lógico com Tipo e Busca exatamente como as
   opções existentes compõem hoje em `casaSituacao`/`filtrarLinhas` — mesma
   regra de composição, sem exceção especial. Quando o `CONTAI-060` (filtro de
   ano) estiver em produção, compõe também com Ano pela mesma regra.
5. [x] A contagem da barra ("N de M lançamentos...") reflete corretamente o
   total filtrado com a nova opção ativa, no mesmo padrão hoje usado por
   "Comprovadas"/"Pendência" — sem texto novo (reaproveita o banner genérico
   existente, incluindo o estado de 0 resultados com botão "Mostrar todos").
6. [x] As opções "Todas as situações", "Comprovadas" e "Pendência" continuam
   produzindo exatamente o mesmo resultado que produzem hoje — mudança
   aditiva, zero regressão (coberto por teste que compara com a suíte atual).
7. [x] `LinhaDeDespesa` ganha um campo booleano dedicado (ex.
   `semPagamentoLigado`), setado no bloco 6 de `linhasDeDespesa` — o predicado
   do filtro usa esse booleano, **não** varre `linha.situacoes` por chip nem
   compara string de rótulo (protege contra o rótulo mudar no futuro e o
   filtro parar de funcionar em silêncio — risco identificado no Gate de
   Viabilidade).
8. [x] `FiltroSituacao` ganha um quarto valor (nome exato a critério do
   `lead-engineer`, ex. `"sem_pagamento"`) e `SITUACOES`
   (`app/(gestao)/despesas/page.tsx`) ganha a entrada correspondente.

## Out of Scope
- Rótulo exato da opção — já fechado no design (item 2 acima), não é decisão
  aberta.
- Ações em lote a partir da lista filtrada (ex. "agendar pagamento para
  todas") — não foi pedido no relato; candidato a relato próprio se sentir
  falta depois de usar o filtro.
- Espelhar a opção em `/pendencias` — não se aplica: lá é a fila das 18
  famílias de pendência real, e "Sem pagamento ligado" por desenho não é
  pendência.
- Qualquer mudança na classificação de `CHIP_SEM_PAGAMENTO` como estado
  neutro (nem comprovado, nem em risco) — essa classificação não muda, só
  passa a ser filtrável isoladamente.
- Nenhuma das três metas do produto (documento hábil / relatórios anuais /
  acervo de decadência) é tocada além do já registrado — é puramente filtro
  de apresentação de uma tabela já calculada.

## Gate Fiscal (Contador)
Sem impacto fiscal. Confirmado pelo `po` e pelo `cto-obra` de forma
independente, sem necessidade de acionar o `contador`: é filtro de
leitura/apresentação sobre `LinhaDeDespesa` (projeção em memória), não altera
nenhum cálculo de custo de aquisição, aferição INSS, classificação de chip ou
dado gravado. É estritamente aditivo — as três opções existentes e seu
comportamento não mudam. Nenhuma condição fiscal é emitida neste ticket.

## Pre-mortem
1. **Conflito de edição com o CONTAI-060.** Os dois tickets tocam
   `casaSituacao`/`SITUACOES`/`filtrarLinhas` no mesmo arquivo
   (`lib/fiscal/despesas.ts`) e nos mesmos três arquivos vizinhos (`page.tsx`,
   `despesas.test.ts`, `e2e/despesas.spec.ts`). Se implementado em paralelo
   (não seguindo a Dependência abaixo), um PR reverte silenciosamente o outro
   ou gera merge quebrado só percebido em produção.
2. **Composição errada com outros filtros.** Se a nova opção for implementada
   com lógica ad-hoc fora do padrão de `casaSituacao`, ela "funciona" isolada
   (critério 3) mas devolve linhas/contagem erradas quando combinada com
   Tipo/Busca/Ano (critério 4) — e ninguém percebe se o teste cobrir só o caso
   isolado.
3. **Acoplamento frágil ao rótulo do chip.** Se o predicado comparar a string
   do chip em vez de usar um booleano dedicado (critério 7) e o `designer`
   mudar o texto do chip depois numa revisão de copy, o filtro para de
   funcionar silenciosamente — nenhum erro visível, só uma lista sempre vazia.

## Viabilidade (CTO)
- **Modelo de dados**: nenhum impacto. `LinhaDeDespesa` é projeção em memória
  de `Pagamento`+`Documento`; "Sem pagamento ligado" já nasce no bloco 6 de
  `linhasDeDespesa` a partir de `documentosHabeisSemPagamento(alocacao)`. Não
  toca `Pagamento`, `Documento`, `Favorecido` nem `Obra`.
- **Complexidade: S** (≈40 linhas + testes).
- **Arquivos prováveis**:
  - `lib/fiscal/despesas.ts` — `LinhaDeDespesa` ganha `semPagamentoLigado:
    boolean` (ao lado de `comprovada`/`temPendencia`); bloco 6 seta `true` no
    mesmo `for` que já empurra o chip; `FiltroSituacao` ganha o quarto valor;
    `casaSituacao` ganha o ramo correspondente testando o booleano.
  - `app/(gestao)/despesas/page.tsx` — uma entrada nova em `SITUACOES`. O
    `<select>` já é tipado por `FiltroSituacao`; contagem e "Mostrar todos"
    já são genéricos sobre `filtrarLinhas` — regressão zero por construção.
  - `lib/fiscal/despesas.test.ts` — asserções: linha do bloco 6 com
    `semPagamentoLigado === true` e `comprovada === false`; `filtrarLinhas`
    com a nova situação devolve só essa linha; as três opções antigas
    continuam devolvendo exatamente o que devolvem hoje.
  - `e2e/despesas.spec.ts` — `selectOption` na nova opção no teste que já
    cobre `comprovadas`/`pendencia`, assertando que só a linha "Sem pagamento
    ligado" fica visível.
- **Migration**: nenhuma. Sem tabela, coluna, view, grant ou seed novos.
- **Mecanismo**: quarto valor de `FiltroSituacao` é inevitável (é o tipo do
  `value` do `<select>`), mas o predicado deve testar o booleano dedicado
  `linha.semPagamentoLigado`, não vasculhar `linha.situacoes` pelo chip nem
  comparar string de rótulo — protege contra o dia em que o rótulo do chip
  mudar (critério 7). Não derivar de `dataPagamento === null`: documento em
  quarentena também não tem data de pagamento e é pendência real, não "sem
  pagamento ligado" — misturar os dois predicados confundiria conceitos que o
  `CONTAI-060` já trata como distintos.

## Dependências
- **Bloqueado por `CONTAI-060`** — não funcional, de árvore de trabalho: o
  diff não commitado do `CONTAI-060` altera `casaTipo`/`casaAno`/a assinatura
  de `filtrarLinhas` (ganha parâmetro `ano`) nas linhas vizinhas de
  `lib/fiscal/despesas.ts`, e toca os mesmos três arquivos deste ticket
  (`page.tsx`, `despesas.test.ts`, `e2e/despesas.spec.ts`). Conflito textual é
  certo, não provável — os testes novos deste ticket dependem da assinatura de
  3 argumentos que o `CONTAI-060` introduz. Gate 1 (implementação) só começa
  depois do `CONTAI-060` estar commitado em `main` (não precisa esperar
  deploy). Não anexar este escopo ao `CONTAI-060` — ele está em retrabalho de
  Gate 2, escopo extra só atrasaria.
- Não bloqueia nenhum outro ticket.

## Perguntas Abertas
Nenhuma. Relato inequívoco, Gate 0 (design) já fechado sem pendência, Gate
Fiscal não se aplica, viabilidade confirmada sem migration.

## Cenário e checagem final
**Gestão** (`/despesas`, em casa, sentado — revisão da tabela para decidir o
que falta agendar/registrar). Teste do Canteiro não se aplica: não é tela de
captura.

Serve à Meta 1 ("nenhum pagamento sem documento hábil") indiretamente, como
ferramenta de leitura para localizar em lote as notas válidas que ainda
esperam pagamento — não cria nem altera nenhuma regra fiscal, relatório anual
ou peça do acervo documental.

Varredura de condição fiscal órfã (`grep -rniE 'restri[çc][ãa]o fiscal|regra
fiscal|exig[êe]ncia fiscal|fiscalmente (obriga|exige|pro[íi]be)'`): este
ticket não contém nenhuma dessas expressões — coerente com "sem impacto
fiscal" declarado acima.

**Veredito: APROVADO.** Pronto para `/develop`, sem Gate 0 pendente — fila de
implementação, respeitando a dependência do `CONTAI-060` (Gate 1 só depois do
`060` commitado em `main`).

✅ **Entregue em 2026-09-26.** 8/8 critérios PASS — Gate 4 (`po`). Implementado
depois do `CONTAI-060` commitado em `main` (b9c2a39), como a Dependência
exigia. `LinhaDeDespesa` ganhou `semPagamentoLigado: boolean`, setado no mesmo
laço do bloco 6 que já empurra `CHIP_SEM_PAGAMENTO` — o predicado de
`casaSituacao` lê esse booleano, nunca varre `situacoes` pelo chip nem compara
string de rótulo (Pre-mortem 3). `FiltroSituacao` ganhou `"sem_pagamento"`,
`SITUACOES` ganhou a quarta entrada com o rótulo puxado da própria constante
`CHIP_SEM_PAGAMENTO` (não digitado de novo), no fim da lista, sem tocar nas
três opções existentes. Sem migration — puramente filtro de leitura sobre
projeção em memória. Testes novos cobrem os três Pre-mortens do ticket:
isolamento sem digitar busca (critério 3), composição em E com Tipo/Busca/Ano
sem que nenhum dos dois cancele o outro (critério 4, Pre-mortem 2), e a
quarentena — que também não tem `dataPagamento` — ficando de fora do terceiro
estado (Pre-mortem 3, prova de que o predicado não é `dataPagamento === null`).
Zero regressão nas três opções antigas, testado explicitamente. 49 unitários
(`lib/fiscal/despesas.test.ts`) + 56 E2E escopados
(`despesas.spec.ts`/`shell-desktop.spec.ts`/`documento-sem-arquivo.spec.ts`)
verdes. Nenhum arquivo mudou depois do APPROVE do `cto-obra` além dos quatro
já listados na Viabilidade (`lib/fiscal/despesas.ts`+`.test.ts`, `page.tsx`,
`e2e/despesas.spec.ts`); trabalho concorrente do `CONTAI-065` na mesma árvore
(migration `0020`, `lib/data.ts`, `database.types.ts`, `banco.ts`,
`compra-cartao/page.tsx`, `cartao.spec.ts`, `privilegios.spec.ts`,
`vinculo-de-origem.spec.ts`) não foi tocado nem revisado por este Gate 4.
