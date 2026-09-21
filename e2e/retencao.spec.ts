import { OBRA_ID_SEED } from "./ambiente";
import {
  contarLinhasDeRetencaoDeOutroDono,
  criarDocumento,
  criarFavorecido,
  criarLinhaDeRetencao,
  criarPagamento,
  criarVinculo,
  documentos,
  linhasDeRetencao,
  plantarLinhaDeRetencaoDeOutroDono,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";
import {
  escolher,
  preencherDocumentoBasico,
  responderCnoDaNota,
} from "./formularios";

/**
 * **CONTAI-038 — a retenção vira LISTA DE LINHAS, e a pendência muda de
 * natureza.**
 *
 * Fonte normativa: `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`
 * (corpo §§0-7 + ADENDO de 2026-09-19). O ciclo completo, contra o Supabase
 * LOCAL como o resto da suíte: sessão de verdade, RLS de verdade, e as
 * asserções olham o **estado gravado** além da tela — é o estado gravado que
 * vira declaração.
 *
 * ⚠️ Os dois cenários que o `cto-obra` acrescentou em 2026-09-20, ao conceder
 * o DELETE, estão no fim do arquivo: remover linha com pendência aberta, e o
 * DELETE de linha de OUTRA CONTA (que a RLS filtra em silêncio — 200 com zero
 * linhas, e é por isso que o app exige `data.length === 1`).
 */

const CNPJ_EMITENTE = "11.222.333/0001-81";

let proximoEmitente = 0;

async function emitente(db: Db) {
  proximoEmitente += 1;
  return criarFavorecido(db, {
    tipo: "pj",
    nome: `Francisco Empreitadas ${proximoEmitente}`,
    documento: `1122233300018${proximoEmitente}`,
  });
}

/** NF de serviço com o gate "destacada" — o estado que o repeater resolve. */
async function notaComRetencaoDestacada(
  db: Db,
  over: { valor?: number } = {},
) {
  return criarDocumento(db, {
    favorecido_id: await emitente(db),
    tipo: "nf_servico",
    valor: over.valor ?? 18000,
    numero: "1042",
    data_emissao: "2026-03-20",
    classificacao: "mao_obra",
    destinatario_cpf_ok: true,
    // CONTAI-007: a obra do seed tem CNO, e sem isto a nota carrega OUTRA
    // pendência âmbar que embaralharia a leitura dos cards.
    nota_traz_cno: true,
    cno_referenciado: "12.345.67890/26",
    retencao_na_nota: "destacada",
    status: "registrado",
  });
}

/** O caso REAL do Francisco: linha única, combinada, descontada de fato. */
function linhaDoFrancisco(documentoId: string, over: Record<string, unknown> = {}) {
  return {
    documento_id: documentoId,
    rotulo_literal: "Total das Retenções (ISSQN / Federais)",
    valor: 540,
    composicao: "combinado_nao_aberto" as const,
    e_desconto_efetivo: true,
    quem_recolhe: "nao_sei" as const,
    ...over,
  };
}

const CONSEQUENCIA =
  "Retenção descontada do pagamento sem confirmação de quem recolhe — se " +
  "ninguém recolher, não é economia, é passivo não identificado.";

// ══ 1 · Captura — o gate, e SÓ o gate ════════════════════════════════════

test.describe("captura: o gate de duas opções (critérios 1 e 2)", () => {
  test("nada vem pré-marcado, e sem responder não salva", async ({ page }) => {
    await page.goto("/adicionar/documento");
    await preencherDocumentoBasico(page, {
      tipo: "NF serviço",
      emitente: "Francisco Empreitadas",
      documento: CNPJ_EMITENTE,
      valor: "18.000,00",
      numero: "1042",
      dataEmissao: "2026-03-20",
      noCpf: "Sim",
    });
    await responderCnoDaNota(page, "É o CNO desta obra");

    const gate = page.getByRole("group", {
      name: "Esta nota destaca alguma retenção?",
    });
    await expect(gate).toBeVisible();
    // ⚠️ DUAS opções, e nenhuma delas é "não sei": o tri-estado morreu com o
    // booleano. "A nota destaca retenção?" é leitura do papel.
    await expect(gate.getByRole("radio")).toHaveCount(2);
    for (const radio of await gate.getByRole("radio").all()) {
      await expect(radio).not.toBeChecked();
    }

    // ⚠️ **O REPEATER NÃO EXISTE NESTA TELA** — é captura de canteiro, e cinco
    // perguntas por linha estourariam o momento (Gate de Mock).
    await expect(page.locator('[data-retencao="formulario"]')).toHaveCount(0);

    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(
      page.getByText("Responda se esta nota destaca alguma retenção."),
    ).toBeVisible();
  });

  test("'Destacada' salva com ZERO linhas — e não abre banner de consequência", async ({
    page,
    db,
  }) => {
    await page.goto("/adicionar/documento");
    await preencherDocumentoBasico(page, {
      tipo: "NF serviço",
      emitente: "Francisco Empreitadas",
      documento: CNPJ_EMITENTE,
      valor: "18.000,00",
      numero: "1042",
      dataEmissao: "2026-03-20",
      noCpf: "Sim",
      arquivo: {
        name: "nf-1042.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 nf"),
      },
    });
    await responderCnoDaNota(page, "É o CNO desta obra");
    await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");

    // ⚠️ Nenhuma consequência fiscal está aberta neste momento — só um dado a
    // completar depois, sentado. O banner antigo ("não abate na aferição do
    // INSS") morreu com a premissa que o §2 do parecer derrubou.
    await expect(
      page.getByText(
        "Você detalha isso depois, sentado — aqui só marcamos que a nota tem retenção.",
      ),
    ).toBeVisible();
    await expect(page.getByText("aferição do INSS da obra")).toHaveCount(0);

    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    const gravados = await documentos(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0].retencao_na_nota).toBe("destacada");
    // Critério 2: o documento grava com ZERO linhas, e isso é legítimo.
    expect(await linhasDeRetencao(db)).toHaveLength(0);
  });
});

