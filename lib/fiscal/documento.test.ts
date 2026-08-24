import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  avisaInss,
  classificacaoProposta,
  duplicataDe,
  EMISSAO_NO_FUTURO,
  exigeIdentificacaoDaNota,
  exigeRetencao,
  motivoQuarentena,
  MOTIVO_QUARENTENA_CPF,
  numeroParaBanco,
  retencaoParaBanco,
  serieParaBanco,
  statusDocumento,
  validarDocumento,
  type EntradaDocumento,
} from "@/lib/fiscal/documento";

const CNPJ_VALIDO = "11.222.333/0001-81";

/** "Hoje" fixo: as regras de data recebem o dia por parâmetro. */
const HOJE = "2026-08-24";

function entradaValida(over: Partial<EntradaDocumento> = {}): EntradaDocumento {
  return {
    tipo: "nf_material",
    favorecidoNome: "Casa do Construtor Ltda",
    favorecidoDocumento: CNPJ_VALIDO,
    valorCentavos: 485000,
    numero: "1042",
    serie: "",
    dataEmissao: "2026-03-20",
    vencimento: null,
    classificacao: "material",
    notaNoCpf: "sim",
    retencao11: null,
    temArquivo: true,
    ...over,
  };
}

describe("classificacaoProposta", () => {
  it("propõe a partir do tipo, sem chutar no boleto", () => {
    expect(classificacaoProposta("nf_material")).toBe("material");
    expect(classificacaoProposta("nf_servico")).toBe("mao_obra");
    // Boleto não diz o que foi comprado: incerteza vai para revisão humana.
    expect(classificacaoProposta("boleto")).toBeNull();
    expect(classificacaoProposta(null)).toBeNull();
  });
});

describe("statusDocumento", () => {
  it("nota fora do CPF do dono nasce em quarentena", () => {
    expect(statusDocumento("nf_material", "nao")).toBe("quarentena");
    expect(statusDocumento("nf_servico", "nao")).toBe("quarentena");
    // Quarentena vence sobre a regra do boleto (constraint do banco).
    expect(statusDocumento("boleto", "nao")).toBe("quarentena");
    expect(motivoQuarentena("nao")).toBe(MOTIVO_QUARENTENA_CPF);
  });

  it("boleto no CPF certo fica aguardando pagamento — não é documento hábil", () => {
    expect(statusDocumento("boleto", "sim")).toBe("aguardando_pagamento");
  });

  it("NF no CPF certo nasce registrada", () => {
    expect(statusDocumento("nf_material", "sim")).toBe("registrado");
    expect(statusDocumento("nf_servico", "sim")).toBe("registrado");
    expect(motivoQuarentena("sim")).toBeNull();
  });
});

describe("retenção 11%", () => {
  it("só é perguntada em NF de serviço", () => {
    expect(exigeRetencao("nf_servico")).toBe(true);
    expect(exigeRetencao("nf_material")).toBe(false);
    expect(exigeRetencao("boleto")).toBe(false);
  });

  it("'não sei' não vira 'não': vai como desconhecido", () => {
    expect(retencaoParaBanco("sim")).toBe(true);
    expect(retencaoParaBanco("nao")).toBe(false);
    expect(retencaoParaBanco("nao_sei")).toBeNull();
    expect(retencaoParaBanco(null)).toBeNull();
  });

  it("avisa do INSS em 'não' e em 'não sei', nunca em 'sim'", () => {
    expect(avisaInss("nf_servico", "nao")).toBe(true);
    expect(avisaInss("nf_servico", "nao_sei")).toBe(true);
    expect(avisaInss("nf_servico", "sim")).toBe(false);
    // Sem resposta ainda: a validação bloqueia, o aviso não aparece antes.
    expect(avisaInss("nf_servico", null)).toBe(false);
    // Material é irrelevante para a aferição do INSS.
    expect(avisaInss("nf_material", "nao")).toBe(false);
    expect(avisaInss("boleto", "nao")).toBe(false);
  });
});

