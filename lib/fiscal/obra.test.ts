import { describe, expect, it } from "vitest";

import {
  exigeAvisoEquiparacao,
  diasEntre,
  escolherObraAtiva,
  estadoDataInicio,
  formatarDataBR,
  fraseDoPrazoCno,
  janelaSemCnoDias,
  podeCorrigirObra,
  prazoCno,
  somarDias,
  temPrazoCorrendo,
  validarObra,
  type EntradaObra,
} from "@/lib/fiscal/obra";

/**
 * Regras fiscais do CONTAI-003. As datas do mock aprovado servem de caso de
 * verdade: obra iniciada em 15/03/2026, CNO registrado em 02/04/2026, "hoje"
 * 10/08/2026.
 */

const INICIO = "2026-03-15";
const HOJE = "2026-08-10";

describe("prazo do CNO", () => {
  it("conta o atraso a partir do VENCIMENTO, não do início da obra", () => {
    // Adendo do contador (2026-08-10): o mock dizia 148 dias (hoje − início) na
    // mesma frase em que cita o prazo de 30 dias. O número que a lei sustenta é
    // 118 — dizer 148 é somar o prazo ao atraso.
    const prazo = prazoCno(INICIO, HOJE);
    expect(prazo.vencimento).toBe("2026-04-14");
    expect(prazo.situacao).toBe("em_atraso");
    expect(prazo.dias).toBe(118);
    expect(diasEntre(INICIO, HOJE)).toBe(148);
  });

  it("distingue vencer hoje de estar dentro do prazo", () => {
    expect(prazoCno(INICIO, "2026-04-14")).toMatchObject({
      situacao: "vence_hoje",
      dias: 0,
    });
    expect(prazoCno(INICIO, "2026-04-04")).toMatchObject({
      situacao: "no_prazo",
      dias: 10,
    });
  });

  it("não conta prazo de obra que ainda não começou", () => {
    expect(temPrazoCorrendo("2026-09-01", HOJE)).toBe(false);
    expect(temPrazoCorrendo(INICIO, HOJE)).toBe(true);
    expect(temPrazoCorrendo("", HOJE)).toBe(false);
  });

  it("a frase de tela diz o atraso em dias e a data de vencimento", () => {
    const frase = fraseDoPrazoCno(INICIO, HOJE);
    expect(frase).toContain("30 dias contados do início da obra");
    expect(frase).toContain("Lei 8.212/91, art. 49");
    expect(frase).toContain("começou em 15/03/2026");
    expect(frase).toContain("venceu em 14/04/2026");
    expect(frase).toContain("118 dias em atraso");
    expect(frase).not.toContain("148");
  });

  it("dentro do prazo a frase não fala em atraso", () => {
    const frase = fraseDoPrazoCno(INICIO, "2026-04-04");
    expect(frase).toContain("faltam 10 dias");
    expect(frase).not.toContain("atraso");
  });

  it("no dia do vencimento a frase diz 'vence hoje' — sem atraso e sem contagem", () => {
    // O dia 30 é o último dia útil da obrigação: dizer "faltam 0 dias" ou
    // "0 dias em atraso" transformaria a única data acionável do prazo em
    // ruído. É o estado que o Mateus vê na véspera de perder o prazo.
    const frase = fraseDoPrazoCno(INICIO, "2026-04-14");
    expect(frase).toContain("começou em 15/03/2026");
    expect(frase).toContain("o prazo vence hoje");
    expect(frase).not.toContain("atraso");
    expect(frase).not.toContain("faltam");
    // "30 dias" só pode aparecer como o prazo legal, nunca como contagem: a
    // única outra menção seria "0 dias", que é o ruído que este estado evita.
    expect(frase).not.toContain("0 dias em atraso");
    expect(frase.replace("30 dias contados do início", "")).not.toMatch(
      /\d+ dias/,
    );
  });

  it("sem data de início não inventa número nenhum", () => {
    const frase = fraseDoPrazoCno("", HOJE);
    expect(frase).toContain("Informe a data real de início");
    expect(frase).not.toMatch(/\d+ dias em atraso/);
  });

  it("data de início FUTURA não é tratada como campo em branco", () => {
    // Ressalva do Gate 2: a frase de "sem data" pedia "informe a data real" a
    // quem já tinha informado — mentira de tela. E nenhum prazo é contado a
    // partir de uma data que ainda não chegou.
    const frase = fraseDoPrazoCno("2026-09-01", HOJE);
    expect(frase).toContain("01/09/2026");
    expect(frase).toContain("no futuro");
    expect(frase).toContain("Corrija para a data real de início");
    expect(frase).not.toContain("Informe a data real de início desta obra");
    expect(frase).not.toMatch(/\d+ dias em atraso/);
    expect(frase).not.toContain("faltam");
  });

  it("estadoDataInicio separa ausente, futura e corrente", () => {
    expect(estadoDataInicio("", HOJE)).toBe("ausente");
    expect(estadoDataInicio("2026-02-30", HOJE)).toBe("ausente");
    expect(estadoDataInicio("2026-09-01", HOJE)).toBe("futura");
    expect(estadoDataInicio(INICIO, HOJE)).toBe("corrente");
    // Obra que começa hoje já tem prazo correndo.
    expect(estadoDataInicio(HOJE, HOJE)).toBe("corrente");
  });
});

