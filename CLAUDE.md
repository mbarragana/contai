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

**Requisito permanente do acervo**: exportação periódica dos documentos para
storage do próprio Mateus (ex: zip mensal no Google Drive) — a guarda até
venda+5 anos não pode depender de free tier de terceiro.

Comandos: `npm run dev` | `npm run build` | `npm run typecheck` |
`npm run test` (Vitest unit) | `npm run test:e2e` (Playwright) | `npm run lint`.

## Estrutura

- `docs/backlog.md` — backlog vivo (dores, stories, perguntas)
- `docs/tickets/` — tickets gerados pelo `/tickets-req`
- `design/mocks/` — mocks HTML navegáveis + `index.html` (hub)
