/**
 * Custo de aquisição do TERRENO: desembolsos datados e o informe anual do
 * financiamento (CONTAI-010). Módulo puro — nada de rede, nada de UI, nada de
 * `Date.now()`: o ano entra por parâmetro.
 *
 * Fonte das regras — nada aqui é inferido:
 * - `docs/pareceres/2026-08-17-terreno-financiado.md`, corpo + adendos 1, 2, 3
 *   e ⚠️ **ADENDO 4** (a divergência aberta com o contador com CRC).
 * - Gate Fiscal do CONTAI-010 (critérios 5, 6, 8, 11, 12, 13, 14, 15, 19, 24).
 *
 * Os textos de tela com consequência fiscal são CÓPIA do parecer/ticket, e
 * saem daqui como constantes nomeadas. Quem for mexer neles: passe pelo
 * `contador`, não reescreva aqui.
 *
 * ── A referência normativa, e o cuidado com ela ─────────────────────────
 * Juros e correção monetária pagos no financiamento do imóvel INTEGRAM o custo
 * de aquisição: **IN SRF 84/2001, art. 17, inciso I (bens imóveis)**.
 * ⚠️ **A LETRA DA ALÍNEA NÃO É AFIRMADA EM LUGAR NENHUM** — os adendos 1 e 2
 * citaram "g", o adendo 3 corrigiu para "i" e mandou confirmar na IN vigente.
 * O inciso I é o que vale; a letra é secundária e checável. Não a escreva em
 * tela, em texto de declaração nem em comentário.
 *
 * ── Aritmética ──────────────────────────────────────────────────────────
 * Tudo em CENTAVOS INTEIROS, como no resto do projeto. Valor fiscal não pode
 * acumular erro de ponto flutuante: a soma do ano vai para a declaração.
 */

import type {
  FinanciamentoInforme,
  TerrenoDesembolso,
} from "@/lib/types";
import { formatarBRL } from "@/lib/money";

// ── O ano-calendário de um desembolso ────────────────────────────────────

/**
 * Regime de caixa: o ano sai da DATA DO PAGAMENTO, e de nada mais.
 *
 * Regra negativa do parecer §2b, escrita porque a tentação é real: **proibido
 * derivar o ano do número da parcela, do cronograma do contrato, do vencimento
 * ou da data da escritura. Contrato é previsão; extrato é fato.**
 */
export function anoDoDesembolso(d: TerrenoDesembolso): number | null {
  if (d.estado !== "pago") return null;
  if (!d.dataPagamento) return null;
  return Number(d.dataPagamento.slice(0, 4));
}

/**
 * O desembolso entra em algum ano-calendário?
 *
 * Dois estados dizem que não, por motivos DIFERENTES, e a tela não os confunde:
 * - `previsto` — não foi pago. **Previsto não é pago** e não entra em ano
 *   nenhum, nem no corrente (critério 5).
 * - `pago` **sem data** — foi pago, mas o ano é desconhecido. É a linha vinda
 *   sem data conhecida, e vira PENDÊNCIA DE COMPLEMENTO visível
 *   (critério 23), nunca um palpite de data.
 */
export function entraEmAlgumAno(d: TerrenoDesembolso): boolean {
  return anoDoDesembolso(d) !== null;
}

// ── A composição do custo do informe (critérios 12, 13 e 24d) ───────────

/**
 * O que o app SOMA do informe: **amortização + juros/correção. Só isso.**
 *
 * - **Amortização** — é preço do imóvel. `[Certain]`.
 * - **Juros / correção monetária** — IN SRF 84/2001, art. 17, inciso I (bens
 *   imóveis): "os juros e demais acréscimos pagos para a aquisição do imóvel".
 *   A conclusão da Q4 (encargo de cartão sobre compra de material) **não se
 *   estende** ao financiamento do próprio imóvel: regra específica vence
 *   princípio geral.
 *
 * ⚠️ **A composição NÃO é decidida neste código para as rubricas em aberto.**
 * `seguros`, `taxas_fcvs` e `diferenca_teorico_pago` ficam FORA desta soma e
 * guardados separados — e este módulo **não afirma que estão excluídos por
 * regra**. Ver `rubricasComClassificacaoEmAberto` e o ADENDO 4 do parecer.
 *
 * `mora` e `multa` **nunca** somam, e isso PODE ser afirmado: penalidade nunca
 * é custo. `[Certain]` no parecer, critério 12.
 */
