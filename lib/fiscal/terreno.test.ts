import { describe, expect, it } from "vitest";

import { formatarBRL } from "@/lib/money";
import {
  anosDoFinanciamento,
  custoDoInformeCentavos,
  custoTerrenoAteOAno,
  custoTerrenoDoAno,
  entraEmAlgumAno,
  penalidadesCentavos,
  rubricasComClassificacaoEmAberto,
  somaDasRubricasCentavos,
  TAXAS_E_FCVS_NA_MESMA_LINHA,
  tiposDeDesembolsoPara,
  travaDaSoma,
} from "@/lib/fiscal/terreno";
import type { FinanciamentoInforme, TerrenoDesembolso } from "@/lib/types";

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
    arquivoPath: "u/terreno/comprovante.pdf",
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
    expect(custoTerrenoAteOAno([terreno, itbi], [], 2024)).toBe(42_000_000);
    expect(custoTerrenoAteOAno([terreno, itbi], [], 2025)).toBe(43_260_000);
  });

  it("o que cai DENTRO de cada ano é só o daquele ano", () => {
    expect(custoTerrenoDoAno([terreno, itbi], [], 2024)).toBe(42_000_000);
    expect(custoTerrenoDoAno([terreno, itbi], [], 2025)).toBe(1_260_000);
  });

  it("o defeito que o ticket conserta: o terreno NÃO entra em todo ano", () => {
    // Antes do CONTAI-010, `custoTerrenoCentavos(obra)` injetava a soma inteira
    // em TODO ano, inclusive nos anteriores ao pagamento.
    expect(custoTerrenoAteOAno([terreno, itbi], [], 2023)).toBe(0);
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
      arquivoPath: null,
    });
    expect(entraEmAlgumAno(previsto)).toBe(false);
    expect(custoTerrenoAteOAno([previsto], [], anoCorrente)).toBe(0);
    expect(custoTerrenoDoAno([previsto], [], anoCorrente)).toBe(0);
  });

  it("pago SEM data não entra em ano nenhum — pendência de complemento", () => {
    // Foi pago, mas o ano é desconhecido. O app não inventa a data (critério
    // 22); o valor fica visível como pendência de complemento, fora das somas.
    const semData = desembolso({
      id: "d2",
      valorCentavos: 80_000_000,
      dataPagamento: null,
      estado: "pago",
      arquivoPath: null,
    });
    expect(entraEmAlgumAno(semData)).toBe(false);
    for (const ano of [2024, 2025, 2026, 2099]) {
      expect(custoTerrenoAteOAno([semData], [], ano)).toBe(0);
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
    expect(dobrado).toBe(2 * custoDoInformeCentavos(INFORME_2025));
    // Um só é o estado que o banco permite representar.
    expect(custoTerrenoAteOAno([], [INFORME_2025], 2025)).toBe(5_993_475);
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
    expect(custoTerrenoAteOAno([], [semSaldo], 2025)).toBe(
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
    expect(custoTerrenoAteOAno([], [INFORME_2025], 2026)).toBe(5_993_475);
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
