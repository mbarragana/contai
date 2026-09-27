import { documentos } from "./banco";
import { expect, test } from "./fixtures";
import { escolher, preencherDocumentoBasico } from "./formularios";
import {
  CNO_DA_OBRA_SEED,
  CNO_DE_OUTRA_OBRA,
  NFSE_COM_CNO_DESTA_OBRA,
  NFSE_COM_CNO_DE_OUTRA_OBRA,
  NFSE_COM_DOIS_CNOS,
  NFSE_SEM_PADRAO_RECONHECIVEL,
  pdfComTexto,
} from "./pdf-sintetico";

/**
 * **CONTAI-069 — o CNO impresso na nota sugere o gate `cnoNaNota`.**
 *
 * Fonte do desenho: `design/mocks/CONTAI-069.md`. Fonte fiscal: o Gate Fiscal do
 * ticket `docs/tickets/CONTAI-069.md`, que herda
 * `docs/pareceres/2026-09-27-extracao-tributo-e-cno.md` (Pergunta 2 + ADENDO).
 *
 * ⚠️ **Esta suíte guarda uma decisão de produto que SOBREPÔS a recomendação do
 * `contador`.** Ele reprovou a marcação automática de `cnoNaNota = "desta_obra"`
 * **duas vezes** — a 2ª já sob igualdade EXATA de dígitos — e o Mateus decidiu
 * implementá-la mesmo assim, como sugestão editável
 * (`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`). As
 * salvaguardas provadas aqui não são zelo de quem escreveu o teste: são a
 * contenção do risco que o próprio parecer nomeou. Nenhuma delas é opcional.
 *
 * ⚠️ **Nada stubado no caminho feliz**: o PDF é montado no teste e quem responde
 * é a rota real → `unpdf` real → `avaliarTexto` real → parser real, contra o
 * Postgres local. A única falsificação é de TEMPO (a rota segurada no 7.6), pelo
 * mesmo motivo nomeado no CONTAI-062: é a única forma de abrir a janela da
 * corrida.
 *
 * Roda no projeto `mobile` (375px), onde mora toda a suíte de comportamento: o
 * gate do CNO renderiza em qualquer largura, e este ticket não introduz nenhuma
 * decisão de mostrar/esconder por viewport.
 */

const CNPJ_EMITENTE = "11.222.333/0001-81";

/** A NF de serviço preenchida até os dois gates, sem responder nenhum deles. */
async function notaDeServicoAteOsGates(
  page: import("@playwright/test").Page,
  linhas: string[],
) {
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
      buffer: pdfComTexto(linhas),
    },
  });
}

/** O fieldset do gate do CNO. */
function grupoDoCno(page: import("@playwright/test").Page) {
  return page.getByRole("group", {
    name: "Qual CNO está impresso nesta nota?",
  });
}

/**
 * A pílula de uma opção, para conferir o TRATAMENTO VISUAL dela. Casa pelo
 * `hasText` porque o nome acessível do rádio ganha o `sr-only` da sugestão — o
 * mesmo locator serve nos dois estados.
 */
function pilulaDoCno(page: import("@playwright/test").Page, texto: string) {
  return grupoDoCno(page).locator("label").filter({ hasText: texto });
}

/** Nenhuma das três opções marcada — "vazio pergunta". */
async function gateDoCnoVazio(page: import("@playwright/test").Page) {
  for (const radio of await grupoDoCno(page).getByRole("radio").all()) {
    await expect(radio).not.toBeChecked();
  }
  await expect(page.getByText("Sugerida", { exact: true })).toHaveCount(0);
}

/**
 * ⚠️ **Segura a resposta REAL da rota até o teste liberar** — `rota.continue()`,
 * nunca `fulfill()`: o que passa pelo fio continua sendo `unpdf` + parser de
 * verdade. O único controle do teste é sobre o QUANDO.
 */
