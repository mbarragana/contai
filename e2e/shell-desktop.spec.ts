import { USER_ID_SEED } from "./ambiente";
import { criarDocumento, criarFavorecido, criarPagamento } from "./banco";
import { expect, test } from "./fixtures";

/**
 * **CONTAI-040 — o shell de gestão em 1280×800, cenário de GESTÃO**: em casa,
 * sentado, com calma (`CLAUDE.md`, correção de 2026-08-18).
 *
 * Substitui `home-desktop.spec.ts`, que travava o padrão `aside` + `Secao` +
 * `data-largo` do CONTAI-039 — rejeitado pelo Mateus ("ficou várias telas de
 * celular lado a lado") e apagado por este ticket.
 *
 * ⚠️ **Testes de LAYOUT e de NAVEGAÇÃO, não uma segunda cópia da suíte.** O que
 * cada pendência diz, o que cada número vale e o que grava no banco já é provado
 * no projeto `mobile`, no piso de 375px. O que só este projeto pode provar é o
 * que a largura permite: sidebar permanente, KPIs lado a lado, e o recorte do
 * dashboard apontando para a lista inteira.
 *
 * O que ele trava, em ordem:
 * (a) a sidebar existe, tem os quatro itens de primeira classe e **nenhum deles
 *     é link morto** — inclusive `Despesas`, que só ganha a tabela no 041;
 * (b) o badge de Pendências é a contagem de `pendencias-unificadas.ts`
 *     (`CONTAI-042`), a MESMA que a view Pendências lista — nunca uma segunda
 *     definição de "pendência aberta" (a classe da D54);
 * (c) os três KPIs aparecem lado a lado, com a decomposição do custo em risco
 *     **sempre visível** (R4 do CONTAI-005) e a trinca do INSS inteira (R2);
 * (d) o painel de pendências do dashboard é um SUBCONJUNTO da fila, com o
 *     mesmo texto, e o "Ver todas" leva à lista inteira — recorte sem saída é
 *     a D47;
 * (e) nada fica cortado e a tela não rola na horizontal;
 * (f) `/adicionar/*` continua FORA do shell — a separação é por rota.
 */

const ANO = new Date().getFullYear();

const CNPJ_AJE_DIGITOS = "11222333000181";
const CNPJ_CASA_DIGITOS = "11444777000161";

