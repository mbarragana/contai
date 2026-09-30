import { OBRA_ID_SEED } from "./ambiente";
import {
  compromissos,
  criarCompromisso,
  criarDocumento,
  criarCompraCartao,
  criarFavorecido,
  criarPagamento as criarPagamentoNoBanco,
  criarPreVinculo,
  criarVinculo,
  pagamentos,
  preVinculos,
  vinculos,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * **CONTAI-080 — o PRÉ-VÍNCULO compromisso↔nota, antes do pagamento.**
 *
 * Fonte normativa: `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`,
 * ADENDO 6 (§J.0-J.5), ADENDO 7 (§K.1-K.5) e ADENDO 8 (§L.1-L.4).
 *
 * O que se prova aqui é o estado GRAVADO — em `compromisso_documento_previsto`
 * (a intenção) e em `pagamento_documento` (o vínculo formal, a tabela que
 * `alocarCusto` consome) —, contra o Postgres LOCAL, com a RLS ligada e o MESMO
 * client autenticado do app.
 *
 * ⚠️ **Os três ramos de N da confirmação (§K.2) são o coração deste arquivo**, e
 * o N é sempre a **UNIÃO deduplicada** `documentoPrevistoIds ∪
 * {documentoOrigemId}` — nunca a tabela nova isolada. O teste de dedup
 * (origem === pré-vínculo) é o que impede que este mecanismo e o
 * `propagar_vinculo_de_origem` (CONTAI-065) voltem a ser dois automatismos
 * competindo pela mesma guarda.
 */

let proximoCnpj = 0;

async function loja(db: Db, nome = "Superbeton") {
  proximoCnpj += 1;
  return criarFavorecido(db, {
    tipo: "pj",
    nome,
    documento: `4455566600${String(proximoCnpj).padStart(4, "0")}`,
  });
}

/** NF de material hábil, na obra do seed por padrão. */
async function nota(
  db: Db,
  over: { favorecidoId?: string; valor?: number; numero?: string } = {},
) {
  return criarDocumento(db, {
    favorecido_id: over.favorecidoId ?? (await loja(db)),
    tipo: "nf_material",
    classificacao: "material",
    valor: over.valor ?? 4850,
    numero: over.numero ?? "1042",
    data_emissao: "2026-08-10",
    destinatario_cpf_ok: true,
    status: "registrado",
  });
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

/** Agendamento aberto e vencido — o estado normal de quem vai confirmar. */
async function agendamento(
  db: Db,
  over: { favorecidoId: string; valor?: number; documentoOrigemId?: string },
) {
  return criarCompromisso(db, {
    favorecido_id: over.favorecidoId,
    valor_previsto: over.valor ?? 4850,
    data_prevista: maisDias(-3),
    origem: "boleto",
    ...(over.documentoOrigemId
      ? { documento_origem_id: over.documentoOrigemId }
      : {}),
  });
}

async function confirmarPelaTela(
  page: import("@playwright/test").Page,
  compromissoId: string,
  valor: string,
) {
  await page.goto(`/compromisso/${compromissoId}/confirmar`);
  await page.getByLabel("Data em que o dinheiro saiu").fill(hoje());
  await page.getByLabel("Valor efetivamente pago").fill(valor);
  await page.getByRole("button", { name: "Salvar pagamento" }).click();
}

// ══ A tela de edição (critérios 3 e 15) ═════════════════════════════════

test.describe("editor de pré-vínculo — o estado gravado é o que carrega", () => {
  test("marcar uma nota grava a INTENÇÃO, e nada em pagamento_documento", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    const documentoId = await nota(db, { favorecidoId });
    const compromissoId = await agendamento(db, { favorecidoId });

    await page.goto(`/compromisso/${compromissoId}`);
    await page
      .getByRole("link", { name: "Ligar notas a este agendamento" })
      .click();
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /^Salvar 1 nota pré-ligada/ }).click();
    await page.waitForURL(new RegExp(`/compromisso/${compromissoId}$`));

    expect(await preVinculos(db)).toEqual([
      expect.objectContaining({
        compromisso_id: compromissoId,
        documento_id: documentoId,
      }),
    ]);
    // ⚠️ §J.1: pré-vínculo NÃO é vínculo. Nenhuma linha na tabela que
    // `alocarCusto` consome, e nenhum pagamento inventado.
    expect(await vinculos(db)).toEqual([]);
    expect(await pagamentos(db)).toEqual([]);
  });

  test("o que já estava gravado volta MARCADO, e desmarcar remove", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    const documentoId = await nota(db, { favorecidoId });
    const compromissoId = await agendamento(db, { favorecidoId });
    await criarPreVinculo(db, compromissoId, documentoId);

    await page.goto(`/compromisso/${compromissoId}/pre-vincular`);
    const caixa = page.getByRole("checkbox").first();
    // A disciplina do CONTAI-034 aplicada ao caso: o que vem marcado é o ESTADO
    // GRAVADO, nunca um default — e é por isso que ele volta marcado aqui.
    await expect(caixa).toBeChecked();

    await caixa.uncheck();
    await page
      .getByRole("button", { name: "Salvar — sem nota pré-ligada" })
      .click();
    await page.waitForURL(new RegExp(`/compromisso/${compromissoId}$`));
    expect(await preVinculos(db)).toEqual([]);
  });

  test("a nota de ORIGEM aparece fixa e sem checkbox — não é editável aqui", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    const origem = await nota(db, { favorecidoId, numero: "900" });
    const outra = await nota(db, { favorecidoId, numero: "901", valor: 2100 });
    const compromissoId = await agendamento(db, {
      favorecidoId,
      documentoOrigemId: origem,
    });

    await page.goto(`/compromisso/${compromissoId}/pre-vincular`);
    await expect(page.getByText("Nota de origem — herdada")).toBeVisible();
    await expect(
      page.getByText("não pode ser removida aqui", { exact: false }),
    ).toBeVisible();
    // Uma caixa só na tela: a origem não tem. E ela é a da OUTRA nota.
    await expect(page.getByRole("checkbox")).toHaveCount(1);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /^Salvar 1 nota pré-ligada/ }).click();
    await page.waitForURL(new RegExp(`/compromisso/${compromissoId}$`));

    // ⚠️ A gravação NÃO toca a origem (critério 15): uma linha só, e é a da
    // nota editável.
    expect(await preVinculos(db)).toEqual([
      expect.objectContaining({ documento_id: outra }),
    ]);
  });

  test("agendamento já quitado: a tela recusa a edição e não grava nada", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    await nota(db, { favorecidoId });
    const compromissoId = await criarCompromisso(db, {
      favorecido_id: favorecidoId,
      valor_previsto: 4850,
      data_prevista: maisDias(-3),
      origem: "boleto",
      situacao: "quitado",
    });

    await page.goto(`/compromisso/${compromissoId}/pre-vincular`);
    await expect(
      page.getByText("já foi respondido", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    // E o CTA não existe no detalhe de um agendamento respondido (critério 4).
    await page.goto(`/compromisso/${compromissoId}`);
    await expect(
      page.getByRole("link", { name: "Ligar notas a este agendamento" }),
    ).toHaveCount(0);
  });

  /**
   * ⚠️ **CONTAI-081, critérios 1 a 3 — o INVERSO do que este teste afirmava.**
   *
   * Até o CONTAI-080, cartão não tinha pré-vínculo (D2 do Gate 2): o caminho da
   * fatura não contava N e não perguntava nada, e o texto do ADENDO 8 §L.2
   * prometeria os dois comportamentos que ele não tinha. O CONTAI-081 construiu as
   * duas pontas, e a restrição caiu — com os MESMOS componentes, sem variante
   * nova: o mesmo CTA, o mesmo chip, a mesma tela de edição.
   */
  test("⚠️ compra no CARTÃO: MESMO CTA, mesma tela, mesmo chip", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    const documentoId = await nota(db, { favorecidoId });
    const { compromissoId } = await criarCompraCartao(db, {
      favorecidoId,
      valor: 4850,
      dataCompra: maisDias(-10),
      dataVencimento: maisDias(20),
    });

    await page.goto(`/compromisso/${compromissoId}`);
    // A ação primária do cartão continua intacta — o CTA novo não a substitui.
    await expect(page.getByRole("link", { name: "Ver a fatura" })).toBeVisible();
    await page
      .getByRole("link", { name: "Ligar notas a este agendamento" })
      .click();

    // A tela do CONTAI-080, reaproveitada sem mudança (critério 3): a lista de
    // candidatos nunca dependeu da origem do compromisso.
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /^Salvar 1 nota pré-ligada/ }).click();
    await page.waitForURL(new RegExp(`/compromisso/${compromissoId}$`));

    expect(await preVinculos(db)).toEqual([
      expect.objectContaining({
        compromisso_id: compromissoId,
        documento_id: documentoId,
      }),
    ]);
    // §J.1 vale igual para cartão: intenção não é vínculo, e nada de pagamento.
    expect(await vinculos(db)).toEqual([]);
    expect(await pagamentos(db)).toEqual([]);

    // E o chip/texto do §L.2 — o MESMO bloco, na variante do N atual.
    const bloco = page.locator('[data-pre-vinculo="compromisso"]');
    await expect(bloco).toContainText("Pré-vínculo — ainda não é custo");
    await expect(bloco).toContainText(
      "o sistema vai vincular esta nota automaticamente — sem perguntar de novo",
    );
  });

  test("obra sem nota nenhuma: estado vazio com a saída de registrar", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    const compromissoId = await agendamento(db, { favorecidoId });

    await page.goto(`/compromisso/${compromissoId}/pre-vincular`);
    await expect(
      page.getByText("Nenhuma nota registrada nesta obra ainda."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Registrar o documento agora" }),
    ).toBeVisible();
  });
});

