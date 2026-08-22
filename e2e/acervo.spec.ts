import { OBRA_ID_SEED, USER_ID_SEED } from "./ambiente";
import {
  anexosDoDocumento,
  criarDesembolsoTerreno,
  criarDocumento,
  criarFavorecido,
  criarFinanciamento,
  criarInforme,
  criarPagamento,
  plantarObjetoDeOutroDono,
  subirParaOAcervo,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * CONTAI-027, rodada 1 — ABRIR o papel que já está no acervo (dor D35).
 *
 * Contra o Postgres e o Storage LOCAIS, sem stub: o arquivo sobe de verdade
 * pelo client autenticado, o link é assinado de verdade pelo storage-api, e
 * quem recusa o papel alheio é a policy `acervo_dono_select` da migration
 * 0002 — não um `if` do TypeScript.
 *
 * A única falsificação de rede é o 503 no teste do estado de erro, pelo mesmo
 * motivo já nomeado no CLAUDE.md: derrubar o Storage no meio da suíte não
 * provaria mais nada.
 */

const CONTEUDO = "nota fiscal de servico numero 2481";

async function documentoComPapel(db: Db, conteudo = CONTEUDO) {
  const arquivoPath = await subirParaOAcervo(
    db,
    "documento",
    "nfse-2481.txt",
    conteudo,
  );
  const favorecidoId = await criarFavorecido(db, {
    tipo: "pj",
    nome: "Depósito Ilha",
    documento: "12345678000199",
  });
  const documentoId = await criarDocumento(db, {
    tipo: "nf_material",
    favorecido_id: favorecidoId,
    valor: 1280,
    classificacao: "material",
    destinatario_cpf_ok: true,
    arquivo_path: arquivoPath,
  });
  return { arquivoPath, documentoId, favorecidoId };
}

/** O item do papel, isolado pelo caminho — o `data-anexo` do componente. */
function anexo(page: import("@playwright/test").Page, path: string) {
  return page.locator(`[data-anexo="${path}"]`);
}

test.describe("abrir o papel do acervo (critérios 2 e 3)", () => {
  test("o Abrir do detalhe do documento gera link ASSINADO e o link entrega o arquivo", async ({
    page,
    db,
  }) => {
    const { arquivoPath, documentoId } = await documentoComPapel(db);

    await page.goto(`/documento/${documentoId}`);

    const item = anexo(page, arquivoPath);
    await expect(item).toHaveAttribute("data-estado", "pronto");
    // O nome vem do caminho — é o que o app sabe. Sem tamanho e sem data de
    // anexação inventados.
    await expect(item).toContainText("nfse-2481.txt");

    const [aba] = await Promise.all([
      page.context().waitForEvent("page"),
      item.getByRole("button", { name: "Abrir", exact: true }).click(),
    ]);
    await aba.waitForURL(/\/storage\/v1\/object\/sign\//);

    const url = aba.url();
    // ⚠️ Critério 3: assinado e temporário. Se um dia alguém trocar por
    // `getPublicUrl`, o caminho vira `/object/public/` e este teste acusa.
    expect(url).toContain(`/storage/v1/object/sign/acervo/${arquivoPath}`);
    expect(url).toContain("token=");
    expect(url).not.toContain("/object/public/");

    /**
     * O link entrega o papel SOZINHO — `page.request` não carrega a sessão do
     * app. É o que separa "gerou uma URL" de "o Mateus consegue ler o
     * documento".
     */
    const resposta = await page.request.get(url);
    expect(resposta.status()).toBe(200);
    expect(await resposta.text()).toBe(CONTEUDO);

    await aba.close();
  });

  test("o detalhe do documento lista o original E os anexos adicionais", async ({
    page,
    db,
  }) => {
    const { arquivoPath, documentoId } = await documentoComPapel(db);
    // A carta de correção que chegou depois (CONTAI-021, `documento_anexo`):
    // é acervo deste documento e antes deste ticket não aparecia em tela
    // nenhuma.
    const adicionalPath = await subirParaOAcervo(
      db,
      "documento",
      "carta-de-correcao.txt",
      "carta de correcao",
    );
    const { error } = await db
      .from("documento_anexo")
      .insert({ documento_id: documentoId, arquivo_path: adicionalPath });
    expect(error).toBeNull();
    expect(await anexosDoDocumento(db)).toHaveLength(1);

    await page.goto(`/documento/${documentoId}`);

    await expect(page.getByText("Papéis deste documento (2)")).toBeVisible();
    await expect(anexo(page, arquivoPath)).toBeVisible();
    await expect(anexo(page, adicionalPath)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Abrir", exact: true }),
    ).toHaveCount(2);
  });

  test("o comprovante do pagamento vira item com Abrir", async ({
    page,
    db,
  }) => {
    const comprovantePath = await subirParaOAcervo(
      db,
      "comprovante",
      "pix-empreiteira.txt",
      "comprovante pix",
    );
    const favorecidoId = await criarFavorecido(db, {
      tipo: "pj",
      nome: "Empreiteira Sul",
      documento: "98765432000155",
    });
    const pagamentoId = await criarPagamento(db, {
      favorecido_id: favorecidoId,
      valor: 4085.71,
      data_pagamento: "2026-08-12",
      meio: "pix",
      comprovante_path: comprovantePath,
    });

    await page.goto(`/pagamento/${pagamentoId}`);

    const item = anexo(page, comprovantePath);
    await expect(item).toContainText("pix-empreiteira.txt");
    await expect(
      item.getByRole("button", { name: "Abrir", exact: true }),
    ).toBeVisible();
  });

  test("o painel do terreno abre o papel do desembolso", async ({
    page,
    db,
  }) => {
    const arquivoPath = await subirParaOAcervo(
      db,
      "terreno",
      "comprovante-entrada.txt",
      "entrada do terreno",
    );
    await criarDesembolsoTerreno(db, {
      tipo: "entrada",
      valor: 60000,
      estado: "pago",
      data_pagamento: "2026-08-12",
      arquivo_path: arquivoPath,
    });

    await page.goto(`/obras/${OBRA_ID_SEED}/terreno`);

    const item = anexo(page, arquivoPath);
    await expect(item).toContainText("comprovante-entrada.txt");
    await expect(
      item.getByRole("button", { name: "Abrir", exact: true }),
    ).toBeVisible();
  });
});

/**
 * ⚠️ Critério 2 é um critério de COBERTURA: "nenhuma tela fica mostrando nome
 * sem poder abrir — se sobrar uma, a rodada 1 não fechou". As quatro primeiras
 * superfícies estão exercitadas acima; estas são as três que faltavam.
 */
test.describe("as superfícies que faltavam (critério 2)", () => {
  test("corrigir a CLASSIFICAÇÃO mostra o papel — decidir material × mão de obra é lê-lo", async ({
    page,
    db,
  }) => {
    const { arquivoPath, documentoId } = await documentoComPapel(db);

    await page.goto(`/documento/${documentoId}/corrigir/classificacao`);

    await expect(
      anexo(page, arquivoPath).getByRole("button", {
        name: "Abrir",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("corrigir o EMITENTE mostra o papel — o nome se transcreve da nota", async ({
    page,
    db,
  }) => {
    const { arquivoPath, documentoId } = await documentoComPapel(db);

    await page.goto(`/documento/${documentoId}/corrigir/emitente`);

    await expect(
      anexo(page, arquivoPath).getByRole("button", {
        name: "Abrir",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("o informe anual já registrado mostra o extrato que o sustenta", async ({
    page,
    db,
  }) => {
    const anoCorrente = new Date().getFullYear();
    const anoBase = anoCorrente - 1;
    const arquivoPath = await subirParaOAcervo(
      db,
      "informe",
      "extrato-ir.txt",
      "extrato do exercicio",
    );
    const financiamentoId = await criarFinanciamento(db, {
      instituicao: "Banco do Terreno",
      data_contrato: `${anoBase - 1}-03-20`,
      preco_contratado: 650000,
      numero_parcelas: 240,
    });
    await criarInforme(db, {
      financiamento_id: financiamentoId,
      ano_base: anoBase,
      amortizacao: 100,
      juros_correcao: 200,
      seguros: 0,
      taxas_fcvs: 0,
      mora: 0,
      multa: 0,
      diferenca_teorico_pago: 0,
      total_pago: 300,
      saldo_devedor: 585815.19,
      arquivo_path: arquivoPath,
    });

    // A tela que RECUSA o segundo lançamento do ano é justamente onde ele quer
    // conferir o que já foi lançado.
    await page.goto(`/obras/${OBRA_ID_SEED}/terreno/informe/${anoBase}`);

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(
      anexo(page, arquivoPath).getByRole("button", {
        name: "Abrir",
        exact: true,
      }),
    ).toBeVisible();
  });
});

/**
 * ⚠️ Critério 4 — a autorização é a policy, e é ela que este teste exercita.
 *
 * O objeto EXISTE no bucket e é de outra conta (plantado pelo andaime de
 * administrador, porque `acervo_dono_insert` proíbe o app de criá-lo — e é
 * essa proibição que não se contorna). O app pede o link como pede qualquer
 * outro; quem devolve a recusa é o Storage.
 */
test.describe("papel de outra conta não abre (critério 4)", () => {
  test("a policy recusa, a tela diz que não é dele, e não há Tentar de novo", async ({
    page,
    db,
  }) => {
    const alheio = plantarObjetoDeOutroDono("nota-de-outra-pessoa.txt");
    expect(alheio.startsWith(USER_ID_SEED)).toBe(false);

    const favorecidoId = await criarFavorecido(db, {
      tipo: "pj",
      nome: "Depósito Ilha",
      documento: "12345678000199",
    });
    const documentoId = await criarDocumento(db, {
      tipo: "nf_material",
      favorecido_id: favorecidoId,
      valor: 1280,
      destinatario_cpf_ok: true,
      arquivo_path: alheio,
    });

    await page.goto(`/documento/${documentoId}`);
    const item = anexo(page, alheio);

    // A chamada acontece de verdade — não há atalho no cliente que a evite.
    const [resposta] = await Promise.all([
      page.waitForResponse((r) =>
        r.url().includes("/storage/v1/object/sign/acervo/"),
      ),
      item.getByRole("button", { name: "Abrir", exact: true }).click(),
    ]);
    expect(resposta.ok()).toBe(false);

    await expect(item).toHaveAttribute("data-estado", "negado");
    await expect(item).toContainText(
      "Este arquivo não é seu. O acervo só abre para o dono.",
    );
    // Retry não conserta "não é seu": o botão não existe neste estado.
    await expect(
      item.getByRole("button", { name: "Tentar de novo", exact: true }),
    ).toHaveCount(0);
    await expect(
      item.getByRole("button", { name: "Abrir", exact: true }),
    ).toHaveCount(0);

    // E nenhuma aba ficou aberta em branco.
    expect(page.context().pages()).toHaveLength(1);
  });
});

/**
 * Critério 5 (e item 1 da D36): falha ao GERAR o link tem estado visível e um
 * botão que realmente tenta de novo — não um botão que não faz nada.
 */
test.describe("falha ao gerar o link (critério 5)", () => {
  test("mostra o erro, e o Tentar de novo abre quando o Storage volta", async ({
    page,
    db,
  }) => {
    const { arquivoPath, documentoId } = await documentoComPapel(db);

    const rota = "**/storage/v1/object/sign/**";
    await page.route(rota, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"statusCode":"503","error":"Service Unavailable","message":"upstream fora"}',
      }),
    );

    await page.goto(`/documento/${documentoId}`);
    const item = anexo(page, arquivoPath);
    await item.getByRole("button", { name: "Abrir", exact: true }).click();

    await expect(item).toHaveAttribute("data-estado", "falha");
    await expect(item).toContainText(
      "Não consegui abrir agora. O papel continua no acervo",
    );
    // "Nada foi perdido" é o ponto: o erro é do link, não do acervo.
    await expect(item).toContainText("Nada foi perdido");
    expect(page.context().pages()).toHaveLength(1);

    // O Storage volta — e o botão de retry tem de resolver de verdade.
    await page.unroute(rota);
    const [aba] = await Promise.all([
      page.context().waitForEvent("page"),
      item.getByRole("button", { name: "Tentar de novo", exact: true }).click(),
    ]);
    await aba.waitForURL(/\/storage\/v1\/object\/sign\//);
    expect(aba.url()).toContain(arquivoPath);
    await aba.close();

    await expect(item).toHaveAttribute("data-estado", "pronto");
  });
});

/**
 * ⚠️ Critério 6 — a tela que mandava "confira antes de digitar" sem ter como
 * conferir. É a frase citada no ticket, e o mock (tela 1b) põe o Abrir ao lado
 * dela.
 */
test.describe("confira antes de digitar (critério 6)", () => {
  test("a correção de valor traz o Abrir junto da frase", async ({
    page,
    db,
  }) => {
    const { arquivoPath, documentoId } = await documentoComPapel(db);

    await page.goto(`/documento/${documentoId}/corrigir/valor`);

    // Passo 1 — o papel já abre aqui, antes de escolher o motivo.
    await expect(
      anexo(page, arquivoPath).getByRole("button", {
        name: "Abrir",
        exact: true,
      }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Só aqui no app — eu digitei errado" })
      .click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();

    await expect(
      page.getByText("Papel anexado — confira antes de digitar"),
    ).toBeVisible();
    const item = anexo(page, arquivoPath);
    await expect(item).toBeVisible();

    const [aba] = await Promise.all([
      page.context().waitForEvent("page"),
      item.getByRole("button", { name: "Abrir", exact: true }).click(),
    ]);
    await aba.waitForURL(/\/storage\/v1\/object\/sign\//);
    expect(await (await page.request.get(aba.url())).text()).toBe(CONTEUDO);
    await aba.close();
  });
});
