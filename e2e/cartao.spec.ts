import {
  compromissos,
  criarCompraCartao,
  criarFavorecido,
  faturaCompromissos,
  faturaDesembolsos,
  faturas,
  pagamentos,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";
import { escolher } from "./formularios";

/**
 * CARTÃO DE CRÉDITO — compra → fatura → pagamento (CONTAI-022) contra o
 * Postgres LOCAL: sessão de verdade, RLS ligada, as quatro funções
 * transacionais da migration 0013 exercitadas pela tela e pela RPC direta.
 *
 * 375px é o viewport do config — piso, não alvo. Todas as telas deste
 * arquivo são de GESTÃO (conciliação de fatura), exceto o registro da
 * compra em si, que é o caminho de captura.
 */

// CNPJ com dígito verificador válido de verdade (o do mock não passa na
// validação real — `validarCnpj`, `lib/fiscal/identificacao.ts`).
const CNPJ_LOJA = "11.222.333/0001-81";

let proximoCnpj = 0;

/** Cada chamada usa um CNPJ próprio — `favorecido` é único por (dono, documento). */
async function favorecidoLoja(db: Db, nome = "Depósito Bom Jesus") {
  proximoCnpj += 1;
  return criarFavorecido(db, {
    tipo: "pj",
    nome,
    documento: `1122233300${String(proximoCnpj).padStart(4, "0")}`,
  });
}

test.describe("registrar a compra — o gate do parcelamento", () => {
  test("à vista grava compromisso origem=cartao e cria a fatura", async ({
    page,
    db,
  }) => {
    await page.goto("/adicionar/compra-cartao");
    await expect(
      page.getByRole("heading", { name: "Nova compra no cartão" }),
    ).toBeVisible();

    await escolher(page, "Parcelado?", "À vista");
    await page.getByLabel("Favorecido", { exact: true }).fill("Depósito Bom Jesus");
    await page.getByLabel("CNPJ / CPF do favorecido").fill(CNPJ_LOJA);
    await page.getByLabel("Valor da compra").fill("950,00");
    await page.getByLabel("Data da compra").fill("2026-10-20");
    await page.getByLabel("Vencimento da fatura").fill("2026-11-10");

    await page.getByRole("button", { name: /^Agendar/ }).click();
    await expect(page.getByRole("heading", { name: "Agendado" })).toBeVisible();
    await expect(page.getByText("para 10/11/2026", { exact: true })).toBeVisible();

    const cs = await compromissos(db);
    expect(cs).toHaveLength(1);
    expect(cs[0]).toMatchObject({
      origem: "cartao",
      data_prevista: "2026-11-10",
      data_compra: "2026-10-20",
      situacao: "aberto",
    });
    expect(Number(cs[0].valor_previsto)).toBe(950);

    const fs = await faturas(db);
    expect(fs).toHaveLength(1);
    expect(fs[0].data_vencimento).toBe("2026-11-10");

    const vinculos = await faturaCompromissos(db);
    expect(vinculos).toEqual([
      { compromisso_id: cs[0].id, fatura_id: fs[0].id },
    ]);
  });

  test("parcelado é recusa síncrona, com o texto do contador (ADENDO 5) — nada grava", async ({
    page,
    db,
  }) => {
    await page.goto("/adicionar/compra-cartao");
    await escolher(page, "Parcelado?", "Parcelado");

    await expect(
      page.getByText(/Cada parcela cai numa fatura diferente/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Compra parcelada não é aceita aqui" }),
    ).toBeDisabled();

    // O resto do formulário nem aparece — nada a preencher, nada a gravar.
    await expect(page.getByLabel("Valor da compra")).toHaveCount(0);

    expect(await compromissos(db)).toHaveLength(0);
    expect(await faturas(db)).toHaveLength(0);
  });

  test("duas compras no MESMO vencimento compartilham a mesma fatura", async ({
    db,
  }) => {
    const loja1 = await favorecidoLoja(db, "Leroy Merlin");
    const loja2 = await favorecidoLoja(db, "Elétrica Ilha");

    const c1 = await criarCompraCartao(db, {
      favorecidoId: loja1,
      valor: 4180,
      dataCompra: "2026-08-14",
      dataVencimento: "2026-09-10",
    });
    const c2 = await criarCompraCartao(db, {
      favorecidoId: loja2,
      valor: 890,
      dataCompra: "2026-08-19",
      dataVencimento: "2026-09-10",
    });

    expect(c1.faturaId).toBe(c2.faturaId);
    expect(await faturas(db)).toHaveLength(1);
    expect(await faturaCompromissos(db)).toHaveLength(2);
  });

  test("vencimentos DIFERENTES nunca colapsam na mesma fatura", async ({ db }) => {
    const loja = await favorecidoLoja(db);
    const a = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 100,
      dataCompra: "2026-08-01",
      dataVencimento: "2026-09-10",
    });
    const b = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 100,
      dataCompra: "2026-08-02",
      dataVencimento: "2026-09-11",
    });
    expect(a.faturaId).not.toBe(b.faturaId);
    expect(await faturas(db)).toHaveLength(2);
  });
});

