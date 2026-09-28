-- CONTAI-080 — PRÉ-VÍNCULO compromisso↔documento, N:M, ANTES do pagamento.
--
-- Fonte normativa: docs/pareceres/2026-08-18-compromisso-versus-pagamento.md,
-- ADENDO 6 (§J.0-J.5), ADENDO 7 (§K.1-K.5) e ADENDO 8 (§L.1-L.4). Nada aqui é
-- inferido.
--
-- ── O que esta tabela é, e o que ela NÃO é ────────────────────────────────
-- §J.1, `[Certain]`: *"o pré-vínculo não é pagamento nem documento hábil de
-- correspondência comprovada — é uma anotação estruturada de INTENÇÃO, gravada
-- no banco, sobre um fato que ainda não aconteceu"*. Consequências que valem
-- para quem for mexer aqui:
--   * **não entra em soma nenhuma**, sob nenhum rótulo, e **não é nó de
--     `alocarCusto`** (§J.1). `lib/fiscal/vinculo.ts`, `resumo.ts`,
--     `afericao.ts` e `discriminacao.ts` não conhecem esta tabela, e há
--     teste-trava por grep afirmando isso (`lib/fiscal/resumo.test.ts`).
--   * **não tira a nota de "Notas hábeis sem pagamento vinculado"** (§J.1,
--     mesma régua do CONTAI-072): só o TEXTO da tela reflete a intenção,
--     nunca o número.
--   * **não é `compromisso.documento_origem_id`** (§J.0): aquele é 1
--     documento, gravado uma vez na criação, imutável (CONTAI-064/065). Este é
--     N:M e editável a qualquer momento antes da confirmação. Os dois convivem;
--     não se confundem nem se substituem — e quem decide a bifurcação da
--     conversão é a UNIÃO deduplicada dos dois
--     (`documentosResolvidosNaConfirmacao`, `lib/fiscal/compromisso.ts`).
--
-- ── Por que SEM coluna de valor e SEM `situacao` própria ──────────────────
-- Valor: §J.4, `[Certain]` — *"não há restrição de soma no pré-vínculo, em
-- nenhuma direção"*. Uma coluna de valor aqui seria um número somável nascendo
-- ao lado de uma intenção, e o primeiro consumidor distraído o somaria: é
-- intenção, não quantia. O teto do mínimo continua nascendo só na CONVERSÃO,
-- em `alocarCusto`, sobre `pagamento_documento`.
-- Situação: a vida do pré-vínculo é a do compromisso. Ele só é exibido e
-- editável enquanto `compromisso.situacao = 'aberto'`, e essa condição se lê do
-- pai — coluna própria poderia DISCORDAR dele, e discordância representável é
-- bug esperando data (mesma doutrina de `documento_anexo`/`documento_retencao`,
-- que também não têm `user_id` próprio).
--
-- ── Nenhuma RPC nova, e a ausência é decisão do `cto-obra` ────────────────
-- A gravação é o DIFF do conjunto marcado (`salvarDocumentosPrevistos`, em
-- `lib/data.ts`): upsert com `ignoreDuplicates` + delete por par. Não há guarda
-- que dependa de outra tabela na mesma transação — diferente do CONTAI-073, em
-- que a trava "o valor novo tem de ser maior que o já pago" exigia ler
-- `compromisso_pagamento` e escrever num ato só. Aqui o pior caso de uma corrida
-- entre duas abas é uma linha a mais ou a menos numa lista de INTENÇÃO, que a
-- própria tela reexibe e deixa corrigir, sem consequência fiscal nenhuma (§J.1).
-- As guardas de app (compromisso aberto, mesma obra) ficam em
-- `podePreVincular` — mesma disciplina de `pagamento_documento`/`criarVinculos`,
-- em que a guarda de obra também é do código e não de trigger.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ───────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- **SIM, uma vez.** A TABELA nova: criada no stack local do CLI ela sai com
-- tudo liberado para `anon` e `authenticated` (`alter default privileges`
-- ligado no schema `public`); no remoto sai com nada. Daí o `revoke all` ANTES
-- do `grant` (§3) — a doutrina da 0005, aplicada na tabela 25ª.
-- Nenhuma FUNÇÃO nasce aqui, então o `execute` para `public` não tem onde
-- morder. `e2e/privilegios.spec.ts` ganha a entrada no MESMO diff.

