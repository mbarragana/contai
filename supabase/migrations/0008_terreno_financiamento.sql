-- CONTAI-010 — o terreno deixa de ser três escalares e vira desembolsos
-- DATADOS + o informe anual do financiamento.
--
-- Fonte normativa: docs/pareceres/2026-08-17-terreno-financiado.md (corpo,
-- adendo 1, adendo 2, adendo 3 e ⚠️ ADENDO 4) e o Gate Fiscal do CONTAI-010.
-- Nada aqui é inferido.
--
-- ── O defeito que esta migration conserta ────────────────────────────────
-- `obra.valor_terreno` + `valor_itbi` + `valor_escritura_registro` eram três
-- números SEM DATA, e `lib/fiscal/resumo.ts` os injetava INTEIROS em TODO ano.
-- Custo de aquisição é regime de caixa por ano-calendário: a chave é a DATA DO
-- PAGAMENTO. Terreno pago em 2024 e ITBI recolhido em 2025 são custo de anos
-- diferentes — com uma data só (ou nenhuma), a situação de 31/12/2024 sai
-- inflada por um imposto ainda não pago e a de 2025 sai sem ele. Declarada a
-- maior num ano e a menor no outro, nos dois casos sem lastro de desembolso.
--
-- E há um segundo defeito, mais caro: o terreno do Mateus é FINANCIADO
-- (~20 anos, só o terreno), e o financiamento não tinha onde morar. Um ano
-- inteiro de amortização + juros/correção ficava fora do sistema.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- DEPENDIA, e é o mesmo cenário do incidente de 2026-08-17: esta migration
-- CRIA TRÊS TABELAS. No stack local do CLI o `alter default privileges` do
-- schema `public` está LIGADO — as três nasceriam com TODOS os privilégios
-- para `anon` e `authenticated`. No projeto remoto esse default está desligado
-- e elas nasceriam com privilégio NENHUM. Sem o `revoke` + `grant` do fim
-- deste arquivo, o E2E rodaria num banco mais permissivo que a produção e a
-- suíte ficaria verde enquanto o app publicado devolvia
-- `{"code":"42501","message":"permission denied for table financiamento"}`
-- depois de um login bem-sucedido. Depois das linhas do fim, NÃO DEPENDE MAIS:
-- o banco local passa a ter exatamente os privilégios do remoto, e
-- `e2e/privilegios.spec.ts` acusa qualquer divergência pelo nome da tabela.
--
-- Nenhuma sequence nasce aqui (toda PK é uuid com `gen_random_uuid()`);
-- nenhuma view, nenhuma função. Nada além de tabela, enum, coluna, índice,
-- policy e grant. As colunas com default do servidor são `id`
-- (`gen_random_uuid()`), `user_id` (`auth.uid()`) e `created_at` (`now()`) —
-- as três já existem em todas as tabelas anteriores e não dependem de
-- configuração de ambiente.
--
-- ⚠️ ORDEM OBRIGATÓRIA DO RELEASE (CLAUDE.md): `npx supabase db push` ANTES de
-- `git push`. Esta migration APAGA COLUNA — código novo sem ela em produção
-- quebra, e migration sem o código novo é inofensiva (as tabelas novas ficam
-- vazias, esperando o primeiro lançamento pela tela).
--
-- ── ELA NÃO MOVE DADO NENHUM, E ISSO FOI DECIDIDO ───────────────────────
-- Uma versão anterior deste arquivo transformava as três colunas em linhas de
-- `terreno_desembolso` antes de apagá-las. **O Mateus dispensou o backfill em
-- 2026-08-19** — ver o comentário do DROP, mais abaixo. Não procure aqui uma
-- movimentação de dado que foi retirada de propósito.

-- ── Enums ────────────────────────────────────────────────────────────────

-- É ELE que decide qual regra roda (parecer §5, "Fatos a capturar"). Hoje o
-- app não pergunta e por isso RESPONDEU ERRADO SOZINHO: modelou o terreno como
-- escalar porque assumiu compra à vista.
--
-- `recebido` (herança, doação, permuta) existe porque nele há DATA DE
-- AQUISIÇÃO SEM DESEMBOLSO, e o custo é o valor constante na declaração do
-- doador/de cujus — é por isso que "valor sem data não grava" não pode ser
-- regra absoluta (parecer §5, pergunta 3; critério 4).
create type natureza_aquisicao_terreno as enum (
  'a_vista',
  'financiado',
  'parcelado_vendedor',
  'recebido'
);

