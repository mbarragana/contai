/**
 * Roteador da extração. Duas dimensões ORTOGONAIS, e confundi-las era o risco
 * de design do CONTAI-052 (decisão técnica 3):
 *
 * 1. **Estágio** — o documento passou por extração de texto local antes?
 *    `EXTRACAO_TEXTO=groq|off`.
 * 2. **Provedor de visão** — quem lê o arquivo quando não há texto aproveitável.
 *    `EXTRACAO_PROVIDER` (hoje só "gemini"; Claude API entra como `case` novo
 *    aqui, como já estava documentado, sem redesenho).
 *
 * A Groq NÃO é um `case` de `EXTRACAO_PROVIDER`: ela nunca vê o arquivo, só o
 * texto. Tratá-la como provedor de visão obrigaria toda escolha futura de
 * provider a carregar a pergunta "e isso lê PDF ou texto?".
 *
 * Ordem: texto local (grátis, sem API) → Groq (cota separada) → Gemini (visão,
 * caminho de hoje, intacto). Cada degrau que falha cai para o próximo — o
 * usuário não vê diferença nenhuma na tela além do resultado.
 */

import { ExtracaoIndisponivelError } from "@/lib/extracao/erros";
import { extrairViaGemini } from "@/lib/extracao/gemini";
import { extrairViaGroq } from "@/lib/extracao/groq";
import type { ExtracaoDocumento } from "@/lib/extracao/schema";
import {
  avaliarTexto,
  conferirContraFonte,
  extrairTextoDoPdf,
} from "@/lib/extracao/texto-pdf";

/**
 * Só para log da Vercel. **Não** entra no `ExtracaoDocumentoSchema` nem na
 * resposta da rota nem na UI: qual provedor leu o documento não é fato fiscal
 * (sanity check do `contador`, 2026-09-24) e não muda nada do que o Mateus vê
 * ou confirma.
 */
export type OrigemExtracao = "texto+groq" | "visao+gemini";

export type ResultadoExtracao = {
  dados: ExtracaoDocumento;
  origem: OrigemExtracao;
};

export async function extrairDocumento(
  pdfBase64: string,
  mimeType: string,
): Promise<ResultadoExtracao> {
  const viaTexto = await tentarViaTexto(pdfBase64, mimeType);
  if (viaTexto) return { dados: viaTexto, origem: "texto+groq" };

  return { dados: await extrairViaVisao(pdfBase64, mimeType), origem: "visao+gemini" };
}

/**
 * Estágio de texto. Devolve `null` em TODO caminho que não deu certo — e isso é
 * de propósito: aqui nada é erro do usuário, é só "não deu por este caminho,
 * segue para a visão". Único log é `console.warn`, que na Vercel é a única
 * telemetria que temos.
 */
async function tentarViaTexto(
  pdfBase64: string,
  mimeType: string,
): Promise<ExtracaoDocumento | null> {
  const modo = process.env.EXTRACAO_TEXTO ?? "groq";
  if (modo === "off") return null;
  if (modo !== "groq") {
    // Avisa e desliga, enquanto `EXTRACAO_PROVIDER` desconhecido LANÇA. A
    // assimetria é deliberada, e a razão não é "typo não derruba" — é que
    // abaixo deste estágio existe um degrau de segurança (o Gemini, que atende
    // o pedido inteiro sozinho), e abaixo do provedor de visão não existe nada.
    // Degradar em silêncio onde não há rede embaixo seria devolver sugestão
    // vazia fingindo que a extração rodou; aqui, degradar é o comportamento
    // correto e o log é o que impede que isso passe despercebido.
    console.warn(
      `[extracao] EXTRACAO_TEXTO desconhecido: "${modo}" (usa groq|off) — estágio de texto desligado.`,
    );
    return null;
  }

  // O estágio lê texto EMBUTIDO de PDF. Qualquer outro mime type é assunto da
  // visão. (Hoje a rota só aceita `application/pdf`; esta guarda existe para o
  // dia em que aceitar imagem — ver "Fora de Escopo" do CONTAI-052.)
  if (mimeType !== "application/pdf") return null;

  if (!process.env.GROQ_API_KEY) {
    // Chave ausente = estágio desligado, não falha. É o estado do projeto até
    // o Mateus criar a chave em console.groq.com/keys, e não pode bloquear
    // deploy nenhum (critério 6 do ticket).
    console.warn(
      "[extracao] GROQ_API_KEY ausente — estágio de texto desligado, extração segue pelo Gemini.",
    );
    return null;
  }

  // `Buffer.from` devolve um Buffer, e o PDF.js dentro do `unpdf` REJEITA
  // Buffer (lança, mesmo sendo subclasse de Uint8Array — ver
  // `comoUint8ArrayPuro` em `texto-pdf.ts`). Passamos a view pura daqui
  // também: o `texto-pdf.ts` normaliza de novo por segurança, mas quem lê este
  // arquivo não deve ficar com a impressão de que mandar Buffer está ok.
  const buffer = Buffer.from(pdfBase64, "base64");
  const lido = await extrairTextoDoPdf(
    new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
  );
  if (!lido) return null;

  const avaliacao = avaliarTexto(lido.texto);
  if (!avaliacao.suficiente) {
    console.warn(
      `[extracao] texto embutido insuficiente (motivo: ${avaliacao.motivo}; ` +
        `caracteres: ${avaliacao.caracteresNaoBrancos}; ` +
        `lixo: ${(avaliacao.proporcaoLixo * 100).toFixed(1)}%; ` +
        `documento: ${avaliacao.temDocumento}; valor: ${avaliacao.temValor}) — ` +
        "seguindo para a visão.",
    );
    return null;
  }

  try {
    const bruto = await extrairViaGroq(lido.texto);
    // Segunda defesa: campo que não aparece no texto-fonte vira `null` e
    // rebaixa a confiança. Sem isto, lixo que passasse raspando na heurística
    // viraria um CNPJ plausível e inventado na tela.
    return conferirContraFonte(bruto, lido.texto);
  } catch (erro) {
    const motivo =
      erro instanceof ExtracaoIndisponivelError || erro instanceof Error
        ? erro.message
        : String(erro);
    console.warn(`[extracao] Groq não resolveu (${motivo}) — seguindo para a visão.`);
    return null;
  }
}

async function extrairViaVisao(
  pdfBase64: string,
  mimeType: string,
): Promise<ExtracaoDocumento> {
  const provider = process.env.EXTRACAO_PROVIDER || "gemini";
  switch (provider) {
    case "gemini":
      return extrairViaGemini(pdfBase64, mimeType);
    default:
      throw new Error(
        `EXTRACAO_PROVIDER desconhecido: "${provider}" (usa gemini)`,
      );
  }
}