describe("validarDocumento", () => {
  const campos = (e: EntradaDocumento) =>
    validarDocumento(e, HOJE).map((x) => x.campo);

  it("entrada completa passa", () => {
    expect(validarDocumento(entradaValida(), HOJE)).toEqual([]);
  });

  it("sem arquivo não salva — o acervo nasce no registro", () => {
    expect(campos(entradaValida({ temArquivo: false }))).toContain("temArquivo");
  });

  it("sem responder o check do CPF não salva (critério 4)", () => {
    expect(campos(entradaValida({ notaNoCpf: null }))).toContain("notaNoCpf");
  });

  it("NF de serviço sem responder a retenção não salva (critério 5)", () => {
    expect(
      campos(entradaValida({ tipo: "nf_servico", classificacao: "mao_obra" })),
    ).toContain("retencao11");
  });

  it("NF de material não exige resposta de retenção", () => {
    expect(campos(entradaValida({ retencao11: null }))).not.toContain(
      "retencao11",
    );
  });

  it("classificação em branco não salva — nunca chute silencioso", () => {
    expect(campos(entradaValida({ classificacao: null }))).toContain(
      "classificacao",
    );
  });

  it("boleto exige vencimento", () => {
    expect(
      campos(
        entradaValida({ tipo: "boleto", classificacao: "material", vencimento: null }),
      ),
    ).toContain("vencimento");
  });

  it("CNPJ inválido e valor zerado não passam", () => {
    const erros = campos(
      entradaValida({ favorecidoDocumento: "11.222.333/0001-82", valorCentavos: 0 }),
    );
    expect(erros).toContain("favorecidoDocumento");
    expect(erros).toContain("valorCentavos");
  });

  // ── CONTAI-004 (R5): número e data de emissão ──────────────────────────

  it("NF de material e de serviço exigem número e data de emissão", () => {
    for (const tipo of ["nf_material", "nf_servico"] as const) {
      const erros = campos(
        entradaValida({
          tipo,
          classificacao: tipo === "nf_servico" ? "mao_obra" : "material",
          retencao11: tipo === "nf_servico" ? "sim" : null,
          numero: "",
          dataEmissao: "",
        }),
      );
      expect(erros).toContain("numero");
      expect(erros).toContain("dataEmissao");
    }
  });

  it("número só de espaço não vale por número", () => {
    expect(campos(entradaValida({ numero: "   " }))).toContain("numero");
  });

  it("⚠️ continua obrigatório na nota que vai para QUARENTENA", () => {
    // Contraintuitivo e correto (R5): é a nota errada que precisa ser
    // identificada para ser cancelada e reemitida — em NF-e, carta de correção
    // não altera destinatário. Sem número não há o que pedir ao fornecedor.
    const erros = campos(
      entradaValida({ notaNoCpf: "nao", numero: "", dataEmissao: "" }),
    );
    expect(erros).toContain("numero");
    expect(erros).toContain("dataEmissao");
  });

  it("boleto NÃO é perguntado — nem número, nem data de emissão", () => {
    expect(exigeIdentificacaoDaNota("boleto")).toBe(false);
    const erros = campos(
      entradaValida({
        tipo: "boleto",
        classificacao: "material",
        vencimento: "2026-09-10",
        numero: "",
        dataEmissao: "",
      }),
    );
    expect(erros).not.toContain("numero");
    expect(erros).not.toContain("dataEmissao");
    expect(erros).toEqual([]);
  });

  it("(R4) emissão no futuro é recusada com mensagem PRÓPRIA", () => {
    const erros = validarDocumento(
      entradaValida({ dataEmissao: "2026-08-25" }),
      HOJE,
    );
    expect(erros.map((e) => e.campo)).toContain("dataEmissao");
    const mensagem = erros.find((e) => e.campo === "dataEmissao")?.mensagem;
    expect(mensagem).toBe(EMISSAO_NO_FUTURO);
    // A mensagem da data de PAGAMENTO futura fala de regime de caixa; esta
    // fala de coerência documental. Trocar uma pela outra é defeito fiscal.
    expect(mensagem).not.toContain("o custo entra no ano do pagamento");
    // Hoje passa.
    expect(validarDocumento(entradaValida({ dataEmissao: HOJE }), HOJE)).toEqual(
      [],
    );
  });

  it("(R4) emissão ANTERIOR ao início da obra é legítima e não avisa nada", () => {
    // Projeto, ART, ITBI e escritura antecedem a obra.
    expect(
      validarDocumento(entradaValida({ dataEmissao: "2019-02-11" }), HOJE),
    ).toEqual([]);
  });

  it("(R6) série NUNCA bloqueia — nem toda NFS-e tem série", () => {
    // Exigir a série faria o Mateus inventar um valor para o formulário
    // deixá-lo salvar, que é a falha que a proibição de default nomeia.
    expect(campos(entradaValida({ serie: "" }))).toEqual([]);
    expect(campos(entradaValida({ tipo: "nf_servico", classificacao: "mao_obra", retencao11: "sim", serie: "" }))).toEqual(
      [],
    );
  });

  it("data de emissão inexistente no calendário não passa", () => {
    expect(campos(entradaValida({ dataEmissao: "2026-02-30" }))).toContain(
      "dataEmissao",
    );
  });
});

