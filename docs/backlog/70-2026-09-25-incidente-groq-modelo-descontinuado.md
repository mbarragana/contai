# Incidente: caminho Groq caía 404 em produção — D71 materializada — 2026-09-25

O Mateus configurou `GROQ_API_KEY` na Vercel, fez redeploy, e a extração
continuou falhando com o mesmo 503 do Gemini. O log de produção que ele colou
mostrou a causa real, e ela não era o que eu tinha cogitado antes de ver o log
(env var sem efeito retroativo):

```
[extracao] Groq não resolveu (Groq devolveu 404: {…}) — seguindo para a visão.
[gemini] tentativa 1/3 falhou (503); repetindo em 1000ms.
[gemini] tentativa 2/3 falhou (503); repetindo em 3000ms.
[extrair-documento] extração indisponível (tentativas: 3): Gemini indisponível
após 3 tentativas: Gemini devolveu 503
```

O caminho Groq **foi** exercitado (contradiz a suposição de que a chave não
estava chegando) — e devolveu 404, não erro de auth. Groq trata modelo
inexistente como 404, então o suspeito óbvio era o nome do modelo.

## Causa raiz confirmada por chamada real (não suposição)

`curl` direto contra `https://api.groq.com/openai/v1/chat/completions` com o
model `llama-3.3-70b-versatile` (o default hardcoded em `lib/extracao/groq.ts`
desde o `CONTAI-052`, nunca sobrescrito por `GROQ_MODEL` nem local nem na
Vercel) devolveu:

```json
{"error":{"message":"The model `llama-3.3-70b-versatile` does not exist or
you do not have access to it.","type":"invalid_request_error","code":"model_not_found"}}
```

`GET /openai/v1/models` com a mesma chave confirma: **nenhum modelo Llama de
texto puro sobrou** nessa conta — a Groq descontinuou a linha inteira desde
que o modelo foi escolhido no Gate 1 do `CONTAI-052` (24/09). Os únicos
modelos de texto restantes são a família `gpt-oss` (raciocínio) e `allam-2-7b`.

## Por que isso não foi pego antes de produção

É exatamente a **D71**: "caminho Groq nunca foi exercitado contra a API real
— só mockado nos 90 testes unitários". O mock não podia pegar isso porque o
mock não sabe que a Groq descontinuou um modelo depois que o código foi
escrito — só uma chamada real pega. **D71 está formalmente RESOLVIDA agora**,
não porque o risco foi eliminado de vez (Groq pode descontinuar de novo), mas
porque a primeira exercitação real contra produção aconteceu e o bug que ela
existia para pegar foi achado e corrigido.

## Fix

`lib/extracao/groq.ts`:
- Default do model trocado de `llama-3.3-70b-versatile` para
  `openai/gpt-oss-120b` (confirmado ativo via `/models`, 131072 de contexto).
- Adicionado `reasoning_effort: "low"` no corpo da chamada. `gpt-oss` é
  modelo de **raciocínio** — sem isso ele gasta uma fatia do teto de
  `max_completion_tokens` "pensando" antes de escrever o JSON, a mesma classe
  de risco do `MAX_TOKENS` do Gemini (rodada 1 do incidente de 24/09,
  `67-2026-09-24-incidente-extracao-gemini.md`). Medido com o texto de uma
  nota real (~1000 tokens de prompt): sem o parâmetro, 437 tokens de
  `reasoning` no `gpt-oss-20b`; com `"low"`, 111 no `gpt-oss-20b` e 95 no
  `gpt-oss-120b` — nos dois casos `finish_reason: "stop"`, sem truncar.
- `.env.example`: comentário do `GROQ_MODEL` atualizado para o novo default.

Verificação: chamada real (não mockada) contra a Groq com um texto sintético
do tamanho de uma nota de serviço real, `finish_reason: "stop"`, JSON válido
nas chaves esperadas. Testes unitários mockados de `groq.test.ts` não citavam
o nome do modelo (só o endpoint/formato), não precisaram mudar.

## Dívida nova, não bloqueante

**D73 — nome de modelo de provedor externo não tem verificação automática de
que ainda existe.** Já são dois incidentes de nome de modelo quebrando em
produção sem aviso em código nenhum (Gemini `thinkingLevel` por modelo,
rodada 2 do incidente de 24/09; Groq `llama-3.3-70b-versatile` descontinuado,
este). Não há teste de CI que chame `GET /models` dos provedores — exigiria
segredo de produção no CI, que o projeto proíbe por decisão própria. Mitigação
real seria um alerta operacional (não um teste), fora de escopo agora.
