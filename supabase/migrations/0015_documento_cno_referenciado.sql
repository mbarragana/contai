-- CONTAI-007 — o CNO impresso na NF de serviço.
--
-- Fonte normativa: docs/pareceres/2026-08-09-obra-sem-cno.md (Q8), transcrito
-- no Gate Fiscal de docs/tickets/CONTAI-007.md. Nada aqui é inferido.
--
-- ── Por que DUAS colunas, e não uma ─────────────────────────────────────
--
-- A pergunta do formulário tem três respostas ("é o CNO desta obra" / "é o de
-- outra obra" / "a nota não traz CNO"), mas só DUAS chegam ao banco: o CNO de
-- outra obra é **bloqueio na entrada** (critério 2) — não há linha a gravar,
-- porque não há conserto depois da emissão.
--
-- Sobram, portanto, três estados persistidos, e eles precisam ser distinguíveis
-- em 2034 por quem abrir a tabela:
--
--   `nota_traz_cno = true`  + `cno_referenciado` preenchido → a nota traz este
--                             CNO impresso. É o único estado que abate a
--                             aferição daquele CNO;
--   `nota_traz_cno = false` + `cno_referenciado` NULL       → a nota NÃO traz
--                             CNO. Critério 3: salva com PENDÊNCIA, e continua
--                             sendo documentação hábil para o custo de
--                             aquisição (IN SRF 84/2001, art. 17);
--   `nota_traz_cno` NULL    + `cno_referenciado` NULL       → **não foi
--                             perguntado**: NF de material, boleto, ou registro
--                             anterior a este ticket.
--
-- ⚠️ Uma coluna só colapsaria os dois últimos — "a nota não traz CNO" viraria
-- indistinguível de "ninguém perguntou", que é exatamente o **branco silencioso**
-- que o critério 3 proíbe. Mesmo desenho, mesmo motivo, de `retencao_11`:
-- tri-estado em `boolean`, onde `null` é "não sei / não se aplica".
--
-- ⚠️ `cno_referenciado` guarda o CNO **impresso na nota**, não o da obra. Os
-- dois coincidem no ato do registro (é o que a resposta afirma), e é
-- precisamente por isso que se grava o número, e não um "sim": se o CNO da obra
-- for corrigido depois, a divergência com o papel APARECE em vez de sumir. O
-- papel não muda quando o cadastro muda.
--
-- ── Por que NULLABLE, sem default e sem check de obrigatoriedade ────────
--
-- Mesma disciplina da 0012, pelos mesmos três motivos:
-- 1. **Sem default.** Default em campo fiscal é afirmação inventada — e esta
--    afirma nada menos que "esta nota abate a aferição desta obra".
-- 2. **Sem `not null` e sem check `tipo = 'nf_servico' → not null`.** A
--    obrigatoriedade é "NF de serviço sim, o resto não" e mora em
--    `validarDocumento` (lib/fiscal/documento.ts). Um check aqui quebraria a
--    US-005 (migração da planilha), onde o registro legado entra com PENDÊNCIA,
--    não com bloqueio — e quebraria também toda linha gravada antes deste
--    ticket, que é legitimamente "não perguntado".
-- 3. **`cno_referenciado` é `text`, nunca numérico.** O CNO é impresso com
--    pontos e barra (`12.345.67890/26`); a comparação normaliza para dígitos em
--    `cnoNormalizado` (lib/fiscal/obra.ts), o banco guarda o que foi afirmado.
--
-- O ÚNICO check é de COERÊNCIA ENTRE AS DUAS COLUNAS — não de obrigatoriedade.
-- Ele impede os dois estados que não significam nada: "traz CNO, mas qual eu
-- não sei" e "não traz CNO, e o CNO que ela não traz é este aqui".
--
-- ── A pergunta obrigatória do repo (CLAUDE.md, ponto cego do E2E local) ──
--
-- *Isto depende de algum default do stack local que o projeto remoto não tem?*
-- **Não.** Nenhuma tabela nova, nenhuma sequence, nenhuma função, nenhuma
-- coluna com default do servidor. `documento` já tem `INSERT,SELECT,UPDATE`
-- para `authenticated` desde a 0005, e privilégio de tabela alcança coluna
-- nova sem `grant` novo. Continua **sem DELETE**: acervo append-only.

alter table documento
  add column cno_referenciado text,
  add column nota_traz_cno    boolean;

comment on column documento.cno_referenciado is
  'CONTAI-007 — o CNO IMPRESSO nesta nota, como afirmado no registro. '
  'Preenchido só quando nota_traz_cno = true. Não é o CNO da obra: guardar o '
  'número (e não um "sim") é o que faz a divergência aparecer se o cadastro da '
  'obra mudar depois. Só abate a base de aferição do CNO que ele nomeia — NF da '
  'obra A jamais abate base da obra B (parecer 2026-08-09, Q8).';

comment on column documento.nota_traz_cno is
  'CONTAI-007 — tri-estado, igual a retencao_11. true = a nota traz CNO '
  'impresso (o de cno_referenciado); false = a nota NÃO traz CNO, e isso é '
  'PENDÊNCIA com consequência escrita (critério 3), nunca branco silencioso; '
  'null = não foi perguntado (NF de material, boleto, registro legado). O caso '
  '"CNO de outra obra" não existe aqui: é bloqueio na entrada (critério 2), '
  'porque erro de CNO não tem conserto depois da emissão.';

alter table documento
  add constraint documento_cno_coerente
    check (
      (nota_traz_cno is true  and cno_referenciado is not null)
      or
      (nota_traz_cno is not true and cno_referenciado is null)
    );

-- ⚠️ **NENHUM ÍNDICE NOVO, e a ausência é decisão** (Gate 2, `cto-obra`).
--
-- A primeira versão desta migration criava um índice parcial em
-- `(user_id, obra_id, data_emissao) where tipo = 'nf_servico'`, justificado
-- pela lista de cobrança do critério 8. **A justificativa era falsa**: aquela
-- tela chama `carregarPainel`, que faz `select *` da obra inteira e filtra a
-- janela EM MEMÓRIA (`notasEmitidasSemCno`, lib/fiscal/obra.ts). Nenhuma query
-- do app filtra por `data_emissao` no banco, então o índice não seria usado por
-- ninguém — custaria escrita em todo INSERT e, pior, deixaria um comentário
-- mentindo para quem abrisse este arquivo em 2034 procurando entender o desenho.
--
-- Se um dia a varredura descer para o Postgres, o índice entra na migration que
-- descer com ela, junto do `explain` que o justifique.
