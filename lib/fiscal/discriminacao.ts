/**
 * DISCRIMINAÇÃO DE BENS E DIREITOS — a primeira saída anual do produto
 * (CONTAI-036). Módulo puro: nada de rede, nada de UI.
 *
 * ⚠️ **Este arquivo NÃO decide se a saída sai.** Quem decide é a porta única,
 * `podeGerarRelatorioAnual` (`lib/fiscal/compromisso.ts`), e o gerador daqui
 * **exige a marca** que só ela produz. Consumir o bloco de outra saída não
 * compila; montar a marca à mão exige um `as` explícito, que a blindagem de
 * `terreno.test.ts` procura.
 *
 * **Fontes normativas, e nenhuma frase daqui é redigida — todas são copiadas:**
 * - Bloco A: `docs/pareceres/2026-08-16-gate-fiscal-contai-004-005.md` §2
 * - primeira frase do Bloco A, terreno financiado:
 *   `docs/pareceres/2026-08-17-terreno-financiado.md` §4
 * - a linha do §4.5 e o handoff ao CRC:
 *   `docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md` §4.5, §2.1,
 *   §2.4 (ADENDO 1 vence o corpo)
 * - a cláusula material × mão de obra e a suspensão dela:
 *   `docs/pareceres/2026-08-24-composicao-material-mao-de-obra.md` §1, §4, §6
 *
 * ⚠️ **CONDIÇÃO ÚNICA do Gate Fiscal (§1): nenhum texto acopla POSSE ao
 * total.** Proibidos *"seu custo"*, *"você pagou"*, *"seu ganho"*. O bloco se
 * rotula **pelo bem e pela obra** — o valor cheio é número verdadeiro (foi o
 * que saiu pelo bem inteiro), e o que estaria errado é o RÓTULO, não a
 * ausência da linha da titularidade (que é a **D53**, ticket próprio). Há
 * teste varrendo todo texto exportado daqui atrás dessas três expressões.
 */

import type {
  Financiamento,
  FinanciamentoInforme,
  Obra,
  TerrenoDesembolso,
} from "@/lib/types";
import { formatarBRL } from "@/lib/money";
import type { LiberadoBensEDireitos } from "./compromisso";
import { formatarDataBR } from "./obra";
import { composicaoDoAno, notasSemClassificacaoDoAno } from "./revisao";
import {
  custoDoInformeCentavos,
  custoTerrenoAteOAno,
  linhaForaDoCustoConfirmado,
  temComprovante,
} from "./terreno";
import {
  custoComprovadoAteOAno,
  custoComprovadoDoAno,
  type Alocacao,
} from "./vinculo";

// ── Textos de tela, FORA do bloco copiável ───────────────────────────────

/**
 * ⚠️ **INCONDICIONAL — critério 6 do CONTAI-036, e é a alteração que o mock
 * aprovou em 24/08.** Antes ele só aparecia havendo lançamento fora da soma, e
 * isso ensinava a coisa errada: com tudo comprovado, o texto saía sem nada
 * dizendo que ele **não é a declaração**. Aviso que só aparece no caso ruim
 * vira selo de "está tudo certo" no caso bom.
 *
 * É o critério 19 do `CONTAI-010` chegando à tela.
 *
 * ⚠️ **Não afirma fato sobre matrícula, cônjuge ou quem paga** — não é a linha
 * da titularidade voltando por outro nome (D53).
 */
export const REVISE_ANTES_DE_COPIAR = "Revise antes de copiar";

export const REVISE_ANTES_DE_COPIAR_PORQUE =
  "Este texto é insumo para a sua conferência com o profissional com CRC — " +
  "não é a sua declaração pronta.";

/**
 * O aviso de cima do bloco. Havendo lançamento fora da soma, a contagem entra
 * **na primeira frase**, que é onde o mock aprovado a pôs — e não pendurada no
 * fim, depois do ponto final.
 */
