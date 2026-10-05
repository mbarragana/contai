import type { Page } from "@playwright/test";

import { OBRA_ID_SEED, USER_ID_SEED } from "./ambiente";
import {
  anexosDoDocumento,
  anosAfetados,
  criarDocumento,
  criarFavorecido,
  documentos,
  pendencias,
  revisoes,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * CONTAI-085 contra o Postgres LOCAL. Dívida D89, caso real: a NFS-e nº 261 da
 * prestadora foi CANCELADA e reemitida como nº 263 — mesmo valor, número
 * diferente. O acervo apontava para um papel cancelado como se fosse o vigente.
 *
 * O que se prova aqui não é o que a tela mostrou: é o ESTADO GRAVADO — o número,
 * a série, as linhas de rastro do MESMO ato, o `arquivo_path` INTACTO e o
 * snapshot de anos afetados VAZIO. Nada é stubado: a migration 0027 roda de
 * verdade, como `security invoker`, sob a mesma RLS do app.
 */

const CNPJ_PRESTADORA = "11222333000144";

async function cenarioFavorecido(db: Db) {
  return criarFavorecido(db, {
    tipo: "pj",
    nome: "PerfuraTec Serviços",
    documento: CNPJ_PRESTADORA,
  });
}

/** A nota já registrada, com número e série — o estado de onde a dor parte. */
async function notaRegistrada(
  db: Db,
  favorecidoId: string,
  numero: string,
  serie: string | null,
) {
  return criarDocumento(db, {
    tipo: "nf_servico",
    favorecido_id: favorecidoId,
    valor: 59901,
    classificacao: "mao_obra",
    destinatario_cpf_ok: true,
    numero,
    serie,
    data_emissao: "2026-09-10",
    arquivo_path: `${USER_ID_SEED}/documento/nfse-${numero}.pdf`,
  });
}

/** Passo 1 da correção: o motivo, que nunca nasce escolhido. */
async function escolherMotivoDeDigitacao(page: Page) {
  await page
    .getByRole("button", { name: "Só aqui no app — eu digitei errado" })
    .click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}

async function escolherMotivoDoEmitente(page: Page) {
  await page
    .getByRole("button", { name: "A nota estava errada e o emitente já corrigiu" })
    .click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}

const CAMPO_NUMERO = "Número que está no papel";
const CAMPO_SERIE = "Série (deixe em branco se a nota não tem)";

test.describe("corrigir o número/série de um documento já registrado", () => {
  test("grava número e série, duas linhas de rastro no MESMO ato, e NÃO toca o arquivo original", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId, "261", "1");
    const arquivoOriginal = (await documentos(db))[0].arquivo_path;

    await page.goto(`/documento/${documentoId}/corrigir/numero`);
    await escolherMotivoDeDigitacao(page);
    await page.getByLabel(CAMPO_NUMERO).fill("263");
    await page.getByLabel(CAMPO_SERIE).fill("2");
    await page.getByRole("button", { name: /^Gravar/ }).click();
    await expect(page.getByRole("status")).toContainText("Corrigido.");

    // (i) o número e a série novos, no documento
    const doc = (await documentos(db)).find((d) => d.id === documentoId)!;
    expect(doc.numero).toBe("263");
    expect(doc.serie).toBe("2");

    // (ii) DUAS linhas de rastro — uma por campo que mudou — e UM ato só
    const rastro = await revisoes(db);
    expect(rastro).toHaveLength(2);
    expect(new Set(rastro.map((r) => r.ato_id)).size).toBe(1);
    expect(rastro.map((r) => r.campo).sort()).toEqual(["numero", "serie"]);
    expect(rastro.find((r) => r.campo === "numero")).toMatchObject({
      entidade: "documento",
      entidade_id: documentoId,
      antes: "261",
      depois: "263",
      motivo: "erro_de_digitacao_minha",
      motivo_texto: null,
    });
    expect(rastro.find((r) => r.campo === "serie")).toMatchObject({
      entidade: "documento",
      antes: "1",
      depois: "2",
    });

    // (iii) ⚠️ ANOS AFETADOS VAZIO, e é o Gate Fiscal: §0(a) — o único campo de
    // `documento` que move custo entre anos-calendário é `valor`. Número nunca
    // entrou na conta `C = min(Σ pagamentos, Σ documentos)`, e por isso também
    // não nasce pendência de retificadora.
    expect(await anosAfetados(db)).toHaveLength(0);
    expect(await pendencias(db)).toHaveLength(0);

    // (iv) ⚠️ `arquivo_path` INTACTO (critério 7): a nota nova entra como anexo
    // adicional, nunca por cima do papel original. Aqui o motivo foi "eu digitei
    // errado", então não há anexo nenhum — e o original continua onde estava.
    expect(doc.arquivo_path).toBe(arquivoOriginal);
    expect(await anexosDoDocumento(db)).toHaveLength(0);

    // (v) o histórico mostra AS DUAS linhas do ato (critério 15) — e NÃO diz
    // "com 1 nota". Aquela frase é a do MOVE DE OBRA ("o documento foi, e 1
    // pagamento foi com ele"): aqui nenhum outro papel se mexeu, e afirmar que
    // sim é mentir numa tela cujo propósito é ser lida em 2034.
    await page.goto(`/documento/${documentoId}`);
    await expect(page.getByText("número da nota", { exact: true })).toBeVisible();
    await expect(page.getByText("261 → 263")).toBeVisible();
    await expect(page.getByText("série da nota: 1 → 2")).toBeVisible();
    await expect(page.getByText("com 1 nota")).toHaveCount(0);
  });

  test("zeros à esquerda são preservados: '0263' NÃO é '263'", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId, "263", null);

    await page.goto(`/documento/${documentoId}/corrigir/numero`);
    await escolherMotivoDeDigitacao(page);
    // ⚠️ A PROVA do pre-mortem 1: com parse numérico os dois seriam o mesmo
    // valor e o botão diria "Nada a corrigir". Comparação literal os trata como
    // notas diferentes — NFS-e municipal usa numeração própria.
    await page.getByLabel(CAMPO_NUMERO).fill("0263");
    await page.getByRole("button", { name: /^Gravar/ }).click();
    await expect(page.getByRole("status")).toContainText("Corrigido.");

    const doc = (await documentos(db)).find((d) => d.id === documentoId)!;
    expect(doc.numero).toBe("0263");
    const rastro = await revisoes(db);
    expect(rastro).toHaveLength(1);
    expect(rastro[0]).toMatchObject({ campo: "numero", antes: "263", depois: "0263" });
    // A série continua `null` — ela não mudou, e linha de rastro de campo que
    // não mudou é "uma correção que não aconteceu".
    expect(doc.serie).toBeNull();
  });

  test("igual ao gravado: botão desabilitado, 'Nada a corrigir' — e a RPC também recusa", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId, "261", "1");

    await page.goto(`/documento/${documentoId}/corrigir/numero`);
    await escolherMotivoDeDigitacao(page);

    // Vazio: ainda não há o que gravar.
    const botao = page.getByRole("button", {
      name: "Digite o número da nota para continuar",
    });
    await expect(botao).toBeDisabled();

    // Exatamente o gravado, nos dois campos.
    await page.getByLabel(CAMPO_NUMERO).fill("261");
    await page.getByLabel(CAMPO_SERIE).fill("1");
    const nada = page.getByRole("button", { name: "Nada a corrigir" });
    await expect(nada).toBeVisible();
    await expect(nada).toBeDisabled();

    // ⚠️ E a guarda é do BANCO também, não só do botão: a promessa é do ato.
    const recusa = await db.rpc("corrigir_numero_documento", {
      p_documento_id: documentoId,
      p_numero: "261",
      p_serie: "1",
      p_motivo: "erro_de_digitacao_minha",
    });
    expect(recusa.error).not.toBeNull();
    expect(await revisoes(db)).toHaveLength(0);

    // Mudar SÓ a série já é correção real (série é campo próprio, R6).
    await page.getByLabel(CAMPO_SERIE).fill("");

    // ⚠️ Ressalva do Gate 2: "o que fica registrado" mostra UMA LINHA POR CAMPO
    // QUE MUDOU. Com só a série mudando, a linha do número NÃO aparece — a tela
    // anunciaria *"campo numero: 261 → 261"*, um rastro que a RPC não grava
    // (`is distinct from`) e que o banco recusaria
    // (`revisao_antes_difere_depois`, 0009).
    await expect(page.getByText("campo serie", { exact: true })).toBeVisible();
    await expect(page.getByText("campo numero", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: /^Gravar/ }).click();
    await expect(page.getByRole("status")).toContainText("Corrigido.");
    const doc = (await documentos(db)).find((d) => d.id === documentoId)!;
    expect(doc.numero).toBe("261");
    // ⚠️ `null`, nunca `''`: "sem série" é um estado, não uma string vazia.
    expect(doc.serie).toBeNull();
    const rastro = await revisoes(db);
    expect(rastro).toHaveLength(1);
    expect(rastro[0]).toMatchObject({ campo: "serie", antes: "1", depois: null });
  });

  test("duplicidade avisa e NÃO bloqueia: o custo em dobro é decisão do Mateus (§7)", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    // A nota 263 JÁ está registrada nesta obra, deste emitente, sem série.
    const jaRegistrada = await notaRegistrada(db, favorecidoId, "263", null);
    // E a 261, que o Mateus vai corrigir para 263 — colidindo com a de cima.
    const documentoId = await notaRegistrada(db, favorecidoId, "261", null);

    await page.goto(`/documento/${documentoId}/corrigir/numero`);
    await escolherMotivoDeDigitacao(page);
    await page.getByLabel(CAMPO_NUMERO).fill("263");

    const aviso = page.getByRole("status").filter({ hasText: "conta o custo em dobro" });
    await expect(aviso).toBeVisible();
    await expect(aviso.getByRole("link", { name: "Ver registro existente" })).toHaveAttribute(
      "href",
      `/documento/${jaRegistrada}`,
    );

    // ⚠️ AVISO, NUNCA BLOQUEIO (Gate Fiscal §7, "só o Mateus" decide qual
    // duplicata é a boa). O botão continua habilitado e a gravação acontece.
    const gravar = page.getByRole("button", { name: "Gravar a correção" });
    await expect(gravar).toBeEnabled();
    await gravar.click();
    await expect(
      page.getByRole("status").filter({ hasText: "Corrigido." }),
    ).toBeVisible();

    const doc = (await documentos(db)).find((d) => d.id === documentoId)!;
    expect(doc.numero).toBe("263");
    expect(await revisoes(db)).toHaveLength(1);
  });

  test("o próprio documento não é duplicata de si mesmo (pre-mortem 2)", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId, "263", "1");
    // Isca do MESMO emitente, para servir de CONTROLE POSITIVO: sem ele, o
    // `toHaveCount(0)` do fim passaria de graça se o debounce nunca disparasse —
    // e um teste que passa por não ter rodado nada é pior do que teste nenhum.
    const isca = await notaRegistrada(db, favorecidoId, "999", null);

    await page.goto(`/documento/${documentoId}/corrigir/numero`);
    await escolherMotivoDeDigitacao(page);

    // Controle positivo: o mecanismo ESTÁ vivo nesta tela.
    await page.getByLabel(CAMPO_NUMERO).fill("999");
    const aviso = page.getByText("conta o custo em dobro na declaração");
    await expect(aviso).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ver registro existente" }),
    ).toHaveAttribute("href", `/documento/${isca}`);

    // Agora o número e a série do PRÓPRIO registro em edição. Sem o filtro do
    // pre-mortem 2, o aviso apareceria aqui apontando para ele mesmo — colado no
    // estado "Nada a corrigir", que é onde ele mais assusta e menos informa.
    await page.getByLabel(CAMPO_NUMERO).fill("263");
    await page.getByLabel(CAMPO_SERIE).fill("1");
    await expect(page.getByRole("button", { name: "Nada a corrigir" })).toBeDisabled();
    await expect(aviso).toHaveCount(0);
  });

  test("motivo 'o emitente corrigiu a nota' não grava sem o documento novo", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId, "261", null);
    const arquivoOriginal = (await documentos(db))[0].arquivo_path;

    await page.goto(`/documento/${documentoId}/corrigir/numero`);
    await escolherMotivoDoEmitente(page);
    await page.getByLabel(CAMPO_NUMERO).fill("263");

    // A tela recusa pelo botão — e o rótulo diz o que falta.
    const bloqueado = page.getByRole("button", {
      name: "Anexe o documento novo para gravar",
    });
    await expect(bloqueado).toBeVisible();
    await expect(bloqueado).toBeDisabled();

    // ⚠️ E o BANCO recusa igual (parecer §5, regra dura 2): a promessa é do ato,
    // não da tela. Promessa quebrada por um botão é o defeito do Gate 2 do
    // CONTAI-021, e ele não se repete aqui.
    const semAnexo = await db.rpc("corrigir_numero_documento", {
      p_documento_id: documentoId,
      p_numero: "263",
      p_serie: null,
      p_motivo: "emitente_corrigiu_a_nota",
    });
    expect(semAnexo.error).not.toBeNull();
    expect(await revisoes(db)).toHaveLength(0);
    expect((await documentos(db))[0].numero).toBe("261");

    // Com o anexo, grava — e o anexo é ADICIONAL: `documento.arquivo_path`
    // continua o que era, e o dossiê passa a listar os DOIS arquivos.
    const comAnexo = await db.rpc("corrigir_numero_documento", {
      p_documento_id: documentoId,
      p_numero: "263",
      p_serie: null,
      p_motivo: "emitente_corrigiu_a_nota",
      p_anexo_path: `${USER_ID_SEED}/documento/nfse-263-substitutiva.pdf`,
    });
    expect(comAnexo.error).toBeNull();

    const rastro = await revisoes(db);
    expect(rastro).toHaveLength(1);
    expect(rastro[0]).toMatchObject({
      campo: "numero",
      antes: "261",
      depois: "263",
      motivo: "emitente_corrigiu_a_nota",
    });
    const anexos = await anexosDoDocumento(db);
    expect(anexos).toHaveLength(1);
    expect(anexos[0]).toMatchObject({
      documento_id: documentoId,
      revisao_id: rastro[0].id,
    });
    expect((await documentos(db))[0].arquivo_path).toBe(arquivoOriginal);
    expect(await anosAfetados(db)).toHaveLength(0);
  });

  test("a RPC recusa apagar o número, e recusa os motivos de outros atos", async ({
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId, "261", null);

    // `numero` não se apaga: sem ele a nota sai da discriminação anual e da
    // lista de cobrança do CNO — regressão de acervo disfarçada de correção.
    for (const p_numero of [null, "   "]) {
      const r = await db.rpc("corrigir_numero_documento", {
        p_documento_id: documentoId,
        p_numero: p_numero as unknown as string,
        p_serie: null,
        p_motivo: "erro_de_digitacao_minha",
      });
      expect(r.error).not.toBeNull();
    }

    // Série vazia se grava como `null`, nunca como `''`.
    const serieVazia = await db.rpc("corrigir_numero_documento", {
      p_documento_id: documentoId,
      p_numero: "263",
      p_serie: "",
      p_motivo: "erro_de_digitacao_minha",
    });
    expect(serieVazia.error).not.toBeNull();

    // Os dois motivos que a MÁQUINA grava em OUTROS atos (move de obra e anexo
    // tardio do comprovante) não descrevem correção de número — e a função os
    // recusa, em vez de deixar o acervo com um rastro que mente.
    for (const p_motivo of ["arquivamento_corrigido", "comprovante_chegou_depois"] as const) {
      const r = await db.rpc("corrigir_numero_documento", {
        p_documento_id: documentoId,
        p_numero: "263",
        p_serie: null,
        p_motivo,
      });
      expect(r.error).not.toBeNull();
    }

    // Nada disso tocou o acervo.
    expect((await documentos(db))[0].numero).toBe("261");
    expect(await revisoes(db)).toHaveLength(0);
    expect(await anosAfetados(db)).toHaveLength(0);
  });

  test("o link da correção aparece no detalhe do documento (critério 14)", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId, "261", "1");

    await page.goto(`/documento/${documentoId}`);
    const link = page.getByRole("link", { name: /Corrigir o número\/série/ });
    await expect(link).toBeVisible();
    await expect(link).toContainText("hoje: Nº 261");
    await link.click();
    await expect(page).toHaveURL(
      new RegExp(`/documento/${documentoId}/corrigir/numero$`),
    );
    // A obra do cenário é a do seed — o painel não é carregado por esta tela, e
    // o cabeçalho nasce com o emitente, não com "carregando" eterno.
    expect(OBRA_ID_SEED).toBeTruthy();
    await expect(page.getByText("Número gravado hoje")).toBeVisible();
  });
});
