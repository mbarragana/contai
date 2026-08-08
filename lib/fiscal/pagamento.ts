/**
 * Regras do pagamento avulso — PIX feito sem nota nem boleto (US-007,
 * Relato 002). Módulo puro.
 *
 * Invariante fiscal (CLAUDE.md): o custo de aquisição segue REGIME DE CAIXA —
 * o ano-calendário sai da data do pagamento, nunca da data da nota.
 */

import type {
  MeioPagamento,
  StatusPagamento,
  TipoFavorecido,
} from "@/lib/types";
import { tipoPorDocumento } from "./identificacao";

/**
 * Pagamento avulso deste ticket é sempre PIX (mock v4, tela 10).
 * Boleto tem fluxo próprio (documento) e cartão depende da Q4 — enquanto a
 * regra do ano-calendário do cartão não estiver confirmada pelo contador, o
 * app não oferece esse meio: seria classificação silenciosa de ano.
 */
export const MEIO_PAGAMENTO_AVULSO: MeioPagamento = "pix";

/** Pago sem documento hábil vinculado — critério 3 da US-007. */
export const STATUS_PAGAMENTO_AVULSO: StatusPagamento = "aguardando_nf";

export interface RotulosPagoSemNota {
  /** Nome do documento que falta ("NF", "recibo"). */
  documento: string;
  /** Chip da pendência na home. */
  chip: string;
  /** Trecho do título — a concordância muda com o documento. */
  semVinculo: string;
  /** Consequência fiscal explícita. */
  consequencia: string;
}

const PJ: RotulosPagoSemNota = {
  documento: "NF",
  chip: "Pago sem nota",
  semVinculo: "sem NF vinculada",
  consequencia:
    "Custo não se sustenta no IR até a NF chegar. Cobre a NF antes da próxima parcela.",
};

const PF: RotulosPagoSemNota = {
  documento: "recibo",
  chip: "Pago sem recibo",
  semVinculo: "sem recibo vinculado",
  consequencia:
    "Custo não se sustenta no IR até o recibo chegar. Cobre o recibo assinado (nome, CPF e descrição do serviço) antes do próximo pagamento.",
};

const DESCONHECIDO: RotulosPagoSemNota = {
  documento: "documento hábil",
  chip: "Pago sem documento",
  semVinculo: "sem documento hábil vinculado",
  consequencia:
    "Custo não se sustenta no IR sem documento hábil. Informe o CNPJ/CPF do favorecido para saber se falta NF (PJ) ou recibo assinado (PF).",
};

/**
 * O que o pagamento sem documento está esperando depende de QUEM recebeu
 * (contador, Gate 2 do CONTAI-001):
 * - PJ → nota fiscal;
 * - PF (prestador autônomo) → recibo assinado com nome, CPF completo e
 *   descrição do serviço, junto do comprovante da transferência. PF não emite
 *   NF: cobrar "a nota" dele seria cobrar o impossível;
 * - tipo desconhecido → não dá para dizer qual dos dois, e o app não escolhe
 *   por conta própria.
 *
 * O status interno continua `aguardando_nf` (enum do banco); o que muda é o
 * que o Mateus lê.
 */
export function rotulosPagoSemNota(
  tipo: TipoFavorecido | null,
): RotulosPagoSemNota {
  if (tipo === "pj") return PJ;
  if (tipo === "pf") return PF;
  return DESCONHECIDO;
}

export interface EntradaPagamento {
  favorecidoNome: string;
  favorecidoDocumento: string;
  valorCentavos: number | null;
  /** ISO (yyyy-mm-dd). */
  dataPagamento: string | null;
  temComprovante: boolean;
}

export interface ErroCampoPagamento {
  campo: keyof EntradaPagamento;
  mensagem: string;
}

/** Ano-calendário do custo: regime de caixa. */
export function anoCalendario(dataPagamento: string): number {
  return Number(dataPagamento.slice(0, 4));
}

export function ehDataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export function validarPagamentoAvulso(
  entrada: EntradaPagamento,
  hojeIso: string,
): ErroCampoPagamento[] {
  const erros: ErroCampoPagamento[] = [];

  if (entrada.favorecidoNome.trim().length < 2) {
    erros.push({
      campo: "favorecidoNome",
      mensagem: "Informe o nome do favorecido.",
    });
  }

  if (tipoPorDocumento(entrada.favorecidoDocumento) === null) {
    erros.push({
      campo: "favorecidoDocumento",
      mensagem: "CNPJ/CPF inválido — confira os dígitos.",
    });
  }

  if (entrada.valorCentavos === null || entrada.valorCentavos <= 0) {
    erros.push({ campo: "valorCentavos", mensagem: "Informe o valor pago." });
  }

  if (!entrada.dataPagamento || !ehDataValida(entrada.dataPagamento)) {
    erros.push({
      campo: "dataPagamento",
      mensagem: "Informe a data em que o pagamento saiu.",
    });
  } else if (entrada.dataPagamento > hojeIso) {
    // Regime de caixa: data no futuro jogaria o custo no ano errado sem que
    // ninguém percebesse.
    erros.push({
      campo: "dataPagamento",
      mensagem:
        "Data no futuro — o custo entra no ano do pagamento, registre a data em que o dinheiro saiu.",
    });
  }

  if (!entrada.temComprovante) {
    erros.push({
      campo: "temComprovante",
      mensagem: "Anexe o comprovante do PIX — sem ele o pagamento não é aceito.",
    });
  }

  return erros;
}
