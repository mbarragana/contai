import type { Page } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { COOKIE_SESSAO } from "../lib/auth";
import type { Database, TablesInsert } from "../lib/database.types";
import {
  BUCKET_ACERVO,
  CHAVE_PUBLICAVEL_LOCAL,
  EMAIL_SEED,
  OBRA_ID_SEED,
  OBRA_SEED,
  SENHA_SEED,
  URL_SUPABASE_LOCAL,
  USER_ID_SEED,
} from "./ambiente";

/**
 * Acesso ao Postgres local a partir do teste — com a MESMA identidade e a
 * MESMA RLS que o app usa no browser. Nada de service key: se a policy impede
 * o app, tem que impedir o teste também.
 */

export type Db = SupabaseClient<Database>;

/** Filtro obrigatório do PostgREST para DELETE; casa com todas as linhas. */
const NENHUM_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Login de verdade no GoTrue local. Sessão em memória (`persistSession:
 * false`): quem persiste é o browser, com o JSON que sai daqui.
 */
export async function entrar(): Promise<{ db: Db; sessao: Session }> {
  const db = createClient<Database>(
    URL_SUPABASE_LOCAL,
    CHAVE_PUBLICAVEL_LOCAL,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { data, error } = await db.auth.signInWithPassword({
    email: EMAIL_SEED,
    password: SENHA_SEED,
  });
  if (error || !data.session) {
    throw new Error(
      `Login falhou em ${URL_SUPABASE_LOCAL} como ${EMAIL_SEED}: ` +
        `${error?.message ?? "sem sessão"}. ` +
        "O stack local do Supabase está de pé? `npm run db:start`",
    );
  }
  return { db, sessao: data.session };
}

/**
 * Põe a sessão real nos COOKIES do browser (a sessão saiu do localStorage no
 * CONTAI-002, por causa do ITP do Safari).
 *
 * O formato do cookie NÃO é montado aqui. Quem o produz é o próprio
 * `@supabase/ssr`: um client de servidor com um `setAll` que apenas captura o
 * que a biblioteca decidiu escrever — nome, chunking (`.0`/`.1`) e encoding
 * base64url saem dela. Replicar isso à mão seria inventar um formato e
 * validar a suposição de quem escreveu o teste, que é o que a regra dura de
 * E2E do projeto proíbe.
 *
 * A sessão em si vem de um login de verdade no GoTrue (`entrar()`): sessão
 * inventada não passaria pela RLS do Postgres.
 */
export async function cookiesDaSessao(
  sessao: Session,
): Promise<{ name: string; value: string; path: string }[]> {
  const capturados: { name: string; value: string; path: string }[] = [];

  const escritor = createServerClient(URL_SUPABASE_LOCAL, CHAVE_PUBLICAVEL_LOCAL, {
    cookieOptions: { name: COOKIE_SESSAO },
    cookies: {
      getAll: () => [],
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) {
          capturados.push({ name, value, path: options?.path ?? "/" });
        }
      },
    },
  });

  const { error } = await escritor.auth.setSession({
    access_token: sessao.access_token,
    refresh_token: sessao.refresh_token,
  });
  if (error) throw new Error(`setSession para cookie falhou: ${error.message}`);
  if (capturados.length === 0) {
    throw new Error(
      "@supabase/ssr não escreveu cookie nenhum — a API de storage mudou?",
    );
  }
  return capturados;
}

/** Planta a sessão no contexto do browser, antes da primeira navegação. */
export async function injetarSessao(page: Page, sessao: Session) {
  const cookies = await cookiesDaSessao(sessao);
  await page.context().addCookies(
    cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: "localhost",
      path: c.path,
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );
}

function conferir(rotulo: string, error: { message: string } | null) {
  if (error) throw new Error(`${rotulo}: ${error.message}`);
}

/**
 * Estado conhecido antes (e depois) de cada teste: só a obra do seed, sem
 * documento, pagamento nem favorecido.
 *
 * As obras criadas por teste caem, e a do seed é RECRIADA se sumiu — o teste
 * do critério 12 (nenhuma obra cadastrada) precisa apagar todas, e sem esta
 * restauração ele deixaria o banco sem obra para o próximo.
 * `pagamento_documento` já cairia por cascade, mas apagar explícito deixa o
 * erro no lugar certo se a policy do vínculo mudar.
 */
