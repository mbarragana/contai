import { OBRA_ID_SEED, USER_ID_SEED } from "./ambiente";
import {
  criarAnexoDeDesembolso,
  criarDesembolsoTerreno,
  criarDocumento,
  criarFavorecido,
  criarFinanciamento,
  criarPagamento,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * **CONTAI-042 — `/pendencias` passa a listar as DEZOITO famílias.**
 *
 * O que esta suíte prova é a promessa do ticket, e só ela: uma pendência que
 * antes só existia agregada dentro da home **aparece aqui**. As condições de
 * abertura de cada família já têm teste unitário em `lib/fiscal/*.test.ts`; o
 * que nenhum teste unitário pega é a família chegar à tela.
 *
 * Contra o Supabase LOCAL, como o resto da suíte: sessão de verdade, linhas de
 * verdade com RLS.
 */

/** O ano corrente real — o mesmo com que o shell nasce (`CONTAI-060`). */
const ANO = new Date().getFullYear();

let proximoEmitente = 0;

/** Um emitente NOVO por chamada — `favorecido_dono_documento_unico` (0003). */
async function emitente(db: Parameters<typeof criarFavorecido>[0]) {
  proximoEmitente += 1;
  return criarFavorecido(db, {
    tipo: "pj",
    nome: `Construtora Fila ${proximoEmitente}`,
    documento: `1122233300018${proximoEmitente}`,
  });
}

/** Documento fora do CPF do dono → **quarentena**, vermelha. */
async function emQuarentena(db: Parameters<typeof criarDocumento>[0]) {
  return criarDocumento(db, {
    obra_id: OBRA_ID_SEED,
    favorecido_id: await emitente(db),
    tipo: "nf_material",
    valor: 9400,
    numero: "5001",
    data_emissao: "2026-03-10",
    classificacao: "material",
    destinatario_cpf_ok: false,
    status: "quarentena",
    motivo_quarentena:
      "Documento não está no CPF do dono da obra — não entra no custo de aquisição.",
  });
}

/**
 * NF de serviço que **não traz o CNO impresso**, com a obra do seed tendo CNO
 * → `nf_servico_sem_cno`, **âmbar**: o custo de aquisição está intacto, o que
 * está aberto é a aferição.
 */
async function semCnoImpresso(db: Parameters<typeof criarDocumento>[0]) {
  return criarDocumento(db, {
    obra_id: OBRA_ID_SEED,
    favorecido_id: await emitente(db),
    tipo: "nf_servico",
    valor: 7300,
    numero: "5002",
    data_emissao: "2026-03-12",
    classificacao: "mao_obra",
    destinatario_cpf_ok: true,
    retencao_na_nota: "nenhuma",
    nota_traz_cno: false,
    status: "registrado",
  });
}

test.describe("a fila unificada", () => {
  /**
   * ⚠️ **O teste que o ticket existe para ter.** Antes do CONTAI-042 esta tela
   * só mostrava as duas persistentes, e a quarentena só existia na home — a
   * classe de defeito D46/D47, pendência com uma superfície só.
   */
  test("uma pendência derivada, que antes só existia na home, aparece aqui", async ({
    page,
    db,
  }) => {
    await emQuarentena(db);

    await page.goto("/pendencias");
    await expect(page.getByRole("heading", { name: "Pendências" })).toBeVisible();
    await expect(page.getByText("Quarentena", { exact: false }).first()).toBeVisible();
    // O texto de consequência é o mesmo de sempre — copiado, não reescrito.
    await expect(
      page.getByText("Não entra no custo de aquisição", { exact: false }).first(),
    ).toBeVisible();
  });

  /**
   * Vermelho antes de âmbar, nunca misturados sem hierarquia (critério 2).
   */
  test("o grupo vermelho vem antes do âmbar", async ({ page, db }) => {
    await emQuarentena(db);
    await semCnoImpresso(db);

    await page.goto("/pendencias");
    const primeiro = page.getByText("Resolver primeiro");
    const depois = page.getByText("Resolver antes de declarar");
    await expect(primeiro).toBeVisible();
    await expect(depois).toBeVisible();

    const caixaVermelho = (await primeiro.boundingBox())!;
    const caixaAmbar = (await depois.boundingBox())!;
    expect(caixaVermelho.y).toBeLessThan(caixaAmbar.y);
  });

  /**
   * Gate Fiscal §3.4: a página mistura dois escopos — persistentes de TODAS as
   * obras, derivadas da obra aberta — e eles são **ditos**, não inferidos.
   */
  test("os dois escopos são declarados em tela", async ({ page, db }) => {
    await emQuarentena(db);

    await page.goto("/pendencias");
    await expect(
      page.getByText("de todas as suas obras", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Casa Cachoeira" }),
    ).toBeVisible();
  });

  /**
   * ⚠️ **A 18ª família, e a prova de que ela existia escondida.** A obra do
   * seed não tem desembolso datado nenhum, e por isso `terrenoSemRegistro`
   * está aberta — até o CONTAI-042 ela só existia como uma `Consequencia`
   * âmbar DENTRO do card de custo confirmado da home, sem linha própria em
   * lugar nenhum. O `cto-obra` não a tinha nomeado no achado; foi ela que
   * fechou a lista em dezoito.
   */
  test("a 18ª família ganha linha própria", async ({ page }) => {
    await page.goto("/pendencias");
    await expect(
      page.getByText("Terreno sem registro", { exact: false }),
    ).toBeVisible();
    // Texto literal de `TERRENO_ZERO_NAO_E_NADA_PAGO` — copiado, não reescrito.
    await expect(
      page.getByText("não que nada foi pago", { exact: false }),
    ).toBeVisible();
  });

  /**
   * ⚠️ Gate Fiscal §7.2: com a fila vazia, a página **não** pode afirmar
   * "Nenhuma pendência" — afirmar ausência além do que se apurou é reencenar a
   * **D59** na tela que existe para matá-la, e desta vez na superfície que se
   * lê antes de declarar.
   */
  test("o estado vazio diz o que foi apurado, e não que está tudo certo", async ({
    page,
    db,
  }) => {
    // O terreno DATADO e com comprovante é o que fecha a última família aberta
    // na obra do seed — sem ele não existe estado vazio para conferir.
    const desembolso = await criarDesembolsoTerreno(db, {
      tipo: "pagamento_terreno",
      valor: 800000,
      data_pagamento: "2025-06-10",
      estado: "pago",
      debitos_mesmo_dia: true,
    });
    await criarAnexoDeDesembolso(db, {
      desembolso_id: desembolso,
      arquivo_path: "11111111-1111-4111-8111-111111111111/terreno/comprovante.pdf",
      papel: "comprovante",
    });

    await page.goto("/pendencias");
    await expect(
      page.getByText("Nada aberto no que este app apura", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("não é um atestado de declaração pronta", { exact: false }),
    ).toBeVisible();
    // Nenhuma promessa de que dá para declarar.
    await expect(page.getByText("tudo pronto", { exact: false })).toHaveCount(0);
  });

  /**
   * **CONTAI-060, critério 2 — o ano é UM, e trocá-lo num lugar chega às três
   * telas.** Fecha a dívida de `docs/backlog/48-2026-09-21-gate1-decisoes-contai-040.md`.
   *
   * ⚠️ **Este teste foi REESCRITO no Gate 2, e a versão anterior consagrava um
   * defeito**: ela mexia o badge selecionando um ano ANTERIOR à compra do
   * terreno e esperava ver "Terreno sem registro" — ou seja, tomava como
   * esperado um alarme falso que só existia porque a condição daquela família
   * estava amarrada ao ano em tela. Com a correção, a pergunta "o terreno está
   * registrado?" é da obra inteira, e a família não se mexe com o seletor.
   *
   * O que este teste prova agora, e as três coisas são invariantes de verdade:
   * - **a fila segue o ano onde ela DEVE seguir**: `aguardando_informe` é do ano
   *   corrente e só dele;
   * - **a fila NÃO se mexe onde não deve**: `falta_lancar` de um ano fechado
   *   continua na fila, com a mesma cor, em qualquer ano selecionado — é a trava
   *   do Gate 2 contra "filtro de leitura rebaixando pendência vermelha";
   * - **o badge é invariante ao recorte de leitura**: contagem de pendência é
   *   estado da obra hoje, não função da janela que está sendo lida. Um badge
   *   que mudasse com o seletor seria o mesmo erro fiscal com outro rosto.
   *
   * A navegação é sempre por LINK: `goto` remontaria o provedor e reporia o ano
   * corrente, e o teste passaria sem provar a sincronização.
   */
  test("o ano do shell chega a Pendências — e pendência real não muda de cor com ele", async ({
    page,
    db,
  }) => {
    // Contrato de financiamento em ANO−2 e NENHUM informe lançado: ANO−2 e ANO−1
    // estão fechados sem informe (`falta_lancar`, âmbar, contam no badge) e o ano
    // corrente está `aguardando_informe` (aviso, fora do badge).
    await criarFinanciamento(db, {
      instituicao: "Banco do Brasil",
      data_contrato: `${ANO - 2}-03-20`,
      preco_contratado: 650000,
      numero_parcelas: 240,
    });
    // Um pagamento em ANO−2 é o que faz o seletor oferecer aquele ano
    // (`anosDaObra` = intervalo das datas de pagamento ∪ ano corrente).
    await criarPagamento(db, {
      favorecido_id: await emitente(db),
      valor: 1500,
      data_pagamento: `${ANO - 2}-09-10`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix.png`,
    });

    await page.goto("/pendencias");
    const faltaLancarAnterior = page.locator(
      `[data-falta-lancar="${ANO - 1}"]`,
    );
    await expect(faltaLancarAnterior).toBeVisible();
    await expect(page.getByText(`Aguardando informe de ${ANO}`, { exact: true })).toBeVisible();
    await expect(
      page.getByText(`apuradas em ${ANO}`, { exact: false }),
    ).toBeVisible();

    // ── trocar o ano em DESPESAS, e o badge não se mexer ──────────────────
    const badge = page.locator('[data-shell="faixa"] [data-badge="pendencias"]');
    const antes = await badge.innerText();
    await page
      .locator('[data-shell="faixa"]')
      .getByRole("link", { name: "Despesas", exact: true })
      .click();
    const seletor = page.getByRole("group", { name: "Ano em exibição" });
    await seletor.getByRole("button", { name: String(ANO - 2) }).click();
    // O estado CHEGOU (a tabela é do ano escolhido) e a contagem de pendências
    // continua a mesma — as duas coisas ao mesmo tempo são o ponto.
    await expect(page.locator('[data-contagem="despesas"]')).toHaveText(
      `1 lançamento em ${ANO - 2}`,
    );
    await expect(badge).toHaveText(antes);

    // ── e a fila já chega no ano escolhido, sem perder a pendência real ───
    await page
      .locator('[data-shell="faixa"]')
      // ⚠️ O badge entra no nome acessível do link ("Pendências 4"): `exact`
      // não serve aqui.
      .getByRole("link", { name: /^Pendências/ })
      .click();
    await expect(
      page.getByText(`apuradas em ${ANO - 2}`, { exact: false }),
    ).toBeVisible();
    // ⚠️ **A trava do Gate 2**: o informe faltante de um ano FECHADO não sai da
    // fila nem vira aviso porque a tela está apontada para outro ano.
    await expect(faltaLancarAnterior).toBeVisible();
    await expect(faltaLancarAnterior).toContainText("Falta lançar o informe");
    // O aviso do ano corrente, esse SIM, é só do ano corrente: ele fala do
    // calendário do banco HOJE, e não de um ano já fechado.
    await expect(page.getByText(`Aguardando informe de ${ANO}`, { exact: true })).toHaveCount(
      0,
    );
    // E o ano fechado nunca é descrito como "ainda não afeta declaração".
    await expect(
      page.getByText("não afeta declaração nenhuma", { exact: false }),
    ).toHaveCount(0);

    // ── "todos os anos": dito por extenso, e ancorado em hoje ─────────────
    await page
      .locator('[data-shell="faixa"]')
      .getByRole("link", { name: "Visão geral", exact: true })
      .click();
    await page
      .getByRole("group", { name: "Ano em exibição" })
      .getByRole("button", { name: "Todos os anos" })
      .click();
    // O KPI passa a rotular o ACUMULADO, sem inventar soma nova (critério 3).
    await expect(page.locator('[data-kpi="custo-confirmado"]')).toContainText(
      "Custo confirmado, acumulado em todos os anos",
    );
    await page
      .locator('[data-shell="faixa"]')
      .getByRole("link", { name: /^Pendências/ })
      .click();
    await expect(
      page.getByText("apuradas em todos os anos", { exact: false }),
    ).toBeVisible();
    // Sob "todos os anos" o cálculo se ancora em HOJE, então o aviso do ano
    // corrente volta — e o informe fechado continua cobrado.
    await expect(page.getByText(`Aguardando informe de ${ANO}`, { exact: true })).toBeVisible();
    await expect(faltaLancarAnterior).toBeVisible();
  });
});
