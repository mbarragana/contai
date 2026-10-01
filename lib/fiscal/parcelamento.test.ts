import { describe, expect, it } from "vitest";

import {
  conferirSoma,
  dataDaParcelaVazia,
  dividirCentavos,
  LOTE_ABAIXO_DO_MINIMO,
  LOTE_ACIMA_DO_MAXIMO,
  LOTE_BANNER_AGENDAMENTO,
  LOTE_DICA_SEM_PARCELADO,
  somaDasParcelas,
  validarLoteCompraCartao,
  vencimentosSugeridos,
  type EntradaLoteCompraCartao,
} from "./parcelamento";

/**
 * CONTAI-084 — as três funções puras do lote, testadas sem banco e sem tela
 * (critério 17). O que está provado aqui é aritmética de centavos (critério 7),
 * aritmética de calendário (critério 8) e a composição com
 * `validarCompraCartao` fixando `parcelado: "vista"` (critério 11).
 */

describe("dividirCentavos — resíduo na ÚLTIMA parcela (critério 7)", () => {
  it("divide exato quando o total é múltiplo de n", () => {
    expect(dividirCentavos(4_500_000, 3)).toEqual([
      1_500_000, 1_500_000, 1_500_000,
    ]);
  });

  it("joga o resíduo inteiro de centavos na última, nunca espalhado", () => {
    // 100,00 ÷ 3 = 33,33 + 33,33 + 33,34
    expect(dividirCentavos(10_000, 3)).toEqual([3_333, 3_333, 3_334]);
  });

  it("resíduo de 2 centavos também vai inteiro para a última", () => {
    // 10,00 ÷ 3 em centavos: 333 + 333 + 334; já 1,00 ÷ 3 dá 33+33+34.
    expect(dividirCentavos(1_000, 3)).toEqual([333, 333, 334]);
    expect(dividirCentavos(100, 7)).toEqual([14, 14, 14, 14, 14, 14, 16]);
  });

  it("a soma das parcelas é SEMPRE o total — é o que vai para a declaração", () => {
    for (const total of [1, 7, 99, 100, 4_500_001, 123_457]) {
      for (let n = 1; n <= 24; n++) {
        const partes = dividirCentavos(total, n);
        expect(partes).toHaveLength(n);
        expect(partes.reduce((s, p) => s + p, 0)).toBe(total);
        expect(partes.every((p) => Number.isInteger(p))).toBe(true);
      }
    }
  });

  it("recusa entrada impossível em vez de devolver algo plausível", () => {
    expect(() => dividirCentavos(1_000, 0)).toThrow();
    expect(() => dividirCentavos(1_000, 2.5)).toThrow();
    expect(() => dividirCentavos(0, 3)).toThrow();
    expect(() => dividirCentavos(-100, 3)).toThrow();
    expect(() => dividirCentavos(100.5, 3)).toThrow();
  });
});

