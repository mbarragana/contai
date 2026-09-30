import { describe, expect, it } from "vitest";

import { FILTROS_DA_AGENDA_PADRAO, filtrarAgenda } from "./filtro-agenda";
import type { Compromisso } from "@/lib/types";

/**
 * CONTAI-082. O que estes testes travam é o RECORTE: cada urgência isolada, a
 * busca sem diacrítico, os dois compondo por E lógico e o compromisso sem
 * favorecido — mais a promessa de que o filtro não reordena nada (a lista longa
 * do relato ficaria pior, não melhor, se a ordem mudasse a cada tecla).
 *
 * `HOJE` é fixo: a urgência é lida de `chipDoAgendado`, e um teste que
 * derivasse `new Date()` por conta própria falharia de madrugada, no fuso
 * errado, por motivo nenhum.
 */

const HOJE = "2026-09-30";

function comp(over: Partial<Compromisso> & { id: string }): Compromisso {
  return {
    obraId: "obra-1",
    favorecidoId: "fav-wk",
    favorecidoNome: "WK Construções LTDA",
    valorPrevistoCentavos: 1_000_000,
    dataPrevista: "2026-10-28",
    origem: "boleto",
    documentoOrigemId: null,
    documentoPrevistoIds: [],
    origemDesfeitaId: null,
    origemDesfeitaEm: null,
    situacao: "aberto",
    motivoCancelamento: null,
    dataCompra: null,
    pagamentoIds: [],
    adiamentos: 0,
    ...over,
  };
}

/** Um por urgência, com favorecidos que repetem — é o caso do relato. */
const VENCIDO = comp({
  id: "c-vencido",
  dataPrevista: "2026-09-22",
  favorecidoNome: "Ilhamix Concreto LTDA",
});
const VENCE_HOJE = comp({
  id: "c-hoje",
  dataPrevista: HOJE,
  favorecidoNome: "José Peçanha",
});
const VENCE_AMANHA = comp({
  id: "c-amanha",
  dataPrevista: "2026-10-01",
  favorecidoNome: "WK Construções LTDA",
});
const COMUM = comp({
  id: "c-comum",
  dataPrevista: "2026-10-28",
  favorecidoNome: "Ilhamix Concreto LTDA",
});
/** Sem data prevista **não é vencido** (critério 21b) e sem nome não casa busca. */
const SEM_NOME = comp({
  id: "c-sem-nome",
  dataPrevista: null,
  favorecidoNome: null,
});

const LISTA = [VENCIDO, VENCE_HOJE, VENCE_AMANHA, COMUM, SEM_NOME];

const filtros = (over: Partial<typeof FILTROS_DA_AGENDA_PADRAO> = {}) => ({
  ...FILTROS_DA_AGENDA_PADRAO,
  ...over,
});

describe("padrão", () => {
  it("todos + busca vazia devolve a lista inteira, na mesma ordem", () => {
    expect(filtrarAgenda(LISTA, FILTROS_DA_AGENDA_PADRAO, HOJE)).toEqual(LISTA);
  });

  it("não devolve o MESMO array (a tela não deve poder mutar a fonte)", () => {
    expect(filtrarAgenda(LISTA, FILTROS_DA_AGENDA_PADRAO, HOJE)).not.toBe(LISTA);
  });

  it("espaço em branco na busca não filtra nada", () => {
    expect(filtrarAgenda(LISTA, filtros({ buscaFavorecido: "   " }), HOJE)).toEqual(
      LISTA,
    );
  });
});

describe("cada urgência isolada", () => {
  it("vencido — só o que passou da data, sem teto", () => {
    expect(filtrarAgenda(LISTA, filtros({ filtroUrgencia: "vencido" }), HOJE)).toEqual(
      [VENCIDO],
    );
  });

  it("vence hoje", () => {
    expect(
      filtrarAgenda(LISTA, filtros({ filtroUrgencia: "vence_hoje" }), HOJE),
    ).toEqual([VENCE_HOJE]);
  });

  it("vence amanhã", () => {
    expect(
      filtrarAgenda(LISTA, filtros({ filtroUrgencia: "vence_amanha" }), HOJE),
    ).toEqual([VENCE_AMANHA]);
  });

  it("comum — e o sem data prevista entra AQUI, não em vencido", () => {
    expect(filtrarAgenda(LISTA, filtros({ filtroUrgencia: "comum" }), HOJE)).toEqual([
      COMUM,
      SEM_NOME,
    ]);
  });

  it("as quatro urgências particionam a lista, sem sobra e sem repetição", () => {
    const partes = (["vencido", "vence_hoje", "vence_amanha", "comum"] as const).flatMap(
      (u) => filtrarAgenda(LISTA, filtros({ filtroUrgencia: u }), HOJE),
    );
    expect(partes).toHaveLength(LISTA.length);
    expect(new Set(partes.map((c) => c.id)).size).toBe(LISTA.length);
  });

  it("⚠️ a urgência é recalculada do `hoje` recebido, nunca de um rótulo fixo", () => {
    // Amanhã, o "vence hoje" de hoje já é vencido — sem nenhuma mudança de dado.
    expect(
      filtrarAgenda(LISTA, filtros({ filtroUrgencia: "vencido" }), "2026-10-01"),
    ).toEqual([VENCIDO, VENCE_HOJE]);
  });
});