export function custoDoInformeCentavos(
  informe: Pick<
    FinanciamentoInforme,
    "amortizacaoCentavos" | "jurosCorrecaoCentavos"
  >,
): number {
  return informe.amortizacaoCentavos + informe.jurosCorrecaoCentavos;
}

/**
 * O que fica GUARDADO, fora da soma do custo — e o nome é neutro de propósito.
 *
 * ⚠️ **Não se chama "rubricas excluídas", e a diferença não é estética**
 * (ADENDO 4 do parecer, 2026-08-19): o parecer do agente `contador` diz que
 * seguros não entram; **o contador com CRC que assina a declaração do Mateus
 * INCLUIU**, e o Mateus decidiu manter a declaração como está. São posições
 * incompatíveis, e a divergência está **aberta e registrada**. O FCVS vem numa
 * linha só com a taxa de administração e é **candidato a inclusão**, pendente
 * de confirmação (critério 13). A "Diferença Teórico / Pago" ninguém sabe o
 * que é.
 *
 * O app guarda os sete números separados **exatamente para poder recompor o
 * custo sob qualquer das leituras sem redigitar nada** — o erro irreversível é
 * não capturar; capturar e não somar é reversível por retificadora.
 *
 * `mora` e `multa` NÃO entram aqui: elas não têm classificação em aberto, têm
 * classificação fechada ("nunca é custo"), e misturá-las com o que está em
 * dúvida apagaria a diferença que o critério 13 manda preservar.
 */
export function rubricasComClassificacaoEmAberto(
  informe: Pick<
    FinanciamentoInforme,
    "segurosCentavos" | "taxasFcvsCentavos" | "diferencaTeoricoPagoCentavos"
  >,
): number {
  return (
    informe.segurosCentavos +
    informe.taxasFcvsCentavos +
    informe.diferencaTeoricoPagoCentavos
  );
}

/** Penalidade nunca é custo — `[Certain]`, e isto PODE ser afirmado em tela. */
export function penalidadesCentavos(
  informe: Pick<FinanciamentoInforme, "moraCentavos" | "multaCentavos">,
): number {
  return informe.moraCentavos + informe.multaCentavos;
}

// ── A trava da soma (critério 11) ────────────────────────────────────────

/**
 * As sete rubricas de um informe, na ordem em que o extrato as apresenta.
 * A soma delas é o que a trava confere.
 */
export function somaDasRubricasCentavos(
  informe: Pick<
    FinanciamentoInforme,
    | "amortizacaoCentavos"
    | "jurosCorrecaoCentavos"
    | "segurosCentavos"
    | "taxasFcvsCentavos"
    | "moraCentavos"
    | "multaCentavos"
    | "diferencaTeoricoPagoCentavos"
  >,
): number {
  return (
    informe.amortizacaoCentavos +
    informe.jurosCorrecaoCentavos +
    informe.segurosCentavos +
    informe.taxasFcvsCentavos +
    informe.moraCentavos +
    informe.multaCentavos +
    informe.diferencaTeoricoPagoCentavos
  );
}

export type ResultadoTravaDaSoma =
  | { fecha: true; somaCentavos: number; diferencaCentavos: 0 }
  | {
      fecha: false;
      somaCentavos: number;
      /** Assinada: negativa = falta; positiva = sobra. Sempre exata. */
      diferencaCentavos: number;
      mensagem: string;
    };

