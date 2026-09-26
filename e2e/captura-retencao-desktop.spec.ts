import { URL_SUPABASE_LOCAL } from "./ambiente";
import { documentos, linhasDeRetencao } from "./banco";
import { expect, test } from "./fixtures";
import {
  escolher,
  preencherDocumentoBasico,
  responderCnoDaNota,
} from "./formularios";
import {
  NFSE_COM_RETENCAO_RECONHECIVEL,
  NFSE_SEM_PADRAO_RECONHECIVEL,
  pdfComTexto,
  RETENCAO_ESPERADA,
} from "./pdf-sintetico";

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
  /**
   * **CONTAI-055** — o anexo. O default é um PDF sem camada de texto
   * (`%PDF-1.4 nf`), e ele é o que faz todos os testes do CONTAI-053 acima
   * continuarem sem sugestão nenhuma: `extrairTextoDoPdf` devolve `null` e a
   * rota responde `{ sugestao: null }`. Quem quer sugestão passa um PDF de
   * verdade, montado por `pdfComTexto`.
   */
  buffer: Buffer = Buffer.from("%PDF-1.4 nf"),
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
      buffer,
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

/**
 * **CONTAI-062** — segura a resposta REAL de `/api/sugerir-retencao` até o teste
 * liberar. Devolve a função que a libera.
 *
 * ⚠️ **`rota.continue()`, nunca `rota.fulfill()`**: o que passa pelo fio continua
 * sendo unpdf + heurística + parser de verdade, como manda a regra dura de E2E do
 * `CLAUDE.md`. O único controle do teste é sobre o QUANDO — e é exatamente disso
 * que a condição de corrida do critério 7 precisa: uma janela em que a leitura
 * está comprovadamente em voo enquanto o dedo do Mateus responde o gate.
 */
async function segurarSugestao(page: import("@playwright/test").Page) {
  let liberar = () => {};
  const emVoo = new Promise<void>((resolver) => {
    liberar = () => resolver();
  });
  await page.route("**/api/sugerir-retencao", async (rota) => {
    await emVoo;
    await rota.continue();
  });
  return liberar;
}

/** O fieldset do gate — a pergunta que o CONTAI-062 passa a sugerir. */
function grupoDoGate(page: import("@playwright/test").Page) {
  return page.getByRole("group", {
    name: "Esta nota destaca alguma retenção?",
  });
}

/**
 * A pílula de uma opção do gate, para conferir o TRATAMENTO VISUAL dela.
 *
 * ⚠️ O nome acessível do rádio muda quando a pílula está sugerida (ganha o
 * " — sugerida automaticamente, ainda não confirmada" do `sr-only`), então o
 * seletor casa pelo PREFIXO: o mesmo locator serve nos dois estados, e um teste
 * que espera "manual" não passa por acidente só porque não achou o elemento.
 */
