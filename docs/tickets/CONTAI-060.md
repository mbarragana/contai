# CONTAI-060 Seletor de ano no shell, sincronizando Home + Despesas (+ Pendências de graça)

## Tipo e Prioridade
feature — **P2** (rebaixado de P1 em 2026-09-26 — ver nota abaixo:
verificado em produção que este ticket NÃO explica o sintoma que o Mateus
relatou; continua válido como melhoria, para quando a obra cruzar para
2027, mas deixou de ser urgente).

⚠️ **Correção de diagnóstico, 2026-09-26**: o Mateus apontou que "todos os
valores inputados até agora são de 2026", o que invalidava a hipótese de
escopo de ano como causa do que ele via. Conferido ao vivo em produção
(`https://contai-rosy.vercel.app/despesas`, obra Casa Tanheiros): a soma
manual da coluna "Custo confirmado" bate **exatamente** com o KPI "Custo
confirmado em 2026" da Home (R$ 55.655,22 = R$ 55.655,22) — sem bug, sem
divergência de escopo de ano nenhuma no caso real. A divergência que o
Mateus via era somar a coluna "Valor lançado" (que inclui uma nota "pago
sem comprovante") contra o KPI "Custo confirmado" — a diferença de
R$ 7.449,76 é **exatamente** o card separado "Custo em risco no IR",
corretamente fora do custo confirmado por desenho (meta 1: nenhum
pagamento sem documento hábil vira custo confirmado). Não era o `CONTAI-060`
que precisava resolver isso.

## Dor de Origem
`docs/backlog/73-2026-09-26-texto-pendencia-retencao-e-escopo-ano-despesas.md`,
US-B. Palavras do Mateus: *"outra coisa, o somatório na visão geral ainda
esta diferente se eu somar todas as despesas."* Investigação original
(agora sabida incompleta): `/despesas`
(`app/(gestao)/despesas/page.tsx`) não tem filtro de ano nenhum — mostra
TODAS as despesas da obra, todos os anos; a Home mostra "Custo confirmado
**em 2026**" (escopado por ano). Isso continua sendo um gap real — só não
é o que causou o sintoma relatado, porque toda a obra até agora está em
2026 (o gap só vai se manifestar quando a obra cruzar para 2027, ~20 meses
de duração).

Materializa a dívida já nomeada em
`docs/backlog/48-2026-09-21-gate1-decisoes-contai-040.md` ("seletor de ano
sincronizado dashboard + `/pendencias`"), na época não implementada porque
`/despesas` ainda era stub — deixou de ser desde o `CONTAI-041`/`057`.

## User Story
Como dono da obra revisando Despesas em casa, sentado, quero que a tabela
mostre por padrão as despesas do mesmo ano-calendário que a Home está
mostrando, e que ver o total acumulado da obra inteira seja uma escolha
explícita e rotulada, para poder somar de cabeça sem comparar grandezas
diferentes por engano.

## Critérios de Aceite
1. [x] Ao abrir `/despesas` sem interação prévia, o ano mostrado é o mesmo
   que a Home está mostrando naquele momento — nascem sincronizados na
   entrada, via estado único no `ProvedorDeGestao` (não query param, não
   estado duplicado por tela).
2. [x] Existe um controle de ano no shell (não um seletor por tela) —
   trocar o ano num lugar reflete em Home, Despesas **e Pendências** na
   mesma renderização (a correção fecha a dívida do `CONTAI-040`/`48`
   sem esforço extra, porque `/pendencias` já lê o mesmo estado do
   provedor).
3. [x] Existe uma opção explícita e rotulada para ver "todos os anos"
   (acumulado) — nunca o estado inicial, nunca indistinguível do total "do
   ano". Na Home, o KPI sob "todos os anos" rotula o campo já existente
   `acumuladoImovelCentavos`, não inventa uma soma nova.
4. [x] Trocar de ano NÃO refaz fetch da obra — é recálculo local
   (`useMemo`) sobre os dados já carregados pelo `ProvedorDeGestao`; o
   `pathname`-revalidate do `CONTAI-058` continua intacto e não é
   disparado pela troca de ano.
5. [x] Linha sem `dataPagamento` (nota órfã, pagamento sem data
   registrada): **nunca entra em nenhum total monetário** (nem delta do
   ano, nem acumulado) **e nunca desaparece da tela ao trocar o filtro de
   ano** — fica sempre visível como pendência de captura, em qualquer
   ano selecionado. Ratificado pelo `contador`:
   `docs/pareceres/2026-09-26-regime-caixa-dado-incompleto-escopo-ano.md`.
6. [x] Teste (Vitest/Playwright) cobre: estado inicial sincronizado entre
   Home e Despesas; troca de ano refletida nas três telas (Home, Despesas,
   Pendências) na mesma renderização; total acumulado nunca é o default;
   linha sem data de pagamento visível em qualquer ano selecionado, sem
   entrar em nenhum total.

## Out of Scope
- Persistir o ano escolhido (localStorage/sessionStorage/URL) — ao montar
  o provedor, o ano corrente é sempre o estado inicial; "todos" é opção,
  não default persistente.
- Redesenho de `/despesas` além do filtro de ano.
- Qualquer mudança de cálculo fiscal — `lib/fiscal/despesas.ts` e
  `lib/fiscal/vinculo.ts` já concordam matematicamente; este ticket só
  adiciona o corte por ano, reusando `anoCalendario()` já existente.
- `/adicionar/*` (grupo de captura) ficar fora do provedor de ano — aceito
  e documentado, não é bug: voltar da captura reseta para o ano corrente.
- `CONTAI-059` (texto/cor da pendência de retenção) — achado 1 do mesmo
  relato, causa técnica diferente, ticket separado.

## Gate Fiscal (Contador)
Fonte: veredito no backlog de origem + parecer novo
`docs/pareceres/2026-09-26-regime-caixa-dado-incompleto-escopo-ano.md`.

1. "Delta do ano" e "acumulado até uma data" são as duas grandezas
   fiscalmente válidas em regime de caixa; somar tudo sem corte temporal,
   misturando anos, não é uma delas e não deve ser o default de leitura de
   nenhuma tela.
2. Linha sem `dataPagamento`: regra de duas partes — (a) nunca entra em
   nenhum total monetário, nem delta do ano nem acumulado (o regime de
   caixa exige a data que falta); (b) nunca desaparece da tela ao trocar o
   filtro de ano — fica sempre visível como pendência de captura,
   constante. Doutrina de aplicação geral (vale para qualquer tela futura
   com filtro por ano, inclusive `/pendencias`), não específica desta
   tela.

## Pre-mortem
1. **Linha sem `dataPagamento` some silenciosamente sob algum filtro de
   ano** — critério 5 trava isso explicitamente, com parecer citado.
2. **Usuário troca o ano num lugar sem perceber que os outros também
   mudaram** (ou não mudaram, se a sincronização for parcial) — mitigado
   pelo estado único no `ProvedorDeGestao` (critério 1/2), não há "lugar
   que ficou para trás".
3. **`anoCorrente` usado em `unificarPendencias` (4 usos, ex.
   `sinalDoEmitenteErrado`) confunde "ano em tela" com "hoje"** — hoje os
   dois coincidem; o seletor separa os dois. Auditoria de cada uso é
   pré-requisito do Gate 1, não item aberto (Viabilidade abaixo).

## Viabilidade (CTO)
- **Onde mora o ano**: `ProvedorDeGestao`
  (`app/_components/gestao.tsx`), como `useState<number | null>` (`null` =
  todos), exposto no contexto com `escolherAno`. Não persiste (nem
  localStorage nem URL) — montou, é o ano corrente; é isso que faz "todos"
  ser opção e não default. `useSearchParams` no Next 16 exigiria Suspense
  boundary no layout do grupo, e cada link da sidebar teria que carregar
  `?ano=` — descartado. `resumo`/`unificadas` saem do efeito de fetch para
  `useMemo(painel, painelPendencias, ano)` — trocar ano não refaz fetch, o
  revalidate por `pathname` do `CONTAI-058` fica intacto. Anos oferecidos
  por função pura `anosDaObra(painel)` (min/max de datas com pagamento).
- **Como `/despesas` filtra**: não na tela — `filtrarLinhas`
  (`lib/fiscal/despesas.ts`) ganha `ano` nos `Filtros`, usando
  `anoCalendario(linha.dataPagamento)` (mesma função que `calcularResumo`
  já usa pro custo do ano). A tela só passa `estado.ano` para dentro do
  filtro e ajusta a contagem ("N de M lançamentos em 2026").
- **"Todos os anos"**: mesma infraestrutura, valor `null`. Em `/despesas`
  o predicado de ano é pulado. Na Home, `calcularResumo`/`unificarPendencias`
  recebem o ano corrente internamente quando `null` (precisam de número
  concreto), e o KPI passa a rotular o campo já existente
  `acumuladoImovelCentavos` em vez de `custoConfirmadoAnoCentavos` — nada
  novo é somado, só qual campo o tile mostra.
- **Onde entra o controle**: o subtítulo `obra · ano` do shell
  (`app/_components/shell.tsx`) vira o seletor — forma exata é do
  `designer`, nunca um seletor por tela.
- **Arquivos e complexidade — M**: `app/_components/gestao.tsx` (estado +
  memo + `escolherAno`), `app/_components/shell.tsx` (controle),
  `lib/fiscal/despesas.ts` + `.test.ts` (filtro por ano),
  `lib/fiscal/obra.ts` + teste (`anosDaObra`),
  `app/(gestao)/despesas/page.tsx` (passa ano, ajusta contagem),
  `app/_components/kpi.tsx` (rótulo sob "todos"), `e2e/despesas.spec.ts`,
  `e2e/pendencias.spec.ts` (trocar ano muda badge, fila e lista na mesma
  renderização). Sem modelo de dados, sem migration, sem GRANT.
- **Fecha a dívida do `48-...md` de graça, sem forçar**: `/pendencias` já
  lê `estado.ano` (`EscopoDaLista`) e o badge já sai de `unificadas` do
  mesmo provedor — colocar o controle no shell resolve as três telas no
  mesmo diff. Critério de aceite obrigatório (critério 2 acima): trocar
  ano muda badge, fila e lista de despesas na mesma renderização.
- **Pré-requisito do Gate 1, não item aberto**: auditar os 4 usos de
  `anoCorrente` em `unificarPendencias` (ex. `sinalDoEmitenteErrado`) e
  decidir, caso a caso, se a semântica certa é "ano em tela" ou "hoje" —
  hoje os dois coincidem, o seletor os separa.
- **Dívida nova**: `/adicionar/*` fica fora do provedor — voltar da
  captura reseta para o ano corrente. Aceito e documentado no Out of
  Scope, não é dívida de fato.

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: nenhum. Fecha (não bloqueia) a dívida nomeada em
  `docs/backlog/48-2026-09-21-gate1-decisoes-contai-040.md`.

## Perguntas Abertas
Nenhuma — mecanismo decidido pelo `cto-obra`, ponto fiscal (linha sem
data) ratificado pelo `contador`.

## Cenário e checagem final
**Gestão** — o controle fica no shell, cenário principal (em casa,
sentado). Teste do Canteiro não se aplica (o grupo `(captura)` fica fora
do provedor, por design). **Veredito: APROVADO**, com Gate 0 (design nível
2 — controle novo no shell, `spec + ASCII`) pendente antes do Gate 1.

✅ **Entregue em 2026-09-26.** 6/6 critérios PASS — Gate 4 (`po`). Gate 2
técnico (`cto-obra`) e fiscal (`contador`) levou duas rodadas: a primeira
pediu duas correções bloqueantes de regime fiscal — `financiamentoAguardandoInforme`/
`financiamentoFaltaLancar` e `terrenoSemRegistro` liam o ANO EM TELA como se
fosse "hoje", o que rebaixaria pendência real (`falta_lancar`, vermelha) a
aviso (`aguardando_informe`, âmbar) a partir de 01/01/2027, e faria "terreno
sem registro" acender por filtro de leitura numa obra com o terreno já
registrado. Corrigido separando `ano` (recorte de leitura) de `anoCorrente`
(calendário) em `EntradaResumo`, com a doutrina nova "ano fechado × ano
corrente é do calendário, nunca da tela" — ver
`docs/backlog/77-2026-09-26-ano-em-tela-vs-hoje-gate2-contai-060.md`. A
segunda rodada aprovou. `terrenoTemRegistro` (`lib/fiscal/terreno.ts`) nasceu
nesta correção — pergunta da obra inteira, sem ano por parâmetro.
`e2e/pendencias.spec.ts` tinha um teste que consagrava o segundo defeito como
esperado; foi reescrito para provar o contrário (informe de ano fechado não
sai da fila nem muda de cor com o seletor).

Nenhum arquivo mudou depois do APPROVE final do `cto-obra`, além de dois
mocks de OUTROS tickets (`design/mocks/CONTAI-062.md` e `CONTAI-063.md`)
editados em paralelo pelo orquestrador — sem relação com este ticket, e
excluídos desta verificação por instrução explícita.

D78 (rótulos de escopo que só ficam ambíguos quando a obra cruzar de ano,
data-gatilho 01/01/2027) nomeada em `docs/backlog.md`, sem ticket próprio
ainda — revisar ao entrar em 2027. 1122 testes unitários + 327 E2E verdes,
sem migration.
