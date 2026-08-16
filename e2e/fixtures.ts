import { test as base } from "@playwright/test";

import { CHAVE_OBRA_ATIVA } from "../lib/obra-ativa";
import { OBRA_ID_SEED } from "./ambiente";
import { entrar, injetarSessao, limpar, type Db } from "./banco";

/**
 * Fixture única do E2E: login real, sessão injetada no browser, obra ativa
 * conhecida e banco limpo antes e depois de cada teste.
 *
 * `auto: true` porque nenhum teste deste projeto faz sentido sem sessão — o
 * app trata ausência de sessão como erro explícito (SemSessaoError), não como
 * estado vazio.
 */
export interface Fixtures {
  /** Postgres local visto pela MESMA identidade que o app usa no browser. */
  db: Db;
}

export interface Opcoes {
  /**
   * Preferência de obra ativa no aparelho. `null` simula celular novo/storage
   * limpo — o estado em que o app tem de abrir a lista e NÃO escolher obra
   * nenhuma (critérios 6 e 16). Use `test.use({ obraAtiva: null })`.
   */
  obraAtiva: string | null;
  /**
   * `false` deixa o browser SEM sessão — é o estado em que os testes de login
   * (CONTAI-002) precisam rodar. Use `test.use({ sessao: false })`.
   *
   * O `db` continua logado de qualquer jeito: ele é o olho do teste sobre o
   * estado gravado, e precisa enxergar as linhas que o app não pode enxergar.
   */
  sessao: boolean;
}

export const test = base.extend<Fixtures & Opcoes>({
  obraAtiva: [OBRA_ID_SEED, { option: true }],
  sessao: [true, { option: true }],

  db: [
    async ({ page, obraAtiva, sessao: comSessao }, use) => {
      // Login por teste (e não por worker): cada um recebe o seu refresh
      // token, então a rotação de token de um não invalida a sessão do outro.
      const { db, sessao } = await entrar();
      await limpar(db);
      if (comSessao) await injetarSessao(page, sessao);

      if (obraAtiva !== null) {
        // O init script roda a CADA navegação: sem a guarda, ele desfaria a
        // troca de obra feita pelo teste na navegação seguinte — e um teste de
        // obra ativa que reescreve a obra ativa não prova nada.
        await page.addInitScript(
          ([chave, valor]) => {
            if (!window.localStorage.getItem(chave)) {
              window.localStorage.setItem(chave, valor);
            }
          },
          [CHAVE_OBRA_ATIVA, obraAtiva] as [string, string],
        );
      }

      await use(db);

      await limpar(db);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
