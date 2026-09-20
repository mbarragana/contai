import { describe, expect, it } from "vitest";

import {
  compromissosAbertosDaFatura,
  nadaElegivelParaAlocacao,
  RECUSA_PARCELADO,
  saldoNaoAlocadoCentavos,
  tetoDeAlocacaoCentavos,
  totalDesembolsadoCentavos,
  validarCompraCartao,
  type EntradaCompraCartao,
} from "./fatura";
import type { Compromisso, Fatura } from "@/lib/types";

function entrada(over: Partial<EntradaCompraCartao> = {}): EntradaCompraCartao {
  return {
    favorecidoNome: "Depósito Bom Jesus",
    favorecidoDocumento: "33.221.100/0001-45",
    valorCentavos: 95_000,
    dataCompra: "2026-10-20",
    dataVencimentoFatura: "2026-11-10",
    parcelado: "vista",
    ...over,
  };
}

describe("validarCompraCartao", () => {
  it("sem resposta de parcelamento, pede a resposta e não olha mais nada", () => {
    const erros = validarCompraCartao(entrada({ parcelado: null }));
    expect(erros).toHaveLength(1);
    expect(erros[0].campo).toBe("parcelado");
  });

  it("parcelado é recusa síncrona, com o texto literal do contador (ADENDO 5)", () => {
    const erros = validarCompraCartao(entrada({ parcelado: "parcelado" }));
    expect(erros).toHaveLength(1);
    expect(erros[0].campo).toBe("parcelado");
    expect(erros[0].mensagem).toBe(RECUSA_PARCELADO);
  });

  it("à vista, com tudo preenchido, não tem erro", () => {
    expect(validarCompraCartao(entrada())).toEqual([]);
  });

  it("à vista sem valor, sem data da compra e sem vencimento: três erros próprios", () => {
    const erros = validarCompraCartao(
      entrada({ valorCentavos: null, dataCompra: "", dataVencimentoFatura: "" }),
    );
    expect(erros.map((e) => e.campo).sort()).toEqual([
      "dataCompra",
      "dataVencimentoFatura",
      "valorCentavos",
    ]);
  });

  it("favorecido vazio é erro — o lojista é obrigatório, nunca banco/administradora", () => {
    const erros = validarCompraCartao(entrada({ favorecidoNome: "" }));
    expect(erros.some((e) => e.campo === "favorecidoNome")).toBe(true);
  });
});

const OBRA_ID = "obra-1";

function fatura(over: Partial<Fatura> = {}): Fatura {
  return {
    id: "fat-1",
    obraId: OBRA_ID,
    dataVencimento: "2026-10-10",
    compromissoIds: ["c1", "c2", "c3"],
    desembolsos: [],
    ...over,
  };
}

function compromisso(over: Partial<Compromisso> & { id: string }): Compromisso {
  return {
    obraId: OBRA_ID,
    favorecidoId: "fav-1",
    favorecidoNome: "Leroy Merlin",
    valorPrevistoCentavos: 120_000,
    dataPrevista: "2026-10-10",
    origem: "cartao",
    documentoOrigemId: null,
    situacao: "aberto",
    motivoCancelamento: null,
    dataCompra: "2026-09-15",
    pagamentoIds: [],
    adiamentos: 0,
    ...over,
  };
}

