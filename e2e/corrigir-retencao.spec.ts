import type { Page } from "@playwright/test";

import { USER_ID_SEED } from "./ambiente";
import {
  anexosDoDocumento,
  anosAfetados,
  criarDocumento,
  criarFavorecido,
  criarLinhaDeRetencao,
  documentos,
  linhasDeRetencao,
  pendencias,
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
 * **CONTAI-086 + CONTAI-087 contra o Postgres LOCAL** — os dois no mesmo arquivo
 * porque são o mesmo Gate 1 (mesma migration 0028, mesma rota, mesmo E2E).
 *
 * Dívida D90, caso real: a NFS-e 261 foi registrada com o gate em "nenhuma"; a
 * substitutiva 263 (CONTAI-085) revelou ISS retido de R$ 1.797,03. Sem esta tela
 * o gate ficava preso e a pendência real de "quem recolhe" não existia em lugar
 * nenhum do sistema.
 *
 * O que se prova aqui não é o que a tela mostrou: é o ESTADO GRAVADO — a coluna
 * `retencao_na_nota`, as linhas de `documento_retencao`, o `revisao_id` de cada
 * uma, o SNAPSHOT completo em `revisao.antes` depois do DELETE, o anexo com o
 * `revisao_id` do ato, e `revisao_ano_afetado` VAZIO (retenção não move custo).
 * Nada é stubado: a 0028 roda de verdade, como `security invoker`, sob a mesma
 * RLS do app.
 */

const CNPJ_PRESTADORA = "11222333000144";
/** O rótulo da escolha do passo 2 — a resposta NOVA, nunca a pergunta de origem. */
const PERGUNTA_NOVA_RESPOSTA = "Qual é a resposta certa, olhando a nota?";
const NOTA_263 = `${USER_ID_SEED}/documento/nfse-263-substitutiva.pdf`;

async function cenarioFavorecido(db: Db) {
  return criarFavorecido(db, {
    tipo: "pj",
    nome: "PerfuraTec Serviços",
    documento: CNPJ_PRESTADORA,
  });
}

/** A NF de serviço já registrada, com o gate JÁ respondido — o ponto de partida. */
async function notaRegistrada(
  db: Db,
  favorecidoId: string,
  gate: "nenhuma" | "destacada",
) {
  return criarDocumento(db, {
    tipo: "nf_servico",
    favorecido_id: favorecidoId,
    valor: 2169.0,
    classificacao: "mao_obra",
    destinatario_cpf_ok: true,
    numero: "261",
    data_emissao: "2026-09-10",
    retencao_na_nota: gate,
    arquivo_path: `${USER_ID_SEED}/documento/nfse-261.pdf`,
  });
}

/** Uma linha de retenção já gravada (afirmação original: sem `revisao_id`). */
async function linhaJaGravada(db: Db, documentoId: string) {
  return criarLinhaDeRetencao(db, {
    documento_id: documentoId,
    rotulo_literal: "ISS Retido na Fonte",
    valor: 1797.03,
    composicao: "tributo_identificado",
    tributo: "iss",
    e_desconto_efetivo: true,
    quem_recolhe: "nao_sei",
  });
}

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

/** O formulário de linha do passo 3 — os seis campos, nenhum pré-preenchido. */
async function preencherLinha(
  page: Page,
  dados: { rotulo: string; valor: string },
) {
  await page.getByLabel("Rótulo (copie exatamente da nota)").fill(dados.rotulo);
  // `exact`: com o ramo "Não sei o que este valor representa" na tela, "Valor"
  // sem âncora casa com dois controles.
  await page.getByLabel("Valor", { exact: true }).fill(dados.valor);
  await escolher(page, PERGUNTA_COMPOSICAO, "Tributo único identificado");
  await escolher(page, PERGUNTA_TRIBUTO, "ISS");
  // ⚠️ Os dois últimos são 100% manuais e obrigatórios (CONTAI-055, critério 8):
  // nenhuma leitura automática responde desconto efetivo nem quem recolhe — e
  // nesta tela não existe leitura nenhuma, porque não há PDF novo.
  await escolher(page, PERGUNTA_DESCONTO_EFETIVO, "Sim");
  await escolher(page, PERGUNTA_QUEM_RECOLHE, "Eu");
  await page.getByRole("button", { name: "Adicionar linha" }).click();
}

test.describe("CONTAI-086 — reabrir o gate de retenção já respondido", () => {
  test("nenhuma→destacada: gate, linha e anexo num ATO só, com rastro completo", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId, "nenhuma");
    const arquivoOriginal = (await documentos(db))[0].arquivo_path;

    await page.goto(`/documento/${documentoId}/corrigir/retencao`);
    await escolherMotivoDoEmitente(page);

    // Passo 2 — a resposta de hoje aparece, e nada nasce escolhido (critério 2 /
    // a doutrina "campo fiscal não tem resposta padrão").
    await expect(page.getByText("Hoje:")).toBeVisible();
    const gate = page.locator('[data-campo="gateNovo"]');
    await expect(gate.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Escolha a resposta nova para continuar",
      }),
    ).toBeDisabled();

    await escolher(page, PERGUNTA_NOVA_RESPOSTA, "Destacada");

    // Passo 3 — sem linha, não grava (critério 6).
    await expect(
      page.getByRole("button", {
        name: "Adicione ao menos uma linha de retenção para continuar",
      }),
    ).toBeDisabled();

    await preencherLinha(page, { rotulo: "ISS Retido na Fonte", valor: "1797,03" });

    // Passo 4 — motivo "o emitente corrigiu": sem papel, não grava.
    await expect(
      page.getByRole("button", {
        name: "Anexe ou escolha um documento já anexado para gravar",
      }),
    ).toBeDisabled();

    await page
      .locator('[data-campo="anexo"]')
      .setInputFiles({
        name: "nfse-263.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 nota substitutiva 263"),
      });

    await page.getByRole("button", { name: "Gravar a correção" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Retenção corrigida.",
    );

    // (i) o gate novo, no documento
    const doc = (await documentos(db)).find((d) => d.id === documentoId)!;
    expect(doc.retencao_na_nota).toBe("destacada");

    // (ii) a linha, com o `revisao_id` do MESMO ato (CONTAI-087, critério 2: o
    // motivo é herdado, sem rastro próprio nem pergunta extra)
    const linhas = await linhasDeRetencao(db);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].rotulo_literal).toBe("ISS Retido na Fonte");
    // `numeric(14,2)` volta do PostgREST como NÚMERO — a mordida de 2026-08-17.
    expect(linhas[0].valor).toBe(1797.03);

    // (iii) UMA linha de rastro: o gate. A linha nova pendura nela.
    const rastro = await revisoes(db);
    expect(rastro).toHaveLength(1);
    expect(rastro[0]).toMatchObject({
      entidade: "documento",
      entidade_id: documentoId,
      campo: "retencao_na_nota",
      antes: "nenhuma",
      depois: "destacada",
      motivo: "emitente_corrigiu_a_nota",
      motivo_texto: null,
    });
    expect(linhas[0].revisao_id).toBe(rastro[0].id);

    // (iv) o anexo é ADICIONAL e aponta para o ato; o papel original não muda
    const anexos = await anexosDoDocumento(db);
    expect(anexos).toHaveLength(1);
    expect(anexos[0]).toMatchObject({
      documento_id: documentoId,
      revisao_id: rastro[0].id,
    });
    expect(doc.arquivo_path).toBe(arquivoOriginal);

    // (v) ⚠️ ANOS AFETADOS VAZIO e nenhuma pendência de retificadora: nenhuma
    // retenção desta nota move custo de aquisição nem base de aferição (parecer
    // de 2026-09-18, §2 e ADENDO A.2).
    expect(await anosAfetados(db)).toHaveLength(0);
    expect(await pendencias(db)).toHaveLength(0);

    // (vi) e o histórico do documento lê a correção — com os rótulos do gate,
    // nunca o token do enum.
    await page.goto(`/documento/${documentoId}`);
    await expect(
      page.getByText("resposta sobre retenção na nota", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Nenhuma → Destacada")).toBeVisible();
  });

  test("destacada→nenhuma: snapshot completo (com quem reverteu), DELETE, e a linha para de contar", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId, "destacada");
    const linhaId = await linhaJaGravada(db, documentoId);

    await page.goto(`/documento/${documentoId}/corrigir/retencao`);
    await escolherMotivoDeDigitacao(page);
    await escolher(page, PERGUNTA_NOVA_RESPOSTA, "Nenhuma");

    // ⚠️ O aviso é VERBATIM do Gate Fiscal, e a confirmação nasce DESMARCADA.
    await expect(
      page.getByText(
        "A linha de retenção desta nota será removida. O fato fica registrado " +
          "no histórico da correção — mas ela deixa de contar como pendência.",
      ),
    ).toBeVisible();
    const confirma = page.locator('[data-campo="confirmaRemocao"]');
    await expect(confirma).not.toBeChecked();
    await expect(
      page.getByRole("button", { name: "Confirme a remoção para continuar" }),
    ).toBeDisabled();
    await confirma.check();

    // Motivo "eu digitei errado": sem upload, mas com reconferência do papel.
    const reconferi = page.locator('[data-campo="reconferiAfirmacao"]');
    await expect(reconferi).not.toBeChecked();
    await expect(
      page.getByRole("button", {
        name: "Confirme que reconferiu o papel para gravar",
      }),
    ).toBeDisabled();
    await reconferi.check();

    await page.getByRole("button", { name: "Gravar a correção" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Retenção corrigida.",
    );

    // (i) a linha SAIU do banco — remoção física, não soft-delete (critério 8 e
    // 16: é ela que faz `vinculo.ts`/`resumo.ts` pararem de contar sem um `where`
    // novo em leitor nenhum)
    expect(await linhasDeRetencao(db)).toHaveLength(0);
    expect(
      (await documentos(db)).find((d) => d.id === documentoId)!.retencao_na_nota,
    ).toBe("nenhuma");

    // (ii) DUAS linhas de rastro, no mesmo ato: o gate e o snapshot da linha
    const rastro = await revisoes(db);
    expect(rastro).toHaveLength(2);
    expect(new Set(rastro.map((r) => r.ato_id)).size).toBe(1);
    expect(rastro.map((r) => r.campo).sort()).toEqual([
      "linha_retencao",
      "retencao_na_nota",
    ]);
    expect(rastro.find((r) => r.campo === "retencao_na_nota")).toMatchObject({
      antes: "destacada",
      depois: "nenhuma",
      motivo: "erro_de_digitacao_minha",
    });

    // (iii) o SNAPSHOT: os oito campos da linha + quem reverteu +
    // `documento_id`/`obra_id` (condição (b) do Gate Fiscal). Sem ele a linha
    // teria desaparecido do acervo, e é isso que o `contador` aceitou trocar
    // pela tabela de histórico própria.
    const removida = rastro.find((r) => r.campo === "linha_retencao")!;
    expect(removida.depois).toBeNull();
    const snapshot = JSON.parse(removida.antes!) as Record<string, unknown>;
    expect(snapshot.id).toBe(linhaId);
    expect(snapshot.rotulo_literal).toBe("ISS Retido na Fonte");
    // ⚠️ TEXTO, não número: o snapshot preserva a escala impressa na nota.
    expect(snapshot.valor).toBe("1797.03");
    expect(snapshot.composicao).toBe("tributo_identificado");
    expect(snapshot.tributo).toBe("iss");
    expect(snapshot.e_desconto_efetivo).toBe(true);
    expect(snapshot.quem_recolhe).toBe("nao_sei");
    expect(snapshot.created_at).toBeTruthy();
    expect(snapshot.documento_id).toBe(documentoId);
    expect(snapshot.obra_id).toBeTruthy();
    expect(snapshot.revertida_por).toBe(USER_ID_SEED);

    expect(await anosAfetados(db)).toHaveLength(0);

    // (iv) a pendência de "quem recolhe" **deixou de existir** no detalhe: a
    // linha não conta mais em lugar nenhum, e o bloco passa a oferecer a volta.
    await page.goto(`/documento/${documentoId}`);
    await expect(
      page.locator('[data-pendencia="retencao-sem-recolhedor"]'),
    ).toHaveCount(0);
    await expect(page.locator('[data-bloco="retencao-nenhuma"]')).toBeVisible();
    // E o histórico mostra o que saiu, LEGÍVEL — nunca o JSON cru na cara de
    // quem lê. A linha do snapshot é secundária no mesmo ato (`outrosCampos`),
    // por isso vem com o rótulo do campo na frente.
    await expect(
      page.getByText(
        /linha de retenção:\s*“ISS Retido na Fonte”\s*R\$\s*1\.797,03\s*→\s*\(sem a linha\)/,
      ),
    ).toBeVisible();
  });

  test("gate igual e zero linha nova: ZERO rastro — nem o motivo do passo 1", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId, "nenhuma");

    await page.goto(`/documento/${documentoId}/corrigir/retencao`);
    await escolherMotivoDeDigitacao(page);
    await escolher(page, PERGUNTA_NOVA_RESPOSTA, "Nenhuma");

    await expect(
      page.getByText(
        "Nada a corrigir: esta nota já não tinha nenhuma linha de retenção.",
      ),
    ).toBeVisible();
    const botao = page.getByRole("button", { name: "Nada a corrigir" });
    await expect(botao).toBeDisabled();
    // Não há passo 4: sem nada a gravar, não se pede prova de nada.
    await expect(page.locator('[data-campo="anexo"]')).toHaveCount(0);
    await expect(page.locator('[data-campo="reconferiAfirmacao"]')).toHaveCount(0);

    // ⚠️ E a guarda é do BANCO também (critério 5, ratificado pelo `contador`):
    // gravar a reafirmação registraria um NÃO-EVENTO no acervo.
    const recusa = await db.rpc("corrigir_gate_retencao", {
      p_documento_id: documentoId,
      p_gate: "nenhuma",
      p_motivo: "erro_de_digitacao_minha",
      p_linhas: [],
    });
    expect(recusa.error).not.toBeNull();

    expect(await revisoes(db)).toHaveLength(0);
    expect(await anexosDoDocumento(db)).toHaveLength(0);
    expect(
      (await documentos(db)).find((d) => d.id === documentoId)!.retencao_na_nota,
    ).toBe("nenhuma");
  });

  test("anexo obrigatório com motivo do emitente — e reaproveitar o papel já anexado serve", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId, "nenhuma");

    // O CONTAI-085 já corrigiu o NÚMERO desta nota e anexou a 263 segundos antes
    // — é o caso real, e é o papel que o chip oferece reaproveitar.
    const correcaoDeNumero = await db.rpc("corrigir_numero_documento", {
      p_documento_id: documentoId,
      p_numero: "263",
      p_serie: null,
      p_motivo: "emitente_corrigiu_a_nota",
      p_anexo_path: NOTA_263,
    });
    expect(correcaoDeNumero.error).toBeNull();

    // ⚠️ O BANCO recusa a correção do gate sem anexo quando o motivo é
    // `emitente_corrigiu_a_nota` (parecer §5, regra dura 2): a promessa é do ato,
    // não da tela.
    const semAnexo = await db.rpc("corrigir_gate_retencao", {
      p_documento_id: documentoId,
      p_gate: "destacada",
      p_motivo: "emitente_corrigiu_a_nota",
      p_linhas: [
        {
          rotulo_literal: "ISS Retido na Fonte",
          valor: 1797.03,
          composicao: "tributo_identificado",
          tributo: "iss",
          e_desconto_efetivo: true,
          quem_recolhe: "eu",
        },
      ],
    });
    expect(semAnexo.error).not.toBeNull();
    expect((await revisoes(db)).map((r) => r.campo)).toEqual(["numero"]);

    // Agora pela tela, reaproveitando o papel que já está no documento.
    await page.goto(`/documento/${documentoId}/corrigir/retencao`);
    await escolherMotivoDoEmitente(page);
    await escolher(page, PERGUNTA_NOVA_RESPOSTA, "Destacada");
    await preencherLinha(page, { rotulo: "ISS Retido na Fonte", valor: "1797,03" });

    // O chip diz O QUE o papel corrigiu (campo), não por quê (motivo).
    const chip = page.getByRole("button", {
      name: /Usar a nota anexada em .*correção de número da nota/,
    });
    await expect(chip).toBeVisible();
    await chip.click();

    await page.getByRole("button", { name: "Gravar a correção" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Retenção corrigida.",
    );

    // ⚠️ DUAS linhas em `documento_anexo` para o MESMO objeto do bucket, cada uma
    // com o `revisao_id` do seu ato: nenhum upload duplicado, e a resposta de
    // "qual papel sustentou QUAL correção" continua existindo nas duas pontas.
    const anexos = await anexosDoDocumento(db);
    expect(anexos).toHaveLength(2);
    expect(anexos.map((a) => a.arquivo_path)).toEqual([NOTA_263, NOTA_263]);
    expect(new Set(anexos.map((a) => a.revisao_id)).size).toBe(2);

    const rastro = await revisoes(db);
    const gate = rastro.find((r) => r.campo === "retencao_na_nota")!;
    expect(anexos.map((a) => a.revisao_id)).toContain(gate.id);
    expect(await linhasDeRetencao(db)).toHaveLength(1);
  });
});

