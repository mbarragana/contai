import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CABECALHO_AGENDA_COMPROMISSOS,
  compromissosElegiveisParaQuitacao,
  compromissosQueBloqueiam,
  decidirRegistro,
  ehVencidoSemResposta,
  exportarAgendaCompromissos,
  perguntaQuitacao,
  podeGerarRelatorioAnual,
  podeQuitar,
  QUITACAO_CONSEQUENCIA_DO_NAO,
  QUITACAO_NAO,
  QUITACAO_SIM,
  RECUSA_CARTAO,
  saldoDoCompromisso,
} from "@/lib/fiscal/compromisso";
import type { Compromisso, CompromissoRow, Pagamento } from "@/lib/types";

const OBRA = "obra-1";
const HOJE = "2026-08-18";

function comp(over: Partial<Compromisso> & { id: string }): Compromisso {
  return {
    obraId: OBRA,
    favorecidoId: "fav-wk",
    favorecidoNome: "WK Construções LTDA",
    valorPrevistoCentavos: 1_000_000, // R$ 10.000,00
    dataPrevista: "2026-09-15",
    origem: "boleto",
    documentoOrigemId: null,
    situacao: "aberto",
    motivoCancelamento: null,
    dataCompra: null,
    pagamentoIds: [],
    adiamentos: 0,
    ...over,
  };
}

function pag(over: Partial<Pagamento> & { id: string }): Pagamento {
  return {
    obraId: OBRA,
    valorCentavos: 1_000_000,
    dataPagamento: "2026-09-17",
    meio: "pix",
    status: "aguardando_nf",
    favorecidoId: "fav-wk",
    favorecidoNome: "WK Construções LTDA",
    favorecidoTipo: "pj",
    comprovantePath: "u/comprovante/pix.png",
    encargosCentavos: 0,
    naoExplicadoCentavos: 0,
    resolucaoDiferenca: null,
    documentoIds: [],
    ...over,
  };
}

// ══ O modelo (critérios 1 e 2) ══════════════════════════════════════════

describe("o modelo: compromisso não tem data de pagamento (critério 1)", () => {
  /**
   * PROVA DE TIPO, avaliada pelo `tsc` e não por este `expect`. Se alguém
   * acrescentar `data_pagamento` a `compromisso` numa migration futura e
   * regerar `lib/database.types.ts`, este alias vira `never` e o typecheck
   * quebra com o nome do arquivo — antes de qualquer teste rodar.
   *
   * A ausência da coluna é o que impede a regra de virar "todo cálculo lembra
   * de filtrar nulo" (parecer §2), que é o defeito do `status` com outro rosto.
   */
  type SemDataDePagamento = "data_pagamento" extends keyof CompromissoRow
    ? never
    : true;
  const provaDeTipo: SemDataDePagamento = true;

  it("a prova de tipo compila e a coluna não existe no schema gerado", () => {
    expect(provaDeTipo).toBe(true);
  });

  it("nenhuma migration cria uma coluna de data de pagamento em compromisso", () => {
    // Inspeção de schema pela FONTE (o SQL versionado). A inspeção do banco
    // vivo, por `information_schema`, é do E2E — as duas existem porque uma
    // pega o que foi escrito e a outra pega o que está aplicado.
    const sql = readFileSync("supabase/migrations/0007_compromisso.sql", "utf-8");
    // Comentários fora: a própria migration EXPLICA por escrito por que
    // `data_pagamento` não está lá, e a explicação não pode reprovar o teste.
    // O que interessa aqui é a DECLARAÇÃO de coluna.
    const semComentarios = sql
      .split("\n")
      .filter((linha) => !linha.trimStart().startsWith("--"))
      .join("\n");
    const corpo = semComentarios.slice(
      semComentarios.indexOf("create table compromisso ("),
      semComentarios.indexOf("create table compromisso_pagamento ("),
    );
    expect(corpo).not.toContain("data_pagamento");
    expect(corpo).toContain("valor_previsto"); // nunca "valor" (Gate Fiscal 6.3)
  });

  it("`pagamento` não ganhou coluna nova (critério 2)", () => {
    const sql = readFileSync("supabase/migrations/0007_compromisso.sql", "utf-8");
    expect(sql).not.toMatch(/alter table pagamento\b/);
  });
});

