/**
 * CARTÃO DE CRÉDITO — compra → fatura → pagamento (CONTAI-022). Módulo puro:
 * nada de rede, nada de UI.
 *
 * Fonte normativa: `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`
 * (ADENDO §B cartão, ADENDO 2 §5+§7 comprovante compartilhado, ADENDO 5
 * recusa de parcelamento — texto literal do `contador`).
 *
 * A compra em si é um `Compromisso` comum (`origem: "cartao"`) — este arquivo
 * não reimplementa nada de `lib/fiscal/compromisso.ts`. O que mora aqui é
 * específico da FATURA: o gate do parcelamento (que decide se o compromisso
 * chega a nascer) e o teto dinâmico da alocação manual do rotativo.
 */

import type { Compromisso, Fatura } from "@/lib/types";
import { ehDataValida } from "./pagamento";

// ── O gate do parcelamento (crit. 11 do ticket) ──────────────────────────

export type RespostaParcelamento = "vista" | "parcelado";

/**
 * Texto literal definitivo — ADENDO 5 §I.1 do parecer, carimbado pelo
 * `contador` em 2026-09-19. Substitui o texto provisório do designer: nomeia
 * o erro específico que o Gate Fiscal já registrou como risco residual
 * (lançar o total como uma compra à vista, na fatura da 1ª parcela).
 */
export const RECUSA_PARCELADO =
  "Compra parcelada não é aceita aqui. Cada parcela cai numa fatura " +
  "diferente, e o ano do custo é o da fatura em que ela é paga — não o da " +
  "compra. Lance cada parcela como uma compra separada, pelo valor dela, " +
  "na fatura em que ela vence. Não lance o valor total numa fatura só: " +
  "isso muda o ano de custo das parcelas seguintes.";

export interface EntradaCompraCartao {
  favorecidoNome: string;
  favorecidoDocumento: string;
  valorCentavos: number | null;
  dataCompra: string;
  dataVencimentoFatura: string;
  /**
   * `null` = ainda não respondido — campo que classifica não tem default
   * (mesma doutrina do CONTAI-032). Sem resposta, o formulário nem chega a
   * mostrar o resto dos campos.
   */
  parcelado: RespostaParcelamento | null;
}

export interface ErroCampoCompraCartao {
  campo: keyof EntradaCompraCartao;
  mensagem: string;
}

/**
 * ⚠️ **`parcelado` é sempre resposta do Mateus, nunca inferência do app**
 * (confirmado pelo `contador`, ADENDO 5 §I.2): valor, data ou favorecido não
 * bastam para deduzir parcelamento com segurança. Proibido detectar por
 * heurística.
 */
export function validarCompraCartao(
  entrada: EntradaCompraCartao,
): ErroCampoCompraCartao[] {
  const erros: ErroCampoCompraCartao[] = [];

  if (entrada.parcelado === null) {
    erros.push({ campo: "parcelado", mensagem: "Diga se é parcelado." });
    return erros;
  }
  if (entrada.parcelado === "parcelado") {
    erros.push({ campo: "parcelado", mensagem: RECUSA_PARCELADO });
    return erros;
  }

  if (entrada.favorecidoNome.trim().length < 2) {
    erros.push({
      campo: "favorecidoNome",
      mensagem: "Informe o favorecido — o lojista, nunca o banco ou a administradora.",
    });
  }
  if (entrada.valorCentavos === null || entrada.valorCentavos <= 0) {
    erros.push({ campo: "valorCentavos", mensagem: "Informe o valor da compra." });
  }
  if (!entrada.dataCompra || !ehDataValida(entrada.dataCompra)) {
    erros.push({ campo: "dataCompra", mensagem: "Informe a data da compra." });
  }
  if (
    !entrada.dataVencimentoFatura ||
    !ehDataValida(entrada.dataVencimentoFatura)
  ) {
    erros.push({
      campo: "dataVencimentoFatura",
      mensagem: "Informe o vencimento da fatura.",
    });
  }

  return erros;
}

// ── A fatura — compras abertas e o teto da alocação manual ───────────────

/** As compras desta fatura ainda `aberto` — as candidatas a confirmar. */
export function compromissosAbertosDaFatura(
  fatura: Pick<Fatura, "compromissoIds">,
  compromissos: readonly Compromisso[],
): Compromisso[] {
  const idsDaFatura = new Set(fatura.compromissoIds);
  return compromissos.filter(
    (c) => idsDaFatura.has(c.id) && c.situacao === "aberto",
  );
}

/** Soma do que já foi pago à fatura — integral ou parcial, os N desembolsos. */
export function totalDesembolsadoCentavos(fatura: Pick<Fatura, "desembolsos">): number {
  return fatura.desembolsos.reduce((s, d) => s + d.valorCentavos, 0);
}

/**
 * O teto dinâmico da alocação manual (mock s7: "checkbox trava sozinho antes
 * de estourar o valor pago"). **Derivado, nunca coluna materializada**
 * (achado do `cto-obra`): `Σ desembolsos − Σ já alocado (compras quitadas
 * desta fatura)`. Nunca negativo.
 */
export function tetoDeAlocacaoCentavos(
  fatura: Pick<Fatura, "compromissoIds" | "desembolsos">,
  compromissos: readonly Compromisso[],
): number {
  const idsDaFatura = new Set(fatura.compromissoIds);
  const jaAlocado = compromissos
    .filter((c) => idsDaFatura.has(c.id) && c.situacao === "quitado")
    .reduce((s, c) => s + c.valorPrevistoCentavos, 0);
  return Math.max(0, totalDesembolsadoCentavos(fatura) - jaAlocado);
}

/**
 * s7v é alcançável (confirmado pelo `cto-obra`): zero compras `aberto`
 * nesta fatura — o caminho normal é o rotativo em 2+ parcelas, onde a
 * última alocação já cobriu o que sobrava. **Nunca decidido por
 * `teto === 0`** — isso esconderia compras em aberto que ainda bloqueiam o
 * relatório anual.
 */
export function nadaElegivelParaAlocacao(
  fatura: Pick<Fatura, "compromissoIds">,
  compromissos: readonly Compromisso[],
): boolean {
  return compromissosAbertosDaFatura(fatura, compromissos).length === 0;
}

/**
 * Quanto do valor pago ficaria sem compra atribuída, com a seleção atual.
 * Nunca negativo por construção — a tela impede selecionar além do teto.
 */
export function saldoNaoAlocadoCentavos(
  fatura: Pick<Fatura, "desembolsos">,
  compromissosSelecionados: readonly Pick<Compromisso, "valorPrevistoCentavos">[],
): number {
  const selecionado = compromissosSelecionados.reduce(
    (s, c) => s + c.valorPrevistoCentavos,
    0,
  );
  return Math.max(0, totalDesembolsadoCentavos(fatura) - selecionado);
}
