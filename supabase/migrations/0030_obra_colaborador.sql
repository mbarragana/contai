-- CONTAI-093 — colaborador na obra: vínculo, RLS de leitura, autoria e gestão
-- de acesso.
--
-- ⚠️ **NÃO É MIGRATION FISCAL.** O Gate Fiscal do ticket é explícito nos dois
-- pontos: (1) confirmar/registrar `pagamento` continua EXCLUSIVO do Mateus — a
-- RLS de `pagamento` não é tocada por uma linha aqui, e nenhuma policy abaixo a
-- menciona; (2) visibilidade (restrita/total) é questão de produto/privacidade,
-- não de tributação — não há regra de IRPF/ganho de capital/CNO-SERO sobre
-- controle de acesso interno a um sistema privado do próprio contribuinte.
-- Nada aqui muda classificação, regime de caixa, retenção ou relatório anual.
--
-- O que nasce: a tabela de vínculo, o enum de visibilidade, as colunas de
-- AUTORIA em `documento`/`compromisso` (com a coluna gerada `pendente_revisao`,
-- fonte única de "registro de colaborador ainda não revisado"), a função
-- `visibilidade_na_obra` (a única que toda policy desta fatia e das fatias
-- 094/095/096 consulta) e quatro triggers.
--
-- ══ A PERGUNTA OBRIGATÓRIA DO REPO ══════════════════════════════════════
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- DEPENDIA, em DOIS caminhos distintos, e os dois estão fechados no fim deste
-- arquivo:
--
-- 1. **TABELA NOVA** (`obra_colaborador`) — no stack local do CLI o
--    `alter default privileges` do schema `public` está LIGADO e ela nasceria
--    com TODOS os privilégios para `anon` e `authenticated`; no remoto nasceria
--    com privilégio NENHUM. Sem o `revoke` antes do `grant`, o E2E rodaria num
--    banco mais permissivo que a produção e a suíte ficaria verde enquanto o
--    app publicado devolvia `permission denied for table obra_colaborador`
--    depois de um login bem-sucedido — o incidente de 2026-08-17 outra vez, e
--    aqui numa tabela que DECIDE QUEM VÊ O ACERVO FISCAL DE OUTRA PESSOA.
-- 2. **FUNÇÃO NOVA** — função nasce com `execute` para `PUBLIC` (que inclui
--    `anon`) em QUALQUER Postgres, local ou remoto. E estas são as **primeiras
--    funções `security definer` do repo** (dívida D-i, pattern break deliberado
--    e declarado na Viabilidade do ticket): sem revoke, `visibilidade_na_obra`
--    ficaria executável pelo anônimo — uma função que, por desenho, LÊ a tabela
--    de vínculo passando por cima da RLS.
--
-- Por isso toda função abaixo é `security definer` **com `set search_path = ''`
-- e tudo qualificado por schema** (`public.`, `auth.`): sem o search_path
-- fechado, um schema plantado na frente de `public` sequestraria a resolução de
-- nome DENTRO de uma função que roda com os privilégios do dono. É a razão de o
-- `set search_path` não ser enfeite nestas quatro.
--
-- `e2e/privilegios.spec.ts` ganhou a tabela e as cinco funções no MESMO diff.
--
-- Nenhuma sequence nasce aqui (toda PK é uuid com `gen_random_uuid()`); nenhuma
-- view. Um enum, uma tabela, seis colunas em duas tabelas (duas delas GERADAS),
-- cinco funções, cinco triggers, índices, policies e grant.

-- ══ 1 · O VÍNCULO ════════════════════════════════════════════════════════

-- Binário de propósito (Out of Scope do ticket): não existe granularidade por
-- tipo de documento nem por faixa de valor. A resposta 1 do Mateus fechou duas
-- opções, e inventar uma terceira seria granularidade não pedida.
--
-- ⚠️ **SEM DEFAULT NO BANCO** (critério 1). A UI pré-seleciona "restrita" e isso
-- é legítimo lá (não é campo fiscal — ver o Gate Fiscal no cabeçalho), mas
-- nenhum chamador de banco pode inserir vínculo sem DECIDIR o que a pessoa vê:
-- um default aqui transformaria "esqueci de escolher" em concessão silenciosa.
create type visibilidade_colaborador as enum ('restrita', 'total');

