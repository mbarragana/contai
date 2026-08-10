-- CONTAI-003 — a obra deixa de ser única e ganha os campos do CNO.
--
-- Três coisas nascem aqui:
-- 1. `data_inicio_obra` OBRIGATÓRIA em toda obra, com ou sem CNO. É ela que
--    ancora o prazo legal de 30 dias (Lei 8.212/91, art. 49, II) e o período
--    que a aferição enxerga; sem ela o app não consegue dizer "[N] dias em
--    atraso" e o aviso vira genérico (Gate Fiscal, parecer de 2026-08-09).
-- 2. `cno_registrado_em` — a janela entre o início e o registro do CNO é
--    exatamente o intervalo das notas que saíram sem CNO, e é dela que sai a
--    lista de cobrança do CONTAI-007.
-- 3. O unique de CNO é PARCIAL (`where cno is not null`): dois imóveis no
--    mesmo CNO quebram a segregação da aferição, mas DUAS OBRAS SEM CNO TÊM DE
--    COEXISTIR — o `null` do Postgres já não colide, e o teste do critério 10
--    existe para o dia em que alguém "consertar" isso com um unique comum,
--    transformando a decisão (b) do contador em bloqueio disfarçado.

-- ── Composição do custo do terreno (critério 4) ──────────────────────────
-- `valor_terreno` passa a significar SÓ o preço pago ao vendedor; ITBI e
-- escritura/registro ganham colunas próprias porque integram o custo de
-- aquisição (IN SRF 84/2001, art. 17) e são pagos em datas diferentes — quem
-- guardasse só a soma não conseguiria completar o ITBI depois sem recalcular
-- na mão. O custo do terreno é a soma dos três (lib/fiscal/obra.ts).
alter table obra
  add column valor_itbi numeric(14,2) not null default 0,
  add column valor_escritura_registro numeric(14,2) not null default 0;

-- ── Campos do CNO e da premissa do produto ───────────────────────────────
alter table obra
  add column data_inicio_obra date,
  add column cno_registrado_em date,
  add column unidades_autonomas integer not null default 1,
  add column origem_desmembramento_loteamento boolean not null default false;

-- Backfill EXPLÍCITO antes do not null: a obra que já existe (seed local e
-- projeto remoto) nasceu sem o campo. `created_at` é a melhor aproximação
-- disponível e fica visível para correção na tela de edição da obra — o que
-- não pode acontecer é a migration falhar em banco com dados ou inventar uma
-- data em silêncio para linhas futuras (por isso não há default).
--
-- ATENÇÃO A QUEM APLICAR ESTA MIGRATION EM BANCO COM DADOS (ressalva do
-- contador, Gate 2 do CONTAI-003): `created_at` é a data em que a LINHA foi
-- criada no app, não a data em que a OBRA começou. As duas só coincidem por
-- acaso, e a diferença não é cosmética — a data de início ancora o vencimento
-- do CNO (30 dias, Lei 8.212/91 art. 49, II) e o período que a aferição do
-- INSS enxerga, então uma data aproximada mostra atraso errado em tela e
-- desloca a janela "notas emitidas antes do CNO" do CONTAI-007.
-- Depois de aplicar: abrir cada obra em /obras/[id] e CONFIRMAR a data real de
-- início. Aqui (2026-08-10) não houve vítima — a tabela `obra` do projeto
-- remoto estava vazia e o seed local já traz data explícita —, mas em banco
-- povoado o backfill é ponto de partida, nunca resposta.
update obra set data_inicio_obra = created_at::date where data_inicio_obra is null;
alter table obra alter column data_inicio_obra set not null;

-- Uma unidade autônoma é o caso do produto; zero ou negativo é dado inválido.
alter table obra add constraint obra_unidades_autonomas_positivo
  check (unidades_autonomas >= 1);

-- Data de registro do CNO sem CNO é estado impossível: seria uma janela "sem
-- CNO" fechada por um CNO que não existe.
alter table obra add constraint obra_cno_registrado_exige_numero
  check (cno is not null or cno_registrado_em is null);

-- O CNO é registrado depois do início da obra (o e-CAC aceita data retroativa
-- de início, nunca o contrário).
alter table obra add constraint obra_cno_registrado_apos_inicio
  check (cno_registrado_em is null or cno_registrado_em >= data_inicio_obra);

-- ── CNO único por dono, mas só quando existe (critério 10) ───────────────
create unique index obra_cno_unico_por_dono on obra (user_id, cno)
  where cno is not null;

-- Lista de obras e obra ativa leem por dono a cada abertura do app.
create index idx_obra_user on obra (user_id, created_at);