test.describe("CONTAI-087 — a linha de retenção que nasce depois do registro", () => {
  test("linha tardia isolada: rastro próprio, anexo conforme o motivo", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId, "destacada");
    await linhaJaGravada(db, documentoId);

    // ⚠️ Critério 6: com o gate "destacada" e ≥1 linha, o `Repeater` NÃO grava
    // mais direto — ele abre a rota de correção em modo "só linha".
    await page.goto(`/documento/${documentoId}`);
    await page.getByRole("link", { name: "+ Adicionar outra linha" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/documento/${documentoId}/corrigir/retencao\\?modo=linha$`),
    );

    await escolherMotivoDeDigitacao(page);
    // O gate aparece AFIRMADO, sem opção de mudar (critério 6).
    await expect(page.locator('[data-campo="gateNovo"]')).toHaveCount(0);
    await expect(page.getByText("Hoje:")).toBeVisible();

    await preencherLinha(page, { rotulo: "IRRF", valor: "32,50" });

    // Motivo "eu digitei errado" → sem upload, com revalidação do papel.
    await page.locator('[data-campo="reconferiAfirmacao"]').check();
    await page.getByRole("button", { name: "Gravar a correção" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Retenção corrigida.",
    );

    // (i) a linha nova, com rastro PRÓPRIO (`campo = 'linha_retencao'`): aqui o
    // `createdAt` não bastava — faltava "por que a linha aparece só agora".
    const linhas = await linhasDeRetencao(db);
    expect(linhas).toHaveLength(2);
    const nova = linhas.find((l) => l.rotulo_literal === "IRRF")!;
    const rastro = await revisoes(db);
    expect(rastro).toHaveLength(1);
    expect(rastro[0]).toMatchObject({
      entidade: "documento",
      entidade_id: documentoId,
      campo: "linha_retencao",
      antes: null,
      motivo: "erro_de_digitacao_minha",
    });
    expect(nova.revisao_id).toBe(rastro[0].id);
    const depois = JSON.parse(rastro[0].depois!) as Record<string, unknown>;
    expect(depois.rotulo_literal).toBe("IRRF");

    // (ii) a linha que já existia continua INTOCADA, e sem `revisao_id`: ela é
    // afirmação original, e `null` ali é um fato.
    const antiga = linhas.find((l) => l.rotulo_literal === "ISS Retido na Fonte")!;
    expect(antiga.revisao_id).toBeNull();

    // (iii) o gate não se mexeu, e nenhum ano foi afetado.
    expect(
      (await documentos(db)).find((d) => d.id === documentoId)!.retencao_na_nota,
    ).toBe("destacada");
    expect(await anosAfetados(db)).toHaveLength(0);
    expect(await anexosDoDocumento(db)).toHaveLength(0);
  });

  /**
   * ⚠️ **Achado do Gate 2 — a recusa tem de ser NO TOPO, não no "Gravar".**
   * Chega-se a `?modo=linha` com o gate em "nenhuma" por URL digitada à mão, link
   * velho ou gate mudado em outra aba. Antes da guarda, a tela dizia *"este
   * caminho não muda a resposta"* ao lado de *"Hoje: Nenhuma"* — duas frases que
   * juntas são falsas — e deixava montar motivo, linha e anexo para o servidor
   * recusar no fim. A RPC continua recusando (a promessa é do ato), mas trabalho
   * fiscal preenchido e jogado no lixo ensina que o erro é do app.
   */
  test("?modo=linha com gate 'nenhuma' recusa ANTES de deixar preencher", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId, "nenhuma");

    await page.goto(`/documento/${documentoId}/corrigir/retencao?modo=linha`);

    const aviso = page.getByRole("status");
    await expect(aviso).toContainText("A resposta gravada desta nota é");
    await expect(aviso).toContainText("Nenhuma");

    // Nenhum campo montado: nem o passo 1 (motivo), nem o gate, nem a linha.
    await expect(
      page.getByRole("button", { name: "Só aqui no app — eu digitei errado" }),
    ).toHaveCount(0);
    await expect(page.locator('[data-campo="gateNovo"]')).toHaveCount(0);
    await expect(page.getByLabel("Rótulo (copie exatamente da nota)")).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: /^Gravar/ })).toHaveCount(0);

    // E o caminho certo é oferecido: a correção do GATE admite a linha nova no
    // mesmo ato.
    await page
      .getByRole("link", { name: "Corrigir a resposta sobre retenção" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/documento/${documentoId}/corrigir/retencao$`),
    );
    await expect(page.getByText("Passo 1 de 4", { exact: true })).toBeVisible();

    // Nada foi gravado em nenhum momento.
    expect(await revisoes(db)).toHaveLength(0);
    expect(await linhasDeRetencao(db)).toHaveLength(0);
    expect(await anexosDoDocumento(db)).toHaveLength(0);
  });

  test("a RPC da linha tardia recusa o motivo do comprovante, e recusa gate que não é destacada", async ({
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const comGate = await notaRegistrada(db, favorecidoId, "destacada");
    await linhaJaGravada(db, comGate);
    const semRetencao = await notaRegistrada(db, favorecidoId, "nenhuma");

    const linha = {
      rotulo_literal: "IRRF",
      valor: 32.5,
      composicao: "tributo_identificado",
      tributo: "irrf",
      e_desconto_efetivo: true,
      quem_recolhe: "empresa",
    };

    // ⚠️ `comprovante_chegou_depois` é motivo do ciclo do COMPROVANTE DE
    // PAGAMENTO (CONTAI-061). Uma linha de retenção se lê na NOTA — aceitá-lo
    // gravaria um rastro que descreve outro ato (critério 5).
    const motivoErrado = await db.rpc("adicionar_linha_retencao_registrada", {
      p_documento_id: comGate,
      p_linha: linha,
      p_motivo: "comprovante_chegou_depois",
    });
    expect(motivoErrado.error).not.toBeNull();

    // Sem anexo, com o motivo do emitente: recusa.
    const semAnexo = await db.rpc("adicionar_linha_retencao_registrada", {
      p_documento_id: comGate,
      p_linha: linha,
      p_motivo: "emitente_corrigiu_a_nota",
    });
    expect(semAnexo.error).not.toBeNull();

    // E numa nota cujo gate diz "nenhuma" a linha não entra por esta porta: isso
    // é correção de GATE, e tem tela própria — senão o acervo ficaria com uma
    // nota que tem retenção registrada e gate dizendo que não há.
    const gateErrado = await db.rpc("adicionar_linha_retencao_registrada", {
      p_documento_id: semRetencao,
      p_linha: linha,
      p_motivo: "erro_de_digitacao_minha",
    });
    expect(gateErrado.error).not.toBeNull();

    // Nada disso tocou o acervo.
    expect(await linhasDeRetencao(db)).toHaveLength(1);
    expect(await revisoes(db)).toHaveLength(0);
    expect(await anexosDoDocumento(db)).toHaveLength(0);
  });

  test("a primeira linha de um gate corrigido amarra ao ato do gate; a de um gate original, não", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);

    // Caso A — o gate foi CORRIGIDO para "destacada" e a linha prometida por
    // aquele ato só está sendo preenchida agora: ela amarra àquela revisão,
    // **sem motivo novo e sem rastro novo** (critério 3).
    const corrigido = await notaRegistrada(db, favorecidoId, "nenhuma");
    const ato = await db.rpc("corrigir_gate_retencao", {
      p_documento_id: corrigido,
      p_gate: "destacada",
      p_motivo: "erro_de_digitacao_minha",
      p_linhas: [
        {
          rotulo_literal: "ISS Retido na Fonte",
          valor: 1797.03,
          composicao: "tributo_identificado",
          tributo: "iss",
          e_desconto_efetivo: true,
          quem_recolhe: "eu",
        },
      ],
    });
    expect(ato.error).toBeNull();
    // Volta ao estado `faltaRegistrarLinha`: a linha daquele ato foi removida
    // isoladamente (a dívida nomeada no ticket: `removerLinhaRetencao` sem
    // rastro), e o gate continua "destacada" com zero linha.
    const linhaDoAto = (await linhasDeRetencao(db))[0];
    await db.from("documento_retencao").delete().eq("id", linhaDoAto.id);

    await page.goto(`/documento/${corrigido}`);
    await page
      .getByRole("button", { name: "+ Adicionar a primeira linha de retenção" })
      .click();
    await preencherLinha(page, { rotulo: "ISS Retido na Fonte", valor: "1797,03" });
    await expect(page.locator('[data-retencao="linha"]')).toHaveCount(1);

    const rastroDoCorrigido = (await revisoes(db)).filter(
      (r) => r.entidade_id === corrigido,
    );
    // UMA revisão só — a do gate. A linha nova não inventou uma segunda.
    expect(rastroDoCorrigido).toHaveLength(1);
    expect(rastroDoCorrigido[0].campo).toBe("retencao_na_nota");
    const novaDoCorrigido = (await linhasDeRetencao(db)).find(
      (l) => l.documento_id === corrigido,
    )!;
    expect(novaDoCorrigido.revisao_id).toBe(rastroDoCorrigido[0].id);

    // Caso B — o gate sempre foi "destacada", desde a captura: a primeira linha é
    // AFIRMAÇÃO ORIGINAL (`revisao_id` null, sem motivo), nunca correção.
    const original = await notaRegistrada(db, favorecidoId, "destacada");
    await page.goto(`/documento/${original}`);
    await page
      .getByRole("button", { name: "+ Adicionar a primeira linha de retenção" })
      .click();
    await preencherLinha(page, { rotulo: "ISS Retido na Fonte", valor: "500,00" });
    await expect(page.locator('[data-retencao="linha"]')).toHaveCount(1);

    const novaDoOriginal = (await linhasDeRetencao(db)).find(
      (l) => l.documento_id === original,
    )!;
    expect(novaDoOriginal.revisao_id).toBeNull();
    expect(
      (await revisoes(db)).filter((r) => r.entidade_id === original),
    ).toHaveLength(0);
  });
});

