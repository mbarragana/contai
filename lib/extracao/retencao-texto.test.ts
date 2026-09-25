/**
 * CONTAI-054. Fixtures de TEXTO anonimizadas, no padrão de
 * `texto-pdf-real.test.ts`: nenhum CNPJ, CPF, razão social, CNO ou valor real
 * da obra entra aqui — só a ESTRUTURA dos dois layouts reais observados
 * (backlog 71 e a revisão de 2026-09-25 do ticket).
 *
 * O teste que carrega o ticket é o segundo (`FIXTURE_DANFSE_AMBIGUA`): os
 * rótulos-chamariz vêm ANTES dos de verdade de propósito, então uma
 * implementação "primeiro rótulo com total × primeiro com líquido" reprova
 * nele em vez de passar por sorte.
 */

import { describe, expect, it } from "vitest";

import {
  LIMITE_CARACTERES_ROTULO,
  sugerirLinhaRetencao,
} from "@/lib/extracao/retencao-texto";

/**
 * Exemplo 1 — NFS-e municipal (padrão comum em prefeituras de SC), Simples
 * Nacional com ISS retido pelo tomador. Um "total", um "líquido", e a terceira
 * linha rotulada "ISSRF": 24.000,00 − 480,00 = 23.520,00.
 */
const FIXTURE_MUNICIPAL_SIMPLES = [
  "NOTA FISCAL DE SERVICOS ELETRONICA - NFS-e",
  "Numero 2481   Emissao 04/09/2026   Competencia 09/2026",
  "PRESTADOR Empreiteira Anonimizada Ltda   CNPJ 11.444.777/0001-61",
  "TOMADOR pessoa fisica   CPF 123.456.789-09",
  "Discriminacao execucao de estrutura de concreto armado do pavimento terreo",
  "Regime Simples Nacional   Aliquota ISS 2,00%",
  "Valor Total ............... R$ 24.000,00",
  "ISSRF ..................... R$ 480,00",
  "Valor Liquido ............. R$ 23.520,00",
].join("\n");

/**
 * Exemplo 2 — DANFSe v2.0 / NFS-e Nacional. DOIS rótulos com "total" e DOIS
 * com "líquido" na mesma nota; os da reforma tributária (IBS/CBS) estão
 * zerados porque o campo ainda não é vigente. Só a combinação
 * (VALOR TOTAL DA NFS-e, VALOR LIQUIDO DA NFS-e) fecha contra "ISS RETIDO":
 * 31.600,00 − 632,00 = 30.968,00.
 */
const FIXTURE_DANFSE_AMBIGUA = [
  "DANFSe - Documento Auxiliar da NFS-e   Versao 2.0",
  "Emitente Construtora Anonimizada Ltda   CNPJ 22.555.888/0001-72",
  "Tomador pessoa fisica   CPF 987.654.321-00",
  "Servico mao de obra de alvenaria e reboco, sem fornecimento de material",
  "Aliquota ISS 2,00%",
  // Chamarizes primeiro: é o que quebra a versao ingenua.
  "Tributos IBS/CBS - Valor Total Apurado     R$ 0,00",
  "VALOR LIQUIDO DA NFS-e + IBS/CBS           R$ 0,00",
  "VALOR TOTAL DA NFS-e                       R$ 31.600,00",
  "ISS RETIDO                                 R$ 632,00",
  "VALOR LIQUIDO DA NFS-e                     R$ 30.968,00",
].join("\n");

describe("sugerirLinhaRetencao — o gate manda, e o parser nunca o decide", () => {
  it("gate null devolve null, mesmo com a nota inteira legível (critério 1)", () => {
    expect(sugerirLinhaRetencao(FIXTURE_MUNICIPAL_SIMPLES, null)).toBeNull();
  });

  it("gate 'nenhuma' devolve null — a leitura não contradiz o Mateus", () => {
    // Gate Fiscal 1: o gate é fato afirmado por ele. Se disse "nenhuma", o
    // texto não tem voto, nem para discordar nem para "avisar".
    expect(sugerirLinhaRetencao(FIXTURE_DANFSE_AMBIGUA, "nenhuma")).toBeNull();
  });
});

