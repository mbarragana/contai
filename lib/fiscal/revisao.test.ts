import { describe, expect, it } from "vitest";

import {
  abrePendencia,
  agruparPorAto,
  anosAfetados,
  anosAfetadosDeUmaObra,
  anosComPendencia,
  pagamentosImpedidosDeIrJunto,
  pagamentosVinculados,
  montarPendenciasDeAno,
  pendenciasAbertasDaObra,
  resumoDesfechoMisto,
  semNotaDoAno,
  simularMoveDeObra,
  type LinhaDeAnoDaPendencia,
  composicaoDoAno,
  notasSemClassificacaoDoAno,
} from "@/lib/fiscal/revisao";
import {
  alocarCusto,
  custoComprovadoDoAno,
} from "@/lib/fiscal/vinculo";
import { formatarBRL } from "@/lib/money";
import type {
  Documento,
  Pagamento,
  PendenciaPersistente,
  Revisao,
} from "@/lib/types";

const CASA = "obra-casa";
const REFORMA = "obra-reforma";

function doc(over: Partial<Documento> & { id: string }): Documento {
  return {
    obraId: CASA,
    tipo: "nf_material",
    status: "registrado",
    valorCentavos: 940_000,
    numero: "1042",
    serie: null,
    dataEmissao: "2026-03-20",
    vencimento: null,
    classificacao: "material",
    destinatarioCpfOk: true,
    retencao11: null,
    motivoQuarentena: null,
    favorecidoId: "fav-emitente",
    favorecidoNome: "Depósito Ilha",
    favorecidoDocumento: "12345678000199",
    arquivoPath: "u/documento/nf.pdf",
    ...over,
  };
}

function pag(over: Partial<Pagamento> & { id: string }): Pagamento {
  return {
    obraId: CASA,
    valorCentavos: 600_000,
    dataPagamento: "2025-10-20",
    meio: "pix",
    status: "aguardando_nf",
    favorecidoId: "fav-deposito",
    favorecidoNome: "Depósito Ilha",
    favorecidoTipo: "pj",
    comprovantePath: "u/comprovante/pix.png",
    documentoIds: [],
    encargosCentavos: 0,
    naoExplicadoCentavos: 0,
    resolucaoDiferenca: null,
    ...over,
  };
}

/**
 * O cenário do parecer, adendo §5.2, com os números dele: NF de R$ 9.400,00 do
 * Depósito Ilha na Casa Tanheiros, PIX de R$ 6.000,00 (20/10/2025) e boleto de
 * R$ 3.400,00 (05/12/2025) ligados a ela. Reforma do apartamento vazia.
 */
function cenarioDoParecer() {
  const nota = doc({ id: "d-nf" });
  const pix = pag({ id: "p-pix", valorCentavos: 600_000, documentoIds: ["d-nf"] });
  const boleto = pag({
    id: "p-boleto",
    valorCentavos: 340_000,
    dataPagamento: "2025-12-05",
    meio: "boleto",
    documentoIds: ["d-nf"],
  });
  return {
    nota,
    pix,
    boleto,
    origem: { obraId: CASA, documentos: [nota], pagamentos: [pix, boleto] },
    destino: { obraId: REFORMA, documentos: [], pagamentos: [] },
  };
}

