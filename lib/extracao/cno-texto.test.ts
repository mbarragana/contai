/**
 * **CONTAI-069 — o parser do CNO impresso.**
 *
 * ⚠️ O que estes testes protegem não é uma conveniência: `cnoNaNota =
 * "desta_obra"` é o valor que faz uma nota entrar limpa em `baseCentavos`, proxy
 * da aferição do INSS. O `contador` reprovou a marcação automática **duas vezes**
 * (`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`, Pergunta 2 + ADENDO), e
 * o Mateus decidiu implementá-la mesmo assim
 * (`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`). As
 * salvaguardas testadas aqui — rótulo âncora obrigatório, 12 dígitos exatos,
 * ambiguidade nunca resolvida por palpite — são a contenção desse risco.
 *
 * ⚠️ **Nenhum dado real da obra aqui.** Os números são inventados; o que é real é
 * a ESTRUTURA linha-a-linha que o `unpdf` devolve de um DANFSe (um item de texto
 * por célula de tabela, medido no CONTAI-054).
 */

import { describe, expect, it } from "vitest";

import { extrairCandidatosCno } from "@/lib/extracao/cno-texto";

/** O cabeçalho comum de NFS-e — contexto, para nenhum teste medir texto nu. */
const CABECALHO = [
  "NOTA FISCAL DE SERVICOS ELETRONICA - NFS-e",
  "PRESTADOR Empreiteira Sintetica Construcoes Ltda",
  "CNPJ 11.222.333/0001-81",
  "TOMADOR pessoa fisica CPF 123.456.789-09",
];

function lerLinhas(linhas: string[]) {
  return extrairCandidatosCno(linhas.join("\n"));
}

describe("extrairCandidatosCno — o rótulo é obrigatório", () => {
  it("acha o número na MESMA linha do rótulo", () => {
    expect(lerLinhas([...CABECALHO, "CNO: 12.345.67890/26"])).toEqual([
      { rotuloLiteral: "CNO", numeroBruto: "12.345.67890/26" },
    ]);
  });

  /**
   * ⚠️ **O padrão DOMINANTE nas notas reais** (CONTAI-054, medido com o `unpdf`):
   * o PDF.js emite um item de texto por célula, então a célula visual
   * "CNO / número" chega como duas linhas consecutivas.
   */
  it("acha o número na linha SEGUINTE ao rótulo (célula de tabela)", () => {
    expect(
      lerLinhas([...CABECALHO, "Cadastro Nacional de Obras", "12.345.67890/26"]),
    ).toEqual([
      { rotuloLiteral: "Cadastro Nacional de Obras", numeroBruto: "12.345.67890/26" },
    ]);
  });

  it("aceita 'Matrícula CEI' e o 'CEI' solto das notas antigas", () => {
    expect(lerLinhas(["Matricula CEI 42.555.12345/19"])).toEqual([
      { rotuloLiteral: "Matricula CEI", numeroBruto: "42.555.12345/19" },
    ]);
    expect(lerLinhas(["CEI 42.555.12345/19"])).toEqual([
      { rotuloLiteral: "CEI", numeroBruto: "42.555.12345/19" },
    ]);
  });

  it("'Matrícula CEI' vence o 'CEI' solto no rótulo literal exibido", () => {
    // O rótulo que vai para a tela tem de ser o que está impresso no papel: é por
    // ele que o Mateus acha o número na nota.
    const achados = lerLinhas(["Matrícula CEI: 42.555.12345/19"]);
    expect(achados).toHaveLength(1);
    expect(achados[0].rotuloLiteral).toBe("Matrícula CEI");
  });

  /**
   * ⚠️ **A salvaguarda central do critério 2.** Doze dígitos soltos no texto não
   * são um CNO — são pedaço de código de barras, de inscrição municipal ou de
   * chave de acesso. Sem rótulo âncora: silêncio.
   */
  it("NÃO acha número sem rótulo, mesmo com 12 dígitos exatos", () => {
    expect(lerLinhas([...CABECALHO, "12.345.67890/26", "123456789026"])).toEqual([]);
  });

  it("'CEI' dentro de palavra não é rótulo", () => {
    expect(lerLinhas(["CEILANDIA 12.345.67890/26"])).toEqual([]);
  });

  it("rótulo sem número adjacente não vira candidato", () => {
    // O número aparece na linha, mas depois de outro campo: adjacência é o que
    // liga rótulo e valor, e aqui ela não existe.
    expect(lerLinhas(["CNO nao informado", "Inscricao Municipal", "123456789026"])).toEqual(
      [],
    );
  });

  it("só o PRIMEIRO número depois do rótulo conta", () => {
    // "CNO" seguido de um número que não é CNO encerra o assunto: continuar
    // procurando na linha acharia um número longe do rótulo — busca sem âncora.
    expect(lerLinhas(["CNO 001 Inscricao 12.345.67890/26"])).toEqual([]);
  });
});

