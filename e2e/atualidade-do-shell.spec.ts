import { URL_SUPABASE_LOCAL } from "./ambiente";
import {
  criarCompromisso,
  criarDocumento,
  criarFavorecido,
  criarLinhaDeRetencao,
  criarPagamento,
  criarVinculo,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";
import { escolher } from "./formularios";

/**
 * **CONTAI-058 — o shell de gestão revalida ao NAVEGAR, não no F5.**
 *
 * Dor de origem (`docs/backlog/72-2026-09-26-legibilidade-despesas-e-cache-documento.md`,
 * US-B), palavras do Mateus: *"alterei a configuração do imposto de 'a empresa
 * paga' para 'eu pago' [...] na despesa em si o valor atualizou imediatamente
 * [...] mas no geral continuou contando, até que eu fiz o refresh da página"*.
 *
 * ⚠️ **Nenhum `page.goto` e nenhum `reload` nos caminhos que provam o bug.**
 * `goto` monta o documento de novo, o layout de `(gestao)` remonta e o provedor
 * carrega na montagem — ou seja, `goto` é o F5 que o Mateus não quer precisar
 * dar, e um teste escrito com ele passaria com o bug inteiro de pé. Aqui a volta
 * para a Visão geral é sempre um **clique no link da faixa**, e o fim de cada
 * teste confere que a marca plantada em `window` sobreviveu — se tivesse
 * havido recarga, o documento seria outro e a marca teria morrido.
 *
 * ⚠️ **O critério 1 é sobre o GRUPO**, não sobre `documento/[id]/*`: por isso o
 * segundo teste grava por `compromisso/[id]/confirmar`, que não compartilha
 * pasta, componente nem função de escrita com o primeiro.
 */

const CNO_DA_OBRA = "12.345.67890/26";

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

interface Marcada {
  __semRecarga?: true;
}

/**
 * Planta no documento atual uma marca que **não sobrevive a uma recarga**: é
 * assim que o teste distingue navegação por link (o que o ticket exige) de
 * `goto`/F5 (o que o bug obrigava).
 */
async function marcarDocumento(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    (window as Window & Marcada).__semRecarga = true;
  });
}

async function conferirQueNaoRecarregou(page: import("@playwright/test").Page) {
  const intacta = await page.evaluate(
    () => (window as Window & Marcada).__semRecarga === true,
  );
  expect(intacta, "a volta tem que ser por link do app, nunca por recarga").toBe(
    true,
  );
}

/** O link de uma view de primeira classe, na faixa (a sidebar é `hidden` aqui). */
function naFaixa(page: import("@playwright/test").Page, rotulo: string) {
  return page
    .locator('[data-shell="faixa"]')
    .getByRole("link", { name: rotulo, exact: true });
}

/**
 * O caso real do relato: NF de serviço de R$ 18.000, R$ 540 de retenção
 * combinada recolhida **pela empresa**, e o líquido de R$ 17.460 transferido.
 * Custo comprovado do ano = o BRUTO (CONTAI-056).
 */
async function notaDoFranciscoQuitada(db: Db): Promise<string> {
  const favorecidoId = await criarFavorecido(db, {
    tipo: "pj",
    nome: "Francisco Empreitadas",
    documento: "11222333000181",
  });
  const documentoId = await criarDocumento(db, {
    favorecido_id: favorecidoId,
    tipo: "nf_servico",
    valor: 18000,
    numero: "1042",
    data_emissao: hoje(),
    classificacao: "mao_obra",
    destinatario_cpf_ok: true,
    nota_traz_cno: true,
    cno_referenciado: CNO_DA_OBRA,
    retencao_na_nota: "destacada",
    status: "registrado",
  });
  await criarLinhaDeRetencao(db, {
    documento_id: documentoId,
    rotulo_literal: "Total das Retenções (ISSQN / Federais)",
    valor: 540,
    composicao: "combinado_nao_aberto",
    e_desconto_efetivo: true,
    quem_recolhe: "empresa",
  });
  const liquido = await criarPagamento(db, {
    favorecido_id: favorecidoId,
    valor: 17460,
    data_pagamento: hoje(),
    meio: "pix",
    comprovante_path: "u/pix.png",
  });
  await criarVinculo(db, liquido, documentoId);
  return documentoId;
}

// ══ 1 · O caso do relato (critérios 1, 2 e 4) ════════════════════════════

