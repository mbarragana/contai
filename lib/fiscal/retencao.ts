/**
 * **CONTAI-038 — as linhas de retenção da NF de serviço.** Módulo puro.
 *
 * Fonte normativa ÚNICA, e nada aqui é redigido de memória:
 * `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (corpo §§0-7 +
 * ADENDO de 2026-09-19, que vence onde divergir do corpo).
 *
 * ## As três coisas que este módulo existe para impedir
 *
 * 1. **O app rotular a linha antes de o Mateus escolher.** O caso real de
 *    4,6228% que "parecia retenção de INSS" e era alíquota efetiva de ISS do
 *    Simples (§4, item 1) é o motivo de `composicao` ser pergunta sem default,
 *    com `nao_sei` como resposta válida.
 * 2. **Decompor o que a nota não abriu.** Com `combinado_nao_aberto`, o app
 *    NUNCA reparte o valor entre ISS/INSS/IRRF — nem por rateio presumido, nem
 *    "para completar a tabela" (ADENDO A.1, regra dura). O valor combinado fica
 *    combinado.
 * 3. **Tratar percentual informativo como dinheiro descontado.** Daí
 *    `eDescontoEfetivo` ser pergunta obrigatória e separada: linha informativa
 *    (composição do DAS) não gera pendência nenhuma (§4, item 2).
 *
 * ## E a que ele NÃO serve, por escrito
 *
 * ⚠️ **Nenhuma função deste módulo é lida pela base de aferição do SERO**
 * (critério 13). O §2 do parecer é literal: *"a base não é reduzida pelo valor
 * da nota, nem pelo valor retido, nem pelo percentual de retenção"* — o que
 * abate é a declaração que a prestadora vincula ao CNO, evento fora deste
 * produto (dívida D57). `lib/fiscal/afericao.ts` e `lib/fiscal/risco.ts` não
 * importam este arquivo, e há teste afirmando isso.
 *
 * ⚠️ **Nenhuma função deste módulo muda o custo de aquisição** (critério 12):
 * ele continua sendo o valor BRUTO da nota, no regime de caixa da data do
 * pagamento, qualquer que seja a composição das linhas (§6, ADENDO A.2 e A.5).
 */

import type {
  ComposicaoRetencao,
  Documento,
  LinhaRetencao,
  QuemRecolheRetencao,
  RespostaRetencaoNaNota,
  TributoRetido,
} from "@/lib/types";

// ── Os rótulos das perguntas — literais do ticket e do parecer ───────────

/** Critério 1, literal. Duas opções, e nenhuma pré-marcada. */
export const PERGUNTA_GATE = "Esta nota destaca alguma retenção?";

export const OPCOES_GATE = [
  { valor: "nenhuma", texto: "Nenhuma" },
  { valor: "destacada", texto: "Destacada" },
] as const satisfies readonly { valor: RespostaRetencaoNaNota; texto: string }[];

/**
 * Orientação de FLUXO, não regra fiscal (proposta do `designer`, marcada como
 * tal no spec): ela diz onde o detalhe é preenchido, sem afirmar consequência
 * nenhuma. É por isso que "Destacada" **não** abre banner de consequência na
 * captura — não há consequência fiscal aberta ainda, só dado a completar.
 */
export const DICA_GATE_DESTACADA =
  "Você detalha isso depois, sentado — aqui só marcamos que a nota tem retenção.";

/** Erro de campo do gate, no padrão curto e imperativo do formulário. */
export const ERRO_GATE_SEM_RESPOSTA =
  "Responda se esta nota destaca alguma retenção.";

/** ADENDO A.1 / critério 3 — a pergunta única, que substitui "isto é INSS?". */
export const PERGUNTA_COMPOSICAO = "O que esta linha representa?";

export const OPCOES_COMPOSICAO = [
  { valor: "tributo_identificado", texto: "Tributo único identificado" },
  {
    valor: "combinado_nao_aberto",
    texto: "Total combinado, não aberto pela nota",
  },
  { valor: "nao_sei", texto: "Não sei o que este valor representa" },
] as const satisfies readonly { valor: ComposicaoRetencao; texto: string }[];

export const PERGUNTA_TRIBUTO = "Qual tributo?";

