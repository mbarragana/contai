import { OBRA_ID_SEED } from "./ambiente";
import {
  compromissos,
  contarVinculosSemRls,
  criarCompraCartao,
  criarCompromisso,
  criarDocumento,
  criarFavorecido,
  criarPagamento,
  criarVinculo,
  pagamentos,
  plantarDocumentoDeOutroDono,
  vinculos,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * CONTAI-065 — a nota afirmada no AGENDAMENTO sobrevive à QUITAÇÃO (D79).
 *
 * Fonte normativa: `docs/pareceres/2026-09-26-replicar-vinculo-documento-quitacao.md`.
 * O que se prova aqui é o estado GRAVADO em `pagamento_documento` — a tabela
 * que `alocarCusto` consome —, não o que a tela mostra: até a migration 0020,
 * `compromisso.documento_origem_id` era write-only, e o vínculo que o Mateus
 * fez com o dedo dele morria no meio do caminho.
 *
 * Contra o Postgres LOCAL, com a RLS ligada e o MESMO client autenticado do
 * app, pelos DOIS caminhos de quitação: cartão (`fatura_desembolso_gravar` /
 * `fatura_alocar`) e PIX/boleto (`quitarCompromisso`).
 *
 * ⚠️ A regra mora só no banco (função `propagar_vinculo_de_origem`), e é por
 * isso que não há teste unitário dela: uma cópia em TypeScript das cinco
 * condições seria uma SEGUNDA fonte de verdade para uma guarda fiscal — o
 * defeito que o ticket existe para não criar.
 *
 * ⚠️ **CONTAI-081 (migration 0024) mudou QUEM MANDA no caminho do cartão, e as
 * cinco condições não mudaram uma vírgula.** As duas RPCs da fatura só chamam
 * `propagar_vinculo_de_origem` para os compromissos que vierem em
 * `p_propagar_origem_ids` — o array que o app calcula com
 * `planoDeConversaoDaFatura` (os de N < 2). A razão é o D1 do Gate 2 do
 * CONTAI-080: com pré-vínculo disponível para cartão, uma compra com nota de
 * origem MAIS um pré-vínculo tem N=2, e propagar a origem incondicionalmente
 * converteria METADE do conjunto antes de qualquer toque do Mateus.
 *
 * Consequência para os testes que chamam a RPC **direto** (sem passar pela tela):
 * eles precisam dizer o que autorizam. O default `'{}'` do banco significa "não
 * propague nada" — o lado conservador.
 */

let proximoCnpj = 0;

/** Favorecido próprio por chamada — `favorecido` é único por (dono, documento). */
async function loja(db: Db, nome = "Depósito Bom Jesus") {
  proximoCnpj += 1;
  return criarFavorecido(db, {
    tipo: "pj",
    nome,
    documento: `1122233300${String(proximoCnpj).padStart(4, "0")}`,
  });
}

/** NF de material hábil, na obra do seed por padrão. */
async function nota(
  db: Db,
  over: { obraId?: string; favorecidoId?: string; valor?: number } = {},
) {
  return criarDocumento(db, {
    ...(over.obraId ? { obra_id: over.obraId } : {}),
    favorecido_id: over.favorecidoId ?? (await loja(db)),
    tipo: "nf_material",
    classificacao: "material",
    valor: over.valor ?? 950,
    destinatario_cpf_ok: true,
    status: "registrado",
  });
}

async function outraObra(db: Db): Promise<string> {
  const { data, error } = await db
    .from("obra")
    .insert({ nome: "Casa do Morro", data_inicio_obra: "2026-03-15" })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data!.id;
}

function hoje(): string {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function maisDias(dias: number): string {
  const d = new Date(`${hoje()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// ══ Cartão: a fatura paga ═══════════════════════════════════════════════

test.describe("cartão — a fatura paga leva a nota da compra", () => {
  test("confirmação integral pela tela: o pagamento nasce ligado à nota de origem", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    const documentoId = await nota(db, { favorecidoId });
    const { faturaId } = await criarCompraCartao(db, {
      favorecidoId,
      valor: 950,
      dataCompra: "2026-08-14",
      dataVencimento: "2026-09-10",
      documentoOrigemId: documentoId,
    });

    await page.goto(`/fatura/${faturaId}`);
    await page
      .getByRole("link", { name: "Confirmar fatura paga (integral)" })
      .click();
    await page.getByLabel("Data em que a fatura foi paga").fill("2026-09-10");
    await page.getByRole("button", { name: /^Confirmar pagamento/ }).click();
    await expect(
      page.getByRole("heading", { name: "1 pagamento gerado" }),
    ).toBeVisible();

    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(1);

    // ⚠️ É ESTA LINHA que não existia antes do CONTAI-065.
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagos[0].id, documento_id: documentoId },
    ]);
  });

  test("duas compras, duas notas, uma fatura: DUAS linhas de vínculo (critério 3)", async ({
    page,
    db,
  }) => {
    const lojaA = await loja(db, "Leroy Merlin");
    const lojaB = await loja(db, "Elétrica Ilha");
    const notaA = await nota(db, { favorecidoId: lojaA, valor: 4180 });
    const notaB = await nota(db, { favorecidoId: lojaB, valor: 890 });

    const primeira = await criarCompraCartao(db, {
      favorecidoId: lojaA,
      valor: 4180,
      dataCompra: "2026-08-14",
      dataVencimento: "2026-09-10",
      documentoOrigemId: notaA,
    });
    await criarCompraCartao(db, {
      favorecidoId: lojaB,
      valor: 890,
      dataCompra: "2026-08-19",
      dataVencimento: "2026-09-10",
      documentoOrigemId: notaB,
    });

    await page.goto(`/fatura/${primeira.faturaId}`);
    await page
      .getByRole("link", { name: "Confirmar fatura paga (integral)" })
      .click();
    await page.getByLabel("Data em que a fatura foi paga").fill("2026-09-10");
    await page.getByRole("button", { name: /^Confirmar pagamento/ }).click();
    await expect(
      page.getByRole("heading", { name: "2 pagamentos gerados" }),
    ).toBeVisible();

    // Cada compra gera o SEU pagamento, e cada pagamento leva a SUA nota — o
    // "N compromissos → N linhas" do critério 3, sem estrutura nova.
    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(2);
    const porValor = new Map(pagos.map((p) => [Number(p.valor), p.id]));
    expect(await vinculos(db)).toEqual(
      expect.arrayContaining([
        { pagamento_id: porValor.get(4180), documento_id: notaA },
        { pagamento_id: porValor.get(890), documento_id: notaB },
      ]),
    );
    expect(await vinculos(db)).toHaveLength(2);
  });

  test("compra SEM nota de origem: nada é inserido — comportamento de antes, intacto", async ({
    db,
  }) => {
    const favorecidoId = await loja(db);
    const { faturaId, compromissoId } = await criarCompraCartao(db, {
      favorecidoId,
      valor: 500,
      dataCompra: "2026-08-01",
      dataVencimento: "2026-09-05",
    });

    const { error } = await db.rpc("fatura_desembolso_gravar", {
      p_fatura_id: faturaId,
      p_valor: 500,
      p_data_pagamento: "2026-09-05",
      p_compromisso_ids: [compromissoId],
      // ⚠️ CONTAI-081 — AUTORIZADO de propósito: sem isto o teste passaria por
      // falta de autorização, e não por falta de nota. O que se prova é a
      // CONDIÇÃO 1 da função (`documento_origem_id is null` → `false`).
      p_propagar_origem_ids: [compromissoId],
    });
    expect(error).toBeNull();

    expect(await pagamentos(db)).toHaveLength(1);
    expect(
      await vinculos(db),
      "sem afirmação humana não há o que replicar — e o app segue conservador",
    ).toEqual([]);
  });

  test("rotativo: `fatura_alocar` (alocação em outro momento) propaga igual", async ({
    db,
  }) => {
    const favorecidoId = await loja(db);
    const documentoId = await nota(db, { favorecidoId, valor: 1200 });
    const { faturaId, compromissoId } = await criarCompraCartao(db, {
      favorecidoId,
      valor: 1200,
      dataCompra: "2026-09-15",
      dataVencimento: "2026-10-10",
      documentoOrigemId: documentoId,
    });

    // Valor gravado SEM alocar nada (s6 puro) — a compra segue aberta.
    const desembolso = await db.rpc("fatura_desembolso_gravar", {
      p_fatura_id: faturaId,
      p_valor: 1500,
      p_data_pagamento: "2026-10-08",
      p_compromisso_ids: [],
    });
    expect(desembolso.error).toBeNull();
    expect(await pagamentos(db)).toHaveLength(0);
    expect(await vinculos(db)).toEqual([]);

    // A alocação de depois é o OUTRO caminho de quitação do cartão: um vínculo
    // que só sobrevivesse na confirmação integral seria regra dependente de
    // por qual porta o Mateus entrou.
    //
    // ⚠️ CONTAI-081 — `p_propagar_origem_ids` é a autorização do app. Aqui o
    // conjunto é N=1 (só a nota de origem), então `planoDeConversaoDaFatura`
    // colocaria este compromisso no array, e é isso que o teste reproduz.
    const { error } = await db.rpc("fatura_alocar", {
      p_desembolso_id: desembolso.data as string,
      p_compromisso_ids: [compromissoId],
      p_propagar_origem_ids: [compromissoId],
    });
    expect(error).toBeNull();

    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(1);
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagos[0].id, documento_id: documentoId },
    ]);
  });

  /**
   * ⚠️ **CONTAI-081, critério 4 — a guarda do D1 no nível do SQL.**
   *
   * O compromisso está em `p_compromisso_ids` (é quitado, o pagamento nasce) e
   * **fora** de `p_propagar_origem_ids` — o que o app manda quando N ≥ 2. A nota
   * de origem NÃO pode ser gravada: ela espera o clique, junto com as outras.
   *
   * Sem este teste, alguém "simplificando" a RPC de volta à propagação
   * incondicional passaria pela suíte — e o dano é invisível na tela, porque o
   * vínculo aparece como se o Mateus o tivesse confirmado.
   */
  test("⚠️ compromisso FORA de `p_propagar_origem_ids`: quita e NÃO propaga", async ({
    db,
  }) => {
    const favorecidoId = await loja(db);
    const documentoId = await nota(db, { favorecidoId });
    const { faturaId, compromissoId } = await criarCompraCartao(db, {
      favorecidoId,
      valor: 950,
      dataCompra: "2026-08-14",
      dataVencimento: "2026-09-10",
      documentoOrigemId: documentoId,
    });

    // Integral: o array de autorização vem VAZIO, como vem quando N ≥ 2.
    const { error } = await db.rpc("fatura_desembolso_gravar", {
      p_fatura_id: faturaId,
      p_valor: 950,
      p_data_pagamento: "2026-09-10",
      p_compromisso_ids: [compromissoId],
      p_propagar_origem_ids: [],
    });
    expect(error).toBeNull();

    // A quitação acontece — fato consumado nunca é recusado.
    expect(await pagamentos(db)).toHaveLength(1);
    expect((await compromissos(db))[0].situacao).toBe("quitado");
    expect(
      await vinculos(db),
      "sem autorização do app, a origem não converte — é o D1 fechado no SQL",
    ).toEqual([]);
  });

  test("nota que MUDOU de obra depois do agendamento: quita, e não vincula", async ({
    db,
  }) => {
    const favorecidoId = await loja(db);
    // A nota está em OUTRA obra no momento da quitação — pre-mortem 2 do
    // ticket. A tela de captura barra isto na entrada (CONTAI-064), então o
    // cenário só é alcançável pela RPC: é o estado "a obra divergiu DEPOIS".
    const documentoId = await nota(db, { obraId: await outraObra(db) });
    const { faturaId, compromissoId } = await criarCompraCartao(db, {
      favorecidoId,
      valor: 950,
      dataCompra: "2026-08-14",
      dataVencimento: "2026-09-10",
      documentoOrigemId: documentoId,
    });

    const { error } = await db.rpc("fatura_desembolso_gravar", {
      p_fatura_id: faturaId,
      p_valor: 950,
      p_data_pagamento: "2026-09-10",
      p_compromisso_ids: [compromissoId],
      // ⚠️ CONTAI-081 — AUTORIZADO: o que se prova aqui é a CONDIÇÃO 2 (a obra
      // tem de bater no ato da quitação), não a falta de autorização do app.
      p_propagar_origem_ids: [compromissoId],
    });
    expect(error).toBeNull();

    // O PAGAMENTO existe — a quitação é fato consumado e não é recusada por
    // causa da nota. O que não existe é o vínculo entre obras.
    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(1);
    expect(pagos[0].obra_id).toBe(OBRA_ID_SEED);
    expect((await compromissos(db))[0].situacao).toBe("quitado");
    expect(
      await vinculos(db),
      "nada é somado entre obras — cada matrícula é um item da declaração",
    ).toEqual([]);
  });

  test("nota de OUTRO DONO pendurada como origem: quita, e não vincula (critério 5)", async ({
    db,
  }) => {
    const alheio = plantarDocumentoDeOutroDono();
    const favorecidoId = await loja(db);
    const { faturaId, compromissoId } = await criarCompraCartao(db, {
      favorecidoId,
      valor: 950,
      dataCompra: "2026-08-14",
      dataVencimento: "2026-09-10",
      // A FK aceita qualquer uuid existente, e a ESCRITA deste campo nunca foi
      // validada contra o dono — é exatamente o achado do `cto-obra`.
      documentoOrigemId: alheio,
    });

    const { error } = await db.rpc("fatura_desembolso_gravar", {
      p_fatura_id: faturaId,
      p_valor: 950,
      p_data_pagamento: "2026-09-10",
      p_compromisso_ids: [compromissoId],
      // ⚠️ CONTAI-081 — AUTORIZADO: o que se prova aqui é o CRITÉRIO 5 (a nota
      // tem de ser do dono da sessão), não a falta de autorização do app.
      p_propagar_origem_ids: [compromissoId],
    });
    // ⚠️ E a quitação NÃO estoura: a RPC checa o dono ANTES de inserir, em vez
    // de deixar a policy recusar o insert e derrubar a transação inteira — um
    // pagamento não registrado é o erro caro.
    expect(error).toBeNull();
    expect(await pagamentos(db)).toHaveLength(1);

    // Sem RLS no meio: a linha não existe em lugar nenhum, não é só invisível.
    expect(contarVinculosSemRls()).toBe(0);
  });
});

// ══ PIX / boleto: o agendamento quitado ═════════════════════════════════

test.describe("PIX/boleto — a quitação do agendamento leva a nota", () => {
  test("confirmar o agendamento pela tela: o pagamento nasce ligado à nota de origem", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db, "WK Construções LTDA");
    const documentoId = await nota(db, { favorecidoId, valor: 10000 });
    const compromissoId = await criarCompromisso(db, {
      favorecido_id: favorecidoId,
      valor_previsto: 10000,
      data_prevista: maisDias(-3),
      origem: "boleto",
      documento_origem_id: documentoId,
    });

    await page.goto(`/compromisso/${compromissoId}/confirmar`);
    await page.getByLabel("Data em que o dinheiro saiu").fill(hoje());
    await page.getByLabel("Valor efetivamente pago").fill("10.000,00");
    await page.getByRole("button", { name: "Salvar pagamento" }).click();
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);

    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(1);
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagos[0].id, documento_id: documentoId },
    ]);
  });

  test("pagou MENOS que o previsto: o vínculo replica igual (critério 4)", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db, "WK Construções LTDA");
    const documentoId = await nota(db, { favorecidoId, valor: 10000 });
    await criarCompromisso(db, {
      favorecido_id: favorecidoId,
      valor_previsto: 10000,
      data_prevista: maisDias(-3),
      origem: "boleto",
      documento_origem_id: documentoId,
    });
    // Pagamento JÁ gravado, R$ 800 menor que o previsto — dentro da faixa da
    // sugestão, e sem vínculo nenhum ainda.
    const pagamentoId = await criarPagamento(db, {
      favorecido_id: favorecidoId,
      valor: 9200,
      data_pagamento: hoje(),
      meio: "pix",
      comprovante_path: `${OBRA_ID_SEED}/comprovante/pix.pdf`,
    });

    await page.goto(`/pagamento/${pagamentoId}`);
    await page
      .getByRole("button", { name: "Sim, mas falta pagar o resto" })
      .click();
    await page
      .getByLabel("Quando você pretende pagar o resto?")
      .fill(maisDias(20));
    await page.getByRole("button", { name: /^Salvar — o agendamento/ }).click();

    // O saldo segue aberto — e o vínculo com a nota EXISTE de qualquer forma:
    // quem decide quanto disso compõe custo é a regra do mínimo, não o valor
    // previsto.
    await expect
      .poll(async () => (await vinculos(db)).length, {
        message: "a replicação do vínculo não espera valor bater",
      })
      .toBe(1);
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagamentoId, documento_id: documentoId },
    ]);
    const abertos = await compromissos(db);
    expect(abertos[0].situacao).toBe("aberto");
    expect(abertos[0].data_prevista).toBe(maisDias(20));
  });

  test("vínculo que o Mateus já tinha feito à mão NÃO é tocado (critério 2)", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db, "WK Construções LTDA");
    const notaDoAgendamento = await nota(db, { favorecidoId, valor: 10000 });
    const notaQueEleLigou = await nota(db, { favorecidoId, valor: 10000 });
    await criarCompromisso(db, {
      favorecido_id: favorecidoId,
      valor_previsto: 10000,
      data_prevista: maisDias(-3),
      origem: "boleto",
      documento_origem_id: notaDoAgendamento,
    });
    const pagamentoId = await criarPagamento(db, {
      favorecido_id: favorecidoId,
      valor: 10000,
      data_pagamento: hoje(),
      meio: "pix",
      comprovante_path: `${OBRA_ID_SEED}/comprovante/pix.pdf`,
    });
    // "Ligar a uma nota", feito depois do agendamento e com OUTRA nota: é a
    // afirmação mais recente do Mateus, e a replicação não passa por cima dela.
    await criarVinculo(db, pagamentoId, notaQueEleLigou);

    await page.goto(`/pagamento/${pagamentoId}`);
    await page
      .getByRole("button", { name: "Sim, quita este agendamento" })
      .click();

    await expect
      .poll(async () => (await compromissos(db))[0].situacao, {
        message: "a quitação em si acontece — o que não acontece é sobrescrever",
      })
      .toBe("quitado");
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagamentoId, documento_id: notaQueEleLigou },
    ]);
  });

  test("agendamento SEM nota de origem: quita e não inventa vínculo", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db, "WK Construções LTDA");
    const compromissoId = await criarCompromisso(db, {
      favorecido_id: favorecidoId,
      valor_previsto: 10000,
      data_prevista: maisDias(-3),
      origem: "boleto",
    });

    await page.goto(`/compromisso/${compromissoId}/confirmar`);
    await page.getByLabel("Data em que o dinheiro saiu").fill(hoje());
    await page.getByLabel("Valor efetivamente pago").fill("10.000,00");
    await page.getByRole("button", { name: "Salvar pagamento" }).click();
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);

    expect(await pagamentos(db)).toHaveLength(1);
    expect(await vinculos(db)).toEqual([]);
  });

  test("nota que MUDOU de obra depois do agendamento: quita, e não vincula", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db, "WK Construções LTDA");
    const documentoId = await nota(db, {
      obraId: await outraObra(db),
      favorecidoId,
      valor: 10000,
    });
    const compromissoId = await criarCompromisso(db, {
      favorecido_id: favorecidoId,
      valor_previsto: 10000,
      data_prevista: maisDias(-3),
      origem: "boleto",
      documento_origem_id: documentoId,
    });

    await page.goto(`/compromisso/${compromissoId}/confirmar`);
    await page.getByLabel("Data em que o dinheiro saiu").fill(hoje());
    await page.getByLabel("Valor efetivamente pago").fill("10.000,00");
    await page.getByRole("button", { name: "Salvar pagamento" }).click();
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);

    // A tela NÃO quebra e a quitação acontece: o desvio é silencioso de
    // propósito (o pagamento fica "aguardando NF", que é a pendência certa).
    expect(await pagamentos(db)).toHaveLength(1);
    expect((await compromissos(db))[0].situacao).toBe("quitado");
    expect(await vinculos(db)).toEqual([]);
  });
});
