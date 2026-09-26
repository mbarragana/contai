/**
 * **Um PDF de verdade, com camada de texto, montado no teste.** CONTAI-055.
 *
 * Por que existe: a sugestão de retenção (`POST /api/sugerir-retencao`) só sai
 * de PDF com TEXTO EMBUTIDO — `unpdf` real, heurística de suficiência real,
 * parser real. Um `Buffer.from("%PDF-1.4 nf")`, que é o anexo dos outros testes
 * desta suíte, não produz sugestão nenhuma (e por isso continua servindo ao caso
 * "sem sugestão"). Stubar a nossa própria rota para "provar" o caminho feliz
 * validaria a suposição de quem escreveu o teste, não o sistema — a mesma regra
 * dura de E2E do `CLAUDE.md`, aplicada à camada de cima.
 *
 * ⚠️ **Terceira cópia consciente deste construtor** — as outras duas estão em
 * `lib/extracao/texto-pdf-real.test.ts` e `retencao-texto-real.test.ts`, e a
 * duplicação é deliberada ali pelo mesmo motivo que aqui: nenhum dos três
 * arquivos deve depender do outro, e trazer uma lib de geração de PDF só para o
 * teste adicionaria dependência de dev para provar dependência de produção.
 *
 * Nada de dado real da obra: CNPJ, CPF, nomes e valores são sintéticos — só
 * precisam ter a FORMA que as âncoras da heurística procuram.
 */

/** 5 objetos, Helvetica padrão, fluxo de conteúdo sem compressão. */
export function pdfComTexto(linhas: string[]): Buffer {
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

  // `latin1`: cada caractere vira exatamente 1 byte, que é o que os offsets da
  // xref contam. UTF-8 desalinharia a tabela e o PDF não abriria.
  return Buffer.from(pdf, "latin1");
}

/**
 * NFS-e municipal, uma célula por linha — a ESTRUTURA medida nas notas reais do
 * CONTAI-054 (o PDF.js emite um item de texto por célula, então rótulo e valor
 * chegam em linhas consecutivas).
 *
 * A aritmética é o que faz a sugestão existir: `52.400,00 − 1.048,00 =
 * 51.352,00`, e a linha que sobra se chama **ISSRF**.
 */
export const NFSE_COM_RETENCAO_RECONHECIVEL = [
  "NOTA FISCAL DE SERVICOS ELETRONICA - NFS-e",
  "PRESTADOR Empreiteira Sintetica Construcoes Ltda",
  "CNPJ 11.222.333/0001-81",
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

/** O que o parser tem de devolver para a nota acima. */
export const RETENCAO_ESPERADA = { rotulo: "ISSRF", valor: "1.048,00" };

/**
 * A MESMA nota sem trio que feche: o líquido não é `total − ISSRF`. Texto
 * suficiente (âncoras e volume batem), padrão reconhecido nenhum — é o caso
 * "nota sem padrão" do critério 3, e não um caso de erro.
 */
export const NFSE_SEM_PADRAO_RECONHECIVEL = [
  "NOTA FISCAL DE SERVICOS ELETRONICA - NFS-e",
  "PRESTADOR Empreiteira Sintetica Construcoes Ltda",
  "CNPJ 11.222.333/0001-81",
  "TOMADOR pessoa fisica CPF 123.456.789-09",
  "DISCRIMINACAO execucao de estrutura de concreto armado do pavimento",
  "terreo, conforme contrato de empreitada global.",
  "Valor Total",
  "52.400,00",
  "Retencoes diversas",
  "1.048,00",
  "Valor Liquido",
  "49.900,00",
];
