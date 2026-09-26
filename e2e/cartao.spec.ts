import { OBRA_ID_SEED } from "./ambiente";
import {
  compromissos,
  criarCompraCartao,
  criarDocumento,
  criarFavorecido,
  favorecidos,
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

/**
 * CONTAI-064 — a compra no cartão HERDA favorecido/CNPJ/valor da nota de
 * origem.
 *
 * O que estes testes travam é o relato com screenshot que gerou a D79:
 * *"vincular pagamento via cartão não está preenchendo os dados do favorecido
 * automaticamente, mesmo sendo vinculado a nota fiscal"*. O `router.push` para
 * `/adicionar/compra-cartao` ia SEM parâmetro nenhum, e a tela nascia vazia
 * depois de o app já ter resolvido favorecido, CNPJ e valor um passo atrás.
 *
 * ⚠️ O que estes testes **não** afirmam: que o custo nasce ligado. A origem
 * fica gravada em `compromisso.documento_origem_id` e **não** sobrevive à
 * quitação da fatura — é o CONTAI-065, ticket separado. É por isso que a
 * asserção do texto da confirmação está aqui: promessa a mais nessa tela é
 * afirmação que morre na quitação.
 */
test.describe("herança da nota de origem (CONTAI-064)", () => {
  /** A nota do depósito, com CNPJ que passa na validação real de dígito. */
  async function notaDaLoja(db: Db, obraId?: string) {
    const loja = await criarFavorecido(db, {
      tipo: "pj",
      nome: "Depósito Bom Jesus",
      documento: "11222333000181",
    });
    const documentoId = await criarDocumento(db, {
      ...(obraId ? { obra_id: obraId } : {}),
      favorecido_id: loja,
      tipo: "nf_material",
      classificacao: "material",
      valor: 950,
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    return { loja, documentoId };
  }

  test("chega preenchida, grava documento_origem_id e NÃO promete vínculo de custo", async ({
    page,
    db,
  }) => {
    const { documentoId } = await notaDaLoja(db);

    await page.goto(`/adicionar/compra-cartao?documento=${documentoId}`);
    // Mesmo subtítulo literal do registro de pagamento que nasce ligado.
    await expect(page.getByText("Já nasce ligado a R$ 950,00")).toBeVisible();
    // O vínculo é afirmado e desfazível ANTES de salvar, como no pagamento.
    await expect(page.getByText("Ligado a:")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Desfazer o vínculo antes de salvar" }),
    ).toBeVisible();

    await escolher(page, "Parcelado?", "À vista");

    // Os dois do favorecido vêm SEM CAMPO (adendo de 2026-08-18): quem recebe
    // o dinheiro é atributo da nota, não do desembolso.
    const herdado = page.getByRole("group", { name: "Favorecido da nota" });
    await expect(
      herdado.getByText("Favorecido — da NF de material de R$ 950,00", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(herdado.getByText("Depósito Bom Jesus")).toBeVisible();
    await expect(herdado.getByText(CNPJ_LOJA)).toBeVisible();
    await expect(page.getByLabel("Favorecido", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("CNPJ / CPF do favorecido")).toHaveCount(0);

    // O VALOR é o único dos três que diverge legitimamente: sugestão editável,
    // com a origem dita no próprio campo.
    await expect(page.getByLabel("Valor da compra")).toHaveValue("950,00");
    await expect(page.getByLabel("Valor da compra")).toBeEditable();
    await expect(page.getByText("Vem da nota — valor da nota.")).toBeVisible();

    // Critério 9: a saída para corrigir o emitente volta PARA CÁ, e não para
    // um `/adicionar/pagamento` vazio (que trocaria o meio de pagamento em
    // silêncio).
    await expect(
      page.getByRole("link", { name: "Corrigir na nota" }),
    ).toHaveAttribute(
      "href",
      `/documento/${documentoId}/corrigir/emitente?voltar=compra-cartao`,
    );

    await page.getByLabel("Data da compra").fill("2026-10-20");
    await page.getByLabel("Vencimento da fatura").fill("2026-11-10");
    await page.getByRole("button", { name: /^Agendar/ }).click();
    await expect(page.getByRole("heading", { name: "Agendado" })).toBeVisible();

    // ⚠️ O TEXTO É O CRITÉRIO 10: "anotada como origem", nunca "ligada".
    await expect(page.getByText("Nota de origem:")).toBeVisible();
    await expect(
      page.getByText("ainda não é vínculo de custo", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("não vem ligado a esta nota automaticamente", {
        exact: false,
      }),
    ).toBeVisible();

    const cs = await compromissos(db);
    expect(cs).toHaveLength(1);
    expect(cs[0].documento_origem_id).toBe(documentoId);
    expect(cs[0].origem).toBe("cartao");
    expect(Number(cs[0].valor_previsto)).toBe(950);

    // ⚠️ NENHUM FAVORECIDO NOVO. O CNPJ herdado grava só dígitos, como está na
    // nota: a dedup é pela chave (dono, documento), e gravar a máscara criaria
    // uma segunda linha da MESMA empresa na ficha Pagamentos Efetuados — o
    // duplicado que a herança existe justamente para impedir.
    expect(await favorecidos(db)).toHaveLength(1);
  });

  test("nota de OUTRA obra: banner antes de salvar e documento_origem_id nulo", async ({
    page,
    db,
  }) => {
    const { data, error } = await db
      .from("obra")
      .insert({ nome: "Casa do Morro", data_inicio_obra: "2026-03-15" })
      .select("id")
      .single();
    expect(error).toBeNull();
    const { documentoId } = await notaDaLoja(db, data!.id);

    await page.goto(`/adicionar/compra-cartao?documento=${documentoId}`);
    await expect(
      page.getByText("Esta compra não vai nascer ligada à nota."),
    ).toBeVisible();
    await expect(page.getByText("obras diferentes", { exact: false })).toBeVisible();
    // E o subtítulo NÃO promete o que a gravação não vai fazer.
    await expect(page.getByText("Já nasce ligado a R$ 950,00")).toHaveCount(0);

    await escolher(page, "Parcelado?", "À vista");
    await page.getByLabel("Data da compra").fill("2026-10-20");
    await page.getByLabel("Vencimento da fatura").fill("2026-11-10");
    await page.getByRole("button", { name: /^Agendar/ }).click();
    await expect(page.getByRole("heading", { name: "Agendado" })).toBeVisible();

    // Sem origem gravada, a confirmação não diz nada sobre nota nenhuma: o
    // banner já avisou ANTES do clique.
    await expect(page.getByText("Nota de origem:")).toHaveCount(0);

    const cs = await compromissos(db);
    expect(cs).toHaveLength(1);
    expect(cs[0].documento_origem_id).toBeNull();
    expect(cs[0].obra_id).toBe(OBRA_ID_SEED);
  });

  test("trocar para Cartão leva a nota — e respeita quem desfez o vínculo antes", async ({
    page,
    db,
  }) => {
    const { documentoId } = await notaDaLoja(db);

    // Caminho normal: o contexto já resolvido viaja para a compra.
    await page.goto(`/adicionar/pagamento?documento=${documentoId}`);
    await escolher(page, "Como foi pago", "Cartão");
    await expect(page).toHaveURL(
      `/adicionar/compra-cartao?documento=${documentoId}`,
    );
    await expect(page.getByText("Ligado a:")).toBeVisible();

    // Critério 1: quem DESFEZ o vínculo pediu para a compra nascer sem herança
    // nenhuma — e o redirect usa o estado, não o parâmetro cru da URL.
    await page.goto(`/adicionar/pagamento?documento=${documentoId}`);
    await page
      .getByRole("button", { name: "Desfazer o vínculo antes de salvar" })
      .click();
    await escolher(page, "Como foi pago", "Cartão");
    await expect(page).toHaveURL("/adicionar/compra-cartao");
    await expect(page.getByText("Ligado a:")).toHaveCount(0);

    await escolher(page, "Parcelado?", "À vista");
    await expect(page.getByLabel("Favorecido", { exact: true })).toBeEditable();
    await expect(page.getByLabel("CNPJ / CPF do favorecido")).toBeEditable();
    await expect(page.getByLabel("Valor da compra")).toHaveValue("");
    await expect(
      page.getByRole("group", { name: "Favorecido da nota" }),
    ).toHaveCount(0);
  });

  test("'Corrigir na nota' devolve para a COMPRA, com o nome novo", async ({
    page,
    db,
  }) => {
    const { documentoId } = await notaDaLoja(db);

    await page.goto(`/adicionar/compra-cartao?documento=${documentoId}`);
    await escolher(page, "Parcelado?", "À vista");
    await page.getByRole("link", { name: "Corrigir na nota" }).click();
    await expect(page).toHaveURL(
      `/documento/${documentoId}/corrigir/emitente?voltar=compra-cartao`,
    );

    await page
      .getByRole("button", { name: "Só aqui no app — eu digitei errado" })
      .click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page
      .getByLabel("Nome como está impresso na nota")
      .fill("Depósito Bom Jesus ME");
    // A afirmação do CNPJ é obrigatória — é o único checkbox desta tela.
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Gravar a correção" }).click();
    await expect(
      page.getByRole("heading", { name: "Nome corrigido ✓" }),
    ).toBeVisible();

    // ⚠️ Sem o critério 9 este botão dizia "Voltar ao pagamento" e levava para
    // `/adicionar/pagamento` — trocando o meio de pagamento da compra sem
    // avisar.
    await page
      .getByRole("link", { name: "Voltar para a compra — com o nome novo" })
      .click();
    await expect(page).toHaveURL(
      `/adicionar/compra-cartao?documento=${documentoId}`,
    );
    await escolher(page, "Parcelado?", "À vista");
    await expect(
      page
        .getByRole("group", { name: "Favorecido da nota" })
        .getByText("Depósito Bom Jesus ME"),
    ).toBeVisible();
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
