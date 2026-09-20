/**
 * Ponto único de troca de provedor de extração — mesma forma do
 * `coachReply`/`COACH_PROVIDER` do ../garmin-import. Hoje só "gemini" existe;
 * o dia em que o Claude API (documentado originalmente no CLAUDE.md) entrar,
 * é um `case` novo aqui, não um redesenho.
 */

import { extrairViaGemini } from "@/lib/extracao/gemini";
import type { ExtracaoDocumento } from "@/lib/extracao/schema";

const PROVIDER = process.env.EXTRACAO_PROVIDER || "gemini";

export async function extrairDocumento(
  pdfBase64: string,
  mimeType: string,
): Promise<ExtracaoDocumento> {
  switch (PROVIDER) {
    case "gemini":
      return extrairViaGemini(pdfBase64, mimeType);
    default:
      throw new Error(
        `EXTRACAO_PROVIDER desconhecido: "${PROVIDER}" (usa gemini)`,
      );
  }
}
