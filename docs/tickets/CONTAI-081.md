# CONTAI-081 Pré-vínculo compromisso↔nota antes do pagamento (fluxo de cartão)

## Tipo e Prioridade
Feature — **P1** — mesma classe do CONTAI-080: continuação natural da
mesma capacidade, cobrindo a maioria do caso real (6 das 7 parcelas do
fornecedor de concreto eram cartão; o CONTAI-080 só cobriu a 1 em PIX).

## Dor de Origem
Relato: `docs/backlog/96-2026-09-28-pre-vinculo-compromisso-nota-antes-do-pagamento.md`.

Mesmo fornecedor real do CONTAI-074/080 (concreto usinado, 3 notas, 7
parcelas). O CONTAI-080 resolveu a exceção do caso real (a única parcela
PIX); este ticket resolve a regra — as 6 parcelas de cartão continuam sem
poder pré-vincular: `podePreVincular` recusa `origem === "cartao"` com o
texto `PRE_VINCULO_SEM_CARTAO`, apontando explicitamente para este ticket
desde o Gate 2 do CONTAI-080 (achado D2).

## User Story
Como dono da obra, quando eu tiver uma compra no cartão ainda em aberto e
já souber a quais notas fiscais ela vai se referir, quero declarar esse
pré-vínculo antecipadamente — do mesmo jeito que já faço para PIX/boleto —
para não procurar a nota de novo quando a fatura for confirmada.

## Critérios de Aceite
1. [x] `podePreVincular` para de recusar por `origem === "cartao"` — a
   assinatura vira `Pick<Compromisso, "obraId" | "situacao">` (a recusa por
   `situacao !== "aberto"` continua valendo). A constante
   `PRE_VINCULO_SEM_CARTAO` é removida por inteiro, junto com o ramo que a
   usava.
2. [x] O CTA "Ligar notas a este agendamento" e o chip/texto do ADENDO 8
   §L.2 passam a existir em `/compromisso/[id]` para compromissos de
   cartão, usando EXATAMENTE os mesmos componentes visuais do CONTAI-080
   (`design/mocks/CONTAI-080.md` §1.1/§2/§3) — nenhuma variante nova.
3. [x] A tela `/compromisso/[id]/pre-vincular` (já existente, CONTAI-080) é
   reaproveitada sem mudança para compromissos de cartão.
4. [x] Migration nova (`0024`): as RPCs `fatura_desembolso_gravar` e
   `fatura_alocar` ganham o parâmetro `p_propagar_origem_ids uuid[] default
   '{}'` (último parâmetro, aditivo — recriação por `drop`+`create`, mesmo
   precedente da migration `0021`) — a chamada a `propagar_vinculo_de_origem`
   dentro do laço SQL só executa quando `v_compromisso_id = any
   (p_propagar_origem_ids)`. `e2e/privilegios.spec.ts` confirma que o nome
   das funções e os grants não mudam (só a aridade).
5. [x] Nas assinaturas TypeScript (`registrarDesembolsoDeFatura`,
   `alocarPagamentoDeFatura`), o parâmetro correspondente
   (`propagarOrigemIds: string[]`) é OBRIGATÓRIO, sem default — o default
   `'{}'` só existe no banco, para manter a migration aditiva durante a
   janela `db push` → deploy; o app sempre calcula e passa o valor real.
6. [x] Função pura nova `planoDeConversaoDaFatura(compromissos, documentos)`
   em `lib/fiscal/compromisso.ts`, definida em cima de
   `documentosResolvidosNaConfirmacao`/`idsDaUniaoDoPreVinculo` (nenhuma
   segunda definição de N): para cada compromisso da fatura, `N < 2` entra
   em `propagarOrigemIds` (se tiver origem), `N === 1` entra em
   `automaticos` (documento único a vincular sem clique), `N ≥ 2` entra em
   `revalidar` (pendente de confirmação explícita). Testada nos 3 ramos +
   deduplicação origem=pré-vínculo.
