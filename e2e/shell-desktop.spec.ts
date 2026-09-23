import type { Locator, Page } from "@playwright/test";

import { OBRA_ID_SEED, USER_ID_SEED } from "./ambiente";
import {
  criarCompraCartao,
  criarCompromisso,
  criarDocumento,
  criarFavorecido,
  criarPagamento,
  pendencias,
} from "./banco";
import { expect, test } from "./fixtures";
/**
 * ⚠️ **CONTAI-046 — o texto fiscal se confere contra a CONSTANTE.** As telas de
 * obra e terreno leem estas mesmas frases de `lib/fiscal/*`; digitá-las de novo
 * aqui seria só uma segunda chance de errar, e um teste que passa com o texto
 * errado dos dois lados.
 */
import {
  COBRANCA_SEM_CNO_INSTRUCAO,
  COBRANCA_SEM_CNO_LIMITE,
} from "../lib/fiscal/obra";
import {
  INSUMO_PARA_REVISAO_CRC,
  TERRENO_ZERO_NAO_E_NADA_PAGO,
} from "../lib/fiscal/terreno";

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

/**
 * **CONTAI-047 — os números da casca de captura em tela larga.**
 *
 * `LARGURA_DA_CASCA_LARGA` é o `larga:max-w-[940px]` de `(captura)/layout.tsx`.
 * Ficam nomeados aqui porque a diferença entre casca e coluna É o critério: a
 * casca abre, a coluna do texto fiscal não.
 *
 * ⚠️ **`COLUNA_DO_FORMULARIO_CONTEUDO_PX` é CONTEÚDO, não caixa** — correção do
 * Gate 2. `COLUNA_DO_FORMULARIO` (`larga:max-w-[592px]`) vai no `Corpo` e no
 * `Rodape`, que carregam `px-[18px]` e são `border-box`: 592 − 36 = 556. A
 * coluna esquerda da `GradeDaCaptura` é um div sem padding e mede 556 direto.
 * O teste compara os dois pelo CONTEÚDO justamente porque foi aí que as duas
 * larguras divergiram (556 × 520) sem ninguém ver.
 */
const LARGURA_DA_CASCA_LARGA = 940;
const COLUNA_DO_FORMULARIO_CONTEUDO_PX = 556;
/** A caixa do `Corpo`/`Rodape` com as duas goteiras de 18px. */
const COLUNA_DO_FORMULARIO_CAIXA_PX = COLUNA_DO_FORMULARIO_CONTEUDO_PX + 36;

/**
 * A largura ÚTIL de um elemento: caixa de borda menos os paddings laterais. É o
 * que permite comparar um `Corpo` (com goteira) com a coluna da grade (sem).
 */
