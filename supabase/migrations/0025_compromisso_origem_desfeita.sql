-- CONTAI-083 — DESFAZER a nota de origem herdada de um agendamento ABERTO.
--
-- Fonte normativa: docs/pareceres/2026-08-18-compromisso-versus-pagamento.md,
-- ADENDO 9 (§M.0-M.8). Nada aqui é inferido.
--
-- ── O problema, em uma frase (§M.0) ──────────────────────────────────────
-- `documento_origem_id` é gravado UMA vez, na criação (CONTAI-064), e até aqui
-- era imutável. Três compromissos abertos do mesmo favorecido herdaram a MESMA
-- nota como origem; pelo ADENDO 7 §K.2 cada um deles, sozinho, resolve N=1 na
-- confirmação e converte **automaticamente, sem clique**, para aquela mesma
-- nota — três vezes —, enquanto as outras notas hábeis do favorecido ficam
-- indefinidamente em "Notas hábeis sem pagamento vinculado".
--
-- ── Por que DUAS COLUNAS e não tabela de histórico (§M.4, `[Certain]`) ───
-- `compromisso_data_historico`/`compromisso_valor_historico` (CONTAI-073)
-- existem para campos **corrigíveis repetidamente** — data e valor previstos
-- mudam mais de uma vez, e cada mudança é um fato novo que precisa de linha
-- própria. `documento_origem_id` não tem essa forma: escrito uma vez na criação
-- e, com este ticket, desfeito **no máximo uma vez** — nada no produto o repõe
-- depois de `null` (só a criação o povoa; a tela nova só o zera). Não existe
-- "segunda edição" para uma tabela de histórico guardar. O mínimo que satisfaz
-- "não é apagamento silencioso" são as duas colunas abaixo, e os dois CHECKs
-- que travam esse "no máximo uma vez" em SQL, e não só na tela.
--
-- ── O que esta migration NÃO faz ─────────────────────────────────────────
--   * **NENHUMA linha em `compromisso_documento_previsto`** (§M.2,
--     `[Certain]`): desfazer NÃO auto-converte a origem em pré-vínculo. A união
--     do critério 10 do CONTAI-080 continuaria resolvendo N=1 com a MESMA nota
--     errada — *"não é um mecanismo alternativo válido: é o mesmo bug, uma
--     coluna ao lado"*. Se a nota ainda for candidata, o Mateus a declara de
--     novo, como ato novo, em `/compromisso/[id]/pre-vincular`.
--   * **NENHUMA linha em `revisao`/`revisao_ano_afetado`, NENHUMA `pendencia`**
--     (§M.1, `[Certain]`): o compromisso está `aberto` e sem pagamento;
--     `documento_origem_id` *"nunca foi custo, nunca foi nó do grafo de
--     `alocarCusto`, nunca abateu INSS e nunca apareceu em apuração nenhuma"*.
--     Não há fato consumado para desfazer nem ano nenhum que mude de número.
--   * **NENHUM trigger de `situacao`** (Out of Scope do ticket): a recusa para
--     compromisso não-`aberto` (§M.5) é do app (`podeDesfazerOrigem`) MAIS o
--     `where` condicional do próprio UPDATE em `desfazerOrigemDoCompromisso` —
--     defesa em profundidade sem RPC nova. Dívida nomeada, igual à de
--     `cancelar`/`mudar data`, que também não têm trigger.
--   * **NENHUM índice**: nenhuma tela consulta por estas colunas. A linha de
--     auditoria do detalhe já tem o compromisso em mão.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- **NÃO, e pela primeira vez a resposta é essa sem ressalva.** Não há tabela
-- nova (nada herda `alter default privileges`), não há função nova (nada nasce
-- com `execute` para `public`), não há sequence, view nem coluna com default de
-- servidor — as duas colunas nascem NULL, sem `default`. `compromisso` já tem
-- `grant select, insert, update` para `authenticated` desde a migration 0007
-- (linha 316), e privilégio de UPDATE é de TABELA, não de coluna: coluna nova
-- numa tabela que já concede UPDATE está coberta, nos DOIS ambientes. Por isso
-- `e2e/privilegios.spec.ts` não ganha entrada nova — o mapa dele já diz
-- `compromisso: "INSERT,SELECT,UPDATE"`, e continua verdadeiro.
-- A policy `dono_compromisso` (0007, `for all`) já cobre o UPDATE por dono.

alter table compromisso
  -- O valor ANTIGO de `documento_origem_id`, preservado — o "sem apagar" do
  -- §M.4. Mesma FK que a coluna de origem: é o mesmo documento, e um uuid solto
  -- aqui poderia apontar para nota que nunca existiu.
  add column origem_desfeita_id uuid references documento(id),
  -- Quando. `timestamptz`, como todo `created_at`/`criado_em` do schema.
  add column origem_desfeita_em timestamptz;

-- ══ Os dois CHECKs — "escrito uma vez, desfeito no máximo uma vez" em SQL ══
--
-- ⚠️ **Eles não são redundância da tela: são a única garantia que vale para
-- QUALQUER caminho** (psql, PostgREST cru, script futuro). A tela e
-- `podeDesfazerOrigem` recusam antes; estes recusam sempre.

-- 1 · PAR COMPLETO. Auditoria com id sem data não diz quando, e data sem id não
-- diz qual nota — as duas metades sozinhas são pior que nada, porque parecem
-- rastro e não são.
alter table compromisso
  add constraint compromisso_origem_desfeita_par_completo
  check ((origem_desfeita_id is null) = (origem_desfeita_em is null));

-- 2 · DESFEITA IMPLICA ORIGEM NULA. É o "no máximo uma vez" do §M.4 em SQL:
-- com a auditoria preenchida, `documento_origem_id` tem de estar `null`. Fecha
-- os dois estados incoerentes de uma vez:
--   * "desfeita mas a origem continua lá" — o UPDATE que gravou a auditoria e
--     esqueceu de limpar o campo, deixando a conversão automática viva com um
--     rastro dizendo que ela morreu;
--   * "desfeita duas vezes" — repovoar `documento_origem_id` depois de desfeito
--     e desfazer de novo passaria a violar este check na segunda gravação.
alter table compromisso
  add constraint compromisso_origem_desfeita_exige_origem_nula
  check (origem_desfeita_id is null or documento_origem_id is null);

comment on column compromisso.origem_desfeita_id is
  'CONTAI-083 (ADENDO 9 §M.4): o documento_origem_id ANTIGO, preservado no ato '
  'de desfazer. Não participa de N nenhum, não é nó de alocarCusto, não entra '
  'em soma alguma — é rastro de auditoria e nada mais.';

comment on column compromisso.origem_desfeita_em is
  'CONTAI-083 (ADENDO 9 §M.4): quando a origem foi desfeita. Preenchida junto '
  'com origem_desfeita_id, nunca sozinha (check par_completo).';
