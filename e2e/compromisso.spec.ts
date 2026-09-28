import { OBRA_ID_SEED, URL_SUPABASE_LOCAL } from "./ambiente";
import {
  compromissos,
  criarCompromisso,
  criarFavorecido,
  diferencas,
  historicoDeData,
  historicoDeValor,
  pagamentos,
  vinculosDeQuitacao,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * COMPROMISSO × PAGAMENTO contra o Postgres LOCAL (critério 24 do CONTAI-019):
 * sessão de verdade, linhas de verdade, RLS ligada, e as asserções olhando o
 * ESTADO GRAVADO pelo MESMO client autenticado que o app usa.
 *
 * A pergunta que estes testes respondem não é "a tela mostra?" — é
 * **"o que entrou no banco?"**. É o estado gravado que vira declaração no ano
 * que vem, e o risco central deste ticket é uma previsão ser lida como
 * dispêndio.
 *
 * 375px é o viewport do config (iPhone SE) — piso, não alvo. As telas de
 * gestão são densas de propósito (régua de 2026-08-18).
 */

const CNPJ_WK = "11.222.333/0001-81";
const CNPJ_WK_DIGITOS = "11222333000181";

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

function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

async function favorecidoWk(db: Db) {
  return criarFavorecido(db, {
    tipo: "pj",
    nome: "WK Construções LTDA",
    documento: CNPJ_WK_DIGITOS,
  });
}

async function agendamento(
  db: Db,
  over: Partial<Parameters<typeof criarCompromisso>[1]> = {},
) {
  const favorecidoId = await favorecidoWk(db);
  return criarCompromisso(db, {
    favorecido_id: favorecidoId,
    valor_previsto: 10000,
    data_prevista: maisDias(28),
    origem: "boleto",
    ...over,
  });
}

// ══ Registrar: a DATA é o controle ══════════════════════════════════════

test.describe("registrar com data futura", () => {
  async function irParaFormulario(page: import("@playwright/test").Page) {
    await page.goto("/adicionar/pagamento");
    await expect(
      page.getByRole("heading", { name: "Registrar pagamento" }),
    ).toBeVisible();
  }

  /**
   * Critério 5 — **as três mudanças simultâneas, no mesmo passo**. Não é uma
   * lista de requisitos independentes: o valor da diretriz está em elas
   * acontecerem juntas, no instante em que a data vira futura. Se só duas
   * aparecerem, o formulário mente sobre o que vai gravar.
   */
  test("data no futuro dispara as TRÊS mudanças de uma vez", async ({ page }) => {
    await irParaFormulario(page);

    // CONTAI-032: Meio e Data nascem vazios/nulos — sem os dois, o destino é
    // "indefinido". Preenche os dois com HOJE para alcançar o "antes" (é um
    // pagamento) que este teste compara contra a data futura.
    await page.getByRole("group", { name: "Como foi pago" }).getByText("PIX").click();
    await page.getByLabel("Data", { exact: true }).fill(hoje());

    // Antes: é um pagamento. O comprovante é pedido e o botão é o de peso.
    await expect(page.getByLabel("Comprovante")).toBeVisible();
    await expect(page.getByLabel("Data do pagamento")).toBeVisible();

    await page.getByLabel("Data do pagamento").fill(maisDias(28));

    // 1 · o aviso COLADO no campo de data.
    await expect(page.locator("[data-aviso='data-futura']")).toBeVisible();
    await expect(
      page.getByText(/Isto vai ser gravado como/).first(),
    ).toBeVisible();

    // 2 · o comprovante obrigatório DESAPARECE.
    await expect(page.getByLabel("Comprovante")).toHaveCount(0);
    await expect(page.getByText("Aqui o anexo não é exigido.")).toBeVisible();

    // 3 · o botão troca de VERBO e de PESO.
    await expect(
      page.getByRole("button", { name: /^Agendar/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Salvar — aguardando/ }),
    ).toHaveCount(0);

    // E o campo passa a se chamar VALOR PREVISTO (critério 11).
    await expect(page.getByLabel("Valor previsto")).toBeVisible();
  });

  /**
   * Critério 6 — o coração do ticket. **Uma linha em `compromisso`, ZERO em
   * `pagamento`.** Se um dia isto virar um pagamento com data futura, o custo
   * entra no ano errado e ninguém vê.
   */
  test("salvar com data futura cria COMPROMISSO, e zero pagamento", async ({
    page,
    db,
  }) => {
    const prevista = maisDias(28);
    await irParaFormulario(page);

    await page.getByLabel("Favorecido", { exact: true }).fill("WK Construções LTDA");
    await page.getByLabel("CNPJ / CPF do favorecido").fill(CNPJ_WK);
    await page.getByRole("group", { name: "Como foi pago" }).getByText("PIX").click();
    await page.getByLabel("Data", { exact: true }).fill(prevista);
    await page.getByLabel("Valor previsto").fill("10.000,00");

    await page.getByRole("button", { name: /^Agendar/ }).click();
    await expect(page.getByRole("heading", { name: "Agendado ✓" })).toBeVisible();

    const gravados = await compromissos(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      obra_id: OBRA_ID_SEED,
      valor_previsto: 10000,
      data_prevista: prevista,
      origem: "pix",
      situacao: "aberto",
    });
    // ⚠️ ZERO pagamentos. Nada saiu da conta.
    expect(await pagamentos(db)).toHaveLength(0);
  });

  /**
   * Critérios 25 e 27 — **a guarda do cartão**. A compra tem data passada e
   * mesmo assim não houve desembolso: o que decide o branch é "a fatura já foi
   * paga?", nunca `data ≤ hoje`.
   */
  // CONTAI-022: "Cartão" não é mais recusado nesta tela — leva para o fluxo
  // próprio da compra no cartão (compra → fatura → pagamento). A recusa que
  // sobrevive é a de campo obrigatório vazio, comum a qualquer meio, e a de
  // compra parcelada — nenhuma das duas é "cartão ainda não tem fluxo".
  test("Cartão leva para o fluxo próprio da compra, sem gravar nada aqui", async ({
    page,
    db,
  }) => {
    await irParaFormulario(page);

    // Data de ONTEM, de propósito: mostra que a tela não tenta decidir nada
    // sobre a data antes de redirecionar.
    await page.getByLabel("Data", { exact: true }).fill(maisDias(-1));
    await page.getByRole("group", { name: "Como foi pago" }).getByText("Cartão").click();

    await expect(
      page.getByRole("heading", { name: "Nova compra no cartão" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/adicionar\/compra-cartao$/);

    expect(await pagamentos(db)).toHaveLength(0);
    expect(await compromissos(db)).toHaveLength(0);
  });
});

// ══ Ver: as quatro marcas, nos DOIS estados ═════════════════════════════

test.describe("o bloco de agendados na home", () => {
  /**
   * Critérios 8 e 8b — **as quatro marcas nos dois estados**, e a distinção
   * do vencido por TRÊS outras coisas que não a borda.
   *
   * ⚠️ A tracejada fica nos DOIS. O mock v2 troca por sólida no vencido e
   * **isso é o defeito, não o requisito** (decisão 2 do fechamento de 18/08).
   */
  test("um vencido e um aberto: tracejada nos dois, respostas só no vencido", async ({
    page,
    db,
  }) => {
    const favorecidoId = await favorecidoWk(db);
    await criarCompromisso(db, {
      favorecido_id: favorecidoId,
      valor_previsto: 2480,
      data_prevista: maisDias(-8),
      origem: "boleto",
    });
    await criarCompromisso(db, {
      favorecido_id: favorecidoId,
      valor_previsto: 10000,
      data_prevista: maisDias(28),
      origem: "boleto",
    });

    await page.goto("/");
    const bloco = page.locator("[data-bloco='agendados']");
    await expect(bloco).toBeVisible();

    const vencido = bloco.locator("[data-agendado='vencido']");
    const aberto = bloco.locator("[data-agendado='aberto']");
    await expect(vencido).toHaveCount(1);
    await expect(aberto).toHaveCount(1);

    // MARCA 1 — borda TRACEJADA nos DOIS.
    await expect(vencido).toHaveCSS("border-style", "dashed");
    await expect(aberto).toHaveCSS("border-style", "dashed");

    // MARCA 3 — `~` e cinza no valor, nos dois.
    await expect(vencido.locator("[data-marca='valor-previsto']")).toContainText("~");
    await expect(aberto.locator("[data-marca='valor-previsto']")).toContainText("~");

    // MARCA 4 — a preposição carrega o tempo, e com ANO (ADENDO 3 §G.2).
    await expect(vencido.locator("[data-marca='preposicao']")).toContainText(
      `era para ${dataBR(maisDias(-8))}`,
    );
    await expect(aberto.locator("[data-marca='preposicao']")).toContainText(
      `para ${dataBR(maisDias(28))}`,
    );

    // MARCA 2 + critério 8b — o chip do vencido NOMEIA vencimento e silêncio.
    await expect(vencido).toContainText(`Venceu em ${dataBR(maisDias(-8))}`);
    await expect(vencido).toContainText("8 dias sem resposta");
    await expect(aberto).toContainText("Agendado");

    // Critério 8b — as três respostas existem no vencido e NÃO existem no
    // aberto. É a distinção que carrega o peso, por ser estrutural.
    await expect(
      vencido.getByRole("link", { name: /Foi pago|Não vai ser pago|Mudou a data/ }),
    ).toHaveCount(3);
    await expect(
      aberto.getByRole("link", { name: /Foi pago|Não vai ser pago|Mudou a data/ }),
    ).toHaveCount(0);

    // ⚠️ NENHUM TOKEN VERMELHO dentro do bloco: nada saiu da conta, logo não há
    // risco fiscal ainda (critério 19). Âmbar = nada saiu; vermelho = saiu.
    const vermelhos = await bloco.locator("[class*='red']").count();
    expect(vermelhos, "agendado nunca é vermelho").toBe(0);

    // Critério 42 — CONTAGEM, e nenhuma soma dos previstos.
    await expect(bloco).toContainText("1 ainda não pago, 1 já venceu");
  });

  /**
   * Critério 43 — 1 vencido + 5 abertos → **1 cartão + 3 linhas + "(5)"**.
   * Vencido nunca trunca; aberto trunca em 3, com a saída visível.
   */
  test("1 vencido e 5 abertos: todos os vencidos, 3 abertos, ver todos (5)", async ({
    page,
    db,
  }) => {
    const favorecidoId = await favorecidoWk(db);
    await criarCompromisso(db, {
      favorecido_id: favorecidoId,
      valor_previsto: 2480,
      data_prevista: maisDias(-8),
      origem: "boleto",
    });
    for (let i = 1; i <= 5; i += 1) {
      await criarCompromisso(db, {
        favorecido_id: favorecidoId,
        valor_previsto: 1000 * i,
        data_prevista: maisDias(10 * i),
        origem: "boleto",
      });
    }

    await page.goto("/");
    const bloco = page.locator("[data-bloco='agendados']");
    await expect(bloco.locator("[data-agendado='vencido']")).toHaveCount(1);
    await expect(bloco.locator("[data-agendado='aberto']")).toHaveCount(3);
    await expect(bloco.getByRole("link", { name: "ver todos (5)" })).toBeVisible();

    // E a tela do "ver todos" não corta de novo.
    await bloco.getByRole("link", { name: "ver todos (5)" }).click();
    await expect(page.getByRole("heading", { name: "Agendados" })).toBeVisible();
    await expect(page.locator("[data-agendado='aberto']")).toHaveCount(5);
  });
});

// ══ CONTAI-075 — o destaque ANTES de vencer ═════════════════════════════
//
// A dor: *"hoje o app só reage a agendamento DEPOIS que ele vence"*. O que
// estes testes provam contra o banco real é que os quatro estados coexistem na
// MESMA lista, com quatro textos e três pesos — e que o degrau novo fica
// estritamente abaixo do vencido, que é a condição do Gate Fiscal.

test.describe("CONTAI-075 — vence hoje e vence amanhã na Agenda", () => {
  /** Um agendamento por estado, todos do mesmo favorecido e todos abertos. */
  async function osQuatroEstados(db: Db) {
    const favorecidoId = await favorecidoWk(db);
    for (const [valor, dias] of [
      [2480, -8],
      [3480, 0],
      [4480, 1],
      [5480, 28],
    ] as const) {
      await criarCompromisso(db, {
        favorecido_id: favorecidoId,
        valor_previsto: valor,
        data_prevista: maisDias(dias),
        origem: "boleto",
      });
    }
  }

  test("os quatro estados na mesma lista: quatro textos, três pesos", async ({
    page,
    db,
  }) => {
    await osQuatroEstados(db);
    await page.goto("/");
    const bloco = page.locator("[data-bloco='agendados']");
    await expect(bloco).toBeVisible();

    // Um chip por estado, e nenhum estado a mais.
    for (const urgencia of ["vencido", "vence_hoje", "vence_amanha", "comum"]) {
      await expect(
        bloco.locator(`[data-urgencia='${urgencia}']`),
        `um chip ${urgencia}`,
      ).toHaveCount(1);
    }

    // O TEXTO é o canal primário (pre-mortem 2 do ticket): quem separa hoje de
    // amanhã é a palavra, não a borda.
    await expect(bloco.locator("[data-urgencia='vence_hoje']")).toHaveText(
      "Vence hoje",
    );
    await expect(bloco.locator("[data-urgencia='vence_amanha']")).toHaveText(
      "Vence amanhã",
    );
    await expect(bloco.locator("[data-urgencia='comum']")).toHaveText("Agendado");
    await expect(bloco.locator("[data-urgencia='vencido']")).toContainText(
      `Venceu em ${dataBR(maisDias(-8))}`,
    );

    // ⚠️ **HIERARQUIA VISUAL — a condição do Gate Fiscal**: o degrau novo é
    // estritamente MENOR que o do vencido. Vencido é preenchido (fundo âmbar);
    // hoje/amanhã são vazados com borda de 2px; o comum, vazado de 1px.
    const borda = (urgencia: string) =>
      bloco
        .locator(`[data-urgencia='${urgencia}']`)
        .evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(await borda("comum")).toBe("1px");
    expect(await borda("vence_hoje")).toBe("2px");
    // ⚠️ **UM peso intermediário, não dois** (decisão do `designer`): hoje e
    // amanhã compartilham o mesmo, porque dois degraus tão próximos seriam
    // indistinguíveis a olho — "o destaque que não destaca".
    expect(await borda("vence_amanha")).toBe(await borda("vence_hoje"));

    // O vencido escala por PREENCHIMENTO, que é o degrau acima dos dois.
    const fundoDoVencido = await bloco
      .locator("[data-urgencia='vencido']")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const fundoDeHoje = await bloco
      .locator("[data-urgencia='vence_hoje']")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(fundoDeHoje).toBe("rgba(0, 0, 0, 0)");
    expect(fundoDoVencido).not.toBe(fundoDeHoje);

    // ⚠️ **NENHUM MATIZ NOVO** (critério 14): a escala é só de peso. Vermelho no
    // app significa "o dinheiro saiu e não está no custo", e aqui nada saiu.
    expect(await bloco.locator("[class*='red']").count()).toBe(0);
    expect(await bloco.locator("[class*='grn']").count()).toBe(0);
  });

  test("⚠️ os estados novos NÃO ganham consequência nem as três respostas", async ({
    page,
    db,
  }) => {
    // Critério 13 e Gate Fiscal: prometer bloqueio de relatório anual é
    // exclusivo do vencido, e continua sendo. Um "Vence hoje" que cobrasse
    // resposta transformaria previsão em obrigação — a espinha do parecer.
    const favorecidoId = await favorecidoWk(db);
    await criarCompromisso(db, {
      favorecido_id: favorecidoId,
      valor_previsto: 3480,
      data_prevista: hoje(),
      origem: "boleto",
    });

    await page.goto("/");
    const bloco = page.locator("[data-bloco='agendados']");
    await expect(bloco.locator("[data-urgencia='vence_hoje']")).toHaveText(
      "Vence hoje",
    );

    // Continua sendo LINHA de aberto, não cartão de vencido: nenhuma das três
    // respostas aparece, e o contêiner não mudou de `data-agendado`.
    await expect(bloco.locator("[data-agendado='aberto']")).toHaveCount(1);
    await expect(bloco.locator("[data-agendado='vencido']")).toHaveCount(0);
    await expect(
      bloco.getByRole("link", { name: /Foi pago|Não vai ser pago|Mudou a data/ }),
    ).toHaveCount(0);
    await expect(
      bloco.getByText(/nenhum relatório anual pode ser gerado/),
    ).toHaveCount(0);

    // A preposição de tempo continua dizendo "para", nunca "era para".
    await expect(bloco.locator("[data-marca='preposicao']")).toHaveText(
      `para ${dataBR(hoje())}`,
    );
  });

  test("a mesma urgência em /compromisso e no detalhe — nenhuma tela recalcula", async ({
    page,
    db,
  }) => {
    // Critério 5: um ponto de origem só (`chipDoAgendado`). Três telas, o mesmo
    // atributo — e é isso que impede a Agenda e o detalhe de discordarem sobre
    // que dia é hoje.
    const favorecidoId = await favorecidoWk(db);
    const id = await criarCompromisso(db, {
      favorecido_id: favorecidoId,
      valor_previsto: 4480,
      data_prevista: maisDias(1),
      origem: "boleto",
    });

    await page.goto("/compromisso");
    await expect(page.locator("[data-urgencia='vence_amanha']")).toHaveText(
      "Vence amanhã",
    );

    await page.goto(`/compromisso/${id}`);
    await expect(page.locator("[data-urgencia='vence_amanha']")).toHaveText(
      "Vence amanhã",
    );
    // O cabeçalho do detalhe também não promete nada, e não traz respostas.
    await expect(
      page.getByRole("link", { name: "Foi pago" }),
    ).toHaveCount(0);
  });

  test("⚠️ agendamento JÁ QUITADO com data de hoje não diz 'Vence hoje'", async ({
    page,
    db,
  }) => {
    // `/compromisso/[id]` renderiza as mesmas marcas para o já respondido.
    // "Vence hoje" sobre dinheiro que já saiu é o erro caro do CONTAI-019: o
    // Mateus registrar o mesmo PIX duas vezes.
    const favorecidoId = await favorecidoWk(db);
    const id = await criarCompromisso(db, {
      favorecido_id: favorecidoId,
      valor_previsto: 3480,
      data_prevista: hoje(),
      origem: "boleto",
      situacao: "quitado",
    });

    await page.goto(`/compromisso/${id}`);
    await expect(page.locator("[data-urgencia='comum']")).toHaveText("Agendado");
    await expect(page.locator("[data-urgencia='vence_hoje']")).toHaveCount(0);
  });
});

// ══ Confirmar ═══════════════════════════════════════════════════════════

test.describe("confirmar o pagamento de um agendamento", () => {
  /**
   * Critério 17 — **o campo de data nasce VAZIO**, o botão fica desabilitado
   * enquanto ele estiver vazio, e **nenhum caminho de código grava a data
   * prevista**. É a mitigação real do item 3 do pre-mortem: não há default
   * para confirmar sem olhar.
   */
  test("a data nasce vazia, o botão espera, e o previsto não é gravado", async ({
    page,
    db,
  }) => {
    const prevista = maisDias(-8);
    const id = await agendamento(db, { data_prevista: prevista });

    await page.goto(`/compromisso/${id}/confirmar`);
    await expect(
      page.getByRole("heading", { name: "Registrar o pagamento", exact: true }),
    ).toBeVisible();

    // Vazio, e o previsto só como referência cinza com `~`.
    await expect(page.getByLabel("Data em que o dinheiro saiu")).toHaveValue("");
    await expect(page.locator("[data-marca='valor-previsto']")).toContainText("~");
    await expect(page.getByText(dataBR(prevista)).first()).toBeVisible();

    // ⚠️ **D65** — o VALOR nasce vazio pelo mesmo motivo que a data: é ele que
    // vira custo de aquisição, e o previsto não o antecipa. Até 2026-09-21 o
    // campo vinha carregado com o saldo do agendamento, e um toque gravava um
    // desembolso que ninguém conferiu.
    await expect(page.getByLabel("Valor efetivamente pago")).toHaveValue("");

    // Botão desabilitado, e dizendo o que falta — um motivo de cada vez.
    await expect(
      page.getByRole("button", { name: "Informe a data em que o dinheiro saiu" }),
    ).toBeDisabled();

    // ⚠️ Não existe atalho que preencha data.
    await expect(page.getByRole("button", { name: /hoje/i })).toHaveCount(0);

    // Com a data, o bloqueio passa a ser o valor: nunca um botão mudo.
    await page.getByLabel("Data em que o dinheiro saiu").fill(hoje());
    await expect(
      page.getByRole("button", { name: "Informe o valor efetivamente pago" }),
    ).toBeDisabled();

    // Preenchido com HOJE, grava HOJE — nunca a data prevista.
    await page.getByLabel("Valor efetivamente pago").fill("10.000,00");
    await page.getByRole("button", { name: "Salvar pagamento" }).click();

    // ⚠️ Espera pela URL, e não pelo título: `name: "Pagamento"` casa por
    // SUBSTRING com "Registrar o pagamento", e o teste seguia com o botão
    // ainda em "Salvando…" — verde pelo motivo errado.
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);
    const gravados = await pagamentos(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0].data_pagamento).toBe(hoje());
    expect(
      gravados[0].data_pagamento,
      "nenhum caminho de código grava a data prevista",
    ).not.toBe(prevista);
  });

  /**
   * Critério 12 — confirmar **cria um pagamento** e grava o vínculo. Dois
   * registros distintos, não conversão (parecer §3).
   */
  test("cria o pagamento E o vínculo, e o agendamento continua existindo", async ({
    page,
    db,
  }) => {
    const id = await agendamento(db, { data_prevista: maisDias(-3) });

    await page.goto(`/compromisso/${id}/confirmar`);
    await page.getByLabel("Data em que o dinheiro saiu").fill(hoje());
    // D65: o valor não vem mais pré-preenchido — quem afirma o desembolso é o
    // dedo do Mateus, aqui como no registro direto.
    await page.getByLabel("Valor efetivamente pago").fill("10.000,00");
    await page.getByRole("button", { name: "Salvar pagamento" }).click();
    // ⚠️ Espera pela URL, e não pelo título: `name: "Pagamento"` casa por
    // SUBSTRING com "Registrar o pagamento", e o teste seguia com o botão
    // ainda em "Salvando…" — verde pelo motivo errado.
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);

    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(1);

    const ligados = await vinculosDeQuitacao(db);
    expect(ligados).toHaveLength(1);
    expect(ligados[0]).toMatchObject({
      compromisso_id: id,
      pagamento_id: pagos[0].id,
    });

    // O agendamento NÃO virou o pagamento: continua lá, agora quitado.
    const agendados = await compromissos(db);
    expect(agendados).toHaveLength(1);
    expect(agendados[0].situacao).toBe("quitado");
  });

  /**
   * Critério 44 — **não existe estado "declarou que saiu"**. Tocar "Foi pago"
   * e voltar sem gravar não altera nada e não deixa rascunho.
   */
  test("tocar 'Foi pago' e voltar sem gravar não deixa rastro", async ({
    page,
    db,
  }) => {
    await agendamento(db, { data_prevista: maisDias(-8) });

    // ⚠️ Chega pelo TOQUE da home, e não por URL: o que o critério 44 protege
    // é o caminho curto do canteiro — o único deste ticket medido pela régua
    // de uma mão.
    await page.goto("/");
    await page
      .locator("[data-agendado='vencido']")
      .getByRole("link", { name: "Foi pago" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Registrar o pagamento", exact: true }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Voltar sem salvar" }).click();
    await page.waitForURL(/\/compromisso\/[0-9a-f-]+$/);

    // ⚠️ ZERO linhas em pagamento, e o agendamento segue vencido com as três
    // respostas.
    expect(await pagamentos(db)).toHaveLength(0);
    expect(await vinculosDeQuitacao(db)).toHaveLength(0);
    const agendados = await compromissos(db);
    expect(agendados[0].situacao).toBe("aberto");

    await page.goto("/");
    await expect(
      page
        .locator("[data-agendado='vencido']")
        .getByRole("link", { name: /Foi pago|Não vai ser pago|Mudou a data/ }),
    ).toHaveCount(3);
  });

  /**
   * Critérios 13, 14 e 31 — valor MAIOR: separação principal × encargos, e a
   * diferença sem explicação vira pendência VERMELHA na fila de /pendencias,
   * pelo valor exato, com o texto literal do §F.4.
   */
  test("pagou R$ 10.500 com R$ 200 de encargo: R$ 300,00 viram pendência", async ({
    page,
    db,
  }) => {
    const id = await agendamento(db, { data_prevista: maisDias(-3) });

    await page.goto(`/compromisso/${id}/confirmar`);
    await page.getByLabel("Data em que o dinheiro saiu").fill(hoje());
    await page.getByLabel("Valor efetivamente pago").fill("10.500,00");
    await page.getByLabel("Juros e multa por atraso").fill("200,00");

    await page.getByRole("button", { name: "Salvar pagamento" }).click();
    // ⚠️ Espera pela URL, e não pelo título: `name: "Pagamento"` casa por
    // SUBSTRING com "Registrar o pagamento", e o teste seguia com o botão
    // ainda em "Salvando…" — verde pelo motivo errado.
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);

    const registradas = await diferencas(db);
    expect(registradas).toHaveLength(1);
    expect(registradas[0]).toMatchObject({
      encargos: 200,
      nao_explicado: 300,
      // ⚠️ `null` é o "não sei ainda" do §F.2 — o único estado inicial
      // permitido, porque é o único que não afirma nada.
      resolucao: null,
    });

    // A fila passa a listar a pendência, com o valor exato.
    await page.goto("/pendencias");
    await expect(page.getByText("Diferença sem explicação").first()).toBeVisible();
    await expect(
      page.getByText(/R\$\s?300,00 do que você pagou ainda estão sem explicação/),
    ).toBeVisible();
    await expect(
      page.getByText(/ficam fora para sempre — e não há o que cobrar/),
    ).toBeVisible();
  });
  /**
   * ⚠️ **B4 do Gate 2 — o retry RETOMA, nunca recomeça.**
   *
   * A gravação são quatro chamadas (não há transação multi-statement pelo
   * PostgREST). Antes da correção, uma falha no vínculo devolvia ao mesmo botão
   * e o toque seguinte **re-executava `criarPagamento`**: nascia um segundo
   * pagamento REAL e o primeiro ficava órfão como pendência vermelha para
   * sempre — o acervo é append-only e a correção do CONTAI-021 não existe. Com
   * favorecido PF o dano sai do app: o desembolso duplicado entra na ficha
   * Pagamentos Efetuados, CPF por CPF.
   *
   * O 503 é falsificado só na rota do VÍNCULO, e é o mesmo status que o
   * PostgREST devolve quando não alcança o banco.
   */
  test("⚠️ falha no vínculo: o retry não cria um SEGUNDO pagamento", async ({
    page,
    db,
  }) => {
    const id = await agendamento(db, { data_prevista: maisDias(-3) });

    await page.goto(`/compromisso/${id}/confirmar`);
    await page.getByLabel("Data em que o dinheiro saiu").fill(hoje());
    await page.getByLabel("Valor efetivamente pago").fill("10.000,00");

    // Só o vínculo cai. O pagamento entra normalmente.
    await page.route(`${URL_SUPABASE_LOCAL}/rest/v1/compromisso_pagamento*`, (rota) =>
      rota.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "PGRST000",
          message: "could not connect to server",
        }),
      }),
    );

    await page.getByRole("button", { name: "Salvar pagamento" }).click();

    // Escopado em `main`: o Next mantém um `role="alert"` vazio no
    // route-announcer, e `getByRole("alert")` sozinho viola o strict mode.
    // (Gravação nunca é repetida — nem antes nem depois do CONTAI-006 —, então
    // o 503 do vínculo volta na primeira tentativa.)
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "O pagamento já está salvo",
      { timeout: 20_000 },
    );

    // ⚠️ CONTAI-006, critério 6, pelo lado que erra mais caro: aqui o servidor
    // RESPONDEU (503 com corpo), então o app SABE que o vínculo não entrou e
    // afirma isso. O texto de resultado incerto não pode aparecer — ele só vale
    // quando nenhuma resposta chegou, e usá-lo aqui devolveria ao Mateus a
    // dúvida que esta tela justamente resolveu.
    await expect(page.getByRole("main")).not.toContainText(
      "Não deu para confirmar se isso foi salvo",
    );

    // Meio do caminho: pagamento gravado, vínculo não.
    expect(await pagamentos(db)).toHaveLength(1);
    expect(await vinculosDeQuitacao(db)).toHaveLength(0);

    // Os campos do que já foi gravado congelam — o botão não corrige valor
    // nem data, e o acervo não apaga.
    await expect(page.getByLabel("Data em que o dinheiro saiu")).toBeDisabled();
    await expect(page.getByLabel("Valor efetivamente pago")).toBeDisabled();

    await page.unroute(`${URL_SUPABASE_LOCAL}/rest/v1/compromisso_pagamento*`);
    await page
      .getByRole("button", { name: "Tentar de novo — só falta ligar ao agendamento" })
      .click();
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);

    // ⚠️ A ASSERÇÃO QUE VALE: continua UM pagamento, não dois.
    const pagos = await pagamentos(db);
    expect(
      pagos,
      "o retry re-executando criarPagamento duplicaria dinheiro num acervo sem DELETE",
    ).toHaveLength(1);
    expect(await vinculosDeQuitacao(db)).toHaveLength(1);
    expect((await compromissos(db))[0].situacao).toBe("quitado");
  });
});

