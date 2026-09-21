-- CONTAI-008 — mover o PAGAMENTO de obra sem quebrar o vínculo pagamento↔nota.
--
-- Fonte normativa: docs/pareceres/2026-08-18-correcao-de-documento-registrado.md,
-- ADENDO de 2026-08-19 (§§5.1-5.5), que é o MESMO parecer do CONTAI-021 — "a
-- simetria foi ratificada, não reinventada" (Gate Fiscal do CONTAI-008, 24/08).
-- Nada aqui é inferido.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- NENHUMA TABELA, COLUNA, SEQUENCE OU VIEW nasce aqui: esta migration só cria
-- FUNÇÃO (e substitui uma). O default que ainda morde é o do PRÓPRIO POSTGRES,
-- e não o do stack local: função nasce com `execute` para `public`, e `public`
-- inclui `anon`. O `revoke execute ... from public, anon` no fim não é simetria
-- estética — sem ele o produto ganha superfície ANÔNIMA DE ESCRITA. Mesma
-- disciplina da 0009, pelo mesmo motivo, e `e2e/privilegios.spec.ts` continua
-- sem enxergar função (ele lê `role_table_grants`), então o revoke abaixo é a
-- única proteção que existe.
--
-- `create or replace` PRESERVA a ACL da função substituída; o revoke/grant do
-- fim é repetido assim mesmo, para o arquivo declarar o estado inteiro em vez
-- de depender do que a 0009 deixou.

