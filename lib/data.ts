"use client";

/**
 * Acesso ao Supabase. Traduz as rows do PostgREST (numeric como string) para
 * os tipos de domínio em centavos; as regras fiscais ficam em lib/fiscal/*,
 * fora daqui.
 */

import { numericParaCentavos, centavosParaNumeric } from "@/lib/money";
import { BUCKET_ACERVO, getSupabase, getUsuarioId } from "@/lib/supabase";
import type {
  Documento,
  DocumentoInsert,
  DocumentoRow,
  FavorecidoRow,
  Obra,
  ObraRow,
  Pagamento,
  PagamentoDocumentoRow,
  PagamentoInsert,
  PagamentoRow,
  TipoFavorecido,
} from "@/lib/types";

type ComFavorecido = { favorecido: { nome: string } | null };

export class ObraAusenteError extends Error {
  constructor() {
    super("Nenhuma obra cadastrada nesta conta.");
    this.name = "ObraAusenteError";
  }
}

function paraObra(row: ObraRow): Obra {
  return {
    id: row.id,
    nome: row.nome,
    cno: row.cno,
    municipio: row.municipio,
    valorTerrenoCentavos: numericParaCentavos(row.valor_terreno) ?? 0,
  };
}

function paraDocumento(row: DocumentoRow & ComFavorecido): Documento {
  return {
    id: row.id,
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
  row: PagamentoRow & ComFavorecido,
  documentoIds: string[],
): Pagamento {
  return {
    id: row.id,
    valorCentavos: numericParaCentavos(row.valor) ?? 0,
    dataPagamento: row.data_pagamento,
    meio: row.meio,
    status: row.status,
    favorecidoId: row.favorecido_id,
    favorecidoNome: row.favorecido?.nome ?? null,
    comprovantePath: row.comprovante_path,
    documentoIds,
  };
}

export async function carregarObra(): Promise<Obra> {
  const { data, error } = await getSupabase()
    .from("obra")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  const row = (data as ObraRow[] | null)?.[0];
  if (!row) throw new ObraAusenteError();
  return paraObra(row);
}

export interface PainelDados {
  obra: Obra;
  documentos: Documento[];
  pagamentos: Pagamento[];
}

/** Tudo que a home precisa. Sem sessão, `getUsuarioId` já falha explicitamente. */
export async function carregarPainel(): Promise<PainelDados> {
  await getUsuarioId();
  const supabase = getSupabase();
  const obra = await carregarObra();

  const [documentos, pagamentos, vinculos] = await Promise.all([
    supabase
      .from("documento")
      .select("*, favorecido(nome)")
      .eq("obra_id", obra.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("pagamento")
      .select("*, favorecido(nome)")
      .eq("obra_id", obra.id)
      .order("data_pagamento", { ascending: false }),
    supabase.from("pagamento_documento").select("*"),
  ]);

  if (documentos.error) throw documentos.error;
  if (pagamentos.error) throw pagamentos.error;
  if (vinculos.error) throw vinculos.error;

  const docsPorPagamento = new Map<string, string[]>();
  for (const v of (vinculos.data ?? []) as PagamentoDocumentoRow[]) {
    const lista = docsPorPagamento.get(v.pagamento_id) ?? [];
    lista.push(v.documento_id);
    docsPorPagamento.set(v.pagamento_id, lista);
  }

  return {
    obra,
    documentos: ((documentos.data ?? []) as (DocumentoRow & ComFavorecido)[]).map(
      paraDocumento,
    ),
    pagamentos: ((pagamentos.data ?? []) as (PagamentoRow & ComFavorecido)[]).map(
      (row) => paraPagamento(row, docsPorPagamento.get(row.id) ?? []),
    ),
  };
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

/** Reaproveita o favorecido pelo CNPJ/CPF; cria se for a primeira vez. */
export async function garantirFavorecido(entrada: {
  nome: string;
  documento: string;
  tipo: TipoFavorecido;
}): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("favorecido")
    .select("*")
    .eq("documento", entrada.documento)
    .limit(1);
  if (error) throw error;

  const existente = (data as FavorecidoRow[] | null)?.[0];
  if (existente) return existente.id;

  const { data: criado, error: erroInsert } = await supabase
    .from("favorecido")
    .insert({
      nome: entrada.nome,
      documento: entrada.documento,
      tipo: entrada.tipo,
    })
    .select("id")
    .single();
  if (erroInsert) throw erroInsert;
  return (criado as { id: string }).id;
}

export async function criarDocumento(
  insert: Omit<DocumentoInsert, "valor"> & { valorCentavos: number },
): Promise<string> {
  const { valorCentavos, ...resto } = insert;
  const { data, error } = await getSupabase()
    .from("documento")
    .insert({ ...resto, valor: centavosParaNumeric(valorCentavos) })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function criarPagamento(
  insert: Omit<PagamentoInsert, "valor"> & { valorCentavos: number },
): Promise<string> {
  const { valorCentavos, ...resto } = insert;
  const { data, error } = await getSupabase()
    .from("pagamento")
    .insert({ ...resto, valor: centavosParaNumeric(valorCentavos) })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Mensagem de erro para a UI, sem vazar detalhe técnico irrelevante. */
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof Error && erro.message) return erro.message;
  return "Não foi possível falar com o servidor. Tente de novo.";
}
