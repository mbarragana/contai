import { describe, expect, it } from "vitest";

import {
  compromissosAbertosDaFatura,
  COR_FATURA_SEM_EXTRATO,
  faltaOExtrato,
  faturasSemExtrato,
  FATURA_SEM_EXTRATO_NAO_VETA,
  nadaElegivelParaAlocacao,
  RECUSA_PARCELADO,
  saldoNaoAlocadoCentavos,
  tetoDeAlocacaoCentavos,
  totalDesembolsadoCentavos,
  validarCompraCartao,
  type EntradaCompraCartao,
} from "./fatura";
import type { Compromisso, Fatura } from "@/lib/types";

function entrada(over: Partial<EntradaCompraCartao> = {}): EntradaCompraCartao {
  return {
    favorecidoNome: "Depósito Bom Jesus",
    favorecidoDocumento: "33.221.100/0001-45",
    valorCentavos: 95_000,
    dataCompra: "2026-10-20",
    dataVencimentoFatura: "2026-11-10",
    parcelado: "vista",
    ...over,
  };
}

describe("validarCompraCartao", () => {
  it("sem resposta de parcelamento, pede a resposta e não olha mais nada", () => {
    const erros = validarCompraCartao(entrada({ parcelado: null }));
    expect(erros).toHaveLength(1);
    expect(erros[0].campo).toBe("parcelado");
  });

  it("parcelado é recusa síncrona, com o texto literal do contador (ADENDO 5)", () => {
    const erros = validarCompraCartao(entrada({ parcelado: "parcelado" }));
    expect(erros).toHaveLength(1);
    expect(erros[0].campo).toBe("parcelado");
    expect(erros[0].mensagem).toBe(RECUSA_PARCELADO);
  });

  it("à vista, com tudo preenchido, não tem erro", () => {
    expect(validarCompraCartao(entrada())).toEqual([]);
  });

  it("à vista sem valor, sem data da compra e sem vencimento: três erros próprios", () => {
    const erros = validarCompraCartao(
      entrada({ valorCentavos: null, dataCompra: "", dataVencimentoFatura: "" }),
    );
    expect(erros.map((e) => e.campo).sort()).toEqual([
      "dataCompra",
      "dataVencimentoFatura",
      "valorCentavos",
    ]);
  });

  it("favorecido vazio é erro — o lojista é obrigatório, nunca banco/administradora", () => {
    const erros = validarCompraCartao(entrada({ favorecidoNome: "" }));
    expect(erros.some((e) => e.campo === "favorecidoNome")).toBe(true);
  });
});

const OBRA_ID = "obra-1";

function fatura(over: Partial<Fatura> = {}): Fatura {
  return {
    id: "fat-1",
    obraId: OBRA_ID,
    dataVencimento: "2026-10-10",
    compromissoIds: ["c1", "c2", "c3"],
    desembolsos: [],
    extratoPath: null,
    ...over,
  };
}

/** Um desembolso qualquer — o que importa aqui é EXISTIR e o valor dele. */
function desembolso(id: string, valorCentavos: number) {
  return {
    id,
    faturaId: "fat-1",
    valorCentavos,
    dataPagamento: "2026-10-10",
    comprovantePath: null,
  };
}

function compromisso(over: Partial<Compromisso> & { id: string }): Compromisso {
  return {
    obraId: OBRA_ID,
    favorecidoId: "fav-1",
    favorecidoNome: "Leroy Merlin",
    valorPrevistoCentavos: 120_000,
    documentoPrevistoIds: [],
    dataPrevista: "2026-10-10",
    origem: "cartao",
    documentoOrigemId: null,
    origemDesfeitaId: null,
    origemDesfeitaEm: null,
    situacao: "aberto",
    motivoCancelamento: null,
    dataCompra: "2026-09-15",
    pagamentoIds: [],
    adiamentos: 0,
    ...over,
  };
}

