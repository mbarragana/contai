import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  ABRIR_PDF_EM_ABA,
  VER_DOCUMENTO_LARGA,
  VER_DOCUMENTO_PISO,
} from "../lib/preview-anexo";

/**
 * **CONTAI-048 no PISO (375px, dedo)** — Estado F do Gate 0 e a metade do
 * critério 3 que o desktop não consegue provar.
 *
 * ⚠️ **O teste que existe por causa de uma degradação SILENCIOSA.** O achado do
 * `cto-obra` (2026-09-23): `<object type="application/pdf">` no iOS não cai no
 * fallback de download — ele renderiza e trava na 1ª página, sem scroll, sem
 * toolbar e sem aviso. Um PDF de 3 páginas mostra 1. O que este arquivo trava é
 * a PRIMITIVA: em tela estreita/touch o controle do PDF é um `<a
 * target="_blank">` de verdade, dentro do gesto do toque, e nenhum `<object>`
 * nasce.
 *
 * ⚠️ O que ele NÃO prova: o que o Safari do iPhone mostra dentro da aba nova. O
 * `webkit` do Playwright roda em Linux e não tem visualizador de PDF nenhum —
 * a validação manual continua listada no ticket, e o Gate 4 não fecha sem ela.
 *
 * ⚠️ **Achado do `cto-obra` em 2026-09-23, com trace do CI**: no Linux, sem
 * visualizador, o WebKit converte a navegação do PDF em DOWNLOAD — a aba nasce
 * e nunca commita, `nova.url()` fica `""`. No Mac/iOS (com viewer nativo) a
 * navegação commita normalmente e a aba tem a URL. As duas saídas provam a
 * mesma coisa: o blob saiu do documento sem `<object>` — por isso o teste
 * abaixo aceita qualquer uma das duas.
 */

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

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

test.describe("ver o anexo no piso de 375px", () => {
  /**
   * **PDF + dedo = aba nova, nunca embutido.** É o critério 3, e é a razão de
   * o ticket ter sido corrigido depois do Gate 0.
   */
  test("PDF vira link de aba nova — nenhum `<object>` no caminho", async ({
    page,
  }) => {
    await irParaFormulario(page);
    await page.getByLabel("Arquivo").setInputFiles({
      name: "nf-servico-1234.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 contai 048"),
    });

    const abrir = page.getByRole("link", { name: ABRIR_PDF_EM_ABA });
    await expect(abrir).toBeVisible();
    expect(await abrir.getAttribute("href")).toMatch(/^blob:/);
    // `rel="noopener"`: a aba nova não ganha referência de volta para o app.
    expect(await abrir.getAttribute("rel")).toBe("noopener");

    // O toque ABRE OUTRA ABA — e não abre modal nenhum.
    // O que o motor faz com o PDF é dele: Mac/iOS renderizam (aba com URL),
    // o WebKit de Linux do CI não tem visualizador e converte em DOWNLOAD — a
    // aba nasce e nunca commita, `url()` é "". Os dois provam o mesmo: o blob
    // saiu do documento, sem `<object>`. O `download` é emitido na página de
    // origem.
    const download = page
      .waitForEvent("download", { timeout: 5_000 })
      .catch(() => null);
    const [nova] = await Promise.all([
      page.context().waitForEvent("page"),
      abrir.click(),
    ]);
    const destino = nova.url() || (await download)?.url() || "";
    expect(destino).toMatch(/^blob:/);
    await nova.close();

    await expect(page.locator('[data-lightbox="anexo"]')).toHaveCount(0);
    await expect(page.locator("[data-lightbox-pdf]")).toHaveCount(0);
  });

  /**
   * Estado F — imagem continua com o Lightbox, agora em tela cheia. O link
   * mora ao lado da linha de sucesso que já existia: sem campo novo, sem passo
   * novo no caminho de captura.
   */
  test("imagem abre o Lightbox em tela cheia, sem passo novo na captura", async ({
    page,
  }) => {
    await irParaFormulario(page);
    await page.getByLabel("Arquivo").setInputFiles({
      name: "foto-nota.png",
      mimeType: "image/png",
      buffer: PNG_1X1,
    });

    // A miniatura grande do rail é só de tela larga: aqui o campo já diz o nome.
    await expect(page.locator('[data-miniatura="anexo"]')).toBeHidden();
    await expect(
      page.getByRole("button", { name: VER_DOCUMENTO_LARGA }),
    ).toBeHidden();

    const ver = page.getByRole("button", {
      name: VER_DOCUMENTO_PISO,
      exact: true,
    });
    await expect(ver).toBeVisible();
    await ver.click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(
      modal.getByRole("img", { name: /Documento anexado/ }),
    ).toBeVisible();
    // Tela cheia: o painel ocupa a largura inteira do piso.
    const caixa = (await modal.boundingBox())!;
    expect(Math.round(caixa.width)).toBe(375);

    await modal.getByRole("button", { name: "Fechar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  /** Estado D no piso: XML não ganha link nenhum — mesma regra da tela larga. */
  test("XML não ganha link no piso", async ({ page }) => {
    await irParaFormulario(page);
    await page.getByLabel("Arquivo").setInputFiles({
      name: "nfe-33240112345.xml",
      mimeType: "text/xml",
      buffer: Buffer.from("<nfeProc></nfeProc>"),
    });

    await expect(
      page.getByText("nfe-33240112345.xml ✓ vai para o acervo"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: VER_DOCUMENTO_PISO, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: ABRIR_PDF_EM_ABA }),
    ).toHaveCount(0);
  });
});
