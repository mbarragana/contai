import type { Page, Route } from "@playwright/test";

/**
 * Stub HTTP do Supabase para o E2E: sessão em localStorage + respostas do
 * PostgREST e do Storage. Espelha o contrato usado em lib/data.ts.
 */

export const URL_SUPABASE = "https://stub.supabase.co";
export const USER_ID = "11111111-1111-4111-8111-111111111111";
export const OBRA_ID = "22222222-2222-4222-8222-222222222222";

export const OBRA = {
  id: OBRA_ID,
  nome: "Casa Cachoeira",
  cno: "12.345.67890/26",
  matricula: null,
  cartorio: null,
  municipio: "Florianópolis",
  valor_terreno: "800000.00",
  created_at: "2026-01-02T10:00:00Z",
};

export interface DadosStub {
  obra?: typeof OBRA | null;
  documentos?: Record<string, unknown>[];
  pagamentos?: Record<string, unknown>[];
  vinculos?: Record<string, unknown>[];
  favorecidos?: Record<string, unknown>[];
  /** Faz o PostgREST responder 500 — para exercitar o estado de erro. */
  falhar?: boolean;
}

export interface Capturas {
  documentos: Record<string, unknown>[];
  pagamentos: Record<string, unknown>[];
  uploads: string[];
}

function json(route: Route, corpo: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(corpo),
  });
}

/** `.single()` pede objeto; sem ele o PostgREST devolve array. */
function respostaInsert(route: Route, registro: Record<string, unknown>) {
  const aceita = route.request().headers()["accept"] ?? "";
  return json(route, aceita.includes("object") ? registro : [registro], 201);
}

export async function instalarSessao(page: Page) {
  const expiraEm = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
  const payload = Buffer.from(
    JSON.stringify({ sub: USER_ID, role: "authenticated", exp: expiraEm }),
  ).toString("base64url");
  const sessao = {
    access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.stub`,
    refresh_token: "refresh-stub",
    token_type: "bearer",
    expires_in: 60 * 60 * 24 * 365,
    expires_at: expiraEm,
    user: {
      id: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "mateus@example.com",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00Z",
    },
  };

  await page.addInitScript(
    ([chave, valor]) => {
      window.localStorage.setItem(chave as string, valor as string);
    },
    ["contai-auth", JSON.stringify(sessao)],
  );
}

export async function instalarStub(
  page: Page,
  dados: DadosStub = {},
): Promise<Capturas> {
  const capturas: Capturas = { documentos: [], pagamentos: [], uploads: [] };

  await instalarSessao(page);

  await page.route(`${URL_SUPABASE}/rest/v1/**`, async (route) => {
    const url = new URL(route.request().url());
    const tabela = url.pathname.replace("/rest/v1/", "");
    const metodo = route.request().method();

    if (dados.falhar) {
      return json(route, { message: "banco indisponível" }, 500);
    }

    if (metodo === "GET") {
      switch (tabela) {
        case "obra":
          return json(route, dados.obra === null ? [] : [dados.obra ?? OBRA]);
        case "documento":
          return json(route, dados.documentos ?? []);
        case "pagamento":
          return json(route, dados.pagamentos ?? []);
        case "pagamento_documento":
          return json(route, dados.vinculos ?? []);
        case "favorecido":
          return json(route, dados.favorecidos ?? []);
        default:
          return json(route, []);
      }
    }

    if (metodo === "POST") {
      const corpo = route.request().postDataJSON() as Record<string, unknown>;
      switch (tabela) {
        case "favorecido":
          return respostaInsert(route, { id: "fav-1", ...corpo });
        case "documento":
          capturas.documentos.push(corpo);
          return respostaInsert(route, { id: "doc-1", ...corpo });
        case "pagamento":
          capturas.pagamentos.push(corpo);
          return respostaInsert(route, { id: "pag-1", ...corpo });
        default:
          return respostaInsert(route, { id: "generico-1", ...corpo });
      }
    }

    return json(route, {}, 204);
  });

  await page.route(`${URL_SUPABASE}/storage/v1/object/**`, async (route) => {
    const caminho = new URL(route.request().url()).pathname.replace(
      "/storage/v1/object/",
      "",
    );
    capturas.uploads.push(caminho);
    return json(route, { Id: "obj-1", Key: caminho });
  });

  return capturas;
}

/** Documento pronto para as listas da home. */
export function documentoStub(over: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    obra_id: OBRA_ID,
    favorecido_id: "fav-1",
    tipo: "nf_material",
    arquivo_path: `${USER_ID}/documento/nf.pdf`,
    valor: "4850.00",
    vencimento: null,
    classificacao: "material",
    destinatario_cpf_ok: true,
    retencao_11: null,
    status: "registrado",
    motivo_quarentena: null,
    created_at: "2026-08-05T12:00:00Z",
    favorecido: { nome: "Casa do Construtor" },
    ...over,
  };
}

/** Pagamento pronto para as listas da home. */
export function pagamentoStub(over: Record<string, unknown> = {}) {
  return {
    id: "pag-1",
    obra_id: OBRA_ID,
    favorecido_id: "fav-1",
    valor: "15000.00",
    data_pagamento: "2026-08-05",
    meio: "pix",
    data_compra: null,
    comprovante_path: `${USER_ID}/comprovante/pix.png`,
    status: "aguardando_nf",
    created_at: "2026-08-05T12:00:00Z",
    favorecido: { nome: "AJE Construções" },
    ...over,
  };
}