// ══ O branch do registro (critérios 4, 5, 6, 25, 27) ════════════════════

describe("decidirRegistro — a DATA é o controle, menos no cartão", () => {
  it("data no passado grava pagamento", () => {
    expect(decidirRegistro({ meio: "pix", data: "2026-08-05" }, HOJE)).toEqual({
      tipo: "pagamento",
    });
  });

  it("hoje ainda é pagamento — o dinheiro já saiu", () => {
    expect(decidirRegistro({ meio: "pix", data: HOJE }, HOJE)).toEqual({
      tipo: "pagamento",
    });
  });

  it("amanhã é compromisso, não pagamento (critério 6)", () => {
    expect(decidirRegistro({ meio: "pix", data: "2026-08-19" }, HOJE)).toEqual({
      tipo: "compromisso",
    });
    expect(decidirRegistro({ meio: "boleto", data: "2026-09-15" }, HOJE)).toEqual({
      tipo: "compromisso",
    });
  });

  it("⚠️ EXCEÇÃO NOMEADA: compra de ONTEM no cartão NÃO vira pagamento (crit. 27)", () => {
    // Adendo §B(c): "a data da compra é passada e mesmo assim não há
    // pagamento. O que decide o branch é 'a fatura que contém esta compra já
    // foi paga?' — nunca a data da compra." No instante da compra não houve
    // desembolso do declarante: falha a condição 1 do parecer de 17/08 §1.
    const ontem = "2026-08-17";
    const destino = decidirRegistro({ meio: "cartao", data: ontem }, HOJE);
    expect(
      destino.tipo,
      "cartão decidido por `data <= hoje` jogaria o custo no mês (e no ano) errado em silêncio",
    ).toBe("recusado");
  });

  it("cartão é recusado em qualquer data, e a recusa diz por quê (critério 25)", () => {
    for (const data of ["2020-01-01", HOJE, "2027-12-31"]) {
      const destino = decidirRegistro({ meio: "cartao", data }, HOJE);
      expect(destino).toEqual({ tipo: "recusado", motivo: RECUSA_CARTAO });
    }
    expect(RECUSA_CARTAO).toBe(
      "compra no cartão ainda não tem fluxo neste app — o custo é do ano em que a fatura for paga",
    );
  });
});

// ══ Vencido sem resposta e o bloqueio anual (20, 21, 21b, 21c) ══════════

