"use client";

/**
 * Tradução row → domínio, compartilhada pelos módulos de `lib/dados/`.
 *
 * Aqui mora só o que é PURO: nenhuma função deste arquivo fala com o Supabase.
 * É o que torna a camada testável sem banco (CONTAI-029) — e é a única casa de
 * cada mapper: duplicar um deles é duplicar a conversão de centavos, que é o
 * erro de 100× do critério 6 do CONTAI-028.
 */

import { numericParaCentavos, centavosParaNumeric } from "@/lib/money";
import type {
  AnoAfetado,
  Compromisso,
  CompromissoRow,
  Documento,
  DocumentoRow,
  Financiamento,
  FinanciamentoInforme,
  FinanciamentoInformeRow,
  FinanciamentoRow,
  NaturezaAquisicaoTerreno,
  Obra,
  ObraInsert,
  ObraRow,
  Pagamento,
  PagamentoDiferencaRow,
  PagamentoDocumentoRow,
  PagamentoRow,
  PapelDeAnexo,
  RevisaoAnoAfetadoRow,
  TerrenoDesembolso,
  TerrenoDesembolsoAnexo,
  TerrenoDesembolsoAnexoRow,
  TerrenoDesembolsoRow,
  TipoFavorecido,
} from "@/lib/types";

/**
 * O emitente do documento, com o CNPJ/CPF junto: quem registra o pagamento a
 * partir da nota precisa dos DOIS para não recriar o favorecido com typo.
 */
export type ComFavorecido = {
  favorecido: { nome: string; documento: string } | null;
};
/** Pagamento também precisa do tipo: PF espera recibo, PJ espera NF. */
export type ComFavorecidoTipado = {
  favorecido: { nome: string; tipo: TipoFavorecido } | null;
};
/**
 * Compromisso só precisa do NOME para a agenda. O `favorecido_id` continua
 * sendo a identidade — o casamento da sugestão de quitação é por ele, nunca
 * por nome (adendo §C: "CNPJ errado não é typo, é outro favorecido").
 */
export type ComFavorecidoSimples = { favorecido: { nome: string } | null };

export type TerrenoDesembolsoComAnexos = TerrenoDesembolsoRow & {
  terreno_desembolso_anexo: TerrenoDesembolsoAnexoRow[] | null;
};

export function paraObra(row: ObraRow): Obra {
  return {
    id: row.id,
    nome: row.nome,
    cno: row.cno,
    matricula: row.matricula,
    cartorio: row.cartorio,
    municipio: row.municipio,
    naturezaAquisicaoTerreno: row.natureza_aquisicao_terreno,
    dataInicioObra: row.data_inicio_obra,
    cnoRegistradoEm: row.cno_registrado_em,
    unidadesAutonomas: row.unidades_autonomas,
    origemDesmembramentoLoteamento: row.origem_desmembramento_loteamento,
  };
}

export function paraDocumento(row: DocumentoRow & ComFavorecido): Documento {
  return {
    id: row.id,
    obraId: row.obra_id,
    tipo: row.tipo,
    status: row.status,
    valorCentavos: numericParaCentavos(row.valor),
    numero: row.numero,
    serie: row.serie,
    dataEmissao: row.data_emissao,
    vencimento: row.vencimento,
    classificacao: row.classificacao,
    destinatarioCpfOk: row.destinatario_cpf_ok,
    retencao11: row.retencao_11,
    motivoQuarentena: row.motivo_quarentena,
    favorecidoId: row.favorecido_id,
    favorecidoNome: row.favorecido?.nome ?? null,
    favorecidoDocumento: row.favorecido?.documento ?? null,
    arquivoPath: row.arquivo_path,
  };
}

/**
 * A composição do desembolso vem da tabela `pagamento_diferenca` (1:1), e não
 * de colunas de `pagamento` — critério 2 do CONTAI-019. Quem não tem linha lá
 * chega aqui com 0/0/null, que é o caso da esmagadora maioria dos pagamentos.
 */