// ══ 2 · Resolução — o repeater (critérios 3, 4 e 5) ══════════════════════

test.describe("detalhe: o repeater de linhas", () => {
  test("gate 'destacada' sem linha é pendência VISÍVEL, nunca 'sem retenção'", async ({
    page,
    db,
  }) => {
    const id = await notaComRetencaoDestacada(db);
    await page.goto(`/documento/${id}`);

    const bloco = page.locator('[data-pendencia="retencao-sem-linha"]');
    await expect(bloco).toBeVisible();
    await expect(
      page.getByText(
        "Esta nota destaca retenção, mas nenhuma linha foi registrada ainda.",
      ),
    ).toBeVisible();
    // ⚠️ O invariante do §2 dito em tela: nenhuma retenção abate a aferição.
    await expect(
      page.getByText(
        "Nenhuma retenção desta nota abate o INSS (SERO) — só a declaração vinculada ao CNO abate, e isso é separado deste registro.",
      ),
    ).toBeVisible();
  });

  test("a linha só grava COMPLETA — o botão nomeia o que falta", async ({
    page,
    db,
  }) => {
    const id = await notaComRetencaoDestacada(db);
    await page.goto(`/documento/${id}`);
    await page
      .getByRole("button", { name: "+ Adicionar a primeira linha de retenção" })
      .click();

    const formulario = page.locator('[data-retencao="formulario"]');
    await expect(formulario).toBeVisible();
    // ⚠️ Nasce inteiramente em branco — nada herdado, nada pré-marcado.
    for (const radio of await formulario.getByRole("radio").all()) {
      await expect(radio).not.toBeChecked();
    }
    await expect(
      page.getByRole("button", { name: /Faltam \d+ respostas? para adicionar/ }),
    ).toBeDisabled();

    await page
      .getByLabel("Rótulo (copie exatamente da nota)")
      .fill("Total das Retenções (ISSQN / Federais)");
    await page.getByLabel("Valor", { exact: true }).fill("540,00");

    // ⚠️ **Linha COMBINADA não pede tributo** — pedir seria a decomposição que
    // o ADENDO A.1 proíbe em regra dura.
    await escolher(
      page,
      "O que esta linha representa?",
      "Total combinado, não aberto pela nota",
    );
    await expect(page.getByRole("group", { name: "Qual tributo?" })).toHaveCount(0);

    // Só depois de "sim" a pergunta de quem recolhe aparece.
    await expect(
      page.getByRole("group", { name: "Quem recolhe isto?" }),
    ).toHaveCount(0);
    await escolher(
      page,
      "Esse valor é de fato abatido do que você transfere ao prestador?",
      "Sim",
    );
    await expect(
      page.getByRole("group", { name: "Quem recolhe isto?" }),
    ).toBeVisible();

    // "Ainda não sei" é resposta de PRIMEIRA CLASSE (ADENDO A.2/A.4).
    await escolher(page, "Quem recolhe isto?", "Ainda não sei");
    await page.getByRole("button", { name: "Adicionar linha" }).click();

    // A linha só aparece depois do INSERT confirmado — esperar por ela é o que
    // impede a asserção de banco de correr na frente da gravação.
    await expect(page.locator('[data-retencao="linha"]')).toHaveCount(1);

    const linhas = await linhasDeRetencao(db);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      // ⚠️ O rótulo é LITERAL: nem normalizado, nem encurtado.
      rotulo_literal: "Total das Retenções (ISSQN / Federais)",
      composicao: "combinado_nao_aberto",
      tributo: null,
      e_desconto_efetivo: true,
      quem_recolhe: "nao_sei",
    });
    expect(Number(linhas[0].valor)).toBe(540);
  });

  test("'tributo único' abre a pergunta de qual tributo, e ela é obrigatória", async ({
    page,
    db,
  }) => {
    const id = await notaComRetencaoDestacada(db);
    await page.goto(`/documento/${id}`);
    await page
      .getByRole("button", { name: "+ Adicionar a primeira linha de retenção" })
      .click();

    await page.getByLabel("Rótulo (copie exatamente da nota)").fill("INSS");
    await page.getByLabel("Valor", { exact: true }).fill("340,00");
    await escolher(
      page,
      "O que esta linha representa?",
      "Tributo único identificado",
    );
    await expect(page.getByRole("group", { name: "Qual tributo?" })).toBeVisible();
    // Sem escolher o tributo, o botão continua nomeando o que falta.
    await escolher(
      page,
      "Esse valor é de fato abatido do que você transfere ao prestador?",
      "Não",
    );
    await expect(
      page.getByRole("button", { name: /Faltam 1 resposta para adicionar/ }),
    ).toBeDisabled();

    await escolher(page, "Qual tributo?", "INSS");
    await page.getByRole("button", { name: "Adicionar linha" }).click();
    await expect(page.locator('[data-retencao="linha"]')).toHaveCount(1);

    const linhas = await linhasDeRetencao(db);
    expect(linhas[0]).toMatchObject({
      composicao: "tributo_identificado",
      tributo: "inss",
      e_desconto_efetivo: false,
      // Linha informativa: sem desconto efetivo não existe recolhedor.
      quem_recolhe: null,
    });
  });
});

