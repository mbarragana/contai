import type { Page } from "@playwright/test";

import { OBRA_ID_SEED, OBRA_SEED } from "./ambiente";
import {
  anosAfetados,
  criarDocumento,
  criarFavorecido,
  criarObra,
  criarPagamento,
  criarVinculo,
  desfechosDePendencia,
  documentos,
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
