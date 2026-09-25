/**
 * O vínculo pagamento↔documento e o custo que ele comprova (CONTAI-018).
 * Módulo puro: nada de rede, nada de UI.
 *
 * Fonte normativa — parecer `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md`,
 * transcrito no Gate Fiscal do ticket. Nada aqui é inferido:
 *
 * - §2 "o clique em conciliar não é fiscal": o custo existe no mundo antes de
 *   qualquer clique. O que o app calcula é o que ele CONSEGUE DEMONSTRAR.
 * - §2 "sustentaCusto não deve consultar pagamento.status": a condição fiscal é
 *   *existe vínculo com documento hábil*. `status = 'conciliado'` é
 *   consequência gravada, nunca pré-requisito. É por isso que nenhuma função
 *   deste arquivo lê `status` de pagamento.
 * - §3 "custo comprovado = mínimo entre a soma dos pagamentos vinculados e a
 *   soma dos documentos hábeis vinculados; o excedente de qualquer lado cai na
 *   coluna correspondente".
 * - §5.5 "proibido inferir vínculo por heurística": aqui existe ordenação e
 *   rótulo de sugestão; criação de vínculo, nenhuma.
 * - §6 boleto e quarentena não sustentam custo.
 *
 * ⚠️ O MÍNIMO É POR COMPONENTE CONEXO, NUNCA PAR A PAR (critério 6). Cinco PIX
 * de R$ 600 ligados à mesma NF de R$ 3.000 são UM conjunto: o custo comprovado
 * é R$ 3.000. Somando par a par daria R$ 15.000 — a mesma nota contada cinco
 * vezes, custo inflado indo para a declaração, que o parecer §4 classifica
 * como a única direção de erro que produz passivo tributário.
 *
 * ## CONTAI-056 — a PERNA DE RETENÇÃO existe, e ela é a segunda fonte de custo
 *
 * Fonte: `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`, ADENDO 2
 * e ADENDO 3 (2026-09-25). Até 2026-09-25 **a palavra `retencao` não aparecia
 * neste arquivo** — e isso era um bug fiscal P0, não uma escolha: o A.2 daquele
 * parecer sempre normatizou que a linha `e_desconto_efetivo = true` "precisa
 * aparecer como **perna de pagamento** vinculada ao mesmo documento (mesmo
 * mecanismo do fechamento `Σ pagamentos == valor_bruto_nota`)". Sem ela, uma
 * nota de R$ 10,00 com R$ 0,50 retidos e R$ 9,50 transferidos ficava para
 * sempre com R$ 9,50 de custo comprovado e R$ 0,50 de *"nota ainda não paga"*,
 * subestimando o custo de aquisição — que é imposto a mais sobre o ganho de
 * capital, lá na frente.
 *
 * Três regras, e nenhuma delas é escolha de implementação:
 *
 * 1. **QUANDO conta** — `retencaoContaComoPerna` (`./retencao`): só
 *    `e_desconto_efetivo = true` E `quem_recolhe ∈ {"empresa", "nao_sei"}`.
 *    `"eu"` **nunca** soma: a perna dele é a GUIA, um `Pagamento` de verdade.
 * 2. **EM QUE ANO conta** — na data do **pagamento vinculado mais antigo do
 *    MESMO documento** (ADENDO 3, Pergunta 2). Sem pagamento vinculado, a
 *    linha não entra em ano nenhum: *"sem desembolso, não há dispêndio; sem
 *    dispêndio, não há data; sem data, a linha não entra em soma de ano
 *    nenhum"*. Não existe coluna de data em `documento_retencao`, e o parecer
 *    **rejeita** criá-la — data da nota é competência, e competência é o regime
 *    que este produto inteiro recusa.
 * 3. **NUNCA vira `Pagamento` sintético.** A perna mora em
 *    `Alocacao.porRetencao`, jamais em `porPagamento` — é isso que mantém a
 *    ficha **Pagamentos Efetuados** intocada por construção, e é isso que
 *    impede a retenção de aparecer em "pago sem nota".
 *
 * ⚠️ E o que NÃO mudou: **a aferição do SERO continua inteiramente alheia a
 * isto.** Nenhuma perna de retenção, contada ou não aqui, abate a base do CNO
 * (§2 do corpo, reafirmado em todos os adendos). `lib/fiscal/afericao.ts` não
 * importa este arquivo, e há guarda de import em `afericao.test.ts` travando
 * isso.
 */

import type {
  Documento,
  LinhaRetencao,
  Pagamento,
  ResolucaoDiferenca,
} from "@/lib/types";
import { anoCalendario } from "./pagamento";
import { retencaoContaComoPerna } from "./retencao";

/**
 * Documento hábil — mesma regra que já vigorava em `resumo.ts`:
 * - boleto NUNCA é hábil sozinho: é título de cobrança, não prova o que foi
 *   comprado nem quem é o destinatário;
 * - documento em quarentena não é hábil: está fora do CPF do dono;
 * - **documento sem arquivo não é hábil** (CONTAI-033, Guarda 1).
 *
 * Documento não hábil PARTICIPA da conectividade do grafo (é ele que liga
 * pagamentos entre si e permite a dedup dos critérios 8 e 9) e contribui ZERO
 * para a soma que forma o custo comprovado.
 *
 * ⚠️ **NUNCA LEIA `status` CRU PARA DECIDIR HABILIDADE** (dívida 2 do
 * CONTAI-033). `arquivo_path IS NULL` é uma SEGUNDA DIMENSÃO, fora do enum de
 * status: um documento pode estar `registrado` e não ser hábil. O predicado
 * mora só aqui, e a assinatura exige `arquivoPath` de propósito — é o typecheck
 * que varre os chamadores, não a convenção (pre-mortem 1 do ticket).
 *
 * Fonte da Guarda 1, parecer ADENDO 1 §A.3, `[Certain]`: o custo comprovado é
 * `C = min(Σ pagamentos elegíveis, Σ documentos hábeis)`. Pagamento sem
 * comprovante empurraria o PISO; documento sem arquivo levantaria o TETO — ou
 * seja, liberaria custo confirmado sem lastro nenhum, que é *redução indevida
 * de ganho de capital, cobrada com multa*. **"Documento sem arquivo não entra
 * em `Σ documentos`. Ponto."**
 *
 * Aqui **não** vale a nuance do §2.1 do corpo do parecer ("o app mostra, o
 * Mateus decide"): lá o número subestimava, aqui superestimaria. Direção do
 * erro invertida, tratamento invertido.
 */
export function ehDocumentoHabil(
  documento: Pick<Documento, "tipo" | "status" | "arquivoPath">,
): boolean {
  return (
    documento.tipo !== "boleto" &&
    documento.status !== "quarentena" &&
    documento.arquivoPath !== null
  );
}

// ── Textos com consequência fiscal ───────────────────────────────────────
// Copiados do parecer, não reescritos (regra do CLAUDE.md: texto de tela com
// consequência fiscal se copia da fonte).

/** Parecer §5.1 — o zero nunca aparece sozinho (critério 14). */
export const EXPLICACAO_CUSTO_ZERO =
  "Este número só conta o que o app consegue provar: pagamento e nota hábil " +
  "ligados entre si. Não significa que seu custo é zero — significa que o app " +
  "ainda não sabe qual pagamento pertence a qual nota.";

/** Parecer §5.2 — o terceiro número, que não soma com os outros dois. */
export const EXPLICACAO_NOTAS_SEM_PAGAMENTO =
  "Estas notas estão no seu CPF e valem como custo. Elas entram no " +
  '"custo confirmado" quando o pagamento correspondente estiver registrado e ' +
  "ligado a elas.";

/** Gate Fiscal do ticket, item 6 — dito na hora do vínculo (critério 8). */
export const VINCULO_QUARENTENA_NAO_GERA_CUSTO =
  "Esta nota está em quarentena. Ligar o pagamento é permitido e útil — deixa " +
  "de contar a mesma despesa duas vezes. Mas não gera custo confirmado.";

