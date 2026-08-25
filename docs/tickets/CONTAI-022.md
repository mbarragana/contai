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
2. [ ] Compra no cartão nasce `compromisso` com `origem='cartao'`, nunca
       `pagamento` — mesmo com data de compra passada. "Data ≤ hoje →
       pagamento" não vale para cartão
       (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` §B).
3. [ ] **`data_prevista` (vencimento da fatura) é obrigatória na criação com
       `origem='cartao'`** — sem ela, a compra nunca vence e nunca bloqueia
       relatório anual (`ehVencidoSemResposta` retorna `false` para
       `dataPrevista === null` por design do CONTAI-019; achado do
       `cto-obra`, guarda em app + teste unitário nomeado, não CHECK de
       banco — `data_prevista` nula continua legítima no saldo de quitação
       parcial, §D do mesmo parecer).
4. [ ] `data_compra` obrigatória quando `origem='cartao'` (CHECK no banco —
       hoje não existe linha com essa origem, valor é inalcançável) e nunca
       decide ano-calendário — só `data_pagamento` decide.
5. [ ] Favorecido de compra no cartão é sempre o lojista/prestador — a tela
       nunca oferece a administradora do cartão ou o banco como opção
       (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`, adendo
       18/08 §1).
6. [ ] Confirmar fatura paga **integralmente** gera N pagamentos (um por
       compra), cada um com `data_pagamento` = data do pagamento da fatura,
       favorecido/valor da respectiva compra. E2E: fatura com 3 compras paga
       em 10/01 → 3 pagamentos com `data_pagamento = 10/01`.
7. [ ] Fatura cruzando o ano-calendário: custo vai para o ano do PAGAMENTO da
       fatura, nunca da compra. E2E: compra em 20/12/2026, fatura paga em
       10/01/2027 → soma R$ 0,00 em 2026, entra na discriminação de 2027.
8. [ ] Encargos do cartão (juros de rotativo, IOF, anuidade, multa) nunca
       compõem custo de aquisição de compra nenhuma.
9. [ ] **Fatura paga parcialmente**: o pagamento parcial em si é **sempre
       gravado** (fato consumado, nunca recusado) em `fatura_desembolso` —
       mas nenhuma compra é marcada paga automaticamente por ele. Fica
       pendente de alocação manual explícita (tela própria, mock s7) — o
       sistema nunca escolhe sozinho quais compras aquele valor cobriu, nunca
       cria pagamento por estimativa/proporção.
10. [ ] Comprovante da fatura é **um único anexo**, compartilhado pelas N
        compras que ela cobre (`comprovante_path` copiado para os N
        pagamentos gerados) — não um anexo por compra
        (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`, ADENDO
        2 §5 linha Cartão + §7).
11. [ ] Compra parcelada é **recusada** na entrada, bloqueio síncrono, com
        mensagem que nomeia o caminho certo ("lance cada parcela separada, o
        valor da parcela, na fatura em que ela vence") — não é revisão
        humana pós-registro, o registro não se completa
        (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` §B).
        Texto final da recusa carimbado pelo `contador` no Gate 2 (a regra
        está fixada, a frase é provisória do mock).
12. [ ] A recusa total de `meio=cartao` do `CONTAI-019` (critérios 25-27,
        `RECUSA_CARTAO`) sai de cena, substituída por este fluxo inteiro.