describe("vencimentosSugeridos — mesmo dia, +1 mês (critério 8)", () => {
  it("mesma data de vencimento todo mês, quando o dia existe em todos", () => {
    const vs = vencimentosSugeridos("2026-10-15", 3);
    expect(vs.map((v) => v.data)).toEqual([
      "2026-10-15",
      "2026-11-15",
      "2026-12-15",
    ]);
    expect(vs.every((v) => !v.ajustada && v.etiqueta === null)).toBe(true);
  });

  it("vira o ano sem perder o dia", () => {
    expect(vencimentosSugeridos("2026-11-05", 4).map((v) => v.data)).toEqual([
      "2026-11-05",
      "2026-12-05",
      "2027-01-05",
      "2027-02-05",
    ]);
  });

  it("mês sem o dia da semente cai no último dia E ganha etiqueta nomeada", () => {
    const vs = vencimentosSugeridos("2026-01-31", 4);
    expect(vs.map((v) => v.data)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
    expect(vs.map((v) => v.ajustada)).toEqual([false, true, false, true]);
    expect(vs[1].etiqueta).toBe("ajustada — fevereiro não tem dia 31");
    expect(vs[3].etiqueta).toBe("ajustada — abril não tem dia 31");
  });

  /**
   * ⚠️ O teste que prova o "cálculo DIRETO, nunca iterativo" do critério 8.
   * Somando um mês por vez, 31/01 viraria 28/02 e dali em diante o dia ficaria
   * preso no 28 — e as parcelas de março a dezembro venceriam todas na data
   * errada, em silêncio.
   */
  it("o dia NÃO escorrega depois de um mês curto", () => {
    const vs = vencimentosSugeridos("2026-01-31", 12);
    expect(vs.map((v) => v.data)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-09-30",
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
    ]);
  });

  it("ano bissexto: 29 de fevereiro existe em 2028 e não em 2026", () => {
    expect(vencimentosSugeridos("2028-01-29", 2).map((v) => v.data)).toEqual([
      "2028-01-29",
      "2028-02-29",
    ]);
    expect(vencimentosSugeridos("2026-01-29", 2)[1]).toEqual({
      data: "2026-02-28",
      ajustada: true,
      etiqueta: "ajustada — fevereiro não tem dia 29",
    });
  });

  it("24 parcelas atravessam dois anos sem furo", () => {
    const vs = vencimentosSugeridos("2026-03-10", 24);
    expect(vs).toHaveLength(24);
    expect(vs[12].data).toBe("2027-03-10");
    expect(vs[23].data).toBe("2028-02-10");
  });

  it("recusa semente fora do formato ou inexistente", () => {
    expect(() => vencimentosSugeridos("10/2026", 3)).toThrow();
    expect(() => vencimentosSugeridos("2026-02-30", 3)).toThrow();
    expect(() => vencimentosSugeridos("2026-13-01", 3)).toThrow();
    expect(() => vencimentosSugeridos("2026-10-15", 0)).toThrow();
  });
});

describe("conferirSoma — a diferença é NOMEADA (critério 9)", () => {
  it("bate", () => {
    expect(conferirSoma(4_500_000, 4_500_000)).toEqual({ estado: "bate" });
  });

  it("falta nomeia quanto falta", () => {
    const r = conferirSoma(4_499_999, 4_500_000);
    expect(r.estado).toBe("falta");
    expect(r).toMatchObject({ centavos: 1 });
    expect(r.estado !== "bate" && r.mensagem).toMatch(
      /^Falta R\$\s?0,01 para a soma bater com o valor total\.$/,
    );
  });

  it("sobra nomeia quanto sobra", () => {
    const r = conferirSoma(4_500_001, 4_500_000);
    expect(r.estado).toBe("sobra");
    expect(r).toMatchObject({ centavos: 1 });
    expect(r.estado !== "bate" && r.mensagem).toMatch(
      /^Sobra R\$\s?0,01 — a soma passou do valor total\.$/,
    );
  });

  it("somaDasParcelas trata linha ilegível como zero, nunca como total", () => {
    expect(
      somaDasParcelas([{ valorCentavos: 100 }, { valorCentavos: null }]),
    ).toBe(100);
  });
});

function lote(
  over: Partial<EntradaLoteCompraCartao> = {},
): EntradaLoteCompraCartao {
  return {
    favorecidoNome: "Ilhamix Concreto",
    favorecidoDocumento: "11.222.333/0001-81",
    dataCompra: "2026-10-01",
    valorTotalCentavos: 4_500_000,
    parcelas: [
      { valorCentavos: 1_500_000, dataVencimento: "2026-10-15" },
      { valorCentavos: 1_500_000, dataVencimento: "2026-11-15" },
      { valorCentavos: 1_500_000, dataVencimento: "2026-12-15" },
    ],
    ...over,
  };
}

