import { OBRA_ID_SEED, USER_ID_SEED } from "./ambiente";
import {
  criarDocumento,
  criarFavorecido,
  documentos,
  subirParaOAcervo,
} from "./banco";
import { expect, test } from "./fixtures";
import {
  escolher,
  preencherDocumentoBasico,
  responderCnoDaNota,
} from "./formularios";

/**
 * **CONTAI-033 — a nota grava sem o arquivo, com três guardas.**
 *
 * Fonte normativa: `docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`,
 * ADENDO 1 §A.3 (as três guardas), §A.5 (a guarda de superfície, D47) e
 * §A.7.1-A.7.3 (os textos literais).
 *
 * Contra o Supabase LOCAL, como o resto da suíte: sessão de verdade, linhas de
 * verdade com RLS, arquivo de verdade no bucket. E as asserções olham o **estado
 * gravado**, não só a tela — é o estado gravado que vira declaração.
 */

/**
 * ⚠️ CNPJ **com dígito verificador válido**. O do mock (`14.221.900/0001-77`) é
 * ilustrativo e o formulário o RECUSA — `tipoPorDocumento` confere o DV, e é
 * essa recusa que o CONTAI-001 existe para fazer.
 */
const CNPJ_EMITENTE = "11.222.333/0001-81";
const CNPJ_EMITENTE_DIGITOS = "11222333000181";

/**
 * Um emitente NOVO por chamada. `favorecido_dono_documento_unico` (0003) é o
 * que garante "um CNPJ, um favorecido" — e o cenário de duas notas sem arquivo
 * é de dois emitentes, não de um cadastrado duas vezes.
 */
let proximoEmitente = 0;

