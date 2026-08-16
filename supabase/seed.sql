-- Seed do ambiente LOCAL (supabase db reset). Nunca roda em produção.
-- Cria o usuário de desenvolvimento e a obra do dia a dia de dev/E2E.
--
-- CONTAI-002, critério 8: este arquivo NÃO é o caminho de criação de usuário
-- em produção, e nunca foi para ser. O login do app usa
-- `signInWithOtp({ shouldCreateUser: false })` — ele jamais cria conta, porque
-- a base guarda CPF, CNO e as notas da obra. Em produção a conta do Mateus se
-- cria UMA vez, à mão, no dashboard do Supabase (Authentication → Users → Add
-- user / Invite), e daí em diante ele entra pelo código de 6 dígitos.
-- Consequência prática: `npx supabase db push` aplica migrations no projeto
-- remoto e NÃO leva este seed junto. Se um dia levar, um usuário com senha
-- conhecida e publicada em repositório entra na base fiscal.

-- ── Usuário local ────────────────────────────────────────────────────────
-- As colunas de token precisam ser '' e não NULL: o GoTrue lê todas como
-- string e devolve 500 ("converting NULL to string is unsupported") no login.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new,
  email_change, email_change_token_current, phone_change,
  phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'mateus@contai.local',
  crypt('contai-local-123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', '', '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  jsonb_build_object(
    'sub', '11111111-1111-4111-8111-111111111111',
    'email', 'mateus@contai.local',
    'email_verified', true
  ),
  'email', now(), now(), now()
);

-- ── Obra ─────────────────────────────────────────────────────────────────
-- user_id explícito: o seed roda fora de sessão, então auth.uid() é null.
-- Datas fixas (não relativas a now()) para o E2E poder afirmar a janela sem
-- CNO e os dias de atraso sem depender do dia em que a suíte roda.
insert into obra (
  id, user_id, nome, cno, matricula, cartorio, municipio,
  valor_terreno, valor_itbi, valor_escritura_registro,
  data_inicio_obra, cno_registrado_em,
  unidades_autonomas, origem_desmembramento_loteamento
)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Casa Cachoeira', '12.345.67890/26', '38.104', '1º Ofício de Registro de Imóveis',
  'Florianópolis',
  800000.00, 0, 0,
  '2025-11-04', '2025-11-20',
  1, false
);