7. [x] `/fatura/[id]/confirmar` e `/fatura/[id]/alocar` calculam o plano
   ANTES de chamar a RPC (carregando `painel.documentos` junto dos
   compromissos), passam `propagarOrigemIds`, e — depois da RPC responder —
   chamam `converterPreVinculosDaFatura` (novo em `lib/data.ts`):
   `criarVinculos` com todos os `automaticos` numa chamada só (upsert
   idempotente; se a nota já foi ligada pela RPC via origem, é duplicata
   ignorada, mesma convergência do CONTAI-080).
8. [x] `/fatura/[id]/parcial` passa `propagarOrigemIds: []` (não cria
   pagamento, só redireciona para `/fatura/[id]/alocar` — sem mudança de
   comportamento além do parâmetro novo).
9. [x] Os pagamentos recém-criados pela RPC são identificados por diff
   (`carregarCompromissos` antes e depois da RPC; a diferença de
   `pagamentoIds` por compromisso é o pagamento novo) — não por inferência
   de data/meio.
10. [x] Rota nova `/fatura/[id]/vinculos`: lista, em cards independentes
    (`BlocoRevalidacao`, ordem cronológica pela data da compra), cada
    compromisso da fatura com `N ≥ 2` ainda pendente (pagamento sem nenhum
    vínculo em `pagamento_documento`) — **derivada 100% do estado gravado,
    sem query param na lógica de quais blocos aparecem**: recarregar ou
    voltar mostra só o que falta.
11. [x] Cada `BlocoRevalidacao` tem estado PRÓPRIO (`pronto/gravando/
    confirmado/erro`, nunca compartilhado entre blocos — diferente do
    padrão de `quitacao.tsx`), nasce neutro (nenhum botão pré-marcado ou
    destacado como "Sim"), e grava com **uma chamada `criarVinculos` por
    bloco**, no clique — nunca um envio em lote nem um botão único
    "confirmar tudo". Erro de rede num bloco não afeta os outros. Texto
    exato: `perguntaConfirmarPreVinculos` + botões `PRE_VINCULO_CONFIRMAR`
    ("Sim, confirmar os vínculos") / `PRE_VINCULO_REVISAR` ("Revisar antes
    de confirmar", leva a `/pagamento/[id]/ligar` daquele pagamento
    específico, sem gravar nada).
12. [x] Se o Mateus confirmar alguns blocos e sair sem decidir os demais,
    os confirmados persistem independentemente — ao reabrir a rota, só os
    pendentes reaparecem (condição do Gate Fiscal, não regressão).
13. [x] CTA novo em `/fatura/[id]`: card "{M} compra(s) com vínculo a
    confirmar" (M = pendências desta fatura), visível só quando M > 0,
    levando a `/fatura/[id]/vinculos`.
14. [x] Depois de `/confirmar` ou `/alocar` salvarem, se M > 0 para essa
    fatura, o redirecionamento vai para `/fatura/[id]/vinculos` (com banner
    de transição "Fatura confirmada. Falta só decidir M vínculo(s)...") em
    vez da tela de sucesso normal — que continua intacta para quando M = 0.
15. [x] Quando M chega a zero (por resolução na própria visita, ou por
    chegada direta à rota sem nada pendente), a tela mostra um card
    terminal (mesmo layout, texto distinto pelos dois casos) — sem
    `router.push` automático; sair fica a critério do Mateus.
16. [x] Nenhuma regressão na suíte do CONTAI-080 (`e2e/pre-vinculo.spec.ts`,
    testes de `podePreVincular`/`documentosResolvidosNaConfirmacao`) — a
    mudança em `podePreVincular` é estritamente remoção de restrição para
    cartão, não novo comportamento para PIX/boleto.
17. [x] `compromissosElegiveisParaQuitacao`/`podeQuitar` — grep de
    confirmação (não crítico de código, é checagem) de que a sugestão de
    quitação rápida não interage mal com compromisso de cartão fora do
    fluxo de fatura; se houver sobreposição, registrar como dívida, não
    corrigir aqui.

