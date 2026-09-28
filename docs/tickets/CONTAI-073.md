# CONTAI-073 Corrigir o valor previsto de um agendamento aberto

## Tipo e Prioridade
bug — P1 — lacuna confirmada por `grep` em `lib/data.ts` (zero função de
correção de valor de `compromisso`); fricção de processo real e sem
workaround limpo hoje (cancelar e recriar o agendamento perde a data de
compra e, no cartão, o vínculo com a fatura já formada). Sem impacto fiscal
(Gate Fiscal do `contador` fechado sem condição), então não é P0.

## Dor de Origem
Mateus, registrando compras parceladas no cartão (cada parcela é um
lançamento "à vista" separado, já que o app não aceita "parcelado" como
lançamento único): *"nos pagamentos parcelados coloquei um valor errado e
preciso editar o valor da parcela, mas não é possível aparentemente."*
Existem `mudarDataPrevista`/`mudarDataCompraCartao` (corrigem DATA) e
`corrigirValorDoDocumento` (corrige o valor da NOTA, entidade `documento`),
mas nada equivalente para `compromisso.valor_previsto`.

## User Story
Como Mateus, ao perceber que digitei o valor errado de uma compra no cartão
(ou de um PIX/boleto agendado) ainda não paga, quero corrigir o valor
previsto do compromisso, para que o valor mostrado na Agenda, na fatura e no
formulário de confirmação bata com a realidade antes de eu confirmar o
pagamento.

## Critérios de Aceite
1. [ ] Spec em `design/mocks/CONTAI-073.md` (nível 2) é a referência de
   implementação — fluxo, os 4 estados e os textos exatos já decididos; sem
   gate de aprovação nem HTML (regra vigente desde 2026-09-20).
2. [ ] RPC nova `corrigir_valor_compromisso(p_compromisso_id, p_valor_novo,
   p_motivo)` só executa quando `compromisso.situacao = 'aberto'` — recusa
   com mensagem clara quando `quitado` ou `cancelado`.
3. [ ] A RPC recusa (não grava nada) quando `p_valor_novo` é igual ao
   `valor_previsto` atual — correção que não corrige nada não vira linha.
4. [ ] A RPC recusa quando `p_valor_novo <= 0`.
5. [ ] A RPC recusa quando `p_valor_novo` é menor ou igual à soma dos
   pagamentos já vinculados ao compromisso via `compromisso_pagamento`
   (quitação parcial) — guarda achada pelo `cto-obra`: sem ela,
   `saldoDoCompromisso` (`Math.max(0, previsto − pago)`) zeraria em
   silêncio e o compromisso ficaria `aberto` com saldo zero, estado que o
   app não sabe ler hoje.
6. [ ] A RPC recusa quando `p_motivo` é vazio ou só espaços.
7. [ ] O ato grava, na mesma transação: uma linha em
   `compromisso_valor_historico` (`compromisso_id`, `valor_anterior`,
   `valor_novo`, `motivo`, `registrado_em`) e o `update` de
   `compromisso.valor_previsto` — nunca um sem o outro.
8. [ ] A correção não altera `data_prevista`, `data_compra`,
   `favorecido_id` nem `documento_origem_id` do compromisso.
9. [ ] `compromisso_valor_historico` é tabela NOVA (não reaproveita
   `compromisso_data_historico`, para não inflar o contador de
   "adiamentos" que conta linhas dessa tabela): `revoke all` antes do
   `grant select, insert to authenticated` (sem update/delete — é rastro),
   RLS `dono_*` igual à tabela irmã, índice `(compromisso_id,
   registrado_em)`. `e2e/privilegios.spec.ts` é atualizado com a tabela e a
   função novas.
10. [ ] A função `corrigir_valor_compromisso` recebe `revoke execute from
    public, anon` + `grant execute to authenticated`, mesmo padrão de
    `0013_fatura.sql`.
11. [ ] Tela nova `/compromisso/[id]/valor`: o valor atual aparece em modo
    leitura; o campo de novo valor e o campo de motivo nascem VAZIOS — nenhum
    dos dois nasce preenchido ou sugerido (mesma invariante de projeto de
    "nenhum campo fiscal nasce preenchido", ainda que aqui o campo não seja
    fiscal, a disciplina de não-default se mantém).
12. [ ] O link "Corrigir o valor previsto" aparece no detalhe do compromisso
    (`compromisso/[id]/page.tsx`) só quando `situacao === 'aberto'`.
13. [ ] Acesso direto pela URL a `/compromisso/[id]/valor` quando
    `situacao !== 'aberto'` mostra um banner explicando o motivo e não exibe
    formulário nenhum — nunca tela muda, nunca crash.
14. [ ] Quando o compromisso já tem pagamento parcial vinculado (`pago >
    0`), a tela mostra um banner fixo informando o valor já pago, visível
    antes de qualquer digitação.
