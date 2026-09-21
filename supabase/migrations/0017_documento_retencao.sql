-- CONTAI-038 — a retenção de uma NF de serviço vira LISTA DE LINHAS.
--
-- Fonte normativa: docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md
-- (corpo §§0-7 + ADENDO de 2026-09-19, que vence onde divergir do corpo).
--
-- ⚠️ **`retencao_11 boolean` responde uma pergunta que nunca é a certa.** Para
-- tomador PESSOA FÍSICA, a retenção do art. 31 da Lei 8.212/91 não existe em
-- percentual nenhum — nem 11%, nem 3%, nem 4,8% (§0). E a nota real do
-- Francisco nem discrimina por tributo: o campo é uma linha única, *"Total das
-- Retenções (ISSQN / Federais)"* (ADENDO, fato novo). Um booleano não aguenta
-- nem o caso binário, muito menos N linhas com rótulo livre (§4.2 do parecer de
-- 2026-08-18).
--
-- ⚠️ **A pergunta obrigatória do repo** (`CLAUDE.md`, ponto cego do E2E local):
-- *isto depende de algum default do stack local que o projeto remoto não tem?*
-- **Dependeria** — nasce TABELA nova, e tabela criada no stack do CLI sai com
-- tudo liberado para `anon` e `authenticated` pelo `alter default privileges`,
-- enquanto no remoto sai com nada. Por isso o revoke-antes-grant no fim, e por
-- isso `documento_retencao` entra em `e2e/privilegios.spec.ts` no MESMO diff.
-- Nenhuma sequence, nenhuma view, nenhuma coluna com default de servidor em
-- campo fiscal (critério 17).

-- ══ 1 · Os enums ═════════════════════════════════════════════════════════
--
-- Três enums, e nenhum deles tem DEFAULT em lugar nenhum: são campos fiscais,
-- e campo fiscal não tem default (regra dura do projeto, reafirmada no §3 do
-- parecer). O banco recusa a linha incompleta; a tela nomeia o que falta.

-- O GATE, por documento (critério 1). Duas respostas, e só duas: a pergunta é
-- *"esta nota destaca alguma retenção?"*, não *"quanto"* nem *"de quê"*.
--
-- ⚠️ `null` existe SÓ para o legado (documento gravado antes desta migration).
-- Ele **não é lido como "nenhuma"** em lugar nenhum — é o "não foi perguntado"
-- que a tela de detalhe devolve como pergunta, olhando o papel (critério 18).
create type retencao_na_nota as enum ('nenhuma', 'destacada');

-- O que a LINHA representa (ADENDO A.1). As três respostas são de primeira
-- classe — inclusive `nao_sei`, que não é erro de preenchimento.
create type composicao_retencao as enum (
  'tributo_identificado',  -- a nota diz qual tributo é, e o Mateus escolheu
  'combinado_nao_aberto',  -- "Total das Retenções (ISSQN / Federais)" — fica combinado
  'nao_sei'                -- resposta válida, nunca chute do sistema
);

-- Qual tributo, quando (e SÓ quando) a composição é `tributo_identificado`.
-- ⚠️ Nunca inferido a partir do `rotulo_literal` — o app não rotula a linha
-- antes de o Mateus escolher (§4, item 1).
create type tributo_retido as enum ('iss', 'inss', 'irrf', 'pis', 'cofins', 'csll');

-- Quem recolhe o valor que foi de fato descontado do pagamento (ADENDO A.2 e
-- A.4). ⚠️ `nao_sei` é resposta de PRIMEIRA CLASSE — é literalmente a resposta
-- do Mateus à P4 ("não tenho certeza, posso descobrir"), e tratá-la como erro
-- de preenchimento obrigaria a inventar uma certeza que não existe.
create type quem_recolhe_retencao as enum ('eu', 'empresa', 'nao_sei');

-- ══ 2 · O gate, em `documento` ═══════════════════════════════════════════
--
-- Dissent do `cto-obra` incorporado (critério 2): "0..N linhas sem afirmação
-- explícita de gate" deixaria lista vazia indistinguível de "não respondi" —
-- que é o branco silencioso que o projeto inteiro proíbe. Com o gate, o par
-- `destacada` + zero linhas é uma inconsistência VISÍVEL na tela de detalhe,
-- nunca lida como "nota sem retenção".
--
-- Nullable e SEM DEFAULT: `null` é só o legado. A obrigatoriedade em
-- `nf_servico` mora em `validarDocumento` (`lib/fiscal/documento.ts`), como a
-- de `cno_na_nota` — um check no banco recusaria as linhas que já existem.
alter table documento add column retencao_na_nota retencao_na_nota;

comment on column documento.retencao_na_nota is
  'CONTAI-038 — "esta nota destaca alguma retenção?". null = legado, NUNCA '
  'lido como "nenhuma" (critério 18: essas notas pedem conferência na tela).';

