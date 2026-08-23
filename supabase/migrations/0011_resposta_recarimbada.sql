-- CONTAI-027, retrabalho do Gate 2 — a RE-RESPOSTA de mesmo valor volta a
-- carimbar `debitos_mesmo_dia_respondido_em`.
--
-- Fonte normativa: docs/pareceres/2026-08-21-gate-fiscal-contai-027-criterio-13.md
-- (§4d, "a resposta se grava com a data em que foi dada, nos dois casos", e §6,
-- "dispara DE NOVO se a resposta vigente era 'tudo no dia X' e chega
-- comprovante novo"). Nada aqui é inferido, e nada aqui toca valor, data de
-- pagamento ou apuração.
--
-- ── O DEFEITO, por extenso ─────────────────────────────────────────────
--
-- A função da 0010 só re-carimbava quando o VALOR da resposta mudava
-- (`is distinct from`). O caso comum da re-pergunta do §6 é re-afirmar o MESMO
-- valor: chega o 2º comprovante do mesmo dia e ele responde "Tudo em [data]"
-- outra vez — `true` → `true`. O UPDATE gravava, o trigger não carimbava, a
-- marca ficava mais VELHA que o comprovante novo, e
-- `chegouComprovanteDepoisDaResposta` (lib/fiscal/terreno.ts) ficava `true`
-- para sempre: a pergunta voltava em todo ato futuro daquele desembolso e
-- nunca "pegava".
--
-- As duas consequências fiscais, nas palavras do `contador` no Gate 2:
--
-- 1. **Viola o critério 12b**: a segunda afirmação do contribuinte não existe
--    no acervo. Em 2034 o dossiê mostra uma resposta datada ANTES do papel que
--    ela deveria cobrir — que é a mesma coisa que não ter resposta.
-- 2. **Reencena em código a inversão do §3.2**: a única resposta que "cola" é
--    "Em mais de um dia", ou seja, o app treinava o honesto a declarar uma
--    pendência falsa — e essa pendência não tem baixa (§5).
--
-- ── A CORREÇÃO, e por que ela é por SINAL do cliente ────────────────────
--
-- Um trigger não enxerga QUAIS colunas o UPDATE trouxe: coluna ausente chega
-- em `new` com o valor de `old`. "Re-responder o mesmo valor" e "mexer em
-- outra coisa nesta linha" são indistinguíveis pelo conteúdo — só o ato sabe a
-- diferença. Então o ato passa a dizer:
--
--   **`debitos_mesmo_dia_respondido_em = null` no UPDATE significa "isto aqui é
--   uma resposta; banco, carimbe agora".**
--
-- Quem envia o sinal é `completarDesembolsoTerreno` (lib/data.ts), no mesmo
-- `if` que envia a resposta — nunca fora dele.
--
-- ⚠️ **A alternativa recusada, e o motivo**: carimbar em TODO update que
-- deixasse a resposta não-nula dispensaria o sinal, mas faria qualquer UPDATE
-- futuro naquela linha (uma correção de valor, uma origem de recurso) reescrever
-- a data de uma resposta que ninguém deu. Isso é o app FABRICANDO data de
-- declaração do contribuinte — pior, fiscalmente, do que o defeito que estamos
-- consertando, e invisível como ele.
--
-- ── O que a função passa a garantir, e é o ganho colateral ──────────────
--
-- `debitos_mesmo_dia_respondido_em` deixa de ser escrevível pelo cliente em
-- qualquer caminho: quando o ato não é resposta, o `else` REPÕE o valor antigo,
-- ignorando o que veio no UPDATE. Antes, um `update` com marca forjada e
-- resposta inalterada passava intacto — rastro fiscal falsificável pela mesma
-- policy que o app usa. A data da resposta é do servidor, sempre, e só do
-- servidor (é o motivo original do trigger: o relógio do aparelho não decide
-- rastro — o `JWT issued at future` do CLAUDE.md é exatamente esse desencontro).
--
-- ⚠️ **O caminho do INSERT do RPC não muda, e isso foi conferido.** Dentro de
-- `terreno_desembolso_gravar` o pai e as N filhas entram na MESMA transação, e
-- `now()` é o instante do início da transação: a marca da resposta e o
-- `created_at` dos comprovantes saem IGUAIS. O `>` estrito de
-- `chegouComprovanteDepoisDaResposta` continua lendo isso como "não é fato
-- novo", e a auto-repergunta continua fechada. O ramo `INSERT` desta função é
-- byte a byte o da 0010, de propósito.
--
-- Nenhuma tabela, coluna, sequence, view ou enum nasce aqui: `create or
-- replace function` preserva dono e ACL, e a função de trigger já está
-- declarada (não silenciada) em `e2e/privilegios.spec.ts`, com o `execute` para
-- `public` que toda função tem em qualquer Postgres. Não há `grant` novo a
-- conceder — e o `privilegios.spec` continua sendo quem prova isso.
create or replace function terreno_desembolso_datar_resposta() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.debitos_mesmo_dia_respondido_em :=
      case when new.debitos_mesmo_dia is null then null else now() end;
    return new;
  end if;

  if new.debitos_mesmo_dia is null then
    -- Resposta sem data de resposta é o "sim" invisível que o §4d proíbe; data
    -- de resposta sem resposta é rastro de nada (constraint
    -- `terreno_desembolso_resposta_datada`).
    new.debitos_mesmo_dia_respondido_em := null;
  elsif new.debitos_mesmo_dia is distinct from old.debitos_mesmo_dia
     or new.debitos_mesmo_dia_respondido_em is null then
    -- Mudou de valor, OU o ato sinalizou re-resposta zerando a marca. Nos dois
    -- casos houve afirmação do contribuinte AGORA, e é agora que ela se data.
    new.debitos_mesmo_dia_respondido_em := now();
  else
    -- Nem resposta nova, nem re-resposta: a linha do tempo não se mexe, e o
    -- que o cliente tenha mandado nesta coluna é descartado.
    new.debitos_mesmo_dia_respondido_em := old.debitos_mesmo_dia_respondido_em;
  end if;

  return new;
end;
$$;