15. [ ] Quando o valor digitado é válido e há pagamento parcial, a tela
    mostra a prévia "saldo passa de X para Y".
16. [ ] Validação client-side replica as guardas do banco antes do clique em
    Salvar, com mensagem própria para cada caso: valor não numérico/negativo,
    valor igual ao atual, valor zero, valor menor ou igual ao já pago.
17. [ ] A confirmação antes de gravar é o próprio resumo "de R$ A para R$ B"
    acima do botão Salvar — sem modal separado.
18. [ ] `/fatura/[id]`, `/fatura/[id]/confirmar`, `/fatura/[id]/parcial` e
    `/fatura/[id]/alocar` refletem o valor corrigido na leitura seguinte, sem
    nenhuma ação extra de sincronização (é derivado de `compromisso.valor_previsto`
    a cada leitura, nunca snapshotado) — coberto por teste automatizado.
19. [ ] O detalhe do compromisso ganha um card "Histórico do valor previsto"
    listando cada correção (data, valor anterior → valor novo, motivo), no
    mesmo padrão visual do card já existente de histórico de data.
20. [ ] O contador de "adiamentos" (que conta linhas de
    `compromisso_data_historico`) não muda com correções de valor — as duas
    tabelas de histórico são independentes; teste trava isso explicitamente.
21. [ ] `lib/database.types.ts` regenerado refletindo a RPC e a tabela novas.
22. [ ] `e2e/banco.ts` (`limpar`) apaga `compromisso_valor_historico` antes
    de `compromisso`, mesmo padrão das demais tabelas dependentes.
23. [ ] `npm run quality` verde, incluindo cenários novos de: correção
    simples bem-sucedida; recusa por situação não-aberta; recusa por valor
    igual; recusa por valor zero/negativo; recusa por valor menor ou igual ao
    já pago (cenário com quitação parcial); reflexo automático do valor
    corrigido nas quatro telas de fatura do critério 18.

## Out of Scope
- Corrigir valor de compromisso `quitado` ou `cancelado` — fato consumado,
  mesma disciplina de "nunca reescrever fato consumado".
- Corrigir o valor de um `pagamento` já registrado — entidade diferente,
  não coberta por este ticket (hoje só a NOTA tem correção de valor, via
  `corrigirValorDoDocumento`).
- Sugestão automática do novo valor a partir da nota vinculada
  (`documento_origem_id`) — é entrada declarada pelo Mateus, não leitura de
  PDF.
- Unificar "corrigir data" e "corrigir valor" numa única tela — avaliado e
  recusado pelo `cto-obra`: rotas separadas, mesma disciplina de "uma ação
  por rota" já em uso na entidade `compromisso` (`data/`, `cancelar/`,
  `confirmar/`).
- Qualquer comparação ou alerta entre o valor corrigido e o valor da nota de
  origem (`documento_origem_id`) — não existe hoje regra nenhuma que compare
  os dois; fica nomeado como risco aceito no pre-mortem, não como requisito.
- Gestão de cronograma de obra, orçamento vs. realizado de engenharia,
  comunicação com empreiteiro — fora de escopo do produto.

## Gate Fiscal (Contador)
**Sem impacto fiscal.** `compromisso.valor_previsto` não compõe custo de
aquisição no IRPF (regime de caixa: a chave é `pagamento.data_pagamento`,
que só existe quando o compromisso é quitado) nem a base de aferição INSS —
é previsão pura. Parecer `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`
§1: "compromisso não é custo, e não é custo 'ainda pequeno' — é zero."

Cenário de quitação parcial (compromisso `aberto` com saldo, já tem
`pagamento` vinculado via `compromisso_pagamento`) confirmado como não-fiscal
pelo mesmo parecer, §3: o custo do ano já ficou gravado no `pagamento` no
momento da quitação parcial ("o custo do ano é o pago, não o previsto") —
não deriva de `valor_previsto` e não é reaberto nem alterado por esta
correção. A guarda "valor novo > soma paga" (critério 5) é decisão técnica
do `cto-obra`, não gate fiscal.

## Pre-mortem
1. A guarda "valor_novo > Σ pago" falha numa corrida (duas edições quase
   simultâneas, ou correção acontecendo enquanto uma quitação parcial está
   sendo gravada em outra aba) — mitigado por reconferir a guarda DENTRO da
   transação da RPC (critério 5), não só no client.
2. O motivo em texto livre (sem enum, decisão do `cto-obra` porque nada
   ramifica por categoria hoje) vira, no futuro, algo que alguém queira
   contar ou filtrar por tipo ("quantas correções foram erro de digitação")
   — aceito como risco: se isso acontecer, exige migration nova para
   estruturar o campo, não dá para fazer sem tocar no banco.
