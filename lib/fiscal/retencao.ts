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
 * ⚠️ **O valor-alvo do custo de aquisição não muda aqui** (critério 12): ele
 * continua sendo o valor BRUTO da nota, no regime de caixa da data do
 * pagamento, qualquer que seja a composição das linhas (§6, ADENDO A.2 e A.5).
 *
 * ⚠️ **Mudou no CONTAI-056 a frase que ficava aqui** — ela dizia *"nenhuma
 * função deste módulo muda o custo de aquisição"*, e era justamente essa
 * leitura que deixou o A.2 sem implementação por um ano de acervo: o A.2 sempre
 * exigiu que a linha `e_desconto_efetivo = true` entrasse em `alocarCusto`
 * **como perna de pagamento**, e `alocarCusto` nunca soube da palavra
 * `retencao` (ADENDO 2, 2026-09-25 — achado por auditoria de código). Quem
 * decide QUANDO a linha conta é `retencaoContaComoPerna`, aqui embaixo; quem
 * soma continua sendo `lib/fiscal/vinculo.ts`, e o valor-alvo (o bruto)
 * continua o mesmo.
 */

import { gravidadeDaRegua, type Gravidade } from "./gravidade";
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

/**
 * **CONTAI-053 — a variante de TELA LARGA (≥880px) da dica acima**, também
 * orientação de fluxo e não regra fiscal.
 *
 * ⚠️ Ela existe porque a frase de cima fica **FALSA** quando o repeater está
 * visível ali mesmo (spec do CONTAI-053, §3): *"você detalha isso depois"* ao
 * lado do formulário que detalha agora ensina o contrário do que a tela faz.
 * As duas coexistem no DOM e quem escolhe é o CSS — a de cima continua **byte a
 * byte** a de sempre abaixo de 880px (critério 6, regressão travada em E2E).
 */
export const DICA_GATE_DESTACADA_LARGA =
  "As linhas de retenção aparecem logo abaixo — preencha agora, com a nota na " +
  "mão, ou deixe em branco e complete depois, na tela desta nota.";

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

// ── CONTAI-055 — a sugestão do CONTAI-054 dita em tela ───────────────────
//
// ⚠️ **Texto de PRODUTO, não citação de parecer**: nenhuma frase abaixo afirma
// consequência fiscal. Elas dizem de onde veio o que está no campo e por que
// ele ainda precisa ser conferido — a mesma disciplina do `ajuda` de
// `CampoTexto` ("campo preenchido pelo app SEM dizer a origem lê como algo que
// o usuário digitou e conferiu, e não foi isso que aconteceu").

/** Chip do bloco de sugestão, no formulário da primeira linha. */
export const SUGESTAO_RETENCAO_CHIP = "Lido automaticamente desta nota";

/**
 * ⚠️ **O aviso do critério 5 do CONTAI-055**, e ele é recomendação dos dois
 * revisores do Gate 2 do CONTAI-054: o parser aceita o trio pela ARITMÉTICA
 * (`total − candidato = líquido`), e uma linha de **desconto** fecha a mesma
 * conta. Por isso o rótulo literal aparece em destaque ao lado desta frase — é
 * a única defesa contra confirmar sem olhar o papel.
 */
export const SUGESTAO_RETENCAO_CONFIRA =
  "Confira na nota antes de adicionar: a leitura acha esta linha pela " +
  "aritmética (total − retenção = líquido), e uma linha de DESCONTO fecha a " +
  "mesma conta. Se o rótulo acima não for de retenção, corrija ou apague os " +
  "dois campos.";

/** Estado de espera do bloco — a chamada é local e rápida, mas não é grátis. */
export const SUGESTAO_RETENCAO_LENDO = "Lendo a retenção nesta nota…";

/**
 * ⚠️ **Critério 4 — a falha NUNCA bloqueia o registro.** A frase diz as duas
 * coisas: a leitura não aconteceu e o caminho manual continua aberto. Mesma
 * disciplina do erro da extração de documento nesta tela.
 */
