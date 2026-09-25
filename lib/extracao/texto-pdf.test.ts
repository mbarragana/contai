import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXTRACAO_VAZIA } from "@/lib/extracao/schema";
import {
  LIMITE_CARACTERES,
  LIMITE_PAGINAS,
  avaliarTexto,
  conferirContraFonte,
  extrairTextoDoPdf,
} from "@/lib/extracao/texto-pdf";

const extractText = vi.hoisted(() => vi.fn());
vi.mock("unpdf", () => ({ extractText }));

/**
 * Fixture 1 — NFS-e gerada por sistema, o caso que o estágio de texto existe
 * para atender. Sintética: nenhum dado real da obra entra no repositório
 * (CONTAI-052, decisão técnica 4).
 */
const NFSE_LEGIVEL = `
PREFEITURA MUNICIPAL DE FLORIANOPOLIS
NOTA FISCAL DE SERVICOS ELETRONICA - NFS-e
Numero: 1042    Serie: A    Data de emissao: 12/03/2026

PRESTADOR DE SERVICOS
Razao Social: Empreiteira Bom Jesus Construcoes Ltda
CNPJ: 11.444.777/0001-61
Inscricao Municipal: 998877
Endereco: Rua das Palmeiras, 120 - Cachoeira do Bom Jesus - Florianopolis/SC

TOMADOR DE SERVICOS
Nome: pessoa fisica tomadora
CPF: 123.456.789-09
Endereco da obra: Servidao dos Coqueiros, 45 - Cachoeira do Bom Jesus

DISCRIMINACAO DOS SERVICOS
Execucao de alvenaria estrutural e contrapiso do pavimento terreo,
conforme contrato de empreitada global. Mao de obra com material
fornecido pela contratada.

VALOR TOTAL DOS SERVICOS ................. R$ 18.750,00
Base de calculo .......................... R$ 18.750,00
ISS (3%) ................................. R$ 562,50
VALOR LIQUIDO ............................ R$ 18.187,50

Codigo de verificacao: A1B2-C3D4
`;

/**
 * Fixture 2 — PDF-imagem (scan/foto sem OCR). O PDF.js devolve só o resto de
 * metadado que sobra no fluxo de conteúdo; nada parecido com uma nota.
 */
const IMAGEM_PURA = "\n\n   \n Scanned by CamScanner \n\n";

/**
 * Fixture 3 — a que engana: tem VOLUME, mas a fonte embutida não tem mapa
 * `ToUnicode`, e cada letra volta como `(cid:N)`. Sem o teste de lixo isto
 * seria mandado para a IA, que devolveria um valor plausível e inventado.
 */
const CID_SEM_TOUNICODE =
  "(cid:14)(cid:82)(cid:87)(cid:68) (cid:73)(cid:76)(cid:86)(cid:70)(cid:68)".repeat(
    40,
  );