// ══ O chip e o texto nas duas telas (critérios 5 e 6) ═══════════════════

test.describe("chip e texto — o pré-vínculo nunca se lê como custo", () => {
  test("detalhe do agendamento: N=1 promete automático; com a 2ª nota, promete pergunta", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    const notaA = await nota(db, { favorecidoId, numero: "1042" });
    const notaB = await nota(db, { favorecidoId, numero: "1043", valor: 2100 });
    const compromissoId = await agendamento(db, { favorecidoId });
    await criarPreVinculo(db, compromissoId, notaA);

    await page.goto(`/compromisso/${compromissoId}`);
    const bloco = page.locator('[data-pre-vinculo="compromisso"]');
    await expect(bloco).toContainText("Pré-vínculo — ainda não é custo");
    // Variante N=1, literal do ADENDO 8 §L.2.
    await expect(bloco).toContainText(
      "o sistema vai vincular esta nota automaticamente — sem perguntar de novo",
    );
    await expect(bloco).toContainText("Nota nº 1042");
    await expect(bloco).toContainText("não entra no custo de aquisição");

    // ⚠️ O N é RECALCULADO a cada render (§L.3): acrescentar a segunda nota TEM
    // de trocar a variante — o texto não pode ficar preso ao N de antes.
    await criarPreVinculo(db, compromissoId, notaB);
    await page.reload();
    const depois = page.locator('[data-pre-vinculo="compromisso"]');
    await expect(depois).toContainText(
      "o sistema vai te perguntar se este pré-vínculo ainda vale",
    );
    await expect(depois).toContainText("Nota nº 1043");
    await expect(depois).not.toContainText("sem perguntar de novo");
  });

  test("detalhe da nota: o texto do §J.2 e a nota SEGUINDO sem pagamento", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db, "WK Construções LTDA");
    const documentoId = await nota(db, { favorecidoId, valor: 3200 });
    const primeiro = await agendamento(db, { favorecidoId, valor: 3200 });
    await criarPreVinculo(db, primeiro, documentoId);

    await page.goto(`/documento/${documentoId}`);
    const bloco = page.locator('[data-pre-vinculo="documento"]');
    await expect(bloco).toContainText("Pré-vínculo — ainda não é custo");
    await expect(bloco).toContainText("está pré-ligado a esta nota");
    // Critério 8: a nota CONTINUA na lista, e o texto diz isso.
    await expect(bloco).toContainText(
      'segue contando em "Notas hábeis sem pagamento vinculado"',
    );

    // Critério 6 — N≥2 compromissos na MESMA nota: lista todos, sem eleição.
    const segundo = await agendamento(db, { favorecidoId, valor: 1600 });
    await criarPreVinculo(db, segundo, documentoId);
    await page.reload();
    await expect(page.locator('[data-pre-vinculo="documento"]')).toContainText(
      "estão pré-ligados a esta nota",
    );
  });

  test("critério 7 — declarar pré-vínculo não muda NÚMERO nenhum da obra", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    const documentoId = await nota(db, { favorecidoId, valor: 4850 });
    const compromissoId = await agendamento(db, { favorecidoId });

    // O painel da obra ANTES: a nota hábil sem pagamento e o custo confirmado.
    await page.goto("/");
    const antes = await page.locator("main").innerText();

    await criarPreVinculo(db, compromissoId, documentoId);
    await page.reload();
    // ⚠️ §J.1: *"não entra em nenhuma soma, sob nenhum rótulo"*. A comparação é
    // do texto inteiro da Visão geral: se um único número mudasse, isto
    // quebraria com o diff na mensagem.
    expect(await page.locator("main").innerText()).toBe(antes);
  });
});