3. Compromisso com `documento_origem_id` preenchido: corrigir o valor
   previsto sem nenhuma comparação com o valor da nota de origem pode deixar
   os dois divergindo silenciosamente (ex.: nota de R$ 500, compromisso
   corrigido para R$ 800) — aceito como fora de escopo (confirmado pelo
   `cto-obra`: não existe hoje regra nenhuma que compare os dois), mas é o
   tipo de deriva que só aparece na conciliação real, mais adiante.

## Viabilidade (CTO)
- **Modelo de dados**: só `compromisso.valor_previsto` (update in place) +
  tabela nova `compromisso_valor_historico`. Zero mudança em `pagamento`,
  `documento`, `favorecido`, `obra`, `fatura*`, `compromisso_pagamento`.
- **Forma**: RPC `corrigir_valor_compromisso` (não par insert+update pelo
  client, ao contrário de `mudarDataPrevista`) — a guarda de saldo depende de
  outra tabela (`compromisso_pagamento`) e exige leitura+escrita atômica.
- **Rota**: `/compromisso/[id]/valor`, nova, não unificada com `/data`
  (que já bifurca por cartão/não-cartão e não tem passo de confirmação).
- **Motivo**: `text not null`, sem enum — zero fiscal, nada ramifica pela
  categoria (ao contrário de `motivo_revisao`, que é específico do aparato
  `revisao`/`entidade_revisao` e não se aplica aqui).
- **Arquivos prováveis**: `supabase/migrations/0022_compromisso_valor.sql`;
  `lib/database.types.ts`; `lib/types.ts`
  (`CompromissoValorHistoricoRow`); `lib/data.ts`
  (`corrigirValorPrevisto`/`carregarHistoricoDeValorPrevisto`);
  `lib/fiscal/compromisso.ts` (+ teste, função pura `podeCorrigirValor`);
  `app/(gestao)/compromisso/[id]/valor/page.tsx` (nova);
  `app/(gestao)/compromisso/[id]/page.tsx`; `e2e/privilegios.spec.ts`;
  `e2e/banco.ts`; `e2e/compromisso.spec.ts`; `e2e/cartao.spec.ts`;
  `design/mocks/CONTAI-073.md`.
- **Complexidade: M** — o código em si é S, mas migration + grants +
  regeneração de tipos + dois specs E2E novos é o mesmo padrão de esforço da
  `0013_fatura.sql`.

## Dependências
Bloqueado por / Bloqueia: nenhum.

## Perguntas Abertas
- Nome/forma exata do erro que a RPC devolve quando a guarda de saldo
  (critério 5) recusa a gravação — necessário para a tela distinguir esse
  erro específico ("um pagamento pode ter sido registrado enquanto você
  editava") do erro genérico de gravação. Decisão de implementação do
  `cto-obra`/`lead-engineer` no Gate 2, não bloqueia o desenvolvimento.

## Cenário e checagem final
**Gestão** (em casa, sentado — conciliação/agenda). O "Teste do Canteiro" não
se aplica. 375px não é piso obrigatório (tela de gestão), mas não pode
quebrar — vive no mesmo shell de `/compromisso/[id]/data` e
`/compromisso/[id]/cancelar`, que já rendem bem nessa largura.

**Veredito: APROVADO.** Serve à meta 2 (relatórios anuais prontos): embora
sem impacto fiscal direto, mantém a Agenda e a fatura fiéis à realidade antes
da quitação, evitando que um erro de digitação vire ruído acumulado na
conciliação anual. Sem condição fiscal órfã (Gate Fiscal fechado e citado por
parecer). Sem UI que quebre a disciplina de não-default em campo.

✅ **Entregue em 2026-09-28.** Gate 4 (`po`) PASS. Migration `0022`
(`compromisso_valor_historico` append-only + RPC transacional
`corrigir_valor_compromisso`, 6 guardas incluindo o SQLSTATE customizado
`CT073` para saldo já quitado). Gate 2 técnico (`cto-obra`) teve 1 rodada de
REQUEST CHANGES: a guarda de saldo comparava `p_valor_novo <= v_pago` no
`numeric` cru, e um valor como `6000.004` passava pela guarda mas arredondava
para `6000.00` ao gravar (`numeric(14,2)`) — landing exatamente no saldo zero
que a guarda existe para impedir. Achado por teste direto via `psql` (savepoint
+ rollback, nada persistido). Corrigido normalizando `v_novo :=
round(p_valor_novo, 2)` logo após o null-check, usado em todas as
comparações/insert/update; 2 casos de fronteira novos em
`e2e/compromisso.spec.ts` (`6000` exato, `6000.004` o buraco). Reverificado,
APPROVE. 1214/1214 Vitest, 72/72 E2E dos specs escopados
(`compromisso`/`cartao`/`privilegios`/`campos-fiscais`). Sem dívida nova.
⚠️ **A migration `0022` ainda não foi publicada** — `npx supabase db push`
precisa rodar ANTES do `git push`.
