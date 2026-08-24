import type { Page } from "@playwright/test";

import { OBRA_ID_SEED } from "./ambiente";
import {
  anexosDeDesembolso,
  criarDesembolsoTerreno,
  criarFinanciamento,
  criarInforme,
  desembolsosTerreno,
  informes,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * ⚠️ **O rótulo do Gravar deixou de ser fixo no CONTAI-025**: ele nomeia a
 * consequência do que está faltando (Gate Fiscal §4), e por isso o locator é o
 * `data-gravar` do rodapé — o rótulo em si é asserção de teste, não âncora.
 */
const gravar = (page: Page) => page.locator("[data-gravar]");


/**
 * CONTAI-010 contra o Postgres LOCAL: contrato, desembolsos datados e o informe
 * anual de verdade, com RLS ligada, e as asserções olhando o **ESTADO GRAVADO**
 * pelo MESMO client autenticado que o app usa.
 *
 * A pergunta que estes testes respondem não é "a tela mostra?" — é **"o que
 * entrou no banco?"**. É o estado gravado que vira situação em 31/12 na ficha
 * Bens e Direitos, e o risco central deste ticket é um número de custo existir
 * sem data ou sem o documento que o sustenta.
 *
 * ⚠️ **`getByRole(..., { name })` sem `exact: true` casa por SUBSTRING** — dívida
 * conhecida da suíte. Todo locator novo aqui usa `exact: true`.
 *
 * ⚠️ Nenhum identificador real (CPF, nº de contrato, agência, endereço): o
 * repositório é público. A instituição é **Banco Litoral**, fictícia.
 */

const INSTITUICAO = "Banco Litoral";

/**
 * A natureza da aquisição nasce NULL na obra do seed (pendência de complemento,
 * critério 23). Quem a responde é a tela de dados da obra; aqui ela é montada
 * direto no banco, pelo MESMO client autenticado do app.
 */
async function definirNatureza(
  db: Db,
  natureza: "a_vista" | "financiado" | "parcelado_vendedor" | "recebido",
) {
  const { error } = await db
    .from("obra")
    .update({ natureza_aquisicao_terreno: natureza })
    .eq("id", OBRA_ID_SEED);
  if (error) throw new Error(`definir natureza: ${error.message}`);
}

/** ISO de hoje no fuso do aparelho — o mesmo `hojeIso()` que o app usa. */
function hoje(): string {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const ANO_CORRENTE = Number(hoje().slice(0, 4));
/** O ano-base do informe é sempre o ANTERIOR: o do ano corrente ainda não saiu. */
const ANO_BASE = ANO_CORRENTE - 1;

function pdf(nome: string) {
  return {
    name: nome,
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4 ${nome}`),
  };
}

/**
 * Escolhe um papel e responde o que ele é — CONTAI-027, critérios 8 e 14.
 *
 * ⚠️ `papel` é obrigatório e **sem default**: sem este segundo passo o
 * formulário recusa a gravação, e é isso que os testes exercitam.
 */
async function anexar(
  dentro: import("@playwright/test").Locator,
  rotuloDoCampo: string,
  nome: string,
  papel: "Comprovante do pagamento" | "Nota ou recibo" | "Contrato ou escritura",
) {
  await dentro
    .getByLabel(rotuloDoCampo, { exact: true })
    .setInputFiles(pdf(nome));
  await dentro
    .locator(`[data-anexo-novo="${nome}"]`)
    .getByRole("group", { name: "O que é este papel?" })
    .getByText(papel, { exact: true })
    .click();
}

/** Contrato do cenário — cadastrado uma vez na vida, antes de qualquer informe. */
async function contrato(db: Db) {
  return criarFinanciamento(db, {
    instituicao: INSTITUICAO,
    data_contrato: `${ANO_BASE - 1}-03-20`,
    preco_contratado: 650000,
    numero_parcelas: 240,
  });
}

/** As sete rubricas do extrato real do ano-base 2025 — a soma fecha. */
const EXTRATO = {
  amortizacao: "16.883,52",
  juros: "43.051,23",
  seguros: "499,56",
  taxas: "0,00",
  mora: "0,00",
  multa: "0,00",
  diferenca: "167,43",
  total: "60.601,74",
  saldo: "585.815,19",
};

async function preencherRubricas(
  page: Page,
  over: Partial<typeof EXTRATO> = {},
) {
  const v = { ...EXTRATO, ...over };
  await page.getByLabel("Amortização", { exact: true }).fill(v.amortizacao);
  await page
    .getByLabel("Juros / Correção Monetária", { exact: true })
    .fill(v.juros);
  await page.getByLabel("Seguros (MIP e DFI)", { exact: true }).fill(v.seguros);
  await page.getByLabel("Taxas + FCVS", { exact: true }).fill(v.taxas);
  await page.getByLabel("Mora", { exact: true }).fill(v.mora);
  await page.getByLabel("Multa", { exact: true }).fill(v.multa);
  await page
    .getByLabel("Diferença Teórico / Pago", { exact: true })
    .fill(v.diferenca);
  await page.getByLabel("Total Pago no Exercício", { exact: true }).fill(v.total);
  await page
    .getByLabel(`Saldo Devedor em 31/12/${ANO_BASE}`, { exact: true })
    .fill(v.saldo);
}

async function irParaOInforme(page: Page) {
  await page.goto(`/obras/${OBRA_ID_SEED}/terreno/informe/${ANO_BASE}`);
  await expect(
    page.getByRole("heading", {
      name: `Informe anual de ${ANO_BASE} — passo 1 de 3`,
      exact: true,
    }),
  ).toBeVisible();
}

// ══ O informe anual ═════════════════════════════════════════════════════

test.describe("informe anual do financiamento", () => {
  test("grava, e o ESTADO GRAVADO tem as sete rubricas separadas", async ({
    page,
    db,
  }) => {
    await contrato(db);
    await irParaOInforme(page);

    // Passo 1 — o documento vem ANTES dos números (critério 10).
    await page
      .getByLabel("Extrato do exercício", { exact: true })
      .setInputFiles(pdf("extrato-ir.pdf"));
    await page
      .getByRole("button", { name: "Continuar para os números", exact: true })
      .click();

    // Passo 2 — a trava confere ao vivo.
    await preencherRubricas(page);
    await expect(
      page.getByText(
        "A soma das sete linhas fecha com o total pago no exercício",
        { exact: false },
      ),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Conferir e gravar", exact: true })
      .click();

    // Passo 3 — conferência, e só então grava.
    await expect(
      page.getByRole("heading", {
        name: `Informe anual de ${ANO_BASE} — passo 3 de 3`,
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: `Gravar informe de ${ANO_BASE}`, exact: true })
      .click();

    await expect(
      page.getByRole("heading", { name: `${ANO_BASE} fechado`, exact: true }),
    ).toBeVisible();

    // ── O que interessa: o que entrou no banco ──────────────────────────
    const gravados = await informes(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      ano_base: ANO_BASE,
      amortizacao: 16883.52,
      juros_correcao: 43051.23,
      // As sete SEPARADAS, sempre — é isso que permite recompor o custo sob
      // qualquer entendimento sem redigitar nada (critério 12).
      seguros: 499.56,
      taxas_fcvs: 0,
      mora: 0,
      multa: 0,
      diferenca_teorico_pago: 167.43,
      total_pago: 60601.74,
      saldo_devedor: 585815.19,
    });
    // O extrato foi para o acervo: número sem documento não serve na venda.
    expect(gravados[0].arquivo_path).toContain("/informe/");
  });

  test("soma que NÃO fecha é recusada, com a diferença em tela e NADA gravado", async ({
    page,
    db,
  }) => {
    await contrato(db);
    await irParaOInforme(page);
    await page
      .getByLabel("Extrato do exercício", { exact: true })
      .setInputFiles(pdf("extrato-ir.pdf"));
    await page
      .getByRole("button", { name: "Continuar para os números", exact: true })
      .click();

    // Esquecendo a linha de seguros: faltam R$ 499,56 para fechar.
    await preencherRubricas(page, { seguros: "0,00" });

    // Quem recusa é a caixa da trava (mock s4, `caixaTrava`), e a recusa NOMEIA
    // a diferença exata: sem o número, são sete linhas no escuro.
    //
    // ⚠️ Dois asserts precisos, e não um `getByText("499,56")` solto: a tela
    // mostra a diferença de propósito em DOIS lugares — a frase da recusa e a
    // linha "Diferença", em destaque. Um locator ambíguo não diria qual dos
    // dois sumiu no dia em que um deles sumir.
    const caixaTrava = page.locator('[data-trava="nao-fecha"]');
    await expect(
      caixaTrava.getByText(
        "A soma das sete linhas não fecha com o total pago no exercício: " +
          "faltam R$ 499,56.",
        { exact: false },
      ),
    ).toBeVisible();
    // O mesmo número em destaque, com o sinal que diz a direção da diferença.
    await expect(
      caixaTrava.getByText("-R$ 499,56", { exact: true }),
    ).toBeVisible();

    // E não deixa seguir: nada de "somar o resto e seguir".
    await expect(
      page.getByRole("button", { name: "Conferir e gravar", exact: true }),
    ).toBeDisabled();

    expect(await informes(db)).toHaveLength(0);
  });

  test("sem o extrato anexado, não passa do passo 1 e nada grava", async ({
    page,
    db,
  }) => {
    await contrato(db);
    await irParaOInforme(page);

    await expect(
      page.getByText("Sem o extrato anexado, este lançamento não grava", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continuar para os números", exact: true }),
    ).toBeDisabled();

    expect(await informes(db)).toHaveLength(0);
  });

  test("segundo informe do MESMO ano-base é recusado — dupla contagem", async ({
    page,
    db,
  }) => {
    const financiamentoId = await contrato(db);
    await criarInforme(db, {
      financiamento_id: financiamentoId,
      ano_base: ANO_BASE,
      amortizacao: 16883.52,
      juros_correcao: 43051.23,
      seguros: 499.56,
      taxas_fcvs: 0,
      mora: 0,
      multa: 0,
      diferenca_teorico_pago: 167.43,
      total_pago: 60601.74,
      saldo_devedor: 585815.19,
      arquivo_path: "u/informe/ja-existe.pdf",
    });

    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/informe/${ANO_BASE}`);
    await expect(
      page.getByText("Já existe um informe registrado para este ano-base", {
        exact: false,
      }),
    ).toBeVisible();
    // O motivo por extenso, não o código do banco.
    await expect(
      page.getByText("redução indevida de ganho de capital", { exact: false }),
    ).toBeVisible();

    // Continua um só.
    expect(await informes(db)).toHaveLength(1);
  });

  test("o banco recusa o segundo informe mesmo por fora da tela", async ({
    db,
  }) => {
    // A trava é ESTRUTURAL — `unique (financiamento_id, ano_base)`. Se ela
    // dependesse só da tela, um retry de rede duplicaria o custo do ano.
    const financiamentoId = await contrato(db);
    const linha = {
      financiamento_id: financiamentoId,
      ano_base: ANO_BASE,
      amortizacao: 100,
      juros_correcao: 200,
      seguros: 0,
      taxas_fcvs: 0,
      mora: 0,
      multa: 0,
      diferenca_teorico_pago: 0,
      total_pago: 300,
      saldo_devedor: 0,
      arquivo_path: "u/informe/a.pdf",
    };
    await criarInforme(db, linha);
    const repetido = await db
      .from("financiamento_informe")
      .insert(linha)
      .select("id");
    expect(repetido.error?.code).toBe("23505");
    expect(await informes(db)).toHaveLength(1);
  });

  test("o banco recusa informe cuja soma não fecha — o backstop do CHECK", async ({
    db,
  }) => {
    const financiamentoId = await contrato(db);
    const naoFecha = await db.from("financiamento_informe").insert({
      financiamento_id: financiamentoId,
      ano_base: ANO_BASE,
      amortizacao: 100,
      juros_correcao: 200,
      seguros: 0,
      taxas_fcvs: 0,
      mora: 0,
      multa: 0,
      diferenca_teorico_pago: 0,
      // Um centavo a mais: tolerância ZERO.
      total_pago: 300.01,
      saldo_devedor: 0,
      arquivo_path: "u/informe/a.pdf",
    });
    expect(naoFecha.error?.code).toBe("23514");
    expect(await informes(db)).toHaveLength(0);
  });
});

