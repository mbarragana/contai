import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { formatarBRL } from "@/lib/money";
import {
  acaoDaPendenciaDeDatas,
  anosDoFinanciamento,
  comprovantesDe,
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
      anexos: [],
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
      anexos: [],
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
