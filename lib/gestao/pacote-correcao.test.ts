import { describe, expect, it } from "vitest";

import {
  lerAnexoDoPacote,
  lerPacote,
  ORDEM_DO_PACOTE,
  proximaDoPacote,
  textoContinuar,
  textoPular,
} from "./pacote-correcao";

/**
 * CONTAI-088 — o roteador do pacote de correções.
 *
 * O que estes testes travam é a parte que, errada, gravaria no documento errado
 * ou perderia o papel no meio do caminho: a whitelist, a ordem fixa, o
 * `?pacote=` vazio (que distingue "pacote acabou" de "não há pacote") e o path
 * do acervo chegando inteiro do outro lado.
 */

const DOC = "11111111-1111-4111-8111-111111111111";
const PAPEL = "f0f0/documento/9a-nfse-263 (2).pdf";

const params = (busca: string) => new URLSearchParams(busca);

describe("lerPacote", () => {
  it("sem `?pacote` devolve null — a rota se comporta como antes do ticket", () => {
    expect(lerPacote(params(""))).toBeNull();
    expect(lerPacote(params("?anexo=x"))).toBeNull();
  });

  it("`?pacote=` vazio é pacote que ACABOU, não ausência de pacote", () => {
    expect(lerPacote(params("?pacote="))).toEqual([]);
  });

  it("lê os tokens conhecidos e os devolve na ordem canônica", () => {
    expect(lerPacote(params("?pacote=retencao,numero"))).toEqual([
      "numero",
      "retencao",
    ]);
    expect(lerPacote(params("?pacote=valor"))).toEqual(["valor"]);
  });

  it("ignora lixo em silêncio — querystring digitada à mão não derruba a tela", () => {
    expect(lerPacote(params("?pacote=valor,obra,DROP TABLE,retencao"))).toEqual([
      "valor",
      "retencao",
    ]);
    expect(lerPacote(params("?pacote=xpto"))).toEqual([]);
  });

  it("tolera espaço em volta do token", () => {
    expect(lerPacote(params("?pacote=%20valor%20,%20retencao"))).toEqual([
      "valor",
      "retencao",
    ]);
  });

  it("token repetido não vira duas passagens pela mesma correção", () => {
    expect(lerPacote(params("?pacote=valor,valor,valor"))).toEqual(["valor"]);
  });
});

describe("lerAnexoDoPacote", () => {
  it("devolve o path inteiro, com barra e espaço, como ele foi encodado", () => {
    const busca = new URLSearchParams({ anexo: PAPEL });
    expect(lerAnexoDoPacote(busca)).toBe(PAPEL);
  });

  it("ausente e vazio são a mesma coisa: nenhuma indicação de papel", () => {
    expect(lerAnexoDoPacote(params(""))).toBeNull();
    expect(lerAnexoDoPacote(params("?anexo="))).toBeNull();
    expect(lerAnexoDoPacote(params("?anexo=%20%20"))).toBeNull();
  });
});

describe("proximaDoPacote", () => {
  it("sem pacote não há próxima", () => {
    expect(proximaDoPacote(DOC, null, null)).toBeNull();
  });

  it("pacote vazio não há próxima — era a última correção", () => {
    expect(proximaDoPacote(DOC, [], PAPEL)).toBeNull();
  });

  it("a primeira da ORDEM vence, não a primeira da lista recebida", () => {
    const proxima = proximaDoPacote(DOC, ["retencao", "valor"], null)!;
    expect(proxima.correcao).toBe("valor");
    expect(proxima.rotulo).toBe("o valor");
  });

  it("o href carrega o RESTO do pacote e o papel usado neste ato", () => {
    const proxima = proximaDoPacote(DOC, ["valor", "retencao"], PAPEL)!;
    expect(proxima.href.startsWith(`/documento/${DOC}/corrigir/valor?`)).toBe(true);
    const query = new URLSearchParams(proxima.href.split("?")[1]);
    expect(query.get("pacote")).toBe("retencao");
    // O path do acervo volta inteiro do outro lado — é o que a próxima tela
    // compara com `carregarAnexosDoDocumento`.
    expect(query.get("anexo")).toBe(PAPEL);
  });

  it("⚠️ `pacote` continua na URL mesmo VAZIO na última correção", () => {
    const proxima = proximaDoPacote(DOC, ["retencao"], null)!;
    const query = new URLSearchParams(proxima.href.split("?")[1]);
    // Sem esta linha, a última correção do pacote acharia que nunca houve
    // pacote — e o rodapé dela voltaria a ser o de hoje no meio do fluxo.
    expect(query.get("pacote")).toBe("");
    expect(query.get("anexo")).toBe("");
  });

  it("sem papel usado, o `?anexo` vai vazio — nunca a string 'null'", () => {
    const proxima = proximaDoPacote(DOC, ["numero", "valor"], null)!;
    expect(proxima.href).toContain("anexo=");
    expect(proxima.href).not.toContain("null");
  });

  it("percorrer o pacote inteiro esvazia a fila na ordem fixa", () => {
    const visitadas: string[] = [];
    let pacote = [...ORDEM_DO_PACOTE];
    for (let volta = 0; volta < 10; volta++) {
      const proxima = proximaDoPacote(DOC, pacote, PAPEL);
      if (proxima === null) break;
      visitadas.push(proxima.correcao);
      pacote = lerPacote(new URLSearchParams(proxima.href.split("?")[1]))!;
    }
    expect(visitadas).toEqual(["numero", "valor", "retencao"]);
    expect(pacote).toEqual([]);
  });
});

describe("os textos dos botões de avanço", () => {
  it("são os do spec, com o artigo certo em cada correção", () => {
    const comArtigo = (c: "numero" | "valor" | "retencao") =>
      proximaDoPacote(DOC, [c], null)!;
    expect(textoContinuar(comArtigo("numero"))).toBe(
      "Continuar: corrigir o número →",
    );
    expect(textoContinuar(comArtigo("retencao"))).toBe(
      "Continuar: corrigir a retenção →",
    );
    expect(textoPular(comArtigo("valor"))).toBe(
      "Pular esta e continuar: corrigir o valor →",
    );
  });
});
