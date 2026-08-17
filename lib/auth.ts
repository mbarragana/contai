/**
 * Lógica pura do login (CONTAI-002). Nada aqui toca Supabase nem `window`:
 * é o que dá para testar sem browser e sem banco — validação do destino do
 * redirect e tradução do erro do GoTrue.
 *
 * A mensagem que o Mateus lê nunca é a do GoTrue: elas vêm em inglês
 * ("Invalid login credentials") e não dizem o que fazer.
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

export function ehEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Dois e-mails são o mesmo endereço? Espaço e caixa não contam. */
export function mesmoEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
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
  | "senha_vazia"
  | "senha_incorreta"
  | "sem_conta"
  | "credencial_invalida"
  | "email_nao_confirmado"
  | "muitas_tentativas"
  | "rede"
  | "desconhecida";

/**
 * O que a TELA sabe na hora de traduzir a falha. `emailConhecido` é o e-mail do
 * último login bem-sucedido NESTE aparelho (lib/sessao.ts) — sem ele não há
 * como separar senha errada de e-mail errado; ver o comentário de
 * `classificarFalhaAuth`.
 */
export interface ContextoFalha {
  emailTentado?: string | null;
  emailConhecido?: string | null;
}

function texto(f: FalhaBruta): string {
  return (f.message ?? "").toLowerCase();
}

/**
 * Traduz a falha do GoTrue para a causa que o Mateus precisa saber.
 *
 * **O GoTrue NÃO distingue senha errada de e-mail sem conta.** Conferido contra
 * o stack local em 2026-08-17: os dois casos devolvem a MESMA resposta, byte a
 * byte — `400 {"error_code":"invalid_credentials","msg":"Invalid login
 * credentials"}`. É de propósito (impede enumerar e-mails), e não existe
 * endpoint público que responda "essa conta existe".
 *
 * Como o Mateus é o único usuário e precisa saber qual dos dois foi, quem
 * desempata é o próprio aparelho: o e-mail do último login bem-sucedido fica
 * guardado aqui (não a senha, não a sessão — só o endereço). Se o e-mail
 * digitado é o mesmo, a conta existe e o que falhou foi a senha; se é outro, o
 * que ele tem em mãos é um e-mail que este aparelho nunca usou. Em aparelho
 * novo (sem memória) o app não finge saber: diz os dois casos e diz por quê.
 */
export function classificarFalhaAuth(
  erro: unknown,
  contexto: ContextoFalha = {},
): FalhaAuth {
  const f = (erro ?? {}) as FalhaBruta;
  const code = f.code ?? "";
  const status = f.status ?? null;
  const msg = texto(f);

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

  // Conta criada no dashboard sem "Auto Confirm": existe, senha certa, e o
  // login recusa mesmo assim. Sem esta linha viraria "credencial inválida" e
  // ele trocaria a senha para sempre, sem nunca entrar.
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "email_nao_confirmado";
  }

  if (
    code === "invalid_credentials" ||
    code === "invalid_login_credentials" ||
    msg.includes("invalid login credentials")
  ) {
    if (!contexto.emailConhecido || !contexto.emailTentado) {
      return "credencial_invalida";
    }
    return mesmoEmail(contexto.emailConhecido, contexto.emailTentado)
      ? "senha_incorreta"
      : "sem_conta";
  }

  return "desconhecida";
}

/**
 * Texto de tela por causa. Mesma régua do mock aprovado
 * (design/mocks/CONTAI-002.html, telas 1 a 3): honesto sobre o que aconteceu e
 * com a saída junto.
 */
export const MENSAGEM_FALHA: Record<FalhaAuth, string> = {
  email_invalido: "Digite um e-mail válido — é com ele que você entra.",
  senha_vazia: "Digite a sua senha para entrar.",
  senha_incorreta:
    "A senha não confere. O e-mail é o mesmo com que você já entrou neste aparelho, então a conta existe — se você trocou a senha no painel do Supabase, use a nova.",
  sem_conta:
    "Esse não é o e-mail com que você entra neste aparelho. Confira o e-mail antes de mexer na senha — o app guarda o seu CPF, o CNO e as notas da obra, então o acesso é só do dono.",
  credencial_invalida:
    "E-mail ou senha não conferem. O Supabase responde igual nos dois casos, e este aparelho ainda não tem um login anterior para comparar — confira o e-mail primeiro, depois a senha.",
  email_nao_confirmado:
    "Essa conta existe, mas o e-mail nunca foi confirmado. Confirme no painel do Supabase (Authentication → Users) e entre de novo.",
  muitas_tentativas:
    "Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.",
  rede: "Não foi possível falar com o servidor. Tente de novo.",
  desconhecida: "Não foi possível entrar agora. Tente de novo.",
};

export function mensagemDeFalhaAuth(
  erro: unknown,
  contexto: ContextoFalha = {},
): string {
  const causa = classificarFalhaAuth(erro, contexto);
  if (causa === "sem_conta" && contexto.emailConhecido) {
    return `${MENSAGEM_FALHA.sem_conta} Neste aparelho você entrou com ${contexto.emailConhecido}.`;
  }
  return MENSAGEM_FALHA[causa];
}
