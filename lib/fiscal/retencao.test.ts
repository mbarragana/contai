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
  avisoDeRemocaoDasLinhas,
  confirmacaoDeRemocaoDasLinhas,
  CHIP_RETENCAO_GUIA_PENDENTE,
  CHIP_RETENCAO_PARCIALMENTE_GRAVADA,
  CHIP_RETENCAO_SEM_RECOLHEDOR,
  contagemDaRetencaoParcial,
  CONSEQUENCIA_RETENCAO_EU_SEM_GUIA,
  CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR,
  descricaoDaComposicao,
  DICA_GATE_DESTACADA,
  DICA_GATE_DESTACADA_LARGA,
  exigeGateDeRetencao,
  faltaRegistrarLinha,
  linhaRetencaoParaBanco,
  linhaSemRecolhedor,
  linhaSugerida,
  LINHA_RETENCAO_VAZIA,
  motivoDaRetencaoAberta,
  motivoDaRetencaoDoDocumento,
  nomeDaRetencao,
  nomeDaRetencaoARecolher,
  OPCOES_COMPOSICAO,
  OPCOES_GATE,
  OPCOES_QUEM_RECOLHE,
  PERGUNTA_DESCONTO_EFETIVO,
  quebrarExcedenteDaNota,
  ROTULO_RETENCAO_NAO_DISCRIMINADA,
  ROTULO_RETENCAO_NAO_DISCRIMINADA_RECOLHEDOR_CONFIRMADO,
  SUGESTAO_RETENCAO_CONFIRA,
  SUGESTAO_RETENCAO_FALHOU,
  TEXTO_DA_RETENCAO_ABERTA,
  TITULO_RETENCAO_SEM_RECOLHEDOR,
  validarLinhaRetencao,
  type EntradaLinhaRetencao,
  type QuebraDoExcedente,
} from "./retencao";
import type {
  Documento,
  LinhaRetencao,
  QuemRecolheRetencao,
} from "@/lib/types";

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
    revisaoId: null,
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

// ── CONTAI-059 · POR QUE está aberta, que não é "está aberta?" ───────────

/**
 * **O ADENDO 4 (2026-09-26) em forma de teste.** O bug era de texto
 * reaproveitado: um só parágrafo, vermelho, para dois estados fiscalmente
 * distintos. Cada `it` abaixo é uma condição do adendo, e nenhuma é inferida.
 *
 * ⚠️ O primeiro `it` é a **trava do critério 8**: as condições de ABERTURA da
 * pendência não podem ter mudado com o refactor. Se alguém "aproveitar" o motivo
 * para mudar QUANDO a pendência abre, é aqui que quebra.
 */
