import { execFileSync } from "node:child_process";

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

// ── Andaime: SQL de administrador no banco LOCAL ─────────────────────────
// A regra do projeto — "nada de service key: o que a policy barra para o app
// tem que barrar para o teste" — vale para o COMPORTAMENTO exercitado: cenário
// e verificação continuam passando pelo `Db` autenticado, sujeitos à mesma RLS
// do app. O que passa por aqui é outra coisa: montagem e desmontagem do
// ambiente, que o app não faz e não pode fazer.
//
// A migration 0005 tirou o DELETE de `authenticated` (o app não apaga nada, e
// "excluir pagamento" está fora de escopo pelo CONTAI-009 — acervo append-only).
// A limpeza entre testes, que APAGA, deixou portanto de ser uma operação do
// papel do app e passou a ser andaime. Manter o DELETE só para o teste seria
// devolver ao banco local uma permissão que a produção não tem — exatamente o
// ponto cego que a 0005 fechou.
//
// `docker exec ... psql` é o mesmo caminho que o `npm run db:demo` já usa; o
// nome do container sai do `project_id` do supabase/config.toml.
const CONTAINER_BANCO = "supabase_db_contai";

function literalSql(valor: string | number | boolean): string {
  return typeof valor === "string"
    ? `'${valor.replace(/'/g, "''")}'`
    : String(valor);
}

function sqlAdmin(sql: string, rotulo: string) {
  try {
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        CONTAINER_BANCO,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-q",
        "-c",
        sql,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (erro) {
    const stderr = String(
      (erro as { stderr?: Buffer | string }).stderr ?? "",
    ).trim();
    throw new Error(
      `${rotulo} falhou via psql no container ${CONTAINER_BANCO}. ` +
        "O stack local está de pé? `npm run db:start`" +
        (stderr ? `\n${stderr}` : `\n${String(erro)}`),
    );
  }
}

/** Consulta administrativa; devolve as linhas já quebradas em colunas. */
export function consultarAdmin(sql: string, rotulo: string): string[][] {
  let saida = "";
  try {
    saida = execFileSync(
      "docker",
      [
        "exec",
        "-i",
        CONTAINER_BANCO,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
        "-F",
        "|",
        "-c",
        sql,
      ],
      { encoding: "utf8" },
    );
  } catch (erro) {
    const stderr = String(
      (erro as { stderr?: Buffer | string }).stderr ?? "",
    ).trim();
    throw new Error(`${rotulo} falhou: ${stderr || String(erro)}`);
  }
  return saida
    .split("\n")
    .filter((linha) => linha.length > 0)
    .map((linha) => linha.split("|"));
}

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
 * A obra do seed montada a partir da MESMA constante que os testes afirmam
 * (`OBRA_SEED`), e não de um literal SQL paralelo que sairia do lugar no dia
 * em que um campo mudasse. `user_id` explícito porque o psql roda fora de
 * sessão e `auth.uid()` seria null.
 */
const OBRA_SEED_COM_DONO = { user_id: USER_ID_SEED, ...OBRA_SEED };
const COLUNAS_SEED = Object.keys(OBRA_SEED_COM_DONO);

const SQL_LIMPAR = [
  "delete from pagamento_documento;",
  "delete from pagamento;",
  "delete from documento;",
  "delete from favorecido;",
  `delete from obra where id <> ${literalSql(OBRA_ID_SEED)};`,
  `insert into obra (${COLUNAS_SEED.join(", ")}) values (` +
    `${Object.values(OBRA_SEED_COM_DONO).map(literalSql).join(", ")})` +
    ` on conflict (id) do update set ` +
    COLUNAS_SEED.filter((c) => c !== "id")
      .map((c) => `${c} = excluded.${c}`)
      .join(", ") +
    ";",
].join("\n");

/**
 * Estado conhecido antes (e depois) de cada teste: só a obra do seed, sem
 * documento, pagamento nem favorecido.
 *
 * As obras criadas por teste caem, e a do seed é RECRIADA se sumiu — o teste
 * do critério 12 (nenhuma obra cadastrada) precisa apagar todas, e sem esta
 * restauração ele deixaria o banco sem obra para o próximo. O `do update`
 * existe porque há teste que EDITA a obra do seed.
 * `pagamento_documento` já cairia por cascade, mas apagar explícito deixa o
 * erro no lugar certo se o vínculo mudar.
 *
 * Roda como administrador do banco, não como o app: ver a nota do `sqlAdmin`.
 */
export function limpar() {
  sqlAdmin(SQL_LIMPAR, "limpar o banco entre testes");
}

/**
 * Conta sem obra nenhuma — o estado do primeiro acesso (critério 12).
 *
 * Não passa pelo `Db` autenticado porque o papel do app não tem (nem deve ter)
 * DELETE: chegar a este estado é montagem de cenário, não um caminho que o
 * usuário percorre na tela.
 */
export function apagarTodasAsObras() {
  sqlAdmin("delete from obra;", "apagar todas as obras");
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

/**
 * Vínculo montado direto no banco, pelo MESMO client autenticado — cenário de
 * "isto já estava ligado antes de o Mateus abrir a tela", não comportamento
 * sob teste.
 */
export async function criarVinculo(
  db: Db,
  pagamentoId: string,
  documentoId: string,
): Promise<void> {
  const { error } = await db
    .from("pagamento_documento")
    .insert({ pagamento_id: pagamentoId, documento_id: documentoId });
  conferir("criar vínculo", error);
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

/**
 * As linhas de vínculo, pelo MESMO client autenticado do app (critério 16): a
 * policy `dono_vinculo` da migration 0001 tem de valer para o teste também.
 * Se ela barrasse, a lista voltaria vazia e o teste acusaria — que é
 * exatamente o que se quer provar sobre o estado gravado.
 */
export async function vinculos(db: Db) {
  const { data, error } = await db
    .from("pagamento_documento")
    .select("*")
    .order("documento_id", { ascending: true });
  conferir("ler vínculo", error);
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
