import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExtracaoIndisponivelError } from "@/lib/extracao/erros";
import { extrairDocumento } from "@/lib/extracao/provider";
import { EXTRACAO_VAZIA } from "@/lib/extracao/schema";

const extractText = vi.hoisted(() => vi.fn());
const extrairViaGemini = vi.hoisted(() => vi.fn());
const extrairViaGroq = vi.hoisted(() => vi.fn());

vi.mock("unpdf", () => ({ extractText }));
vi.mock("@/lib/extracao/gemini", () => ({ extrairViaGemini }));
vi.mock("@/lib/extracao/groq", () => ({ extrairViaGroq }));

/**
 * `texto-pdf.ts` NÃO é mockado de propósito: a heurística real é o que decide o
 * desvio, e mockar isso testaria o mock. O que é mockado é a borda — o PDF.js
 * (via `unpdf`) e as duas chamadas de rede.
 */
const NFSE_LEGIVEL = `
NOTA FISCAL DE SERVICOS ELETRONICA - NFS-e
Numero: 1042  Data de emissao: 12/03/2026
Prestador: Empreiteira Bom Jesus Construcoes Ltda
CNPJ: 11.444.777/0001-61
Tomador CPF: 123.456.789-09
Discriminacao: execucao de alvenaria estrutural e contrapiso do pavimento
terreo, conforme contrato de empreitada global, com material da contratada.
VALOR TOTAL DOS SERVICOS ... R$ 18.750,00
ISS (3%) ................... R$ 562,50
`;

const DO_GROQ = {
  ...EXTRACAO_VAZIA,
  tipo: "nf_servico" as const,
  favorecidoNome: "Empreiteira Bom Jesus Construcoes Ltda",
  favorecidoDocumento: "11444777000161",
  valorReais: 18750,
  confianca: "alta" as const,
};

const DO_GEMINI = { ...EXTRACAO_VAZIA, tipo: "nf_material" as const };

const PDF_BASE64 = Buffer.from("%PDF-1.7 fake").toString("base64");

