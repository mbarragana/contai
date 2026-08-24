import { expect, test } from "./fixtures";
import { entrarPelaTela, preencherPagamentoBasico } from "./formularios";

/**
 * Tela 6 do mock e a única consequência fiscal registrada no ticket: sessão
 * que cai no meio do preenchimento não pode levar o formulário junto
 * (IN SRF 84/2001 art. 17 — custo não comprovado não existe).
 */
test.describe("sessão que cai no meio do formulário", () => {
  test("o que foi digitado sobrevive à reautenticação e o registro entra no banco", async ({
    page,
    db,
  }) => {
    await page.goto("/adicionar/pagamento");
    await expect(
      page.getByRole("heading", { name: "Registrar pagamento" }),
    ).toBeVisible();

    await preencherPagamentoBasico(page, {
      favorecido: "José da Silva",
      documento: "529.982.247-25",
      valor: "1.250,00",
      dataPagamento: "2026-05-06",
      comprovante: {
        name: "pix-jose.png",
        mimeType: "image/png",
        buffer: Buffer.from("PNG pix-jose"),
      },
    });

    // A sessão morre em silêncio — é assim que ela morre de verdade: cookie
    // expirado, ou apagado pelo ITP do Safari depois de dias sem abrir o app.
    await page.context().clearCookies();

    await page.getByRole("button", { name: /^Salvar/ }).click();

    // Sobreposto, não navegação: o formulário continua montado atrás.
    await expect(
      page.getByText("Sua sessão terminou enquanto você preenchia."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/adicionar\/pagamento$/);

    await entrarPelaTela(page);

    // O sobreposto some e os campos estão como ele deixou.
    await expect(
      page.getByText("Sua sessão terminou enquanto você preenchia."),
    ).toHaveCount(0);
    await expect(page.getByLabel("Favorecido", { exact: true })).toHaveValue(
      "José da Silva",
    );
    await expect(page.getByLabel("Valor")).toHaveValue("1.250,00");
    await expect(page.getByLabel("Data do pagamento")).toHaveValue("2026-05-06");
    await expect(page.getByText("pix-jose.png")).toBeVisible();

    await page.getByRole("button", { name: /^Salvar/ }).click();

    // E o que interessa: a linha existe no Postgres, com o valor certo.
    await expect
      .poll(async () => {
        const { data } = await db.from("pagamento").select("valor");
        return data?.length ?? 0;
      }, { timeout: 15_000 })
      .toBe(1);

    const { data } = await db.from("pagamento").select("valor, data_pagamento");
    expect(Number(data![0].valor)).toBe(1250);
    expect(data![0].data_pagamento).toBe("2026-05-06");
  });
});
