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
  FavorecidoInsert,
  Obra,
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
  row: PagamentoRow & ComFavorecidoTipado,
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
    favorecidoTipo: row.favorecido?.tipo ?? null,
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
      .select("*, favorecido(nome, tipo)")
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
    pagamentos: (
      (pagamentos.data ?? []) as (PagamentoRow & ComFavorecidoTipado)[]
    ).map((row) => paraPagamento(row, docsPorPagamento.get(row.id) ?? [])),
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
