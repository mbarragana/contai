import { defineConfig, devices } from "@playwright/test";

import { CHAVE_PUBLICAVEL_LOCAL, URL_SUPABASE_LOCAL } from "./e2e/ambiente";

const PORTA = 3100;
const BASE_URL = `http://localhost:${PORTA}`;

/**
 * E2E do fluxo de ingestão contra o Supabase LOCAL em Docker: login de verdade
 * no GoTrue, escrita no Postgres com RLS ligada e upload no bucket `acervo`.
 * Exige o stack de pé (`npm run db:start`) — o globalSetup dá `db reset` antes
 * de tudo.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Um banco, um usuário: paralelismo faria um teste ver as linhas do outro.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // No CI sai também o HTML, que é o que o workflow guarda como artefato
  // quando quebra — "list" sozinho não deixa nada para depurar depois.
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: BASE_URL,
    // Canteiro, uma mão livre: 375px é o alvo do ticket.
    ...devices["iPhone SE"],
    viewport: { width: 375, height: 812 },
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- --port ${PORTA}`,
    url: BASE_URL,
    // Nunca reaproveitar servidor alheio: um `npm run dev` já aberto aponta
    // para o projeto REMOTO (.env.local) e o teste passaria a gravar lá.
    // Porta ocupada tem que falhar alto.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: URL_SUPABASE_LOCAL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE_PUBLICAVEL_LOCAL,
    },
  },
});
