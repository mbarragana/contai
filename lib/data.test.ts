import { describe, expect, it } from "vitest";

import { classificarErro, mensagemDeErro } from "@/lib/data";
import { SemSessaoError } from "@/lib/supabase";

/**
 * O que o Mateus lê quando a gravação falha. Regressão encontrada no Gate 3
 * (E2E contra o Postgres local): o PostgREST devolve o erro como objeto
 * simples, não como `Error` — tratar só `Error` transformava violação de RLS
 * e de constraint em "problema de rede".
 */
describe("mensagemDeErro", () => {
  it("usa a mensagem do Error", () => {
    expect(mensagemDeErro(new Error("Sessão não iniciada"))).toBe(
      "Sessão não iniciada",
    );
  });

  it("usa a mensagem do erro do PostgREST, que não é um Error", () => {
    const erroPostgrest = {
      code: "23514",
      details: null,
      hint: null,
      message:
        'new row for relation "documento" violates check constraint "documento_quarentena_coerente"',
    };
    expect(mensagemDeErro(erroPostgrest)).toContain(
      "documento_quarentena_coerente",
    );
  });

  it("cai no genérico quando não há mensagem aproveitável", () => {
    const generico = "Não foi possível falar com o servidor. Tente de novo.";
    expect(mensagemDeErro(null)).toBe(generico);
    expect(mensagemDeErro({ code: "PGRST000" })).toBe(generico);
    expect(mensagemDeErro({ message: "   " })).toBe(generico);
    expect(mensagemDeErro(new Error(""))).toBe(generico);
  });
});

/**
 * Critério 5 do CONTAI-002. A distinção é pelo TIPO do erro e não pelo texto:
 * farejar string de mensagem faria "sem sessão" virar "banco fora" no dia em
 * que alguém reescrevesse a frase.
 */
describe("classificarErro", () => {
  it("separa falta de sessão de falha do servidor", () => {
    expect(classificarErro(new SemSessaoError())).toEqual({
      tipo: "sem_sessao",
    });
    expect(classificarErro({ code: "PGRST000", message: "could not connect" })).toEqual(
      { tipo: "falha", mensagem: "could not connect" },
    );
  });

  it("erro sem mensagem aproveitável continua sendo falha, não sessão", () => {
    expect(classificarErro(null)).toEqual({
      tipo: "falha",
      mensagem: "Não foi possível falar com o servidor. Tente de novo.",
    });
  });
});