export const SUGESTAO_RETENCAO_FALHOU =
  "Não deu para ler a retenção desta nota automaticamente. Preencha as linhas " +
  "à mão — o registro segue normalmente.";

/**
 * ── CONTAI-062 ────────────────────────────────────────────────────────────
 *
 * O rodapé do trecho literal mostrado **ao lado do próprio gate**, em qualquer
 * largura. Curto de propósito: ali o Mateus ainda não está editando campo
 * nenhum, só conferindo se a nota na mão tem mesmo essa linha. A frase longa que
 * explica a aritmética (`SUGESTAO_RETENCAO_CONFIRA`) continua onde ela vale, no
 * formulário da linha, onde os campos de verdade estão prestes a ser editados.
 *
 * ⚠️ **Texto de PRODUTO, não citação de parecer** — mesma disciplina do bloco
 * acima. Ele diz de onde veio o que está marcado e que ainda falta conferir;
 * não afirma consequência fiscal nenhuma.
 */
export const SUGESTAO_GATE_CONFIRA =
  "Sugerido a partir da leitura do PDF — confira antes de salvar.";

/** A origem do que está no campo, dita no próprio campo (critério 2). */
export const AJUDA_ROTULO_LITERAL_SUGERIDO =
  "Veio da leitura automática da nota — confira se é exatamente o rótulo impresso";

export const AJUDA_VALOR_SUGERIDO =
  "Veio da leitura automática da nota — confira contra o papel";

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
 *
 * ⚠️ **Desde o CONTAI-059 ela é do ESTADO A, e só dele** (ADENDO 4, Pergunta 2):
 * `quem_recolhe` sem resposta útil. A linha em que o Mateus já respondeu "Eu" e
 * a guia ainda não apareceu é o **Estado C**, e lá esta frase estava
 * literalmente errada — ver `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA` e
 * `motivoDaRetencaoAberta` mais abaixo.
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

/** Chip da pendência na home — **Estado A** desde o CONTAI-059. */
export const CHIP_RETENCAO_SEM_RECOLHEDOR = "Retenção sem recolhedor";

/** Título da pendência na home — **Estado A** desde o CONTAI-059. */
export const TITULO_RETENCAO_SEM_RECOLHEDOR =
  "Retenção descontada, sem confirmar quem recolhe";

/**
 * ⚠️ **CITAÇÃO LITERAL do ADENDO 4, Pergunta 3** (2026-09-26) — o texto do
 * **Estado C**, e ele foi redigido pelo `contador` justamente porque o texto do
 * Estado A descreve este estado errado. **Nunca reescrever, nunca parafrasear**:
 * há teste comparando esta constante com o parágrafo do parecer.
 *
 * O que ela diz, e o texto do Estado A não dizia: aqui **não há passivo não
 * identificado** — o responsável é o próprio Mateus. A pendência é de
 * **pagamento** (a guia), com dois efeitos somados se a guia nunca for paga: a
 * fatia fora do custo para sempre **e** dívida tributária vencida no nome dele.
 */
export const CONSEQUENCIA_RETENCAO_EU_SEM_GUIA =
  "Você já confirmou que quem recolhe esta retenção é você — a pendência aqui " +
  "não é de identificação, é de pagamento: enquanto a guia não for paga e " +
  "vinculada a este documento, esta fatia não entra no custo de aquisição do " +
  "ano nenhum. Se a guia nunca for paga, o efeito não é apenas essa fatia " +
  "ficar fora do custo para sempre — o valor retido se torna dívida tributária " +
  "vencida em seu nome, sujeita a juros e multa.";

/**
 * Chip do **Estado C** — texto de PRODUTO, não citação (ADENDO 4, Pergunta 5,
 * que autoriza ajuste de forma). Os dois fatos fiscais que ele **não pode**
 * violar: não sugerir "sem confirmar" (já foi confirmado) e não sugerir
 * "resolvido"/"quitado" (o risco de a guia nunca ser paga continua de pé).
 */
