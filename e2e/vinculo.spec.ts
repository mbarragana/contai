import {
  OBRA_ID_SEED,
  URL_SUPABASE_LOCAL,
  USER_ID_SEED,
} from "./ambiente";
import {
  criarCompromisso,
  criarDocumento,
  criarFavorecido,
  criarPagamento,
  criarVinculo,
  documentos,
  favorecidos,
  pagamentos,
  vinculos,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
// ⚠️ O texto fiscal se confere contra a CONSTANTE que a tela lê — digitá-lo de
// novo aqui seria só uma segunda chance de errar nos dois lados.
import { VENCIDO_SEM_RESPOSTA } from "../lib/fiscal/compromisso";
import {
  avisoDocumentoJaLigado,
  avisoPagamentoJaLigado,
  CANDIDATO_OCULTO_DOCUMENTO,
  CANDIDATO_OCULTO_PAGAMENTO,
  VINCULO_SO_MUDA_A_PROVA,
} from "../lib/fiscal/vinculo";
import {
  escolher,
  preencherDocumentoBasico,
  responderCnoDaNota,
} from "./formularios";

/**
 * O vínculo pagamento↔documento contra o Postgres LOCAL (critério 16 do
 * CONTAI-018): sessão de verdade, linhas de verdade, RLS ligada. As asserções
 * olham o ESTADO GRAVADO em `pagamento_documento` pelo MESMO client
 * autenticado que o app usa — nada de service key: o que a policy barra para o
 * app tem de barrar para o teste.
 *
 * Cenário: é o caso real que originou o relato — NF de R$ 3.000 da WK
 * registrada, PIX de R$ 3.000 registrado, e a home dizendo
 * "Custo confirmado R$ 0,00".
 */

const ANO = new Date().getFullYear();

const CNPJ_WK = "11.222.333/0001-81";
const CNPJ_WK_DIGITOS = "11222333000181";
const CNPJ_DEPOSITO_DIGITOS = "11444777000161";

function png(nome: string) {
  return { name: nome, mimeType: "image/png", buffer: Buffer.from(`PNG ${nome}`) };
}

function pdf(nome: string) {
  return {
    name: nome,
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4 ${nome}`),
  };
}

/** A NF da WK e o PIX correspondente, os dois soltos — o estado de hoje. */
async function cenarioWk(db: Db) {
  const wk = await criarFavorecido(db, {
    nome: "WK Construções LTDA",
    documento: CNPJ_WK_DIGITOS,
    tipo: "pj",
  });
  const documentoId = await criarDocumento(db, {
    favorecido_id: wk,
    tipo: "nf_servico",
    classificacao: "mao_obra",
    valor: 3000,
    retencao_na_nota: "destacada",
    destinatario_cpf_ok: true,
    status: "registrado",
  });
  const pagamentoId = await criarPagamento(db, {
    favorecido_id: wk,
    valor: 3000,
    data_pagamento: `${ANO}-08-12`,
    meio: "pix",
    // Nasce `aguardando_nf`, como todo pagamento do parque de registros dele.
    status: "aguardando_nf",
    comprovante_path: `${USER_ID_SEED}/comprovante/pix-wk.png`,
  });
  return { wk, documentoId, pagamentoId };
}

test.describe("caminho B — a partir do documento já registrado", () => {
  test("liga o PIX à NF, grava o vínculo e a despesa passa a aparecer uma vez", async ({
    page,
    db,
  }) => {
    const { documentoId, pagamentoId } = await cenarioWk(db);

    await page.goto("/");

    // Critério 14: o zero não aparece mudo. Texto do parecer §5.1.
    await expect(page.getByText("R$ 0,00").first()).toBeVisible();
    await expect(
      page.getByText(/Não significa que seu custo é zero/),
    ).toBeVisible();

    // Terceiro estado (parecer §5.2), em seção própria e fora das pendências.
    await expect(
      page.getByText("NF de serviço sem pagamento ligado"),
    ).toBeVisible();
    await expect(
      page.getByText(/Elas entram no "custo confirmado" quando o pagamento/),
    ).toBeVisible();

    // Antes do vínculo a mesma despesa ocupa DOIS cartões — é a palavra
    // "duplicadas" do relato. ⚠️ CONTAI-040/042: o lado do PAGAMENTO é
    // pendência e mora na fila de /pendencias; o lado da NOTA é o terceiro
    // estado (§5.2), que não é pendência e continua no painel do dashboard.
    await page.goto("/pendencias");
    await expect(page.getByText("1 PIX sem NF vinculada")).toBeVisible();

    await page.goto("/");
    await page.getByRole("link", { name: "Ligar a um pagamento" }).click();
    await expect(
      page.getByRole("heading", { name: "Ligar pagamentos a esta nota" }),
    ).toBeVisible();

    // Critério 10: a sugestão ordena e rotula — e NÃO vem marcada.
    const candidato = page.getByRole("checkbox").first();
    await expect(candidato).not.toBeChecked();
    await expect(
      page.getByText("Sugestão — mesmo favorecido e mesmo valor"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Marque ao menos um pagamento" }),
    ).toBeDisabled();

    // Nada foi gravado só por abrir o seletor.
    expect(await vinculos(db)).toHaveLength(0);

    await candidato.check();
    // O saldo restante e o efeito no custo aparecem ANTES do toque no botão —
    // e o efeito é "antes → depois" da MESMA conta que produz o número da
    // home, nos dois números (ano e acumulado).
    await expect(page.getByText("Nota coberta por inteiro.")).toBeVisible();
    // O rótulo é o do mock aprovado (rodapé fixo do seletor); o número é o
    // ACRÉSCIMO real, e vem acompanhado do "antes → depois" do ano e do
    // acumulado — os dois calculados pela mesma `alocarCusto` da home.
    const rodape = page.getByText(/Custo confirmado se ligar agora/);
    await expect(rodape).toContainText("R$ 3.000,00");
    await expect(rodape).toContainText(`${ANO}: R$ 0,00 → R$ 3.000,00`);
    await expect(rodape).toContainText("acumulado: R$ 0,00 → R$ 3.000,00");

    await page
      .getByRole("button", { name: "Ligar 1 pagamento — R$ 3.000,00" })
      .click();

    await expect(page.getByText(/Ligado\./)).toBeVisible();

    // ── O ESTADO GRAVADO, pelo client autenticado (RLS `dono_vinculo`) ──
    const linhas = await vinculos(db);
    expect(linhas).toEqual([
      { pagamento_id: pagamentoId, documento_id: documentoId },
    ]);

    // `conciliado` é gravado como CONSEQUÊNCIA (critério 7) — e não é o que
    // faz o custo existir.
    const pagos = await pagamentos(db);
    expect(pagos[0].status).toBe("conciliado");

    // Critério 13: no dashboard, UMA despesa — nem a NF nem o PIX soltos.
    await page.goto("/");
    const painel = page.locator('[data-painel="despesas-recentes"]');
    await expect(painel.getByText("Despesas recentes")).toBeVisible();
    await expect(painel.getByText(/uma despesa, não duas/).first()).toBeVisible();
    await expect(
      page.getByText("NF de serviço sem pagamento ligado"),
    ).toHaveCount(0);
    // E o lado do pagamento saiu da fila de pendências junto.
    await page.goto("/pendencias");
    await expect(page.getByText("1 PIX sem NF vinculada")).toHaveCount(0);
    await page.goto("/");
    await expect(page.getByText(/Custo confirmado em/).locator("..")).toContainText(
      "3.000,00",
    );
  });

  test("desligar diz o efeito no custo antes do toque e apaga só o vínculo", async ({
    page,
    db,
  }) => {
    const { documentoId, pagamentoId } = await cenarioWk(db);
    // Cenário já conciliado, montado pelo client autenticado.
    const { error } = await db
      .from("pagamento_documento")
      .insert({ pagamento_id: pagamentoId, documento_id: documentoId });
    expect(error).toBeNull();

    await page.goto(`/documento/${documentoId}`);
    await expect(page.getByText("Custo comprovado")).toBeVisible();

    await page.getByRole("link", { name: "Desligar este pagamento" }).click();

    // Critério 15: o efeito no custo dito ANTES, com o número que vai aparecer
    // — e desde o Gate 2 também no ACUMULADO, para o pagamento de ano anterior
    // não mostrar efeito zero (C2).
    await expect(
      page.getByText(`Custo confirmado ${ANO}`).locator(".."),
    ).toContainText("R$ 3.000,00 → R$ 0,00");
    await expect(
      page.getByText(`Acumulado até ${ANO}`).locator(".."),
    ).toContainText("R$ 3.000,00 → R$ 0,00");
    await expect(page.getByText(/Nada é apagado/)).toBeVisible();

    await page
      .getByRole("button", { name: "Desligar — o custo cai para R$ 0,00" })
      .click();

    await expect(page.getByText("Nenhum pagamento ligado a este documento.")).toBeVisible();

    // Só o vínculo caiu: nota e pagamento continuam no acervo (append-only).
    expect(await vinculos(db)).toHaveLength(0);
    expect(await documentos(db)).toHaveLength(1);
    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(1);
    expect(pagos[0].status).toBe("aguardando_nf");
  });

  /**
   * CONTAI-037, critério 5: com mais de um pagamento ligado, a nota é o único
   * caminho até cada um deles — a home linka só para o documento. O que o
   * teste prova é que a porta abre no pagamento CLICADO, e não no primeiro da
   * lista: a lista vem ordenada por `cronologico` (`lib/fiscal/vinculo.ts`),
   * então a segunda linha é a do PIX mais recente.
   */
  test("com 2 pagamentos ligados, 'Ver o pagamento' abre o da linha clicada", async ({
    page,
    db,
  }) => {
    const wk = await criarFavorecido(db, {
      nome: "WK Construções LTDA",
      documento: CNPJ_WK_DIGITOS,
      tipo: "pj",
    });
    const documentoId = await criarDocumento(db, {
      favorecido_id: wk,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      valor: 3000,
      retencao_na_nota: "destacada",
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    const pagamentoAntigo = await criarPagamento(db, {
      favorecido_id: wk,
      valor: 1000,
      data_pagamento: `${ANO}-07-01`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-antigo.png`,
    });
    const pagamentoNovo = await criarPagamento(db, {
      favorecido_id: wk,
      valor: 2000,
      data_pagamento: `${ANO}-08-12`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-novo.png`,
    });
    await criarVinculo(db, pagamentoAntigo, documentoId);
    await criarVinculo(db, pagamentoNovo, documentoId);

    await page.goto(`/documento/${documentoId}`);
    const portas = page.getByRole("link", { name: "Ver o pagamento" });
    await expect(portas).toHaveCount(2);
    // A ordem da lista é a cronológica, e cada linha leva ao SEU pagamento.
    await expect(portas.first()).toHaveAttribute(
      "href",
      `/pagamento/${pagamentoAntigo}`,
    );

    await portas.nth(1).click();

    await expect(page).toHaveURL(new RegExp(`/pagamento/${pagamentoNovo}$`));
    await expect(page.getByRole("heading", { name: "Pagamento" })).toBeVisible();
    // O valor confirma que é o pagamento clicado, não o primeiro da lista.
    await expect(page.getByText("R$ 2.000,00").first()).toBeVisible();
  });
});

test.describe("caminho A — vínculo no ato do registro", () => {
  test("registra a nota já ligada a um PIX que existia", async ({ page, db }) => {
    const wk = await criarFavorecido(db, {
      nome: "WK Construções LTDA",
      documento: CNPJ_WK_DIGITOS,
      tipo: "pj",
    });
    const pagamentoId = await criarPagamento(db, {
      favorecido_id: wk,
      valor: 3000,
      data_pagamento: `${ANO}-08-12`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-wk.png`,
    });

    await page.goto("/adicionar/documento");
    await preencherDocumentoBasico(page, {
      tipo: "NF serviço",
      emitente: "WK Construções LTDA",
      documento: CNPJ_WK,
      valor: "3.000,00",
      // Bloqueantes desde o CONTAI-004 — inclusive no caminho A do vínculo.
      numero: "3000",
      dataEmissao: "2026-05-04",
      arquivo: pdf("NF-WK-3000.pdf"),
      noCpf: "Sim",
    });
    await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");
    // CONTAI-007: bloqueante em NF de serviço — a obra do seed tem CNO.
    await responderCnoDaNota(page, "É o CNO desta obra");

    await page.getByRole("checkbox", { name: "Já paguei esta nota" }).check();

    // Critério 10 também aqui: o candidato aparece rotulado e desmarcado.
    const candidato = page
      .getByRole("checkbox")
      .filter({ hasNotText: "Já paguei" })
      .last();
    await expect(candidato).not.toBeChecked();
    await candidato.check();

    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();
    await expect(page.getByText(/1 pagamento ligado/)).toBeVisible();

    const docs = await documentos(db);
    expect(docs).toHaveLength(1);
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagamentoId, documento_id: docs[0].id },
    ]);
  });

  /**
   * B2 do Gate 2: o `router.push` da quarentena acontecia ANTES da criação dos
   * vínculos, e os pagamentos marcados eram descartados em silêncio. O
   * critério 8 diz o oposto — quarentena PODE ser ligada, e é isso que impede
   * a mesma despesa de contar duas vezes.
   */
  test("nota em quarentena entra LIGADA ao pagamento marcado (critério 8)", async ({
    page,
    db,
  }) => {
    const deposito = await criarFavorecido(db, {
      nome: "Depósito Cachoeira ME",
      documento: CNPJ_DEPOSITO_DIGITOS,
      tipo: "pj",
    });
    const pagamentoId = await criarPagamento(db, {
      favorecido_id: deposito,
      valor: 800,
      data_pagamento: `${ANO}-08-05`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-deposito.png`,
    });

    await page.goto("/adicionar/documento");
    // ⚠️ Quarentena TAMBÉM exige número e data (R5 do CONTAI-004): é a nota
    // errada que precisa ser identificada para ser cancelada e reemitida.
    await preencherDocumentoBasico(page, {
      tipo: "NF material",
      emitente: "Depósito Cachoeira ME",
      documento: "11.444.777/0001-61",
      valor: "800,00",
      numero: "800",
      dataEmissao: "2026-05-04",
      arquivo: pdf("NF-DEPOSITO.pdf"),
      noCpf: "Não",
    });

    await page.getByRole("checkbox", { name: "Já paguei esta nota" }).check();
    // O texto do parecer é dito na hora do vínculo, não depois.
    await expect(
      page.getByText(/Ligar o pagamento é permitido e útil/),
    ).toBeVisible();

    const candidato = page
      .getByRole("checkbox")
      .filter({ hasNotText: "Já paguei" })
      .last();
    // Critério 10 e, de quebra, a espera pela lista: enquanto os pagamentos da
    // obra não chegam, o único checkbox da tela é o "Já paguei", que ESTÁ
    // marcado — a asserção só passa quando o candidato existe.
    await expect(candidato).not.toBeChecked();
    await candidato.check();

    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByRole("heading", { name: "Quarentena" })).toBeVisible();

    const docs = await documentos(db);
    expect(docs).toHaveLength(1);
    expect(docs[0].status).toBe("quarentena");
    // O vínculo EXISTE — e o pagamento NÃO virou `conciliado`, porque o
    // documento não é hábil.
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagamentoId, documento_id: docs[0].id },
    ]);
    const pagos = await pagamentos(db);
    expect(pagos[0].status).toBe("aguardando_nf");
  });

  test("quarentena com vínculo que falha NÃO é sucesso mudo (critério 1)", async ({
    page,
    db,
  }) => {
    // O ramo que ficava calado: a nota ia para quarentena, a navegação para a
    // tela do documento acontecia mesmo com o vínculo quebrado, e o aviso do
    // critério 1 nunca aparecia — justo onde ele mais importa, porque a nota
    // em quarentena não sustenta custo e o pagamento marcado continua "pago
    // sem nota", com a despesa contada duas vezes.
    const deposito = await criarFavorecido(db, {
      nome: "Depósito Cachoeira ME",
      documento: CNPJ_DEPOSITO_DIGITOS,
      tipo: "pj",
    });
    await criarPagamento(db, {
      favorecido_id: deposito,
      valor: 800,
      data_pagamento: `${ANO}-08-05`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-deposito.png`,
    });

    // Falsificação de rede restrita ao INSERT do vínculo: o documento tem de
    // entrar de verdade para o caso existir. Derrubar o PostgREST inteiro
    // testaria outra coisa.
    await page.route(
      `${URL_SUPABASE_LOCAL}/rest/v1/pagamento_documento*`,
      (rota) =>
        rota.request().method() === "POST"
          ? rota.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({
                code: "PGRST000",
                message: "could not connect to server",
              }),
            })
          : rota.fallback(),
    );

    await page.goto("/adicionar/documento");
    // ⚠️ Quarentena TAMBÉM exige número e data (R5 do CONTAI-004): é a nota
    // errada que precisa ser identificada para ser cancelada e reemitida.
    await preencherDocumentoBasico(page, {
      tipo: "NF material",
      emitente: "Depósito Cachoeira ME",
      documento: "11.444.777/0001-61",
      valor: "800,00",
      numero: "800",
      dataEmissao: "2026-05-04",
      arquivo: pdf("NF-DEPOSITO.pdf"),
      noCpf: "Não",
    });

    await page.getByRole("checkbox", { name: "Já paguei esta nota" }).check();
    const candidato = page
      .getByRole("checkbox")
      .filter({ hasNotText: "Já paguei" })
      .last();
    await expect(candidato).not.toBeChecked();
    await candidato.check();

    await page.getByRole("button", { name: "Salvar registro" }).click();

    // NÃO navegou para a tela de quarentena: a confirmação fica aqui e diz as
    // DUAS consequências.
    await expect(page.getByText(/ficou SEM VÍNCULO/)).toBeVisible();
    await expect(page.getByText(/está em/)).toContainText(/quarentena/);
    await expect(
      page.getByRole("heading", { name: "Quarentena" }),
    ).toHaveCount(0);

    // O documento entrou; o vínculo não. Nada de "conciliado" fantasma.
    const docs = await documentos(db);
    expect(docs).toHaveLength(1);
    expect(docs[0].status).toBe("quarentena");
    expect(await vinculos(db)).toEqual([]);
    const pagos = await pagamentos(db);
    expect(pagos[0].status).toBe("aguardando_nf");
  });

  test("registra o pagamento já ligado à nota (mock s3b)", async ({ page, db }) => {
    const wk = await criarFavorecido(db, {
      nome: "WK Construções LTDA",
      documento: CNPJ_WK_DIGITOS,
      tipo: "pj",
    });
    const documentoId = await criarDocumento(db, {
      favorecido_id: wk,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      valor: 3000,
      retencao_na_nota: "destacada",
      destinatario_cpf_ok: true,
      status: "registrado",
    });

    await page.goto(`/documento/${documentoId}`);
    await page
      .getByRole("link", { name: "Registrar o pagamento desta nota" })
      .click();

    // O vínculo é AFIRMADO na tela antes de salvar, e é desfazível ali.
    await expect(page.getByText("Ligado a:")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Desfazer o vínculo antes de salvar" }),
    ).toBeVisible();

    // Os TRÊS vêm da nota, e os dois do favorecido vêm SEM campo (adendo de
    // 2026-08-18): quem recebe o dinheiro é atributo da nota. O CNPJ era o do
    // relato — redigitado à mão, um dígito trocado criaria um segundo
    // favorecido e a ficha Pagamentos Efetuados sairia com a WK em duas linhas.
    const herdado = page.getByRole("group", { name: "Favorecido da nota" });
    await expect(
      herdado.getByText("Favorecido — da NF de serviço de R$ 3.000,00", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(herdado.getByText("WK Construções LTDA")).toBeVisible();
    await expect(herdado.getByText(CNPJ_WK)).toBeVisible();
    // Nota sem pagamento nenhum ligado: falta ela inteira. E este continua
    // digitável — é o único dos três que diverge legitimamente.
    await expect(page.getByLabel("Valor")).toHaveValue("3.000,00");
    await expect(page.getByLabel("Valor")).toBeEditable();
    await expect(page.getByText("Vem da nota — valor da nota.")).toBeVisible();

    // CONTAI-032: Meio e Data SEM DEFAULT — o teste escolhe.
    await escolher(page, "Como foi pago", "PIX");
    await page.getByLabel("Data", { exact: true }).fill(`${ANO}-07-15`);
    await page.getByLabel("Comprovante").setInputFiles(png("pix-wk.png"));

    await page
      .getByRole("button", { name: "Salvar pagamento e ligar à nota" })
      .click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    const pagos = await pagamentos(db);
    expect(pagos).toHaveLength(1);
    expect(Number(pagos[0].valor)).toBe(3000);
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagos[0].id, documento_id: documentoId },
    ]);
    // Nada de favorecido novo: o CNPJ que voltou do banco é o mesmo que subiu.
    expect(await favorecidos(db)).toHaveLength(1);
  });

  /**
   * O par que descreve a regra do adendo de 2026-08-18: nascendo LIGADO, o
   * favorecido é herdado e não tem campo; AVULSO, ele é do pagamento e se
   * digita. E o impasse tem saída — "Corrigir na nota" leva à nota, e
   * "Desfazer o vínculo" devolve os campos.
   */
  test("favorecido herdado quando nasce ligado, digitável quando avulso", async ({
    page,
    db,
  }) => {
    const { documentoId } = await cenarioWk(db);

    await page.goto(`/adicionar/pagamento?documento=${documentoId}`);
    await expect(
      page
        .getByRole("group", { name: "Favorecido da nota" })
        .getByText("Favorecido — da NF de serviço de R$ 3.000,00", {
          exact: true,
        }),
    ).toBeVisible();
    // Não existe campo para digitar quem recebeu: nenhum dos dois.
    await expect(page.getByLabel("Favorecido", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("CNPJ / CPF do favorecido")).toHaveCount(0);

    // Saída 1: corrigir na origem.
    //
    // ⚠️ O DESTINO mudou no CONTAI-021 (critério 2). Até 19/08 ele levava a
    // `/documento/[id]`, onde NÃO EXISTIA correção nenhuma — "o usuário clica
    // em Corrigir na nota e chega numa tela que não corrige". Como o link sai
    // da caixa do FAVORECIDO, o destino natural é a correção do nome do
    // emitente; `voltar=pagamento` é o que traz ele de volta para cá com o nome
    // novo.
    await expect(
      page.getByRole("link", { name: "Corrigir na nota" }),
    ).toHaveAttribute(
      "href",
      `/documento/${documentoId}/corrigir/emitente?voltar=pagamento`,
    );

    // Saída 2: sem vínculo o pagamento é avulso, e aí os campos voltam.
    await page
      .getByRole("button", { name: "Desfazer o vínculo antes de salvar" })
      .click();
    await expect(page.getByLabel("Favorecido", { exact: true })).toBeEditable();
    await expect(page.getByLabel("CNPJ / CPF do favorecido")).toBeEditable();

    // Pagamento avulso desde o começo: nunca houve nota para herdar.
    await page.goto("/adicionar/pagamento");
    await expect(page.getByLabel("Favorecido", { exact: true })).toBeEditable();
    await expect(page.getByLabel("CNPJ / CPF do favorecido")).toBeEditable();
    await expect(
      page.getByRole("group", { name: "Favorecido da nota" }),
    ).toHaveCount(0);
  });

  /**
   * CONTAI-032, critério 6 — Data e Meio nascem vazios/nulos agora, e contam
   * como "algo digitado" no impasse de sair para corrigir a nota (o
   * comentário antigo dizia "nascem preenchidos", premissa que este ticket
   * revoga). Sem este teste, a regressão volta pelo mesmo caminho que já
   * existe para Valor/Comprovante.
   */
  test("Data preenchida também conta como 'algo digitado' — o link vira botão com aviso", async ({
    page,
    db,
  }) => {
    const { documentoId } = await cenarioWk(db);

    await page.goto(`/adicionar/pagamento?documento=${documentoId}`);
    // Nada digitado ainda: "Corrigir na nota" é link direto, sem aviso.
    await expect(
      page.getByRole("link", { name: "Corrigir na nota" }),
    ).toBeVisible();

    await escolher(page, "Como foi pago", "PIX");
    await page.getByLabel("Data", { exact: true }).fill(`${ANO}-08-12`);

    // Só Data e Meio preenchidos (Valor continua o sugerido, sem comprovante)
    // já basta: o link vira botão, porque agora há o que perder.
    await expect(
      page.getByRole("link", { name: "Corrigir na nota" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Corrigir na nota" })
      .click();

    await expect(
      page.getByRole("heading", { name: "Sair para corrigir a nota?" }),
    ).toBeVisible();
    await expect(
      page.getByText("não vai ser guardado", { exact: false }),
    ).toBeVisible();
    // O estado grava o valor bruto do rádio ("pix"), não o texto do botão.
    await expect(page.getByText("pix", { exact: true })).toBeVisible();

    // Voltar não perde nada: os campos continuam preenchidos.
    await page
      .getByRole("button", { name: "Continuar o pagamento" })
      .click();
    await expect(page.getByLabel("Data do pagamento")).toHaveValue(
      `${ANO}-08-12`,
    );
  });

  /**
   * ⚠️ A regressão cara desta sugestão: a nota de medição já tem uma parcela
   * paga. Se o campo trouxesse os R$ 3.000 cheios de novo, o Mateus salvaria
   * sem reparar e o custo entraria em dobro — a única direção de erro que gera
   * passivo tributário (parecer §4).
   */
  test("nota com parcela já paga: o valor sugerido é o que FALTA", async ({
    page,
    db,
  }) => {
    // O cenário traz a NF de R$ 3.000 e um PIX de R$ 3.000 SOLTO — ele fica
    // solto de propósito: pagamento não ligado a esta nota não pode entrar no
    // saldo dela.
    const { wk, documentoId, pagamentoId: solto } = await cenarioWk(db);
    const parcela = await criarPagamento(db, {
      favorecido_id: wk,
      valor: 1000,
      data_pagamento: `${ANO}-07-10`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-wk-1.png`,
    });
    await criarVinculo(db, parcela, documentoId);

    await page.goto(`/documento/${documentoId}`);
    await page
      .getByRole("link", { name: "Registrar o pagamento desta nota" })
      .click();

    await expect(page.getByLabel("Valor")).toHaveValue("2.000,00");
    await expect(page.getByText("Vem da nota — falta desta nota.")).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Favorecido da nota" }).getByText(CNPJ_WK),
    ).toBeVisible();

    // CONTAI-032: Meio e Data SEM DEFAULT — o teste escolhe.
    await escolher(page, "Como foi pago", "PIX");
    await page.getByLabel("Data", { exact: true }).fill(`${ANO}-07-15`);
    await page.getByLabel("Comprovante").setInputFiles(png("pix-wk-2.png"));
    await page
      .getByRole("button", { name: "Salvar pagamento e ligar à nota" })
      .click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    // R$ 1.000 + R$ 2.000 = a nota, e não R$ 4.000.
    const ligados = (await vinculos(db)).filter(
      (v) => v.documento_id === documentoId,
    );
    expect(ligados).toHaveLength(2);
    const pagos = await pagamentos(db);
    const soma = ligados
      .map((v) => Number(pagos.find((p) => p.id === v.pagamento_id)!.valor))
      .reduce((a, b) => a + b, 0);
    expect(soma).toBe(3000);
    expect(ligados.map((v) => v.pagamento_id)).not.toContain(solto);
  });
});

/**
 * O caso misto do Gate 2 (B1): um candidato foi ligado POR OUTRA ABA enquanto
 * este seletor estava aberto. Sem `on conflict`, a violação de PK abortava a
 * statement inteira — o novo NÃO entrava, a tela navegava como sucesso e o
 * `conciliado` era gravado sem vínculo por trás. O cenário é montado de
 * verdade: a linha concorrente entra pelo MESMO client autenticado, depois de
 * a tela já ter carregado e marcado os dois.
 */
test.describe("um candidato já ligado por outra aba (B1)", () => {
  test("o novo vínculo entra mesmo com o duplicado na mesma chamada", async ({
    page,
    db,
  }) => {
    const wk = await criarFavorecido(db, {
      nome: "WK Construções LTDA",
      documento: CNPJ_WK_DIGITOS,
      tipo: "pj",
    });
    const documentoId = await criarDocumento(db, {
      favorecido_id: wk,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      valor: 3000,
      retencao_na_nota: "destacada",
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    const pagamentoA = await criarPagamento(db, {
      favorecido_id: wk,
      valor: 1500,
      data_pagamento: `${ANO}-08-10`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-a.png`,
    });
    const pagamentoB = await criarPagamento(db, {
      favorecido_id: wk,
      valor: 1500,
      data_pagamento: `${ANO}-08-11`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-b.png`,
    });

    await page.goto(`/documento/${documentoId}/ligar`);
    const caixas = page.getByRole("checkbox");
    await expect(caixas).toHaveCount(2);
    await caixas.nth(0).check();
    await caixas.nth(1).check();

    // A "outra aba": o A é ligado depois que esta tela já o listou.
    const { error } = await db
      .from("pagamento_documento")
      .insert({ pagamento_id: pagamentoA, documento_id: documentoId });
    expect(error).toBeNull();

    await page.getByRole("button", { name: /Ligar 2 pagamentos/ }).click();
    await expect(page.getByText(/Ligado\./)).toBeVisible();

    // O B TEM de estar no banco: o duplicado do A não pode ter abortado tudo.
    const ligados = (await vinculos(db)).map((v) => v.pagamento_id).sort();
    expect(ligados).toEqual([pagamentoA, pagamentoB].sort());
  });
});

test.describe("caminho a partir do pagamento (critério 3)", () => {
  test("o cartão 'pago sem nota' da fila leva ao seletor inverso", async ({
    page,
    db,
  }) => {
    const { documentoId, pagamentoId } = await cenarioWk(db);

    await page.goto("/pendencias");
    await page.getByRole("link", { name: /Ligar a uma nota/ }).click();

    await expect(page.getByRole("heading", { name: "Pagamento" })).toBeVisible();
    await page.getByRole("link", { name: "Ligar a uma nota" }).click();

    const candidato = page.getByRole("checkbox").first();
    await expect(candidato).not.toBeChecked();
    await candidato.check();
    await page.getByRole("button", { name: "Ligar 1 documento" }).click();

    await expect(page.getByText(/uma despesa só/)).toBeVisible();
    expect(await vinculos(db)).toEqual([
      { pagamento_id: pagamentoId, documento_id: documentoId },
    ]);
  });

  /**
   * P0 do 2º Gate 2: o rodapé deste seletor mostrava a variação da fatia DESTE
   * pagamento, e não a do custo da obra. Sob a repartição cronológica, marcar
   * um pagamento MAIS ANTIGO numa nota já coberta faz ele TOMAR a alocação do
   * posterior — a fatia dele sobe 3.000, o custo da obra sobe 1.000, e a tela
   * anunciava 3.000 contradizendo o "acumulado" da própria linha de baixo.
   *
   * Cenário: NF de 3.000 coberta por um PIX de 2.000 de 12/08, e um PIX de
   * 3.000 de 01/07 a ligar — vínculos FORA da ordem das datas.
   */
  test("nota sobrecoberta: o rodapé mostra o efeito na OBRA, não a fatia do pagamento", async ({
    page,
    db,
  }) => {
    const wk = await criarFavorecido(db, {
      nome: "WK Construções LTDA",
      documento: CNPJ_WK_DIGITOS,
      tipo: "pj",
    });
    const documentoId = await criarDocumento(db, {
      favorecido_id: wk,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      valor: 3000,
      retencao_na_nota: "destacada",
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    const pagamentoNovo = await criarPagamento(db, {
      favorecido_id: wk,
      valor: 2000,
      data_pagamento: `${ANO}-08-12`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-novo.png`,
    });
    const pagamentoAntigo = await criarPagamento(db, {
      favorecido_id: wk,
      valor: 3000,
      data_pagamento: `${ANO}-07-01`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-antigo.png`,
    });
    const { error } = await db
      .from("pagamento_documento")
      .insert({ pagamento_id: pagamentoNovo, documento_id: documentoId });
    expect(error).toBeNull();

    await page.goto(`/pagamento/${pagamentoAntigo}/ligar`);
    const candidato = page.getByRole("checkbox").first();
    await expect(candidato).not.toBeChecked();
    await candidato.check();

    // As DUAS grandezas na tela, cada uma com o seu rótulo. O cartão fala da
    // fatia deste pagamento: ele passa a absorver os 3.000 do conjunto.
    await expect(page.getByText(/Com o que está marcado/)).toContainText(
      "R$ 3.000,00 deste pagamento",
    );
    // O rodapé fala do custo de aquisição do imóvel: 2.000 → 3.000.
    const rodape = page.getByText(/Custo confirmado se ligar agora/);
    await expect(rodape).toContainText(
      // `\s` também entre "R$" e o número: o Intl pt-BR usa NBSP, e regex
      // (ao contrário de string) não passa pela normalização do Playwright.
      /Custo confirmado se ligar agora:\s*R\$\s*1\.000,00/,
    );
    await expect(rodape).toContainText(`${ANO}: R$ 2.000,00 → R$ 3.000,00`);
    await expect(rodape).toContainText("acumulado: R$ 2.000,00 → R$ 3.000,00");

    // ⚠️ O rótulo mudou no CONTAI-074, e o motivo é este cenário mesmo: a nota
    // marcada JÁ está ligada ao PIX de 2.000 (`jaLigadoA.length > 0`, ainda que
    // ela não esteja coberta por inteiro), então o botão pede CONFIRMAÇÃO em vez
    // de dizer "Ligar 1 documento". Fricção deliberada, pre-mortem 2 do ticket.
    await page
      .getByRole("button", {
        name: "Confirmar ligação também a este pagamento — R$ 3.000,00",
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/pagamento/${pagamentoAntigo}$`));

    // A promessa do rodapé conferida contra o número da home: o custo da obra
    // é 3.000, e não os 5.000 que a soma dos dois PIX sugeriria.
    expect(await vinculos(db)).toHaveLength(2);
    await page.goto("/");
    await expect(
      page.getByText(/Custo confirmado em/).locator(".."),
    ).toContainText("3.000,00");
  });
});

/**
 * Critério 12 em 375px (`devices["iPhone SE"]`, viewport do playwright.config).
 * As duas condições que o ticket exige: conteúdo curto e lista longa rolada
 * até o meio. O FAB `sticky` dentro do `Corpo` passava na primeira e pousava
 * sobre o conteúdo na segunda.
 *
 * ⚠️ **CONTAI-040, critério 6 — a porta do canteiro NÃO se perde no pivô
 * desktop.** Nas telas de `(gestao)` o alvo deixou de ser a `BarraAdicionar`
 * do rodapé e passou a ser o "+ Novo registro" da FAIXA estreita, que fica
 * fora da área que rola. *"Pode quebrar o mobile"* autoriza densidade feia;
 * não autoriza o canteiro a perder a entrada de `/adicionar` — e é isso que
 * estes dois testes continuam medindo, no mesmo piso de 375px.
 */
test.describe("acesso a /adicionar (critério 12)", () => {
  test("dashboard com conteúdo curto: o alvo está visível e clicável", async ({
    page,
  }) => {
    await page.goto("/");
    const alvo = page.getByRole("link", { name: "+ Novo registro" });
    await expect(alvo).toBeInViewport();
    await alvo.click();
    await expect(page.getByRole("heading", { name: "Adicionar" })).toBeVisible();
  });

  test("fila longa rolada até o meio: o alvo continua no lugar", async ({
    page,
    db,
  }) => {
    const deposito = await criarFavorecido(db, {
      nome: "Depósito Cachoeira ME",
      documento: CNPJ_DEPOSITO_DIGITOS,
      tipo: "pj",
    });
    for (let i = 1; i <= 8; i++) {
      await criarPagamento(db, {
        favorecido_id: deposito,
        valor: 620 + i,
        data_pagamento: `${ANO}-08-0${i}`,
        meio: "pix",
        status: "aguardando_nf",
        comprovante_path: `${USER_ID_SEED}/comprovante/pix-${i}.png`,
      });
      await criarDocumento(db, {
        favorecido_id: deposito,
        tipo: "nf_material",
        classificacao: "material",
        valor: 100 + i,
        destinatario_cpf_ok: false,
        status: "quarentena",
        motivo_quarentena: "Documento não está no CPF do dono da obra.",
      });
    }

    await page.goto("/pendencias");
    await expect(page.getByText("Quarentena").first()).toBeVisible();

    // Quem rola é o corpo da tela (h-dvh + overflow-y-auto), não a página.
    const corpo = page.getByRole("main");
    await corpo.evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2;
    });

    const alvo = page.getByRole("link", { name: "+ Novo registro" });
    await expect(alvo).toBeInViewport();
    await alvo.click();
    await expect(page.getByRole("heading", { name: "Adicionar" })).toBeVisible();
  });

  /**
   * ⚠️ **O teste acima já nasceu vermelho no CI — 5 runs — e verde no Mac.**
   * A faixa era UM só contêiner `overflow-x-auto` com os 4 links MAIS o "+
   * Novo registro" empurrado por `ml-auto`. Quando o conteúdo estourava a
   * largura (badge de pendências com 2 dígitos somado à fonte de fallback do
   * Linux, um pouco mais larga que a do Mac), o alvo nascia fora da área
   * visível — `scrollLeft: 0` — e só aparecia rolando a faixa na horizontal.
   * Medido: x = 714 num viewport de 320px, `viewport ratio 0`.
   *
   * Este teste é a guarda permanente, e ele mede a ESTRUTURA, não a sorte da
   * fonte: **320px é o proxy determinístico** de "375px com fonte mais larga".
   * Inflar fonte por CSS ou encher a fila de 100 pendências reproduziria o
   * mesmo estouro de forma menos estável e mais cara.
   *
   * O vetor de regressão que ele fecha é um refactor plausível de quem não
   * viveu o incidente: reunir os dois contêineres, ou deixar o badge crescer
   * para 3 dígitos. Por isso a asserção que importa é a (c) — a faixa em si
   * nunca pode ser rolável; quem rola é só o `div` dos 4 links.
   */
  test("320px com badge de 2 dígitos: o alvo não nasce fora da área visível", async ({
    page,
    db,
  }) => {
    const deposito = await criarFavorecido(db, {
      nome: "Depósito Cachoeira ME",
      documento: CNPJ_DEPOSITO_DIGITOS,
      tipo: "pj",
    });
    // ⚠️ O badge NÃO é a contagem de linhas: as pendências de pagamento
    // chegam agrupadas (`PendenciasUnificadas`), então 5 pagamentos + 5
    // documentos dariam **7**, um dígito só, e o cenário não se reproduziria.
    // 5 pagamentos + 8 documentos é o mínimo medido que fecha em **10**.
    for (let i = 1; i <= 5; i++) {
      await criarPagamento(db, {
        favorecido_id: deposito,
        valor: 620 + i,
        data_pagamento: `${ANO}-08-0${i}`,
        meio: "pix",
        status: "aguardando_nf",
        comprovante_path: `${USER_ID_SEED}/comprovante/pix-${i}.png`,
      });
    }
    for (let i = 1; i <= 8; i++) {
      await criarDocumento(db, {
        favorecido_id: deposito,
        tipo: "nf_material",
        classificacao: "material",
        valor: 100 + i,
        destinatario_cpf_ok: false,
        status: "quarentena",
        motivo_quarentena: "Documento não está no CPF do dono da obra.",
      });
    }

    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/pendencias");

    const faixa = page.locator('[data-shell="faixa"]');
    // Pré-condição do cenário, e também a espera que importa: o badge só
    // ocupa largura depois de apurado, e medir antes disso mediria uma faixa
    // mais estreita do que a que o Mateus vê.
    //
    // Se for ESTA linha que ficar vermelha um dia, o que mudou foi o
    // AGRUPAMENTO das pendências, não a faixa: aumente o fixture até o badge
    // voltar a ter 2 dígitos, em vez de mexer no shell.
    await expect(faixa.getByText(/^\d{2}$/)).toBeVisible();

    // (a) Sem rolagem nenhuma antes: o ponto aqui é a faixa não estourar na
    // horizontal já no load — diferente do teste acima, que rola o `main`.
    const alvo = page.getByRole("link", { name: "+ Novo registro" });
    await expect(alvo).toBeInViewport();

    // (b) Visível de verdade, não "visível pela metade": a borda direita do
    // alvo cabe dentro do viewport.
    const caixa = await alvo.boundingBox();
    expect(caixa).not.toBeNull();
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(320);

    // (c) A faixa INTEIRA nunca é rolável. É esta asserção que fica vermelha
    // no dia em que alguém devolver o "+ Novo registro" para dentro da área
    // que rola.
    const faixaRola = await faixa.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(faixaRola).toBe(false);

    // (d) Quem rola é só o `div` dos 4 links — e o alvo não depende disso:
    // com o scroll intocado no zero, ele já está onde deveria.
    const rolavel = faixa.locator("> div");
    expect(await rolavel.evaluate((el) => el.scrollLeft)).toBe(0);

    // (e) E abre.
    await alvo.click();
    await expect(page.getByRole("heading", { name: "Adicionar" })).toBeVisible();
  });

  /**
   * ⚠️ **CONTAI-043 — o alvo mudou de nome aqui também, e pelo mesmo motivo
   * do dashboard.** `/documento/[id]` saiu de `(captura)` e entrou no shell de
   * gestão: a `BarraAdicionar` do rodapé não existe mais nesta tela, e a porta
   * de `/adicionar` é o "+ Novo registro" da faixa estreita — que fica FORA da
   * área que rola. O que o teste mede continua sendo o mesmo: no piso de
   * 375px, a entrada do canteiro está visível e abre.
   */
  test("/adicionar é alcançável a partir de /documento/[id]", async ({
    page,
    db,
  }) => {
    const { documentoId } = await cenarioWk(db);
    await page.goto(`/documento/${documentoId}`);

    const alvo = page.getByRole("link", { name: "+ Novo registro" });
    await expect(alvo).toBeInViewport();
    await alvo.click();
    await expect(page.getByRole("heading", { name: "Adicionar" })).toBeVisible();
  });

  /**
   * ⚠️ **CONTAI-044 — mesma migração, mesmo motivo.** `/pagamento/[id]` saiu
   * de `(captura)` e entrou no shell de gestão: o alvo também virou "+ Novo
   * registro".
   */
  test("/adicionar é alcançável a partir de /pagamento/[id]", async ({
    page,
    db,
  }) => {
    const { pagamentoId } = await cenarioWk(db);
    await page.goto(`/pagamento/${pagamentoId}`);

    const alvo = page.getByRole("link", { name: "+ Novo registro" });
    await expect(alvo).toBeInViewport();
    await alvo.click();
    await expect(page.getByRole("heading", { name: "Adicionar" })).toBeVisible();
  });
});