describe("avaliarTexto", () => {
  it("NFS-e gerada por sistema é suficiente", () => {
    const avaliacao = avaliarTexto(NFSE_LEGIVEL);
    expect(avaliacao.suficiente).toBe(true);
    expect(avaliacao.motivo).toBeNull();
    expect(avaliacao.temDocumento).toBe(true);
    expect(avaliacao.temValor).toBe(true);
  });

  it("PDF-imagem sem OCR reprova por volume", () => {
    const avaliacao = avaliarTexto(IMAGEM_PURA);
    expect(avaliacao.suficiente).toBe(false);
    expect(avaliacao.motivo).toBe("curto");
  });

  it("texto vazio reprova por volume, sem divisão por zero na proporção de lixo", () => {
    const avaliacao = avaliarTexto("");
    expect(avaliacao.suficiente).toBe(false);
    expect(avaliacao.motivo).toBe("curto");
    expect(avaliacao.proporcaoLixo).toBe(0);
  });

  it("fonte sem ToUnicode ((cid:N)) reprova por lixo, mesmo tendo volume", () => {
    const avaliacao = avaliarTexto(CID_SEM_TOUNICODE);
    expect(avaliacao.caracteresNaoBrancos).toBeGreaterThan(200);
    expect(avaliacao.suficiente).toBe(false);
    expect(avaliacao.motivo).toBe("lixo");
  });

  it("caractere de substituição (U+FFFD) espalhado também reprova por lixo", () => {
    const embaralhado = "�".repeat(50) + NFSE_LEGIVEL.slice(0, 300);
    const avaliacao = avaliarTexto(embaralhado);
    expect(avaliacao.suficiente).toBe(false);
    expect(avaliacao.motivo).toBe("lixo");
  });

  it("um símbolo exótico isolado NÃO reprova — o limiar tem folga de 5%", () => {
    const comUmLixo = `${NFSE_LEGIVEL}�`;
    expect(avaliarTexto(comUmLixo).suficiente).toBe(true);
  });

  it("texto longo e limpo sem CNPJ/CPF reprova por falta de âncora", () => {
    const semDocumento = `
      MEMORIAL DESCRITIVO DA OBRA
      ${"Paredes em alvenaria de blocos ceramicos assentados com argamassa. ".repeat(10)}
      Valor estimado R$ 18.750,00
    `;
    const avaliacao = avaliarTexto(semDocumento);
    expect(avaliacao.temValor).toBe(true);
    expect(avaliacao.temDocumento).toBe(false);
    expect(avaliacao.suficiente).toBe(false);
    expect(avaliacao.motivo).toBe("sem_ancora");
  });

  it("texto longo e limpo com CNPJ mas sem valor monetário reprova por âncora", () => {
    const semValor = `
      CONTRATO DE EMPREITADA
      Contratada: Empreiteira Bom Jesus Construcoes Ltda, CNPJ 11.444.777/0001-61.
      ${"Clausula de prazo e de execucao conforme cronograma fisico aprovado. ".repeat(10)}
    `;
    const avaliacao = avaliarTexto(semValor);
    expect(avaliacao.temDocumento).toBe(true);
    expect(avaliacao.temValor).toBe(false);
    expect(avaliacao.motivo).toBe("sem_ancora");
  });

  it("data no formato AAAA-MM-DD não passa por valor monetário", () => {
    expect(avaliarTexto("emitida em 2026-09-24").temValor).toBe(false);
  });

  it("CNPJ sem pontuação conta como âncora de documento", () => {
    const semPontuacao = `${"Descricao do servico prestado na obra. ".repeat(10)}
      CNPJ 11444777000161 - total 18.750,00`;
    expect(avaliarTexto(semPontuacao).temDocumento).toBe(true);
  });
});

