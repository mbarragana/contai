-- CONTAI-098 — reaproveitar o comprovante de um pagamento IRMÃO da mesma fatura
-- (dívida D56-b, ponta B).
--
-- Fonte normativa: docs/tickets/CONTAI-027.md:404-427 §1 + docs/pareceres/
-- 2026-08-18-compromisso-versus-pagamento.md ADENDO 2 §1-§2 (as quatro provas do
-- comprovante no caminho PF) + docs/tickets/CONTAI-061.md (Gate Fiscal e
-- Viabilidade: mecanismo de rastro/`revisao`, trigger
-- `pagamento_comprovante_path_imutavel`). Nada aqui é inferido.
--
-- ⚠️ **NÃO É CASO FISCAL NOVO** (Gate Fiscal item 2): um `comprovante_path` em N
-- `pagamento`s de favorecidos distintos já é o padrão em produção no caminho
-- "fatura paga integral" — `fatura_desembolso_gravar` e `fatura_alocar` (0013,
-- 0024) copiam o mesmo path para cada pagamento que nasce do desembolso. Este
-- arquivo dá a esse padrão uma segunda porta de entrada, RETROATIVA, para o
-- pagamento que já estava gravado sem comprovante.
--
-- ⚠️ **POR QUE FUNÇÃO NOVA, E `anexar_comprovante_pagamento` FICA COM ZERO
-- DIFF** (critério 13, decisão do `cto-obra`): aqui o app **não passa um path**,
-- passa a ORIGEM — e o banco lê o path dela. A diferença não é de estilo: com o
-- path vindo da tela, "este arquivo é de um irmão da mesma fatura" seria promessa
-- do cliente; com a origem, a proveniência é verificável por construção, no mesmo
-- statement que grava.
--
-- ⚠️ **"IRMÃO" SÓ EXISTE NA GRANULARIDADE DE FATURA**, nunca de desembolso — fato
-- do modelo, não limitação de implementação: não há `pagamento.fatura_desembolso_id`
-- nem tabela que registre qual desembolso quitou qual compromisso. A única cadeia
-- determinística é `pagamento → compromisso_pagamento → compromisso →
-- fatura_compromisso → fatura`, e é ela que a guarda abaixo percorre. É também por
-- isso que a TELA mantém o chip "Vou anexar um arquivo novo." sempre visível
-- (critério 4): o arquivo de um irmão pode ter vindo de outro desembolso da mesma
-- fatura e não ser prova deste pagamento. O banco não tem como saber disso — quem
-- afirma continua sendo o clique.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- **NENHUMA TABELA, COLUNA, SEQUENCE OU VIEW nasce aqui** — logo o `alter default
-- privileges` do stack local não morde, e não há GRANT de tabela a declarar:
-- `pagamento` já tem `INSERT,SELECT,UPDATE` para `authenticated` desde a 0005 (é
-- esse UPDATE que a função usa, `security invoker`), `revisao` já tem
-- `INSERT,SELECT` desde a 0009, e `compromisso_pagamento`/`fatura_compromisso` já
-- têm `SELECT` desde a 0007/0013.
--
-- O default que MORDE é o do PRÓPRIO POSTGRES: **função nasce com `execute` para
-- `public`**, e `public` inclui `anon` — em qualquer Postgres, local ou remoto.
-- Sem o `revoke execute ... from public, anon` do fim, o anônimo poderia carimbar
-- comprovante alheio num pagamento e abrir pendência de retificadora no acervo de
-- outra pessoa. `e2e/privilegios.spec.ts` ganha a entrada nova no MESMO diff
-- (critério 14).