export function reviseAntesDeCopiar(quantidadeForaDaSoma: number): string {
  if (quantidadeForaDaSoma === 0) {
    return `${REVISE_ANTES_DE_COPIAR}. ${REVISE_ANTES_DE_COPIAR_PORQUE}`;
  }
  const quantos =
    quantidadeForaDaSoma === 1
      ? "1 lançamento ficou de fora da soma"
      : `${quantidadeForaDaSoma} lançamentos ficaram de fora da soma`;
  return `${REVISE_ANTES_DE_COPIAR} — ${quantos}. ${REVISE_ANTES_DE_COPIAR_PORQUE}`;
}

/**
 * A ausência do **Bloco B** — identificação das notas (critério 3 e Out of
 * Scope do CONTAI-036, pre-mortem 2).
 *
 * ⚠️ **É NOMEADA, nunca placeholder vazio.** Bloco A saindo com cara de
 * completo é o defeito: quem copia não sabe que falta metade, e entrega texto
 * de declaração incompleto parecendo pronto.
 *
 * ⚠️ **O motivo mudou, e o ticket ficou desatualizado:** ele diz que o Bloco B
 * depende de `numero`/`data_emissao` do `CONTAI-004` — que **já está no ar**
 * (migration `0012`). O que falta não é o campo: é a atribuição conjunta
 * **pagamento × documento × ano**, que `alocarCusto` não produz (a repartição
 * do lado do documento é declarada *"sem efeito fiscal nenhum"*). Sem ela não
 * há como dizer *"pago R$ Y em [ano]"* por nota, que é a regra 2 do §2.
 */
export const BLOCO_B_NAO_GERADO =
  "A identificação das notas (Bloco B) não entra neste texto: o app ainda " +
  "não sabe dizer quanto de CADA nota foi pago dentro deste ano-calendário, " +
  "e um número desses escrito por aproximação vira divergência na venda. " +
  "O Bloco A acima está completo do jeito que está; se o campo da declaração " +
  "comportar a lista das notas, ela se monta com o contador, a partir da " +
  "lista de documentos do ano.";

/**
 * Parecer de 24/08 §6 — **literal**. A cláusula *"sendo R$ X em materiais e
 * R$ Y em mão de obra e serviços"* foi **suprimida** por haver custo do ano
 * vindo de documento hábil sem classificação.
 *
 * As duas alternativas são piores: `X + Y ≠ total` publica partição falsa num
 * campo da declaração; jogar o não classificado num balde é **default em campo
 * fiscal**, proibido — campo vazio pergunta.
 */
export function composicaoNaoGerada(quantidade: number, ano: number): string {
  const notas = quantidade === 1 ? "1 nota" : `${quantidade} notas`;
  return (
    "A composição entre materiais e mão de obra não foi gerada: " +
    `${notas} que compõem o total de ${ano} ainda não estão classificadas. ` +
    "O total acima está completo — falta só a repartição dele. Classifique " +
    "essas notas e a frase entra no texto. O app não escolhe essa " +
    "classificação no seu lugar."
  );
}

/** Falta um dado de CADASTRO que o Bloco A cita. Nomeada, nunca preenchida. */
export const FALTA_MATRICULA =
  "A matrícula, o cartório e o município do terreno não estão cadastrados, e " +
  "por isso a identificação do imóvel não entrou no texto. Complete o " +
  "cadastro da obra e ela entra sozinha.";

export const FALTA_CNO =
  "O CNO da obra não está cadastrado, e por isso a inscrição não entrou no " +
  "texto. Ele é o número que liga esta obra à aferição do INSS.";

export const FALTA_DATA_DA_AQUISICAO =
  "A data de aquisição do terreno não está registrada, e por isso o texto " +
  "não a cita. O app não a deduz da data de um pagamento: a data que vale " +
  "aqui é a da escritura, e ela não está gravada em campo nenhum.";

// ── O resultado ──────────────────────────────────────────────────────────