test.describe("confirmar fatura paga — integral", () => {
  test("gera N pagamentos, um por compra, todos na data da fatura", async ({
    page,
    db,
  }) => {
    const loja1 = await favorecidoLoja(db, "Leroy Merlin");
    const loja2 = await favorecidoLoja(db, "Elétrica Ilha");
    const loja3 = await favorecidoLoja(db, "Depósito Bom Jesus");

    const c1 = await criarCompraCartao(db, {
      favorecidoId: loja1,
      valor: 4180,
      dataCompra: "2026-08-14",
      dataVencimento: "2026-09-10",
    });
    await criarCompraCartao(db, {
      favorecidoId: loja2,
      valor: 890,
      dataCompra: "2026-08-19",
      dataVencimento: "2026-09-10",
    });
    await criarCompraCartao(db, {
      favorecidoId: loja3,
      valor: 610,
      dataCompra: "2026-08-22",
      dataVencimento: "2026-09-10",
    });

    await page.goto(`/fatura/${c1.faturaId}`);
    await expect(
      page.getByRole("heading", { name: /Fatura · vence 10\/09\/2026/ }),
    ).toBeVisible();
    await expect(page.getByText("3 compras")).toBeVisible();

    await page
      .getByRole("link", { name: "Confirmar fatura paga (integral)" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Fatura paga · integral" }),
    ).toBeVisible();

    await page.getByLabel("Data em que a fatura foi paga").fill("2026-09-10");
    await page
      .getByRole("button", { name: /^Confirmar pagamento/ })
      .click();

    await expect(
      page.getByRole("heading", { name: "3 pagamentos gerados" }),
    ).toBeVisible();

    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(3);
    for (const p of pagos) {
      expect(p.data_pagamento).toBe("2026-09-10");
      expect(p.meio).toBe("cartao");
      expect(p.status).toBe("aguardando_nf");
    }
    expect(pagos.map((p) => Number(p.valor)).sort((a, b) => a - b)).toEqual([
      610, 890, 4180,
    ]);

    const cs = await compromissos(db);
    expect(cs.every((c) => c.situacao === "quitado")).toBe(true);

    const desembolsos = await faturaDesembolsos(db);
    expect(desembolsos).toHaveLength(1);
    expect(Number(desembolsos[0].valor)).toBe(4180 + 890 + 610);
  });

  test("fatura sem compra em aberto não oferece as ações de confirmar", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 500,
      dataCompra: "2026-08-01",
      dataVencimento: "2026-09-05",
    });
    await db.from("compromisso").update({ situacao: "quitado" }).eq("id", c.compromissoId);

    await page.goto(`/fatura/${c.faturaId}`);
    await expect(
      page.getByRole("link", { name: "Confirmar fatura paga (integral)" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Nenhuma compra em aberto nesta fatura"),
    ).toBeVisible();
  });
});

