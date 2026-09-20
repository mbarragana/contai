# CONTAI-022 Cartão de crédito (compra → fatura → pagamento)

## Tipo e Prioridade
feature — **P0 fiscal** — item mais velho em aberto do projeto (reservado em
18/08). Hoje uma compra no cartão não fica sem registro — fica **registrada
errado**, como PIX, na data da compra (efeito do default que o `CONTAI-032`
remove em paralelo). Meta 1 falhando por dentro (custo falso no acervo) e
meta 2 em risco (ano-calendário errado, se o registro-fantasma compuser custo
confirmado).

## Dor de Origem
**D26** (`docs/backlog/08-2026-08-17-incidente-producao-e-fila-vigente.md`):

> *"Compra no cartão de crédito não tem onde morar, e o app finge que o
> problema é outro. [...] `meio = cartao` está recusado na entrada desde o
> CONTAI-001. O bloqueio, por acaso, está certo: pelo adendo §B a compra
> nasce compromisso, e o custo é do ano em que a fatura é paga, não da
> compra. Mas hoje o efeito é que essas compras não são registradas em lugar
> nenhum — é a meta 1 falhando pelo lado de fora."*

Reforço, correção do diagnóstico (`docs/backlog/22-2026-08-23-adendo-a-setima-revisao.md`):

> *"O parecer mostrou que essa frase é falsa hoje: com `meio = 'pix'`
> pré-selecionado, a compra no cartão é registrada — como PIX, na data da
> compra. Isso não rebaixa o 022; muda o que ele conserta."*

## User Story
Como dono da obra que gerencia o caixa em casa, sentado (cenário principal —
gestão), quero registrar uma compra no cartão como compromisso vinculado à
fatura em que ela vai cair, e depois confirmar o pagamento dessa fatura
gerando um pagamento por compra, para que o custo entre no ano-calendário
certo (o do pagamento da fatura) e a discriminação anual nunca herde um
registro que hoje nasce como PIX por default.

## Critérios de Aceite

1. [x] **Proposta nível 1 em `design/mocks/CONTAI-022.md` (+ `.html`, 11
       telas) aprovada pelo Mateus.** Mock aprovado em 2026-08-24.
2. [x] Compra no cartão nasce `compromisso` com `origem='cartao'`, nunca
       `pagamento` — mesmo com data de compra passada. "Data ≤ hoje →
       pagamento" não vale para cartão
       (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` §B).
3. [x] **`data_prevista` (vencimento da fatura) é obrigatória na criação com
       `origem='cartao'`** — sem ela, a compra nunca vence e nunca bloqueia
       relatório anual (`ehVencidoSemResposta` retorna `false` para
       `dataPrevista === null` por design do CONTAI-019; achado do
       `cto-obra`, guarda em app + teste unitário nomeado, não CHECK de
       banco — `data_prevista` nula continua legítima no saldo de quitação
       parcial, §D do mesmo parecer).
4. [x] `data_compra` obrigatória quando `origem='cartao'` (CHECK no banco —
       hoje não existe linha com essa origem, valor é inalcançável) e nunca
       decide ano-calendário — só `data_pagamento` decide.
5. [x] Favorecido de compra no cartão é sempre o lojista/prestador — a tela
       nunca oferece a administradora do cartão ou o banco como opção
       (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`, adendo
       18/08 §1).
6. [x] Confirmar fatura paga **integralmente** gera N pagamentos (um por
       compra), cada um com `data_pagamento` = data do pagamento da fatura,
       favorecido/valor da respectiva compra. E2E: fatura com 3 compras paga
       em 10/01 → 3 pagamentos com `data_pagamento = 10/01`.
7. [x] Fatura cruzando o ano-calendário: custo vai para o ano do PAGAMENTO da
       fatura, nunca da compra. E2E: compra em 20/12/2026, fatura paga em
       10/01/2027 → soma R$ 0,00 em 2026, entra na discriminação de 2027.
8. [x] Encargos do cartão (juros de rotativo, IOF, anuidade, multa) nunca
       compõem custo de aquisição de compra nenhuma.
9. [x] **Fatura paga parcialmente**: o pagamento parcial em si é **sempre
       gravado** (fato consumado, nunca recusado) em `fatura_desembolso` —
       mas nenhuma compra é marcada paga automaticamente por ele. Fica
       pendente de alocação manual explícita (tela própria, mock s7) — o
       sistema nunca escolhe sozinho quais compras aquele valor cobriu, nunca
       cria pagamento por estimativa/proporção.