describe("aritmética de datas", () => {
  it("não escorrega de dia ao atravessar o horário de verão", () => {
    // Fuso do canteiro é UTC−3; a conta é feita em UTC de propósito.
    expect(somarDias("2026-02-14", 30)).toBe("2026-03-16");
    expect(somarDias("2026-10-17", 1)).toBe("2026-10-18");
    expect(diasEntre("2026-12-31", "2027-01-01")).toBe(1);
    expect(formatarDataBR("2026-03-15")).toBe("15/03/2026");
  });

  it("janela sem CNO = do início da obra até o registro", () => {
    expect(janelaSemCnoDias(INICIO, "2026-04-02")).toBe(18);
    expect(janelaSemCnoDias(INICIO, null)).toBeNull();
    // CNO registrado no mesmo dia do início: janela zero, não negativa.
    expect(janelaSemCnoDias(INICIO, INICIO)).toBe(0);
  });
});

// ⚠️ O custo do terreno saiu deste arquivo no CONTAI-010, junto com as três
// colunas de valor: ele é um número POR ANO (regime de caixa) e mora agora em
// `lib/fiscal/terreno.ts` (`custoTerrenoAteOAno`), com testes próprios.

describe("aviso de equiparação a empresa (critério 11)", () => {
  it("dispara com mais de uma unidade OU com desmembramento", () => {
    expect(
      exigeAvisoEquiparacao({
        unidadesAutonomas: 2,
        origemDesmembramentoLoteamento: false,
      }),
    ).toBe(true);
    expect(
      exigeAvisoEquiparacao({
        unidadesAutonomas: 1,
        origemDesmembramentoLoteamento: true,
      }),
    ).toBe(true);
  });

  it("duas obras com uma unidade cada não disparam nada", () => {
    // Q11 do Mateus: a equiparação é taxativa (loteamento, desmembramento ou
    // incorporação) e não decorre de quantidade de obras nem de intenção.
    expect(
      exigeAvisoEquiparacao({
        unidadesAutonomas: 1,
        origemDesmembramentoLoteamento: false,
      }),
    ).toBe(false);
  });
});

describe("obra ativa", () => {
  const a = { id: "obra-a" };
  const b = { id: "obra-b" };

  it("devolve a obra que a preferência aponta", () => {
    expect(escolherObraAtiva([a, b], "obra-b")).toBe(b);
  });

  it("sem preferência NÃO escolhe — nem a primeira, nem a única", () => {
    expect(escolherObraAtiva([a, b], null)).toBeNull();
    expect(escolherObraAtiva([a], null)).toBeNull();
    expect(escolherObraAtiva([a], "")).toBeNull();
  });

  it("preferência que aponta para obra inexistente não vira fallback", () => {
    // Celular novo, obra apagada, sessão de outro usuário: cair na obra 1 aqui
    // é exatamente o `order by created_at limit 1` que este ticket matou.
    expect(escolherObraAtiva([a, b], "obra-que-nao-existe")).toBeNull();
    expect(escolherObraAtiva([], "obra-a")).toBeNull();
  });
});

