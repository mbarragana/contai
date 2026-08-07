# Develop — Fila de Tickets pelo Pipeline Completo

Executa tickets um a um pelos gates: mock → implementação → review (técnico +
fiscal) → teste → validação.

## CRÍTICO — Regras Inegociáveis

- **Persona obrigatória por gate**: antes de CADA passo, leia com o Read tool o
  arquivo do agente daquele passo e mostre o caminho lido como prova. Sem Read,
  não prossiga
- **Um ticket por vez**: todos os gates de um ticket antes do próximo. Sem batch
- **Nunca pule gate**: "é mudança pequena" não é motivo. Sem exceções
- **Nunca se auto-aprove**: review aplica os critérios reais da persona, não um
  "PASS" de carimbo
- **Testes são executados, não só escritos**
- **Desvio só com permissão**: se acredita que tickets podem ser agrupados ou
  gates simplificados, apresente o raciocínio, o pipeline alternativo, o que se
  perde, e ESPERE aprovação explícita do Mateus. Silêncio não é sim
- **Máximo 2 loops por gate**: no 3º retorno ao mesmo gate, pare e escale
- Se se pegar atalhando: pare, admita, refaça o passo direito

## Instruções

1. Leia `CLAUDE.md` — contexto, premissas e comandos de build/teste do projeto
2. Leia o(s) ticket(s) em `docs/tickets/` (ou o caminho que o Mateus indicar)
3. Respeite ordem de dependências

## Pipeline (por ticket)

### Gate 0: Mock Aprovado (só para tickets com UI)
- O ticket tem mudança visível ao usuário? Então precisa de
  "Mock aprovado em [data]" registrado no ticket, apontando para
  `design/mocks/`
- **Sem mock aprovado → PARE.** Rode `/design` e obtenha a aprovação do Mateus
  antes de escrever qualquer código. Esta é a premissa nº 1 do projeto

### Gate 1: Implementar
- 🎭 Leia `.claude/agents/cto-obra.md`
- Leia o código existente da área afetada antes de mudar
- Implemente pelos critérios de aceite; siga o mock aprovado quando houver
- Trate os 4 estados (loading/erro/vazio/sucesso) em tudo que é UI
- Escreva testes junto; rode typecheck + testes (comandos no `CLAUDE.md`)

### Gate 2: Review Técnico + Fiscal
- 🎭 Leia `.claude/agents/cto-obra.md` (arquitetura, legibilidade, modelo de
  dados, rastreabilidade pagamento↔documento)
- 🎭 **Se o ticket tem Gate Fiscal no corpo**: leia `.claude/agents/contador.md`
  e revise a implementação contra as regras exatas do ticket — classificação,
  regime de caixa (data de pagamento!), retenção, documentação hábil. Erro
  fiscal silencioso é bug P0 mesmo com todos os testes verdes
- Veredito: APPROVE ou REQUEST CHANGES → volta ao Gate 1 com notas

### Gate 3: Testes de Fluxo
- Teste os fluxos do usuário de ponta a ponta (ferramenta conforme stack no
  `CLAUDE.md`; enquanto não houver E2E configurado, exercite o fluxo real
  manualmente e registre o que foi verificado)
- Viewport 375px primeiro. Cubra: caminho feliz, erro, vazio, edge cases
- Bug encontrado → volta ao Gate 1 com report

### Gate 4: Validação do PO
- 🎭 Leia `.claude/agents/po.md`
- Passe critério por critério do ticket: PASS/FAIL explícito
- Compare o implementado com o mock aprovado — divergência é FAIL, a menos que
  o Mateus tenha aprovado a mudança
- FAIL → Gate 1 com feedback específico | PASS → ticket DONE

## Prova de Conformidade (antes de cada gate)

```
📋 Gate [N] — [Nome]
🎭 Persona lida: [caminho do arquivo]
🎟️ Ticket: [ID e título]
```

## Status (após cada gate)

| # | Ticket | Status | Gate atual | Notas |
|---|--------|--------|-----------|-------|

## Ao Terminar a Fila

Resumo final: tickets entregues (complexidade, loops de feedback), arquivos
modificados, testes adicionados, dívidas criadas e follow-ups sugeridos.
