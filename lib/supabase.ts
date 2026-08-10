"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client do browser. A publishable key é pública por design — o que protege
 * os dados é a RLS da migration 0001 (`user_id = auth.uid()` em toda tabela).
 * Nunca usar a secret key aqui.
 */

/** Bucket do acervo (ver supabase/migrations/0002_storage.sql). */
export const BUCKET_ACERVO = "acervo";

/**
 * Chave de sessão fixa: não depende do project ref da URL. Exportada porque o
 * E2E injeta aqui a sessão obtida do GoTrue local (e2e/banco.ts) — se o nome
 * mudar, o teste quebra junto, que é o que se quer.
 */
export const STORAGE_KEY = "contai-auth";

export class ConfiguracaoAusenteError extends Error {
  constructor(variavel: string) {
    super(
      `Variável ${variavel} não configurada. Copie .env.example para .env.local e preencha.`,
    );
    this.name = "ConfiguracaoAusenteError";
  }
}

let cliente: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cliente) return cliente;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url) throw new ConfiguracaoAusenteError("NEXT_PUBLIC_SUPABASE_URL");
  if (!key) {
    throw new ConfiguracaoAusenteError("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  cliente = createClient(url, key, {
    auth: { storageKey: STORAGE_KEY, persistSession: true },
  });
  return cliente;
}

/**
 * O app carrega CPF/CNO/dados fiscais: sem sessão não há o que mostrar (a RLS
 * devolveria vazio, o que seria indistinguível de "nada pendente").
 * A tela de login não é deste ticket — aqui a ausência de sessão vira erro
 * explícito, nunca estado vazio silencioso.
 */
export class SemSessaoError extends Error {
  constructor() {
    super("Sessão não iniciada — entre com sua conta para ver a obra.");
    this.name = "SemSessaoError";
  }
}

// ── Login automático de DESENVOLVIMENTO ──────────────────────────────────
// Enquanto a tela de login não existe (CONTAI-002), abrir o app local exigia
// colar um fetch no console do navegador para plantar a sessão à mão. Isto
// substitui aquilo. Credenciais do supabase/seed.sql — nunca de produção.

const EMAIL_DEV = "mateus@contai.local";
const SENHA_DEV = "contai-local-123";

/**
 * Trava de segurança do autologin: só vale para o stack em Docker na própria
 * máquina. Se a URL for de qualquer outro host, o autologin não roda — é o que
 * impede uma flag esquecida de tentar entrar no projeto do Mateus.
 */
export function ehSupabaseLocal(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "http:" && protocol !== "https:") return false;
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
  } catch {
    return false;
  }
}

/**
 * Três condições, todas obrigatórias: a flag explícita (só `npm run dev:local`
 * a define), build fora de produção, e Supabase local. Em produção não roda nem
 * por acidente — o build da Vercel não tem a flag, e mesmo que tivesse, a URL
 * não passaria em `ehSupabaseLocal`.
 */
function autologinHabilitado(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEV_AUTOLOGIN === "1" &&
    process.env.NODE_ENV !== "production" &&
    ehSupabaseLocal(process.env.NEXT_PUBLIC_SUPABASE_URL)
  );
}

async function entrarComoDesenvolvimento(): Promise<string | null> {
  if (!autologinHabilitado()) return null;
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: EMAIL_DEV,
    password: SENHA_DEV,
  });
  // Falhou (banco fora, seed não rodou)? Devolve null e deixa o fluxo normal
  // reportar ausência de sessão — autologin não inventa usuário.
  if (error || !data.session) return null;
  return data.session.user.id;
}

export async function getUsuarioId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  const id = data.session?.user.id;
  if (id) return id;

  const idDev = await entrarComoDesenvolvimento();
  if (idDev) return idDev;

  throw new SemSessaoError();
}