export interface Discriminacao {
  /** Acima do bloco, SEMPRE (critério 6). */
  aviso: string;
  /** O que se copia para o campo "Discriminação". Bloco A. */
  blocoCopiavel: string;
  /**
   * §4.5, **fora do bloco e imediatamente abaixo dele**. `null` quando não há
   * nada fora do custo confirmado.
   */
  linhaForaDoCusto: string | null;
  /**
   * O que o texto NÃO diz, nomeado um a um. Nunca vazio: o Bloco B está sempre
   * aqui.
   */
  faltas: string[];
  /** §2.4 — **nunca um número só**. Os dois, para a tela nomear cada um. */
  totalConfirmadoAnoCentavos: number;
  acumuladoCentavos: number;
  foraDoCustoConfirmadoCentavos: number;
  foraDoCustoConfirmadoQuantidade: number;
}

export interface DadosDaDiscriminacao {
  obra: Obra;
  alocacao: Alocacao;
  desembolsosTerreno: readonly TerrenoDesembolso[];
  informes: readonly FinanciamentoInforme[];
  financiamento: Financiamento | null;
}

// ── O gerador ────────────────────────────────────────────────────────────

/**
 * ⚠️ **O MESMO PORTÃO de `custoTerrenoAteOAno`, e ele não é opcional aqui.**
 *
 * Só entra desembolso `pago`, **com data** (ano ≤ o declarado) **e com
 * comprovante**. Sem o portão, o valor que a linha do §4.5 diz estar **fora da
 * soma** apareceria **dentro** do bloco copiável — o texto se contradiria
 * dentro do corpo da DAA, com a contradição a duas linhas de distância na
 * mesma tela.
 *
 * É a metade automática do §2.1: o número que o app calcula sozinho soma
 * apenas o demonstrável. A metade não automática — declarar ou não o que ficou
 * de fora — é do Mateus com o CRC, e mora na linha do §4.5.
 */
function somaDosDesembolsos(
  desembolsos: readonly TerrenoDesembolso[],
  tipo: TerrenoDesembolso["tipo"],
  ano: number,
): number {
  let total = 0;
  for (const d of desembolsos) {
    if (d.tipo !== tipo || d.estado !== "pago" || d.dataPagamento === null) continue;
    if (Number(d.dataPagamento.slice(0, 4)) > ano) continue;
    if (!temComprovante(d)) continue;
    total += d.valorCentavos;
  }
  return total;
}

/**
 * ⚠️ **O gerador da discriminação de Bens e Direitos, e ele EXIGE A MARCA.**
 *
 * `liberado` não é decoração: o `ano` e o número do §4.5 saem **de dentro
 * dele**, e não dos `dados`. Quem não passou pela porta única não tem o que
 * passar aqui, e um gerador que "esquecesse" a linha do §4.5 teria de jogar
 * fora um campo que recebeu pronto — pre-mortem 1 do ticket.
 *
 * ⚠️ **O que este gerador NÃO faz**, e cada um tem parecer por trás:
 * - **não suprime** da discriminação um custo pago e real por falta de
 *   comprovante (§2.1) — ele o mostra **fora** do bloco, na linha do §4.5, e a
 *   escolha é do Mateus com o CRC;
 * - **não afirma percentual de rateio**, nem nada sobre matrícula, regime de
 *   bens ou quem declara (§3.4 ⛔, §4.6, D53);
 * - **não preenche com placeholder** o dado que falta: nomeia a falta.
 */
