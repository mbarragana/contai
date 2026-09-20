import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CABECALHO_AGENDA_COMPROMISSOS,
  chipDoAgendado,
  compromissosElegiveisParaQuitacao,
  compromissosQueBloqueiam,
  decidirRegistro,
  ehVencidoSemResposta,
  exportarAgendaCompromissos,
  montarAgendaDaHome,
  PERGUNTA_QUITACAO,
  preposicaoDeTempo,
  perguntaQuitacao,
  desembolsosCarregados,
  documentosCarregados,
  podeGerarRelatorioAnual,
  podeQuitar,
  QUITACAO_CONSEQUENCIA_DO_NAO,
  QUITACAO_NAO,
  QUITACAO_SIM,
  resumoDoAgendamento,
  saldoDoCompromisso,
} from "@/lib/fiscal/compromisso";
import { formatarBRL } from "@/lib/money";
import type {
  Compromisso,
  CompromissoRow,
  Documento,
  Pagamento,
} from "@/lib/types";
import type { PermissaoRelatorio } from "@/lib/fiscal/compromisso";

/**
 * ⚠️ **O `[]` não typecheca mais** (CONTAI-036, critério 10 — residual 1 do
 * CONTAI-025). Antes, `podeGerarRelatorioAnual(cs, hoje, ano, [])` passava e
 * devolvia `ok: true`: "nenhum desembolso" e "não fui buscar os desembolsos"
 * tinham a mesma forma. Agora o 4º parâmetro é opaco, e um teste que queira
 * dizer "a obra não tem desembolso" tem de dizê-lo passando pelo construtor.
 */
const SEM_DESEMBOLSO = desembolsosCarregados([]);

/**
 * CONTAI-033, critério 11 — o 5º parâmetro, opaco pela mesma razão: "esta obra
 * não tem documento" e "não fui buscar os documentos" deixaram de ter a mesma
 * forma, e o que o colapso liberava agora era saída anual com nota afirmada de
 * memória em pé.
 */
const SEM_DOCUMENTO = documentosCarregados([]);

/** As três saídas liberadas, cada uma com a marca da SUA saída. */
function liberaAsTres(p: PermissaoRelatorio): boolean {
  if (!p.ok) return false;
  return (
    p.bensEDireitos.ano === p.pagamentosEfetuados.ano &&
    p.pagamentosEfetuados.ano === p.afericaoInss.ano
  );
}

const OBRA = "obra-1";
const HOJE = "2026-08-18";

function comp(over: Partial<Compromisso> & { id: string }): Compromisso {
  return {
    obraId: OBRA,
    favorecidoId: "fav-wk",
    favorecidoNome: "WK Construções LTDA",
    valorPrevistoCentavos: 1_000_000, // R$ 10.000,00
    dataPrevista: "2026-09-15",
    origem: "boleto",
    documentoOrigemId: null,
    situacao: "aberto",
    motivoCancelamento: null,
    dataCompra: null,
    pagamentoIds: [],
    adiamentos: 0,
    ...over,
  };
}

function pag(over: Partial<Pagamento> & { id: string }): Pagamento {
  return {
    obraId: OBRA,
    valorCentavos: 1_000_000,
    dataPagamento: "2026-09-17",
    meio: "pix",
    status: "aguardando_nf",
    favorecidoId: "fav-wk",
    favorecidoNome: "WK Construções LTDA",
    favorecidoTipo: "pj",
    comprovantePath: "u/comprovante/pix.png",
    encargosCentavos: 0,
    naoExplicadoCentavos: 0,
    resolucaoDiferenca: null,
    documentoIds: [],
    ...over,
  };
}

// ══ O modelo (critérios 1 e 2) ══════════════════════════════════════════

describe("o modelo: compromisso não tem data de pagamento (critério 1)", () => {
  /**
   * PROVA DE TIPO, avaliada pelo `tsc` e não por este `expect`. Se alguém
   * acrescentar `data_pagamento` a `compromisso` numa migration futura e
   * regerar `lib/database.types.ts`, este alias vira `never` e o typecheck
   * quebra com o nome do arquivo — antes de qualquer teste rodar.
   *
   * A ausência da coluna é o que impede a regra de virar "todo cálculo lembra
   * de filtrar nulo" (parecer §2), que é o defeito do `status` com outro rosto.
   */
  type SemDataDePagamento = "data_pagamento" extends keyof CompromissoRow
    ? never
    : true;
  const provaDeTipo: SemDataDePagamento = true;

  it("a prova de tipo compila e a coluna não existe no schema gerado", () => {
    expect(provaDeTipo).toBe(true);
  });

  it("nenhuma migration cria uma coluna de data de pagamento em compromisso", () => {
    // Inspeção de schema pela FONTE (o SQL versionado). A inspeção do banco
    // vivo, por `information_schema`, é do E2E — as duas existem porque uma
    // pega o que foi escrito e a outra pega o que está aplicado.
    const sql = readFileSync("supabase/migrations/0007_compromisso.sql", "utf-8");
    // Comentários fora: a própria migration EXPLICA por escrito por que
    // `data_pagamento` não está lá, e a explicação não pode reprovar o teste.
    // O que interessa aqui é a DECLARAÇÃO de coluna.
    const semComentarios = sql
      .split("\n")
      .filter((linha) => !linha.trimStart().startsWith("--"))
      .join("\n");
    const corpo = semComentarios.slice(
      semComentarios.indexOf("create table compromisso ("),
      semComentarios.indexOf("create table compromisso_pagamento ("),
    );
    expect(corpo).not.toContain("data_pagamento");
    expect(corpo).toContain("valor_previsto"); // nunca "valor" (Gate Fiscal 6.3)
  });

  it("`pagamento` não ganhou coluna nova (critério 2)", () => {
    const sql = readFileSync("supabase/migrations/0007_compromisso.sql", "utf-8");
    expect(sql).not.toMatch(/alter table pagamento\b/);
  });
});