/** Critério 9 — vincular é a prova de que o boleto foi pago, e só isso. */
export const VINCULO_BOLETO_NAO_GERA_CUSTO =
  "Boleto não é documento hábil. Ligar o pagamento registra que ele foi pago, " +
  "mas não gera custo confirmado — o custo só se sustenta com a NF.";

/**
 * CONTAI-033, Guarda 1 — achado no teste manual no browser: este bloco só
 * sabia distinguir boleto de quarentena. Uma nota `registrado`, mas sem
 * arquivo, caía no `else` e mostrava o texto de QUARENTENA — errado, porque
 * ela não está fora do CPF do dono, só falta o papel. Terceira razão, texto
 * próprio.
 */
export const VINCULO_SEM_ARQUIVO_NAO_GERA_CUSTO =
  "Esta nota está sem o arquivo no acervo. Ligar o pagamento é permitido e " +
  "útil — deixa de contar a mesma despesa duas vezes. Mas não gera custo " +
  "confirmado até o arquivo chegar.";

/**
 * Documento hábil SEM valor informado (`valor_centavos` nulo). Ele contribui
 * zero para a soma hábil do conjunto, o que empurra o pagamento inteiro para
 * "pago sem nota" — e isso não pode acontecer em silêncio.
 */
export const DOCUMENTO_SEM_VALOR =
  "Esta nota está sem valor informado e por isso não comprova nada — complete " +
  "o valor para ela entrar no custo confirmado.";

/**
 * Critério 15 / C4 do Gate 2: quem já cobriu o registro por inteiro some do
 * seletor, e o sumiço mudo faz quem ligou o PIX à nota ERRADA não achá-lo na
 * nota certa — sem saber que precisa desligar antes.
 */
export const CANDIDATO_OCULTO_PAGAMENTO =
  "Pagamento já coberto por inteiro por outra nota não aparece nesta lista. Se " +
  "algum deles é desta nota, abra a nota errada e desligue-o antes de ligar aqui.";

export const CANDIDATO_OCULTO_DOCUMENTO =
  "Nota já coberta por inteiro por outro pagamento não aparece nesta lista. Se " +
  "alguma delas é deste pagamento, abra a nota e desligue o pagamento errado " +
  "antes de ligar aqui.";

/** Critério 11 — recusa com o motivo na tela, nunca em silêncio. */
export const MOTIVO_OBRA_DIFERENTE =
  "Este pagamento e este documento estão em obras diferentes. Nada é somado " +
  "entre obras — cada matrícula é um item da declaração. Corrija a obra de um " +
  "dos dois antes de ligar.";

// ── O valor ELEGÍVEL do pagamento (CONTAI-019, §F.3) ─────────────────────

/**
 * O que o pagamento tem de "obra" antes de encontrar qualquer documento.
 *
 * Este pedaço de código é o item 14b do CONTAI-019 e, nas palavras do próprio
 * ticket, "o único que passa por todos os testes de comportamento estando
 * errado". A regra, `[Certain]` no parecer §F.3:
 *
 *     pagamento elegível = pago − encargos − (diferença que não compõe custo)
 *     custo comprovado do conjunto = min(Σ elegíveis, Σ documentos hábeis)
 *
 * ⚠️ **O ENCARGO SAI DO PAGAMENTO ANTES DO TETO DO MÍNIMO, NUNCA DEPOIS.**
 * Prova de que a ordem não é cosmética (§F.3, com estes números): nota de
 * R$ 10.400, pago R$ 10.500 com R$ 500 de mora. Na ordem certa,
 * `min(10.000; 10.400) = 10.000`. Na ordem invertida,
 * `min(10.500; 10.400) = 10.400` — **R$ 400 de mora entrando como obra**, que
 * é o risco nº 1 do pre-mortem acontecendo dentro da fórmula.
 *
 * Por isso a subtração mora AQUI, na entrada de `alocarCusto`, e não numa
 * correção depois: não existe caminho em que a soma do componente veja o valor
 * cheio.
 */
type ComposicaoPagamento = Pick<
  Pagamento,
  | "valorCentavos"
  | "encargosCentavos"
  | "naoExplicadoCentavos"
  | "resolucaoDiferenca"
  | "comprovantePath"
>;

/**
 * A diferença não explicada volta a contar como custo (ainda não comprovado)?
 *
 * Mapa do §F.2, e ele é fechado:
 * - `null` — "não sei ainda": **fora**. É o único estado inicial permitido, e
 *   a direção segura é subestimar.
 * - `nao_compoe_custo` — mora, taxa, item não incorporado: **fora
 *   definitivamente**, e sem pendência: não há o que cobrar.
 * - `falta_documento` — é da obra e falta o documento: **dentro**, e o teto do
 *   mínimo a empurra para "pago sem nota", que é pendência acionável enquanto
 *   ainda há parcela a liberar (§F.1).
 * - `multiplos_documentos` — o pagamento cobriu mais de um documento:
 *   **dentro**. É o único caminho que aumenta o custo no ato, e ele se resolve
 *   por VÍNCULO: contando aqui, o custo sobe assim que o segundo documento
 *   hábil entra no conjunto conexo.
 * - `erro_digitacao` — **não é classificação fiscal** (§F.2, item 4). Tratado
 *   exatamente como "não sei ainda": fora, até a correção com rastro do
 *   CONTAI-021 acontecer. Deixá-lo "dentro" seria dar efeito fiscal a uma
 *   resposta que só diz "o registro está errado".
 * - `previsao_errada` — **dentro**, e é a resolução que o `contador`
 *   acrescentou no Gate 2 do CONTAI-019, `[Certain]`. Sem ela a aritmética da
 *   confirmação fazia o elegível COLAPSAR NO VALOR PREVISTO —
 *   `pago − encargos − (pago − previsto − encargos) = previsto` — e a
 *   **previsão virava o teto do custo**, que é o §2 inteiro sendo violado por
 *   dentro da fórmula que o §F.3 protege. Dizendo que a previsão é que estava
 *   errada, o valor pago volta inteiro para o elegível e **quem limita o custo
 *   volta a ser o documento hábil**, como sempre deveria ter sido.
 */
function diferencaContaComoCusto(
  resolucao: ResolucaoDiferenca | null,
): boolean {
  return (
    resolucao === "falta_documento" ||
    resolucao === "multiplos_documentos" ||
    resolucao === "previsao_errada"
  );
}

/** Encargos + a diferença que hoje não compõe custo. */
function parteForaDoCusto(p: ComposicaoPagamento): number {
  const diferencaFora = diferencaContaComoCusto(p.resolucaoDiferenca)
    ? 0
    : p.naoExplicadoCentavos;
  return p.encargosCentavos + diferencaFora;
}

/**
 * ⚠️ **Sem comprovante, o elegível é ZERO** (critérios 46-47 do CONTAI-019 e
 * ADENDO 2 do parecer). O pagamento GRAVA — *nunca recuse o registro de um
 * fato consumado* — mas **não entra no custo confirmado** até o comprovante
 * existir.
 *
 * Consequência intencional, e ela é o motivo de o zero ser aqui e não numa
 * pendência à parte: como o elegível é 0, `semNotaCentavos` também é 0, e
 * **o mesmo dinheiro não aparece em duas pendências**. A exposição desse
 * pagamento é "pago sem comprovante" (com o peso do §5 do ADENDO 2: âmbar para
 * PJ, vermelho para PF, onde o comprovante é constitutivo) — e só ela. Sem
 * isso, um PIX de R$ 10.000 sem comprovante e sem nota apareceria como
 * R$ 20.000 de exposição.
 */
export function valorElegivelDoPagamento(p: ComposicaoPagamento): number {
  if (p.comprovantePath === null) return 0;
  return Math.max(0, p.valorCentavos - parteForaDoCusto(p));
}

