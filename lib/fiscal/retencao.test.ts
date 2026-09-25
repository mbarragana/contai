/**
 * **CONTAI-038 — as linhas de retenção, regra a regra.**
 *
 * Fonte: `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (corpo +
 * ADENDO de 2026-09-19) e o Gate Fiscal do ticket. Cada `it` abaixo é uma
 * condição "se X → Y" do parecer, e nenhuma é inferida.
 *
 * ⚠️ Os testes de TEXTO não são decorativos: as duas frases literais (a
 * consequência da pendência e o rótulo da perna não discriminada) aparecem em
 * mais de uma tela, e reescrevê-las é redigir regra fiscal em vez de copiá-la
 * — que é a proibição do `CLAUDE.md`.
 */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  acaoDaRetencaoParcial,
  CHIP_RETENCAO_PARCIALMENTE_GRAVADA,
  contagemDaRetencaoParcial,
  CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR,
  descricaoDaComposicao,
  DICA_GATE_DESTACADA,
  DICA_GATE_DESTACADA_LARGA,
  exigeGateDeRetencao,
  faltaRegistrarLinha,
  linhaRetencaoParaBanco,
  linhaSemRecolhedor,
  LINHA_RETENCAO_VAZIA,
  nomeDaRetencao,
  OPCOES_COMPOSICAO,
  OPCOES_GATE,
  OPCOES_QUEM_RECOLHE,
  PERGUNTA_DESCONTO_EFETIVO,
  ROTULO_RETENCAO_NAO_DISCRIMINADA,
  validarLinhaRetencao,
  type EntradaLinhaRetencao,
} from "./retencao";
import type { Documento, LinhaRetencao } from "@/lib/types";

function entrada(over: Partial<EntradaLinhaRetencao> = {}): EntradaLinhaRetencao {
  return {
    // O caso REAL do Francisco: linha única, combinada, descontada de fato.
    rotuloLiteral: "Total das Retenções (ISSQN / Federais)",
    valorCentavos: 54_000,
    composicao: "combinado_nao_aberto",
    tributo: null,
    eDescontoEfetivo: true,
    quemRecolhe: "nao_sei",
    ...over,
  };
}

function linha(over: Partial<LinhaRetencao> = {}): LinhaRetencao {
  return {
    id: "l1",
    documentoId: "d1",
    rotuloLiteral: "Total das Retenções (ISSQN / Federais)",
    valorCentavos: 54_000,
    composicao: "combinado_nao_aberto",
    tributo: null,
    eDescontoEfetivo: true,
    quemRecolhe: "nao_sei",
    createdAt: "2026-03-21T10:00:00Z",
    ...over,
  };
}

const campos = (e: EntradaLinhaRetencao) =>
  validarLinhaRetencao(e).map((x) => x.campo);

// ── As perguntas, e o que elas NÃO oferecem ─────────────────────────────

describe("as perguntas da linha", () => {
  it("o gate tem DUAS opções, e nenhuma delas é 'não sei'", () => {
    // ⚠️ O tri-estado morreu com o booleano: "a nota destaca retenção?" é
    // leitura do papel, não julgamento fiscal — não há terceiro estado a
    // oferecer. O "não sei" migrou para onde ele é de fato uma resposta:
    // `composicao` e `quem_recolhe`.
    expect(OPCOES_GATE.map((o) => o.valor)).toEqual(["nenhuma", "destacada"]);
  });

  it("composição tem as TRÊS respostas do ADENDO A.1, 'não sei' inclusive", () => {
    expect(OPCOES_COMPOSICAO.map((o) => o.valor)).toEqual([
      "tributo_identificado",
      "combinado_nao_aberto",
      "nao_sei",
    ]);
  });

  it("'ainda não sei' é resposta de primeira classe em quem recolhe (A.2/A.4)", () => {
    expect(OPCOES_QUEM_RECOLHE.map((o) => o.valor)).toEqual([
      "eu",
      "empresa",
      "nao_sei",
    ]);
  });

  it("a pergunta do desconto efetivo é a do critério 3, literal", () => {
    expect(PERGUNTA_DESCONTO_EFETIVO).toBe(
      "Esse valor é de fato abatido do que você transfere ao prestador?",
    );
  });

  it("nada nasce pré-marcado — a linha vazia é vazia em todos os campos", () => {
    expect(LINHA_RETENCAO_VAZIA).toEqual({
      rotuloLiteral: "",
      valorCentavos: null,
      composicao: null,
      tributo: null,
      eDescontoEfetivo: null,
      quemRecolhe: null,
    });
  });
});

