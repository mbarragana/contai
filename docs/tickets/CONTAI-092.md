# CONTAI-092 Lembretes automáticos de pagamento via Google Calendar

## Tipo e Prioridade
feature — **P1** — conveniência real pedida explicitamente pelo Mateus, com
escopo já fechado por ele (canal, exclusão de cartão, offsets de lembrete).
Não é fiscal (por isso não é P0), mas tem impacto direto no caso real que
motivou o pedido (risco de atraso de pagamento PIX/boleto). Justificativa
completa do `po` no backlog de origem.

## Dor de Origem
`docs/backlog/108-2026-10-11-lembretes-pagamento-google-calendar.md`.
Pagamento agendado (PIX/boleto) não tem lembrete nenhum fora do app — o
Mateus só sabe que venceu hoje se abrir a tela. Citação direta do relato:

> "se eu tenho um pagamento agendado para hoje e ele é PIX ou boleto eu
> recebo uma msg me lembrando sobre este pagamento com 5 dias de
> antecedência, depois 2 dias, depois no dia"

**Override explícito e já fechado do filtro das três metas do produto** —
não se reabre neste ticket. Este requisito não serve a nenhuma das três
metas (documento hábil / relatórios anuais / acervo de decadência): é gestão
de caixa, conveniência pura. Isso já tinha sido cortado uma vez no
`CONTAI-019` ("Out of Scope"); o `po` levantou a tensão de novo com o Mateus
antes deste registro, e ele decidiu seguir mesmo assim, conscientemente, como
exceção nomeada — não como reversão da doutrina do filtro das três metas
para requisitos futuros.

## User Story
**Como** o Mateus, gerenciando a obra em casa, sentado, com os compromissos
de pagamento já cadastrados no app, **quando** um `compromisso` com `meio`
PIX ou boleto nasce com `situacao='aberto'`, **eu quero** um evento no meu
Google Calendar com lembretes em 5 dias antes, 2 dias antes e no dia do
vencimento, **para que** eu não dependa de abrir o app para lembrar que um
pagamento está chegando, e para que o lembrete desapareça quando o pagamento
for resolvido (sem lembrete fantasma de algo já pago ou cancelado).

## Critérios de Aceite

1. [ ] Todo `compromisso` criado com `meio` PIX ou boleto, `situacao='aberto'`
   e `data_prevista` não nula gera, no Google Calendar do Mateus, **um único
   evento** cujo `reminders.overrides` contém exatamente 3 entradas (método
   `popup`, `useDefault: false`): 5 dias antes, 2 dias antes, 0 dias (no dia)
   do vencimento. O evento tem horário definido (não "dia inteiro") — hora
   padrão 09:00 `America/Sao_Paulo`, para o lembrete "no dia" soar em horário
   útil, não à meia-noite.
2. [ ] `compromisso` com `meio` cartão **não** gera evento nenhum no Google
   Calendar, em nenhum momento do seu ciclo de vida.
3. [ ] O id do evento no Google (`eventId`) é **derivado deterministicamente**
   de `compromisso.id` (uuid sem hífens, 32 caracteres `[0-9a-f]`, aceito pela
   API como id customizado). Consequência estrutural, não disciplina de quem
   escreve o código: uma segunda tentativa de criar o mesmo evento recebe 409
   do Google e é tratada como atualização (`patch`), nunca cria um segundo
   evento — cobre tanto o caminho normal (mudança de data, `CONTAI-073`)
   quanto o reprocessamento depois de uma falha (critério 11).
4. [ ] Quando o compromisso é marcado como quitado ou cancelado, OU quando
   `data_prevista` passa a ser nula (ex.: saldo remanescente de quitação
   parcial sem nova data definida), o evento correspondente é **REMOVIDO**
   (`events.delete`) do Google Calendar — nunca "marcado" ou mantido com
   outro estado (correção do `cto-obra` ao relato original, que admitia
   "removido **ou marcado**": um evento marcado ainda aparece no Google, e o
   histórico do compromisso já mora no app). Uma segunda tentativa de remoção
   (evento já removido) recebe 404/410 do Google e é tratada como "já feito",
   nunca como erro.
