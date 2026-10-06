import type { Page } from "@playwright/test";

import { USER_ID_SEED } from "./ambiente";
import {
  anexosDoDocumento,
  arquivosNoAcervo,
  criarDocumento,
  criarFavorecido,
  documentos,
  linhasDeRetencao,
  revisoes,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";
import { escolher } from "./formularios";
import {
  PERGUNTA_COMPOSICAO,
  PERGUNTA_DESCONTO_EFETIVO,
  PERGUNTA_QUEM_RECOLHE,
  PERGUNTA_TRIBUTO,
} from "../lib/fiscal/retencao";

/**
 * **CONTAI-088 contra o Postgres LOCAL — o pacote de correções.**
 *
 * Caso real (dor de origem, `docs/backlog/103-…`): a NFS-e 261 foi substituída
 * pela 263, o Mateus precisou de duas ações separadas sobre o MESMO papel e
 * acabou subindo o arquivo errado numa delas — duas cópias do mesmo PDF no
 * acervo, sem caminho de remoção (`documento_anexo` nunca teve GRANT de DELETE).
 *
 * O que estes testes provam é o ESTADO GRAVADO, nunca o que a tela mostrou:
 * - `documento_anexo` com **N linhas do MESMO `arquivo_path`** e `revisao_id`
 *   distintos (cada ato tem o seu rastro — critério 6);
 * - o bucket `acervo` com **UM objeto novo** quando o papel foi anexado agora, e
 *   **ZERO** quando ele já existia;
 * - `revisao` com uma linha por correção confirmada e **nenhuma** do ponto de
 *   entrada (critério 8);
 * - "Pular esta" não gravando nada;
 * - o motivo perguntado DE NOVO em cada correção (critério 10 e condição
 *   obrigatória do Gate Fiscal).
 */

const CNPJ_PRESTADORA = "11222333000144";
const PERGUNTA_NOVA_RESPOSTA = "Qual é a resposta certa, olhando a nota?";
const LINK_DE_ENTRADA =
  "Recebi um documento novo para esta nota — corrigir número, valor e/ou retenção";
const CHIP_ARQUIVO_NOVO = "Vou anexar um arquivo novo.";
const CAMPO_NUMERO = "Número que está no papel";
const CAMPO_VALOR = "Valor que está no papel";

async function cenarioFavorecido(db: Db) {
  return criarFavorecido(db, {
    tipo: "pj",
    nome: "PerfuraTec Serviços",
    documento: CNPJ_PRESTADORA,
  });
}

/** A NF de serviço 261 já registrada, com o gate respondido "nenhuma". */
async function nota261(db: Db, favorecidoId: string) {
  return criarDocumento(db, {
    tipo: "nf_servico",
    favorecido_id: favorecidoId,
    valor: 2169.0,
    classificacao: "mao_obra",
    destinatario_cpf_ok: true,
    numero: "261",
    data_emissao: "2026-09-10",
    retencao_na_nota: "nenhuma",
    arquivo_path: `${USER_ID_SEED}/documento/nfse-261.pdf`,
  });
}

async function escolherMotivoDoEmitente(page: Page) {
  await page
    .getByRole("button", { name: "A nota estava errada e o emitente já corrigiu" })
    .click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}

async function escolherMotivoDeDigitacao(page: Page) {
  await page
    .getByRole("button", { name: "Só aqui no app — eu digitei errado" })
    .click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}

async function preencherLinhaDeRetencao(page: Page) {
  await page
    .getByLabel("Rótulo (copie exatamente da nota)")
    .fill("ISS Retido na Fonte");
  await page.getByLabel("Valor", { exact: true }).fill("1797,03");
  await escolher(page, PERGUNTA_COMPOSICAO, "Tributo único identificado");
  await escolher(page, PERGUNTA_TRIBUTO, "ISS");
  await escolher(page, PERGUNTA_DESCONTO_EFETIVO, "Sim");
  await escolher(page, PERGUNTA_QUEM_RECOLHE, "Eu");
  await page.getByRole("button", { name: "Adicionar linha" }).click();
}

const PDF_263 = {
  name: "nfse-263.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 nota substitutiva 263"),
};

