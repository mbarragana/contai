-- CONTAI-065 — propagar o vínculo com a nota da PREVISÃO para a QUITAÇÃO (D79)
--
-- Fonte normativa: docs/pareceres/2026-09-26-replicar-vinculo-documento-quitacao.md
-- (veredicto + as 5 condições), que consome
-- docs/pareceres/2026-08-17-vinculo-pagamento-documento.md (§2, §5, ADENDO 2).
-- Nada aqui é inferido.
--
-- ── O defeito que esta migration fecha ───────────────────────────────────
-- `compromisso.documento_origem_id` existe desde a 0007 e é ESCRITO desde
-- então (PIX/boleto agendado, e compra no cartão pelo CONTAI-064). Nunca foi
-- LIDO: `grep -rn documentoOrigemId app lib` devolvia uma escrita e zero
-- leituras. Resultado — o Mateus escolhia a nota com o dedo, no agendamento, e
-- o pagamento que nascia da quitação (fatura paga, ou PIX/boleto agendado que
-- vira pago) nascia SEM nenhuma linha em `pagamento_documento`: o vínculo que
-- `alocarCusto` consome. A afirmação humana morria no caminho, e a tela pedia
-- que ele a repetisse em "Ligar a uma nota".
--
-- ── Por que isto NÃO é vínculo por heurística (o que o §5 proíbe) ─────────
-- O parecer de 26/09 é explícito: "replicar o vínculo na quitação não é
-- inferência nova do sistema — é persistência de uma afirmação humana já
-- feita". O proibido é o app ADIVINHAR correspondência (mesmo favorecido,
-- valor parecido, datas próximas). Aqui não há adivinhação nenhuma: o
-- documento foi escolhido num formulário, com um toque, semanas antes. Mesmo
-- padrão do favorecido herdado read-only (ADENDO 2).
--
-- ── Por que uma função AUXILIAR, e não a regra copiada em três lugares ────
-- Os dois caminhos de quitação nascem em lugares diferentes: o do cartão
-- inteiro dentro do banco (`fatura_desembolso_gravar` / `fatura_alocar`,
-- migration 0013, que criam o `pagamento` elas mesmas) e o de PIX/boleto em
-- `lib/data.ts` (`quitarCompromisso`, que chama PostgREST). Escrever a
-- condição duas vezes — uma em PL/pgSQL e outra em TypeScript — daria DUAS
-- fontes de verdade para uma guarda fiscal, e a segunda divergiria na primeira
-- correção. A regra mora aqui, uma vez; `lib/data.ts` chama esta função como
-- as telas do cartão já chamam as da 0013.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ───────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- Nenhuma TABELA, coluna, sequence ou view nasce aqui — então o
-- `alter default privileges` do stack local não tem onde morder pelo lado das
-- tabelas. Mas FUNÇÃO nasce com `execute` para `public` (que inclui `anon`) em
-- QUALQUER Postgres, local ou remoto: sem o `revoke` do fim deste arquivo, o
-- anônimo poderia criar vínculo de custo no acervo de outra pessoa. É a mesma
-- classe do incidente de 2026-08-17 com superfície de ESCRITA, e é por isso que
-- `e2e/privilegios.spec.ts` ganha a linha de `propagar_vinculo_de_origem` no
-- MESMO diff.
--
-- `create or replace` nas duas funções da 0013 PRESERVA os privilégios delas
-- (mesmo caminho da 0016 com `mover_documento_de_obra`), então o mapa de
-- EXECUTE não muda para elas — e o teste acusaria se mudasse.

