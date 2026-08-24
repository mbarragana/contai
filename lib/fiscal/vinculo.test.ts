import { describe, expect, it } from "vitest";

import {
  alocarCusto,
  alocarSimulando,
  custoComprovadoAteOAno,
  custoComprovadoDoAno,
  documentosCandidatos,
  documentosHabeisSemPagamento,
  documentosOcultosPorCobertura,
  despesasComprovadas,
  MOTIVO_OBRA_DIFERENTE,
  pagamentosCandidatos,
  pagamentosOcultosPorCobertura,
  podeVincular,
  baseDocumentavel,
  saldoDescobertoDaNota,
  valorBloqueadoPorComprovante,
  valorElegivelDoPagamento,
} from "@/lib/fiscal/vinculo";
import type { Documento, Pagamento } from "@/lib/types";

const OBRA = "obra-1";

function doc(over: Partial<Documento> & { id: string }): Documento {
  return {
    obraId: OBRA,
    tipo: "nf_servico",
    status: "registrado",
    valorCentavos: 300_000,
    numero: "1042",
    serie: null,
    dataEmissao: "2026-03-20",
    vencimento: null,
    classificacao: "mao_obra",
    destinatarioCpfOk: true,
    retencao11: true,
    motivoQuarentena: null,
    favorecidoId: "fav-emitente",
    favorecidoNome: "WK Construções LTDA",
    favorecidoDocumento: "11222333000181",
    arquivoPath: "u/documento/nf.pdf",
    ...over,
  };
}

function pag(over: Partial<Pagamento> & { id: string }): Pagamento {
  return {
    obraId: OBRA,
    valorCentavos: 300_000,
    dataPagamento: "2026-08-12",
    meio: "pix",
    // Nasce SEMPRE como `aguardando_nf` — é o estado real do parque de
    // registros do Mateus. Se algum teste passasse só com `conciliado`, a
    // trava do parecer §2 teria voltado por outra porta.
    status: "aguardando_nf",
    favorecidoId: "fav-wk",
    favorecidoNome: "WK Construções LTDA",
    favorecidoTipo: "pj",
    comprovantePath: "u/comprovante/pix.png",
    documentoIds: [],
    // CONTAI-019: a esmagadora maioria dos pagamentos NÃO tem linha em
    // `pagamento_diferenca` — sem encargo, sem diferença, sem resolução. É o
    // caso normal, e é por isso que ele é o default do fixture.
    encargosCentavos: 0,
    naoExplicadoCentavos: 0,
    resolucaoDiferenca: null,
    ...over,
  };
}

function alocar(documentos: Documento[], pagamentos: Pagamento[]) {
  return alocarCusto({ documentos, pagamentos });
}

describe("custo comprovado = min(Σ pagamentos, Σ documentos hábeis)", () => {
  it("1↔1 de valor igual: o caso real da NF de R$ 3.000 da WK", () => {
    const a = alocar(
      [doc({ id: "d1" })],
      [pag({ id: "p1", documentoIds: ["d1"] })],
    );
    expect(a.componentes).toHaveLength(1);
    expect(a.componentes[0].custoComprovadoCentavos).toBe(300_000);
    expect(a.porPagamento.get("p1")).toMatchObject({
      comprovadoCentavos: 300_000,
      semNotaCentavos: 0,
    });
    expect(a.porDocumento.get("d1")).toMatchObject({
      cobertoCentavos: 300_000,
      excedenteNotaCentavos: 0,
    });
  });

  it("pagamento > nota: o excedente vira 'pago sem nota', não custo", () => {
    const a = alocar(
      [doc({ id: "d1", valorCentavos: 300_000 })],
      [pag({ id: "p1", valorCentavos: 350_000, documentoIds: ["d1"] })],
    );
    expect(a.componentes[0].custoComprovadoCentavos).toBe(300_000);
    expect(a.porPagamento.get("p1")).toMatchObject({
      comprovadoCentavos: 300_000,
      semNotaCentavos: 50_000,
    });
  });

  it("nota > pagamento: o excedente da nota NÃO vira custo (regime de caixa)", () => {
    const a = alocar(
      [doc({ id: "d1", valorCentavos: 300_000 })],
      [pag({ id: "p1", valorCentavos: 50_000, documentoIds: ["d1"] })],
    );
    expect(a.componentes[0].custoComprovadoCentavos).toBe(50_000);
    expect(a.porDocumento.get("d1")).toMatchObject({
      cobertoCentavos: 50_000,
      excedenteNotaCentavos: 250_000,
    });
    expect(a.porPagamento.get("p1")?.semNotaCentavos).toBe(0);
  });

  it("⚠️ N pagamentos ↔ 1 nota: mínimo por COMPONENTE CONEXO, nunca par a par", () => {
    // Cinco PIX de R$ 600 na mesma NF de R$ 3.000. Par a par daria R$ 15.000 —
    // a mesma nota contada cinco vezes, custo inflado indo para a declaração
    // (parecer §4: a única direção de erro que gera passivo tributário).
    const pagamentos = [1, 2, 3, 4, 5].map((n) =>
      pag({
        id: `p${n}`,
        valorCentavos: 60_000,
        dataPagamento: `2026-08-0${n}`,
        documentoIds: ["d1"],
      }),
    );
    const a = alocar([doc({ id: "d1", valorCentavos: 300_000 })], pagamentos);

    expect(a.componentes).toHaveLength(1);
    expect(a.componentes[0].custoComprovadoCentavos).toBe(300_000);
    expect(custoComprovadoDoAno(a, 2026)).toBe(300_000);
    // Cada um dos cinco está integralmente coberto — e a soma não passa da nota.
    for (const p of pagamentos) {
      expect(a.porPagamento.get(p.id)?.comprovadoCentavos).toBe(60_000);
    }
  });

  it("N pagamentos ↔ 1 nota, somando MAIS que a nota: o excedente é do último", () => {
    const a = alocar(
      [doc({ id: "d1", valorCentavos: 300_000 })],
      [
        pag({ id: "p1", valorCentavos: 300_000, dataPagamento: "2026-08-12", documentoIds: ["d1"] }),
        pag({ id: "p2", valorCentavos: 50_000, dataPagamento: "2026-08-14", documentoIds: ["d1"] }),
      ],
    );
    expect(a.componentes[0].custoComprovadoCentavos).toBe(300_000);
    expect(a.porPagamento.get("p1")?.comprovadoCentavos).toBe(300_000);
    expect(a.porPagamento.get("p2")).toMatchObject({
      comprovadoCentavos: 0,
      semNotaCentavos: 50_000,
    });
  });

  it("1 pagamento ↔ N notas: o pagamento cobre as duas até o seu valor", () => {
    const a = alocar(
      [
        doc({ id: "d1", valorCentavos: 200_000 }),
        doc({ id: "d2", valorCentavos: 200_000 }),
      ],
      [pag({ id: "p1", valorCentavos: 300_000, documentoIds: ["d1", "d2"] })],
    );
    expect(a.componentes).toHaveLength(1);
    expect(a.componentes[0].somaDocumentosHabeisCentavos).toBe(400_000);
    expect(a.componentes[0].custoComprovadoCentavos).toBe(300_000);
    expect(a.porPagamento.get("p1")?.semNotaCentavos).toBe(0);
    // R$ 100.000 de nota continuam sem desembolso — não viram custo.
    const restante =
      (a.porDocumento.get("d1")?.excedenteNotaCentavos ?? 0) +
      (a.porDocumento.get("d2")?.excedenteNotaCentavos ?? 0);
    expect(restante).toBe(100_000);
  });

  it("dois pagamentos ligados à mesma nota formam UM componente, não dois", () => {
    const a = alocar(
      [doc({ id: "d1", valorCentavos: 300_000 })],
      [
        pag({ id: "p1", valorCentavos: 200_000, documentoIds: ["d1"] }),
        pag({ id: "p2", valorCentavos: 200_000, documentoIds: ["d1"] }),
      ],
    );
    expect(a.componentes.filter((c) => c.pagamentos.length > 0)).toHaveLength(1);
    expect(a.componentes[0].custoComprovadoCentavos).toBe(300_000);
  });

  it("dois pagamentos ligados a notas diferentes ficam em componentes separados", () => {
    const a = alocar(
      [doc({ id: "d1" }), doc({ id: "d2" })],
      [
        pag({ id: "p1", documentoIds: ["d1"] }),
        pag({ id: "p2", documentoIds: ["d2"] }),
      ],
    );
    expect(a.componentes).toHaveLength(2);
    expect(custoComprovadoDoAno(a, 2026)).toBe(600_000);
  });
});

