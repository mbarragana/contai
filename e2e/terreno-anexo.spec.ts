import type { Locator, Page } from "@playwright/test";

import { OBRA_ID_SEED } from "./ambiente";
import {
  anexosDeDesembolso,
  arquivosNoAcervo,
  criarAnexoDeDesembolso,
  criarDesembolsoTerreno,
  desembolsosTerreno,
  plantarDesembolsoDeOutroDono,
  subirParaOAcervo,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * CONTAI-027, rodada 2 — **N papéis por desembolso do terreno** (dor D37) e a
 * pergunta binária do critério 12, contra o Postgres e o Storage LOCAIS.
 *
 * A pergunta que estes testes respondem não é "a tela mostra?" — é **"o que
 * entrou no banco?"**: é o estado gravado que vira situação em 31/12 na ficha
 * Bens e Direitos, e a resposta do critério 12 é ela própria um fato fiscal
 * (critério 12b, §4d do parecer: sem rastro, o "sim" É o erro invisível).
 *
 * ⚠️ **O critério 13 está CORTADO** (§3 do parecer de 2026-08-21). Nenhum teste
 * daqui exercita bloqueio de saída anual, porque não existe bloqueio nenhum, e
 * **nenhuma tela promete a terceira superfície** (a lista de revisão
 * pré-declaração é da US-004).
 *
 * ⚠️ `getByRole(..., { name })` sem `exact: true` casa por SUBSTRING. Todo
 * locator aqui usa `exact: true`.
 */

const ANO = new Date().getFullYear();
const DATA = `${ANO}-08-12`;
/** A primeira opção da pergunta do §4a, com a data no próprio botão. */
const TUDO_EM = `Tudo em ${DATA.split("-").reverse().join("/")}`;

function pdf(nome: string) {
  return {
    name: nome,
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4 ${nome}`),
  };
}

/** O papel escolhido + a resposta do que ele é (critério 14, sem default). */
async function anexar(
  dentro: Locator,
  rotuloDoCampo: string,
  nome: string,
  papel: "Comprovante do pagamento" | "Nota ou recibo" | "Contrato ou escritura",
) {
  await dentro
    .getByLabel(rotuloDoCampo, { exact: true })
    .setInputFiles(pdf(nome));
  await dentro
    .locator(`[data-anexo-novo="${nome}"]`)
    .getByRole("group", { name: "O que é este papel?" })
    .getByText(papel, { exact: true })
    .click();
}

/** O formulário de desembolso novo, até a linha do anexo. */
async function preencherDesembolso(page: Page, valor: string, data = DATA) {
  await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);
  await page
    .getByRole("group", { name: "O que é este desembolso?" })
    .getByText("Entrada", { exact: true })
    .click();
  await page.getByLabel("Valor", { exact: true }).fill(valor);
  await page
    .getByRole("group", { name: "Este valor já foi pago?" })
    .getByText("Já paguei", { exact: true })
    .click();
  await page
    .getByLabel("Data em que saiu da conta", { exact: true })
    .fill(data);
}

const pergunta = (page: Page) => page.locator('[data-pergunta="quando-saiu"]');
/**
 * ⚠️ **O rótulo do Gravar deixou de ser fixo no CONTAI-025**: ele nomeia a
 * consequência do que está faltando (Gate Fiscal §4), e por isso o locator é o
 * `data-gravar` do rodapé — o rótulo em si é asserção de teste, não âncora.
 */
const gravar = (page: Page) => page.locator("[data-gravar]");


// ══ Critério 8 — o caminho de captura NÃO alonga ════════════════════════

test.describe("um papel só: os passos de hoje (critério 8)", () => {
  test("com UM comprovante a pergunta do critério 12 nunca aparece", async ({
    page,
    db,
  }) => {
    await preencherDesembolso(page, "60.000,00");
    await anexar(
      page.locator("body"),
      "Papéis deste desembolso",
      "pix.pdf",
      "Comprovante do pagamento",
    );

    // ⚠️ Uma tela, um Gravar. Nenhuma confirmação nova, nenhuma navegação
    // nova, nenhuma pergunta nova.
    await expect(pergunta(page)).toHaveCount(0);
    await gravar(page).click();
    await expect(page.getByText("registrado no custo de")).toBeVisible();

    const [gravado] = await desembolsosTerreno(db);
    expect(gravado.debitos_mesmo_dia).toBeNull();
    expect(gravado.debitos_mesmo_dia_respondido_em).toBeNull();
    expect(await anexosDeDesembolso(db)).toHaveLength(1);
  });

  test("comprovante + recibo são DOIS papéis e UM débito: não pergunta", async ({
    page,
    db,
  }) => {
    // §6 do parecer: "pergunta de resposta óbvia treina o clique automático que
    // esvazia a pergunta que importa". A régua é o PAPEL, nunca a contagem de
    // arquivos.
    await preencherDesembolso(page, "60.000,00");
    const corpo = page.locator("body");
    await anexar(corpo, "Papéis deste desembolso", "pix.pdf", "Comprovante do pagamento");
    await anexar(corpo, "Papéis deste desembolso", "recibo.pdf", "Nota ou recibo");

    await expect(pergunta(page)).toHaveCount(0);
    await gravar(page).click();
    await expect(page.getByText("registrado no custo de")).toBeVisible();

    const [gravado] = await desembolsosTerreno(db);
    expect(gravado.debitos_mesmo_dia).toBeNull();
    const papeis = await anexosDeDesembolso(db);
    expect(papeis.map((p) => p.papel).sort()).toEqual(["comprovante", "nota"]);
  });

  test("o papel sem resposta NÃO grava — `papel` é obrigatório e sem default", async ({
    page,
    db,
  }) => {
    // ⚠️ Critério 5 do CONTAI-025: **zero papel grava; papel sem classificação,
    // não.** O critério 14 do CONTAI-027 não foi tocado — e o botão diz QUAL
    // falta, porque botão cinza mudo faz achar que quebrou.
    await preencherDesembolso(page, "60.000,00");
    await page
      .getByLabel("Papéis deste desembolso", { exact: true })
      .setInputFiles(pdf("pix.pdf"));

    await expect(gravar(page)).toHaveText(
      "Diga o que é o papel que falta para gravar",
    );
    await expect(gravar(page)).toBeDisabled();
    expect(await desembolsosTerreno(db)).toHaveLength(0);
    expect(await anexosDeDesembolso(db)).toHaveLength(0);
  });

  test("'Tirar da lista' só existe ANTES do Gravar — nada subiu ainda", async ({
    page,
    db,
  }) => {
    // Depois de gravado o acervo só cresce: `terreno_desembolso_anexo` não tem
    // DELETE para `authenticated` (migration 0010). Tirar da lista aqui não
    // apaga nada — o arquivo nunca chegou ao bucket.
    await preencherDesembolso(page, "60.000,00");
    const corpo = page.locator("body");
    await anexar(corpo, "Papéis deste desembolso", "pix.pdf", "Comprovante do pagamento");
    await anexar(corpo, "Papéis deste desembolso", "errado.pdf", "Nota ou recibo");

    await page
      .locator('[data-anexo-novo="errado.pdf"]')
      .getByRole("button", { name: "Tirar da lista", exact: true })
      .click();
    await expect(page.locator('[data-anexo-novo="errado.pdf"]')).toHaveCount(0);

    await gravar(page).click();
    await expect(page.getByText("registrado no custo de")).toBeVisible();

    const papeis = await anexosDeDesembolso(db);
    expect(papeis).toHaveLength(1);
    expect(papeis[0].papel).toBe("comprovante");
    // ⚠️ E o arquivo tirado da lista NÃO foi para o acervo: o upload só
    // acontece no Gravar. (Conta não serve: o bucket não é limpo entre testes
    // — a 0002 não tem policy de delete. Quem zera é o `db reset`.)
    const noAcervo = await arquivosNoAcervo(db, "terreno");
    expect(noAcervo.some((n) => n.endsWith("errado.pdf"))).toBe(false);
    expect(noAcervo.some((n) => n.endsWith("pix.pdf"))).toBe(true);
  });
});

// ══ Critério 12 — a pergunta, e as duas respostas ═══════════════════════

test.describe("dois comprovantes: a pergunta do critério 12", () => {
  async function doisComprovantes(page: Page) {
    await preencherDesembolso(page, "60.000,00");
    const corpo = page.locator("body");
    await anexar(corpo, "Papéis deste desembolso", "pix-1.pdf", "Comprovante do pagamento");
    await anexar(corpo, "Papéis deste desembolso", "pix-2.pdf", "Comprovante do pagamento");
  }

  test("a pergunta aparece, é obrigatória e NADA nasce pré-marcado", async ({
    page,
    db,
  }) => {
    await doisComprovantes(page);
    await expect(pergunta(page)).toBeVisible();
    await expect(
      pergunta(page).getByText("Quando esse dinheiro saiu da sua conta?", {
        exact: true,
      }),
    ).toBeVisible();
    // Sem default e sem pré-seleção (critério 12).
    await expect(pergunta(page).locator("input[type=radio]:checked")).toHaveCount(
      0,
    );

    // Sem responder, não grava — e o fato não se perde: ele continua na tela.
    await gravar(page).click();
    await expect(
      page.getByText("Responda quando esse dinheiro saiu da sua conta."),
    ).toBeVisible();
    expect(await desembolsosTerreno(db)).toHaveLength(0);
  });

  test("'Em mais de um dia' GRAVA assim mesmo e abre a pendência", async ({
    page,
    db,
  }) => {
    // Adendo 2 do parecer de 18/08: "nunca recuse o registro de um fato
    // consumado". O dinheiro saiu; o app registra e nomeia o problema.
    await doisComprovantes(page);
    await pergunta(page).getByText("Em mais de um dia", { exact: true }).click();
    await gravar(page).click();
    await expect(page.getByText("registrado no custo de")).toBeVisible();

    const [gravado] = await desembolsosTerreno(db);
    expect(gravado.debitos_mesmo_dia).toBe(false);
    // Critério 12b: a resposta se grava COM a data em que foi dada.
    expect(gravado.debitos_mesmo_dia_respondido_em).not.toBeNull();
    // Critério 8: os DOIS papéis entraram, num ato só.
    expect(await anexosDeDesembolso(db)).toHaveLength(2);
  });

  test("⚠️ 'Tudo em [data]' também deixa RASTRO — o 'sim' não é a ausência de pendência", async ({
    page,
    db,
  }) => {
    // §4d: sem rastro, em 2034 ninguém distingue "ele afirmou que foi tudo no
    // mesmo dia" de "ninguém perguntou". A primeira é declaração do
    // contribuinte; a segunda é lacuna do sistema.
    await doisComprovantes(page);
    await pergunta(page)
      .getByText("Tudo em 12/08/" + ANO, { exact: true })
      .click();
    await gravar(page).click();
    await expect(page.getByText("registrado no custo de")).toBeVisible();

    const [gravado] = await desembolsosTerreno(db);
    expect(gravado.debitos_mesmo_dia).toBe(true);
    expect(gravado.debitos_mesmo_dia_respondido_em).not.toBeNull();
  });
});

// ══ Critério 12a e 12c — a pendência, nas duas superfícies que existem ══

test.describe("a pendência 'um lançamento, mais de uma data'", () => {
  async function comPendencia(db: Db) {
    const id = await criarDesembolsoTerreno(db, {
      tipo: "entrada",
      valor: 60000,
      estado: "pago",
      data_pagamento: DATA,
      debitos_mesmo_dia: false,
    });
    for (const nome of ["pix-1", "pix-2"]) {
      await criarAnexoDeDesembolso(db, {
        desembolso_id: id,
        arquivo_path: await subirParaOAcervo(db, "terreno", `${nome}.txt`, nome),
        papel: "comprovante",
      });
    }
    return id;
  }

  test("no CARD do desembolso, com a SEGUNDA METADE da ação nomeada", async ({
    page,
    db,
  }) => {
    await comPendencia(db);
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno`);

    const cartao = page.locator('[data-pendencia="terreno-mais-de-uma-data"]');
    await expect(cartao).toBeVisible();
    await expect(
      cartao.getByText("Um lançamento, mais de uma data", { exact: true }),
    ).toBeVisible();
    await expect(cartao).toContainText(
      "É a data do pagamento que decide o ano do custo",
    );
    // ⚠️ Sem esta metade, cumprir a primeira SOMA O VALOR DUAS VEZES no custo
    // do terreno — o pior dos dois erros simétricos (§4b).
    await expect(cartao).toContainText(
      "Não registre os lançamentos separados antes disso",
    );
    await expect(cartao).toContainText("os novos somam por cima");
    // ❌ Sem "ok, entendi": não se dispensa, não se adia, não se esconde.
    await expect(
      cartao.getByRole("button", { name: "Ok, entendi", exact: true }),
    ).toHaveCount(0);
  });

  test("na HOME — e nenhuma tela promete a terceira superfície", async ({
    page,
    db,
  }) => {
    await comPendencia(db);
    await page.goto("/");

    const cartao = page.locator('[data-pendencia="terreno-mais-de-uma-data"]');
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText(
      "Não registre os lançamentos separados antes disso",
    );
    // A lista de revisão pré-declaração é da US-004: enquanto ela não existir,
    // nada aqui a promete.
    await expect(page.getByText("revisão pré-declaração")).toHaveCount(0);
  });
});