describe("CONTAI-059 — o motivo da retenção aberta (ADENDO 4)", () => {
  /**
   * **O predicado de ANTES do CONTAI-059, transcrito à mão** — as quatro
   * condições como `linhaSemRecolhedor` as tinha no corpo dela, antes de o motivo
   * existir (`git show` do arquivo em 6bfe29b confirma).
   *
   * ⚠️ **Ele existe porque `linhaSemRecolhedor` NÃO serve de oráculo** (achado do
   * Gate 2 do `cto-obra`): hoje ela é literalmente
   * `motivoDaRetencaoAberta(...) !== null`, então compará-la com o motivo é
   * comparar uma função com o wrapper dela mesma — passa por construção e não
   * prova nada. Esta cópia é independente do código sob teste, e é isso que faz a
   * asserção abaixo ser uma trava em vez de uma tautologia. **Nunca reescrever
   * para chamar a função de produção**: fazer isso desliga a trava em silêncio.
   */
  function abriaAntesDoCONTAI059(
    linhaDaVez: Pick<LinhaRetencao, "eDescontoEfetivo" | "quemRecolhe">,
    notaCoberta: boolean,
  ): boolean {
    if (!linhaDaVez.eDescontoEfetivo) return false;
    if (linhaDaVez.quemRecolhe === "empresa") return false;
    if (linhaDaVez.quemRecolhe === "eu") return !notaCoberta;
    return true;
  }

  it("o motivo abre exatamente onde o predicado ANTIGO abria — 16 combinações", () => {
    const quem: (QuemRecolheRetencao | null)[] = [
      null,
      "nao_sei",
      "eu",
      "empresa",
    ];
    let combinacoes = 0;
    for (const eDescontoEfetivo of [true, false]) {
      for (const quemRecolhe of quem) {
        for (const coberta of [true, false]) {
          const l = linha({ eDescontoEfetivo, quemRecolhe });
          const antes = abriaAntesDoCONTAI059(l, coberta);
          expect(
            motivoDaRetencaoAberta(l, coberta) !== null,
            `motivo divergiu do predicado antigo em eDescontoEfetivo=${eDescontoEfetivo}, quemRecolhe=${quemRecolhe}, notaCoberta=${coberta}`,
          ).toBe(antes);
          // E o predicado público continua de acordo com os dois — é ele que os
          // outros módulos chamam.
          expect(linhaSemRecolhedor(l, coberta)).toBe(antes);
          combinacoes += 1;
        }
      }
    }
    // A malha inteira foi percorrida: 2 × 4 × 2. Sem isto, um `for` que não roda
    // deixaria o teste verde sem asserção nenhuma.
    expect(combinacoes).toBe(16);
  });

  it("Estado A — sem resposta útil de quem recolhe: vermelho, texto de sempre", () => {
    for (const quemRecolhe of ["nao_sei", null] as const) {
      const motivo = motivoDaRetencaoAberta(linha({ quemRecolhe }), false);
      expect(motivo).toBe("sem_recolhedor");
      const t = TEXTO_DA_RETENCAO_ABERTA[motivo!];
      expect(t.consequencia).toBe(CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR);
      expect(t.chip).toBe(CHIP_RETENCAO_SEM_RECOLHEDOR);
      expect(t.titulo).toBe(TITULO_RETENCAO_SEM_RECOLHEDOR);
      // VERMELHO continua sendo desta família, e só dela (Pergunta 6).
      expect(t.gravidade).toBe("red");
    }
  });

  it("Estado C — 'Eu' com a guia ainda fora: âmbar, texto e chip novos", () => {
    const motivo = motivoDaRetencaoAberta(linha({ quemRecolhe: "eu" }), false);
    expect(motivo).toBe("eu_sem_guia");
    const t = TEXTO_DA_RETENCAO_ABERTA[motivo!];
    expect(t.consequencia).toBe(CONSEQUENCIA_RETENCAO_EU_SEM_GUIA);
    expect(t.chip).toBe("Guia de retenção pendente");
    expect(t.titulo).toBe("Recolhedor confirmado — guia ainda não paga");
    // ⚠️ **ÂMBAR** (Pergunta 6): o risco é real (a guia pode nunca ser paga),
    // mas não é mais "passivo não identificado" — o responsável é ele.
    expect(t.gravidade).toBe("amb");
  });

  it("nenhum motivo onde não há pendência — informativa, 'a empresa', guia paga", () => {
    expect(
      motivoDaRetencaoAberta(
        linha({ eDescontoEfetivo: false, quemRecolhe: null }),
        false,
      ),
    ).toBeNull();
    expect(
      motivoDaRetencaoAberta(linha({ quemRecolhe: "empresa" }), false),
    ).toBeNull();
    expect(motivoDaRetencaoAberta(linha({ quemRecolhe: "eu" }), true)).toBeNull();
  });

  /**
   * ⚠️ **Os dois conjuntos não se confundem em campo nenhum.** O ADENDO 4,
   * Pergunta 5, nomeia o risco: corrigir só o parágrafo e deixar o título
   * dizendo "sem confirmar" faria o card se contradizer sozinho — *"pior do que
   * o bug original"*. Quem misturar um campo de um estado com um do outro
   * quebra aqui.
   */
  it("os dois conjuntos são disjuntos nos quatro campos", () => {
    const a = TEXTO_DA_RETENCAO_ABERTA.sem_recolhedor;
    const c = TEXTO_DA_RETENCAO_ABERTA.eu_sem_guia;
    expect(a.consequencia).not.toBe(c.consequencia);
    expect(a.chip).not.toBe(c.chip);
    expect(a.titulo).not.toBe(c.titulo);
    expect(a.gravidade).not.toBe(c.gravidade);
    // Os dois fatos fiscais do Estado C (Pergunta 5), em forma de asserção.
    for (const texto of [c.chip, c.titulo, c.consequencia]) {
      expect(texto).not.toMatch(/sem confirmar/i);
      expect(texto).not.toMatch(/resolvid|quitad/i);
    }
  });
});