10. [x] Comprovante da fatura é **um único anexo**, compartilhado pelas N
        compras que ela cobre (`comprovante_path` copiado para os N
        pagamentos gerados) — não um anexo por compra
        (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`, ADENDO
        2 §5 linha Cartão + §7).
11. [x] Compra parcelada é **recusada** na entrada, bloqueio síncrono, com o
        texto literal definitivo do `contador` (ADENDO 5 §I.1 do parecer
        2026-08-18): *"Compra parcelada não é aceita aqui. Cada parcela cai
        numa fatura diferente, e o ano do custo é o da fatura em que ela é
        paga — não o da compra. Lance cada parcela como uma compra separada,
        pelo valor dela, na fatura em que ela vence. Não lance o valor total
        numa fatura só: isso muda o ano de custo das parcelas seguintes."*
        `parc` é campo explícito respondido pelo Mateus (à vista/parcelado,
        sem default) — nunca detecção automática por heurística de valor.
12. [x] A recusa total de `meio=cartao` do `CONTAI-019` (critérios 25-27,
        `RECUSA_CARTAO`/`RECUSA_CARTAO_ONDE_REGISTRAR`, hoje em
        `lib/fiscal/compromisso.ts:93-105`) sai de cena por completo —
        confirmado pelo contador, zero casos remanescentes. Os dois motivos de
        recusa em `meio=cartao` que sobrevivem não são "cartão": campo
        obrigatório vazio (recusa de formulário comum) e `parc=parcelado`
        (critério 11, mensagem própria — nunca reaproveitar o texto do 019).
13. [x] Toda discriminação anual com custo originado de cartão exibe a
        ressalva da Q4 — **aviso incondicional, nunca bloqueio**: a tese de
        atribuir custo ao ano do pagamento da fatura exige confirmação de
        contador humano (CRC) antes da primeira declaração que a use, mas não
        impede o app de gerar ou mostrar o relatório
        (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` §B).
14. [x] **Teste nomeado**: um `compromisso` com `origem='cartao'` vencido
        bloqueia as três saídas anuais (`podeGerarRelatorioAnual`) igual a
        qualquer outro meio — não existe hoje (a suíte só cobre boleto/PIX
        contra bloqueio; os únicos testes com `cartao` são os de recusa que
        este ticket substitui). Trava o refactor futuro que faria "cartão não
        bloquear porque a fatura ainda não fechou".
15. [x] Migration `0013_fatura.sql` — tabelas `fatura`, `fatura_compromisso`
        (PK em `compromisso_id`, uma compra pertence a no máximo uma fatura),
        `fatura_desembolso`. REVOKE antes de GRANT, RLS por dono derivado da
        linha-pai, sem DELETE (acervo append-only). `e2e/privilegios.spec.ts`
        atualizado no mesmo diff.
16. [x] **Guarda-chuva de default fiscal** (cobre todos os campos novos —
        `parc`, `fValor`, `fCompra`, `fVenc`, `fFaturaData`, `fParcData`,
        `fParcValor`, seleção de compras na alocação): nenhum nasce
        preenchido, nenhum grava com valor implícito/herdado de outro campo,
        nenhuma tela grava com um desses campos ausente silenciosamente
        preenchido pelo sistema.

## Out of Scope
- **Compra parcelada** — recusada na v1 (critério 11); modelagem completa
  (1 compra → N compromissos, um por parcela) fica para ticket futuro se o
  Mateus vier a parcelar compras da obra.
- **Múltiplos cartões/bandeiras como entidade própria** — o favorecido é
  sempre o lojista, a identidade do cartão não muda número nenhum de saída.
- **Estorno/cancelamento de compra (chargeback)** — sem regra fiscal
  definida no parecer, não entra aqui.
- **Extração automática de fatura (XML/PDF)** — é US-008/fase 2.
- **Desfazer alocação de rotativo** — sem tela nesta v1, mesmo estatuto do
  "desfazer quitação" do `CONTAI-019` (ticket futuro com parecer).
- Cronograma de obra, orçamento de engenharia, comunicação com empreiteiro.

## Gate Fiscal (Contador) — FECHADO
Pareceres: `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`
(corpo §1-§5, ADENDO §B cartão, ADENDO 2 §1-§7 comprovante, ADENDO 3
§G.1-G.2 vocabulário/formato de data).

