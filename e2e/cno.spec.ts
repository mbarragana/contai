import type { Page } from "@playwright/test";

import { paraDocumento, paraObra } from "../lib/dados/comum";
import { posicaoDeAfericao } from "../lib/fiscal/afericao";
import {
  desembolsosCarregados,
  documentosCarregados,
  podeGerarRelatorioAnual,
  type LiberadoAfericaoInss,
} from "../lib/fiscal/compromisso";
import type { DocumentoRow, ObraRow } from "../lib/types";
import { OBRA_ID_SEED, OBRA_SEED, USER_ID_SEED } from "./ambiente";
import {
  arquivosNoAcervo,
  criarDocumento,
  criarFavorecido,
  criarObra,
  documentos,
  obras,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";
import {
  escolher,
  preencherDocumentoBasico,
  responderCnoDaNota,
} from "./formularios";

/**
 * CONTAI-007 contra o Postgres LOCAL — o CNO impresso na NF de serviço.
 *
 * ⚠️ **O que se prova aqui é o ESTADO GRAVADO, não a tela** (critério 6, e ele
 * é explícito nisso). Uma tela que mostra o bloqueio e um `insert` que acontece
 * mesmo assim é o pior desfecho possível: a nota entra, ninguém percebe, e o
 * erro só aparece na aferição — quando não há mais conserto.
 *
 * Nada é stubado: RLS de verdade, bucket `acervo` de verdade.
 */

const CNPJ_AJE = "11.222.333/0001-81";
const CNPJ_AJE_DIGITOS = "11222333000181";
const CNO_DA_OUTRA_OBRA = "98.765.43210/26";

function pdf(nome: string) {
  return {
    name: nome,
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4 ${nome}`),
  };
}

/**
 * ⚠️ Esperar o formulário APARECER antes de preencher, e não só navegar: o
 * primeiro teste da suíte paga a compilação da rota pelo `next dev`, e um
 * `setInputFiles` disparado antes disso estoura os 30 s com a cara de bug do
 * produto. Foi exatamente o que aconteceu na primeira rodada deste spec.
 */
async function irParaFormulario(page: Page) {
  await page.goto("/adicionar/documento");
  await expect(
    page.getByRole("heading", { name: "Registrar documento" }),
  ).toBeVisible();
}

async function aje(db: Db) {
  return criarFavorecido(db, {
    nome: "AJE Construções",
    documento: CNPJ_AJE_DIGITOS,
    tipo: "pj",
  });
}

// ── Ponte do estado GRAVADO para a regra pura (critério 7c) ──────────────
//
// ⚠️ O critério 7(c) exige afirmar que a nota movida continua fora da base de
// aferição das DUAS obras. Isso não se lê na tela — a US-004 ainda não existe —
// então o teste alimenta a MESMA função pura que a tela vai alimentar
// (`posicaoDeAfericao`) com as linhas que acabaram de ser gravadas no Postgres,
// traduzidas pelos MESMOS mappers do app (`lib/dados/comum.ts`). Nada é
// reimplementado aqui: uma tradução paralela provaria a suposição do teste, que
// é o que a regra dura de E2E do projeto proíbe.

async function obraPorId(db: Db, id: string): Promise<ObraRow> {
  const lista = await obras(db);
  const achada = lista.find((o) => o.id === id);
  if (!achada) throw new Error(`obra ${id} não encontrada no banco`);
  return achada;
}

/**
 * A linha do banco no formato do domínio. `favorecido` não importa aqui, e as
 * linhas de retenção também não: o CONTAI-038 é explícito em que a aferição
 * **não lê nenhuma delas** (critério 13) — passar `[]` aqui é afirmar isso.
 */
function paraDocumentoDoTeste(row: DocumentoRow) {
  return paraDocumento({ ...row, favorecido: null, documento_retencao: [] });
}

/** A marca só sai da PORTA — nem o E2E a forja. */
function liberadoParaAfericao(): LiberadoAfericaoInss {
  const r = podeGerarRelatorioAnual(
    [],
    "2026-08-24",
    2026,
    desembolsosCarregados([]),
    documentosCarregados([]),
  );
  if (!r.ok) throw new Error("a porta vetou — cenário errado no teste");
  return r.afericaoInss;
}

// ══ Critérios 1, 2, 3 e 6 — a captura e o bloqueio ═══════════════════════

test.describe("o CNO impresso na nota (critérios 1, 2, 3 e 6)", () => {
  test("(critério 1) sem responder o CNO, a NF de serviço não salva", async ({
    page,
    db,
  }) => {
    await irParaFormulario(page);
    await preencherDocumentoBasico(page, {
      tipo: "NF serviço",
      emitente: "AJE Construções",
      documento: CNPJ_AJE,
      valor: "18.000,00",
      numero: "1042",
      dataEmissao: "2026-03-20",
      arquivo: pdf("NF-1042.pdf"),
      noCpf: "Sim",
    });
    await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");

    // Nada nasce marcado: a pergunta está aberta.
    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(
      page.getByText("Responda qual CNO está impresso nesta nota."),
    ).toBeVisible();
    expect(await documentos(db)).toHaveLength(0);
  });

  test("(critério 1) a pergunta NÃO existe em NF de material nem em boleto", async ({
    page,
  }) => {
    const pergunta = page.getByText("Qual CNO está impresso nesta nota?");
    await irParaFormulario(page);

    await escolher(page, "Tipo", "NF material");
    await expect(pergunta).toHaveCount(0);
    await escolher(page, "Tipo", "Boleto");
    await expect(pergunta).toHaveCount(0);
    await escolher(page, "Tipo", "NF serviço");
    await expect(pergunta).toBeVisible();
  });

  test("⚠️ (critério 6) CNO de OUTRA obra não gera linha nem objeto no acervo", async ({
    page,
    db,
  }) => {
    // Existe uma segunda obra, com CNO próprio — é o cenário real do dano.
    await criarObra(db, {
      nome: "Terreno Vista Mar",
      cno: CNO_DA_OUTRA_OBRA,
      cno_registrado_em: "2026-03-20",
    });

    /**
     * ⚠️ Fotografia do acervo ANTES, e não `toEqual([])`: o bucket `acervo` é
     * **append-only e NÃO é limpo entre testes** (a migration 0002 não tem
     * policy de delete; quem zera é o `db reset` do `globalSetup`). Um
     * `toEqual([])` passa quando este spec roda sozinho e quebra na suíte
     * inteira, com os objetos dos testes anteriores — foi exatamente o que
     * aconteceu na primeira rodada deste teste.
     */
    const acervoAntes = await arquivosNoAcervo(db, "documento");

    await irParaFormulario(page);
    await preencherDocumentoBasico(page, {
      tipo: "NF serviço",
      emitente: "AJE Construções",
      documento: CNPJ_AJE,
      valor: "18.000,00",
      numero: "1042",
      dataEmissao: "2026-03-20",
      // ⚠️ O arquivo É escolhido: é justamente isto que o critério 6 manda
      // provar — nem o objeto no bucket pode aparecer. O upload só acontece
      // depois da validação, e a validação barra antes.
      arquivo: pdf("NF-da-outra-obra.pdf"),
      noCpf: "Sim",
    });
    await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");
    await responderCnoDaNota(page, "É o CNO de outra obra");

    // Tela de BLOQUEIO, com a consequência do critério 2 — não é aviso.
    await expect(
      page.getByRole("heading", { name: "CNO impresso é de outra obra" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Esta nota não abate a aferição desta obra. Sem a aferição fechada não " +
          "há regularização, e sem regularização a construção não é averbada " +
          "na matrícula.",
      ),
    ).toBeVisible();
    // Não há "Salvar registro" nesta tela: o registro não vai acontecer.
    await expect(
      page.getByRole("button", { name: "Salvar registro" }),
    ).toHaveCount(0);

    // ⚠️ O ESTADO GRAVADO: nenhuma linha, nenhum objeto NOVO.
    expect(await documentos(db)).toHaveLength(0);
    const acervoDepois = await arquivosNoAcervo(db, "documento");
    expect(acervoDepois).toEqual(acervoAntes);
    expect(acervoDepois.some((n) => n.includes("NF-da-outra-obra"))).toBe(false);
  });

  test("(pre-mortem 2) o bloqueio oferece 'registrar na outra obra', e a resposta do CNO zera", async ({
    page,
    db,
  }) => {
    // Recusar sem saída, com a nota na mão, empurra o registro para a obra
    // errada — que é o dano que o ticket existe para evitar.
    await criarObra(db, {
      nome: "Terreno Vista Mar",
      cno: CNO_DA_OUTRA_OBRA,
      cno_registrado_em: "2026-03-20",
    });

    await irParaFormulario(page);
    await preencherDocumentoBasico(page, {
      tipo: "NF serviço",
      emitente: "AJE Construções",
      documento: CNPJ_AJE,
      valor: "18.000,00",
      numero: "1042",
      dataEmissao: "2026-03-20",
      arquivo: pdf("NF-1042.pdf"),
      noCpf: "Sim",
    });
    await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");
    await responderCnoDaNota(page, "É o CNO de outra obra");

    await page.getByRole("button", { name: "Registrar na outra obra" }).click();
    await page.getByRole("button", { name: /Terreno Vista Mar/ }).click();

    // ⚠️ A pergunta volta ABERTA: as três respostas são relativas à obra da
    // tela, e mantê-la marcada gravaria o CNO da obra nova como se fosse o do
    // papel — a afirmação com o significado trocado por baixo.
    await expect(page.getByText("Registrando em")).toBeVisible();
    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(
      page.getByText("Responda qual CNO está impresso nesta nota."),
    ).toBeVisible();

    // Agora sim: na obra do CNO impresso, a resposta é "desta obra".
    await responderCnoDaNota(page, "É o CNO desta obra");
    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    const gravados = await documentos(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      tipo: "nf_servico",
      nota_traz_cno: true,
      cno_referenciado: CNO_DA_OUTRA_OBRA,
    });
    // E foi para a obra certa — a do CNO que está no papel.
    expect(gravados[0].obra_id).not.toBe(OBRA_ID_SEED);
  });

  test("(critérios 3 e 4) 'a nota não traz CNO' SALVA, com pendência e ação", async ({
    page,
    db,
  }) => {
    await irParaFormulario(page);
    await preencherDocumentoBasico(page, {
      tipo: "NF serviço",
      emitente: "AJE Construções",
      documento: CNPJ_AJE,
      valor: "22.500,00",
      numero: "1078",
      dataEmissao: "2026-04-18",
      arquivo: pdf("NF-1078.pdf"),
      noCpf: "Sim",
    });
    await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");
    await responderCnoDaNota(page, "A nota não traz CNO");

    // A consequência é dita ANTES de salvar, e é a mesma do bloqueio.
    await expect(
      page.getByText(/Esta nota não abate a aferição desta obra/).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();
    // Critério 3: a pendência aparece no ato, não só numa lista adiante.
    await expect(page.getByText("A nota não traz CNO").first()).toBeVisible();
    await expect(
      page.getByText(/pedir nota com o CNO ao prestador/),
    ).toBeVisible();

    // ⚠️ ESTADO GRAVADO: `false`, nunca `null`. `null` é "não foi perguntado",
    // e colapsar os dois é o branco silencioso que o critério 3 proíbe.
    const gravados = await documentos(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      tipo: "nf_servico",
      nota_traz_cno: false,
      cno_referenciado: null,
      // A nota continua sendo documentação hábil para o custo de aquisição.
      status: "registrado",
    });

    // Critério 4: junto das demais pendências, na fila de /pendencias
    // (a home virou dashboard no CONTAI-040; a lista inteira mora lá).
    await page.goto("/pendencias");
    await expect(page.getByText("NF de serviço sem CNO impresso")).toBeVisible();
    await expect(
      page.getByText(/pedir nota com o CNO ao prestador/),
    ).toBeVisible();
  });

  test("(critério 1) 'é o CNO desta obra' grava o NÚMERO impresso", async ({
    page,
    db,
  }) => {
    await irParaFormulario(page);
    await preencherDocumentoBasico(page, {
      tipo: "NF serviço",
      emitente: "AJE Construções",
      documento: CNPJ_AJE,
      valor: "18.000,00",
      numero: "1042",
      dataEmissao: "2026-03-20",
      arquivo: pdf("NF-1042.pdf"),
      noCpf: "Sim",
    });
    await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");
    await responderCnoDaNota(page, "É o CNO desta obra");
    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    const gravados = await documentos(db);
    expect(gravados[0]).toMatchObject({
      nota_traz_cno: true,
      // O número, e não um "sim": é ele que faz a divergência aparecer se o
      // cadastro da obra mudar depois. O papel não muda com o cadastro.
      cno_referenciado: OBRA_SEED.cno,
    });

    // E aparece no detalhe do documento — dado que entra e não se confere é
    // dado que não entrou.
    await page.goto(`/documento/${gravados[0].id}`);
    await expect(page.getByText(OBRA_SEED.cno)).toBeVisible();
  });
});

// ══ Critério 7 — a correção de obra ACONTECE, com aviso permanente ══════

test.describe("⚠️ critério 7 · o CNO avisa, e nunca barra a correção de obra", () => {
  /**
   * **ESTE É O TESTE DO CRITÉRIO 7(c)**, e ele já esteve INVERTIDO: afirmava
   * que o `obra_id` não mudava, carimbando de verde um bloqueio fiscalmente
   * errado. Corrigido em 2026-09-20 pelo parecer
   * `docs/pareceres/2026-09-20-cno-nao-bloqueia-correcao-de-obra.md`.
   *
   * O que ele tranca agora, nas palavras do critério: **falha se a correção
   * voltar a recusar por divergência de CNO**, e afirma as DUAS coisas —
   * o `obra_id` muda, e a nota continua fora da base de aferição **das duas
   * obras**. A segunda metade é o que prova que permitir o move não custou
   * aferição nenhuma: quem protege a base é `posicaoDeAfericao`, pelo CNO
   * impresso, não pelo `obra_id`.
   */
  test("CNO divergente MUDA de obra — e segue fora da base das duas obras", async ({
    page,
    db,
  }) => {
    const outra = await criarObra(db, {
      nome: "Terreno Vista Mar",
      cno: CNO_DA_OUTRA_OBRA,
      cno_registrado_em: "2026-03-20",
    });
    const favorecido = await aje(db);
    const documentoId = await criarDocumento(db, {
      tipo: "nf_servico",
      valor: 18000,
      classificacao: "mao_obra",
      destinatario_cpf_ok: true,
      retencao_na_nota: "destacada",
      status: "registrado",
      favorecido_id: favorecido,
      numero: "1042",
      data_emissao: "2026-03-20",
      // ⚠️ O CNO impresso não é o de NENHUMA das duas obras: nem o do seed
      // (onde ela está arquivada) nem o do destino. É o caso mais duro — a
      // nota que não abate lugar nenhum, e que mesmo assim pode e deve ser
      // arquivada no imóvel que de fato recebeu o gasto.
      cno_referenciado: "11.111.11111/26",
      nota_traz_cno: true,
    });

    await page.goto(`/documento/${documentoId}/obra`);
    await page.getByRole("button", { name: /Terreno Vista Mar/ }).click();

    // AVISO, não bloqueio — e com as duas metades do texto do parecer.
    const aviso = page.getByRole("main").getByRole("status");
    await expect(aviso).toContainText(
      "não abate a aferição de nenhuma das duas obras",
    );
    await expect(aviso).toContainText(
      "o custo de aquisição segue registrado normalmente",
    );
    // ⚠️ O rótulo do botão desabilitado NÃO existe mais em lugar nenhum.
    await expect(
      page.getByText("A revalidação do CNO barrou esta correção"),
    ).toHaveCount(0);

    const botao = page.getByRole("button", {
      name: "Mover o registro para a obra escolhida",
    });
    await expect(botao).toBeEnabled();
    await botao.click();
    await expect(
      page.getByRole("heading", { name: "Obra corrigida ✓" }),
    ).toBeVisible();

    // ⚠️ PRIMEIRA AFIRMAÇÃO: o `obra_id` MUDOU.
    const gravados = await documentos(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0].obra_id).toBe(outra);
    expect(gravados[0].obra_id).not.toBe(OBRA_ID_SEED);

    // ⚠️ SEGUNDA AFIRMAÇÃO: a nota continua FORA da base das DUAS obras, e é
    // isto que prova que a permissão não custou aferição. Afirmado sobre o
    // estado gravado, pela mesma função pura que a tela da US-004 vai usar —
    // não pela UI.
    const posicao = posicaoDeAfericao(liberadoParaAfericao(), [
      {
        obra: paraObra(await obraPorId(db, OBRA_ID_SEED)),
        documentos: gravados
          .filter((d) => d.obra_id === OBRA_ID_SEED)
          .map(paraDocumentoDoTeste),
      },
      {
        obra: paraObra(await obraPorId(db, outra)),
        documentos: gravados
          .filter((d) => d.obra_id === outra)
          .map(paraDocumentoDoTeste),
      },
    ]);
    // Nenhuma base existe: a nota não abate nem na origem nem no destino.
    expect(posicao.porCno).toEqual([]);
    expect(posicao.foraDaBase).toHaveLength(1);
    expect(posicao.foraDaBase[0]).toMatchObject({
      documentoId,
      obraId: outra,
      motivo: "cno_divergente",
    });
  });

  test("CNO que BATE com a obra de destino passa, e o `obra_id` muda", async ({
    page,
    db,
  }) => {
    // O outro lado da mesma moeda: a revalidação não pode virar uma recusa
    // geral de mover — isso travaria a correção de obra, que é a dor D9.
    const outra = await criarObra(db, {
      nome: "Terreno Vista Mar",
      cno: CNO_DA_OUTRA_OBRA,
      cno_registrado_em: "2026-03-20",
    });
    const favorecido = await aje(db);
    const documentoId = await criarDocumento(db, {
      tipo: "nf_servico",
      valor: 18000,
      classificacao: "mao_obra",
      destinatario_cpf_ok: true,
      retencao_na_nota: "destacada",
      status: "registrado",
      favorecido_id: favorecido,
      numero: "1042",
      data_emissao: "2026-03-20",
      // Nota arquivada na obra errada: o CNO impresso é o da OUTRA.
      cno_referenciado: CNO_DA_OUTRA_OBRA,
      nota_traz_cno: true,
    });

    await page.goto(`/documento/${documentoId}/obra`);
    await page.getByRole("button", { name: /Terreno Vista Mar/ }).click();
    await page
      .getByRole("button", { name: "Mover o registro para a obra escolhida" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Obra corrigida ✓" }),
    ).toBeVisible();

    const gravados = await documentos(db);
    expect(gravados[0].obra_id).toBe(outra);
  });

  test("CNO nunca capturado: AVISA e permite — barrar por desconhecimento seria beco sem saída", async ({
    page,
    db,
  }) => {
    const outra = await criarObra(db, {
      nome: "Terreno Vista Mar",
      cno: CNO_DA_OUTRA_OBRA,
      cno_registrado_em: "2026-03-20",
    });
    const favorecido = await aje(db);
    const documentoId = await criarDocumento(db, {
      tipo: "nf_servico",
      valor: 18000,
      classificacao: "mao_obra",
      destinatario_cpf_ok: true,
      retencao_na_nota: "destacada",
      status: "registrado",
      favorecido_id: favorecido,
      numero: "1042",
      data_emissao: "2026-03-20",
      // Registro anterior ao CONTAI-007: ninguém perguntou.
      cno_referenciado: null,
      nota_traz_cno: null,
    });

    await page.goto(`/documento/${documentoId}/obra`);
    await page.getByRole("button", { name: /Terreno Vista Mar/ }).click();
    await expect(page.getByRole("status")).toContainText("ainda não foi capturado");
    await page
      .getByRole("button", { name: "Mover o registro para a obra escolhida" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Obra corrigida ✓" }),
    ).toBeVisible();

    expect((await documentos(db))[0].obra_id).toBe(outra);
  });
});

// ══ Critério 8 — a lista de cobrança (tela 14 do mock do CONTAI-003) ═════

test.describe("critério 8 · notas emitidas na janela sem CNO", () => {
  test("lista número, data, prestador e valor — e só o que caiu na janela", async ({
    page,
    db,
  }) => {
    // Obra do seed: início 2025-11-04, CNO registrado em 2025-11-20.
    const favorecido = await aje(db);
    const base = {
      tipo: "nf_servico" as const,
      classificacao: "mao_obra" as const,
      destinatario_cpf_ok: true,
      retencao_na_nota: "destacada" as const,
      status: "registrado" as const,
      favorecido_id: favorecido,
    };
    await criarDocumento(db, {
      ...base,
      valor: 18000,
      numero: "1042",
      data_emissao: "2025-11-10",
    });
    await criarDocumento(db, {
      ...base,
      valor: 22500,
      numero: "1078",
      // Fora da janela: o CNO já existia quando esta saiu.
      data_emissao: "2025-12-05",
    });
    await criarDocumento(db, {
      ...base,
      tipo: "nf_material",
      classificacao: "material",
      valor: 4850,
      numero: "0089",
      // Dentro da janela, mas material não entra em EFD-Reinf.
      data_emissao: "2025-11-10",
    });

    await page.goto(`/obras/${OBRA_ID_SEED}/notas-sem-cno`);
    await expect(page.getByRole("heading", { name: "Notas sem CNO" })).toBeVisible();
    await expect(
      page.getByText(/Peça retificação da EFD-Reinf de cada uma/),
    ).toBeVisible();

    await expect(page.getByText("NF 1042 · 10/11/2025")).toBeVisible();
    await expect(page.getByText("R$ 18.000,00")).toBeVisible();
    await expect(page.getByText("AJE Construções").first()).toBeVisible();
    // A de dezembro e a de material ficam de fora.
    await expect(page.getByText("NF 1078")).toHaveCount(0);
    await expect(page.getByText("NF 0089")).toHaveCount(0);
  });

  test("estado VAZIO é resultado, não falha", async ({ page }) => {
    await page.goto(`/obras/${OBRA_ID_SEED}/notas-sem-cno`);
    await expect(page.getByText("Nenhuma nota a cobrar")).toBeVisible();
  });

  test("obra SEM CNO: a janela segue aberta, e o link sai do formulário", async ({
    page,
    db,
  }) => {
    const semCno = await criarObra(db, {
      nome: "Casa do Morro",
      data_inicio_obra: "2026-03-15",
    });
    const favorecido = await aje(db);
    await criarDocumento(db, {
      obra_id: semCno,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      destinatario_cpf_ok: true,
      retencao_na_nota: "destacada",
      status: "registrado",
      favorecido_id: favorecido,
      valor: 25000,
      numero: "1190",
      data_emissao: "2026-06-17",
      nota_traz_cno: false,
    });

    await page.goto(`/obras/${semCno}/notas-sem-cno`);
    await expect(page.getByText("NF 1190 · 17/06/2026")).toBeVisible();
    await expect(
      page.getByText(/ela continua aberta, porque esta obra ainda não tem CNO/),
    ).toBeVisible();

    // O LINK DE ENTRADA — tela 13 do mock do CONTAI-003. É de lá que a lista
    // é alcançada no uso real: a tela que o Mateus vê a cada nota de serviço
    // registrada em obra sem CNO.
    await irParaFormulario(page);
    await page.getByRole("button", { name: "Trocar obra" }).click();
    await page.getByRole("button", { name: /Casa do Morro/ }).click();
    await escolher(page, "Tipo", "NF serviço");
    await page
      .getByRole("link", { name: "Ver as notas desta obra emitidas sem CNO" })
      .click();
    await expect(page.getByRole("heading", { name: "Notas sem CNO" })).toBeVisible();
    await expect(page.getByText("NF 1190 · 17/06/2026")).toBeVisible();
  });
});

// ══ Critério 9 — a alavanca no pagamento a PJ em obra sem CNO ════════════

test.describe("critério 9 · a frase da alavanca ao pagar PJ em obra sem CNO", () => {
  const ALAVANCA = /exija da empreiteira/;

  test("aparece para PJ em obra sem CNO — e NÃO bloqueia nem pede confirmação", async ({
    page,
    db,
  }) => {
    const semCno = await criarObra(db, {
      nome: "Casa do Morro",
      data_inicio_obra: "2026-03-15",
    });
    await page.goto(`/adicionar/pagamento?obra=${semCno}`);
    // A obra desta tela é a preferida do aparelho; troca-se por aqui.
    await page.getByRole("button", { name: "Trocar obra" }).click();
    await page.getByRole("button", { name: /Casa do Morro/ }).click();

    await page.getByLabel("Favorecido", { exact: true }).fill("AJE Construções");
    await page.getByLabel("CNPJ / CPF do favorecido").fill(CNPJ_AJE);
    await expect(page.getByText(ALAVANCA)).toBeVisible();

    // (c) sem atrito: nada a marcar, e o botão de salvar continua habilitado.
    await expect(page.getByRole("checkbox", { name: /CNO/ })).toHaveCount(0);
  });

  test("⚠️ NÃO aparece para favorecido PF — em PF a frase é ruído", async ({
    page,
    db,
  }) => {
    // (a) A alavanca é sobre a EFD-Reinf de prestador PJ. Em PF ela não tem o
    // que exigir, e ruído fabrica cegueira ao aviso.
    const semCno = await criarObra(db, {
      nome: "Casa do Morro",
      data_inicio_obra: "2026-03-15",
    });
    await page.goto("/adicionar/pagamento");
    await page.getByRole("button", { name: "Trocar obra" }).click();
    await page.getByRole("button", { name: /Casa do Morro/ }).click();
    expect(semCno).toBeTruthy();

    await page.getByLabel("Favorecido", { exact: true }).fill("José Pedreiro");
    await page.getByLabel("CNPJ / CPF do favorecido").fill("529.982.247-25");
    await expect(page.getByText(ALAVANCA)).toHaveCount(0);
  });

  test("⚠️ NÃO aparece na obra COM CNO — não há o que exigir", async ({ page }) => {
    // (b) A obra do seed tem CNO.
    await page.goto("/adicionar/pagamento");
    await page.getByLabel("Favorecido", { exact: true }).fill("AJE Construções");
    await page.getByLabel("CNPJ / CPF do favorecido").fill(CNPJ_AJE);
    await expect(page.getByText(ALAVANCA)).toHaveCount(0);
    expect(USER_ID_SEED).toBeTruthy();
  });
});