-- ⚠️ NÃO EXISTE, E NÃO PODE PASSAR A EXISTIR, UM VALOR PARA "PARCELA DO
-- FINANCIAMENTO" (critério 14, versão estrutural do `cto-obra`). O caminho de
-- lançamento mensal não é construído: sem tipo para a parcela, a dupla
-- contagem informe × parcelas é IMPOSSÍVEL POR AUSÊNCIA DE TIPO, não por uma
-- regra que alguém precisa lembrar de aplicar. Custo inflado em Bens e
-- Direitos é redução indevida de ganho de capital, cobrada com multa.
--
-- `parcela_vendedor` é OUTRA COISA e não abre essa porta: é o parcelamento
-- direto com o VENDEDOR (natureza `parcelado_vendedor`), sem banco no meio, e
-- ele nunca se liga a um `financiamento` — não há FK daqui para lá.
create type tipo_desembolso_terreno as enum (
  'pagamento_terreno',    -- o caso à vista: um desembolso, uma data
  'entrada',              -- a entrada do financiamento (ou do parcelamento)
  'itbi',
  'escritura_registro',   -- inclui o registro da alienação fiduciária
  'parcela_vendedor',     -- parcelamento direto com o vendedor, sem banco
  'quitacao'              -- a quitação do saldo devedor (parecer §6)
);

-- `previsto` = "ainda não paguei" (ITBI a recolher, escritura a lavrar).
-- Critério 5: previsto NÃO ENTRA EM ANO NENHUM — nem no corrente. Previsão não
-- é pagamento, e o custo é regime de caixa.
create type estado_desembolso_terreno as enum ('pago', 'previsto');

-- FGTS usado na entrada é DESEMBOLSO DELE (recurso próprio, não do banco) e
-- ENTRA no custo — parecer §2a, critério 7.
create type origem_recurso_entrada as enum ('proprio', 'fgts');

-- ── A bifurcação, na obra ────────────────────────────────────────────────
-- NULLABLE, SEM DEFAULT e SEM BACKFILL, de propósito (critério 23 e leitura do
-- `cto-obra`): a obra que já existe vira PENDÊNCIA DE COMPLEMENTO, visível na
-- tela, e o app NÃO INVENTA FATO — nem fato que "todo mundo sabe". Um default
-- aqui seria o app respondendo sozinho de novo a pergunta que ele nunca fez.
-- Isto NÃO É BLOQUEIO: obra sem natureza continua funcionando.
alter table obra add column natureza_aquisicao_terreno natureza_aquisicao_terreno;

-- ── Desembolsos do terreno, cada um com a SUA data ──────────────────────
-- O caso à vista é o caso DEGENERADO deste modelo — um desembolso (parecer
-- §5). Isso resolve o ticket uma vez, não duas.
create table terreno_desembolso (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  obra_id         uuid not null references obra(id) on delete cascade,

  tipo            tipo_desembolso_terreno not null,
  valor           numeric(14,2) not null,

  -- ⚠️ NULLABLE DE PROPÓSITO, e é o coração do critério 22: O APP NUNCA
  -- INVENTA DATA — nunca `created_at`, nunca a data de hoje. Data ausente
  -- permanece AUSENTE E VISÍVEL, como pendência de complemento (critério 23):
  -- "sem a data, este valor não tem ano-calendário e a discriminação não pode
  -- ser gerada".
  --
  -- `created_at` é a data em que a LINHA foi criada no app, não a data em que
  -- o dinheiro saiu da conta. As duas só coincidem por acaso, e a diferença
  -- muda o ANO-CALENDÁRIO do custo — que é o que vai para a declaração.
  data_pagamento  date,

  estado          estado_desembolso_terreno not null,

  -- Só faz sentido preenchido na `entrada` — é lá que o formulário pergunta.
  -- NÃO há check amarrando a coluna ao tipo: FGTS também pode custear uma
  -- compra à vista, e um check aqui fecharia esse caso legítimo por antecipação
  -- de um cenário que o ticket não cobre.
  origem_recurso  origem_recurso_entrada,

  -- NULLABLE NO BANCO por causa do `previsto`: ITBI a recolher e escritura a
  -- lavrar são registráveis ANTES de existir comprovante — não há o que anexar
  -- a um pagamento que ainda não aconteceu (critério 5).
  -- ⚠️ OBRIGATÓRIO NO FORMULÁRIO para toda linha gravada como `pago` — é a
  -- disciplina do anexo no ato do registro (CLAUDE.md, meta 1). O nullable
  -- serve ao previsto, não é permissão para gravar desembolso pago sem lastro.
  arquivo_path    text,

  created_at      timestamptz not null default now(),

  -- Desembolso de zero (ou negativo) não é desembolso; seria linha muda no
  -- painel do terreno.
  constraint terreno_desembolso_valor_positivo check (valor > 0),

  -- Previsto NUNCA tem data: se tem data de pagamento, foi pago. A constraint
  -- existe para o estado impossível não ser representável — é o critério 5
  -- escrito no banco, e não numa regra que alguém precisa lembrar.
  constraint terreno_desembolso_previsto_sem_data
    check (estado <> 'previsto' or data_pagamento is null)
);

