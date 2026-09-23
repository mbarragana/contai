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
  // O runner do GitHub roda a suíte em ~5,1 min contra ~2,2 min na máquina do
  // Mateus. Os 5s padrão do `expect` são folgados aqui e apertados lá; medido
  // no run 32640902865.
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  // No CI sai também o HTML, que é o que o workflow guarda como artefato
  // quando quebra — "list" sozinho não deixa nada para depurar depois.
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  /**
   * Dois projetos, DOIS CENÁRIOS — a tabela do `CLAUDE.md` (correção de
   * 2026-08-18), não dois navegadores.
   *
   * ⚠️ Os dois rodam em **webkit**: `iPhone SE` já era webkit e `Desktop
   * Safari` também é. O CI instala webkit e só ele (`.github/workflows/ci.yml`)
   * — um projeto em chromium viraria 1 teste vermelho sem explicação lá.
   *
   * ⚠️ `workers: 1`, `fullyParallel: false` e o `globalSetup` continuam
   * valendo para os dois: é um banco só, com um usuário só, e o `db reset`
   * roda uma vez antes de tudo.
   */
  projects: [
    {
      name: "mobile",
      // Canteiro, uma mão livre: 375px é o PISO do produto, e é aqui que ele
      // é provado. Toda a suíte de comportamento mora neste projeto.
      use: { ...devices["iPhone SE"], viewport: { width: 375, height: 812 } },
      testIgnore: /(shell-desktop|anexo-desktop)\.spec\.ts/,
    },
    {
      name: "desktop",
      // Gestão, em casa, sentado (CONTAI-040). Testes de LAYOUT e NAVEGAÇÃO —
      // não uma segunda cópia da suíte: comportamento se prova uma vez, no
      // piso de 375px, onde mora toda a suíte de `mobile`.
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } },
      // ⚠️ Dois arquivos, e o segundo entrou com o CONTAI-048: o preview do
      // anexo muda de PRIMITIVA por dispositivo de entrada (`<object>` no
      // mouse, aba nova no dedo), então ele é dos poucos comportamentos que
      // precisam ser provados nas DUAS larguras — o par mobile fica em
      // `anexo-no-piso.spec.ts`, no projeto de cima.
      testMatch: /(shell-desktop|anexo-desktop)\.spec\.ts/,
    },
  ],
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
      // Fixado em "0" porque o env do webServer herda o shell: com a flag
      // exportada por acaso, o autologin daria sessão a todo teste e a injeção
      // real de sessão passaria a ser decorativa — verde pelo motivo errado.
      NEXT_PUBLIC_DEV_AUTOLOGIN: "0",
    },
  },
});