-- ══ 3 · As linhas ════════════════════════════════════════════════════════
--
-- Tabela própria, e não jsonb: privilégio no Postgres é por TABELA, nunca por
-- coluna (motivo já escrito na 0009). Em jsonb, `composicao`/`tributo`/
-- `quem_recolhe` herdariam o UPDATE amplo de `documento`, ficariam invisíveis
-- para `privilegios.spec.ts`, e os dois CHECKs abaixo virariam convenção de
-- código — que é exatamente o que o §4 do parecer proíbe.
--
-- ⚠️ **SEM `user_id` próprio**, como `terreno_desembolso_anexo` (0010): o dono é
-- DERIVADO do pai na policy. Com coluna própria, a linha de retenção de uma
-- conta pendurada no documento de outra é representável; sem ela, é impossível.
create table documento_retencao (
  id             uuid primary key default gen_random_uuid(),
  documento_id   uuid not null references documento(id) on delete cascade,
  -- O texto EXATAMENTE como aparece na nota (ADENDO A.1). Nunca normalizado,
  -- nunca sugerido pelo sistema: "INSS" e "Total das Retenções (ISSQN /
  -- Federais)" são identificações diferentes e as duas são legítimas.
  rotulo_literal text not null,
  valor          numeric(14,2) not null,
  composicao     composicao_retencao not null,
  tributo        tributo_retido,
  -- "esse valor é de fato abatido do que você transfere ao prestador?" (§3).
  -- Perguntado SEMPRE, mesmo quando parece óbvio: confundir composição
  -- informativa do DAS com dinheiro descontado infla a impressão de "já paguei
  -- retenção" quando nada saiu da conta dele (§4, item 2).
  e_desconto_efetivo boolean not null,
  quem_recolhe   quem_recolhe_retencao,
  created_at     timestamptz not null default now(),

  -- Valor de linha é o que está impresso na nota: zero não é uma linha, é a
  -- ausência dela.
  constraint documento_retencao_valor_positivo check (valor > 0),

  -- Tributo existe se e somente se a composição for `tributo_identificado`.
  -- Os dois lados importam: sem o "somente se", uma linha combinada poderia
  -- carregar um tributo escolhido — que é a decomposição que o ADENDO A.1
  -- proíbe em regra dura.
  constraint documento_retencao_tributo_coerente
    check ((composicao = 'tributo_identificado') = (tributo is not null)),

  -- "Quem recolhe" existe se e somente se o valor foi de fato descontado.
  -- ⚠️ É o CHECK que impede a linha incompleta de existir: com desconto
  -- efetivo e sem resposta, o banco recusa. Não há estado "linha salva pela
  -- metade" — a tela bloqueia o botão antes, e aqui é a trava de verdade.
  constraint documento_retencao_recolhedor_coerente
    check (e_desconto_efetivo = (quem_recolhe is not null))
);

comment on table documento_retencao is
  'CONTAI-038 — uma linha por retenção destacada na NF de serviço, capturada '
  'como está impressa. NUNCA lida pela base de aferição do SERO (parecer §2).';

create index idx_documento_retencao_documento
  on documento_retencao(documento_id, created_at);

alter table documento_retencao enable row level security;

-- ⚠️ `using` E `with check` IGUAIS, e a repetição não é descuido: sem o
-- `using`, o DELETE passa pelo GRANT e é barrado em silêncio pela RLS — o
-- PostgREST devolve 200 com zero linhas, e a tela "removeria" a linha que
-- continua no banco. É por isso que `removerLinhaRetencao` em `lib/data.ts`
-- exige `data.length === 1` em vez de confiar no sucesso da chamada.
create policy dono_documento_retencao on documento_retencao for all
  using (
    exists (
      select 1 from documento d
       where d.id = documento_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from documento d
       where d.id = documento_id and d.user_id = auth.uid()
    )
  );

-- ══ 4 · `retencao_11` sai do SCHEMA, nas duas tabelas ════════════════════
--
-- §3 do parecer, literal: *"`documento.retencao11: boolean` deve ser removido,
-- não só de UI — do schema. [...] mantê-lo como campo morto no schema é convite
-- para algum cálculo futuro voltar a tratá-lo como sinal de abatimento."*
--
-- `favorecido.retencao_11` (a flag de "% padrão do prestador", nunca usada em
-- tela nenhuma) sai no mesmo diff, e pela razão mais forte: ela é a
-- materialização exata do "% padrão por prestador" que o §3 REJEITA — a
-- alíquota efetiva do Simples muda com a RBT12 da empresa mês a mês, e um "%"
-- cadastrado vira mentira silenciosa na segunda nota. Deixá-la viva é convite
-- para a próxima feature reintroduzir a ideia.
alter table favorecido drop column retencao_11;