-- ── O contrato de financiamento (1x na vida — critério 7) ───────────────
create table financiamento (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- ⚠️ UM POR OBRA, e é ESCOPO FECHADO PELO MATEUS em 18/08: o financiamento é
  -- SÓ DO TERRENO — não cobre construção, não há liberação por medição, não há
  -- rateio. Dois contratos na mesma obra exigiriam migration nova E decisão
  -- consciente (qual deles é o do terreno? como o custo se reparte?), não um
  -- unique removido de passagem.
  obra_id          uuid not null references obra(id) on delete cascade,

  instituicao      text not null,
  numero_contrato  text,
  data_contrato    date not null,

  -- ⚠️ NUNCA VAI PARA O CUSTO (critério 8). Ele existe para o texto da
  -- discriminação e para fechar a conta na cabeça de quem lê
  -- (pago + saldo devedor = preço). Declarar o bem pelo preço integral sem
  -- declarar a dívida produz EVOLUÇÃO PATRIMONIAL SEM LASTRO DE RENDA e, na
  -- venda, custo de aquisição maior que o desembolso comprovado (parecer §1).
  -- Nenhuma função de `lib/fiscal/` lê esta coluna — e há teste afirmando isso.
  preco_contratado numeric(14,2) not null,

  numero_parcelas  integer,
  created_at       timestamptz not null default now(),

  -- ⚠️ A ENTRADA NÃO É COLUNA DAQUI: ela é uma linha de `terreno_desembolso`
  -- com `tipo = 'entrada'`. Um lugar só para desembolso datado — senão existem
  -- dois caminhos para o mesmo dinheiro, que é como nasce dupla contagem.

  constraint financiamento_uma_por_obra unique (obra_id),
  constraint financiamento_preco_positivo check (preco_contratado > 0),
  constraint financiamento_parcelas_positivas
    check (numero_parcelas is null or numero_parcelas > 0)
);

