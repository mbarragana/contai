-- contai — modelo de dados inicial (CONTAI-001)
-- Invariante fiscal: Pagamento e Documento são entidades separadas; o custo
-- (IRPF) usa a DATA DO PAGAMENTO (regime de caixa). Vínculo pagamento↔documento
-- é N:M (vários PIX ↔ uma NF consolidada — Relato 002).
-- Toda tabela tem user_id e RLS: single-user hoje, mas nada vaza por padrão.

-- ── Enums ────────────────────────────────────────────────────────────────
create type tipo_favorecido as enum ('pj', 'pf');
create type tipo_documento  as enum ('nf_material', 'nf_servico', 'boleto');
create type classificacao   as enum ('material', 'mao_obra');
create type status_documento as enum (
  'registrado',          -- NF/boleto ok, no acervo
  'quarentena',          -- destinatário ≠ CPF do dono → fora do custo de aquisição
  'aguardando_pagamento' -- boleto sem pagamento conciliado
);
create type meio_pagamento  as enum ('pix', 'boleto', 'cartao');
create type status_pagamento as enum (
  'aguardando_nf', -- pago, sem documento hábil vinculado
  'conciliado'     -- vinculado a documento(s) que sustentam o valor
);

-- ── Obra ─────────────────────────────────────────────────────────────────
create table obra (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome          text not null,
  cno           text,                         -- matrícula da obra (ex-CEI)
  matricula     text,                         -- matrícula do imóvel
  cartorio      text,
  municipio     text,
  valor_terreno numeric(14,2) not null default 0,
  created_at    timestamptz not null default now()
);

-- ── Favorecido (quem recebe) ─────────────────────────────────────────────
create table favorecido (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo       tipo_favorecido not null,
  nome       text not null,
  documento  text not null,        -- CNPJ (pj) ou CPF (pf); PF exige CPF completo
  retencao_11 boolean,             -- flag padrão de retenção; null = desconhecido
  created_at timestamptz not null default now(),
  -- PF sem CPF não é documentação hábil para a ficha Pagamentos Efetuados
  constraint favorecido_pf_exige_cpf check (tipo <> 'pf' or length(documento) >= 11)
);

-- ── Documento (NF / boleto) ──────────────────────────────────────────────
create table documento (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  obra_id        uuid not null references obra(id) on delete cascade,
  favorecido_id  uuid references favorecido(id) on delete set null,
  tipo           tipo_documento not null,
  arquivo_path   text not null,            -- objeto no Storage; anexo é obrigatório
  valor          numeric(14,2),
  vencimento     date,                      -- boleto
  classificacao  classificacao,             -- material vs. mão de obra
  -- Checks fiscais obrigatórios (substituem a extração no MVP manual):
  destinatario_cpf_ok boolean not null,     -- a nota está no CPF do dono?
  retencao_11    boolean,                   -- NF serviço: tem retenção 11%? null=n/a
  status         status_documento not null default 'registrado',
  motivo_quarentena text,
  created_at     timestamptz not null default now(),
  -- destinatário ≠ CPF do dono ⇒ quarentena com motivo
  constraint documento_quarentena_coerente
    check (destinatario_cpf_ok or status = 'quarentena')
);

-- ── Pagamento (chave = data do pagamento, regime de caixa) ────────────────
create table pagamento (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  obra_id        uuid not null references obra(id) on delete cascade,
  favorecido_id  uuid references favorecido(id) on delete set null,
  valor          numeric(14,2) not null,
  data_pagamento date not null,             -- ANO-CALENDÁRIO do custo sai daqui
  meio           meio_pagamento not null,
  data_compra    date,                       -- cartão: compra pode ser em ano anterior (Q4)
  comprovante_path text,                      -- PIX/boleto/fatura; ausência = pendência
  status         status_pagamento not null default 'aguardando_nf',
  created_at     timestamptz not null default now()
);

-- ── Vínculo N:M pagamento ↔ documento ────────────────────────────────────
create table pagamento_documento (
  pagamento_id uuid not null references pagamento(id) on delete cascade,
  documento_id uuid not null references documento(id) on delete cascade,
  primary key (pagamento_id, documento_id)
);

-- ── Índices por dono ─────────────────────────────────────────────────────
create index idx_favorecido_user  on favorecido(user_id);
create index idx_documento_user   on documento(user_id);
create index idx_documento_status on documento(user_id, status);
create index idx_pagamento_user   on pagamento(user_id);
create index idx_pagamento_ano    on pagamento(user_id, data_pagamento);
create index idx_pagamento_status on pagamento(user_id, status);

-- ── RLS: nada é lido/escrito sem ser o dono ──────────────────────────────
alter table obra                enable row level security;
alter table favorecido          enable row level security;
alter table documento           enable row level security;
alter table pagamento           enable row level security;
alter table pagamento_documento enable row level security;

create policy dono_obra       on obra       for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dono_favorecido on favorecido for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dono_documento  on documento  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dono_pagamento  on pagamento  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Vínculo: só pode ligar pagamento e documento que são do próprio usuário
create policy dono_vinculo on pagamento_documento for all
  using (exists (select 1 from pagamento p where p.id = pagamento_id and p.user_id = auth.uid()))
  with check (
    exists (select 1 from pagamento p where p.id = pagamento_id and p.user_id = auth.uid())
    and exists (select 1 from documento d where d.id = documento_id and d.user_id = auth.uid())
  );
