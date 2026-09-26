# CONTAI-057 Coluna própria para o custo comprovado por linha em Despesas

## Tipo e Prioridade
bug — P1 (legibilidade). Achado em produção pelo Mateus logo depois do
`CONTAI-056`: não é erro de cálculo (Home e discriminação anual já somam
certo desde então), é a tela de Despesas escondendo visualmente o número
que mudou de significado.

## Dor de Origem
`docs/backlog/72-2026-09-26-legibilidade-despesas-e-cache-documento.md`,
US-A. Palavras do Mateus: *"se você acessar produção vai ver que o valor
total na visão geral é diferente se somar todas as despesas para 2026."* A
coluna "Valor" de cada linha mostra só o valor do pagamento, em destaque
grande; o valor absorvido por retenção qualificada (desde o `CONTAI-056`)
aparece só como anotação pequena e cinza dentro da célula "Situação" — soma
visual manual das linhas dá um número diferente do KPI "Custo confirmado"
da Home, que soma corretamente as duas pernas.

## User Story
Como dono da obra revisando Despesas em casa, sentado, quero identificar
sem somar de cabeça qual é o custo de aquisição comprovado de cada nota
(pagamento + retenção, quando houver), para não montar uma leitura errada
do que já foi gasto.

## Critérios de Aceite
1. [x] Proposta de design nível 2 (spec + ASCII do bloco — campo/coluna a
   mais numa tabela existente, não fluxo novo) descrita em
   `design/mocks/CONTAI-057.md`.
2. [x] Nova coluna **"Custo confirmado"** (decidido no `/design`, evita
   colidir com o texto do chip `CHIP_CUSTO_COMPROVADO` já existente na
   célula Situação, e reusa o vocabulário do KPI equivalente da Home) entre
   "Valor" e "Situação", alinhada à direita, `mono font-semibold` (o mesmo
   peso visual que "Valor" tem hoje). "Valor" perde o `font-semibold` —
   passa a ser o número secundário da linha.
3. [x] A coluna "Valor" passa a se chamar **"Valor lançado"** (decidido no
   `/design`) — nunca "Valor pago" nem qualquer rótulo que afirme
   desembolso: 3 das 5 linhas de fixture do E2E existente são documento sem
   pagamento (`dataPagamento === null`), e "pago" seria falso nelas.
   "Valor lançado" é verdadeiro nas duas origens (documento com e sem
   pagamento vinculado) e já era o termo informal usado em
   `e2e/despesas.spec.ts:337`.
4. [x] `custoComprovadoCentavos > 0` na coluna nova mostra o número;
   `= 0` mostra `—` (a razão mora na célula "Situação" ao lado, que já
   carrega o texto da pendência — não duplicar explicação).
5. [x] O chip verde de custo comprovado (`CHIP_CUSTO_COMPROVADO`) na célula
   "Situação" perde o valor inline — a coluna nova já carrega esse número;
   repetir o mesmo valor duas vezes na mesma linha é ruído. O chip de
   retenção mantém o dele (ali ele decompõe o custo, não repete).
6. [x] Nenhuma soma nova acontece em tela: `custoComprovadoCentavos` é
   campo novo em `LinhaDeDespesa` (`lib/fiscal/despesas.ts`), calculado no
   módulo puro como soma de `comprovadoCentavos` + `comprovadoPorRetencaoCentavos`
   (já existentes) — nunca calculado ad hoc no componente de Despesas.
7. [x] Teste de render/unitário: `custoComprovadoCentavos` é identificável
   programaticamente (atributo/`data-*` próprio), não apenas texto solto na
   mesma classe CSS de qualquer outra anotação.
8. [x] Coluna nova não é sortável neste ticket — a ordenação por "valor"
   continua pelo valor lançado, sem mudança.
