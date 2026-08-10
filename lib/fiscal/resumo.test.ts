import { describe, expect, it } from "vitest";

import { calcularResumo, type EntradaResumo } from "@/lib/fiscal/resumo";
import type { Documento, Obra, Pagamento } from "@/lib/types";

const OBRA: Obra = {
  id: "obra-1",
  nome: "Casa Cachoeira",
  cno: "12.345.67890/26",
  matricula: "38.104",
  cartorio: "1º Ofício de Registro de Imóveis",
  municipio: "Florianópolis",
  valorTerrenoCentavos: 80_000_000, // R$ 800.000,00
  valorItbiCentavos: 0,
  valorEscrituraRegistroCentavos: 0,
  dataInicioObra: "2025-11-04",
  cnoRegistradoEm: "2025-11-20",
  unidadesAutonomas: 1,
  origemDesmembramentoLoteamento: false,
};

function doc(over: Partial<Documento> & { id: string }): Documento {
  return {
    obraId: OBRA.id,
    tipo: "nf_material",
    status: "registrado",
    valorCentavos: 100_000,
    vencimento: null,
    classificacao: "material",
    destinatarioCpfOk: true,
    retencao11: null,
    motivoQuarentena: null,
    favorecidoNome: "Casa do Construtor",
    arquivoPath: "u/documento/a.pdf",
    ...over,
  };
}

function pag(over: Partial<Pagamento> & { id: string }): Pagamento {
  return {
    obraId: OBRA.id,
    valorCentavos: 100_000,
    dataPagamento: "2026-05-10",
    meio: "pix",
    status: "aguardando_nf",
    favorecidoId: "fav-1",
    favorecidoNome: "AJE Construções",
    favorecidoTipo: "pj",
    comprovantePath: "u/comprovante/a.pdf",
    documentoIds: [],
    ...over,
  };
}

function resumo(over: Partial<EntradaResumo> = {}) {
  return calcularResumo({
    obra: OBRA,
    documentos: [],
    pagamentos: [],
    ano: 2026,
    ...over,
  });
}

