/**
 * LOTE DE PARCELAS DE UMA COMPRA NO CARTÃO — CONTAI-084. Módulo puro: nada de
 * rede, nada de UI, nada de `Date` do fuso do aparelho.
 *
 * Fonte normativa: `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`,
 * ADENDO 5 §I.1-I.3 (recusa de parcelamento) e ADENDO 9 §M.0/M.2/M.8 (origem
 * não se herda). O Gate Fiscal do ticket é explícito em que **nenhuma regra
 * fiscal nova entra aqui**: este arquivo é a automação da instrução que o
 * próprio ADENDO 5 §I.1 já dá por escrito — *"lance cada parcela como uma
 * compra separada, pelo valor dela, na fatura em que ela vence"*.
 *
 * ⚠️ **Por que arquivo novo, e não `fatura.ts` nem `compromisso.ts`**: decisão
 * do `cto-obra` na Viabilidade do ticket. `compromisso.ts` tem 1803 linhas e
 * `fatura.ts` é o gate do parcelamento — o que mora aqui é só aritmética de
 * centavos e de calendário, e ela se testa sozinha.
 *
 * ⚠️ **O que este módulo NÃO decide**: `documento_origem_id`. Nenhuma função
 * daqui o aceita ou devolve, e a RPC `compra_cartao_gravar_lote` (migration
 * 0026) nem tem o parâmetro — é o critério 10 cumprido por assinatura, não por
 * disciplina de chamador.
 */

import { formatarBRL } from "@/lib/money";

import {
  validarCompraCartao,
  type EntradaCompraCartao,
  type ErroCampoCompraCartao,
} from "./fatura";

// ── Os limites do lote (critério 4) ──────────────────────────────────────

/** Menos que isto não é lote — é a tela individual. */
export const MINIMO_DE_PARCELAS = 2;
/**
 * Teto comum de parcelamento de material (Viabilidade do ticket). Validado no
 * formulário, não no SQL: quem fica nos dois lados é o mínimo e a soma.
 */
export const MAXIMO_DE_PARCELAS = 24;

/** Texto do critério 4, verbatim. */
export const LOTE_ABAIXO_DO_MINIMO =
  "Abaixo de 2 não é lote — lance em /adicionar/compra-cartao.";
/** Texto do critério 4, verbatim. */
export const LOTE_ACIMA_DO_MAXIMO = "Máximo 24 parcelas por lote.";

// ── Os dois textos fiscais da Tela 1 ─────────────────────────────────────

/**
 * Banner da Tela 1 — critério 6, **pluralização ratificada pelo `contador`**
 * (spec `design/mocks/CONTAI-084.md`, §2). É o banner de `compra-cartao`
 * levado ao plural, e nada mais: a frase não ganhou nem perdeu afirmação.
 *
 * Constante, e não texto inline, pelo motivo já escrito em `fatura.ts`: texto
 * fiscal duplicado é como nasce a D46 — o mesmo fato com dois rostos.
 */
export const LOTE_BANNER_AGENDAMENTO =
  "Estas compras nascem sempre agendamento — o dinheiro só sai quando cada " +
  "fatura for paga. O favorecido é o lojista, nunca o banco nem a " +
  "administradora.";

/**
 * A ausência do campo "Parcelado?" — critério 5, texto verbatim do spec
 * (§2), ratificado pelo `contador`.
 *
 * ⚠️ A doutrina que ela carrega é a correção de linguagem do Gate Fiscal: não
 * é "a rota declara por inferência" (isso violaria a proibição de heurística do
 * ADENDO 5 §I.2), é que **o campo não se aplica a uma linha que já nasce à
 * vista por construção** — cada parcela isolada já é o estado-alvo que o
 * ADENDO 5 prescreve como saída da recusa de parcelado.
 *
 * ⚠️ **"sozinha", e a concordância foi adjudicada no Gate 2 do CONTAI-084.** O
 * spec de design trazia *"sozinho"* e o ticket *"sozinha"*; o `contador`
 * confirmou que o sujeito da independência é a **parcela** ("cada uma"), não o
 * evento. Não é detalhe de estilo: concordar com "evento" deslocaria a
 * afirmação para a entidade errada, e o que é fiscalmente independente aqui é
 * a parcela — é dela que o ano do custo depende.
 */
export const LOTE_DICA_SEM_PARCELADO =
  "Nenhuma parcela aqui pergunta se é parcelada — cada uma já nasce um evento " +
  "à vista, sozinha. Vínculo com nota não é feito aqui: depois de criadas, " +
  "ligue cada parcela em pré-vínculo.";

// ── 1 · Divisão dos centavos (critério 7) ────────────────────────────────

