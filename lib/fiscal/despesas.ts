/**
 * **CONTAI-041 — a projeção de `Documento`/`Pagamento` em LINHAS de tabela.**
 *
 * Módulo puro: nada de rede, nada de UI, nenhum texto fiscal redigido aqui.
 *
 * ⚠️ **Por que ela existe, e por que `resumo.despesas` não serve** (achado do
 * `cto-obra`, 2026-09-21, transcrito no critério 3 do ticket):
 * `ResumoObra.despesas` é `DespesaComprovada[]`, agregada **por COMPONENTE** —
 * o cluster inteiro de NFs+PIX que `alocarCusto` juntou como *"uma despesa, não
 * duas"* (critério 13 do CONTAI-008). A tabela desta rota é **uma linha por
 * pagamento/documento**. Os dois formatos coexistem, cada um com o seu
 * consumidor: o painel "Despesas recentes" do dashboard quer o cluster, esta
 * tabela quer a linha.
 *
 * ⚠️ **O CRITÉRIO 4 É O CORAÇÃO DESTE ARQUIVO: nenhum centavo pode ser contado
 * duas vezes entre linhas.** A regra de montagem, e ela é o que impede o
 * double-count do Pre-mortem 1:
 *
 * 1. **Todo `Pagamento` vira UMA linha**, pelo seu valor cheio.
 * 2. **`Documento` vira linha SÓ quando não tem pagamento ligado nenhum.** Com
 *    pagamento ligado, ele aparece na coluna `Documento` da(s) linha(s)
 *    daquele(s) pagamento(s) — nunca como linha de valor própria. Somar NF e
 *    PIX ligados entre si é exatamente contar a mesma despesa duas vezes, que é
 *    a palavra do relato que o CONTAI-018 veio consertar.
 * 3. **Pendência nunca cria linha.** Ela vira ANOTAÇÃO dentro da linha do
 *    registro de onde nasceu — um pagamento parcialmente comprovado e
 *    parcialmente "pago sem nota" é UMA linha com duas anotações, não duas
 *    linhas de valor (Pre-mortem 1, literal).
 *
 * Disso sai o invariante que o Gate Fiscal pede (revisão ESTRUTURAL, sem regra
 * nova): `Σ linhas = Σ pagamentos da obra + Σ documentos sem pagamento ligado`,
 * e `Σ (comprovado + comprovadoPorRetencao) das linhas = Σ custo comprovado dos
 * componentes` — os mesmos números que os cards do dashboard já mostram. Há
 * teste para cada um.
 *
 * ⚠️ **A segunda metade do invariante ganhou uma parcela no CONTAI-056.** A
 * perna de retenção qualificada entra no custo comprovado do componente
 * (`lib/fiscal/vinculo.ts`) sem ser um `Pagamento` e sem ser um `Documento`:
 * ela não tem linha própria — teria de ter valor de linha, e esse valor não é
 * dinheiro que mudou de conta, então somá-lo em `Σ linhas` inventaria despesa.
 * Ela entra como **parcela dentro da linha do pagamento âncora** (o mais antigo
 * da nota, o que empresta a data à retenção), em campo separado de
 * `comprovadoCentavos` — que continua significando *"quanto DESTE valor de
 * linha está comprovado"* e continua ≤ o valor da linha.
 *
 * ⚠️ **Nenhuma CONDIÇÃO de pendência é reimplementada aqui.** Quem decide que
 * existe "pago sem nota", "quarentena" ou "retenção sem recolhedor" continua
 * sendo `calcularResumo`; este módulo só ATRIBUI cada `Pendencia` já calculada à
 * linha do registro dela, e lê o valor por pagamento de `alocacao.porPagamento`
 * — que é a mesma decomposição que produziu o agregado. Duas implementações da
 * mesma regra divergem sempre (lição do `alocarSimulando`, do `notaCoberta` e
 * do `emPendenciaCentavos` morto no CONTAI-005).
 *
 * ⚠️ **Nenhum texto fiscal nasce neste arquivo** (critério 7). Chip e
 * consequência viajam dentro da própria `Pendencia`, que já os leu das
 * constantes de `documento.ts`, `pagamento.ts`, `retencao.ts` e `obra.ts`. Os
 * três rótulos que este módulo declara — "Custo comprovado", "Sem pagamento
 * ligado" e o "—" da coluna vazia — são copy de produto (mock
 * `desktop-shell-v1.html`), não consequência fiscal.
 *
 * ⚠️ **Terreno fica de fora** (critério 3): `TerrenoDesembolso` não é
 * `Documento` nem `Pagamento` da obra, e continua em `/obras/[id]/terreno`, que
 * já é a superfície dele.
 */

