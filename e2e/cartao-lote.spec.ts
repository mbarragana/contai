import { type Page } from "@playwright/test";

import { OBRA_ID_SEED } from "./ambiente";
import {
  compromissos,
  criarFavorecido,
  faturaCompromissos,
  faturas,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";
import { escolher } from "./formularios";

/**
 * CONTAI-084 — LOTE DE PARCELAS de uma compra no cartão, contra o Postgres
 * LOCAL: sessão de verdade, RLS ligada, a função transacional da migration 0026
 * exercitada pela tela E pela RPC crua.
 *
 * O que este arquivo prova, e por que cada um importa:
 *   1. caminho feliz — N parcelas geradas e confirmadas, **nenhuma** com
 *      `documento_origem_id` (critério 10 / ADENDO 9 §M);
 *   2. resíduo de centavos na ÚLTIMA parcela (critério 7);
 *   3. ajuste de data NOMEADO quando o mês não tem o dia da semente
 *      (critério 8, Pre-mortem 2);
 *   4. soma ≠ total bloqueia a confirmação, nomeando a diferença (critério 9,
 *      Pre-mortem 1);
 *   5. **tudo-ou-nada REAL** — falha forçada no meio do lote e `compromisso`
 *      sem linha nenhuma (critério 12). Este não é teste de mensagem de erro de
 *      UI: ele chama a RPC direto, porque o que está em jogo é a transação do
 *      banco. A tela não consegue nem produzir o lote inválido, e é por isso que
 *      provar só pela tela não provaria nada.
 *
 * 375px é o viewport do projeto `mobile` — piso, não alvo. Esta tela é de
 * GESTÃO (Cenário do ticket: em casa, sentado), e o "Teste do Canteiro" não se
 * aplica a ela.
 */

/** CNPJ com dígito verificador válido de verdade. */
const CNPJ_CONCRETEIRA = "11.222.333/0001-81";

let proximoCnpj = 0;

async function favorecidoDeConcreto(db: Db, nome = "Ilhamix Concreto") {
  proximoCnpj += 1;
  return criarFavorecido(db, {
    tipo: "pj",
    nome,
    documento: `1122233300${String(proximoCnpj).padStart(4, "0")}`,
  });
}

/** Os seis campos comuns da Tela 1. */
async function preencherDadosComuns(
  page: Page,
  dados: {
    favorecido?: string;
    documento?: string;
    valorTotal: string;
    dataCompra: string;
    primeiroVencimento: string;
    parcelas: string;
  },
) {
  await page
    .getByLabel("Favorecido", { exact: true })
    .fill(dados.favorecido ?? "Ilhamix Concreto");
  await page
    .getByLabel("CNPJ / CPF do favorecido")
    .fill(dados.documento ?? CNPJ_CONCRETEIRA);
  await page.getByLabel("Valor total da compra").fill(dados.valorTotal);
  await page.getByLabel("Data da compra").fill(dados.dataCompra);
  await page
    .getByLabel("Vencimento da 1ª fatura")
    .fill(dados.primeiroVencimento);
  await page.getByLabel("Número de parcelas").fill(dados.parcelas);
}

test.describe("a porta de entrada do lote", () => {
  test("o link aparece sob a recusa de parcelado e NÃO carrega a nota da URL", async ({
    page,
    db,
  }) => {
    // A compra individual, chegando de uma nota: é exatamente o caso em que
    // herdar a origem para 3 parcelas de uma vez seria o CONTAI-083 em escala.
    const favorecidoId = await favorecidoDeConcreto(db);
    expect(favorecidoId).toBeTruthy();

    await page.goto("/adicionar/compra-cartao?documento=qualquer");
    await escolher(page, "Parcelado?", "Parcelado");

    const link = page.getByRole("link", {
      name: "Lançar as parcelas em lote →",
    });
    await expect(link).toBeVisible();
    // Sem query string: a rota irmã nunca lê `?documento=` (critério 2).
    await expect(link).toHaveAttribute(
      "href",
      "/adicionar/compra-cartao/parcelas",
    );

    await link.click();
    await expect(
      page.getByRole("heading", { name: "Lançar parcelas em lote" }),
    ).toBeVisible();
    expect(page.url()).toContain("/adicionar/compra-cartao/parcelas");
    expect(page.url()).not.toContain("documento=");
  });

  test("a Tela 1 não pergunta se é parcelado, e diz por quê", async ({
    page,
  }) => {
    await page.goto("/adicionar/compra-cartao/parcelas");
    await expect(
      page.getByRole("heading", { name: "Lançar parcelas em lote" }),
    ).toBeVisible();

    // Critério 5: o campo não existe, e a ausência está explicada na tela com
    // o texto ratificado pelo `contador`.
    await expect(page.getByText("Parcelado?", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText(
        /Nenhuma parcela aqui pergunta se é parcelada — cada uma já nasce um evento à vista, sozinha\./,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        /Estas compras nascem sempre agendamento — o dinheiro só sai quando cada fatura for paga\./,
      ),
    ).toBeVisible();

    // Estado vazio = a Tela 1 em branco, com o botão dizendo o que falta.
    await expect(
      page.getByRole("button", { name: "Informe o favorecido para continuar" }),
    ).toBeDisabled();
  });

  test("o stepper recusa os dois extremos com mensagem nomeada", async ({
    page,
  }) => {
    await page.goto("/adicionar/compra-cartao/parcelas");
    await preencherDadosComuns(page, {
      valorTotal: "45.000,00",
      dataCompra: "2026-10-01",
      primeiroVencimento: "2026-10-15",
      parcelas: "1",
    });
    // ⚠️ `getByRole("alert")` e não `getByText`: a mensagem aparece DUAS vezes
    // de propósito — no erro do campo e no rótulo do botão desabilitado, que é
    // o padrão do app ("o botão desabilitado diz o que fazer"). Procurar pelo
    // texto solto esbarraria nas duas e o teste ficaria vermelho por desenho
    // correto.
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Abaixo de 2 não é lote — lance em /adicionar/compra-cartao.",
    );
    await expect(
      page.getByRole("button", {
        name: "Abaixo de 2 não é lote — lance em /adicionar/compra-cartao.",
      }),
    ).toBeDisabled();

    await page.getByLabel("Número de parcelas").fill("25");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Máximo 24 parcelas por lote.",
    );

    // O stepper CLAMPA: de 25, um toque no "−" volta para o teto.
    await page.getByRole("button", { name: "Uma parcela menos" }).click();
    await expect(page.getByLabel("Número de parcelas")).toHaveValue("24");
  });
});