describe("regime de caixa entre anos-calendário", () => {
  it("componente que cruza dois anos: cada pagamento cai no ano da sua data", () => {
    // Nota de R$ 3.000 paga em duas vezes, dezembro e janeiro. O custo total
    // comprovado é 3.000, mas ele NÃO cai todo em um ano.
    const a = alocar(
      [doc({ id: "d1", valorCentavos: 300_000 })],
      [
        pag({ id: "p1", valorCentavos: 100_000, dataPagamento: "2025-12-20", documentoIds: ["d1"] }),
        pag({ id: "p2", valorCentavos: 200_000, dataPagamento: "2026-01-15", documentoIds: ["d1"] }),
      ],
    );
    expect(a.componentes[0].custoComprovadoCentavos).toBe(300_000);
    expect(custoComprovadoDoAno(a, 2025)).toBe(100_000);
    expect(custoComprovadoDoAno(a, 2026)).toBe(200_000);
  });

  it("nota menor que a soma paga em dois anos: o mais antigo é coberto primeiro", () => {
    // REGRA FISCAL RATIFICADA, não decisão de implementação: repartição
    // CRONOLÓGICA, ratificada pelo `contador` no Gate 2 do CONTAI-018 e
    // transcrita no adendo de 2026-08-18 do parecer
    // `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md`.
    //
    // Não troque por pro-rata "porque é mais justo": pro-rata daria R$ 1.500 a
    // 2026 num caso em que o app já dissera R$ 2.000, contradizendo uma DAA
    // entregue. Sob a cronológica, acrescentar um pagamento POSTERIOR nunca
    // altera a alocação de um pagamento ANTERIOR — é o que este teste guarda.
    const a = alocar(
      [doc({ id: "d1", valorCentavos: 100_000 })],
      [
        pag({ id: "p1", valorCentavos: 100_000, dataPagamento: "2025-12-20", documentoIds: ["d1"] }),
        pag({ id: "p2", valorCentavos: 100_000, dataPagamento: "2026-01-15", documentoIds: ["d1"] }),
      ],
    );
    expect(custoComprovadoDoAno(a, 2025)).toBe(100_000);
    expect(custoComprovadoDoAno(a, 2026)).toBe(0);
    expect(a.porPagamento.get("p2")?.semNotaCentavos).toBe(100_000);
  });
});

describe("`status` não é pré-requisito de custo (critérios 4 e 7)", () => {
  it("pagamento 'aguardando_nf' vinculado a documento hábil SUSTENTA custo", () => {
    const a = alocar(
      [doc({ id: "d1" })],
      [pag({ id: "p1", status: "aguardando_nf", documentoIds: ["d1"] })],
    );
    expect(a.porPagamento.get("p1")?.comprovadoCentavos).toBe(300_000);
  });

  it("pagamento 'conciliado' SEM vínculo NÃO sustenta custo", () => {
    const a = alocar([doc({ id: "d1" })], [pag({ id: "p1", status: "conciliado" })]);
    expect(a.porPagamento.get("p1")).toMatchObject({
      comprovadoCentavos: 0,
      semNotaCentavos: 300_000,
    });
    expect(custoComprovadoDoAno(a, 2026)).toBe(0);
  });
});

describe("documento não hábil: conecta, mas não comprova", () => {
  it("documento em quarentena vinculado dá custo confirmado ZERO (critério 8)", () => {
    const a = alocar(
      [doc({ id: "d1", status: "quarentena", destinatarioCpfOk: false })],
      [pag({ id: "p1", documentoIds: ["d1"] })],
    );
    expect(a.componentes[0].somaDocumentosHabeisCentavos).toBe(0);
    expect(a.componentes[0].custoComprovadoCentavos).toBe(0);
    // E o pagamento continua exposto: a despesa não some da tela.
    expect(a.porPagamento.get("p1")?.semNotaCentavos).toBe(300_000);
  });

  it("boleto vinculado dá custo confirmado ZERO (critério 9)", () => {
    const a = alocar(
      [doc({ id: "d1", tipo: "boleto", status: "aguardando_pagamento" })],
      [pag({ id: "p1", documentoIds: ["d1"] })],
    );
    expect(a.componentes[0].custoComprovadoCentavos).toBe(0);
    expect(a.porDocumento.get("d1")?.habil).toBe(false);
  });

  it("boleto + NF no mesmo componente: quem comprova é a NF", () => {
    const a = alocar(
      [
        doc({ id: "d1", tipo: "boleto", status: "aguardando_pagamento", valorCentavos: 300_000 }),
        doc({ id: "d2", tipo: "nf_material", valorCentavos: 300_000 }),
      ],
      [pag({ id: "p1", documentoIds: ["d1", "d2"] })],
    );
    expect(a.componentes[0].somaDocumentosHabeisCentavos).toBe(300_000);
    expect(a.componentes[0].custoComprovadoCentavos).toBe(300_000);
  });

  it("boleto liga dois pagamentos: o componente é um só, e continua sem custo", () => {
    // É a conectividade que permite a dedup dos critérios 8 e 9: o não hábil
    // participa do grafo, mesmo contribuindo 0.
    const a = alocar(
      [doc({ id: "d1", tipo: "boleto", status: "aguardando_pagamento" })],
      [
        pag({ id: "p1", documentoIds: ["d1"] }),
        pag({ id: "p2", documentoIds: ["d1"] }),
      ],
    );
    expect(a.componentes).toHaveLength(1);
    expect(a.componentes[0].pagamentos).toHaveLength(2);
    expect(a.componentes[0].custoComprovadoCentavos).toBe(0);
  });
});

