/**
 * **CONTAI-092 — o consentimento (critério 17): URL de autorização e `state`.**
 *
 * Puro de propósito (nada de `cookies()` nem de `NextResponse` aqui): quem
 * escreve o cookie e redireciona são as rotas, e o que se testa sem servidor é
 * justamente a montagem da URL e a comparação do `state`.
 */

import { ESCOPO_GOOGLE, type ConfigGoogle } from "@/lib/agenda/config";

const URL_CONSENTIMENTO = "https://accounts.google.com/o/oauth2/v2/auth";

/**
 * Nome do cookie que carrega o `state` entre o início do fluxo e a volta do
 * Google. `httpOnly` (escrito e lido só pelo servidor) e de vida curta: ele não
 * é sessão, é um nonce de uma navegação.
 */
export const COOKIE_STATE = "contai-google-state";

/** 10 minutos: o tempo de olhar a tela de consentimento, não mais. */
export const VALIDADE_STATE_SEGUNDOS = 600;

/**
 * **Nome do parâmetro transitório de volta ao `/conta`** — a pergunta aberta que
 * o ticket (e o spec de design) deixaram para o Gate 1. Decidido aqui:
 * `?google=<motivo>`, consumido e descartado no primeiro render.
 *
 * Dois motivos, e a separação importa para o Mateus saber se ele desistiu ou se
 * algo do lado do app não funcionou:
 * - `negado` — ele cancelou ou negou na tela do Google (o Google volta com
 *   `error=access_denied`). Nada foi gravado;
 * - `falhou` — a volta chegou, mas o app não conseguiu concluir (state que não
 *   confere, troca de código recusada, Google fora do ar). Nada foi gravado.
 *
 * Os dois caem no **estado 2** do card ("Não conectado"), nunca num quinto
 * estado persistente.
 */
export const PARAM_RESULTADO = "google";
export type ResultadoOAuth = "negado" | "falhou";

/**
 * `state` novo. `crypto.getRandomValues` (Web Crypto) e não `Math.random`: o
 * `state` é a defesa contra alguém fazer o navegador do Mateus concluir um fluxo
 * OAuth que ele não começou, e um valor adivinhável não defende de nada.
 */
export function gerarState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Comparação do `state` da volta com o do cookie.
 *
 * Qualquer lado ausente é recusa, nunca "deixa passar": sem cookie, não há
 * prova de que este navegador iniciou o fluxo.
 */
export function stateConfere(
  doCookie: string | undefined | null,
  daUrl: string | undefined | null,
): boolean {
  if (!doCookie || !daUrl) return false;
  return doCookie === daUrl;
}

/**
 * A URL de consentimento (critério 17).
 *
 * - `access_type=offline` — sem ele o Google não devolve refresh token e a
 *   integração morre na primeira expiração do access token;
 * - `prompt=consent` — força o consentimento mesmo em reautorização, que é o
 *   único jeito de receber um refresh token NOVO depois de uma revogação;
 * - `scope` — **só `calendar.events`**. Nada de `openid`/`email`: o app escreve
 *   evento e não precisa do perfil (ver `descobrirEmailDaConta`);
 * - `include_granted_scopes=true` — se algum dia houver outro escopo concedido a
 *   este cliente, reautorizar aqui não o derruba.
 */
export function urlDeConsentimento(config: ConfigGoogle, state: string): string {
  const parametros = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: ESCOPO_GOOGLE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${URL_CONSENTIMENTO}?${parametros.toString()}`;
}
