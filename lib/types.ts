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
export type OrigemCompromisso = Enums<"origem_compromisso">;
export type SituacaoCompromisso = Enums<"situacao_compromisso">;
export type ResolucaoDiferenca = Enums<"resolucao_diferenca">;

// ── Rows (PostgREST) ─────────────────────────────────────────────────────
export type ObraRow = Tables<"obra">;
export type FavorecidoRow = Tables<"favorecido">;
export type DocumentoRow = Tables<"documento">;
export type PagamentoRow = Tables<"pagamento">;
export type PagamentoDocumentoRow = Tables<"pagamento_documento">;
export type CompromissoRow = Tables<"compromisso">;
export type CompromissoPagamentoRow = Tables<"compromisso_pagamento">;
export type CompromissoDataHistoricoRow = Tables<"compromisso_data_historico">;
export type PagamentoDiferencaRow = Tables<"pagamento_diferenca">;
export type QuitacaoRecusadaRow = Tables<"quitacao_recusada">;

// ── Inserts ──────────────────────────────────────────────────────────────
export type ObraInsert = TablesInsert<"obra">;
export type FavorecidoInsert = TablesInsert<"favorecido">;
export type DocumentoInsert = TablesInsert<"documento">;
export type PagamentoInsert = TablesInsert<"pagamento">;
export type CompromissoInsert = TablesInsert<"compromisso">;

// ── Domínio (centavos) ───────────────────────────────────────────────────
export interface Obra {
  id: string;
  nome: string;
  cno: string | null;
  matricula: string | null;
  cartorio: string | null;
  municipio: string | null;
  /** Preço pago ao vendedor. O custo do terreno é a soma dos três valores. */
  valorTerrenoCentavos: number;
  valorItbiCentavos: number;
  valorEscrituraRegistroCentavos: number;
  /** Obrigatória: ancora o prazo de 30 dias do CNO e o período da aferição. */
  dataInicioObra: string;
  /** Quando o CNO saiu; do início até aqui é a janela das notas sem CNO. */
  cnoRegistradoEm: string | null;
  unidadesAutonomas: number;
  origemDesmembramentoLoteamento: boolean;
}

export interface Documento {
  id: string;
  /** Obra a que o registro pertence — corrigível pela interface (crit. 13). */
  obraId: string;
  tipo: TipoDocumento;
  status: StatusDocumento;
  valorCentavos: number | null;
  vencimento: string | null;
  classificacao: Classificacao | null;
  destinatarioCpfOk: boolean;
  retencao11: boolean | null;
  motivoQuarentena: string | null;
  favorecidoNome: string | null;
  /**
   * CNPJ/CPF do emitente, só dígitos. Vem junto do nome porque a tela de
   * registrar o pagamento da nota preenche os dois: fazer o Mateus redigitar o
   * documento arrisca um favorecido duplicado por typo — e a dedup de
   * `garantirFavorecido` é pelo DOCUMENTO, não pelo nome.
   */
  favorecidoDocumento: string | null;
  arquivoPath: string;
}

export interface Pagamento {
  id: string;
  obraId: string;
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

  // ── Composição do desembolso (CONTAI-019, tabela `pagamento_diferenca`) ──
  // ⚠️ Estes três campos são DERIVADOS de `pagamento_diferenca`, e não colunas
  // de `pagamento`: o critério 2 do CONTAI-019 é explícito em que `pagamento`
  // não ganha coluna nova. Quem não tem linha lá chega aqui com 0/0/null.

  /**
   * Juros e multa de mora identificados na confirmação. **Não compõem custo de
   * aquisição** (parecer de 2026-08-18, §3): não remuneram bem ou serviço
   * incorporado ao imóvel. Saem do pagamento ANTES do teto do mínimo (§F.3).
   */
  encargosCentavos: number;
  /**
   * O que sobrou do pagamento sem explicação. Fica fora do custo enquanto a
   * resolução for `null` — direção segura, subestima (§F.2).
   */
  naoExplicadoCentavos: number;
  /**
   * `null` é o **"não sei ainda"** do §F.2 — estado permitido e o único que
   * pode ser inicial, porque é o único que não afirma nada.
   */
  resolucaoDiferenca: ResolucaoDiferenca | null;
}

/**
 * A previsão. **Não é custo, e não é custo "ainda pequeno" — é zero**
 * (parecer de 2026-08-18, §1).
 *
 * Tipo separado de `Pagamento` por decisão fiscal, não por conveniência
 * (parecer §2): a proteção tem de ser de TIPO, não de atenção. Nenhuma função
 * de apuração aceita este tipo na entrada — a tipagem impede, não a
 * disciplina (critério 3).
 */
export interface Compromisso {
  id: string;
  obraId: string;
  favorecidoId: string | null;
  favorecidoNome: string | null;
  /** O campo se chama **valor previsto**, nunca "valor" (Gate Fiscal 6.3). */
  valorPrevistoCentavos: number;
  /**
   * `null` = "sem data definida", estado legítimo alcançável só pelo saldo de
   * uma quitação parcial. Não é vencido e não bloqueia (adendo §A, corolário 3).
   */
  dataPrevista: string | null;
  origem: OrigemCompromisso;
  documentoOrigemId: string | null;
  situacao: SituacaoCompromisso;
  motivoCancelamento: string | null;
  /** Cartão: data da compra. Dado probatório — **não decide ano nenhum**. */
  dataCompra: string | null;
  /** Vínculo 1:N — um compromisso pode ser quitado por vários pagamentos. */
  pagamentoIds: string[];
  /** Quantas vezes a data prevista já mudou — o "adiado N×" do critério 34. */
  adiamentos: number;
}