test.describe("CONTAI-088 — o ponto de entrada", () => {
  test("passo 1 e passo 2: nada nasce escolhido, e o mínimo é uma correção", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await nota261(db, favorecidoId);

    await page.goto(`/documento/${documentoId}`);
    await page.getByRole("link", { name: LINK_DE_ENTRADA }).click();
    await expect(page).toHaveURL(
      new RegExp(`/documento/${documentoId}/documento-novo$`),
    );

    // ── Passo 1 ────────────────────────────────────────────────────────
    // Documento sem anexo adicional: nenhum chip de papel, e o fato é dito.
    await expect(
      page.getByText(
        "Este documento ainda não tem nenhum anexo adicional, além do original.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Usar a nota anexada em/ }),
    ).toHaveCount(0);

    // ⚠️ Nasce SEM ESCOLHA, mesmo havendo uma opção só: campo que decide o papel
    // de uma correção não tem resposta padrão.
    const arquivoNovo = page.getByRole("button", { name: CHIP_ARQUIVO_NOVO });
    await expect(arquivoNovo).toHaveAttribute("aria-pressed", "false");
    await expect(
      page.getByRole("button", { name: "Escolha o papel para continuar" }),
    ).toBeDisabled();

    // ⚠️ E não existe upload NENHUM aqui (critério 3): o arquivo só é escolhido
    // dentro da primeira correção — senão desistir no meio deixaria um objeto
    // órfão no bucket, sem caminho de remoção.
    await expect(page.locator('input[type="file"]')).toHaveCount(0);

    await arquivoNovo.click();
    await page.getByRole("button", { name: "Avançar" }).click();

    // ── Passo 2 ────────────────────────────────────────────────────────
    const caixas = page.locator('[data-campo="correcoesMarcadas"]');
    await expect(caixas).toHaveCount(3);
    for (let i = 0; i < 3; i++) await expect(caixas.nth(i)).not.toBeChecked();
    await expect(
      page.getByRole("button", {
        name: "Marque ao menos uma correção para continuar",
      }),
    ).toBeDisabled();

    // Os rótulos afirmam o estado de HOJE de cada campo.
    await expect(page.getByText("Número da nota — hoje: Nº 261")).toBeVisible();
    await expect(page.getByText(/Valor — hoje: R\$\s*2\.169,00/)).toBeVisible();
    await expect(page.getByText("Retenção — hoje: Nenhuma")).toBeVisible();

    // Uma marcada já habilita, e a ordem de navegação é a FIXA: marcando só a
    // retenção, é para ela que o pacote vai.
    await caixas.nth(2).check();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`/documento/${documentoId}/corrigir/retencao\\?`),
    );
    const query = new URL(page.url()).searchParams;
    expect(query.get("pacote")).toBe("");
    expect(query.get("anexo")).toBe("");

    // ⚠️ Critério 8 — o ponto de entrada não gravou NADA, em tabela nenhuma.
    expect(await revisoes(db)).toHaveLength(0);
    expect(await anexosDoDocumento(db)).toHaveLength(0);
  });

  test("o pacote inteiro: 3 correções, UM objeto no bucket, 3 rastros", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await nota261(db, favorecidoId);
    // O acervo não é zerado entre testes (a 0002 não tem policy de delete) —
    // o que se mede é o DELTA deste teste.
    const acervoAntes = await arquivosNoAcervo(db, "documento");

    await page.goto(`/documento/${documentoId}/documento-novo`);
    await page.getByRole("button", { name: CHIP_ARQUIVO_NOVO }).click();
    await page.getByRole("button", { name: "Avançar" }).click();
    const caixas = page.locator('[data-campo="correcoesMarcadas"]');
    for (let i = 0; i < 3; i++) await caixas.nth(i).check();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();

    // ── 1ª correção: o número, com o upload do papel novo ──────────────
    await expect(page).toHaveURL(
      new RegExp(`/documento/${documentoId}/corrigir/numero\\?`),
    );
    // ⚠️ **O motivo é perguntado AQUI, e vai ser perguntado de novo nas duas
    // seguintes** (critério 10): a obrigatoriedade de anexo é função do motivo
    // daquela correção específica.
    await expect(page.getByText("Passo 1 de 2", { exact: true })).toBeVisible();
    await escolherMotivoDoEmitente(page);

    await page.getByLabel(CAMPO_NUMERO).fill("263");
    // A ajuda avisa que o arquivo vai servir às próximas do pacote.
    await expect(
      page.getByText(
        "Esse arquivo vai ser reaproveitado nas próximas correções deste pacote.",
      ),
    ).toBeVisible();
    await page.locator('[data-campo="anexo"]').setInputFiles(PDF_263);

    // Critério 13 — o papel escolhido aparece antes do "Gravar". Com upload
    // novo, é o preview do arquivo em memória (no piso, PDF abre em aba).
    const previa = page
      .locator("div")
      .filter({ hasText: "O papel que prova esta correção" })
      .first();
    await expect(previa).toContainText("nfse-263.pdf");
    await expect(page.getByRole("link", { name: "Abrir PDF" })).toBeVisible();

    await page.getByRole("button", { name: "Gravar a correção" }).click();
    await expect(page.getByRole("status").first()).toContainText("Corrigido.");

    // O avanço é PRIMÁRIO; o botão de hoje continua lá, secundário.
    const paraOValor = page.getByRole("link", {
      name: "Continuar: corrigir o valor →",
    });
    await expect(paraOValor).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver o documento" })).toBeVisible();

    const papel = (await anexosDoDocumento(db))[0].arquivo_path;
    await paraOValor.click();

    // ── 2ª correção: o valor, com o papel CHEGANDO pré-selecionado ─────
    await expect(page).toHaveURL(
      new RegExp(`/documento/${documentoId}/corrigir/valor\\?`),
    );
    expect(new URL(page.url()).searchParams.get("anexo")).toBe(papel);
    // Motivo perguntado DE NOVO — nunca herdado do pacote.
    await expect(page.getByText("Passo 1 de 3", { exact: true })).toBeVisible();
    await escolherMotivoDoEmitente(page);

    const chip = page.getByRole("button", { name: /Usar a nota anexada em/ });
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByText(
        "Este anexo veio da entrada do pacote — pode trocar se não for o papel certo.",
      ),
    ).toBeVisible();
    // Critério 13, o outro caso: papel já no acervo não tem `File` em memória —
    // o preview é o MESMO `ItemDeAnexo` com "Abrir" do detalhe do documento.
    await expect(page.locator(`[data-anexo="${papel}"]`)).toHaveCount(1);

    await page.getByLabel(CAMPO_VALOR).fill("2500,00");
    await page.getByRole("button", { name: /^Gravar/ }).click();
    await expect(page.getByRole("status").first()).toContainText("Corrigido.");

    // ⚠️ Esta tela não tinha botão NENHUM no sucesso (gap pré-existente): em
    // modo pacote ela ganha os dois.
    await expect(page.getByRole("link", { name: "Ver o documento" })).toBeVisible();
    await page
      .getByRole("link", { name: "Continuar: corrigir a retenção →" })
      .click();

    // ── 3ª correção: a retenção, SEM `?modo=linha` ─────────────────────
    await expect(page).toHaveURL(
      new RegExp(`/documento/${documentoId}/corrigir/retencao\\?`),
    );
    expect(page.url()).not.toContain("modo=linha");
    await expect(page.getByText("Passo 1 de 4", { exact: true })).toBeVisible();
    await escolherMotivoDoEmitente(page);
    await escolher(page, PERGUNTA_NOVA_RESPOSTA, "Destacada");
    await preencherLinhaDeRetencao(page);
    await expect(
      page.getByRole("button", { name: /Usar a nota anexada em/ }).first(),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Gravar a correção" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Retenção corrigida.",
    );

    // Última do pacote: nada de "Continuar" — só a volta, primária como sempre.
    await expect(page.getByRole("link", { name: /^Continuar: corrigir/ })).toHaveCount(
      0,
    );
    await expect(page.getByRole("link", { name: "Ver o documento" })).toBeVisible();

    // ── O ESTADO GRAVADO ───────────────────────────────────────────────
    const doc = (await documentos(db)).find((d) => d.id === documentoId)!;
    expect(doc.numero).toBe("263");
    // `numeric(14,2)` volta do PostgREST como NÚMERO — a mordida de 2026-08-17.
    expect(doc.valor).toBe(2500);
    expect(doc.retencao_na_nota).toBe("destacada");
    // O papel ORIGINAL não muda em nenhuma das três (Gate Fiscal do CONTAI-085).
    expect(doc.arquivo_path).toBe(`${USER_ID_SEED}/documento/nfse-261.pdf`);

    // ⚠️ **Critério 6 — TRÊS linhas de `documento_anexo` para o MESMO objeto**,
    // cada uma com o `revisao_id` do seu ato: nenhum ato reusa a linha física de
    // outro, e a resposta de "qual papel sustentou QUAL correção" continua
    // existindo nas três pontas.
    const anexos = await anexosDoDocumento(db);
    expect(anexos).toHaveLength(3);
    expect(anexos.map((a) => a.arquivo_path)).toEqual([papel, papel, papel]);
    expect(new Set(anexos.map((a) => a.revisao_id)).size).toBe(3);

    // ⚠️ **E UM objeto novo no bucket, não três** — é a dor de origem deste
    // ticket, medida.
    const acervoDepois = await arquivosNoAcervo(db, "documento");
    expect(acervoDepois.length - acervoAntes.length).toBe(1);

    // Uma linha de rastro por correção, três atos distintos — e nenhuma do
    // ponto de entrada (critério 8).
    const rastro = await revisoes(db);
    expect(rastro.map((r) => r.campo).sort()).toEqual([
      "numero",
      "retencao_na_nota",
      "valor",
    ]);
    expect(new Set(rastro.map((r) => r.ato_id)).size).toBe(3);
    expect(new Set(rastro.map((r) => r.motivo))).toEqual(
      new Set(["emitente_corrigiu_a_nota"]),
    );
    expect(await linhasDeRetencao(db)).toHaveLength(1);

    // ⚠️ **Critério 14 — o detalhe mostra UM item, com a contagem.** Três linhas
    // no banco, um papel na tela: listar o mesmo PDF três vezes diria que três
    // papéis chegaram.
    await page.goto(`/documento/${documentoId}`);
    await expect(page.locator(`[data-anexo="${papel}"]`)).toHaveCount(1);
    await expect(page.getByText("usado em 3 correções")).toBeVisible();
  });

  test("papel que JÁ está no documento: zero upload, zero objeto novo", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await nota261(db, favorecidoId);
    // O CONTAI-085 já corrigiu o número e anexou a 263 — é o papel que o passo 1
    // oferece reaproveitar.
    const papel = `${USER_ID_SEED}/documento/nfse-263-substitutiva.pdf`;
    const correcaoDeNumero = await db.rpc("corrigir_numero_documento", {
      p_documento_id: documentoId,
      p_numero: "263",
      p_serie: null,
      p_motivo: "emitente_corrigiu_a_nota",
      p_anexo_path: papel,
    });
    expect(correcaoDeNumero.error).toBeNull();
    const acervoAntes = await arquivosNoAcervo(db, "documento");

    await page.goto(`/documento/${documentoId}/documento-novo`);
    await page
      .getByRole("button", { name: /Usar a nota anexada em .*correção de número/ })
      .click();
    await page.getByRole("button", { name: "Avançar" }).click();
    // Só o valor: o número já foi corrigido pela RPC acima.
    await page.locator('[data-campo="correcoesMarcadas"]').nth(1).check();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();

    await expect(page).toHaveURL(
      new RegExp(`/documento/${documentoId}/corrigir/valor\\?`),
    );
    await escolherMotivoDoEmitente(page);
    // O chip chega marcado, e nenhum arquivo foi escolhido no navegador.
    await expect(
      page.getByRole("button", { name: /Usar a nota anexada em/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel(CAMPO_VALOR).fill("2500,00");
    await page.getByRole("button", { name: /^Gravar/ }).click();
    await expect(page.getByRole("status").first()).toContainText("Corrigido.");

    // Duas linhas, o mesmo path, dois atos — e ZERO objeto novo no bucket.
    const anexos = await anexosDoDocumento(db);
    expect(anexos).toHaveLength(2);
    expect(anexos.map((a) => a.arquivo_path)).toEqual([papel, papel]);
    expect(new Set(anexos.map((a) => a.revisao_id)).size).toBe(2);
    expect((await arquivosNoAcervo(db, "documento")).length).toBe(
      acervoAntes.length,
    );
  });

  test('"Pular esta e continuar" NÃO grava nada e leva à próxima', async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await nota261(db, favorecidoId);

    await page.goto(
      `/documento/${documentoId}/corrigir/numero?pacote=valor&anexo=`,
    );
    await escolherMotivoDeDigitacao(page);
    await page.getByLabel(CAMPO_NUMERO).fill("263");

    // Em modo pacote, "Cancelar" deu lugar ao pulo — e o pulo não pede
    // confirmação, porque nada foi gravado neste passo ainda.
    await expect(page.getByRole("link", { name: "Cancelar" })).toHaveCount(0);
    await page
      .getByRole("link", { name: "Pular esta e continuar: corrigir o valor →" })
      .click();

    await expect(page).toHaveURL(
      new RegExp(`/documento/${documentoId}/corrigir/valor\\?`),
    );
    // Nada foi gravado: o número continua 261 e não há rastro nenhum.
    expect((await documentos(db)).find((d) => d.id === documentoId)!.numero).toBe(
      "261",
    );
    expect(await revisoes(db)).toHaveLength(0);
    expect(await anexosDoDocumento(db)).toHaveLength(0);
  });

  test("?anexo que não está neste documento: avisa, e não pré-seleciona nada", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await nota261(db, favorecidoId);
    // Um anexo adicional REAL, para os chips existirem — o `?anexo` abaixo
    // aponta para outro papel, que não é deste documento.
    const correcao = await db.rpc("corrigir_numero_documento", {
      p_documento_id: documentoId,
      p_numero: "262",
      p_serie: null,
      p_motivo: "emitente_corrigiu_a_nota",
      p_anexo_path: `${USER_ID_SEED}/documento/nfse-262.pdf`,
    });
    expect(correcao.error).toBeNull();

    const intruso = `${USER_ID_SEED}/documento/papel-de-outra-nota.pdf`;
    await page.goto(
      `/documento/${documentoId}/corrigir/numero?pacote=&anexo=${encodeURIComponent(intruso)}`,
    );
    await escolherMotivoDoEmitente(page);

    await expect(
      page.getByText(
        "O papel indicado não está neste documento — escolha um abaixo ou anexe.",
      ),
    ).toBeVisible();
    // ⚠️ Nada pré-selecionado: o path da querystring é digitável à mão, e aceitá-lo
    // sem conferir mandaria à RPC um papel que a tela nunca viu neste documento.
    await expect(
      page.getByRole("button", { name: /Usar a nota anexada em/ }),
    ).toHaveAttribute("aria-pressed", "false");
    await page.getByLabel(CAMPO_NUMERO).fill("263");
    await expect(
      page.getByRole("button", {
        name: "Anexe ou escolha um documento já anexado para gravar",
      }),
    ).toBeDisabled();

    // E o papel intruso não entrou em lugar nenhum.
    expect(
      (await anexosDoDocumento(db)).map((a) => a.arquivo_path),
    ).not.toContain(intruso);
  });

  test("fora do pacote, as três rotas continuam exatamente como antes", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await nota261(db, favorecidoId);

    for (const rota of ["numero", "valor", "retencao"]) {
      await page.goto(`/documento/${documentoId}/corrigir/${rota}`);
      await escolherMotivoDoEmitente(page);
      // Sem `?pacote`: nenhum botão de avanço, nenhum pulo, "Cancelar" de volta.
      await expect(
        page.getByRole("link", { name: /^Pular esta e continuar/ }),
      ).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Cancelar" })).toBeVisible();
      // E nenhuma prévia pré-gravação: o critério 13 vale só em modo pacote.
      await expect(
        page.getByText("O papel que prova esta correção"),
      ).toHaveCount(0);
    }
  });
});
