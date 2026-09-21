import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  bordaDaGravidade,
  gravidadeDaRegua,
  papelDaGravidade,
  type Gravidade,
} from "./gravidade";
import { rotulosPagoSemComprovante } from "./pagamento";
import { calcularResumo } from "./resumo";
import {
  gravidadeDoContratoNaoCadastrado,
  GRAVIDADE_FALTA_LANCAR_INFORME,
} from "./terreno";
import {
  AVISO_CNPJ_ERRADO_ANO_ANTERIOR,
  GRAVIDADE_CORRECAO_ANO_ANTERIOR,
  sinalDoEmitenteErrado,
} from "./revisao";
import type { Documento, Obra, Pagamento } from "@/lib/types";

/**
 * **D54 — o teste-trava da régua de cor, e ele não é decorativo.**
 *
 * A D39 mandava *"toda pendência nova declarar qual das duas metades a
 * colore"*, e era norma sem verificador: em dois meses, seis pendências com o
 * dinheiro fora do bolso ficaram âmbar sem ninguém notar. Este arquivo é o
 * verificador que faltava.
 *
 * ⚠️ **Ele casa contra a FUNÇÃO, nunca contra texto de tela.** Casar por
 * rótulo de `Chip` faria a malha vazar em silêncio no dia em que alguém
 * reescrevesse uma frase — que é exatamente a classe de defeito que a régua
 * existe para pegar (pre-mortem 2 do CONTAI-035).
 */

// ── A tabela-verdade, completa ───────────────────────────────────────────

describe("gravidadeDaRegua — a tabela-verdade da D39 revisada", () => {
  it("dinheiro saiu e nada sustenta o valor no ano certo → VERMELHO", () => {
    expect(
      gravidadeDaRegua({ dinheiroSaiu: true, apoioHabilNoAnoCerto: false }),
    ).toBe("red");
  });

  it("dinheiro saiu, mas o valor já está sustentado → âmbar (falta corroborar)", () => {
    expect(
      gravidadeDaRegua({ dinheiroSaiu: true, apoioHabilNoAnoCerto: true }),
    ).toBe("amb");
  });

  it("nada saiu ainda → âmbar, mesmo sem apoio hábil nenhum", () => {
    expect(
      gravidadeDaRegua({ dinheiroSaiu: false, apoioHabilNoAnoCerto: false }),
    ).toBe("amb");
  });

  it("nada saiu e há apoio → âmbar", () => {
    expect(
      gravidadeDaRegua({ dinheiroSaiu: false, apoioHabilNoAnoCerto: true }),
    ).toBe("amb");
  });

  /**
   * A inversão que o `po` achou em 23/08: *"mais de uma data"* — valor NO
   * custo, só o ano em aberto — era vermelha, e *"falta a data"* — valor em ano
   * NENHUM — era âmbar. O app pintava o caso pior de âmbar e o brando de
   * vermelho. A régua, sozinha, não deixa mais isso acontecer.
   */
  it("o caso pior nunca é mais brando que o caso ameno", () => {
    const pior = gravidadeDaRegua({
      dinheiroSaiu: true,
      apoioHabilNoAnoCerto: false,
    });
    const ameno = gravidadeDaRegua({
      dinheiroSaiu: true,
      apoioHabilNoAnoCerto: true,
    });
    expect(pior).toBe("red");
    expect(ameno).toBe("amb");
  });
});

// ── A lista de exceções nomeadas ─────────────────────────────────────────

describe("exceções nomeadas — uma hoje, e ela só ABRANDA", () => {
  it("`pj_pago_sem_comprovante` vira âmbar o que a régua acenderia", () => {
    expect(
      gravidadeDaRegua(
        { dinheiroSaiu: true, apoioHabilNoAnoCerto: false },
        "pj_pago_sem_comprovante",
      ),
    ).toBe("amb");
  });

  /**
   * ⚠️ A direção importa: **exceção não fabrica vermelho**. Se um dia alguém
   * tentar usar a lista para ACENDER uma pendência que a régua apagou, o
   * resultado continua âmbar — e é isso que mantém a lista sendo uma lista de
   * abrandamentos fundamentados, não uma segunda régua paralela.
   */
  it("exceção sobre caso já âmbar é inócua — nunca acende", () => {
    for (const fatos of [
      { dinheiroSaiu: false, apoioHabilNoAnoCerto: false },
      { dinheiroSaiu: false, apoioHabilNoAnoCerto: true },
      { dinheiroSaiu: true, apoioHabilNoAnoCerto: true },
    ]) {
      expect(gravidadeDaRegua(fatos, "pj_pago_sem_comprovante")).toBe("amb");
    }
  });

  /**
   * A união é FECHADA em TypeScript, e não string de rótulo: uma exceção nova
   * exige editar `ExcecaoNomeada`, que é uma linha visível em review e um
   * parecer citado ao lado. O `CONTAI-038` entra por aqui
   * (`retencao_sem_recolhedor`), sem reabrir este ticket.
   */
  it("a lista de exceções é uma só, e está nomeada no código", () => {
    const fonte = readFileSync("lib/fiscal/gravidade.ts", "utf-8");
    const uniao = /export type ExcecaoNomeada =([^;]+);/.exec(fonte);
    expect(uniao).not.toBeNull();
    const entradas = (uniao as RegExpExecArray)[1]
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    expect(entradas).toEqual(['"pj_pago_sem_comprovante"']);
  });
});

