/**
 * **CONTAI-005 · R1** — *"teste unitário cobre a composição do headline com
 * cada tipo isolado e combinado, e afirma que o headline NÃO é a soma de
 * `pendencias[]`; inclui a dedup por vínculo explícito, escrita já agora mesmo
 * sem efeito hoje"*.
 *
 * ⚠️ **Este arquivo é o registro que não envelhece** (pre-mortem 2 do ticket):
 * no dia em que a definição do número mudar, é aqui que se lê o que ele
 * significava na declaração deste ano — e não num comentário de tela.
 *
 * Fonte das regras: `docs/pareceres/2026-08-16-gate-fiscal-contai-004-005.md`,
 * Parte 2. Nada aqui é inferido.
 */

import { describe, expect, it } from "vitest";

import { calcularResumo, type EntradaResumo } from "@/lib/fiscal/resumo";
import {
  ALIQUOTA_GANHO_CAPITAL,
  CUSTO_EM_RISCO_ZERO,
  impostoAteCentavos,
  INSS_CONTINUAM_VALENDO_NO_IRPF,
  textoImpostoAte,
  tituloAfericaoInss,
} from "@/lib/fiscal/risco";
import { formatarBRL } from "@/lib/money";
import type { Documento, Obra, Pagamento } from "@/lib/types";

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

function doc(over: Partial<Documento> & { id: string }): Documento {
  return {
    obraId: OBRA.id,
    tipo: "nf_material",
    status: "registrado",
    valorCentavos: 100_000,
    numero: "1042",
    serie: null,
    dataEmissao: "2026-03-20",
    vencimento: null,
    classificacao: "material",
    favorecidoId: "fav-emitente",
    destinatarioCpfOk: true,
    retencao11: null,
    cnoReferenciado: null,
    notaTrazCno: null,
    motivoQuarentena: null,
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
    dataPagamento: "2026-05-10",
    meio: "pix",
    status: "aguardando_nf",
    favorecidoId: "fav-1",
    favorecidoNome: "AJE Construções",
    favorecidoTipo: "pj",
    comprovantePath: "u/comprovante/a.pdf",
    encargosCentavos: 0,
    naoExplicadoCentavos: 0,
    resolucaoDiferenca: null,
    documentoIds: [],
    ...over,
  };
}

function risco(over: Partial<EntradaResumo> = {}) {
  return calcularResumo({
    obra: OBRA,
    documentos: [],
    pagamentos: [],
    desembolsosTerreno: [],
    informesFinanciamento: [],
    financiamento: null,
    ano: 2026,
    ...over,
  });
}

/** O documento em quarentena do cenário do mock: R$ 4.850 fora do CPF. */
const QUARENTENA = doc({
  id: "d-quarentena",
  status: "quarentena",
  destinatarioCpfOk: false,
  valorCentavos: 485_000,
  motivoQuarentena: "Documento não está no CPF do dono da obra",
});

