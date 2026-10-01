-- CONTAI-084 — criador em lote de parcelas de uma compra no cartão.
--
-- Fonte normativa: docs/pareceres/2026-08-18-compromisso-versus-pagamento.md,
-- ADENDO 5 §I.1-I.3 (recusa de parcelamento) e ADENDO 9 §M.0/M.2/M.8 (a origem
-- não se herda). Nada aqui é inferido, e **nenhuma regra fiscal nova entra**:
-- esta função é a automação literal da instrução do ADENDO 5 §I.1 — "lance cada
-- parcela como uma compra separada, pelo valor dela, na fatura em que ela
-- vence".
--
-- ── O que esta migration NÃO cria ────────────────────────────────────────
-- **NENHUMA tabela, coluna, enum, sequence ou view** (Viabilidade do ticket).
-- Não existe conceito de "lote"/"série" persistido: o lote é um ATO de
-- digitação, não uma entidade fiscal. Duas parcelas da mesma compra são dois
-- `Compromisso` independentes — exatamente como se tivessem sido criadas uma a
-- uma pela tela individual —, e é essa independência que mantém o ano do custo
-- de cada uma amarrado à fatura em que ELA é paga (regime de caixa, ADENDO 5
-- §I.1). Uma coluna de "lote" aqui seria o primeiro passo para alguém somar as
-- N parcelas num evento só, que é o que a RECUSA_PARCELADO existe para impedir.
--
-- ── Por que uma função, e não N chamadas do app ──────────────────────────
-- Achado do `cto-obra` (Viabilidade): N chamadas HTTP sequenciais do browser
-- NÃO são atômicas entre si. Falha na 3ª de 5 deixaria 2 compromissos gravados,
-- e **não há DELETE** para desfazê-los — `compromisso` tem só
-- `select, insert, update` desde a 0007, acervo append-only. O Mateus ficaria
-- com meio lote no acervo e nenhuma tela para limpá-lo. Uma função plpgsql
-- inteira é UMA transação: qualquer `raise` no meio desfaz tudo que ela já
-- inseriu, inclusive as linhas de `fatura` e `fatura_compromisso`.
--
-- ── Por que `documento_origem_id` NÃO é parâmetro ────────────────────────
-- Critério 10 + Gate Fiscal, e é a lição do CONTAI-083 (incidente P0): três
-- compromissos abertos do mesmo favorecido herdaram a MESMA nota como origem e
-- cada um, sozinho, resolveria N=1 na confirmação e converteria para aquela
-- nota — três vezes. Herança em massa, de propósito, numa única ação,
-- escalaria o mesmo erro para 24 parcelas de uma vez.
--
-- A proibição fica na ASSINATURA, não na disciplina do chamador: não há como
-- passar o id. A chamada interna a `compra_cartao_gravar` abaixo omite o
-- parâmetro, e ele cai no `default null` da 0013 — cada parcela nasce com
-- `documento_origem_id` nulo, idêntica a uma criação manual sem contexto de
-- nota. O vínculo é ato deliberado posterior, uma parcela de cada vez, no
-- pré-vínculo (CONTAI-080/081).
--
-- ── Por que reusar `compra_cartao_gravar` por dentro ─────────────────────
-- Ela já resolve, numa transação, o trio compromisso + fatura (`on conflict do
-- nothing` na chave natural) + vínculo. Reimplementá-la aqui criaria um segundo
-- caminho de gravação da MESMA coisa, que é como duas telas passam a discordar
-- sobre o que é uma compra no cartão. Duas parcelas que caiam no mesmo
-- vencimento reaproveitam a MESMA fatura, de graça — e isso é correto: a fatura
-- é só o agrupamento por data de vencimento.
--
-- Ela é `security invoker`, e esta também: a policy que barra o app barra as
-- duas. O que a função acrescenta é atomicidade e ordem, nunca privilégio.
--
-- ── As duas guardas de SERVIDOR (critério 12) ────────────────────────────
-- O formulário já recusa as duas antes de chamar. Estas valem para QUALQUER
-- caminho (psql, PostgREST cru, script futuro) e são as que impedem um lote
-- incoerente de entrar no acervo:
--   1. menos de 2 parcelas — lote de 1 é a tela individual, e deixar passar
--      aqui abriria um segundo endereço para a mesma coisa;
--   2. soma das parcelas ≠ valor total — é o Pre-mortem 1 do ticket: a
--      divergência de um centavo é pequena demais para notar e sai errada na
--      soma do ano, que é o número que vai para a declaração.
-- O TETO de 24 fica só no formulário (Viabilidade): é limite de UX da lista
-- editável, não regra fiscal — e um lote de 36 parcelas gravado por outro
-- caminho não estaria fiscalmente errado.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- **SIM — função nasce com `execute` para `public` (que inclui `anon`) em
-- QUALQUER Postgres**, local ou remoto. Sem o `revoke` no fim deste arquivo, o
-- anônimo poderia gravar 24 compromissos no acervo de outra pessoa numa única
-- chamada. Nenhuma tabela nova (nada herda `alter default privileges`), nenhuma
-- coluna com default de servidor, nenhuma sequence: o único ponto cego é o
-- EXECUTE, e ele é fechado abaixo e declarado em `e2e/privilegios.spec.ts`
-- (`FUNCOES_ESPERADAS`).

