# contai

Sistema que automatiza a contabilidade fiscal da construção da residência do
Mateus (pessoa física) em Cachoeira do Bom Jesus/SC, com venda futura provável.
Situação: CNO registrado, notas no CPF dele, empreiteiro PJ + prestadores PF
avulsos, obra de ~20 meses cruzando anos-calendário.

## As três metas do produto (filtro de todo requisito)

1. **Nenhum pagamento sem documento hábil** — validação na entrada, quarentena
   de pendências com consequência fiscal explícita
2. **Relatórios anuais prontos para a declaração** — texto da discriminação
   (Bens e Direitos), lista CPF-por-CPF (Pagamentos Efetuados), posição da
   aferição INSS
3. **Acervo documental que sobrevive ao prazo de decadência** — digitalização
   obrigatória, legibilidade verificada.
   ⚠️ **"Venda + 5 anos" era atalho errado, corrigido em 2026-08-16.** O relógio
   é o do CTN art. 173, I: 5 anos do **1º dia do exercício seguinte** à **última
   DAA que declarou qualquer parcela** do ganho. Venda em 2028 → prazo até
   **31/12/2034** — quase 7 anos, não 5. Há um **segundo relógio,
   previdenciário**, para os documentos do CNO: guardar o maior dos dois. Obra
   não vendida = **prazo indefinido**. Parecer completo em
   `docs/pareceres/2026-08-16-gate-fiscal-contai-011.md`

## Invariante fiscal central

Todo documento/pagamento alimenta DUAS apurações com regras distintas:
- **Custo de aquisição (IRPF)**: regime de caixa — a chave é a DATA DO
  PAGAMENTO, não a da nota
- **Base de aferição INSS (SERO)**: só NF de serviço PJ com retenção de 11%
  abate; material é irrelevante aqui

Regras fiscais vêm do agente `contador` — nunca de memória, nunca inventadas.

## Premissas de processo

- **Mock-first**: nenhuma alteração visível ao usuário entra em desenvolvimento
  sem mock HTML em `design/mocks/` aprovado explicitamente pelo Mateus
- **Requisito nasce de relato**: dores vêm dos textos de vivência do Mateus,
  processados via `/relato` → `docs/backlog.md`
- **Gate fiscal**: ticket que toca regra fiscal é especificado e revisado pelo
  agente `contador`
- Cenário de uso primário: **celular, no canteiro, uma mão livre** (375px)

## Time de agentes (`.claude/agents/`)

| Agente | Modelo | Papel |
|---|---|---|
| `contador` | herda sessão | Autoridade fiscal (IRPF, CNO/SERO, documentação hábil) |
| `po` | herda sessão | Relatos → requisitos; dono do backlog |
| `lead-engineer` | **opus** | Implementa os tickets (Gate 1 do /develop) |
| `cto-obra` | **fable** | Arquitetura, modelo de dados e review técnico (Gate 2) |
| `designer` | herda sessão | Fluxos e mocks HTML, mobile-first |

Regra: quem implementa (lead-engineer) nunca revisa o próprio código; o
revisor (cto-obra) roda em modelo mais forte por design.

## Comandos (`.claude/commands/`)

`/relato` → `/tickets-req` → `/design` (se UI) → `/develop`

## Stack (decidida em 2026-08-07)

- **App**: Next.js 16 + React 19 + TypeScript + Tailwind 4, mobile-first (PWA)
- **Dados/acervo/auth**: Supabase (Postgres + Storage + Auth; login obrigatório
  desde o dia 1 — o app carrega CPF/CNO/dados fiscais)
- **Registro**: manual-first (decisão 2026-08-07, US-008) — formulário com
  anexo obrigatório e checks fiscais obrigatórios (nota no CPF? retenção 11%?).
  **Fase 2 (US-008)**: extração automática — XML NF-e via parse determinístico
  (fast-xml-parser); PDF via Claude API (`claude-opus-4-8`, document block +
  structured outputs Zod); boleto validado por dígito verificador
- **Lembretes**: Google Calendar API (agenda que o Mateus já usa)
- **Hospedagem**: Vercel
- **Testes**: Vitest (unit) + Playwright (E2E) — padrão dos outros projetos