// ── D54: nenhuma cor literal fora do produtor ────────────────────────────

/**
 * **O gate que a D39 nunca teve.** Cor de pendência é `gravidadeDaRegua`, e
 * mais nada: um `gravidade: "red"` novo em qualquer módulo fiscal deixa esta
 * asserção vermelha **com o nome do arquivo**, em vez de virar dívida invisível
 * por dois meses.
 *
 * É o mesmo formato do `e2e/privilegios.spec.ts`, e pelo mesmo motivo: norma
 * sem verificador é a D44 outra vez.
 */
it("nenhum módulo de lib/fiscal atribui cor de gravidade por literal", () => {
  const dir = "lib/fiscal";
  const modulos = readdirSync(dir).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "gravidade.ts",
  );
  expect(modulos.length).toBeGreaterThan(3); // o teste vale alguma coisa
  for (const arquivo of modulos) {
    const fonte = readFileSync(`${dir}/${arquivo}`, "utf-8");
    expect(
      /gravidade:\s*"(red|amb)"/.test(fonte),
      `${arquivo} voltou a escrever a cor à mão — ela sai de gravidadeDaRegua (D54)`,
    ).toBe(false);
  }
});

// ── Os auxiliares de tela ────────────────────────────────────────────────

it("a borda e o papel ARIA acompanham a cor calculada", () => {
  const vermelho = gravidadeDaRegua({
    dinheiroSaiu: true,
    apoioHabilNoAnoCerto: false,
  });
  const ambar = gravidadeDaRegua({
    dinheiroSaiu: false,
    apoioHabilNoAnoCerto: false,
  });
  expect(bordaDaGravidade(vermelho)).toBe("border-red");
  expect(bordaDaGravidade(ambar)).toBe("border-amb");
  expect(papelDaGravidade(vermelho)).toBe("alert");
  expect(papelDaGravidade(ambar)).toBe("status");
});

// ── Fixtures dos produtores ──────────────────────────────────────────────

describe("item C — correção que mexeu em ano anterior", () => {
  it("é VERMELHA, e é uma definição só para os nove call sites", () => {
    expect(GRAVIDADE_CORRECAO_ANO_ANTERIOR).toBe("red");
  });
});

describe("item B — ano fechado sem informe lançado", () => {
  it("é VERMELHO: o extrato existe, o dinheiro saiu, o custo do ano não", () => {
    expect(GRAVIDADE_FALTA_LANCAR_INFORME).toBe("red");
  });
});

describe("item E — contrato do financiamento não cadastrado", () => {
  it("VERMELHO quando a natureza é `financiado`", () => {
    expect(gravidadeDoContratoNaoCadastrado("financiado")).toBe("red");
  });

  it("âmbar nas outras naturezas e enquanto ela não foi respondida", () => {
    expect(gravidadeDoContratoNaoCadastrado("a_vista")).toBe("amb");
    expect(gravidadeDoContratoNaoCadastrado("parcelado_vendedor")).toBe("amb");
    expect(gravidadeDoContratoNaoCadastrado("recebido")).toBe("amb");
    expect(gravidadeDoContratoNaoCadastrado(null)).toBe("amb");
  });
});

