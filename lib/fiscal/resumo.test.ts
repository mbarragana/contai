import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { podeGerarRelatorioAnual } from "@/lib/fiscal/compromisso";
import { calcularResumo, type EntradaResumo } from "@/lib/fiscal/resumo";
import type {
  Documento,
  Financiamento,
  FinanciamentoInforme,
  Obra,
  Pagamento,
  TerrenoDesembolso,
} from "@/lib/types";

const OBRA: Obra = {
  id: "obra-1",
  nome: "Casa Cachoeira",
  cno: "12.345.67890/26",
  matricula: "38.104",
  cartorio: "1º Ofício de Registro de Imóveis",
  municipio: "Florianópolis",
  naturezaAquisicaoTerreno: "financiado",
  dataInicioObra: "2025-11-04",
  cnoRegistradoEm: "2025-11-20",
  unidadesAutonomas: 1,
  origemDesmembramentoLoteamento: false,
};

/**
 * CONTAI-010 — o terreno saiu das colunas da obra e virou desembolso DATADO.
 * R$ 800.000,00 pagos em 2025, que é o que a obra do seed sempre significou.
 */
const TERRENO: TerrenoDesembolso = {
  id: "t1",
  obraId: "obra-1",
  tipo: "pagamento_terreno",
  valorCentavos: 80_000_000,
  dataPagamento: "2025-06-10",
  estado: "pago",
  origemRecurso: null,
  anexos: [
    {
      id: "a1",
      arquivoPath: "u/terreno/escritura.pdf",
      papel: "comprovante",
      createdAt: "2025-06-10T12:00:00Z",
    },
  ],
  debitosMesmoDia: null,
  debitosMesmoDiaRespondidoEm: null,
};

const TERRENO_CENTAVOS = TERRENO.valorCentavos;

