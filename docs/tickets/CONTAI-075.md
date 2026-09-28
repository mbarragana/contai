# CONTAI-075 Destaque progressivo do agendamento antes de vencer (hoje/amanhã)

## Tipo e Prioridade
Melhoria de exibição/ordenação (lógica de data pura, sem toque em apuração
fiscal) — **P1** — fricção de processo confirmada pelo `po`: não é obrigação
fiscal, evita atraso evitável em pagamento agendado.

## Dor de Origem
Relato: `docs/backlog/92-2026-09-28-destaque-progressivo-agendamento-hoje-amanha.md`.

> "hoje o app só reage a agendamento (...) DEPOIS que ele vence"

`chipDoAgendado` (`lib/fiscal/compromisso.ts:436-450`) trata todo compromisso
aberto igual — mesmo texto "Agendado", mesmo peso visual — do que vence
amanhã ao que vence em 30 dias; só escala no dia seguinte ao vencimento.
Nada no app chama atenção para o pagamento que vence hoje/amanhã antes de
virar atraso — cenário é gestão em casa, com calma, não checagem constante.

## User Story
Como dono da obra revisando a Agenda/Home em casa, quero que um compromisso
que vence hoje ou amanhã se destaque visualmente ANTES de vencer, para agir a
tempo em vez de descobrir o atraso depois.

## Critérios de Aceite
1. [ ] Compromisso aberto com `dataPrevista` = hoje → `chipDoAgendado` retorna
   o estado `"vence_hoje"`, com texto **"Vence hoje"**, distinto de
   `"comum"` (Agendado) e de `"vencido"`.
2. [ ] Compromisso aberto com `dataPrevista` = amanhã (`hojeIso + 1`) →
   estado `"vence_amanha"`, texto **"Vence amanhã"**. O peso visual de
   `vence_hoje` e `vence_amanha` é **o mesmo** (`vazado-forte`) — a
   diferenciação entre os dois é só textual, nunca visual (decisão do
   `designer`, confirmando a recomendação do `cto-obra`: dois pesos
   distintos ficariam indistinguíveis entre si).
3. [ ] Compromisso fora da janela (ex.: daqui a 30 dias) → comportamento
   idêntico ao atual (`"comum"`, sem destaque) — sem regressão.
4. [ ] Ordenação da lista: vencido > vence hoje > vence amanhã > demais por
   data mais próxima. Confirmado pelo `cto-obra` que isso já sai de graça da
   ordenação existente por data crescente entre não-vencidos — este critério
   vira **teste**, não código novo, provando a eleição nos três estados.
5. [ ] Toda tela que hoje exibe o chip do agendamento (`MarcasAgendado` em
   `app/_components/agendado.tsx`, consumida por Home, `/compromisso` e
   `/compromisso/[id]`; e `/despesas` via `agendamentosPorDocumento`, que só
   lê `.chip.texto`) reflete o estado novo a partir do MESMO ponto de
   origem — nenhuma tela recalcula "é hoje/é amanhã" com lógica própria.
6. [ ] Tipo `UrgenciaDoAgendamento = "comum" | "vence_amanha" | "vence_hoje" |
   "vencido"` substitui completamente o campo `forte: boolean` (em
   `AgendamentoDoDocumento` e no retorno de `chipDoAgendado`) e a prop
   `vazado: boolean` do componente `Chip`. Nenhum dos dois sobrevive em
   paralelo "por compatibilidade": `grep -rn '\bforte\b|vazado:' app lib` só
   acha comentário ou a prop nova (`peso`), nunca o boolean antigo.
7. [ ] O mapeamento urgência→peso visual usa um `Record<UrgenciaDoAgendamento,
   PesoChip>` exaustivo (não comparação de string solta) — um valor novo na
   union sem entrada no `Record` não compila.
8. [ ] `Chip` ganha a prop `peso: "vazado" | "vazado-forte" | "preenchido"`
   no lugar do boolean `vazado` — 3 pesos no componente para os 4 valores de
   urgência (comum→vazado, vence_hoje/vence_amanha→vazado-forte,
   vencido→preenchido).