-- ── Mover o PAGAMENTO de obra (critérios 2, 3, 4, 5 e 8) ────────────────
--
-- `moverPagamentoDeObra` era um `UPDATE pagamento SET obra_id` SECO — o mesmo
-- defeito que a 0009 consertou do lado do documento, na direção inversa, e o
-- 021 declarou no `Out of Scope` que a porta dos fundos era este ticket. O
-- efeito real (adendo §5.1 + Dor D19):
--
-- 1. na ORIGEM o documento fica sozinho: `min(Σ pagamentos, Σ documentos)` cai
--    para ZERO naquele componente e o custo comprovado do ano CAI;
-- 2. no DESTINO entra pagamento sem documento naquela obra: `min(valor, 0) = 0`,
--    o custo NÃO sobe, e **"pago sem nota" SOBE no destino** — alarme vermelho
--    da meta 1 por um fato que não aconteceu, porque o pagamento TEM nota: ela
--    é que ficou na origem;
-- 3. no BANCO sobra vínculo vivo cruzando duas obras — o estado que o critério
--    11 do CONTAI-018 proíbe pela porta da frente.
--
-- `p_documentos` é o array de decisões, uma por documento vinculado:
--   [{"documento_id":"…","desfecho":"vai_junto"}]
--   [{"documento_id":"…","desfecho":"fica_na_origem"}]
-- Não existe terceira saída, e o ato NÃO CONCLUI COM DOCUMENTO INDECISO.
--
-- ⚠️ O CNO **não aparece nesta função**, e a ausência é REGRA FISCAL VIGENTE
-- (parecer `docs/pareceres/2026-09-20-cno-nao-bloqueia-correcao-de-obra.md`,
-- que substituiu a resposta de 24/08 à pergunta 1 do Gate Fiscal): divergência
-- de CNO na NF de serviço **avisa, nunca recusa** — a trava real da aferição é
-- `posicaoDeAfericao`, que segrega pelo CNO IMPRESSO e não pelo `obra_id`. Quem
-- quiser trazer o bloqueio para cá tem de enfrentar aquele parecer e o de
-- 2026-08-23 (§2), não reabri-lo por conveniência de uma guarda de banco.
create function mover_pagamento_de_obra(
  p_pagamento_id uuid,
  p_obra_destino uuid,
  p_documentos   jsonb,
  p_anos         jsonb
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
  v_doc     uuid;
  v_habeis  integer;
  v_lista   jsonb := coalesce(p_documentos, '[]'::jsonb);
begin
  select p.obra_id into v_origem from pagamento p where p.id = p_pagamento_id;
  if v_origem is null then
    raise exception 'pagamento % nao encontrado', p_pagamento_id;
  end if;
  if v_origem = p_obra_destino then
    raise exception 'o pagamento ja esta nesta obra';
  end if;

  -- ⚠️ CONTA, não só verifica existência (critério 13, herdado do Gate 4 do
  -- CONTAI-021). A guarda seguinte pergunta se EXISTE desfecho para cada
  -- documento vinculado; sozinha, ela aceitaria `vai_junto` DUPLICADO (duas
  -- linhas de rastro do mesmo fato) e aceitaria `vai_junto` + `fica_na_origem`
  -- para o mesmo documento (um rastro que narra ato CONTRADITÓRIO: mudou de
  -- obra *e* teve o vínculo desfeito). Inalcançável pela tela, alcançável por
  -- RPC direto — e o rastro é justamente o que ninguém relê antes de 2034.
  if jsonb_array_length(v_lista) <> (
       select count(distinct e ->> 'documento_id')
         from jsonb_array_elements(v_lista) e
     ) then
    raise exception 'ha documento com mais de um desfecho no mesmo ato';
  end if;

  -- "O ato não conclui com documento indeciso" (critério 2). Todo documento
  -- hoje vinculado a este pagamento tem de aparecer com um dos dois desfechos.
  -- Se a tela esquecer um, o banco recusa o ato inteiro — em vez de deixar
  -- nascer o vínculo cruzando obras que este ticket existe para matar.
  if exists (
    select 1 from pagamento_documento pd
     where pd.pagamento_id = p_pagamento_id
       and not exists (
         select 1 from jsonb_array_elements(v_lista) e
          where (e ->> 'documento_id')::uuid = pd.documento_id
       )
  ) then
    raise exception 'ha documento vinculado sem desfecho escolhido';
  end if;

  update pagamento set obra_id = p_obra_destino where id = p_pagamento_id;

  -- A linha PRINCIPAL do ato é a do pagamento: é ela que carrega o snapshot de
  -- anos afetados, e é dela que sai o "obra: A → B" do histórico.
  insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
  values (v_ato, 'pagamento', p_pagamento_id, 'obra', v_origem::text, p_obra_destino::text,
          'arquivamento_corrigido', null)
  returning id into v_revisao;

  for v_item in select * from jsonb_array_elements(v_lista) loop
    v_doc := (v_item ->> 'documento_id')::uuid;

    -- O lado inverso da guarda acima (bloqueante 4 do Gate 2 do 021): desfecho
    -- para documento NÃO VINCULADO gravaria rastro de um desligamento que
    -- nunca houve, ou moveria de obra um documento sem relação nenhuma com
    -- este ato.
    if not exists (
      select 1 from pagamento_documento pd
       where pd.pagamento_id = p_pagamento_id and pd.documento_id = v_doc
    ) then
      raise exception 'documento % nao esta vinculado a este pagamento', v_doc;
    end if;

    if (v_item ->> 'desfecho') = 'vai_junto' then
      -- ⚠️ Guarda contra recriar o bug pelo outro lado: se esta nota também
      -- comprova OUTRO pagamento que fica na origem, movê-la deixaria ESSE
      -- vínculo cruzando duas obras. Mesmo estado inválido, papéis trocados.
      if exists (
        select 1 from pagamento_documento pd
         where pd.documento_id = v_doc and pd.pagamento_id <> p_pagamento_id
      ) then
        raise exception 'documento % tambem esta ligado a outro pagamento desta obra', v_doc;
      end if;

      update documento set obra_id = p_obra_destino where id = v_doc;
      insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
      values (v_ato, 'documento', v_doc, 'obra', v_origem::text, p_obra_destino::text,
              'arquivamento_corrigido', null);

    elsif (v_item ->> 'desfecho') = 'fica_na_origem' then
      -- O vínculo se desfaz, com registro, e o pagamento entra em "pago sem
      -- nota" NO DESTINO — que aí é A VERDADE: a nota de outro imóvel nunca
      -- comprovou aquele pagamento (adendo §5.2(ii), direção espelhada).
      delete from pagamento_documento
       where pagamento_id = p_pagamento_id and documento_id = v_doc;

      insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
      values (v_ato, 'pagamento', p_pagamento_id, 'vinculo', v_doc::text, null,
              'arquivamento_corrigido', null);

    else
      raise exception 'desfecho % desconhecido — so existem vai_junto e fica_na_origem',
        v_item ->> 'desfecho';
    end if;
  end loop;

  -- `status` é CONSEQUÊNCIA do conjunto de vínculos (mesma nota de
  -- `apagarVinculo` em lib/data.ts) e não entra em cálculo fiscal nenhum. Aqui
  -- ele é avaliado UMA vez, DEPOIS do laço: o pagamento é um só, e perguntar
  -- "sobrou nota hábil?" a cada iteração responderia sobre um estado de meio
  -- de caminho.
  select count(*) into v_habeis
    from pagamento_documento pd
    join documento d on d.id = pd.documento_id
   where pd.pagamento_id = p_pagamento_id
     and d.tipo <> 'boleto'
     and d.status <> 'quarentena';
  if v_habeis = 0 then
    update pagamento set status = 'aguardando_nf' where id = p_pagamento_id;
  end if;

  perform revisao_gravar_anos(v_revisao, p_anos);
  return v_ato;
end;
$$;

-- ── O MESMO conserto na função do documento (critério 13) ───────────────
--
-- O ticket manda corrigir a guarda "no mesmo diff" também do lado do
-- documento: a versão da 0009 pergunta se EXISTE desfecho para cada pagamento
-- vinculado, nunca QUANTOS. Corpo idêntico ao da 0009 com o acréscimo das
-- quatro linhas de contagem — a 0009 não se edita (já foi aplicada), então o
-- conserto entra por `create or replace`.
create or replace function mover_documento_de_obra(
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
  v_lista   jsonb := coalesce(p_pagamentos, '[]'::jsonb);
begin
  select d.obra_id into v_origem from documento d where d.id = p_documento_id;
  if v_origem is null then
    raise exception 'documento % nao encontrado', p_documento_id;
  end if;
  if v_origem = p_obra_destino then
    raise exception 'o documento ja esta nesta obra';
  end if;

  -- ⚠️ ACRÉSCIMO DO CONTAI-008 (critério 13): contar, não só verificar
  -- existência. Ver a justificativa por extenso na função espelhada acima.
  if jsonb_array_length(v_lista) <> (
       select count(distinct e ->> 'pagamento_id')
         from jsonb_array_elements(v_lista) e
     ) then
    raise exception 'ha pagamento com mais de um desfecho no mesmo ato';
  end if;

  if exists (
    select 1 from pagamento_documento pd
     where pd.documento_id = p_documento_id
       and not exists (
         select 1 from jsonb_array_elements(v_lista) e
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

  for v_item in select * from jsonb_array_elements(v_lista) loop
    v_pag := (v_item ->> 'pagamento_id')::uuid;

    if not exists (
      select 1 from pagamento_documento pd
       where pd.pagamento_id = v_pag and pd.documento_id = p_documento_id
    ) then
      raise exception 'pagamento % nao esta vinculado a este documento', v_pag;
    end if;

    if (v_item ->> 'desfecho') = 'vai_junto' then
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
      delete from pagamento_documento
       where pagamento_id = v_pag and documento_id = p_documento_id;

      insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
      values (v_ato, 'pagamento', v_pag, 'vinculo', p_documento_id::text, null,
              'arquivamento_corrigido', null);

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

-- ══ EXECUTE: função nasce com `execute` para `public` ═══════════════════
revoke execute on function
  mover_pagamento_de_obra(uuid, uuid, jsonb, jsonb),
  mover_documento_de_obra(uuid, uuid, jsonb, jsonb)
  from public, anon;

grant execute on function
  mover_pagamento_de_obra(uuid, uuid, jsonb, jsonb),
  mover_documento_de_obra(uuid, uuid, jsonb, jsonb)
  to authenticated;
