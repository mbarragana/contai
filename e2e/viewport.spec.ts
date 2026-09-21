import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

/**
 * Critério 4 do CONTAI-014, e as duas metades dele — que só valem juntas.
 *
 * 1. A meta viewport NÃO pode travar a escala (`maximum-scale`/`user-scalable`):
 *    é violação da WCAG 1.4.4, o iOS ignora a trava desde a v10 (só o Android
 *    era punido) e a meta 3 do produto pede legibilidade verificada do acervo —
 *    o que inclui dar zoom na foto de uma nota.
 * 2. Como a trava saiu, o auto-zoom do Safari volta a valer: ele dá zoom a cada
 *    foco de campo com fonte abaixo de 16px. Num registro de 8 campos isso é
 *    um pulo de tela por toque, no canteiro, com a nota na mão.
 *
 * Quem apagar só a primeira metade devolve a fricção ao fluxo que o produto
 * mais protege. Por isso as duas viram asserção, no mesmo arquivo.
 */

/** Controles que o Safari do iPhone amplia ao focar: os de DIGITAÇÃO. */
const TIPOS_SEM_DIGITACAO = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** Devolve os campos de digitação da tela que rendem abaixo de 16px. */
async function camposAbaixoDe16px(page: Page) {
  return page.evaluate((tiposIgnorados) => {
    const fora: string[] = [];
    for (const el of document.querySelectorAll("input, select, textarea")) {
      const tipo = el instanceof HTMLInputElement ? el.type : "";
      if (tiposIgnorados.includes(tipo)) continue;

      const px = Number.parseFloat(getComputedStyle(el).fontSize);
      if (px >= 16) continue;

      // Nomear o campo: mensagem de falha sem o culpado vira caça ao bug.
      const nome =
        el.getAttribute("name") ??
        el.getAttribute("placeholder") ??
        el.getAttribute("aria-label") ??
        document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ??
        el.id;
      fora.push(`${el.tagName.toLowerCase()}[${tipo || "—"}] "${nome}": ${px}px`);
    }
    return fora;
  }, [...TIPOS_SEM_DIGITACAO]);
}

test.describe("viewport e auto-zoom do Safari", () => {
  test("a meta viewport não trava a escala", async ({ page }) => {
    await page.goto("/adicionar/pagamento");

    const conteudo = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content");

    // A meta tem que existir: ausente, o iPhone renderiza em 980px de largura
    // e o app inteiro vira miniatura.
    expect(conteudo).toContain("width=device-width");
    expect(conteudo).not.toContain("maximum-scale");
    expect(conteudo).not.toContain("user-scalable");
  });

  test("nenhum campo de digitação do registro de pagamento fica abaixo de 16px", async ({
    page,
  }) => {
    await page.goto("/adicionar/pagamento");
    await expect(
      page.getByRole("heading", { name: "Registrar pagamento" }),
    ).toBeVisible();

    expect(await camposAbaixoDe16px(page)).toEqual([]);
  });

  test("nenhum campo de digitação do registro de documento fica abaixo de 16px", async ({
    page,
  }) => {
    await page.goto("/adicionar/documento");
    await expect(
      page.getByRole("heading", { name: "Registrar documento" }),
    ).toBeVisible();

    expect(await camposAbaixoDe16px(page)).toEqual([]);
  });
});