9. [ ] `AgendamentoDoDocumento.vencidoSemResposta: boolean` continua
   existindo, separado de `urgencia` — invariante testado:
   `vencidoSemResposta === (urgencia === "vencido")` nos 4 casos.
10. [ ] Fonte única de "hoje": os estados novos usam `diasEntre(hojeIso,
    dataPrevista) === 0 | 1`, reaproveitando o MESMO `hojeIso` já recebido
    por `ehVencidoSemResposta` — nenhuma segunda derivação de data
    (`new Date()` novo) em `lib/fiscal/*`.
11. [ ] Dentro de `chipDoAgendado`, a checagem de `vencido` acontece ANTES da
    checagem de `vence_hoje` — guarda textual/de código contra inversão
    futura da garantia de `ehVencidoSemResposta` num refactor.
12. [ ] `data-urgencia="<valor da união>"` presente no `<span>` do `<Chip>`,
    selecionável por E2E nas telas de Home, `/compromisso` e `/despesas`.
13. [ ] Nenhum dos dois estados novos ganha `Consequencia` nem texto que
    prometa bloqueio de relatório anual — isso continua exclusivo do
    estado `"vencido"` (condição do Gate Fiscal, item abaixo).
14. [ ] Nenhum estado novo introduz matiz de cor diferente (vermelho/verde) —
    escala só por peso (vazado → vazado-forte → preenchido), mesma doutrina
    já confirmada no `CONTAI-072`.

## Out of Scope
- Notificação push, e-mail ou integração com Google Calendar — é a opção (a)
  do relato original, descartada nesta rodada (item de stack do `CLAUDE.md`
  segue não implementado).
- Qualquer novo campo ou regra de apuração fiscal.
- Janelas configuráveis de "vence em N dias" — fechado em 2 graus fixos
  (hoje/amanhã), decisão do `po` mantida pelos passos seguintes.

## Gate Fiscal (Contador)
**Sem impacto fiscal**, com 1 condição de implementação (não é regra de
apuração, é hierarquia visual): os estados novos usam peso **estritamente
menor** que o do vencido, e nenhum texto novo promete consequência de
bloqueio — isso é exclusivo do `"vencido"`, cujo gate (`ehVencidoSemResposta`)
decide sozinho o bloqueio de relatório anual (parecer
`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`) e não muda
neste ticket. Confirmado: "vence hoje"/"vence amanhã" existem só para
`dataPrevista` no futuro ou hoje, nunca depois do vencimento — não competem
nem adiam essa fronteira.

## Pre-mortem
1. **Consumidor esquecido lê o campo antigo em vez do novo**: mitigado pelo
   critério 6 (o campo antigo não sobrevive, o TypeScript recusa compilar).