test.describe("caminho feliz — N compras independentes num ato só", () => {
  test("3 parcelas de R$15.000 geram 3 compromissos, 3 faturas e ZERO origens", async ({
    page,
    db,
  }) => {
    await page.goto("/adicionar/compra-cartao/parcelas");
    await preencherDadosComuns(page, {
      valorTotal: "45.000,00",
      dataCompra: "2026-10-01",
      primeiroVencimento: "2026-10-15",
      parcelas: "3",
    });

    await page.getByRole("button", { name: /^Gerar as 3 parcelas/ }).click();
    await expect(
      page.getByRole("heading", { name: "Revisar as parcelas" }),
    ).toBeVisible();

    // As datas sugeridas: mesmo dia do mês, +1 mês por parcela.
    await expect(page.getByLabel("Vencimento da parcela 1")).toHaveValue(
      "2026-10-15",
    );
    await expect(page.getByLabel("Vencimento da parcela 2")).toHaveValue(
      "2026-11-15",
    );
    await expect(page.getByLabel("Vencimento da parcela 3")).toHaveValue(
      "2026-12-15",
    );
    // Divisão exata: nenhuma etiqueta de ajuste, nenhum resíduo.
    await expect(page.getByLabel("Valor da parcela 3")).toHaveValue("15.000,00");
    await expect(page.getByText("A soma bate com o valor total.")).toBeVisible();

    await page.getByRole("button", { name: "Confirmar as 3 parcelas" }).click();
    await expect(
      page.getByRole("heading", { name: "Parcelas lançadas" }),
    ).toBeVisible();
    await expect(page.getByText("3 parcelas agendadas.")).toBeVisible();
    await expect(page.getByText(/Nada entrou em custo ainda/)).toBeVisible();
    // Critério 18: a ressalva do ano de pagamento aparece UMA vez, não por linha.
    await expect(
      page.getByText(/a tese do ano do pagamento da fatura é defensável/),
    ).toHaveCount(1);

    const cs = await compromissos(db);
    expect(cs).toHaveLength(3);
    for (const c of cs) {
      expect(c).toMatchObject({
        origem: "cartao",
        situacao: "aberto",
        data_compra: "2026-10-01",
        obra_id: OBRA_ID_SEED,
        // ⚠️ O CRITÉRIO 10, e é por isto que este teste existe: nenhuma
        // parcela nasce ligada a nota, nem mesmo quando uma nota única
        // cobriria o total. A RPC não tem o parâmetro.
        documento_origem_id: null,
      });
      expect(Number(c.valor_previsto)).toBe(15_000);
    }
    expect(cs.map((c) => c.data_prevista).sort()).toEqual([
      "2026-10-15",
      "2026-11-15",
      "2026-12-15",
    ]);

    // Uma fatura por vencimento, e cada compra na fatura dela.
    const fs = await faturas(db);
    expect(fs.map((f) => f.data_vencimento)).toEqual([
      "2026-10-15",
      "2026-11-15",
      "2026-12-15",
    ]);
    const vinculos = await faturaCompromissos(db);
    expect(vinculos).toHaveLength(3);
    expect(new Set(vinculos.map((v) => v.fatura_id)).size).toBe(3);

    // Cada favorecido entra UMA vez: as 3 parcelas são do mesmo lojista.
    const { data: favs } = await db.from("favorecido").select("id, documento");
    expect(favs).toHaveLength(1);
    expect(favs![0].documento).toBe("11222333000181");
  });

  test("resíduo de centavos cai na ÚLTIMA parcela, e a soma fecha no total", async ({
    page,
    db,
  }) => {
    await page.goto("/adicionar/compra-cartao/parcelas");
    await preencherDadosComuns(page, {
      valorTotal: "100,00",
      dataCompra: "2026-10-01",
      primeiroVencimento: "2026-10-10",
      parcelas: "3",
    });
    await page.getByRole("button", { name: /^Gerar as 3 parcelas/ }).click();

    // 100,00 ÷ 3 = 33,33 + 33,33 + 33,34 — o resíduo inteiro na última.
    await expect(page.getByLabel("Valor da parcela 1")).toHaveValue("33,33");
    await expect(page.getByLabel("Valor da parcela 2")).toHaveValue("33,33");
    await expect(page.getByLabel("Valor da parcela 3")).toHaveValue("33,34");
    await expect(page.getByText("A soma bate com o valor total.")).toBeVisible();

    await page.getByRole("button", { name: "Confirmar as 3 parcelas" }).click();
    await expect(
      page.getByRole("heading", { name: "Parcelas lançadas" }),
    ).toBeVisible();

    const valores = (await compromissos(db))
      .map((c) => Number(c.valor_previsto))
      .sort((a, b) => a - b);
    expect(valores).toEqual([33.33, 33.33, 33.34]);
    expect(valores.reduce((s, v) => s + v, 0)).toBeCloseTo(100, 2);
  });

  test("mês sem o dia da semente: data ajustada e NOMEADA, sem escorregar o dia", async ({
    page,
  }) => {
    await page.goto("/adicionar/compra-cartao/parcelas");
    await preencherDadosComuns(page, {
      valorTotal: "4.000,00",
      dataCompra: "2026-01-20",
      primeiroVencimento: "2026-01-31",
      parcelas: "4",
    });
    await page.getByRole("button", { name: /^Gerar as 4 parcelas/ }).click();

    await expect(page.getByLabel("Vencimento da parcela 1")).toHaveValue(
      "2026-01-31",
    );
    await expect(page.getByLabel("Vencimento da parcela 2")).toHaveValue(
      "2026-02-28",
    );
    // ⚠️ O dia NÃO escorrega depois do mês curto — cálculo direto, não iterativo.
    await expect(page.getByLabel("Vencimento da parcela 3")).toHaveValue(
      "2026-03-31",
    );
    await expect(page.getByLabel("Vencimento da parcela 4")).toHaveValue(
      "2026-04-30",
    );

    // Critério 8: o ajuste é visível e diz qual parcela e por quê.
    await expect(
      page.getByText("ajustada — fevereiro não tem dia 31"),
    ).toBeVisible();
    await expect(
      page.getByText("ajustada — abril não tem dia 31"),
    ).toBeVisible();
  });
});

