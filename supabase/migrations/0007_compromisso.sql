-- CONTAI-019 — compromisso (previsto) × pagamento (executado)
--
-- Fonte normativa: docs/pareceres/2026-08-18-compromisso-versus-pagamento.md
-- (§§1-7, ADENDO 1 §§A-E, ADENDO 2 §§1-7 e §§F.1-F.5). Nada aqui é inferido.
--
-- ── Por que TABELA NOVA e não uma coluna em `pagamento` (parecer §2) ─────
-- "A proteção tem de ser de TIPO, não de atenção. Registro com data anulável
-- transforma a regra em 'todo cálculo lembra de filtrar nulo' — é o defeito do
-- `status` com outro rosto, o mesmo que o CONTAI-018 está removendo. Um cálculo
-- escrito daqui a seis meses não pode ter como pegar um compromisso por
-- engano."
--
-- Consequência direta, e é ela que dá sentido ao arquivo inteiro:
-- `pagamento` NÃO GANHA COLUNA NENHUMA nesta migration (critério 2), e
-- `compromisso` NÃO TEM COLUNA DE DATA DE PAGAMENTO (critério 1). Compromisso
-- não é pagamento em estado inicial; é outra coisa, com outro tipo. A ausência
-- da coluna é o que impede qualquer query futura de somar os dois.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- DEPENDIA, e é o caso mais perigoso do repo desde o incidente de 2026-08-17:
-- esta migration CRIA CINCO TABELAS. No stack local do CLI o
-- `alter default privileges` do schema `public` está LIGADO — cada uma delas
-- nasceria com TODOS os privilégios para `anon` e `authenticated`. No projeto
-- remoto esse default está desligado e elas nasceriam com privilégio NENHUM.
-- Sem o `revoke` abaixo, o E2E rodaria num banco mais permissivo que a
-- produção e a suíte inteira ficaria verde enquanto o app publicado devolvia
-- `{"code":"42501","message":"permission denied for table compromisso"}` depois
-- de um login bem-sucedido — o incidente, pela terceira vez.
-- Depois das linhas de REVOKE + GRANT no fim deste arquivo, não depende mais:
-- o banco local tem exatamente os privilégios do remoto, e
-- `e2e/privilegios.spec.ts` acusa qualquer divergência pelo nome da tabela.
--
-- Nenhuma sequence nasce aqui (toda PK é uuid com `gen_random_uuid()`); nenhuma
-- view, nenhuma função. Nada além de tabela, enum, índice, policy e grant.

-- ── Enums ────────────────────────────────────────────────────────────────

-- Boleto e PIX previsto são fiscalmente IDÊNTICOS: zero (Gate Fiscal 7). A
-- diferença entre eles é PROBATÓRIA, e é por isso que a origem é um CAMPO e
-- não uma bifurcação de regra. `cartao` existe porque a compra no cartão nasce
-- compromisso (adendo 1 §B) — mas o FLUXO do cartão é o CONTAI-022, e neste
-- ticket o `meio = cartao` continua RECUSADO na entrada (critérios 25-27).
create type origem_compromisso as enum ('boleto', 'pix', 'cartao');

-- 'cancelado' é reservado, pelo parecer §3, à previsão QUE NÃO SE REALIZOU —
-- nunca a um adiamento. "Mudou a data" mantém o MESMO compromisso e grava a
-- data anterior em `compromisso_data_historico` (critério 33); usar
-- 'cancelado' para adiar poluiria o sinal de auditoria e orfanaria o vínculo
-- 1:N com pagamentos já feitos.
create type situacao_compromisso as enum ('aberto', 'quitado', 'cancelado');

-- O conjunto FECHADO de resoluções da diferença não explicada (§F.2), rotulado
-- pelo RESULTADO e nunca pela causa: ele não tem de caracterizar juridicamente
-- nada. Quatro valores, e o `null` é o quinto estado — ver a tabela abaixo.
create type resolucao_diferenca as enum (
  'nao_compoe_custo',      -- 1. mora, taxa, item não incorporado → fora DEFINITIVAMENTE, sem pendência
  'falta_documento',       -- 2. é da obra e falta o documento → "pago sem nota" pelo valor da diferença
  'multiplos_documentos',  -- 3. o pagamento cobriu mais de um documento → resolve por VÍNCULO
  'erro_digitacao'         -- 4. errei o valor digitado → NÃO é classificação fiscal; correção é o CONTAI-021
);