// ══ O branch do registro (critérios 4, 5, 6, 25, 27) ════════════════════

describe("decidirRegistro — a DATA é o controle", () => {
  it("data no passado grava pagamento", () => {
    expect(decidirRegistro({ meio: "pix", data: "2026-08-05" }, HOJE)).toEqual({
      tipo: "pagamento",
    });
  });

  it("hoje ainda é pagamento — o dinheiro já saiu", () => {
    expect(decidirRegistro({ meio: "pix", data: HOJE }, HOJE)).toEqual({
      tipo: "pagamento",
    });
  });

  it("amanhã é compromisso, não pagamento (critério 6)", () => {
    expect(decidirRegistro({ meio: "pix", data: "2026-08-19" }, HOJE)).toEqual({
      tipo: "compromisso",
    });
    expect(decidirRegistro({ meio: "boleto", data: "2026-09-15" }, HOJE)).toEqual({
      tipo: "compromisso",
    });
  });

  // ⚠️ CONTAI-022: `decidirRegistro` não aceita mais `meio: "cartao"` — nem
  // em tipo, nem em runtime. A compra no cartão nasce compromisso pelo
  // formulário PRÓPRIO da fatura (`lib/fiscal/fatura.ts`), nunca por esta
  // função. Cobertura do gate do parcelamento e do vencimento da fatura
  // mora em `fatura.test.ts`.
});

// ══ Vencido sem resposta e o bloqueio anual (20, 21, 21b, 21c) ══════════

describe("vencido sem resposta", () => {
  it("aberto com data passada é vencido", () => {
    expect(ehVencidoSemResposta(comp({ id: "c1", dataPrevista: "2026-08-10" }), HOJE)).toBe(
      true,
    );
  });

  it("⚠️ nunca expira sozinho: 90 dias atrás continua vencido (critério 20)", () => {
    // Parecer §3: sumiço silencioso "devolve o compromisso para a cabeça dele,
    // que é a falha da meta 1 pelo lado de fora".
    const noventaDiasAtras = "2026-05-20";
    const c = comp({ id: "c1", dataPrevista: noventaDiasAtras });
    expect(ehVencidoSemResposta(c, HOJE)).toBe(true);
    expect(compromissosQueBloqueiam([c], HOJE)).toHaveLength(1);
  });

  it("CONTAI-022, critério 14: compromisso origem='cartao' vencido bloqueia as três saídas igual a boleto/pix", () => {
    // A suíte só cobria boleto/pix contra o bloqueio; os únicos testes com
    // `cartao` eram os de recusa que o CONTAI-022 substituiu. Sem este teste,
    // um refactor futuro poderia ler "cartão não bloqueia porque a fatura
    // ainda não fechou" e passar batido — a fatura é sobre COMO o pagamento
    // nasce, nunca sobre SE o vencido sem resposta trava o relatório.
    const c = comp({
      id: "c1",
      origem: "cartao",
      dataPrevista: "2026-05-20", // 90 dias atrás de HOJE — vencido de sobra
      dataCompra: "2026-04-10",
    });
    expect(ehVencidoSemResposta(c, HOJE)).toBe(true);
    expect(
      podeGerarRelatorioAnual([c], HOJE, 2026, SEM_DESEMBOLSO, SEM_DOCUMENTO),
    ).toEqual({ ok: false, faltamResponder: [c] });
  });

  it("data prevista no futuro não é vencido e não bloqueia (critério 21b)", () => {
    const c = comp({ id: "c1", dataPrevista: "2026-09-15" });
    expect(ehVencidoSemResposta(c, HOJE)).toBe(false);
    expect(liberaAsTres(podeGerarRelatorioAnual([c], HOJE, 2026, SEM_DESEMBOLSO, SEM_DOCUMENTO))).toBe(true);
  });

  it("hoje ainda não venceu — venceu é ONTEM", () => {
    expect(ehVencidoSemResposta(comp({ id: "c1", dataPrevista: HOJE }), HOJE)).toBe(false);
  });

  it("⚠️ SEM DATA DEFINIDA não é vencido e não bloqueia (critério 21b)", () => {
    // Adendo §A, corolário 3: incerteza DECLARADA não é silêncio. Estado
    // alcançável só pelo saldo de uma quitação parcial, nunca na criação.
    const c = comp({ id: "c1", dataPrevista: null });
    expect(ehVencidoSemResposta(c, HOJE)).toBe(false);
    expect(liberaAsTres(podeGerarRelatorioAnual([c], HOJE, 2026, SEM_DESEMBOLSO, SEM_DOCUMENTO))).toBe(true);
  });

  it("cancelado e quitado não bloqueiam — são as respostas (critério 21c)", () => {
    const vencido = { dataPrevista: "2026-08-10" };
    const cancelado = comp({
      id: "c1",
      ...vencido,
      situacao: "cancelado",
      motivoCancelamento: "obra parou",
    });
    const quitado = comp({ id: "c2", ...vencido, situacao: "quitado" });
    expect(
      liberaAsTres(
        podeGerarRelatorioAnual([cancelado, quitado], HOJE, 2026, SEM_DESEMBOLSO, SEM_DOCUMENTO),
      ),
    ).toBe(true);
  });
});

