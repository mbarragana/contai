import type { Page } from "@playwright/test";

import { USER_ID_SEED } from "./ambiente";
import { criarDocumento, criarFavorecido, criarPagamento } from "./banco";
import { expect, test } from "./fixtures";

/**
 * CONTAI-039 — a home em `lg` (1280×800), cenário de GESTÃO: em casa,
 * sentado, com calma (`CLAUDE.md`, correção de 2026-08-18).
 *
 * ⚠️ **UM teste, de LAYOUT.** Comportamento — o que cada pendência diz, o que
 * cada número vale, o que grava no banco — já é provado no projeto `mobile`,
 * que roda no piso de 375px. Duplicar a suíte aqui dobraria o custo da suíte
 * para provar duas vezes a mesma coisa; o que só este projeto pode provar é a
 * disposição em duas colunas, e é só isso que ele afirma.
 *
 * O que ele trava, em ordem (critério 11 do ticket):
 * (a) o `<aside>` existe e está `sticky` — a régua de posição fiscal não sai
 *     da tela quando a fila rola;
 * (b) os QUATRO blocos da régua estão dentro dele, NOMEADOS um a um — um
 *     teste que só confere "existe aside" passaria com `CardAfericaoInss`
 *     perdido num refactor (Pre-mortem 4);
 * (c) a fila é grid de 2 colunas E a ordem visual é a ordem do DOM — que é a
 *     ordem FISCAL de gravidade. `order` ou `grid-auto-flow: dense` fariam a
 *     tela mentir sobre a fila com o DOM certo (Pre-mortem 1);
 * (d) nenhum texto fica cortado — `Consequencia` que perde legibilidade é
 *     pendência que perde superfície (D46/D47, critério 9).
 */

const ANO = new Date().getFullYear();

const CNPJ_AJE_DIGITOS = "11222333000181";
const CNPJ_CASA_DIGITOS = "11444777000161";

/**
 * Largura da casca do app (`app/layout.tsx`), que é quem `data-largo` abre.
 *
 * Pela ANCESTRAL do `<main>`, e não por `body > div`: o Next planta um div
 * próprio (vazio, 0px) antes da casca, e medi-lo daria 0 sem dizer por quê.
 */
function casca(page: Page) {
  return page.locator("main").locator("xpath=ancestor::div[1]");
}

async function larguraDaCasca(page: Page) {
  return Math.round((await casca(page).boundingBox())!.width);
}

/** Caixas dos filhos DIRETOS da fila, na ordem do DOM, sem os que somem. */
async function caixasDaFila(page: Page) {
  return page.evaluate(() => {
    const secao = document.querySelector("[data-secao]");
    if (!secao) return [];
    const caixas: { x: number; y: number; largura: number; texto: string }[] =
      [];
    for (const filho of secao.children) {
      const r = filho.getBoundingClientRect();
      // `Faixa` vazia (aviso de equiparação fora do caso, agenda vazia) não
      // existe no layout — pular é o certo, não falhar.
      if (r.width === 0 && r.height === 0) continue;
      caixas.push({
        x: Math.round(r.x),
        y: Math.round(r.y),
        largura: Math.round(r.width),
        texto: (filho.textContent ?? "").slice(0, 60),
      });
    }
    return caixas;
  });
}

