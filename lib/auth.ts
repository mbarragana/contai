/**
 * Lógica pura do login (CONTAI-002). Nada aqui toca Supabase nem `window`:
 * é o que dá para testar sem browser e sem banco — validação do destino do
 * redirect, normalização do código digitado e tradução do erro do GoTrue.
 *
 * A mensagem que o Mateus lê nunca é a do GoTrue: elas vêm em inglês
 * ("Signups not allowed for otp") e não dizem o que fazer.
 */

/** Rota do login. Constante porque destino e portão precisam concordar. */
export const ROTA_ENTRAR = "/entrar";

/**
 * Nome do cookie de sessão. Mora aqui, e não em lib/supabase.ts, porque o
 * `proxy.ts` precisa dele e roda no servidor — importar um módulo
 * `"use client"` de lá arrastaria a fronteira de cliente para o proxy.
 */
export const COOKIE_SESSAO = "contai-auth";

/** Nome do parâmetro que carrega a rota pedida antes do login. */
export const PARAM_DESTINO = "destino";

/**
 * Para onde mandar DEPOIS de entrar (critério 4).
 *
 * Só caminho interno: `//evil.com` e `https://evil.com` são endereços de outro
 * host — aceitar qualquer um deles transformaria a tela de login num redirect
 * aberto, e o link de phishing sairia com o domínio do próprio app.
 * `/entrar` como destino também não passa: seria um laço.
 */
export function destinoSeguro(bruto: string | null | undefined): string {
  if (!bruto) return "/";
  // Caminho absoluto e nada mais: "http://", "javascript:", "//host" caem aqui.
  if (!bruto.startsWith("/")) return "/";
  // "//host" é URL protocol-relative; "/\host" é o mesmo buraco em alguns
  // navegadores, que normalizam a barra invertida.
  if (bruto.startsWith("//") || bruto.startsWith("/\\")) return "/";
  // Caractere de controle (\n, \r, \0) em Location abre injeção de cabeçalho.
  if (/[\u0000-\u001f\u007f]/.test(bruto)) return "/";

  const caminho = bruto.split(/[?#]/)[0];
  if (caminho === ROTA_ENTRAR || caminho.startsWith(`${ROTA_ENTRAR}/`)) return "/";
  return bruto;
}

/** `/entrar?destino=...` com o destino já validado e escapado. */
export function urlDeEntrada(destinoBruto: string | null | undefined): string {
  const destino = destinoSeguro(destinoBruto);
  if (destino === "/") return ROTA_ENTRAR;
  return `${ROTA_ENTRAR}?${PARAM_DESTINO}=${encodeURIComponent(destino)}`;
}

/** Quantidade de dígitos do código (supabase/config.toml: otp_length = 6). */
export const DIGITOS_CODIGO = 6;

/**
 * O que o campo aceita. Colar "417 209" ou "Seu código é 417209" tem de virar
 * o código — no canteiro, o que o iOS oferece para colar nem sempre vem limpo.
 */
export function normalizarCodigo(texto: string): string {
  return texto.replace(/\D/g, "").slice(0, DIGITOS_CODIGO);
}

export function codigoCompleto(codigo: string): boolean {
  return new RegExp(`^\\d{${DIGITOS_CODIGO}}$`).test(codigo);
}

export function ehEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Forma mínima de um erro do GoTrue, para não depender do tipo do SDK aqui. */
export interface FalhaBruta {
  code?: string | null;
  status?: number | null;
  message?: string | null;
  name?: string | null;
}

export type FalhaAuth =
  | "email_invalido"
  | "sem_conta"
  | "codigo_invalido"
  | "muitas_tentativas"
  | "envio"
  | "rede";

export type EtapaAuth = "email" | "codigo";

function texto(f: FalhaBruta): string {
  return (f.message ?? "").toLowerCase();
}

/**
 * Traduz a falha do GoTrue para a causa que o Mateus precisa saber.
 *
 * `shouldCreateUser: false` faz o GoTrue devolver 422 `otp_disabled` para
 * e-mail sem conta — "Signups not allowed for otp" não pode chegar cru a
 * ninguém: quem lê isso entende "o app está quebrado", não "esse e-mail não é
 * o da sua conta".
 */
export function classificarFalhaAuth(
  erro: unknown,
  etapa: EtapaAuth,
): FalhaAuth {
  const f = (erro ?? {}) as FalhaBruta;
  const code = f.code ?? "";
  const status = f.status ?? null;
  const msg = texto(f);

  if (code === "otp_disabled" || code === "signup_disabled") return "sem_conta";
  if (msg.includes("signups not allowed")) return "sem_conta";

  if (status === 429 || code.startsWith("over_") || msg.includes("rate limit")) {
    return "muitas_tentativas";
  }

  // Sem rede o SDK nem chega a ter status: AuthRetryableFetchError vem com 0.
  if (
    f.name === "AuthRetryableFetchError" ||
    f.name === "TypeError" ||
    status === 0 ||
    (status !== null && status >= 500)
  ) {
    return "rede";
  }

  if (etapa === "codigo") return "codigo_invalido";
  return "envio";
}

/**
 * Texto de tela por causa. Copiado do mock aprovado (design/mocks/CONTAI-002.html,
 * telas 1 a 3): honesto sobre o que aconteceu e com a saída junto.
 */
export const MENSAGEM_FALHA: Record<FalhaAuth, string> = {
  email_invalido: "Digite um e-mail válido — o código vai para ele.",
  sem_conta:
    "Não existe conta com esse e-mail no contai. O app guarda o seu CPF, o CNO e as notas da obra, então o acesso é só do dono — confira se digitou certo.",
  codigo_invalido:
    "Esse código não vale. Ou foi digitado errado, ou expirou, ou você pediu outro depois — pedir um novo invalida o anterior.",
  muitas_tentativas:
    "Muitos pedidos em pouco tempo. Espere um minuto e peça o código de novo.",
  envio: "Não foi possível enviar o código agora. Tente de novo.",
  rede: "Não foi possível falar com o servidor. Tente de novo.",
};

export function mensagemDeFalhaAuth(erro: unknown, etapa: EtapaAuth): string {
  return MENSAGEM_FALHA[classificarFalhaAuth(erro, etapa)];
}
