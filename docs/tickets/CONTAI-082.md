# CONTAI-082 Filtro por urgência e busca por favorecido na Agenda

## Tipo e Prioridade
Feature — **P1** — confirmado pelo `po` (subiu de P2 no relato original):
dor já real hoje (fornecedor com 7 parcelas agendadas ao mesmo tempo),
tela do cenário principal de gestão, custo baixo de entrega por reuso.

## Dor de Origem
Relato: `docs/backlog/98-2026-09-30-filtro-busca-agenda-compromisso.md`.

> "deveríamos adicionar um filtro também nos /compromisso, e pesquisa por
> nome/favorecido"

`/compromisso` (Agenda) lista todos os agendamentos em aberto sem filtro,
busca ou paginação (`montarAgendaDaHome(..., Infinity)`). A obra já tem um
fornecedor com 7 parcelas agendadas ao mesmo tempo (CONTAI-081) — achar um
agendamento específico exige rolar/escanear a lista inteira.

## User Story
Como dono da obra revisando a Agenda em casa, sentado, quando a lista tem
vários itens do mesmo favorecido ou está ficando longa, quero filtrar por
urgência e/ou buscar por favorecido, para achar um agendamento específico
sem escanear a lista inteira.

## Critérios de Aceite
1. [x] Proposta nível 2 em `design/mocks/CONTAI-082.md`.
2. [x] Dropdown `aria-label="Urgência"` com as opções, nesta ordem:
   **Todos** (`todos`), **Vencidos** (`vencido`), **Vence hoje**
   (`vence_hoje`), **Vence amanhã** (`vence_amanha`), **Agendados**
   (`comum`) — os mesmos valores de `UrgenciaDoAgendamento` do CONTAI-075.
3. [x] O filtro usa SÓ o campo `urgencia` de `chipDoAgendado(c, hoje)` —
   nunca o texto dinâmico (`chip.texto`, que muda por dia/contagem e não
   pode virar rótulo de opção).
4. [x] Campo `aria-label="Buscar favorecido"` (placeholder "Buscar
   favorecido…") filtrando por `normalizar(favorecidoNome ?? "")` (NFD sem
   diacrítico, case-insensitive, `lib/texto.ts`) — "concreto" acha
   "Concreto"/"CONCRETO". `favorecidoNome === null` não casa com nada.
5. [x] Filtro de urgência e busca compõem por **E lógico**: os dois ativos
   ao mesmo tempo mostram só o que bate nos dois; limpar um reaplica o
   outro sozinho, nunca reseta os dois juntos.
6. [x] Filtro/busca reduzem o `Compromisso[]` de ENTRADA, ANTES de chamar
   `montarAgendaDaHome` — a função em si não muda. Vencidos continuam
   todos no topo, sem teto, seguidos pelos abertos por `dataPrevista`
   crescente, sobre o conjunto já filtrado.
7. [x] `montarAgendaDaHome` é chamada 2 vezes na tela, com o MESMO
   `hojeIso()`: uma vez sobre a lista completa (só para saber se a Agenda
   está genuinamente vazia) e uma vez sobre a lista filtrada (para
   renderizar) — nunca duas derivações de "hoje" na mesma tela.
8. [x] Contagem `data-contagem="agenda"` na barra: quando N (filtrado) =
   M (total), mostra só "M agendamentos" (singular se M=1, sem "de M");
   quando N ≠ M, mostra "N de M agendamentos" (plural fixo).
9. [x] Estado de vazio-por-filtro: quando a lista completa NÃO é vazia mas
   a filtrada é, aparece banner âmbar "Nenhum agendamento com estes
   filtros. Há {M} agendamento(s) em aberto — o filtro é que está
   escondendo." com botão "Mostrar todos" (reseta urgência→`todos` e
   busca→`""`) — nunca reaproveita o banner verde "Nenhum agendamento em
   aberto" existente, que afirma um fato diferente.
10. [x] O banner verde "Nenhum agendamento em aberto" continua aparecendo,
    sem mudança, quando a Agenda está genuinamente vazia (filtro=`todos`,
    busca vazia, zero agendamentos).
11. [x] O `Passo` dentro de `BlocoAgendados` ("N já venceu" etc.) continua
    recebendo a agenda FILTRADA — não muda, aceitável porque a barra já
    expõe "N de M" do universo total.
12. [x] Estado do filtro/busca é `useState` local à página — NUNCA
    persistido (localStorage/sessionStorage/query string): toda chegada
    na Agenda mostra tudo, para um filtro esquecido de uma visita anterior
    nunca esconder um vencido sem o Mateus ter acabado de escolher isso.
