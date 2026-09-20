-- CONTAI-022 — cartão de crédito: compra → fatura → pagamento.
--
-- Fonte normativa: docs/pareceres/2026-08-18-compromisso-versus-pagamento.md
-- (corpo §§1-7, ADENDO §B cartão, ADENDO 2 §5+§7 comprovante, ADENDO 5
-- recusa de parcelamento). Decisão de arquitetura: consulta ao `cto-obra`,
-- 2026-09-19 — ver `docs/tickets/CONTAI-022.md`, seção Viabilidade.
--
-- ── Por que a compra nasce na tabela `compromisso` já em produção ────────
-- A 0007 já reservou `origem_compromisso` com o valor `'cartao'` e a coluna
-- `data_compra`, exatamente para este ticket. Compra no cartão não é uma
-- entidade nova — é um `compromisso`, com o mesmo bloqueio de vencido
-- (`ehVencidoSemResposta`, `podeGerarRelatorioAnual`) que boleto e PIX já
-- respeitam, de graça. Uma tabela paralela reabriria a proteção que o
-- CONTAI-019 já fechou.
--
-- ── Por que `fatura` não tem favorecido nem comprovante próprio ──────────
-- "A fatura não é documento hábil e não tem favorecido próprio — o custo se
-- atribui por compra" (mock, texto do parecer). O comprovante mora em
-- `fatura_desembolso`, não aqui: com N desembolsos parciais (rotativo), cada
-- um tem o SEU comprovante — uma coluna única em `fatura` repetiria a D37
-- (a mesma anomalia já corrigida em `terreno_desembolso`, migration 0010).
--
-- ── Por que a fatura nasce automática, sem tela de cadastro ──────────────
-- Decisão do `cto-obra`: uma tela de cadastro prévio criaria um
-- pré-requisito que o Mateus teria de lembrar de cumprir ANTES de registrar
-- a compra — o mesmo atrito que produziu a D26 original ("compra no cartão
-- não tem onde morar", meta 1 falhando pelo lado de fora). O dado que
-- identifica a fatura (o vencimento) já é obrigatório na compra (critério 3
-- do ticket); pedir de novo, numa tela separada, seria entrada dupla do
-- mesmo fato.
--
-- ── Por que a chave é (obra_id, data_vencimento) EXATA, nunca uma janela ──
-- O app não conhece o ciclo do cartão (cartão como entidade própria está
-- fora de escopo — Out of Scope do ticket). Qualquer heurística de "mesmo
-- ciclo"/±N dias seria o sistema ESCOLHENDO a fatura por conta própria —
-- default fiscal disfarçado, proibido pelo critério 16 ("nenhum campo novo
-- nasce preenchido, nenhuma tela grava valor implícito"). Duas datas
-- diferentes viram duas faturas, as duas visíveis; o conserto de um
-- vencimento digitado errado é "Mudou a data" (mecanismo que já existe
-- desde o CONTAI-019), nunca uma janela mágica de agrupamento.
--
-- Risco residual ACEITO conscientemente (não modelado): dois cartões com o
-- mesmo vencimento colapsam na mesma fatura. Fiscalmente irrelevante (o
-- custo é por compra; a fatura não tem favorecido) — o único efeito é um
-- comprovante de fatura compartilhado por compras de dois cartões
-- distintos. "Quantos cartões o Mateus usa" segue sem resposta no backlog;
-- se um dia for dois com o mesmo dia de vencimento, a correção é aditiva
-- (um rótulo na chave única), não uma tela nova.
--
-- ── Por que NÃO existe coluna `fatura_id` em `compromisso` ───────────────
-- Mesmo argumento da 0007 para `pagamento` não ganhar coluna de previsão: o
-- vínculo mora só em `fatura_compromisso`, e "mudou a data" de uma compra no
-- cartão RE-ALOCA essa linha (função `compra_cartao_mudar_data` abaixo) em
-- vez de reescrever uma coluna no pai.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ────────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não
-- tem?" — Sim, do mesmo jeito que a 0007: `alter default privileges` do
-- stack local daria a estas três tabelas privilégio total para `anon` e
-- `authenticated`. O REVOKE explícito no fim deste arquivo, mais a entrada
-- em `e2e/privilegios.spec.ts`, fecham o ponto cego.

-- ── Fatura — agrupa compras de cartão por vencimento ─────────────────────
create table fatura (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  obra_id         uuid not null references obra(id) on delete cascade,
  data_vencimento date not null,
  created_at      timestamptz not null default now(),

  -- A chave natural — ver "por que a chave é EXATA" acima.
  constraint fatura_vencimento_unico unique (obra_id, data_vencimento)
);

-- ── Vínculo compra ↔ fatura (N compras : 1 fatura) ───────────────────────
-- PK em `compromisso_id`: uma compra pertence a NO MÁXIMO uma fatura por
-- vez. "Mudou a data" faz UPDATE nesta linha (re-aloca), nunca INSERT de
-- uma segunda.
create table fatura_compromisso (
  compromisso_id uuid primary key references compromisso(id) on delete cascade,
  fatura_id      uuid not null references fatura(id) on delete cascade
);

-- ── Cada pagamento FEITO À FATURA — integral ou parcial (rotativo) ───────
-- Fato consumado, nunca custo, nunca `pagamento`: o que compõe custo são os
-- N `pagamento` gerados POR COMPRA na confirmação/alocação — nunca esta
-- linha. O valor é SEMPRE gravado (parecer, ADENDO §B — "não quita
-- compromisso nenhum automaticamente, mas o valor pago em si nunca é
-- recusado").
create table fatura_desembolso (
  id               uuid primary key default gen_random_uuid(),
  fatura_id        uuid not null references fatura(id) on delete cascade,
  valor            numeric(14,2) not null,
  data_pagamento   date not null,
  -- Um documento para N pagamentos (ADENDO 2 §5) — nullable pelo mesmo
  -- motivo de `comprovante_path` em `pagamento`: nunca bloqueia o registro
  -- do fato consumado.
  comprovante_path text,
  created_at       timestamptz not null default now(),

  constraint fatura_desembolso_valor_positivo check (valor > 0)
);

-- ── Critério 4 do ticket: `data_compra` obrigatória para origem='cartao' ──
-- Dado probatório (liga a nota à fatura) que NUNCA decide ano-calendário —
-- só `data_pagamento` decide. Hoje não existe linha com `origem='cartao'`
-- em produção nenhuma (a 0007 só reservou o valor do enum), então o CHECK é
-- alcançável sem backfill. `data_prevista` (crit. 3) fica de fora de
-- propósito — ela é obrigatória por GUARDA DE APP + teste unitário nomeado
-- (`fatura.test.ts`), não CHECK de banco, porque `data_prevista` nula segue
-- legítima no saldo de uma quitação parcial (adendo §D) para as OUTRAS
-- origens (boleto/pix); só `cartao` não tem esse estado, e amarrar isso no
-- banco encaixotaria a coluna por origem, que é exatamente o "status decide
-- validação" que este schema evita em outros lugares.
alter table compromisso
  add constraint compromisso_cartao_exige_data_compra
  check (origem <> 'cartao' or data_compra is not null);

-- ── Índices ───────────────────────────────────────────────────────────────
create index idx_fatura_user               on fatura (user_id);
create index idx_fatura_compromisso_fatura on fatura_compromisso (fatura_id);
create index idx_fatura_desembolso_fatura  on fatura_desembolso (fatura_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table fatura              enable row level security;
alter table fatura_compromisso  enable row level security;
alter table fatura_desembolso   enable row level security;

create policy dono_fatura on fatura for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Dono DERIVADO da linha-pai (mesmo molde de `dono_compromisso_pagamento`,
-- 0007) — sem `user_id` próprio, para a discordância pai/filho ser
-- impossível de representar.
create policy dono_fatura_compromisso on fatura_compromisso for all
  using (exists (select 1 from fatura f where f.id = fatura_id and f.user_id = auth.uid()))
  with check (
    exists (select 1 from fatura f where f.id = fatura_id and f.user_id = auth.uid())
    and exists (select 1 from compromisso c where c.id = compromisso_id and c.user_id = auth.uid())
  );

create policy dono_fatura_desembolso on fatura_desembolso for all
  using (exists (select 1 from fatura f where f.id = fatura_id and f.user_id = auth.uid()))
  with check (exists (select 1 from fatura f where f.id = fatura_id and f.user_id = auth.uid()));

-- ── REVOKE antes do GRANT — é o que faz local == remoto (migration 0005) ──
revoke all privileges on table fatura, fatura_compromisso, fatura_desembolso
  from anon, authenticated;

-- `anon` não recebe NADA — não existe acesso anônimo no produto.

-- `authenticated`: sem DELETE em nenhuma das três (acervo append-only, mesma
-- doutrina da 0007). UPDATE em `fatura_compromisso` serve a UM ato só: a
-- re-alocação de "mudou a data" — nunca escrita direta do app.
grant select, insert         on table fatura              to authenticated;
grant select, insert, update on table fatura_compromisso  to authenticated;
grant select, insert         on table fatura_desembolso   to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Os atos que exigem transação — mesma família de `terreno_desembolso_gravar`
-- (0010) e `corrigir_documento` (0009): `security invoker` (a policy que
-- barra o app barra a função — ela só acrescenta atomicidade e ordem),
-- `set search_path` contra sequestro de nome, `revoke`+`grant` no fim.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1 · Registrar a compra ────────────────────────────────────────────────
--
-- Pre-mortem: dois INSERTs soltos (compromisso, depois fatura+vínculo)
-- deixariam órfão se o segundo falhasse — um compromisso `cartao` SEM fatura
-- é um estado que a home não sabe mostrar (nenhuma tela lê compromisso sem
-- passar pela fatura). A transação fecha isso.
--
-- `on conflict...do nothing` + `select` (em vez de `on conflict...do update
-- returning`) porque não há NADA para atualizar: a chave natural já diz
-- tudo que a linha sabe. Duas compras no mesmo vencimento reaproveitam a
-- MESMA fatura, sem tocar numa coluna sequer dela.
create function compra_cartao_gravar(
  p_obra_id            uuid,
  p_favorecido_id      uuid,
  p_valor              numeric,
  p_data_compra        date,
  p_data_vencimento    date,
  p_documento_origem_id uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_compromisso_id uuid;
  v_fatura_id      uuid;
begin
  insert into compromisso
    (obra_id, favorecido_id, valor_previsto, data_prevista, origem,
     documento_origem_id, data_compra)
  values
    (p_obra_id, p_favorecido_id, p_valor, p_data_vencimento, 'cartao',
     p_documento_origem_id, p_data_compra)
  returning id into v_compromisso_id;

  insert into fatura (obra_id, data_vencimento)
  values (p_obra_id, p_data_vencimento)
  on conflict (obra_id, data_vencimento) do nothing;

  select id into v_fatura_id from fatura
   where obra_id = p_obra_id and data_vencimento = p_data_vencimento;

  insert into fatura_compromisso (compromisso_id, fatura_id)
  values (v_compromisso_id, v_fatura_id);

  return jsonb_build_object(
    'compromisso_id', v_compromisso_id,
    'fatura_id', v_fatura_id
  );
end;
$$;

-- ── 2 · "Mudou a data" de uma compra no cartão — RE-ALOCA a fatura ───────
--
-- Achado do `cto-obra`: sem isto, `fatura_compromisso` ficaria apontando
-- para o vencimento ANTIGO depois de uma correção, e a compra sumiria da
-- fatura certa sem aparecer em fatura nenhuma na tela. Bloqueada se a compra
-- já foi quitada (tem pagamento gerado) — mover compra PAGA reescreveria um
-- fato consumado, que é a mesma classe de erro que "não apagar" existe para
-- prevenir.
create function compra_cartao_mudar_data(
  p_compromisso_id uuid,
  p_nova_data      date
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_obra_id     uuid;
  v_data_antiga date;
  v_situacao    situacao_compromisso;
  v_origem      origem_compromisso;
  v_fatura_id   uuid;
begin
  select obra_id, data_prevista, situacao, origem
    into v_obra_id, v_data_antiga, v_situacao, v_origem
    from compromisso where id = p_compromisso_id;

  if v_origem <> 'cartao' then
    raise exception 'compra_cartao_mudar_data só vale para origem=cartao';
  end if;
  if v_situacao <> 'aberto' then
    raise exception 'compra já quitada ou cancelada — a data não muda mais';
  end if;

  insert into compromisso_data_historico (compromisso_id, data_anterior, data_nova)
  values (p_compromisso_id, v_data_antiga, p_nova_data);

  update compromisso set data_prevista = p_nova_data where id = p_compromisso_id;

  insert into fatura (obra_id, data_vencimento)
  values (v_obra_id, p_nova_data)
  on conflict (obra_id, data_vencimento) do nothing;

  select id into v_fatura_id from fatura
   where obra_id = v_obra_id and data_vencimento = p_nova_data;

  update fatura_compromisso set fatura_id = v_fatura_id
   where compromisso_id = p_compromisso_id;
end;
$$;

-- ── 3 · Registrar o valor pago à fatura (integral ou parcial) ────────────
--
-- SEMPRE grava o desembolso — "o valor pago é gravado sempre, é fato
-- consumado, nunca recusado" (ADENDO §B). `p_compromisso_ids` decide quanto
-- se aloca NO MESMO ATO: array vazio/nulo = nenhuma compra confirmada ainda
-- (o caminho do rotativo, s6 puro); lista com TODAS as abertas da fatura =
-- confirmação integral (s4); lista parcial = alocação manual feita já na
-- criação do desembolso. `fatura_alocar` (função 4) cobre o caso de alocar
-- contra um desembolso QUE JÁ EXISTE — as duas nunca duplicam pagamento
-- porque cada compromisso só entra numa vez (`situacao='aberto'` na cláusula
-- `where` do laço é a guarda).
create function fatura_desembolso_gravar(
  p_fatura_id        uuid,
  p_valor            numeric,
  p_data_pagamento   date,
  p_comprovante_path text default null,
  p_compromisso_ids  uuid[] default '{}'
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_desembolso_id uuid;
  v_compromisso_id uuid;
  v_favorecido_id  uuid;
  v_valor_previsto numeric;
  v_pagamento_id   uuid;
begin
  insert into fatura_desembolso (fatura_id, valor, data_pagamento, comprovante_path)
  values (p_fatura_id, p_valor, p_data_pagamento, p_comprovante_path)
  returning id into v_desembolso_id;

  if p_compromisso_ids is not null then
    foreach v_compromisso_id in array p_compromisso_ids loop
      select c.favorecido_id, c.valor_previsto
        into v_favorecido_id, v_valor_previsto
        from compromisso c
        join fatura_compromisso fc on fc.compromisso_id = c.id
       where c.id = v_compromisso_id
         and fc.fatura_id = p_fatura_id
         and c.situacao = 'aberto';

      -- Compromisso que não pertence a esta fatura, ou já não está aberto:
      -- ignorado, não é erro — proteção contra corrida (duas abas alocando
      -- a mesma fatura ao mesmo tempo), mesma régua do `criarVinculos` que
      -- já existe em `lib/data.ts`.
      if v_favorecido_id is not null or v_valor_previsto is not null then
        insert into pagamento
          (obra_id, favorecido_id, valor, data_pagamento, meio, status,
           data_compra, comprovante_path)
        select c.obra_id, v_favorecido_id, v_valor_previsto, p_data_pagamento,
               'cartao', 'aguardando_nf', c.data_compra, p_comprovante_path
          from compromisso c where c.id = v_compromisso_id
        returning id into v_pagamento_id;

        insert into compromisso_pagamento (compromisso_id, pagamento_id)
        values (v_compromisso_id, v_pagamento_id);

        update compromisso set situacao = 'quitado' where id = v_compromisso_id;
      end if;
    end loop;
  end if;

  return v_desembolso_id;
end;
$$;

-- ── 4 · Alocar manualmente contra um desembolso já gravado ───────────────
--
-- O caminho do rotativo quando a alocação não aconteceu junto da gravação
-- do valor (tela reaberta depois, ou o Mateus escolheu "decidir depois" em
-- s7). Mesma guarda de corrida da função 3 — compromisso fora da fatura ou
-- já não aberto é ignorado, nunca erro.
create function fatura_alocar(
  p_desembolso_id   uuid,
  p_compromisso_ids uuid[]
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_fatura_id      uuid;
  v_data_pagamento date;
  v_comprovante    text;
  v_compromisso_id uuid;
  v_favorecido_id  uuid;
  v_valor_previsto numeric;
  v_pagamento_id   uuid;
begin
  select fatura_id, data_pagamento, comprovante_path
    into v_fatura_id, v_data_pagamento, v_comprovante
    from fatura_desembolso where id = p_desembolso_id;

  foreach v_compromisso_id in array p_compromisso_ids loop
    select c.favorecido_id, c.valor_previsto
      into v_favorecido_id, v_valor_previsto
      from compromisso c
      join fatura_compromisso fc on fc.compromisso_id = c.id
     where c.id = v_compromisso_id
       and fc.fatura_id = v_fatura_id
       and c.situacao = 'aberto';

    if v_favorecido_id is not null or v_valor_previsto is not null then
      insert into pagamento
        (obra_id, favorecido_id, valor, data_pagamento, meio, status,
         data_compra, comprovante_path)
      select c.obra_id, v_favorecido_id, v_valor_previsto, v_data_pagamento,
             'cartao', 'aguardando_nf', c.data_compra, v_comprovante
        from compromisso c where c.id = v_compromisso_id
      returning id into v_pagamento_id;

      insert into compromisso_pagamento (compromisso_id, pagamento_id)
      values (v_compromisso_id, v_pagamento_id);

      update compromisso set situacao = 'quitado' where id = v_compromisso_id;
    end if;
  end loop;
end;
$$;

-- ── EXECUTE: revoke de public/anon, grant só a authenticated ─────────────
revoke execute on function
  compra_cartao_gravar(uuid, uuid, numeric, date, date, uuid)
  from public, anon;
grant execute on function
  compra_cartao_gravar(uuid, uuid, numeric, date, date, uuid)
  to authenticated;

revoke execute on function
  compra_cartao_mudar_data(uuid, date)
  from public, anon;
grant execute on function
  compra_cartao_mudar_data(uuid, date)
  to authenticated;

revoke execute on function
  fatura_desembolso_gravar(uuid, numeric, date, text, uuid[])
  from public, anon;
grant execute on function
  fatura_desembolso_gravar(uuid, numeric, date, text, uuid[])
  to authenticated;

revoke execute on function
  fatura_alocar(uuid, uuid[])
  from public, anon;
grant execute on function
  fatura_alocar(uuid, uuid[])
  to authenticated;
