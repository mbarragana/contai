import { OBRA_ID_SEED } from "./ambiente";
import {
  criarAnexoDeDesembolso,
  criarDesembolsoTerreno,
  criarDocumento,
  criarFavorecido,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * **CONTAI-042 — `/pendencias` passa a listar as DEZOITO famílias.**
 *
 * O que esta suíte prova é a promessa do ticket, e só ela: uma pendência que
 * antes só existia agregada dentro da home **aparece aqui**. As condições de
 * abertura de cada família já têm teste unitário em `lib/fiscal/*.test.ts`; o
 * que nenhum teste unitário pega é a família chegar à tela.
 *
 * Contra o Supabase LOCAL, como o resto da suíte: sessão de verdade, linhas de
 * verdade com RLS.
 */

let proximoEmitente = 0;

/** Um emitente NOVO por chamada — `favorecido_dono_documento_unico` (0003). */
async function emitente(db: Parameters<typeof criarFavorecido>[0]) {
  proximoEmitente += 1;
  return criarFavorecido(db, {
    tipo: "pj",
    nome: `Construtora Fila ${proximoEmitente}`,
    documento: `1122233300018${proximoEmitente}`,
  });
}

/** Documento fora do CPF do dono → **quarentena**, vermelha. */
async function emQuarentena(db: Parameters<typeof criarDocumento>[0]) {
  return criarDocumento(db, {
    obra_id: OBRA_ID_SEED,
    favorecido_id: await emitente(db),
    tipo: "nf_material",
    valor: 9400,
    numero: "5001",
    data_emissao: "2026-03-10",
    classificacao: "material",
    destinatario_cpf_ok: false,
    status: "quarentena",
    motivo_quarentena:
      "Documento não está no CPF do dono da obra — não entra no custo de aquisição.",
  });
}

/**
 * NF de serviço que **não traz o CNO impresso**, com a obra do seed tendo CNO
 * → `nf_servico_sem_cno`, **âmbar**: o custo de aquisição está intacto, o que
 * está aberto é a aferição.
 */
async function semCnoImpresso(db: Parameters<typeof criarDocumento>[0]) {
  return criarDocumento(db, {
    obra_id: OBRA_ID_SEED,
    favorecido_id: await emitente(db),
    tipo: "nf_servico",
    valor: 7300,
    numero: "5002",
    data_emissao: "2026-03-12",
    classificacao: "mao_obra",
    destinatario_cpf_ok: true,
    retencao_na_nota: "nenhuma",
    nota_traz_cno: false,
    status: "registrado",
  });
}

test.describe("a fila unificada", () => {
  /**
   * ⚠️ **O teste que o ticket existe para ter.** Antes do CONTAI-042 esta tela
   * só mostrava as duas persistentes, e a quarentena só existia na home — a
   * classe de defeito D46/D47, pendência com uma superfície só.
   */
  test("uma pendência derivada, que antes só existia na home, aparece aqui", async ({
    page,
    db,
  }) => {
    await emQuarentena(db);

    await page.goto("/pendencias");
    await expect(page.getByRole("heading", { name: "Pendências" })).toBeVisible();
    await expect(page.getByText("Quarentena", { exact: false }).first()).toBeVisible();
    // O texto de consequência é o mesmo de sempre — copiado, não reescrito.
    await expect(
      page.getByText("Não entra no custo de aquisição", { exact: false }).first(),
    ).toBeVisible();
  });

  /**
   * Vermelho antes de âmbar, nunca misturados sem hierarquia (critério 2).
   */
  test("o grupo vermelho vem antes do âmbar", async ({ page, db }) => {
    await emQuarentena(db);
    await semCnoImpresso(db);

    await page.goto("/pendencias");
    const primeiro = page.getByText("Resolver primeiro");
    const depois = page.getByText("Resolver antes de declarar");
    await expect(primeiro).toBeVisible();
    await expect(depois).toBeVisible();

    const caixaVermelho = (await primeiro.boundingBox())!;
    const caixaAmbar = (await depois.boundingBox())!;
    expect(caixaVermelho.y).toBeLessThan(caixaAmbar.y);
  });

  /**
   * Gate Fiscal §3.4: a página mistura dois escopos — persistentes de TODAS as
   * obras, derivadas da obra aberta — e eles são **ditos**, não inferidos.
   */
  test("os dois escopos são declarados em tela", async ({ page, db }) => {
    await emQuarentena(db);

    await page.goto("/pendencias");
    await expect(
      page.getByText("de todas as suas obras", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Casa Cachoeira" }),
    ).toBeVisible();
  });

  /**
   * ⚠️ **A 18ª família, e a prova de que ela existia escondida.** A obra do
   * seed não tem desembolso datado nenhum, e por isso `terrenoSemRegistro`
   * está aberta — até o CONTAI-042 ela só existia como uma `Consequencia`
   * âmbar DENTRO do card de custo confirmado da home, sem linha própria em
   * lugar nenhum. O `cto-obra` não a tinha nomeado no achado; foi ela que
   * fechou a lista em dezoito.
   */
  test("a 18ª família ganha linha própria", async ({ page }) => {
    await page.goto("/pendencias");
    await expect(
      page.getByText("Terreno sem registro", { exact: false }),
    ).toBeVisible();
    // Texto literal de `TERRENO_ZERO_NAO_E_NADA_PAGO` — copiado, não reescrito.
    await expect(
      page.getByText("não que nada foi pago", { exact: false }),
    ).toBeVisible();
  });

  /**
   * ⚠️ Gate Fiscal §7.2: com a fila vazia, a página **não** pode afirmar
   * "Nenhuma pendência" — afirmar ausência além do que se apurou é reencenar a
   * **D59** na tela que existe para matá-la, e desta vez na superfície que se
   * lê antes de declarar.
   */
  test("o estado vazio diz o que foi apurado, e não que está tudo certo", async ({
    page,
    db,
  }) => {
    // O terreno DATADO e com comprovante é o que fecha a última família aberta
    // na obra do seed — sem ele não existe estado vazio para conferir.
    const desembolso = await criarDesembolsoTerreno(db, {
      tipo: "pagamento_terreno",
      valor: 800000,
      data_pagamento: "2025-06-10",
      estado: "pago",
      debitos_mesmo_dia: true,
    });
    await criarAnexoDeDesembolso(db, {
      desembolso_id: desembolso,
      arquivo_path: "11111111-1111-4111-8111-111111111111/terreno/comprovante.pdf",
      papel: "comprovante",
    });

    await page.goto("/pendencias");
    await expect(
      page.getByText("Nada aberto no que este app apura", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("não é um atestado de declaração pronta", { exact: false }),
    ).toBeVisible();
    // Nenhuma promessa de que dá para declarar.
    await expect(page.getByText("tudo pronto", { exact: false })).toHaveCount(0);
  });
});
