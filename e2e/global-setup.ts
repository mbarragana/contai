import { execFileSync } from "node:child_process";

import { URL_SUPABASE_LOCAL } from "./ambiente";

/**
 * Estado conhecido para a suíte inteira: recria o schema (migrations 0001-0003)
 * e roda supabase/seed.sql, que cria o usuário e a obra — as duas coisas que o
 * app exige e para as quais ainda não existe tela.
 *
 * A limpeza linha-a-linha entre testes fica em e2e/fixtures.ts; o reset aqui é
 * a garantia de que nem uma execução interrompida antes deixa lixo para trás.
 */
export default function globalSetup() {
  try {
    execFileSync("npx", ["supabase", "db", "reset"], {
      stdio: "inherit",
      timeout: 300_000,
    });
  } catch (erro) {
    throw new Error(
      "`supabase db reset` falhou — o E2E roda contra o Postgres local, não " +
        `contra o projeto do Mateus. Suba o stack (${URL_SUPABASE_LOCAL}) com ` +
        `\`npm run db:start\` e tente de novo.\nCausa: ${String(erro)}`,
    );
  }
}