describe("⚠️ bloqueio anual — o `ano` NÃO recorta nada (critério 21, adendo §A)", () => {
  // O caso real do adendo §A: previsto para 28/12/2025, pago de fato em
  // 05/01/2026. Enquanto está sem resposta, NINGUÉM SABE se o desembolso
  // pertence a 2025 ou a 2026 — as duas hipóteses estão vivas ao mesmo tempo.
  const vencido2025 = comp({ id: "c-2025", dataPrevista: "2025-12-28" });

  it("bloqueia o relatório do ano da data prevista", () => {
    // ⚠️ O payload do `ok: false` NÃO carrega mais o termo do terreno: no
    // CONTAI-036 o veto passou a ser POR SAÍDA, e o do terreno deixou de ser
    // veto — virou obrigação tipada dentro do bloco `bensEDireitos`. O que
    // sobrou aqui é o portão TRANSVERSAL, e ele veta as três.
    expect(podeGerarRelatorioAnual([vencido2025], HOJE, 2025, SEM_DESEMBOLSO, SEM_DOCUMENTO)).toEqual({
      ok: false,
      faltamResponder: [vencido2025],
    });
  });

  it("⚠️ bloqueia TAMBÉM o relatório de 2026, e é esse o ponto", () => {
    const r = podeGerarRelatorioAnual([vencido2025], HOJE, 2026, SEM_DESEMBOLSO, SEM_DOCUMENTO);
    expect(
      r.ok,
      "recortar o bloqueio pela data prevista devolve efeito fiscal à PREVISÃO — " +
        "o relatório de 2026 sairia liberado com um desembolso possivelmente dele, " +
        "não registrado, e sem ninguém perguntar nada",
    ).toBe(false);
  });

  it("bloqueia qualquer ano, inclusive um em que nada foi previsto", () => {
    for (const ano of [2024, 2025, 2026, 2027, 2030]) {
      expect(podeGerarRelatorioAnual([vencido2025], HOJE, ano, SEM_DESEMBOLSO, SEM_DOCUMENTO).ok).toBe(false);
    }
  });

  it("devolve a lista do que falta responder, não só o `false`", () => {
    const outro = comp({ id: "c-b", dataPrevista: "2026-07-01" });
    const emDia = comp({ id: "c-c", dataPrevista: "2026-12-01" });
    const r = podeGerarRelatorioAnual([vencido2025, outro, emDia], HOJE, 2026, SEM_DESEMBOLSO, SEM_DOCUMENTO);
    expect(r.ok).toBe(false);
    // ⚠️ `in`, e não `!r.ok`: desde o CONTAI-033 existem DOIS braços de veto, e
    // `faltamResponder` mora só num deles.
    if (!("faltamResponder" in r)) throw new Error("braço de veto errado");
    expect(r.faltamResponder.map((c) => c.id).sort()).toEqual(["c-2025", "c-b"]);
  });

  it("sem compromisso nenhum, o relatório gera", () => {
    expect(
      liberaAsTres(podeGerarRelatorioAnual([], HOJE, 2026, SEM_DESEMBOLSO, SEM_DOCUMENTO)),
    ).toBe(true);
  });
});

// ══ CONTAI-033, critério 11 — o SEGUNDO braço de veto ════════════════════
//
// Fonte: parecer `2026-08-23-anexo-no-desembolso-do-terreno.md`, ADENDO 1 §A.5
// — *"toda pendência criada aqui precisa de superfície própria"* (D47). A
// liberação da superfície 3 admite um `documento` que nunca existiu, afirmado de
// memória; enquanto ele estiver sem arquivo, NENHUMA saída anual sai.