export const CHIP_RETENCAO_GUIA_PENDENTE = "Guia de retenção pendente";

/** Título do **Estado C** — mesmos dois fatos do chip acima. */
export const TITULO_RETENCAO_GUIA_PENDENTE =
  "Recolhedor confirmado — guia ainda não paga";

/** Proposta de design (spec), a confirmar — o gate "destacada" sem linha. */
export const CHIP_RETENCAO_SEM_LINHA = "Retenção sem linha registrada";

export const RETENCAO_SEM_LINHA_EFEITO =
  "Esta nota destaca retenção, mas nenhuma linha foi registrada ainda.";

/**
 * **CONTAI-053, critério 3 — o documento entrou e alguma linha NÃO.**
 *
 * O caso é real porque documento e linhas gravam em dois statements, sem
 * transação pelo PostgREST (mesma classe de dívida dos vínculos). O pre-mortem 4
 * do ticket nomeia o risco de deixar isso silencioso: ele não perceberia que 1
 * de 3 linhas ficou fora, e a lacuna só apareceria na revisão anual.
 *
 * ⚠️ **Só aparece quando houve tentativa e houve falha** (`total > 0 &&
 * falharam > 0`). Lista vazia não é falha: é o estado legítimo do
 * `CHIP_RETENCAO_SEM_LINHA`, que `/documento/[id]` já mostra.
 */
export const CHIP_RETENCAO_PARCIALMENTE_GRAVADA = "Retenção parcialmente gravada";

/**
 * ⚠️ **O SUBSTANTIVO concorda com `total`; o VERBO, com `entraram`** — achado do
 * Gate 2 do CONTAI-053, e é o que o ASCII do spec mostra: *"**Entrou** 1 de 3
 * linhas de retenção — 2 não gravaram."* A fórmula do §4 daquele spec estava com
 * o verbo no plural e foi corrigida junto com esta função. Quem sujeita o verbo é
 * quantas entraram, não quantas havia — e o verbo vem ANTES da quantidade, de
 * propósito: com ele depois ("1 linha ... entraram"), o caso total=1/entraram=0
 * lia mal ("0 de 1 linha ... entraram", substantivo singular colado ao verbo
 * plural). Achado numa segunda rodada de revisão de texto, não do Gate 2.
 */
export function contagemDaRetencaoParcial(
  entraram: number,
  total: number,
): string {
  const falharam = total - entraram;
  // Verbo na frente, concordando só com `entraram` — evita o choque de
  // "1 linha ... entraram" quando total=1 e entraram=0 (substantivo no
  // singular, verbo no plural, lado a lado). Com o verbo antes da
  // quantidade, a frase lê bem nos dois sentidos: "Entrou 1 de 3 linhas...",
  // "Entraram 0 de 1 linha...".
  const verbo = entraram === 1 ? "Entrou" : "Entraram";
  return (
    `${verbo} ${entraram} de ${total} ${total === 1 ? "linha" : "linhas"} de retenção` +
    ` — ${falharam} ${falharam === 1 ? "não gravou" : "não gravaram"}.`
  );
}

/**
 * ⚠️ A última cláusula é disciplina fiscal, não consolo: linha que não gravou
 * fica **pendência**, e a nota nunca é lida como "sem retenção" (`CONTAI-038`,
 * critérios 2 e 5). O conteúdo digitado não é preservado de propósito (spec, §4)
 * — a fonte é o papel, como em qualquer correção de linha na gestão.
 */