**Verbo exato por condição**:
- Compra parcelada → **RECUSA** síncrona (registro não se completa).
- Fatura paga parcialmente → o pagamento parcial em si **nunca é recusado**
  (fato consumado); a alocação por compra é **revisão humana** obrigatória
  (nenhuma alocação automática/por estimativa).
- Ressalva de custo-de-cartão na discriminação anual → **AVISO**
  incondicional, não bloqueia geração nenhuma (distinto do bloqueio de
  compromisso vencido, que é do `podeGerarRelatorioAnual`, já existente e
  intocado por este ticket).

**Achado do Gate Fiscal, não coberto por critério numerado — risco
residual aceito conscientemente**: nada no schema impede o Mateus de
registrar uma compra parcelada como uma única compra "à vista" pelo valor
total, atrelada à fatura da primeira parcela — isso não infla o custo total,
mas erra o ano de reconhecimento de parte dele. A defesa é o texto da recusa
(critério 11) nomeando o caminho certo, e a ressalva de CRC (critério 13)
como backstop de revisão pré-declaração — nenhum critério técnico adicional
é exigido para o Gate 1.

**Automático vs. revisão humana**: criação de compromisso, geração dos N
pagamentos na confirmação integral, e o bloqueio de vencido — automáticos.
Alocação de pagamento parcial entre compras — sempre revisão humana.

## Pre-mortem
1. **Parcelado entra pela porta lateral** — se a extração automática (futura,
   US-008) ou um contorno manual não passarem pelo mesmo ponto de recusa, o
   gasto parcelado volta a ser N compras à vista independentes.
2. **Fatura parcial é lida como fatura total por atalho de implementação** —
   se a tela assumir "valor informado = fatura inteira", pode gerar N
   pagamentos automáticos sobre compras cuja fatura não fechou de fato.
   Guarda: critério 9, tela de alocação própria (mock s6/s7).
3. **O comprovante compartilhado é modelado como anexo de uma compra só**,
   repetindo a anomalia já registrada como D37 em `terreno_desembolso`.
   Guarda: critério 10, `comprovante_path` copiado para os N pagamentos.

## Viabilidade (CTO)
- **Modelo de dados** (revisado após consulta do `cto-obra`, 2026-09-19):
  migration nova, 3 tabelas. `fatura` com chave natural
  `unique(obra_id, data_vencimento)` — **sem** `favorecido_id`, **sem**
  `comprovante_path` (isso mudou de lugar, ver abaixo). `fatura_compromisso`
  (vínculo N:1, sem `user_id` próprio — dono derivado, mesmo molde de
  `compromisso_pagamento`). `fatura_desembolso` — cada pagamento FEITO À
  FATURA (integral ou parcial), com **seu próprio** `comprovante_path`: com
  N desembolsos parciais cada um tem o comprovante dele; uma coluna única em
  `fatura` seria a D37 (`terreno_desembolso`) de novo.
- **Fatura nasce automática, sem tela de cadastro** — decisão do `cto-obra`,
  resolvendo a Pergunta Aberta 1: tela de cadastro criaria pré-requisito que
  o Mateus teria de lembrar de cumprir antes de registrar a compra (mesmo
  atrito que gerou a D26 original). Agrupamento é por **data exata** de
  vencimento, nunca por "mesmo ciclo"/janela de dias — janela seria o
  sistema escolhendo a fatura por heurística, default fiscal disfarçado
  (proibido pelo critério 16). Duas datas diferentes = duas faturas; o
  conserto de um vencimento digitado errado é "Mudou a data", não uma janela
  mágica. **Sem coluna `fatura_id` em `compromisso`** — o vínculo mora só em
  `fatura_compromisso`, mesmo argumento da 0007 para `pagamento` não ganhar
  coluna de previsão.
- **Uma função Postgres transacional por ato**, mesma família de
  `terreno_desembolso_gravar` (0010)/`corrigir_documento` (0009) —
  `security invoker`, `set search_path = public, pg_temp`, revoke de
  `public`/`anon` + grant só a `authenticated`:
  - `compra_cartao_gravar(...)`: insert `compromisso` (`origem='cartao'`,
    `data_prevista = fVenc`, `data_compra = fCompra`) + upsert `fatura`
    (`on conflict (obra_id, data_vencimento) do nothing`) + insert
    `fatura_compromisso`, na mesma transação.
  - Confirmar fatura **integral**: insert `fatura_desembolso` (valor = Σ
    compras abertas da fatura, comprovante) + N `criarPagamento` + N
    `compromisso_pagamento` + N `update compromisso set situacao='quitado'`
    — mesmo modelo de dados do parcial (integral = desembolso que já nasce
    com 100% alocado), matando o pre-mortem 2 pela estrutura, não por
    disciplina de tela.
  - Confirmar fatura **parcial**: insert `fatura_desembolso` só (valor
    sempre gravado, fato consumado — critério 9), sem alocação automática.
  - Alocação manual: N `criarPagamento` + N `compromisso_pagamento` + N
    `situacao='quitado'` **apenas para as compras marcadas** — alocação é
    sempre binária (compra inteira ou nada; não existe "meio alocada" — isso
    seria pagamento por proporção, proibido pelo critério 9).