// ══ Mudou a data ════════════════════════════════════════════════════════

/**
 * Critério 33 — **o MESMO agendamento**: mesmo id, vínculo intacto, e a data
 * anterior no histórico. Fechar-e-abrir orfanaria o vínculo 1:N com pagamentos
 * já feitos e usaria "cancelado" para um adiamento.
 */
test("mudar a data mantém o mesmo agendamento, com o vínculo e o histórico", async ({
  page,
  db,
}) => {
  const nova = maisDias(7);
  const id = await agendamento(db, { data_prevista: maisDias(-8) });

  // Uma quitação PARCIAL já ligada, para provar que o vínculo sobrevive.
  await page.goto(`/compromisso/${id}/confirmar`);
  await page.getByLabel("Data em que o dinheiro saiu").fill(hoje());
  await page.getByLabel("Valor efetivamente pago").fill("6.000,00");
  await page.getByRole("button", { name: "Falta pagar o resto" }).click();
  await page.getByRole("button", { name: "Ainda não sei — deixar sem data" }).click();
  await page.getByRole("button", { name: "Salvar pagamento" }).click();
  await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);

  const antesDoVinculo = await vinculosDeQuitacao(db);
  expect(antesDoVinculo).toHaveLength(1);

  await page.goto(`/compromisso/${id}/data`);
  await page.getByLabel("Nova data prevista").fill(nova);
  await page.getByRole("button", { name: "Salvar a nova data" }).click();
  await page.waitForURL(/\/compromisso\/[0-9a-f-]+$/);

  // UMA linha em compromisso — não duas.
  const agendados = await compromissos(db);
  expect(agendados).toHaveLength(1);
  expect(agendados[0]).toMatchObject({
    id,
    data_prevista: nova,
    situacao: "aberto",
  });

  // Vínculo intacto.
  expect(await vinculosDeQuitacao(db)).toEqual(antesDoVinculo);

  // Histórico com a data antiga. A quitação parcial já deixou a primeira
  // linha ("sem data definida"); a mudança deixou a segunda.
  const historico = await historicoDeData(db);
  expect(historico.length).toBeGreaterThanOrEqual(1);
  expect(historico.at(-1)).toMatchObject({ compromisso_id: id, data_nova: nova });
});