describe("correção da obra de um registro", () => {
  it("material e boleto não têm o que revalidar", () => {
    expect(
      podeCorrigirObra({
        tipo: "nf_material",
        cnoReferenciado: "12.345.67890/26",
        cnoDestino: null,
      }),
    ).toEqual({ permitido: true, aviso: null });
    expect(
      podeCorrigirObra({
        tipo: null,
        cnoReferenciado: null,
        cnoDestino: null,
      }),
    ).toEqual({ permitido: true, aviso: null });
  });

  it("NF de serviço com o mesmo CNO da obra de destino passa", () => {
    // Pontuação diferente é o mesmo CNO.
    const r = podeCorrigirObra({
      tipo: "nf_servico",
      cnoReferenciado: "12.345.67890/26",
      cnoDestino: "123456789026",
    });
    expect(r.permitido).toBe(true);
  });

  it("NF de serviço com CNO diferente é barrada", () => {
    const r = podeCorrigirObra({
      tipo: "nf_servico",
      cnoReferenciado: "12.345.67890/26",
      cnoDestino: "98.765.43210/26",
    });
    expect(r.permitido).toBe(false);
    if (!r.permitido) expect(r.motivo).toContain("diferente");
  });

  it("NF de serviço com CNO indo para obra SEM CNO é barrada", () => {
    const r = podeCorrigirObra({
      tipo: "nf_servico",
      cnoReferenciado: "12.345.67890/26",
      cnoDestino: null,
    });
    expect(r.permitido).toBe(false);
  });

  it("CNO da nota ainda não capturado: permite com aviso, nunca barra", () => {
    // O campo nasce no CONTAI-007; barrar por desconhecimento fecharia a única
    // saída de um erro que se descobre tarde.
    const r = podeCorrigirObra({
      tipo: "nf_servico",
      cnoReferenciado: null,
      cnoDestino: "12.345.67890/26",
    });
    expect(r.permitido).toBe(true);
    if (r.permitido) expect(r.aviso).toContain("não foi capturado");
  });
});

describe("validação do cadastro de obra", () => {
  const VALIDA: EntradaObra = {
    nome: "Casa do Morro",
    municipio: "Florianópolis",
    matricula: "45.892",
    cartorio: "2º Ofício",
    dataInicioObra: INICIO,
    temCno: "nao",
    cno: "",
    cnoRegistradoEm: "",
    naturezaAquisicaoTerreno: null,
    unidadesAutonomas: 1,
    origemDesmembramentoLoteamento: false,
  };

  const campos = (e: EntradaObra) => validarObra(e, HOJE).map((x) => x.campo);

  it("obra sem CNO é válida — a ausência é pendência, não bloqueio", () => {
    expect(validarObra(VALIDA, HOJE)).toEqual([]);
  });

  it("data de início é obrigatória com ou sem CNO", () => {
    expect(campos({ ...VALIDA, dataInicioObra: "" })).toContain("dataInicioObra");
    expect(campos({ ...VALIDA, dataInicioObra: "2026-02-30" })).toContain(
      "dataInicioObra",
    );
  });

  it("data de início no futuro é recusada; a de hoje passa", () => {
    // Mesma trava da data de pagamento: a data de início ancora o vencimento
    // do CNO e o período da aferição, então uma data futura esconde o atraso
    // real e desloca a janela que o CONTAI-007 vai cobrar.
    const futura = validarObra(
      { ...VALIDA, dataInicioObra: "2026-08-11" },
      HOJE,
    );
    expect(futura.find((x) => x.campo === "dataInicioObra")?.mensagem).toContain(
      "Data no futuro",
    );
    expect(campos({ ...VALIDA, dataInicioObra: HOJE })).not.toContain(
      "dataInicioObra",
    );
  });

  it("exige responder sobre o CNO — 'em branco' não é resposta", () => {
    expect(campos({ ...VALIDA, temCno: null })).toContain("temCno");
  });

  it("com CNO, exige número e data de registro", () => {
    const comCno = { ...VALIDA, temCno: "sim" as const };
    expect(campos(comCno)).toEqual(
      expect.arrayContaining(["cno", "cnoRegistradoEm"]),
    );
  });

  it("CNO não pode ter sido registrado antes do início da obra", () => {
    expect(
      campos({
        ...VALIDA,
        temCno: "sim",
        cno: "12.345.67890/26",
        cnoRegistradoEm: "2026-03-14",
      }),
    ).toContain("cnoRegistradoEm");
  });

  it("natureza da aquisição em branco NÃO bloqueia (critério 23)", () => {
    // A obra que já existe não tinha como responder isso — vira pendência de
    // COMPLEMENTO, visível no painel do terreno, e continua salvável. Travar
    // aqui devolveria o Mateus para a planilha por causa de um campo que o app
    // acabou de inventar.
    expect(campos({ ...VALIDA, naturezaAquisicaoTerreno: null })).not.toContain(
      "naturezaAquisicaoTerreno",
    );
    expect(
      validarObra({ ...VALIDA, naturezaAquisicaoTerreno: "financiado" }, HOJE),
    ).toEqual([]);
  });

  it("premissas do produto são obrigatórias (critério 11)", () => {
    expect(campos({ ...VALIDA, unidadesAutonomas: 0 })).toContain(
      "unidadesAutonomas",
    );
    expect(
      campos({ ...VALIDA, origemDesmembramentoLoteamento: null }),
    ).toContain("origemDesmembramentoLoteamento");
  });
});