create table obra_colaborador (
  id                  uuid primary key default gen_random_uuid(),
  obra_id             uuid not null references obra(id) on delete cascade,

  -- O DONO que concedeu. Mesmo molde de `user_id` do resto do schema, inclusive
  -- o cascade: conta do dono apagada leva os vínculos dela.
  user_id             uuid not null default auth.uid()
                        references auth.users(id) on delete cascade,

  -- O endereço É o mecanismo de concessão (resposta 3 do Mateus: cadastro
  -- direto por e-mail, sem convite). Guardado normalizado — `lower(btrim())`
  -- pelo trigger `obra_colaborador_resolver_conta`, e o check abaixo é a trava
  -- para quem inserir por outro caminho.
  email               text not null,

  -- Como o Mateus chama a pessoa. É a ÚNICA fonte do nome no rastro de autoria
  -- depois que o colaborador sai (critério 13): a linha nunca é apagada, então
  -- "criado por Fulano" continua legível em 2034, com `removido_em` preenchido.
  nome                text not null,

  -- ⚠️ **NULLABLE e SEM CASCADE, e as duas coisas são decisão.**
  -- `null` = a conta ainda não existe no Supabase Auth (caso (b) do critério
  -- 11): o vínculo nasce pendente e liga sozinho quando a conta nascer.
  -- Sem cascade porque apagar a conta do colaborador não pode apagar o vínculo
  -- que explica a autoria dos registros dele — e a FK sem cascade de
  -- `documento.criado_por` já impede apagar a conta enquanto houver registro
  -- apontando para ela (Out of Scope: "banir/apagar a conta no dashboard").
  colaborador_user_id uuid references auth.users(id),

  visibilidade        visibilidade_colaborador not null,

  concedido_em        timestamptz not null default now(),

  -- ⚠️ **REVOGAR É `update removido_em = now()`, NUNCA `DELETE`** (critério 3).
  -- A linha é a única fonte de nome/e-mail do rastro de autoria; apagá-la
  -- deixaria `documento.criado_por` apontando para um uuid sem nome. Readmitir
  -- a mesma pessoa cria linha NOVA — e é por isso que os uniques abaixo são
  -- PARCIAIS (`where removido_em is null`).
  removido_em         timestamptz,

  -- O e-mail é chave de casamento com `auth.users`: caixa diferente seria uma
  -- segunda pessoa para o banco e a mesma para quem digitou.
  constraint obra_colaborador_email_normalizado
    check (email = lower(email) and email = btrim(email) and length(email) > 0),
  constraint obra_colaborador_nome_nao_vazio
    check (length(btrim(nome)) > 0),
  -- Vínculo que o próprio dono se concede é estado sem sentido: ele já é dono
  -- pela `obra`, e a linha faria `papelDaSessao` e `pendente_revisao`
  -- discordarem sobre quem ele é.
  constraint obra_colaborador_nao_e_o_dono
    check (colaborador_user_id is null or colaborador_user_id <> user_id)
);

-- ── Índices ─────────────────────────────────────────────────────────────

-- Um e-mail ativo por obra. Readmissão depois de `removido_em` passa, e é o
-- que o critério 3 exige.
create unique index obra_colaborador_email_unico_ativo
  on obra_colaborador (obra_id, email)
  where removido_em is null;