describe("o terceiro estado — nota hábil sem pagamento (parecer §5.2)", () => {
  it("nota sem nenhum pagamento ligado entra no terceiro número", () => {
    const a = alocar([doc({ id: "d1", valorCentavos: 300_000 })], []);
    const semPagamento = documentosHabeisSemPagamento(a);
    expect(semPagamento.map((d) => d.documento.id)).toEqual(["d1"]);
    expect(custoComprovadoDoAno(a, 2026)).toBe(0);
  });

  it("nota em quarentena NÃO entra no terceiro número — ela não vale como custo", () => {
    const a = alocar(
      [doc({ id: "d1", status: "quarentena", destinatarioCpfOk: false })],
      [],
    );
    expect(documentosHabeisSemPagamento(a)).toEqual([]);
  });

  it("depois do vínculo a nota sai do terceiro número e vira despesa comprovada", () => {
    const a = alocar(
      [doc({ id: "d1" })],
      [pag({ id: "p1", documentoIds: ["d1"] })],
    );
    expect(documentosHabeisSemPagamento(a)).toEqual([]);
    // Critério 13: UMA despesa, não a nota e o PIX lado a lado.
    expect(despesasComprovadas(a)).toHaveLength(1);
    expect(despesasComprovadas(a)[0].custoComprovadoCentavos).toBe(300_000);
  });
});

describe("vínculo só entre registros da mesma obra (critério 11)", () => {
  it("recusa com o motivo na tela", () => {
    const permissao = podeVincular(
      pag({ id: "p1", obraId: "obra-2" }),
      doc({ id: "d1", obraId: "obra-1" }),
    );
    expect(permissao.ok).toBe(false);
    expect(permissao.ok === false && permissao.motivo).toBe(MOTIVO_OBRA_DIFERENTE);
  });

  it("permite dentro da mesma obra", () => {
    expect(podeVincular(pag({ id: "p1" }), doc({ id: "d1" })).ok).toBe(true);
  });

  it("pagamento de outra obra não aparece entre os candidatos", () => {
    const documento = doc({ id: "d1" });
    const daObra = pag({ id: "p1" });
    const deOutra = pag({ id: "p2", obraId: "obra-2" });
    const a = alocar([documento], [daObra, deOutra]);
    const candidatos = pagamentosCandidatos(documento, [daObra, deOutra], a);
    expect(candidatos.map((c) => c.item.id)).toEqual(["p1"]);
  });

  it("vínculo entre obras que já existisse no banco é ignorado pelo cálculo", () => {
    // A entrada do cálculo é SEMPRE de uma obra só. Um `documentoIds` que
    // aponta para fora dela não pode virar custo por acidente.
    const a = alocar(
      [doc({ id: "d1" })],
      [pag({ id: "p1", documentoIds: ["d-de-outra-obra"] })],
    );
    expect(custoComprovadoDoAno(a, 2026)).toBe(0);
    expect(a.porPagamento.get("p1")?.semNotaCentavos).toBe(300_000);
  });
});

describe("sugestão ordena e rotula; nunca vincula (critério 10)", () => {
  const documento = doc({ id: "d1", valorCentavos: 300_000 });
  const mesmoTudo = pag({
    id: "p-wk-igual",
    valorCentavos: 300_000,
    favorecidoNome: "WK Construções LTDA",
  });
  const mesmoFavorecido = pag({
    id: "p-wk-outro",
    valorCentavos: 50_000,
    favorecidoNome: "WK Construções LTDA",
  });
  const outro = pag({
    id: "p-deposito",
    valorCentavos: 62_000,
    favorecidoNome: "Depósito Cachoeira ME",
  });

  it("ordena favorecido igual > valor igual > diferença de valor", () => {
    const lista = [outro, mesmoFavorecido, mesmoTudo];
    const a = alocar([documento], lista);
    const candidatos = pagamentosCandidatos(documento, lista, a);
    expect(candidatos.map((c) => c.item.id)).toEqual([
      "p-wk-igual",
      "p-wk-outro",
      "p-deposito",
    ]);
  });

  it("rotula a sugestão e deixa o resto sem rótulo — nada vem marcado", () => {
    const lista = [outro, mesmoFavorecido, mesmoTudo];
    const a = alocar([documento], lista);
    const candidatos = pagamentosCandidatos(documento, lista, a);
    expect(candidatos[0].sugestao).toBe("Sugestão — mesmo favorecido e mesmo valor");
    expect(candidatos[1].sugestao).toBe("Sugestão — mesmo favorecido, valor diferente");
    expect(candidatos[2].sugestao).toBeNull();
    // A estrutura do candidato não tem como dizer "marcado": vínculo só nasce
    // de toque explícito, e o módulo puro não cria nenhum.
    expect(Object.keys(candidatos[0])).toEqual(["item", "sugestao"]);
  });

  it("pagamento já coberto por inteiro deixa de ser candidato", () => {
    const outraNota = doc({ id: "d2", valorCentavos: 300_000 });
    const jaLigado = pag({ id: "p1", documentoIds: ["d2"] });
    const a = alocar([documento, outraNota], [jaLigado]);
    expect(pagamentosCandidatos(documento, [jaLigado], a)).toEqual([]);
  });

  it("pagamento ligado só a boleto continua candidato (crit. 9: a NF chega depois)", () => {
    const boleto = doc({ id: "d2", tipo: "boleto", status: "aguardando_pagamento" });
    const pagoNoBoleto = pag({ id: "p1", documentoIds: ["d2"] });
    const a = alocar([documento, boleto], [pagoNoBoleto]);
    expect(
      pagamentosCandidatos(documento, [pagoNoBoleto], a).map((c) => c.item.id),
    ).toEqual(["p1"]);
  });

  it("caminho inverso: documentos candidatos de um pagamento, quarentena incluída", () => {
    const nf = doc({ id: "d1" });
    const quarentena = doc({
      id: "d2",
      status: "quarentena",
      destinatarioCpfOk: false,
      favorecidoNome: "Marcenaria Bom Jesus",
    });
    const pagamento = pag({ id: "p1" });
    const a = alocar([nf, quarentena], [pagamento]);
    const candidatos = documentosCandidatos(pagamento, [nf, quarentena], a);
    expect(candidatos.map((c) => c.item.id)).toEqual(["d1", "d2"]);
    expect(candidatos[0].sugestao).toBe("Sugestão — mesmo favorecido e mesmo valor");
  });
});

/**
 * O efeito no custo ANTES do toque, pela MESMA `alocarCusto` da home.
 *
 * Estes testes substituem os das duas funções de previsão isolada removidas no
 * Gate 2 do CONTAI-018. Elas simulavam o conjunto marcado FORA do grafo, com
 * os valores integrais, e por isso anunciavam custo MAIOR que o real — os dois
 * primeiros casos abaixo são exatamente os números que o `contador` apontou.
 */