/**
 * `total ÷ n` truncado em centavos nas `n-1` primeiras parcelas, **resíduo
 * inteiro de centavos somado só à ÚLTIMA** — critério 7, decisão do Mateus
 * registrada antes do ticket.
 *
 * Trabalha em inteiro de ponta a ponta: nenhuma divisão de ponto flutuante
 * sobra para a soma do ano, que é o número que vai para a declaração.
 *
 * Lança para entrada impossível em vez de devolver algo plausível: a tela só
 * chama isto depois de validar os campos, e um lote silenciosamente errado em
 * um centavo é exatamente o Pre-mortem 1 do ticket.
 */
export function dividirCentavos(
  totalCentavos: number,
  n: number,
): number[] {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("dividirCentavos: número de parcelas inteiro e ≥ 1.");
  }
  if (!Number.isInteger(totalCentavos) || totalCentavos <= 0) {
    throw new Error("dividirCentavos: total em centavos inteiro e > 0.");
  }
  const base = Math.floor(totalCentavos / n);
  const parcelas = Array.from({ length: n }, () => base);
  parcelas[n - 1] = totalCentavos - base * (n - 1);
  return parcelas;
}

// ── 2 · Datas sugeridas (critério 8) ─────────────────────────────────────

/** Nome do mês em pt-BR, minúsculo — é como a etiqueta do critério 8 o cita. */
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export interface VencimentoSugerido {
  /** ISO `YYYY-MM-DD`. */
  data: string;
  /** `true` quando o mês de destino não tem o dia da semente. */
  ajustada: boolean;
  /**
   * `"ajustada — abril não tem dia 31"`, ou `null` quando não houve ajuste.
   * Critério 8: o ajuste é **visível e nomeado**, nunca silencioso — Pre-mortem
   * 2 do ticket (o Mateus só descobriria ao conferir a fatura física).
   */
  etiqueta: string | null;
}

/** Dias do mês, com ano bissexto — sem `Date`, sem fuso. */
function diasNoMes(ano: number, mes: number): number {
  if (mes === 2) {
    const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
    return bissexto ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

/**
 * Os `n` vencimentos a partir da semente: parcela `i` (1-based) vence no mesmo
 * dia do mês, `i-1` meses depois.
 *
 * ⚠️ **Cálculo DIRETO (`semente + i meses`), nunca iterativo mês a mês** —
 * critério 8 e Viabilidade. Somar um mês por vez escorrega o dia para sempre:
 * 31/01 → 28/02 → 28/03 → 28/04… quando o certo é 31/01 → 28/02 → 31/03 →
 * 30/04. A semente é a única referência do dia, em toda parcela.
 *
 * Mês sem o dia da semente cai no ÚLTIMO dia daquele mês, com a etiqueta
 * dizendo qual parcela foi ajustada e por quê.
 */
export function vencimentosSugeridos(
  dataSemente: string,
  n: number,
): VencimentoSugerido[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataSemente)) {
    throw new Error("vencimentosSugeridos: semente em ISO `YYYY-MM-DD`.");
  }
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("vencimentosSugeridos: número de parcelas inteiro e ≥ 1.");
  }
  const [ano, mes, dia] = dataSemente.split("-").map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) {
    throw new Error(`vencimentosSugeridos: data inexistente (${dataSemente}).`);
  }

  return Array.from({ length: n }, (_, i) => {
    // Aritmética de mês absoluto: nada de somar 1 mês n vezes.
    const mesAbsoluto = mes - 1 + i;
    const anoDestino = ano + Math.floor(mesAbsoluto / 12);
    const mesDestino = (mesAbsoluto % 12) + 1;
    const ultimo = diasNoMes(anoDestino, mesDestino);
    const diaDestino = Math.min(dia, ultimo);
    const ajustada = diaDestino !== dia;
    return {
      data:
        `${String(anoDestino).padStart(4, "0")}-` +
        `${String(mesDestino).padStart(2, "0")}-` +
        `${String(diaDestino).padStart(2, "0")}`,
      ajustada,
      etiqueta: ajustada
        ? `ajustada — ${MESES[mesDestino - 1]} não tem dia ${dia}`
        : null,
    };
  });
}

// ── 3 · A soma tem de bater (critério 9) ─────────────────────────────────

export type EstadoDaSoma =
  | { estado: "bate" }
  | { estado: "falta"; centavos: number; mensagem: string }
  | { estado: "sobra"; centavos: number; mensagem: string };

/**
 * A validação em tempo real da Tela 2 — critério 9, textos verbatim do spec
 * (§3). **Nomeia a diferença**: "não bate" sozinho não diz o que fazer, e um
 * centavo de divergência passaria despercebido justamente por ser pequeno
 * (Pre-mortem 1).
 */
