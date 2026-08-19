/**
 * Coordenadas do stack LOCAL do Supabase (Docker, `npm run db:start`).
 *
 * Este arquivo é importado pelo playwright.config.ts, então não pode puxar
 * dependência pesada — só constantes.
 */

/** Porta 5433x: o stack do bro-surf-report-2 usa 5432x na mesma máquina. */
export const URL_SUPABASE_LOCAL = "http://127.0.0.1:54331";

/**
 * anon/publishable key do stack local. É pública e DETERMINÍSTICA — o CLI a
 * deriva do JWT secret padrão de desenvolvimento, então é literalmente a mesma
 * string em qualquer máquina que rode `supabase start` (conferido contra o
 * stack do bro-surf-report-2). Versionar esta chave é seguro.
 *
 * A chave do projeto REMOTO nunca entra aqui: ela vive só no .env.local, que
 * está no .gitignore.
 */
export const CHAVE_PUBLICAVEL_LOCAL =
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

// ── Usuário e obra criados por supabase/seed.sql ─────────────────────────
// Não existem telas de login nem de cadastro de obra; o seed supre as duas.
export const EMAIL_SEED = "mateus@contai.local";
export const SENHA_SEED = "contai-local-123";
export const USER_ID_SEED = "11111111-1111-4111-8111-111111111111";
export const OBRA_ID_SEED = "22222222-2222-4222-8222-222222222222";

/**
 * A obra do seed, campo a campo — o `limpar` de cada teste recria esta linha
 * quando um teste a apaga (o caso "nenhuma obra cadastrada", critério 12).
 * Tem de bater com supabase/seed.sql; se divergir, o teste que confere o
 * acumulado do imóvel acusa.
 *
 * ⚠️ CONTAI-010: `valor_terreno`, `valor_itbi` e `valor_escritura_registro`
 * MORRERAM na migration 0008 — e morreram sem virar nada. **Não houve
 * backfill**: os três valores foram DESCARTADOS (autorização do Mateus em
 * 2026-08-19), e ele redigita cada um em `terreno_desembolso` com a data certa,
 * que é o dado que as colunas nunca tiveram. `natureza_aquisicao_terreno` nasce
 * NULL — pendência de complemento, que é o estado real da obra depois da
 * migration.
 */
export const OBRA_SEED = {
  id: OBRA_ID_SEED,
  nome: "Casa Cachoeira",
  cno: "12.345.67890/26",
  matricula: "38.104",
  cartorio: "1º Ofício de Registro de Imóveis",
  municipio: "Florianópolis",
  data_inicio_obra: "2025-11-04",
  cno_registrado_em: "2025-11-20",
  unidades_autonomas: 1,
  origem_desmembramento_loteamento: false,
  /**
   * ⚠️ Explicitamente NULL, e a explicitação é o que importa: sem esta chave a
   * coluna some do `on conflict do update` do `limpar`, e a natureza que um
   * teste gravou VAZA para o próximo. Foi assim que o teste da lista cheia de
   * tipos de desembolso viu a lista filtrada de "financiado" do teste anterior.
   * Toda coluna da obra que um teste possa escrever tem de estar aqui.
   */
  natureza_aquisicao_terreno: null,
} as const;

export const BUCKET_ACERVO = "acervo";
