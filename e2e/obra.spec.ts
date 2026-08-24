import type { Page } from "@playwright/test";

import { hojeIso } from "../lib/hoje";
import { OBRA_ID_SEED, USER_ID_SEED } from "./ambiente";
import {
  apagarTodasAsObras,
  criarObra,
  documentos,
  obras,
  pagamentos,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";
import { preencherDocumentoBasico } from "./formularios";

/**
 * CONTAI-003 contra o Postgres LOCAL: obras de verdade, RLS ligada, e as
 * asserções olhando o ESTADO GRAVADO — é o `obra_id` gravado que vira
 * discriminação de Bens e Direitos e base de aferição no ano que vem, não o
 * que a tela mostrou.
 */

const CNPJ_AJE = "11.222.333/0001-81";

function pdf(nome: string) {
  return {
    name: nome,
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4 ${nome}`),
  };
}

function png(nome: string) {
  return {
    name: nome,
    mimeType: "image/png",
    buffer: Buffer.from(`PNG ${nome}`),
  };
}

async function escolher(page: Page, grupo: string, opcao: string) {
  await page
    .getByRole("group", { name: grupo })
    .getByText(opcao, { exact: true })
    .click();
}

/** Segunda obra do cenário: em andamento e SEM CNO, como a real do Mateus. */
async function criarCasaDoMorro(db: Db) {
  return criarObra(db, {
    nome: "Casa do Morro",
    municipio: "Florianópolis",
    cno: null,
    data_inicio_obra: "2026-03-15",
  });
}

async function preencherDocumento(
  page: Page,
  dados: { tipo: string; nome: string; valor: string; arquivo: string },
) {
  // Número e data de emissão entram porque são bloqueantes em NF desde o
  // CONTAI-004 — sem eles estes testes de OBRA morreriam na validação de um
  // campo que eles não estão testando.
  await preencherDocumentoBasico(page, {
    tipo: dados.tipo,
    emitente: dados.nome,
    documento: CNPJ_AJE,
    valor: dados.valor,
    numero: "1042",
    dataEmissao: "2026-03-20",
    arquivo: pdf(dados.arquivo),
    noCpf: "Sim",
  });
}

// ── Critério 12 — usuário novo não cai em tela de erro ───────────────────

test.describe("primeiro acesso", () => {
  test("sem nenhuma obra, o app leva ao cadastro em vez de tela de erro", async ({
    page,
    db,
  }) => {
    // `ObraAusenteError` era o fim da linha: nome, matrícula, CNO e valor do
    // terreno só entravam por SQL (dor D9).
    //
    // O cenário é montado por fora do app: desde a migration 0005 o papel
    // `authenticated` não tem DELETE (o app não apaga nada, e o banco local
    // passou a ter os mesmos privilégios do remoto). A verificação abaixo
    // continua sendo do app: é o `db` autenticado que confirma o vazio.
    apagarTodasAsObras();
    expect(await obras(db)).toHaveLength(0);

    await page.goto("/");

    await expect(page.getByText("Nenhuma obra cadastrada")).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

    await page.getByRole("link", { name: "Cadastrar a primeira obra" }).click();
    await expect(page.getByRole("heading", { name: "Nova obra" })).toBeVisible();
    await expect(page.getByLabel("Nome da obra")).toBeVisible();
  });

  test("cadastra obra SEM CNO pela tela, com a pendência e sem bloqueio", async ({
    page,
    db,
  }) => {
    await page.goto("/obras");
    await page.getByRole("link", { name: "+ Nova obra" }).click();

    await page.getByLabel("Nome da obra").fill("Casa do Morro");
    await page.getByLabel("Município").fill("Florianópolis");
    await page.getByLabel("Matrícula do imóvel").fill("45.892");
    await page.getByLabel("Data de início da obra").fill("2026-03-15");
    await page.getByRole("button", { name: "Continuar" }).click();

    // Passo 2 — a ausência de CNO é obrigação vencida, não campo opcional.
    await escolher(page, "Esta obra já tem CNO?", "Ainda não tenho");
    await expect(
      page.getByText(/O CNO é obrigatório e o prazo é de 30 dias/),
    ).toBeVisible();
    await expect(page.getByText(/dias em atraso/)).toBeVisible();
    await expect(
      page.getByText(/não abatem a aferição do INSS/),
    ).toBeVisible();
    await expect(
      page.getByText(/continuam valendo como custo de aquisição no IRPF/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continuar sem CNO" }).click();

    // Passo 3 — a natureza da aquisição (CONTAI-010). Os três campos de VALOR
    // morreram com as colunas: terreno, ITBI e escritura viraram desembolsos
    // DATADOS, cada um no ano da sua quitação. O que fica aqui é a bifurcação,
    // e ela é OPCIONAL — em branco vira pendência de complemento, nunca
    // bloqueio (critério 23).
    await escolher(page, "Como você adquiriu o terreno?", "Financiado com um banco");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();

    // Passo 4 — premissas do produto. Sem resposta não cria: a equiparação a
    // empresa (critério 11) é decidida por fato declarado, não por omissão.
    await page.getByRole("button", { name: "Criar obra" }).click();
    await expect(
      page.getByText("Responda se o terreno veio de desmembramento ou loteamento."),
    ).toBeVisible();
    await escolher(page, "O terreno veio de desmembramento ou loteamento?", "Não");
    await page.getByRole("button", { name: "Criar obra" }).click();

    await expect(page.getByRole("heading", { name: "Obra criada ✓" })).toBeVisible();

    const gravadas = await obras(db);
    expect(gravadas).toHaveLength(2);
    const nova = gravadas.find((o) => o.nome === "Casa do Morro")!;
    expect(nova).toMatchObject({
      user_id: USER_ID_SEED,
      municipio: "Florianópolis",
      matricula: "45.892",
      cno: null,
      cno_registrado_em: null,
      data_inicio_obra: "2026-03-15",
      natureza_aquisicao_terreno: "financiado",
      unidades_autonomas: 1,
      origem_desmembramento_loteamento: false,
    });
  });
});

/**
 * Adendo do contador (2026-08-10), confirmado como ressalva no Gate 2: o dano à
 * aferição NÃO começa no dia 31. Uma obra ainda dentro dos 30 dias já emite
 * notas que não abatem — o prazo governa só a multa. Este teste existe para o
 * dia em que alguém "melhorar" a tela escondendo as consequências enquanto o
 * prazo não vence: aí a pendência viraria lembrete de agenda.
 */
test.describe("obra sem CNO ainda dentro do prazo", () => {
  test("a consequência inteira já aparece, sem falar em atraso", async ({
    page,
  }) => {
    const hoje = hojeIso();

    await page.goto("/obras/nova");
    await page.getByLabel("Nome da obra").fill("Casa que começou hoje");
    await page.getByLabel("Município").fill("Florianópolis");
    // Início hoje: faltam os 30 dias inteiros, é o estado mais "tranquilo"
    // possível do prazo.
    await page.getByLabel("Data de início da obra").fill(hoje);
    await page.getByRole("button", { name: "Continuar" }).click();

    await escolher(page, "Esta obra já tem CNO?", "Ainda não tenho");

    await expect(
      page.getByText("Obra sem CNO — pendência aberta — prazo em curso"),
    ).toBeVisible();
    await expect(page.getByText(/faltam 30 dias/)).toBeVisible();
    await expect(page.getByText(/dias em atraso/)).toHaveCount(0);

    // O bloco de consequências é IDÊNTICO ao da obra em atraso — é este o
    // ponto do adendo.
    await expect(
      page.getByText(/não abatem a aferição do INSS desta obra/),
    ).toBeVisible();
    await expect(
      page.getByText(/o banco do comprador não financia e o cartório não lavra/),
    ).toBeVisible();
    await expect(
      page.getByText(/continuam valendo como custo de aquisição no IRPF/),
    ).toBeVisible();
  });

  test("data de início no futuro é recusada, e não vira 'informe a data'", async ({
    page,
  }) => {
    // Ressalva do Gate 2: data futura empurra o vencimento do CNO para frente
    // (o atraso real some da tela) e desloca o período da aferição.
    await page.goto("/obras/nova");
    await page.getByLabel("Nome da obra").fill("Casa que ainda não começou");
    await page.getByLabel("Município").fill("Florianópolis");
    await page.getByLabel("Data de início da obra").fill("2099-01-01");
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByText(/Data no futuro/)).toBeVisible();
    // Continua no passo 1: sem data real de início não há prazo nem aferição.
    await expect(
      page.getByText("Passo 1 de 4 — identificação", { exact: true }),
    ).toBeVisible();
  });
});

// ── Critério 10 — unique parcial de CNO ─────────────────────────────────

test.describe("CNO por obra", () => {
  test("duas obras SEM CNO coexistem; duas com o MESMO CNO são barradas", async ({
    db,
  }) => {
    // O unique é parcial (`where cno is not null`). Um unique comum trataria
    // `null` como valor e transformaria a decisão "aceitar obra sem CNO" em
    // bloqueio disfarçado no dia da segunda obra sem CNO.
    await criarObra(db, { nome: "Sem CNO 1", cno: null });
    await criarObra(db, { nome: "Sem CNO 2", cno: null });
    expect(await obras(db)).toHaveLength(3);

    const repetido = await db
      .from("obra")
      .insert({
        nome: "Clone do CNO da Casa Cachoeira",
        cno: "12.345.67890/26",
        data_inicio_obra: "2026-01-10",
      })
      .select("id");
    expect(repetido.error?.code).toBe("23505");
    expect(await obras(db)).toHaveLength(3);
  });
});

// ── Critérios 7 e 8 — a obra gravada é a que estava na tela ─────────────

test.describe("obra do registro", () => {
  test("trocar a obra ativa depois não move o que já foi salvo", async ({
    page,
    db,
  }) => {
    const morro = await criarCasaDoMorro(db);

    await page.goto("/adicionar/documento");
    await expect(page.getByText("Registrando em")).toBeVisible();
    await expect(
      page.getByText("Casa Cachoeira", { exact: true }),
    ).toBeVisible();

    await preencherDocumento(page, {
      tipo: "NF material",
      nome: "Casa do Construtor Ltda",
      valor: "4.850,00",
      arquivo: "NF-material-cachoeira.pdf",
    });
    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();
    // A confirmação nomeia a obra: última chance de ver o erro fresco.
    await expect(page.getByText(/Salvo em/)).toContainText("Casa Cachoeira");

    // Troca a obra ativa para a outra obra.
    await page.goto("/obras");
    await page.getByRole("button", { name: /Casa do Morro/ }).click();
    await expect(page.getByText("Obra aberta")).toBeVisible();

    const gravados = await documentos(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0].obra_id).toBe(OBRA_ID_SEED);
    expect(gravados[0].obra_id).not.toBe(morro);
  });

  test("trocar de obra DENTRO do formulário grava na obra da tela", async ({
    page,
    db,
  }) => {
    // O defeito que o ticket persegue: a preferência do aparelho decidindo um
    // campo fiscal. Aqui ela aponta para a Casa Cachoeira o tempo todo, e o
    // registro tem de ir para a obra afirmada na tela.
    const morro = await criarCasaDoMorro(db);

    await page.goto("/adicionar/documento");
    await preencherDocumento(page, {
      tipo: "NF material",
      nome: "Casa do Construtor Ltda",
      valor: "1.200,00",
      arquivo: "NF-material-morro.pdf",
    });

    await page.getByRole("button", { name: "Trocar obra" }).click();
    await page.getByRole("button", { name: /Casa do Morro/ }).click();
    await expect(page.getByText("Casa do Morro", { exact: true })).toBeVisible();
    // Volta ao MESMO formulário, com o que já estava preenchido.
    await expect(page.getByLabel("Valor")).toHaveValue("1.200,00");

    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByText(/Salvo em/)).toContainText("Casa do Morro");

    const gravados = await documentos(db);
    expect(gravados).toHaveLength(1);
    expect(gravados[0].obra_id).toBe(morro);

    // A preferência do aparelho continua na outra obra — e não decidiu nada.
    const preferida = await page.evaluate(() =>
      window.localStorage.getItem("contai-obra-ativa"),
    );
    expect(preferida).toBe(OBRA_ID_SEED);
  });
});

// ── Critério 15 — obra sem CNO não bloqueia registro ────────────────────

test.describe("obra sem CNO", () => {
  test("registra material, NF de serviço e pagamento — todos gravados", async ({
    page,
    db,
  }) => {
    const morro = await criarCasaDoMorro(db);
    await page.goto("/obras");
    await page.getByRole("button", { name: /Casa do Morro/ }).click();
    await expect(page.getByText("Obra aberta")).toBeVisible();

    // 1 · NF de material.
    await page.goto("/adicionar/documento");
    await preencherDocumento(page, {
      tipo: "NF material",
      nome: "Casa do Construtor Ltda",
      valor: "4.850,00",
      arquivo: "material-sem-cno.pdf",
    });
    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    // 2 · NF de serviço: avisa a consequência e salva mesmo assim.
    await page.goto("/adicionar/documento");
    await preencherDocumento(page, {
      tipo: "NF serviço",
      nome: "AJE Construções",
      valor: "18.000,00",
      arquivo: "servico-sem-cno.pdf",
    });
    await escolher(page, "NF de serviço: tem retenção de 11%?", "Sim");
    await expect(page.getByText("Nota de serviço em obra sem CNO")).toBeVisible();
    await expect(
      page.getByText(/não vai abater a aferição do INSS desta obra/),
    ).toBeVisible();
    await expect(
      page.getByText(/exija da empreiteira/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Salvar mesmo assim" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    // 3 · Pagamento avulso.
    await page.goto("/adicionar/pagamento");
    await page.getByLabel("Favorecido", { exact: true }).fill("AJE Construções");
    await page.getByLabel("CNPJ / CPF do favorecido").fill(CNPJ_AJE);
    await page.getByLabel("Valor").fill("15.000,00");
    await page.getByLabel("Comprovante").setInputFiles(png("pix-sem-cno.png"));
    await page.getByRole("button", { name: /Salvar — aguardando NF/ }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    const docsGravados = await documentos(db);
    expect(docsGravados).toHaveLength(2);
    expect(docsGravados.map((d) => d.obra_id)).toEqual([morro, morro]);
    expect(docsGravados.map((d) => d.tipo).sort()).toEqual([
      "nf_material",
      "nf_servico",
    ]);

    const pagosGravados = await pagamentos(db);
    expect(pagosGravados).toHaveLength(1);
    expect(pagosGravados[0].obra_id).toBe(morro);
  });
});

// ── Critério 5 — informar o CNO depois, pela tela de edição ─────────────

test.describe("edição da obra", () => {
  test("obra sem CNO recebe o CNO e a pendência some do estado gravado", async ({
    page,
    db,
  }) => {
    // É o fluxo que resolve a pendência central do ticket: o CNO sai DEPOIS do
    // início da obra, então cadastro imutável obrigaria SQL — a dor D9 voltando
    // pela porta dos fundos (critério 5).
    const morro = await criarCasaDoMorro(db);

    const pendencia = page.getByText("Obra sem CNO — pendência aberta");

    await page.goto(`/obras/${morro}`);
    await expect(pendencia.first()).toBeVisible();

    await escolher(page, "Esta obra já tem CNO?", "Já tenho o CNO");
    await page.getByLabel("Número do CNO").fill("98.765.43210/26");
    await page.getByLabel("Data em que o CNO foi registrado").fill("2026-04-02");
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page.getByText(/Alterações salvas em/)).toContainText(
      "Casa do Morro",
    );

    // A pendência some porque a obrigação foi cumprida — não porque a tela
    // esqueceu dela: o que fica é a JANELA sem CNO, que é a lista de cobrança
    // do CONTAI-007.
    await expect(pendencia).toHaveCount(0);
    await expect(
      page.getByText("18 dias entre o início (15/03/2026) e o registro").first(),
    ).toBeVisible();

    // Estado GRAVADO — é o banco que vai virar aferição, não a tela.
    const gravada = (await obras(db)).find((o) => o.id === morro)!;
    expect(gravada).toMatchObject({
      cno: "98.765.43210/26",
      cno_registrado_em: "2026-04-02",
      data_inicio_obra: "2026-03-15",
    });

    // E a porta de entrada para de cobrar: onde havia obrigação em atraso
    // agora há o número do CNO.
    await page.goto("/obras");
    await expect(page.getByText("CNO 98.765.43210/26")).toBeVisible();
    await expect(page.getByText(/sem CNO — obrigação em atraso/)).toHaveCount(0);
  });
});

// ── Critério 16 — o caminho perigoso ────────────────────────────────────

test.describe("sem obra ativa persistida", () => {
  test.use({ obraAtiva: null });

  test("com duas obras, nada é gravado antes de uma escolha explícita", async ({
    page,
    db,
  }) => {
    await criarCasaDoMorro(db);

    // Celular novo / storage limpo: o app abre a LISTA e não escolhe obra.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Suas obras" })).toBeVisible();
    await expect(page.getByText(/O app não escolhe por você/)).toBeVisible();

    // Critério 14 — asserção NEGATIVA, e ela é o critério: valor de obra
    // nenhuma pode aparecer nesta lista. Bens e Direitos não soma entre
    // matrículas e a aferição não soma entre CNOs: dois valores lado a lado
    // estão a uma soma mental de virar um número que não existe em declaração
    // nenhuma.
    //
    // ⚠️ Desde o CONTAI-010 nenhuma das duas obras tem valor de terreno
    // gravado (as três colunas morreram na 0008 e ninguém montou desembolso
    // aqui), então a asserção perdeu força: ela ainda cobre o que a TELA
    // desenha, mas não prova mais que um valor EXISTENTE fica de fora.
    // Devolver a força pede um `criarDesembolsoTerreno` por obra — fora do
    // escopo do retrabalho do CONTAI-010.
    await expect(page.getByRole("button", { name: /Casa do Morro/ })).toBeVisible();
    const lista = page.getByRole("main");
    await expect(lista).not.toContainText("R$");
    await expect(lista).not.toContainText("800.000");
    await expect(lista).not.toContainText("420.000");
    // Nenhum valor monetário em formato brasileiro, seja de que obra for.
    expect(await lista.innerText()).not.toMatch(/\d,\d{2}\b/);

    // O formulário também não abre em obra nenhuma.
    await page.goto("/adicionar/documento");
    await expect(page.getByRole("heading", { name: "Suas obras" })).toBeVisible();

    expect(await documentos(db)).toHaveLength(0);
    expect(await pagamentos(db)).toHaveLength(0);

    // Só depois da escolha explícita o app abre uma obra.
    await page.getByRole("button", { name: /Casa Cachoeira/ }).click();
    await expect(page.getByText("Obra aberta")).toBeVisible();
  });
});

test.describe("correção da obra de um registro", () => {
  test("mover para a obra B: obra_id vira B e some das saídas de A", async ({
    page,
    db,
  }) => {
    const morro = await criarCasaDoMorro(db);

    await page.goto("/adicionar/documento");
    await preencherDocumento(page, {
      tipo: "NF material",
      nome: "Casa do Construtor Ltda",
      valor: "4.850,00",
      arquivo: "NF-obra-errada.pdf",
    });
    await page.getByRole("button", { name: "Salvar registro" }).click();
    await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

    const antes = await documentos(db);
    expect(antes[0].obra_id).toBe(OBRA_ID_SEED);

    // Correção pela interface (critério 13) — sem isto seria SQL na mão.
    //
    // ⚠️ Título e rótulo do botão MUDARAM no CONTAI-021: a tela do documento
    // deixou de reusar `app/_components/corrigir-obra.tsx` e virou o ato
    // transacional do critério 13. O componente antigo continua servindo o
    // caminho do PAGAMENTO (`/pagamento/[id]/obra`), que o CONTAI-008 reabre e
    // que este ticket não altera — e é ele que o teste do pagamento exercita.
    await page.getByRole("link", { name: "Corrigir a obra deste registro" }).click();
    await expect(
      page.getByRole("heading", { name: "Corrigir a obra deste registro" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Casa do Morro/ }).click();
    await page
      .getByRole("button", { name: "Mover o registro para a obra escolhida" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Obra corrigida ✓" }),
    ).toBeVisible();

    const depois = await documentos(db);
    expect(depois).toHaveLength(1);
    expect(depois[0].obra_id).toBe(morro);

    // Saída da obra A: o valor não aparece mais em lugar nenhum dela.
    await page.goto("/");
    await expect(page.getByText("Nenhuma pendência.")).toBeVisible();
    await expect(page.getByText("4.850,00")).toHaveCount(0);
  });
});
