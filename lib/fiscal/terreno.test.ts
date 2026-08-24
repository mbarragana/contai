import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { formatarBRL } from "@/lib/money";
import * as terreno from "@/lib/fiscal/terreno";
import {
  desembolsosCarregados,
  podeGerarRelatorioAnual,
  type LiberadoBensEDireitos,
} from "@/lib/fiscal/compromisso";
import {
  acaoDaPendenciaDeDatas,
  ANTES_DE_DIZER_O_QUE_E_CADA_PAPEL,
  anosDoFinanciamento,
  CHIP_FALTA_DATA_E_COMPROVANTE,
  CHIP_PAGO_SEM_COMPROVANTE,
  COMECE_PELA_DATA,
  COMPROVANTE_POR_TIPO,
  comprovantesDe,
  DATA_NO_FUTURO,
  DATA_NO_FUTURO_NO_COMPLEMENTO,
  dataInformada,
  desembolsoRegistrado,
  DESEMBOLSO_SEM_DATA,
  estadoDoGravar,
  FALTA_DATA_E_COMPROVANTE,
  FORA_DO_CUSTO_CONFIRMADO,
  FORA_DO_CUSTO_CONFIRMADO_DECIDA_NO_RELATORIO,
  FORA_DO_CUSTO_CONFIRMADO_PORQUE,
  linhaForaDoCustoConfirmado,
  GRAVAR_E_ABRIR_A_PENDENCIA_DA_DATA,
  GRAVAR_E_ABRIR_A_PENDENCIA_DO_COMPROVANTE,
  GRAVAR_E_ABRIR_AS_DUAS_PENDENCIAS,
  GRAVAR_O_DESEMBOLSO,
  O_QUE_SERVE_COMO_COMPROVANTE,
  PAGO_SEM_COMPROVANTE,
  PAGO_SEM_PAPEL,
  pagoSemComprovante,
  pagosSemComprovante,
  temComprovante,
  totalPagoSemComprovanteCentavos,
  corpoDaPendenciaDeDatas,
  custoDoInformeCentavos,
  custoTerrenoAteOAno,
  custoTerrenoDoAno,
  entraEmAlgumAno,
  INSUMO_PARA_REVISAO_CRC,
  opcaoTudoEm,
  pagoSemPapel,
  penalidadesCentavos,
  pendenciaDeDatasAberta,
  perguntaNoComplemento,
  perguntaNoRegistro,
  perguntaPendente,
  perguntaRepresada,
  rubricasComClassificacaoEmAberto,
  ROTULO_DO_PAPEL,
  somaDasRubricasCentavos,
  TAXAS_E_FCVS_NA_MESMA_LINHA,
  temDoisComprovantes,
  tiposDeDesembolsoPara,
  travaDaSoma,
} from "@/lib/fiscal/terreno";
import type {
  Compromisso,
  FinanciamentoInforme,
  PapelDeAnexo,
  TerrenoDesembolso,
  TerrenoDesembolsoAnexo,
} from "@/lib/types";

/**
 * Os quatro testes obrigatórios do critério 24, mais os do Gate 1:
 * (a) terreno pago em 2024 + ITBI em 2025 → 2024 soma só o terreno;
 * (b) a trava da soma recusando, com a diferença EXATA na mensagem;
 * (c) a trava da dupla contagem;
 * (d) amortização + juros somando e as demais CINCO rubricas não.
 *
 * Valores: os do extrato real do ano-base 2025, que é o caso que motivou o
 * ticket. Nenhum identificador (CPF, contrato, agência) — o repositório é
 * público; a instituição, quando precisa aparecer, é "Banco Litoral".
 */