/**
 * Critério 11 pela porta do banco: a policy `dono_vinculo` só exige mesmo
 * DONO, então o Postgres ACEITA um vínculo entre duas obras do próprio Mateus.
 * Quem impede é o código — e o teste registra que a proteção é essa, não a do
 * banco, para o dia em que alguém achar que a RLS cobre este caso.
 */
test.describe("vínculo entre obras (critério 11)", () => {
  test("o banco aceitaria; o seletor não oferece o registro da outra obra", async ({
    page,
    db,
  }) => {
    const { data, error } = await db
      .from("obra")
      .insert({ nome: "Casa do Morro", data_inicio_obra: "2026-03-15" })
      .select("id")
      .single();
    expect(error).toBeNull();
    const outraObra = data!.id;

    const wk = await criarFavorecido(db, {
      nome: "WK Construções LTDA",
      documento: CNPJ_WK_DIGITOS,
      tipo: "pj",
    });
    const documentoId = await criarDocumento(db, {
      obra_id: OBRA_ID_SEED,
      favorecido_id: wk,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      valor: 3000,
      retencao_na_nota: "destacada",
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    // Pagamento de MESMO favorecido e MESMO valor — seria a "sugestão" nº 1 se
    // a obra não contasse.
    await criarPagamento(db, {
      obra_id: outraObra,
      favorecido_id: wk,
      valor: 3000,
      data_pagamento: `${ANO}-08-12`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-outra.png`,
    });

    await page.goto(`/documento/${documentoId}/ligar`);
    await expect(page.getByText("Nenhum pagamento para ligar")).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });
});

/**
 * **CONTAI-072 — a nota hábil sem pagamento que já tem agendamento aberto.**
 *
 * O defeito que estes testes trancam é de LEITURA, e foi achado no banco de
 * produção: três notas com compra no cartão já agendada apareciam no painel
 * "Notas hábeis sem pagamento vinculado" com o CTA "Ligar a um pagamento",
 * exatamente iguais a uma nota sem rastro nenhum — e ao mesmo tempo na Agenda,
 * com o mesmo favorecido e o mesmo valor.
 *
 * ⚠️ **O que NÃO pode acontecer é a nota sair da lista ou da soma** (Gate
 * Fiscal do ticket): compromisso não é pagamento e pode ser cancelado. Por isso
 * a soma do painel é conferida em todos os três sub-estados, e é a primeira
 * asserção de cada um.
 */
test.describe("CONTAI-072 — nota com compromisso aberto vinculado", () => {
  const PAINEL = '[data-painel="notas-sem-pagamento"]';

  /** ISO de hoje no fuso do aparelho — o mesmo `hojeIso()` que o app usa. */
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

  function dataBR(iso: string): string {
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  /** A NF de R$ 3.000 da WK, hábil e sem pagamento nenhum ligado. */
  async function notaSemPagamento(db: Db) {
    const wk = await criarFavorecido(db, {
      nome: "WK Construções LTDA",
      documento: CNPJ_WK_DIGITOS,
      tipo: "pj",
    });
    const documentoId = await criarDocumento(db, {
      favorecido_id: wk,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      valor: 3000,
      retencao_na_nota: "destacada",
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    return { wk, documentoId };
  }

  test("sem compromisso: o painel continua exatamente como era", async ({
    page,
    db,
  }) => {
    await notaSemPagamento(db);
    await page.goto("/");

    const painel = page.locator(PAINEL);
    await expect(painel).toContainText("R$ 3.000,00");
    await expect(
      painel.getByText("Sem pagamento ligado", { exact: true }),
    ).toBeVisible();
    await expect(
      painel.getByRole("link", { name: "Ligar a um pagamento" }),
    ).toBeVisible();
    await expect(painel.getByText("Agendado")).toHaveCount(0);
  });

  test("agendado DENTRO DO PRAZO: 'Agendado' e 'Ver agendamento', sem perder a soma", async ({
    page,
    db,
  }) => {
    const { wk, documentoId } = await notaSemPagamento(db);
    const prevista = maisDias(20);
    const compromissoId = await criarCompromisso(db, {
      favorecido_id: wk,
      valor_previsto: 3000,
      data_prevista: prevista,
      origem: "cartao",
      // A compra no cartão exige `data_compra` (CHECK da migration 0013): dado
      // probatório, e nunca o que decide ano-calendário.
      data_compra: maisDias(-30),
      documento_origem_id: documentoId,
    });

    await page.goto("/");
    const painel = page.locator(PAINEL);

    // ⚠️ PRIMEIRO o número: a nota continua na lista e na soma.
    await expect(painel).toContainText("R$ 3.000,00");
    await expect(
      painel.getByText("NF de serviço sem pagamento ligado"),
    ).toBeVisible();

    // Chip e resumo são os MESMOS textos da Agenda — nada foi redigido de novo.
    await expect(painel.getByText("Agendado", { exact: true })).toBeVisible();
    await expect(painel).toContainText(
      `WK Construções LTDA — previsto R$ 3.000,00 para ${dataBR(prevista)}`,
    );

    // O CTA enganoso sai de cena, e o link leva para a ÚNICA casa de ação.
    await expect(
      painel.getByRole("link", { name: "Ligar a um pagamento" }),
    ).toHaveCount(0);
    const ver = painel.getByRole("link", { name: "Ver agendamento" });
    await expect(ver).toHaveAttribute("href", `/compromisso/${compromissoId}`);

    // Dentro do prazo não há consequência extra: nada venceu.
    await expect(painel.getByText(VENCIDO_SEM_RESPOSTA)).toHaveCount(0);

    await ver.click();
    await expect(page).toHaveURL(new RegExp(`/compromisso/${compromissoId}$`));
  });

  test("agendado VENCIDO SEM RESPOSTA: escala o texto, e o CTA é responder", async ({
    page,
    db,
  }) => {
    const { wk, documentoId } = await notaSemPagamento(db);
    const prevista = maisDias(-8);
    const compromissoId = await criarCompromisso(db, {
      favorecido_id: wk,
      valor_previsto: 3000,
      data_prevista: prevista,
      origem: "cartao",
      // A compra no cartão exige `data_compra` (CHECK da migration 0013): dado
      // probatório, e nunca o que decide ano-calendário.
      data_compra: maisDias(-30),
      documento_origem_id: documentoId,
    });

    await page.goto("/");
    const painel = page.locator(PAINEL);

    await expect(painel).toContainText("R$ 3.000,00");
    // O chip NOMEIA o vencimento e o silêncio — não é um "Agendado" mudo.
    await expect(painel).toContainText(
      `Venceu em ${dataBR(prevista)} · 8 dias sem resposta`,
    );
    // ⚠️ O texto NÃO suaviza: este estado já trava a geração de qualquer
    // relatório anual, e quem diz isso é a constante do adendo §A.
    await expect(painel.getByText(VENCIDO_SEM_RESPOSTA)).toBeVisible();

    const responder = painel.getByRole("link", {
      name: "Responder agendamento",
    });
    await expect(responder).toHaveAttribute(
      "href",
      `/compromisso/${compromissoId}`,
    );
    await expect(
      painel.getByRole("link", { name: "Ligar a um pagamento" }),
    ).toHaveCount(0);

    // ⚠️ Critério 7 — as três respostas NÃO se duplicam no painel da nota; elas
    // moram no cartão do vencido (Agenda) e na tela do agendamento.
    await expect(painel.getByRole("link", { name: "Foi pago" })).toHaveCount(0);
    await expect(
      painel.getByRole("link", { name: "Mudou a data" }),
    ).toHaveCount(0);

    await responder.click();
    await expect(page.getByRole("link", { name: "Foi pago" })).toBeVisible();
  });

  test("agendamento CANCELADO devolve a nota ao estado de sempre (critério 5)", async ({
    page,
    db,
  }) => {
    const { wk, documentoId } = await notaSemPagamento(db);
    await criarCompromisso(db, {
      favorecido_id: wk,
      valor_previsto: 3000,
      data_prevista: maisDias(-8),
      origem: "cartao",
      // A compra no cartão exige `data_compra` (CHECK da migration 0013): dado
      // probatório, e nunca o que decide ano-calendário.
      data_compra: maisDias(-30),
      documento_origem_id: documentoId,
      situacao: "cancelado",
      motivo_cancelamento: "cartão não passou",
    });

    await page.goto("/");
    const painel = page.locator(PAINEL);
    await expect(painel).toContainText("R$ 3.000,00");
    await expect(
      painel.getByText("Sem pagamento ligado", { exact: true }),
    ).toBeVisible();
    await expect(
      painel.getByRole("link", { name: "Ligar a um pagamento" }),
    ).toBeVisible();
    await expect(painel.getByText(VENCIDO_SEM_RESPOSTA)).toHaveCount(0);
  });

  /**
   * **CONTAI-075 — o painel da nota herda os estados novos da MESMA fonte.**
   *
   * ⚠️ O que estes dois testes trancam é o critério 5: o painel não recalcula
   * "é hoje/é amanhã" — ele lê `agendamentosPorDocumento`, a função que a Agenda
   * também lê. Duas derivações de "hoje" divergiriam por fuso, e o Mateus veria
   * a mesma nota urgente num lugar e mansa no outro.
   */
  test("CONTAI-075 — nota cujo agendamento vence HOJE: 'Vence hoje', sem cobrança", async ({
    page,
    db,
  }) => {
    const { wk, documentoId } = await notaSemPagamento(db);
    const compromissoId = await criarCompromisso(db, {
      favorecido_id: wk,
      valor_previsto: 3000,
      data_prevista: hoje(),
      origem: "cartao",
      data_compra: maisDias(-30),
      documento_origem_id: documentoId,
    });

    await page.goto("/");
    const painel = page.locator(PAINEL);

    // ⚠️ PRIMEIRO o número: o Gate Fiscal vale igual nos estados novos — a nota
    // continua inteira na lista e na soma, porque compromisso não é pagamento.
    await expect(painel).toContainText("R$ 3.000,00");

    const chip = painel.locator("[data-urgencia='vence_hoje']");
    await expect(chip).toHaveText("Vence hoje");
    await expect(painel).toContainText(
      `WK Construções LTDA — previsto R$ 3.000,00 para ${dataBR(hoje())}`,
    );

    // ⚠️ Critério 13 — nenhuma consequência nova, nenhuma promessa de bloqueio:
    // isso é exclusivo do vencido, e nada saiu da conta aqui.
    await expect(painel.getByText(VENCIDO_SEM_RESPOSTA)).toHaveCount(0);
    await expect(
      painel.getByRole("link", { name: "Ver agendamento" }),
    ).toHaveAttribute("href", `/compromisso/${compromissoId}`);
    await expect(
      painel.getByRole("link", { name: "Responder agendamento" }),
    ).toHaveCount(0);

    // O peso fica ABAIXO do preenchido do vencido: borda de 2px, fundo
    // transparente (condição de hierarquia do Gate Fiscal).
    await expect(chip).toHaveCSS("border-top-width", "2px");
    await expect(chip).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  });

  test("CONTAI-075 — vence AMANHÃ: texto próprio, peso igual ao de hoje", async ({
    page,
    db,
  }) => {
    const { wk, documentoId } = await notaSemPagamento(db);
    await criarCompromisso(db, {
      favorecido_id: wk,
      valor_previsto: 3000,
      data_prevista: maisDias(1),
      origem: "cartao",
      data_compra: maisDias(-30),
      documento_origem_id: documentoId,
    });

    await page.goto("/");
    const chip = page.locator(PAINEL).locator("[data-urgencia='vence_amanha']");
    await expect(chip).toHaveText("Vence amanhã");
    // Um peso intermediário só: quem distingue amanhã de hoje é a palavra.
    await expect(chip).toHaveCSS("border-top-width", "2px");
  });

  test("CONTAI-075 — daqui a 20 dias continua 'Agendado', vazado de 1px", async ({
    page,
    db,
  }) => {
    // Sem regressão fora da janela de dois graus (critério 3).
    const { wk, documentoId } = await notaSemPagamento(db);
    await criarCompromisso(db, {
      favorecido_id: wk,
      valor_previsto: 3000,
      data_prevista: maisDias(20),
      origem: "cartao",
      data_compra: maisDias(-30),
      documento_origem_id: documentoId,
    });

    await page.goto("/");
    const chip = page.locator(PAINEL).locator("[data-urgencia='comum']");
    await expect(chip).toHaveText("Agendado");
    await expect(chip).toHaveCSS("border-top-width", "1px");
  });
});

/**
 * **CONTAI-074** — o mesmo pagamento (ou a mesma nota) ligado a mais de um
 * documento. Caso real: fornecedor de concreto que faturou em 3 notas pagas por
 * 7 lançamentos, sem correspondência 1:1 — a parcela já 100% absorvida pela
 * Nota A não aparecia como candidata na Nota B, e não havia caminho nenhum.
 *
 * O que estes dois testes provam, além de a tela revelar o candidato: que
 * **ligar não dobra custo**. É o teto do mínimo por componente conexo
 * (`min(Σ pagamentos elegíveis, Σ documentos hábeis)`) conferido contra o número
 * da home, do jeito que o ADENDO de 2026-09-28 do parecer o descreve — o
 * pagamento é um NÓ, entra uma vez, quantas arestas partam dele.
 */
test.describe("segundo vínculo de um registro já coberto (CONTAI-074)", () => {
  /**
   * O NÚMERO do KPI de custo confirmado, não o cartão dele. O cartão traz
   * "acumulado" e "gasto real até agora" na mesma caixa, e um `not.toContainText`
   * ali daria falso negativo com um valor que é legítimo em outra linha.
   */
  const custoConfirmadoDaHome = (page: Page) =>
    page.locator('[data-kpi="custo-confirmado"] .mono').first();

  /** Duas notas do mesmo fornecedor, e um PIX que já cobre a primeira inteira. */
  async function duasNotasUmPix(db: Db) {
    const wk = await criarFavorecido(db, {
      nome: "WK Construções LTDA",
      documento: CNPJ_WK_DIGITOS,
      tipo: "pj",
    });
    const notaA = await criarDocumento(db, {
      favorecido_id: wk,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      numero: "1042",
      valor: 3000,
      retencao_na_nota: "destacada",
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    const notaB = await criarDocumento(db, {
      favorecido_id: wk,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      numero: "1043",
      valor: 3000,
      retencao_na_nota: "destacada",
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    const pix = await criarPagamento(db, {
      favorecido_id: wk,
      valor: 3000,
      data_pagamento: `${ANO}-08-12`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-wk.png`,
    });
    await criarVinculo(db, pix, notaA);
    return { wk, notaA, notaB, pix };
  }

  test("revela o pagamento já coberto, liga-o à segunda nota e o custo NÃO dobra", async ({
    page,
    db,
  }) => {
    const { notaA, notaB, pix } = await duasNotasUmPix(db);

    // O ponto de partida: o custo da obra é R$ 3.000 (um PIX, uma nota).
    await page.goto("/");
    await expect(
      page.getByText(/Custo confirmado em/).locator(".."),
    ).toContainText("3.000,00");

    await page.goto(`/documento/${notaB}/ligar`);

    // ── Estado colapsado: a lista visível está VAZIA e o card vazio continua ──
    await expect(page.getByText("Nenhum pagamento para ligar")).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    // O texto novo: cobertura prévia deixou de significar "engano a desfazer".
    await expect(page.getByText(CANDIDATO_OCULTO_PAGAMENTO)).toBeVisible();

    const revelar = page.getByRole("button", {
      name: "Mostrar 1 pagamento já coberto",
    });
    await expect(revelar).toBeVisible();
    // Nada foi gravado por abrir a tela, nem por ela oferecer o revelar.
    expect(await vinculos(db)).toHaveLength(1);

    await revelar.click();

    // ── Revelado: o candidato entra na MESMA lista de checkboxes, desmarcado ──
    const candidato = page.getByRole("checkbox");
    await expect(candidato).toHaveCount(1);
    await expect(candidato).not.toBeChecked();
    // A marca sempre visível (ADENDO §2b, MARCAR): chip + a quem já está ligado.
    await expect(page.getByText("Coberto por inteiro")).toBeVisible();
    await expect(
      page.getByText("já ligado a: NF de serviço nº 1042 — R$ 3.000,00"),
    ).toBeVisible();
    // Revelar não esconde de novo: não existe botão de recolher.
    await expect(revelar).toHaveCount(0);

    // ── O aviso (b), colado no item, só depois do toque ──
    const aviso = avisoPagamentoJaLigado("NF de serviço nº 1042 — R$ 3.000,00");
    await expect(page.getByText(aviso)).toHaveCount(0);
    await candidato.check();
    await expect(page.getByText(aviso)).toBeVisible();

    // ── O rodapé: acréscimo R$ 0,00, e a razão CERTA para o zero ──
    const rodape = page.getByText(/Custo confirmado se ligar agora/);
    await expect(rodape).toContainText(
      /Custo confirmado se ligar agora:\s*R\$\s*0,00/,
    );
    await expect(rodape).toContainText(VINCULO_SO_MUDA_A_PROVA);
    // E NÃO o zero da nota não hábil, que é outra causa e outro texto.
    await expect(rodape).not.toContainText("a nota não é hábil");

    // ── O rótulo do botão troca de verbo: confirmação, não "Ligar N" ──
    await expect(
      page.getByRole("button", { name: /^Ligar 1 pagamento/ }),
    ).toHaveCount(0);
    await page
      .getByRole("button", {
        name: "Confirmar ligação também a esta nota — R$ 3.000,00",
      })
      .click();

    await expect(page.getByText(/Ligado\./)).toBeVisible();

    // ── O ESTADO GRAVADO: vínculo NOVO, e o antigo INTACTO (critério 7) ──
    const linhas = await vinculos(db);
    expect(linhas).toHaveLength(2);
    expect(linhas.map((v) => v.documento_id).sort()).toEqual(
      [notaA, notaB].sort(),
    );
    expect(linhas.every((v) => v.pagamento_id === pix)).toBe(true);

    // A nota de origem continua provando o que provava.
    await page.goto(`/documento/${notaA}`);
    await expect(page.getByText("Custo comprovado")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver o pagamento" })).toHaveCount(1);

    // ⚠️ O QUE O TICKET EXISTE PARA GARANTIR: o custo continua R$ 3.000. A soma
    // ingênua dos dois vínculos daria R$ 6.000 — custo em dobro na declaração.
    // A asserção é no NÚMERO do KPI, não no cartão inteiro: o cartão traz outras
    // linhas ("gasto real", acumulado) que contêm outros valores.
    await page.goto("/");
    await expect(custoConfirmadoDaHome(page)).toHaveText("R$ 3.000,00");
  });

  test("espelhado: a nota já coberta, revelada a partir de um segundo pagamento", async ({
    page,
    db,
  }) => {
    const { wk, notaA, pix } = await duasNotasUmPix(db);
    // Um SEGUNDO pagamento real, distinto — é a direção em que dois
    // desembolsos provam a MESMA nota.
    const segundoPix = await criarPagamento(db, {
      favorecido_id: wk,
      valor: 1000,
      data_pagamento: `${ANO}-09-02`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix-2.png`,
    });

    await page.goto(`/pagamento/${segundoPix}/ligar`);

    // A nota B (sem pagamento nenhum) é candidata normal; a nota A está coberta
    // por inteiro e só aparece depois do revelar.
    await expect(page.getByRole("checkbox")).toHaveCount(1);
    await expect(page.getByText(CANDIDATO_OCULTO_DOCUMENTO)).toBeVisible();
    await page
      .getByRole("button", { name: "Mostrar 1 nota já coberta" })
      .click();

    const caixas = page.getByRole("checkbox");
    await expect(caixas).toHaveCount(2);
    // A revelada vem anexada ao FIM da lista visível.
    const revelada = caixas.nth(1);
    await expect(revelada).not.toBeChecked();
    await expect(page.getByText("Coberta por inteiro")).toBeVisible();
    const identificacao = `12/08/${ANO} · WK Construções LTDA — R$ 3.000,00`;
    await expect(page.getByText(`já ligada a: ${identificacao}`)).toBeVisible();

    await revelada.check();

    // ⚠️ A GARANTIA DESTA DIREÇÃO É A DA NOTA, não a do pagamento — correção do
    // `contador` no fechamento do ticket. O texto vem da constante da tela.
    const aviso = avisoDocumentoJaLigado(identificacao);
    await expect(page.getByText(aviso)).toBeVisible();
    expect(aviso).toContain("nunca conta a mesma nota duas vezes na soma do custo");
    // E o texto da OUTRA direção não aparece aqui.
    await expect(
      page.getByText(/nunca conta o mesmo pagamento duas vezes/),
    ).toHaveCount(0);

    const rodape = page.getByText(/Custo confirmado se ligar agora/);
    await expect(rodape).toContainText(
      /Custo confirmado se ligar agora:\s*R\$\s*0,00/,
    );
    await expect(rodape).toContainText(VINCULO_SO_MUDA_A_PROVA);

    await page
      .getByRole("button", {
        name: "Confirmar ligação também a este pagamento — R$ 3.000,00",
      })
      .click();

    await expect(page).toHaveURL(new RegExp(`/pagamento/${segundoPix}$`));

    // Os dois vínculos da nota A vivos: o PIX de 3.000 e o de 1.000.
    const daNotaA = (await vinculos(db))
      .filter((v) => v.documento_id === notaA)
      .map((v) => v.pagamento_id)
      .sort();
    expect(daNotaA).toEqual([pix, segundoPix].sort());

    // O teto do mínimo: Σ pagamentos = 4.000, Σ notas hábeis do componente =
    // 3.000 (a nota A). O custo é 3.000 — a nota NÃO conta duas vezes.
    //
    // ⚠️ A asserção é no número do KPI, e não no cartão: R$ 4.000,00 aparece
    // LEGITIMAMENTE logo abaixo, na linha "gasto real até agora" (que conta
    // desembolso, não custo demonstrável). Era o falso negativo desta prova.
    await page.goto("/");
    await expect(custoConfirmadoDaHome(page)).toHaveText("R$ 3.000,00");
  });
});

test.describe("busca na lista de candidatos (CONTAI-078)", () => {
  const CNPJ_ILHAMIX = "22333444000195";
  const CNPJ_ELETRICA = "33444555000176";
  const CPF_JOSE = "52998224725";

  /**
   * A lista LONGA do relato, em miniatura: 7 candidatos a pagamento — 5 livres
   * e 2 já cobertos por inteiro. Sete porque o campo só existe acima de 5
   * (critério 4), e os 2 cobertos porque o N do "Mostrar N…" tem de reagir ao
   * filtro sem o bloco se abrir sozinho (critérios 7 e 8).
   */
  async function seteCandidatosDePagamento(db: Db) {
    const ilhamix = await criarFavorecido(db, {
      nome: "Ilhamix Concreto LTDA",
      documento: CNPJ_ILHAMIX,
      tipo: "pj",
    });
    const wk = await criarFavorecido(db, {
      nome: "WK Construções LTDA",
      documento: CNPJ_WK_DIGITOS,
      tipo: "pj",
    });
    const deposito = await criarFavorecido(db, {
      nome: "Depósito Santa Rita",
      documento: CNPJ_DEPOSITO_DIGITOS,
      tipo: "pj",
    });
    // Nome COM diacrítico de propósito: quem digita no celular digita "jose".
    const jose = await criarFavorecido(db, {
      nome: "José Peçanha",
      documento: CPF_JOSE,
      tipo: "pf",
    });
    const eletrica = await criarFavorecido(db, {
      nome: "Elétrica Bom Jesus LTDA",
      documento: CNPJ_ELETRICA,
      tipo: "pj",
    });

    /** A nota da tela: mesmo favorecido e mesmo valor do primeiro candidato. */
    const alvo = await criarDocumento(db, {
      favorecido_id: ilhamix,
      tipo: "nf_material",
      classificacao: "material",
      numero: "1042",
      valor: 16240,
      destinatario_cpf_ok: true,
      status: "registrado",
    });

    const pagar = (favorecido: string, valor: number, dia: string) =>
      criarPagamento(db, {
        favorecido_id: favorecido,
        valor,
        data_pagamento: `${ANO}-08-${dia}`,
        meio: "pix",
        status: "aguardando_nf",
        // Comprovante em TODOS: pagamento sem comprovante tem elegível zero, e
        // aí ele nasceria "coberto por inteiro" por outro motivo — o cenário
        // deixaria de provar o que quer provar.
        comprovante_path: `${USER_ID_SEED}/comprovante/p-${favorecido}-${valor}.png`,
      });

    // Os 5 livres.
    await pagar(ilhamix, 16240, "02");
    await pagar(ilhamix, 500, "03");
    await pagar(wk, 3000, "04");
    await pagar(deposito, 1200, "05");
    await pagar(jose, 700, "06");

    // Os 2 já cobertos por inteiro, os dois da Elétrica.
    for (const [numero, valor] of [
      ["3312", 9100],
      ["3313", 8200],
    ] as const) {
      const nota = await criarDocumento(db, {
        favorecido_id: eletrica,
        tipo: "nf_servico",
        classificacao: "mao_obra",
        numero,
        valor,
        retencao_na_nota: "nenhuma",
        destinatario_cpf_ok: true,
        status: "registrado",
      });
      await criarVinculo(db, await pagar(eletrica, valor, "07"), nota);
    }

    return { alvo };
  }

  const buscaDePagamentos = (page: Page) =>
    page.getByRole("textbox", { name: "Buscar pagamentos" });

  test("filtra por favorecido e por valor, sem reordenar e sem tocar no marcado", async ({
    page,
    db,
  }) => {
    const { alvo } = await seteCandidatosDePagamento(db);
    await page.goto(`/documento/${alvo}/ligar`);

    const busca = buscaDePagamentos(page);
    await expect(busca).toBeVisible();
    await expect(busca).toHaveAttribute(
      "placeholder",
      "Buscar por favorecido ou valor…",
    );
    // Nasce vazio: nenhum filtro presumido (e nenhum candidato escondido).
    await expect(busca).toHaveValue("");
    await expect(page.getByRole("checkbox")).toHaveCount(5);

    // ── Favorecido, substring, sem caixa ──
    await busca.fill("ilhamix");
    await expect(page.getByRole("checkbox")).toHaveCount(2);
    // ⚠️ Critério 6: a ORDEM dentro do filtrado é a de sempre — o de mesmo
    // valor primeiro, como vinha da ordenação do módulo puro.
    const itens = page.locator("label");
    await expect(itens.nth(0)).toContainText("R$ 16.240,00");
    await expect(itens.nth(1)).toContainText("R$ 500,00");

    // ── Valor, pelos dígitos, nas duas formas que ele digita ──
    await busca.fill("16240");
    await expect(page.getByRole("checkbox")).toHaveCount(1);
    await expect(page.locator("label").first()).toContainText("R$ 16.240,00");
    await busca.fill("16.240,00");
    await expect(page.getByRole("checkbox")).toHaveCount(1);

    // ── Sem diacrítico: "jose pecanha" acha "José Peçanha" ──
    await busca.fill("jose pecanha");
    await expect(page.getByRole("checkbox")).toHaveCount(1);
    await expect(page.locator("label").first()).toContainText("José Peçanha");

    // Marcar com o filtro ligado continua valendo: é o fluxo do relato (achar o
    // pagamento numa lista longa e ligá-lo).
    await page.getByRole("checkbox").check();
    await expect(
      page.getByRole("button", { name: "Ligar 1 pagamento — R$ 700,00" }),
    ).toBeVisible();

    // Limpar devolve os 5, e nada foi gravado por filtrar.
    await busca.fill("");
    await expect(page.getByRole("checkbox")).toHaveCount(5);
    expect(await vinculos(db)).toHaveLength(2);
  });

  test("com 5 candidatos ou menos o campo não existe (critério 4)", async ({
    page,
    db,
  }) => {
    const ilhamix = await criarFavorecido(db, {
      nome: "Ilhamix Concreto LTDA",
      documento: CNPJ_ILHAMIX,
      tipo: "pj",
    });
    const alvo = await criarDocumento(db, {
      favorecido_id: ilhamix,
      tipo: "nf_material",
      classificacao: "material",
      numero: "1042",
      valor: 16240,
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    for (let i = 1; i <= 5; i += 1) {
      await criarPagamento(db, {
        favorecido_id: ilhamix,
        valor: 100 * i,
        data_pagamento: `${ANO}-08-0${i}`,
        meio: "pix",
        status: "aguardando_nf",
        comprovante_path: `${USER_ID_SEED}/comprovante/p${i}.png`,
      });
    }

    await page.goto(`/documento/${alvo}/ligar`);
    await expect(page.getByRole("checkbox")).toHaveCount(5);
    // Cinco linhas se leem de uma vez; um campo de busca aqui seria só ruído.
    await expect(buscaDePagamentos(page)).toHaveCount(0);
  });

  test("vazio-por-filtro é OUTRO estado: sem a consequência fiscal do vazio-de-verdade", async ({
    page,
    db,
  }) => {
    const { alvo } = await seteCandidatosDePagamento(db);
    await page.goto(`/documento/${alvo}/ligar`);

    await buscaDePagamentos(page).fill("zzz");

    // (a) Nada bate em lugar nenhum.
    await expect(page.getByText('Nada encontrado para "zzz"')).toBeVisible();
    await expect(
      page.getByText(
        "Nenhum pagamento desta obra combina com esse texto. Confira a grafia ou tente um valor diferente.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    // A lista nem se anuncia: não há "Pagamentos desta obra" vazio embaixo.
    await expect(page.getByText("Pagamentos desta obra")).toHaveCount(0);

    // ⚠️ O CORAÇÃO DO CRITÉRIO 10: o card de vazio-de-VERDADE, com a frase de
    // custo fora do Custo confirmado, NÃO aparece. Ele afirma que não existe
    // pagamento a ligar nesta obra — e existem cinco; quem não achou foi a
    // busca.
    await expect(page.getByText("Nenhum pagamento para ligar")).toHaveCount(0);
    await expect(
      page.getByText(/ficam fora do\s*Custo confirmado/),
    ).toHaveCount(0);

    // "Limpar busca" devolve a lista e não revela os cobertos.
    await page.getByRole("button", { name: "Limpar busca" }).click();
    await expect(buscaDePagamentos(page)).toHaveValue("");
    await expect(page.getByRole("checkbox")).toHaveCount(5);
    await expect(
      page.getByRole("button", { name: "Mostrar 2 pagamentos já cobertos" }),
    ).toBeVisible();
  });

  test("o vazio-de-VERDADE continua aparecendo, com a consequência, e a busca não o move", async ({
    page,
    db,
  }) => {
    // Obra em que TODO candidato está coberto por inteiro: a lista visível nasce
    // vazia por um fato da obra, não por filtro.
    const eletrica = await criarFavorecido(db, {
      nome: "Elétrica Bom Jesus LTDA",
      documento: CNPJ_ELETRICA,
      tipo: "pj",
    });
    const alvo = await criarDocumento(db, {
      favorecido_id: eletrica,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      numero: "4000",
      valor: 1000,
      retencao_na_nota: "nenhuma",
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    for (let i = 1; i <= 6; i += 1) {
      const nota = await criarDocumento(db, {
        favorecido_id: eletrica,
        tipo: "nf_servico",
        classificacao: "mao_obra",
        numero: `50${i}`,
        valor: 100 * i,
        retencao_na_nota: "nenhuma",
        destinatario_cpf_ok: true,
        status: "registrado",
      });
      const pago = await criarPagamento(db, {
        favorecido_id: eletrica,
        valor: 100 * i,
        data_pagamento: `${ANO}-08-0${i}`,
        meio: "pix",
        status: "aguardando_nf",
        comprovante_path: `${USER_ID_SEED}/comprovante/c${i}.png`,
      });
      await criarVinculo(db, pago, nota);
    }

    await page.goto(`/documento/${alvo}/ligar`);

    // O card estrutural, com a consequência fiscal — é o de hoje, intacto.
    await expect(page.getByText("Nenhum pagamento para ligar")).toBeVisible();
    await expect(page.getByText(/ficam fora do\s*Custo confirmado/)).toBeVisible();

    // Com termo digitado ele NÃO troca pelo card de filtro: a ausência de
    // candidato livre é verdade da obra, e continua sendo dita do mesmo jeito.
    await buscaDePagamentos(page).fill("zzz");
    await expect(page.getByText("Nenhum pagamento para ligar")).toBeVisible();
    await expect(page.getByText('Nada encontrado para "zzz"')).toHaveCount(0);
    // E o bloco de cobertos some por completo — nunca "Mostrar 0…".
    await expect(page.getByRole("button", { name: /^Mostrar / })).toHaveCount(0);
  });

  test("o N de 'Mostrar N já cobertos' reage ao filtro, e o bloco continua colapsado", async ({
    page,
    db,
  }) => {
    const { alvo } = await seteCandidatosDePagamento(db);
    await page.goto(`/documento/${alvo}/ligar`);

    const busca = buscaDePagamentos(page);
    await expect(
      page.getByRole("button", { name: "Mostrar 2 pagamentos já cobertos" }),
    ).toBeVisible();

    // ── Filtro que só bate entre os COBERTOS: o bloco NÃO se abre sozinho ──
    await busca.fill("eletrica");
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(
      page.getByText('Nada encontrado para "eletrica" nos pagamentos livres'),
    ).toBeVisible();
    // O texto manda abrir o bloco — não abre por ele.
    await expect(
      page.getByText(/Pode estar entre os 2 já ligados a outra nota/),
    ).toBeVisible();
    const doisCobertos = page.getByRole("button", {
      name: "Mostrar 2 pagamentos já cobertos",
    });
    await expect(doisCobertos).toBeVisible();
    await expect(page.getByText(CANDIDATO_OCULTO_PAGAMENTO)).toBeVisible();

    // ── O N vem do subconjunto filtrado: 2 → 1, no singular ──
    await busca.fill("9100");
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    const umCoberto = page.getByRole("button", {
      name: "Mostrar 1 pagamento já coberto",
    });
    await expect(umCoberto).toBeVisible();
    await expect(doisCobertos).toHaveCount(0);
    // O corpo do card cita o MESMO número do botão, no singular.
    await expect(
      page.getByText(/Pode estar no que já está ligado a outra nota/),
    ).toBeVisible();

    // ── Filtro que zera os cobertos: o bloco desaparece, não vira "Mostrar 0" ──
    await busca.fill("ilhamix");
    await expect(page.getByRole("checkbox")).toHaveCount(2);
    await expect(page.getByRole("button", { name: /^Mostrar /})).toHaveCount(0);

    // ── Revelado COM filtro: a lista mostra os cobertos filtrados, não os 2 ──
    await busca.fill("9100");
    await umCoberto.click();
    await expect(page.getByRole("checkbox")).toHaveCount(1);
    await expect(page.locator("label").first()).toContainText("R$ 9.100,00");
    // Revelar é irreversível (CONTAI-074) e limpar a busca não o desfaz: agora
    // os 7 candidatos estão na lista.
    await busca.fill("");
    await expect(page.getByRole("checkbox")).toHaveCount(7);
  });

  test("espelhado em /pagamento/[id]/ligar: busca por número da nota", async ({
    page,
    db,
  }) => {
    const ilhamix = await criarFavorecido(db, {
      nome: "Ilhamix Concreto LTDA",
      documento: CNPJ_ILHAMIX,
      tipo: "pj",
    });
    const wk = await criarFavorecido(db, {
      nome: "WK Construções LTDA",
      documento: CNPJ_WK_DIGITOS,
      tipo: "pj",
    });
    const eletrica = await criarFavorecido(db, {
      nome: "Elétrica Bom Jesus LTDA",
      documento: CNPJ_ELETRICA,
      tipo: "pj",
    });

    const nota = (favorecido: string, numero: string, valor: number) =>
      criarDocumento(db, {
        favorecido_id: favorecido,
        tipo: "nf_material",
        classificacao: "material",
        numero,
        valor,
        destinatario_cpf_ok: true,
        status: "registrado",
      });

    // 5 notas livres…
    await nota(ilhamix, "1042", 16240);
    await nota(ilhamix, "1043", 500);
    await nota(wk, "9901", 3000);
    await nota(wk, "7788", 1200);
    await nota(wk, "7789", 4500);
    // …e 1 já coberta por inteiro por outro pagamento (total 6 > 5).
    const coberta = await nota(eletrica, "3312", 9100);
    await criarVinculo(
      db,
      await criarPagamento(db, {
        favorecido_id: eletrica,
        valor: 9100,
        data_pagamento: `${ANO}-08-07`,
        meio: "pix",
        status: "aguardando_nf",
        comprovante_path: `${USER_ID_SEED}/comprovante/eletrica.png`,
      }),
      coberta,
    );

    const alvo = await criarPagamento(db, {
      favorecido_id: ilhamix,
      valor: 16240,
      data_pagamento: `${ANO}-08-02`,
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/alvo.png`,
    });

    await page.goto(`/pagamento/${alvo}/ligar`);

    const busca = page.getByRole("textbox", { name: "Buscar notas" });
    await expect(busca).toBeVisible();
    // O placeholder desta direção anuncia o índice a mais: o número da nota.
    await expect(busca).toHaveAttribute(
      "placeholder",
      "Buscar por favorecido, valor ou número da nota…",
    );
    await expect(page.getByRole("checkbox")).toHaveCount(5);

    // ── O número impresso na nota, que é como o Mateus a identifica no papel ──
    await busca.fill("9901");
    await expect(page.getByRole("checkbox")).toHaveCount(1);
    await expect(page.locator("label").first()).toContainText("R$ 3.000,00");
    await busca.fill("7788");
    await expect(page.getByRole("checkbox")).toHaveCount(1);
    await expect(page.locator("label").first()).toContainText("R$ 1.200,00");

    // ── Só bate na já coberta: card (b), no feminino, e bloco ainda colapsado ──
    await busca.fill("3312");
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(
      page.getByText('Nada encontrado para "3312" nas notas livres'),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mostrar 1 nota já coberta" }),
    ).toBeVisible();

    // ── Nada em lugar nenhum: card (a), e NUNCA o vazio-de-verdade ──
    await busca.fill("zzz");
    await expect(page.getByText('Nada encontrado para "zzz"')).toBeVisible();
    await expect(
      page.getByText(
        "Nenhuma nota desta obra combina com esse texto. Confira a grafia ou tente um valor diferente.",
      ),
    ).toBeVisible();
    await expect(page.getByText("Nenhum documento para ligar")).toHaveCount(0);

    await page.getByRole("button", { name: "Limpar busca" }).click();
    await expect(page.getByRole("checkbox")).toHaveCount(5);
    expect(await vinculos(db)).toHaveLength(1);
  });
});