export function conferirSoma(
  somaCentavos: number,
  totalCentavos: number,
): EstadoDaSoma {
  const diferenca = somaCentavos - totalCentavos;
  if (diferenca === 0) return { estado: "bate" };
  if (diferenca < 0) {
    return {
      estado: "falta",
      centavos: -diferenca,
      mensagem: `Falta ${formatarBRL(-diferenca)} para a soma bater com o valor total.`,
    };
  }
  return {
    estado: "sobra",
    centavos: diferenca,
    mensagem: `Sobra ${formatarBRL(diferenca)} — a soma passou do valor total.`,
  };
}

export function somaDasParcelas(
  parcelas: readonly { valorCentavos: number | null }[],
): number {
  return parcelas.reduce((s, p) => s + (p.valorCentavos ?? 0), 0);
}

// ── 4 · A validação do lote inteiro (critério 11 e 17) ───────────────────

export interface ParcelaDoLote {
  /** `null` = não dá para interpretar o que está no campo. Nunca zero. */
  valorCentavos: number | null;
  /** ISO `YYYY-MM-DD` — o vencimento da fatura DESTA parcela. */
  dataVencimento: string;
}

export interface EntradaLoteCompraCartao {
  favorecidoNome: string;
  favorecidoDocumento: string;
  /** Comum a todas as parcelas: a compra aconteceu uma vez. */
  dataCompra: string;
  valorTotalCentavos: number | null;
  parcelas: readonly ParcelaDoLote[];
}

export type ErroDoLote =
  | { escopo: "lote"; campo: "parcelas" | "valorTotal"; mensagem: string }
  | {
      escopo: "parcela";
      /** 1-based, como a tela numera as linhas. */
      numero: number;
      campo: ErroCampoCompraCartao["campo"];
      mensagem: string;
    };

/** Texto do spec (§3) para a data de uma linha vazia ou impossível. */
export function dataDaParcelaVazia(numero: number): string {
  return `Preencha a data da parcela ${numero} para continuar.`;
}

/**
 * **Cada parcela é validada como evento "à vista" por construção** — critério
 * 11 e Gate Fiscal. `parcelado: "vista"` é FIXO aqui, e isto não é inferência
 * sobre o que o Mateus quis dizer: a tela do lote não tem campo de
 * parcelamento porque o campo não se aplica a uma linha que já nasce à vista
 * (ADENDO 5 §I.1 — cada parcela é uma compra separada, na fatura em que vence).
 *
 * ⚠️ Reaproveita `validarCompraCartao` em vez de reimplementar as regras de
 * favorecido, valor e data: uma segunda cópia delas é a D46 esperando
 * acontecer, e o gate do parcelamento é o mesmo nas duas telas.
 */
export function validarLoteCompraCartao(
  entrada: EntradaLoteCompraCartao,
): ErroDoLote[] {
  const erros: ErroDoLote[] = [];
  const n = entrada.parcelas.length;

  if (n < MINIMO_DE_PARCELAS) {
    // Sem lote não há o que validar linha a linha — e a saída é a outra tela.
    return [
      { escopo: "lote", campo: "parcelas", mensagem: LOTE_ABAIXO_DO_MINIMO },
    ];
  }
  if (n > MAXIMO_DE_PARCELAS) {
    erros.push({
      escopo: "lote",
      campo: "parcelas",
      mensagem: LOTE_ACIMA_DO_MAXIMO,
    });
  }

  entrada.parcelas.forEach((parcela, i) => {
    const numero = i + 1;
    const comum: EntradaCompraCartao = {
      favorecidoNome: entrada.favorecidoNome,
      favorecidoDocumento: entrada.favorecidoDocumento,
      valorCentavos: parcela.valorCentavos,
      dataCompra: entrada.dataCompra,
      dataVencimentoFatura: parcela.dataVencimento,
      parcelado: "vista",
    };
    for (const erro of validarCompraCartao(comum)) {
      erros.push({
        escopo: "parcela",
        numero,
        campo: erro.campo,
        // A data é POR LINHA nesta tela, e "Informe o vencimento da fatura"
        // não diria de qual das 24. O resto do texto vem de `fatura.ts` tal e
        // qual — o favorecido e o valor significam o mesmo nas duas telas.
        mensagem:
          erro.campo === "dataVencimentoFatura"
            ? dataDaParcelaVazia(numero)
            : erro.mensagem,
      });
    }
  });

  if (entrada.valorTotalCentavos === null) {
    erros.push({
      escopo: "lote",
      campo: "valorTotal",
      mensagem: "Informe o valor total da compra.",
    });
    return erros;
  }

  const soma = conferirSoma(
    somaDasParcelas(entrada.parcelas),
    entrada.valorTotalCentavos,
  );
  if (soma.estado !== "bate") {
    erros.push({
      escopo: "lote",
      campo: "valorTotal",
      mensagem: soma.mensagem,
    });
  }

  return erros;
}