// ══ Corrigir o valor previsto (CONTAI-073) ═══════════════════════════════

/**
 * ⚠️ **SEM IMPACTO FISCAL** (Gate Fiscal do ticket): valor previsto não compõe
 * custo de aquisição nem base de aferição INSS. O que estes testes provam é
 * ESTRUTURAL — que o rastro e o valor andam juntos, que fato consumado não se
 * reescreve, e que o saldo de uma quitação parcial não zera em silêncio.
 *
 * A pergunta é sempre **"o que entrou no banco?"**, contra o Postgres LOCAL,
 * pelo MESMO client autenticado do app, com a RLS ligada.
 */
test.describe("corrigir o valor previsto", () => {
  test("o valor muda, o rastro nasce, e nada mais do agendamento se move", async ({
    page,
    db,
  }) => {
    const vencimento = maisDias(20);
    const id = await agendamento(db, {
      valor_previsto: 4200,
      data_prevista: vencimento,
    });
    const antes = (await compromissos(db))[0];

    // Critério 12: o link mora no detalhe, no bloco de ações do agendamento.
    await page.goto(`/compromisso/${id}`);
    await page.getByRole("link", { name: "Corrigir o valor previsto" }).click();
    await page.waitForURL(/\/compromisso\/[0-9a-f-]+\/valor$/);

    // Critério 11: os DOIS campos nascem vazios, e o botão espera.
    await expect(page.getByLabel("Novo valor previsto")).toHaveValue("");
    await expect(page.getByLabel("Motivo da correção")).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Salvar o novo valor" }),
    ).toBeDisabled();
    // O valor atual aparece em modo leitura.
    await expect(page.getByText("R$ 4.200,00")).toBeVisible();

    // Critérios 16 e 3: valor igual ao atual é recusado ANTES do banco.
    await page.getByLabel("Novo valor previsto").fill("4.200,00");
    await expect(
      page.getByText("Igual ao valor previsto atual — não há o que corrigir."),
    ).toBeVisible();

    await page.getByLabel("Novo valor previsto").fill("4.850,00");
    await page
      .getByLabel("Motivo da correção")
      .fill("digitei errado, a parcela é maior");

    // Critério 17: a confirmação É o resumo "de A para B", sem modal.
    await expect(
      page.getByText("Valor previsto: de R$ 4.200,00 para R$ 4.850,00."),
    ).toBeVisible();
    // Sem pagamento parcial, nenhuma linha de saldo aparece.
    await expect(page.getByText(/Saldo passa de/)).toHaveCount(0);

    await page.getByRole("button", { name: "Salvar o novo valor" }).click();
    await page.waitForURL(/\/compromisso\/[0-9a-f-]+$/);

    // UMA linha em compromisso, com o valor novo — e critério 8: mais nada se
    // moveu (data, data de compra, favorecido, nota de origem, situação).
    const depois = await compromissos(db);
    expect(depois).toHaveLength(1);
    expect(Number(depois[0].valor_previsto)).toBe(4850);
    expect(depois[0]).toMatchObject({
      id,
      data_prevista: antes.data_prevista,
      data_compra: antes.data_compra,
      favorecido_id: antes.favorecido_id,
      documento_origem_id: antes.documento_origem_id,
      situacao: "aberto",
    });

    // Critério 7: o rastro e o valor, na mesma transação — nunca um sem o outro.
    const rastro = await historicoDeValor(db);
    expect(rastro).toHaveLength(1);
    expect(rastro[0]).toMatchObject({
      compromisso_id: id,
      motivo: "digitei errado, a parcela é maior",
    });
    expect(Number(rastro[0].valor_anterior)).toBe(4200);
    expect(Number(rastro[0].valor_novo)).toBe(4850);

    // ⚠️ Critério 20 — as duas tabelas de histórico são INDEPENDENTES: a de
    // DATA é a que alimenta o "adiado N×". Corrigir valor não pode inflá-la.
    expect(await historicoDeData(db)).toHaveLength(0);
    await expect(page.getByText(/adiado/)).toHaveCount(0);

    // Critério 19: o card de histórico do valor no detalhe, com o motivo.
    await expect(page.getByText("Histórico do valor previsto")).toBeVisible();
    await expect(page.getByText("R$ 4.200,00 → R$ 4.850,00")).toBeVisible();
    await expect(
      page.getByText("motivo: digitei errado, a parcela é maior"),
    ).toBeVisible();
  });

  /**
   * Critério 13 — URL direta num agendamento já respondido: banner, nenhum
   * formulário. **Nunca tela muda, nunca crash.**
   */
  test("agendamento já respondido: nem link no detalhe, nem formulário pela URL", async ({
    page,
    db,
  }) => {
    const id = await agendamento(db, { data_prevista: maisDias(-8) });

    await page.goto(`/compromisso/${id}/cancelar`);
    await page.getByLabel("Por que não vai ser pago?").fill("Comprei em outro lugar");
    await page.getByRole("button", { name: "Marcar que não vai ser pago" }).click();
    await page.waitForURL(/\/compromisso\/[0-9a-f-]+$/);

    // O link desaparece junto com o resto do bloco de ações.
    await expect(
      page.getByRole("link", { name: "Corrigir o valor previsto" }),
    ).toHaveCount(0);

    await page.goto(`/compromisso/${id}/valor`);
    await expect(page.getByText(/Este agendamento já foi respondido/)).toBeVisible();
    await expect(page.getByText("Não há o que corrigir de valor por aqui.")).toBeVisible();
    await expect(page.getByLabel("Novo valor previsto")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Salvar o novo valor" }),
    ).toBeDisabled();
    // "Voltar sem salvar" continua disponível — a tela nunca é um beco.
    await expect(page.getByRole("link", { name: "Voltar sem salvar" })).toBeVisible();

    // E o banco não mudou nem ganhou rastro.
    expect(Number((await compromissos(db))[0].valor_previsto)).toBe(10000);
    expect(await historicoDeValor(db)).toHaveLength(0);
  });

  /**
   * ⚠️ **A GUARDA CENTRAL, pelos DOIS lados** (critério 5 / pre-mortem 1): a
   * tela recusa antes do clique, e a RPC recusa mesmo chamada direto — é essa
   * segunda metade que fecha a corrida com uma quitação parcial gravada em
   * outra aba. Sem ela, `saldoDoCompromisso` (`max(0, previsto − pago)`)
   * zeraria em silêncio e o agendamento ficaria `aberto` com saldo zero.
   */
  test("com quitação parcial, valor ≤ o já pago é recusado pela tela E pelo banco", async ({
    page,
    db,
  }) => {
    const id = await agendamento(db, { valor_previsto: 10000 });

    // Quitação PARCIAL de R$ 6.000: o agendamento segue aberto com saldo.
    await page.goto(`/compromisso/${id}/confirmar`);
    await page.getByLabel("Data em que o dinheiro saiu").fill(hoje());
    await page.getByLabel("Valor efetivamente pago").fill("6.000,00");
    await page.getByRole("button", { name: "Falta pagar o resto" }).click();
    await page.getByRole("button", { name: "Ainda não sei — deixar sem data" }).click();
    await page.getByRole("button", { name: "Salvar pagamento" }).click();
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);

    await page.goto(`/compromisso/${id}/valor`);

    // Critério 14: o banner do já pago aparece ANTES de qualquer digitação.
    await expect(
      page.getByText(/Já pago R\$\s6\.000,00 contra este agendamento\./),
    ).toBeVisible();

    // Critério 16: a tela recusa o valor ≤ pago, com o texto que diz quanto.
    await page.getByLabel("Novo valor previsto").fill("5.500,00");
    await page.getByLabel("Motivo da correção").fill("errei o total");
    await expect(
      page.getByText(/Já foi pago R\$\s6\.000,00 contra este agendamento\./),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Salvar o novo valor" }),
    ).toBeDisabled();

    // Critério 15: com valor válido, a prévia do saldo aparece.
    await page.getByLabel("Novo valor previsto").fill("8.000,00");
    await expect(
      page.getByText(/Saldo passa de R\$\s4\.000,00 para R\$\s2\.000,00\./),
    ).toBeVisible();

    // ⚠️ E AGORA O LADO QUE IMPORTA: a RPC chamada DIRETO, como faria a aba que
    // carregou a tela antes da quitação parcial existir. Mesmo client
    // autenticado, mesma RLS — e o banco recusa.
    const recusa = await db.rpc("corrigir_valor_compromisso", {
      p_compromisso_id: id,
      p_valor_novo: 5500,
      p_motivo: "corrida com a quitação parcial",
    });
    expect(recusa.error?.code).toBe("CT073");
    expect(recusa.error?.message).toContain("já foi pago");

    // ⚠️ **A FRONTEIRA EXATA (`<=`, não `<`)**: pagar 6.000 e "corrigir" o
    // previsto para 6.000 deixaria o compromisso ABERTO com saldo zero — o
    // estado que nenhuma tela sabe ler. O `<` sozinho não provava isto.
    const naFronteira = await db.rpc("corrigir_valor_compromisso", {
      p_compromisso_id: id,
      p_valor_novo: 6000,
      p_motivo: "exatamente o que já foi pago",
    });
    expect(naFronteira.error?.code).toBe("CT073");

    // ⚠️ **O BURACO DE ARREDONDAMENTO que o `cto-obra` achou no Gate 2.** O
    // parâmetro é `numeric` sem typmod e a coluna é `numeric(14,2)`: antes da
    // correção, `6000.004 > 6000` passava pela guarda e **gravava `6000.00`** —
    // o saldo zerava em silêncio, por dentro da própria guarda que existe para
    // impedir isso. A RPC agora arredonda ANTES de decidir.
    //
    // O client nunca manda 3 casas (`centavosParaNumeric` normaliza), e isso é
    // irrelevante: a guarda do banco vale para qualquer caminho — SQL editor,
    // script, RPC direta —, e é essa a doutrina escrita na migration.
    const comTerceiraCasa = await db.rpc("corrigir_valor_compromisso", {
      p_compromisso_id: id,
      p_valor_novo: 6000.004,
      p_motivo: "três casas decimais viram 6000,00 na coluna",
    });
    expect(comTerceiraCasa.error?.code).toBe("CT073");

    // Nada gravou em nenhuma das três: nem valor, nem rastro.
    expect(Number((await compromissos(db))[0].valor_previsto)).toBe(10000);
    expect(await historicoDeValor(db)).toHaveLength(0);

    // Acima do pago a mesma RPC grava, e o agendamento SEGUE ABERTO com saldo.
    const aceita = await db.rpc("corrigir_valor_compromisso", {
      p_compromisso_id: id,
      p_valor_novo: 8000,
      p_motivo: "errei o total do contrato",
    });
    expect(aceita.error).toBeNull();
    const cs = await compromissos(db);
    expect(Number(cs[0].valor_previsto)).toBe(8000);
    expect(cs[0].situacao).toBe("aberto");
    expect(await historicoDeValor(db)).toHaveLength(1);
  });

  /**
   * As recusas que a tela também faz, provadas no BANCO: chamada direta pelo
   * PostgREST não tem tela na frente, e é por isso que cada guarda está nos
   * dois lugares (critérios 2, 3, 4 e 6).
   */
  test("a RPC recusa situação respondida, valor igual, zero e motivo vazio", async ({
    db,
  }) => {
    const aberto = await agendamento(db, { valor_previsto: 4200 });

    const igual = await db.rpc("corrigir_valor_compromisso", {
      p_compromisso_id: aberto,
      p_valor_novo: 4200,
      p_motivo: "nada a corrigir",
    });
    expect(igual.error?.message).toContain("igual ao valor previsto atual");

    // O efeito colateral bom da normalização do Gate 2: `4200.004` é `4200.00`
    // na coluna, logo é "igual ao atual" — mensagem legível, e não um erro cru
    // do check `compromisso_valor_historico_mudou` vazando para a tela.
    const igualDepoisDeArredondar = await db.rpc("corrigir_valor_compromisso", {
      p_compromisso_id: aberto,
      p_valor_novo: 4200.004,
      p_motivo: "três casas que arredondam para o valor atual",
    });
    expect(igualDepoisDeArredondar.error?.message).toContain(
      "igual ao valor previsto atual",
    );

    // Zero pelo mesmo caminho: `0.004` é `0.00` na coluna.
    for (const valor of [0, -100, 0.004]) {
      const zero = await db.rpc("corrigir_valor_compromisso", {
        p_compromisso_id: aberto,
        p_valor_novo: valor,
        p_motivo: "zerando",
      });
      expect(zero.error?.message).toContain("maior que zero");
    }

    for (const motivo of ["", "   "]) {
      const semMotivo = await db.rpc("corrigir_valor_compromisso", {
        p_compromisso_id: aberto,
        p_valor_novo: 4850,
        p_motivo: motivo,
      });
      expect(semMotivo.error?.message).toContain("motivo da correção é obrigatório");
    }

    // Nada disso gravou.
    expect(Number((await compromissos(db))[0].valor_previsto)).toBe(4200);
    expect(await historicoDeValor(db)).toHaveLength(0);

    // E o agendamento CANCELADO: fato consumado não se reescreve (critério 2).
    // ⚠️ Reaproveita o MESMO favorecido do primeiro: `favorecido` é único por
    // (dono, documento), e um segundo `agendamento()` tentaria recriar o
    // mesmo CNPJ.
    const favorecidoId = (await compromissos(db))[0].favorecido_id!;
    const cancelado = await criarCompromisso(db, {
      favorecido_id: favorecidoId,
      valor_previsto: 700,
      data_prevista: maisDias(28),
      origem: "boleto",
    });
    const cancelamento = await db
      .from("compromisso")
      .update({ situacao: "cancelado", motivo_cancelamento: "comprei em outro lugar" })
      .eq("id", cancelado);
    expect(cancelamento.error).toBeNull();

    const respondido = await db.rpc("corrigir_valor_compromisso", {
      p_compromisso_id: cancelado,
      p_valor_novo: 900,
      p_motivo: "tentando reescrever o passado",
    });
    expect(respondido.error?.message).toContain("já foi respondido");
    expect(await historicoDeValor(db)).toHaveLength(0);
  });

  /**
   * ⚠️ **O rastro é APPEND-ONLY, e é o banco que garante** (critério 9): a
   * tabela nasce sem UPDATE e sem DELETE para `authenticated`. Um teste que só
   * olhasse a tela não provaria isso — o PostgREST expõe a tabela.
   */
  test("o rastro do valor não se edita nem se apaga, nem pelo dono", async ({
    db,
  }) => {
    const id = await agendamento(db, { valor_previsto: 4200 });
    const gravou = await db.rpc("corrigir_valor_compromisso", {
      p_compromisso_id: id,
      p_valor_novo: 4850,
      p_motivo: "digitei errado",
    });
    expect(gravou.error).toBeNull();

    const linha = (await historicoDeValor(db))[0];

    const tentouEditar = await db
      .from("compromisso_valor_historico")
      .update({ motivo: "reescrevendo a história" })
      .eq("id", linha.id);
    expect(tentouEditar.error?.code).toBe("42501");

    const tentouApagar = await db
      .from("compromisso_valor_historico")
      .delete()
      .eq("id", linha.id);
    expect(tentouApagar.error?.code).toBe("42501");

    expect(await historicoDeValor(db)).toEqual([linha]);
  });
});

