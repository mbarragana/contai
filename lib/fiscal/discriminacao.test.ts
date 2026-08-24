import { describe, expect, it } from "vitest";

import * as discriminacao from "@/lib/fiscal/discriminacao";
import {
  BLOCO_B_NAO_GERADO,
  composicaoNaoGerada,
  FALTA_CNO,
  FALTA_DATA_DA_AQUISICAO,
  FALTA_MATRICULA,
  gerarBensEDireitos,
  REVISE_ANTES_DE_COPIAR,
  REVISE_ANTES_DE_COPIAR_PORQUE,
  reviseAntesDeCopiar,
  type DadosDaDiscriminacao,
} from "@/lib/fiscal/discriminacao";
import {
  desembolsosCarregados,
  podeGerarRelatorioAnual,
  type LiberadoBensEDireitos,
} from "@/lib/fiscal/compromisso";
import { alocarCusto } from "@/lib/fiscal/vinculo";
import { formatarBRL } from "@/lib/money";
import type {
  Documento,
  Financiamento,
  FinanciamentoInforme,
  Obra,
  Pagamento,
  TerrenoDesembolso,
  TerrenoDesembolsoAnexo,
} from "@/lib/types";

const HOJE = "2026-08-24";
const OBRA = "obra-1";

function anexo(papel: TerrenoDesembolsoAnexo["papel"]): TerrenoDesembolsoAnexo {
  return {
    id: `anexo-${papel}`,
    arquivoPath: `u/terreno/${papel}.pdf`,
    papel,
    createdAt: "2026-03-12T10:00:00.000Z",
  };
}

function desembolso(
  over: Partial<TerrenoDesembolso> & { id: string },
): TerrenoDesembolso {
  return {
    obraId: OBRA,
    tipo: "entrada",
    valorCentavos: 100_000,
    dataPagamento: "2026-03-12",
    estado: "pago",
    origemRecurso: null,
    anexos: [anexo("comprovante")],
    debitosMesmoDia: null,
    debitosMesmoDiaRespondidoEm: null,
    ...over,
  };
}

function doc(over: Partial<Documento> & { id: string }): Documento {
  return {
    obraId: OBRA,
    tipo: "nf_material",
    status: "registrado",
    valorCentavos: 100_000,
    numero: "1042",
    serie: null,
    dataEmissao: "2026-03-20",
    vencimento: null,
    classificacao: "material",
    destinatarioCpfOk: true,
    retencao11: null,
    motivoQuarentena: null,
    favorecidoId: "fav-1",
    favorecidoNome: "Depósito Ilha",
    favorecidoDocumento: "12345678000199",
    arquivoPath: "u/documento/nf.pdf",
    ...over,
  };
}