export const OPCOES_TRIBUTO = [
  { valor: "iss", texto: "ISS" },
  { valor: "inss", texto: "INSS" },
  { valor: "irrf", texto: "IRRF" },
  { valor: "pis", texto: "PIS" },
  { valor: "cofins", texto: "COFINS" },
  { valor: "csll", texto: "CSLL" },
] as const satisfies readonly { valor: TributoRetido; texto: string }[];

/** Critério 3, literal. */
export const PERGUNTA_DESCONTO_EFETIVO =
  "Esse valor é de fato abatido do que você transfere ao prestador?";

/** Critério 3, literal — adaptado de frase para rótulo de campo. */
export const PERGUNTA_QUEM_RECOLHE = "Quem recolhe isto?";

export const OPCOES_QUEM_RECOLHE = [
  { valor: "eu", texto: "Eu" },
  { valor: "empresa", texto: "A empresa" },
  // ⚠️ Resposta de PRIMEIRA CLASSE (ADENDO A.2/A.4): é literalmente a resposta
  // do Mateus à P4. Tratá-la como erro obrigaria a inventar uma certeza.
  { valor: "nao_sei", texto: "Ainda não sei" },
] as const satisfies readonly { valor: QuemRecolheRetencao; texto: string }[];

export const AJUDA_ROTULO_LITERAL = "Copie exatamente como está na nota";

export const NOME_TRIBUTO: Record<TributoRetido, string> = {
  iss: "ISS",
  inss: "INSS",
  irrf: "IRRF",
  pis: "PIS",
  cofins: "COFINS",
  csll: "CSLL",
};

// ── Textos com consequência fiscal ───────────────────────────────────────

/**
 * ⚠️ **CITAÇÃO LITERAL** — Gate Fiscal do CONTAI-038, P1, e a mesma frase do
 * ADENDO A.4 do parecer. **Nunca reescrever**: é ela que nomeia o risco de
 * "retenção que ninguém recolhe", e ela aparece em DOIS lugares (o card da
 * linha em `/documento/[id]` e o card de pendência da home) — uma constante,
 * duas telas, porque duas cópias divergem e a primeira coisa que diverge é a
 * consequência fiscal.
 */
export const CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR =
  "Retenção descontada do pagamento sem confirmação de quem recolhe — se " +
  "ninguém recolher, não é economia, é passivo não identificado.";

/**
 * ⚠️ **CITAÇÃO LITERAL do ADENDO A.2** (regra adicional do Gate Fiscal): com
 * composição combinada ou desconhecida, a perna de pagamento correspondente
 * **não pode** ser nomeada "guia de ISS" nem "guia de INSS". A regra é dura e
 * nomeada no parecer — chamar de "guia de INSS" um valor que ninguém abriu é
 * exatamente a decomposição por chute que o A.1 proíbe, com outro rosto.
 */
export const ROTULO_RETENCAO_NAO_DISCRIMINADA =
  "retenção não discriminada, presumivelmente recolhida por terceiros";

/** Proposta de design (spec), a confirmar — chip da pendência na home. */
export const CHIP_RETENCAO_SEM_RECOLHEDOR = "Retenção sem recolhedor";

/** Proposta de design (spec), a confirmar — título da pendência na home. */
export const TITULO_RETENCAO_SEM_RECOLHEDOR =
  "Retenção descontada, sem confirmar quem recolhe";

/** Proposta de design (spec), a confirmar — o gate "destacada" sem linha. */
export const CHIP_RETENCAO_SEM_LINHA = "Retenção sem linha registrada";

export const RETENCAO_SEM_LINHA_EFEITO =
  "Esta nota destaca retenção, mas nenhuma linha foi registrada ainda.";

/**
 * O invariante do §2, dito em tela e não só em comentário: **nenhuma retenção
 * desta nota abate a aferição do INSS**. Reuso do que a Tela 7 antiga já
 * afirmava ("Abate no INSS (SERO): não"), agora com o porquê ao lado — o
 * abatimento depende da declaração vinculada ao CNO, que é outro ato.
 */
export const RETENCAO_NAO_ABATE_SERO =
  "Nenhuma retenção desta nota abate o INSS (SERO) — só a declaração " +
  "vinculada ao CNO abate, e isso é separado deste registro.";

/**
 * Decisão de design 8 do spec: o fechamento de "eu recolho" é por DOCUMENTO
 * (reaproveita `saldoDescobertoDaNota`), nunca linha a linha. Duas linhas "eu
 * recolho" na mesma nota fecham juntas, e a tela diz isso em vez de deixar o
 * Mateus procurar a diferença.
 */
