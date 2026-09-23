import { describe, expect, it } from "vitest";

import {
  classificarFalhaDeAbertura,
  donoDoCaminhoNoAcervo,
  extensaoDoArquivoNoAcervo,
  nomeDoArquivoNoAcervo,
  tamanhoLegivelDoAnexo,
} from "@/lib/acervo";

const DONO = "11111111-1111-4111-8111-111111111111";
const OUTRO = "99999999-9999-4999-8999-999999999999";

describe("nomeDoArquivoNoAcervo", () => {
  it("é o último segmento do caminho", () => {
    expect(
      nomeDoArquivoNoAcervo(`${DONO}/comprovante/abc-comprovante-pix-1.pdf`),
    ).toBe("abc-comprovante-pix-1.pdf");
  });

  /**
   * ⚠️ O carimbo é do próprio app (`subirParaAcervo`) e tem 37 caracteres. Sem
   * tirá-lo, o item a 375px vira um bloco de hexadecimal com um `.pdf` no fim
   * — a D35 fechada pela metade.
   */
  it("tira o UUID que o upload carimbou na frente", () => {
    expect(
      nomeDoArquivoNoAcervo(
        `${DONO}/documento/a3a4c30a-4167-4a97-a0a8-e2a78343fe95-nfse-2481.pdf`,
      ),
    ).toBe("nfse-2481.pdf");
  });

  it("não confunde qualquer hífen com o carimbo", () => {
    expect(
      nomeDoArquivoNoAcervo(`${DONO}/terreno/2026-08-12-comprovante-pix.pdf`),
    ).toBe("2026-08-12-comprovante-pix.pdf");
    expect(nomeDoArquivoNoAcervo(`${DONO}/terreno/nota-fiscal-2481.pdf`)).toBe(
      "nota-fiscal-2481.pdf",
    );
  });

  it("arquivo cujo nome era só o carimbo não fica anônimo", () => {
    const so = "a3a4c30a-4167-4a97-a0a8-e2a78343fe95-";
    expect(nomeDoArquivoNoAcervo(`${DONO}/documento/${so}`)).toBe(so);
  });

  it("aguenta caminho sem barra", () => {
    expect(nomeDoArquivoNoAcervo("nota.pdf")).toBe("nota.pdf");
  });

  /**
   * Nunca devolver string vazia: um item de lista sem nome nenhum é um papel
   * que o Mateus não consegue identificar — e identificar é o ponto da D35.
   */
  it("cai no caminho inteiro quando termina em barra", () => {
    expect(nomeDoArquivoNoAcervo(`${DONO}/terreno/`)).toBe(`${DONO}/terreno/`);
  });
});

describe("extensaoDoArquivoNoAcervo", () => {
  it("lê a extensão do próprio caminho, em maiúsculas", () => {
    expect(extensaoDoArquivoNoAcervo("u/documento/nfse-2481.pdf")).toBe("PDF");
    expect(extensaoDoArquivoNoAcervo("u/comprovante/recibo.JPG")).toBe("JPG");
  });

  it("não inventa rótulo quando não há extensão reconhecível", () => {
    expect(extensaoDoArquivoNoAcervo("u/documento/sem-extensao")).toBe("—");
    expect(extensaoDoArquivoNoAcervo("u/documento/ponto.")).toBe("—");
    expect(extensaoDoArquivoNoAcervo("u/documento/.oculto")).toBe("—");
    expect(extensaoDoArquivoNoAcervo("u/documento/x.arquivao")).toBe("—");
  });
});

describe("donoDoCaminhoNoAcervo", () => {
  /**
   * É a MESMA leitura que a policy `acervo_dono_select` faz em SQL:
   * `(storage.foldername(name))[1] = auth.uid()::text`.
   */
  it("é o primeiro segmento, como na policy da 0002", () => {
    expect(donoDoCaminhoNoAcervo(`${DONO}/terreno/entrada.pdf`)).toBe(DONO);
  });
});