describe("simulação do vínculo sobre o painel real (critério 15)", () => {
  it("pagamento já parcialmente coberto: o acréscimo é o real, não o valor cheio", () => {
    // PIX de R$ 3.000 já ligado a uma NF de R$ 1.000. Marcá-lo numa NF de
    // R$ 3.000 acrescenta R$ 2.000 — a previsão isolada dizia R$ 3.000.
    const painel = {
      documentos: [
        doc({ id: "d1", valorCentavos: 100_000 }),
        doc({ id: "d2", valorCentavos: 300_000 }),
      ],
      pagamentos: [
        pag({ id: "p1", valorCentavos: 300_000, documentoIds: ["d1"] }),
      ],
    };
    const antes = alocarCusto(painel);
    const depois = alocarSimulando(painel, {
      adicionar: [{ pagamentoId: "p1", documentoId: "d2" }],
    });
    expect(custoComprovadoDoAno(antes, 2026)).toBe(100_000);
    expect(custoComprovadoDoAno(depois, 2026)).toBe(300_000);
    expect(
      depois.porPagamento.get("p1")!.comprovadoCentavos -
        antes.porPagamento.get("p1")!.comprovadoCentavos,
    ).toBe(200_000);
  });

  it("nota já parcialmente coberta: o pagamento marcado comprova só o saldo", () => {
    // NF de R$ 3.000 já coberta em R$ 2.000. Marcar um PIX de R$ 3.000 nela
    // comprova R$ 1.000 dele — a previsão isolada dizia R$ 3.000, o TRIPLO.
    const painel = {
      documentos: [doc({ id: "d1", valorCentavos: 300_000 })],
      pagamentos: [
        pag({
          id: "p1",
          valorCentavos: 200_000,
          dataPagamento: "2026-07-01",
          documentoIds: ["d1"],
        }),
        pag({ id: "p2", valorCentavos: 300_000, dataPagamento: "2026-08-12" }),
      ],
    };
    const depois = alocarSimulando(painel, {
      adicionar: [{ pagamentoId: "p2", documentoId: "d1" }],
    });
    expect(depois.porPagamento.get("p2")).toMatchObject({
      comprovadoCentavos: 100_000,
      semNotaCentavos: 200_000,
    });
    // E a nota NÃO fica "coberta por inteiro" por engano: o saldo dela é zero
    // porque o conjunto já a cobre, e o excedente está do lado do pagamento.
    expect(depois.porDocumento.get("d1")!.excedenteNotaCentavos).toBe(0);
  });

  it("nota em quarentena: simular o vínculo não move o custo confirmado", () => {
    const painel = {
      documentos: [
        doc({ id: "d1", status: "quarentena", destinatarioCpfOk: false }),
      ],
      pagamentos: [pag({ id: "p1" })],
    };
    const depois = alocarSimulando(painel, {
      adicionar: [{ pagamentoId: "p1", documentoId: "d1" }],
    });
    expect(custoComprovadoDoAno(depois, 2026)).toBe(0);
    expect(depois.porPagamento.get("p1")!.semNotaCentavos).toBe(300_000);
  });

  it("nada marcado: a simulação devolve exatamente a alocação de hoje", () => {
    const painel = {
      documentos: [doc({ id: "d1" })],
      pagamentos: [pag({ id: "p1", documentoIds: ["d1"] })],
    };
    expect(custoComprovadoDoAno(alocarSimulando(painel, {}), 2026)).toBe(
      custoComprovadoDoAno(alocarCusto(painel), 2026),
    );
  });

  it("remover: é o mesmo caminho da tela de desligar, e o acumulado acompanha", () => {
    // Pagamento de ANO ANTERIOR: o ano corrente não se mexe, o acumulado sim.
    const painel = {
      documentos: [doc({ id: "d1" })],
      pagamentos: [
        pag({ id: "p1", dataPagamento: "2025-11-10", documentoIds: ["d1"] }),
      ],
    };
    const antes = alocarCusto(painel);
    const depois = alocarSimulando(painel, {
      remover: [{ pagamentoId: "p1", documentoId: "d1" }],
    });
    expect(custoComprovadoDoAno(antes, 2026)).toBe(0);
    expect(custoComprovadoDoAno(depois, 2026)).toBe(0);
    expect(custoComprovadoAteOAno(antes, 2026)).toBe(300_000);
    expect(custoComprovadoAteOAno(depois, 2026)).toBe(0);
  });

  it("a simulação não altera a entrada — o painel carregado continua intacto", () => {
    const pagamento = pag({ id: "p1" });
    const painel = { documentos: [doc({ id: "d1" })], pagamentos: [pagamento] };
    alocarSimulando(painel, {
      adicionar: [{ pagamentoId: "p1", documentoId: "d1" }],
    });
    expect(pagamento.documentoIds).toEqual([]);
  });
});

/** Todos os subconjuntos, na ordem estável dos itens. */
function subconjuntos<T>(itens: readonly T[]): T[][] {
  return itens.reduce<T[][]>(
    (acc, x) => [...acc, ...acc.map((s) => [...s, x])],
    [[]],
  );
}

/**
 * O que os dois rodapés "Custo confirmado se ligar agora" prometem — a CLASSE,
 * não mais um exemplo (exigência do `contador` no 2º Gate 2 do CONTAI-018).
 *
 * O rótulo nomeia o **custo de aquisição do imóvel**, que é UM ÚNICO TOTAL
 * ACUMULADO. A grandeza é sempre
 * `custoComprovadoAteOAno(depois) − custoComprovadoAteOAno(antes)`, e nada
 * mais: é a única imune à realocação INTERNA do conjunto. A fatia de um
 * pagamento não serve — sob a repartição cronológica (adendo de 2026-08-18 do
 * parecer), um pagamento mais antigo que entra no conjunto TOMA a alocação de
 * um posterior já coberto, e a fatia dele sobe muito mais que o custo da obra.
 */