describe("extrairTextoDoPdf", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    extractText.mockReset();
  });

  it("junta as páginas lidas e informa quantas entraram", async () => {
    extractText.mockResolvedValue({ totalPages: 2, text: ["pagina um", "pagina dois"] });

    const lido = await extrairTextoDoPdf(new Uint8Array([1, 2, 3]));

    expect(lido).toEqual({ texto: "pagina um\npagina dois", paginas: 2 });
    // `mergePages: false` é o que permite cortar por página antes de juntar.
    expect(extractText).toHaveBeenCalledWith(expect.anything(), {
      mergePages: false,
    });
  });

  it("corta nas primeiras páginas — o resto do PDF é anexo, não a nota", async () => {
    const paginas = Array.from({ length: 12 }, (_, i) => `p${i}`);
    extractText.mockResolvedValue({ totalPages: 12, text: paginas });

    const lido = await extrairTextoDoPdf(new Uint8Array([1]));

    expect(lido?.paginas).toBe(LIMITE_PAGINAS);
    expect(lido?.texto).toBe("p0\np1\np2\np3\np4");
  });

  it("corta no teto de caracteres", async () => {
    extractText.mockResolvedValue({ totalPages: 1, text: ["x".repeat(50_000)] });

    const lido = await extrairTextoDoPdf(new Uint8Array([1]));

    expect(lido?.texto).toHaveLength(LIMITE_CARACTERES);
  });

  it("PDF ilegível (unpdf lança) devolve null em vez de propagar o erro", async () => {
    extractText.mockRejectedValue(new Error("Invalid PDF structure"));

    await expect(extrairTextoDoPdf(new Uint8Array([1]))).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("conferirContraFonte", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const lido = {
    ...EXTRACAO_VAZIA,
    favorecidoDocumento: "11444777000161",
    valorReais: 18750,
    confianca: "alta" as const,
  };

  it("campos que aparecem no texto-fonte passam intactos", () => {
    const conferido = conferirContraFonte(lido, NFSE_LEGIVEL);
    expect(conferido.favorecidoDocumento).toBe("11444777000161");
    expect(conferido.valorReais).toBe(18750);
    expect(conferido.confianca).toBe("alta");
  });

  it("CNPJ formatado no texto e cru no campo ainda casa", () => {
    // No texto está "11.444.777/0001-61"; no schema o campo é só dígitos.
    expect(
      conferirContraFonte(lido, NFSE_LEGIVEL).favorecidoDocumento,
    ).not.toBeNull();
  });

  it("CNPJ que não está no texto vira null e rebaixa a confiança", () => {
    const alucinado = { ...lido, favorecidoDocumento: "99888777000155" };
    const conferido = conferirContraFonte(alucinado, NFSE_LEGIVEL);
    expect(conferido.favorecidoDocumento).toBeNull();
    expect(conferido.confianca).toBe("baixa");
    // O que passou na conferência continua lá — rebaixar não é zerar tudo.
    expect(conferido.valorReais).toBe(18750);
  });

  it("valor que não está no texto vira null e rebaixa a confiança", () => {
    const alucinado = { ...lido, valorReais: 18187.51 };
    const conferido = conferirContraFonte(alucinado, NFSE_LEGIVEL);
    expect(conferido.valorReais).toBeNull();
    expect(conferido.confianca).toBe("baixa");
    expect(conferido.favorecidoDocumento).toBe("11444777000161");
  });

  it("valor com centavos e milhar (18.187,50) é reconhecido no texto pt-BR", () => {
    const comCentavos = { ...lido, valorReais: 18187.5 };
    expect(conferirContraFonte(comCentavos, NFSE_LEGIVEL).valorReais).toBe(18187.5);
  });

  it("valor que é só PEDAÇO de outro número no texto não conta como aparição", () => {
    // 18,75 contra um texto que tem 18.750,00: `includes` aprovaria, e o erro
    // seria de 1000x no custo de aquisição. É o pior falso positivo possível
    // aqui, e o mais fácil de não notar na tela.
    const milVezesMenor = { ...lido, favorecidoDocumento: null, valorReais: 18.75 };
    const conferido = conferirContraFonte(milVezesMenor, NFSE_LEGIVEL);
    expect(conferido.valorReais).toBeNull();
    expect(conferido.confianca).toBe("baixa");
  });

  it("valor não casa dentro de um valor maior com o mesmo final", () => {
    // 187,50 dentro de "18.187,50": o final coincide, o número não.
    const pedacoFinal = { ...lido, favorecidoDocumento: null, valorReais: 187.5 };
    expect(conferirContraFonte(pedacoFinal, NFSE_LEGIVEL).valorReais).toBeNull();
  });

  it("valor pequeno sem milhar (562,50) é reconhecido", () => {
    const pequeno = { ...lido, valorReais: 562.5 };
    expect(conferirContraFonte(pequeno, NFSE_LEGIVEL).valorReais).toBe(562.5);
  });

  it("valor impresso com ponto decimal (1234.56) é reconhecido", () => {
    const comPonto = {
      ...lido,
      favorecidoDocumento: null,
      valorReais: 1234.56,
    };
    expect(
      conferirContraFonte(comPonto, "total do documento 1234.56").valorReais,
    ).toBe(1234.56);
  });

  it("os dois campos inventados: os dois viram null, confiança baixa", () => {
    const tudoInventado = {
      ...lido,
      favorecidoDocumento: "99888777000155",
      valorReais: 4321.09,
    };
    const conferido = conferirContraFonte(tudoInventado, CID_SEM_TOUNICODE);
    expect(conferido.favorecidoDocumento).toBeNull();
    expect(conferido.valorReais).toBeNull();
    expect(conferido.confianca).toBe("baixa");
  });

  it("confiança só rebaixa, nunca sobe", () => {
    const jaBaixa = { ...lido, confianca: "baixa" as const };
    expect(conferirContraFonte(jaBaixa, NFSE_LEGIVEL).confianca).toBe("baixa");
  });

  it("nada preenchido para conferir não mexe na confiança", () => {
    const nada = { ...EXTRACAO_VAZIA, confianca: "media" as const };
    expect(conferirContraFonte(nada, NFSE_LEGIVEL).confianca).toBe("media");
  });

  it("não toca em campo fiscal nenhum nem inventa chave nova no contrato", () => {
    const conferido = conferirContraFonte(lido, NFSE_LEGIVEL);
    expect(Object.keys(conferido).sort()).toEqual(Object.keys(EXTRACAO_VAZIA).sort());
  });
});