test.describe("a soma tem de bater antes de confirmar (critério 9)", () => {
  test("sobra e falta bloqueiam o botão, nomeando a diferença", async ({
    page,
    db,
  }) => {
    await page.goto("/adicionar/compra-cartao/parcelas");
    await preencherDadosComuns(page, {
      valorTotal: "45.000,00",
      dataCompra: "2026-10-01",
      primeiroVencimento: "2026-10-15",
      parcelas: "3",
    });
    await page.getByRole("button", { name: /^Gerar as 3 parcelas/ }).click();

    const confirmar = page.getByRole("button", {
      name: /^(Confirmar as 3 parcelas|Sobra|Falta)/,
    });
    await expect(confirmar).toBeEnabled();

    // Um centavo a mais: pequeno demais para notar, e sairia errado na soma do
    // ano. O botão trava e diz quanto sobra.
    // ⚠️ `getByRole("status")` na linha de totais: o mesmo texto também é o
    // rótulo do botão desabilitado (padrão do app), e `getByText` esbarraria
    // nos dois.
    const totais = page.getByRole("status");
    await page.getByLabel("Valor da parcela 3").fill("15.000,01");
    await expect(totais).toHaveText(
      /^Sobra R\$\s?0,01 — a soma passou do valor total\.$/,
    );
    await expect(confirmar).toBeDisabled();

    // Um centavo a menos: a mesma trava, com o texto do outro lado.
    await page.getByLabel("Valor da parcela 3").fill("14.999,99");
    await expect(totais).toHaveText(
      /^Falta R\$\s?0,01 para a soma bater com o valor total\.$/,
    );
    await expect(confirmar).toBeDisabled();

    // Voltando ao valor certo, a confirmação volta a existir.
    await page.getByLabel("Valor da parcela 3").fill("15.000,00");
    await expect(
      page.getByRole("button", { name: "Confirmar as 3 parcelas" }),
    ).toBeEnabled();

    // E nada foi gravado em nenhum desses estados.
    expect(await compromissos(db)).toHaveLength(0);
  });

  test("data apagada numa linha diz QUAL parcela e bloqueia", async ({
    page,
    db,
  }) => {
    await page.goto("/adicionar/compra-cartao/parcelas");
    await preencherDadosComuns(page, {
      valorTotal: "45.000,00",
      dataCompra: "2026-10-01",
      primeiroVencimento: "2026-10-15",
      parcelas: "3",
    });
    await page.getByRole("button", { name: /^Gerar as 3 parcelas/ }).click();
    await page.getByLabel("Vencimento da parcela 2").fill("");

    // Mesma razão de cima: o texto está no erro da LINHA e no rótulo do botão.
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Preencha a data da parcela 2 para continuar.",
    );
    await expect(
      page.getByRole("button", {
        name: "Preencha a data da parcela 2 para continuar.",
      }),
    ).toBeDisabled();
    expect(await compromissos(db)).toHaveLength(0);
  });

  test("sair do formulário antes de confirmar não grava nada", async ({
    page,
    db,
  }) => {
    await page.goto("/adicionar/compra-cartao/parcelas");
    await preencherDadosComuns(page, {
      valorTotal: "45.000,00",
      dataCompra: "2026-10-01",
      primeiroVencimento: "2026-10-15",
      parcelas: "3",
    });
    await page.getByRole("button", { name: /^Gerar as 3 parcelas/ }).click();
    await expect(
      page.getByRole("heading", { name: "Revisar as parcelas" }),
    ).toBeVisible();

    await page.goto("/");
    expect(await compromissos(db)).toHaveLength(0);
    expect(await faturas(db)).toHaveLength(0);
  });
});