describe("simularMoveDeObra — o que acontece com as duas obras", () => {
  it("todos vão junto: o custo SAI de uma e ENTRA na outra, e o total se conserva", () => {
    const c = cenarioDoParecer();
    const s = simularMoveDeObra({
      documento: c.nota,
      origem: c.origem,
      destino: c.destino,
      escolhas: [
        { pagamentoId: "p-pix", desfecho: "vai_junto" },
        { pagamentoId: "p-boleto", desfecho: "vai_junto" },
      ],
    });

    // Origem: fica sem documento e sem pagamento nenhum.
    expect(s.origemDepois.documentos).toHaveLength(0);
    expect(s.origemDepois.pagamentos).toHaveLength(0);
    // Destino: recebe a nota e os dois pagamentos, com o vínculo INTACTO.
    expect(s.destinoDepois.documentos.map((d) => d.id)).toEqual(["d-nf"]);
    expect(s.destinoDepois.pagamentos.map((p) => p.documentoIds)).toEqual([
      ["d-nf"],
      ["d-nf"],
    ]);

    const antes = alocarCusto(s.origemAntes);
    const depois = alocarCusto(s.destinoDepois);
    expect(antes.componentes[0].custoComprovadoCentavos).toBe(940_000);
    expect(depois.componentes[0].custoComprovadoCentavos).toBe(940_000);
  });

  it("desfecho MISTO: o destino ganha min(6.000; 9.400) e a origem perde os 9.400", () => {
    const c = cenarioDoParecer();
    const s = simularMoveDeObra({
      documento: c.nota,
      origem: c.origem,
      destino: c.destino,
      escolhas: [
        { pagamentoId: "p-pix", desfecho: "vai_junto" },
        { pagamentoId: "p-boleto", desfecho: "fica_na_origem" },
      ],
    });

    const origemAntes = alocarCusto(s.origemAntes);
    const origemDepois = alocarCusto(s.origemDepois);
    const destinoDepois = alocarCusto(s.destinoDepois);

    // Números do parecer, ao centavo.
    expect(origemAntes.componentes[0].custoComprovadoCentavos).toBe(940_000);
    expect(destinoDepois.componentes[0].custoComprovadoCentavos).toBe(600_000);

    // O boleto fica na origem, sem nota: R$ 3.400,00 em "pago sem nota" — e
    // esse número é A VERDADE (§5.2(ii)), não perda de custo.
    expect(semNotaDoAno(origemDepois, 2025)).toBe(340_000);
    expect(semNotaDoAno(origemAntes, 2025)).toBe(0);
  });

  it("todos ficam na origem: o vínculo se desfaz e o DESTINO não ganha nada", () => {
    const c = cenarioDoParecer();
    const s = simularMoveDeObra({
      documento: c.nota,
      origem: c.origem,
      destino: c.destino,
      escolhas: [
        { pagamentoId: "p-pix", desfecho: "fica_na_origem" },
        { pagamentoId: "p-boleto", desfecho: "fica_na_origem" },
      ],
    });

    expect(s.origemDepois.pagamentos.map((p) => p.documentoIds)).toEqual([[], []]);
    // `min(0 pagamentos, 9.400) = 0` — documento sozinho comprova ZERO.
    expect(
      alocarCusto(s.destinoDepois).componentes[0].custoComprovadoCentavos,
    ).toBe(0);
  });

  it("sem pagamento ligado, nada muda em obra nenhuma (tela s8b)", () => {
    const nota = doc({ id: "d-solta" });
    const s = simularMoveDeObra({
      documento: nota,
      origem: { obraId: CASA, documentos: [nota], pagamentos: [] },
      destino: { obraId: REFORMA, documentos: [], pagamentos: [] },
      escolhas: [],
    });
    expect(anosAfetados(
      [
        {
          obraId: CASA,
          antes: alocarCusto(s.origemAntes),
          depois: alocarCusto(s.origemDepois),
        },
        {
          obraId: REFORMA,
          antes: alocarCusto(s.destinoAntes),
          depois: alocarCusto(s.destinoDepois),
        },
      ],
      2026,
    )).toEqual([]);
  });
});

describe("anosAfetados — o filtro do critério 20(c)", () => {
  it("o desfecho MISTO afeta AS DUAS obras, com o delta de cada uma", () => {
    const c = cenarioDoParecer();
    const s = simularMoveDeObra({
      documento: c.nota,
      origem: c.origem,
      destino: c.destino,
      escolhas: [
        { pagamentoId: "p-pix", desfecho: "vai_junto" },
        { pagamentoId: "p-boleto", desfecho: "fica_na_origem" },
      ],
    });

    const anos = anosAfetados(
      [
        {
          obraId: CASA,
          antes: alocarCusto(s.origemAntes),
          depois: alocarCusto(s.origemDepois),
        },
        {
          obraId: REFORMA,
          antes: alocarCusto(s.destinoAntes),
          depois: alocarCusto(s.destinoDepois),
        },
      ],
      2026,
    );

    expect(anos).toEqual([
      {
        obraId: CASA,
        ano: 2025,
        antesCentavos: 940_000,
        depoisCentavos: 0,
        pendencia: true,
      },
      {
        obraId: REFORMA,
        ano: 2025,
        antesCentavos: 0,
        depoisCentavos: 600_000,
        pendencia: true,
      },
    ]);
  });

  it("todos ficam na origem: o DESTINO não entra no conjunto de afetadas", () => {
    const c = cenarioDoParecer();
    const s = simularMoveDeObra({
      documento: c.nota,
      origem: c.origem,
      destino: c.destino,
      escolhas: [
        { pagamentoId: "p-pix", desfecho: "fica_na_origem" },
        { pagamentoId: "p-boleto", desfecho: "fica_na_origem" },
      ],
    });

    const anos = anosAfetados(
      [
        {
          obraId: CASA,
          antes: alocarCusto(s.origemAntes),
          depois: alocarCusto(s.origemDepois),
        },
        {
          obraId: REFORMA,
          antes: alocarCusto(s.destinoAntes),
          depois: alocarCusto(s.destinoDepois),
        },
      ],
      2026,
    );

    // A Reforma é CANDIDATA (`antes ∪ depois` do campo obra) e não é AFETADA:
    // nenhum número dela se mexeu. Sem este filtro, o alarme acenderia numa
    // obra onde nada mudou — contradizendo o §5.3 na frase seguinte a ela.
    expect(anos.map((a) => a.obraId)).toEqual([CASA]);
    expect(anos[0]).toMatchObject({ antesCentavos: 940_000, depoisCentavos: 0 });
  });
});