9. [x] Texto novo que mencione custo comprovado/retenção cita o parecer
   `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (ADENDO 2/3)
   e o `CONTAI-056` — nunca reescreve.

## Out of Scope
- Fazer a tabela de Despesas somar valores em tela (rodapé/totalizador) —
  doutrina deliberada do `CONTAI-005` (`emPendenciaCentavos` morto,
  comentário no topo de `despesas/page.tsx`), não reaberta aqui.
- Mudar `lib/fiscal/vinculo.ts` — cálculo já correto, este ticket é
  puramente apresentação + um campo derivado em `despesas.ts`.
- Redesenhar a tabela de Despesas inteira.
- `CONTAI-058` (cache/revalidação do shell de gestão) — causa técnica
  totalmente diferente, ticket separado.

## Gate Fiscal (Contador)
**Sem impacto fiscal.** Consultado no relato de origem: não existe, em IN
84/2001, em prática de escrituração ou em qualquer norma aplicável, uma
exigência de que uma tela interna de gestão apresente, por linha, um
número visualmente proeminente que já seja o total comprovado daquele
item. É decisão de UX/produto — Home e discriminação anual (as saídas com
efeito fiscal real) já estão corretas desde o `CONTAI-056`.

## Pre-mortem
1. **Vira redesign da tabela.** Mitigação: escopo travado nas colunas
   "Valor lançado"/"Custo confirmado"/"Situação", nada além.
2. **Reintroduz soma em tela.** Mitigação: critério 6 exige que o campo
   venha pronto do módulo fiscal, nunca calculado no componente — mesmo
   dado que a Home já lê.
3. **Texto de tela reescreve regra fiscal por conta própria.** Mitigação:
   critério 9 amarra qualquer texto novo ao parecer/ticket de origem.

## Viabilidade (CTO)
- **Origem do dado — já pronta, no array que a tela itera.** `LinhaDeDespesa`
  (`lib/fiscal/despesas.ts:232-243`) já carrega `comprovadoCentavos` (de
  `alocacao.porPagamento`) e `comprovadoPorRetencaoCentavos` (de
  `alocacao.porRetencao`) — `despesas.test.ts:202` já fecha o invariante
  `Σ(comprovado + comprovadoPorRetencao) = Σ custo dos componentes`. Nada a
  buscar, nada a calcular na tela: acrescentar `custoComprovadoCentavos`
  como campo derivado em `LinhaDeDespesa`, preenchido no módulo puro (é
  decomposição da própria linha, não soma entre linhas — não reabre a
  porta do `CONTAI-005`). Invariante útil, sem condição nova:
  `custoComprovado > valorCentavos ⇔ comprovadoPorRetencao > 0`.
- **Arquivos e complexidade — S**:
  - `lib/fiscal/despesas.ts` (+1 campo derivado) e `despesas.test.ts` (+1
    asserção: campo = soma das parcelas).
  - `app/(gestao)/despesas/page.tsx` — `Tabela` (cabeçalhos) e `Linha`
    (célula); o `Rotulo` mobile segue o padrão existente, sem bifurcar JSX.
  - `e2e/despesas.spec.ts` — o risco de colisão em strict mode com
    `getByText("Custo comprovado")` (linha ~161, o chip) foi resolvido no
    `/design`: o cabeçalho da coluna nova é **"Custo confirmado"**, não
    "Custo comprovado" — não há substring em comum, nenhum ajuste de
    locator existente é necessário. Acrescentar uma linha com retenção na
    fixture, afirmando que a coluna mostra o confirmado maior que o
    lançado.
  - `design/mocks/desktop-shell-v1.md` (lista de colunas) — atualizar.
- **Nível de design: 2** (não o 1 sugerido inicialmente pelo `po`) — não há
  tela nem fluxo novo, é campo/estado a mais numa tabela existente.
- **Dívida nova: nenhuma.** D77 (teto por componente) não é tocada — a
  tela só exibe o que `alocarCusto` já reparte.

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma — o rótulo exato da coluna "Valor" fica a critério do `designer`,
dentro da restrição dura do critério 3 (tem que ser verdadeiro nas duas
origens).

## Cenário e checagem final
**Gestão** — revisão de despesas é o cenário principal (em casa, sentado).
Teste do Canteiro não se aplica. **Veredito: APROVADO**, com Gate 0 (design
nível 2) pendente antes do Gate 1.

✅ **Entregue em 2026-09-26.** 9/9 critérios PASS — Gate 4 (`po`). Coluna
"Custo confirmado" (mono, semibold, alinhada à direita, não sortável) inserida
entre "Valor lançado" (ex-"Valor", que perdeu o semibold) e "Situação";
`custoComprovadoCentavos` é campo derivado em `LinhaDeDespesa`
(`lib/fiscal/despesas.ts`, soma de `comprovadoCentavos` +
`comprovadoPorRetencaoCentavos`, calculado só no módulo puro), exposto no DOM
por `data-custo-comprovado`. Chip verde `CHIP_CUSTO_COMPROVADO` perdeu o valor
inline; chip de retenção manteve o dele. Gate 2 técnico (`cto-obra`) aprovou
direto, sem pedir mudança de mérito — só uma nota cosmética não bloqueante
(`design/mocks/desktop-shell-v1.md`, lista de colunas ainda citava "Valor" em
vez de "Valor lançado"), corrigida pelo coordenador depois do APPROVE, sem
mudar produto. Sem Gate Fiscal (sem impacto fiscal, confirmado no relato de
origem). `lib/fiscal/vinculo.ts` intocado; nenhuma soma nova em tela. 1085
unitários + 317 E2E verdes (`npx playwright test e2e/despesas.spec.ts
e2e/shell-desktop.spec.ts`: 36/36), `npm run typecheck` e `npm run lint`
verdes, sem migration. Fecha o backlog 72 junto com o `CONTAI-058`.
