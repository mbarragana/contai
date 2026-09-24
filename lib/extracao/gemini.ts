/**
 * Extração de documento via Gemini (US-008, Fase 2). Padrão trazido do
 * ../garmin-import (abstração de provider por env var) — mas o CHAMADO em si
 * é novo: o garmin-import só usa Gemini para chat de texto, nenhum PDF.
 *
 * Decisão de 2026-09-19: troca o Claude API do CLAUDE.md original (custo —
 * é o que o Mateus já tem de graça). Documentada em CLAUDE.md.
 */

import {
  ExtracaoDocumentoSchema,
  type ExtracaoDocumento,
} from "@/lib/extracao/schema";

const PROMPT = `Você lê notas fiscais e boletos de uma obra de construção civil
no Brasil e devolve SOMENTE os dados que estão impressos no documento.

Regras, sem exceção:
- Nunca invente ou estime um valor. Campo que você não consegue ler com
  certeza vira \`null\` — nunca um palpite.
- "favorecidoNome" e "favorecidoDocumento" são de quem EMITIU o documento
  (o prestador/fornecedor), nunca do tomador.
- "valorReais" é o valor BRUTO do documento (o total da nota/boleto), em
  reais, com ponto decimal (ex.: 1234.56) — nunca já descontado de retenção.
- "dataEmissao" e "vencimento" saem em AAAA-MM-DD. Nota sem vencimento
  impresso (não é boleto) → \`vencimento: null\`.
- "tipo": "nf_servico" se a nota descreve prestação de serviço/mão de obra;
  "nf_material" se descreve venda de material/produto; "boleto" se o
  documento é um boleto de cobrança (não é NF).
- "classificacao": "mao_obra" para serviço, "material" para material — só
  quando o tipo já não deixar isso óbvio, senão \`null\`.
- "confianca": "baixa" se o PDF está com texto cortado, ilegível ou você tem
  qualquer dúvida sobre um campo; "alta" só quando todos os campos lidos são
  nítidos e inequívocos.

Não leia nem tente classificar retenções (INSS, ISS, CPP, etc.) — isso fica
fora do seu escopo, mesmo que a nota mostre uma linha de retenção.`;

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

export class ExtracaoIndisponivelError extends Error {}

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

  let resposta: Response;
  try {
    resposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
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
            // Ler nota fiscal é leitura, não raciocínio: pedimos o nível mais
            // barato e deixamos o teto só como trava contra loop (o JSON real
            // tem ~200 tokens).
            thinkingConfig: { thinkingLevel: "minimal" },
            maxOutputTokens: 8192,
          },
        }),
      },
    );
  } catch (erro) {
    throw new ExtracaoIndisponivelError(
      `Gemini indisponível: ${erro instanceof Error ? erro.message : String(erro)}`,
    );
  }

  if (!resposta.ok) {
    throw new ExtracaoIndisponivelError(
      `Gemini devolveu ${resposta.status}: ${await resposta.text()}`,
    );
  }

  const json = await resposta.json();

  // Corte por teto de token sai como 200 OK com `finishReason: MAX_TOKENS` e
  // sem texto (ou com JSON truncado). O erro genérico "não devolveu texto"
  // escondia a causa; as contagens de token entram na mensagem porque log da
  // Vercel é a única telemetria que temos em produção.
  const finishReason: unknown = json?.candidates?.[0]?.finishReason;
  if (typeof finishReason === "string" && finishReason !== "STOP") {
    const uso = json?.usageMetadata ?? {};
    throw new ExtracaoIndisponivelError(
      `Gemini interrompeu a resposta (finishReason: ${finishReason}; ` +
        `thoughtsTokenCount: ${uso.thoughtsTokenCount ?? "?"}; ` +
        `candidatesTokenCount: ${uso.candidatesTokenCount ?? "?"}).`,
    );
  }

  const texto: unknown = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof texto !== "string") {
    throw new ExtracaoIndisponivelError(
      "Gemini não devolveu texto — resposta fora do formato esperado.",
    );
  }

  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ExtracaoIndisponivelError("Gemini devolveu JSON inválido.");
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
    );
  }
  return validado.data;
}