export function acaoDaRetencaoParcial(falharam: number): string {
  return (
    `Abra o documento e registre ${falharam === 1 ? "a que falta" : "as que faltam"} ` +
    "de novo, olhando a nota — elas ficam como pendência até lá, nunca como " +
    '"sem retenção".'
  );
}

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
 * **CONTAI-055 — o que a sugestão do CONTAI-054 pode carregar, e nada mais.**
 *
 * ⚠️ Os dois campos são os únicos que são LEITURA DE TEXTO IMPRESSO. Os quatro
 * de classificação fiscal (`composicao`, `tributo`, `eDescontoEfetivo`,
 * `quemRecolhe`) não cabem neste tipo **por construção** — a trava do Gate
 * Fiscal não é disciplina de quem chama, é o compilador. Estruturalmente igual
 * ao `SugestaoLinhaRetencao` de `lib/extracao/retencao-texto.ts`, e declarado
 * aqui de novo de propósito: módulo fiscal não importa módulo de extração.
 */
export type SugestaoDeLinha = {
  rotuloLiteral: string;
  valorCentavos: number;
};

/**
 * A linha como a sugestão a deixa: os dois campos lidos preenchidos, **os
 * quatro fiscais em `null`**, herdados de `LINHA_RETENCAO_VAZIA`.
 *
 * ⚠️ O resultado continua REPROVANDO em `validarLinhaRetencao` — e isso é o
 * ponto, não um efeito colateral: a linha sugerida não pode ser adicionada até o
 * humano responder composição e desconto efetivo (Gate Fiscal do CONTAI-055,
 * herdado do CONTAI-054).
 */
export function linhaSugerida(sugestao: SugestaoDeLinha): EntradaLinhaRetencao {
  return {
    ...LINHA_RETENCAO_VAZIA,
    rotuloLiteral: sugestao.rotuloLiteral,
    valorCentavos: sugestao.valorCentavos,
  };
}

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
 *
 * ⚠️ **CONTAI-059: as quatro condições mudaram de casa, não de conteúdo.** Elas
 * agora vivem em `motivoDaRetencaoAberta`, logo abaixo, que devolve QUAL dos dois
 * estados abriu a pendência; esta função é o mesmo predicado de sempre escrito em
 * cima dela. Quem pergunta "abre?" continua chamando esta; quem pergunta "o que
 * escrever?" chama a outra.
 */
export function linhaSemRecolhedor(
  linha: Pick<LinhaRetencao, "eDescontoEfetivo" | "quemRecolhe">,
  notaCoberta: boolean,
): boolean {
  return motivoDaRetencaoAberta(linha, notaCoberta) !== null;
}

/**
 * **CONTAI-059 — POR QUE a pendência está aberta, que não é a mesma pergunta
 * que "está aberta?".**
 *
 * Fonte: ADENDO 4 de `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`
 * (2026-09-26) + a "Continuação — 2026-09-26". O bug relatado pelo Mateus —
 * *"eu coloquei que quem deve pagar aquilo ali sou eu, logo, se sabe quem vai
 * pagar, eu só não paguei ainda"* — era de TEXTO REAPROVEITADO: a lógica de
 * `linhaSemRecolhedor` sempre soube distinguir os dois estados, mas devolvia
 * `boolean`, e a tela só tinha um texto para os dois.
 *
 * - **`"sem_recolhedor"` (Estado A)** — `quem_recolhe` sem resposta útil
 *   (`"nao_sei"`; `null` é dado inválido que a 0017 e `validarLinhaRetencao` não
 *   deixam persistir). Risco de FUNDAMENTO: a retenção pode não ter base legal
 *   nenhuma e o prestador pode voltar cobrando a diferença — passivo de
 *   terceiro, não identificado.
 * - **`"eu_sem_guia"` (Estado C)** — `quem_recolhe = "eu"` e a nota ainda
 *   descoberta. O responsável **já está identificado**; falta a guia. Risco de
 *   FLUXO DE CAIXA, mais dívida tributária futura em nome dele se a guia nunca
 *   aparecer.
 * - **`null`** — nenhuma pendência: linha informativa, ou "a empresa recolhe",
 *   ou "eu" com a nota já coberta pela guia.
 *
 * ⚠️ **As condições de ABERTURA são, byte a byte, as de `linhaSemRecolhedor`
 * antes deste ticket** (critério 8): o que este ticket muda é só o texto e a cor
 * exibidos. `retencaoContaComoPerna`/`alocarCusto` não olham esta função.
 *
 * @param notaCoberta o mesmo `saldoDescobertoDaNota(...) === null` de sempre —
 * nunca uma segunda soma.
 */