-- ⚠️ **O unique da EMENDA 2026-10-14 (multi-obra).** A mesma pessoa pode
-- colaborar em N obras do Mateus — isso é escopo desde a resposta dele —, mas
-- **nunca duas vezes na mesma obra**. Sem este índice, duas linhas ativas do
-- mesmo `colaborador_user_id` na mesma obra com visibilidades diferentes
-- tornariam `visibilidade_na_obra` (que tem `limit 1`) uma função de resultado
-- ARBITRÁRIO — a visibilidade da pessoa dependeria do plano de execução.
-- `null` não colide em unique, então dois vínculos PENDENTES (e-mails
-- diferentes, nenhuma conta ainda) na mesma obra continuam possíveis.
create unique index obra_colaborador_conta_unica_ativa
  on obra_colaborador (obra_id, colaborador_user_id)
  where removido_em is null;

-- "Em que obras eu colaboro?" — a tela (b) e `papelDaSessao` leem por aqui.
create index idx_obra_colaborador_conta
  on obra_colaborador (colaborador_user_id)
  where removido_em is null;

-- A lista da tela de gestão, por obra.
create index idx_obra_colaborador_obra on obra_colaborador (obra_id);

-- ══ 2 · A FUNÇÃO ÚNICA DE VISIBILIDADE ═══════════════════════════════════
--
-- ⚠️ **É A ÚNICA LEITURA DE VISIBILIDADE DO PRODUTO** (critério 8, doutrina
-- CONTAI-072: fonte única, nunca duas funções calculando a mesma coisa). Toda
-- policy desta fatia e das fatias `CONTAI-094`/`095`/`096` chama ESTA função —
-- nenhuma duplica o `select` abaixo. Duas cópias da mesma leitura divergem na
-- primeira correção que alguém esquecer de aplicar nas duas.
--
-- ⚠️ **O FILTRO POR `obra_id` É OBRIGATÓRIO, e é a correção da Emenda
-- 2026-10-14.** Sem ele a função responderia "a visibilidade de alguma obra em
-- que eu colaboro", e um colaborador vinculado a duas obras do Mateus — restrita
-- numa, total noutra — receberia a visibilidade errada em uma das duas, com o
-- `limit 1` escolhendo qual. Era bug latente desde a primeira versão, só nunca
-- exercitado porque multi-obra não era escopo; é escopo desde a resposta do
-- Mateus, e `e2e/colaborador.spec.ts` (cenário (e)) o exercita de frente.
--
-- `null` = o usuário NÃO é colaborador daquela obra especificamente (pode ser
-- dono dela, pode ser colaborador de outra, pode ser ninguém). Quem distingue
-- "dono" de "colaborador" é a policy, nunca esta função.
--
-- `security definer` porque ela é chamada DE DENTRO da policy de `obra`: com
-- `security invoker` a leitura de `obra_colaborador` passaria pela policy
-- daquela tabela, que por sua vez é consultada a partir de `obra` — o caminho
-- curto para recursão de policy, que o Postgres recusa em tempo de execução.
create function visibilidade_na_obra(p_obra_id uuid)
  returns public.visibilidade_colaborador
language sql
security definer
stable
set search_path = ''
as $$
  select oc.visibilidade
    from public.obra_colaborador oc
   where oc.obra_id = p_obra_id
     and oc.colaborador_user_id = auth.uid()
     and oc.removido_em is null
   limit 1;
$$;

-- ══ 3 · RLS DO VÍNCULO ═══════════════════════════════════════════════════

alter table obra_colaborador enable row level security;

-- ⚠️ **A policy de SELECT não referencia `obra`** (critério 4), e a ausência é
-- estrutural, não estilo: `obra.obra_select` chama `visibilidade_na_obra`, que
-- lê esta tabela. Uma condição `exists (select … from obra …)` aqui fecharia o
-- ciclo e o Postgres recusaria a consulta com recursão infinita de policy. As
-- duas colunas bastam: `user_id` é o dono que concedeu, `colaborador_user_id` é
-- a própria pessoa — e é lendo o PRÓPRIO vínculo que o app descobre papel e
-- visibilidade.
--
-- O colaborador vê também os vínculos REMOVIDOS dele (não há filtro de
-- `removido_em`): é o que faz `papelDaSessao` continuar devolvendo
-- `'colaborador'` depois da revogação, em vez de jogar a pessoa no shell de
-- dono e oferecer "cadastrar obra" (critério 16).
create policy obra_colaborador_select on obra_colaborador for select
  using (user_id = auth.uid() or colaborador_user_id = auth.uid());

