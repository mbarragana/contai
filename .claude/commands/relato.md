# Relato — Da Vivência da Obra ao Backlog

Processa um relato em primeira pessoa do Mateus sobre a obra e o transforma em
dores classificadas, user stories e perguntas — a porta de entrada de todo
requisito do contai.

## Instruções

1. Rode como subagent `po` (`subagent_type: po`) — a definição dele já é o
   system prompt; **não leia `.claude/agents/po.md`**
2. O `CLAUDE.md` já está carregado — **não o releia**
3. **Nunca leia `docs/backlog/` inteiro** — a soma é ~150 KB (~38k tokens):
   - leia `docs/backlog.md` — é o ÍNDICE (≈5 KB), não o conteúdo
   - `grep -rn -i '<termo da dor>' docs/backlog/` — acha a entrada
   - abra **só** o arquivo daquela entrada. Nunca a pasta inteira (150 KB)

## Input

O relato vem como argumento do comando ou colado na conversa. Se não houver
relato, peça: "Conta uma situação real da obra — quem você pagou, como pagou,
que papel recebeu, o que quase se perdeu."

## Antes de perguntar qualquer coisa ao Mateus

Fato da obra **se consulta, não se pergunta** (regra do `CLAUDE.md`). Procure
nesta ordem antes de gastar uma pergunta: o índice `docs/backlog.md` (tabela
"Fato da obra — consulte aqui ANTES de perguntar") → `grep -rn` em
`docs/backlog/` → `docs/pareceres/` → `docs/tickets/`. Repergunta de
fato já registrado já invalidou análise pronta três vezes.

## Processo (siga o método do agente `po`)

1. **Extraia as dores, não as soluções** — cite o trecho original de cada dor
2. **Classifique**: P0 (obrigação fiscal), P1 (fricção), P2 (conveniência).
   Regra fiscal em dúvida → rode um subagent `contador` com a pergunta
   específica; **não** leia a persona nem decida de memória
3. **Escreva user stories** com critério de aceite verificável, amarrado às
   saídas do sistema (discriminação anual, Pagamentos Efetuados, aferição INSS,
   acervo documental)
4. **Aplique o filtro de escopo** do PO — o que ficou de fora, diga com o porquê
5. **Máximo 3 perguntas de esclarecimento**, as que mais destravam

## Saída

- Grave a entrada nova em `docs/backlog/NN-AAAA-MM-DD-assunto.md` e acrescente
  **uma linha** ao índice `docs/backlog.md`. Dores com citação, stories priorizadas,
  perguntas abertas, itens cortados com justificativa
- Resuma na conversa: o que entrou, o que mudou de prioridade, o que precisa
  de resposta do Mateus antes de virar ticket
