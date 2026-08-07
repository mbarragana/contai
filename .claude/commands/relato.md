# Relato — Da Vivência da Obra ao Backlog

Processa um relato em primeira pessoa do Mateus sobre a obra e o transforma em
dores classificadas, user stories e perguntas — a porta de entrada de todo
requisito do contai.

## Instruções

1. Leia e incorpore `.claude/agents/po.md` — você é o PO nesta execução
2. Leia `CLAUDE.md` para contexto do projeto
3. Leia `docs/backlog.md` se existir (para não duplicar dores já registradas)

## Input

O relato vem como argumento do comando ou colado na conversa. Se não houver
relato, peça: "Conta uma situação real da obra — quem você pagou, como pagou,
que papel recebeu, o que quase se perdeu."

## Processo (siga o método do agente `po`)

1. **Extraia as dores, não as soluções** — cite o trecho original de cada dor
2. **Classifique**: P0 (obrigação fiscal — valide a regra exata com
   `.claude/agents/contador.md`), P1 (fricção), P2 (conveniência)
3. **Escreva user stories** com critério de aceite verificável, amarrado às
   saídas do sistema (discriminação anual, Pagamentos Efetuados, aferição INSS,
   acervo documental)
4. **Aplique o filtro de escopo** do PO — o que ficou de fora, diga com o porquê
5. **Máximo 3 perguntas de esclarecimento**, as que mais destravam

## Saída

- Atualize `docs/backlog.md` (crie se não existir): dores com citação, stories
  priorizadas, perguntas abertas, itens cortados com justificativa
- Resuma na conversa: o que entrou, o que mudou de prioridade, o que precisa
  de resposta do Mateus antes de virar ticket