export const RETENCAO_FECHA_POR_NOTA =
  "Esta pendência fecha pelo total pago pela nota, não linha por linha — se " +
  "houver mais de uma linha “eu recolho” aqui, elas fecham juntas quando o " +
  "total pago cobrir o valor bruto.";

// ── A linha, como o formulário a monta ───────────────────────────────────

/**
 * O que a tela junta antes de gravar. Tudo nasce `null`/vazio, **em toda linha
 * nova**, mesmo quando a anterior já foi preenchida: nenhum campo herda valor
 * da linha anterior (spec, "Campos" — mesmo princípio do s8 do CONTAI-021).
 */
export interface EntradaLinhaRetencao {
  rotuloLiteral: string;
  valorCentavos: number | null;
  composicao: ComposicaoRetencao | null;
  tributo: TributoRetido | null;
  eDescontoEfetivo: boolean | null;
  quemRecolhe: QuemRecolheRetencao | null;
}

export const LINHA_RETENCAO_VAZIA: EntradaLinhaRetencao = {
  rotuloLiteral: "",
  valorCentavos: null,
  composicao: null,
  tributo: null,
  eDescontoEfetivo: null,
  quemRecolhe: null,
};

export type CampoLinhaRetencao = keyof EntradaLinhaRetencao;

/**
 * Erro de campo DESTE formulário. Tipo próprio, e não o `ErroCampo` de
 * `documento.ts`: lá o `campo` é `keyof EntradaDocumento`, e reaproveitá-lo
 * aqui exigiria afrouxar aquele tipo — que é justamente o que faz o compilador
 * pegar um `erroDe(...)` órfão depois de um rename de campo.
 */
export interface ErroLinhaRetencao {
  campo: CampoLinhaRetencao;
  mensagem: string;
}

/**
 * **Critério 5 — a linha só grava COMPLETA.**
 *
 * A trava de verdade é o banco (os dois CHECKs da migration 0017); esta função
 * é a que **nomeia o que falta** antes do toque, em vez de devolver um erro de
 * constraint. A ordem é a ordem do formulário — é a ordem em que ele lê a nota.
 *
 * ⚠️ Os dois ramos condicionais são obrigatórios **no ramo escolhido**, e
 * inexistentes fora dele: exigir `tributo` de uma linha combinada seria pedir a
 * decomposição que o ADENDO A.1 proíbe.
 */
export function validarLinhaRetencao(
  entrada: EntradaLinhaRetencao,
): ErroLinhaRetencao[] {
  const erros: ErroLinhaRetencao[] = [];

  if (entrada.rotuloLiteral.trim().length === 0) {
    erros.push({
      campo: "rotuloLiteral",
      mensagem: "Copie o rótulo como está impresso na nota.",
    });
  }

  if (entrada.valorCentavos === null || entrada.valorCentavos <= 0) {
    erros.push({
      campo: "valorCentavos",
      mensagem: "Informe o valor desta linha.",
    });
  }

  if (entrada.composicao === null) {
    erros.push({
      campo: "composicao",
      mensagem:
        "Responda o que esta linha representa (vale responder “não sei”).",
    });
  } else if (entrada.composicao === "tributo_identificado" && entrada.tributo === null) {
    erros.push({ campo: "tributo", mensagem: "Escolha qual tributo é." });
  }

  if (entrada.eDescontoEfetivo === null) {
    erros.push({
      campo: "eDescontoEfetivo",
      mensagem: "Responda se este valor é abatido do que você transfere.",
    });
  } else if (entrada.eDescontoEfetivo && entrada.quemRecolhe === null) {
    erros.push({
      campo: "quemRecolhe",
      mensagem:
        "Responda quem recolhe este valor (vale responder “ainda não sei”).",
    });
  }

  return erros;
}

/**
 * O que vai para o banco. Devolve `null` quando a entrada não é válida — não
 * existe caminho que grave linha pela metade a partir desta função.
 *
 * ⚠️ `tributo` e `quemRecolhe` são zerados FORA do ramo que os pede: um
 * tributo escolhido e depois abandonado ao trocar a composição violaria o
 * CHECK `documento_retencao_tributo_coerente` — e o estado que a tela esconde
 * continua no `useState`.
 */