describe("o número do rodapé é a variação do TOTAL, não a fatia de um pagamento", () => {
  it("marcar o pagamento MAIS ANTIGO numa nota já coberta: obra +1.000, fatia dele +3.000", () => {
    // NF de 3.000 já coberta por um PIX de 2.000 de 12/08; entra um PIX de
    // 3.000 de 01/07. Foi o caso que o rodapé anunciava como 3.000.
    const painel = {
      documentos: [doc({ id: "d1", valorCentavos: 300_000 })],
      pagamentos: [
        pag({
          id: "p-novo",
          valorCentavos: 200_000,
          dataPagamento: "2026-08-12",
          documentoIds: ["d1"],
        }),
        pag({
          id: "p-antigo",
          valorCentavos: 300_000,
          dataPagamento: "2026-07-01",
        }),
      ],
    };
    const antes = alocarCusto(painel);
    const depois = alocarSimulando(painel, {
      adicionar: [{ pagamentoId: "p-antigo", documentoId: "d1" }],
    });

    // O custo da obra: 2.000 → 3.000. É o número do rodapé, e é 1.000.
    expect(custoComprovadoAteOAno(antes, 2026)).toBe(200_000);
    expect(custoComprovadoAteOAno(depois, 2026)).toBe(300_000);
    expect(
      custoComprovadoAteOAno(depois, 2026) - custoComprovadoAteOAno(antes, 2026),
    ).toBe(100_000);

    // A fatia do mais antigo sobe 3.000 porque ele TOMA a alocação do outro —
    // que devolve 2.000 para "pago sem nota". Três grandezas diferentes.
    expect(depois.porPagamento.get("p-antigo")!.comprovadoCentavos).toBe(300_000);
    expect(antes.porPagamento.get("p-antigo")!.comprovadoCentavos).toBe(0);
    expect(depois.porPagamento.get("p-novo")).toMatchObject({
      comprovadoCentavos: 0,
      semNotaCentavos: 200_000,
    });
  });

  it("Σ variação por pagamento = variação do total — qualquer conjunto, qualquer marcação", () => {
    const ANO_TETO = 2026; // ≥ todas as datas: o acumulado pega o conjunto todo.
    const datas = ["2025-11-10", "2026-07-01", "2026-08-12"];
    const permutacoes = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ];
    const valoresPagamento = [300_000, 200_000, 100_000];
    // d1 hábil (comprova) e d2 em quarentena (conecta e não comprova).
    const pares = [
      { pagamentoId: "p1", documentoId: "d1" },
      { pagamentoId: "p2", documentoId: "d1" },
      { pagamentoId: "p3", documentoId: "d1" },
      { pagamentoId: "p3", documentoId: "d2" },
    ];
    const combinacoes = subconjuntos(pares);

    let casos = 0;
    let divergiu = 0;
    for (const valorNota of [100_000, 300_000, 500_000]) {
      for (const ordem of permutacoes) {
        for (const jaLigados of combinacoes) {
          for (const marcados of combinacoes) {
            const painel = {
              documentos: [
                doc({ id: "d1", valorCentavos: valorNota }),
                doc({
                  id: "d2",
                  valorCentavos: 200_000,
                  status: "quarentena" as const,
                  destinatarioCpfOk: false,
                }),
              ],
              pagamentos: valoresPagamento.map((valor, i) =>
                pag({
                  id: `p${i + 1}`,
                  valorCentavos: valor,
                  dataPagamento: datas[ordem[i]],
                  documentoIds: jaLigados
                    .filter((x) => x.pagamentoId === `p${i + 1}`)
                    .map((x) => x.documentoId),
                }),
              ),
            };
            const antes = alocarCusto(painel);
            const depois = alocarSimulando(painel, { adicionar: marcados });

            const somaVariacoes = painel.pagamentos.reduce(
              (t, p) =>
                t +
                depois.porPagamento.get(p.id)!.comprovadoCentavos -
                antes.porPagamento.get(p.id)!.comprovadoCentavos,
              0,
            );
            // A expressão do rodapé das duas telas, literalmente.
            const variacaoDoTotal =
              custoComprovadoAteOAno(depois, ANO_TETO) -
              custoComprovadoAteOAno(antes, ANO_TETO);

            const caso = JSON.stringify({ valorNota, ordem, jaLigados, marcados });
            expect(somaVariacoes, caso).toBe(variacaoDoTotal);
            // E o total nunca cai por ACRESCENTAR vínculo: o rodapé de um
            // seletor de ligar não pode prometer custo negativo.
            expect(variacaoDoTotal, caso).toBeGreaterThanOrEqual(0);

            casos += 1;
            // A fatia de UM pagamento marcado divergir do total é o defeito
            // que este invariante fecha — e ele acontece de verdade.
            if (
              marcados.some(
                (m) =>
                  depois.porPagamento.get(m.pagamentoId)!.comprovadoCentavos -
                    antes.porPagamento.get(m.pagamentoId)!.comprovadoCentavos !==
                  variacaoDoTotal,
              )
            ) {
              divergiu += 1;
            }
          }
        }
      }
    }

    expect(casos).toBe(3 * 6 * 16 * 16);
    // Sem isto o invariante poderia estar passando por vacuidade.
    expect(divergiu).toBeGreaterThan(0);
  });
});

/**
 * C4 do Gate 2: quem já está coberto por inteiro some do seletor, e o sumiço
 * mudo faz quem ligou o PIX à nota errada não o achar na nota certa.
 */
describe("candidatos escondidos por já estarem cobertos", () => {
  it("conta o pagamento coberto por inteiro por OUTRA nota", () => {
    const alvo = doc({ id: "d2", valorCentavos: 300_000 });
    const painel = {
      documentos: [doc({ id: "d1" }), alvo],
      pagamentos: [pag({ id: "p1", documentoIds: ["d1"] })],
    };
    const a = alocarCusto(painel);
    expect(pagamentosCandidatos(alvo, painel.pagamentos, a)).toHaveLength(0);
    expect(
      pagamentosOcultosPorCobertura(alvo, painel.pagamentos, a).map((p) => p.id),
    ).toEqual(["p1"]);
  });

  it("conta a nota coberta por inteiro por OUTRO pagamento", () => {
    const alvo = pag({ id: "p2" });
    const painel = {
      documentos: [doc({ id: "d1" })],
      pagamentos: [pag({ id: "p1", documentoIds: ["d1"] }), alvo],
    };
    const a = alocarCusto(painel);
    expect(documentosCandidatos(alvo, painel.documentos, a)).toHaveLength(0);
    expect(
      documentosOcultosPorCobertura(alvo, painel.documentos, a).map((d) => d.id),
    ).toEqual(["d1"]);
  });

  it("o já ligado a ESTE registro não conta como escondido por cobertura", () => {
    const alvo = doc({ id: "d1" });
    const painel = {
      documentos: [alvo],
      pagamentos: [pag({ id: "p1", documentoIds: ["d1"] })],
    };
    const a = alocarCusto(painel);
    expect(pagamentosOcultosPorCobertura(alvo, painel.pagamentos, a)).toEqual([]);
  });
});

/**
 * O número que a tela de registrar o pagamento SUGERE no campo Valor quando o
 * pagamento nasce ligado a uma nota (2026-08-18). É sugestão em campo
 * editável, e ainda assim o erro caro mora aqui: sugerir o valor CHEIO na
 * segunda parcela dobra o custo declarado.
 */