describe("⚠️ nota sem arquivo veta as três saídas (CONTAI-033, crit. 11)", () => {
  const OBRA = "obra-1";

  function docSemArquivo(id: string): Documento {
    return {
      id,
      obraId: OBRA,
      tipo: "nf_servico",
      status: "registrado",
      valorCentavos: 420_000,
      numero: "1042",
      serie: null,
      dataEmissao: "2026-03-20",
      vencimento: null,
      classificacao: "mao_obra",
      destinatarioCpfOk: true,
      retencao11: true,
      motivoQuarentena: null,
      favorecidoId: "fav-1",
      favorecidoNome: "Elétrica Nunes Serviços",
      favorecidoDocumento: "14221900000177",
      // O carimbo inteiro do ticket: nenhuma coluna nova.
      arquivoPath: null,
    };
  }

  function comArquivo(id: string): Documento {
    return { ...docSemArquivo(id), arquivoPath: "u/documento/nf.pdf" };
  }

  it("um documento sem arquivo bloqueia, e devolve a lista", () => {
    const d = docSemArquivo("d1");
    expect(
      podeGerarRelatorioAnual(
        [],
        HOJE,
        2026,
        SEM_DESEMBOLSO,
        documentosCarregados([d, comArquivo("d2")]),
      ),
    ).toEqual({ ok: false, semArquivo: [d] });
  });

  it("todos com arquivo: as três saem", () => {
    expect(
      liberaAsTres(
        podeGerarRelatorioAnual(
          [],
          HOJE,
          2026,
          SEM_DESEMBOLSO,
          documentosCarregados([comArquivo("d1"), comArquivo("d2")]),
        ),
      ),
    ).toBe(true);
  });

  it("⚠️ o `ano` NÃO recorta o veto — mesma doutrina do portão transversal", () => {
    // A nota sem arquivo não tem ano-calendário garantido (quem o decide é o
    // pagamento, regime de caixa), então recortar por ano liberaria o relatório
    // de um ano ao qual ela talvez pertença.
    for (const ano of [2024, 2025, 2026, 2027, 2030]) {
      expect(
        podeGerarRelatorioAnual(
          [],
          HOJE,
          ano,
          SEM_DESEMBOLSO,
          documentosCarregados([docSemArquivo("d1")]),
        ).ok,
      ).toBe(false);
    }
  });

  it("⚠️ quarentena SEM arquivo também veta — o predicado não olha `status`", () => {
    // Confirmação do `contador` em 2026-09-19: a guarda de superfície é
    // ADICIONAL à quarentena, não redundante.
    const d: Documento = {
      ...docSemArquivo("d1"),
      status: "quarentena",
      destinatarioCpfOk: false,
      motivoQuarentena: "…",
    };
    expect(
      podeGerarRelatorioAnual(
        [],
        HOJE,
        2026,
        SEM_DESEMBOLSO,
        documentosCarregados([d]),
      ).ok,
    ).toBe(false);
  });

  it("⚠️ PRECEDÊNCIA: com os dois vetos vivos, o transversal responde primeiro", () => {
    // O portão do CONTAI-019 fica ACIMA porque a resposta do agendamento é o
    // dado que decide o ANO — sem ela não se sabe nem de que relatório se fala.
    // A tela mostra UM motivo de cada vez, e tem de ser o mais estrutural.
    const vencido = comp({ id: "c-2025", dataPrevista: "2025-12-28" });
    const r = podeGerarRelatorioAnual(
      [vencido],
      HOJE,
      2026,
      SEM_DESEMBOLSO,
      documentosCarregados([docSemArquivo("d1")]),
    );
    expect(r).toEqual({ ok: false, faltamResponder: [vencido] });
    expect("semArquivo" in r).toBe(false);
  });

  it("⚠️ RESIDUAL 1 de novo — o literal `[]` NÃO typecheca no 5º parâmetro", () => {
    // Mesma prova de TIPO do CONTAI-036, agora para o documento: "esta obra não
    // tem documento" e "não fui buscar os documentos" não podem ter a mesma
    // forma, porque o colapso libera saída anual com nota de memória em pé.
    // As chamadas ficam numa função que ninguém executa: a falha é de compilação.
    function naoCompila() {
      // @ts-expect-error — o 5º parâmetro é opaco: só a camada de dados o produz
      podeGerarRelatorioAnual([], HOJE, 2026, SEM_DESEMBOLSO, []);
      // E a lista crua também não passa: não basta ter os documentos na mão.
      // @ts-expect-error — `Documento[]` não é `DocumentosCarregados`
      podeGerarRelatorioAnual([], HOJE, 2026, SEM_DESEMBOLSO, [comArquivo("d1")]);
    }
    expect(typeof naoCompila).toBe("function");
    expect(
      podeGerarRelatorioAnual([], HOJE, 2026, SEM_DESEMBOLSO, SEM_DOCUMENTO).ok,
    ).toBe(true);
  });
});