describe("abrePendencia — as três linhas da tabela do §5.3", () => {
  it("SEM pagamento vinculado: não muda número em obra nenhuma → não abre", () => {
    const nota = doc({ id: "d-solta" });
    const anos = anosAfetadosDeUmaObra(
      CASA,
      { documentos: [nota], pagamentos: [] },
      { documentos: [{ ...nota, valorCentavos: 1_200_000 }], pagamentos: [] },
      2026,
    );
    expect(anos).toEqual([]);
    expect(abrePendencia(anos)).toBe(false);
  });

  it("COM pagamento vinculado e delta em ano ANTERIOR → abre, uma por ano", () => {
    const nota = doc({ id: "d1", valorCentavos: 128_000 });
    const pagamento = pag({
      id: "p1",
      valorCentavos: 1_280_000,
      dataPagamento: "2025-11-12",
      documentoIds: ["d1"],
    });
    const anos = anosAfetadosDeUmaObra(
      CASA,
      { documentos: [nota], pagamentos: [pagamento] },
      {
        documentos: [{ ...nota, valorCentavos: 1_280_000 }],
        pagamentos: [pagamento],
      },
      2026,
    );
    expect(anos).toEqual([
      {
        obraId: CASA,
        ano: 2025,
        antesCentavos: 128_000,
        depoisCentavos: 1_280_000,
        pendencia: true,
      },
    ]);
    expect(abrePendencia(anos)).toBe(true);
    expect(anosComPendencia(anos)).toEqual([2025]);
  });

  it("COM pagamento vinculado e delta SÓ no ano corrente → não abre", () => {
    const nota = doc({ id: "d1", valorCentavos: 408_571 });
    const pagamento = pag({
      id: "p1",
      valorCentavos: 4_085_714,
      dataPagamento: "2026-08-18",
      documentoIds: ["d1"],
    });
    const anos = anosAfetadosDeUmaObra(
      CASA,
      { documentos: [nota], pagamentos: [pagamento] },
      {
        documentos: [{ ...nota, valorCentavos: 4_085_714 }],
        pagamentos: [pagamento],
      },
      2026,
    );
    // O número MUDOU — e mesmo assim não abre: o ano ainda não foi declarado,
    // e ele se corrige sozinho antes da DAA.
    expect(anos).toHaveLength(1);
    expect(anos[0].pendencia).toBe(false);
    expect(abrePendencia(anos)).toBe(false);
  });
});

describe("pagamentos vinculados e a guarda do vínculo cruzado", () => {
  it("só o pagamento ligado a ESTA nota é perguntado", () => {
    const nota = doc({ id: "d1" });
    const ligado = pag({ id: "p1", documentoIds: ["d1"] });
    const solto = pag({ id: "p2", documentoIds: [] });
    expect(
      pagamentosVinculados(nota, [ligado, solto]).map((p) => p.id),
    ).toEqual(["p1"]);
  });

  it("pagamento que comprova OUTRA nota da origem não pode ir junto", () => {
    const nota = doc({ id: "d1" });
    const duplo = pag({ id: "p1", documentoIds: ["d1", "d2"] });
    const simples = pag({ id: "p2", documentoIds: ["d1"] });
    expect(
      pagamentosImpedidosDeIrJunto(nota, [duplo, simples]).map((p) => p.id),
    ).toEqual(["p1"]);
  });
});

