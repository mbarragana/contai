-- CONTAI-021 — corrigir documento já registrado: rastro, pendências e os atos
-- transacionais que os gravam juntos.
--
-- Fonte normativa: docs/pareceres/2026-08-18-correcao-de-documento-registrado.md
-- (§§1-7 e o ADENDO de 2026-08-19, §§1-5 com os subitens 5.1-5.5). Nada aqui é
-- inferido; onde há decisão de forma, ela está nomeada como decisão de produto
-- (`po`, 19/08, critérios 16-21 do ticket) e não como regra fiscal.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- DEPENDIA, em dois lugares distintos, e este é o primeiro arquivo do repo em
-- que a resposta tem DUAS partes:
--
-- 1. TABELAS. Esta migration cria CINCO. No stack local do CLI o
--    `alter default privileges` do schema `public` está LIGADO — cada uma
--    nasceria com todos os privilégios para `anon` e `authenticated`. No
--    projeto remoto ele está desligado e elas nasceriam com privilégio NENHUM.
--    O `revoke ... from anon, authenticated` antes do `grant`, no fim do
--    arquivo, é o que faz local == remoto (incidente de 2026-08-17).
--
-- 2. FUNÇÕES — e aqui o default é do PRÓPRIO POSTGRES, não do stack local.
--    ⚠️ **Estas são as primeiras funções do repo** (`grep "create function"
--    supabase/migrations` não devolvia nada antes deste arquivo), e função
--    nasce com `execute` para `public` — em QUALQUER Postgres, local ou
--    remoto. Isso significa que `anon` (que herda de `public`) poderia
--    executá-las sem esta migration dizer nada. O `revoke execute ... from
--    public, anon` no fim é obrigatório, e não é simetria estética com o
--    revoke de tabela: sem ele o produto ganharia superfície anônima de
--    ESCRITA, que é pior do que a de leitura do incidente.
--    ⚠️ `e2e/privilegios.spec.ts` **só enxerga TABELA**
--    (`information_schema.role_table_grants`). Ele NÃO acusaria uma função
--    solta. Estender o teste para `routine_privileges` é proposta registrada
--    para o Gate 2 — o revoke/grant abaixo entra de qualquer forma.
--
-- Nenhuma sequence nasce aqui (toda PK é uuid com `gen_random_uuid()`);
-- nenhuma view. Enum, tabela, índice, policy, trigger, função e grant.

-- ══ Enums ═══════════════════════════════════════════════════════════════

-- O que foi corrigido. `pagamento` entra aqui porque o move do critério 13
-- mexe em `pagamento.obra_id` e em `pagamento_documento` — a linha de rastro
-- daquele pagamento é do pagamento, não do documento que motivou o ato.
create type entidade_revisao as enum ('documento', 'favorecido', 'pagamento');

-- Parecer §5: o motivo "carrega o §3 — é a primeira pergunta de um auditor".
-- Os três primeiros são a lista do parecer; o quarto vem do ADENDO §5 e é
-- gravado SOZINHO, sem perguntar: corrigir a obra não tem motivo possível
-- ("o papel não tem obra", e `emitente_corrigiu_a_nota` é impossível num campo
-- que não existe no documento). Não se grava "arquivado na obra errada" —
-- isso seria o app inferindo a CAUSA; o rastro registra FATO.
create type motivo_revisao as enum (
  'erro_de_digitacao_minha',
  'emitente_corrigiu_a_nota',
  'outro',
  'arquivamento_corrigido'
);