describe("vencido sem resposta", () => {
  it("aberto com data passada é vencido", () => {
    expect(ehVencidoSemResposta(comp({ id: "c1", dataPrevista: "2026-08-10" }), HOJE)).toBe(
      true,
    );
  });

  it("⚠️ nunca expira sozinho: 90 dias atrás continua vencido (critério 20)", () => {
    // Parecer §3: sumiço silencioso "devolve o compromisso para a cabeça dele,
    // que é a falha da meta 1 pelo lado de fora".
    const noventaDiasAtras = "2026-05-20";
    const c = comp({ id: "c1", dataPrevista: noventaDiasAtras });
    expect(ehVencidoSemResposta(c, HOJE)).toBe(true);
    expect(compromissosQueBloqueiam([c], HOJE)).toHaveLength(1);
  });

  it("data prevista no futuro não é vencido e não bloqueia (critério 21b)", () => {
    const c = comp({ id: "c1", dataPrevista: "2026-09-15" });
    expect(ehVencidoSemResposta(c, HOJE)).toBe(false);
    expect(podeGerarRelatorioAnual([c], HOJE, 2026)).toEqual({ ok: true });
  });

  it("hoje ainda não venceu — venceu é ONTEM", () => {
    expect(ehVencidoSemResposta(comp({ id: "c1", dataPrevista: HOJE }), HOJE)).toBe(false);
  });

  it("⚠️ SEM DATA DEFINIDA não é vencido e não bloqueia (critério 21b)", () => {
    // Adendo §A, corolário 3: incerteza DECLARADA não é silêncio. Estado
    // alcançável só pelo saldo de uma quitação parcial, nunca na criação.
    const c = comp({ id: "c1", dataPrevista: null });
    expect(ehVencidoSemResposta(c, HOJE)).toBe(false);
    expect(podeGerarRelatorioAnual([c], HOJE, 2026)).toEqual({ ok: true });
  });

  it("cancelado e quitado não bloqueiam — são as respostas (critério 21c)", () => {
    const vencido = { dataPrevista: "2026-08-10" };
    const cancelado = comp({
      id: "c1",
      ...vencido,
      situacao: "cancelado",
      motivoCancelamento: "obra parou",
    });
    const quitado = comp({ id: "c2", ...vencido, situacao: "quitado" });
    expect(podeGerarRelatorioAnual([cancelado, quitado], HOJE, 2026)).toEqual({
      ok: true,
    });
  });
});

describe("⚠️ bloqueio anual — o `ano` NÃO recorta nada (critério 21, adendo §A)", () => {
  // O caso real do adendo §A: previsto para 28/12/2025, pago de fato em
  // 05/01/2026. Enquanto está sem resposta, NINGUÉM SABE se o desembolso
  // pertence a 2025 ou a 2026 — as duas hipóteses estão vivas ao mesmo tempo.
  const vencido2025 = comp({ id: "c-2025", dataPrevista: "2025-12-28" });

  it("bloqueia o relatório do ano da data prevista", () => {
    expect(podeGerarRelatorioAnual([vencido2025], HOJE, 2025)).toEqual({
      ok: false,
      faltamResponder: [vencido2025],
    });
  });

  it("⚠️ bloqueia TAMBÉM o relatório de 2026, e é esse o ponto", () => {
    const r = podeGerarRelatorioAnual([vencido2025], HOJE, 2026);
    expect(
      r.ok,
      "recortar o bloqueio pela data prevista devolve efeito fiscal à PREVISÃO — " +
        "o relatório de 2026 sairia liberado com um desembolso possivelmente dele, " +
        "não registrado, e sem ninguém perguntar nada",
    ).toBe(false);
  });

  it("bloqueia qualquer ano, inclusive um em que nada foi previsto", () => {
    for (const ano of [2024, 2025, 2026, 2027, 2030]) {
      expect(podeGerarRelatorioAnual([vencido2025], HOJE, ano).ok).toBe(false);
    }
  });

  it("devolve a lista do que falta responder, não só o `false`", () => {
    const outro = comp({ id: "c-b", dataPrevista: "2026-07-01" });
    const emDia = comp({ id: "c-c", dataPrevista: "2026-12-01" });
    const r = podeGerarRelatorioAnual([vencido2025, outro, emDia], HOJE, 2026);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.faltamResponder.map((c) => c.id).sort()).toEqual(["c-2025", "c-b"]);
  });

  it("sem compromisso nenhum, o relatório gera", () => {
    expect(podeGerarRelatorioAnual([], HOJE, 2026)).toEqual({ ok: true });
  });
});

// ══ Saldo (critérios 15, 29 e 30) ═══════════════════════════════════════