-- Conceder e alterar são atos do DONO DA OBRA, sempre. São DUAS condições, e as
-- duas são necessárias:
--
-- 1. `exists (… from obra …)` — o vínculo não nasce pendurado na obra de outra
--    conta;
-- 2. `user_id = auth.uid()` — o vínculo não nasce com `user_id` DISCORDANDO de
--    quem o criou.
--
-- ⚠️ **A segunda entrou no Gate 2, e a primeira versão desta migration não a
-- tinha** — o comentário afirmava que o `exists` cobria as duas coisas, e era
-- falso: `user_id` tem `default auth.uid()`, mas default não é trava, e o
-- PostgREST aceita a coluna no corpo do POST. O revisor provou por `psql` que o
-- dono conseguia gravar um vínculo com `user_id` de outra conta.
--
-- O estrago não é teórico, e é pior do que parece: a linha CONCEDE acesso de
-- verdade (o trigger resolve `colaborador_user_id` pelo e-mail e a policy de
-- `obra` passa a devolver a obra para aquela pessoa), mas desaparece da lista
-- do dono — porque `obra_colaborador_select` filtra por `user_id = auth.uid()`.
-- Acesso concedido e invisível é exatamente o Pre-mortem 1 do ticket ("erro de
-- digitação no e-mail concede acesso a quem não devia") com a mitigação
-- desligada: o ticket conta com "a lista visível + remoção rápida" (critério
-- 10), e não há remoção rápida do que não aparece na lista.
create policy obra_colaborador_insert on obra_colaborador for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from obra o where o.id = obra_id and o.user_id = auth.uid()
    )
  );

-- ⚠️ O `using` é o que impede o COLABORADOR de se promover: ele VÊ o vínculo
-- dele pela policy de select, e sem um `using` próprio aqui o Postgres não
-- deixaria linha nenhuma visível para UPDATE — mas também não é dele que o
-- `using` fala. Ele fala da obra: só quem é dono alcança a linha para alterar
-- visibilidade ou carimbar `removido_em`.
--
-- ⚠️ **O `using` fica SÓ com a propriedade da obra, e o `user_id = auth.uid()`
-- entra só no `with check`.** A assimetria é inofensiva, e o que ela NÃO faz
-- precisa estar escrito aqui, porque a primeira redação deste comentário
-- afirmava o contrário e foi desmentida por `psql` no Gate 2:
--
-- ❌ **Ela não deixa o dono reparar uma linha com `user_id` errado.** Isso foi
--    testado, não deduzido: com uma linha órfã plantada por administrador,
--    `update … set removido_em = now() where email = …` e
--    `update … set removido_em = now(), user_id = auth.uid()` afetam, os dois,
--    **ZERO linhas** para o dono da obra. O motivo tem duas pernas:
--    (a) UPDATE com WHERE lê a linha pela policy de **SELECT**
--    (`user_id = auth.uid() or colaborador_user_id = auth.uid()`), e a órfã não
--    passa por nenhuma das duas pernas — para o dono ela simplesmente não
--    existe; (b) sem WHERE, o `with check` acima recusa a órfã inteira.
--    Logo: **linha com `user_id` errado não tem reparo pelo app, só por
--    administrador do banco.**
--
-- ✅ **O que sustenta a decisão é a outra ponta**: nenhuma órfã pode NASCER. O
--    `with check` do insert exige `user_id = auth.uid()`, e
--    `e2e/colaborador.spec.ts` (cenário (d)) trava isso pelos dois verbos, com
--    a asserção sobre o estado lido FORA da RLS — pelo client do dono a órfã é
--    invisível, que é o furo inteiro que o Gate 2 achou.
--
-- Pôr `user_id = auth.uid()` também no `using` não mudaria nada de prático (a
-- policy de SELECT já barra antes), então a assimetria fica — por não custar,
-- não por comprar um reparo que ela não entrega.
create policy obra_colaborador_update on obra_colaborador for update
  using (
    exists (select 1 from obra o where o.id = obra_id and o.user_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from obra o where o.id = obra_id and o.user_id = auth.uid()
    )
  );