import {
  CHIP_NOTA_SEM_ARQUIVO,
  COR_NOTA_SEM_ARQUIVO,
  faltaOArquivo,
  NOTA_SEM_ARQUIVO_ALAVANCA,
  NOTA_SEM_ARQUIVO_EFEITO,
  BOLETO_FORA_DO_TOTAL,
} from "./documento";
import { rotulosPagoSemNota } from "./pagamento";
import {
  CHIP_QUITADO_POR_RETENCAO,
  CHIP_RETENCAO_SOBRECOBERTA,
  RETENCAO_EXPLICA_A_SOBRA,
  RETENCAO_SOBRECOBERTA,
} from "./retencao";
import {
  NOME_TIPO_CURTO,
  type Pendencia,
  type ResumoObra,
  type TipoPendencia,
} from "./resumo";
import { tipoPorDocumento } from "./identificacao";
import {
  documentosHabeisSemPagamento,
  EXPLICACAO_NOTAS_SEM_PAGAMENTO,
} from "./vinculo";
import type {
  Documento,
  MeioPagamento,
  Pagamento,
  TipoDocumento,
  TipoFavorecido,
} from "@/lib/types";

// ── Rótulos de produto (mock), nunca consequência fiscal ─────────────────

/** Mock `desktop-shell-v1.html`, linha verde compacta. */
export const CHIP_CUSTO_COMPROVADO = "Custo comprovado";

/**
 * **O terceiro estado do parecer §5.2** — nota hábil registrada, ainda sem
 * pagamento ligado.
 *
 * ⚠️ **Chip NEUTRO, e a neutralidade é exigência do ticket** (critério 3):
 * *"não fiscal-negativo — nem comprovado nem em risco"*. Não há `Gravidade`
 * para ler aqui, e não poderia haver: `pendencias-unificadas.ts` deixa esta
 * família **fora da fila** de propósito, porque ela não é pendência (não há
 * dispêndio, e somá-la inflaria a exposição). Pintá-la de âmbar ao lado das
 * pendências âmbares a faria ler como cobrança.
 *
 * O texto é o MESMO que o painel do dashboard já mostra — a constante de
 * `vinculo.ts`, não uma frase nova.
 */
export const CHIP_SEM_PAGAMENTO = "Sem pagamento ligado";

/** Célula sem dado — nunca um zero, que seria afirmação (mock). */
export const SEM_DADO = "—";

const NOME_DO_MEIO: Record<MeioPagamento, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao: "Cartão",
};

/** O rótulo da coluna `Meio` — `null` (linha de documento) vira o traço. */
export function rotuloDoMeio(meio: MeioPagamento | null): string {
  return meio === null ? SEM_DADO : NOME_DO_MEIO[meio];
}

// ── A linha ──────────────────────────────────────────────────────────────

/**
 * A cor de uma anotação da célula `Situação`.
 *
 * `"neutra"` é o terceiro estado e **não é cor de gravidade**: ela não sai da
 * régua, não entra em `Gravidade` e não existe em `Chip`. Ver
 * `CHIP_SEM_PAGAMENTO`.
 */
export type CorDaSituacao = "red" | "amb" | "grn" | "neutra";