5. [ ] Enquanto o Mateus não concluir a autorização OAuth2 (sem linha válida
   em `integracao_google`, ou variável de ambiente do Google ausente no
   servidor), nenhuma chamada à API do Google é feita, e toda a
   criação/edição/quitação/cancelamento de compromisso continua funcionando
   normalmente — a chamada de sincronização é sempre posterior à gravação do
   compromisso e nunca bloqueia nem reverte essa gravação.
6. [ ] Se a autorização for revogada ou expirar depois de concedida (o Google
   devolve `invalid_grant`/401), o app grava `integracao_google.revogado_em`,
   para de chamar a API até nova autorização, e o card "Integrações" em
   `/conta` muda para o estado "Autorização expirada/revogada" (banner âmbar,
   texto conforme `design/mocks/CONTAI-092.md`, Estado 4) na carga seguinte
   da tela — nunca falha silenciosamente sem o Mateus ter como descobrir pela
   interface.
7. [ ] O texto do evento do Google Calendar (título + descrição) **nunca**
   contém afirmação do tipo "o app garante que você paga em dia" ou
   equivalente, nem vocabulário que sugira controle fiscal oficial ou vínculo
   com apuração — termos como "vencimento fiscal", "obrigação", "prazo
   legal", "DARF", "aferição" são proibidos no texto do evento (Gate Fiscal
   abaixo, itens 2/7a-c). A ausência do evento ou uma falha de sincronização
   nunca é apresentada, em texto nenhum do app, como fato fiscal ou
   operacional sobre o compromisso ("pagamento sem lembrete" ≠ "pagamento
   irregular"). Texto nunca sugere ou implica o status de documentação hábil
   do compromisso (nota recebida, retenção, "em dia com o Fisco").
8. [ ] O evento do Google Calendar (título, descrição, qualquer campo) contém
   **apenas** favorecido (nome), valor, forma de pagamento (Pix/Boleto) e
   data de vencimento previsto — **nunca** CPF, número de nota ou qualquer
   outro identificador do prestador/favorecido além do nome. Texto exato
   conforme `design/mocks/CONTAI-092.md`, seção "Evento do Google Calendar"
   — a frase de abertura da descrição ali é provisória até confirmação do
   `contador` (ver Perguntas Abertas; verificada abaixo sem bloquear este
   ticket).
9. [ ] Falha de sincronização de um compromisso específico (API indisponível,
   rate limit, erro transitório — token ainda válido) **nunca** entra na
   tabela `pendencia` fiscal do app, e **nunca** aparece nos relatórios
   anuais (discriminação Bens e Direitos, lista de Pagamentos Efetuados,
   posição de aferição INSS) nem no dossiê de venda — é estado de integração
   operacional, não pendência fiscal. Aparece só como: (a) linha "Lembrete no
   Google Agenda: não sincronizado. [tentar de novo]" no detalhe do
   compromisso (`/compromisso/[id]`, cor âmbar, posição e guarda conforme
   spec), com ação inline de nova tentativa sem navegação; (b) contagem de
   "Pendentes" no card "Integrações" de `/conta`.
10. [ ] Falha de escrita na API do Google por rede/rate limit/5xx tenta de
    novo até 2 vezes dentro da mesma chamada de sincronização; 4xx de
    configuração (exceto token expirado, coberto pelo critério 6) não tenta
    de novo automaticamente. Toda tentativa (sucesso ou falha) registra
    `tentado_em`/`ultimo_erro` em `compromisso_agenda`.
11. [ ] Existe reconciliação sob demanda, sem cron: uma chamada com
    `{ tudo: true }` percorre compromissos abertos PIX/boleto cuja linha em
    `compromisso_agenda` está ausente ou desatualizada (`data_sincronizada` ≠
    `data_prevista`, ou `estado` incoerente com a situação atual) e aplica o
    estado desejado no Google — segura contra duplicação pela mesma garantia
    do critério 3. Disparada pelo botão "Sincronizar agora" em `/conta` e,
    automaticamente, no máximo 1x por N horas por aparelho, ao abrir a Home
    com a integração ativa. Cobre também o backfill dos compromissos já
    existentes no banco antes deste ticket entrar em produção — não precisa
    de migração de dados separada.
12. [ ] Tabela nova `integracao_google` (1 linha por usuário: `user_id`
    (PK, `default auth.uid()`), `refresh_token`, `email_conta`, `escopo`,
    `concedido_em`, `revogado_em`, `motivo_revogacao`) e tabela nova
    `compromisso_agenda` (1:1 com `compromisso`: `compromisso_id` (PK,
    `references compromisso on delete cascade`), `user_id`,
    `google_event_id`, `estado` ∈ {`presente`, `removido`},
    `data_sincronizada`, `situacao_sincronizada`, `sincronizado_em`,
    `tentado_em`, `ultimo_erro`) — RLS por `user_id = auth.uid()` nas duas,
    sem DELETE (mesmo padrão append/update do resto do repo). A migration
    concede o privilégio explícito por tabela nomeada (nunca
    `all tables in schema public`, nunca `alter default privileges`) no
    mesmo diff, e `e2e/privilegios.spec.ts` ganha as duas entradas
    (`integracao_google: "INSERT,SELECT,UPDATE"`,
    `compromisso_agenda: "INSERT,SELECT,UPDATE"`). `lib/database.types.ts`
    regenerado.
13. [ ] Nenhuma coluna nova em `compromisso` — estado de integração com o
    Google não é fato fiscal e não entra na tabela que alimenta os
    relatórios anuais.
14. [ ] Refresh token armazenado em texto simples em
    `integracao_google.refresh_token`, protegido só por RLS — sem
    criptografia em repouso (pgsodium/Vault) nesta versão. Decisão registrada
    em Viabilidade (CTO) com justificativa; não se reabre sem motivo novo
    (ex.: segundo usuário no sistema).
15. [ ] Variáveis de ambiente `GOOGLE_OAUTH_CLIENT_ID`,
    `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` são
    **server-only** (nunca `NEXT_PUBLIC_`, mesmo padrão de `GEMINI_API_KEY`).
    Ausentes → card "Integrações" mostra o estado "Não configurado" (critério
    16) e nenhuma rota chama o Google.
16. [ ] Card "Integrações" em `/conta` (entre o card de dados da conta e o
    card "Sair") com 4 estados — Não configurado / Não conectado / Conectado
    / Autorização expirada — textos, guardas, atributo
    `data-integracao-google` e botões ("Conectar Google Agenda" / "Sincronizar
    agora" / "Conectar de novo") exatamente conforme
    `design/mocks/CONTAI-092.md`.
17. [ ] Fluxo OAuth: botão "Conectar" → `GET /api/google/agenda/autorizar`
    (gera `state` em cookie `httpOnly`, redireciona ao Google com
    `access_type=offline&prompt=consent&scope=.../auth/calendar.events`) →
    consentimento no Google → `GET /api/google/agenda/callback` (valida
    `state`, troca `code` por token no servidor via `client_secret`, grava
    `integracao_google` pelo client do servidor autenticado pelo cookie de
    sessão, redireciona a `/conta`). Cancelamento/negação no Google volta ao
    estado "Não conectado" com aviso temporário (query param transitório, nome
    exato a definir no Gate 1), sem gravar nada em `integracao_google`.
18. [ ] URI de redirecionamento (callback) cadastrada no mesmo cliente OAuth
    do Google Cloud Console, nas duas variantes: produção
    `https://contai-rosy.vercel.app/api/google/agenda/callback` e
    desenvolvimento `http://localhost:3200/api/google/agenda/callback`
    (porta do `dev:local`). A porta 3100 (Playwright) não se registra — E2E
    não fala com o Google de verdade (critério 5 cobre o caso sem
    integração; o cliente HTTP é testado com fetch stubado).
19. [ ] Spec de design em `design/mocks/CONTAI-092.md` — sem gate de
    aprovação formal (processo revisado em 2026-09-20), serve de referência
    direta para o `lead-engineer`.

## Out of Scope
- **WhatsApp como canal** — avaliado e descartado no próprio relato de
  origem pelo custo de infra (Business API, verificação Meta, templates
  pré-aprovados) frente à decisão de stack já tomada em 2026-08-07 (Google
  Calendar).
- **Lembrete para compromisso em cartão** — vai pela fatura, que já tem
  fluxo próprio de confirmação de vínculo; duplicaria um controle que já
  existe noutro lugar.
- **3 eventos separados por compromisso** — decisão fechada é 1 evento com 3
  offsets de lembrete via `reminders.overrides`, não 3 objetos de evento.
- **Reavaliação do filtro das três metas** — este requisito continua, por
  doutrina, não servindo a nenhuma das três metas. Não está sendo revertido
  nem para este ticket nem como precedente para os próximos; é um override
  pontual e consciente do Mateus.
- **Botão "Desconectar" pelo app** — não pedido no relato/escopo; inventar o
  fluxo (o que fazer com eventos já criados? apagar todos?) seria requisito
  novo. Revogar pela própria conta Google (Google Account → Segurança → Apps
  conectados) é o caminho que já existe fora do app. Pergunta aberta para o
  `po` sobre ticket futuro, abaixo.
- **Reconciliação por cron/job agendado** — decisão do `cto-obra`: reconciliação
  sob demanda (critério 11) substitui cron; não há `vercel.json`, cron no
  Hobby é diário e exigiria segredo de cabeçalho + service key, custo de
  infraestrutura desproporcional para requisito fora das três metas.
- **Criptografia em repouso do refresh token (Vault/pgsodium)** — decisão do
  `cto-obra` (critério 14): RLS já é a barreira equivalente ao resto do
  schema (CPF, CNO e acervo inteiro já vivem sob a mesma proteção), e
  trazer Vault introduziria a mesma classe de risco de divergência
  local×remoto do incidente de 2026-08-17.
- **Link de volta ao app no corpo do evento do Google Calendar** — depende
  de URL pública estável e não foi pedido no escopo; ideia registrada pelo
  `designer`, não é requisito.
- **Gestão de cronograma de obra, orçamento vs. realizado, comunicação com
  empreiteiro** — fora de escopo do produto, reafirmado por disciplina.

## Gate Fiscal (Contador)

**1. Toca regra fiscal (classificação, regime de caixa, retenção,
documentação hábil, relatórios)?** **NÃO**, confirmado por raciocínio
próprio:

- O gatilho do lembrete é a **data prevista de vencimento** do `compromisso`,
  fato que já existe antes deste ticket (`CONTAI-073`). Este ticket não cria,
  não deriva e não corrige nenhuma data — só espelha uma data existente num
  evento de calendário de terceiro.
- O lembrete dispara pela **data de vencimento previsto**, não pela **data de
  pagamento efetivo** — e essa distinção importa porque a chave do custo de
  aquisição é a data de pagamento (regime de caixa), nunca tocada aqui. Não
  há risco de um relatório anual nascer de data errada por causa desta
  feature: ela é consumidora de um dado já correto, não fonte.
- Não cria nem reclassifica documentação hábil, não toca a tabela de
  retenção (CONTAI-038), não gera nem interage com NF/recibo/comprovante.
- Não altera a base de aferição INSS: `meio` (PIX/boleto/cartão) aqui é só
  filtro de quais compromissos recebem evento, não reclassificação de
  material vs. mão de obra.
- Conclusão: feature de conveniência de gestão de caixa, sem superfície
  fiscal. Override de produto já fechado pelo Mateus, não reaberto aqui.

**2. Restrição de texto do evento/UI (critérios 7 e 8) — regra exata.** Se
**X** = texto do evento do Google Calendar, do card "Integrações" ou de
qualquer tela deste fluxo, **então**:
- **7a** — **recusar** (nunca publicar) qualquer texto com vocabulário que
  sugira controle fiscal oficial ou vínculo com apuração: termos como
  "vencimento fiscal", "obrigação", "prazo legal", "DARF", "aferição" são
  proibidos no texto do evento. O compromisso aqui é obrigação contratual com
  fornecedor/prestador, não prazo tributário.
- **7b** — **recusar** qualquer redação em que a ausência do evento ou a
  falha de sincronização seja lida como fato fiscal ou operacional sobre o
  compromisso (ex.: nunca "pagamento sem lembrete = pagamento irregular"). O
  evento é conveniência; sua falta não é evidência de nada dentro do app.
- **7c** — **recusar** qualquer texto que contenha ou implique o status de
  documentação hábil do compromisso (nota recebida, retenção, "em dia com o
  Fisco") ou qualquer leitura de GCAP/aferição. O evento mostra "pagamento
  agendado", só isso.
- **8** — **recusar** qualquer campo do evento (título, descrição, metadado)
  que carregue CPF ou outro identificador de prestador além do nome do
  favorecido. Campos permitidos: favorecido (nome), valor, forma de
  pagamento, data. CPF nunca sai do app por este caminho — exportar CPF para
  um Google Calendar pessoal seria exposição de dado de terceiro pessoa
  física sem necessidade funcional (o lembrete não precisa de CPF para
  cumprir seu propósito de "avisar que vence").

**Verificação do texto proposto pelo `designer`** (`design/mocks/CONTAI-092.md`,
seção "Evento do Google Calendar") contra 7a-c e 8, feita nesta síntese:
título `Pagamento {favorecido} — R$ {valor}` e descrição "Lembrete de
pagamento agendado no contai — conveniência, não é controle fiscal nem
garantia de que o pagamento vai sair em dia. / Favorecido / Valor previsto /
Forma / Vencimento previsto" — **nenhum termo proibido presente, nenhum CPF
ou identificador extra, nenhuma promessa de garantia.** Texto aprovado como
está; não precisa de nova rodada do `contador` antes do Gate 1. Se o Gate 1/2
alterar essa redação, a nova versão precisa ser conferida contra esta mesma
lista (7a-c, 8) antes de ir a produção.

**3. Pendência de sincronização fora da tabela `pendencia` fiscal —
correto?** **Concordo** com o `cto-obra**, com uma ressalva de implementação
(não de modelo de dados): `pendencia` fiscal amarra tipo/documento/DAA —
consequência de regra de documentação hábil ou regime de caixa. "Google não
sincronizou o evento" não é isso. **Ressalva, formalizada como critério 9**:
essa pendência de sincronização não pode, em nenhuma hipótese, aparecer nos
relatórios anuais nem no dossiê de venda — a função/query que monta esses
relatórios não deve ter acesso ou dependência de nenhum campo de status de
sincronização do Calendar.

**4. Dado de terceiro saindo do sistema (favorecido + valor no evento) —
ângulo fiscal?** Não é regra fiscal, é decisão de produto/privacidade — mas
o risco de CPF/identificador extra sim era relevante, e por isso entrou como
restrição dura (item 8 acima, critério 9 do ticket). Favorecido (nome) +
valor, isoladamente, não são dados sob sigilo fiscal — já são manuseados pelo
próprio Mateus fora do app, na própria conta Google que ele autoriza.

**5. Novas condições fiscais / pareceres?** Nenhuma. Não há parecer novo a
produzir — as restrições acima nascem do Gate Fiscal deste ticket (análise
direta do `contador`, não citação de parecer pré-existente, porque não há
regra tributária sendo aplicada aqui, só uma restrição de linguagem para
evitar implicar algo fiscal que não existe).

## Pre-mortem
1. **Token revogado ou expirado sem detecção visível.** O Mateus revoga o
   acesso no painel do Google (ou o refresh token expira por inatividade) e
   o app continua tentando sincronizar em silêncio: todo compromisso novo
   deixa de gerar lembrete, e ele só percebe semanas depois, quando um
   pagamento vence sem aviso — a dor que o ticket deveria resolver, mascarada
   por falsa sensação de que "está funcionando". Mitigado pelo critério 6,
   mas é o risco de maior probabilidade porque falha de token é silenciosa
   por natureza.
2. **Evento duplicado por falha de idempotência na atualização de data.** Se
   a chamada de "criar" e a de "atualizar" não forem diferenciadas de forma
   confiável (corrida entre duas edições rápidas, ou reconciliação
   reprocessando do zero), o Mateus passa a ver dois lembretes para o mesmo
   pagamento — e aprende a desconfiar do calendário, pior do que não ter
   lembrete nenhum. Mitigado estruturalmente pelo critério 3 (id determinístico).
3. **Lembrete fantasma após quitação por caminho alternativo.** Se existir
   mais de um lugar no código que marca `situacao` como quitada/cancelada
   (quitação em lote, reversão de lançamento, exclusão de pré-vínculo) e só o
   caminho "principal" dispara a remoção do evento, um pagamento resolvido
   por caminho secundário mantém o evento vivo — o Mateus recebe lembrete de
   algo que já pagou. Mitigado pelo critério 11 (reconciliação sob demanda
   detecta e corrige a divergência, mesmo que o hook pontual falhe).

## Viabilidade (CTO)

**Discordância registrada com o desenho implícito no relato** (sincronização
por *transição*: "quando cria → cria; quando muda → atualiza; quando quita →
remove"): preferível por **estado derivado + id determinístico** — uma rota
só recebe `compromissoId`, lê o compromisso no banco (nunca confia no que o
cliente diz que aconteceu), calcula o estado desejado no Google e aplica.
Isso torna o critério 3 ("nunca um segundo evento") estrutural, não
disciplina de quem escreve o hook, e torna a reconciliação (critério 11)
trivial e segura. O risco do desenho por transição pura seria um hook
esquecido num caminho (quitação parcial, `desfazerOrigem`, tela nova) gerando
evento fantasma sem detecção — coberto pelo pre-mortem 3.

- **Fato de arquitetura que condiciona tudo**: o app não tem escrita pelo
  servidor hoje — toda gravação é `"use client"` → `lib/data.ts` → PostgREST
  com client do browser; o servidor Next só existe em `proxy.ts` e em
  `app/api/{extrair-documento,sugerir-retencao}`, que não tocam o banco. O
  refresh token não pode chegar ao browser, logo a chamada ao Google é
  obrigatoriamente uma Route Handler — nasce aqui a **primeira leitura do
  banco pelo servidor Next** (`createServerClient` com `cookies()` de
  `next/headers`, mesma receita que `proxy.ts` já usa).
- **Modelo de dados**: duas tabelas novas, migration
  `supabase/migrations/0029_agenda_google.sql` (formato das 0007/0013:
  cabeçalho com o porquê, RLS `user_id = auth.uid()`, revoke-antes-grant,
  resposta por extenso à pergunta obrigatória do CLAUDE.md) — colunas no
  critério 12. Nenhuma coluna em `compromisso` (critério 13): estado de
  integração não é fato fiscal.
- **Arquivos prováveis**: `supabase/migrations/0029_agenda_google.sql`;
  `lib/supabase-servidor.ts` (novo, client server-side autenticado pelo
  cookie `contai-auth`/`COOKIE_SESSAO`); `lib/agenda/evento.ts` (puro, Vitest:
  `Compromisso → EventoDesejado | null`); `lib/agenda/google.ts` (HTTP cru
  contra `oauth2.googleapis.com`/`calendar/v3`, sem SDK `googleapis` — ~10 MB
  e o app não tem dependência Google hoje; testado com `vi.stubGlobal("fetch")`,
  padrão de `lib/extracao/gemini.test.ts`); `lib/agenda/oauth.ts`
  (consentimento + `state`); `app/api/google/agenda/autorizar/route.ts`,
  `app/api/google/agenda/callback/route.ts`, `app/api/agenda/sincronizar/route.ts`;
  `lib/data.ts` (`sincronizarAgenda`, `carregarIntegracaoGoogle`,
  `carregarEstadoDaAgenda`); chamadas de `sincronizarAgenda` após a gravação
  existente em `app/(captura)/adicionar/pagamento/page.tsx`,
  `app/(gestao)/compromisso/[id]/{data,cancelar,confirmar}/page.tsx`,
  `app/_components/quitacao.tsx`; `app/(captura)/conta/page.tsx` (card
  Integrações); `app/(gestao)/compromisso/[id]/page.tsx` (linha de estado);
  `.env.example` + CI build env (3 variáveis, critério 15).
- **Complexidade: M.** Não é S: duas tabelas, três rotas, OAuth com `state`,
  uma primitiva nova (banco pelo servidor), seis pontos de chamada e a
  decisão de idempotência. Não é L: zero cron, zero fila, zero
  RPC/SECURITY DEFINER, zero SDK. O risco maior está fora do código
  (consentimento Google, publicação do app) e no fato de ser o primeiro
  módulo que lê sessão no servidor.
- **Dívidas criadas**:
  - **D-a (segurança)** — refresh token em claro sob RLS (critério 14); browser
    e servidor Next são o mesmo papel `authenticated`, a barreira "token só é
    lido no servidor" é de código, não de grant. Aceito para single-user;
    reavaliar se houver segundo usuário.
  - **D-b (garantia)** — sem reconciliação em segundo plano automática; lembrete
    perdido só se recupera quando o Mateus abre o app ou clica "sincronizar
    agora" (critério 11).
  - **D-c (arquitetura)** — `proxy.ts` protege rota por redirect 307 para
    `/entrar`, não por 401; as rotas novas validam `getUser()` e respondem 401
    elas mesmas. `lib/supabase-servidor.ts` vira o padrão para qualquer rota
    futura que leia o banco pelo servidor — **registrar no CLAUDE.md quando
    entrar em produção** (ação pendente, não bloqueia este ticket).
  - **D-e (ambiente)** — preview deployments da Vercel (URL por branch) não têm
    URI registrável; a integração só funciona em produção e no `dev:local`.
  - **D-f (código)** — a política de retry de `lib/extracao/retry.ts` está
    acoplada a `ExtracaoIndisponivelError`; o Gate 1 copia a política
    (429/5xx/rede, 2 tentativas) ou extrai um módulo neutro — extrair é
    opcional, não critério.

## Dependências
Bloqueado por: nenhum — `CONTAI-073` (correção de valor/data do compromisso,
usado como gancho de "mudança de data") já está **entregue**. Bloqueia:
nenhum ticket conhecido.

## Perguntas Abertas
- **Botão "Desconectar" pelo app** (`design/mocks/CONTAI-092.md`) — fica fora
  desta entrega (ver Out of Scope); se o Mateus quiser revogar pelo app em
  vez de pela própria conta Google, é ticket futuro — pergunta do `designer`
  para o `po`/Mateus, não bloqueia `/develop`.
- **Nome exato do parâmetro de query transitório** de cancelamento/negação do
  OAuth (ex. `?google=negado`) e **do campo/flag de falha de sincronização
  por compromisso** usado na guarda da linha em `/compromisso/[id]` — decisão
  do Gate 1 (`lead-engineer`)/Gate 2 (`cto-obra`), não bloqueia `/develop`.
- **D-c registrado em Viabilidade** (primeiro módulo a ler sessão no
  servidor) precisa de uma linha nova no `CLAUDE.md` quando `lib/supabase-servidor.ts`
  entrar em produção — ação de documentação pós-Gate 1/2, não um critério de
  código.
- Redação da frase de abertura da descrição do evento (critério 8) foi
  verificada contra o Gate Fiscal nesta síntese e está **aprovada como
  está** — não é mais uma pergunta aberta, só registrada aqui para o
  histórico de quem perguntar depois "isso foi checado?".

## Cenário e checagem final
**Gestão** — `/conta` é tela de configuração de conta, sentado, sem
equivalente de canteiro; nenhum dos 4 estados do card pede resposta rápida de
uma mão. O "Teste do Canteiro" não se aplica a nenhuma das telas tocadas
(`/conta`, detalhe do compromisso).

Varredura de condição fiscal órfã (`grep -rniE` do `/tickets-req`): as
condições fiscais deste ticket (critérios 7, 7a-c, 8, 9) nascem da análise
direta do Gate Fiscal deste próprio ticket, não de um parecer pré-existente
em `docs/pareceres/` — não há regra tributária sendo aplicada, só restrição
de linguagem para não implicar garantia/obrigação fiscal inexistente. Nenhum
parecer a citar, nenhuma condição órfã.

Veredito: **APROVADO** — pronto para `/develop`. Nenhuma pergunta aberta
bloqueia o Gate 1.