-- ══ 1 · A tabela ══════════════════════════════════════════════════════════
--
-- PK COMPOSTA, sem `id` próprio: a linha É o par, como em `pagamento_documento`
-- e `compromisso_pagamento`. Um `id` surrogate permitiria duas linhas para o
-- mesmo par, e "pré-ligado duas vezes" não é um estado que exista.
--
-- Dono DERIVADO do pai (sem `user_id` próprio) — mesma decisão de
-- `documento_anexo` e `compromisso_valor_historico`: coluna própria poderia
-- discordar do compromisso.
create table compromisso_documento_previsto (
  compromisso_id uuid not null references compromisso(id) on delete cascade,
  documento_id   uuid not null references documento(id)   on delete cascade,
  criado_em      timestamptz not null default now(),
  primary key (compromisso_id, documento_id)
);

-- A leitura do lado da NOTA (o bloco de §J.2 no detalhe do documento, critério
-- 6: "quais agendamentos abertos pré-ligam esta nota?") varre por
-- `documento_id`, e a PK composta só serve à varredura por `compromisso_id`.
create index idx_compromisso_documento_previsto_documento
  on compromisso_documento_previsto (documento_id);

-- ══ 2 · RLS — dono DERIVADO do pai, como em `dono_compromisso_valor_historico` ══
--
-- ⚠️ A policy exige o dono do COMPROMISSO, e não também o do documento. Ela é
-- a rede de baixo contra acervo de outra conta; a guarda de OBRA (a que impede
-- pré-ligar nota de outra matrícula do próprio Mateus) é de app —
-- `podePreVincular`, reaproveitando `podeVincular` de `lib/fiscal/vinculo.ts`.
-- Mesma repartição de `pagamento_documento`, cuja policy `dono_vinculo` também
-- só exige mesmo dono.
alter table compromisso_documento_previsto enable row level security;

create policy dono_compromisso_documento_previsto on compromisso_documento_previsto for all
  using (exists (select 1 from compromisso c where c.id = compromisso_id and c.user_id = auth.uid()))
  with check (exists (select 1 from compromisso c where c.id = compromisso_id and c.user_id = auth.uid()));

-- ══ 3 · REVOKE antes do GRANT — é o que faz local == remoto (0005) ════════
revoke all privileges on table compromisso_documento_previsto from anon, authenticated;

-- `anon` não recebe NADA: não existe acesso anônimo no produto.
--
-- ⚠️ **DELETE, e ele é a EXCEÇÃO NOMEADA da 0006 aplicada de novo** — não uma
-- exceção nova. A régua é a de `pagamento_documento`: esta linha é uma
-- **AFIRMAÇÃO** do Mateus sobre correspondência (aqui, uma correspondência
-- ainda pretendida), não **ACERVO** com objeto no bucket — e afirmação errada
-- que não se pode desfazer pela tela é a dor D9 (correção por SQL à mão) de
-- volta. O critério 15 do ticket exige explicitamente que o pré-vínculo seja
-- editável até a conversão, e editar um conjunto é remover do conjunto.
--
-- SEM UPDATE: não há coluna a corrigir. Trocar de nota é remover um par e
-- inserir outro — o par É a linha.
grant select, insert, delete on table compromisso_documento_previsto to authenticated;

-- ⚠️ **NENHUM GRANT NOVO em `compromisso`, `documento` ou
-- `pagamento_documento`, e a ausência é decisão.** A conversão do critério 11
-- (N=1 automático, N≥2 confirmado) grava em `pagamento_documento` pela função
-- `criarVinculos` que já existe, com o `insert` que a 0006 já concedeu —
-- nenhuma RPC nova, nenhum privilégio novo. O caminho de `documento_origem_id`
-- (`propagar_vinculo_de_origem`, 0020) continua exatamente como está: os dois
-- convergem na MESMA linha, e o upsert com `ignoreDuplicates` faz da duplicata
-- um no-op em vez de um 23505.
