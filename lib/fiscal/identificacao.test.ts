import { describe, expect, it } from "vitest";

import {
  formatarDocumento,
  soDigitos,
  tipoPorDocumento,
  validarCnpj,
  validarCpf,
} from "@/lib/fiscal/identificacao";

describe("validarCpf", () => {
  it("aceita CPF com dígito verificador correto", () => {
    expect(validarCpf("529.982.247-25")).toBe(true);
    expect(validarCpf("52998224725")).toBe(true);
  });

  it("recusa dígito verificador errado, tamanho errado e repetição", () => {
    expect(validarCpf("529.982.247-24")).toBe(false);
    expect(validarCpf("5299822472")).toBe(false);
    expect(validarCpf("111.111.111-11")).toBe(false);
    expect(validarCpf("")).toBe(false);
  });
});

describe("validarCnpj", () => {
  it("aceita CNPJ com dígito verificador correto", () => {
    expect(validarCnpj("11.222.333/0001-81")).toBe(true);
    expect(validarCnpj("11222333000181")).toBe(true);
  });

  it("recusa dígito verificador errado e repetição", () => {
    expect(validarCnpj("11.222.333/0001-82")).toBe(false);
    expect(validarCnpj("00.000.000/0000-00")).toBe(false);
    expect(validarCnpj("1122233300018")).toBe(false);
  });
});

describe("tipoPorDocumento", () => {
  it("11 dígitos válidos = PF, 14 dígitos válidos = PJ", () => {
    expect(tipoPorDocumento("529.982.247-25")).toBe("pf");
    expect(tipoPorDocumento("11.222.333/0001-81")).toBe("pj");
  });

  it("null quando o documento não sustenta o registro", () => {
    expect(tipoPorDocumento("123")).toBeNull();
    expect(tipoPorDocumento("529.982.247-24")).toBeNull();
    expect(tipoPorDocumento("")).toBeNull();
  });
});

describe("soDigitos e formatarDocumento", () => {
  it("normaliza e formata", () => {
    expect(soDigitos("11.222.333/0001-81")).toBe("11222333000181");
    expect(formatarDocumento("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarDocumento("52998224725")).toBe("529.982.247-25");
    expect(formatarDocumento("123")).toBe("123");
  });
});