/** O cenário mínimo com pendência de naturezas diferentes e INSS em base. */
async function cenarioComPendencias(db: Parameters<typeof criarFavorecido>[0]) {
  const aje = await criarFavorecido(db, {
    nome: "AJE Construções",
    documento: CNPJ_AJE_DIGITOS,
    tipo: "pj",
  });
  const casa = await criarFavorecido(db, {
    nome: "Casa do Construtor",
    documento: CNPJ_CASA_DIGITOS,
    tipo: "pj",
  });

  await criarDocumento(db, {
    favorecido_id: casa,
    tipo: "nf_material",
    classificacao: "material",
    valor: 4850,
    destinatario_cpf_ok: false,
    status: "quarentena",
    motivo_quarentena: "Documento não está no CPF do dono da obra.",
  });
  await criarDocumento(db, {
    favorecido_id: aje,
    tipo: "boleto",
    valor: 25000,
    vencimento: `${ANO}-09-15`,
    destinatario_cpf_ok: true,
    status: "aguardando_pagamento",
  });
  // Nota de serviço SEM o CNO impresso: é ela que faz nascer a aferição do
  // INSS em base — sem este documento o terceiro KPI não existe.
  await criarDocumento(db, {
    favorecido_id: aje,
    tipo: "nf_servico",
    classificacao: "mao_obra",
    valor: 18000,
    retencao_na_nota: "nenhuma",
    nota_traz_cno: false,
    destinatario_cpf_ok: true,
    status: "registrado",
  });
  for (const dia of ["06-05", "07-05", "08-05"]) {
    await criarPagamento(db, {
      favorecido_id: aje,
      valor: 15000,
      data_pagamento: `${ANO}-${dia}`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-${dia}.png`,
    });
  }
}

test.describe("shell de gestão no desktop", () => {
  test("sidebar permanente, badge da fila unificada e os três KPIs lado a lado", async ({
    page,
    db,
  }) => {
    await cenarioComPendencias(db);

    await page.goto("/");
    await expect(page.getByText("Custo em risco no IR")).toBeVisible();

    // ── (a) a sidebar, com os quatro itens e nenhum link morto ───────────
    const sidebar = page.locator('[data-shell="sidebar"]');
    await expect(sidebar).toBeVisible();
    expect((await sidebar.boundingBox())!.width).toBe(264);
    // A faixa estreita NÃO aparece aqui: um shell, duas apresentações.
    await expect(page.locator('[data-shell="faixa"]')).toBeHidden();

    const nav = sidebar.getByRole("navigation", { name: "Navegação principal" });
    const itens = nav.getByRole("link");
    await expect(itens).toHaveCount(4);
    for (const [i, rotulo] of [
      "Visão geral",
      "Despesas",
      "Pendências",
      "Obras",
    ].entries()) {
      await expect(itens.nth(i)).toContainText(rotulo);
      // Link morto é item de menu que não abre nada. `href` vazio ou `#`
      // reprova — inclusive o de Despesas, que só ganha a TABELA no 041.
      const href = await itens.nth(i).getAttribute("href");
      expect(href, `${rotulo} sem destino`).toMatch(/^\/[a-z]*$/);
    }

    // O bloco "Obra aberta" afirma a obra, e o escape existe.
    const obraAberta = page.locator('[data-shell="obra-aberta"]');
    await expect(obraAberta).toContainText("Obra aberta");
    await expect(obraAberta).toContainText("Casa Cachoeira");
    await expect(obraAberta.getByRole("link", { name: "Trocar obra" })).toBeVisible();

    // ── (b) o badge é a contagem da fila unificada ───────────────────────
    const badge = sidebar.locator('[data-badge="pendencias"]');
    await expect(badge).toBeVisible();
    const contagem = Number((await badge.textContent())!.trim());
    expect(contagem).toBeGreaterThan(0);

    // ⚠️ A prova de que não há duas definições de "pendência aberta": o
    // número do badge é o número de itens que a view Pendências lista nos
    // dois grupos que contam (vermelhas + âmbares). Se alguém recalcular a
    // contagem em outro lugar, isto fica vermelho.
    await page.goto("/pendencias");
    // ⚠️ Espera o primeiro item ANTES de contar: `count()` não tem auto-wait, e
    // a fila é montada no cliente — contar cedo devolve 0 e o teste "prova"
    // que a contagem diverge quando ela só não tinha chegado.
    await expect(page.getByText("Resolver primeiro")).toBeVisible();
    const naFila = await page.locator("main [data-item-pendencia]").count();
    expect(naFila).toBeGreaterThan(0);
    await expect(
      page.locator('[data-shell="sidebar"] [data-badge="pendencias"]'),
    ).toHaveText(String(contagem));
    // O subtítulo da barra superior conta o mesmo número.
    await expect(page.getByRole("banner")).toContainText(`${contagem} abertas`);

    // ── (c) os três KPIs, lado a lado e completos ────────────────────────
    await page.goto("/");
    const kpis = page.locator("[data-kpi]");
    await expect(kpis).toHaveCount(3);
    const caixas = await kpis.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y) };
      }),
    );
    // Lado a lado: mesma linha, x crescente. Empilhados seria o mobile
    // esticado que este ticket veio substituir.
    expect(new Set(caixas.map((c) => c.y)).size).toBe(1);
    expect(caixas[0].x).toBeLessThan(caixas[1].x);
    expect(caixas[1].x).toBeLessThan(caixas[2].x);

    // R4 do CONTAI-005: o total NUNCA sem a decomposição — as três parcelas.
    const risco = page.locator("[data-custo-em-risco]");
    await expect(risco).toContainText("pagos sem nota");
    await expect(risco).toContainText("em nota fora do seu CPF");
    await expect(risco).toContainText("pagos sem comprovante");
    await expect(risco).toContainText("Pode custar até");

    // R2: a trinca do INSS inteira, e a frase de fechamento não é opcional.
    const inss = page.locator("[data-afericao-inss]");
    await expect(inss).toContainText("Outra apuração — não soma com a de cima");
    await expect(inss).toContainText(
      "Isso não é imposto a pagar nem custo perdido",
    );
    await expect(inss).toContainText(
      "Estas notas continuam valendo integralmente como custo de aquisição no IRPF",
    );

    // ── (d) o painel é subconjunto, e tem saída para a lista inteira ─────
    const painel = page.locator('[data-painel="pendencias-urgentes"]');
    await expect(painel).toBeVisible();
    const verTodas = painel.getByRole("link", { name: /Ver todas \(\d+\)/ });
    await expect(verTodas).toHaveAttribute("href", "/pendencias");
    await expect(verTodas).toContainText(`(${contagem})`);
    // Recorte de 4: o painel é ponto de partida, nunca substituto.
    const noPainel = await painel.locator("[data-item-pendencia]").count();
    expect(noPainel).toBeLessThanOrEqual(4);
    expect(noPainel).toBeLessThanOrEqual(naFila);

    // ── (e) nada cortado, e nada vazando na horizontal ──────────────────
    const cortados = await page.evaluate(() => {
      const fora: string[] = [];
      for (const el of document.querySelectorAll("main p")) {
        // +1 de folga: `scrollWidth`/`clientWidth` são inteiros arredondados.
        if (el.scrollWidth > el.clientWidth + 1) {
          fora.push((el.textContent ?? "").slice(0, 80));
        }
      }
      return fora;
    });
    expect(cortados).toEqual([]);

    const vazamento = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      return main.scrollWidth - main.clientWidth;
    });
    expect(vazamento).toBeLessThanOrEqual(1);
  });

  /**
   * **A separação é por ROTA, não por breakpoint** — critério 7 e Pre-mortem 4.
   *
   * Na mesma janela larga, uma tela de `(captura)` continua nos 430px de
   * sempre, sem sidebar nenhuma. Se alguém reintroduzir largura condicional
   * dentro de um componente compartilhado, é aqui que aparece.
   */
  test("`/adicionar/*` fica fora do shell, nos 430px de sempre", async ({
    page,
  }) => {
    await page.goto("/adicionar/pagamento");
    await expect(
      page.getByRole("heading", { name: "Registrar pagamento" }),
    ).toBeVisible();

    await expect(page.locator('[data-shell="sidebar"]')).toHaveCount(0);
    await expect(page.locator('[data-shell="faixa"]')).toHaveCount(0);

    const casca = page.locator("main").locator("xpath=ancestor::div[1]");
    expect(Math.round((await casca.boundingBox())!.width)).toBe(430);

    // E o rodapé continua dentro da casca estreita — sem o espaçador de 400px
    // que o CONTAI-039 pendurava na `BarraAdicionar` e que este ticket apagou.
    const caixaDaCasca = (await casca.boundingBox())!;
    const corpo = (await page.locator("main").boundingBox())!;
    expect(corpo.x).toBeGreaterThanOrEqual(caixaDaCasca.x);
    expect(corpo.x + corpo.width).toBeLessThanOrEqual(
      caixaDaCasca.x + caixaDaCasca.width,
    );
  });

  /**
   * Critério 5 — o "+ Novo registro" do topbar substitui a `BarraAdicionar`
   * fixa, com as três portas de `/adicionar` e os MESMOS rótulos.
   */
  test("o menu '+ Novo registro' abre as três portas de captura", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Custo em risco no IR")).toBeVisible();

    const botao = page.getByRole("button", { name: "+ Novo registro" });
    await expect(botao).toBeVisible();
    await botao.click();

    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveCount(3);
    await expect(menu).toContainText("📄 Documento — PDF, XML ou foto");
    await expect(menu).toContainText("💸 Pagamento");
    await expect(menu).toContainText("💳 Compra no cartão");
    // A descrição vem junto do rótulo — é ela que diz o que define o ano.
    await expect(menu).toContainText(
      "A data do pagamento é o que define o ano do custo (regime de caixa)",
    );

    await menu.getByRole("menuitem", { name: /💸 Pagamento/ }).click();
    await expect(
      page.getByRole("heading", { name: "Registrar pagamento" }),
    ).toBeVisible();
  });
});