// ══ 3 · O ciclo da pendência (Gate Fiscal, P1) ═══════════════════════════

test.describe("a pendência nasce, e fecha pelas condições do parecer", () => {
  test("nasce VERMELHA na home, com o texto literal do parecer", async ({
    page,
    db,
  }) => {
    const id = await notaComRetencaoDestacada(db);
    await criarLinhaDeRetencao(db, linhaDoFrancisco(id));

    await page.goto("/");
    const chip = page.getByText("Retenção sem recolhedor", { exact: true });
    await expect(chip).toBeVisible();
    await expect(
      page.getByText("Retenção descontada, sem confirmar quem recolhe"),
    ).toBeVisible();
    await expect(page.getByText(CONSEQUENCIA)).toBeVisible();
    // ⚠️ **VERMELHA**, e a cor vem de `gravidadeDaRegua` com a exceção nomeada
    // (critério 7a), nunca de um literal solto na tela. O chip da home usa
    // `cor={p.gravidade}`, então a classe é o que a régua produziu.
    await expect(chip).toHaveClass(/text-red/);
    // O valor mostrado é o da LINHA aberta, não o bruto da nota: a pendência
    // é sobre o valor retido, não sobre o custo.
    await expect(page.getByText("R$ 540,00")).toBeVisible();
  });

  test("responder 'A empresa' FECHA a pendência — sem pedir comprovante", async ({
    page,
    db,
  }) => {
    const id = await notaComRetencaoDestacada(db);
    await criarLinhaDeRetencao(db, linhaDoFrancisco(id));

    await page.goto(`/documento/${id}`);
    await expect(
      page.locator('[data-pendencia="retencao-sem-recolhedor"]'),
    ).toBeVisible();

    await escolher(page, "Quem recolhe isto?", "A empresa");
    await page.getByRole("button", { name: "Salvar resposta" }).click();

    await expect(
      page.locator('[data-pendencia="retencao-sem-recolhedor"]'),
    ).toHaveCount(0);
    expect((await linhasDeRetencao(db))[0].quem_recolhe).toBe("empresa");

    // E some da home no próximo carregamento.
    await page.goto("/");
    await expect(page.getByText("Retenção sem recolhedor")).toHaveCount(0);
  });

  test("'Eu' continua aberta até a guia aparecer vinculada (§4.1)", async ({
    page,
    db,
  }) => {
    const id = await notaComRetencaoDestacada(db, { valor: 18000 });
    await criarLinhaDeRetencao(db, linhaDoFrancisco(id));

    await page.goto(`/documento/${id}`);
    await escolher(page, "Quem recolhe isto?", "Eu");
    await page.getByRole("button", { name: "Salvar resposta" }).click();

    // Ainda aberta: o líquido foi pago, a guia não.
    const liquido = await criarPagamento(db, {
      favorecido_id: (await documentos(db))[0].favorecido_id,
      valor: 17460,
      data_pagamento: "2026-03-25",
      meio: "pix",
      comprovante_path: "u/pix.png",
    });
    await criarVinculo(db, liquido, id);
    await page.goto("/");
    await expect(page.getByText("Retenção sem recolhedor")).toBeVisible();

    // A perna da guia, vinculada à mesma nota: Σ pagamentos == bruto → fecha.
    const guia = await criarPagamento(db, {
      favorecido_id: (await documentos(db))[0].favorecido_id,
      valor: 540,
      data_pagamento: "2026-04-10",
      meio: "pix",
      comprovante_path: "u/guia.png",
    });
    await criarVinculo(db, guia, id);
    await page.goto("/");
    await expect(page.getByText("Retenção sem recolhedor")).toHaveCount(0);
  });

  test("linha informativa (desconto não efetivo) NUNCA abre pendência", async ({
    page,
    db,
  }) => {
    const id = await notaComRetencaoDestacada(db);
    // A composição do DAS do Simples: número impresso, dinheiro nenhum saiu.
    await criarLinhaDeRetencao(
      db,
      linhaDoFrancisco(id, {
        rotulo_literal: "INSS (composição do Simples)",
        composicao: "tributo_identificado",
        tributo: "inss",
        e_desconto_efetivo: false,
        quem_recolhe: null,
      }),
    );
    await page.goto("/");
    await expect(page.getByText("Retenção sem recolhedor")).toHaveCount(0);
  });
});

