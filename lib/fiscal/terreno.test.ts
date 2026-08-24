import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { formatarBRL } from "@/lib/money";
import * as terreno from "@/lib/fiscal/terreno";
import { podeGerarRelatorioAnual } from "@/lib/fiscal/compromisso";
import {
  acaoDaPendenciaDeDatas,
  ANTES_DE_DIZER_O_QUE_E_CADA_PAPEL,
  anosDoFinanciamento,
  bloqueioDaSaidaAnual,
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
    for (const arquivo of varrer("app")) {
      expect(
        readFileSync(arquivo, "utf-8").includes(
          "FORA_DO_CUSTO_CONFIRMADO_DECIDA_NO_RELATORIO",
        ),
        `${arquivo} usa o handoff ao CRC, que é do relatório anual (fatia 2)`,
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
// ⛔ CRITÉRIO 16 — A GUARDA DA FATIA 2
//
// Enquanto o critério 17 (a linha nomeada do §4.5 no relatório anual) não
// entrar, NENHUMA saída anual é gerada existindo desembolso pago sem
// comprovante. É o antídoto do padrão que já produziu a D47 nesta base:
// pendência gravada, superfície nunca entregue.
// ════════════════════════════════════════════════════════════════════════

describe("critério 16 — nenhuma saída anual com pago-sem-comprovante", () => {
  it("sem pendência, não bloqueia", () => {
    const d = desembolso({ id: "d1" });
    expect(bloqueioDaSaidaAnual([d], 2026)).toEqual({
      bloqueada: false,
      motivo: "",
      quantidade: 0,
      totalCentavos: 0,
    });
  });

  it("com pendência, bloqueia — e a falha é NOMEADA, nunca número mudo", () => {
    const a = desembolso({
      id: "d1",
      valorCentavos: 60_000_00,
      anexos: [anexo("contrato")],
    });
    const b = desembolso({ id: "d2", valorCentavos: 25_000_00, anexos: [] });
    const c = desembolso({
      id: "d3",
      valorCentavos: 4_200_00,
      dataPagamento: null,
      anexos: [],
    });
    const r = bloqueioDaSaidaAnual([a, b, c], 2026);
    expect(r.bloqueada).toBe(true);
    expect(r.quantidade).toBe(3);
    expect(r.totalCentavos).toBe(89_200_00);
    // A falha diz QUANTOS, QUANTO e POR QUÊ — as três coisas.
    expect(r.motivo).toContain("3 desembolsos pagos sem comprovante");
    expect(r.motivo).toContain(formatarBRL(89_200_00));
    expect(r.motivo).toContain("A discriminação de 2026 não vai ser gerada");
    expect(r.motivo).toContain("um total que não diz o que deixou de fora");
  });

  it("o singular também é nomeado", () => {
    const d = desembolso({ id: "d1", anexos: [] });
    expect(bloqueioDaSaidaAnual([d], 2026).motivo).toContain(
      "1 desembolso pago sem comprovante",
    );
  });

  it("`previsto` NÃO bloqueia — nada saiu da conta", () => {
    const d = desembolso({
      id: "d1",
      estado: "previsto",
      dataPagamento: null,
      anexos: [],
    });
    expect(bloqueioDaSaidaAnual([d], 2026).bloqueada).toBe(false);
  });

  // ⚠️ **A GUARDA TEM DE TER CONSUMIDOR DE PRODUÇÃO.** Guarda satisfeita por
  // vacuidade — função nomeada que ninguém chama — é pior que guarda nenhuma:
  // ela põe selo de resolvido no pre-mortem 3 e o deixa aberto por baixo.
  //
  // A porta do relatório anual JÁ EXISTIA: `podeGerarRelatorioAnual`
  // (`lib/fiscal/compromisso.ts`, CONTAI-019 critério 21). Compor os dois
  // portões numa porta só é o conserto; **dois portões que não se conhecem é
  // exatamente como a D47 nasceu**.
  it("a porta do relatório anual CONSULTA a guarda — sem compromisso nenhum", () => {
    const soEscritura = desembolso({
      id: "d1",
      valorCentavos: 60_000_00,
      anexos: [anexo("contrato")],
    });
    // Zero compromissos: o portão do CONTAI-019 está aberto. Se a guarda do
    // terreno não fosse consultada, isto devolveria `{ ok: true }` e a
    // discriminação sairia com um total que não diz o que deixou de fora.
    const r = podeGerarRelatorioAnual([], "2026-08-23", 2026, [soEscritura]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.faltamResponder).toHaveLength(0);
    expect(r.terrenoSemComprovante!.totalCentavos).toBe(60_000_00);
    expect(r.terrenoSemComprovante!.motivo).toContain(
      "1 desembolso pago sem comprovante",
    );
  });

  it("as duas faltas aparecem JUNTAS — nunca uma de cada vez", () => {
    // Nomear uma só ensinaria a resolver em série: ele fecha a primeira,
    // comemora, e descobre a segunda no toque seguinte.
    const r = podeGerarRelatorioAnual(
      [
        {
          id: "c1",
          obraId: "obra-1",
          favorecidoId: null,
          favorecidoNome: "AJE",
          valorPrevistoCentavos: 15_000_00,
          dataPrevista: "2026-08-10", // vencido em 23/08, sem resposta
          origem: "boleto",
          documentoOrigemId: null,
          situacao: "aberto",
          motivoCancelamento: null,
          dataCompra: null,
          pagamentoIds: [],
          adiamentos: 0,
        },
      ],
      "2026-08-23",
      2026,
      [desembolso({ id: "d1", anexos: [] })],
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.faltamResponder).toHaveLength(1);
    expect(r.terrenoSemComprovante).not.toBeNull();
  });

  it("com tudo comprovado e nada vencido, o relatório gera", () => {
    expect(
      podeGerarRelatorioAnual([], "2026-08-23", 2026, [desembolso({ id: "d1" })]),
    ).toEqual({ ok: true });
  });

  // ⚠️ BLINDAGEM POR AUSÊNCIA DE CAMINHO, no padrão da blindagem da estimativa
  // (`resumo.test.ts`) — e com a correção que a estimativa já tinha e esta não:
  // **ancora em RADICAIS do domínio, não numa lista de nomes exatos.** A versão
  // anterior greppava `gerarRelatorioAnual` e não casava com
  // `podeGerarRelatorioAnual` por causa do prefixo `pode` — a guarda existia e
  // não guardava o alvo que já estava na base.
  //
  // O que este teste prova não é que a guarda funciona: é que NÃO EXISTE módulo
  // produzindo saída anual fora da porta única. Quem escrever
  // `gerarDossieDeAquisicao` ou `textoDeBensEDireitos` deixa a suíte vermelha
  // COM O NOME DO ARQUIVO — antes de o número chegar a uma declaração.
  it("nenhum produtor de saída anual existe fora da porta única", () => {
    const RADICAIS =
      "(discrimina|saida.?anual|relatorio.?anual|pagamentos.?efetuados|" +
      "dossie|declaracao|bens.?e.?direitos|afericao|sero)";
    // Casa em DECLARAÇÃO (`function|const|class X`) e em EXPORT (`export { X }`).
    const declara = new RegExp(
      `(?:export\\s+)?(?:async\\s+)?(?:function|const|class)\\s+([A-Za-z0-9_]*${RADICAIS}[A-Za-z0-9_]*)\\b`,
      "i",
    );
    const exporta = new RegExp(
      `export\\s*\\{[^}]*\\b([A-Za-z0-9_]*${RADICAIS}[A-Za-z0-9_]*)\\b`,
      "i",
    );
    /** Passa pela porta única — direto, ou delegando a quem a consulta. */
    const NA_PORTA = /bloqueioDaSaidaAnual|podeGerarRelatorioAnual/;
    /**
     * ⚠️ Exceção **declarada e argumentada**, nunca silenciada por regex frouxa.
     * Entrada nova aqui exige a mesma frase: *por que isto NÃO é saída anual*.
     */
    const FORA_COM_MOTIVO: Record<string, string> = {
      "lib/fiscal/revisao.ts":
        "`composicaoDaDiscriminacao` não gera saída nenhuma: é o antes→depois " +
        "de material × mão de obra DENTRO da tela de correção (CONTAI-021). " +
        "Ela reparte um total que já existe; não produz texto de declaração, " +
        "não soma terreno e não é lida por nenhuma saída.",
    };

    const varrer = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? varrer(`${dir}/${e.name}`)
          : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
            ? [`${dir}/${e.name}`]
            : [],
      );
    const arquivos = [...varrer("lib"), ...varrer("app")];
    expect(arquivos.length).toBeGreaterThan(10); // o teste vale alguma coisa

    const pegos: string[] = [];
    for (const arquivo of arquivos) {
      const fonte = readFileSync(arquivo, "utf-8");
      const achado = declara.exec(fonte) ?? exporta.exec(fonte);
      if (!achado) continue;
      pegos.push(arquivo);
      if (FORA_COM_MOTIVO[arquivo]) continue;
      expect(
        NA_PORTA.test(fonte),
        `${arquivo} produz saída anual (\`${achado[1]}\`) sem passar pela porta ` +
          "única (`podeGerarRelatorioAnual` / `bloqueioDaSaidaAnual`) — a linha " +
          "nomeada do §4.5 ainda não existe, e o critério 16 do CONTAI-025 " +
          "proíbe gerar um total que não diz o que deixou de fora. Se este " +
          "símbolo NÃO é saída anual, declare-o em `FORA_COM_MOTIVO` com a razão.",
      ).toBe(true);
    }
    // A regex tem de estar pegando alguma coisa — inclusive a própria porta.
    expect(pegos).toContain("lib/fiscal/compromisso.ts");
    // Exceção obsoleta não fica de graça: o arquivo tem de continuar existindo.
    for (const arquivo of Object.keys(FORA_COM_MOTIVO)) {
      expect(pegos, `${arquivo} não casa mais — remova a exceção`).toContain(
        arquivo,
      );
    }
  });
});