// ══ Critério 9b — o papel que chega DEPOIS ══════════════════════════════

test.describe("anexar papel depois, sem tela nova (critério 9b)", () => {
  async function comUmComprovante(db: Db) {
    const id = await criarDesembolsoTerreno(db, {
      tipo: "entrada",
      valor: 60000,
      estado: "pago",
      data_pagamento: DATA,
    });
    await criarAnexoDeDesembolso(db, {
      desembolso_id: id,
      arquivo_path: await subirParaOAcervo(db, "terreno", "pix-1.txt", "pix 1"),
      papel: "comprovante",
    });
    return id;
  }

  test("o recibo que chega dias depois é ACRÉSCIMO, e não pergunta nada", async ({
    page,
    db,
  }) => {
    const id = await comUmComprovante(db);
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);

    const cartao = page.locator(`[data-desembolso-gravado="${id}"]`);
    await cartao
      .getByRole("button", { name: "Anexar um papel", exact: true })
      .click();
    await anexar(cartao, "Anexar papel", "recibo.pdf", "Nota ou recibo");
    await expect(pergunta(page)).toHaveCount(0);
    await cartao
      .getByRole("button", { name: "Gravar o papel", exact: true })
      .click();
    await expect(page.getByText("Papel anexado")).toBeVisible();

    const papeis = await anexosDeDesembolso(db);
    // ⚠️ INSERT, nunca substituição: o primeiro papel continua lá.
    expect(papeis).toHaveLength(2);
    expect(papeis.map((p) => p.papel)).toEqual(["comprovante", "nota"]);
    const [gravado] = await desembolsosTerreno(db);
    expect(gravado.debitos_mesmo_dia).toBeNull();
  });

  test("o SEGUNDO comprovante dispara a pergunta ali mesmo, dias depois", async ({
    page,
    db,
  }) => {
    const id = await comUmComprovante(db);
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);

    const cartao = page.locator(`[data-desembolso-gravado="${id}"]`);
    await cartao
      .getByRole("button", { name: "Anexar um papel", exact: true })
      .click();
    await anexar(cartao, "Anexar papel", "pix-2.pdf", "Comprovante do pagamento");

    await expect(pergunta(page)).toBeVisible();
    await pergunta(page).getByText("Em mais de um dia", { exact: true }).click();
    await cartao
      .getByRole("button", { name: "Gravar o papel", exact: true })
      .click();
    await expect(page.getByText("Papel anexado")).toBeVisible();

    expect(await anexosDeDesembolso(db)).toHaveLength(2);
    const [gravado] = await desembolsosTerreno(db);
    expect(gravado.debitos_mesmo_dia).toBe(false);
    expect(gravado.debitos_mesmo_dia_respondido_em).not.toBeNull();
  });

  test("⚠️ a resposta 'tudo no mesmo dia' é REPERGUNTADA quando chega comprovante novo", async ({
    page,
    db,
  }) => {
    // §6: "o fato mudou, e o app não carrega adiante um 'sim' que não sustenta
    // mais". A marca da resposta vem do BANCO (trigger da 0010) — o teste não
    // depende do relógio da máquina.
    const id = await criarDesembolsoTerreno(db, {
      tipo: "entrada",
      valor: 60000,
      estado: "pago",
      data_pagamento: DATA,
      debitos_mesmo_dia: true,
    });
    for (const nome of ["pix-1", "pix-2"]) {
      await criarAnexoDeDesembolso(db, {
        desembolso_id: id,
        arquivo_path: await subirParaOAcervo(db, "terreno", `${nome}.txt`, nome),
        papel: "comprovante",
      });
    }
    // O "sim" está gravado e não há pendência nenhuma.
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno`);
    await expect(
      page.locator('[data-pendencia="terreno-mais-de-uma-data"]'),
    ).toHaveCount(0);

    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);
    const cartao = page.locator(`[data-desembolso-gravado="${id}"]`);
    await cartao
      .getByRole("button", { name: "Anexar um papel", exact: true })
      .click();
    await anexar(cartao, "Anexar papel", "pix-3.pdf", "Comprovante do pagamento");
    await expect(pergunta(page)).toBeVisible();

    await pergunta(page).getByText("Em mais de um dia", { exact: true }).click();
    await cartao
      .getByRole("button", { name: "Gravar o papel", exact: true })
      .click();
    await expect(page.getByText("Papel anexado")).toBeVisible();

    const [gravado] = await desembolsosTerreno(db);
    expect(gravado.debitos_mesmo_dia).toBe(false);
    expect(await anexosDeDesembolso(db)).toHaveLength(3);
  });

  test("⚠️ re-responder 'Tudo em [data]' com o MESMO valor RE-CARIMBA — e a pergunta PEGA", async ({
    page,
    db,
  }) => {
    // Defeito achado no Gate 2 e consertado pela migration 0011. Este é o caso
    // COMUM da re-pergunta do §6 — o 2º PIX do mesmo dia —, e o teste ao lado
    // (resposta OPOSTA, `true` → `false`) o mascarava: lá o valor muda, e o
    // trigger da 0010 carimbava por `is distinct from`.
    //
    // Re-afirmando o MESMO valor (`true` → `true`), a marca não se movia: ela
    // ficava mais VELHA que o comprovante novo, a pergunta voltava em todo ato
    // futuro e NUNCA pegava. Duas consequências: a segunda afirmação do
    // contribuinte não existia no acervo (critério 12b, §4d) e a única resposta
    // que "colava" era "Em mais de um dia" — o app treinando o honesto a
    // declarar uma pendência falsa, que não tem baixa (§3.2 e §5).
    const id = await criarDesembolsoTerreno(db, {
      tipo: "entrada",
      valor: 60000,
      estado: "pago",
      data_pagamento: DATA,
      debitos_mesmo_dia: true,
    });
    for (const nome of ["pix-1", "pix-2"]) {
      await criarAnexoDeDesembolso(db, {
        desembolso_id: id,
        arquivo_path: await subirParaOAcervo(db, "terreno", `${nome}.txt`, nome),
        papel: "comprovante",
      });
    }
    const [antes] = await desembolsosTerreno(db);
    const marcaAntes = antes.debitos_mesmo_dia_respondido_em;
    expect(marcaAntes).not.toBeNull();

    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);
    const cartao = page.locator(`[data-desembolso-gravado="${id}"]`);
    await cartao
      .getByRole("button", { name: "Anexar um papel", exact: true })
      .click();
    await anexar(cartao, "Anexar papel", "pix-3.pdf", "Comprovante do pagamento");
    await expect(pergunta(page)).toBeVisible();

    // A MESMA resposta de antes — e é isso que o defeito engolia.
    await pergunta(page).getByText(TUDO_EM, { exact: true }).click();
    await cartao
      .getByRole("button", { name: "Gravar o papel", exact: true })
      .click();
    await expect(page.getByText("Papel anexado")).toBeVisible();

    const [depois] = await desembolsosTerreno(db);
    expect(depois.debitos_mesmo_dia).toBe(true);
    // A marca AVANÇA: a segunda afirmação está datada, e datada DEPOIS do
    // papel que ela cobre. É o critério 12b em 2034.
    expect(
      Date.parse(depois.debitos_mesmo_dia_respondido_em!),
    ).toBeGreaterThan(Date.parse(marcaAntes!));
    expect(await anexosDeDesembolso(db)).toHaveLength(3);

    // E a pergunta PEGA: recarregando e reabrindo o mesmo formulário, sem
    // papel novo nenhum, ela não volta. Antes da 0011 ela voltava aqui — para
    // sempre, sobre uma resposta que já cobre os três papéis.
    await page.reload();
    const recarregado = page.locator(`[data-desembolso-gravado="${id}"]`);
    await recarregado
      .getByRole("button", { name: "Anexar um papel", exact: true })
      .click();
    await expect(recarregado.getByLabel("Anexar papel", { exact: true })).toBeVisible();
    await expect(pergunta(page)).toHaveCount(0);
  });
});

// ══ §6 — represada sem data ═════════════════════════════════════════════

test.describe("sem data a pergunta fica REPRESADA", () => {
  test("a pendência de data tem precedência, e a pergunta dispara junto com ela", async ({
    page,
    db,
  }) => {
    const id = await criarDesembolsoTerreno(db, {
      tipo: "entrada",
      valor: 60000,
      estado: "pago",
      data_pagamento: null,
    });
    for (const nome of ["pix-1", "pix-2"]) {
      await criarAnexoDeDesembolso(db, {
        desembolso_id: id,
        arquivo_path: await subirParaOAcervo(db, "terreno", `${nome}.txt`, nome),
        papel: "comprovante",
      });
    }

    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);
    const cartao = page.locator('[data-sem-data="entrada"]');
    await expect(cartao).toBeVisible();
    // As duas nunca aparecem juntas no mesmo desembolso.
    await expect(pergunta(page)).toHaveCount(0);

    await cartao
      .getByRole("button", { name: "Informar a data", exact: true })
      .click();
    const campoData = cartao.getByLabel("Data em que saiu da conta", {
      exact: true,
    });
    await expect(campoData).toBeVisible();
    await campoData.fill(DATA);

    // ⚠️ A represa abre NO MESMO ATO em que a data entra.
    await expect(pergunta(page)).toBeVisible();
    await pergunta(page).getByText("Em mais de um dia", { exact: true }).click();
    await cartao
      .getByRole("button", { name: "Informar a data", exact: true })
      .click();
    await expect(page.getByText("Data informada")).toBeVisible();

    const [gravado] = await desembolsosTerreno(db);
    expect(gravado.data_pagamento).toBe(DATA);
    expect(gravado.debitos_mesmo_dia).toBe(false);
    // O VALOR não foi tocado — é isso que deixa a pendência sem baixa.
    expect(gravado.valor).toBe(60000);
  });
});

// ══ Critério 15 — pago sem papel continua VISÍVEL ═══════════════════════

test.describe("pago, e sem papel nenhum (critério 15)", () => {
  test("a pendência deriva de 'não existe linha de anexo', não de coluna vazia", async ({
    page,
    db,
  }) => {
    await criarDesembolsoTerreno(db, {
      tipo: "escritura_registro",
      valor: 3150,
      estado: "pago",
      data_pagamento: DATA,
    });

    await page.goto(`/obras/${OBRA_ID_SEED}/terreno`);
    const cartao = page.locator('[data-pendencia="terreno-sem-papel"]');
    await expect(cartao).toBeVisible();
    await expect(
      cartao.getByText("Pago, e sem papel nenhum", { exact: true }),
    ).toBeVisible();
    await expect(cartao).toContainText("não é comprovável");
  });

  test("com papel na FILHA, a pendência some — e o papel abre", async ({
    page,
    db,
  }) => {
    const id = await criarDesembolsoTerreno(db, {
      tipo: "escritura_registro",
      valor: 3150,
      estado: "pago",
      data_pagamento: DATA,
    });
    const caminho = await subirParaOAcervo(
      db,
      "terreno",
      "escritura.txt",
      "escritura",
    );
    await criarAnexoDeDesembolso(db, {
      desembolso_id: id,
      arquivo_path: caminho,
      papel: "contrato",
    });

    await page.goto(`/obras/${OBRA_ID_SEED}/terreno`);
    await expect(
      page.locator('[data-pendencia="terreno-sem-papel"]'),
    ).toHaveCount(0);
    const item = page.locator(`[data-anexo="${caminho}"]`);
    await expect(item).toContainText("Contrato ou escritura");
    await expect(
      item.getByRole("button", { name: "Abrir", exact: true }),
    ).toBeVisible();
  });

  test("o PREVISTO nunca é 'pago sem papel' — não há o que anexar", async ({
    page,
    db,
  }) => {
    await criarDesembolsoTerreno(db, {
      tipo: "itbi",
      valor: 4200,
      estado: "previsto",
      data_pagamento: null,
    });
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno`);
    await expect(
      page.locator('[data-pendencia="terreno-sem-papel"]'),
    ).toHaveCount(0);
  });

  test("⚠️ anexar num PREVISTO não pergunta a data do pagamento", async ({
    page,
    db,
  }) => {
    // Previsto é o que ainda NÃO foi pago (critério 5 do CONTAI-010), e o
    // banco proíbe que ele tenha data. Pedir a data ao anexar o contrato seria
    // pedir a data de um débito que não aconteceu — e gravá-la violaria a
    // constraint `terreno_desembolso_previsto_sem_data`.
    const id = await criarDesembolsoTerreno(db, {
      tipo: "escritura_registro",
      valor: 3150,
      estado: "previsto",
      data_pagamento: null,
    });

    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);
    const cartao = page.locator(`[data-desembolso-gravado="${id}"]`);
    await cartao
      .getByRole("button", { name: "Anexar um papel", exact: true })
      .click();
    await expect(
      cartao.getByLabel("Data em que saiu da conta", { exact: true }),
    ).toHaveCount(0);

    await anexar(cartao, "Anexar papel", "minuta.pdf", "Contrato ou escritura");
    await cartao
      .getByRole("button", { name: "Gravar o papel", exact: true })
      .click();
    await expect(page.getByText("Papel anexado")).toBeVisible();

    const [gravado] = await desembolsosTerreno(db);
    expect(gravado.estado).toBe("previsto");
    expect(gravado.data_pagamento).toBeNull();
    expect(await anexosDeDesembolso(db)).toHaveLength(1);
  });
});