export interface SituacaoDaLinha {
  /** Chave de React e de teste, única dentro da linha. */
  id: string;
  /**
   * O id da `Pendencia` de origem, quando a anotação vem de uma. `null` na
   * linha verde, na nota sem arquivo e no terceiro estado — nenhum dos três é
   * `Pendencia`. É por este campo que `pendenciasForaDaTabela` confere que
   * ninguém ficou pelo caminho, sem remontar id por string.
   */
  pendenciaId: string | null;
  chip: string;
  cor: CorDaSituacao;
  /**
   * O texto INTEGRAL da consequência — nunca truncado, nunca atrás de clique
   * (critério 6). `null` só na linha comprovada, que é compacta por decisão de
   * design: não há consequência fiscal a dizer sobre custo que se sustenta.
   */
  consequencia: string | null;
  /** Segunda frase da mesma anotação. Hoje só o boleto tem uma. */
  nota: string | null;
  /**
   * Quanto DESTA linha está sob esta anotação, quando a anotação tem valor
   * próprio e ele é por registro.
   *
   * ⚠️ `null` em toda anotação de ORIGEM DOCUMENTO. Um documento pode aparecer
   * em N linhas (uma NF paga por cinco PIX), e repetir o valor dele em cada uma
   * seria o double-count do critério 4 voltando pela porta da anotação.
   */
  valorCentavos: number | null;
}

/** Um documento na coluna `Documento` da linha. */
export interface DocumentoDaLinha {
  id: string;
  tipo: TipoDocumento;
  /** "NF de serviço nº 1032" — tipo + número impresso, literal (R2). */
  rotulo: string;
  href: string;
}

export interface LinhaDeDespesa {
  /** `pagamento:<id>` ou `documento:<id>` — estável entre carregamentos. */
  id: string;
  origem: "pagamento" | "documento";
  registroId: string;
  /**
   * ISO da data do pagamento — a data que decide o ano do custo (regime de
   * caixa). `null` na linha de documento, porque **não houve desembolso**.
   */
  dataPagamento: string | null;
  /**
   * A outra data do registro, NOMEADA. Ela nunca ocupa a coluna "Data
   * pagamento": emissão e vencimento não decidem ano de custo nenhum, e
   * colocá-las ali seria o erro que o parecer de 2026-08-16 (Parte 1, §3)
   * proíbe por escrito.
   */
  outraData: { rotulo: string; iso: string } | null;
  favorecidoNome: string | null;
  favorecidoTipo: TipoFavorecido | null;
  /** Vazio quando a linha não tem documento nenhum. */
  documentos: DocumentoDaLinha[];
  /**
   * O que FALTA, na palavra certa para o favorecido — "sem NF vinculada" para
   * PJ, "sem recibo vinculado" para PF. Cópia literal de `rotulosPagoSemNota`,
   * a mesma função que a pendência usa. `null` quando há documento.
   */
  semDocumento: string | null;
  meio: MeioPagamento | null;
  /**
   * O valor da LINHA. Nunca soma com o de outra linha (critério 4).
   *
   * ⚠️ **`null` é "não há valor lançado", e nunca colapsa em zero** (achado do
   * `cto-obra` no Gate 2). `documento.valor` é `numeric(14,2)` NULLABLE no
   * schema, e nota registrada sem valor é estado legítimo — a nota chegou por
   * WhatsApp e o número vem depois. Virar `0` aqui imprimiria **R$ 0,00** na
   * tabela: afirmação de zero onde não há dado, contra a doutrina *"campo
   * vazio pergunta, campo preenchido afirma"*. E era divergência de fato entre
   * duas telas: `/documento/[id]` já mostra `—` para a MESMA nota.
   *
   * Pagamento **sempre** tem valor (`pagamento.valor` é `NOT NULL`), então só
   * linha de origem DOCUMENTO chega aqui nula.
   *
   * ⚠️ O efeito fiscal disso já está decidido em `vinculo.ts`: nota sem valor
   * contribui ZERO para a soma hábil do conjunto (`DOCUMENTO_SEM_VALOR`) —
   * `null` aqui é sobre o que a tabela MOSTRA, não sobre o que ela soma.
   */
  valorCentavos: number | null;
  /** Quanto deste valor está comprovado — de `alocacao`, nunca recalculado. */
  comprovadoCentavos: number;
  /**
   * **CONTAI-056** — o custo comprovado que veio de PERNA DE RETENÇÃO ancorada
   * neste pagamento, não do valor dele. Fica em campo próprio, e não somado em
   * `comprovadoCentavos`, por duas razões: `comprovadoCentavos` seria maior que
   * `valorCentavos` (a tela imprimiria "comprovado R$ 10,00" numa linha de
   * R$ 9,50, que lê como bug), e o invariante do módulo precisa poder nomear as
   * duas parcelas separadamente. Zero em toda linha sem retenção confirmada.
   */
  comprovadoPorRetencaoCentavos: number;
  situacoes: SituacaoDaLinha[];
  /** Filtro "Só comprovadas". Convive com `temPendencia` (linha mista). */
  comprovada: boolean;
  /** Filtro "Só com pendência". O terceiro estado **não** conta aqui. */
  temPendencia: boolean;
  /** Coluna `Ação` — as rotas de detalhe que já existem. */
  href: string;
}