-- ══ 4 · RLS DA OBRA: a policy única se parte em duas ═════════════════════
--
-- Até aqui `dono_obra for all` respondia pelos quatro verbos. O colaborador
-- precisa LER a obra (nome e cidade, para saber em qual ele está entrando) e
-- não pode escrever nada nela — logo, leitura e escrita deixam de ter a mesma
-- condição e deixam de caber na mesma policy (critério 9).
--
-- ⚠️ **RLS é por LINHA, nunca por coluna**: a policy de select devolve a LINHA
-- inteira da obra, com `cno`, `matricula` e `data_inicio_obra`. "Colaborador vê
-- nome e cidade" é garantia da TELA (as duas consultas do colaborador em
-- `lib/data.ts` selecionam colunas nomeadas, nunca `*`), não do banco. Dívida
-- declarada: fechar isso de verdade pede view ou grant de coluna, e o ticket
-- não pediu nenhum dos dois nesta fatia.
drop policy dono_obra on obra;

create policy obra_select on obra for select
  using (user_id = auth.uid() or public.visibilidade_na_obra(id) is not null);

-- `for all` e não `for insert, update`: cobre também o DELETE, que o papel
-- `authenticated` não tem desde a 0005 e que, se um dia tiver, não vai nascer
-- aberto por omissão aqui. O ramo de SELECT desta policy é redundante com
-- `obra_select` (policies permissivas se somam por OR) e inofensivo.
create policy obra_escrita on obra for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ══ 5 · AUTORIA EM `documento` E `compromisso` ═══════════════════════════
--
-- ⚠️ **`criado_por` NÃO substitui `user_id`, e a diferença é o desenho inteiro**
-- (dívida D-v do ticket): `user_id` passa a significar **dono do acervo** —
-- quem declara —, e `criado_por` significa **quem digitou**. O registro do
-- colaborador nasce no acervo do MATEUS (é dele a declaração, é dele o CPF na
-- nota) com a autoria do colaborador preservada. O nome do campo `user_id`
-- engana a partir de hoje; renomear 30 migrations não paga.
--
-- ⚠️ **Adicionar coluna `not null default auth.uid()` num passo só NÃO
-- funciona**: o `ALTER TABLE` reescreve as linhas existentes avaliando o
-- default, e durante a migration `auth.uid()` é `null` — violação de NOT NULL
-- na primeira linha de acervo que existir. Daí os quatro passos: coluna
-- nullable, backfill explícito, NOT NULL, default. É o mesmo cuidado do
-- backfill de `data_inicio_obra` na 0004.
--
-- O backfill é `criado_por = user_id` e está CERTO por construção: até esta
-- migration só existia um usuário capaz de inserir, e ele é o dono do acervo.

alter table documento
  add column criado_por  uuid references auth.users(id),
  add column revisado_em timestamptz,
  add column revisado_por uuid references auth.users(id);

update documento set criado_por = user_id where criado_por is null;

alter table documento
  alter column criado_por set not null,
  alter column criado_por set default auth.uid();

alter table compromisso
  add column criado_por  uuid references auth.users(id),
  add column revisado_em timestamptz,
  add column revisado_por uuid references auth.users(id);

update compromisso set criado_por = user_id where criado_por is null;

alter table compromisso
  alter column criado_por set not null,
  alter column criado_por set default auth.uid();

-- Revisado sem quem revisou (ou vice-versa) é estado impossível: a revisão é um
-- ATO de alguém, e o rastro que não diz de quem não é rastro. Mesmo molde do
-- `integracao_google_revogacao_par_completo` da 0029.
alter table documento add constraint documento_revisao_par_completo
  check ((revisado_em is null) = (revisado_por is null));