export async function limpar(db: Db) {
  conferir(
    "limpar pagamento_documento",
    (await db.from("pagamento_documento").delete().neq("pagamento_id", NENHUM_ID))
      .error,
  );
  conferir(
    "limpar pagamento",
    (await db.from("pagamento").delete().neq("id", NENHUM_ID)).error,
  );
  conferir(
    "limpar documento",
    (await db.from("documento").delete().neq("id", NENHUM_ID)).error,
  );
  conferir(
    "limpar favorecido",
    (await db.from("favorecido").delete().neq("id", NENHUM_ID)).error,
  );
  conferir(
    "limpar obras de teste",
    (await db.from("obra").delete().neq("id", OBRA_ID_SEED)).error,
  );
  conferir(
    "restaurar obra do seed",
    (await db.from("obra").upsert(OBRA_SEED, { onConflict: "id" })).error,
  );
}

/** Obra extra do cenário. Sem `cno` para o caso "obra sem CNO". */
export async function criarObra(
  db: Db,
  linha: Partial<TablesInsert<"obra">> & { nome: string },
): Promise<string> {
  const { data, error } = await db
    .from("obra")
    .insert({ data_inicio_obra: "2026-03-15", ...linha })
    .select("id")
    .single();
  conferir("criar obra", error);
  return data!.id;
}

export async function obras(db: Db) {
  const { data, error } = await db
    .from("obra")
    .select("*")
    .order("created_at", { ascending: true });
  conferir("ler obra", error);
  return data!;
}

// ── Inserções de cenário ─────────────────────────────────────────────────
// `user_id` sai do default `auth.uid()` — o mesmo caminho do app.

export async function criarFavorecido(
  db: Db,
  linha: TablesInsert<"favorecido">,
): Promise<string> {
  const { data, error } = await db
    .from("favorecido")
    .insert(linha)
    .select("id")
    .single();
  conferir("criar favorecido", error);
  return data!.id;
}

/** `obra_id` do seed por padrão; `arquivo_path` é obrigatório no schema. */
export async function criarDocumento(
  db: Db,
  linha: Omit<TablesInsert<"documento">, "obra_id" | "arquivo_path"> &
    Partial<Pick<TablesInsert<"documento">, "obra_id" | "arquivo_path">>,
): Promise<string> {
  const { data, error } = await db
    .from("documento")
    .insert({
      obra_id: OBRA_ID_SEED,
      arquivo_path: `${USER_ID_SEED}/documento/cenario.pdf`,
      ...linha,
    })
    .select("id")
    .single();
  conferir("criar documento", error);
  return data!.id;
}

export async function criarPagamento(
  db: Db,
  linha: Omit<TablesInsert<"pagamento">, "obra_id"> &
    Partial<Pick<TablesInsert<"pagamento">, "obra_id">>,
): Promise<string> {
  const { data, error } = await db
    .from("pagamento")
    .insert({ obra_id: OBRA_ID_SEED, ...linha })
    .select("id")
    .single();
  conferir("criar pagamento", error);
  return data!.id;
}

// ── Leituras de verificação ──────────────────────────────────────────────

export async function documentos(db: Db) {
  const { data, error } = await db
    .from("documento")
    .select("*")
    .order("created_at", { ascending: true });
  conferir("ler documento", error);
  return data!;
}

export async function pagamentos(db: Db) {
  const { data, error } = await db
    .from("pagamento")
    .select("*")
    .order("created_at", { ascending: true });
  conferir("ler pagamento", error);
  return data!;
}

export async function favorecidos(db: Db) {
  const { data, error } = await db
    .from("favorecido")
    .select("*")
    .order("created_at", { ascending: true });
  conferir("ler favorecido", error);
  return data!;
}

/**
 * Nomes dos objetos no acervo, dentro da pasta do dono. É o bucket real: se a
 * policy de storage barrar a escrita, a lista volta vazia e o teste acusa.
 */
export async function arquivosNoAcervo(
  db: Db,
  pasta: "documento" | "comprovante",
): Promise<string[]> {
  const { data, error } = await db.storage
    .from(BUCKET_ACERVO)
    .list(`${USER_ID_SEED}/${pasta}`);
  conferir("listar acervo", error);
  return (data ?? []).map((o) => o.name);
}