const SEM_DIFERENCA = {
  encargosCentavos: 0,
  naoExplicadoCentavos: 0,
  resolucaoDiferenca: null,
} as const;

export function paraDiferenca(row: PagamentoDiferencaRow) {
  return {
    encargosCentavos: numericParaCentavos(row.encargos) ?? 0,
    naoExplicadoCentavos: numericParaCentavos(row.nao_explicado) ?? 0,
    resolucaoDiferenca: row.resolucao,
  };
}

export function paraPagamento(
  row: PagamentoRow & ComFavorecidoTipado,
  documentoIds: string[],
  diferenca: PagamentoDiferencaRow | undefined,
): Pagamento {
  return {
    ...(diferenca ? paraDiferenca(diferenca) : SEM_DIFERENCA),
    id: row.id,
    obraId: row.obra_id,
    valorCentavos: numericParaCentavos(row.valor) ?? 0,
    dataPagamento: row.data_pagamento,
    meio: row.meio,
    status: row.status,
    favorecidoId: row.favorecido_id,
    favorecidoNome: row.favorecido?.nome ?? null,
    favorecidoTipo: row.favorecido?.tipo ?? null,
    comprovantePath: row.comprovante_path,
    documentoIds,
  };
}

export interface EntradaObraBanco {
  nome: string;
  municipio: string | null;
  matricula: string | null;
  cartorio: string | null;
  cno: string | null;
  cnoRegistradoEm: string | null;
  dataInicioObra: string;
  /** `null` = ainda não respondida — pendência de complemento, não bloqueio. */
  naturezaAquisicaoTerreno: NaturezaAquisicaoTerreno | null;
  unidadesAutonomas: number;
  origemDesmembramentoLoteamento: boolean;
}

export function paraLinhaObra(entrada: EntradaObraBanco): ObraInsert {
  return {
    nome: entrada.nome,
    municipio: entrada.municipio,
    matricula: entrada.matricula,
    cartorio: entrada.cartorio,
    cno: entrada.cno,
    cno_registrado_em: entrada.cnoRegistradoEm,
    data_inicio_obra: entrada.dataInicioObra,
    natureza_aquisicao_terreno: entrada.naturezaAquisicaoTerreno,
    unidades_autonomas: entrada.unidadesAutonomas,
    origem_desmembramento_loteamento: entrada.origemDesmembramentoLoteamento,
  };
}

export function paraDesembolsoTerreno(
  row: TerrenoDesembolsoComAnexos,
): TerrenoDesembolso {
  return {
    id: row.id,
    obraId: row.obra_id,
    tipo: row.tipo,
    valorCentavos: numericParaCentavos(row.valor) ?? 0,
    dataPagamento: row.data_pagamento,
    estado: row.estado,
    origemRecurso: row.origem_recurso,
    anexos: (row.terreno_desembolso_anexo ?? [])
      // Do mais antigo para o mais novo: é essa ordem que a re-pergunta do §6
      // lê, e é a ordem em que os papéis chegaram ao acervo.
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(paraAnexoDeDesembolso),
    debitosMesmoDia: row.debitos_mesmo_dia,
    debitosMesmoDiaRespondidoEm: row.debitos_mesmo_dia_respondido_em,
  };
}

/**
 * `papel` volta do PostgREST como `text` — o banco é quem o fecha, pelo check
 * `terreno_anexo_papel` da 0010 (e não um enum, porque `alter type add value`
 * não convive com a transação única da migration). O cast é o ponto onde a
 * garantia do banco vira a garantia do tipo, e ele mora aqui, sozinho.
 */
export function paraAnexoDeDesembolso(
  row: TerrenoDesembolsoAnexoRow,
): TerrenoDesembolsoAnexo {
  return {
    id: row.id,
    arquivoPath: row.arquivo_path,
    papel: row.papel as PapelDeAnexo,
    createdAt: row.created_at,
  };
}