/**
 * O que ESTE pagamento colocaria no custo se o comprovante existisse — e que
 * hoje está fora só por causa dele. É o valor da pendência "pago sem
 * comprovante".
 *
 * Note que ele NÃO é o valor cheio do pagamento: encargos e diferença sem
 * explicação continuam fora por seus próprios motivos, e cada um aparece na
 * sua própria linha. As três parcelas particionam o pagamento exatamente, sem
 * somar o mesmo dinheiro duas vezes.
 */
export function valorBloqueadoPorComprovante(p: ComposicaoPagamento): number {
  if (p.comprovantePath !== null) return 0;
  return Math.max(0, p.valorCentavos - parteForaDoCusto(p));
}

/**
 * A parte deste pagamento que **ainda pode receber um documento** — a régua
 * das listas de candidatos e do botão "Ligar a uma nota".
 *
 * ⚠️ É pergunta DOCUMENTAL ("cabe ligar uma nota a isto?"), não fiscal
 * ("quanto está exposto?"), e as duas divergem em dois pontos:
 *
 * 1. **Encargos saem.** Juros e multa de mora nunca terão documento, e o §F.1
 *    é explícito em que ficam fora "para sempre e SEM PENDÊNCIA — não há o que
 *    cobrar". Mantê-los aqui deixaria um pagamento com R$ 320 de mora para
 *    sempre na lista de candidatos, mandando o Mateus procurar a nota de um
 *    juro.
 * 2. **A diferença resolvida como `nao_compoe_custo` sai também**, pela mesma
 *    razão e um degrau adiante (achado do `contador` no Gate 2): ela já foi
 *    classificada como algo que não é da obra, então cobrar documento para ela
 *    é ruído eterno no seletor.
 *
 * O que **FICA**: a diferença sem resposta, a `falta_documento`, a
 * `multiplos_documentos` e a `previsao_errada` — ligar uma nota é exatamente
 * como as três primeiras se explicam, e a quarta é custo real que precisa de
 * documento hábil para se sustentar.
 *
 * O **comprovante não entra nesta conta**: ele decide o CUSTO, não o vínculo.
 * Pagamento gravado sem comprovante tem elegível 0 e continua candidato a
 * receber a NF que já existe — ligar é sempre permitido.
 */
export function baseDocumentavel(p: ComposicaoPagamento): number {
  const jaClassificadoForaDaObra =
    p.resolucaoDiferenca === "nao_compoe_custo" ? p.naoExplicadoCentavos : 0;
  return Math.max(
    0,
    p.valorCentavos - p.encargosCentavos - jaClassificadoForaDaObra,
  );
}

// ── Guarda do critério 11 ────────────────────────────────────────────────

export type Permissao = { ok: true } | { ok: false; motivo: string };

/**
 * Vínculo só entre registros da MESMA obra (critério 11, Q9b do parecer).
 *
 * O banco não impede: `pagamento_documento` não tem `obra_id` nem check, e a
 * policy `dono_vinculo` só exige mesmo DONO. A guarda é aqui e no caminho de
 * escrita de `lib/data.ts` — as duas, porque a camada pura protege o cálculo e
 * a de escrita protege o banco.
 */
export function podeVincular(
  pagamento: Pick<Pagamento, "obraId">,
  documento: Pick<Documento, "obraId">,
): Permissao {
  if (pagamento.obraId !== documento.obraId) {
    return { ok: false, motivo: MOTIVO_OBRA_DIFERENTE };
  }
  return { ok: true };
}

// ── Alocação por componente conexo ───────────────────────────────────────

export interface PagamentoAlocado {
  pagamento: Pagamento;
  /**
   * O que deste pagamento pode virar custo: pago − encargos − diferença fora,
   * e ZERO sem comprovante. É este número, nunca `valorCentavos`, que entra na
   * soma do componente (§F.3 — a ordem é critério).
   */
  elegivelCentavos: number;
  /** Parte deste pagamento coberta por documento hábil — vira custo. */
  comprovadoCentavos: number;
  /**
   * O que sobra DO ELEGÍVEL: exposição "pago sem nota" (parecer §3).
   *
   * Sai do elegível, e não do valor cheio, de propósito: encargo não é "pago
   * sem nota" — é dinheiro que fica fora do custo PARA SEMPRE e **sem
   * pendência**, porque não há o que cobrar (§F.1). Cobrar nota de juros de
   * mora seria cobrar um documento que não existe.
   */
  semNotaCentavos: number;
}

/**
 * **A perna de retenção alocada — CONTAI-056.** Uma por linha de
 * `documento_retencao` que passou por `retencaoContaComoPerna` E cujo documento
 * tem ao menos um pagamento vinculado.
 *
 * ⚠️ **Não é um `Pagamento`, e não pode virar um.** Nenhuma transferência
 * aconteceu neste valor, em nenhuma data — o ADENDO 3 a chama de *"ficção de
 * quitação amarrada à nota"*. Ela mora em mapa próprio para que a ficha
 * Pagamentos Efetuados, "pago sem nota" e `semNotaDoAno` sigam vendo só
 * dinheiro que de fato mudou de conta.
 */
export interface RetencaoAlocada {
  linha: LinhaRetencao;
  /** A nota de onde a linha saiu. **Sempre a dela**, nunca a do componente. */
  documentoId: string;
  /**
   * O pagamento vinculado MAIS ANTIGO deste mesmo documento — quem empresta a
   * data. Guardado, e não recalculado adiante: "qual é o pagamento âncora" não
   * pode ter duas implementações (mesma lição de `notaCoberta`).
   */
  pagamentoAncoraId: string;
  /** ISO. A data-efeito: `dataPagamento` da âncora (ADENDO 3, Pergunta 2). */
  dataEfeito: string;
  /** O valor da linha inteiro, antes da repartição do componente. */
  valorCentavos: number;
  /** Quanto desta perna entrou no custo comprovado do componente. */
  comprovadoCentavos: number;
  /**
   * **Critério 8 — o que a perna NÃO conseguiu absorver.** Só é > 0 quando
   * pagamentos + retenção passam do bruto da nota, o que é DADO CONTRADITÓRIO
   * (pagamento registrado pelo bruto, ou valor de linha errado). Existe como
   * campo, e não como `continue` mudo, porque estouro silencioso é justamente o
   * que o critério proíbe.
   */
  naoAbsorvidoCentavos: number;
}

export interface DocumentoAlocado {
  documento: Documento;
  habil: boolean;
  /**
   * Parte da nota já coberta — por pagamento **ou por perna de retenção
   * qualificada** (CONTAI-056). É este número que a tela chama de "Custo
   * comprovado".
   */
  cobertoCentavos: number;
  /**
   * **"Nota ainda não paga"** (mock s8) — a fatia GENUINAMENTE sem destino.
   * NÃO vira custo: regime de caixa, sem desembolso não há dispêndio.
   *
   * ⚠️ **Era `excedenteNotaCentavos`, e o rename é do CONTAI-056, critério 3
   * do Gate Fiscal**: aquele campo colapsava dois motivos num número e num
   * texto — (a) falta pagamento de verdade e (b) a fatia já foi explicada por
   * retenção confirmada. Só (a) pode dizer "nota ainda não paga"; (b) mora em
   * `explicadoPorRetencaoCentavos`. O rename é deliberado (não existe alias):
   * é o typecheck que varre os leitores, não a convenção.
   */
  faltaPagamentoCentavos: number;
  /**
   * **Critério 4** — quanto do `cobertoCentavos` desta nota veio de perna de
   * retenção, e não de transferência. Já está DENTRO do coberto: não soma com
   * ele, decompõe-o. Zero na esmagadora maioria das notas.
   */
  explicadoPorRetencaoCentavos: number;
  /** Critério 8, por documento — ver `RetencaoAlocada.naoAbsorvidoCentavos`. */
  retencaoSobrecobertaCentavos: number;
  /** Pagamentos ligados a este documento, cronológicos. */
  pagamentos: Pagamento[];
}