// ── R1 — A RESSALVA MAIS CARA DO TICKET ───────────────────────────────────

describe("R1: nenhuma ordem entre data de emissão e data de pagamento", () => {
  it("nota emitida DEPOIS do pagamento passa sem um erro sequer", () => {
    // O caso mais frequente do projeto (Relato 002, D6): PIX mensal à
    // empreiteira ao longo de meses e UMA NF consolidada emitida no fim. Uma
    // validação `data_pagamento >= data_emissao` recusaria este registro — e
    // recusar registro de fato consumado é a falha da meta 1 pelo lado de fora.
    expect(
      validarDocumento(
        entradaValida({ tipo: "nf_material", dataEmissao: "2026-08-20" }),
        HOJE,
      ),
    ).toEqual([]);
  });

  it("`EntradaDocumento` não conhece data de pagamento — e não pode conhecer", () => {
    const entrada = entradaValida();
    expect(Object.keys(entrada)).not.toContain("dataPagamento");
    // @ts-expect-error a data do pagamento não entra na validação do documento
    validarDocumento({ ...entrada, dataPagamento: "2026-01-05" }, HOJE);
  });

  it("⚠️ nenhum arquivo compara emissão com pagamento (o teste que fica vermelho)", () => {
    // Este é o teste que o critério 6 exige: comentário não protege nada
    // (lição do `cnoReferenciado` hard-coded, Gate 2 do CONTAI-003). Quem
    // escrever `dataEmissao > dataPagamento` — ou a versão em snake_case, no
    // banco ou na tela — derruba a suíte com o nome do arquivo.
    const arquivos = [
      ...readdirSync("lib/fiscal")
        .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
        .map((f) => `lib/fiscal/${f}`),
      "lib/data.ts",
      "app/adicionar/documento/page.tsx",
      "app/documento/[id]/page.tsx",
      "supabase/migrations/0012_documento_numero_emissao.sql",
    ];
    expect(arquivos.length).toBeGreaterThan(5); // o teste vale alguma coisa

    const EMISSAO = String.raw`data_?[eE]missao`;
    const PAGAMENTO = String.raw`data_?[pP]agamento`;
    // Operadores E métodos: `localeCompare`/`compare` são a forma mais
    // plausível de reintroduzir a ordem entre as duas datas sem escrever um
    // `<` (item 3 do Gate 2) — ISO compara lexicograficamente, então
    // `a.localeCompare(b)` é a MESMA regra proibida com outra sintaxe.
    const OPERADOR = String.raw`([<>]=?|\.\s*(localeCompare|compare)\s*\()`;
    const comparacao = new RegExp(
      `(${EMISSAO}[^;\n]{0,80}${OPERADOR}[^;\n]{0,80}${PAGAMENTO})` +
        `|(${PAGAMENTO}[^;\n]{0,80}${OPERADOR}[^;\n]{0,80}${EMISSAO})`,
    );

    for (const arquivo of arquivos) {
      // Comentários fora: o próprio código do ticket NOMEIA a proibição em
      // texto, e é o código executável que precisa ficar limpo.
      const fonte = readFileSync(arquivo, "utf-8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/^\s*--.*$/gm, "");
      expect(
        comparacao.test(fonte),
        `${arquivo} compara data de emissão com data de pagamento — proibido pela R1 do parecer 2026-08-16`,
      ).toBe(false);
    }
  });
});

// ── R2 — o número é texto, e é literal ───────────────────────────────────

describe("numeroParaBanco (R2)", () => {
  it("preserva zeros à esquerda, letras, barras e pontos", () => {
    expect(numeroParaBanco("000123")).toBe("000123");
    expect(numeroParaBanco("1042/A")).toBe("1042/A");
    expect(numeroParaBanco("2026.000.114")).toBe("2026.000.114");
    expect(numeroParaBanco("NFS-e 88-b")).toBe("NFS-e 88-b");
    // Nada de conversão numérica: o número da NFS-e municipal morreria nela.
    expect(numeroParaBanco("000123")).not.toBe("123");
    expect(Number.isNaN(Number(numeroParaBanco("1042/A")))).toBe(true);
  });

  it("só o espaço em volta sai; vazio vira null, nunca string vazia", () => {
    expect(numeroParaBanco("  1042  ")).toBe("1042");
    expect(numeroParaBanco("")).toBeNull();
    expect(numeroParaBanco("   ")).toBeNull();
  });
});

describe("serieParaBanco (R6)", () => {
  it("preserva o que foi digitado e vira null quando não há série", () => {
    expect(serieParaBanco("2")).toBe("2");
    expect(serieParaBanco("00A")).toBe("00A");
    expect(serieParaBanco("  3 ")).toBe("3");
    // Ausência é `null`, nunca "", "S/N" ou "1" por conveniência: série
    // inventada estragaria a comparação que ela existe para afinar.
    expect(serieParaBanco("")).toBeNull();
    expect(serieParaBanco("   ")).toBeNull();
  });
});

// ── R7 / critério 11 — duplicidade avisa, nunca bloqueia ─────────────────

describe("duplicataDe", () => {
  const registrado = {
    id: "d1",
    numero: "1042",
    serie: null,
    emitenteDocumento: "11222333000181",
    registradoEm: "2026-03-15",
  };
  const comSerie = { ...registrado, id: "d2", serie: "1" };

  it("mesmo número + mesmo emitente + mesma série = possível duplicidade", () => {
    expect(
      duplicataDe(
        { numero: "1042", serie: "", emitenteDocumento: "11222333000181" },
        [registrado],
      ),
    ).toBe(registrado);
    expect(
      duplicataDe(
        { numero: "1042", serie: "1", emitenteDocumento: "11222333000181" },
        [comSerie],
      ),
    ).toBe(comSerie);
  });

  it("mesmo número, emitente DIFERENTE, não é duplicidade", () => {
    // Não existe unicidade global de número: ele é único por emitente + série
    // + modelo. Avisar aqui treinaria o Mateus a ignorar o aviso.
    expect(
      duplicataDe(
        { numero: "1042", serie: "", emitenteDocumento: "99888777000166" },
        [registrado],
      ),
    ).toBeNull();
  });

  it("⚠️ mesmo número e emitente, SÉRIES diferentes, não é duplicidade", () => {
    // A série 2 do mesmo emitente pode ter uma nota 1042 legítima. Sem esta
    // comparação o aviso dispararia errado — e aviso que erra é aviso que se
    // aprende a ignorar, o que mata a defesa contra custo contado duas vezes.
    expect(
      duplicataDe(
        { numero: "1042", serie: "2", emitenteDocumento: "11222333000181" },
        [comSerie],
      ),
    ).toBeNull();
    // Série ausente dos dois lados conta como igual: "sem série" é um estado,
    // não um coringa que casa com qualquer série.
    expect(
      duplicataDe(
        { numero: "1042", serie: "1", emitenteDocumento: "11222333000181" },
        [registrado],
      ),
    ).toBeNull();
  });

  it("a comparação é literal — `000123` não é `123`", () => {
    expect(
      duplicataDe(
        { numero: "01042", serie: "", emitenteDocumento: "11222333000181" },
        [registrado],
      ),
    ).toBeNull();
  });

  it("sem número ou sem emitente na tela, não se afirma duplicidade", () => {
    expect(
      duplicataDe(
        { numero: "", serie: "", emitenteDocumento: "11222333000181" },
        [registrado],
      ),
    ).toBeNull();
    expect(
      duplicataDe({ numero: "1042", serie: "", emitenteDocumento: "" }, [
        registrado,
      ]),
    ).toBeNull();
  });
});
