import { defineConfig, devices } from "@playwright/test";

const PORTA = 3100;
const BASE_URL = `http://localhost:${PORTA}`;

/**
 * E2E do fluxo de ingestão. O Supabase é stubado no nível HTTP (e2e/stub.ts):
 * a migration ainda não está aplicada no projeto remoto e o app exige sessão.
 * Quando o banco estiver migrado, o mesmo fluxo deve ser repetido contra ele.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
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
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Não depende do .env.local do Mateus: o backend é stub.
      NEXT_PUBLIC_SUPABASE_URL: "https://stub.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e",
    },
  },
});
