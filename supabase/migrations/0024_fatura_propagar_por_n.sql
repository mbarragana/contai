-- CONTAI-081 — a propagação da nota de origem, no caminho do CARTÃO, passa a
-- ser CONDICIONAL: quem decide é o JS, ANTES da chamada.
--
-- Fonte normativa: docs/pareceres/2026-08-18-compromisso-versus-pagamento.md,
-- ADENDO 6 §J.3, ADENDO 7 §K.2 (a bifurcação por N) e ADENDO 8 §L.2. Nada aqui
-- é inferido — e nada aqui DECIDE: a decisão chega pronta, em
-- `p_propagar_origem_ids`.
--
-- ── O defeito que esta migration fecha ───────────────────────────────────
-- Desde a 0020 as duas RPCs da fatura chamam `propagar_vinculo_de_origem`
-- **incondicionalmente**, uma vez por compromisso do laço. Enquanto o
-- pré-vínculo N:M não existia para cartão (o CONTAI-080 recusava
-- `origem = 'cartao'`), isso era exatamente o CONTAI-065 e nada mais: N nunca
-- podia passar de 1, porque a única fonte era `documento_origem_id`.
--
-- O CONTAI-081 abre o pré-vínculo para cartão. A partir daí, uma compra com
-- nota de origem MAIS um pré-vínculo resolve para **N=2** — e a linha da origem
-- seria gravada em `pagamento_documento` ANTES de qualquer toque do Mateus,
-- deixando o §J.3 cobrir só a metade que sobrou. É o **D1 do Gate 2 do
-- CONTAI-080** voltando pela porta do cartão (pre-mortem 1 do ticket).
--
-- ── Por que o parâmetro, e não a contagem aqui dentro ────────────────────
-- Decisão do `cto-obra` (Out of Scope do ticket): **toda** a lógica fiscal fica
-- em JS puro testável (`documentosResolvidosNaConfirmacao` →
-- `planoDeConversaoDaFatura`, `lib/fiscal/compromisso.ts`). Contar N em PL/pgSQL
-- daria uma SEGUNDA definição de N — o mesmo pre-mortem 1 do CONTAI-080, em
-- outra linguagem, e a segunda divergiria na primeira correção. A RPC recebe a
-- decisão já tomada e não a revisa.
--
-- ⚠️ **O default `'{}'` existe SÓ no banco**, para a migration ser aditiva
-- durante a janela `db push` → deploy (a ordem obrigatória do release: migration
-- primeiro, código depois). No TypeScript o parâmetro é **obrigatório, sem
-- default** (critério 5): o app sempre calcula e passa o valor real, e um
-- chamador novo que esquecesse de calcular não compila. Aqui, `'{}'` significa
-- *"não propague nada"* — o lado conservador: no máximo sobra um vínculo a
-- ligar com o dedo, nunca um conjunto meio convertido em silêncio.
--
-- ⚠️ **DROP + CREATE, e não `create or replace`.** Parâmetro novo muda a
-- ARIDADE, e `create or replace` com aridade diferente cria uma SOBRECARGA em
-- vez de substituir — duas funções com o mesmo nome, a velha (que propaga
-- incondicionalmente) viva e chamável. Mesmo precedente da 0017 e da 0021, e a
-- mesma premissa que `e2e/privilegios.spec.ts` escreve por extenso ("nenhuma
-- função aqui é sobrecarregada, então o NOME identifica").
--
-- ⚠️ **O corpo é copiado integralmente** — o da 0021 para
-- `fatura_desembolso_gravar` (que já trazia o extrato do CONTAI-067 em cima da
-- propagação da 0020) e o da 0020 para `fatura_alocar`. Não existe "alterar o
-- meio de uma função" no Postgres. O diff real está marcado com CONTAI-081, e é
-- de TRÊS linhas em cada uma.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- **Nenhuma tabela, coluna, sequence ou view nasce aqui** — então o
-- `alter default privileges` do stack local não tem onde morder. Mas FUNÇÃO
-- nasce com `execute` para `public` (que inclui `anon`) em QUALQUER Postgres, e
-- as duas assinaturas antigas morrem no `drop` junto com os revokes delas: sem
-- os revokes do fim deste arquivo, o anônimo passaria a poder gravar desembolso
-- e quitar compromisso no acervo de outra pessoa.
--
-- `e2e/privilegios.spec.ts` **não muda de conteúdo**: o NOME das duas funções e
-- os grants são idênticos — só a aridade mudou. O comentário de lá ganha a
-- menção da 0024 no mesmo diff, para a próxima pessoa não procurar a assinatura
-- errada.

-- ══ 1 · A confirmação integral (0013 → 0020 → 0021 → aqui) ════════════════
drop function fatura_desembolso_gravar(uuid, numeric, date, text, uuid[], text);

create function fatura_desembolso_gravar(
  p_fatura_id        uuid,
  p_valor            numeric,
  p_data_pagamento   date,
  p_comprovante_path text default null,
  p_compromisso_ids  uuid[] default '{}',
  p_extrato_path     text default null,
  -- CONTAI-081: os compromissos deste laço cuja nota de ORIGEM o app autorizou
  -- a propagar sozinha — os de N < 2, calculados por
  -- `planoDeConversaoDaFatura`. Quem está de fora (N ≥ 2) espera o clique do
  -- Mateus em `/fatura/[id]/vinculos`.
  p_propagar_origem_ids uuid[] default '{}'
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
  v_extrato_atual  text;
begin
  -- ⚠️ CONTAI-067, critério 12 — **nunca sobrescreve um extrato existente em
  -- silêncio**. A tela só oferece o campo quando `extrato_path is null`, então o
  -- único caminho até aqui é reentrada/corrida (duas abas na mesma fatura). Nessa
  -- situação o `raise` é a resposta honesta: recusar ALTO, com o arquivo ainda na
  -- mão do Mateus, é melhor que gravar por cima do documento que já sustenta a
  -- composição daquele ciclo. A justificativa por extenso — e o fato de esta ser
  -- a ÚNICA exceção deliberada à regra "nunca recusa o fato consumado" — está no
  -- §4 da migration 0021, e não se repete aqui para não divergir dela.
  if p_extrato_path is not null then
    select extrato_path into v_extrato_atual
      from fatura where id = p_fatura_id for update;

    if v_extrato_atual is not null then
      raise exception 'fatura % já tem extrato anexado', p_fatura_id;
    end if;

    update fatura set extrato_path = p_extrato_path where id = p_fatura_id;
  end if;

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

        -- CONTAI-065: a nota que o Mateus afirmou no agendamento da COMPRA
        -- acompanha o pagamento que nasce aqui.
        --
        -- ⚠️ **CONTAI-081 — e só quando o app autorizou.** `= any (…)` com
        -- array vazio é `false`, e com `null` é `null` (também não entra): as
        -- duas ausências significam "não propague", que é o lado conservador.
        -- Para N ≥ 2, a origem NÃO converte aqui — ela espera, junto com as
        -- outras notas, o "Sim, confirmar os vínculos" do §J.3.
        if v_compromisso_id = any (p_propagar_origem_ids) then
          perform propagar_vinculo_de_origem(v_compromisso_id, v_pagamento_id);
        end if;

        update compromisso set situacao = 'quitado' where id = v_compromisso_id;
      end if;
    end loop;
  end if;

  return v_desembolso_id;
end;
$$;

-- ══ 2 · A alocação do rotativo (0013 → 0020 → aqui) ══════════════════════
drop function fatura_alocar(uuid, uuid[]);

create function fatura_alocar(
  p_desembolso_id   uuid,
  p_compromisso_ids uuid[],
  -- CONTAI-081 — ver o comentário da função acima. O default vale para o banco
  -- durante a janela do release; o app sempre passa o array calculado.
  p_propagar_origem_ids uuid[] default '{}'
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

      -- CONTAI-065 — mesma linha da função acima, e ela precisa existir nas
      -- DUAS: o rotativo aloca por aqui (tela reaberta depois, ou "decidir
      -- depois"), e um vínculo que só sobrevive na confirmação integral seria
      -- uma regra que depende de por qual porta o Mateus entrou.
      --
      -- ⚠️ CONTAI-081 — e a condição também precisa existir nas duas, pelo
      -- mesmo motivo invertido: a propagação silenciosa de metade de um
      -- conjunto N ≥ 2 não pode depender da porta de entrada (pre-mortem 3 do
      -- ticket).
      if v_compromisso_id = any (p_propagar_origem_ids) then
        perform propagar_vinculo_de_origem(v_compromisso_id, v_pagamento_id);
      end if;

      update compromisso set situacao = 'quitado' where id = v_compromisso_id;
    end if;
  end loop;
end;
$$;

-- ══ 3 · REVOKE antes do GRANT — é o que faz local == remoto (0005) ════════
--
-- As assinaturas NOVAS nascem com `execute` para `public` como qualquer função:
-- os revokes da 0013/0021 morreram junto com as assinaturas antigas nos `drop`
-- acima. O NOME e o papel não mudam — `e2e/privilegios.spec.ts` continua
-- esperando `authenticated` para as duas, e acusaria se este bloco faltasse.
revoke execute on function
  fatura_desembolso_gravar(uuid, numeric, date, text, uuid[], text, uuid[])
  from public, anon;
grant execute on function
  fatura_desembolso_gravar(uuid, numeric, date, text, uuid[], text, uuid[])
  to authenticated;

revoke execute on function
  fatura_alocar(uuid, uuid[], uuid[])
  from public, anon;
grant execute on function
  fatura_alocar(uuid, uuid[], uuid[])
  to authenticated;

-- ⚠️ **NENHUM GRANT DE TABELA E NENHUM DE COLUNA AQUI**, e a ausência é
-- decisão: nenhuma tabela nasce neste arquivo, e a única coluna que as duas
-- funções escrevem fora das tabelas já concedidas é `fatura.extrato_path`, cujo
-- `grant update (extrato_path)` é da 0021 e continua valendo.