describe("compromissosAbertosDaFatura", () => {
  it("só as da fatura, e só as abertas", () => {
    const cs = [
      compromisso({ id: "c1", situacao: "aberto" }),
      compromisso({ id: "c2", situacao: "quitado" }),
      compromisso({ id: "fora", situacao: "aberto" }), // não pertence à fatura
    ];
    const abertos = compromissosAbertosDaFatura(fatura({ compromissoIds: ["c1", "c2"] }), cs);
    expect(abertos.map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("tetoDeAlocacaoCentavos", () => {
  it("sem nenhum desembolso, teto é zero", () => {
    expect(tetoDeAlocacaoCentavos(fatura(), [])).toBe(0);
  });

  it("desembolso integral cobrindo tudo: teto = total desembolsado, nada quitado ainda", () => {
    const f = fatura({
      desembolsos: [
        { id: "d1", faturaId: "fat-1", valorCentavos: 500_000, dataPagamento: "2026-10-10", comprovantePath: null },
      ],
    });
    expect(tetoDeAlocacaoCentavos(f, [])).toBe(500_000);
  });

  it("teto encolhe exatamente pelo valor já alocado (compras quitadas desta fatura)", () => {
    const f = fatura({
      desembolsos: [
        { id: "d1", faturaId: "fat-1", valorCentavos: 150_000, dataPagamento: "2026-10-08", comprovantePath: null },
      ],
    });
    const cs = [
      compromisso({ id: "c1", situacao: "quitado", valorPrevistoCentavos: 120_000 }),
      compromisso({ id: "c2", situacao: "aberto", valorPrevistoCentavos: 48_000 }),
    ];
    expect(tetoDeAlocacaoCentavos(f, cs)).toBe(30_000);
  });

  it("compra quitada de OUTRA fatura não consome o teto desta", () => {
    const cs = [
      compromisso({ id: "c1", situacao: "aberto", valorPrevistoCentavos: 100_000 }),
      compromisso({ id: "outra-fatura", situacao: "quitado", valorPrevistoCentavos: 999_999 }),
    ];
    const f2 = fatura({
      compromissoIds: ["c1"],
      desembolsos: [
        { id: "d1", faturaId: "fat-1", valorCentavos: 100_000, dataPagamento: "2026-10-08", comprovantePath: null },
      ],
    });
    expect(tetoDeAlocacaoCentavos(f2, cs)).toBe(100_000);
  });

  it("nunca fica negativo, mesmo se o alocado (por algum motivo) superasse o desembolsado", () => {
    const f = fatura({
      desembolsos: [
        { id: "d1", faturaId: "fat-1", valorCentavos: 10_000, dataPagamento: "2026-10-08", comprovantePath: null },
      ],
    });
    const cs = [compromisso({ id: "c1", situacao: "quitado", valorPrevistoCentavos: 999_999 })];
    expect(tetoDeAlocacaoCentavos(f, cs)).toBe(0);
  });
});

describe("nadaElegivelParaAlocacao (s7v)", () => {
  it("true quando não sobra nenhuma compra aberta na fatura", () => {
    const cs = [
      compromisso({ id: "c1", situacao: "quitado" }),
      compromisso({ id: "c2", situacao: "quitado" }),
    ];
    expect(nadaElegivelParaAlocacao(fatura({ compromissoIds: ["c1", "c2"] }), cs)).toBe(true);
  });

  it("false havendo ao menos uma aberta, mesmo com teto zero", () => {
    const cs = [compromisso({ id: "c1", situacao: "aberto" })];
    // ⚠️ Nunca decidir por teto=0 — isso esconderia a compra em aberto.
    expect(nadaElegivelParaAlocacao(fatura({ compromissoIds: ["c1"] }), cs)).toBe(false);
  });
});

describe("totalDesembolsadoCentavos / saldoNaoAlocadoCentavos", () => {
  it("soma os N desembolsos (rotativo em mais de uma parcela)", () => {
    const f = fatura({
      desembolsos: [
        { id: "d1", faturaId: "fat-1", valorCentavos: 150_000, dataPagamento: "2026-10-08", comprovantePath: null },
        { id: "d2", faturaId: "fat-1", valorCentavos: 50_000, dataPagamento: "2026-11-05", comprovantePath: null },
      ],
    });
    expect(totalDesembolsadoCentavos(f)).toBe(200_000);
  });

  it("saldo não alocado é o que sobra da seleção atual, nunca negativo", () => {
    const f = fatura({
      desembolsos: [
        { id: "d1", faturaId: "fat-1", valorCentavos: 150_000, dataPagamento: "2026-10-08", comprovantePath: null },
      ],
    });
    expect(
      saldoNaoAlocadoCentavos(f, [{ valorPrevistoCentavos: 120_000 }]),
    ).toBe(30_000);
    expect(
      saldoNaoAlocadoCentavos(f, [{ valorPrevistoCentavos: 150_000 }]),
    ).toBe(0);
  });
});

// ══ CONTAI-067 · a regra da pendência "fatura sem extrato" ═══════════════
//
// Fonte: `docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md`,
// ADENDO (requisito) e ADENDO 2 (cor/gravidade).

describe("faltaOExtrato — a regra do critério 14, e ela tem DUAS pernas", () => {
  /**
   * ⚠️ **A perna que se esquece.** Fatura sem pagamento nenhum **não cobra
   * extrato**: o ciclo pode nem ter fechado, o dinheiro não saiu e não há
   * ano-calendário a fixar. Cobrar ali seria alarme sem consequência — e alarme
   * sem consequência ensina a ignorar alarme.
   */
  it("sem desembolso nenhum NÃO falta extrato, mesmo com extratoPath null", () => {
    expect(faltaOExtrato(fatura({ desembolsos: [], extratoPath: null }))).toBe(
      false,
    );
  });

  it("com desembolso e sem extrato, falta — é a pendência", () => {
    expect(
      faltaOExtrato(
        fatura({ desembolsos: [desembolso("d1", 150_000)], extratoPath: null }),
      ),
    ).toBe(true);
  });

  it("com desembolso e COM extrato, não falta nada", () => {
    expect(
      faltaOExtrato(
        fatura({
          desembolsos: [desembolso("d1", 150_000)],
          extratoPath: "uid/extrato/fatura-outubro.pdf",
        }),
      ),
    ).toBe(false);
  });

  /**
   * O rotativo: N desembolsos, UM extrato. É o argumento inteiro de a coluna
   * morar em `fatura` e não em `fatura_desembolso` — com o extrato anexado, dois
   * desembolsos parciais não abrem duas pendências.
   */
  it("N desembolsos parciais com um extrato só: nada falta", () => {
    expect(
      faltaOExtrato(
        fatura({
          desembolsos: [desembolso("d1", 100_000), desembolso("d2", 50_000)],
          extratoPath: "uid/extrato/ciclo.pdf",
        }),
      ),
    ).toBe(false);
  });
});

describe("faturasSemExtrato — o agregado do card", () => {
  it("nenhuma fatura na condição devolve null, e o card desaparece sozinho", () => {
    expect(faturasSemExtrato([])).toBeNull();
    expect(
      faturasSemExtrato([
        fatura({ desembolsos: [] }),
        fatura({
          id: "fat-2",
          desembolsos: [desembolso("d1", 100_000)],
          extratoPath: "uid/extrato/a.pdf",
        }),
      ]),
    ).toBeNull();
  });

  /**
   * O valor exibido é **dinheiro já saído sem apoio hábil que fixe o ano** — a
   * soma dos desembolsos das faturas nesta condição, e só delas. A fatura com
   * extrato e a fatura sem pagamento não entram na conta.
   */
  it("soma só o desembolsado das faturas SEM extrato, e aponta para ela quando é uma", () => {
    const agregado = faturasSemExtrato([
      fatura({ id: "fat-1", desembolsos: [desembolso("d1", 123_400)] }),
      // com extrato: fora da conta
      fatura({
        id: "fat-2",
        desembolsos: [desembolso("d2", 900_000)],
        extratoPath: "uid/extrato/a.pdf",
      }),
      // sem desembolso: fora da conta
      fatura({ id: "fat-3", desembolsos: [] }),
    ]);
    expect(agregado).toEqual({
      quantidade: 1,
      totalCentavos: 123_400,
      href: "/fatura/fat-1",
    });
  });

  /**
   * ⚠️ **Sem CTA com mais de uma**, e o corte é o precedente literal de
   * `documentos_sem_arquivo` (decisão do `po` em 2026-09-19): não existe lista de
   * faturas no app, e criar uma é fricção de processo, não obrigação fiscal.
   */
  it("com mais de uma, o card fica informativo — href null", () => {
    const agregado = faturasSemExtrato([
      fatura({ id: "fat-1", desembolsos: [desembolso("d1", 100_000)] }),
      fatura({
        id: "fat-2",
        desembolsos: [desembolso("d2", 50_000), desembolso("d3", 25_000)],
      }),
    ]);
    expect(agregado).toEqual({
      quantidade: 2,
      totalCentavos: 175_000,
      href: null,
    });
  });
});

describe("a cor e o escopo do veto — adjudicação do contador, não do código", () => {
  /** ADENDO 2, "Veredito": vermelho, mesma classe de `documentosSemArquivo`. */
  it("a cor é vermelha", () => {
    expect(COR_FATURA_SEM_EXTRATO).toBe("red");
  });

  /**
   * ⚠️ **Critério 16 — o comportamento observável obrigatório.** A frase diz o
   * que o Gate Fiscal item 4 decidiu: Pagamentos Efetuados e a aferição do INSS
   * NÃO são afetados; o que fica em risco é a discriminação do ano-calendário em
   * Bens e Direitos. Este teste existe porque a frase é o oposto exato da frase
   * de veto do card irmão ("nenhuma saída anual é gerada"), e trocar uma pela
   * outra por semelhança visual é o erro que o ticket nomeia.
   */
  it("o texto de escopo NEGA o veto das outras duas saídas anuais", () => {
    expect(FATURA_SEM_EXTRATO_NAO_VETA).toContain(
      "não trava a lista de Pagamentos Efetuados",
    );
    expect(FATURA_SEM_EXTRATO_NAO_VETA).toContain("aferição");
    expect(FATURA_SEM_EXTRATO_NAO_VETA).toContain("Bens e Direitos");
    // E não diz, em lugar nenhum, a frase do card irmão.
    expect(FATURA_SEM_EXTRATO_NAO_VETA).not.toContain(
      "nenhuma saída anual é gerada",
    );
  });
});
