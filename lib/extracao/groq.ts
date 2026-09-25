/**
 * Provedor de TEXTO da extração (CONTAI-052). Recebe o texto já extraído do
 * PDF localmente por `texto-pdf.ts` — nunca o arquivo.
 *
 * Por que Groq e não o Gemini com o texto: cota **separada**. O motivo do
 * ticket não é payload menor, é tirar a fatia dos documentos com camada de
 * texto do caminho que está no limite de 5 req/min do tier gratuito do Gemini
 * (limite medido em 2026-09-24, `generate_content_free_tier_requests`).
 *
 * API no formato OpenAI porque é como a Groq expõe — não é dependência do
 * `openai` (nenhum SDK entra por isso; é um `fetch` de um endpoint só).
 */

import { ExtracaoIndisponivelError } from "@/lib/extracao/erros";
import {
  CHAVES_ESPERADAS,
  CONFIANCA_TEXTO,
  montarPrompt,
} from "@/lib/extracao/prompt";
import { postComRetry } from "@/lib/extracao/retry";
import {
  EXTRACAO_VAZIA,
  ExtracaoDocumentoSchema,
  type ExtracaoDocumento,
} from "@/lib/extracao/schema";

const URL_GROQ = "https://api.groq.com/openai/v1/chat/completions";

/**
 * A Groq roda em `response_format: { type: "json_object" }` — sem schema
 * estrito. `json_schema` só existe nos modelos `gpt-oss`/`qwen`, que são de
 * raciocínio e reproduziriam a armadilha da rodada 1 do incidente do Gemini
 * (o "pensar" consome o teto de tokens e a resposta sai vazia). Sem schema, as
 * chaves têm que estar no prompt — e a palavra "JSON" também, que é o que o
 * modo `json_object` exige.
 */
const INSTRUCAO_JSON = `Responda SOMENTE com um objeto JSON, sem texto em volta e sem bloco de
código, com exatamente estas chaves: ${CHAVES_ESPERADAS.join(", ")}.
Use \`null\` (o literal JSON, não a string "null") em todo campo que o texto
não permitir ler com certeza.`;

const PROMPT_TEXTO = `${montarPrompt(CONFIANCA_TEXTO)}\n\n${INSTRUCAO_JSON}`;

/**
 * 10s por tentativa. A Groq responde em ~1s para um prompt deste tamanho;
 * 10s já é sinal de que algo está pendurado, e o retry serve melhor que a
 * espera. Metade do teto do Gemini de propósito — aqui não há PDF subindo.
 */
const TIMEOUT_MS = 10_000;

/**
 * `texto` é o conteúdo lido do PDF, já cortado nos tetos de `texto-pdf.ts`.
 * Lança `ExtracaoIndisponivelError` em qualquer falha: quem chama (o
 * `provider.ts`) trata isso como "cai para o Gemini", nunca como erro do
 * usuário.
 */
export async function extrairViaGroq(texto: string): Promise<ExtracaoDocumento> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new ExtracaoIndisponivelError("GROQ_API_KEY não configurada.");
  }
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const body = JSON.stringify({
    model,
    // Leitura de campo impresso não tem nada a ganhar com variação.
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: PROMPT_TEXTO },
      {
        role: "user",
        content: `Texto extraído do documento:\n\n${texto}`,
      },
    ],
  });

  const { resposta, tentativas } = await postComRetry({
    nome: "Groq",
    url: URL_GROQ,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body,
    },
    timeoutMs: TIMEOUT_MS,
  });

  return interpretarResposta(await resposta.json(), tentativas);
}

/**
 * `valorReais` chega em string quando o modelo copia a grafia impressa, e o
 * contrato exige `number`. Duas grafias possíveis, e tratar só a vírgula
 * transformava a pt-BR com milhar em `NaN` → `null` (achado no Gate 2):
 * - pt-BR (`1.234,56`): o ponto é separador de MILHAR e tem que sair antes.
 * - ponto decimal (`1234.56`): já é o formato do `Number`.
 *
 * A presença da vírgula é o que distingue os dois — sem vírgula, um ponto só
 * pode ser decimal. `null` quando não dá um número finito: valor inventado
 * vira campo vazio, nunca um palpite (é a mesma regra do prompt).
 */
