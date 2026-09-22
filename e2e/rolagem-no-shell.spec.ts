import type { Page } from "@playwright/test";

import { OBRA_ID_SEED, USER_ID_SEED } from "./ambiente";
import { criarAnexoDeDesembolso, criarDesembolsoTerreno, type Db } from "./banco";
import { expect, test } from "./fixtures";

/**
 * **A rolagem do shell de gestão na faixa estreita — regressão de 2026-09-22.**
 *
 * O Mateus não conseguia registrar um desembolso do terreno numa janela de
 * ~575px: a página parava de rolar ~200px ANTES do fim do conteúdo, o último
 * card ficava cortado no meio, vinha um vazio enorme em branco, e a seção
 * "Registrar um desembolso" inteira — valor, tipo e o botão de gravar — nunca
 * aparecia. Formulário inalcançável, não feio.
 *
 * **Duas causas somadas, as duas invisíveis em tela larga** (por isso
 * atravessaram os CONTAI-043 a 046, todos revisados no desktop):
 *
 * 1. A coluna de conteúdo do shell nascia com o `min-height: auto` que todo
 *    item de flex ganha por padrão — ela não podia encolher abaixo do próprio
 *    conteúdo, então crescia para os ~1600px do formulário em vez de parar no
 *    `h-dvh`, e o `overflow-y-auto` do `<main>` ficava sem nada para rolar
 *    (`scrollHeight === clientHeight`). Em `lg` a coluna é item no eixo
 *    TRANSVERSAL da linha, onde o `stretch` já a limita: nada a ver.
 * 2. O rádio `sr-only` de `Escolha` é `position: absolute` e não tinha
 *    ancestral posicionado, então o bloco contêiner dele virava o INICIAL: ele
 *    escapava do `overflow-hidden` do shell e esticava o DOCUMENTO até a
 *    posição estática dele — a rolagem fantasma que produzia o vazio branco.
 *
 * **O que estes testes afirmam, e por que a geometria e não o locator.** Um
 * `click()` do Playwright rola o elemento para dentro da vista sozinho: ele
 * passava verde com o bug de pé, porque o runner alcança o que o dedo não
 * alcança. A asserção tem de ser sobre QUEM ROLA — a página nunca, o `<main>`
 * sempre — e sobre o rodapé caber na janela depois de rolar até o fim.
 */

/** Mede quem rola e onde o rodapé para, depois de rolar o `main` até o fim. */
async function geometria(page: Page) {
  return page.evaluate(async () => {
    const de = document.documentElement;
    const main = document.querySelector("main");
    if (!main) throw new Error("shell de gestão sem <main>");

    main.scrollTop = main.scrollHeight;
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const rodape = document.querySelector('[data-rodape="acao"]');
    const caixa = rodape?.getBoundingClientRect() ?? null;
    return {
      janela: de.clientHeight,
      paginaRola: de.scrollHeight > de.clientHeight + 1,
      mainRola: main.scrollHeight > main.clientHeight + 1,
      fimDoMainAlcancado:
        Math.round(main.scrollTop + main.clientHeight) >= main.scrollHeight - 2,
      rodape: caixa
        ? { topo: Math.round(caixa.top), base: Math.round(caixa.bottom) }
        : null,
    };
  });
}

/**
 * Conteúdo suficiente para exigir rolagem em 375×812: dois desembolsos com
 * papéis pendurados. Menos que isto cabe na janela e o teste passaria sem
 * exercitar nada.
 */
async function terrenoComDoisDesembolsos(db: Db) {
  const entrada = await criarDesembolsoTerreno(db, {
    tipo: "entrada",
    valor: 85000,
    data_pagamento: "2025-03-10",
    estado: "pago",
    origem_recurso: "proprio",
  });
  const itbi = await criarDesembolsoTerreno(db, {
    tipo: "itbi",
    valor: 4200,
    data_pagamento: "2025-04-22",
    estado: "pago",
    origem_recurso: "proprio",
  });
  for (const [desembolso_id, arquivo] of [
    [entrada, "comprovante-entrada-terreno.pdf"],
    [entrada, "contrato-compra-venda.pdf"],
    [itbi, "guia-itbi-paga.jpeg"],
  ] as const) {
    await criarAnexoDeDesembolso(db, {
      desembolso_id,
      arquivo_path: `${USER_ID_SEED}/${arquivo}`,
      papel: "comprovante",
    });
  }
}

