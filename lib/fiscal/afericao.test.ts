import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { posicaoDeAfericao, type PosicaoDeAfericao } from "@/lib/fiscal/afericao";
import {
  desembolsosCarregados,
  documentosCarregados,
  podeGerarRelatorioAnual,
  type LiberadoAfericaoInss,
} from "@/lib/fiscal/compromisso";
import type { Documento, Obra } from "@/lib/types";

/**
 * CONTAI-007, critério 5 — a **base** da aferição do INSS, segregada por CNO.
 *
 * ⚠️ O VALOR da aferição é a US-004 e não está aqui (Out of Scope do ticket:
 * *"este ticket só captura a base"*). O que estes testes trancam é o que a
 * captura promete: que a base de um CNO **nunca** receba nota de outro, e que
 * nada seja descartado em silêncio.
 */

const CNO_CASA = "12.345.67890/26";
const CNO_MAR = "98.765.43210/26";

function obra(over: Partial<Obra> & { id: string }): Obra {
  return {
    nome: "Casa Cachoeira",
    cno: CNO_CASA,
    matricula: null,
    cartorio: null,
    municipio: "Florianópolis",
    naturezaAquisicaoTerreno: null,
    dataInicioObra: "2026-03-15",
    cnoRegistradoEm: "2026-04-02",
    unidadesAutonomas: 1,
    origemDesmembramentoLoteamento: false,
    ...over,
  };
}

/** NF de serviço que ABATE: retenção sim, arquivo no acervo, CNO da obra. */
function nota(over: Partial<Documento> & { id: string }): Documento {
  return {
    obraId: "obra-casa",
    tipo: "nf_servico",
    status: "registrado",
    valorCentavos: 1_800_000,
    numero: "1042",
    serie: null,
    dataEmissao: "2026-04-20",
    vencimento: null,
    classificacao: "mao_obra",
    destinatarioCpfOk: true,
    retencaoNaNota: "destacada",
    retencoes: [],
    cnoReferenciado: CNO_CASA,
    notaTrazCno: true,
    motivoQuarentena: null,
    favorecidoId: "fav-aje",
    favorecidoNome: "AJE Construções",
    favorecidoDocumento: "11222333000181",
    arquivoPath: "u/documento/nf.pdf",
    ...over,
  };
}

/**
 * ⚠️ **A marca só sai da PORTA** — nenhum teste aqui a forja. Quem quer a
 * posição da aferição passa pelo mesmo caminho que a tela vai passar.
 */
function liberado(): LiberadoAfericaoInss {
  const r = podeGerarRelatorioAnual(
    [],
    "2026-08-24",
    2026,
    desembolsosCarregados([]),
    documentosCarregados([]),
  );
  if (!r.ok) throw new Error("a porta vetou — cenário errado no teste");
  return r.afericaoInss;
}

const motivos = (r: PosicaoDeAfericao) =>
  Object.fromEntries(r.foraDaBase.map((n) => [n.documentoId, n.motivo]));

