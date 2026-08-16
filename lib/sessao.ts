"use client";

/**
 * A sessão vista pelo app (CONTAI-002). Tudo que fala com o Supabase Auth
 * passa por aqui; a lógica pura (destino do redirect, tradução de erro,
 * normalização do código) fica em lib/auth.ts, sem browser e sem banco.
 *
 * Login por CÓDIGO de 6 dígitos, nunca por link (decisão do Mateus,
 * 2026-08-10): o app pode virar nativo, e link em e-mail abre no navegador
 * padrão — quem entraria é a aba, não o app. O código é digitado dentro do app
 * que pediu, então a sessão nasce onde tem de nascer.
 */

import type { Session, Subscription } from "@supabase/supabase-js";

import { ehSupabaseLocal, getSupabase } from "@/lib/supabase";

/**
 * `shouldCreateUser: false` — o login NUNCA cria conta (critério 2). A base
 * guarda CPF, CNO e as notas da obra; conta de terceiro não tem o que fazer
 * ali. Conta nova em produção se cria por convite/criação manual no dashboard
 * do Supabase (ver supabase/seed.sql e CLAUDE.md).
 *
 * Sem `emailRedirectTo`: não existe link para clicar. O que o e-mail carrega é
 * o `{{ .Token }}` do template supabase/templates/magic_link.html.
 */
export async function pedirCodigo(email: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

export async function entrarComCodigo(
  email: string,
  codigo: string,
): Promise<Session> {
  const { data, error } = await getSupabase().auth.verifyOtp({
    email: email.trim(),
    token: codigo,
    type: "email",
  });
  if (error) throw error;
  if (!data.session) {
    // Defensivo: verifyOtp sem erro e sem sessão não deveria acontecer, mas
    // seguir em frente aqui deixaria o app "logado" sem sessão nenhuma.
    throw new Error("O código foi aceito, mas a sessão não veio. Tente de novo.");
  }
  return data.session;
}

export async function sessaoAtual(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

/** Sair de verdade: apaga a sessão deste aparelho (critério 6). */
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

const EMAIL_DEV = "mateus@contai.local";
const SENHA_DEV = "contai-local-123";

export function atalhoDevDisponivel(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEV_AUTOLOGIN === "1" &&
    process.env.NODE_ENV !== "production" &&
    ehSupabaseLocal(process.env.NEXT_PUBLIC_SUPABASE_URL)
  );
}

/** Credenciais do supabase/seed.sql — nunca de produção. */
export async function entrarComoDesenvolvimento(): Promise<Session> {
  if (!atalhoDevDisponivel()) {
    throw new Error("Atalho de desenvolvimento indisponível.");
  }
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: EMAIL_DEV,
    password: SENHA_DEV,
  });
  if (error) throw error;
  if (!data.session) throw new Error("Sem sessão após o atalho de dev.");
  return data.session;
}
