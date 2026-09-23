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

  /**
   * ⚠️ **CONTAI-047, critério 10 — o canteiro não paga a conta do desktop.**
   *
   * O ticket foi explícito: *"375px continua sendo piso obrigatório TESTADO,
   * não só 'não quebra'"* — ao contrário do que a 2ª correção de cenários fez
   * com as telas de gestão. Este teste é a prova, e mora aqui porque o projeto
   * `mobile` é o único que roda no piso.
   *
   * O que ele trava é o acordo escrito na Decisão 5 de
   * `design/mocks/captura-no-desktop-v1.md`: abaixo de 880px **só o anexo
   * sobe** para cima do formulário. Resumo e stepper são LEITURA nova, e
   * leitura nova no caminho de captura é fricção no único momento em que o
   * produto promete pressa.
   *
   * Quem trocar um `hidden larga:*` por um `larga:*` solto fica vermelho aqui,
   * e não na mão do Mateus com a nota molhada no canteiro.
   */
  test("no piso de 375px a captura não ganha leitura nova — só o anexo sobe", async ({
    page,
  }) => {
    await page.goto("/adicionar/documento");
    await expect(
      page.getByRole("heading", { name: "Registrar documento" }),
    ).toBeVisible();

    // O stepper decorativo e o resumo do rail existem SÓ em tela larga.
    //
    // ⚠️ A asserção é sobre o que se VÊ, não sobre o que está no DOM: os dois
    // somem por `display:none` (`hidden larga:*`), que é o mesmo mecanismo da
    // sidebar do shell de gestão e tira o nó da árvore de acessibilidade
    // também. `toHaveCount(0)` cobraria uma renderização condicional em JS que
    // o app não usa em lugar nenhum — e reprovaria por um motivo falso.
    await expect(page.locator("[data-stepper]")).toBeHidden();
    await expect(page.getByText("Resumo até agora")).toBeHidden();
    await expect(
      page.getByText("ainda não respondido").locator("visible=true"),
    ).toHaveCount(0);

    // E o anexo continua onde sempre esteve: antes do formulário, primeira
    // coisa a responder. `data-captura="rail"` é o contêiner dele no piso.
    const rail = page.locator('[data-captura="rail"]');
    const formulario = page.locator('[data-captura="formulario"]');
    await expect(rail.locator('[data-campo="arquivo"]')).toBeVisible();

    const doAnexo = (await rail.boundingBox())!;
    const doFormulario = (await formulario.boundingBox())!;
    expect(doAnexo.y).toBeLessThan(doFormulario.y);
    // Empilhados, não lado a lado: no piso não há duas colunas.
    expect(Math.round(doAnexo.x)).toBe(Math.round(doFormulario.x));
  });
});