// ══ Critério 16 — a porta de N→1 fica aberta ════════════════════════════

test("o MESMO objeto do acervo sustenta dois lançamentos (critério 16)", async ({
  db,
}) => {
  // Gate Fiscal §5: a fatura de cartão é UM comprovante para N pagamentos. Um
  // `unique` em `arquivo_path` resolveria 1→N e fecharia N→1. Nada infla: o
  // valor não vem do anexo (§1).
  const fatura = await subirParaOAcervo(
    db,
    "terreno",
    "fatura.txt",
    "fatura do cartao",
  );
  for (const valor of [1000, 2000]) {
    const id = await criarDesembolsoTerreno(db, {
      tipo: "itbi",
      valor,
      estado: "pago",
      data_pagamento: DATA,
    });
    await criarAnexoDeDesembolso(db, {
      desembolso_id: id,
      arquivo_path: fatura,
      papel: "comprovante",
    });
  }

  const papeis = await anexosDeDesembolso(db);
  expect(papeis).toHaveLength(2);
  expect(new Set(papeis.map((p) => p.arquivo_path)).size).toBe(1);
});

// ══ A RLS DERIVADA DO PAI (migration 0010) ══════════════════════════════

test("anexo em desembolso de OUTRA conta é recusado pela policy", async ({
  db,
}) => {
  // ⚠️ A tabela não tem `user_id` próprio: o dono é derivado do pai. É esta
  // policy — `dono_terreno_anexo` — que torna a linha de conta cruzada
  // impossível de representar, e é ela que este teste exercita. A tentativa
  // sai do MESMO client autenticado que o app usa.
  const alheio = plantarDesembolsoDeOutroDono();

  const { error } = await db.from("terreno_desembolso_anexo").insert({
    desembolso_id: alheio,
    arquivo_path: `${alheio}/terreno/nao-deveria.pdf`,
    papel: "comprovante",
  });

  expect(error?.code).toBe("42501");
  expect(await anexosDeDesembolso(db)).toHaveLength(0);
});

