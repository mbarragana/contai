"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { COOKIE_SESSAO } from "@/lib/auth";

/**
 * Client do browser. A publishable key é pública por design — o que protege
 * os dados é a RLS da migration 0001 (`user_id = auth.uid()` em toda tabela).
 * Nunca usar a secret key aqui.
 */

/** Bucket do acervo (ver supabase/migrations/0002_storage.sql). */
export const BUCKET_ACERVO = "acervo";

/**
 * Nome do COOKIE de sessão (era a chave do localStorage até o CONTAI-002).
 *
 * A sessão saiu do localStorage por decisão do Mateus (2026-08-10): no Safari
 * do iOS o ITP apaga armazenamento gravável por script depois de ~7 dias sem
 * interação com o site, e o uso aqui é esporádico — no canteiro, a cada
 * quinzena. Perder a sessão semanalmente é o pre-mortem 3 do próprio ticket
 * ("login vira fricção diária → ele para de registrar").
 *
 * Cookie escrito por JavaScript sofre o MESMO limite de 7 dias. Quem sobrevive
 * é cookie regravado pelo SERVIDOR via `Set-Cookie` — por isso existe o
 * `proxy.ts`, que renova a sessão a cada navegação. Sem ele esta troca não
 * resolveria nada.
 *
 * Fixo em vez do padrão derivado do project ref: o E2E e a documentação
 * precisam de um nome estável. `cookieOptions.name` é a opção da própria
 * biblioteca — o formato (chunking `.0`/`.1`, encoding base64url) continua
 * sendo dela, nunca montado à mão.
 *
 * O valor mora em lib/auth.ts porque o `proxy.ts` (servidor) também precisa
 * dele e não pode importar módulo `"use client"`.
 */
export const STORAGE_KEY = COOKIE_SESSAO;

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

  cliente = createBrowserClient(url, key, {
    // `name` vira o `storageKey` do auth-js e o nome do cookie (ver
    // createBrowserClient.js da 0.12.4). O resto é o padrão da biblioteca:
    // path "/", SameSite=Lax, maxAge de 400 dias.
    cookieOptions: { name: STORAGE_KEY },
    auth: {
      // Critério 3: fechar e reabrir o PWA não pode pedir código de novo. O
      // SDK renova o access token sozinho enquanto a aba está aberta, e o
      // proxy.ts renova (e REGRAVA o cookie pelo servidor) a cada navegação.
      persistSession: true,
      autoRefreshToken: true,
      // Não existe link de login (decisão de 2026-08-10): nada de sessão vinda
      // do fragmento da URL. Ligado, isto tentaria consumir um hash de magic
      // link aberto por engano no navegador — exatamente o caminho que o
      // código de 6 dígitos veio eliminar.
      detectSessionInUrl: false,
    },
  });
  return cliente;
}

/**
 * O app carrega CPF/CNO/dados fiscais: sem sessão não há o que mostrar (a RLS
 * devolveria vazio, o que seria indistinguível de "nada pendente").
 * Aqui a ausência de sessão vira erro EXPLÍCITO, nunca estado vazio silencioso
 * — e a tela sabe distinguir isto de "banco fora" (critério 5 do CONTAI-002):
 * "tentar de novo" nunca resolveu falta de sessão.
 */
export class SemSessaoError extends Error {
  constructor() {
    super("Sua sessão terminou. Entre de novo para ver a obra.");
    this.name = "SemSessaoError";
  }
}

/**
 * Trava de segurança do atalho de desenvolvimento (lib/sessao.ts): só vale
 * para o stack em Docker na própria máquina. Se a URL for de qualquer outro
 * host, o atalho não aparece — é o que impede uma flag esquecida de tentar
 * entrar no projeto do Mateus.
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
 * Quem é o dono da sessão — ou erro explícito.
 *
 * Antes do CONTAI-002 esta função tentava um login automático de dev quando
 * não havia sessão. Não tenta mais: com tela de login de verdade, entrar em
 * silêncio esconderia a tela, e o portão de rota (app/_components/sessao.tsx)
 * já manda para /entrar antes de qualquer chamada de dados. O atalho de dev
 * virou botão na tela de login (lib/sessao.ts, mesma trava tripla).
 */
export async function getUsuarioId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  const id = data.session?.user.id;
  if (id) return id;

  throw new SemSessaoError();
}