describe("resumoDesfechoMisto — a frase que o §5.2 exigiu", () => {
  /**
   * ⚠️ O CASO QUE A VERSÃO ANTERIOR ERRAVA, e ele é o motivo do bloqueante 1
   * do Gate 2: Σ pagamentos (12.000) **maior** que o valor da nota (9.400).
   * A frase antiga derivava a queda da partição dos pagamentos e anunciava
   * R$ 6.000,00; a queda real é R$ 3.400,00. Superestimar a queda infla o
   * alarme sobre o número da meta 1.
   *
   * Os números aqui não são digitados: saem da MESMA `alocarCusto` que
   * alimenta as duas tabelas da tela — é isso que o teste tem de provar.
   */
  function contaDoMove(valorBoletoCentavos: number) {
    const nota = doc({ id: "d-nf" });
    const pix = pag({ id: "p-pix", valorCentavos: 600_000, documentoIds: ["d-nf"] });
    const boleto = pag({
      id: "p-boleto",
      valorCentavos: valorBoletoCentavos,
      dataPagamento: "2025-12-05",
      meio: "boleto",
      documentoIds: ["d-nf"],
    });

    const s = simularMoveDeObra({
      documento: nota,
      origem: { obraId: CASA, documentos: [nota], pagamentos: [pix, boleto] },
      destino: { obraId: REFORMA, documentos: [], pagamentos: [] },
      escolhas: [
        { pagamentoId: "p-pix", desfecho: "vai_junto" },
        { pagamentoId: "p-boleto", desfecho: "fica_na_origem" },
      ],
    });

    const origemAntes = alocarCusto(s.origemAntes);
    const origemDepois = alocarCusto(s.origemDepois);
    const anos = anosAfetados(
      [
        { obraId: CASA, antes: origemAntes, depois: origemDepois },
        {
          obraId: REFORMA,
          antes: alocarCusto(s.destinoAntes),
          depois: alocarCusto(s.destinoDepois),
        },
      ],
      2026,
    );

    return {
      totalCentavos: 600_000 + valorBoletoCentavos,
      juntoCentavos: 600_000,
      ficaCentavos: valorBoletoCentavos,
      semNotaSobeCentavos:
        semNotaDoAno(origemDepois, 2025) - semNotaDoAno(origemAntes, 2025),
      quedaCentavos: anos.reduce(
        (acc, a) => acc + (a.antesCentavos - a.depoisCentavos),
        0,
      ),
      obraOrigemNome: "Casa Tanheiros",
      formatar: formatarBRL,
    };
  }

  it("Σ pagamentos MAIOR que a nota: a queda é a da alocação, não a do que ficou", () => {
    const conta = contaDoMove(600_000);
    // A partição diz 6.000; a alocação diz 3.400. É a alocação que vale.
    expect(conta.ficaCentavos).toBe(600_000);
    expect(conta.quedaCentavos).toBe(340_000);
    expect(conta.semNotaSobeCentavos).toBe(340_000);

    const texto = resumoDesfechoMisto(conta);
    expect(texto).toContain(`cai ${formatarBRL(340_000)}`);
    // ⚠️ A regressão que o Gate 2 pegou: nunca mais anunciar a queda pelo
    // valor do pagamento que ficou.
    expect(texto).not.toContain(`cai ${formatarBRL(600_000)}`);
    expect(texto).toContain(
      `o "pago sem nota" de Casa Tanheiros sobe ${formatarBRL(340_000)}`,
    );
  });

  it("caso canônico do parecer (nota cobre os pagamentos): 6.000 junto, 3.400 fica", () => {
    const conta = contaDoMove(340_000);
    const texto = resumoDesfechoMisto(conta);
    expect(texto).toContain(`Dos ${formatarBRL(940_000)} ligados a esta nota`);
    expect(texto).toContain(`${formatarBRL(600_000)} acompanham a nota`);
    expect(texto).toContain(
      `${formatarBRL(340_000)} continuam em Casa Tanheiros`,
    );
    expect(texto).toContain(`cai ${formatarBRL(340_000)}`);
    expect(texto).toContain("Isso não é perda");
    // A frase proibida pelo adendo §5.2 como afirmação geral.
    expect(texto).not.toContain("o total não muda");
  });

  it("queda ZERO não se anuncia como queda", () => {
    const texto = resumoDesfechoMisto({
      totalCentavos: 940_000,
      juntoCentavos: 600_000,
      ficaCentavos: 340_000,
      semNotaSobeCentavos: 340_000,
      quedaCentavos: 0,
      obraOrigemNome: "Casa Tanheiros",
      formatar: formatarBRL,
    });
    expect(texto).toContain(
      "o custo confirmado, somando as duas obras, não muda — esta nota já não comprovava esse valor.",
    );
    expect(texto).not.toContain("cai R$");
  });

  it('"pago sem nota" que não sobe some da frase — "sobe R$ 0,00" é o mesmo defeito com outro sinal', () => {
    const texto = resumoDesfechoMisto({
      totalCentavos: 940_000,
      juntoCentavos: 600_000,
      ficaCentavos: 340_000,
      semNotaSobeCentavos: 0,
      quedaCentavos: 340_000,
      obraOrigemNome: "Casa Tanheiros",
      formatar: formatarBRL,
    });
    expect(texto).not.toContain("pago sem nota");
    expect(texto).toContain(
      `Depois desta correção, o custo confirmado, somando as duas obras, cai ${formatarBRL(340_000)}.`,
    );
  });
});