-- ── A propagação, com as 5 condições do parecer no corpo ─────────────────
--
-- Devolve `true` só quando CRIOU a linha. O booleano não é para a tela (nenhum
-- texto depende dele): é para o teste e para quem for ler o log — "não
-- propagou" e "não havia o que propagar" precisam ser distinguíveis sem
-- adivinhação.
--
-- ⚠️ Silêncio, nunca exceção, em TODOS os desvios. A quitação é fato
-- consumado: derrubar a gravação do pagamento porque a nota de origem mudou de
-- obra transformaria um vínculo ausente (conservador, e visível na tela como
-- "aguardando NF") num pagamento NÃO REGISTRADO — que é o erro caro. Os edge
-- cases que ficam sem vínculo são exatamente os três que o parecer manda pedir
-- toque humano.
create function propagar_vinculo_de_origem(
  p_compromisso_id uuid,
  p_pagamento_id   uuid
) returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_documento_id     uuid;
  v_obra_compromisso uuid;
begin
  -- CONDIÇÃO 1 · só replica se `documento_origem_id` estiver preenchido.
  -- O `user_id = auth.uid()` é redundante com a RLS de `compromisso` e está
  -- escrito de propósito: função `security invoker` também é lida por quem
  -- audita, e a condição de dono não deve depender de saber a policy de cor.
  select c.documento_origem_id, c.obra_id
    into v_documento_id, v_obra_compromisso
    from compromisso c
   where c.id = p_compromisso_id
     and c.user_id = auth.uid();

  if v_documento_id is null then
    return false;
  end if;

  -- CONDIÇÃO 3 · nunca por cima de vínculo que já existe.
  --
  -- ⚠️ A guarda olha o PAGAMENTO INTEIRO, não o par (pagamento, documento) —
  -- e a diferença é deliberada. Com a PK composta, repetir o par seria só um
  -- no-op; o que a condição 3 do parecer protege é outra coisa: um pagamento
  -- que JÁ TEM vínculo tem um conjunto de notas que alguém afirmou (ou pela
  -- captura "nasce ligado", ou por "Ligar a uma nota" depois). Acrescentar a
  -- nota da previsão a esse conjunto seria o app somando uma afirmação que
  -- ninguém pediu, e é o conjunto — não o par — que `alocarCusto` consome.
  --
  -- Efeito colateral aceito e NOMEADO: um pagamento que quita DOIS
  -- compromissos com notas de origem diferentes (possível na sugestão de
  -- quitação, em `/pagamento/[id]`) recebe a nota do primeiro, e o segundo
  -- continua exigindo "Ligar a uma nota" à mão. O caso do critério 3 do ticket
  -- (fatura de cartão com N compras) NÃO cai aqui: lá cada compra gera o SEU
  -- `pagamento`, logo N linhas em `pagamento_documento`, uma por pagamento.
  -- Provenance por linha (qual vínculo veio de replicação) resolveria o caso
  -- residual, e seria estrutura nova — que o ticket proíbe inventar.
  if exists (
    select 1 from pagamento_documento pd
     where pd.pagamento_id = p_pagamento_id
  ) then
    return false;
  end if;

  -- CONDIÇÃO 2 · a obra tem de bater AGORA, no ato da quitação — a do
  -- documento pode ter mudado desde o agendamento (o documento se move de obra
  -- por `mover_documento_de_obra`, 0016). Sem esta checagem, a nota de uma
  -- matrícula viraria custo de outra, que é o pre-mortem 2 do ticket.
  --
  -- CRITÉRIO 5 · e o documento tem de ser DO DONO DA SESSÃO. A FK de
  -- `compromisso.documento_origem_id` aceita qualquer uuid existente: a
  -- LEITURA é coberta pela RLS, a ESCRITA daquele campo nunca foi validada.
  -- Confiar só na RLS de `pagamento_documento` aqui seria pior do que
  -- inofensivo — a policy RECUSA o insert, e a exceção derrubaria a transação
  -- inteira da quitação (ver o ⚠️ do cabeçalho). Checar antes é o que mantém o
  -- desvio silencioso.
  --
  -- A obra do PAGAMENTO entra na mesma condição por defesa em profundidade:
  -- no caminho do cartão ela é a do compromisso por construção, e em
  -- `quitarCompromisso` o `podeQuitar` já barrou o cruzamento — mas é este
  -- insert que criaria o vínculo entre obras que o CONTAI-018 (critério 11)
  -- existe para impedir, e ele não deve depender de duas guardas de fora.
  if not exists (
    select 1
      from documento d
      join pagamento p on p.id = p_pagamento_id
     where d.id = v_documento_id
       and d.user_id = auth.uid()
       and p.user_id = auth.uid()
       and d.obra_id = v_obra_compromisso
       and p.obra_id = v_obra_compromisso
  ) then
    return false;
  end if;

  -- CONDIÇÃO 5 do parecer (diferença de valor não bloqueia) é a AUSÊNCIA de
  -- código aqui: nada compara `valor_previsto` com o valor pago. Quem decide
  -- quanto disso compõe custo continua sendo a regra do mínimo
  -- (Σ pagamentos × Σ documentos hábeis) de `alocarCusto`, intocada.
  --
  -- CONDIÇÃO 4 (vínculo replicado continua visível e editável) também não
  -- custa código: a linha é idêntica à do vínculo manual, e o DELETE de
  -- `pagamento_documento` (migration 0006) já serve à tela.
  insert into pagamento_documento (pagamento_id, documento_id)
  values (p_pagamento_id, v_documento_id)
  on conflict do nothing;

  return true;