describe("saldo do compromisso", () => {
  it("um compromisso quitado por N pagamentos mostra o que falta (critério 15)", () => {
    const c = comp({
      id: "c1",
      valorPrevistoCentavos: 1_000_000,
      pagamentoIds: ["p1", "p2"],
    });
    const pagamentos = [
      pag({ id: "p1", valorCentavos: 400_000 }),
      pag({ id: "p2", valorCentavos: 350_000 }),
      pag({ id: "p3", valorCentavos: 900_000 }), // de outro compromisso
    ];
    expect(saldoDoCompromisso(c, pagamentos)).toBe(250_000);
  });

  it("pagou a mais (encargos): o saldo é zero, nunca negativo", () => {
    const c = comp({ id: "c1", valorPrevistoCentavos: 1_000_000, pagamentoIds: ["p1"] });
    expect(saldoDoCompromisso(c, [pag({ id: "p1", valorCentavos: 1_032_000 })])).toBe(0);
  });
});

// ══ Exportação (critério 23) ════════════════════════════════════════════

describe("exportação em arquivo separado", () => {
  it("a 1ª linha é o cabeçalho LITERAL do Gate Fiscal 6.5", () => {
    const csv = exportarAgendaCompromissos([comp({ id: "c1" })]);
    expect(csv.split("\n")[0]).toBe(
      "AGENDA DE COMPROMISSOS — VALORES PREVISTOS, NÃO EXECUTADOS. NÃO COMPÕEM CUSTO DE AQUISIÇÃO.",
    );
    expect(csv.split("\n")[0]).toBe(CABECALHO_AGENDA_COMPROMISSOS);
  });

  it("a coluna se chama 'valor previsto', nunca 'valor' (Gate Fiscal 6.3)", () => {
    const cabecalhoColunas = exportarAgendaCompromissos([]).split("\n")[1];
    expect(cabecalhoColunas).toContain("valor previsto");
    expect(cabecalhoColunas.split(";")).not.toContain("valor");
  });

  it("nem o arquivo vazio perde o cabeçalho", () => {
    expect(exportarAgendaCompromissos([]).split("\n")[0]).toBe(
      CABECALHO_AGENDA_COMPROMISSOS,
    );
  });

  it("cancelado NÃO some do arquivo: a situação vai numa coluna", () => {
    const csv = exportarAgendaCompromissos([
      comp({
        id: "c1",
        situacao: "cancelado",
        motivoCancelamento: "compra desistida",
      }),
    ]);
    expect(csv).toContain("Cancelado");
    expect(csv).toContain("compra desistida");
  });

  it("sem data definida sai por extenso e vai para o fim da lista", () => {
    const csv = exportarAgendaCompromissos([
      comp({ id: "c-sem", dataPrevista: null }),
      comp({ id: "c-com", dataPrevista: "2026-09-15" }),
    ]);
    const linhas = csv.split("\n");
    expect(linhas[2]).toContain("15/09/2026");
    expect(linhas[3]).toContain("sem data definida");
  });
});

// ══ Sugestão de quitação (critérios 35-41, adendo §C) ═══════════════════