describe("headline — cada tipo isolado (§1 do parecer)", () => {
  it("ENTRA: documento em quarentena, pelo valor do documento", () => {
    const r = risco({ documentos: [QUARENTENA] });
    expect(r.custoEmRiscoIr).toEqual({
      totalCentavos: 485_000,
      pagosSemNotaCentavos: 0,
      notaForaDoCpfCentavos: 485_000,
      pagosSemComprovanteCentavos: 0,
    });
  });

  it("ENTRA: pagamento sem nota que o cubra, pelo valor exposto", () => {
    const r = risco({ pagamentos: [pag({ id: "p1", valorCentavos: 4_500_000 })] });
    expect(r.custoEmRiscoIr).toEqual({
      totalCentavos: 4_500_000,
      pagosSemNotaCentavos: 4_500_000,
      notaForaDoCpfCentavos: 0,
      pagosSemComprovanteCentavos: 0,
    });
  });

  it("⚠️ NÃO ENTRA: boleto — sem desembolso não há dispêndio (§3)", () => {
    const r = risco({
      documentos: [
        doc({
          id: "b1",
          tipo: "boleto",
          status: "aguardando_pagamento",
          valorCentavos: 2_500_000,
        }),
      ],
    });
    expect(r.custoEmRiscoIr.totalCentavos).toBe(0);
    // E continua visível como pendência própria — sai do total, não da tela.
    expect(r.pendencias.map((p) => p.tipo)).toEqual(["boleto_sem_nf"]);
  });

  it("⚠️ NÃO ENTRA: NF de serviço sem retenção — é outra apuração (§2)", () => {
    const r = risco({
      documentos: [
        doc({
          id: "s1",
          tipo: "nf_servico",
          retencao11: false,
          valorCentavos: 1_800_000,
        }),
      ],
      pagamentos: [
        pag({ id: "p1", documentoIds: ["s1"], valorCentavos: 1_800_000 }),
      ],
    });
    // A nota está no CPF do Mateus e foi paga: ela é custo CONFIRMADO. Pô-la em
    // "custo em risco" afirmaria o oposto exato da verdade fiscal dela.
    expect(r.custoEmRiscoIr.totalCentavos).toBe(0);
    expect(r.custoConfirmadoAnoCentavos).toBe(1_800_000);
    // Em campo próprio, EM BASE.
    expect(r.exposicaoInssBaseCentavos).toBe(1_800_000);
  });

  /**
   * **A TERCEIRA PARCELA — decisão do `contador` no Gate 2 do CONTAI-005.**
   *
   * O art. 17 da IN SRF 84/2001 é condição **composta**: dispêndio comprovado
   * **E** documentação hábil. Cada parcela do headline falha uma perna —
   * "pago sem nota" a documental, "pago sem comprovante" a da comprovação do
   * desembolso. Mesma moeda, mesma unidade, mesma consequência.
   */
  it("ENTRA: pagamento sem comprovante, pelo valor bloqueado por ele", () => {
    const r = risco({
      pagamentos: [
        pag({ id: "p1", comprovantePath: null, valorCentavos: 1_000_000 }),
      ],
    });
    expect(r.custoEmRiscoIr).toEqual({
      totalCentavos: 1_000_000,
      pagosSemNotaCentavos: 0,
      notaForaDoCpfCentavos: 0,
      pagosSemComprovanteCentavos: 1_000_000,
    });
  });

  it("⚠️ (a) e (c) nunca contam o mesmo dinheiro: R$ 10.000, não R$ 20.000", () => {
    const r = risco({
      pagamentos: [
        pag({ id: "p1", comprovantePath: null, valorCentavos: 1_000_000 }),
      ],
    });
    // Sem comprovante o elegível é ZERO, logo `semNotaCentavos` é zero: as duas
    // parcelas são mutuamente exclusivas por construção, não por atenção.
    expect(r.custoEmRiscoIr.pagosSemNotaCentavos).toBe(0);
    expect(r.custoEmRiscoIr.totalCentavos).toBe(1_000_000);
  });

  it("⚠️ NÃO ENTRA: diferença sem explicação — natureza fiscal indeterminada", () => {
    const r = risco({
      pagamentos: [
        pag({
          id: "p1",
          documentoIds: ["d1"],
          valorCentavos: 1_100_000,
          naoExplicadoCentavos: 100_000,
        }),
      ],
      documentos: [doc({ id: "d1", valorCentavos: 1_000_000 })],
    });
    // Ela pode nunca virar custo (mora, item não incorporado, erro de registro):
    // somá-la afirmaria a perda de um custo que talvez não exista. Continua
    // visível na pendência própria — sai do total, não da tela.
    expect(r.pendencias.some((p) => p.tipo === "diferenca_sem_explicacao")).toBe(
      true,
    );
    expect(r.custoEmRiscoIr.totalCentavos).toBe(0);
  });

  it("⚠️ NÃO ENTRA: pagamento coberto por documento hábil", () => {
    const r = risco({
      documentos: [doc({ id: "d1", valorCentavos: 300_000 })],
      pagamentos: [
        pag({ id: "p1", documentoIds: ["d1"], valorCentavos: 300_000 }),
      ],
    });
    expect(r.custoEmRiscoIr.totalCentavos).toBe(0);
  });

  it("obra sem registro nenhum: zero, e o zero tem texto", () => {
    const r = risco();
    expect(r.custoEmRiscoIr.totalCentavos).toBe(0);
    expect(CUSTO_EM_RISCO_ZERO).toContain("hoje");
  });
});