describe("posição da aferição — a base por CNO", () => {
  it("soma as NF de serviço que referenciam o CNO daquela obra", () => {
    const r = posicaoDeAfericao(liberado(), [
      {
        obra: obra({ id: "obra-casa" }),
        documentos: [
          nota({ id: "a", valorCentavos: 1_800_000 }),
          nota({ id: "b", valorCentavos: 2_250_000 }),
        ],
      },
    ]);
    expect(r.porCno).toHaveLength(1);
    expect(r.porCno[0]).toMatchObject({
      cno: CNO_CASA,
      obraIds: ["obra-casa"],
      baseCentavos: 4_050_000,
    });
    expect(r.foraDaBase).toEqual([]);
  });

  it("⚠️ DUAS obras, DUAS bases — nunca somadas, e não há campo de total", () => {
    // Critério 5, literal: "segregada por CNO — nunca somada entre obras".
    // Somar bases de CNOs diferentes produz um número que não existe em
    // apuração nenhuma: cada CNO tem aferição, regularização e averbação
    // próprias. NF da obra A jamais abate base da obra B.
    const r = posicaoDeAfericao(liberado(), [
      {
        obra: obra({ id: "obra-casa" }),
        documentos: [nota({ id: "a", valorCentavos: 1_000_000 })],
      },
      {
        obra: obra({ id: "obra-mar", nome: "Terreno Vista Mar", cno: CNO_MAR }),
        documentos: [
          nota({
            id: "b",
            obraId: "obra-mar",
            valorCentavos: 700_000,
            cnoReferenciado: CNO_MAR,
          }),
        ],
      },
    ]);

    expect(r.porCno).toHaveLength(2);
    expect(r.porCno.map((b) => b.baseCentavos)).toEqual([1_000_000, 700_000]);
    // A ausência do total é a regra, e este `expect` é o que a protege: no dia
    // em que alguém acrescentar `totalCentavos` "por conveniência da tela",
    // este teste fica vermelho com o nome do campo.
    expect("totalCentavos" in r).toBe(false);
    expect("baseCentavos" in r).toBe(false);
  });

  it("pontuação diferente é o mesmo CNO", () => {
    const r = posicaoDeAfericao(liberado(), [
      {
        obra: obra({ id: "obra-casa", cno: "123456789026" }),
        documentos: [nota({ id: "a", cnoReferenciado: "12.345.67890/26" })],
      },
    ]);
    expect(r.porCno).toHaveLength(1);
    expect(r.porCno[0].baseCentavos).toBe(1_800_000);
  });

  it("⚠️ CNO divergente NÃO abate — e aparece com o motivo, nunca sumindo", () => {
    // O caso que o ticket inteiro existe para pegar: a nota arquivada na obra
    // errada. Ela não entra na base de CNO nenhum, e o motivo é o que diz ao
    // Mateus que ela está no lugar errado.
    const r = posicaoDeAfericao(liberado(), [
      {
        obra: obra({ id: "obra-casa" }),
        documentos: [nota({ id: "outra-obra", cnoReferenciado: CNO_MAR })],
      },
    ]);
    expect(r.porCno).toEqual([]);
    expect(motivos(r)).toEqual({ "outra-obra": "cno_divergente" });
  });

  it("os motivos de ficar fora, um a um", () => {
    const r = posicaoDeAfericao(liberado(), [
      {
        obra: obra({ id: "obra-casa" }),
        documentos: [
          // Critério 3: a nota não traz CNO. Continua sendo custo no IRPF.
          nota({ id: "sem-cno", notaTrazCno: false, cnoReferenciado: null }),
          // Registro anterior ao CONTAI-007: ninguém perguntou.
          nota({ id: "nao-perguntado", notaTrazCno: null, cnoReferenciado: null }),
          // ⚠️ **NÃO HÁ MOTIVO DE RETENÇÃO AQUI, e a ausência é o CONTAI-038**
          // (critério 13). O motivo `sem_retencao` existia e foi apagado: a
          // base do SERO *"não é reduzida pelo valor da nota, nem pelo valor
          // retido, nem pelo percentual"* (parecer de 2026-09-18, §2).
          // CONTAI-033, Guarda 2: o abatimento depende da nota, não da
          // lembrança dela.
          nota({ id: "sem-arquivo", arquivoPath: null }),
          nota({
            id: "quarentena",
            status: "quarentena",
            destinatarioCpfOk: false,
            motivoQuarentena: "fora do CPF",
          }),
        ],
      },
    ]);
    expect(r.porCno).toEqual([]);
    expect(motivos(r)).toEqual({
      "sem-cno": "nota_sem_cno",
      "nao-perguntado": "cno_nao_perguntado",
      "sem-arquivo": "sem_arquivo",
      quarentena: "quarentena",
    });
  });

  it("obra sem CNO não tem base — e a nota sabe por quê", () => {
    const r = posicaoDeAfericao(liberado(), [
      {
        obra: obra({ id: "obra-casa", cno: null, cnoRegistradoEm: null }),
        documentos: [nota({ id: "a", notaTrazCno: false, cnoReferenciado: null })],
      },
    ]);
    expect(r.porCno).toEqual([]);
    expect(motivos(r)).toEqual({ a: "obra_sem_cno" });
  });

  it("⚠️ material e boleto não entram — nem na base, nem em `foraDaBase`", () => {
    // Material é irrelevante para a aferição (invariante fiscal do projeto) e
    // boleto não é documentação hábil. Listá-los como "ficou de fora" sugeriria
    // que poderiam ter entrado — e aviso que erra é aviso que se ignora.
    const r = posicaoDeAfericao(liberado(), [
      {
        obra: obra({ id: "obra-casa" }),
        documentos: [
          nota({ id: "material", tipo: "nf_material", classificacao: "material" }),
          nota({ id: "boleto", tipo: "boleto", status: "aguardando_pagamento" }),
        ],
      },
    ]);
    expect(r.porCno).toEqual([]);
    expect(r.foraDaBase).toEqual([]);
  });

  it("a base carrega as notas que a compõem — rastreabilidade, não só o número", () => {
    const r = posicaoDeAfericao(liberado(), [
      { obra: obra({ id: "obra-casa" }), documentos: [nota({ id: "a" })] },
    ]);
    expect(r.porCno[0].notas).toEqual([
      {
        documentoId: "a",
        numero: "1042",
        dataEmissao: "2026-04-20",
        prestador: "AJE Construções",
        valorCentavos: 1_800_000,
      },
    ]);
  });
});

