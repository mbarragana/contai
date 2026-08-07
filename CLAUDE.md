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

| Agente | Papel |
|---|---|
| `contador` | Autoridade fiscal (IRPF, CNO/SERO, documentação hábil) |
| `po` | Relatos → requisitos; dono do backlog |
| `cto-obra` | Arquitetura, modelo de dados, implementação |
| `designer` | Fluxos e mocks HTML, mobile-first |

## Comandos (`.claude/commands/`)

`/relato` → `/tickets-req` → `/design` (se UI) → `/develop`

## Stack

Ainda não definida. Quando definir, registre aqui: comandos de build, typecheck,
teste unitário e E2E — o `/develop` depende disto.

## Estrutura

- `docs/backlog.md` — backlog vivo (dores, stories, perguntas)
- `docs/tickets/` — tickets gerados pelo `/tickets-req`
- `design/mocks/` — mocks HTML navegáveis + `index.html` (hub)