describe("sugestão de quitação — gatilho cumulativo", () => {
  const base = comp({
    id: "c1",
    valorPrevistoCentavos: 1_000_000, // R$ 10.000,00
    dataPrevista: "2026-09-15",
  });

  const elegiveis = (
    pagamento: Pagamento,
    cs: Compromisso[] = [base],
    recusas: { pagamentoId: string; compromissoId: string }[] = [],
  ) => compromissosElegiveisParaQuitacao(pagamento, cs, recusas).map((c) => c.id);

  it("as três condições juntas disparam a sugestão", () => {
    expect(elegiveis(pag({ id: "p1" }))).toEqual(["c1"]);
  });

  it("⚠️ favorecido DIFERENTE não dispara — proibido casar por nome", () => {
    // Adendo §C(a)(1): "CNPJ errado não é typo, é outro favorecido". O nome
    // aqui é IDÊNTICO de propósito: se o casamento fosse por nome, passaria.
    const outro = pag({ id: "p1", favorecidoId: "fav-outro" });
    expect(outro.favorecidoNome).toBe(base.favorecidoNome);
    expect(elegiveis(outro)).toEqual([]);
  });

  it("pagamento sem favorecido identificado não casa com nada", () => {
    expect(elegiveis(pag({ id: "p1", favorecidoId: null }))).toEqual([]);
    expect(
      elegiveis(pag({ id: "p1", favorecidoId: null }), [
        comp({ id: "c1", favorecidoId: null }),
      ]),
    ).toEqual([]);
  });

  describe("faixa de valor: 20% do previsto ou R$ 500,00, o que for maior", () => {
    it("previsto alto: o limite é o percentual — R$ 2.000,00 sobre R$ 10.000,00", () => {
      expect(elegiveis(pag({ id: "p1", valorCentavos: 1_200_000 }))).toEqual(["c1"]);
      expect(elegiveis(pag({ id: "p1", valorCentavos: 1_200_001 }))).toEqual([]);
      expect(elegiveis(pag({ id: "p1", valorCentavos: 800_000 }))).toEqual(["c1"]);
      expect(elegiveis(pag({ id: "p1", valorCentavos: 799_999 }))).toEqual([]);
    });

    it("previsto baixo: o piso de R$ 500,00 vence o percentual", () => {
      // 20% de R$ 1.000,00 = R$ 200,00 < R$ 500,00 → o limite é R$ 500,00.
      const pequeno = [comp({ id: "c1", valorPrevistoCentavos: 100_000 })];
      expect(elegiveis(pag({ id: "p1", valorCentavos: 150_000 }), pequeno)).toEqual([
        "c1",
      ]);
      expect(elegiveis(pag({ id: "p1", valorCentavos: 150_001 }), pequeno)).toEqual([]);
      expect(elegiveis(pag({ id: "p1", valorCentavos: 50_000 }), pequeno)).toEqual(["c1"]);
      expect(elegiveis(pag({ id: "p1", valorCentavos: 49_999 }), pequeno)).toEqual([]);
    });
  });

  describe("janela de datas: 30 dias antes, 60 dias depois", () => {
    it("30 dias antes entra; 31 não", () => {
      expect(elegiveis(pag({ id: "p1", dataPagamento: "2026-08-16" }))).toEqual(["c1"]);
      expect(elegiveis(pag({ id: "p1", dataPagamento: "2026-08-15" }))).toEqual([]);
    });

    it("60 dias depois entra; 61 não", () => {
      expect(elegiveis(pag({ id: "p1", dataPagamento: "2026-11-14" }))).toEqual(["c1"]);
      expect(elegiveis(pag({ id: "p1", dataPagamento: "2026-11-15" }))).toEqual([]);
    });

    it("⚠️ o par 28/12 → 05/01 dispara: a janela NÃO recorta por ano", () => {
      // Adendo §C(a)(3): é exatamente onde a duplicidade custa mais caro —
      // custo no ano errado.
      const virada = [comp({ id: "c1", dataPrevista: "2025-12-28" })];
      const pagamento = pag({ id: "p1", dataPagamento: "2026-01-05" });
      expect(elegiveis(pagamento, virada)).toEqual(["c1"]);
    });
  });

  it("⚠️ vários elegíveis → LISTA TODOS, nunca escolhe o mais próximo (crit. 36)", () => {
    // Escolher é heurística decidindo vínculo (§5.5 do parecer de 17/08):
    // vínculo inferido errado infla custo em silêncio E mata o alerta.
    const cs = [
      comp({ id: "c-longe", dataPrevista: "2026-09-01" }),
      comp({ id: "c-perto", dataPrevista: "2026-09-16" }),
      comp({ id: "c-meio", dataPrevista: "2026-09-10" }),
    ];
    const ids = elegiveis(pag({ id: "p1", dataPagamento: "2026-09-17" }), cs);
    expect(ids).toHaveLength(3);
    expect(ids).toEqual(["c-longe", "c-meio", "c-perto"]); // ordem estável, não ranking
  });

  it("quitado e cancelado não são elegíveis", () => {
    expect(elegiveis(pag({ id: "p1" }), [comp({ id: "c1", situacao: "quitado" })])).toEqual(
      [],
    );
    expect(
      elegiveis(pag({ id: "p1" }), [
        comp({ id: "c1", situacao: "cancelado", motivoCancelamento: "x" }),
      ]),
    ).toEqual([]);
  });

  it("sem data prevista não é elegível — não há janela a comparar", () => {
    expect(elegiveis(pag({ id: "p1" }), [comp({ id: "c1", dataPrevista: null })])).toEqual(
      [],
    );
  });

  it("o par já recusado não repergunta, e os outros pares seguem livres (crit. 39)", () => {
    const cs = [
      comp({ id: "c1", dataPrevista: "2026-09-15" }),
      comp({ id: "c2", dataPrevista: "2026-09-16" }),
    ];
    expect(
      elegiveis(pag({ id: "p1" }), cs, [{ pagamentoId: "p1", compromissoId: "c1" }]),
    ).toEqual(["c2"]);
    // A recusa é POR PAR: outro pagamento continua sendo perguntado sobre c1.
    expect(
      elegiveis(pag({ id: "p9" }), cs, [{ pagamentoId: "p1", compromissoId: "c1" }]),
    ).toEqual(["c1", "c2"]);
  });

  it("obra diferente não é sugerida — nada soma entre matrículas", () => {
    expect(elegiveis(pag({ id: "p1" }), [comp({ id: "c1", obraId: "obra-2" })])).toEqual(
      [],
    );
    expect(podeQuitar({ obraId: "obra-2" }, { obraId: OBRA }).ok).toBe(false);
    expect(podeQuitar({ obraId: OBRA }, { obraId: OBRA }).ok).toBe(true);
  });

  it("⚠️ nenhuma função deste módulo cria vínculo (critério 41)", () => {
    // A sugestão devolve uma LISTA. O compromisso continua aberto, sem
    // pagamento ligado, e o pagamento continua sem compromisso: o vínculo só
    // nasce por ato humano, em `lib/data.ts`.
    const c = comp({ id: "c1" });
    const p = pag({ id: "p1" });
    const antes = { pagamentoIds: [...c.pagamentoIds] };
    compromissosElegiveisParaQuitacao(p, [c], []);
    expect(c.pagamentoIds).toEqual(antes.pagamentoIds);
    expect(c.situacao).toBe("aberto");
    expect(saldoDoCompromisso(c, [p])).toBe(c.valorPrevistoCentavos);
  });
});