// ══ Cancelar ════════════════════════════════════════════════════════════

/**
 * Critério 22 — "Marcar que não vai ser pago" mora **só no detalhe**, exige
 * motivo e **não apaga**: fica registrado como cancelado.
 */
test("cancelar mora só no detalhe, exige motivo e não apaga", async ({
  page,
  db,
}) => {
  const id = await agendamento(db, { data_prevista: maisDias(-8) });

  // ⚠️ O cartão da home NÃO tem "Marcar que não vai ser pago" (diretriz 6) —
  // ele tem a resposta curta "Não vai ser pago", que LEVA ao detalhe.
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Marcar que não vai ser pago" }),
  ).toHaveCount(0);

  await page.goto(`/compromisso/${id}/cancelar`);
  await expect(
    page.getByRole("button", { name: "Marcar que não vai ser pago" }),
  ).toBeDisabled();

  await page
    .getByLabel("Por que não vai ser pago?")
    .fill("Compra cancelada — comprei em outro fornecedor");
  await page.getByRole("button", { name: "Marcar que não vai ser pago" }).click();
  await page.waitForURL(/\/compromisso\/[0-9a-f-]+$/);

  // NÃO APAGA: a linha continua lá, cancelada, com o motivo.
  const agendados = await compromissos(db);
  expect(agendados).toHaveLength(1);
  expect(agendados[0]).toMatchObject({
    situacao: "cancelado",
    motivo_cancelamento: "Compra cancelada — comprei em outro fornecedor",
  });

  // E sai do bloco de agendados da home.
  await page.goto("/");
  await expect(page.locator("[data-bloco='agendados']")).toHaveCount(0);
});
