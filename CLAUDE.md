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
3. **Acervo documental que sobrevive até venda + 5 anos** — digitalização
   obrigatória, legibilidade verificada

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
  sessão no `localStorage` (chave `contai-auth`, exportada de `lib/supabase.ts`).
  Sessão inventada não passa pela RLS. O mesmo client autenticado é usado para
  montar o cenário e para conferir o estado gravado — nada de service key: o
  que a policy barra para o app tem que barrar para o teste.
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

**Regra de concorrência entre agentes**: um agente por vez escrevendo na árvore
de trabalho. Dois agentes commitando no mesmo repo já causaram commit
sobrescrito e arquivos varridos para o commit errado. Trabalho paralelo exige
worktree separado por agente.

**Requisito permanente do acervo**: exportação periódica dos documentos para
storage do próprio Mateus (ex: zip mensal no Google Drive) — a guarda até
venda+5 anos não pode depender de free tier de terceiro.

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
costuma estar ocupada por outro projeto. Como não existe tela de login, para
usar o app manualmente cole no console do navegador:

```js
const r = await fetch(
  "http://127.0.0.1:54331/auth/v1/token?grant_type=password",
  {
    method: "POST",
    headers: {
      apikey: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "mateus@contai.local",
      password: "contai-local-123",
    }),
  },
);
localStorage.setItem("contai-auth", JSON.stringify(await r.json()));
location.reload();
```

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

Supabase local (Docker): `npm run db:start | db:stop | db:status`;
`npm run db:reset` recria o banco local e roda `supabase/seed.sql` (usuário e
obra de desenvolvimento — enquanto não existem tela de login e cadastro de
obra). Banco remoto: `npx supabase db push` aplica as migrations.

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
