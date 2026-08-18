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
} from "@/lib/fiscal/vinculo";
import type { Documento, Pagamento } from "@/lib/types";

const OBRA = "obra-1";

function doc(over: Partial<Documento> & { id: string }): Documento {
  return {
    obraId: OBRA,
    tipo: "nf_servico",
    status: "registrado",
    valorCentavos: 300_000,
    vencimento: null,
    classificacao: "mao_obra",
    destinatarioCpfOk: true,
    retencao11: true,
    motivoQuarentena: null,
    favorecidoNome: "WK Construções LTDA",
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