// ── Validação: a linha só grava COMPLETA (critério 5) ───────────────────

describe("validarLinhaRetencao", () => {
  it("a linha do caso real passa", () => {
    expect(validarLinhaRetencao(entrada())).toEqual([]);
  });

  it("rótulo em branco não grava — é o texto da nota, não um opcional", () => {
    expect(campos(entrada({ rotuloLiteral: "   " }))).toContain("rotuloLiteral");
  });

  it("valor ausente ou não-positivo não grava", () => {
    expect(campos(entrada({ valorCentavos: null }))).toContain("valorCentavos");
    expect(campos(entrada({ valorCentavos: 0 }))).toContain("valorCentavos");
  });

  it("composição em branco BLOQUEIA o salvamento (§4, reforçado em A.3)", () => {
    expect(campos(entrada({ composicao: null }))).toContain("composicao");
  });

  it("'tributo identificado' exige QUAL tributo — nunca inferido do rótulo", () => {
    expect(
      campos(entrada({ composicao: "tributo_identificado", tributo: null })),
    ).toContain("tributo");
  });

  /**
   * ⚠️ **Regra dura do ADENDO A.1.** Pedir o tributo de uma linha combinada
   * seria a decomposição por chute que o parecer proíbe — o app não sabe, a
   * nota não abriu, e "geralmente é 70% ISS" é rateio inventado.
   */
  it("linha COMBINADA não pede tributo — e pedir seria decompor", () => {
    expect(campos(entrada({ composicao: "combinado_nao_aberto" }))).not.toContain(
      "tributo",
    );
    expect(campos(entrada({ composicao: "nao_sei" }))).not.toContain("tributo");
  });

  it("'não sei o que este valor representa' é resposta VÁLIDA, não erro", () => {
    expect(validarLinhaRetencao(entrada({ composicao: "nao_sei" }))).toEqual([]);
  });

  it("desconto efetivo sem resposta não grava", () => {
    expect(campos(entrada({ eDescontoEfetivo: null }))).toContain(
      "eDescontoEfetivo",
    );
  });

  it("desconto efetivo = sim exige 'quem recolhe' (critério 5)", () => {
    expect(
      campos(entrada({ eDescontoEfetivo: true, quemRecolhe: null })),
    ).toContain("quemRecolhe");
  });

  it("desconto efetivo = não NÃO pergunta quem recolhe", () => {
    expect(
      validarLinhaRetencao(
        entrada({ eDescontoEfetivo: false, quemRecolhe: null }),
      ),
    ).toEqual([]);
  });

  /**
   * §4 do parecer, item final: *"se o percentual encontrado for exatamente 11%
   * sobre o valor total da nota, NÃO presumir que está correto"*. Aqui isso é
   * estrutural — o app nem conhece percentual, só o valor que está impresso, e
   * a exigência de classificação é a mesma para qualquer número.
   */
  it("11% exatos não ganham passe livre: a exigência é idêntica", () => {
    const onzePorCento = entrada({
      rotuloLiteral: "INSS 11%",
      valorCentavos: 198_000,
      composicao: null,
    });
    expect(campos(onzePorCento)).toContain("composicao");
  });
});

// ── O que vai para o banco ──────────────────────────────────────────────