**Regra dura de E2E (proposta pelo time de agentes em 2026-08-08, pendente de
ratificação do Mateus)**: teste E2E roda contra o
**banco local em Docker** (`npm run db:start`), nunca contra Supabase stubado.
Stub de backend em E2E é proibido: ele valida a suposição de quem escreveu o
teste, não o sistema. Foi assim que passou despercebido que `numeric(14,2)`
volta do PostgREST como número e não como string — o E2E estava verde em cima
de um formato inventado.

**`npm run test:e2e` EXIGE o stack local de pé** (implementado no Gate 3 do
CONTAI-001):

1. `npm run db:start` — sobe os containers (portas 5433x; o stack do
   bro-surf-report-2 usa 5432x, os dois convivem).
2. `npm run test:e2e` — o `globalSetup` (`e2e/global-setup.ts`) roda
   `supabase db reset` sozinho: migrations + `supabase/seed.sql`. Sem o stack
   de pé, ele falha com a instrução de subir, em vez de silenciar.

Como funciona (`e2e/`):
- `ambiente.ts` — URL e anon key do stack local. Essa key é pública e
  determinística (o CLI a deriva do JWT secret padrão de dev, idêntica em
  qualquer máquina), por isso é versionada. A key do projeto REMOTO fica só no
  `.env.local`, que é gitignored, e **nunca** entra em arquivo versionado.
- `banco.ts` — login real via `signInWithPassword` no GoTrue local e injeção da
  sessão em **COOKIE** (`contai-auth`, constante `COOKIE_SESSAO` de
  `lib/auth.ts`, reexportada como `STORAGE_KEY` por `lib/supabase.ts`). Mudou no
  CONTAI-002: era `localStorage`. O formato do cookie (chunking `.0`/`.1`,
  encoding base64url) **nunca é montado à mão** — quem o produz é o próprio
  `@supabase/ssr`, e o teste só repassa com `context().addCookies`. Sessão
  inventada não passa pela RLS. O mesmo client autenticado é usado para montar o
  cenário e para conferir o estado gravado — nada de service key: o que a policy
  barra para o app tem que barrar para o teste.
- **Exceção única e nomeada a essa regra** (2026-08-17): a limpeza entre testes
  (`limpar`) e o "conta sem obra nenhuma" rodam por `docker exec … psql` como
  administrador do banco, porque **APAGAM** — e a migration 0005 tirou o DELETE
  do papel `authenticated` (o app não apaga nada; "excluir pagamento" está fora
  de escopo pelo CONTAI-009, acervo append-only). Isso é montagem/desmontagem de
  ambiente, não comportamento: cenário e verificação continuam passando pelo
  client autenticado, sujeitos à mesma RLS do app. Manter o DELETE só para o
  teste seria devolver ao banco local uma permissão que a produção não tem.
- `fixtures.ts` — sessão + limpeza das linhas antes e depois de cada teste. A
  obra do seed permanece (é pré-requisito e não tem tela).
- `workers: 1`: um banco, um usuário — paralelismo faria um teste ver as linhas
  do outro.
- `reuseExistingServer: false`: um `npm run dev` já aberto aponta para o projeto
  REMOTO pelo `.env.local`, e o E2E passaria a gravar lá. Porta 3100 ocupada
  tem que falhar alto.
- Objetos do bucket `acervo` não são apagados entre testes: a migration 0002 não
  tem policy de delete (acervo é append-only). Quem zera é o `db reset` do
  `globalSetup`.
- Única falsificação de rede que resta: no teste de estado de erro, um 503 do
  PostgREST. Derrubar o Postgres no meio da suíte não provaria mais nada.

**Ponto cego estrutural do E2E local (incidente de 2026-08-17)**: rodar contra o
Postgres local prova o COMPORTAMENTO, não a CONFIGURAÇÃO. O stack do CLI e o
projeto remoto não são o mesmo banco: o local vem com `alter default privileges`
ligado no schema `public` (toda tabela nova já nasce acessível a `anon` e
`authenticated`), o remoto não. As migrations 0001-0004 não tinham um `GRANT`
sequer — 30 testes verdes no local, e o app publicado devolvendo `permission
denied for table obra` depois de um login bem-sucedido. É a **segunda** mordida
de "passa local, quebra remoto" (a primeira foi `numeric(14,2)` voltando do
PostgREST como number, não string). O padrão: divergência de CONFIGURAÇÃO entre
os dois ambientes é invisível para teste de comportamento.
Duas defesas, e só a segunda escala:
1. A migration 0005 **revoga antes de conceder**, então para essas cinco tabelas
   o banco local passou a ter exatamente os privilégios do remoto.
