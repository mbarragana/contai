import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  agendamentosPorDocumento,
  CABECALHO_AGENDA_COMPROMISSOS,
  chipDoAgendado,
  CHIP_LIGADO_AO_CONFIRMAR,
  CHIP_PRE_VINCULO,
  compromissosQuePreLigam,
  documentosResolvidosNaConfirmacao,
  identificarDocumentoPreLigado,
  idsDaUniaoDoPreVinculo,
  LIGADO_AO_CONFIRMAR_PORQUE,
  pagamentosNovosPorCompromisso,
  perguntaConfirmarPreVinculos,
  planoDeConversaoDaFatura,
  podePreVincular,
  PRE_VINCULO_CONFIRMAR,
  PRE_VINCULO_REVISAR,
  PRE_VINCULO_SO_EM_ABERTO,
  revalidacoesPendentesDaFatura,
  textoPreVinculoDaNota,
  textoPreVinculoDoCompromisso,
  compromissosElegiveisParaQuitacao,
  compromissosQueBloqueiam,
  decidirRegistro,
  ehVencidoSemResposta,
  exportarAgendaCompromissos,
  montarAgendaDaHome,
  pagoDoCompromisso,
  podeCorrigirValor,
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
  VENCIDO_SEM_RESPOSTA,
} from "@/lib/fiscal/compromisso";
import { MOTIVO_OBRA_DIFERENTE } from "@/lib/fiscal/vinculo";
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
    documentoPrevistoIds: [],
    situacao: "aberto",
    motivoCancelamento: null,
    dataCompra: null,
    pagamentoIds: [],
    adiamentos: 0,
    ...over,
  };
}