describe("linhaRetencaoParaBanco", () => {
  it("zera o tributo fora do ramo que o pede — o CHECK do banco exige", () => {
    const linhaBanco = linhaRetencaoParaBanco(
      entrada({ composicao: "combinado_nao_aberto", tributo: "inss" }),
    );
    expect(linhaBanco?.tributo).toBeNull();
  });

  it("zera 'quem recolhe' quando o desconto não é efetivo", () => {
    const linhaBanco = linhaRetencaoParaBanco(
      entrada({ eDescontoEfetivo: false, quemRecolhe: "empresa" }),
    );
    expect(linhaBanco?.quem_recolhe).toBeNull();
  });

  it("o rótulo perde só o espaço em volta — nada mais é normalizado", () => {
    const linhaBanco = linhaRetencaoParaBanco(
      entrada({ rotuloLiteral: "  Total das Retenções (ISSQN / Federais)  " }),
    );
    expect(linhaBanco?.rotulo_literal).toBe(
      "Total das Retenções (ISSQN / Federais)",
    );
  });

  it("entrada incompleta devolve null — não existe gravação pela metade", () => {
    expect(linhaRetencaoParaBanco(entrada({ composicao: null }))).toBeNull();
  });
});

// ── Os predicados que a pendência lê ────────────────────────────────────

describe("linhaSemRecolhedor — as quatro condições do Gate Fiscal P1", () => {
  it("informativa (desconto não efetivo) NUNCA abre pendência", () => {
    expect(
      linhaSemRecolhedor(linha({ eDescontoEfetivo: false, quemRecolhe: null }), false),
    ).toBe(false);
  });

  it("'a empresa recolhe' FECHA — sem exigir comprovante do prestador", () => {
    expect(linhaSemRecolhedor(linha({ quemRecolhe: "empresa" }), false)).toBe(
      false,
    );
  });

  it("'ainda não sei' e 'não respondido' ABREM igual", () => {
    expect(linhaSemRecolhedor(linha({ quemRecolhe: "nao_sei" }), false)).toBe(true);
    expect(linhaSemRecolhedor(linha({ quemRecolhe: null }), false)).toBe(true);
    // E o estado do pagamento não fecha o que depende de uma RESPOSTA.
    expect(linhaSemRecolhedor(linha({ quemRecolhe: "nao_sei" }), true)).toBe(true);
  });

  it("'eu recolho' depende da guia: fecha só com a nota coberta (§4.1)", () => {
    expect(linhaSemRecolhedor(linha({ quemRecolhe: "eu" }), false)).toBe(true);
    expect(linhaSemRecolhedor(linha({ quemRecolhe: "eu" }), true)).toBe(false);
  });
});

describe("faltaRegistrarLinha — o critério 2 em forma de predicado", () => {
  const nota = (over: Partial<Documento>) =>
    ({
      tipo: "nf_servico",
      retencaoNaNota: null,
      retencoes: [],
      ...over,
    }) as Documento;

  it("'destacada' com zero linhas é pendência VISÍVEL", () => {
    expect(faltaRegistrarLinha(nota({ retencaoNaNota: "destacada" }))).toBe(true);
  });

  it("'destacada' com linha gravada não é pendência", () => {
    expect(
      faltaRegistrarLinha(
        nota({ retencaoNaNota: "destacada", retencoes: [linha()] }),
      ),
    ).toBe(false);
  });

  it("'nenhuma' não é pendência, e o legado (null) também não é esta", () => {
    expect(faltaRegistrarLinha(nota({ retencaoNaNota: "nenhuma" }))).toBe(false);
    // `null` é "não foi perguntado" — a tela devolve a PERGUNTA, que é outro
    // estado. Colapsar os dois seria ler branco como resposta.
    expect(faltaRegistrarLinha(nota({ retencaoNaNota: null }))).toBe(false);
  });

  it("NF de material e boleto nunca têm este bloco", () => {
    expect(exigeGateDeRetencao({ tipo: "nf_material" } as Documento)).toBe(false);
    expect(exigeGateDeRetencao({ tipo: "boleto" } as Documento)).toBe(false);
    expect(exigeGateDeRetencao({ tipo: "nf_servico" } as Documento)).toBe(true);
  });
});