-- Duas pendências com CHAVES diferentes e listas de desfecho diferentes
-- (critérios 19, 20 e 21). Elas não se misturam, e é por isso que o tipo é
-- coluna e não convenção: a de retificadora é por ANO ("a DAA é do
-- contribuinte, não da obra"), a de emitente errado é por DOCUMENTO.
create type tipo_pendencia as enum ('retificadora_possivel', 'emitente_errado');

-- ⚠️ Os cinco desfechos, e a separação entre eles é FISCAL, não de rótulo.
-- Os três primeiros são do critério 21 e falam de DAA; os dois últimos são do
-- critério 19 e falam do apontamento do favorecido. Um check cruzado com
-- `tipo` (mais abaixo) impede que a lista errada chegue na pendência errada —
-- foi exatamente o erro que o `po` corrigiu em 19/08, quando o critério 19
-- ainda mandava baixar "pelo critério 21".
--
-- ⚠️ `apontamento_corrigido` NÃO TEM CAMINHO NA INTERFACE HOJE, e entra assim
-- mesmo. É a única baixa automática do sistema (critério 19), gravada pela
-- rodada 2 quando ela repontar `documento.favorecido_id`. Entra agora porque
-- `alter type ... add value` NÃO RODA DENTRO DE TRANSAÇÃO — a nota da
-- migration 0007 sobre isso vale aqui com o agravante de que, a partir do
-- primeiro `db push`, não há mais a liberdade de editar o arquivo no lugar.
-- O custo de deixá-lo declarado é zero; o de acrescentá-lo depois é uma
-- migration que não roda em transação.
create type desfecho_pendencia as enum (
  -- retificadora_possivel (critério 21)
  'retifiquei_a_daa',
  'contador_avaliou_nao_retifica',
  'daa_ainda_nao_entregue',
  -- emitente_errado (critério 19)
  'cnpj_gravado_esta_certo',
  'apontamento_corrigido'
);

-- ══ Rastro (parecer §5) ═════════════════════════════════════════════════
--
-- ⚠️ POR QUE TABELA PRÓPRIA, e não JSONB em `documento` nem versionamento do
-- próprio `documento` (viabilidade do `cto-obra`, 18/08):
-- 1. Privilégio no Postgres é POR TABELA, nunca por coluna. Append-only numa
--    coluna de `documento` seria promessa de código — e `documento` tem
--    UPDATE concedido desde a 0005, porque a correção precisa dele.
--    Aqui a ausência de UPDATE e DELETE é ESTRUTURAL: o parecer §5 exige
--    "append-only: sem update, sem delete, nem para o dono", e é o banco que
--    recusa, não a disciplina de quem escreve a próxima tela.
-- 2. Versionar `documento` quebraria `pagamento_documento`, que liga por id.
create table revisao (
  id            uuid primary key default gen_random_uuid(),

  -- ⚠️ UMA coluna, e ela é as DUAS coisas que o parecer §5 pede: o dono (que
  -- a RLS isola) e o "quem" do rastro. Hoje são a mesma pessoa por
  -- construção — `auth.uid()` é o único valor que a policy aceita gravar.
  -- Duas colunas defaultando ambas para `auth.uid()` poderiam DISCORDAR e não
  -- acrescentariam informação nenhuma (é o argumento do `dono_vinculo` na
  -- 0001 e das quatro dependentes da 0007). O dia em que existir conta
  -- compartilhada, `user_id` (dono do acervo) e `quem` (autor do ato) deixam
  -- de ser o mesmo fato — e é nesse ticket que a coluna nova entra, junto com
  -- o modelo que a torna verdadeira. A coluna existe hoje porque o acervo
  -- sobrevive ao single-user, que é o que o parecer §5 afirma.
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- O identificador do ATO (critério 13). Um move é N linhas aqui — o
  -- documento e cada pagamento — e UMA linha no histórico e na pendência
  -- (critérios 16 e 20): "no banco elas são granulares, na tela são uma
  -- correção só". Não é PK e não é único: é o agrupador.
  ato_id        uuid not null,

  entidade      entidade_revisao not null,

  -- ⚠️ SEM FK, e a ausência é a decisão (viabilidade do `cto-obra`): nada
  -- neste banco é apagado, e um `on delete cascade` aqui faria o rastro sumir
  -- junto com aquilo que ele existe para provar. O que garante a integridade é
  -- que não há caminho de DELETE em `documento`, `favorecido` nem `pagamento`
  -- (migrations 0005 e 0007: nenhuma delas recebeu o privilégio).
  entidade_id   uuid not null,

  -- Texto, e não enum, por dois motivos: (a) a lista corrigível CRESCE sem
  -- reabrir gate fiscal quando o CONTAI-004 trouxer `numero`/`serie`
  -- (parecer §1), e `alter type ... add value` não roda em transação;
  -- (b) o par (entidade, campo) é o que precisa ser fechado, e isso é um
  -- check — que se altera em transação. Ver `revisao_campo_da_entidade`.
  campo         text not null,

  -- ⚠️ COMO TEXTO, e o parecer §5 diz por quê: "texto preserva `null`, zeros à
  -- esquerda e enum". `null` em `antes` é o "(em branco)" da tela s3c — o
  -- documento que entrou SEM valor (dor D-018.5). Zero é um valor; branco é a
  -- ausência dele, e gravar 0 no lugar de null apagaria a diferença.
  antes         text,
  depois        text,

  quando        timestamptz not null default now(),

  motivo        motivo_revisao not null,
  -- Só quando `motivo = 'outro'`: a lista curta do §5 tem texto livre nessa
  -- opção, e só nela.
  motivo_texto  text,

  created_at    timestamptz not null default now(),

  -- O par (entidade, campo) é FECHADO. Sem isto, "favorecido.valor" seria
  -- gravável e o histórico de 2034 teria linhas que não descrevem fato nenhum.
  -- 'vinculo' é o desfecho (ii) do critério 13: o pagamento se desliga do
  -- papel, e o que muda nele não é uma coluna — é a ligação.
  constraint revisao_campo_da_entidade check (
    (entidade = 'documento'  and campo in ('valor', 'classificacao', 'obra')) or
    (entidade = 'favorecido' and campo in ('nome')) or
    (entidade = 'pagamento'  and campo in ('obra', 'vinculo'))
  ),
  -- Correção que não corrige nada não vira linha (trava (a) da tela s3d):
  -- "gravar assim criaria uma linha de histórico de uma correção que não
  -- aconteceu".
  constraint revisao_antes_difere_depois check (antes is distinct from depois),
  -- Texto livre existe em 'outro' e só nele. Nos outros três o motivo já é a
  -- resposta inteira, e um campo livre ao lado vira lugar de guardar o que
  -- ninguém relê.
  constraint revisao_motivo_texto_coerente
    check ((motivo = 'outro') = (motivo_texto is not null))
);

-- ── O snapshot de anos afetados, POR OBRA (parecer §5 + adendo §5.4) ─────
--
-- ⚠️ A DIMENSÃO `obra_id` É OBRIGATÓRIA, e não é detalhe: o critério 20(c)
-- ("afetada é a candidata cujo custo daquele ano efetivamente mudou") é
-- IMPOSSÍVEL de implementar sem ela. Um snapshot só por ano diria que 2025
-- mudou e não diria ONDE — e depois de um move o documento só conhece o
-- DESTINO, de modo que a origem (o lado onde o custo caiu e onde "pago sem
-- nota" subiu) perderia o alarme. O adendo §5.4 chama isso de "o pior
-- resultado possível desta tela".
--
-- Tabela e não JSONB: aqui o dado é lido para DECIDIR (abre pendência? em qual
-- obra?), e `custo_antes <> custo_depois` precisa ser um predicado com tipo,
-- não uma chave de objeto que ninguém valida.
--
-- ⚠️ SÓ ENTRAM AS LINHAS QUE MUDARAM. A candidata cujo custo não se mexeu
-- naquele ano não vira linha — é o que faz a tela s8b dizer "anos afetados:
-- nenhum — o custo não mudou em obra nenhuma", e é o filtro do critério 20(c)
-- aplicado na ESCRITA em vez da leitura. O conjunto `antes ∪ depois` do campo
-- `obra` continua sendo o de CANDIDATAS: quem o calcula é
-- `lib/fiscal/revisao.ts`, com teste unitário, e o que chega aqui já é o
-- resultado do filtro. Registrar "Reforma 2026: 0 → 0" seria ruído numa
-- tabela cuja razão de existir é ser legível em 2034.
create table revisao_ano_afetado (
  id           uuid primary key default gen_random_uuid(),
  revisao_id   uuid not null references revisao(id) on delete cascade,

  -- SEM FK, mesma razão de `entidade_id`: a obra não é apagada pelo app, e o
  -- alarme não pode sumir junto com nada.
  obra_id      uuid not null,

  -- Ano-calendário do CUSTO, que é o da DATA DO PAGAMENTO (regime de caixa).
  -- ⚠️ Nunca o da emissão: "nenhuma data do `documento` move custo entre
  -- anos-calendário" (parecer §0(a)).
  ano          integer not null,

  custo_antes  numeric(14,2) not null,
  custo_depois numeric(14,2) not null,

  -- A pendência de retificadora que esta linha ALIMENTA, ou `null` quando o
  -- ano é o corrente (o número se corrige sozinho antes da DAA — §5.3).
  -- É por aqui que a pendência sabe quais correções a compõem e quais obras
  -- ela atinge: 1:N, sem tabela de ligação, porque uma linha (revisão, ano,
  -- obra) pertence a no máximo uma pendência daquele ano.
  -- A FK é declarada logo depois de `pendencia` existir (ela nasce abaixo).
  pendencia_id uuid,

  constraint revisao_ano_mudou check (custo_antes <> custo_depois),
  constraint revisao_ano_unico unique (revisao_id, obra_id, ano)
);

-- ── Anexo adicional (critérios 10 e 18; parecer §1, linha `arquivo_path`) ─
--
-- "O anexo é a prova. Não se substitui — ANEXA-SE ADICIONAL." `documento`
-- continua com um `arquivo_path` só, e ele nunca é reescrito. A carta de
-- correção ou a nota substitutiva entra AQUI, no mesmo ato da correção
-- (critério 10: sem ela, `motivo = 'emitente_corrigiu_a_nota'` não grava).
--
-- ⚠️ Não é registro novo de documento (critério 18): o app não tem estado
-- "cancelada" para aposentar o antigo, e dois documentos vivos para o mesmo
-- fato dobrariam `Σ documentos` e inflariam o custo comprovado sem que nada
-- tivesse sido pago a mais.
create table documento_anexo (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- COM FK, ao contrário de `revisao.entidade_id`: isto é parte do acervo DO
  -- documento, não uma referência ao passado. Órfão aqui seria arquivo sem
  -- dono no bucket. `documento` não tem DELETE concedido a `authenticated`, e
  -- por isso o cascade não é caminho — é rede.
  documento_id uuid not null references documento(id) on delete cascade,
  arquivo_path text not null,
  -- O ato que o trouxe. É ele que responde, em 2034, "qual valor veio de qual
  -- papel" (critério 18).
  revisao_id   uuid references revisao(id),
  created_at   timestamptz not null default now()
);

-- ══ Pendências persistentes (critérios 4, 19, 20 e 21) ══════════════════
--
-- Parecer §6.3: "aviso que só existe no momento do clique é aviso que não
-- existiu". E a regra que atravessa o adendo de 19/08: **pendência persistente
-- só nasce quando a correção muda um NÚMERO que foi ou será declarado.**
-- Correção de identificação (nome), de composição (material × mão de obra) ou
-- de arquivamento sem número atrás gera rastro e aviso — nunca linha aqui.
create table pendencia (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo         tipo_pendencia not null,

  -- `retificadora_possivel`: a chave é o ANO, e só ele. "A DAA é do
  -- contribuinte, não da obra" (adendo §5.4) — uma retificadora de 2025
  -- corrige as linhas de TODAS as obras no mesmo ato, e o desfecho do critério
  -- 21 não é divisível por obra. As obras atingidas saem de
  -- `revisao_ano_afetado`, nunca de `documento.obra_id`.
  ano          integer,

  -- `emitente_errado`: a chave é o DOCUMENTO (critério 19, corrigido pelo `po`
  -- em 19/08). SEM FK, como `revisao.entidade_id`.
  documento_id uuid,

  aberta_em    timestamptz not null default now(),

  -- O par (id, tipo) existe para o FK composto de `pendencia_desfecho`: é ele
  -- que impede a lista de desfecho errada chegar na pendência errada.
  constraint pendencia_id_tipo unique (id, tipo),

  -- Cada tipo carrega EXATAMENTE a sua chave, e a do outro fica nula. Sem
  -- isto, uma pendência de ano com `documento_id` preenchido seria gravável e
  -- ninguém saberia qual dos dois manda.
  constraint pendencia_chave_do_tipo check (
    (tipo = 'retificadora_possivel' and ano is not null and documento_id is null) or
    (tipo = 'emitente_errado'       and documento_id is not null and ano is null)
  )
);

alter table revisao_ano_afetado
  add constraint revisao_ano_afetado_pendencia
  foreign key (pendencia_id) references pendencia(id);

-- ── A baixa: INSERT, nunca UPDATE (critérios 19 e 21) ───────────────────
--
-- "A pendência SAI DA LISTA e fica no HISTÓRICO — quem, quando, qual desfecho,
-- legível em 2034." Tabela separada porque `pendencia` não tem (e não pode
-- ter) UPDATE: a baixa é um FATO NOVO acrescentado, não a edição do fato
-- anterior. É a mesma disciplina do rastro (critério 8), e é o que faz
-- "correção nova depois da baixa abre pendência NOVA" ser a única leitura
-- possível — a antiga não tem como reabrir, porque nada nela é editável.
--
-- PK = `pendencia_id`: uma pendência se baixa UMA vez.
create table pendencia_desfecho (
  pendencia_id uuid primary key references pendencia(id),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- Desnormalizado de propósito, e é o que sustenta o FK composto abaixo.
  tipo         tipo_pendencia not null,
  desfecho     desfecho_pendencia not null,

  -- A data que o Mateus informa ("retifiquei em 18/08/2026"). Distinta de
  -- `baixada_em`, que é quando ele CLICOU: o desfecho descreve um fato do
  -- mundo, com a data do mundo.
  data_informada date,
  baixada_em   timestamptz not null default now(),

  -- ⚠️ O FK COMPOSTO. Sem ele, `cnpj_gravado_esta_certo` seria gravável numa
  -- pendência de retificadora — e os três desfechos do critério 21 são TODOS
  -- sobre DAA, nenhum descreve "resolvi o CNPJ errado". Foi exatamente essa
  -- confusão que o `po` corrigiu em 19/08.
  constraint pendencia_desfecho_do_mesmo_tipo
    foreign key (pendencia_id, tipo) references pendencia(id, tipo),

  constraint pendencia_desfecho_da_lista_do_tipo check (
    (tipo = 'retificadora_possivel' and desfecho in (
      'retifiquei_a_daa', 'contador_avaliou_nao_retifica', 'daa_ainda_nao_entregue'
    )) or
    (tipo = 'emitente_errado' and desfecho in (
      'cnpj_gravado_esta_certo', 'apontamento_corrigido'
    ))
  ),

  -- Quem afirma entrega, data. "A DAA ainda não foi entregue" não pede data
  -- porque não houve entrega a datar (tela s7d), e `apontamento_corrigido` é
  -- automático — a data dele é `baixada_em`.
  constraint pendencia_desfecho_data_coerente check (
    (desfecho in ('daa_ainda_nao_entregue', 'apontamento_corrigido') and data_informada is null)
    or
    (desfecho in ('retifiquei_a_daa', 'contador_avaliou_nao_retifica', 'cnpj_gravado_esta_certo')
     and data_informada is not null)
  )
);

-- ── UMA pendência ABERTA por chave — e a guarda é do BANCO ──────────────
--
-- "Marcar duas vezes continua sendo uma pendência" (critério 19) e "cinco
-- correções em 2025 são UMA linha" (critério 20). Isso não pode ser promessa
-- da função: função é código, e o critério 8 já estabeleceu que a proteção
-- deste ticket é estrutural.
--
-- ⚠️ POR QUE TRIGGER E NÃO UNIQUE INDEX: "aberta" é a AUSÊNCIA de linha em
-- `pendencia_desfecho` — outra tabela. Índice parcial não enxerga outra
-- tabela, e a alternativa (uma coluna `baixada` em `pendencia`) exigiria
-- UPDATE nesta tabela, que é justamente o que os critérios 19 e 21 proíbem.
-- O trigger roda como o invocador, então a RLS vale dentro dele: ele só
-- enxerga as pendências do próprio dono, que é a semântica correta.
--
-- ⚠️ LIMITE CONHECIDO: dois INSERTs concorrentes na mesma chave passariam os
-- dois (o trigger lê antes de o outro ter commitado). É single-user, e a
-- consequência seria duas linhas iguais na lista — visível e não destrutiva.
-- Endurecer para `pg_advisory_xact_lock` é proposta para o Gate 2, não uma
-- correção silenciosa aqui.
create function pendencia_uma_aberta_por_chave() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
      from pendencia p
     where p.tipo = new.tipo
       and p.ano is not distinct from new.ano
       and p.documento_id is not distinct from new.documento_id
       and not exists (select 1 from pendencia_desfecho d where d.pendencia_id = p.id)
  ) then
    raise exception 'ja existe pendencia aberta para esta chave'
      using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

