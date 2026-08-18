import type { Page } from "@playwright/test";

import { OBRA_ID_SEED, USER_ID_SEED } from "./ambiente";
import {
  criarDocumento,
  criarFavorecido,
  criarPagamento,
  documentos,
  pagamentos,
  vinculos,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * O vínculo pagamento↔documento contra o Postgres LOCAL (critério 16 do
 * CONTAI-018): sessão de verdade, linhas de verdade, RLS ligada. As asserções
 * olham o ESTADO GRAVADO em `pagamento_documento` pelo MESMO client
 * autenticado que o app usa — nada de service key: o que a policy barra para o
 * app tem de barrar para o teste.
 *
 * Cenário: é o caso real que originou o relato — NF de R$ 3.000 da WK
 * registrada, PIX de R$ 3.000 registrado, e a home dizendo
 * "Custo confirmado R$ 0,00".
 */

const ANO = new Date().getFullYear();

const CNPJ_WK = "11.222.333/0001-81";
const CNPJ_WK_DIGITOS = "11222333000181";
const CNPJ_DEPOSITO_DIGITOS = "11444777000161";

function png(nome: string) {
  return { name: nome, mimeType: "image/png", buffer: Buffer.from(`PNG ${nome}`) };
}

function pdf(nome: string) {
  return {
    name: nome,
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4 ${nome}`),
  };
}

async function escolher(page: Page, grupo: string, opcao: string) {
  await page
    .getByRole("group", { name: grupo })
    .getByText(opcao, { exact: true })
    .click();
}

/** A NF da WK e o PIX correspondente, os dois soltos — o estado de hoje. */
async function cenarioWk(db: Db) {
  const wk = await criarFavorecido(db, {
    nome: "WK Construções LTDA",
    documento: CNPJ_WK_DIGITOS,
    tipo: "pj",
  });
  const documentoId = await criarDocumento(db, {
    favorecido_id: wk,
    tipo: "nf_servico",
    classificacao: "mao_obra",
    valor: 3000,
    retencao_11: true,
    destinatario_cpf_ok: true,
    status: "registrado",
  });
  const pagamentoId = await criarPagamento(db, {
    favorecido_id: wk,
    valor: 3000,
    data_pagamento: `${ANO}-08-12`,
    meio: "pix",
    // Nasce `aguardando_nf`, como todo pagamento do parque de registros dele.
    status: "aguardando_nf",
    comprovante_path: `${USER_ID_SEED}/comprovante/pix-wk.png`,
  });
  return { wk, documentoId, pagamentoId };
}

test.describe("caminho B — a partir do documento já registrado", () => {
  test("liga o PIX à NF, grava o vínculo e a despesa passa a aparecer uma vez", async ({
    page,
    db,
  }) => {
    const { documentoId, pagamentoId } = await cenarioWk(db);

    await page.goto("/");

    // Critério 14: o zero não aparece mudo. Texto do parecer §5.1.
    await expect(page.getByText("R$ 0,00").first()).toBeVisible();
    await expect(
      page.getByText(/Não significa que seu custo é zero/),
    ).toBeVisible();

    // Terceiro estado (parecer §5.2), em seção própria e fora das pendências.
    await expect(
      page.getByText("NF de serviço sem pagamento ligado"),
    ).toBeVisible();
    await expect(
      page.getByText(/Elas entram no "custo confirmado" quando o pagamento/),
    ).toBeVisible();

    // Antes do vínculo a mesma despesa ocupa DOIS cartões — é a palavra
    // "duplicadas" do relato.
    await expect(page.getByText("1 PIX sem NF vinculada")).toBeVisible();

    await page.getByRole("link", { name: "Ligar a um pagamento" }).click();
    await expect(
      page.getByRole("heading", { name: "Ligar pagamentos a esta nota" }),
    ).toBeVisible();

    // Critério 10: a sugestão ordena e rotula — e NÃO vem marcada.
    const candidato = page.getByRole("checkbox").first();
    await expect(candidato).not.toBeChecked();
    await expect(
      page.getByText("Sugestão — mesmo favorecido e mesmo valor"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Marque ao menos um pagamento" }),
    ).toBeDisabled();

    // Nada foi gravado só por abrir o seletor.
    expect(await vinculos(db)).toHaveLength(0);

    await candidato.check();
    // O saldo restante e o efeito no custo aparecem ANTES do toque no botão.
    await expect(page.getByText("Nota coberta por inteiro.")).toBeVisible();
    await expect(
      page.getByText(/Custo confirmado se ligar agora/),
    ).toContainText("3.000,00");

    await page
      .getByRole("button", { name: "Ligar 1 pagamento — R$ 3.000,00" })
      .click();

    await expect(page.getByText(/Ligado\./)).toBeVisible();

    // ── O ESTADO GRAVADO, pelo client autenticado (RLS `dono_vinculo`) ──
    const linhas = await vinculos(db);
    expect(linhas).toEqual([
      { pagamento_id: pagamentoId, documento_id: documentoId },
    ]);

    // `conciliado` é gravado como CONSEQUÊNCIA (critério 7) — e não é o que
    // faz o custo existir.
    const pagos = await pagamentos(db);
    expect(pagos[0].status).toBe("conciliado");

    // Critério 13: na home, UMA despesa — nem a NF nem o PIX soltos.
    await page.goto("/");
    await expect(page.getByText("Despesas comprovadas")).toBeVisible();
    await expect(page.getByText(/uma despesa, não duas/)).toBeVisible();
    await expect(page.getByText("1 PIX sem NF vinculada")).toHaveCount(0);
    await expect(
      page.getByText("NF de serviço sem pagamento ligado"),
    ).toHaveCount(0);
    await expect(page.getByText(/Custo confirmado em/).locator("..")).toContainText(
      "3.000,00",
    );
  });

  test("desligar diz o efeito no custo antes do toque e apaga só o vínculo", async ({
    page,
    db,
  }) => {
    const { documentoId, pagamentoId } = await cenarioWk(db);
    // Cenário já conciliado, montado pelo client autenticado.
    const { error } = await db
      .from("pagamento_documento")
      .insert({ pagamento_id: pagamentoId, documento_id: documentoId });
    expect(error).toBeNull();

    await page.goto(`/documento/${documentoId}`);
    await expect(page.getByText("Custo comprovado")).toBeVisible();

    await page.getByRole("link", { name: "Desligar este pagamento" }).click();

    // Critério 15: o efeito no custo dito ANTES, com o número que vai aparecer.
    await expect(page.getByText(`Custo confirmado ${ANO}`)).toBeVisible();
    await expect(page.getByText("R$ 3.000,00 → R$ 0,00")).toBeVisible();
    await expect(page.getByText(/Nada é apagado/)).toBeVisible();

    await page
      .getByRole("button", { name: "Desligar — o custo cai para R$ 0,00" })
      .click();

    await expect(page.getByText("Nenhum pagamento ligado a este documento.")).toBeVisible();

    // Só o vínculo caiu: nota e pagamento continuam no acervo (append-only).
    expect(await vinculos(db)).toHaveLength(0);
    expect(await documentos(db)).toHaveLength(1);
    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(1);
    expect(pagos[0].status).toBe("aguardando_nf");
  });
});

test.describe("caminho A — vínculo no ato do registro", () => {
  test("registra a nota já ligada a um PIX que existia", async ({ page, db }) => {
    const wk = await criarFavorecido(db, {
      nome: "WK Construções LTDA",
      documento: CNPJ_WK_DIGITOS,
      tipo: "pj",
    });
    const pagamentoId = await criarPagamento(db, {
      favorecido_id: wk,
      valor: 3000,
      data_pagamento: `${ANO}-08-12`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-wk.png`,
    });

    await page.goto("/adicionar/documento");
    await page.getByLabel("Arquivo").setInputFiles(pdf("NF-WK-3000.pdf"));
    await escolher(page, "Tipo", "NF serviço");
    await page.getByLabel("Emitente", { exact: true }).fill("WK Construções LTDA");
    await page.getByLabel("CNPJ / CPF do emitente").fill(CNPJ_WK);
    await page.getByLabel("Valor").fill("3.000,00");
    await escolher(page, "A nota está no seu CPF?", "Sim");
    await escolher(page, "NF de serviço: tem retenção de 11%?", "Sim");

    await page.getByRole("checkbox", { name: "Já paguei esta nota" }).check();

    // Critério 10 também aqui: o candidato aparece rotulado e desmarcado.
    const candidato = page
      .getByRole("checkbox")
      .filter({ hasNotText: "Já paguei" })
      .last();
    await expect(candidato).not.toBeChecked();
    await candidato.check();

    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();
    await expect(page.getByText(/1 pagamento ligado/)).toBeVisible();

    const docs = await documentos(db);
    expect(docs).toHaveLength(1);
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagamentoId, documento_id: docs[0].id },
    ]);
  });

  test("registra o pagamento já ligado à nota (mock s3b)", async ({ page, db }) => {
    const wk = await criarFavorecido(db, {
      nome: "WK Construções LTDA",
      documento: CNPJ_WK_DIGITOS,
      tipo: "pj",
    });
    const documentoId = await criarDocumento(db, {
      favorecido_id: wk,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      valor: 3000,
      retencao_11: true,
      destinatario_cpf_ok: true,
      status: "registrado",
    });

    await page.goto(`/documento/${documentoId}`);
    await page
      .getByRole("link", { name: "Registrar o pagamento desta nota" })
      .click();

    // O vínculo é AFIRMADO na tela antes de salvar, e é desfazível ali.
    await expect(page.getByText("Ligado a:")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Desfazer o vínculo antes de salvar" }),
    ).toBeVisible();
    // O favorecido veio da nota; o VALOR não vem — default em campo fiscal é
    // proibido.
    await expect(page.getByLabel("Favorecido", { exact: true })).toHaveValue(
      "WK Construções LTDA",
    );
    await expect(page.getByLabel("Valor")).toHaveValue("");

    await page.getByLabel("CNPJ / CPF do favorecido").fill(CNPJ_WK);
    await page.getByLabel("Valor").fill("3.000,00");
    await page.getByLabel("Comprovante").setInputFiles(png("pix-wk.png"));

    await page
      .getByRole("button", { name: "Salvar pagamento e ligar à nota" })
      .click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(1);
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagos[0].id, documento_id: documentoId },
    ]);
  });
});