## Out of Scope
- **Reabrir a doutrina fiscal dos ADENDOS 6/7/8** — valem aqui
  integralmente. Confirmado pelo `contador` (sanity check específico deste
  ticket): agregar várias perguntas de N≥2 numa tela só continua sendo
  confirmação explícita por conjunto, desde que cada bloco seja neutro,
  individual e persistente (critérios 11-12 acima) — não é doutrina nova,
  é a mesma regra aplicada a vários compromissos de uma vez.
- **Rateio automático** — recusado no CONTAI-080, vale igual aqui.
- **Mover a contagem de N para dentro da RPC SQL** — decisão do `cto-obra`:
  toda a lógica fiscal fica em JS puro testável
  (`documentosResolvidosNaConfirmacao`/`planoDeConversaoDaFatura`); a RPC
  só recebe a decisão já tomada (`propagarOrigemIds`).
- **Pré-marcação simétrica em `/documento/[id]/ligar`** — mesma dívida
  nomeada do CONTAI-080, não corrigida aqui também.
- **Aviso não-bloqueante de estouro de soma** — mesma decisão adiada.
- **Corrida entre abas** (dois cliques quase simultâneos no mesmo bloco em
  abas diferentes) — dívida nomeada, não corrigida (mitigação futura:
  reler `pagamento.documentoIds` antes de gravar).

## Gate Fiscal (Contador)
Regras completas nos ADENDOS 6/7/8 de
`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` — **sem Gate
Fiscal novo**: é extensão de superfície técnica da mesma regra, não tese
fiscal nova. Um sanity check específico deste ticket foi respondido: a
tela agregada (`/fatura/[id]/vinculos`) é fiscalmente válida DESDE QUE cada
bloco (1 por compromisso) preserve (a) estado neutro inicial — nenhum
nasce marcado; (b) ação individual e persistente — cada clique grava só
aquele bloco; (c) "Revisar" de um bloco não trava nem confirma os outros;
(d) confirmações parciais persistem — sair no meio não desfaz o que já foi
confirmado. O que violaria a doutrina: qualquer atalho "confirmar tudo"
que produza 2+ conversões com um único ato de vontade do Mateus.

## Pre-mortem
1. **A RPC propaga a origem incondicionalmente hoje** — achado do
   `cto-obra` ao revisar a premissa inicial do Passo 1: sem o parâmetro
   `propagarOrigemIds`, compra de cartão com origem + pré-vínculo (N=2)
   teria a origem gravada ANTES de qualquer clique — o mesmo D1 do Gate 2
   do CONTAI-080, de volta pela porta do cartão. Mitigado pelos critérios
   4-7 (parâmetro obrigatório no TypeScript, calculado sempre a partir do
   plano).
2. **Confirmação em lote mascarando confirmação individual** — se a tela
   agregada usasse um botão único "confirmar tudo", violaria a doutrina do
   §J.3 por uma porta nova. Mitigado pelos critérios 11-12 e pela condição
   do Gate Fiscal.
3. **Divergência entre os 2 entry points reais** (`/confirmar` e
   `/alocar`; `/parcial` só repassa `[]`) — um mecanismo pensado só para um
   deles deixaria pré-vínculo funcionando num caminho e não no outro, para
   a mesma fatura. Mitigado pelo critério 7 aplicar-se aos dois
   simetricamente.

## Viabilidade (CTO)
- **Modelo de dados**: sem tabela nova. Migration `0024` (recriação de
  2 funções existentes com 1 parâmetro a mais, aditivo).
- **Onde a resolução de N roda**: em JS, ANTES da RPC — `
  planoDeConversaoDaFatura` decide o que propagar/automatizar/revalidar; a
  RPC só executa a propagação que já foi autorizada. Nenhuma lógica fiscal
  duplicada em SQL.
