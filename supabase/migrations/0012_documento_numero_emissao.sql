-- CONTAI-004 — número e data de emissão do documento.
--
-- Fonte normativa: docs/pareceres/2026-08-16-gate-fiscal-contai-004-005.md,
-- PARTE 1 (§1 "a regra em se X e Y → Z", §3 "data de emissão × data de
-- pagamento", ressalvas R1-R5). Nada aqui é inferido.
--
-- ── O que cada coluna governa (§3 do parecer, literal) ──────────────────
--
--   `data_emissao` governa a IDENTIFICAÇÃO do documento, a JANELA sem CNO
--   (CONTAI-007, critério 8) e a COMPETÊNCIA do serviço para a aferição.
--   Ela **nunca, em nenhuma hipótese, governa o ano do custo** — quem governa
--   é `pagamento.data_pagamento`, regime de caixa (IN SRF 84/2001, art. 17).
--   Nenhum relatório anual é filtrado ou ordenado por `data_emissao`.
--
-- ── Por que NULLABLE, sem default e sem check (R3 + Viabilidade do CTO) ──
--
-- 1. **Sem default.** Default em coluna fiscal é data ou número INVENTADO —
--    o erro que o Gate 2 do CONTAI-003 catalogou no backfill de
--    `data_inicio_obra`: *campo vazio pergunta, campo preenchido afirma*.
--    Proibido `now()`, `created_at`, `data_pagamento`, `''`, `'S/N'`, `'0'`.
-- 2. **Sem `not null` e sem check `tipo <> 'boleto' → numero is not null`.**
--    A obrigatoriedade é "NF sim, boleto não" e mora em `validarDocumento`
--    (lib/fiscal/documento.ts). Um check no banco quebraria a US-005
--    (migração da planilha), onde o registro legado entra com PENDÊNCIA
--    âmbar, não com bloqueio.
-- 3. **`numero` é `text`, nunca numérico** (R2). NFS-e municipal usa
--    numeração própria: zeros à esquerda, letras, barras e pontos fazem parte
--    da identificação. Converter para inteiro destrói a nota. O banco não
--    normaliza, não faz trim e não faz upper — o que foi digitado é o que fica.
-- 4. **`serie` é campo PRÓPRIO, nunca concatenada no número** (R6). "1042/2"
--    digitado no campo do número não é o número da nota: é dois dados grudados,
--    e quem for comparar com o XML em 2034 não tem como separá-los de novo.
--    Opcional e nullable — nem toda NFS-e municipal tem série, e exigir o campo
--    faria o Mateus inventar um valor para o formulário deixá-lo salvar.
-- 5. **Nenhuma unicidade.** Número é único por emitente + série + modelo, não
--    globalmente (§1 do parecer) — e é por isso que as três colunas existem
--    juntas: a comparação de duplicidade da tela usa as três. Duplicidade é
--    AVISO (critério 11), nunca constraint — bloquear no banco recusaria nota
--    legítima de emitente ou série diferente com o mesmo número.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- NÃO. Nenhuma tabela nova, nenhuma sequence, nenhuma view, nenhuma função:
-- duas colunas em tabela que já existe. Privilégio no Postgres é por TABELA
-- (e por coluna, quando concedido assim) — a 0005 concedeu
-- `select, insert, update` em `documento` para `authenticated` sem lista de
-- colunas, e um grant sem lista alcança as colunas futuras. `e2e/
-- privilegios.spec.ts` continua verde sem mudança, e é o certo: não há tabela
-- nova a declarar.
--
-- ── Backfill: PROIBIDO (R3) ─────────────────────────────────────────────
-- Linha existente fica com `null` nas duas colunas e vira pendência ÂMBAR na
-- interface, com o texto do §4 do parecer. O custo dela NÃO está em risco: o
-- documento está no acervo e continua valendo. O que falta é a identificação
-- da nota na discriminação e a presença dela na lista de cobrança do CNO.

alter table documento
  add column numero       text,
  add column serie        text,
  add column data_emissao date,
  add column chave_acesso text;

comment on column documento.numero is
  'Número impresso na nota, LITERAL (R2 do parecer 2026-08-16): zeros à '
  'esquerda, letras, barras e pontos preservados. Nunca convertido para '
  'número, nunca normalizado. Não é único: número é único por emitente + '
  'série + modelo.';

comment on column documento.serie is
  'Série da nota, em campo PRÓPRIO — nunca concatenada no número (R6 do '
  'parecer 2026-08-16). Opcional: nem toda NFS-e municipal tem série, e o '
  'formulário não a exige. Entra na comparação de duplicidade junto com '
  'numero + emitente, porque número é único por emitente + série + modelo.';

comment on column documento.data_emissao is
  'Data de emissão do documento (NF-e: dhEmi, nunca dhSaiEnt). Governa '
  'identificação, janela sem CNO e competência da aferição do INSS. NUNCA '
  'governa o ano-calendário do custo — esse é o da data do pagamento '
  '(regime de caixa). Sem default: data inventada em campo fiscal é pior '
  'do que campo vazio.';

comment on column documento.chave_acesso is
  'Chave de acesso da NF-e (44 dígitos), extraída do DANFE — NUNCA digitada: '
  'digitar 44 dígitos no canteiro é o oposto da meta do produto. Nullable e '
  'opcional: nasce vazia e é preenchida pela US-008 (extração automática) '
  'quando ela existir — este ticket cria a coluna, não cria o trabalho de '
  'preenchê-la. Ela contém CNPJ do emitente, modelo, série, número, UF e '
  'ano-mês de emissão, com DV próprio: valida numero/serie/CNPJ por máquina '
  '(divergência = arquivo suspeito, revisão humana), resolve duplicidade SEM '
  'normalização (R7 — a chave não se importa se o XML devolve 1042 e o DANFE '
  'imprime 000.001.042) e é o que viabiliza a recuperação em lote dos XMLs no '
  'dia em que houver certificado digital. Sem a chave guardada, essa '
  'recuperação não é possível.';

-- Índice do aviso de duplicidade (critério 11 / R7): a consulta é
-- "mesma obra + mesmo número", e o filtro por emitente acontece em cima do
-- punhado de linhas que voltam. `user_id` na frente porque toda leitura passa
-- pela RLS por dono, como nos índices da 0001.
create index idx_documento_numero on documento (user_id, obra_id, numero)
  where numero is not null;