// ══ 4 · Remover linha — os dois cenários do `cto-obra` (2026-09-20) ══════

test.describe("remover linha (DELETE concedido na 0017)", () => {
  test("remover a linha com pendência ABERTA faz a pendência sumir da home", async ({
    page,
    db,
  }) => {
    const id = await notaComRetencaoDestacada(db);
    await criarLinhaDeRetencao(db, linhaDoFrancisco(id));

    await page.goto("/");
    await expect(page.getByText("Retenção sem recolhedor")).toBeVisible();

    await page.goto(`/documento/${id}`);
    // ⚠️ SEM diálogo de confirmação: o critério 3 diz "livremente".
    await page.getByRole("button", { name: "Remover esta linha" }).click();

    // A linha sai da tela só DEPOIS de o servidor confirmar — nunca otimista.
    await expect(page.locator('[data-retencao="linha"]')).toHaveCount(0);
    expect(await linhasDeRetencao(db)).toHaveLength(0);

    await page.goto("/");
    await expect(page.getByText("Retenção sem recolhedor")).toHaveCount(0);
    // E o documento continua lá: a linha é AFIRMAÇÃO, a NF é ACERVO.
    expect(await documentos(db)).toHaveLength(1);
  });

  /**
   * ⚠️ **O cenário que justifica `data.length === 1` em `lib/data.ts`.**
   *
   * Um DELETE que a RLS filtra por inteiro **não é erro** para o PostgREST: ele
   * devolve 200 com zero linhas. Sem a asserção no cliente, o app trataria
   * isso como sucesso e a linha sumiria da tela continuando no banco.
   */
  test("DELETE de linha de OUTRA CONTA devolve 0 linhas — e é erro no app", async ({
    db,
  }) => {
    const alheia = plantarLinhaDeRetencaoDeOutroDono();

    // O client autenticado do Mateus, exatamente como o app faria.
    const { data, error } = await db
      .from("documento_retencao")
      .delete()
      .eq("id", alheia)
      .select("id");

    // Nem erro, nem linha: é o silêncio que a asserção do app transforma em
    // mensagem.
    expect(error, "a RLS filtra sem levantar erro").toBeNull();
    expect(data ?? []).toHaveLength(0);
    // E a linha alheia continua lá, intacta.
    expect(contarLinhasDeRetencaoDeOutroDono(alheia)).toBe(1);
  });

  test("a linha alheia também não é LIDA nem ALTERADA pelo dono errado", async ({
    db,
  }) => {
    const alheia = plantarLinhaDeRetencaoDeOutroDono();

    const lida = await db
      .from("documento_retencao")
      .select("id")
      .eq("id", alheia);
    expect(lida.data ?? []).toHaveLength(0);

    const alterada = await db
      .from("documento_retencao")
      .update({ quem_recolhe: "empresa" })
      .eq("id", alheia)
      .select("id");
    expect(alterada.data ?? []).toHaveLength(0);
    expect(contarLinhasDeRetencaoDeOutroDono(alheia)).toBe(1);
  });
});

