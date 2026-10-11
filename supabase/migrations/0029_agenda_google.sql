-- CONTAI-092 — lembrete de pagamento agendado no Google Calendar
--
-- ⚠️ **NÃO É MIGRATION FISCAL.** O Gate Fiscal do ticket é explícito: este
-- recurso não toca classificação, regime de caixa, retenção, documentação hábil
-- nem relatório anual. O gatilho é a `data_prevista` do compromisso — fato que
-- já existia (CONTAI-019/073) e que esta migration apenas ESPELHA num
-- calendário de terceiro. A data que decide custo de aquisição continua sendo a
-- do PAGAMENTO, e nenhuma coluna aqui a conhece.
--
-- ── Por que NENHUMA coluna nova em `compromisso` (critério 13) ───────────
-- "Estado de integração com o Google não é fato fiscal e não entra na tabela
-- que alimenta os relatórios anuais." Um `google_event_id` em `compromisso`
-- faria toda query de apuração carregar uma coluna de integração, e é assim que
-- alguém, daqui a seis meses, filtra custo por "sincronizado". A separação em
-- tabela 1:1 é o que torna isso impossível de representar.
--
-- ── Por que a pendência de sincronização NÃO é `pendencia` (critério 9) ──
-- `pendencia` amarra tipo/documento/DAA — é consequência de regra de
-- documentação hábil ou de regime de caixa, e aparece nos relatórios anuais e no
-- dossiê de venda. "O Google não sincronizou o evento" não é nada disso. A
-- ressalva do `contador` virou critério: a função/query que monta esses
-- relatórios não pode ter dependência de nenhum campo de status de
-- sincronização. Por isso o estado de falha mora em `compromisso_agenda`
-- (`ultimo_erro`) e em lugar nenhum mais.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
--
-- DEPENDIA, pelo mesmo motivo da 0007/0013: esta migration CRIA DUAS TABELAS.
-- No stack local do CLI o `alter default privileges` do schema `public` está
-- LIGADO e cada uma nasceria com TODOS os privilégios para `anon` e
-- `authenticated`; no projeto remoto esse default está desligado e elas
-- nasceriam com privilégio NENHUM. Sem o `revoke` antes do `grant` no fim deste
-- arquivo, o E2E rodaria num banco mais permissivo que a produção e a suíte
-- ficaria verde enquanto o app publicado devolvia
-- `{"code":"42501","message":"permission denied for table integracao_google"}`
-- depois de um login bem-sucedido — o incidente de 2026-08-17 outra vez, e aqui
-- com uma tabela que guarda credencial.
--
-- Depois das linhas de REVOKE + GRANT, não depende mais; `e2e/privilegios.spec.ts`
-- ganhou as duas entradas no MESMO diff.
--
-- Nenhuma sequence nasce aqui (a PK de uma é `user_id`, da outra é
-- `compromisso_id`); nenhuma view, nenhuma função, nenhum trigger. Um enum,
-- duas tabelas, índice, policy e grant.

-- ── Enum ─────────────────────────────────────────────────────────────────

-- O estado do evento NO GOOGLE, como o app o deixou na última escrita
-- bem-sucedida. Dois valores, e o conjunto é fechado de propósito (critério 4):
-- não existe "marcado", "cancelado" nem "arquivado". Quitação, cancelamento e
-- data que vira nula REMOVEM o evento — um evento "marcado" continuaria
-- aparecendo na agenda do Mateus, e o histórico do compromisso já mora no app.
create type estado_agenda as enum ('presente', 'removido');