create trigger pendencia_uma_aberta
  before insert on pendencia
  for each row execute function pendencia_uma_aberta_por_chave();

-- ══ Índices ═════════════════════════════════════════════════════════════
create index idx_revisao_entidade on revisao (user_id, entidade, entidade_id, quando);
-- O agrupamento por ATO (critério 16: o move é UMA linha no histórico).
create index idx_revisao_ato on revisao (ato_id);
create index idx_revisao_ano_pendencia on revisao_ano_afetado (pendencia_id);
create index idx_revisao_ano_obra on revisao_ano_afetado (obra_id, ano);
create index idx_documento_anexo_documento on documento_anexo (documento_id, created_at);
create index idx_pendencia_user on pendencia (user_id, tipo, ano);
create index idx_pendencia_documento on pendencia (documento_id);

-- ══ RLS ═════════════════════════════════════════════════════════════════
alter table revisao             enable row level security;
alter table revisao_ano_afetado enable row level security;
alter table documento_anexo     enable row level security;
alter table pendencia           enable row level security;
alter table pendencia_desfecho  enable row level security;

create policy dono_revisao on revisao for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy dono_documento_anexo on documento_anexo for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy dono_pendencia on pendencia for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy dono_pendencia_desfecho on pendencia_desfecho for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- `revisao_ano_afetado` NÃO tem `user_id` próprio: o dono é DERIVADO da
-- revisão-pai, no molde de `dono_vinculo` (0001) e das quatro dependentes da
-- 0007. Uma coluna própria poderia DISCORDAR do pai — nasceria a linha que a
-- RLS deixa você ver mas cuja revisão é de outra conta. Derivando, a
-- discordância é impossível de representar.
create policy dono_revisao_ano_afetado on revisao_ano_afetado for all
  using (exists (select 1 from revisao r where r.id = revisao_id and r.user_id = auth.uid()))
  with check (exists (select 1 from revisao r where r.id = revisao_id and r.user_id = auth.uid()));