describe("extrairDocumento (roteador texto → Groq → Gemini)", () => {
  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "chave-de-teste");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    extrairViaGemini.mockResolvedValue(DO_GEMINI);
    extrairViaGroq.mockResolvedValue(DO_GROQ);
    extractText.mockResolvedValue({ totalPages: 1, text: [NFSE_LEGIVEL] });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    extractText.mockReset();
    extrairViaGemini.mockReset();
    extrairViaGroq.mockReset();
  });

  it("texto suficiente: vai pela Groq com o TEXTO e não chama o Gemini", async () => {
    const { dados, origem } = await extrairDocumento(PDF_BASE64, "application/pdf");

    expect(origem).toBe("texto+groq");
    expect(dados).toMatchObject({ tipo: "nf_servico", valorReais: 18750 });
    expect(extrairViaGroq).toHaveBeenCalledTimes(1);
    expect(extrairViaGroq.mock.calls[0][0]).toContain("18.750,00");
    expect(extrairViaGemini).not.toHaveBeenCalled();
  });

  it("aplica a conferência campo-contra-fonte no resultado da Groq", async () => {
    // A Groq devolve um CNPJ que NÃO está no texto — o caso de alucinação que a
    // segunda defesa existe para pegar.
    extrairViaGroq.mockResolvedValue({ ...DO_GROQ, favorecidoDocumento: "99888777000155" });

    const { dados, origem } = await extrairDocumento(PDF_BASE64, "application/pdf");

    expect(origem).toBe("texto+groq");
    expect(dados.favorecidoDocumento).toBeNull();
    expect(dados.confianca).toBe("baixa");
    // Não cai para a visão: o caminho deu certo, o campo é que foi descartado.
    expect(extrairViaGemini).not.toHaveBeenCalled();
  });

  it("desvio 1 — texto insuficiente (PDF-imagem): cai no Gemini com o arquivo", async () => {
    extractText.mockResolvedValue({ totalPages: 1, text: ["  Scanned by CamScanner "] });

    const { dados, origem } = await extrairDocumento(PDF_BASE64, "application/pdf");

    expect(origem).toBe("visao+gemini");
    expect(dados).toEqual(DO_GEMINI);
    expect(extrairViaGroq).not.toHaveBeenCalled();
    expect(extrairViaGemini).toHaveBeenCalledWith(PDF_BASE64, "application/pdf");
  });

  it("desvio 1b — texto com (cid:N) (fonte sem ToUnicode) também cai no Gemini", async () => {
    extractText.mockResolvedValue({
      totalPages: 1,
      text: ["(cid:14)(cid:82)(cid:87)(cid:68)".repeat(60)],
    });

    const { origem } = await extrairDocumento(PDF_BASE64, "application/pdf");

    expect(origem).toBe("visao+gemini");
    expect(extrairViaGroq).not.toHaveBeenCalled();
  });

  it("desvio 1c — unpdf não consegue ler o PDF: cai no Gemini, sem propagar erro", async () => {
    extractText.mockRejectedValue(new Error("Invalid PDF structure"));

    const { origem } = await extrairDocumento(PDF_BASE64, "application/pdf");

    expect(origem).toBe("visao+gemini");
    expect(extrairViaGroq).not.toHaveBeenCalled();
  });

  it("desvio 2 — Groq indisponível depois do retry: cai no Gemini", async () => {
    extrairViaGroq.mockRejectedValue(
      new ExtracaoIndisponivelError("Groq indisponível após 3 tentativas: 503", 3),
    );

    const { dados, origem } = await extrairDocumento(PDF_BASE64, "application/pdf");

    expect(origem).toBe("visao+gemini");
    expect(dados).toEqual(DO_GEMINI);
    expect(extrairViaGemini).toHaveBeenCalledTimes(1);
  });

  it("desvio 2b — Groq devolve resultado fora do schema: cai no Gemini", async () => {
    extrairViaGroq.mockRejectedValue(
      new ExtracaoIndisponivelError("Groq devolveu formato inesperado: ...", 1),
    );

    const { origem } = await extrairDocumento(PDF_BASE64, "application/pdf");
    expect(origem).toBe("visao+gemini");
  });

  it("GROQ_API_KEY ausente: nem tenta ler o texto, vai direto no Gemini (critério 6)", async () => {
    vi.stubEnv("GROQ_API_KEY", "");

    const { origem } = await extrairDocumento(PDF_BASE64, "application/pdf");

    expect(origem).toBe("visao+gemini");
    expect(extractText).not.toHaveBeenCalled();
    expect(extrairViaGroq).not.toHaveBeenCalled();
  });

  it("EXTRACAO_TEXTO=off desliga o estágio inteiro", async () => {
    vi.stubEnv("EXTRACAO_TEXTO", "off");

    const { origem } = await extrairDocumento(PDF_BASE64, "application/pdf");

    expect(origem).toBe("visao+gemini");
    expect(extractText).not.toHaveBeenCalled();
  });

  it("EXTRACAO_TEXTO com valor desconhecido degrada para o Gemini, avisando no log", async () => {
    vi.stubEnv("EXTRACAO_TEXTO", "gorq");

    const { origem } = await extrairDocumento(PDF_BASE64, "application/pdf");

    expect(origem).toBe("visao+gemini");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("EXTRACAO_TEXTO"));
  });

  it("mime type que não é PDF nunca entra no estágio de texto", async () => {
    const { origem } = await extrairDocumento(PDF_BASE64, "image/jpeg");

    expect(origem).toBe("visao+gemini");
    expect(extractText).not.toHaveBeenCalled();
    expect(extrairViaGemini).toHaveBeenCalledWith(PDF_BASE64, "image/jpeg");
  });

  it("EXTRACAO_PROVIDER desconhecido continua sendo erro de configuração", async () => {
    vi.stubEnv("EXTRACAO_TEXTO", "off");
    vi.stubEnv("EXTRACAO_PROVIDER", "inventado");

    await expect(extrairDocumento(PDF_BASE64, "application/pdf")).rejects.toThrow(
      /EXTRACAO_PROVIDER desconhecido/,
    );
  });

  it("nenhum caminho devolve campo fora do contrato ExtracaoDocumento", async () => {
    const pelaGroq = await extrairDocumento(PDF_BASE64, "application/pdf");
    vi.stubEnv("EXTRACAO_TEXTO", "off");
    const pelaVisao = await extrairDocumento(PDF_BASE64, "application/pdf");

    const chaves = Object.keys(EXTRACAO_VAZIA).sort();
    expect(Object.keys(pelaGroq.dados).sort()).toEqual(chaves);
    expect(Object.keys(pelaVisao.dados).sort()).toEqual(chaves);
  });
});
