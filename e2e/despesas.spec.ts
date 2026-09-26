import { USER_ID_SEED } from "./ambiente";
import {
  criarDocumento,
  criarFavorecido,
  criarLinhaDeRetencao,
  criarPagamento,
  criarVinculo,
} from "./banco";
import { expect, test } from "./fixtures";
/**
 * ⚠️ **O texto fiscal se confere contra a CONSTANTE que a tela lê.** Digitá-lo
 * de novo aqui seria só uma segunda chance de errar — e um teste que passa com
 * o texto errado dos dois lados.
 */
import {
  BOLETO_FORA_DO_TOTAL,
  CONSEQUENCIA_BOLETO,
  CONSEQUENCIA_QUARENTENA,
} from "../lib/fiscal/documento";
import { rotulosPagoSemNota } from "../lib/fiscal/pagamento";
import { EXPLICACAO_NOTAS_SEM_PAGAMENTO } from "../lib/fiscal/vinculo";

/**
 * **CONTAI-041 — a tabela de verdade de `/despesas`.**
 *
 * Roda no projeto `mobile`, nos 375px que continuam sendo o PISO do produto
 * (`CLAUDE.md`): comportamento se prova uma vez, aqui. O que só a largura de
 * gestão pode provar — a tabela em colunas de verdade — fica no projeto
 * `desktop`, em `shell-desktop.spec.ts`.
 *
 * O que este arquivo trava:
 * (a) comprovada e pendente convivem na MESMA lista, e a consequência fiscal
 *     aparece INTEIRA, sem clique e sem reticências (critério 6);
 * (b) **o filtro padrão é "Todas"** — nenhuma pendência fica escondida na
 *     primeira visita (Pre-mortem 2), e a lista vazia por filtro se identifica
 *     como filtro, nunca como obra vazia;
 * (c) os três filtros e as duas ordenações funcionam de verdade (critérios 8 e 9);
 * (d) o "Ver todas (N) →" do dashboard chega aqui SEM filtro pré-aplicado
 *     (critério 10).
 */

const ANO = new Date().getFullYear();

const CNPJ_AJE = "11222333000181";
const CNPJ_CASA = "11444777000161";
const CPF_JOAO = "52998224725";

/**
 * O cenário do mock, reduzido ao que prova cada regra de montagem:
 * - `p1` + `d1`: NF de material paga por PIX → linha VERDE, uma só;
 * - `p2`: PIX para PF sem documento nenhum → "pago sem recibo";
 * - `d2`: NF de material em quarentena, sem pagamento → linha própria;
 * - `d3`: boleto aguardando pagamento → linha própria, com as duas frases;
 * - `d4`: NF hábil sem pagamento ligado → o TERCEIRO ESTADO, chip neutro.
 */
async function cenario(db: Parameters<typeof criarFavorecido>[0]) {
  const aje = await criarFavorecido(db, {
    nome: "AJE Construções",
    documento: CNPJ_AJE,
    tipo: "pj",
  });
  const casa = await criarFavorecido(db, {
    nome: "Casa do Construtor",
    documento: CNPJ_CASA,
    tipo: "pj",
  });
  const joao = await criarFavorecido(db, {
    nome: "João Pedreiro",
    documento: CPF_JOAO,
    tipo: "pf",
  });

  const d1 = await criarDocumento(db, {
    favorecido_id: casa,
    tipo: "nf_material",
    classificacao: "material",
    valor: 9640,
    numero: "8710",
    data_emissao: `${ANO}-01-10`,
    destinatario_cpf_ok: true,
    status: "registrado",
  });
  const p1 = await criarPagamento(db, {
    favorecido_id: casa,
    valor: 9640,
    data_pagamento: `${ANO}-01-12`,
    meio: "boleto",
    status: "aguardando_nf",
    comprovante_path: `${USER_ID_SEED}/comprovante/boleto.png`,
  });
  await criarVinculo(db, p1, d1);

  const p2 = await criarPagamento(db, {
    favorecido_id: joao,
    valor: 3200,
    data_pagamento: `${ANO}-02-14`,
    meio: "pix",
    status: "aguardando_nf",
    comprovante_path: `${USER_ID_SEED}/comprovante/pix.png`,
  });

  await criarDocumento(db, {
    favorecido_id: casa,
    tipo: "nf_material",
    classificacao: "material",
    valor: 4850,
    numero: "8899",
    data_emissao: `${ANO}-02-18`,
    destinatario_cpf_ok: false,
    status: "quarentena",
    motivo_quarentena: "Documento não está no CPF do dono da obra.",
  });

  await criarDocumento(db, {
    favorecido_id: aje,
    tipo: "boleto",
    valor: 25000,
    vencimento: `${ANO}-03-15`,
    destinatario_cpf_ok: true,
    status: "aguardando_pagamento",
  });

  await criarDocumento(db, {
    favorecido_id: aje,
    tipo: "nf_servico",
    classificacao: "mao_obra",
    valor: 11000,
    numero: "1032",
    data_emissao: `${ANO}-03-09`,
    retencao_na_nota: "nenhuma",
    nota_traz_cno: true,
    cno_referenciado: "12.345.67890/26",
    destinatario_cpf_ok: true,
    status: "registrado",
  });

  return { p1, p2 };
}