describe("saldo a pagar da nota (sugestão do campo Valor)", () => {
  it("nota sem pagamento ligado: falta ela inteira", () => {
    const nota = doc({ id: "d1", valorCentavos: 300_000 });
    expect(saldoDescobertoDaNota(nota, alocar([nota], []))).toBe(300_000);
  });

  it("⚠️ nota com parcela já ligada: falta o RESTO, nunca o valor cheio", () => {
    // A segunda medição da empreiteira. Se voltasse R$ 3.000 aqui, o Mateus
    // salvaria sem reparar e o custo entraria em dobro — parecer §4.
    const nota = doc({ id: "d1", valorCentavos: 300_000 });
    const parcela = pag({ id: "p1", valorCentavos: 100_000, documentoIds: ["d1"] });
    expect(saldoDescobertoDaNota(nota, alocar([nota], [parcela]))).toBe(200_000);
  });

  it("nota já coberta por inteiro não sugere nada", () => {
    const nota = doc({ id: "d1", valorCentavos: 300_000 });
    const pago = pag({ id: "p1", valorCentavos: 300_000, documentoIds: ["d1"] });
    expect(saldoDescobertoDaNota(nota, alocar([nota], [pago]))).toBeNull();
  });

  it("nota sem valor informado não sugere nada", () => {
    const nota = doc({ id: "d1", valorCentavos: null });
    expect(saldoDescobertoDaNota(nota, alocar([nota], []))).toBeNull();
  });

  it("boleto e quarentena não sugerem: a alocação mantém a cobertura deles em zero", () => {
    // "valor − coberto" devolveria o valor CHEIO mesmo depois de pago, que é
    // exatamente o erro que o caso da parcela acima proíbe.
    const boleto = doc({ id: "d1", tipo: "boleto", valorCentavos: 300_000 });
    const quarentena = doc({
      id: "d2",
      status: "quarentena",
      motivoQuarentena: "nota fora do CPF",
      destinatarioCpfOk: false,
      valorCentavos: 300_000,
    });
    const pagos = [
      pag({ id: "p1", valorCentavos: 100_000, documentoIds: ["d1"] }),
      pag({ id: "p2", valorCentavos: 100_000, documentoIds: ["d2"] }),
    ];
    const a = alocar([boleto, quarentena], pagos);
    expect(saldoDescobertoDaNota(boleto, a)).toBeNull();
    expect(saldoDescobertoDaNota(quarentena, a)).toBeNull();
  });

  it("documento fora da alocação não sugere nada", () => {
    const nota = doc({ id: "d1", valorCentavos: 300_000 });
    expect(saldoDescobertoDaNota(nota, alocar([], []))).toBeNull();
  });
});


// ══════════════════════════════════════════════════════════════════════════
// CONTAI-019 · A ORDEM DO CÁLCULO (§F.3) — o item mais perigoso do ticket
// ══════════════════════════════════════════════════════════════════════════

describe("⚠️ critério 14b — o encargo sai ANTES do teto do mínimo", () => {
  it("nota 10.400, pago 10.500 com 500 de mora → min(10.000; 10.400) = 10.000", () => {
    // Os números são do parecer §F.3, `[Certain]`, e não são ilustrativos:
    // são a prova de que a ordem não é cosmética.
    const NOTA = 1_040_000; // R$ 10.400,00
    const PAGO = 1_050_000; // R$ 10.500,00
    const MORA = 50_000; //    R$    500,00

    const a = alocar(
      [doc({ id: "d1", valorCentavos: NOTA })],
      [
        pag({
          id: "p1",
          valorCentavos: PAGO,
          encargosCentavos: MORA,
          documentoIds: ["d1"],
        }),
      ],
    );

    const componente = a.componentes[0];
    expect(componente.somaPagamentosCentavos, "Σ ELEGÍVEIS, não Σ pagos").toBe(
      1_000_000,
    );
    expect(componente.custoComprovadoCentavos).toBe(1_000_000);

    // ⚠️ A ASSERÇÃO QUE NOMEIA O BUG. Na ordem invertida — teto primeiro,
    // encargo depois — o mínimo seria min(10.500; 10.400) = 10.400, e
    // R$ 400,00 DE MORA ENTRARIAM COMO OBRA. É o risco nº 1 do pre-mortem
    // acontecendo dentro da fórmula, e é a única classe de erro que gera
    // passivo tributário (parecer de 17/08, §4).
    const ordemInvertida = Math.min(PAGO, NOTA);
    expect(ordemInvertida).toBe(1_040_000);
    expect(
      componente.custoComprovadoCentavos,
      "ordem invertida daria min(10.500; 10.400) = 10.400, com R$ 400,00 de mora entrando como obra",
    ).not.toBe(ordemInvertida);
    expect(
      ordemInvertida - componente.custoComprovadoCentavos,
      "a diferença entre as duas ordens É a mora que teria virado custo de aquisição",
    ).toBe(40_000);
  });

  it("critério 14 — 10.000 confirmado com 10.320: custo 10.000, os 320 fora", () => {
    const a = alocar(
      [doc({ id: "d1", valorCentavos: 1_000_000 })],
      [
        pag({
          id: "p1",
          valorCentavos: 1_032_000,
          encargosCentavos: 32_000,
          documentoIds: ["d1"],
        }),
      ],
    );
    expect(a.componentes[0].custoComprovadoCentavos).toBe(1_000_000);
    expect(custoComprovadoDoAno(a, 2026)).toBe(1_000_000);

    // "Registrados e FORA": os R$ 320 não viram custo e também NÃO viram
    // "pago sem nota" — encargo fica fora para sempre e **sem pendência**,
    // porque não há o que cobrar (§F.1). Cobrar a nota de um juro de mora
    // seria cobrar um documento que não existe.
    expect(a.porPagamento.get("p1")).toMatchObject({
      elegivelCentavos: 1_000_000,
      comprovadoCentavos: 1_000_000,
      semNotaCentavos: 0,
    });
  });

  it("o encargo sai mesmo sem nota nenhuma ligada — não vira 'pago sem nota'", () => {
    const a = alocar([], [pag({ id: "p1", valorCentavos: 1_032_000, encargosCentavos: 32_000 })]);
    expect(a.porPagamento.get("p1")).toMatchObject({
      elegivelCentavos: 1_000_000,
      comprovadoCentavos: 0,
      semNotaCentavos: 1_000_000,
    });
  });
});

describe("valor MENOR que o previsto (critérios 28 e 29, adendo §D)", () => {
  it("28 — 'quita': custo = R$ 9.500 (o pago) e ZERO resíduo", () => {
    // A nota foi emitida pelo valor cheio (R$ 10.000). O teto do mínimo já
    // acerta sozinho: Σ documentos > Σ pagamentos, e o custo é o pago.
    // "Não há tratamento especial a escrever" (adendo §D).
    const a = alocar(
      [doc({ id: "d1", valorCentavos: 1_000_000 })],
      [pag({ id: "p1", valorCentavos: 950_000, documentoIds: ["d1"] })],
    );
    expect(a.componentes[0].custoComprovadoCentavos).toBe(950_000);
    expect(a.porPagamento.get("p1")?.semNotaCentavos, "sem resíduo").toBe(0);
    // A sobra da NOTA não é custo (regime de caixa) e não é pendência fiscal.
    expect(a.porDocumento.get("d1")?.excedenteNotaCentavos).toBe(50_000);
  });

  it("29 — 'falta pagar o resto': o saldo não é custo de ano NENHUM", () => {
    const a = alocar(
      [doc({ id: "d1", valorCentavos: 1_000_000 })],
      [pag({ id: "p1", valorCentavos: 950_000, dataPagamento: "2026-08-12", documentoIds: ["d1"] })],
    );
    expect(custoComprovadoDoAno(a, 2026)).toBe(950_000);
    for (const ano of [2025, 2027, 2028]) {
      expect(custoComprovadoDoAno(a, ano), `saldo virando custo em ${ano}`).toBe(0);
    }
    // E o acumulado até o fim de qualquer ano também para nos R$ 9.500: o
    // saldo "só vira custo se e quando sair da conta".
    expect(custoComprovadoAteOAno(a, 2030)).toBe(950_000);
  });
});