/**
 * A soma fecha com o total pago, ou **o app recusa**.
 *
 * Se não bate, existe rubrica que o app não conhece: **recusar e pedir revisão
 * humana, nunca somar o resto e seguir** (parecer, adendo 2 §4). Somar o resto
 * produziria um número falso no custo de aquisição com aparência de certo.
 *
 * ⚠️ **TOLERÂNCIA ZERO — nem um centavo.** Documento de banco arredonda, e um
 * descasamento de R$ 0,01 vai travar o lançamento inteiro. Fica assim mesmo:
 * **travar e reclamar mostra o problema; folga silenciosa esconde.** Se
 * aparecer descasamento de centavo na vida real, decide-se com o caso na mão.
 * Centavos inteiros comparam exato — nada de float, nada de epsilon.
 *
 * Por que aqui o app RECUSA, se no CONTAI-019 recusar foi reprovado: a régua
 * não é "nunca bloqueie", é **"não bloqueie quando o fato do mundo já
 * aconteceu"**. Lá o dinheiro tinha saído da conta e recusar apagaria um fato
 * real. Aqui nenhum fato novo aconteceu — **o dado está errado**.
 */
export function travaDaSoma(
  informe: Pick<
    FinanciamentoInforme,
    | "amortizacaoCentavos"
    | "jurosCorrecaoCentavos"
    | "segurosCentavos"
    | "taxasFcvsCentavos"
    | "moraCentavos"
    | "multaCentavos"
    | "diferencaTeoricoPagoCentavos"
    | "totalPagoCentavos"
  >,
): ResultadoTravaDaSoma {
  const somaCentavos = somaDasRubricasCentavos(informe);
  const diferencaCentavos = somaCentavos - informe.totalPagoCentavos;
  if (diferencaCentavos === 0) {
    return { fecha: true, somaCentavos, diferencaCentavos: 0 };
  }
  return {
    fecha: false,
    somaCentavos,
    diferencaCentavos,
    mensagem: mensagemDaTrava(diferencaCentavos),
  };
}

/**
 * A mensagem da recusa NOMEIA A DIFERENÇA EXATA (critério 11): "não fechou" sem
 * o número deixa o Mateus conferindo sete linhas no escuro, e a diferença é
 * justamente a pista de qual linha ficou de fora.
 */
export function mensagemDaTrava(diferencaCentavos: number): string {
  const falta = diferencaCentavos < 0;
  const valor = formatarBRL(Math.abs(diferencaCentavos));
  return (
    `A soma das sete linhas não fecha com o total pago no exercício: ` +
    `${falta ? "faltam" : "sobram"} ${valor}. ` +
    "Se não bate, existe uma rubrica que o app não conhece — confira o extrato " +
    "linha a linha. Este lançamento não é gravado enquanto a soma não fechar."
  );
}

// ── O custo do terreno até 31/12 de um ano (critérios 6 e 24a) ──────────

/**
 * A situação em 31/12 do ano declarado, pela parte do TERRENO.
 *
 * Soma:
 * (a) os desembolsos **pagos e datados** com ano ≤ `ano` — cada componente cai
 *     no ano da SUA data, e é por isso que uma data só nunca bastou: terreno
 *     pago em 2024 + ITBI recolhido em 2025 são custo de anos diferentes;
 * (b) o custo dos informes com `anoBase <= ano` — amortização + juros/correção.
 *
 * NÃO soma, e cada exclusão tem motivo próprio:
 * - `previsto` — não foi pago (critério 5);
 * - `pago` sem data — foi pago, mas não se sabe em que ano (critério 22/23);
 * - `preco_contratado` do financiamento — nunca é custo (critério 8);
 * - `saldo_devedor` — não foi pago (critério 15);
 * - seguros, taxas/FCVS e a "Diferença Teórico / Pago" — classificação em
 *   aberto, guardadas separadas (critério 12 e ADENDO 4);
 * - mora e multa — penalidade nunca é custo `[Certain]`.
 *
 * ⚠️ Isto é **insumo para revisão profissional (CRC)**, nunca veredito
 * (critério 19).
 */