describe("headline — combinado, o cenário do mock v5", () => {
  /**
   * O cenário inteiro da home de 24/08: quarentena de 4.850, boleto de 25.000,
   * NF de serviço sem retenção de 18.000 e 45.000 em PIX sem nota.
   *
   * **O número correto é R$ 49.850 — nem 92.850, nem 47.850.**
   */
  const completo = () =>
    risco({
      documentos: [
        QUARENTENA,
        doc({
          id: "b1",
          tipo: "boleto",
          status: "aguardando_pagamento",
          valorCentavos: 2_500_000,
        }),
        doc({
          id: "s1",
          tipo: "nf_servico",
          retencao11: false,
          valorCentavos: 1_800_000,
        }),
      ],
      pagamentos: [
        pag({ id: "p1", valorCentavos: 1_500_000, dataPagamento: "2026-06-05" }),
        pag({ id: "p2", valorCentavos: 1_500_000, dataPagamento: "2026-07-05" }),
        pag({ id: "p3", valorCentavos: 1_500_000, dataPagamento: "2026-08-05" }),
      ],
    });

  it("R$ 49.850, com a decomposição que a R4 obriga a mostrar", () => {
    expect(completo().custoEmRiscoIr).toEqual({
      totalCentavos: 4_985_000,
      pagosSemNotaCentavos: 4_500_000,
      notaForaDoCpfCentavos: 485_000,
      // Todos os PIX deste cenário têm comprovante: a terceira parcela existe
      // e está zerada — e aparece em tela mesmo assim (R4).
      pagosSemComprovanteCentavos: 0,
    });
  });

  it("⚠️ o headline NÃO é a soma de `pendencias[]` (os 92.850 recusados)", () => {
    const r = completo();
    const somaCrua = r.pendencias.reduce((s, p) => s + p.valorCentavos, 0);
    expect(somaCrua).toBe(9_285_000);
    expect(r.custoEmRiscoIr.totalCentavos).toBeLessThan(somaCrua);
  });

  it("⚠️ o INSS fica FORA, em base, e o total não o inclui em direção nenhuma", () => {
    const r = completo();
    expect(r.exposicaoInssBaseCentavos).toBe(1_800_000);
    expect(r.custoEmRiscoIr.totalCentavos).toBe(4_985_000);
    expect(
      r.custoEmRiscoIr.totalCentavos + r.exposicaoInssBaseCentavos,
    ).not.toBe(r.custoEmRiscoIr.totalCentavos);
  });

  it("a exposição de INSS é a MESMA soma dos cards 'sem retenção' da tela", () => {
    const r = completo();
    expect(r.exposicaoInssBaseCentavos).toBe(
      r.pendencias
        .filter((p) => p.tipo === "servico_sem_retencao")
        .reduce((s, p) => s + p.valorCentavos, 0),
    );
  });
});

/**
 * **A base do INSS — duas famílias, UMA VEZ POR DOCUMENTO.**
 *
 * Regra do `contador` no Gate 2: *"soma, uma vez por `documento.id`, do
 * `valorCentavos` de toda NF de serviço fora de quarentena que atenda
 * `(retencao11 !== true)` OU `(obra tem CNO e notaTrazCno === false)`"*.
 */
describe("R2 — a base da aferição, por união de documentos", () => {
  it("a nota SEM CNO impresso entra, mesmo com retenção de 11%", () => {
    const r = risco({
      documentos: [
        doc({
          id: "s1",
          tipo: "nf_servico",
          retencao11: true,
          notaTrazCno: false,
          valorCentavos: 900_000,
        }),
      ],
    });
    expect(r.exposicaoInssBaseCentavos).toBe(900_000);
  });

  it("⚠️ a nota com as DUAS pendências conta UMA vez — nunca a soma das listas", () => {
    const r = risco({
      documentos: [
        doc({
          id: "s1",
          tipo: "nf_servico",
          retencao11: false,
          notaTrazCno: false,
          valorCentavos: 900_000,
        }),
      ],
    });
    // As duas pendências existem e as duas aparecem em tela (elas são
    // aditivas) — mas a BASE é 900.000, não 1.800.000. Somar os dois arrays de
    // `pendencias` filtrados dobraria o valor deste documento, que é o defeito
    // que o ticket inteiro existe para matar.
    expect(
      r.pendencias.filter(
        (p) =>
          p.tipo === "servico_sem_retencao" || p.tipo === "nf_servico_sem_cno",
      ),
    ).toHaveLength(2);
    expect(r.exposicaoInssBaseCentavos).toBe(900_000);
  });

  it("obra SEM CNO: a falta do CNO na nota não cria exposição", () => {
    const r = calcularResumo({
      obra: { ...OBRA, cno: null, cnoRegistradoEm: null },
      documentos: [
        doc({
          id: "s1",
          tipo: "nf_servico",
          retencao11: true,
          notaTrazCno: false,
          valorCentavos: 900_000,
        }),
      ],
      pagamentos: [],
      desembolsosTerreno: [],
      informesFinanciamento: [],
      financiamento: null,
      ano: 2026,
    });
    // Mesmo silêncio do CONTAI-007: não se cobra do prestador um CNO que ainda
    // não foi registrado. Quem destrava é a pendência da OBRA.
    expect(r.exposicaoInssBaseCentavos).toBe(0);
  });

  it("nota de serviço em QUARENTENA fica fora das duas famílias", () => {
    const r = risco({
      documentos: [
        doc({
          id: "s1",
          tipo: "nf_servico",
          status: "quarentena",
          destinatarioCpfOk: false,
          retencao11: false,
          valorCentavos: 900_000,
        }),
      ],
    });
    expect(r.exposicaoInssBaseCentavos).toBe(0);
    // Ela é risco de IRPF, não de INSS: a moeda é outra e o card é outro.
    expect(r.custoEmRiscoIr.notaForaDoCpfCentavos).toBe(900_000);
  });
});

