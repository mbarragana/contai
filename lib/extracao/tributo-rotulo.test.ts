/**
 * **CONTAI-070, critério 12 — o corpus é a única defesa deste ticket.**
 *
 * O peso desproporcional deste arquivo em relação ao código que ele testa é
 * deliberado (Viabilidade/CTO): a função é curta, mas o que ela faz é classificar
 * texto livre contra taxonomia legal — a operação que o `contador` reprovou "sem
 * exceção" (`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`, Pergunta 1) e
 * que o Mateus decidiu implementar mesmo assim
 * (`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`, ADENDO).
 * Classificação errada aqui viraria `composicao = "tributo_identificado"` com o
 * tributo errado, e a pendência de recolhimento certa calaria em silêncio.
 *
 * Rótulos INVENTADOS com a forma dos reais: nenhum dado da obra entra aqui.
 */

import { describe, expect, it } from "vitest";

import { sugerirTributoDoRotulo } from "@/lib/extracao/tributo-rotulo";

describe("sugerirTributoDoRotulo — rótulo inequívoco de UMA categoria", () => {
  it("reconhece as 6 categorias por rótulo exclusivo", () => {
    // Critério 12: as seis, uma a uma, com as grafias que as notas imprimem.
    expect(sugerirTributoDoRotulo(["Valor ISS"])).toBe("iss");
    expect(sugerirTributoDoRotulo(["ISSRF"])).toBe("iss");
    expect(sugerirTributoDoRotulo(["ISSQN"])).toBe("iss");
    expect(sugerirTributoDoRotulo(["ISS Retido (2,00%)"])).toBe("iss");
    expect(sugerirTributoDoRotulo(["INSS Retido"])).toBe("inss");
    expect(sugerirTributoDoRotulo(["IR"])).toBe("irrf");
    expect(sugerirTributoDoRotulo(["IRRF"])).toBe("irrf");
    expect(sugerirTributoDoRotulo(["Valor IRPJ"])).toBe("irrf");
    expect(sugerirTributoDoRotulo(["PIS"])).toBe("pis");
    expect(sugerirTributoDoRotulo(["COFINS"])).toBe("cofins");
    expect(sugerirTributoDoRotulo(["CSLL"])).toBe("csll");
  });

  /**
   * ⚠️ **Pre-mortem 2 — a colisão que a fronteira de palavra impede.** "INSS" e
   * "ISS" compartilham três letras, e um `/ISS/i` solto casaria dentro de "INSS":
   * a nota diria INSS e o app gravaria ISS, o que troca de esfera (municipal ×
   * federal) e, com ela, quem recolhe.
   */
  it("INSS não é ISS, e ISS não é INSS — fronteira de palavra, não substring", () => {
    expect(sugerirTributoDoRotulo(["INSS"])).toBe("inss");
    expect(sugerirTributoDoRotulo(["INSS Retido"])).toBe("inss");
    expect(sugerirTributoDoRotulo(["Valor do INSS descontado"])).toBe("inss");
    expect(sugerirTributoDoRotulo(["Valor ISS"])).not.toBe("inss");
    expect(sugerirTributoDoRotulo(["ISSRF"])).not.toBe("inss");
  });

  /** O singular não é marcador de combinação: ali há um tributo nomeado. */
  it("'Retenção de ISS' (singular, uma categoria) continua sugerindo", () => {
    expect(sugerirTributoDoRotulo(["Retenção de ISS"])).toBe("iss");
    expect(sugerirTributoDoRotulo(["ISS Retido na Fonte"])).toBe("iss");
  });

  /**
   * Critério 2 — o conjunto EMPATADO do `CONTAI-068`: "Valor ISS" (bloco do item)
   * e "ISSRF" (resumo financeiro) imprimem o mesmo número e colapsam numa linha
   * só. Os dois nomeiam a mesma categoria, então a sugestão existe.
   */
  it("rótulos empatados da MESMA categoria sugerem essa categoria", () => {
    expect(sugerirTributoDoRotulo(["Valor ISS", "ISSRF"])).toBe("iss");
    expect(sugerirTributoDoRotulo(["ISSRF", "ISS Retido Fonte"])).toBe("iss");
  });
});