2. `e2e/privilegios.spec.ts` compara o mapa de privilégios de `public` com o que
   está declarado. **Tabela nova sem GRANT explícito deixa a suíte vermelha com
   o nome dela.** Toda migration que criar tabela concede o privilégio no mesmo
   diff e atualiza esse mapa — nunca por `all tables in schema public`, nunca por
   `alter default privileges` (o motivo está por extenso em `0005_grants.sql`).
Ao criar tabela, coluna com default do servidor, sequence, view ou função nova,
a pergunta obrigatória é: *isto depende de algum default do stack local que o
projeto remoto não tem?*

**Regra de concorrência entre agentes**: um agente por vez escrevendo na árvore
de trabalho. Dois agentes commitando no mesmo repo já causaram commit
sobrescrito e arquivos varridos para o commit errado. Trabalho paralelo exige
worktree separado por agente.

**Requisito permanente do acervo**: exportação periódica dos documentos para
storage do próprio Mateus (Google Drive, decidido em 2026-08-16) — a guarda pelo
prazo de decadência (ver meta 3) não pode depender de free tier de terceiro.
Especificado em `docs/tickets/CONTAI-011.md`; o auto-pause do free tier é
problema separado, no `CONTAI-012`.

Comandos: `npm run dev` | `npm run build` | `npm run typecheck` |
`npm run test` (Vitest unit) | `npm run test:e2e` (Playwright — **exige
`npm run db:start` antes**) | `npm run lint`.

`npm run quality` = lint + typecheck + unit + E2E, na mesma ideia do
surf-forecast. É o comando único antes de fechar um gate; exige o stack local
de pé.

**`npm run quality` NÃO roda com `npm run dev:local` aberto.** Portas separadas
(3200 manual, 3100 Playwright) não bastam: o Next 16 recusa um segundo
`next dev` no mesmo diretório — `Another next dev server is already running` —
e o `webServer` do Playwright morre com exit 1. Derrube o dev antes de rodar a
suíte.

`npm run dev:local` = `next dev` na porta **3200** com as env do Supabase local
inline (elas vencem o `.env.local`, que aponta para o projeto REMOTO). Portas
separadas de propósito: 3200 = uso manual, 3100 = servidor do Playwright, 3000
costuma estar ocupada por outro projeto.

**Como entrar no app local (mudou no CONTAI-002).** Existe tela de login em
`/entrar`. Duas formas:

- **Atalho de desenvolvimento** — o botão que aparece em `/entrar` quando as três
  condições do `atalhoDevDisponivel()` batem (flag `NEXT_PUBLIC_DEV_AUTOLOGIN=1`,
  build fora de produção, Supabase local). É o caminho normal no `dev:local`.
- **Fluxo real, por código de 6 dígitos** — digite `mateus@contai.local` e leia o
  código no **Mailpit: http://127.0.0.1:54334**. O stack local não manda e-mail
  de verdade. Use este quando quiser exercitar o fluxo que vai a produção.

⚠️ **O snippet de console que plantava a sessão no `localStorage` foi removido
daqui: não funciona mais.** A sessão virou cookie escrito pelo `@supabase/ssr`, e
`localStorage.setItem("contai-auth", ...)` hoje não faz nada.

**Por que existe `proxy.ts` na raiz** (Next 16 — é `proxy.ts`, não
`middleware.ts`): ele renova a sessão a cada navegação, **regravando o cookie
pelo servidor** via `Set-Cookie`. Isso não é detalhe de implementação, é o
mecanismo inteiro: o ITP do Safari capa em ~7 dias todo armazenamento gravável
por script — **cookie escrito por JavaScript inclusive**. Cookie sem renovação
pelo servidor é o mesmo bug do `localStorage` com outro nome, e o E2E **não
pegaria**, porque o Playwright não simula ITP. Quem trava a regressão é a
asserção de `expires > 14 dias` em `e2e/entrar.spec.ts`.