test.describe("caminho a partir do pagamento (critério 3)", () => {
  test("o cartão 'pago sem nota' da home leva ao seletor inverso", async ({
    page,
    db,
  }) => {
    const { documentoId, pagamentoId } = await cenarioWk(db);

    await page.goto("/");
    await page.getByRole("link", { name: /Ligar a uma nota/ }).click();

    await expect(page.getByRole("heading", { name: "Pagamento" })).toBeVisible();
    await page.getByRole("link", { name: "Ligar a uma nota" }).click();

    const candidato = page.getByRole("checkbox").first();
    await expect(candidato).not.toBeChecked();
    await candidato.check();
    await page.getByRole("button", { name: "Ligar 1 documento" }).click();

    await expect(page.getByText(/uma despesa só/)).toBeVisible();
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagamentoId, documento_id: documentoId },
    ]);
  });
});

/**
 * Critério 12 em 375px (`devices["iPhone SE"]`, viewport do playwright.config).
 * As duas condições que o ticket exige: conteúdo curto e lista longa rolada
 * até o meio. O FAB `sticky` dentro do `Corpo` passava na primeira e pousava
 * sobre o conteúdo na segunda.
 */
test.describe("acesso a /adicionar (critério 12)", () => {
  test("home com conteúdo curto: o alvo está visível e clicável", async ({
    page,
  }) => {
    await page.goto("/");
    const alvo = page.getByRole("link", { name: "+ Adicionar" });
    await expect(alvo).toBeInViewport();
    await alvo.click();
    await expect(page.getByRole("heading", { name: "Adicionar" })).toBeVisible();
  });

  test("home com lista longa rolada até o meio: o alvo continua no lugar", async ({
    page,
    db,
  }) => {
    const deposito = await criarFavorecido(db, {
      nome: "Depósito Cachoeira ME",
      documento: CNPJ_DEPOSITO_DIGITOS,
      tipo: "pj",
    });
    for (let i = 1; i <= 8; i++) {
      await criarPagamento(db, {
        favorecido_id: deposito,
        valor: 620 + i,
        data_pagamento: `${ANO}-08-0${i}`,
        meio: "pix",
        status: "aguardando_nf",
        comprovante_path: `${USER_ID_SEED}/comprovante/pix-${i}.png`,
      });
      await criarDocumento(db, {
        favorecido_id: deposito,
        tipo: "nf_material",
        classificacao: "material",
        valor: 100 + i,
        destinatario_cpf_ok: false,
        status: "quarentena",
        motivo_quarentena: "Documento não está no CPF do dono da obra.",
      });
    }

    await page.goto("/");
    await expect(page.getByText("Quarentena").first()).toBeVisible();

    // Quem rola é o corpo da tela (h-dvh + overflow-y-auto), não a página.
    const corpo = page.getByRole("main");
    await corpo.evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2;
    });

    const alvo = page.getByRole("link", { name: "+ Adicionar" });
    await expect(alvo).toBeInViewport();
    await alvo.click();
    await expect(page.getByRole("heading", { name: "Adicionar" })).toBeVisible();
  });

  test("/adicionar é alcançável a partir de /documento/[id]", async ({
    page,
    db,
  }) => {
    const { documentoId } = await cenarioWk(db);
    await page.goto(`/documento/${documentoId}`);

    const alvo = page.getByRole("link", { name: "+ Adicionar" });
    await expect(alvo).toBeInViewport();
    await alvo.click();
    await expect(page.getByRole("heading", { name: "Adicionar" })).toBeVisible();
  });

  test("/adicionar é alcançável a partir de /pagamento/[id]", async ({
    page,
    db,
  }) => {
    const { pagamentoId } = await cenarioWk(db);
    await page.goto(`/pagamento/${pagamentoId}`);

    const alvo = page.getByRole("link", { name: "+ Adicionar" });
    await expect(alvo).toBeInViewport();
    await alvo.click();
    await expect(page.getByRole("heading", { name: "Adicionar" })).toBeVisible();
  });
});

