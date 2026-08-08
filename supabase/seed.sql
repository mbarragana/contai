-- Seed do ambiente LOCAL (supabase db reset). Nunca roda em produção.
-- Cria o usuário de desenvolvimento e a obra, porque o app exige sessão (RLS)
-- e uma obra cadastrada — nenhuma das duas telas existe ainda.

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
insert into obra (id, user_id, nome, cno, municipio, valor_terreno)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Casa Cachoeira', '12.345.67890/26', 'Florianópolis', 800000.00
);
