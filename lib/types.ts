/**
 * Tipos do schema (supabase/migrations/0001_init.sql), escritos à mão: a
 * migration ainda não está aplicada no banco remoto, então não há como gerar
 * tipos pelo CLI. Ao aplicar a migration, trocar por `supabase gen types`.
 *
 * Convenção: `*Row` = o que o PostgREST devolve (numeric vem como string);
 * os tipos de domínio (sem sufixo) já vêm com dinheiro em CENTAVOS (inteiro),
 * para somar valor fiscal sem erro de ponto flutuante.
 */

// ── Enums ────────────────────────────────────────────────────────────────
export type TipoFavorecido = "pj" | "pf";
export type TipoDocumento = "nf_material" | "nf_servico" | "boleto";
export type Classificacao = "material" | "mao_obra";
export type StatusDocumento =
  | "registrado"
  | "quarentena"
  | "aguardando_pagamento";
export type MeioPagamento = "pix" | "boleto" | "cartao";
export type StatusPagamento = "aguardando_nf" | "conciliado";

// ── Rows (PostgREST) ─────────────────────────────────────────────────────
export interface ObraRow {
  id: string;
  nome: string;
  cno: string | null;
  matricula: string | null;
  cartorio: string | null;
  municipio: string | null;
  valor_terreno: string;
  created_at: string;
}

export interface FavorecidoRow {
  id: string;
  tipo: TipoFavorecido;
  nome: string;
  documento: string;
  retencao_11: boolean | null;
  created_at: string;
}

export interface DocumentoRow {
  id: string;
  obra_id: string;
  favorecido_id: string | null;
  tipo: TipoDocumento;
  arquivo_path: string;
  valor: string | null;
  vencimento: string | null;
  classificacao: Classificacao | null;
  destinatario_cpf_ok: boolean;
  retencao_11: boolean | null;
  status: StatusDocumento;
  motivo_quarentena: string | null;
  created_at: string;
}

export interface PagamentoRow {
  id: string;
  obra_id: string;
  favorecido_id: string | null;
  valor: string;
  data_pagamento: string;
  meio: MeioPagamento;
  data_compra: string | null;
  comprovante_path: string | null;
  status: StatusPagamento;
  created_at: string;
}

export interface PagamentoDocumentoRow {
  pagamento_id: string;
  documento_id: string;
}

// ── Inserts ──────────────────────────────────────────────────────────────
export interface FavorecidoInsert {
  tipo: TipoFavorecido;
  nome: string;
  documento: string;
  retencao_11?: boolean | null;
}

export interface DocumentoInsert {
  obra_id: string;
  favorecido_id: string | null;
  tipo: TipoDocumento;
  arquivo_path: string;
  valor: string | null;
  vencimento: string | null;
  classificacao: Classificacao | null;
  destinatario_cpf_ok: boolean;
  retencao_11: boolean | null;
  status: StatusDocumento;
  motivo_quarentena: string | null;
}

export interface PagamentoInsert {
  obra_id: string;
  favorecido_id: string | null;
  valor: string;
  data_pagamento: string;
  meio: MeioPagamento;
  data_compra: string | null;
  comprovante_path: string | null;
  status: StatusPagamento;
}

// ── Domínio (centavos) ───────────────────────────────────────────────────
export interface Obra {
  id: string;
  nome: string;
  cno: string | null;
  municipio: string | null;
  valorTerrenoCentavos: number;
}

export interface Documento {
  id: string;
  tipo: TipoDocumento;
  status: StatusDocumento;
  valorCentavos: number | null;
  vencimento: string | null;
  classificacao: Classificacao | null;
  destinatarioCpfOk: boolean;
  retencao11: boolean | null;
  motivoQuarentena: string | null;
  favorecidoNome: string | null;
  arquivoPath: string;
}

export interface Pagamento {
  id: string;
  valorCentavos: number;
  /** Regime de caixa: é DAQUI que sai o ano-calendário do custo. */
  dataPagamento: string;
  meio: MeioPagamento;
  status: StatusPagamento;
  favorecidoId: string | null;
  favorecidoNome: string | null;
  comprovantePath: string | null;
  /** Documentos hábeis vinculados (N:M — Relato 002). */
  documentoIds: string[];
}
