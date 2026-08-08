import { describe, expect, it } from "vitest";

import {
  centavosParaNumeric,
  formatarBRL,
  numericParaCentavos,
  parseValorInput,
} from "@/lib/money";

describe("numericParaCentavos", () => {
  it("converte o numeric(14,2) do PostgREST", () => {
    expect(numericParaCentavos(4850)).toBe(485000);
    expect(numericParaCentavos(0.01)).toBe(1);
    expect(numericParaCentavos(932400.55)).toBe(93240055);
  });

  it("aceita também o numeric serializado como texto", () => {
    expect(numericParaCentavos("4850.00")).toBe(485000);
    expect(numericParaCentavos("0.01")).toBe(1);
    expect(numericParaCentavos("932400.55")).toBe(93240055);
  });

  it("devolve null quando não há valor", () => {
    expect(numericParaCentavos(null)).toBeNull();
    expect(numericParaCentavos("")).toBeNull();
    expect(numericParaCentavos("abc")).toBeNull();
  });
});

describe("centavosParaNumeric", () => {
  it("volta para o valor aceito pelo numeric(14,2)", () => {
    expect(centavosParaNumeric(485000)).toBe(4850);
    expect(centavosParaNumeric(1)).toBe(0.01);
    expect(centavosParaNumeric(93240055)).toBe(932400.55);
  });

  it("ida e volta não perde centavo", () => {
    for (const c of [1, 99, 100, 123456, 93240055]) {
      expect(numericParaCentavos(centavosParaNumeric(c))).toBe(c);
    }
  });
});

describe("parseValorInput", () => {
  it("aceita o que se digita no celular", () => {
    expect(parseValorInput("4850")).toBe(485000);
    expect(parseValorInput("4850,00")).toBe(485000);
    expect(parseValorInput("4.850,00")).toBe(485000);
    expect(parseValorInput("4850.00")).toBe(485000);
    expect(parseValorInput("R$ 4.850,00")).toBe(485000);
    expect(parseValorInput("0,50")).toBe(50);
  });

  it("lê ponto como milhar quando o grupo tem 3 dígitos", () => {
    expect(parseValorInput("4.850")).toBe(485000);
    expect(parseValorInput("1.234.567")).toBe(123456700);
    // dois dígitos depois do ponto = decimal, não milhar
    expect(parseValorInput("4.85")).toBe(485);
  });

  it("recusa entrada ambígua em vez de assumir zero", () => {
    expect(parseValorInput("")).toBeNull();
    expect(parseValorInput("abc")).toBeNull();
    expect(parseValorInput("-100")).toBeNull();
    expect(parseValorInput("1,234")).toBeNull();
  });
});

describe("formatarBRL", () => {
  // Intl usa espaço não-quebrável entre "R$" e o número.
  const normalizar = (s: string) => s.replace(/\s/g, " ");

  it("formata em real", () => {
    expect(normalizar(formatarBRL(485000))).toBe("R$ 4.850,00");
    expect(normalizar(formatarBRL(0))).toBe("R$ 0,00");
    expect(normalizar(formatarBRL(93240055))).toBe("R$ 932.400,55");
  });
});
