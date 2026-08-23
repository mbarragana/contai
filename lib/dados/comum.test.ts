import { describe, expect, it } from "vitest";

import {
  agruparVinculos,
  indexarDiferencas,
  paraAnexoDeDesembolso,
  paraAnoAfetado,
  paraAnosJson,
  paraCompromisso,
  paraDesembolsoTerreno,
  paraDiferenca,
  paraDocumento,
  paraFinanciamento,
  paraInforme,
  paraLinhaObra,
  paraObra,
  paraPagamento,
} from "@/lib/dados/comum";
import { centavosParaNumeric } from "@/lib/money";
import type {
  AnoAfetado,
  CompromissoRow,
  DocumentoRow,
  FinanciamentoInformeRow,
  FinanciamentoRow,
  ObraRow,
  PagamentoDiferencaRow,
  PagamentoDocumentoRow,
  PagamentoRow,
  RevisaoAnoAfetadoRow,
  TerrenoDesembolsoAnexoRow,
} from "@/lib/types";
import type { ComFavorecido, ComFavorecidoSimples, ComFavorecidoTipado, TerrenoDesembolsoComAnexos } from "@/lib/dados/comum";

/**
 * Rede unitária dos 14 mappers puros de `lib/dados/comum.ts` (CONTAI-029).
 *
 * ⚠️ REGRA FISCAL NÃO SE REDERIVA. Cada caso abaixo copia uma condição já
 * adjudicada pelo `contador` — nenhum foi inferido lendo a implementação.
 * Fontes, citadas por caso no comentário de cada `describe`:
 *
 * - Gate Fiscal do `docs/tickets/CONTAI-028.md` (tabela de 16 condições,
 *   adjudicada em 2026-08-22) + a lista "o que trava para humano hoje"
 * - `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` §1, §5
 * - `docs/pareceres/2026-08-21-gate-fiscal-contai-027-criterio-13.md` §6
 * - `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md` §3–§4
 * - incidente `numeric(14,2)` (`CLAUDE.md`): o PostgREST devolve ora `number`,
 *   ora `"4850.00"` — os `row` daqui são fiéis aos DOIS formatos
 *
 * QUAL DAS 16 CONDIÇÕES CADA UMA DESTAS SUÍTES ALCANÇA — e por que as outras
 * não são testáveis aqui. Mapper é puro; as condições que descrevem CHAMADA ao
 * PostgREST (`ignoreDuplicates`, RPC transacional, ordem de INSERT, link
 * assinado de 120 s, `VinculoEntreObrasError`) só se provam contra o Postgres
 * local, e é o E2E que as cobre — stub de backend é proibido no projeto.
 *
 * | # | Condição (CONTAI-028) | Aqui |
 * |---|---|---|
 * | 1 | `numeric(14,2)` ora `number` ora texto → `numericParaCentavos` | SIM |
 * | 2 | informe de outra obra filtrado; nada soma entre matrículas | não — filtro é da query |
 * | 3 | `documento.valor` null → null, pagamento/desembolso `?? 0` | SIM (os dois lados) |
 * | 4 | `p_depois` texto `.toFixed(2)`, `p_anos` não vazio | PARCIAL (ver `paraAnosJson`) |
 * | 5 | `emitente_corrigiu_a_nota` exige anexo, e ele é adicional | não — I/O |
 * | 6 | só classificação → `p_anos: []` | não — I/O, e hoje sem rede nenhuma |
 * | 7 | nome do favorecido muda sem tocar CPF/CNPJ | não — I/O |
 * | 8 | `garantirFavorecido` com `ignoreDuplicates` | não — I/O |
 * | 9 | ausência = pendência aberta; `paraAnoAfetado` `?? 0`; `slice()` antes do `sort` | SIM |
 * | 10 | `baixarPendencia` é INSERT | não — I/O |
 * | 11 | `marcarEmitenteErrado` idempotente | não — I/O |
 * | 12 | `centavosParaNumeric` exatamente uma vez na gravação | PARCIAL — só `paraAnosJson`; os outros ~30 call-sites são I/O |
 * | 13 | desembolso de terreno em um ato só (RPC) | não — I/O |
 * | 14 | anexos antes da resposta; valor nunca tocado | PARCIAL (ordem dos anexos lidos) |
 * | 15 | `VinculoEntreObrasError` no código, não na policy | não — I/O |
 * | 16 | link assinado 120 s; duas consultas separadas | não — I/O |
 *
 * Nenhum teste deste arquivo faz I/O: sem client Supabase, sem rede, sem
 * Postgres (critério 5 do CONTAI-029).
 */

// ---------------------------------------------------------------------------
// Fábricas de `row`. Fidelidade ao PostgREST é o ponto: `numeric(14,2)` volta
// ora `number`, ora string, e o tipo gerado do banco só conhece `number` — daí
// os casos de texto entrarem por cast explícito, marcado onde acontece.
// ---------------------------------------------------------------------------

function rowDocumento(over: Partial<DocumentoRow & ComFavorecido> = {}): DocumentoRow & ComFavorecido {
  return {
    id: "doc-1",
    obra_id: "obra-1",
    user_id: "user-1",
    created_at: "2026-03-10T12:00:00Z",
    tipo: "nf_material",
    status: "registrado",
    valor: 4850,
    vencimento: "2026-03-20",
    classificacao: "material",
    destinatario_cpf_ok: true,
    retencao_11: null,
    motivo_quarentena: null,
    favorecido_id: "fav-1",
    favorecido: { nome: "Depósito Cachoeira", documento: "12345678000199" },
    arquivo_path: "acervo/nf-1.pdf",
    ...over,
  };
}

