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

/**
 * **A ressalva que viaja junto** — texto do CONTAI-022 que estava inline em
 * `/adicionar/compra-cartao` e que o CONTAI-084 passou a precisar na
 * confirmação do lote (critério 18: *"texto verbatim de
 * `compra-cartao/page.tsx`"*).
 *
 * ⚠️ Constante, e não uma segunda cópia da frase: é a mesma razão escrita em
 * `EXTRATO_DA_FATURA_AJUDA` mais abaixo — texto fiscal duplicado é como nasce a
 * D46, o mesmo fato com dois rostos. As duas telas renderizam exatamente estes
 * bytes; o `<strong>` do título é markup, não texto.
 */
export const RESSALVA_ANO_DA_FATURA_TITULO = "Ressalva que viaja junto:";
export const RESSALVA_ANO_DA_FATURA =
  "a tese do ano do pagamento da fatura é defensável, não pacífica. Exige " +
  "confirmação de contador humano (CRC) antes da primeira declaração que a use.";

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

// ══ CONTAI-067 · o EXTRATO DA FATURA ════════════════════════════════════
//
// Fonte: `docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md`,
// **ADENDO** (requisito do extrato) e **ADENDO 2** (cor/gravidade). Todo texto
// abaixo é citação próxima do parecer — nada redigido de memória. Onde a redação
// é de produto (rótulo, CTA, alavanca), está marcado como tal.
//
// ⚠️ **O extrato não entra em apuração nenhuma.** `alocarCusto` e a aferição não
// o leem, e nada aqui soma, subtrai ou move ano-calendário. O que ele sustenta é
// a **composição** da fatura — quais compras estavam dentro dela —, e é por isso
// que a ausência dele é pendência, não cálculo.

/** Rótulo do campo, nas duas telas (critério 2 + spec de design, seção 1). */
export const EXTRATO_DA_FATURA_ROTULO = "Extrato da fatura (emitido pelo cartão)";

/**
 * Citação quase literal do ADENDO ("Requisito novo": *"o comprovante prova a
 * saída de caixa; o extrato prova a composição"*) somada à seção "Por que o
 * vínculo importa" (*"não prova a **composição** desse valor (quais compras
 * estão dentro)"*).
 *
 * ⚠️ Constante nomeada, e não texto inline: são DUAS telas (`/confirmar` e
 * `/fatura/[id]`) mostrando a mesma ajuda, e texto fiscal duplicado é como nasce
 * a D46 — o mesmo fato com dois rostos.
 */
export const EXTRATO_DA_FATURA_AJUDA =
  "O comprovante prova a saída de caixa; o extrato prova a composição — " +
  "quais compras estavam dentro dela.";

/** O chip da pendência, e o título do Card em `/fatura/[id]` (spec, seção 2b). */
export const CHIP_FATURA_SEM_EXTRATO = "Fatura sem extrato";

/**
 * **VERMELHO**, adjudicado pelo `contador` no ADENDO 2, seção "Veredito", pela
 * régua do A.4 (`docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`):
 * *"saiu? → tem apoio hábil no ano certo? → não = vermelho"*.
 *
 * - **Saiu?** Sim — o desembolso da fatura já existe.
 * - **Tem apoio hábil no ano certo?** **Não** — qual fatura cobrou qual compra é
 *   o que decide o ano-calendário do gasto, e hoje essa associação é só o campo
 *   que o Mateus digita.
 *
 * ⚠️ **Não passa por `gravidadeDaRegua`**, como as outras oito famílias de cor
 * declarada: a `Gravidade` branded existe para impedir pendência nova de chutar
 * cor, e aqui a cor não é chutada — é adjudicação transcrita do parecer. Declarar
 * `dinheiroSaiu`/`apoioHabilNoAnoCerto` para forçá-la pela função seria fabricar
 * o fato fiscal a partir da conclusão (o motivo escrito por extenso em
 * `pendencias-unificadas.ts`).
 *
 * ⚠️ **Distinta do âmbar do Estado C** do ADENDO 4 de
 * `2026-09-18-retencao-variavel-servico-pj.md`: lá o custo já está sustentado no
 * valor e no ano certo e falta ação futura de um TERCEIRO; aqui a lacuna é na
 * documentação hábil do próprio Mateus para fixar o ano.
 */
export const COR_FATURA_SEM_EXTRATO = "red" as const;

/**
 * O que falta e o que isso custa — citação do ADENDO 1 ("Por que o vínculo
 * importa") + ADENDO 2 ("Nuance para o `cto-obra`"), no vocabulário do próprio
 * parecer ("apoio hábil", "ano-calendário certo", "Bens e Direitos").
 */
export const FATURA_SEM_EXTRATO_EFEITO =
  "Você já pagou esta fatura, mas não tem o documento da administradora que " +
  "prova quais compras estavam dentro dela — falta o apoio hábil que fixa o " +
  "ano-calendário certo dessas compras na ficha Bens e Direitos.";

/** O mesmo fato no plural, para o card agregado. Só a concordância muda. */
export const FATURA_SEM_EXTRATO_EFEITO_PLURAL =
  "Você já pagou estas faturas, mas não tem os documentos da administradora " +
  "que provam quais compras estavam dentro delas — falta o apoio hábil que " +
  "fixa o ano-calendário certo dessas compras na ficha Bens e Direitos.";

