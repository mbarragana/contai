import { type Page } from "@playwright/test";

import { OBRA_ID_SEED, USER_ID_SEED } from "./ambiente";
import {
  compromissos,
  criarCompraCartao,
  criarDocumento,
  criarFavorecido,
  criarPreVinculo,
  criarVinculo,
  favorecidos,
  faturaCompromissos,
  faturaDesembolsos,
  faturas,
  pagamentos,
  preVinculos,
  vinculos,
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

/** ISO de hoje no fuso do aparelho — o mesmo `hojeIso()` que o app usa. */
function hoje(): string {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function maisDias(dias: number): string {
  const d = new Date(`${hoje()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

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

/**
 * CONTAI-066 — backfill de compra antiga: quando o vencimento que o Mateus
 * digitou já passou, a tela diz para onde ir e o rodapé leva direto à
 * confirmação da fatura. Datas relativas a hoje de propósito: data fixa em
 * arquivo faz o teste trocar de significado sozinho quando a data passa.
 *
 * O que estes testes NÃO afirmam: que a fatura foi paga. Vencido ≠ pago — o
 * mecanismo (compra nasce sempre agendamento) é o mesmo nos dois casos, e o
 * rótulo "Agendar — não entra no custo" é asserido literal aqui (critério 4).
 */
test.describe("compra retroativa — wayfinding até confirmar a fatura (CONTAI-066)", () => {
  /** Preenche o formulário inteiro, menos o vencimento (que é a variável). */
  async function preencherCompra(
    page: Page,
    { dataCompra }: { dataCompra: string },
  ) {
    await page.goto("/adicionar/compra-cartao");
    await escolher(page, "Parcelado?", "À vista");
    await page.getByLabel("Favorecido", { exact: true }).fill("Depósito Bom Jesus");
    await page.getByLabel("CNPJ / CPF do favorecido").fill(CNPJ_LOJA);
    await page.getByLabel("Valor da compra").fill("1.240,00");
    await page.getByLabel("Data da compra").fill(dataCompra);
  }

  const FRASE_NO_FORMULARIO =
    /Esta fatura já venceu: o próximo passo depois de salvar é confirmar esse pagamento e anexar o comprovante da fatura/;
  const FRASE_NO_AGENDADO =
    /Esta fatura já venceu\. O próximo passo é confirmar esse pagamento e anexar o comprovante da fatura/;

  test("vencimento FUTURO: nenhum texto extra, e o rodapé continua em 'Ver a fatura'", async ({
    page,
    db,
  }) => {
    await preencherCompra(page, { dataCompra: hoje() });

    // Antes de digitar o vencimento, nada — `"" <= hoje` seria `true` sem o
    // guard de string vazia, e a frase apareceria num campo ainda em branco.
    await expect(page.getByText(FRASE_NO_FORMULARIO)).toHaveCount(0);

    // Fronteira do `<=`: vencer HOJE já conta como vencida.
    await page.getByLabel("Vencimento da fatura").fill(hoje());
    await expect(page.getByText(FRASE_NO_FORMULARIO)).toBeVisible();

    // E some ao empurrar o vencimento para o futuro — o banner reage ao campo.
    await page.getByLabel("Vencimento da fatura").fill(maisDias(30));
    await expect(page.getByText(FRASE_NO_FORMULARIO)).toHaveCount(0);

    await expect(
      page.getByRole("button", { name: "Agendar — não entra no custo" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Agendar/ }).click();
    await expect(page.getByRole("heading", { name: "Agendado" })).toBeVisible();

    await expect(page.getByText(FRASE_NO_AGENDADO)).toHaveCount(0);

    const fs = await faturas(db);
    expect(fs).toHaveLength(1);
    await expect(
      page.getByRole("link", { name: "Ver a fatura" }),
    ).toHaveAttribute("href", `/fatura/${fs[0].id}`);
    await expect(
      page.getByRole("link", { name: "Confirmar o pagamento" }),
    ).toHaveCount(0);
  });

  test("vencimento JÁ PASSADO: frase no formulário, Dica no 'Agendado' e rodapé direto para /confirmar", async ({
    page,
    db,
  }) => {
    await preencherCompra(page, { dataCompra: maisDias(-150) });
    await page.getByLabel("Vencimento da fatura").fill(maisDias(-120));

    await expect(page.getByText(FRASE_NO_FORMULARIO)).toBeVisible();
    // Critério 4: o rótulo do botão é o mesmo, byte a byte, fatura vencida ou
    // não — o mecanismo não muda, só o wayfinding.
    await expect(
      page.getByRole("button", { name: "Agendar — não entra no custo" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /^Agendar/ }).click();
    await expect(page.getByRole("heading", { name: "Agendado" })).toBeVisible();

    // A Dica fiscal de sempre continua lá, e a de wayfinding entra ao lado —
    // não no lugar dela (critério 2).
    await expect(page.getByText(/A data da compra/)).toBeVisible();
    await expect(page.getByText(FRASE_NO_AGENDADO)).toBeVisible();

    const fs = await faturas(db);
    expect(fs).toHaveLength(1);
    await expect(page.getByRole("link", { name: "Ver a fatura" })).toHaveCount(0);
    const atalho = page.getByRole("link", { name: "Confirmar o pagamento" });
    await expect(atalho).toHaveAttribute(
      "href",
      `/fatura/${fs[0].id}/confirmar`,
    );

    // O atalho tem de POUSAR na tela de confirmação — href certo apontando
    // para rota que não abre seria o mesmo beco sem saída do relato.
    await atalho.click();
    await expect(
      page.getByRole("heading", { name: "Fatura paga · integral" }),
    ).toBeVisible();

    // Nada de pagamento gravado por ter passado por aqui: quem afirma que a
    // fatura foi paga é o clique DENTRO de /confirmar (Pre-mortem 1).
    expect(await pagamentos(db)).toHaveLength(0);
    const cs = await compromissos(db);
    expect(cs).toHaveLength(1);
    expect(cs[0].situacao).toBe("aberto");
    expect(cs[0].origem).toBe("cartao");
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
 * ⚠️ A origem gravada em `compromisso.documento_origem_id` PASSOU a sobreviver
 * à quitação da fatura no CONTAI-065 (migration 0020), e o texto desta tela foi
 * reescrito no mesmo diff: ele mandava religar à mão um vínculo que o app já
 * faz. O que o vínculo replicado vira em custo é asserido em
 * `e2e/vinculo-de-origem.spec.ts`; aqui só se afirma o que a tela de CAPTURA
 * promete.
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

  test("chega preenchida, grava documento_origem_id e não promete CUSTO nenhum", async ({
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

    // ⚠️ O TEXTO É O CRITÉRIO 10 — reescrito pelo CONTAI-065: o que a tela
    // NÃO pode prometer é CUSTO (nada entrou em custo aqui, e quem limita é o
    // documento hábil). O vínculo, esse sim, passou a ser promessa cumprida
    // pela migration 0020 — e a frase que mandava religar à mão saiu.
    await expect(page.getByText("Nota de origem:")).toBeVisible();
    await expect(
      page.getByText("já nasce ligado a esta nota", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("Quem limita quanto disso vira custo", { exact: false }),
    ).toBeVisible();
    // ⚠️ A frase que mandava religar à mão SAIU: ela pedia um trabalho que a
    // migration 0020 já faz, e aviso falso é o que ensina a ignorar aviso.
    await expect(
      page.getByText("não vem ligado a esta nota automaticamente", {
        exact: false,
      }),
    ).toHaveCount(0);

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

/**
 * CONTAI-071 — "Registrar outra compra" tem de VOLTAR para o formulário vazio.
 *
 * O bug que estes dois testes travam não era de estado, era de roteamento: o
 * botão era um `BotaoLink` para `/adicionar/compra-cartao`, a MESMA URL onde o
 * usuário já estava, e o Next não remonta um segmento cuja chave de cache não
 * mudou (a chave ignora a query string). O clique não fazia nada.
 */
test.describe("registrar outra compra volta ao formulário vazio", () => {
  /** A mesma nota do bloco de herança, com CNPJ que passa na validação real. */
  async function notaDoDeposito(db: Db) {
    const loja = await criarFavorecido(db, {
      tipo: "pj",
      nome: "Depósito Bom Jesus",
      documento: "11222333000181",
    });
    return criarDocumento(db, {
      favorecido_id: loja,
      tipo: "nf_material",
      classificacao: "material",
      valor: 950,
      destinatario_cpf_ok: true,
      status: "registrado",
    });
  }

  /** Preenche e agenda uma compra avulsa, do zero. */
  async function agendarCompraAvulsa(page: Page, vencimento: string) {
    await escolher(page, "Parcelado?", "À vista");
    await page
      .getByLabel("Favorecido", { exact: true })
      .fill("Depósito Bom Jesus");
    await page.getByLabel("CNPJ / CPF do favorecido").fill(CNPJ_LOJA);
    await page.getByLabel("Valor da compra").fill("950,00");
    await page.getByLabel("Data da compra").fill("2026-10-20");
    await page.getByLabel("Vencimento da fatura").fill(vencimento);
    await page.getByRole("button", { name: /^Agendar/ }).click();
    await expect(page.getByRole("heading", { name: "Agendado" })).toBeVisible();
  }

  test("o clique volta ao Passo 2 sem reload e sem resíduo da compra anterior", async ({
    page,
    db,
  }) => {
    await page.goto("/adicionar/compra-cartao");
    await agendarCompraAvulsa(page, "2026-11-10");

    // Sentinela de RELOAD: uma propriedade em `window` não sobrevive a um
    // carregamento novo do documento. Se ela continuar lá depois do clique, a
    // volta ao formulário foi client-side — que é o critério 1 ("sem depender
    // de `window.location` nem de recarregar a página").
    await page.evaluate(() => {
      (window as unknown as Record<string, boolean>).__semReload = true;
    });

    // ⚠️ `button`, não `link`: o elemento deixou de ser um `BotaoLink`.
    await page
      .getByRole("button", { name: "Registrar outra compra" })
      .click();

    await expect(
      page.getByRole("heading", { name: "Nova compra no cartão" }),
    ).toBeVisible();
    await expect(page.getByText("Passo 2 de 2 ↓")).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, boolean>).__semReload,
      ),
    ).toBe(true);

    // Campo fiscal volta SEM resposta nenhuma marcada — não há default aqui, e
    // muito menos herdado da compra anterior.
    await expect(page.getByRole("radio", { name: "À vista" })).not.toBeChecked();
    await expect(
      page.getByRole("radio", { name: "Parcelado" }),
    ).not.toBeChecked();

    await escolher(page, "Parcelado?", "À vista");
    await expect(page.getByLabel("Favorecido", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("CNPJ / CPF do favorecido")).toHaveValue("");
    await expect(page.getByLabel("Valor da compra")).toHaveValue("");
    await expect(page.getByLabel("Data da compra")).toHaveValue("");
    await expect(page.getByLabel("Vencimento da fatura")).toHaveValue("");

    // A tela voltou, mas nada foi gravado de novo pelo caminho de volta.
    expect(await compromissos(db)).toHaveLength(1);
  });

  test("a herança da nota não vaza para a próxima compra — nem no clique, nem no F5", async ({
    page,
    db,
  }) => {
    const documentoId = await notaDoDeposito(db);

    await page.goto(`/adicionar/compra-cartao?documento=${documentoId}`);
    await expect(page.getByText("Ligado a:")).toBeVisible();
    await escolher(page, "Parcelado?", "À vista");
    await expect(page.getByLabel("Valor da compra")).toHaveValue("950,00");
    await page.getByLabel("Data da compra").fill("2026-10-20");
    await page.getByLabel("Vencimento da fatura").fill("2026-11-10");
    await page.getByRole("button", { name: /^Agendar/ }).click();
    await expect(page.getByRole("heading", { name: "Agendado" })).toBeVisible();
    await expect(page.getByText("Nota de origem:")).toBeVisible();

    await page
      .getByRole("button", { name: "Registrar outra compra" })
      .click();

    await expect(
      page.getByRole("heading", { name: "Nova compra no cartão" }),
    ).toBeVisible();
    // Critério 4: a query string sai da barra, senão o F5 abaixo ressuscitaria
    // a herança.
    await expect(page).toHaveURL("/adicionar/compra-cartao");
    // Critério 3: nada de vínculo na tela — nem o bloco, nem o subtítulo.
    await expect(page.getByText("Ligado a:")).toHaveCount(0);
    await expect(page.getByText("Já nasce ligado a R$ 950,00")).toHaveCount(0);

    // E o F5, que é o contorno que o Mateus fazia à mão, também vem limpo.
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Nova compra no cartão" }),
    ).toBeVisible();
    await expect(page).toHaveURL("/adicionar/compra-cartao");
    await expect(page.getByText("Ligado a:")).toHaveCount(0);

    // O favorecido volta DIGITÁVEL (sem o bloco herdado da nota) e a segunda
    // compra grava sem vínculo nenhum — vencimento diferente para o teste
    // achar cada uma sem depender da ordem de `created_at`.
    await escolher(page, "Parcelado?", "À vista");
    await expect(
      page.getByRole("group", { name: "Favorecido da nota" }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Valor da compra")).toHaveValue("");
    await page
      .getByLabel("Favorecido", { exact: true })
      .fill("Depósito Bom Jesus");
    await page.getByLabel("CNPJ / CPF do favorecido").fill(CNPJ_LOJA);
    await page.getByLabel("Valor da compra").fill("120,00");
    await page.getByLabel("Data da compra").fill("2026-11-03");
    await page.getByLabel("Vencimento da fatura").fill("2026-12-10");
    await page.getByRole("button", { name: /^Agendar/ }).click();
    await expect(page.getByRole("heading", { name: "Agendado" })).toBeVisible();
    // A confirmação da SEGUNDA compra não fala de nota nenhuma.
    await expect(page.getByText("Nota de origem:")).toHaveCount(0);

    const cs = await compromissos(db);
    expect(cs).toHaveLength(2);
    const primeira = cs.find((c) => c.data_prevista === "2026-11-10");
    const segunda = cs.find((c) => c.data_prevista === "2026-12-10");
    expect(primeira!.documento_origem_id).toBe(documentoId);
    expect(segunda!.documento_origem_id).toBeNull();
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

  /**
   * **CONTAI-073, critério 18** — corrigir o valor previsto de UMA compra e as
   * quatro telas da fatura refletirem na leitura seguinte, sem ação nenhuma de
   * sincronização.
   *
   * ⚠️ O que este teste trava é a AUSÊNCIA de snapshot: o total da fatura é
   * derivado de `compromisso.valor_previsto` a cada leitura (o `reduce` das
   * quatro telas), nunca gravado numa coluna. Se alguém "otimizar" isso para
   * uma coluna de total, este teste fica vermelho — e é para isso que ele está
   * aqui, no arquivo do cartão, e não no do compromisso.
   *
   * ⚠️ Sem impacto fiscal: o pagamento da fatura ainda não aconteceu, e o custo
   * de aquisição nasce na data do PAGAMENTO — não há número declarado em jogo.
   */
  test("valor previsto corrigido aparece nas QUATRO telas da fatura, sem sincronizar nada", async ({
    page,
    db,
  }) => {
    const loja1 = await favorecidoLoja(db, "Leroy Merlin");
    const loja2 = await favorecidoLoja(db, "Elétrica Ilha");
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

    // A correção pela TELA, não pela RPC: é o caminho do Mateus.
    await page.goto(`/compromisso/${c1.compromissoId}/valor`);
    await page.getByLabel("Novo valor previsto").fill("1.700,00");
    await page.getByLabel("Motivo da correção").fill("li o valor errado no cupom");
    await page.getByRole("button", { name: "Salvar o novo valor" }).click();
    await page.waitForURL(/\/compromisso\/[0-9a-f-]+$/);

    // 1. `/fatura/[id]` — a linha da compra e o total das abertas.
    await page.goto(`/fatura/${c1.faturaId}`);
    await expect(page.getByText("R$ 1.700,00").first()).toBeVisible();
    await expect(page.getByText("R$ 1.200,00")).toHaveCount(0);
    // 1.700 + 480 = 2.180 — o total é recalculado, nunca lido de coluna.
    await expect(page.getByText("R$ 2.180,00").first()).toBeVisible();

    // 2. `/fatura/[id]/confirmar` (integral).
    await page.goto(`/fatura/${c1.faturaId}/confirmar`);
    await expect(page.getByText("R$ 1.700,00").first()).toBeVisible();
    await expect(page.getByText("R$ 1.200,00")).toHaveCount(0);

    // 3. `/fatura/[id]/parcial` (rotativo).
    await page.goto(`/fatura/${c1.faturaId}/parcial`);
    await expect(page.getByText("R$ 1.700,00").first()).toBeVisible();
    await expect(page.getByText("R$ 1.200,00")).toHaveCount(0);

    // 4. `/fatura/[id]/alocar` — alcançada gravando o desembolso parcial. O
    // teto de alocação passa a ser conferido contra o valor CORRIGIDO.
    await page.getByLabel("Data em que você pagou").fill("2026-10-08");
    await page.getByLabel("Valor pago").fill("1.750,00");
    await page.getByRole("button", { name: /^Salvar pagamento/ }).click();
    await expect(
      page.getByRole("heading", { name: "Alocar o pagamento" }),
    ).toBeVisible();
    await expect(page.getByText("R$ 1.700,00").first()).toBeVisible();
    await expect(page.getByText("R$ 1.200,00")).toHaveCount(0);

    // E a alocação real usa o valor novo: marcada a compra corrigida, o
    // pagamento gerado é de R$ 1.700, não de R$ 1.200.
    await page.getByText("Leroy Merlin").click();
    await expect(
      page.getByText("Selecionado: R$ 1.700,00 de R$ 1.750,00 pagos"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirmar alocação" }).click();
    await expect(
      page.getByRole("heading", { name: "Alocação confirmada" }),
    ).toBeVisible();

    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(1);
    expect(Number(pagos[0].valor)).toBe(1700);
  });
});

// ══ CONTAI-067 · o EXTRATO DA FATURA ════════════════════════════════════
//
// Fonte normativa: `docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md`,
// **ADENDO** (requisito do extrato) e **ADENDO 2** (cor/gravidade).
//
// O que se prova aqui não é o que a tela mostrou: é o **ESTADO GRAVADO** —
// `fatura.extrato_path`, a recusa da segunda gravação pela RPC E pelo trigger, e a
// pendência vermelha nas duas superfícies. Nada é stubado: a RPC
// `anexar_extrato_fatura`, o trigger `fatura_extrato_path_imutavel` e a assinatura
// nova de `fatura_desembolso_gravar` (migration 0021) rodam de verdade, como
// `security invoker`, sob a MESMA RLS do app.

/** Um arquivo qualquer — o app guarda o documento, nunca audita o conteúdo. */
function arquivo(nome: string) {
  return {
    name: nome,
    mimeType: "application/pdf",
    buffer: Buffer.from(`pdf-falso-${nome}`),
  };
}

const EXTRATO_ROTULO = "Extrato da fatura (emitido pelo cartão)";

test.describe("extrato da fatura — captura no ato de confirmar (CONTAI-067)", () => {
  test("os DOIS campos de arquivo, rótulos distintos, e os dois gravam num ato só", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db, "Leroy Merlin");
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 1234.4,
      dataCompra: "2026-08-14",
      dataVencimento: "2026-09-10",
    });

    await page.goto(`/fatura/${c.faturaId}/confirmar`);

    // ── Os dois campos, e o pre-mortem 1: rótulos que não se confundem ────
    await expect(page.getByLabel("Comprovante da fatura")).toBeVisible();
    await expect(page.getByLabel(EXTRATO_ROTULO)).toBeVisible();
    // Texto de ajuda copiado do ADENDO, nunca reescrito.
    await expect(
      page.getByText(
        "O comprovante prova a saída de caixa; o extrato prova a composição — " +
          "quais compras estavam dentro dela.",
      ),
    ).toBeVisible();

    // ── O extrato é OPCIONAL: só a data habilita/desabilita o botão ────────
    // (critério 4 — nunca bloqueia "Confirmar pagamento").
    await expect(
      page.getByRole("button", { name: /^Confirmar pagamento/ }),
    ).toBeDisabled();
    await page.getByLabel("Data em que a fatura foi paga").fill("2026-09-10");
    await expect(
      page.getByRole("button", { name: /^Confirmar pagamento/ }),
    ).toBeEnabled();

    await page
      .getByLabel("Comprovante da fatura")
      .setInputFiles(arquivo("pix-da-fatura.pdf"));
    await page.getByLabel(EXTRATO_ROTULO).setInputFiles(arquivo("fatura-setembro.pdf"));

    await page.getByRole("button", { name: /^Confirmar pagamento/ }).click();
    await expect(
      page.getByRole("heading", { name: "1 pagamento gerado" }),
    ).toBeVisible();
    // ⚠️ A Dica final diz uma cláusula POR DOCUMENTO, porque o grão é diferente:
    // o comprovante é copiado para cada pagamento gerado, o extrato fica na
    // fatura e cobre o ciclo. Uma frase só para os dois igualava as duas coisas.
    await expect(
      page.getByText("O comprovante vale para o pagamento gerado."),
    ).toBeVisible();
    await expect(
      page.getByText("O extrato fica na fatura e cobre o ciclo inteiro."),
    ).toBeVisible();

    // ── (i) O extrato foi para a FATURA, em pasta própria do acervo ────────
    const fs = await faturas(db);
    expect(fs).toHaveLength(1);
    expect(fs[0].extrato_path).toMatch(new RegExp(`^${USER_ID_SEED}/extrato/`));

    // ── (ii) O comprovante continua no DESEMBOLSO, e são dois objetos ──────
    // O extrato não substituiu nem se confundiu com o comprovante: um por ciclo,
    // o outro por saída de caixa.
    const ds = await faturaDesembolsos(db);
    expect(ds).toHaveLength(1);
    expect(ds[0].comprovante_path).toMatch(
      new RegExp(`^${USER_ID_SEED}/comprovante/`),
    );
    expect(ds[0].comprovante_path).not.toBe(fs[0].extrato_path);

    // ── (iii) A pendência não existe mais: o card some sozinho ─────────────
    await page.goto(`/fatura/${c.faturaId}`);
    await expect(page.getByText("Fatura sem extrato")).toHaveCount(0);
    // Título do bloco resolvido + o chip do papel no item do acervo.
    await expect(page.getByText("Extrato da fatura").first()).toBeVisible();
  });

  test("confirmar SEM extrato grava o pagamento igual — fato consumado nunca é recusado", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 800,
      dataCompra: "2026-08-14",
      dataVencimento: "2026-09-10",
    });

    await page.goto(`/fatura/${c.faturaId}/confirmar`);
    await page.getByLabel("Data em que a fatura foi paga").fill("2026-09-10");
    await page.getByRole("button", { name: /^Confirmar pagamento/ }).click();
    await expect(
      page.getByRole("heading", { name: "1 pagamento gerado" }),
    ).toBeVisible();

    // Sem anexo nenhum, nenhuma das duas cláusulas aparece: a Dica não afirma
    // sobre documento que não existe.
    await expect(page.getByText("O comprovante vale para")).toHaveCount(0);
    await expect(page.getByText("O extrato fica na fatura")).toHaveCount(0);

    // O valor pago gravou, e o extrato ficou null — pendência, nunca bloqueio.
    expect(await faturaDesembolsos(db)).toHaveLength(1);
    expect((await faturas(db))[0].extrato_path).toBeNull();
    expect(await pagamentos(db)).toHaveLength(1);
  });
});

test.describe("extrato da fatura — anexo TARDIO em /fatura/[id]", () => {
  /**
   * O cenário que o critério 5 existe para resolver: a fatura foi confirmada sem o
   * extrato (ele chegou depois), e `/fatura/[id]` é o ÚNICO ponto de anexo.
   */
  test("o bloco vermelho aparece, anexa pela RPC e vira estado resolvido — sem sair da tela", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 1500,
      dataCompra: "2026-08-14",
      dataVencimento: "2026-09-10",
    });
    // Fatura paga, sem extrato — montada pela RPC, como a tela faria.
    await db.rpc("fatura_desembolso_gravar", {
      p_fatura_id: c.faturaId,
      p_valor: 1500,
      p_data_pagamento: "2026-09-10",
      p_compromisso_ids: [c.compromissoId],
    });

    await page.goto(`/fatura/${c.faturaId}`);

    // ── A consequência e o ESCOPO DO NÃO-VETO, os dois parágrafos ──────────
    await expect(page.getByText("Fatura sem extrato").first()).toBeVisible();
    await expect(
      page.getByText(
        "Você já pagou esta fatura, mas não tem o documento da administradora " +
          "que prova quais compras estavam dentro dela — falta o apoio hábil " +
          "que fixa o ano-calendário certo dessas compras na ficha Bens e " +
          "Direitos.",
      ),
    ).toBeVisible();
    // ⚠️ A frase que impede a leitura errada do vermelho (critério 16).
    await expect(
      page.getByText(
        "Isso não trava a lista de Pagamentos Efetuados nem a posição da " +
          "aferição do INSS — compra no cartão não é mão de obra. O que fica em " +
          "risco é o ano-calendário certo do gasto na discriminação de Bens e " +
          "Direitos.",
      ),
    ).toBeVisible();

    // ── Grava no CLIQUE, nunca ao escolher o arquivo ───────────────────────
    const anexar = page.getByRole("button", { name: "Anexar extrato" });
    await expect(anexar).toBeDisabled();
    await page.getByLabel(EXTRATO_ROTULO).setInputFiles(arquivo("ciclo-setembro.pdf"));
    await expect(anexar).toBeEnabled();
    // Nada gravado ainda: a seleção do arquivo por si não afirma nada.
    expect((await faturas(db))[0].extrato_path).toBeNull();

    await anexar.click();
    // ⚠️ Filtrado: esta tela já tem o `role="status"` do banner âmbar "a fatura
    // não é documento hábil" — `getByRole("status")` seco é strict-mode violation.
    await expect(
      page.getByRole("status").filter({ hasText: "Extrato anexado." }),
    ).toBeVisible();

    const fs = await faturas(db);
    expect(fs[0].extrato_path).toMatch(new RegExp(`^${USER_ID_SEED}/extrato/`));

    // Estado resolvido na mesma tela — sem `router.push`: o Mateus decide quando
    // sair (mesma disciplina do CONTAI-061).
    await expect(page).toHaveURL(new RegExp(`/fatura/${c.faturaId}$`));
    await expect(page.getByLabel(EXTRATO_ROTULO)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Anexar extrato" })).toHaveCount(0);
  });

  /**
   * O caminho do ROTATIVO — que nunca passa por `/confirmar`. Aqui é a única porta
   * do extrato, e é por isso que `/parcial` não ganha campo (critério 6): a
   * administradora emite um extrato por CICLO, não por desembolso.
   */
  test("rotativo: `/parcial` não pede extrato, e um extrato só cobre os N desembolsos", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 2000,
      dataCompra: "2026-09-15",
      dataVencimento: "2026-10-10",
    });

    await page.goto(`/fatura/${c.faturaId}/parcial`);
    await expect(page.getByLabel(EXTRATO_ROTULO)).toHaveCount(0);
    await page.getByLabel("Data em que você pagou").fill("2026-10-08");
    await page.getByLabel("Valor pago").fill("800,00");
    await page.getByRole("button", { name: /^Salvar pagamento/ }).click();
    await expect(page.getByRole("heading", { name: "Alocar o pagamento" })).toBeVisible();

    // Segundo desembolso parcial, pela RPC — o resto do rotativo.
    await db.rpc("fatura_desembolso_gravar", {
      p_fatura_id: c.faturaId,
      p_valor: 1200,
      p_data_pagamento: "2026-11-08",
    });
    expect(await faturaDesembolsos(db)).toHaveLength(2);

    // UM extrato, em `/fatura/[id]`, cobre os dois desembolsos: a pendência
    // desaparece inteira, e não pela metade.
    await page.goto(`/fatura/${c.faturaId}`);
    await page.getByLabel(EXTRATO_ROTULO).setInputFiles(arquivo("ciclo-outubro.pdf"));
    await page.getByRole("button", { name: "Anexar extrato" }).click();
    // ⚠️ Filtrado: esta tela já tem o `role="status"` do banner âmbar "a fatura
    // não é documento hábil" — `getByRole("status")` seco é strict-mode violation.
    await expect(
      page.getByRole("status").filter({ hasText: "Extrato anexado." }),
    ).toBeVisible();
    await expect(page.getByText("Fatura sem extrato")).toHaveCount(0);
    expect((await faturas(db))[0].extrato_path).not.toBeNull();
  });

  test("fatura SEM desembolso nenhum não cobra extrato — bloco ausente, não vazio", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 300,
      dataCompra: "2026-10-01",
      dataVencimento: "2026-11-10",
    });

    await page.goto(`/fatura/${c.faturaId}`);
    await expect(page.getByText("Fatura sem extrato")).toHaveCount(0);
    await expect(page.getByLabel(EXTRATO_ROTULO)).toHaveCount(0);
  });
});

test.describe("extrato da fatura — a segunda gravação é recusada pelo BANCO", () => {
  test("RPC recusa o segundo anexo, trigger recusa o UPDATE direto, e nada muda", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 700,
      dataCompra: "2026-08-14",
      dataVencimento: "2026-09-10",
    });
    await db.rpc("fatura_desembolso_gravar", {
      p_fatura_id: c.faturaId,
      p_valor: 700,
      p_data_pagamento: "2026-09-10",
      p_compromisso_ids: [c.compromissoId],
    });

    // Primeiro anexo, pela tela.
    await page.goto(`/fatura/${c.faturaId}`);
    await page.getByLabel(EXTRATO_ROTULO).setInputFiles(arquivo("primeiro.pdf"));
    await page.getByRole("button", { name: "Anexar extrato" }).click();
    // ⚠️ Filtrado: esta tela já tem o `role="status"` do banner âmbar "a fatura
    // não é documento hábil" — `getByRole("status")` seco é strict-mode violation.
    await expect(
      page.getByRole("status").filter({ hasText: "Extrato anexado." }),
    ).toBeVisible();
    const primeiro = (await faturas(db))[0].extrato_path!;

    // ── (a) A RPC: a guarda é do BANCO, não da tela ────────────────────────
    const segunda = await db.rpc("anexar_extrato_fatura", {
      p_fatura_id: c.faturaId,
      p_extrato_path: `${USER_ID_SEED}/extrato/outro.pdf`,
    });
    expect(segunda.error?.message ?? "").toContain("já tem extrato");

    // ── (b) O trigger: UPDATE direto pela tabela também é recusado ─────────
    // A 0021 concedeu `update (extrato_path)` a `authenticated` e o PostgREST
    // expõe a coluna — sem `fatura_extrato_path_imutavel`, "só grava se está null"
    // seria promessa da RPC e nada mais.
    const direto = await db
      .from("fatura")
      .update({ extrato_path: `${USER_ID_SEED}/extrato/pela-tabela.pdf` })
      .eq("id", c.faturaId);
    expect(direto.error?.message ?? "").toContain(
      "extrato_path já foi definido",
    );

    // ── (c) A chave natural continua fora de alcance: grant é de COLUNA ────
    const redatar = await db
      .from("fatura")
      .update({ data_vencimento: "2026-12-10" })
      .eq("id", c.faturaId);
    expect(redatar.error?.message ?? "").toMatch(/permission denied|permissão/i);

    // ── (d) Confirmar com extrato numa fatura que JÁ tem: recusa, não silêncio
    const comExtrato = await db.rpc("fatura_desembolso_gravar", {
      p_fatura_id: c.faturaId,
      p_valor: 100,
      p_data_pagamento: "2026-09-11",
      p_extrato_path: `${USER_ID_SEED}/extrato/terceiro.pdf`,
    });
    expect(comExtrato.error?.message ?? "").toContain("já tem extrato anexado");

    // Nada mudou, e o desembolso da chamada recusada NÃO entrou (a transação
    // desfaz os dois juntos).
    const fs = await faturas(db);
    expect(fs[0].extrato_path).toBe(primeiro);
    expect(fs[0].data_vencimento).toBe("2026-09-10");
    expect(await faturaDesembolsos(db)).toHaveLength(1);
  });
});

test.describe("extrato da fatura — a pendência vermelha nas duas superfícies", () => {
  test("aparece em /pendencias e no painel da home, com o texto do NÃO-veto", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 1234.4,
      dataCompra: "2026-08-14",
      dataVencimento: "2026-09-10",
    });
    await db.rpc("fatura_desembolso_gravar", {
      p_fatura_id: c.faturaId,
      p_valor: 1234.4,
      p_data_pagamento: "2026-09-10",
      p_compromisso_ids: [c.compromissoId],
    });

    // ── A fila unificada ──────────────────────────────────────────────────
    await page.goto("/pendencias");
    const naFila = page.locator('[data-item-pendencia="fatura_sem_extrato"]');
    await expect(naFila).toHaveCount(1);
    // VERMELHA: mora no bloco "Resolver primeiro", nunca no âmbar.
    await expect(
      page.locator('[data-pendencia="fatura-sem-extrato"]'),
    ).toHaveClass(/border-red/);
    await expect(naFila).toContainText("R$ 1.234,40");
    await expect(naFila).toContainText("1 fatura");
    await expect(naFila).toContainText(
      "não trava a lista de Pagamentos Efetuados nem a posição da aferição do INSS",
    );
    // ⚠️ E NÃO diz a frase de veto do card irmão — a diferença é fiscal.
    await expect(naFila).not.toContainText("nenhuma saída anual é gerada");

    // CTA com uma fatura só: aponta para a tela onde a ação mora.
    await naFila.getByRole("link", { name: "Ver a fatura" }).click();
    await expect(page).toHaveURL(new RegExp(`/fatura/${c.faturaId}$`));

    // ── O painel da home lê os MESMOS itens ───────────────────────────────
    await page.goto("/");
    await expect(
      page
        .locator('[data-painel="pendencias-urgentes"]')
        .locator('[data-item-pendencia="fatura_sem_extrato"]'),
    ).toHaveCount(1);

    // ── E some sozinha quando o extrato chega ─────────────────────────────
    await page.goto(`/fatura/${c.faturaId}`);
    await page.getByLabel(EXTRATO_ROTULO).setInputFiles(arquivo("ciclo.pdf"));
    await page.getByRole("button", { name: "Anexar extrato" }).click();
    // ⚠️ Filtrado: esta tela já tem o `role="status"` do banner âmbar "a fatura
    // não é documento hábil" — `getByRole("status")` seco é strict-mode violation.
    await expect(
      page.getByRole("status").filter({ hasText: "Extrato anexado." }),
    ).toBeVisible();

    await page.goto("/pendencias");
    await expect(
      page.locator('[data-item-pendencia="fatura_sem_extrato"]'),
    ).toHaveCount(0);
  });

  test("duas faturas sem extrato: card agregado, sem CTA, com a soma das duas", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    for (const [valor, vencimento] of [
      [1000, "2026-09-10"],
      [500, "2026-10-10"],
    ] as const) {
      const c = await criarCompraCartao(db, {
        favorecidoId: loja,
        valor,
        dataCompra: "2026-08-14",
        dataVencimento: vencimento,
      });
      await db.rpc("fatura_desembolso_gravar", {
        p_fatura_id: c.faturaId,
        p_valor: valor,
        p_data_pagamento: vencimento,
        p_compromisso_ids: [c.compromissoId],
      });
    }

    await page.goto("/pendencias");
    const naFila = page.locator('[data-item-pendencia="fatura_sem_extrato"]');
    // UM card agregado, nunca um por fatura.
    await expect(naFila).toHaveCount(1);
    await expect(naFila).toContainText("R$ 1.500,00");
    await expect(naFila).toContainText("2 faturas");
    // Sem lista de faturas no app, o card fica informativo — decisão do `po`.
    await expect(naFila.getByRole("link", { name: "Ver a fatura" })).toHaveCount(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// CONTAI-081 · PRÉ-VÍNCULO no caminho do CARTÃO — a fatura convertendo por N
// ══════════════════════════════════════════════════════════════════════════
//
// Fonte normativa: `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`,
// ADENDO 6 §J.3, ADENDO 7 §K.2, ADENDO 8 §L.2 — os MESMOS do CONTAI-080, agora
// com vários compromissos resolvendo N no mesmo ato.
//
// O que se prova aqui é o estado GRAVADO em `pagamento_documento` (a tabela que
// `alocarCusto` consome) depois de cada caminho, contra o Postgres LOCAL, pela
// tela, com a RLS ligada.

test.describe("pré-vínculo na fatura — a conversão bifurcada por N (CONTAI-081)", () => {
  /** NF de material hábil da loja, na obra do seed. */
  async function notaDe(
    db: Db,
    favorecidoId: string,
    over: { numero?: string; valor?: number } = {},
  ) {
    return criarDocumento(db, {
      favorecido_id: favorecidoId,
      tipo: "nf_material",
      classificacao: "material",
      valor: over.valor ?? 4850,
      numero: over.numero ?? "1042",
      data_emissao: "2026-02-20",
      destinatario_cpf_ok: true,
      status: "registrado",
    });
  }

  async function confirmarFaturaPelaTela(page: Page, faturaId: string) {
    await page.goto(`/fatura/${faturaId}/confirmar`);
    await page.getByLabel("Data em que a fatura foi paga").fill("2026-04-10");
    await page.getByRole("button", { name: /^Confirmar pagamento/ }).click();
  }

  test("N=0 · fatura sem pré-vínculo nenhum: tela de sucesso de sempre, sem vínculo", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 4850,
      dataCompra: "2026-03-03",
      dataVencimento: "2026-04-10",
    });

    await confirmarFaturaPelaTela(page, c.faturaId);
    // ⚠️ A tela de sucesso continua INTACTA quando M=0 (critério 14).
    await expect(
      page.getByRole("heading", { name: "1 pagamento gerado" }),
    ).toBeVisible();
    expect(await pagamentos(db)).toHaveLength(1);
    expect(await vinculos(db)).toEqual([]);
  });

  test("N=1 pela ORIGEM · a RPC propaga, e nada é perguntado", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const documentoId = await notaDe(db, loja);
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 4850,
      dataCompra: "2026-03-03",
      dataVencimento: "2026-04-10",
      documentoOrigemId: documentoId,
    });

    await confirmarFaturaPelaTela(page, c.faturaId);
    await expect(
      page.getByRole("heading", { name: "1 pagamento gerado" }),
    ).toBeVisible();

    const pagos = await pagamentos(db);
    // O CONTAI-065 intacto: o compromisso entrou em `propagarOrigemIds` porque
    // N < 2, e a linha nasceu dentro da própria RPC.
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagos[0].id, documento_id: documentoId },
    ]);
  });

  test("N=1 SÓ por pré-vínculo · converte sozinho depois da RPC, sem clique", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const documentoId = await notaDe(db, loja, { numero: "2001" });
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 4850,
      dataCompra: "2026-03-03",
      dataVencimento: "2026-04-10",
    });
    // Sem nota de origem: a única fonte é o pré-vínculo do CONTAI-080, agora
    // disponível para cartão.
    await criarPreVinculo(db, c.compromissoId, documentoId);

    await confirmarFaturaPelaTela(page, c.faturaId);
    // ⚠️ §K.2 — *"marca automaticamente, sem clique adicional"*: nenhuma tela
    // intermediária, e a de sucesso é a de sempre.
    await expect(
      page.getByRole("heading", { name: "1 pagamento gerado" }),
    ).toBeVisible();

    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(1);
    // O pagamento ligado é o QUE NASCEU AGORA — identificado por diff, nunca por
    // data/meio (critério 9).
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagos[0].id, documento_id: documentoId },
    ]);
    // A intenção não é apagada pela conversão — é o rastro do que foi dito.
    expect(await preVinculos(db)).toHaveLength(1);
  });

  test("⚠️ DEDUP · origem reafirmada como pré-vínculo é N=1: UMA linha, sem 23505", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const documentoId = await notaDe(db, loja);
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 4850,
      dataCompra: "2026-03-03",
      dataVencimento: "2026-04-10",
      documentoOrigemId: documentoId,
    });
    await criarPreVinculo(db, c.compromissoId, documentoId);

    await confirmarFaturaPelaTela(page, c.faturaId);
    await expect(
      page.getByRole("heading", { name: "1 pagamento gerado" }),
    ).toBeVisible();

    const pagos = await pagamentos(db);
    // A RPC gravou (N < 2 → está em `propagarOrigemIds`) e
    // `converterPreVinculosDaFatura` repetiu: o `upsert` com `ignoreDuplicates`
    // faz da duplicata um no-op, e as duas pontas acabam na MESMA linha.
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagos[0].id, documento_id: documentoId },
    ]);
  });

  /**
   * ⚠️ **O CORAÇÃO DO TICKET, e a condição do Gate Fiscal em forma de teste.**
   *
   * Duas compras N≥2 na mesma fatura, um bloco cada. O Mateus confirma UM e sai;
   * ao voltar, só o outro está lá — e o confirmado continua confirmado. O que
   * violaria a doutrina do §J.3 é qualquer atalho que produzisse as duas
   * conversões com um único ato de vontade: por isso a tela **não tem** botão
   * único, e este teste confere a ausência dele.
   */
  test("⚠️ N≥2 em DUAS compras · 2 blocos, confirma 1, sai, e só o outro sobra", async ({
    page,
    db,
  }) => {
    const superbeton = await favorecidoLoja(db, "Superbeton");
    const marcenaria = await favorecidoLoja(db, "Marcenaria Ilha");

    const origemA = await notaDe(db, superbeton, { numero: "1042", valor: 3200 });
    const segundaA = await notaDe(db, superbeton, { numero: "1051", valor: 1650 });
    const origemB = await notaDe(db, marcenaria, { numero: "87", valor: 6400 });
    const segundaB = await notaDe(db, marcenaria, { numero: "90", valor: 2000 });

    const a = await criarCompraCartao(db, {
      favorecidoId: superbeton,
      valor: 4850,
      dataCompra: "2026-03-03",
      dataVencimento: "2026-04-10",
      documentoOrigemId: origemA,
    });
    await criarPreVinculo(db, a.compromissoId, segundaA);
    const b = await criarCompraCartao(db, {
      favorecidoId: marcenaria,
      valor: 6400,
      dataCompra: "2026-03-11",
      dataVencimento: "2026-04-10",
      documentoOrigemId: origemB,
    });
    await criarPreVinculo(db, b.compromissoId, segundaB);

    await confirmarFaturaPelaTela(page, a.faturaId);

    // ⚠️ **Redireciona para `/vinculos`, não para a tela de sucesso** (critério
    // 14), com o banner ÂMBAR de transição.
    await page.waitForURL(
      new RegExp(`/fatura/${a.faturaId}/vinculos\\?confirmouFatura=1$`),
    );
    await expect(page.getByText("Fatura confirmada.")).toBeVisible();
    await expect(page.getByText("Falta só decidir 2 vínculos")).toBeVisible();

    // ⚠️ **D1 do Gate 2 pela porta do cartão: NADA em `pagamento_documento`.**
    // Sem `p_propagar_origem_ids` (migration 0024), as duas notas de ORIGEM já
    // estariam gravadas aqui e a revalidação cobriria só metade de cada conjunto.
    expect(
      await vinculos(db),
      "N≥2 é 100% revalidado: nem a nota de origem converte antes do toque",
    ).toEqual([]);
    // A quitação em si acontece — fato consumado nunca é recusado (§4).
    expect((await compromissos(db)).every((c) => c.situacao === "quitado")).toBe(
      true,
    );
    expect(await faturaDesembolsos(db)).toHaveLength(1);

    // Dois blocos, em ordem CRONOLÓGICA pela data da compra (spec §1.2).
    const blocos = page.locator('[data-bloco="revalidacao"]');
    await expect(blocos).toHaveCount(2);
    await expect(blocos.nth(0)).toContainText("Superbeton");
    await expect(blocos.nth(0)).toContainText("compra 03/03/2026");
    await expect(blocos.nth(1)).toContainText("Marcenaria Ilha");
    // O texto é o literal do §J.3, com as notas do conjunto DAQUELE bloco.
    await expect(blocos.nth(0)).toContainText(
      "Confirmar este pagamento também confirma o vínculo com",
    );
    await expect(blocos.nth(0)).toContainText("Nota nº 1042");
    await expect(blocos.nth(0)).toContainText("Nota nº 1051");
    await expect(blocos.nth(1)).toContainText("Nota nº 87");

    // ⚠️ **NÃO existe "confirmar tudo"** — a proibição do Gate Fiscal.
    await expect(
      page.getByRole("button", { name: /confirmar tud|confirmar todas/i }),
      "um botão só para os dois blocos violaria o §J.3",
    ).toHaveCount(0);
    // Cada bloco tem o SEU par de saídas, e nenhuma nasce marcada.
    await expect(
      page.getByRole("button", { name: "Sim, confirmar os vínculos" }),
    ).toHaveCount(2);
    await expect(
      page.getByRole("link", { name: "Revisar antes de confirmar" }),
    ).toHaveCount(2);

    // ── Confirma SÓ o primeiro ────────────────────────────────────────────
    await blocos
      .nth(0)
      .getByRole("button", { name: "Sim, confirmar os vínculos" })
      .click();
    await expect(blocos.nth(0)).toContainText("Vínculo confirmado.");

    const pagos = await pagamentos(db);
    const pagamentoA = pagos.find((p) => p.favorecido_id === superbeton)!;
    const pagamentoB = pagos.find((p) => p.favorecido_id === marcenaria)!;
    await expect
      .poll(async () => (await vinculos(db)).length, {
        message: "o clique grava os DOIS documentos deste bloco, e só deste",
      })
      .toBe(2);
    expect(await vinculos(db)).toEqual(
      expect.arrayContaining([
        { pagamento_id: pagamentoA.id, documento_id: origemA },
        { pagamento_id: pagamentoA.id, documento_id: segundaA },
      ]),
    );

    // O bloco confirmado SAI da lista sozinho, sem reload, e o outro fica
    // intocado (spec §1.8).
    await expect(blocos).toHaveCount(1);
    await expect(blocos.nth(0)).toContainText("Marcenaria Ilha");
    await expect(page.getByText("1 compra desta fatura")).toBeVisible();

    // ── Sai no meio e volta: o confirmado persiste, o pendente reaparece ──
    // ⚠️ Critério 12 e condição (d) do Gate Fiscal. A lista é derivada do estado
    // GRAVADO: nenhuma flag de sessão participa de quais blocos existem.
    await page.goto(`/fatura/${a.faturaId}/vinculos`);
    const depoisDoReload = page.locator('[data-bloco="revalidacao"]');
    await expect(depoisDoReload).toHaveCount(1);
    await expect(depoisDoReload.nth(0)).toContainText("Marcenaria Ilha");
    // Sem o query param, a frase de transição não aparece — ela é cosmética.
    await expect(page.getByText("Fatura confirmada.")).toHaveCount(0);
    // E o vínculo do bloco confirmado continua lá, sozinho.
    expect(await vinculos(db)).toHaveLength(2);

    // O CTA da fatura conta o que sobrou (critério 13).
    await page.goto(`/fatura/${a.faturaId}`);
    const cta = page.locator('[data-bloco="vinculos-a-confirmar"]');
    await expect(cta).toContainText("1 compra com vínculo a confirmar");
    // A citação do §J.2 está lá, com a concordância do singular.
    await expect(cta).toContainText(
      'segue contando em "Notas hábeis sem pagamento vinculado"',
    );
    await cta.getByRole("link", { name: "Confirmar vínculos" }).click();

    // ── Fecha o segundo: M chega a zero e o card terminal aparece ─────────
    await page
      .locator('[data-bloco="revalidacao"]')
      .getByRole("button", { name: "Sim, confirmar os vínculos" })
      .click();
    await expect(page.getByText("Vínculo(s) confirmado(s).")).toBeVisible();
    // ⚠️ Sem `router.push` automático (critério 15): a saída é escolha dele.
    expect(new URL(page.url()).pathname).toBe(`/fatura/${a.faturaId}/vinculos`);
    await expect(
      page.getByRole("link", { name: "Voltar à fatura" }),
    ).toBeVisible();

    expect(await vinculos(db)).toHaveLength(4);
    expect(await vinculos(db)).toEqual(
      expect.arrayContaining([
        { pagamento_id: pagamentoB.id, documento_id: origemB },
        { pagamento_id: pagamentoB.id, documento_id: segundaB },
      ]),
    );

    // E o CTA da fatura desaparece — a ausência é o vazio (critério 13).
    await page.goto(`/fatura/${a.faturaId}`);
    await expect(
      page.locator('[data-bloco="vinculos-a-confirmar"]'),
    ).toHaveCount(0);
  });

  test("⚠️ 'Revisar antes de confirmar' leva ao seletor daquele pagamento, sem gravar", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db, "Superbeton");
    const origem = await notaDe(db, loja, { numero: "1042", valor: 3200 });
    const segunda = await notaDe(db, loja, { numero: "1051", valor: 1650 });
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 4850,
      dataCompra: "2026-03-03",
      dataVencimento: "2026-04-10",
      documentoOrigemId: origem,
    });
    await criarPreVinculo(db, c.compromissoId, segunda);

    await confirmarFaturaPelaTela(page, c.faturaId);
    await page.waitForURL(new RegExp(`/fatura/${c.faturaId}/vinculos`));
    await page.getByRole("link", { name: "Revisar antes de confirmar" }).click();

    const pagos = await pagamentos(db);
    await page.waitForURL(new RegExp(`/pagamento/${pagos[0].id}/ligar$`));
    // Nada gravado, nada apagado — só não foi confirmado ainda.
    expect(await vinculos(db)).toEqual([]);
    expect(await preVinculos(db)).toHaveLength(1);

    // A pré-marcação passiva do CONTAI-080 (critério 13) vale igual aqui: as
    // DUAS notas da união chegam marcadas, com os checkboxes destravados.
    const caixas = page.getByRole("checkbox");
    await expect(caixas).toHaveCount(2);
    await expect(caixas.nth(0)).toBeChecked();
    await expect(caixas.nth(1)).toBeChecked();
    await page.getByRole("button", { name: /^Ligar 2 documentos/ }).click();
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);
    expect(await vinculos(db)).toHaveLength(2);

    // Resolvido por FORA da tela agregada, o bloco também some dela.
    await page.goto(`/fatura/${c.faturaId}/vinculos`);
    await expect(page.locator('[data-bloco="revalidacao"]')).toHaveCount(0);
    await expect(
      page.getByText("Nenhum vínculo pendente nesta fatura no momento."),
    ).toBeVisible();
  });

  test("bloco SOME quando o pagamento já tem vínculo — a lista é derivada do gravado", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const origem = await notaDe(db, loja, { numero: "1042", valor: 3200 });
    const segunda = await notaDe(db, loja, { numero: "1051", valor: 1650 });
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 4850,
      dataCompra: "2026-03-03",
      dataVencimento: "2026-04-10",
      documentoOrigemId: origem,
    });
    await criarPreVinculo(db, c.compromissoId, segunda);

    await confirmarFaturaPelaTela(page, c.faturaId);
    await page.waitForURL(new RegExp(`/fatura/${c.faturaId}/vinculos`));
    await expect(page.locator('[data-bloco="revalidacao"]')).toHaveCount(1);

    // Um vínculo à mão, por outro caminho (mesma condição 3 do CONTAI-065: o
    // conjunto do pagamento passou a ser afirmação de alguém).
    const pagos = await pagamentos(db);
    await criarVinculo(db, pagos[0].id, segunda);

    await page.reload();
    await expect(page.locator('[data-bloco="revalidacao"]')).toHaveCount(0);
    // E o CTA da fatura também não aparece mais.
    await page.goto(`/fatura/${c.faturaId}`);
    await expect(
      page.locator('[data-bloco="vinculos-a-confirmar"]'),
    ).toHaveCount(0);
  });

  test("chegar em /vinculos sem nada pendente: card terminal neutro, sem banner de sucesso", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 950,
      dataCompra: "2026-03-03",
      dataVencimento: "2026-04-10",
    });

    await page.goto(`/fatura/${c.faturaId}/vinculos`);
    await expect(page.locator('[data-vinculos="vazio"]')).toContainText(
      "Nenhum vínculo pendente nesta fatura no momento.",
    );
    // Nada foi confirmado agora, então não há banner de sucesso (spec §1.6).
    await expect(page.getByText("Vínculo(s) confirmado(s).")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Voltar à fatura" }),
    ).toBeVisible();
  });

  /**
   * O rotativo tem de se comportar igual ao integral (pre-mortem 3): um
   * mecanismo que só valesse para `/confirmar` deixaria o pré-vínculo funcionando
   * numa porta e não na outra, para a MESMA fatura. `/parcial` só repassa `[]` —
   * ele não quita compra nenhuma.
   */
  test("parcial → alocar · N≥2 na compra MARCADA cai na tela de vínculos; a não marcada nem existe", async ({
    page,
    db,
  }) => {
    const loja1 = await favorecidoLoja(db, "Superbeton");
    const loja2 = await favorecidoLoja(db, "Elétrica Ilha");
    const origem = await notaDe(db, loja1, { numero: "1042", valor: 3200 });
    const segunda = await notaDe(db, loja1, { numero: "1051", valor: 1650 });
    const naoMarcada = await notaDe(db, loja2, { numero: "7", valor: 480 });

    const a = await criarCompraCartao(db, {
      favorecidoId: loja1,
      valor: 1200,
      dataCompra: "2026-03-03",
      dataVencimento: "2026-04-10",
      documentoOrigemId: origem,
    });
    await criarPreVinculo(db, a.compromissoId, segunda);
    const b = await criarCompraCartao(db, {
      favorecidoId: loja2,
      valor: 480,
      dataCompra: "2026-03-05",
      dataVencimento: "2026-04-10",
      documentoOrigemId: naoMarcada,
    });
    await criarPreVinculo(db, b.compromissoId, segunda);

    await page.goto(`/fatura/${a.faturaId}/parcial`);
    await page.getByLabel("Data em que você pagou").fill("2026-04-08");
    await page.getByLabel("Valor pago").fill("1.200,00");
    await page.getByRole("button", { name: /^Salvar pagamento/ }).click();

    // O valor pago gravou sem quitar nada — e sem propagar nada (`[]`).
    await expect(
      page.getByRole("heading", { name: "Alocar o pagamento" }),
    ).toBeVisible();
    expect(await faturaDesembolsos(db)).toHaveLength(1);
    expect((await compromissos(db)).every((c) => c.situacao === "aberto")).toBe(
      true,
    );
    expect(await vinculos(db)).toEqual([]);

    // Marca só a Superbeton (N≥2) e confirma.
    await page.getByText("Superbeton").click();
    await page.getByRole("button", { name: "Confirmar alocação" }).click();

    await page.waitForURL(
      new RegExp(`/fatura/${a.faturaId}/vinculos\\?confirmouFatura=1$`),
    );
    await expect(page.getByText("Falta só decidir 1 vínculo")).toBeVisible();
    // ⚠️ UM bloco: a compra que continua ABERTA não aparece aqui, ainda que
    // tenha N≥2 declarado — pendência antes do pagamento é o CTA do CONTAI-080.
    const blocos = page.locator('[data-bloco="revalidacao"]');
    await expect(blocos).toHaveCount(1);
    await expect(blocos.nth(0)).toContainText("Superbeton");
    expect(await vinculos(db)).toEqual([]);

    await blocos
      .nth(0)
      .getByRole("button", { name: "Sim, confirmar os vínculos" })
      .click();
    await expect(page.getByText("Vínculo(s) confirmado(s).")).toBeVisible();

    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(1);
    expect(await vinculos(db)).toEqual(
      expect.arrayContaining([
        { pagamento_id: pagos[0].id, documento_id: origem },
        { pagamento_id: pagos[0].id, documento_id: segunda },
      ]),
    );
    expect(await vinculos(db)).toHaveLength(2);
  });

  test("alocar com N=1 na compra marcada: sucesso de sempre, vínculo criado sozinho", async ({
    page,
    db,
  }) => {
    const loja = await favorecidoLoja(db);
    const documentoId = await notaDe(db, loja, { numero: "3003", valor: 1200 });
    const c = await criarCompraCartao(db, {
      favorecidoId: loja,
      valor: 1200,
      dataCompra: "2026-03-03",
      dataVencimento: "2026-04-10",
    });
    await criarPreVinculo(db, c.compromissoId, documentoId);

    await page.goto(`/fatura/${c.faturaId}/parcial`);
    await page.getByLabel("Data em que você pagou").fill("2026-04-08");
    await page.getByLabel("Valor pago").fill("1.200,00");
    await page.getByRole("button", { name: /^Salvar pagamento/ }).click();
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "Confirmar alocação" }).click();

    // M=0: a tela de sucesso da alocação continua intacta (critério 14).
    await expect(
      page.getByRole("heading", { name: "Alocação confirmada" }),
    ).toBeVisible();
    const pagos = await pagamentos(db);
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagos[0].id, documento_id: documentoId },
    ]);
  });
});