-- ── O informe anual (critério 9) ────────────────────────────────────────
-- A peça é o "Extrato do Imposto de Renda" da instituição credora: UM POR
-- EXERCÍCIO, publicado automaticamente para o IR e baixado pelo próprio Mateus
-- no site do banco. Pedidos ao gerente durante o ano: ZERO.
--
-- ⚠️ POR QUE SETE COLUNAS FIXAS E NÃO UMA TABELA DE RUBRICAS (leitura do
-- `cto-obra`): o layout do extrato é fechado e conhecido. Com colunas fixas,
-- rubrica NOVA do banco NÃO TEM ONDE ENTRAR, a soma não fecha e o registro é
-- recusado — o critério 11 sai de graça. Uma tabela filha tornaria a trava da
-- soma inexprimível em SQL e deixaria rubrica desconhecida entrar em silêncio,
-- que é o oposto do pedido.
create table financiamento_informe (
  id                     uuid primary key default gen_random_uuid(),

  -- ⚠️ SEM `user_id` PRÓPRIO, e a ausência é a decisão (mesmo molde das quatro
  -- dependentes da 0007): o dono é DERIVADO do `financiamento`. Uma coluna
  -- própria pode DISCORDAR do pai — nasce a linha que a RLS deixa você ver mas
  -- cujo contrato é de outra conta. Derivando, a discordância é impossível de
  -- representar.
  financiamento_id       uuid not null references financiamento(id) on delete cascade,

  -- ⚠️ GUARDA-SE O ANO-BASE E DERIVA-SE O EXERCÍCIO EM CÓDIGO
  -- (`exercicio = ano_base + 1`). Duas colunas para o mesmo fato DESCOLAM — e
  -- aqui o descolamento seria silencioso e fiscal: o ano-base é o que decide
  -- em qual situação de 31/12 o custo entra.
  ano_base               integer not null,

  -- ── As SETE rubricas, guardadas SEPARADAS, SEMPRE (critério 12) ────────
  -- É isso que permite recompor o custo sob qualquer entendimento sem
  -- redigitar nada. O erro irreversível é NÃO CAPTURAR; capturar e não somar
  -- é reversível por retificadora.
  --
  -- ⚠️ A COMPOSIÇÃO DO CUSTO NÃO É DECIDIDA AQUI, e nem toda rubrica tem
  -- classificação fechada (ADENDO 4 do parecer): o parecer do agente
  -- `contador` diz que seguros não entram; o contador com CRC que assina a
  -- declaração do Mateus INCLUIU, e o Mateus decidiu manter. O banco guarda os
  -- sete números e cala sobre a classificação das que estão em aberto.
  amortizacao            numeric(14,2) not null default 0,
  juros_correcao         numeric(14,2) not null default 0,
  seguros                numeric(14,2) not null default 0,
  taxas_fcvs             numeric(14,2) not null default 0,
  mora                   numeric(14,2) not null default 0,
  multa                  numeric(14,2) not null default 0,
  diferenca_teorico_pago numeric(14,2) not null default 0,

  -- É A TRAVA (critério 11): é contra ele que as sete linhas têm de bater.
  total_pago             numeric(14,2) not null,

  -- ⚠️ INFORMATIVO (critério 15): NÃO FOI PAGO, logo não é custo de nada.
  -- Nunca somado, nunca subtraído, não vira campo de "dívida" e não entra na
  -- discriminação do bem. Ele não some: reaparece integralmente como custo no
  -- ano em que for quitado (parecer §2c e §6).
  saldo_devedor          numeric(14,2) not null default 0,

  -- Anexo OBRIGATÓRIO no ato do registro (critério 10) — é a meta 1 aplicada a
  -- um desembolso de dezenas de milhares de reais. Aqui PODE ser `not null`
  -- porque não há backfill de informe: toda linha desta tabela nasce pela tela.
  arquivo_path           text not null,

  created_at             timestamptz not null default now(),

  -- Ano-base fora de faixa é digitação, não fato.
  constraint informe_ano_base_plausivel check (ano_base between 1990 and 2999),

  -- ⚠️ UM INFORME POR CONTRATO + ANO-BASE (critério 14). É a metade no banco da
  -- trava da dupla contagem; a outra metade é a AUSÊNCIA de tipo para "parcela
  -- do financiamento".
  constraint informe_um_por_ano_base unique (financiamento_id, ano_base),

  constraint informe_total_pago_positivo check (total_pago > 0),
  constraint informe_rubricas_nao_negativas check (
    amortizacao >= 0 and juros_correcao >= 0 and seguros >= 0
    and taxas_fcvs >= 0 and mora >= 0 and multa >= 0
    and diferenca_teorico_pago >= 0 and saldo_devedor >= 0
  ),

  -- ⚠️ A TRAVA DA SOMA, COM TOLERÂNCIA ZERO (critério 11).
  --
  -- Se a soma das sete não bate com o total pago, existe rubrica que o app não
  -- conhece: RECUSAR e pedir revisão humana, NUNCA somar o resto e seguir.
  -- Validação também na aplicação, com a mensagem e a diferença exata — este
  -- CHECK é o backstop, para o caso de alguém escrever no banco por fora.
  --
  -- `numeric(14,2)` compara EXATO: nada de float, nada de epsilon. Documento de
  -- banco arredonda, e um descasamento de R$ 0,01 vai travar o lançamento
  -- inteiro — e fica assim mesmo: travar e reclamar MOSTRA o problema, folga
  -- silenciosa ESCONDE. Se aparecer descasamento de centavo na vida real,
  -- decide-se com o caso na mão.
  constraint informe_soma_fecha_com_total check (
    amortizacao + juros_correcao + seguros + taxas_fcvs
      + mora + multa + diferenca_teorico_pago = total_pago
  )
);

-- ── As três colunas MORREM, na MESMA migration (critério 14b) ───────────
-- "Coluna velha convivendo com tabela nova é o mesmo dinheiro em dois lugares
-- — a dupla contagem entrando pela porta que a trava 14 fechou." Deixar as
-- colunas "por segurança" garantiria que alguém, um dia, somasse as duas
-- origens no mesmo relatório.
--
-- ⚠️ O CONTEÚDO DELAS É DESCARTADO, E ISSO FOI AUTORIZADO — NÃO É DESCUIDO.
-- Há dado real em produção nestas três colunas (a obra do Mateus está
-- cadastrada). **Ele autorizou o descarte em 2026-08-19**, por escrito:
-- "em relação a migration destrutiva, acho que não precisa. podemos limpar
-- completamente o banco e eu crio de novo, sem problemas."
-- São TRÊS NÚMEROS, que ele redigita no fluxo novo — e redigitar é melhor que
-- herdar: no formulário novo cada um nasce COM A SUA DATA, que é justamente o
-- defeito que este ticket existe para consertar. Um backfill produziria três
-- linhas `pago` sem data (o critério 22 proíbe inventar data), ou seja, três
-- pendências de complemento para os mesmos três números.
--
-- O que NÃO foi feito, embora ele tenha oferecido: limpar o banco inteiro.
-- Isso levaria junto documento já no acervo, que é append-only por decisão do
-- CONTAI-009. `drop column` resolve sem tocar em nada disso.
alter table obra
  drop column valor_terreno,
  drop column valor_itbi,
  drop column valor_escritura_registro;

