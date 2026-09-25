/**
 * **CONTAI-041 — a trava do critério 4: nenhum centavo contado duas vezes.**
 *
 * O ticket chama isto de *"o critério de aceite mais importante da tabela, não
 * uma nota de rodapé"*, e o Gate Fiscal pede revisão ESTRUTURAL pela mesma
 * razão: é a primeira tela que projeta `Documento` e `Pagamento` linha a linha
 * lado a lado. Os testes abaixo afirmam, para cada cenário, as três somas que
 * não podem divergir dos cards do dashboard:
 *
 * - `Σ valor das linhas` = `Σ pagamentos` + `Σ documentos sem pagamento ligado`;
 * - `Σ comprovado das linhas` = `Σ custo comprovado dos componentes`;
 * - a decomposição de uma pendência AGREGADA (`pago_sem_nota`, que é por
 *   favorecido) fecha exatamente com o agregado que a home mostra.
 */

import { describe, expect, it } from "vitest";

import {
  CHIP_CUSTO_COMPROVADO,
  CHIP_SEM_PAGAMENTO,
  FILTROS_PADRAO,
  FILTRO_SITUACAO_PADRAO,
  filtrarLinhas,
  linhasDeDespesa,
  ordenarLinhas,
  ORDEM_PADRAO,
  pendenciasForaDaTabela,
  proximaOrdem,
  rotuloDoMeio,
  type LinhaDeDespesa,
} from "@/lib/fiscal/despesas";
import {
  BOLETO_FORA_DO_TOTAL,
  CHIP_NOTA_SEM_ARQUIVO,
  CONSEQUENCIA_BOLETO,
  CONSEQUENCIA_QUARENTENA,
} from "@/lib/fiscal/documento";
import { CONSEQUENCIA_CNO_DA_NOTA } from "@/lib/fiscal/obra";
import {
  CHIP_QUITADO_POR_RETENCAO,
  CHIP_RETENCAO_SOBRECOBERTA,
  CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR,
  RETENCAO_EXPLICA_A_SOBRA,
  RETENCAO_SOBRECOBERTA,
} from "@/lib/fiscal/retencao";
import {
  rotulosPagoSemComprovante,
  rotulosPagoSemNota,
  textoDiferencaSemExplicacao,
} from "@/lib/fiscal/pagamento";
import { calcularResumo, type EntradaResumo } from "@/lib/fiscal/resumo";
import { EXPLICACAO_NOTAS_SEM_PAGAMENTO } from "@/lib/fiscal/vinculo";
import type {
  Documento,
  LinhaRetencao,
  Obra,
  Pagamento,
  TerrenoDesembolso,
} from "@/lib/types";

const ANO = 2026;

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