export function paraFinanciamento(row: FinanciamentoRow): Financiamento {
  return {
    id: row.id,
    obraId: row.obra_id,
    instituicao: row.instituicao,
    numeroContrato: row.numero_contrato,
    dataContrato: row.data_contrato,
    precoContratadoCentavos: numericParaCentavos(row.preco_contratado) ?? 0,
    numeroParcelas: row.numero_parcelas,
  };
}

export function paraInforme(row: FinanciamentoInformeRow): FinanciamentoInforme {
  return {
    id: row.id,
    financiamentoId: row.financiamento_id,
    anoBase: row.ano_base,
    amortizacaoCentavos: numericParaCentavos(row.amortizacao) ?? 0,
    jurosCorrecaoCentavos: numericParaCentavos(row.juros_correcao) ?? 0,
    segurosCentavos: numericParaCentavos(row.seguros) ?? 0,
    taxasFcvsCentavos: numericParaCentavos(row.taxas_fcvs) ?? 0,
    moraCentavos: numericParaCentavos(row.mora) ?? 0,
    multaCentavos: numericParaCentavos(row.multa) ?? 0,
    diferencaTeoricoPagoCentavos:
      numericParaCentavos(row.diferenca_teorico_pago) ?? 0,
    totalPagoCentavos: numericParaCentavos(row.total_pago) ?? 0,
    saldoDevedorCentavos: numericParaCentavos(row.saldo_devedor) ?? 0,
    arquivoPath: row.arquivo_path,
  };
}

export function indexarDiferencas(
  linhas: PagamentoDiferencaRow[],
): Map<string, PagamentoDiferencaRow> {
  return new Map(linhas.map((d) => [d.pagamento_id, d]));
}

export function agruparVinculos(linhas: PagamentoDocumentoRow[]): Map<string, string[]> {
  const docsPorPagamento = new Map<string, string[]>();
  for (const v of linhas) {
    const lista = docsPorPagamento.get(v.pagamento_id) ?? [];
    lista.push(v.documento_id);
    docsPorPagamento.set(v.pagamento_id, lista);
  }
  return docsPorPagamento;
}

/**
 * O snapshot de anos afetados, no formato que a migration 0009 recebe.
 * Centavos viram `numeric(14,2)` aqui, e só aqui.
 */
export function paraAnosJson(anos: readonly AnoAfetado[]) {
  return anos.map((a) => ({
    ano: a.ano,
    obra_id: a.obraId,
    custo_antes: centavosParaNumeric(a.antesCentavos),
    custo_depois: centavosParaNumeric(a.depoisCentavos),
    pendencia: a.pendencia,
  }));
}

export function paraAnoAfetado(row: RevisaoAnoAfetadoRow): AnoAfetado {
  return {
    obraId: row.obra_id,
    ano: row.ano,
    antesCentavos: numericParaCentavos(row.custo_antes) ?? 0,
    depoisCentavos: numericParaCentavos(row.custo_depois) ?? 0,
    pendencia: row.pendencia_id !== null,
  };
}

export function paraCompromisso(
  row: CompromissoRow & ComFavorecidoSimples,
  pagamentoIds: string[],
  adiamentos: number,
): Compromisso {
  return {
    id: row.id,
    obraId: row.obra_id,
    favorecidoId: row.favorecido_id,
    favorecidoNome: row.favorecido?.nome ?? null,
    valorPrevistoCentavos: numericParaCentavos(row.valor_previsto) ?? 0,
    dataPrevista: row.data_prevista,
    origem: row.origem,
    documentoOrigemId: row.documento_origem_id,
    situacao: row.situacao,
    motivoCancelamento: row.motivo_cancelamento,
    dataCompra: row.data_compra,
    pagamentoIds,
    adiamentos,
  };
}
