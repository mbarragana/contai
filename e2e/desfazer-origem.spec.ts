import {
  compromissos,
  criarCompromisso,
  criarDocumento,
  criarFavorecido,
  pagamentos,
  preVinculos,
  vinculos,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * **CONTAI-083 — DESFAZER a nota de origem herdada de um agendamento aberto.**
 *
 * Fonte normativa: `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`,
 * ADENDO 9 (§M.0-M.8).
 *
 * O que se prova aqui é o estado GRAVADO em `compromisso` — as duas colunas de
 * auditoria da migration 0025 e o `documento_origem_id` zerado —, contra o
 * Postgres LOCAL, com RLS ligada e o MESMO client autenticado do app.
 *
 * ⚠️ **Os dois lados do §M.2 são testados juntos**: o que a ação FAZ (limpar +
 * marcar) e o que ela **não pode** fazer (criar pré-vínculo no mesmo ato). Um
 * `compromisso_documento_previsto` nascido aqui deixaria a união do critério 10
 * do CONTAI-080 em N=1 com a MESMA nota errada — *"é o mesmo bug, uma coluna ao
 * lado"* — e nenhuma asserção de tela pegaria isso.
 *
 * ⚠️ **O cenário real do ticket é o do primeiro teste**: NF de serviço nº 1531,
 * R$ 30.340,00, herdada por um agendamento de R$ 15.000,00 do mesmo favorecido.
 */

let proximoCnpj = 0;

async function empreiteira(db: Db, nome = "Ilhamix Concreto Ltda") {
  proximoCnpj += 1;
  return criarFavorecido(db, {
    tipo: "pj",
    nome,
    documento: `1122233300${String(proximoCnpj).padStart(4, "0")}`,
  });
}

/** A NF de serviço do caso real — nº 1531, R$ 30.340,00. */
async function notaDeServico(
  db: Db,
  favorecidoId: string,
  over: { numero?: string; valor?: number } = {},
) {
  return criarDocumento(db, {
    favorecido_id: favorecidoId,
    tipo: "nf_servico",
    classificacao: "mao_obra",
    valor: over.valor ?? 30340,
    numero: over.numero ?? "1531",
    data_emissao: "2026-09-10",
    destinatario_cpf_ok: true,
    status: "registrado",
  });
}

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

/** Uma das três parcelas do caso real: R$ 15.000,00, aberta, com a origem herdada. */
async function parcela(
  db: Db,
  over: {
    favorecidoId: string;
    documentoOrigemId?: string;
    situacao?: "aberto" | "quitado" | "cancelado";
  },
) {
  return criarCompromisso(db, {
    favorecido_id: over.favorecidoId,
    valor_previsto: 15000,
    data_prevista: maisDias(15),
    origem: "boleto",
    ...(over.situacao ? { situacao: over.situacao } : {}),
    ...(over.documentoOrigemId
      ? { documento_origem_id: over.documentoOrigemId }
      : {}),
  });
}

async function umCompromisso(db: Db, id: string) {
  const linha = (await compromissos(db)).find((c) => c.id === id);
  expect(linha, "o compromisso do cenário").toBeTruthy();
  return linha!;
}

// ══ O caminho feliz — e o que ele NÃO cria ═══════════════════════════════

test("aberto + origem: desfaz, o chip de pré-vínculo some e a auditoria aparece", async ({
  page,
  db,
}) => {
  const favorecidoId = await empreiteira(db);
  const notaId = await notaDeServico(db, favorecidoId);
  const compromissoId = await parcela(db, {
    favorecidoId,
    documentoOrigemId: notaId,
  });

  await page.goto(`/compromisso/${compromissoId}`);
  // ⚠️ O estado ANTES: a origem sozinha já resolve N=1, e é ela que produz a
  // conversão automática do ADENDO 7 §K.2 que este ticket existe para parar.
  await expect(page.locator('[data-pre-vinculo="compromisso"]')).toBeVisible();
  await expect(
    page.locator('[data-origem-desfeita="compromisso"]'),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Desfazer a nota de origem" }).click();
  await page.waitForURL(new RegExp(`/compromisso/${compromissoId}/origem$`));

  // A consequência ANTES do clique (mock §1.2/§1.3, textos do ADENDO 9).
  await expect(
    page.getByText("O vínculo antigo fica registrado, com a data"),
  ).toBeVisible();
  await expect(page.getByText("Nota de origem — herdada")).toBeVisible();
  await expect(page.getByText("NF serviço nº 1531", { exact: false })).toBeVisible();
  await expect(page.getByText("O que isso muda")).toBeVisible();
  await expect(
    page.getByText("deixa de ligar sozinho a esta nota na confirmação"),
  ).toBeVisible();
  // §M.1 — as duas apurações ficam onde estavam; §M.6 — a nota continua na lista.
  await expect(page.getByText("inalterado", { exact: true })).toBeVisible();
  await expect(page.getByText("inalterada", { exact: true })).toBeVisible();
  await expect(
    page.getByText('continua em "Notas hábeis sem pagamento vinculado"'),
  ).toBeVisible();
  // §M.4 — SEM campo de motivo, ao contrário de `/cancelar`.
  await expect(page.getByRole("textbox")).toHaveCount(0);

  await page.getByRole("button", { name: "Desfazer a origem" }).click();
  await page.waitForURL(new RegExp(`/compromisso/${compromissoId}$`));

  // ── O detalhe depois: N=0, e o rastro visível ──────────────────────────
  await expect(
    page.locator('[data-origem-desfeita="compromisso"]'),
  ).toContainText(/desfeita em \d{2}\/\d{2}\/\d{4} — NF serviço nº 1531/);
  // §M.3 — o chip do pré-vínculo some porque a união ficou VAZIA. É o efeito
  // que a ação existe para produzir, não colateral.
  await expect(page.locator('[data-pre-vinculo="compromisso"]')).toHaveCount(0);
  // O CTA também some: não há mais o que desfazer (critério 4).
  await expect(
    page.getByRole("link", { name: "Desfazer a nota de origem" }),
  ).toHaveCount(0);

  // ── O estado GRAVADO ───────────────────────────────────────────────────
  const linha = await umCompromisso(db, compromissoId);
  expect(linha.documento_origem_id).toBeNull();
  expect(linha.origem_desfeita_id).toBe(notaId);
  expect(linha.origem_desfeita_em).not.toBeNull();
  // A situação NÃO muda: desfazer origem não responde o agendamento.
  expect(linha.situacao).toBe("aberto");

  // ⚠️ **§M.2 — NADA de pré-vínculo criado no mesmo ato**, e nada de pagamento
  // ou vínculo formal: a ação só limpa.
  expect(await preVinculos(db)).toEqual([]);
  expect(await vinculos(db)).toEqual([]);
  expect(await pagamentos(db)).toEqual([]);
});

test("o pré-vínculo declarado à parte SOBREVIVE ao desfazimento da origem", async ({
  page,
  db,
}) => {
  // A origem é uma nota; o pré-vínculo é OUTRA. Desfazer a origem derruba a
  // primeira e deixa a segunda de pé — N vai de 2 para 1, e o que sobra é o que
  // ele declarou com o dedo, não o que foi herdado.
  const favorecidoId = await empreiteira(db);
  const origemId = await notaDeServico(db, favorecidoId);
  const outraId = await notaDeServico(db, favorecidoId, {
    numero: "1541",
    valor: 29760,
  });
  const compromissoId = await parcela(db, {
    favorecidoId,
    documentoOrigemId: origemId,
  });
  await db
    .from("compromisso_documento_previsto")
    .insert({ compromisso_id: compromissoId, documento_id: outraId });

  await page.goto(`/compromisso/${compromissoId}/origem`);
  await page.getByRole("button", { name: "Desfazer a origem" }).click();
  await page.waitForURL(new RegExp(`/compromisso/${compromissoId}$`));

  const linha = await umCompromisso(db, compromissoId);
  expect(linha.documento_origem_id).toBeNull();
  expect(linha.origem_desfeita_id).toBe(origemId);
  // A linha de intenção que ele declarou continua lá, intocada.
  expect(await preVinculos(db)).toEqual([
    expect.objectContaining({
      compromisso_id: compromissoId,
      documento_id: outraId,
    }),
  ]);
  // E o chip continua visível, agora com N=1 sobre a nota CERTA.
  await expect(page.locator('[data-pre-vinculo="compromisso"]')).toContainText(
    "Nota nº 1541",
  );
});

// ══ As duas recusas — §M.5 e "não há o que desfazer" ═════════════════════

test("quitado: o CTA não existe e a rota direta RECUSA, sem tentar gravar", async ({
  page,
  db,
}) => {
  const favorecidoId = await empreiteira(db);
  const notaId = await notaDeServico(db, favorecidoId);
  const compromissoId = await parcela(db, {
    favorecidoId,
    documentoOrigemId: notaId,
    situacao: "quitado",
  });

  await page.goto(`/compromisso/${compromissoId}`);
  await expect(
    page.getByRole("link", { name: "Desfazer a nota de origem" }),
  ).toHaveCount(0);

  // Por URL direta: banner ÂMBAR (nada de fiscal aconteceu nem deixou de
  // acontecer), sem botão de ação nenhum — recusa TOTAL do §M.5.
  await page.goto(`/compromisso/${compromissoId}/origem`);
  await expect(
    page.getByText("Este agendamento já foi respondido — não está mais aberto"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Desfazer a origem" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Voltar ao agendamento" }),
  ).toBeVisible();

  // ⚠️ **Nada foi alterado** — a origem continua onde estava, e não há rastro
  // de um desfazimento que não aconteceu.
  const linha = await umCompromisso(db, compromissoId);
  expect(linha.documento_origem_id).toBe(notaId);
  expect(linha.origem_desfeita_id).toBeNull();
  expect(linha.origem_desfeita_em).toBeNull();
});

test("sem origem nenhuma: o CTA não existe e a rota direta RECUSA", async ({
  page,
  db,
}) => {
  const favorecidoId = await empreiteira(db);
  const compromissoId = await parcela(db, { favorecidoId });

  await page.goto(`/compromisso/${compromissoId}`);
  // O bloco de ações está lá inteiro — só este botão não, porque não há o que
  // desfazer (critério 4).
  await expect(
    page.getByRole("link", { name: "Ligar notas a este agendamento" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Desfazer a nota de origem" }),
  ).toHaveCount(0);

  await page.goto(`/compromisso/${compromissoId}/origem`);
  await expect(
    page.getByText("Este agendamento não tem nota de origem para desfazer"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Desfazer a origem" }),
  ).toHaveCount(0);

  const linha = await umCompromisso(db, compromissoId);
  expect(linha.documento_origem_id).toBeNull();
  expect(linha.origem_desfeita_id).toBeNull();
  expect(linha.origem_desfeita_em).toBeNull();
});

// ══ "Desfeito no máximo uma vez" (§M.4) ══════════════════════════════════

test("desfazer DUAS vezes: a segunda dá erro nomeado e a coluna fica intacta", async ({
  page,
  db,
}) => {
  const favorecidoId = await empreiteira(db);
  const notaId = await notaDeServico(db, favorecidoId);
  const compromissoId = await parcela(db, {
    favorecidoId,
    documentoOrigemId: notaId,
  });

  // A tela carrega com a origem AINDA presente…
  await page.goto(`/compromisso/${compromissoId}/origem`);
  await expect(page.getByText("NF serviço nº 1531", { exact: false })).toBeVisible();

  // …e outra aba desfaz primeiro. É a corrida que o `where` condicional de
  // `desfazerOrigemDoCompromisso` existe para fechar — pelo MESMO client
  // autenticado, sujeito à mesma RLS do app.
  const PRIMEIRO = "2026-09-01T10:00:00+00:00";
  const outraAba = await db
    .from("compromisso")
    .update({
      documento_origem_id: null,
      origem_desfeita_id: notaId,
      origem_desfeita_em: PRIMEIRO,
    })
    .eq("id", compromissoId);
  expect(outraAba.error).toBeNull();

  // O clique da aba velha: 0 linhas afetadas → ERRO NOMEADO, nunca "salvou".
  await page.getByRole("button", { name: "Desfazer a origem" }).click();
  await expect(
    page.getByText("O agendamento mudou enquanto você olhava"),
  ).toBeVisible();
  // Continua na tela, sem navegar para o detalhe como se tivesse gravado.
  expect(page.url()).toContain(`/compromisso/${compromissoId}/origem`);

  // ⚠️ **A auditoria do PRIMEIRO desfazimento não foi sobrescrita**: o rastro
  // que vale é o do ato que aconteceu, não o do clique que não fez nada.
  const linha = await umCompromisso(db, compromissoId);
  expect(linha.documento_origem_id).toBeNull();
  expect(linha.origem_desfeita_id).toBe(notaId);
  expect(new Date(linha.origem_desfeita_em!).toISOString()).toBe(
    new Date(PRIMEIRO).toISOString(),
  );

  // E recarregando, a tela passa a RECUSAR — "no máximo uma vez" (§M.4).
  await page.reload();
  await expect(
    page.getByText("Este agendamento não tem nota de origem para desfazer"),
  ).toBeVisible();
});