export function custoTerrenoAteOAno(
  desembolsos: readonly TerrenoDesembolso[],
  informes: readonly FinanciamentoInforme[],
  ano: number,
): number {
  let total = 0;
  for (const d of desembolsos) {
    const anoDele = anoDoDesembolso(d);
    if (anoDele === null || anoDele > ano) continue;
    total += d.valorCentavos;
  }
  for (const i of informes) {
    if (i.anoBase > ano) continue;
    total += custoDoInformeCentavos(i);
  }
  return total;
}

/** A parte do terreno que caiu DENTRO de um ano-calendário específico. */
export function custoTerrenoDoAno(
  desembolsos: readonly TerrenoDesembolso[],
  informes: readonly FinanciamentoInforme[],
  ano: number,
): number {
  let total = 0;
  for (const d of desembolsos) {
    if (anoDoDesembolso(d) !== ano) continue;
    total += d.valorCentavos;
  }
  for (const i of informes) {
    if (i.anoBase !== ano) continue;
    total += custoDoInformeCentavos(i);
  }
  return total;
}

// ── O painel ano a ano (D2.2) ────────────────────────────────────────────

export type SituacaoAnoFinanciamento = "registrado" | "falta_lancar" | "aguardando_informe";

export interface AnoDoFinanciamento {
  ano: number;
  situacao: SituacaoAnoFinanciamento;
  /** Custo do informe daquele ano, quando ele existe. */
  custoCentavos: number;
  /**
   * Ordem de grandeza do que ainda vai entrar no ano CORRENTE, tirada do
   * informe do ano anterior. **Nunca somada em lugar nenhum** — ver
   * `ESTIMATIVA_NAO_E_APURACAO`.
   */
  estimativaCentavos: number | null;
}

/**
 * Os anos que o painel enumera: do ano do contrato até o ano corrente,
 * inclusive.
 *
 * - ano com informe → `registrado`;
 * - ano passado sem informe → `falta_lancar` (o banco já publicou; é download);
 * - ano corrente sem informe → `aguardando_informe`, que **não é pendência
 *   vermelha**: o informe só é publicado em jan/fev do ano seguinte. Isto não é
 *   defeito, é o calendário do banco — e tem de ser NOMEADO (critério 16),
 *   nunca silenciado, senão vira o defeito do CONTAI-005 ao contrário.
 */
export function anosDoFinanciamento(
  dataContrato: string,
  informes: readonly FinanciamentoInforme[],
  anoCorrente: number,
): AnoDoFinanciamento[] {
  const primeiro = Number(dataContrato.slice(0, 4));
  const porAno = new Map(informes.map((i) => [i.anoBase, i]));
  const anos: AnoDoFinanciamento[] = [];
  for (let ano = primeiro; ano <= anoCorrente; ano += 1) {
    const informe = porAno.get(ano);
    if (informe) {
      anos.push({
        ano,
        situacao: "registrado",
        custoCentavos: custoDoInformeCentavos(informe),
        estimativaCentavos: null,
      });
      continue;
    }
    const anterior = porAno.get(ano - 1);
    anos.push({
      ano,
      situacao: ano === anoCorrente ? "aguardando_informe" : "falta_lancar",
      custoCentavos: 0,
      // A estimativa só faz sentido no ano corrente, e só existe se houver um
      // informe do ano anterior de onde tirar a ordem de grandeza.
      estimativaCentavos:
        ano === anoCorrente && anterior ? custoDoInformeCentavos(anterior) : null,
    });
  }
  return anos;
}

// ── Textos de tela com consequência fiscal (CÓPIA do parecer/ticket) ─────

/** Critério 23 — literal. Pendência de complemento, e **não é bloqueio**. */
export const DESEMBOLSO_SEM_DATA =
  "sem a data, este valor não tem ano-calendário e a discriminação não pode " +
  "ser gerada";