test.describe("documento/[id]: quem recolhe (o caso do relato)", () => {
  test("empresa → eu, volta por link, e o KPI da Visão geral já mudou", async ({
    page,
    db,
  }) => {
    await notaDoFranciscoQuitada(db);

    await page.goto("/");
    const kpi = page.locator('[data-kpi="custo-confirmado"]');
    // O ponto de partida: a retenção recolhida pela empresa conta como custo, e
    // o KPI do ano mostra o BRUTO da nota.
    await expect(kpi).toContainText("R$ 18.000,00");
    await marcarDocumento(page);

    // Pelo caminho dele: Visão geral → Despesas → a nota.
    await naFaixa(page, "Despesas").click();
    await page.getByRole("link", { name: /nº 1042/ }).first().click();
    await page.waitForURL(/\/documento\/[0-9a-f-]+$/);

    await escolher(page, "Quem recolhe isto?", "Eu");
    await page.getByRole("button", { name: "Salvar resposta" }).click();
    // A tela da nota já mostra o efeito — é a metade que sempre funcionou.
    const cardDaNota = page
      .getByText("Custo comprovado", { exact: true })
      .locator("..");
    await expect(cardDaNota).toContainText("R$ 17.460,00");

    /**
     * ⚠️ **Critério 4 — stale-while-revalidate, verificado sem corrida.** Com as
     * respostas do PostgREST atrasadas, a revalidação disparada pela navegação
     * fica em voo por ~1,2s: é nessa janela que o teste exige o número ANTERIOR
     * na tela e a **ausência** do estado de carregamento. Sem o atraso, a
     * asserção venceria por ser rápida, não por o shell estar correto.
     */
    await page.route(`${URL_SUPABASE_LOCAL}/rest/v1/**`, async (rota) => {
      await new Promise((r) => setTimeout(r, 1_200));
      await rota.continue();
    });

    await naFaixa(page, "Visão geral").click();
    await expect(kpi).toContainText("R$ 18.000,00");
    await expect(
      page.getByText("Carregando a obra"),
      "revalidação por navegação nunca apaga o shell",
    ).toHaveCount(0);

    await page.unroute(`${URL_SUPABASE_LOCAL}/rest/v1/**`);

    // ⚠️ **A asserção do ticket**: sem F5, o KPI passa a contar R$ 17.460,00 —
    // os R$ 540 voltaram a ser guia que ele ainda tem no bolso.
    await expect(kpi).toContainText("R$ 17.460,00", { timeout: 20_000 });
    await expect(kpi).not.toContainText("R$ 18.000,00");
    await conferirQueNaoRecarregou(page);
  });

  /**
   * **Critério 5** — falha na revalidação por navegação é ERRO com
   * `tentarDeNovo`, nunca o número velho mantido em silêncio: manter seria o
   * mesmo bug com outro nome.
   */
  test("revalidação que falha vira erro com 'Tentar de novo', sem número velho", async ({
    page,
    db,
  }) => {
    await notaDoFranciscoQuitada(db);

    await page.goto("/");
    const kpi = page.locator('[data-kpi="custo-confirmado"]');
    await expect(kpi).toContainText("R$ 18.000,00");
    await marcarDocumento(page);

    await naFaixa(page, "Despesas").click();
    await expect(page.getByRole("link", { name: /nº 1042/ }).first()).toBeVisible();

    // O mesmo 503 que o PostgREST devolve quando não alcança o banco.
    const rota = `${URL_SUPABASE_LOCAL}/rest/v1/**`;
    await page.route(rota, (r) =>
      r.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "PGRST000",
          message: "could not connect to server",
        }),
      }),
    );

    await naFaixa(page, "Visão geral").click();
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await expect(kpi, "número velho em silêncio é o mesmo bug").toHaveCount(0);

    // E o caminho de volta continua sendo o único que MOSTRA carregamento.
    await page.unroute(rota);
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(kpi).toContainText("R$ 18.000,00", { timeout: 20_000 });
    await conferirQueNaoRecarregou(page);
  });
});

// ══ 2 · O guard-rail de performance (critério 7) ═════════════════════════