describe("busca por favorecido", () => {
  it("casa por substring, sem caixa", () => {
    for (const termo of ["ilhamix", "ILHAMIX", "Concreto"]) {
      expect(
        filtrarAgenda(LISTA, filtros({ buscaFavorecido: termo }), HOJE),
        termo,
      ).toEqual([VENCIDO, COMUM]);
    }
  });

  it("casa sem diacrítico nos DOIS sentidos", () => {
    expect(
      filtrarAgenda(LISTA, filtros({ buscaFavorecido: "jose pecanha" }), HOJE),
    ).toEqual([VENCE_HOJE]);
    expect(filtrarAgenda(LISTA, filtros({ buscaFavorecido: "José" }), HOJE)).toEqual([
      VENCE_HOJE,
    ]);
    expect(
      filtrarAgenda(LISTA, filtros({ buscaFavorecido: "construcoes" }), HOJE),
    ).toEqual([VENCE_AMANHA]);
  });

  it("favorecidoNome === null não casa com nada", () => {
    // Nem com o rótulo que a tela imprime no lugar do nome.
    expect(filtrarAgenda(LISTA, filtros({ buscaFavorecido: "favorecido" }), HOJE)).toEqual(
      [],
    );
    expect(filtrarAgenda(LISTA, filtros({ buscaFavorecido: "informado" }), HOJE)).toEqual(
      [],
    );
  });

  it("termo sem correspondência devolve vazio (é o vazio-por-filtro da tela)", () => {
    expect(filtrarAgenda(LISTA, filtros({ buscaFavorecido: "zzz" }), HOJE)).toEqual([]);
  });
});

describe("combinação — E lógico (critério 5)", () => {
  it("os dois ativos mostram só o que bate nos DOIS", () => {
    expect(
      filtrarAgenda(
        LISTA,
        { filtroUrgencia: "comum", buscaFavorecido: "ilhamix" },
        HOJE,
      ),
    ).toEqual([COMUM]);
  });

  it("interseção vazia devolve vazio, mesmo com cada critério casando sozinho", () => {
    // "vencido" casa (VENCIDO) e "wk" casa (VENCE_AMANHA) — juntos, ninguém.
    expect(
      filtrarAgenda(LISTA, { filtroUrgencia: "vencido", buscaFavorecido: "wk" }, HOJE),
    ).toEqual([]);
  });

  it("limpar UM reaplica o outro sozinho, nunca reseta os dois", () => {
    const soBusca = filtrarAgenda(
      LISTA,
      { filtroUrgencia: "todos", buscaFavorecido: "ilhamix" },
      HOJE,
    );
    expect(soBusca).toEqual([VENCIDO, COMUM]);

    const soUrgencia = filtrarAgenda(
      LISTA,
      { filtroUrgencia: "comum", buscaFavorecido: "" },
      HOJE,
    );
    expect(soUrgencia).toEqual([COMUM, SEM_NOME]);
  });
});

describe("o que este filtro NÃO decide", () => {
  it("não filtra por situação — quitado e cancelado saem em `montarAgendaDaHome`", () => {
    // Critério 6: o filtro reduz a ENTRADA; quem sabe o que é agenda é a função
    // fiscal, e duplicar a regra de situação aqui criaria duas fontes dela.
    const quitado = comp({ id: "c-quitado", situacao: "quitado" });
    expect(
      filtrarAgenda([quitado], FILTROS_DA_AGENDA_PADRAO, HOJE).map((c) => c.id),
    ).toEqual(["c-quitado"]);
  });
});