-- ── Índices ─────────────────────────────────────────────────────────────
create index idx_terreno_desembolso_user on terreno_desembolso (user_id);
-- O painel do terreno: os desembolsos de UMA obra, na ordem do ano-calendário.
-- `nulls last` não vale aqui (é índice, não query), mas a ordenação por data é
-- o acesso real.
create index idx_terreno_desembolso_obra on terreno_desembolso (obra_id, data_pagamento);
create index idx_financiamento_user on financiamento (user_id);
-- `financiamento_uma_por_obra` já indexa `obra_id`; nada a acrescentar.
-- `informe_um_por_ano_base` já indexa (financiamento_id, ano_base), que é
-- exatamente o acesso do painel ano a ano.

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table terreno_desembolso    enable row level security;
alter table financiamento         enable row level security;
alter table financiamento_informe enable row level security;

create policy dono_terreno_desembolso on terreno_desembolso for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy dono_financiamento on financiamento for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Dono DERIVADO do pai — ver a nota na coluna `financiamento_id`.
create policy dono_financiamento_informe on financiamento_informe for all
  using (
    exists (
      select 1 from financiamento f
       where f.id = financiamento_id and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from financiamento f
       where f.id = financiamento_id and f.user_id = auth.uid()
    )
  );

-- ── REVOKE antes do GRANT — é o que faz local == remoto (migration 0005) ─
-- Ver a resposta à pergunta obrigatória no cabeçalho.
revoke all privileges on table
  terreno_desembolso, financiamento, financiamento_informe
  from anon, authenticated;

-- `anon` não recebe NADA. A base guarda CPF, CNO e as notas da obra; não
-- existe acesso anônimo no produto. A ausência é a decisão.

-- ── `authenticated`: só o verbo que o app executa ───────────────────────
-- SEM DELETE nas três. Acervo append-only (CONTAI-009): desembolso registrado
-- e informe gravado são fato com documento atrás, não rascunho.

-- UPDATE em `terreno_desembolso` serve a UM ato: COMPLETAR o que falta numa
-- linha já gravada — a data de pagamento e o comprovante de um desembolso
-- registrado sem eles, e a passagem de `previsto` para `pago` no dia em que o
-- ITBI for recolhido (critérios 5 e 23). Sem ele a pendência de complemento
-- não teria como ser resolvida pela tela — e correção que exige SQL é a dor
-- D9 de volta.
grant select, insert, update on table terreno_desembolso to authenticated;

-- UPDATE em `financiamento` serve à correção do cadastro do contrato
-- (instituição, número, nº de parcelas), que é digitado à mão uma vez na vida.
grant select, insert, update on table financiamento to authenticated;

-- ⚠️ UPDATE em `financiamento_informe` — justificativa por escrito, porque a
-- regra vizinha da 0007 é "privilégio sem caminho na interface é superfície à
-- toa", e este está no limite dela.
--
-- Sem UPDATE, um informe gravado com DUAS RUBRICAS TROCADAS ENTRE SI (a soma
-- fecha do mesmo jeito, então nem a trava nem o CHECK acusam) TRAVA O ANO-BASE
-- PARA SEMPRE por causa do `unique (financiamento_id, ano_base)`: não dá para
-- gravar o certo por cima, não dá para apagar o errado, e o único conserto
-- seria SQL à mão em produção. O erro é plausível — são sete números
-- transcritos de um PDF — e o dano é que o custo do ano fica errado com
-- aparência de certo.
--
-- O grant é de TABELA e não de coluna porque
-- `information_schema.role_table_grants` (a fonte de `e2e/privilegios.spec.ts`)
-- só enxerga privilégio de TABELA: um `grant update (…)` sumiria do mapa e o
-- teste leria como "tabela sem UPDATE". Mesma nota que a 0007 deixou em
-- `pagamento_diferenca`.
grant select, insert, update on table financiamento_informe to authenticated;
