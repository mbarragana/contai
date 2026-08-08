/**
 * Tipos do schema. Enums, rows e inserts DERIVAM dos tipos gerados do banco
 * (`lib/database.types.ts`, produzido por `npx supabase gen types typescript
 * --linked`) — as migrations 0001/0002 estão aplicadas no projeto linkado.
 * Não redeclare coluna à mão aqui: é assim que o tipo descola do banco sem
 * ninguém perceber.
 *
 * Convenção: `*Row` = o que o PostgREST devolve; os tipos de domínio (sem
 * sufixo) já vêm com dinheiro em CENTAVOS (inteiro), para somar valor fiscal
 * sem erro de ponto flutuante.
 */

import type { Enums, Tables, TablesInsert } from "@/lib/database.types";

// ── Enums ────────────────────────────────────────────────────────────────
export type TipoFavorecido = Enums<"tipo_favorecido">;
export type TipoDocumento = Enums<"tipo_documento">;
export type Classificacao = Enums<"classificacao">;
export type StatusDocumento = Enums<"status_documento">;
export type MeioPagamento = Enums<"meio_pagamento">;
export type StatusPagamento = Enums<"status_pagamento">;

// ── Rows (PostgREST) ─────────────────────────────────────────────────────
export type ObraRow = Tables<"obra">;
export type FavorecidoRow = Tables<"favorecido">;
export type DocumentoRow = Tables<"documento">;
export type PagamentoRow = Tables<"pagamento">;
export type PagamentoDocumentoRow = Tables<"pagamento_documento">;

// ── Inserts ──────────────────────────────────────────────────────────────
export type FavorecidoInsert = TablesInsert<"favorecido">;
export type DocumentoInsert = TablesInsert<"documento">;
export type PagamentoInsert = TablesInsert<"pagamento">;

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
  /** PF x PJ decide qual documento hábil está faltando (NF vs. recibo). */
  favorecidoTipo: TipoFavorecido | null;
  comprovantePath: string | null;
  /** Documentos hábeis vinculados (N:M — Relato 002). */
  documentoIds: string[];
}