/**
 * **Pre-mortem 2 do ticket — "refetch excessivo deixando a navegação lenta".**
 *
 * O critério 7 não é uma impressão, é uma contagem: **UMA** recarga do shell por
 * navegação, nenhum polling, nenhum gatilho de foco de janela. O contador olha
 * `GET /rest/v1/obra?select=*&order=created_at.asc` — a primeira chamada de
 * `carregarObras`, que só o provedor faz e faz uma vez por carga (`carregarObra`
 * de uma tela de detalhe filtra por `id=eq.`, então não entra nesta conta).
 */
test("uma recarga por navegação, sem polling e sem gatilho de foco (critério 7)", async ({
  page,
  db,
}) => {
  await notaDoFranciscoQuitada(db);

  let recargas = 0;
  page.on("request", (r) => {
    const url = r.url();
    if (
      url.includes("/rest/v1/obra?") &&
      url.includes("order=created_at") &&
      !url.includes("id=eq.")
    ) {
      recargas += 1;
    }
  });

  await page.goto("/pendencias");
  await expect(page.getByRole("heading", { name: "Pendências" })).toBeVisible();
  await marcarDocumento(page);

  recargas = 0;
  await naFaixa(page, "Visão geral").click();
  await expect(page.locator('[data-kpi="custo-confirmado"]')).toContainText(
    "R$ 18.000,00",
  );
  /**
   * ⚠️ **`expect.poll`, e não `expect` seco** (achado do `cto-obra` no Gate 2).
   * O KPI aparece do contexto **stale** já no primeiro paint — é justamente o
   * critério 4 —, então o `toContainText` acima pode resolver ANTES de o `GET
   * obra` sair: a chamada só parte depois do efeito e do `getSession()`, que é
   * assíncrono (`navigator.locks`). Num runner lento essa janela cresce e a
   * asserção leria `0` por acidente, verde pelo motivo errado. Quem prova que
   * nunca passou de 1 são as duas asserções secas abaixo.
   */
  await expect
    .poll(() => recargas, { message: "uma navegação, uma recarga do shell" })
    .toBe(1);

  // ⚠️ **Nenhum polling**: parado na tela, o shell não busca mais nada.
  await page.waitForTimeout(3_000);
  expect(recargas, "sem polling").toBe(1);

  // ⚠️ **Nenhum gatilho de foco de janela** — o padrão de biblioteca de
  // data-fetching que o ticket manteve fora de escopo.
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(1_000);
  expect(recargas, "sem gatilho de foco de janela").toBe(1);
  await conferirQueNaoRecarregou(page);
});

// ══ 3 · Fora de documento/[id]/* (critérios 1 e 3) ═══════════════════════

/**
 * **A prova de que a correção é do GRUPO `(gestao)`, não de uma pasta.**
 *
 * `compromisso/[id]/confirmar` não compartilha componente nem função de escrita
 * com o repeater de retenção: ela cria um PAGAMENTO. Nenhuma das duas rotas
 * ganhou uma linha de código neste ticket — quem revalida é o provedor.
 */
test("compromisso/[id]/confirmar: o pagamento novo já aparece no KPI de risco", async ({
  page,
  db,
}) => {
  const favorecidoId = await criarFavorecido(db, {
    tipo: "pj",
    nome: "WK Construções LTDA",
    documento: "11222333000181",
  });
  await criarCompromisso(db, {
    favorecido_id: favorecidoId,
    valor_previsto: 10000,
    data_prevista: maisDias(-3),
    origem: "boleto",
  });

  await page.goto("/");
  const risco = page.locator('[data-kpi="custo-em-risco"]');
  // Nada saiu da conta ainda: agendado não é dispêndio.
  await expect(risco).toHaveAttribute("data-custo-em-risco", "0");
  await marcarDocumento(page);

  // Pelo toque da home, como no canteiro: "Foi pago" → confirmar.
  await page
    .locator("[data-agendado='vencido']")
    .getByRole("link", { name: "Foi pago" })
    .click();
  await page.getByLabel("Data em que o dinheiro saiu").fill(hoje());
  await page.getByLabel("Valor efetivamente pago").fill("10.000,00");
  await page.getByRole("button", { name: "Salvar pagamento" }).click();
  await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);

  await naFaixa(page, "Visão geral").click();

  // ⚠️ Sem F5: os R$ 10.000 que saíram sem nota já estão no headline de risco.
  await expect(risco).toHaveAttribute("data-custo-em-risco", "1000000", {
    timeout: 20_000,
  });
  await expect(risco).toContainText("R$ 10.000,00");
  await conferirQueNaoRecarregou(page);
});
