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
} from "@/lib/fiscal/revisao";
import { alocarCusto } from "@/lib/fiscal/vinculo";
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
  it("narra a queda e NÃO diz que o total não muda", () => {
    const texto = resumoDesfechoMisto({
      totalCentavos: 940_000,
      juntoCentavos: 600_000,
      ficaCentavos: 340_000,
      obraOrigemNome: "Casa Tanheiros",
      formatar: formatarBRL,
    });
    // ⚠️ `formatarBRL` usa ESPAÇO NÃO SEPARÁVEL depois do "R$" (Intl, pt-BR).
    // Escrever "R$ 9.400,00" à mão no teste falha por um caractere invisível —
    // por isso o esperado sai do próprio formatador.
    const total = formatarBRL(940_000);
    const junto = formatarBRL(600_000);
    const fica = formatarBRL(340_000);
    expect(texto).toContain(`Dos ${total}`);
    expect(texto).toContain(`${junto} acompanham a nota`);
    expect(texto).toContain(`${fica} voltam a "pago sem nota" em Casa Tanheiros`);
    expect(texto).toContain(`cai ${fica}`);
    expect(texto).toContain("Isso não é perda");
    // A frase proibida pelo adendo §5.2 como afirmação geral.
    expect(texto).not.toContain("o total não muda");
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