const TABELA = '[data-tabela="despesas"]';
const LINHAS = `${TABELA} tbody tr`;

test.describe("despesas — a tabela de verdade", () => {
  test("comprovada e pendente na mesma tabela, com a consequência inteira", async ({
    page,
    db,
  }) => {
    await cenario(db);

    await page.goto("/despesas");
    await expect(page.locator(TABELA)).toBeVisible();

    // 2 pagamentos + 3 documentos sem pagamento ligado = 5 linhas. A NF paga
    // (`d1`) NÃO tem linha própria: ela mora na linha do pagamento dela, e
    // somá-la contaria a mesma despesa duas vezes (critério 4).
    await expect(page.locator(LINHAS)).toHaveCount(5);
    await expect(page.locator('[data-contagem="despesas"]')).toHaveText(
      `5 lançamentos em ${ANO}`,
    );

    // ── (a) as quatro naturezas convivem ────────────────────────────────
    await expect(page.getByText("Custo comprovado")).toBeVisible();
    await expect(page.getByText(rotulosPagoSemNota("pf").chip)).toBeVisible();
    await expect(page.getByText("Quarentena")).toBeVisible();
    // O terceiro estado, com chip NEUTRO — nem comprovado nem em risco.
    await expect(page.getByText("Sem pagamento ligado")).toBeVisible();

    // ── a consequência fiscal, INTEIRA e sem clique nenhum ──────────────
    await expect(page.getByText(CONSEQUENCIA_QUARENTENA)).toBeVisible();
    await expect(
      page.getByText(rotulosPagoSemNota("pf").consequencia),
    ).toBeVisible();
    await expect(page.getByText(CONSEQUENCIA_BOLETO)).toBeVisible();
    // A segunda frase do boleto: sem ela a saída do total vira encolhimento
    // silencioso.
    await expect(page.getByText(BOLETO_FORA_DO_TOTAL)).toBeVisible();
    await expect(
      page.getByText(EXPLICACAO_NOTAS_SEM_PAGAMENTO),
    ).toBeVisible();

    // Nada truncado: nenhum parágrafo da tabela transborda o próprio box.
    const cortados = await page.evaluate(() => {
      const fora: string[] = [];
      for (const el of document.querySelectorAll("main table p")) {
        if (el.scrollWidth > el.clientWidth + 1) {
          fora.push((el.textContent ?? "").slice(0, 80));
        }
      }
      return fora;
    });
    expect(cortados).toEqual([]);

    // ── a linha leva ao registro que já existe ──────────────────────────
    await page
      .locator(LINHAS)
      .filter({ hasText: "João Pedreiro" })
      .getByRole("link", { name: "Abrir →" })
      .click();
    await expect(page.getByRole("heading", { name: "Pagamento" })).toBeVisible();
  });

  /**
   * **Pre-mortem 2, e é o critério que a tela existe para cumprir.** Se o
   * padrão nascer "Só comprovadas", a pendência fica escondida na primeira
   * visita — e a Meta 1 falha exatamente na superfície criada para servi-la.
   */
  test("o padrão é 'Todas' — nenhuma pendência escondida na primeira visita", async ({
    page,
    db,
  }) => {
    await cenario(db);

    await page.goto("/despesas");
    await expect(page.locator(TABELA)).toBeVisible();

    await expect(page.getByLabel("Situação")).toHaveValue("todas");
    await expect(page.getByLabel("Tipo de documento")).toHaveValue("todos");
    await expect(page.getByLabel("Buscar favorecido")).toHaveValue("");
    // Com o padrão, toda pendência da obra está em tela.
    await expect(page.getByText(CONSEQUENCIA_QUARENTENA)).toBeVisible();
    await expect(
      page.getByText(rotulosPagoSemNota("pf").consequencia),
    ).toBeVisible();
  });

  test("os três filtros funcionam, e a lista vazia se identifica como filtro", async ({
    page,
    db,
  }) => {
    await cenario(db);
    await page.goto("/despesas");
    await expect(page.locator(LINHAS)).toHaveCount(5);

    // Só comprovadas: sobra a linha do pagamento ligado à NF.
    await page.getByLabel("Situação").selectOption("comprovadas");
    await expect(page.locator(LINHAS)).toHaveCount(1);
    await expect(page.locator(LINHAS)).toContainText("Casa do Construtor");
    await expect(page.locator('[data-contagem="despesas"]')).toHaveText(
      `1 de 5 lançamentos em ${ANO}`,
    );

    // Só com pendência: as três com consequência fiscal aberta. O terceiro
    // estado NÃO entra — não é pendência, e somá-lo inflaria a exposição.
    await page.getByLabel("Situação").selectOption("pendencia");
    await expect(page.locator(LINHAS)).toHaveCount(3);
    await expect(page.getByText(EXPLICACAO_NOTAS_SEM_PAGAMENTO)).toHaveCount(0);

    // Tipo de documento.
    await page.getByLabel("Situação").selectOption("todas");
    await page.getByLabel("Tipo de documento").selectOption("boleto");
    await expect(page.locator(LINHAS)).toHaveCount(1);
    await expect(page.getByText(CONSEQUENCIA_BOLETO)).toBeVisible();

    await page.getByLabel("Tipo de documento").selectOption("sem_documento");
    await expect(page.locator(LINHAS)).toHaveCount(1);
    await expect(page.locator(LINHAS)).toContainText("João Pedreiro");

    // Busca por favorecido, sem caixa e sem acento.
    await page.getByLabel("Tipo de documento").selectOption("todos");
    await page.getByLabel("Buscar favorecido").fill("joao");
    await expect(page.locator(LINHAS)).toHaveCount(1);

    // ── nenhuma linha: a tela diz que é o FILTRO, e devolve a saída ─────
    await page.getByLabel("Buscar favorecido").fill("ninguém com esse nome");
    await expect(page.locator(TABELA)).toHaveCount(0);
    const aviso = page.getByRole("status");
    await expect(aviso).toContainText("Nenhum lançamento com estes filtros");
    await expect(aviso).toContainText(`5 lançamentos em ${ANO}`);
    await page.getByRole("button", { name: "Mostrar todos" }).click();
    await expect(page.locator(LINHAS)).toHaveCount(5);
    await expect(page.getByLabel("Situação")).toHaveValue("todas");
  });

  test("ordenação por clique no cabeçalho — data e valor", async ({
    page,
    db,
  }) => {
    await cenario(db);
    await page.goto("/despesas");
    await expect(page.locator(LINHAS)).toHaveCount(5);

    const favorecidos = () =>
      page.locator(LINHAS).evaluateAll((linhas) =>
        linhas.map((l) => (l.textContent ?? "").slice(0, 60)),
      );

    // Padrão: data decrescente, e quem não tem data de pagamento vai para o
    // fim — "sem data" não é data zero nem data infinita.
    const padrao = await favorecidos();
    expect(padrao[0]).toContain("14/02");
    expect(padrao[1]).toContain("12/01");
    // As três linhas de documento não têm data de pagamento.
    expect(padrao.slice(2).every((t) => t.includes("—"))).toBe(true);

    await page.locator("[data-ordenar='data']").click();
    const crescente = await favorecidos();
    expect(crescente[0]).toContain("12/01");
    expect(crescente[1]).toContain("14/02");
    expect(crescente.slice(2).every((t) => t.includes("—"))).toBe(true);

    // Valor: decrescente na primeira batida — o boleto de R$ 25.000 sobe.
    await page.locator("[data-ordenar='valor']").click();
    expect((await favorecidos())[0]).toContain("AJE Construções");
    await page.locator("[data-ordenar='valor']").click();
    expect((await favorecidos())[0]).toContain("João Pedreiro");
  });

  /**
   * **Critério 10** — o recorte do dashboard é ponto de partida, nunca
   * substituto: o link leva à lista INTEIRA, sem filtro pré-aplicado.
   */
  test("o 'Ver todas' do dashboard chega aqui sem filtro nenhum", async ({
    page,
    db,
  }) => {
    await cenario(db);

    await page.goto("/");
    const painel = page.locator('[data-painel="despesas-recentes"]');
    const verTodas = painel.getByRole("link", { name: /Ver todas \(\d+\)/ });
    await expect(verTodas).toHaveAttribute("href", "/despesas");
    await verTodas.click();

    await expect(page).toHaveURL("/despesas");
    await expect(page.getByLabel("Situação")).toHaveValue("todas");
    await expect(page.getByLabel("Tipo de documento")).toHaveValue("todos");
    // Chega mostrando TUDO — inclusive o que não é despesa comprovada.
    await expect(page.locator(LINHAS)).toHaveCount(5);
    await expect(page.getByText(CONSEQUENCIA_QUARENTENA)).toBeVisible();
  });

  /**
   * **Gate 2 do `cto-obra`** — `documento.valor` é NULLABLE, e a nota que
   * chegou por WhatsApp sem o número ainda é estado legítimo. A tabela mostra
   * `—`, exatamente como `/documento/[id]` já mostra: "R$ 0,00" seria afirmar
   * um zero que ninguém lançou, e as duas telas divergindo sobre o MESMO fato.
   */
  test("nota sem valor lançado mostra '—', nunca 'R$ 0,00'", async ({
    page,
    db,
  }) => {
    const casa = await criarFavorecido(db, {
      nome: "Casa do Construtor",
      documento: CNPJ_CASA,
      tipo: "pj",
    });
    await criarDocumento(db, {
      favorecido_id: casa,
      tipo: "nf_material",
      classificacao: "material",
      valor: null,
      numero: "8710",
      data_emissao: `${ANO}-01-10`,
      destinatario_cpf_ok: true,
      status: "registrado",
    });

    await page.goto("/despesas");
    const linha = page.locator(LINHAS);
    await expect(linha).toHaveCount(1);
    await expect(linha).not.toContainText("R$ 0,00");
    await expect(linha).toContainText("—");

    // **CONTAI-057, critério 4** — nota sem pagamento nenhum não comprova custo
    // nenhum, e a coluna mostra `—`, nunca "R$ 0,00". A RAZÃO não se repete
    // aqui: ela está na célula `Situação` ao lado.
    const confirmado = linha.locator("[data-custo-comprovado]");
    await expect(confirmado).toHaveAttribute("data-custo-comprovado", "0");
    await expect(confirmado).toHaveText("—");
  });

  /**
   * **CONTAI-057** — o número que mudou de significado no `CONTAI-056` sai da
   * anotação pequena e ganha coluna própria. Sem isto, somar as linhas de
   * "Valor lançado" à mão dá um total diferente do KPI "Custo confirmado" da
   * Home — que é o relato de origem, palavra por palavra.
   *
   * ⚠️ **Não-mockado, e a razão é a mesma do `retencao.spec.ts`**: o valor da
   * linha de retenção atravessa `documento_retencao.valor` (`numeric(14,2)`), o
   * formato que já passou verde por um E2E em cima de um tipo inventado.
   */
  test("coluna 'Custo confirmado': com retenção passa do lançado, sem retenção coincide", async ({
    page,
    db,
  }) => {
    // (a) NF de material paga por PIX, sem retenção nenhuma.
    const casa = await criarFavorecido(db, {
      nome: "Casa do Construtor",
      documento: CNPJ_CASA,
      tipo: "pj",
    });
    const dMaterial = await criarDocumento(db, {
      favorecido_id: casa,
      tipo: "nf_material",
      classificacao: "material",
      valor: 9640,
      numero: "8710",
      data_emissao: `${ANO}-01-10`,
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    const pMaterial = await criarPagamento(db, {
      favorecido_id: casa,
      valor: 9640,
      data_pagamento: `${ANO}-01-12`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix.png`,
    });
    await criarVinculo(db, pMaterial, dMaterial);

    // (b) O caso real do `CONTAI-056`: NF de serviço de R$ 18.000, PIX pelo
    // LÍQUIDO de R$ 17.460, e os R$ 540 quitados pela retenção que a empresa
    // recolhe. O custo de aquisição é o BRUTO — parecer
    // `2026-09-18-retencao-variavel-servico-pj.md`, ADENDO 2/3.
    const aje = await criarFavorecido(db, {
      nome: "AJE Construções",
      documento: CNPJ_AJE,
      tipo: "pj",
    });
    const dServico = await criarDocumento(db, {
      favorecido_id: aje,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      valor: 18000,
      numero: "1042",
      data_emissao: `${ANO}-03-20`,
      destinatario_cpf_ok: true,
      nota_traz_cno: true,
      cno_referenciado: "12.345.67890/26",
      retencao_na_nota: "destacada",
      status: "registrado",
    });
    await criarLinhaDeRetencao(db, {
      documento_id: dServico,
      rotulo_literal: "Total das Retenções (ISSQN / Federais)",
      valor: 540,
      composicao: "combinado_nao_aberto",
      e_desconto_efetivo: true,
      quem_recolhe: "empresa",
    });
    const pLiquido = await criarPagamento(db, {
      favorecido_id: aje,
      valor: 17460,
      data_pagamento: `${ANO}-03-25`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix.png`,
    });
    await criarVinculo(db, pLiquido, dServico);

    await page.goto("/despesas");
    await expect(page.locator(LINHAS)).toHaveCount(2);

    // ── com retenção: confirmado (bruto) > lançado (líquido) ─────────────
    const comRetencao = page
      .locator(LINHAS)
      .filter({ hasText: "AJE Construções" });
    const confirmado = comRetencao.locator("[data-custo-comprovado]");
    await expect(confirmado).toHaveAttribute("data-custo-comprovado", "1800000");
    await expect(confirmado).toHaveText("R$ 18.000,00");
    // O valor lançado continua sendo o que saiu da conta, e a diferença é
    // explicada ao lado — o chip de retenção mantém o valor dele.
    await expect(comRetencao).toContainText("R$ 17.460,00");
    await expect(comRetencao).toContainText("Quitado por retenção");
    await expect(comRetencao).toContainText("R$ 540,00");

    // ── sem retenção: os dois números coincidem, e isso é o esperado ─────
    const semRetencao = page
      .locator(LINHAS)
      .filter({ hasText: "Casa do Construtor" });
    const confirmadoDoMaterial = semRetencao.locator("[data-custo-comprovado]");
    await expect(confirmadoDoMaterial).toHaveAttribute(
      "data-custo-comprovado",
      "964000",
    );
    await expect(confirmadoDoMaterial).toHaveText("R$ 9.640,00");
    // Duas ocorrências, e só duas: "Valor lançado" e "Custo confirmado". O chip
    // verde perdeu o valor inline (critério 5) — três seria o ruído que o
    // ticket veio tirar.
    await expect(semRetencao.getByText("R$ 9.640,00")).toHaveCount(2);
  });

  /**
   * **CONTAI-060 — o seletor de ano do shell recorta esta tabela.**
   *
   * Três coisas de uma vez, e as três são critério de aceite:
   * - o ano nasce no ano CORRENTE, nunca em "todos" (critério 3);
   * - trocar o ano recorta a tabela e a contagem "N de M", com M do ano em
   *   exibição (critério 1 + achado do designer, item 3);
   * - a linha SEM data de pagamento continua visível em qualquer ano — inclusive
   *   num ano sem lançamento nenhum (critério 5, parecer de 2026-09-26).
   */
  test("o seletor de ano recorta a tabela, e a linha sem data nunca desaparece", async ({
    page,
    db,
  }) => {
    const casa = await criarFavorecido(db, {
      nome: "Casa do Construtor",
      documento: CNPJ_CASA,
      tipo: "pj",
    });
    // Pago em ANO−1: só aparece no ano passado.
    const dAnterior = await criarDocumento(db, {
      favorecido_id: casa,
      tipo: "nf_material",
      classificacao: "material",
      valor: 5000,
      numero: "7001",
      data_emissao: `${ANO - 1}-11-20`,
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    const pAnterior = await criarPagamento(db, {
      favorecido_id: casa,
      valor: 5000,
      data_pagamento: `${ANO - 1}-11-25`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix.png`,
    });
    await criarVinculo(db, pAnterior, dAnterior);

    // Pago no ano corrente.
    const joao = await criarFavorecido(db, {
      nome: "João Pedreiro",
      documento: CPF_JOAO,
      tipo: "pf",
    });
    await criarPagamento(db, {
      favorecido_id: joao,
      valor: 3200,
      data_pagamento: `${ANO}-02-14`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix.png`,
    });

    // A NOTA ÓRFÃ: registrada, sem pagamento nenhum — não tem data de
    // pagamento, logo não cai em ano nenhum e não pode sumir de nenhum.
    const aje = await criarFavorecido(db, {
      nome: "AJE Construções",
      documento: CNPJ_AJE,
      tipo: "pj",
    });
    await criarDocumento(db, {
      favorecido_id: aje,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      valor: 11000,
      numero: "1032",
      data_emissao: `${ANO}-03-09`,
      retencao_na_nota: "nenhuma",
      nota_traz_cno: true,
      cno_referenciado: "12.345.67890/26",
      destinatario_cpf_ok: true,
      status: "registrado",
    });

    await page.goto("/despesas");
    const seletor = page.getByRole("group", { name: "Ano em exibição" });
    await expect(seletor).toBeVisible();

    // ── (a) nasce no ano corrente; "Todos os anos" NUNCA é o default ─────
    await expect(
      seletor.getByRole("button", { name: String(ANO) }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      seletor.getByRole("button", { name: "Todos os anos" }),
    ).toHaveAttribute("aria-pressed", "false");
    // O ano anterior é oferecido porque a obra tem pagamento nele (`anosDaObra`).
    await expect(
      seletor.getByRole("button", { name: String(ANO - 1) }),
    ).toBeVisible();

    // No ano corrente: o PIX de fevereiro + a nota órfã. O pagamento do ano
    // passado não está aqui.
    const linhaDe = (favorecido: string) =>
      page.locator(LINHAS).filter({ hasText: favorecido });
    await expect(page.locator(LINHAS)).toHaveCount(2);
    await expect(linhaDe("João Pedreiro")).toHaveCount(1);
    await expect(linhaDe("AJE Construções")).toHaveCount(1);
    await expect(page.locator('[data-contagem="despesas"]')).toHaveText(
      `2 lançamentos em ${ANO}`,
    );

    // ── (b) trocar o ano recorta a tabela, sem recarregar a página ───────
    await seletor.getByRole("button", { name: String(ANO - 1) }).click();
    await expect(page.locator('[data-contagem="despesas"]')).toHaveText(
      `2 lançamentos em ${ANO - 1}`,
    );
    await expect(linhaDe("Casa do Construtor")).toHaveCount(1);
    await expect(linhaDe("João Pedreiro")).toHaveCount(0);
    // ⚠️ A nota órfã continua aqui: ela é pendência de CAPTURA, e não pertence a
    // ano nenhum (parecer de 2026-09-26, parte b).
    await expect(linhaDe("AJE Construções")).toHaveCount(1);

    // O "M" do "N de M" é do ANO, nunca o total da obra — senão a contagem
    // compara janelas diferentes, que é o erro de leitura que originou o ticket.
    await page.getByLabel("Situação").selectOption("comprovadas");
    await expect(page.locator('[data-contagem="despesas"]')).toHaveText(
      `1 de 2 lançamentos em ${ANO - 1}`,
    );
    await page.getByLabel("Situação").selectOption("todas");

    // ── (c) "Todos os anos": explícito, rotulado, e some com o corte ─────
    await seletor.getByRole("button", { name: "Todos os anos" }).click();
    await expect(page.locator(LINHAS)).toHaveCount(3);
    await expect(page.locator('[data-contagem="despesas"]')).toHaveText(
      "3 lançamentos em todos os anos",
    );

    // ── (d) voltar ao ano corrente devolve o recorte de (a) ──────────────
    await seletor.getByRole("button", { name: String(ANO) }).click();
    await expect(
      seletor.getByRole("button", { name: String(ANO) }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(LINHAS)).toHaveCount(2);
    await expect(linhaDe("Casa do Construtor")).toHaveCount(0);
  });

  /**
   * **CONTAI-060, item 3 do spec** — ano sem lançamento nenhum é um estado
   * PRÓPRIO: ele nomeia o ano, diz quantos lançamentos existem nos outros anos e
   * **não** oferece "Mostrar todos", que só zera Situação/Tipo/Busca e não traria
   * de volta lançamento de outro ano. Sem isso, o vazio se lê como obra vazia.
   */
  test("ano sem lançamento: banner que nomeia o ano e manda trocá-lo", async ({
    page,
    db,
  }) => {
    // Um pagamento, dois anos atrás, com a nota ligada — assim não existe linha
    // sem data de pagamento, e o ano do meio fica realmente vazio.
    const casa = await criarFavorecido(db, {
      nome: "Casa do Construtor",
      documento: CNPJ_CASA,
      tipo: "pj",
    });
    const d = await criarDocumento(db, {
      favorecido_id: casa,
      tipo: "nf_material",
      classificacao: "material",
      valor: 5000,
      numero: "7002",
      data_emissao: `${ANO - 2}-05-18`,
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    const p = await criarPagamento(db, {
      favorecido_id: casa,
      valor: 5000,
      data_pagamento: `${ANO - 2}-05-20`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix.png`,
    });
    await criarVinculo(db, p, d);

    await page.goto("/despesas");
    const seletor = page.getByRole("group", { name: "Ano em exibição" });
    // O ano corrente não tem lançamento nenhum — e é o estado inicial.
    const aviso = page.getByRole("status");
    await expect(aviso).toContainText(`Nenhum lançamento em ${ANO}.`);
    await expect(aviso).toContainText("1 lançamento em outro(s) ano(s)");
    await expect(aviso).toContainText("troque o ano no topo da tela");
    await expect(page.locator(TABELA)).toHaveCount(0);
    // Este banner NÃO tem escape de filtro: filtro não é o que está escondendo.
    await expect(page.getByRole("button", { name: "Mostrar todos" })).toHaveCount(
      0,
    );

    // O ano do MEIO é oferecido mesmo sem pagamento nenhum (intervalo contínuo),
    // e continua vazio; o ano do pagamento mostra a linha.
    await seletor.getByRole("button", { name: String(ANO - 1) }).click();
    await expect(page.getByRole("status")).toContainText(
      `Nenhum lançamento em ${ANO - 1}.`,
    );
    await seletor.getByRole("button", { name: String(ANO - 2) }).click();
    await expect(page.locator(LINHAS)).toHaveCount(1);
    await expect(page.locator('[data-contagem="despesas"]')).toHaveText(
      `1 lançamento em ${ANO - 2}`,
    );
  });

  test("obra sem lançamento nenhum: a tela diz isso, sem tabela vazia", async ({
    page,
  }) => {
    await page.goto("/despesas");
    await expect(
      page.getByText("Nenhum lançamento em Casa Cachoeira ainda"),
    ).toBeVisible();
    await expect(page.locator(TABELA)).toHaveCount(0);
    await expect(page.locator('[data-filtros="despesas"]')).toHaveCount(0);
  });
});