function pag(over: Partial<Pagamento> & { id: string }): Pagamento {
  return {
    obraId: OBRA,
    valorCentavos: 100_000,
    dataPagamento: "2026-04-10",
    meio: "pix",
    status: "conciliado",
    favorecidoId: "fav-1",
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

const OBRA_COMPLETA: Obra = {
  id: OBRA,
  nome: "Casa Tanheiros",
  cno: "12.345.67890/12",
  matricula: "00.000",
  cartorio: "2º RGI",
  municipio: "Florianópolis/SC",
  naturezaAquisicaoTerreno: "financiado",
  dataInicioObra: "2026-02-01",
  cnoRegistradoEm: "2026-02-20",
  unidadesAutonomas: 1,
  origemDesmembramentoLoteamento: false,
};

const FINANCIAMENTO: Financiamento = {
  id: "fin-1",
  obraId: OBRA,
  instituicao: "Banco X",
  numeroContrato: "998877",
  dataContrato: "2026-03-12",
  precoContratadoCentavos: 500_000_00,
  numeroParcelas: 240,
};

const INFORME_2026: FinanciamentoInforme = {
  id: "inf-1",
  financiamentoId: "fin-1",
  anoBase: 2026,
  amortizacaoCentavos: 10_000_00,
  jurosCorrecaoCentavos: 4_000_00,
  segurosCentavos: 0,
  taxasFcvsCentavos: 0,
  moraCentavos: 0,
  multaCentavos: 0,
  diferencaTeoricoPagoCentavos: 0,
  totalPagoCentavos: 14_000_00,
  saldoDevedorCentavos: 300_000_00,
  arquivoPath: "u/informe/2026.pdf",
};

/**
 * ⚠️ **A marca só sai da PORTA.** Nenhum teste aqui a forja: quem quer gerar a
 * ficha passa pelo mesmo caminho que a tela passa.
 */
function liberado(
  ano: number,
  desembolsos: readonly TerrenoDesembolso[] = [],
): LiberadoBensEDireitos {
  const r = podeGerarRelatorioAnual(
    [],
    HOJE,
    ano,
    desembolsosCarregados(desembolsos),
  );
  if (!r.ok) throw new Error("a porta vetou — cenário errado no teste");
  return r.bensEDireitos;
}

function dados(over: Partial<DadosDaDiscriminacao> = {}): DadosDaDiscriminacao {
  return {
    obra: OBRA_COMPLETA,
    alocacao: alocarCusto({ documentos: [], pagamentos: [] }),
    desembolsosTerreno: [],
    informes: [],
    financiamento: null,
    ...over,
  };
}

// ══ Critério 6 · o aviso é INCONDICIONAL ════════════════════════════════

describe("critério 6 — 'Revise antes de copiar' é incondicional", () => {
  it("⚠️ aparece com ZERO lançamento fora da soma — e é a mudança do mock", () => {
    // Antes, ele só aparecia havendo lançamento fora, e isso ensinava a coisa
    // errada: com tudo comprovado, o texto saía sem NADA dizendo que ele não é
    // a declaração. Aviso que só aparece no caso ruim vira selo de "está tudo
    // certo" no caso bom.
    expect(reviseAntesDeCopiar(0)).toBe(
      `${REVISE_ANTES_DE_COPIAR}. ${REVISE_ANTES_DE_COPIAR_PORQUE}`,
    );
    expect(reviseAntesDeCopiar(0)).toBe(
      "Revise antes de copiar. Este texto é insumo para a sua conferência " +
        "com o profissional com CRC — não é a sua declaração pronta.",
    );
  });

  it("havendo lançamento fora, a contagem entra — no singular e no plural", () => {
    expect(reviseAntesDeCopiar(3)).toBe(
      "Revise antes de copiar — 3 lançamentos ficaram de fora da soma. " +
        "Este texto é insumo para a sua conferência com o profissional com " +
        "CRC — não é a sua declaração pronta.",
    );
    expect(reviseAntesDeCopiar(1)).toContain("1 lançamento ficou de fora da soma");
  });

  it("⚠️ NÃO afirma nada sobre matrícula, cônjuge ou quem paga", () => {
    // Não é a linha da titularidade voltando por outro nome: ela virou a D53,
    // ticket próprio, e exibi-la seria o app afirmando fato que ninguém
    // informou (§3.4 ⛔, §4.6).
    const proibido = /matrícula|cônjuge|regime de bens|escritura está|metade|50%/i;
    for (const n of [0, 1, 7]) {
      expect(proibido.test(reviseAntesDeCopiar(n))).toBe(false);
    }
  });

  it("o gerador põe o aviso SEMPRE, mesmo sem nada fora da soma", () => {
    const r = gerarBensEDireitos(liberado(2026), dados());
    expect(r.aviso).toBe(reviseAntesDeCopiar(0));
    expect(r.linhaForaDoCusto).toBeNull();
  });
});

// ══ Critérios 4 e 7 · a linha do §4.5 e os DOIS números ═════════════════

describe("§4.5 e §2.4 — nunca um número só", () => {
  const semComprovante = [
    desembolso({ id: "d1", valorCentavos: 60_000_00, anexos: [anexo("contrato")] }),
    desembolso({ id: "d2", valorCentavos: 25_000_00, anexos: [] }),
    desembolso({ id: "d3", valorCentavos: 4_200_00, dataPagamento: null, anexos: [] }),
  ];

  it("⚠️ o número da linha vem da MARCA, não dos dados da tela", () => {
    // Pre-mortem 1: "a obrigação mora no retorno tipado da porta, não na boa
    // vontade de quem escreve JSX". O gerador não recalcula nada aqui — ele
    // recebe o número de quem decidiu que a saída podia sair.
    const r = gerarBensEDireitos(
      liberado(2026, semComprovante),
      dados({ desembolsosTerreno: semComprovante }),
    );
    expect(r.foraDoCustoConfirmadoCentavos).toBe(89_200_00);
    expect(r.foraDoCustoConfirmadoQuantidade).toBe(3);
    expect(r.linhaForaDoCusto).toContain(formatarBRL(89_200_00));
    expect(r.linhaForaDoCusto).toContain("Decida com seu contador antes de declarar");
  });

  it("⚠️ o valor fora da soma NÃO entra no bloco copiável", () => {
    // §2.1, metade automática: o número que o app calcula sozinho soma só
    // desembolso pago, com data E com comprovante.
    const r = gerarBensEDireitos(
      liberado(2026, semComprovante),
      dados({ desembolsosTerreno: semComprovante }),
    );
    expect(r.blocoCopiavel).not.toContain(formatarBRL(89_200_00));
    expect(r.acumuladoCentavos).toBe(0);
  });

  it("⚠️ o portão do comprovante vale DENTRO do bloco, rubrica por rubrica", () => {
    // O defeito que isto trava: somar a entrada sem o portão põe, DENTRO do
    // bloco copiável, o mesmo valor que a linha logo abaixo dele declara estar
    // FORA da soma. A contradição ficaria a duas linhas de distância, na mesma
    // tela, dentro do texto que vai colado na declaração.
    const mistura = [
      desembolso({ id: "com", tipo: "entrada", valorCentavos: 100_000_00 }),
      desembolso({ id: "sem", tipo: "entrada", valorCentavos: 25_000_00, anexos: [] }),
    ];
    const r = gerarBensEDireitos(
      liberado(2026, mistura),
      dados({
        desembolsosTerreno: mistura,
        financiamento: FINANCIAMENTO,
        informes: [],
      }),
    );
    expect(r.blocoCopiavel).toContain(`entrada de ${formatarBRL(100_000_00)}`);
    expect(r.blocoCopiavel).not.toContain(formatarBRL(125_000_00));
    expect(r.linhaForaDoCusto).toContain(formatarBRL(25_000_00));
    // E o acumulado do bloco bate com a rubrica: 100.000, não 125.000.
    expect(r.acumuladoCentavos).toBe(100_000_00);
  });

  it("⚠️ a linha fica FORA do bloco copiável — dentro é texto de declaração", () => {
    const r = gerarBensEDireitos(
      liberado(2026, semComprovante),
      dados({ desembolsosTerreno: semComprovante }),
    );
    expect(r.blocoCopiavel).not.toContain("Decida com seu contador");
    expect(r.blocoCopiavel).not.toContain("Revise antes de copiar");
    expect(r.blocoCopiavel).not.toContain(BLOCO_B_NAO_GERADO);
  });

  it("sem nada fora da soma, a linha NÃO aparece", () => {
    const comprovados = [desembolso({ id: "d1", valorCentavos: 80_000_00 })];
    const r = gerarBensEDireitos(
      liberado(2026, comprovados),
      dados({ desembolsosTerreno: comprovados }),
    );
    expect(r.linhaForaDoCusto).toBeNull();
    expect(r.acumuladoCentavos).toBe(80_000_00);
    expect(r.blocoCopiavel).toContain(formatarBRL(80_000_00));
  });
});

// ══ Critério 3 · Bloco A literal, e a ausência do Bloco B NOMEADA ═══════

describe("Bloco A — literal, com as ausências nomeadas", () => {
  it("terreno financiado usa a emenda de 2026-08-17 §4", () => {
    const desembolsos = [
      desembolso({ id: "d1", tipo: "entrada", valorCentavos: 100_000_00 }),
      desembolso({ id: "d2", tipo: "itbi", valorCentavos: 10_000_00 }),
      desembolso({ id: "d3", tipo: "escritura_registro", valorCentavos: 5_000_00 }),
    ];
    const r = gerarBensEDireitos(
      liberado(2026, desembolsos),
      dados({
        desembolsosTerreno: desembolsos,
        financiamento: FINANCIAMENTO,
        informes: [INFORME_2026],
      }),
    );
    const t = r.blocoCopiavel;
    expect(t).toContain("IMÓVEL RESIDENCIAL EM CONSTRUÇÃO.");
    expect(t).toContain("Terreno matrícula nº 00.000 do 2º RGI, Florianópolis/SC");
    expect(t).toContain("adquirido em 12/03/2026 pelo preço de");
    expect(t).toContain("financiado junto a Banco X, contrato nº 998877");
    // ⚠️ Regra 1 do §4 — não é enfeite e não é cortável: é ela que explica por
    // que o valor declarado é MENOR que o preço da escritura.
    expect(t).toContain("Declarado pelo valor efetivamente pago, conforme regime de caixa");
    // ⚠️ Regra 3 — os juros vão NOMEADOS ou não vão.
    expect(t).toContain("a título de juros e encargos do financiamento");
    expect(t).toContain(formatarBRL(4_000_00));
    // ⚠️ Regra 2 — o saldo devedor aparece e é ROTULADO.
    expect(t).toContain(
      `Saldo devedor do financiamento em 31/12/2026: ${formatarBRL(300_000_00)}, ` +
        "não incluído por não ter sido pago.",
    );
    expect(t).toContain("obra inscrita no CNO nº 12.345.67890/12");
    expect(t).toContain("Situação em 31/12/2025:");
    expect(t).toContain("Situação em 31/12/2026:");
    expect(t).toContain(
      "Dispêndios comprovados por notas fiscais e recibos emitidos em nome e " +
        "CPF do declarante, mantidos em seu poder.",
    );
  });

  it("⚠️ o Bloco B NUNCA sai — e a ausência é NOMEADA, nunca placeholder", () => {
    // Pre-mortem 2: "Bloco A saindo com cara de completo entrega texto de
    // declaração incompleto parecendo pronto".
    const r = gerarBensEDireitos(liberado(2026), dados());
    expect(r.faltas).toContain(BLOCO_B_NAO_GERADO);
    expect(r.blocoCopiavel).not.toContain("NF nº");
    expect(r.blocoCopiavel).not.toContain("—");
    expect(r.blocoCopiavel).not.toMatch(/\[[a-zà-ú ]+\]/i);
  });

  it("dado de cadastro que falta é NOMEADO, e não vira placeholder", () => {
    const semCadastro: Obra = {
      ...OBRA_COMPLETA,
      cno: null,
      matricula: null,
      cartorio: null,
      municipio: null,
      naturezaAquisicaoTerreno: "a_vista",
    };
    const r = gerarBensEDireitos(liberado(2026), dados({ obra: semCadastro }));
    expect(r.faltas).toContain(FALTA_MATRICULA);
    expect(r.faltas).toContain(FALTA_CNO);
    expect(r.faltas).toContain(FALTA_DATA_DA_AQUISICAO);
    expect(r.blocoCopiavel).not.toContain("null");
    expect(r.blocoCopiavel).not.toContain("undefined");
    expect(r.blocoCopiavel).not.toContain("CNO nº");
  });

  it("⚠️ o app NÃO deduz a data da aquisição da data de um pagamento", () => {
    // A data que vale aqui é a da escritura, e ela não está gravada em campo
    // nenhum. Deduzir seria inventar fato — a proibição estrutural do projeto.
    const d = [desembolso({ id: "d1", tipo: "pagamento_terreno", dataPagamento: "2026-03-12" })];
    const r = gerarBensEDireitos(
      liberado(2026, d),
      dados({ desembolsosTerreno: d, obra: { ...OBRA_COMPLETA, naturezaAquisicaoTerreno: "a_vista" } }),
    );
    expect(r.faltas).toContain(FALTA_DATA_DA_AQUISICAO);
    expect(r.blocoCopiavel).not.toContain("adquirido em 12/03/2026");
  });
});

// ══ A cláusula material × mão de obra (parecer de 24/08) ════════════════

describe("a cláusula da composição — parecer de 2026-08-24", () => {
  const notaMaterial = doc({ id: "d1", valorCentavos: 60_000, classificacao: "material" });
  const notaServico = doc({
    id: "d2",
    valorCentavos: 40_000,
    tipo: "nf_servico",
    classificacao: "mao_obra",
  });
  const pagamento = pag({
    id: "p1",
    valorCentavos: 100_000,
    dataPagamento: "2026-04-10",
    documentoIds: ["d1", "d2"],
  });

  it("classificado por inteiro: a cláusula entra, e X + Y = total", () => {
    const r = gerarBensEDireitos(
      liberado(2026),
      dados({
        alocacao: alocarCusto({
          documentos: [notaMaterial, notaServico],
          pagamentos: [pagamento],
        }),
      }),
    );
    expect(r.blocoCopiavel).toContain(
      `Dispêndios pagos no ano-calendário de 2026: ${formatarBRL(100_000)}, ` +
        `sendo ${formatarBRL(60_000)} em materiais e ${formatarBRL(40_000)} ` +
        "em mão de obra e serviços.",
    );
    expect(r.faltas.some((f) => f.includes("composição entre materiais"))).toBe(false);
  });

  it("⚠️ nota hábil sem classificação SUSPENDE a cláusula, e a ausência é nomeada", () => {
    // §4: as duas alternativas são piores — `X + Y ≠ total` publica partição
    // falsa num campo da DAA; jogar o não classificado num balde é default em
    // campo fiscal, proibido.
    const semClasse = doc({ id: "d2", valorCentavos: 40_000, classificacao: null });
    const r = gerarBensEDireitos(
      liberado(2026),
      dados({
        alocacao: alocarCusto({
          documentos: [notaMaterial, semClasse],
          pagamentos: [pagamento],
        }),
      }),
    );
    expect(r.blocoCopiavel).toContain(
      `Dispêndios pagos no ano-calendário de 2026: ${formatarBRL(100_000)}.`,
    );
    expect(r.blocoCopiavel).not.toContain("sendo");
    expect(r.faltas).toContain(composicaoNaoGerada(1, 2026));
    // O total continua completo — falta só a repartição dele (§5).
    expect(r.totalConfirmadoAnoCentavos).toBe(100_000);
  });

  it("⛔ Gate 2 — nota sem classificação com COBERTO ZERO ainda é contada", () => {
    // O defeito: a contagem varria o acervo por `cobertoCentavos > 0`, e o
    // lado do documento é repartido por ORDEM DE ID — que o próprio código
    // declara "sem efeito fiscal nenhum". Componente subcoberto em que a nota
    // sem classificação tem id maior recebe coberto ZERO, e o texto saía
    // dizendo **"0 nota que compõem o total"** enquanto suspendia a cláusula.
    const a = doc({ id: "a-material", valorCentavos: 100_000, classificacao: "material" });
    const b = doc({ id: "b-sem-classe", valorCentavos: 100_000, classificacao: null });
    const p = pag({
      id: "p1",
      valorCentavos: 100_000,
      dataPagamento: "2026-04-10",
      documentoIds: ["a-material", "b-sem-classe"],
    });
    const alocacao = alocarCusto({ documentos: [a, b], pagamentos: [p] });
    // O cenário é REAL: a nota sem classificação está com coberto zero.
    expect(alocacao.porDocumento.get("b-sem-classe")!.cobertoCentavos).toBe(0);

    const r = gerarBensEDireitos(liberado(2026), dados({ alocacao }));
    expect(r.faltas).toContain(composicaoNaoGerada(1, 2026));
    expect(r.faltas.some((f) => f.startsWith("A composição") && f.includes("0 nota"))).toBe(
      false,
    );
  });

  it("⛔ Gate 2 — nota de componente que NÃO pôs centavo no ano não é contada", () => {
    // O segundo modo de errar: a varredura do acervo inteiro contava nota de
    // componente cujos pagamentos caem todos em outro ano — componente que não
    // toca o número deste ano e não suspende coisa nenhuma dele.
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
      documentoIds: ["d-sem-2026", "d-mat"],
    });
    const r = gerarBensEDireitos(
      liberado(2026),
      dados({
        alocacao: alocarCusto({
          documentos: [
            doc({ id: "d-sem-2024", valorCentavos: 50_000, classificacao: null }),
            doc({ id: "d-sem-2026", valorCentavos: 10_000, classificacao: null }),
            doc({ id: "d-mat", valorCentavos: 20_000, classificacao: "material" }),
          ],
          pagamentos: [outroAno, doAno],
        }),
      }),
    );
    // Uma só: a de 2026. A de 2024 não entra na frase do ano de 2026.
    expect(r.faltas).toContain(composicaoNaoGerada(1, 2026));
  });

  it("o texto da suspensão é literal do §6, no singular e no plural", () => {
    expect(composicaoNaoGerada(1, 2026)).toBe(
      "A composição entre materiais e mão de obra não foi gerada: 1 nota que " +
        "compõem o total de 2026 ainda não estão classificadas. O total acima " +
        "está completo — falta só a repartição dele. Classifique essas notas e " +
        "a frase entra no texto. O app não escolhe essa classificação no seu lugar.",
    );
    expect(composicaoNaoGerada(3, 2026)).toContain("3 notas que compõem o total de 2026");
  });
});