describe("agruparPorAto — o move é UMA linha no histórico, nunca três", () => {
  function rev(over: Partial<Revisao> & { id: string; atoId: string }): Revisao {
    return {
      entidade: "documento",
      entidadeId: "d1",
      campo: "obra",
      antes: CASA,
      depois: REFORMA,
      quando: "2026-08-19T22:10:00Z",
      motivo: "arquivamento_corrigido",
      motivoTexto: null,
      anosAfetados: [],
      ...over,
    };
  }

  it("três linhas com o mesmo ato_id viram um ato só", () => {
    const atos = agruparPorAto([
      rev({ id: "r1", atoId: "ato-1" }),
      rev({ id: "r2", atoId: "ato-1", entidade: "pagamento", entidadeId: "p1" }),
      rev({
        id: "r3",
        atoId: "ato-1",
        entidade: "pagamento",
        entidadeId: "p2",
        campo: "vinculo",
        depois: null,
      }),
    ]);
    expect(atos).toHaveLength(1);
    expect(atos[0].linhas.map((l) => l.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("atos diferentes ficam separados, do mais recente para o mais antigo", () => {
    const atos = agruparPorAto([
      rev({ id: "r1", atoId: "ato-1", quando: "2026-08-12T09:12:00Z" }),
      rev({ id: "r2", atoId: "ato-2", quando: "2026-08-19T21:40:00Z" }),
    ]);
    expect(atos.map((a) => a.atoId)).toEqual(["ato-2", "ato-1"]);
  });

  it("os anos afetados do ato são a união dos anos das linhas dele", () => {
    const atos = agruparPorAto([
      rev({
        id: "r1",
        atoId: "ato-1",
        anosAfetados: [
          {
            obraId: CASA,
            ano: 2025,
            antesCentavos: 940_000,
            depoisCentavos: 0,
            pendencia: true,
          },
          {
            obraId: REFORMA,
            ano: 2025,
            antesCentavos: 0,
            depoisCentavos: 600_000,
            pendencia: true,
          },
        ],
      }),
    ]);
    expect(atos[0].anosAfetados.map((a) => a.obraId)).toEqual([CASA, REFORMA]);
  });
});

describe("montarPendenciasDeAno — o acumulado do ano (critério 20a)", () => {
  const P = "pend-2025";

  function pendencia(over: Partial<PendenciaPersistente> = {}): PendenciaPersistente {
    return {
      id: P,
      tipo: "retificadora_possivel",
      ano: 2025,
      documentoId: null,
      abertaEm: "2026-08-12T09:12:00Z",
      desfecho: null,
      ...over,
    };
  }

  function linha(
    revisaoId: string,
    obraId: string,
    antes: number,
    depois: number,
  ): LinhaDeAnoDaPendencia {
    return {
      pendenciaId: P,
      revisaoId,
      ano: {
        obraId,
        ano: 2025,
        antesCentavos: antes,
        depoisCentavos: depois,
        pendencia: true,
      },
    };
  }

  function revisao(id: string, atoId: string, quando: string): Revisao {
    return {
      id,
      atoId,
      entidade: "documento",
      entidadeId: "d1",
      campo: "valor",
      antes: null,
      depois: "1",
      quando,
      motivo: "erro_de_digitacao_minha",
      motivoTexto: null,
      anosAfetados: [],
    };
  }

  it("três correções no mesmo ano viram UMA linha, do primeiro antes ao último depois", () => {
    const montadas = montarPendenciasDeAno({
      pendencias: [pendencia()],
      linhas: [
        linha("r1", CASA, 1_240_000, 2_392_000),
        linha("r2", CASA, 2_392_000, 3_015_000),
        linha("r3", CASA, 3_015_000, 3_115_000),
      ],
      revisoes: [
        revisao("r1", "ato-1", "2026-08-12T09:12:00Z"),
        revisao("r2", "ato-2", "2026-08-15T20:03:00Z"),
        revisao("r3", "ato-3", "2026-08-19T21:40:00Z"),
      ],
    });

    expect(montadas).toHaveLength(1);
    expect(montadas[0].quantidadeDeAtos).toBe(3);
    // Os números do mock s7c: R$ 12.400,00 → R$ 31.150,00.
    expect(montadas[0].obras).toEqual([
      { obraId: CASA, antesCentavos: 1_240_000, depoisCentavos: 3_115_000 },
    ]);
    expect(montadas[0].ultimaCorrecaoEm).toBe("2026-08-19T21:40:00Z");
  });

  it("a ordem de chegada das linhas não muda o acumulado", () => {
    const embaralhado = montarPendenciasDeAno({
      pendencias: [pendencia()],
      linhas: [
        linha("r3", CASA, 3_015_000, 3_115_000),
        linha("r1", CASA, 1_240_000, 2_392_000),
        linha("r2", CASA, 2_392_000, 3_015_000),
      ],
      revisoes: [
        revisao("r1", "ato-1", "2026-08-12T09:12:00Z"),
        revisao("r2", "ato-2", "2026-08-15T20:03:00Z"),
        revisao("r3", "ato-3", "2026-08-19T21:40:00Z"),
      ],
    });
    expect(embaralhado[0].obras[0]).toEqual({
      obraId: CASA,
      antesCentavos: 1_240_000,
      depoisCentavos: 3_115_000,
    });
  });

  it("um MOVE com dois pagamentos conta como UM ato, e atinge as duas obras", () => {
    const montadas = montarPendenciasDeAno({
      pendencias: [pendencia()],
      linhas: [
        linha("r-doc", CASA, 3_115_000, 2_175_000),
        linha("r-doc", REFORMA, 0, 940_000),
      ],
      // As três linhas do banco compartilham o `ato_id` — na tela é um ato só.
      revisoes: [
        revisao("r-doc", "ato-move", "2026-08-19T22:10:00Z"),
        revisao("r-pag1", "ato-move", "2026-08-19T22:10:00Z"),
        revisao("r-pag2", "ato-move", "2026-08-19T22:10:00Z"),
      ],
    });
    expect(montadas[0].quantidadeDeAtos).toBe(1);
    expect(montadas[0].obras.map((o) => o.obraId).sort()).toEqual(
      [CASA, REFORMA].sort(),
    );
  });

  it("baixada sai da lista da obra, e continua existindo no histórico", () => {
    const montadas = montarPendenciasDeAno({
      pendencias: [
        pendencia({
          desfecho: {
            desfecho: "retifiquei_a_daa",
            dataInformada: "2026-08-18",
            baixadaEm: "2026-08-19T21:55:00Z",
          },
        }),
      ],
      linhas: [linha("r1", CASA, 1_240_000, 3_115_000)],
      revisoes: [revisao("r1", "ato-1", "2026-08-12T09:12:00Z")],
    });

    expect(montadas).toHaveLength(1);
    expect(pendenciasAbertasDaObra(montadas, CASA)).toEqual([]);
  });

  it("uma pendência NOVA depois da baixa não reabre a antiga", () => {
    const montadas = montarPendenciasDeAno({
      pendencias: [
        pendencia({
          desfecho: {
            desfecho: "retifiquei_a_daa",
            dataInformada: "2026-08-18",
            baixadaEm: "2026-08-19T21:55:00Z",
          },
        }),
        pendencia({ id: "pend-nova", abertaEm: "2026-09-02T10:00:00Z" }),
      ],
      linhas: [
        linha("r1", CASA, 1_240_000, 3_115_000),
        {
          pendenciaId: "pend-nova",
          revisaoId: "r4",
          ano: {
            obraId: CASA,
            ano: 2025,
            // ⚠️ O "antes" da nova é o número em que a anterior PAROU: a conta
            // não recomeça do zero e não repete o que já foi tratado.
            antesCentavos: 3_115_000,
            depoisCentavos: 3_340_000,
            pendencia: true,
          },
        },
      ],
      revisoes: [
        revisao("r1", "ato-1", "2026-08-12T09:12:00Z"),
        revisao("r4", "ato-4", "2026-09-02T10:00:00Z"),
      ],
    });

    const abertas = pendenciasAbertasDaObra(montadas, CASA);
    expect(abertas).toHaveLength(1);
    expect(abertas[0].id).toBe("pend-nova");
    expect(abertas[0].obras[0].antesCentavos).toBe(3_115_000);
  });

  it("a pendência de CNPJ errado não entra na lista de ANO — a chave dela é o documento", () => {
    const montadas = montarPendenciasDeAno({
      pendencias: [
        {
          id: "pend-cnpj",
          tipo: "emitente_errado",
          ano: null,
          documentoId: "d1",
          abertaEm: "2026-08-19T00:00:00Z",
          desfecho: null,
        },
      ],
      linhas: [],
      revisoes: [],
    });
    expect(montadas).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════
// COMPOSIÇÃO DO ANO — material × mão de obra
//
// Regra fiscal com parecer próprio:
// `docs/pareceres/2026-08-24-composicao-material-mao-de-obra.md`.
// Ela nasceu no Gate 1 do CONTAI-036: o Bloco A da discriminação pede
// *"sendo R$ X em materiais e R$ Y em mão de obra e serviços"*, e NÃO HAVIA
// regra para cruzar os dois eixos — o regime de caixa fixa o ANO pela data do
// pagamento; material × mão de obra é atributo do DOCUMENTO.
// ════════════════════════════════════════════════════════════════════════

describe("composicaoDoAno — parecer de 2026-08-24", () => {
  const material = (id: string, valorCentavos: number) =>
    doc({ id, valorCentavos, tipo: "nf_material", classificacao: "material" });
  const servico = (id: string, valorCentavos: number) =>
    doc({ id, valorCentavos, tipo: "nf_servico", classificacao: "mao_obra" });

  it("componente HOMOGÊNEO devolve o número exato, não uma convenção", () => {
    // §2.2: no caso normal — fornecedor de material de um lado, empreiteiro do
    // outro — a regra é exata. A convenção só age no cruzamento emaranhado.
    const nota = material("d1", 100_000);
    const p = pag({
      id: "p1",
      valorCentavos: 100_000,
      dataPagamento: "2026-04-10",
      documentoIds: ["d1"],
    });
    const c = composicaoDoAno(alocarCusto({ documentos: [nota], pagamentos: [p] }), 2026);
    expect(c).toEqual({
      materialCentavos: 100_000,
      maoObraCentavos: 0,
      semClassificacaoCentavos: 0,
      totalCentavos: 100_000,
    });
  });

  it("componente emaranhado reparte pro rata pelo valor INTEGRAL das notas", () => {
    // Duas notas no mesmo conjunto conexo, 60/40, e um pagamento que cobre
    // tudo. A proporção é a do CONJUNTO DE NOTAS — nunca `cobertoCentavos`,
    // que é distribuído por ordem de id e o código declara sem efeito fiscal.
    const m = material("d1", 60_000);
    const s = servico("d2", 40_000);
    const p = pag({
      id: "p1",
      valorCentavos: 100_000,
      dataPagamento: "2026-04-10",
      documentoIds: ["d1", "d2"],
    });
    const c = composicaoDoAno(alocarCusto({ documentos: [m, s], pagamentos: [p] }), 2026);
    expect(c.materialCentavos).toBe(60_000);
    expect(c.maoObraCentavos).toBe(40_000);
    expect(c.totalCentavos).toBe(100_000);
  });

  it("⚠️ SUBCOBERTO — o denominador continua sendo o conjunto de notas", () => {
    // Σ pagamentos (50.000) < Σ hábeis (100.000). A proporção NÃO passa a ser
    // "qual nota o id cobriu": permanece 60/40, do conjunto. É o §0 do
    // parecer, o defeito vivo que esta regra corrige na raiz.
    const m = material("d1", 60_000);
    const s = servico("d2", 40_000);
    const p = pag({
      id: "p1",
      valorCentavos: 50_000,
      dataPagamento: "2026-04-10",
      documentoIds: ["d1", "d2"],
    });
    const c = composicaoDoAno(alocarCusto({ documentos: [m, s], pagamentos: [p] }), 2026);
    expect(c.materialCentavos).toBe(30_000);
    expect(c.maoObraCentavos).toBe(20_000);
    expect(c.totalCentavos).toBe(50_000);
  });

  it("⚠️ a proporção é UNIFORME entre os pagamentos do componente, mesmo cruzando anos", () => {
    // Consequência aritmética do §1, e é ela que faz o gatilho do §4.1
    // coincidir nas duas formulações: massa não classificada não "fica em
    // outro ano" dentro do mesmo componente.
    const m = material("d1", 60_000);
    const s = servico("d2", 40_000);
    const p2025 = pag({
      id: "p1",
      valorCentavos: 40_000,
      dataPagamento: "2025-12-20",
      documentoIds: ["d1", "d2"],
    });
    const p2026 = pag({
      id: "p2",
      valorCentavos: 60_000,
      dataPagamento: "2026-01-05",
      documentoIds: ["d1", "d2"],
    });
    const a = alocarCusto({ documentos: [m, s], pagamentos: [p2025, p2026] });
    const de2025 = composicaoDoAno(a, 2025);
    const de2026 = composicaoDoAno(a, 2026);
    expect(de2025.materialCentavos / de2025.totalCentavos).toBeCloseTo(0.6, 10);
    expect(de2026.materialCentavos / de2026.totalCentavos).toBeCloseTo(0.6, 10);
    // E o TOTAL de cada ano continua o cronológico, intocado (§2.3).
    expect(de2025.totalCentavos).toBe(custoComprovadoDoAno(a, 2025));
    expect(de2026.totalCentavos).toBe(custoComprovadoDoAno(a, 2026));
  });

  it("⚠️ §3 — X + Y ≡ total ao centavo, com resíduo em MÃO DE OBRA", () => {
    // Um terço não é redondo: 100 centavos repartidos 1/3 × 2/3. A palavra
    // "sendo" afirma uma partição — partição que não fecha se contradiz
    // dentro do corpo da DAA.
    const m = material("d1", 1);
    const s = servico("d2", 2);
    const p = pag({
      id: "p1",
      valorCentavos: 3,
      dataPagamento: "2026-04-10",
      documentoIds: ["d1", "d2"],
    });
    const a = alocarCusto({ documentos: [m, s], pagamentos: [p] });
    const c = composicaoDoAno(a, 2026);
    expect(c.materialCentavos + c.maoObraCentavos).toBe(c.totalCentavos);
    expect(c.totalCentavos).toBe(custoComprovadoDoAno(a, 2026));

    // E o resíduo é FIXO, não sorteado: 10 centavos em 1/3 × 2/3 dá 3,33 e
    // 6,66 — o centavo que sobra vai para mão de obra e serviços.
    const dez = pag({
      id: "p2",
      valorCentavos: 10,
      dataPagamento: "2026-04-10",
      documentoIds: ["d3", "d4"],
    });
    const c2 = composicaoDoAno(
      alocarCusto({
        documentos: [material("d3", 10), servico("d4", 20)],
        pagamentos: [dez],
      }),
      2026,
    );
    expect(c2).toEqual({
      materialCentavos: 3,
      maoObraCentavos: 7,
      semClassificacaoCentavos: 0,
      totalCentavos: 10,
    });
  });

  it("⚠️ §4 — documento hábil SEM classificação cai no balde próprio", () => {
    // Nunca empurrado para material nem para mão de obra: seria DEFAULT EM
    // CAMPO FISCAL, e campo vazio pergunta. Quem consome suspende a cláusula.
    const semClasse = doc({ id: "d1", valorCentavos: 50_000, classificacao: null });
    const s = servico("d2", 50_000);
    const p = pag({
      id: "p1",
      valorCentavos: 100_000,
      dataPagamento: "2026-04-10",
      documentoIds: ["d1", "d2"],
    });
    const c = composicaoDoAno(alocarCusto({ documentos: [semClasse, s], pagamentos: [p] }), 2026);
    expect(c.semClassificacaoCentavos).toBe(50_000);
    expect(c.materialCentavos).toBe(0);
    expect(c.maoObraCentavos).toBe(50_000);
  });

  it("⚠️ §4.1 — componente que não contribui com o ano NÃO suspende a cláusula", () => {
    // "Alarme sem consequência ensina a ignorar alarme." Um componente com
    // nota sem classificação, cujos pagamentos caem TODOS em outro ano, não
    // toca o número deste ano e não pode suspender a frase dele.
    const outroAno = pag({
      id: "p-2024",
      valorCentavos: 50_000,
      dataPagamento: "2024-05-05",
      documentoIds: ["d-sem"],
    });
    const doAno = pag({
      id: "p-2026",
      valorCentavos: 30_000,
      dataPagamento: "2026-05-05",
      documentoIds: ["d-mat"],
    });
    const c = composicaoDoAno(
      alocarCusto({
        documentos: [
          doc({ id: "d-sem", valorCentavos: 50_000, classificacao: null }),
          material("d-mat", 30_000),
        ],
        pagamentos: [outroAno, doAno],
      }),
      2026,
    );
    expect(c.semClassificacaoCentavos).toBe(0);
    expect(c.materialCentavos).toBe(30_000);
  });

  it("documento NÃO hábil não entra no denominador nem no numerador", () => {
    // Quarentena e boleto não são documentação hábil: não compõem custo e não
    // podem influenciar a proporção de quem compõe.
    const quarentena = doc({
      id: "d-q",
      valorCentavos: 90_000,
      status: "quarentena",
      destinatarioCpfOk: false,
      motivoQuarentena: "CPF do destinatário não é o do dono",
      classificacao: "mao_obra",
    });
    const m = material("d1", 40_000);
    const p = pag({
      id: "p1",
      valorCentavos: 40_000,
      dataPagamento: "2026-04-10",
      documentoIds: ["d1", "d-q"],
    });
    const c = composicaoDoAno(
      alocarCusto({ documentos: [m, quarentena], pagamentos: [p] }),
      2026,
    );
    expect(c.materialCentavos).toBe(40_000);
    expect(c.maoObraCentavos).toBe(0);
  });

  it("⛔ notasSemClassificacaoDoAno sai do MESMO laço — coberto zero também conta", () => {
    // O defeito do Gate 2: contar por `cobertoCentavos > 0` varrendo o acervo.
    // O lado do documento é repartido por ORDEM DE ID, declarada sem efeito
    // fiscal — num componente subcoberto a nota sem classificação de id maior
    // recebe coberto ZERO e sumia da contagem, enquanto SUSPENDIA a cláusula.
    const a = doc({ id: "a-mat", valorCentavos: 100_000, classificacao: "material" });
    const b = doc({ id: "b-sem", valorCentavos: 100_000, classificacao: null });
    const p = pag({
      id: "p1",
      valorCentavos: 100_000,
      dataPagamento: "2026-04-10",
      documentoIds: ["a-mat", "b-sem"],
    });
    const alocacao = alocarCusto({ documentos: [a, b], pagamentos: [p] });
    expect(alocacao.porDocumento.get("b-sem")!.cobertoCentavos).toBe(0);
    expect(notasSemClassificacaoDoAno(alocacao, 2026).map((d) => d.id)).toEqual([
      "b-sem",
    ]);
    // E o que ela conta é exatamente o que suspende a cláusula.
    expect(composicaoDoAno(alocacao, 2026).semClassificacaoCentavos).toBeGreaterThan(0);
  });

  it("⛔ nota de componente que não pôs centavo no ano fica FORA da contagem", () => {
    const outroAno = pag({
      id: "p-2024",
      valorCentavos: 50_000,
      dataPagamento: "2024-05-05",
      documentoIds: ["d-sem-2024"],
    });
    const doAno = pag({
      id: "p-2026",
      valorCentavos: 30_000,
      dataPagamento: "2026-05-05",
      documentoIds: ["d-sem-2026"],
    });
    const alocacao = alocarCusto({
      documentos: [
        doc({ id: "d-sem-2024", valorCentavos: 50_000, classificacao: null }),
        doc({ id: "d-sem-2026", valorCentavos: 30_000, classificacao: null }),
      ],
      pagamentos: [outroAno, doAno],
    });
    expect(notasSemClassificacaoDoAno(alocacao, 2026).map((d) => d.id)).toEqual([
      "d-sem-2026",
    ]);
    // Documento NÃO hábil nunca entra: não compõe custo e não suspende nada.
    const comBoleto = alocarCusto({
      documentos: [
        doc({ id: "d-bol", tipo: "boleto", valorCentavos: 10_000, classificacao: null }),
      ],
      pagamentos: [
        pag({ id: "p-b", valorCentavos: 10_000, dataPagamento: "2026-05-05", documentoIds: ["d-bol"] }),
      ],
    });
    expect(notasSemClassificacaoDoAno(comBoleto, 2026)).toEqual([]);
  });

  it("ano sem custo comprovado nenhum devolve tudo zerado", () => {
    const c = composicaoDoAno(alocarCusto({ documentos: [], pagamentos: [] }), 2026);
    expect(c).toEqual({
      materialCentavos: 0,
      maoObraCentavos: 0,
      semClassificacaoCentavos: 0,
      totalCentavos: 0,
    });
  });
});
