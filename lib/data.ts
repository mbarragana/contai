"use client";

/**
 * Acesso ao Supabase. Traduz as rows do PostgREST (numeric como string) para
 * os tipos de domínio em centavos; as regras fiscais ficam em lib/fiscal/*,
 * fora daqui.
 */

import {
  ACERVO_NEGADO,
  classificarFalhaDeAbertura,
} from "@/lib/acervo";
import { podeQuitar } from "@/lib/fiscal/compromisso";
import type {
  EscolhaDePagamento,
  LinhaDeAnoDaPendencia,
} from "@/lib/fiscal/revisao";
import { podeVincular } from "@/lib/fiscal/vinculo";
import { numericParaCentavos, centavosParaNumeric } from "@/lib/money";
import {
  BUCKET_ACERVO,
  getSupabase,
  getUsuarioId,
  SemSessaoError,
} from "@/lib/supabase";
import type {
  AnoAfetado,
  Classificacao,
  Compromisso,
  CompromissoDataHistoricoRow,
  CompromissoInsert,
  CompromissoPagamentoRow,
  CompromissoRow,
  Documento,
  DocumentoInsert,
  DocumentoRow,
  FavorecidoInsert,
  Financiamento,
  FinanciamentoInforme,
  FinanciamentoInformeRow,
  FinanciamentoRow,
  NaturezaAquisicaoTerreno,
  Obra,
  ObraInsert,
  ObraRow,
  OrigemCompromisso,
  OrigemRecursoEntrada,
  Pagamento,
  PagamentoDiferencaRow,
  PagamentoDocumentoRow,
  PagamentoInsert,
  PagamentoRow,
  QuitacaoRecusadaRow,
  DesfechoPendencia,
  MotivoRevisao,
  PendenciaDesfechoRow,
  PendenciaPersistente,
  PendenciaRow,
  ResolucaoDiferenca,
  Revisao,
  RevisaoAnoAfetadoRow,
  RevisaoRow,
  TerrenoDesembolso,
  TerrenoDesembolsoRow,
  TipoDesembolsoTerreno,
  TipoFavorecido,
} from "@/lib/types";

/**
 * O emitente do documento, com o CNPJ/CPF junto: quem registra o pagamento a
 * partir da nota precisa dos DOIS para não recriar o favorecido com typo.
 */
type ComFavorecido = {
  favorecido: { nome: string; documento: string } | null;
};
/** Pagamento também precisa do tipo: PF espera recibo, PJ espera NF. */
type ComFavorecidoTipado = {
  favorecido: { nome: string; tipo: TipoFavorecido } | null;
};
/**
 * Compromisso só precisa do NOME para a agenda. O `favorecido_id` continua
 * sendo a identidade — o casamento da sugestão de quitação é por ele, nunca
 * por nome (adendo §C: "CNPJ errado não é typo, é outro favorecido").
 */
type ComFavorecidoSimples = { favorecido: { nome: string } | null };

/**
 * Obra pedida por id que não existe (link velho, obra apagada em outro
 * aparelho). NUNCA é motivo para o app cair na primeira obra da conta: quem
 * chama abre a lista e deixa o Mateus escolher (critério 6).
 */
export class ObraNaoEncontradaError extends Error {
  constructor() {
    super("Obra não encontrada nesta conta.");
    this.name = "ObraNaoEncontradaError";
  }
}

