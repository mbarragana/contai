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
  NaturezaAquisicaoTerreno,
  PapelDeAnexo,
  TerrenoDesembolso,
  TerrenoDesembolsoAnexo,
  TipoDesembolsoTerreno,
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
 * **CONTAI-025, critérios 7 e 9 — o custo do terreno são DOIS números.**
 *
 * Fonte: `docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`, §2.1
 * (*"soma apenas desembolso pago, **com data** e **com comprovante**"*) e §2.4
 * (*"no relatório anual, nunca um número só"*).
 *
 * ⚠️ **O segundo número não é cortável, e a razão é simétrica**: liberada a
 * gravação sem comprovante, um número só faria o custo **encolher em
 * silêncio** — e o §2.4 diz *"item incluído em silêncio é o pior dos mundos;
 * nomeado, é posição declarada"*, e que isso **vale nos dois sentidos:
 * excluído em silêncio também**. Somar seria a D34 (ganho de capital
 * inflado); subtrair calado é o mesmo defeito virado ao contrário.
 *
 * ⚠️ **O que fica FORA dos dois**: desembolso `pago` **sem data**. Ele não tem
 * ano-calendário e por isso não entra em ano nenhum — nem no confirmado, nem
 * no sem-comprovante **deste ano**. Ele aparece no agregado da OBRA
 * (`pagosSemComprovante`), que não é por ano. A diferença entre os dois
 * números é dita em tela; número que não bate sem explicação é pior que
 * número ausente.
 */
export interface CustoDoTerreno {
  /** Pago, **com data** e **com comprovante** — o que a ficha soma. */
  confirmadoCentavos: number;
  /**
   * Pago e datado, **sem papel `comprovante`** no acervo. Registrado, real, e
   * fora da soma acima — nomeado em linha própria (§4.5), nunca suprimido.
   */
  semComprovanteCentavos: number;
}

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
): CustoDoTerreno {
  let confirmadoCentavos = 0;
  let semComprovanteCentavos = 0;
  for (const d of desembolsos) {
    const anoDele = anoDoDesembolso(d);
    if (anoDele === null || anoDele > ano) continue;
    if (temComprovante(d)) confirmadoCentavos += d.valorCentavos;
    else semComprovanteCentavos += d.valorCentavos;
  }
  // ⚠️ O informe NÃO passa pelo portão do comprovante, e não é esquecimento: a
  // trava do critério 10 do CONTAI-010 continua de pé, e sem o extrato anexado
  // ele não grava (§1.2 — ali o anexo é FONTE, não prova). Informe gravado é
  // informe com anexo; aplicar o portão aqui seria conferir duas vezes o que o
  // formulário já recusa, e a segunda conferência não tem contra o que fechar.
  for (const i of informes) {
    if (i.anoBase > ano) continue;
    confirmadoCentavos += custoDoInformeCentavos(i);
  }
  return { confirmadoCentavos, semComprovanteCentavos };
}

