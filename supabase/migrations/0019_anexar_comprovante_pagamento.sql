-- CONTAI-061 — anexar o comprovante a um pagamento JÁ GRAVADO (dívida D56).
--
-- Fonte normativa: docs/pareceres/2026-09-26-anexo-tardio-de-comprovante-d56.md
-- (§§1-3) + docs/pareceres/2026-08-18-correcao-de-documento-registrado.md (§5, o
-- rastro; §6, o detector de "ano já declarado"), os dois reaproveitados sem
-- adaptação. Nada aqui é inferido.
--
-- ⚠️ **O QUE FALTAVA ERA CAPACIDADE, NÃO TELA.** Até este arquivo,
-- `pagamento.comprovante_path` só era escrito no INSERT de criação
-- (`criarPagamento`, `fatura_desembolso_gravar`): não existia `.update()` nem
-- RPC que o preenchesse depois. Um pagamento gravado sem comprovante ficava
-- preso em "Custo em risco no IR" com o comprovante na mão do Mateus e nenhuma
-- porta no app.
--
-- ⚠️ **NENHUMA COLUNA DE "DATA DO ANEXO"**, e a ausência é a decisão do
-- `cto-obra`: o metadado É o rastro de `revisao.quando` (0009, `timestamptz`).
-- Duas colunas de "quando" em duas tabelas poderiam DISCORDAR, e o parecer §2
-- pede rastro — não um segundo campo de data que nenhuma conta lê.
--
-- ⚠️ **O ano do custo NÃO muda**, e isso é o §3 do parecer: custo conta no ano
-- do PAGAMENTO (regime de caixa), nunca no ano do anexo. Nada neste arquivo
-- toca `data_pagamento`, e é `alocarCusto` (lib/fiscal/vinculo.ts) que continua
-- sendo a única implementação da regra — ele já zera o elegível quando
-- `comprovante_path` é null, então o delta aparece só por preencher o path.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- **NENHUMA TABELA, COLUNA, SEQUENCE OU VIEW nasce aqui** — logo o `alter
-- default privileges` do stack local não morde, e não há GRANT de tabela a
-- declarar: `pagamento` já tem `INSERT,SELECT,UPDATE` para `authenticated`
-- desde a 0005, e é esse UPDATE que a RPC usa (ela é `security invoker`).
--
-- O default que MORDE é o do PRÓPRIO POSTGRES: **função nasce com `execute`
-- para `public`**, e `public` inclui `anon` — em qualquer Postgres, local ou
-- remoto. Sem o `revoke execute ... from public, anon` do fim, o produto ganha
-- superfície ANÔNIMA DE ESCRITA sobre o acervo. `e2e/privilegios.spec.ts` ganha
-- as duas entradas novas (a RPC e a função do trigger) no MESMO diff.