export interface Componente {
  /** Estável: menor chave do componente. Serve de key de lista. */
  id: string;
  pagamentos: Pagamento[];
  documentos: Documento[];
  /**
   * Σ dos valores ELEGÍVEIS dos PAGAMENTOS (§F.3), nunca dos valores cheios.
   *
   * ⚠️ **A retenção NÃO entra aqui** — ela tem campo próprio, logo abaixo. O
   * campo continua significando exatamente o que o nome diz, e o piso do
   * mínimo é a soma dos dois (ver `custoComprovadoCentavos`). Dobrar o sentido
   * deste número seria a primeira coisa a divergir na próxima leitura.
   */
  somaPagamentosCentavos: number;
  /**
   * **CONTAI-056** — Σ das pernas de retenção qualificadas deste componente
   * (`retencaoContaComoPerna` + documento com pagamento vinculado).
   */
  somaRetencoesConfirmadasCentavos: number;
  /** Só documentos HÁBEIS somam aqui. */
  somaDocumentosHabeisCentavos: number;
  /**
   * `min(Σ pagamentos elegíveis + Σ retenções confirmadas, Σ documentos
   * hábeis)` — parecer §3, com a segunda perna do ADENDO 2/3.
   */
  custoComprovadoCentavos: number;
}

/**
 * Um vínculo vivo que aponta para documento FORA desta obra — o estado
 * inválido que o critério 11 do CONTAI-018 proíbe pela porta da frente.
 *
 * ⚠️ **Não é diagnóstico de cálculo: é a rede do critério 12 do CONTAI-008.**
 * O custo continua sendo o de sempre (o vínculo não soma entre obras, e não
 * pode), mas ele deixa de ser DESCARTADO EM SILÊNCIO.
 */
export interface VinculoOrfao {
  pagamentoId: string;
  documentoId: string;
}

/** Título do card da rede (CONTAI-008, critério 12). */
export const VINCULO_CRUZANDO_OBRAS_TITULO = "Vínculo entre obras diferentes";

/**
 * **A cor da rede — VERMELHA**, era `border-red` literal em `app/page.tsx`.
 *
 * Definição única desde o `CONTAI-042` (Gate Fiscal do `contador`, 2026-09-21),
 * lida pela home e pela fila unificada. **Não passa pela régua**: é defeito de
 * DADO, sem valor próprio (ver `VinculoCruzandoObras` em `resumo.ts` — somá-lo
 * contaria duas vezes um pagamento que já está em "pago sem nota"), e a régua
 * mede valor sustentado no ano certo.
 */
export const COR_VINCULO_CRUZANDO_OBRAS = "red" as const;

/**
 * O efeito, sem exagero e sem eufemismo — tudo aqui é derivado da própria
 * regra de `alocarCusto`, nada é inferido: o componente conexo não se forma
 * entre obras, então `min(Σ pagamentos, Σ documentos hábeis)` não enxerga esse
 * par em nenhuma das duas.
 */
export const VINCULO_CRUZANDO_OBRAS_EFEITO =
  "Um pagamento desta obra está ligado a uma nota que está em OUTRA obra. Esse " +
  'par não comprova custo em obra nenhuma: o pagamento conta como "pago sem ' +
  'nota" aqui, e a nota aparece sem pagamento lá. Corrija a obra de um dos ' +
  "dois — pagamento e nota têm de ficar na mesma obra.";

/**
 * ⚠️ A segunda frase é o ponto do critério 12: com as duas portas fechadas
 * (0009 e 0016), este card só acende se algo gravou o estado **por fora** do
 * app. Dizer isso é o que o transforma de ruído em sinal.
 */
export const VINCULO_CRUZANDO_OBRAS_NAO_DEVERIA_EXISTIR =
  "O app não tem mais por onde criar esse estado. Se ele apareceu, alguma " +
  "coisa o gravou fora das telas — confira antes de usar os números do ano.";

export interface Alocacao {
  componentes: Componente[];
  porPagamento: Map<string, PagamentoAlocado>;
  porDocumento: Map<string, DocumentoAlocado>;
  /**
   * **CONTAI-056** — as pernas de retenção, por `id` da linha de
   * `documento_retencao`. Vazio em toda obra sem retenção confirmada.
   *
   * ⚠️ Mapa SEPARADO de `porPagamento`, e a separação é a regra: perna de
   * retenção não é `Pagamento`, não entra na ficha Pagamentos Efetuados e não
   * aparece em "pago sem nota".
   */
  porRetencao: Map<string, RetencaoAlocada>;
  /**
   * Vazio em toda obra saudável. Ver `VinculoOrfao` e o critério 12 do
   * CONTAI-008: *"nenhum vínculo cruzando obras pode ser descartado sem que
   * alguém fique sabendo"*.
   */
  vinculosOrfaos: VinculoOrfao[];
}

export interface EntradaAlocacao {
  documentos: readonly Documento[];
  pagamentos: readonly Pagamento[];
}

function valorDocumento(documento: Documento): number {
  return documento.valorCentavos ?? 0;
}

/**
 * Ordem cronológica da alocação, com desempate estável por id.
 *
 * ⚠️ REGRA FISCAL RATIFICADA — não é decisão de implementação, e não se troca
 * por pro-rata "porque é mais justo". A repartição cronológica foi ratificada
 * pelo `contador` no Gate 2 do CONTAI-018 e está transcrita no ADENDO de
 * 2026-08-18 do parecer
 * `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md`:
 *
 *   Se um conjunto conexo tem custo comprovado C = min(Σ pagamentos,
 *   Σ documentos hábeis) e Σ pagamentos > C, então C é atribuído aos
 *   pagamentos do conjunto EM ORDEM CRESCENTE DE DATA DE PAGAMENTO, cada um
 *   absorvendo até o seu valor integral; o excedente ("pago sem nota") recai
 *   sobre os pagamentos mais recentes. Empate de data → ordem estável
 *   arbitrária (sem efeito fiscal: mesma data, mesmo ano-calendário).
 *
 * O fundamento decisivo é a IMUTABILIDADE DO ANO JÁ DECLARADO [Certain]:
 * sob esta regra, acrescentar um pagamento posterior NUNCA altera a alocação
 * de um pagamento anterior. Pro-rata mudaria o número de um ano por causa de
 * um fato de outro ano — contradizendo uma DAA já entregue. Ver o adendo para
 * os outros dois argumentos (fotografia de 31/12 e "pago sem nota" no
 * pagamento mais recente, o único ainda cobrável do empreiteiro, §4).
 */
