import { describe, expect, it } from "vitest";

import {
  lerTextoHerdado,
  montarQueryTextoHerdado,
  type TextoHerdado,
} from "./texto-herdado";

/**
 * CONTAI-089 — o transporte de TEXTO entre a compra individual e o lote.
 *
 * O que estes testes travam, e por que cada um importa:
 *   1. **ida-e-volta**: o que sai do formulário chega igual do outro lado,
 *      inclusive com acento, máscara de CNPJ (a barra!) e vírgula decimal. Um
 *      encode errado não quebra a tela — ela só nasce com o nome errado, em
 *      silêncio, e o favorecido duplicado sai na ficha Pagamentos Efetuados;
 *   2. **vazio é vazio**: chave sem dado NÃO entra na URL e a leitura devolve
 *      `""` — o campo chega perguntando, nunca "preenchido com nada";
 *   3. **nenhum id trafega**: o conjunto de chaves é fechado em três, e nenhuma
 *      delas é id de documento (critério 7).
 */

const VAZIO: TextoHerdado = { nome: "", documento: "", valor: "" };

const ROTA_DO_LOTE = "/adicionar/compra-cartao/parcelas";

/**
 * As MESMAS três linhas do `href` de `compra-cartao/page.tsx` — e elas moram
 * aqui, e não num terceiro export do módulo, porque o critério 8 fixa que
 * `montarQueryTextoHerdado` é chamada só na tela. O `href` sem `?` pendurado é
 * asserido de verdade no E2E (`e2e/cartao-lote.spec.ts`, "sem contexto de
 * documento, o link é o de hoje").
 */
function urlDoLote(herdado: TextoHerdado): string {
  const query = new URLSearchParams(
    montarQueryTextoHerdado(herdado),
  ).toString();
  return query === "" ? ROTA_DO_LOTE : `${ROTA_DO_LOTE}?${query}`;
}

/** O que a URL de verdade faz: serializa, navega, e o outro lado lê. */
function idaEVolta(herdado: TextoHerdado): TextoHerdado {
  const url = new URL(urlDoLote(herdado), "https://contai.local");
  return lerTextoHerdado(url.searchParams);
}

describe("montarQueryTextoHerdado", () => {
  it("leva os três textos, com as chaves nomeadas", () => {
    expect(
      montarQueryTextoHerdado({
        nome: "Depósito Bom Jesus",
        documento: "11.222.333/0001-81",
        valor: "2.000,00",
      }),
    ).toEqual({
      favorecidoNome: "Depósito Bom Jesus",
      favorecidoDocumento: "11.222.333/0001-81",
      valorTotal: "2.000,00",
    });
  });

  it("omite a chave de valor vazio — e só sobra o que existe", () => {
    expect(
      montarQueryTextoHerdado({
        nome: "Depósito Bom Jesus",
        documento: "",
        valor: "",
      }),
    ).toEqual({ favorecidoNome: "Depósito Bom Jesus" });
  });

  it("espaço em branco não é dado: some junto com o vazio", () => {
    expect(
      montarQueryTextoHerdado({ nome: "   ", documento: "\t", valor: " " }),
    ).toEqual({});
  });

  it("nota sem saldo sugerível não manda valorTotal nenhum", () => {
    // `sugerirValorDaNota` devolveu `null` — nota sem valor, não hábil, já
    // coberta por inteiro, ou painel que não carregou. O "Valor total" chega
    // vazio na Tela 1, perguntando (critério 9).
    const query = montarQueryTextoHerdado({
      nome: "Ilhamix Concreto",
      documento: "11.222.333/0001-81",
      valor: "",
    });
    expect(query).not.toHaveProperty("valorTotal");
  });

  it("⛔ nenhuma chave de id de documento, em caso nenhum", () => {
    const chaves = Object.keys(
      montarQueryTextoHerdado({
        nome: "Depósito Bom Jesus",
        documento: "11.222.333/0001-81",
        valor: "950,00",
      }),
    );
    // O conjunto é FECHADO em três, e nenhuma delas nomeia documento de
    // origem: `favorecidoDocumento` é o CNPJ/CPF de quem recebeu, não a nota.
    expect(chaves).toEqual([
      "favorecidoNome",
      "favorecidoDocumento",
      "valorTotal",
    ]);
    expect(chaves).not.toContain("documento");
    expect(chaves.some((c) => /origem/i.test(c))).toBe(false);
  });
});

describe("lerTextoHerdado", () => {
  it("parâmetro ausente vira string vazia, nunca null nem undefined", () => {
    expect(lerTextoHerdado(new URLSearchParams(""))).toEqual(VAZIO);
  });

  it("ignora qualquer outro parâmetro da URL — inclusive `documento`", () => {
    // ⚠️ A trava do critério 7 do lado da LEITURA: ainda que alguém pendure um
    // `?documento=` nesta rota à mão, nada deste módulo o enxerga.
    const lido = lerTextoHerdado(
      new URLSearchParams("documento=abc-123&favorecidoNome=WK%20Obras"),
    );
    expect(lido).toEqual({ nome: "WK Obras", documento: "", valor: "" });
  });
});

describe("ida-e-volta pela URL", () => {
  it("acento, máscara de CNPJ e vírgula decimal voltam idênticos", () => {
    const original: TextoHerdado = {
      nome: "Construções São José & Cia Ltda",
      documento: "11.222.333/0001-81",
      valor: "12.345,67",
    };
    expect(idaEVolta(original)).toEqual(original);
  });

  it("CPF formatado de prestador PF volta idêntico", () => {
    const original: TextoHerdado = {
      nome: "José da Silva",
      documento: "529.982.247-25",
      valor: "1.500,00",
    };
    expect(idaEVolta(original)).toEqual(original);
  });

  it("sem nada herdado, a URL é a de hoje — sem `?` pendurado", () => {
    expect(urlDoLote(VAZIO)).toBe("/adicionar/compra-cartao/parcelas");
    expect(idaEVolta(VAZIO)).toEqual(VAZIO);
  });

  it("só o valor herdado: nome e CNPJ/CPF continuam vazios do outro lado", () => {
    const original: TextoHerdado = {
      nome: "",
      documento: "",
      valor: "2.000,00",
    };
    expect(urlDoLote(original)).toBe(
      "/adicionar/compra-cartao/parcelas?valorTotal=2.000%2C00",
    );
    expect(idaEVolta(original)).toEqual(original);
  });

  it("a URL montada não carrega o id do documento de origem", () => {
    const url = urlDoLote({
      nome: "Depósito Bom Jesus",
      documento: "11.222.333/0001-81",
      valor: "950,00",
    });
    expect(url).not.toContain("documento=");
    expect(url).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });
});
