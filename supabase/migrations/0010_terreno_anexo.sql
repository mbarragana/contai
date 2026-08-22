-- CONTAI-027, rodada 2 — N anexos por desembolso do terreno (dor D37), e a
-- pergunta binária do critério 12.
--
-- Fonte normativa: docs/tickets/CONTAI-027.md (critérios 7 a 17) e
-- docs/pareceres/2026-08-21-gate-fiscal-contai-027-criterio-13.md (§4a-§4d,
-- §6 e §7). Nada aqui é inferido.
--
-- ⚠️ O critério 13 (bloquear a discriminação do ano) está CORTADO desta
-- rodada pelo §3 do parecer — a pendência não tem fato de baixa no app. Não
-- existe trava nenhuma nesta migration, e a ausência é a decisão.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- DEPENDE, nas duas partes que a 0009 nomeou:
--
-- 1. TABELA. `terreno_desembolso_anexo` nasce aqui. No stack local do CLI o
--    `alter default privileges` do schema `public` está LIGADO e ela sairia
--    com tudo liberado para `anon` e `authenticated`; no remoto, com nada. O
--    `revoke ... from anon, authenticated` antes do `grant`, no fim do
--    arquivo, é o que faz local == remoto (incidente de 2026-08-17).
--
-- 2. FUNÇÃO. `terreno_desembolso_gravar` nasce com `execute` para `public`
--    — em QUALQUER Postgres —, e `public` inclui `anon`. O
--    `revoke execute ... from public, anon` no fim é obrigatório: sem ele o
--    produto ganha superfície anônima de ESCRITA.
--
-- Nenhuma sequence, nenhuma view, nenhum enum novo. ⚠️ **Nenhum
-- `alter type ... add value` em lugar nenhum deste arquivo**: ele não roda
-- dentro de transação junto com o uso do valor novo, e este arquivo inteiro é
-- uma transação só. É por isso que `papel` é `text + check`, e não enum.

-- ══ A tabela filha ══════════════════════════════════════════════════════
--
-- Molde: `documento_anexo` (0009). Duas divergências, e as duas são
-- deliberadas — não copie de volta o que está lá sem ler estes dois
-- parágrafos.
--
-- ⚠️ (a) SEM `user_id` PRÓPRIO. O dono é DERIVADO do pai, na policy. Decisão
-- do `cto-obra` no Gate 1 do CONTAI-027: o `user_id` próprio de
-- `documento_anexo` não tem justificativa escrita na 0009 — ele é a anomalia
-- do molde, não o padrão do repo. Derivando, a linha de conta cruzada (anexo
-- de um dono pendurado no desembolso de outro) é **impossível de
-- representar**; com coluna própria, ela é representável e depende de o
-- default `auth.uid()` estar certo. Quem for "consertar" isto para trás está
-- reintroduzindo o estado impossível.
--
-- ⚠️ (b) SEM `unique` em `arquivo_path`, e **a ausência é o critério 16**
-- (Gate Fiscal §5): a fatura de cartão é UM comprovante para N pagamentos. Um
-- unique aqui resolveria 1→N e fecharia a porta de N→1, que já está registrada
-- como caso real. O mesmo objeto do acervo pode sustentar mais de um
-- lançamento — e nada infla, porque o valor não vem do anexo (Gate Fiscal §1).
create table terreno_desembolso_anexo (
  id            uuid primary key default gen_random_uuid(),
  desembolso_id uuid not null references terreno_desembolso(id) on delete cascade,
  arquivo_path  text not null,

  -- Critério 14 e §7 do parecer: conjunto FECHADO de três, obrigatório e sem
  -- default. Ele não alimenta apuração nenhuma — existe para o dossiê
  -- responder, em 2034, qual papel sustenta o quê. E `comprovante` é o único
  -- que dispara a pergunta do §6.
  -- ⚠️ **Valor novo neste conjunto exige parecer do `contador`** — mesma
  -- contrapartida da D32 para o enum de pendência. Taxonomia grande faz o
  -- segundo papel não ser anexado, e o ticket que existe para completar o
  -- acervo passaria a esvaziá-lo (pre-mortem nº 1 do `po`).
  papel         text not null,

  created_at    timestamptz not null default now(),

  constraint terreno_anexo_papel
    check (papel in ('comprovante', 'nota', 'contrato'))
);