/**
 * **CONTAI-043 — as telas de detalhe do documento dentro do shell.**
 *
 * Fonte do desenho: `design/mocks/detalhe-no-shell-v1.md`. O que este bloco
 * trava é o que só a largura de gestão pode provar, e nada além disso — o
 * comportamento de cada correção continua sendo provado no piso de 375px, em
 * `correcao.spec.ts`, `vinculo.spec.ts` e `acervo.spec.ts`.
 *
 * (a) o detalhe abre DENTRO do shell, com a sidebar inteira e `Despesas` como
 *     item ativo — o clique da fila de pendências não sai mais do contexto;
 * (b) a coluna tem 640px e não a largura cheia: esticar detalhe/formulário por
 *     1244px foi medido no Gate 2 do `CONTAI-039` como menos legível, e texto
 *     fiscal perdendo legibilidade é regressão (critério 2);
 * (c) o breadcrumb substitui o "Voltar" fixo do rodapé e aponta para ROTA — a
 *     lista-mãe no detalhe, o documento nas subrotas;
 * (d) rodapé sticky SÓ onde há uma ação de página: o formulário tem, a leitura
 *     com ações por card não tem (decisão 4 do spec);
 * (e) **nenhuma consequência fiscal foi truncada, escondida ou reescrita** —
 *     critério 3 e o Gate Fiscal do ticket.
 */