-- ══ 5 · A RPC de anexar depois passa a gravar o GATE ═════════════════════
--
-- `drop` + `create`, e não `create or replace`: o Postgres não troca o TIPO de
-- um parâmetro por replace. A função é a mesma da 0014 (CONTAI-033), com o
-- quarto parâmetro trocado — a repergunta do §A.7.3 continua existindo, só que
-- agora ela devolve o gate de duas opções, não "é 11%?".
drop function anexar_arquivo_documento(uuid, text, boolean, boolean);

-- ⚠️ `p_retencao_na_nota` com `default null` e por isso no fim da lista, pelo
-- mesmo motivo da 0014: o `supabase gen types` traduz default em campo
-- OPCIONAL do TypeScript, e sem isto passar `null` de `lib/data.ts` exigiria
-- cast — que é onde o tipo para de proteger. O PostgREST chama por NOME.
create function anexar_arquivo_documento(
  p_documento_id uuid,
  p_arquivo_path text,
  p_nota_no_cpf boolean,
  p_retencao_na_nota retencao_na_nota default null
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
    -- O gate só existe em NF de serviço (`exigeRetencao`); nos outros tipos a
    -- coluna fica como estava, em vez de virar um `null` "respondido".
    retencao_na_nota    = case when v_tipo = 'nf_servico' then p_retencao_na_nota
                               else retencao_na_nota end,
    -- Mesma regra de `statusDocumento`: quarentena vence sobre a do boleto,
    -- porque a constraint `documento_quarentena_coerente` exige isso.
    --
    -- ⚠️ O `::status_documento` no primeiro braço não é enfeite: sem ele o
    -- `case` inteiro tipa como `text` e o UPDATE morre em RUNTIME (lição do
    -- Gate 1 do CONTAI-033).
    status              = case when not p_nota_no_cpf then 'quarentena'::status_documento
                               when v_tipo = 'boleto' then 'aguardando_pagamento'
                               else 'registrado' end,
    motivo_quarentena   = case when not p_nota_no_cpf
                               then 'Documento não está no CPF do dono da obra — não entra no custo de aquisição.'
                               else null end
   where id = p_documento_id;
end;
$$;

-- Agora que ninguém mais a lê nem a escreve, a coluna sai. **Depois** da
-- função: a assinatura antiga referenciava `retencao_11` no corpo, e deixar a
-- ordem invertida é pedir para descobrir o esquecimento em produção.
alter table documento drop column retencao_11;

-- ══ 6 · REVOKE antes do GRANT — é o que faz local == remoto (0005) ═══════
--
-- ⚠️ **DELETE CONCEDIDO — decisão do `cto-obra` em 2026-09-20**, e o fundamento
-- é o mesmo da 0006 (`pagamento_documento`), não uma exceção nova:
--
--   `documento_retencao` é **AFIRMAÇÃO** do Mateus sobre o papel, não **ACERVO**
--   com arquivo no bucket.
--
-- `documento` e `documento_anexo` continuam SEM DELETE porque lá a linha É a
-- prova apontando para o objeto no Storage — apagá-la deixaria o objeto órfão
-- e invisível. Aqui não: a NF continua intacta em `documento`, e uma linha de
-- retenção errada não perde documento nenhum. Pelos critérios 12 e 13 ela não
-- toca custo de aquisição nem base do SERO — o raio de dano é uma pendência
-- vermelha errada, que é exatamente o que se quer poder corrigir.
--
-- Soft-delete (`removida_em`) foi REJEITADO: é DELETE disfarçado de UPDATE, e
-- todo leitor (resumo, detalhe, dossiê, CHECKs, E2E) passaria a depender de um
-- `where removida_em is null`. Um filtro esquecido em qualquer um deles é o
-- erro fiscal silencioso que o projeto proíbe.
--
-- UPDATE serve a UM ato: responder/corrigir `quem_recolhe` numa linha já
-- gravada (a única correção de linha que este ticket entrega).
revoke all on table documento_retencao from anon, authenticated;
grant select, insert, update, delete on table documento_retencao to authenticated;

-- A função nova nasce com `execute` para `public` (que inclui `anon`) em
-- QUALQUER Postgres, local ou remoto — o `drop`/`create` acima zerou o
-- privilégio declarado na 0014.
revoke execute on function
  anexar_arquivo_documento(uuid, text, boolean, retencao_na_nota)
  from public, anon;

grant execute on function
  anexar_arquivo_documento(uuid, text, boolean, retencao_na_nota)
  to authenticated;

-- ⚠️ Nenhum GRANT novo em `documento`: ela já tem `INSERT,SELECT,UPDATE` para
-- `authenticated` desde a 0005, e é esse UPDATE que a coluna nova usa.
-- Continua **sem DELETE**: acervo append-only.