export function linhaRetencaoParaBanco(entrada: EntradaLinhaRetencao): {
  rotulo_literal: string;
  composicao: ComposicaoRetencao;
  tributo: TributoRetido | null;
  e_desconto_efetivo: boolean;
  quem_recolhe: QuemRecolheRetencao | null;
  valorCentavos: number;
} | null {
  if (validarLinhaRetencao(entrada).length > 0) return null;
  const composicao = entrada.composicao as ComposicaoRetencao;
  const eDescontoEfetivo = entrada.eDescontoEfetivo as boolean;
  return {
    rotulo_literal: entrada.rotuloLiteral.trim(),
    composicao,
    tributo: composicao === "tributo_identificado" ? entrada.tributo : null,
    e_desconto_efetivo: eDescontoEfetivo,
    quem_recolhe: eDescontoEfetivo ? entrada.quemRecolhe : null,
    valorCentavos: entrada.valorCentavos as number,
  };
}

// ── Os predicados que a pendência e a tela leem ──────────────────────────

/** O gate só existe em NF de serviço — mesma condição de `exigeRetencao`. */
export function exigeGateDeRetencao(
  documento: Pick<Documento, "tipo">,
): boolean {
  return documento.tipo === "nf_servico";
}

/**
 * **Critério 2** — gate "destacada" e nenhuma linha gravada. Estado legítimo
 * (o documento e as linhas gravam em dois statements, sem RPC única), e por
 * isso mesmo **visível**: nunca lido como "nota sem retenção".
 */
export function faltaRegistrarLinha(
  documento: Pick<Documento, "tipo" | "retencaoNaNota" | "retencoes">,
): boolean {
  return (
    exigeGateDeRetencao(documento) &&
    documento.retencaoNaNota === "destacada" &&
    documento.retencoes.length === 0
  );
}

/**
 * **A condição de saída da pendência nova, e ela NUNCA é um percentual**
 * (Gate Fiscal, P1 — as quatro condições, nesta ordem):
 *
 * - `eDescontoEfetivo = false` → informativa (ex.: composição do DAS do
 *   Simples). **Nenhuma pendência nasce**, e é essa a nova condição de saída;
 * - `quem_recolhe = "empresa"` → **fecha**. O parecer não exige comprovante do
 *   recolhimento do prestador como condição de bloqueio;
 * - `quem_recolhe = "eu"` → aplica-se o fechamento
 *   `Σ pagamentos vinculados == valor_bruto_nota` já normatizado em 2026-08-18
 *   §4.1: falta a perna (a guia) → continua aberta;
 * - `null` ou `"nao_sei"` → **aberta**, e é o caso mais perigoso do §1
 *   (retenção indevida que ninguém recolhe).
 *
 * @param notaCoberta `Σ pagamentos vinculados` já cobre o valor bruto da nota.
 * Vem de `saldoDescobertoDaNota(...) === null` — reaproveita o cálculo que já
 * existe, e **não escreve uma segunda soma** (Viabilidade).
 */
export function linhaSemRecolhedor(
  linha: Pick<LinhaRetencao, "eDescontoEfetivo" | "quemRecolhe">,
  notaCoberta: boolean,
): boolean {
  if (!linha.eDescontoEfetivo) return false;
  if (linha.quemRecolhe === "empresa") return false;
  if (linha.quemRecolhe === "eu") return !notaCoberta;
  return true;
}

/**
 * Como a perna de pagamento desta linha se chama — e a regra é dura (ADENDO
 * A.2): com composição combinada ou desconhecida, **nunca** "guia de ISS" ou
 * "guia de INSS". Só a linha que o Mateus identificou pode nomear o tributo.
 */
export function nomeDaRetencao(
  linha: Pick<LinhaRetencao, "composicao" | "tributo">,
): string {
  if (linha.composicao === "tributo_identificado" && linha.tributo !== null) {
    return NOME_TRIBUTO[linha.tributo];
  }
  return ROTULO_RETENCAO_NAO_DISCRIMINADA;
}

/** O que a linha diz de si mesma na lista do detalhe. */
export function descricaoDaComposicao(
  linha: Pick<LinhaRetencao, "composicao" | "tributo">,
): string {
  if (linha.composicao === "tributo_identificado" && linha.tributo !== null) {
    return `Tributo único identificado — ${NOME_TRIBUTO[linha.tributo]}`;
  }
  return OPCOES_COMPOSICAO.find((o) => o.valor === linha.composicao)?.texto ?? "";
}