export interface EntradaLinhasDeDespesa {
  documentos: readonly Documento[];
  pagamentos: readonly Pagamento[];
  /** O resumo JÁ CALCULADO da mesma obra — alocação, pendências e terceiro estado. */
  resumo: ResumoObra;
}

/**
 * **De onde cada família de pendência é atribuída a uma linha.**
 *
 * ⚠️ `Record<TipoPendencia, …>` **exaustivo de propósito**: família nova de
 * pendência não compila sem decidir onde ela aparece nesta tabela. É a mesma
 * malha de `ORDEM_DA_FAMILIA` em `pendencias-unificadas.ts` — trava no
 * compilador, não na atenção.
 *
 * - `"documento"` / `"pagamento"`: o id da pendência é `prefixo:<registroId>`,
 *   como `calcularResumo` o monta.
 * - `"itens"`: a pendência é AGREGADA por favorecido (`pago_sem_nota`) e traz
 *   os pagamentos em `itens[]`. O id dela não nomeia registro nenhum — é por
 *   isso que a atribuição passa pelos itens, e é por isso que o VALOR por linha
 *   vem de `alocacao.porPagamento`, nunca do agregado.
 */
type OrigemDaPendencia = "documento" | "pagamento" | "itens";

const ORIGEM_DA_PENDENCIA: Record<TipoPendencia, OrigemDaPendencia> = {
  quarentena: "documento",
  boleto_sem_nf: "documento",
  pago_sem_nota: "itens",
  diferenca_sem_explicacao: "pagamento",
  pago_sem_comprovante: "pagamento",
  // As duas do critério 3: **não geram linha própria**, são anotações dentro
  // da linha do documento a que já pertencem — e uma NF pode estar comprovada
  // E carregar uma delas ao mesmo tempo.
  retencao_sem_recolhedor: "documento",
  nf_servico_sem_cno: "documento",
};

/** `quarentena:d1` → `d1`; `pago-sem-nota:sem-favorecido:p1` → não passa por aqui. */
function registroDaPendencia(pendencia: Pendencia): string {
  const corte = pendencia.id.indexOf(":");
  return corte === -1 ? pendencia.id : pendencia.id.slice(corte + 1);
}

function rotuloDoDocumento(d: Documento): string {
  const nome = NOME_TIPO_CURTO[d.tipo];
  return d.numero === null ? nome : `${nome} nº ${d.numero}`;
}

function documentoDaLinha(d: Documento): DocumentoDaLinha {
  return {
    id: d.id,
    tipo: d.tipo,
    rotulo: rotuloDoDocumento(d),
    href: `/documento/${d.id}`,
  };
}

/**
 * A outra data do documento, nomeada. Boleto tem vencimento; nota tem emissão.
 * Nenhuma das duas é a data do custo.
 */
function outraDataDoDocumento(
  d: Documento,
): { rotulo: string; iso: string } | null {
  if (d.tipo === "boleto") {
    return d.vencimento === null ? null : { rotulo: "vence em", iso: d.vencimento };
  }
  return d.dataEmissao === null
    ? null
    : { rotulo: "emitida em", iso: d.dataEmissao };
}

/**
 * A projeção. Uma linha por pagamento, mais uma por documento órfão de
 * pagamento — nessa ordem, e ordenada depois por `ordenarLinhas`.
 */