/**
 * ⚠️ O Storage NÃO distingue "não é seu" de "não existe": conferido contra o
 * stack local, objeto de outro usuário que EXISTE e caminho inexistente voltam
 * os dois como `404 / NoSuchKey`. É consequência da RLS — o que a policy
 * esconde não existe para quem pergunta.
 *
 * Por isso a redação da recusa se decide também pelo CAMINHO. Isto não é
 * autorização: quando esta função roda, o Storage já recusou.
 */
describe("classificarFalhaDeAbertura", () => {
  const naoEncontrado = {
    name: "StorageApiError",
    status: 400,
    statusCode: "404",
    code: "NoSuchKey",
    message: "Object not found",
  };

  it("caminho de OUTRO usuário que o Storage recusou é `negado`", () => {
    expect(
      classificarFalhaDeAbertura(
        naoEncontrado,
        `${OUTRO}/terreno/alheio.pdf`,
        DONO,
      ),
    ).toBe("negado");
  });

  it("caminho do PRÓPRIO dono que voltou 404 é `falha` — retry é honesto", () => {
    expect(
      classificarFalhaDeAbertura(
        naoEncontrado,
        `${DONO}/terreno/sumiu.pdf`,
        DONO,
      ),
    ).toBe("falha");
  });

  it("erro de rede vira `falha`, mesmo em caminho alheio", () => {
    expect(
      classificarFalhaDeAbertura(
        new TypeError("Failed to fetch"),
        `${OUTRO}/terreno/alheio.pdf`,
        DONO,
      ),
    ).toBe("falha");
  });

  it("503 do Storage vira `falha`, não `negado`", () => {
    expect(
      classificarFalhaDeAbertura(
        { status: 503, statusCode: "503", message: "Service Unavailable" },
        `${DONO}/terreno/entrada.pdf`,
        DONO,
      ),
    ).toBe("falha");
  });

  /**
   * O nome do campo já mudou de versão para versão no storage-js. Uma
   * biblioteca nova que passe a mandar `status: 404` não pode transformar
   * "não é seu" em "tente de novo" sem ninguém perceber.
   */
  it("reconhece o 404 nas três formas que a biblioteca já usou", () => {
    for (const erro of [
      { code: "NoSuchKey" },
      { statusCode: "404" },
      { status: 404 },
    ]) {
      expect(
        classificarFalhaDeAbertura(erro, `${OUTRO}/terreno/x.pdf`, DONO),
      ).toBe("negado");
    }
  });

  it("erro nulo ou sem forma conhecida não vira `negado`", () => {
    expect(
      classificarFalhaDeAbertura(null, `${OUTRO}/terreno/x.pdf`, DONO),
    ).toBe("falha");
    expect(
      classificarFalhaDeAbertura("quebrou", `${OUTRO}/terreno/x.pdf`, DONO),
    ).toBe("falha");
  });
});

/**
 * CONTAI-047, critério 1a — o tamanho do anexo na miniatura do rail.
 *
 * Rótulo de tela, não número fiscal: o que ele não pode é MENTIR sobre haver
 * arquivo. "0 KB" num anexo de 120 bytes lê como "não anexou", e a tela inteira
 * existe para que o arquivo não se perca de vista.
 */
describe("tamanhoLegivelDoAnexo", () => {
  it("bytes, KB e MB, na faixa de cada um", () => {
    expect(tamanhoLegivelDoAnexo(0)).toBe("0 B");
    expect(tamanhoLegivelDoAnexo(999)).toBe("999 B");
    expect(tamanhoLegivelDoAnexo(1024)).toBe("1 KB");
    expect(tamanhoLegivelDoAnexo(319_488)).toBe("312 KB");
    expect(tamanhoLegivelDoAnexo(2_306_867)).toBe("2,2 MB");
  });

  it("arquivo minúsculo nunca vira '0 KB'", () => {
    // Arredondar para baixo diria "não tem arquivo" sobre um arquivo que tem.
    expect(tamanhoLegivelDoAnexo(1025)).toBe("1 KB");
    expect(tamanhoLegivelDoAnexo(1100)).toBe("1 KB");
  });

  it("entrada impossível vira '—', nunca 'NaN B'", () => {
    expect(tamanhoLegivelDoAnexo(Number.NaN)).toBe("—");
    expect(tamanhoLegivelDoAnexo(-1)).toBe("—");
  });
});
