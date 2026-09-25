import { URL_SUPABASE_LOCAL } from "./ambiente";
import { documentos, linhasDeRetencao } from "./banco";
import { expect, test } from "./fixtures";
import {
  escolher,
  preencherDocumentoBasico,
  responderCnoDaNota,
} from "./formularios";

/**
 * **CONTAI-053 — o repeater de retenção na CAPTURA, a partir de 880px.**
 *
 * Fonte do desenho: `design/mocks/CONTAI-053.md` (delta sobre
 * `captura-no-desktop-v1.md`). Fonte fiscal: o Gate Fiscal do ticket, que herda
 * `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`.
 *
 * ⚠️ **Por que este arquivo roda no projeto `desktop`** (1280px): o
 * comportamento que ele prova SÓ EXISTE acima de 880px, e o par dele — a
 * ausência no piso de 375px — mora em `retencao.spec.ts`, no projeto `mobile`.
 * É a mesma exceção nomeada do `anexo-desktop.spec.ts`: um punhado de
 * comportamentos que mudam com a largura precisa ser provado nas duas.
 *
 * ⚠️ Contra o Postgres LOCAL como o resto da suíte, e as asserções olham o
 * **estado gravado** além da tela — é o estado gravado que vira declaração.
 */

const CNPJ_EMITENTE = "11.222.333/0001-81";

/** Preenche a NF de serviço até o gate, sem responder o gate. */
async function notaDeServicoAteOGate(
  page: import("@playwright/test").Page,
  /**
   * `"Não"` manda a nota para a QUARENTENA — e quarentena também exige número e
   * data (R5 do CONTAI-004): é a nota errada que precisa ser identificada para
   * ser cancelada e reemitida.
   */
  noCpf: "Sim" | "Não" = "Sim",
) {
  await page.goto("/adicionar/documento");
  await preencherDocumentoBasico(page, {
    tipo: "NF serviço",
    emitente: "Francisco Empreitadas",
    documento: CNPJ_EMITENTE,
    valor: "18.000,00",
    numero: "1042",
    dataEmissao: "2026-03-20",
    noCpf,
    arquivo: {
      name: "nf-1042.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 nf"),
    },
  });
  await responderCnoDaNota(page, "É o CNO desta obra");
}

/**
 * Preenche UMA linha no formulário aberto e a adiciona. Nada aqui vem
 * pré-escolhido: cada resposta é um toque, como na gestão.
 */
async function adicionarLinha(
  page: import("@playwright/test").Page,
  linha: {
    rotulo: string;
    valor: string;
    composicao: string;
    tributo?: string;
    descontoEfetivo: "Sim" | "Não";
    quemRecolhe?: string;
  },
) {
  const bloco = page.locator('[data-captura="retencao"]');
  await bloco
    .getByLabel("Rótulo (copie exatamente da nota)")
    .fill(linha.rotulo);
  await bloco.getByLabel("Valor", { exact: true }).fill(linha.valor);
  await escolher(page, "O que esta linha representa?", linha.composicao);
  if (linha.tributo) await escolher(page, "Qual tributo?", linha.tributo);
  await escolher(
    page,
    "Esse valor é de fato abatido do que você transfere ao prestador?",
    linha.descontoEfetivo,
  );
  if (linha.quemRecolhe) {
    await escolher(page, "Quem recolhe isto?", linha.quemRecolhe);
  }
  await bloco.getByRole("button", { name: "Adicionar linha" }).click();
}

// ══ 1 · O gate manda: o bloco só existe com "destacada" ══════════════════