alter table compromisso add constraint compromisso_revisao_par_completo
  check ((revisado_em is null) = (revisado_por is null));

-- ── A coluna GERADA (Emenda 2026-10-14) ─────────────────────────────────
--
-- ⚠️ **É A ÚNICA FONTE DE VERDADE de "registro de colaborador ainda não
-- revisado pelo Mateus"** (critério 6) — usada pela RLS ampliada das fatias
-- `094`/`095`, pelo filtro "Aguardando revisão" de `/despesas`, pelo card da
-- Home, pela lista do colaborador e por `podeGerarRelatorioAnual`.
--
-- ⚠️ **O `criado_por <> user_id` é a metade que corrige a leitura ingênua.**
-- `revisado_em is null` SOZINHO incluiria **todo registro do próprio Mateus**:
-- ele nunca passa pela ação "Revisado" (não revisa o que ele mesmo digitou),
-- então `revisado_em` é sempre `null` nos dele. Qualquer tela que filtrasse só
-- por `revisado_em is null` trataria o acervo inteiro do dono como pendente — e
-- "tudo pendente" é o mesmo que nada pendente, porque ninguém olha mais.
--
-- Coluna GERADA e não expressão repetida em N lugares: é a diferença entre uma
-- definição e cinco cópias dela. `stored` porque é ela que o índice parcial
-- abaixo indexa.
alter table documento
  add column pendente_revisao boolean
    generated always as (revisado_em is null and criado_por <> user_id) stored;

alter table compromisso
  add column pendente_revisao boolean
    generated always as (revisado_em is null and criado_por <> user_id) stored;

-- A fila "aguardando revisão" é a minoria por construção (todo registro do
-- dono fica fora), então o índice parcial é pequeno e exato.
create index idx_documento_pendente_revisao on documento (obra_id)
  where pendente_revisao;
create index idx_compromisso_pendente_revisao on compromisso (obra_id)
  where pendente_revisao;

-- ══ 6 · TRIGGERS ═════════════════════════════════════════════════════════

-- ── `criado_por` é imutável depois de gravado (critério 6) ───────────────
--
-- Mesmo molde de `documento_arquivo_path_imutavel` (0014) e de
-- `pagamento_comprovante_path_imutavel` (0019), pelo mesmo motivo: as duas
-- tabelas têm UPDATE para `authenticated` desde a 0005/0007, e "ninguém mexe
-- nisso" seria promessa de código, não garantia de banco.
--
-- É a mitigação do Pre-mortem 3 do ticket: uma migration ou feature futura que
-- edite `documento`/`compromisso` por outro motivo — `corrigir_documento`,
-- quitação, o que vier — não consegue sobrescrever nem nulificar a autoria, nem
-- por acidente. A meta 3 do produto (acervo legível no fim do prazo de
-- decadência) deixa de depender da disciplina de quem escreve o próximo código.
--
-- ⚠️ UMA função para as DUAS tabelas: o corpo só nomeia `criado_por`, que
-- existe nas duas com o mesmo significado. Duas funções idênticas divergiriam.
create function criado_por_imutavel() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.criado_por is distinct from old.criado_por then
    raise exception
      'criado_por é o rastro de autoria e não pode ser reescrito (era %, tentaram %)',
      old.criado_por, new.criado_por;
  end if;
  return new;
end;
$$;

create trigger criado_por_imutavel
  before update on documento
  for each row execute function criado_por_imutavel();

create trigger criado_por_imutavel
  before update on compromisso
  for each row execute function criado_por_imutavel();