/** A parte do terreno que caiu DENTRO de um ano-calendário específico. */
export function custoTerrenoDoAno(
  desembolsos: readonly TerrenoDesembolso[],
  informes: readonly FinanciamentoInforme[],
  ano: number,
): CustoDoTerreno {
  let confirmadoCentavos = 0;
  let semComprovanteCentavos = 0;
  for (const d of desembolsos) {
    if (anoDoDesembolso(d) !== ano) continue;
    if (temComprovante(d)) confirmadoCentavos += d.valorCentavos;
    else semComprovanteCentavos += d.valorCentavos;
  }
  for (const i of informes) {
    if (i.anoBase !== ano) continue;
    confirmadoCentavos += custoDoInformeCentavos(i);
  }
  return { confirmadoCentavos, semComprovanteCentavos };
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

/**
 * Critério 15 — cópia do parecer §2c e do adendo 2 §2.
 *
 * ⚠️ **A frase "não vai para a declaração" foi RETIRADA daqui no Gate 2**, e a
 * retirada é a mesma disciplina aplicada aos seguros: **onde a fonte se
 * contradiz, a tela cala.**
 *
 * O parecer diz as duas coisas, em lugares diferentes:
 * - §4, regra 2 (texto da discriminação): o saldo devedor **aparece** e é
 *   rotulado *"não incluído por não ter sido pago"* — *"fecha a conta na
 *   cabeça de quem lê (pago + saldo = preço)"*;
 * - adendo 2 §4: *"Saldo devedor **não entra na discriminação** do bem"*.
 *
 * Achado do `cto-obra` no reveredito do Gate 2, e ele estava vazando: esta
 * constante herdou um lado e `SALDO_DEVEDOR_OBRIGATORIO` herdou o outro — as
 * duas na MESMA tela, uma dizendo que o saldo fecha a conta de quem lê a
 * declaração e a outra dizendo que ele não vai para a declaração.
 *
 * O que sobra aqui é só o que é `[Certain]` e não está em disputa: **não é
 * custo, nunca soma, nunca vira campo de dívida.** Onde ele aparece no TEXTO
 * da discriminação é decisão do Passo 2 (US-004) e depende de um adendo do
 * `contador` — está registrado como pré-requisito dela, não como detalhe.
 */
export const SALDO_DEVEDOR_INFORMATIVO =
  "Saldo devedor não é custo de nada. Guardar como informativo, nunca somar, " +
  "nunca virar campo de 'dívida' no custo.";

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

/**
 * Critério 13 — o FCVS não herda o tratamento de nenhuma outra rubrica.
 *
 * ⚠️ A palavra **"candidato"** é obrigatória e não é enfeite: é ela que faz
 * alguém revisitar este ano quando a confirmação chegar (pre-mortem 3). Sem a
 * marca própria, o FCVS vira "mais uma linha guardada" e a confirmação
 * favorável não encontra nada para corrigir. E ela é dita **só do FCVS** — o
 * texto continua calado sobre a classificação dos seguros (ADENDO 4).
 */
export const TAXAS_E_FCVS_NA_MESMA_LINHA =
  "Esta linha junta duas coisas com destinos diferentes: taxa de administração " +
  "do contrato e FCVS. O extrato não separa, e o app não adivinha a divisão — " +
  "guarda o valor cheio fora da soma e marca o ano como pendente de revisão " +
  "humana. Nada trava por causa disto. O FCVS fica marcado como " +
  "candidato a inclusão, pendente de confirmação: se a confirmação vier " +
  "favorável, é esta linha que volta a ser olhada.";

/** Critério 16 — o ano corrente subestima, e isso é nomeado, nunca silenciado. */
export const AGUARDANDO_INFORME =
  "O custo do financiamento deste ano está menor do que a realidade e vai " +
  "ficar assim o ano todo: você paga parcela todo mês, e o documento que as " +
  "comprova só é publicado em jan/fev do ano seguinte. Não é um defeito, é o " +
  "calendário do banco — e não afeta declaração nenhuma, que é preenchida com " +
  "o informe já na mão.";

/**
 * Critério 16 — **ano ANTERIOR sem informe**, que é o caso que dói hoje: o
 * extrato já existe, o dinheiro já saiu, e o custo daquele ano não existe no
 * sistema. Diferente de `AGUARDANDO_INFORME`, que fala do ano que ainda não
 * fechou e cujo documento o banco ainda não publicou.
 *
 * Uma definição só, usada pela home e pelo painel do terreno: duas cópias do
 * mesmo texto fiscal descolam no dia em que uma delas for corrigida.
 */
export function faltaLancarInforme(ano: number): string {
  return (
    `Falta lançar o informe anual de ${ano}. Sem ele, o custo de aquisição ` +
    `de ${ano} não existe no sistema — e custo pago e não discriminado na ` +
    "declaração não existe na hora da venda. O extrato já foi publicado pelo " +
    "banco: é download, não pedido."
  );
}

/**
 * ⚠️ O R$ 0,00 do terreno **não é uma apuração** — é a ausência dela.
 *
 * O backfill das três colunas mortas foi DESCARTADO (2026-08-19, decisão do
 * Mateus): a obra existente atravessou a migration 0008 sem desembolso nenhum,
 * e o painel passou a imprimir R$ 0,00 com a moldura de fato apurado
 * ("situação em 31/12 na ficha Bens e Direitos"). É o app afirmando fato falso,
 * e a direção do erro é a irreversível — custo subestimado vira ganho de
 * capital inflado na venda. Agrava: o ano-base 2025 já foi declarado pelo
 * contador com CRC **com o terreno dentro**.
 */
export const TERRENO_ZERO_NAO_E_NADA_PAGO =
  "R$ 0,00 aqui significa que nada foi registrado ainda — não que nada foi " +
  "pago. Enquanto o terreno não tiver desembolsos datados, esta linha " +
  "subestima a situação em 31/12 e não serve para a declaração.";

/**
 * Critério 15 + parecer §4 — o saldo devedor é **exigido**, e não tem default.
 *
 * Campo em branco valendo zero é o defeito que o `CLAUDE.md` proíbe em campo
 * fiscal: "Saldo devedor em 31/12: R$ 0,00" lido literalmente diz
 * **financiamento quitado**. As sete rubricas podem vir em branco porque a
 * trava da soma as confere contra o total pago; o saldo devedor não participa
 * de soma nenhuma e por isso **nada o confere** — só a pergunta.
 */
export const SALDO_DEVEDOR_OBRIGATORIO =
  "Informe o saldo devedor em 31/12 — ele está no extrato. Não entra em soma " +
  "nenhuma, mas é ele que fecha a conta de quem lê a declaração: pago + saldo " +
  "devedor = preço contratado.";

// ── Quais desembolsos cada natureza admite (critérios 2 e 14) ────────────

/**
 * A natureza da aquisição **decide qual regra roda** (critério 2), e aqui ela
 * decide quais tipos de desembolso existem.
 *
 * ⚠️ Isto é a **porta lateral da dupla contagem**. A trava do critério 14 é
 * estrutural — não existe tipo "parcela do financiamento" —, mas ela só protege
 * o tipo que nomeia: numa obra `financiado`, oferecer "Parcela ao vendedor" ou
 * "Pagamento do terreno" convida a registrar o débito mensal do banco sob um
 * rótulo vizinho, e aí o mesmo dinheiro entra duas vezes (informe + linha
 * avulsa) sem nada acusar.
 *
 * **Natureza desconhecida (`null`) devolve a lista cheia**: o app não inventa
 * restrição sobre fato que não sabe — a pendência de complemento já pede a
 * resposta, e ela não bloqueia nada (critério 23).
 */
export function tiposDeDesembolsoPara(
  natureza: NaturezaAquisicaoTerreno | null,
): TipoDesembolsoTerreno[] {
  const todos: TipoDesembolsoTerreno[] = [
    "pagamento_terreno",
    "entrada",
    "itbi",
    "escritura_registro",
    "parcela_vendedor",
    "quitacao",
  ];
  if (natureza === null) return todos;
  return todos.filter((tipo) => {
    // Parcela ao vendedor só existe onde há vendedor parcelando (parecer §2b).
    if (tipo === "parcela_vendedor") return natureza === "parcelado_vendedor";
    // Quitação do financiamento só existe onde há financiamento. Ela é o
    // desembolso do ano da venda (parecer: "financiar não amputa o custo").
    if (tipo === "quitacao") return natureza === "financiado";
    // Pagamento do terreno é o desembolso do preço direto ao vendedor — no
    // financiado quem paga o preço ao vendedor é o banco, e o que sai do bolso
    // dele é entrada + parcelas, que vêm pelo informe anual.
    if (tipo === "pagamento_terreno") return natureza !== "financiado";
    return true;
  });
}

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

// ══ CONTAI-027 rodada 2 · N papéis por desembolso ═══════════════════════
//
// Fonte: docs/pareceres/2026-08-21-gate-fiscal-contai-027-criterio-13.md
// (§4a, §4b, §4d, §6 e §7) e docs/tickets/CONTAI-027.md (critérios 9b a 16).
//
// ⚠️ **O critério 13 está CORTADO** (§3 do parecer): nada aqui bloqueia saída
// nenhuma, e não existe função de bloqueio para ser chamada. A pendência é
// INFORMAÇÃO indispensável, nunca trava — "pendência sem fato de baixa é
// informação, nunca trava. Trava sem baixa não coleta o fato que falta:
// coleta a resposta que destrava."
//
// ⚠️ **Módulo puro, e sem `Date.now()`**: a re-pergunta compara duas marcas
// que vêm do BANCO (`respondidoEm` × `createdAt` do anexo). Nenhuma decisão
// daqui depende do relógio do aparelho.

/** Critério 14 / §7 — o rótulo em tela de cada papel. Sem default nenhum. */
export const ROTULO_DO_PAPEL: Record<PapelDeAnexo, string> = {
  comprovante: "Comprovante do pagamento",
  nota: "Nota ou recibo",
  contrato: "Contrato ou escritura",
};

/**
 * A ordem em que os três se oferecem, e ela não é alfabética: é a do mock
 * aprovado — o dinheiro saiu · o que eu comprei · o que eu combinei.
 */
export const PAPEIS_DE_ANEXO: readonly PapelDeAnexo[] = [
  "comprovante",
  "nota",
  "contrato",
];

/**
 * **Critério 15** — "pago, e sem papel nenhum" continua VISÍVEL depois de a
 * coluna `arquivo_path` morrer.
 *
 * ⚠️ Esta função **substitui `arquivoPath === null` em todo consumidor**, e a
 * substituição é o critério inteiro: sem ela, a migration apagaria a dívida
 * junto com a coluna e o buraco no acervo só apareceria em 2034. `previsto`
 * fica de fora porque não há o que anexar a um pagamento que não aconteceu.
 */
export function pagoSemPapel(d: TerrenoDesembolso): boolean {
  return d.estado === "pago" && d.anexos.length === 0;
}

/** Os anexos marcados como comprovante — os únicos que o §6 conta. */
export function comprovantesDe(
  d: TerrenoDesembolso,
): TerrenoDesembolsoAnexo[] {
  return d.anexos.filter((a) => a.papel === "comprovante");
}

/**
 * **CONTAI-025, critério 8 — o PORTÃO do custo confirmado.**
 *
 * Fonte: §2.1 do parecer de 23/08 (*"soma apenas desembolso pago, com data e
 * com comprovante"*). O §4.3 **corrobora pelo fato** (*"a escritura prova o
 * preço, não o pagamento"*) e **não define o portão** — atribuir a regra a ele
 * é a D46 na forma inversa.
 *
 * ⚠️ **NÃO reaproveite `pagoSemPapel` aqui, e a diferença é o caso do
 * Mateus.** `pagoSemPapel` é `anexos.length === 0`; este portão é
 * `comprovantesDe().length > 0`, e o primeiro é **subconjunto estrito** do
 * segundo. Um desembolso com a escritura anexada e nenhum comprovante tem
 * papel e **não** tem prova do pagamento: trocar um predicado pelo outro por
 * dentro reintroduz a **D49 invertida** — o registro passa a somar custo não
 * demonstrável em silêncio, que é a direção cara (D34).
 */
export function temComprovante(d: TerrenoDesembolso): boolean {
  return comprovantesDe(d).length > 0;
}

/**
 * **Critério 9/11** — o desembolso **pago** que não tem comprovante nenhum.
 *
 * É o conjunto que o portão exclui, e por isso ele é **um só card agregado**
 * (decisão 3 do mock v2): inclui o zero-anexo. Se o zero-anexo ficasse de
 * fora, os dois números deixariam de fechar com o que o portão exclui, e o
 * buraco não teria nome em tela nenhuma — pre-mortem 2 do ticket.
 *
 * A distinção entre *"tem papel, nenhum comprovante"* (§4.2) e *"pago, e sem
 * papel nenhum"* (`PAGO_SEM_PAPEL`, critério 15 do CONTAI-027) vive **na
 * linha**, com chip próprio: são **conjuntos diferentes**, mesmo fato fiscal.
 *
 * ⚠️ Inclui os **sem data**: o dinheiro saiu e não há comprovante — as duas
 * faltas são independentes e coexistem (§1.4.2).
 */
export function pagoSemComprovante(d: TerrenoDesembolso): boolean {
  return d.estado === "pago" && !temComprovante(d);
}

/** Os pagos sem comprovante da obra inteira — agregado, não por ano. */
export function pagosSemComprovante(
  desembolsos: readonly TerrenoDesembolso[],
): TerrenoDesembolso[] {
  return desembolsos.filter(pagoSemComprovante);
}

/** Quanto está fora do custo confirmado por falta de comprovante, na obra. */
export function totalPagoSemComprovanteCentavos(
  desembolsos: readonly TerrenoDesembolso[],
): number {
  return pagosSemComprovante(desembolsos).reduce(
    (s, d) => s + d.valorCentavos,
    0,
  );
}

/**
 * A pendência **"Um lançamento, mais de uma data"** está aberta?
 *
 * ⚠️ É exatamente `debitosMesmoDia === false`, e nada mais. Ela **não tem
 * baixa no app** (§5): o fato que a fecharia é o valor deste lançamento passar
 * a corresponder a um único dia, e o app não corrige valor de desembolso já
 * gravado. Não invente critério de baixa — "pendência fiscal baixada por
 * declaração de intenção é o campo preenchido que afirma o que ninguém
 * conferiu, com um botão na frente".
 */
export function pendenciaDeDatasAberta(d: TerrenoDesembolso): boolean {
  return d.debitosMesmoDia === false;
}

/**
 * O lançamento tem fato novo que a resposta vigente não cobre?
 *
 * §6, terceira linha: *"dispara DE NOVO se a resposta vigente era 'tudo no dia
 * X' e chega comprovante novo — o fato mudou, e o app não carrega adiante um
 * 'sim' que não sustenta mais"*.
 *
 * Comparação de duas marcas do banco, `>` estrito: o comprovante gravado no
 * MESMO ato da resposta não é fato novo (a gravação insere as filhas e só
 * então carimba `respondidoEm`).
 */
function chegouComprovanteDepoisDaResposta(d: TerrenoDesembolso): boolean {
  if (d.debitosMesmoDiaRespondidoEm === null) return false;
  const respondidoEm = d.debitosMesmoDiaRespondidoEm;
  return comprovantesDe(d).some((a) => a.createdAt > respondidoEm);
}

/**
 * O lançamento passou a ter DOIS papéis `comprovante`? É a condição do §6 —
 * **por papel, nunca por contagem de arquivos**.
 *
 * Comprovante + recibo são dois papéis e UM débito: perguntar ali é pergunta
 * de resposta óbvia, e *"pergunta óbvia treina o clique automático que esvazia
 * a pergunta que importa"*. Com o bloqueio do critério 13 fora, a pergunta é a
 * defesa principal — gastá-la em caso trivial é caro.
 */
export function temDoisComprovantes(d: TerrenoDesembolso): boolean {
  return comprovantesDe(d).length >= 2;
}

/**
 * A pergunta do critério 12 **deve ser feita agora**?
 *
 * A tabela do §6, inteira, derivada — nenhuma linha nova em `pendencia`:
 * - ✅ dispara com dois papéis `comprovante`, no mesmo ato ou dias depois;
 * - ✅ dispara de novo se a resposta vigente era "sim" e chegou comprovante
 *   novo;
 * - ❌ nunca por `nota` nem `contrato`;
 * - ❌ não, se a pendência já está aberta (`debitosMesmoDia === false`) — ele
 *   já respondeu;
 * - ❌ **represada** enquanto não houver data (ver `perguntaRepresada`).
 */
export function perguntaPendente(d: TerrenoDesembolso): boolean {
  if (d.dataPagamento === null) return false;
  if (!temDoisComprovantes(d)) return false;
  if (d.debitosMesmoDia === false) return false;
  if (d.debitosMesmoDia === null) return true;
  return chegouComprovanteDepoisDaResposta(d);
}

/**
 * As mesmas condições, **sem data**: a pergunta existe e não pode ser feita.
 *
 * §6: *"a pergunta cita a data no próprio botão — sem data, ela é
 * impronunciável. E não há o que proteger: sem data não há ano-calendário, e a
 * pendência 'falta a data' já cobre o defeito, com precedência. As duas nunca
 * aparecem juntas no mesmo desembolso."* Quando a data entra (por
 * `completarDesembolsoTerreno`), a represa abre e a pergunta dispara no mesmo
 * ato.
 */
export function perguntaRepresada(d: TerrenoDesembolso): boolean {
  if (d.dataPagamento !== null) return false;
  return temDoisComprovantes(d);
}

/**
 * **A pergunta dispara NESTE ATO de registro?** (formulário de desembolso
 * novo, mock tela 2.)
 *
 * Não há pai gravado para consultar: o que existe é a data que ele acabou de
 * digitar e os papéis que ele acabou de marcar. A régua é a mesma do §6 —
 * **dois papéis `comprovante`** —, e a represa também: sem data, nada é
 * perguntado. Um comprovante + um recibo **não** perguntam.
 */
export function perguntaNoRegistro(
  dataPagamento: string | null,
  comprovantesEscolhidos: number,
): boolean {
  if (dataPagamento === null || dataPagamento === "") return false;
  return comprovantesEscolhidos >= 2;
}

/**
 * **A pergunta dispara NESTE ATO de complemento?** (completar a data, ou
 * anexar o papel que chegou depois — critério 9b, mock telas 2d e 1c.)
 *
 * Junta o que já está gravado com o que está sendo acrescentado agora:
 *
 * - `dataDoAto` é a data que o lançamento **terá depois deste ato** — a que já
 *   estava, ou a que ele está digitando. É isso que abre a represa "no mesmo
 *   ato" (§6, última linha).
 * - `comprovantesNovos` conta PAPEL, não arquivo.
 * - pendência já aberta não repergunta: ele já respondeu.
 * - resposta vigente "tudo no dia X" só é reperguntada quando há comprovante
 *   novo — no ato, ou já gravado depois da resposta (`perguntaPendente`).
 */
export function perguntaNoComplemento(
  d: TerrenoDesembolso,
  comprovantesNovos: number,
  dataDoAto: string | null,
): boolean {
  if (dataDoAto === null || dataDoAto === "") return false;
  if (pendenciaDeDatasAberta(d)) return false;
  const total = comprovantesDe(d).length + comprovantesNovos;
  if (total < 2) return false;
  if (d.debitosMesmoDia === null) return true;
  return comprovantesNovos > 0 || perguntaPendente(d);
}

// ── Os textos do critério 12 (CÓPIA literal do §4a do parecer) ──────────

/** §4a — o título. Obrigatória, sem default e sem pré-seleção. */
export const PERGUNTA_QUANDO_SAIU = "Quando esse dinheiro saiu da sua conta?";

/** §4a — a primeira opção. `[data]` é substituição do app (dd/mm/aaaa). */
export function opcaoTudoEm(dataBR: string): string {
  return `Tudo em ${dataBR}`;
}

/** §4a — a segunda opção. Mesmo peso visual da primeira. */
export const OPCAO_MAIS_DE_UM_DIA = "Em mais de um dia";

/**
 * §4a — a consequência, em âmbar, **abaixo** das opções.
 *
 * ⚠️ **Ela não lidera pela punição, e isso é decisão, não estilo**: *"frase
 * que começa pelo castigo ensina a responder o que escapa dele — e, com o
 * bloqueio fora, a qualidade dessa resposta é a única defesa que sobrou."*
 * Não reescreva para "começar pelo importante".
 */
export const CONSEQUENCIA_DA_DATA_COLAPSADA =
  "Cada dia em que o dinheiro saiu é um pagamento com a sua própria data — e " +
  "é a data que decide em que ano o custo entra. Se foi em mais de um dia, o " +
  "registro é gravado do mesmo jeito e fica uma pendência.";

/** §4a — a nota de apoio. */
export const NAO_E_RETRABALHO =
  "Não é retrabalho: dois débitos em dias diferentes são dois fatos, e o app " +
  "não tem como saber quanto foi em cada dia — nem deve fingir que tem.";

// ── Os textos da pendência (CÓPIA literal do §4b do parecer) ────────────

/**
 * §4b — o chip/título, em **VERMELHO**.
 *
 * ⚠️ A cor é decisão do `po` (D39, 21/08), e ele mudou a regra para escrevê-la:
 * *"vermelho = fato consumado com consequência fiscal aberta; âmbar = nada
 * saiu ainda"*. O `contador` havia proposto âmbar olhando o acervo (que está
 * completo) e **não disputa** a régua da consequência fiscal, que está aberta.
 */
export const PENDENCIA_MAIS_DE_UMA_DATA = "Um lançamento, mais de uma data";

/** §4b — o corpo. `[valor]` é substituição do app. */
export function corpoDaPendenciaDeDatas(valorCentavos: number): string {
  return (
    "Você respondeu que o dinheiro saiu em mais de um dia, e este lançamento " +
    `tem ${formatarBRL(valorCentavos)} numa data só. É a data do pagamento ` +
    "que decide o ano do custo."
  );
}

/**
 * §4b — **a segunda metade da ação nomeada. Ela existe, e não é opcional.**
 *
 * ⚠️ Cumprir só a primeira metade — registrar os lançamentos separados sem
 * corrigir o original — **soma o valor duas vezes** no custo do terreno. Custo
 * inflado em Bens e Direitos é **redução indevida de ganho de capital, cobrada
 * com multa**. Dos dois erros simétricos, esse é o caro: a data colapsada põe
 * custo no ano errado; a duplicação põe custo que não existe. *"Pendência que
 * nomeia meia ação induz o erro pior que a original."*
 *
 * Quem apagar esta frase da tela para "encurtar" está reintroduzindo o erro
 * caro.
 */
export function acaoDaPendenciaDeDatas(valorCentavos: number): string {
  const valor = formatarBRL(valorCentavos);
  return (
    "Ainda não dá para arrumar aqui: o app não corrige o valor de um " +
    "desembolso do terreno já gravado. Não registre os lançamentos separados " +
    `antes disso — enquanto este continuar com os ${valor}, os novos somam ` +
    "por cima e o custo do terreno fica maior do que foi."
  );
}

/** §4b — a saída, quando ela existir (ticket de correção de valor). */
export const SAIDA_QUANDO_A_CORRECAO_EXISTIR =
  "Quando a correção de valor existir: corrija este para o que saiu na " +
  "primeira data e registre um lançamento para cada uma das outras.";

/**
 * Critério 15 / mock tela 1c — "pago, e sem papel nenhum".
 *
 * O custo é real e SOMA no ano dele; o que falta é o lastro. Por isso a frase
 * não promete que o número está errado — ela diz que ele não é comprovável.
 */
export const PAGO_SEM_PAPEL =
  "Este valor está gravado como pago e não tem nenhum papel no acervo. O " +
  "custo é real, mas não é comprovável — e é você quem prova, não a memória.";

/**
 * Critério 9b / mock tela 2d — o papel que chega depois tem lugar, e ele é
 * ACRÉSCIMO.
 */
export const PAPEL_NOVO_E_ACRESCIMO =
  "Cada papel novo é acréscimo — nunca substituição, nunca remoção. Nada " +
  "sobe para o acervo enquanto você não gravar; depois de gravado, o acervo " +
  "só cresce.";

// ══ CONTAI-025 · gravar sem data, sem comprovante, ou sem os dois ═══════
//
// Fonte: docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md
// (⚠️ **ADENDO 1 vence o corpo**) e o mock v2 aprovado pelo Mateus em 23/08.
//
// ⚠️ **A trava de `anexos.length === 0` do formulário SAIU, e o comentário que
// a carimbava saiu com ela.** Ela nunca teve parecer (dívida D49): o texto que
// parecia justificá-la é de OUTRA entidade (o informe anual, onde o anexo é
// FONTE e a recusa fica de pé — §1.2 e §A.2). Aqui o anexo é PROVA de um fato
// que o Mateus conhece sem ele, e *"bloquear anexo-PROVA não evita erro
// nenhum: evita o registro"* (§A.0). O preço já foi pago — ele parou de usar o
// app e o banco de produção está vazio.
//
// Quem for mexer nestes textos: eles são CÓPIA do parecer, não redação.

/** §4.1 — o chip. O mesmo nas outras superfícies: nomeia o FATO fiscal. */
export const CHIP_PAGO_SEM_COMPROVANTE = "Pago sem comprovante";

/**
 * §4.2 — a pendência do desembolso do terreno, literal.
 *
 * ⚠️ **Não é o mesmo texto que `PAGO_SEM_PAPEL`, e os conjuntos são
 * diferentes**: lá é zero anexo (critério 15 do CONTAI-027), aqui é *"tem
 * papel, nenhum comprovante"*. Mesma exclusão da soma, buraco de acervo
 * diferente — e a diferença vive na consequência, não no chip (ADENDO 3 §G.3).
 */
export const PAGO_SEM_COMPROVANTE =
  "O valor e a data ficam registrados — o custo existe, ainda não está " +
  "demonstrável. Enquanto faltar o papel, este desembolso não entra no custo " +
  "confirmado. Recupere o comprovante enquanto o banco ainda o mostra: ele é " +
  "o documento do acervo que expira primeiro.";

/**
 * §4.3 — o que serve como comprovante, por tipo.
 *
 * ⚠️ **Aparece em DOIS lugares** (critério 12): junto da pendência **e no
 * momento de escolher o papel**. O segundo é o remédio de um defeito derivado
 * nomeado no Gate Fiscal §1: `ROTULO_DO_PAPEL.nota = "Nota ou recibo"` captura
 * o **recibo do vendedor**, que pelo §4.3 é comprovante de entrada — papel mal
 * escolhido põe desembolso legítimo fora do custo confirmado **em silêncio**.
 *
 * `[Likely]` quanto à reemissão pela prefeitura e pelo cartório: é prática
 * corrente, e o parecer manda **confirmar antes de prometer prazo** — por isso
 * o texto diz *"costuma"* e nenhuma tela promete prazo nenhum.
 */
export const COMPROVANTE_POR_TIPO: readonly {
  titulo: string;
  texto: string;
}[] = [
  {
    titulo: "Entrada ou sinal",
    texto:
      "comprovante da transferência, ou recibo do vendedor. A escritura prova " +
      "o preço, não o pagamento.",
  },
  {
    titulo: "ITBI",
    texto:
      "a guia paga, com a autenticação. A prefeitura costuma reemitir a " +
      "segunda via.",
  },
  {
    titulo: "Escritura e registro",
    texto: "o recibo de custas do cartório, que costuma reemitir.",
  },
];

/** O título da linha auxiliar quando ela acompanha a pendência. */
export const O_QUE_SERVE_COMO_COMPROVANTE =
  "O que serve como comprovante, por tipo";

/** O mesmo, no momento de escolher o papel — é ali que o erro nasce. */
export const ANTES_DE_DIZER_O_QUE_E_CADA_PAPEL =
  "Antes de dizer o que é cada papel — o que serve como comprovante, por tipo";

/**
 * O chip do estado combinado — **UM chip, e ele nomeia os DOIS fatos**
 * (mock v2, decisão de 23/08). Com os dois eixos em vermelho, dois chips lado
 * a lado viram mancha e o olho lê *um* problema borrado. A fusão é só de
 * APRESENTAÇÃO: a consequência continua sendo as duas frases do parecer.
 */
export const CHIP_FALTA_DATA_E_COMPROVANTE =
  "Pago — falta a data e o comprovante";

/**
 * Gate Fiscal §4 — o estado combinado, literal. **Uma** consequência, nunca
 * dois blocos empilhados, ordem **data → comprovante**: a data decide se entra
 * em algum ano; o comprovante, se o ano em que entrou é demonstrável.
 */
export const FALTA_DATA_E_COMPROVANTE =
  "Pago — falta a data e falta o comprovante. As duas faltas são " +
  "independentes e nenhuma delas apaga o registro. Sem a data, este valor não " +
  "tem ano-calendário e não entra em ano nenhum. Sem o comprovante, ele não " +
  "entra no custo confirmado nem no ano em que a data o puser.";

/**
 * A segunda frase do §4, e ela é **literal por adjudicação**: o que o parecer
 * de 21/08 decidiu é justamente **por onde começar**. Não a resuma.
 */
export const COMECE_PELA_DATA =
  "Comece pela data: ela está no extrato, no mesmo lugar em que o comprovante " +
  "está — as duas costumam voltar da mesma busca.";

/**
 * §4.5 — o rótulo do segundo número. **O mesmo na home e no relatório anual**
 * (decisão 1 do mock): texto de consequência fiscal se copia, e dois nomes
 * para o mesmo número é como nasce a D46.
 */
export const FORA_DO_CUSTO_CONFIRMADO =
  "Fora do custo confirmado por falta de comprovante";

/**
 * §4.5, **primeira metade** — o FATO. É o que a home mostra, e o corte ali é o
 * do mock aprovado: a home nomeia o número, não instrui sobre a declaração.
 */
export const FORA_DO_CUSTO_CONFIRMADO_PORQUE =
  "Foi pago e está registrado, mas ainda não tem o papel que o demonstra, e " +
  "por isso não entra na soma acima.";

/**
 * §4.5, **segunda metade** — e ela é a **metade NÃO AUTOMÁTICA do §2.1**: o
 * handoff ao profissional com CRC.
 *
 * ⚠️ **Constante separada de propósito, e a separação é fiscal.** A home usa
 * só a primeira metade (mock aprovado); o **relatório anual** (critério 17,
 * fatia 2) precisa das duas. Reusar `FORA_DO_CUSTO_CONFIRMADO_PORQUE` sozinha
 * lá **dropa o handoff em silêncio** — e é exatamente aí que ele importa: o
 * §2.1 diz que *"omitir o valor da discriminação da DAA não é decisão do
 * app"*. O app mostra os dois números e **nomeia a escolha como do Mateus com
 * o CRC**; escolher calado, para cima ou para baixo, é o que o parecer proíbe.
 *
 * ⚠️ **Nome diz onde mora**: quem a colar na home está mudando o mock.
 */
export const FORA_DO_CUSTO_CONFIRMADO_DECIDA_NO_RELATORIO =
  "Decida com seu contador antes de declarar: deixar de discriminar na " +
  "declaração um custo real também custa caro — o custo que não é " +
  "discriminado não existe na venda.";

/**
 * ⚠️ **O §4.5 INTEIRO — a linha do relatório anual** (CONTAI-036, critérios 4
 * e 5). É **a única** montagem autorizada das três constantes, e a ordem é
 * fiscal, não estética:
 *
 *     FORA_DO_CUSTO_CONFIRMADO + valor · _PORQUE · _DECIDA_NO_RELATORIO
 *
 * A terceira é a **metade não automática do §2.1** — o handoff ao profissional
 * com CRC. Montar a linha à mão com as duas primeiras **dropa o handoff em
 * silêncio**, e é exatamente onde ele importa: o §2.1 diz que *"omitir o valor
 * da discriminação da DAA não é decisão do app"*.
 *
 * ⚠️ **Fora do bloco copiável, imediatamente abaixo dele** (decisão de design
 * 5 do mock, Gate Fiscal §3): dentro do bloco é texto de declaração; o §4.5 é
 * orientação, e colá-lo na ficha seria o app escrevendo na DAA uma frase que
 * não é do contribuinte. *"Logo abaixo do total"* fica atendido — o total é a
 * última linha do bloco.
 */
export function linhaForaDoCustoConfirmado(valorCentavos: number): string {
  return (
    `${FORA_DO_CUSTO_CONFIRMADO}: ${formatarBRL(valorCentavos)}. ` +
    `${FORA_DO_CUSTO_CONFIRMADO_PORQUE} ` +
    FORA_DO_CUSTO_CONFIRMADO_DECIDA_NO_RELATORIO
  );
}

/**
 * Card do ano (mock tela 1): o desembolso **sem data** está fora do card
 * inteiro, e isso é dito. Número que não bate sem explicação é pior que
 * número ausente.
 */
export function foraDesteCardPorFaltaDeData(valorCentavos: number): string {
  return (
    `Um valor de ${formatarBRL(valorCentavos)} está fora deste card inteiro: ` +
    "sem data, ele não tem ano-calendário e não entra em ano nenhum. Ele " +
    "aparece no card da pendência, que é da obra e não do ano."
  );
}

/**
 * Data no futuro — a única recusa de data que sobrou, e ela **mudou de
 * redação no Gate 2 do CONTAI-025**. Texto do `contador`, literal.
 *
 * ⚠️ **O defeito que a redação anterior ganhou quando o campo vazio passou a
 * gravar.** Ela dizia apenas *"se ainda não saiu da conta, registre como
 * 'ainda não paguei'"* — e oferecia **só** a saída que apaga o custo de
 * **todo** ano-calendário. Antes, o erro provável era o de quem ainda não
 * pagou; agora que a ausência de data é gravável, o erro mais provável é
 * **data errada num pagamento real**, e para esse caso `previsto` é a saída
 * pior que existe (§1.4.1).
 *
 * ⚠️ Isto **não** viola o critério 6: aqui o próprio dado diz que o dinheiro
 * não saiu (a data é posterior a hoje) — é contradição interna, não escape da
 * trava. O que o texto passa a fazer é oferecer as três saídas na ordem certa:
 * corrigir · deixar vazio · e só então `previsto`, com a consequência dita.
 */
export const DATA_NO_FUTURO =
  "Data no futuro — o dinheiro não pode ter saído depois de hoje. Se você " +
  "errou a data, corrija-a; se não lembra, deixe o campo vazio: o valor grava " +
  "assim mesmo e a data fica como pendência. Só marque 'ainda não paguei' se " +
  "o dinheiro realmente não saiu — isso tira este valor de todo " +
  "ano-calendário.";

/**
 * Data no futuro **no complemento** — quando ele está informando a data de um
 * desembolso que já nasceu `pago`.
 *
 * ⚠️ **CONSTANTE PRÓPRIA, e não `DATA_NO_FUTURO` reaproveitada.** Palavras do
 * `contador`: *"são dois atos diferentes, e colapsar os dois textos é o que
 * faria o 'deixe vazio' aparecer onde não cabe"*. No registro, deixar o campo
 * vazio **grava** e abre a pendência; aqui o ato **existe para informar a
 * data** — "deixe vazio" seria mandar não fazer o que ele veio fazer.
 *
 * ⚠️ **A saída segura é OUTRA, e ela precisava ser nomeada: sair sem gravar.**
 * A pendência continua aberta e nada se perde. O texto anterior
 * (*"informe a data real do pagamento"*) não a nomeava — mandava acertar sem
 * dizer o que fazer quem não sabe.
 *
 * ⚠️ E ele **não oferece `previsto`** (critério 6): quem completa a data já
 * disse que pagou. Oferecer `previsto` aqui tiraria o valor de todo
 * ano-calendário — é a fuga que o §1.4.1 proíbe, sem a contradição interna que
 * justifica a menção em `DATA_NO_FUTURO`.
 *
 * Economizar uma constante aqui criaria o segundo caminho para textos que
 * precisam **divergir** — a D46 com outro rosto.
 */
export const DATA_NO_FUTURO_NO_COMPLEMENTO =
  "Data no futuro — o dinheiro não pode ter saído depois de hoje. Confira a " +
  "data no extrato: é ela que decide o ano-calendário deste custo. Se não " +
  "achar agora, saia sem gravar — a pendência continua aberta e nada se perde.";

// ── Os quatro rótulos do Gravar (Gate Fiscal §4) ─────────────────────────
//
// ⚠️ **O rótulo NOMEIA A CONSEQUÊNCIA — nunca "gravar mesmo assim".** O botão
// grava sempre; o que muda é o estado que nasce (ADENDO 2 §5 de 18/08).

/** Data e comprovante presentes: nada nasce pendente. */
export const GRAVAR_O_DESEMBOLSO = "Gravar o desembolso";

/** Tem data, falta o comprovante. */
export const GRAVAR_E_ABRIR_A_PENDENCIA_DO_COMPROVANTE =
  "Gravar — e abrir a pendência do comprovante";

/**
 * Tem comprovante, falta a data. **Adjudicado pelo `contador` em 23/08**, e o
 * *"que falta"* não é enfeite:
 *
 * ⚠️ **O `contador` recusou a simetria óbvia** (*"a pendência da data"*), e a
 * razão é a D46 com outro nome: *"'da data' vs 'de datas' faz uma distinção
 * fiscal real depender de uma letra, no mesmo botão, no mesmo formulário"* — o
 * estado `PENDENCIA_MAIS_DE_UMA_DATA` do CONTAI-027 nasce de uma resposta
 * **nesta mesma tela**. O singular/plural não pode carregar a distinção: a
 * **palavra** tem que carregar. *"Que falta"* nomeia a consequência do §1.4.2
 * (`DESEMBOLSO_SEM_DATA` — valor sem ano-calendário) e a separa de *"mais de
 * uma data"* (valor NO custo, só o ano em aberto), que é fato mais brando.
 *
 * ⚠️ **Não alinhe o rótulo do CONTAI-027 a este.** Ele está em mock aprovado e
 * em código; o `contador` reconheceu a ambiguidade e a correção é **ticket P2
 * próprio**, que não bloqueia este.
 */
export const GRAVAR_E_ABRIR_A_PENDENCIA_DA_DATA =
  "Gravar — e abrir a pendência da data que falta";

/** Faltam os dois. */
export const GRAVAR_E_ABRIR_AS_DUAS_PENDENCIAS =
  "Gravar — e abrir as duas pendências";

/** `previsto` — não há data nem papel a exigir: nada foi pago. */
export const GRAVAR_O_COMPROMISSO = "Gravar o compromisso";

/** O botão antes de o desembolso estar preenchido. */
export const PREENCHA_O_DESEMBOLSO = "Preencha o desembolso para gravar";

/**
 * Critério 5/14 — **zero papel grava; papel sem classificação, não.** O rótulo
 * diz qual falta: botão cinza mudo faz achar que quebrou (decisão 8 do mock).
 */
export function digaOQueECadaPapel(semResposta: number): string {
  return semResposta === 1
    ? "Diga o que é o papel que falta para gravar"
    : `Diga o que é cada papel para gravar (${semResposta} sem resposta)`;
}

export interface EstadoDoGravar {
  rotulo: string;
  habilitado: boolean;
}

/**
 * O rótulo e o estado do botão Gravar — **as quatro combinações do critério 2**
 * e os dois casos em que o botão ainda não pode gravar.
 *
 * ⚠️ **A ausência de data ou de comprovante NUNCA desabilita o botão.** O que
 * desabilita é (a) o desembolso não estar preenchido e (b) papel escolhido sem
 * `papel` respondido (critério 14 do CONTAI-027, intocado). Confundir os dois
 * é reinstalar a trava com rótulo novo.
 */
export function estadoDoGravar(e: {
  /** tipo, valor e estado escolhidos. */
  preenchido: boolean;
  estado: "pago" | "previsto" | null;
  /** Quantos papéis escolhidos ainda estão sem `papel` respondido. */
  papeisSemResposta: number;
  temData: boolean;
  temComprovante: boolean;
}): EstadoDoGravar {
  if (!e.preenchido) {
    return { rotulo: PREENCHA_O_DESEMBOLSO, habilitado: false };
  }
  if (e.papeisSemResposta > 0) {
    return {
      rotulo: digaOQueECadaPapel(e.papeisSemResposta),
      habilitado: false,
    };
  }
  if (e.estado === "previsto") {
    return { rotulo: GRAVAR_O_COMPROMISSO, habilitado: true };
  }
  if (e.temData && e.temComprovante) {
    return { rotulo: GRAVAR_O_DESEMBOLSO, habilitado: true };
  }
  if (e.temData) {
    return {
      rotulo: GRAVAR_E_ABRIR_A_PENDENCIA_DO_COMPROVANTE,
      habilitado: true,
    };
  }
  if (e.temComprovante) {
    return { rotulo: GRAVAR_E_ABRIR_A_PENDENCIA_DA_DATA, habilitado: true };
  }
  return { rotulo: GRAVAR_E_ABRIR_AS_DUAS_PENDENCIAS, habilitado: true };
}

// ── Critério 13 · a mensagem de sucesso não pode mentir ──────────────────

/**
 * Gate Fiscal §5 — **dois textos, por caso**.
 *
 * ⚠️ O defeito que isto conserta: a mensagem era escolhida **só por
 * `faltaData`** e ignorava o comprovante, afirmando que *"o valor passa a
 * compor o custo de {ano}"* quando ele **não passa** — o portão do critério 8
 * o mantém fora. Mensagem de sucesso que mente sobre consequência fiscal é
 * pior que mensagem nenhuma: ela fecha a pendência na cabeça do Mateus.
 */
export function dataInformada(ano: string, temComprovanteAgora: boolean): string {
  return temComprovanteAgora
    ? `Data informada — o valor passa a compor o custo de ${ano}.`
    : `Data informada — o valor é de ${ano}. Falta o comprovante: até ele ` +
        "chegar, este desembolso não entra no custo confirmado.";
}

/**
 * A mensagem de sucesso do REGISTRO, nas quatro combinações do critério 2.
 *
 * ⚠️ **Composta de fragmentos ADJUDICADOS, não redigida**: *"o valor é de
 * {ano}. Falta o comprovante: até ele chegar, este desembolso não entra no
 * custo confirmado"* é literal do §5; *"sem a data, este valor não tem
 * ano-calendário e a discriminação não pode ser gerada"* é o
 * `DESEMBOLSO_SEM_DATA` do critério 23. Nenhuma frase nova afirma consequência
 * fiscal aqui.
 *
 * `ano` vem `null` quando a data ficou vazia — e isso é estado legítimo, não
 * erro.
 */
export function desembolsoRegistrado(
  nome: string,
  ano: string | null,
  temComprovanteAgora: boolean,
): string {
  const semComprovante =
    " Falta o comprovante: até ele chegar, este desembolso não entra no " +
    "custo confirmado.";
  if (ano === null) {
    return (
      `${nome} registrado — ${DESEMBOLSO_SEM_DATA}.` +
      (temComprovanteAgora ? "" : semComprovante)
    );
  }
  return temComprovanteAgora
    ? `${nome} registrado no custo de ${ano}.`
    : `${nome} registrado — o valor é de ${ano}.${semComprovante}`;
}

// ══ Critério 16 · A GUARDA DA FATIA 2 — CUMPRIDA E RECOLHIDA ═══════════
//
// ⚠️ **`bloqueioDaSaidaAnual` e `motivoDoBloqueioDaSaidaAnual` moravam aqui, e
// saíram no CONTAI-036 (critério 8) — de propósito, não por limpeza.**
//
// Elas eram **temporárias por desenho**: existiam para impedir que a
// discriminação saísse com um total que não dissesse o que deixou de fora,
// enquanto a linha do §4.5 não existisse no relatório. A fatia 2 escreveu essa
// linha, e a guarda perdeu o objeto.
//
// ⛔ **Isto NÃO é a guarda apagada.** Ela não sumiu: virou **obrigação
// tipada**, em `lib/fiscal/compromisso.ts`. A porta única
// (`podeGerarRelatorioAnual`) devolve o número do §4.5 **dentro da marca de
// `bensEDireitos`**, e quem não passa pela porta não tem o dado para gerar a
// ficha. Pre-mortem 1 do CONTAI-036, por extenso lá.
//
// O que ficou aqui é o que a home também usa e nunca foi da guarda:
// `pagosSemComprovante` e `totalPagoSemComprovanteCentavos` — o agregado da
// obra, que a porta agora lê.
