import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  avisaInss,
  bloqueiaPorCnoDeOutraObra,
  classificacaoProposta,
  cnoReferenciadoParaBanco,
  duplicataDe,
  EMISSAO_NO_FUTURO,
  estadoExibido,
  faltaOArquivo,
  exigeCnoReferenciado,
  exigeIdentificacaoDaNota,
  exigeRetencao,
  motivoQuarentena,
  MOTIVO_QUARENTENA_CPF,
  notaTrazCnoParaBanco,
  numeroParaBanco,
  pendenteDeCno,
  retencaoParaBanco,
  serieParaBanco,
  statusDocumento,
  validarDocumento,
  type EntradaDocumento,
} from "@/lib/fiscal/documento";
import { CONSEQUENCIA_CNO_DA_NOTA } from "@/lib/fiscal/obra";

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
    // CONTAI-007: a base é NF de material, onde a pergunta do CNO não existe.
    // Os testes de NF de serviço passam a resposta explicitamente.
    cnoNaNota: null,
    cnoDaObra: "12.345.67890/26",
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

describe("⚠️ CONTAI-033, Guarda 3 — `estadoExibido`, e NENHUM status novo", () => {
  // Parecer ADENDO 1 §A.3 + D52 (fechada pelo `cto-obra`): `status_documento`
  // NÃO ganha valor novo. `quarentena` significa *destinatário ≠ CPF*, é escrita
  // pelo sistema, sustenta a constraint `documento_quarentena_coerente` e
  // colidiria com o `aguardando_pagamento` do boleto. "Sem arquivo" é uma
  // SEGUNDA DIMENSÃO — `arquivo_path IS NULL` — e o rótulo é DERIVADO.
  const base = { status: "registrado", arquivoPath: "u/documento/nf.pdf" } as const;

  it("os quatro estados, e só esta função os monta", () => {
    expect(estadoExibido(base)).toBe("registrado");
    expect(estadoExibido({ ...base, arquivoPath: null })).toBe(
      "registrado_sem_arquivo",
    );
    expect(estadoExibido({ ...base, status: "quarentena" })).toBe("quarentena");
    expect(estadoExibido({ ...base, status: "aguardando_pagamento" })).toBe(
      "aguardando_pagamento",
    );
  });

  it("boleto sem arquivo continua `aguardando_pagamento` — status vence o rótulo", () => {
    // O rótulo é UM; a pendência de "sem arquivo" é OUTRA coisa, e quem a
    // levanta é o predicado `arquivoPath === null`, na tela e no agregado. Se
    // esta função devolvesse `registrado_sem_arquivo` aqui, o boleto perderia a
    // sua própria consequência ("não é documento hábil sozinho").
    expect(
      estadoExibido({ status: "aguardando_pagamento", arquivoPath: null }),
    ).toBe("aguardando_pagamento");
  });

  it("⚠️ quarentena SEM arquivo: as duas pendências, nunca uma no lugar da outra", () => {
    // Confirmação do `contador` em 2026-09-19: as guardas são ADITIVAS. O
    // rótulo único diz `quarentena` (é o estado mais grave) e `faltaOArquivo`
    // continua `true` — é por ELE que a tela mostra as duas.
    //
    // ⚠️ Este teste nasceu de um defeito REAL, pego pelo E2E no Gate 1: o
    // bloco da pendência estava condicionado a
    // `estadoExibido(d) === "registrado_sem_arquivo"`, e por isso desaparecia
    // justamente no caso em que as duas coexistem. Rótulo e predicado são
    // perguntas DIFERENTES, e confundi-los reabre a D47.
    const doc = { status: "quarentena", arquivoPath: null } as const;
    expect(estadoExibido(doc)).toBe("quarentena");
    expect(faltaOArquivo(doc)).toBe(true);
  });

  it("`faltaOArquivo` é o predicado ÚNICO, e não olha `status`", () => {
    // A tela, o agregado do `ResumoObra` e o veto da saída anual usam TODOS
    // esta função. `arquivoPath === null` escrito à mão em cada lugar é o
    // "segundo caminho" do pre-mortem 1 do ticket.
    expect(faltaOArquivo({ arquivoPath: null })).toBe(true);
    expect(faltaOArquivo({ arquivoPath: "u/documento/nf.pdf" })).toBe(false);
    // String vazia NÃO é ausência: `""` seria um path, e o ticket escolheu
    // `null` justamente para não haver dois jeitos de dizer "não tem".
    expect(faltaOArquivo({ arquivoPath: "" })).toBe(false);
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

  it("⚠️ CONTAI-033 — SEM ARQUIVO SALVA: a recusa aqui era o defeito", () => {
    // Era o inverso disto até 2026-09-19, e o teste carimbava a recusa como
    // comportamento certo. O parecer `2026-08-23-anexo-no-desembolso-do-terreno`,
    // ADENDO 1 §A.0, nomeia o erro de enquadramento: o arquivo da nota é
    // **PROVA** do que o Mateus digitou (ele leu emitente, valor e tipo na
    // mensagem do WhatsApp), não FONTE do dado — e "bloquear anexo-PROVA não
    // evita erro nenhum: evita o registro".
    //
    // `EntradaDocumento` não tem mais `temArquivo`: a falta do arquivo deixou
    // de ser erro de campo e virou (a) a pergunta do §A.7.1 na hora de salvar e
    // (b) as três guardas — `ehDocumentoHabil`, `estadoExibido` e o agregado do
    // `ResumoObra`. Um `temArquivo` de volta aqui é a recusa voltando disfarçada.
    expect(validarDocumento(entradaValida(), HOJE)).toEqual([]);
    expect(Object.keys(entradaValida())).not.toContain("temArquivo");
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
    expect(
      campos(
        entradaValida({
          tipo: "nf_servico",
          classificacao: "mao_obra",
          retencao11: "sim",
          // CONTAI-007: NF de serviço passa a exigir a resposta do CNO. Ela
          // entra aqui para o teste continuar falando só de SÉRIE.
          cnoNaNota: "desta_obra",
          serie: "",
        }),
      ),
    ).toEqual([]);
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

// ══ CONTAI-007 · o CNO impresso na NF de serviço ═════════════════════════
//
// Gate Fiscal (parecer de 2026-08-09, Q8). As quatro condições "se X → Y" do
// ticket estão aqui, uma a uma — é este arquivo que fica vermelho se alguém
// afrouxar o bloqueio ou transformar "não traz CNO" em branco silencioso.

describe("CONTAI-007 · qual CNO está impresso nesta nota", () => {
  const CNO_DA_OBRA = "12.345.67890/26";

  function servico(over: Partial<EntradaDocumento> = {}): EntradaDocumento {
    return entradaValida({
      tipo: "nf_servico",
      classificacao: "mao_obra",
      retencao11: "sim",
      cnoNaNota: "desta_obra",
      ...over,
    });
  }

  const campos = (e: EntradaDocumento) =>
    validarDocumento(e, HOJE).map((x) => x.campo);

  it("a pergunta só existe em NF de serviço (critério 1)", () => {
    // Material não abate aferição nenhuma e boleto não é documentação hábil:
    // perguntar ali é atrito sem consequência, que fabrica carimbo.
    expect(exigeCnoReferenciado("nf_servico")).toBe(true);
    expect(exigeCnoReferenciado("nf_material")).toBe(false);
    expect(exigeCnoReferenciado("boleto")).toBe(false);
    expect(exigeCnoReferenciado(null)).toBe(false);
  });

  it("sem resposta não salva — em branco silencioso é o que o ticket proíbe", () => {
    expect(campos(servico({ cnoNaNota: null }))).toContain("cnoNaNota");
    // E em NF de material a ausência de resposta não gera erro nenhum.
    expect(
      campos(entradaValida({ tipo: "nf_material", cnoNaNota: null })),
    ).not.toContain("cnoNaNota");
  });

  it("⚠️ CNO de outra obra é BLOQUEIO, com a redação do critério 2", () => {
    // Bloqueio na VALIDAÇÃO, e não só na tela: é esta linha que garante o
    // critério 6 (nenhuma linha em `documento`, nenhum objeto no bucket),
    // porque `validarDocumento` roda ANTES do upload para o acervo.
    const erros = validarDocumento(servico({ cnoNaNota: "outra_obra" }), HOJE);
    expect(erros.map((e) => e.campo)).toContain("cnoNaNota");
    expect(erros.find((e) => e.campo === "cnoNaNota")?.mensagem).toBe(
      CONSEQUENCIA_CNO_DA_NOTA,
    );
    expect(bloqueiaPorCnoDeOutraObra("nf_servico", "outra_obra")).toBe(true);
    expect(bloqueiaPorCnoDeOutraObra("nf_material", "outra_obra")).toBe(false);
  });

  it("⚠️ 'a nota não traz CNO' SALVA — pendência, nunca bloqueio (critério 3)", () => {
    // Gate Fiscal, 4ª condição: a nota sem CNO não abate a aferição, mas
    // CONTINUA sendo documentação hábil para o custo de aquisição (IN SRF
    // 84/2001, art. 17). Bloquear aqui perderia o custo para salvar o INSS.
    expect(validarDocumento(servico({ cnoNaNota: "nao_traz" }), HOJE)).toEqual(
      [],
    );
    expect(pendenteDeCno("nf_servico", "nao_traz")).toBe(true);
    expect(pendenteDeCno("nf_servico", "desta_obra")).toBe(false);
  });

  it("grava o NÚMERO impresso, nunca um 'sim'", () => {
    // O papel não muda quando o cadastro da obra muda: guardar o número é o
    // que faz uma divergência posterior aparecer em vez de sumir.
    expect(
      cnoReferenciadoParaBanco("nf_servico", "desta_obra", CNO_DA_OBRA),
    ).toBe(CNO_DA_OBRA);
    expect(notaTrazCnoParaBanco("nf_servico", "desta_obra")).toBe(true);
  });

  it("⚠️ 'não traz' vira FALSE, e 'não perguntado' vira NULL", () => {
    // É esta distinção que justifica duas colunas em vez de uma: colapsar os
    // dois faria "a nota não traz CNO" virar indistinguível de "ninguém
    // perguntou" — o branco silencioso do critério 3.
    expect(notaTrazCnoParaBanco("nf_servico", "nao_traz")).toBe(false);
    expect(cnoReferenciadoParaBanco("nf_servico", "nao_traz", CNO_DA_OBRA)).toBe(
      null,
    );

    expect(notaTrazCnoParaBanco("nf_material", "desta_obra")).toBeNull();
    expect(notaTrazCnoParaBanco("nf_servico", null)).toBeNull();
    expect(
      cnoReferenciadoParaBanco("nf_material", "desta_obra", CNO_DA_OBRA),
    ).toBeNull();
  });

  it("⚠️ 'outra obra' nunca produz gravação — nem do CNO da outra obra", () => {
    // Devolver algo aqui seria oferecer a gravação que o critério 2 proíbe.
    expect(
      cnoReferenciadoParaBanco("nf_servico", "outra_obra", CNO_DA_OBRA),
    ).toBeNull();
    expect(notaTrazCnoParaBanco("nf_servico", "outra_obra")).toBeNull();
  });

  it("obra sem CNO: 'não traz' continua salvando (o caminho comum da Q13)", () => {
    // Enquanto a obra não tem CNO, nenhuma nota pode trazer o CNO dela — e o
    // registro não pode parar por isso: o custo de aquisição não depende do
    // CNO (CNO_NAO_MUDA_IRPF).
    expect(
      cnoReferenciadoParaBanco("nf_servico", "nao_traz", null),
    ).toBeNull();
    expect(validarDocumento(servico({ cnoNaNota: "nao_traz" }), HOJE)).toEqual(
      [],
    );
  });
});

// ⚠️ Gate 2 do CONTAI-007 — a afirmação impossível, barrada na VALIDAÇÃO.
describe("CONTAI-007 · 'desta obra' numa obra sem CNO", () => {
  it("não salva: a obra não tem CNO para estar impresso em nota nenhuma", () => {
    // A tela nem oferece a opção. Esta checagem existe porque esconder botão é
    // proteção de render — e ela roda ANTES do upload para o acervo, enquanto
    // o check da migration 0015 só acusaria depois do objeto já gravado.
    const erros = validarDocumento(
      entradaValida({
        tipo: "nf_servico",
        classificacao: "mao_obra",
        retencao11: "sim",
        cnoNaNota: "desta_obra",
        cnoDaObra: null,
      }),
      HOJE,
    );
    expect(erros.map((e) => e.campo)).toContain("cnoNaNota");
  });

  it("'a nota não traz CNO' continua salvando na obra sem CNO", () => {
    // É o caminho comum enquanto o CNO não sai (Q13): travar aqui devolveria o
    // Mateus à planilha por um campo que a obra ainda não tem como ter.
    expect(
      validarDocumento(
        entradaValida({
          tipo: "nf_servico",
          classificacao: "mao_obra",
          retencao11: "sim",
          cnoNaNota: "nao_traz",
          cnoDaObra: null,
        }),
        HOJE,
      ),
    ).toEqual([]);
  });
});