export function motivoDaRetencaoAberta(
  linha: Pick<LinhaRetencao, "eDescontoEfetivo" | "quemRecolhe">,
  notaCoberta: boolean,
): MotivoRetencaoAberta | null {
  if (!linha.eDescontoEfetivo) return null;
  if (linha.quemRecolhe === "empresa") return null;
  if (linha.quemRecolhe === "eu") return notaCoberta ? null : "eu_sem_guia";
  return "sem_recolhedor";
}

/** Os dois estados que abrem a pendência — união FECHADA (ADENDO 4, Pergunta 1). */
export type MotivoRetencaoAberta = "sem_recolhedor" | "eu_sem_guia";

/** O que cada estado diz de si — as quatro coisas que a tela mostra, e só elas. */
export interface TextoDaRetencaoAberta {
  consequencia: string;
  chip: string;
  titulo: string;
  gravidade: Gravidade;
}

/**
 * **Um motivo, um conjunto de texto e cor — e a tela não escolhe nenhum dos
 * quatro.**
 *
 * `Record<MotivoRetencaoAberta, …>` é exaustivo de propósito: estado novo não
 * compila sem os quatro campos decididos. É o que impede a volta do bug deste
 * ticket, que era exatamente um estado sem texto próprio.
 *
 * ⚠️ **Nenhuma das duas cores é literal** (D54): as duas saem de
 * `gravidadeDaRegua` com os MESMOS dois fatos — o valor retido não saiu do bolso
 * dele (`dinheiroSaiu: false`) e a nota hábil existe (`apoioHabilNoAnoCerto:
 * true`). O que difere é a exceção nomeada:
 *
 * - **Estado A** invoca `"retencao_sem_recolhedor"`, que **agrava** para
 *   vermelho, com fundamento no ADENDO A.4 (*"passivo não identificado"*).
 * - **Estado C** invoca exceção NENHUMA, e a régua o pinta de âmbar sozinha —
 *   que é justamente o que o ADENDO 4, Pergunta 6, adjudicou: *"vermelho fica
 *   reservado exclusivamente para Estado A daqui em diante, nesta família"*.
 *   Não há exceção nova a declarar porque não há divergência da régua a
 *   declarar: aqui a régua já acertava, e era a exceção aplicada em bloco que
 *   errava.
 */
export const TEXTO_DA_RETENCAO_ABERTA: Record<
  MotivoRetencaoAberta,
  TextoDaRetencaoAberta
> = {
  sem_recolhedor: {
    consequencia: CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR,
    chip: CHIP_RETENCAO_SEM_RECOLHEDOR,
    titulo: TITULO_RETENCAO_SEM_RECOLHEDOR,
    gravidade: gravidadeDaRegua(
      { dinheiroSaiu: false, apoioHabilNoAnoCerto: true },
      "retencao_sem_recolhedor",
    ),
  },
  eu_sem_guia: {
    consequencia: CONSEQUENCIA_RETENCAO_EU_SEM_GUIA,
    chip: CHIP_RETENCAO_GUIA_PENDENTE,
    titulo: TITULO_RETENCAO_GUIA_PENDENTE,
    gravidade: gravidadeDaRegua({
      dinheiroSaiu: false,
      apoioHabilNoAnoCerto: true,
    }),
  },
};