describe("diferença não explicada — quais resoluções voltam ao custo (§F.2)", () => {
  const base = {
    valorCentavos: 1_050_000, // pago
    encargosCentavos: 20_000, // R$ 200 de encargo identificado
    naoExplicadoCentavos: 30_000, // R$ 300 sem explicação
  };

  it("'não sei ainda' (null) deixa a diferença FORA — direção segura", () => {
    expect(
      valorElegivelDoPagamento(pag({ id: "p1", ...base, resolucaoDiferenca: null })),
    ).toBe(1_000_000);
  });

  it("'não compõe custo da obra' deixa fora, definitivamente", () => {
    expect(
      valorElegivelDoPagamento(
        pag({ id: "p1", ...base, resolucaoDiferenca: "nao_compoe_custo" }),
      ),
    ).toBe(1_000_000);
  });

  it("'é da obra e falta o documento' devolve ao elegível — vira 'pago sem nota'", () => {
    const p = pag({ id: "p1", ...base, resolucaoDiferenca: "falta_documento" });
    expect(valorElegivelDoPagamento(p)).toBe(1_030_000);
    // §F.1: com nota de R$ 10.000 o custo NÃO se move hoje — o teto é a nota —
    // mas os R$ 300 passam a ser risco REGISTRADO e cobrança a fazer.
    const a = alocar([doc({ id: "d1", valorCentavos: 1_000_000 })], [
      { ...p, documentoIds: ["d1"] },
    ]);
    expect(a.componentes[0].custoComprovadoCentavos).toBe(1_000_000);
    expect(a.porPagamento.get("p1")?.semNotaCentavos).toBe(30_000);
  });

  it("§F.1 — chegando a nota do aditivo de R$ 300, o teto vira min(10.300; 10.300)", () => {
    const p = pag({
      id: "p1",
      ...base,
      resolucaoDiferenca: "falta_documento",
      documentoIds: ["d1", "d2"],
    });
    const a = alocar(
      [
        doc({ id: "d1", valorCentavos: 1_000_000 }),
        doc({ id: "d2", valorCentavos: 30_000 }),
      ],
      [p],
    );
    expect(a.componentes[0].custoComprovadoCentavos).toBe(1_030_000);
    expect(a.porPagamento.get("p1")?.semNotaCentavos).toBe(0);
  });

  it("'o pagamento cobriu mais de um documento' devolve ao elegível", () => {
    expect(
      valorElegivelDoPagamento(
        pag({ id: "p1", ...base, resolucaoDiferenca: "multiplos_documentos" }),
      ),
    ).toBe(1_030_000);
  });

  it("⚠️ 'errei o valor digitado' NÃO é classificação fiscal: fica fora", () => {
    // §F.2, item 4: é correção do registro com rastro (CONTAI-021). Tratá-la
    // como resolvida faria o dinheiro voltar ao custo sem que nada tivesse
    // mudado no mundo.
    expect(
      valorElegivelDoPagamento(
        pag({ id: "p1", ...base, resolucaoDiferenca: "erro_digitacao" }),
      ),
    ).toBe(1_000_000);
  });
});

describe("⚠️ B1 — a PREVISÃO não pode virar teto do custo (Gate 2, §2)", () => {
  /**
   * O caso que o Gate 2 achou, e que nenhum teste anterior pegava porque todos
   * usavam previsto = nota:
   *
   *   previsto R$ 9.000 · nota hábil R$ 10.000 · pago R$ 10.000 · sem encargo
   *
   * A tela de confirmação grava a sobra sobre o PREVISTO como "não explicado".
   * Com a resolução em `null`, a aritmética colapsa:
   *
   *   elegível = pago − encargos − (pago − previsto − encargos) = PREVISTO
   *
   * Quem limita o custo passaria a ser a previsão — o §2 inteiro violado por
   * dentro da fórmula que o §F.3 protege.
   */
  const NOTA = 1_000_000; // R$ 10.000,00
  const PAGO = 1_000_000; // R$ 10.000,00
  const SOBRA_SOBRE_O_PREVISTO = 100_000; // R$ 1.000,00 — previsto era R$ 9.000

  const cenario = (resolucao: Pagamento["resolucaoDiferenca"]) =>
    alocar(
      [doc({ id: "d1", valorCentavos: NOTA })],
      [
        pag({
          id: "p1",
          valorCentavos: PAGO,
          encargosCentavos: 0,
          naoExplicadoCentavos: SOBRA_SOBRE_O_PREVISTO,
          resolucaoDiferenca: resolucao,
          documentoIds: ["d1"],
        }),
      ],
    );

  it("sem resposta, o custo fica preso no previsto — é o estado seguro, e ele DÓI", () => {
    // Registrado para que a correção não pareça gratuita: a direção é segura
    // (subestima), mas o número é a PREVISÃO, e é por isso que a resolução 5
    // precisa existir.
    const a = cenario(null);
    expect(a.componentes[0].custoComprovadoCentavos).toBe(900_000);
    expect(a.porPagamento.get("p1")?.elegivelCentavos).toBe(900_000);
  });

  it("⚠️ 'a previsão é que estava errada' devolve o pago, e o TETO volta a ser a nota", () => {
    const a = cenario("previsao_errada");
    expect(a.porPagamento.get("p1")?.elegivelCentavos).toBe(PAGO);
    expect(
      a.componentes[0].custoComprovadoCentavos,
      "quem limita o custo é o DOCUMENTO HÁBIL, nunca a previsão",
    ).toBe(Math.min(PAGO, NOTA));
    expect(a.componentes[0].custoComprovadoCentavos).toBe(1_000_000);
  });

  /**
   * ⚠️ O NOME DESTE TESTE JÁ GENERALIZOU, e a generalização era falsa.
   *
   * Ele se chamava "e não sobra resíduo nenhum" e roda só o cenário em que a
   * NOTA COBRE O PAGAMENTO INTEIRO. O comportamento sempre esteve certo; o
   * nome é que prometia mais do que o caso prova — a mesma falha que o
   * `contador` achou no corpo do commit `50958a1` e corrigiu no ADENDO 4 §H.4:
   *
   *     Nenhum resíduo vem da CLASSIFICAÇÃO. O que a nota não cobrir continua
   *     aparecendo pela regra geral, porque a quinta resolução afirma "este
   *     dinheiro é obra", nunca "este dinheiro está documentado".
   *
   * O caso limitado pela nota é o teste seguinte (nota de R$ 9.500 → sobram
   * R$ 500 de "pago sem nota"). Os dois juntos é que descrevem a regra.
   */
  it("com a nota cobrindo o pago inteiro, a classificação não deixa resíduo", () => {
    const a = cenario("previsao_errada");
    expect(a.porPagamento.get("p1")?.semNotaCentavos).toBe(0);
  });

  it("a resolução 5 NÃO fura o teto: com nota de R$ 9.500, o custo é R$ 9.500", () => {
    // A prova de que ela devolve o pago ao ELEGÍVEL e não ao custo: o mínimo
    // continua mandando.
    const a = alocar(
      [doc({ id: "d1", valorCentavos: 950_000 })],
      [
        pag({
          id: "p1",
          valorCentavos: PAGO,
          naoExplicadoCentavos: SOBRA_SOBRE_O_PREVISTO,
          resolucaoDiferenca: "previsao_errada",
          documentoIds: ["d1"],
        }),
      ],
    );
    expect(a.componentes[0].custoComprovadoCentavos).toBe(950_000);
  });
});