test.describe("rolagem do shell de gestão na faixa estreita", () => {
  test("desembolsos do terreno: quem rola é o main, e o rodapé de gravar cabe na janela", async ({
    page,
    db,
  }) => {
    await terrenoComDoisDesembolsos(db);
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);
    await expect(page.locator("[data-gravar]")).toBeVisible();

    const g = await geometria(page);

    // 1. A página NÃO rola: o shell é `h-dvh` e a rolagem é do `main`. Página
    //    rolando aqui significa conteúdo (ou fantasma) vazando do `h-dvh`.
    expect(g.paginaRola, "a página (html) não pode rolar dentro do shell").toBe(
      false,
    );
    // 2. O `main` rola: com dois desembolsos o conteúdo não cabe em 812px.
    //    Se ele não rolar, ou o cenário encolheu ou o `min-h-0` sumiu.
    expect(g.mainRola, "o <main> tem de ser o rolável").toBe(true);
    expect(g.fimDoMainAlcancado).toBe(true);
    // 3. E o rodapé — o formulário inteiro — cabe na janela no fim da rolagem.
    expect(g.rodape).not.toBeNull();
    expect(g.rodape!.base).toBeLessThanOrEqual(g.janela + 1);
    expect(g.rodape!.topo).toBeGreaterThanOrEqual(0);
  });

  test("o formulário de registrar desembolso é alcançável rolando o main", async ({
    page,
    db,
  }) => {
    await terrenoComDoisDesembolsos(db);
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);

    // Rola como o dedo rola — sem o `scrollIntoView` automático do runner,
    // que alcançava o que o dedo não alcançava e por isso deixou o bug passar.
    await page.evaluate(() => {
      const main = document.querySelector("main")!;
      main.scrollTop = main.scrollHeight;
    });
    // O botão de gravar é o fim da tela: no bug ele parava ~200px ABAIXO do
    // ponto em que a rolagem travava.
    await expect(page.locator("[data-gravar]")).toBeInViewport();

    // E os campos do "Registrar um desembolso" — a seção que simplesmente não
    // existia para o Mateus — chegam à vista pelo scroller da própria página.
    for (const campo of ["fTipo", "fValor", "fEstado"]) {
      await page.evaluate((c) => {
        document
          .querySelector(`[data-campo="${c}"]`)
          ?.scrollIntoView({ block: "center" });
      }, campo);
      await expect(page.locator(`[data-campo="${campo}"]`)).toBeInViewport();
    }
  });

  test("o rádio sr-only de Escolha não estica o documento", async ({
    page,
    db,
  }) => {
    await terrenoComDoisDesembolsos(db);
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);
    await expect(page.locator("[data-gravar]")).toBeVisible();

    // O rádio é `position: absolute`; sem ancestral posicionado ele se
    // posiciona contra o bloco contêiner INICIAL, escapa do `overflow-hidden`
    // e vira altura de documento que ninguém vê — o vazio branco do relato.
    const fora = await page.evaluate(() => {
      const de = document.documentElement;
      const soltos: string[] = [];
      for (const el of document.querySelectorAll("input.sr-only")) {
        // `offsetParent` é o bloco contêiner efetivo. `null` ou `<body>` quer
        // dizer "nenhum ancestral posicionado" — exatamente o rádio que
        // escapava do recorte. Onde ele está na vertical não importa: dentro
        // do `main` rolável, estar fora da janela é normal e recortado.
        const pai = (el as HTMLElement).offsetParent;
        if (pai === null || pai === document.body) {
          const base = Math.round(el.getBoundingClientRect().bottom);
          soltos.push(`${el.getAttribute("value") ?? "?"} @ ${base}`);
        }
      }
      return { soltos, alturaDoDocumento: de.scrollHeight, janela: de.clientHeight };
    });

    expect(fora.soltos, "rádio sr-only sem ancestral posicionado").toEqual([]);
    expect(fora.alturaDoDocumento).toBeLessThanOrEqual(fora.janela + 1);
  });

  test("cadastro da obra: mesma geometria, mesmo rodapé alcançável", async ({
    page,
  }) => {
    await page.goto(`/obras/${OBRA_ID_SEED}`);
    await expect(page.locator('[data-rodape="acao"]')).toBeVisible();

    const g = await geometria(page);

    expect(g.paginaRola, "a página (html) não pode rolar dentro do shell").toBe(
      false,
    );
    expect(g.rodape).not.toBeNull();
    expect(g.rodape!.base).toBeLessThanOrEqual(g.janela + 1);
  });
});