- **Arquivos**: `supabase/migrations/0024_fatura_propagar_por_n.sql`
  (novo), `lib/database.types.ts` (regen), `lib/fiscal/compromisso.ts` (+
  `.test.ts` — `planoDeConversaoDaFatura`, `podePreVincular` sem cartão),
  `lib/data.ts` (`registrarDesembolsoDeFatura`/`alocarPagamentoDeFatura`
  com o parâmetro novo obrigatório + `converterPreVinculosDaFatura`),
  `app/(gestao)/fatura/[id]/{confirmar,alocar,parcial}/page.tsx`,
  `app/(gestao)/fatura/[id]/page.tsx` (CTA),
  `app/(gestao)/fatura/[id]/vinculos/page.tsx` (novo),
  `app/_components/bloco-revalidacao.tsx` (novo),
  `app/(gestao)/compromisso/[id]/page.tsx`,
  `app/(gestao)/compromisso/[id]/pre-vincular/page.tsx` (remoção da guarda
  de cartão), `e2e/privilegios.spec.ts` (comentário da aridade nova),
  `e2e/pre-vinculo.spec.ts`, `e2e/cartao.spec.ts`, `design/mocks/CONTAI-081.md`
  (já escrito).
- **Complexidade: M** — menor que o L do CONTAI-080 (sem tabela nova, sem
  editor novo, sem chip/texto fiscal novo). Grosso do esforço: migration
  (~25%), rota `/vinculos` + `BlocoRevalidacao` + CTA (~35%), E2E (~40% —
  N=0/N=1-origem/N=1-só-pré-vínculo/N≥2-com-2-blocos-parciais/bloco-some-
  quando-já-vinculado/`parcial→alocar`).
- **Dívidas criadas**: corrida entre abas (nomeada, não corrigida); janela
  `db push`→deploy (mitigada pela ordem obrigatória do release, já
  doutrina do projeto); `compromissosElegiveisParaQuitacao`/`podeQuitar`
  sem filtro de origem cartão (pré-existente, fora de escopo — grep de
  confirmação no Gate 1, **resultado registrado na seção "Dívidas"
  abaixo**).

## Dívidas

### D-081.1 — a quitação rápida pode contornar a fatura (PRÉ-EXISTENTE)

**O que o grep de confirmação do critério 17 achou** (Gate 1, 2026-09-29;
confirmado correto pelo Gate 2). `compromissosElegiveisParaQuitacao`
(`lib/fiscal/compromisso.ts`) filtra por situação aberta, data prevista não
nula, mesma obra, mesmo favorecido, faixa de valor e janela de datas — e
**não filtra `origem`**. Consequência: uma **compra no cartão** ainda aberta
(cuja `data_prevista` é o vencimento da fatura) pode aparecer como sugestão
de quitação rápida no detalhe de um **pagamento avulso** (PIX/boleto) do
mesmo favorecido, dentro da faixa de valor e da janela de datas. Um toque em
"Sim, quita este agendamento" a quitaria **fora do fluxo da fatura**: o
`tetoDeAlocacaoCentavos`/`compromissosAbertosDaFatura` passariam a não
contá-la mais como aberta, e a compra ficaria ligada a um pagamento que não
saiu daquela fatura.