export function linhasDeDespesa(
  entrada: EntradaLinhasDeDespesa,
): LinhaDeDespesa[] {
  const { documentos, pagamentos, resumo } = entrada;
  const { alocacao } = resumo;

  const docPorId = new Map(documentos.map((d) => [d.id, d]));
  /** Documentos que JÁ aparecem dentro da linha de algum pagamento. */
  const documentosEmLinhaDePagamento = new Set<string>();
  for (const p of pagamentos) {
    for (const id of p.documentoIds) {
      if (docPorId.has(id)) documentosEmLinhaDePagamento.add(id);
    }
  }

  const linhas: LinhaDeDespesa[] = [];
  /** Onde cada registro caiu — é por aqui que a pendência acha a linha dela. */
  const linhaDoPagamento = new Map<string, LinhaDeDespesa>();
  const linhasDoDocumento = new Map<string, LinhaDeDespesa[]>();

  const registrarDocumentoEm = (documentoId: string, linha: LinhaDeDespesa) => {
    const atual = linhasDoDocumento.get(documentoId) ?? [];
    atual.push(linha);
    linhasDoDocumento.set(documentoId, atual);
  };

  // ── 1 · Uma linha por PAGAMENTO, pelo valor cheio ──────────────────────
  for (const p of pagamentos) {
    const docs = p.documentoIds
      .map((id) => docPorId.get(id))
      .filter((d): d is Documento => d !== undefined);
    const comprovado = alocacao.porPagamento.get(p.id)?.comprovadoCentavos ?? 0;
    const linha: LinhaDeDespesa = {
      id: `pagamento:${p.id}`,
      origem: "pagamento",
      registroId: p.id,
      dataPagamento: p.dataPagamento,
      outraData: null,
      favorecidoNome: p.favorecidoNome,
      favorecidoTipo: p.favorecidoTipo,
      documentos: docs.map(documentoDaLinha),
      semDocumento:
        docs.length === 0 ? rotulosPagoSemNota(p.favorecidoTipo).semVinculo : null,
      meio: p.meio,
      valorCentavos: p.valorCentavos,
      comprovadoCentavos: comprovado,
      // Preenchida no bloco 3b, depois de as linhas existirem.
      comprovadoPorRetencaoCentavos: 0,
      situacoes: [],
      comprovada: comprovado > 0,
      temPendencia: false,
      href: `/pagamento/${p.id}`,
    };
    linhas.push(linha);
    linhaDoPagamento.set(p.id, linha);
    for (const d of docs) registrarDocumentoEm(d.id, linha);
  }

  // ── 2 · Uma linha por DOCUMENTO sem pagamento ligado ───────────────────
  //
  // ⚠️ Só estes. Documento já ligado a pagamento aparece na coluna
  // `Documento` da linha dele, e dar-lhe linha própria somaria NF e PIX —
  // o double-count do critério 4.
  for (const d of documentos) {
    if (documentosEmLinhaDePagamento.has(d.id)) continue;
    const linha: LinhaDeDespesa = {
      id: `documento:${d.id}`,
      origem: "documento",
      registroId: d.id,
      // Não houve desembolso: a coluna do regime de caixa fica vazia, e a data
      // que existe é dita com o nome dela.
      dataPagamento: null,
      outraData: outraDataDoDocumento(d),
      favorecidoNome: d.favorecidoNome,
      favorecidoTipo:
        d.favorecidoDocumento === null
          ? null
          : tipoPorDocumento(d.favorecidoDocumento),
      documentos: [documentoDaLinha(d)],
      semDocumento: null,
      meio: null,
      // ⚠️ `?? 0` aqui seria "R$ 0,00" em tela — ver `valorCentavos`.
      valorCentavos: d.valorCentavos,
      // Documento sozinho no componente nunca comprova nada: sem desembolso
      // não há dispêndio (regime de caixa). A perna de retenção também não
      // socorre esta linha: sem pagamento vinculado ela não entra em ano
      // nenhum (CONTAI-056, ADENDO 3 Pergunta 2).
      comprovadoCentavos: 0,
      comprovadoPorRetencaoCentavos: 0,
      situacoes: [],
      comprovada: false,
      temPendencia: false,
      href: `/documento/${d.id}`,
    };
    linhas.push(linha);
    registrarDocumentoEm(d.id, linha);
  }

  // ── 3 · A situação verde, onde o custo se sustenta ─────────────────────
  for (const linha of linhas) {
    if (linha.comprovadoCentavos <= 0) continue;
    linha.situacoes.push({
      id: `${linha.id}:comprovada`,
      pendenciaId: null,
      chip: CHIP_CUSTO_COMPROVADO,
      cor: "grn",
      // Compacta: não há consequência fiscal a dizer sobre custo que se
      // sustenta (critério 6).
      consequencia: null,
      nota: null,
      valorCentavos: linha.comprovadoCentavos,
    });
  }

  // ── 3b · A perna de RETENÇÃO, na linha do pagamento âncora (CONTAI-056) ─
  //
  // ⚠️ **Nenhuma condição é decidida aqui.** Quem qualificou a linha foi
  // `retencaoContaComoPerna` e quem a repartiu foi `alocarCusto`; este bloco só
  // encontra a linha da tabela onde a parcela pertence — a do pagamento que
  // emprestou a data à retenção — e copia os textos das constantes de
  // `retencao.ts`. O valor vem de `alocacao.porRetencao`, a MESMA decomposição
  // que formou o custo comprovado do componente.
  //
  // Sem este bloco, a retenção entraria no total do dashboard e não apareceria
  // em linha nenhuma da tabela: o encolhimento silencioso que o módulo existe
  // para impedir, na direção inversa.
  for (const r of alocacao.porRetencao.values()) {
    const linha = linhaDoPagamento.get(r.pagamentoAncoraId);
    if (linha === undefined) continue;
    if (r.comprovadoCentavos > 0) {
      linha.comprovadoPorRetencaoCentavos += r.comprovadoCentavos;
      linha.comprovada = true;
      linha.situacoes.push({
        id: `${linha.id}:retencao:${r.linha.id}`,
        pendenciaId: null,
        chip: CHIP_QUITADO_POR_RETENCAO,
        // VERDE: é custo que se sustenta, não pendência. O critério 4 do
        // CONTAI-056 pede texto e cor PRÓPRIOS justamente para esta fatia
        // deixar de ser lida como "nota ainda não paga".
        cor: "grn",
        consequencia: RETENCAO_EXPLICA_A_SOBRA,
        nota: null,
        valorCentavos: r.comprovadoCentavos,
      });
    }
    if (r.naoAbsorvidoCentavos > 0) {
      // Critério 8 — dado contraditório, nomeado. Nunca estouro silencioso.
      linha.situacoes.push({
        id: `${linha.id}:retencao-sobrecoberta:${r.linha.id}`,
        pendenciaId: null,
        chip: CHIP_RETENCAO_SOBRECOBERTA,
        cor: "red",
        consequencia: RETENCAO_SOBRECOBERTA,
        nota: null,
        valorCentavos: r.naoAbsorvidoCentavos,
      });
      linha.temPendencia = true;
    }
  }

  // ── 4 · As pendências, como ANOTAÇÃO dentro da linha do registro ───────
  for (const pendencia of resumo.pendencias) {
    const origem = ORIGEM_DA_PENDENCIA[pendencia.tipo];

    if (origem === "itens") {
      // `pago_sem_nota` é agregada por favorecido. O valor por linha sai de
      // `alocacao.porPagamento` — a MESMA decomposição que formou o agregado,
      // e por isso a soma das anotações fecha com ele por construção.
      for (const item of pendencia.itens ?? []) {
        const linha = linhaDoPagamento.get(item.id);
        if (linha === undefined) continue;
        linha.situacoes.push({
          id: `${linha.id}:${pendencia.id}`,
          pendenciaId: pendencia.id,
          chip: pendencia.chip,
          cor: pendencia.gravidade,
          consequencia: pendencia.consequencia,
          nota: null,
          valorCentavos:
            alocacao.porPagamento.get(item.id)?.semNotaCentavos ?? null,
        });
        linha.temPendencia = true;
      }
      continue;
    }

    const registroId = registroDaPendencia(pendencia);
    const alvos =
      origem === "pagamento"
        ? [linhaDoPagamento.get(registroId)].filter(
            (l): l is LinhaDeDespesa => l !== undefined,
          )
        : (linhasDoDocumento.get(registroId) ?? []);

    for (const linha of alvos) {
      linha.situacoes.push({
        id: `${linha.id}:${pendencia.id}`,
        pendenciaId: pendencia.id,
        chip: pendencia.chip,
        cor: pendencia.gravidade,
        consequencia: pendencia.consequencia,
        // A segunda frase do boleto (`BOLETO_FORA_DO_TOTAL`): sem ela a saída
        // do boleto do total vira encolhimento silencioso.
        nota: pendencia.tipo === "boleto_sem_nf" ? BOLETO_FORA_DO_TOTAL : null,
        // Origem documento não carrega valor na anotação — ver `SituacaoDaLinha`.
        valorCentavos: origem === "pagamento" ? pendencia.valorCentavos : null,
      });
      linha.temPendencia = true;
    }
  }

  // ── 5 · A nota sem arquivo, que não é `Pendencia` e ficaria MUDA ───────
  //
  // ⚠️ `documentosSemArquivo` vive em campo PRÓPRIO do resumo, fora de
  // `pendencias[]` (CONTAI-033, critério 11). Sem esta anotação, uma nota
  // registrada por WhatsApp e ainda sem o arquivo apareceria na tabela sem
  // dizer nada — a D47 com outro nome, e num registro que não é hábil, não
  // abate aferição e veta as três saídas anuais.
  //
  // O predicado é `faltaOArquivo`, a MESMA função que `calcularResumo` usa;
  // os textos são as constantes do §A.7.2. Nada é decidido nem redigido aqui.
  for (const d of documentos) {
    if (!faltaOArquivo(d)) continue;
    for (const linha of linhasDoDocumento.get(d.id) ?? []) {
      linha.situacoes.push({
        id: `${linha.id}:sem-arquivo:${d.id}`,
        pendenciaId: null,
        chip: CHIP_NOTA_SEM_ARQUIVO,
        cor: COR_NOTA_SEM_ARQUIVO,
        consequencia: `${NOTA_SEM_ARQUIVO_EFEITO} ${NOTA_SEM_ARQUIVO_ALAVANCA}`,
        nota: null,
        valorCentavos: null,
      });
      linha.temPendencia = true;
    }
  }

  // ── 6 · O terceiro estado (parecer §5.2), em linha própria e NEUTRA ────
  //
  // ⚠️ **`documentosHabeisSemPagamento` é a MESMA função que `calcularResumo`
  // usa** para montar `resumo.notasSemPagamento` — não uma segunda definição
  // de "nota hábil ainda não paga", e não um parse do id daquela lista. Por
  // construção cada um destes documentos tem linha própria aqui: sem pagamento
  // ligado, ele não entra na linha de ninguém.
  for (const { documento } of documentosHabeisSemPagamento(alocacao)) {
    for (const linha of linhasDoDocumento.get(documento.id) ?? []) {
      linha.situacoes.push({
        id: `${linha.id}:sem-pagamento`,
        pendenciaId: null,
        chip: CHIP_SEM_PAGAMENTO,
        cor: "neutra",
        consequencia: EXPLICACAO_NOTAS_SEM_PAGAMENTO,
        nota: null,
        valorCentavos: null,
      });
      // ⚠️ **Não mexe em `temPendencia`**: nem comprovado nem em risco.
    }
  }

  return linhas;
}

