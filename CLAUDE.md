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

**Regra dura de E2E (decisão do Mateus, 2026-08-08)**: teste E2E roda contra o
**banco local em Docker** (`npm run db:start`), nunca contra Supabase stubado.
Stub de backend em E2E é proibido: ele valida a suposição de quem escreveu o
teste, não o sistema. Foi assim que passou despercebido que `numeric(14,2)`
volta do PostgREST como número e não como string — o E2E estava verde em cima
de um formato inventado.

**Regra de concorrência entre agentes**: um agente por vez escrevendo na árvore
de trabalho. Dois agentes commitando no mesmo repo já causaram commit
sobrescrito e arquivos varridos para o commit errado. Trabalho paralelo exige
worktree separado por agente.

**Requisito permanente do acervo**: exportação periódica dos documentos para
storage do próprio Mateus (ex: zip mensal no Google Drive) — a guarda até
venda+5 anos não pode depender de free tier de terceiro.

Comandos: `npm run dev` | `npm run build` | `npm run typecheck` |
`npm run test` (Vitest unit) | `npm run test:e2e` (Playwright) | `npm run lint`.

Supabase local (Docker): `npm run db:start | db:stop | db:status`;
`npm run db:reset` recria o banco local e roda `supabase/seed.sql` (usuário e
obra de desenvolvimento — enquanto não existem tela de login e cadastro de
obra). Banco remoto: `npx supabase db push` aplica as migrations.

## Estrutura

- `docs/backlog.md` — backlog vivo (dores, stories, perguntas)
- `docs/tickets/` — tickets gerados pelo `/tickets-req`
- `design/mocks/` — mocks HTML navegáveis + `index.html` (hub)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