describe("custo confirmado (regime de caixa)", () => {
  it("conta o pagamento conciliado a documento hábil, pelo ano do pagamento", () => {
    const r = resumo({
      documentos: [doc({ id: "d1" })],
      pagamentos: [
        pag({
          id: "p1",
          status: "conciliado",
          documentoIds: ["d1"],
          valorCentavos: 500_000,
          dataPagamento: "2026-03-01",
        }),
      ],
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(500_000);
  });

  it("ignora o pagamento do ano anterior no total do ano, mas soma no acumulado", () => {
    const r = resumo({
      documentos: [doc({ id: "d1" })],
      pagamentos: [
        pag({
          id: "p1",
          status: "conciliado",
          documentoIds: ["d1"],
          valorCentavos: 300_000,
          dataPagamento: "2025-12-31",
        }),
      ],
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(0);
    expect(r.acumuladoImovelCentavos).toBe(
      OBRA.valorTerrenoCentavos + 300_000,
    );
  });

  it("não conta pagamento do ano seguinte no acumulado de 31/12", () => {
    const r = resumo({
      documentos: [doc({ id: "d1" })],
      pagamentos: [
        pag({
          id: "p1",
          status: "conciliado",
          documentoIds: ["d1"],
          dataPagamento: "2027-01-02",
        }),
      ],
    });
    expect(r.acumuladoImovelCentavos).toBe(OBRA.valorTerrenoCentavos);
  });

  it("pagamento sem NF vinculada não sustenta custo", () => {
    const r = resumo({ pagamentos: [pag({ id: "p1", valorCentavos: 900_000 })] });
    expect(r.custoConfirmadoAnoCentavos).toBe(0);
    expect(r.acumuladoImovelCentavos).toBe(OBRA.valorTerrenoCentavos);
  });

  it("documento em quarentena não é documento hábil", () => {
    const r = resumo({
      documentos: [
        doc({ id: "d1", status: "quarentena", destinatarioCpfOk: false }),
      ],
      pagamentos: [
        pag({ id: "p1", status: "conciliado", documentoIds: ["d1"] }),
      ],
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(0);
  });

  it("boleto não é documento hábil sozinho — pagamento conciliado só a ele não vira custo", () => {
    const r = resumo({
      documentos: [
        doc({
          id: "d1",
          tipo: "boleto",
          status: "aguardando_pagamento",
          valorCentavos: 2_500_000,
        }),
      ],
      pagamentos: [
        pag({
          id: "p1",
          status: "conciliado",
          documentoIds: ["d1"],
          valorCentavos: 2_500_000,
        }),
      ],
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(0);
    expect(r.acumuladoImovelCentavos).toBe(OBRA.valorTerrenoCentavos);
  });

  it("boleto + NF no mesmo pagamento: a NF é que sustenta o custo", () => {
    const r = resumo({
      documentos: [
        doc({ id: "d1", tipo: "boleto", status: "aguardando_pagamento" }),
        doc({ id: "d2", tipo: "nf_material" }),
      ],
      pagamentos: [
        pag({
          id: "p1",
          status: "conciliado",
          documentoIds: ["d1", "d2"],
          valorCentavos: 2_500_000,
        }),
      ],
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(2_500_000);
  });

  it("acumulado começa no terreno mesmo sem obra lançada", () => {
    expect(resumo().acumuladoImovelCentavos).toBe(OBRA.valorTerrenoCentavos);
  });
});

describe("pendências", () => {
  it("documento em quarentena vira pendência vermelha com rota de detalhe", () => {
    const r = resumo({
      documentos: [
        doc({
          id: "d1",
          status: "quarentena",
          destinatarioCpfOk: false,
          valorCentavos: 485_000,
        }),
      ],
    });
    const p = r.pendencias.find((x) => x.tipo === "quarentena");
    expect(p).toBeDefined();
    expect(p?.gravidade).toBe("red");
    expect(p?.valorCentavos).toBe(485_000);
    expect(p?.href).toBe("/documento/d1");
    expect(p?.consequencia).toContain("custo de aquisição");
  });

  it("boleto registrado fica aguardando pagamento", () => {
    const r = resumo({
      documentos: [
        doc({
          id: "d1",
          tipo: "boleto",
          status: "aguardando_pagamento",
          valorCentavos: 2_500_000,
        }),
      ],
    });
    const p = r.pendencias.find((x) => x.tipo === "boleto_sem_nf");
    // O documento está em `aguardando_pagamento` — o chip não pode dizer outra coisa.
    expect(p?.chip).toBe("Aguardando pagamento");
    expect(p?.valorCentavos).toBe(2_500_000);
  });

  it("agrupa 'pago sem nota' por favorecido com o acumulado", () => {
    const r = resumo({
      pagamentos: [
        pag({ id: "p1", valorCentavos: 1_500_000 }),
        pag({ id: "p2", valorCentavos: 1_500_000 }),
        pag({ id: "p3", valorCentavos: 1_500_000 }),
        pag({
          id: "p4",
          favorecidoId: "fav-2",
          favorecidoNome: "Outro",
          valorCentavos: 100_000,
        }),
      ],
    });
    const pendencias = r.pendencias.filter((x) => x.tipo === "pago_sem_nota");
    expect(pendencias).toHaveLength(2);
    const aje = pendencias.find((x) => x.detalhe === "AJE Construções");
    expect(aje?.titulo).toBe("3 PIX sem NF vinculada");
    expect(aje?.valorCentavos).toBe(4_500_000);
    expect(aje?.gravidade).toBe("red");
  });

  it("favorecido PJ: a pendência cobra a NF", () => {
    const r = resumo({ pagamentos: [pag({ id: "p1" })] });
    const p = r.pendencias.find((x) => x.tipo === "pago_sem_nota");
    expect(p?.chip).toBe("Pago sem nota");
    expect(p?.titulo).toBe("1 PIX sem NF vinculada");
    expect(p?.consequencia).toContain("NF");
  });

  it("favorecido PF: a pendência cobra o recibo assinado, não a NF", () => {
    const r = resumo({
      pagamentos: [
        pag({
          id: "p1",
          favorecidoId: "fav-pf",
          favorecidoNome: "José Pedreiro",
          favorecidoTipo: "pf",
        }),
      ],
    });
    const p = r.pendencias.find((x) => x.tipo === "pago_sem_nota");
    expect(p?.chip).toBe("Pago sem recibo");
    expect(p?.titulo).toBe("1 PIX sem recibo vinculado");
    expect(p?.consequencia).toContain("recibo assinado");
    expect(p?.consequencia).not.toContain("NF");
  });

  it("favorecido sem tipo conhecido não vira cobrança de NF", () => {
    const r = resumo({
      pagamentos: [pag({ id: "p1", favorecidoId: null, favorecidoTipo: null })],
    });
    const p = r.pendencias.find((x) => x.tipo === "pago_sem_nota");
    expect(p?.chip).toBe("Pago sem documento");
    expect(p?.titulo).toBe("1 PIX sem documento hábil vinculado");
  });

  it("NF de serviço sem retenção confirmada avisa do INSS", () => {
    const r = resumo({
      documentos: [
        doc({ id: "d1", tipo: "nf_servico", retencao11: null, valorCentavos: 1_800_000 }),
        doc({ id: "d2", tipo: "nf_servico", retencao11: false }),
        doc({ id: "d3", tipo: "nf_servico", retencao11: true }),
      ],
    });
    const ids = r.pendencias
      .filter((x) => x.tipo === "servico_sem_retencao")
      .map((x) => x.id);
    expect(ids).toEqual(["sem-retencao:d1", "sem-retencao:d2"]);
    const p = r.pendencias.find((x) => x.id === "sem-retencao:d1");
    expect(p?.consequencia).toContain("SERO");
    expect(p?.gravidade).toBe("amb");
  });

  it("NF de serviço em quarentena aparece só como quarentena", () => {
    const r = resumo({
      documentos: [
        doc({
          id: "d1",
          tipo: "nf_servico",
          status: "quarentena",
          destinatarioCpfOk: false,
          retencao11: null,
        }),
      ],
    });
    expect(r.pendencias.map((p) => p.tipo)).toEqual(["quarentena"]);
  });

  it("total em pendência soma tudo que está listado", () => {
    const r = resumo({
      documentos: [
        doc({ id: "d1", status: "quarentena", destinatarioCpfOk: false, valorCentavos: 485_000 }),
        doc({ id: "d2", tipo: "boleto", status: "aguardando_pagamento", valorCentavos: 2_500_000 }),
        doc({ id: "d3", tipo: "nf_servico", retencao11: false, valorCentavos: 1_800_000 }),
      ],
      pagamentos: [pag({ id: "p1", valorCentavos: 4_500_000 })],
    });
    expect(r.emPendenciaCentavos).toBe(485_000 + 2_500_000 + 1_800_000 + 4_500_000);
  });

  it("obra em dia: nenhuma pendência", () => {
    const r = resumo({
      documentos: [doc({ id: "d1" })],
      pagamentos: [
        pag({ id: "p1", status: "conciliado", documentoIds: ["d1"] }),
      ],
    });
    expect(r.pendencias).toEqual([]);
    expect(r.emPendenciaCentavos).toBe(0);
  });
});