-- ══ Funções transacionais (critério 9; adendo §5.5) ═════════════════════
--
-- ⚠️ POR QUE FUNÇÃO, e não duas chamadas do app: "o PostgREST não dá transação
-- entre tabelas, e das duas ordens possíveis uma deixa rastro de correção que
-- não aconteceu e a outra deixa correção sem rastro" (critério 9). O adendo
-- §5.5 é explícito: "se a transação não fechar, NADA MUDA — o estado anterior
-- é errado de arquivamento, o estado partido é errado de número". Toda função
-- abaixo roda dentro da transação implícita da chamada: uma exceção desfaz o
-- ato inteiro, que é o que a tela s3e promete ("nada foi alterado").
--
-- ── AS TRÊS DECISÕES, TOMADAS EXPLICITAMENTE ────────────────────────────
--
-- (a) `security invoker` — TODAS. Não é o default do Postgres para funções
--     (que é `security invoker`, sim, mas o hábito no ecossistema Supabase é
--     o contrário), e é decisão, não omissão: `security definer` FURA A RLS.
--     Com ele, um bug de filtro na função vira acesso a linha de outra conta,
--     e o append-only volta a ser promessa de código — a função poderia
--     apagar rastro, porque rodaria como dono da tabela. Com `invoker`, o
--     que a policy barra para o app está barrado DENTRO da função: ela não
--     pode fazer nada que o `authenticated` não pudesse fazer sozinho. O que
--     ela acrescenta é ATOMICIDADE e ORDEM, que é exatamente o que falta ao
--     PostgREST — e nada mais.
--     Consequência aceita: os GRANTs de tabela continuam sendo a autoridade,
--     e é por isso que `revisao` seguir sem UPDATE/DELETE basta.
--
-- (b) `set search_path = public, pg_temp` — fixado em todas. Sem isso, um
--     schema no `search_path` do chamador poderia sequestrar o nome de uma
--     tabela ou de um operador dentro do corpo.
--
-- (c) `revoke execute from public, anon` + `grant execute to authenticated`,
--     no fim do arquivo. Ver a segunda parte da pergunta obrigatória, no
--     cabeçalho.

