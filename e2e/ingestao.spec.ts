import { expect, test, type Page } from "@playwright/test";

import {
  documentoStub,
  instalarStub,
  pagamentoStub,
  USER_ID,
} from "./stub";

const ANO = new Date().getFullYear();

const ARQUIVO_NF = {
  name: "NF-AJE-0091.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 nota fiscal"),
};

const ARQUIVO_PIX = {
  name: "comprovante-pix.png",
  mimeType: "image/png",
  buffer: Buffer.from("PNG comprovante"),
};

const CNPJ = "11.222.333/0001-81";

/** Toca na opção como o Mateus tocaria: no rótulo, não no input escondido. */
async function escolher(page: Page, grupo: string, opcao: string) {
  await page
    .getByRole("group", { name: grupo })
    .getByText(opcao, { exact: true })
    .click();
}

test.describe("home de pendências", () => {
  test("mostra acumulado, exposição e a consequência de cada pendência", async ({
    page,
  }) => {
    await instalarStub(page, {
      documentos: [
        documentoStub({
          id: "d1",
          status: "quarentena",
          destinatario_cpf_ok: false,
          motivo_quarentena: "Documento não está no CPF do dono da obra.",
          valor: 4850,
        }),
        documentoStub({
          id: "d2",
          tipo: "boleto",
          status: "aguardando_pagamento",
          valor: 25000,
          vencimento: `${ANO}-09-15`,
          favorecido: { nome: "AJE Construções" },
        }),
        documentoStub({
          id: "d3",
          tipo: "nf_servico",
          classificacao: "mao_obra",
          retencao_11: null,
          valor: 18000,
          favorecido: { nome: "AJE Construções" },
        }),
      ],
      pagamentos: [
        pagamentoStub({ id: "p1", valor: 15000, data_pagamento: `${ANO}-06-05` }),
        pagamentoStub({ id: "p2", valor: 15000, data_pagamento: `${ANO}-07-05` }),
        pagamentoStub({ id: "p3", valor: 15000, data_pagamento: `${ANO}-08-05` }),
      ],
    });

    await page.goto("/");

    // Acumulado do imóvel = terreno + obra confirmada (situação em 31/12).
    await expect(page.getByText(/Acumulado do imóvel/)).toContainText(
      "800.000,00",
    );
    // 4.850 (quarentena) + 25.000 (boleto) + 18.000 (sem retenção) + 45.000 (PIX sem NF)
    await expect(page.getByText(/Em pendência/)).toContainText("92.850,00");

    await expect(page.getByText("NF fora do seu CPF")).toBeVisible();
    await expect(
      page.getByText("Não entra no custo de aquisição. Peça a nota no seu CPF."),
    ).toBeVisible();

    await expect(page.getByText("Boleto sem nota vinculada")).toBeVisible();
    await expect(
      page.getByText("Boleto não é documento hábil. O custo só se sustenta com a NF."),
    ).toBeVisible();

    await expect(page.getByText("3 PIX sem NF vinculada")).toBeVisible();
    await expect(
      page.getByText("3 PIX sem NF vinculada").locator(".."),
    ).toContainText("45.000,00");

    await expect(page.getByText("NF de serviço sem retenção")).toBeVisible();
    await expect(
      page.getByText("Não abate na aferição do INSS da obra (SERO)."),
    ).toBeVisible();
  });

  test("favorecido PF: a home cobra recibo assinado, não NF", async ({
    page,
  }) => {
    await instalarStub(page, {
      pagamentos: [
        pagamentoStub({
          id: "p1",
          valor: 3000,
          favorecido_id: "fav-pf",
          favorecido: { nome: "José Pedreiro", tipo: "pf" },
        }),
      ],
    });

    await page.goto("/");

    await expect(page.getByText("Pago sem recibo")).toBeVisible();
    await expect(page.getByText("1 PIX sem recibo vinculado")).toBeVisible();
    await expect(
      page.getByText(/Cobre o recibo assinado \(nome, CPF e descrição/),
    ).toBeVisible();
  });

  test("estado vazio: nada pendente", async ({ page }) => {
    await instalarStub(page, {});
    await page.goto("/");
    await expect(page.getByText("Nenhuma pendência.")).toBeVisible();
    await expect(page.getByText(/Em pendência/)).toHaveCount(0);
  });

  test("estado de erro: banco fora, com saída", async ({ page }) => {
    await instalarStub(page, { falhar: true });
    await page.goto("/");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(/\w/);
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
  });
});

test.describe("registrar documento", () => {
  async function irParaFormulario(page: Page) {
    await page.goto("/");
    await page.getByRole("link", { name: "+ Adicionar" }).click();
    await page.getByRole("link", { name: /Documento — PDF/ }).click();
    await expect(
      page.getByRole("heading", { name: "Registrar documento" }),
    ).toBeVisible();
  }

  test("sem responder os checks fiscais, não salva", async ({ page }) => {
    const capturas = await instalarStub(page, {});
    await irParaFormulario(page);

    await page.getByLabel("Arquivo").setInputFiles(ARQUIVO_NF);
    await escolher(page, "Tipo", "NF material");
    await page.getByLabel("Emitente", { exact: true }).fill("Casa do Construtor Ltda");
    await page.getByLabel("CNPJ / CPF do emitente").fill(CNPJ);
    await page.getByLabel("Valor").fill("4.850,00");

    await page.getByRole("button", { name: "Salvar registro" }).click();

    await expect(
      page.getByText("Responda se o documento está no seu CPF."),
    ).toBeVisible();
    expect(capturas.documentos).toHaveLength(0);
  });

  test("fluxo completo: anexo + campos + checks → Registrado", async ({ page }) => {
    const capturas = await instalarStub(page, {});
    await irParaFormulario(page);

    await page.getByLabel("Arquivo").setInputFiles(ARQUIVO_NF);
    await expect(page.getByText(/NF-AJE-0091\.pdf ✓ vai para o acervo/)).toBeVisible();

    await escolher(page, "Tipo", "NF material");
    // Proposta automática de classificação a partir do tipo.
    await expect(
      page.getByRole("group", { name: "Classificação" }).getByRole("radio", {
        name: "Material",
      }),
    ).toBeChecked();

    await page.getByLabel("Emitente", { exact: true }).fill("Casa do Construtor Ltda");
    await page.getByLabel("CNPJ / CPF do emitente").fill(CNPJ);
    await page.getByLabel("Valor").fill("4.850,00");
    await escolher(page, "A nota está no seu CPF?", "Sim");

    await page.getByRole("button", { name: "Salvar registro" }).click();

    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();
    await expect(page.getByText(/Original guardado no acervo/)).toBeVisible();

    expect(capturas.uploads[0]).toContain(`acervo/${USER_ID}/documento/`);
    // Favorecido entra por upsert: dois toques no salvar não duplicam o CNPJ.
    expect(capturas.favorecidos[0]).toContain("on_conflict=user_id%2Cdocumento");
    expect(capturas.documentos).toHaveLength(1);
    expect(capturas.documentos[0]).toMatchObject({
      tipo: "nf_material",
      valor: 4850,
      classificacao: "material",
      destinatario_cpf_ok: true,
      status: "registrado",
      retencao_11: null,
      motivo_quarentena: null,
    });
  });

  test("nota fora do CPF vai para quarentena com a consequência", async ({
    page,
  }) => {
    const capturas = await instalarStub(page, {
      documentos: [
        documentoStub({
          id: "doc-1",
          status: "quarentena",
          destinatario_cpf_ok: false,
          motivo_quarentena:
            "Documento não está no CPF do dono da obra — não entra no custo de aquisição.",
        }),
      ],
    });
    await irParaFormulario(page);

    await page.getByLabel("Arquivo").setInputFiles(ARQUIVO_NF);
    await escolher(page, "Tipo", "NF material");
    await page.getByLabel("Emitente", { exact: true }).fill("Casa do Construtor Ltda");
    await page.getByLabel("CNPJ / CPF do emitente").fill(CNPJ);
    await page.getByLabel("Valor").fill("4.850,00");
    await escolher(page, "A nota está no seu CPF?", "Não");

    // Aviso antes mesmo de salvar.
    await expect(page.getByText(/Vai para/)).toContainText("quarentena");

    await page.getByRole("button", { name: "Salvar registro" }).click();

    await expect(page.getByRole("heading", { name: "Quarentena" })).toBeVisible();
    await expect(page.getByText("fora do custo de aquisição")).toBeVisible();

    expect(capturas.documentos[0]).toMatchObject({
      destinatario_cpf_ok: false,
      status: "quarentena",
    });
    expect(capturas.documentos[0].motivo_quarentena).toBeTruthy();
  });

  test("NF de serviço sem retenção: avisa do INSS e não bloqueia", async ({
    page,
  }) => {
    const capturas = await instalarStub(page, {});
    await irParaFormulario(page);

    await page.getByLabel("Arquivo").setInputFiles(ARQUIVO_NF);
    await escolher(page, "Tipo", "NF serviço");
    await page.getByLabel("Emitente", { exact: true }).fill("AJE Construções");
    await page.getByLabel("CNPJ / CPF do emitente").fill(CNPJ);
    await page.getByLabel("Valor").fill("18.000,00");
    await escolher(page, "A nota está no seu CPF?", "Sim");
    await escolher(page, "NF de serviço: tem retenção de 11%?", "Não sei");

    await expect(
      page.getByText(/Não abate na aferição do INSS da obra \(SERO\)\./),
    ).toBeVisible();

    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    // "não sei" não pode virar "não" no banco.
    expect(capturas.documentos[0]).toMatchObject({
      tipo: "nf_servico",
      classificacao: "mao_obra",
      retencao_11: null,
      status: "registrado",
    });
  });
});

test.describe("registrar pagamento avulso", () => {
  async function irParaFormulario(page: Page) {
    await page.goto("/");
    await page.getByRole("link", { name: "+ Adicionar" }).click();
    await page.getByRole("link", { name: /Pagamento — PIX sem nota/ }).click();
    await expect(
      page.getByRole("heading", { name: "Registrar pagamento" }),
    ).toBeVisible();
  }

  test("sem comprovante não salva", async ({ page }) => {
    const capturas = await instalarStub(page, {});
    await irParaFormulario(page);

    await page.getByLabel("Favorecido", { exact: true }).fill("AJE Construções");
    await page.getByLabel("CNPJ / CPF do favorecido").fill(CNPJ);
    await page.getByLabel("Valor").fill("15.000,00");

    await page.getByRole("button", { name: "Salvar — aguardando NF" }).click();

    await expect(
      page.getByText("Anexe o comprovante do PIX — sem ele o pagamento não é aceito."),
    ).toBeVisible();
    expect(capturas.pagamentos).toHaveLength(0);
  });

  test("nasce aguardando NF, com o comprovante no acervo", async ({ page }) => {
    const capturas = await instalarStub(page, {});
    await irParaFormulario(page);

    await page.getByLabel("Favorecido", { exact: true }).fill("AJE Construções");
    await page.getByLabel("CNPJ / CPF do favorecido").fill(CNPJ);
    await page.getByLabel("Valor").fill("15.000,00");
    await page.getByLabel("Comprovante").setInputFiles(ARQUIVO_PIX);

    await expect(page.getByText("aguardando NF", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Salvar — aguardando NF" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    expect(capturas.uploads[0]).toContain(`acervo/${USER_ID}/comprovante/`);
    expect(capturas.pagamentos).toHaveLength(1);
    expect(capturas.pagamentos[0]).toMatchObject({
      valor: 15000,
      meio: "pix",
      status: "aguardando_nf",
      data_compra: null,
    });
    // Regime de caixa: a data do pagamento é o que define o ano do custo.
    expect(capturas.pagamentos[0].data_pagamento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
