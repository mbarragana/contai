import { describe, expect, it } from "vitest";

import {
  avisaInss,
  classificacaoProposta,
  exigeRetencao,
  motivoQuarentena,
  MOTIVO_QUARENTENA_CPF,
  retencaoParaBanco,
  statusDocumento,
  validarDocumento,
  type EntradaDocumento,
} from "@/lib/fiscal/documento";

const CNPJ_VALIDO = "11.222.333/0001-81";

function entradaValida(over: Partial<EntradaDocumento> = {}): EntradaDocumento {
  return {
    tipo: "nf_material",
    favorecidoNome: "Casa do Construtor Ltda",
    favorecidoDocumento: CNPJ_VALIDO,
    valorCentavos: 485000,
    vencimento: null,
    classificacao: "material",
    notaNoCpf: "sim",
    retencao11: null,
    temArquivo: true,
    ...over,
  };
}

describe("classificacaoProposta", () => {
  it("propõe a partir do tipo, sem chutar no boleto", () => {
    expect(classificacaoProposta("nf_material")).toBe("material");
    expect(classificacaoProposta("nf_servico")).toBe("mao_obra");
    // Boleto não diz o que foi comprado: incerteza vai para revisão humana.
    expect(classificacaoProposta("boleto")).toBeNull();
    expect(classificacaoProposta(null)).toBeNull();
  });
});

describe("statusDocumento", () => {
  it("nota fora do CPF do dono nasce em quarentena", () => {
    expect(statusDocumento("nf_material", "nao")).toBe("quarentena");
    expect(statusDocumento("nf_servico", "nao")).toBe("quarentena");
    // Quarentena vence sobre a regra do boleto (constraint do banco).
    expect(statusDocumento("boleto", "nao")).toBe("quarentena");
    expect(motivoQuarentena("nao")).toBe(MOTIVO_QUARENTENA_CPF);
  });

  it("boleto no CPF certo fica aguardando pagamento — não é documento hábil", () => {
    expect(statusDocumento("boleto", "sim")).toBe("aguardando_pagamento");
  });

  it("NF no CPF certo nasce registrada", () => {
    expect(statusDocumento("nf_material", "sim")).toBe("registrado");
    expect(statusDocumento("nf_servico", "sim")).toBe("registrado");
    expect(motivoQuarentena("sim")).toBeNull();
  });
});

describe("retenção 11%", () => {
  it("só é perguntada em NF de serviço", () => {
    expect(exigeRetencao("nf_servico")).toBe(true);
    expect(exigeRetencao("nf_material")).toBe(false);
    expect(exigeRetencao("boleto")).toBe(false);
  });

  it("'não sei' não vira 'não': vai como desconhecido", () => {
    expect(retencaoParaBanco("sim")).toBe(true);
    expect(retencaoParaBanco("nao")).toBe(false);
    expect(retencaoParaBanco("nao_sei")).toBeNull();
    expect(retencaoParaBanco(null)).toBeNull();
  });

  it("avisa do INSS em 'não' e em 'não sei', nunca em 'sim'", () => {
    expect(avisaInss("nf_servico", "nao")).toBe(true);
    expect(avisaInss("nf_servico", "nao_sei")).toBe(true);
    expect(avisaInss("nf_servico", "sim")).toBe(false);
    // Sem resposta ainda: a validação bloqueia, o aviso não aparece antes.
    expect(avisaInss("nf_servico", null)).toBe(false);
    // Material é irrelevante para a aferição do INSS.
    expect(avisaInss("nf_material", "nao")).toBe(false);
    expect(avisaInss("boleto", "nao")).toBe(false);
  });
});

describe("validarDocumento", () => {
  const campos = (e: EntradaDocumento) =>
    validarDocumento(e).map((x) => x.campo);

  it("entrada completa passa", () => {
    expect(validarDocumento(entradaValida())).toEqual([]);
  });

  it("sem arquivo não salva — o acervo nasce no registro", () => {
    expect(campos(entradaValida({ temArquivo: false }))).toContain("temArquivo");
  });

  it("sem responder o check do CPF não salva (critério 4)", () => {
    expect(campos(entradaValida({ notaNoCpf: null }))).toContain("notaNoCpf");
  });

  it("NF de serviço sem responder a retenção não salva (critério 5)", () => {
    expect(
      campos(entradaValida({ tipo: "nf_servico", classificacao: "mao_obra" })),
    ).toContain("retencao11");
  });

  it("NF de material não exige resposta de retenção", () => {
    expect(campos(entradaValida({ retencao11: null }))).not.toContain(
      "retencao11",
    );
  });

  it("classificação em branco não salva — nunca chute silencioso", () => {
    expect(campos(entradaValida({ classificacao: null }))).toContain(
      "classificacao",
    );
  });

  it("boleto exige vencimento", () => {
    expect(
      campos(
        entradaValida({ tipo: "boleto", classificacao: "material", vencimento: null }),
      ),
    ).toContain("vencimento");
  });

  it("CNPJ inválido e valor zerado não passam", () => {
    const erros = campos(
      entradaValida({ favorecidoDocumento: "11.222.333/0001-82", valorCentavos: 0 }),
    );
    expect(erros).toContain("favorecidoDocumento");
    expect(erros).toContain("valorCentavos");
  });
});