describe("sugerirLinhaRetencao — padrão estruturado reconhecido", () => {
  it("lê rótulo e valor da NFS-e municipal (um total, um líquido, uma terceira linha)", () => {
    expect(sugerirLinhaRetencao(FIXTURE_MUNICIPAL_SIMPLES, "destacada")).toEqual({
      rotuloLiteral: "ISSRF",
      valorCentavos: 48_000,
    });
  });

  it("DANFSe v2.0 com DOIS 'total' e DOIS 'líquido': só a combinação que fecha vale", () => {
    // O teste central do ticket. "Primeiro que achar" pegaria
    // (Valor Total Apurado = 0,00) × (VALOR LIQUIDO + IBS/CBS = 0,00) e
    // devolveria null — ou, pior, um valor de outra linha.
    expect(sugerirLinhaRetencao(FIXTURE_DANFSE_AMBIGUA, "destacada")).toEqual({
      rotuloLiteral: "ISS RETIDO",
      valorCentavos: 63_200,
    });
  });

  it("não confunde alíquota com valor: '2,00%' não entra como linha rotulada", () => {
    // Se "2,00" contasse como valor, o rótulo de "632,00" viraria "%" e a
    // candidata certa desapareceria. As duas fixtures têm alíquota impressa e
    // as duas passam — esta asserção só nomeia o motivo.
    const texto = [
      "Valor Total .............. R$ 1.000,00",
      "ISS Retido (2,00%) ....... R$ 20,00",
      "Valor Liquido ............ R$ 980,00",
    ].join("\n");

    expect(sugerirLinhaRetencao(texto, "destacada")).toEqual({
      rotuloLiteral: "ISS Retido (2,00%)",
      valorCentavos: 2_000,
    });
  });

  it("vários pares na MESMA linha (texto de layout tabular) são lidos separados", () => {
    const texto = "Valor Total 5.000,00   ISSRF 100,00   Valor Liquido 4.900,00";

    expect(sugerirLinhaRetencao(texto, "destacada")).toEqual({
      rotuloLiteral: "ISSRF",
      valorCentavos: 10_000,
    });
  });

  it("total repetido com rótulos diferentes e MESMO valor é repetição, não ambiguidade", () => {
    // Duas combinações fecham, mas apontam para a mesma terceira linha — a
    // resposta é única, então sugerir é o certo. Recusar aqui recusaria quase
    // toda nota real, que imprime o total mais de uma vez.
    const texto = [
      "VALOR TOTAL DOS SERVICOS ..... R$ 24.000,00",
      "VALOR TOTAL DA NOTA .......... R$ 24.000,00",
      "ISSRF ........................ R$ 480,00",
      "VALOR LIQUIDO ................ R$ 23.520,00",
    ].join("\n");

    expect(sugerirLinhaRetencao(texto, "destacada")).toEqual({
      rotuloLiteral: "ISSRF",
      valorCentavos: 48_000,
    });
  });
});