describe("extrairCandidatosCno — exatamente 12 dígitos", () => {
  it("recusa CPF (11), CNPJ (14) e chave de acesso (44) rotulados como CNO", () => {
    expect(lerLinhas(["CNO 123.456.789-09"])).toEqual([]);
    expect(lerLinhas(["CNO 11.222.333/0001-81"])).toEqual([]);
    expect(
      lerLinhas(["CNO 4226 0900 0000 0000 0000 0000 0000 0000 0000 0000 0000"]),
    ).toEqual([]);
  });

  /**
   * ⚠️ **A maximalidade do número é o que impede o pior falso positivo deste
   * módulo**: casar 12 dígitos DENTRO de uma chave de acesso de 44. Aqui a chave
   * vem sem espaço, colada, como o `unpdf` costuma devolver.
   */
  it("não recorta 12 dígitos de dentro de uma chave de acesso de 44", () => {
    expect(
      lerLinhas(["Chave de acesso CNO 42260900000000000000000000000000000000000000"]),
    ).toEqual([]);
  });

  it("aceita o CNO sem pontuação nenhuma", () => {
    expect(lerLinhas(["CNO 123456789026"])).toEqual([
      { rotuloLiteral: "CNO", numeroBruto: "123456789026" },
    ]);
  });

  it("não engole o número seguinte da linha por causa do espaço", () => {
    // Espaço não é separador de CNO: sem essa regra, "…/26 - 1º Ofício" viraria um
    // candidato de 13 dígitos e o candidato legítimo morreria por tamanho.
    expect(lerLinhas(["CNO 12.345.67890/26 - 1o Oficio de Registro"])).toEqual([
      { rotuloLiteral: "CNO", numeroBruto: "12.345.67890/26" },
    ]);
  });
});

describe("extrairCandidatosCno — repetição não é ambiguidade", () => {
  /** Critério 10, mesma doutrina de colapso por valor idêntico do CONTAI-068. */
  it("colapsa candidatos com os MESMOS dígitos, e vence o primeiro do texto", () => {
    expect(
      lerLinhas([
        "CNO 12.345.67890/26",
        ...CABECALHO,
        "Matricula CEI 123456789026",
      ]),
    ).toEqual([{ rotuloLiteral: "CNO", numeroBruto: "12.345.67890/26" }]);
  });

  /**
   * Critério 9: dois números DIFERENTES ficam os dois na lista, na ordem do
   * texto. Escolher um deles aqui seria o palpite que o parecer proíbe — quem
   * decide é o Mateus, com o papel na mão.
   */
  it("devolve os DOIS candidatos quando os dígitos divergem", () => {
    expect(
      lerLinhas([
        ...CABECALHO,
        "Matricula CEI 98.765.43210/18",
        "CNO 12.345.67890/26",
      ]),
    ).toEqual([
      { rotuloLiteral: "Matricula CEI", numeroBruto: "98.765.43210/18" },
      { rotuloLiteral: "CNO", numeroBruto: "12.345.67890/26" },
    ]);
  });
});

/**
 * **A fixture "real anonimizada" do critério 18.** Reproduz o leiaute de um
 * DANFSe de verdade — bloco de identificação, uma célula por linha, o CNO no meio
 * do corpo da nota junto de outros números de 12+ dígitos — com todo número
 * trocado. Antes deste ticket nenhuma fixture do projeto tinha CNO.
 */
const DANFSE_COM_CNO = [
  "DANFSe - Documento Auxiliar da NFS-e",
  "Chave de Acesso 42260900000000000000000000000000000000000000",
  "Numero da NFS-e 1042 Serie 1 Emissao 20/03/2026",
  "PRESTADOR DE SERVICOS",
  "Empreiteira Sintetica Construcoes Ltda",
  "CNPJ/CPF 11.222.333/0001-81",
  "Inscricao Municipal 987654",
  "TOMADOR DE SERVICOS",
  "CNPJ/CPF 123.456.789-09",
  "OBRA / SERVICO PRESTADO",
  "CNO",
  "12.345.67890/26",
  "Codigo de Tributacao Nacional 07.02.00",
  "DISCRIMINACAO DOS SERVICOS",
  "Execucao de estrutura de concreto armado do pavimento terreo,",
  "conforme contrato de empreitada global.",
  "Valor Total",
  "52.400,00",
  "ISSRF",
  "1.048,00",
  "Valor Liquido",
  "51.352,00",
];

describe("extrairCandidatosCno — no leiaute de um DANFSe", () => {
  it("acha o CNO e nada mais, no meio de CNPJ, CPF, chave e código", () => {
    expect(lerLinhas(DANFSE_COM_CNO)).toEqual([
      { rotuloLiteral: "CNO", numeroBruto: "12.345.67890/26" },
    ]);
  });

  it("a mesma nota sem a célula do CNO não devolve nada", () => {
    const semCno = DANFSE_COM_CNO.filter(
      (linha) => linha !== "CNO" && linha !== "12.345.67890/26",
    );
    expect(lerLinhas(semCno)).toEqual([]);
  });
});