2. **Degrau visual sutil demais, ninguém percebe na tela real**: mitigado
   pelo `designer` tornar o TEXTO o canal primário ("Vence hoje"/"Vence
   amanhã"), não só o peso — mesmo com peso único compartilhado, a leitura
   não depende só da borda.
3. **Duas fontes de "hoje" divergem por fuso horário**: mitigado pelo
   critério 10 (mesma `hojeIso` de `ehVencidoSemResposta`, sem segunda
   derivação).

## Viabilidade (CTO)
- **Modelo de dados**: zero impacto. Lógica pura sobre `dataPrevista` +
  `situacao`, já existentes. Sem migration, sem GRANT, `privilegios.spec.ts`
  intocado.
- **Consumidores reais mapeados** (grep confirmado, corrigindo o relato):
  `chipDoAgendado` → `app/_components/agendado.tsx:72` (`MarcasAgendado`) e
  `lib/fiscal/compromisso.ts:624` (`marcaDoAgendamento`, não exportada,
  única chamadora de `agendamentosPorDocumento`). `AgendamentoDoDocumento` →
  `app/(gestao)/page.tsx` (lê `.forte`/`.chip`, vira `.urgencia`/`.chip`) e
  `lib/fiscal/despesas.ts` (só lê `.chip.texto`, texto novo chega de graça).
  `app/(gestao)/compromisso/page.tsx` é consumidor indireto via
  `MarcasAgendado`, nada a mudar lá. **`app/_components/gestao.tsx` NÃO
  consome nada disso** (só importa `hojeIso`) — candidato do relato estava
  errado.
- **`porPrioridadeDoAgendamento` e `montarAgendaDaHome` NÃO mudam**:
  não-vencidos já saem ordenados por `porDataPrevista` crescente, que já
  produz hoje < amanhã < demais. O critério 4 vira teste, não código novo.
- **Arquivos**: `lib/fiscal/compromisso.ts` (tipo `UrgenciaDoAgendamento`,
  `chipDoAgendado`, `AgendamentoDoDocumento`, `marcaDoAgendamento`),
  `lib/fiscal/compromisso.test.ts` (fronteiras hoje-1/hoje/hoje+1/hoje+2,
  invariante do critério 9, eleição hoje×amanhã×vencido),
  `app/_components/ui.tsx` (`Chip.peso`), `app/_components/agendado.tsx`
  (`pesoDoChip` via `Record` exaustivo + `data-urgencia`),
  `app/(gestao)/page.tsx:243`. `lib/fiscal/despesas.ts` sem mudança
  funcional (só herda o texto). E2E novos em `e2e/compromisso.spec.ts` e
  `e2e/vinculo.spec.ts` (painel de notas sem pagamento em `/despesas`).
  `design/mocks/CONTAI-075.md` já escrito pelo `designer`.
- **Complexidade: S**.
- **Dívidas criadas**: nenhuma nova. Herdada e nomeada (não nova, já
  existia): chip não atualiza sozinho sem reload da página (relógio do
  cliente, mesma premissa de `hojeIso()` em outras telas).

## Dependências
Bloqueado por / Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma pendente de resposta do Mateus — o time discutiu e resolveu as 3
perguntas do relato original nesta própria rodada (janelas fixadas em 2 graus
textuais/1 peso visual; escopo de telas mapeado e confirmado; régua de cor
decidida pelo `designer` respeitando a condição do `contador`), com
autorização prévia do Mateus para decidir sem esperar aprovação dele.

## Cenário e checagem final
**Gestão** (Home/Agenda/`/compromisso`/`/despesas`, em casa, sentado — o
"Teste do Canteiro" não se aplica). Serve à meta 2 indiretamente (relatórios
anuais prontos: reduz a chance de o Mateus deixar um agendamento virar atraso
por não percebê-lo a tempo). Sem condição fiscal órfã (Gate Fiscal fechado,
sem parecer novo — condição de hierarquia visual citada acima). Sem UI que
quebre disciplina de campo fiscal (não há campo digitável — estado é
derivado). **Veredito: APROVADO.** Pronto para `/develop`.

✅ **Entregue em 2026-09-28.** Gate 4 (`po`) PASS, 14/14 critérios. `Chip`
trocou `vazado: boolean` por `peso: "vazado" | "vazado-forte" |
"preenchido"`; `AgendamentoDoDocumento`/`chipDoAgendado` trocaram `forte:
boolean` pela união `UrgenciaDoAgendamento` ("comum"/"vence_amanha"/
"vence_hoje"/"vencido"), mapeada por `Record` exaustivo em `pesoDoChip`
(`app/_components/agendado.tsx`) — `grep -rn '\bforte\b|vazado:' app lib`
confirma que nenhum dos dois booleanos sobrevive. Vence hoje/amanhã
compartilham UM peso visual (`vazado-forte`); a diferença é só textual
("Vence hoje"/"Vence amanhã"), decisão do `designer` confirmada pelo Gate 2
para não abrir dois níveis quase indistinguíveis. Guarda `situacao ===
"aberto"` impede um compromisso já quitado dizer "Vence hoje" (achado do
lead-engineer, ratificado no Gate 2 como correção, não invenção). Gate 2
(`cto-obra`+`contador`) APPROVE de primeira, com 2 ajustes não-bloqueantes
aplicados no mesmo commit (tipagem de `resto` no `Chip` para não descartar
`className` em silêncio; frase do mock corrigida para o contrato real
`{texto, urgencia}`, sem `peso`). Sem migration. `npm run quality` completo:
1236 unit + 400 E2E verdes. Sem dívida nova.
