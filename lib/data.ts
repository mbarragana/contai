"use client";

/**
 * Acesso ao Supabase. Traduz as rows do PostgREST (numeric como string) para
 * os tipos de domínio em centavos; as regras fiscais ficam em lib/fiscal/*,
 * fora daqui.
 */

import { numericParaCentavos, centavosParaNumeric } from "@/lib/money";
import {
  BUCKET_ACERVO,
  getSupabase,
  getUsuarioId,
  SemSessaoError,
} from "@/lib/supabase";
import type {
  Documento,
  DocumentoInsert,
  DocumentoRow,
  FavorecidoInsert,
  Obra,
  ObraInsert,
  ObraRow,
  Pagamento,
  PagamentoDocumentoRow,
  PagamentoInsert,
  PagamentoRow,
  TipoFavorecido,
} from "@/lib/types";

type ComFavorecido = { favorecido: { nome: string } | null };
/** Pagamento também precisa do tipo: PF espera recibo, PJ espera NF. */
type ComFavorecidoTipado = {
  favorecido: { nome: string; tipo: TipoFavorecido } | null;
};

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
    valorTerrenoCentavos: numericParaCentavos(row.valor_terreno) ?? 0,
    valorItbiCentavos: numericParaCentavos(row.valor_itbi) ?? 0,
    valorEscrituraRegistroCentavos:
      numericParaCentavos(row.valor_escritura_registro) ?? 0,
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
    favorecidoNome: row.favorecido?.nome ?? null,
    arquivoPath: row.arquivo_path,
  };
}

function paraPagamento(
  row: PagamentoRow & ComFavorecidoTipado,
  documentoIds: string[],
): Pagamento {
  return {
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
 * Sem sessão a RLS devolve zero linhas, e "nenhuma obra cadastrada" seria
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
  valorTerrenoCentavos: number;
  valorItbiCentavos: number;
  valorEscrituraRegistroCentavos: number;
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
    valor_terreno: centavosParaNumeric(entrada.valorTerrenoCentavos),
    valor_itbi: centavosParaNumeric(entrada.valorItbiCentavos),
    valor_escritura_registro: centavosParaNumeric(
      entrada.valorEscrituraRegistroCentavos,
    ),
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

  const [documentos, pagamentos, vinculos] = await Promise.all([
    supabase
      .from("documento")
      .select("*, favorecido(nome)")
      .eq("obra_id", obra.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("pagamento")
      .select("*, favorecido(nome, tipo)")
      .eq("obra_id", obra.id)
      .order("data_pagamento", { ascending: false }),
    supabase.from("pagamento_documento").select("*"),
  ]);

  if (documentos.error) throw documentos.error;
  if (pagamentos.error) throw pagamentos.error;
  if (vinculos.error) throw vinculos.error;

  const docsPorPagamento = agruparVinculos(
    (vinculos.data ?? []) as PagamentoDocumentoRow[],
  );

  return {
    obra,
    documentos: ((documentos.data ?? []) as (DocumentoRow & ComFavorecido)[]).map(
      paraDocumento,
    ),
    pagamentos: (
      (pagamentos.data ?? []) as (PagamentoRow & ComFavorecidoTipado)[]
    ).map((row) => paraPagamento(row, docsPorPagamento.get(row.id) ?? [])),
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

  const [documentos, pagamentos, vinculos] = await Promise.all([
    supabase
      .from("documento")
      .select("*, favorecido(nome)")
      .order("created_at", { ascending: false }),
    supabase
      .from("pagamento")
      .select("*, favorecido(nome, tipo)")
      .order("data_pagamento", { ascending: false }),
    supabase.from("pagamento_documento").select("*"),
  ]);

  if (documentos.error) throw documentos.error;
  if (pagamentos.error) throw pagamentos.error;
  if (vinculos.error) throw vinculos.error;

  const docsPorPagamento = agruparVinculos(
    (vinculos.data ?? []) as PagamentoDocumentoRow[],
  );

  return obras.map((obra) => ({
    obra,
    documentos: ((documentos.data ?? []) as (DocumentoRow & ComFavorecido)[])
      .filter((row) => row.obra_id === obra.id)
      .map(paraDocumento),
    pagamentos: ((pagamentos.data ?? []) as (PagamentoRow & ComFavorecidoTipado)[])
      .filter((row) => row.obra_id === obra.id)
      .map((row) => paraPagamento(row, docsPorPagamento.get(row.id) ?? [])),
  }));
}

export async function carregarDocumento(id: string): Promise<Documento> {
  const { data, error } = await getSupabase()
    .from("documento")
    .select("*, favorecido(nome)")
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  const row = (data as (DocumentoRow & ComFavorecido)[] | null)?.[0];
  if (!row) throw new Error("Documento não encontrado.");
  return paraDocumento(row);
}

export async function carregarPagamento(id: string): Promise<Pagamento> {
  const supabase = getSupabase();
  const [pagamento, vinculos] = await Promise.all([
    supabase
      .from("pagamento")
      .select("*, favorecido(nome, tipo)")
      .eq("id", id)
      .limit(1),
    supabase.from("pagamento_documento").select("*").eq("pagamento_id", id),
  ]);
  if (pagamento.error) throw pagamento.error;
  if (vinculos.error) throw vinculos.error;

  const row = (pagamento.data as (PagamentoRow & ComFavorecidoTipado)[] | null)?.[0];
  if (!row) throw new Error("Pagamento não encontrado.");
  return paraPagamento(
    row,
    ((vinculos.data ?? []) as PagamentoDocumentoRow[]).map((v) => v.documento_id),
  );
}

/**
 * Correção da obra de um registro já salvo (critério 13). A regra fiscal que
 * decide SE pode mover está em lib/fiscal/obra.ts (`podeCorrigirObra`) — aqui
 * só grava. O erro deste campo é silencioso e descoberto tarde; um produto que
 * só previne e não conserta perde o caso real.
 */
export async function moverDocumentoDeObra(
  id: string,
  obraDestinoId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from("documento")
    .update({ obra_id: obraDestinoId })
    .eq("id", id);
  if (error) throw error;
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

/**
 * Sobe o original para o acervo. O caminho começa com o user_id porque é isso
 * que a policy do bucket exige (0002_storage.sql).
 */
export async function subirParaAcervo(
  arquivo: File,
  pasta: "documento" | "comprovante",
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
 * Reaproveita o favorecido pelo CNPJ/CPF; cria se for a primeira vez.
 *
 * Upsert em vez de select-then-insert: com dois toques no "Salvar" (ou um
 * retry de rede) as duas chamadas liam "não existe" e criavam favorecidos
 * duplicados, quebrando a agregação CPF-por-CPF. O conflito é resolvido pela
 * unicidade (user_id, documento) da migration 0003.
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
  const { data, error } = await getSupabase()
    .from("favorecido")
    .upsert(linha, { onConflict: "user_id,documento" })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
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