/**
 * **As pendências que NÃO acharam linha nenhuma.**
 *
 * Vazio em toda obra saudável, e a tela **diz** quando não está — mesma
 * doutrina do `vinculosCruzandoObras`: o que esta projeção descartaria em
 * silêncio sobe até a superfície, em vez de sumir. É também a rede para o dia
 * em que `calcularResumo` mudar o formato de um id de pendência: o buraco
 * aparece na tela e no teste, não só na leitura do diff.
 */
export function pendenciasForaDaTabela(
  linhas: readonly LinhaDeDespesa[],
  pendencias: readonly Pendencia[],
): Pendencia[] {
  const atribuidas = new Set<string>();
  for (const linha of linhas) {
    for (const s of linha.situacoes) {
      if (s.pendenciaId !== null) atribuidas.add(s.pendenciaId);
    }
  }
  return pendencias.filter((p) => !atribuidas.has(p.id));
}

// ── Filtros (critério 8) ─────────────────────────────────────────────────

/**
 * ⚠️ **O padrão é `"todas"`, e não é detalhe de implementação** (Pre-mortem 2):
 * *"o padrão ao abrir a tela é 'Todas', nunca 'Só comprovadas' — para não
 * nascer com o filtro errado escondendo pendência na primeira visita"*.
 */
