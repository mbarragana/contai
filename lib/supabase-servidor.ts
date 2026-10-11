/**
 * **CONTAI-092 — a PRIMEIRA leitura do banco pelo SERVIDOR Next** (dívida D-c do
 * ticket).
 *
 * Até aqui toda gravação do app era `"use client"` → `lib/data.ts` → PostgREST
 * com o client do browser, e o servidor Next existia só no `proxy.ts` e nas duas
 * rotas de `app/api/{extrair-documento,sugerir-retencao}`, que não tocam o banco.
 * O refresh token do Google **não pode chegar ao browser**, então a chamada ao
 * Google é obrigatoriamente Route Handler — e daí a necessidade deste módulo.
 *
 * ⚠️ **A receita é a MESMA do `proxy.ts`** (`createServerClient` + cookie
 * `contai-auth`/`COOKIE_SESSAO`), de propósito: dois jeitos de montar sessão no
 * servidor divergiriam, e o jeito que divergisse seria o que ninguém testa. O
 * formato do cookie continua sendo da biblioteca — nunca montado à mão.
 *
 * ⚠️ **A RLS continua sendo a guarda dos dados.** Isto NÃO é um client com
 * service key: ele assume o papel `authenticated` do próprio Mateus, com as
 * mesmas policies do browser. O que a policy barra para o app, barra aqui.
 *
 * ⚠️ **Rota responde 401; o `proxy.ts` responde 307.** O proxy protege rota de
 * TELA mandando para `/entrar` — resposta errada para uma chamada `fetch` de
 * rota, que receberia um HTML de login com status 200 e o trataria como sucesso.
 * Por isso quem valida a sessão das rotas novas é `usuarioDaRequisicao`, e a
 * resposta é 401 explícito.
 *
 * ⚠️ **Padrão para toda rota futura que ler o banco pelo servidor** — e isso
 * precisa de uma linha no `CLAUDE.md` quando entrar em produção (ação de
 * documentação registrada no ticket, não critério de código).
 */

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { COOKIE_SESSAO } from "@/lib/auth";
import type { Database } from "@/lib/database.types";

export type ClienteServidor = SupabaseClient<Database>;

/**
 * Client do servidor, autenticado pelo cookie de sessão da requisição.
 * `null` quando o app não está configurado — a rota devolve 503 e diz o que
 * falta, em vez de estourar um erro cru.
 */
export async function clienteDoServidor(): Promise<ClienteServidor | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const jar = await cookies();

  return createServerClient<Database>(url, key, {
    cookieOptions: { name: COOKIE_SESSAO },
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(lista) {
        // A renovação do access token no meio de uma rota tenta regravar o
        // cookie. Em Route Handler isso é permitido; num contexto onde não for,
        // o `try` evita derrubar a requisição por causa da gravação de cookie —
        // quem renova de verdade, a cada navegação, é o `proxy.ts`.
        try {
          for (const { name, value, options } of lista) {
            jar.set(name, value, options);
          }
        } catch {
          // Contexto somente-leitura: segue com o token que já está em mão.
        }
      },
    },
  });
}

export interface Autenticado {
  supabase: ClienteServidor;
  userId: string;
}

/**
 * Quem é o dono desta requisição — ou `null`.
 *
 * `getUser()` e não `getSession()`: o primeiro valida o token no GoTrue, o
 * segundo acredita no que está no cookie. Para decidir se uma rota pode escrever
 * credencial de Google na conta de alguém, acreditar no cookie não serve.
 */
export async function usuarioDaRequisicao(): Promise<Autenticado | null> {
  const supabase = await clienteDoServidor();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, userId: data.user.id };
}