// ══ O papel FORA do conjunto fechado (critério 14) ══════════════════════

test("papel fora dos três valores é recusado pelo banco (critério 14)", async ({
  db,
}) => {
  // ⚠️ Valor novo neste conjunto exige parecer do `contador` — mesma
  // contrapartida da D32. O check da 0010 é o que faz disso uma decisão, e não
  // um campo de texto livre que ninguém confere.
  const id = await criarDesembolsoTerreno(db, {
    tipo: "entrada",
    valor: 60000,
    estado: "pago",
    data_pagamento: DATA,
  });
  const { error } = await db.from("terreno_desembolso_anexo").insert({
    desembolso_id: id,
    arquivo_path: "u/terreno/inventado.pdf",
    papel: "orcamento",
  });

  expect(error?.code).toBe("23514");
  expect(await anexosDeDesembolso(db)).toHaveLength(0);
});

// ══ A resposta sem data é impossível de representar (§6) ════════════════

test("responder sem data é recusado pelo banco — a represa é estrutural", async ({
  db,
}) => {
  const id = await criarDesembolsoTerreno(db, {
    tipo: "entrada",
    valor: 60000,
    estado: "pago",
    data_pagamento: null,
  });
  const { error } = await db
    .from("terreno_desembolso")
    .update({ debitos_mesmo_dia: true })
    .eq("id", id);

  expect(error?.code).toBe("23514");
  const [gravado] = await desembolsosTerreno(db);
  expect(gravado.debitos_mesmo_dia).toBeNull();
});