/**
 * **O motivo do DOCUMENTO, quando as linhas dele discordam** (critério 6 /
 * ADENDO 4, Pergunta 4, ratificado pelo `contador`).
 *
 * > "se qualquer linha aberta do documento está em Estado A, o card mostra o
 * > conjunto de texto do Estado A (chip, título e parágrafo); só quando TODAS as
 * > linhas abertas estão em Estado C o card mostra o conjunto do Estado C."
 *
 * ⚠️ **Não existe terceiro texto "misto"**, e a razão é fiscal, não estética: o
 * card é resumo, e resumo correto é o do **pior caso** — enquanto houver uma
 * linha em A, a ação que falta primeiro continua sendo a de A. A granularidade
 * real mora no nível da linha, dentro de `/documento/[id]`, onde cada uma mostra
 * o seu próprio estado.
 *
 * A pendência é **por documento** desde o CONTAI-038 (N cartões repetindo o
 * mesmo remédio afogariam a lista), e é por isso que esta agregação existe.
 */
export function motivoDaRetencaoDoDocumento(
  linhas: readonly Pick<LinhaRetencao, "eDescontoEfetivo" | "quemRecolhe">[],
  notaCoberta: boolean,
): MotivoRetencaoAberta | null {
  const abertos = linhas
    .map((l) => motivoDaRetencaoAberta(l, notaCoberta))
    .filter((m): m is MotivoRetencaoAberta => m !== null);
  if (abertos.length === 0) return null;
  return abertos.includes("sem_recolhedor") ? "sem_recolhedor" : "eu_sem_guia";
}

/**
 * **CONTAI-056 — a linha conta como PERNA DE PAGAMENTO em `alocarCusto`?**
 *
 * Fonte: ADENDO 3 do parecer (2026-09-25), Pergunta 1, `[Certain]`, literal:
 *
 * > "a linha de retenção soma como perna de pagamento em `alocarCusto` **se e
 * > somente se** `e_desconto_efetivo = true` E
 * > `quem_recolhe ∈ {"empresa", "nao_sei"}`. Quando `quem_recolhe = "eu"`, a
 * > linha NUNCA soma."
 *
 * O teste do regime de caixa (IN SRF 84/2001, art. 17) é o mesmo nos três
 * estados — *a fatia já saiu, de forma definitiva e comprovável, da esfera
 * econômica dele, sem que ele ainda precise fazer nada mais para extingui-la?*
 * — e ele responde diferente:
 *
 * - **`"empresa"` / `"nao_sei"` → sim.** Ele transferiu o líquido e **não tem,
 *   daqui para frente, nenhum pagamento adicional a fazer** para quitar o preço
 *   da nota. O que resta é risco de compliance de TERCEIRO, não obrigação dele.
 * - **`"eu"` → não.** A obrigação não acabou, só migrou de "pagar ao prestador"
 *   para "pagar ao Fisco", e essa segunda perna (a GUIA) ainda não aconteceu:
 *   enquanto ela não existir, o dinheiro **está no bolso dele**. O mecanismo
 *   aqui continua sendo exclusivamente a guia como `Pagamento` de verdade — ver
 *   `linhaSemRecolhedor` logo acima, que o ADENDO 3 ratificou sem tocar numa
 *   linha.
 *
 * ⚠️ **A exclusão de `"eu"` é DE ESTADO, não de tempo** (ADENDO 3, literal):
 * não é "soma até a guia aparecer" — é "nunca soma", porque somar as duas
 * fontes depois da guia contaria o mesmo real duas vezes com dois nomes.
 *
 * ⚠️ `quemRecolhe === null` também **não** soma: o conjunto normativo é
 * `{"empresa", "nao_sei"}` e nada mais. `null` com `eDescontoEfetivo = true` é
 * estado que os CHECKs da 0017 e `validarLinhaRetencao` não deixam nascer; se
 * aparecer, é dado incompleto, e dado incompleto não vira custo.
 */
export function retencaoContaComoPerna(
  linha: Pick<LinhaRetencao, "eDescontoEfetivo" | "quemRecolhe">,
): boolean {
  if (!linha.eDescontoEfetivo) return false;
  return linha.quemRecolhe === "empresa" || linha.quemRecolhe === "nao_sei";
}