/** Parecer §2b: o ano sai do débito no extrato, e de nada mais. */
export const A_DATA_QUE_VALE =
  "A data que vale é a do débito no extrato — não a do contrato, não a da " +
  "escritura, não a do vencimento.";

/** Critério 5 — previsto não entra em ano nenhum, nem no corrente. */
export const PREVISTO_NAO_E_PAGO =
  "Registrado como previsto, este valor não entra em ano nenhum — nem no " +
  "corrente. Previsto não é pago.";

/** Critério 22 — vazio pergunta, memória afirma. */
export const APP_NAO_INVENTA_DATA =
  "O app nunca inventa a data: nem a de hoje, nem a do cadastro. Data ausente " +
  "continua ausente e visível.";

/** Parecer §2a — FGTS na entrada é dinheiro dele, não do banco. */
export const FGTS_NA_ENTRADA_ENTRA =
  "FGTS usado na entrada entra no custo — é dinheiro seu, não do banco.";

/** Critério 8 — cópia do parecer §1. */
export const PRECO_CONTRATADO_NAO_E_CUSTO =
  "O preço contratado nunca vai para o custo. Ele existe para o texto da " +
  "declaração e para fechar a conta: pago + saldo devedor = preço. Declarar o " +
  "bem pelo preço integral sem declarar a dívida produz evolução patrimonial " +
  "sem lastro de renda — e, na venda, custo de aquisição maior que o " +
  "desembolso comprovado.";

/** Critério 15 — cópia do parecer §2c e do adendo 2 §2. */
export const SALDO_DEVEDOR_INFORMATIVO =
  "Saldo devedor não é custo de nada. Guardar como informativo, nunca somar, " +
  "nunca virar campo de 'dívida' no custo. Não vai para a declaração.";

/** Critério 10 — sem o extrato, o lançamento não grava. */
export const INFORME_EXIGE_ANEXO =
  "Sem o extrato anexado, este lançamento não grava. São dezenas de milhares " +
  "de reais de custo de aquisição: o número sem o documento que o sustenta não " +
  "serve para nada no dia da venda.";

/** Critério 14 — a trava da dupla contagem, com o motivo por extenso. */
export const UM_INFORME_POR_ANO =
  "Já existe um informe registrado para este ano-base. Registrar o mesmo ano " +
  "duas vezes contaria os mesmos pagamentos duas vezes, e custo inflado em " +
  "Bens e Direitos é redução indevida de ganho de capital — cobrada com multa " +
  "na venda.";

/**
 * Critério 19 — todo número de custo do financiamento é INSUMO PARA REVISÃO
 * PROFISSIONAL, nunca veredito. Texto do ticket + adendo 2 §2 do parecer.
 */
export const INSUMO_PARA_REVISAO_CRC =
  "Este número é insumo para revisão do seu contador com CRC, não um veredito " +
  "do app. A maior parte do desembolso do ano são juros, e a inclusão deles " +
  "apoia-se em dispositivo que ainda depende de confirmação — o app soma e " +
  "nomeia em linha própria; quem assume a posição na declaração é humano.";

/**
 * ⚠️ **Este texto NÃO afirma o tratamento dos seguros** — critério 18, REMOVIDO
 * em 2026-08-19 por decisão do Mateus, e ADENDO 4 do parecer. O parecer do
 * agente `contador` exclui; o contador com CRC que assina a declaração inclui.
 * A tela mostra a rubrica, o valor e de onde ele veio, **e cala sobre a
 * classificação**.
 */
export const RUBRICA_EM_ABERTO =
  "Guardado separado — a classificação desta rubrica é decisão do seu contador.";

/** Critério 12 — o motivo de guardar as sete separadas, sempre. */
export const GUARDADO_NAO_E_DESCARTADO =
  "Guardado não é descartado. As sete linhas ficam registradas separadas, e é " +
  "isso que permite recompor o custo sob qualquer entendimento sem redigitar " +
  "nada — o erro irreversível seria não ter capturado.";