function cronologico(a: Pagamento, b: Pagamento): number {
  if (a.dataPagamento !== b.dataPagamento) {
    return a.dataPagamento < b.dataPagamento ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

class Conjuntos {
  private pai = new Map<string, string>();

  raiz(x: string): string {
    const p = this.pai.get(x);
    if (p === undefined) {
      this.pai.set(x, x);
      return x;
    }
    if (p === x) return x;
    const r = this.raiz(p);
    this.pai.set(x, r);
    return r;
  }

  unir(a: string, b: string): void {
    const ra = this.raiz(a);
    const rb = this.raiz(b);
    if (ra === rb) return;
    // Menor chave vira raiz: o id do componente fica estável entre execuções.
    if (ra < rb) this.pai.set(rb, ra);
    else this.pai.set(ra, rb);
  }
}

/**
 * O cálculo central. Monta o grafo bipartido pagamento↔documento, acha os
 * componentes conexos e reparte o custo comprovado de cada um.
 *
 * Vínculo que aponta para documento fora desta entrada não soma nada — a
 * entrada é sempre de UMA obra, e nada soma entre obras.
 *
 * ⚠️ **ELE DEIXOU DE SER IGNORADO EM SILÊNCIO** (CONTAI-008, critério 12), e a
 * história de por quê é a razão de a rede existir:
 * - **documento**: `moverDocumentoDeObra` era um `UPDATE obra_id` seco e fazia
 *   o caso nascer pela porta dos fundos. **FECHADO** pelo CONTAI-021 (0009);
 * - **pagamento**: `moverPagamentoDeObra` era o MESMO `UPDATE` seco na direção
 *   inversa. **FECHADO** pelo CONTAI-008 (0016).
 *
 * Com as duas portas fechadas, este ramo virou inalcançável — e é exatamente
 * por isso que ele **reporta** em vez de `continue`. O critério 12 mudou o
 * verbo de propósito: *"fechar este ticket é fechar a porta; reportar é a rede
 * que sobra para o dia em que uma porta nova aparecer"*. Comentário honesto
 * não é rede. Quem lê `vinculosOrfaos` é `calcularResumo`, e de lá a home.
 */
export function alocarCusto(entrada: EntradaAlocacao): Alocacao {
  const { documentos, pagamentos } = entrada;
  const docPorId = new Map(documentos.map((d) => [d.id, d]));

  const conjuntos = new Conjuntos();
  const chaveP = (id: string) => `p:${id}`;
  const chaveD = (id: string) => `d:${id}`;
  const vinculosOrfaos: VinculoOrfao[] = [];

  for (const d of documentos) conjuntos.raiz(chaveD(d.id));
  for (const p of pagamentos) {
    conjuntos.raiz(chaveP(p.id));
    for (const documentoId of p.documentoIds) {
      if (!docPorId.has(documentoId)) {
        vinculosOrfaos.push({ pagamentoId: p.id, documentoId });
        continue;
      }
      conjuntos.unir(chaveP(p.id), chaveD(documentoId));
    }
  }

  const grupos = new Map<string, { pagamentos: Pagamento[]; documentos: Documento[] }>();
  const grupo = (chave: string) => {
    const raiz = conjuntos.raiz(chave);
    const atual = grupos.get(raiz) ?? { pagamentos: [], documentos: [] };
    grupos.set(raiz, atual);
    return atual;
  };
  for (const d of documentos) grupo(chaveD(d.id)).documentos.push(d);
  for (const p of pagamentos) grupo(chaveP(p.id)).pagamentos.push(p);

  const componentes: Componente[] = [];
  const porPagamento = new Map<string, PagamentoAlocado>();
  const porDocumento = new Map<string, DocumentoAlocado>();
  const porRetencao = new Map<string, RetencaoAlocada>();

  for (const [id, { pagamentos: pags, documentos: docs }] of grupos) {
    const ordenados = [...pags].sort(cronologico);
    // ⚠️ ELEGÍVEL, não `valorCentavos` — a subtração dos encargos acontece
    // ANTES do `Math.min` lá embaixo, e é isso que o critério 14b exige.
    const somaPagamentos = ordenados.reduce(
      (s, p) => s + valorElegivelDoPagamento(p),
      0,
    );
    const habeis = docs.filter(ehDocumentoHabil);
    const somaHabeis = habeis.reduce((s, d) => s + valorDocumento(d), 0);

    const pernasDeRetencao = pernasDeRetencaoDoGrupo(habeis, ordenados);
    const somaRetencoes = pernasDeRetencao.reduce(
      (s, r) => s + r.valorCentavos,
      0,
    );
    // ⚠️ **D77 mora nesta linha** (Gate 2 do CONTAI-056): o teto é do
    // COMPONENTE, e com mais de uma nota hábil no grupo ele deixa a perna de
    // retenção de uma cobrir o buraco da outra — a perna não é fungível entre
    // notas, mas este `min` não sabe disso. Ver `pernasEmOrdem` para o caso
    // numérico e `docs/backlog.md` (D77) para por que a correção é mudança de
    // modelo de dados, e não um ajuste aqui.
    const custoComprovado = Math.min(
      somaPagamentos + somaRetencoes,
      somaHabeis,
    );

    componentes.push({
      id,
      pagamentos: ordenados,
      documentos: docs,
      somaPagamentosCentavos: somaPagamentos,
      somaRetencoesConfirmadasCentavos: somaRetencoes,
      somaDocumentosHabeisCentavos: somaHabeis,
      custoComprovadoCentavos: custoComprovado,
    });

    // Reparte o custo comprovado entre as PERNAS do componente, da mais antiga
    // para a mais nova. É o que faz o custo cair no ano certo quando o
    // componente cruza anos-calendário (regime de caixa).
    //
    // A repartição do pagamento é pelo ELEGÍVEL: um pagamento com encargo
    // absorve até o principal dele, nunca até o valor cheio.
    let aDistribuir = custoComprovado;
    /** documentoId → quanto de perna de RETENÇÃO daquela nota foi absorvido. */
    const absorvidoPorRetencao = new Map<string, number>();
    /** documentoId → quanto de perna de retenção SOBROU (critério 8). */
    const sobrecobertaPorNota = new Map<string, number>();
    for (const perna of pernasEmOrdem(ordenados, pernasDeRetencao)) {
      const absorvido = Math.min(perna.valorCentavos, aDistribuir);
      aDistribuir -= absorvido;
      if (perna.tipo === "pagamento") {
        porPagamento.set(perna.pagamento.id, {
          pagamento: perna.pagamento,
          elegivelCentavos: perna.valorCentavos,
          comprovadoCentavos: absorvido,
          semNotaCentavos: perna.valorCentavos - absorvido,
        });
        continue;
      }
      const sobra = perna.valorCentavos - absorvido;
      porRetencao.set(perna.linha.id, {
        linha: perna.linha,
        documentoId: perna.documentoId,
        pagamentoAncoraId: perna.pagamentoAncoraId,
        dataEfeito: perna.dataEfeito,
        valorCentavos: perna.valorCentavos,
        comprovadoCentavos: absorvido,
        naoAbsorvidoCentavos: sobra,
      });
      somar(absorvidoPorRetencao, perna.documentoId, absorvido);
      somar(sobrecobertaPorNota, perna.documentoId, sobra);
    }

    // Do lado do documento a repartição do que veio de PAGAMENTO não tem efeito
    // fiscal nenhum: nada do que sobra na nota vira custo (regime de caixa).
    // Ordem estável por id só para a tela não dançar entre dois carregamentos.
    //
    // ⚠️ **A perna de retenção é a exceção: ela NÃO é fungível como um PIX.**
    // Ela é quitação DAQUELA nota, e atribuí-la a outra do mesmo componente
    // faria `explicadoPorRetencaoCentavos` apontar para o documento errado — os
    // dois motivos que os critérios 4 e 5 existem para separar voltariam a se
    // misturar, só num lugar mais difícil de ver. Por isso a cobertura sai em
    // duas passadas: primeiro cada nota recebe a retenção dela, depois o resto
    // se distribui.
    const habeisOrdenados = [...habeis].sort((a, b) => (a.id < b.id ? -1 : 1));
    let cobertura = custoComprovado;
    const daRetencao = new Map<string, number>();
    for (const d of habeisOrdenados) {
      const propria = Math.min(
        absorvidoPorRetencao.get(d.id) ?? 0,
        valorDocumento(d),
        cobertura,
      );
      cobertura -= propria;
      daRetencao.set(d.id, propria);
    }
    for (const d of habeisOrdenados) {
      const porRetencaoDaNota = daRetencao.get(d.id) ?? 0;
      const resto = Math.min(
        valorDocumento(d) - porRetencaoDaNota,
        cobertura,
      );
      cobertura -= resto;
      const coberto = porRetencaoDaNota + resto;
      porDocumento.set(d.id, {
        documento: d,
        habil: true,
        cobertoCentavos: coberto,
        faltaPagamentoCentavos: valorDocumento(d) - coberto,
        explicadoPorRetencaoCentavos: porRetencaoDaNota,
        retencaoSobrecobertaCentavos: sobrecobertaPorNota.get(d.id) ?? 0,
        pagamentos: ordenados.filter((p) => p.documentoIds.includes(d.id)),
      });
    }
    for (const d of docs) {
      if (porDocumento.has(d.id)) continue;
      // Não hábil: contribui 0, e não tem "falta pagar" a mostrar — o valor
      // inteiro dele está fora do custo por outro motivo (quarentena/boleto/
      // sem arquivo). Perna de retenção de nota não hábil também não existe:
      // ver `pernasDeRetencaoDoGrupo`.
      porDocumento.set(d.id, {
        documento: d,
        habil: false,
        cobertoCentavos: 0,
        faltaPagamentoCentavos: 0,
        explicadoPorRetencaoCentavos: 0,
        retencaoSobrecobertaCentavos: 0,
        pagamentos: ordenados.filter((p) => p.documentoIds.includes(d.id)),
      });
    }
  }

  return { componentes, porPagamento, porDocumento, porRetencao, vinculosOrfaos };
}

function somar(mapa: Map<string, number>, chave: string, valor: number): void {
  mapa.set(chave, (mapa.get(chave) ?? 0) + valor);
}

/** Uma perna de retenção antes de a repartição do componente tocá-la. */
interface PernaDeRetencao {
  linha: LinhaRetencao;
  documentoId: string;
  pagamentoAncoraId: string;
  dataEfeito: string;
  valorCentavos: number;
}

/**
 * **As pernas de retenção de um componente — CONTAI-056, regras 1 e 2.**
 *
 * Três portões, e cada um vem de uma frase do parecer:
 *
 * 1. **Só nota HÁBIL.** Não está escrito no ADENDO, e sim no §A.3 da Guarda 1:
 *    o custo é `min(Σ pagamentos, Σ documentos hábeis)`, e nota em quarentena /
 *    sem arquivo / boleto contribui ZERO para o teto. Deixar a perna de uma
 *    nota não hábil empurrar o PISO levantaria custo que o teto daquela nota
 *    não sustenta — e num componente com mais de uma nota, a perna de uma
 *    quitaria o valor da outra. Direção do erro: superestimar custo, a única
 *    que o §4 classifica como geradora de passivo tributário.
 * 2. **Só linha qualificada** — `retencaoContaComoPerna` (ADENDO 3, Pergunta 1).
 * 3. **Só nota com pagamento vinculado**, e a data é a do MAIS ANTIGO **deste
 *    documento** (ADENDO 3, Pergunta 2, "detalhe normativo"): *"dois documentos
 *    diferentes do mesmo favorecido não podem emprestar data um do outro"*, e
 *    *"'mais antigo' é o critério certo, não 'mais recente' nem 'o que fechou a
 *    nota'"* — a linha é reconhecida a partir do primeiro real que saiu da
 *    conta dele contra aquela nota.
 */
function pernasDeRetencaoDoGrupo(
  habeis: readonly Documento[],
  ordenados: readonly Pagamento[],
): PernaDeRetencao[] {
  const pernas: PernaDeRetencao[] = [];
  for (const d of habeis) {
    if (d.retencoes.length === 0) continue;
    // `ordenados` já está em ordem cronológica (com desempate estável por id),
    // então o primeiro que cita este documento É a âncora. Nenhuma segunda
    // ordenação, nenhum segundo critério de "mais antigo".
    const ancora = ordenados.find((p) => p.documentoIds.includes(d.id));
    if (ancora === undefined) continue;
    for (const linha of d.retencoes) {
      if (!retencaoContaComoPerna(linha)) continue;
      pernas.push({
        linha,
        documentoId: d.id,
        pagamentoAncoraId: ancora.id,
        dataEfeito: ancora.dataPagamento,
        valorCentavos: linha.valorCentavos,
      });
    }
  }
  return pernas;
}

type Perna =
  | { tipo: "pagamento"; pagamento: Pagamento; data: string; valorCentavos: number }
  | ({ tipo: "retencao"; data: string } & PernaDeRetencao);

/**
 * Pagamentos e pernas de retenção numa só fila cronológica.
 *
 * ⚠️ **No EMPATE DE DATA o pagamento real vem primeiro**, e isso não é
 * desempate cosmético. A data da perna de retenção é emprestada do pagamento
 * âncora, então empate é o caso NORMAL, não a exceção. Pondo o dinheiro que de
 * fato saiu na frente, o caso sobrecoberto (pagamentos + retenção > bruto da
 * nota, critério 8) sobra na PERNA DE RETENÇÃO — que é dado contraditório,
 * nomeado em `naoAbsorvidoCentavos`. Na ordem inversa, a ficção de quitação
 * absorveria custo e empurraria dinheiro real para "pago sem nota": uma
 * pendência falsa contra o Mateus, produzida por um número que o app inventou.
 *
 * ⚠️ **LIMITAÇÃO CONHECIDA — D77, e ela é do lado perigoso** (Gate 2 do
 * `CONTAI-056`, `cto-obra`, 2026-09-25). Esta fila vive DENTRO de um componente
 * conexo, e o `Math.min` que ela alimenta é do componente inteiro. Lá, um
 * pagamento É fungível entre as notas do grupo — mas a **perna de retenção não
 * é**: ela é quitação de UMA nota. Consequência: com duas notas no mesmo
 * componente (PIX compartilhado), a retenção de A pode absorver o buraco de B e
 * a sobrecobertura de A **não acende**. O caso numérico, fixado por teste em
 * `vinculo.test.ts` ("limitação conhecida D77"): A de R$ 10.000 paga pelo BRUTO
 * + retenção de R$ 500, B de R$ 10.000 paga R$ 9.500, PIX compartilhado →
 * custo R$ 20.000 e `retencaoSobrecobertaCentavos = 0`, quando o defensável é
 * R$ 19.500 com a contradição de A acesa. **Superestima custo**, que é a direção
 * do §4. A passada dedicada do lado do documento (em `alocarCusto`) resolve a
 * ATRIBUIÇÃO do "explicado por retenção" à nota certa, mas não o TETO: corrigir
 * o teto exige valor por VÍNCULO, não por componente — mudança de modelo de
 * dados, declarada fora do escopo do `CONTAI-056`. Ver `docs/backlog.md`, D77.
 */
function pernasEmOrdem(
  ordenados: readonly Pagamento[],
  retencoes: readonly PernaDeRetencao[],
): Perna[] {
  if (retencoes.length === 0) {
    return ordenados.map((p) => ({
      tipo: "pagamento",
      pagamento: p,
      data: p.dataPagamento,
      valorCentavos: valorElegivelDoPagamento(p),
    }));
  }
  const pernas: Perna[] = [
    ...ordenados.map(
      (p): Perna => ({
        tipo: "pagamento",
        pagamento: p,
        data: p.dataPagamento,
        valorCentavos: valorElegivelDoPagamento(p),
      }),
    ),
    ...retencoes.map((r): Perna => ({ tipo: "retencao", data: r.dataEfeito, ...r })),
  ];
  const chave = (p: Perna) =>
    p.tipo === "pagamento" ? p.pagamento.id : p.linha.id;
  return pernas.sort((a, b) => {
    if (a.data !== b.data) return a.data < b.data ? -1 : 1;
    if (a.tipo !== b.tipo) return a.tipo === "pagamento" ? -1 : 1;
    const ia = chave(a);
    const ib = chave(b);
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  });
}

// ── Leituras derivadas ───────────────────────────────────────────────────

/**
 * Custo comprovado do ano-calendário — regime de caixa, pela data do pagamento.
 *
 * ⚠️ **As DUAS pernas entram** (CONTAI-056): pagamentos pela `dataPagamento`,
 * pernas de retenção pela `dataEfeito` (a data do pagamento vinculado mais
 * antigo da nota delas). Somar só a primeira era o bug P0 do ADENDO 2 — o
 * número que alimenta a ficha Bens e Direitos saía menor que o custo real.
 */
export function custoComprovadoDoAno(alocacao: Alocacao, ano: number): number {
  let total = 0;
  for (const a of alocacao.porPagamento.values()) {
    if (anoCalendario(a.pagamento.dataPagamento) === ano) {
      total += a.comprovadoCentavos;
    }
  }
  for (const r of alocacao.porRetencao.values()) {
    if (anoCalendario(r.dataEfeito) === ano) total += r.comprovadoCentavos;
  }
  return total;
}

/** Custo comprovado acumulado até 31/12 do ano (ficha Bens e Direitos). */
export function custoComprovadoAteOAno(alocacao: Alocacao, ano: number): number {
  let total = 0;
  for (const a of alocacao.porPagamento.values()) {
    if (anoCalendario(a.pagamento.dataPagamento) <= ano) {
      total += a.comprovadoCentavos;
    }
  }
  for (const r of alocacao.porRetencao.values()) {
    if (anoCalendario(r.dataEfeito) <= ano) total += r.comprovadoCentavos;
  }
  return total;
}

/**
 * As pernas de retenção de UM componente. Existe para que `revisao.ts` e
 * `resumo.ts` não escrevam cada um o seu "quais retenções são deste cluster" —
 * `porRetencao` é indexado por linha, não por componente, e reconstruir o elo
 * duas vezes é como os dois números do mesmo fato começam a divergir.
 */
export function retencoesDoComponente(
  alocacao: Alocacao,
  componente: Componente,
): RetencaoAlocada[] {
  const doComponente = new Set(componente.documentos.map((d) => d.id));
  return [...alocacao.porRetencao.values()].filter((r) =>
    doComponente.has(r.documentoId),
  );
}

/**
 * O terceiro estado do parecer §5.2: documentos hábeis registrados que ainda
 * não têm NENHUM pagamento ligado. Não soma com o custo confirmado nem com o
 * custo em risco.
 *
 * É "nenhum pagamento ligado", e não "parte não coberta": a nota parcialmente
 * paga aparece na tela dela mesma, como excedente (mock s8). Se ela deve ou
 * não entrar neste número é pergunta em aberto do próprio mock, e o app não a
 * responde sozinho.
 */
export function documentosHabeisSemPagamento(
  alocacao: Alocacao,
): DocumentoAlocado[] {
  return [...alocacao.porDocumento.values()].filter(
    (d) => d.habil && d.pagamentos.length === 0,
  );
}

/**
 * Quanto FALTA pagar desta nota, em centavos, ou `null` quando não dá para
 * afirmar. É LEITURA DERIVADA de `alocarCusto` — de propósito não recalcula
 * cobertura nenhuma: "quanto falta nesta nota" não pode ter duas fontes de
 * verdade, e a que fica é a que produz o número da home (mesma lição do
 * `alocarSimulando`).
 *
 * Serve para SUGERIR o valor de um pagamento que nasce ligado à nota: a
 * empreiteira emite nota por medição e o pagamento costuma bater com ela. É
 * sugestão em campo editável, nunca cálculo fiscal.
 *
 * Devolve `null` — campo vazio, que pergunta em vez de afirmar — quando:
 * - a nota está sem valor informado (não há o que sugerir);
 * - a nota NÃO é hábil (boleto, quarentena): `alocarCusto` mantém a cobertura
 *   dela em zero por decisão fiscal, então "valor − coberto" devolveria o
 *   valor CHEIO mesmo depois de paga — era por aí que a segunda parcela viria
 *   com o total de novo e o custo entraria em dobro;
 * - a nota já está coberta por inteiro (não falta nada a pagar).
 *
 * ⚠️ **Lê só a falta GENUÍNA** (`faltaPagamentoCentavos`), nunca a fatia
 * explicada por retenção — CONTAI-056, critério 3 do Gate Fiscal. É por aqui
 * que o efeito atravessa: a nota cujo bruto fecha com líquido + retenção
 * qualificada devolve `null` (nada a pagar), e é isso que faz `notaCoberta`
 * parar de alarmar um caso já encerrado. Com `quem_recolhe = "eu"` a perna não
 * soma, a falta continua de pé, e a pendência da GUIA segue aberta — o
 * mecanismo do ADENDO 3 que não muda uma linha.
 */
export function saldoDescobertoDaNota(
  documento: Documento,
  alocacao: Alocacao,
): number | null {
  if (documento.valorCentavos === null) return null;
  const alocado = alocacao.porDocumento.get(documento.id);
  if (!alocado || !alocado.habil) return null;
  return alocado.faltaPagamentoCentavos > 0
    ? alocado.faltaPagamentoCentavos
    : null;
}

/**
 * **A nota já está coberta por inteiro pelos pagamentos vinculados?**
 *
 * É o fechamento `Σ pagamentos vinculados == valor_bruto_nota` normatizado no
 * parecer de 2026-08-18 §4.1, em UMA função — e é isso que o CONTAI-038 lê para
 * fechar a pendência de *"eu recolho"* (Gate Fiscal, P1).
 *
 * ⚠️ **Existe porque o predicado estava DUPLICADO** (Gate 2 do CONTAI-038,
 * `cto-obra`): a mesma expressão morava em `lib/fiscal/resumo.ts` e em
 * `app/documento/[id]/page.tsx`, e mexer só numa faria a home e o detalhe
 * discordarem sobre a MESMA pendência — a home mostrando vermelho e a tela
 * dizendo que fechou, ou o contrário.
 *
 * ⚠️ **`ehDocumentoHabil` na frente, e o guarda não é redundante**: numa nota
 * SEM ARQUIVO (ou em quarentena, ou boleto) `saldoDescobertoDaNota` devolve
 * `null` por ser **inaplicável** — *"não dá para afirmar"* —, não por estar
 * paga. Sem este `&&`, aquele `null` fecharia a pendência de quem recolhe numa
 * nota que não sustenta nada: o erro na direção errada.
 */
export function notaCoberta(documento: Documento, alocacao: Alocacao): boolean {
  return ehDocumentoHabil(documento) && saldoDescobertoDaNota(documento, alocacao) === null;
}

/** Componentes que efetivamente comprovam custo — a "despesa comprovada" (critério 13). */
export function despesasComprovadas(alocacao: Alocacao): Componente[] {
  return alocacao.componentes.filter((c) => c.custoComprovadoCentavos > 0);
}

// ── Candidatos do seletor (ordena e sugere; nunca vincula) ───────────────

export interface Candidato<T> {
  item: T;
  /**
   * Rótulo de sugestão, ou `null`. É ORDENAÇÃO E RÓTULO — parecer §5.5:
   * "sugere, nunca vincula sozinho". Nenhum candidato nasce marcado, e não
   * existe ação em lote que ligue sem conferência item a item (critério 10).
   */
  sugestao: string | null;
}

const SUGESTAO_FAVORECIDO_E_VALOR = "Sugestão — mesmo favorecido e mesmo valor";
const SUGESTAO_FAVORECIDO = "Sugestão — mesmo favorecido, valor diferente";

function mesmoFavorecido(
  a: { favorecidoNome: string | null },
  b: { favorecidoNome: string | null },
): boolean {
  return (
    a.favorecidoNome !== null &&
    b.favorecidoNome !== null &&
    a.favorecidoNome.trim().toLocaleLowerCase("pt-BR") ===
      b.favorecidoNome.trim().toLocaleLowerCase("pt-BR")
  );
}

function rotular(favorecidoIgual: boolean, valorIgual: boolean): string | null {
  if (favorecidoIgual && valorIgual) return SUGESTAO_FAVORECIDO_E_VALOR;
  if (favorecidoIgual) return SUGESTAO_FAVORECIDO;
  return null;
}

/**
 * Sobra parte deste pagamento sem nota? Só quem tem saldo é candidato.
 *
 * ⚠️ Aqui a conta NÃO é sobre `semNotaCentavos`, que sai do elegível: é sobre
 * a base DOCUMENTÁVEL (ver abaixo) menos o comprovado. A pergunta desta função é
 * DOCUMENTAL ("ainda cabe ligar uma nota a este pagamento?"), não fiscal
 * ("quanto dele está exposto?").
 *
 * A diferença aparece exatamente no caso do CONTAI-019: pagamento gravado SEM
 * comprovante tem elegível 0 e, portanto, `semNotaCentavos` 0. Se o seletor
 * lesse a exposição, ele sumiria da lista de candidatos — e o Mateus não
 * conseguiria ligar a NF que já tem enquanto não achasse o comprovante do PIX,
 * com o app calado sobre o motivo. Ligar a nota é sempre permitido; o que o
 * comprovante decide é o custo, não o vínculo.
 */
function temSaldoSemNota(pagamento: Pagamento, alocacao: Alocacao): boolean {
  const comprovado = alocacao.porPagamento.get(pagamento.id)?.comprovadoCentavos ?? 0;
  return baseDocumentavel(pagamento) - comprovado > 0;
}

/**
 * Sobra parte desta nota sem pagamento? Documento não hábil sempre sobra.
 *
 * Pela FALTA GENUÍNA (CONTAI-056): a nota cujo bruto já fechou com líquido +
 * retenção qualificada sai do seletor de candidatos, como qualquer nota paga por
 * inteiro — e continua achável pelo contador de ocultos (`CANDIDATO_OCULTO_*`).
 */
function temSaldoDescoberto(documento: Documento, alocacao: Alocacao): boolean {
  const alocado = alocacao.porDocumento.get(documento.id);
  if (!alocado || !alocado.habil) return true;
  return alocado.faltaPagamentoCentavos > 0;
}

/**
 * Os que o filtro acima ESCONDEU por já estarem cobertos por inteiro — e não
 * por serem de outra obra ou já estarem ligados a este registro. A tela conta
 * quantos são e diz o motivo (C4): sumiço mudo faz quem ligou o PIX à nota
 * errada não achá-lo na nota certa.
 */
export function pagamentosOcultosPorCobertura(
  documento: Documento,
  pagamentos: readonly Pagamento[],
  alocacao: Alocacao,
): Pagamento[] {
  return pagamentos.filter(
    (p) =>
      podeVincular(p, documento).ok &&
      !p.documentoIds.includes(documento.id) &&
      !temSaldoSemNota(p, alocacao),
  );
}

export function documentosOcultosPorCobertura(
  pagamento: Pagamento,
  documentos: readonly Documento[],
  alocacao: Alocacao,
): Documento[] {
  return documentos.filter(
    (d) =>
      podeVincular(pagamento, d).ok &&
      !pagamento.documentoIds.includes(d.id) &&
      !temSaldoDescoberto(d, alocacao),
  );
}

/**
 * Pagamentos que podem ser ligados a este documento, ordenados.
 *
 * Só entram os da MESMA obra (critério 11), os que ainda não estão ligados a
 * este documento, e os que ainda têm parte sem nota — um pagamento já coberto
 * por inteiro não é candidato a nada. Isso mantém visível o pagamento ligado só
 * a boleto (critério 9), que é justamente o caso "boleto pago, NF chega
 * depois".
 *
 * Ordem: mesmo favorecido primeiro, depois mesmo valor, depois a menor
 * diferença de valor, e por fim data e id — para a lista não dançar.
 * "Data próxima" não entra na comparação com o documento porque `documento`
 * não tem data de emissão no schema de hoje (o próprio parecer §6 pede que
 * `data_emissao` seja completado; a coluna não existe).
 */
export function pagamentosCandidatos(
  documento: Documento,
  pagamentos: readonly Pagamento[],
  alocacao: Alocacao,
): Candidato<Pagamento>[] {
  const alvo = valorDocumento(documento);
  return pagamentos
    .filter((p) => podeVincular(p, documento).ok)
    .filter((p) => !p.documentoIds.includes(documento.id))
    .filter((p) => temSaldoSemNota(p, alocacao))
    .map((p) => ({
      item: p,
      favorecidoIgual: mesmoFavorecido(p, documento),
      valorIgual: p.valorCentavos === alvo,
      diferenca: Math.abs(p.valorCentavos - alvo),
    }))
    .sort(
      (a, b) =>
        Number(b.favorecidoIgual) - Number(a.favorecidoIgual) ||
        Number(b.valorIgual) - Number(a.valorIgual) ||
        a.diferenca - b.diferenca ||
        cronologico(a.item, b.item),
    )
    .map(({ item, favorecidoIgual, valorIgual }) => ({
      item,
      sugestao: rotular(favorecidoIgual, valorIgual),
    }));
}

/**
 * O caminho inverso (critério 3): documentos que podem ser ligados a este
 * pagamento. Documento não hábil continua na lista — vincular boleto e
 * quarentena é permitido (critérios 8 e 9), e é o que permite a dedup.
 */
export function documentosCandidatos(
  pagamento: Pagamento,
  documentos: readonly Documento[],
  alocacao: Alocacao,
): Candidato<Documento>[] {
  return documentos
    .filter((d) => podeVincular(pagamento, d).ok)
    .filter((d) => !pagamento.documentoIds.includes(d.id))
    .filter((d) => temSaldoDescoberto(d, alocacao))
    .map((d) => ({
      item: d,
      favorecidoIgual: mesmoFavorecido(pagamento, d),
      valorIgual: valorDocumento(d) === pagamento.valorCentavos,
      diferenca: Math.abs(valorDocumento(d) - pagamento.valorCentavos),
    }))
    .sort(
      (a, b) =>
        Number(b.favorecidoIgual) - Number(a.favorecidoIgual) ||
        Number(b.valorIgual) - Number(a.valorIgual) ||
        a.diferenca - b.diferenca ||
        (a.item.id < b.item.id ? -1 : 1),
    )
    .map(({ item, favorecidoIgual, valorIgual }) => ({
      item,
      sugestao: rotular(favorecidoIgual, valorIgual),
    }));
}

// ── Simulação: o efeito no custo ANTES do toque ──────────────────────────

/** Um vínculo hipotético, do jeito que a tela o manipula antes de gravar. */
export interface ParVinculo {
  pagamentoId: string;
  documentoId: string;
}

/**
 * A MESMA `alocarCusto`, sobre o painel REAL da obra, com vínculos
 * hipotéticos aplicados. É assim que as telas dizem o efeito no custo ANTES do
 * toque (critério 15): comparando `alocarCusto(painel)` com
 * `alocarSimulando(painel, ...)` e mostrando "antes → depois".
 *
 * ⚠️ Existiam aqui duas funções de PREVISÃO (removidas no Gate 2 loop 2 do
 * CONTAI-018 — `git log` deste arquivo) que simulavam o documento e os
 * pagamentos marcados ISOLADOS DO RESTO DO GRAFO, com os valores integrais. Era uma SEGUNDA implementação da regra fiscal central, e
 * mais fraca que a primeira: ignorando que o candidato pode estar
 * PARCIALMENTE COBERTO por outro vínculo, ela anunciava custo MAIOR que o
 * real (pagamento de R$ 3.000 já coberto em R$ 1.000 anunciava R$ 3.000 de
 * acréscimo quando o real era R$ 2.000). Superestimar custo é a direção
 * perigosa do parecer §4 — a que gera passivo tributário. O `contador` mandou
 * aposentá-las no Gate 2 do CONTAI-018: duas implementações da mesma regra
 * divergem sempre, e a que fica é a que produz o número da home.
 */
export function alocarSimulando(
  entrada: EntradaAlocacao,
  mudanca: {
    adicionar?: readonly ParVinculo[];
    remover?: readonly ParVinculo[];
  },
): Alocacao {
  const adicionar = mudanca.adicionar ?? [];
  const remover = mudanca.remover ?? [];
  if (adicionar.length === 0 && remover.length === 0) return alocarCusto(entrada);

  const pagamentos = entrada.pagamentos.map((p) => {
    const somar = adicionar
      .filter((x) => x.pagamentoId === p.id)
      .map((x) => x.documentoId);
    const tirar = new Set(
      remover.filter((x) => x.pagamentoId === p.id).map((x) => x.documentoId),
    );
    if (somar.length === 0 && tirar.size === 0) return p;
    return {
      ...p,
      documentoIds: [
        ...new Set([
          ...p.documentoIds.filter((id) => !tirar.has(id)),
          ...somar,
        ]),
      ],
    };
  });

  return alocarCusto({ documentos: entrada.documentos, pagamentos });
}
