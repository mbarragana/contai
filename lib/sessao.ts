"use client";

/**
 * A sessão vista pelo app (CONTAI-002). Tudo que fala com o Supabase Auth
 * passa por aqui; a lógica pura (destino do redirect, tradução de erro) fica em
 * lib/auth.ts, sem browser e sem banco.
 *
 * Login por E-MAIL + SENHA (decisão do Mateus, 2026-08-17, revertendo a de
 * 2026-08-10). O código de 6 dígitos por e-mail não sobreviveu ao contato com
 * o Supabase: o SMTP embutido não deixa editar o template, então o e-mail sai
 * sempre como LINK e nunca como código — e o login projetado não existe. As
 * saídas eram todas SMTP de terceiro (domínio novo com renovação anual, conta
 * de outro produto, Gmail), cada uma um ponto a mais que falha em silêncio num
 * app que precisa durar até 2034. Senha não depende de e-mail nenhum: nada é
 * enviado, e o gerenciador do iPhone preenche.
 *
 * Nenhum caminho daqui cria conta. A conta do Mateus se cria UMA vez, à mão, no
 * dashboard do Supabase (ver supabase/seed.sql e CLAUDE.md): a base guarda CPF,
 * CNO e as notas da obra, e conta de terceiro não tem o que fazer ali.
 */

import type { Session, Subscription } from "@supabase/supabase-js";

import { ehSupabaseLocal, getSupabase } from "@/lib/supabase";

/**
 * O e-mail do último login que deu certo NESTE aparelho.
 *
 * Não é sessão e não é credencial — é só o endereço, e existe por um motivo:
 * o GoTrue devolve a MESMA resposta para senha errada e para e-mail sem conta
 * (`invalid_credentials`, conferido no stack local em 2026-08-17). Sem esta
 * memória o app teria de dizer "e-mail ou senha", e o único usuário do app
 * ficaria adivinhando qual dos dois consertar. Ver `classificarFalhaAuth`.
 *
 * localStorage aqui NÃO reabre a discussão da sessão: a sessão continua em
 * cookie via @supabase/ssr, com refresh no proxy.ts, que é o que sobrevive ao
 * ITP do Safari. O que se perde se o ITP apagar esta chave é a precisão da
 * mensagem de erro, e o app cai no texto que diz os dois casos.
 */
export const CHAVE_EMAIL_CONHECIDO = "contai-email";

export function emailConhecidoNesteAparelho(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CHAVE_EMAIL_CONHECIDO);
  } catch {
    // Safari em modo privado joga ao tocar no storage. Sem memória, sem
    // desempate — e nenhum login deixa de acontecer por isso.
    return null;
  }
}

function lembrarEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_EMAIL_CONHECIDO, email.trim());
  } catch {
    // idem
  }
}

/**
 * Entrar de verdade. Nenhum e-mail é enviado: `signInWithPassword` fala direto
 * com o GoTrue, e a sessão nasce dentro do app que pediu — que era a razão de
 * ser do código de 6 dígitos e continua valendo aqui, sem depender de SMTP.
 */
export async function entrarComSenha(
  email: string,
  senha: string,
): Promise<Session> {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: email.trim(),
    password: senha,
  });
  if (error) throw error;
  if (!data.session) {
    // Defensivo: sem erro e sem sessão não deveria acontecer, mas seguir em
    // frente aqui deixaria o app "logado" sem sessão nenhuma.
    throw new Error("O login foi aceito, mas a sessão não veio. Tente de novo.");
  }
  lembrarEmail(data.session.user.email ?? email);
  return data.session;
}

export async function sessaoAtual(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Sair de verdade: apaga a sessão deste aparelho (critério 6).
 *
 * O e-mail lembrado FICA, de propósito: ele não dá acesso a nada (a sessão é
 * que dá, e ela some aqui) e é o que preenche o campo e desempata a mensagem de
 * erro no login seguinte. Apagá-lo transformaria todo "sair" num aparelho novo.
 */
export async function sair(): Promise<void> {
  const { error } = await getSupabase().auth.signOut({ scope: "local" });
  if (error) throw error;
}

/**
 * Mudanças de sessão vindas do próprio SDK — inclui a expiração descoberta no
 * refresh, que é o caso do critério 5 e da tela 6 do mock (sessão que cai no
 * meio do formulário).
 */
export function assinarMudancaDeSessao(
  aoMudar: (sessao: Session | null) => void,
): Subscription {
  const { data } = getSupabase().auth.onAuthStateChange((_evento, sessao) => {
    aoMudar(sessao);
  });
  return data.subscription;
}

// ── Atalho de DESENVOLVIMENTO ────────────────────────────────────────────
// Antes do CONTAI-002 isto rodava sozinho dentro de `getUsuarioId`: sem tela
// de login, abrir o app local exigia plantar a sessão pelo console. Agora que
// a tela existe, entrar em silêncio esconderia justamente a tela que este
// ticket entrega — e o portão de rota mandaria para /entrar antes de qualquer
// chamada de dados, então o autologin nem chegaria a rodar.
//
// Virou BOTÃO na tela de login, sob a mesma trava tripla: flag explícita (só
// `npm run dev:local` a define), build fora de produção e Supabase local. O
// playwright.config.ts fixa a flag em "0" — no E2E o caminho testado é o real.

// Condicionadas ao NODE_ENV para o minifier APAGAR as literais do bundle de
// produção. O Next inlina `process.env.NODE_ENV` como "production" no build,
// então a comparação dobra para constante e o ramo de dev vira código morto —
// `contai-local-123` deixa de existir em .next/static/chunks/.
//
// A trava tripla de `atalhoDevDisponivel` já barrava o uso em produção; o que
// isto conserta é outra coisa: senha literal viajando no JavaScript que o
// navegador de qualquer pessoa baixa. O app carrega CPF, CNO e as notas da
// obra — credencial em bundle público é dívida que ninguém volta para pagar.
const EMAIL_DEV =
  process.env.NODE_ENV === "production" ? "" : "mateus@contai.local";
const SENHA_DEV =
  process.env.NODE_ENV === "production" ? "" : "contai-local-123";

export function atalhoDevDisponivel(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEV_AUTOLOGIN === "1" &&
    process.env.NODE_ENV !== "production" &&
    ehSupabaseLocal(process.env.NEXT_PUBLIC_SUPABASE_URL)
  );
}

/** Credenciais do supabase/seed.sql — nunca de produção. */
export async function entrarComoDesenvolvimento(): Promise<Session> {
  if (!atalhoDevDisponivel() || !EMAIL_DEV || !SENHA_DEV) {
    throw new Error("Atalho de desenvolvimento indisponível.");
  }
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: EMAIL_DEV,
    password: SENHA_DEV,
  });
  if (error) throw error;
  if (!data.session) throw new Error("Sem sessão após o atalho de dev.");
  lembrarEmail(data.session.user.email ?? EMAIL_DEV);
  return data.session;
}