// Extrato do ano-base 2025: 16.883,52 + 43.051,23 + 499,56 + 167,43 = 60.601,74
const INFORME_2025: FinanciamentoInforme = {
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

/**
 * Um papel do desembolso. `createdAt` é explícito em todo teste que depende da
 * linha do tempo da re-pergunta (§6) — nada aqui usa o relógio da máquina.
 */
function anexo(
  papel: PapelDeAnexo,
  createdAt = "2024-09-12T10:00:00.000Z",
  id = `anexo-${papel}-${createdAt}`,
): TerrenoDesembolsoAnexo {
  return { id, arquivoPath: `u/terreno/${id}.pdf`, papel, createdAt };
}

function desembolso(
  over: Partial<TerrenoDesembolso> & { id: string },
): TerrenoDesembolso {
  return {
    obraId: "obra-1",
    tipo: "pagamento_terreno",
    valorCentavos: 100_000,
    dataPagamento: "2024-09-12",
    estado: "pago",
    origemRecurso: null,
    anexos: [anexo("comprovante")],
    debitosMesmoDia: null,
    debitosMesmoDiaRespondidoEm: null,
    ...over,
  };
}

function informe(
  over: Partial<FinanciamentoInforme> & { id: string },
): FinanciamentoInforme {
  return { ...INFORME_2025, ...over };
}

// ── Critério 24a ─────────────────────────────────────────────────────────

describe("cada desembolso no ano da SUA data (critério 24a)", () => {
  const terreno = desembolso({
    id: "d1",
    tipo: "pagamento_terreno",
    valorCentavos: 42_000_000,
    dataPagamento: "2024-09-12",
  });
  const itbi = desembolso({
    id: "d2",
    tipo: "itbi",
    valorCentavos: 1_260_000,
    dataPagamento: "2025-02-03",
  });

  it("2024 soma só o terreno; 2025 soma os dois", () => {
    expect(custoTerrenoAteOAno([terreno, itbi], [], 2024).confirmadoCentavos).toBe(
      42_000_000,
    );
    expect(custoTerrenoAteOAno([terreno, itbi], [], 2025).confirmadoCentavos).toBe(
      43_260_000,
    );
  });

  it("o que cai DENTRO de cada ano é só o daquele ano", () => {
    expect(custoTerrenoDoAno([terreno, itbi], [], 2024).confirmadoCentavos).toBe(
      42_000_000,
    );
    expect(custoTerrenoDoAno([terreno, itbi], [], 2025).confirmadoCentavos).toBe(
      1_260_000,
    );
  });

  it("o defeito que o ticket conserta: o terreno NÃO entra em todo ano", () => {
    // Antes do CONTAI-010, `custoTerrenoCentavos(obra)` injetava a soma inteira
    // em TODO ano, inclusive nos anteriores ao pagamento.
    expect(custoTerrenoAteOAno([terreno, itbi], [], 2023).confirmadoCentavos).toBe(
      0,
    );
  });
});

// ── Critérios 5 e 6 ──────────────────────────────────────────────────────

describe("previsto e pago-sem-data não entram em ano nenhum", () => {
  const anoCorrente = 2026;

  it("previsto não entra nem no ano corrente — previsto não é pago", () => {
    const previsto = desembolso({
      id: "d1",
      tipo: "itbi",
      valorCentavos: 1_260_000,
      dataPagamento: null,
      estado: "previsto",
      anexos: [],
    });
    expect(entraEmAlgumAno(previsto)).toBe(false);
    // ⚠️ Previsto não entra em NENHUM dos dois números: não foi pago. Somá-lo
    // ao "sem comprovante" seria trocar a trava de lugar — o valor apareceria
    // como custo real fora da soma, e ele não é custo nenhum ainda.
    expect(custoTerrenoAteOAno([previsto], [], anoCorrente)).toEqual({
      confirmadoCentavos: 0,
      semComprovanteCentavos: 0,
    });
    expect(custoTerrenoDoAno([previsto], [], anoCorrente)).toEqual({
      confirmadoCentavos: 0,
      semComprovanteCentavos: 0,
    });
  });

  it("pago SEM data não entra em ano nenhum — pendência de complemento", () => {
    // Foi pago, mas o ano é desconhecido. O app não inventa a data (critério
    // 22); o valor fica visível como pendência de complemento, fora das somas.
    const semData = desembolso({
      id: "d2",
      valorCentavos: 80_000_000,
      dataPagamento: null,
      estado: "pago",
      anexos: [],
    });
    expect(entraEmAlgumAno(semData)).toBe(false);
    for (const ano of [2024, 2025, 2026, 2099]) {
      expect(custoTerrenoAteOAno([semData], [], ano)).toEqual({
        confirmadoCentavos: 0,
        semComprovanteCentavos: 0,
      });
    }
  });
});

// ── Critério 24d ─────────────────────────────────────────────────────────

describe("composição do custo do informe (critério 24d)", () => {
  it("soma amortização + juros/correção, e SÓ isso", () => {
    expect(custoDoInformeCentavos(INFORME_2025)).toBe(5_993_475); // 59.934,75
    expect(custoDoInformeCentavos(INFORME_2025)).toBe(
      INFORME_2025.amortizacaoCentavos + INFORME_2025.jurosCorrecaoCentavos,
    );
  });

  it("as outras CINCO rubricas não entram no custo, uma a uma", () => {
    const base = informe({
      id: "i",
      amortizacaoCentavos: 100_000,
      jurosCorrecaoCentavos: 200_000,
      segurosCentavos: 0,
      taxasFcvsCentavos: 0,
      moraCentavos: 0,
      multaCentavos: 0,
      diferencaTeoricoPagoCentavos: 0,
      totalPagoCentavos: 300_000,
    });
    const cinco = [
      "segurosCentavos",
      "taxasFcvsCentavos",
      "moraCentavos",
      "multaCentavos",
      "diferencaTeoricoPagoCentavos",
    ] as const;
    for (const rubrica of cinco) {
      const com = informe({ ...base, id: "i", [rubrica]: 50_000 });
      expect(custoDoInformeCentavos(com), rubrica).toBe(300_000);
    }
  });

  it("mora e multa nunca somam — penalidade nunca é custo `[Certain]`", () => {
    const comPenalidade = informe({
      ...INFORME_2025,
      id: "i",
      moraCentavos: 12_345,
      multaCentavos: 6_789,
      totalPagoCentavos: INFORME_2025.totalPagoCentavos + 12_345 + 6_789,
    });
    expect(penalidadesCentavos(comPenalidade)).toBe(19_134);
    expect(custoDoInformeCentavos(comPenalidade)).toBe(
      custoDoInformeCentavos(INFORME_2025),
    );
  });

  it("seguros, taxas/FCVS e a diferença ficam guardados fora da soma", () => {
    // ⚠️ O teste NÃO afirma que estão "excluídos por regra": a classificação
    // dos seguros está em DIVERGÊNCIA ABERTA (ADENDO 4), o FCVS é candidato a
    // inclusão e ninguém sabe o que é a "Diferença Teórico / Pago". O que se
    // afirma é que hoje o app não os soma e os guarda separados.
    expect(rubricasComClassificacaoEmAberto(INFORME_2025)).toBe(66_699); // 666,99
    expect(
      custoDoInformeCentavos(INFORME_2025) +
        rubricasComClassificacaoEmAberto(INFORME_2025) +
        penalidadesCentavos(INFORME_2025),
    ).toBe(INFORME_2025.totalPagoCentavos);
  });

  it("a diferença teórico/pago participa da TRAVA e não do CUSTO", () => {
    // São coisas diferentes, e o app não as confunde (pre-mortem 2). Sem ela o
    // extrato NÃO fecha — logo ela participa da conferência; e ela não aparece
    // no custo — logo não participa da apuração.
    expect(INFORME_2025.diferencaTeoricoPagoCentavos).toBeGreaterThan(0);
    expect(travaDaSoma(INFORME_2025).fecha).toBe(true);
    expect(
      travaDaSoma({ ...INFORME_2025, diferencaTeoricoPagoCentavos: 0 }).fecha,
    ).toBe(false);
    expect(custoDoInformeCentavos(INFORME_2025)).toBe(
      INFORME_2025.amortizacaoCentavos + INFORME_2025.jurosCorrecaoCentavos,
    );
  });
});

// ── Critério 24b · a trava da soma ───────────────────────────────────────

describe("trava da soma (critérios 11 e 24b)", () => {
  it("o extrato real de 2025 fecha", () => {
    const r = travaDaSoma(INFORME_2025);
    expect(r.fecha).toBe(true);
    expect(r.somaCentavos).toBe(6_060_174);
    expect(r.diferencaCentavos).toBe(0);
  });

  it("linha esquecida → RECUSA, com a diferença exata na mensagem", () => {
    // Esquecendo a linha de seguros (R$ 499,56): a soma fica menor que o total.
    const r = travaDaSoma({ ...INFORME_2025, segurosCentavos: 0 });
    expect(r.fecha).toBe(false);
    if (r.fecha) throw new Error("inalcançável");
    expect(r.diferencaCentavos).toBe(-49_956);
    expect(r.mensagem).toContain("faltam");
    expect(r.mensagem).toContain(formatarBRL(49_956));
    expect(r.mensagem).toContain("não é gravado");
  });

  it("valor digitado a mais → RECUSA, dizendo que SOBRA", () => {
    const r = travaDaSoma({ ...INFORME_2025, amortizacaoCentavos: 1_688_452 });
    expect(r.fecha).toBe(false);
    if (r.fecha) throw new Error("inalcançável");
    expect(r.diferencaCentavos).toBe(100);
    expect(r.mensagem).toContain("sobram");
    expect(r.mensagem).toContain(formatarBRL(100));
  });

  it("TOLERÂNCIA ZERO: um centavo de descasamento já recusa", () => {
    // Travar e reclamar mostra o problema; folga silenciosa esconde.
    const r = travaDaSoma({
      ...INFORME_2025,
      totalPagoCentavos: INFORME_2025.totalPagoCentavos + 1,
    });
    expect(r.fecha).toBe(false);
    if (r.fecha) throw new Error("inalcançável");
    expect(r.diferencaCentavos).toBe(-1);
    expect(r.mensagem).toContain(formatarBRL(1));
  });
});

// ── Critério 24c · a trava da dupla contagem ─────────────────────────────

describe("trava da dupla contagem (critérios 14 e 24c)", () => {
  it("dois informes do mesmo ano-base não podem coexistir — no banco", () => {
    // A trava é estrutural: `unique (financiamento_id, ano_base)` na migration
    // 0008. Aqui fica registrado o EFEITO que ela impede: se dois informes do
    // mesmo ano chegassem à apuração, o custo do ano dobraria.
    const dobrado = custoTerrenoAteOAno(
      [],
      [informe({ id: "a" }), informe({ id: "b" })],
      2025,
    );
    expect(dobrado.confirmadoCentavos).toBe(
      2 * custoDoInformeCentavos(INFORME_2025),
    );
    // Um só é o estado que o banco permite representar.
    expect(custoTerrenoAteOAno([], [INFORME_2025], 2025).confirmadoCentavos).toBe(
      5_993_475,
    );
  });

  it("não existe tipo de desembolso para 'parcela do financiamento'", () => {
    // A outra metade da trava, e é a mais forte: a dupla contagem informe ×
    // parcelas é impossível POR AUSÊNCIA DE TIPO (critério 14, versão
    // estrutural). `parcela_vendedor` é o parcelamento direto com o VENDEDOR,
    // sem banco no meio, e nunca se liga a um financiamento.
    const tipos: TerrenoDesembolso["tipo"][] = [
      "pagamento_terreno",
      "entrada",
      "itbi",
      "escritura_registro",
      "parcela_vendedor",
      "quitacao",
    ];
    // @ts-expect-error não existe, e não pode passar a existir sem migration
    const inexistente: TerrenoDesembolso["tipo"] = "parcela_financiamento";
    expect(tipos).not.toContain(inexistente);
  });
});

// ── Critérios 8 e 15 ─────────────────────────────────────────────────────

describe("o que NUNCA entra em soma nenhuma", () => {
  it("saldo devedor não soma nem subtrai de nada (critério 15)", () => {
    const semSaldo = informe({ ...INFORME_2025, id: "i", saldoDevedorCentavos: 0 });
    expect(custoDoInformeCentavos(semSaldo)).toBe(
      custoDoInformeCentavos(INFORME_2025),
    );
    expect(custoTerrenoAteOAno([], [semSaldo], 2025)).toEqual(
      custoTerrenoAteOAno([], [INFORME_2025], 2025),
    );
    // E ele não participa da trava: a soma das SETE rubricas fecha com o total
    // pago, sem o saldo em lugar nenhum.
    expect(somaDasRubricasCentavos(INFORME_2025)).toBe(
      INFORME_2025.totalPagoCentavos,
    );
  });

  it("preço contratado não é lido por função de apuração nenhuma", () => {
    // `Financiamento` não entra em `custoTerrenoAteOAno`: a assinatura só
    // aceita desembolsos e informes. A proteção é de TIPO (critério 8).
    expect(custoTerrenoAteOAno.length).toBe(3);
  });
});

// ── Critério 16 · o painel ano a ano ─────────────────────────────────────

describe("anos do financiamento (critério 16)", () => {
  it("registrado, falta lançar e aguardando informe, nesta ordem", () => {
    const anos = anosDoFinanciamento(
      "2024-03-20",
      [informe({ ...INFORME_2025, id: "i2024", anoBase: 2024 })],
      2026,
    );
    expect(anos.map((a) => [a.ano, a.situacao])).toEqual([
      [2024, "registrado"],
      [2025, "falta_lancar"],
      [2026, "aguardando_informe"],
    ]);
  });

  it("a estimativa do ano corrente vem do informe do ano anterior", () => {
    const anos = anosDoFinanciamento("2025-01-10", [INFORME_2025], 2026);
    const corrente = anos.find((a) => a.ano === 2026)!;
    expect(corrente.situacao).toBe("aguardando_informe");
    expect(corrente.estimativaCentavos).toBe(5_993_475);
    // ⚠️ E ela NÃO soma em lugar nenhum: o custo apurado de 2026 é zero.
    expect(corrente.custoCentavos).toBe(0);
    expect(custoTerrenoAteOAno([], [INFORME_2025], 2026).confirmadoCentavos).toBe(
      5_993_475,
    );
  });

  it("sem informe do ano anterior, não há estimativa — não se inventa número", () => {
    const anos = anosDoFinanciamento("2026-02-01", [], 2026);
    expect(anos).toHaveLength(1);
    expect(anos[0].situacao).toBe("aguardando_informe");
    expect(anos[0].estimativaCentavos).toBeNull();
  });
});


// ══════════════════════════════════════════════════════════════════════════
// A PORTA LATERAL DA DUPLA CONTAGEM (critérios 2 e 14)
//
// A trava do 14 é estrutural — não existe tipo "parcela do financiamento" — mas
// ela só protege o tipo que nomeia. Numa obra `financiado`, oferecer "Parcela
// ao vendedor" ou "Pagamento do terreno" deixa o débito mensal do banco entrar
// como linha avulsa ao lado do informe do ano: o mesmo dinheiro duas vezes, sem
// nada acusar. É a natureza da aquisição que decide qual regra roda.
// ══════════════════════════════════════════════════════════════════════════

describe("os tipos de desembolso que cada natureza admite", () => {
  it("financiado NÃO oferece parcela ao vendedor nem pagamento do terreno", () => {
    const tipos = tiposDeDesembolsoPara("financiado");
    expect(tipos).not.toContain("parcela_vendedor");
    expect(tipos).not.toContain("pagamento_terreno");
    // O que sai do bolso dele fora do banco, e o desembolso do ano da venda.
    expect(tipos).toEqual([
      "entrada",
      "itbi",
      "escritura_registro",
      "quitacao",
    ]);
  });

  it("parcelado com o vendedor é o ÚNICO com parcela ao vendedor", () => {
    expect(tiposDeDesembolsoPara("parcelado_vendedor")).toContain(
      "parcela_vendedor",
    );
    for (const natureza of ["a_vista", "financiado", "recebido"] as const) {
      expect(tiposDeDesembolsoPara(natureza)).not.toContain("parcela_vendedor");
    }
  });

  it("quitação do financiamento só existe onde há financiamento", () => {
    expect(tiposDeDesembolsoPara("financiado")).toContain("quitacao");
    for (const natureza of [
      "a_vista",
      "parcelado_vendedor",
      "recebido",
    ] as const) {
      expect(tiposDeDesembolsoPara(natureza)).not.toContain("quitacao");
    }
  });

  it("à vista mantém o caso degenerado: um desembolso e os acessórios", () => {
    expect(tiposDeDesembolsoPara("a_vista")).toEqual([
      "pagamento_terreno",
      "entrada",
      "itbi",
      "escritura_registro",
    ]);
  });

  it("natureza DESCONHECIDA devolve a lista cheia — não se inventa restrição", () => {
    // Critério 23: a pendência de complemento pede a resposta e não bloqueia
    // nada. Restringir a lista com base em fato que o app não sabe seria
    // presumir — que é exatamente o defeito que este ticket conserta.
    expect(tiposDeDesembolsoPara(null)).toHaveLength(6);
    expect(tiposDeDesembolsoPara(null)).toContain("parcela_vendedor");
    expect(tiposDeDesembolsoPara(null)).toContain("quitacao");
    expect(tiposDeDesembolsoPara(null)).toContain("pagamento_terreno");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Critério 13 — o FCVS tem marca PRÓPRIA, e a palavra é "candidato"
// ══════════════════════════════════════════════════════════════════════════

describe("a marca do FCVS", () => {
  it("diz 'candidato a inclusão, pendente de confirmação'", () => {
    // É essa palavra que faz alguém revisitar o ano quando a confirmação
    // chegar (pre-mortem 3). Sem ela o FCVS vira "mais uma linha guardada".
    expect(TAXAS_E_FCVS_NA_MESMA_LINHA).toContain("candidato a inclusão");
    expect(TAXAS_E_FCVS_NA_MESMA_LINHA).toContain("pendente de confirmação");
  });

  it("não resolve o FCVS por analogia com seguros, nem fala deles", () => {
    // Critério 13 + ADENDO 4: os seguros estão EM ABERTO, e nenhuma tela deste
    // ticket afirma o tratamento deles.
    expect(TAXAS_E_FCVS_NA_MESMA_LINHA.toLowerCase()).not.toContain("seguro");
  });
});

/**
 * ⚠️ CRITÉRIO 19 — "todo número de custo do financiamento é apresentado como
 * INSUMO PARA REVISÃO PROFISSIONAL (CRC), nunca como veredito".
 *
 * Este teste nasceu no Gate 4: o `po` notou que era o **único critério fiscal
 * do ticket sem rede** — dava para apagar a frase das três telas e a suíte
 * ficava verde. Num ticket que blindou a estimativa varrendo `lib/` inteiro, a
 * assimetria não se justifica.
 *
 * Por que a asserção é sobre a FONTE das telas e não sobre o texto renderizado:
 * o E2E já exercita as telas, mas ele não sabe dizer que a frase **sumiu de uma
 * delas** — só falharia se alguém apagasse a que ele olha. Aqui a lista de
 * superfícies é explícita, e tirar a frase de qualquer uma delas fica vermelho
 * com o nome do arquivo.
 *
 * A regra é do parecer, adendo 2 §2: *"nesta ordem de grandeza a inclusão exige
 * assinatura de contador com CRC, não decisão de app. O app soma e nomeia em
 * linha própria; quem assume a posição na declaração é humano."*
 */
describe("critério 19 — insumo para revisão do CRC, nunca veredito", () => {
  /** As três superfícies que mostram número de custo do financiamento. */
  const SUPERFICIES = [
    "app/obras/[id]/terreno/page.tsx",
    "app/obras/[id]/terreno/informe/[anoBase]/page.tsx",
  ];

  it("a frase existe e nomeia o CRC, os juros e quem assume a posição", () => {
    expect(INSUMO_PARA_REVISAO_CRC).toContain("CRC");
    expect(INSUMO_PARA_REVISAO_CRC).toContain("não um veredito");
    expect(INSUMO_PARA_REVISAO_CRC).toContain("juros");
    // Quem assina é humano — é a ressalva que o `contador` exigiu no corpo do
    // produto, e ela não pode ser cortada por "o texto ficou grande".
    expect(INSUMO_PARA_REVISAO_CRC).toContain("humano");
  });

  it("toda tela que mostra custo do financiamento a exibe", () => {
    for (const arquivo of SUPERFICIES) {
      const fonte = readFileSync(arquivo, "utf-8");
      expect(
        fonte.includes("INSUMO_PARA_REVISAO_CRC"),
        `${arquivo} mostra número de custo do financiamento sem dizer que ele é insumo para revisão do CRC (critério 19)`,
      ).toBe(true);
    }
  });

  it("o painel e a tela do informe a exibem em TODAS as caixas de custo", () => {
    // O informe tem duas: a conferência (passo 3) e a tela de gravado. Perder
    // uma das duas é perder a ressalva justamente onde o número vira definitivo.
    const informe = readFileSync(
      "app/obras/[id]/terreno/informe/[anoBase]/page.tsx",
      "utf-8",
    );
    const usos = informe.split("INSUMO_PARA_REVISAO_CRC").length - 1;
    // 1 import + 2 usos em JSX.
    expect(usos).toBeGreaterThanOrEqual(3);
  });
});

// ══ CONTAI-027 rodada 2 · N papéis, e a pergunta do critério 12 ═════════
//
// A regra de disparo é a tabela do §6 do parecer de 2026-08-21, linha por
// linha. Nenhum teste daqui usa `Date.now()`: as duas marcas comparadas vêm do
// banco, e são literais no teste.

describe("critério 15 — pago sem papel nenhum continua visível", () => {
  it("pago e sem anexo é pendência; pago com anexo não é", () => {
    expect(pagoSemPapel(desembolso({ id: "d1", anexos: [] }))).toBe(true);
    expect(
      pagoSemPapel(desembolso({ id: "d2", anexos: [anexo("contrato")] })),
    ).toBe(false);
  });

  it("previsto NUNCA é 'pago sem papel' — não há o que anexar", () => {
    const previsto = desembolso({
      id: "d3",
      estado: "previsto",
      dataPagamento: null,
      anexos: [],
    });
    expect(pagoSemPapel(previsto)).toBe(false);
  });

  it("pago, SEM data e sem papel é pendência de papel também", () => {
    // As duas pendências coexistem aqui, e são coisas diferentes: falta a data
    // (ano-calendário) e falta o papel (lastro). Nenhuma esconde a outra.
    const semNada = desembolso({
      id: "d4",
      dataPagamento: null,
      anexos: [],
    });
    expect(pagoSemPapel(semNada)).toBe(true);
  });
});

describe("critério 14 — os três papéis, e só eles", () => {
  it("os rótulos são os do §7 do parecer, literais", () => {
    expect(ROTULO_DO_PAPEL.comprovante).toBe("Comprovante do pagamento");
    expect(ROTULO_DO_PAPEL.nota).toBe("Nota ou recibo");
    expect(ROTULO_DO_PAPEL.contrato).toBe("Contrato ou escritura");
    expect(Object.keys(ROTULO_DO_PAPEL)).toHaveLength(3);
  });

  it("só `comprovante` conta para a pergunta", () => {
    const d = desembolso({
      id: "d1",
      anexos: [anexo("comprovante"), anexo("nota"), anexo("contrato")],
    });
    expect(comprovantesDe(d)).toHaveLength(1);
    expect(temDoisComprovantes(d)).toBe(false);
  });
});

describe("critério 12 — quando a pergunta dispara (§6)", () => {
  it("✅ dispara com DOIS papéis comprovante", () => {
    const d = desembolso({
      id: "d1",
      anexos: [anexo("comprovante", "2026-08-21T10:00:00.000Z"),
               anexo("comprovante", "2026-08-21T10:00:01.000Z")],
    });
    expect(perguntaPendente(d)).toBe(true);
  });

  it("✅ TRÊS comprovantes de uma vez perguntam UMA vez — não é por arquivo", () => {
    const d = desembolso({
      id: "d1",
      anexos: [
        anexo("comprovante", "2026-08-21T10:00:00.000Z"),
        anexo("comprovante", "2026-08-21T10:00:01.000Z"),
        anexo("comprovante", "2026-08-21T10:00:02.000Z"),
      ],
    });
    // A pergunta é UM estado booleano do lançamento, não uma fila por arquivo:
    // respondida uma vez, os três estão cobertos.
    expect(perguntaPendente(d)).toBe(true);
    const respondido = {
      ...d,
      debitosMesmoDia: true,
      debitosMesmoDiaRespondidoEm: "2026-08-21T10:00:03.000Z",
    };
    expect(perguntaPendente(respondido)).toBe(false);
  });

  it("❌ NUNCA para nota nem contrato — comprovante + recibo é UM débito", () => {
    const comRecibo = desembolso({
      id: "d1",
      anexos: [anexo("comprovante"), anexo("nota")],
    });
    const comContrato = desembolso({
      id: "d2",
      anexos: [anexo("comprovante"), anexo("contrato")],
    });
    const duasNotas = desembolso({
      id: "d3",
      anexos: [anexo("nota", "2026-08-21T10:00:00.000Z"),
               anexo("nota", "2026-08-21T10:00:01.000Z")],
    });
    expect(perguntaPendente(comRecibo)).toBe(false);
    expect(perguntaPendente(comContrato)).toBe(false);
    expect(perguntaPendente(duasNotas)).toBe(false);
  });

  it("❌ NÃO, se a pendência já está aberta — ele já respondeu", () => {
    const d = desembolso({
      id: "d1",
      anexos: [anexo("comprovante", "2026-08-21T10:00:00.000Z"),
               anexo("comprovante", "2026-08-22T10:00:00.000Z")],
      debitosMesmoDia: false,
      debitosMesmoDiaRespondidoEm: "2026-08-21T10:00:05.000Z",
    });
    // Chegou comprovante DEPOIS da resposta, e ainda assim não repergunta: o
    // "de novo" do §6 é só para a resposta "tudo no dia X".
    expect(perguntaPendente(d)).toBe(false);
    expect(pendenciaDeDatasAberta(d)).toBe(true);
  });

  it("✅ dispara DE NOVO se a resposta era 'tudo no dia X' e chega comprovante novo", () => {
    const base = desembolso({
      id: "d1",
      anexos: [anexo("comprovante", "2026-08-21T10:00:00.000Z"),
               anexo("comprovante", "2026-08-21T10:00:01.000Z")],
      debitosMesmoDia: true,
      debitosMesmoDiaRespondidoEm: "2026-08-21T10:00:02.000Z",
    });
    expect(perguntaPendente(base)).toBe(false);

    const comFatoNovo = {
      ...base,
      anexos: [...base.anexos, anexo("comprovante", "2026-08-25T09:00:00.000Z")],
    };
    expect(perguntaPendente(comFatoNovo)).toBe(true);
    // ...e o "sim" antigo continua gravado até a resposta nova chegar: o
    // acervo é append-only, e o rastro da resposta vigente não se apaga por
    // ter surgido fato novo.
    expect(comFatoNovo.debitosMesmoDia).toBe(true);
  });

  it("papel NOVO que não é comprovante não repergunta nada", () => {
    const d = desembolso({
      id: "d1",
      anexos: [
        anexo("comprovante", "2026-08-21T10:00:00.000Z"),
        anexo("comprovante", "2026-08-21T10:00:01.000Z"),
        anexo("nota", "2026-09-01T10:00:00.000Z"),
      ],
      debitosMesmoDia: true,
      debitosMesmoDiaRespondidoEm: "2026-08-21T10:00:02.000Z",
    });
    expect(perguntaPendente(d)).toBe(false);
  });

  it("o comprovante do MESMO ato da resposta não é fato novo", () => {
    // O `>` é estrito de propósito: a gravação insere as filhas e só então
    // carimba a resposta. Se fosse `>=`, o ato de responder já dispararia a
    // re-pergunta sobre si mesmo, para sempre.
    const d = desembolso({
      id: "d1",
      anexos: [anexo("comprovante", "2026-08-21T10:00:00.000Z"),
               anexo("comprovante", "2026-08-21T10:00:02.000Z")],
      debitosMesmoDia: true,
      debitosMesmoDiaRespondidoEm: "2026-08-21T10:00:02.000Z",
    });
    expect(perguntaPendente(d)).toBe(false);
  });
});

describe("critério 12 — a represa sem data (§6)", () => {
  const semData = desembolso({
    id: "d1",
    dataPagamento: null,
    anexos: [anexo("comprovante", "2026-08-21T10:00:00.000Z"),
             anexo("comprovante", "2026-08-21T10:00:01.000Z")],
  });

  it("sem data a pergunta não é feita — ela cita a data no próprio botão", () => {
    expect(perguntaPendente(semData)).toBe(false);
    expect(perguntaRepresada(semData)).toBe(true);
  });

  it("as duas pendências NUNCA aparecem juntas: a de data tem precedência", () => {
    // Enquanto falta a data, `perguntaPendente` é falso — e é a pendência
    // "falta a data" que fala. Elas se excluem por construção.
    expect(perguntaPendente(semData) && perguntaRepresada(semData)).toBe(false);
  });

  it("a data entra e a represa abre NO MESMO ATO", () => {
    const comData = { ...semData, dataPagamento: "2026-08-21" };
    expect(perguntaRepresada(comData)).toBe(false);
    expect(perguntaPendente(comData)).toBe(true);
  });

  it("um comprovante só nunca represa nada", () => {
    const um = desembolso({
      id: "d2",
      dataPagamento: null,
      anexos: [anexo("comprovante")],
    });
    expect(perguntaRepresada(um)).toBe(false);
  });
});

describe("critério 12a — os textos da pendência, copiados do §4b", () => {
  it("o corpo nomeia o valor e diz que a data decide o ano", () => {
    // ⚠️ `formatarBRL` e não "R$ 60.000,00" à mão: o `Intl` do pt-BR separa o
    // símbolo com ESPAÇO NÃO-QUEBRÁVEL (U+00A0). Literal com espaço comum
    // passaria a testar a formatação errada — e passaria a falhar por um
    // caractere invisível.
    expect(corpoDaPendenciaDeDatas(6_000_000)).toBe(
      "Você respondeu que o dinheiro saiu em mais de um dia, e este lançamento " +
        `tem ${formatarBRL(6_000_000)} numa data só. É a data do pagamento ` +
        "que decide o ano do custo.",
    );
  });

  it("⚠️ a SEGUNDA METADE da ação existe, e proíbe registrar os separados antes", () => {
    // Sem esta metade, cumprir a primeira soma o valor duas vezes no custo do
    // terreno — inflação de custo de aquisição, o pior dos dois erros
    // simétricos (§4b). O teste existe para que apagá-la fique vermelho.
    const acao = acaoDaPendenciaDeDatas(6_000_000);
    expect(acao).toContain("Não registre os lançamentos separados antes disso");
    expect(acao).toContain("os novos somam por cima");
    expect(acao).toContain(formatarBRL(6_000_000));
  });

  it("a opção do 'sim' cita a data do lançamento, em dd/mm/aaaa", () => {
    expect(opcaoTudoEm("21/08/2026")).toBe("Tudo em 21/08/2026");
  });
});

describe("critério 12 — a pergunta no ATO (registro e complemento)", () => {
  it("registro: dois comprovantes com data perguntam; um só, não", () => {
    expect(perguntaNoRegistro("2026-08-21", 2)).toBe(true);
    expect(perguntaNoRegistro("2026-08-21", 3)).toBe(true);
    expect(perguntaNoRegistro("2026-08-21", 1)).toBe(false);
    expect(perguntaNoRegistro("2026-08-21", 0)).toBe(false);
  });

  it("registro: sem data, nada é perguntado — represada", () => {
    expect(perguntaNoRegistro(null, 3)).toBe(false);
    expect(perguntaNoRegistro("", 3)).toBe(false);
  });

  it("complemento: o SEGUNDO comprovante que chega dias depois pergunta", () => {
    const d = desembolso({ id: "d1", anexos: [anexo("comprovante")] });
    expect(perguntaNoComplemento(d, 1, d.dataPagamento)).toBe(true);
    // Recibo que chega depois não pergunta nada.
    expect(perguntaNoComplemento(d, 0, d.dataPagamento)).toBe(false);
  });

  it("complemento: a represa abre com a DATA, no mesmo ato", () => {
    const semData = desembolso({
      id: "d1",
      dataPagamento: null,
      anexos: [anexo("comprovante", "2026-08-21T10:00:00.000Z"),
               anexo("comprovante", "2026-08-21T10:00:01.000Z")],
    });
    expect(perguntaNoComplemento(semData, 0, null)).toBe(false);
    expect(perguntaNoComplemento(semData, 0, "2026-08-21")).toBe(true);
  });

  it("complemento: pendência aberta não repergunta — ele já respondeu", () => {
    const d = desembolso({
      id: "d1",
      anexos: [anexo("comprovante", "2026-08-21T10:00:00.000Z"),
               anexo("comprovante", "2026-08-21T10:00:01.000Z")],
      debitosMesmoDia: false,
      debitosMesmoDiaRespondidoEm: "2026-08-21T10:00:02.000Z",
    });
    expect(perguntaNoComplemento(d, 1, d.dataPagamento)).toBe(false);
  });

  it("complemento: resposta 'tudo no dia X' + comprovante novo repergunta", () => {
    const d = desembolso({
      id: "d1",
      anexos: [anexo("comprovante", "2026-08-21T10:00:00.000Z"),
               anexo("comprovante", "2026-08-21T10:00:01.000Z")],
      debitosMesmoDia: true,
      debitosMesmoDiaRespondidoEm: "2026-08-21T10:00:02.000Z",
    });
    expect(perguntaNoComplemento(d, 1, d.dataPagamento)).toBe(true);
    // Um papel que não é comprovante não muda o fato: nada a repergunta.
    expect(perguntaNoComplemento(d, 0, d.dataPagamento)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// CONTAI-025 — gravar sem data, sem comprovante, ou sem os dois
//
// Fonte: docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md
// (⚠️ ADENDO 1 vence o corpo) e o mock v2 aprovado pelo Mateus em 23/08.
// ════════════════════════════════════════════════════════════════════════

describe("critério 8 — o portão do custo confirmado é o papel `comprovante`", () => {
  it("com comprovante, o valor entra no confirmado", () => {
    const d = desembolso({ id: "d1", valorCentavos: 60_000_00 });
    expect(temComprovante(d)).toBe(true);
    expect(custoTerrenoAteOAno([d], [], 2024)).toEqual({
      confirmadoCentavos: 60_000_00,
      semComprovanteCentavos: 0,
    });
  });

  // ⚠️ CADA "NÃO" DO CRITÉRIO 7, um por vez. Todos foram, até 23/08, somados
  // ao custo confirmado em silêncio: `custoTerrenoAteOAno` decidia por
  // `estado === "pago"` + data e NÃO OLHAVA ANEXO — porque o formulário
  // garantia o anexo. É a D50.
  it("NÃO: só a escritura anexada — ela prova o preço, não o pagamento", () => {
    // O caso literal do Mateus (§4.3 e Gate Fiscal §1). Repare que este
    // desembolso TEM papel: `pagoSemPapel` diria `false` aqui.
    const d = desembolso({
      id: "d1",
      valorCentavos: 60_000_00,
      anexos: [anexo("contrato")],
    });
    expect(temComprovante(d)).toBe(false);
    expect(custoTerrenoAteOAno([d], [], 2024)).toEqual({
      confirmadoCentavos: 0,
      semComprovanteCentavos: 60_000_00,
    });
  });

  it("NÃO: só a nota/recibo anexada", () => {
    const d = desembolso({ id: "d1", anexos: [anexo("nota")] });
    expect(custoTerrenoAteOAno([d], [], 2024).confirmadoCentavos).toBe(0);
    expect(custoTerrenoDoAno([d], [], 2024).confirmadoCentavos).toBe(0);
  });

  it("NÃO: nenhum papel — e o valor aparece no segundo número, não some", () => {
    const d = desembolso({ id: "d1", valorCentavos: 25_000_00, anexos: [] });
    expect(custoTerrenoDoAno([d], [], 2024)).toEqual({
      confirmadoCentavos: 0,
      semComprovanteCentavos: 25_000_00,
    });
  });

  it("NÃO: `previsto` fica fora dos DOIS números — não foi pago", () => {
    const d = desembolso({
      id: "d1",
      estado: "previsto",
      dataPagamento: null,
      anexos: [],
    });
    expect(custoTerrenoAteOAno([d], [], 2099)).toEqual({
      confirmadoCentavos: 0,
      semComprovanteCentavos: 0,
    });
  });

  it("NÃO: pago SEM DATA fica fora dos dois — não tem ano-calendário", () => {
    // Ele existe, é real, e aparece no agregado da OBRA — nunca num ano.
    const d = desembolso({ id: "d1", dataPagamento: null, anexos: [] });
    expect(custoTerrenoAteOAno([d], [], 2099)).toEqual({
      confirmadoCentavos: 0,
      semComprovanteCentavos: 0,
    });
    expect(totalPagoSemComprovanteCentavos([d])).toBe(d.valorCentavos);
  });

  it("o informe do financiamento NÃO passa pelo portão — ali o anexo é FONTE", () => {
    // A trava do critério 10 do CONTAI-010 continua de pé (§1.2): sem o
    // extrato o informe não grava. Informe gravado é informe com anexo.
    expect(custoTerrenoAteOAno([], [INFORME_2025], 2025)).toEqual({
      confirmadoCentavos: 5_993_475,
      semComprovanteCentavos: 0,
    });
  });

  it("⚠️ `pagoSemPapel` é SUBCONJUNTO ESTRITO — trocar um pelo outro é a D49 invertida", () => {
    const soEscritura = desembolso({ id: "d1", anexos: [anexo("contrato")] });
    const semNada = desembolso({ id: "d2", anexos: [] });
    // O de cima está no portão-excluído e FORA de `pagoSemPapel`. É o buraco
    // que o pre-mortem 2 do ticket nomeia — e a razão de o predicado ser NOVO.
    expect(pagoSemPapel(soEscritura)).toBe(false);
    expect(pagoSemComprovante(soEscritura)).toBe(true);
    expect(pagoSemPapel(semNada)).toBe(true);
    expect(pagoSemComprovante(semNada)).toBe(true);
    expect(pagosSemComprovante([soEscritura, semNada])).toHaveLength(2);
  });

  it("os dois números somados dão o total pago e datado — nada evapora", () => {
    const com = desembolso({ id: "d1", valorCentavos: 3_150_00 });
    const sem = desembolso({
      id: "d2",
      valorCentavos: 60_000_00,
      anexos: [anexo("contrato")],
    });
    const custo = custoTerrenoAteOAno([com, sem], [], 2024);
    expect(custo.confirmadoCentavos + custo.semComprovanteCentavos).toBe(
      com.valorCentavos + sem.valorCentavos,
    );
  });
});

describe("critério 12 — textos COPIADOS do parecer, não redigidos", () => {
  it("§4.1 — o chip", () => {
    expect(CHIP_PAGO_SEM_COMPROVANTE).toBe("Pago sem comprovante");
  });

  it("§4.2 — a pendência, literal", () => {
    expect(PAGO_SEM_COMPROVANTE).toBe(
      "O valor e a data ficam registrados — o custo existe, ainda não está " +
        "demonstrável. Enquanto faltar o papel, este desembolso não entra no " +
        "custo confirmado. Recupere o comprovante enquanto o banco ainda o " +
        "mostra: ele é o documento do acervo que expira primeiro.",
    );
  });

  it("§4.2 NÃO é o texto do caso zero-anexo — são conjuntos diferentes", () => {
    // Gate Fiscal §3: `PAGO_SEM_PAPEL` continua sendo o texto do caso
    // zero-anexo (critério 15 do CONTAI-027). Fundir os dois apagaria a
    // diferença de buraco de acervo que o mock desenha na linha.
    expect(PAGO_SEM_PAPEL).not.toBe(PAGO_SEM_COMPROVANTE);
    expect(PAGO_SEM_PAPEL).toContain("não tem nenhum papel no acervo");
  });

  it("§4.3 — a linha auxiliar, os três tipos", () => {
    expect(COMPROVANTE_POR_TIPO).toEqual([
      {
        titulo: "Entrada ou sinal",
        texto:
          "comprovante da transferência, ou recibo do vendedor. A escritura " +
          "prova o preço, não o pagamento.",
      },
      {
        titulo: "ITBI",
        texto:
          "a guia paga, com a autenticação. A prefeitura costuma reemitir a " +
          "segunda via.",
      },
      {
        titulo: "Escritura e registro",
        texto: "o recibo de custas do cartório, que costuma reemitir.",
      },
    ]);
  });

  it("§4.3 — `[Likely]`: 'costuma', nunca um prazo prometido", () => {
    // O parecer manda confirmar antes de prometer prazo de reemissão.
    for (const c of COMPROVANTE_POR_TIPO) {
      expect(/\b\d+\s*(dias?|meses|horas)\b/i.test(c.texto)).toBe(false);
    }
  });

  it("§4.3 tem DOIS títulos — pendência e momento de escolher o papel", () => {
    expect(O_QUE_SERVE_COMO_COMPROVANTE).toBe(
      "O que serve como comprovante, por tipo",
    );
    expect(ANTES_DE_DIZER_O_QUE_E_CADA_PAPEL).toContain(
      "Antes de dizer o que é cada papel",
    );
  });

  it("Gate Fiscal §4 — o estado combinado, com 'Comece pela data' literal", () => {
    expect(CHIP_FALTA_DATA_E_COMPROVANTE).toBe(
      "Pago — falta a data e o comprovante",
    );
    expect(FALTA_DATA_E_COMPROVANTE).toBe(
      "Pago — falta a data e falta o comprovante. As duas faltas são " +
        "independentes e nenhuma delas apaga o registro. Sem a data, este " +
        "valor não tem ano-calendário e não entra em ano nenhum. Sem o " +
        "comprovante, ele não entra no custo confirmado nem no ano em que a " +
        "data o puser.",
    );
    expect(COMECE_PELA_DATA).toBe(
      "Comece pela data: ela está no extrato, no mesmo lugar em que o " +
        "comprovante está — as duas costumam voltar da mesma busca.",
    );
  });

  it("§4.5 — o mesmo rótulo na home e no relatório (decisão 1 do mock)", () => {
    expect(FORA_DO_CUSTO_CONFIRMADO).toBe(
      "Fora do custo confirmado por falta de comprovante",
    );
    expect(FORA_DO_CUSTO_CONFIRMADO_PORQUE).toBe(
      "Foi pago e está registrado, mas ainda não tem o papel que o demonstra, " +
        "e por isso não entra na soma acima.",
    );
  });

  it("⚠️ §4.5 — a SEGUNDA metade é o handoff ao CRC, e é constante própria", () => {
    // A metade NÃO automática do §2.1: "omitir o valor da discriminação da DAA
    // não é decisão do app". Ela mora no relatório (critério 17), não na home
    // — e ter constante própria é o que impede que colar só a primeira metade
    // lá drope o handoff em silêncio.
    expect(FORA_DO_CUSTO_CONFIRMADO_DECIDA_NO_RELATORIO).toBe(
      "Decida com seu contador antes de declarar: deixar de discriminar na " +
        "declaração um custo real também custa caro — o custo que não é " +
        "discriminado não existe na venda.",
    );
    // As duas juntas reconstroem o §4.5 inteiro, sem sobra e sem lacuna.
    expect(
      `${FORA_DO_CUSTO_CONFIRMADO_PORQUE} ${FORA_DO_CUSTO_CONFIRMADO_DECIDA_NO_RELATORIO}`,
    ).toContain("não entra na soma acima. Decida com seu contador");
  });

  it("⚠️ CONTAI-036 crit. 4 e 5 — a linha do §4.5 INTEIRA, na ordem certa", () => {
    // Literal do parecer `2026-08-23-anexo-no-desembolso-do-terreno.md` §4.5.
    // Afirma a STRING INTEIRA de propósito: a linha se compõe de três
    // constantes, e colar só as duas primeiras dropa o handoff ao CRC em
    // silêncio — que é o único ponto do texto em que a decisão é nomeada como
    // do Mateus com o profissional, e não do app.
    // ⚠️ `formatarBRL` interpolado, e não "R$ 89.200,00" digitado: o `Intl`
    // pt-BR põe ESPAÇO NÃO SEPARÁVEL (U+00A0) depois do "R$", e um literal
    // digitado à mão nunca bate. A prosa — que é a parte fiscal — continua
    // literal, palavra por palavra.
    expect(linhaForaDoCustoConfirmado(89_200_00)).toBe(
      `Fora do custo confirmado por falta de comprovante: ${formatarBRL(89_200_00)}. ` +
        "Foi pago e está registrado, mas ainda não tem o papel que o " +
        "demonstra, e por isso não entra na soma acima. Decida com seu " +
        "contador antes de declarar: deixar de discriminar na declaração um " +
        "custo real também custa caro — o custo que não é discriminado não " +
        "existe na venda.",
    );
    // As três constantes, na ordem — e a ordem é fiscal, não estética.
    const linha = linhaForaDoCustoConfirmado(1_00);
    for (const [i, parte] of [
      FORA_DO_CUSTO_CONFIRMADO,
      FORA_DO_CUSTO_CONFIRMADO_PORQUE,
      FORA_DO_CUSTO_CONFIRMADO_DECIDA_NO_RELATORIO,
    ].entries()) {
      expect(linha, `parte ${i} sumiu da linha`).toContain(parte);
    }
    expect(linha.indexOf(FORA_DO_CUSTO_CONFIRMADO)).toBeLessThan(
      linha.indexOf(FORA_DO_CUSTO_CONFIRMADO_PORQUE),
    );
    expect(linha.indexOf(FORA_DO_CUSTO_CONFIRMADO_PORQUE)).toBeLessThan(
      linha.indexOf(FORA_DO_CUSTO_CONFIRMADO_DECIDA_NO_RELATORIO),
    );
    // O valor entra formatado, entre o rótulo e o porquê.
    expect(linhaForaDoCustoConfirmado(0)).toContain(formatarBRL(0));
  });

  it("⚠️ o handoff ao CRC NÃO está em tela nenhuma da fatia 1", () => {
    // Ele é do relatório anual, que o critério 16 ainda não deixa gerar. Se
    // aparecer numa tela desta fatia, o mock aprovado foi contrariado.
    const varrer = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? varrer(`${dir}/${e.name}`)
          : /\.tsx$/.test(e.name)
            ? [`${dir}/${e.name}`]
            : [],
      );
    // ⚠️ **Mudou no CONTAI-036, e a mudança é o ticket inteiro**: agora existe
    // UM lugar onde ele entra — a tela do relatório anual —, e ele entra
    // dentro de `linhaForaDoCustoConfirmado`, nunca colado à mão. Nenhuma tela
    // monta a linha do §4.5 juntando constante por conta própria: fosse assim,
    // esquecer a terceira dropa o handoff sem nada ficar vermelho.
    for (const arquivo of varrer("app")) {
      expect(
        readFileSync(arquivo, "utf-8").includes(
          "FORA_DO_CUSTO_CONFIRMADO_DECIDA_NO_RELATORIO",
        ),
        `${arquivo} monta a linha do §4.5 à mão — use ` +
          "`linhaForaDoCustoConfirmado`, que é a única montagem autorizada",
      ).toBe(false);
    }
  });

  it("⚠️ §1.4.1 — NENHUM texto oferece `previsto` como saída de quem pagou", () => {
    // Registrar como "ainda não paguei" um valor já pago tira o custo de TODO
    // ano-calendário: é pior que a trava. A varredura é sobre o módulo inteiro
    // porque o defeito nasceria de uma frase "prestativa" em qualquer canto.
    // ⚠️ A varredura é sobre TODO texto exportado do módulo, não sobre uma
    // lista escrita à mão: o defeito nasceria de uma frase "prestativa"
    // acrescentada depois, e uma lista fixa não a pegaria.
    const oferta = /ainda não paguei|ainda vou pagar|registre como previsto|marque como previsto/i;
    /**
     * ⚠️ Exceção **única, declarada e argumentada** — adjudicada pelo
     * `contador` no Gate 2 de 23/08. `DATA_NO_FUTURO` nomeia `previsto`, e
     * **não viola o §1.4.1**: a proibição é oferecer `previsto` como fuga a
     * valor **já pago**, e ali o próprio dado diz que o dinheiro **não saiu**
     * (a data é posterior a hoje). É contradição interna, não escape da trava.
     */
    const EXCECAO = new Set(["DATA_NO_FUTURO"]);
    let conferidos = 0;
    for (const [nome, valor] of Object.entries(terreno)) {
      if (typeof valor === "string" && !EXCECAO.has(nome)) {
        conferidos += 1;
        expect(oferta.test(valor), `${nome} oferece previsto como saída`).toBe(
          false,
        );
      }
    }
    expect(conferidos).toBeGreaterThan(10);
    // A exceção não é isenção: o texto dela tem de continuar existindo e tem
    // de pôr `previsto` em ÚLTIMO, depois das duas saídas que preservam o
    // custo, e com a consequência dita. Foi essa ordem que o `contador` pediu
    // quando o campo vazio passou a gravar — antes, "corrija" e "deixe vazio"
    // nem existiam na frase.
    for (const nome of EXCECAO) {
      expect(typeof terreno[nome as keyof typeof terreno]).toBe("string");
    }
    expect(terreno.DATA_NO_FUTURO).toContain("Se você errou a data, corrija-a");
    expect(terreno.DATA_NO_FUTURO).toContain("deixe o campo vazio");
    expect(terreno.DATA_NO_FUTURO).toContain(
      "isso tira este valor de todo ano-calendário",
    );
    expect(
      terreno.DATA_NO_FUTURO.indexOf("deixe o campo vazio") <
        terreno.DATA_NO_FUTURO.indexOf("ainda não paguei"),
      "`previsto` tem de vir DEPOIS das saídas que preservam o custo",
    ).toBe(true);
    // E os textos deste ticket, um a um, porque são os que descrevem a falta.
    for (const t of [
      PAGO_SEM_COMPROVANTE,
      FALTA_DATA_E_COMPROVANTE,
      COMECE_PELA_DATA,
      DESEMBOLSO_SEM_DATA,
      FORA_DO_CUSTO_CONFIRMADO_PORQUE,
      ...COMPROVANTE_POR_TIPO.map((c) => c.texto),
    ]) {
      expect(oferta.test(t)).toBe(false);
    }
  });

  it("⚠️ o complemento tem texto PRÓPRIO de data futura — e não é o do registro", () => {
    // `contador`, Gate 2: *"são dois atos diferentes, e colapsar os dois
    // textos é o que faria o 'deixe vazio' aparecer onde não cabe"*. No
    // registro, campo vazio GRAVA; aqui o ato existe para informar a data.
    expect(DATA_NO_FUTURO_NO_COMPLEMENTO).toBe(
      "Data no futuro — o dinheiro não pode ter saído depois de hoje. " +
        "Confira a data no extrato: é ela que decide o ano-calendário deste " +
        "custo. Se não achar agora, saia sem gravar — a pendência continua " +
        "aberta e nada se perde.",
    );
    expect(DATA_NO_FUTURO_NO_COMPLEMENTO).not.toBe(DATA_NO_FUTURO);
    // ⚠️ A saída segura é NOMEADA — era o que faltava no texto anterior
    // ("informe a data real do pagamento" mandava acertar sem dizer o que
    // fazer quem não sabe). Nada se perde saindo: a pendência fica aberta.
    expect(DATA_NO_FUTURO_NO_COMPLEMENTO).toContain("saia sem gravar");
    expect(DATA_NO_FUTURO_NO_COMPLEMENTO).toContain("nada se perde");
    // ⚠️ E o "deixe vazio" do registro NÃO vaza para cá.
    expect(DATA_NO_FUTURO_NO_COMPLEMENTO).not.toContain("deixe o campo vazio");
    // ⚠️ Critério 6: quem completa a data já disse que pagou — `previsto`
    // aqui tiraria o valor de todo ano-calendário, sem a contradição interna
    // que justifica a menção em `DATA_NO_FUTURO`.
    expect(
      /ainda não paguei|ainda vou pagar|previsto/i.test(
        DATA_NO_FUTURO_NO_COMPLEMENTO,
      ),
    ).toBe(false);
  });
});

describe("os quatro rótulos do Gravar (Gate Fiscal §4)", () => {
  const base = {
    preenchido: true,
    estado: "pago" as const,
    papeisSemResposta: 0,
  };

  it("tem data + tem comprovante", () => {
    expect(
      estadoDoGravar({ ...base, temData: true, temComprovante: true }),
    ).toEqual({ rotulo: GRAVAR_O_DESEMBOLSO, habilitado: true });
    expect(GRAVAR_O_DESEMBOLSO).toBe("Gravar o desembolso");
  });

  it("tem data, falta comprovante", () => {
    expect(
      estadoDoGravar({ ...base, temData: true, temComprovante: false }).rotulo,
    ).toBe("Gravar — e abrir a pendência do comprovante");
    expect(GRAVAR_E_ABRIR_A_PENDENCIA_DO_COMPROVANTE).toBe(
      "Gravar — e abrir a pendência do comprovante",
    );
  });

  it("tem comprovante, falta a data — ⚠️ 'QUE FALTA' não é enfeite", () => {
    // Adjudicado pelo `contador` em 23/08, RECUSANDO a simetria óbvia ("a
    // pendência da data"): *"'da data' vs 'de datas' faz uma distinção fiscal
    // real depender de uma letra, no mesmo botão, no mesmo formulário"* — o
    // estado "mais de uma data" do CONTAI-027 nasce de uma resposta NESTA
    // MESMA TELA. É a D46 com outro nome.
    expect(
      estadoDoGravar({ ...base, temData: false, temComprovante: true }).rotulo,
    ).toBe("Gravar — e abrir a pendência da data que falta");
    expect(GRAVAR_E_ABRIR_A_PENDENCIA_DA_DATA).toBe(
      "Gravar — e abrir a pendência da data que falta",
    );
    // A palavra carrega a distinção, não o singular/plural.
    expect(GRAVAR_E_ABRIR_A_PENDENCIA_DA_DATA).toContain("que falta");
  });

  it("faltam os dois", () => {
    expect(
      estadoDoGravar({ ...base, temData: false, temComprovante: false }).rotulo,
    ).toBe("Gravar — e abrir as duas pendências");
    expect(GRAVAR_E_ABRIR_AS_DUAS_PENDENCIAS).toBe(
      "Gravar — e abrir as duas pendências",
    );
  });

  it("⚠️ NENHUM rótulo diz 'gravar mesmo assim' — o rótulo nomeia a consequência", () => {
    for (const [temData, temComprovante] of [
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ]) {
      const e = estadoDoGravar({ ...base, temData, temComprovante });
      expect(/mesmo assim|ignorar|pular|depois eu/i.test(e.rotulo)).toBe(false);
      // ⚠️ E os quatro GRAVAM: falta de data ou de papel nunca desabilita.
      expect(e.habilitado).toBe(true);
    }
  });

  it("o que AINDA desabilita: desembolso vazio e papel sem resposta", () => {
    expect(
      estadoDoGravar({
        ...base,
        preenchido: false,
        temData: true,
        temComprovante: true,
      }),
    ).toEqual({ rotulo: "Preencha o desembolso para gravar", habilitado: false });
    // Critério 14 do CONTAI-027, intocado: zero anexo grava; anexo sem papel
    // respondido, não. E o rótulo diz QUANTOS faltam.
    expect(
      estadoDoGravar({
        ...base,
        papeisSemResposta: 1,
        temData: true,
        temComprovante: false,
      }).rotulo,
    ).toBe("Diga o que é o papel que falta para gravar");
    expect(
      estadoDoGravar({
        ...base,
        papeisSemResposta: 3,
        temData: true,
        temComprovante: false,
      }).rotulo,
    ).toBe("Diga o que é cada papel para gravar (3 sem resposta)");
  });

  it("`previsto` tem rótulo próprio e grava — é estado legítimo", () => {
    expect(
      estadoDoGravar({
        ...base,
        estado: "previsto",
        temData: false,
        temComprovante: false,
      }),
    ).toEqual({ rotulo: "Gravar o compromisso", habilitado: true });
  });
});

describe("critério 13 — a mensagem de sucesso não pode mentir", () => {
  it("§5, com comprovante: 'passa a compor o custo de {ano}'", () => {
    expect(dataInformada("2026", true)).toBe(
      "Data informada — o valor passa a compor o custo de 2026.",
    );
  });

  it("§5, sem comprovante: NÃO afirma que passa a compor", () => {
    // O defeito consertado: a mensagem era escolhida só por `faltaData` e
    // ignorava o comprovante — afirmava que o valor entrava quando ele não
    // entra. Mensagem de sucesso que mente fecha a pendência na cabeça dele.
    expect(dataInformada("2026", false)).toBe(
      "Data informada — o valor é de 2026. Falta o comprovante: até ele " +
        "chegar, este desembolso não entra no custo confirmado.",
    );
    expect(dataInformada("2026", false)).not.toContain("passa a compor");
  });

  it("o registro novo também não mente, nas quatro combinações", () => {
    expect(desembolsoRegistrado("ITBI", "2026", true)).toBe(
      "ITBI registrado no custo de 2026.",
    );
    expect(desembolsoRegistrado("ITBI", "2026", false)).not.toContain(
      "no custo de",
    );
    expect(desembolsoRegistrado("ITBI", "2026", false)).toContain(
      "não entra no custo confirmado",
    );
    expect(desembolsoRegistrado("ITBI", null, true)).toContain(
      DESEMBOLSO_SEM_DATA,
    );
    const semNada = desembolsoRegistrado("ITBI", null, false);
    expect(semNada).toContain(DESEMBOLSO_SEM_DATA);
    expect(semNada).toContain("Falta o comprovante");
  });
});

// ════════════════════════════════════════════════════════════════════════
// ⛔ CONTAI-036 — A PORTA ÚNICA, E O VETO POR SAÍDA
//
// O critério 16 do CONTAI-025 vetava QUALQUER saída anual havendo desembolso
// pago sem comprovante. Era guarda **temporária por desenho**: existia só
// enquanto a linha do §4.5 não existisse no relatório.
//
// A fatia 2 escreveu a linha, e o veto do terreno virou **obrigação tipada**:
//   "A porta é única; o veto é por saída."
//
// - `podeGerarRelatorioAnual` continua PORTA ÚNICA no mecanismo;
// - o `ok: true` carrega TRÊS blocos, cada um com MARCA distinta;
// - só `bensEDireitos` carrega o termo do terreno — Pagamentos Efetuados e
//   aferição INSS **não são vetados** por ele (não têm CPF a listar nem base
//   de retenção a reduzir);
// - o portão do COMPROMISSO VENCIDO continua **transversal aos três**.
// ════════════════════════════════════════════════════════════════════════

describe("CONTAI-036 · o veto é por saída, e a porta continua única", () => {
  const SEM_DESEMBOLSO = desembolsosCarregados([]);
  const HOJE = "2026-08-24";

  const vencidoSemResposta: Compromisso = {
    id: "c1",
    obraId: "obra-1",
    favorecidoId: null,
    favorecidoNome: "AJE",
    valorPrevistoCentavos: 15_000_00,
    dataPrevista: "2026-08-10",
    origem: "boleto",
    documentoOrigemId: null,
    situacao: "aberto",
    motivoCancelamento: null,
    dataCompra: null,
    pagamentoIds: [],
    adiamentos: 0,
  };

  it("⚠️ terreno pago sem comprovante NÃO veta mais NENHUMA saída", () => {
    // Era o critério 16, e ele foi PAGO — não apagado. O número que vetava
    // agora viaja DENTRO da marca de `bensEDireitos`, e quem gera a ficha o
    // recebe pronto.
    const a = desembolso({ id: "d1", valorCentavos: 60_000_00, anexos: [anexo("contrato")] });
    const b = desembolso({ id: "d2", valorCentavos: 25_000_00, anexos: [] });
    const c = desembolso({ id: "d3", valorCentavos: 4_200_00, dataPagamento: null, anexos: [] });
    const r = podeGerarRelatorioAnual([], HOJE, 2026, desembolsosCarregados([a, b, c]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bensEDireitos.foraDoCustoConfirmado.quantidade).toBe(3);
    expect(r.bensEDireitos.foraDoCustoConfirmado.totalCentavos).toBe(89_200_00);
    expect(r.bensEDireitos.ano).toBe(2026);
  });

  it("⚠️ crit. 13d — Pagamentos Efetuados e aferição NÃO carregam o termo", () => {
    // "Vetar as três é o defeito que este próprio parecer já nomeou noutra
    // tela: aviso sem consequência ensina a ignorar aviso." (`contador`)
    // Desembolso de terreno não é pagamento a PF prestador nem NF de serviço
    // PJ sujeita a retenção: não há o que vetar nessas duas saídas.
    const r = podeGerarRelatorioAnual(
      [],
      HOJE,
      2026,
      desembolsosCarregados([desembolso({ id: "d1", anexos: [] })]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect("foraDoCustoConfirmado" in r.pagamentosEfetuados).toBe(false);
    expect("foraDoCustoConfirmado" in r.afericaoInss).toBe(false);
    expect(r.pagamentosEfetuados.ano).toBe(2026);
    expect(r.afericaoInss.ano).toBe(2026);
  });

  it("sem pendência nenhuma, o termo é zero — e não some do payload", () => {
    // Zero NOMEADO, nunca campo ausente: campo que some quando o valor é zero
    // faz o consumidor escrever `?.` e a linha do §4.5 vira opcional de novo.
    const r = podeGerarRelatorioAnual(
      [],
      HOJE,
      2026,
      desembolsosCarregados([desembolso({ id: "d1" })]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bensEDireitos.foraDoCustoConfirmado).toEqual({
      quantidade: 0,
      totalCentavos: 0,
    });
  });

  it("`previsto` não entra no termo — nada saiu da conta", () => {
    const d = desembolso({ id: "d1", estado: "previsto", dataPagamento: null, anexos: [] });
    const r = podeGerarRelatorioAnual([], HOJE, 2026, desembolsosCarregados([d]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bensEDireitos.foraDoCustoConfirmado.quantidade).toBe(0);
  });

  it("⚠️ crit. 9 — compromisso vencido veta os TRÊS blocos, e não só um", () => {
    // Ele NÃO migra para `bensEDireitos`: a incerteza dele pode virar
    // pagamento a PF (Pagamentos Efetuados) ou serviço PJ (aferição), além de
    // custo. É por isso que o portão fica ACIMA dos três, e não dentro de um.
    const r = podeGerarRelatorioAnual(
      [vencidoSemResposta],
      HOJE,
      2026,
      desembolsosCarregados([desembolso({ id: "d1" })]),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.faltamResponder.map((c) => c.id)).toEqual(["c1"]);
    // Os três blocos não existem no payload de veto — não há como "pegar só
    // o de Pagamentos Efetuados" e gerar assim mesmo.
    expect("bensEDireitos" in r).toBe(false);
    expect("pagamentosEfetuados" in r).toBe(false);
    expect("afericaoInss" in r).toBe(false);
  });

  it("⚠️ pre-mortem 3 — a guarda por saída NÃO volta a ser booleano único", () => {
    // "Alguém 'simplifica' e volta a vetar as três." O antídoto é este teste:
    // com terreno pendente e ZERO compromisso vencido, as três saem.
    const r = podeGerarRelatorioAnual(
      [],
      HOJE,
      2026,
      desembolsosCarregados([desembolso({ id: "d1", anexos: [] })]),
    );
    expect(r.ok, "terreno pendente voltou a vetar as três saídas").toBe(true);
  });

  // ── Residual 1: o `[]` fecha por TIPO (critério 10) ───────────────────
  it("⚠️ residual 1 — o literal `[]` NÃO typecheca mais", () => {
    // Antes deste ticket, `podeGerarRelatorioAnual(cs, hoje, ano, [])` passava
    // e devolvia `ok: true`: a guarda do terreno sumia sem ninguém apagar
    // linha nenhuma, porque "nenhum desembolso" e "não fui buscar os
    // desembolsos" tinham a MESMA FORMA.
    //
    // ⚠️ A prova é de TIPO, e por isso as chamadas ficam dentro de uma função
    // que ninguém chama: `@ts-expect-error` derruba o `typecheck` no dia em
    // que voltarem a compilar, e EXECUTÁ-LAS não provaria nada — só estouraria
    // no acesso a `.lista`.
    function naoCompila() {
      // @ts-expect-error — o 4º parâmetro é opaco: só a camada de dados o produz
      podeGerarRelatorioAnual([], HOJE, 2026, []);
      // E a lista crua também não passa: não basta ter desembolsos na mão.
      // @ts-expect-error — `TerrenoDesembolso[]` não é `DesembolsosDoTerrenoCarregados`
      podeGerarRelatorioAnual([], HOJE, 2026, [desembolso({ id: "d1" })]);
    }
    expect(typeof naoCompila).toBe("function");
    expect(podeGerarRelatorioAnual([], HOJE, 2026, SEM_DESEMBOLSO).ok).toBe(true);
  });

  it("⚠️ a marca de um bloco NÃO serve para outro — o gerador errado não compila", () => {
    const r = podeGerarRelatorioAnual([], HOJE, 2026, SEM_DESEMBOLSO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const geraFicha = (l: LiberadoBensEDireitos) => l.foraDoCustoConfirmado;
    expect(geraFicha(r.bensEDireitos)).toEqual({ quantidade: 0, totalCentavos: 0 });
    // @ts-expect-error — Pagamentos Efetuados não é Bens e Direitos
    geraFicha(r.pagamentosEfetuados);
    // @ts-expect-error — aferição INSS não é Bens e Direitos
    geraFicha(r.afericaoInss);
    // @ts-expect-error — e não se forja a marca com um objeto qualquer
    geraFicha({ ano: 2026, foraDoCustoConfirmado: { quantidade: 0, totalCentavos: 0 } });
  });

  // ── Residual 2: a blindagem varre por SÍMBOLO, não por arquivo ────────
  //
  // ⚠️ **O defeito que isto conserta.** A versão anterior perguntava
  // `NA_PORTA.test(fonte)` — sobre o ARQUIVO INTEIRO. Um arquivo que
  // mencionasse a porta em qualquer linha passava, **mesmo ganhando um gerador
  // novo que não a chamasse**. Era teórico enquanto não existisse tela de
  // relatório; deixou de ser no dia em que ela existiu, que é este ticket:
  // `discriminacao.ts` tem gerador E constantes, e `saida-anual.ts` tem a
  // porta composta.
  describe("residual 2 — a blindagem é por símbolo", () => {
    const RADICAIS =
      "(discrimina|saida.?anual|relatorio.?anual|pagamentos.?efetuados|" +
      "dossie|declaracao|bens.?e.?direitos|afericao|sero)";
    /**
     * ⚠️ Ancorado em **início de linha** (`^`, flag `m`): o alvo é declaração
     * de MÓDULO, que é onde gerador mora e a única que outro arquivo consegue
     * importar. Sem a âncora, um `const discriminacao = …` local **dentro** de
     * uma função que já passa pela porta cai aqui — ruído que ensina a
     * silenciar o teste, e teste que se aprende a silenciar não guarda nada.
     */
    const DECLARA = `^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?(?:function|const|class)\\s+([A-Za-z0-9_]*${RADICAIS}[A-Za-z0-9_]*)\\b`;
    /**
     * ⚠️ **UM NOME SÓ** (critério 12). Era `bloqueioDaSaidaAnual|
     * podeGerarRelatorioAnual`; a primeira saiu com a guarda da fatia 1, e a
     * regex encolheu junto. Lista de apelidos crescendo é como a porta deixa
     * de ser única sem ninguém decidir isso.
     */
    const NA_PORTA = /podeGerarRelatorioAnual/;
    /** As três marcas, mais o tipo opaco do 4º parâmetro da porta. */
    const MARCAS =
      "(?:Liberado(?:BensEDireitos|PagamentosEfetuados|AfericaoInss)|" +
      "DesembolsosDoTerrenoCarregados)";
    /**
     * A outra forma de passar pela porta, e ela é a do CONTAI-036: **receber a
     * marca**. Um gerador que exige `Liberado*` na assinatura não tem como ser
     * chamado sem a porta ter dito sim — é proteção MAIS forte que chamar a
     * porta, não mais fraca.
     *
     * ⚠️ **ANCORADA EM POSIÇÃO DE PARÂMETRO** (`(` ou `,` · nome · `:`), e a
     * correção é do Gate 2. A versão anterior casava **qualquer menção** ao
     * nome da marca em qualquer ponto do corpo — então quem **forjava** a
     * marca com um `as` passava justamente por **citá-la**. A blindagem
     * aprovava o forjador. Menção não é exigência: só quem a pede na
     * assinatura fica impedido de rodar sem ela.
     */
    const EXIGE_A_MARCA = new RegExp(
      `[(,]\\s*(?:readonly\\s+)?[A-Za-z0-9_]+\\s*:\\s*${MARCAS}\\b`,
    );
    /**
     * ⛔ **O FURO QUE O `cto-obra` ACHOU NO GATE 2, e ele não era teórico.**
     *
     * A marca é um `unique symbol` declarado só no tipo — mas o alvo do `as`
     * é *comparável* ao literal, então **`{ ano } as LiberadoPagamentosEfetuados`
     * COMPILA**. Forjar a liberação da porta era uma linha, e a proteção de
     * tipo que sustenta a arquitetura inteira não impedia nada.
     *
     * O conserto tem de ser um scan, porque o compilador não fecha isto:
     * **nenhum `as` para marca fora de `lib/fiscal/compromisso.ts`**, que é o
     * único lugar onde ela nasce legitimamente — a porta e o construtor do
     * tipo opaco. Um `as unknown as` no meio também não escapa.
     */
    const FORJA = new RegExp(`\\bas\\s+(?:unknown\\s+as\\s+)?${MARCAS}\\b`);
    /** O berço legítimo da marca: a porta e o construtor do tipo opaco. */
    const BERCO_DA_MARCA = "lib/fiscal/compromisso.ts";
    /**
     * A terceira forma, e é a que `app/` usa: **delegar à porta composta**.
     *
     * ⚠️ Isto NÃO é um apelido de `podeGerarRelatorioAnual` — `NA_PORTA`
     * continua com **um nome só** (critério 12). `carregarSaidaAnual` é ela
     * própria varrida por este teste, no mesmo diff, e só passa porque chama a
     * porta: quem delega a ela está a **um salto verificado** da porta, e não
     * a um segundo portão que não a conhece.
     */
    const PELA_PORTA_COMPOSTA = /carregarSaidaAnual/;

    /**
     * Comentário **não é código**. Sem isto, a menção ao nome da porta numa
     * linha de documentação satisfaz — ou reprova — a blindagem por engano, e
     * nos dois sentidos o teste passa a medir prosa.
     */
    function semComentarios(fonte: string): string {
      let fora = "";
      let modo: "codigo" | "linha" | "bloco" | '"' | "'" | "`" = "codigo";
      for (let i = 0; i < fonte.length; i += 1) {
        const c = fonte[i];
        const par = c + (fonte[i + 1] ?? "");
        if (modo === "codigo") {
          if (par === "//") { modo = "linha"; i += 1; continue; }
          if (par === "/*") { modo = "bloco"; i += 1; continue; }
          if (c === '"' || c === "'" || c === "`") modo = c;
          fora += c;
          continue;
        }
        if (modo === "linha") {
          if (c === "\n") { modo = "codigo"; fora += c; }
          continue;
        }
        if (modo === "bloco") {
          if (par === "*/") { modo = "codigo"; i += 1; }
          else if (c === "\n") fora += c;
          continue;
        }
        // dentro de string: `\\` escapa o próximo caractere
        if (c === "\\") { fora += c + (fonte[i + 1] ?? ""); i += 1; continue; }
        if (c === modo) modo = "codigo";
        fora += c;
      }
      return fora;
    }

    /** O corpo do símbolo, por contagem de chaves — não o arquivo inteiro. */
    function corpoDoSimbolo(fonte: string, inicio: number): string {
      const abre = fonte.indexOf("{", inicio);
      if (abre === -1) return fonte.slice(inicio, fonte.indexOf("\n\n", inicio) + 1);
      let nivel = 0;
      for (let i = abre; i < fonte.length; i += 1) {
        if (fonte[i] === "{") nivel += 1;
        else if (fonte[i] === "}") {
          nivel -= 1;
          if (nivel === 0) return fonte.slice(inicio, i + 1);
        }
      }
      return fonte.slice(inicio);
    }

    function simbolosForaDaPorta(fonte: string): string[] {
      const re = new RegExp(DECLARA, "gim");
      const fora: string[] = [];
      let achado: RegExpExecArray | null;
      while ((achado = re.exec(fonte)) !== null) {
        const corpo = corpoDoSimbolo(fonte, achado.index);
        if (
          !NA_PORTA.test(corpo) &&
          !EXIGE_A_MARCA.test(corpo) &&
          !PELA_PORTA_COMPOSTA.test(corpo)
        ) {
          fora.push(achado[1]);
        }
      }
      return fora;
    }

    it("⛔ FIXTURE NEGATIVA — o FORJADOR é pego, e citar a marca não o salva", () => {
      // Era exatamente assim que se burlava a arquitetura de ontem: um `as` de
      // uma linha, que COMPILA, e a blindagem lendo a citação da marca como
      // "este arquivo passa pela porta".
      const forjador = [
        "export function gerarDiscriminacaoDoAno(ano: number) {",
        "  const liberado = { ano } as LiberadoBensEDireitos;",
        "  return liberado.ano;",
        "}",
      ].join("\n");
      expect(FORJA.test(forjador), "o scan não pegou o `as` da marca").toBe(true);
      // E a citação NÃO o salva mais: `EXIGE_A_MARCA` só casa em posição de
      // parâmetro, então o forjador continua caindo como fora da porta.
      expect(EXIGE_A_MARCA.test(forjador)).toBe(false);
      expect(simbolosForaDaPorta(forjador)).toEqual(["gerarDiscriminacaoDoAno"]);

      // O `as unknown as` no meio também não escapa.
      expect(
        FORJA.test("const x = {} as unknown as DesembolsosDoTerrenoCarregados;"),
      ).toBe(true);
      // E quem pede a marca no PARÂMETRO continua passando — é o caminho certo.
      expect(
        EXIGE_A_MARCA.test(
          "export function gerarBensEDireitos(l: LiberadoBensEDireitos) {",
        ),
      ).toBe(true);
      expect(
        FORJA.test("export function gerarBensEDireitos(l: LiberadoBensEDireitos) {"),
      ).toBe(false);
    });

    it("⛔ nenhum arquivo FORJA a marca fora do berço dela", () => {
      const forjadores: string[] = [];
      for (const arquivo of [...varrer("lib"), ...varrer("app")]) {
        if (arquivo === BERCO_DA_MARCA) continue;
        const fonte = semComentarios(readFileSync(arquivo, "utf-8"));
        if (FORJA.test(fonte)) forjadores.push(arquivo);
      }
      expect(
        forjadores,
        "forjar a liberação da porta é um `as` de uma linha que COMPILA — o " +
          "compilador não fecha isto, e este scan é o que fecha. A marca só " +
          `nasce em \`${BERCO_DA_MARCA}\`: a porta e o construtor do tipo ` +
          "opaco. Precisa de uma marca? Chame `podeGerarRelatorioAnual`.",
      ).toEqual([]);
      // ⚠️ E o berço tem de continuar forjando — se ele parar, o scan acima
      // passa por vacuidade e ninguém nota que a marca virou objeto comum.
      expect(FORJA.test(semComentarios(readFileSync(BERCO_DA_MARCA, "utf-8")))).toBe(
        true,
      );
    });

    it("⚠️ FIXTURE NEGATIVA — um chamador e um não-chamador no mesmo arquivo REPROVA", () => {
      // É exatamente o caso que a varredura por arquivo deixava passar.
      const fonte = [
        "export function gerarDiscriminacaoDoAno(l: LiberadoBensEDireitos) {",
        "  return l.ano;",
        "}",
        "",
        "export function gerarPagamentosEfetuados(ano: number) {",
        '  return `lista de ${ano}`;',
        "}",
      ].join("\n");
      // O arquivo MENCIONA a marca — e mesmo assim o segundo símbolo cai.
      expect(EXIGE_A_MARCA.test(fonte)).toBe(true);
      expect(simbolosForaDaPorta(fonte)).toEqual(["gerarPagamentosEfetuados"]);
    });

    it("fixture positiva — os dois passam quando os dois passam pela porta", () => {
      const fonte = [
        "export function gerarDiscriminacaoDoAno(l: LiberadoBensEDireitos) {",
        "  return l.ano;",
        "}",
        "",
        "export function gerarPagamentosEfetuados(l: LiberadoPagamentosEfetuados) {",
        "  return l.ano;",
        "}",
      ].join("\n");
      expect(simbolosForaDaPorta(fonte)).toEqual([]);
    });

    /**
     * ⚠️ Exceção **declarada e argumentada**, nunca silenciada por regex
     * frouxa. Entrada nova exige a mesma frase: *por que isto NÃO é saída
     * anual*. A chave é `arquivo::simbolo` — o arquivo inteiro nunca é
     * dispensado de uma vez, que era o buraco de ontem.
     */
    const FORA_COM_MOTIVO: Record<string, string> = {
      "lib/fiscal/revisao.ts::composicaoDaDiscriminacao":
        "não gera saída nenhuma: é o antes→depois de material × mão de obra " +
        "DENTRO da tela de correção (CONTAI-021). Reparte um total que já " +
        "existe; não produz texto de declaração e não é lida por saída nenhuma. " +
        "⛔ É o DEFEITO VIVO do §0 do parecer de 24/08 — ponderada por " +
        "`cobertoCentavos`, que o próprio código declara sem efeito fiscal. " +
        "Corrigi-la muda o número de tela já entregue: é escopo do `po`.",
    };

    const varrer = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? varrer(`${dir}/${e.name}`)
          : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
            ? [`${dir}/${e.name}`]
            : [],
      );

    it("nenhum produtor de saída anual existe fora da porta única", () => {
      const arquivos = [...varrer("lib"), ...varrer("app")];
      expect(arquivos.length).toBeGreaterThan(10); // o teste vale alguma coisa

      const pegos: string[] = [];
      for (const arquivo of arquivos) {
        const fonte = semComentarios(readFileSync(arquivo, "utf-8"));
        for (const nome of simbolosForaDaPorta(fonte)) {
          const chave = `${arquivo}::${nome}`;
          pegos.push(chave);
          expect(
            FORA_COM_MOTIVO[chave] !== undefined,
            `${chave} produz saída anual sem passar pela porta única ` +
              "(`podeGerarRelatorioAnual`) e sem exigir a marca dela " +
              "(`LiberadoBensEDireitos` / `LiberadoPagamentosEfetuados` / " +
              "`LiberadoAfericaoInss`) e sem delegar à porta composta " +
              "(`carregarSaidaAnual`). Se este símbolo NÃO é saída anual, " +
              "declare-o em `FORA_COM_MOTIVO` com a razão.",
          ).toBe(true);
        }
      }
      // Exceção obsoleta não fica de graça.
      for (const chave of Object.keys(FORA_COM_MOTIVO)) {
        expect(pegos, `${chave} não casa mais — remova a exceção`).toContain(chave);
      }
    });

    it("⚠️ `app/` importa a porta COMPOSTA, nunca a pura", () => {
      // Cláusula nova do CONTAI-036 (Viabilidade). A tela passa `obraId`; quem
      // monta argumento é a camada de dados. Uma tela que importe a porta pura
      // volta a poder escrever o `[]` — só que agora com um `as` para forjar o
      // tipo opaco, e é isso que este teste procura.
      for (const arquivo of varrer("app")) {
        const fonte = semComentarios(readFileSync(arquivo, "utf-8"));
        expect(
          /podeGerarRelatorioAnual|desembolsosCarregados/.test(fonte),
          `${arquivo} importa a porta PURA — use \`carregarSaidaAnual\` de ` +
            "`lib/dados/saida-anual.ts`, que carrega e consulta numa passada",
        ).toBe(false);
      }
    });
  });
});