// ══ Saldo (critérios 15, 29 e 30) ═══════════════════════════════════════

describe("saldo do compromisso", () => {
  it("um compromisso quitado por N pagamentos mostra o que falta (critério 15)", () => {
    const c = comp({
      id: "c1",
      valorPrevistoCentavos: 1_000_000,
      pagamentoIds: ["p1", "p2"],
    });
    const pagamentos = [
      pag({ id: "p1", valorCentavos: 400_000 }),
      pag({ id: "p2", valorCentavos: 350_000 }),
      pag({ id: "p3", valorCentavos: 900_000 }), // de outro compromisso
    ];
    expect(saldoDoCompromisso(c, pagamentos)).toBe(250_000);
  });

  it("pagou a mais (encargos): o saldo é zero, nunca negativo", () => {
    const c = comp({ id: "c1", valorPrevistoCentavos: 1_000_000, pagamentoIds: ["p1"] });
    expect(saldoDoCompromisso(c, [pag({ id: "p1", valorCentavos: 1_032_000 })])).toBe(0);
  });
});

// ══ Exportação (critério 23) ════════════════════════════════════════════

describe("exportação em arquivo separado", () => {
  it("a 1ª linha é o cabeçalho LITERAL do Gate Fiscal 6.5", () => {
    const csv = exportarAgendaCompromissos([comp({ id: "c1" })]);
    expect(csv.split("\n")[0]).toBe(
      "AGENDA DE COMPROMISSOS — VALORES PREVISTOS, NÃO EXECUTADOS. NÃO COMPÕEM CUSTO DE AQUISIÇÃO.",
    );
    expect(csv.split("\n")[0]).toBe(CABECALHO_AGENDA_COMPROMISSOS);
  });

  it("a coluna se chama 'valor previsto', nunca 'valor' (Gate Fiscal 6.3)", () => {
    const cabecalhoColunas = exportarAgendaCompromissos([]).split("\n")[1];
    expect(cabecalhoColunas).toContain("valor previsto");
    expect(cabecalhoColunas.split(";")).not.toContain("valor");
  });

  it("nem o arquivo vazio perde o cabeçalho", () => {
    expect(exportarAgendaCompromissos([]).split("\n")[0]).toBe(
      CABECALHO_AGENDA_COMPROMISSOS,
    );
  });

  it("cancelado NÃO some do arquivo: a situação vai numa coluna", () => {
    const csv = exportarAgendaCompromissos([
      comp({
        id: "c1",
        situacao: "cancelado",
        motivoCancelamento: "compra desistida",
      }),
    ]);
    expect(csv).toContain("Cancelado");
    expect(csv).toContain("compra desistida");
  });

  it("sem data definida sai por extenso e vai para o fim da lista", () => {
    const csv = exportarAgendaCompromissos([
      comp({ id: "c-sem", dataPrevista: null }),
      comp({ id: "c-com", dataPrevista: "2026-09-15" }),
    ]);
    const linhas = csv.split("\n");
    expect(linhas[2]).toContain("15/09/2026");
    expect(linhas[3]).toContain("sem data definida");
  });
});

// ══ Sugestão de quitação (critérios 35-41, adendo §C) ═══════════════════

