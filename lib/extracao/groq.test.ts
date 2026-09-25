import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExtracaoIndisponivelError } from "@/lib/extracao/erros";
import { extrairViaGroq } from "@/lib/extracao/groq";

/** Resposta 200 no formato OpenAI (é como a Groq expõe a API). */
function respostaGroq(objeto: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      choices: [
        {
          finish_reason: "stop",
          message: { role: "assistant", content: JSON.stringify(objeto) },
        },
      ],
    }),
    text: async () => "",
  };
}

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
  tipo: null,
  numero: null,
  serie: null,
  dataEmissao: null,
  vencimento: null,
  favorecidoNome: null,
  favorecidoDocumento: null,
  valorReais: null,
  classificacao: null,
  confianca: null,
};

describe("extrairViaGroq", () => {
  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "chave-de-teste");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sem GROQ_API_KEY, recusa antes de qualquer chamada de rede", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const fetchEspiao = vi.fn();
    vi.stubGlobal("fetch", fetchEspiao);

    await expect(extrairViaGroq("texto")).rejects.toThrow(ExtracaoIndisponivelError);
    expect(fetchEspiao).not.toHaveBeenCalled();
  });

  it("extrai um documento completo e válido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaGroq({
          ...CAMPOS_NULOS,
          tipo: "nf_servico",
          numero: "1042",
          favorecidoNome: "Empreiteira Bom Jesus",
          favorecidoDocumento: "11444777000161",
          valorReais: 18750,
          classificacao: "mao_obra",
          confianca: "alta",
        }),
      ),
    );

    await expect(extrairViaGroq("texto da nota")).resolves.toMatchObject({
      tipo: "nf_servico",
      numero: "1042",
      valorReais: 18750,
      classificacao: "mao_obra",
      confianca: "alta",
    });
  });

  it("manda o texto (não arquivo), em json_object, temperatura 0, com timeout e Bearer", async () => {
    const fetchEspiao = vi.fn().mockResolvedValue(respostaGroq(CAMPOS_NULOS));
    vi.stubGlobal("fetch", fetchEspiao);

    await extrairViaGroq("TEXTO-EXTRAIDO-DO-PDF");

    const [url, init] = fetchEspiao.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.headers.authorization).toBe("Bearer chave-de-teste");
    // D70: toda tentativa carrega um teto de tempo próprio.
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const enviado = JSON.parse(init.body);
    expect(enviado.temperature).toBe(0);
    expect(enviado.response_format).toEqual({ type: "json_object" });
    expect(enviado.messages[1].content).toContain("TEXTO-EXTRAIDO-DO-PDF");
    // Sem schema estrito, as chaves têm que vir no prompt.
    expect(enviado.messages[0].content).toContain("favorecidoDocumento");
    expect(enviado.messages[0].content).toContain("JSON");
  });

  it("usa as MESMAS regras fiscais do caminho de visão (fonte única do prompt)", async () => {
    const fetchEspiao = vi.fn().mockResolvedValue(respostaGroq(CAMPOS_NULOS));
    vi.stubGlobal("fetch", fetchEspiao);

    await extrairViaGroq("texto");
    const sistema = JSON.parse(fetchEspiao.mock.calls[0][1].body).messages[0].content;

    expect(sistema).toContain("quem EMITIU o documento");
    expect(sistema).toContain("valor BRUTO");
    // Fronteira fiscal do CONTAI-038: retenção não é leitura, é classificação.
    expect(sistema).toContain("Não leia nem tente classificar retenções");
    // E o critério de confiança do caminho de TEXTO, não o de imagem.
    expect(sistema).toContain("AMBIGUIDADE");
    expect(sistema).not.toContain("PDF está com texto cortado");
  });

  it("usa o modelo de GROQ_MODEL quando definido", async () => {
    vi.stubEnv("GROQ_MODEL", "outro-modelo-de-texto");
    const fetchEspiao = vi.fn().mockResolvedValue(respostaGroq(CAMPOS_NULOS));
    vi.stubGlobal("fetch", fetchEspiao);

    await extrairViaGroq("texto");

    expect(JSON.parse(fetchEspiao.mock.calls[0][1].body).model).toBe(
      "outro-modelo-de-texto",
    );
  });

  it("string 'null' no lugar do literal é normalizada antes de validar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaGroq({ ...CAMPOS_NULOS, tipo: "null", valorReais: "null" }),
      ),
    );

    const resultado = await extrairViaGroq("texto");
    expect(resultado.tipo).toBeNull();
    expect(resultado.valorReais).toBeNull();
  });

  it("valorReais em string vira número — o contrato exige number", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaGroq({ ...CAMPOS_NULOS, valorReais: "1234.56" }),
      ),
    );

    await expect(extrairViaGroq("texto")).resolves.toMatchObject({
      valorReais: 1234.56,
    });
  });

  it("valorReais em grafia pt-BR com milhar (1.234,56) vira número, não NaN", async () => {
    // Achado no Gate 2: tratar só a vírgula deixava o ponto de milhar e o
    // Number devolvia NaN → campo perdido sem ninguém notar.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaGroq({ ...CAMPOS_NULOS, valorReais: "R$ 18.750,00" }),
      ),
    );

    await expect(extrairViaGroq("texto")).resolves.toMatchObject({
      valorReais: 18750,
    });
  });

  it("valorReais em grafia que não é número nenhum vira null, não NaN", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaGroq({ ...CAMPOS_NULOS, valorReais: "nao consta" }),
      ),
    );

    await expect(extrairViaGroq("texto")).resolves.toMatchObject({
      valorReais: null,
    });
  });

  it("valorReais sem centavos e com milhar (18.750) não vira 18,75", async () => {
    // Ambiguidade de 1000x: sem vírgula, grupos de 3 dígitos após o ponto só
    // existem como separador de milhar.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaGroq({ ...CAMPOS_NULOS, valorReais: "18.750" }),
      ),
    );

    await expect(extrairViaGroq("texto")).resolves.toMatchObject({
      valorReais: 18750,
    });
  });

  it("valorReais com ponto decimal de 2 casas continua sendo decimal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaGroq({ ...CAMPOS_NULOS, valorReais: "18.75" }),
      ),
    );

    await expect(extrairViaGroq("texto")).resolves.toMatchObject({
      valorReais: 18.75,
    });
  });

  it("chave ausente conta como campo não lido, não como resposta inválida", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respostaGroq({ tipo: "boleto", valorReais: 99.9 })),
    );

    await expect(extrairViaGroq("texto")).resolves.toEqual({
      tipo: "boleto",
      numero: null,
      serie: null,
      dataEmissao: null,
      vencimento: null,
      favorecidoNome: null,
      favorecidoDocumento: null,
      valorReais: 99.9,
      classificacao: null,
      confianca: null,
    });
  });

  it("JSON malformado vira ExtracaoIndisponivelError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          choices: [{ finish_reason: "stop", message: { content: "{não é json" } }],
        }),
        text: async () => "",
      }),
    );

    await expect(extrairViaGroq("texto")).rejects.toThrow(ExtracaoIndisponivelError);
  });

  it("campo fora do enum esperado vira erro tratado, não crash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaGroq({ ...CAMPOS_NULOS, tipo: "algo_inesperado" }),
      ),
    );

    await expect(extrairViaGroq("texto")).rejects.toThrow(ExtracaoIndisponivelError);
  });

  it("resposta cortada por teto de token cita finish_reason, não some como 'JSON inválido'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          choices: [{ finish_reason: "length", message: { content: '{"tipo":' } }],
          usage: { completion_tokens: 1024 },
        }),
        text: async () => "",
      }),
    );

    const erro = await extrairViaGroq("texto").catch((e) => e);
    expect(erro).toBeInstanceOf(ExtracaoIndisponivelError);
    expect(erro.message).toContain("length");
    expect(erro.message).toContain("1024");
  });

  it("resposta sem choices vira erro tratado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({}),
        text: async () => "",
      }),
    );

    await expect(extrairViaGroq("texto")).rejects.toThrow(ExtracaoIndisponivelError);
  });

  describe("retry compartilhado com o Gemini", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("429 (cota da Groq) é repetido e o sucesso da 2ª tentativa vale", async () => {
      const fetchEspiao = vi
        .fn()
        .mockResolvedValueOnce(respostaErro(429, "rate limit"))
        .mockResolvedValueOnce(respostaGroq({ ...CAMPOS_NULOS, tipo: "nf_material" }));
      vi.stubGlobal("fetch", fetchEspiao);

      const promessa = extrairViaGroq("texto");
      await vi.runAllTimersAsync();

      await expect(promessa).resolves.toMatchObject({ tipo: "nf_material" });
      expect(fetchEspiao).toHaveBeenCalledTimes(2);
    });

    it("três 503 seguidos: erro final cita as tentativas e nomeia a Groq", async () => {
      const fetchEspiao = vi.fn().mockResolvedValue(respostaErro(503, "overloaded"));
      vi.stubGlobal("fetch", fetchEspiao);

      const promessa = extrairViaGroq("texto").catch((e) => e);
      await vi.runAllTimersAsync();
      const erro = await promessa;

      expect(erro).toBeInstanceOf(ExtracaoIndisponivelError);
      expect(erro.message).toContain("Groq");
      expect(erro.message).toContain("3 tentativas");
      expect(erro.tentativas).toBe(3);
      expect(fetchEspiao).toHaveBeenCalledTimes(3);
    });

    it("400 (erro de request) falha na hora, sem repetir", async () => {
      const fetchEspiao = vi
        .fn()
        .mockResolvedValue(respostaErro(400, "model_decommissioned"));
      vi.stubGlobal("fetch", fetchEspiao);

      const erro = await extrairViaGroq("texto").catch((e) => e);

      expect(erro).toBeInstanceOf(ExtracaoIndisponivelError);
      expect(fetchEspiao).toHaveBeenCalledTimes(1);
      expect(erro.message).toContain("model_decommissioned");
    });

    it("timeout do AbortSignal é tratado como transitório e repetido (D70)", async () => {
      const timeout = new Error("The operation was aborted due to timeout");
      timeout.name = "TimeoutError";
      const fetchEspiao = vi
        .fn()
        .mockRejectedValueOnce(timeout)
        .mockResolvedValueOnce(respostaGroq({ ...CAMPOS_NULOS, tipo: "boleto" }));
      vi.stubGlobal("fetch", fetchEspiao);

      const promessa = extrairViaGroq("texto");
      await vi.runAllTimersAsync();

      await expect(promessa).resolves.toMatchObject({ tipo: "boleto" });
      expect(fetchEspiao).toHaveBeenCalledTimes(2);
    });
  });
});