// ══ Desembolsos do terreno ══════════════════════════════════════════════

test.describe("desembolsos do terreno", () => {
  test("registra com data própria, e o ano gravado é o da DATA", async ({
    page,
    db,
  }) => {
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);

    await page
      .getByRole("group", { name: "O que é este desembolso?" })
      .getByText("ITBI", { exact: true })
      .click();
    await page.getByLabel("Valor", { exact: true }).fill("12.600,00");
    await page
      .getByRole("group", { name: "Este valor já foi pago?" })
      .getByText("Já paguei", { exact: true })
      .click();
    await page
      .getByLabel("Data em que saiu da conta", { exact: true })
      .fill(`${ANO_BASE}-02-03`);
    await anexar(
      page.locator("body"),
      "Papéis deste desembolso",
      "guia-itbi.pdf",
      "Comprovante do pagamento",
    );
    await gravar(page).click();

    await expect(
      page.getByText("registrado no custo de", { exact: false }),
    ).toBeVisible();

    const gravados = await desembolsosTerreno(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      obra_id: OBRA_ID_SEED,
      tipo: "itbi",
      valor: 12600,
      data_pagamento: `${ANO_BASE}-02-03`,
      estado: "pago",
      // Um comprovante só: a pergunta do critério 12 nunca apareceu, e nada
      // foi respondido. `null` aqui é "ninguém perguntou", e é o certo.
      debitos_mesmo_dia: null,
      debitos_mesmo_dia_respondido_em: null,
    });

    // ⚠️ O papel foi para a tabela FILHA (migration 0010), com o `papel` que
    // ele respondeu — a coluna `arquivo_path` do desembolso não existe mais.
    const papeis = await anexosDeDesembolso(db);
    expect(papeis).toHaveLength(1);
    expect(papeis[0].desembolso_id).toBe(gravados[0].id);
    expect(papeis[0].papel).toBe("comprovante");
    expect(papeis[0].arquivo_path).toContain("/terreno/");
  });

  /**
   * ⚠️ **ESTE TESTE VIROU O CONTRÁRIO no CONTAI-025, e é o ticket inteiro.**
   *
   * Ele afirmava *"desembolso PAGO sem data é recusado pela tela"*. A recusa
   * **nunca teve parecer** (D49): ela foi generalizada, sem gate fiscal, do
   * texto do **informe anual** — outra entidade, onde o anexo é FONTE e a
   * recusa continua de pé. Aqui o dado é um fato que o Mateus conhece, e
   * *"bloquear anexo-PROVA não evita erro nenhum: evita o registro"* (§A.0).
   *
   * O preço: ele **parou de usar o app** e o banco de produção está vazio.
   */
  test("desembolso PAGO sem data GRAVA — e a data continua sem default", async ({
    page,
    db,
  }) => {
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);
    await page
      .getByRole("group", { name: "O que é este desembolso?" })
      .getByText("ITBI", { exact: true })
      .click();
    await page.getByLabel("Valor", { exact: true }).fill("12.600,00");
    await page
      .getByRole("group", { name: "Este valor já foi pago?" })
      .getByText("Já paguei", { exact: true })
      .click();

    // O rótulo NOMEIA a consequência — nunca "gravar mesmo assim".
    await expect(gravar(page)).toHaveText("Gravar — e abrir as duas pendências");
    await expect(gravar(page)).toBeEnabled();
    await gravar(page).click();

    // ⚠️ O efeito OBSERVÁVEL da gravação, antes de olhar o Postgres — e ele
    // tem de ser uma frase que só existe DEPOIS de gravar. "não tem
    // ano-calendário" também está na caixa de consequência do formulário, que
    // aparece ANTES do toque: esperar por ela lê o banco com o insert em voo.
    await expect(page.getByText("registrado — sem a data")).toBeVisible();

    // ⚠️ O ESTADO GRAVADO: `pago` com `data_pagamento` NULO. Nada de hoje,
    // nada de `created_at` — critério 4.
    const [gravado] = await desembolsosTerreno(db);
    expect(gravado).toMatchObject({
      tipo: "itbi",
      valor: 12600,
      estado: "pago",
      data_pagamento: null,
    });
    expect(await anexosDeDesembolso(db)).toHaveLength(0);
  });

  test("o previsto grava SEM data — previsto não é pago", async ({
    page,
    db,
  }) => {
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);
    await page
      .getByRole("group", { name: "O que é este desembolso?" })
      .getByText("ITBI", { exact: true })
      .click();
    await page.getByLabel("Valor", { exact: true }).fill("12.600,00");
    await page
      .getByRole("group", { name: "Este valor já foi pago?" })
      .getByText("Ainda não paguei", { exact: true })
      .click();
    await expect(
      page.getByText("não entra em ano nenhum", { exact: false }),
    ).toBeVisible();
    await gravar(page).click();

    // Espera o efeito OBSERVÁVEL da gravação antes de olhar o Postgres — sem
    // isto o teste lê o banco com o insert ainda em voo. O teste de cima (o do
    // valor pago sem data) só passava porque a recusa aparece em tela.
    await expect(
      page.getByText("registrado como previsto — não entra em ano nenhum", {
        exact: false,
      }),
    ).toBeVisible();

    const gravados = await desembolsosTerreno(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      estado: "previsto",
      data_pagamento: null,
    });
  });

  test("desembolso pago sem data é completado pela tela", async ({
    page,
    db,
  }) => {
    // É exatamente o que a migration 0008 produz a partir das colunas mortas:
    // valor real, sem data e sem comprovante. Critério 23.
    await criarDesembolsoTerreno(db, {
      tipo: "pagamento_terreno",
      valor: 800000,
      estado: "pago",
      data_pagamento: null,
    });

    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);
    await expect(
      page.getByText("sem a data, este valor não tem ano-calendário", {
        exact: false,
      }),
    ).toBeVisible();

    // ⚠️ Abrir o formulário e submetê-lo têm o MESMO rótulo. Eles nunca
    // coexistem (é um ternário no cartão), mas o teste não pode depender disso
    // sem dizer: esperar o campo de data aparecer entre os dois cliques é o que
    // garante que o segundo acerta o botão do formulário ABERTO.
    const cartao = page.locator('[data-sem-data="pagamento_terreno"]');
    await cartao
      .getByRole("button", { name: "Informar a data", exact: true })
      .click();
    const campoData = cartao.getByLabel("Data em que saiu da conta", {
      exact: true,
    });
    await expect(campoData).toBeVisible();

    // ⚠️ Data futura no COMPLEMENTO tem texto PRÓPRIO (Gate 2): aqui "deixe o
    // campo vazio" não cabe — o ato existe para informar a data. A saída
    // segura é SAIR SEM GRAVAR, e ela precisava ser nomeada.
    await campoData.fill("2099-01-01");
    await cartao
      .getByRole("button", { name: "Informar a data", exact: true })
      .click();
    await expect(cartao.getByText("saia sem gravar")).toBeVisible();
    await expect(cartao.getByText("nada se perde")).toBeVisible();
    // ⚠️ E não oferece `previsto`: quem completa a data já disse que pagou
    // (critério 6). **Escopado no CARTÃO, e o escopo é a prova**: na `page`
    // inteira esta asserção media a coisa errada — casava a opção legítima
    // "Ainda não paguei" do formulário de REGISTRO, que o critério 6 manda
    // manter (`previsto` é estado legítimo; o que se proíbe é oferecê-lo como
    // SAÍDA a quem já disse que pagou). O que se prova aqui é que a mensagem
    // DESTE fluxo não o oferece.
    await expect(cartao.getByText("ainda não paguei")).toHaveCount(0);
    // E o texto do REGISTRO (que cita "ainda não paguei" de propósito, como
    // última saída) não vaza para cá — são dois atos, dois textos.
    await expect(cartao.getByText("corrija-a")).toHaveCount(0);
    await expect(cartao.getByText("deixe o campo vazio")).toHaveCount(0);

    await campoData.fill(`${ANO_BASE}-09-12`);
    await cartao
      .getByRole("button", { name: "Informar a data", exact: true })
      .click();

    // ⚠️ **CONTAI-025, critério 13 — este texto MUDOU, e a mudança é o
    // conserto.** Este desembolso não tem comprovante, e a mensagem anterior
    // era escolhida só por `faltaData`: ela afirmava que *"o valor passa a
    // compor o custo de {ano}"* quando o portão do critério 8 o mantém FORA.
    // Mensagem de sucesso que mente sobre consequência fiscal fecha a
    // pendência na cabeça do Mateus, e é a única metade que ele nunca revisa.
    await expect(
      page.getByText(
        `Data informada — o valor é de ${ANO_BASE}. Falta o comprovante:`,
        { exact: false },
      ),
    ).toBeVisible();
    await expect(page.getByText("passa a compor o custo")).toHaveCount(0);

    const gravados = await desembolsosTerreno(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0].data_pagamento).toBe(`${ANO_BASE}-09-12`);
    // O VALOR não foi tocado: o que faltava era a data, não o dinheiro.
    expect(gravados[0].valor).toBe(800000);
  });
});

