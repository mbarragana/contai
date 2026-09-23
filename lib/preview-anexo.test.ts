import { describe, expect, it } from "vitest";

import { modoDoPreview, previewDoAnexo } from "./preview-anexo";

describe("previewDoAnexo", () => {
  it("reconhece imagem e PDF pelo MIME", () => {
    expect(previewDoAnexo({ name: "nota.jpg", type: "image/jpeg" })).toBe(
      "imagem",
    );
    expect(previewDoAnexo({ name: "foto.png", type: "image/png" })).toBe(
      "imagem",
    );
    expect(previewDoAnexo({ name: "nf.pdf", type: "application/pdf" })).toBe(
      "pdf",
    );
  });

  it("não dá preview a XML — Estado D do Gate 0", () => {
    expect(previewDoAnexo({ name: "nfe.xml", type: "text/xml" })).toBe(
      "sem-preview",
    );
    expect(previewDoAnexo({ name: "nfe.xml", type: "application/xml" })).toBe(
      "sem-preview",
    );
    // MIME vazio + extensão .xml continua sem preview: a extração de XML é
    // determinística e não depende de conferência visual.
    expect(previewDoAnexo({ name: "nfe.xml", type: "" })).toBe("sem-preview");
  });

  it("cai na extensão quando o navegador não declara o MIME", () => {
    expect(previewDoAnexo({ name: "NF-1042.PDF", type: "" })).toBe("pdf");
    expect(previewDoAnexo({ name: "IMG_0042.HEIC", type: "" })).toBe("imagem");
    expect(
      previewDoAnexo({ name: "nota.pdf", type: "application/octet-stream" }),
    ).toBe("pdf");
  });

  it("não chuta: extensão desconhecida e arquivo ausente ficam sem preview", () => {
    expect(previewDoAnexo({ name: "recibo.docx", type: "" })).toBe(
      "sem-preview",
    );
    expect(previewDoAnexo({ name: "semextensao", type: "" })).toBe(
      "sem-preview",
    );
    expect(previewDoAnexo(null)).toBe("sem-preview");
  });
});

describe("modoDoPreview", () => {
  /**
   * ⚠️ O caso que o ticket existe para travar (critério 3): o MESMO PDF tem
   * destinos diferentes conforme o dispositivo de entrada. Embutido no
   * desktop; aba nova no dedo/tela estreita, onde `<object>` renderia travado
   * na 1ª página sem avisar.
   */
  it("manda o PDF para aba nova em tela estreita/touch, e só ele", () => {
    expect(modoDoPreview("pdf", false)).toBe("pdf-embutido");
    expect(modoDoPreview("pdf", true)).toBe("pdf-em-nova-aba");
  });

  it("imagem não muda de destino por largura nenhuma", () => {
    expect(modoDoPreview("imagem", false)).toBe("imagem");
    expect(modoDoPreview("imagem", true)).toBe("imagem");
  });

  it("sem preview continua sem preview nas duas larguras", () => {
    expect(modoDoPreview("sem-preview", false)).toBe("sem-preview");
    expect(modoDoPreview("sem-preview", true)).toBe("sem-preview");
  });
});