/**
 * ⚠️ **CRITÉRIO 12 — o tudo-ou-nada, provado no BANCO.**
 *
 * Os três testes abaixo chamam a RPC direto, com a identidade do app e sob a
 * mesma RLS, porque o que está sendo provado é a TRANSAÇÃO — e a tela não
 * consegue montar nenhum desses lotes (o formulário recusa antes). Provar isto
 * por mensagem de erro de UI seria provar que a tela sabe escrever um aviso,
 * não que o banco desfaz o que já inseriu.
 */
test.describe("tudo-ou-nada: as guardas do servidor (critério 12)", () => {
  test("parcela inválida no MEIO do lote: zero linhas em compromisso", async ({
    db,
  }) => {
    const favorecidoId = await favorecidoDeConcreto(db);

    // A soma BATE com o total (300,00), então a guarda de soma deixa passar e
    // a função chega a inserir — e é esse o ponto: a 1ª parcela entra, a 2ª
    // viola `compromisso_valor_previsto_positivo` (migration 0007) e a
    // transação desfaz a primeira junto.
    const { error } = await db.rpc("compra_cartao_gravar_lote", {
      p_obra_id: OBRA_ID_SEED,
      p_favorecido_id: favorecidoId,
      p_data_compra: "2026-10-01",
      p_valor_total: 300,
      p_parcelas: [
        { valor: 200, vencimento: "2026-10-15" },
        { valor: -100, vencimento: "2026-11-15" },
        { valor: 200, vencimento: "2026-12-15" },
      ],
    });

    expect(error, "um lote com parcela inválida tem de ser RECUSADO").not.toBe(
      null,
    );

    // ⚠️ A assertiva do ticket: nenhuma linha, em nenhuma das três tabelas.
    // Sem a transação, a primeira parcela ficaria no acervo para sempre — não
    // existe DELETE em `compromisso` (append-only desde a 0007).
    expect(await compromissos(db)).toHaveLength(0);
    expect(await faturas(db)).toHaveLength(0);
    expect(await faturaCompromissos(db)).toHaveLength(0);
  });

  test("menos de 2 parcelas é recusado com mensagem nomeada", async ({ db }) => {
    const favorecidoId = await favorecidoDeConcreto(db);
    const { error } = await db.rpc("compra_cartao_gravar_lote", {
      p_obra_id: OBRA_ID_SEED,
      p_favorecido_id: favorecidoId,
      p_data_compra: "2026-10-01",
      p_valor_total: 15_000,
      p_parcelas: [{ valor: 15_000, vencimento: "2026-10-15" }],
    });

    expect(error?.message).toMatch(/menos de 2 parcelas não é lote/i);
    expect(await compromissos(db)).toHaveLength(0);
  });

  test("soma ≠ valor total é recusada no servidor, não só na tela", async ({
    db,
  }) => {
    const favorecidoId = await favorecidoDeConcreto(db);
    const { error } = await db.rpc("compra_cartao_gravar_lote", {
      p_obra_id: OBRA_ID_SEED,
      p_favorecido_id: favorecidoId,
      p_data_compra: "2026-10-01",
      p_valor_total: 45_000,
      p_parcelas: [
        { valor: 15_000, vencimento: "2026-10-15" },
        { valor: 15_000, vencimento: "2026-11-15" },
        // Um centavo a mais — a divergência pequena demais para notar.
        { valor: 15_000.01, vencimento: "2026-12-15" },
      ],
    });

    expect(error?.message).toMatch(/não bate com o valor total/i);
    expect(await compromissos(db)).toHaveLength(0);
    expect(await faturas(db)).toHaveLength(0);
  });
});