create function compra_cartao_gravar_lote(
  p_obra_id       uuid,
  p_favorecido_id uuid,
  p_data_compra   date,
  p_valor_total   numeric,
  -- `[{"valor": 15000.00, "vencimento": "2026-10-15"}, …]`, na ordem da tela.
  -- jsonb e não dois arrays paralelos: array de valor e array de data podem
  -- chegar com tamanhos diferentes, e aí "a parcela 3" passa a significar duas
  -- coisas. O objeto mantém valor e vencimento juntos, que é o que eles são.
  p_parcelas      jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_quantas  int;
  v_soma     numeric := 0;
  v_parcela  jsonb;
  v_gravada  jsonb;
  v_gravadas jsonb := '[]'::jsonb;
begin
  -- ── Guarda 1 · lote de verdade ────────────────────────────────────────
  v_quantas := jsonb_array_length(p_parcelas);
  if v_quantas is null or v_quantas < 2 then
    raise exception
      'Lote com menos de 2 parcelas não é lote — lance a compra em /adicionar/compra-cartao. Nada foi gravado.';
  end if;

  -- ── Guarda 2 · a soma tem de bater, ANTES de inserir qualquer linha ───
  -- Conferida num laço próprio e não junto da gravação: recusar depois de ter
  -- inserido metade das parcelas funcionaria (a transação desfaz), mas gastaria
  -- escrita para descobrir o que a aritmética já sabia.
  for v_parcela in select valor from jsonb_array_elements(p_parcelas) as t(valor)
  loop
    if (v_parcela->>'valor') is null or (v_parcela->>'vencimento') is null then
      raise exception
        'Parcela sem valor ou sem vencimento no lote. Nada foi gravado.';
    end if;
    v_soma := v_soma + (v_parcela->>'valor')::numeric;
  end loop;

  if v_soma <> p_valor_total then
    raise exception
      'A soma das parcelas (%) não bate com o valor total da compra (%). Nada foi gravado.',
      v_soma, p_valor_total;
  end if;

  -- ── As N compras, na MESMA transação ──────────────────────────────────
  -- ⚠️ `compra_cartao_gravar` é chamada SEM `p_documento_origem_id`: ele cai no
  -- `default null` da 0013. É o critério 10, e não há como passar outra coisa.
  for v_parcela in select valor from jsonb_array_elements(p_parcelas) as t(valor)
  loop
    v_gravada := compra_cartao_gravar(
      p_obra_id,
      p_favorecido_id,
      (v_parcela->>'valor')::numeric,
      p_data_compra,
      (v_parcela->>'vencimento')::date
    );
    v_gravadas := v_gravadas || jsonb_build_array(
      v_gravada || jsonb_build_object(
        'valor', (v_parcela->>'valor')::numeric,
        'vencimento', (v_parcela->>'vencimento')::date
      )
    );
  end loop;

  return jsonb_build_object('parcelas', v_gravadas);
end;
$$;

comment on function compra_cartao_gravar_lote(uuid, uuid, date, numeric, jsonb) is
  'CONTAI-084: grava as N parcelas de uma compra no cartão como N Compromisso '
  'independentes, numa única transação. Não aceita documento_origem_id — '
  'critério 10 / ADENDO 9 §M: vínculo com nota é ato deliberado posterior, '
  'parcela por parcela, no pré-vínculo.';

-- ── EXECUTE: revoke de public/anon, grant só a authenticated ─────────────
revoke execute on function
  compra_cartao_gravar_lote(uuid, uuid, date, numeric, jsonb)
  from public, anon;
grant execute on function
  compra_cartao_gravar_lote(uuid, uuid, date, numeric, jsonb)
  to authenticated;