-- ══ 1 · O par (entidade, campo) do rastro passa a admitir o comprovante ═══
--
-- O check da 0009 fecha a lista de propósito ("sem isto, 'favorecido.valor'
-- seria gravável e o histórico de 2034 teria linhas que não descrevem fato
-- nenhum"). Ele CRESCE por migration, como o comentário daquele arquivo previu
-- — `campo` é `text` justamente para a lista crescer sem `alter type`.
--
-- `comprovante` entra só em `entidade = 'pagamento'`: o comprovante é do
-- PAGAMENTO. O papel do documento é `arquivo_path`, ele não é corrigível e o
-- adicional dele entra em `documento_anexo` (0009) — nada disso muda aqui.
alter table revisao drop constraint revisao_campo_da_entidade;

alter table revisao add constraint revisao_campo_da_entidade check (
  (entidade = 'documento'  and campo in ('valor', 'classificacao', 'obra')) or
  (entidade = 'favorecido' and campo in ('nome')) or
  (entidade = 'pagamento'  and campo in ('obra', 'vinculo', 'comprovante'))
);

-- ══ 2 · TRANSIÇÃO ÚNICA: null → path, e nunca path → outro path ══════════
--
-- Cópia do padrão de `documento_arquivo_path_imutavel` (0014), pelo mesmo
-- motivo, na outra tabela: sem o trigger, *"só grava se está null"* é promessa
-- da RPC e nada mais — `pagamento` tem UPDATE concedido a `authenticated` desde
-- a 0005, e o PostgREST expõe a tabela. Trocar o comprovante por outro depois de
-- o pagamento já ter entrado no custo de um ano-calendário é destruir o lastro
-- da afirmação sem deixar rastro, e é o pre-mortem 1 do ticket.
--
-- ⚠️ **Não existe "substituir comprovante", e a ausência é escopo fechado.**
-- Comprovante errado é correção com rastro, tela e parecer próprios — não um
-- UPDATE que este arquivo poderia ter liberado de graça.
create function pagamento_comprovante_path_imutavel() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.comprovante_path is not null
     and new.comprovante_path is distinct from old.comprovante_path then
    raise exception 'comprovante_path já foi definido e não pode ser reescrito';
  end if;
  return new;
end;
$$;

-- BEFORE UPDATE, e só UPDATE: os INSERTs que já nascem com comprovante
-- (`criarPagamento`, `fatura_desembolso_gravar` da 0013) continuam intactos —
-- ali o path é o primeiro, não a reescrita de um anterior.
create trigger pagamento_comprovante_path_imutavel
  before update on pagamento
  for each row execute function pagamento_comprovante_path_imutavel();

-- ══ 3 · O ato atômico: path + rastro + snapshot + pendência ══════════════
--
-- Por que RPC, e não um `.update()` de `lib/data.ts` (a mesma justificativa da
-- 0009, critério 9, e da 0014):
-- (a) **atomicidade** — o path, a linha de `revisao` e o snapshot de anos
--     afetados (que pode ABRIR pendência de retificadora) gravam num ato só. Das
--     duas ordens possíveis em dois statements, uma deixa rastro de um anexo que
--     não aconteceu e a outra deixa anexo sem rastro;
-- (b) **`where comprovante_path is null`** — o ato só existe uma vez. Segunda
--     chamada não encontra a linha e a função levanta exceção, em vez de gravar
--     silenciosamente por cima;
-- (c) `for update` trava a linha até o fim da transação: duas telas abertas no
--     mesmo pagamento não gravam dois comprovantes.
--
-- ⚠️ **NÃO COPIA OS CHECKS FISCAIS DE `anexar_arquivo_documento`**, e a ausência
-- é decisão do `cto-obra` ratificada pelo `contador` (parecer D56, "O que isto
-- NÃO decide"): *"a nota está no seu CPF?"* e o gate de retenção são perguntas
-- sobre o que está impresso numa NOTA. Comprovante de pagamento não responde
-- nenhuma das duas — não tem destinatário fiscal e não destaca retenção. Pôr a
-- repergunta aqui seria pedir afirmação sobre um campo que este papel não tem.
--
-- ⚠️ **NÃO TOCA `status`**, ao contrário dos moves da 0009/0016. Lá o `status`
-- é consequência do conjunto de VÍNCULOS, que o ato mexeu; aqui nenhum vínculo
-- muda. `status` não entra em cálculo fiscal nenhum, e reescrevê-lo "de brinde"
-- seria efeito colateral não pedido por critério nenhum.
--
-- Forma copiada da 0009/0014, cada item com o motivo escrito lá:
-- `security invoker` (o que a policy barra para o app fica barrado dentro da
-- função; ela acrescenta ATOMICIDADE e ORDEM, e nada mais) + `set search_path =
-- public, pg_temp` (contra sequestro de nome) + revoke/grant no fim.
--
-- Retorna o id do ATO, mesmo padrão de `mover_pagamento_de_obra`.
create function anexar_comprovante_pagamento(
  p_pagamento_id      uuid,
  p_comprovante_path  text,
  p_anos              jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ato     uuid := gen_random_uuid();
  v_revisao uuid;
  v_id      uuid;
begin
  -- ⚠️ Guarda explícita, no molde de `p_depois is null` em
  -- `corrigir_documento`: sem ela um `null` vindo da tela viraria um UPDATE que
  -- não anexa nada com uma linha de rastro dizendo que anexou. (O check
  -- `revisao_antes_difere_depois` também recusaria, mas com uma mensagem que
  -- não diz o que aconteceu.)
  if p_comprovante_path is null then
    raise exception 'anexar exige o caminho do comprovante no acervo';
  end if;

  select id into v_id
    from pagamento
   where id = p_pagamento_id and comprovante_path is null
   for update;

  if not found then
    raise exception 'pagamento % não encontrado ou já tem comprovante', p_pagamento_id;
  end if;

  update pagamento set comprovante_path = p_comprovante_path
   where id = p_pagamento_id;

  -- Parecer §2: a data do anexo é rastro obrigatório, e o rastro é ESTE —
  -- `revisao.quando`, com o `default now()` da 0009. `antes` é `null` de fato
  -- (não havia comprovante), e `null` ≠ zero ≠ string vazia: o §5 grava
  -- antes/depois como texto justamente para preservar a ausência.
  insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
  values (v_ato, 'pagamento', p_pagamento_id, 'comprovante', null, p_comprovante_path,
          'comprovante_chegou_depois', null)
  returning id into v_revisao;

  -- O snapshot por (obra, ano) e, quando o ano é ANTERIOR ao corrente, a
  -- pendência de retificadora — a MESMA de `corrigir_documento`, nunca um
  -- segundo mecanismo (parecer §3: "mostra delta, grava, abre pendência
  -- persistente de avaliar retificadora com CRC; o app nunca decide/redige").
  -- Quem decide `pendencia` é `lib/fiscal/revisao.ts`, onde "hoje" é injetável
  -- e testável — nunca o relógio do container.
  perform revisao_gravar_anos(v_revisao, p_anos);

  return v_ato;
end;
$$;

-- ══ 4 · REVOKE antes do GRANT — é o que faz local == remoto (0005) ═══════
--
-- ⚠️ `pagamento_comprovante_path_imutavel` fica FORA do revoke, como as funções
-- de trigger da 0009, 0010 e 0014: ela é `returns trigger`, e o Postgres RECUSA
-- chamada direta ("trigger functions can only be called as triggers"). O
-- privilégio é inofensivo, e um `revoke` aqui sugeriria uma proteção que não é
-- dele. Está DECLARADA, e não silenciada, em `e2e/privilegios.spec.ts`.
revoke execute on function
  anexar_comprovante_pagamento(uuid, text, jsonb)
  from public, anon;

grant execute on function
  anexar_comprovante_pagamento(uuid, text, jsonb)
  to authenticated;

-- ⚠️ **NENHUM GRANT DE TABELA AQUI, e a ausência é decisão.** Nenhuma tabela
-- nasce neste arquivo. `pagamento` já tem `INSERT,SELECT,UPDATE` para
-- `authenticated` (0005) e `revisao`/`revisao_ano_afetado`/`pendencia` já têm
-- `INSERT,SELECT` (0009) — e continuam **sem UPDATE e sem DELETE**: o rastro é
-- append-only, "nem para o dono" (parecer §5, regra dura 1).