end;
$$;

-- ── 0013 · função 3, agora propagando ────────────────────────────────────
-- Corpo idêntico ao da 0013, com UMA linha nova depois do vínculo de
-- quitação. A cópia integral é o preço de `create or replace` (não existe
-- "alterar o meio de uma função" no Postgres); o diff real está marcado com
-- CONTAI-065.
create or replace function fatura_desembolso_gravar(
  p_fatura_id        uuid,
  p_valor            numeric,
  p_data_pagamento   date,
  p_comprovante_path text default null,
  p_compromisso_ids  uuid[] default '{}'
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
begin
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
        -- acompanha o pagamento que nasce aqui. O `pagamento` acabou de ser
        -- criado nesta transação, então a guarda de "vínculo já existente"
        -- nunca dispara por este caminho — e o status continua nascendo
        -- `aguardando_nf`, porque status de pagamento é outro assunto (quem o
        -- move é o caminho de vínculo que já existe, não esta linha).
        perform propagar_vinculo_de_origem(v_compromisso_id, v_pagamento_id);

        update compromisso set situacao = 'quitado' where id = v_compromisso_id;
      end if;
    end loop;
  end if;

  return v_desembolso_id;
end;
$$;

-- ── 0013 · função 4, agora propagando ────────────────────────────────────
create or replace function fatura_alocar(
  p_desembolso_id   uuid,
  p_compromisso_ids uuid[]
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

      -- CONTAI-065 — mesma linha da função 3, e ela precisa existir nas DUAS:
      -- o rotativo aloca por aqui (tela reaberta depois, ou "decidir depois"),
      -- e um vínculo que só sobrevive na confirmação integral seria uma regra
      -- que depende de por qual porta o Mateus entrou.
      perform propagar_vinculo_de_origem(v_compromisso_id, v_pagamento_id);

      update compromisso set situacao = 'quitado' where id = v_compromisso_id;
    end if;
  end loop;
end;
$$;

-- ── EXECUTE: revoke de public/anon, grant só a authenticated ─────────────
-- `authenticated` precisa do EXECUTE mesmo sendo a função chamada POR DENTRO
-- das duas da 0013: elas são `security invoker`, então a chamada interna roda
-- com o papel do app (mesmo motivo das auxiliares já listadas em
-- `e2e/privilegios.spec.ts`). E `lib/data.ts` a chama direto, pelo PostgREST,
-- no caminho de PIX/boleto.
revoke execute on function
  propagar_vinculo_de_origem(uuid, uuid)
  from public, anon;
grant execute on function
  propagar_vinculo_de_origem(uuid, uuid)
  to authenticated;
