# CONTAI-052 criado — extração de texto local do PDF + Groq como provedor de texto — 2026-09-24

Depois do incidente do dia (`67-2026-09-24-incidente-extracao-gemini.md`, três
rodadas de correção no Gemini, achado lateral: conta no tier gratuito, 5
requisições/minuto), o Mateus decidiu em conversa direta com o coordenador a
ideia que já estava registrada como "avaliada, não escopada" no fim daquele
incidente: extrair o texto embutido do PDF localmente (de graça, sem API) e,
quando der certo, mandar esse texto para a **Groq** (cota separada da do
Gemini) em vez de mandar o arquivo para o Gemini. Quando a extração de texto
falhar (scan/foto sem camada de texto), cai no caminho de hoje (Gemini +
retry, commit `4f8a1c6`).

## Consulta ao `cto-obra` — decisões técnicas fechadas antes do Gate 1

1. **Biblioteca**: `unpdf` (não `pdf-parse` nem `pdfjs-dist` puro) — única
   feita para serverless, sem binário nativo, sem worker externo. Teto de
   30.000 caracteres / 5 páginas antes de mandar à Groq.
2. **Prompt**: regras fiscais centralizadas em `lib/extracao/prompt.ts`
   (`REGRAS_EXTRACAO`), fonte única para os dois provedores — não podem
   divergir. Groq usa formato OpenAI, `json_object` (não `json_schema`
   estrito — só existe em modelos de raciocínio, que reproduziriam o bug de
   `MAX_TOKENS` da rodada 1 do incidente).
3. **Abstração**: estágio **ortogonal** em `provider.ts` (texto local →
   Groq texto → Gemini visão), não um `case` novo em `EXTRACAO_PROVIDER`.
   Nova env `EXTRACAO_TEXTO=groq|off`.
4. **Heurística "texto suficiente"**: 3 testes cumulativos (volume, % de
   caracteres-lixo, presença de CNPJ/CPF + valor monetário) mais uma segunda
   defesa depois do `safeParse` — `favorecidoDocumento`/`valorReais` têm que
   aparecer literalmente no texto bruto, senão o campo vira `null` e
   `confianca` cai para `"baixa"` (só rebaixa, nunca sobe).
5. **`confianca`**: mesmo enum, critério muda por modalidade (legibilidade de
   imagem vs. ambiguidade de texto).
6. **Retry/timeout**: laço do Gemini extraído para `lib/extracao/retry.ts`,
   reaproveitado nos dois provedores. Novo: `AbortSignal.timeout()` por
   tentativa (Groq 10s, Gemini 20s) + `maxDuration=60` na rota — fecha a
   **dívida D70** nomeada no Gate 2 do retry (fetch sem timeout explícito).
7. **Env/migration**: sem migration (extração é stateless). `GROQ_API_KEY`
   própria do contai (não reaproveita a do `../garmin-import`), `GROQ_MODEL`
   (default `llama-3.3-70b-versatile`), `EXTRACAO_TEXTO`. Chave ausente
   degrada para o comportamento de hoje, não bloqueia deploy.

Fato que redefine escopo: `app/api/extrair-documento/route.ts` só aceita
`application/pdf` hoje — "foto do canteiro" só entra nesta rota se já
convertida em PDF; aceitar imagem direto é fora deste ticket.

## Sanity check do `contador`

**APROVADO, sem parecer formal.** Confirmado contra o código
(`lib/extracao/schema.ts`, `provider.ts`): o contrato `ExtracaoDocumento` não
muda, nenhum campo fiscal é tocado por nenhum dos dois provedores, trocar de
provedor de IA não move nem cria fato fiscal novo (documentação hábil é sobre
o documento, não sobre quem o leu), extração continua só sugerindo. Único
ponto levantado — texto puro pode ser mais fácil de reter/logar do lado do
provedor americano do que uma imagem — é explicitamente separado como questão
de privacidade/LGPD, fora do escopo do `contador`, registrada como ressalva
de produto no ticket.

## Fora de Escopo (explícito, não pendência)
- Groq como fallback de **visão** (só um modelo, `qwen/qwen3.8-27b`, não
  aceita PDF direto — exigiria conversão PDF→imagem em serverless).
- Aceitar JPEG/HEIC direto na rota.
- Agendador de deadline total entre as duas cadeias de retry (~98s pior caso,
  aceito).
- Claude API como provedor de visão (continua fora, sem redesenho se um dia
  entrar).

## Resultado
**`CONTAI-052`** criado (P1, fricção de processo, sem Gate Fiscal
bloqueante, sem `/design` — zero mudança de UX). **Pronto para `/develop`**,
sem dependência bloqueante. Detalhe completo: `docs/tickets/CONTAI-052.md`.
