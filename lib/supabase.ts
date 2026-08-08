"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client do browser. A publishable key é pública por design — o que protege
 * os dados é a RLS da migration 0001 (`user_id = auth.uid()` em toda tabela).
 * Nunca usar a secret key aqui.
 */

/** Bucket do acervo (ver supabase/migrations/0002_storage.sql). */
export const BUCKET_ACERVO = "acervo";

/** Chave de sessão fixa: não depende do project ref da URL. */
const STORAGE_KEY = "contai-auth";

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

export async function getUsuarioId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  const id = data.session?.user.id;
  if (!id) throw new SemSessaoError();
  return id;
}
