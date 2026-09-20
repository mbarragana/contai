-- CONTAI-033 — a nota grava sem o arquivo, com três guardas.
--
-- Fonte normativa: docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md,
-- ADENDO 1 §A.3 (⚠️ o ADENDO 1 vence o corpo do parecer). O arquivo da nota é
-- PROVA do que o Mateus digitou, não FONTE: emitente, CNPJ, tipo, número e
-- valor ele leu na mensagem do WhatsApp ou no corpo do e-mail (Q1 do backlog) e
-- digitou. E esperar pelo papel PERDE O FATO — mídia de WhatsApp desaparece com
-- a conversa, e-mail some no volume, e "nota nunca registrada é nota nunca
-- cobrada", porque a cobrança só é acionável enquanto há parcela a liberar.
--
-- ⚠️ **NENHUM VALOR NOVO EM `status_documento`** (D52, fechada pelo `cto-obra`).
-- `quarentena` não pode ser reaproveitada: ela significa *destinatário ≠ CPF do
-- dono*, `motivo_quarentena` é escrito pelo sistema, a constraint
-- `documento_quarentena_coerente` (0001:66-67) depende disso, e ela colidiria
-- com o `aguardando_pagamento` do boleto. "Sem arquivo" é uma SEGUNDA DIMENSÃO,
-- não um quarto status — e quem a lê é `estadoExibido` em
-- `lib/fiscal/documento.ts`, nunca `status` cru.
--
-- ⚠️ **A pergunta obrigatória do repo** (`CLAUDE.md`, ponto cego do E2E local):
-- *isto depende de algum default do stack local que o projeto remoto não tem?*
-- **Não.** Nenhuma tabela nova, nenhuma sequence, nenhuma coluna com default do
-- servidor. `documento` já tem `INSERT,SELECT,UPDATE` para `authenticated` desde
-- a 0005, e é esse UPDATE — com a policy que já existe — que a RPC abaixo usa,
-- por ser `security invoker`. O que PRECISA de decisão explícita é a função
-- nova: função nasce com `execute` para `public` (que inclui `anon`) em
-- QUALQUER Postgres, local ou remoto. Por isso o revoke-antes-grant no fim, e
-- por isso as duas funções entram em `e2e/privilegios.spec.ts` no mesmo diff.

