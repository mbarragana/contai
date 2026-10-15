import { URL_SUPABASE_LOCAL, USER_ID_SEED } from "./ambiente";
import {
  arquivosNoAcervo,
  compromissos,
  criarCompraCartao,
  criarFavorecido,
  faturaDesembolsos,
  pagamentos,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * CONTAI-097 — COMPROVANTE OPCIONAL EM "FATURA PAGA · PARCIAL" (D56-b, ponta A).
 *
 * O que estes testes provam não é que o campo apareceu: é que **UM arquivo
 * subiu UMA vez e chegou a N `pagamento`s**. A dor de origem foi uma fatura de
 * cartão em 3 desembolsos parciais que gerou 7 `pagamento`s a favorecidos
 * diferentes, e o mesmo PIX anexado 4 vezes à mão, um por `pagamento`.
 *
 * A propagação em si é capacidade das RPCs `fatura_desembolso_gravar` e
 * `fatura_alocar` (migration 0024) — já em produção pelo caminho "fatura paga
 * integral". Este ticket só a destrava pela UI do rotativo, e por isso a prova
 * é E2E (critérios 9 e 10): nenhuma função pura nova existe para testar.
 *
 * Nada é stubado: Postgres local, RLS ligada, Storage real. A única
 * falsificação de rede é o 503 do Storage no teste de erro — derrubar o
 * container no meio da suíte não provaria mais nada.
 */

let proximoCnpj = 0;

/** Cada chamada usa um CNPJ próprio — `favorecido` é único por (dono, documento). */
async function favorecidoLoja(db: Db, nome: string) {
  proximoCnpj += 1;
  return criarFavorecido(db, {
    tipo: "pj",
    nome,
    documento: `9988877700${String(proximoCnpj).padStart(4, "0")}`,
  });
}

/** Um arquivo qualquer — o app guarda o documento, nunca audita o conteúdo. */
function arquivo(nome: string) {
  return {
    name: nome,
    mimeType: "application/pdf",
    buffer: Buffer.from(`pdf-falso-${nome}`),
  };
}

const ROTULO = "Comprovante deste pagamento (opcional)";
const AJUDA =
  "PDF, foto ou print — se você tiver à mão agora. Pode anexar depois, no detalhe do pagamento.";

/**
 * Duas compras no MESMO vencimento — é a condição da dor: um desembolso, N
 * favorecidos. 1.200 + 480 cabem nos 1.700 pagos, então as duas podem ser
 * alocadas no mesmo ato e os DOIS `pagamento`s nascem do mesmo desembolso.
 */
async function faturaComDuasCompras(db: Db) {
  const loja1 = await favorecidoLoja(db, "Ilhamix Concreto");
  const loja2 = await favorecidoLoja(db, "Casas Da Água Mat.");
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
  return c1.faturaId;
}

test.describe("comprovante opcional no parcial — um upload, N pagamentos", () => {
  test("COM anexo: os 2 pagamentos gerados compartilham o MESMO comprovante_path, e o Storage ganhou UM objeto só", async ({
    page,
    db,
  }) => {
    const faturaId = await faturaComDuasCompras(db);
    // ⚠️ Linha de base, não contagem absoluta: o bucket `acervo` é append-only
    // (a 0002 não tem policy de delete) e não é zerado entre testes — quem zera
    // é o `db reset` do globalSetup. Contar objetos no total faria este teste
    // depender da ordem da suíte.
    const antes = await arquivosNoAcervo(db, "comprovante");

    await page.goto(`/fatura/${faturaId}/parcial`);
    await expect(
      page.getByRole("heading", { name: "Fatura paga · parcial" }),
    ).toBeVisible();

    // ── Critério 1: o campo e a ajuda, literais do spec ───────────────────
    await expect(page.getByLabel(ROTULO)).toBeVisible();
    await expect(page.getByText(AJUDA)).toBeVisible();

    // ── Critério 2: o anexo NUNCA entra no `podeSalvar` ───────────────────
    // Só o arquivo, sem data nem valor: o botão continua travado — e o rótulo
    // continua pedindo os dois campos que de fato habilitam a gravação.
    await page.getByLabel(ROTULO).setInputFiles(arquivo("pix-da-fatura.pdf"));
    await expect(
      page.getByRole("button", { name: "Informe a data e o valor pago" }),
    ).toBeDisabled();

    await page.getByLabel("Data em que você pagou").fill("2026-10-08");
    await page.getByLabel("Valor pago").fill("1.700,00");
    await expect(page.getByRole("button", { name: /^Salvar pagamento/ })).toBeEnabled();
    await page.getByRole("button", { name: /^Salvar pagamento/ }).click();

    // ── Critério 8: navegação de sucesso inalterada ───────────────────────
    await expect(
      page.getByRole("heading", { name: "Alocar o pagamento" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/fatura\/[0-9a-f-]+\/alocar\?desembolso=[0-9a-f-]+$/);

    // O comprovante foi para o DESEMBOLSO, em pasta própria do acervo — e
    // nenhum `pagamento` existe ainda (o rotativo não quita sozinho).
    const ds = await faturaDesembolsos(db);
    expect(ds).toHaveLength(1);
    expect(ds[0].comprovante_path).toMatch(
      new RegExp(`^${USER_ID_SEED}/comprovante/`),
    );
    expect(await pagamentos(db)).toHaveLength(0);

    // ── Critério 4: a alocação propaga o MESMO path para os dois ──────────
    await page.getByText("Ilhamix Concreto").click();
    await page.getByText("Casas Da Água Mat.").click();
    await expect(
      page.getByText("Selecionado: R$ 1.680,00 de R$ 1.700,00 pagos"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirmar alocação" }).click();
    await expect(
      page.getByRole("heading", { name: "Alocação confirmada" }),
    ).toBeVisible();

    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(2);
    // Um path distinto para os dois pagamentos — é a definição de
    // "não subir o mesmo comprovante duas vezes".
    expect(new Set(pagos.map((p) => p.comprovante_path)).size).toBe(1);
    expect(pagos[0].comprovante_path).toBe(ds[0].comprovante_path);
    for (const p of pagos) {
      expect(p.data_pagamento).toBe("2026-10-08");
      expect(p.meio).toBe("cartao");
      expect(p.status).toBe("aguardando_nf");
    }

    // ⚠️ E UM objeto só no Storage: a propagação é por `comprovante_path`
    // copiado (denormalização deliberada da 0024), nunca por cópia de arquivo
    // por `pagamento`.
    const depois = await arquivosNoAcervo(db, "comprovante");
    expect(depois).toHaveLength(antes.length + 1);
  });

  test("SEM anexo: comportamento de hoje byte a byte — comprovante_path null e nada novo no acervo", async ({
    page,
    db,
  }) => {
    const faturaId = await faturaComDuasCompras(db);
    const antes = await arquivosNoAcervo(db, "comprovante");

    await page.goto(`/fatura/${faturaId}/parcial`);
    await page.getByLabel("Data em que você pagou").fill("2026-10-08");
    await page.getByLabel("Valor pago").fill("500,00");
    await expect(page.getByText(/é rotativo, não integral/)).toBeVisible();
    await page.getByRole("button", { name: /^Salvar pagamento/ }).click();

    await expect(
      page.getByRole("heading", { name: "Alocar o pagamento" }),
    ).toBeVisible();

    const ds = await faturaDesembolsos(db);
    expect(ds).toHaveLength(1);
    expect(ds[0].comprovante_path).toBeNull();
    expect(Number(ds[0].valor)).toBe(500);

    // Aloca o que cabe nos 500 (Casas Da Água, 480) — o pagamento gerado nasce
    // SEM comprovante, elegível ao caminho retroativo de
    // `/pagamento/[id]/comprovante` (CONTAI-061), que é o estado de hoje.
    await page.getByText("Casas Da Água Mat.").click();
    await page.getByRole("button", { name: "Confirmar alocação" }).click();
    await expect(
      page.getByRole("heading", { name: "Alocação confirmada" }),
    ).toBeVisible();

    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(1);
    expect(pagos[0].comprovante_path).toBeNull();
    expect(Number(pagos[0].valor)).toBe(480);

    const cs = await compromissos(db);
    expect(cs.filter((c) => c.situacao === "quitado")).toHaveLength(1);
    expect(cs.filter((c) => c.situacao === "aberto")).toHaveLength(1);

    // Nenhum objeto subiu: não há arquivo, e a tela não inventa um.
    expect(await arquivosNoAcervo(db, "comprovante")).toHaveLength(antes.length);
  });

  /**
   * Critério 6 e pre-mortem 3 — a subida roda ANTES da RPC, então falha de
   * upload nunca deixa o desembolso gravado sem o anexo: ou os dois
   * aconteceram, ou nenhum. E o arquivo escolhido SOBREVIVE à falha — arquivo
   * que a tela esquece é arquivo que o Mateus procura de novo no aparelho.
   */
  test("falha ao subir: banner de erro, nada gravado, e o arquivo continua escolhido para a segunda tentativa", async ({
    page,
    db,
  }) => {
    const faturaId = await faturaComDuasCompras(db);

    const rota = `${URL_SUPABASE_LOCAL}/storage/v1/object/acervo/**`;
    await page.route(rota, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"statusCode":"503","error":"Service Unavailable","message":"Storage fora do ar"}',
      }),
    );

    await page.goto(`/fatura/${faturaId}/parcial`);
    await page.getByLabel("Data em que você pagou").fill("2026-10-08");
    await page.getByLabel("Valor pago").fill("1.700,00");
    await page.getByLabel(ROTULO).setInputFiles(arquivo("pix-da-fatura.pdf"));
    await page.getByRole("button", { name: /^Salvar pagamento/ }).click();

    // O mesmo banner vermelho que a tela já usa (`mensagemDeErroDeGravacao`).
    //
    // ⚠️ `getByText` dentro do `role="alert"`, e não `getByRole("alert")` sozinho:
    // o `__next-route-announcer__` do Next também é um `role="alert"` (vazio), e
    // o seletor por papel resolve para dois elementos em strict mode.
    await expect(
      page.locator('[role="alert"]').filter({ hasText: "Storage fora do ar" }),
    ).toBeVisible();
    // Continua NA tela, com a data e o valor onde estavam.
    await expect(
      page.getByRole("heading", { name: "Fatura paga · parcial" }),
    ).toBeVisible();
    await expect(page.getByLabel("Data em que você pagou")).toHaveValue("2026-10-08");
    await expect(page.getByLabel("Valor pago")).toHaveValue("1.700,00");
    // E o arquivo segue selecionado — a linha de sucesso do campo prova isso.
    await expect(page.getByText("pix-da-fatura.pdf")).toBeVisible();

    // Nada gravado: nem desembolso, nem pagamento, nem compromisso quitado.
    expect(await faturaDesembolsos(db)).toHaveLength(0);
    expect(await pagamentos(db)).toHaveLength(0);
    expect((await compromissos(db)).every((c) => c.situacao === "aberto")).toBe(true);

    // O Storage volta e o MESMO clique resolve, sem reescolher o arquivo.
    await page.unroute(rota);
    await page.getByRole("button", { name: /^Salvar pagamento/ }).click();
    await expect(
      page.getByRole("heading", { name: "Alocar o pagamento" }),
    ).toBeVisible();

    const ds = await faturaDesembolsos(db);
    expect(ds).toHaveLength(1);
    expect(ds[0].comprovante_path).toMatch(
      new RegExp(`^${USER_ID_SEED}/comprovante/`),
    );
  });
});
