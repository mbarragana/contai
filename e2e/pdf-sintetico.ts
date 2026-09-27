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

// ══ CONTAI-070 — o rótulo AMBÍGUO, que não pode sugerir categoria ═════════

/**
 * ⚠️ **O contraexemplo REAL do parecer, em forma de fixture** (nota 2 do
 * CONTAI-054; `docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`, Pergunta 1).
 *
 * A aritmética é a MESMA da nota acima — `52.400,00 − 1.048,00 = 51.352,00` —,
 * então a linha continua sendo sugerida (rótulo + valor) exatamente como sempre.
 * O que muda é só o rótulo: "Total das Retencoes (ISSQN / Federais)" cita ISSQN
 * **e** "Federais" na mesma string, e uma regra ingênua de palavra-chave o
 * classificaria como ISS puro — registrando como municipal uma retenção
 * parcialmente federal e calando a pendência de quem recolhe. Aqui os dois campos
 * de classificação têm de ficar VAZIOS, em silêncio.
 */
export const NFSE_COM_RETENCAO_AMBIGUA = [
  "NOTA FISCAL DE SERVICOS ELETRONICA - NFS-e",
  "PRESTADOR Empreiteira Sintetica Construcoes Ltda",
  "CNPJ 11.222.333/0001-81",
  "TOMADOR pessoa fisica CPF 123.456.789-09",
  "DISCRIMINACAO execucao de estrutura de concreto armado do pavimento",
  "terreo, conforme contrato de empreitada global.",
  "Valor Total",
  "52.400,00",
  "Total das Retencoes (ISSQN / Federais)",
  "1.048,00",
  "Valor Liquido",
  "51.352,00",
];

/** O que o parser tem de devolver para a nota ambígua: a linha, sem categoria. */
export const RETENCAO_AMBIGUA_ESPERADA = {
  rotulo: "Total das Retencoes (ISSQN / Federais)",
  valor: "1.048,00",
};

// ══ CONTAI-069 — o CNO impresso na nota ═══════════════════════════════════
//
// ⚠️ O CNO destas fixtures é o da obra do SEED (`OBRA_SEED.cno`, em
// `ambiente.ts`) — é a igualdade com ele que faz a sugestão existir. Mudar um
// sem o outro deixa a suíte vermelha no lugar certo.
//
// As três notas abaixo partem de `NFSE_SEM_PADRAO_RECONHECIVEL` de propósito:
// sem trio aritmético que feche, o gate de RETENÇÃO fica vazio e o único
// comportamento em jogo é o do CNO. Uma nota que sugerisse os dois gates
// misturaria os dois assuntos no mesmo assert.

/** O CNO da obra do seed, como o papel o imprimiria. */
export const CNO_DA_OBRA_SEED = "12.345.67890/26";

/** Outro CNO, com 12 dígitos e formato idêntico — só os dígitos divergem. */
export const CNO_DE_OUTRA_OBRA = "98.765.43210/18";

/**
 * A célula "CNO / número" em duas linhas, que é como o `unpdf` devolve uma
 * célula de tabela de DANFSe (medido no CONTAI-054).
 */
function notaComCno(...numeros: string[]) {
  return [
    "NOTA FISCAL DE SERVICOS ELETRONICA - NFS-e",
    "PRESTADOR Empreiteira Sintetica Construcoes Ltda",
    "CNPJ 11.222.333/0001-81",
    "TOMADOR pessoa fisica CPF 123.456.789-09",
    "DISCRIMINACAO execucao de estrutura de concreto armado do pavimento",
    "terreo, conforme contrato de empreitada global.",
    ...numeros.flatMap((numero, i) => [i === 0 ? "CNO" : "Matricula CEI", numero]),
    "Valor Total",
    "52.400,00",
    "Retencoes diversas",
    "1.048,00",
    "Valor Liquido",
    "49.900,00",
  ];
}

/** Traz o CNO da obra do seed, dígito por dígito: a sugestão tem de nascer. */
export const NFSE_COM_CNO_DESTA_OBRA = notaComCno(CNO_DA_OBRA_SEED);

/**
 * Traz um CNO de 12 dígitos que NÃO é o da obra. Gate vazio + os dois números na
 * tela com "— números diferentes" (critério 7).
 */
export const NFSE_COM_CNO_DE_OUTRA_OBRA = notaComCno(CNO_DE_OUTRA_OBRA);

/**
 * Cita DOIS CNOs com dígitos diferentes — o caso do pre-mortem 2 (nota que
 * referencia um contrato anterior). Aviso explícito, nunca escolha automática,
 * **mesmo com um dos dois batendo** com a obra.
 */
export const NFSE_COM_DOIS_CNOS = notaComCno(CNO_DE_OUTRA_OBRA, CNO_DA_OBRA_SEED);

/**
 * A MESMA nota sem trio que feche: o líquido não é `total − ISSRF`. Texto
 * suficiente (âncoras e volume batem), padrão reconhecido nenhum — é o caso
 * "nota sem padrão" do critério 3, e não um caso de erro.
 *
 * ⚠️ **Também é a nota SEM CNO nenhum** desde o CONTAI-069: nenhum rótulo de CNO
 * no texto, então nem sugestão nem banner — o silêncio do critério 8.
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