-- ── Auxiliar: a pendência ABERTA daquele ano, ou uma nova ───────────────
--
-- "Havendo pendência aberta para 2025, toda correção seguinte que mexa em 2025
-- ACUMULA NELA" (critério 20a). Acumular é apontar a linha nova de
-- `revisao_ano_afetado` para a pendência que já existe — nada nela é editado.
--
-- ⚠️ Não tem caminho na interface e não deveria ter: quem a chama são as duas
-- funções de correção abaixo. Ela recebe EXECUTE junto com elas porque as
-- funções são `security invoker` — sem o privilégio, a chamada de dentro
-- falharia com o `authenticated` do app.
create function pendencia_do_ano(p_ano integer) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  select p.id into v_id
    from pendencia p
   where p.tipo = 'retificadora_possivel'
     and p.ano = p_ano
     and not exists (select 1 from pendencia_desfecho d where d.pendencia_id = p.id)
   limit 1;

  if v_id is null then
    insert into pendencia (tipo, ano) values ('retificadora_possivel', p_ano)
      returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- ── Auxiliar: grava o snapshot de anos afetados de UMA revisão ─────────
--
-- `p_anos` é um array de objetos, e o formato é contrato com `lib/data.ts`:
--   [{"ano":2025,"obra_id":"…","custo_antes":12400.00,"custo_depois":23920.00,
--     "pendencia":true}]
--
-- `pendencia` é decidido em `lib/fiscal/revisao.ts`, com teste unitário, e não
-- aqui: a fronteira do §5.3 ("delta em ano ANTERIOR ao corrente") depende do
-- "hoje" do aparelho, e o Postgres do container tem o relógio dele — o mesmo
-- desencontro que já produz o `JWT issued at future` do CLAUDE.md. Regra
-- fiscal que depende de "hoje" mora onde o "hoje" é injetável e testável.
create function revisao_gravar_anos(p_revisao_id uuid, p_anos jsonb) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ano jsonb;
  v_pendencia uuid;