describe("sugestão de quitação — gatilho cumulativo", () => {
  const base = comp({
    id: "c1",
    valorPrevistoCentavos: 1_000_000, // R$ 10.000,00
    dataPrevista: "2026-09-15",
  });

  const elegiveis = (
    pagamento: Pagamento,
    cs: Compromisso[] = [base],
    recusas: { pagamentoId: string; compromissoId: string }[] = [],
  ) => compromissosElegiveisParaQuitacao(pagamento, cs, recusas).map((c) => c.id);

  it("as três condições juntas disparam a sugestão", () => {
    expect(elegiveis(pag({ id: "p1" }))).toEqual(["c1"]);
  });

  it("⚠️ favorecido DIFERENTE não dispara — proibido casar por nome", () => {
    // Adendo §C(a)(1): "CNPJ errado não é typo, é outro favorecido". O nome
    // aqui é IDÊNTICO de propósito: se o casamento fosse por nome, passaria.
    const outro = pag({ id: "p1", favorecidoId: "fav-outro" });
    expect(outro.favorecidoNome).toBe(base.favorecidoNome);
    expect(elegiveis(outro)).toEqual([]);
  });

  it("pagamento sem favorecido identificado não casa com nada", () => {
    expect(elegiveis(pag({ id: "p1", favorecidoId: null }))).toEqual([]);
    expect(
      elegiveis(pag({ id: "p1", favorecidoId: null }), [
        comp({ id: "c1", favorecidoId: null }),
      ]),
    ).toEqual([]);
  });

  describe("faixa de valor: 20% do previsto ou R$ 500,00, o que for maior", () => {
    it("previsto alto: o limite é o percentual — R$ 2.000,00 sobre R$ 10.000,00", () => {
      expect(elegiveis(pag({ id: "p1", valorCentavos: 1_200_000 }))).toEqual(["c1"]);
      expect(elegiveis(pag({ id: "p1", valorCentavos: 1_200_001 }))).toEqual([]);
      expect(elegiveis(pag({ id: "p1", valorCentavos: 800_000 }))).toEqual(["c1"]);
      expect(elegiveis(pag({ id: "p1", valorCentavos: 799_999 }))).toEqual([]);
    });

    it("previsto baixo: o piso de R$ 500,00 vence o percentual", () => {
      // 20% de R$ 1.000,00 = R$ 200,00 < R$ 500,00 → o limite é R$ 500,00.
      const pequeno = [comp({ id: "c1", valorPrevistoCentavos: 100_000 })];
      expect(elegiveis(pag({ id: "p1", valorCentavos: 150_000 }), pequeno)).toEqual([
        "c1",
      ]);
      expect(elegiveis(pag({ id: "p1", valorCentavos: 150_001 }), pequeno)).toEqual([]);
      expect(elegiveis(pag({ id: "p1", valorCentavos: 50_000 }), pequeno)).toEqual(["c1"]);
      expect(elegiveis(pag({ id: "p1", valorCentavos: 49_999 }), pequeno)).toEqual([]);
    });
  });

  describe("janela de datas: 30 dias antes, 60 dias depois", () => {
    it("30 dias antes entra; 31 não", () => {
      expect(elegiveis(pag({ id: "p1", dataPagamento: "2026-08-16" }))).toEqual(["c1"]);
      expect(elegiveis(pag({ id: "p1", dataPagamento: "2026-08-15" }))).toEqual([]);
    });

    it("60 dias depois entra; 61 não", () => {
      expect(elegiveis(pag({ id: "p1", dataPagamento: "2026-11-14" }))).toEqual(["c1"]);
      expect(elegiveis(pag({ id: "p1", dataPagamento: "2026-11-15" }))).toEqual([]);
    });

    it("⚠️ o par 28/12 → 05/01 dispara: a janela NÃO recorta por ano", () => {
      // Adendo §C(a)(3): é exatamente onde a duplicidade custa mais caro —
      // custo no ano errado.
      const virada = [comp({ id: "c1", dataPrevista: "2025-12-28" })];
      const pagamento = pag({ id: "p1", dataPagamento: "2026-01-05" });
      expect(elegiveis(pagamento, virada)).toEqual(["c1"]);
    });
  });

  it("⚠️ vários elegíveis → LISTA TODOS, nunca escolhe o mais próximo (crit. 36)", () => {
    // Escolher é heurística decidindo vínculo (§5.5 do parecer de 17/08):
    // vínculo inferido errado infla custo em silêncio E mata o alerta.
    const cs = [
      comp({ id: "c-longe", dataPrevista: "2026-09-01" }),
      comp({ id: "c-perto", dataPrevista: "2026-09-16" }),
      comp({ id: "c-meio", dataPrevista: "2026-09-10" }),
    ];
    const ids = elegiveis(pag({ id: "p1", dataPagamento: "2026-09-17" }), cs);
    expect(ids).toHaveLength(3);
    expect(ids).toEqual(["c-longe", "c-meio", "c-perto"]); // ordem estável, não ranking
  });

  it("quitado e cancelado não são elegíveis", () => {
    expect(elegiveis(pag({ id: "p1" }), [comp({ id: "c1", situacao: "quitado" })])).toEqual(
      [],
    );
    expect(
      elegiveis(pag({ id: "p1" }), [
        comp({ id: "c1", situacao: "cancelado", motivoCancelamento: "x" }),
      ]),
    ).toEqual([]);
  });

  it("sem data prevista não é elegível — não há janela a comparar", () => {
    expect(elegiveis(pag({ id: "p1" }), [comp({ id: "c1", dataPrevista: null })])).toEqual(
      [],
    );
  });

  it("o par já recusado não repergunta, e os outros pares seguem livres (crit. 39)", () => {
    const cs = [
      comp({ id: "c1", dataPrevista: "2026-09-15" }),
      comp({ id: "c2", dataPrevista: "2026-09-16" }),
    ];
    expect(
      elegiveis(pag({ id: "p1" }), cs, [{ pagamentoId: "p1", compromissoId: "c1" }]),
    ).toEqual(["c2"]);
    // A recusa é POR PAR: outro pagamento continua sendo perguntado sobre c1.
    expect(
      elegiveis(pag({ id: "p9" }), cs, [{ pagamentoId: "p1", compromissoId: "c1" }]),
    ).toEqual(["c1", "c2"]);
  });

  it("obra diferente não é sugerida — nada soma entre matrículas", () => {
    expect(elegiveis(pag({ id: "p1" }), [comp({ id: "c1", obraId: "obra-2" })])).toEqual(
      [],
    );
    expect(podeQuitar({ obraId: "obra-2" }, { obraId: OBRA }).ok).toBe(false);
    expect(podeQuitar({ obraId: OBRA }, { obraId: OBRA }).ok).toBe(true);
  });

  it("⚠️ nenhuma função deste módulo cria vínculo (critério 41)", () => {
    // A sugestão devolve uma LISTA. O compromisso continua aberto, sem
    // pagamento ligado, e o pagamento continua sem compromisso: o vínculo só
    // nasce por ato humano, em `lib/data.ts`.
    const c = comp({ id: "c1" });
    const p = pag({ id: "p1" });
    const antes = { pagamentoIds: [...c.pagamentoIds] };
    compromissosElegiveisParaQuitacao(p, [c], []);
    expect(c.pagamentoIds).toEqual(antes.pagamentoIds);
    expect(c.situacao).toBe("aberto");
    expect(saldoDoCompromisso(c, [p])).toBe(c.valorPrevistoCentavos);
  });
});

