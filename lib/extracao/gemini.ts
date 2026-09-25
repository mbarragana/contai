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

export class ExtracaoIndisponivelError extends Error {
  /**
   * Quantas chamadas ao Gemini foram feitas até desistir. Existe para a rota
   * logar isso na Vercel — 1 tentativa e 3 tentativas com o mesmo 503 contam
   * histórias diferentes (blip vs. indisponibilidade de verdade).
   */
  readonly tentativas: number;

  constructor(mensagem: string, tentativas = 1) {
    super(mensagem);
    this.tentativas = tentativas;
  }
}

/**
 * Retry para o que pode mudar de resultado na próxima tentativa:
 * - qualquer 5xx — 503 UNAVAILABLE ("model is currently experiencing high
 *   demand") é o que já mordeu em produção, mas 500/502/504 são da mesma
 *   família: falha do lado deles, não do nosso pedido
 * - 429 RESOURCE_EXHAUSTED — rate limit (a conta é tier gratuito, 5 req/min)
 *
 * O 4xx restante é erro de configuração/request (foi o caso do
 * `thinkingLevel: "minimal"` em 2026-09-24): repetir devolve o mesmo 400 e só
 * queima tempo do Mateus na tela. A fronteira é exatamente essa — 429 e 5xx
 * repetem, o resto do 4xx falha na hora.
 *
 * Erro de rede (fetch rejeitando: timeout, DNS, socket) também repete: é o
 * transitório mais comum de todos, e nesse caso não há resposta para ler
 * `Retry-After`, então vale só o backoff fixo.
 */
function repetivel(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * 3 tentativas no total (a original + 2), esperando 1s e depois 3s. O teto de
 * ~4s de espera extra é deliberado: o 503 de 2026-09-24 ainda estava lá 20
 * minutos depois, então "esperar a indisponibilidade passar" não é objetivo
 * alcançável — o alvo é só o blip de segundos. Espera maior travaria a tela
 * de captura sem aumentar a chance de sucesso.
 */
const TENTATIVAS_MAXIMAS = 3;
const ESPERAS_MS = [1_000, 3_000];
/** `Retry-After` acima disto é ignorado: vira espera longa, não blip. */
const RETRY_AFTER_MAXIMO_MS = 5_000;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `Retry-After` em segundos; `null` se ausente, inválido ou não-numérico. */
function retryAfterMs(resposta: Response): number | null {
  const bruto = resposta.headers.get("retry-after");
  if (!bruto) return null;
  const segundos = Number(bruto.trim());
  if (!Number.isFinite(segundos) || segundos <= 0) return null;
  return segundos * 1_000;
}

/** Sem `resposta` (falha de rede) só existe o backoff fixo. */
function esperaAposFalha(tentativa: number, resposta?: Response): number {
  const padrao = ESPERAS_MS[tentativa - 1] ?? ESPERAS_MS[ESPERAS_MS.length - 1];
  const sugerido = resposta ? retryAfterMs(resposta) : null;
  return sugerido !== null && sugerido <= RETRY_AFTER_MAXIMO_MS
    ? sugerido
    : padrao;
}

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

  let ultimaFalha = "";
  let tentativasFeitas = 0;

  // Log da Vercel é a única telemetria de produção: sem isto, um retry
  // bem-sucedido some e "o Gemini está instável" fica sem evidência.
  const avisarRepeticao = (tentativa: number, motivo: string, espera: number) =>
    console.warn(
      `[gemini] tentativa ${tentativa}/${TENTATIVAS_MAXIMAS} falhou ` +
        `(${motivo}); repetindo em ${espera}ms.`,
    );

  for (let tentativa = 1; tentativa <= TENTATIVAS_MAXIMAS; tentativa++) {
    tentativasFeitas = tentativa;
    const ultima = tentativa === TENTATIVAS_MAXIMAS;

    let resposta: Response;
    try {
      resposta = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      ultimaFalha = `Gemini indisponível: ${motivo}`;
      if (ultima) break;
      const espera = esperaAposFalha(tentativa);
      avisarRepeticao(tentativa, motivo, espera);
      await esperar(espera);
      continue;
    }

    if (resposta.ok) {
      return interpretarResposta(await resposta.json(), tentativa);
    }

    ultimaFalha = `Gemini devolveu ${resposta.status}: ${await resposta.text()}`;
    if (!repetivel(resposta.status) || ultima) break;

    const espera = esperaAposFalha(tentativa, resposta);
    avisarRepeticao(tentativa, String(resposta.status), espera);
    await esperar(espera);
  }

  throw new ExtracaoIndisponivelError(
    tentativasFeitas > 1
      ? `Gemini indisponível após ${tentativasFeitas} tentativas: ${ultimaFalha}`
      : ultimaFalha,
    tentativasFeitas,
  );
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