function rowPagamento(over: Partial<PagamentoRow & ComFavorecidoTipado> = {}): PagamentoRow & ComFavorecidoTipado {
  return {
    id: "pag-1",
    obra_id: "obra-1",
    user_id: "user-1",
    created_at: "2026-03-10T12:00:00Z",
    valor: 4850,
    data_pagamento: "2026-03-18",
    data_compra: null,
    meio: "pix",
    status: "conciliado",
    favorecido_id: "fav-1",
    favorecido: { nome: "Depósito Cachoeira", tipo: "pj" },
    comprovante_path: "acervo/pix-1.pdf",
    ...over,
  };
}

function rowDesembolso(over: Partial<TerrenoDesembolsoComAnexos> = {}): TerrenoDesembolsoComAnexos {
  return {
    id: "des-1",
    obra_id: "obra-1",
    user_id: "user-1",
    created_at: "2026-01-05T09:00:00Z",
    tipo: "entrada",
    valor: 30000,
    data_pagamento: "2026-01-05",
    estado: "pago",
    origem_recurso: "proprio",
    debitos_mesmo_dia: null,
    debitos_mesmo_dia_respondido_em: null,
    terreno_desembolso_anexo: null,
    ...over,
  };
}

function rowAnexo(over: Partial<TerrenoDesembolsoAnexoRow> = {}): TerrenoDesembolsoAnexoRow {
  return {
    id: "anx-1",
    desembolso_id: "des-1",
    arquivo_path: "acervo/comprovante.pdf",
    papel: "comprovante",
    created_at: "2026-01-05T09:00:00Z",
    ...over,
  };
}