Se a tela mostrar `JWT issued at future`, o relógio do Docker desencontrou do
relógio do Mac (acontece depois que a máquina dorme): `npm run db:stop && npm
run db:start`.

## CI (`.github/workflows/ci.yml`)

Roda em push e PR na `main`, em dois jobs paralelos:

- **quality** — lint, typecheck, testes unitários (regras fiscais) e build. Sem
  Docker, ~1 min. O build recebe as env do Supabase local para o bundle nunca
  sair com a URL do projeto REMOTO.
- **e2e** — `npx supabase start` (mesma CLI da devDependency, para não existir
  "passa aqui e quebra lá") e a suíte inteira contra o Postgres local. Instala
  **webkit**, não chromium: o config usa `devices["iPhone SE"]`, cujo
  `defaultBrowserType` é webkit — o motor do alvo real. Um passo confere que a
  URL e a anon key versionadas em `e2e/ambiente.ts` ainda batem com o que a CLI
  gera, para uma CLI nova não virar 10 testes vermelhos sem explicação. Em
  falha, sobe `playwright-report/` como artefato (7 dias).

Nenhum segredo de produção entra no CI: o stack é local e efêmero, criado do
zero pelas migrations + `seed.sql`.

**Deploy NÃO está no workflow** — na Vercel ele vem da integração com o Git, e
não de action com token. Enquanto o projeto não estiver conectado na Vercel,
não há deploy nenhum.

## Antes do primeiro deploy — passos de dashboard, sem os quais o login não entra

Nenhum destes está em código, e todos falham **em silêncio** se forem esquecidos.

1. **Template de e-mail** — Authentication → Emails → Templates → **Magic Link**
   (é esse que o `signInWithOtp` dispara para usuário **já existente**; o
   "Confirm signup" só valeria com `shouldCreateUser: true`, que o CONTAI-002
   proíbe). O corpo tem que expor **`{{ .Token }}`** e **não pode** conter
   `{{ .ConfirmationURL }}`: link abre no navegador padrão e o PWA continua
   deslogado — foi a decisão de 2026-08-10.
2. **Criar a conta à mão** — Authentication → Users → Add user, com **Auto
   Confirm User** marcado. Signup está desligado e o app usa
   `shouldCreateUser: false`, então sem este passo o primeiro login devolve
   *"Não existe conta com esse e-mail"*.
3. **SMTP próprio** (Resend/Brevo servem) — o SMTP embutido do Supabase manda
   **2 e-mails por hora** e **só entrega para membros do time do projeto**. Não é
   teoria: o limite reprovou a suíte E2E na primeira rodada do Gate 3 do
   CONTAI-002. Em produção, errar o código duas vezes no canteiro custa uma hora
   fora do app.
4. **Site URL** — Authentication → URL Configuration, com a URL da Vercel, depois
   que ela existir.

⚠️ No plano Hobby da Vercel o domínio de produção **não é protegível**. Qualquer
um com a URL pede código para um e-mail qualquer e queima o limite de envio,
travando o login do Mateus. Mitigação barata: Authentication → **Attack
Protection** → captcha, somado ao item 3.

Supabase local (Docker): `npm run db:start | db:stop | db:status`;
`npm run db:reset` recria o banco local e roda `supabase/seed.sql` (usuário e
obra de desenvolvimento). Banco remoto: `npx supabase db push` aplica as
migrations.

## Estrutura

- `docs/backlog.md` — backlog vivo (dores, stories, perguntas)
- `docs/tickets/` — tickets gerados pelo `/tickets-req`
- `docs/pareceres/` — pareceres do agente `contador`, transcritos em arquivo.
  Regra fiscal vem daqui, **nunca de memória de sessão**: parecer que só existe
  no transcript é a mesma falha que a regra proíbe, com outro nome. Texto de
  tela com consequência fiscal se copia do parecer, não se reescreve.
- `design/mocks/` — mocks HTML navegáveis + `index.html` (hub)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
