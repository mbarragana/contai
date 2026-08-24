import { OBRA_ID_SEED, USER_ID_SEED } from "./ambiente";
import {
  criarAnexoDeDesembolso,
  criarCompromisso,
  criarDesembolsoTerreno,
  criarDocumento,
  criarFavorecido,
  criarPagamento,
  criarVinculo,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * CONTAI-036 — **a primeira saída anual do produto**, contra o Postgres local.
 *
 * O que estes testes provam não é "a tela renderiza": é que o **texto que vai
 * colado no campo Discriminação da declaração** diz a verdade sobre o que
 * somou e o que ficou de fora. Errar aqui não dá erro de tela — dá custo
 * subestimado na venda, anos depois, sem ninguém perceber no caminho.
 *
 * Cobre o critério 13 do ticket:
 * - (a) com pago-sem-comprovante → o bloco SAI, a linha do §4.5 traz o valor
 *   certo, e esse valor **não** está dentro do bloco;
 * - (b) sem nenhum → a linha **não** aparece e o total bate;
 * - (c) com compromisso vencido sem resposta → a saída **não** sai;
 * - (d) o terreno pendente **não** veta Pagamentos Efetuados nem a aferição —
 *   provado em Vitest (`terreno.test.ts`, *"crit. 13d"*), porque as telas
 *   dessas duas saídas são de tickets próprios e não existem para navegar.
 *
 * ⚠️ `getByRole(..., { name })` sem `exact: true` casa por SUBSTRING.
 */

const ANO = new Date().getFullYear();
const ROTA = `/obras/${OBRA_ID_SEED}/discriminacao/${ANO}`;

/** Formata como o app formata — `Intl` pt-BR usa NBSP depois do "R$". */
function brl(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

/**
 * ⚠️ `valor` é `numeric(14,2)` em REAIS no banco — nunca centavos. Foi assim
 * que o PostgREST já mordeu este projeto uma vez (`numeric` voltando como
 * number, não string), e o cenário montado em centavos daria um número 100×
 * maior sem nada ficar vermelho.
 */
async function desembolsoComComprovante(
  db: Db,
  valorReais: number,
  tipo: "entrada" | "itbi" | "escritura_registro" = "entrada",
) {
  const id = await criarDesembolsoTerreno(db, {
    tipo,
    valor: valorReais,
    data_pagamento: `${ANO}-03-12`,
    estado: "pago",
  });
  await criarAnexoDeDesembolso(db, {
    desembolso_id: id,
    arquivo_path: `${USER_ID_SEED}/terreno/${id}.pdf`,
    papel: "comprovante",
  });
  return id;
}

test.describe("CONTAI-036 · discriminação de Bens e Direitos", () => {
  test("(a) pago-sem-comprovante: o bloco SAI e o valor fica FORA dele", async ({
    page,
    db,
  }) => {
    // 100.000,00 demonstráveis; 25.000,00 pagos, datados e sem o papel.
    await desembolsoComComprovante(db, 100_000);
    await criarDesembolsoTerreno(db, {
      tipo: "entrada",
      valor: 25_000,
      data_pagamento: `${ANO}-05-05`,
      estado: "pago",
    });

    await page.goto(ROTA);
    const bloco = page.locator("[data-bloco='copiavel']");
    await expect(bloco).toBeVisible();

    // ⚠️ O bloco SAI — era o critério 16 do CONTAI-025, e ele foi PAGO.
    await expect(bloco).toContainText("IMÓVEL RESIDENCIAL EM CONSTRUÇÃO.");
    await expect(bloco).toContainText(brl(100_000_00));
    // E o valor sem comprovante NÃO está dentro do que se cola na declaração:
    // nem sozinho, nem somado à entrada.
    await expect(bloco).not.toContainText(brl(25_000_00));
    await expect(bloco).not.toContainText(brl(125_000_00));

    // ⚠️ A linha do §4.5, LITERAL, fora do bloco e logo abaixo dele.
    const linha = page.locator("[data-linha='§4.5']");
    await expect(linha).toContainText(
      `Fora do custo confirmado por falta de comprovante: ${brl(25_000_00)}.`,
    );
    await expect(linha).toContainText(
      "Foi pago e está registrado, mas ainda não tem o papel que o demonstra",
    );
    // A segunda metade — o handoff ao CRC — é a que se dropa em silêncio.
    await expect(linha).toContainText(
      "Decida com seu contador antes de declarar: deixar de discriminar na " +
        "declaração um custo real também custa caro — o custo que não é " +
        "discriminado não existe na venda.",
    );

    // Critério 6: o aviso é INCONDICIONAL, e aqui traz a contagem.
    await expect(
      page.getByText("Revise antes de copiar — 1 lançamento ficou de fora da soma."),
    ).toBeVisible();
  });

  test("(b) tudo comprovado: a linha do §4.5 NÃO aparece, e o total bate", async ({
    page,
    db,
  }) => {
    await desembolsoComComprovante(db, 100_000);
    await desembolsoComComprovante(db, 10_000, "itbi");

    // Custo de obra do ano: NF de material paga por inteiro.
    const fornecedor = await criarFavorecido(db, {
      tipo: "pj",
      nome: "Depósito Ilha LTDA",
      documento: "12345678000199",
    });
    const nota = await criarDocumento(db, {
      favorecido_id: fornecedor,
      tipo: "nf_material",
      status: "registrado",
      valor: 40_000,
      numero: "1042",
      data_emissao: `${ANO}-04-02`,
      classificacao: "material",
      destinatario_cpf_ok: true,
    });
    const pagamento = await criarPagamento(db, {
      favorecido_id: fornecedor,
      valor: 40_000,
      data_pagamento: `${ANO}-04-10`,
      meio: "pix",
      status: "conciliado",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix.png`,
    });
    await criarVinculo(db, pagamento, nota);

    await page.goto(ROTA);
    const bloco = page.locator("[data-bloco='copiavel']");
    await expect(bloco).toBeVisible();

    await expect(page.locator("[data-linha='§4.5']")).toHaveCount(0);
    // O aviso CONTINUA — é incondicional (critério 6), e é a mudança que o
    // mock aprovou em 24/08. Aviso que só aparece no caso ruim vira selo de
    // "está tudo certo" no caso bom.
    await expect(
      page.getByText(
        "Revise antes de copiar. Este texto é insumo para a sua conferência " +
          "com o profissional com CRC — não é a sua declaração pronta.",
      ),
    ).toBeVisible();

    // Situação em 31/12 = terreno (110.000) + obra (40.000).
    await expect(bloco).toContainText(
      `Situação em 31/12/${ANO}: ${brl(150_000_00)}.`,
    );
    await expect(bloco).toContainText(
      `Dispêndios pagos no ano-calendário de ${ANO}: ${brl(40_000_00)}, ` +
        `sendo ${brl(40_000_00)} em materiais e ${brl(0)} em mão de obra e serviços.`,
    );
    // E o mesmo número aparece na linha nomeada — §2.4, nunca um número só.
    await expect(page.getByText(`Situação em 31/12/${ANO}`).last()).toBeVisible();
  });

  test("a obra oferece os DOIS anos — em mar/abr declara-se o que fechou", async ({
    page,
  }) => {
    // Beco sem saída achado no Gate 2: linkando só o ano corrente, na janela
    // real da declaração (março e abril de N+1, declarando N) não existe
    // caminho até N. A tela não tem seletor de ano — o mock aprovado não
    // desenhou um —, então quem abre o caminho é a obra.
    await page.goto(`/obras/${OBRA_ID_SEED}`);
    await expect(
      page.getByRole("link", {
        name: `Discriminação de ${ANO} — antes de declarar`,
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", {
        name: `Discriminação de ${ANO - 1} — o ano que você declara agora`,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: `Discriminação de ${ANO - 1}` }),
    ).toBeVisible();
  });

  test("ano malformado na URL é erro NOMEADO — nunca '31/12/NaN' na declaração", async ({
    page,
  }) => {
    // `Number("abc")` é `NaN`, e o `NaN` atravessava o gerador em silêncio até
    // sair impresso no bloco que vai colado no campo da declaração.
    await page.goto(`/obras/${OBRA_ID_SEED}/discriminacao/abc`);
    await expect(
      page.getByText("Este endereço não diz de que ano é a discriminação."),
    ).toBeVisible();
    await expect(page.locator("[data-bloco='copiavel']")).toHaveCount(0);
    await expect(page.getByText("NaN")).toHaveCount(0);
  });

  test("(c) compromisso vencido sem resposta: a saída NÃO sai", async ({
    page,
    db,
  }) => {
    // O portão TRANSVERSAL (crit. 21 do CONTAI-019) veta as TRÊS saídas, e não
    // migrou para o bloco do terreno: sem a resposta, ninguém sabe a que ano o
    // desembolso pertence — as duas hipóteses estão vivas ao mesmo tempo.
    await desembolsoComComprovante(db, 100_000);
    const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const empreiteiro = await criarFavorecido(db, {
      tipo: "pj",
      nome: "AJE Construções LTDA",
      documento: "98765432000155",
    });
    await criarCompromisso(db, {
      favorecido_id: empreiteiro,
      valor_previsto: 15_000,
      data_prevista: ontem,
      origem: "boleto",
      situacao: "aberto",
    });

    await page.goto(ROTA);
    await expect(page.locator("[data-veto='transversal']")).toContainText(
      `A discriminação de ${ANO} não vai ser gerada ainda.`,
    );
    // Nada de bloco, nada de linha: a saída não nasce pela metade.
    await expect(page.locator("[data-bloco='copiavel']")).toHaveCount(0);
    await expect(page.locator("[data-linha='§4.5']")).toHaveCount(0);
    // A falha é NOMEADA, com o caminho de baixa — nunca um "não pode" mudo.
    await expect(
      page.getByRole("link", { name: "Responder", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Vale para as três saídas do ano", { exact: false }),
    ).toBeVisible();
  });
});
