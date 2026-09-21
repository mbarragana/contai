import type { Page } from "@playwright/test";

import { OBRA_ID_SEED, OBRA_SEED, USER_ID_SEED } from "./ambiente";
import {
  anexosDoDocumento,
  anosAfetados,
  criarDocumento,
  criarFavorecido,
  criarObra,
  criarPagamento,
  criarVinculo,
  desfechosDePendencia,
  documentos,
  favorecidos,
  pagamentos,
  pendencias,
  revisoes,
  vinculos,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * CONTAI-021 contra o Postgres LOCAL. O que se prova aqui não é o que a tela
 * mostrou: é o ESTADO GRAVADO — o valor, a linha de rastro, o snapshot de custo
 * por ano e por obra, e a pendência. É esse estado que vira discriminação de
 * Bens e Direitos e conversa de retificadora anos depois.
 *
 * Nada é stubado. As funções da migration 0009 rodam de verdade, como
 * `security invoker`, sob a MESMA RLS do app.
 */

const CNPJ_DEPOSITO = "12345678000199";
const REFORMA = "Reforma do apartamento";

async function cenarioFavorecido(db: Db) {
  return criarFavorecido(db, {
    tipo: "pj",
    nome: "Depósito Ilha",
    documento: CNPJ_DEPOSITO,
  });
}

/** Passo 1 da correção: o motivo, que nunca nasce escolhido. */
async function escolherMotivoDeDigitacao(page: Page) {
  await page
    .getByRole("button", { name: "Só aqui no app — eu digitei errado" })
    .click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}

async function corrigirValor(page: Page, documentoId: string, valor: string) {
  await page.goto(`/documento/${documentoId}/corrigir/valor`);
  await escolherMotivoDeDigitacao(page);
  await page.getByLabel("Valor que está no papel").fill(valor);
  await page.getByRole("button", { name: /^Gravar/ }).click();
  await expect(page.getByRole("status")).toContainText("Corrigido.");
}

test.describe("corrigir o valor de um documento já registrado (critério 15)", () => {
  test("grava o valor, a linha de rastro e o custo do ano — e o rastro não aceita update nem delete", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await criarDocumento(db, {
      tipo: "nf_material",
      favorecido_id: favorecidoId,
      valor: 1280,
      classificacao: "material",
      destinatario_cpf_ok: true,
    });
    const pagamentoId = await criarPagamento(db, {
      favorecido_id: favorecidoId,
      valor: 12800,
      data_pagamento: "2025-11-12",
      meio: "pix",
      comprovante_path: "u/comprovante/pix.png",
    });
    await criarVinculo(db, pagamentoId, documentoId);

    await corrigirValor(page, documentoId, "12.800,00");

    // (i) o valor novo
    const doc = (await documentos(db)).find((d) => d.id === documentoId)!;
    expect(Number(doc.valor)).toBe(12800);

    // (ii) a linha de rastro, com antes/depois como TEXTO
    const rastro = await revisoes(db);
    expect(rastro).toHaveLength(1);
    expect(rastro[0]).toMatchObject({
      entidade: "documento",
      entidade_id: documentoId,
      campo: "valor",
      antes: "1280.00",
      depois: "12800.00",
      motivo: "erro_de_digitacao_minha",
      motivo_texto: null,
    });

    // (iii) o custo por ano recalculado, no snapshot — e POR OBRA
    const anos = await anosAfetados(db);
    expect(anos).toHaveLength(1);
    expect(anos[0]).toMatchObject({
      revisao_id: rastro[0].id,
      obra_id: OBRA_ID_SEED,
      ano: 2025,
    });
    expect(Number(anos[0].custo_antes)).toBe(1280);
    expect(Number(anos[0].custo_depois)).toBe(12800);
    // 2025 é ano anterior a 2026: abre pendência (§5.3, linha 2).
    expect(anos[0].pendencia_id).not.toBeNull();

    // (iv) APPEND-ONLY NA ESTRUTURA, não por convenção. O papel do app não tem
    // `update` nem `delete` em `revisao` (migration 0009) — e é o BANCO que
    // recusa, não a disciplina de quem escrever a próxima tela.
    const tentouEditar = await db
      .from("revisao")
      .update({ depois: "999.00" })
      .eq("id", rastro[0].id);
    expect(tentouEditar.error?.code).toBe("42501");

    const tentouApagar = await db.from("revisao").delete().eq("id", rastro[0].id);
    expect(tentouApagar.error?.code).toBe("42501");

    // E a linha continua exatamente como estava.
    expect((await revisoes(db))[0].depois).toBe("12800.00");

    // (v) O HISTÓRICO mostra o motivo COMO O MATEUS O ESCOLHEU — a frase
    // inteira do mock aprovado, não o token do enum. Quem lê este acervo em
    // 2034 (meta 3) não tem o `motivo_revisao` à mão para traduzir
    // "erro de digitacao minha". Regressão travada aqui porque o defeito era
    // invisível para as asserções de estado gravado acima: o banco estava
    // certo, a tela é que falava enum.
    await page.goto(`/documento/${documentoId}`);
    await expect(page.getByText("Histórico de correções")).toBeVisible();
    await expect(
      page.getByText("motivo: eu digitei errado no app — o papel está certo"),
    ).toBeVisible();
  });

  test("valor igual ao gravado não vira linha de histórico", async ({ page, db }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await criarDocumento(db, {
      tipo: "nf_material",
      favorecido_id: favorecidoId,
      valor: 1280,
      classificacao: "material",
      destinatario_cpf_ok: true,
    });

    await page.goto(`/documento/${documentoId}/corrigir/valor`);
    await escolherMotivoDeDigitacao(page);
    await page.getByLabel("Valor que está no papel").fill("1.280,00");

    // O botão diz o motivo no próprio rótulo — botão cinza mudo é o que faz o
    // usuário achar que o app quebrou.
    await expect(
      page.getByRole("button", { name: "Nada a corrigir" }),
    ).toBeDisabled();
    expect(await revisoes(db)).toHaveLength(0);
  });
});

