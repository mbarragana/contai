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

import type { Documento, Pagamento } from "@/lib/types";
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
  /** Parte deste pagamento coberta por documento hábil — vira custo. */
  comprovadoCentavos: number;
  /** O que sobra: exposição "pago sem nota" (parecer §3). */
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
    const somaPagamentos = ordenados.reduce((s, p) => s + p.valorCentavos, 0);
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
    let aDistribuir = custoComprovado;
    for (const p of ordenados) {
      const comprovado = Math.min(p.valorCentavos, aDistribuir);
      aDistribuir -= comprovado;
      porPagamento.set(p.id, {
        pagamento: p,
        comprovadoCentavos: comprovado,
        semNotaCentavos: p.valorCentavos - comprovado,
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

/** Sobra parte deste pagamento sem nota? Só quem tem saldo é candidato. */
function temSaldoSemNota(pagamento: Pagamento, alocacao: Alocacao): boolean {
  return (
    (alocacao.porPagamento.get(pagamento.id)?.semNotaCentavos ??
      pagamento.valorCentavos) > 0
  );
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
