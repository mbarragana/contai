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
 */

import type { Documento, Pagamento, ResolucaoDiferenca } from "@/lib/types";
import { anoCalendario } from "./pagamento";

/**
 * Documento hábil — mesma regra que já vigorava em `resumo.ts`:
 * - boleto NUNCA é hábil sozinho: é título de cobrança, não prova o que foi
 *   comprado nem quem é o destinatário;
 * - documento em quarentena não é hábil: está fora do CPF do dono.
 *
 * Documento não hábil PARTICIPA da conectividade do grafo (é ele que liga
 * pagamentos entre si e permite a dedup dos critérios 8 e 9) e contribui ZERO
 * para a soma que forma o custo comprovado.
 */
export function ehDocumentoHabil(
  documento: Pick<Documento, "tipo" | "status">,
): boolean {
  return documento.tipo !== "boleto" && documento.status !== "quarentena";
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

export interface DocumentoAlocado {
  documento: Documento;
  habil: boolean;
  /** Parte da nota já coberta por pagamento. */
  cobertoCentavos: number;
  /**
   * "Nota ainda não paga" (mock s8). NÃO vira custo: regime de caixa, sem
   * desembolso não há dispêndio.
   */
  excedenteNotaCentavos: number;
  /** Pagamentos ligados a este documento, cronológicos. */
  pagamentos: Pagamento[];
}

export interface Componente {
  /** Estável: menor chave do componente. Serve de key de lista. */
  id: string;
  pagamentos: Pagamento[];
  documentos: Documento[];
  /** Σ dos valores ELEGÍVEIS (§F.3), nunca dos valores cheios. */
  somaPagamentosCentavos: number;
  /** Só documentos HÁBEIS somam aqui. */
  somaDocumentosHabeisCentavos: number;
  /** min(Σ pagamentos, Σ documentos hábeis) — parecer §3. */
  custoComprovadoCentavos: number;
}

export interface Alocacao {
  componentes: Componente[];
  porPagamento: Map<string, PagamentoAlocado>;
  porDocumento: Map<string, DocumentoAlocado>;
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
 * Vínculo que aponta para documento fora desta entrada é IGNORADO — a entrada
 * é sempre de UMA obra (nada soma entre obras), e o critério 11 impede que
 * esse caso nasça pela interface.
 *
 * ⚠️ ACRÉSCIMO DE 2026-08-19 (CONTAI-021, critério 13). A frase acima estava
 * FALSA pelos dois lados, e continua falsa por um deles:
 * - **documento**: `moverDocumentoDeObra` era um `UPDATE obra_id` seco e fazia
 *   o caso nascer pela porta dos fundos. **FECHADO** pelo CONTAI-021: o move
 *   virou ato transacional que resolve cada pagamento vinculado, um a um, e
 *   não conclui com pagamento indeciso (migration 0009).
 * - **pagamento**: `moverPagamentoDeObra` (`/pagamento/[id]/obra`) é o MESMO
 *   `UPDATE` seco, na direção inversa, e **continua aberto** — é o critério 12
 *   do `CONTAI-008`, reaberto em 19/08. Enquanto ele existir, este `continue`
 *   segue engolindo em silêncio um vínculo que cruza duas obras.
 * Se `alocarCusto` deve REPORTAR o vínculo órfão como rede de segurança, em
 * vez de ignorá-lo, é pergunta de arquitetura registrada para o Gate 2 do
 * CONTAI-021 — não se decide aqui, e nada neste arquivo mudou por causa dela.
 */
export function alocarCusto(entrada: EntradaAlocacao): Alocacao {
  const { documentos, pagamentos } = entrada;
  const docPorId = new Map(documentos.map((d) => [d.id, d]));

  const conjuntos = new Conjuntos();
  const chaveP = (id: string) => `p:${id}`;
  const chaveD = (id: string) => `d:${id}`;

  for (const d of documentos) conjuntos.raiz(chaveD(d.id));
  for (const p of pagamentos) {
    conjuntos.raiz(chaveP(p.id));
    for (const documentoId of p.documentoIds) {
      if (!docPorId.has(documentoId)) continue;
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
    const custoComprovado = Math.min(somaPagamentos, somaHabeis);

    componentes.push({
      id,
      pagamentos: ordenados,
      documentos: docs,
      somaPagamentosCentavos: somaPagamentos,
      somaDocumentosHabeisCentavos: somaHabeis,
      custoComprovadoCentavos: custoComprovado,
    });

    // Reparte o custo comprovado entre os pagamentos, do mais antigo para o
    // mais novo. É o que faz o custo cair no ano certo quando o componente
    // cruza anos-calendário (regime de caixa).
    //
    // A repartição também é pelo ELEGÍVEL: um pagamento com encargo absorve
    // até o principal dele, nunca até o valor cheio.
    let aDistribuir = custoComprovado;
    for (const p of ordenados) {
      const elegivel = valorElegivelDoPagamento(p);
      const comprovado = Math.min(elegivel, aDistribuir);
      aDistribuir -= comprovado;
      porPagamento.set(p.id, {
        pagamento: p,
        elegivelCentavos: elegivel,
        comprovadoCentavos: comprovado,
        semNotaCentavos: elegivel - comprovado,
      });
    }

    // Do lado do documento a repartição não tem efeito fiscal nenhum: nada do
    // que sobra na nota vira custo (regime de caixa). Ordem estável por id só
    // para a tela não dançar entre dois carregamentos.
    const habeisOrdenados = [...habeis].sort((a, b) => (a.id < b.id ? -1 : 1));
    let cobertura = custoComprovado;
    for (const d of habeisOrdenados) {
      const coberto = Math.min(valorDocumento(d), cobertura);
      cobertura -= coberto;
      porDocumento.set(d.id, {
        documento: d,
        habil: true,
        cobertoCentavos: coberto,
        excedenteNotaCentavos: valorDocumento(d) - coberto,
        pagamentos: ordenados.filter((p) => p.documentoIds.includes(d.id)),
      });
    }
    for (const d of docs) {
      if (porDocumento.has(d.id)) continue;
      // Não hábil: contribui 0, e não tem "excedente" a mostrar — o valor
      // inteiro dele está fora do custo por outro motivo (quarentena/boleto).
      porDocumento.set(d.id, {
        documento: d,
        habil: false,
        cobertoCentavos: 0,
        excedenteNotaCentavos: 0,
        pagamentos: ordenados.filter((p) => p.documentoIds.includes(d.id)),
      });
    }
  }

  return { componentes, porPagamento, porDocumento };
}

// ── Leituras derivadas ───────────────────────────────────────────────────

/** Custo comprovado do ano-calendário — regime de caixa, pela data do pagamento. */
export function custoComprovadoDoAno(alocacao: Alocacao, ano: number): number {
  let total = 0;
  for (const a of alocacao.porPagamento.values()) {
    if (anoCalendario(a.pagamento.dataPagamento) === ano) {
      total += a.comprovadoCentavos;
    }
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
  return total;
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
 */
export function saldoDescobertoDaNota(
  documento: Documento,
  alocacao: Alocacao,
): number | null {
  if (documento.valorCentavos === null) return null;
  const alocado = alocacao.porDocumento.get(documento.id);
  if (!alocado || !alocado.habil) return null;
  return alocado.excedenteNotaCentavos > 0 ? alocado.excedenteNotaCentavos : null;
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

/** Sobra parte desta nota sem pagamento? Documento não hábil sempre sobra. */
function temSaldoDescoberto(documento: Documento, alocacao: Alocacao): boolean {
  const alocado = alocacao.porDocumento.get(documento.id);
  if (!alocado || !alocado.habil) return true;
  return alocado.excedenteNotaCentavos > 0;
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