// ══ O painel e a home ═══════════════════════════════════════════════════

test.describe("painel do terreno", () => {
  test("valor sem data é pendência de COMPLEMENTO no painel, e NÃO pendência fiscal na home", async ({
    page,
    db,
  }) => {
    // Critério 21: o terreno não entra no headline de "custo em risco" do
    // CONTAI-005 — o favorecido não é prestador e o documento hábil não é NF.
    await criarDesembolsoTerreno(db, {
      tipo: "pagamento_terreno",
      valor: 800000,
      estado: "pago",
      data_pagamento: null,
    });

    await page.goto(`/obras/${OBRA_ID_SEED}/terreno`);
    await expect(
      page.getByText("sem a data, este valor não tem ano-calendário", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Não bloqueia o app", { exact: false }),
    ).toBeVisible();

    await page.goto("/");
    // O bloco de PENDÊNCIAS FISCAIS continua vazio: nada de vermelho.
    await expect(
      page.getByText("Nenhuma pendência.", { exact: false }),
    ).toBeVisible();
    // E o valor sem data aparece, em bloco próprio.
    await expect(
      page.getByText("Terreno — valores sem data", { exact: true }),
    ).toBeVisible();
  });

  test("o ano corrente aparece como 'aguardando informe', nunca em silêncio", async ({
    page,
    db,
  }) => {
    const financiamentoId = await contrato(db);
    await criarInforme(db, {
      financiamento_id: financiamentoId,
      ano_base: ANO_BASE,
      amortizacao: 16883.52,
      juros_correcao: 43051.23,
      seguros: 499.56,
      taxas_fcvs: 0,
      mora: 0,
      multa: 0,
      diferenca_teorico_pago: 167.43,
      total_pago: 60601.74,
      saldo_devedor: 585815.19,
      arquivo_path: "u/informe/extrato.pdf",
    });

    await page.goto(`/obras/${OBRA_ID_SEED}/terreno`);

    const corrente = page.locator(`[data-ano="${ANO_CORRENTE}"]`);
    await expect(corrente).toHaveAttribute("data-situacao", "aguardando_informe");
    await expect(
      corrente.getByText("aguardando informe", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("menor do que a realidade", { exact: false }),
    ).toBeVisible();
    // A estimativa é ordem de grandeza, rotulada e FORA de toda soma.
    await expect(
      page.getByText("não soma em lugar nenhum", { exact: false }),
    ).toBeVisible();

    // O ano-base registrado aparece com o custo do informe: 16.883,52 + 43.051,23.
    const registrado = page.locator(`[data-ano="${ANO_BASE}"]`);
    await expect(registrado).toHaveAttribute("data-situacao", "registrado");
    await expect(registrado.getByText("59.934,75", { exact: false })).toBeVisible();
  });

  test("o saldo devedor aparece rotulado como fora da declaração", async ({
    page,
    db,
  }) => {
    const financiamentoId = await contrato(db);
    await criarInforme(db, {
      financiamento_id: financiamentoId,
      ano_base: ANO_BASE,
      amortizacao: 100,
      juros_correcao: 200,
      seguros: 0,
      taxas_fcvs: 0,
      mora: 0,
      multa: 0,
      diferenca_teorico_pago: 0,
      total_pago: 300,
      saldo_devedor: 585815.19,
      arquivo_path: "u/informe/extrato.pdf",
    });

    await page.goto(`/obras/${OBRA_ID_SEED}/terreno`);
    await expect(page.getByText("585.815,19", { exact: false })).toBeVisible();
    await expect(
      page.getByText("nunca somar, nunca virar campo de 'dívida'", {
        exact: false,
      }),
    ).toBeVisible();
  });
});


// ══ Os dois bloqueadores do Gate 2 ══════════════════════════════════════
//
// Os dois são a mesma família: **o app mostra número menor que a realidade sem
// dizer que é menor**. A direção do erro é a irreversível — custo de aquisição
// subestimado vira ganho de capital inflado no dia da venda.

test.describe("o financiamento nunca fica em silêncio (critério 16)", () => {
  test("contrato cadastrado e ZERO informes: a home NOMEIA os anos não lançados", async ({
    page,
    db,
  }) => {
    // É o estado real da obra hoje. Antes desta correção a home imprimia o
    // acumulado sem um caractere sobre o financiamento, porque a existência do
    // contrato era INFERIDA de haver informe.
    await contrato(db); // contrato de ANO_BASE - 1
    await definirNatureza(db, "financiado");

    await page.goto("/");

    // O ano JÁ FECHADO, com a consequência por extenso e a ação possível.
    const faltaLancar = page.locator(`[data-falta-lancar="${ANO_BASE}"]`);
    await expect(faltaLancar).toBeVisible();
    await expect(
      faltaLancar.getByText(
        `custo de aquisição de ${ANO_BASE} não existe no sistema`,
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      faltaLancar.getByText("é download, não pedido", { exact: false }),
    ).toBeVisible();

    // E o ano CORRENTE, que é outra coisa: o banco ainda não publicou nada.
    await expect(
      page.getByText(
        `Financiamento ${ANO_CORRENTE} — aguardando informe anual`,
        { exact: true },
      ),
    ).toBeVisible();

    // ⚠️ Nada disso é pendência fiscal: o headline de "custo em risco" do
    // CONTAI-005 não muda de código neste ticket (critério 21).
    await expect(
      page.getByText("Nenhuma pendência.", { exact: false }),
    ).toBeVisible();
  });

  test("obra SEM contrato não vê uma palavra sobre informe", async ({
    page,
    db,
  }) => {
    // Afirmar "aguardando informe" numa obra comprada à vista, que nunca terá
    // informe, seria pior que calar. A condição é o contrato, não o palpite.
    await definirNatureza(db, "a_vista");
    await criarDesembolsoTerreno(db, {
      tipo: "pagamento_terreno",
      valor: 800000,
      estado: "pago",
      data_pagamento: `${ANO_BASE}-06-10`,
    });

    await page.goto("/");
    await expect(page.getByText("aguardando informe", { exact: false })).toHaveCount(
      0,
    );
    await expect(page.getByText("falta lançar", { exact: false })).toHaveCount(0);
  });
});

test.describe("o R$ 0,00 do terreno não é apuração", () => {
  test("sem desembolso e sem informe, o painel diz que o zero é ausência de REGISTRO", async ({
    page,
  }) => {
    // O backfill das três colunas mortas foi descartado: a obra atravessou a
    // migration sem desembolso nenhum, e o terreno dela FOI pago de verdade —
    // o ano-base 2025 já foi declarado pelo CRC com o terreno dentro.
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno`);

    await expect(
      page.getByText("nada foi registrado ainda — não que nada foi pago", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("não serve para a declaração", { exact: false }),
    ).toBeVisible();
    // E a moldura de fato apurado SAI: nada de "= situação em 31/12 na ficha
    // Bens e Direitos" em cima de um zero que ninguém apurou.
    await expect(
      page.getByText("na ficha Bens e Direitos, pela parte do terreno", {
        exact: false,
      }),
    ).toHaveCount(0);
  });

  test("a home mostra a parte do terreno e o mesmo aviso", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("Terreno nesta soma:", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("nada foi registrado ainda — não que nada foi pago", {
        exact: false,
      }),
    ).toBeVisible();
  });

  test("um desembolso DATADO cala o aviso — aí o número é apuração", async ({
    page,
    db,
  }) => {
    await criarDesembolsoTerreno(db, {
      tipo: "pagamento_terreno",
      valor: 800000,
      estado: "pago",
      data_pagamento: `${ANO_BASE}-06-10`,
    });

    await page.goto(`/obras/${OBRA_ID_SEED}/terreno`);
    await expect(
      page.getByText("nada foi registrado ainda", { exact: false }),
    ).toHaveCount(0);
    await expect(
      page.getByText("na ficha Bens e Direitos, pela parte do terreno", {
        exact: false,
      }),
    ).toBeVisible();
  });
});

// ══ A porta lateral da dupla contagem (critérios 2 e 14) ════════════════

test.describe("os tipos de desembolso seguem a natureza da aquisição", () => {
  test("obra financiada NÃO oferece 'Parcela ao vendedor' nem 'Pagamento do terreno'", async ({
    page,
    db,
  }) => {
    // Se oferecesse, o débito mensal do banco entraria como linha avulsa ao
    // lado do informe do ano — o mesmo dinheiro duas vezes, e a trava
    // estrutural do critério 14 não pega, porque ela só protege o tipo que
    // nomeia ("parcela do financiamento", que não existe).
    await definirNatureza(db, "financiado");
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);

    const grupo = page.getByRole("group", {
      name: "O que é este desembolso?",
      exact: true,
    });
    await expect(
      grupo.getByText("Parcela ao vendedor", { exact: true }),
    ).toHaveCount(0);
    await expect(
      grupo.getByText("Pagamento do terreno", { exact: true }),
    ).toHaveCount(0);
    // O que sobra é o que sai do bolso dele fora do banco, mais a quitação.
    await expect(grupo.getByText("Entrada", { exact: true })).toBeVisible();
    await expect(grupo.getByText("ITBI", { exact: true })).toBeVisible();
    await expect(
      grupo.getByText("Escritura e registro", { exact: true }),
    ).toBeVisible();
    await expect(
      grupo.getByText("Quitação do financiamento", { exact: true }),
    ).toBeVisible();
  });

  test("natureza ainda não informada devolve a lista CHEIA", async ({ page }) => {
    // A obra do seed nasce com a natureza NULL. O app não inventa restrição
    // sobre fato que não sabe — a pendência de complemento já pede a resposta.
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);
    const grupo = page.getByRole("group", {
      name: "O que é este desembolso?",
      exact: true,
    });
    await expect(
      grupo.getByText("Parcela ao vendedor", { exact: true }),
    ).toBeVisible();
    await expect(
      grupo.getByText("Quitação do financiamento", { exact: true }),
    ).toBeVisible();
    await expect(
      grupo.getByText("Pagamento do terreno", { exact: true }),
    ).toBeVisible();
  });
});

// ══ Os dois defeitos da tela do informe ═════════════════════════════════

test.describe("o saldo devedor é exigido, e nada o confere além da pergunta", () => {
  test("saldo devedor em branco NÃO grava — branco não é resposta", async ({
    page,
    db,
  }) => {
    await contrato(db);
    await irParaOInforme(page);
    await page
      .getByLabel("Extrato do exercício", { exact: true })
      .setInputFiles(pdf("extrato.pdf"));
    await page
      .getByRole("button", { name: "Continuar para os números", exact: true })
      .click();

    // Tudo certo, MENOS o saldo devedor. A trava da soma fecha.
    await preencherRubricas(page, { saldo: "" });

    // Scoped em `main`: o mesmo texto também aparece na dica do rodapé, que
    // explica por que o botão está desligado. Aqui a asserção é sobre o ERRO
    // colado no campo.
    await expect(
      page
        .getByRole("main")
        .getByText("Informe o saldo devedor em 31/12 — ele está no extrato", {
          exact: false,
        }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Conferir e gravar", exact: true }),
    ).toBeDisabled();

    // ⚠️ O ESTADO GRAVADO: nada entrou.
    expect(await informes(db)).toHaveLength(0);
  });

  test("0,00 DIGITADO é afirmação e passa — o contrato pode ter sido quitado", async ({
    page,
    db,
  }) => {
    await contrato(db);
    await irParaOInforme(page);
    await page
      .getByLabel("Extrato do exercício", { exact: true })
      .setInputFiles(pdf("extrato.pdf"));
    await page
      .getByRole("button", { name: "Continuar para os números", exact: true })
      .click();
    await preencherRubricas(page, { saldo: "0,00" });

    await expect(
      page.getByRole("button", { name: "Conferir e gravar", exact: true }),
    ).toBeEnabled();
  });
});

test.describe("em aberto e penalidade nunca vão no mesmo balde (critério 13)", () => {
  test("a tela de sucesso mostra DUAS linhas, com rótulos que não se confundem", async ({
    page,
    db,
  }) => {
    await contrato(db);
    await irParaOInforme(page);
    await page
      .getByLabel("Extrato do exercício", { exact: true })
      .setInputFiles(pdf("extrato.pdf"));
    await page
      .getByRole("button", { name: "Continuar para os números", exact: true })
      .click();
    // Seguros 499,56 + taxas 0 + diferença 167,43 = 666,99 em aberto (é a cifra
    // exata do ADENDO 4); mora 200,00 + multa 100,00 = 300,00 de penalidade.
    await preencherRubricas(page, {
      mora: "200,00",
      multa: "100,00",
      total: "60.901,74",
    });
    await page
      .getByRole("button", { name: "Conferir e gravar", exact: true })
      .click();
    await page
      .getByRole("button", { name: `Gravar informe de ${ANO_BASE}`, exact: true })
      .click();

    await expect(
      page.getByRole("heading", { name: `${ANO_BASE} fechado`, exact: false }),
    ).toBeVisible();

    // Duas linhas, dois números, dois destinos. Balde único é a via pela qual o
    // FCVS vira seguro e o seguro vira mora.
    const emAberto = page.getByText("Guardado — classificação com o seu contador", {
      exact: true,
    });
    const penalidade = page.getByText("Guardado — penalidade, nunca é custo", {
      exact: true,
    });
    await expect(emAberto).toBeVisible();
    await expect(penalidade).toBeVisible();
    await expect(page.getByText("666,99", { exact: false })).toBeVisible();
    await expect(page.getByText("300,00", { exact: false })).toBeVisible();
    // E a soma dos dois NÃO aparece como número único — era o balde de antes.
    await expect(page.getByText("966,99", { exact: false })).toHaveCount(0);
  });
});

// ══ Ano-base fora da vida do contrato ═══════════════════════════════════

test("informe de ano que ainda não aconteceu é recusado pela tela", async ({
  page,
  db,
}) => {
  // O CHECK do banco só limita 1990-2999, e a rota é digitável.
  await contrato(db);
  await page.goto(`/obras/${OBRA_ID_SEED}/terreno/informe/${ANO_CORRENTE + 5}`);

  await expect(
    page.getByText(`${ANO_CORRENTE + 5} ainda não aconteceu`, { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Extrato do exercício", { exact: true }),
  ).toHaveCount(0);
  expect(await informes(db)).toHaveLength(0);
});

/**
 * ⚠️ O PIOR DOS TRÊS BURACOS DA ROTA DIGITÁVEL, e o que passou batido na
 * primeira passada do Gate 2: ano-base ANTERIOR ao contrato.
 *
 * `custoTerrenoAteOAno` soma todo informe com `ano_base <= ano`. Um informe de
 * um ano em que o financiamento nem existia sobe o acumulado de **todos** os
 * anos, inclusive os que já foram declarados — e custo inflado em Bens e
 * Direitos é redução indevida de ganho de capital, cobrada com multa. É o texto
 * do próprio `UM_INFORME_POR_ANO`.
 *
 * O CHECK do banco não alcança isto (ele só limita 1990-2999, e o piso depende
 * da data do contrato, que está em outra tabela): a tela é a única barreira.
 */
test("informe de ano ANTERIOR ao contrato é recusado — inflaria todos os anos", async ({
  page,
  db,
}) => {
  await contrato(db); // contrato de ANO_BASE - 1
  const anoAntesDoContrato = ANO_BASE - 5;
  await page.goto(
    `/obras/${OBRA_ID_SEED}/terreno/informe/${anoAntesDoContrato}`,
  );

  await expect(
    page.getByText("é anterior ao contrato", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Extrato do exercício", { exact: true }),
  ).toHaveCount(0);
  expect(await informes(db)).toHaveLength(0);
});

/** `Number("abc")` é `NaN`, e `NaN > anoCorrente` é `false`: atravessava. */
test("ano-base não numérico na URL não cai no formulário", async ({
  page,
  db,
}) => {
  await contrato(db);
  await page.goto(`/obras/${OBRA_ID_SEED}/terreno/informe/abc`);

  await expect(
    page.getByText("Ano-base inválido no endereço", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Extrato do exercício", { exact: true }),
  ).toHaveCount(0);
  expect(await informes(db)).toHaveLength(0);
});