create function reaproveitar_comprovante_de_irmao(
  p_pagamento_id        uuid,
  p_origem_pagamento_id uuid,
  p_anos                jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ato     uuid := gen_random_uuid();
  v_revisao uuid;
  v_path    text;
  v_id      uuid;
begin
  if p_pagamento_id is null or p_origem_pagamento_id is null then
    raise exception 'reaproveitar exige o pagamento de destino e o de origem';
  end if;

  -- O mesmo pagamento como origem de si mesmo não é reaproveitamento: ou o
  -- destino já tem comprovante (e a guarda de baixo recusa), ou não tem (e não há
  -- path a copiar). Recusar aqui dá a mensagem que diz o que aconteceu.
  if p_pagamento_id = p_origem_pagamento_id then
    raise exception 'origem e destino são o mesmo pagamento';
  end if;

  -- ══ 1 · O PATH SAI DA ORIGEM, NUNCA DA TELA ═════════════════════════════
  -- A RLS de `pagamento` vale aqui dentro (`security invoker`): pagamento de
  -- outro dono não é encontrado, e a função recusa com "não encontrado" em vez de
  -- vazar a existência dele.
  select comprovante_path into v_path
    from pagamento where id = p_origem_pagamento_id;

  if not found then
    raise exception 'pagamento de origem % não encontrado', p_origem_pagamento_id;
  end if;

  if v_path is null then
    raise exception 'o pagamento de origem % não tem comprovante', p_origem_pagamento_id;
  end if;

  -- ══ 2 · PROVENIÊNCIA: origem e destino compartilham uma FATURA ══════════
  --
  -- A cadeia inteira, nos dois sentidos, pela única rota determinística do
  -- modelo. Sem esta guarda, a assinatura aceitaria qualquer par de pagamentos do
  -- acervo e o produto ganharia um caminho para ligar o comprovante de uma fatura
  -- ao pagamento de outra — um erro que o trigger de imutabilidade tornaria
  -- PERMANENTE (pre-mortem 1 do ticket).
  if not exists (
    select 1
      from compromisso_pagamento cp_destino
      join fatura_compromisso fc_destino
        on fc_destino.compromisso_id = cp_destino.compromisso_id
      join fatura_compromisso fc_origem
        on fc_origem.fatura_id = fc_destino.fatura_id
      join compromisso_pagamento cp_origem
        on cp_origem.compromisso_id = fc_origem.compromisso_id
     where cp_destino.pagamento_id = p_pagamento_id
       and cp_origem.pagamento_id  = p_origem_pagamento_id
  ) then
    raise exception
      'origem % e destino % não pertencem à mesma fatura',
      p_origem_pagamento_id, p_pagamento_id;
  end if;

  -- ══ 3 · A MESMA GUARDA DUPLA DA 0019 ════════════════════════════════════
  -- `where comprovante_path is null` + `for update`: o ato só existe uma vez, e
  -- duas telas abertas no mesmo pagamento não gravam dois comprovantes. O trigger
  -- `pagamento_comprovante_path_imutavel` (0019) fecha o caminho direto pela
  -- tabela — critério 8 do ticket, idêntico ao que já vale no anexo tardio.
  select id into v_id
    from pagamento
   where id = p_pagamento_id and comprovante_path is null
   for update;

  if not found then
    raise exception 'pagamento % não encontrado ou já tem comprovante', p_pagamento_id;
  end if;

  update pagamento set comprovante_path = v_path where id = p_pagamento_id;

  -- ══ 4 · O RASTRO, COM MOTIVO PRÓPRIO (critério 11, Gate Fiscal item 4) ══
  -- `comprovante_reaproveitado_de_irmao`, distinto de `comprovante_chegou_depois`:
  -- a 0030 existe só para este literal, e o porquê fiscal está escrito lá.
  -- `antes` é `null` DE FATO (não havia comprovante), e a data do ato é
  -- `revisao.quando` — nunca uma coluna nova em `pagamento` (0019, §2).
  insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
  values (v_ato, 'pagamento', p_pagamento_id, 'comprovante', null, v_path,
          'comprovante_reaproveitado_de_irmao', null)
  returning id into v_revisao;

  -- O snapshot por (obra, ano) e, quando o ano é ANTERIOR ao corrente, a
  -- pendência de retificadora — a MESMA função da 0009/0019, nunca um segundo
  -- mecanismo. O ano é o do PAGAMENTO (regime de caixa): quem o calcula é
  -- `anosAfetadosDeUmaObra`, e a data do reaproveitamento é só rastro.
  perform revisao_gravar_anos(v_revisao, p_anos);

  return v_ato;
end;
$$;

-- ══ 5 · REVOKE antes do GRANT — é o que faz local == remoto (0005) ════════
revoke execute on function
  reaproveitar_comprovante_de_irmao(uuid, uuid, jsonb)
  from public, anon;

grant execute on function
  reaproveitar_comprovante_de_irmao(uuid, uuid, jsonb)
  to authenticated;