-- A leitura é sempre "os anexos DAQUELE desembolso, na ordem em que
-- chegaram": `created_at` está no índice porque é ele que reconstrói a linha
-- do tempo da re-pergunta (§6).
create index idx_terreno_anexo_desembolso
  on terreno_desembolso_anexo (desembolso_id, created_at);

alter table terreno_desembolso_anexo enable row level security;

create policy dono_terreno_anexo on terreno_desembolso_anexo for all
  using (
    exists (
      select 1 from terreno_desembolso td
       where td.id = desembolso_id and td.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from terreno_desembolso td
       where td.id = desembolso_id and td.user_id = auth.uid()
    )
  );

-- ══ A resposta do critério 12, no PAI ═══════════════════════════════════
--
-- ⚠️ **Estado DERIVADO, não linha em `pendencia`** — decisão do `cto-obra` no
-- Gate 1, respondendo à Pergunta Aberta nº 1 do ticket. Três motivos, e
-- nenhum é de gosto:
--
-- 1. O critério 12 manda usar "o mesmo mecanismo do compromisso vencido", e
--    compromisso vencido é derivação em `lib/fiscal/`, não linha persistida.
-- 2. `pendencia` (0009) é append-only com baixa por desfecho, e esta pendência
--    **não tem baixa possível hoje** (§5 do parecer): nasceria imbaixável.
-- 3. A resposta MUDA COM O TEMPO — a pergunta dispara de novo quando chega
--    comprovante novo (§6) —, e `pendencia` não representa isso por desenho.
--
-- `debitos_mesmo_dia_respondido_em` **é o critério 12b** (§4d do parecer: "a
-- resposta se grava com a data em que foi dada, nos dois casos, inclusive o
-- 'sim'" — requisito FISCAL, não de UI). Sem ela, em 2034 ninguém distingue
-- "ele afirmou que foi tudo no mesmo dia" de "ninguém perguntou": a primeira é
-- declaração do contribuinte, a segunda é lacuna do sistema.
--
-- E é ela que faz a re-pergunta ser DERIVAÇÃO PURA: comparando-a com o
-- `created_at` dos anexos, "chegou comprovante depois da resposta vigente" se
-- lê sem escrever nada no pai no ato de anexar. Por isso o `cto-obra` recusou
-- criar tabela de rastro append-only para as respostas: a resposta superada
-- não foi *corrigida* — o CONJUNTO DE FATOS é que mudou, e o `created_at` dos
-- anexos reconstrói a linha do tempo.
alter table terreno_desembolso
  add column debitos_mesmo_dia               boolean,
  add column debitos_mesmo_dia_respondido_em timestamptz;

-- Resposta sem data de resposta é o "sim" invisível que o §4d proíbe; data de
-- resposta sem resposta é rastro de nada.
alter table terreno_desembolso
  add constraint terreno_desembolso_resposta_datada
    check ((debitos_mesmo_dia is null) = (debitos_mesmo_dia_respondido_em is null));

-- §6, "represada": a pergunta cita a data no próprio botão — sem data ela é
-- impronunciável, e não há o que proteger, porque sem data não há
-- ano-calendário. Responder antes da data existir seria gravar uma afirmação
-- sobre um dia que ninguém informou.
alter table terreno_desembolso
  add constraint terreno_desembolso_resposta_exige_data
    check (debitos_mesmo_dia is null or data_pagamento is not null);

-- ── Quem carimba a data da resposta é o BANCO ──────────────────────────
--
-- ⚠️ Isto **não é conveniência**: é o que faz o critério 12b sobreviver ao
-- relógio do aparelho. A re-pergunta do §6 compara
-- `debitos_mesmo_dia_respondido_em` com o `created_at` dos anexos, e o
-- `created_at` vem do `now()` do servidor. Se a marca da resposta viesse do
-- browser, um relógio adiantado ou atrasado — o `JWT issued at future` do
-- CLAUDE.md é exatamente esse desencontro, e ele acontece nesta máquina —
-- deixaria os papéis do MESMO ato "mais novos que a resposta". A pergunta
-- voltaria a cada carga, para sempre, sobre uma resposta que já os cobre. E
-- pergunta que se repete sem motivo é a que ensina o clique automático (o
-- pre-mortem nº 2 do `po`, que já está sem mitigação mecânica).
--
-- `is distinct from` e não `<>`: a resposta é anulável, e re-carimbar a marca
-- num UPDATE que só completa a data apagaria a linha do tempo da re-pergunta.
create function terreno_desembolso_datar_resposta() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT'
     or new.debitos_mesmo_dia is distinct from old.debitos_mesmo_dia then
    new.debitos_mesmo_dia_respondido_em :=
      case when new.debitos_mesmo_dia is null then null else now() end;
  end if;
  return new;
end;
$$;

create trigger terreno_desembolso_datar_resposta
  before insert or update on terreno_desembolso
  for each row execute function terreno_desembolso_datar_resposta();

-- ══ Backfill ANTES do drop ══════════════════════════════════════════════
--
-- ⚠️ `papel = 'comprovante'` **não é inventar fato**: a coluna de origem
-- sempre teve semântica declarada de comprovante — a 0008 a descreve assim
-- ("OBRIGATÓRIO NO FORMULÁRIO para toda linha gravada como `pago`"),
-- `completarDesembolsoTerreno` diz "completa a data (e o comprovante)" e o
-- formulário rotula o campo literalmente "Comprovante".
--
-- `papel` fica `not null`: nullable "só para o histórico" enfraqueceria a
-- constraint para sempre, e o conjunto de linhas que a fraqueza serviria é o
-- que este INSERT acabou de classificar.
--
-- `created_at` vem do PAI, não de `now()`: a data em que o papel entrou no
-- acervo é a do registro, e um `now()` aqui faria toda linha antiga parecer
-- ter chegado depois de qualquer resposta — a re-pergunta do §6 dispararia em
-- massa, sozinha, na primeira carga.
insert into terreno_desembolso_anexo (desembolso_id, arquivo_path, papel, created_at)
select id, arquivo_path, 'comprovante', created_at
  from terreno_desembolso
 where arquivo_path is not null;

-- A coluna MORRE (critério 7). Coluna convivendo com tabela filha é o anexo em
-- dois lugares, e toda query de pendência teria de olhar os dois para sempre —
-- é assim que o critério 15 ("pago sem papel continua visível") morre em
-- silêncio.
alter table terreno_desembolso drop column arquivo_path;

-- ══ O ato de gravação, num INSERT só ════════════════════════════════════
--
-- Pre-mortem nº 5 do `cto-obra`: dois INSERTs deixam órfão. O ramo que decide
-- **não** é "pai sem nenhuma filha" — esse a pendência do critério 15 pega e
-- mostra em vermelho. É a falha NO MEIO dos N anexos: a primeira filha grava,
-- a segunda falha, a pendência do 15 **não acende** (existe anexo!), e o retry
-- ou duplica o pai — custo inflado, o pior erro do projeto — ou duplica a
-- filha.
--
-- Forma copiada da 0009, e cada item tem motivo escrito lá:
-- (a) `security invoker` — a policy que barra o app barra a função; ela
--     acrescenta ATOMICIDADE e ORDEM, e nada mais;
-- (b) `set search_path = public, pg_temp` — contra sequestro de nome;
-- (c) `revoke execute from public, anon` + `grant to authenticated`, no fim.
--
-- ⚠️ **SEM validação cross-table "pago ⇒ ≥1 anexo" aqui.** A dívida está
-- assumida no ticket (Viabilidade, "Dívida assumida, não esquecida"): travar
-- aqui congelaria o fluxo previsto→pago, que é decisão de outro ticket. O que
-- existe é o critério 15 tornando a verdade VISÍVEL.
--
-- ⚠️ Parâmetros anuláveis com `default null` e por isso no fim da lista: o
-- `supabase gen types` traduz default em campo OPCIONAL do TypeScript, e sem
-- isto passar `null` de `lib/data.ts` exigiria cast — que é onde o tipo para
-- de proteger. A ordem não afeta chamada nenhuma: o PostgREST chama por NOME.
--
-- `p_anexos` é array de objetos, e o formato é contrato com `lib/data.ts`
-- (mesmo desenho do `p_anos` da 0009):
--   [{"arquivo_path":"uid/terreno/…-pix-1.pdf","papel":"comprovante"}]
create function terreno_desembolso_gravar(
  p_obra_id        uuid,
  p_tipo           tipo_desembolso_terreno,
  p_valor          numeric,
  p_estado         estado_desembolso_terreno,
  p_anexos         jsonb,
  p_data_pagamento date default null,
  p_origem_recurso origem_recurso_entrada default null,
  p_debitos_mesmo_dia boolean default null
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id    uuid;
  v_anexo jsonb;
begin
  -- `debitos_mesmo_dia_respondido_em` NÃO aparece aqui: quem o carimba é o
  -- trigger, com o `now()` do servidor. (O ANO-CALENDÁRIO do custo continua
  -- vindo de `data_pagamento`, digitada — aqui não se decide ano de nada.)
  insert into terreno_desembolso
    (obra_id, tipo, valor, data_pagamento, estado, origem_recurso,
     debitos_mesmo_dia)
  values
    (p_obra_id, p_tipo, p_valor, p_data_pagamento, p_estado, p_origem_recurso,
     p_debitos_mesmo_dia)
  returning id into v_id;

  -- ⚠️ O laço roda DENTRO da mesma transação do INSERT do pai. É isso, e só
  -- isso, que a função existe para garantir.
  if p_anexos is not null then
    for v_anexo in select * from jsonb_array_elements(p_anexos) loop
      insert into terreno_desembolso_anexo (desembolso_id, arquivo_path, papel)
      values (
        v_id,
        v_anexo ->> 'arquivo_path',
        v_anexo ->> 'papel'
      );
    end loop;
  end if;

  return v_id;
end;
$$;

-- ══ REVOKE antes do GRANT — é o que faz local == remoto (0005) ══════════
revoke all privileges on table terreno_desembolso_anexo from anon, authenticated;

-- `anon` não recebe NADA: não existe acesso anônimo no produto.
--
-- ⚠️ SEM UPDATE E SEM DELETE, e a ausência é a decisão: o acervo é
-- append-only e o bucket também (a 0002 não tem policy de delete). Papel
-- anexado não é corrigido por cima de outro — anexa-se adicional (critério
-- 9b). "Tirar da lista" só existe ANTES do Gravar, quando nada subiu ainda.
grant select, insert on table terreno_desembolso_anexo to authenticated;

-- ⚠️ O UPDATE de `terreno_desembolso` (0008) passa a servir a DOIS atos, e o
-- segundo nasce aqui: completar data/comprovante (critério 23 do CONTAI-010)
-- **e** responder / re-responder a pergunta do critério 12. Continua sem
-- DELETE. Nada a conceder — o grant já existe desde a 0008.

-- ── EXECUTE: função nasce com `execute` para `public` ──────────────────
--
-- ⚠️ `terreno_desembolso_datar_resposta` fica FORA do revoke, como a função de
-- trigger da 0009: ela é `returns trigger`, e o Postgres RECUSA chamada direta
-- ("trigger functions can only be called as triggers"). O privilégio é
-- inofensivo, e um `revoke` aqui sugeriria uma proteção que não é dele. Está
-- declarada, e não silenciada, em `e2e/privilegios.spec.ts`.
revoke execute on function
  terreno_desembolso_gravar(uuid, tipo_desembolso_terreno, numeric,
                            estado_desembolso_terreno, jsonb, date,
                            origem_recurso_entrada, boolean)
  from public, anon;

grant execute on function
  terreno_desembolso_gravar(uuid, tipo_desembolso_terreno, numeric,
                            estado_desembolso_terreno, jsonb, date,
                            origem_recurso_entrada, boolean)
  to authenticated;