describe("validarLoteCompraCartao", () => {
  it("lote completo e com a soma batendo não tem erro nenhum", () => {
    expect(validarLoteCompraCartao(lote())).toEqual([]);
  });

  it("menos de 2 parcelas não é lote — e manda para a tela individual", () => {
    const erros = validarLoteCompraCartao(
      lote({
        parcelas: [{ valorCentavos: 4_500_000, dataVencimento: "2026-10-15" }],
      }),
    );
    expect(erros).toEqual([
      { escopo: "lote", campo: "parcelas", mensagem: LOTE_ABAIXO_DO_MINIMO },
    ]);
  });

  it("acima de 24 recusa com o texto do teto", () => {
    const parcelas = vencimentosSugeridos("2026-10-15", 25).map((v) => ({
      valorCentavos: 180_000,
      dataVencimento: v.data,
    }));
    const erros = validarLoteCompraCartao(
      lote({ parcelas, valorTotalCentavos: 180_000 * 25 }),
    );
    expect(erros).toContainEqual({
      escopo: "lote",
      campo: "parcelas",
      mensagem: LOTE_ACIMA_DO_MAXIMO,
    });
  });

  it("soma divergente recusa nomeando a diferença, por linha intacta", () => {
    const erros = validarLoteCompraCartao(
      lote({
        parcelas: [
          { valorCentavos: 1_500_000, dataVencimento: "2026-10-15" },
          { valorCentavos: 1_500_000, dataVencimento: "2026-11-15" },
          { valorCentavos: 1_500_001, dataVencimento: "2026-12-15" },
        ],
      }),
    );
    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatchObject({ escopo: "lote", campo: "valorTotal" });
    expect(erros[0].mensagem).toMatch(/^Sobra /);
  });

  /**
   * Critério 11 + Gate Fiscal: a validação por linha é a de `fatura.ts` com
   * `parcelado: "vista"` fixo. Valor ≤ 0 numa parcela é recusado pela MESMA
   * regra que recusa a compra individual — não por uma cópia dela.
   */
  it("valor ilegível ou não positivo numa parcela é erro DAQUELA parcela", () => {
    const erros = validarLoteCompraCartao(
      lote({
        parcelas: [
          { valorCentavos: 4_500_000, dataVencimento: "2026-10-15" },
          { valorCentavos: null, dataVencimento: "2026-11-15" },
        ],
      }),
    );
    expect(erros).toContainEqual({
      escopo: "parcela",
      numero: 2,
      campo: "valorCentavos",
      mensagem: "Informe o valor da compra.",
    });
  });

  it("data vazia numa parcela diz QUAL parcela", () => {
    const erros = validarLoteCompraCartao(
      lote({
        parcelas: [
          { valorCentavos: 2_250_000, dataVencimento: "2026-10-15" },
          { valorCentavos: 2_250_000, dataVencimento: "" },
        ],
      }),
    );
    expect(erros).toContainEqual({
      escopo: "parcela",
      numero: 2,
      campo: "dataVencimentoFatura",
      mensagem: dataDaParcelaVazia(2),
    });
    expect(dataDaParcelaVazia(2)).toBe(
      "Preencha a data da parcela 2 para continuar.",
    );
  });

  it("data impossível é recusada como vazia — 31 de fevereiro não existe", () => {
    const erros = validarLoteCompraCartao(
      lote({
        parcelas: [
          { valorCentavos: 2_250_000, dataVencimento: "2026-01-31" },
          { valorCentavos: 2_250_000, dataVencimento: "2026-02-31" },
        ],
      }),
    );
    expect(erros).toContainEqual({
      escopo: "parcela",
      numero: 2,
      campo: "dataVencimentoFatura",
      mensagem: dataDaParcelaVazia(2),
    });
  });

  it("favorecido curto é erro do lote inteiro, repetido por linha", () => {
    const erros = validarLoteCompraCartao(lote({ favorecidoNome: "I" }));
    expect(erros.filter((e) => e.escopo === "parcela")).toHaveLength(3);
    expect(erros[0].mensagem).toMatch(/^Informe o favorecido/);
  });

  it("valor total ilegível pede o total, e não finge soma nenhuma", () => {
    const erros = validarLoteCompraCartao(lote({ valorTotalCentavos: null }));
    expect(erros).toEqual([
      {
        escopo: "lote",
        campo: "valorTotal",
        mensagem: "Informe o valor total da compra.",
      },
    ]);
  });
});

describe("os dois textos fiscais ratificados pelo contador", () => {
  it("o banner é o de cartão NO PLURAL, sem afirmação nova (critério 6)", () => {
    expect(LOTE_BANNER_AGENDAMENTO).toBe(
      "Estas compras nascem sempre agendamento — o dinheiro só sai quando " +
        "cada fatura for paga. O favorecido é o lojista, nunca o banco nem a " +
        "administradora.",
    );
  });

  it("a Dica explica a AUSÊNCIA do campo Parcelado? (critério 5)", () => {
    expect(LOTE_DICA_SEM_PARCELADO).toBe(
      "Nenhuma parcela aqui pergunta se é parcelada — cada uma já nasce um " +
        "evento à vista, sozinha. Vínculo com nota não é feito aqui: depois " +
        "de criadas, ligue cada parcela em pré-vínculo.",
    );
  });
});
