/**
 * **CONTAI-092 — as três variáveis do cliente OAuth, e por que elas são
 * server-only (critério 15).**
 *
 * `GOOGLE_OAUTH_CLIENT_SECRET` é o que troca um `code` por um refresh token: no
 * bundle do browser ela deixaria qualquer pessoa com a URL do app emitir token
 * em nome deste cliente OAuth. Mesmo padrão de `GEMINI_API_KEY` e `GROQ_API_KEY`
 * — **nunca** prefixar com `NEXT_PUBLIC_`.
 *
 * ⚠️ **Ausência não é erro** (critérios 5 e 15): sem as variáveis o card de
 * `/conta` mostra o estado "Não configurado", nenhuma rota chama o Google e todo
 * o resto do app (criar, adiar, quitar, cancelar compromisso) continua
 * funcionando igual. É o estado em que o projeto fica até o Mateus criar o
 * cliente OAuth no Google Cloud Console.
 */

/** Só `calendar.events` (critério 17): o app escreve evento, e nada mais. */
export const ESCOPO_GOOGLE = "https://www.googleapis.com/auth/calendar.events";

export interface ConfigGoogle {
  clientId: string;
  clientSecret: string;
  /**
   * Tem de ser **idêntica** a uma das URIs cadastradas no cliente OAuth
   * (critério 18): produção
   * `https://contai-rosy.vercel.app/api/google/agenda/callback` e
   * desenvolvimento `http://localhost:3200/api/google/agenda/callback` (porta do
   * `dev:local`).
   *
   * ⚠️ A porta 3100 (servidor do Playwright) **não** se registra: o E2E não fala
   * com o Google de verdade. O cliente HTTP é provado com `fetch` stubado
   * (`lib/agenda/google.test.ts`), e o fluxo de tela é provado no estado em que
   * a integração não existe ou já existe no banco.
   */
  redirectUri: string;
}

/**
 * A configuração, ou `null` quando qualquer uma das três falta.
 *
 * Parcial conta como ausente de propósito: client id sem secret produziria um
 * redirecionamento ao Google que volta com um `code` impossível de trocar — o
 * Mateus veria a tela de consentimento, concordaria, e voltaria para "não
 * conectado" sem explicação. Melhor dizer "não configurado" desde o começo.
 */
export function configDoGoogle(): ConfigGoogle | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}