describe("textos da sugestão — literais do ADENDO 3 §G.1, critério 38", () => {
  it("⚠️ a pergunta traz a data com ANO — dd/MM/aaaa (§G.2)", () => {
    expect(perguntaQuitacao("2026-09-15")).toBe(
      "Este pagamento quita o agendamento de 15/09/2026?",
    );
  });

  it("⚠️ o par 28/12/2025 → 05/01/2026: a tela de janeiro mostra o ano", () => {
    // §G.2: "perguntar 'quita o agendamento de 28/12?' na tela de janeiro é
    // esconder do usuário exatamente o dado que ele precisa para responder".
    expect(perguntaQuitacao("2025-12-28")).toContain("28/12/2025");
  });

  it("as QUATRO linhas do bloco falam 'agendamento' — meia troca deixa bilíngue", () => {
    expect(PERGUNTA_QUITACAO).toContain("agendamento");
    expect(QUITACAO_SIM).toBe("Sim, quita este agendamento");
    expect(QUITACAO_NAO).toBe("Não, é outro pagamento");
    expect(QUITACAO_CONSEQUENCIA_DO_NAO).toBe(
      "Se não quitar, o agendamento continua em aberto e este pagamento fica registrado sozinho.",
    );
    // Nenhuma das quatro pode ter sobrado com a palavra antiga.
    const bloco = [
      perguntaQuitacao("2026-09-15"),
      QUITACAO_SIM,
      QUITACAO_NAO,
      QUITACAO_CONSEQUENCIA_DO_NAO,
    ].join(" ");
    expect(bloco.toLowerCase()).not.toContain("compromisso");
  });

  it("a 2ª linha diz quem, quanto (previsto) e para quando, com ano", () => {
    expect(
      resumoDoAgendamento(
        comp({
          id: "c1",
          favorecidoNome: "WK Construções",
          valorPrevistoCentavos: 2_500_000,
          dataPrevista: "2026-09-15",
        }),
      ),
    ).toBe(`WK Construções — previsto ${formatarBRL(2_500_000)} para 15/09/2026`);
  });

  it("sem data definida a 2ª linha diz isso, e não inventa data", () => {
    expect(
      resumoDoAgendamento(comp({ id: "c1", dataPrevista: null })),
    ).toContain("sem data definida");
  });

  it("⚠️ o MODELO DE DADOS continua dizendo 'compromisso' — não se traduz schema", () => {
    // §G.1: "mantém-se 'compromisso' no parecer, no modelo de dados e nos
    // nomes de código. Termo de domínio e termo de tela não precisam
    // coincidir."
    const migration = readFileSync(
      "supabase/migrations/0007_compromisso.sql",
      "utf-8",
    );
    expect(migration).toContain("create table compromisso (");
    expect(migration).not.toContain("create table agendamento");
  });

  it("o texto nunca diz 'previsto/efetivado' nem 'regime de caixa' (critério 7)", () => {
    const tudo = [
      QUITACAO_SIM,
      QUITACAO_NAO,
      QUITACAO_CONSEQUENCIA_DO_NAO,
      perguntaQuitacao("2026-09-15"),
      CABECALHO_AGENDA_COMPROMISSOS,
    ].join(" ");
    expect(tudo.toLowerCase()).not.toContain("regime de caixa");
    expect(tudo.toLowerCase()).not.toContain("efetivado");
  });
});


// ══ As quatro marcas e o bloco da home (8, 8b, 42, 43) ══════════════════

describe("preposição de tempo — a 4ª marca (critério 8)", () => {
  it("aberto diz 'para', vencido diz 'era para' — e as duas com ANO", () => {
    expect(preposicaoDeTempo(comp({ id: "c1", dataPrevista: "2026-09-15" }), HOJE)).toBe(
      "para 15/09/2026",
    );
    expect(preposicaoDeTempo(comp({ id: "c1", dataPrevista: "2026-08-10" }), HOJE)).toBe(
      "era para 10/08/2026",
    );
  });

  it("sem data definida não inventa data nem preposição", () => {
    expect(preposicaoDeTempo(comp({ id: "c1", dataPrevista: null }), HOJE)).toBe(
      "sem data definida",
    );
  });
});

