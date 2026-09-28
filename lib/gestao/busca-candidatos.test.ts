import { describe, expect, it } from "vitest";

import { filtrarCandidatos } from "./busca-candidatos";

/**
 * CONTAI-078. O que estes testes travam é o ÍNDICE (favorecido normalizado,
 * valor por dígitos, número da nota) e a promessa de que o filtro não reordena
 * nada — a lista longa do relato ficaria pior, não melhor, se a ordem mudasse a
 * cada tecla.
 */

interface Item {
  favorecidoNome?: string | null;
  valorCentavos?: number | null;
  numero?: string | null;
}

/** O candidato real carrega mais campos; aqui só o que a busca lê. */
const cand = (item: Item, marca = "") => ({ item, marca });

const ILHAMIX = cand({ favorecidoNome: "Ilhamix Concreto LTDA", valorCentavos: 1624000 }, "a");
const JOSE = cand({ favorecidoNome: "José Peçanha", valorCentavos: 70000 }, "b");
const WK = cand({ favorecidoNome: "WK Construções LTDA", valorCentavos: 300000 }, "c");
const SEM_NOME = cand({ favorecidoNome: null, valorCentavos: 50 }, "d");

const LISTA = [ILHAMIX, JOSE, WK, SEM_NOME];

describe("termo vazio", () => {
  it("devolve a lista inteira, na mesma ordem", () => {
    expect(filtrarCandidatos(LISTA, "")).toEqual(LISTA);
    expect(filtrarCandidatos(LISTA, "   ")).toEqual(LISTA);
  });

  it("não devolve o MESMO array (a tela não deve poder mutar a fonte)", () => {
    expect(filtrarCandidatos(LISTA, "")).not.toBe(LISTA);
  });
});

describe("favorecido", () => {
  it("casa por substring, sem caixa", () => {
    expect(filtrarCandidatos(LISTA, "ilhamix")).toEqual([ILHAMIX]);
    expect(filtrarCandidatos(LISTA, "ILHAMIX")).toEqual([ILHAMIX]);
    expect(filtrarCandidatos(LISTA, "concreto")).toEqual([ILHAMIX]);
  });

  it("casa sem diacrítico nos DOIS sentidos", () => {
    // O que o Mateus digita no celular, sem acento, tem de achar o nome com acento.
    expect(filtrarCandidatos(LISTA, "jose pecanha")).toEqual([JOSE]);
    expect(filtrarCandidatos(LISTA, "José")).toEqual([JOSE]);
    expect(filtrarCandidatos(LISTA, "construcoes")).toEqual([WK]);
  });

  it("favorecido ausente não casa com nada", () => {
    // "Favorecido não informado" é rótulo de TELA, não dado do registro.
    expect(filtrarCandidatos(LISTA, "favorecido")).toEqual([]);
    expect(filtrarCandidatos(LISTA, "informado")).toEqual([]);
  });

  it("termo sem correspondência devolve vazio (é o estado vazio-por-filtro)", () => {
    expect(filtrarCandidatos(LISTA, "zzz")).toEqual([]);
  });
});

describe("valor por dígitos", () => {
  it("acha R$ 16.240,00 pelas duas formas que o Mateus digita", () => {
    expect(filtrarCandidatos(LISTA, "16240")).toEqual([ILHAMIX]);
    expect(filtrarCandidatos(LISTA, "16.240,00")).toEqual([ILHAMIX]);
    expect(filtrarCandidatos(LISTA, "R$ 16.240,00")).toEqual([ILHAMIX]);
  });

  it("os centavos entram no índice com as duas casas", () => {
    // 50 centavos são "0,50" na tela — sem padding, "050" não acharia nada.
    expect(filtrarCandidatos(LISTA, "0,50")).toEqual([SEM_NOME]);
    expect(filtrarCandidatos(LISTA, "50")).toEqual([SEM_NOME]);
  });

  it("é substring, não igualdade: um pedaço do valor também acha", () => {
    expect(filtrarCandidatos(LISTA, "3000")).toEqual([WK]);
    expect(filtrarCandidatos(LISTA, "700")).toEqual([JOSE]);
  });

  it("valor ausente (nota hábil sem valor) não explode nem casa por dígito", () => {
    const semValor = cand({ favorecidoNome: "Depósito Sul", valorCentavos: null });
    expect(filtrarCandidatos([semValor], "100")).toEqual([]);
    expect(filtrarCandidatos([semValor], "deposito")).toEqual([semValor]);
  });
});

describe("número da nota (só o candidato documento tem)", () => {
  const notaA = cand({ favorecidoNome: "WK", valorCentavos: 300000, numero: "1042" });
  const notaB = cand({ favorecidoNome: "WK", valorCentavos: 300000, numero: "9901" });
  const notas = [notaA, notaB];

  it("acha pelo número impresso, inteiro ou em pedaço", () => {
    expect(filtrarCandidatos(notas, "1042")).toEqual([notaA]);
    expect(filtrarCandidatos(notas, "990")).toEqual([notaB]);
  });

  it("número com pontuação digitada continua achando", () => {
    expect(filtrarCandidatos(notas, "1.042")).toEqual([notaA]);
  });

  it("número com letra casa pelo texto", () => {
    const serie = cand({ favorecidoNome: "WK", valorCentavos: 100, numero: "A-77" });
    expect(filtrarCandidatos([serie], "a-77")).toEqual([serie]);
  });

  it("candidato pagamento não tem número — e não inventa um", () => {
    expect(filtrarCandidatos(LISTA, "1042")).toEqual([]);
  });
});

describe("a ordenação de entrada é preservada (critério 6)", () => {
  it("o subconjunto sai na ordem em que entrou, não por relevância", () => {
    const lista = [WK, ILHAMIX, JOSE];
    // Todos casam por "ltda"? Não — dois deles. E a ordem é a da entrada.
    expect(filtrarCandidatos(lista, "ltda")).toEqual([WK, ILHAMIX]);
    expect(filtrarCandidatos([ILHAMIX, WK], "ltda")).toEqual([ILHAMIX, WK]);
  });
});
