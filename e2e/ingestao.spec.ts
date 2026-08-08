import type { Page } from "@playwright/test";

import { OBRA_ID_SEED, URL_SUPABASE_LOCAL, USER_ID_SEED } from "./ambiente";
import {
  arquivosNoAcervo,
  criarDocumento,
  criarFavorecido,
  criarPagamento,
  documentos,
  favorecidos,
  pagamentos,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * Fluxo de ingestão contra o Supabase LOCAL: sessão de verdade, linhas de
 * verdade no Postgres (com RLS), arquivo de verdade no bucket `acervo`.
 * As asserções olham o ESTADO GRAVADO, não só o que a tela mostra — é o
 * estado gravado que vira declaração no ano que vem.
 */

const ANO = new Date().getFullYear();

const CNPJ_AJE = "11.222.333/0001-81";
const CNPJ_AJE_DIGITOS = "11222333000181";
const CNPJ_CASA_DIGITOS = "11444777000161";
const CPF_JOSE = "52998224725";

function pdf(nome: string) {
  return {
    name: nome,
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4 ${nome}`),
  };
}

function png(nome: string) {
  return {
    name: nome,
    mimeType: "image/png",
    buffer: Buffer.from(`PNG ${nome}`),
  };
}

/** Mesma conta do formulário (app/adicionar/pagamento): data local, não UTC. */
function hojeIso(): string {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

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
    db,
  }) => {
    const aje = await criarFavorecido(db, {
      nome: "AJE Construções",
      documento: CNPJ_AJE_DIGITOS,
      tipo: "pj",
    });
    const casa = await criarFavorecido(db, {
      nome: "Casa do Construtor",
      documento: CNPJ_CASA_DIGITOS,
      tipo: "pj",
    });

    await criarDocumento(db, {
      favorecido_id: casa,
      tipo: "nf_material",
      classificacao: "material",
      valor: 4850,
      destinatario_cpf_ok: false,
      status: "quarentena",
      motivo_quarentena: "Documento não está no CPF do dono da obra.",
    });
    await criarDocumento(db, {
      favorecido_id: aje,
      tipo: "boleto",
      valor: 25000,
      vencimento: `${ANO}-09-15`,
      destinatario_cpf_ok: true,
      status: "aguardando_pagamento",
    });
    await criarDocumento(db, {
      favorecido_id: aje,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      valor: 18000,
      retencao_11: null,
      destinatario_cpf_ok: true,
      status: "registrado",
    });

    for (const dia of ["06-05", "07-05", "08-05"]) {
      await criarPagamento(db, {
        favorecido_id: aje,
        valor: 15000,
        data_pagamento: `${ANO}-${dia}`,
        meio: "pix",
        status: "aguardando_nf",
        comprovante_path: `${USER_ID_SEED}/comprovante/pix-${dia}.png`,
      });
    }

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
    db,
  }) => {
    const jose = await criarFavorecido(db, {
      nome: "José Pedreiro",
      documento: CPF_JOSE,
      tipo: "pf",
    });
    await criarPagamento(db, {
      favorecido_id: jose,
      valor: 3000,
      data_pagamento: `${ANO}-08-05`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-jose.png`,
    });

    await page.goto("/");

    await expect(page.getByText("Pago sem recibo")).toBeVisible();
    await expect(page.getByText("1 PIX sem recibo vinculado")).toBeVisible();
    await expect(
      page.getByText(/Cobre o recibo assinado \(nome, CPF e descrição/),
    ).toBeVisible();
  });

  test("estado vazio: nada pendente", async ({ page, db }) => {
    // O vazio da tela tem que ser o vazio do banco, e não uma consulta quebrada.
    expect(await documentos(db)).toHaveLength(0);
    expect(await pagamentos(db)).toHaveLength(0);

    await page.goto("/");
    await expect(page.getByText("Nenhuma pendência.")).toBeVisible();
    await expect(page.getByText(/Em pendência/)).toHaveCount(0);
  });

  test("estado de erro: banco fora, com saída", async ({ page }) => {
    // Único ponto em que a rede é falsificada: derrubar o Postgres no meio da
    // suíte custaria caro e não provaria nada além disto — que o app trata
    // falha do PostgREST como erro com saída, não como tela vazia. O 503 é o
    // que o PostgREST devolve quando não alcança o banco.
    await page.route(`${URL_SUPABASE_LOCAL}/rest/v1/**`, (rota) =>
      rota.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "PGRST000",
          message: "could not connect to server",
        }),
      }),
    );

    await page.goto("/");

    // Timeout folgado de propósito: o postgrest-js repete 503/520 três vezes
    // com backoff (1s+2s+4s) antes de desistir, então a tela fica ~7s em
    // "Carregando a obra". Medido contra o stack local — o stub HTTP escondia
    // isso porque devolvia 500, que não é status repetível.
    await expect(page.getByRole("main").getByRole("alert")).toContainText(/\w/, {
      timeout: 20_000,
    });
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

  test("sem responder os checks fiscais, não salva", async ({ page, db }) => {
    const arquivo = pdf("NF-nao-deve-subir.pdf");
    await irParaFormulario(page);

    await page.getByLabel("Arquivo").setInputFiles(arquivo);
    await escolher(page, "Tipo", "NF material");
    await page.getByLabel("Emitente", { exact: true }).fill("Casa do Construtor Ltda");
    await page.getByLabel("CNPJ / CPF do emitente").fill(CNPJ_AJE);
    await page.getByLabel("Valor").fill("4.850,00");

    await page.getByRole("button", { name: "Salvar registro" }).click();

    await expect(
      page.getByText("Responda se o documento está no seu CPF."),
    ).toBeVisible();

    // Nada de meio-registro: nem linha, nem favorecido, nem arquivo no acervo.
    expect(await documentos(db)).toHaveLength(0);
    expect(await favorecidos(db)).toHaveLength(0);
    expect(
      (await arquivosNoAcervo(db, "documento")).filter((n) =>
        n.endsWith(arquivo.name),
      ),
    ).toHaveLength(0);
  });

  test("fluxo completo: anexo + campos + checks → Registrado", async ({
    page,
    db,
  }) => {
    const arquivo = pdf("NF-AJE-0091.pdf");
    // Favorecido que já existe com o mesmo CNPJ: o upsert tem que reaproveitar
    // a linha, senão a ficha Pagamentos Efetuados sai partida em dois.
    const jaExistia = await criarFavorecido(db, {
      nome: "Casa do Construtor (cadastro antigo)",
      documento: CNPJ_AJE_DIGITOS,
      tipo: "pj",
    });

    await irParaFormulario(page);

    await page.getByLabel("Arquivo").setInputFiles(arquivo);
    await expect(page.getByText(/NF-AJE-0091\.pdf ✓ vai para o acervo/)).toBeVisible();

    await escolher(page, "Tipo", "NF material");
    // Proposta automática de classificação a partir do tipo.
    await expect(
      page.getByRole("group", { name: "Classificação" }).getByRole("radio", {
        name: "Material",
      }),
    ).toBeChecked();

    await page.getByLabel("Emitente", { exact: true }).fill("Casa do Construtor Ltda");
    await page.getByLabel("CNPJ / CPF do emitente").fill(CNPJ_AJE);
    await page.getByLabel("Valor").fill("4.850,00");
    await escolher(page, "A nota está no seu CPF?", "Sim");

    await page.getByRole("button", { name: "Salvar registro" }).click();

    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();
    await expect(page.getByText(/Original guardado no acervo/)).toBeVisible();

    const gravados = await documentos(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      obra_id: OBRA_ID_SEED,
      user_id: USER_ID_SEED,
      tipo: "nf_material",
      valor: 4850,
      classificacao: "material",
      destinatario_cpf_ok: true,
      status: "registrado",
      retencao_11: null,
      motivo_quarentena: null,
      favorecido_id: jaExistia,
    });

    // Upsert por (user_id, documento): um CNPJ, um favorecido.
    const donos = await favorecidos(db);
    expect(donos).toHaveLength(1);
    expect(donos[0].nome).toBe("Casa do Construtor Ltda");

    // O original está no acervo, na pasta do dono (policy do bucket).
    expect(gravados[0].arquivo_path).toMatch(
      new RegExp(`^${USER_ID_SEED}/documento/`),
    );
    expect(await arquivosNoAcervo(db, "documento")).toContain(
      gravados[0].arquivo_path.split("/").pop(),
    );
  });

  test("nota fora do CPF vai para quarentena com a consequência", async ({
    page,
    db,
  }) => {
    const arquivo = pdf("NF-fora-do-cpf.pdf");
    await irParaFormulario(page);

    await page.getByLabel("Arquivo").setInputFiles(arquivo);
    await escolher(page, "Tipo", "NF material");
    await page.getByLabel("Emitente", { exact: true }).fill("Casa do Construtor Ltda");
    await page.getByLabel("CNPJ / CPF do emitente").fill(CNPJ_AJE);
    await page.getByLabel("Valor").fill("4.850,00");
    await escolher(page, "A nota está no seu CPF?", "Não");

    // Aviso antes mesmo de salvar.
    await expect(page.getByText(/Vai para/)).toContainText("quarentena");

    await page.getByRole("button", { name: "Salvar registro" }).click();

    await expect(page.getByRole("heading", { name: "Quarentena" })).toBeVisible();
    await expect(page.getByText("fora do custo de aquisição")).toBeVisible();

    const gravados = await documentos(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      destinatario_cpf_ok: false,
      status: "quarentena",
    });
    expect(gravados[0].motivo_quarentena).toBeTruthy();
    // A tela aberta é a do documento que acabou de ser gravado.
    expect(page.url()).toContain(`/documento/${gravados[0].id}`);
  });

  test("NF de serviço sem retenção: avisa do INSS e não bloqueia", async ({
    page,
    db,
  }) => {
    const arquivo = pdf("NF-servico-0007.pdf");
    await irParaFormulario(page);

    await page.getByLabel("Arquivo").setInputFiles(arquivo);
    await escolher(page, "Tipo", "NF serviço");
    await page.getByLabel("Emitente", { exact: true }).fill("AJE Construções");
    await page.getByLabel("CNPJ / CPF do emitente").fill(CNPJ_AJE);
    await page.getByLabel("Valor").fill("18.000,00");
    await escolher(page, "A nota está no seu CPF?", "Sim");
    await escolher(page, "NF de serviço: tem retenção de 11%?", "Não sei");

    await expect(
      page.getByText(/Não abate na aferição do INSS da obra \(SERO\)\./),
    ).toBeVisible();

    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    const gravados = await documentos(db);
    expect(gravados).toHaveLength(1);
    // "não sei" não pode virar "não" no banco.
    expect(gravados[0]).toMatchObject({
      tipo: "nf_servico",
      classificacao: "mao_obra",
      valor: 18000,
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

  test("sem comprovante não salva", async ({ page, db }) => {
    await irParaFormulario(page);

    await page.getByLabel("Favorecido", { exact: true }).fill("AJE Construções");
    await page.getByLabel("CNPJ / CPF do favorecido").fill(CNPJ_AJE);
    await page.getByLabel("Valor").fill("15.000,00");

    await page.getByRole("button", { name: "Salvar — aguardando NF" }).click();

    await expect(
      page.getByText("Anexe o comprovante do PIX — sem ele o pagamento não é aceito."),
    ).toBeVisible();

    expect(await pagamentos(db)).toHaveLength(0);
    expect(await favorecidos(db)).toHaveLength(0);
  });

  test("nasce aguardando NF, com o comprovante no acervo", async ({
    page,
    db,
  }) => {
    const arquivo = png("comprovante-pix.png");
    await irParaFormulario(page);

    await page.getByLabel("Favorecido", { exact: true }).fill("AJE Construções");
    await page.getByLabel("CNPJ / CPF do favorecido").fill(CNPJ_AJE);
    await page.getByLabel("Valor").fill("15.000,00");
    await page.getByLabel("Comprovante").setInputFiles(arquivo);

    await expect(page.getByText("aguardando NF", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Salvar — aguardando NF" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    const gravados = await pagamentos(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      obra_id: OBRA_ID_SEED,
      user_id: USER_ID_SEED,
      valor: 15000,
      meio: "pix",
      status: "aguardando_nf",
      data_compra: null,
    });
    // Regime de caixa: a data do pagamento é o que define o ano do custo.
    expect(gravados[0].data_pagamento).toBe(hojeIso());

    const donos = await favorecidos(db);
    expect(donos).toHaveLength(1);
    expect(donos[0]).toMatchObject({
      documento: CNPJ_AJE_DIGITOS,
      tipo: "pj",
    });
    expect(gravados[0].favorecido_id).toBe(donos[0].id);

    expect(gravados[0].comprovante_path).toMatch(
      new RegExp(`^${USER_ID_SEED}/comprovante/`),
    );
    expect(await arquivosNoAcervo(db, "comprovante")).toContain(
      gravados[0].comprovante_path!.split("/").pop(),
    );
  });
});