// ══ A guarda de FONTE — CONTAI-056, pre-mortem 2 ═════════════════════════

/**
 * **TESTE-TRAVA, no padrão de `retencao.test.ts`**: a aferição do SERO é
 * inteiramente alheia à retenção, e o CONTAI-056 acabou de ensinar
 * `lib/fiscal/vinculo.ts` a somar linha de retenção como perna de pagamento.
 * O risco nomeado no pre-mortem 2 do ticket: *"se o componente/soma de custo
 * for reaproveitado pelo cálculo da aferição SERO, a retenção passaria a abater
 * a base do INSS — o parecer é explícito que isso nunca muda"*.
 *
 * Fonte, §2 do parecer de 2026-09-18, reafirmada em todos os adendos: *"a base
 * não é reduzida pelo valor da nota, nem pelo valor retido, nem pelo percentual
 * de retenção"* — o que abate é a declaração que a prestadora vincula ao CNO,
 * evento fora deste produto (dívida D57).
 *
 * ⚠️ Comentário honesto não é rede. O dia em que alguém precisar de
 * `Alocacao` aqui, este teste fica vermelho com o nome do arquivo, e a conversa
 * acontece antes do merge — não depois, numa base de INSS menor do que devia.
 */
describe("a aferição não conhece custo nem retenção (pre-mortem 2 do CONTAI-056)", () => {
  const fonte = readFileSync("lib/fiscal/afericao.ts", "utf-8");

  it("`afericao.ts` não importa `./vinculo`", () => {
    expect(/from ["']\.\/vinculo["']/.test(fonte)).toBe(false);
  });

  it("`afericao.ts` não importa `./retencao`", () => {
    expect(/from ["']\.\/retencao["']/.test(fonte)).toBe(false);
  });

  /**
   * E não lê a linha por outro caminho: `documento.retencoes` não aparece, nem
   * `Alocacao`/`custoComprovado` — as três portas por onde o valor retido
   * poderia chegar à base sem um import novo.
   */
  it("`afericao.ts` não lê `retencoes` nem nada da alocação de custo", () => {
    expect(/\.retencoes\b/.test(fonte)).toBe(false);
    expect(/\bAlocacao\b/.test(fonte)).toBe(false);
    expect(/custoComprovado/.test(fonte)).toBe(false);
  });
});