function pilulaDoGate(page: import("@playwright/test").Page, texto: string) {
  return grupoDoGate(page).locator("label").filter({ hasText: texto });
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

// ══ 5 · CONTAI-055 — a sugestão determinística pré-preenche a 1ª linha ════

/**
 * **A integração do CONTAI-053 (repeater) com o CONTAI-054 (parser).**
 *
 * ⚠️ **Nada é stubado no caminho feliz**: o PDF é montado no teste com camada de
 * texto de verdade (`e2e/pdf-sintetico.ts`), e quem responde é a rota real →
 * `unpdf` real → heurística real → parser real. Stubar `/api/sugerir-retencao`
 * para "provar" que a sugestão aparece validaria a suposição de quem escreveu o
 * teste, não o sistema — a regra dura de E2E do `CLAUDE.md` aplicada à camada de
 * cima. A única rota falsificada aqui é a FALHA (testes 5.3 e 5.4), que não tem
 * como ser produzida de verdade contra o stack local.
 */

const BLOCO = '[data-captura="retencao"]';

test("5.1 · sugestão do PDF nasce no 1º formulário, em destaque, e grava o que foi confirmado", async ({
  page,
  db,
}) => {
  await notaDeServicoAteOGate(
    page,
    "Sim",
    pdfComTexto(NFSE_COM_RETENCAO_RECONHECIVEL),
  );
  await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");

  const bloco = page.locator(BLOCO);
  const destaque = bloco.locator('[data-sugestao="retencao"]');

  // ⚠️ **Critério 5 — o RÓTULO LITERAL em destaque, não só o valor discreto.**
  // É a recomendação dos dois revisores do Gate 2 do CONTAI-054: o parser fecha o
  // trio pela aritmética, e uma linha de desconto fecha a mesma conta.
  await expect(destaque).toBeVisible();
  await expect(destaque).toContainText("Lido automaticamente desta nota");
  await expect(destaque).toContainText(`“${RETENCAO_ESPERADA.rotulo}”`);
  await expect(destaque).toContainText("R$ 1.048,00");
  await expect(destaque).toContainText(
    "uma linha de DESCONTO fecha a mesma conta",
  );

  // Critério 1 — os dois campos de LEITURA nascem preenchidos…
  await expect(
    bloco.getByLabel("Rótulo (copie exatamente da nota)"),
  ).toHaveValue(RETENCAO_ESPERADA.rotulo);
  await expect(bloco.getByLabel("Valor", { exact: true })).toHaveValue(
    RETENCAO_ESPERADA.valor,
  );
  // …e a origem é dita no próprio campo: valor preenchido sem dizer de onde veio
  // lê como valor já conferido, e não foi.
  await expect(
    bloco.getByText(
      "Veio da leitura automática da nota — confira se é exatamente o rótulo impresso",
    ),
  ).toBeVisible();

  // ⚠️ **Os QUATRO campos de classificação fiscal continuam em branco** — Gate
  // Fiscal do ticket, herdado do CONTAI-054. E o botão nomeia as duas respostas
  // que faltam, em vez de oferecer um toque que gravaria linha incompleta.
  for (const radio of await bloco.getByRole("radio").all()) {
    await expect(radio).not.toBeChecked();
  }
  await expect(
    bloco.getByRole("button", { name: "Faltam 2 respostas para adicionar" }),
  ).toBeDisabled();

  // O humano responde as duas e confirma a linha lida.
  await escolher(page, "O que esta linha representa?", "Tributo único identificado");
  await escolher(page, "Qual tributo?", "ISS");
  await escolher(
    page,
    "Esse valor é de fato abatido do que você transfere ao prestador?",
    "Sim",
  );
  await escolher(page, "Quem recolhe isto?", "A empresa");
  await bloco.getByRole("button", { name: "Adicionar linha" }).click();

  const recap = bloco.locator('[data-retencao="pendente"]');
  await expect(recap).toHaveCount(1);
  await expect(recap).toContainText(`“${RETENCAO_ESPERADA.rotulo}”`);
  await expect(recap).toContainText("R$ 1.048,00");

  // ⚠️ **A sugestão é CONSUMIDA**: o próximo formulário nasce em branco, sem
  // rótulo herdado — o default fiscal que o critério 7 do CONTAI-053 proíbe.
  await expect(destaque).toHaveCount(0);
  await bloco.getByRole("button", { name: "+ Adicionar outra linha" }).click();
  await expect(
    bloco.getByLabel("Rótulo (copie exatamente da nota)"),
  ).toHaveValue("");
  await expect(bloco.locator('[data-sugestao="retencao"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

  // O ESTADO GRAVADO — o rótulo é o LITERAL lido da nota, e a classificação é a
  // que o humano respondeu.
  const gravados = await documentos(db);
  const linhas = await linhasDeRetencao(db);
  expect(linhas).toHaveLength(1);
  expect(linhas[0]).toMatchObject({
    documento_id: gravados[0].id,
    rotulo_literal: RETENCAO_ESPERADA.rotulo,
    composicao: "tributo_identificado",
    tributo: "iss",
    e_desconto_efetivo: true,
    quem_recolhe: "empresa",
  });
  expect(Number(linhas[0].valor)).toBe(1048);
});

/**
 * **Critério 2, a segunda metade** — sugerido é sugerido: o que grava é o que
 * ficou no campo no momento do "Salvar", não o que o parser leu.
 */
test("5.2 · o rótulo e o valor sugeridos são substituíveis antes de salvar", async ({
  page,
  db,
}) => {
  await notaDeServicoAteOGate(
    page,
    "Sim",
    pdfComTexto(NFSE_COM_RETENCAO_RECONHECIVEL),
  );
  await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");

  const bloco = page.locator(BLOCO);
  await expect(bloco.locator('[data-sugestao="retencao"]')).toBeVisible();

  await bloco
    .getByLabel("Rótulo (copie exatamente da nota)")
    .fill("ISS Retido na Fonte");
  await bloco.getByLabel("Valor", { exact: true }).fill("1.000,00");
  await escolher(
    page,
    "O que esta linha representa?",
    "Total combinado, não aberto pela nota",
  );
  await escolher(
    page,
    "Esse valor é de fato abatido do que você transfere ao prestador?",
    "Não",
  );
  await bloco.getByRole("button", { name: "Adicionar linha" }).click();

  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

  const linhas = await linhasDeRetencao(db);
  expect(linhas).toHaveLength(1);
  expect(linhas[0].rotulo_literal).toBe("ISS Retido na Fonte");
  expect(Number(linhas[0].valor)).toBe(1000);
});

/**
 * **Critério 3 — sem sugestão, a experiência é a do CONTAI-053 sozinho.** As duas
 * fontes de "sem sugestão" convivem no mesmo teste: o PDF com texto que não fecha
 * trio nenhum e o PDF sem camada de texto (foto/scan, que é o anexo default desta
 * suíte). Nenhum dos dois é ERRO: o silêncio é o estado certo.
 */
test("5.3 · nota sem padrão reconhecido: formulário vazio, sem destaque e sem aviso", async ({
  page,
}) => {
  await notaDeServicoAteOGate(
    page,
    "Sim",
    pdfComTexto(NFSE_SEM_PADRAO_RECONHECIVEL),
  );
  await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");

  const bloco = page.locator(BLOCO);
  await expect(bloco.locator('[data-retencao="formulario"]')).toBeVisible();
  // A espera termina, e o que sobra é o formulário em branco — sem destaque de
  // sugestão e sem banner de falha.
  //
  // ⚠️ **`gate-lendo`/`gate-falhou` migraram no CONTAI-062**: os dois estados da
  // leitura saíram de dentro do repeater (onde só existiam ≥880px e só com o
  // gate já em "destacada") para o lado do próprio gate, em qualquer largura.
  // Por isso são procurados na `page`, não no `bloco`.
  await expect(page.locator('[data-sugestao="gate-lendo"]')).toHaveCount(0);
  await expect(bloco.locator('[data-sugestao="retencao"]')).toHaveCount(0);
  await expect(page.locator('[data-sugestao="gate-falhou"]')).toHaveCount(0);
  await expect(
    bloco.getByLabel("Rótulo (copie exatamente da nota)"),
  ).toHaveValue("");
  await expect(bloco.getByLabel("Valor", { exact: true })).toHaveValue("");
});

/**
 * **Critério 4 — falha da chamada NUNCA bloqueia o registro.**
 *
 * ⚠️ Falsificação de rede deliberada e nomeada: `abort` da nossa própria rota é a
 * única forma de produzir "rede caiu/timeout" contra o stack local. O que o teste
 * prova é o que nenhuma outra camada prova: a captura inteira continua
 * funcionando, com a linha digitada à mão, e o "Salvar registro" grava.
 */
test("5.4 · ⚠️ falha em /api/sugerir-retencao: avisa, não bloqueia, e o registro grava", async ({
  page,
  db,
}) => {
  await page.route("**/api/sugerir-retencao", (rota) => rota.abort("failed"));

  await notaDeServicoAteOGate(
    page,
    "Sim",
    pdfComTexto(NFSE_COM_RETENCAO_RECONHECIVEL),
  );
  await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");

  const bloco = page.locator(BLOCO);
  // CONTAI-062 — fora do repeater, e por isso na `page`.
  const falhou = page.locator('[data-sugestao="gate-falhou"]');
  await expect(falhou).toBeVisible();
  await expect(falhou).toContainText(
    "Não deu para ler a retenção desta nota automaticamente. Preencha as linhas à mão — o registro segue normalmente.",
  );
  // Sem sugestão nenhuma, e o formulário continua ali, vazio e digitável.
  await expect(bloco.locator('[data-sugestao="retencao"]')).toHaveCount(0);
  await expect(
    bloco.getByLabel("Rótulo (copie exatamente da nota)"),
  ).toHaveValue("");

  await adicionarLinha(page, {
    rotulo: "Total das Retenções (ISSQN / Federais)",
    valor: "540,00",
    composicao: "Total combinado, não aberto pela nota",
    descontoEfetivo: "Sim",
    quemRecolhe: "A empresa",
  });

  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();
  await expect(page.locator('[data-retencao="parcial"]')).toHaveCount(0);

  const linhas = await linhasDeRetencao(db);
  expect(linhas).toHaveLength(1);
  expect(linhas[0].rotulo_literal).toBe("Total das Retenções (ISSQN / Federais)");
});

/**
 * **Critério 4, o caso do TIMEOUT** — a resposta que nunca chega.
 *
 * ⚠️ O que este teste existe para impedir: a tentação de esconder o formulário
 * enquanto a sugestão não responde. Uma espera que esconde o campo transforma uma
 * sugestão opcional em pré-requisito da captura — e no canteiro, com rede ruim,
 * isso é o registro que não acontece.
 */
test("5.5 · ⚠️ sugestão pendurada: o formulário e o Salvar continuam funcionando", async ({
  page,
  db,
}) => {
  // Nunca resolve dentro do teste: a rota fica pendurada até o fim dele.
  await page.route("**/api/sugerir-retencao", async () => {});

  await notaDeServicoAteOGate(
    page,
    "Sim",
    pdfComTexto(NFSE_COM_RETENCAO_RECONHECIVEL),
  );
  await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");

  const bloco = page.locator(BLOCO);
  // O estado de espera aparece — e o formulário aparece JUNTO com ele.
  // CONTAI-062 — fora do repeater, e por isso na `page`.
  await expect(page.locator('[data-sugestao="gate-lendo"]')).toBeVisible();
  await expect(bloco.locator('[data-retencao="formulario"]')).toBeVisible();

  await adicionarLinha(page, {
    rotulo: "ISSRF",
    valor: "1.048,00",
    composicao: "Tributo único identificado",
    tributo: "ISS",
    descontoEfetivo: "Sim",
    quemRecolhe: "A empresa",
  });
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

  const linhas = await linhasDeRetencao(db);
  expect(linhas).toHaveLength(1);
  expect(linhas[0].rotulo_literal).toBe("ISSRF");
});

/**
 * **O bloqueante do Gate 2 do CONTAI-055, em forma de teste.**
 *
 * A sincronização da sugestão decidia por duas condições diferentes — o número por
 * `valorCentavos ?? sugestao`, o texto do input por `valorTexto || sugestao`. Elas
 * divergem exatamente em texto que **não parseia**: com `"1,"` no campo,
 * `parseValorInput` devolve `null`, então o número herdava a sugestão e o texto
 * não. A tela mostrava `"1,"` e a validação passava com R$ 1.048,00 — o que
 * gravaria não era o que estava à vista. Em campo de dinheiro que vira custo de
 * aquisição, é o pior tipo de divergência possível.
 *
 * ⚠️ A rota é SEGURADA, não falsificada: `rota.continue()` depois de o teste
 * liberar mantém a resposta REAL (unpdf + parser de verdade) e só a faz chegar
 * tarde, que é a única janela em que o bug existe.
 *
 * ⚠️ **Deixou de ser um `setTimeout` no CONTAI-062**, e a troca não é estética: até
 * aqui a leitura só começava DEPOIS do clique no gate, então 2s de atraso cobriam a
 * janela com folga. Agora ela começa ao ANEXAR o PDF — vários comandos antes —, e
 * um atraso fixo passaria a ser uma corrida contra o tempo de preenchimento do
 * formulário, verde ou vermelho por sorte. Com a rota segurada por promessa, quem
 * define a janela é o teste.
 */
test("5.6 · ⚠️ valor digitado pela metade não é substituído pela sugestão que chega depois", async ({
  page,
}) => {
  const liberarSugestao = await segurarSugestao(page);

  await notaDeServicoAteOGate(
    page,
    "Sim",
    pdfComTexto(NFSE_COM_RETENCAO_RECONHECIVEL),
  );
  await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");

  const bloco = page.locator(BLOCO);
  const campoValor = bloco.getByLabel("Valor", { exact: true });
  // CONTAI-062 — fora do repeater, e por isso na `page`.
  await expect(page.locator('[data-sugestao="gate-lendo"]')).toBeVisible();

  // Ele começa a digitar o valor ANTES de a leitura responder, e para no meio.
  await campoValor.fill("1,");
  liberarSugestao();

  // A sugestão chega: o rótulo (campo vazio) herda…
  await expect(
    bloco.getByLabel("Rótulo (copie exatamente da nota)"),
  ).toHaveValue(RETENCAO_ESPERADA.rotulo);
  // …e o valor NÃO, porque o campo não estava vazio.
  await expect(campoValor).toHaveValue("1,");

  // A prova de que tela e estado concordam: com as duas respostas fiscais dadas, o
  // que ainda falta é O VALOR — se o número tivesse herdado a sugestão em silêncio,
  // o botão estaria habilitado sobre um valor que a tela não mostra.
  await escolher(page, "O que esta linha representa?", "Tributo único identificado");
  await escolher(page, "Qual tributo?", "ISS");
  await escolher(
    page,
    "Esse valor é de fato abatido do que você transfere ao prestador?",
    "Não",
  );
  await expect(
    bloco.getByRole("button", { name: "Faltam 1 resposta para adicionar" }),
  ).toBeDisabled();

  // E corrigir o campo à mão continua funcionando normalmente.
  await campoValor.fill("1.048,00");
  await expect(
    bloco.getByRole("button", { name: "Adicionar linha" }),
  ).toBeEnabled();
});

// ══ 6 · CONTAI-062 — o GATE se sugere sozinho, a partir da leitura do PDF ══

/**
 * **A Dor de Origem, em forma de teste** (`docs/backlog/75-2026-09-26-gate-retencao-sugerido-na-extracao.md`):
 * *"eu não espero clicar em nada, se estou anexando o pdf e mandando extrair
 * automaticamente, eu espero que todo o formulário seja preenchido a partir daí"*.
 *
 * Fonte fiscal: **ADENDO 5** de
 * `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` — o gate
 * `retencao_na_nota` é pergunta de EXISTÊNCIA de texto impresso, aritmeticamente
 * conferível, e por isso pode ser sugerido; `notaNoCpf` e os quatro campos de
 * classificação da linha continuam proibidos, sem exceção (§4).
 *
 * ⚠️ **Nada stubado no caminho feliz**, como na seção 5: o PDF é montado no teste
 * e quem responde é a rota real → unpdf real → heurística real → parser real.
 */

test("6.1 · sem UM clique no gate: ele nasce sugerido, em âmbar, com selo e com o trecho literal", async ({
  page,
  db,
}) => {
  await notaDeServicoAteOGate(
    page,
    "Sim",
    pdfComTexto(NFSE_COM_RETENCAO_RECONHECIVEL),
  );

  // ⚠️ **Critério 2 — nenhum `escolher` no gate acima desta linha.** O que
  // preencheu a resposta foi a leitura do PDF, sozinha.
  const destacada = grupoDoGate(page).getByRole("radio", { name: /^Destacada/ });
  await expect(destacada).toBeChecked();
  await expect(
    grupoDoGate(page).getByRole("radio", { name: /^Nenhuma/ }),
  ).not.toBeChecked();

  // ⚠️ **Critério 4 — DOIS canais, nunca só cor** (ADENDO 5 §3, salvaguarda 1).
  // Canal 1: a pílula é âmbar claro, e NÃO o preenchido escuro que o app usa para
  // resposta afirmada pelo Mateus.
  const pilula = pilulaDoGate(page, "Destacada");
  await expect(pilula).toHaveClass(/border-amb/);
  await expect(pilula).toHaveClass(/bg-amb-bg/);
  await expect(pilula).not.toHaveClass(/bg-ink/);
  // Canal 2: o selo, com a palavra escrita…
  await expect(pilula.getByText("Sugerida", { exact: true })).toBeVisible();
  // …e o equivalente para quem não o vê, no nome acessível do próprio rádio.
  await expect(destacada).toHaveAccessibleName(
    /sugerida automaticamente, ainda não confirmada/,
  );

  // ⚠️ **Critério 5 / salvaguarda 4 — gate e linha na MESMA leitura.** O trecho
  // literal aparece ao lado do gate, fora do repeater: é ele que o Mateus confere
  // contra o papel antes de aceitar a sugestão.
  const trecho = page.locator('[data-sugestao="gate"]');
  await expect(trecho).toBeVisible();
  await expect(trecho).toContainText("Lido automaticamente desta nota");
  await expect(trecho).toContainText(`“${RETENCAO_ESPERADA.rotulo}”`);
  await expect(trecho).toContainText("R$ 1.048,00");
  await expect(trecho).toContainText(
    "Sugerido a partir da leitura do PDF — confira antes de salvar.",
  );

  // E a linha veio junto, no formulário — os dois campos de LEITURA preenchidos…
  const bloco = page.locator(BLOCO);
  await expect(
    bloco.getByLabel("Rótulo (copie exatamente da nota)"),
  ).toHaveValue(RETENCAO_ESPERADA.rotulo);
  await expect(bloco.getByLabel("Valor", { exact: true })).toHaveValue(
    RETENCAO_ESPERADA.valor,
  );
  // …e os QUATRO de classificação fiscal em branco, como sempre (ADENDO 5 §4).
  for (const radio of await bloco.getByRole("radio").all()) {
    await expect(radio).not.toBeChecked();
  }

  // ⚠️ **`notaNoCpf` não mudou de comportamento** (critério 11): ele está marcado
  // porque o helper o respondeu com o dedo, e a pílula dele é a ESCURA de sempre
  // — nenhuma sugestão encostou nesse campo.
  const cpf = page
    .getByRole("group", { name: "A nota está no seu CPF?" })
    .locator("label")
    .filter({ hasText: "Sim" });
  await expect(cpf).toHaveClass(/bg-ink/);
  await expect(cpf.getByText("Sugerida", { exact: true })).toHaveCount(0);

  // ⚠️ **Critério 6 / a confirmação IMPLÍCITA**: ele completa a linha e salva sem
  // nunca tocar no gate. O que grava é a resposta, e só ela — a origem
  // ("sugerida") é estado de tela e não existe no banco.
  await escolher(page, "O que esta linha representa?", "Tributo único identificado");
  await escolher(page, "Qual tributo?", "ISS");
  await escolher(
    page,
    "Esse valor é de fato abatido do que você transfere ao prestador?",
    "Sim",
  );
  await escolher(page, "Quem recolhe isto?", "A empresa");
  await bloco.getByRole("button", { name: "Adicionar linha" }).click();
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

  const gravados = await documentos(db);
  expect(gravados).toHaveLength(1);
  expect(gravados[0].retencao_na_nota).toBe("destacada");
  const linhas = await linhasDeRetencao(db);
  expect(linhas).toHaveLength(1);
  expect(linhas[0].rotulo_literal).toBe(RETENCAO_ESPERADA.rotulo);
  expect(Number(linhas[0].valor)).toBe(1048);
});

/**
 * **Critério 8 — o que acontece ao TOCAR**, nas duas direções.
 *
 * ⚠️ O toque na opção já sugerida é o caso que a spec do Gate 0 previu errado: ela
 * supunha que o `onChange` do React dispara em todo clique de rádio, e ele só
 * dispara quando `checked` muda. Este teste é o que trava a correção (um `onClick`
 * que só existe enquanto a pílula está sugerida) — sem ela, o selo "Sugerida"
 * ficaria na tela depois de o Mateus ter confirmado com o dedo.
 */
test("6.2 · tocar na opção sugerida troca só a origem; tocar na outra troca a resposta", async ({
  page,
}) => {
  await notaDeServicoAteOGate(
    page,
    "Sim",
    pdfComTexto(NFSE_COM_RETENCAO_RECONHECIVEL),
  );
  const pilula = pilulaDoGate(page, "Destacada");
  await expect(pilula).toHaveClass(/border-amb/);

  // Uma linha JÁ ACUMULADA antes do toque: é ela que prova que o toque na mesma
  // opção não passa pela limpeza de `linhasPendentes`.
  const bloco = page.locator(BLOCO);
  await escolher(page, "O que esta linha representa?", "Tributo único identificado");
  await escolher(page, "Qual tributo?", "ISS");
  await escolher(
    page,
    "Esse valor é de fato abatido do que você transfere ao prestador?",
    "Não",
  );
  await bloco.getByRole("button", { name: "Adicionar linha" }).click();
  await expect(bloco.locator('[data-retencao="pendente"]')).toHaveCount(1);
  // A linha entrou, mas o gate continua SUGERIDO: ninguém o tocou ainda.
  await expect(pilula).toHaveClass(/border-amb/);

  // ── Toque 1: a MESMA opção. Resposta igual, origem manual, linha intacta.
  await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");
  await expect(
    grupoDoGate(page).getByRole("radio", { name: /^Destacada/ }),
  ).toBeChecked();
  await expect(pilula).toHaveClass(/bg-ink/);
  await expect(pilula).not.toHaveClass(/border-amb/);
  await expect(pilula.getByText("Sugerida", { exact: true })).toHaveCount(0);
  await expect(bloco.locator('[data-retencao="pendente"]')).toHaveCount(1);

  // ── Toque 2: a OUTRA opção. Resposta troca, e a limpeza de sempre roda.
  await escolher(page, "Esta nota destaca alguma retenção?", "Nenhuma");
  await expect(page.locator('[data-sugestao="gate"]')).toHaveCount(0);
  await expect(bloco).toHaveCount(0);

  // ⚠️ E voltar para "Destacada" à mão devolve o bloco VAZIO, sem linha fantasma
  // e **sem o trecho literal de volta**: a sugestão foi CONSUMIDA quando a linha
  // foi adicionada (invariante do CONTAI-055), e o app não reafirma uma leitura
  // que já foi aceita e depois descartada. Quem prova o caminho oposto — sugestão
  // guardada, ainda não consumida, reaparecendo ao marcar "Destacada" à mão — é o
  // 6.4 abaixo.
  await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");
  await expect(page.locator(BLOCO)).toBeVisible();
  await expect(
    page.locator(BLOCO).locator('[data-retencao="pendente"]'),
  ).toHaveCount(0);
  await expect(page.locator('[data-sugestao="gate"]')).toHaveCount(0);
  await expect(
    page.locator(BLOCO).getByLabel("Rótulo (copie exatamente da nota)"),
  ).toHaveValue("");
  // Resposta dada pelo dedo dele: pílula escura, sem selo.
  await expect(pilulaDoGate(page, "Destacada")).toHaveClass(/bg-ink/);
});

/**
 * **Critério 3 / salvaguardas 2 e 3 do ADENDO 5 §3** — ausência de padrão não é
 * prova de ausência de retenção.
 *
 * ⚠️ O que este teste impede: o app "ajudar" marcando "Nenhuma" quando o parser
 * não acha o formato. Nota que o parser não entende deixa o gate VAZIO, em
 * silêncio — vazio pergunta, preenchido afirma.
 */
test("6.3 · nota sem padrão reconhecido deixa o gate VAZIO — nunca 'Nenhuma'", async ({
  page,
}) => {
  await notaDeServicoAteOGate(
    page,
    "Sim",
    pdfComTexto(NFSE_SEM_PADRAO_RECONHECIVEL),
  );

  // A leitura termina (a espera sai da tela) e nada foi respondido por ela.
  await expect(page.locator('[data-sugestao="gate-lendo"]')).toHaveCount(0);
  for (const radio of await grupoDoGate(page).getByRole("radio").all()) {
    await expect(radio).not.toBeChecked();
  }
  // `sugestao: null` não é falha, e não é resposta: nenhum banner de gate aparece.
  await expect(page.locator('[data-sugestao="gate"]')).toHaveCount(0);
  await expect(page.locator('[data-sugestao="gate-falhou"]')).toHaveCount(0);
  await expect(page.getByText("Sugerida", { exact: true })).toHaveCount(0);
  // E o repeater continua fora de cena: sem gate em "destacada", não existe.
  await expect(page.locator(BLOCO)).toHaveCount(0);
});

/**
 * ⚠️ **Critério 7 — a condição de corrida, e ela é o pior caso deste ticket.**
 *
 * O Mateus responde o gate com a leitura do PDF EM VOO. Se a sugestão que chega
 * depois sobrescrevesse a resposta dele, o app afirmaria "esta nota destaca
 * retenção" numa nota que ele acabou de dizer que não destaca — pior que o bug
 * que o ticket corrige, porque desta vez contradiria uma afirmação humana.
 *
 * A segunda metade do teste é o que impede um falso verde: depois de provar que o
 * gate NÃO mudou, ele marca "Destacada" à mão e o trecho literal aparece na hora —
 * prova de que a resposta da leitura realmente chegou e ficou guardada, e que o
 * teste não passou só porque a sugestão nunca veio.
 */
test("6.4 · resposta manual DURANTE o fetch em voo vence a sugestão que chega depois", async ({
  page,
  db,
}) => {
  const liberarSugestao = await segurarSugestao(page);

  await notaDeServicoAteOGate(
    page,
    "Sim",
    pdfComTexto(NFSE_COM_RETENCAO_RECONHECIVEL),
  );

  // A leitura está comprovadamente em voo, e o gate ainda está vazio.
  await expect(page.locator('[data-sugestao="gate-lendo"]')).toBeVisible();
  for (const radio of await grupoDoGate(page).getByRole("radio").all()) {
    await expect(radio).not.toBeChecked();
  }

  // O dedo dele responde AGORA: esta nota não destaca retenção.
  await escolher(page, "Esta nota destaca alguma retenção?", "Nenhuma");
  await expect(pilulaDoGate(page, "Nenhuma")).toHaveClass(/bg-ink/);

  // …e só então a leitura responde, com a sugestão de "destacada".
  liberarSugestao();
  await expect(page.locator('[data-sugestao="gate-lendo"]')).toHaveCount(0);

  // ⚠️ A resposta dele continua de pé, e nenhuma pílula ficou âmbar.
  await expect(
    grupoDoGate(page).getByRole("radio", { name: /^Nenhuma/ }),
  ).toBeChecked();
  await expect(
    grupoDoGate(page).getByRole("radio", { name: /^Destacada/ }),
  ).not.toBeChecked();
  await expect(page.getByText("Sugerida", { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-sugestao="gate"]')).toHaveCount(0);
  await expect(page.locator(BLOCO)).toHaveCount(0);

  // A prova de que a sugestão CHEGOU e só não encostou no gate: marcando
  // "Destacada" à mão, o trecho literal aparece sem nenhum fetch novo.
  await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");
  await expect(page.locator('[data-sugestao="gate"]')).toContainText(
    `“${RETENCAO_ESPERADA.rotulo}”`,
  );
  await expect(pilulaDoGate(page, "Destacada")).toHaveClass(/bg-ink/);

  // E o que grava é a resposta que ficou na tela, nunca a da leitura.
  await escolher(page, "Esta nota destaca alguma retenção?", "Nenhuma");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();
  const gravados = await documentos(db);
  expect(gravados[0].retencao_na_nota).toBe("nenhuma");
  expect(await linhasDeRetencao(db)).toHaveLength(0);
});

/**
 * **Critério 5 em tela ESTREITA — o caso que justifica o trecho literal viver
 * fora do repeater.**
 *
 * ⚠️ Abaixo de 880px o `FormularioDeLinha` está no DOM mas escondido por CSS
 * (`hidden larga:flex`, mecanismo do CONTAI-053). Se o trecho lido morasse só lá
 * dentro, a salvaguarda 1 do ADENDO 5 §3 ("mostrar, ao lado, o trecho literal que
 * o parser leu") seria letra morta justamente onde o Mateus tem menos contexto na
 * tela. Este teste prova que o gate se sugere E que o trecho aparece, com o
 * repeater comprovadamente invisível.
 *
 * ⚠️ Mora neste arquivo — e não no `retencao.spec.ts` do projeto `mobile` — porque
 * o que ele prova é o DELTA entre as duas larguras da mesma sugestão, com a mesma
 * fixture de PDF dos testes acima. O `viewport` é estreitado aqui de propósito.
 */
test.describe("6.5 · no piso de 375px", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("o gate se sugere e o trecho literal aparece, com o repeater invisível", async ({
    page,
  }) => {
    await notaDeServicoAteOGate(
      page,
      "Sim",
      pdfComTexto(NFSE_COM_RETENCAO_RECONHECIVEL),
    );

    await expect(
      grupoDoGate(page).getByRole("radio", { name: /^Destacada/ }),
    ).toBeChecked();
    const pilula = pilulaDoGate(page, "Destacada");
    await expect(pilula).toHaveClass(/border-amb/);
    await expect(pilula.getByText("Sugerida", { exact: true })).toBeVisible();

    // ⚠️ O trecho literal — aqui é o ÚNICO lugar da tela onde ele existe.
    const trecho = page.locator('[data-sugestao="gate"]');
    await expect(trecho).toBeVisible();
    await expect(trecho).toContainText(`“${RETENCAO_ESPERADA.rotulo}”`);
    await expect(trecho).toContainText("R$ 1.048,00");

    // O repeater está montado e ESCONDIDO — `toBeHidden`, nunca `toHaveCount(0)`:
    // quem o esconde é o CSS, não o JS (spec do CONTAI-053, §1).
    await expect(page.locator(BLOCO)).toBeHidden();

    // E a dica do piso continua a de sempre, byte a byte.
    await expect(
      page.getByText(
        "Você detalha isso depois, sentado — aqui só marcamos que a nota tem retenção.",
      ),
    ).toBeVisible();
  });
});

/**
 * ⚠️ **O BLOQUEANTE do Gate 2 do CONTAI-062, em forma de teste.**
 *
 * A primeira versão do ticket invalidava a sugestão da LINHA na troca do anexo e
 * esquecia o GATE: trocado o PDF reconhecido por um sem padrão, a pílula continuava
 * "Destacada" com o selo "Sugerida", sem trecho literal embaixo e sem linha —
 * motivada por um papel que já não estava mais anexado. É literalmente "a leitura
 * de um papel exibida ao lado de outro", a regra que o bloco de invalidação existe
 * para impedir, e é o que as salvaguardas 1 e 4 do ADENDO 5 §3 proíbem: gate e
 * linha se sugerem juntos, logo morrem juntos.
 *
 * As três formas de o papel deixar de estar ali entram no mesmo teste, porque a
 * causa é uma só (`alvoDaSugestaoDeRetencao` virou outro): outro PDF, uma foto que
 * o parser nem tenta ler, e a remoção do anexo.
 */
test("6.6 · trocar ou remover o anexo mata o gate SUGERIDO junto com a linha", async ({
  page,
}) => {
  const anexo = page.getByLabel("Arquivo");
  const destacada = grupoDoGate(page).getByRole("radio", { name: /^Destacada/ });

  await notaDeServicoAteOGate(
    page,
    "Sim",
    pdfComTexto(NFSE_COM_RETENCAO_RECONHECIVEL),
  );
  await expect(destacada).toBeChecked();
  await expect(page.locator('[data-sugestao="gate"]')).toBeVisible();

  /** Nenhum resquício do papel anterior: nem resposta, nem selo, nem trecho. */
  async function gateLimpo() {
    for (const radio of await grupoDoGate(page).getByRole("radio").all()) {
      await expect(radio).not.toBeChecked();
    }
    await expect(page.getByText("Sugerida", { exact: true })).toHaveCount(0);
    await expect(page.locator('[data-sugestao="gate"]')).toHaveCount(0);
    // Sem gate em "destacada" o repeater não existe — e com ele vai a linha.
    await expect(page.locator(BLOCO)).toHaveCount(0);
  }

  // ── (1) outro PDF, sem padrão reconhecível.
  await anexo.setInputFiles({
    name: "nf-outra.pdf",
    mimeType: "application/pdf",
    buffer: pdfComTexto(NFSE_SEM_PADRAO_RECONHECIVEL),
  });
  await gateLimpo();

  // ── (2) uma FOTO: o parser nem é acionado (`type !== application/pdf`).
  await anexo.setInputFiles({
    name: "nf-1042.pdf",
    mimeType: "application/pdf",
    buffer: pdfComTexto(NFSE_COM_RETENCAO_RECONHECIVEL),
  });
  await expect(destacada).toBeChecked();
  await anexo.setInputFiles({
    name: "foto-da-nota.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("nao-e-pdf"),
  });
  await gateLimpo();

  // ── (3) o anexo REMOVIDO de vez.
  await anexo.setInputFiles({
    name: "nf-1042.pdf",
    mimeType: "application/pdf",
    buffer: pdfComTexto(NFSE_COM_RETENCAO_RECONHECIVEL),
  });
  await expect(destacada).toBeChecked();
  await anexo.setInputFiles([]);
  await gateLimpo();
});

/**
 * **O contraponto do 6.6, e é ele que impede a correção de virar excesso.**
 *
 * Uma resposta MANUAL não é leitura de papel nenhum: é afirmação do Mateus sobre a
 * nota. Trocar o anexo não a revoga — é o critério 7 ("resposta manual sempre
 * vence") aplicado à troca de papel, e não só à corrida do fetch. Apagá-la aqui
 * seria o app desfazendo uma resposta humana por conta própria.
 *
 * O caminho escolhido prova as duas coisas de uma vez: ele responde "Nenhuma" com
 * um PDF que o parser não entende e DEPOIS anexa o que ele entende — então a
 * sugestão chega de verdade, contra um gate já respondido, e ainda assim perde.
 */
test("6.7 · resposta MANUAL sobrevive à troca de anexo — só a sugerida morre", async ({
  page,
  db,
}) => {
  await notaDeServicoAteOGate(
    page,
    "Sim",
    pdfComTexto(NFSE_SEM_PADRAO_RECONHECIVEL),
  );
  // O dedo dele responde: esta nota não destaca retenção.
  await escolher(page, "Esta nota destaca alguma retenção?", "Nenhuma");
  await expect(pilulaDoGate(page, "Nenhuma")).toHaveClass(/bg-ink/);

  // Troca o anexo por um que o parser RECONHECE — a sugestão chega mesmo.
  await page.getByLabel("Arquivo").setInputFiles({
    name: "nf-1042.pdf",
    mimeType: "application/pdf",
    buffer: pdfComTexto(NFSE_COM_RETENCAO_RECONHECIVEL),
  });

  // ⚠️ A resposta dele continua de pé, e ESCURA: afirmada, nunca sugerida.
  await expect(
    grupoDoGate(page).getByRole("radio", { name: /^Nenhuma/ }),
  ).toBeChecked();
  await expect(pilulaDoGate(page, "Nenhuma")).toHaveClass(/bg-ink/);
  await expect(pilulaDoGate(page, "Nenhuma")).not.toHaveClass(/border-amb/);
  await expect(page.getByText("Sugerida", { exact: true })).toHaveCount(0);

  // Prova de que a leitura do NOVO anexo chegou e só não encostou no gate: ao
  // marcar "Destacada" à mão, o trecho literal do papel novo aparece na hora.
  await escolher(page, "Esta nota destaca alguma retenção?", "Destacada");
  await expect(page.locator('[data-sugestao="gate"]')).toContainText(
    `“${RETENCAO_ESPERADA.rotulo}”`,
  );
  await expect(pilulaDoGate(page, "Destacada")).toHaveClass(/bg-ink/);

  // E o que grava é a resposta afirmada, não a leitura.
  await escolher(page, "Esta nota destaca alguma retenção?", "Nenhuma");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();
  const gravados = await documentos(db);
  expect(gravados[0].retencao_na_nota).toBe("nenhuma");
  expect(await linhasDeRetencao(db)).toHaveLength(0);
});
