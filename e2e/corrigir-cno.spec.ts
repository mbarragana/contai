import type { Page } from "@playwright/test";

import { OBRA_SEED, USER_ID_SEED } from "./ambiente";
import {
  anexosDoDocumento,
  anosAfetados,
  criarDocumento,
  criarFavorecido,
  criarObra,
  documentos,
  revisoes,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * CONTAI-101 contra o Postgres LOCAL. Caso real
 * (`docs/backlog/114-2026-10-22-corrigir-cno-ausente-apos-reemissao.md`),
 * palavras do Mateus: *"a nota fiscal que recebi não constava CNO da obra,
 * solicitei e eles me enviaram, mas não consigo adicionar uma nova nota com a
 * razão adição de CNO."*
 *
 * O que se prova aqui não é o que a tela mostrou: é o ESTADO GRAVADO — as DUAS
 * colunas do CNO, UMA linha de rastro, o anexo vinculado ao ato, o
 * `arquivo_path` INTACTO e o snapshot de anos afetados VAZIO. Nada é stubado: as
 * migrations 0033/0034 rodam de verdade, como `security invoker`, sob a mesma
 * RLS do app.
 *
 * ⚠️ **E o teste central é o que TENTA QUEBRAR a trava do critério 8**: a RPC
 * não tem parâmetro de CNO, e o valor gravado é lido de `obra` no servidor.
 */

const CNPJ_PRESTADORA = "11222333000144";
const PAPEL_REEMITIDO = `${USER_ID_SEED}/documento/nfse-1190-reemitida.pdf`;

const pdfReemitido = () => ({
  name: "nfse-1190-reemitida.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 contai 101 cno impresso"),
});

async function cenarioFavorecido(db: Db) {
  return criarFavorecido(db, {
    tipo: "pj",
    nome: "PerfuraTec Serviços",
    documento: CNPJ_PRESTADORA,
  });
}

/**
 * A NF de serviço já registrada. `nota_traz_cno` default `false` + CNO nulo é o
 * estado exato da dor: o papel original não trazia o CNO, e isso foi AFIRMADO no
 * registro (`nao_traz`), não deixado em branco.
 */
async function notaRegistrada(
  db: Db,
  favorecidoId: string,
  over: Partial<Parameters<typeof criarDocumento>[1]> = {},
) {
  return criarDocumento(db, {
    tipo: "nf_servico",
    favorecido_id: favorecidoId,
    valor: 25000,
    classificacao: "mao_obra",
    destinatario_cpf_ok: true,
    retencao_na_nota: "destacada",
    status: "registrado",
    numero: "1190",
    data_emissao: "2026-06-17",
    nota_traz_cno: false,
    cno_referenciado: null,
    arquivo_path: `${USER_ID_SEED}/documento/nfse-1190.pdf`,
    ...over,
  });
}

const CAMPO_ANEXO = "Nota reemitida, carta de correção ou documento complementar";