/**
 * Critério 11 pela porta do banco: a policy `dono_vinculo` só exige mesmo
 * DONO, então o Postgres ACEITA um vínculo entre duas obras do próprio Mateus.
 * Quem impede é o código — e o teste registra que a proteção é essa, não a do
 * banco, para o dia em que alguém achar que a RLS cobre este caso.
 */
test.describe("vínculo entre obras (critério 11)", () => {
  test("o banco aceitaria; o seletor não oferece o registro da outra obra", async ({
    page,
    db,
  }) => {
    const { data, error } = await db
      .from("obra")
      .insert({ nome: "Casa do Morro", data_inicio_obra: "2026-03-15" })
      .select("id")
      .single();
    expect(error).toBeNull();
    const outraObra = data!.id;

    const wk = await criarFavorecido(db, {
      nome: "WK Construções LTDA",
      documento: CNPJ_WK_DIGITOS,
      tipo: "pj",
    });
    const documentoId = await criarDocumento(db, {
      obra_id: OBRA_ID_SEED,
      favorecido_id: wk,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      valor: 3000,
      retencao_11: true,
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    // Pagamento de MESMO favorecido e MESMO valor — seria a "sugestão" nº 1 se
    // a obra não contasse.
    await criarPagamento(db, {
      obra_id: outraObra,
      favorecido_id: wk,
      valor: 3000,
      data_pagamento: `${ANO}-08-12`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-outra.png`,
    });

    await page.goto(`/documento/${documentoId}/ligar`);
    await expect(page.getByText("Nenhum pagamento para ligar")).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });
});