**Por que não é corrigido aqui**: é anterior ao CONTAI-081 — nasce do
encontro do CONTAI-019 (sugestão de quitação) com o CONTAI-022 (compra no
cartão como `Compromisso` comum), e a régua do ticket é explícita ("se houver
sobreposição, registrar como dívida, não corrigir aqui").

**Por que o CONTAI-081 não agrava**: `app/_components/quitacao.tsx` já passa
`propagarOrigem: idsDaUniaoDoPreVinculo(compromisso).length < 2` (correção do
D1 do Gate 2 do CONTAI-080). Com o pré-vínculo agora disponível para cartão,
uma compra com N≥2 quitada por esse caminho **quita e não converte nada** — a
união inteira espera pré-marcada em `/pagamento/[id]/ligar`. Nenhuma conversão
parcial silenciosa entra por aqui, e há E2E travando esse comportamento
(`e2e/pre-vinculo.spec.ts`, "N≥2 pela SUGESTÃO RÁPIDA").

**Conserto provável** (ticket futuro, do `po`): excluir `origem === "cartao"`
de `compromissosElegiveisParaQuitacao`, ou oferecer a sugestão com o destino
certo ("esta compra se quita pela fatura", como já faz o botão primário de
`/compromisso/[id]`). Decisão de produto, não de implementação.

### D-081.2 — corrida entre abas no mesmo bloco de `/fatura/[id]/vinculos`

Dois cliques quase simultâneos em "Sim, confirmar os vínculos" do MESMO bloco,
em abas diferentes, fazem duas chamadas `criarVinculos` com o mesmo conjunto. O
`upsert` com `ignoreDuplicates` torna a segunda um no-op, então **não há dano
fiscal** — o que pode acontecer é a segunda aba mostrar o bloco que a primeira
já resolveu, até um recarregamento. Nomeada no Out of Scope do ticket, não
corrigida. Mitigação futura: reler `pagamento.documentoIds` antes de gravar.

## Dependências
Bloqueado por: `CONTAI-080` (entregue — reaproveita
`documentosResolvidosNaConfirmacao`, `idsDaUniaoDoPreVinculo`,
`perguntaConfirmarPreVinculos`, `PRE_VINCULO_CONFIRMAR`/`PRE_VINCULO_REVISAR`,
a tela `/compromisso/[id]/pre-vincular` e o chip/texto do compromisso).
Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma — a única pergunta técnica (confirmação agregada) foi ao
`contador` nesta própria rodada do `/tickets-req` e está respondida acima.

## Cenário e checagem final
**Gestão** (confirmar fatura, revisar vínculos — em casa, sentado). Serve
à meta 1 (nenhum pagamento sem documento hábil): fecha a lacuna que o
CONTAI-080 deixou aberta para a maioria real dos pagamentos de obra
(cartão). Sem condição fiscal órfã — a única condição nova (confirmação
agregada) foi validada pelo `contador` nesta rodada, citada acima. Sem UI
que quebre disciplina de campo fiscal (nenhum campo digitável novo).
**Veredito: APROVADO.** Pronto para `/develop`.

✅ **Entregue em 2026-09-30.** Gate 4 (`po`) PASS, 17/17 critérios. Compromisso
de cartão passa a poder pré-vincular nota(s), igual PIX/boleto —
`podePreVincular` perdeu a guarda de origem. Migration `0024` corrige a
propagação incondicional da origem nas RPCs de fatura (o mesmo D1 do
CONTAI-080 reaparecendo pelo cartão, achado do próprio `cto-obra` ao revisar
a premissa do Passo 1): `propagar_vinculo_de_origem` só roda para
compromisso listado em `p_propagar_origem_ids`, calculado em JS por
`planoDeConversaoDaFatura` (em cima de `documentosResolvidosNaConfirmacao`,
sem segunda contagem de N) ANTES de qualquer chamada à RPC. Quando uma
fatura confirma vários compromissos de uma vez, cada um resolve seu
próprio N=0/1/2+; os N≥2 pendentes viram blocos independentes em
`/fatura/[id]/vinculos` (`BlocoRevalidacao`) — cada bloco nasce neutro,
grava com 1 clique próprio, erro isolado, confirmações parciais persistem
se o Mateus sair no meio. Gate Fiscal específico (sanity check do
`contador` no `/tickets-req`): confirmação agregada por fatura é válida
desde que cada bloco preserve essas 4 propriedades — confirmado pelo
próprio código no Gate 2. Gate 2 (`cto-obra`+`contador`) APPROVE de
primeira, com 3 ajustes não-bloqueantes (correção de caminho no backlog;
2 dívidas registradas por escrito — D-081.1 quitação rápida pode sugerir
compra de cartão fora da fatura, pré-existente, não agravada; D-081.2
corrida entre abas, sem dano fiscal; separação de `try` na conversão vs.
redirect). `npm run quality`: 1315 unit + 441 E2E (rodada completa no
Gate 1; Gates 2/4 confirmaram com specs focados para não repetir dois
travamentos de ambiente que aconteceram nesta rodada). Complexidade M.
⚠️ **A migration `0024` ainda não foi publicada** — `npx supabase db push`
precisa rodar ANTES do `git push`.
