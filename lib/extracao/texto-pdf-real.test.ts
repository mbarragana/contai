/**
 * O ÚNICO teste que roda o `unpdf` de verdade — sem mock, ponta a ponta.
 *
 * Arquivo separado de `texto-pdf.test.ts` porque `vi.mock("unpdf")` vale para o
 * arquivo inteiro, e aqui o ponto é justamente NÃO mockar. Os testes com mock
 * cobrem os cortes (páginas, caracteres) e o erro; este cobre o que mock não
 * alcança: que a biblioteca real aceita o que a gente entrega.
 *
 * Existe por causa do Gate 2 do CONTAI-052: `provider.ts` passava um `Buffer`,
 * o PDF.js dentro do `unpdf` **lança** com Buffer ("Please provide binary data
 * as `Uint8Array`, rather than `Buffer`"), o `catch` de `extrairTextoDoPdf`
 * engolia a exceção e devolvia `null`. Em produção isso significava TODO
 * documento caindo em silêncio no Gemini — o ticket inteiro sem efeito, sem
 * erro visível. Os 79 testes com `unpdf` mockado passavam verdes.
 *
 * Conclusão que fica registrada: mock de biblioteca de terceiro prova o NOSSO
 * contrato, não o DELA. É a mesma lição do `numeric(14,2)` voltando do
 * PostgREST como number (CLAUDE.md, regra dura de E2E) em outra escala.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { avaliarTexto, extrairTextoDoPdf } from "@/lib/extracao/texto-pdf";

/**
 * PDF mínimo escrito em sintaxe PDF crua — 5 objetos, fonte Helvetica padrão,
 * fluxo de conteúdo sem compressão. Nada de dado real da obra: CNPJ e valor são
 * sintéticos, só precisam ter a FORMA que as âncoras da heurística procuram.
 *
 * Feito à mão de propósito: trazer uma lib de geração de PDF só para o teste
 * adicionaria dependência de dev para provar uma dependência de produção.
 */
function pdfComTexto(linhas: string[]): Buffer {
  const conteudo = linhas
    .map((linha, i) => `BT /F1 11 Tf 40 ${780 - i * 18} Td (${linha}) Tj ET`)
    .join("\n");

  const objetos = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]" +
      " /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const objeto of objetos) {
    offsets.push(pdf.length);
    pdf += objeto;
  }
  const inicioXref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${inicioXref}\n%%EOF\n`;

  // `latin1`: cada caractere vira exatamente 1 byte, que é o que os offsets da
  // xref contam. UTF-8 desalinharia a tabela e o PDF não abriria.
  return Buffer.from(pdf, "latin1");
}

const NOTA_SINTETICA = [
  "NOTA FISCAL DE SERVICOS ELETRONICA - NFS-e",
  "Numero: 1042   Serie: A   Emissao: 12/03/2026",
  "PRESTADOR: Empreiteira Sintetica Construcoes Ltda",
  "CNPJ: 11.444.777/0001-61",
  "TOMADOR: pessoa fisica   CPF: 123.456.789-09",
  "DISCRIMINACAO: execucao de alvenaria estrutural e contrapiso do",
  "pavimento terreo, conforme contrato de empreitada global, com",
  "material fornecido pela contratada. Servico de mao de obra.",
  "VALOR TOTAL DOS SERVICOS ............. R$ 18.750,00",
  "BASE DE CALCULO ...................... R$ 18.750,00",
  "ISS (3%) ............................. R$ 562,50",
  "VALOR LIQUIDO ........................ R$ 18.187,50",
];

describe("extrairTextoDoPdf com o unpdf REAL", () => {
  beforeEach(() => {
    // O PDF.js escreve aviso no console para PDF inválido; aqui isso é só ruído
    // na saída da suíte.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lê o texto de um PDF entregue como Buffer do Node — o caso do provider.ts", async () => {
    // Exatamente o que `provider.ts` produz de `Buffer.from(base64, "base64")`.
    // Antes do fix do Gate 2 isto voltava `null`.
    const buffer = pdfComTexto(NOTA_SINTETICA);
    expect(buffer).toBeInstanceOf(Buffer);

    const lido = await extrairTextoDoPdf(buffer);

    expect(lido).not.toBeNull();
    expect(lido!.paginas).toBe(1);
    expect(lido!.texto).toContain("11.444.777/0001-61");
    expect(lido!.texto).toContain("18.750,00");
  });

  it("aceita Uint8Array puro do mesmo jeito — a normalização não quebra o caminho já correto", async () => {
    const buffer = pdfComTexto(NOTA_SINTETICA);
    const view = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    const lido = await extrairTextoDoPdf(view);

    expect(lido?.texto).toContain("11.444.777/0001-61");
  });

  it("o texto que sai do unpdf real passa na heurística de suficiência", async () => {
    // Fecha o circuito: é este par (extração real + heurística real) que decide
    // se o documento vai para a Groq ou cai no Gemini.
    const lido = await extrairTextoDoPdf(pdfComTexto(NOTA_SINTETICA));
    const avaliacao = avaliarTexto(lido!.texto);

    expect(avaliacao.suficiente).toBe(true);
    expect(avaliacao.temDocumento).toBe(true);
    expect(avaliacao.temValor).toBe(true);
    expect(avaliacao.proporcaoLixo).toBe(0);
    // Medido em 2026-09-25: ~620 caracteres para uma nota de 12 linhas — o
    // limiar de 200 tem folga de 3x contra a nota mais magra imaginável.
    expect(avaliacao.caracteresNaoBrancos).toBeGreaterThan(400);
  });

  it("PDF-imagem (sem camada de texto) é lido sem erro, mas reprova na heurística", async () => {
    // Um PDF válido com uma página em branco: é o que um scan sem OCR produz do
    // ponto de vista do extrator — abre, mas não tem texto nenhum.
    const emBranco = pdfComTexto([]);

    const lido = await extrairTextoDoPdf(emBranco);

    expect(lido).not.toBeNull();
    expect(avaliarTexto(lido!.texto).suficiente).toBe(false);
    expect(avaliarTexto(lido!.texto).motivo).toBe("curto");
  });

  it("arquivo que não é PDF devolve null, sem lançar", async () => {
    const lixo = Buffer.from("isto não é um PDF, é texto solto");

    await expect(extrairTextoDoPdf(lixo)).resolves.toBeNull();
  });
});
