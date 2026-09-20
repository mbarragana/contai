# CTA "Ver os documentos" do card agregado — CONTAI-033 — 2026-09-19

Pergunta aberta do ticket (alvo do `href` de `documentosSemArquivo`, mock s4):
não existe lista de documentos no app hoje. Duas rotas propostas: (a) lista
nova filtrada, criada neste ticket; (b) aponta para algo que já existe.

## Decisão do `po`: (b), sem lista nova

- **`quantidade === 1`**: `href` aponta para `/documento/[id]` do próprio
  documento — rota já existe, já mostra chip "Nota sem arquivo", a pendência
  (§A.7.2) e o botão "Anexar o arquivo agora". Zero construção nova.
- **`quantidade > 1`**: `href = null`. O card fica **sem CTA clicável** nesta
  rodada — é informativo (quantidade + total + veto ao relatório anual já
  sinalizam o suficiente). Tipo do campo muda de `string` para `string | null`
  no `ResumoObra` (o `TerrenoPagoSemComprovante` sempre tinha lista para
  apontar; este não tem).

## Por que, pelo filtro das 3 metas

Uma lista de documentos filtrada é **fricção de processo** (ajuda a resolver
mais rápido quando há várias pendências simultâneas), não **obrigação
fiscal**. A obrigação já está coberta por dois mecanismos que este ticket já
constrói: o card aparece na home (visibilidade) e o critério 11 veta a saída
anual enquanto existir documento fora do agregado (força a resolução mais
cedo ou mais tarde). Construir uma lista nova é escopo além do necessário
para fechar as três guardas — o ticket já é M.

Isso **não** enfraquece a Guarda 3/critério 11 (pre-mortem risco 3, D47): a
guarda protege a integridade da agregação e do veto, não a jornada de
clique. "Registra e esquece" era não ter superfície nenhuma; o card e o veto
já resolvem isso. O `href` é só o último passo de conveniência.

## Corte, não esquecimento

Se o volume de documentos sem arquivo simultâneos crescer a ponto do
"sem CTA" ficar inútil na prática, abre-se ticket P2 próprio de "lista de
documentos" — geral, não só para esta pendência. Não bloqueia o CONTAI-033.