export function gerarBensEDireitos(
  liberado: LiberadoBensEDireitos,
  dados: DadosDaDiscriminacao,
): Discriminacao {
  const { obra, alocacao, desembolsosTerreno, informes, financiamento } = dados;
  const ano = liberado.ano;
  const faltas: string[] = [];

  // ── Frase 1 · o bem e o terreno ────────────────────────────────────────
  const frases: string[] = [];
  const identificacao =
    obra.matricula && obra.cartorio && obra.municipio
      ? `Terreno matrícula nº ${obra.matricula} do ${obra.cartorio}, ${obra.municipio}`
      : null;
  if (identificacao === null) faltas.push(FALTA_MATRICULA);

  const itbi = somaDosDesembolsos(desembolsosTerreno, "itbi", ano);
  const escritura = somaDosDesembolsos(desembolsosTerreno, "escritura_registro", ano);

  if (financiamento) {
    // Emenda de 2026-08-17 §4 — substitui a primeira frase do Bloco A. As
    // quatro regras de geração do §4 valem por inteiro, e a ordem de corte
    // delas é a razão de cada trecho ser condicional na ordem em que está.
    // ⚠️ **Nada de `replace(/\s+/g, " ")` aqui.** `formatarBRL` sai do `Intl`
    // pt-BR com **espaço não separável** (U+00A0) depois do "R$", e `\s`
    // casa com ele: colapsar espaços troca o NBSP por espaço comum e quebra o
    // valor colado na declaração. Os trechos se juntam com `" "` e ponto final.
    const partes: string[] = [];
    partes.push(
      "IMÓVEL RESIDENCIAL EM CONSTRUÇÃO." +
        (identificacao ? ` ${identificacao},` : " Terreno"),
    );
    partes.push(
      `adquirido em ` +
        `${formatarDataBR(financiamento.dataContrato)} pelo preço de ` +
        `${formatarBRL(financiamento.precoContratadoCentavos)}, financiado ` +
        `junto a ${financiamento.instituicao}` +
        (financiamento.numeroContrato
          ? `, contrato nº ${financiamento.numeroContrato}`
          : "") +
        ".",
    );
    // ⚠️ Regra 1 do §4: **não é enfeite e não é cortável**. É ela que explica
    // por que o valor declarado é MENOR que o preço da escritura — a
    // divergência mais visível desta declaração.
    const entrada = somaDosDesembolsos(desembolsosTerreno, "entrada", ano);
    const informesAteOAno = informes.filter((i) => i.anoBase <= ano);
    const parcelas = informesAteOAno.reduce(
      (s, i) => s + custoDoInformeCentavos(i),
      0,
    );
    // ⚠️ Regra 3 do §4: **os juros vão nomeados ou não vão.** Proibido incluir
    // juros dentro de um total sem dizer.
    const juros = informesAteOAno.reduce(
      (s, i) => s + i.jurosCorrecaoCentavos,
      0,
    );
    partes.push(
      "Declarado pelo valor efetivamente pago, conforme regime de caixa: " +
        `entrada de ${formatarBRL(entrada)} e ${formatarBRL(parcelas)} em ` +
        `parcelas do financiamento pagas até 31/12/${ano}` +
        (juros > 0
          ? `, dos quais ${formatarBRL(juros)} a título de juros e encargos do financiamento`
          : "") +
        ".",
    );
    if (itbi > 0 || escritura > 0) {
      partes.push(
        `Acrescido de ITBI de ${formatarBRL(itbi)} e de escritura e registro ` +
          `de ${formatarBRL(escritura)}.`,
      );
    }
    // ⚠️ Regra 2 do §4: o saldo devedor aparece e é ROTULADO — fecha a conta
    // na cabeça de quem lê (pago + saldo = preço).
    const informeDoAno = informes.find((i) => i.anoBase === ano);
    if (informeDoAno) {
      partes.push(
        `Saldo devedor do financiamento em 31/12/${ano}: ` +
          `${formatarBRL(informeDoAno.saldoDevedorCentavos)}, não incluído ` +
          "por não ter sido pago.",
      );
    }
    frases.push(partes.join(" "));
  } else {
    // §2, primeira frase — aquisição que não é financiada. A data da
    // aquisição não tem campo no modelo, e NÃO se deduz da data de um
    // pagamento (a data que vale aqui é a da escritura).
    faltas.push(FALTA_DATA_DA_AQUISICAO);
    const terreno = somaDosDesembolsos(desembolsosTerreno, "pagamento_terreno", ano);
    frases.push(
      "IMÓVEL RESIDENCIAL EM CONSTRUÇÃO." +
        (identificacao ? ` ${identificacao},` : " Terreno") +
        ` adquirido por ${formatarBRL(terreno)}` +
        (itbi > 0 || escritura > 0
          ? `, acrescido de ITBI de ${formatarBRL(itbi)} e de escritura e ` +
            `registro de ${formatarBRL(escritura)}`
          : "") +
        ".",
    );
  }

  // ── Frase 2 · a construção ─────────────────────────────────────────────
  if (obra.cno) {
    frases.push(
      `Construção de residência unifamiliar iniciada em ` +
        `${formatarDataBR(obra.dataInicioObra)}, obra inscrita no CNO nº ${obra.cno}.`,
    );
  } else {
    faltas.push(FALTA_CNO);
    frases.push(
      `Construção de residência unifamiliar iniciada em ` +
        `${formatarDataBR(obra.dataInicioObra)}.`,
    );
  }

  // ── Frases 3 a 5 · a situação e os dispêndios do ano ───────────────────
  const terrenoAteAnterior = custoTerrenoAteOAno(
    desembolsosTerreno,
    informes,
    ano - 1,
  ).confirmadoCentavos;
  const anterior =
    terrenoAteAnterior + custoComprovadoAteOAno(alocacao, ano - 1);
  const terrenoAteOAno = custoTerrenoAteOAno(
    desembolsosTerreno,
    informes,
    ano,
  ).confirmadoCentavos;
  const acumulado = terrenoAteOAno + custoComprovadoAteOAno(alocacao, ano);
  const doAno = custoComprovadoDoAno(alocacao, ano);

  frases.push(`Situação em 31/12/${ano - 1}: ${formatarBRL(anterior)}.`);

  // ⚠️ A cláusula "sendo R$ X em materiais e R$ Y em mão de obra e serviços"
  // segue o parecer de 24/08: existe custo do ano vindo de documento hábil SEM
  // classificação → ela é SUPRIMIDA por inteiro, e a ausência é nomeada (§4).
  // Nunca `X + Y ≠ total`; nunca o não classificado empurrado para um balde.
  const composicao = composicaoDoAno(alocacao, ano);
  if (composicao.semClassificacaoCentavos > 0) {
    // ⚠️ **A contagem sai do MESMO laço da suspensão** — correção do Gate 2.
    // Contá-la varrendo o acervo por `cobertoCentavos > 0` fazia dois números
    // do mesmo fato por dois caminhos, e os dois modos de errar apareceram:
    // *"0 notas … compõem o total"* (nota sem classificação com coberto zero)
    // e nota contada sem ter posto centavo no ano.
    const semClassificacao = notasSemClassificacaoDoAno(alocacao, ano);
    faltas.push(composicaoNaoGerada(semClassificacao.length, ano));
    frases.push(
      `Dispêndios pagos no ano-calendário de ${ano}: ${formatarBRL(doAno)}.`,
    );
  } else {
    frases.push(
      `Dispêndios pagos no ano-calendário de ${ano}: ${formatarBRL(doAno)}, ` +
        `sendo ${formatarBRL(composicao.materialCentavos)} em materiais e ` +
        `${formatarBRL(composicao.maoObraCentavos)} em mão de obra e serviços.`,
    );
  }

  frases.push(`Situação em 31/12/${ano}: ${formatarBRL(acumulado)}.`);
  frases.push(
    "Dispêndios comprovados por notas fiscais e recibos emitidos em nome e " +
      "CPF do declarante, mantidos em seu poder.",
  );

  faltas.push(BLOCO_B_NAO_GERADO);

  const fora = liberado.foraDoCustoConfirmado;
  return {
    aviso: reviseAntesDeCopiar(fora.quantidade),
    blocoCopiavel: frases.join(" "),
    linhaForaDoCusto:
      fora.quantidade === 0
        ? null
        : linhaForaDoCustoConfirmado(fora.totalCentavos),
    faltas,
    totalConfirmadoAnoCentavos: doAno,
    acumuladoCentavos: acumulado,
    foraDoCustoConfirmadoCentavos: fora.totalCentavos,
    foraDoCustoConfirmadoQuantidade: fora.quantidade,
  };
}