// ── Os textos literais ──────────────────────────────────────────────────

describe("textos que se copiam do parecer, nunca se redigem", () => {
  it("a consequência da pendência é a frase do ADENDO A.4, inteira", () => {
    expect(CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR).toBe(
      "Retenção descontada do pagamento sem confirmação de quem recolhe — se " +
        "ninguém recolher, não é economia, é passivo não identificado.",
    );
  });

  /**
   * ⚠️ **Regra dura do ADENDO A.2.** Com composição combinada ou desconhecida,
   * a perna de pagamento **não pode** ser nomeada "guia de ISS" nem "guia de
   * INSS" — nomear o tributo de um valor que a nota não abriu é a decomposição
   * por chute do A.1 com outro rosto.
   */
  it("linha combinada é nomeada pelo rótulo literal do A.2, nunca por tributo", () => {
    expect(nomeDaRetencao(linha({ composicao: "combinado_nao_aberto" }))).toBe(
      ROTULO_RETENCAO_NAO_DISCRIMINADA,
    );
    expect(nomeDaRetencao(linha({ composicao: "nao_sei" }))).toBe(
      ROTULO_RETENCAO_NAO_DISCRIMINADA,
    );
    expect(ROTULO_RETENCAO_NAO_DISCRIMINADA).toBe(
      "retenção não discriminada, presumivelmente recolhida por terceiros",
    );
  });

  it("só a linha que o Mateus identificou pode nomear o tributo", () => {
    expect(
      nomeDaRetencao(
        linha({ composicao: "tributo_identificado", tributo: "iss" }),
      ),
    ).toBe("ISS");
    expect(
      descricaoDaComposicao(
        linha({ composicao: "tributo_identificado", tributo: "inss" }),
      ),
    ).toBe("Tributo único identificado — INSS");
  });

  /**
   * **TESTE-TRAVA do pre-mortem 3**: "combinado vira decomposto em algum
   * relatório futuro". Nenhum módulo do app pode aprender a repartir um valor
   * combinado entre tributos — e o primeiro sintoma disso seria alguém
   * ensinar `retencao.ts` a produzir uma fatia por tributo.
   */
  it("o módulo não sabe repartir valor combinado entre tributos", () => {
    const fonte = readFileSync("lib/fiscal/retencao.ts", "utf-8");
    // Nenhuma FUNÇÃO com cara de rateio (a prosa pode citar a proibição; o
    // código não pode implementá-la).
    expect(
      /function\s+\w*(ratear|rateio|decompor|repartir|proporcao)/i.test(fonte),
    ).toBe(false);
    // E nenhum export devolve uma quebra por tributo.
    expect(/Record<TributoRetido,\s*number>/.test(fonte)).toBe(false);
  });
});

// ── CONTAI-053 · os textos da captura em tela larga ─────────────────────

/**
 * **Os quatro textos que o Gate 0 fixou** (`design/mocks/CONTAI-053.md`, §3 e
 * §4). Dois são orientação de fluxo; o corpo do resultado parcial carrega
 * disciplina fiscal ("nunca como 'sem retenção'") e por isso mora aqui, e não na
 * tela.
 */