test.describe("mover documento entre obras (critérios 13 e 20)", () => {
  /**
   * O cenário do parecer, adendo §5.2, com os números dele: NF de R$ 9.400,00,
   * PIX de R$ 6.000,00 (20/10/2025) e boleto de R$ 3.400,00 (05/12/2025).
   */
  async function cenarioDoParecer(db: Db) {
    const favorecidoId = await cenarioFavorecido(db);
    const reformaId = await criarObra(db, {
      nome: REFORMA,
      cno: null,
      data_inicio_obra: "2025-03-01",
    });
    const documentoId = await criarDocumento(db, {
      tipo: "nf_material",
      favorecido_id: favorecidoId,
      valor: 9400,
      classificacao: "material",
      destinatario_cpf_ok: true,
    });
    const pixId = await criarPagamento(db, {
      favorecido_id: favorecidoId,
      valor: 6000,
      data_pagamento: "2025-10-20",
      meio: "pix",
      comprovante_path: "u/comprovante/pix.png",
    });
    const boletoId = await criarPagamento(db, {
      favorecido_id: favorecidoId,
      valor: 3400,
      data_pagamento: "2025-12-05",
      meio: "boleto",
      comprovante_path: "u/comprovante/boleto.png",
    });
    await criarVinculo(db, pixId, documentoId);
    await criarVinculo(db, boletoId, documentoId);
    return { reformaId, documentoId, pixId, boletoId };
  }

  async function responder(page: Page, pagamentoId: string, texto: string) {
    await page
      .locator(`[data-pagamento="${pagamentoId}"]`)
      .getByRole("button", { name: texto, exact: true })
      .click();
  }

  test("desfecho MISTO: uma pendência de 2025, com as DUAS obras e o delta de cada uma", async ({
    page,
    db,
  }) => {
    const c = await cenarioDoParecer(db);

    await page.goto(`/documento/${c.documentoId}/obra`);
    await page.getByRole("button", { name: REFORMA }).click();
    await responder(page, c.pixId, `Este pagamento também é da ${REFORMA}`);
    await responder(page, c.boletoId, `Este pagamento é mesmo da ${OBRA_SEED.nome}`);

    await page
      .getByRole("button", { name: "Mover o registro para a obra escolhida" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Obra corrigida ✓" }),
    ).toBeVisible();

    // O documento e o PIX foram junto; o boleto ficou, e o vínculo dele sumiu.
    const doc = (await documentos(db)).find((d) => d.id === c.documentoId)!;
    expect(doc.obra_id).toBe(c.reformaId);
    const pags = await pagamentos(db);
    expect(pags.find((p) => p.id === c.pixId)!.obra_id).toBe(c.reformaId);
    expect(pags.find((p) => p.id === c.boletoId)!.obra_id).toBe(OBRA_ID_SEED);
    expect((await vinculos(db)).map((v) => v.pagamento_id)).toEqual([c.pixId]);
    // `status` volta a "pago sem nota" — que aqui é a VERDADE (§5.2(ii)).
    expect(pags.find((p) => p.id === c.boletoId)!.status).toBe("aguardando_nf");

    // TRÊS linhas de rastro, UM ato: no banco elas são granulares, na tela são
    // uma correção só (critério 13).
    const rastro = await revisoes(db);
    expect(rastro).toHaveLength(3);
    expect(new Set(rastro.map((r) => r.ato_id)).size).toBe(1);
    expect(rastro.every((r) => r.motivo === "arquivamento_corrigido")).toBe(true);
    expect(
      rastro.map((r) => `${r.entidade}:${r.campo}`).sort(),
    ).toEqual(["documento:obra", "pagamento:obra", "pagamento:vinculo"]);

    // ⚠️ O CONJUNTO DE OBRAS AFETADAS vem do RASTRO (`antes ∪ depois` do campo
    // `obra`), nunca de `documento.obra_id` — depois do move o documento só
    // conhece o DESTINO, e a ORIGEM é justamente o lado onde o custo caiu.
    const anos = await anosAfetados(db);
    expect(anos).toHaveLength(2);
    const porObra = new Map(anos.map((a) => [a.obra_id, a]));
    expect(Number(porObra.get(OBRA_ID_SEED)!.custo_antes)).toBe(9400);
    expect(Number(porObra.get(OBRA_ID_SEED)!.custo_depois)).toBe(0);
    expect(Number(porObra.get(c.reformaId)!.custo_antes)).toBe(0);
    // min(6.000; 9.400) = 6.000 — o número do parecer, ao centavo.
    expect(Number(porObra.get(c.reformaId)!.custo_depois)).toBe(6000);

    // É UMA pendência, não duas: a chave é o ANO, porque a DAA é do
    // contribuinte e não da obra.
    const abertas = await pendencias(db);
    expect(abertas).toHaveLength(1);
    expect(abertas[0]).toMatchObject({
      tipo: "retificadora_possivel",
      ano: 2025,
      documento_id: null,
    });
    expect(new Set(anos.map((a) => a.pendencia_id))).toEqual(
      new Set([abertas[0].id]),
    );
  });

  test("todos ficam na origem: a obra de DESTINO não entra no conjunto de afetadas", async ({
    page,
    db,
  }) => {
    const c = await cenarioDoParecer(db);

    await page.goto(`/documento/${c.documentoId}/obra`);
    await page.getByRole("button", { name: REFORMA }).click();
    await responder(page, c.pixId, `Este pagamento é mesmo da ${OBRA_SEED.nome}`);
    await responder(page, c.boletoId, `Este pagamento é mesmo da ${OBRA_SEED.nome}`);

    await page
      .getByRole("button", { name: "Mover o registro para a obra escolhida" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Obra corrigida ✓" }),
    ).toBeVisible();

    // Os dois vínculos se desfizeram; nenhum pagamento mudou de obra.
    expect(await vinculos(db)).toHaveLength(0);
    const pags = await pagamentos(db);
    expect(pags.every((p) => p.obra_id === OBRA_ID_SEED)).toBe(true);

    // ⚠️ A Reforma é CANDIDATA e NÃO é afetada: nenhum número dela se mexeu.
    // Sem este filtro, o alarme acenderia numa obra onde nada mudou —
    // contradizendo o §5.3 na frase seguinte a ela.
    const anos = await anosAfetados(db);
    expect(anos).toHaveLength(1);
    expect(anos[0].obra_id).toBe(OBRA_ID_SEED);
    expect(Number(anos[0].custo_antes)).toBe(9400);
    expect(Number(anos[0].custo_depois)).toBe(0);
    expect(anos.some((a) => a.obra_id === c.reformaId)).toBe(false);
  });

  /**
   * Bloqueante 4 do Gate 2 — o LADO INVERSO da guarda de "pagamento indeciso".
   *
   * A função exigia desfecho para todo pagamento vinculado, e ACEITAVA desfecho
   * para pagamento que não está vinculado: gravaria rastro `'vinculo'` de um
   * desligamento que nunca houve, ou moveria `pagamento.obra_id` de um
   * pagamento sem relação nenhuma com o ato. É "rastro de correção que não
   * aconteceu" — o defeito que o critério 9 nomeia — dentro da função que
   * existe para impedi-lo.
   *
   * Chamada DIRETA ao RPC, pelo mesmo client autenticado: a tela nunca monta
   * esse array, e é justamente por isso que a guarda tem de ser do banco.
   */
  test("desfecho para pagamento NÃO vinculado é recusado, e o ato inteiro não grava", async ({
    db,
  }) => {
    const c = await cenarioDoParecer(db);
    const avulso = await criarPagamento(db, {
      valor: 1000,
      data_pagamento: "2025-09-01",
      meio: "pix",
      comprovante_path: "u/comprovante/avulso.png",
    });

    const recusado = await db.rpc("mover_documento_de_obra", {
      p_documento_id: c.documentoId,
      p_obra_destino: c.reformaId,
      p_pagamentos: [
        { pagamento_id: c.pixId, desfecho: "vai_junto" },
        { pagamento_id: c.boletoId, desfecho: "fica_na_origem" },
        { pagamento_id: avulso, desfecho: "vai_junto" },
      ],
      p_anos: [],
    });
    expect(recusado.error).not.toBeNull();

    // ⚠️ ATOMICIDADE (adendo §5.5): o `update documento` acontece ANTES do laço,
    // e mesmo assim NADA sobrou. "Se a transação não fechar, nada muda."
    const doc = (await documentos(db)).find((d) => d.id === c.documentoId)!;
    expect(doc.obra_id).toBe(OBRA_ID_SEED);
    expect((await pagamentos(db)).every((p) => p.obra_id === OBRA_ID_SEED)).toBe(
      true,
    );
    expect(await vinculos(db)).toHaveLength(2);
    expect(await revisoes(db)).toHaveLength(0);
  });

  test("sem pagamento ligado, o move grava rastro e NÃO abre pendência", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    await criarObra(db, {
      nome: REFORMA,
      cno: null,
      data_inicio_obra: "2025-03-01",
    });
    const documentoId = await criarDocumento(db, {
      tipo: "nf_material",
      favorecido_id: favorecidoId,
      valor: 9400,
      classificacao: "material",
      destinatario_cpf_ok: true,
    });

    await page.goto(`/documento/${documentoId}/obra`);
    await page.getByRole("button", { name: REFORMA }).click();
    await page
      .getByRole("button", { name: "Mover o registro para a obra escolhida" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Obra corrigida ✓" }),
    ).toBeVisible();

    // Rastro sempre — "ter pagamento vinculado" é estado FUTURO, e o rastro que
    // não foi gravado não se recupera (parecer §5, mudança de posição).
    expect(await revisoes(db)).toHaveLength(1);
    // Documento sozinho comprova ZERO dos dois lados: nenhum número mudou.
    expect(await anosAfetados(db)).toHaveLength(0);
    expect(await pendencias(db)).toHaveLength(0);
  });
});

/**
 * Bloqueante 2 do Gate 2 — os DOIS revisores. `corrigir_nome_favorecido`
 * gravava `emitente_corrigiu_a_nota` SEM anexo enquanto `corrigir_documento` o
 * exigia, e o passo 1 (compartilhado pelas três telas) já PROMETIA "sem ele,
 * esta correção não grava". Promessa quebrada por um botão.
 */
test.describe("corrigir o nome do emitente (critério 6)", () => {
  test("motivo 'o emitente corrigiu a nota' não grava sem o documento novo", async ({
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await criarDocumento(db, {
      tipo: "nf_material",
      favorecido_id: favorecidoId,
      valor: 9400,
      classificacao: "material",
      destinatario_cpf_ok: true,
    });

    const semAnexo = await db.rpc("corrigir_nome_favorecido", {
      p_favorecido_id: favorecidoId,
      p_documento_id: documentoId,
      p_nome: "Depósito Ilha Materiais de Construção LTDA",
      p_motivo: "emitente_corrigiu_a_nota",
    });
    expect(semAnexo.error).not.toBeNull();

    // Nada mudou: nem o nome, nem o rastro.
    expect((await favorecidos(db))[0].nome).toBe("Depósito Ilha");
    expect(await revisoes(db)).toHaveLength(0);
    expect(await anexosDoDocumento(db)).toHaveLength(0);

    // Com o anexo, grava — e o anexo é ADICIONAL: `arquivo_path` do documento
    // continua o que era (parecer §1, "o anexo é a prova; não se substitui").
    const arquivoOriginal = (await documentos(db))[0].arquivo_path;
    const comAnexo = await db.rpc("corrigir_nome_favorecido", {
      p_favorecido_id: favorecidoId,
      p_documento_id: documentoId,
      p_nome: "Depósito Ilha Materiais de Construção LTDA",
      p_motivo: "emitente_corrigiu_a_nota",
      p_anexo_path: `${USER_ID_SEED}/documento/nota-substitutiva.pdf`,
    });
    expect(comAnexo.error).toBeNull();

    const rastro = await revisoes(db);
    expect(rastro).toHaveLength(1);
    expect(rastro[0]).toMatchObject({
      entidade: "favorecido",
      campo: "nome",
      antes: "Depósito Ilha",
      motivo: "emitente_corrigiu_a_nota",
    });
    const anexos = await anexosDoDocumento(db);
    expect(anexos).toHaveLength(1);
    expect(anexos[0]).toMatchObject({
      documento_id: documentoId,
      revisao_id: rastro[0].id,
    });
    expect((await documentos(db))[0].arquivo_path).toBe(arquivoOriginal);
    // Nome corrigido NÃO abre pendência: o custo não muda um centavo (§4).
    expect(await pendencias(db)).toHaveLength(0);
  });
});

test.describe("o ciclo da pendência de retificadora (critério 21)", () => {
  test("abre, acumula, baixa com desfecho — e uma correção nova abre pendência NOVA", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);

    async function notaPagaEm2025(valorNota: number, valorPago: number, dia: string) {
      const documentoId = await criarDocumento(db, {
        tipo: "nf_material",
        favorecido_id: favorecidoId,
        valor: valorNota,
        classificacao: "material",
        destinatario_cpf_ok: true,
      });
      const pagamentoId = await criarPagamento(db, {
        favorecido_id: favorecidoId,
        valor: valorPago,
        data_pagamento: dia,
        meio: "pix",
        comprovante_path: "u/comprovante/pix.png",
      });
      await criarVinculo(db, pagamentoId, documentoId);
      return documentoId;
    }

    const primeira = await notaPagaEm2025(1280, 12800, "2025-11-12");
    const segunda = await notaPagaEm2025(2300, 8530, "2025-11-20");
    const terceira = await notaPagaEm2025(1000, 2250, "2025-12-01");

    // ── 1. abre ────────────────────────────────────────────────────────
    await corrigirValor(page, primeira, "12.800,00");
    let abertas = await pendencias(db);
    expect(abertas).toHaveLength(1);
    expect(abertas[0].ano).toBe(2025);

    // ── 2. ACUMULA na mesma: cinco correções não viram cinco linhas ─────
    await corrigirValor(page, segunda, "8.530,00");
    abertas = await pendencias(db);
    expect(abertas).toHaveLength(1);
    const primeiraPendencia = abertas[0].id;
    expect(
      (await anosAfetados(db)).filter((a) => a.pendencia_id === primeiraPendencia),
    ).toHaveLength(2);

    // ── 3. baixa, em ato nomeado e com desfecho escolhido ──────────────
    await page.goto(`/pendencias/${primeiraPendencia}`);
    await page.getByRole("button", { name: "Marcar como tratada" }).click();
    // Nada nasce marcado, e o app não sugere nenhum dos três.
    await expect(
      page.getByRole("button", { name: "Escolha o desfecho para continuar" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Retifiquei a DAA de 2025" }).click();
    await page.getByLabel("Data — obrigatória").fill("2026-08-18");
    await page.getByRole("button", { name: "Marcar como tratada" }).click();
    await expect(page.getByRole("status")).toContainText("Baixada");

    // A baixa é INSERT, não update: a pendência CONTINUA no banco.
    expect(await pendencias(db)).toHaveLength(1);
    const desfechos = await desfechosDePendencia(db);
    expect(desfechos).toHaveLength(1);
    expect(desfechos[0]).toMatchObject({
      pendencia_id: primeiraPendencia,
      tipo: "retificadora_possivel",
      desfecho: "retifiquei_a_daa",
      data_informada: "2026-08-18",
    });

    // ── 4. correção nova depois da baixa abre pendência NOVA ───────────
    await corrigirValor(page, terceira, "2.250,00");
    const todas = await pendencias(db);
    expect(todas).toHaveLength(2);
    const nova = todas.find((p) => p.id !== primeiraPendencia)!;
    expect(nova.ano).toBe(2025);
    // A antiga não reabriu — reabrir apagaria o fato de que ela foi tratada.
    expect((await desfechosDePendencia(db))[0].pendencia_id).toBe(
      primeiraPendencia,
    );
    expect(
      (await anosAfetados(db)).filter((a) => a.pendencia_id === nova.id),
    ).toHaveLength(1);
  });

  test("marcar CNPJ errado duas vezes deixa UMA pendência, e ela não gera rastro", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await criarDocumento(db, {
      tipo: "nf_material",
      favorecido_id: favorecidoId,
      valor: 9400,
      classificacao: "material",
      destinatario_cpf_ok: true,
    });

    const marcar = page.getByRole("button", {
      name: "Marcar: o CNPJ deste registro está errado — tratar",
    });

    await page.goto(`/documento/${documentoId}/cnpj-errado`);
    // Gate 3: o JSX comia o espaço depois de `</strong>` e a tela lia "rodada
    // 2deste trabalho" — divergência do mock aprovado (`CONTAI-021.html`,
    // tela s6c). `getByText` normaliza espaço em branco, mas não INVENTA o que
    // falta: a frase colada não casa com esta asserção.
    await expect(
      page.getByText("é a rodada 2 deste trabalho", { exact: false }),
    ).toBeVisible();
    await marcar.click();
    await expect(page.getByRole("status")).toContainText("Marcado.");

    await page.goto(`/documento/${documentoId}/cnpj-errado`);
    await expect(page.getByRole("status")).toContainText("Marcado.");

    const abertas = await pendencias(db);
    expect(abertas).toHaveLength(1);
    expect(abertas[0]).toMatchObject({
      tipo: "emitente_errado",
      documento_id: documentoId,
      ano: null,
    });

    // Marcar NÃO é correção: nenhum dado do documento mudou, então não há
    // antes → depois a registrar (adendo §1).
    expect(await revisoes(db)).toHaveLength(0);
    const doc = (await documentos(db)).find((d) => d.id === documentoId)!;
    expect(doc.status).toBe("registrado");

    // ⚠️ A lista de desfecho é PRÓPRIA. Os três do critério 21 são todos sobre
    // DAA, e nenhum descreve "resolvi o CNPJ errado" — quem recusa é o BANCO,
    // pelo check + FK composto da migration 0009.
    const errado = await db.rpc("baixar_pendencia", {
      p_pendencia_id: abertas[0].id,
      p_desfecho: "retifiquei_a_daa",
      p_data: "2026-08-19",
    });
    expect(errado.error).not.toBeNull();
    expect(await desfechosDePendencia(db)).toHaveLength(0);
  });
});

/**
 * CONTAI-008 — **o espelho**: mover o PAGAMENTO de obra. O que se prova aqui é
 * o ESTADO GRAVADO, não a tela: `obra_id` dos dois lados, o vínculo que sobrou
 * (ou não), as N linhas de rastro com o MESMO `ato_id`, o snapshot por ano e
 * por obra, e a pendência.
 *
 * As funções da migration 0016 rodam de verdade, como `security invoker`, sob a
 * MESMA RLS do app.
 */
test.describe("mover pagamento entre obras (CONTAI-008)", () => {
  /**
   * O cenário do adendo §5.2 com os papéis trocados: PIX de R$ 9.400,00
   * (20/10/2025) comprovado por DUAS notas — R$ 6.000,00 e R$ 3.400,00.
   */
  async function cenarioEspelhado(db: Db) {
    const favorecidoId = await cenarioFavorecido(db);
    const reformaId = await criarObra(db, {
      nome: REFORMA,
      cno: null,
      data_inicio_obra: "2025-03-01",
    });
    const notaA = await criarDocumento(db, {
      tipo: "nf_material",
      favorecido_id: favorecidoId,
      valor: 6000,
      numero: "1042",
      classificacao: "material",
      destinatario_cpf_ok: true,
    });
    const notaB = await criarDocumento(db, {
      tipo: "nf_material",
      favorecido_id: favorecidoId,
      valor: 3400,
      numero: "1043",
      classificacao: "material",
      destinatario_cpf_ok: true,
    });
    const pagamentoId = await criarPagamento(db, {
      favorecido_id: favorecidoId,
      valor: 9400,
      data_pagamento: "2025-10-20",
      meio: "pix",
      status: "conciliado",
      comprovante_path: "u/comprovante/pix.png",
    });
    await criarVinculo(db, pagamentoId, notaA);
    await criarVinculo(db, pagamentoId, notaB);
    return { reformaId, notaA, notaB, pagamentoId };
  }

  async function responderNota(page: Page, documentoId: string, texto: string) {
    await page
      .locator(`[data-documento="${documentoId}"]`)
      .getByRole("button", { name: texto, exact: true })
      .click();
  }

  test("desfecho MISTO: o vínculo não fica cruzando obras, e a conta das duas fecha", async ({
    page,
    db,
  }) => {
    const c = await cenarioEspelhado(db);

    await page.goto(`/pagamento/${c.pagamentoId}/obra`);
    // O botão diz o que falta — e conta a obra de destino como uma resposta
    // (mock p2, "Faltam 3 respostas para ver a conta").
    await expect(
      page.getByRole("button", { name: "Faltam 3 respostas para ver a conta" }),
    ).toBeDisabled();

    await page.getByRole("button", { name: REFORMA }).click();
    await responderNota(page, c.notaA, `Esta nota também é da ${REFORMA}`);
    await expect(
      page.getByRole("button", { name: "Falta 1 resposta para ver a conta" }),
    ).toBeDisabled();
    await responderNota(page, c.notaB, `Esta nota é mesmo da ${OBRA_SEED.nome}`);

    await page
      .getByRole("button", { name: "Gravar — e abrir a pendência de 2025" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Obra corrigida ✓" }),
    ).toBeVisible();

    // (i) NÃO SOBROU VÍNCULO CRUZANDO OBRAS — a nota que ficou perdeu o
    // vínculo; a que foi junto mudou de obra com ele intacto.
    const pag = (await pagamentos(db)).find((p) => p.id === c.pagamentoId)!;
    expect(pag.obra_id).toBe(c.reformaId);
    const docs = new Map((await documentos(db)).map((d) => [d.id, d]));
    expect(docs.get(c.notaA)!.obra_id).toBe(c.reformaId);
    expect(docs.get(c.notaB)!.obra_id).toBe(OBRA_ID_SEED);
    expect(await vinculos(db)).toEqual([
      expect.objectContaining({
        pagamento_id: c.pagamentoId,
        documento_id: c.notaA,
      }),
    ]);
    // Ainda há nota hábil ligada: o status NÃO volta para "aguardando_nf".
    expect(pag.status).toBe("conciliado");

    // (ii) TRÊS linhas de rastro, UM ato.
    const rastro = await revisoes(db);
    expect(rastro).toHaveLength(3);
    expect(new Set(rastro.map((r) => r.ato_id)).size).toBe(1);
    expect(rastro.every((r) => r.motivo === "arquivamento_corrigido")).toBe(true);
    expect(rastro.map((r) => `${r.entidade}:${r.campo}`).sort()).toEqual([
      "documento:obra",
      "pagamento:obra",
      "pagamento:vinculo",
    ]);
    // A linha do vínculo desfeito aponta para a NOTA que ficou, e o `depois` é
    // nulo — é o vínculo que deixou de existir, não um campo esvaziado.
    const vinculo = rastro.find((r) => r.campo === "vinculo")!;
    expect(vinculo.antes).toBe(c.notaB);
    expect(vinculo.depois).toBeNull();

    // (iii) A CONTA FECHA: o que saiu da origem apareceu no destino ou virou
    // "pago sem nota" lá. 9.400 (origem, antes) = 6.000 (destino, depois) +
    // 3.400 que o pagamento carrega sem nota — nada evaporou (critério 9).
    const anos = await anosAfetados(db);
    expect(anos).toHaveLength(2);
    const porObra = new Map(anos.map((a) => [a.obra_id, a]));
    expect(Number(porObra.get(OBRA_ID_SEED)!.custo_antes)).toBe(9400);
    expect(Number(porObra.get(OBRA_ID_SEED)!.custo_depois)).toBe(0);
    expect(Number(porObra.get(c.reformaId)!.custo_antes)).toBe(0);
    expect(Number(porObra.get(c.reformaId)!.custo_depois)).toBe(6000);
    const saiu =
      Number(porObra.get(OBRA_ID_SEED)!.custo_antes) -
      Number(porObra.get(OBRA_ID_SEED)!.custo_depois);
    const entrou =
      Number(porObra.get(c.reformaId)!.custo_depois) -
      Number(porObra.get(c.reformaId)!.custo_antes);
    expect(saiu - entrou).toBe(3400);

    // UMA pendência, do ANO — a DAA é do contribuinte, não da obra.
    const abertas = await pendencias(db);
    expect(abertas).toHaveLength(1);
    expect(abertas[0]).toMatchObject({
      tipo: "retificadora_possivel",
      ano: 2025,
      documento_id: null,
    });
    expect(new Set(anos.map((a) => a.pendencia_id))).toEqual(
      new Set([abertas[0].id]),
    );

    // (iv) O rastro é APPEND-ONLY pela estrutura, não por convenção.
    const tentouEditar = await db
      .from("revisao")
      .update({ depois: "outra coisa" })
      .eq("id", rastro[0].id);
    expect(tentouEditar.error?.code).toBe("42501");
    const tentouApagar = await db
      .from("revisao")
      .delete()
      .eq("id", rastro[0].id);
    expect(tentouApagar.error?.code).toBe("42501");
    expect(await revisoes(db)).toHaveLength(3);
  });

  test("todas as notas ficam: o pagamento chega ao destino em 'pago sem nota', e é a verdade", async ({
    page,
    db,
  }) => {
    const c = await cenarioEspelhado(db);

    await page.goto(`/pagamento/${c.pagamentoId}/obra`);
    await page.getByRole("button", { name: REFORMA }).click();
    await responderNota(page, c.notaA, `Esta nota é mesmo da ${OBRA_SEED.nome}`);
    await responderNota(page, c.notaB, `Esta nota é mesmo da ${OBRA_SEED.nome}`);
    await page.getByRole("button", { name: /^Gravar/ }).click();
    await expect(
      page.getByRole("heading", { name: "Obra corrigida ✓" }),
    ).toBeVisible();

    expect(await vinculos(db)).toHaveLength(0);
    const pag = (await pagamentos(db)).find((p) => p.id === c.pagamentoId)!;
    expect(pag.obra_id).toBe(c.reformaId);
    // Sem nenhuma nota hábil ligada, o status é CONSEQUÊNCIA do vínculo.
    expect(pag.status).toBe("aguardando_nf");
    // As duas notas continuam na origem, com os arquivos — nada se apaga.
    for (const d of await documentos(db)) expect(d.obra_id).toBe(OBRA_ID_SEED);

    // ⚠️ A Reforma é CANDIDATA e não é afetada: o pagamento chegou sem nota,
    // `min(valor, 0) = 0`, e nenhum número dela se mexeu.
    const anos = await anosAfetados(db);
    expect(anos).toHaveLength(1);
    expect(anos[0].obra_id).toBe(OBRA_ID_SEED);
    expect(Number(anos[0].custo_antes)).toBe(9400);
    expect(Number(anos[0].custo_depois)).toBe(0);
  });

  /**
   * Critério 11 — o caso benigno é 99% dos casos, e não pode ganhar atrito.
   * Critério 7 / Gate Fiscal, pergunta 4: rastro e aviso, SEM pendência.
   */
  test("pagamento SEM nota ligada: grava rastro, não abre pendência e não pede resposta nenhuma", async ({
    page,
    db,
  }) => {
    const reformaId = await criarObra(db, {
      nome: REFORMA,
      cno: null,
      data_inicio_obra: "2025-03-01",
    });
    const pagamentoId = await criarPagamento(db, {
      valor: 1500,
      data_pagamento: "2025-09-01",
      meio: "pix",
      comprovante_path: "u/comprovante/avulso.png",
    });

    await page.goto(`/pagamento/${pagamentoId}/obra`);
    await expect(
      page.getByRole("button", { name: "Escolha a obra de destino" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: REFORMA }).click();
    await page
      .getByRole("button", { name: "Mover o pagamento para a obra escolhida" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Obra corrigida ✓" }),
    ).toBeVisible();

    expect(
      (await pagamentos(db)).find((p) => p.id === pagamentoId)!.obra_id,
    ).toBe(reformaId);
    // Rastro SEMPRE — o rastro que não foi gravado não se recupera.
    expect(await revisoes(db)).toHaveLength(1);
    // Nenhum número mudou nas duas obras: sem nota, não há o que comprovar.
    expect(await anosAfetados(db)).toHaveLength(0);
    expect(await pendencias(db)).toHaveLength(0);
  });

  /**
   * Critério 3 + critério 16 na versão VIGENTE (parecer de 2026-09-20): a
   * revalidação de CNO da NF de serviço **avisa e não recusa**. Os dois
   * desfechos continuam disponíveis, e o aviso aparece na linha daquela nota.
   */
  test("NF de serviço com CNO divergente AVISA e continua podendo ir junto", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const reformaId = await criarObra(db, {
      nome: REFORMA,
      cno: "99.999.99999/26",
      cno_registrado_em: "2025-03-10",
      data_inicio_obra: "2025-03-01",
    });
    const nota = await criarDocumento(db, {
      tipo: "nf_servico",
      favorecido_id: favorecidoId,
      valor: 5000,
      numero: "1042",
      classificacao: "mao_obra",
      destinatario_cpf_ok: true,
      retencao_11: true,
      // O CNO impresso é o do seed, não o do destino.
      cno_referenciado: OBRA_SEED.cno,
      nota_traz_cno: true,
    });
    const pagamentoId = await criarPagamento(db, {
      favorecido_id: favorecidoId,
      valor: 5000,
      data_pagamento: "2025-10-20",
      meio: "pix",
      status: "conciliado",
      comprovante_path: "u/comprovante/pix.png",
    });
    await criarVinculo(db, pagamentoId, nota);

    await page.goto(`/pagamento/${pagamentoId}/obra`);
    await page.getByRole("button", { name: REFORMA }).click();

    const linhaDaNota = page.locator(`[data-documento="${nota}"]`);
    await expect(linhaDaNota).toContainText(
      "não abate a aferição de nenhuma das duas obras",
    );
    await expect(linhaDaNota).toContainText(
      "o custo de aquisição segue registrado normalmente",
    );

    // ⚠️ AVISO, NUNCA BLOQUEIO: o desfecho (i) continua clicável. O critério 16
    // (opção indisponível por CNO) foi RISCADO em 2026-09-20.
    const vaiJunto = linhaDaNota.getByRole("button", {
      name: `Esta nota também é da ${REFORMA}`,
      exact: true,
    });
    await expect(vaiJunto).toBeEnabled();
    await vaiJunto.click();
    await page.getByRole("button", { name: /^Gravar/ }).click();
    await expect(
      page.getByRole("heading", { name: "Obra corrigida ✓" }),
    ).toBeVisible();

    expect((await documentos(db))[0].obra_id).toBe(reformaId);
    expect(await vinculos(db)).toHaveLength(1);
  });

  /**
   * As guardas do BANCO, por RPC direto — a tela nunca monta estes arrays, e é
   * exatamente por isso que elas não podem ser promessa de tela.
   */
  test("desfecho para documento NÃO vinculado é recusado, e o ato inteiro não grava", async ({
    db,
  }) => {
    const c = await cenarioEspelhado(db);
    const avulsa = await criarDocumento(db, {
      tipo: "nf_material",
      valor: 1000,
      numero: "9999",
      classificacao: "material",
      destinatario_cpf_ok: true,
    });

    const recusado = await db.rpc("mover_pagamento_de_obra", {
      p_pagamento_id: c.pagamentoId,
      p_obra_destino: c.reformaId,
      p_documentos: [
        { documento_id: c.notaA, desfecho: "vai_junto" },
        { documento_id: c.notaB, desfecho: "fica_na_origem" },
        { documento_id: avulsa, desfecho: "vai_junto" },
      ],
      p_anos: [],
    });
    expect(recusado.error).not.toBeNull();

    // ATOMICIDADE: o `update pagamento` acontece ANTES do laço, e mesmo assim
    // nada sobrou. "Se a transação não fechar, nada muda."
    expect(
      (await pagamentos(db)).find((p) => p.id === c.pagamentoId)!.obra_id,
    ).toBe(OBRA_ID_SEED);
    expect((await documentos(db)).every((d) => d.obra_id === OBRA_ID_SEED)).toBe(
      true,
    );
    expect(await vinculos(db)).toHaveLength(2);
    expect(await revisoes(db)).toHaveLength(0);
  });

  /**
   * Critério 13 — a guarda CONTA, não só verifica existência. Os dois casos
   * que passavam: o desfecho duplicado (duas linhas do mesmo fato) e o par
   * contraditório (mudou de obra *e* teve o vínculo desfeito).
   */
  test("o mesmo documento com dois desfechos é recusado — nos dois sentidos do move", async ({
    db,
  }) => {
    const c = await cenarioEspelhado(db);

    const duplicado = await db.rpc("mover_pagamento_de_obra", {
      p_pagamento_id: c.pagamentoId,
      p_obra_destino: c.reformaId,
      p_documentos: [
        { documento_id: c.notaA, desfecho: "vai_junto" },
        { documento_id: c.notaA, desfecho: "vai_junto" },
        { documento_id: c.notaB, desfecho: "fica_na_origem" },
      ],
      p_anos: [],
    });
    expect(duplicado.error).not.toBeNull();

    const contraditorio = await db.rpc("mover_pagamento_de_obra", {
      p_pagamento_id: c.pagamentoId,
      p_obra_destino: c.reformaId,
      p_documentos: [
        { documento_id: c.notaA, desfecho: "vai_junto" },
        { documento_id: c.notaA, desfecho: "fica_na_origem" },
        { documento_id: c.notaB, desfecho: "fica_na_origem" },
      ],
      p_anos: [],
    });
    expect(contraditorio.error).not.toBeNull();

    // O MESMO conserto do lado do documento, no mesmo diff (migration 0016).
    const doLadoDoDocumento = await db.rpc("mover_documento_de_obra", {
      p_documento_id: c.notaA,
      p_obra_destino: c.reformaId,
      p_pagamentos: [
        { pagamento_id: c.pagamentoId, desfecho: "vai_junto" },
        { pagamento_id: c.pagamentoId, desfecho: "fica_na_origem" },
      ],
      p_anos: [],
    });
    expect(doLadoDoDocumento.error).not.toBeNull();

    expect(await revisoes(db)).toHaveLength(0);
    expect(await vinculos(db)).toHaveLength(2);
  });

  /**
   * A nota que comprova OUTRO pagamento não pode acompanhar este: levá-la
   * deixaria aquele vínculo cruzando duas obras — o mesmo estado inválido, com
   * os papéis trocados. A tela explica, o banco recusa.
   */
  test("nota que comprova outro pagamento: a tela impede e o banco recusa", async ({
    page,
    db,
  }) => {
    const c = await cenarioEspelhado(db);
    const outroPagamento = await criarPagamento(db, {
      valor: 1000,
      data_pagamento: "2025-11-03",
      meio: "pix",
      status: "conciliado",
      comprovante_path: "u/comprovante/outro.png",
    });
    await criarVinculo(db, outroPagamento, c.notaA);

    await page.goto(`/pagamento/${c.pagamentoId}/obra`);
    await page.getByRole("button", { name: REFORMA }).click();

    const linhaDaNota = page.locator(`[data-documento="${c.notaA}"]`);
    await expect(linhaDaNota).toContainText(
      "também comprova outro pagamento desta obra",
    );
    await expect(
      linhaDaNota.getByRole("button", {
        name: `Esta nota também é da ${REFORMA}`,
        exact: true,
      }),
    ).toBeDisabled();

    // E se alguém montar o array na mão, o banco recusa o ato inteiro.
    const recusado = await db.rpc("mover_pagamento_de_obra", {
      p_pagamento_id: c.pagamentoId,
      p_obra_destino: c.reformaId,
      p_documentos: [
        { documento_id: c.notaA, desfecho: "vai_junto" },
        { documento_id: c.notaB, desfecho: "fica_na_origem" },
      ],
      p_anos: [],
    });
    expect(recusado.error).not.toBeNull();
    expect(await revisoes(db)).toHaveLength(0);
    expect(await vinculos(db)).toHaveLength(3);
  });
});
