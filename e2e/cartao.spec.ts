import { type Page } from "@playwright/test";

import { OBRA_ID_SEED, USER_ID_SEED } from "./ambiente";
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