/**
 * A alavanca — **redação de produto**, não fiscal (paralela a
 * `NOTA_SEM_ARQUIVO_ALAVANCA`). Espelha o `[Guessing]` do ADENDO sobre extrato
 * de ciclo antigo genuinamente inobtível, sem prometer nem proibir nada: é aviso
 * de janela que fecha, igual ao par de "Nota sem arquivo".
 *
 * ⚠️ **CONDICIONAL, e a forma é exigência do Gate 2** (`contador`, 2026-09-26).
 * A redação anterior — *"bancos costumam guardar poucos ciclos no aplicativo"* —
 * afirmava como FATO o que o parecer registrou como `[Guessing]`: o ADENDO diz
 * que o extrato de ciclo antigo **pode** não estar disponível em autoatendimento
 * "em todo banco/administradora", e não que costume não estar. Texto de tela que
 * sobe o grau de certeza de um parecer é a mesma falha que a regra "copia, não
 * reescreve" existe para impedir — só que para cima.
 */
export const FATURA_SEM_EXTRATO_ALAVANCA =
  "Peça o extrato à administradora do cartão: nem todo banco disponibiliza " +
  "extrato de ciclo antigo no aplicativo — quanto antes pedir, mais fácil " +
  "obter.";

/**
 * **O escopo do NÃO-veto, e esta frase é obrigatória onde a cor vermelha
 * aparece** (Gate Fiscal item 4 do ticket + ADENDO 2, "Nuance para o
 * `cto-obra`").
 *
 * ⚠️ Ela é o **oposto** da frase de veto de `CardDocumentosSemArquivo` ("nenhuma
 * saída anual é gerada"), e a diferença é fiscal, não de estilo: lá falta o
 * documento hábil da despesa em si, e as TRÊS saídas caem; aqui a despesa está
 * provada item a item pelas NFs, compra no cartão não é mão de obra, e o que
 * fica em risco é só a discriminação do ano-calendário em Bens e Direitos.
 * Omitir esta frase deixaria o Mateus inferir, pela semelhança visual com o card
 * vermelho vizinho, um veto que o Gate Fiscal explicitamente descartou.
 */
export const FATURA_SEM_EXTRATO_NAO_VETA =
  "Isso não trava a lista de Pagamentos Efetuados nem a posição da aferição " +
  "do INSS — compra no cartão não é mão de obra. O que fica em risco é o " +
  "ano-calendário certo do gasto na discriminação de Bens e Direitos.";

/**
 * **A regra, e ela tem DUAS condições — critério 14.**
 *
 * `desembolsos.length > 0` não é detalhe: fatura sem pagamento nenhum **não
 * cobra extrato**. O ciclo pode nem ter fechado, o dinheiro não saiu, e não há
 * ano-calendário a fixar — cobrar ali seria alarme sem consequência, que é como
 * se ensina a ignorar alarme.
 */
export function faltaOExtrato(
  fatura: Pick<Fatura, "desembolsos" | "extratoPath">,
): boolean {
  return fatura.desembolsos.length > 0 && fatura.extratoPath === null;
}

/**
 * O agregado da pendência, no mesmo molde de `DocumentosSemArquivo`
 * (`lib/fiscal/resumo.ts`): quantidade, dinheiro já saído sem apoio hábil que
 * fixe o ano, e o CTA só quando há UMA fatura para onde apontar.
 *
 * ⚠️ **`null` quando são várias**, e o corte é idêntico ao precedente do
 * `documentos_sem_arquivo` (decisão do `po` em 2026-09-19): não existe lista de
 * faturas no app, e criar uma é fricção de processo, não obrigação fiscal.
 */
export interface FaturaSemExtrato {
  quantidade: number;
  /** Σ do que já foi pago às faturas nesta condição. */
  totalCentavos: number;
  /** `/fatura/[id]` com uma só; `null` com mais de uma. */
  href: string | null;
}

/**
 * Deriva o agregado da lista de faturas da obra. **Derivado, nunca persistido** —
 * some sozinho quando o extrato chega, como o resto da fila unificada.
 *
 * ⚠️ **O valor é somado AQUI, e não em `pendencias-unificadas.ts`**: aquele
 * módulo registra por escrito que nenhum valor nasce nele. Quem sabe o que
 * significa "o que já foi pago a esta fatura" é `totalDesembolsadoCentavos`, que
 * mora neste arquivo desde o CONTAI-022.
 */
export function faturasSemExtrato(
  faturas: readonly Pick<Fatura, "id" | "desembolsos" | "extratoPath">[],
): FaturaSemExtrato | null {
  const semExtrato = faturas.filter(faltaOExtrato);
  if (semExtrato.length === 0) return null;
  return {
    quantidade: semExtrato.length,
    totalCentavos: semExtrato.reduce(
      (s, f) => s + totalDesembolsadoCentavos(f),
      0,
    ),
    href: semExtrato.length === 1 ? `/fatura/${semExtrato[0].id}` : null,
  };
}
