import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  PREVIEW_INDISPONIVEL,
  VER_DOCUMENTO_LARGA,
  VER_DOCUMENTO_PISO,
  XML_SEM_PREVIEW,
} from "../lib/preview-anexo";

/**
 * **CONTAI-048 em TELA LARGA (1280×800, ponteiro de mouse)** — o cenário do
 * ticket: em casa, sentado, conferindo a nota contra o formulário antes de
 * salvar.
 *
 * O que só este projeto pode provar (`Desktop Safari`, sem toque): que o PDF
 * é EMBUTIDO aqui, com o visualizador nativo, e que a miniatura da imagem
 * cresceu no rail. O par estreito/touch — onde o mesmo PDF vira aba nova, e é
 * por isso que o critério 3 existe — fica em `anexo-no-piso.spec.ts`.
 *
 * ⚠️ **O que nem este teste nem o CI provam**: como o Safari do iPhone se
 * comporta com um PDF de verdade. O `webkit` do Playwright roda em Linux e não
 * tem visualizador de PDF nenhum — ele prova a PRIMITIVA escolhida
 * (`<object>` × `<a target="_blank">`), nunca o que aparece dentro dela. A
 * validação manual em iPhone + macOS Safari continua listada no ticket.
 */

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const imagem = () => ({
  name: "foto-nota-empreiteira.png",
  mimeType: "image/png",
  buffer: PNG_1X1,
});

const pdf = () => ({
  name: "nf-servico-1234.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 contai 048"),
});

const xml = () => ({
  name: "nfe-33240112345.xml",
  mimeType: "text/xml",
  buffer: Buffer.from("<nfeProc></nfeProc>"),
});

/**
 * ⚠️ Esperar o formulário APARECER antes de anexar, e não só navegar: o
 * primeiro teste da suíte paga a compilação da rota pelo `next dev`, e um
 * `setInputFiles` disparado antes disso estoura o timeout com a cara de bug do
 * produto (mesma nota de `cno.spec.ts`, e foi o que aconteceu aqui na primeira
 * rodada).
 */