13. [x] Função pura nova `filtrarAgenda(compromissos, filtros, hoje)` em
    `lib/gestao/filtro-agenda.ts` (não em `lib/fiscal/compromisso.ts` —
    filtro de exibição não é regra fiscal, mesma razão de
    `busca-candidatos.ts` morar em `lib/gestao/`), testada: cada urgência
    isolada, busca sem diacrítico, combinação dos dois,
    `favorecidoNome === null`.
14. [x] `filtrarCandidatos` (CONTAI-078) NÃO é reaproveitada aqui —
    `Compromisso` não tem `valorCentavos` (tem `valorPrevistoCentavos`, e
    renomear pra caber no tipo violaria a proibição de chamar valor
    previsto de "valor", Gate Fiscal 6.3 de `compromisso.ts`). Só
    `normalizar` é reaproveitada.
15. [x] A `BarraDeFiltros` de `/despesas` NÃO é generalizada/compartilhada
    — a Agenda ganha um componente próprio (opções diferentes: urgência,
    não situação+tipo). Só a constante `CAMPO` (classe de tamanho de
    campo, 16px no piso) é exportada de `app/_components/ui.tsx` e
    reaproveitada nas duas telas.
16. [x] `Home` (`montarAgendaDaHome`, `MAX_ABERTOS_NA_HOME`, corte de 3
    itens) não sofre nenhuma mudança de código nem de comportamento —
    filtro e busca são exclusivos de `/compromisso`.

## Out of Scope
- **Mostrar quitados/cancelados** — decisão do Mateus; `/compromisso`
  continua só com `situacao === "aberto"`.
- **Filtro por origem** (PIX/boleto/cartão) — não foi pedido.
- **Paginação** — filtro+busca já resolvem o volume.
- **Persistir o filtro** — decisão deliberada do `cto-obra` (ver Pre-mortem
  e Viabilidade); se um relato futuro mostrar que o clique extra dói, o
  upgrade é query string, nunca storage.

## Gate Fiscal (Contador)
**Sem impacto fiscal** — filtro de exibição sobre dado que já existe e já
está correto (mesma classificação do CONTAI-078): não altera custo de
aquisição, base de aferição, discriminação anual, Pagamentos Efetuados nem
acervo. Os textos de vazio-por-filtro não afirmam fato fiscal, por isso não
carregam `Consequencia`.

## Pre-mortem
1. **Rótulo do filtro copiando o texto dinâmico do chip**: mitigado pelo
   critério 3 (só `urgencia`, nunca `texto`).
2. **Confundir `situacao` (aberto/quitado/cancelado) com `urgencia`
   (vencido/vence hoje/vence amanhã/comum)**: mitigado pelos critérios 2-3
   citando `UrgenciaDoAgendamento` explicitamente, nunca `situacao`.
3. **Filtro/busca reintroduzindo teto ou reordenação nos vencidos**:
   mitigado pelo critério 6 (reduz a entrada, nunca toca o agrupamento).
4. **Persistir o filtro escondendo um vencido sem o Mateus saber**:
   achado do `cto-obra` — mitigado pelo critério 12 (nunca persiste).

## Viabilidade (CTO)
- **Onde filtrar**: antes de `montarAgendaDaHome`, sem tocá-la — a função
  é reaproveitada 2x (lista completa para saber se está vazia de verdade;
  lista filtrada para renderizar), com o mesmo `hojeIso()` nas duas
  chamadas.
- **`filtrarCandidatos` não serve**: `ItemBuscavel` exige `valorCentavos`,
  que `Compromisso` não tem (tem `valorPrevistoCentavos`, protegido pelo
  Gate Fiscal 6.3 contra ser chamado de "valor"). Só `normalizar` é
  reaproveitada, no mesmo padrão de uma linha que `despesas.ts` já usa.
- **Componente próprio**, não generalização de `BarraDeFiltros` de
  `/despesas` — opções diferentes o suficiente pra não valer o
  acoplamento; só a constante `CAMPO` é compartilhada.
- **Estado não persistido** — `useState` local, decisão deliberada (ver
  Pre-mortem 4).
- **Modelo de dados**: zero. Sem migration, sem GRANT. Tudo client-side
  sobre `estado.compromissos` já em memória.
