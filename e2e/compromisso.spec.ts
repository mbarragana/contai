import { OBRA_ID_SEED, URL_SUPABASE_LOCAL } from "./ambiente";
import {
  compromissos,
  criarCompromisso,
  criarFavorecido,
  diferencas,
  historicoDeData,
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
    await page.getByLabel("Data do pagamento").fill(prevista);
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
  test("cartão é recusado na entrada, com a mensagem e o caminho", async ({
    page,
    db,
  }) => {
    await irParaFormulario(page);

    // Data de ONTEM, de propósito: pela regra da data isto seria pagamento.
    await page.getByLabel("Data do pagamento").fill(maisDias(-1));
    await page.getByRole("group", { name: "Como foi pago" }).getByText("Cartão").click();

    await expect(
      page.getByText(
        /compra no cartão ainda não tem fluxo neste app — o custo é do ano em que a fatura for paga/,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/Registre depois que a fatura for paga/),
    ).toBeVisible();

    // O botão não grava nada.
    await expect(
      page.getByRole("button", { name: /Cartão ainda não tem fluxo/ }),
    ).toBeDisabled();
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

    // Botão desabilitado, e dizendo o que falta.
    await expect(
      page.getByRole("button", { name: "Informe a data em que o dinheiro saiu" }),
    ).toBeDisabled();

    // ⚠️ Não existe atalho que preencha data.
    await expect(page.getByRole("button", { name: /hoje/i })).toHaveCount(0);

    // Preenchido com HOJE, grava HOJE — nunca a data prevista.
    await page.getByLabel("Data em que o dinheiro saiu").fill(hoje());
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
   * diferença sem explicação vira pendência VERMELHA na home, pelo valor
   * exato, com o texto literal do §F.4.
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

    // A home passa a listar a pendência, com o valor exato.
    await page.goto("/");
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

    // Timeout folgado: o postgrest-js repete 503 três vezes com backoff
    // (1s+2s+4s) antes de desistir.
    // Escopado em `main`: o Next mantém um `role="alert"` vazio no
    // route-announcer, e `getByRole("alert")` sozinho viola o strict mode.
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "O pagamento já está salvo",
      { timeout: 20_000 },
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