describe("item D — CNPJ errado, a única cor condicional da régua", () => {
  const DOC = "doc-1";
  const OUTRO = "doc-2";

  it("sem pagamento ligado → âmbar: nada saiu por causa deste erro", () => {
    const sinal = sinalDoEmitenteErrado({
      documentoId: DOC,
      vinculos: [],
      anoCorrente: 2026,
    });
    expect(sinal.gravidade).toBe("amb");
    expect(sinal.avisoAnoAnterior).toBeNull();
  });

  it("com ≥1 pagamento ligado → VERMELHO (parecer §4.4)", () => {
    const sinal = sinalDoEmitenteErrado({
      documentoId: DOC,
      vinculos: [
        { documentoId: DOC, pagamentoId: "p1", anoDoPagamento: 2026 },
      ],
      anoCorrente: 2026,
    });
    expect(sinal.gravidade).toBe("red");
  });

  it("vínculo de OUTRO documento não colore este", () => {
    const sinal = sinalDoEmitenteErrado({
      documentoId: DOC,
      vinculos: [
        { documentoId: OUTRO, pagamentoId: "p1", anoDoPagamento: 2020 },
      ],
      anoCorrente: 2026,
    });
    expect(sinal.gravidade).toBe("amb");
    expect(sinal.avisoAnoAnterior).toBeNull();
  });

  /**
   * Gate Fiscal, FECHADO: a cor **não depende de valor, de PF/PJ nem de ano
   * fechado** — só de existir vínculo. O ano fechado muda a ESCALADA.
   */
  it("pagamento do ano CORRENTE: vermelho, e sem aviso de CRC", () => {
    const sinal = sinalDoEmitenteErrado({
      documentoId: DOC,
      vinculos: [
        { documentoId: DOC, pagamentoId: "p1", anoDoPagamento: 2026 },
      ],
      anoCorrente: 2026,
    });
    expect(sinal.gravidade).toBe("red");
    expect(sinal.avisoAnoAnterior).toBeNull();
  });

  it("pagamento de ano ANTERIOR: vermelho + o aviso de retificadora", () => {
    const sinal = sinalDoEmitenteErrado({
      documentoId: DOC,
      vinculos: [
        { documentoId: DOC, pagamentoId: "p1", anoDoPagamento: 2025 },
      ],
      anoCorrente: 2026,
    });
    expect(sinal.gravidade).toBe("red");
    expect(sinal.avisoAnoAnterior).toBe(AVISO_CNPJ_ERRADO_ANO_ANTERIOR);
  });

  it("basta UM pagamento de ano anterior entre vários para o aviso sair", () => {
    const sinal = sinalDoEmitenteErrado({
      documentoId: DOC,
      vinculos: [
        { documentoId: DOC, pagamentoId: "p1", anoDoPagamento: 2026 },
        { documentoId: DOC, pagamentoId: "p2", anoDoPagamento: 2024 },
      ],
      anoCorrente: 2026,
    });
    expect(sinal.avisoAnoAnterior).toBe(AVISO_CNPJ_ERRADO_ANO_ANTERIOR);
  });

  /**
   * O texto é o esqueleto de `AVISO_ANO_ANTERIOR` com a cláusula de EFEITO
   * literal — é ela que carrega a consequência fiscal, e reescrevê-la seria
   * redigir regra em vez de copiá-la.
   */
  it("o aviso repete, literal, a cláusula de efeito do aviso irmão", () => {
    expect(AVISO_CNPJ_ERRADO_ANO_ANTERIOR).toContain(
      "se a DAA daquele ano já foi entregue, avalie retificadora com seu contador.",
    );
  });
});

// ── A exceção nomeada, vista pelo produtor real ──────────────────────────

describe("exceção PJ × contraste PF (parecer de 2026-08-18, §601-602)", () => {
  it("PJ pago sem comprovante fica âmbar — a NF já sustenta o custo", () => {
    expect(rotulosPagoSemComprovante("pj").gravidade).toBe("amb");
  });

  it("PF fica VERMELHO — para PF o comprovante é constitutivo", () => {
    expect(rotulosPagoSemComprovante("pf").gravidade).toBe("red");
  });

  it("favorecido de tipo desconhecido fica vermelho, e o vermelho é provisório", () => {
    expect(rotulosPagoSemComprovante(null).gravidade).toBe("red");
  });
});

// ── O resumo inteiro, pelas cores que ele produz ─────────────────────────

const OBRA: Obra = {
  id: "obra-1",
  nome: "Casa Cachoeira",
  cno: "12.345.67890/26",
  matricula: "38.104",
  cartorio: "1º Ofício de Registro de Imóveis",
  municipio: "Florianópolis",
  naturezaAquisicaoTerreno: "a_vista",
  dataInicioObra: "2025-11-04",
  cnoRegistradoEm: "2025-11-20",
  unidadesAutonomas: 1,
  origemDesmembramentoLoteamento: false,
};