function rowAnoAfetado(over: Partial<RevisaoAnoAfetadoRow> = {}): RevisaoAnoAfetadoRow {
  return {
    id: "raa-1",
    revisao_id: "rev-1",
    obra_id: "obra-1",
    ano: 2025,
    custo_antes: 100000,
    custo_depois: 95150,
    pendencia_id: null,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// A ASSIMETRIA DELIBERADA — critério 3 do CONTAI-029, condição 3 do Gate
// Fiscal do CONTAI-028.
// ---------------------------------------------------------------------------

/**
 * ⚠️ LEIA ANTES DE "SIMPLIFICAR". Os dois testes abaixo parecem uma
 * inconsistência a corrigir e NÃO SÃO: a assimetria é DELIBERADA, adjudicada
 * pelo `contador` no Gate Fiscal do CONTAI-028 (condição 3).
 *
 * `documento.valor` null significa "a nota está no acervo mas o valor ainda
 * não foi lido/confirmado". Unificar em `?? 0` — que é a mudança de uma linha
 * que este arquivo existe para reprovar — faz NOTA SEM VALOR VIRAR R$ 0,00
 * DECLARADO: o custo de aquisição some da ficha Bens e Direitos em silêncio,
 * sem pendência, sem quarentena, sem ninguém ver.
 *
 * Pagamento é o oposto: pagamento sem valor não existe (a coluna é NOT NULL);
 * o `?? 0` ali é defesa contra linha corrompida, não política fiscal.
 */
describe("assimetria null × 0 entre nota e pagamento (deliberada)", () => {
  it("nota sem valor não vira R$ 0,00 declarado — fica sem valor, para alguém preencher", () => {
    expect(paraDocumento(rowDocumento({ valor: null })).valorCentavos).toBeNull();
  });

  it("pagamento sem valor não some do custo do ano: entra como zero, ao contrário da nota", () => {
    // Mesmo `null` na entrada, resultado DIFERENTE de propósito. Se este teste
    // e o de cima passarem a devolver a mesma coisa, a unificação aconteceu.
    expect(paraPagamento(rowPagamento({ valor: null as unknown as number }), [], undefined).valorCentavos).toBe(0);
  });

  it("desembolso de terreno sem valor acompanha o pagamento, não a nota", () => {
    expect(paraDesembolsoTerreno(rowDesembolso({ valor: null as unknown as number })).valorCentavos).toBe(0);
  });

  it("nota com valor zero de verdade continua distinguível de nota sem valor lido", () => {
    // Zero explícito é um fato; `null` é a ausência do fato. Colapsar os dois
    // apaga a diferença entre "custou nada" e "ninguém leu ainda".
    expect(paraDocumento(rowDocumento({ valor: 0 })).valorCentavos).toBe(0);
  });
});

/**
 * Condição 1 do Gate Fiscal + incidente registrado no `CLAUDE.md`: o
 * `numeric(14,2)` volta do PostgREST ora como `number`, ora como `"4850.00"`.
 * `Number(x) * 100` e `parseFloat` erram por centavo; `numericParaCentavos`
 * arredonda. Um centavo perdido por linha vira erro na soma do ano.
 */
describe("valor do banco chega em dois formatos e o custo do ano tem que ser o mesmo", () => {
  it("nota serializada como texto declara o mesmo custo que a serializada como número", () => {
    const comoNumero = paraDocumento(rowDocumento({ valor: 4850 })).valorCentavos;
    const comoTexto = paraDocumento(
      rowDocumento({ valor: "4850.00" as unknown as number }),
    ).valorCentavos;
    expect(comoTexto).toBe(comoNumero);
    expect(comoTexto).toBe(485000);
  });

  it("centavo quebrado não some na conversão do pagamento", () => {
    // 1234.56 em ponto flutuante × 100 dá 123455.99999…; truncar perde centavo.
    expect(paraPagamento(rowPagamento({ valor: 1234.56 }), [], undefined).valorCentavos).toBe(123456);
    expect(
      paraPagamento(rowPagamento({ valor: "1234.56" as unknown as number }), [], undefined).valorCentavos,
    ).toBe(123456);
  });
});

// ---------------------------------------------------------------------------
// RASTRO DA CORREÇÃO — condições 4, 6 e 9 do Gate Fiscal.
// ---------------------------------------------------------------------------

function ano(over: Partial<AnoAfetado> = {}): AnoAfetado {
  return { obraId: "obra-1", ano: 2025, antesCentavos: 100000, depoisCentavos: 95150, pendencia: true, ...over };
}

/**
 * `paraAnosJson` monta o snapshot antes→depois que a migration 0009 grava — é
 * o rastro que sustenta a pendência de retificadora
 * (`docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` §5).
 *
 * ⚠️ DIVERGÊNCIA REGISTRADA, NÃO CONSERTADA (critério 7 do CONTAI-029): o
 * critério 4 do ticket diz que "o valor sai como string `.toFixed(2)`". O
 * `contador` adjudicou a divergência em 2026-08-23: o critério juntou duas
 * coisas que o BANCO separa — `revisao.antes`/`depois` são colunas `text`
 * (migration 0009), por isso o `.toFixed(2)`; `revisao_ano_afetado.custo_*`
 * são `numeric(14,2)`, por isso o número. No
 * código entregue pelo CONTAI-028 isso NÃO acontece aqui — `paraAnosJson`
 * emite `centavosParaNumeric(...)`, ou seja NÚMERO. O `.toFixed(2)` que a
 * condição 4 do Gate Fiscal descreve mora no `p_depois` de
 * `corrigirValorDoDocumento` (`lib/data.ts:504`), que é função de I/O e está
 * fora do escopo deste ticket. Os dois lados ficam travados abaixo: o formato
 * do `p_depois` pela expressão que o produz, e o do snapshot pelo que ele é
 * hoje. Nada foi alterado em `lib/data.ts` nem em `lib/dados/`.
 */
describe("rastro antes→depois da correção de valor", () => {
  // ⚠️ ÚNICO CASO DESTE ARQUIVO QUE NÃO CHAMA A UNIDADE SOB TESTE, e o nome
  // diz isso: ele trava o CONTRATO DE FORMATO do rastro (a composição
  // `centavosParaNumeric` + `toFixed`), e NÃO o call-site. Nada aqui impede
  // `lib/data.ts:504` de virar `String(n)` — quem prova o call-site é
  // `e2e/correcao.spec.ts:96`, contra o Postgres local.
  it("o formato do rastro é texto de duas casas: String(n) e toString() perdem o centavo", () => {
    // `revisao.antes`/`depois` são colunas `text` (migration 0009) — daí o
    // `.toFixed(2)`. Trocar por `String(n)` publica "4850" e por `toString()`
    // publica "4850.5": os dois corrompem o antes→depois (§5).
    expect(centavosParaNumeric(485000).toFixed(2)).toBe("4850.00");
    expect(centavosParaNumeric(485050).toFixed(2)).toBe("4850.50");
    expect(String(centavosParaNumeric(485000))).not.toBe(centavosParaNumeric(485000).toFixed(2));
  });

  it("o snapshot do ano preserva os centavos exatos que a declaração vai comparar", () => {
    const [linha] = paraAnosJson([ano({ antesCentavos: 123456, depoisCentavos: 100000 })]);
    expect(linha.custo_antes).toBe(1234.56);
    expect(linha.custo_depois).toBe(1000);
  });

  it("o snapshot identifica o ano e a matrícula: nada soma entre obras", () => {
    const [linha] = paraAnosJson([ano({ obraId: "obra-2", ano: 2024 })]);
    expect(linha.ano).toBe(2024);
    expect(linha.obra_id).toBe("obra-2");
  });

  it("o snapshot carrega para o banco a decisão de abrir pendência, sem recalculá-la", () => {
    // Quem decide `pendencia` é `lib/fiscal/revisao.ts` (§5.3), onde "hoje" é
    // injetável. O mapper só transporta — inventar a regra aqui a duplicaria.
    expect(paraAnosJson([ano({ pendencia: true })])[0].pendencia).toBe(true);
    expect(paraAnosJson([ano({ pendencia: false })])[0].pendencia).toBe(false);
  });

  it("sem ano afetado, o rastro não fabrica um: lista vazia não abre retificadora", () => {
    // ⚠️ ISTO NÃO COBRE A CONDIÇÃO 6 do Gate Fiscal — e não finja que cobre.
    // `corrigirClassificacaoDoDocumento` NUNCA chama `paraAnosJson`: manda
    // `p_anos: []` literal (`lib/data.ts:532`). Trocar aquela linha por
    // `paraAnosJson(anos)` deixaria este teste verde do mesmo jeito. O que se
    // prova aqui é só que o mapper não inventa ano quando não recebe nenhum.
    expect(paraAnosJson([])).toEqual([]);
  });

  it("os anos do rastro saem na ordem em que a regra fiscal os entregou", () => {
    const linhas = paraAnosJson([ano({ ano: 2024 }), ano({ ano: 2025 })]);
    expect(linhas.map((l) => l.ano)).toEqual([2024, 2025]);
  });
});

/**
 * Condição 9: a pendência de retificadora é lida de volta por `paraAnoAfetado`.
 * O `?? 0` só é seguro porque o par antes/depois sempre existe na linha; e
 * "tem pendência" é a EXISTÊNCIA de `pendencia_id`, nunca uma flag.
 */
describe("leitura do ano afetado por uma correção", () => {
  it("ano ligado a uma pendência aparece como retificadora pendente", () => {
    expect(paraAnoAfetado(rowAnoAfetado({ pendencia_id: "pend-1" })).pendencia).toBe(true);
  });

  it("ano sem pendência ligada não inventa retificadora para o Mateus resolver", () => {
    expect(paraAnoAfetado(rowAnoAfetado({ pendencia_id: null })).pendencia).toBe(false);
  });

  it("custo antes e depois voltam em centavos, nos dois formatos que o banco serializa", () => {
    const linha = paraAnoAfetado(
      rowAnoAfetado({ custo_antes: "1234.56" as unknown as number, custo_depois: 1000 }),
    );
    expect(linha.antesCentavos).toBe(123456);
    expect(linha.depoisCentavos).toBe(100000);
  });

  it("linha sem par antes/depois não derruba a tela de pendências: cai em zero", () => {
    // O `?? 0` é rede para linha corrompida — o par sempre existe na 0009.
    const linha = paraAnoAfetado(
      rowAnoAfetado({ custo_antes: null as unknown as number, custo_depois: null as unknown as number }),
    );
    expect(linha.antesCentavos).toBe(0);
    expect(linha.depoisCentavos).toBe(0);
  });

  it("o ano afetado preserva a obra de origem, que é onde o custo caiu", () => {
    const linha = paraAnoAfetado(rowAnoAfetado({ obra_id: "obra-origem", ano: 2024 }));
    expect(linha.obraId).toBe("obra-origem");
    expect(linha.ano).toBe(2024);
  });
});

// ---------------------------------------------------------------------------
// AGRUPAMENTO — decide qual nota aparece ligada a qual pagamento.
// ---------------------------------------------------------------------------

/**
 * `agruparVinculos` e `indexarDiferencas` decidem o que a tela de conciliação
 * mostra como "pago com nota". Chave errada ou item perdido no acumulador
 * transforma pagamento documentado em "pago sem nota" (e vice-versa) — meta 1.
 */
describe("quais notas aparecem ligadas a cada pagamento", () => {
  const v = (pagamento_id: string, documento_id: string): PagamentoDocumentoRow => ({ pagamento_id, documento_id });

  it("pagamento com várias notas não perde nenhuma pelo caminho", () => {
    const mapa = agruparVinculos([v("pag-1", "doc-1"), v("pag-1", "doc-2"), v("pag-1", "doc-3")]);
    expect(mapa.get("pag-1")).toEqual(["doc-1", "doc-2", "doc-3"]);
  });

  it("nota de um pagamento não vaza para o outro", () => {
    const mapa = agruparVinculos([v("pag-1", "doc-1"), v("pag-2", "doc-2"), v("pag-1", "doc-3")]);
    expect(mapa.get("pag-1")).toEqual(["doc-1", "doc-3"]);
    expect(mapa.get("pag-2")).toEqual(["doc-2"]);
    expect(mapa.size).toBe(2);
  });

  it("o agrupamento é por pagamento, nunca por documento", () => {
    // Se a chave virar `documento_id`, uma nota rateada entre dois pagamentos
    // some de um deles e o outro passa a exibir nota que não é sua.
    const mapa = agruparVinculos([v("pag-1", "doc-1"), v("pag-2", "doc-1")]);
    expect([...mapa.keys()]).toEqual(["pag-1", "pag-2"]);
  });

  it("pagamento sem nota nenhuma continua sem nota, não herda lista de outro", () => {
    expect(agruparVinculos([v("pag-1", "doc-1")]).get("pag-2")).toBeUndefined();
    expect(agruparVinculos([]).size).toBe(0);
  });

  it("a composição do desembolso é achada pelo pagamento a que pertence", () => {
    const d1 = rowDiferenca({ pagamento_id: "pag-1", encargos: 12.34 });
    const d2 = rowDiferenca({ pagamento_id: "pag-2", encargos: 0 });
    const mapa = indexarDiferencas([d1, d2]);
    expect(mapa.get("pag-1")).toBe(d1);
    expect(mapa.get("pag-2")).toBe(d2);
    expect(mapa.get("pag-3")).toBeUndefined();
  });
});

function rowDiferenca(over: Partial<PagamentoDiferencaRow> = {}): PagamentoDiferencaRow {
  return {
    pagamento_id: "pag-1",
    encargos: 12.34,
    nao_explicado: 0,
    resolucao: null,
    resolvido_em: null,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// DESEMBOLSO DE TERRENO — condições 9 (slice antes do sort) e 14.
// ---------------------------------------------------------------------------

/**
 * A ordem dos anexos é a ordem em que os papéis chegaram ao acervo, e é ela
 * que a re-pergunta do §6 lê
 * (`docs/pareceres/2026-08-21-gate-fiscal-contai-027-criterio-13.md`).
 * `sort` sem `slice()` MUTA o array que veio do PostgREST — e o mesmo array é
 * o acumulado do ano, que passa a sair reordenado para quem já o tinha em mãos.
 */
describe("papéis do desembolso de terreno", () => {
  it("os papéis são lidos do mais antigo para o mais novo, que é a ordem em que chegaram", () => {
    const desembolso = paraDesembolsoTerreno(
      rowDesembolso({
        terreno_desembolso_anexo: [
          rowAnexo({ id: "b", created_at: "2026-02-01T10:00:00Z" }),
          rowAnexo({ id: "a", created_at: "2026-01-01T10:00:00Z" }),
          rowAnexo({ id: "c", created_at: "2026-03-01T10:00:00Z" }),
        ],
      }),
    );
    expect(desembolso.anexos.map((a) => a.id)).toEqual(["a", "b", "c"]);
  });

  it("ordenar os papéis não reordena o acumulado do ano que veio do banco", () => {
    // O array do PostgREST é compartilhado; mutá-lo aqui muda o que outra
    // leitura já segurava. É o motivo do `.slice()` antes do `.sort()`.
    const originais = [
      rowAnexo({ id: "b", created_at: "2026-02-01T10:00:00Z" }),
      rowAnexo({ id: "a", created_at: "2026-01-01T10:00:00Z" }),
    ];
    paraDesembolsoTerreno(rowDesembolso({ terreno_desembolso_anexo: originais }));
    expect(originais.map((a) => a.id)).toEqual(["b", "a"]);
  });

  it("desembolso ainda sem papel nenhum não quebra a tela: chega com lista vazia", () => {
    expect(paraDesembolsoTerreno(rowDesembolso({ terreno_desembolso_anexo: null })).anexos).toEqual([]);
    expect(paraDesembolsoTerreno(rowDesembolso({ terreno_desembolso_anexo: [] })).anexos).toEqual([]);
  });

  it("previsto não ganha data de pagamento inventada", () => {
    // "Previsto não é pago, e o app não inventa data (nem a de hoje)" —
    // CONTAI-028, "o que trava para humano hoje".
    const previsto = paraDesembolsoTerreno(rowDesembolso({ estado: "previsto", data_pagamento: null }));
    expect(previsto.estado).toBe("previsto");
    expect(previsto.dataPagamento).toBeNull();
  });

  it("pergunta dos débitos do mesmo dia sem resposta continua sem resposta, não vira não", () => {
    // `debitosMesmoDia` é `boolean | null` e `null` significa "a pergunta não
    // foi feita". Dar default a esse campo é responder pelo Mateus.
    expect(paraDesembolsoTerreno(rowDesembolso({ debitos_mesmo_dia: null })).debitosMesmoDia).toBeNull();
    expect(paraDesembolsoTerreno(rowDesembolso({ debitos_mesmo_dia: false })).debitosMesmoDia).toBe(false);
  });

  it("a resposta datada dos débitos vem junto, porque é ela que encerra a re-pergunta", () => {
    const respondido = paraDesembolsoTerreno(
      rowDesembolso({ debitos_mesmo_dia: true, debitos_mesmo_dia_respondido_em: "2026-02-02T10:00:00Z" }),
    );
    expect(respondido.debitosMesmoDia).toBe(true);
    expect(respondido.debitosMesmoDiaRespondidoEm).toBe("2026-02-02T10:00:00Z");
  });

  it("o valor do desembolso vai para o custo do terreno nos dois formatos do banco", () => {
    expect(paraDesembolsoTerreno(rowDesembolso({ valor: 30000 })).valorCentavos).toBe(3000000);
    expect(
      paraDesembolsoTerreno(rowDesembolso({ valor: "30000.00" as unknown as number })).valorCentavos,
    ).toBe(3000000);
  });

  it("a origem do recurso acompanha o desembolso: FGTS não vira recurso próprio", () => {
    expect(paraDesembolsoTerreno(rowDesembolso({ origem_recurso: "fgts" })).origemRecurso).toBe("fgts");
  });
});

/**
 * O `papel` do anexo volta do PostgREST como `text` — quem o fecha é o check
 * `terreno_anexo_papel` da migration 0010. É por ele que a re-pergunta sabe se
 * o comprovante já está no acervo.
 */
describe("papel de cada anexo do desembolso", () => {
  it("comprovante, nota e contrato chegam identificados, não como texto solto", () => {
    expect(paraAnexoDeDesembolso(rowAnexo({ papel: "comprovante" })).papel).toBe("comprovante");
    expect(paraAnexoDeDesembolso(rowAnexo({ papel: "contrato" })).papel).toBe("contrato");
    expect(paraAnexoDeDesembolso(rowAnexo({ papel: "nota" })).papel).toBe("nota");
  });

  it("o caminho no acervo e a data de chegada vêm junto — é o que sustenta a guarda", () => {
    const anexo = paraAnexoDeDesembolso(
      rowAnexo({ id: "anx-9", arquivo_path: "acervo/escritura.pdf", created_at: "2026-01-09T08:00:00Z" }),
    );
    expect(anexo).toEqual({
      id: "anx-9",
      arquivoPath: "acervo/escritura.pdf",
      papel: "comprovante",
      createdAt: "2026-01-09T08:00:00Z",
    });
  });
});

// ---------------------------------------------------------------------------
// LOTE 2 — os mappers restantes.
// ---------------------------------------------------------------------------

/**
 * A obra é a matrícula, e Bens e Direitos é POR MATRÍCULA (condição 2). O CNO
 * e a natureza de aquisição do terreno decidem a aferição do INSS e o custo do
 * terreno — nenhum deles pode chegar preenchido por default.
 */
describe("obra lida do banco", () => {
  const row = (over: Partial<ObraRow> = {}): ObraRow => ({
    id: "obra-1",
    user_id: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    nome: "Casa Cachoeira",
    cno: "12.345.67890/12",
    matricula: "45678",
    cartorio: "1º Ofício de Florianópolis",
    municipio: "Florianópolis",
    natureza_aquisicao_terreno: "financiado",
    data_inicio_obra: "2026-01-15",
    cno_registrado_em: "2026-01-20",
    unidades_autonomas: 1,
    origem_desmembramento_loteamento: false,
    ...over,
  });

  it("matrícula, cartório e CNO chegam à tela sem tradução pelo caminho", () => {
    const obra = paraObra(row());
    expect(obra.matricula).toBe("45678");
    expect(obra.cartorio).toBe("1º Ofício de Florianópolis");
    expect(obra.cno).toBe("12.345.67890/12");
    expect(obra.municipio).toBe("Florianópolis");
  });

  it("obra sem CNO registrado aparece sem CNO, e não como CNO em branco preenchido", () => {
    const obra = paraObra(row({ cno: null, cno_registrado_em: null }));
    expect(obra.cno).toBeNull();
    expect(obra.cnoRegistradoEm).toBeNull();
  });

  it("natureza do terreno não respondida continua sem resposta — é pendência, não bloqueio", () => {
    expect(paraObra(row({ natureza_aquisicao_terreno: null })).naturezaAquisicaoTerreno).toBeNull();
  });

  it("as respostas que mudam a aferição do INSS não se perdem na leitura", () => {
    const obra = paraObra(row({ unidades_autonomas: 2, origem_desmembramento_loteamento: true }));
    expect(obra.unidadesAutonomas).toBe(2);
    expect(obra.origemDesmembramentoLoteamento).toBe(true);
  });
});

/**
 * `paraLinhaObra` é o caminho de ESCRITA: o que o Mateus respondeu no cadastro
 * vira a linha da obra. Campo fiscal não ganha default aqui.
 */
describe("obra gravada a partir do que o Mateus respondeu", () => {
  const entrada = {
    nome: "Casa Cachoeira",
    municipio: "Florianópolis",
    matricula: "45678",
    cartorio: "1º Ofício",
    cno: null,
    cnoRegistradoEm: null,
    dataInicioObra: "2026-01-15",
    naturezaAquisicaoTerreno: null,
    unidadesAutonomas: 1,
    origemDesmembramentoLoteamento: false,
  } as const;

  it("natureza do terreno não respondida é gravada como não respondida, nunca como 'à vista'", () => {
    expect(paraLinhaObra({ ...entrada }).natureza_aquisicao_terreno).toBeNull();
  });

  it("obra sem CNO é gravada sem CNO — o registro é ação fora do app", () => {
    const linha = paraLinhaObra({ ...entrada });
    expect(linha.cno).toBeNull();
    expect(linha.cno_registrado_em).toBeNull();
  });

  it("a data de início da obra vai como o Mateus digitou, sem 'hoje' no lugar", () => {
    expect(paraLinhaObra({ ...entrada }).data_inicio_obra).toBe("2026-01-15");
  });

  it("as respostas de INSS chegam ao banco com os nomes de coluna da migration", () => {
    const linha = paraLinhaObra({ ...entrada, unidadesAutonomas: 3, origemDesmembramentoLoteamento: true });
    expect(linha.unidades_autonomas).toBe(3);
    expect(linha.origem_desmembramento_loteamento).toBe(true);
  });
});

/**
 * O documento é a prova de que o pagamento tem nota hábil (meta 1). Emitente e
 * CNPJ vêm juntos porque quem registra o pagamento a partir da nota precisa dos
 * DOIS para não recriar o favorecido com typo.
 */
describe("documento lido do banco", () => {
  it("nota em quarentena chega com o motivo, para o Mateus saber o que falta", () => {
    const doc = paraDocumento(
      rowDocumento({ status: "quarentena", motivo_quarentena: "destinatário não é o CPF do Mateus", destinatario_cpf_ok: false }),
    );
    expect(doc.status).toBe("quarentena");
    expect(doc.motivoQuarentena).toBe("destinatário não é o CPF do Mateus");
    expect(doc.destinatarioCpfOk).toBe(false);
  });

  it("NF de serviço sem resposta sobre a retenção de 11% não vira 'sem retenção'", () => {
    // A retenção decide o abatimento da aferição do INSS. `null` = ninguém
    // respondeu; `false` = respondeu que não houve. Colapsar os dois muda o SERO.
    expect(paraDocumento(rowDocumento({ tipo: "nf_servico", retencao_11: null })).retencao11).toBeNull();
    expect(paraDocumento(rowDocumento({ tipo: "nf_servico", retencao_11: false })).retencao11).toBe(false);
  });

  it("nota ainda não classificada não chega como material por default", () => {
    // Material × mão de obra muda a discriminação e o INSS: o app propõe, não decide.
    expect(paraDocumento(rowDocumento({ classificacao: null })).classificacao).toBeNull();
  });

  it("emitente e CNPJ vêm juntos, para o pagamento não recriar o favorecido com typo", () => {
    const doc = paraDocumento(rowDocumento({ favorecido: { nome: "Empreiteira X", documento: "98765432000188" } }));
    expect(doc.favorecidoNome).toBe("Empreiteira X");
    expect(doc.favorecidoDocumento).toBe("98765432000188");
  });

  it("nota sem emitente ligado não inventa nome nem CNPJ", () => {
    const doc = paraDocumento(rowDocumento({ favorecido_id: null, favorecido: null }));
    expect(doc.favorecidoId).toBeNull();
    expect(doc.favorecidoNome).toBeNull();
    expect(doc.favorecidoDocumento).toBeNull();
  });

  it("o papel no acervo acompanha a nota — documento sem arquivo é o que a meta 3 proíbe", () => {
    expect(paraDocumento(rowDocumento({ arquivo_path: "acervo/nf-77.pdf" })).arquivoPath).toBe("acervo/nf-77.pdf");
  });

  it("a obra da nota é a matrícula em que o custo cai, e vem da linha, não do contexto", () => {
    expect(paraDocumento(rowDocumento({ obra_id: "obra-2" })).obraId).toBe("obra-2");
  });
});

/**
 * O pagamento é a data que vale para o IRPF (regime de caixa) e a linha da
 * ficha Pagamentos Efetuados. PF espera recibo, PJ espera NF — daí o tipo do
 * favorecido vir junto.
 */
describe("pagamento lido do banco", () => {
  it("a data que vale para o custo é a do pagamento, e chega como o banco a gravou", () => {
    expect(paraPagamento(rowPagamento({ data_pagamento: "2025-12-31" }), [], undefined).dataPagamento).toBe("2025-12-31");
  });

  it("pagamento sem nota conciliada aparece como aguardando NF, com a lista de notas vazia", () => {
    const pag = paraPagamento(rowPagamento({ status: "aguardando_nf" }), [], undefined);
    expect(pag.status).toBe("aguardando_nf");
    expect(pag.documentoIds).toEqual([]);
  });

  it("as notas conciliadas do pagamento chegam todas, e é o que sustenta 'pago com documento'", () => {
    expect(paraPagamento(rowPagamento(), ["doc-1", "doc-2"], undefined).documentoIds).toEqual(["doc-1", "doc-2"]);
  });

  it("PF e PJ não se confundem: é o tipo que decide se o esperado é recibo ou NF", () => {
    expect(paraPagamento(rowPagamento({ favorecido: { nome: "José Pedreiro", tipo: "pf" } }), [], undefined).favorecidoTipo).toBe("pf");
    expect(paraPagamento(rowPagamento({ favorecido: null, favorecido_id: null }), [], undefined).favorecidoTipo).toBeNull();
  });

  it("pagamento sem diferença registrada não inventa encargo nem valor não explicado", () => {
    const pag = paraPagamento(rowPagamento(), [], undefined);
    expect(pag.encargosCentavos).toBe(0);
    expect(pag.naoExplicadoCentavos).toBe(0);
    expect(pag.resolucaoDiferenca).toBeNull();
  });

  it("a composição do desembolso, quando existe, sobrepõe o caso sem diferença", () => {
    const pag = paraPagamento(rowPagamento(), [], rowDiferenca({ encargos: 12.34, nao_explicado: 5, resolucao: "falta_documento" }));
    expect(pag.encargosCentavos).toBe(1234);
    expect(pag.naoExplicadoCentavos).toBe(500);
    expect(pag.resolucaoDiferenca).toBe("falta_documento");
  });

  it("a data da compra não vira a data do custo: o ano-calendário sai do pagamento", () => {
    // Regime de caixa (`CLAUDE.md`, invariante fiscal central): a chave é a
    // DATA DO PAGAMENTO. Compra em dezembro paga em janeiro é custo do ano
    // SEGUINTE — trocar `row.data_pagamento` por `row.data_compra` aqui move
    // o custo de ano-calendário e desencontra a declaração.
    const virada = paraPagamento(
      rowPagamento({ data_compra: "2025-12-28", data_pagamento: "2026-01-05" }),
      [],
      undefined,
    );
    expect(virada.dataPagamento).toBe("2026-01-05");
    // ⚠️ ANOTADO, NÃO CONSERTADO (critério 7 do CONTAI-029): o `cto-obra`
    // pediu "`data_compra` passa intacta". Ela NÃO passa — `paraPagamento`
    // não a mapeia e `Pagamento` (lib/types.ts) não tem o campo; quem grava
    // `data_compra` é `criarPagamento` (`lib/data.ts:1332`), e quem a exibe é
    // `Compromisso`. Travar o comportamento de hoje é o que cabe aqui; levar
    // a data da compra ao domínio é mudança de produção, e é outro ticket.
    expect("dataCompra" in virada).toBe(false);
  });

  it("o comprovante do pagamento acompanha a linha, e cartão sem comprovante fica explícito", () => {
    expect(paraPagamento(rowPagamento({ meio: "cartao", comprovante_path: null }), [], undefined).comprovantePath).toBeNull();
  });
});

/**
 * Diferença entre o que foi pago e o que a nota diz. O VALOR da diferença
 * nunca muda depois de registrado, e `resolucao` nasce `NULL` = "não sei
 * ainda" — por isso registrar e resolver são funções separadas.
 */
describe("diferença entre o pago e o documentado", () => {
  it("diferença ainda sem explicação fica sem explicação, não vira 'não compõe custo'", () => {
    expect(paraDiferenca(rowDiferenca({ resolucao: null })).resolucaoDiferenca).toBeNull();
  });

  it("a explicação escolhida pelo Mateus chega inteira à tela", () => {
    expect(paraDiferenca(rowDiferenca({ resolucao: "nao_compoe_custo" })).resolucaoDiferenca).toBe("nao_compoe_custo");
  });

  it("encargo e valor não explicado chegam em centavos, nos dois formatos do banco", () => {
    const d = paraDiferenca(rowDiferenca({ encargos: "12.34" as unknown as number, nao_explicado: 5.5 }));
    expect(d.encargosCentavos).toBe(1234);
    expect(d.naoExplicadoCentavos).toBe(550);
  });

  it("linha de diferença sem valor não some da conta: entra como zero", () => {
    const d = paraDiferenca(
      rowDiferenca({ encargos: null as unknown as number, nao_explicado: null as unknown as number }),
    );
    expect(d.encargosCentavos).toBe(0);
    expect(d.naoExplicadoCentavos).toBe(0);
  });
});

/**
 * Financiamento e informe anual do banco: é deles que sai a parcela do custo
 * do terreno/obra que entra em Bens e Direitos, e cada rubrica tem tratamento
 * próprio — somar tudo num campo só apaga a distinção.
 */
describe("financiamento do terreno", () => {
  const row = (over: Partial<FinanciamentoRow> = {}): FinanciamentoRow => ({
    id: "fin-1",
    obra_id: "obra-1",
    user_id: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    instituicao: "Caixa",
    numero_contrato: "8.4444.0000123-4",
    data_contrato: "2026-01-10",
    preco_contratado: 450000,
    numero_parcelas: 360,
    ...over,
  });

  it("o preço contratado chega em centavos, nos dois formatos do banco", () => {
    expect(paraFinanciamento(row({ preco_contratado: 450000 })).precoContratadoCentavos).toBe(45000000);
    expect(paraFinanciamento(row({ preco_contratado: "450000.00" as unknown as number })).precoContratadoCentavos).toBe(45000000);
  });

  it("instituição, contrato e data acompanham o financiamento — é o texto da discriminação", () => {
    const fin = paraFinanciamento(row());
    expect(fin.instituicao).toBe("Caixa");
    expect(fin.numeroContrato).toBe("8.4444.0000123-4");
    expect(fin.dataContrato).toBe("2026-01-10");
  });

  it("financiamento sem número de contrato informado não ganha um em branco", () => {
    const fin = paraFinanciamento(row({ numero_contrato: null, numero_parcelas: null }));
    expect(fin.numeroContrato).toBeNull();
    expect(fin.numeroParcelas).toBeNull();
  });
});

describe("informe anual do financiamento", () => {
  const row = (over: Partial<FinanciamentoInformeRow> = {}): FinanciamentoInformeRow => ({
    id: "inf-1",
    financiamento_id: "fin-1",
    created_at: "2027-02-01T00:00:00Z",
    ano_base: 2026,
    amortizacao: 12000,
    juros_correcao: 8000,
    seguros: 500,
    taxas_fcvs: 25,
    mora: 0,
    multa: 0,
    diferenca_teorico_pago: 0,
    total_pago: 20525,
    saldo_devedor: 438000,
    arquivo_path: "acervo/informe-2026.pdf",
    ...over,
  });

  it("cada rubrica do informe chega separada — juros e amortização não se somam num campo só", () => {
    const inf = paraInforme(row());
    expect(inf.amortizacaoCentavos).toBe(1200000);
    expect(inf.jurosCorrecaoCentavos).toBe(800000);
    expect(inf.segurosCentavos).toBe(50000);
    expect(inf.taxasFcvsCentavos).toBe(2500);
    expect(inf.totalPagoCentavos).toBe(2052500);
    expect(inf.saldoDevedorCentavos).toBe(43800000);
  });

  it("o ano-base amarra o informe à declaração daquele ano, e não ao ano do upload", () => {
    expect(paraInforme(row({ ano_base: 2025 })).anoBase).toBe(2025);
  });

  it("informe com rubrica serializada como texto declara o mesmo que a serializada como número", () => {
    const inf = paraInforme(row({ juros_correcao: "8000.00" as unknown as number, mora: "12.34" as unknown as number }));
    expect(inf.jurosCorrecaoCentavos).toBe(800000);
    expect(inf.moraCentavos).toBe(1234);
  });

  it("rubrica ausente entra como zero e não derruba o total do ano", () => {
    const inf = paraInforme(row({ multa: null as unknown as number, diferenca_teorico_pago: null as unknown as number }));
    expect(inf.multaCentavos).toBe(0);
    expect(inf.diferencaTeoricoPagoCentavos).toBe(0);
  });

  it("o informe guardado no acervo aponta para o arquivo — a guarda é da meta 3", () => {
    expect(paraInforme(row()).arquivoPath).toBe("acervo/informe-2026.pdf");
  });
});

/**
 * Compromisso é o que ainda VAI ser pago — não é custo até virar pagamento.
 * O casamento da quitação é por `favorecido_id`, nunca por nome
 * (`docs/pareceres/2026-08-17-vinculo-pagamento-documento.md`, adendo §C:
 * "CNPJ errado não é typo, é outro favorecido").
 */
describe("compromisso a pagar", () => {
  const row = (over: Partial<CompromissoRow & ComFavorecidoSimples> = {}): CompromissoRow & ComFavorecidoSimples => ({
    id: "com-1",
    obra_id: "obra-1",
    user_id: "user-1",
    created_at: "2026-03-01T00:00:00Z",
    favorecido_id: "fav-1",
    favorecido: { nome: "Depósito Cachoeira" },
    valor_previsto: 4850,
    data_prevista: "2026-04-10",
    origem: "boleto",
    documento_origem_id: "doc-1",
    situacao: "aberto",
    motivo_cancelamento: null,
    data_compra: "2026-03-01",
    ...over,
  });

  it("o valor previsto chega em centavos, nos dois formatos do banco", () => {
    expect(paraCompromisso(row({ valor_previsto: 4850 }), [], 0).valorPrevistoCentavos).toBe(485000);
    expect(paraCompromisso(row({ valor_previsto: "4850.00" as unknown as number }), [], 0).valorPrevistoCentavos).toBe(485000);
  });

  it("a identidade do favorecido é o id: o nome vai junto só para a agenda", () => {
    const com = paraCompromisso(row(), [], 0);
    expect(com.favorecidoId).toBe("fav-1");
    expect(com.favorecidoNome).toBe("Depósito Cachoeira");
  });

  it("compromisso sem favorecido ligado não inventa nome na agenda", () => {
    const com = paraCompromisso(row({ favorecido_id: null, favorecido: null }), [], 0);
    expect(com.favorecidoId).toBeNull();
    expect(com.favorecidoNome).toBeNull();
  });

  it("quitação parcial mostra os pagamentos que já entraram, sem inferir que está quitado", () => {
    const com = paraCompromisso(row({ situacao: "aberto" }), ["pag-1", "pag-2"], 0);
    expect(com.pagamentoIds).toEqual(["pag-1", "pag-2"]);
    expect(com.situacao).toBe("aberto");
  });

  it("compromisso sem data prevista fica sem data — 'sem data definida' é resposta, não default", () => {
    expect(paraCompromisso(row({ data_prevista: null }), [], 0).dataPrevista).toBeNull();
  });

  it("compromisso cancelado carrega o motivo, porque some da agenda e precisa de rastro", () => {
    const com = paraCompromisso(row({ situacao: "cancelado", motivo_cancelamento: "compra desfeita" }), [], 0);
    expect(com.situacao).toBe("cancelado");
    expect(com.motivoCancelamento).toBe("compra desfeita");
  });

  it("a nota que originou o compromisso continua apontada — é o elo do rastro", () => {
    expect(paraCompromisso(row({ documento_origem_id: "doc-9", origem: "boleto" }), [], 0).documentoOrigemId).toBe("doc-9");
  });

  it("os adiamentos contados chegam à tela, porque adiar demais é sinal de problema", () => {
    expect(paraCompromisso(row(), [], 3).adiamentos).toBe(3);
  });

  it("a data da compra não se confunde com a data prevista de pagamento", () => {
    const com = paraCompromisso(row({ data_compra: "2026-03-01", data_prevista: "2026-04-10" }), [], 0);
    expect(com.dataCompra).toBe("2026-03-01");
    expect(com.dataPrevista).toBe("2026-04-10");
  });
});
