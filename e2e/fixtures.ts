import { test as base } from "@playwright/test";

import { entrar, injetarSessao, limpar, type Db } from "./banco";

/**
 * Fixture única do E2E: login real, sessão injetada no browser e banco limpo
 * antes e depois de cada teste.
 *
 * `auto: true` porque nenhum teste deste projeto faz sentido sem sessão — o
 * app trata ausência de sessão como erro explícito (SemSessaoError), não como
 * estado vazio.
 */
export interface Fixtures {
  /** Postgres local visto pela MESMA identidade que o app usa no browser. */
  db: Db;
}

export const test = base.extend<Fixtures>({
  db: [
    async ({ page }, use) => {
      // Login por teste (e não por worker): cada um recebe o seu refresh
      // token, então a rotação de token de um não invalida a sessão do outro.
      const { db, sessao } = await entrar();
      await limpar(db);
      await injetarSessao(page, sessao);

      await use(db);

      await limpar(db);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