export type FiltroSituacao = "todas" | "comprovadas" | "pendencia";

export const FILTRO_SITUACAO_PADRAO: FiltroSituacao = "todas";

/** `"sem_documento"` = linha sem nenhum documento ligado (PIX cru). */
export type FiltroTipo = "todos" | TipoDocumento | "sem_documento";

export const FILTRO_TIPO_PADRAO: FiltroTipo = "todos";

export interface FiltrosDaTabela {
  situacao: FiltroSituacao;
  tipo: FiltroTipo;
  /** Texto livre — favorecido. Vazio não filtra nada. */
  busca: string;
}

export const FILTROS_PADRAO: FiltrosDaTabela = {
  situacao: FILTRO_SITUACAO_PADRAO,
  tipo: FILTRO_TIPO_PADRAO,
  busca: "",
};

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function casaSituacao(linha: LinhaDeDespesa, filtro: FiltroSituacao): boolean {
  if (filtro === "comprovadas") return linha.comprovada;
  if (filtro === "pendencia") return linha.temPendencia;
  return true;
}

function casaTipo(linha: LinhaDeDespesa, filtro: FiltroTipo): boolean {
  if (filtro === "todos") return true;
  if (filtro === "sem_documento") return linha.documentos.length === 0;
  return linha.documentos.some((d) => d.tipo === filtro);
}