-- ── A autorização OAuth (1 linha por usuário) ───────────────────────────
--
-- ⚠️ **`refresh_token` EM TEXTO SIMPLES, protegido só por RLS** — critério 14,
-- decisão registrada do `cto-obra`, não esquecimento. A régua: a RLS já é a
-- barreira do resto do schema (CPF, CNO e o acervo inteiro vivem sob ela), e
-- trazer Vault/pgsodium reintroduziria exatamente a classe de risco de
-- divergência local×remoto do incidente de 2026-08-17 — extensão presente num
-- banco e ausente no outro, invisível para teste de comportamento.
--
-- Dívida D-a declarada no ticket: browser e servidor Next assumem o MESMO papel
-- `authenticated`, então "o token só é lido pelo servidor" é garantia de CÓDIGO,
-- não de grant. Aceito para single-user; reavaliar se houver um segundo usuário.
create table integracao_google (
  user_id          uuid primary key default auth.uid()
                     references auth.users(id) on delete cascade,

  -- O que permite renovar o access token sem o Mateus na frente da tela. É o
  -- ÚNICO segredo guardado aqui: o access token é de curta duração e nunca é
  -- persistido (pedido a cada chamada de sincronização e descartado).
  refresh_token    text not null,

  -- A conta Google autorizada, como o Google a reporta. NULLABLE porque o
  -- escopo concedido é só `calendar.events`: ele não dá acesso ao perfil, e o
  -- app não pede `openid`/`email` só para rotular um card. Quando não dá para
  -- descobrir, a tela diz que não identificou — nunca finge.
  email_conta      text,

  -- O escopo que o Google CONFIRMOU na troca do código (não o que o app pediu).
  -- Guardado para o dia em que o pedido mudar: autorização antiga com escopo
  -- menor fica identificável sem adivinhação.
  escopo           text not null,

  concedido_em     timestamptz not null default now(),

  -- A revogação/expiração detectada pelo app (401/invalid_grant do Google —
  -- critério 6). Enquanto preenchida, NENHUMA chamada ao Google sai: insistir
  -- com credencial morta é queimar cota e esconder do Mateus que os lembretes
  -- pararam. Reautorizar limpa o par.
  revogado_em      timestamptz,
  motivo_revogacao text,

  -- Revogado sem motivo (ou motivo sem data) é estado impossível: o card de
  -- `/conta` precisa dos dois para explicar o que aconteceu.
  constraint integracao_google_revogacao_par_completo
    check ((revogado_em is null) = (motivo_revogacao is null))
);

-- ── O vínculo compromisso ↔ evento do Google (1:1) ──────────────────────
--
-- ⚠️ **O `google_event_id` é DERIVADO do `compromisso_id`** (critério 3), não
-- sorteado nem devolvido pelo Google: é o uuid sem hífens (32 caracteres
-- `[0-9a-f]`, que o Google aceita como id customizado). Esta coluna existe para
-- PROVAR o que foi enviado, nunca para descobrir o que enviar — quem calcula é
-- `eventIdDeCompromisso` em `lib/agenda/evento.ts`.
--
-- É o que torna "nunca duplicar evento" estrutural: uma segunda tentativa de
-- criar o mesmo evento recebe 409 do Google e vira `patch`. Sem isso, a garantia
-- dependeria de um "busca antes de criar" que uma corrida entre duas abas
-- quebra.
create table compromisso_agenda (
  compromisso_id        uuid primary key
                          references compromisso(id) on delete cascade,

  -- ⚠️ Coluna PRÓPRIA (critério 12), e não dono derivado do pai como em
  -- `terreno_desembolso_anexo`. O risco que a derivação evita — linha de uma
  -- conta pendurada no compromisso de outra — está fechado pela policy abaixo,
  -- que exige as DUAS condições juntas: `user_id = auth.uid()` **e** o
  -- compromisso ser do mesmo dono. Com as duas, a discordância continua
  -- impossível de representar, e a coluna paga o seu preço na reconciliação
  -- (critério 11), que precisa varrer as linhas do usuário sem passar por
  -- `compromisso` em toda consulta.
  user_id               uuid not null default auth.uid()
                          references auth.users(id) on delete cascade,

  google_event_id       text not null,

  -- Como o app deixou o evento no Google na última escrita BEM-SUCEDIDA.
  -- Tentativa que falhou não mexe aqui — mexe em `tentado_em`/`ultimo_erro`.
  estado                estado_agenda not null,

  -- O par que responde "o que está lá ainda corresponde ao compromisso de
  -- hoje?" — é a régua da reconciliação do critério 11. `data_sincronizada`
  -- diferente de `compromisso.data_prevista` significa lembrete apontando para
  -- o dia errado; `situacao_sincronizada` diferente de `compromisso.situacao`
  -- significa lembrete fantasma de algo já pago ou cancelado.
  data_sincronizada     date,
  situacao_sincronizada situacao_compromisso,

  sincronizado_em       timestamptz,

  -- ⚠️ TODA tentativa carimba estes dois (critério 10), sucesso ou falha: sem
  -- `tentado_em` numa falha, "nunca tentou" e "tentou e não deu" ficam
  -- indistinguíveis, e é justamente essa diferença que o Mateus precisa para
  -- saber se o silêncio do calendário é um bug ou um blip.
  tentado_em            timestamptz,
  -- `null` = a última tentativa deu certo. **Não é pendência fiscal** e não
  -- entra em relatório nenhum (critério 9) — é estado de integração.
  ultimo_erro           text,

  -- Evento presente no Google sem a data que ele espelha é estado impossível: o
  -- lembrete só existe porque há um dia para o qual apontar.
  constraint compromisso_agenda_presente_tem_data
    check (estado <> 'presente' or data_sincronizada is not null)
);