describe("CONTAI-053 — as dicas por largura e o resultado parcial", () => {
  /**
   * ⚠️ **Critério 6, em forma de teste**: a dica do piso continua EXATAMENTE a
   * de sempre. Quem "unificar" as duas frases numa só quebra este teste — e é
   * essa a intenção: unificar significaria escolher entre dizer o falso em uma
   * das duas larguras.
   */
  it("a dica do piso não muda, e a de tela larga diz onde o detalhe está", () => {
    expect(DICA_GATE_DESTACADA).toBe(
      "Você detalha isso depois, sentado — aqui só marcamos que a nota tem retenção.",
    );
    expect(DICA_GATE_DESTACADA_LARGA).toBe(
      "As linhas de retenção aparecem logo abaixo — preencha agora, com a nota " +
        "na mão, ou deixe em branco e complete depois, na tela desta nota.",
    );
    // A frase de tela larga NÃO pode prometer "depois": é o defeito que ela
    // existe para corrigir.
    expect(DICA_GATE_DESTACADA_LARGA).not.toContain("detalha isso depois");
  });

  it("o chip do resultado parcial é o texto 3 do spec", () => {
    expect(CHIP_RETENCAO_PARCIALMENTE_GRAVADA).toBe(
      "Retenção parcialmente gravada",
    );
  });

  /**
   * ⚠️ **Substantivo com `total`, VERBO com `entraram`** — correção do Gate 2, e
   * é o que o ASCII do spec sempre mostrou: *"1 de 3 linhas de retenção
   * entrou"*. O verbo no plural aqui ("3 linhas … entraram") diria que entraram
   * três, que é o oposto do que a mensagem existe para dizer.
   */
  it("a contagem concorda: substantivo com o total, verbo com quantas entraram — verbo na frente", () => {
    expect(contagemDaRetencaoParcial(1, 3)).toBe(
      "Entrou 1 de 3 linhas de retenção — 2 não gravaram.",
    );
    expect(contagemDaRetencaoParcial(2, 3)).toBe(
      "Entraram 2 de 3 linhas de retenção — 1 não gravou.",
    );
    // Zero vai para o plural ("Entraram 0..."); singular é só o 1.
    expect(contagemDaRetencaoParcial(0, 1)).toBe(
      "Entraram 0 de 1 linha de retenção — 1 não gravou.",
    );
    expect(contagemDaRetencaoParcial(0, 2)).toBe(
      "Entraram 0 de 2 linhas de retenção — 2 não gravaram.",
    );
  });

  /**
   * ⚠️ A última cláusula é a que importa fiscalmente: linha que não gravou é
   * **pendência**, e a nota nunca é lida como "sem retenção" (CONTAI-038,
   * critérios 2 e 5). Ela é afirmação de regra, não consolo de UI.
   */
  it("a ação diz o que fazer e reafirma que a lacuna é pendência", () => {
    expect(acaoDaRetencaoParcial(1)).toBe(
      "Abra o documento e registre a que falta de novo, olhando a nota — elas " +
        'ficam como pendência até lá, nunca como "sem retenção".',
    );
    expect(acaoDaRetencaoParcial(2)).toContain("as que faltam");
    expect(acaoDaRetencaoParcial(2)).toContain('nunca como "sem retenção"');
  });

  /**
   * As duas funções de descrição passaram a aceitar a linha AINDA NÃO GRAVADA
   * (`EntradaLinhaRetencao`, tudo `null` no começo) para que a captura e a gestão
   * descrevam a mesma linha com o mesmo código. A ampliação não pode ter aberto
   * uma porta para nomear tributo onde não há.
   */
  it("a linha ainda não gravada é descrita pelas MESMAS funções da gestão", () => {
    const local: EntradaLinhaRetencao = {
      rotuloLiteral: "Total das Retenções (ISSQN / Federais)",
      valorCentavos: 54_000,
      composicao: "combinado_nao_aberto",
      tributo: null,
      eDescontoEfetivo: true,
      quemRecolhe: "nao_sei",
    };
    expect(descricaoDaComposicao(local)).toBe(
      "Total combinado, não aberto pela nota",
    );
    expect(nomeDaRetencao(local)).toBe(ROTULO_RETENCAO_NAO_DISCRIMINADA);
    // Composição ainda em branco não inventa nome de tributo nenhum.
    expect(nomeDaRetencao({ composicao: null, tributo: null })).toBe(
      ROTULO_RETENCAO_NAO_DISCRIMINADA,
    );
    expect(descricaoDaComposicao({ composicao: null, tributo: null })).toBe("");
  });
});