function doc(over: Partial<Documento> & { id: string }): Documento {
  return {
    obraId: OBRA.id,
    tipo: "nf_material",
    status: "registrado",
    valorCentavos: 100_000,
    vencimento: null,
    classificacao: "material",
    favorecidoId: "fav-emitente",
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
    desembolsosTerreno: [TERRENO],
    informesFinanciamento: [],
    financiamento: null,
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
    expect(r.acumuladoImovelCentavos).toBe(TERRENO_CENTAVOS + 300_000);
  });

  it("não conta pagamento do ano seguinte no acumulado de 31/12", () => {
    const r = resumo({
      documentos: [doc({ id: "d1" })],
      pagamentos: [
        pag({ id: "p1", documentoIds: ["d1"], dataPagamento: "2027-01-02" }),
      ],
    });
    expect(r.acumuladoImovelCentavos).toBe(TERRENO_CENTAVOS);
  });

  it("pagamento sem documento vinculado não sustenta custo", () => {
    const r = resumo({ pagamentos: [pag({ id: "p1", valorCentavos: 900_000 })] });
    expect(r.custoConfirmadoAnoCentavos).toBe(0);
    expect(r.acumuladoImovelCentavos).toBe(TERRENO_CENTAVOS);
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
    expect(r.acumuladoImovelCentavos).toBe(TERRENO_CENTAVOS);
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
    expect(resumo().acumuladoImovelCentavos).toBe(TERRENO_CENTAVOS);
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
    // O literal do parecer é PREFIXO — o cenário não tem nota ligada, então a
    // pendência nomeia os DOIS buracos (Gate 2, ponto 3 do `contador`).
    expect(pend?.consequencia).toContain(
      "pago sem comprovante — o custo existe, ainda não está demonstrável",
    );
    expect(pend?.consequencia).toContain("E também falta a NF");
    expect(pend?.titulo).toBe("Pagamento sem comprovante e sem nota");
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
    expect(pend?.consequencia).toContain(
      "sem o comprovante da transferência, este recibo não sustenta custo nenhum",
    );
    expect(pend?.consequencia).toContain("E também falta o recibo assinado");
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

  describe("⚠️ reclassificação quando o CNPJ/CPF chega depois (ADENDO 3 §G.3)", () => {
    // "Vermelho por desconhecimento é PROVISÓRIO, e não pode virar vermelho
    // permanente de uma pendência que era amarela." A reclassificação não é um
    // job nem uma migração de dados: `calcularResumo` DERIVA a gravidade do
    // tipo do favorecido a cada leitura, e não guarda cor nenhuma.
    const semComprovante = (favorecidoTipo: "pj" | "pf" | null) =>
      resumo({
        pagamentos: [
          pag({
            id: "p1",
            comprovantePath: null,
            favorecidoTipo,
            favorecidoId: favorecidoTipo === null ? null : "fav-1",
            valorCentavos: 1_000_000,
          }),
        ],
      }).pendencias.find((p) => p.tipo === "pago_sem_comprovante");

    it("antes: tipo desconhecido → VERMELHO, com o texto que não afirma regime", () => {
      const antes = semComprovante(null);
      expect(antes?.gravidade).toBe("red");
      expect(antes?.consequencia).toContain("não dá para dizer");
    });

    it("caminho 1 — informou CNPJ de PJ: vermelho vira AMARELO", () => {
      const depois = semComprovante("pj");
      expect(depois?.gravidade).toBe("amb");
      expect(depois?.consequencia).toContain(
        "pago sem comprovante — o custo existe, ainda não está demonstrável",
      );
      // O valor e o chip não mudam: o fato é o mesmo, muda a consequência.
      expect(depois?.valorCentavos).toBe(1_000_000);
      expect(depois?.chip).toBe("Pago sem comprovante");
    });

    it("caminho 2 — informou CPF de PF: continua vermelho, com o texto do PF", () => {
      const depois = semComprovante("pf");
      expect(depois?.gravidade).toBe("red");
      expect(depois?.consequencia).toContain(
        "sem o comprovante da transferência, este recibo não sustenta custo nenhum",
      );
    });
  });

  it("⚠️ com nota hábil ligada, a pendência nomeia UM buraco só", () => {
    // O outro lado do ponto 3 do `contador`: nomear a nota que já existe seria
    // pedir o que já foi entregue.
    const r = resumo({
      documentos: [doc({ id: "d1", valorCentavos: 1_000_000 })],
      pagamentos: [
        pag({
          id: "p1",
          comprovantePath: null,
          valorCentavos: 1_000_000,
          documentoIds: ["d1"],
        }),
      ],
    });
    const pend = r.pendencias.find((p) => p.tipo === "pago_sem_comprovante");
    expect(pend?.titulo).toBe("Pagamento sem comprovante anexado");
    expect(pend?.consequencia).not.toContain("E também falta");
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
    desembolsosTerreno: [TERRENO],
    informesFinanciamento: [] as FinanciamentoInforme[],
    financiamento: null,
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
      TERRENO_CENTAVOS + 1_000_000,
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
      desembolsosTerreno: [TERRENO],
      informesFinanciamento: [],
      financiamento: null,
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

// ══════════════════════════════════════════════════════════════════════════
// ⚠️ CONTAI-010, critério 21 — o lançamento do financiamento NÃO É PAGAMENTO
//
// "não entra em Pagamentos Efetuados, não entra na base de aferição do INSS, e
// não entra no headline de 'custo em risco' do CONTAI-005 (o favorecido é o
// banco; o documento hábil é contrato + informe, não NF)".
//
// É o teste que o ticket manda o CONTAI-005 ganhar: ele NÃO muda de código, e
// ganha a afirmação de que nada disto aparece em pendência nenhuma.
// ══════════════════════════════════════════════════════════════════════════

describe("terreno e financiamento fora das pendências (critério 21)", () => {
  const INFORME: FinanciamentoInforme = {
    id: "inf-2025",
    financiamentoId: "fin-1",
    anoBase: 2025,
    amortizacaoCentavos: 1_688_352,
    jurosCorrecaoCentavos: 4_305_123,
    segurosCentavos: 49_956,
    taxasFcvsCentavos: 0,
    moraCentavos: 0,
    multaCentavos: 0,
    diferencaTeoricoPagoCentavos: 16_743,
    totalPagoCentavos: 6_060_174,
    saldoDevedorCentavos: 58_581_519,
    arquivoPath: "u/informe/extrato-2025.pdf",
  };

  const SEM_DATA: TerrenoDesembolso = {
    id: "t-sem-data",
    obraId: "obra-1",
    tipo: "itbi",
    valorCentavos: 1_260_000,
    // O desembolso gravado como pago e sem data conhecida (critério 23).
    dataPagamento: null,
    estado: "pago",
    origemRecurso: null,
    anexos: [],
    debitosMesmoDia: null,
    debitosMesmoDiaRespondidoEm: null,
  };

  /**
   * O CONTRATO. Ele é o que faz a home falar sobre o financiamento — não a
   * existência de um informe (ver o bloco do critério 16 mais abaixo).
   */
  const CONTRATO: Financiamento = {
    id: "fin-1",
    obraId: "obra-1",
    instituicao: "Banco Litoral",
    numeroContrato: null,
    dataContrato: "2024-03-20",
    precoContratadoCentavos: 65_000_000,
    numeroParcelas: 240,
  };

  const completo = () =>
    resumo({
      desembolsosTerreno: [TERRENO, SEM_DATA],
      informesFinanciamento: [INFORME],
      financiamento: CONTRATO,
    });

  it("informe e desembolso NÃO viram pendência e NÃO entram no custo em risco", () => {
    const r = completo();
    for (const p of r.pendencias) {
      expect(p.id.startsWith("terreno")).toBe(false);
      expect(p.id.startsWith("informe")).toBe(false);
      expect(p.id.startsWith("financiamento")).toBe(false);
    }
    expect(r.pendencias).toHaveLength(0);
    expect(r.emPendenciaCentavos).toBe(0);
  });

  it("não entram em `custoConfirmadoAnoCentavos`", () => {
    // O custo confirmado do ano é a apuração de NOTA + PAGAMENTO. O terreno tem
    // outra natureza e outro documento hábil; ele compõe o ACUMULADO do imóvel.
    expect(completo().custoConfirmadoAnoCentavos).toBe(0);
  });

  it("não entram em `notasSemPagamento` nem em `despesas`", () => {
    const r = completo();
    expect(r.notasSemPagamento).toHaveLength(0);
    expect(r.notasSemPagamentoCentavos).toBe(0);
    expect(r.despesas).toHaveLength(0);
  });

  it("o valor SEM DATA fica visível, fora de toda soma", () => {
    const r = completo();
    expect(r.terrenoSemData).toHaveLength(1);
    expect(r.terrenoSemData[0].valorCentavos).toBe(1_260_000);
    expect(r.terrenoSemData[0].consequencia).toContain(
      "não tem ano-calendário",
    );
    // Não somou em lugar nenhum: o acumulado de 2026 é terreno datado + informe.
    expect(r.acumuladoImovelCentavos).toBe(TERRENO_CENTAVOS + 5_993_475);
    expect(r.emPendenciaCentavos).toBe(0);
  });

  /**
   * CONTAI-027, critério 12c — a pendência "um lançamento, mais de uma data"
   * na HOME, e a prova de que ela **não vira número**.
   */
  it("'mais de uma data' aparece na home e fica FORA de toda soma", () => {
    const r = resumo({
      desembolsosTerreno: [
        {
          ...TERRENO,
          debitosMesmoDia: false,
          debitosMesmoDiaRespondidoEm: "2026-08-21T10:00:00.000Z",
        },
      ],
    });
    expect(r.terrenoMaisDeUmaData).toHaveLength(1);
    expect(r.terrenoMaisDeUmaData[0].valorCentavos).toBe(TERRENO_CENTAVOS);

    // ⚠️ O dinheiro SAIU e ESTÁ no custo — o que está aberto é o ANO dele. Por
    // isso ela não é "custo em risco" e não entra em `emPendenciaCentavos`: o
    // headline do CONTAI-005 mede o que pode ficar de fora, e este valor está
    // dentro.
    expect(r.acumuladoImovelCentavos).toBe(TERRENO_CENTAVOS);
    expect(r.emPendenciaCentavos).toBe(0);
    expect(r.pendencias).toHaveLength(0);
    expect(r.custoConfirmadoAnoCentavos).toBe(0);
    expect(r.notasSemPagamento).toHaveLength(0);
    expect(r.despesas).toHaveLength(0);
  });

  it("a resposta 'tudo no mesmo dia' NÃO abre pendência nenhuma", () => {
    const r = resumo({
      desembolsosTerreno: [
        {
          ...TERRENO,
          debitosMesmoDia: true,
          debitosMesmoDiaRespondidoEm: "2026-08-21T10:00:00.000Z",
        },
      ],
    });
    expect(r.terrenoMaisDeUmaData).toHaveLength(0);
  });

  it("as duas pendências do terreno nunca aparecem no MESMO desembolso", () => {
    // Sem data a pergunta fica represada, então `debitosMesmoDia` é null por
    // construção (o CHECK do banco impede o contrário) — e o que a home mostra
    // é só "falta a data".
    const r = resumo({ desembolsosTerreno: [SEM_DATA] });
    expect(r.terrenoSemData).toHaveLength(1);
    expect(r.terrenoMaisDeUmaData).toHaveLength(0);
  });

  it("o ano corrente sem informe é NOMEADO, com a estimativa fora da soma", () => {
    const r = completo(); // ano 2026, informe só de 2025
    const aguardando = r.financiamentoAguardandoInforme!;
    expect(aguardando.ano).toBe(2026);
    expect(aguardando.estimativaCentavos).toBe(5_993_475);
    expect(aguardando.aviso).toContain("menor do que a realidade");
    // ⚠️ E ela NÃO entra em número nenhum do resumo.
    expect(r.acumuladoImovelCentavos).toBe(TERRENO_CENTAVOS + 5_993_475);
    expect(r.custoConfirmadoAnoCentavos).toBe(0);
    expect(r.emPendenciaCentavos).toBe(0);
  });

  it("com o informe do ano em tela, não há 'aguardando informe'", () => {
    const r = resumo({
      informesFinanciamento: [{ ...INFORME, anoBase: 2026 }],
      financiamento: CONTRATO,
    });
    expect(r.financiamentoAguardandoInforme).toBeNull();
  });

  it("saldo devedor e preço contratado não entram em soma nenhuma", () => {
    // ⚠️ `EntradaResumo` PASSOU a ter `financiamento` (a home precisa saber que
    // o contrato existe — critério 16), e por isso o PREÇO CONTRATADO agora tem
    // como chegar até aqui. O que este teste tranca é que ele **não é somado**
    // (critério 8): dobrá-lo não move número nenhum. O mesmo para o saldo
    // devedor, que viaja no informe (critério 15).
    const base = { informesFinanciamento: [INFORME], financiamento: CONTRATO };
    const normal = resumo(base);
    const dobrado = resumo({
      ...base,
      informesFinanciamento: [
        { ...INFORME, saldoDevedorCentavos: INFORME.saldoDevedorCentavos * 2 },
      ],
      financiamento: {
        ...CONTRATO,
        precoContratadoCentavos: CONTRATO.precoContratadoCentavos * 2,
      },
    });
    // ⚠️ O RESUMO INTEIRO, e não uma lista de campos — exigência nomeada do
    // `contador` no reveredito do Gate 2. A barreira que existia antes era
    // ESTRUTURAL (o tipo não carregava o preço contratado); ela morreu quando o
    // contrato entrou em `EntradaResumo` para a home poder falar. O que a
    // substituiu não pode ser uma lista manual de três dos onze campos de
    // `ResumoObra`: lista manual é exatamente o que este projeto já viu
    // descolar duas vezes. `toEqual` cobre todo campo que nascer amanhã.
    expect(dobrado).toEqual(normal);
  });

  // ════════════════════════════════════════════════════════════════════════
  // ⚠️ CRITÉRIO 16 — "nunca em silêncio". O BLOQUEADOR do Gate 2.
  //
  // A condição do aviso era `informesFinanciamento.length > 0`: a existência do
  // financiamento era INFERIDA de haver informe. Com contrato assinado e ZERO
  // informes — o estado real da obra hoje — a home imprimia o acumulado sem um
  // caractere sobre o financiamento, subestimando ~R$ 60 mil por ano-base não
  // lançado. A condição passou a ser o CONTRATO.
  // ════════════════════════════════════════════════════════════════════════

  describe("critério 16 · o financiamento nunca fica em silêncio", () => {
    it("contrato SEM informe nenhum: a home fala, e fala do ano corrente", () => {
      const r = resumo({ financiamento: CONTRATO, informesFinanciamento: [] });
      expect(r.financiamentoAguardandoInforme).not.toBeNull();
      expect(r.financiamentoAguardandoInforme!.ano).toBe(2026);
      // Sem informe anterior não há de onde tirar ordem de grandeza — e o app
      // não inventa uma.
      expect(r.financiamentoAguardandoInforme!.estimativaCentavos).toBeNull();
    });

    it("os anos JÁ FECHADOS sem informe aparecem um a um, com a consequência", () => {
      // Contrato de 2024, ano em tela 2026, nenhum informe: 2024 e 2025 estão
      // fechados e não lançados. 2026 é "aguardando", não "falta lançar".
      const r = resumo({ financiamento: CONTRATO, informesFinanciamento: [] });
      expect(r.financiamentoFaltaLancar.map((f) => f.ano)).toEqual([2024, 2025]);
      for (const f of r.financiamentoFaltaLancar) {
        expect(f.aviso).toContain(`custo de aquisição de ${f.ano} não existe`);
        expect(f.aviso).toContain("é download, não pedido");
        expect(f.href).toBe(`/obras/obra-1/terreno/informe/${f.ano}`);
      }
    });

    it("o ano com informe lançado sai da lista de 'falta lançar'", () => {
      const r = resumo({
        financiamento: CONTRATO,
        informesFinanciamento: [INFORME], // 2025
      });
      expect(r.financiamentoFaltaLancar.map((f) => f.ano)).toEqual([2024]);
    });

    it("SEM contrato o app não afirma nada — obra à vista nunca terá informe", () => {
      const r = resumo({ financiamento: null, informesFinanciamento: [] });
      expect(r.financiamentoAguardandoInforme).toBeNull();
      expect(r.financiamentoFaltaLancar).toEqual([]);
    });

    it("nada disso soma: o acumulado é o mesmo com e sem os avisos", () => {
      const comContrato = resumo({
        financiamento: CONTRATO,
        informesFinanciamento: [],
      });
      const semContrato = resumo({
        financiamento: null,
        informesFinanciamento: [],
      });
      expect(comContrato.acumuladoImovelCentavos).toBe(
        semContrato.acumuladoImovelCentavos,
      );
      expect(comContrato.emPendenciaCentavos).toBe(0);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // ⚠️ O R$ 0,00 DO TERRENO — o segundo bloqueador do Gate 2.
  //
  // O backfill das três colunas mortas foi descartado, e o painel passou a
  // imprimir R$ 0,00 sob o rótulo "situação em 31/12 na ficha Bens e Direitos"
  // numa obra cujo terreno foi pago de verdade — e cujo ano-base 2025 já foi
  // declarado pelo CRC COM o terreno dentro. Fato falso com moldura de fato
  // apurado, na direção irreversível (custo subestimado = ganho inflado).
  // ════════════════════════════════════════════════════════════════════════

  describe("o zero do terreno é ausência de registro, não de pagamento", () => {
    it("sem desembolso e sem informe, o aviso existe e o número é zero", () => {
      const r = resumo({ desembolsosTerreno: [], informesFinanciamento: [] });
      expect(r.terrenoSemRegistro).not.toBeNull();
      expect(r.terrenoSemRegistro!.terrenoNoAcumuladoCentavos).toBe(0);
      expect(r.terrenoSemRegistro!.aviso).toContain(
        "nada foi registrado ainda",
      );
      expect(r.terrenoSemRegistro!.aviso).toContain("não que nada foi pago");
      expect(r.terrenoSemRegistro!.aviso).toContain("não serve para a declaração");
    });

    it("linha PAGA SEM DATA também deixa o zero mentindo — e o aviso fica", () => {
      // O acumulado continua zero: sem data não há ano-calendário. O aviso é
      // sobre o número em tela, não sobre a existência de linhas.
      const r = resumo({ desembolsosTerreno: [SEM_DATA], informesFinanciamento: [] });
      expect(r.acumuladoImovelCentavos).toBe(0);
      expect(r.terrenoSemRegistro).not.toBeNull();
    });

    it("`previsto` não tira o aviso: previsto não é pago", () => {
      const r = resumo({
        desembolsosTerreno: [
          { ...SEM_DATA, id: "t-prev", estado: "previsto", anexos: [] },
        ],
        informesFinanciamento: [],
      });
      expect(r.terrenoSemRegistro).not.toBeNull();
    });

    it("um desembolso DATADO cala o aviso — aí o número é apuração", () => {
      const r = resumo({ desembolsosTerreno: [TERRENO] });
      expect(r.terrenoSemRegistro).toBeNull();
    });

    it("só o informe também basta para o número virar apuração", () => {
      const r = resumo({
        desembolsosTerreno: [],
        informesFinanciamento: [INFORME],
        financiamento: CONTRATO,
      });
      expect(r.terrenoSemRegistro).toBeNull();
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // ⚠️ A ESTIMATIVA — blindagem por AUSÊNCIA DE CAMINHO
  //
  // Mesmo padrão do compromisso: o que este teste prova não é que o número deu
  // zero, é que NÃO EXISTE CAMINHO para a estimativa chegar a uma saída. Ela é
  // ordem de grandeza tirada do informe do ano anterior; o dia em que entrar num
  // texto de discriminação, vira número inventado numa declaração.
  // ════════════════════════════════════════════════════════════════════════

  describe("a estimativa não tem caminho para saída nenhuma", () => {
    it("nenhum módulo de `lib/` além de quem a produz a nomeia", () => {
      // `terreno.ts` a calcula, `resumo.ts` a repassa para a tela. Qualquer
      // outro módulo — inclusive os de saída da US-004, quando nascerem —
      // deixa este teste vermelho COM O NOME DO ARQUIVO, antes de qualquer
      // número errado ir para uma declaração.
      //
      // ⚠️ O guarda varre `lib/` INTEIRO, recursivamente, e não só
      // `lib/fiscal/` — ressalva do `contador` no reveredito do Gate 2: a
      // versão anterior assumia que o gerador da discriminação nasceria em
      // `lib/fiscal/`. Se ele nascer em `lib/relatorio/` ou `lib/saidas/`, o
      // teste continuaria verde protegendo nada. Ancorar no diretório errado
      // custa zero hoje; descobrir isso com uma estimativa dentro de um texto
      // de declaração custa o ticket inteiro.
      const produtores = new Set(["lib/fiscal/terreno.ts", "lib/fiscal/resumo.ts"]);
      const varrer = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory()
            ? varrer(`${dir}/${e.name}`)
            : e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")
              ? [`${dir}/${e.name}`]
              : [],
        );
      const proibidos = varrer("lib").filter((f) => !produtores.has(f));
      expect(proibidos.length).toBeGreaterThan(3); // o teste vale alguma coisa
      for (const arquivo of proibidos) {
        const fonte = readFileSync(arquivo, "utf-8");
        expect(
          /estimativa/i.test(fonte),
          `${arquivo} passou a conhecer a estimativa — ela é ordem de grandeza, não apuração`,
        ).toBe(false);
      }
    });

    it("a estimativa não é somada ao acumulado — o informe entra UMA vez", () => {
      const r = completo(); // informe de 2025, ano em tela 2026
      const custoDoInforme =
        INFORME.amortizacaoCentavos + INFORME.jurosCorrecaoCentavos;
      // A estimativa vale exatamente o custo do informe anterior. Se ela
      // vazasse para o acumulado, este número viria dobrado.
      expect(r.financiamentoAguardandoInforme!.estimativaCentavos).toBe(
        custoDoInforme,
      );
      expect(r.acumuladoImovelCentavos).toBe(TERRENO_CENTAVOS + custoDoInforme);
    });

    it("ela vem sempre acompanhada da frase que a desqualifica como apuração", () => {
      const r = completo();
      expect(r.financiamentoAguardandoInforme!.sobreAEstimativa).toContain(
        "não um número apurado",
      );
    });
  });
});