/** Critério 13 — o FCVS não herda o tratamento de nenhuma outra rubrica. */
export const TAXAS_E_FCVS_NA_MESMA_LINHA =
  "Esta linha junta duas coisas com destinos diferentes: taxa de administração " +
  "do contrato e FCVS. O extrato não separa, e o app não adivinha a divisão — " +
  "guarda o valor cheio fora da soma e marca o ano como pendente de revisão " +
  "humana. Nada trava por causa disto.";

/** Critério 16 — o ano corrente subestima, e isso é nomeado, nunca silenciado. */
export const AGUARDANDO_INFORME =
  "O custo do financiamento deste ano está menor do que a realidade e vai " +
  "ficar assim o ano todo: você paga parcela todo mês, e o documento que as " +
  "comprova só é publicado em jan/fev do ano seguinte. Não é um defeito, é o " +
  "calendário do banco — e não afeta declaração nenhuma, que é preenchida com " +
  "o informe já na mão.";

/** D2.8 — a estimativa é ordem de grandeza, e fica FORA de toda soma. */
export const ESTIMATIVA_NAO_E_APURACAO =
  "A estimativa vem do informe do ano anterior. É ordem de grandeza, não um " +
  "número apurado — por isso não soma em lugar nenhum.";

/**
 * Critério 21 — onde este lançamento NÃO aparece, e é de propósito
 * (parecer §5): o favorecido é o banco e o documento hábil é contrato +
 * extrato, não nota fiscal.
 */
export const FINANCIAMENTO_FORA_DAS_OUTRAS_APURACOES =
  "O lançamento do financiamento não é um pagamento do app: não entra em " +
  "Pagamentos Efetuados, não entra na base de aferição do INSS e não entra no " +
  "custo em risco da home. Se entrasse, viraria um 'pago sem nota' vermelho " +
  "todo ano, para sempre, sem nada de errado acontecendo.";

/** Rótulo curto de cada natureza, para lista e cabeçalho. */
export const NOME_DA_NATUREZA: Record<
  "a_vista" | "financiado" | "parcelado_vendedor" | "recebido",
  string
> = {
  a_vista: "Comprado à vista",
  financiado: "Financiado com instituição",
  parcelado_vendedor: "Parcelado direto com o vendedor",
  recebido: "Recebido (herança, doação ou permuta)",
};

/** Tela s2 do mock — o que cada natureza muda. */
export const O_QUE_CADA_NATUREZA_MUDA: Record<
  "a_vista" | "financiado" | "parcelado_vendedor" | "recebido",
  string
> = {
  a_vista:
    "um desembolso datado. Sem juros, sem saldo devedor, sem informe anual",
  financiado:
    "entrada + um lançamento por ano, com o extrato anual do banco",
  parcelado_vendedor:
    "entrada + cada parcela com a sua data e o seu recibo",
  // Parecer §5, pergunta 3: há data de aquisição SEM desembolso, e o custo é o
  // valor constante na declaração do doador/de cujus. Por isso "valor sem data
  // não grava" só vale para aquisição onerosa (critério 4).
  recebido:
    "há data de aquisição sem desembolso; o custo é o valor que constava na " +
    "declaração de quem doou ou faleceu",
};

/** Rótulo curto de cada tipo de desembolso, para lista e formulário. */
export const NOME_DO_DESEMBOLSO: Record<
  "pagamento_terreno" | "entrada" | "itbi" | "escritura_registro" | "parcela_vendedor" | "quitacao",
  string
> = {
  pagamento_terreno: "Pagamento do terreno",
  entrada: "Entrada",
  itbi: "ITBI",
  escritura_registro: "Escritura e registro",
  parcela_vendedor: "Parcela ao vendedor",
  quitacao: "Quitação do financiamento",
};