- **Arquivos**: `lib/gestao/filtro-agenda.ts` (novo, `filtrarAgenda`) +
  `.test.ts`, `app/(gestao)/compromisso/page.tsx`,
  `app/_components/ui.tsx` (exportar `CAMPO`),
  `app/(gestao)/despesas/page.tsx` (1 linha, importar `CAMPO`),
  `e2e/compromisso.spec.ts` (filtro Vencidos mantém cartão vencido e some
  linha aberta; busca por favorecido; vazio-por-filtro com "Mostrar
  todos"; banner verde só quando não há aberto nenhum),
  `design/mocks/CONTAI-082.md` (já escrito).
- **Complexidade: S** (~150 linhas com testes).
- **Dívidas criadas**: nenhuma nova de código. Nomeadas: 3ª cópia de
  `normalizar(nome ?? "").includes(termo)` (extrair só na 4ª ocorrência);
  filtro não persiste (upgrade futuro por relato, nunca storage);
  contagem do `Passo` reflete subconjunto filtrado, não o total (mitigado
  pela barra "N de M").

## Dependências
Bloqueado por / Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma.

## Cenário e checagem final
**Gestão** (revisar Agenda, em casa, sentado). Serve indiretamente à meta 2
(relatórios anuais prontos): reduz a chance de o Mateus perder de vista um
agendamento específico numa lista que só cresce. Sem condição fiscal órfã
(Gate Fiscal fechado, sem impacto). Sem UI que quebre disciplina de campo
fiscal (não há campo fiscal — filtro é seleção/busca). **Veredito:
APROVADO.** Pronto para `/develop`.

✅ **Entregue em 2026-09-30.** Gate 4 (`po`) PASS, 16/16 critérios. Filtro
por urgência (`aria-label="Urgência"`, severidade decrescente) + busca por
favorecido (`aria-label="Buscar favorecido"`, `normalizar` sem diacrítico)
em `/compromisso`, compondo por E lógico, em `lib/gestao/filtro-agenda.ts`
(`filtrarAgenda`, 17 testes unitários próprios). O recorte acontece no
`Compromisso[]` de ENTRADA, antes de `montarAgendaDaHome` — chamada 2 vezes
com o mesmo `hojeIso()` (lista completa para saber se a Agenda é
genuinamente vazia; lista filtrada para renderizar). Contagem "N de M
agendamentos" (singular quando N=M=1, "de M" omitido quando N=M). Estado
`useState` local, nunca persistido — confirmado pelo e2e "o filtro NÃO
sobrevive à visita". `filtrarCandidatos` (CONTAI-078) não foi reaproveitada
(`Compromisso` não tem `valorCentavos`); a `BarraDeFiltros` de `/despesas`
não foi generalizada — só a constante `CAMPO` passou a ser exportada de
`app/_components/ui.tsx` e reaproveitada nas duas telas.

**Arquivos alterados após o último APPROVE do Gate 2**:
`e2e/campos-fiscais.spec.ts`. Gate 2 (`cto-obra`) voltou REQUEST CHANGES
numa rodada por 1 item bloqueante: `/compromisso` estava classificado no
bloco "telas declaradas sem campo fiscal não têm controle nenhum" por
omissão de cenário — o cenário-padrão da suíte é vazio e a barra não
renderiza sem agendamento, o mesmo formato de falso positivo do
`numeric`-como-string e do GRANT ausente que já morderam o projeto duas
vezes. Corrigido: `/compromisso` saiu desse bloco (mesma posição de
`/despesas`, que nunca esteve nele), comentários do MAPA reescritos
explicando o motivo. **Linha do `po` sobre o diff final** (registrada
nesta rodada de Gate 4, por instrução do orquestrador, dado que o
retrabalho não toca código de produto): conferido por `git diff --
e2e/campos-fiscais.spec.ts` que a mudança é exclusivamente comentários +
a remoção de uma linha de um array de rotas de teste — nenhuma linha de
`app/`, `lib/` ou migration foi tocada nesse retrabalho, e a classificação
fiscal da rota (`semCamposFiscais`) não mudou. O comportamento revisado e
aprovado pelo `cto-obra` no Gate 2 (a lógica de filtro/busca em si)
permanece idêntico ao que foi aprovado.

**Testes**: `npm run typecheck` limpo; `npx vitest run` 1332/1332;
`npx playwright test e2e/compromisso.spec.ts e2e/campos-fiscais.spec.ts`
46/47 (a falha restante, `/adicionar/pagamento — nenhum campo nasce
preenchido`, é timeout intermitente não relacionado ao ticket — confirmado
passando isolado na sequência). Sem migration.
