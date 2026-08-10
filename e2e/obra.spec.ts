import type { Page } from "@playwright/test";

import { OBRA_ID_SEED, USER_ID_SEED } from "./ambiente";
import {
  criarObra,
  documentos,
  obras,
  pagamentos,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * CONTAI-003 contra o Postgres LOCAL: obras de verdade, RLS ligada, e as
 * asserções olhando o ESTADO GRAVADO — é o `obra_id` gravado que vira
 * discriminação de Bens e Direitos e base de aferição no ano que vem, não o
 * que a tela mostrou.
 */

const CNPJ_AJE = "11.222.333/0001-81";

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

async function escolher(page: Page, grupo: string, opcao: string) {
  await page
    .getByRole("group", { name: grupo })
    .getByText(opcao, { exact: true })
    .click();
}

/** Segunda obra do cenário: em andamento e SEM CNO, como a real do Mateus. */
async function criarCasaDoMorro(db: Db) {
  return criarObra(db, {
    nome: "Casa do Morro",
    municipio: "Florianópolis",
    cno: null,
    data_inicio_obra: "2026-03-15",
    valor_terreno: 420000,
  });
}

async function preencherDocumento(
  page: Page,
  dados: { tipo: string; nome: string; valor: string; arquivo: string },
) {
  await page.getByLabel("Arquivo").setInputFiles(pdf(dados.arquivo));
  await escolher(page, "Tipo", dados.tipo);
  await page.getByLabel("Emitente", { exact: true }).fill(dados.nome);
  await page.getByLabel("CNPJ / CPF do emitente").fill(CNPJ_AJE);
  await page.getByLabel("Valor").fill(dados.valor);
  await escolher(page, "A nota está no seu CPF?", "Sim");
}

// ── Critério 12 — usuário novo não cai em tela de erro ───────────────────

test.describe("primeiro acesso", () => {
  test("sem nenhuma obra, o app leva ao cadastro em vez de tela de erro", async ({
    page,
    db,
  }) => {
    // `ObraAusenteError` era o fim da linha: nome, matrícula, CNO e valor do
    // terreno só entravam por SQL (dor D9).
    const { error } = await db.from("obra").delete().eq("id", OBRA_ID_SEED);
    expect(error).toBeNull();
    expect(await obras(db)).toHaveLength(0);

    await page.goto("/");

    await expect(page.getByText("Nenhuma obra cadastrada")).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

    await page.getByRole("link", { name: "Cadastrar a primeira obra" }).click();
    await expect(page.getByRole("heading", { name: "Nova obra" })).toBeVisible();
    await expect(page.getByLabel("Nome da obra")).toBeVisible();
  });

  test("cadastra obra SEM CNO pela tela, com a pendência e sem bloqueio", async ({
    page,
    db,
  }) => {
    await page.goto("/obras");
    await page.getByRole("link", { name: "+ Nova obra" }).click();

    await page.getByLabel("Nome da obra").fill("Casa do Morro");
    await page.getByLabel("Município").fill("Florianópolis");
    await page.getByLabel("Matrícula do imóvel").fill("45.892");
    await page.getByLabel("Data de início da obra").fill("2026-03-15");
    await page.getByRole("button", { name: "Continuar" }).click();

    // Passo 2 — a ausência de CNO é obrigação vencida, não campo opcional.
    await escolher(page, "Esta obra já tem CNO?", "Ainda não tenho");
    await expect(
      page.getByText(/O CNO é obrigatório e o prazo é de 30 dias/),
    ).toBeVisible();
    await expect(page.getByText(/dias em atraso/)).toBeVisible();
    await expect(
      page.getByText(/não abatem a aferição do INSS/),
    ).toBeVisible();
    await expect(
      page.getByText(/continuam valendo como custo de aquisição no IRPF/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continuar sem CNO" }).click();

    // Passo 3 — composição do custo do terreno.
    await page.getByLabel("Valor pago pelo terreno").fill("420.000,00");
    await page.getByLabel("ITBI").fill("12.600,00");
    await page.getByLabel("Escritura e registro").fill("8.400,00");
    await expect(page.getByText("R$ 441.000,00")).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();

    // Passo 4 — premissas do produto. Sem resposta não cria: a equiparação a
    // empresa (critério 11) é decidida por fato declarado, não por omissão.
    await page.getByRole("button", { name: "Criar obra" }).click();
    await expect(
      page.getByText("Responda se o terreno veio de desmembramento ou loteamento."),
    ).toBeVisible();
    await escolher(page, "O terreno veio de desmembramento ou loteamento?", "Não");
    await page.getByRole("button", { name: "Criar obra" }).click();

    await expect(page.getByRole("heading", { name: "Obra criada ✓" })).toBeVisible();

    const gravadas = await obras(db);
    expect(gravadas).toHaveLength(2);
    const nova = gravadas.find((o) => o.nome === "Casa do Morro")!;
    expect(nova).toMatchObject({
      user_id: USER_ID_SEED,
      municipio: "Florianópolis",
      matricula: "45.892",
      cno: null,
      cno_registrado_em: null,
      data_inicio_obra: "2026-03-15",
      valor_terreno: 420000,
      valor_itbi: 12600,
      valor_escritura_registro: 8400,
      unidades_autonomas: 1,
      origem_desmembramento_loteamento: false,
    });
  });
});

// ── Critério 10 — unique parcial de CNO ─────────────────────────────────

test.describe("CNO por obra", () => {
  test("duas obras SEM CNO coexistem; duas com o MESMO CNO são barradas", async ({
    db,
  }) => {
    // O unique é parcial (`where cno is not null`). Um unique comum trataria
    // `null` como valor e transformaria a decisão "aceitar obra sem CNO" em
    // bloqueio disfarçado no dia da segunda obra sem CNO.
    await criarObra(db, { nome: "Sem CNO 1", cno: null });
    await criarObra(db, { nome: "Sem CNO 2", cno: null });
    expect(await obras(db)).toHaveLength(3);

    const repetido = await db
      .from("obra")
      .insert({
        nome: "Clone do CNO da Casa Cachoeira",
        cno: "12.345.67890/26",
        data_inicio_obra: "2026-01-10",
      })
      .select("id");
    expect(repetido.error?.code).toBe("23505");
    expect(await obras(db)).toHaveLength(3);
  });
});

// ── Critérios 7 e 8 — a obra gravada é a que estava na tela ─────────────

test.describe("obra do registro", () => {
  test("trocar a obra ativa depois não move o que já foi salvo", async ({
    page,
    db,
  }) => {
    const morro = await criarCasaDoMorro(db);

    await page.goto("/adicionar/documento");
    await expect(page.getByText("Registrando em")).toBeVisible();
    await expect(
      page.getByText("Casa Cachoeira", { exact: true }),
    ).toBeVisible();

    await preencherDocumento(page, {
      tipo: "NF material",
      nome: "Casa do Construtor Ltda",
      valor: "4.850,00",
      arquivo: "NF-material-cachoeira.pdf",
    });
    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();
    // A confirmação nomeia a obra: última chance de ver o erro fresco.
    await expect(page.getByText(/Salvo em/)).toContainText("Casa Cachoeira");

    // Troca a obra ativa para a outra obra.
    await page.goto("/obras");
    await page.getByRole("button", { name: /Casa do Morro/ }).click();
    await expect(page.getByText("Obra aberta")).toBeVisible();

    const gravados = await documentos(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0].obra_id).toBe(OBRA_ID_SEED);
    expect(gravados[0].obra_id).not.toBe(morro);
  });

  test("trocar de obra DENTRO do formulário grava na obra da tela", async ({
    page,
    db,
  }) => {
    // O defeito que o ticket persegue: a preferência do aparelho decidindo um
    // campo fiscal. Aqui ela aponta para a Casa Cachoeira o tempo todo, e o
    // registro tem de ir para a obra afirmada na tela.
    const morro = await criarCasaDoMorro(db);

    await page.goto("/adicionar/documento");
    await preencherDocumento(page, {
      tipo: "NF material",
      nome: "Casa do Construtor Ltda",
      valor: "1.200,00",
      arquivo: "NF-material-morro.pdf",
    });

    await page.getByRole("button", { name: "Trocar obra" }).click();
    await page.getByRole("button", { name: /Casa do Morro/ }).click();
    await expect(page.getByText("Casa do Morro", { exact: true })).toBeVisible();
    // Volta ao MESMO formulário, com o que já estava preenchido.
    await expect(page.getByLabel("Valor")).toHaveValue("1.200,00");

    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByText(/Salvo em/)).toContainText("Casa do Morro");

    const gravados = await documentos(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0].obra_id).toBe(morro);

    // A preferência do aparelho continua na outra obra — e não decidiu nada.
    const preferida = await page.evaluate(() =>
      window.localStorage.getItem("contai-obra-ativa"),
    );
    expect(preferida).toBe(OBRA_ID_SEED);
  });
});