-- ── O dono do acervo é o dono da OBRA, por banco (critério 7) ───────────
--
-- `documento.user_id = obra.user_id` deixa de ser convenção de código e passa a
-- ser invariante de banco. É o que faz o registro do colaborador nascer no
-- acervo do DONO — nunca no dele, onde ficaria invisível para a declaração do
-- Mateus e para a RLS de `pagamento`.
--
-- ⚠️ Roda ANTES do `with check` da RLS (o Postgres avalia `BEFORE` triggers e
-- só depois a policy), então para o dono nada muda: `new.user_id` continua
-- sendo `auth.uid()` porque ele é o dono da obra. Para o colaborador das fatias
-- `094`/`095`, é esta linha que decide onde o registro pousa.
--
-- `security definer` porque o colaborador não tem (e não deve ter) privilégio
-- de ler o dono de uma obra qualquer para derivar o campo.
create function user_id_da_obra() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dono uuid;
begin
  select o.user_id into v_dono from public.obra o where o.id = new.obra_id;
  if v_dono is null then
    raise exception 'obra % não existe: o dono do acervo não pode ser derivado',
      new.obra_id;
  end if;
  new.user_id := v_dono;
  return new;
end;
$$;

create trigger user_id_da_obra
  before insert on documento
  for each row execute function user_id_da_obra();

create trigger user_id_da_obra
  before insert on compromisso
  for each row execute function user_id_da_obra();

-- ── Primeiro acesso, caso (a): a conta JÁ existe (critério 11) ──────────
--
-- Resolve `colaborador_user_id` pelo e-mail na hora do insert, sem RPC e sem
-- service key. O vínculo já nasce ATIVO e a pessoa entra no próximo login.
--
-- ⚠️ **O `colaborador_user_id` é SEMPRE derivado do e-mail, nunca aceito do
-- chamador.** O e-mail é o mecanismo de concessão (resposta 3 do Mateus), então
-- quem o digita decide quem entra; um `colaborador_user_id` vindo do corpo do
-- POST seria um segundo mecanismo, invisível na tela, capaz de conceder acesso
-- a uma conta cujo e-mail ninguém digitou.
--
-- A normalização do e-mail acontece aqui (e não só no app) porque é aqui que
-- ele se torna chave de casamento com `auth.users`. O check da tabela é a trava
-- para quem vier por outro caminho.
create function obra_colaborador_resolver_conta() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));

  select u.id into new.colaborador_user_id
    from auth.users u
   where lower(btrim(u.email)) = new.email
   order by u.created_at
   limit 1;

  return new;
end;
$$;

create trigger obra_colaborador_resolver_conta
  before insert on obra_colaborador
  for each row execute function obra_colaborador_resolver_conta();

-- ── Primeiro acesso, caso (b): a conta nasce DEPOIS (critério 11) ───────
--
-- O vínculo nasceu pendente (`colaborador_user_id is null`) porque o e-mail
-- ainda não tinha conta; quando o Mateus a criar no dashboard (Authentication →
-- Users, Auto Confirm, mesmo e-mail), este trigger liga o vínculo sozinho.
-- Somado ao trigger de cima, QUALQUER ORDEM entre vínculo e conta converge sem
-- ação do app — que é o ponto do critério: nada aqui depende de alguém lembrar
-- de reprocessar.
--
-- ⚠️ **UPDATE DE CONJUNTO, não "a primeira que achar" — Emenda 2026-10-14.** O
-- mesmo e-mail pode ter mais de um vínculo pendente simultâneo (a pessoa
-- convidada em duas obras do Mateus antes de ter conta). Resolver só uma
-- deixaria a outra pendente para sempre, sem erro e sem tela que mostrasse isso.
--
-- ⚠️ O `not exists` não é zelo: sem ele, uma colisão com
-- `obra_colaborador_conta_unica_ativa` abortaria o INSERT em `auth.users` — ou
-- seja, uma linha de vínculo esquisita impediria o Mateus de CRIAR UMA CONTA no
-- dashboard, com um erro que não fala de vínculo nenhum. Preferimos deixar a
-- linha pendente (visível na tela de gestão) a quebrar a criação de conta.
create function resolver_vinculos_de_colaborador() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or btrim(new.email) = '' then
    return null;
  end if;

  update public.obra_colaborador oc
     set colaborador_user_id = new.id
   where oc.colaborador_user_id is null
     and oc.email = lower(btrim(new.email))
     and oc.user_id <> new.id
     and not exists (
       select 1
         from public.obra_colaborador ja
        where ja.obra_id = oc.obra_id
          and ja.colaborador_user_id = new.id
          and ja.removido_em is null
     );

  return null;
