import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExtracaoIndisponivelError } from "@/lib/extracao/erros";
import { extrairViaGemini } from "@/lib/extracao/gemini";

function respostaGemini(objeto: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      candidates: [
        {
          finishReason: "STOP",
          content: { parts: [{ text: JSON.stringify(objeto) }] },
        },
      ],
    }),
    text: async () => "",
  };
}

/** Resposta de erro HTTP, com os headers que o código lê (`Retry-After`). */
function respostaErro(
  status: number,
  texto: string,
  headers: Record<string, string> = {},
) {
  return {
    ok: false,
    status,
    headers: new Headers(headers),
    text: async () => texto,
    json: async () => ({}),
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
    // O retry loga cada tentativa falha (telemetria da Vercel); no teste isso
    // é só ruído na saída da suíte.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
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
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respostaErro(503, "indisponível")),
    );
    const promessa = extrairViaGemini("base64", "application/pdf").catch(
      (e) => e,
    );
    await vi.runAllTimersAsync();
    expect(await promessa).toBeInstanceOf(ExtracaoIndisponivelError);
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

  it("pede o nível mínimo de thinking e deixa teto de saída com folga", async () => {
    const fetchEspiao = vi.fn().mockResolvedValue(respostaGemini(CAMPOS_NULOS));
    vi.stubGlobal("fetch", fetchEspiao);

    await extrairViaGemini("base64", "application/pdf");

    const [, init] = fetchEspiao.mock.calls[0];
    const enviado = JSON.parse(init.body);
    expect(enviado.generationConfig.thinkingConfig.thinkingLevel).toBe("low");
    expect(enviado.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(8192);
  });

  it("cada tentativa carrega um AbortSignal com timeout — fecha a D70", async () => {
    const fetchEspiao = vi.fn().mockResolvedValue(respostaGemini(CAMPOS_NULOS));
    vi.stubGlobal("fetch", fetchEspiao);

    await extrairViaGemini("base64", "application/pdf");

    const [, init] = fetchEspiao.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal.aborted).toBe(false);
  });

  it("usa as mesmas regras fiscais da fonte única, com o critério de confiança de VISÃO", async () => {
    const fetchEspiao = vi.fn().mockResolvedValue(respostaGemini(CAMPOS_NULOS));
    vi.stubGlobal("fetch", fetchEspiao);

    await extrairViaGemini("base64", "application/pdf");

    const enviado = JSON.parse(fetchEspiao.mock.calls[0][1].body);
    const prompt = enviado.contents[0].parts[1].text;
    expect(prompt).toContain("quem EMITIU o documento");
    expect(prompt).toContain("Não leia nem tente classificar retenções");
    expect(prompt).toContain("PDF está com texto cortado");
    expect(prompt).not.toContain("AMBIGUIDADE");
  });

  it("resposta cortada por teto de token cita MAX_TOKENS e as contagens no erro", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ finishReason: "MAX_TOKENS" }],
          usageMetadata: { thoughtsTokenCount: 2048, candidatesTokenCount: 0 },
        }),
        text: async () => "",
      }),
    );

    const erro = await extrairViaGemini("base64", "application/pdf").catch(
      (e) => e,
    );
    expect(erro).toBeInstanceOf(ExtracaoIndisponivelError);
    expect(erro.message).toContain("MAX_TOKENS");
    expect(erro.message).toContain("2048");
  });

  it("falha de rede (fetch rejeita) vira ExtracaoIndisponivelError", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const promessa = extrairViaGemini("base64", "application/pdf").catch(
      (e) => e,
    );
    await vi.runAllTimersAsync();
    expect(await promessa).toBeInstanceOf(ExtracaoIndisponivelError);
  });

  describe("retry de erro transitório", () => {
    // Todos os testes daqui usam timers falsos: a espera do backoff é de
    // segundos e não pode virar segundos de suíte.
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("503 na 1ª tentativa e sucesso na 2ª devolve o resultado extraído", async () => {
      const fetchEspiao = vi
        .fn()
        .mockResolvedValueOnce(
          respostaErro(503, "This model is currently experiencing high demand"),
        )
        .mockResolvedValueOnce(
          respostaGemini({ ...CAMPOS_NULOS, tipo: "nf_material" }),
        );
      vi.stubGlobal("fetch", fetchEspiao);

      const promessa = extrairViaGemini("base64", "application/pdf");
      await vi.runAllTimersAsync();

      await expect(promessa).resolves.toMatchObject({ tipo: "nf_material" });
      expect(fetchEspiao).toHaveBeenCalledTimes(2);
    });

    it("429 (rate limit do tier gratuito) também é repetido", async () => {
      const fetchEspiao = vi
        .fn()
        .mockResolvedValueOnce(respostaErro(429, "RESOURCE_EXHAUSTED"))
        .mockResolvedValueOnce(respostaGemini(CAMPOS_NULOS));
      vi.stubGlobal("fetch", fetchEspiao);

      const promessa = extrairViaGemini("base64", "application/pdf");
      await vi.runAllTimersAsync();

      await expect(promessa).resolves.toMatchObject({ tipo: null });
      expect(fetchEspiao).toHaveBeenCalledTimes(2);
    });

    it("três 503 seguidos: erro final cita as tentativas e preserva a mensagem do Gemini", async () => {
      const fetchEspiao = vi
        .fn()
        .mockResolvedValue(respostaErro(503, "model is overloaded"));
      vi.stubGlobal("fetch", fetchEspiao);

      const promessa = extrairViaGemini("base64", "application/pdf").catch(
        (e) => e,
      );
      await vi.runAllTimersAsync();
      const erro = await promessa;

      expect(erro).toBeInstanceOf(ExtracaoIndisponivelError);
      expect(erro.message).toContain("3 tentativas");
      expect(erro.message).toContain("503");
      expect(erro.message).toContain("model is overloaded");
      expect(erro.tentativas).toBe(3);
      expect(fetchEspiao).toHaveBeenCalledTimes(3);
    });

    it("500 também é repetido — a fronteira é 5xx, não só o 503", async () => {
      const fetchEspiao = vi
        .fn()
        .mockResolvedValueOnce(respostaErro(500, "INTERNAL"))
        .mockResolvedValueOnce(respostaGemini(CAMPOS_NULOS));
      vi.stubGlobal("fetch", fetchEspiao);

      const promessa = extrairViaGemini("base64", "application/pdf");
      await vi.runAllTimersAsync();

      await expect(promessa).resolves.toMatchObject({ tipo: null });
      expect(fetchEspiao).toHaveBeenCalledTimes(2);
    });

    it("erro de rede na 1ª tentativa e sucesso na 2ª devolve o resultado extraído", async () => {
      const fetchEspiao = vi
        .fn()
        .mockRejectedValueOnce(new Error("fetch failed"))
        .mockResolvedValueOnce(
          respostaGemini({ ...CAMPOS_NULOS, tipo: "boleto" }),
        );
      vi.stubGlobal("fetch", fetchEspiao);

      const promessa = extrairViaGemini("base64", "application/pdf");
      await vi.runAllTimersAsync();

      await expect(promessa).resolves.toMatchObject({ tipo: "boleto" });
      expect(fetchEspiao).toHaveBeenCalledTimes(2);
    });

    it("falha de rede nas três tentativas: erro final cita as tentativas e a causa", async () => {
      const fetchEspiao = vi.fn().mockRejectedValue(new Error("timeout"));
      vi.stubGlobal("fetch", fetchEspiao);

      const promessa = extrairViaGemini("base64", "application/pdf").catch(
        (e) => e,
      );
      await vi.runAllTimersAsync();
      const erro = await promessa;

      expect(erro).toBeInstanceOf(ExtracaoIndisponivelError);
      expect(erro.message).toContain("3 tentativas");
      expect(erro.message).toContain("timeout");
      expect(erro.tentativas).toBe(3);
      expect(fetchEspiao).toHaveBeenCalledTimes(3);
    });

    it("404 (4xx que não é 429) falha na hora, sem repetir", async () => {
      const fetchEspiao = vi
        .fn()
        .mockResolvedValue(respostaErro(404, "model not found"));
      vi.stubGlobal("fetch", fetchEspiao);

      const erro = await extrairViaGemini("base64", "application/pdf").catch(
        (e) => e,
      );

      expect(erro).toBeInstanceOf(ExtracaoIndisponivelError);
      expect(fetchEspiao).toHaveBeenCalledTimes(1);
      expect(erro.tentativas).toBe(1);
      expect(erro.message).toContain("model not found");
    });

    it("400 (erro de configuração, como o thinkingLevel) falha na hora, sem repetir", async () => {
      const fetchEspiao = vi
        .fn()
        .mockResolvedValue(
          respostaErro(400, "Thinking level MINIMAL is not supported"),
        );
      vi.stubGlobal("fetch", fetchEspiao);

      const erro = await extrairViaGemini("base64", "application/pdf").catch(
        (e) => e,
      );

      expect(erro).toBeInstanceOf(ExtracaoIndisponivelError);
      expect(fetchEspiao).toHaveBeenCalledTimes(1);
      expect(erro.tentativas).toBe(1);
      // Sem retry, a mensagem não inventa tentativa que não houve.
      expect(erro.message).not.toContain("tentativas");
      expect(erro.message).toContain("Thinking level MINIMAL");
    });

    it("espera o backoff antes de repetir — não dispara a 2ª chamada na hora", async () => {
      const fetchEspiao = vi
        .fn()
        .mockResolvedValueOnce(respostaErro(503, "indisponível"))
        .mockResolvedValueOnce(respostaGemini(CAMPOS_NULOS));
      vi.stubGlobal("fetch", fetchEspiao);

      const promessa = extrairViaGemini("base64", "application/pdf");
      await vi.advanceTimersByTimeAsync(500);
      expect(fetchEspiao).toHaveBeenCalledTimes(1);

      await vi.runAllTimersAsync();
      await promessa;
      expect(fetchEspiao).toHaveBeenCalledTimes(2);
    });

    it("Retry-After curto é respeitado no lugar do backoff fixo", async () => {
      const fetchEspiao = vi
        .fn()
        .mockResolvedValueOnce(
          respostaErro(429, "RESOURCE_EXHAUSTED", { "retry-after": "3" }),
        )
        .mockResolvedValueOnce(respostaGemini(CAMPOS_NULOS));
      vi.stubGlobal("fetch", fetchEspiao);

      const promessa = extrairViaGemini("base64", "application/pdf");
      // O backoff fixo da 1ª falha é 1s; com Retry-After: 3 ainda não repetiu.
      await vi.advanceTimersByTimeAsync(1_500);
      expect(fetchEspiao).toHaveBeenCalledTimes(1);

      await vi.runAllTimersAsync();
      await promessa;
      expect(fetchEspiao).toHaveBeenCalledTimes(2);
    });

    it("Retry-After longo é ignorado: a tela de captura não espera minutos", async () => {
      const fetchEspiao = vi
        .fn()
        .mockResolvedValueOnce(
          respostaErro(503, "indisponível", { "retry-after": "120" }),
        )
        .mockResolvedValueOnce(respostaGemini(CAMPOS_NULOS));
      vi.stubGlobal("fetch", fetchEspiao);

      const promessa = extrairViaGemini("base64", "application/pdf");
      // Cai no backoff fixo de 1s, não nos 120s sugeridos.
      await vi.advanceTimersByTimeAsync(1_000);
      expect(fetchEspiao).toHaveBeenCalledTimes(2);

      await promessa;
    });
  });
});