async function segurarLeitura(page: import("@playwright/test").Page) {
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

// ══ (a) Os dígitos batem ══════════════════════════════════════════════════

test("7.1 · CNO idêntico: o gate nasce sugerido, em âmbar, com os dois números na tela", async ({
  page,
  db,
}) => {
  await notaDeServicoAteOsGates(page, NFSE_COM_CNO_DESTA_OBRA);

  // ⚠️ **Nenhum `escolher` no gate do CNO acima desta linha.** Quem preencheu a
  // resposta foi a leitura do papel, sozinha.
  const destaObra = grupoDoCno(page).getByRole("radio", {
    name: /^É o CNO desta obra/,
  });
  await expect(destaObra).toBeChecked();

  // ⚠️ **DOIS canais, nunca só cor** — mesmo par de classes e mesmo selo do
  // CONTAI-062 (`campos.tsx` não mudou uma linha).
  const pilula = pilulaDoCno(page, "É o CNO desta obra");
  await expect(pilula).toHaveClass(/border-amb/);
  await expect(pilula).toHaveClass(/bg-amb-bg/);
  await expect(pilula).not.toHaveClass(/bg-ink/);
  await expect(pilula.getByText("Sugerida", { exact: true })).toBeVisible();
  await expect(destaObra).toHaveAccessibleName(
    /sugerida automaticamente, ainda não confirmada/,
  );

  // ⚠️ **O veredito em palavras é a recomendação literal do `contador`** (ADENDO
  // §5): a máquina, não o olho do Mateus, dizendo se os dígitos batem.
  const banner = page.locator('[data-sugestao="cno-bate"]');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Lido automaticamente desta nota");
  await expect(banner).toContainText(`CNO da obra: ${CNO_DA_OBRA_SEED}`);
  await expect(banner).toContainText(`CNO da nota: ${CNO_DA_OBRA_SEED}`);
  await expect(banner).toContainText("— números idênticos.");
  // A segunda oração aparece AQUI porque a sugestão é que decidiu o campo — e é
  // exatamente essa condição que o 7.6 prova pelo avesso.
  await expect(banner).toContainText(
    "A resposta abaixo já veio marcada; confira antes de salvar.",
  );
  await expect(page.locator('[data-sugestao="cno-ambiguo"]')).toHaveCount(0);

  // ⚠️ **`notaNoCpf` não mudou de comportamento**: marcado pelo dedo dele, com a
  // pílula ESCURA de sempre. Nenhuma sugestão encosta nesse campo.
  const cpf = page
    .getByRole("group", { name: "A nota está no seu CPF?" })
    .locator("label")
    .filter({ hasText: "Sim" });
  await expect(cpf).toHaveClass(/bg-ink/);

  // ⚠️ **A confirmação IMPLÍCITA** (spec §6): ele salva sem tocar no gate. O que
  // grava é a resposta; a origem "sugerida" é estado de tela e não existe no
  // banco — nenhum valor novo de enum, nenhuma migration.
  await escolher(page, "Esta nota destaca alguma retenção?", "Nenhuma");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();

  const gravados = await documentos(db);
  expect(gravados).toHaveLength(1);
  expect(gravados[0].nota_traz_cno).toBe(true);
  expect(gravados[0].cno_referenciado).toBe(CNO_DA_OBRA_SEED);
});

/** Critério 12 — mecanismo espelhado do critério 8 do CONTAI-062. */
test("7.2 · tocar na opção sugerida troca só a origem; tocar em outra troca a resposta", async ({
  page,
}) => {
  await notaDeServicoAteOsGates(page, NFSE_COM_CNO_DESTA_OBRA);
  const pilula = pilulaDoCno(page, "É o CNO desta obra");
  await expect(pilula).toHaveClass(/border-amb/);

  // ── Toque 1: a MESMA opção. Resposta igual, origem manual — âmbar vira escuro.
  await escolher(page, "Qual CNO está impresso nesta nota?", "É o CNO desta obra");
  await expect(
    grupoDoCno(page).getByRole("radio", { name: /^É o CNO desta obra/ }),
  ).toBeChecked();
  await expect(pilula).toHaveClass(/bg-ink/);
  await expect(pilula).not.toHaveClass(/border-amb/);
  await expect(pilula.getByText("Sugerida", { exact: true })).toHaveCount(0);
  // ⚠️ O banner do veredito NÃO vai embora com a confirmação: o que ele diz
  // (os dois números, e que são idênticos) continua sendo verdade sobre o papel.
  await expect(page.locator('[data-sugestao="cno-bate"]')).toBeVisible();
  await expect(page.locator('[data-sugestao="cno-bate"]')).toContainText(
    "— números idênticos.",
  );
  // ⚠️ **Mas "já veio marcada" SOME no mesmo toque** (bloqueante do Gate 2): a
  // resposta acabou de virar dele. O veredito é sobre os números e fica; a frase
  // sobre a origem do campo sai junto com o selo "Sugerida".
  await expect(page.locator('[data-sugestao="cno-bate"]')).not.toContainText(
    "já veio marcada",
  );

  // ── Toque 2: "A nota não traz CNO". A resposta troca e a consequência de hoje
  // dispara normalmente — o banner de pendência do CONTAI-007.
  await escolher(page, "Qual CNO está impresso nesta nota?", "A nota não traz CNO");
  await expect(
    grupoDoCno(page).getByRole("radio", { name: /^A nota não traz CNO/ }),
  ).toBeChecked();
  await expect(pilulaDoCno(page, "A nota não traz CNO")).toHaveClass(/bg-ink/);
  await expect(page.getByText("Sugerida", { exact: true })).toHaveCount(0);
});

// ══ (b) Achou, e os dígitos NÃO batem ═════════════════════════════════════

/**
 * ⚠️ **O gate fica VAZIO, e o banner é a única coisa na tela que explica por
 * quê** (critério 7). Sugerir `"outra_obra"` aqui seria a automação que o
 * `contador` e o Mateus concordam em proibir: o espelho `outra_obra` BLOQUEIA o
 * salvamento e é erro sem conserto depois da emissão.
 */
test("7.3 · CNO diferente: gate VAZIO, os dois números lado a lado e 'números diferentes'", async ({
  page,
}) => {
  await notaDeServicoAteOsGates(page, NFSE_COM_CNO_DE_OUTRA_OBRA);

  const banner = page.locator('[data-sugestao="cno-diverge"]');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(`CNO da obra: ${CNO_DA_OBRA_SEED}`);
  await expect(banner).toContainText(`CNO da nota: ${CNO_DE_OUTRA_OBRA}`);
  await expect(banner).toContainText("— números diferentes");

  // Nada marcado, nenhum selo — e nenhum bloqueio: o app não concluiu
  // "outra obra", só mostrou os dois números.
  await gateDoCnoVazio(page);
  await expect(page.locator('[data-sugestao="cno-bate"]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "CNO impresso é de outra obra" }),
  ).toHaveCount(0);
});

// ══ (c) Não achou nada ════════════════════════════════════════════════════

/**
 * Critério 8 — comportamento idêntico ao de antes do ticket. O silêncio aqui é o
 * estado certo: ausência de número rotulado não é prova de que a nota não traz
 * CNO, que é resposta do Mateus e nunca conclusão de parser.
 */
test("7.4 · nota sem rótulo de CNO: nada aparece, gate vazio, silêncio total", async ({
  page,
}) => {
  await notaDeServicoAteOsGates(page, NFSE_SEM_PADRAO_RECONHECIVEL);

  // A leitura termina (a espera sai da tela) e nada foi respondido por ela.
  await expect(page.locator('[data-sugestao="gate-lendo"]')).toHaveCount(0);
  await gateDoCnoVazio(page);
  await expect(page.locator('[data-sugestao="cno-bate"]')).toHaveCount(0);
  await expect(page.locator('[data-sugestao="cno-diverge"]')).toHaveCount(0);
  await expect(page.locator('[data-sugestao="cno-ambiguo"]')).toHaveCount(0);
});

// ══ (d) Mais de um candidato ══════════════════════════════════════════════

/**
 * ⚠️ **Pre-mortem 2 do ticket, e o ponto fino está no final**: um dos dois
 * números BATE com a obra. Escolher esse seria o app decidindo qual número do
 * papel vale — e o silêncio leria como automação quebrada numa nota que
 * "claramente" traz o CNO. Aviso explícito, gate vazio.
 */
test("7.5 · dois CNOs com dígitos diferentes: aviso explícito, nunca escolha automática", async ({
  page,
}) => {
  await notaDeServicoAteOsGates(page, NFSE_COM_DOIS_CNOS);

  const aviso = page.locator('[data-sugestao="cno-ambiguo"]');
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText(
    "Mais de um número de CNO encontrado nesta nota — confira no papel antes de responder.",
  );
  // Os dois números aparecem, com o rótulo como está impresso no papel.
  await expect(aviso).toContainText(`CNO: ${CNO_DE_OUTRA_OBRA}`);
  await expect(aviso).toContainText(`Matricula CEI: ${CNO_DA_OBRA_SEED}`);

  await gateDoCnoVazio(page);
  await expect(page.locator('[data-sugestao="cno-bate"]')).toHaveCount(0);
  await expect(page.locator('[data-sugestao="cno-diverge"]')).toHaveCount(0);
});

// ══ (e) e (f) A resposta manual vence, sempre ═════════════════════════════

/**
 * ⚠️ **Critério 11 — a condição de corrida, e é o pior caso deste ticket.** O
 * Mateus responde o gate com a leitura EM VOO. Se a sugestão que chega depois
 * sobrescrevesse a resposta dele, o app afirmaria "esta nota traz o CNO desta
 * obra" — o valor que faz a nota entrar limpa em `baseCentavos` — em cima de uma
 * resposta humana que dizia outra coisa.
 *
 * A segunda metade do teste impede o falso verde: depois de provar que o gate não
 * mudou, o banner do veredito é conferido na tela — prova de que a leitura
 * chegou de verdade, e que o teste não passou só porque a sugestão nunca veio.
 */
test("7.6 · resposta manual DURANTE a leitura em voo vence a sugestão que chega depois", async ({
  page,
  db,
}) => {
  const liberarLeitura = await segurarLeitura(page);

  await notaDeServicoAteOsGates(page, NFSE_COM_CNO_DESTA_OBRA);

  // A leitura está comprovadamente em voo, e o gate ainda está vazio.
  await expect(page.locator('[data-sugestao="gate-lendo"]')).toBeVisible();
  await gateDoCnoVazio(page);

  // O dedo dele responde AGORA: esta nota não traz CNO.
  await escolher(page, "Qual CNO está impresso nesta nota?", "A nota não traz CNO");
  await expect(pilulaDoCno(page, "A nota não traz CNO")).toHaveClass(/bg-ink/);

  // …e só então a leitura responde, com um CNO que bate exato.
  liberarLeitura();
  await expect(page.locator('[data-sugestao="gate-lendo"]')).toHaveCount(0);

  // ⚠️ A resposta dele continua de pé, e nenhuma pílula ficou âmbar.
  await expect(
    grupoDoCno(page).getByRole("radio", { name: /^A nota não traz CNO/ }),
  ).toBeChecked();
  await expect(
    grupoDoCno(page).getByRole("radio", { name: /^É o CNO desta obra/ }),
  ).not.toBeChecked();
  await expect(page.getByText("Sugerida", { exact: true })).toHaveCount(0);

  // A prova de que a leitura CHEGOU e só não encostou no gate: o veredito está
  // na tela, com os dois números idênticos.
  const banner = page.locator('[data-sugestao="cno-bate"]');
  await expect(banner).toContainText("— números idênticos.");

  // ⚠️ **O BLOQUEANTE do Gate 2, em forma de teste.** O veredito continua de pé
  // (os números SÃO idênticos, isso é fato sobre o papel), mas o banner não pode
  // dizer que "a resposta abaixo já veio marcada": ela não veio da leitura, veio
  // do dedo dele, e está em `"nao_traz"`. Afirmar o contrário numa tela que
  // decide elegibilidade da nota na base da aferição não é imprecisão de texto —
  // é o app descrevendo errado um ato do Mateus.
  await expect(banner).not.toContainText("já veio marcada");
  await expect(banner).not.toContainText("confira antes de salvar");

  // E o que grava é a resposta que ficou na tela, nunca a da leitura: nota sem
  // CNO vira PENDÊNCIA, com `cno_referenciado` nulo.
  await escolher(page, "Esta nota destaca alguma retenção?", "Nenhuma");
  // ⚠️ O rótulo continua "Salvar registro": o "Salvar mesmo assim" do
  // CONTAI-007 é para OBRA sem CNO, não para NOTA sem CNO. Responder
  // `nao_traz` salva com pendência, e o botão não muda.
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(page.getByRole("heading", { name: "Registrado ✓" })).toBeVisible();
  const gravados = await documentos(db);
  expect(gravados[0].nota_traz_cno).toBe(false);
  expect(gravados[0].cno_referenciado).toBeNull();
});

/**
 * ⚠️ **Critério 13 — a mesma assimetria corrigida no Gate 2 do CONTAI-062,
 * aplicada ao CNO.** A sugestão morre com o papel que a motivou; a resposta
 * MANUAL não, porque ela é afirmação do Mateus sobre a nota e não leitura de
 * papel nenhum.
 *
 * As duas metades num teste só, porque a causa é uma só (o anexo trocou).
 */
test("7.7 · troca de anexo mata a SUGESTÃO; a resposta manual sobrevive", async ({
  page,
}) => {
  const anexo = page.getByLabel("Arquivo");
  const destaObra = grupoDoCno(page).getByRole("radio", {
    name: /^É o CNO desta obra/,
  });

  // ── (1) a sugestão nasce…
  await notaDeServicoAteOsGates(page, NFSE_COM_CNO_DESTA_OBRA);
  await expect(destaObra).toBeChecked();
  await expect(page.locator('[data-sugestao="cno-bate"]')).toBeVisible();

  // …e morre com o papel: outro PDF, agora sem CNO nenhum.
  await anexo.setInputFiles({
    name: "nf-outra.pdf",
    mimeType: "application/pdf",
    buffer: pdfComTexto(NFSE_SEM_PADRAO_RECONHECIVEL),
  });
  await gateDoCnoVazio(page);
  await expect(page.locator('[data-sugestao="cno-bate"]')).toHaveCount(0);

  // ── (2) o anexo REMOVIDO de vez tem o mesmo efeito.
  await anexo.setInputFiles({
    name: "nf-1042.pdf",
    mimeType: "application/pdf",
    buffer: pdfComTexto(NFSE_COM_CNO_DESTA_OBRA),
  });
  await expect(destaObra).toBeChecked();
  await anexo.setInputFiles([]);
  await gateDoCnoVazio(page);

  // ── (3) a resposta MANUAL sobrevive à troca — inclusive quando a leitura do
  // papel novo chega de verdade e bate exato contra a obra.
  await escolher(page, "Qual CNO está impresso nesta nota?", "A nota não traz CNO");
  await anexo.setInputFiles({
    name: "nf-1042.pdf",
    mimeType: "application/pdf",
    buffer: pdfComTexto(NFSE_COM_CNO_DESTA_OBRA),
  });
  await expect(page.locator('[data-sugestao="cno-bate"]')).toBeVisible();
  await expect(
    grupoDoCno(page).getByRole("radio", { name: /^A nota não traz CNO/ }),
  ).toBeChecked();
  await expect(pilulaDoCno(page, "A nota não traz CNO")).toHaveClass(/bg-ink/);
  await expect(page.getByText("Sugerida", { exact: true })).toHaveCount(0);
});
