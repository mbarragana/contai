-- Dados de DEMONSTRAÇÃO do ambiente local (`npm run db:demo`).
--
-- Deliberadamente FORA do supabase/seed.sql: o `seed.sql` é a linha de base do
-- E2E, e ela precisa começar vazia de documentos e pagamentos. Aqui é só para
-- o Mateus abrir o app local e ver as telas com conteúdo em vez de "Nenhuma
-- pendência." — o cenário é o mesmo do mock v4 (tela 1).
--
-- Rode depois de `npm run db:reset` (o reset apaga isto junto com o resto).
-- Idempotente: apaga o que ele mesmo criou antes de recriar.

begin;

-- Usuário e obra vêm do seed.sql; aqui só o que pendura neles.
delete from pagamento where obra_id = '22222222-2222-4222-8222-222222222222';
delete from documento where obra_id = '22222222-2222-4222-8222-222222222222';
delete from favorecido where user_id = '11111111-1111-4111-8111-111111111111';

-- ── Favorecidos ──────────────────────────────────────────────────────────
insert into favorecido (id, user_id, tipo, nome, documento) values
  ('33333333-3333-4333-8333-333333333331',
   '11111111-1111-4111-8111-111111111111',
   'pj', 'AJE Construções', '11222333000181'),
  ('33333333-3333-4333-8333-333333333332',
   '11111111-1111-4111-8111-111111111111',
   'pj', 'Casa do Construtor', '11444777000161'),
  -- PF exige CPF completo (constraint favorecido_pf_exige_cpf): sem CPF o
  -- prestador não entra na ficha Pagamentos Efetuados.
  ('33333333-3333-4333-8333-333333333333',
   '11111111-1111-4111-8111-111111111111',
   'pf', 'José Pedreiro', '52998224725');

-- ── Documentos ───────────────────────────────────────────────────────────
-- Os arquivos NÃO existem no bucket: isto é cenário de tela, não acervo. Quem
-- exercita upload de verdade é o E2E e o uso manual.
insert into documento (
  user_id, obra_id, favorecido_id, tipo, arquivo_path, valor, vencimento,
  classificacao, destinatario_cpf_ok, retencao_11, status, motivo_quarentena
) values
  -- Nota emitida para outro CPF → quarentena, fora do custo de aquisição.
  ('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333332',
   'nf_material', 'demo/nf-material-quarentena.pdf', 4850.00, null,
   'material', false, null, 'quarentena',
   'Documento não está no CPF do dono da obra — não entra no custo de aquisição.'),
  -- Boleto: título de cobrança, não sustenta custo sozinho.
  ('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333331',
   'boleto', 'demo/boleto-aje.pdf', 25000.00,
   make_date(extract(year from now())::int, 9, 15),
   null, true, null, 'aguardando_pagamento', null),
  -- NF de serviço sem retenção confirmada → não abate na aferição do SERO.
  ('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333331',
   'nf_servico', 'demo/nf-servico-aje.pdf', 18000.00, null,
   'mao_obra', true, null, 'registrado', null);

-- ── Pagamentos ───────────────────────────────────────────────────────────
-- Regime de caixa: o ano do custo sai da data do pagamento. Todos no ano
-- corrente para o resumo da home ter o que mostrar.
insert into pagamento (
  user_id, obra_id, favorecido_id, valor, data_pagamento, meio, data_compra,
  comprovante_path, status
) values
  ('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333331',
   15000.00, make_date(extract(year from now())::int, 6, 5), 'pix', null,
   'demo/pix-aje-06.png', 'aguardando_nf'),
  ('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333331',
   15000.00, make_date(extract(year from now())::int, 7, 5), 'pix', null,
   'demo/pix-aje-07.png', 'aguardando_nf'),
  ('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333331',
   15000.00, make_date(extract(year from now())::int, 8, 5), 'pix', null,
   'demo/pix-aje-08.png', 'aguardando_nf'),
  -- PF: o que falta aqui é RECIBO assinado, não nota — PF não emite NF.
  ('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333',
   3000.00, make_date(extract(year from now())::int, 8, 1), 'pix', null,
   'demo/pix-jose.png', 'aguardando_nf');

commit;