describe("sugerirLinhaRetencao — rótulo e valor em linhas separadas", () => {
  // O padrão DOMINANTE no texto real (medição de 2026-09-25 com o `unpdf` nas
  // duas notas do ticket): o PDF.js emite um item de texto por célula, então a
  // célula "Valor Total / 21.430,00" chega como duas linhas.
  const CELULAS = [
    "Valor Total",
    "21.430,00",
    "Desc. Incondicional",
    "0,00",
    "ISSRF",
    "987,00",
    "IR",
    "0,00",
    "Valor Liquido",
    "20.443,00",
  ];

  it("pareia rótulo com o valor da linha seguinte", () => {
    expect(sugerirLinhaRetencao(CELULAS.join("\n"), "destacada")).toEqual({
      rotuloLiteral: "ISSRF",
      valorCentavos: 98_700,
    });
  });

  it("linha em branco entre rótulo e valor não quebra o par", () => {
    const comRuido = CELULAS.flatMap((linha) => [linha, ""]).join("\n");

    expect(sugerirLinhaRetencao(comRuido, "destacada")).toEqual({
      rotuloLiteral: "ISSRF",
      valorCentavos: 98_700,
    });
  });

  it("todos os rótulos e DEPOIS todos os valores não vira par nenhum", () => {
    // Aqui adjacência não significa correspondência: casar "Valor Liquido" com
    // o primeiro número da pilha produziria um par errado por um fator grande.
    // Sem sugestão é a resposta certa.
    const empilhado = [
      "Valor Total",
      "ISSRF",
      "Valor Liquido",
      "21.430,00",
      "987,00",
      "20.443,00",
    ].join("\n");

    expect(sugerirLinhaRetencao(empilhado, "destacada")).toBeNull();
  });

  it("rótulo com valor na própria linha não é pareado também com a linha seguinte", () => {
    const misturado = [
      "Valor Total ....... R$ 10.000,00",
      "250,00",
      "ISSRF ............. R$ 250,00",
      "Valor Liquido ..... R$ 9.750,00",
    ].join("\n");

    // Se "Valor Total" fosse pareado duas vezes (10.000,00 e 250,00), o segundo
    // par entraria como um "total" de 250,00 — lixo na busca combinatória.
    expect(sugerirLinhaRetencao(misturado, "destacada")).toEqual({
      rotuloLiteral: "ISSRF",
      valorCentavos: 25_000,
    });
  });
});

describe("sugerirLinhaRetencao — o vocabulário do rótulo não decide papel", () => {
  it("a linha de retenção pode se chamar 'Total das Retenções' (nota 2 real)", () => {
    const texto = [
      "VALOR TOTAL DA NFS-e",
      "R$ 23.140,00",
      "Total das Retencoes (ISSQN / Federais)",
      "R$ 694,20",
      "VALOR LIQUIDO DA NFS-e",
      "R$ 22.445,80",
    ].join("\n");

    expect(sugerirLinhaRetencao(texto, "destacada")).toEqual({
      rotuloLiteral: "Total das Retencoes (ISSQN / Federais)",
      valorCentavos: 69_420,
    });
  });

  it("líquido zerado da reforma tributária não cria ambiguidade com a base de cálculo", () => {
    // Sem a guarda de "líquido > 0", a combinação (total, líquido zerado) daria
    // diferença = total, a "Base de Calculo" fecharia um segundo trio e a nota
    // inteira cairia por ambiguidade inventada.
    const texto = [
      "VALOR TOTAL DA NFS-e",
      "R$ 23.140,00",
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
    ].join("\n");

    expect(sugerirLinhaRetencao(texto, "destacada")).toEqual({
      rotuloLiteral: "Total das Retencoes (ISSQN / Federais)",
      valorCentavos: 69_420,
    });
  });
});

describe("sugerirLinhaRetencao — tolerância de arredondamento (Gate Fiscal 4)", () => {
  function comDiferenca(centavosDeSobra: number): string {
    const liquido = (10_000_00 - 250_00 + centavosDeSobra) / 100;
    return [
      "Valor Total ....... R$ 10.000,00",
      "Retencao .......... R$ 250,00",
      `Valor Liquido ..... R$ ${liquido.toFixed(2).replace(".", ",")}`,
    ].join("\n");
  }

  it("1 centavo de diferença ainda bate", () => {
    expect(sugerirLinhaRetencao(comDiferenca(1), "destacada")).toEqual({
      rotuloLiteral: "Retencao",
      valorCentavos: 25_000,
    });
  });

  it("2 centavos de diferença não bate — sem sugestão nenhuma", () => {
    expect(sugerirLinhaRetencao(comDiferenca(2), "destacada")).toBeNull();
  });
});

