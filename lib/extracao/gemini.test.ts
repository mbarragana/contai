import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExtracaoIndisponivelError, extrairViaGemini } from "@/lib/extracao/gemini";

function respostaGemini(objeto: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(objeto) }] } }],
    }),
    text: async () => "",
  };
}

const CAMPOS_NULOS = {
  tipo: "null",
  numero: "null",
  serie: "null",
  dataEmissao: "null",
  vencimento: "null",
  favorecidoNome: "null",
  favorecidoDocumento: "null",
  valorReais: "null",
  classificacao: "null",
  confianca: "null",
};

describe("extrairViaGemini", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "chave-de-teste");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sem GEMINI_API_KEY, recusa antes de qualquer chamada de rede", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchEspiao = vi.fn();
    vi.stubGlobal("fetch", fetchEspiao);

    await expect(extrairViaGemini("base64", "application/pdf")).rejects.toThrow(
      ExtracaoIndisponivelError,
    );
    expect(fetchEspiao).not.toHaveBeenCalled();
  });

  it("converte a string literal 'null' do Gemini em null de verdade antes de validar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respostaGemini(CAMPOS_NULOS)),
    );
    const resultado = await extrairViaGemini("base64", "application/pdf");
    expect(resultado.tipo).toBeNull();
    expect(resultado.valorReais).toBeNull();
  });

  it("extrai um documento completo e válido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaGemini({
          ...CAMPOS_NULOS,
          tipo: "nf_servico",
          numero: "1042",
          favorecidoNome: "Casa do Construtor",
          favorecidoDocumento: "11444777000161",
          valorReais: 1500.9,
          classificacao: "mao_obra",
          confianca: "alta",
        }),
      ),
    );
    const resultado = await extrairViaGemini("base64", "application/pdf");
    expect(resultado).toMatchObject({
      tipo: "nf_servico",
      numero: "1042",
      valorReais: 1500.9,
      classificacao: "mao_obra",
      confianca: "alta",
    });
  });

  it("resposta HTTP não-ok vira ExtracaoIndisponivelError, não exceção crua", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "indisponível",
      }),
    );
    await expect(extrairViaGemini("base64", "application/pdf")).rejects.toThrow(
      ExtracaoIndisponivelError,
    );
  });

  it("JSON malformado na resposta vira ExtracaoIndisponivelError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "{não é json" }] } }],
        }),
      }),
    );
    await expect(extrairViaGemini("base64", "application/pdf")).rejects.toThrow(
      ExtracaoIndisponivelError,
    );
  });

  it("campo fora do enum esperado (schema mudou do lado do Gemini) vira erro tratado, não crash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaGemini({ ...CAMPOS_NULOS, tipo: "algo_inesperado" }),
      ),
    );
    await expect(extrairViaGemini("base64", "application/pdf")).rejects.toThrow(
      ExtracaoIndisponivelError,
    );
  });

  it("falha de rede (fetch rejeita) vira ExtracaoIndisponivelError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    await expect(extrairViaGemini("base64", "application/pdf")).rejects.toThrow(
      ExtracaoIndisponivelError,
    );
  });
});