async function irParaFormulario(page: Page) {
  await page.goto("/adicionar/documento");
  // ⚠️ Timeout próprio, acima dos 5 s padrão do `expect`: o PRIMEIRO teste a
  // abrir esta rota paga a compilação dela pelo `next dev`, que sozinha passa
  // dos 5 s numa máquina fria. Sem isto o arquivo fica verde na suíte inteira
  // (onde outro spec já compilou) e vermelho quando rodado sozinho — flake com
  // cara de bug do produto.
  await expect(
    page.getByRole("heading", { name: "Registrar documento" }),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe("ver o anexo ao lado do formulário", () => {
  /** Estado A — nada anexado, nada a mostrar: a caixa vazia não vale o espaço. */
  test("sem arquivo não existe controle de visualização", async ({ page }) => {
    await irParaFormulario(page);
    await expect(page.getByLabel("Arquivo")).toBeVisible();
    await expect(
      page.getByRole("button", { name: VER_DOCUMENTO_LARGA }),
    ).toHaveCount(0);
    await expect(page.locator('[data-miniatura="anexo"]')).toHaveCount(0);
  });

  /**
   * Estado B — a miniatura da imagem cresce (120px), e é ela que responde "é
   * este o papel". Ler CNPJ/valor continua sendo trabalho do Lightbox.
   */
  test("imagem ganha miniatura grande no rail, do arquivo local", async ({
    page,
  }) => {
    await irParaFormulario(page);
    await page.getByLabel("Arquivo").setInputFiles(imagem());

    const miniatura = page.locator('[data-miniatura="anexo"]');
    await expect(miniatura).toBeVisible();
    // Blob URL: sem migration, sem subir o arquivo de novo, sem round-trip.
    expect(await miniatura.getAttribute("src")).toMatch(/^blob:/);
    const caixa = (await miniatura.boundingBox())!;
    expect(Math.round(caixa.height)).toBe(120);
    // A miniatura de 52×52 do CONTAI-047 não sobrevive ao lado dela.
    expect(caixa.width).toBeGreaterThan(200);
  });

  /**
   * Estado E — o Lightbox é onde o documento fica legível. Abre por clique,
   * fecha por Esc, e o formulário continua montado atrás com tudo digitado.
   */
  test("o Lightbox abre a imagem, amplia e fecha sem perder o formulário", async ({
    page,
  }) => {
    await irParaFormulario(page);
    await page.getByLabel("Arquivo").setInputFiles(imagem());
    await page
      .getByLabel("Emitente", { exact: true })
      .fill("Casa do Construtor");

    await page.getByRole("button", { name: VER_DOCUMENTO_LARGA }).click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("foto-nota-empreiteira.png");
    await expect(
      modal.getByRole("img", { name: /Documento anexado/ }),
    ).toBeVisible();

    // O toggle de zoom só existe para imagem, e só depois de ela carregar.
    const zoom = modal.locator("[data-lightbox-zoom]");
    await expect(zoom).toHaveText("Ampliar (100%)");
    await zoom.click();
    await expect(zoom).toHaveText("Ajustar");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // Overlay por cima da grade, não rota: nada do que foi digitado se perde.
    await expect(page.getByLabel("Emitente", { exact: true })).toHaveValue(
      "Casa do Construtor",
    );
  });

  /**
   * Estado C — PDF fica com ícone no rail (thumbnail no cliente exigiria lib
   * nova), e o "Ver documento" vem ACIMA do "Extrair dados": ver o papel antes
   * de rodar IA sobre ele.
   */
  test("PDF embute o visualizador nativo e o botão vem antes da extração", async ({
    page,
  }) => {
    await irParaFormulario(page);
    await page.getByLabel("Arquivo").setInputFiles(pdf());

    await expect(page.locator('[data-miniatura="anexo"]')).toHaveCount(0);

    const ver = page.getByRole("button", { name: VER_DOCUMENTO_LARGA });
    const extrair = page.getByRole("button", { name: /Extrair dados da nota/ });
    expect((await ver.boundingBox())!.y).toBeLessThan(
      (await extrair.boundingBox())!.y,
    );

    await ver.click();
    const modal = page.getByRole("dialog");
    // ⚠️ Em tela larga/mouse o PDF é EMBUTIDO — é a metade do critério 3 que
    // vale aqui. No piso ele vira `<a target="_blank">`, provado no outro
    // arquivo.
    const objeto = modal.locator("[data-lightbox-pdf]");
    await expect(objeto).toHaveCount(1);
    expect(await objeto.getAttribute("type")).toBe("application/pdf");
    expect(await objeto.getAttribute("data")).toMatch(/^blob:/);
    // Sem toggle de zoom: quem dá zoom no PDF é o visualizador do navegador.
    await expect(modal.locator("[data-lightbox-zoom]")).toHaveCount(0);

    // Fecha por clique fora.
    await page
      .locator('[data-lightbox="anexo"]')
      .click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  /** Estado D — XML não ganha preview, e a tela diz por quê. */
  test("XML não ganha botão nenhum, e a ausência é explicada", async ({
    page,
  }) => {
    await irParaFormulario(page);
    await page.getByLabel("Arquivo").setInputFiles(xml());

    await expect(page.getByText(XML_SEM_PREVIEW)).toBeVisible();
    await expect(
      page.getByRole("button", { name: VER_DOCUMENTO_LARGA }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: VER_DOCUMENTO_PISO, exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('[data-miniatura="anexo"]')).toHaveCount(0);
  });

  /**
   * **Critério 2 — preview que falha NÃO é gate.** Arquivo que se diz imagem e
   * não abre cai no aviso + download, dentro do próprio Lightbox, e o
   * formulário continua salvável.
   */
  test("imagem ilegível cai no fallback, sem virar erro de tela", async ({
    page,
  }) => {
    await irParaFormulario(page);
    await page.getByLabel("Arquivo").setInputFiles({
      name: "foto-corrompida.png",
      mimeType: "image/png",
      buffer: Buffer.from("isto não é um PNG"),
    });

    await page.getByRole("button", { name: VER_DOCUMENTO_LARGA }).click();
    const modal = page.getByRole("dialog");
    await expect(modal.getByText(PREVIEW_INDISPONIVEL)).toBeVisible();
    await expect(
      modal.getByRole("link", { name: "Baixar arquivo" }),
    ).toHaveAttribute("download", "foto-corrompida.png");
    // Nada de `role="alert"` DENTRO do modal: falha de preview não é erro do
    // usuário nem da gravação, e não se anuncia como se fosse. (Fora do modal
    // a asserção seria inútil — o overlay de dev do Next tem um `alert` seu.)
    await expect(modal.getByRole("alert")).toHaveCount(0);

    await modal.getByRole("button", { name: "Fechar" }).click();
    await expect(
      page.getByRole("button", { name: "Salvar registro" }),
    ).toBeEnabled();
  });
});
