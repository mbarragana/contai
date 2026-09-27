-- CONTAI-067 — o EXTRATO DA FATURA do cartão: o elo compra↔fatura ganha
-- documento de terceiro.
--
-- Fonte normativa: docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md,
-- **ADENDO** (requisito do extrato) e **ADENDO 2** (cor/gravidade da pendência).
-- Nada aqui é inferido.
--
-- ⚠️ **O QUE FALTAVA ERA UM DOCUMENTO, NÃO UMA TELA.** Até este arquivo, nem
-- `fatura` nem `fatura_desembolso` tinham documento da FATURA em si: existia
-- `fatura_desembolso.comprovante_path` (prova a saída de caixa AGREGADA) e a NF
-- de cada compra (prova o gasto). Nenhum dos dois prova a **composição** — quais
-- compras estavam DENTRO de qual fatura —, e é essa associação que decide em
-- qual ano-calendário o gasto entra na ficha Bens e Direitos (regime de caixa,
-- IN SRF 84/2001 art. 17). Hoje quem afirma isso é só o campo `vencimento da
-- fatura` que o Mateus digita.
--
-- ⚠️ **A COLUNA É EM `fatura`, NUNCA EM `fatura_desembolso`**, e a direção é o
-- inverso exato do argumento da 0013 para o comprovante. Lá: N desembolsos, cada
-- um com o SEU comprovante → coluna no filho. Aqui: N desembolsos (rotativo),
-- **UM** extrato — a administradora emite um por CICLO. No filho ele seria
-- repetido N vezes ou ficaria pendurado num desembolso arbitrário.
--
-- ⚠️ **NENHUMA LINHA EM `revisao`**, e a ausência é decisão (critério 13 do
-- ticket): o extrato não entra em apuração nenhuma (`alocarCusto` e a aferição
-- não o leem), logo não há "anos afetados" a fotografar nem pendência de
-- retificadora a abrir. E `entidade_revisao` é ENUM: ganhar valor novo exige
-- `alter type add value` em migration própria. Fica nomeada como **D86**.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- **NENHUMA TABELA, SEQUENCE OU VIEW nasce aqui** — mas uma COLUNA sim, e ela
-- traz um default do Postgres que morde nos dois bancos igual: coluna nova
-- **herda o privilégio da tabela**, e `fatura` tem só `select, insert` (0013).
-- Ou seja: sem o `grant update (extrato_path)` do §1 abaixo, o extrato seria
-- impossível de gravar em qualquer ambiente — falha honesta, não silenciosa.
--
-- O default que morde EM SILÊNCIO é o das FUNÇÕES: função nasce com `execute`
-- para `public`, e `public` inclui `anon`, em qualquer Postgres. Sem os revokes
-- do §5, o produto ganharia superfície ANÔNIMA DE ESCRITA sobre o acervo.
-- `e2e/privilegios.spec.ts` ganha, no MESMO diff, as entradas das duas funções
-- novas, da assinatura recriada e — pela primeira vez no repo — um mapa de
-- grants de COLUNA.