test.describe("home no desktop (lg)", () => {
  test("régua fiscal fixa à esquerda, fila de trabalho em duas colunas", async ({
    page,
    db,
  }) => {
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

    // Quatro pendências de naturezas diferentes: é delas que sai a fila com
    // cards suficientes para duas colunas terem o que provar.
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
    // INSS em base — sem este documento o quarto bloco da régua não existe.
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

    await page.goto("/");
    await expect(page.getByText("Custo em risco no IR")).toBeVisible();

    // ── (a) a régua não sai da tela ──────────────────────────────────────
    const aside = page.locator("main > aside");
    await expect(aside).toBeVisible();
    expect(
      await aside.evaluate((el) => getComputedStyle(el).position),
    ).toBe("sticky");
    // 400px: o número do spec de design, de onde saem também o
    // `lg:max-w-[1280px]` da casca e o espaçador da `BarraAdicionar`.
    expect((await aside.boundingBox())!.width).toBe(400);

    // ── (b) os QUATRO blocos, nomeados um a um ───────────────────────────
    await expect(aside.getByText("Obra aberta")).toBeVisible();
    await expect(aside.getByText("Casa Cachoeira").first()).toBeVisible();
    await expect(
      aside.getByText(`Custo confirmado em ${ANO} · Casa Cachoeira`),
    ).toBeVisible();
    await expect(aside.locator("[data-custo-em-risco]")).toHaveCount(1);
    await expect(aside.locator("[data-afericao-inss]")).toHaveCount(1);
    // E a fila NÃO tem cópia nenhuma deles: régua e fila são disjuntas.
    const fila = page.locator("[data-secao]");
    await expect(fila.locator("[data-custo-em-risco]")).toHaveCount(0);
    await expect(fila.locator("[data-afericao-inss]")).toHaveCount(0);

    // ── (c) duas colunas, e a ordem visual é a do DOM ────────────────────
    const caixas = await caixasDaFila(page);
    expect(caixas.length).toBeGreaterThan(4);

    const colunas = new Set(caixas.map((c) => c.x));
    expect(colunas.size).toBe(2);

    // Pelo menos um par lado a lado — senão "grid de 2 colunas" seria só uma
    // classe no HTML, com tudo empilhado numa coluna só.
    const ladoALado = caixas.filter((c, i) => {
      const anterior = caixas[i - 1];
      return i > 0 && Math.abs(c.y - anterior.y) <= 1 && c.x > anterior.x;
    });
    expect(ladoALado.length).toBeGreaterThan(0);

    // ⚠️ A guarda contra `order`/`dense`: percorrendo os filhos na ordem do
    // DOM, nenhum pode aparecer ACIMA do anterior, e dois na mesma linha têm
    // de vir da esquerda para a direita. A ordem da fila é a ordem de
    // gravidade decidida tela a tela — se ela e a ordem visual divergirem, a
    // tela mente sobre a fila.
    const foraDeOrdem = caixas.filter((c, i) => {
      if (i === 0) return false;
      const anterior = caixas[i - 1];
      if (c.y < anterior.y - 1) return true;
      return Math.abs(c.y - anterior.y) <= 1 && c.x < anterior.x;
    });
    expect(foraDeOrdem).toEqual([]);

    // Cada coluna da fila fica na largura do card que o mobile já tuna (~398px
    // contra os 394px de hoje) — o ponto do 1280 em vez de 1120.
    const largurasDeUmaColuna = caixas
      .filter((c) => ladoALado.some((l) => l.y === c.y))
      .map((c) => c.largura);
    for (const largura of largurasDeUmaColuna) {
      expect(largura).toBeGreaterThanOrEqual(380);
    }

    // ── (d) nada cortado ─────────────────────────────────────────────────
    const cortados = await page.evaluate(() => {
      const fora: string[] = [];
      for (const el of document.querySelectorAll("main p")) {
        // +1 de folga: `scrollWidth`/`clientWidth` são inteiros arredondados
        // e um card de largura fracionária acusaria corte que não existe.
        if (el.scrollWidth > el.clientWidth + 1) {
          fora.push((el.textContent ?? "").slice(0, 80));
        }
      }
      return fora;
    });
    expect(cortados).toEqual([]);

    // E a tela inteira não rola na horizontal: `Consequencia` inteira dentro
    // de um card que vaza para fora da viewport não está legível coisa
    // nenhuma.
    const vazamento = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      return main.scrollWidth - main.clientWidth;
    });
    expect(vazamento).toBeLessThanOrEqual(1);

    // ── Critério 10 · "+ Adicionar" pertence à FILA, não à régua ─────────
    const botao = page.getByRole("link", { name: "+ Adicionar" });
    const caixaDoBotao = (await botao.boundingBox())!;
    expect(Math.round(caixaDoBotao.x)).toBe(caixas[0].x);

    // ── O defeito que o Gate 2 mediu: régua mais alta que a viewport ─────
    //
    // ⚠️ 1111px de régua contra 654px de viewport útil em 1280×800, JÁ no
    // cenário mínimo deste teste. Pregada pelo `sticky` e sem scroll próprio,
    // a régua deixava ~457px embaixo — `CardAfericaoInss` e parte do
    // `CardCustoEmRisco` — INALCANÇÁVEIS enquanto a fila rolasse. Pendência
    // que não se alcança é pendência sem superfície (D46/D47).
    expect(await aside.evaluate((el) => getComputedStyle(el).overflowY)).toBe(
      "auto",
    );
    // `max-h-full`, não `100dvh`: a régua nunca passa da altura do `main` —
    // com `dvh` ela ignoraria `AppBar` e `Rodape` e sobraria por baixo deles.
    const alturas = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      const regua = document.querySelector("main > aside")!;
      return {
        regua: regua.getBoundingClientRect().height,
        main: main.clientHeight,
      };
    });
    expect(alturas.regua).toBeLessThanOrEqual(alturas.main);

    // ⚠️ `toBeInViewport` e NÃO `toBeVisible`: o card empurrado para fora da
    // área visível do aside continua "visível" para o Playwright — tem caixa,
    // não está `hidden`. O que se quer provar é que ele é ALCANÇÁVEL.
    const inss = aside.locator("[data-afericao-inss]");
    await inss.scrollIntoViewIfNeeded();
    await expect(inss).toBeInViewport();
  });

  /**
   * A outra metade do Gate 2: a casca larga é **opt-in**. Sem `data-largo`,
   * toda tela fica nos 430px de sempre — medido no review que esticá-las a
   * ~1244px em coluna única deixava o texto de `Consequencia` MENOS legível
   * que hoje, e texto fiscal perdendo legibilidade é regressão.
   *
   * Uma tela de CAPTURA (o Teste do Canteiro, que este ticket não toca) e uma
   * de gestão que usa `BarraAdicionar` sem régua nenhuma do lado — é nela que
   * o espaçador de 400px estouraria o rodapé de 430px.
   */
  test("sem `data-largo`, a casca continua em 430px e o rodapé não abre buraco", async ({
    page,
  }) => {
    await page.goto("/adicionar/pagamento");
    await expect(
      page.getByRole("heading", { name: "Registrar pagamento" }),
    ).toBeVisible();
    await expect(page.locator("[data-largo]")).toHaveCount(0);
    expect(await larguraDaCasca(page)).toBe(430);

    await page.goto("/pendencias");
    await expect(page.locator("[data-largo]")).toHaveCount(0);
    expect(await larguraDaCasca(page)).toBe(430);

    // O espaçador de 400px da home não existe aqui: o botão cabe dentro da
    // casca estreita, como antes do CONTAI-039.
    const caixaDaCasca = (await casca(page).boundingBox())!;
    const botao = (await page
      .getByRole("link", { name: "+ Adicionar" })
      .boundingBox())!;
    expect(botao.x).toBeGreaterThanOrEqual(caixaDaCasca.x);
    expect(botao.x + botao.width).toBeLessThanOrEqual(
      caixaDaCasca.x + caixaDaCasca.width,
    );
  });
});