begin
  if p_anos is null then return; end if;

  for v_ano in select * from jsonb_array_elements(p_anos) loop
    if (v_ano ->> 'pendencia')::boolean then
      v_pendencia := pendencia_do_ano((v_ano ->> 'ano')::integer);
    else
      v_pendencia := null;
    end if;

    insert into revisao_ano_afetado
      (revisao_id, obra_id, ano, custo_antes, custo_depois, pendencia_id)
    values (
      p_revisao_id,
      (v_ano ->> 'obra_id')::uuid,
      (v_ano ->> 'ano')::integer,
      (v_ano ->> 'custo_antes')::numeric,
      (v_ano ->> 'custo_depois')::numeric,
      v_pendencia
    );
  end loop;
end;
$$;

-- ── Corrigir um campo do documento (critérios 3, 5, 7, 9, 10) ──────────
--
-- Um ato: UPDATE + rastro + (quando houver) anexo adicional + snapshot +
-- pendência. `antes` é LIDO AQUI, do próprio banco — o app não o informa. Não
-- é desconfiança do app: é que o `antes` é o que está gravado no instante da
-- gravação, e deixá-lo vir da tela abriria a janela entre carregar e gravar.
create function corrigir_documento(
  p_documento_id uuid,
  p_campo        text,
  p_depois       text,
  p_motivo       motivo_revisao,
  p_motivo_texto text,
  p_anos         jsonb,
  p_anexo_path   text
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ato     uuid := gen_random_uuid();
  v_revisao uuid;
  v_antes   text;
begin
  if p_campo not in ('valor', 'classificacao') then
    raise exception 'campo % nao e corrigivel por esta acao', p_campo;
  end if;

  -- Parecer §5, regra dura 2: "se motivo = emitente corrigiu a nota, o
  -- documento novo é anexado NO MESMO ATO". Sem ele, o app passaria a divergir
  -- do papel na direção oposta — o mesmo defeito com outro sinal. A guarda é
  -- do banco porque a promessa é do ato, não da tela.
  if p_motivo = 'emitente_corrigiu_a_nota' and p_anexo_path is null then
    raise exception 'motivo emitente_corrigiu_a_nota exige o documento novo anexado no mesmo ato';
  end if;

  -- `arquivamento_corrigido` é motivo de OUTRO ato (mover de obra), e não se
  -- escolhe numa tela que pergunta motivo (adendo §5).
  if p_motivo = 'arquivamento_corrigido' then
    raise exception 'arquivamento_corrigido e o motivo do move, nao de correcao de campo';
  end if;

  if p_campo = 'valor' then
    -- `numeric(14,2)::text` e não `to_char`: o `FM` do to_char come o zero à
    -- esquerda de valores abaixo de 1 (".50"), e o §5 grava antes/depois como
    -- texto justamente para NÃO perder forma. `null` continua `null`.
    select d.valor::text into v_antes
      from documento d where d.id = p_documento_id;
    update documento set valor = p_depois::numeric where id = p_documento_id;
  else
    select d.classificacao::text into v_antes
      from documento d where d.id = p_documento_id;
    update documento set classificacao = p_depois::classificacao where id = p_documento_id;
  end if;

  if not found then
    raise exception 'documento % nao encontrado', p_documento_id;
  end if;

  insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
  values (v_ato, 'documento', p_documento_id, p_campo, v_antes, p_depois, p_motivo, p_motivo_texto)
  returning id into v_revisao;

  -- ⚠️ ANEXO ADICIONAL, nunca substituição: `documento.arquivo_path` não é
  -- tocado em lugar nenhum desta função (parecer §1, linha `arquivo_path`).
  if p_anexo_path is not null then
    insert into documento_anexo (documento_id, arquivo_path, revisao_id)
    values (p_documento_id, p_anexo_path, v_revisao);
  end if;

  perform revisao_gravar_anos(v_revisao, p_anos);
  return v_ato;
end;
$$;

-- ── Corrigir o nome do favorecido (critério 6) ─────────────────────────
--
-- O ÚNICO caminho pelo qual um nome de favorecido muda desde o `b807901`
-- (`garantirFavorecido` usa `ignoreDuplicates` justamente para nunca
-- renomear). Sem anos afetados e sem pendência: "o custo não muda um centavo,
-- e pendência persistente só nasce quando a correção muda um número
-- declarado" (adendo §4). Aviso e rastro, e acabou.
create function corrigir_nome_favorecido(
  p_favorecido_id uuid,
  p_nome          text,
  p_motivo        motivo_revisao,
  p_motivo_texto  text
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ato   uuid := gen_random_uuid();
  v_antes text;
begin
  if p_motivo = 'arquivamento_corrigido' then
    raise exception 'arquivamento_corrigido e o motivo do move, nao de correcao de nome';
  end if;

  select f.nome into v_antes from favorecido f where f.id = p_favorecido_id;
  if v_antes is null then
    raise exception 'favorecido % nao encontrado', p_favorecido_id;
  end if;

  -- ⚠️ `documento` (a string CNPJ/CPF) NÃO aparece neste update, e a ausência
  -- é a regra: "a string CNPJ/CPF de um favorecido existente NUNCA é
  -- reescrita" (parecer §1 e §4.2). O que é corrigível é o PONTEIRO
  -- `documento.favorecido_id`, e ele é a rodada 2.
  update favorecido set nome = p_nome where id = p_favorecido_id;

  insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
  values (v_ato, 'favorecido', p_favorecido_id, 'nome', v_antes, p_nome, p_motivo, p_motivo_texto);

  return v_ato;
end;
$$;

-- ── Mover o documento de obra (critério 13 — o bug que está EM PRODUÇÃO) ─
--
-- `moverDocumentoDeObra` era um `UPDATE documento SET obra_id` SECO: não
-- tocava `pagamento.obra_id`, não tocava `pagamento_documento`, não gravava
-- rastro. O efeito real (adendo §5.1, retratação de 19/08): o custo do ano
-- CAI na origem, o "pago sem nota" da origem SOBE pelo mesmo valor — alarme
-- vermelho da meta 1 por um fato que não aconteceu —, NADA sobe no destino, e
-- fica vínculo vivo cruzando duas obras, invisível nas duas telas. "Não é
-- transferência, é evaporação."
--
-- `p_pagamentos` é o array de decisões, uma por pagamento vinculado:
--   [{"pagamento_id":"…","desfecho":"vai_junto"}]
--   [{"pagamento_id":"…","desfecho":"fica_na_origem"}]
-- Não existe terceira saída, e o ato NÃO CONCLUI COM PAGAMENTO INDECISO — a
-- guarda está abaixo, no banco, e não só na tela.
create function mover_documento_de_obra(
  p_documento_id  uuid,
  p_obra_destino  uuid,
  p_pagamentos    jsonb,
  p_anos          jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ato     uuid := gen_random_uuid();
  v_revisao uuid;
  v_origem  uuid;
  v_item    jsonb;
  v_pag     uuid;
  v_habeis  integer;
begin
  select d.obra_id into v_origem from documento d where d.id = p_documento_id;
  if v_origem is null then
    raise exception 'documento % nao encontrado', p_documento_id;
  end if;
  if v_origem = p_obra_destino then
    raise exception 'o documento ja esta nesta obra';
  end if;

  -- ⚠️ "O ato não conclui com pagamento indeciso" (critério 13). Todo
  -- pagamento hoje vinculado a este documento tem de aparecer em
  -- `p_pagamentos` com um dos dois desfechos. Se a tela esquecer um, o banco
  -- recusa o ato inteiro — em vez de deixar nascer o vínculo cruzando obras
  -- que este ticket existe para matar.
  if exists (
    select 1 from pagamento_documento pd
     where pd.documento_id = p_documento_id
       and not exists (
         select 1 from jsonb_array_elements(coalesce(p_pagamentos, '[]'::jsonb)) e
          where (e ->> 'pagamento_id')::uuid = pd.pagamento_id
       )
  ) then
    raise exception 'ha pagamento vinculado sem desfecho escolhido';
  end if;

  update documento set obra_id = p_obra_destino where id = p_documento_id;

  insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
  values (v_ato, 'documento', p_documento_id, 'obra', v_origem::text, p_obra_destino::text,
          'arquivamento_corrigido', null)
  returning id into v_revisao;

  for v_item in select * from jsonb_array_elements(coalesce(p_pagamentos, '[]'::jsonb)) loop
    v_pag := (v_item ->> 'pagamento_id')::uuid;

    if (v_item ->> 'desfecho') = 'vai_junto' then
      -- ⚠️ Guarda contra recriar o bug pelo outro lado: se este pagamento
      -- também comprova OUTRO documento que fica na origem, movê-lo deixaria
      -- ESSE vínculo cruzando duas obras. É o mesmo estado inválido, com os
      -- papéis trocados. Recusa com motivo, nunca em silêncio.
      if exists (
        select 1 from pagamento_documento pd
         where pd.pagamento_id = v_pag and pd.documento_id <> p_documento_id
      ) then
        raise exception 'pagamento % tambem esta ligado a outro documento desta obra', v_pag;
      end if;

      update pagamento set obra_id = p_obra_destino where id = v_pag;
      insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
      values (v_ato, 'pagamento', v_pag, 'obra', v_origem::text, p_obra_destino::text,
              'arquivamento_corrigido', null);

    elsif (v_item ->> 'desfecho') = 'fica_na_origem' then
      -- O vínculo se desfaz, com registro, e o pagamento volta a "pago sem
      -- nota" na origem — que aí é A VERDADE: a nota de outro imóvel nunca
      -- comprovou aquele pagamento (adendo §5.2(ii)).
      delete from pagamento_documento
       where pagamento_id = v_pag and documento_id = p_documento_id;

      insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
      values (v_ato, 'pagamento', v_pag, 'vinculo', p_documento_id::text, null,
              'arquivamento_corrigido', null);

      -- `status` é CONSEQUÊNCIA do vínculo (mesma nota de `apagarVinculo` em
      -- lib/data.ts) e não entra em cálculo fiscal nenhum. Fica dentro do ato
      -- porque aqui há transação — a inconsistência de meio caminho que o app
      -- tolerava lá não precisa ser tolerada aqui.
      select count(*) into v_habeis
        from pagamento_documento pd
        join documento d on d.id = pd.documento_id
       where pd.pagamento_id = v_pag
         and d.tipo <> 'boleto'
         and d.status <> 'quarentena';
      if v_habeis = 0 then
        update pagamento set status = 'aguardando_nf' where id = v_pag;
      end if;

    else
      raise exception 'desfecho % desconhecido — so existem vai_junto e fica_na_origem',
        v_item ->> 'desfecho';
    end if;
  end loop;

  perform revisao_gravar_anos(v_revisao, p_anos);
  return v_ato;
end;
$$;

-- ── Marcar "o CNPJ deste registro está errado" (critério 19) ────────────
--
-- IDEMPOTENTE: "voltar e marcar de novo deixa a lista com uma linha só — não
-- existe 'marcado duas vezes'". Não toca `status`, não toca quarentena, não
-- abre campo. E NÃO gera linha de `revisao`: nenhum dado do documento mudou,
-- não há antes→depois a registrar (adendo §1). O que existe é a pendência
-- aberta, com a data.
create function marcar_emitente_errado(p_documento_id uuid) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from documento d where d.id = p_documento_id) then
    raise exception 'documento % nao encontrado', p_documento_id;
  end if;

  select p.id into v_id
    from pendencia p
   where p.tipo = 'emitente_errado'
     and p.documento_id = p_documento_id
     and not exists (select 1 from pendencia_desfecho d where d.pendencia_id = p.id)
   limit 1;

  if v_id is null then
    insert into pendencia (tipo, documento_id) values ('emitente_errado', p_documento_id)
      returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- ── Baixar a pendência, com desfecho escolhido (critérios 19 e 21) ─────
--
-- "Só o Mateus baixa, em ato nomeado" — nunca ao fechar a tela, nunca em lote,
-- nunca automático, nunca sugerido pelo app. O `tipo` é LIDO da pendência e
-- não recebido: é ele que o FK composto e o check usam para recusar a lista de
-- desfecho errada, e deixá-lo vir da tela seria deixar a tela escolher qual
-- regra se aplica a ela mesma.
create function baixar_pendencia(
  p_pendencia_id uuid,
  p_desfecho     desfecho_pendencia,
  p_data         date
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_tipo tipo_pendencia;
begin
  select p.tipo into v_tipo from pendencia p where p.id = p_pendencia_id;
  if v_tipo is null then
    raise exception 'pendencia % nao encontrada', p_pendencia_id;
  end if;

  -- A PK de `pendencia_desfecho` já recusaria a segunda baixa; a mensagem
  -- explícita existe para a tela ter o que dizer.
  if exists (select 1 from pendencia_desfecho d where d.pendencia_id = p_pendencia_id) then
    raise exception 'esta pendencia ja foi baixada';
  end if;

  insert into pendencia_desfecho (pendencia_id, tipo, desfecho, data_informada)
  values (p_pendencia_id, v_tipo, p_desfecho, p_data);
end;
$$;

-- ══ REVOKE antes do GRANT — é o que faz local == remoto (0005) ══════════
revoke all privileges on table
  revisao, revisao_ano_afetado, documento_anexo, pendencia, pendencia_desfecho
  from anon, authenticated;

-- `anon` não recebe NADA. A base guarda CPF, CNO e as notas da obra; não
-- existe acesso anônimo no produto. A ausência é a decisão.

-- ── `authenticated`: só o verbo que o app executa ──────────────────────
--
-- ⚠️ NENHUMA DAS CINCO TEM UPDATE OU DELETE, e nas cinco a ausência é a
-- decisão — não o esquecimento:
-- * `revisao` — parecer §5, regra dura 1: "append-only: sem update, sem
--   delete, NEM PARA O DONO". É o critério 8 do ticket, e é a razão de a
--   tabela existir em vez de uma coluna em `documento`.
-- * `revisao_ano_afetado` — é o snapshot que sustenta a conversa de
--   retificadora anos depois. Editável, ele deixaria de ser prova.
-- * `documento_anexo` — o acervo só cresce; o bucket já é append-only
--   (0002 não tem policy de delete).
-- * `pendencia` — a baixa é INSERT em `pendencia_desfecho`, nunca update
--   aqui (critérios 19 e 21). Sem UPDATE, "reabrir a antiga" é impossível de
--   representar, que é o objetivo: reabrir apagaria o fato de que ela foi
--   tratada.
-- * `pendencia_desfecho` — o desfecho é o fato que fica legível em 2034.
grant select, insert on table revisao             to authenticated;
grant select, insert on table revisao_ano_afetado to authenticated;
grant select, insert on table documento_anexo     to authenticated;
grant select, insert on table pendencia           to authenticated;
grant select, insert on table pendencia_desfecho  to authenticated;

-- ── EXECUTE: função nasce com `execute` para `public` ──────────────────
-- Ver a segunda parte da pergunta obrigatória, no cabeçalho. `public` inclui
-- `anon`; o revoke abaixo é o que tira do anônimo o direito de EXECUTAR
-- escrita. As duas auxiliares (`pendencia_do_ano`, `revisao_gravar_anos`)
-- recebem EXECUTE porque as funções que as chamam são `security invoker`:
-- sem o privilégio, a chamada de dentro falharia com o papel do app.
-- A função do trigger fica de fora — trigger não é executado pelo chamador.
revoke execute on function
  pendencia_do_ano(integer),
  revisao_gravar_anos(uuid, jsonb),
  corrigir_documento(uuid, text, text, motivo_revisao, text, jsonb, text),
  corrigir_nome_favorecido(uuid, text, motivo_revisao, text),
  mover_documento_de_obra(uuid, uuid, jsonb, jsonb),
  marcar_emitente_errado(uuid),
  baixar_pendencia(uuid, desfecho_pendencia, date)
  from public, anon;

grant execute on function
  pendencia_do_ano(integer),
  revisao_gravar_anos(uuid, jsonb),
  corrigir_documento(uuid, text, text, motivo_revisao, text, jsonb, text),
  corrigir_nome_favorecido(uuid, text, motivo_revisao, text),
  mover_documento_de_obra(uuid, uuid, jsonb, jsonb),
  marcar_emitente_errado(uuid),
  baixar_pendencia(uuid, desfecho_pendencia, date)
  to authenticated;