-- ── Índices ─────────────────────────────────────────────────────────────
-- A reconciliação sob demanda (critério 11) varre as linhas do usuário; a PK já
-- cobre o caminho por compromisso.
create index idx_compromisso_agenda_user on compromisso_agenda (user_id);
-- "Quantos estão pendentes?" do card de `/conta`: as linhas com falha registrada
-- são a minoria, e o índice parcial é pequeno por construção.
create index idx_compromisso_agenda_com_erro
  on compromisso_agenda (user_id)
  where ultimo_erro is not null;

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table integracao_google  enable row level security;
alter table compromisso_agenda enable row level security;

create policy dono_integracao_google on integracao_google for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ⚠️ As DUAS condições juntas, e é isso que substitui a derivação do dono (ver
-- a nota em `user_id`): a linha tem de ser do dono da sessão **e** apontar para
-- um compromisso do mesmo dono. Sem a segunda, uma linha minha pendurada no
-- compromisso de outra conta seria representável; sem a primeira, a coluna
-- `user_id` poderia discordar do pai.
create policy dono_compromisso_agenda on compromisso_agenda for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from compromisso c
       where c.id = compromisso_id and c.user_id = auth.uid()
    )
  );

-- ── REVOKE antes do GRANT — é o que faz local == remoto (migration 0005) ─
-- Ver a resposta à pergunta obrigatória no cabeçalho.
revoke all privileges on table integracao_google, compromisso_agenda
  from anon, authenticated;

-- `anon` não recebe NADA. Aqui isso é mais do que doutrina: uma das tabelas
-- guarda um refresh token de conta Google.

-- ── `authenticated`: só o verbo que o app executa ───────────────────────
--
-- SEM DELETE nas duas, e a ausência é a decisão:
-- * `integracao_google` — "desconectar pelo app" está fora de escopo neste
--   ticket (o caminho que existe é revogar na própria conta Google). Revogação
--   DETECTADA é UPDATE de `revogado_em`, nunca apagar a linha: apagar perderia
--   `concedido_em` e `email_conta`, que são justamente o que o card do estado 4
--   mostra para o Mateus reconhecer a conta certa ao reconectar.
-- * `compromisso_agenda` — é o rastro de "o que foi enviado ao Google e quando".
--   Remover o EVENTO é `estado = 'removido'` (uma transição registrada), não
--   apagar a linha: sem ela, a reconciliação não teria como saber que existiu
--   evento, e um `events.delete` perdido viraria lembrete fantasma permanente.
--
-- UPDATE em `integracao_google` serve a dois atos: reautorizar (upsert pela PK,
-- trocando `refresh_token`/`escopo`/`concedido_em` e limpando a revogação) e
-- marcar `revogado_em`/`motivo_revogacao` quando o Google recusa a credencial.
grant select, insert, update on table integracao_google to authenticated;

-- UPDATE em `compromisso_agenda` serve ao resultado de cada tentativa de
-- sincronização — `estado`, o par sincronizado, `sincronizado_em`, `tentado_em`
-- e `ultimo_erro`. É a tabela que muda mais vezes no repo por linha, e é
-- também a única cujo conteúdo não afirma nada sobre dinheiro.
grant select, insert, update on table compromisso_agenda to authenticated;
