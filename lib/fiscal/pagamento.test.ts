import { describe, expect, it } from "vitest";

import {
  anoCalendario,
  ehDataValida,
  MEIO_PAGAMENTO_AVULSO,
  rotulosPagoSemNota,
  STATUS_PAGAMENTO_AVULSO,
  validarPagamentoAvulso,
  type EntradaPagamento,
} from "@/lib/fiscal/pagamento";

const CNPJ_VALIDO = "11.222.333/0001-81";
const HOJE = "2026-08-08";

function entradaValida(over: Partial<EntradaPagamento> = {}): EntradaPagamento {
  return {
    favorecidoNome: "AJE Construções",
    favorecidoDocumento: CNPJ_VALIDO,
    valorCentavos: 1500000,
    dataPagamento: "2026-08-05",
    temComprovante: true,
    ...over,
  };
}

describe("anoCalendario (regime de caixa)", () => {
  it("o ano do custo é o da data do pagamento", () => {
    expect(anoCalendario("2026-08-05")).toBe(2026);
    expect(anoCalendario("2027-01-02")).toBe(2027);
  });

  it("virada de ano: 31/12 e 01/01 caem em anos diferentes", () => {
    expect(anoCalendario("2026-12-31")).toBe(2026);
    expect(anoCalendario("2027-01-01")).toBe(2027);
  });
});

describe("ehDataValida", () => {
  it("aceita ISO real e recusa data inexistente", () => {
    expect(ehDataValida("2026-08-05")).toBe(true);
    expect(ehDataValida("2026-02-30")).toBe(false);
    expect(ehDataValida("05/08/2026")).toBe(false);
    expect(ehDataValida("")).toBe(false);
  });
});

describe("rótulos do pagamento sem documento hábil", () => {
  it("favorecido PJ deve NF", () => {
    const r = rotulosPagoSemNota("pj");
    expect(r.documento).toBe("NF");
    expect(r.chip).toBe("Pago sem nota");
    expect(r.semVinculo).toBe("sem NF vinculada");
    expect(r.consequencia).toContain("NF");
    expect(r.consequencia).not.toContain("recibo");
  });

  it("favorecido PF deve recibo assinado, nunca NF", () => {
    const r = rotulosPagoSemNota("pf");
    expect(r.documento).toBe("recibo");
    expect(r.chip).toBe("Pago sem recibo");
    expect(r.semVinculo).toBe("sem recibo vinculado");
    // O recibo só é hábil com nome, CPF completo e descrição do serviço.
    expect(r.consequencia).toContain("recibo assinado");
    expect(r.consequencia).toContain("CPF");
    expect(r.consequencia).toContain("descrição do serviço");
    expect(r.consequencia).not.toContain("NF");
  });

  it("tipo desconhecido não assume PJ: pede o CNPJ/CPF", () => {
    const r = rotulosPagoSemNota(null);
    expect(r.documento).toBe("documento hábil");
    expect(r.consequencia).toContain("CNPJ/CPF");
  });
});

describe("pagamento avulso", () => {
  it("nasce como PIX aguardando NF", () => {
    expect(MEIO_PAGAMENTO_AVULSO).toBe("pix");
    expect(STATUS_PAGAMENTO_AVULSO).toBe("aguardando_nf");
  });

  const campos = (e: EntradaPagamento, hoje = HOJE) =>
    validarPagamentoAvulso(e, hoje).map((x) => x.campo);

  it("entrada completa passa", () => {
    expect(validarPagamentoAvulso(entradaValida(), HOJE)).toEqual([]);
  });

  it("sem comprovante não salva", () => {
    expect(campos(entradaValida({ temComprovante: false }))).toContain(
      "temComprovante",
    );
  });

  it("favorecido sem CNPJ/CPF válido não salva", () => {
    expect(
      campos(entradaValida({ favorecidoDocumento: "12345678900000" })),
    ).toContain("favorecidoDocumento");
  });

  it("data no futuro não passa — jogaria o custo no ano errado", () => {
    expect(campos(entradaValida({ dataPagamento: "2027-01-02" }))).toContain(
      "dataPagamento",
    );
    // A data de hoje é válida.
    expect(campos(entradaValida({ dataPagamento: HOJE }))).toEqual([]);
  });

  it("valor e data ausentes viram erro, nunca zero silencioso", () => {
    const erros = campos(
      entradaValida({ valorCentavos: null, dataPagamento: null }),
    );
    expect(erros).toContain("valorCentavos");
    expect(erros).toContain("dataPagamento");
  });
});