export function filtrarLinhas(
  linhas: readonly LinhaDeDespesa[],
  filtros: FiltrosDaTabela,
): LinhaDeDespesa[] {
  const busca = normalizar(filtros.busca);
  return linhas.filter(
    (l) =>
      casaSituacao(l, filtros.situacao) &&
      casaTipo(l, filtros.tipo) &&
      (busca === "" ||
        normalizar(l.favorecidoNome ?? "").includes(busca)),
  );
}

// ── Ordenação (critério 9) ───────────────────────────────────────────────

export type ColunaOrdenavel = "data" | "valor";
export type Direcao = "asc" | "desc";

export interface Ordem {
  coluna: ColunaOrdenavel;
  direcao: Direcao;
}

/** Mais recente primeiro — o que ele acabou de registrar. */
export const ORDEM_PADRAO: Ordem = { coluna: "data", direcao: "desc" };

/**
 * ⚠️ **Linha sem data de pagamento — ou sem valor lançado — vai SEMPRE para o
 * fim**, nas duas direções.
 *
 * Ausência não é zero nem infinito, e a regra é a mesma nos dois eixos: o
 * documento ainda não foi pago, ou o valor dele ainda não foi informado.
 * Deixá-lo flutuar para o topo do "mais recente" o faria parecer o lançamento
 * mais novo da obra; para o topo do "maior valor", o mais caro. Empate e
 * ausência desempatam por `id`, para a tabela não dançar entre dois
 * carregamentos.
 */
export function ordenarLinhas(
  linhas: readonly LinhaDeDespesa[],
  ordem: Ordem,
): LinhaDeDespesa[] {
  const sinal = ordem.direcao === "asc" ? 1 : -1;
  return [...linhas].sort((a, b) => {
    if (ordem.coluna === "data") {
      if (a.dataPagamento === null || b.dataPagamento === null) {
        if (a.dataPagamento === b.dataPagamento) return a.id < b.id ? -1 : 1;
        return a.dataPagamento === null ? 1 : -1;
      }
      if (a.dataPagamento !== b.dataPagamento) {
        return a.dataPagamento < b.dataPagamento ? -sinal : sinal;
      }
      return a.id < b.id ? -1 : 1;
    }
    if (a.valorCentavos === null || b.valorCentavos === null) {
      if (a.valorCentavos === b.valorCentavos) return a.id < b.id ? -1 : 1;
      return a.valorCentavos === null ? 1 : -1;
    }
    if (a.valorCentavos !== b.valorCentavos) {
      return a.valorCentavos < b.valorCentavos ? -sinal : sinal;
    }
    return a.id < b.id ? -1 : 1;
  });
}

/** O clique no cabeçalho: mesma coluna inverte; coluna nova nasce decrescente. */
export function proximaOrdem(atual: Ordem, coluna: ColunaOrdenavel): Ordem {
  if (atual.coluna !== coluna) return { coluna, direcao: "desc" };
  return { coluna, direcao: atual.direcao === "desc" ? "asc" : "desc" };
}