const DOCUMENTO_BASE: Documento = {
  id: "d1",
  obraId: OBRA.id,
  tipo: "nf_material",
  status: "registrado",
  valorCentavos: 100_000,
  numero: "1",
  serie: null,
  dataEmissao: "2026-02-10",
  vencimento: null,
  classificacao: "material",
  destinatarioCpfOk: true,
  retencao11: null,
  cnoReferenciado: null,
  notaTrazCno: null,
  motivoQuarentena: null,
  favorecidoNome: "Depósito Ilha",
  favorecidoId: "f1",
  favorecidoDocumento: "12345678000199",
  arquivoPath: "u/nf.pdf",
};

function documento(over: Partial<Documento>): Documento {
  return { ...DOCUMENTO_BASE, ...over };
}

const PAGAMENTO_BASE: Pagamento = {
  id: "p1",
  obraId: OBRA.id,
  valorCentavos: 100_000,
  dataPagamento: "2026-02-12",
  meio: "pix",
  status: "aguardando_nf",
  favorecidoId: "f1",
  favorecidoNome: "Depósito Ilha",
  favorecidoTipo: "pj",
  comprovantePath: "u/pix.png",
  documentoIds: [],
  encargosCentavos: 0,
  naoExplicadoCentavos: 0,
  resolucaoDiferenca: null,
};

function pagamento(over: Partial<Pagamento>): Pagamento {
  return { ...PAGAMENTO_BASE, ...over };
}

function resumoCom(entrada: {
  documentos?: Documento[];
  pagamentos?: Pagamento[];
}) {
  return calcularResumo({
    obra: OBRA,
    documentos: entrada.documentos ?? [],
    pagamentos: entrada.pagamentos ?? [],
    desembolsosTerreno: [],
    informesFinanciamento: [],
    financiamento: null,
    ano: 2026,
  });
}

function corDe(pendencias: { tipo: string; gravidade: Gravidade }[], tipo: string) {
  return pendencias.find((p) => p.tipo === tipo)?.gravidade;
}

describe("as cores que `calcularResumo` produz continuam as adjudicadas", () => {
  it("quarentena é vermelha — o valor está no custo em risco e nada o sustenta", () => {
    const r = resumoCom({
      documentos: [documento({ status: "quarentena" })],
    });
    expect(corDe(r.pendencias, "quarentena")).toBe("red");
  });

  it("boleto aguardando pagamento é âmbar — nada saiu ainda", () => {
    const r = resumoCom({
      documentos: [
        documento({ tipo: "boleto", status: "aguardando_pagamento" }),
      ],
    });
    expect(corDe(r.pendencias, "boleto_sem_nf")).toBe("amb");
  });

  it("pago sem nota é vermelho", () => {
    const r = resumoCom({ pagamentos: [pagamento({})] });
    expect(corDe(r.pendencias, "pago_sem_nota")).toBe("red");
  });

  it("NF de serviço sem retenção continua âmbar (item F fora de escopo)", () => {
    const r = resumoCom({
      documentos: [documento({ tipo: "nf_servico", retencao11: false })],
      pagamentos: [pagamento({ documentoIds: ["d1"] })],
    });
    expect(corDe(r.pendencias, "servico_sem_retencao")).toBe("amb");
  });

  it("NF de serviço sem CNO impresso continua âmbar — o aberto é o INSS", () => {
    const r = resumoCom({
      documentos: [
        documento({ tipo: "nf_servico", retencao11: true, notaTrazCno: false }),
      ],
      pagamentos: [pagamento({ documentoIds: ["d1"] })],
    });
    expect(corDe(r.pendencias, "nf_servico_sem_cno")).toBe("amb");
  });

  it("pago sem comprovante: âmbar para PJ, vermelho para PF — no resumo real", () => {
    const comNota = documento({ tipo: "nf_servico", retencao11: true });
    const pj = resumoCom({
      documentos: [comNota],
      pagamentos: [
        pagamento({ comprovantePath: null, documentoIds: ["d1"] }),
      ],
    });
    expect(corDe(pj.pendencias, "pago_sem_comprovante")).toBe("amb");

    const pf = resumoCom({
      documentos: [comNota],
      pagamentos: [
        pagamento({
          comprovantePath: null,
          favorecidoTipo: "pf",
          documentoIds: ["d1"],
        }),
      ],
    });
    expect(corDe(pf.pendencias, "pago_sem_comprovante")).toBe("red");
  });
});