// ══ Gate Fiscal §1 · a CONDIÇÃO ÚNICA ═══════════════════════════════════

describe("⚠️ condição única do Gate Fiscal — posse não se acopla ao total", () => {
  it("nenhum texto exportado diz 'seu custo', 'você pagou' ou 'seu ganho'", () => {
    // O valor cheio é número VERDADEIRO — foi o que saiu pelo bem inteiro. O
    // que estaria errado é o RÓTULO. O bloco se rotula pelo BEM e pela OBRA.
    const proibido = /seu custo|você pagou|voce pagou|seu ganho|seus custos/i;
    let conferidos = 0;
    for (const [nome, valor] of Object.entries(discriminacao)) {
      if (typeof valor === "string") {
        conferidos += 1;
        expect(proibido.test(valor), `${nome} acopla posse ao total`).toBe(false);
      }
    }
    expect(conferidos).toBeGreaterThan(3);
    // E os textos montados em função, um a um.
    for (const t of [
      reviseAntesDeCopiar(0),
      reviseAntesDeCopiar(4),
      composicaoNaoGerada(2, 2026),
    ]) {
      expect(proibido.test(t)).toBe(false);
    }
  });

  it("o bloco gerado se rotula pelo BEM e pela OBRA, nunca pelo dono", () => {
    const desembolsos = [desembolso({ id: "d1", valorCentavos: 100_000_00 })];
    const r = gerarBensEDireitos(
      liberado(2026, desembolsos),
      dados({
        desembolsosTerreno: desembolsos,
        financiamento: FINANCIAMENTO,
        informes: [INFORME_2026],
      }),
    );
    expect(/seu custo|você pagou|seu ganho/i.test(r.blocoCopiavel)).toBe(false);
    // A única menção ao declarante é a frase literal do Bloco A, que fala de
    // NOME E CPF NAS NOTAS — não de quem é dono do bem (§3.4 ⛔).
    expect(r.blocoCopiavel).toContain("em nome e CPF do declarante");
    expect(/matrícula está em|em dois nomes|cônjuge/i.test(r.blocoCopiavel)).toBe(false);
  });
});
