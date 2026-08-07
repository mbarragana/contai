# Ticket & Requirements — Do Backlog ao Ticket Pronto para Desenvolvimento

Gera um ticket estruturado e acionável, com validação fiscal e de design
embutidas nos gates.

## Instruções

1. Leia e incorpore as personas em sequência:
   - `.claude/agents/po.md` (framing do problema, story, critérios, escopo)
   - `.claude/agents/contador.md` (gate fiscal — obrigatório se o ticket tocar regra fiscal)
   - `.claude/agents/cto-obra.md` (viabilidade, modelo de dados, complexidade)
   - `.claude/agents/designer.md` (se houver UI: exigência de mock)
2. Leia `CLAUDE.md` para contexto e premissas do projeto
3. Leia `docs/backlog.md` — todo ticket nasce de uma dor registrada lá; se a
   dor não está no backlog, rode `/relato` primeiro ou justifique a exceção

## Input

Pergunte ao Mateus (ou extraia do backlog):
- **O que construir**: feature, bug, chore ou spike — e qual dor do backlog atende
- **Prioridade**: P0 (fiscal) / P1 (fricção) / P2 (conveniência)
- **Dependências**: bloqueia ou é bloqueado por algo?

## Processo

### Passo 1: PO — Framing e Story
1. "Que dor real da obra isso resolve?" — cite o relato de origem
2. Pre-mortem: "3 meses depois, isso falhou. Por quê?" (3 riscos)
3. User story + critérios de aceite testáveis (Given/When/Then, verificáveis
   na interface, não no código)
4. Out of scope explícito — aplique o filtro das três metas do produto

### Passo 2: Contador — Gate Fiscal
1. O ticket toca regra fiscal (classificação, datas/regime de caixa, retenção,
   documentação hábil, relatórios)? Se não, declare "sem impacto fiscal" e siga
2. Se sim: especifique a regra exata que a implementação deve obedecer, com a
   condição no formato "se X e Y → Z"
3. Marque o que é apuração automática vs. o que trava para revisão humana
4. Número/alíquota sem certeza do valor vigente → registre como "confirmar na
   legislação", nunca como fato

### Passo 3: CTO — Viabilidade
1. Impacto no modelo de dados (Pagamento/Documento/Favorecido/Obra)
2. Arquivos prováveis, complexidade (S/M/L), dívidas criadas
3. Discorde do ticket se a solução proposta for ruim — com alternativa

### Passo 4: Designer — Gate de Mock (se houver UI)
1. Ticket com qualquer mudança visível ao usuário exige **mock HTML aprovado
   pelo Mateus antes do desenvolvimento** — vire critério de aceite nº 1
2. Referencie o mock existente em `design/mocks/` ou marque "PENDENTE: rodar
   /design antes de /develop"

### Passo 5: Checagem final — Teste do Canteiro
- Isso serve a uma das três metas (nenhum pagamento sem documento hábil /
  relatórios anuais prontos / acervo que sobrevive até venda+5 anos)?
- O Mateus usaria isso com uma mão, no canteiro, com pressa?
- Veredito: APROVADO / PRECISA MUDAR / REJEITADO

## Formato de Saída

```markdown
# [TICKET-ID] [Título]

## Tipo e Prioridade
[feature/bug/chore/spike] — [P0/P1/P2] — [justificativa]

## Dor de Origem
[Citação do relato/backlog]

## User Story
Como [dono da obra...], quero [capacidade] para [benefício].

## Critérios de Aceite
1. [ ] [Se houver UI: "Mock em design/mocks/X.html aprovado pelo Mateus"]
2. [ ] [Critério testável]
...

## Out of Scope
- [O que NÃO inclui]

## Gate Fiscal (Contador)
[Sem impacto fiscal | Regras exatas no formato condição → consequência,
com automático vs. revisão humana]

## Pre-mortem
1. [Risco] 2. [Risco] 3. [Risco]

## Viabilidade (CTO)
- Modelo de dados: [impacto]
- Arquivos: [lista]
- Complexidade: [S/M/L]

## Dependências
- Bloqueado por / Bloqueia: [IDs ou "nenhum"]

## Perguntas Abertas
- [O que precisa de resposta antes de implementar]

## Teste do Canteiro
[Veredito e justificativa]
```

Salve o ticket em `docs/tickets/[TICKET-ID].md`.