describe("compromissosAbertosDaFatura", () => {
  it("só as da fatura, e só as abertas", () => {
    const cs = [
      compromisso({ id: "c1", situacao: "aberto" }),
      compromisso({ id: "c2", situacao: "quitado" }),
      compromisso({ id: "fora", situacao: "aberto" }), // não pertence à fatura
    ];
    const abertos = compromissosAbertosDaFatura(fatura({ compromissoIds: ["c1", "c2"] }), cs);
    expect(abertos.map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("tetoDeAlocacaoCentavos", () => {
  it("sem nenhum desembolso, teto é zero", () => {
    expect(tetoDeAlocacaoCentavos(fatura(), [])).toBe(0);
  });

  it("desembolso integral cobrindo tudo: teto = total desembolsado, nada quitado ainda", () => {
    const f = fatura({
      desembolsos: [
        { id: "d1", faturaId: "fat-1", valorCentavos: 500_000, dataPagamento: "2026-10-10", comprovantePath: null },
      ],
    });
    expect(tetoDeAlocacaoCentavos(f, [])).toBe(500_000);
  });

  it("teto encolhe exatamente pelo valor já alocado (compras quitadas desta fatura)", () => {
    const f = fatura({
      desembolsos: [
        { id: "d1", faturaId: "fat-1", valorCentavos: 150_000, dataPagamento: "2026-10-08", comprovantePath: null },
      ],
    });
    const cs = [
      compromisso({ id: "c1", situacao: "quitado", valorPrevistoCentavos: 120_000 }),
      compromisso({ id: "c2", situacao: "aberto", valorPrevistoCentavos: 48_000 }),
    ];
    expect(tetoDeAlocacaoCentavos(f, cs)).toBe(30_000);
  });

  it("compra quitada de OUTRA fatura não consome o teto desta", () => {
    const cs = [
      compromisso({ id: "c1", situacao: "aberto", valorPrevistoCentavos: 100_000 }),
      compromisso({ id: "outra-fatura", situacao: "quitado", valorPrevistoCentavos: 999_999 }),
    ];
    const f2 = fatura({
      compromissoIds: ["c1"],
      desembolsos: [
        { id: "d1", faturaId: "fat-1", valorCentavos: 100_000, dataPagamento: "2026-10-08", comprovantePath: null },
      ],
    });
    expect(tetoDeAlocacaoCentavos(f2, cs)).toBe(100_000);
  });

  it("nunca fica negativo, mesmo se o alocado (por algum motivo) superasse o desembolsado", () => {
    const f = fatura({
      desembolsos: [
        { id: "d1", faturaId: "fat-1", valorCentavos: 10_000, dataPagamento: "2026-10-08", comprovantePath: null },
      ],
    });
    const cs = [compromisso({ id: "c1", situacao: "quitado", valorPrevistoCentavos: 999_999 })];
    expect(tetoDeAlocacaoCentavos(f, cs)).toBe(0);
  });
});

describe("nadaElegivelParaAlocacao (s7v)", () => {
  it("true quando não sobra nenhuma compra aberta na fatura", () => {
    const cs = [
      compromisso({ id: "c1", situacao: "quitado" }),
      compromisso({ id: "c2", situacao: "quitado" }),
    ];
    expect(nadaElegivelParaAlocacao(fatura({ compromissoIds: ["c1", "c2"] }), cs)).toBe(true);
  });

  it("false havendo ao menos uma aberta, mesmo com teto zero", () => {
    const cs = [compromisso({ id: "c1", situacao: "aberto" })];
    // ⚠️ Nunca decidir por teto=0 — isso esconderia a compra em aberto.
    expect(nadaElegivelParaAlocacao(fatura({ compromissoIds: ["c1"] }), cs)).toBe(false);
  });
});

describe("totalDesembolsadoCentavos / saldoNaoAlocadoCentavos", () => {
  it("soma os N desembolsos (rotativo em mais de uma parcela)", () => {
    const f = fatura({
      desembolsos: [
        { id: "d1", faturaId: "fat-1", valorCentavos: 150_000, dataPagamento: "2026-10-08", comprovantePath: null },
        { id: "d2", faturaId: "fat-1", valorCentavos: 50_000, dataPagamento: "2026-11-05", comprovantePath: null },
      ],
    });
    expect(totalDesembolsadoCentavos(f)).toBe(200_000);
  });

  it("saldo não alocado é o que sobra da seleção atual, nunca negativo", () => {
    const f = fatura({
      desembolsos: [
        { id: "d1", faturaId: "fat-1", valorCentavos: 150_000, dataPagamento: "2026-10-08", comprovantePath: null },
      ],
    });
    expect(
      saldoNaoAlocadoCentavos(f, [{ valorPrevistoCentavos: 120_000 }]),
    ).toBe(30_000);
    expect(
      saldoNaoAlocadoCentavos(f, [{ valorPrevistoCentavos: 150_000 }]),
    ).toBe(0);
  });
});