describe("textos da sugestão — literais do adendo §C(b), critério 38", () => {
  it("a pergunta traz a data prevista, no formato do parecer", () => {
    expect(perguntaQuitacao("2026-09-15")).toBe(
      "Este pagamento quita o compromisso de 15/09?",
    );
  });

  it("os três textos são os do parecer, não reescritos", () => {
    expect(QUITACAO_SIM).toBe("Sim, quita este compromisso");
    expect(QUITACAO_NAO).toBe("Não, é outro pagamento");
    expect(QUITACAO_CONSEQUENCIA_DO_NAO).toBe(
      "Se não quitar, o compromisso continua em aberto e este pagamento fica registrado sozinho.",
    );
  });

  it("o texto nunca diz 'previsto/efetivado' nem 'regime de caixa' (critério 7)", () => {
    const tudo = [
      RECUSA_CARTAO,
      QUITACAO_SIM,
      QUITACAO_NAO,
      QUITACAO_CONSEQUENCIA_DO_NAO,
      perguntaQuitacao("2026-09-15"),
      CABECALHO_AGENDA_COMPROMISSOS,
    ].join(" ");
    expect(tudo.toLowerCase()).not.toContain("regime de caixa");
    expect(tudo.toLowerCase()).not.toContain("efetivado");
  });
});