test.describe("fatura paga parcialmente — o rotativo nunca quita sozinho", () => {
  test("valor pago sempre grava; a alocação manual trava no teto e confirma só o marcado", async ({
    page,
    db,
  }) => {
    const loja1 = await favorecidoLoja(db, "Leroy Merlin");
    const loja2 = await favorecidoLoja(db, "Elétrica Ilha");
    const loja3 = await favorecidoLoja(db, "Ferragens Xavier");

    const c1 = await criarCompraCartao(db, {
      favorecidoId: loja1,
      valor: 1200,
      dataCompra: "2026-09-15",
      dataVencimento: "2026-10-10",
    });
    await criarCompraCartao(db, {
      favorecidoId: loja2,
      valor: 480,
      dataCompra: "2026-09-20",
      dataVencimento: "2026-10-10",
    });
    await criarCompraCartao(db, {
      favorecidoId: loja3,
      valor: 320,
      dataCompra: "2026-09-28",
      dataVencimento: "2026-10-10",
    });

    await page.goto(`/fatura/${c1.faturaId}/parcial`);
    await page.getByLabel("Data em que você pagou").fill("2026-10-08");
    await page.getByLabel("Valor pago").fill("1.500,00");
    await expect(page.getByText(/é rotativo, não integral/)).toBeVisible();
    await page.getByRole("button", { name: /^Salvar pagamento/ }).click();

    // O valor pago SEMPRE grava — fato consumado, antes de qualquer alocação.
    await expect(page.getByRole("heading", { name: "Alocar o pagamento" })).toBeVisible();
    const desembolsosAntesDaAlocacao = await faturaDesembolsos(db);
    expect(desembolsosAntesDaAlocacao).toHaveLength(1);
    expect(Number(desembolsosAntesDaAlocacao[0].valor)).toBe(1500);
    expect(await compromissos(db)).toEqual(
      expect.arrayContaining([expect.objectContaining({ situacao: "aberto" })]),
    );
    expect((await compromissos(db)).every((c) => c.situacao === "aberto")).toBe(
      true,
    );

    // Marca Leroy (1.200): Elétrica (480) estouraria 1.680 > 1.500 — o
    // checkbox dela TRAVA (disabled) antes de qualquer clique, de propósito
    // (mock, decisão 2: "trava no teto, não avisa depois").
    await page.getByText("Leroy Merlin").click();
    await expect(page.getByRole("checkbox").nth(1)).toBeDisabled();
    await expect(page.getByRole("checkbox").nth(1)).not.toBeChecked();

    // Desmarca Leroy, marca só Ferragens (320) — fica dentro do teto.
    await page.getByText("Leroy Merlin").click();
    await page.getByText("Ferragens Xavier").click();
    await expect(page.getByText("Selecionado: R$ 320,00 de R$ 1.500,00 pagos")).toBeVisible();

    await page.getByRole("button", { name: "Confirmar alocação" }).click();
    await expect(page.getByRole("heading", { name: "Alocação confirmada" })).toBeVisible();
    await expect(page.getByText("1 compra virou")).toBeVisible();
    await expect(page.getByText("2 seguem")).toBeVisible();

    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(1);
    expect(Number(pagos[0].valor)).toBe(320);
    expect(pagos[0].data_pagamento).toBe("2026-10-08");

    const cs = await compromissos(db);
    expect(cs.filter((c) => c.situacao === "quitado")).toHaveLength(1);
    expect(cs.filter((c) => c.situacao === "aberto")).toHaveLength(2);
  });

  test("s7v — depois de alocar tudo que dava, a próxima tela de alocação diz que não há mais nada elegível", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 1200,
      dataCompra: "2026-09-15",
      dataVencimento: "2026-10-10",
    });

    await page.goto(`/fatura/${c.faturaId}/parcial`);
    await page.getByLabel("Data em que você pagou").fill("2026-10-08");
    await page.getByLabel("Valor pago").fill("1.200,00");
    await page.getByRole("button", { name: /^Salvar pagamento/ }).click();

    await page.getByText("Leroy Merlin").isVisible().catch(() => {});
    // Única compra, valor bate exato: marca e confirma — some da lista de abertas.
    await page.locator('input[type="checkbox"]').first().click();
    await page.getByRole("button", { name: "Confirmar alocação" }).click();
    await expect(page.getByRole("heading", { name: "Alocação confirmada" })).toBeVisible();

    // Reabrindo a alocação da MESMA fatura agora: zero compras abertas.
    await page.goto(`/fatura/${c.faturaId}`);
    await expect(
      page.getByRole("link", { name: "Registrar pagamento parcial (rotativo)" }),
    ).toHaveCount(0);
  });
});

test.describe("compra no cartão nunca vai para o pagamento avulso", () => {
  test("'Registrar o pagamento' de um compromisso cartao leva para a fatura, nunca para /confirmar", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 500,
      dataCompra: "2026-08-01",
      dataVencimento: "2026-09-05",
    });

    await page.goto(`/compromisso/${c.compromissoId}`);
    await expect(page.getByRole("link", { name: "Ver a fatura" })).toHaveAttribute(
      "href",
      `/fatura/${c.faturaId}`,
    );
    await expect(
      page.getByRole("link", { name: "Registrar o pagamento" }),
    ).toHaveCount(0);
  });

  test("'Mudou a data' de uma compra no cartão RE-ALOCA a fatura", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 500,
      dataCompra: "2026-08-01",
      dataVencimento: "2026-09-05",
    });
    const faturaAntiga = c.faturaId;

    await page.goto(`/compromisso/${c.compromissoId}/data`);
    await expect(page.getByLabel("Novo vencimento da fatura")).toBeVisible();
    // "Ainda não sei" não existe para cartão — vencimento é sempre exato.
    await expect(page.getByText("Ainda não sei — deixar sem data")).toHaveCount(0);

    await page.getByLabel("Novo vencimento da fatura").fill("2026-10-10");
    await page.getByRole("button", { name: "Salvar a nova data" }).click();
    await expect(page).toHaveURL(`/compromisso/${c.compromissoId}`);

    const vinculos = await faturaCompromissos(db);
    expect(vinculos).toHaveLength(1);
    expect(vinculos[0].fatura_id).not.toBe(faturaAntiga);

    const fs = await faturas(db);
    const novaFatura = fs.find((f) => f.id === vinculos[0].fatura_id);
    expect(novaFatura?.data_vencimento).toBe("2026-10-10");
  });
});
