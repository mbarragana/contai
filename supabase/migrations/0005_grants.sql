-- contai — privilégios explícitos de tabela (correção de produção, 2026-08-17)
--
-- SINTOMA: app publicado, login OK, e toda leitura devolvia
--   {"code":"42501","message":"permission denied for table obra"}
--
-- NÃO ERA RLS. Policy que nega devolve LISTA VAZIA; `permission denied for
-- table` é o Postgres barrando ANTES da policy, por falta de GRANT. Conferido
-- em 2026-08-17 direto no projeto remoto: o próprio PostgREST devolveu o
-- diagnóstico na dica — "Grant the required privileges to the current role".
--
-- CAUSA: as migrations 0001-0004 criam tabela e policy e não concedem
-- privilégio nenhum. Quem concedia era o `alter default privileges` do schema
-- `public`, que o stack LOCAL do CLI traz ligado (anon, authenticated e
-- service_role saem com tudo em toda tabela nova) e que no projeto remoto está
-- desligado. Daí "passa local, quebra remoto": os 30 E2E rodavam num banco
-- mais permissivo que a produção.
--
-- O que já estava certo e continua fora daqui:
-- * USAGE no schema `public` — existe nos dois. Prova: se faltasse, o erro
--   remoto seria "permission denied for schema public", e não "for table obra".
--   Concedido abaixo assim mesmo, porque é idempotente e o custo de deixar
--   implícito foi justamente este incidente.
-- * `storage.objects` (bucket `acervo`, migration 0002) — os privilégios vêm
--   do bootstrap da própria extensão de storage, não do default privileges do
--   `public`. Conferido em 2026-08-17 no remoto: POST /storage/v1/object/list
--   respondeu 200 com lista vazia (RLS filtrando), e não 42501. Upload e
--   leitura seguem governados pelas policies de 0002. Nada a fazer aqui.
-- * SEQUENCES — nenhuma. Toda PK é uuid com `gen_random_uuid()`; conferido com
--   `select * from information_schema.sequences where sequence_schema='public'`
--   (0 linhas). Se um dia entrar coluna `serial`/`identity`, o GRANT de USAGE
--   na sequence tem de entrar junto no mesmo diff.

-- ── REVOKE antes do GRANT: é o que faz local == remoto ───────────────────
-- Sem este revoke a correção seria invisível no ambiente de teste: o banco
-- local continuaria mais permissivo que a produção pelo default privileges, e
-- o ponto cego que causou o incidente continuaria de pé para a próxima
-- tabela. Depois daqui, o E2E roda com os MESMOS privilégios do remoto.
--
-- `service_role` fica de fora de propósito: nenhum caminho do produto o usa
-- (não há server-side com secret key), e revogar privilégio de um papel que
-- não usamos é mexer no que não está quebrado. No remoto ele já está sem nada.
revoke all privileges on table
  obra, favorecido, documento, pagamento, pagamento_documento
  from anon, authenticated;

-- ── `anon` não recebe NADA ───────────────────────────────────────────────
-- Não existe acesso anônimo no produto: a base guarda CPF, CNO e as notas da
-- obra, e o app exige login desde o dia 1. O `anon` só serve para o GoTrue
-- emitir o token; depois disso quem fala com o PostgREST é `authenticated`.
-- Por isso não há nenhum `grant ... to anon` neste arquivo — a ausência é a
-- decisão, e o revoke acima a torna verdadeira também no banco local.

grant usage on schema public to authenticated;

-- ── `authenticated`: só o verbo que o app executa hoje ───────────────────
-- Explícito por tabela, e não `all tables in schema public`: a próxima tabela
-- tem de aparecer no diff do ticket como decisão de quem a criou, não ser
-- coberta por acidente. `e2e/privilegios.spec.ts` falha quando uma tabela
-- nova nasce sem essa decisão.
--
-- Sem DELETE em nenhuma delas. Não é esquecimento: o app não apaga linha
-- nenhuma (`grep -rn "\.delete(" app lib` → vazio), e "Excluir pagamento" está
-- em Out of Scope do CONTAI-009 — "colide com a premissa append-only do
-- acervo". Acervo fiscal que precisa sobreviver até venda + 5 anos não ganha
-- privilégio de destruição porque o teste achou cômodo. O dia em que apagar
-- virar requisito, é ticket com parecer, e o GRANT entra junto.
grant select, insert, update on table obra       to authenticated;
grant select, insert, update on table favorecido to authenticated;
grant select, insert, update on table documento  to authenticated;
grant select, insert, update on table pagamento  to authenticated;

-- Vínculo N:M: hoje o app só LÊ (`lib/data.ts` monta o painel e o detalhe do
-- pagamento a partir dele). Nenhum caminho grava vínculo ainda — a conciliação
-- é ticket futuro, e é ele que acrescenta o `grant insert` aqui.
grant select on table pagamento_documento to authenticated;

-- ── Por que NÃO entra `alter default privileges` ─────────────────────────
-- Ele resolveria a tabela futura sozinho, e é exatamente por isso que fica de
-- fora:
-- 1. Anularia o objetivo declarado acima. Com default privileges, a tabela do
--    próximo ticket nasce acessível sem uma linha sequer no diff — que é a
--    mesma classe de decisão invisível que produziu este incidente, só que com
--    o sinal trocado.
-- 2. Default privilege é vinculado ao PAPEL QUE CRIA o objeto. Aqui o
--    `db push` conecta como `postgres`; um objeto criado por outro papel
--    (dashboard, extensão, um job) não seria coberto — e teríamos a mesma
--    falha de hoje, agora com a falsa sensação de estar resolvida.
-- 3. É ação de schema com efeito invisível: nenhum ticket futuro veria no
--    próprio diff que a tabela nova já saiu com privilégio.
-- A alternativa escolhida é a oposta: privilégio zero por padrão e um teste
-- que ACUSA a tabela sem decisão explícita.