test.describe("CONTAI-086 — a porta de volta no detalhe do documento", () => {
  test('gate "nenhuma" mostra o card novo (era `null`: a dívida D90)', async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId, "nenhuma");

    await page.goto(`/documento/${documentoId}`);
    const card = page.locator('[data-bloco="retencao-nenhuma"]');
    await expect(card).toBeVisible();
    await expect(card).toContainText("sem retenção destacada");
    await card
      .getByRole("link", { name: "Corrigir a resposta sobre retenção" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/documento/${documentoId}/corrigir/retencao$`),
    );
    await expect(page.getByText("Passo 1 de 4", { exact: true })).toBeVisible();
  });

  test("o legado (gate nunca respondido) não entra nesta tela — nem pela RPC", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const legado = await criarDocumento(db, {
      tipo: "nf_servico",
      favorecido_id: favorecidoId,
      valor: 2169.0,
      classificacao: "mao_obra",
      destinatario_cpf_ok: true,
      numero: "100",
      arquivo_path: `${USER_ID_SEED}/documento/nfse-100.pdf`,
    });

    await page.goto(`/documento/${legado}/corrigir/retencao`);
    await expect(page.getByRole("status")).toContainText("nunca respondeu");
    await expect(page.getByRole("button", { name: /^Gravar/ })).toHaveCount(0);

    // E a RPC recusa: a PRIMEIRA resposta é afirmação original, e tratá-la como
    // correção gravaria um `antes` que ninguém nunca afirmou.
    const recusa = await db.rpc("corrigir_gate_retencao", {
      p_documento_id: legado,
      p_gate: "destacada",
      p_motivo: "erro_de_digitacao_minha",
      p_linhas: [
        {
          rotulo_literal: "ISS",
          valor: 10,
          composicao: "tributo_identificado",
          tributo: "iss",
          e_desconto_efetivo: true,
          quem_recolhe: "eu",
        },
      ],
    });
    expect(recusa.error).not.toBeNull();
    expect(await revisoes(db)).toHaveLength(0);
    expect(await linhasDeRetencao(db)).toHaveLength(0);
  });
});