13. [ ] Toda discriminação anual com custo originado de cartão exibe a
        ressalva da Q4 — **aviso incondicional, nunca bloqueio**: a tese de
        atribuir custo ao ano do pagamento da fatura exige confirmação de
        contador humano (CRC) antes da primeira declaração que a use, mas não
        impede o app de gerar ou mostrar o relatório
        (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` §B).
14. [ ] **Teste nomeado**: um `compromisso` com `origem='cartao'` vencido
        bloqueia as três saídas anuais (`podeGerarRelatorioAnual`) igual a
        qualquer outro meio — não existe hoje (a suíte só cobre boleto/PIX
        contra bloqueio; os únicos testes com `cartao` são os de recusa que
        este ticket substitui). Trava o refactor futuro que faria "cartão não
        bloquear porque a fatura ainda não fechou".
15. [ ] Migration `0013_fatura.sql` — tabelas `fatura`, `fatura_compromisso`
        (PK em `compromisso_id`, uma compra pertence a no máximo uma fatura),
        `fatura_desembolso`. REVOKE antes de GRANT, RLS por dono derivado da
        linha-pai, sem DELETE (acervo append-only). `e2e/privilegios.spec.ts`
        atualizado no mesmo diff.
16. [ ] **Guarda-chuva de default fiscal** (cobre todos os campos novos —
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
- **Modelo de dados**: migration nova, 3 tabelas — `fatura` (agrupa compras
  de um ciclo, guarda o `comprovante_path` do pagamento), `fatura_compromisso`
  (vínculo, PK em `compromisso_id`), `fatura_desembolso` (cada pagamento
  feito à fatura, integral ou parcial — fato consumado, nunca custo, nunca
  `pagamento`). A migration `0007` **já reservou** `origem='cartao'` no enum
  de `compromisso` e a coluna `data_compra`, com comentário citando este
  ticket — confirmado que compra-no-cartão nasce na mesma tabela
  `compromisso` já em produção, não em tabela paralela (condição do gate
  fiscal para a trava de vencido continuar valendo).
- **Arquivos prováveis**: `supabase/migrations/0013_fatura.sql` ·
  `lib/fiscal/compromisso.ts` (branch cartão + recusa parcelada) ·
  `lib/fiscal/fatura.ts` + `.test.ts` (novos) ·
  `lib/fiscal/compromisso.test.ts` (reescreve 25-27) · `lib/database.types.ts`
  · `lib/dados/` (ato N-pagamentos atômico, mesma família da migration 0011)
  · telas em `app/` conforme mock · `e2e/privilegios.spec.ts` + spec E2E novo.
- **Complexidade: L** — o maior ticket da fila ativa.
  **Fatiamento sugerido para o Gate 1** (decisão de execução, não de
  escopo): (1) compra nasce compromisso + fim da recusa total + critérios
  2-5, 11, 12, 14; (2) fatura + confirmação integral, critérios 6, 7, 8, 10,
  13, 15; (3) rotativo + alocação manual, critério 9.
- **Dívidas criadas**: `comprovante_path` copiado é denormalização
  deliberada (path nunca muda, storage append-only) — registrar, não é bug.

## Dependências
- **Sequenciado atrás do `CONTAI-032`** — enquanto `meio="pix"` continuar
  pré-selecionado no formulário de pagamento avulso, a `RECUSA_CARTAO` de
  hoje é inalcançável pela inação; não é dependência técnica dura (dá para
  implementar em paralelo), é dependência de efeito.
- Bloqueia: nada identificado.

## Perguntas Abertas
- **Fatura nasce automática no primeiro `fVenc` novo, ou existe cadastro
  prévio de fatura?** (designer, Passo 4) — decisão de fluxo para o
  `cto-obra`/`po` antes do Gate 1, não bloqueia a aprovação do mock.
- Valor pago maior que o previsto da fatura (adiantamento) não foi desenhado
  — confirmar com o `po` se é caso real do Mateus ou se fica fora de escopo.
- Quantos cartões o Mateus usa simultaneamente, com vencimentos diferentes?
  Não bloqueia a história (o modelo por fatura funciona para 1 ou N), mas
  ajuda o `cto-obra` a confirmar que a data de vencimento manual basta para
  agrupar corretamente.

## Cenário e checagem final
**Gestão** (em casa, sentado — conciliação de fatura). Teste do Canteiro não
se aplica: nenhuma das 3 telas é de captura no momento do fato.

**Veredito: APROVADO**, com as 3 Perguntas Abertas acima para resolver antes
ou durante o Gate 1 (nenhuma delas impede a aprovação do mock).