// ══ 5 · O legado — gate `null` (critério 18) ═════════════════════════════

test("nota legada (gate null) pergunta ali mesmo, sem backfill", async ({
  page,
  db,
}) => {
  const id = await criarDocumento(db, {
    obra_id: OBRA_ID_SEED,
    favorecido_id: await emitente(db),
    tipo: "nf_servico",
    valor: 18000,
    numero: "0999",
    data_emissao: "2026-01-10",
    classificacao: "mao_obra",
    destinatario_cpf_ok: true,
    nota_traz_cno: true,
    cno_referenciado: "12.345.67890/26",
    // ⚠️ O estado legado: ninguém perguntou. `null` **não é "nenhuma"**.
    retencao_na_nota: null,
    status: "registrado",
  });

  await page.goto(`/documento/${id}`);
  const card = page.locator('[data-pendencia="retencao-nao-perguntada"]');
  await expect(card).toBeVisible();
  // Nada pré-marcado: não há valor antigo a exibir — a coluna booleana foi
  // dropada pela 0017, e inferir o gate seria o backfill que o critério 18
  // proíbe.
  for (const radio of await card.getByRole("radio").all()) {
    await expect(radio).not.toBeChecked();
  }
  await expect(page.getByRole("button", { name: "Confirmar" })).toBeDisabled();

  await escolher(page, "Esta nota destaca alguma retenção?", "Nenhuma");
  await page.getByRole("button", { name: "Confirmar" }).click();

  await expect(card).toHaveCount(0);
  expect((await documentos(db))[0].retencao_na_nota).toBe("nenhuma");
});
