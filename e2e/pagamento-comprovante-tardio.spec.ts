import { OBRA_ID_SEED, USER_ID_SEED } from "./ambiente";
import {
  anosAfetados,
  criarDocumento,
  criarFavorecido,
  criarPagamento,
  criarVinculo,
  pagamentos,
  pendencias,
  revisoes,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * **CONTAI-061 — o comprovante chegou depois (dívida D56)**, contra o Postgres
 * LOCAL.
 *
 * Fonte normativa: `docs/pareceres/2026-09-26-anexo-tardio-de-comprovante-d56.md`
 * (§§1-3) + `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` (§5
 * rastro, §6 o detector), reaproveitados sem adaptação.
 *
 * O que se prova aqui não é o que a tela mostrou: é o **ESTADO GRAVADO** — o
 * `comprovante_path`, a linha de rastro com `antes = null`, o snapshot de custo
 * por ano e por obra, e a pendência de retificadora. Nada é stubado: a RPC
 * `anexar_comprovante_pagamento` e o trigger
 * `pagamento_comprovante_path_imutavel` (migration 0019) rodam de verdade, como
 * `security invoker`, sob a MESMA RLS do app.
 *
 * ⚠️ O ano vem de `new Date().getFullYear()`, e não de um literal: a fronteira
 * que este ticket exercita é *"ano anterior ao corrente"* (§5.3), e com ano fixo
 * o teste passaria a provar outra coisa na virada do ano.
 */

const ANO = new Date().getFullYear();
const ANO_ANTERIOR = ANO - 1;

const CNPJ_DEPOSITO = "12345678000199";

function comprovante(nome: string) {
  return {
    name: nome,
    mimeType: "image/png",
    buffer: Buffer.from(`png-falso-${nome}`),
  };
}

async function cenarioFavorecido(db: Db) {
  return criarFavorecido(db, {
    tipo: "pj",
    nome: "Depósito Ilha",
    documento: CNPJ_DEPOSITO,
  });
}

/**
 * O estado que este ticket existe para destravar: pagamento gravado **sem
 * comprovante**, com nota hábil ligada. Sem o comprovante o elegível é ZERO
 * (`valorElegivelDoPagamento`), então o custo confirmado do ano é 0 e o
 * pagamento aparece em "Custo em risco no IR" — com o comprovante na mão do
 * Mateus e, até a migration 0019, nenhuma porta no app.
 */
async function pagoSemComprovante(
  db: Db,
  dataPagamento: string,
  valor = 9400,
): Promise<{ pagamentoId: string; documentoId: string }> {
  const favorecidoId = await cenarioFavorecido(db);
  const documentoId = await criarDocumento(db, {
    tipo: "nf_material",
    favorecido_id: favorecidoId,
    valor,
    classificacao: "material",
    destinatario_cpf_ok: true,
  });
  const pagamentoId = await criarPagamento(db, {
    favorecido_id: favorecidoId,
    valor,
    data_pagamento: dataPagamento,
    meio: "pix",
    // ⚠️ O ponto inteiro do ticket.
    comprovante_path: null,
  });
  await criarVinculo(db, pagamentoId, documentoId);
  return { pagamentoId, documentoId };
}

test.describe("anexar o comprovante a um pagamento já gravado (D56)", () => {
  test("o card 'pago sem comprovante' leva à tela, e o anexo do ANO CORRENTE grava sem pendência", async ({
    page,
    db,
  }) => {
    const { pagamentoId } = await pagoSemComprovante(db, `${ANO}-04-10`);

    // ── A porta que faltava, no card que já explicava a consequência ──────
    await page.goto(`/pagamento/${pagamentoId}`);
    await page
      .getByRole("link", { name: "Anexar comprovante", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/pagamento/${pagamentoId}/comprovante$`));

    // ── Vazio: nenhuma pergunta fiscal, e nenhum delta antes do arquivo ───
    // ⚠️ Ao contrário de `/documento/[id]/anexar`, aqui NÃO se pergunta CPF nem
    // retenção: comprovante de pagamento não responde nenhuma das duas.
    await expect(
      page.getByRole("group", { name: "A nota está no seu CPF?" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Esta nota destaca alguma retenção?"),
    ).toHaveCount(0);
    await expect(
      page.getByText("Escolha o arquivo para ver o efeito no custo confirmado do ano."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Escolha o comprovante para continuar" }),
    ).toBeDisabled();

    // ── O delta, ANTES de subir: 0 → 9.400,00 no ano do PAGAMENTO ─────────
    await page
      .getByLabel("Comprovante do pagamento")
      .setInputFiles(comprovante("pix-9400.png"));

    // ⚠️ A linha do delta, e não `getByText(String(ANO))` seco: o ano aparece
    // várias vezes na tela (cabeçalho, data do pagamento, "Acumulado até…"), e
    // o que importa provar é o "antes → depois" DO ANO DO PAGAMENTO.
    await expect(page.getByText("R$ 0,00 → R$ 9.400,00").first()).toBeVisible();
    // Ramo A — sem pendência: nenhum dos avisos de ano anterior aparece, e
    // nenhuma linha do delta é marcada como ano anterior.
    await expect(page.getByText("⚠ ano anterior")).toHaveCount(0);
    await expect(page.getByText("avalie retificadora com seu contador")).toHaveCount(0);
    await expect(
      page.getByText("Vai virar uma pendência na tela inicial."),
    ).toHaveCount(0);

    await page
      .getByRole("button", {
        name: `Anexar comprovante — o custo confirmado de ${ANO} passa a R$ 9.400,00`,
      })
      .click();

    await expect(page.getByRole("status")).toContainText("Anexado.");

    // ── (i) o path gravado, e ele veio do acervo de verdade ───────────────
    const pago = (await pagamentos(db)).find((p) => p.id === pagamentoId)!;
    expect(pago.comprovante_path).toMatch(
      new RegExp(`^${USER_ID_SEED}/comprovante/`),
    );

    // ── (ii) o rastro: `antes` é NULL, não zero nem string vazia ──────────
    const rastro = await revisoes(db);
    expect(rastro).toHaveLength(1);
    expect(rastro[0]).toMatchObject({
      entidade: "pagamento",
      entidade_id: pagamentoId,
      campo: "comprovante",
      antes: null,
      depois: pago.comprovante_path,
      motivo: "comprovante_chegou_depois",
      motivo_texto: null,
    });
    // §2 — a data do anexo É o rastro, e não uma coluna nova em `pagamento`.
    expect(rastro[0].quando).not.toBeNull();

    // ── (iii) o snapshot por ano E por obra, sem pendência ────────────────
    const anos = await anosAfetados(db);
    expect(anos).toHaveLength(1);
    expect(anos[0]).toMatchObject({
      revisao_id: rastro[0].id,
      obra_id: OBRA_ID_SEED,
      ano: ANO,
      pendencia_id: null,
    });
    expect(Number(anos[0].custo_antes)).toBe(0);
    expect(Number(anos[0].custo_depois)).toBe(9400);

    // A DAA do ano corrente ainda não foi entregue: não há retificadora a
    // avaliar, e alarme sem consequência ensina a ignorar alarme (§5.3).
    expect(await pendencias(db)).toHaveLength(0);
  });

  test("anexo de pagamento de ANO ANTERIOR avisa ANTES, grava, e abre a pendência", async ({
    page,
    db,
  }) => {
    const { pagamentoId } = await pagoSemComprovante(
      db,
      `${ANO_ANTERIOR}-11-12`,
    );

    await page.goto(`/pagamento/${pagamentoId}/comprovante`);
    await page
      .getByLabel("Comprovante do pagamento")
      .setInputFiles(comprovante("pix-do-ano-passado.png"));

    // ⚠️ **REGIME DE CAIXA (§3), a trava do pre-mortem 2**: o custo aparece no
    // ano do PAGAMENTO, nunca no ano do anexo (que é o corrente).
    await expect(
      page.getByText(`${ANO_ANTERIOR} ⚠ ano anterior`),
    ).toBeVisible();
    await expect(page.getByText(`${ANO} ⚠ ano anterior`)).toHaveCount(0);

    // ── Os avisos, ANTES de gravar, e são CÓPIA LITERAL das constantes ────
    // `AVISO_ANO_ANTERIOR` + `SO_SEI_QUE_E_ANO_ANTERIOR` (lib/fiscal/revisao.ts),
    // as mesmas que `corrigir/valor` já usa. Nenhum texto fiscal novo.
    await expect(
      page.getByText(
        "Esta correção mudou o custo de um ano anterior; se a DAA daquele ano " +
          "já foi entregue, avalie retificadora com seu contador.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "O app não sabe se você já entregou a declaração daquele ano. Ele sabe " +
          "que é um ano anterior ao corrente, e é só isso que ele afirma. Quem " +
          "sabe a data da entrega é você.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Vai virar uma pendência na tela inicial."),
    ).toBeVisible();

    await page
      .getByRole("button", {
        name: `Anexar mesmo assim — o custo de ${ANO_ANTERIOR} passa a R$ 9.400,00`,
      })
      .click();

    await expect(page.getByRole("status")).toContainText("Anexado.");

    const pago = (await pagamentos(db)).find((p) => p.id === pagamentoId)!;
    expect(pago.comprovante_path).toMatch(
      new RegExp(`^${USER_ID_SEED}/comprovante/`),
    );

    // A pendência é PERSISTENTE, por ANO, e o app não decide nem redige a
    // retificadora — quem avalia é o CRC (§3).
    const abertas = await pendencias(db);
    expect(abertas).toHaveLength(1);
    expect(abertas[0]).toMatchObject({
      tipo: "retificadora_possivel",
      ano: ANO_ANTERIOR,
      documento_id: null,
    });

    const anos = await anosAfetados(db);
    expect(anos).toHaveLength(1);
    expect(anos[0].ano).toBe(ANO_ANTERIOR);
    expect(anos[0].pendencia_id).toBe(abertas[0].id);

    // E ela continua na lista depois de sair da tela: aviso que só existe no
    // momento do clique é aviso que não existiu (§6.3).
    await page.goto("/pendencias");
    await expect(
      page.getByText(String(ANO_ANTERIOR)).first(),
    ).toBeVisible();
  });

  test("segunda tentativa: a tela mostra a guarda de reentrada e a RPC recusa", async ({
    page,
    db,
  }) => {
    const { pagamentoId } = await pagoSemComprovante(db, `${ANO}-04-10`);

    // Primeiro anexo, pela tela.
    await page.goto(`/pagamento/${pagamentoId}/comprovante`);
    await page
      .getByLabel("Comprovante do pagamento")
      .setInputFiles(comprovante("pix-primeiro.png"));
    await page.getByRole("button", { name: /^Anexar comprovante/ }).click();
    await expect(page.getByRole("status")).toContainText("Anexado.");

    const primeiro = (await pagamentos(db)).find((p) => p.id === pagamentoId)!
      .comprovante_path!;

    // ── (a) A tela: chegada direta por URL não oferece controle nenhum ────
    await page.goto(`/pagamento/${pagamentoId}/comprovante`);
    await expect(page.getByRole("status")).toContainText(
      "Este pagamento já tem comprovante.",
    );
    await expect(page.getByLabel("Comprovante do pagamento")).toHaveCount(0);

    // ── (b) A RPC: a guarda é do BANCO, não da tela ───────────────────────
    // `where comprovante_path is null` — a segunda chamada não encontra a linha
    // e a função levanta exceção, em vez de gravar por cima em silêncio.
    const segunda = await db.rpc("anexar_comprovante_pagamento", {
      p_pagamento_id: pagamentoId,
      p_comprovante_path: `${USER_ID_SEED}/comprovante/outro.png`,
      p_anos: [],
    });
    expect(segunda.error?.message ?? "").toContain("já tem comprovante");

    // ── (c) O trigger: UPDATE direto pela tabela também é recusado ────────
    // `pagamento` tem UPDATE para `authenticated` desde a 0005, e o PostgREST
    // expõe a tabela — sem o trigger `pagamento_comprovante_path_imutavel`,
    // "só grava se está null" seria promessa da RPC e nada mais.
    const direto = await db
      .from("pagamento")
      .update({ comprovante_path: `${USER_ID_SEED}/comprovante/pela-tabela.png` })
      .eq("id", pagamentoId);
    expect(direto.error?.message ?? "").toContain(
      "comprovante_path já foi definido",
    );

    // Nada mudou, e o rastro continua com UMA linha: não existe anexo sem
    // rastro nem rastro de anexo que não aconteceu.
    expect(
      (await pagamentos(db)).find((p) => p.id === pagamentoId)!.comprovante_path,
    ).toBe(primeiro);
    expect(await revisoes(db)).toHaveLength(1);
  });
});