-- ══ 1 · A coluna, e o GRANT DE COLUNA (nunca de tabela) ══════════════════
--
-- `nullable` pelo mesmo motivo de `comprovante_path` em `pagamento` e
-- `fatura_desembolso`: o extrato **nunca bloqueia** o registro do pagamento da
-- fatura (ADENDO, e §1 do corpo do parecer — "o valor pago é gravado sempre, é
-- fato consumado, nunca recusado"). A ausência vira pendência VERMELHA visível
-- (`fatura_sem_extrato`, lib/fiscal/fatura.ts), nunca um silêncio.
alter table fatura add column extrato_path text;

-- ⚠️ **GRANT DE COLUNA, e a diferença não é estética.** `fatura` tem só
-- `select, insert` para `authenticated` **de propósito** (0013): `data_vencimento`
-- é a CHAVE NATURAL da fatura, e "mudou a data" de uma compra re-aloca o vínculo
-- por RPC própria (`compra_cartao_mudar_data`) em vez de reescrever a coluna do
-- pai. Um `grant update on table fatura` liberaria reescrever essa chave direto
-- pelo PostgREST — e a fatura de outro ciclo passaria a cobrir compras que nunca
-- estiveram nela, que é exatamente o erro que este ticket existe para provar
-- impossível.
--
-- Consequência para o teste: grant de coluna **não aparece** em
-- `information_schema.role_table_grants` (a fonte do mapa de `privilegios.spec.ts`
-- até hoje). O spec ganha um mapa novo no mesmo diff — sem ele, este privilégio
-- ficaria invisível à suíte, e é o ponto cego local≠remoto de 2026-08-17 reaberto
-- por um caminho novo.
grant update (extrato_path) on table fatura to authenticated;

-- ══ 2 · TRANSIÇÃO ÚNICA: null → path, e nunca path → outro path ══════════
--
-- Cópia do padrão de `documento_arquivo_path_imutavel` (0014) e
-- `pagamento_comprovante_path_imutavel` (0019), pelo mesmo motivo, na terceira
-- tabela: sem o trigger, *"só grava se está null"* é promessa da RPC e nada mais
-- — o §1 acabou de conceder UPDATE nesta coluna, e o PostgREST expõe a tabela.
--
-- ⚠️ **Não existe "substituir extrato", e a ausência é escopo fechado** (Out of
-- Scope do ticket). Trocar o extrato depois de as compras da fatura já terem
-- entrado no custo de um ano-calendário é destruir o lastro da afirmação sem
-- deixar rastro.
create function fatura_extrato_path_imutavel() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.extrato_path is not null
     and new.extrato_path is distinct from old.extrato_path then
    raise exception 'extrato_path já foi definido e não pode ser reescrito';
  end if;
  return new;
end;
$$;

-- BEFORE UPDATE, e só UPDATE: `compra_cartao_gravar` insere `fatura` sem
-- extrato (o INSERT nunca é reescrita de um path anterior), e o caminho em que o
-- extrato nasce JUNTO do desembolso (§4) é um UPDATE de `null` para path — que
-- este trigger permite, por construção.
create trigger fatura_extrato_path_imutavel
  before update on fatura
  for each row execute function fatura_extrato_path_imutavel();

-- ══ 3 · O anexo TARDIO — o lugar canônico, `/fatura/[id]` ════════════════
--
-- Por que RPC, e não um `.update()` de `lib/data.ts`:
-- (a) **`where extrato_path is null`** — o ato só existe uma vez. Segunda
--     chamada não encontra a linha e a função levanta exceção, em vez de gravar
--     por cima em silêncio (mesmo desenho de `anexar_comprovante_pagamento`);
-- (b) `for update` trava a linha até o fim da transação: duas telas abertas na
--     mesma fatura não gravam dois extratos;
-- (c) a mensagem de recusa é NOMEADA. Um `.update().is("extrato_path", null)`
--     devolveria zero linhas afetadas — indistinguível de sucesso que não mudou
--     nada, que é o defeito que a doutrina do repo chama de "silêncio".
--
-- ⚠️ **NENHUM CHECK FISCAL AQUI**, ao contrário de `anexar_arquivo_documento`:
-- *"a nota está no seu CPF?"* e o gate de retenção são perguntas sobre o que está
-- impresso numa NOTA. O extrato da fatura não tem destinatário fiscal e não
-- destaca retenção — mesma razão já escrita na 0019 para o comprovante.
--
-- ⚠️ **NÃO TOCA `revisao`** (critério 13) nem `data_vencimento`, nem
-- `data_pagamento` de desembolso nenhum: o ano-calendário do custo continua
-- decidido pela data do PAGAMENTO, e o anexo do extrato não move um único
-- registro já gravado (critério 17 — este ticket nunca retroage).
create function anexar_extrato_fatura(
  p_fatura_id    uuid,
  p_extrato_path text
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  -- Guarda explícita, no molde de `anexar_comprovante_pagamento`: sem ela um
  -- `null` vindo da tela viraria um UPDATE que não anexa nada e devolve sucesso.
  if p_extrato_path is null then
    raise exception 'anexar exige o caminho do extrato no acervo';
  end if;

  select id into v_id
    from fatura
   where id = p_fatura_id and extrato_path is null
   for update;

  if not found then
    raise exception 'fatura % não encontrada ou já tem extrato', p_fatura_id;
  end if;

  update fatura set extrato_path = p_extrato_path where id = p_fatura_id;
end;
$$;

-- ══ 4 · O anexo NO MESMO ATO do desembolso (`/fatura/[id]/confirmar`) ════
--
-- Critério 3 do ticket: o extrato sobe e grava no MESMO ato de "Confirmar
-- pagamento" — nunca dois passos separados, para não existir o estado
-- intermediário "desembolso gravado, extrato perdido" numa falha parcial.
--
-- ⚠️ **DROP + CREATE, e não `create or replace`.** Parâmetro novo muda a
-- ARIDADE, e `create or replace` com aridade diferente cria uma SOBRECARGA em
-- vez de substituir — duas funções com o mesmo nome. Além de deixar a versão
-- velha (sem extrato) viva e chamável, isso quebraria a premissa escrita em
-- `e2e/privilegios.spec.ts` ("nenhuma função aqui é sobrecarregada, então o NOME
-- identifica"). Mesmo tratamento que a 0017 deu a `anexar_arquivo_documento`.
--
-- ⚠️ **O corpo é o da 0020** (que já havia substituído o da 0013 para propagar o
-- vínculo de origem — CONTAI-065), copiado integralmente: não existe "alterar o
-- meio de uma função" no Postgres. O diff real está marcado com CONTAI-067.
--
-- ⚠️ **O default vai no FIM da assinatura** (padrão da 0017): mantém a
-- compatibilidade posicional das cinco anteriores e permite a chamada por nome
-- via PostgREST.
drop function fatura_desembolso_gravar(uuid, numeric, date, text, uuid[]);

create function fatura_desembolso_gravar(
  p_fatura_id        uuid,
  p_valor            numeric,
  p_data_pagamento   date,
  p_comprovante_path text default null,
  p_compromisso_ids  uuid[] default '{}',
  -- CONTAI-067: o extrato do CICLO, não do desembolso. Opcional, e o `null`
  -- significa "não escolhi arquivo" — nunca "não tem extrato".
  p_extrato_path     text default null
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
  -- composição daquele ciclo.
  --
  -- A guarda vem ANTES do INSERT do desembolso de propósito — a transação
  -- desfaria os dois de qualquer jeito, mas a ordem da leitura importa para quem
  -- vier consertar isto em 2034.
  --
  -- ⚠️⚠️ **ESTA É A ÚNICA EXCEÇÃO DELIBERADA, NESTE TICKET, À REGRA "NUNCA
  -- RECUSA O FATO CONSUMADO"** (§1 do corpo do parecer de 2026-09-26: *"o valor
  -- pago é gravado sempre, é fato consumado, nunca recusado"*; ADENDO §B da
  -- 0013). Nomeada aqui, e não descoberta em 2034, por exigência do Gate 2
  -- (`cto-obra` + `contador`, 2026-09-26).
  --
  -- O `raise` desfaz a transação inteira: o **desembolso desta chamada também
  -- não grava**. Isso é aceito, e o que o sustenta são três coisas:
  --
  -- 1. **É inalcançável pelo caminho normal.** A tela só mostra o
  --    `CampoArquivo` do extrato quando `fatura.extrato_path is null` — com
  --    extrato já anexado ela mostra o papel em `ListaDeAnexos` e envia
  --    `p_extrato_path => null`, que não entra neste `if`. O único caminho até
  --    aqui é REENTRADA/CORRIDA: duas abas na mesma fatura, uma anexando o
  --    extrato por `/fatura/[id]` enquanto a outra confirma o pagamento com uma
  --    leitura velha da fatura.
  -- 2. **É RECUPERÁVEL, e a recuperação não perde o fato.** A tela recarregada
  --    já traz o extrato como anexado e some com o campo; o Mateus reenvia a
  --    confirmação sem extrato nenhum e o desembolso grava normalmente. Nada do
  --    fato consumado se perde — só a gravação desta tentativa específica.
  -- 3. **A alternativa era pior.** Gravar o desembolso e descartar o extrato em
  --    silêncio seria perder um documento que o Mateus acabou de subir; gravar
  --    o desembolso e SOBRESCREVER o extrato destruiria o papel que já sustenta
  --    a composição daquele ciclo, sem rastro (o que o trigger do §2 existe para
  --    impedir). Recusar ALTO, com o arquivo ainda na mão dele, é o único dos
  --    três que não perde informação.
  --
  -- ⚠️ A guarda do §3 (`anexar_extrato_fatura`) **não é exceção nenhuma** e não
  -- deve ser lida como tal: lá não há fato consumado em jogo — a chamada existe
  -- só para anexar um documento, e recusar a segunda tentativa não recusa
  -- pagamento, valor nem data de coisa alguma.
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
        perform propagar_vinculo_de_origem(v_compromisso_id, v_pagamento_id);

        update compromisso set situacao = 'quitado' where id = v_compromisso_id;
      end if;
    end loop;
  end if;

  return v_desembolso_id;
end;
$$;

-- ══ 5 · REVOKE antes do GRANT — é o que faz local == remoto (0005) ═══════
--
-- ⚠️ `fatura_extrato_path_imutavel` fica FORA do revoke, como as funções de
-- trigger da 0009, 0010, 0014 e 0019: ela é `returns trigger`, e o Postgres
-- RECUSA chamada direta ("trigger functions can only be called as triggers"). O
-- privilégio é inofensivo, e um `revoke` aqui sugeriria uma proteção que não é
-- dele. Está DECLARADA, e não silenciada, em `e2e/privilegios.spec.ts`.
revoke execute on function anexar_extrato_fatura(uuid, text) from public, anon;
grant  execute on function anexar_extrato_fatura(uuid, text) to authenticated;

-- A assinatura NOVA nasce com `execute` para `public` como qualquer função: o
-- revoke da 0013 morreu junto com a assinatura antiga no `drop` do §4.
revoke execute on function
  fatura_desembolso_gravar(uuid, numeric, date, text, uuid[], text)
  from public, anon;
grant execute on function
  fatura_desembolso_gravar(uuid, numeric, date, text, uuid[], text)
  to authenticated;

-- ⚠️ **NENHUM GRANT DE TABELA AQUI, e a ausência é decisão.** Nenhuma tabela
-- nasce neste arquivo, e `fatura` continua com `select, insert` de TABELA — o
-- único UPDATE dela é o de COLUNA do §1.