/** O primeiro teste a abrir a rota paga a compilação dela pelo `next dev`. */
async function irParaCorrecao(page: Page, documentoId: string) {
  await page.goto(`/documento/${documentoId}/corrigir/cno`);
  await expect(
    page.getByRole("heading", { name: /Corrigir o CNO da nota|CNO corrigido/ }),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe("registrar que a nota passou a trazer o CNO desta obra", () => {
  test("grava as DUAS colunas, UMA linha de rastro, e NÃO toca o arquivo original", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId);
    const arquivoOriginal = (await documentos(db))[0].arquivo_path;

    await irParaCorrecao(page, documentoId);

    // O fato, read-only: hoje → depois. Não existe campo de CNO digitável.
    //
    // ⚠️ **Escopado em `main`, e o escopo é o achado do Gate 2**: o CNO da obra
    // também aparece na SIDEBAR do shell (oculta no mobile, presente no DOM), e
    // um `getByText(...).first()` solto resolvia lá — passando sem nunca olhar a
    // tela sob teste.
    const tela = page.getByRole("main");
    await expect(tela.getByText("não traz CNO").first()).toBeVisible();
    await expect(tela.getByText(OBRA_SEED.cno).first()).toBeVisible();

    // ⚠️ O botão NASCE DESABILITADO (critério 7): o anexo é incondicional, e sem
    // ele não há o que gravar.
    const semPapel = page.getByRole("button", {
      name: "Anexe a nota reemitida para gravar",
    });
    await expect(semPapel).toBeDisabled();

    await page.getByLabel(CAMPO_ANEXO).setInputFiles(pdfReemitido());
    const gravar = page.getByRole("button", { name: "Gravar a correção" });
    await expect(gravar).toBeEnabled();
    await gravar.click();
    await expect(
      page.getByRole("status").filter({ hasText: "Corrigido." }),
    ).toBeVisible();

    // (i) as DUAS colunas, no mesmo ato — e o CNO é o da OBRA, lido no servidor
    const doc = (await documentos(db)).find((d) => d.id === documentoId)!;
    expect(doc.nota_traz_cno).toBe(true);
    expect(doc.cno_referenciado).toBe(OBRA_SEED.cno);

    // (ii) ⚠️ UMA linha de rastro, nunca duas (critério 10): `cno_referenciado` e
    // `nota_traz_cno` são o MESMO fato, amarrado pelo check
    // `documento_cno_coerente` (0015). Duas linhas mostrariam duas correções
    // onde houve uma.
    const rastro = await revisoes(db);
    expect(rastro).toHaveLength(1);
    expect(rastro[0]).toMatchObject({
      entidade: "documento",
      entidade_id: documentoId,
      campo: "cno_referenciado",
      antes: null,
      depois: OBRA_SEED.cno,
      motivo: "cno_obtido_do_prestador",
      motivo_texto: null,
    });

    // (iii) ⚠️ ANOS AFETADOS VAZIO, e é o Gate Fiscal: §0(a) — o único campo de
    // `documento` que move custo entre anos-calendário é `valor`. CNO nunca
    // entrou na conta `C = min(Σ pagamentos, Σ documentos)`.
    expect(await anosAfetados(db)).toHaveLength(0);

    // (iv) ⚠️ `arquivo_path` INTACTO (critério 12): o papel reemitido entra como
    // anexo ADICIONAL, vinculado à `revisao_id` do ato — o dossiê lista os dois.
    const atual = (await documentos(db)).find((d) => d.id === documentoId)!;
    expect(atual.arquivo_path).toBe(arquivoOriginal);
    const anexos = await anexosDoDocumento(db);
    expect(anexos).toHaveLength(1);
    expect(anexos[0]).toMatchObject({
      documento_id: documentoId,
      revisao_id: rastro[0].id,
    });

    // (v) o histórico mostra o campo e o motivo com os rótulos do critério 16
    await page.goto(`/documento/${documentoId}`);
    await expect(
      page.getByText("CNO impresso na nota", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("o prestador enviou a nota com o CNO desta obra"),
    ).toBeVisible();
    // E o link da correção SOME: `notaTrazCno` já não é `false`.
    await expect(
      page.getByRole("link", { name: /Registrar que a nota agora traz o CNO/ }),
    ).toHaveCount(0);
  });

  /**
   * ⚠️ **O TESTE QUE TENTA QUEBRAR A TRAVA DO CRITÉRIO 8.** A RPC não aceita CNO
   * do cliente: com um parâmetro, qualquer chamada ao PostgREST poderia escrever
   * em `documento.cno_referenciado` um número que papel nenhum mostra — e
   * `documento_cno_coerente` (0015) aceitaria, porque ela só exige que o campo
   * não seja nulo.
   */
  test("a RPC NÃO aceita CNO do cliente: o valor vem de `obra`, lido no servidor", async ({
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId);

    // Não existe assinatura com `p_cno` — e o cast é o ponto do teste: em
    // TypeScript isto já não compila, então a tentativa precisa furar o tipo
    // para provar que o BANCO também recusa.
    const chamarComCno = db.rpc as unknown as (
      nome: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: unknown }>;
    const comCno = await chamarComCno.call(db, "corrigir_cno_documento", {
      p_documento_id: documentoId,
      p_anexo_path: PAPEL_REEMITIDO,
      p_cno: "99.999.99999/99",
    });
    expect(comCno.error).not.toBeNull();
    expect((await documentos(db))[0].nota_traz_cno).toBe(false);
    expect(await revisoes(db)).toHaveLength(0);

    // Pela assinatura real, grava — e grava o CNO DA OBRA, que é o único valor
    // que a função conhece.
    const ok = await db.rpc("corrigir_cno_documento", {
      p_documento_id: documentoId,
      p_anexo_path: PAPEL_REEMITIDO,
    });
    expect(ok.error).toBeNull();
    expect((await documentos(db))[0].cno_referenciado).toBe(OBRA_SEED.cno);
  });

  test("sem anexo: botão desabilitado na tela, e a RPC recusa igual", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId);

    await irParaCorrecao(page, documentoId);
    await expect(
      page.getByRole("button", { name: "Anexe a nota reemitida para gravar" }),
    ).toBeDisabled();

    // ⚠️ E o BANCO recusa igual (critério 9): a promessa é do ato, não da tela.
    // Gravar `nota_traz_cno = true` sem papel seria o app afirmando sobre o
    // papel mais do que o papel mostra (§3 do parecer).
    for (const p_anexo_path of [null, "", "   "]) {
      const r = await db.rpc("corrigir_cno_documento", {
        p_documento_id: documentoId,
        p_anexo_path: p_anexo_path as unknown as string,
      });
      expect(r.error).not.toBeNull();
    }

    expect((await documentos(db))[0].nota_traz_cno).toBe(false);
    expect(await revisoes(db)).toHaveLength(0);
    expect(await anexosDoDocumento(db)).toHaveLength(0);
  });

  test("`true` e `null` recusam na tela, e a opção não é oferecida em lugar nenhum", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    // Já traz CNO impresso — não há "nota sem CNO" aqui para corrigir.
    const jaTraz = await notaRegistrada(db, favorecidoId, {
      nota_traz_cno: true,
      cno_referenciado: OBRA_SEED.cno,
    });
    // A pergunta nunca foi feita (registro legado, antes do CONTAI-007).
    const nuncaPerguntado = await notaRegistrada(db, favorecidoId, {
      nota_traz_cno: null,
      cno_referenciado: null,
      numero: "1191",
    });

    await irParaCorrecao(page, jaTraz);
    await expect(page.getByRole("status")).toContainText(
      "já traz CNO impresso",
    );
    await expect(page.getByRole("status")).toContainText(OBRA_SEED.cno);
    await expect(page.getByLabel(CAMPO_ANEXO)).toHaveCount(0);
    // ⚠️ Ressalva do Gate 2: o CNO impresso aqui é o DESTA obra, então a frase
    // "…de uma obra que ela não referencia" (`CNO_NAO_ALCANCA_O_CUSTO`, do Gate
    // Fiscal do CONTAI-007) seria FALSA — e não aparece.
    await expect(
      page.getByText("de uma obra que ela não referencia"),
    ).toHaveCount(0);

    await page.goto(`/documento/${nuncaPerguntado}/corrigir/cno`);
    await expect(page.getByRole("status")).toContainText(
      "nunca foi perguntada",
    );
    await expect(page.getByLabel(CAMPO_ANEXO)).toHaveCount(0);

    // ⚠️ E a RPC recusa os dois estados (critério 9), com anexo e tudo.
    for (const documentoId of [jaTraz, nuncaPerguntado]) {
      const r = await db.rpc("corrigir_cno_documento", {
        p_documento_id: documentoId,
        p_anexo_path: PAPEL_REEMITIDO,
      });
      expect(r.error).not.toBeNull();
    }
    expect(await revisoes(db)).toHaveLength(0);

    // Nem o detalhe nem o ponto de entrada único oferecem o caminho.
    await page.goto(`/documento/${jaTraz}`);
    await expect(
      page.getByRole("link", { name: /Registrar que a nota agora traz o CNO/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /corrigir número, valor e\/ou retenção$/ }),
    ).toBeVisible();

    await page.goto(`/documento/${jaTraz}/documento-novo`);
    await page.getByRole("button", { name: /Vou anexar um arquivo novo/ }).click();
    await page.getByRole("button", { name: "Avançar" }).click();
    await expect(page.getByText("CNO — hoje: não traz CNO")).toHaveCount(0);
  });

  /**
   * ⚠️ **Guarda de TIPO na RPC, acrescentada no Gate 2.** Hoje só NF de serviço
   * nasce com `nota_traz_cno = false` — mas isso é invariante de APP, não de
   * schema: a 0015 amarra `nota_traz_cno`↔`cno_referenciado` e não diz nada sobre
   * `tipo`. Este cenário monta por INSERT direto o estado que a captura não
   * produz, e é por isso que ele existe: sem a cláusula na RPC, o ato gravaria
   * "CNO impresso" num papel que não tem CNO impresso.
   */
  test("boleto/NF de material com `false`: a tela e a RPC recusam pelo TIPO", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const material = await criarDocumento(db, {
      tipo: "nf_material",
      favorecido_id: favorecidoId,
      valor: 25000,
      classificacao: "material",
      destinatario_cpf_ok: true,
      status: "registrado",
      numero: "77",
      data_emissao: "2026-06-17",
      // Estado inalcançável pela captura (`notaTrazCnoParaBanco` devolve `null`
      // fora de `nf_servico`), montado à mão de propósito.
      nota_traz_cno: false,
      arquivo_path: `${USER_ID_SEED}/documento/nf-material-77.pdf`,
    });

    await irParaCorrecao(page, material);
    await expect(page.getByRole("status")).toContainText(
      "não é uma NF de serviço",
    );
    await expect(page.getByLabel(CAMPO_ANEXO)).toHaveCount(0);

    const r = await db.rpc("corrigir_cno_documento", {
      p_documento_id: material,
      p_anexo_path: PAPEL_REEMITIDO,
    });
    expect(r.error).not.toBeNull();
    expect((await documentos(db))[0].nota_traz_cno).toBe(false);
    expect((await documentos(db))[0].cno_referenciado).toBeNull();
    expect(await revisoes(db)).toHaveLength(0);
  });

  test("obra sem CNO: recusa com o caminho do cadastro, na tela e na RPC", async ({
    page,
    db,
  }) => {
    const semCno = await criarObra(db, { nome: "Casa do Morro" });
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId, {
      obra_id: semCno,
    });

    await irParaCorrecao(page, documentoId);
    await expect(page.getByRole("status")).toContainText(
      "ainda não tem CNO cadastrado",
    );
    // ⚠️ A ÚNICA recusa cuja saída não é só voltar: o conserto é no cadastro da
    // obra, não nesta nota.
    await expect(
      page.getByRole("link", { name: "Cadastrar o CNO da obra" }),
    ).toHaveAttribute("href", `/obras/${semCno}`);
    await expect(page.getByLabel(CAMPO_ANEXO)).toHaveCount(0);

    // E a RPC recusa — `documento_cno_coerente` (0015) recusaria de qualquer
    // forma; a exception existe para a mensagem ser a certa.
    const r = await db.rpc("corrigir_cno_documento", {
      p_documento_id: documentoId,
      p_anexo_path: PAPEL_REEMITIDO,
    });
    expect(r.error).not.toBeNull();
    expect((await documentos(db))[0].nota_traz_cno).toBe(false);
    expect(await revisoes(db)).toHaveLength(0);
  });

  /**
   * ⚠️ **Pre-mortem 2 do ticket, e é por isso que este teste existe:** gravar o
   * campo não prova que a PENDÊNCIA fechou. A lista de cobrança é gerada ao vivo
   * a partir de `notaTrazCno` (`lib/fiscal/obra.ts`), então o antes/depois é a
   * única forma de provar que não há cache, view materializada nem campo
   * derivado desatualizado no caminho.
   */
  test("a pendência 'nota sem CNO' lista antes e NÃO lista depois", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    /**
     * ⚠️ **A DATA É DENTRO DA JANELA DO SEED, e foi o segundo achado do Gate 2.**
     * `notasEmitidasSemCno` (`lib/fiscal/obra.ts`) só olha notas emitidas entre
     * `dataInicioObra` (04/11/2025) e o fim da janela — `cnoRegistradoEm`
     * (20/11/2025) na obra do seed. Com a emissão de 17/06/2026 que os outros
     * testes usam, o "antes" NUNCA lista, e o teste passaria a provar nada: era
     * um antes/depois sem o antes, que é exatamente o furo que o pre-mortem 2 do
     * ticket descreve.
     */
    const documentoId = await notaRegistrada(db, favorecidoId, {
      data_emissao: "2025-11-10",
    });

    // ⚠️ **ANTES, nas DUAS superfícies — e elas têm recortes diferentes**
    // (ressalva do Gate 2). A pendência do painel (`resumo.ts`, chip "Nota sem
    // CNO") não tem janela de emissão; a lista de cobrança
    // (`notasEmitidasSemCno`) só olha a janela do CNO. É a do PAINEL que o
    // banner de sucesso promete fechar, porque é a única que vale no caso do
    // relato 114 (nota emitida depois de o CNO sair).
    await page.goto("/pendencias");
    await expect(page.getByText("NF de serviço sem CNO impresso")).toBeVisible();

    await page.goto(`/obras/${OBRA_SEED.id}/notas-sem-cno`);
    await expect(page.getByText("NF 1190 · 10/11/2025")).toBeVisible();

    await irParaCorrecao(page, documentoId);
    await page.getByLabel(CAMPO_ANEXO).setInputFiles(pdfReemitido());
    await page.getByRole("button", { name: "Gravar a correção" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Corrigido." }),
    ).toBeVisible();

    // DEPOIS — as duas, sem recálculo manual nenhum. A pendência é gerada ao
    // vivo a partir de `notaTrazCno`: não há cache, view materializada nem campo
    // derivado no caminho, e é isso que este antes/depois prova.
    //
    // A do painel é a que o banner promete, e é ela que fecha a promessa do
    // texto fechado pelo `contador`: "A pendência 'Nota sem CNO' desta nota
    // deixa de aparecer no painel."
    await page.goto("/pendencias");
    await expect(page.getByText("NF de serviço sem CNO impresso")).toHaveCount(0);

    await page.goto(`/obras/${OBRA_SEED.id}/notas-sem-cno`);
    await expect(page.getByText("NF 1190 · 10/11/2025")).toHaveCount(0);
    await expect(page.getByText("Nenhuma nota a cobrar")).toBeVisible();
  });

  test("o link da correção aparece no detalhe só com `notaTrazCno === false`", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId);

    await page.goto(`/documento/${documentoId}`);
    // O rótulo do ponto de entrada único ganha " e/ou CNO" na MESMA condição.
    await expect(
      page.getByRole("link", { name: /retenção e\/ou CNO$/ }),
    ).toBeVisible();

    const link = page.getByRole("link", {
      name: "Registrar que a nota agora traz o CNO — hoje: não traz CNO",
    });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(
      new RegExp(`/documento/${documentoId}/corrigir/cno$`),
    );
    await expect(page.getByText("CNO na nota — hoje")).toBeVisible();
  });

  test("o pacote do CONTAI-088 leva ao CNO por último, reaproveitando o papel", async ({
    page,
    db,
  }) => {
    const favorecidoId = await cenarioFavorecido(db);
    const documentoId = await notaRegistrada(db, favorecidoId);

    await page.goto(`/documento/${documentoId}/documento-novo`);
    await page.getByRole("button", { name: /Vou anexar um arquivo novo/ }).click();
    await page.getByRole("button", { name: "Avançar" }).click();
    // A 4ª opção, oferecida só neste estado.
    await page.getByText("CNO — hoje: não traz CNO").click();
    await page.getByRole("button", { name: "Continuar" }).click();

    // `cno` é o último da ORDEM_DO_PACOTE, então sozinho ele é a próxima rota.
    await expect(page).toHaveURL(
      new RegExp(`/documento/${documentoId}/corrigir/cno\\?`),
    );
    await page.getByLabel(CAMPO_ANEXO).setInputFiles(pdfReemitido());
    await page.getByRole("button", { name: "Gravar a correção" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Corrigido." }),
    ).toBeVisible();

    const doc = (await documentos(db)).find((d) => d.id === documentoId)!;
    expect(doc.cno_referenciado).toBe(OBRA_SEED.cno);
    expect(await revisoes(db)).toHaveLength(1);
  });
});