function pdf(nome: string) {
  return {
    name: nome,
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4 ${nome}`),
  };
}

/** Um documento já gravado SEM arquivo — o estado que este ticket criou. */
async function notaSemArquivo(
  db: Parameters<typeof documentos>[0],
  over: { valor?: number; status?: "registrado" | "quarentena" } = {},
) {
  proximoEmitente += 1;
  const favorecidoId = await criarFavorecido(db, {
    tipo: "pj",
    nome: `Elétrica Nunes Serviços ${proximoEmitente}`,
    documento: `1122233300018${proximoEmitente}`,
  });
  const quarentena = over.status === "quarentena";
  return criarDocumento(db, {
    obra_id: OBRA_ID_SEED,
    favorecido_id: favorecidoId,
    tipo: "nf_servico",
    // ⚠️ O ponto inteiro do ticket: `arquivo_path` é nullable desde a 0014.
    arquivo_path: null,
    valor: over.valor ?? 4200,
    numero: "1042",
    data_emissao: "2026-03-20",
    classificacao: "mao_obra",
    destinatario_cpf_ok: !quarentena,
    retencao_11: true,
    status: quarentena ? "quarentena" : "registrado",
    motivo_quarentena: quarentena
      ? "Documento não está no CPF do dono da obra — não entra no custo de aquisição."
      : null,
  });
}

// ══ s1 · o formulário e o diálogo do §A.7.1 ══════════════════════════════

test.describe("salvar sem o arquivo (critérios 2 e 7)", () => {
  async function preencherSemArquivo(page: import("@playwright/test").Page) {
    await page.goto("/adicionar/documento");
    await expect(
      page.getByRole("heading", { name: "Registrar documento" }),
    ).toBeVisible();
    await preencherDocumentoBasico(page, {
      tipo: "NF serviço",
      emitente: "Elétrica Nunes Serviços",
      documento: CNPJ_EMITENTE,
      valor: "4.200,00",
      numero: "1042",
      dataEmissao: "2026-03-20",
      noCpf: "Sim",
      // ⚠️ SEM `arquivo` — é o caso que este ticket libera.
    });
    await escolher(page, "NF de serviço: tem retenção de 11%?", "Sim");
    // CONTAI-007: bloqueante em NF de serviço — a obra do seed tem CNO.
    await responderCnoDaNota(page, "É o CNO desta obra");
  }

  test("o diálogo aparece, e 'Salvar e cobrar a nota' grava com arquivo_path NULO", async ({
    page,
    db,
  }) => {
    await preencherSemArquivo(page);
    await page.getByRole("button", { name: "Salvar registro" }).click();

    // ⚠️ O texto é LITERAL do §A.7.1 — se alguém o reescrever, este teste cai.
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText("Salvar sem o arquivo da nota?");
    await expect(dialogo).toContainText(
      "servem para cobrar a nota do emitente enquanto você ainda tem parcela a liberar",
    );
    await expect(dialogo).toContainText("não sustenta custo nenhum");
    await expect(dialogo).toContainText("não abate a aferição do INSS desta obra");
    await expect(dialogo).toContainText("não da lembrança dela");

    // Nada foi salvo só por abrir o diálogo.
    expect(await documentos(db)).toHaveLength(0);

    await dialogo
      .getByRole("button", { name: "Salvar e cobrar a nota" })
      .click();

    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    // ⚠️ Achado no teste manual no browser (não no unitário nem no E2E
    // original do Gate 1): a confirmação sempre dizia "Arquivo guardado no
    // acervo", mesmo tendo acabado de gravar SEM arquivo — sucesso mentiroso,
    // mesma classe de defeito do critério 1. Trava a regressão.
    await expect(page.getByText(/o arquivo não foi anexado/)).toBeVisible();
    await expect(page.getByText(/Arquivo guardado no acervo/)).toHaveCount(0);

    const gravados = await documentos(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      obra_id: OBRA_ID_SEED,
      user_id: USER_ID_SEED,
      tipo: "nf_servico",
      valor: 4200,
      numero: "1042",
      destinatario_cpf_ok: true,
      retencao_11: true,
      // ⚠️ **NENHUM STATUS NOVO** (D52): nasce `registrado`, e "sem arquivo" é
      // a segunda dimensão — `arquivo_path IS NULL`.
      status: "registrado",
    });
    expect(gravados[0].arquivo_path).toBeNull();
  });

  test("'Anexar agora' fecha o diálogo, não grava, e não perde nada digitado", async ({
    page,
    db,
  }) => {
    await preencherSemArquivo(page);
    await page.getByRole("button", { name: "Salvar registro" }).click();

    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole("button", { name: "Anexar agora" }).click();
    await expect(dialogo).not.toBeVisible();

    // Decisão de design 1 do mock: o formulário nunca desmontou.
    await expect(page.getByLabel("Valor")).toHaveValue("4.200,00");
    await expect(page.getByLabel("Número da nota")).toHaveValue("1042");
    await expect(page.getByLabel("Emitente", { exact: true })).toHaveValue(
      "Elétrica Nunes Serviços",
    );
    expect(await documentos(db)).toHaveLength(0);
  });

  test("COM arquivo o comportamento é intocado: grava direto, sem diálogo", async ({
    page,
    db,
  }) => {
    await page.goto("/adicionar/documento");
    await preencherDocumentoBasico(page, {
      tipo: "NF material",
      emitente: "Casa do Construtor Ltda",
      documento: CNPJ_EMITENTE,
      valor: "1.500,00",
      numero: "7788",
      dataEmissao: "2026-04-02",
      noCpf: "Sim",
      arquivo: pdf("NF-com-arquivo.pdf"),
    });
    await page.getByRole("button", { name: "Salvar registro" }).click();

    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();
    expect(page.getByRole("dialog")).toHaveCount(0);
    // COM arquivo, a confirmação continua a de sempre.
    await expect(page.getByText(/Arquivo guardado no acervo/)).toBeVisible();

    const gravados = await documentos(db);
    expect(gravados[0].arquivo_path).toMatch(
      new RegExp(`^${USER_ID_SEED}/documento/`),
    );
  });
});

// ══ s2 · o detalhe, as duas linhas de guarda ═════════════════════════════

test.describe("detalhe da nota sem arquivo (critérios 5 e 8)", () => {
  test("chip, pendência literal, as DUAS linhas de guarda e o botão de anexar", async ({
    page,
    db,
  }) => {
    const id = await notaSemArquivo(db);
    await page.goto(`/documento/${id}`);

    const bloco = page.locator('[data-pendencia="documento-sem-arquivo"]');
    await expect(bloco).toBeVisible();
    await expect(bloco).toContainText("Nota sem arquivo");
    // §A.7.2, literal.
    await expect(bloco).toContainText(
      "Você registrou os dados da nota, mas o arquivo não está no acervo.",
    );
    await expect(bloco).toContainText(
      "não entra no custo comprovável e não abate a aferição do INSS",
    );
    await expect(bloco).toContainText(
      "nota que ficou só na conversa desaparece com a conversa",
    );
    // ⚠️ As duas linhas REVISADAS pelo `contador` em 2026-09-19: "Custo
    // confirmado" saiu porque colidia com `custoConfirmadoAnoCentavos`.
    await expect(bloco).toContainText("Sustenta custo de aquisição");
    await expect(bloco).toContainText("Abate no INSS");
    await expect(bloco).not.toContainText("Custo confirmado");

    await expect(
      bloco.getByRole("link", { name: "Anexar o arquivo agora" }),
    ).toBeVisible();

    // A lista de papéis não inventa um item que não abre nada.
    await expect(
      page.getByText("Esta nota foi registrada sem o arquivo"),
    ).toBeVisible();
  });

  test("⚠️ sem arquivo mas NÃO em quarentena: 'sem pagamento ligado' não mente dizendo quarentena", async ({
    page,
    db,
  }) => {
    // Achado no teste manual no browser: `ehDocumentoHabil` ganhou um terceiro
    // motivo de "não hábil" (sem arquivo), e o bloco de pagamentos só sabia
    // escolher entre boleto e quarentena — uma nota `registrado` sem arquivo
    // caía no `else` e mostrava "Esta nota está em quarentena", que é falso:
    // o destinatário está correto, só falta o papel.
    const id = await notaSemArquivo(db);
    await page.goto(`/documento/${id}`);

    await expect(page.getByText("Sem pagamento ligado")).toBeVisible();
    await expect(
      page.getByText("Esta nota está sem o arquivo no acervo."),
    ).toBeVisible();
    await expect(page.getByText(/está em quarentena/)).toHaveCount(0);
  });

  test("⚠️ quarentena SEM arquivo mostra as DUAS pendências, não uma no lugar da outra", async ({
    page,
    db,
  }) => {
    // Confirmação do `contador` em 2026-09-19: as guardas são ADITIVAS. Mostrar
    // só uma reabre o buraco D47 que a guarda existe para fechar.
    const id = await notaSemArquivo(db, { status: "quarentena" });
    await page.goto(`/documento/${id}`);

    await expect(page.getByRole("heading", { name: "Quarentena" })).toBeVisible();
    await expect(
      page.getByText("Este documento não está no seu CPF."),
    ).toBeVisible();
    await expect(
      page.locator('[data-pendencia="documento-sem-arquivo"]'),
    ).toBeVisible();
  });

  test("com arquivo, o bloco não existe", async ({ page, db }) => {
    const favorecidoId = await criarFavorecido(db, {
      tipo: "pj",
      nome: "Elétrica Nunes Serviços",
      documento: CNPJ_EMITENTE_DIGITOS,
    });
    const id = await criarDocumento(db, {
      favorecido_id: favorecidoId,
      tipo: "nf_material",
      valor: 1500,
      numero: "7788",
      data_emissao: "2026-04-02",
      classificacao: "material",
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    await page.goto(`/documento/${id}`);
    await expect(page.getByRole("heading", { name: "NF de material" })).toBeVisible();
    await expect(
      page.locator('[data-pendencia="documento-sem-arquivo"]'),
    ).toHaveCount(0);
  });
});

// ══ s3 · anexar depois, com a repergunta em branco ═══════════════════════

test.describe("anexar o arquivo depois (critérios 6, 9 e 12)", () => {
  test("escolher o arquivo revela as duas perguntas EM BRANCO, e confirmar grava", async ({
    page,
    db,
  }) => {
    const id = await notaSemArquivo(db);
    await page.goto(`/documento/${id}/anexar`);
    await expect(
      page.getByRole("heading", { name: "Anexar o arquivo" }),
    ).toBeVisible();

    // Antes do arquivo não há pergunta nenhuma: a repergunta existe porque
    // AGORA há papel para conferir (§A.7.3).
    await expect(
      page.getByRole("group", { name: "A nota está no seu CPF?" }),
    ).toHaveCount(0);
    const botao = page.getByRole("button", {
      name: "Escolha o arquivo para continuar",
    });
    await expect(botao).toBeDisabled();

    await page
      .getByLabel("Arquivo da nota")
      .setInputFiles(pdf("NF-1042-que-chegou.pdf"));

    // §A.7.3, literal.
    await expect(
      page.getByText("Agora com a nota na mão, confirme o que está impresso nela."),
    ).toBeVisible();
    await expect(
      page.getByText("é o papel que a fiscalização lê, não o app"),
    ).toBeVisible();

    // ⚠️ **NADA PRÉ-MARCADO**, mesmo com `destinatario_cpf_ok` e `retencao_11`
    // já gravados como `true` no banco (o fixture os grava). É a Guarda 3 e o
    // critério 12: nunca herdar a resposta anterior.
    const gravadoAntes = (await documentos(db))[0];
    expect(gravadoAntes.destinatario_cpf_ok).toBe(true);
    expect(gravadoAntes.retencao_11).toBe(true);
    for (const radio of await page.getByRole("radio").all()) {
      await expect(radio).not.toBeChecked();
    }

    // O botão só libera com as DUAS respondidas.
    await expect(
      page.getByRole("button", { name: "Responda as perguntas para confirmar" }),
    ).toBeDisabled();
    await escolher(page, "A nota está no seu CPF?", "Sim");
    await expect(
      page.getByRole("button", { name: "Responda as perguntas para confirmar" }),
    ).toBeDisabled();
    await escolher(page, "NF de serviço: tem retenção de 11%?", "Não sei");

    await page
      .getByRole("button", { name: "Confirmar o arquivo e as respostas" })
      .click();

    // Volta para o detalhe, e a pendência sumiu.
    await expect(page).toHaveURL(new RegExp(`/documento/${id}$`));
    await expect(
      page.locator('[data-pendencia="documento-sem-arquivo"]'),
    ).toHaveCount(0);

    const gravados = await documentos(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0].arquivo_path).toMatch(
      new RegExp(`^${USER_ID_SEED}/documento/`),
    );
    // "não sei" NÃO vira "não": vai como desconhecido. E a resposta antiga
    // (`true`) foi SUBSTITUÍDA pela de agora, com o papel à vista.
    expect(gravados[0].retencao_11).toBeNull();
    expect(gravados[0].destinatario_cpf_ok).toBe(true);
    expect(gravados[0].status).toBe("registrado");
  });

  test("respondendo 'Não' no CPF, o ato atômico leva a nota para quarentena", async ({
    page,
    db,
  }) => {
    // A RPC recomputa `status` e `motivo_quarentena` no MESMO ato do path —
    // não existe o intermediário "tem arquivo, status velho".
    const id = await notaSemArquivo(db);
    await page.goto(`/documento/${id}/anexar`);
    await page.getByLabel("Arquivo da nota").setInputFiles(pdf("NF-de-outro.pdf"));
    await escolher(page, "A nota está no seu CPF?", "Não");
    await escolher(page, "NF de serviço: tem retenção de 11%?", "Sim");
    /**
     * ⚠️ A re-pergunta do CONTAI-033 (Guarda 3) continua sendo **CPF e
     * retenção, e só** — o CONTAI-007 **não** a estendeu ao CNO. A resposta do
     * CNO já foi dada no registro (o formulário a exige mesmo sem arquivo), e
     * acrescentá-la aqui mudaria a assinatura da RPC `anexar_arquivo_documento`
     * da migration 0014, que é escopo e parecer de outro ticket.
     */
    await expect(
      page.getByText("Qual CNO está impresso nesta nota?"),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Confirmar o arquivo e as respostas" })
      .click();

    await expect(page.getByRole("heading", { name: "Quarentena" })).toBeVisible();
    const gravados = await documentos(db);
    expect(gravados[0]).toMatchObject({
      destinatario_cpf_ok: false,
      status: "quarentena",
      retencao_11: true,
    });
    expect(gravados[0].arquivo_path).not.toBeNull();
    expect(gravados[0].motivo_quarentena).toBeTruthy();
  });

  test("chegada direta num documento que JÁ tem arquivo não oferece formulário", async ({
    page,
    db,
  }) => {
    const favorecidoId = await criarFavorecido(db, {
      tipo: "pj",
      nome: "Elétrica Nunes Serviços",
      documento: CNPJ_EMITENTE_DIGITOS,
    });
    const id = await criarDocumento(db, {
      favorecido_id: favorecidoId,
      tipo: "nf_material",
      valor: 1500,
      numero: "7788",
      data_emissao: "2026-04-02",
      classificacao: "material",
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    await page.goto(`/documento/${id}/anexar`);
    await expect(
      page.getByText("Este documento já tem arquivo."),
    ).toBeVisible();
    await expect(page.getByLabel("Arquivo da nota")).toHaveCount(0);
  });
});

// ══ Guarda 3 no banco · transição ÚNICA ══════════════════════════════════

test.describe("⚠️ o flip barato é impossível (critério 10)", () => {
  test("a RPC recusa a SEGUNDA chamada no mesmo documento", async ({ db }) => {
    const id = await notaSemArquivo(db);
    const primeiro = await subirParaOAcervo(db, "documento", "nf.txt", "nf");
    const segundo = await subirParaOAcervo(db, "documento", "outra.txt", "outra");

    const ok = await db.rpc("anexar_arquivo_documento", {
      p_documento_id: id,
      p_arquivo_path: primeiro,
      p_nota_no_cpf: true,
      p_retencao_11: true,
    });
    expect(ok.error, "o primeiro anexo tinha de passar").toBeNull();

    // A função aceita SÓ `arquivo_path is null` — a segunda não encontra a linha.
    const recusado = await db.rpc("anexar_arquivo_documento", {
      p_documento_id: id,
      p_arquivo_path: segundo,
      p_nota_no_cpf: false,
      p_retencao_11: false,
    });
    expect(recusado.error, "a segunda chamada tinha de falhar").not.toBeNull();

    const gravados = await documentos(db);
    expect(gravados[0].arquivo_path).toBe(primeiro);
    // E nada da segunda tentativa vazou: os checks são do primeiro ato.
    expect(gravados[0].destinatario_cpf_ok).toBe(true);
    expect(gravados[0].status).toBe("registrado");
  });

  test("o trigger barra a reescrita direta de `arquivo_path` pela tabela", async ({
    db,
  }) => {
    // A doutrina da 0009 preservada: `arquivo_path` é NÃO CORRIGÍVEL —
    // anexa-se adicional. A nulidade abriu UMA transição, não a reescrita.
    const id = await notaSemArquivo(db);
    const primeiro = await subirParaOAcervo(db, "documento", "nf.txt", "nf");
    const ok = await db.rpc("anexar_arquivo_documento", {
      p_documento_id: id,
      p_arquivo_path: primeiro,
      p_nota_no_cpf: true,
      p_retencao_11: true,
    });
    expect(ok.error).toBeNull();

    const reescrita = await db
      .from("documento")
      .update({ arquivo_path: `${USER_ID_SEED}/documento/inventado.pdf` })
      .eq("id", id);
    expect(reescrita.error, "reescrever o papel original tinha de falhar").not.toBeNull();

    expect((await documentos(db))[0].arquivo_path).toBe(primeiro);
  });

  test("o trigger NÃO estorva os outros UPDATEs do documento", async ({ db }) => {
    // Fixture negativa: um trigger `before update` mal escrito derrubaria a
    // correção de classificação, que é `UPDATE` na mesma tabela.
    const id = await notaSemArquivo(db);
    const semTocar = await db
      .from("documento")
      .update({ classificacao: "material" })
      .eq("id", id);
    expect(semTocar.error).toBeNull();
    expect((await documentos(db))[0].classificacao).toBe("material");
  });
});

// ══ s4 · a superfície agregada na home (critério 11) ═════════════════════

test.describe("card agregado na home (critério 11, D47)", () => {
  test("um documento: valor, contagem e CTA apontando para ELE", async ({
    page,
    db,
  }) => {
    const id = await notaSemArquivo(db, { valor: 4200 });
    await page.goto("/");

    const card = page.locator('[data-pendencia="documentos-sem-arquivo"]');
    await expect(card).toBeVisible();
    await expect(card).toContainText("Nota sem arquivo");
    await expect(card).toContainText("R$ 4.200,00");
    await expect(card).toContainText("1 documento");
    // A linha do veto (mock s4) — é ela que transforma o card em cobrança.
    await expect(card).toContainText("nenhuma saída anual é gerada");
    await expect(card.getByRole("link", { name: "Ver o documento" })).toHaveAttribute(
      "href",
      `/documento/${id}`,
    );
  });

  test("dois ou mais: soma tudo e NÃO tem CTA (decisão do `po`)", async ({
    page,
    db,
  }) => {
    await notaSemArquivo(db, { valor: 4200 });
    await notaSemArquivo(db, { valor: 2650 });
    await page.goto("/");

    const card = page.locator('[data-pendencia="documentos-sem-arquivo"]');
    await expect(card).toContainText("2 documentos");
    await expect(card).toContainText("R$ 6.850,00");
    // Não existe lista de documentos no app; o card fica informativo.
    await expect(card.getByRole("link")).toHaveCount(0);
  });

  test("sem nenhum, o card não existe", async ({ page, db }) => {
    const favorecidoId = await criarFavorecido(db, {
      tipo: "pj",
      nome: "Elétrica Nunes Serviços",
      documento: CNPJ_EMITENTE_DIGITOS,
    });
    await criarDocumento(db, {
      favorecido_id: favorecidoId,
      tipo: "nf_material",
      valor: 1500,
      numero: "7788",
      data_emissao: "2026-04-02",
      classificacao: "material",
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    await page.goto("/");
    await expect(
      page.locator('[data-pendencia="documentos-sem-arquivo"]'),
    ).toHaveCount(0);
  });
});

// ══ O veto da saída anual (critério 11, segunda metade) ══════════════════

test.describe("a discriminação não sai com nota sem arquivo", () => {
  test("banner de veto próprio, com a lista do que falta anexar", async ({
    page,
    db,
  }) => {
    const id = await notaSemArquivo(db, { valor: 4200 });
    await page.goto(`/obras/${OBRA_ID_SEED}/discriminacao/2026`);

    await expect(page.locator('[data-veto="sem-arquivo"]')).toBeVisible();
    await expect(page.getByText("sem arquivo no acervo")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Abrir a nota" }),
    ).toHaveAttribute("href", `/documento/${id}`);
    // E o texto de declaração NÃO foi gerado.
    await expect(page.locator('[data-bloco="copiavel"]')).toHaveCount(0);
  });
});