test.describe("o bloco aparece e desaparece com o gate", () => {
  /** Critérios 2, 7 e 8, na mesma tela. */
  test("só com 'Destacada', sem nada pré-marcado, e sem clique para abrir", async ({
    page,
  }) => {
    await notaDeServicoAteOGate(page);
    const bloco = page.locator('[data-captura="retencao"]');

    // Critério 8: gate não respondido → campo de retenção nenhum.
    await expect(bloco).toHaveCount(0);

    await escolher(page, "Esta nota destaca alguma retenção?", "Nenhuma");
    await expect(bloco).toHaveCount(0);

    await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");
    await expect(bloco).toBeVisible();

    // ⚠️ **Nasce JÁ ABERTO** — desvio proposital do `Repeater` da gestão (spec,
    // §2): a Dor de Origem é preencher tudo junto, e o clique de "+ Adicionar a
    // primeira linha" reintroduziria a fricção que o ticket remove.
    await expect(bloco.locator('[data-retencao="formulario"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: "+ Adicionar a primeira linha de retenção" }),
    ).toHaveCount(0);

    // ⚠️ **Critério 7 — nada pré-marcado, em nenhuma largura.** É a mitigação do
    // pre-mortem 2: "repeater no mesmo formulário" não autoriza default fiscal.
    for (const radio of await bloco.getByRole("radio").all()) {
      await expect(radio).not.toBeChecked();
    }
    await expect(
      bloco.getByRole("button", { name: /Faltam \d+ respostas? para adicionar/ }),
    ).toBeDisabled();

    // ⚠️ Linha COMBINADA não pede tributo, aqui como na gestão — é o mesmo
    // componente, e é o que o Gate Fiscal manda REVALIDAR (ADENDO A.1).
    await escolher(
      page,
      "O que esta linha representa?",
      "Total combinado, não aberto pela nota",
    );
    await expect(page.getByRole("group", { name: "Qual tributo?" })).toHaveCount(0);

    // As duas dicas de tela larga, com o texto exato do Gate 0.
    await expect(
      page.getByText(
        "As linhas de retenção aparecem logo abaixo — preencha agora, com a nota na mão, ou deixe em branco e complete depois, na tela desta nota.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        /"destacada" na retenção abre o detalhamento linha a linha, logo abaixo, nesta mesma tela/,
      ),
    ).toBeVisible();
  });

  /**
   * ⚠️ Sair de "destacada" **APAGA** as linhas acumuladas, e voltar devolve o
   * bloco VAZIO — nunca uma linha fantasma (spec, §2). Sem isso, uma linha
   * guardada gravaria contra um `retencao_na_nota` que a contradiz.
   */
  test("trocar o gate ou o tipo apaga as linhas acumuladas", async ({ page }) => {
    await notaDeServicoAteOGate(page);
    await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");
    await adicionarLinha(page, {
      rotulo: "Total das Retenções (ISSQN / Federais)",
      valor: "540,00",
      composicao: "Total combinado, não aberto pela nota",
      descontoEfetivo: "Sim",
      quemRecolhe: "A empresa",
    });
    const bloco = page.locator('[data-captura="retencao"]');
    await expect(bloco.locator('[data-retencao="pendente"]')).toHaveCount(1);

    await escolher(page, "Esta nota destaca alguma retenção?", "Nenhuma");
    await expect(bloco).toHaveCount(0);
    await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");
    await expect(bloco.locator('[data-retencao="pendente"]')).toHaveCount(0);
    await expect(bloco.locator('[data-retencao="formulario"]')).toBeVisible();

    // E o gate inteiro sai de cena quando o tipo deixa de perguntar retenção.
    await adicionarLinha(page, {
      rotulo: "INSS",
      valor: "340,00",
      composicao: "Tributo único identificado",
      tributo: "INSS",
      descontoEfetivo: "Não",
    });
    await expect(bloco.locator('[data-retencao="pendente"]')).toHaveCount(1);
    await escolher(page, "Tipo", "NF material");
    await expect(bloco).toHaveCount(0);
    await escolher(page, "Tipo", "NF serviço");
    await expect(
      page.getByRole("group", { name: "Esta nota destaca alguma retenção?" }),
    ).toBeVisible();
    await expect(bloco).toHaveCount(0);
  });
});

// ══ 2 · O ciclo completo: linhas completas gravam junto com a nota ════════

/**
 * **Critério 4** — as linhas preenchidas na captura têm de ficar IDÊNTICAS às
 * que resultariam de digitação na tela de gestão, e sem pendência aberta.
 */
test("duas linhas completas: gravam depois do documento, sem pendência", async ({
  page,
  db,
}) => {
  await notaDeServicoAteOGate(page);
  await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");

  // O caso REAL do Francisco: total combinado, descontado de fato, recolhido
  // pela empresa.
  await adicionarLinha(page, {
    rotulo: "Total das Retenções (ISSQN / Federais)",
    valor: "540,00",
    composicao: "Total combinado, não aberto pela nota",
    descontoEfetivo: "Sim",
    quemRecolhe: "A empresa",
  });

  const bloco = page.locator('[data-captura="retencao"]');
  const recap = bloco.locator('[data-retencao="pendente"]');
  await expect(recap).toHaveCount(1);
  // O recap diz o que a linha É — e com composição combinada NUNCA nomeia
  // tributo (ADENDO A.2, herdado por reuso das mesmas funções da gestão).
  await expect(recap).toContainText("“Total das Retenções (ISSQN / Federais)”");
  await expect(recap).toContainText("R$ 540,00");
  await expect(recap).toContainText("Total combinado, não aberto pela nota");
  await expect(recap).toContainText(
    "retenção não discriminada, presumivelmente recolhida por terceiros",
  );
  await expect(recap).toContainText("A empresa");

  // ⚠️ Nenhum banner de "retenção sem recolhedor" nasce aqui: esse julgamento
  // depende de Σ pagamentos vinculados, que não existe antes de gravar (spec, §2).
  await expect(
    page.locator('[data-pendencia="retencao-sem-recolhedor"]'),
  ).toHaveCount(0);

  // A segunda linha: informativa (composição do DAS do Simples), tributo
  // identificado, sem desconto efetivo — e o formulário fechou depois da 1ª.
  await bloco.getByRole("button", { name: "+ Adicionar outra linha" }).click();
  await adicionarLinha(page, {
    rotulo: "INSS (composição do Simples)",
    valor: "340,00",
    composicao: "Tributo único identificado",
    tributo: "INSS",
    descontoEfetivo: "Não",
  });
  await expect(bloco.locator('[data-retencao="pendente"]')).toHaveCount(2);

  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();
  // Sucesso é SILENCIOSO — nenhum card de resultado parcial (spec, §4).
  await expect(page.locator('[data-retencao="parcial"]')).toHaveCount(0);

  const gravados = await documentos(db);
  expect(gravados).toHaveLength(1);
  expect(gravados[0].retencao_na_nota).toBe("destacada");

  const linhas = await linhasDeRetencao(db);
  expect(linhas).toHaveLength(2);
  expect(linhas[0]).toMatchObject({
    documento_id: gravados[0].id,
    // O rótulo é LITERAL: nem normalizado, nem encurtado.
    rotulo_literal: "Total das Retenções (ISSQN / Federais)",
    composicao: "combinado_nao_aberto",
    tributo: null,
    e_desconto_efetivo: true,
    quem_recolhe: "empresa",
  });
  // `numeric(14,2)` volta do PostgREST como STRING — o mesmo cuidado do
  // CONTAI-001, e a razão de este teste não ser mockado.
  expect(Number(linhas[0].valor)).toBe(540);
  expect(linhas[1]).toMatchObject({
    rotulo_literal: "INSS (composição do Simples)",
    composicao: "tributo_identificado",
    tributo: "inss",
    e_desconto_efetivo: false,
    // Linha informativa: sem desconto efetivo não existe recolhedor.
    quem_recolhe: null,
  });

  // Critério 4: no detalhe, as linhas aparecem gravadas e NENHUMA pendência de
  // retenção fica aberta.
  await page.goto(`/documento/${gravados[0].id}`);
  await expect(page.locator('[data-retencao="linha"]')).toHaveCount(2);
  await expect(
    page.locator('[data-pendencia="retencao-sem-recolhedor"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-pendencia="retencao-sem-linha"]'),
  ).toHaveCount(0);
  await page.goto("/pendencias");
  await expect(page.getByText("Retenção sem recolhedor")).toHaveCount(0);
});

// ══ 3 · Repeater incompleto (critério 5) ═════════════════════════════════

/**
 * **Critério 5** — o que fica digitado e NÃO foi adicionado não é linha: a nota
 * salva, e a lacuna é pendência VISÍVEL, nunca lida como "sem retenção"
 * (CONTAI-038, critérios 2 e 5).
 */
test("linha digitada e não adicionada: a nota salva e a lacuna vira pendência", async ({
  page,
  db,
}) => {
  await notaDeServicoAteOGate(page);
  await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");

  const bloco = page.locator('[data-captura="retencao"]');
  await bloco.getByLabel("Rótulo (copie exatamente da nota)").fill("INSS");
  await bloco.getByLabel("Valor", { exact: true }).fill("340,00");
  // Sem composição e sem desconto efetivo: o botão nomeia o que falta e não
  // grava — mesma validação da gestão, reusada sem reimplementação.
  await expect(
    bloco.getByRole("button", { name: /Faltam \d+ respostas? para adicionar/ }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();
  // Não houve tentativa de gravação: nada falhou, e o card de resultado parcial
  // não aparece (spec, §4 — lista vazia não é falha).
  await expect(page.locator('[data-retencao="parcial"]')).toHaveCount(0);

  const gravados = await documentos(db);
  expect(gravados[0].retencao_na_nota).toBe("destacada");
  expect(await linhasDeRetencao(db)).toHaveLength(0);

  await page.goto(`/documento/${gravados[0].id}`);
  await expect(
    page.locator('[data-pendencia="retencao-sem-linha"]'),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Esta nota destaca retenção, mas nenhuma linha foi registrada ainda.",
    ),
  ).toBeVisible();
});

// ══ 4 · Gravação parcial (critério 3) ════════════════════════════════════

/**
 * **Critério 3 e pre-mortem 4** — documento salvo, linha que não gravou, e a
 * confirmação DIZ quantas entraram e quantas não. Silenciar isso é a falha que o
 * ticket nomeia: ele não perceberia, e a pendência apareceria dias depois.
 *
 * ⚠️ **Falsificação de rede restrita ao INSERT das linhas**, exatamente como o
 * caso irmão do vínculo em `vinculo.spec.ts`: o documento tem de entrar DE
 * VERDADE para o caso existir. Não há como forçar uma falha real só das linhas no
 * Postgres local — a linha inválida é recusada antes de sair do app (é o outro
 * teste), e derrubar o PostgREST inteiro testaria outra coisa.
 */
async function derrubarOInsertDasLinhas(page: import("@playwright/test").Page) {
  await page.route(
    `${URL_SUPABASE_LOCAL}/rest/v1/documento_retencao*`,
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
}

test("⚠️ falha ao gravar a linha: a nota salva e a confirmação diz os números", async ({
  page,
  db,
}) => {
  await derrubarOInsertDasLinhas(page);

  await notaDeServicoAteOGate(page);
  await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");
  await adicionarLinha(page, {
    rotulo: "Total das Retenções (ISSQN / Federais)",
    valor: "540,00",
    composicao: "Total combinado, não aberto pela nota",
    descontoEfetivo: "Sim",
    quemRecolhe: "Ainda não sei",
  });

  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

  // ⚠️ Card ÂMBAR no slot `extra`, não o `aviso` vermelho: a nota foi salva e é
  // documentação hábil normalmente — o que ficou pendente é a informação de
  // retenção (spec, §4).
  const parcial = page.locator('[data-retencao="parcial"]');
  await expect(parcial).toBeVisible();
  await expect(parcial).toContainText("Retenção parcialmente gravada");
  await expect(parcial).toContainText(
    "Entraram 0 de 1 linha de retenção — 1 não gravou.",
  );
  await expect(parcial).toContainText(
    'Abra o documento e registre a que falta de novo, olhando a nota — elas ficam como pendência até lá, nunca como "sem retenção".',
  );
  await expect(parcial.getByRole("link", { name: "Abrir esta nota" })).toBeVisible();

  // O ESTADO GRAVADO: o documento entrou, a linha não — e o gate continua
  // "destacada", que é o que faz a lacuna ser pendência e não "sem retenção".
  const gravados = await documentos(db);
  expect(gravados).toHaveLength(1);
  expect(gravados[0].retencao_na_nota).toBe("destacada");
  expect(await linhasDeRetencao(db)).toHaveLength(0);

  await parcial.getByRole("link", { name: "Abrir esta nota" }).click();
  await expect(
    page.locator('[data-pendencia="retencao-sem-linha"]'),
  ).toBeVisible();
});

/**
 * **O bloqueante do Gate 2 do CONTAI-053, em forma de teste.**
 *
 * A nota em quarentena navega direto para `/documento/[id]` (CONTAI-004), e esse
 * `router.push` PULAVA a tela de confirmação — logo, o card de resultado parcial
 * nunca chegava a existir justamente no ramo em que a nota já está frágil. Isso
 * contradizia o critério 3 ("a confirmação diz quantas entraram e quantas não —
 * nunca esconde a falha"), e contar com a tela de destino só cobriria o caso "0
 * de N": com "1 de 3" ela mostra a linha que entrou e cala as que faltam.
 *
 * ⚠️ E a confirmação continua dizendo a QUARENTENA: parar aqui sem ela seria
 * trocar um silêncio por outro — o "Salvo ✓" de uma nota que não compõe custo.
 */
test("⚠️ quarentena + linha que não gravou: a confirmação fica e diz as DUAS coisas", async ({
  page,
  db,
}) => {
  await derrubarOInsertDasLinhas(page);

  // "Não" no CPF → quarentena, o ramo que antes navegava sem confirmação.
  await notaDeServicoAteOGate(page, "Não");
  await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");
  await adicionarLinha(page, {
    rotulo: "Total das Retenções (ISSQN / Federais)",
    valor: "540,00",
    composicao: "Total combinado, não aberto pela nota",
    descontoEfetivo: "Sim",
    quemRecolhe: "A empresa",
  });

  await page.getByRole("button", { name: "Salvar registro" }).click();

  // ⚠️ A tela de confirmação FICA — não houve `router.push` para o documento.
  await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/adicionar/documento");

  const parcial = page.locator('[data-retencao="parcial"]');
  await expect(parcial).toBeVisible();
  await expect(parcial).toContainText("Retenção parcialmente gravada");
  await expect(parcial).toContainText(
    "Entraram 0 de 1 linha de retenção — 1 não gravou.",
  );

  // …e a consequência da quarentena não desaparece por causa disso.
  // Escopado em `main`: o Next mantém um `role="alert"` vazio no route-announcer,
  // e `getByRole("alert")` sozinho viola o strict mode (mesma nota do
  // `compromisso.spec.ts`).
  const aviso = page.getByRole("main").getByRole("alert");
  await expect(aviso).toContainText("quarentena");
  await expect(aviso).toContainText(
    "Não entra no custo de aquisição. Peça a nota no seu CPF.",
  );

  // O ESTADO GRAVADO: documento em quarentena, gate "destacada", zero linhas.
  const gravados = await documentos(db);
  expect(gravados).toHaveLength(1);
  expect(gravados[0]).toMatchObject({
    status: "quarentena",
    destinatario_cpf_ok: false,
    retencao_na_nota: "destacada",
  });
  expect(await linhasDeRetencao(db)).toHaveLength(0);
});