async function larguraDoConteudo(alvo: Locator): Promise<number> {
  return alvo.evaluate((el) => {
    const estilo = getComputedStyle(el);
    return (
      el.getBoundingClientRect().width -
      Number.parseFloat(estilo.paddingLeft) -
      Number.parseFloat(estilo.paddingRight)
    );
  });
}

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
   * **A separação é por ROTA, não por breakpoint** — critério 7 do CONTAI-040 e
   * Pre-mortem 4.
   *
   * ⚠️ **O número mudou no CONTAI-047, a regra não.** A casca de captura passou
   * de 430px para `LARGURA_DA_CASCA_LARGA` numa janela larga (Mateus,
   * 2026-09-22: *"as telas de captura também devem ganhar tratamento
   * desktop"*), mas o que este teste protege continua sendo o mesmo: captura
   * **não tem sidebar nem faixa de gestão em largura nenhuma** — é só a coluna
   * que cresce (critério 9 do 047). Se alguém trouxer o chrome de gestão para
   * cá, é aqui que aparece.
   */
  test("`/adicionar/*` fica fora do shell, na casca larga da captura", async ({
    page,
  }) => {
    await page.goto("/adicionar/pagamento");
    await expect(
      page.getByRole("heading", { name: "Registrar pagamento" }),
    ).toBeVisible();

    await expect(page.locator('[data-shell="sidebar"]')).toHaveCount(0);
    await expect(page.locator('[data-shell="faixa"]')).toHaveCount(0);

    const casca = page.locator("main").locator("xpath=ancestor::div[1]");
    expect(Math.round((await casca.boundingBox())!.width)).toBe(
      LARGURA_DA_CASCA_LARGA,
    );

    // ⚠️ **NÃO é full-width, e a diferença entre as duas medidas é o ponto.**
    // A casca abriu; a COLUNA do formulário parou, porque o Gate 2 do
    // CONTAI-039 mediu que largura cheia lê pior que coluna limitada. Sem esta
    // asserção "casca larga" viraria "campo de 900px" no primeiro refactor.
    const corpo = (await page.locator("main").boundingBox())!;
    expect(Math.round(corpo.width)).toBe(COLUNA_DO_FORMULARIO_CAIXA_PX);
    // E a linha de texto útil é a MESMA de `/adicionar/documento` — é esta
    // igualdade que o Gate 2 cobrou (antes eram 520 aqui e 556 lá).
    expect(Math.round(await larguraDoConteudo(page.locator("main")))).toBe(
      COLUNA_DO_FORMULARIO_CONTEUDO_PX,
    );

    // E o rodapé continua dentro da casca — sem o espaçador de 400px que o
    // CONTAI-039 pendurava na `BarraAdicionar` e que o CONTAI-040 apagou.
    const caixaDaCasca = (await casca.boundingBox())!;
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
 * **CONTAI-041 — a tabela de Despesas na largura de gestão.**
 *
 * ⚠️ **Só o que a largura pode provar.** Filtros, ordenação, montagem das
 * linhas e texto fiscal já são provados no projeto `mobile`, no piso de 375px
 * (`despesas.spec.ts`), e em `lib/fiscal/despesas.test.ts`. O que só aqui se
 * prova é que ela é uma TABELA DE VERDADE — colunas lado a lado, cabeçalho
 * ordenável visível — e que a consequência fiscal cabe inteira na célula, que é
 * a liberdade nova do spec de design: *"numa tela larga uma linha de tabela
 * pode ser alta o suficiente para caber a Consequência inteira"*.
 */
test.describe("a tabela de Despesas no shell de gestão", () => {
  test("colunas de verdade, cabeçalho ordenável e consequência inteira na célula", async ({
    page,
    db,
  }) => {
    const favorecidoId = await criarFavorecido(db, {
      nome: "João Pedreiro",
      documento: "52998224725",
      tipo: "pf",
    });
    await criarPagamento(db, {
      favorecido_id: favorecidoId,
      valor: 3200,
      data_pagamento: `${ANO}-02-14`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix.png`,
    });

    await page.goto("/despesas");
    const tabela = page.locator('[data-tabela="despesas"]');
    await expect(tabela).toBeVisible();

    // Despesas acesa, e só ela.
    const nav = page
      .locator('[data-shell="sidebar"]')
      .getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Despesas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);

    // ── tabela de VERDADE: as sete colunas numa linha só ─────────────────
    const celulas = await tabela
      .locator("tbody tr")
      .first()
      .locator("td")
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y) };
        }),
      );
    expect(celulas).toHaveLength(7);
    // Mesma linha, x crescente — empilhado seria a pilha de 375px esticada.
    expect(new Set(celulas.map((c) => c.y)).size).toBe(1);
    for (let i = 1; i < celulas.length; i++) {
      expect(celulas[i].x).toBeGreaterThan(celulas[i - 1].x);
    }

    // O cabeçalho da tabela existe de verdade nesta largura, com as sete
    // colunas nomeadas e as duas ordenáveis anunciando a ordem.
    await expect(tabela.locator("thead th")).toHaveCount(7);
    await expect(tabela.locator("thead th").first()).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    await tabela.locator("[data-ordenar='valor']").click();
    await expect(tabela.locator("thead th").nth(4)).toHaveAttribute(
      "aria-sort",
      "descending",
    );

    // ── a consequência INTEIRA dentro da célula, sem truncar e sem clique ─
    const consequencia = page.getByText(
      "Custo não se sustenta no IR até o recibo chegar",
      { exact: false },
    );
    await expect(consequencia).toBeVisible();
    // A linha cresceu em altura para caber o texto: é essa a liberdade nova.
    const alturaDaLinha = (await tabela.locator("tbody tr").boundingBox())!.height;
    expect(alturaDaLinha).toBeGreaterThan(60);

    const cortados = await page.evaluate(() => {
      const fora: string[] = [];
      for (const el of document.querySelectorAll("main p, main td")) {
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

/**
 * **CONTAI-044 — pagamento e fatura seguem `/documento/[id]` para dentro do
 * shell.** Mesmo spec (`detalhe-no-shell-v1.md`), mesma casca — o que este
 * bloco prova é só o que muda com a raiz da rota: `Despesas` acende para as
 * duas, a coluna continua 640px (critério 2, decisão registrada no código de
 * `fatura/[id]/alocar`: sem tabela densa, sem exceção), e o breadcrumb das
 * subrotas volta para o PAGAMENTO/FATURA de origem, nunca para `/despesas`
 * direto — a mesma regra "um nível abaixo" do `CONTAI-043`.
 */
test.describe("detalhe de pagamento e de fatura no shell de gestão", () => {
  const CNPJ_LOJA = "11222333000181";

  test("pagamento: shell com Despesas aceso, coluna 640px, sem rodapé fixo", async ({
    page,
    db,
  }) => {
    const favorecidoId = await criarFavorecido(db, {
      nome: "Depósito Cachoeira ME",
      documento: CNPJ_LOJA,
      tipo: "pj",
    });
    const pagamentoId = await criarPagamento(db, {
      favorecido_id: favorecidoId,
      valor: 950,
      data_pagamento: "2026-08-12",
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix.png`,
    });

    await page.goto(`/pagamento/${pagamentoId}`);
    await expect(page.getByRole("heading", { name: "Pagamento" })).toBeVisible();

    // ── Despesas acesa, e só ela ──────────────────────────────────────────
    const sidebar = page.locator('[data-shell="sidebar"]');
    const nav = sidebar.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Despesas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);

    // ── 640px, não a largura cheia ────────────────────────────────────────
    const coluna = page.locator('[data-coluna="detalhe"]');
    expect(Math.round((await coluna.boundingBox())!.width)).toBe(640);

    // ── breadcrumb para a lista-mãe ───────────────────────────────────────
    const crumb = page.locator('[data-crumb="voltar"]');
    await expect(crumb).toHaveText("‹ Despesas");
    await expect(crumb).toHaveAttribute("href", "/despesas");

    // ── leitura com ações por card: sem rodapé sticky ────────────────────
    await expect(page.locator('[data-rodape="acao"]')).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Ligar a uma nota" }),
    ).toBeVisible();
  });

  test("pagamento/[id]/ligar: breadcrumb volta ao pagamento, rodapé sticky na coluna", async ({
    page,
    db,
  }) => {
    const favorecidoId = await criarFavorecido(db, {
      nome: "Depósito Cachoeira ME",
      documento: CNPJ_LOJA,
      tipo: "pj",
    });
    const pagamentoId = await criarPagamento(db, {
      favorecido_id: favorecidoId,
      valor: 950,
      data_pagamento: "2026-08-12",
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix.png`,
    });

    await page.goto(`/pagamento/${pagamentoId}/ligar`);
    await expect(
      page.getByRole("heading", { name: "Ligar este pagamento a uma nota" }),
    ).toBeVisible();

    const crumb = page.locator('[data-crumb="voltar"]');
    await expect(crumb).toHaveText("‹ Pagamento");
    await expect(crumb).toHaveAttribute("href", `/pagamento/${pagamentoId}`);

    const rodape = page.locator('[data-rodape="acao"]');
    await expect(rodape).toBeVisible();
    expect(Math.round((await rodape.boundingBox())!.width)).toBe(640);
  });

  test("fatura: shell com Despesas aceso, e o formulário de confirmação tem rodapé sticky na coluna", async ({
    page,
    db,
  }) => {
    const favorecidoId = await criarFavorecido(db, {
      nome: "Leroy Merlin",
      documento: CNPJ_LOJA,
      tipo: "pj",
    });
    const { faturaId } = await criarCompraCartao(db, {
      favorecidoId,
      valor: 950,
      dataCompra: "2026-08-14",
      dataVencimento: "2026-09-10",
    });

    await page.goto(`/fatura/${faturaId}`);
    await expect(
      page.getByRole("heading", { name: /Fatura · vence/ }),
    ).toBeVisible();

    const sidebar = page.locator('[data-shell="sidebar"]');
    const nav = sidebar.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Despesas" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const coluna = page.locator('[data-coluna="detalhe"]');
    expect(Math.round((await coluna.boundingBox())!.width)).toBe(640);

    let crumb = page.locator('[data-crumb="voltar"]');
    await expect(crumb).toHaveText("‹ Despesas");
    await expect(crumb).toHaveAttribute("href", "/despesas");

    // A subrota de confirmação volta para a FATURA, não para `/despesas`
    // direto — e é lá que mora o rodapé de ação (uma ação central de página).
    await page.goto(`/fatura/${faturaId}/confirmar`);
    await expect(
      page.getByRole("heading", { name: "Fatura paga · integral" }),
    ).toBeVisible();

    crumb = page.locator('[data-crumb="voltar"]');
    await expect(crumb).toHaveText("‹ Fatura");
    await expect(crumb).toHaveAttribute("href", `/fatura/${faturaId}`);

    const rodape = page.locator('[data-rodape="acao"]');
    await expect(rodape).toBeVisible();
    expect(Math.round((await rodape.boundingBox())!.width)).toBe(640);
  });
});

/**
 * **CONTAI-045 — compromisso e pendência entram no shell.** Mesmo spec
 * (`detalhe-no-shell-v1.md`), mesma casca dos irmãos `043`/`044`. O que muda
 * aqui, e é só isso que este bloco trava:
 *
 * (a) a view acesa não é `Despesas`: `/compromisso/*` acende **Visão geral** (é
 *     onde a Agenda vive — decisão 1 do spec), e `/pendencias/[id]` acende
 *     **Pendências**;
 * (b) o breadcrumb ganha um terceiro degrau real: a agenda volta para a Visão
 *     geral, o agendamento volta para a agenda, e as três respostas voltam para
 *     o agendamento — sempre ROTA, nunca histórico;
 * (c) **`/pendencias/[id]` volta para `/pendencias`**, e não para a home antiga,
 *     que não existe desde o `CONTAI-040` (critério 4 e Pre-mortem 2);
 * (d) `confirmar` é formulário com uma ação de página: rodapé sticky na coluna —
 *     e os campos fiscais continuam **nascendo vazios** depois da mudança de
 *     rota (critério 3; a D65 é desta tela).
 */
test.describe("compromisso e pendência no shell de gestão", () => {
  const CNPJ = "11222333000181";

  async function umAgendamentoVencido(db: Parameters<typeof criarFavorecido>[0]) {
    const favorecidoId = await criarFavorecido(db, {
      nome: "AJE Construções",
      documento: CNPJ,
      tipo: "pj",
    });
    return criarCompromisso(db, {
      favorecido_id: favorecidoId,
      valor_previsto: 5000,
      data_prevista: `${ANO}-01-10`,
      origem: "boleto",
    });
  }

  test("a agenda abre no shell, com Visão geral acesa e crumb para ela", async ({
    page,
    db,
  }) => {
    await umAgendamentoVencido(db);

    await page.goto("/compromisso");
    await expect(page.getByRole("heading", { name: "Agendados" })).toBeVisible();

    const sidebar = page.locator('[data-shell="sidebar"]');
    await expect(sidebar).toBeVisible();
    const nav = sidebar.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Visão geral" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Um item aceso, não dois.
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);

    const coluna = page.locator('[data-coluna="detalhe"]');
    expect(Math.round((await coluna.boundingBox())!.width)).toBe(640);

    const crumb = page.locator('[data-crumb="voltar"]');
    await expect(crumb).toHaveText("‹ Visão geral");
    await expect(crumb).toHaveAttribute("href", "/");
    // O "Voltar ao início" fixo do rodapé de 430px não sobreviveu: ele mudou
    // de lugar, não se duplicou.
    await expect(page.getByRole("link", { name: "Voltar ao início" })).toHaveCount(
      0,
    );
    // Lista, não formulário: nenhuma ação de página, nenhum rodapé.
    await expect(page.locator('[data-rodape="acao"]')).toHaveCount(0);
  });

  test("o agendamento é leitura: as três respostas no card, sem rodapé fixo", async ({
    page,
    db,
  }) => {
    const id = await umAgendamentoVencido(db);

    await page.goto(`/compromisso/${id}`);
    await expect(
      page.getByRole("heading", { name: "Agendamento" }),
    ).toBeVisible();

    const crumb = page.locator('[data-crumb="voltar"]');
    await expect(crumb).toHaveText("‹ Agendados");
    await expect(crumb).toHaveAttribute("href", "/compromisso");

    expect(
      Math.round((await page.locator('[data-coluna="detalhe"]').boundingBox())!.width),
    ).toBe(640);

    // Decisão 4 do spec: leitura com várias ações não ganha rodapé — cada uma
    // fica no fim do card a que pertence, e nenhuma delas se perdeu.
    //
    // ⚠️ Escopado em `[data-acoes="agendamento"]` porque o cartão do vencido já
    // traz as TRÊS RESPOSTAS de um toque (`TresRespostas`, critérios 18 e 49) —
    // a convivência das duas camadas é de antes deste ticket, e a migração de
    // casca não podia apagar nenhuma das duas.
    await expect(page.locator('[data-rodape="acao"]')).toHaveCount(0);
    const acoes = page.locator('[data-acoes="agendamento"]');
    await expect(acoes.getByRole("link", { name: "Registrar o pagamento" })).toBeVisible();
    await expect(acoes.getByRole("link", { name: "Mudou a data" })).toBeVisible();
    // ⚠️ Critério 22 do CONTAI-019: cancelar mora SÓ no detalhe, e continua aqui.
    await expect(
      acoes.getByRole("link", { name: "Marcar que não vai ser pago" }),
    ).toBeVisible();
    // E as três respostas do cartão do vencido continuam onde estavam.
    await expect(
      page.getByRole("group", { name: "Respostas do agendamento vencido" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar ao início" })).toHaveCount(
      0,
    );

    await crumb.click();
    await expect(page.getByRole("heading", { name: "Agendados" })).toBeVisible();
  });

  /**
   * ⚠️ **A tela da D65.** O `CONTAI-034` tirou daqui o `cValor` pré-preenchido
   * com o saldo previsto; o critério 3 deste ticket diz que a migração de casca
   * não pode reintroduzir default nenhum. A trava formal continua sendo
   * `campos-fiscais.spec.ts` (que enumera a rota pelo filesystem e não vê route
   * group); esta asserção existe porque o ticket pede a conferência **na casca
   * nova**, com o shell montado em volta.
   */
  test("confirmar: rodapé sticky na coluna, e data e valor continuam nascendo vazios", async ({
    page,
    db,
  }) => {
    const id = await umAgendamentoVencido(db);

    await page.goto(`/compromisso/${id}/confirmar`);
    await expect(
      page.getByRole("heading", { name: "Registrar o pagamento", exact: true }),
    ).toBeVisible();

    const crumb = page.locator('[data-crumb="voltar"]');
    await expect(crumb).toHaveText("‹ Agendamento");
    await expect(crumb).toHaveAttribute("href", `/compromisso/${id}`);

    // Nenhum default em campo fiscal — nem na data, nem no valor.
    await expect(page.getByLabel("Data em que o dinheiro saiu")).toHaveValue("");
    await expect(page.getByLabel("Valor efetivamente pago")).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Informe a data em que o dinheiro saiu" }),
    ).toBeDisabled();
    // O previsto continua read-only, cinza e com `~`: referência, nunca campo.
    await expect(page.locator("[data-marca='valor-previsto']")).toContainText("~");

    const rodape = page.locator('[data-rodape="acao"]');
    await expect(rodape).toBeVisible();
    const caixaRodape = (await rodape.boundingBox())!;
    const caixaColuna = (await page
      .locator('[data-coluna="detalhe"]')
      .boundingBox())!;
    expect(Math.round(caixaRodape.width)).toBe(640);
    expect(Math.round(caixaRodape.x)).toBe(Math.round(caixaColuna.x));
  });

  /**
   * Critério 4 e Pre-mortem 2: o link de volta aponta para a fila unificada
   * (`/pendencias`), dentro do shell — nunca para a home antiga.
   */
  test("a pendência volta para /pendencias, com Pendências acesa", async ({
    page,
    db,
  }) => {
    const favorecidoId = await criarFavorecido(db, {
      nome: "AJE Construções",
      documento: CNPJ,
      tipo: "pj",
    });
    const documentoId = await criarDocumento(db, {
      favorecido_id: favorecidoId,
      tipo: "nf_material",
      classificacao: "material",
      valor: 9400,
      destinatario_cpf_ok: true,
    });
    // O caminho que CRIA a pendência persistente, sem inventar linha no banco.
    await page.goto(`/documento/${documentoId}/cnpj-errado`);
    await page
      .getByRole("button", {
        name: "Marcar: o CNPJ deste registro está errado — tratar",
      })
      .click();
    await expect(page.getByRole("status")).toContainText("Marcado.");
    const pendenciaId = (await pendencias(db))[0].id;

    await page.goto(`/pendencias/${pendenciaId}`);
    await expect(
      page.getByRole("heading", { name: "CNPJ errado — tratar" }),
    ).toBeVisible();

    const sidebar = page.locator('[data-shell="sidebar"]');
    const nav = sidebar.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Pendências" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);

    expect(
      Math.round((await page.locator('[data-coluna="detalhe"]').boundingBox())!.width),
    ).toBe(640);

    const crumb = page.locator('[data-crumb="voltar"]');
    await expect(crumb).toHaveText("‹ Pendências");
    await expect(crumb).toHaveAttribute("href", "/pendencias");
    // O "Voltar às pendências" do rodapé de 430px mudou de lugar, não se
    // duplicou.
    await expect(
      page.getByRole("link", { name: "Voltar às pendências" }),
    ).toHaveCount(0);

    await crumb.click();
    await expect(page).toHaveURL("/pendencias");
  });
});

/**
 * **CONTAI-046 — obra, terreno, discriminação anual e notas sem CNO no shell.**
 *
 * A quarta e última família da dívida do `CONTAI-040`, e a de maior superfície.
 * O seam é o mais direto de todos: os dois links secundários da sidebar
 * (`Dados da obra` e `Terreno`) apontam para cá desde o dia 1 do shell, e até
 * aqui todo clique neles saía do shell.
 *
 * ⚠️ **As duas telas com mais texto fiscal por área do produto estão aqui**
 * (`discriminacao/[ano]` e `notas-sem-cno`). A prova de que nenhuma palavra
 * mudou é a comparação com a CONSTANTE — o mesmo `lib/fiscal/*` que a tela lê —,
 * não uma cópia digitada no teste, que seria só uma segunda chance de errar.
 */
test.describe("obra e terreno no shell de gestão", () => {
  const OBRA = `/obras/${OBRA_ID_SEED}`;

  /** Um item da sidebar aceso, e só um: sidebar que acende dois mente. */
  async function apenasObrasAcesa(page: Page) {
    const sidebar = page.locator('[data-shell="sidebar"]');
    await expect(sidebar).toBeVisible();
    const nav = sidebar.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Obras" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  }

  test("o cadastro da obra abre no shell, com rodapé sticky na coluna de 640px", async ({
    page,
  }) => {
    await page.goto(OBRA);
    await expect(
      page.getByRole("heading", { name: "Dados da obra" }),
    ).toBeVisible();
    await apenasObrasAcesa(page);

    // O subtítulo é o da OBRA aberta nesta tela, não o "obra · ano" da view.
    await expect(page.getByRole("banner")).toContainText("Casa Cachoeira");

    const coluna = page.locator('[data-coluna="detalhe"]');
    const caixaColuna = (await coluna.boundingBox())!;
    expect(Math.round(caixaColuna.width)).toBe(640);
    expect((await page.locator("main").boundingBox())!.width).toBeGreaterThan(700);

    const crumb = page.locator('[data-crumb="voltar"]');
    await expect(crumb).toHaveText("‹ Obras");
    await expect(crumb).toHaveAttribute("href", "/obras");
    // O "Voltar" do rodapé de 430px mudou de lugar, não se duplicou.
    await expect(page.getByRole("link", { name: "Voltar", exact: true })).toHaveCount(
      0,
    );

    // Formulário com UMA ação de página: o rodapé fica, escopado à coluna.
    const rodape = page.locator('[data-rodape="acao"]');
    await expect(rodape).toBeVisible();
    const caixaRodape = (await rodape.boundingBox())!;
    expect(Math.round(caixaRodape.width)).toBe(640);
    expect(Math.round(caixaRodape.x)).toBe(Math.round(caixaColuna.x));
    await expect(
      rodape.getByRole("button", { name: "Salvar alterações" }),
    ).toBeVisible();

    await crumb.click();
    await expect(page).toHaveURL("/obras");
  });

  test("o painel do terreno é leitura: sem rodapé fixo, e nenhuma ação perdida", async ({
    page,
  }) => {
    await page.goto(`${OBRA}/terreno`);
    await expect(
      page.getByRole("heading", { name: "Terreno — custo por ano" }),
    ).toBeVisible();
    await apenasObrasAcesa(page);

    const crumb = page.locator('[data-crumb="voltar"]');
    await expect(crumb).toHaveText("‹ Dados da obra");
    await expect(crumb).toHaveAttribute("href", OBRA);

    expect(
      Math.round((await page.locator('[data-coluna="detalhe"]').boundingBox())!.width),
    ).toBe(640);

    // Decisão 4 do spec: leitura com ações espalhadas em cards não tem rodapé.
    await expect(page.locator('[data-rodape="acao"]')).toHaveCount(0);
    // ⚠️ **As duas ações REAIS do rodapé antigo continuam alcançáveis.** Sumir
    // com elas seria regressão de alcance, não de casca: os botões por ano só
    // aparecem no estado `falta_lancar`, e sem esta porta um financiamento
    // inteiro em "aguardando informe" ficaria sem caminho.
    await expect(
      page.getByRole("link", { name: "Registrar desembolso do terreno" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Cadastrar contrato de financiamento" }),
    ).toBeVisible();
    // O que NÃO volta é navegação pura: ela virou o crumb e a sidebar.
    await expect(
      page.getByRole("link", { name: "Voltar ao início" }),
    ).toHaveCount(0);

    // Texto fiscal da tela, conferido contra a CONSTANTE que a tela lê.
    await expect(page.getByText(TERRENO_ZERO_NAO_E_NADA_PAGO)).toBeVisible();
    await expect(page.getByText(INSUMO_PARA_REVISAO_CRC)).toBeVisible();
  });

  test("desembolsos do terreno: crumb volta ao painel, rodapé sticky na coluna", async ({
    page,
  }) => {
    await page.goto(`${OBRA}/terreno/desembolsos`);
    await expect(
      page.getByRole("heading", { name: "O que saiu do seu bolso" }),
    ).toBeVisible();
    await apenasObrasAcesa(page);

    // ⚠️ Um degrau, não dois: a mãe desta tela é o PAINEL DO TERRENO, que é
    // rota de verdade — não o cadastro da obra.
    const crumb = page.locator('[data-crumb="voltar"]');
    await expect(crumb).toHaveText("‹ Terreno");
    await expect(crumb).toHaveAttribute("href", `${OBRA}/terreno`);

    const caixaColuna = (await page
      .locator('[data-coluna="detalhe"]')
      .boundingBox())!;
    const rodape = page.locator('[data-rodape="acao"]');
    await expect(rodape).toBeVisible();
    const caixaRodape = (await rodape.boundingBox())!;
    expect(Math.round(caixaRodape.width)).toBe(640);
    expect(Math.round(caixaRodape.x)).toBe(Math.round(caixaColuna.x));
    // O rótulo que NOMEIA A CONSEQUÊNCIA continua sendo o do botão de gravar.
    await expect(rodape.locator("[data-gravar]")).toBeVisible();

    await crumb.click();
    await expect(page).toHaveURL(`${OBRA}/terreno`);
  });

  /**
   * ⚠️ **Critério 2 do ticket, resolvido SEM exceção de largura.** O bloco
   * copiável é prosa em `<pre>` com `whitespace-pre-wrap break-words`: ele
   * quebra, então em 640px não trunca nem pede scroll horizontal — que é a
   * regra de legibilidade fiscal que o critério exige. Este teste é o que
   * trava a decisão: se alguém tirar a quebra, ele fica vermelho.
   */
  test("a discriminação anual cabe em 640px — nada truncado, nada rolando na horizontal", async ({
    page,
  }) => {
    await page.goto(`${OBRA}/discriminacao/${ANO}`);
    await expect(
      page.getByRole("heading", { name: `Discriminação de ${ANO}` }),
    ).toBeVisible();
    await apenasObrasAcesa(page);

    const crumb = page.locator('[data-crumb="voltar"]');
    await expect(crumb).toHaveText("‹ Dados da obra");
    await expect(crumb).toHaveAttribute("href", OBRA);
    // Saída de leitura: nenhuma ação de página, nenhum rodapé.
    await expect(page.locator('[data-rodape="acao"]')).toHaveCount(0);

    const bloco = page.locator("[data-bloco='copiavel']");
    await expect(bloco).toBeVisible();
    expect(
      Math.round((await page.locator('[data-coluna="detalhe"]').boundingBox())!.width),
    ).toBe(640);

    // O texto que vai COLADO na ficha Bens e Direitos não pode rolar nem ser
    // cortado: é nele que se confere palavra por palavra antes de declarar.
    const folga = await bloco.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    expect(folga).toBeLessThanOrEqual(1);

    const cortados = await page.evaluate(() => {
      const fora: string[] = [];
      for (const el of document.querySelectorAll("main p, main pre, main li")) {
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
   * **Critério 4** — a porta única (`podeGerarRelatorioAnual`, CONTAI-036)
   * continua sendo quem decide, na casca nova. Nota registrada sem arquivo no
   * acervo veta a saída: se a migração tivesse aberto um segundo caminho até o
   * texto, o bloco sairia assim mesmo.
   */
  test("a porta única continua vetando a discriminação dentro do shell", async ({
    page,
    db,
  }) => {
    const favorecidoId = await criarFavorecido(db, {
      nome: "AJE Construções",
      documento: CNPJ_AJE_DIGITOS,
      tipo: "pj",
    });
    await criarDocumento(db, {
      favorecido_id: favorecidoId,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      valor: 18400,
      destinatario_cpf_ok: true,
      arquivo_path: null,
    });

    await page.goto(`${OBRA}/discriminacao/${ANO}`);
    await expect(page.locator("[data-veto='sem-arquivo']")).toContainText(
      `A discriminação de ${ANO} não vai ser gerada ainda.`,
    );
    await expect(page.locator("[data-bloco='copiavel']")).toHaveCount(0);
  });

  /**
   * **Critério 5 e Pre-mortem 2** — `discriminacao/[ano]` recebe o ano por
   * PARÂMETRO DE ROTA, e o `CONTAI-042` §5 fixou que "o ano é um só" dentro do
   * shell. Os dois convivem porque o `ano` do shell é função de `hojeIso()`,
   * calculada uma vez no `ProvedorDeGestao` e sem setter nenhum: navegar para
   * outro ano não tem como escrever nele.
   */
  test("abrir a discriminação de outro ano não mexe no ano do shell", async ({
    page,
  }) => {
    await page.goto(`${OBRA}/discriminacao/${ANO - 1}`);
    await expect(
      page.getByRole("heading", { name: `Discriminação de ${ANO - 1}` }),
    ).toBeVisible();
    // A sidebar continua dizendo o ano corrente enquanto a tela mostra o outro.
    await expect(page.locator('[data-shell="obra-aberta"]')).toContainText(
      `ano ${ANO}`,
    );

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
    await expect(page.getByRole("banner")).toContainText(`Casa Cachoeira · ${ANO}`);
  });

  test("notas sem CNO: leitura no shell, com o texto de cobrança inteiro", async ({
    page,
  }) => {
    await page.goto(`${OBRA}/notas-sem-cno`);
    await expect(
      page.getByRole("heading", { name: "Notas sem CNO" }),
    ).toBeVisible();
    await apenasObrasAcesa(page);

    const crumb = page.locator('[data-crumb="voltar"]');
    await expect(crumb).toHaveText("‹ Dados da obra");
    await expect(crumb).toHaveAttribute("href", OBRA);
    await expect(page.locator('[data-rodape="acao"]')).toHaveCount(0);

    // As duas frases de consequência, conferidas contra a constante.
    await expect(page.getByText(COBRANCA_SEM_CNO_INSTRUCAO)).toBeVisible();
    await expect(page.getByText(COBRANCA_SEM_CNO_LIMITE)).toBeVisible();
  });

  /**
   * **Pre-mortem 3** — `/obras/nova` está sob o mesmo prefixo das rotas que
   * migraram e NÃO migra: é captura pontual (uma vez por obra), não gestão
   * recorrente. A exclusão é deliberada, e este teste é o que a torna visível
   * para quem vier depois.
   */
  test("/obras/nova continua fora do shell, na casca larga da captura", async ({
    page,
  }) => {
    await page.goto("/obras/nova");
    await expect(page.locator('[data-shell="sidebar"]')).toHaveCount(0);
    await expect(page.locator('[data-shell="faixa"]')).toHaveCount(0);

    // CONTAI-047, critério 5 — CARONA: o assistente herda a casca larga do
    // grupo e para na mesma coluna de formulário das telas de captura. Sem
    // sidebar continua sendo o que importa; a largura é o que mudou.
    await expect(page.getByRole("heading", { name: "Nova obra" })).toBeVisible();
    const casca = page.locator("main").locator("xpath=ancestor::div[1]");
    expect(Math.round((await casca.boundingBox())!.width)).toBe(
      LARGURA_DA_CASCA_LARGA,
    );
    expect(Math.round((await page.locator("main").boundingBox())!.width)).toBe(
      COLUNA_DO_FORMULARIO_CAIXA_PX,
    );
  });
});

/**
 * ══ CONTAI-047 — a CAPTURA em tela larga ═══════════════════════════════════
 *
 * Fonte: `design/mocks/captura-no-desktop-v1.md`. O que este bloco trava, em
 * ordem, é o que o ticket nomeia como caro de descobrir tarde:
 *
 * (a) a grade `formulário + rail` existe e o rail fica **à direita**, na mesma
 *     linha — não empilhado, que seria o mobile esticado de novo;
 * (b) **o rail é espelho, nunca pendência** (Decisão 4 do mock, Pre-mortem 0):
 *     a consequência de quarentena nasce e fica no card da pergunta;
 * (c) **bloco de pergunta fiscal não divide largura** (Pre-mortem 1): a
 *     `Escolha` do CPF ocupa a coluna inteira do formulário;
 * (d) o hub mostra as três portas lado a lado, não esticadas (critério 4);
 * (e) a saída do fluxo leva a uma tela real do produto, COM o shell de gestão
 *     (critério 8, Pre-mortem 3).
 *
 * `/entrar` tem teste próprio mais abaixo, porque precisa de sessão nenhuma.
 */
test.describe("captura em tela larga", () => {
  const CNPJ_CASA = "11.444.777/0001-61";

  test("grade formulário + rail, com o rail à direita e sem pendência dentro dele", async ({
    page,
  }) => {
    await page.goto("/adicionar/documento");
    await expect(
      page.getByRole("heading", { name: "Registrar documento" }),
    ).toBeVisible();

    const rail = page.locator('[data-captura="rail"]');
    const formulario = page.locator('[data-captura="formulario"]');
    await expect(rail).toBeVisible();

    // ── (a) lado a lado, rail à DIREITA ─────────────────────────────────
    const caixaDoRail = (await rail.boundingBox())!;
    const caixaDoForm = (await formulario.boundingBox())!;
    expect(caixaDoRail.x).toBeGreaterThan(caixaDoForm.x);
    // Mesma linha: a diferença de topo é folga de subpixel, não empilhamento.
    expect(Math.abs(caixaDoRail.y - caixaDoForm.y)).toBeLessThanOrEqual(2);
    expect(Math.round(caixaDoForm.width)).toBe(
      COLUNA_DO_FORMULARIO_CONTEUDO_PX,
    );

    // O anexo mora no rail (critério 1a) — e continua sendo o MESMO campo, com
    // o mesmo `data-campo`, não um segundo input.
    await expect(rail.locator('[data-campo="arquivo"]')).toHaveCount(1);
    await expect(page.locator('input[type="file"]')).toHaveCount(1);

    // O resumo nasce inteiro em "ainda não respondido": nada é inferido.
    const resumo = rail.getByText("Resumo até agora").locator("..");
    await expect(resumo.getByText("ainda não respondido")).toHaveCount(4);

    // ── (b) a consequência de quarentena NASCE E FICA no card da pergunta ─
    await page
      .getByRole("group", { name: "A nota está no seu CPF?" })
      .getByText("Não", { exact: true })
      .click();

    const quarentena = page.getByText("Vai para", { exact: false });
    await expect(quarentena.first()).toBeVisible();
    await expect(formulario.getByRole("alert")).toContainText("quarentena");
    // ⚠️ A asserção que importa: NENHUM alerta dentro do rail. O rail só
    // espelha o que já foi respondido — pendência nasce inline (Decisão 4).
    await expect(rail.getByRole("alert")).toHaveCount(0);
    await expect(rail.getByText("quarentena")).toHaveCount(0);

    // …e o espelho, esse sim, acompanha: a resposta aparece no resumo.
    await expect(resumo.getByText("Não", { exact: true })).toBeVisible();
    await expect(resumo.getByText("ainda não respondido")).toHaveCount(3);

    // ── (c) a pergunta fiscal ocupa a coluna INTEIRA, nunca meia ─────────
    const perguntaDoCpf = page.locator('fieldset[data-campo="nota_no_seu_cpf"]');
    const caixaDaPergunta = (await perguntaDoCpf.boundingBox())!;
    // O card tem padding lateral; o que se prova é que ela NÃO foi para uma
    // grade de duas colunas — meia largura seria ~250px.
    expect(caixaDaPergunta.width).toBeGreaterThan(
      COLUNA_DO_FORMULARIO_CONTEUDO_PX * 0.8,
    );
  });

  /**
   * Critério 2 — escalares curtos lado a lado, e só eles. Número e série são o
   * par de referência: se alguém desfizer a grade, os dois voltam a empilhar.
   */
  test("número e série dividem a linha; a data de emissão não", async ({
    page,
  }) => {
    await page.goto("/adicionar/documento");
    await page
      .getByRole("group", { name: "Tipo" })
      .getByText("NF material", { exact: true })
      .click();

    const numero = (await page.getByLabel("Número da nota").boundingBox())!;
    const serie = (await page
      .getByLabel("Série (quando houver)")
      .boundingBox())!;
    expect(serie.x).toBeGreaterThan(numero.x);
    expect(Math.abs(serie.y - numero.y)).toBeLessThanOrEqual(2);

    // A data de emissão carrega a frase que ensina a regra ("não é ela que
    // decide o ano do custo") — fica em linha própria, largura inteira.
    const emissao = (await page.getByLabel("Data de emissão").boundingBox())!;
    expect(emissao.y).toBeGreaterThan(numero.y);
    expect(emissao.width).toBeGreaterThan(COLUNA_DO_FORMULARIO_CONTEUDO_PX * 0.8);
  });

  /** Critério 4 — as três portas legíveis, não esticadas. */
  test("o hub mostra as três portas lado a lado", async ({ page }) => {
    await page.goto("/adicionar");
    const portas = page.locator("main").getByRole("link");
    await expect(portas).toHaveCount(3);

    const caixas = await portas.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
      }),
    );
    expect(new Set(caixas.map((c) => c.y)).size).toBe(1);
    expect(caixas[0].x).toBeLessThan(caixas[1].x);
    expect(caixas[1].x).toBeLessThan(caixas[2].x);
    // Esticado seria uma porta ocupando a casca inteira.
    for (const c of caixas) expect(c.w).toBeLessThan(LARGURA_DA_CASCA_LARGA / 2);
  });

  /**
   * **Critério 8 / Pre-mortem 3 — a saída do fluxo não deixa ninguém sem
   * chrome.** Percorre o caminho inteiro na janela larga: dashboard → "+ Novo
   * registro" → formulário (que faz takeover de tela cheia, sem sidebar) →
   * "Salvar" → confirmação → "Voltar ao início", que devolve ao shell.
   *
   * É também a única prova de que o formulário em tela larga SALVA — o reflow
   * mexeu na árvore de JSX, e layout que grava errado é pior que layout feio.
   */
  test("o fluxo fecha de volta no shell de gestão", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Custo em risco no IR")).toBeVisible();

    await page.getByRole("button", { name: "+ Novo registro" }).click();
    await page
      .getByRole("menuitem", { name: /Documento — PDF, XML ou foto/ })
      .click();

    // Takeover de tela cheia: o shell some ao entrar na captura.
    await expect(
      page.getByRole("heading", { name: "Registrar documento" }),
    ).toBeVisible();
    await expect(page.locator('[data-shell="sidebar"]')).toHaveCount(0);

    await page.getByLabel("Arquivo").setInputFiles({
      name: "nf-material.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 contai 047"),
    });
    await page
      .getByRole("group", { name: "Tipo" })
      .getByText("NF material", { exact: true })
      .click();
    await page.getByLabel("Número da nota").fill("2047");
    await page.getByLabel("Data de emissão").fill(`${ANO}-03-12`);
    await page.getByLabel("Emitente", { exact: true }).fill("Casa do Construtor");
    await page.getByLabel("CNPJ / CPF do emitente").fill(CNPJ_CASA);
    await page.getByLabel("Valor").fill("4.850,00");
    await page
      .getByRole("group", { name: "A nota está no seu CPF?" })
      .getByText("Sim", { exact: true })
      .click();

    await page.getByRole("button", { name: "Salvar registro" }).click();

    await expect(
      page.getByRole("heading", { name: "Registrado ✓" }),
    ).toBeVisible({ timeout: 20_000 });

    // A saída do fluxo é um LINK para uma rota real, e ela abre com o shell.
    const voltar = page.getByRole("link", { name: "Voltar ao início" });
    await expect(voltar).toHaveAttribute("href", "/");
    await voltar.click();
    await expect(page.locator('[data-shell="sidebar"]')).toBeVisible();
  });
});

/**
 * **Critério 6 / Pre-mortem 4 — `/entrar` NÃO herda a largura nova.**
 *
 * Login esticado numa tela larga é regressão visual, não ganho: são três campos
 * e um botão. O wrapper de 430px vive na própria rota, e é esta asserção que
 * impede o breakpoint do grupo de vazar para ela numa próxima rodada.
 */
test.describe("login em tela larga", () => {
  test.use({ sessao: false });

  test("a tela de entrar se autolimita a 430px", async ({ page }) => {
    await page.goto("/entrar");
    await expect(page.getByLabel("Seu e-mail")).toBeVisible();

    const coluna = page.locator("main").locator("xpath=ancestor::div[1]");
    expect(Math.round((await coluna.boundingBox())!.width)).toBe(430);
  });
});