/** R$ 800.000 de terreno — está aqui para PROVAR que ele não vira linha. */
const TERRENO: TerrenoDesembolso = {
  id: "t1",
  obraId: OBRA.id,
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

function doc(over: Partial<Documento> & { id: string }): Documento {
  return {
    obraId: OBRA.id,
    tipo: "nf_material",
    status: "registrado",
    valorCentavos: 100_000,
    numero: "1042",
    serie: null,
    dataEmissao: `${ANO}-03-20`,
    vencimento: null,
    classificacao: "material",
    destinatarioCpfOk: true,
    retencaoNaNota: null,
    retencoes: [],
    cnoReferenciado: null,
    notaTrazCno: null,
    motivoQuarentena: null,
    favorecidoId: "fav-casa",
    favorecidoNome: "Casa do Construtor",
    favorecidoDocumento: "11444777000161",
    arquivoPath: "u/documento/a.pdf",
    ...over,
  };
}

function pag(over: Partial<Pagamento> & { id: string }): Pagamento {
  return {
    obraId: OBRA.id,
    valorCentavos: 100_000,
    dataPagamento: `${ANO}-08-12`,
    meio: "pix",
    status: "aguardando_nf",
    favorecidoId: "fav-casa",
    favorecidoNome: "Casa do Construtor",
    favorecidoTipo: "pj",
    comprovantePath: "u/comprovante/pix.png",
    documentoIds: [],
    encargosCentavos: 0,
    naoExplicadoCentavos: 0,
    resolucaoDiferenca: null,
    ...over,
  };
}

function linhaRetencao(over: Partial<LinhaRetencao> = {}): LinhaRetencao {
  return {
    id: "ret-1",
    documentoId: "d1",
    rotuloLiteral: "Total das Retenções (ISSQN / Federais)",
    valorCentavos: 54_000,
    composicao: "combinado_nao_aberto",
    tributo: null,
    eDescontoEfetivo: true,
    quemRecolhe: "nao_sei",
    createdAt: `${ANO}-03-21T10:00:00Z`,
    ...over,
  };
}

function entrada(
  documentos: Documento[],
  pagamentos: Pagamento[],
  over: Partial<EntradaResumo> = {},
): EntradaResumo {
  return {
    obra: OBRA,
    documentos,
    pagamentos,
    desembolsosTerreno: [TERRENO],
    informesFinanciamento: [],
    financiamento: null,
    ano: ANO,
    ...over,
  };
}

function projetar(
  documentos: Documento[],
  pagamentos: Pagamento[],
  over: Partial<EntradaResumo> = {},
) {
  const e = entrada(documentos, pagamentos, over);
  const resumo = calcularResumo(e);
  return { resumo, linhas: linhasDeDespesa({ documentos, pagamentos, resumo }) };
}

/**
 * ⚠️ `?? 0` **na soma do teste, nunca na linha**: nota sem valor lançado não
 * acrescenta nada a um somatório, mas também não é "R$ 0,00" em tela — é o
 * `null` que a tabela mostra como `—`.
 */
function somaDeValores(linhas: readonly LinhaDeDespesa[]): number {
  return linhas.reduce((s, l) => s + (l.valorCentavos ?? 0), 0);
}

/**
 * ⚠️ **As DUAS parcelas** (CONTAI-056): `comprovadoCentavos` (o que o valor
 * DESTA linha comprova) + `comprovadoPorRetencaoCentavos` (a perna de retenção
 * ancorada nela, que não é dinheiro que mudou de conta e por isso não entra no
 * valor da linha). Somar só a primeira faria o invariante mentir em silêncio na
 * primeira nota com retenção confirmada.
 */
function somaDeComprovados(linhas: readonly LinhaDeDespesa[]): number {
  return linhas.reduce(
    (s, l) => s + l.comprovadoCentavos + l.comprovadoPorRetencaoCentavos,
    0,
  );
}

function linhaDe(linhas: readonly LinhaDeDespesa[], id: string): LinhaDeDespesa {
  const achada = linhas.find((l) => l.id === id);
  if (achada === undefined) throw new Error(`linha ${id} não existe`);
  return achada;
}

function chips(linha: LinhaDeDespesa): string[] {
  return linha.situacoes.map((s) => s.chip);
}

// ═══════════════════════════════════════════════════════════════════════════
describe("critério 4 — nenhum centavo contado duas vezes", () => {
  it("NF e PIX ligados entre si dão UMA linha, não duas", () => {
    const { linhas } = projetar(
      [doc({ id: "d1", valorCentavos: 1_820_000 })],
      [pag({ id: "p1", valorCentavos: 1_820_000, documentoIds: ["d1"] })],
    );

    expect(linhas).toHaveLength(1);
    expect(linhas[0].id).toBe("pagamento:p1");
    expect(somaDeValores(linhas)).toBe(1_820_000);
    // A nota aparece — na COLUNA `Documento` da linha do pagamento, que é
    // exatamente "uma despesa, não duas" (critério 13 do CONTAI-018).
    expect(linhas[0].documentos.map((d) => d.rotulo)).toEqual([
      "NF de material nº 1042",
    ]);
    expect(linhas[0].semDocumento).toBeNull();
  });

  it("uma NF paga por cinco PIX: cinco linhas, e a NF não vira a sexta", () => {
    const pagamentos = ["p1", "p2", "p3", "p4", "p5"].map((id, i) =>
      pag({
        id,
        valorCentavos: 60_000,
        dataPagamento: `${ANO}-0${i + 1}-10`,
        documentoIds: ["d1"],
      }),
    );
    const { linhas, resumo } = projetar(
      [doc({ id: "d1", valorCentavos: 300_000 })],
      pagamentos,
    );

    expect(linhas).toHaveLength(5);
    // Σ linhas = Σ pagamentos. Somar a nota daria R$ 6.000 — a mesma despesa
    // contada duas vezes, que é o defeito nomeado no Pre-mortem 1.
    expect(somaDeValores(linhas)).toBe(300_000);
    expect(somaDeComprovados(linhas)).toBe(300_000);
    expect(resumo.custoConfirmadoAnoCentavos).toBe(300_000);
    // A nota está nas cinco linhas, como documento — nunca como valor.
    for (const l of linhas) {
      expect(l.documentos.map((d) => d.id)).toEqual(["d1"]);
    }
  });

  it("um pagamento que cobre três notas continua sendo UMA linha", () => {
    const { linhas } = projetar(
      [
        doc({ id: "d1", valorCentavos: 100_000 }),
        doc({ id: "d2", valorCentavos: 100_000, numero: "1043" }),
        doc({ id: "d3", valorCentavos: 100_000, numero: "1044" }),
      ],
      [
        pag({
          id: "p1",
          valorCentavos: 300_000,
          documentoIds: ["d1", "d2", "d3"],
        }),
      ],
    );

    expect(linhas).toHaveLength(1);
    expect(somaDeValores(linhas)).toBe(300_000);
    expect(linhas[0].documentos).toHaveLength(3);
  });

  /**
   * ⚠️ **O caso LITERAL do Pre-mortem 1**: parte comprovada, parte "pago sem
   * nota", no MESMO pagamento. Duas fontes de dado, uma linha só.
   */
  it("pagamento meio comprovado e meio sem nota: UMA linha, duas situações", () => {
    const { linhas, resumo } = projetar(
      [doc({ id: "d1", valorCentavos: 200_000 })],
      [pag({ id: "p1", valorCentavos: 500_000, documentoIds: ["d1"] })],
    );

    expect(linhas).toHaveLength(1);
    const linha = linhas[0];
    // O valor entra UMA vez, cheio — não 200.000 + 300.000 em duas linhas.
    expect(linha.valorCentavos).toBe(500_000);
    expect(somaDeValores(linhas)).toBe(500_000);

    expect(chips(linha)).toEqual([
      CHIP_CUSTO_COMPROVADO,
      rotulosPagoSemNota("pj").chip,
    ]);
    expect(linha.comprovada).toBe(true);
    expect(linha.temPendencia).toBe(true);

    // E as duas anotações PARTICIONAM o pagamento, sem sobreposição.
    const [verde, vermelha] = linha.situacoes;
    expect(verde.valorCentavos).toBe(200_000);
    expect(vermelha.valorCentavos).toBe(300_000);
    expect((verde.valorCentavos ?? 0) + (vermelha.valorCentavos ?? 0)).toBe(
      linha.valorCentavos,
    );
    expect(resumo.custoConfirmadoAnoCentavos).toBe(200_000);
  });

  it("pendência agregada por favorecido se decompõe sem sobrar nem faltar", () => {
    const pagamentos = [
      pag({ id: "p1", valorCentavos: 100_000, dataPagamento: `${ANO}-01-10` }),
      pag({ id: "p2", valorCentavos: 250_000, dataPagamento: `${ANO}-02-10` }),
      pag({ id: "p3", valorCentavos: 70_000, dataPagamento: `${ANO}-03-10` }),
    ];
    const { linhas, resumo } = projetar([], pagamentos);

    const agregada = resumo.pendencias.find((p) => p.tipo === "pago_sem_nota");
    expect(agregada).toBeDefined();
    expect(agregada!.valorCentavos).toBe(420_000);

    // A home mostra UM cartão de R$ 4.200,00; a tabela mostra três linhas que
    // somam exatamente ele. Nem um centavo a mais.
    const porLinha = linhas.flatMap((l) =>
      l.situacoes
        .filter((s) => s.pendenciaId === agregada!.id)
        .map((s) => s.valorCentavos ?? 0),
    );
    expect(porLinha).toHaveLength(3);
    expect(porLinha.reduce((a, b) => a + b, 0)).toBe(agregada!.valorCentavos);
    expect(somaDeValores(linhas)).toBe(420_000);
  });

  it("o cenário completo: Σ linhas = Σ pagamentos + Σ documentos sem pagamento", () => {
    const documentos = [
      // ligada a pagamento — não vira linha
      doc({ id: "d1", valorCentavos: 180_000 }),
      // hábil, sem pagamento — vira linha (terceiro estado)
      doc({ id: "d2", valorCentavos: 96_400, numero: "8710" }),
      // quarentena, sem pagamento — vira linha
      doc({
        id: "d3",
        valorCentavos: 48_500,
        status: "quarentena",
        destinatarioCpfOk: false,
        numero: "77",
      }),
      // boleto aguardando pagamento — vira linha
      doc({
        id: "d4",
        tipo: "boleto",
        valorCentavos: 2_500_000,
        status: "aguardando_pagamento",
        numero: null,
        vencimento: `${ANO}-09-15`,
      }),
    ];
    const pagamentos = [
      pag({ id: "p1", valorCentavos: 180_000, documentoIds: ["d1"] }),
      pag({ id: "p2", valorCentavos: 320_000, dataPagamento: `${ANO}-02-14` }),
      pag({
        id: "p3",
        valorCentavos: 950_000,
        dataPagamento: `${ANO}-04-03`,
        comprovantePath: null,
      }),
    ];

    const { linhas } = projetar(documentos, pagamentos);

    // 3 pagamentos + 3 documentos órfãos = 6 linhas. `d1` não conta: ele mora
    // na linha de `p1`.
    expect(linhas).toHaveLength(6);
    const somaPagamentos = pagamentos.reduce((s, p) => s + p.valorCentavos, 0);
    const somaOrfaos = 96_400 + 48_500 + 2_500_000;
    expect(somaDeValores(linhas)).toBe(somaPagamentos + somaOrfaos);
    // E o valor de `d1` (R$ 1.800) não entrou na soma por fora.
    expect(linhas.some((l) => l.id === "documento:d1")).toBe(false);
  });

  it("Σ comprovado das linhas = Σ custo comprovado dos componentes", () => {
    const { linhas, resumo } = projetar(
      [
        doc({ id: "d1", valorCentavos: 200_000 }),
        doc({ id: "d2", valorCentavos: 150_000, numero: "99" }),
      ],
      [
        pag({ id: "p1", valorCentavos: 300_000, documentoIds: ["d1"] }),
        pag({
          id: "p2",
          valorCentavos: 100_000,
          dataPagamento: `${ANO}-05-01`,
          documentoIds: ["d2"],
        }),
      ],
    );

    const dosComponentes = resumo.alocacao.componentes.reduce(
      (s, c) => s + c.custoComprovadoCentavos,
      0,
    );
    expect(somaDeComprovados(linhas)).toBe(dosComponentes);
    expect(somaDeComprovados(linhas)).toBe(resumo.custoConfirmadoAnoCentavos);
  });

  /**
   * **O MESMO invariante com perna de retenção no meio** (CONTAI-056). É o
   * cenário que quebraria em silêncio: a retenção entra no custo comprovado do
   * componente sem ser `Pagamento` nem `Documento`, então se ela não achasse
   * linha, o total da tabela ficaria abaixo do card do dashboard — o
   * encolhimento silencioso que este módulo existe para impedir.
   */
  it("Σ comprovado fecha mesmo com perna de retenção (CONTAI-056)", () => {
    const { linhas, resumo } = projetar(
      [
        doc({
          id: "d1",
          tipo: "nf_servico",
          classificacao: "mao_obra",
          valorCentavos: 1_100_000,
          retencaoNaNota: "destacada",
          retencoes: [linhaRetencao({ quemRecolhe: "empresa" })],
          notaTrazCno: true,
          cnoReferenciado: OBRA.cno,
        }),
      ],
      [pag({ id: "p1", valorCentavos: 1_046_000, documentoIds: ["d1"] })],
    );

    // Σ linhas continua sendo Σ pagamentos: a retenção NÃO vira linha de valor.
    expect(linhas).toHaveLength(1);
    expect(somaDeValores(linhas)).toBe(1_046_000);
    // Σ comprovado fecha no BRUTO da nota, que é o custo do componente.
    expect(somaDeComprovados(linhas)).toBe(1_100_000);
    expect(somaDeComprovados(linhas)).toBe(resumo.custoConfirmadoAnoCentavos);
    expect(
      resumo.alocacao.componentes.reduce(
        (s, c) => s + c.custoComprovadoCentavos,
        0,
      ),
    ).toBe(1_100_000);
    // E o painel "Despesas recentes" do dashboard não discorda do card.
    expect(resumo.despesas[0].noAnoCentavos).toBe(1_100_000);
    // A pendência "pago sem nota" não nasce: nada foi pago além da nota.
    expect(resumo.pendencias.some((p) => p.tipo === "pago_sem_nota")).toBe(
      false,
    );
  });

  /**
   * **Gate 2, correção obrigatória do `cto-obra`.** `documento.valor` é
   * `numeric(14,2)` NULLABLE, e nota registrada sem valor é estado legítimo.
   * A linha dela **não some, não vira zero e não flutua para o topo**.
   */
  it("documento sem valor lançado: linha com `null`, nunca com zero", () => {
    const { linhas } = projetar(
      [
        doc({ id: "d1", valorCentavos: null, numero: "8710" }),
        doc({ id: "d2", valorCentavos: 96_400, numero: "8711" }),
      ],
      [pag({ id: "p1", valorCentavos: 320_000, dataPagamento: `${ANO}-02-14` })],
    );

    // 1 · não some da tabela.
    const semValor = linhaDe(linhas, "documento:d1");
    expect(linhas).toHaveLength(3);
    expect(semValor.situacoes.length).toBeGreaterThan(0);

    // 2 · não vira zero — `null` é ausência de dado, e a tela mostra `—`.
    expect(semValor.valorCentavos).toBeNull();
    expect(semValor.valorCentavos).not.toBe(0);
    // E não contamina soma nenhuma: Σ continua sendo pagamento + a nota que
    // tem valor.
    expect(somaDeValores(linhas)).toBe(320_000 + 96_400);

    // 3 · fica no FIM da ordenação por valor, nas duas direções.
    for (const direcao of ["desc", "asc"] as const) {
      const ordenadas = ordenarLinhas(linhas, { coluna: "valor", direcao });
      expect(ordenadas.at(-1)!.id).toBe("documento:d1");
    }
    // O mesmo vale no eixo da data: as duas linhas de documento não têm
    // pagamento, e as duas ficam depois da linha que tem.
    const porData = ordenarLinhas(linhas, ORDEM_PADRAO);
    expect(porData[0].id).toBe("pagamento:p1");
    expect(porData.slice(1).every((l) => l.dataPagamento === null)).toBe(true);
  });

  /**
   * **Gate 2, sugestão do `cto-obra`** — o caso PARCIAL, que os cenários 1:1 e
   * N:1 integrais não alcançavam: uma nota maior que a soma dos pagamentos.
   * Quem limita o custo é o mínimo do componente, e a repartição é cronológica.
   */
  it("componente parcial: duas linhas repartem o custo do componente, sem sobra", () => {
    const { linhas, resumo } = projetar(
      [doc({ id: "d1", valorCentavos: 15_000_000 })],
      [
        pag({
          id: "p1",
          valorCentavos: 10_000_000,
          dataPagamento: `${ANO}-01-10`,
          documentoIds: ["d1"],
        }),
        pag({
          id: "p2",
          valorCentavos: 10_000_000,
          dataPagamento: `${ANO}-02-10`,
          documentoIds: ["d1"],
        }),
      ],
    );

    expect(resumo.alocacao.componentes).toHaveLength(1);
    const componente = resumo.alocacao.componentes[0];
    expect(componente.custoComprovadoCentavos).toBe(15_000_000);

    // Duas linhas (a nota mora dentro delas), somando os DOIS pagamentos.
    expect(linhas).toHaveLength(2);
    expect(somaDeValores(linhas)).toBe(20_000_000);
    // E o comprovado das linhas fecha com o do componente — nem um centavo a
    // mais, apesar de a nota valer R$ 150.000.
    expect(somaDeComprovados(linhas)).toBe(componente.custoComprovadoCentavos);

    // Repartição cronológica: o mais antigo absorve primeiro, e o excedente
    // "pago sem nota" recai sobre o mais recente (ADENDO de 2026-08-18).
    const p1 = linhaDe(linhas, "pagamento:p1");
    const p2 = linhaDe(linhas, "pagamento:p2");
    expect(p1.comprovadoCentavos).toBe(10_000_000);
    expect(p2.comprovadoCentavos).toBe(5_000_000);
    expect(p1.temPendencia).toBe(false);
    expect(p2.temPendencia).toBe(true);
    // A linha mista particiona o pagamento exatamente.
    expect(
      p2.situacoes.reduce((s, x) => s + (x.valorCentavos ?? 0), 0),
    ).toBe(p2.valorCentavos);
  });

  it("o terreno NÃO vira linha — ele tem rota própria", () => {
    const { linhas } = projetar([], [pag({ id: "p1", valorCentavos: 100_000 })]);
    expect(linhas).toHaveLength(1);
    expect(somaDeValores(linhas)).toBe(100_000);
    // R$ 800.000 de terreno estão no resumo e fora desta tabela.
    expect(somaDeValores(linhas)).not.toBe(TERRENO.valorCentavos);
  });

  it("obra sem registro nenhum devolve lista vazia", () => {
    const { linhas } = projetar([], []);
    expect(linhas).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("as situações da coluna `Situação`", () => {
  it("linha comprovada é compacta: só o chip, sem consequência", () => {
    const { linhas } = projetar(
      [doc({ id: "d1", valorCentavos: 100_000 })],
      [pag({ id: "p1", valorCentavos: 100_000, documentoIds: ["d1"] })],
    );
    expect(linhas[0].situacoes).toHaveLength(1);
    expect(linhas[0].situacoes[0]).toMatchObject({
      chip: CHIP_CUSTO_COMPROVADO,
      cor: "grn",
      consequencia: null,
    });
    expect(linhas[0].temPendencia).toBe(false);
  });

  it("pago sem nota (PF): chip e consequência LITERAIS da constante", () => {
    const { linhas } = projetar(
      [],
      [
        pag({
          id: "p1",
          favorecidoTipo: "pf",
          favorecidoNome: "João Pedreiro",
          favorecidoId: "fav-joao",
          valorCentavos: 320_000,
        }),
      ],
    );
    const rotulos = rotulosPagoSemNota("pf");
    expect(linhas[0].semDocumento).toBe(rotulos.semVinculo);
    expect(linhas[0].situacoes[0]).toMatchObject({
      chip: rotulos.chip,
      cor: "red",
      consequencia: rotulos.consequencia,
    });
  });

  it("pago sem comprovante (PJ): âmbar por exceção nomeada, texto completo", () => {
    const { linhas, resumo } = projetar(
      [doc({ id: "d1", valorCentavos: 950_000 })],
      [
        pag({
          id: "p1",
          valorCentavos: 950_000,
          comprovantePath: null,
          documentoIds: ["d1"],
        }),
      ],
    );
    const pendencia = resumo.pendencias.find(
      (p) => p.tipo === "pago_sem_comprovante",
    )!;
    const situacao = linhas[0].situacoes.find(
      (s) => s.pendenciaId === pendencia.id,
    )!;
    expect(situacao.cor).toBe("amb");
    expect(situacao.cor).toBe(rotulosPagoSemComprovante("pj").gravidade);
    expect(situacao.consequencia).toBe(pendencia.consequencia);
    expect(situacao.consequencia).toContain(
      rotulosPagoSemComprovante("pj").consequencia,
    );
  });

  it("quarentena entra na linha do documento, com o texto do parecer", () => {
    const { linhas } = projetar(
      [
        doc({
          id: "d1",
          valorCentavos: 48_500,
          status: "quarentena",
          destinatarioCpfOk: false,
        }),
      ],
      [],
    );
    const linha = linhaDe(linhas, "documento:d1");
    expect(chips(linha)).toEqual(["Quarentena"]);
    expect(linha.situacoes[0].consequencia).toBe(CONSEQUENCIA_QUARENTENA);
    expect(linha.dataPagamento).toBeNull();
    expect(linha.meio).toBeNull();
  });

  it("boleto sem NF carrega as DUAS frases — inclusive 'não entra no total'", () => {
    const { linhas } = projetar(
      [
        doc({
          id: "d1",
          tipo: "boleto",
          valorCentavos: 2_500_000,
          status: "aguardando_pagamento",
          numero: null,
          vencimento: `${ANO}-09-15`,
        }),
      ],
      [],
    );
    const linha = linhaDe(linhas, "documento:d1");
    expect(linha.situacoes[0].consequencia).toBe(CONSEQUENCIA_BOLETO);
    expect(linha.situacoes[0].nota).toBe(BOLETO_FORA_DO_TOTAL);
    expect(linha.situacoes[0].cor).toBe("amb");
    // A outra data é NOMEADA e nunca ocupa a coluna do regime de caixa.
    expect(linha.dataPagamento).toBeNull();
    expect(linha.outraData).toEqual({ rotulo: "vence em", iso: `${ANO}-09-15` });
  });

  it("diferença sem explicação: o texto traz o valor interpolado", () => {
    const { linhas } = projetar(
      [],
      [
        pag({
          id: "p1",
          valorCentavos: 185_000,
          naoExplicadoCentavos: 185_000,
          favorecidoNome: null,
          favorecidoId: null,
          favorecidoTipo: null,
          meio: "cartao",
        }),
      ],
    );
    const linha = linhaDe(linhas, "pagamento:p1");
    const situacao = linha.situacoes.find(
      (s) => s.chip === "Diferença sem explicação",
    )!;
    expect(situacao.consequencia).toBe(textoDiferencaSemExplicacao(185_000));
    expect(rotuloDoMeio(linha.meio)).toBe("Cartão");
  });

  /**
   * **Critério 3, as duas famílias que NÃO ganham linha própria.** Uma NF de
   * serviço pode estar comprovada E carregar as duas ao mesmo tempo — a linha
   * mostra tudo, e continua sendo uma linha só.
   */
  it("retenção sem recolhedor e nota sem CNO são anotações, não linhas", () => {
    const documentos = [
      doc({
        id: "d1",
        tipo: "nf_servico",
        classificacao: "mao_obra",
        valorCentavos: 1_100_000,
        retencaoNaNota: "destacada",
        retencoes: [linhaRetencao()],
        notaTrazCno: false,
      }),
    ];
    // ⚠️ O LÍQUIDO, e a mudança é do CONTAI-056: um PIX pelo BRUTO ao lado de
    // uma linha de retenção "efetivamente descontada" é dado contraditório (o
    // valor foi descontado *e* transferido?), e desde este ticket ele acende o
    // chip do critério 8. Este teste é sobre as ANOTAÇÕES, então o fixture
    // passou a ser o caso real: transfere-se o líquido.
    const pagamentos = [
      pag({ id: "p1", valorCentavos: 1_046_000, documentoIds: ["d1"] }),
    ];
    const { linhas } = projetar(documentos, pagamentos);

    // UMA linha: a do pagamento. As duas pendências são do documento, e o
    // documento já mora dentro dela.
    expect(linhas).toHaveLength(1);
    expect(somaDeValores(linhas)).toBe(1_046_000);

    const linha = linhas[0];
    // ⚠️ **Os dois trilhos do ADENDO 2, na mesma linha e sem se misturar**: a
    // fatia retida é CUSTO COMPROVADO (verde, quitada por retenção) e "quem
    // recolhe" continua ABERTO (vermelho). Um não fecha nem abre o outro.
    expect(chips(linha)).toEqual([
      CHIP_CUSTO_COMPROVADO,
      CHIP_QUITADO_POR_RETENCAO,
      "Retenção sem recolhedor",
      "Nota sem CNO",
    ]);
    // Comprovada E em risco ao mesmo tempo — os dois filtros a pegam.
    expect(linha.comprovada).toBe(true);
    expect(linha.temPendencia).toBe(true);

    // A parcela de retenção fica FORA de `comprovadoCentavos` (que continua
    // sendo "quanto DESTE valor de linha"), e as duas juntas fecham o bruto.
    expect(linha.comprovadoCentavos).toBe(1_046_000);
    expect(linha.comprovadoPorRetencaoCentavos).toBe(54_000);

    const quitada = linha.situacoes.find(
      (s) => s.chip === CHIP_QUITADO_POR_RETENCAO,
    )!;
    expect(quitada.cor).toBe("grn");
    expect(quitada.consequencia).toBe(RETENCAO_EXPLICA_A_SOBRA);
    expect(quitada.valorCentavos).toBe(54_000);

    const retencao = linha.situacoes.find(
      (s) => s.chip === "Retenção sem recolhedor",
    )!;
    expect(retencao.consequencia).toBe(CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR);
    expect(retencao.cor).toBe("red");
    // ⚠️ Anotação de documento não carrega valor: a NF pode aparecer em N
    // linhas, e repetir o valor dela seria o double-count por outra porta.
    expect(retencao.valorCentavos).toBeNull();

    const cno = linha.situacoes.find((s) => s.chip === "Nota sem CNO")!;
    expect(cno.consequencia).toBe(CONSEQUENCIA_CNO_DA_NOTA);
    expect(cno.cor).toBe("amb");
  });

  /**
   * **CONTAI-056, critério 8 — o caso sobrecoberto não estoura em silêncio.**
   * PIX pelo BRUTO + linha de retenção confirmada: a soma das pernas passa do
   * valor da nota, e o que não cabe sobra na PERNA DE RETENÇÃO (nunca no
   * dinheiro real, que não pode virar "pago sem nota" por causa de uma ficção
   * de quitação). A tabela nomeia a contradição.
   */
  it("pagamento pelo bruto + retenção confirmada: chip de dado contraditório", () => {
    const { linhas } = projetar(
      [
        doc({
          id: "d1",
          tipo: "nf_servico",
          classificacao: "mao_obra",
          valorCentavos: 1_100_000,
          retencaoNaNota: "destacada",
          retencoes: [linhaRetencao({ quemRecolhe: "empresa" })],
          notaTrazCno: true,
          cnoReferenciado: OBRA.cno,
        }),
      ],
      [pag({ id: "p1", valorCentavos: 1_100_000, documentoIds: ["d1"] })],
    );

    const linha = linhaDe(linhas, "pagamento:p1");
    // O dinheiro real absorveu o custo inteiro; a perna de retenção sobrou.
    expect(linha.comprovadoCentavos).toBe(1_100_000);
    expect(linha.comprovadoPorRetencaoCentavos).toBe(0);
    expect(chips(linha)).toEqual([
      CHIP_CUSTO_COMPROVADO,
      CHIP_RETENCAO_SOBRECOBERTA,
    ]);
    const contradicao = linha.situacoes.find(
      (s) => s.chip === CHIP_RETENCAO_SOBRECOBERTA,
    )!;
    expect(contradicao.cor).toBe("red");
    expect(contradicao.consequencia).toBe(RETENCAO_SOBRECOBERTA);
    expect(contradicao.valorCentavos).toBe(54_000);
    expect(linha.temPendencia).toBe(true);
  });

  it("nota hábil sem pagamento: linha própria, chip NEUTRO, nem risco nem custo", () => {
    const { linhas, resumo } = projetar([doc({ id: "d1" })], []);
    const linha = linhaDe(linhas, "documento:d1");

    expect(resumo.notasSemPagamento).toHaveLength(1);
    expect(chips(linha)).toEqual([CHIP_SEM_PAGAMENTO]);
    expect(linha.situacoes[0].cor).toBe("neutra");
    expect(linha.situacoes[0].consequencia).toBe(
      EXPLICACAO_NOTAS_SEM_PAGAMENTO,
    );
    // O terceiro estado não é pendência e não é custo comprovado.
    expect(linha.temPendencia).toBe(false);
    expect(linha.comprovada).toBe(false);
    expect(linha.outraData).toEqual({
      rotulo: "emitida em",
      iso: `${ANO}-03-20`,
    });
  });

  it("nota sem arquivo não fica muda — ela não é `Pendencia` e mesmo assim aparece", () => {
    const { linhas } = projetar([doc({ id: "d1", arquivoPath: null })], []);
    const linha = linhaDe(linhas, "documento:d1");
    expect(chips(linha)).toContain(CHIP_NOTA_SEM_ARQUIVO);
    expect(linha.temPendencia).toBe(true);
    // Sem arquivo ela não é hábil, então o terceiro estado não se aplica.
    expect(chips(linha)).not.toContain(CHIP_SEM_PAGAMENTO);
  });

  it("nenhuma linha fica sem dizer nada", () => {
    const { linhas } = projetar(
      [
        doc({ id: "d1", valorCentavos: 200_000 }),
        doc({ id: "d2", valorCentavos: 96_400, numero: "8710" }),
        doc({ id: "d3", arquivoPath: null, numero: "8711" }),
        doc({
          id: "d4",
          status: "quarentena",
          destinatarioCpfOk: false,
          numero: "8712",
        }),
      ],
      [
        pag({ id: "p1", valorCentavos: 500_000, documentoIds: ["d1"] }),
        pag({ id: "p2", valorCentavos: 70_000, dataPagamento: `${ANO}-02-01` }),
      ],
    );
    for (const l of linhas) {
      expect(l.situacoes.length, `linha muda: ${l.id}`).toBeGreaterThan(0);
    }
  });

  it("toda anotação de pendência traz a consequência INTEIRA, nunca cortada", () => {
    const { linhas, resumo } = projetar(
      [
        doc({
          id: "d1",
          tipo: "nf_servico",
          classificacao: "mao_obra",
          valorCentavos: 1_100_000,
          retencaoNaNota: "destacada",
          retencoes: [linhaRetencao()],
          notaTrazCno: false,
        }),
        doc({ id: "d2", status: "quarentena", destinatarioCpfOk: false }),
      ],
      [
        pag({ id: "p1", valorCentavos: 1_500_000, documentoIds: ["d1"] }),
        pag({
          id: "p2",
          valorCentavos: 90_000,
          dataPagamento: `${ANO}-06-01`,
          comprovantePath: null,
        }),
      ],
    );

    const porId = new Map(resumo.pendencias.map((p) => [p.id, p]));
    for (const linha of linhas) {
      for (const s of linha.situacoes) {
        if (s.pendenciaId === null) continue;
        const pendencia = porId.get(s.pendenciaId)!;
        // Cópia literal, byte a byte: nada reescrito, nada com "…".
        expect(s.consequencia).toBe(pendencia.consequencia);
        expect(s.chip).toBe(pendencia.chip);
        expect(s.consequencia).not.toContain("…");
      }
    }
  });

  /**
   * ⚠️ **A trava do formato de id de pendência.** `linhasDeDespesa` atribui
   * cada `Pendencia` pela chave que `calcularResumo` monta. Se aquele formato
   * mudar, a pendência deixaria de achar a linha dela — e sumiria da tabela em
   * silêncio. Este teste fica vermelho no mesmo diff.
   */
  it("nenhuma pendência do resumo fica de fora da tabela", () => {
    const { linhas, resumo } = projetar(
      [
        doc({ id: "d1", valorCentavos: 200_000 }),
        doc({
          id: "d2",
          status: "quarentena",
          destinatarioCpfOk: false,
          numero: "8712",
        }),
        doc({
          id: "d3",
          tipo: "boleto",
          status: "aguardando_pagamento",
          numero: null,
          vencimento: `${ANO}-09-15`,
        }),
        doc({
          id: "d4",
          tipo: "nf_servico",
          classificacao: "mao_obra",
          valorCentavos: 300_000,
          numero: "77",
          retencaoNaNota: "destacada",
          retencoes: [linhaRetencao({ documentoId: "d4" })],
          notaTrazCno: false,
        }),
      ],
      [
        pag({ id: "p1", valorCentavos: 500_000, documentoIds: ["d1"] }),
        pag({
          id: "p2",
          valorCentavos: 90_000,
          dataPagamento: `${ANO}-06-01`,
          comprovantePath: null,
        }),
        pag({
          id: "p3",
          valorCentavos: 300_000,
          dataPagamento: `${ANO}-07-01`,
          naoExplicadoCentavos: 40_000,
          documentoIds: ["d4"],
        }),
        // Favorecido nulo: a chave do agregado vira `sem-favorecido:<id>`, e é
        // por isso que a atribuição passa por `itens[]` e não pelo id.
        pag({
          id: "p4",
          valorCentavos: 12_000,
          dataPagamento: `${ANO}-07-15`,
          favorecidoId: null,
          favorecidoNome: null,
          favorecidoTipo: null,
        }),
      ],
    );

    expect(resumo.pendencias.length).toBeGreaterThan(5);
    expect(pendenciasForaDaTabela(linhas, resumo.pendencias)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("filtros (critério 8)", () => {
  function cenario() {
    return projetar(
      [
        doc({ id: "d1", valorCentavos: 200_000 }),
        // hábil e sem pagamento: terceiro estado
        doc({ id: "d2", valorCentavos: 96_400, numero: "8710" }),
        doc({
          id: "d3",
          tipo: "nf_servico",
          classificacao: "mao_obra",
          valorCentavos: 650_000,
          numero: "214",
        }),
        doc({
          id: "d4",
          tipo: "boleto",
          valorCentavos: 480_000,
          status: "aguardando_pagamento",
          numero: null,
        }),
      ],
      [
        // comprovada e pura
        pag({ id: "p1", valorCentavos: 200_000, documentoIds: ["d1"] }),
        // mista: comprovada + pago sem nota
        pag({
          id: "p2",
          valorCentavos: 900_000,
          dataPagamento: `${ANO}-02-10`,
          documentoIds: ["d3"],
        }),
        // só pendência
        pag({
          id: "p3",
          valorCentavos: 320_000,
          dataPagamento: `${ANO}-03-10`,
          favorecidoId: "fav-joao",
          favorecidoNome: "João Pedreiro",
          favorecidoTipo: "pf",
        }),
      ],
    );
  }

  it("o padrão é TODAS — pendência não pode ficar escondida na primeira visita", () => {
    // Pre-mortem 2, literal: o padrão ao abrir a tela é "Todas".
    expect(FILTRO_SITUACAO_PADRAO).toBe("todas");
    expect(FILTROS_PADRAO.situacao).toBe("todas");
    const { linhas } = cenario();
    expect(filtrarLinhas(linhas, FILTROS_PADRAO)).toHaveLength(linhas.length);
    // E com o padrão TODA pendência da obra continua visível.
    const comPendencia = linhas.filter((l) => l.temPendencia);
    expect(comPendencia.length).toBeGreaterThan(0);
    for (const l of comPendencia) {
      expect(filtrarLinhas(linhas, FILTROS_PADRAO)).toContain(l);
    }
  });

  it("'só comprovadas' e 'só com pendência' pegam a linha MISTA nas duas", () => {
    const { linhas } = cenario();
    const mista = linhaDe(linhas, "pagamento:p2");
    expect(mista.comprovada).toBe(true);
    expect(mista.temPendencia).toBe(true);

    const comprovadas = filtrarLinhas(linhas, {
      ...FILTROS_PADRAO,
      situacao: "comprovadas",
    });
    const pendentes = filtrarLinhas(linhas, {
      ...FILTROS_PADRAO,
      situacao: "pendencia",
    });
    expect(comprovadas).toContain(mista);
    expect(pendentes).toContain(mista);
    // Linha só comprovada não aparece em "com pendência", e vice-versa.
    expect(pendentes).not.toContain(linhaDe(linhas, "pagamento:p1"));
    expect(comprovadas).not.toContain(linhaDe(linhas, "pagamento:p3"));
  });

  it("o terceiro estado não é comprovado nem pendência: só aparece em TODAS", () => {
    const { linhas } = cenario();
    const terceiro = linhaDe(linhas, "documento:d2");
    expect(filtrarLinhas(linhas, FILTROS_PADRAO)).toContain(terceiro);
    expect(
      filtrarLinhas(linhas, { ...FILTROS_PADRAO, situacao: "comprovadas" }),
    ).not.toContain(terceiro);
    expect(
      filtrarLinhas(linhas, { ...FILTROS_PADRAO, situacao: "pendencia" }),
    ).not.toContain(terceiro);
  });

  it("filtro por tipo de documento, inclusive 'sem documento'", () => {
    const { linhas } = cenario();
    const material = filtrarLinhas(linhas, {
      ...FILTROS_PADRAO,
      tipo: "nf_material",
    });
    expect(material.map((l) => l.id).sort()).toEqual([
      "documento:d2",
      "pagamento:p1",
    ]);

    const servico = filtrarLinhas(linhas, {
      ...FILTROS_PADRAO,
      tipo: "nf_servico",
    });
    expect(servico.map((l) => l.id)).toEqual(["pagamento:p2"]);

    const boleto = filtrarLinhas(linhas, { ...FILTROS_PADRAO, tipo: "boleto" });
    expect(boleto.map((l) => l.id)).toEqual(["documento:d4"]);

    const semDoc = filtrarLinhas(linhas, {
      ...FILTROS_PADRAO,
      tipo: "sem_documento",
    });
    expect(semDoc.map((l) => l.id)).toEqual(["pagamento:p3"]);
  });

  it("busca por favorecido ignora caixa e acento", () => {
    const { linhas } = cenario();
    expect(
      filtrarLinhas(linhas, { ...FILTROS_PADRAO, busca: "joao" }).map(
        (l) => l.id,
      ),
    ).toEqual(["pagamento:p3"]);
    expect(
      filtrarLinhas(linhas, { ...FILTROS_PADRAO, busca: "  CASA do  " }).length,
    ).toBeGreaterThan(0);
    expect(
      filtrarLinhas(linhas, { ...FILTROS_PADRAO, busca: "inexistente" }),
    ).toEqual([]);
  });

  it("os filtros se combinam, e filtrar nunca muda o valor de uma linha", () => {
    const { linhas } = cenario();
    const filtradas = filtrarLinhas(linhas, {
      situacao: "pendencia",
      tipo: "sem_documento",
      busca: "pedreiro",
    });
    expect(filtradas.map((l) => l.id)).toEqual(["pagamento:p3"]);
    expect(filtradas[0].valorCentavos).toBe(320_000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("ordenação (critério 9)", () => {
  function cenario() {
    return projetar(
      [doc({ id: "d9", valorCentavos: 500_000, numero: "9" })],
      [
        pag({ id: "p1", valorCentavos: 100_000, dataPagamento: `${ANO}-01-05` }),
        pag({ id: "p2", valorCentavos: 900_000, dataPagamento: `${ANO}-03-05` }),
        pag({ id: "p3", valorCentavos: 300_000, dataPagamento: `${ANO}-02-05` }),
      ],
    );
  }

  it("o padrão é data decrescente — o mais recente primeiro", () => {
    expect(ORDEM_PADRAO).toEqual({ coluna: "data", direcao: "desc" });
    const { linhas } = cenario();
    expect(ordenarLinhas(linhas, ORDEM_PADRAO).map((l) => l.id)).toEqual([
      "pagamento:p2",
      "pagamento:p3",
      "pagamento:p1",
      // sem data de pagamento: sempre no fim
      "documento:d9",
    ]);
  });

  it("linha sem data de pagamento fica no fim nas DUAS direções", () => {
    const { linhas } = cenario();
    const asc = ordenarLinhas(linhas, { coluna: "data", direcao: "asc" });
    expect(asc.map((l) => l.id)).toEqual([
      "pagamento:p1",
      "pagamento:p3",
      "pagamento:p2",
      "documento:d9",
    ]);
    expect(asc.at(-1)!.dataPagamento).toBeNull();
  });

  it("ordena por valor nas duas direções", () => {
    const { linhas } = cenario();
    expect(
      ordenarLinhas(linhas, { coluna: "valor", direcao: "desc" }).map(
        (l) => l.valorCentavos,
      ),
    ).toEqual([900_000, 500_000, 300_000, 100_000]);
    expect(
      ordenarLinhas(linhas, { coluna: "valor", direcao: "asc" }).map(
        (l) => l.valorCentavos,
      ),
    ).toEqual([100_000, 300_000, 500_000, 900_000]);
  });

  it("empate desempata por id — a tabela não dança entre carregamentos", () => {
    const { linhas } = projetar(
      [],
      [
        pag({ id: "pb", valorCentavos: 100_000, dataPagamento: `${ANO}-01-05` }),
        pag({ id: "pa", valorCentavos: 100_000, dataPagamento: `${ANO}-01-05` }),
      ],
    );
    for (const ordem of [
      ORDEM_PADRAO,
      { coluna: "data", direcao: "asc" },
      { coluna: "valor", direcao: "desc" },
    ] as const) {
      expect(ordenarLinhas(linhas, ordem).map((l) => l.id)).toEqual([
        "pagamento:pa",
        "pagamento:pb",
      ]);
    }
  });

  it("ordenar não cria, não perde e não muda linha nenhuma", () => {
    const { linhas } = cenario();
    const ordenadas = ordenarLinhas(linhas, { coluna: "valor", direcao: "asc" });
    expect(ordenadas).toHaveLength(linhas.length);
    expect(somaDeValores(ordenadas)).toBe(somaDeValores(linhas));
    expect([...ordenadas].sort()).not.toBe(linhas);
  });

  it("clique no cabeçalho: mesma coluna inverte, coluna nova nasce decrescente", () => {
    expect(proximaOrdem(ORDEM_PADRAO, "data")).toEqual({
      coluna: "data",
      direcao: "asc",
    });
    expect(proximaOrdem(ORDEM_PADRAO, "valor")).toEqual({
      coluna: "valor",
      direcao: "desc",
    });
    expect(
      proximaOrdem({ coluna: "valor", direcao: "asc" }, "valor"),
    ).toEqual({ coluna: "valor", direcao: "desc" });
  });
});
