import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  alocarCusto,
  ehDocumentoHabil,
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
  notaCoberta,
  saldoDescobertoDaNota,
  valorBloqueadoPorComprovante,
  valorElegivelDoPagamento,
} from "@/lib/fiscal/vinculo";
import type { Documento, LinhaRetencao, Pagamento } from "@/lib/types";

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
    retencaoNaNota: "destacada",
    retencoes: [],
    cnoReferenciado: null,
    notaTrazCno: null,
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
      faltaPagamentoCentavos: 0,
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
      faltaPagamentoCentavos: 250_000,
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
      (a.porDocumento.get("d1")?.faltaPagamentoCentavos ?? 0) +
      (a.porDocumento.get("d2")?.faltaPagamentoCentavos ?? 0);
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

describe("⚠️ CONTAI-033, Guarda 1 — documento SEM ARQUIVO não é hábil", () => {
  // Parecer `2026-08-23-anexo-no-desembolso-do-terreno.md`, ADENDO 1 §A.3,
  // `[Certain]`: `C = min(Σ pagamentos elegíveis, Σ documentos hábeis)`. O
  // pagamento sem comprovante empurraria o PISO; o documento sem arquivo
  // levantaria o TETO — liberaria custo confirmado SEM LASTRO NENHUM, que é
  // redução indevida de ganho de capital, cobrada com multa.
  //
  // ⚠️ "Documento sem arquivo não entra em Σ documentos. PONTO." A nuance do
  // §2.1 do corpo do parecer ("o app mostra, o Mateus decide") NÃO se aplica:
  // lá o número subestimava, aqui superestimaria.

  it("tipo e status OK, arquivo ausente → NÃO hábil", () => {
    expect(
      ehDocumentoHabil({
        tipo: "nf_servico",
        status: "registrado",
        arquivoPath: null,
      }),
    ).toBe(false);
  });

  it("os três requisitos são conjuntivos — cada um sozinho reprova", () => {
    const habil = { tipo: "nf_material", status: "registrado", arquivoPath: "u/d/a.pdf" } as const;
    expect(ehDocumentoHabil(habil)).toBe(true);
    expect(ehDocumentoHabil({ ...habil, tipo: "boleto" })).toBe(false);
    expect(ehDocumentoHabil({ ...habil, status: "quarentena" })).toBe(false);
    expect(ehDocumentoHabil({ ...habil, arquivoPath: null })).toBe(false);
  });

  it("nota sem arquivo vinculada dá custo confirmado ZERO — e a despesa não some", () => {
    // Mesmo desenho do teste da quarentena: o não hábil participa do grafo (é
    // ele que evita a mesma despesa contar duas vezes) e contribui zero.
    const a = alocar(
      [doc({ id: "d1", arquivoPath: null })],
      [pag({ id: "p1", documentoIds: ["d1"] })],
    );
    expect(a.componentes[0].somaDocumentosHabeisCentavos).toBe(0);
    expect(a.componentes[0].custoComprovadoCentavos).toBe(0);
    expect(a.porDocumento.get("d1")?.habil).toBe(false);
    expect(a.porPagamento.get("p1")?.semNotaCentavos).toBe(300_000);
  });

  it("⚠️ o arquivo chegando, a MESMA nota volta a comprovar (reversível)", () => {
    // A Guarda 3 é reversível de propósito: "sustenta custo" vira "sim" no
    // instante em que o arquivo sobe. É o que o rótulo revisado pelo `contador`
    // em 2026-09-19 carrega ("Sustenta custo de aquisição", não "Custo
    // confirmado").
    const comArquivo = alocar(
      [doc({ id: "d1", arquivoPath: "u/documento/nf.pdf" })],
      [pag({ id: "p1", documentoIds: ["d1"] })],
    );
    expect(comArquivo.componentes[0].custoComprovadoCentavos).toBe(300_000);
  });

  it("nota sem arquivo NÃO entra no terceiro número (notas hábeis sem pagamento)", () => {
    // Senão a Guarda 1 vazaria por um segundo caminho de soma — pre-mortem 1.
    const a = alocar([doc({ id: "d1", arquivoPath: null })], []);
    expect(documentosHabeisSemPagamento(a)).toHaveLength(0);
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
    expect(depois.porDocumento.get("d1")!.faltaPagamentoCentavos).toBe(0);
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

/**
 * **CONTAI-038 — o fechamento `Σ pagamentos == bruto`, numa função só.**
 *
 * Nasceu no Gate 2 porque o predicado estava DUPLICADO entre `resumo.ts` (a
 * home) e `app/documento/[id]/page.tsx` (o detalhe). Duplicado, ele divergiria
 * no dia em que só um lado fosse ajustado — e divergir aqui é a home mostrando
 * pendência vermelha enquanto a tela do documento diz que ela fechou.
 */
describe("notaCoberta — o fechamento de 2026-08-18 §4.1", () => {
  it("nota paga por inteiro está coberta", () => {
    const nota = doc({ id: "d1", valorCentavos: 300_000 });
    const pago = pag({ id: "p1", valorCentavos: 300_000, documentoIds: ["d1"] });
    expect(notaCoberta(nota, alocar([nota], [pago]))).toBe(true);
  });

  it("falta a última perna (a guia) → NÃO está coberta", () => {
    const nota = doc({ id: "d1", valorCentavos: 300_000 });
    const liquido = pag({ id: "p1", valorCentavos: 294_600, documentoIds: ["d1"] });
    expect(notaCoberta(nota, alocar([nota], [liquido]))).toBe(false);
  });

  /**
   * ⚠️ **O caso que o `&& ehDocumentoHabil` existe para pegar.** Sem arquivo,
   * `saldoDescobertoDaNota` devolve `null` por ser INAPLICÁVEL ("não dá para
   * afirmar"), não por estar paga. Tratar esse `null` como "coberta" fecharia
   * a pendência de quem recolhe numa nota que não sustenta nada.
   */
  it("nota SEM ARQUIVO nunca conta como coberta, mesmo com pagamento ligado", () => {
    const nota = doc({ id: "d1", valorCentavos: 300_000, arquivoPath: null });
    const pago = pag({ id: "p1", valorCentavos: 300_000, documentoIds: ["d1"] });
    expect(saldoDescobertoDaNota(nota, alocar([nota], [pago]))).toBeNull();
    expect(notaCoberta(nota, alocar([nota], [pago]))).toBe(false);
  });

  it("quarentena e boleto também não contam como cobertos", () => {
    const quarentena = doc({
      id: "d1",
      status: "quarentena",
      destinatarioCpfOk: false,
      motivoQuarentena: "nota fora do CPF",
    });
    const boleto = doc({ id: "d2", tipo: "boleto" });
    const a = alocar([quarentena, boleto], []);
    expect(notaCoberta(quarentena, a)).toBe(false);
    expect(notaCoberta(boleto, a)).toBe(false);
  });

  /**
   * **A malha contra a duplicação voltar.** Um `saldoDescobertoDaNota(...) ===
   * null` escrito à mão num consumidor é o predicado renascendo — e foi
   * exatamente isso que o Gate 2 pegou.
   */
  it("nenhum consumidor reescreve o predicado à mão", () => {
    for (const arquivo of [
      "lib/fiscal/resumo.ts",
      "app/(gestao)/documento/[id]/page.tsx",
      "app/_components/retencao.tsx",
    ]) {
      const fonte = readFileSync(arquivo, "utf-8");
      expect(
        /saldoDescobertoDaNota\([^)]*\)\s*===\s*null/.test(fonte),
        `${arquivo} reescreveu o fechamento à mão — ele sai de \`notaCoberta\``,
      ).toBe(false);
    }
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
    expect(a.porDocumento.get("d1")?.faltaPagamentoCentavos).toBe(50_000);
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
    // `vinculosOrfaos` entrou no CONTAI-008 (critério 12) e é a rede do vínculo
    // que cruza duas obras — não é nó de custo, não soma nada, e continua sem
    // existir nó de compromisso nenhum aqui.
    // `porRetencao` entrou no CONTAI-056 e **não é nó do grafo**: é a perna de
    // quitação de uma nota que já está no grafo, indexada por linha de
    // `documento_retencao`. Compromisso continua não existindo aqui.
    expect(Object.keys(a).sort()).toEqual([
      "componentes",
      "porDocumento",
      "porPagamento",
      "porRetencao",
      "vinculosOrfaos",
    ]);
    // O componente conhece pagamento e documento — as duas listas de NÓS. A
    // retenção entra como SOMA (`somaRetencoesConfirmadasCentavos`), nunca como
    // terceira lista de nós, e compromisso não entra de forma nenhuma.
    expect(Object.keys(a.componentes[0]).sort()).toEqual([
      "custoComprovadoCentavos",
      "documentos",
      "id",
      "pagamentos",
      "somaDocumentosHabeisCentavos",
      "somaPagamentosCentavos",
      "somaRetencoesConfirmadasCentavos",
    ]);
  });
});

describe("vínculo cruzando obras: reportado, nunca engolido (CONTAI-008, critério 12)", () => {
  it("o vínculo que aponta para fora desta obra vira linha em `vinculosOrfaos`", () => {
    // `d-de-outra-obra` não está na entrada porque a entrada é de UMA obra —
    // é exatamente o estado que `moverPagamentoDeObra` produzia antes deste
    // ticket, e que `alocarCusto` descartava sob um `continue` mudo.
    const a = alocarCusto({
      documentos: [doc({ id: "d1" })],
      pagamentos: [
        pag({ id: "p1", documentoIds: ["d1", "d-de-outra-obra"] }),
      ],
    });

    expect(a.vinculosOrfaos).toEqual([
      { pagamentoId: "p1", documentoId: "d-de-outra-obra" },
    ]);
  });

  it("reportar NÃO muda o custo: o vínculo entre obras continua não somando nada", () => {
    const semOrfao = alocarCusto({
      documentos: [doc({ id: "d1", valorCentavos: 300_000 })],
      pagamentos: [pag({ id: "p1", documentoIds: ["d1"], valorCentavos: 300_000 })],
    });
    const comOrfao = alocarCusto({
      documentos: [doc({ id: "d1", valorCentavos: 300_000 })],
      pagamentos: [
        pag({
          id: "p1",
          documentoIds: ["d1", "d-de-outra-obra"],
          valorCentavos: 300_000,
        }),
      ],
    });

    // Nada soma entre obras — antes e depois deste ticket. O que mudou é que
    // agora alguém fica sabendo.
    expect(custoComprovadoDoAno(comOrfao, 2026)).toBe(
      custoComprovadoDoAno(semOrfao, 2026),
    );
    expect(semOrfao.vinculosOrfaos).toEqual([]);
  });

  it("obra saudável tem a lista vazia — o card não pode acender à toa", () => {
    const a = alocarCusto({
      documentos: [doc({ id: "d1" }), doc({ id: "d2" })],
      pagamentos: [pag({ id: "p1", documentoIds: ["d1"] }), pag({ id: "p2" })],
    });
    expect(a.vinculosOrfaos).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
/**
 * **CONTAI-056 — a perna de retenção, e ela é P0.**
 *
 * Fonte: `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`, ADENDO 2
 * e ADENDO 3 (2026-09-25). O defeito que estes testes travam é o achado literal
 * do ADENDO 2: *"a palavra `retencao` não aparece nesse arquivo"* — nota de
 * R$ 10,00 com R$ 0,50 retidos e R$ 9,50 transferidos ficava com R$ 9,50 de
 * custo comprovado **para sempre**, e os R$ 0,50 alarmando "nota ainda não
 * paga". Custo subestimado é ganho de capital inflado na venda: dinheiro real
 * saindo do bolso do Mateus.
 */
describe("CONTAI-056 · a linha de retenção como perna de pagamento", () => {
  /** A nota de serviço do caso real: bruto, com o gate "destacada". */
  function nf(retencoes: LinhaRetencao[], over: Partial<Documento> = {}) {
    return doc({
      id: "d1",
      tipo: "nf_servico",
      valorCentavos: 1_000,
      retencaoNaNota: "destacada",
      retencoes,
      ...over,
    });
  }

  function ret(over: Partial<LinhaRetencao> = {}): LinhaRetencao {
    return {
      id: "ret-1",
      documentoId: "d1",
      rotuloLiteral: "Total das Retenções (ISSQN / Federais)",
      valorCentavos: 50,
      composicao: "combinado_nao_aberto",
      tributo: null,
      eDescontoEfetivo: true,
      quemRecolhe: "nao_sei",
      createdAt: "2026-03-21T10:00:00Z",
      ...over,
    };
  }

  /**
   * **O caso do ADENDO 2, com os números do parecer**: bruto R$ 10,00, retido
   * R$ 0,50, transferido R$ 9,50 → custo R$ 10,00, e **nada** de "nota ainda
   * não paga". O `explicadoPorRetencaoCentavos` decompõe o coberto; não soma
   * com ele.
   */
  it("bruto 10,00 / retido 0,50 qualificado / pago 9,50 → custo 10,00", () => {
    const a = alocar(
      [nf([ret({ quemRecolhe: "empresa" })])],
      [pag({ id: "p1", valorCentavos: 950, documentoIds: ["d1"] })],
    );

    expect(a.componentes[0]).toMatchObject({
      // O campo continua significando "Σ ELEGÍVEIS dos pagamentos" — a
      // retenção tem soma própria, e o mínimo é sobre as duas.
      somaPagamentosCentavos: 950,
      somaRetencoesConfirmadasCentavos: 50,
      somaDocumentosHabeisCentavos: 1_000,
      custoComprovadoCentavos: 1_000,
    });
    expect(a.porDocumento.get("d1")).toMatchObject({
      cobertoCentavos: 1_000,
      faltaPagamentoCentavos: 0,
      explicadoPorRetencaoCentavos: 50,
      retencaoSobrecobertaCentavos: 0,
    });
    expect(a.porRetencao.get("ret-1")).toMatchObject({
      documentoId: "d1",
      pagamentoAncoraId: "p1",
      dataEfeito: "2026-08-12",
      valorCentavos: 50,
      comprovadoCentavos: 50,
      naoAbsorvidoCentavos: 0,
    });
    // ⚠️ O pagamento real não é tocado: nada de `Pagamento` sintético, nada de
    // dinheiro que não saiu aparecendo em "pago sem nota".
    expect(a.porPagamento.get("p1")).toMatchObject({
      elegivelCentavos: 950,
      comprovadoCentavos: 950,
      semNotaCentavos: 0,
    });
    expect(custoComprovadoDoAno(a, 2026)).toBe(1_000);
    // E a nota deixa de alarmar: é isso que fecha o critério 7 na discriminação.
    expect(saldoDescobertoDaNota(nf([ret()]), a)).toBeNull();
    expect(notaCoberta(nf([ret()]), a)).toBe(true);
  });

  it('"nao_sei" conta igual a "empresa" — o custo não espera quem recolhe', () => {
    const a = alocar(
      [nf([ret({ quemRecolhe: "nao_sei" })])],
      [pag({ id: "p1", valorCentavos: 950, documentoIds: ["d1"] })],
    );
    expect(a.componentes[0].custoComprovadoCentavos).toBe(1_000);
    expect(a.porDocumento.get("d1")?.faltaPagamentoCentavos).toBe(0);
  });

  /**
   * **ADENDO 3, Pergunta 1** — a exceção é DE ESTADO, não de tempo: com
   * `"eu"` a perna nunca soma, nem antes nem depois de a guia existir. A perna
   * dele é a guia, um `Pagamento` de verdade.
   */
  it('`quem_recolhe = "eu"` NUNCA soma — a perna dele é a guia', () => {
    const antesDaGuia = alocar(
      [nf([ret({ quemRecolhe: "eu" })])],
      [pag({ id: "p1", valorCentavos: 950, documentoIds: ["d1"] })],
    );
    expect(antesDaGuia.porRetencao.size).toBe(0);
    expect(antesDaGuia.componentes[0].somaRetencoesConfirmadasCentavos).toBe(0);
    expect(antesDaGuia.componentes[0].custoComprovadoCentavos).toBe(950);
    // Falta GENUÍNA: ele ainda tem os 0,50 no bolso. A pendência da guia
    // continua de pé — `linhaSemRecolhedor` não mudou uma linha.
    expect(antesDaGuia.porDocumento.get("d1")).toMatchObject({
      faltaPagamentoCentavos: 50,
      explicadoPorRetencaoCentavos: 0,
    });
    expect(notaCoberta(nf([ret({ quemRecolhe: "eu" })]), antesDaGuia)).toBe(
      false,
    );

    // Depois da guia: a guia sozinha fecha a nota, sem contagem em dobro.
    const comGuia = alocar(
      [nf([ret({ quemRecolhe: "eu" })])],
      [
        pag({ id: "p1", valorCentavos: 950, documentoIds: ["d1"] }),
        pag({
          id: "p2",
          valorCentavos: 50,
          dataPagamento: "2026-09-10",
          documentoIds: ["d1"],
        }),
      ],
    );
    expect(comGuia.porRetencao.size).toBe(0);
    expect(comGuia.componentes[0].custoComprovadoCentavos).toBe(1_000);
    expect(custoComprovadoDoAno(comGuia, 2026)).toBe(1_000);
  });

  it("linha informativa (desconto não efetivo) não é perna de nada", () => {
    const a = alocar(
      [
        nf([
          ret({
            rotuloLiteral: "INSS (composição do Simples)",
            eDescontoEfetivo: false,
            quemRecolhe: null,
          }),
        ]),
      ],
      [pag({ id: "p1", valorCentavos: 950, documentoIds: ["d1"] })],
    );
    expect(a.porRetencao.size).toBe(0);
    expect(a.componentes[0].custoComprovadoCentavos).toBe(950);
    expect(a.porDocumento.get("d1")?.faltaPagamentoCentavos).toBe(50);
  });

  /**
   * **ADENDO 3, Pergunta 2, o parágrafo final** — *"sem desembolso, não há
   * dispêndio; sem dispêndio, não há data; sem data, a linha não entra em soma
   * de ano nenhum"*. Vale até com a pendência fiscal já fechada
   * (`"empresa"`): é o mesmo estado que já valia para nota sem pagamento.
   */
  it("sem NENHUM pagamento vinculado, a linha não entra em ano nenhum", () => {
    const a = alocar([nf([ret({ quemRecolhe: "empresa" })])], []);
    expect(a.porRetencao.size).toBe(0);
    expect(custoComprovadoAteOAno(a, 2026)).toBe(0);
    expect(custoComprovadoAteOAno(a, 2030)).toBe(0);
    expect(a.porDocumento.get("d1")).toMatchObject({
      cobertoCentavos: 0,
      faltaPagamentoCentavos: 1_000,
      explicadoPorRetencaoCentavos: 0,
    });
  });

  /**
   * A Guarda 1 do CONTAI-033 aplicada à perna nova: nota sem arquivo (ou em
   * quarentena) contribui ZERO para o teto, e a perna dela não pode empurrar o
   * PISO. Direção do erro que isso evitaria: custo comprovado sem lastro.
   */
  it("nota NÃO HÁBIL não gera perna de retenção", () => {
    for (const over of [
      { arquivoPath: null },
      { status: "quarentena" as const, motivoQuarentena: "CPF de terceiro" },
    ]) {
      const a = alocar(
        [nf([ret({ quemRecolhe: "empresa" })], over)],
        [pag({ id: "p1", valorCentavos: 950, documentoIds: ["d1"] })],
      );
      expect(a.porRetencao.size, JSON.stringify(over)).toBe(0);
      expect(a.componentes[0].custoComprovadoCentavos).toBe(0);
    }
  });

  /**
   * **Critério 8 — sobrecoberto vira DADO CONTRADITÓRIO visível, nunca estouro
   * silencioso.** E o dinheiro real ganha a disputa: um PIX de R$ 10,00 não
   * pode virar "pago sem nota" de R$ 0,50 por causa de uma ficção de quitação.
   */
  it("pagamentos + retenção > bruto: a SOBRA fica na perna de retenção", () => {
    const a = alocar(
      [nf([ret({ quemRecolhe: "empresa" })])],
      [pag({ id: "p1", valorCentavos: 1_000, documentoIds: ["d1"] })],
    );
    expect(a.componentes[0].custoComprovadoCentavos).toBe(1_000);
    expect(a.porPagamento.get("p1")).toMatchObject({
      comprovadoCentavos: 1_000,
      semNotaCentavos: 0,
    });
    expect(a.porRetencao.get("ret-1")).toMatchObject({
      comprovadoCentavos: 0,
      naoAbsorvidoCentavos: 50,
    });
    expect(a.porDocumento.get("d1")).toMatchObject({
      cobertoCentavos: 1_000,
      faltaPagamentoCentavos: 0,
      explicadoPorRetencaoCentavos: 0,
      retencaoSobrecobertaCentavos: 50,
    });
    // Nada de custo além do bruto da nota: o teto do mínimo segue de pé.
    expect(custoComprovadoDoAno(a, 2026)).toBe(1_000);
  });

  /**
   * **Regime de caixa, com o componente cruzando ano.** A perna entra no ano do
   * pagamento MAIS ANTIGO da nota (ADENDO 3: *"o primeiro pagamento vinculado
   * já é o marco de 'a partir daqui existe desembolso comprovável'"*), não no
   * do último nem no da nota.
   */
  it("data-efeito = pagamento mais antigo, e o ano dela é o dele", () => {
    const a = alocar(
      [nf([ret({ quemRecolhe: "empresa", valorCentavos: 5_000 })], {
        valorCentavos: 100_000,
      })],
      [
        pag({
          id: "p1",
          valorCentavos: 40_000,
          dataPagamento: "2025-11-10",
          documentoIds: ["d1"],
        }),
        pag({
          id: "p2",
          valorCentavos: 55_000,
          dataPagamento: "2026-02-10",
          documentoIds: ["d1"],
        }),
      ],
    );
    expect(a.porRetencao.get("ret-1")).toMatchObject({
      pagamentoAncoraId: "p1",
      dataEfeito: "2025-11-10",
      comprovadoCentavos: 5_000,
    });
    // 40.000 (PIX) + 5.000 (retenção) em 2025; 55.000 em 2026.
    expect(custoComprovadoDoAno(a, 2025)).toBe(45_000);
    expect(custoComprovadoDoAno(a, 2026)).toBe(55_000);
    expect(custoComprovadoAteOAno(a, 2026)).toBe(100_000);
  });

  /**
   * **ADENDO 3, Pergunta 2, "detalhe normativo"** — literal: *"'o pagamento
   * vinculado mais antigo' tem de ser do mesmo `documento_id`, não do
   * 'componente' agregado (…): dois documentos diferentes do mesmo favorecido
   * não podem emprestar data um do outro"*.
   */
  it("a data vem do pagamento DESTA nota, nunca do mais antigo do componente", () => {
    const a = alocar(
      [
        nf([ret({ quemRecolhe: "empresa", valorCentavos: 5_000 })], {
          valorCentavos: 100_000,
        }),
        doc({ id: "d2", valorCentavos: 100_000 }),
      ],
      [
        // Mais antigo do COMPONENTE, mas ligado só a d2.
        pag({
          id: "p-velho",
          valorCentavos: 50_000,
          dataPagamento: "2025-01-10",
          documentoIds: ["d2"],
        }),
        // O que liga os dois documentos — e o único de d1.
        pag({
          id: "p-novo",
          valorCentavos: 145_000,
          dataPagamento: "2026-05-10",
          documentoIds: ["d1", "d2"],
        }),
      ],
    );
    expect(a.componentes).toHaveLength(1);
    expect(a.porRetencao.get("ret-1")).toMatchObject({
      pagamentoAncoraId: "p-novo",
      dataEfeito: "2026-05-10",
    });
    // 2025 fica com o PIX velho SÓ. Se a data fosse emprestada do componente,
    // 2025 teria 55.000 e um ano já declarado mudaria por um fato de outra nota.
    expect(custoComprovadoDoAno(a, 2025)).toBe(50_000);
    expect(custoComprovadoDoAno(a, 2026)).toBe(150_000);
  });

  it("duas linhas qualificadas na mesma nota somam as duas", () => {
    const a = alocar(
      [
        nf(
          [
            ret({ id: "ret-1", valorCentavos: 30, quemRecolhe: "empresa" }),
            ret({ id: "ret-2", valorCentavos: 20, quemRecolhe: "nao_sei" }),
          ],
        ),
      ],
      [pag({ id: "p1", valorCentavos: 950, documentoIds: ["d1"] })],
    );
    expect(a.componentes[0].somaRetencoesConfirmadasCentavos).toBe(50);
    expect(a.porDocumento.get("d1")).toMatchObject({
      cobertoCentavos: 1_000,
      explicadoPorRetencaoCentavos: 50,
      faltaPagamentoCentavos: 0,
    });
  });

  /**
   * A perna cobre A PRÓPRIA nota dela. Sem a passada dedicada de
   * `alocarCusto`, a ordem estável por id daria o "explicado por retenção" ao
   * documento errado do mesmo componente — os dois motivos dos critérios 4 e 5
   * voltariam a se misturar, num lugar mais difícil de ver.
   */
  it("o 'explicado por retenção' fica na nota da linha, não na vizinha", () => {
    const a = alocar(
      [
        // `d-a` vem ANTES por id, e é a que NÃO tem retenção.
        doc({ id: "d-a", valorCentavos: 1_000 }),
        nf([ret({ documentoId: "d-b", quemRecolhe: "empresa" })], {
          id: "d-b",
        }),
      ],
      [
        pag({
          id: "p1",
          valorCentavos: 1_950,
          documentoIds: ["d-a", "d-b"],
        }),
      ],
    );
    expect(a.componentes[0].custoComprovadoCentavos).toBe(2_000);
    expect(a.porDocumento.get("d-a")?.explicadoPorRetencaoCentavos).toBe(0);
    expect(a.porDocumento.get("d-b")?.explicadoPorRetencaoCentavos).toBe(50);
  });

  /**
   * **LIMITAÇÃO CONHECIDA — D77, e este teste FIXA o comportamento em vez de
   * aprová-lo.** Achado numérico do `cto-obra` no Gate 2 do CONTAI-056
   * (2026-09-25), com estes números exatos.
   *
   * O `min` de cobertura é por COMPONENTE CONEXO. Ali um pagamento é fungível
   * entre as notas do grupo — mas a perna de retenção **não é**: ela é quitação
   * de UMA nota. Com um PIX compartilhado ligando duas notas, a retenção da nota
   * A (já paga pelo BRUTO, logo dado contraditório) acaba cobrindo o buraco de
   * R$ 500 da nota B, e a sobrecobertura de A **não acende**.
   *
   * ⚠️ **O número que sai é R$ 20.000; o defensável é R$ 19.500** — a direção
   * que SUPERESTIMA custo, a única que o §4 do parecer de 17/08 classifica como
   * geradora de passivo tributário. É por isso que a dívida é nomeada, não só
   * comentada.
   *
   * ⚠️ **Não assuma que isto vai ser corrigido.** A correção real exige valor
   * por VÍNCULO (`pagamento_documento` com valor) em vez de cobertura por
   * componente — mudança de modelo de dados, declarada fora do escopo do
   * CONTAI-056 pelo `cto-obra`. Enquanto D77 estiver aberta, mudar as asserções
   * abaixo é mudar o comportamento: quem as mudar, mude a dívida junto
   * (`docs/backlog.md`, D77).
   */
  it("limitação conhecida D77: a retenção de uma nota cobre a vizinha do mesmo componente", () => {
    const a = alocar(
      [
        // Nota A: paga pelo BRUTO **e** com retenção confirmada — contradição.
        nf([ret({ documentoId: "d-a", quemRecolhe: "empresa", valorCentavos: 50_000 })], {
          id: "d-a",
          valorCentavos: 1_000_000,
        }),
        doc({ id: "d-b", valorCentavos: 1_000_000 }),
      ],
      [
        // O PIX compartilhado: paga A por inteiro e liga as duas notas.
        pag({
          id: "p1",
          valorCentavos: 1_000_000,
          documentoIds: ["d-a", "d-b"],
        }),
        pag({ id: "p2", valorCentavos: 950_000, documentoIds: ["d-b"] }),
      ],
    );

    expect(a.componentes).toHaveLength(1);
    expect(a.componentes[0]).toMatchObject({
      somaPagamentosCentavos: 1_950_000,
      somaRetencoesConfirmadasCentavos: 50_000,
      somaDocumentosHabeisCentavos: 2_000_000,
      // ⚠️ AQUI está a dívida: R$ 20.000. O defensável é R$ 19.500 — os R$ 500
      // de retenção de A não podiam quitar os R$ 500 que faltavam em B.
      custoComprovadoCentavos: 2_000_000,
    });
    // E a contradição de A fica MUDA: o critério 8 não acende neste arranjo.
    expect(a.porRetencao.get("ret-1")).toMatchObject({
      comprovadoCentavos: 50_000,
      naoAbsorvidoCentavos: 0,
    });
    expect(a.porDocumento.get("d-a")?.retencaoSobrecobertaCentavos).toBe(0);
    expect(a.porDocumento.get("d-b")?.faltaPagamentoCentavos).toBe(0);

    // O que a passada dedicada do lado do documento JÁ garante, e não é pouco:
    // o "explicado por retenção" fica na nota da linha, nunca na vizinha. É a
    // metade do problema que dá para resolver sem mudar o modelo de dados.
    expect(a.porDocumento.get("d-a")?.explicadoPorRetencaoCentavos).toBe(50_000);
    expect(a.porDocumento.get("d-b")?.explicadoPorRetencaoCentavos).toBe(0);

    // ⚠️ **E o contraste que delimita a dívida**: com UMA nota por componente
    // (o caso real do Francisco, e a esmagadora maioria), o critério 8 acende
    // como deve. D77 é só o arranjo multi-nota com pagamento compartilhado.
    const umaNotaSo = alocar(
      [nf([ret({ quemRecolhe: "empresa" })])],
      [pag({ id: "p1", valorCentavos: 1_000, documentoIds: ["d1"] })],
    );
    expect(
      umaNotaSo.porDocumento.get("d1")?.retencaoSobrecobertaCentavos,
    ).toBe(50);
  });

  /**
   * **TESTE-TRAVA do pre-mortem 2 do ticket** — *"se o componente/soma de custo
   * for reaproveitado pelo cálculo da aferição SERO, a retenção passaria a
   * abater a base do INSS, e o parecer é explícito que isso nunca muda"*. A
   * guarda de import mora em `afericao.test.ts`; aqui fica o elo de valor: a
   * perna de retenção nunca é um `Pagamento`, então nada que varra pagamentos a
   * enxerga.
   */
  it("a perna de retenção NUNCA é um `Pagamento` (Pagamentos Efetuados intocada)", () => {
    const a = alocar(
      [nf([ret({ quemRecolhe: "empresa" })])],
      [pag({ id: "p1", valorCentavos: 950, documentoIds: ["d1"] })],
    );
    expect([...a.porPagamento.keys()]).toEqual(["p1"]);
    expect(a.componentes[0].pagamentos.map((p) => p.id)).toEqual(["p1"]);
    // Nenhum "pago sem nota" nasce da retenção.
    const semNota = [...a.porPagamento.values()].reduce(
      (s, x) => s + x.semNotaCentavos,
      0,
    );
    expect(semNota).toBe(0);
  });
});
