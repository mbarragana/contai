/**
 * CONTAI-054, o teste de ponta a ponta do caminho da rota: PDF de verdade →
 * `unpdf` de verdade → heurística de suficiência → parser.
 *
 * Arquivo separado (mesmo motivo de `texto-pdf-real.test.ts`, e o construtor de
 * PDF é o mesmo daquele arquivo, copiado de propósito para nenhum dos dois
 * depender do outro): aqui o ponto é NÃO mockar o `unpdf`.
 *
 * ⚠️ **As fixtures deste arquivo reproduzem a ESTRUTURA medida nas duas notas
 * reais do ticket em 2026-09-25** — rótulo numa linha, valor sozinho na
 * seguinte, porque o PDF.js emite um item de texto por célula da tabela.
 * Números, nomes e municípios são inventados; o que é real é o formato
 * linha-a-linha e o vocabulário dos rótulos (inclusive o "Total das Retenções",
 * que tem "total" no nome e é a própria linha de retenção). É este arquivo que
 * fecha a dívida D75: a versão anterior do parser, escrita contra fixture de
 * uma linha só, devolvia `null` nas duas notas que motivaram o ticket.
 */

import { describe, expect, it } from "vitest";

import { sugerirLinhaRetencao } from "@/lib/extracao/retencao-texto";
import { avaliarTexto, extrairTextoDoPdf } from "@/lib/extracao/texto-pdf";

/** Idêntico ao de `texto-pdf-real.test.ts`: 5 objetos, Helvetica, sem compressão. */
function pdfComTexto(linhas: string[]): Buffer {
  const conteudo = linhas
    .map((linha, i) => `BT /F1 11 Tf 40 ${780 - i * 14} Td (${linha}) Tj ET`)
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

  return Buffer.from(pdf, "latin1");
}

/**
 * Nota 1 — NFS-e municipal (padrão de prefeitura de SC). Uma célula por par de
 * linhas. 52.400,00 − 1.048,00 = 51.352,00, e a retenção se chama "ISSRF".
 */
const NOTA_MUNICIPAL_CELULAS = [
  "NOTA FISCAL DE SERVICOS ELETRONICA - NFS-e",
  "PRESTADOR Empreiteira Anonimizada Ltda",
  "CNPJ 11.444.777/0001-61",
  "TOMADOR pessoa fisica CPF 123.456.789-09",
  "DISCRIMINACAO execucao de estrutura de concreto armado do pavimento",
  "terreo, conforme contrato de empreitada global.",
  "Valor Total",
  "52.400,00",
  "Desc. Incondicional",
  "0,00",
  "ISSRF",
  "1.048,00",
  "IR",
  "0,00",
  "Valor Liquido",
  "51.352,00",
];

/**
 * Nota 2 — DANFSe v2.0 / NFS-e Nacional. Três coisas que só esta estrutura
 * exercita, e todas as três eram falha da primeira versão do parser:
 * a retenção rotulada "Total das Retencoes …"; os campos de IBS/CBS zerados
 * (dois "total" e dois "líquido" na mesma nota); e a "Base de Calculo" repetindo
 * o valor do total, que fecharia um trio falso contra o líquido zerado.
 * 23.140,00 − 694,20 = 22.445,80.
 */
const NOTA_DANFSE_CELULAS = [
  "DANFSe - Documento Auxiliar da NFS-e - Versao 2.0",
  "EMITENTE Construtora Anonimizada Ltda",
  "CNPJ 22.555.888/0001-72",
  "TOMADOR pessoa fisica CPF 987.654.321-00",
  "DISCRIMINACAO mao de obra de alvenaria e reboco do pavimento superior,",
  "sem fornecimento de material, conforme contrato de empreitada.",
  "Valor Total Apurado - IBS",
  "-",
  "Valor Total Apurado - CBS",
  "-",
  "VALOR TOTAL DA NFS-e VALOR DA OPERACAO / SERVICO",
  "R$ 23.140,00",
  "Desconto Incondicionado",
  "R$ 0,00",
  "Base de Calculo",
  "R$ 23.140,00",
  "Total das Retencoes (ISSQN / Federais)",
  "R$ 694,20",
  "VALOR LIQUIDO DA NFS-e",
  "R$ 22.445,80",
  "Total do IBS/CBS",
  "R$ 0,00",
  "VALOR LIQUIDO DA NFS-e + IBS/CBS",
  "R$ 0,00",
];

describe("o caminho da rota, com o unpdf REAL — NFS-e municipal", () => {
  it("rótulo e valor em linhas separadas (uma célula por par) viram sugestão", async () => {
    const lido = await extrairTextoDoPdf(pdfComTexto(NOTA_MUNICIPAL_CELULAS));

    expect(lido).not.toBeNull();
    // Confirma que o texto REAL do unpdf tem o valor na linha seguinte ao
    // rótulo — a premissa que a primeira versão do parser errou.
    expect(lido!.texto).toContain("ISSRF\n1.048,00");
    expect(avaliarTexto(lido!.texto).suficiente).toBe(true);

    expect(sugerirLinhaRetencao(lido!.texto, "destacada")).toEqual({
      rotuloLiteral: "ISSRF",
      valorCentavos: 104_800,
    });
  });

  it("o mesmo PDF com o gate ainda não respondido não produz sugestão", async () => {
    const lido = await extrairTextoDoPdf(pdfComTexto(NOTA_MUNICIPAL_CELULAS));

    expect(sugerirLinhaRetencao(lido!.texto, null)).toBeNull();
    expect(sugerirLinhaRetencao(lido!.texto, "nenhuma")).toBeNull();
  });
});

describe("o caminho da rota, com o unpdf REAL — DANFSe v2.0", () => {
  it("sugere a linha rotulada 'Total das Retencoes', apesar da palavra 'total'", async () => {
    const lido = await extrairTextoDoPdf(pdfComTexto(NOTA_DANFSE_CELULAS));

    expect(avaliarTexto(lido!.texto).suficiente).toBe(true);
    expect(sugerirLinhaRetencao(lido!.texto, "destacada")).toEqual({
      rotuloLiteral: "Total das Retencoes (ISSQN / Federais)",
      valorCentavos: 69_420,
    });
  });

  it("célula sem valor ('-' no lugar do número) não entra como linha rotulada", async () => {
    const lido = await extrairTextoDoPdf(pdfComTexto(NOTA_DANFSE_CELULAS));

    // "Valor Total Apurado - IBS" casa com /total/i e é seguido de "-": se
    // virasse par com o valor da célula seguinte, a conta usaria o número
    // errado.
    expect(lido!.texto).toContain("Valor Total Apurado - IBS\n-");
    expect(sugerirLinhaRetencao(lido!.texto, "destacada")?.valorCentavos).toBe(69_420);
  });
});
