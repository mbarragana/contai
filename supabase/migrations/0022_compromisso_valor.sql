-- CONTAI-073 — CORRIGIR O VALOR PREVISTO de um agendamento ABERTO.
--
-- Dor de origem: parcela de cartão registrada com valor errado, e nenhum
-- caminho para consertar. Existiam `mudarDataPrevista`/`mudarDataCompraCartao`
-- (corrigem DATA) e `corrigir_documento` (corrige o valor da NOTA); nada para
-- `compromisso.valor_previsto`. Cancelar-e-recriar perderia `data_compra` e o
-- vínculo com a fatura já formada.
--
-- ⚠️ **SEM IMPACTO FISCAL, e isso é afirmação do `contador`, não conveniência.**
-- Gate Fiscal do ticket + `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`
-- §1: *"compromisso não é custo, e não é custo 'ainda pequeno' — é zero"*.
-- `valor_previsto` é previsão pura: não compõe custo de aquisição (regime de
-- caixa — a chave é `pagamento.data_pagamento`) nem base de aferição INSS.
-- Consequências concretas para este arquivo:
--   * **NENHUMA linha em `revisao`/`revisao_ano_afetado`** — não há "anos
--     afetados" a fotografar, porque nenhum ano muda de número.
--   * **NENHUMA `pendencia`** — não há retificadora possível a abrir.
--   * **NENHUM valor novo de enum** (`entidade_revisao`, `motivo_revisao`,
--     `tipo_pendencia` ficam intocados): o aparato de `revisao` não é
--     exercitado aqui, e o motivo desta correção é `text` livre (ver §1). Sem
--     `alter type add value`, logo sem a limitação de "enum novo exige
--     migration anterior à que o usa".
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- **SIM, DUAS VEZES**, e os dois defaults estão fechados aqui:
-- 1. A TABELA nova (§1): criada no stack local do CLI ela sai com tudo liberado
--    para `anon` e `authenticated` (`alter default privileges` ligado no schema
--    `public`); no remoto sai com nada. Daí o `revoke all` ANTES do `grant`
--    (§4) — a doutrina da 0005, aplicada na tabela 24ª.
-- 2. A FUNÇÃO nova (§3): função nasce com `execute` para `public` — que inclui
--    `anon` — em **qualquer** Postgres. Sem o revoke do §4, o anônimo poderia
--    reescrever o valor previsto de agendamento no acervo de outra pessoa.
-- `e2e/privilegios.spec.ts` ganha as duas entradas no MESMO diff.

-- ══ 1 · A tabela de rastro — NOVA, e não `compromisso_data_historico` ═════
--
-- ⚠️ **POR QUE TABELA NOVA E NÃO A IRMÃ.** `compromisso_data_historico` é, além
-- de rastro, o CONTADOR de adiamentos: `carregarCompromissos` conta LINHAS dela
-- para produzir o "adiado N×" do critério 34 do CONTAI-019, que a home e o
-- detalhe exibem. Uma correção de VALOR gravada lá viraria um adiamento que
-- nunca aconteceu — corromper um número já exibido para economizar uma tabela.
-- Decisão do `cto-obra` (Viabilidade do ticket); o critério 20 trava isso com
-- teste.
--
-- Mesma família da irmã em tudo o mais: append-only (sem UPDATE, sem DELETE),
-- dono DERIVADO do pai (sem `user_id` próprio — coluna própria poderia
-- DISCORDAR do pai, e discordância representável é bug esperando data), índice
-- `(compromisso_id, registrado_em)`.
create table compromisso_valor_historico (
  id             uuid primary key default gen_random_uuid(),
  compromisso_id uuid not null references compromisso(id) on delete cascade,

  -- ⚠️ **NOT NULL nos dois lados, ao contrário das datas da tabela irmã.** Lá
  -- `data_anterior`/`data_nova` são nullable porque "sem data definida" é
  -- estado legítimo do compromisso. Aqui não existe agendamento sem valor
  -- previsto: `compromisso.valor_previsto` é `not null` com check `> 0`
  -- (0007). "Antes vazio" é impossível de representar, e é bom que seja.
  valor_anterior numeric(14,2) not null,
  valor_novo     numeric(14,2) not null,

  -- ⚠️ **`text` LIVRE, sem enum, e a ausência é decisão** (Viabilidade do
  -- ticket): nada no produto ramifica por CATEGORIA de correção de valor — ao
  -- contrário de `motivo_revisao`, que é específico do aparato
  -- `revisao`/`entidade_revisao` e existe porque lá o motivo decide se abre
  -- pendência. Risco aceito e nomeado no pre-mortem 2: contar/filtrar por tipo
  -- de motivo, se algum dia for requisito, exige migration nova.
  motivo         text not null,

  registrado_em  timestamptz not null default now(),

  -- As três guardas do §3 repetidas no SCHEMA, e a repetição é deliberada: a
  -- RPC é o caminho do app, o check é o que vale para qualquer caminho. Um
  -- INSERT direto pelo PostgREST (a tabela tem `insert` para `authenticated`,
  -- e precisa ter, para a RPC `security invoker` funcionar) não pode gravar
  -- rastro de uma correção impossível.
  constraint compromisso_valor_historico_positivos
    check (valor_anterior > 0 and valor_novo > 0),
  -- Correção que não corrige nada não vira linha (critério 3).
  constraint compromisso_valor_historico_mudou
    check (valor_novo <> valor_anterior),
  -- Motivo em branco é o mesmo que motivo nenhum (critério 6). `text not null`
  -- sozinho aceita '' e '   '.
  constraint compromisso_valor_historico_motivo_nao_vazio
    check (btrim(motivo) <> '')
);

