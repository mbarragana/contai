-- CONTAI-100 — o lote de parcelas passa a aceitar PRÉ-VÍNCULO com a nota de
-- origem, na MESMA transação em que as N parcelas nascem.
--
-- Fonte normativa: docs/pareceres/2026-08-18-compromisso-versus-pagamento.md,
-- ADENDO 6 (§J.0-J.5), ADENDO 7 (§K.1-K.5), ADENDO 8 (§L.1-L.4) e ADENDO 9
-- (§M.0-M.8). Nada aqui é inferido, e **nenhuma regra fiscal nova entra**: o
-- pré-vínculo que esta função passa a gravar é o MESMO da migration 0023 —
-- anotação de intenção, que não entra em soma nenhuma, não é nó de
-- `alocarCusto` e não tira a nota de "sem pagamento vinculado" (§J.1).
--
-- ── O que esta migration NÃO cria, e o que ela NÃO reabre ────────────────
-- **Nenhuma tabela, coluna, enum, sequence ou view.** O par
-- (compromisso, documento) já é a linha de `compromisso_documento_previsto`
-- (0023), e o pré-vínculo deste lote é **por parcela**: N parcelas → N linhas,
-- todas com o mesmo `documento_id`. Não existe conceito de lote/série
-- persistido aqui nem lá, e §J.4 é explícito em que não há restrição de soma no
-- pré-vínculo, em nenhuma direção — então N linhas apontando para a mesma nota
-- não precisam de trava nenhuma.
--
-- ⚠️ **`documento_origem_id` continua FORA, e a proibição do ADENDO 9 §M segue
-- intocada.** A chamada interna a `compra_cartao_gravar` continua OMITINDO o
-- parâmetro (ele cai no `default null` da 0013), e o parâmetro novo desta
-- função se chama `p_documento_previsto_id` de propósito: `previsto`, nunca
-- `origem`. Os dois campos convivem e não se substituem (§J.0) — o primeiro é
-- 1 documento, fixado na criação e imutável; este é N:M e editável em
-- `/compromisso/[id]/pre-vincular` até a confirmação do pagamento.
--
-- Por que acrescentar pré-vínculo aqui NÃO é o CONTAI-083 de volta (Gate Fiscal
-- do ticket, pontos 1 e 2): no CONTAI-083 a origem foi fixada em três atos
-- SEPARADOS no tempo, herdando sem comparar contra as outras notas hábeis do
-- mesmo favorecido (§M.0) — erro de CORRESPONDÊNCIA entre notas. Aqui as N
-- parcelas nascem num único ato atômico e **são a divisão de uma nota já
-- identificada**, olhada agora: não existe o rateio entre documentos que o
-- §K.1 item 3 nomeia como o único risco real do N:M. As duas condições que
-- faltavam para isso ser seguro são de CLIENTE e estão nos critérios 5 e 6 do
-- ticket (o id tem de ser o vigente no instante do salvamento, e a tela tem de
-- mostrar qual nota vai ser pré-vinculada antes de salvar) — esta função não as
-- substitui.
--
-- ── Por que DENTRO da RPC, e não um upsert em JS depois ──────────────────
-- A alternativa (RPC do lote + upsert de N pares numa segunda chamada) **não é
-- atômica**: uma falha entre as duas deixaria o lote gravado e zero
-- pré-vínculo, que é exatamente a dor do relato ("pareceu que o pagamento não
-- tinha sido salvo") — agora com a tela de sucesso afirmando o contrário. E não
-- há DELETE em `compromisso` para desfazer meio lote (acervo append-only desde
-- a 0007).
--
-- Isto **não** contraria a doutrina do CONTAI-081 (a RPC não decide, só
-- executa): a decisão — qual id, e se a obra bate — é tomada em JS, por
-- `podeVincular`, ANTES da chamada (`criarCompraCartaoEmLote`, `lib/data.ts`).
-- A função só insere N vezes o par já autorizado. Mesmo padrão de
-- `p_propagar_origem_ids` da 0024.
--
-- ── A guarda de SERVIDOR nova (segunda camada da mesma regra) ────────────
-- Se `p_documento_previsto_id` não é nulo e não existe `documento` com esse id
-- **na mesma obra**, a função recusa o lote inteiro: `raise`, nada gravado. É a
-- régua do §J.1/§K.2 aplicada na entrada — pré-vínculo de nota de outra obra é
-- a linha que viraria vínculo formal entre obras na confirmação (§K.2), e
-- *"nada é somado entre obras"*. A guarda vale para QUALQUER caminho (psql,
-- PostgREST cru, script futuro), não só para a tela.
--
-- ⚠️ O `select` roda sob RLS (`security invoker`), então nota de OUTRA conta
-- também não existe para esta função — a recusa cobre os dois casos com uma
-- condição só.
--
-- ⚠️ **O default `null` existe SÓ no banco**, para a migration ser aditiva na
-- janela `db push` → deploy (a ordem obrigatória do release: migration
-- primeiro, código depois). No TypeScript o campo correspondente
-- (`NovoLoteCompraCartao.documentoPrevisto`) é **obrigatório, sem default**: um
-- chamador novo que esquecesse de decidir não compila. `null` aqui significa
-- *"lote sem pré-vínculo"* — o lado conservador, idêntico ao comportamento de
-- antes deste ticket.
--
-- ⚠️ **DROP + CREATE, e não `create or replace`.** Parâmetro novo muda a
-- ARIDADE, e `create or replace` com aridade diferente cria uma SOBRECARGA em
-- vez de substituir — a assinatura velha (que não sabe pré-vincular) ficaria
-- viva e chamável, e o PostgREST poderia resolver para ela. Mesmo precedente da
-- 0017, 0021 e 0024, e a mesma premissa que `e2e/privilegios.spec.ts` escreve
-- por extenso ("nenhuma função aqui é sobrecarregada, então o NOME identifica").
--
-- ⚠️ **O corpo é copiado da 0026** — não existe "alterar o meio de uma função"
-- no Postgres. O diff real está marcado com CONTAI-100, e é a guarda de entrada
-- mais o `insert` dentro do laço.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- **Nenhuma tabela, coluna, sequence ou view nasce aqui** — o
-- `alter default privileges` do stack local não tem onde morder, e nenhum GRANT
-- de tabela é necessário: `authenticated` já tem `insert` em
-- `compromisso_documento_previsto` (0023) e `select` em `documento` (0005).
-- Mas FUNÇÃO nasce com `execute` para `public` (que inclui `anon`) em QUALQUER
-- Postgres, e o revoke da 0026 morre no `drop` abaixo junto com a assinatura
-- antiga: sem o bloco do fim deste arquivo o anônimo poderia gravar 24
-- compromissos — agora também 24 pré-vínculos — no acervo de outra pessoa numa
-- só chamada. `e2e/privilegios.spec.ts` não muda de conteúdo (mesmo nome, mesmo
-- papel, só a aridade mudou); o comentário de lá ganha a menção da 0032 no
-- mesmo diff, para a próxima pessoa não procurar a assinatura errada.

drop function compra_cartao_gravar_lote(uuid, uuid, date, numeric, jsonb);

create function compra_cartao_gravar_lote(
  p_obra_id       uuid,
  p_favorecido_id uuid,
  p_data_compra   date,
  p_valor_total   numeric,
  -- `[{"valor": 15000.00, "vencimento": "2026-10-15"}, …]`, na ordem da tela.
  -- jsonb e não dois arrays paralelos: array de valor e array de data podem
  -- chegar com tamanhos diferentes, e aí "a parcela 3" passa a significar duas
  -- coisas. O objeto mantém valor e vencimento juntos, que é o que eles são.
  p_parcelas      jsonb,
  -- CONTAI-100: a nota que o Mateus estava olhando quando mandou lançar o lote,
  -- já autorizada em JS (`podeVincular`). Cada uma das N parcelas nasce
  -- PRÉ-VINCULADA a ela — nunca com `documento_origem_id`.
  p_documento_previsto_id uuid default null
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

  -- ── Guarda 3 · CONTAI-100 · a nota do pré-vínculo é desta obra ────────
  -- Conferida aqui, antes de qualquer insert, pelo mesmo motivo da guarda 2 — e
  -- sob RLS, então "nota de outra conta" e "nota de outra obra" caem na mesma
  -- recusa. O cliente já checou com `podeVincular`; esta é a camada que vale
  -- para quem não passa pela tela.
  if p_documento_previsto_id is not null
     and not exists (
       select 1 from documento
        where id = p_documento_previsto_id
          and obra_id = p_obra_id
     ) then
    raise exception
      'A nota do pré-vínculo (%) não existe nesta obra (%). Nada foi gravado.',
      p_documento_previsto_id, p_obra_id;
  end if;

  -- ── As N compras, na MESMA transação ──────────────────────────────────
  -- ⚠️ `compra_cartao_gravar` continua chamada SEM `p_documento_origem_id`: ele
  -- cai no `default null` da 0013, e o CONTAI-100 **não reabre** isso (critério
  -- 4 do ticket / ADENDO 9 §M). O que o lote passou a propagar é o PRÉ-vínculo,
  -- que é outro campo, outra tabela e outra regra.
  for v_parcela in select valor from jsonb_array_elements(p_parcelas) as t(valor)
  loop
    v_gravada := compra_cartao_gravar(
      p_obra_id,
      p_favorecido_id,
      (v_parcela->>'valor')::numeric,
      p_data_compra,
      (v_parcela->>'vencimento')::date
    );

    -- CONTAI-100 · uma linha de pré-vínculo POR PARCELA (Viabilidade do
    -- ticket): a PK de `compromisso_documento_previsto` é o par, e toda a
    -- resolução de N (`idsDaUniaoDoPreVinculo`,
    -- `documentosResolvidosNaConfirmacao`, `planoDeConversaoDaFatura`) já opera
    -- por compromisso individual. `on conflict do nothing` pela mesma razão do
    -- upsert de `salvarDocumentosPrevistos`: duas parcelas nunca compartilham
    -- compromisso_id, então a duplicata é impossível aqui — e se um dia for,
    -- "pré-ligado duas vezes" não é um estado que exista.
    if p_documento_previsto_id is not null then
      insert into compromisso_documento_previsto (compromisso_id, documento_id)
      values ((v_gravada->>'compromisso_id')::uuid, p_documento_previsto_id)
      on conflict do nothing;
    end if;

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

comment on function compra_cartao_gravar_lote(uuid, uuid, date, numeric, jsonb, uuid) is
  'CONTAI-084 + CONTAI-100: grava as N parcelas de uma compra no cartão como N '
  'Compromisso independentes, numa única transação, e — quando '
  'p_documento_previsto_id vem preenchido — uma linha de '
  'compromisso_documento_previsto por parcela, na MESMA transação. Nunca '
  'aceita documento_origem_id (ADENDO 9 §M): pré-vínculo é intenção editável, '
  'origem é fato imutável da criação, e os dois não se substituem.';

-- ── EXECUTE: revoke de public/anon, grant só a authenticated ─────────────
-- A assinatura NOVA nasce com `execute` para `public` como qualquer função, e o
-- revoke da 0026 morreu no `drop` acima junto com a assinatura antiga.
revoke execute on function
  compra_cartao_gravar_lote(uuid, uuid, date, numeric, jsonb, uuid)
  from public, anon;
grant execute on function
  compra_cartao_gravar_lote(uuid, uuid, date, numeric, jsonb, uuid)
  to authenticated;