// ══════════════════════════════════════════════════════════════════════════
// CONTAI-025 — as QUATRO combinações do critério 2, contra o Postgres local
//
// ⚠️ **A trava saiu, e ela nunca teve parecer** (D49). O ADENDO 1 do parecer de
// 23/08 é literal: superfícies 1-4 **gravam**; 5 e 6 recusam, e por motivo
// diferente (ali o anexo é FONTE do dado, não prova do fato). Bloquear
// anexo-PROVA *"não evita erro nenhum: evita o registro"* — e evitou: o Mateus
// parou de usar o app, e o banco de produção está vazio.
//
// A cobertura não foi apagada: ela passou a afirmar o **ESTADO QUE NASCE**.
// ══════════════════════════════════════════════════════════════════════════

test.describe("as quatro combinações de data × comprovante (critério 2)", () => {
  /** O formulário até o estado `pago`, SEM data e SEM papel nenhum. */
  async function pagoSemNada(page: Page, valor: string) {
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/desembolsos`);
    await page
      .getByRole("group", { name: "O que é este desembolso?" })
      .getByText("Entrada", { exact: true })
      .click();
    await page.getByLabel("Valor", { exact: true }).fill(valor);
    await page
      .getByRole("group", { name: "Este valor já foi pago?" })
      .getByText("Já paguei", { exact: true })
      .click();
  }

  test("1 · com data + com comprovante — nada nasce pendente", async ({
    page,
    db,
  }) => {
    await preencherDesembolso(page, "3.150,00");
    await anexar(
      page.locator("body"),
      "Papéis deste desembolso",
      "custas.pdf",
      "Comprovante do pagamento",
    );
    await expect(gravar(page)).toHaveText("Gravar o desembolso");
    await gravar(page).click();
    await expect(page.getByText("registrado no custo de")).toBeVisible();

    const [gravado] = await desembolsosTerreno(db);
    expect(gravado).toMatchObject({ estado: "pago", data_pagamento: DATA });
    expect(await anexosDeDesembolso(db)).toHaveLength(1);
  });

  test("2 · com data, SEM comprovante — grava e abre a pendência", async ({
    page,
    db,
  }) => {
    // ⚠️ Este é o caso literal do relato: ele tem a escritura, **não tem os
    // comprovantes**. Repare que o desembolso TEM papel — e mesmo assim está
    // fora do custo confirmado, porque *"a escritura prova o preço, não o
    // pagamento"* (§4.3). É o portão do critério 8, e é por isso que
    // `pagoSemPapel` (zero anexo) não podia ser reaproveitado.
    await preencherDesembolso(page, "60.000,00");
    await anexar(
      page.locator("body"),
      "Papéis deste desembolso",
      "escritura.pdf",
      "Contrato ou escritura",
    );
    await expect(
      page.getByText("A escritura prova o preço, não o pagamento.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(gravar(page)).toHaveText(
      "Gravar — e abrir a pendência do comprovante",
    );
    await gravar(page).click();

    // ⚠️ O efeito OBSERVÁVEL da gravação — e a mensagem NÃO afirma que o valor
    // passa a compor o custo (critério 13). "no custo de" seria mentira aqui.
    await expect(
      page.getByText("registrado — o valor é de", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("registrado no custo de")).toHaveCount(0);

    const [gravado] = await desembolsosTerreno(db);
    expect(gravado).toMatchObject({ estado: "pago", data_pagamento: DATA });
    const papeis = await anexosDeDesembolso(db);
    expect(papeis).toHaveLength(1);
    expect(papeis[0].papel).toBe("contrato");
  });

  test("3 · SEM data, com comprovante — grava e abre a pendência da data", async ({
    page,
    db,
  }) => {
    await pagoSemNada(page, "25.000,00");
    await anexar(
      page.locator("body"),
      "Papéis deste desembolso",
      "pix.pdf",
      "Comprovante do pagamento",
    );
    // ⚠️ O rótulo adjudicado pelo `contador` em 23/08, com o "que falta": ele
    // RECUSOU a simetria óbvia ("a pendência da data") porque a distinção
    // fiscal não pode depender de uma letra ("da data" × "de datas"), no mesmo
    // formulário em que nasce a pendência "mais de uma data".
    await expect(gravar(page)).toHaveText(
      "Gravar — e abrir a pendência da data que falta",
    );
    await gravar(page).click();
    // Frase que só existe DEPOIS de gravar: "não tem ano-calendário" também
    // está na caixa de consequência do formulário, ANTES do toque.
    await expect(page.getByText("registrado — sem a data")).toBeVisible();

    const [gravado] = await desembolsosTerreno(db);
    expect(gravado).toMatchObject({
      estado: "pago",
      data_pagamento: null,
      valor: 25000,
    });
    expect(await anexosDeDesembolso(db)).toHaveLength(1);
  });

  test("4 · SEM data e SEM comprovante — grava, com UM chip e as duas frases", async ({
    page,
    db,
  }) => {
    await pagoSemNada(page, "4.200,00");

    // A consequência é dita ANTES do toque: UMA caixa, nunca duas empilhadas,
    // ordem data → comprovante, e "Comece pela data" literal (Gate Fiscal §4).
    const caixa = page.locator("[data-consequencia-do-formulario]");
    await expect(caixa).toBeVisible();
    await expect(
      caixa.getByText("Pago — falta a data e o comprovante", { exact: true }),
    ).toBeVisible();
    await expect(caixa.getByText("Comece pela data", { exact: false })).toBeVisible();

    await expect(gravar(page)).toHaveText("Gravar — e abrir as duas pendências");
    await gravar(page).click();
    await expect(page.getByText("registrado — sem a data")).toBeVisible();

    // ⚠️ O ESTADO GRAVADO: `pago`, `data_pagamento` NULO e ZERO linhas em
    // `terreno_desembolso_anexo`. É o que o banco sempre aceitou (0008/0010).
    const [gravado] = await desembolsosTerreno(db);
    expect(gravado).toMatchObject({
      estado: "pago",
      data_pagamento: null,
      valor: 4200,
    });
    expect(await anexosDeDesembolso(db)).toHaveLength(0);
  });

  test("data no FUTURO continua recusada — e o texto oferece as 3 saídas", async ({
    page,
    db,
  }) => {
    // ⚠️ A única recusa de data que sobrou, e o texto MUDOU no Gate 2: agora
    // que o campo vazio grava, o erro mais provável é **data errada num
    // pagamento real** — e a redação anterior oferecia SÓ `previsto`, a saída
    // que tira o valor de todo ano-calendário. Ordem: corrigir · deixar vazio ·
    // e só então `previsto`, com a consequência dita.
    await pagoSemNada(page, "4.200,00");
    await page
      .getByLabel("Data em que saiu da conta", { exact: true })
      .fill("2099-01-01");
    await gravar(page).click();

    const erro = page.getByText("Data no futuro — o dinheiro não pode ter saído");
    await expect(erro).toBeVisible();
    await expect(page.getByText("Se você errou a data, corrija-a")).toBeVisible();
    await expect(page.getByText("deixe o campo vazio")).toBeVisible();
    await expect(
      page.getByText("isso tira este valor de todo ano-calendário"),
    ).toBeVisible();
    // A recusa é da DATA, não do registro: nada foi gravado.
    expect(await desembolsosTerreno(db)).toHaveLength(0);
  });

  test("⚠️ o desembolso sem comprovante fica FORA do custo confirmado, nomeado", async ({
    page,
    db,
  }) => {
    // A D50: `custoTerrenoAteOAno` somava por `estado === "pago"` + data e NÃO
    // olhava anexo. Liberada a gravação, isso somaria custo não demonstrável
    // em silêncio — e o §2.4 proíbe o silêncio nos DOIS sentidos: o segundo
    // número existe para o total não encolher calado.
    const id = await criarDesembolsoTerreno(db, {
      tipo: "entrada",
      valor: 60000,
      estado: "pago",
      data_pagamento: DATA,
    });
    await criarAnexoDeDesembolso(db, {
      desembolso_id: id,
      arquivo_path: await subirParaOAcervo(db, "terreno", "escritura.txt", "esc"),
      papel: "contrato",
    });

    await page.goto(`/obras/${OBRA_ID_SEED}/terreno`);
    await expect(
      page.getByText("Já desembolsado até 31/12/"),
    ).toBeVisible();
    // O confirmado não o inclui...
    await expect(page.locator("[data-fora-do-custo-confirmado]")).toContainText(
      "Fora do custo confirmado por falta de comprovante",
    );
    await expect(page.locator("[data-fora-do-custo-confirmado]")).toContainText(
      "R$ 60.000,00",
    );
    // ...e a pendência tem SUPERFÍCIE PRÓPRIA (critério 11, antídoto da D47).
    const card = page.locator('[data-pendencia="terreno-sem-comprovante"]').first();
    await expect(card).toContainText("Pago sem comprovante");
    await expect(card).toContainText("não está demonstrável");
  });
});
