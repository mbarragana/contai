import { describe, expect, it } from "vitest";

import { gravidadeDaRegua } from "@/lib/fiscal/gravidade";
import {
  FAMILIAS_DE_PENDENCIA,
  unificarPendencias,
  type EntradaPendenciasUnificadas,
  type FamiliaDePendencia,
} from "@/lib/fiscal/pendencias-unificadas";
import type {
  Pendencia,
  ResumoObra,
  TipoPendencia,
} from "@/lib/fiscal/resumo";
import type { Obra, PendenciaPersistente, Revisao } from "@/lib/types";

/**
 * **O coração fiscal do CONTAI-042.**
 *
 * O que esta suíte protege não é a montagem de uma lista — é a promessa de que
 * **nenhuma família de pendência some**. O defeito que o ticket veio matar
 * (**D46/D47**, e a **D59** como sintoma) é sempre o mesmo: uma família some de
 * uma superfície e ninguém percebe, porque nenhum lugar as enumerava juntas.
 * Por isso o teste central é *"o cenário que acende as dezoito produz dezoito
 * famílias"*, e não *"a função devolve uma lista"*.
 */

const OBRA_COM_CNO: Obra = {
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

const OBRA_SEM_CNO: Obra = { ...OBRA_COM_CNO, cno: null, cnoRegistradoEm: null };

const VERMELHA = gravidadeDaRegua({
  dinheiroSaiu: true,
  apoioHabilNoAnoCerto: false,
});
const AMBAR = gravidadeDaRegua({
  dinheiroSaiu: false,
  apoioHabilNoAnoCerto: false,
});

function derivada(tipo: TipoPendencia, over: Partial<Pendencia> = {}): Pendencia {
  return {
    id: `${tipo}:1`,
    tipo,
    chip: "chip",
    titulo: "titulo",
    detalhe: "detalhe",
    valorCentavos: 1_000_00,
    consequencia: "consequencia",
    gravidade: VERMELHA,
    ...over,
  };
}

/** Um `ResumoObra` com tudo vazio — cada teste acende só o que precisa. */
function resumo(over: Partial<ResumoObra> = {}): ResumoObra {
  return {
    ano: 2026,
    custoConfirmadoAnoCentavos: 0,
    acumuladoImovelCentavos: 0,
    gastoRealComPendentesCentavos: 0,
    custoEmRiscoIr: {
      totalCentavos: 0,
      pagosSemNotaCentavos: 0,
      notaForaDoCpfCentavos: 0,
      pagosSemComprovanteCentavos: 0,
    },
    exposicaoInssBaseCentavos: 0,
    pendencias: [],
    terrenoSemData: [],
    terrenoMaisDeUmaData: [],
    terrenoPagoSemComprovante: null,
    documentosSemArquivo: null,
    vinculosCruzandoObras: [],
    terrenoForaDoAcumuladoCentavos: 0,
    financiamentoAguardandoInforme: null,
    financiamentoFaltaLancar: [],
    terrenoSemRegistro: null,
    notasSemPagamento: [],
    notasSemPagamentoCentavos: 0,
    despesas: [],
    temRegistro: false,
    alocacao: {
      componentes: [],
      porPagamento: new Map(),
      porDocumento: new Map(),
      porRetencao: new Map(),
      vinculosOrfaos: [],
    },
    ...over,
  };
}

const PAINEL_VAZIO: EntradaPendenciasUnificadas["painel"] = {
  pendencias: [],
  linhas: [],
  revisoes: [],
  vinculos: [],
};

const CORRECAO: PendenciaPersistente = {
  id: "pend-correcao",
  tipo: "retificadora_possivel",
  ano: 2025,
  documentoId: null,
  abertaEm: "2026-03-02T10:00:00Z",
  desfecho: null,
};

const EMITENTE: PendenciaPersistente = {
  id: "pend-emitente",
  tipo: "emitente_errado",
  ano: null,
  documentoId: "doc-1",
  abertaEm: "2026-04-05T10:00:00Z",
  desfecho: null,
};

const REVISAO: Revisao = {
  id: "rev-1",
  atoId: "ato-1",
  entidade: "documento",
  entidadeId: "doc-9",
  campo: "obra",
  antes: "obra-2",
  depois: "obra-1",
  quando: "2026-03-02T10:00:00Z",
  motivo: "erro_de_digitacao_minha",
  motivoTexto: null,
  anosAfetados: [],
};

const PAINEL_COM_PERSISTENTES: EntradaPendenciasUnificadas["painel"] = {
  pendencias: [CORRECAO, EMITENTE],
  linhas: [
    {
      pendenciaId: CORRECAO.id,
      revisaoId: REVISAO.id,
      ano: {
        obraId: "obra-1",
        ano: 2025,
        antesCentavos: 10_000_00,
        depoisCentavos: 12_000_00,
        pendencia: true,
      },
    },
  ],
  revisoes: [REVISAO],
  vinculos: [],
};

/**
 * O cenário que acende **as dezoito ao mesmo tempo**. É deliberadamente
 * irrealista: uma obra não fica assim. Ele existe para uma coisa só — provar
 * que a fila não perde nenhuma família pelo caminho.
 */
function tudoAceso(): EntradaPendenciasUnificadas {
  const sete: TipoPendencia[] = [
    "quarentena",
    "boleto_sem_nf",
    "pago_sem_nota",
    "diferenca_sem_explicacao",
    "pago_sem_comprovante",
    "retencao_sem_recolhedor",
    "nf_servico_sem_cno",
  ];
  return {
    obra: OBRA_SEM_CNO,
    anoCorrente: 2026,
    painel: PAINEL_COM_PERSISTENTES,
    resumo: resumo({
      pendencias: sete.map((t) => derivada(t)),
      vinculosCruzandoObras: [
        { pagamentoId: "pg-1", documentoId: "doc-2", href: "/pagamento/pg-1" },
      ],
      terrenoPagoSemComprovante: {
        totalCentavos: 50_000_00,
        quantidade: 2,
        href: "/obras/obra-1/terreno/desembolsos",
      },
      documentosSemArquivo: {
        quantidade: 3,
        totalCentavos: 9_000_00,
        href: null,
      },
      terrenoSemData: [
        {
          id: "terreno-sem-data:t1",
          titulo: "ITBI — falta a data",
          valorCentavos: 4_000_00,
          consequencia: "consequencia",
          href: "/obras/obra-1/terreno/desembolsos",
        },
      ],
      terrenoMaisDeUmaData: [
        {
          id: "terreno-mais-de-uma-data:t2",
          titulo: "Entrada do terreno",
          valorCentavos: 80_000_00,
          href: "/obras/obra-1/terreno",
        },
      ],
      financiamentoFaltaLancar: [
        {
          ano: 2025,
          aviso: "aviso",
          href: "/obras/obra-1/terreno/informe/2025",
          gravidade: VERMELHA,
        },
      ],
      terrenoSemRegistro: {
        terrenoNoAcumuladoCentavos: 0,
        aviso: "aviso",
        href: "/obras/obra-1/terreno",
      },
      financiamentoAguardandoInforme: {
        ano: 2026,
        estimativaCentavos: null,
        aviso: "aviso",
        sobreAEstimativa: "sobre",
        href: "/obras/obra-1/terreno",
      },
      // ⚠️ Os dois que NÃO são pendência entram no cenário de propósito: é
      // assim que o teste prova que eles ficam de fora.
      notasSemPagamento: [
        {
          id: "nota-1",
          titulo: "NF 123",
          detalhe: "Madeireira",
          valorCentavos: 3_000_00,
          href: "/documento/nota-1",
        },
      ],
      notasSemPagamentoCentavos: 3_000_00,
      despesas: [
        {
          id: "desp-1",
          titulo: "NF 9 + PIX",
          detalhe: "Elétrica",
          valorCentavos: 2_000_00,
          noAnoCentavos: 2_000_00,
          href: "/documento/desp-1",
        },
      ],
    }),
  };
}

describe("a lista fechada das 18 famílias", () => {
  it("tem exatamente 18 nomes, sem repetição", () => {
    expect(FAMILIAS_DE_PENDENCIA).toHaveLength(18);
    expect(new Set(FAMILIAS_DE_PENDENCIA).size).toBe(18);
  });

  /**
   * ⚠️ **O teste que o ticket existe para ter.** Se alguém acrescentar uma
   * família ao sistema e esquecer de ligá-la à fila, este teste fica vermelho
   * com o nome dela — em vez de a pendência sumir em silêncio, que é a D47.
   */
  it("o cenário que acende as 18 produz as 18, cada uma uma vez", () => {
    const { itens } = unificarPendencias(tudoAceso());
    const familias = itens.map((i) => i.familia);
    expect(new Set(familias).size).toBe(18);
    for (const f of FAMILIAS_DE_PENDENCIA) {
      expect(familias, `a família ${f} sumiu da fila`).toContain(f);
    }
  });

  it("nenhum item chega sem bloco declarado", () => {
    const { itens } = unificarPendencias(tudoAceso());
    for (const i of itens) {
      expect(["vermelho", "ambar", "informativo"]).toContain(i.bloco);
    }
  });
});

describe("o que NÃO é pendência fica de fora", () => {
  /**
   * Parecer §5.2, o terceiro estado: nota hábil registrada e ainda não paga não
   * é dispêndio nenhum. Somá-la às pendências inflaria a exposição — e ela
   * continua no painel da home até o CONTAI-041 lhe dar casa própria.
   */
  it("`notasSemPagamento` não vira item da fila", () => {
    const { itens } = unificarPendencias({
      obra: OBRA_COM_CNO,
      anoCorrente: 2026,
      painel: PAINEL_VAZIO,
      resumo: resumo({
        notasSemPagamento: [
          {
            id: "nota-1",
            titulo: "NF 123",
            detalhe: "Madeireira",
            valorCentavos: 3_000_00,
            href: "/documento/nota-1",
          },
        ],
        notasSemPagamentoCentavos: 3_000_00,
      }),
    });
    expect(itens).toEqual([]);
  });

  it("`despesas` (custo comprovado) não vira item da fila", () => {
    const { itens } = unificarPendencias({
      obra: OBRA_COM_CNO,
      anoCorrente: 2026,
      painel: PAINEL_VAZIO,
      resumo: resumo({
        despesas: [
          {
            id: "desp-1",
            titulo: "NF 9 + PIX",
            detalhe: "Elétrica",
            valorCentavos: 2_000_00,
            noAnoCentavos: 2_000_00,
            href: "/documento/desp-1",
          },
        ],
      }),
    });
    expect(itens).toEqual([]);
  });

  /**
   * Pre-mortem 3 do ticket e a lição do `emPendenciaCentavos` morto no
   * CONTAI-005: quatro moedas diferentes num número só não corresponde a linha
   * de declaração nenhuma. A saída **não tem campo de valor** — nem total, nem
   * por grupo.
   */
  it("a saída não carrega soma de valor nenhuma", () => {
    const saida = unificarPendencias(tudoAceso());
    expect(Object.keys(saida).sort()).toEqual([
      "abertas",
      "ambares",
      "avisos",
      "baixadas",
      "itens",
      "vermelhas",
    ]);
  });
});

describe("a ordem da fila", () => {
  it("vermelhas, depois âmbares, depois o informativo", () => {
    const { itens } = unificarPendencias(tudoAceso());
    const blocos = itens.map((i) => i.bloco);
    const ordenados = [...blocos].sort(
      (a, b) =>
        ["vermelho", "ambar", "informativo"].indexOf(a) -
        ["vermelho", "ambar", "informativo"].indexOf(b),
    );
    expect(blocos).toEqual(ordenados);
    expect(blocos[blocos.length - 1]).toBe("informativo");
  });

  /**
   * Gate Fiscal §4: prazo legal de 30 dias correndo contra um terceiro, dano
   * que acumula por nota, e a **única pendência do app que impede a venda**.
   * Quem reordenar isto por estética está desfazendo adjudicação do `contador`.
   */
  it("a pendência de CNO abre a fila", () => {
    const { itens } = unificarPendencias(tudoAceso());
    expect(itens[0]?.familia).toBe("cno");
  });

  /**
   * Gate Fiscal §4: a correção de ano anterior significa que uma DAA
   * possivelmente já entregue não corresponde mais ao acervo — relógio externo
   * e terceiro no caminho. A derivada do ano corrente ainda é corrigível antes
   * de qualquer declaração existir.
   */
  it("a correção de ano anterior vem antes das derivadas vermelhas", () => {
    const { itens } = unificarPendencias(tudoAceso());
    const familias = itens.map((i) => i.familia);
    expect(familias.indexOf("correcao_ano_anterior")).toBeLessThan(
      familias.indexOf("quarentena"),
    );
  });

  it("a ordem entre famílias é a declarada, não a de inserção", () => {
    const { itens } = unificarPendencias(tudoAceso());
    const vermelhas = itens
      .filter((i) => i.bloco === "vermelho")
      .map((i) => i.familia);
    const posicao = (f: FamiliaDePendencia) =>
      FAMILIAS_DE_PENDENCIA.indexOf(f);
    for (let i = 1; i < vermelhas.length; i++) {
      expect(posicao(vermelhas[i]!)).toBeGreaterThanOrEqual(
        posicao(vermelhas[i - 1]!),
      );
    }
  });

  /** Dentro da mesma família, a ordem de origem (a de `calcularResumo`). */
  it("a ordenação é estável dentro da mesma família", () => {
    const { itens } = unificarPendencias({
      obra: OBRA_COM_CNO,
      anoCorrente: 2026,
      painel: PAINEL_VAZIO,
      resumo: resumo({
        pendencias: [
          derivada("quarentena", { id: "quarentena:a" }),
          derivada("quarentena", { id: "quarentena:b" }),
          derivada("quarentena", { id: "quarentena:c" }),
        ],
      }),
    });
    expect(itens.map((i) => i.id)).toEqual([
      "quarentena:a",
      "quarentena:b",
      "quarentena:c",
    ]);
  });

  /**
   * ⚠️ Sem teto, sem "ver todos (N)": a régua de cor só governa risco se a
   * lista inteira estiver visível (Gate Fiscal §4a).
   */
  it("nada é truncado — 40 vermelhas saem 40", () => {
    const { itens, vermelhas } = unificarPendencias({
      obra: OBRA_COM_CNO,
      anoCorrente: 2026,
      painel: PAINEL_VAZIO,
      resumo: resumo({
        pendencias: Array.from({ length: 40 }, (_, i) =>
          derivada("pago_sem_nota", { id: `pago-sem-nota:${i}` }),
        ),
      }),
    });
    expect(itens).toHaveLength(40);
    expect(vermelhas).toBe(40);
  });
});

describe("a contagem que o badge do CONTAI-040 consome", () => {
  it("abertas = vermelhas + âmbares, e o informativo fica fora", () => {
    const saida = unificarPendencias({
      obra: OBRA_COM_CNO,
      anoCorrente: 2026,
      painel: PAINEL_VAZIO,
      resumo: resumo({
        pendencias: [
          derivada("quarentena"),
          derivada("nf_servico_sem_cno", {
            id: "sem-cno:1",
            gravidade: AMBAR,
          }),
        ],
        financiamentoAguardandoInforme: {
          ano: 2026,
          estimativaCentavos: null,
          aviso: "aviso",
          sobreAEstimativa: "sobre",
          href: "/obras/obra-1/terreno",
        },
      }),
    });
    expect(saida.vermelhas).toBe(1);
    expect(saida.ambares).toBe(1);
    expect(saida.avisos).toBe(1);
    expect(saida.abertas).toBe(2);
    // ⚠️ Fora da contagem, **dentro** da lista: aviso que não cobra nada não
    // entra no badge, mas some da tela é outra coisa.
    expect(saida.itens).toHaveLength(3);
  });

  /**
   * Os agregados contam **1**, como a linha que são: o card de "nota sem
   * arquivo" com 3 documentos é uma linha da fila.
   */
  it("agregado conta 1, e não a quantidade que ele resume", () => {
    const saida = unificarPendencias({
      obra: OBRA_COM_CNO,
      anoCorrente: 2026,
      painel: PAINEL_VAZIO,
      resumo: resumo({
        documentosSemArquivo: {
          quantidade: 3,
          totalCentavos: 9_000_00,
          href: null,
        },
      }),
    });
    expect(saida.abertas).toBe(1);
  });
});

describe("as persistentes", () => {
  it("só as ABERTAS entram na fila; as baixadas vão para o histórico", () => {
    const baixada: PendenciaPersistente = {
      ...EMITENTE,
      id: "pend-emitente-baixada",
      desfecho: {
        desfecho: "cnpj_gravado_esta_certo",
        dataInformada: null,
        baixadaEm: "2026-05-01T10:00:00Z",
      },
    };
    const saida = unificarPendencias({
      obra: OBRA_COM_CNO,
      anoCorrente: 2026,
      resumo: resumo(),
      painel: { ...PAINEL_COM_PERSISTENTES, pendencias: [EMITENTE, baixada] },
    });
    expect(saida.itens.map((i) => i.id)).toEqual([EMITENTE.id]);
    expect(saida.baixadas.emitente.map((p) => p.id)).toEqual([baixada.id]);
    expect(saida.abertas).toBe(1);
  });

  /**
   * A única pendência da régua cuja cor é CONDICIONAL (CONTAI-035, item D): o
   * pagamento só herda o favorecido errado quando é ligado à nota.
   */
  it("o CNPJ errado é âmbar sem vínculo e vermelho com vínculo", () => {
    const semVinculo = unificarPendencias({
      obra: OBRA_COM_CNO,
      anoCorrente: 2026,
      resumo: resumo(),
      painel: { ...PAINEL_VAZIO, pendencias: [EMITENTE] },
    });
    expect(semVinculo.itens[0]?.bloco).toBe("ambar");

    const comVinculo = unificarPendencias({
      obra: OBRA_COM_CNO,
      anoCorrente: 2026,
      resumo: resumo(),
      painel: {
        ...PAINEL_VAZIO,
        pendencias: [EMITENTE],
        vinculos: [
          { documentoId: "doc-1", pagamentoId: "pg-1", anoDoPagamento: 2025 },
        ],
      },
    });
    expect(comVinculo.itens[0]?.bloco).toBe("vermelho");
  });
});

describe("o escopo de obra (Gate Fiscal §3.4)", () => {
  /**
   * ⚠️ **Nenhuma persistente pode perder superfície.** Escopar tudo na obra
   * aberta tiraria da tela a correção das OUTRAS obras — a família que tem
   * prazo de retificadora correndo. É a Meta 1, e é o motivo de o ticket
   * existir.
   */
  it("sem obra aberta, as persistentes continuam na fila", () => {
    const saida = unificarPendencias({
      obra: null,
      resumo: null,
      anoCorrente: 2026,
      painel: PAINEL_COM_PERSISTENTES,
    });
    expect(saida.itens.map((i) => i.familia).sort()).toEqual([
      "correcao_ano_anterior",
      "emitente_errado",
    ]);
  });

  it("sem obra aberta, nenhuma derivada é inventada", () => {
    const saida = unificarPendencias({
      obra: null,
      resumo: null,
      anoCorrente: 2026,
      painel: PAINEL_VAZIO,
    });
    expect(saida.itens).toEqual([]);
    expect(saida.abertas).toBe(0);
  });

  it("a obra COM CNO não acende a pendência de CNO", () => {
    const saida = unificarPendencias({
      obra: OBRA_COM_CNO,
      resumo: resumo(),
      anoCorrente: 2026,
      painel: PAINEL_VAZIO,
    });
    expect(saida.itens.map((i) => i.familia)).not.toContain("cno");
  });
});

describe("o aviso informativo", () => {
  /**
   * Ele é o único item sem cor de régua, e é o único que **não cobra nada** —
   * é o calendário do banco. Nunca omitido; nunca no badge.
   */
  it("aparece na fila mesmo sendo o único item", () => {
    const saida = unificarPendencias({
      obra: OBRA_COM_CNO,
      anoCorrente: 2026,
      painel: PAINEL_VAZIO,
      resumo: resumo({
        financiamentoAguardandoInforme: {
          ano: 2026,
          estimativaCentavos: 60_000_00,
          aviso: "aviso",
          sobreAEstimativa: "sobre",
          href: "/obras/obra-1/terreno",
        },
      }),
    });
    expect(saida.itens).toHaveLength(1);
    expect(saida.itens[0]?.familia).toBe("financiamento_aguardando_informe");
    expect(saida.itens[0]?.bloco).toBe("informativo");
    expect(saida.abertas).toBe(0);
  });
});