-- ── Compromisso (previsão; não é custo, e não é custo "ainda pequeno") ───
-- Parecer §1: "o que gera custo de aquisição é o pagamento, na data do
-- pagamento". Compromisso não entra em soma nenhuma, sob rótulo nenhum (§2).
create table compromisso (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  obra_id             uuid not null references obra(id) on delete cascade,
  favorecido_id       uuid references favorecido(id) on delete set null,

  -- O campo se chama VALOR PREVISTO, nunca "valor" (Gate Fiscal 6.3 / parecer
  -- §2). O nome é parte da proteção: "valor" convida à soma mista.
  valor_previsto      numeric(14,2) not null,

  -- NULLABLE de propósito: "sem data definida" é estado legítimo (adendo 1 §A,
  -- corolário 3), alcançável SÓ pelo saldo de uma quitação parcial (§D), nunca
  -- na criação. Compromisso sem data prevista NÃO é vencido e NÃO bloqueia o
  -- relatório anual — incerteza declarada não é silêncio.
  data_prevista       date,

  origem              origem_compromisso not null,
  -- Boleto/contrato/nota que originou a previsão. NUNCA obrigatório:
  -- "compromisso não exige anexo" (parecer §4) — é a única entidade do app que
  -- nasce sem ele, e é exceção por não afirmar fato nenhum. Exigir anexo aqui
  -- produz atrito que faz ele não registrar, e a previsão volta para a memória.
  documento_origem_id uuid references documento(id) on delete set null,

  situacao            situacao_compromisso not null default 'aberto',
  motivo_cancelamento text,

  -- Cartão: a data da compra. Existe como dado PROBATÓRIO (liga a nota à
  -- fatura) e NÃO DECIDE ANO NENHUM (adendo 1 §B(a)). Nenhuma função de
  -- apuração a lê. A obrigatoriedade quando `origem = 'cartao'` é do
  -- CONTAI-022, junto com o fluxo que sabe criar essa linha.
  data_compra         date,

  created_at          timestamptz not null default now(),

  -- ⚠️ NÃO EXISTE COLUNA DE DATA DE PAGAMENTO AQUI (critério 1). A ausência é
  -- a regra: a data que vale para o custo é a da EXECUÇÃO, gravada no
  -- `pagamento` criado pela confirmação (parecer §3, "a data prevista é
  -- descartada na gravação"). Um `data_pagamento` nesta tabela seria o convite
  -- a "todo cálculo lembra de filtrar nulo" que o §2 proíbe. Há teste de
  -- inspeção de schema afirmando a ausência.

  -- Cancelar é ato com motivo: previsão que não se realizou fica REGISTRADA,
  -- nunca apagada (parecer §3).
  constraint compromisso_cancelado_exige_motivo
    check (situacao <> 'cancelado' or motivo_cancelamento is not null),
  -- Previsão de zero (ou negativa) não é previsão; seria linha muda na agenda.
  constraint compromisso_valor_previsto_positivo check (valor_previsto > 0)
);

-- ── Vínculo 1:N compromisso ↔ pagamento (critérios 12 e 15) ─────────────
-- "Dois registros distintos com vínculo. NÃO conversão." (parecer §3): um
-- compromisso pode ser quitado por VÁRIOS pagamentos, e um registro que muda
-- de natureza no tempo impede responder "isto já foi contado como custo antes
-- de tal data?".
--
-- ⚠️ Esta tabela é a razão de `pagamento` não ganhar coluna nenhuma (critério
-- 2). Um `compromisso_id` em `pagamento` modelaria 1:1 e devolveria ao
-- pagamento um campo que fala de previsão.
create table compromisso_pagamento (
  compromisso_id uuid not null references compromisso(id) on delete cascade,
  pagamento_id   uuid not null references pagamento(id) on delete cascade,
  primary key (compromisso_id, pagamento_id)
);

-- ── Histórico da data prevista (critérios 33 e 34) ──────────────────────
-- "Mudou a data" mantém o MESMO compromisso — mesmo id, mesmos vínculos, mesmo
-- saldo — e grava a data anterior aqui. Append-only proíbe destruir o fato
-- anterior, não proíbe editar a linha: o histórico é o que preserva.
-- Sem UPDATE e sem DELETE nos grants: o que entra aqui não se corrige.
-- A contagem de linhas por compromisso é o "adiado N×" do critério 34.
create table compromisso_data_historico (
  id             uuid primary key default gen_random_uuid(),
  compromisso_id uuid not null references compromisso(id) on delete cascade,
  -- Nullable dos dois lados: "sem data definida" é estado legítimo, e sair
  -- dele (ou entrar nele) é exatamente uma mudança que precisa de rastro.
  data_anterior  date,
  data_nova      date,
  registrado_em  timestamptz not null default now()
);

-- ── Diferença entre o pago e o que o custo aceita (§F.1-F.4) ────────────
-- Extensão 1:1 de `pagamento`, e por isso a PK é o próprio `pagamento_id`.
--
-- ⚠️ POR QUE TABELA E NÃO DUAS COLUNAS EM `pagamento` — mesma lógica do §2,
-- e ela não é estética:
-- 1. O critério 2 é explícito: `pagamento` não ganha coluna nova neste ticket.
--    Manter a promessa é o que deixa o diff de `pagamento` vazio e legível.
-- 2. A esmagadora maioria dos pagamentos NÃO tem diferença nenhuma. Duas
--    colunas `not null default 0` em `pagamento` fariam toda query de custo
--    passar a carregar campos que só existem para a exceção — e é assim que
--    alguém, daqui a seis meses, soma `valor` sem lembrar de subtrair
--    `encargos`. A ausência da LINHA é mais visível que um zero em coluna.
-- 3. A linha aqui é uma AFIRMAÇÃO do Mateus sobre a composição do desembolso
--    ("R$ 320 disto foi juros"), com data de resolução. Fato afirmado tem
--    registro próprio; não é atributo do fato original.
create table pagamento_diferenca (
  pagamento_id  uuid primary key references pagamento(id) on delete cascade,

  -- Juros e multa de mora identificados. NÃO COMPÕEM CUSTO DE AQUISIÇÃO
  -- (parecer §3): não remuneram bem ou serviço incorporado ao imóvel.
  -- ⚠️ Não confundir com os juros do FINANCIAMENTO DO TERRENO, que INTEGRAM o
  -- custo (IN SRF 84/2001, art. 17, I, "g") — fundir os dois casos é erro
  -- fiscal, não de escopo.
  encargos      numeric(14,2) not null default 0,

  -- O que sobrou sem explicação. Fica FORA do custo enquanto não houver
  -- resposta — direção segura, subestima (§F.2).
  nao_explicado numeric(14,2) not null default 0,

  -- NULLABLE, e o `null` é o "não sei ainda" do §F.2: "é estado permitido e é
  -- o único que pode ser o estado inicial, porque é o único que não afirma
  -- nada. Forçar classificação ensina a inventar dado no campo que sobrou."
  resolucao     resolucao_diferenca,
  resolvido_em  timestamptz,

  constraint diferenca_valores_nao_negativos
    check (encargos >= 0 and nao_explicado >= 0),
  -- Resolução e data de resolução andam juntas: resolvido sem data (ou data
  -- sem resolução) é estado impossível.
  constraint diferenca_resolucao_coerente
    check ((resolucao is null) = (resolvido_em is null))
);

-- ── O "não" da sugestão de quitação, registrado POR PAR (critério 39) ────
-- Adendo 1 §C(d): "o app não pergunta de novo DAQUELE par — perguntar de novo
-- ensina a dispensar sem ler — e continua livre para sugerir outros pares".
-- O "não" NÃO é resposta ao vencido e NÃO desbloqueia o relatório anual.
create table quitacao_recusada (
  pagamento_id   uuid not null references pagamento(id) on delete cascade,
  compromisso_id uuid not null references compromisso(id) on delete cascade,
  recusado_em    timestamptz not null default now(),
  primary key (pagamento_id, compromisso_id)
);

-- ── Índices ─────────────────────────────────────────────────────────────
create index idx_compromisso_user       on compromisso (user_id);
-- A agenda da home: abertos e vencidos de UMA obra, por data prevista.
create index idx_compromisso_agenda     on compromisso (obra_id, situacao, data_prevista);
-- O gatilho da sugestão de quitação casa por FAVORECIDO_ID, nunca por nome
-- (adendo 1 §C(a)(1): "CNPJ errado não é typo, é outro favorecido").
create index idx_compromisso_favorecido on compromisso (user_id, favorecido_id);
-- A PK já cobre a busca por compromisso_id; o caminho inverso ("que
-- compromissos este pagamento quitou?") precisa deste.
create index idx_compromisso_pagamento_pagamento on compromisso_pagamento (pagamento_id);
create index idx_compromisso_data_historico_compromisso
  on compromisso_data_historico (compromisso_id, registrado_em);
create index idx_quitacao_recusada_compromisso on quitacao_recusada (compromisso_id);

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table compromisso               enable row level security;
alter table compromisso_pagamento     enable row level security;
alter table compromisso_data_historico enable row level security;
alter table pagamento_diferenca       enable row level security;
alter table quitacao_recusada         enable row level security;

create policy dono_compromisso on compromisso for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Por que as quatro dependentes NÃO têm `user_id` próprio ─────────────
-- Elas seguem o molde de `dono_vinculo` (migration 0001): o dono é DERIVADO da
-- linha-pai. Uma coluna `user_id` própria pode DISCORDAR do pai — nasce a
-- linha que a RLS deixa você ver mas cujo compromisso/pagamento é de outra
-- conta. Derivando, a discordância é impossível de representar.
create policy dono_compromisso_pagamento on compromisso_pagamento for all
  using (exists (select 1 from compromisso c where c.id = compromisso_id and c.user_id = auth.uid()))
  with check (
    exists (select 1 from compromisso c where c.id = compromisso_id and c.user_id = auth.uid())
    and exists (select 1 from pagamento p where p.id = pagamento_id and p.user_id = auth.uid())
  );

create policy dono_compromisso_data_historico on compromisso_data_historico for all
  using (exists (select 1 from compromisso c where c.id = compromisso_id and c.user_id = auth.uid()))
  with check (exists (select 1 from compromisso c where c.id = compromisso_id and c.user_id = auth.uid()));

create policy dono_pagamento_diferenca on pagamento_diferenca for all
  using (exists (select 1 from pagamento p where p.id = pagamento_id and p.user_id = auth.uid()))
  with check (exists (select 1 from pagamento p where p.id = pagamento_id and p.user_id = auth.uid()));

create policy dono_quitacao_recusada on quitacao_recusada for all
  using (exists (select 1 from pagamento p where p.id = pagamento_id and p.user_id = auth.uid()))
  with check (
    exists (select 1 from pagamento p where p.id = pagamento_id and p.user_id = auth.uid())
    and exists (select 1 from compromisso c where c.id = compromisso_id and c.user_id = auth.uid())
  );

-- ── REVOKE antes do GRANT — é o que faz local == remoto (migration 0005) ─
-- Ver a resposta à pergunta obrigatória no cabeçalho. Sem estas linhas as
-- cinco tabelas nasceriam, no stack local, com tudo liberado para `anon` e
-- `authenticated` — e o ponto cego do incidente de 2026-08-17 continuaria de
-- pé, agora com cinco tabelas em vez de uma.
revoke all privileges on table
  compromisso, compromisso_pagamento, compromisso_data_historico,
  pagamento_diferenca, quitacao_recusada
  from anon, authenticated;

-- `anon` não recebe NADA. A base guarda CPF, CNO e as notas da obra; não
-- existe acesso anônimo no produto. A ausência é a decisão.

-- ── `authenticated`: só o verbo que o app executa ───────────────────────
-- SEM DELETE em nenhuma delas, e isto NÃO é esquecimento. O DELETE de
-- `pagamento_documento` (migration 0006) é exceção NOMEADA e justificada lá:
-- aquele vínculo é uma AFIRMAÇÃO DE CORRESPONDÊNCIA corrigível, e afirmação
-- errada infla o custo de aquisição. Nada aqui é dessa família:
-- * `compromisso` — previsão que não se realizou vira 'cancelado' COM MOTIVO,
--   nunca apagada (parecer §3). Apagar devolveria o compromisso para a cabeça
--   dele, que é a falha da meta 1 pelo lado de fora.
-- * `compromisso_pagamento` — desfazer uma quitação é ticket com parecer; hoje
--   o fluxo não tem essa tela e privilégio sem caminho é superfície à toa.
-- * `compromisso_data_historico` — é o rastro; apagar rastro é o oposto do que
--   ele existe para fazer.
-- * `pagamento_diferenca` — critério 32: "resolver NÃO apaga o registro da
--   diferença" (acervo append-only, CONTAI-009).
-- * `quitacao_recusada` — o "não" é registrado para não ser reperguntado.

-- UPDATE em `compromisso` serve a três atos, e só a eles: mudar a `situacao`
-- (quitar/cancelar), mudar a `data_prevista` ("mudou a data", com a linha de
-- histórico no mesmo ato) e gravar o `motivo_cancelamento`.
grant select, insert, update on table compromisso to authenticated;

grant select, insert on table compromisso_pagamento to authenticated;
grant select, insert on table compromisso_data_historico to authenticated;

-- UPDATE em `pagamento_diferenca` serve à RESOLUÇÃO (`resolucao` +
-- `resolvido_em`), que muda com o tempo. ⚠️ O VALOR da diferença NUNCA muda
-- (critério 32) — a guarda disso é o caminho de escrita de `lib/data.ts`, que
-- só envia esses dois campos. O grant é de tabela, e não de coluna, porque
-- `information_schema.role_table_grants` (a fonte de `e2e/privilegios.spec.ts`)
-- só enxerga privilégio de TABELA: um `grant update (resolucao, resolvido_em)`
-- sumiria do mapa e o teste leria como "tabela sem UPDATE". Endurecer para
-- coluna é proposta registrada para o Gate 2, junto com a adaptação do teste.
grant select, insert, update on table pagamento_diferenca to authenticated;

grant select, insert on table quitacao_recusada to authenticated;
