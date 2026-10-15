import { USER_ID_SEED } from "./ambiente";
import {
  arquivosNoAcervo,
  criarCompraCartao,
  criarDocumento,
  criarFavorecido,
  criarPagamento,
  criarVinculo,
  pagamentos,
  revisoes,
  subirParaOAcervo,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * **CONTAI-098 — reaproveitar o comprovante de um pagamento IRMÃO da mesma
 * fatura (D56-b, ponta B)**, contra o Postgres LOCAL.
 *
 * Fonte normativa: `docs/tickets/CONTAI-027.md:404-427` §1 (dupla contagem por
 * anexo é impossível por construção) + `docs/pareceres/2026-08-18-compromisso-
 * versus-pagamento.md` ADENDO 2 §1-§2 + `docs/tickets/CONTAI-061.md` (rastro e
 * trigger de imutabilidade).
 *
 * O que se prova aqui não é que o chip apareceu: é que **DOIS `pagamento`s da
 * mesma fatura passaram a apontar ao IDÊNTICO `comprovante_path` sem nenhum
 * objeto novo no Storage**, com rastro de motivo PRÓPRIO
 * (`comprovante_reaproveitado_de_irmao`, distinto de `comprovante_chegou_
 * depois`) — a exigência fiscal do Gate Fiscal item 4. Nada é stubado: a RPC
 * `reaproveitar_comprovante_de_irmao` (migration 0031), a guarda de proveniência
 * e o trigger `pagamento_comprovante_path_imutavel` rodam de verdade, como
 * `security invoker`, sob a MESMA RLS do app.
 *
 * ⚠️ O ano vem de `new Date().getFullYear()`, e não de um literal: com ano fixo
 * o teste passaria a provar outra coisa na virada do ano (mesma razão escrita em
 * `pagamento-comprovante-tardio.spec.ts`).
 */

const ANO = new Date().getFullYear();

let proximoCnpj = 0;

/** Cada chamada usa um CNPJ próprio — `favorecido` é único por (dono, documento). */
async function loja(db: Db, nome: string) {
  proximoCnpj += 1;
  return criarFavorecido(db, {
    tipo: "pj",
    nome,
    documento: `1122233300${String(proximoCnpj).padStart(4, "0")}`,
  });
}

function arquivoNovo(nome: string) {
  return {
    name: nome,
    mimeType: "image/png",
    buffer: Buffer.from(`png-falso-${nome}`),
  };
}

/**
 * Uma compra no cartão, já quitada por um desembolso PRÓPRIO da fatura — é o
 * caminho que produz os irmãos de verdade: `fatura_desembolso_gravar` cria o
 * `pagamento`, o vínculo `compromisso_pagamento` e copia (ou não) o
 * `comprovante_path` do desembolso.
 *
 * ⚠️ **Um desembolso por compra, de propósito**: é assim que uma fatura real
 * acaba com arquivos DIFERENTES entre os irmãos (a dor de origem é uma fatura em
 * 3 desembolsos parciais). Com um desembolso só, todos os irmãos nasceriam com o
 * mesmo path — o caso fácil, que o critério 2 não quer provar sozinho.
 */
async function compraQuitada(
  db: Db,
  entrada: {
    faturaId?: string;
    nomeDaLoja: string;
    valor: number;
    dataVencimento: string;
    /** `null` é o pagamento que este ticket existe para destravar. */
    comprovantePath: string | null;
  },
): Promise<{ faturaId: string; pagamentoId: string; favorecidoId: string }> {
  const favorecidoId = await loja(db, entrada.nomeDaLoja);
  const compra = await criarCompraCartao(db, {
    favorecidoId,
    valor: entrada.valor,
    dataCompra: `${ANO}-03-02`,
    dataVencimento: entrada.dataVencimento,
  });

  const { error } = await db.rpc("fatura_desembolso_gravar", {
    p_fatura_id: compra.faturaId,
    p_valor: entrada.valor,
    p_data_pagamento: `${ANO}-04-10`,
    ...(entrada.comprovantePath !== null
      ? { p_comprovante_path: entrada.comprovantePath }
      : {}),
    p_compromisso_ids: [compra.compromissoId],
  });
  expect(error, "quitar a compra do cartão no cenário").toBeNull();

  const pagamento = (await pagamentos(db)).find(
    (p) => p.favorecido_id === favorecidoId,
  )!;
  return {
    faturaId: compra.faturaId,
    pagamentoId: pagamento.id,
    favorecidoId,
  };
}

/**
 * A nota hábil que faz o delta de custo existir — sem ela o par
 * `min(Σ pagamentos, Σ documentos)` é zero e o botão não mostraria valor nenhum
 * (comportamento correto, e já provado no CONTAI-061).
 */
async function notaLigadaAo(
  db: Db,
  pagamentoId: string,
  favorecidoId: string,
  valor: number,
) {
  const documentoId = await criarDocumento(db, {
    tipo: "nf_material",
    favorecido_id: favorecidoId,
    valor,
    classificacao: "material",
    destinatario_cpf_ok: true,
  });
  await criarVinculo(db, pagamentoId, documentoId);
}

test.describe("reaproveitar o comprovante de um irmão da mesma fatura", () => {
  test("UM arquivo distinto: o chip e o 'arquivo novo' aparecem juntos, nada vem pré-marcado, e o reaproveitamento grava o MESMO path sem objeto novo no acervo", async ({
    page,
    db,
  }) => {
    const pathDoIrmao = await subirParaOAcervo(
      db,
      "comprovante",
      "pix-perfuratec.txt",
      "pix da PerfuraTec",
    );
    const irmao = await compraQuitada(db, {
      nomeDaLoja: "PerfuraTec",
      valor: 1797.03,
      dataVencimento: `${ANO}-04-10`,
      comprovantePath: pathDoIrmao,
    });
    const alvo = await compraQuitada(db, {
      faturaId: irmao.faturaId,
      nomeDaLoja: "Depósito Ilha",
      valor: 940,
      dataVencimento: `${ANO}-04-10`,
      comprovantePath: null,
    });
    expect(
      alvo.faturaId,
      "as duas compras têm de cair na MESMA fatura — é o que define 'irmão'",
    ).toBe(irmao.faturaId);
    await notaLigadaAo(db, alvo.pagamentoId, alvo.favorecidoId, 940);

    // ⚠️ Linha de base, não contagem absoluta: o bucket `acervo` é append-only
    // (a 0002 não tem policy de delete) e não é zerado entre testes.
    const antes = await arquivosNoAcervo(db, "comprovante");

    await page.goto(`/pagamento/${alvo.pagamentoId}/comprovante`);

    // ── Critério 1 e 3: o Card, e o chip com FAVORECIDO + VALOR ───────────
    // Nome de arquivo nunca aparece: três lojas da mesma rede como favorecidos
    // distintos na mesma fatura é o pre-mortem 1, e o valor é o que desambigua.
    await expect(
      page.getByText("Ou reaproveite um comprovante já enviado nesta fatura"),
    ).toBeVisible();
    const chipDoIrmao = page.getByRole("button", {
      name:
        "Usar o comprovante de PerfuraTec — R$ 1.797,03 " +
        "(já enviado para outro pagamento desta fatura)",
    });
    await expect(chipDoIrmao).toBeVisible();

    // ── Critério 4: o upload novo NUNCA é omitido, nem com UM candidato ───
    // "Irmão" só é resolvível por FATURA: o único arquivo visível pode vir de
    // outro desembolso e não ser prova deste pagamento.
    await expect(
      page.getByRole("button", { name: "Vou anexar um arquivo novo." }),
    ).toBeVisible();

    // ── Critério 5: nasce sem nada marcado, e o botão fica travado ────────
    await expect(chipDoIrmao).toHaveAttribute("aria-pressed", "false");
    await expect(
      page.getByRole("button", { name: "Escolha um comprovante para continuar" }),
    ).toBeDisabled();
    // E o campo de upload não está na tela: duas perguntas simultâneas sobre o
    // mesmo arquivo é o que o chip existe para evitar.
    await expect(page.getByLabel("Comprovante do pagamento")).toHaveCount(0);

    // ── Critério 9: nenhuma pergunta fiscal nova em nenhum dos dois ramos ──
    await expect(
      page.getByRole("group", { name: "A nota está no seu CPF?" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Esta nota destaca alguma retenção?"),
    ).toHaveCount(0);

    // ── Critério 10: o delta sai do MESMO mecanismo, com o path REAL ──────
    await chipDoIrmao.click();
    await expect(chipDoIrmao).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("R$ 0,00 → R$ 940,00").first()).toBeVisible();

    // ⚠️ O verbo do botão NUNCA é "anexar" aqui: nenhum arquivo novo sobe.
    const confirmar = page.getByRole("button", {
      name: `Usar este comprovante — o custo confirmado de ${ANO} passa a R$ 940,00`,
    });
    await expect(confirmar).toBeEnabled();
    await confirmar.click();

    // ── Banner dinâmico (spec, `## Textos`) ───────────────────────────────
    await expect(page.getByRole("status")).toContainText("Reaproveitado.");
    await expect(
      page.getByRole("heading", { name: "Comprovante reaproveitado ✓" }),
    ).toBeVisible();

    // ── (i) Critério 7: o MESMO path, nos dois pagamentos ────────────────
    const gravados = await pagamentos(db);
    const alvoGravado = gravados.find((p) => p.id === alvo.pagamentoId)!;
    const irmaoGravado = gravados.find((p) => p.id === irmao.pagamentoId)!;
    expect(alvoGravado.comprovante_path).toBe(pathDoIrmao);
    expect(alvoGravado.comprovante_path).toBe(irmaoGravado.comprovante_path);

    // ── (ii) Critério 7: NENHUM objeto novo no Storage ───────────────────
    expect(await arquivosNoAcervo(db, "comprovante")).toEqual(antes);

    // ── (iii) Critério 11: o rastro, com MOTIVO PRÓPRIO ──────────────────
    const rastro = await revisoes(db);
    expect(rastro).toHaveLength(1);
    expect(rastro[0]).toMatchObject({
      entidade: "pagamento",
      entidade_id: alvo.pagamentoId,
      campo: "comprovante",
      antes: null,
      depois: pathDoIrmao,
      motivo: "comprovante_reaproveitado_de_irmao",
      motivo_texto: null,
    });
    expect(rastro[0].quando).not.toBeNull();

    // ── Critério 15: as saídas fiscais não deduplicam ────────────────────
    // Cada `pagamento` continua linha própria com o valor DIGITADO para ele —
    // o anexo compartilhado não soma nem colapsa nada.
    expect(Number(alvoGravado.valor)).toBe(940);
    expect(Number(irmaoGravado.valor)).toBe(1797.03);
  });

  test("DOIS arquivos distintos: um chip por arquivo (nunca 'o oficial'), e o upload novo continua disponível e funcional", async ({
    page,
    db,
  }) => {
    const pathA = await subirParaOAcervo(db, "comprovante", "a.txt", "pix A");
    const pathB = await subirParaOAcervo(db, "comprovante", "b.txt", "pix B");
    const venc = `${ANO}-05-10`;

    // Três lojas da MESMA REDE — o caso real do pre-mortem 1.
    const primeiro = await compraQuitada(db, {
      nomeDaLoja: "Loja Rede X",
      valor: 420,
      dataVencimento: venc,
      comprovantePath: pathA,
    });
    await compraQuitada(db, {
      faturaId: primeiro.faturaId,
      nomeDaLoja: "Loja Rede X",
      valor: 980,
      dataVencimento: venc,
      comprovantePath: pathB,
    });
    const alvo = await compraQuitada(db, {
      faturaId: primeiro.faturaId,
      nomeDaLoja: "Loja Rede X",
      valor: 300,
      dataVencimento: venc,
      comprovantePath: null,
    });
    await notaLigadaAo(db, alvo.pagamentoId, alvo.favorecidoId, 300);

    await page.goto(`/pagamento/${alvo.pagamentoId}/comprovante`);

    // ── Critério 2: DOIS chips, um por arquivo distinto ──────────────────
    const chipA = page.getByRole("button", {
      name:
        "Usar o comprovante de Loja Rede X — R$ 420,00 " +
        "(já enviado para outro pagamento desta fatura)",
    });
    const chipB = page.getByRole("button", {
      name:
        "Usar o comprovante de Loja Rede X — R$ 980,00 " +
        "(já enviado para outro pagamento desta fatura)",
    });
    await expect(chipA).toBeVisible();
    await expect(chipB).toBeVisible();

    // ── Critério 16: a UI não insinua que um chip é a prova correta ──────
    await expect(page.getByText("comprovante oficial")).toHaveCount(0);

    // ── Critério 4: e o upload novo está ali, com N = 2 ──────────────────
    const chipNovo = page.getByRole("button", {
      name: "Vou anexar um arquivo novo.",
    });
    await expect(chipNovo).toBeVisible();

    // ── O campo só nasce depois do clique em "arquivo novo" ──────────────
    await expect(page.getByLabel("Comprovante do pagamento")).toHaveCount(0);
    await chipNovo.click();
    await expect(page.getByLabel("Comprovante do pagamento")).toBeVisible();

    // ── Trocar de chip descarta o `File` em memória (spec, §decisões) ────
    await page
      .getByLabel("Comprovante do pagamento")
      .setInputFiles(arquivoNovo("descartado.png"));
    await chipB.click();
    await expect(page.getByLabel("Comprovante do pagamento")).toHaveCount(0);
    await chipNovo.click();
    // O arquivo não voltou: o botão pede o comprovante de novo.
    await expect(
      page.getByRole("button", { name: "Escolha o comprovante para continuar" }),
    ).toBeDisabled();

    // ── E o caminho "novo" grava como sempre, com o motivo DE SEMPRE ─────
    await page
      .getByLabel("Comprovante do pagamento")
      .setInputFiles(arquivoNovo("pix-da-terceira-loja.png"));
    await page
      .getByRole("button", {
        name: `Anexar comprovante — o custo confirmado de ${ANO} passa a R$ 300,00`,
      })
      .click();
    await expect(page.getByRole("status")).toContainText("Anexado.");

    const gravado = (await pagamentos(db)).find(
      (p) => p.id === alvo.pagamentoId,
    )!;
    expect(gravado.comprovante_path).toMatch(
      new RegExp(`^${USER_ID_SEED}/comprovante/`),
    );
    // Arquivo NOVO: não é nenhum dos dois dos irmãos.
    expect(gravado.comprovante_path).not.toBe(pathA);
    expect(gravado.comprovante_path).not.toBe(pathB);

    const rastro = await revisoes(db);
    expect(rastro).toHaveLength(1);
    expect(rastro[0]).toMatchObject({
      entidade_id: alvo.pagamentoId,
      // ⚠️ O motivo do upload direto NÃO muda neste ticket.
      motivo: "comprovante_chegou_depois",
    });
  });

  /** Critério 6 — zero componente novo, zero regressão. */
  test("pagamento AVULSO (sem fatura nenhuma): nenhum chip, e a tela é a de hoje", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db, "Pedreiro Avulso");
    const pagamentoId = await criarPagamento(db, {
      favorecido_id: favorecidoId,
      valor: 1500,
      data_pagamento: `${ANO}-06-01`,
      meio: "pix",
      comprovante_path: null,
    });

    await page.goto(`/pagamento/${pagamentoId}/comprovante`);

    await expect(
      page.getByText("Ou reaproveite um comprovante já enviado nesta fatura"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Vou anexar um arquivo novo." }),
    ).toHaveCount(0);
    // O campo de upload está visível DE CARA, como sempre esteve.
    await expect(page.getByLabel("Comprovante do pagamento")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Escolha o comprovante para continuar" }),
    ).toBeDisabled();
  });

  /**
   * As guardas são do BANCO, não da tela — critérios 8 e 13. Nenhuma delas tem
   * caminho na interface: a tela só oferece irmãos da própria fatura e tem
   * guarda de reentrada própria. É exatamente por isso que se prova aqui.
   */
  test("a RPC recusa: origem de outra fatura, origem sem comprovante, e destino que já tem comprovante", async ({
    db,
  }) => {
    const pathDaOutra = await subirParaOAcervo(
      db,
      "comprovante",
      "de-outra-fatura.txt",
      "pix de outro ciclo",
    );

    // Fatura 1 — a compra quitada COM comprovante.
    const outraFatura = await compraQuitada(db, {
      nomeDaLoja: "Casas da Água",
      valor: 800,
      dataVencimento: `${ANO}-07-10`,
      comprovantePath: pathDaOutra,
    });

    // Fatura 2 (vencimento diferente) — dois irmãos, um com arquivo e um sem.
    const pathDaMinha = await subirParaOAcervo(
      db,
      "comprovante",
      "da-minha-fatura.txt",
      "pix deste ciclo",
    );
    const irmaoComArquivo = await compraQuitada(db, {
      nomeDaLoja: "Ilhamix Concreto",
      valor: 1200,
      dataVencimento: `${ANO}-08-10`,
      comprovantePath: pathDaMinha,
    });
    const alvo = await compraQuitada(db, {
      faturaId: irmaoComArquivo.faturaId,
      nomeDaLoja: "Ferragens SC",
      valor: 600,
      dataVencimento: `${ANO}-08-10`,
      comprovantePath: null,
    });
    expect(outraFatura.faturaId).not.toBe(alvo.faturaId);

    // ── (a) PROVENIÊNCIA: origem de OUTRA fatura é recusada ─────────────
    // Sem esta guarda, a assinatura aceitaria qualquer par do acervo e o
    // comprovante de um ciclo ficaria PERMANENTE no pagamento de outro.
    const deOutraFatura = await db.rpc("reaproveitar_comprovante_de_irmao", {
      p_pagamento_id: alvo.pagamentoId,
      p_origem_pagamento_id: outraFatura.pagamentoId,
      p_anos: [],
    });
    expect(deOutraFatura.error?.message ?? "").toContain(
      "não pertencem à mesma fatura",
    );

    // ── (b) Origem SEM comprovante: nada a copiar, e a função diz isso ──
    const semComprovante = await db.rpc("reaproveitar_comprovante_de_irmao", {
      p_pagamento_id: irmaoComArquivo.pagamentoId,
      p_origem_pagamento_id: alvo.pagamentoId,
      p_anos: [],
    });
    expect(semComprovante.error?.message ?? "").toContain(
      "não tem comprovante",
    );

    // Nada gravou até aqui: recusa não deixa rastro de ato que não aconteceu.
    expect(await revisoes(db)).toHaveLength(0);
    expect(
      (await pagamentos(db)).find((p) => p.id === alvo.pagamentoId)!
        .comprovante_path,
    ).toBeNull();

    // ── (c) O ato legítimo, uma vez ─────────────────────────────────────
    const primeira = await db.rpc("reaproveitar_comprovante_de_irmao", {
      p_pagamento_id: alvo.pagamentoId,
      p_origem_pagamento_id: irmaoComArquivo.pagamentoId,
      p_anos: [],
    });
    expect(primeira.error).toBeNull();
    expect(
      (await pagamentos(db)).find((p) => p.id === alvo.pagamentoId)!
        .comprovante_path,
    ).toBe(pathDaMinha);

    // ── (d) Critério 8: a imutabilidade continua valendo ────────────────
    const segunda = await db.rpc("reaproveitar_comprovante_de_irmao", {
      p_pagamento_id: alvo.pagamentoId,
      p_origem_pagamento_id: irmaoComArquivo.pagamentoId,
      p_anos: [],
    });
    expect(segunda.error?.message ?? "").toContain("já tem comprovante");

    // E o UPDATE direto pela tabela também: `pagamento` tem UPDATE para
    // `authenticated` desde a 0005, e quem fecha o caminho é o trigger.
    const direto = await db
      .from("pagamento")
      .update({ comprovante_path: `${USER_ID_SEED}/comprovante/pela-tabela.png` })
      .eq("id", alvo.pagamentoId);
    expect(direto.error?.message ?? "").toContain(
      "comprovante_path já foi definido",
    );

    // UM ato, UM rastro: não existe gravação sem rastro nem rastro sem gravação.
    expect(await revisoes(db)).toHaveLength(1);
  });
});
