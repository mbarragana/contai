import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { podeGerarRelatorioAnual } from "@/lib/fiscal/compromisso";
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
    favorecidoDocumento: "11444777000161",
    arquivoPath: "u/documento/a.pdf",
    ...over,
  };
}

/**
 * O pagamento nasce `aguardando_nf` — é o estado real de TODO o parque de
 * registros do Mateus, porque nenhuma tela gravava `conciliado`. Os cenários
 * abaixo usam esse estado de propósito: se algum cálculo voltasse a depender
 * de `status`, o custo aqui cairia a zero e o teste acusaria.
 */
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
    // CONTAI-019: a esmagadora maioria dos pagamentos NÃO tem linha em
    // `pagamento_diferenca` — sem encargo, sem diferença, sem resolução. É o
    // caso normal, e é por isso que ele é o default do fixture.
    encargosCentavos: 0,
    naoExplicadoCentavos: 0,
    resolucaoDiferenca: null,
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
  it("conta o pagamento vinculado a documento hábil, pelo ano do pagamento", () => {
    const r = resumo({
      documentos: [doc({ id: "d1", valorCentavos: 500_000 })],
      pagamentos: [
        pag({
          id: "p1",
          documentoIds: ["d1"],
          valorCentavos: 500_000,
          dataPagamento: "2026-03-01",
        }),
      ],
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(500_000);
  });

  it("o custo é o MÍNIMO do conjunto: pagou mais do que a nota documenta", () => {
    const r = resumo({
      documentos: [doc({ id: "d1", valorCentavos: 300_000 })],
      pagamentos: [
        pag({ id: "p1", documentoIds: ["d1"], valorCentavos: 350_000 }),
      ],
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(300_000);
    // O excedente não some: continua exposto como pago sem nota.
    const exposicao = r.pendencias.find((p) => p.tipo === "pago_sem_nota");
    expect(exposicao?.valorCentavos).toBe(50_000);
  });

  it("ignora o pagamento do ano anterior no total do ano, mas soma no acumulado", () => {
    const r = resumo({
      documentos: [doc({ id: "d1", valorCentavos: 300_000 })],
      pagamentos: [
        pag({
          id: "p1",
          documentoIds: ["d1"],
          valorCentavos: 300_000,
          dataPagamento: "2025-12-31",
        }),
      ],
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(0);
    expect(r.acumuladoImovelCentavos).toBe(OBRA.valorTerrenoCentavos + 300_000);
  });

  it("não conta pagamento do ano seguinte no acumulado de 31/12", () => {
    const r = resumo({
      documentos: [doc({ id: "d1" })],
      pagamentos: [
        pag({ id: "p1", documentoIds: ["d1"], dataPagamento: "2027-01-02" }),
      ],
    });
    expect(r.acumuladoImovelCentavos).toBe(OBRA.valorTerrenoCentavos);
  });

  it("pagamento sem documento vinculado não sustenta custo", () => {
    const r = resumo({ pagamentos: [pag({ id: "p1", valorCentavos: 900_000 })] });
    expect(r.custoConfirmadoAnoCentavos).toBe(0);
    expect(r.acumuladoImovelCentavos).toBe(OBRA.valorTerrenoCentavos);
  });

  it("documento em quarentena não é documento hábil", () => {
    const r = resumo({
      documentos: [
        doc({ id: "d1", status: "quarentena", destinatarioCpfOk: false }),
      ],
      pagamentos: [pag({ id: "p1", documentoIds: ["d1"] })],
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(0);
  });

  it("boleto não é documento hábil sozinho — pagamento ligado só a ele não vira custo", () => {
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
        pag({ id: "p1", documentoIds: ["d1"], valorCentavos: 2_500_000 }),
      ],
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(0);
    expect(r.acumuladoImovelCentavos).toBe(OBRA.valorTerrenoCentavos);
  });

  it("boleto + NF no mesmo pagamento: a NF é que sustenta o custo", () => {
    const r = resumo({
      documentos: [
        doc({
          id: "d1",
          tipo: "boleto",
          status: "aguardando_pagamento",
          valorCentavos: 2_500_000,
        }),
        doc({ id: "d2", tipo: "nf_material", valorCentavos: 2_500_000 }),
      ],
      pagamentos: [
        pag({ id: "p1", documentoIds: ["d1", "d2"], valorCentavos: 2_500_000 }),
      ],
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(2_500_000);
  });

  it("acumulado começa no terreno mesmo sem obra lançada", () => {
    expect(resumo().acumuladoImovelCentavos).toBe(OBRA.valorTerrenoCentavos);
  });
});

/**
 * Critérios 4 e 7 — a trava que o parecer §2 derrubou. `status` deixou de
 * decidir custo pelos DOIS lados: nem barra quem tem vínculo, nem libera quem
 * não tem.
 */
describe("`status` do pagamento não decide custo", () => {
  it("'aguardando_nf' com vínculo hábil SUSTENTA custo", () => {
    const r = resumo({
      documentos: [doc({ id: "d1", valorCentavos: 300_000 })],
      pagamentos: [
        pag({
          id: "p1",
          status: "aguardando_nf",
          documentoIds: ["d1"],
          valorCentavos: 300_000,
        }),
      ],
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(300_000);
  });

  it("'conciliado' SEM vínculo NÃO sustenta custo", () => {
    const r = resumo({
      documentos: [doc({ id: "d1", valorCentavos: 300_000 })],
      pagamentos: [
        pag({ id: "p1", status: "conciliado", valorCentavos: 300_000 }),
      ],
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(0);
    // E ele aparece como pago sem nota, que é a verdade do estado dele.
    expect(
      r.pendencias.find((p) => p.tipo === "pago_sem_nota")?.valorCentavos,
    ).toBe(300_000);
  });
});

describe("o terceiro estado — nota hábil sem pagamento (parecer §5.2)", () => {
  it("aparece em lista própria e NÃO soma com o custo em pendência", () => {
    const r = resumo({
      documentos: [
        doc({ id: "d1", tipo: "nf_servico", retencao11: true, valorCentavos: 300_000 }),
      ],
    });
    expect(r.notasSemPagamentoCentavos).toBe(300_000);
    expect(r.notasSemPagamento[0]).toMatchObject({
      titulo: "NF de serviço sem pagamento ligado",
      href: "/documento/d1",
      valorCentavos: 300_000,
    });
    // A regra dura: este número não entra em nenhuma das duas somas.
    expect(r.custoConfirmadoAnoCentavos).toBe(0);
    expect(r.emPendenciaCentavos).toBe(0);
    expect(r.pendencias).toEqual([]);
  });

  it("nota em quarentena não entra no terceiro número — ela é pendência", () => {
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
    expect(r.notasSemPagamento).toEqual([]);
    expect(r.emPendenciaCentavos).toBe(485_000);
  });

  it("depois do vínculo a nota sai do terceiro número", () => {
    const r = resumo({
      documentos: [
        doc({ id: "d1", tipo: "nf_servico", retencao11: true, valorCentavos: 300_000 }),
      ],
      pagamentos: [
        pag({ id: "p1", documentoIds: ["d1"], valorCentavos: 300_000 }),
      ],
    });
    expect(r.notasSemPagamento).toEqual([]);
    expect(r.custoConfirmadoAnoCentavos).toBe(300_000);
  });
});

/** Critério 13 — a palavra "duplicadas" do relato. */
describe("a despesa vinculada aparece uma vez", () => {
  it("o par vira UMA despesa comprovada, e não duas pendências", () => {
    const r = resumo({
      documentos: [
        doc({
          id: "d1",
          tipo: "nf_servico",
          retencao11: true,
          valorCentavos: 300_000,
          favorecidoNome: "WK Construções LTDA",
        }),
      ],
      pagamentos: [
        pag({
          id: "p1",
          documentoIds: ["d1"],
          valorCentavos: 300_000,
          dataPagamento: "2026-08-12",
          favorecidoNome: "WK Construções LTDA",
        }),
      ],
    });
    expect(r.despesas).toHaveLength(1);
    expect(r.despesas[0]).toMatchObject({
      titulo: "WK Construções LTDA",
      valorCentavos: 300_000,
      noAnoCentavos: 300_000,
      href: "/documento/d1",
    });
    expect(r.despesas[0].detalhe).toContain("uma despesa, não duas");
    // Nem "pago sem nota", nem "nota sem pagamento": um item só na tela.
    expect(r.pendencias).toEqual([]);
    expect(r.notasSemPagamento).toEqual([]);
  });

  it("cinco PIX numa nota só formam UMA despesa, com o custo da nota", () => {
    const r = resumo({
      documentos: [doc({ id: "d1", valorCentavos: 300_000 })],
      pagamentos: [1, 2, 3, 4, 5].map((n) =>
        pag({
          id: `p${n}`,
          valorCentavos: 60_000,
          dataPagamento: `2026-08-0${n}`,
          documentoIds: ["d1"],
        }),
      ),
    });
    expect(r.despesas).toHaveLength(1);
    expect(r.despesas[0].valorCentavos).toBe(300_000);
    expect(r.custoConfirmadoAnoCentavos).toBe(300_000);
  });

  it("despesa que cruza anos mostra o total e a parte do ano em tela", () => {
    const r = resumo({
      documentos: [doc({ id: "d1", valorCentavos: 300_000 })],
      pagamentos: [
        pag({ id: "p1", valorCentavos: 100_000, dataPagamento: "2025-12-20", documentoIds: ["d1"] }),
        pag({ id: "p2", valorCentavos: 200_000, dataPagamento: "2026-01-15", documentoIds: ["d1"] }),
      ],
    });
    expect(r.despesas[0]).toMatchObject({
      valorCentavos: 300_000,
      noAnoCentavos: 200_000,
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(200_000);
  });
});

describe("pendências", () => {
  it("documento em quarentena vira pendência vermelha com a consequência", () => {
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
    expect(p?.href).toBe("/documento/d1");
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
    // Critério 3: cada pagamento tem porta para o seletor inverso.
    expect(aje?.itens?.map((i) => i.href)).toEqual([
      "/pagamento/p1",
      "/pagamento/p2",
      "/pagamento/p3",
    ]);
  });

  it("pagamento coberto por inteiro sai da exposição 'pago sem nota'", () => {
    const r = resumo({
      documentos: [doc({ id: "d1", valorCentavos: 150_000 })],
      pagamentos: [
        pag({ id: "p1", valorCentavos: 150_000, documentoIds: ["d1"] }),
        pag({ id: "p2", valorCentavos: 150_000 }),
      ],
    });
    const p = r.pendencias.find((x) => x.tipo === "pago_sem_nota");
    expect(p?.titulo).toBe("1 PIX sem NF vinculada");
    expect(p?.valorCentavos).toBe(150_000);
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
      pagamentos: [pag({ id: "p1", documentoIds: ["d1"] })],
    });
    expect(r.pendencias).toEqual([]);
    expect(r.emPendenciaCentavos).toBe(0);
  });
});

/** Critério 14: o zero mudo é o defeito que este ticket veio matar. */
describe("há registro na obra?", () => {
  it("obra vazia: não há o que explicar", () => {
    expect(resumo().temRegistro).toBe(false);
  });

  it("com registro e custo zero, a tela tem o que dizer", () => {
    const r = resumo({
      documentos: [doc({ id: "d1", valorCentavos: 300_000 })],
      pagamentos: [pag({ id: "p1", valorCentavos: 300_000 })],
    });
    expect(r.temRegistro).toBe(true);
    expect(r.custoConfirmadoAnoCentavos).toBe(0);
  });
});


// ══════════════════════════════════════════════════════════════════════════
// CONTAI-019 · as pendências novas
// ══════════════════════════════════════════════════════════════════════════

describe("pendência 'pago sem comprovante' (critérios 46-47)", () => {
  it("PJ: âmbar, com o texto literal do ADENDO 2 §5", () => {
    const r = resumo({
      pagamentos: [
        pag({ id: "p1", comprovantePath: null, valorCentavos: 1_000_000 }),
      ],
    });
    const pend = r.pendencias.find((p) => p.tipo === "pago_sem_comprovante");
    expect(pend?.gravidade).toBe("amb");
    expect(pend?.valorCentavos).toBe(1_000_000);
    expect(pend?.consequencia).toBe(
      "pago sem comprovante — o custo existe, ainda não está demonstrável",
    );
  });

  it("PF: VERMELHA — o comprovante é constitutivo, não acessório", () => {
    const r = resumo({
      pagamentos: [
        pag({
          id: "p1",
          comprovantePath: null,
          favorecidoTipo: "pf",
          favorecidoNome: "João da Silva",
          valorCentavos: 280_000,
        }),
      ],
    });
    const pend = r.pendencias.find((p) => p.tipo === "pago_sem_comprovante");
    expect(pend?.gravidade).toBe("red");
    expect(pend?.consequencia).toBe(
      "sem o comprovante da transferência, este recibo não sustenta custo nenhum",
    );
  });

  it("⚠️ não entra no custo confirmado, e não vira TAMBÉM 'pago sem nota'", () => {
    const r = resumo({
      pagamentos: [
        pag({ id: "p1", comprovantePath: null, valorCentavos: 1_000_000 }),
      ],
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(0);
    expect(r.pendencias.filter((p) => p.tipo === "pago_sem_nota")).toEqual([]);
    // O mesmo dinheiro em UMA pendência só: a exposição é R$ 10.000, não
    // R$ 20.000.
    expect(r.emPendenciaCentavos).toBe(1_000_000);
  });

  it("com comprovante, a pendência não existe", () => {
    const r = resumo({
      documentos: [doc({ id: "d1", valorCentavos: 1_000_000 })],
      pagamentos: [pag({ id: "p1", valorCentavos: 1_000_000, documentoIds: ["d1"] })],
    });
    expect(r.pendencias.filter((p) => p.tipo === "pago_sem_comprovante")).toEqual([]);
    expect(r.custoConfirmadoAnoCentavos).toBe(1_000_000);
  });
});

describe("pendência 'Diferença sem explicação' (critérios 31, 31c, 31e)", () => {
  /** O cenário do critério 31: R$ 10.500 pagos, R$ 200 de encargo, R$ 300 sem explicação. */
  const cenario = (over: Partial<Parameters<typeof pag>[0]> = {}) =>
    resumo({
      documentos: [doc({ id: "d1", valorCentavos: 1_000_000 })],
      pagamentos: [
        pag({
          id: "p1",
          valorCentavos: 1_050_000,
          encargosCentavos: 20_000,
          naoExplicadoCentavos: 30_000,
          documentoIds: ["d1"],
          ...over,
        }),
      ],
    });

  it("⚠️ aparece no BLOCO DE PENDÊNCIAS FISCAIS, em vermelho, com R$ 300,00", () => {
    // Critério 31: o dinheiro JÁ SAIU. O que o parecer §2.5 mantém fora deste
    // bloco é o COMPROMISSO, porque nada saiu. Regra de cor mono-semântica:
    // vermelho = dinheiro que saiu e não está no custo; âmbar = nada saiu ainda.
    const r = cenario();
    const pend = r.pendencias.find((p) => p.tipo === "diferenca_sem_explicacao");
    expect(pend?.gravidade).toBe("red");
    expect(pend?.valorCentavos).toBe(30_000);
    expect(pend?.chip).toBe("Diferença sem explicação");
  });

  it("a consequência é o texto LITERAL do §F.4, com o valor interpolado", () => {
    const pend = cenario().pendencias.find(
      (p) => p.tipo === "diferenca_sem_explicacao",
    );
    expect(pend?.consequencia).toContain("do que você pagou ainda estão sem explicação.");
    expect(pend?.consequencia).toContain("ficam fora para sempre — e não há o que cobrar");
    expect(pend?.consequencia).toContain("contam como pago sem nota");
    // ⚠️ NÃO ancora no previsto: previsão não decide custo nenhum.
    expect(pend?.consequencia).not.toContain("previsto");
  });

  it("resolvida como 'não compõe custo' some da home — não há o que cobrar", () => {
    const r = cenario({ resolucaoDiferenca: "nao_compoe_custo" });
    expect(r.pendencias.filter((p) => p.tipo === "diferenca_sem_explicacao")).toEqual([]);
    expect(r.custoConfirmadoAnoCentavos).toBe(1_000_000);
  });

  it("resolvida como 'falta o documento' vira 'pago sem nota' pelo valor da diferença", () => {
    const r = cenario({ resolucaoDiferenca: "falta_documento" });
    expect(r.pendencias.filter((p) => p.tipo === "diferenca_sem_explicacao")).toEqual([]);
    const semNota = r.pendencias.find((p) => p.tipo === "pago_sem_nota");
    expect(semNota?.valorCentavos).toBe(30_000);
    // §F.1: o número do custo NÃO se move hoje — o teto é a nota de R$ 10.000.
    expect(r.custoConfirmadoAnoCentavos).toBe(1_000_000);
  });

  it("⚠️ 'errei o valor digitado' NÃO resolve: a pendência continua de pé", () => {
    // §F.2, item 4: não é classificação fiscal, é correção de registro com
    // rastro (CONTAI-021). Sumir com o alerta sem que nada mudou no mundo é o
    // oposto do que ele existe para fazer.
    const r = cenario({ resolucaoDiferenca: "erro_digitacao" });
    expect(
      r.pendencias.find((p) => p.tipo === "diferenca_sem_explicacao")?.valorCentavos,
    ).toBe(30_000);
  });

  it("⚠️ 31b — diferença sem resposta NÃO bloqueia o relatório anual", () => {
    // Ao contrário do compromisso vencido (critério 21): aqui o fato consumado
    // já está registrado e o único erro possível SUBESTIMA o custo. Ela entra
    // na lista de revisão pré-declaração, não no bloqueio.
    const r = cenario();
    expect(r.pendencias.some((p) => p.tipo === "diferenca_sem_explicacao")).toBe(true);
    expect(
      podeGerarRelatorioAnual([], "2026-08-18", 2026),
      "o bloqueio anual só conhece COMPROMISSO — pagamento com diferença não entra nele",
    ).toEqual({ ok: true });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ⚠️ OS OITO LUGARES onde compromisso NÃO pode aparecer (parecer §2)
//
// "Não pode aparecer, em nenhuma hipótese" `[Certain]`. A proteção é de TIPO,
// não de atenção (critério 3): o que estes testes provam não é que o número
// deu zero — é que NÃO EXISTE CAMINHO de código para o compromisso chegar lá.
// ══════════════════════════════════════════════════════════════════════════

describe("os oito lugares (parecer §2, itens 1 a 8)", () => {
  const painel = {
    documentos: [doc({ id: "d1", valorCentavos: 1_000_000 })],
    pagamentos: [pag({ id: "p1", valorCentavos: 1_000_000, documentoIds: ["d1"] })],
  };

  it("1 · custo confirmado e acumulado: `EntradaResumo` não tem compromisso", () => {
    const r = calcularResumo({
      obra: OBRA,
      ...painel,
      ano: 2026,
      // @ts-expect-error compromisso não entra em cálculo de custo nenhum
      compromissos: [],
    });
    expect(r.custoConfirmadoAnoCentavos).toBe(1_000_000);
    expect(r.acumuladoImovelCentavos).toBe(
      OBRA.valorTerrenoCentavos + 1_000_000,
    );
  });

  it("2, 3 e 4 · discriminação, Pagamentos Efetuados e aferição INSS", () => {
    // ⚠️ AS TRÊS FUNÇÕES AINDA NÃO EXISTEM (US-004 e o SERO são tickets
    // futuros). O que este teste tranca é a AUSÊNCIA DE CAMINHO: nenhum módulo
    // de `lib/fiscal/` além do próprio `compromisso.ts` sequer NOMEIA o tipo
    // `Compromisso`. No dia em que a discriminação de Bens e Direitos nascer,
    // ela só conseguirá receber um compromisso importando o tipo — e este
    // teste fica vermelho com o nome do arquivo, ANTES de qualquer número
    // errado ir para uma declaração.
    const dir = "lib/fiscal";
    const proibidos = readdirSync(dir).filter(
      (f) =>
        f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "compromisso.ts",
    );
    expect(proibidos.length).toBeGreaterThan(3); // o teste vale alguma coisa
    for (const arquivo of proibidos) {
      const fonte = readFileSync(`${dir}/${arquivo}`, "utf-8");
      expect(
        /\bCompromisso\b/.test(fonte),
        `${arquivo} passou a conhecer o tipo Compromisso — parecer §2, itens 2, 3 e 4`,
      ).toBe(false);
    }
  });

  it("5 · 'pago sem nota' e qualquer pendência fiscal só olham pagamento", () => {
    const r = calcularResumo({ obra: OBRA, ...painel, ano: 2026 });
    for (const p of r.pendencias) {
      expect(p.id.startsWith("compromisso")).toBe(false);
    }
    // Não há fato consumado num compromisso, logo não há risco fiscal — o
    // vencido é ÂMBAR e mora no bloco de agendados, fora daqui (critério 19).
    expect(r.pendencias.map((p) => p.tipo)).not.toContain("compromisso_vencido");
  });

  it("6 · o TERCEIRO NÚMERO é composto por documentos, não por previsões", () => {
    const r = calcularResumo({
      obra: OBRA,
      documentos: [doc({ id: "d1", valorCentavos: 300_000 })],
      pagamentos: [],
      ano: 2026,
    });
    expect(r.notasSemPagamentoCentavos).toBe(300_000);
    for (const n of r.notasSemPagamento) {
      expect(n.href.startsWith("/documento/")).toBe(true);
    }
  });

  it("7 · o grafo de `alocarCusto` não tem nó de compromisso", () => {
    // A prova está em `vinculo.test.ts` (`@ts-expect-error` na entrada de
    // `alocarCusto` + a forma do componente). Aqui fica o elo: o resumo inteiro
    // vem daquele grafo, então o que não entra lá não entra em número nenhum.
    const r = calcularResumo({ obra: OBRA, ...painel, ano: 2026 });
    expect(Object.keys(r.alocacao).sort()).toEqual([
      "componentes",
      "porDocumento",
      "porPagamento",
    ]);
  });

  it("8 · qualquer soma mista: nem `resumo.ts` nem `vinculo.ts` importam compromisso", () => {
    // "Não existe 'total previsto + realizado' em lugar nenhum do app."
    // A dependência é de mão única — compromisso pode olhar pagamento; cálculo
    // de custo não olha compromisso.
    for (const arquivo of ["resumo.ts", "vinculo.ts"]) {
      const fonte = readFileSync(`lib/fiscal/${arquivo}`, "utf-8");
      expect(
        /from ["']\.\/compromisso["']/.test(fonte),
        `${arquivo} passou a importar lib/fiscal/compromisso — é assim que nasce a soma mista`,
      ).toBe(false);
    }
  });
});