/**
 * **A regra de prioridade por documento — critério 6 / ADENDO 4, Pergunta 4.**
 *
 * Um documento pode ter uma linha em A e outra em C ao mesmo tempo, e o card da
 * home é UM por documento. O `contador` ratificou o pior caso, sem terceiro
 * texto "misto": *"enquanto existir uma linha em A no documento, a ação pendente
 * mais urgente continua sendo a de A"*.
 */
describe("CONTAI-059 — o motivo do DOCUMENTO quando as linhas discordam", () => {
  const A = linha({ id: "l1", quemRecolhe: "nao_sei" });
  const C = linha({ id: "l2", quemRecolhe: "eu" });
  const FECHADA = linha({ id: "l3", quemRecolhe: "empresa" });

  it("todas em A → conjunto de A", () => {
    expect(motivoDaRetencaoDoDocumento([A, A], false)).toBe("sem_recolhedor");
  });

  it("A + C juntas → conjunto de A vence, em qualquer ordem", () => {
    expect(motivoDaRetencaoDoDocumento([A, C], false)).toBe("sem_recolhedor");
    expect(motivoDaRetencaoDoDocumento([C, A], false)).toBe("sem_recolhedor");
  });

  it("todas em C → conjunto de C", () => {
    expect(motivoDaRetencaoDoDocumento([C, C], false)).toBe("eu_sem_guia");
  });

  it("linha já FECHADA não vota — só as abertas entram na conta", () => {
    expect(motivoDaRetencaoDoDocumento([FECHADA, C], false)).toBe("eu_sem_guia");
    expect(motivoDaRetencaoDoDocumento([FECHADA, A], false)).toBe(
      "sem_recolhedor",
    );
    // Nenhuma aberta → nenhum motivo, e o card não nasce.
    expect(motivoDaRetencaoDoDocumento([FECHADA], false)).toBeNull();
    expect(motivoDaRetencaoDoDocumento([], false)).toBeNull();
    // A nota coberta fecha o C e deixa o A de pé — é a mesma assimetria de
    // `linhaSemRecolhedor`: a guia fecha pagamento, não fecha resposta.
    expect(motivoDaRetencaoDoDocumento([A, C], true)).toBe("sem_recolhedor");
    expect(motivoDaRetencaoDoDocumento([C], true)).toBeNull();
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
   * **CONTAI-059, critério 1 — e este teste não confere contra uma cópia, confere
   * contra o PARECER.**
   *
   * ⚠️ O teste irmão logo acima compara a constante com uma segunda cópia
   * digitada no próprio teste: se alguém parafrasear as duas juntas, ele passa.
   * Aqui a frase esperada é **extraída do arquivo do parecer**, o que faz a
   * asserção ser a literalidade de verdade — a proibição do `CLAUDE.md`
   * ("texto de tela com consequência fiscal se copia do parecer, não se
   * reescreve") com um verificador, não só com uma norma.
   */
  it("o texto do Estado C é a citação literal do ADENDO 4, extraída do parecer", () => {
    // A forma digitada, no mesmo padrão do teste acima.
    expect(CONSEQUENCIA_RETENCAO_EU_SEM_GUIA).toBe(
      "Você já confirmou que quem recolhe esta retenção é você — a pendência " +
        "aqui não é de identificação, é de pagamento: enquanto a guia não for " +
        "paga e vinculada a este documento, esta fatia não entra no custo de " +
        "aquisição do ano nenhum. Se a guia nunca for paga, o efeito não é " +
        "apenas essa fatia ficar fora do custo para sempre — o valor retido se " +
        "torna dívida tributária vencida em seu nome, sujeita a juros e multa.",
    );

    // E a mesma frase, lida do parecer: a citação em bloco (`> "…"`) que fecha a
    // Pergunta 3 do ADENDO 4. Desdobrada só no que o Markdown quebrou — o
    // prefixo `> ` e o fim de linha.
    const parecer = readFileSync(
      "docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md",
      "utf-8",
    );
    const adendo4 = parecer.slice(parecer.indexOf("# ADENDO 4 —"));
    expect(adendo4).not.toBe("");
    const citacoes = [...adendo4.matchAll(/(?:^> .*\n)+/gm)].map((m) =>
      m[0]
        .split("\n")
        .map((l) => l.replace(/^> ?/, "").trim())
        .join(" ")
        .trim()
        // A citação vem entre aspas curvas no parecer; a constante não as carrega.
        .replace(/^[“"]|[”"]$/g, ""),
    );
    expect(citacoes).toContain(CONSEQUENCIA_RETENCAO_EU_SEM_GUIA);
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

// ── CONTAI-055 · a sugestão pré-preenche DOIS campos, e só ──────────────

/**
 * **O Gate Fiscal do CONTAI-055 em forma de teste.** Ele não traz regra nova:
 * reafirma a fronteira do CONTAI-054 — `composicao`, `tributo`,
 * `eDescontoEfetivo` e `quemRecolhe` **nunca** vêm de leitura de PDF — agora que
 * existe um caminho de código que preenche campo a partir de PDF.
 */
describe("CONTAI-055 — a linha nascida de sugestão", () => {
  const SUGESTAO = { rotuloLiteral: "ISSRF", valorCentavos: 104_800 };

  /**
   * ⚠️ Igualdade PROFUNDA de propósito, e não `toMatchObject`: o ponto é que os
   * outros quatro campos continuam `null`, e `toMatchObject` não afirmaria isso.
   */
  it("preenche rótulo e valor, e deixa os quatro campos fiscais em null", () => {
    expect(linhaSugerida(SUGESTAO)).toEqual({
      rotuloLiteral: "ISSRF",
      valorCentavos: 104_800,
      composicao: null,
      tributo: null,
      eDescontoEfetivo: null,
      quemRecolhe: null,
    } satisfies EntradaLinhaRetencao);
    // E a linha vazia não foi mutada pelo spread.
    expect(LINHA_RETENCAO_VAZIA.rotuloLiteral).toBe("");
  });

  /**
   * ⚠️ **A linha sugerida REPROVA na validação, e isso é o critério 1**: o
   * humano ainda tem de responder composição e desconto efetivo. Se algum dia ela
   * passar, alguém ensinou a extração a responder pergunta fiscal.
   */
  it("continua faltando exatamente as duas respostas fiscais do ramo raiz", () => {
    const erros = validarLinhaRetencao(linhaSugerida(SUGESTAO));
    expect(erros.map((e) => e.campo)).toEqual([
      "composicao",
      "eDescontoEfetivo",
    ]);
    // E nunca reclama dos dois que a sugestão preencheu.
    expect(erros.some((e) => e.campo === "rotuloLiteral")).toBe(false);
    expect(erros.some((e) => e.campo === "valorCentavos")).toBe(false);
  });

  /** Nada da sugestão chega ao banco sozinho — nem por este caminho. */
  it("não produz linha gravável antes da confirmação humana", () => {
    expect(linhaRetencaoParaBanco(linhaSugerida(SUGESTAO))).toBeNull();
  });

  /**
   * O espelho do critério 3 do CONTAI-054 ("`grep` no diff confirma zero
   * atribuição automática a esses quatro campos"), agora do lado da UI: nem o
   * componente nem a tela de captura podem ler um desses campos de uma sugestão.
   * O compilador já barra (o tipo não os declara); isto barra a gambiarra de
   * afrouxar o tipo sem ninguém notar.
   *
   * ⚠️ **QUALIFICADO NO CONTAI-070, e continua valendo como está escrito.** A
   * categoria sugerida chega por um canal PRÓPRIO (`tributoSugerido`, campo irmão
   * na resposta da rota e parâmetro próprio de `linhaSugerida`), nunca lida de
   * dentro de uma `sugestao` — é exatamente por isso que esta varredura continua
   * verde depois daquele ticket. O que ela guarda hoje é a fronteira que sobrou:
   * ninguém pode passar a ler `sugestao.eDescontoEfetivo`/`sugestao.quemRecolhe`
   * (proibidos sem exceção, ponto unânime entre o `contador` e o Mateus) nem
   * reenfiar a classificação dentro do tipo que serve de trava.
   */
  it("nem a UI nem o módulo derivam campo fiscal de uma sugestão", () => {
    const fontes = [
      "lib/fiscal/retencao.ts",
      "app/_components/retencao.tsx",
      "app/(captura)/adicionar/documento/page.tsx",
    ].map((caminho) => readFileSync(caminho, "utf-8"));
    for (const fonte of fontes) {
      expect(
        /sugestao(Retencao)?\??\.(composicao|tributo|eDescontoEfetivo|quemRecolhe)/.test(
          fonte,
        ),
      ).toBe(false);
    }
  });

  /**
   * ⚠️ **Critério 5** — o aviso tem de nomear o risco que ele existe para
   * cobrir: linha de DESCONTO fechando a mesma aritmética. Sem essa palavra o
   * texto vira "confira, por favor", que é o que ninguém lê.
   */
  it("o aviso da sugestão nomeia a aritmética e a linha de desconto", () => {
    expect(SUGESTAO_RETENCAO_CONFIRA).toContain("aritmética");
    expect(SUGESTAO_RETENCAO_CONFIRA).toContain("DESCONTO");
    // E a falha diz que o registro segue — critério 4, dito em tela.
    expect(SUGESTAO_RETENCAO_FALHOU).toContain("o registro segue normalmente");
  });
});

// ── CONTAI-070 · a categoria sugerida entra como PAR, e só ela ──────────

/**
 * **O Gate Fiscal do CONTAI-070 em forma de teste.**
 *
 * ⚠️ Este describe registra uma decisão de produto que **sobrepôs** a recomendação
 * do `contador`: ele reprovou sugerir `composicao`/`tributo` "sem exceção"
 * (`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`, Pergunta 1, citando o
 * critério 14 do CONTAI-038) e o Mateus estendeu ao tributo a decisão já tomada
 * para o CNO (`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`,
 * ADENDO). O que estas asserções guardam é o que NÃO foi aberto junto:
 * `eDescontoEfetivo` e `quemRecolhe` seguem manuais e obrigatórios, e a linha
 * sugerida continua REPROVANDO na validação.
 */
describe("CONTAI-070 — a linha nascida de sugestão com categoria", () => {
  const SUGESTAO = { rotuloLiteral: "ISSRF", valorCentavos: 104_800 };

  /** Igualdade PROFUNDA: o ponto é o que continua `null` ao lado do par. */
  it("preenche composição E tributo juntos, e nada além disso", () => {
    expect(linhaSugerida(SUGESTAO, "iss")).toEqual({
      rotuloLiteral: "ISSRF",
      valorCentavos: 104_800,
      composicao: "tributo_identificado",
      tributo: "iss",
      // ⚠️ Critério 8: os dois campos que a decisão do Mateus NÃO abriu.
      eDescontoEfetivo: null,
      quemRecolhe: null,
    } satisfies EntradaLinhaRetencao);
  });

  /** Sem categoria (rótulo ambíguo ou composto) é a linha de antes do ticket. */
  it("categoria null devolve exatamente a linha do CONTAI-055", () => {
    expect(linhaSugerida(SUGESTAO, null)).toEqual(linhaSugerida(SUGESTAO));
    expect(linhaSugerida(SUGESTAO, null).composicao).toBeNull();
    expect(linhaSugerida(SUGESTAO, null).tributo).toBeNull();
  });

  /**
   * ⚠️ **Nunca meio par** (critério 5/7): não existe chamada que devolva `tributo`
   * sem `composicao` nem o contrário — um parâmetro só governa os dois, então o
   * CHECK `documento_retencao_tributo_coerente` fica satisfeito por construção.
   */
  it("tributo e composição nascem e morrem juntos, nas 6 categorias", () => {
    for (const tributo of ["iss", "inss", "irrf", "pis", "cofins", "csll"] as const) {
      const linha = linhaSugerida(SUGESTAO, tributo);
      expect(linha.composicao).toBe("tributo_identificado");
      expect(linha.tributo).toBe(tributo);
    }
  });

  /**
   * ⚠️ **A sugestão do par NÃO destrava a linha** — é o que mantém a confirmação
   * humana obrigatória (critério 8/9): faltam `eDescontoEfetivo` e, dependendo da
   * resposta dele, `quemRecolhe`. Se algum dia esta linha passar direto, alguém
   * ensinou a extração a responder pergunta de responsabilidade.
   */
  it("continua reprovando na validação — falta o desconto efetivo, manual", () => {
    const erros = validarLinhaRetencao(linhaSugerida(SUGESTAO, "iss"));
    expect(erros.map((e) => e.campo)).toEqual(["eDescontoEfetivo"]);
    expect(linhaRetencaoParaBanco(linhaSugerida(SUGESTAO, "iss"))).toBeNull();

    // E com o desconto respondido, ainda falta quem recolhe.
    const comDesconto = {
      ...linhaSugerida(SUGESTAO, "iss"),
      eDescontoEfetivo: true,
    };
    expect(validarLinhaRetencao(comDesconto).map((e) => e.campo)).toEqual([
      "quemRecolhe",
    ]);
  });
});

// ── CONTAI-086 · o aviso da reversão do gate ─────────────────────────────

describe("CONTAI-086 — reverter o gate para 'nenhuma' remove as linhas", () => {
  /**
   * ⚠️ **TESTE-TRAVA de texto verbatim.** A frase é do Gate Fiscal do
   * CONTAI-086 (critério 7) e ela está no ticket entre `*"…"*`: o teste a LÊ de
   * lá e compara com a saída da função, com o `N` substituído. Reescrever a frase
   * no código deixa este teste vermelho — que é o ponto, porque quem a redigiu
   * foi o `contador`, não esta tela.
   */
  it("o texto de 2+ linhas é o do ticket, byte a byte", () => {
    const ticket = readFileSync("docs/tickets/CONTAI-086.md", "utf-8");
    const citado = /\*"(As N linhas[\s\S]*?)"\*/.exec(ticket);
    expect(citado).not.toBeNull();
    const esperado = citado![1]
      .split("\n")
      .map((l) => l.trim())
      .join(" ")
      .replace(/\s+/g, " ")
      .replace("As N linhas", "As 3 linhas");
    expect(avisoDeRemocaoDasLinhas(3)).toBe(esperado);
  });

  /**
   * O ramo de UMA linha é CONCORDÂNCIA, não conteúdo novo: os dois fatos da
   * frase — o registro no histórico e o fim da pendência — continuam lá, palavra
   * por palavra. É a mesma adaptação que `contagemDaRetencaoParcial` já faz.
   */
  it("com uma linha, concorda no singular sem perder nenhum dos dois fatos", () => {
    const umaLinha = avisoDeRemocaoDasLinhas(1);
    expect(umaLinha).toContain("A linha de retenção desta nota será removida");
    expect(umaLinha).toContain("O fato fica registrado no histórico da correção");
    expect(umaLinha).toContain("deixa de contar como pendência");
    // E nunca o plural quebrado que a substituição ingênua produziria.
    expect(umaLinha).not.toContain("As 1 linhas");
  });

  it("a confirmação concorda com a quantidade, e nasce como pergunta", () => {
    expect(confirmacaoDeRemocaoDasLinhas(1)).toBe(
      "Confirmo a remoção da linha de retenção desta nota",
    );
    expect(confirmacaoDeRemocaoDasLinhas(2)).toBe(
      "Confirmo a remoção das 2 linhas de retenção desta nota",
    );
  });
});

// ── CONTAI-090 · o excedente da nota quebrado em fornecedor + retenção ──

/**
 * **O relato, em forma de teste** (`docs/backlog/105-2026-10-10-...md`): *"para
 * mim aquele dizer em âmbar não faz sentido, porque não é os 34mil referente a
 * nota, é 33 e pouco referente a nota e 1797 referente ao ISS"*.
 *
 * ⚠️ **Nenhum valor de custo muda aqui, e o teste existe para provar isso**: a
 * invariante `X + ΣY === faltaPagamentoCentavos` é o que garante que a quebra é
 * REAGRUPAMENTO de um número que `alocarCusto` já produziu — não uma segunda
 * fonte. Se algum dia a soma deixar de fechar, é porque a tela passou a inventar
 * número, que é exatamente o risco que o Gate Fiscal (item 1) descartou.
 */
describe("CONTAI-090 — quebra do excedente da nota", () => {
  /** A linha em Estado C: descontada de fato, e quem recolhe é ele. */
  const euSemGuia = (over: Partial<LinhaRetencao> = {}) =>
    linha({ quemRecolhe: "eu", eDescontoEfetivo: true, ...over });

  const soma = (q: QuebraDoExcedente) =>
    q.quebra ? q.porTributo.reduce((t, g) => t + g.valorCentavos, 0) : 0;

  it("(i) zero linha em Estado C → não há o que quebrar", () => {
    // Nenhuma linha.
    expect(quebrarExcedenteDaNota([], 3_490_100)).toEqual({
      quebra: false,
      motivo: "sem_retencao_eu_sem_guia",
    });
    // E as linhas que NÃO são Estado C também não quebram nada: "a empresa"
    // fecha a pendência (ADENDO 3) e "não sei" é Estado A — pendência de
    // IDENTIFICAÇÃO, chip e texto outros, fora de escopo deste ticket.
    expect(
      quebrarExcedenteDaNota([linha({ quemRecolhe: "empresa" })], 3_490_100).quebra,
    ).toBe(false);
    expect(
      quebrarExcedenteDaNota([linha({ quemRecolhe: "nao_sei" })], 3_490_100).quebra,
    ).toBe(false);
  });

  it("(ii) linha informativa com 'eu' não quebra — ela não desconta nada", () => {
    // §4, item 2: percentual informativo (composição do DAS) não é dinheiro
    // descontado, e `motivoDaRetencaoAberta` já devolve `null` para ela. A
    // quebra herda isso em vez de reimplementar a condição.
    const informativa = euSemGuia({ eDescontoEfetivo: false });
    expect(motivoDaRetencaoAberta(informativa, false)).toBeNull();
    expect(quebrarExcedenteDaNota([informativa], 3_490_100)).toEqual({
      quebra: false,
      motivo: "sem_retencao_eu_sem_guia",
    });
  });

  it("(iii) o caso PerfuraTec: falta > retenção → fornecedor + 1 tributo", () => {
    const iss = euSemGuia({
      composicao: "tributo_identificado",
      tributo: "iss",
      valorCentavos: 179_703,
    });
    const q = quebrarExcedenteDaNota([iss], 3_490_100);
    expect(q).toEqual({
      quebra: true,
      aPagarAoFornecedorCentavos: 3_310_397,
      porTributo: [{ rotulo: "ISS", valorCentavos: 179_703 }],
    });
    // (viii) a invariante, nos números do relato.
    expect(q.quebra && q.aPagarAoFornecedorCentavos + soma(q)).toBe(3_490_100);
  });

  it("(iv) o caso Francisco: falta == retenção → X=0, e a tela esconde a linha", () => {
    // Nota de R$ 18.000, PIX de R$ 17.460, retenção de R$ 540 que ele recolhe:
    // o excedente é a guia, e NADA é devido ao fornecedor. É o critério 5 —
    // "R$ 0,00 — nota ainda não paga" afirmaria uma dívida que não existe.
    const q = quebrarExcedenteDaNota([euSemGuia({ valorCentavos: 54_000 })], 54_000);
    expect(q.quebra && q.aPagarAoFornecedorCentavos).toBe(0);
    expect(q.quebra && q.porTributo).toHaveLength(1);
    expect(q.quebra && q.aPagarAoFornecedorCentavos + soma(q)).toBe(54_000);
  });

  it("(v) duas linhas do MESMO tributo somam num item só", () => {
    const q = quebrarExcedenteDaNota(
      [
        euSemGuia({
          id: "a",
          composicao: "tributo_identificado",
          tributo: "iss",
          valorCentavos: 100_000,
        }),
        euSemGuia({
          id: "b",
          composicao: "tributo_identificado",
          tributo: "iss",
          valorCentavos: 79_703,
        }),
      ],
      3_490_100,
    );
    expect(q.quebra && q.porTributo).toEqual([
      { rotulo: "ISS", valorCentavos: 179_703 },
    ]);
    expect(q.quebra && q.aPagarAoFornecedorCentavos + soma(q)).toBe(3_490_100);
  });

  /**
   * **Regra do `contador`, CONTAI-090 (Gate Fiscal, item 3)** — não é citação de
   * parecer anterior: tributos que a nota JÁ abriu nunca se fundem num item
   * "retenção" genérico. Fundi-los reproduziria, em escala menor, a mesma
   * opacidade que motivou o ticket.
   */
  it("(vi) ISS + INSS → um item por tributo, na ordem da 1ª ocorrência", () => {
    const q = quebrarExcedenteDaNota(
      [
        euSemGuia({
          id: "a",
          composicao: "tributo_identificado",
          tributo: "iss",
          valorCentavos: 179_703,
        }),
        euSemGuia({
          id: "b",
          composicao: "tributo_identificado",
          tributo: "inss",
          valorCentavos: 179_703,
        }),
      ],
      3_490_100,
    );
    expect(q.quebra && q.porTributo).toEqual([
      { rotulo: "ISS", valorCentavos: 179_703 },
      { rotulo: "INSS", valorCentavos: 179_703 },
    ]);
    expect(q.quebra && q.aPagarAoFornecedorCentavos).toBe(3_130_694);
    expect(q.quebra && q.aPagarAoFornecedorCentavos + soma(q)).toBe(3_490_100);
  });

  it("(vii) Σ retenção > falta é DADO CONTRADITÓRIO: detectado, nunca textualizado", () => {
    // X seria negativo. O bloco volta ao agregado de sempre — critério 6
    // proíbe inventar texto para um caso que nenhum parecer normatiza.
    expect(quebrarExcedenteDaNota([euSemGuia({ valorCentavos: 54_001 })], 54_000)).toEqual(
      { quebra: false, motivo: "retencao_excede_falta" },
    );
  });

  it("nota já coberta não quebra — Estado C fechou com a guia", () => {
    // `notaCoberta` sai de `faltaPagamentoCentavos <= 0`, nunca de uma segunda
    // soma (critério 3). Com a nota coberta, `motivoDaRetencaoAberta` devolve
    // `null` para "eu", e não há excedente a quebrar nem a exibir.
    expect(quebrarExcedenteDaNota([euSemGuia()], 0).quebra).toBe(false);
  });

  /**
   * **D92** — achado pelo `contador` ao ratificar este ticket: o rótulo do A.2
   * afirma "presumivelmente recolhida por terceiros" ao lado de "Recolhedor
   * confirmado — guia ainda não paga". A correção tira o sufixo, e **só** para
   * quem já respondeu "Eu".
   */
  it("D92 — respondido 'Eu', o rótulo não presume terceiro; nos outros, presume", () => {
    expect(ROTULO_RETENCAO_NAO_DISCRIMINADA_RECOLHEDOR_CONFIRMADO).toBe(
      "retenção não discriminada",
    );
    const combinada = { composicao: "combinado_nao_aberto" as const, tributo: null };
    expect(nomeDaRetencaoARecolher({ ...combinada, quemRecolhe: "eu" })).toBe(
      ROTULO_RETENCAO_NAO_DISCRIMINADA_RECOLHEDOR_CONFIRMADO,
    );
    // ⚠️ Nos outros três estados o rótulo do A.2 continua INTEIRO: lá a
    // presunção de terceiro é justamente o que falta confirmar.
    for (const quemRecolhe of ["empresa", "nao_sei", null] as const) {
      expect(nomeDaRetencaoARecolher({ ...combinada, quemRecolhe })).toBe(
        ROTULO_RETENCAO_NAO_DISCRIMINADA,
      );
    }
    // E o tributo identificado continua se chamando pelo nome, em qualquer
    // estado de quem recolhe — a correção do D92 não toca nesse ramo.
    expect(
      nomeDaRetencaoARecolher({
        composicao: "tributo_identificado",
        tributo: "iss",
        quemRecolhe: "eu",
      }),
    ).toBe("ISS");
  });

  it("o grupo não discriminado usa o rótulo do D92, sem o sufixo de terceiro", () => {
    const q = quebrarExcedenteDaNota(
      [euSemGuia({ composicao: "combinado_nao_aberto", valorCentavos: 54_000 })],
      100_000,
    );
    expect(q.quebra && q.porTributo).toEqual([
      {
        rotulo: ROTULO_RETENCAO_NAO_DISCRIMINADA_RECOLHEDOR_CONFIRMADO,
        valorCentavos: 54_000,
      },
    ]);
  });

  /**
   * ⚠️ **A tela NÃO escolhe chip nem cor** (critério 9): os dois saem do mapa do
   * Estado C, o mesmo que o card da linha e a fila de pendências leem. Chip
   * literal em JSX é como as duas superfícies passam a discordar da mesma
   * pendência.
   */
  it("o chip e a cor da linha de retenção vêm do mapa do Estado C", () => {
    expect(TEXTO_DA_RETENCAO_ABERTA.eu_sem_guia.chip).toBe(
      CHIP_RETENCAO_GUIA_PENDENTE,
    );
    expect(TEXTO_DA_RETENCAO_ABERTA.eu_sem_guia.gravidade).toBe("amb");
  });
});