create index idx_compromisso_valor_historico_compromisso
  on compromisso_valor_historico (compromisso_id, registrado_em);

-- ══ 2 · RLS — o dono é DERIVADO do pai, como em `dono_compromisso_data_historico` ══
alter table compromisso_valor_historico enable row level security;

create policy dono_compromisso_valor_historico on compromisso_valor_historico for all
  using (exists (select 1 from compromisso c where c.id = compromisso_id and c.user_id = auth.uid()))
  with check (exists (select 1 from compromisso c where c.id = compromisso_id and c.user_id = auth.uid()));

-- ══ 3 · A RPC — um ato só, e a guarda de saldo DENTRO dele ════════════════
--
-- ⚠️ **POR QUE RPC, e não o par insert+update pelo client** (como
-- `mudarDataPrevista` faz): a guarda central deste ticket — "o valor novo tem
-- de ser MAIOR que o que já foi pago" — depende de OUTRA tabela
-- (`compromisso_pagamento` → `pagamento`). Duas idas de rede deixariam a
-- janela do pre-mortem 1 aberta: uma quitação parcial gravada por outra aba
-- entre a leitura e a escrita passaria por baixo da validação do client, e
-- `saldoDoCompromisso` (`max(0, previsto − pago)`) zeraria **em silêncio** —
-- agendamento `aberto` com saldo zero é estado que o app não sabe ler hoje.
-- Aqui a leitura e a escrita são a mesma transação, com `for update` no pai.
--
-- ⚠️ **`security invoker`**, como todas as RPCs do repo: a RLS do chamador vale.
-- O `select ... for update` não encontra o compromisso de outra conta, e a
-- mensagem que sai é a de "não encontrado" — que é a verdade para quem chamou.
--
-- ⚠️ **NÃO TOCA** `data_prevista`, `data_compra`, `favorecido_id`,
-- `documento_origem_id`, `situacao`, nem pagamento/vínculo nenhum (critério 8).
-- O único UPDATE é de `valor_previsto`.
create function corrigir_valor_compromisso(
  p_compromisso_id uuid,
  p_valor_novo     numeric,
  p_motivo         text
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_situacao situacao_compromisso;
  v_atual    numeric(14,2);
  v_pago     numeric(14,2);
  -- ⚠️ **O VALOR QUE TODAS AS GUARDAS ENXERGAM É ESTE, nunca `p_valor_novo`
  -- cru** — achado do `cto-obra` no Gate 2, reproduzido por ele com `psql`.
  --
  -- O parâmetro é `numeric` SEM typmod; a coluna é `numeric(14,2)`. Sem
  -- normalizar antes, `6000.004` contra `v_pago = 6000.00` passava pela guarda
  -- central (`6000.004 > 6000` é verdade) e **gravava `6000.00`** — que é
  -- exatamente o saldo zero em silêncio que a guarda existe para impedir. O
  -- arredondamento da coluna acontecia DEPOIS da decisão, e decisão tomada num
  -- valor que não é o que vai para o disco não é guarda nenhuma.
  --
  -- `centavosParaNumeric` (o client) nunca manda 3 casas — e isso é irrelevante:
  -- a doutrina deste arquivo é que o banco vale para QUALQUER caminho (SQL
  -- editor, script, RPC direta), não só para a tela.
  --
  -- Efeito colateral bom: `10000.004` contra um previsto de `10000.00` passa a
  -- cair na mensagem legível "igual ao valor previsto atual" em vez de estourar
  -- o check `compromisso_valor_historico_mudou` como erro cru de constraint.
  v_novo     numeric(14,2);
begin
  -- As duas guardas que não precisam do banco vêm primeiro: recusar antes de
  -- travar a linha é mais honesto com quem espera pela transação.
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'o motivo da correção é obrigatório — sem ele, o rastro não explica nada';
  end if;

  if p_valor_novo is null then
    raise exception 'o valor previsto tem de ser maior que zero';
  end if;

  -- ⚠️ A NORMALIZAÇÃO VEM ANTES DE TODA GUARDA, e `p_valor_novo` não é lido de
  -- novo em ponto nenhum daqui para baixo. O `round` é explícito, e não só a
  -- coerção do typmod de `v_novo`, para que a intenção esteja no diff: é a
  -- correção do bloqueante do Gate 2, não um detalhe de declaração.
  v_novo := round(p_valor_novo, 2);

  -- Depois do arredondamento, de propósito: `0.004` é um valor que a coluna
  -- guarda como `0.00`, e recusá-lo aqui é mais honesto que aceitá-lo e deixar
  -- o check da tabela falar por nós.
  if v_novo <= 0 then
    raise exception 'o valor previsto tem de ser maior que zero';
  end if;

  -- `for update` trava o compromisso até o fim da transação: duas telas abertas
  -- no mesmo agendamento não gravam duas correções cegas uma à outra.
  select situacao, valor_previsto into v_situacao, v_atual
    from compromisso
   where id = p_compromisso_id
   for update;

  if not found then
    raise exception 'agendamento % não encontrado', p_compromisso_id;
  end if;

  -- Fato consumado não se reescreve (Out of Scope do ticket, mesma doutrina que
  -- barra "mudou a data" e "não vai ser pago" em compromisso respondido).
  if v_situacao <> 'aberto' then
    raise exception 'este agendamento já foi respondido (%) — o valor previsto de um agendamento respondido não se corrige', v_situacao;
  end if;

  if v_novo = v_atual then
    raise exception 'o valor novo é igual ao valor previsto atual — correção que não corrige nada não vira rastro';
  end if;

  -- A soma do que JÁ SAIU DA CONTA contra este agendamento. Valor CHEIO do
  -- pagamento, encargo incluído — a mesma conta de `saldoDoCompromisso`
  -- (lib/fiscal/compromisso.ts): o que quita o credor é o que saiu.
  select coalesce(sum(p.valor), 0) into v_pago
    from compromisso_pagamento cp
    join pagamento p on p.id = cp.pagamento_id
   where cp.compromisso_id = p_compromisso_id;

  -- ⚠️ **A GUARDA CENTRAL, reconferida no BANCO** (critério 5 / pre-mortem 1).
  -- `v_pago = 0` (o caso comum: nenhuma quitação parcial) não entra aqui — o
  -- valor pode subir ou descer livremente, é previsão.
  --
  -- O errcode é CUSTOMIZADO e ESTÁVEL de propósito: a tela precisa distinguir
  -- ESTA recusa ("um pagamento pode ter sido registrado enquanto você editava")
  -- de qualquer outra falha de gravação, e casar por texto de mensagem é
  -- promessa que a primeira reescrita de copy quebra. `lib/data.ts` expõe o
  -- reconhecedor (`ehErroDeSaldoJaPago`), e nada além dele conhece este código.
  if v_pago > 0 and v_novo <= v_pago then
    raise exception 'já foi pago % contra este agendamento; o valor previsto novo tem de ser maior que isso, senão o saldo zeraria sem explicação', v_pago
      using errcode = 'CT073';
  end if;

  -- O rastro e o valor, na MESMA transação: nunca um sem o outro (critério 7).
  -- A ordem (rastro antes) é a de `mudarDataPrevista`, e aqui ela é só estética
  -- — diferente de lá, um `raise` em qualquer dos dois desfaz os dois.
  insert into compromisso_valor_historico
    (compromisso_id, valor_anterior, valor_novo, motivo)
  values (p_compromisso_id, v_atual, v_novo, btrim(p_motivo));

  update compromisso set valor_previsto = v_novo where id = p_compromisso_id;
end;
$$;

-- ══ 4 · REVOKE antes do GRANT — é o que faz local == remoto (0005) ════════
revoke all privileges on table compromisso_valor_historico from anon, authenticated;

-- `anon` não recebe NADA: não existe acesso anônimo no produto.
--
-- SEM UPDATE e SEM DELETE, como na tabela irmã: é o RASTRO, e apagar rastro é o
-- oposto do que ele existe para fazer. O `insert` é o que a RPC `security
-- invoker` precisa para gravar com o papel do app; o `select` é o card
-- "Histórico do valor previsto" do detalhe (critério 19).
grant select, insert on table compromisso_valor_historico to authenticated;

revoke execute on function corrigir_valor_compromisso(uuid, numeric, text) from public, anon;
grant  execute on function corrigir_valor_compromisso(uuid, numeric, text) to authenticated;

-- ⚠️ **NENHUM GRANT NOVO EM `compromisso`, e a ausência é decisão.** Ela já tem
-- `update` de tabela para `authenticated` desde a 0007 (quitar/cancelar, "mudou
-- a data", `motivo_cancelamento`) — este arquivo só acrescenta um quarto ato ao
-- que esse privilégio serve, sem ampliar a superfície.