end;
$$;

-- ⚠️ Trigger em `auth.users` — schema de terceiro (GoTrue), e o único do repo.
-- A função mora em `public` de propósito (critério 11): o schema `auth` é
-- território do CLI/da plataforma, e objeto nosso lá dentro é candidato a ser
-- removido por um upgrade do GoTrue sem ninguém notar.
create trigger resolver_vinculos_de_colaborador
  after insert on auth.users
  for each row execute function resolver_vinculos_de_colaborador();

-- ══ 7 · REVOKE antes do GRANT — é o que faz local == remoto (0005) ═══════
-- Ver a resposta à pergunta obrigatória no cabeçalho.

revoke all privileges on table obra_colaborador from anon, authenticated;

-- `anon` não recebe NADA. Aqui isso é mais do que doutrina: esta tabela é o que
-- decide quem enxerga o acervo fiscal de outra pessoa.

-- ── `authenticated`: só o verbo que o app executa ───────────────────────
--
-- SEM DELETE, e a ausência é a decisão (critério 3): revogar acesso é
-- `update removido_em = now()`. Apagar a linha perderia o nome e o e-mail que
-- sustentam "criado por Fulano" depois que a pessoa sai — e esse rastro é a
-- meta 3 do produto aplicada a gente, não a papel.
--
-- UPDATE serve a DOIS atos, os dois com caminho na tela de gestão: trocar
-- `visibilidade` e carimbar `removido_em`.
grant select, insert, update on table obra_colaborador to authenticated;

-- ── As FUNÇÕES (as primeiras `security definer` do repo) ────────────────
--
-- Função nasce com `execute` para `PUBLIC` — que inclui `anon` — em qualquer
-- Postgres. Numa função `security definer` isso é pior do que de hábito: ela
-- roda com os privilégios do DONO, logo por cima da RLS.
--
-- `visibilidade_na_obra` é a única chamável de fora: ela é consultada pelas
-- policies e (nas fatias seguintes) pelo app. Para o anônimo ela não teria o
-- que devolver (`auth.uid()` é null, o `where` nunca casa), mas privilégio
-- inútil numa função que lê tabela de acesso é superfície à toa.
revoke all privileges on function visibilidade_na_obra(uuid)
  from public, anon, authenticated;
grant execute on function visibilidade_na_obra(uuid) to authenticated;

-- ⚠️ **As três funções de TRIGGER `security definer` ficam SEM privilégio para
-- ninguém** — e aqui o repo quebra o padrão da 0014/0019/0021 de propósito.
-- Naquelas, a função de trigger é `security invoker` e o Postgres recusa chamada
-- direta ("trigger functions can only be called as triggers"), então o `execute`
-- herdado de `PUBLIC` é inofensivo e foi DOCUMENTADO em vez de revogado. Estas
-- são `security definer`: deixar um `execute` que não protege nada numa função
-- que roda como dono é a classe de privilégio que não se justifica por
-- comodidade. Revogar não afeta o trigger — o Postgres confere EXECUTE no
-- `CREATE TRIGGER`, não a cada disparo.
revoke all privileges on function user_id_da_obra() from public, anon, authenticated;
revoke all privileges on function obra_colaborador_resolver_conta()
  from public, anon, authenticated;
revoke all privileges on function resolver_vinculos_de_colaborador()
  from public, anon, authenticated;

-- `criado_por_imutavel` é `security invoker` e `returns trigger`: fica com o
-- `execute` de `PUBLIC` como as outras funções de trigger do repo, declarado em
-- `e2e/privilegios.spec.ts` e não silenciado. Revogar aqui sugeriria uma
-- proteção que não é dela.