- **"Mudou a data" em compromisso `origem='cartao'` re-aloca a fatura**: a
  mesma função de mudança de data faz upsert da fatura do novo vencimento e
  `update fatura_compromisso set fatura_id`. **Bloqueada** (recusa síncrona,
  mensagem própria) se a compra já foi quitada (tem pagamento gerado) —
  mover compra paga reescreveria fato consumado.
- **"Registrar o pagamento" do ciclo CONTAI-019, em compromisso
  `origem='cartao'`, redireciona para o detalhe da fatura — nunca para
  `/compromisso/[id]/confirmar`.** Sem essa guarda, a compra seria quitada
  com a data da COMPRA (exatamente o erro que este ticket existe para
  consertar) e o teto de alocação contaria um pagamento que não saiu da
  fatura. `app/compromisso/[id]/page.tsx` precisa da guarda.
- **s7v (alocação vazia) é alcançável**, confirmado — condição:
  compromissos `aberto` da fatura = 0. Caminho real mais comum: rotativo em
  2+ parcelas onde a última já cobre o que sobrava. Fórmula (derivada, sem
  coluna nova): `teto = Σ fatura_desembolso.valor − Σ pago já alocado`.
  s3 só oferece "Alocar" quando há elegíveis; s7 aberta com zero elegíveis
  mostra s7v sempre, **nunca** decidido por `teto = 0` (isso esconderia
  compras em aberto que ainda bloqueiam o relatório anual).
- **Risco residual aceito, não modelado**: dois cartões com o mesmo
  vencimento colapsam na mesma fatura (fiscalmente irrelevante — custo é
  por compra, a fatura não tem favorecido; único efeito é um comprovante
  compartilhado por compras de dois cartões). "Quantos cartões o Mateus usa"
  segue sem resposta no backlog — pergunta de uma linha para ele, não
  bloqueante.
- **Arquivos prováveis**: `supabase/migrations/0013_fatura.sql` ·
  `lib/fiscal/compromisso.ts` (remove `RECUSA_CARTAO`/branch cartão de
  `decidirRegistro`) · `lib/fiscal/fatura.ts` + `.test.ts` (novos) ·
  `lib/fiscal/compromisso.test.ts` (remove critérios 25-27 de cartão) ·
  `lib/database.types.ts` · `lib/data.ts` (RPCs) ·
  `app/adicionar/compra-cartao/page.tsx` (novo, s1/s2) ·
  `app/fatura/[id]/page.tsx` (novo, s3) ·
  `app/fatura/[id]/confirmar/page.tsx` (novo, s4/s5) ·
  `app/fatura/[id]/parcial/page.tsx` (novo, s6) ·
  `app/fatura/[id]/alocar/page.tsx` (novo, s7/s7v/s8) ·
  `app/compromisso/[id]/page.tsx` (guarda de redirecionamento) ·
  `app/adicionar/pagamento/page.tsx` (Cartão redireciona, não recusa) ·
  `e2e/privilegios.spec.ts` + spec E2E novo · `e2e/compromisso.spec.ts`
  (remove teste de recusa de cartão, CONTAI-032).
- **Complexidade: L** — o maior ticket da fila ativa.
  **Fatiamento sugerido para o Gate 1** (decisão de execução, não de
  escopo): (1) compra nasce compromisso + fim da recusa total + critérios
  2-5, 11, 12, 14; (2) fatura + confirmação integral, critérios 6, 7, 8, 10,
  13, 15; (3) rotativo + alocação manual, critério 9.
- **Dívidas criadas**: `comprovante_path` copiado é denormalização
  deliberada (path nunca muda, storage append-only) — registrar, não é bug.
  Gap do mock encontrado pelo `cto-obra`: s7 aberta independente de um
  desembolso recém-criado (não via s6→s7 direto) precisa de um seletor de
  "qual desembolso estou alocando" que o mock não desenhou — ajuste mínimo,
  sem reabrir Gate de Mock (campo sem default, mesmo padrão dos outros).