// ── Critério 15 — obra sem CNO não bloqueia registro ────────────────────

test.describe("obra sem CNO", () => {
  test("registra material, NF de serviço e pagamento — todos gravados", async ({
    page,
    db,
  }) => {
    const morro = await criarCasaDoMorro(db);
    await page.goto("/obras");
    await page.getByRole("button", { name: /Casa do Morro/ }).click();
    await expect(page.getByText("Obra aberta")).toBeVisible();

    // 1 · NF de material.
    await page.goto("/adicionar/documento");
    await preencherDocumento(page, {
      tipo: "NF material",
      nome: "Casa do Construtor Ltda",
      valor: "4.850,00",
      arquivo: "material-sem-cno.pdf",
    });
    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    // 2 · NF de serviço: avisa a consequência e salva mesmo assim.
    await page.goto("/adicionar/documento");
    await preencherDocumento(page, {
      tipo: "NF serviço",
      nome: "AJE Construções",
      valor: "18.000,00",
      arquivo: "servico-sem-cno.pdf",
    });
    await escolher(page, "NF de serviço: tem retenção de 11%?", "Sim");
    await expect(page.getByText("Nota de serviço em obra sem CNO")).toBeVisible();
    await expect(
      page.getByText(/não vai abater a aferição do INSS desta obra/),
    ).toBeVisible();
    await expect(
      page.getByText(/exija da empreiteira/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Salvar mesmo assim" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    // 3 · Pagamento avulso.
    await page.goto("/adicionar/pagamento");
    await page.getByLabel("Favorecido", { exact: true }).fill("AJE Construções");
    await page.getByLabel("CNPJ / CPF do favorecido").fill(CNPJ_AJE);
    await page.getByLabel("Valor").fill("15.000,00");
    await page.getByLabel("Comprovante").setInputFiles(png("pix-sem-cno.png"));
    await page.getByRole("button", { name: /Salvar — aguardando NF/ }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    const docsGravados = await documentos(db);
    expect(docsGravados).toHaveLength(2);
    expect(docsGravados.map((d) => d.obra_id)).toEqual([morro, morro]);
    expect(docsGravados.map((d) => d.tipo).sort()).toEqual([
      "nf_material",
      "nf_servico",
    ]);

    const pagosGravados = await pagamentos(db);
    expect(pagosGravados).toHaveLength(1);
    expect(pagosGravados[0].obra_id).toBe(morro);
  });
});

// ── Critério 16 — o caminho perigoso ────────────────────────────────────

test.describe("sem obra ativa persistida", () => {
  test.use({ obraAtiva: null });

  test("com duas obras, nada é gravado antes de uma escolha explícita", async ({
    page,
    db,
  }) => {
    await criarCasaDoMorro(db);

    // Celular novo / storage limpo: o app abre a LISTA e não escolhe obra.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Suas obras" })).toBeVisible();
    await expect(page.getByText(/O app não escolhe por você/)).toBeVisible();

    // O formulário também não abre em obra nenhuma.
    await page.goto("/adicionar/documento");
    await expect(page.getByRole("heading", { name: "Suas obras" })).toBeVisible();

    expect(await documentos(db)).toHaveLength(0);
    expect(await pagamentos(db)).toHaveLength(0);

    // Só depois da escolha explícita o app abre uma obra.
    await page.getByRole("button", { name: /Casa Cachoeira/ }).click();
    await expect(page.getByText("Obra aberta")).toBeVisible();
  });
});

test.describe("correção da obra de um registro", () => {
  test("mover para a obra B: obra_id vira B e some das saídas de A", async ({
    page,
    db,
  }) => {
    const morro = await criarCasaDoMorro(db);

    await page.goto("/adicionar/documento");
    await preencherDocumento(page, {
      tipo: "NF material",
      nome: "Casa do Construtor Ltda",
      valor: "4.850,00",
      arquivo: "NF-obra-errada.pdf",
    });
    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    const antes = await documentos(db);
    expect(antes[0].obra_id).toBe(OBRA_ID_SEED);

    // Correção pela interface (critério 13) — sem isto seria SQL na mão.
    await page.getByRole("link", { name: "Corrigir a obra deste registro" }).click();
    await expect(page.getByRole("heading", { name: "Corrigir obra" })).toBeVisible();
    await page.getByRole("button", { name: /Casa do Morro/ }).click();
    await page.getByRole("button", { name: "Mover para a obra escolhida" }).click();
    await expect(
      page.getByRole("heading", { name: "Obra corrigida ✓" }),
    ).toBeVisible();

    const depois = await documentos(db);
    expect(depois).toHaveLength(1);
    expect(depois[0].obra_id).toBe(morro);

    // Saída da obra A: o valor não aparece mais em lugar nenhum dela.
    await page.goto("/");
    await expect(page.getByText("Nenhuma pendência.")).toBeVisible();
    await expect(page.getByText("4.850,00")).toHaveCount(0);
  });
});