/**
 * **A dedup — escrita agora, "mesmo sem efeito hoje" (R1).**
 *
 * Sem ela o número passa a mentir no dia em que a conciliação crescer: o mesmo
 * dispêndio entraria como pagamento sem nota E como nota em quarentena.
 */
describe("dedup por vínculo EXPLÍCITO (§5)", () => {
  it("pagamento vinculado à nota em quarentena conta UMA vez", () => {
    const r = risco({
      documentos: [QUARENTENA],
      pagamentos: [
        pag({
          id: "p1",
          valorCentavos: 485_000,
          documentoIds: [QUARENTENA.id],
        }),
      ],
    });
    // 4.850 uma vez só — não 9.700.
    expect(r.custoEmRiscoIr).toEqual({
      totalCentavos: 485_000,
      pagosSemNotaCentavos: 485_000,
      notaForaDoCpfCentavos: 0,
      pagosSemComprovanteCentavos: 0,
    });
  });

  it("pagamento MENOR que a nota: o resto da nota continua exposto", () => {
    const r = risco({
      documentos: [QUARENTENA],
      pagamentos: [
        pag({
          id: "p1",
          valorCentavos: 300_000,
          documentoIds: [QUARENTENA.id],
        }),
      ],
    });
    expect(r.custoEmRiscoIr).toEqual({
      totalCentavos: 485_000,
      pagosSemNotaCentavos: 300_000,
      notaForaDoCpfCentavos: 185_000,
      pagosSemComprovanteCentavos: 0,
    });
  });

  it("um pagamento, DUAS notas em quarentena: não abate duas vezes", () => {
    const outra = doc({
      id: "d-quarentena-2",
      status: "quarentena",
      destinatarioCpfOk: false,
      valorCentavos: 485_000,
    });
    const r = risco({
      documentos: [QUARENTENA, outra],
      pagamentos: [
        pag({
          id: "p1",
          valorCentavos: 485_000,
          documentoIds: [QUARENTENA.id, outra.id],
        }),
      ],
    });
    // O orçamento do pagamento é consumível: abate na primeira nota e acaba.
    // Subtrair de novo subestimaria o risco — o erro que some com o alerta.
    expect(r.custoEmRiscoIr).toEqual({
      totalCentavos: 970_000,
      pagosSemNotaCentavos: 485_000,
      notaForaDoCpfCentavos: 485_000,
      pagosSemComprovanteCentavos: 0,
    });
  });

  it("⚠️ NUNCA por heurística: mesmo favorecido e mesmo valor, sem vínculo", () => {
    const r = risco({
      documentos: [{ ...QUARENTENA, favorecidoId: "fav-1", favorecidoNome: "AJE Construções" }],
      // Mesmo favorecido, mesmo valor, mesma semana — e NENHUM vínculo gravado.
      pagamentos: [pag({ id: "p1", valorCentavos: 485_000 })],
    });
    // Conta duas vezes, e isso é o comportamento correto: a resposta é o aviso
    // de duplicidade do CONTAI-004 (R8), sugerindo a conciliação — nunca
    // subtrair sozinho. "Heurística que subtrai em silêncio some com o alerta e
    // ninguém vê."
    expect(r.custoEmRiscoIr.totalCentavos).toBe(970_000);
  });
});

describe("R3 — a linha de imposto", () => {
  it("é 15% do headline, e só do headline", () => {
    expect(ALIQUOTA_GANHO_CAPITAL).toBe(0.15);
    expect(impostoAteCentavos(4_985_000)).toBe(747_750);
  });

  it("nunca aparece sem o 'até' e sem o disclaimer de redução/isenção", () => {
    const texto = textoImpostoAte(4_985_000);
    expect(texto).toContain("até");
    // ⚠️ `formatarBRL`, e não um literal: o `Intl` pt-BR separa "R$" do número
    // com ESPAÇO NÃO SEPARÁVEL (U+00A0), e um literal com espaço comum passa a
    // vida inteira vermelho por um motivo que não é o do teste.
    expect(texto).toContain(formatarBRL(747_750));
    expect(texto).toContain("15% sobre o valor em risco");
    expect(texto).toContain("fator de redução por tempo de posse");
    expect(texto).toContain("isenções podem diminuir");
    // O que NÃO pode estar lá: promessa de valor devido.
    expect(texto).not.toMatch(/você (vai|irá) pagar/i);
  });
});

describe("R2 — os textos do bloco de INSS", () => {
  it("o título cita o CNO da obra", () => {
    expect(tituloAfericaoInss("12.345.67890/26")).toBe(
      "Aferição do INSS — CNO 12.345.67890/26",
    );
  });

  it("⚠️ a frase que impede somar de cabeça não é opcional", () => {
    expect(INSS_CONTINUAM_VALENDO_NO_IRPF).toBe(
      "Estas notas continuam valendo integralmente como custo de aquisição no IRPF.",
    );
  });
});