describe("sugerirLinhaRetencao — dúvida sempre vira null", () => {
  it("nenhuma combinação fecha: a conta não bate com linha nenhuma", () => {
    const texto = [
      "Valor Total ....... R$ 10.000,00",
      "ISS (2%) .......... R$ 200,00",
      "Valor Liquido ..... R$ 9.000,00",
    ].join("\n");

    expect(sugerirLinhaRetencao(texto, "destacada")).toBeNull();
  });

  it("dois rótulos diferentes com o valor da diferença: ambiguidade genuína", () => {
    // Estruturalmente indecidível qual dos dois copiar — e "melhor palpite" é
    // exatamente o que o critério 2 proíbe.
    const texto = [
      "Valor Total ............... R$ 10.000,00",
      "ISSRF ..................... R$ 500,00",
      "Desconto Condicional ...... R$ 500,00",
      "Valor Liquido ............. R$ 9.500,00",
    ].join("\n");

    expect(sugerirLinhaRetencao(texto, "destacada")).toBeNull();
  });

  it("dois trios independentes fechando (nota + fatura na mesma folha) vira null", () => {
    const texto = [
      "Valor Total dos Servicos .... R$ 18.000,00",
      "ISSRF ....................... R$ 360,00",
      "Valor Liquido ............... R$ 17.640,00",
      "Valor Total da Fatura ....... R$ 20.000,00",
      "Retencao Contratual ......... R$ 1.000,00",
      "Valor Liquido a Pagar ....... R$ 19.000,00",
    ].join("\n");

    expect(sugerirLinhaRetencao(texto, "destacada")).toBeNull();
  });

  it("sem rótulo com 'líquido' não há conta para fechar", () => {
    const texto = [
      "Valor Total ....... R$ 10.000,00",
      "ISSRF ............. R$ 200,00",
      "A receber ......... R$ 9.800,00",
    ].join("\n");

    expect(sugerirLinhaRetencao(texto, "destacada")).toBeNull();
  });

  it("linha com valor zerado nunca é sugerida, mesmo com total = líquido", () => {
    const texto = [
      "Valor Total ....... R$ 10.000,00",
      "ISSRF ............. R$ 0,00",
      "Valor Liquido ..... R$ 10.000,00",
    ].join("\n");

    expect(sugerirLinhaRetencao(texto, "destacada")).toBeNull();
  });

  it("líquido maior que o total (papéis trocados) não produz sugestão", () => {
    const texto = [
      "Valor Total ....... R$ 9.500,00",
      "Acrescimo ......... R$ 500,00",
      "Valor Liquido ..... R$ 10.000,00",
    ].join("\n");

    expect(sugerirLinhaRetencao(texto, "destacada")).toBeNull();
  });

  it("texto vazio devolve null", () => {
    expect(sugerirLinhaRetencao("", "destacada")).toBeNull();
  });

  it("frase longa terminando em valor não vira rótulo", () => {
    const frase =
      "Discriminacao dos servicos prestados conforme contrato de empreitada global";
    expect(frase.length).toBeGreaterThan(LIMITE_CARACTERES_ROTULO);

    const texto = [
      "Valor Total ....... R$ 10.000,00",
      `${frase} R$ 500,00`,
      "Valor Liquido ..... R$ 9.500,00",
    ].join("\n");

    // A candidata existe aritmeticamente, mas o "rótulo" é frase — sugerir
    // isso seria dar trabalho de apagar, não de confirmar.
    expect(sugerirLinhaRetencao(texto, "destacada")).toBeNull();
  });

  it("valor sem rótulo nenhum antes dele é ignorado", () => {
    const texto = [
      "Valor Total ....... R$ 10.000,00",
      "   500,00",
      "Valor Liquido ..... R$ 9.500,00",
    ].join("\n");

    expect(sugerirLinhaRetencao(texto, "destacada")).toBeNull();
  });
});

describe("sugerirLinhaRetencao — o que ela NUNCA devolve (critério 3 / Gate Fiscal 2)", () => {
  it("a sugestão tem exatamente dois campos: rótulo e valor", () => {
    const sugestao = sugerirLinhaRetencao(FIXTURE_DANFSE_AMBIGUA, "destacada");

    expect(sugestao).not.toBeNull();
    // Os quatro campos de classificação fiscal não existem no tipo — esta
    // asserção é a trava em runtime contra alguém "aproveitar" o objeto para
    // carregar `composicao` num campo extra.
    expect(Object.keys(sugestao!).sort()).toEqual(["rotuloLiteral", "valorCentavos"]);
    for (const proibido of [
      "composicao",
      "tributo",
      "eDescontoEfetivo",
      "quemRecolhe",
      "confianca",
    ]) {
      expect(sugestao).not.toHaveProperty(proibido);
    }
  });
});