/**
 * ⚠️ **CITAÇÃO do ADENDO 2 (Pergunta 1) e do ADENDO 3 (Pergunta 1)** — a frase
 * que o critério 4 do CONTAI-056 pede no lugar de *"nota ainda não paga"*.
 * Montada com as sentenças do parecer, adaptadas só na pessoa ("o Mateus" →
 * "você"). **Nunca reescrever**: é ela que diz por que esta fatia é custo
 * comprovado sem nunca ter passado por um PIX.
 */
export const RETENCAO_EXPLICA_A_SOBRA =
  "Esta fatia da nota foi quitada por RETENÇÃO, não por transferência: você já " +
  "transferiu só o líquido e não tem, daqui para frente, nenhum pagamento " +
  "adicional a fazer para quitar o preço da nota. O que resta é saber se outra " +
  "pessoa recolheu ao Fisco — risco de compliance de terceiro, não uma " +
  "obrigação pendente sua.";

/** Rótulo do bloco do critério 4 — produto, não consequência fiscal. */
export const CHIP_QUITADO_POR_RETENCAO = "Quitado por retenção";

/**
 * **Critério 8 — o caso sobrecoberto, e ele é DEFEITO DE DADO, não regra
 * fiscal.** Mesma doutrina de `VINCULO_CRUZANDO_OBRAS_NAO_DEVERIA_EXISTIR`: o
 * app não engole a contradição nem estoura o número em silêncio — ele nomeia o
 * que não fecha e diz onde olhar. Nenhum parecer normatiza este caso porque ele
 * não é um fato fiscal possível: é dado errado em um dos dois lados.
 *
 * ⚠️ **A detecção não é completa, e a lacuna tem nome: D77** (Gate 2 do
 * CONTAI-056). Com duas notas no mesmo componente de vínculo (PIX
 * compartilhado), a retenção de uma pode cobrir o buraco da outra e esta
 * mensagem **não aparece**. Ver `docs/backlog.md` (D77) e o caso fixado em
 * `vinculo.test.ts`. A ausência do aviso não é prova de que não há contradição.
 */
export const RETENCAO_SOBRECOBERTA =
  "Dado contraditório: os pagamentos ligados a esta nota, somados à retenção " +
  "confirmada, passam do valor bruto dela. A parte que passa NÃO entrou no " +
  "custo — confira se o pagamento foi registrado pelo líquido ou pelo bruto, e " +
  "se o valor desta linha de retenção está como está impresso na nota.";

export const CHIP_RETENCAO_SOBRECOBERTA = "Retenção além do valor da nota";

/**
 * Como a perna de pagamento desta linha se chama — e a regra é dura (ADENDO
 * A.2): com composição combinada ou desconhecida, **nunca** "guia de ISS" ou
 * "guia de INSS". Só a linha que o Mateus identificou pode nomear o tributo.
 */
export function nomeDaRetencao(
  // ⚠️ `composicao` aceita `null` desde o CONTAI-053: a MESMA função descreve a
  // linha já gravada (`LinhaRetencao`) e a que ainda está só na tela da captura
  // (`EntradaLinhaRetencao`, onde tudo nasce `null`). Duas descrições da mesma
  // linha divergiriam, e a primeira coisa a divergir seria o rótulo do A.2.
  linha: { composicao: ComposicaoRetencao | null; tributo: TributoRetido | null },
): string {
  if (linha.composicao === "tributo_identificado" && linha.tributo !== null) {
    return NOME_TRIBUTO[linha.tributo];
  }
  return ROTULO_RETENCAO_NAO_DISCRIMINADA;
}

/** O que a linha diz de si mesma na lista do detalhe. */
export function descricaoDaComposicao(
  /** Mesma ampliação do `nomeDaRetencao` acima — CONTAI-053. */
  linha: { composicao: ComposicaoRetencao | null; tributo: TributoRetido | null },
): string {
  if (linha.composicao === "tributo_identificado" && linha.tributo !== null) {
    return `Tributo único identificado — ${NOME_TRIBUTO[linha.tributo]}`;
  }
  return OPCOES_COMPOSICAO.find((o) => o.valor === linha.composicao)?.texto ?? "";
}
