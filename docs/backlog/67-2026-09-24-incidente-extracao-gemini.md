# Incidente: extração via Gemini falhando com frequência — 2026-09-24

O Mateus reportou "erro frequente no parse da nota" e colou uma sugestão do
Google (migrar para o SDK `@google/genai` com `thinkingLevel: "low"`, texto
da API nova "Interactions API"). Investigação e correção em três rodadas no
mesmo dia.

## Rodada 1 — causa raiz real (não a do texto colado)

`cto-obra` investigou: o texto do Google era da **Interactions API**
(`thinking_level`, snake_case), diferente do endpoint legado
`generateContent` que o contai usa (`thinkingConfig.thinkingLevel`,
camelCase, aninhado). Usar o campo como colado teria sido ignorado ou dado
400. Causa real: `maxOutputTokens: 2048` era o teto TOTAL (raciocínio +
JSON), e o `gemini-3.5-flash` "pensa" antes de responder — um PDF de nota
consumia o teto só no raciocínio, saindo sem texto (`finishReason:
MAX_TOKENS`). Fix: `thinkingConfig.thinkingLevel: "minimal"`,
`maxOutputTokens: 8192`, checagem de `finishReason` antes do parse, log na
rota. Commit `6bc0e66`, CI verde.

## Rodada 2 — o fix da rodada 1 quebrou em produção

`thinkingLevel: "minimal"` devolveu 400 ("Thinking level MINIMAL is not
supported for this model") assim que foi ao ar. Verificação direta contra a
API real (não só doc, que já tinha se mostrado incompleta uma vez):
`gemini-3.5-flash` aceita os 4 níveis, mas `gemini-flash-latest` — o
fallback do código quando `GEMINI_MODEL` não está setado — **rejeita
"minimal"**. A mensagem de um 429 de teste revelou que esse alias resolve
para `gemini-3.8-flash`. `"low"` testado contra a API real nos dois modelos
**e** contra um PDF real (nota de sondagem fornecida pelo Mateus) — funciona
nos dois, confirmado também end-to-end no navegador (upload → extração →
campos corretos). Commit `4be9107`, CI verde.

## Descoberta lateral: conta no tier gratuito, 5 req/min

Ao testar contra `gemini-flash-latest`, um 429 nomeou o limite real:
`generate_content_free_tier_requests`, 5 requisições/minuto para o modelo.
Isso por si só já explica parte da "frequência" do erro — não é só o bug do
thinkingLevel.

## Rodada 3 — retry automático (não resolve tudo)

Mateus relatou um 503 ("model is currently experiencing high demand") que
persistiu **20 minutos depois** de tentar de novo manualmente — ou seja, não
era um blip de segundos. Decisão: implementar retry mesmo assim (cobre o
caso comum, mais frequente que uma indisponibilidade de 20+ minutos), mas
sem prometer resolver esse caso específico — nenhum retry síncrono razoável
pode fazer o usuário esperar minutos numa tela de captura.

Implementado em `lib/extracao/gemini.ts`: até 3 tentativas, backoff 1s/3s
(~4s de espera extra no pior caso), `Retry-After` respeitado se ≤5s. Escopo
fechado no Gate 2 (`cto-obra`, 2 rodadas): repete em **429 ou qualquer 5xx**,
e também em falha de rede (fetch rejeitando — timeout, DNS, socket), não só
os dois status HTTP originalmente cogitados. 4xx (exceto 429) nunca repete —
é erro de configuração/request, repetir devolve o mesmo erro. Mensagem final
cita quantas tentativas foram feitas, preservando a informação de
`finishReason`/status da rodada 1. 20 testes com fake timers (suíte não fica
lenta). Commit pendente (Gate 2 fechado, aguardando push).

## Dívida nomeada nova

**D70 — `fetch()` da extração Gemini não tem timeout explícito**
(`AbortSignal.timeout` ausente) nem a rota `app/api/extrair-documento`
declara `maxDuration`: uma resposta que fica pendurada (nem sucesso, nem
erro, nem timeout do próprio Node) não aciona retry nenhum — o retry só
existe para quem *responde* com erro. Achada pelo `cto-obra` no Gate 2 do
retry, registrada como dívida separada por decisão dele (não bloqueia o
fechamento do retry). Sem ticket ainda.

## Fallback avaliado, não implementado

Mateus perguntou por alternativa sem depender de terceiro (Llama próprio) —
avaliado e desaconselhado: exigiria servidor com GPU sempre ligado (custo
recorrente maior que qualquer cota/plano de API para este volume) e modelos
abertos do tamanho viável de self-host tendem a ler pior foto real de nota
que Gemini/Claude. Alternativas de fallback levantadas, nenhuma implementada
ainda:
- **Claude API**: sem tier gratuito contínuo (só ~$5 de crédito único por
  conta nova), mas custo por chamada é irrisório para este volume (Haiku
  4.5, ~920 tokens de entrada + ~150 de saída medidos com o PDF real ≈
  $0,0015–0,002/nota — sob US$ 0,50 para a obra inteira).
- **Groq**: tier gratuito real (sem cartão), mas hoje só tem UM modelo com
  visão (`qwen/qwen3.8-27b`) e ele **não aceita PDF direto, só imagem** —
  precisaria de conversão PDF→imagem antes de chamar, que é complexidade
  nova (renderização de PDF em ambiente serverless). Chave de API da Groq já
  existe no `.env`/`.env.local` do `../garmin-import` (`GROQ_API_KEY`), não
  usada aqui ainda.
- **Ideia melhor, não escopada ainda**: muitos PDFs de nota fiscal/NFS-e já
  nascem com camada de texto embutida (gerados por sistema, não
  fotografados) — extrair esse texto localmente e de graça (sem IA nenhuma)
  reduziria a dependência de qualquer provedor para uma fatia real dos
  documentos, deixando IA (Gemini, e um fallback futuro) só para foto/scan
  sem texto. Não há dependência de PDF no projeto hoje; seria nova.

Nenhuma decisão de fallback tomada — fica para quando o Mateus priorizar.