describe("chip — o eixo do critério 8b", () => {
  it("aberto: 'Agendado', vazado", () => {
    expect(chipDoAgendado(comp({ id: "c1", dataPrevista: "2026-09-15" }), HOJE)).toEqual({
      texto: "Agendado",
      forte: false,
    });
  });

  it("vencido: nomeia o vencimento E o silêncio, preenchido", () => {
    expect(chipDoAgendado(comp({ id: "c1", dataPrevista: "2026-08-10" }), HOJE)).toEqual({
      texto: "Venceu em 10/08/2026 · 8 dias sem resposta",
      forte: true,
    });
  });

  it("um dia de silêncio fala no singular", () => {
    expect(
      chipDoAgendado(comp({ id: "c1", dataPrevista: "2026-08-17" }), HOJE).texto,
    ).toContain("1 dia sem resposta");
  });
});

describe("bloco de agendados da home (critérios 42 e 43)", () => {
  const cenario = (n: number, base: string) =>
    Array.from({ length: n }, (_, i) =>
      comp({ id: `${base}-${i}`, dataPrevista: `${base}-${String(i + 1).padStart(2, "0")}` }),
    );

  it("⚠️ 1 vencido + 5 abertos → todos os vencidos, 3 abertos, total 5", () => {
    const agenda = montarAgendaDaHome(
      [comp({ id: "v1", dataPrevista: "2026-08-10" }), ...cenario(5, "2026-09")],
      HOJE,
    );
    expect(agenda.vencidos).toHaveLength(1);
    expect(agenda.abertos).toHaveLength(3);
    expect(agenda.abertosTotal).toBe(5);
  });

  it("⚠️ vencido NUNCA é truncado — 7 vencidos aparecem os 7", () => {
    // Truncar vencido é o sumiço silencioso que o parecer §3 proíbe.
    const agenda = montarAgendaDaHome(cenario(7, "2026-05"), HOJE);
    expect(agenda.vencidos).toHaveLength(7);
  });

  it("abertos saem por data prevista CRESCENTE", () => {
    const agenda = montarAgendaDaHome(
      [
        comp({ id: "c-dez", dataPrevista: "2026-12-01" }),
        comp({ id: "c-set", dataPrevista: "2026-09-01" }),
        comp({ id: "c-out", dataPrevista: "2026-10-01" }),
      ],
      HOJE,
    );
    expect(agenda.abertos.map((c) => c.id)).toEqual(["c-set", "c-out", "c-dez"]);
  });

  it("⚠️ a contagem é de ITENS, e não existe soma de valores", () => {
    const agenda = montarAgendaDaHome(
      [comp({ id: "v1", dataPrevista: "2026-08-10" }), ...cenario(3, "2026-09")],
      HOJE,
    );
    expect(agenda.contagem).toBe("3 ainda não pagos, 1 já venceu");
    // Nenhum campo do bloco carrega dinheiro: previsão de fluxo de caixa é
    // fora de escopo declarado, e número em reais ao lado do custo confirmado
    // vira "quanto a obra tem marcado" (critério 42).
    expect(Object.keys(agenda).sort()).toEqual([
      "abertos",
      "abertosTotal",
      "contagem",
      "vazia",
      "vencidos",
    ]);
    expect(JSON.stringify(agenda)).not.toContain("R$");
  });

  it("⚠️ a tela /compromisso não corta: `Infinity` mostra todos os abertos", () => {
    // O corte de 3 é da HOME. Cortar de novo no destino do "ver todos (N)"
    // seria esconder duas vezes.
    const agenda = montarAgendaDaHome(cenario(9, "2026-09"), HOJE, Infinity);
    expect(agenda.abertos).toHaveLength(9);
    expect(agenda.abertosTotal).toBe(9);
  });

  it("quitado e cancelado saem da lista assim que respondidos", () => {
    const agenda = montarAgendaDaHome(
      [
        comp({ id: "q", dataPrevista: "2026-08-10", situacao: "quitado" }),
        comp({ id: "x", dataPrevista: "2026-08-10", situacao: "cancelado", motivoCancelamento: "m" }),
      ],
      HOJE,
    );
    expect(agenda.vazia).toBe(true);
    expect(agenda.contagem).toBe("");
  });

  it("sem data definida continua na agenda, e não conta como vencido", () => {
    const agenda = montarAgendaDaHome([comp({ id: "c1", dataPrevista: null })], HOJE);
    expect(agenda.vencidos).toHaveLength(0);
    expect(agenda.abertos.map((c) => c.id)).toEqual(["c1"]);
  });
});