test.describe("detalhe de documento no shell de gestão", () => {
  const CNPJ_AJE = "11222333000181";

  /** Uma NF de serviço sem pagamento ligado: é o ramo com mais texto fiscal. */
  async function umaNotaDeServico(db: Parameters<typeof criarFavorecido>[0]) {
    const aje = await criarFavorecido(db, {
      nome: "AJE Construções",
      documento: CNPJ_AJE,
      tipo: "pj",
    });
    return criarDocumento(db, {
      favorecido_id: aje,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      valor: 18400,
      numero: "1234",
      serie: "1",
      data_emissao: `${ANO}-03-12`,
      retencao_na_nota: "nenhuma",
      nota_traz_cno: false,
      destinatario_cpf_ok: true,
      status: "registrado",
    });
  }

  test("abre no shell, em coluna de 640px, sem rodapé fixo e sem perder texto fiscal", async ({
    page,
    db,
  }) => {
    const documentoId = await umaNotaDeServico(db);
    await page.goto(`/documento/${documentoId}`);
    await expect(
      page.getByRole("heading", { name: "NF de serviço" }),
    ).toBeVisible();

    // ── (a) dentro do shell, com Despesas aceso ──────────────────────────
    const sidebar = page.locator('[data-shell="sidebar"]');
    await expect(sidebar).toBeVisible();
    const nav = sidebar.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Despesas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Um item aceso, não dois: sidebar que acende duas views mente sobre onde
    // a tela está.
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    // O subtítulo é o do DOCUMENTO, não o "obra · ano" da view: o documento
    // pode ser de outra obra que não a aberta (Pre-mortem 1).
    await expect(page.getByRole("banner")).toContainText("AJE Construções");

    // ── (b) 640px, alinhada à esquerda ───────────────────────────────────
    const coluna = page.locator('[data-coluna="detalhe"]');
    expect(Math.round((await coluna.boundingBox())!.width)).toBe(640);
    const larguraDoMain = (await page.locator("main").boundingBox())!.width;
    expect(larguraDoMain).toBeGreaterThan(700);

    // ── (c) o breadcrumb aponta para a lista-mãe ─────────────────────────
    const crumb = page.locator('[data-crumb="voltar"]');
    await expect(crumb).toHaveText("‹ Despesas");
    await expect(crumb).toHaveAttribute("href", "/despesas");
    // E o "Voltar ao início" fixo do rodapé de 430px não sobreviveu à
    // migração: ele mudou de lugar, não se duplicou.
    await expect(page.getByRole("link", { name: "Voltar ao início" })).toHaveCount(0);

    // ── (d) leitura com ações por card: nenhum rodapé sticky ─────────────
    await expect(page.locator('[data-rodape="acao"]')).toHaveCount(0);
    // As ações continuam onde o fato está — no fim do card a que pertencem.
    await expect(
      page.getByRole("link", { name: "Ligar a um pagamento" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Corrigir a obra deste registro" }),
    ).toBeVisible();

    // ── (e) a consequência fiscal, aberta e inteira ──────────────────────
    // Sem pagamento ligado: o texto âmbar de `PagamentosDesteDocumento`, que
    // diz que o custo EXISTE e mesmo assim não entra no confirmado.
    await expect(page.getByText("Sem pagamento ligado")).toBeVisible();
    await expect(
      page.getByText("não entram no", { exact: false }).first(),
    ).toBeVisible();
    // O invariante do SERO, visível sem um clique (parecer de 2026-09-18 §2).
    await expect(page.getByText("Abate no INSS (SERO)")).toBeVisible();
    await expect(
      page.getByText(
        "Nenhuma retenção desta nota abate o INSS (SERO)",
        { exact: false },
      ),
    ).toBeVisible();

    // Nada truncado na coluna estreita, e nada vazando na horizontal.
    const cortados = await page.evaluate(() => {
      const fora: string[] = [];
      for (const el of document.querySelectorAll("main p, main li")) {
        if (el.scrollWidth > el.clientWidth + 1) {
          fora.push((el.textContent ?? "").slice(0, 80));
        }
      }
      return fora;
    });
    expect(cortados).toEqual([]);
    const vazamento = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      return main.scrollWidth - main.clientWidth;
    });
    expect(vazamento).toBeLessThanOrEqual(1);
  });

  test("a subrota de correção volta para o documento e tem rodapé sticky na coluna", async ({
    page,
    db,
  }) => {
    const documentoId = await umaNotaDeServico(db);
    await page.goto(`/documento/${documentoId}/corrigir/valor`);
    await expect(
      page.getByRole("heading", { name: "Corrigir o valor" }),
    ).toBeVisible();

    // A sidebar continua inteira: correção é parte da revisão, não um app à
    // parte.
    await expect(page.locator('[data-shell="sidebar"]')).toBeVisible();

    // ── (c) crumb de subrota: o documento, que é rota de verdade ─────────
    const crumb = page.locator('[data-crumb="voltar"]');
    await expect(crumb).toHaveText("‹ Documento");
    await expect(crumb).toHaveAttribute("href", `/documento/${documentoId}`);
    await crumb.click();
    await expect(
      page.getByRole("heading", { name: "NF de serviço" }),
    ).toBeVisible();

    // ── (d) o formulário TEM rodapé de ação, escopado à coluna ───────────
    // Passo 1 → passos 2 e 3: é lá que o "Gravar" existe.
    await page.goto(`/documento/${documentoId}/corrigir/valor`);
    await page
      .getByRole("button", { name: /Só aqui no app — eu digitei errado/ })
      .click();
    await page.getByRole("button", { name: "Continuar" }).click();

    const rodape = page.locator('[data-rodape="acao"]');
    await expect(rodape).toBeVisible();
    const caixaRodape = (await rodape.boundingBox())!;
    const caixaColuna = (await page
      .locator('[data-coluna="detalhe"]')
      .boundingBox())!;
    // Largura da COLUNA, não da janela e nunca por baixo da sidebar.
    expect(Math.round(caixaRodape.width)).toBe(640);
    expect(Math.round(caixaRodape.x)).toBe(Math.round(caixaColuna.x));

    // Sticky de verdade: rolar até o topo não leva o botão embora.
    await page.locator("main").evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(rodape).toBeInViewport();
  });
});