## Dependências
- **Sequenciado atrás do `CONTAI-032`** — enquanto `meio="pix"` continuar
  pré-selecionado no formulário de pagamento avulso, a `RECUSA_CARTAO` de
  hoje é inalcançável pela inação; não é dependência técnica dura (dá para
  implementar em paralelo), é dependência de efeito.
- Bloqueia: nada identificado.

## Perguntas Abertas
Resolvida em 2026-09-19: fatura nasce automática, sem cadastro prévio (ver
Viabilidade, decisão do `cto-obra`). Residual, não bloqueante: quantos
cartões o Mateus usa simultaneamente, com vencimentos diferentes — pergunta
de uma linha para ele, sem efeito no Gate 1 (dois cartões com o mesmo
vencimento colapsam numa fatura só, risco aceito conscientemente).

## Decisão do `po` — valor pago maior que o previsto da fatura (2026-09-19)

**Fora de escopo deste ticket — por ausência de dor conhecida, não por
confirmação do Mateus.** Nenhum relato dele (`docs/backlog/`) descreve pagar
fatura de cartão a mais do previsto; a hipótese (adiantar parte da próxima
fatura, ou pagar a mais por engano) é do lead-engineer, não do Mateus. Sem
relato, não vira requisito — vira nota de observação.

**Não precisa de tratamento novo porque o mecanismo já existente cobre o caso
sem ajuste**: `fParcValor` é sempre aceito e gravado (fato consumado, critério
9); em s7 cada checkbox trava a seleção no teto do **valor pago**, não do
previsto — se o valor pago excede a soma de todas as compras da fatura, o
Mateus simplesmente seleciona todas (nada estoura o teto) e sobra um resíduo
não alocado. Esse resíduo cai no mesmo estado genérico que s8 já define para
"valor não alocado" ("Não têm destino fiscal afirmado por esta tela — revisão
humana, sem chute do app") — texto escolhido de propósito para não afirmar se
é encargo, erro ou adiantamento de compra futura. Consistente com a barreira
do próprio parecer fiscal (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`,
linha ~712): a tela nunca ancora texto na comparação com o previsto.

**O que fica de fora, nomeadamente**: não existe (e este ticket não cria)
mecanismo de "crédito" que aplique esse resíduo a compras de uma fatura
futura — se isso vier a ser pedido depois de um relato real, é ticket novo,
não um critério deste.

**Nenhum critério de aceite novo neste ticket.** Nenhuma mudança de schema,
tela ou texto é necessária: critério 9 e o desenho de s7/s8 já produzem o
comportamento correto para este caso sem tratamento especial.
  Não bloqueia a história (o modelo por fatura funciona para 1 ou N), mas
  ajuda o `cto-obra` a confirmar que a data de vencimento manual basta para
  agrupar corretamente.

## Cenário e checagem final
**Gestão** (em casa, sentado — conciliação de fatura), exceto o registro da
compra (`/adicionar/compra-cartao`), que é captura — confirmado na
implementação: uma pergunta (parcelado) mais os campos da compra, sem o
repeater nem a densidade das telas de fatura.

**Veredito: APROVADO. Implementado em 2026-09-19** (fatias 1+2+3 do
fatiamento sugerido, numa sessão só — a dependência de efeito do CONTAI-032
já estava resolvida). 16 critérios verificados: 617 testes unitários,
suíte E2E completa (`e2e/cartao.spec.ts`, 10 casos novos + suíte inteira sem
regressão) e teste manual no browser (compra → fatura → confirmação integral
→ home refletindo o pagamento gerado). Migration `0013_fatura.sql` com a
função transacional por ato (`compra_cartao_gravar`,
`compra_cartao_mudar_data`, `fatura_desembolso_gravar`, `fatura_alocar`).

**Recorte de escopo, disclosed**: a tela de alocação manual
(`/fatura/[id]/alocar`) só funciona chegando com `?desembolso=` na URL (o
caminho normal, direto de "Registrar pagamento parcial"). Abri-la
independente, sem esse parâmetro — cto-obra previu esse caso e pediu um
seletor de "qual desembolso estou alocando" que o mock nunca desenhou —
hoje só mostra uma mensagem e devolve para a fatura. Não é crítico (o
caminho principal do rotativo nunca passa por aí), mas é dívida nomeada para
o Gate 2 se o Mateus achar o caso real.