// ══ A conversão, bifurcada por N (critérios 10 a 14) ════════════════════

test.describe("conversão na confirmação — os três ramos de N (§K.2)", () => {
  test("N=0 · nada pré-ligado: fluxo de antes, sem vínculo e sem pergunta", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    await nota(db, { favorecidoId });
    const compromissoId = await agendamento(db, { favorecidoId });

    await confirmarPelaTela(page, compromissoId, "4.850,00");
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);

    expect(await pagamentos(db)).toHaveLength(1);
    expect(await vinculos(db)).toEqual([]);
  });

  test("N=1 · uma nota pré-ligada: vínculo formal SEM clique nenhum", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    const documentoId = await nota(db, { favorecidoId });
    const compromissoId = await agendamento(db, { favorecidoId });
    await criarPreVinculo(db, compromissoId, documentoId);

    await confirmarPelaTela(page, compromissoId, "4.850,00");
    // ⚠️ Vai DIRETO para o pagamento: nenhuma tela intermediária, nenhum botão
    // a mais. É o §K.2 — *"marca automaticamente, sem clique adicional"*.
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);

    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(1);
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagos[0].id, documento_id: documentoId },
    ]);
    // A intenção não é apagada pela conversão — ela é o rastro do que foi dito.
    expect(await preVinculos(db)).toHaveLength(1);
    expect((await compromissos(db))[0].situacao).toBe("quitado");
  });

  test("⚠️ DEDUP · origem === pré-vínculo resolve para N=1: UMA linha, sem pergunta", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    const documentoId = await nota(db, { favorecidoId });
    const compromissoId = await agendamento(db, {
      favorecidoId,
      documentoOrigemId: documentoId,
    });
    // Ele reafirma, pela tela nova, a nota que JÁ era a de origem — o caso mais
    // provável do relato.
    await criarPreVinculo(db, compromissoId, documentoId);

    await confirmarPelaTela(page, compromissoId, "4.850,00");
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);

    const pagos = await pagamentos(db);
    // ⚠️ UMA linha só, e nenhum 23505: o `propagar_vinculo_de_origem` do PASSO 4
    // e o PASSO 5 deste ticket convergem na MESMA linha, e o upsert com
    // `ignoreDuplicates` faz da duplicata um no-op.
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagos[0].id, documento_id: documentoId },
    ]);
  });

  test("N≥2 · origem + outra nota: a tela PERGUNTA, e 'Sim' grava os dois", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    const origem = await nota(db, { favorecidoId, numero: "1042", valor: 3000 });
    const segunda = await nota(db, { favorecidoId, numero: "1043", valor: 1850 });
    const compromissoId = await agendamento(db, {
      favorecidoId,
      documentoOrigemId: origem,
    });
    await criarPreVinculo(db, compromissoId, segunda);

    await confirmarPelaTela(page, compromissoId, "4.850,00");

    // ⚠️ NÃO navega para o pagamento: §J.3 exige confirmação explícita quando há
    // rateio possível. O pagamento JÁ está salvo neste ponto, e a tela diz isso.
    const bloco = page.locator('[data-pre-vinculo="revisar"]');
    await expect(bloco).toContainText(
      "Confirmar este pagamento também confirma o vínculo com",
    );
    await expect(bloco).toContainText("Nota nº 1042");
    await expect(bloco).toContainText("Nota nº 1043");
    expect(await pagamentos(db)).toHaveLength(1);

    // ⚠️ **D1 do Gate 2 — NADA em `pagamento_documento` antes do clique.** Até a
    // correção, a nota de ORIGEM já estava gravada aqui: o PASSO 4 propagava por
    // RPC (CONTAI-065) antes de qualquer toque, e a revalidação do §J.3 cobria só
    // a outra nota — meio conjunto convertido sozinho. Com `propagarOrigem:
    // false` para N≥2, o conjunto inteiro espera o Mateus.
    expect(
      await vinculos(db),
      "N≥2 é 100% revalidado: nem a nota de origem converte antes do toque",
    ).toEqual([]);
    expect((await compromissos(db))[0].situacao, "a quitação em si acontece").toBe(
      "quitado",
    );

    await page.getByRole("button", { name: "Sim, confirmar os vínculos" }).click();
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);

    const pagos = await pagamentos(db);
    expect(await vinculos(db)).toEqual(
      expect.arrayContaining([
        { pagamento_id: pagos[0].id, documento_id: origem },
        { pagamento_id: pagos[0].id, documento_id: segunda },
      ]),
    );
    expect(await vinculos(db)).toHaveLength(2);
  });

  test("N≥2 · 'Revisar antes de confirmar' leva ao seletor SEM perder os pré-vínculos", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    const origem = await nota(db, { favorecidoId, numero: "1042", valor: 3000 });
    const segunda = await nota(db, { favorecidoId, numero: "1043", valor: 1850 });
    const compromissoId = await agendamento(db, {
      favorecidoId,
      documentoOrigemId: origem,
    });
    await criarPreVinculo(db, compromissoId, segunda);

    await confirmarPelaTela(page, compromissoId, "4.850,00");
    await page
      .getByRole("link", { name: "Revisar antes de confirmar" })
      .click();
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+\/ligar$/);

    // Critério 12: nada foi apagado — só não foi confirmado ainda.
    expect(await preVinculos(db)).toHaveLength(1);
    // ⚠️ **D1 do Gate 2**: nem a origem foi gravada. Por isso ela chega aqui
    // como CANDIDATO pré-marcado, e não no card de "já ligados".
    expect(await vinculos(db)).toEqual([]);
    await expect(
      page.locator('[data-ja-ligados="pagamento"]'),
      "sem vínculo prévio, o card de já ligados não existe",
    ).toHaveCount(0);

    // ⚠️ Critério 13 — a EXCEÇÃO nomeada: as DUAS notas da união (origem
    // inclusive) nascem MARCADAS e com o chip. Os checkboxes continuam
    // destravados — é revalidação, não confirmação automática.
    const caixas = page.getByRole("checkbox");
    await expect(caixas).toHaveCount(2);
    await expect(caixas.nth(0)).toBeChecked();
    await expect(caixas.nth(1)).toBeChecked();
    await expect(page.locator("main")).toContainText(
      "Pré-vínculo — ainda não é custo",
    );
    await expect(page.locator("main")).toContainText(
      "O que já vem marcado aqui é o pré-vínculo que você declarou",
    );

    // E confirmar dali grava os dois — o conjunto fecha, e o clique é um só.
    await page.getByRole("button", { name: /^Ligar 2 documentos/ }).click();
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);
    const pagos = await pagamentos(db);
    expect(await vinculos(db)).toEqual(
      expect.arrayContaining([
        { pagamento_id: pagos[0].id, documento_id: origem },
        { pagamento_id: pagos[0].id, documento_id: segunda },
      ]),
    );
    expect(await vinculos(db)).toHaveLength(2);
  });

  /**
   * O card "Já ligados a este pagamento" (critério 14) com o cenário que a
   * correção do D1 deixou para ele: N=1, em que o vínculo NASCE sozinho no PASSO
   * 4 e a nota deixa de ser candidata. Antes, quem exercitava este card era o
   * N≥2 — que agora, corretamente, não tem vínculo nenhum ao chegar lá.
   */
  test("N=1 · chegando ao seletor depois, a nota ligada aparece em 'já ligados'", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    const origem = await nota(db, { favorecidoId, numero: "1042" });
    const compromissoId = await agendamento(db, {
      favorecidoId,
      documentoOrigemId: origem,
    });

    await confirmarPelaTela(page, compromissoId, "4.850,00");
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);
    const pagos = await pagamentos(db);
    expect(await vinculos(db)).toHaveLength(1);

    await page.goto(`/pagamento/${pagos[0].id}/ligar`);
    const jaLigados = page.locator('[data-ja-ligados="pagamento"]');
    await expect(jaLigados).toContainText("Já ligados a este pagamento");
    // ⚠️ Não-bloqueante 1 do Gate 2: chip neutro, sem "automaticamente".
    await expect(jaLigados).toContainText("Ligado ao confirmar o agendamento");
    await expect(jaLigados).not.toContainText("automaticamente");
    await expect(jaLigados).toContainText(
      "Ligado ao confirmar o agendamento — você já tinha indicado isso antes de pagar.",
    );
  });

  /**
   * ⚠️ **A SEGUNDA PORTA DO D1, travada por teste.**
   *
   * `quitarCompromisso` tem dois chamadores: a tela de confirmar (acima) e a
   * **sugestão de quitação rápida** (`app/_components/quitacao.tsx`), que
   * aparece no detalhe de um pagamento já gravado. O D1 do Gate 2 foi corrigido
   * nos dois, mas só o primeiro tinha teste — e sem este, alguém "otimizando" o
   * caminho rápido no futuro reintroduz a propagação silenciosa de meio conjunto
   * sem nada ficar vermelho.
   *
   * O comportamento aqui foi **julgado correto pelo Gate 2**, não tolerado: o
   * §K.2 exige clique para N≥2, este componente não tem onde perguntar, e
   * inventar um bloco de revalidação nele seria desenho sem spec. Então ele
   * quita e **não converte nada** — a união inteira espera o Mateus em
   * `/pagamento/[id]/ligar`, pré-marcada pelo critério 13.
   */
  test("⚠️ N≥2 pela SUGESTÃO RÁPIDA: quita, não converte, e a união espera pré-marcada", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    const origem = await nota(db, { favorecidoId, numero: "1042", valor: 3000 });
    const segunda = await nota(db, { favorecidoId, numero: "1043", valor: 1850 });
    const compromissoId = await agendamento(db, {
      favorecidoId,
      documentoOrigemId: origem,
    });
    await criarPreVinculo(db, compromissoId, segunda);

    // Pagamento JÁ gravado, no valor previsto — é o que faz a sugestão aparecer
    // com o "sim" simples (valor igual não dispara os dois botões do §D).
    const pagamentoId = await criarPagamentoAvulso(db, favorecidoId);

    await page.goto(`/pagamento/${pagamentoId}`);
    await page
      .getByRole("button", { name: "Sim, quita este agendamento" })
      .click();

    // A QUITAÇÃO acontece — fato consumado nunca é recusado (§4 do parecer).
    await expect
      .poll(async () => (await compromissos(db))[0].situacao, {
        message: "a sugestão rápida quita normalmente",
      })
      .toBe("quitado");

    // ⚠️ E NADA converte: nem a nota de origem, que antes da correção do D1 era
    // propagada pela RPC do CONTAI-065 mesmo com o conjunto em N≥2.
    expect(
      await vinculos(db),
      "N≥2 exige clique (§K.2), e este componente não tem onde perguntar — então ele não grava vínculo nenhum",
    ).toEqual([]);
    // A intenção segue gravada: nada foi apagado, só não foi confirmado.
    expect(await preVinculos(db)).toHaveLength(1);

    // E o conjunto INTEIRO espera no seletor, pré-marcado — a um clique.
    await page.goto(`/pagamento/${pagamentoId}/ligar`);
    const caixas = page.getByRole("checkbox");
    await expect(caixas).toHaveCount(2);
    await expect(caixas.nth(0)).toBeChecked();
    await expect(caixas.nth(1)).toBeChecked();
    await expect(page.locator("main")).toContainText(
      "O que já vem marcado aqui é o pré-vínculo que você declarou",
    );
    await expect(
      page.locator('[data-ja-ligados="pagamento"]'),
      "nada foi ligado, então não há card de já ligados",
    ).toHaveCount(0);

    // Fecha pelo caminho normal: um clique, os dois vínculos.
    await page.getByRole("button", { name: /^Ligar 2 documentos/ }).click();
    await page.waitForURL(/\/pagamento\/[0-9a-f-]+$/);
    expect(await vinculos(db)).toEqual(
      expect.arrayContaining([
        { pagamento_id: pagamentoId, documento_id: origem },
        { pagamento_id: pagamentoId, documento_id: segunda },
      ]),
    );
    expect(await vinculos(db)).toHaveLength(2);
  });

  test("sem agendamento de origem, o seletor continua com NADA marcado", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    await nota(db, { favorecidoId });
    const pagamentoId = await criarPagamentoAvulso(db, favorecidoId);

    await page.goto(`/pagamento/${pagamentoId}/ligar`);
    // A doutrina de sempre, intacta onde a exceção não se aplica.
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await expect(page.locator("main")).toContainText(
      "Nada vem marcado, e nenhum vínculo nasce sem você tocar.",
    );
    await expect(page.locator('[data-ja-ligados="pagamento"]')).toHaveCount(0);
  });

  test("vínculo que ele já tinha feito à mão aparece em 'já ligados', SEM a explicação de automação", async ({
    page,
    db,
  }) => {
    const favorecidoId = await loja(db);
    const outraNota = await nota(db, { favorecidoId, numero: "777" });
    const pagamentoId = await criarPagamentoAvulso(db, favorecidoId);
    await criarVinculo(db, pagamentoId, outraNota);

    await page.goto(`/pagamento/${pagamentoId}/ligar`);
    const jaLigados = page.locator('[data-ja-ligados="pagamento"]');
    await expect(jaLigados).toContainText("Já ligados a este pagamento");
    // O fato ("já ligado") vale; a automação não se aplica a ele, e a tela não
    // finge que sim.
    await expect(jaLigados).not.toContainText("Ligado automaticamente");
  });
});

/** Pagamento avulso, já com comprovante — sem agendamento nenhum por trás. */
async function criarPagamentoAvulso(
  db: Db,
  favorecidoId: string,
): Promise<string> {
  return criarPagamentoNoBanco(db, {
    favorecido_id: favorecidoId,
    valor: 4850,
    data_pagamento: hoje(),
    meio: "pix",
    comprovante_path: `${OBRA_ID_SEED}/comprovante/pix.pdf`,
  });
}