/** CONTAI-080 — a nota do lado do pré-vínculo. Espelha o `doc` de `vinculo.test.ts`. */
function doc(over: Partial<Documento> & { id: string }): Documento {
  return {
    obraId: OBRA,
    tipo: "nf_material",
    status: "registrado",
    valorCentavos: 485_000, // R$ 4.850,00 — a nota do concreto do relato
    numero: "1042",
    serie: null,
    dataEmissao: "2026-03-20",
    vencimento: null,
    classificacao: "material",
    destinatarioCpfOk: true,
    retencaoNaNota: null,
    retencoes: [],
    cnoReferenciado: null,
    notaTrazCno: null,
    motivoQuarentena: null,
    favorecidoId: "fav-superbeton",
    favorecidoNome: "Superbeton",
    favorecidoDocumento: "11222333000181",
    arquivoPath: "u/documento/nf.pdf",
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
      retencaoNaNota: "destacada",
    retencoes: [],
      cnoReferenciado: null,
      notaTrazCno: null,
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

// ══ Corrigir o valor previsto (CONTAI-073) ═══════════════════════════════

/**
 * ⚠️ **Estes testes travam a validação da TELA, não a garantia.** Quem garante é
 * a RPC `corrigir_valor_compromisso` (migration 0022), reconferindo tudo DENTRO
 * da transação — o pre-mortem 1 do ticket é exatamente "a guarda do client não
 * vê o pagamento que chegou em outra aba". O E2E cobre esse lado.
 *
 * ⚠️ **Sem impacto fiscal** (Gate Fiscal do ticket): o que estas guardas
 * protegem é `saldoDoCompromisso` de zerar em silêncio, não número de
 * declaração nenhum.
 */
describe("corrigir o valor previsto", () => {
  const ABERTO_SEM_PAGAMENTO = {
    situacao: "aberto" as const,
    atualCentavos: 420_000,
    pagoCentavos: 0,
  };

  it("agendamento aberto e sem quitação parcial: corrige, para cima ou para baixo", () => {
    expect(
      podeCorrigirValor({
        ...ABERTO_SEM_PAGAMENTO,
        texto: "4.850,00",
        motivo: "digitei errado, a parcela é maior",
      }),
    ).toEqual({ ok: true, valorNovoCentavos: 485_000 });

    // Sem pagamento nenhum ligado, DESCER é legítimo: é previsão, e previsão
    // corrigida para menos não zera saldo de coisa nenhuma.
    expect(
      podeCorrigirValor({
        ...ABERTO_SEM_PAGAMENTO,
        texto: "150,00",
        motivo: "era a parcela do mês, não o total",
      }),
    ).toEqual({ ok: true, valorNovoCentavos: 15_000 });
  });

  it("situação não-aberta recusa ANTES de olhar valor ou motivo", () => {
    for (const situacao of ["quitado", "cancelado"] as const) {
      const p = podeCorrigirValor({
        situacao,
        atualCentavos: 420_000,
        pagoCentavos: 0,
        // Valor e motivo perfeitamente válidos — e mesmo assim recusa: fato
        // consumado não se reescreve.
        texto: "4.850,00",
        motivo: "digitei errado",
      });
      expect(p.ok).toBe(false);
      expect(p).toMatchObject({ recusa: "situacao_respondida" });
    }
  });

  /**
   * **A guarda que o `cto-obra` achou** (critério 5). Sem ela,
   * `saldoDoCompromisso` (`max(0, previsto − pago)`) zeraria e o agendamento
   * ficaria `aberto` com saldo zero — estado que o app não sabe ler hoje.
   */
  it("com quitação parcial, valor novo ≤ soma já paga é recusado", () => {
    const comParcial = {
      situacao: "aberto" as const,
      atualCentavos: 1_000_000,
      pagoCentavos: 600_000,
    };

    for (const texto of ["6.000,00", "5.999,99", "1,00"]) {
      const p = podeCorrigirValor({ ...comParcial, texto, motivo: "corrigindo" });
      expect(p.ok, `${texto} não pode passar`).toBe(false);
      expect(p).toMatchObject({ recusa: "menor_ou_igual_ao_pago" });
      // O texto diz QUANTO já foi pago — o Mateus não precisa ir procurar.
      // ⚠️ `formatarBRL`, e não o literal: o `Intl` do pt-BR usa espaço
      // INSEPARÁVEL depois do "R$", e um literal digitado à mão não bate.
      expect(p.ok ? "" : p.motivo).toContain(formatarBRL(600_000));
    }

    // Um centavo acima do pago já passa: o saldo fica R$ 0,01, não zero.
    expect(
      podeCorrigirValor({ ...comParcial, texto: "6.000,01", motivo: "corrigindo" }),
    ).toEqual({ ok: true, valorNovoCentavos: 600_001 });
  });

  it("a precedência dos erros é a do spec §5", () => {
    // 1. vazio não é erro — é a Dica inicial (motivo `null`).
    expect(
      podeCorrigirValor({ ...ABERTO_SEM_PAGAMENTO, texto: "   ", motivo: "" }),
    ).toEqual({ ok: false, recusa: "vazio", motivo: null });

    // 2. não numérico (e negativo, que `parseValorInput` já recusa).
    for (const texto of ["abc", "-100", "4.85,0,0"]) {
      expect(
        podeCorrigirValor({ ...ABERTO_SEM_PAGAMENTO, texto, motivo: "x" }),
      ).toMatchObject({ recusa: "nao_numerico" });
    }

    // 3. igual ao atual vem ANTES de zero e de "≤ pago": correção que não
    // corrige nada não vira linha (critério 3).
    expect(
      podeCorrigirValor({
        ...ABERTO_SEM_PAGAMENTO,
        texto: "4.200,00",
        motivo: "digitei errado",
      }),
    ).toMatchObject({ recusa: "igual_ao_atual" });

    // 4. zero, e o texto aponta para a ação vizinha que já existe.
    const zero = podeCorrigirValor({
      ...ABERTO_SEM_PAGAMENTO,
      texto: "0,00",
      motivo: "não vai mais acontecer",
    });
    expect(zero).toMatchObject({ recusa: "zero" });
    expect(zero.ok ? "" : zero.motivo).toContain("Marcar que não vai ser pago");

    // 5. o motivo é o ÚLTIMO: enquanto o valor está inválido, o erro que
    // aparece é o do valor.
    expect(
      podeCorrigirValor({ ...ABERTO_SEM_PAGAMENTO, texto: "abc", motivo: "" }),
    ).toMatchObject({ recusa: "nao_numerico" });
    expect(
      podeCorrigirValor({ ...ABERTO_SEM_PAGAMENTO, texto: "4.850,00", motivo: "  " }),
    ).toMatchObject({ recusa: "sem_motivo" });
  });

  it("o motivo é obrigatório e não aceita rabisco de uma letra", () => {
    for (const motivo of ["", " ", "ab"]) {
      expect(
        podeCorrigirValor({ ...ABERTO_SEM_PAGAMENTO, texto: "4.850,00", motivo }),
      ).toMatchObject({ recusa: "sem_motivo" });
    }
    expect(
      podeCorrigirValor({ ...ABERTO_SEM_PAGAMENTO, texto: "4.850,00", motivo: "erro" }),
    ).toMatchObject({ ok: true });
  });

  it("`pagoDoCompromisso` conta só os pagamentos DESTE agendamento, valor cheio", () => {
    const c = comp({ id: "c1", pagamentoIds: ["p1", "p2"] });
    const pagamentos = [
      pag({ id: "p1", valorCentavos: 400_000, encargosCentavos: 32_000 }),
      pag({ id: "p2", valorCentavos: 200_000 }),
      pag({ id: "p3", valorCentavos: 900_000 }), // de outro agendamento
    ];
    // Valor CHEIO, encargo incluído: o que quita o credor é o que saiu da
    // conta — a mesma conta de `saldoDoCompromisso`.
    expect(pagoDoCompromisso(c, pagamentos)).toBe(600_000);
    expect(pagoDoCompromisso(comp({ id: "c2" }), pagamentos)).toBe(0);
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
  it("aberto e longe: 'Agendado', urgência comum", () => {
    expect(chipDoAgendado(comp({ id: "c1", dataPrevista: "2026-09-15" }), HOJE)).toEqual({
      texto: "Agendado",
      urgencia: "comum",
    });
  });

  it("vencido: nomeia o vencimento E o silêncio", () => {
    expect(chipDoAgendado(comp({ id: "c1", dataPrevista: "2026-08-10" }), HOJE)).toEqual({
      texto: "Venceu em 10/08/2026 · 8 dias sem resposta",
      urgencia: "vencido",
    });
  });

  it("um dia de silêncio fala no singular", () => {
    expect(
      chipDoAgendado(comp({ id: "c1", dataPrevista: "2026-08-17" }), HOJE).texto,
    ).toContain("1 dia sem resposta");
  });
});

// ══ CONTAI-075 — o destaque ANTES de vencer ══════════════════════════════
//
// A dor: *"hoje o app só reage a agendamento DEPOIS que ele vence"*. O que
// estes testes trancam são as FRONTEIRAS — é onde um `<=` trocado por `<`, ou
// um `diasEntre` com os argumentos invertidos, produz o defeito mais caro
// possível: apagar da tela o único estado que trava relatório anual.

describe("CONTAI-075 — urgência do agendamento nas quatro fronteiras", () => {
  /** `HOJE` é 2026-08-18. Vizinhos imediatos, um por estado. */
  const ONTEM = "2026-08-17";
  const AMANHA = "2026-08-19";
  const DEPOIS_DE_AMANHA = "2026-08-20";

  it("hoje − 1 → vencido, e o texto do vencimento continua intacto", () => {
    // ⚠️ A fronteira que mais importa: o vencido é checado ANTES (critério 11).
    expect(chipDoAgendado(comp({ id: "c1", dataPrevista: ONTEM }), HOJE)).toEqual({
      texto: "Venceu em 17/08/2026 · 1 dia sem resposta",
      urgencia: "vencido",
    });
  });

  it("hoje → 'Vence hoje', e NÃO é vencido", () => {
    expect(chipDoAgendado(comp({ id: "c1", dataPrevista: HOJE }), HOJE)).toEqual({
      texto: "Vence hoje",
      urgencia: "vence_hoje",
    });
    // O gate do bloqueio anual não se mexeu: hoje ainda dá tempo.
    expect(ehVencidoSemResposta(comp({ id: "c1", dataPrevista: HOJE }), HOJE)).toBe(
      false,
    );
    expect(compromissosQueBloqueiam([comp({ id: "c1", dataPrevista: HOJE })], HOJE)).toHaveLength(
      0,
    );
  });

  it("hoje + 1 → 'Vence amanhã'", () => {
    expect(chipDoAgendado(comp({ id: "c1", dataPrevista: AMANHA }), HOJE)).toEqual({
      texto: "Vence amanhã",
      urgencia: "vence_amanha",
    });
  });

  it("hoje + 2 → 'Agendado', igualzinho ao de 30 dias (critério 3)", () => {
    // A janela fecha em dois graus. O terceiro dia é o comportamento de sempre,
    // e é o que prova que não há regressão fora da janela.
    expect(chipDoAgendado(comp({ id: "c1", dataPrevista: DEPOIS_DE_AMANHA }), HOJE)).toEqual({
      texto: "Agendado",
      urgencia: "comum",
    });
    expect(chipDoAgendado(comp({ id: "c1", dataPrevista: "2026-09-17" }), HOJE)).toEqual({
      texto: "Agendado",
      urgencia: "comum",
    });
  });

  it("a virada de mês e de ano não muda nada — a conta é de DIAS, não de string", () => {
    // `dataPrevista > hojeIso` lexicograficamente não diz "é amanhã": 01/09 é
    // MENOR que 31/08 em nenhuma ordem útil, e é aqui que uma comparação de
    // texto no lugar de `diasEntre` quebraria.
    expect(chipDoAgendado(comp({ id: "c1", dataPrevista: "2026-09-01" }), "2026-08-31").urgencia).toBe(
      "vence_amanha",
    );
    expect(chipDoAgendado(comp({ id: "c1", dataPrevista: "2027-01-01" }), "2026-12-31").urgencia).toBe(
      "vence_amanha",
    );
    expect(chipDoAgendado(comp({ id: "c1", dataPrevista: "2026-12-31" }), "2026-12-31").urgencia).toBe(
      "vence_hoje",
    );
  });

  it("sem data prevista continua 'Agendado' — incerteza declarada não é urgência", () => {
    expect(chipDoAgendado(comp({ id: "c1", dataPrevista: null }), HOJE)).toEqual({
      texto: "Agendado",
      urgencia: "comum",
    });
  });

  it("⚠️ quitado/cancelado com data de HOJE não diz 'Vence hoje'", () => {
    // `/compromisso/[id]` renderiza as mesmas marcas para compromisso já
    // respondido. Dizer "Vence hoje" sobre dinheiro que já saiu seria o erro
    // caro que o CONTAI-019 nomeia: o Mateus pagar o mesmo PIX duas vezes.
    expect(
      chipDoAgendado(comp({ id: "q", dataPrevista: HOJE, situacao: "quitado" }), HOJE)
        .urgencia,
    ).toBe("comum");
    expect(
      chipDoAgendado(
        comp({
          id: "x",
          dataPrevista: HOJE,
          situacao: "cancelado",
          motivoCancelamento: "não vai ser pago",
        }),
        HOJE,
      ).urgencia,
    ).toBe("comum");
  });

  it("⚠️ nenhum estado novo promete consequência (critério 13 / Gate Fiscal)", () => {
    // O texto dos dois estados novos é verbo + quando, e nada mais: quem fala
    // de bloqueio de relatório anual é `VENCIDO_SEM_RESPOSTA`, e só ele.
    for (const data of [HOJE, AMANHA]) {
      const texto = chipDoAgendado(comp({ id: "c1", dataPrevista: data }), HOJE).texto;
      expect(texto.toLowerCase()).not.toContain("relatório");
      expect(texto.toLowerCase()).not.toContain("pendência");
      expect(texto.toLowerCase()).not.toContain("risco");
      expect(texto).not.toBe(VENCIDO_SEM_RESPOSTA);
    }
  });

  it("os quatro estados da união são alcançáveis, e são exatamente quatro", () => {
    const alcancados = [ONTEM, HOJE, AMANHA, DEPOIS_DE_AMANHA].map(
      (d) => chipDoAgendado(comp({ id: "c1", dataPrevista: d }), HOJE).urgencia,
    );
    expect(alcancados).toEqual([
      "vencido",
      "vence_hoje",
      "vence_amanha",
      "comum",
    ]);
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

// ══ CONTAI-072 — o agendamento visto DO LADO DA NOTA ═════════════════════
//
// ⚠️ **O que esta função NÃO faz é metade do que ela é** (Gate Fiscal do
// ticket): ela não tira documento de lista nenhuma e não devolve centavo
// nenhum. Compromisso não é pagamento e pode ser cancelado, então a nota hábil
// sem pagamento continua inteira na lista e na soma das duas telas — o que sai
// daqui é texto e destino de link.

describe("agendamentosPorDocumento (CONTAI-072, critérios 3 a 6)", () => {
  it("aberto DENTRO DO PRAZO: 'Agendado', vazado, sem consequência extra", () => {
    const c = comp({
      id: "c1",
      documentoOrigemId: "doc-1",
      dataPrevista: "2026-09-15",
    });
    const marca = agendamentosPorDocumento([c], HOJE).get("doc-1")!;

    expect(marca.compromissoId).toBe("c1");
    expect(marca.chip).toBe("Agendado");
    // Peso, nunca matiz: `comum` é o de baixa urgência.
    expect(marca.urgencia).toBe("comum");
    expect(marca.vencidoSemResposta).toBe(false);
    expect(marca.resumo).toBe(resumoDoAgendamento(c));
    // Dentro do prazo não acrescenta consequência: a tela continua dizendo o
    // que já dizia sobre a nota sem pagamento ligado.
    expect(marca.consequenciaExtra).toBeNull();
    expect(marca.href).toBe("/compromisso/c1");
  });

  it("aberto VENCIDO SEM RESPOSTA: chip escalado, preenchido, e o texto do adendo §A", () => {
    const c = comp({
      id: "c1",
      documentoOrigemId: "doc-1",
      dataPrevista: "2026-08-10",
    });
    const marca = agendamentosPorDocumento([c], HOJE).get("doc-1")!;

    // ⚠️ O MESMO texto do chip que o cartão da agenda usa — nenhuma redação
    // nova entrou neste ticket.
    expect(marca.chip).toBe(chipDoAgendado(c, HOJE).texto);
    expect(marca.chip).toBe("Venceu em 10/08/2026 · 8 dias sem resposta");
    expect(marca.urgencia).toBe("vencido");
    expect(marca.vencidoSemResposta).toBe(true);
    // O texto NÃO suaviza: este estado já trava a geração de qualquer relatório
    // anual (`compromissosQueBloqueiam`), e quem diz isso é a constante.
    expect(marca.consequenciaExtra).toBe(VENCIDO_SEM_RESPOSTA);
    expect(compromissosQueBloqueiam([c], HOJE)).toHaveLength(1);
  });

  it("sem data prevista: marca a nota como agendada e NÃO é vencido (crit. 21b)", () => {
    const c = comp({ id: "c1", documentoOrigemId: "doc-1", dataPrevista: null });
    const marca = agendamentosPorDocumento([c], HOJE).get("doc-1")!;

    expect(marca.vencidoSemResposta).toBe(false);
    expect(marca.chip).toBe("Agendado");
    expect(marca.resumo).toContain("sem data definida");
    expect(marca.consequenciaExtra).toBeNull();
  });

  it("⚠️ quitado e cancelado NÃO marcam nada (critério 5)", () => {
    // A marca reflete o estado ATUAL do compromisso, nunca o histórico de FK no
    // banco: nota cujo agendamento foi cancelado volta a ser uma nota sem
    // nenhum plano, que é a verdade.
    const mapa = agendamentosPorDocumento(
      [
        comp({ id: "q", documentoOrigemId: "doc-1", situacao: "quitado" }),
        comp({
          id: "x",
          documentoOrigemId: "doc-2",
          situacao: "cancelado",
          motivoCancelamento: "cartão não passou",
        }),
      ],
      HOJE,
    );
    expect(mapa.size).toBe(0);
  });

  it("compromisso sem documento de origem não entra: não há nota a marcar", () => {
    const mapa = agendamentosPorDocumento(
      [comp({ id: "c1", documentoOrigemId: null })],
      HOJE,
    );
    expect(mapa.size).toBe(0);
  });

  it("documento sem compromisso nenhum: comportamento de hoje, preservado", () => {
    // O consumidor lê `undefined` e mantém chip, texto e CTA atuais — é o
    // critério 2 do ticket, e é o caminho da maioria das notas.
    expect(agendamentosPorDocumento([], HOJE).get("doc-1")).toBeUndefined();
  });

  describe("mais de um aberto no MESMO documento (critério 6)", () => {
    // Boleto parcelado pela mesma nota é caso legítimo — o ticket proíbe
    // `unique` em `documento_origem_id`. Sem regra de eleição, a tela mudaria de
    // texto conforme a ordem em que o banco devolvesse as linhas.
    it("qualquer vencido tem prioridade sobre qualquer não vencido", () => {
      const mapa = agendamentosPorDocumento(
        [
          comp({ id: "futuro", documentoOrigemId: "doc-1", dataPrevista: "2026-09-15" }),
          comp({ id: "vencido", documentoOrigemId: "doc-1", dataPrevista: "2026-08-10" }),
        ],
        HOJE,
      );
      expect(mapa.get("doc-1")!.compromissoId).toBe("vencido");
      expect(mapa.get("doc-1")!.vencidoSemResposta).toBe(true);
    });

    it("entre vencidos, o de MAIS dias sem resposta", () => {
      const mapa = agendamentosPorDocumento(
        [
          comp({ id: "oito", documentoOrigemId: "doc-1", dataPrevista: "2026-08-10" }),
          comp({ id: "trinta", documentoOrigemId: "doc-1", dataPrevista: "2026-07-19" }),
        ],
        HOJE,
      );
      expect(mapa.get("doc-1")!.compromissoId).toBe("trinta");
      expect(mapa.get("doc-1")!.chip).toContain("30 dias sem resposta");
    });

    it("entre não vencidos, a data prevista mais próxima — e `null` por último", () => {
      const mapa = agendamentosPorDocumento(
        [
          comp({ id: "sem-data", documentoOrigemId: "doc-1", dataPrevista: null }),
          comp({ id: "outubro", documentoOrigemId: "doc-1", dataPrevista: "2026-10-05" }),
          comp({ id: "setembro", documentoOrigemId: "doc-1", dataPrevista: "2026-09-15" }),
        ],
        HOJE,
      );
      expect(mapa.get("doc-1")!.compromissoId).toBe("setembro");
    });

    it("a eleição não depende da ordem de entrada", () => {
      const cs = [
        comp({ id: "a", documentoOrigemId: "doc-1", dataPrevista: "2026-09-15" }),
        comp({ id: "b", documentoOrigemId: "doc-1", dataPrevista: "2026-08-10" }),
        comp({ id: "c", documentoOrigemId: "doc-1", dataPrevista: "2026-07-19" }),
      ];
      const eleito = (ordem: typeof cs) =>
        agendamentosPorDocumento(ordem, HOJE).get("doc-1")!.compromissoId;
      expect(eleito(cs)).toBe("c");
      expect(eleito([...cs].reverse())).toBe("c");
      expect(eleito([cs[1]!, cs[2]!, cs[0]!])).toBe("c");
    });

    it("documentos diferentes não se contaminam", () => {
      const mapa = agendamentosPorDocumento(
        [
          comp({ id: "c1", documentoOrigemId: "doc-1", dataPrevista: "2026-08-10" }),
          comp({ id: "c2", documentoOrigemId: "doc-2", dataPrevista: "2026-09-15" }),
        ],
        HOJE,
      );
      expect(mapa.get("doc-1")!.vencidoSemResposta).toBe(true);
      expect(mapa.get("doc-2")!.vencidoSemResposta).toBe(false);
      expect(mapa.size).toBe(2);
    });
  });

  /**
   * **CONTAI-075 — a marca da nota carrega a MESMA urgência**, e o invariante do
   * critério 9 vale nos quatro estados.
   */
  describe("CONTAI-075 — a urgência do lado da nota", () => {
    const marcaEm = (dataPrevista: string | null) =>
      agendamentosPorDocumento(
        [comp({ id: "c1", documentoOrigemId: "doc-1", dataPrevista })],
        HOJE,
      ).get("doc-1")!;

    it("os quatro estados chegam à nota, com o texto de cada um", () => {
      expect(marcaEm("2026-08-18")).toMatchObject({
        chip: "Vence hoje",
        urgencia: "vence_hoje",
      });
      expect(marcaEm("2026-08-19")).toMatchObject({
        chip: "Vence amanhã",
        urgencia: "vence_amanha",
      });
      expect(marcaEm("2026-08-20")).toMatchObject({
        chip: "Agendado",
        urgencia: "comum",
      });
      expect(marcaEm("2026-08-17")).toMatchObject({ urgencia: "vencido" });
    });

    it("⚠️ INVARIANTE do critério 9: `vencidoSemResposta === (urgencia === 'vencido')`", () => {
      // Os dois campos convivem de propósito — um é o gate do bloqueio anual, o
      // outro é hierarquia visual. Divergirem seria o pior dos mundos: uma tela
      // destacando urgência que o bloqueio não reconhece, ou o contrário.
      for (const data of ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", null]) {
        const marca = marcaEm(data);
        expect(
          marca.vencidoSemResposta,
          `data prevista ${data ?? "null"}`,
        ).toBe(marca.urgencia === "vencido");
      }
    });

    it("⚠️ só o vencido ganha consequência extra — hoje e amanhã não (critério 13)", () => {
      expect(marcaEm("2026-08-18").consequenciaExtra).toBeNull();
      expect(marcaEm("2026-08-19").consequenciaExtra).toBeNull();
      expect(marcaEm("2026-08-17").consequenciaExtra).toBe(VENCIDO_SEM_RESPOSTA);
    });

    /**
     * **Critério 4 — a ELEIÇÃO entre os três estados**, que sai de graça da
     * ordenação por data crescente entre não-vencidos e é por isso que
     * `porPrioridadeDoAgendamento` não mudou neste ticket. O teste existe para o
     * "de graça" não deixar de valer em silêncio num refactor.
     */
    describe("eleição: vencido > vence hoje > vence amanhã > demais", () => {
      const nota = (id: string, dataPrevista: string) =>
        comp({ id, documentoOrigemId: "doc-1", dataPrevista });

      const eleitoEntre = (...cs: ReturnType<typeof nota>[]) =>
        agendamentosPorDocumento(cs, HOJE).get("doc-1")!;

      it("vencido ganha de quem vence hoje", () => {
        const eleito = eleitoEntre(
          nota("hoje", "2026-08-18"),
          nota("vencido", "2026-08-10"),
        );
        expect(eleito.compromissoId).toBe("vencido");
        expect(eleito.urgencia).toBe("vencido");
      });

      it("quem vence hoje ganha de quem vence amanhã", () => {
        const eleito = eleitoEntre(
          nota("amanha", "2026-08-19"),
          nota("hoje", "2026-08-18"),
        );
        expect(eleito.compromissoId).toBe("hoje");
        expect(eleito.urgencia).toBe("vence_hoje");
      });

      it("quem vence amanhã ganha do que está longe", () => {
        const eleito = eleitoEntre(
          nota("longe", "2026-09-30"),
          nota("amanha", "2026-08-19"),
        );
        expect(eleito.compromissoId).toBe("amanha");
        expect(eleito.urgencia).toBe("vence_amanha");
      });

      it("os quatro juntos, em qualquer ordem de entrada, elegem o vencido", () => {
        const cs = [
          nota("longe", "2026-09-30"),
          nota("amanha", "2026-08-19"),
          nota("hoje", "2026-08-18"),
          nota("vencido", "2026-08-10"),
        ];
        expect(eleitoEntre(...cs).compromissoId).toBe("vencido");
        expect(eleitoEntre(...[...cs].reverse()).compromissoId).toBe("vencido");
      });

      it("sem nenhum vencido, os três restantes saem na ordem hoje < amanhã < longe", () => {
        // A ordenação de `montarAgendaDaHome` é a MESMA `porDataPrevista`, e é
        // dela que o critério 4 sai sem código novo.
        const agenda = montarAgendaDaHome(
          [
            comp({ id: "longe", dataPrevista: "2026-09-30" }),
            comp({ id: "amanha", dataPrevista: "2026-08-19" }),
            comp({ id: "hoje", dataPrevista: "2026-08-18" }),
          ],
          HOJE,
        );
        expect(agenda.vencidos).toHaveLength(0);
        expect(agenda.abertos.map((c) => c.id)).toEqual([
          "hoje",
          "amanha",
          "longe",
        ]);
        expect(agenda.abertos.map((c) => chipDoAgendado(c, HOJE).urgencia)).toEqual([
          "vence_hoje",
          "vence_amanha",
          "comum",
        ]);
      });

      it("com vencido, ele vem no bloco de vencidos e os outros três atrás", () => {
        const agenda = montarAgendaDaHome(
          [
            comp({ id: "longe", dataPrevista: "2026-09-30" }),
            comp({ id: "vencido", dataPrevista: "2026-08-10" }),
            comp({ id: "amanha", dataPrevista: "2026-08-19" }),
            comp({ id: "hoje", dataPrevista: "2026-08-18" }),
          ],
          HOJE,
        );
        expect(agenda.vencidos.map((c) => c.id)).toEqual(["vencido"]);
        expect(agenda.abertos.map((c) => c.id)).toEqual([
          "hoje",
          "amanha",
          "longe",
        ]);
      });
    });
  });

  it("⚠️ nenhum campo da marca é dinheiro somável (regra 2 deste módulo)", () => {
    const marca = agendamentosPorDocumento(
      [comp({ id: "c1", documentoOrigemId: "doc-1" })],
      HOJE,
    ).get("doc-1")!;
    // O valor previsto só aparece DENTRO do resumo, já marcado como previsto —
    // não há `...Centavos` a somar com o número do card de notas sem pagamento.
    expect(Object.keys(marca).filter((k) => /Centavos/i.test(k))).toEqual([]);
    expect(marca.resumo).toContain("previsto");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// CONTAI-080 · PRÉ-VÍNCULO — a resolução do N, as guardas e os textos literais
// ══════════════════════════════════════════════════════════════════════════
//
// Fonte normativa: ADENDO 6 (§J.0-J.5), ADENDO 7 (§K.1-K.5) e ADENDO 8
// (§L.1-L.4) de `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`.

describe("documentosResolvidosNaConfirmacao — o N do critério 10", () => {
  const notaA = doc({ id: "doc-a", numero: "1042", valorCentavos: 485_000 });
  const notaB = doc({ id: "doc-b", numero: "1043", valorCentavos: 210_000 });

  it("N=0 · sem origem e sem pré-vínculo: nada resolve", () => {
    const c = comp({ id: "c1" });
    expect(documentosResolvidosNaConfirmacao(c, [notaA, notaB])).toEqual([]);
  });

  it("N=1 · só a nota de origem (o caminho do CONTAI-065, intacto)", () => {
    const c = comp({ id: "c1", documentoOrigemId: "doc-a" });
    const r = documentosResolvidosNaConfirmacao(c, [notaA, notaB]);
    expect(r.map((d) => d.id)).toEqual(["doc-a"]);
  });

  it("N=1 · só pré-vínculo, sem nota de origem", () => {
    const c = comp({ id: "c1", documentoPrevistoIds: ["doc-b"] });
    expect(
      documentosResolvidosNaConfirmacao(c, [notaA, notaB]).map((d) => d.id),
    ).toEqual(["doc-b"]);
  });

  it("N≥2 · origem + pré-vínculo de OUTRA nota — e a origem vem primeiro", () => {
    const c = comp({
      id: "c1",
      documentoOrigemId: "doc-a",
      documentoPrevistoIds: ["doc-b"],
    });
    // ⚠️ É ESTE o caso do pre-mortem 1: contar N só sobre a tabela nova daria
    // N=1 e a conversão automática do §K.2 ligaria `doc-b` sozinha, enquanto o
    // `propagar_vinculo_de_origem` ligaria `doc-a` — dois automatismos
    // independentes competindo pela mesma guarda.
    expect(
      documentosResolvidosNaConfirmacao(c, [notaA, notaB]).map((d) => d.id),
    ).toEqual(["doc-a", "doc-b"]);
  });

  it("⚠️ DEDUPLICAÇÃO · a mesma nota como origem E como pré-vínculo é N=1", () => {
    const c = comp({
      id: "c1",
      documentoOrigemId: "doc-a",
      documentoPrevistoIds: ["doc-a"],
    });
    const r = documentosResolvidosNaConfirmacao(c, [notaA, notaB]);
    // Sem a dedup, o caso mais provável do relato — ele reafirma, pela tela
    // nova, a nota que já era a de origem — cairia em N≥2 e a tela pediria
    // confirmação de um conjunto com uma nota só.
    expect(r.map((d) => d.id)).toEqual(["doc-a"]);
    expect(r).toHaveLength(1);
  });

  it("deduplica também pré-vínculo repetido na própria lista", () => {
    const c = comp({ id: "c1", documentoPrevistoIds: ["doc-b", "doc-b"] });
    expect(
      documentosResolvidosNaConfirmacao(c, [notaA, notaB]),
    ).toHaveLength(1);
  });

  it("nota de OUTRA OBRA não resolve — nada é somado entre matrículas", () => {
    const alheia = doc({ id: "doc-x", obraId: "outra-obra" });
    const c = comp({
      id: "c1",
      documentoOrigemId: "doc-x",
      documentoPrevistoIds: ["doc-b"],
    });
    expect(
      documentosResolvidosNaConfirmacao(c, [alheia, notaB]).map((d) => d.id),
    ).toEqual(["doc-b"]);
  });

  it("id que não está na lista carregada degrada em silêncio, sem estourar", () => {
    const c = comp({ id: "c1", documentoPrevistoIds: ["doc-que-nao-existe"] });
    expect(documentosResolvidosNaConfirmacao(c, [notaA])).toEqual([]);
  });

  it("⚠️ NÃO filtra por situação — a pré-marcação roda com o agendamento já quitado", () => {
    // Critério 13: em `/pagamento/[id]/ligar` o compromisso de origem já está
    // `quitado`. Um filtro de situação aqui apagaria a marca justamente na tela
    // que o botão "Revisar antes de confirmar" abre.
    const c = comp({
      id: "c1",
      situacao: "quitado",
      documentoPrevistoIds: ["doc-a"],
    });
    expect(
      documentosResolvidosNaConfirmacao(c, [notaA]).map((d) => d.id),
    ).toEqual(["doc-a"]);
  });

  it("⚠️ não devolve nada somável: a saída é Documento, sem total nenhum", () => {
    const c = comp({ id: "c1", documentoPrevistoIds: ["doc-a", "doc-b"] });
    const r = documentosResolvidosNaConfirmacao(c, [notaA, notaB]);
    expect(Array.isArray(r)).toBe(true);
    expect(r.every((d) => "valorCentavos" in d)).toBe(true);
  });
});

describe("podePreVincular — a guarda de escrita", () => {
  it("agendamento aberto + nota da mesma obra: pode", () => {
    expect(podePreVincular(comp({ id: "c1" }), { obraId: OBRA }).ok).toBe(true);
  });

  it("nota de outra obra: recusa com o MESMO motivo do vínculo formal", () => {
    const p = podePreVincular(comp({ id: "c1" }), { obraId: "outra-obra" });
    expect(p.ok).toBe(false);
    // ⚠️ O texto é o de `vinculo.ts`, reaproveitado — não uma segunda redação.
    expect(p.ok === false && p.motivo).toBe(MOTIVO_OBRA_DIFERENTE);
  });

  for (const situacao of ["quitado", "cancelado"] as const) {
    it(`agendamento ${situacao}: recusa — a vida do pré-vínculo é a do compromisso`, () => {
      const p = podePreVincular(comp({ id: "c1", situacao }), { obraId: OBRA });
      expect(p.ok).toBe(false);
      expect(p.ok === false && p.motivo).toBe(PRE_VINCULO_SO_EM_ABERTO);
    });
  }

  /**
   * **CONTAI-081, critério 1 — a recusa por cartão NÃO EXISTE MAIS.**
   *
   * Ela existia pelo D2 do Gate 2 do CONTAI-080: o caminho da fatura não contava
   * N e não perguntava nada, então o texto do ADENDO 8 §L.2 mentiria. O
   * CONTAI-081 construiu as duas pontas (`planoDeConversaoDaFatura`,
   * `p_propagar_origem_ids` na migration 0024, `/fatura/[id]/vinculos`), e a
   * restrição virou o oposto do que protegia.
   */
  it("⚠️ CONTAI-081 · as TRÊS origens podem — cartão inclusive", () => {
    for (const origem of ["pix", "boleto", "cartao"] as const) {
      expect(
        podePreVincular(comp({ id: "c1", origem }), { obraId: OBRA }).ok,
        `origem ${origem}`,
      ).toBe(true);
    }
  });

  it("⚠️ cartão já respondido recusa pela SITUAÇÃO, não pela origem", () => {
    // Antes havia duas razões e a da origem vencia. Agora só existe uma, e o
    // texto que o Mateus lê é o que descreve o estado real do agendamento.
    const p = podePreVincular(
      comp({ id: "c1", origem: "cartao", situacao: "quitado" }),
      { obraId: OBRA },
    );
    expect(p.ok).toBe(false);
    expect(p.ok === false && p.motivo).toBe(PRE_VINCULO_SO_EM_ABERTO);
  });

  it("⚠️ a guarda de obra vale para cartão igual às outras origens", () => {
    const p = podePreVincular(comp({ id: "c1", origem: "cartao" }), {
      obraId: "outra-obra",
    });
    expect(p.ok === false && p.motivo).toBe(MOTIVO_OBRA_DIFERENTE);
  });
});

/**
 * **D1 do Gate 2 — a união em IDS, que é a mesma união, num grau de resolução
 * mais grosseiro.** Ela existe porque a sugestão de quitação decide
 * `propagarOrigem` sem ter `Documento[]` em mão.
 */
describe("idsDaUniaoDoPreVinculo — o limite superior do N", () => {
  it("origem + pré-vínculos, deduplicado, com a origem primeiro", () => {
    expect(
      idsDaUniaoDoPreVinculo({
        documentoOrigemId: "doc-a",
        documentoPrevistoIds: ["doc-b", "doc-a"],
      }),
    ).toEqual(["doc-a", "doc-b"]);
  });

  it("sem origem e sem pré-vínculo: vazio (N=0, nada a propagar)", () => {
    expect(
      idsDaUniaoDoPreVinculo({
        documentoOrigemId: null,
        documentoPrevistoIds: [],
      }),
    ).toEqual([]);
  });

  it("origem reafirmada como pré-vínculo é UM id — o caso que decide N=1", () => {
    const ids = idsDaUniaoDoPreVinculo({
      documentoOrigemId: "doc-a",
      documentoPrevistoIds: ["doc-a"],
    });
    expect(ids).toHaveLength(1);
    // É o que faz a sugestão de quitação continuar propagando sozinha neste
    // caso, exatamente como o CONTAI-065 fazia antes deste ticket.
    expect(ids.length < 2).toBe(true);
  });

  /**
   * ⚠️ **A propriedade que sustenta a conservadoria do D1**: resolver só
   * ENCOLHE o conjunto, então a contagem sobre ids nunca é MENOR que a contagem
   * resolvida. Quem decide "posso propagar sozinho?" pelo limite superior erra,
   * no máximo, deixando de automatizar — nunca convertendo parte de um conjunto.
   */
  it("⚠️ a contagem por ids é sempre ≥ a contagem resolvida", () => {
    const daObra = doc({ id: "doc-a" });
    const deOutraObra = doc({ id: "doc-x", obraId: "outra-obra" });
    const c = comp({
      id: "c1",
      documentoOrigemId: "doc-a",
      documentoPrevistoIds: ["doc-x", "doc-inexistente"],
    });
    const porIds = idsDaUniaoDoPreVinculo(c).length;
    const resolvido = documentosResolvidosNaConfirmacao(c, [
      daObra,
      deOutraObra,
    ]).length;
    expect(porIds).toBe(3);
    expect(resolvido).toBe(1);
    expect(porIds).toBeGreaterThanOrEqual(resolvido);
  });
});

describe("os textos literais do pré-vínculo", () => {
  const notaA = doc({ id: "doc-a", numero: "1042", valorCentavos: 485_000 });
  const notaB = doc({ id: "doc-b", numero: "1043", valorCentavos: 210_000 });

  it("o chip é o do §J.2 — e a cor fica na tela, não aqui", () => {
    expect(CHIP_PRE_VINCULO).toBe("Pré-vínculo — ainda não é custo");
  });

  /**
   * Não-bloqueante 1 do Gate 2: depois da correção do D1, "automaticamente" é
   * verdade só para N=1 — o N≥2 nasce do clique em "Sim". A tela do seletor não
   * distingue os dois, e o que é verdade nos dois é "ligado ao confirmar".
   */
  it('⚠️ o chip do "já ligado" não diz "automaticamente"', () => {
    expect(CHIP_LIGADO_AO_CONFIRMAR).toBe("Ligado ao confirmar o agendamento");
    expect(LIGADO_AO_CONFIRMAR_PORQUE).toBe(
      "Ligado ao confirmar o agendamento — você já tinha indicado isso antes de pagar.",
    );
    for (const texto of [CHIP_LIGADO_AO_CONFIRMAR, LIGADO_AO_CONFIRMAR_PORQUE]) {
      expect(texto).not.toContain("automaticamente");
    }
  });

  it("identificação de cada nota: número + valor", () => {
    expect(identificarDocumentoPreLigado(notaA)).toBe(`Nota nº 1042 — ${formatarBRL(485_000)}`);
  });

  it("sem número (boleto), o tipo identifica; sem valor, a frase diz isso", () => {
    expect(
      identificarDocumentoPreLigado(doc({ id: "b", tipo: "boleto", numero: null })),
    ).toBe(`Boleto — ${formatarBRL(485_000)}`);
    expect(
      identificarDocumentoPreLigado(doc({ id: "s", valorCentavos: null })),
    ).toBe("Nota nº 1042 — sem valor informado");
  });

  it("⚠️ VARIANTE N=1 do ADENDO 8 §L.2, palavra por palavra", () => {
    expect(textoPreVinculoDoCompromisso([notaA])).toBe(
      `Você ligou este agendamento a Nota nº 1042 — ${formatarBRL(485_000)} antes de ` +
        "pagar. Isso é só uma intenção registrada: enquanto o pagamento não " +
        "for confirmado, esse valor não entra no custo de aquisição, não abate " +
        "a base do INSS e não aparece em nenhum relatório da declaração. " +
        "Quando você confirmar o pagamento, o sistema vai vincular esta nota " +
        "automaticamente — sem perguntar de novo.",
    );
  });

  it("⚠️ VARIANTE N≥2 do ADENDO 8 §L.2, palavra por palavra", () => {
    expect(textoPreVinculoDoCompromisso([notaA, notaB])).toBe(
      `Você ligou este agendamento a Nota nº 1042 — ${formatarBRL(485_000)}, Nota nº 1043 ` +
        `— ${formatarBRL(210_000)} antes de pagar. Isso é só uma intenção registrada: ` +
        "enquanto o pagamento não for confirmado, esse valor não entra no " +
        "custo de aquisição, não abate a base do INSS e não aparece em nenhum " +
        "relatório da declaração. Quando você confirmar o pagamento, o sistema " +
        "vai te perguntar se este pré-vínculo ainda vale.",
    );
  });

  it("as três primeiras frases NÃO mudam com N; só a última se bifurca (§L.2)", () => {
    const ate = (t: string) => t.slice(0, t.lastIndexOf("Quando você"));
    expect(ate(textoPreVinculoDoCompromisso([notaA]))).toBe(
      ate(textoPreVinculoDoCompromisso([notaA])),
    );
    const n1 = textoPreVinculoDoCompromisso([notaA]);
    const n2 = textoPreVinculoDoCompromisso([notaA, notaB]);
    // A promessa é OPOSTA nas duas, e é esse o ponto do ADENDO 8: o texto do
    // §J.2 original prometia pergunta sempre, e ficou falso para N=1.
    expect(n1).toContain("sem perguntar de novo");
    expect(n2).toContain("vai te perguntar");
    expect(n1).not.toContain("vai te perguntar");
    expect(n2).not.toContain("sem perguntar de novo");
  });

  it('⚠️ a última frase diz "pré-vínculo", nunca "vínculo" sozinho (§L.2)', () => {
    const n2 = textoPreVinculoDoCompromisso([notaA, notaB]);
    expect(n2).toContain("este pré-vínculo ainda vale");
    expect(n2).not.toContain("este vínculo ainda vale");
  });

  it("⚠️ a pergunta do bloco N≥2 é a do §J.3, palavra por palavra", () => {
    expect(perguntaConfirmarPreVinculos([notaA, notaB])).toBe(
      "Confirmar este pagamento também confirma o vínculo com Nota nº 1042 — " +
        `${formatarBRL(485_000)}, Nota nº 1043 — ${formatarBRL(210_000)}, ` +
        "como você já tinha indicado?",
    );
    expect(PRE_VINCULO_CONFIRMAR).toBe("Sim, confirmar os vínculos");
    expect(PRE_VINCULO_REVISAR).toBe("Revisar antes de confirmar");
  });

  it("⚠️ TEXTO DA NOTA (§J.2, bloco da NOTA) com um agendamento só", () => {
    const c = comp({
      id: "c1",
      documentoPrevistoIds: ["doc-a"],
      valorPrevistoCentavos: 320_000,
      dataPrevista: "2026-10-05",
    });
    expect(textoPreVinculoDaNota([c])).toBe(
      `WK Construções LTDA — previsto ${formatarBRL(320_000)} para 05/10/2026 está ` +
        "pré-ligado a esta nota, mas nenhum pagamento aconteceu ainda. Esta " +
        "nota continua sem pagamento vinculado até que um pagamento de verdade " +
        "seja confirmado e ligado a ela — ela segue contando em " +
        '"Notas hábeis sem pagamento vinculado".',
    );
  });

  it("com 2+ agendamentos, a concordância vira plural e a lista cresce", () => {
    const c1 = comp({
      id: "c1",
      valorPrevistoCentavos: 320_000,
      dataPrevista: "2026-10-05",
    });
    const c2 = comp({
      id: "c2",
      favorecidoNome: "Superbeton",
      valorPrevistoCentavos: 210_000,
      dataPrevista: "2026-11-05",
    });
    const texto = textoPreVinculoDaNota([c1, c2]);
    expect(texto).toContain(
      `WK Construções LTDA — previsto ${formatarBRL(320_000)} para 05/10/2026, ` +
        `Superbeton — previsto ${formatarBRL(210_000)} para 05/11/2026 estão pré-ligados a esta nota`,
    );
    // ⚠️ A frase do lado da NOTA não muda por N (ADENDO 8): ela nunca prometeu
    // pergunta nenhuma.
    expect(texto).toContain('segue contando em "Notas hábeis sem pagamento vinculado"');
    expect(texto).not.toContain("perguntar");
  });
});

describe("compromissosQuePreLigam — lista TODOS, sem eleição (critério 6)", () => {
  it("dois agendamentos abertos na mesma nota: os DOIS voltam", () => {
    const a = comp({ id: "c1", documentoPrevistoIds: ["doc-a"] });
    const b = comp({ id: "c2", documentoOrigemId: "doc-a" });
    // ⚠️ O contraste com `agendamentosPorDocumento`, que ELEGE um: a Home
    // mostra 1 aviso por nota de propósito; o detalhe da nota precisa da
    // situação completa (o caso do concreto tem 3 parcelas na mesma nota).
    expect(compromissosQuePreLigam("doc-a", [a, b]).map((c) => c.id)).toEqual([
      "c1",
      "c2",
    ]);
    expect(agendamentosPorDocumento([a, b], HOJE).size).toBe(1);
  });

  it("conta as DUAS fontes: origem e pré-vínculo", () => {
    const so_origem = comp({ id: "c1", documentoOrigemId: "doc-a" });
    const so_previsto = comp({ id: "c2", documentoPrevistoIds: ["doc-a"] });
    const outra = comp({ id: "c3", documentoPrevistoIds: ["doc-z"] });
    expect(
      compromissosQuePreLigam("doc-a", [so_origem, so_previsto, outra]).map(
        (c) => c.id,
      ),
    ).toEqual(["c1", "c2"]);
  });

  it("a mesma nota como origem E pré-vínculo do MESMO agendamento: uma linha só", () => {
    const c = comp({
      id: "c1",
      documentoOrigemId: "doc-a",
      documentoPrevistoIds: ["doc-a"],
    });
    expect(compromissosQuePreLigam("doc-a", [c])).toHaveLength(1);
  });

  for (const situacao of ["quitado", "cancelado"] as const) {
    it(`agendamento ${situacao} não pré-liga nada`, () => {
      const c = comp({ id: "c1", situacao, documentoPrevistoIds: ["doc-a"] });
      expect(compromissosQuePreLigam("doc-a", [c])).toEqual([]);
    });
  }

  it("nota sem agendamento nenhum: lista vazia", () => {
    expect(compromissosQuePreLigam("doc-a", [comp({ id: "c1" })])).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// CONTAI-081 · o pré-vínculo no CARTÃO — o plano da fatura e as pendências
// ══════════════════════════════════════════════════════════════════════════
//
// Fonte normativa: os MESMOS ADENDOS 6/7/8 — sem tese fiscal nova. O que se
// prova aqui é que a bifurcação por N do §K.2 continua sendo UMA regra quando
// vários compromissos resolvem N ao mesmo tempo (uma fatura inteira).

describe("planoDeConversaoDaFatura — os três ramos de N, por compromisso", () => {
  const notaA = doc({ id: "doc-a", numero: "1042", valorCentavos: 320_000 });
  const notaB = doc({ id: "doc-b", numero: "1051", valorCentavos: 165_000 });
  const docs = [notaA, notaB];

  /** Compra no cartão, já aberta e pertencente a uma fatura. */
  function compra(over: Partial<Compromisso> & { id: string }): Compromisso {
    return comp({ origem: "cartao", dataCompra: "2026-03-03", ...over });
  }

  it("N=0 · nada pré-ligado e sem origem: os três baldes vazios", () => {
    const plano = planoDeConversaoDaFatura([compra({ id: "c1" })], docs);
    expect(plano.propagarOrigemIds).toEqual([]);
    expect(plano.automaticos).toEqual([]);
    expect(plano.revalidar).toEqual([]);
  });

  it("N=1 pela ORIGEM · propaga pela RPC E converte sozinho — o CONTAI-065 intacto", () => {
    const c = compra({ id: "c1", documentoOrigemId: "doc-a" });
    const plano = planoDeConversaoDaFatura([c], docs);
    // ⚠️ Está nos DOIS: a RPC cria a linha e `converterPreVinculosDaFatura`
    // repete — a duplicata é no-op (`upsert` com `ignoreDuplicates`), e é essa
    // convergência que faz os dois caminhos acabarem na MESMA linha.
    expect(plano.propagarOrigemIds).toEqual(["c1"]);
    expect(plano.automaticos).toEqual([
      { compromissoId: "c1", obraId: OBRA, documento: notaA },
    ]);
    expect(plano.revalidar).toEqual([]);
  });

  it("N=1 SÓ por pré-vínculo · converte sozinho, e não há origem a propagar", () => {
    const c = compra({ id: "c1", documentoPrevistoIds: ["doc-b"] });
    const plano = planoDeConversaoDaFatura([c], docs);
    // Sem `documentoOrigemId`, mandar o id à RPC não faria nada — e o array diz
    // o que o app quis dizer, em vez de delegar a decisão ao silêncio da RPC.
    expect(plano.propagarOrigemIds).toEqual([]);
    expect(plano.automaticos.map((a) => a.documento.id)).toEqual(["doc-b"]);
    expect(plano.revalidar).toEqual([]);
  });

  it("⚠️ N≥2 · origem + outra nota: NADA propaga e NADA converte sozinho", () => {
    const c = compra({
      id: "c1",
      documentoOrigemId: "doc-a",
      documentoPrevistoIds: ["doc-b"],
    });
    const plano = planoDeConversaoDaFatura([c], docs);
    // ⚠️ **É O PRE-MORTEM 1 DO TICKET, travado por teste.** Com a origem em
    // `propagarOrigemIds`, a RPC gravaria `doc-a` antes de qualquer toque e a
    // revalidação do §J.3 cobriria só `doc-b` — meio conjunto convertido em
    // silêncio, que é o D1 do Gate 2 do CONTAI-080 pela porta do cartão.
    expect(plano.propagarOrigemIds).toEqual([]);
    expect(plano.automaticos).toEqual([]);
    expect(plano.revalidar).toHaveLength(1);
    expect(plano.revalidar[0].resolvidos.map((d) => d.id)).toEqual([
      "doc-a",
      "doc-b",
    ]);
  });

  it("⚠️ DEDUP · origem reafirmada como pré-vínculo é N=1, não N=2", () => {
    const c = compra({
      id: "c1",
      documentoOrigemId: "doc-a",
      documentoPrevistoIds: ["doc-a"],
    });
    const plano = planoDeConversaoDaFatura([c], docs);
    // O caso mais provável do relato: ele pré-liga, pela tela nova, a nota que
    // JÁ era a de origem. Sem a dedup (que mora em `idsDaUniaoDoPreVinculo`, uma
    // vez só), isto cairia em `revalidar` e a tela pediria confirmação de um
    // conjunto com uma nota só.
    expect(plano.revalidar).toEqual([]);
    expect(plano.propagarOrigemIds).toEqual(["c1"]);
    expect(plano.automaticos.map((a) => a.documento.id)).toEqual(["doc-a"]);
  });

  it("nota de OUTRA OBRA não conta para o N — e o que sobra decide o ramo", () => {
    const alheia = doc({ id: "doc-x", obraId: "outra-obra" });
    const c = compra({
      id: "c1",
      documentoOrigemId: "doc-a",
      documentoPrevistoIds: ["doc-x"],
    });
    const plano = planoDeConversaoDaFatura([c], [notaA, alheia]);
    // Resolver ENCOLHE o conjunto: dois ids, um documento — logo N=1.
    expect(plano.revalidar).toEqual([]);
    expect(plano.automaticos.map((a) => a.documento.id)).toEqual(["doc-a"]);
  });

  it("uma fatura com os três ramos ao mesmo tempo — baldes DISJUNTOS", () => {
    const zero = compra({ id: "c0" });
    const um = compra({ id: "c1", documentoOrigemId: "doc-a" });
    const dois = compra({
      id: "c2",
      documentoOrigemId: "doc-a",
      documentoPrevistoIds: ["doc-b"],
    });
    const plano = planoDeConversaoDaFatura([zero, um, dois], docs);
    expect(plano.propagarOrigemIds).toEqual(["c1"]);
    expect(plano.automaticos.map((a) => a.compromissoId)).toEqual(["c1"]);
    expect(plano.revalidar.map((r) => r.compromisso.id)).toEqual(["c2"]);
    // `propagarOrigemIds` é o COMPLEMENTO de `revalidar`: nenhum compromisso
    // aparece nos dois, e é isso que fecha o D1.
    const revalidados = new Set(plano.revalidar.map((r) => r.compromisso.id));
    expect(plano.propagarOrigemIds.some((id) => revalidados.has(id))).toBe(false);
  });

  it("os blocos de revalidação saem em ordem CRONOLÓGICA pela data da compra", () => {
    const tarde = compra({
      id: "c-tarde",
      dataCompra: "2026-03-11",
      documentoOrigemId: "doc-a",
      documentoPrevistoIds: ["doc-b"],
    });
    const cedo = compra({
      id: "c-cedo",
      dataCompra: "2026-03-03",
      documentoOrigemId: "doc-a",
      documentoPrevistoIds: ["doc-b"],
    });
    expect(
      planoDeConversaoDaFatura([tarde, cedo], docs).revalidar.map(
        (r) => r.compromisso.id,
      ),
    ).toEqual(["c-cedo", "c-tarde"]);
  });

  it("⚠️ não devolve dinheiro somável: nenhum campo `...Centavos` no plano", () => {
    const plano = planoDeConversaoDaFatura(
      [compra({ id: "c1", documentoOrigemId: "doc-a" })],
      docs,
    );
    expect(
      Object.keys(plano.automaticos[0]).filter((k) => /Centavos/i.test(k)),
    ).toEqual([]);
  });
});

describe("pagamentosNovosPorCompromisso — o pagamento da RPC por DIFF", () => {
  it("o que não estava antes e está depois é o pagamento novo", () => {
    const antes = [comp({ id: "c1", pagamentoIds: [] })];
    const depois = [comp({ id: "c1", pagamentoIds: ["pag-1"] })];
    expect([...pagamentosNovosPorCompromisso(antes, depois)]).toEqual([
      ["c1", ["pag-1"]],
    ]);
  });

  it("⚠️ pagamento que JÁ existia não volta como novo — é o que o diff protege", () => {
    // Quitação parcial anterior: `pag-antigo` não pode receber o vínculo do
    // pré-vínculo desta rodada.
    const antes = [comp({ id: "c1", pagamentoIds: ["pag-antigo"] })];
    const depois = [comp({ id: "c1", pagamentoIds: ["pag-antigo", "pag-novo"] })];
    expect(pagamentosNovosPorCompromisso(antes, depois).get("c1")).toEqual([
      "pag-novo",
    ]);
  });

  it("compromisso que a RPC ignorou (corrida) não entra no mapa", () => {
    const antes = [comp({ id: "c1", pagamentoIds: [] })];
    const depois = [comp({ id: "c1", pagamentoIds: [] })];
    expect(pagamentosNovosPorCompromisso(antes, depois).size).toBe(0);
  });

  it("⚠️ dois compromissos do MESMO favorecido e valor não se confundem", () => {
    // O caso do relato: duas parcelas iguais na mesma fatura. Casar por
    // data/meio acertaria "quase sempre" e erraria exatamente aqui.
    const antes = [
      comp({ id: "c1", pagamentoIds: [] }),
      comp({ id: "c2", pagamentoIds: [] }),
    ];
    const depois = [
      comp({ id: "c1", pagamentoIds: ["pag-1"] }),
      comp({ id: "c2", pagamentoIds: ["pag-2"] }),
    ];
    const novos = pagamentosNovosPorCompromisso(antes, depois);
    expect(novos.get("c1")).toEqual(["pag-1"]);
    expect(novos.get("c2")).toEqual(["pag-2"]);
  });

  it("compromisso que nem existia antes conta tudo como novo", () => {
    const depois = [comp({ id: "c9", pagamentoIds: ["pag-9"] })];
    expect(pagamentosNovosPorCompromisso([], depois).get("c9")).toEqual(["pag-9"]);
  });
});

describe("revalidacoesPendentesDaFatura — a lista derivada do ESTADO GRAVADO", () => {
  const notaA = doc({ id: "doc-a", numero: "1042", valorCentavos: 320_000 });
  const notaB = doc({ id: "doc-b", numero: "1051", valorCentavos: 165_000 });
  const docs = [notaA, notaB];

  function pagSemVinculo(id: string): Pagamento {
    return pag({ id, documentoIds: [] });
  }

  /** Compra de cartão já quitada, com pré-vínculo N≥2 e pagamento sem vínculo. */
  function pendente(id: string, pagamentoId: string, dataCompra = "2026-03-03") {
    return comp({
      id,
      origem: "cartao",
      situacao: "quitado",
      dataCompra,
      documentoOrigemId: "doc-a",
      documentoPrevistoIds: ["doc-b"],
      pagamentoIds: [pagamentoId],
    });
  }

  it("N≥2 quitado com pagamento sem vínculo: é bloco, e traz o pagamento", () => {
    const pendentes = revalidacoesPendentesDaFatura(
      [pendente("c1", "pag-1")],
      docs,
      [pagSemVinculo("pag-1")],
    );
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].pagamentoId).toBe("pag-1");
    expect(pendentes[0].resolvidos.map((d) => d.id)).toEqual(["doc-a", "doc-b"]);
  });

  it("⚠️ o bloco SOME quando o pagamento já tem vínculo — critério 12", () => {
    // É o que faz a confirmação de um bloco persistir: a lista é derivada, e
    // `pagamento_documento` é a verdade. Nenhuma flag de sessão participa disso.
    expect(
      revalidacoesPendentesDaFatura([pendente("c1", "pag-1")], docs, [
        pag({ id: "pag-1", documentoIds: ["doc-a", "doc-b"] }),
      ]),
    ).toEqual([]);
  });

  it("⚠️ um vínculo só (resolvido pelo seletor, parcialmente) também tira o bloco", () => {
    // Mesma condição 3 do CONTAI-065 — "nunca por cima de vínculo que já
    // existe": o conjunto do pagamento passou a ser afirmação de alguém, e não
    // cabe ao app somar a ele.
    expect(
      revalidacoesPendentesDaFatura([pendente("c1", "pag-1")], docs, [
        pag({ id: "pag-1", documentoIds: ["doc-b"] }),
      ]),
    ).toEqual([]);
  });

  it("compromisso ABERTO não aparece — pendência antes do pagamento é outro CTA", () => {
    const aberto = comp({
      id: "c1",
      origem: "cartao",
      situacao: "aberto",
      documentoOrigemId: "doc-a",
      documentoPrevistoIds: ["doc-b"],
      pagamentoIds: [],
    });
    expect(revalidacoesPendentesDaFatura([aberto], docs, [])).toEqual([]);
  });

  it("N=1 não aparece — já converteu sozinho, sem UI (§K.2)", () => {
    const um = comp({
      id: "c1",
      situacao: "quitado",
      documentoOrigemId: "doc-a",
      pagamentoIds: ["pag-1"],
    });
    expect(
      revalidacoesPendentesDaFatura([um], docs, [pagSemVinculo("pag-1")]),
    ).toEqual([]);
  });

  it("⚠️ remover um pré-vínculo depois da quitação tira o bloco — o N é o ATUAL", () => {
    const so_origem = comp({
      id: "c1",
      situacao: "quitado",
      documentoOrigemId: "doc-a",
      documentoPrevistoIds: [],
      pagamentoIds: ["pag-1"],
    });
    expect(
      revalidacoesPendentesDaFatura([so_origem], docs, [pagSemVinculo("pag-1")]),
    ).toEqual([]);
  });

  it("compromisso sem pagamento nenhum (cancelado) não aparece", () => {
    const cancelado = comp({
      id: "c1",
      situacao: "cancelado",
      motivoCancelamento: "compra estornada",
      documentoOrigemId: "doc-a",
      documentoPrevistoIds: ["doc-b"],
      pagamentoIds: [],
    });
    expect(revalidacoesPendentesDaFatura([cancelado], docs, [])).toEqual([]);
  });

  it("dois pendentes saem em ordem cronológica pela data da compra", () => {
    const pendentes = revalidacoesPendentesDaFatura(
      [
        pendente("c-tarde", "pag-2", "2026-03-11"),
        pendente("c-cedo", "pag-1", "2026-03-03"),
      ],
      docs,
      [pagSemVinculo("pag-1"), pagSemVinculo("pag-2")],
    );
    expect(pendentes.map((p) => p.compromisso.id)).toEqual([
      "c-cedo",
      "c-tarde",
    ]);
  });

  it("⚠️ confirmar UM deixa o OUTRO — as confirmações são independentes", () => {
    // A condição do Gate Fiscal em forma de teste: o estado gravado de um bloco
    // não diz nada sobre o outro.
    const pendentes = revalidacoesPendentesDaFatura(
      [pendente("c1", "pag-1"), pendente("c2", "pag-2", "2026-03-11")],
      docs,
      [
        pag({ id: "pag-1", documentoIds: ["doc-a", "doc-b"] }),
        pagSemVinculo("pag-2"),
      ],
    );
    expect(pendentes.map((p) => p.compromisso.id)).toEqual(["c2"]);
  });

  it("pagamento que não está na lista carregada degrada em silêncio", () => {
    expect(revalidacoesPendentesDaFatura([pendente("c1", "pag-1")], docs, [])).toEqual(
      [],
    );
  });
});