describe("sugerirTributoDoRotulo — ambiguidade vira null, nunca melhor palpite", () => {
  /**
   * ⚠️ **O contraexemplo real do parecer, e é ele que este ticket existe para não
   * errar** (`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`, Pergunta 1;
   * ADENDO 6/7 do parecer de 2026-09-18). Uma regra ingênua de palavra-chave leria
   * "ISSQN" e classificaria como ISS puro — uma retenção parcialmente FEDERAL
   * registrada como puramente municipal, com a pendência de "quem recolhe" calada
   * em silêncio. Este teste é o critério 3 do ticket em forma executável.
   */
  it("'Total das Retenções (ISSQN / Federais)' NUNCA sugere categoria nenhuma", () => {
    expect(
      sugerirTributoDoRotulo(["Total das Retenções (ISSQN / Federais)"]),
    ).toBeNull();
    // A mesma nota sem acentuação (como o `unpdf` às vezes devolve) tem de dar o
    // mesmo resultado — o `ç` e o `õ` não podem ser o que segura a salvaguarda.
    expect(
      sugerirTributoDoRotulo(["Total das Retencoes (ISSQN / Federais)"]),
    ).toBeNull();
  });

  it("duas siglas na mesma string não escolhem uma delas", () => {
    expect(sugerirTributoDoRotulo(["ISS/INSS"])).toBeNull();
    expect(sugerirTributoDoRotulo(["ISS + INSS"])).toBeNull();
    expect(sugerirTributoDoRotulo(["IRRF e CSLL"])).toBeNull();
    expect(sugerirTributoDoRotulo(["PIS/COFINS/CSLL"])).toBeNull();
  });

  /**
   * Critério 4 — PIS, COFINS e CSLL são reconhecidos **individualmente**. Rótulo
   * de GRUPO (o 4,65% combinado, não aberto pela nota) cai na regra do marcador de
   * combinação e não sugere nada: é o comportamento seguro do pre-mortem 3, não um
   * buraco de cobertura.
   */
  it("rótulo de grupo federal não vira categoria", () => {
    expect(sugerirTributoDoRotulo(["CSRF"])).toBeNull();
    expect(sugerirTributoDoRotulo(["Retenções Federais"])).toBeNull();
    expect(sugerirTributoDoRotulo(["Contribuições Sociais Retidas"])).toBeNull();
    expect(sugerirTributoDoRotulo(["Tributos Federais Retidos"])).toBeNull();
    expect(sugerirTributoDoRotulo(["Total das Retenções"])).toBeNull();
  });

  /**
   * Critério 3(b) — o conjunto empatado é uma CONJUNÇÃO: se dois rótulos com o
   * mesmo valor apontam para categorias diferentes, não há o que sugerir. Ler só o
   * primeiro rótulo (o que a resposta da rota devolvia antes deste ticket) daria
   * "iss" aqui, escolhendo por ordem de impressão.
   */
  it("rótulos empatados de categorias DIFERENTES não sugerem nada", () => {
    expect(sugerirTributoDoRotulo(["Valor ISS", "INSS Retido"])).toBeNull();
    expect(sugerirTributoDoRotulo(["IRRF", "CSLL"])).toBeNull();
    // E a ordem inversa dá o mesmo — a regra não tem lado preferido.
    expect(sugerirTributoDoRotulo(["INSS Retido", "Valor ISS"])).toBeNull();
  });

  /** Um rótulo combinado contamina o conjunto inteiro, mesmo ao lado de um limpo. */
  it("um único rótulo com marcador de combinação zera o conjunto", () => {
    expect(
      sugerirTributoDoRotulo(["Valor ISS", "Total das Retenções (ISSQN)"]),
    ).toBeNull();
  });
});

describe("sugerirTributoDoRotulo — sem palavra-chave reconhecida, silêncio", () => {
  it("rótulo genérico de retenção não nomeia tributo nenhum", () => {
    expect(sugerirTributoDoRotulo(["Retencao"])).toBeNull();
    expect(sugerirTributoDoRotulo(["Retenção Contratual"])).toBeNull();
    expect(sugerirTributoDoRotulo(["Desconto Condicional"])).toBeNull();
    expect(sugerirTributoDoRotulo(["Valor Retido"])).toBeNull();
    expect(sugerirTributoDoRotulo(["CPP"])).toBeNull();
    expect(sugerirTributoDoRotulo(["Outras deducoes"])).toBeNull();
  });

  it("conjunto vazio e rótulo vazio devolvem null", () => {
    expect(sugerirTributoDoRotulo([])).toBeNull();
    expect(sugerirTributoDoRotulo([""])).toBeNull();
    expect(sugerirTributoDoRotulo(["   "])).toBeNull();
  });
});

describe("sugerirTributoDoRotulo — o que ela NUNCA devolve", () => {
  /**
   * ⚠️ **O Gate Fiscal em forma de teste.** `eDescontoEfetivo` e `quemRecolhe`
   * continuam 100% manuais e obrigatórios (critério 8) — decisão unânime entre o
   * `contador` e o Mateus, sem divergência neste ponto. Aqui a trava é o tipo de
   * retorno: uma categoria, ou nada. Esta asserção é a versão em runtime disso,
   * contra alguém "aproveitar" a função para devolver um objeto com mais campos.
   */
  it("devolve string de categoria ou null — nunca objeto com campo fiscal", () => {
    const categorias = ["iss", "inss", "irrf", "pis", "cofins", "csll"];
    for (const rotulo of ["Valor ISS", "INSS Retido", "IRRF", "PIS", "COFINS", "CSLL"]) {
      const resultado = sugerirTributoDoRotulo([rotulo]);
      expect(typeof resultado).toBe("string");
      expect(categorias).toContain(resultado);
    }
    expect(sugerirTributoDoRotulo(["Total das Retenções"])).toBeNull();
  });
});