function paraObra(row: ObraRow): Obra {
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

function paraDocumento(row: DocumentoRow & ComFavorecido): Documento {
  return {
    id: row.id,
    obraId: row.obra_id,
    tipo: row.tipo,
    status: row.status,
    valorCentavos: numericParaCentavos(row.valor),
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

function paraDiferenca(row: PagamentoDiferencaRow) {
  return {
    encargosCentavos: numericParaCentavos(row.encargos) ?? 0,
    naoExplicadoCentavos: numericParaCentavos(row.nao_explicado) ?? 0,
    resolucaoDiferenca: row.resolucao,
  };
}

function paraPagamento(
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

/**
 * Todas as obras da conta, da mais antiga para a mais nova.
 *
 * Sem sessão o banco não devolve linha nenhuma (desde a migration 0005 o papel
 * `anon` nem chega na policy: falta GRANT), e "nenhuma obra cadastrada" seria
 * diagnóstico errado para quem só não está logado — por isso a sessão é
 * exigida aqui, e a falta dela sobe como SemSessaoError (critério 5 do
 * CONTAI-002), não como lista vazia.
 *
 * O `limit(1)` que existia aqui era o bug do critério 6: com duas obras, todo
 * documento da segunda caía silenciosamente na primeira.
 */
export async function carregarObras(): Promise<Obra[]> {
  await getUsuarioId();
  const { data, error } = await getSupabase()
    .from("obra")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ObraRow[]).map(paraObra);
}

/** Uma obra pela identidade. Id que não existe é erro, nunca "pega outra". */
export async function carregarObra(id: string): Promise<Obra> {
  await getUsuarioId();
  const { data, error } = await getSupabase()
    .from("obra")
    .select("*")
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  const row = (data as ObraRow[] | null)?.[0];
  if (!row) throw new ObraNaoEncontradaError();
  return paraObra(row);
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

function paraLinhaObra(entrada: EntradaObraBanco): ObraInsert {
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

export async function criarObra(entrada: EntradaObraBanco): Promise<string> {
  const { data, error } = await getSupabase()
    .from("obra")
    .insert(paraLinhaObra(entrada))
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * O cadastro é editável depois (critério 5): o CNO sai depois do início da
 * obra e o ITBI/escritura pode ser pago meses depois da compra do terreno.
 */
export async function atualizarObra(
  id: string,
  entrada: EntradaObraBanco,
): Promise<void> {
  const { error } = await getSupabase()
    .from("obra")
    .update(paraLinhaObra(entrada))
    .eq("id", id);
  if (error) throw error;
}

export interface PainelDados {
  obra: Obra;
  documentos: Documento[];
  pagamentos: Pagamento[];
  /**
   * CONTAI-010 — o custo do terreno saiu das colunas da obra e virou lista
   * DATADA. Viaja no painel porque `calcularResumo({ ...dados, ano })` precisa
   * dele para a situação em 31/12; ao contrário do compromisso, ele É custo de
   * aquisição e o lugar dele é dentro do cálculo.
   */
  desembolsosTerreno: TerrenoDesembolso[];
  informesFinanciamento: FinanciamentoInforme[];
  /**
   * O CONTRATO do financiamento, ou `null`. Viaja no painel porque é ele — e
   * não a existência de um informe — que diz que ESTA obra tem financiamento:
   * contrato assinado e zero informes é o estado real da obra hoje, e era o
   * estado em que a home ficava muda sobre um custo de dezenas de milhares de
   * reais por ano (critério 16).
   */
  financiamento: Financiamento | null;
}

function paraDesembolsoTerreno(row: TerrenoDesembolsoRow): TerrenoDesembolso {
  return {
    id: row.id,
    obraId: row.obra_id,
    tipo: row.tipo,
    valorCentavos: numericParaCentavos(row.valor) ?? 0,
    dataPagamento: row.data_pagamento,
    estado: row.estado,
    origemRecurso: row.origem_recurso,
    arquivoPath: row.arquivo_path,
  };
}

function paraFinanciamento(row: FinanciamentoRow): Financiamento {
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

function paraInforme(row: FinanciamentoInformeRow): FinanciamentoInforme {
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

function indexarDiferencas(
  linhas: PagamentoDiferencaRow[],
): Map<string, PagamentoDiferencaRow> {
  return new Map(linhas.map((d) => [d.pagamento_id, d]));
}

function agruparVinculos(linhas: PagamentoDocumentoRow[]): Map<string, string[]> {
  const docsPorPagamento = new Map<string, string[]>();
  for (const v of linhas) {
    const lista = docsPorPagamento.get(v.pagamento_id) ?? [];
    lista.push(v.documento_id);
    docsPorPagamento.set(v.pagamento_id, lista);
  }
  return docsPorPagamento;
}

/**
 * Tudo que a home precisa, SEMPRE de uma obra só — nada é somado entre obras
 * (Bens e Direitos não soma entre matrículas, aferição não soma entre CNOs).
 * Sem sessão, `getUsuarioId` já falha explicitamente.
 */
export async function carregarPainel(obraId: string): Promise<PainelDados> {
  await getUsuarioId();
  const supabase = getSupabase();
  const obra = await carregarObra(obraId);

  const [
    documentos,
    pagamentos,
    vinculos,
    diferencas,
    desembolsos,
    financiamentos,
    informes,
  ] = await Promise.all([
      supabase
        .from("documento")
        .select("*, favorecido(nome, documento)")
        .eq("obra_id", obra.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("pagamento")
        .select("*, favorecido(nome, tipo)")
        .eq("obra_id", obra.id)
        .order("data_pagamento", { ascending: false }),
      supabase.from("pagamento_documento").select("*"),
      supabase.from("pagamento_diferenca").select("*"),
      supabase
        .from("terreno_desembolso")
        .select("*")
        .eq("obra_id", obra.id)
        .order("data_pagamento", { ascending: true, nullsFirst: false }),
      supabase.from("financiamento").select("*").eq("obra_id", obra.id),
      // O informe pertence ao CONTRATO, não à obra. Vem tudo e filtra-se aqui:
      // a RLS já limita à conta, e o volume é UMA LINHA POR ANO POR CONTRATO —
      // ~20 linhas na vida inteira do financiamento do Mateus.
      supabase
        .from("financiamento_informe")
        .select("*")
        .order("ano_base", { ascending: true }),
    ]);

  if (documentos.error) throw documentos.error;
  if (pagamentos.error) throw pagamentos.error;
  if (vinculos.error) throw vinculos.error;
  if (diferencas.error) throw diferencas.error;
  if (desembolsos.error) throw desembolsos.error;
  if (financiamentos.error) throw financiamentos.error;
  if (informes.error) throw informes.error;

  const contratosDaObra = new Set(
    ((financiamentos.data ?? []) as FinanciamentoRow[]).map((f) => f.id),
  );

  const docsPorPagamento = agruparVinculos(
    (vinculos.data ?? []) as PagamentoDocumentoRow[],
  );
  const porPagamento = indexarDiferencas(
    (diferencas.data ?? []) as PagamentoDiferencaRow[],
  );

  return {
    obra,
    documentos: ((documentos.data ?? []) as (DocumentoRow & ComFavorecido)[]).map(
      paraDocumento,
    ),
    pagamentos: (
      (pagamentos.data ?? []) as (PagamentoRow & ComFavorecidoTipado)[]
    ).map((row) =>
      paraPagamento(row, docsPorPagamento.get(row.id) ?? [], porPagamento.get(row.id)),
    ),
    desembolsosTerreno: ((desembolsos.data ?? []) as TerrenoDesembolsoRow[]).map(
      paraDesembolsoTerreno,
    ),
    informesFinanciamento: ((informes.data ?? []) as FinanciamentoInformeRow[])
      .filter((i) => contratosDaObra.has(i.financiamento_id))
      .map(paraInforme),
    // `unique (obra_id)` no banco: no máximo uma linha por obra.
    financiamento: ((financiamentos.data ?? []) as FinanciamentoRow[])[0]
      ? paraFinanciamento(((financiamentos.data ?? []) as FinanciamentoRow[])[0])
      : null,
  };
}

/**
 * Um painel por obra, para a LISTA de obras contar as pendências de cada uma.
 * A lista mostra contagem, nunca dinheiro (critério 14) — dois valores lado a
 * lado convidam a uma soma que não existe em declaração nenhuma.
 */
export async function carregarPaineis(): Promise<PainelDados[]> {
  await getUsuarioId();
  const supabase = getSupabase();
  const obras = await carregarObras();
  if (obras.length === 0) return [];

  const [
    documentos,
    pagamentos,
    vinculos,
    diferencas,
    desembolsos,
    financiamentos,
    informes,
  ] = await Promise.all([
    supabase
      .from("documento")
      .select("*, favorecido(nome, documento)")
      .order("created_at", { ascending: false }),
    supabase
      .from("pagamento")
      .select("*, favorecido(nome, tipo)")
      .order("data_pagamento", { ascending: false }),
    supabase.from("pagamento_documento").select("*"),
    supabase.from("pagamento_diferenca").select("*"),
    supabase
      .from("terreno_desembolso")
      .select("*")
      .order("data_pagamento", { ascending: true, nullsFirst: false }),
    supabase.from("financiamento").select("*"),
    supabase
      .from("financiamento_informe")
      .select("*")
      .order("ano_base", { ascending: true }),
  ]);

  if (documentos.error) throw documentos.error;
  if (pagamentos.error) throw pagamentos.error;
  if (vinculos.error) throw vinculos.error;
  if (diferencas.error) throw diferencas.error;
  if (desembolsos.error) throw desembolsos.error;
  if (financiamentos.error) throw financiamentos.error;
  if (informes.error) throw informes.error;

  const docsPorPagamento = agruparVinculos(
    (vinculos.data ?? []) as PagamentoDocumentoRow[],
  );
  const porPagamento = indexarDiferencas(
    (diferencas.data ?? []) as PagamentoDiferencaRow[],
  );
  // Contrato → obra: o informe não conhece a obra, só o contrato.
  const obraDoContrato = new Map(
    ((financiamentos.data ?? []) as FinanciamentoRow[]).map((f) => [
      f.id,
      f.obra_id,
    ]),
  );

  return obras.map((obra) => ({
    obra,
    documentos: ((documentos.data ?? []) as (DocumentoRow & ComFavorecido)[])
      .filter((row) => row.obra_id === obra.id)
      .map(paraDocumento),
    pagamentos: ((pagamentos.data ?? []) as (PagamentoRow & ComFavorecidoTipado)[])
      .filter((row) => row.obra_id === obra.id)
      .map((row) =>
        paraPagamento(row, docsPorPagamento.get(row.id) ?? [], porPagamento.get(row.id)),
      ),
    desembolsosTerreno: ((desembolsos.data ?? []) as TerrenoDesembolsoRow[])
      .filter((row) => row.obra_id === obra.id)
      .map(paraDesembolsoTerreno),
    informesFinanciamento: ((informes.data ?? []) as FinanciamentoInformeRow[])
      .filter((row) => obraDoContrato.get(row.financiamento_id) === obra.id)
      .map(paraInforme),
    financiamento:
      ((financiamentos.data ?? []) as FinanciamentoRow[])
        .filter((f) => f.obra_id === obra.id)
        .map(paraFinanciamento)[0] ?? null,
  }));
}

export async function carregarDocumento(id: string): Promise<Documento> {
  const { data, error } = await getSupabase()
    .from("documento")
    .select("*, favorecido(nome, documento)")
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  const row = (data as (DocumentoRow & ComFavorecido)[] | null)?.[0];
  if (!row) throw new Error("Documento não encontrado.");
  return paraDocumento(row);
}

export async function carregarPagamento(id: string): Promise<Pagamento> {
  const supabase = getSupabase();
  const [pagamento, vinculos, diferenca] = await Promise.all([
    supabase
      .from("pagamento")
      .select("*, favorecido(nome, tipo)")
      .eq("id", id)
      .limit(1),
    supabase.from("pagamento_documento").select("*").eq("pagamento_id", id),
    supabase.from("pagamento_diferenca").select("*").eq("pagamento_id", id).limit(1),
  ]);
  if (pagamento.error) throw pagamento.error;
  if (vinculos.error) throw vinculos.error;
  if (diferenca.error) throw diferenca.error;

  const row = (pagamento.data as (PagamentoRow & ComFavorecidoTipado)[] | null)?.[0];
  if (!row) throw new Error("Pagamento não encontrado.");
  return paraPagamento(
    row,
    ((vinculos.data ?? []) as PagamentoDocumentoRow[]).map((v) => v.documento_id),
    ((diferenca.data ?? []) as PagamentoDiferencaRow[])[0],
  );
}

/**
 * O snapshot de anos afetados, no formato que a migration 0009 recebe.
 * Centavos viram `numeric(14,2)` aqui, e só aqui.
 */
function paraAnosJson(anos: readonly AnoAfetado[]) {
  return anos.map((a) => ({
    ano: a.ano,
    obra_id: a.obraId,
    custo_antes: centavosParaNumeric(a.antesCentavos),
    custo_depois: centavosParaNumeric(a.depoisCentavos),
    pendencia: a.pendencia,
  }));
}

/**
 * Correção da obra de um DOCUMENTO já salvo (critério 13 do CONTAI-021).
 *
 * ⚠️ **Isto conserta um bug que estava EM PRODUÇÃO.** Até 19/08 esta função era
 * um `UPDATE documento SET obra_id` **seco**: não tocava `pagamento.obra_id`,
 * não tocava `pagamento_documento`, não gravava rastro. O efeito real, com as
 * duas obras que o Mateus tem hoje (parecer, adendo §5.1 — retratação do
 * `contador` em 19/08):
 *
 * 1. na ORIGEM o pagamento perdia a nota: o custo comprovado do ano **caía** e
 *    o **"pago sem nota" subia pelo mesmo valor** — alarme vermelho da meta 1
 *    por um fato que não aconteceu, e "pago sem nota" é o número pelo qual ele
 *    decide se pode pagar alguém;
 * 2. no DESTINO entrava documento sem pagamento nenhum: `min(0, valor) = 0`, o
 *    custo **não subia**;
 * 3. no BANCO sobrava vínculo vivo cruzando duas obras, invisível nas duas
 *    telas — o estado que o critério 11 do CONTAI-018 proíbe pela porta da
 *    frente, nascendo pela porta dos fundos.
 *
 * "Não é transferência, é evaporação."
 *
 * Agora é UM ATO TRANSACIONAL (critério 9 / adendo §5.5): documento, N
 * `pagamento.obra_id`, N deleções de vínculo, N linhas de `revisao` com o
 * MESMO `ato_id` e a pendência do ano gravam juntos, ou nada grava. A escolha
 * de cada pagamento vem da tela, **um a um** — cascata silenciosa é proibida
 * (parecer §4.4) — e a função recusa o ato se algum pagamento vinculado ficar
 * sem desfecho.
 *
 * A regra fiscal que decide SE pode mover continua em `lib/fiscal/obra.ts`
 * (`podeCorrigirObra`, revalidação de CNO da NF de serviço); o que muda no
 * custo é `lib/fiscal/revisao.ts`. Aqui só grava.
 */
export async function moverDocumentoDeObra(
  id: string,
  obraDestinoId: string,
  escolhas: readonly EscolhaDePagamento[],
  anos: readonly AnoAfetado[],
): Promise<string> {
  const { data, error } = await getSupabase().rpc("mover_documento_de_obra", {
    p_documento_id: id,
    p_obra_destino: obraDestinoId,
    p_pagamentos: escolhas.map((e) => ({
      pagamento_id: e.pagamentoId,
      desfecho: e.desfecho,
    })),
    p_anos: paraAnosJson(anos),
  });
  if (error) throw error;
  return data as string;
}

export async function moverPagamentoDeObra(
  id: string,
  obraDestinoId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from("pagamento")
    .update({ obra_id: obraDestinoId })
    .eq("id", id);
  if (error) throw error;
}

// ══ CONTAI-021 · as três ações nomeadas de correção ═════════════════════
//
// ⚠️ TRÊS FUNÇÕES, e não uma `corrigirDocumento(campo, valor)` genérica. É a
// decisão de forma do `cto-obra` (18/08), e o fundamento é de domínio: os
// campos têm REGIMES DE CONSEQUÊNCIA diferentes — valor recalcula custo e pode
// abrir pendência de retificadora; classificação muda a composição e não muda
// total nenhum; nome do emitente é OUTRA TABELA e não abre pendência. Um
// caminho só precisaria expressar os três ao mesmo tempo, e é assim que o
// aviso certo aparece na hora errada.
//
// Todas gravam por RPC: a atomicidade do critério 9 é da função Postgres
// (migration 0009), não daqui. Se a transação não fechar, NADA muda — que é o
// que a tela de falha promete.

/**
 * Corrigir o VALOR (critério 3). O único campo do `documento` que move custo
 * entre anos-calendário — `data_emissao` **nunca** governa o ano do custo
 * (parecer §0(a)); quem faz isso é `pagamento.data_pagamento`.
 *
 * `anexoPath` é obrigatório quando o motivo é `emitente_corrigiu_a_nota`
 * (critério 10), e entra como anexo ADICIONAL: `arquivo_path` não se
 * substitui (critério 18). Quem recusa é a função, não a tela.
 */
export async function corrigirValorDoDocumento(entrada: {
  documentoId: string;
  valorCentavos: number;
  motivo: MotivoRevisao;
  motivoTexto: string | null;
  anos: readonly AnoAfetado[];
  anexoPath: string | null;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc("corrigir_documento", {
    p_documento_id: entrada.documentoId,
    p_campo: "valor",
    // Texto, e no formato do `numeric(14,2)`: o rastro grava antes/depois como
    // texto justamente para preservar `null`, zeros à esquerda e enum (§5).
    p_depois: centavosParaNumeric(entrada.valorCentavos).toFixed(2),
    p_motivo: entrada.motivo,
    p_anos: paraAnosJson(entrada.anos),
    ...(entrada.motivoTexto ? { p_motivo_texto: entrada.motivoTexto } : {}),
    ...(entrada.anexoPath ? { p_anexo_path: entrada.anexoPath } : {}),
  });
  if (error) throw error;
  return data as string;
}

/**
 * Corrigir a CLASSIFICAÇÃO (critério 5) — material ↔ mão de obra, **sem
 * trava**. Não muda total nenhum; muda a composição da discriminação
 * (parecer §1). Por isso `anos` chega vazio: nenhum número declarado se mexe,
 * e pendência persistente só nasce quando um número muda.
 */
export async function corrigirClassificacaoDoDocumento(entrada: {
  documentoId: string;
  classificacao: Classificacao;
  motivo: MotivoRevisao;
  motivoTexto: string | null;
  anexoPath: string | null;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc("corrigir_documento", {
    p_documento_id: entrada.documentoId,
    p_campo: "classificacao",
    p_depois: entrada.classificacao,
    p_motivo: entrada.motivo,
    p_anos: [],
    ...(entrada.motivoTexto ? { p_motivo_texto: entrada.motivoTexto } : {}),
    ...(entrada.anexoPath ? { p_anexo_path: entrada.anexoPath } : {}),
  });
  if (error) throw error;
  return data as string;
}

/**
 * Corrigir o NOME do emitente (critério 6) — o **único** caminho pelo qual um
 * nome de favorecido muda no app.
 *
 * Fecha a ferida deixada aberta em `b807901`: `garantirFavorecido` usa
 * `ignoreDuplicates` justamente para NUNCA renomear em silêncio, e a
 * consequência aceita lá era "nome gravado errado não se corrige por aqui — a
 * correção é ato próprio, com rastro, e não existe hoje". Existe agora.
 *
 * ⚠️ O CNPJ/CPF **não é parâmetro**: a string de um favorecido existente nunca
 * é reescrita (parecer §1 e §4.2). Sem pendência: o custo não muda um centavo
 * (adendo §4).
 *
 * ⚠️ `anexoPath` entrou no Gate 2 (bloqueante 2): `emitente_corrigiu_a_nota`
 * gravava aqui SEM anexo enquanto `corrigirValorDoDocumento` o exigia — e o
 * passo 1, que é o mesmo componente nas três telas, já prometia "sem ele, esta
 * correção não grava". Reemissão com razão social corrigida é caso real
 * (`contador`, 20/08), então o motivo FICA na lista e o que entra é a guarda.
 * O `documentoId` é o registro a que o anexo se soma: o nome vive em
 * `favorecido`, mas o PAPEL do emitente está no documento.
 */
export async function corrigirNomeDoFavorecido(entrada: {
  favorecidoId: string;
  documentoId: string;
  nome: string;
  motivo: MotivoRevisao;
  motivoTexto: string | null;
  anexoPath: string | null;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc("corrigir_nome_favorecido", {
    p_favorecido_id: entrada.favorecidoId,
    p_documento_id: entrada.documentoId,
    p_nome: entrada.nome,
    p_motivo: entrada.motivo,
    ...(entrada.motivoTexto ? { p_motivo_texto: entrada.motivoTexto } : {}),
    ...(entrada.anexoPath ? { p_anexo_path: entrada.anexoPath } : {}),
  });
  if (error) throw error;
  return data as string;
}

/**
 * Critério 19 — *"Marcar: o CNPJ deste registro está errado — tratar"*.
 *
 * IDEMPOTENTE: voltar e marcar de novo deixa a lista com uma linha só. Não
 * abre campo, não mexe em `status`, não manda para quarentena, e **não gera
 * linha de `revisao`** — nenhum dado do documento mudou, não há antes→depois a
 * registrar (adendo §1). O que existe é a pendência aberta, com a data.
 */
export async function marcarEmitenteErrado(documentoId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("marcar_emitente_errado", {
    p_documento_id: documentoId,
  });
  if (error) throw error;
  return data as string;
}

/**
 * As pendências persistentes da conta — abertas e baixadas (critérios 4, 19,
 * 20 e 21).
 *
 * Vêm TODAS, com o desfecho junto: "aberta" é a AUSÊNCIA de linha em
 * `pendencia_desfecho`, e o histórico do ano (mock s7e) precisa das baixadas.
 * O volume é de uma linha por ano-calendário e uma por documento marcado —
 * dezenas na vida inteira da obra.
 */
export async function carregarPendencias(): Promise<PendenciaPersistente[]> {
  const supabase = getSupabase();
  const [pendencias, desfechos] = await Promise.all([
    supabase.from("pendencia").select("*").order("aberta_em", { ascending: false }),
    supabase.from("pendencia_desfecho").select("*"),
  ]);
  if (pendencias.error) throw pendencias.error;
  if (desfechos.error) throw desfechos.error;

  const porPendencia = new Map(
    ((desfechos.data ?? []) as PendenciaDesfechoRow[]).map((d) => [
      d.pendencia_id,
      d,
    ]),
  );

  return ((pendencias.data ?? []) as PendenciaRow[]).map((p) => {
    const d = porPendencia.get(p.id);
    return {
      id: p.id,
      tipo: p.tipo,
      ano: p.ano,
      documentoId: p.documento_id,
      abertaEm: p.aberta_em,
      desfecho: d
        ? {
            desfecho: d.desfecho,
            dataInformada: d.data_informada,
            baixadaEm: d.baixada_em,
          }
        : null,
    };
  });
}

/**
 * Baixar a pendência, com o desfecho escolhido (critérios 19 e 21).
 *
 * **INSERT, não update** — a pendência sai da lista e fica no histórico, com
 * quem, quando e qual desfecho, legível em 2034. Quem valida se o desfecho
 * pertence à lista DAQUELE tipo é o banco (check + FK composto da 0009): os
 * três desfechos do critério 21 são todos sobre DAA, e nenhum descreve
 * "resolvi o CNPJ errado".
 */
export async function baixarPendencia(entrada: {
  pendenciaId: string;
  desfecho: DesfechoPendencia;
  dataInformada: string | null;
}): Promise<void> {
  const { error } = await getSupabase().rpc("baixar_pendencia", {
    p_pendencia_id: entrada.pendenciaId,
    p_desfecho: entrada.desfecho,
    ...(entrada.dataInformada ? { p_data: entrada.dataInformada } : {}),
  });
  if (error) throw error;
}

/**
 * As correções que compõem cada pendência de ano (critério 20a) — as linhas de
 * `revisao_ano_afetado` com a revisão delas.
 *
 * É daqui que saem as três coisas que a tela da pendência mostra e que nenhuma
 * outra consulta tem: o ACUMULADO do ano por obra (primeiro `antes` → último
 * `depois`), o CONJUNTO DE OBRAS AFETADAS e a lista de atos que a compõem.
 */
export async function carregarAnosDasPendencias(): Promise<
  LinhaDeAnoDaPendencia[]
> {
  const { data, error } = await getSupabase()
    .from("revisao_ano_afetado")
    .select("*")
    .not("pendencia_id", "is", null);
  if (error) throw error;
  return ((data ?? []) as RevisaoAnoAfetadoRow[]).map((row) => ({
    pendenciaId: row.pendencia_id as string,
    revisaoId: row.revisao_id,
    ano: paraAnoAfetado(row),
  }));
}

/**
 * Tudo que as telas de pendência precisam, numa carga só: a pendência, o
 * snapshot de anos por obra e as revisões que a compõem.
 *
 * Existe para as TRÊS superfícies (home da obra, lista e detalhe) lerem o mesmo
 * conjunto — quem monta é `montarPendenciasDeAno`, pura e com teste unitário.
 * Duas montagens diferentes do mesmo alarme divergem, e o Mateus veria dois
 * números para o mesmo evento fiscal.
 */
export async function carregarPainelDePendencias(): Promise<{
  pendencias: PendenciaPersistente[];
  linhas: LinhaDeAnoDaPendencia[];
  revisoes: Revisao[];
}> {
  const [pendencias, linhas] = await Promise.all([
    carregarPendencias(),
    carregarAnosDasPendencias(),
  ]);
  const revisoes = await carregarRevisoesPorId([
    ...new Set(linhas.map((l) => l.revisaoId)),
  ]);
  return { pendencias, linhas, revisoes };
}

/** As linhas de rastro pedidas por id — o detalhe de cada ato da pendência. */
export async function carregarRevisoesPorId(ids: string[]): Promise<Revisao[]> {
  if (ids.length === 0) return [];
  const supabase = getSupabase();
  const [linhas, anos] = await Promise.all([
    supabase
      .from("revisao")
      .select("*")
      .in("id", ids)
      .order("quando", { ascending: true }),
    supabase.from("revisao_ano_afetado").select("*").in("revisao_id", ids),
  ]);
  if (linhas.error) throw linhas.error;
  if (anos.error) throw anos.error;

  const porRevisao = new Map<string, AnoAfetado[]>();
  for (const a of (anos.data ?? []) as RevisaoAnoAfetadoRow[]) {
    const lista = porRevisao.get(a.revisao_id) ?? [];
    lista.push(paraAnoAfetado(a));
    porRevisao.set(a.revisao_id, lista);
  }

  return ((linhas.data ?? []) as RevisaoRow[]).map((r) => ({
    id: r.id,
    atoId: r.ato_id,
    entidade: r.entidade,
    entidadeId: r.entidade_id,
    campo: r.campo,
    antes: r.antes,
    depois: r.depois,
    quando: r.quando,
    motivo: r.motivo,
    motivoTexto: r.motivo_texto,
    anosAfetados: porRevisao.get(r.id) ?? [],
  }));
}

function paraAnoAfetado(row: RevisaoAnoAfetadoRow): AnoAfetado {
  return {
    obraId: row.obra_id,
    ano: row.ano,
    antesCentavos: numericParaCentavos(row.custo_antes) ?? 0,
    depoisCentavos: numericParaCentavos(row.custo_depois) ?? 0,
    pendencia: row.pendencia_id !== null,
  };
}

/**
 * O rastro que o detalhe do documento exibe (critério 16).
 *
 * São DUAS buscas de propósito. A primeira acha os atos que tocam este
 * registro: as correções do próprio documento e as do FAVORECIDO dele — o nome
 * do emitente muda em outra tabela, e mesmo assim é correção deste registro
 * para quem lê. A segunda traz as linhas que faltam desses mesmos atos: o move
 * grava N linhas com o MESMO `ato_id` (documento + cada pagamento), e sem elas
 * a tela não teria como dizer "com 2 pagamentos".
 *
 * Rastro que só o banco vê não cumpre a meta 3 — quem vai ler isso em 2034 é o
 * Mateus, não o Postgres.
 */
export async function carregarCorrecoesDoDocumento(
  documentoId: string,
  favorecidoId: string | null,
): Promise<Revisao[]> {
  const supabase = getSupabase();

  /**
   * ⚠️ DUAS CONSULTAS SEPARADAS, e não um `.or()` com string montada à mão
   * (ressalva 7 do Gate 2). O filtro do PostgREST é uma linguagem própria: um
   * id com vírgula ou parêntese vira sintaxe, e o erro apareceria como
   * "nenhuma correção neste registro" — ou seja, rastro sumindo em silêncio,
   * que é o oposto exato do que esta tela existe para fazer. Duas chamadas
   * `.eq()` custam um round-trip e não têm como ser mal interpretadas.
   */
  const [doDocumento, doFavorecido] = await Promise.all([
    supabase
      .from("revisao")
      .select("ato_id")
      .eq("entidade", "documento")
      .eq("entidade_id", documentoId),
    favorecidoId
      ? supabase
          .from("revisao")
          .select("ato_id")
          .eq("entidade", "favorecido")
          .eq("entidade_id", favorecidoId)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (doDocumento.error) throw doDocumento.error;
  if (doFavorecido.error) throw doFavorecido.error;

  const atoIds = [
    ...new Set(
      [...(doDocumento.data ?? []), ...(doFavorecido.data ?? [])].map(
        (r) => (r as { ato_id: string }).ato_id,
      ),
    ),
  ];
  if (atoIds.length === 0) return [];

  const linhas = await supabase
    .from("revisao")
    .select("*")
    .in("ato_id", atoIds)
    .order("quando", { ascending: false })
    .order("created_at", { ascending: true });
  if (linhas.error) throw linhas.error;

  // O snapshot só das revisões deste registro — `select("*")` na tabela
  // inteira trazia o rastro da conta toda para montar um card (ressalva 7).
  const anos = await supabase
    .from("revisao_ano_afetado")
    .select("*")
    .in(
      "revisao_id",
      ((linhas.data ?? []) as RevisaoRow[]).map((r) => r.id),
    );
  if (anos.error) throw anos.error;

  const porRevisao = new Map<string, AnoAfetado[]>();
  for (const a of (anos.data ?? []) as RevisaoAnoAfetadoRow[]) {
    const lista = porRevisao.get(a.revisao_id) ?? [];
    lista.push(paraAnoAfetado(a));
    porRevisao.set(a.revisao_id, lista);
  }

  return ((linhas.data ?? []) as RevisaoRow[]).map((r) => ({
    id: r.id,
    atoId: r.ato_id,
    entidade: r.entidade,
    entidadeId: r.entidade_id,
    campo: r.campo,
    antes: r.antes,
    depois: r.depois,
    quando: r.quando,
    motivo: r.motivo,
    motivoTexto: r.motivo_texto,
    anosAfetados: porRevisao.get(r.id) ?? [],
  }));
}

/**
 * "Onde este nome aparece hoje" (tela s5): o alcance da correção de nome.
 *
 * ⚠️ Os documentos vêm SEM quebra por ano, e a divergência em relação ao mock é
 * deliberada: `documento` **não tem data de emissão no schema** — ela é o
 * CONTAI-004, que ainda não entrou (Out of Scope deste ticket). Usar
 * `created_at` como "ano do documento" seria afirmar um fato fiscal que o app
 * não tem. Os pagamentos SIM quebram por ano, porque `data_pagamento` é data
 * fiscal de verdade — é dela que sai o ano-calendário do custo — e é ela que
 * decide se o aviso do adendo §4 aparece.
 */
export async function carregarAlcanceDoFavorecido(favorecidoId: string): Promise<{
  documentos: number;
  pagamentosPorAno: { ano: number; quantidade: number }[];
}> {
  const supabase = getSupabase();
  const [documentos, pagamentos] = await Promise.all([
    supabase.from("documento").select("id").eq("favorecido_id", favorecidoId),
    supabase
      .from("pagamento")
      .select("data_pagamento")
      .eq("favorecido_id", favorecidoId),
  ]);
  if (documentos.error) throw documentos.error;
  if (pagamentos.error) throw pagamentos.error;

  const porAno = new Map<number, number>();
  for (const p of (pagamentos.data ?? []) as { data_pagamento: string }[]) {
    const ano = Number(p.data_pagamento.slice(0, 4));
    porAno.set(ano, (porAno.get(ano) ?? 0) + 1);
  }

  return {
    documentos: (documentos.data ?? []).length,
    pagamentosPorAno: [...porAno.entries()]
      .map(([ano, quantidade]) => ({ ano, quantidade }))
      .sort((a, b) => b.ano - a.ano),
  };
}

/**
 * Sobe o original para o acervo. O caminho começa com o user_id porque é isso
 * que a policy do bucket exige (0002_storage.sql).
 */
export async function subirParaAcervo(
  arquivo: File,
  /**
   * `terreno` e `informe` nascem no CONTAI-010: comprovante de desembolso do
   * terreno e o extrato anual do financiamento. O primeiro nível do caminho
   * continua sendo o `user_id` — é isso que a policy do bucket exige
   * (0002_storage.sql); o segundo é organização nossa.
   */
  pasta: "documento" | "comprovante" | "terreno" | "informe",
): Promise<string> {
  const usuarioId = await getUsuarioId();
  const seguro = arquivo.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const caminho = `${usuarioId}/${pasta}/${crypto.randomUUID()}-${seguro}`;

  const { error } = await getSupabase()
    .storage.from(BUCKET_ACERVO)
    .upload(caminho, arquivo, { contentType: arquivo.type || undefined });
  if (error) throw error;
  return caminho;
}

/**
 * O papel de outro usuário não abre — e quem recusou foi a policy, não o app.
 *
 * O erro existe para a tela poder dizer a frase certa (ACERVO_NEGADO) sem
 * botão de "Tentar de novo": tentar de novo nunca conserta "não é seu".
 */
export class AcervoNegadoError extends Error {
  constructor() {
    super(ACERVO_NEGADO);
    this.name = "AcervoNegadoError";
  }
}

/**
 * Abre o que já está no acervo — CONTAI-027, critérios 3 e 4.
 *
 * ⚠️ Link ASSINADO, nunca público. `getPublicUrl` não entra neste arquivo: o
 * bucket é privado desde a 0002 e o custo de errar isso é um endereço eterno
 * para uma nota com o CPF do Mateus dentro.
 *
 * ⚠️ E a autorização é a policy `acervo_dono_select`, só ela. Não há `if` de
 * dono antes desta chamada: o app PEDE, e o Storage recusa o que não é dele.
 * Verificação nossa aqui seria uma segunda regra de acesso, que pode discordar
 * da primeira — e é a do banco que vale.
 *
 * O link é gerado no CLIQUE, nunca ao montar a lista: uma tela com seis papéis
 * criaria seis URLs válidas que ninguém pediu, e a que ninguém abre é a que
 * vaza no histórico.
 */
export async function criarLinkDeLeitura(path: string): Promise<string> {
  const usuarioId = await getUsuarioId();
  const { data, error } = await getSupabase()
    .storage.from(BUCKET_ACERVO)
    /**
     * 120 segundos. O link é pedido no clique e consumido no ato — o que este
     * número controla é por quanto tempo a URL continua abrindo o papel DEPOIS
     * disso, já fora da tela: no histórico do navegador, num print, na aba que
     * ficou aberta. Dois minutos porque o começo do download precisa caber num
     * 4G ruim (uma vez começado, expirar não interrompe); mais que isso é vida
     * útil de graça para uma URL que carrega documento fiscal com CPF dentro.
     */
    .createSignedUrl(path, 120);
  if (error) {
    if (classificarFalhaDeAbertura(error, path, usuarioId) === "negado") {
      throw new AcervoNegadoError();
    }
    throw error;
  }
  return data.signedUrl;
}

/**
 * Os anexos ADICIONAIS do documento (`documento_anexo`, migration 0009).
 *
 * Leitura pura: nesta rodada ninguém escreve nesta tabela por aqui. Ela existe
 * desde o CONTAI-021 — a carta de correção que chegou depois — e sem esta
 * consulta o detalhe do documento mostraria só o `arquivo_path` e esconderia o
 * resto do acervo daquele registro. "A lista inteira" do mock é isto.
 */
export async function carregarAnexosDoDocumento(
  documentoId: string,
): Promise<string[]> {
  await getUsuarioId();
  const { data, error } = await getSupabase()
    .from("documento_anexo")
    .select("arquivo_path")
    .eq("documento_id", documentoId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as { arquivo_path: string }[]).map(
    (a) => a.arquivo_path,
  );
}

/**
 * Reaproveita o favorecido pelo CNPJ/CPF; cria se for a primeira vez.
 *
 * Upsert em vez de select-then-insert: com dois toques no "Salvar" (ou um
 * retry de rede) as duas chamadas liam "não existe" e criavam favorecidos
 * duplicados, quebrando a agregação CPF-por-CPF. O conflito é resolvido pela
 * unicidade (user_id, documento) da migration 0003.
 *
 * ⚠️ `ignoreDuplicates` — O NOME DE QUEM JÁ EXISTE NUNCA É SOBRESCRITO.
 *
 * Sem ele, o upsert virava `on conflict do update` e gravava por cima do nome:
 * um typo digitado hoje RENOMEAVA o favorecido em todos os registros
 * anteriores, em silêncio. Adendo de 2026-08-18 do parecer
 * `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md`, §3 e §4:
 *
 *   nenhum registro novo pode alterar retroativamente dado de registro
 *   anterior [...] nome de favorecido muda por ato deliberado, com rastro —
 *   nunca como efeito colateral de registrar um pagamento.
 *
 * O dano é fora do app: a DAA já entregue é documento fechado, e renomear
 * retroativamente faz o acervo contar uma história diferente da que foi
 * declarada — quem explica isso numa intimação, anos depois, é o Mateus.
 *
 * Consequência aceita e deliberada: nome gravado errado NÃO se corrige por
 * aqui. A correção é ato próprio, com rastro, e não existe hoje.
 *
 * `ignoreDuplicates` manda `Prefer: resolution=ignore-duplicates`, que o
 * PostgREST traduz em `on conflict do nothing` — e aí a linha que já existia
 * NÃO volta no retorno. Por isso o segundo passo: quem já estava lá é lido, e
 * é o id dele que vale.
 */
export async function garantirFavorecido(entrada: {
  nome: string;
  documento: string;
  tipo: TipoFavorecido;
}): Promise<string> {
  const linha: FavorecidoInsert = {
    nome: entrada.nome,
    documento: entrada.documento,
    tipo: entrada.tipo,
  };
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("favorecido")
    .upsert(linha, { onConflict: "user_id,documento", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;

  const criado = (data as { id: string }[] | null)?.[0];
  if (criado) return criado.id;

  // Já existia: o cadastro dele fica como está, e o nome digitado agora é
  // descartado de propósito (ver acima). A RLS já restringe ao dono, então o
  // documento sozinho identifica a linha — é a chave única da migration 0003.
  const existente = await supabase
    .from("favorecido")
    .select("id")
    .eq("documento", entrada.documento)
    .limit(1);
  if (existente.error) throw existente.error;
  const row = (existente.data as { id: string }[] | null)?.[0];
  if (!row) throw new Error("Não foi possível identificar o favorecido.");
  return row.id;
}

/**
 * O favorecido pela identidade. Existe porque a tela de confirmação precisa do
 * TIPO (PJ × PF) para dizer o peso da pendência "pago sem comprovante", e
 * derivá-lo de outros pagamentos do mesmo favorecido erra justamente no
 * PRIMEIRO pagamento a ele — que é quando não há de onde derivar. O §G.3
 * reserva o vermelho ao favorecido **não identificado**; aqui ele está
 * identificado, e o tipo está na tabela.
 */
export async function carregarFavorecido(
  id: string,
): Promise<{ id: string; nome: string; tipo: TipoFavorecido } | null> {
  const { data, error } = await getSupabase()
    .from("favorecido")
    .select("id, nome, tipo")
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  return (
    (data as { id: string; nome: string; tipo: TipoFavorecido }[] | null)?.[0] ??
    null
  );
}

export async function criarDocumento(
  insert: Omit<DocumentoInsert, "valor"> & { valorCentavos: number },
): Promise<string> {
  const { valorCentavos, ...resto } = insert;
  const linha: DocumentoInsert = {
    ...resto,
    valor: centavosParaNumeric(valorCentavos),
  };
  const { data, error } = await getSupabase()
    .from("documento")
    .insert(linha)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function criarPagamento(
  insert: Omit<PagamentoInsert, "valor"> & { valorCentavos: number },
): Promise<string> {
  const { valorCentavos, ...resto } = insert;
  const linha: PagamentoInsert = {
    ...resto,
    valor: centavosParaNumeric(valorCentavos),
  };
  const { data, error } = await getSupabase()
    .from("pagamento")
    .insert(linha)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Tentativa de ligar registros de obras diferentes (critério 11 do
 * CONTAI-018). É erro de regra, não de rede: a tela mostra o motivo, e o
 * `mensagemDeErro` abaixo já o repassa por ser um `Error` com mensagem.
 */
export class VinculoEntreObrasError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "VinculoEntreObrasError";
  }
}

/**
 * Um vínculo a criar. As obras viajam junto porque a guarda do critério 11 é
 * do CÓDIGO: `pagamento_documento` não tem `obra_id` nem check, e a policy
 * `dono_vinculo` só exige mesmo DONO — ela deixaria passar um vínculo entre
 * duas obras do próprio Mateus, que somaria custo entre matrículas.
 */
export interface VinculoNovo {
  pagamentoId: string;
  documentoId: string;
  obraDoPagamentoId: string;
  obraDoDocumentoId: string;
  /** Decide o `status` derivado do pagamento — nunca o cálculo do custo. */
  documentoHabil: boolean;
}

/**
 * Cria os vínculos em UMA chamada.
 *
 * A gravação com array é UMA statement no Postgres: ou entram todas as linhas,
 * ou nenhuma. É o que sustenta a promessa da tela de erro (mock s3e): "nada foi
 * ligado — a nota continua como estava". Não existe transação multi-statement
 * pelo PostgREST, então a atomicidade que se pode prometer é exatamente esta, e
 * é por isso que a gravação não é dividida em um loop.
 *
 * Ligar de novo o que já está ligado não é erro — é o mesmo fato afirmado
 * duas vezes. Mas engolir o 23505 do `insert` puro seria ENGOLIR A FALHA: sem
 * `on conflict`, a violação da PK composta ABORTA A STATEMENT INTEIRA. Marcando
 * [A, já ligado em outra aba] + [B, novo], o Postgres devolve 23505, e B NÃO
 * ENTRA — a tela navegaria como sucesso e o `status = 'conciliado'` seria
 * gravado sem vínculo nenhum por trás.
 *
 * Por isso o `upsert` com `ignoreDuplicates`: ele manda
 * `Prefer: resolution=ignore-duplicates`, que o PostgREST traduz em
 * `on conflict do nothing`. Isso NÃO exige o privilégio de UPDATE (não há
 * `do update set`) — a migration 0006 continua concedendo só `insert` e
 * `delete`, que são os verbos que o app executa. A linha já existente é
 * ignorada, a nova entra, e qualquer outro erro sobe: dele a tela sabe falar
 * ("nada foi ligado").
 */
export async function criarVinculos(vinculos: VinculoNovo[]): Promise<void> {
  if (vinculos.length === 0) return;

  for (const v of vinculos) {
    const permissao = podeVincular(
      { obraId: v.obraDoPagamentoId },
      { obraId: v.obraDoDocumentoId },
    );
    if (!permissao.ok) throw new VinculoEntreObrasError(permissao.motivo);
  }

  const { error } = await getSupabase()
    .from("pagamento_documento")
    .upsert(
      vinculos.map((v) => ({
        pagamento_id: v.pagamentoId,
        documento_id: v.documentoId,
      })),
      { onConflict: "pagamento_id,documento_id", ignoreDuplicates: true },
    );
  if (error) throw error;

  // `status = 'conciliado'` é gravado como CONSEQUÊNCIA do vínculo (critério
  // 7) e não é lido por cálculo fiscal nenhum — quem calcula custo é
  // `lib/fiscal/vinculo.ts`, a partir das linhas acima. Por isso a falha desta
  // gravação NÃO invalida o vínculo e não pode virar erro de tela: o vínculo,
  // que é o fato, já está no banco.
  const comHabil = [
    ...new Set(vinculos.filter((v) => v.documentoHabil).map((v) => v.pagamentoId)),
  ];
  if (comHabil.length > 0) {
    await getSupabase()
      .from("pagamento")
      .update({ status: "conciliado" })
      .in("id", comHabil);
  }
}

/**
 * Desfaz um vínculo (critério 15). Nada é apagado além dele: a nota e o
 * pagamento continuam registrados, com os arquivos no acervo.
 *
 * O DELETE existe no papel `authenticated` desde a migration 0006, e a
 * justificativa está lá: vínculo errado infla o custo de aquisição que vai
 * para a declaração, e correção que exige SQL é a dor D9 de volta.
 */
export async function apagarVinculo(
  pagamentoId: string,
  documentoId: string,
  /** Sobra algum documento hábil ligado a este pagamento depois de desligar? */
  seguemDocumentosHabeis: boolean,
): Promise<void> {
  const { error } = await getSupabase()
    .from("pagamento_documento")
    .delete()
    .eq("pagamento_id", pagamentoId)
    .eq("documento_id", documentoId);
  if (error) throw error;

  if (!seguemDocumentosHabeis) {
    // Mesma nota do `criarVinculos`: consequência, não pré-requisito.
    await getSupabase()
      .from("pagamento")
      .update({ status: "aguardando_nf" })
      .eq("id", pagamentoId);
  }
}

// ══ CONTAI-019 · compromisso, quitação e diferença ══════════════════════
//
// ⚠️ Nada daqui entra em `PainelDados`, e a omissão é deliberada. `app/page.tsx`
// faz `calcularResumo({ ...dados, ano })`: um campo `compromissos` no painel
// viajaria por esse spread até a porta do cálculo de custo. A agenda tem
// carregador PRÓPRIO — o compromisso e os números da declaração nunca chegam
// juntos na mesma variável (critério 3; parecer §2).

function paraCompromisso(
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

/**
 * A agenda de UMA obra. Sem sessão, `getUsuarioId` já falha explicitamente —
 * "nenhum agendamento" seria diagnóstico errado para quem só não está logado.
 */
export async function carregarCompromissos(
  obraId: string,
): Promise<Compromisso[]> {
  await getUsuarioId();
  const supabase = getSupabase();

  const [compromissos, vinculos, historico] = await Promise.all([
    supabase
      .from("compromisso")
      .select("*, favorecido(nome)")
      .eq("obra_id", obraId)
      .order("data_prevista", { ascending: true, nullsFirst: false }),
    supabase.from("compromisso_pagamento").select("*"),
    supabase.from("compromisso_data_historico").select("*"),
  ]);
  if (compromissos.error) throw compromissos.error;
  if (vinculos.error) throw vinculos.error;
  if (historico.error) throw historico.error;

  const pagamentosPorCompromisso = new Map<string, string[]>();
  for (const v of (vinculos.data ?? []) as CompromissoPagamentoRow[]) {
    const lista = pagamentosPorCompromisso.get(v.compromisso_id) ?? [];
    lista.push(v.pagamento_id);
    pagamentosPorCompromisso.set(v.compromisso_id, lista);
  }

  // "adiado N×" (critério 34): a contagem é de LINHAS de histórico, porque
  // append-only garante que cada mudança deixou exatamente uma.
  const adiamentos = new Map<string, number>();
  for (const h of (historico.data ?? []) as CompromissoDataHistoricoRow[]) {
    adiamentos.set(h.compromisso_id, (adiamentos.get(h.compromisso_id) ?? 0) + 1);
  }

  return ((compromissos.data ?? []) as (CompromissoRow & ComFavorecidoSimples)[]).map(
    (row) =>
      paraCompromisso(
        row,
        pagamentosPorCompromisso.get(row.id) ?? [],
        adiamentos.get(row.id) ?? 0,
      ),
  );
}

export async function carregarCompromisso(id: string): Promise<Compromisso> {
  await getUsuarioId();
  const supabase = getSupabase();
  const [compromisso, vinculos, historico] = await Promise.all([
    supabase.from("compromisso").select("*, favorecido(nome)").eq("id", id).limit(1),
    supabase.from("compromisso_pagamento").select("*").eq("compromisso_id", id),
    supabase.from("compromisso_data_historico").select("*").eq("compromisso_id", id),
  ]);
  if (compromisso.error) throw compromisso.error;
  if (vinculos.error) throw vinculos.error;
  if (historico.error) throw historico.error;

  const row = (compromisso.data as (CompromissoRow & ComFavorecidoSimples)[] | null)?.[0];
  if (!row) throw new Error("Agendamento não encontrado.");
  return paraCompromisso(
    row,
    ((vinculos.data ?? []) as CompromissoPagamentoRow[]).map((v) => v.pagamento_id),
    ((historico.data ?? []) as CompromissoDataHistoricoRow[]).length,
  );
}

/** O histórico completo da data prevista, do mais antigo ao mais novo. */
export async function carregarHistoricoDeData(
  compromissoId: string,
): Promise<CompromissoDataHistoricoRow[]> {
  const { data, error } = await getSupabase()
    .from("compromisso_data_historico")
    .select("*")
    .eq("compromisso_id", compromissoId)
    .order("registrado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CompromissoDataHistoricoRow[];
}

export interface EntradaCompromisso {
  obraId: string;
  favorecidoId: string | null;
  /** O campo se chama **valor previsto**, nunca "valor" (Gate Fiscal 6.3). */
  valorPrevistoCentavos: number;
  /** `null` só é alcançável pelo saldo de quitação parcial, nunca na criação. */
  dataPrevista: string | null;
  origem: OrigemCompromisso;
  documentoOrigemId: string | null;
  dataCompra: string | null;
}

export async function criarCompromisso(
  entrada: EntradaCompromisso,
): Promise<string> {
  const linha: CompromissoInsert = {
    obra_id: entrada.obraId,
    favorecido_id: entrada.favorecidoId,
    valor_previsto: centavosParaNumeric(entrada.valorPrevistoCentavos),
    data_prevista: entrada.dataPrevista,
    origem: entrada.origem,
    documento_origem_id: entrada.documentoOrigemId,
    data_compra: entrada.dataCompra,
  };
  const { data, error } = await getSupabase()
    .from("compromisso")
    .insert(linha)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * "Não saiu" — critério 22. **Não apaga**: fica registrado como cancelado, com
 * o motivo (parecer §3). O check `compromisso_cancelado_exige_motivo` recusa a
 * gravação sem motivo, então a exigência não depende só da tela.
 */
export async function cancelarCompromisso(
  id: string,
  motivo: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from("compromisso")
    .update({ situacao: "cancelado", motivo_cancelamento: motivo })
    .eq("id", id);
  if (error) throw error;
}

/**
 * "Mudou a data" — critério 33. **O MESMO compromisso**: mesmo id, mesmos
 * vínculos, mesmo saldo. Não cancela e não cria compromisso novo.
 *
 * A linha de histórico entra ANTES do update, e é de propósito: se o update
 * falhar, sobra um registro de tentativa (ruído legível); se o histórico
 * falhasse depois de um update bem-sucedido, a data anterior teria sido
 * DESTRUÍDA sem rastro, que é o que o append-only proíbe. Não há transação
 * multi-statement pelo PostgREST — então a ordem é a garantia possível, e ela
 * erra para o lado de preservar o fato.
 *
 * Data nova no passado é aceita (é correção legítima) e o item fica vencido na
 * hora — critério 34.
 */
export async function mudarDataPrevista(
  id: string,
  dataAnterior: string | null,
  dataNova: string | null,
): Promise<void> {
  const supabase = getSupabase();
  const historico = await supabase
    .from("compromisso_data_historico")
    .insert({ compromisso_id: id, data_anterior: dataAnterior, data_nova: dataNova });
  if (historico.error) throw historico.error;

  const { error } = await supabase
    .from("compromisso")
    .update({ data_prevista: dataNova })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Liga um pagamento já gravado a um compromisso e, quando é o caso, fecha o
 * compromisso.
 *
 * ⚠️ **`quitaIntegralmente` é decisão HUMANA, nunca cálculo** (critério 13 e
 * adendo §D): valor menor exige escolha explícita entre "quita o compromisso"
 * e "falta pagar o resto", sem default e sem pré-seleção. O app não infere a
 * partir do valor porque **nenhum dos dois erros é mais barato**: assumir
 * desconto fecha um compromisso ainda devido e mata o alerta; assumir parcial
 * deixa um saldo fantasma que trava o relatório anual.
 *
 * ⚠️ **Este é o único caminho que cria vínculo de quitação, e ele só é chamado
 * a partir de um toque** (critério 41).
 */
export async function quitarCompromisso(entrada: {
  compromisso: Pick<Compromisso, "id" | "obraId" | "dataPrevista">;
  pagamento: Pick<Pagamento, "id" | "obraId">;
  quitaIntegralmente: boolean;
  /** Quando fica saldo: a nova data prevista, ou `null` = "sem data definida". */
  novaDataPrevista?: string | null;
}): Promise<void> {
  const permissao = podeQuitar(entrada.compromisso, entrada.pagamento);
  if (!permissao.ok) throw new VinculoEntreObrasError(permissao.motivo);

  const supabase = getSupabase();
  const vinculo = await supabase.from("compromisso_pagamento").upsert(
    { compromisso_id: entrada.compromisso.id, pagamento_id: entrada.pagamento.id },
    { onConflict: "compromisso_id,pagamento_id", ignoreDuplicates: true },
  );
  if (vinculo.error) throw vinculo.error;

  if (entrada.quitaIntegralmente) {
    const { error } = await supabase
      .from("compromisso")
      .update({ situacao: "quitado" })
      .eq("id", entrada.compromisso.id);
    if (error) throw error;
    return;
  }

  // Quitação parcial: o compromisso SEGUE ABERTO com saldo, e o saldo **não é
  // custo de nada** (critério 29). A nova data prevista é pedida na tela —
  // sem ela o saldo nasceria vencido-sem-resposta e travaria o relatório anual
  // para sempre (adendo §D). `null` é "sem data definida", que é resposta.
  if (entrada.novaDataPrevista !== undefined) {
    // A data ANTERIOR é a que o compromisso tinha — passar `null` aqui
    // apagaria do rastro justamente o dado que o critério 34 exibe
    // ("para 25/08 (era 10/08)").
    await mudarDataPrevista(
      entrada.compromisso.id,
      entrada.compromisso.dataPrevista,
      entrada.novaDataPrevista,
    );
  }
}

/**
 * A composição do desembolso, gravada UMA vez, no ato da confirmação.
 *
 * ⚠️ Só `resolucao`/`resolvido_em` mudam depois (critério 32): **o valor da
 * diferença nunca muda**. É por isso que esta função e `resolverDiferenca`
 * são separadas, e é por isso que a segunda não aceita valor nenhum — o
 * privilégio de UPDATE existe na tabela, e a guarda de o que ele toca é aqui.
 */
export async function registrarDiferenca(entrada: {
  pagamentoId: string;
  encargosCentavos: number;
  naoExplicadoCentavos: number;
}): Promise<void> {
  const { error } = await getSupabase().from("pagamento_diferenca").insert({
    pagamento_id: entrada.pagamentoId,
    encargos: centavosParaNumeric(entrada.encargosCentavos),
    nao_explicado: centavosParaNumeric(entrada.naoExplicadoCentavos),
    // `resolucao` nasce NULL — o "não sei ainda" do §F.2, o único estado
    // inicial permitido, porque é o único que não afirma nada.
  });
  if (error) throw error;
}

/**
 * A resolução da diferença (§F.2), que é ato do Mateus e não do app.
 *
 * **Resolver não apaga o registro da diferença** (critério 32, acervo
 * append-only do CONTAI-009): os valores continuam lá, e o que entra é a
 * classificação com a data em que ela foi feita.
 */
export async function resolverDiferenca(
  pagamentoId: string,
  resolucao: ResolucaoDiferenca,
): Promise<void> {
  const { error } = await getSupabase()
    .from("pagamento_diferenca")
    .update({ resolucao, resolvido_em: new Date().toISOString() })
    .eq("pagamento_id", pagamentoId);
  if (error) throw error;
}

/**
 * O "não" da sugestão de quitação, registrado POR PAR (critério 39).
 *
 * O app não repergunta daquele par — repetir ensina a dispensar sem ler — e
 * segue livre para sugerir outros pares. ⚠️ Isto **não** é resposta ao vencido
 * e **não** desbloqueia o relatório anual (adendo §A, corolário 4): recusar um
 * par não diz nada sobre o compromisso.
 */
export async function recusarQuitacao(
  pagamentoId: string,
  compromissoId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from("quitacao_recusada")
    .upsert(
      { pagamento_id: pagamentoId, compromisso_id: compromissoId },
      { onConflict: "pagamento_id,compromisso_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function carregarRecusasQuitacao(): Promise<
  { pagamentoId: string; compromissoId: string }[]
> {
  const { data, error } = await getSupabase().from("quitacao_recusada").select("*");
  if (error) throw error;
  return ((data ?? []) as QuitacaoRecusadaRow[]).map((r) => ({
    pagamentoId: r.pagamento_id,
    compromissoId: r.compromisso_id,
  }));
}

// ══ CONTAI-010 · terreno, contrato e informe anual ══════════════════════
//
// ⚠️ Nada daqui vira `pagamento`, e a separação é FISCAL, não arquitetural
// (parecer §5): o favorecido é o banco ou o cartório, o documento hábil é
// contrato/guia/extrato e não NF, e a aferição do INSS não vê nada disto.
// Fundir os dois faria o financiamento cair como "pago sem nota" todo ano e
// inflar o headline de custo em risco do CONTAI-005 (critério 21).

/** O contrato de UMA obra — `unique (obra_id)`, então é 0 ou 1. */
export async function carregarFinanciamento(
  obraId: string,
): Promise<Financiamento | null> {
  await getUsuarioId();
  const { data, error } = await getSupabase()
    .from("financiamento")
    .select("*")
    .eq("obra_id", obraId)
    .limit(1);
  if (error) throw error;
  const row = (data as FinanciamentoRow[] | null)?.[0];
  return row ? paraFinanciamento(row) : null;
}

export async function carregarDesembolsosTerreno(
  obraId: string,
): Promise<TerrenoDesembolso[]> {
  await getUsuarioId();
  const { data, error } = await getSupabase()
    .from("terreno_desembolso")
    .select("*")
    .eq("obra_id", obraId)
    .order("data_pagamento", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return ((data ?? []) as TerrenoDesembolsoRow[]).map(paraDesembolsoTerreno);
}

export async function carregarInformes(
  financiamentoId: string,
): Promise<FinanciamentoInforme[]> {
  await getUsuarioId();
  const { data, error } = await getSupabase()
    .from("financiamento_informe")
    .select("*")
    .eq("financiamento_id", financiamentoId)
    .order("ano_base", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as FinanciamentoInformeRow[]).map(paraInforme);
}

export interface EntradaDesembolsoTerreno {
  obraId: string;
  tipo: TipoDesembolsoTerreno;
  valorCentavos: number;
  /**
   * `null` só quando `estado = 'previsto'`. Nada aqui preenche data sozinho
   * (critério 22): o app não inventa data, nem a de hoje, nem a do cadastro.
   */
  dataPagamento: string | null;
  estado: "pago" | "previsto";
  origemRecurso: OrigemRecursoEntrada | null;
  /** Obrigatório para linha nova `pago` — a tela é quem garante. */
  arquivoPath: string | null;
}

export async function criarDesembolsoTerreno(
  entrada: EntradaDesembolsoTerreno,
): Promise<string> {
  const { data, error } = await getSupabase()
    .from("terreno_desembolso")
    .insert({
      obra_id: entrada.obraId,
      tipo: entrada.tipo,
      valor: centavosParaNumeric(entrada.valorCentavos),
      data_pagamento: entrada.dataPagamento,
      estado: entrada.estado,
      origem_recurso: entrada.origemRecurso,
      arquivo_path: entrada.arquivoPath,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Completa a data (e o comprovante) de um desembolso gravado sem eles — a
 * migration 0008 — critério 23. É o ÚNICO uso do UPDATE nesta tabela, e é a
 * razão de o grant existir: sem ele, a pendência de complemento não teria como
 * ser resolvida pela tela, e correção que exige SQL é a dor D9 de volta.
 *
 * O VALOR não é tocado por este caminho: o que faltava era a data, não o
 * dinheiro.
 */
export async function completarDesembolsoTerreno(
  id: string,
  dataPagamento: string,
  arquivoPath: string | null,
): Promise<void> {
  const { error } = await getSupabase()
    .from("terreno_desembolso")
    .update(
      arquivoPath
        ? { data_pagamento: dataPagamento, arquivo_path: arquivoPath }
        : { data_pagamento: dataPagamento },
    )
    .eq("id", id);
  if (error) throw error;
}

export interface EntradaFinanciamento {
  obraId: string;
  instituicao: string;
  numeroContrato: string | null;
  dataContrato: string;
  precoContratadoCentavos: number;
  numeroParcelas: number | null;
}

export async function criarFinanciamento(
  entrada: EntradaFinanciamento,
): Promise<string> {
  const { data, error } = await getSupabase()
    .from("financiamento")
    .insert({
      obra_id: entrada.obraId,
      instituicao: entrada.instituicao,
      numero_contrato: entrada.numeroContrato,
      data_contrato: entrada.dataContrato,
      // ⚠️ Gravado para o texto da discriminação e para fechar a conta de quem
      // lê. NENHUMA função de apuração o soma (critério 8).
      preco_contratado: centavosParaNumeric(entrada.precoContratadoCentavos),
      numero_parcelas: entrada.numeroParcelas,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export interface EntradaInforme {
  financiamentoId: string;
  anoBase: number;
  amortizacaoCentavos: number;
  jurosCorrecaoCentavos: number;
  segurosCentavos: number;
  taxasFcvsCentavos: number;
  moraCentavos: number;
  multaCentavos: number;
  diferencaTeoricoPagoCentavos: number;
  totalPagoCentavos: number;
  saldoDevedorCentavos: number;
  /** Obrigatório — sem o extrato, não grava (critério 10). */
  arquivoPath: string;
}

/**
 * Grava o informe anual.
 *
 * A trava da soma é conferida ANTES, na tela (`travaDaSoma`), com a diferença
 * exata na mensagem; o CHECK do banco é o backstop. As duas existem: a de cima
 * explica, a de baixo garante.
 *
 * O segundo informe do mesmo ano-base bate no `unique (financiamento_id,
 * ano_base)` e volta como 23505 — a tela traduz com o motivo por extenso
 * (`UM_INFORME_POR_ANO`).
 */
export async function criarInforme(entrada: EntradaInforme): Promise<string> {
  const { data, error } = await getSupabase()
    .from("financiamento_informe")
    .insert({
      financiamento_id: entrada.financiamentoId,
      ano_base: entrada.anoBase,
      amortizacao: centavosParaNumeric(entrada.amortizacaoCentavos),
      juros_correcao: centavosParaNumeric(entrada.jurosCorrecaoCentavos),
      seguros: centavosParaNumeric(entrada.segurosCentavos),
      taxas_fcvs: centavosParaNumeric(entrada.taxasFcvsCentavos),
      mora: centavosParaNumeric(entrada.moraCentavos),
      multa: centavosParaNumeric(entrada.multaCentavos),
      diferenca_teorico_pago: centavosParaNumeric(
        entrada.diferencaTeoricoPagoCentavos,
      ),
      total_pago: centavosParaNumeric(entrada.totalPagoCentavos),
      saldo_devedor: centavosParaNumeric(entrada.saldoDevedorCentavos),
      arquivo_path: entrada.arquivoPath,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Mensagem de erro para a UI, sem vazar detalhe técnico irrelevante.
 *
 * O PostgREST NÃO devolve `error` como `Error`: sem `throwOnError`, o que vem
 * é um objeto simples (`{ message, details, hint, code }`), e é ele que os
 * `throw error` daqui propagam. Só o ramo `instanceof Error` fazia toda
 * violação de RLS, de check constraint (`documento_quarentena_coerente`) e de
 * unicidade (`favorecido_dono_documento_unico`) chegar ao Mateus como "não foi
 * possível falar com o servidor" — ou seja, como problema de rede. Ele tentaria
 * de novo para sempre, e o registro nunca entraria.
 */
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof Error && erro.message) return erro.message;
  if (typeof erro === "object" && erro !== null && "message" in erro) {
    const { message } = erro as { message?: unknown };
    if (typeof message === "string" && message.trim() !== "") return message;
  }
  return "Não foi possível falar com o servidor. Tente de novo.";
}

/**
 * Critério 5 do CONTAI-002: "sem sessão" e "banco fora" NÃO são o mesmo erro.
 *
 * Os dois davam a mesma tela com o mesmo botão "Tentar de novo" — e tentar de
 * novo nunca resolveu falta de sessão: o Mateus ficaria batendo no botão até
 * desistir de registrar. Cada causa leva à ação que resolve ela (entrar de
 * novo × repetir a chamada), e quem decide isso é o TIPO do erro, nunca o
 * texto da mensagem.
 */
export type ErroDeTela =
  | { tipo: "sem_sessao" }
  | { tipo: "falha"; mensagem: string };

export function classificarErro(erro: unknown): ErroDeTela {
  if (erro instanceof SemSessaoError) return { tipo: "sem_sessao" };
  return { tipo: "falha", mensagem: mensagemDeErro(erro) };
}