function numeroDeTexto(bruto: string): number | null {
  const limpo = bruto.replace(/[^\d.,-]/g, "");
  // Sem dígito nenhum não há número: `Number("")` é **0**, e um 0 aqui seria um
  // valor fiscal inventado ("nao consta" viraria R$ 0,00 na tela). Campo sem
  // número vira `null`, que é o que o resto do app sabe tratar.
  if (!/\d/.test(limpo)) return null;

  const semMilhar =
    // Com vírgula, o ponto só pode ser milhar: `1.234,56`.
    limpo.includes(",")
      ? limpo.replace(/\./g, "").replace(",", ".")
      : // Sem vírgula é ambíguo, e a ambiguidade custa 1000x: `18.750` é
        // dezoito mil e setecentos e cinquenta em pt-BR, e dezoito vírgula
        // setenta e cinco se o ponto for decimal. Grupos de exatamente 3
        // dígitos depois de cada ponto só acontecem em separador de milhar —
        // ninguém escreve preço com 3 casas decimais numa nota.
        /^-?\d{1,3}(?:\.\d{3})+$/.test(limpo)
        ? limpo.replace(/\./g, "")
        : limpo;

  const numero = Number(semMilhar);
  return Number.isFinite(numero) ? numero : null;
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
  const corpo = json as {
    choices?: {
      finish_reason?: unknown;
      message?: { content?: unknown };
    }[];
    usage?: { completion_tokens?: unknown };
  };

  const escolha = corpo.choices?.[0];

  // Equivalente do MAX_TOKENS do Gemini: `finish_reason: "length"` sai como
  // 200 OK com JSON truncado. Sem isto o erro apareceria como "JSON inválido"
  // e esconderia a causa — foi exatamente essa confusão na rodada 1 do
  // incidente de 2026-09-24.
  const finishReason: unknown = escolha?.finish_reason;
  if (typeof finishReason === "string" && finishReason !== "stop") {
    throw new ExtracaoIndisponivelError(
      `Groq interrompeu a resposta (finish_reason: ${finishReason}; ` +
        `completion_tokens: ${corpo.usage?.completion_tokens ?? "?"}).`,
      tentativas,
    );
  }

  const conteudo: unknown = escolha?.message?.content;
  if (typeof conteudo !== "string") {
    throw new ExtracaoIndisponivelError(
      "Groq não devolveu texto — resposta fora do formato esperado.",
      tentativas,
    );
  }

  let bruto: unknown;
  try {
    bruto = JSON.parse(conteudo);
  } catch {
    throw new ExtracaoIndisponivelError("Groq devolveu JSON inválido.", tentativas);
  }

  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) {
    throw new ExtracaoIndisponivelError(
      "Groq devolveu algo que não é objeto JSON.",
      tentativas,
    );
  }

  // Mesma normalização do Gemini: modelo sem schema estrito às vezes escreve a
  // string "null" no lugar do literal, mesmo com a instrução no prompt.
  // Número em string ("1234.56") também acontece — `valorReais` é o único
  // campo numérico do contrato, então a coerção é pontual, não genérica.
  const normalizado: Record<string, unknown> = Object.fromEntries(
    Object.entries(bruto as Record<string, unknown>).map(([chave, valor]) => [
      chave,
      valor === "null" || valor === "" ? null : valor,
    ]),
  );
  if (typeof normalizado.valorReais === "string") {
    normalizado.valorReais = numeroDeTexto(normalizado.valorReais);
  }

  // Chave ausente conta como campo não lido (`null`), não como resposta
  // inválida: o contrato já diz que campo ilegível vira `null`, e sem schema
  // estrito do lado da Groq omitir a chave é a forma mais provável de o modelo
  // dizer "não achei" — degradar para o Gemini por causa disso desperdiçaria a
  // cota que este estágio existe para poupar.
  const validado = ExtracaoDocumentoSchema.safeParse({
    ...EXTRACAO_VAZIA,
    ...normalizado,
  });
  if (!validado.success) {
    throw new ExtracaoIndisponivelError(
      `Groq devolveu formato inesperado: ${validado.error.message}`,
      tentativas,
    );
  }
  return validado.data;
}