-- ══ 1 · `arquivo_path` passa a admitir NULL ══════════════════════════════
--
-- Era `not null` desde a 0001, com o comentário "anexo é obrigatório". A
-- obrigação não desaparece: ela deixa de ser recusa no INSERT e passa a ser
-- pendência com consequência fiscal explícita (§A.6: *"quando o anexo é prova
-- de um fato que já aconteceu, a ausência grava como pendência fiscal explícita
-- e nunca recusa o registro"*).
--
-- ⚠️ Aditivo e inofensivo para o que já existe: nenhuma linha gravada muda, e
-- todo consumidor que lia `text not null` continua lendo texto nas linhas
-- antigas. É o lado certo da assimetria de release (migration antes do código).
alter table documento alter column arquivo_path drop not null;

-- ══ 2 · TRANSIÇÃO ÚNICA: null → path, e nunca path → outro path ══════════
--
-- A doutrina da 0009 (parecer de 18/08, §1, linha `arquivo_path`) é preservada
-- ao pé da letra: **`arquivo_path` é NÃO CORRIGÍVEL — anexa-se adicional**. A
-- nulidade abre exatamente UMA transição, a de preenchê-lo pela primeira vez.
--
-- Sem este trigger, a nulidade abriria a reescrita do papel original por cima
-- de outro, que é o "flip barato" que o parecer de 18/08 manda impedir: trocar
-- o papel depois de ter afirmado os dois checks fiscais sobre ele destrói o
-- lastro da afirmação sem deixar rastro. Carta de correção e nota substitutiva
-- continuam entrando em `documento_anexo` (0009), como sempre.
create function documento_arquivo_path_imutavel() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.arquivo_path is not null
     and new.arquivo_path is distinct from old.arquivo_path then
    raise exception 'arquivo_path já foi definido e não pode ser reescrito';
  end if;
  return new;
end;
$$;

create trigger documento_arquivo_path_imutavel
  before update on documento
  for each row execute function documento_arquivo_path_imutavel();

-- ══ 3 · O ato atômico de anexar depois (Guarda 3) ════════════════════════
--
-- §A.3, Guarda 3, `[Certain]`: o check *"a nota está no seu CPF?"* é pergunta
-- sobre **o que está impresso no papel**. Respondê-la sem o papel à vista é o
-- "flip barato"; quando o arquivo sobe, o app **REPERGUNTA CPF e retenção — e
-- nunca herda a resposta anterior**.
--
-- Por que RPC, e não um `.update()` de `lib/data.ts`:
-- (a) **atomicidade** — path, os dois checks, `status` e `motivo_quarentena`
--     gravam num ato só. Em dois UPDATEs existe o estado intermediário "tem
--     arquivo, status velho", e é nele que a nota volta a contar como hábil com
--     afirmação de memória;
-- (b) **sem parâmetro opcional** — herdar a resposta antiga deixa de ser
--     representável. É a mitigação nomeada do pre-mortem 2 do ticket;
-- (c) **`where arquivo_path is null`** — o ato só existe uma vez. Segunda
--     chamada não encontra a linha e a função levanta exceção, em vez de gravar
--     silenciosamente por cima.
--
-- Forma copiada da 0009/0010, cada item com motivo escrito lá:
-- `security invoker` (a policy que barra o app barra a função; ela acrescenta
-- ATOMICIDADE e ORDEM, e nada mais) + `set search_path = public, pg_temp`
-- (contra sequestro de nome) + revoke/grant no fim.
--
-- ⚠️ **DÍVIDA ASSUMIDA, e ela CRESCE em vez de nascer**: a regra de `status` e
-- de `motivo_quarentena` está duplicada TS↔SQL (`statusDocumento` e
-- `MOTIVO_QUARENTENA_CPF` em `lib/fiscal/documento.ts`). É a mesma dívida que a
-- 0009 abriu. Duplicada, mas **IDÊNTICA char por char** — o texto abaixo é
-- cópia literal de `MOTIVO_QUARENTENA_CPF`, e divergir dele é defeito fiscal,
-- não detalhe de string.
--
-- ⚠️ `p_retencao_11` com `default null` e por isso no fim da lista: o
-- `supabase gen types` traduz default em campo OPCIONAL do TypeScript, e sem
-- isto passar `null` de `lib/data.ts` exigiria cast — que é onde o tipo para de
-- proteger. A ordem não afeta chamada nenhuma: o PostgREST chama por NOME.
create function anexar_arquivo_documento(
  p_documento_id uuid,
  p_arquivo_path text,
  p_nota_no_cpf boolean,
  p_retencao_11 boolean default null
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_tipo tipo_documento;
begin
  -- `for update` trava a linha até o fim da transação: duas telas abertas no
  -- mesmo documento não gravam dois arquivos.
  select tipo into v_tipo
    from documento
   where id = p_documento_id and arquivo_path is null
   for update;

  if not found then
    raise exception 'documento % não encontrado ou já tem arquivo', p_documento_id;
  end if;

  update documento set
    arquivo_path        = p_arquivo_path,
    -- Os DOIS checks são regravados com a resposta dada AGORA, com o papel à
    -- vista. Não há caminho que preserve a resposta de memória.
    destinatario_cpf_ok = p_nota_no_cpf,
    -- A retenção só existe em NF de serviço (`exigeRetencao`); nos outros tipos
    -- a coluna fica como estava, em vez de virar um `null` "respondido".
    retencao_11         = case when v_tipo = 'nf_servico' then p_retencao_11
                               else retencao_11 end,
    -- Mesma regra de `statusDocumento`: quarentena vence sobre a do boleto,
    -- porque a constraint `documento_quarentena_coerente` exige isso.
    --
    -- ⚠️ O `::status_documento` no primeiro braço não é enfeite: sem ele o
    -- `case` inteiro tipa como `text` e o UPDATE morre com *"column \"status\"
    -- is of type status_documento but expression is of type text"* — em RUNTIME,
    -- não no `create function`. Quem pegou isso foi o E2E do Gate 1; o plpgsql
    -- só resolve o corpo na primeira execução.
    status              = case when not p_nota_no_cpf then 'quarentena'::status_documento
                               when v_tipo = 'boleto' then 'aguardando_pagamento'
                               else 'registrado' end,
    motivo_quarentena   = case when not p_nota_no_cpf
                               then 'Documento não está no CPF do dono da obra — não entra no custo de aquisição.'
                               else null end
   where id = p_documento_id;
end;
$$;

-- ══ 4 · REVOKE antes do GRANT — é o que faz local == remoto (0005) ═══════
--
-- ⚠️ `documento_arquivo_path_imutavel` fica FORA do revoke, como as funções de
-- trigger da 0009 e da 0010: ela é `returns trigger`, e o Postgres RECUSA
-- chamada direta ("trigger functions can only be called as triggers"). O
-- privilégio é inofensivo, e um `revoke` aqui sugeriria uma proteção que não é
-- dele. Está DECLARADA, e não silenciada, em `e2e/privilegios.spec.ts`.
revoke execute on function
  anexar_arquivo_documento(uuid, text, boolean, boolean)
  from public, anon;

grant execute on function
  anexar_arquivo_documento(uuid, text, boolean, boolean)
  to authenticated;

-- ⚠️ **NENHUM GRANT DE TABELA AQUI, e a ausência é decisão**: não nasce tabela
-- nenhuma, e `documento` já tem `INSERT,SELECT,UPDATE` para `authenticated`
-- desde a 0005 — o UPDATE que a 0005 concedeu para a correção de documento
-- (CONTAI-021) é o mesmo que esta função usa. Continua **sem DELETE**: acervo
-- append-only.
--
-- Nenhuma policy nova de RLS: a de UPDATE de `documento` já existe, e
-- `security invoker` a mantém em vigor — o que a policy barra para o app fica
-- barrado dentro da função.