describe("base documentável — o que ainda pode receber uma nota", () => {
  it("encargo sai: ninguém procura a nota de um juro", () => {
    expect(
      baseDocumentavel(pag({ id: "p1", valorCentavos: 1_032_000, encargosCentavos: 32_000 })),
    ).toBe(1_000_000);
  });

  it("⚠️ diferença já classificada como 'não compõe custo' sai também", () => {
    // Achado do `contador` no Gate 2: ela já foi respondida como algo que não
    // é da obra — cobrar documento para ela é ruído eterno no seletor.
    expect(
      baseDocumentavel(
        pag({
          id: "p1",
          valorCentavos: 1_050_000,
          naoExplicadoCentavos: 50_000,
          resolucaoDiferenca: "nao_compoe_custo",
        }),
      ),
    ).toBe(1_000_000);
  });

  it("diferença sem resposta FICA: ligar a nota é como ela se explica", () => {
    expect(
      baseDocumentavel(
        pag({ id: "p1", valorCentavos: 1_050_000, naoExplicadoCentavos: 50_000 }),
      ),
    ).toBe(1_050_000);
  });

  it("'previsão errada' FICA: é custo real, e precisa de documento hábil", () => {
    expect(
      baseDocumentavel(
        pag({
          id: "p1",
          valorCentavos: 1_050_000,
          naoExplicadoCentavos: 50_000,
          resolucaoDiferenca: "previsao_errada",
        }),
      ),
    ).toBe(1_050_000);
  });

  it("o comprovante não entra nesta conta — ele decide o custo, não o vínculo", () => {
    expect(
      baseDocumentavel(pag({ id: "p1", valorCentavos: 1_000_000, comprovantePath: null })),
    ).toBe(1_000_000);
  });

  it("pagamento com encargo resolvido some do seletor quando já coberto", () => {
    const documento = doc({ id: "d1", valorCentavos: 1_000_000 });
    const pagamento = pag({
      id: "p1",
      valorCentavos: 1_050_000,
      naoExplicadoCentavos: 50_000,
      resolucaoDiferenca: "nao_compoe_custo",
      documentoIds: ["d1"],
    });
    const a = alocar([documento], [pagamento]);
    const outra = doc({ id: "d2", valorCentavos: 500_000 });
    expect(pagamentosCandidatos(outra, [pagamento], a).map((c) => c.item.id)).toEqual([]);
  });
});

describe("pagamento sem comprovante (critérios 46-47)", () => {
  it("elegível é ZERO — grava, mas não entra no custo confirmado", () => {
    const p = pag({ id: "p1", comprovantePath: null, valorCentavos: 1_000_000 });
    expect(valorElegivelDoPagamento(p)).toBe(0);
  });

  it("⚠️ o mesmo dinheiro NÃO aparece em duas pendências", () => {
    // Como o elegível é 0, `semNotaCentavos` também é 0: a exposição desse
    // pagamento é "pago sem comprovante", e só ela. Sem isto, um PIX de
    // R$ 10.000 sem comprovante e sem nota apareceria como R$ 20.000.
    const a = alocar([], [pag({ id: "p1", comprovantePath: null, valorCentavos: 1_000_000 })]);
    expect(a.porPagamento.get("p1")).toMatchObject({
      elegivelCentavos: 0,
      comprovadoCentavos: 0,
      semNotaCentavos: 0,
    });
    expect(valorBloqueadoPorComprovante(a.componentes[0].pagamentos[0])).toBe(1_000_000);
  });

  it("com comprovante, nada fica bloqueado por ele", () => {
    expect(valorBloqueadoPorComprovante(pag({ id: "p1" }))).toBe(0);
  });

  it("o bloqueado desconta encargo e diferença — as parcelas particionam o pago", () => {
    const p = pag({
      id: "p1",
      comprovantePath: null,
      valorCentavos: 1_050_000,
      encargosCentavos: 20_000,
      naoExplicadoCentavos: 30_000,
    });
    expect(valorBloqueadoPorComprovante(p)).toBe(1_000_000);
    expect(valorElegivelDoPagamento(p)).toBe(0);
  });

  it("sem comprovante o pagamento CONTINUA candidato a receber uma nota", () => {
    // Ligar a nota é sempre permitido; o que o comprovante decide é o custo,
    // não o vínculo. Se o seletor lesse a exposição fiscal, o pagamento sumiria
    // da lista e o app ficaria calado sobre o motivo.
    const documento = doc({ id: "d1", valorCentavos: 1_000_000 });
    const pagamento = pag({ id: "p1", comprovantePath: null, valorCentavos: 1_000_000 });
    const a = alocar([documento], [pagamento]);
    expect(
      pagamentosCandidatos(documento, [pagamento], a).map((c) => c.item.id),
    ).toEqual(["p1"]);
  });

  it("pagamento conciliado COM encargo some do seletor, como qualquer coberto", () => {
    // A base do seletor é o valor cheio MENOS os encargos: juros e multa nunca
    // terão documento (§F.1), e mantê-los aqui mandaria o Mateus procurar a
    // nota de um juro para sempre.
    const documento = doc({ id: "d1", valorCentavos: 1_000_000 });
    const pagamento = pag({
      id: "p1",
      valorCentavos: 1_032_000,
      encargosCentavos: 32_000,
      documentoIds: ["d1"],
    });
    const a = alocar([documento], [pagamento]);
    const outra = doc({ id: "d2", valorCentavos: 500_000 });
    expect(
      pagamentosCandidatos(outra, [pagamento], a).map((c) => c.item.id),
      "pagamento coberto por inteiro não é candidato a nada (CONTAI-018, crit. 15)",
    ).toEqual([]);
  });
});

describe("⚠️ o grafo de alocarCusto não tem nó de compromisso (§2, item 7)", () => {
  it("a entrada tem DOIS campos, e nenhum deles é compromisso", () => {
    const documentos = [doc({ id: "d1" })];
    const pagamentos = [pag({ id: "p1", documentoIds: ["d1"] })];

    // Prova de tipo: passar compromisso não compila. Se alguém acrescentar o
    // campo a `EntradaAlocacao`, este `@ts-expect-error` vira erro de
    // "unused directive" e o typecheck acusa — a proteção é de TIPO, não de
    // atenção (parecer §2; critério 3).
    alocarCusto({
      documentos,
      pagamentos,
      // @ts-expect-error compromisso não é nó do grafo de custo
      compromissos: [],
    });

    const a = alocarCusto({ documentos, pagamentos });
    expect(Object.keys(a).sort()).toEqual([
      "componentes",
      "porDocumento",
      "porPagamento",
    ]);
    // O componente só conhece pagamento e documento — não há terceira lista.
    expect(Object.keys(a.componentes[0]).sort()).toEqual([
      "custoComprovadoCentavos",
      "documentos",
      "id",
      "pagamentos",
      "somaDocumentosHabeisCentavos",
      "somaPagamentosCentavos",
    ]);
  });
});
