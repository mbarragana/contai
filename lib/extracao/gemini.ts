/**
 * Provedor de VISÃO da extração (US-008, Fase 2). Recebe o arquivo original em
 * base64 — é o caminho para PDF sem camada de texto (scan, foto convertida) e
 * o fallback de tudo que o estágio de texto (CONTAI-052) não resolve.
 *
 * Padrão trazido do ../garmin-import (abstração de provider por env var) — mas
 * o CHAMADO em si é novo: o garmin-import só usa Gemini para chat de texto,
 * nenhum PDF.
 *
 * Decisão de 2026-09-19: troca o Claude API do CLAUDE.md original (custo —
 * é o que o Mateus já tem de graça). Documentada em CLAUDE.md.
 *
 * O que saiu daqui no CONTAI-052, sem mudança de comportamento: o texto do
 * prompt (→ `prompt.ts`, fonte única com a Groq), o laço de retry (→
 * `retry.ts`, reaproveitado pelos dois) e `ExtracaoIndisponivelError` (→
 * `erros.ts`, módulo neutro).
 */

import { ExtracaoIndisponivelError } from "@/lib/extracao/erros";
import { CONFIANCA_VISAO, montarPrompt } from "@/lib/extracao/prompt";
import { postComRetry } from "@/lib/extracao/retry";
import {
  ExtracaoDocumentoSchema,
  type ExtracaoDocumento,
} from "@/lib/extracao/schema";

const PROMPT = montarPrompt(CONFIANCA_VISAO);

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    tipo: { type: "STRING", enum: ["nf_material", "nf_servico", "boleto", "null"] },
    numero: { type: "STRING", nullable: true },
    serie: { type: "STRING", nullable: true },
    dataEmissao: { type: "STRING", nullable: true },
    vencimento: { type: "STRING", nullable: true },
    favorecidoNome: { type: "STRING", nullable: true },
    favorecidoDocumento: { type: "STRING", nullable: true },
    valorReais: { type: "NUMBER", nullable: true },
    classificacao: { type: "STRING", enum: ["material", "mao_obra", "null"] },
    confianca: { type: "STRING", enum: ["alta", "media", "baixa", "null"] },
  },
  required: [
    "tipo",
    "numero",
    "serie",
    "dataEmissao",
    "vencimento",
    "favorecidoNome",
    "favorecidoDocumento",
    "valorReais",
    "classificacao",
    "confianca",
  ],
} as const;

/**
 * 20s por tentativa (CONTAI-052, fecha a D70). O dobro do teto da Groq porque
 * aqui sobe o PDF inteiro em base64 e o modelo roda visão — uma nota grande
 * legitimamente passa de 10s. Acima de 20s é pendurado, e repetir vale mais
 * que esperar.
 */
const TIMEOUT_MS = 20_000;

/**
 * `pdfBase64` sem o prefixo `data:...;base64,` — só o conteúdo. Lança
 * `ExtracaoIndisponivelError` para qualquer falha de rede/config/parsing: o
 * chamador trata como "extração não deu, preencha à mão", nunca bloqueia o
 * registro manual.
 */
export async function extrairViaGemini(
  pdfBase64: string,
  mimeType: string,
): Promise<ExtracaoDocumento> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new ExtracaoIndisponivelError("GEMINI_API_KEY não configurada.");
  }
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  // Montado uma vez: o base64 do PDF é grande e o retry reenvia o mesmo corpo.
  const body = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: mimeType, data: pdfBase64 } },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      // Mesmo cuidado do garmin-import: thinking consome o teto antes
      // do JSON de saída, e sem folga o JSON sai cortado. Foi o bug de
      // produção do "erro frequente no parse da nota": `maxOutputTokens`
      // é o teto TOTAL (thinking + saída), e o raciocínio do modelo
      // gastava os 2048 antes de escrever o JSON — MAX_TOKENS sem texto.
      // Ler nota fiscal é leitura, não raciocínio: pedimos um nível
      // barato e deixamos o teto só como trava contra loop (o JSON real
      // tem ~200 tokens).
      // ⚠️ 2026-09-24: "minimal" quebrou em produção com 400 ("Thinking
      // level MINIMAL is not supported for this model") — verificado
      // contra a API real (não só doc): `gemini-3.5-flash` aceita os 4
      // níveis, mas `gemini-flash-latest` (o fallback deste código, e o
      // que a Vercel provavelmente resolve — a mensagem de rate limit
      // do 429 revelou que o alias aponta para `gemini-3.8-flash`)
      // **rejeita "minimal"**. "low" foi testado e funciona nos dois
      // modelos, com o PDF real de uma nota. Não trocar para "minimal"
      // de novo sem testar contra a API de verdade em ambos os modelos.
      thinkingConfig: { thinkingLevel: "low" },
      maxOutputTokens: 8192,
    },
  });

  const { resposta, tentativas } = await postComRetry({
    nome: "Gemini",
    url,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    },
    timeoutMs: TIMEOUT_MS,
  });

  return interpretarResposta(await resposta.json(), tentativas);
}

/**
 * Interpreta um 200 OK. Nada aqui é repetível: resposta cortada, JSON inválido
 * ou schema divergente não mudam na segunda tentativa. `tentativas` entra só
 * para a telemetria do erro.
 */
function interpretarResposta(
  json: unknown,
  tentativas: number,
): ExtracaoDocumento {
  const candidato = json as {
    candidates?: {
      finishReason?: unknown;
      content?: { parts?: { text?: unknown }[] };
    }[];
    usageMetadata?: {
      thoughtsTokenCount?: unknown;
      candidatesTokenCount?: unknown;
    };
  };

  // Corte por teto de token sai como 200 OK com `finishReason: MAX_TOKENS` e
  // sem texto (ou com JSON truncado). O erro genérico "não devolveu texto"
  // escondia a causa; as contagens de token entram na mensagem porque log da
  // Vercel é a única telemetria que temos em produção.
  const finishReason: unknown = candidato.candidates?.[0]?.finishReason;
  if (typeof finishReason === "string" && finishReason !== "STOP") {
    const uso = candidato.usageMetadata ?? {};
    throw new ExtracaoIndisponivelError(
      `Gemini interrompeu a resposta (finishReason: ${finishReason}; ` +
        `thoughtsTokenCount: ${uso.thoughtsTokenCount ?? "?"}; ` +
        `candidatesTokenCount: ${uso.candidatesTokenCount ?? "?"}).`,
      tentativas,
    );
  }

  const texto: unknown = candidato.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof texto !== "string") {
    throw new ExtracaoIndisponivelError(
      "Gemini não devolveu texto — resposta fora do formato esperado.",
      tentativas,
    );
  }

  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ExtracaoIndisponivelError(
      "Gemini devolveu JSON inválido.",
      tentativas,
    );
  }

  // O schema do Gemini não tem `null` como tipo — "null" chega como STRING
  // literal quando o modelo não sabe o valor; convertemos antes de validar.
  const semNullString = Object.fromEntries(
    Object.entries(bruto as Record<string, unknown>).map(([k, v]) => [
      k,
      v === "null" ? null : v,
    ]),
  );

  const validado = ExtracaoDocumentoSchema.safeParse(semNullString);
  if (!validado.success) {
    throw new ExtracaoIndisponivelError(
      `Gemini devolveu formato inesperado: ${validado.error.message}`,
      tentativas,
    );
  }
  return validado.data;
}
