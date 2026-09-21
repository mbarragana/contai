/**
 * **CONTAI-042 — a fonte única das pendências da obra.**
 *
 * Até aqui as pendências viviam em três lugares e nenhum deles as via todas:
 * `ResumoObra.pendencias[]` (7 famílias), mais **onze** agregados que só
 * existiam soltos dentro de `app/page.tsx`, mais as duas **persistentes** que
 * só existiam em `/pendencias`. Nenhuma superfície enumerava as dezoito — e foi
 * por isso que o banner *"Nenhuma pendência"* da home pôde conviver com um card
 * vermelho logo abaixo (**D59**), e que o dashboard do `CONTAI-040` nasceria
 * escondendo onze famílias (**D46/D47**).
 *
 * Este módulo é **enumeração, ordenação e contagem** — e nada além disso.
 *
 * ⚠️ **Nenhum texto fiscal nasce aqui, nem passa por aqui.** Cada item carrega
 * o OBJETO DE ORIGEM (`Pendencia`, `TerrenoSemData`, `PendenciaDeAno`…), e quem
 * desenha lê a frase da mesma constante de sempre. Repassar chip e consequência
 * por este módulo criaria um SEGUNDO caminho para o mesmo texto fiscal, que é
 * como nasce a D46: dois rostos para o mesmo fato, e o Mateus decidindo em qual
 * acreditar.
 *
 * ⚠️ **Nenhuma cor nasce aqui.** Dez famílias já trazem `Gravidade` branded, de
 * `gravidadeDaRegua`; as outras oito trazem a cor da constante nomeada do módulo
 * dono dos textos delas — a MESMA que a tela de hoje lê. Ver `BlocoDaFila` mais
 * abaixo para por que as oito **não** passam pela régua.
 *
 * ⚠️ **Nenhum valor é somado.** A página conta ITENS, nunca reais — é a lição
 * do `emPendenciaCentavos` morto no `CONTAI-005`: quatro moedas diferentes
 * (custo perdido, conta a pagar, base de INSS, defeito de dado) num número só
 * não significa coisa nenhuma. `vinculosCruzandoObras` não tem valor próprio, e
 * `terrenoPagoSemComprovante` já está contado por dentro de outra pendência.
 *
 * ⚠️ **`notasSemPagamento` NÃO entra**, e a ausência é decisão, não descuido:
 * nota hábil ainda sem pagamento é o **terceiro estado** do parecer §5.2 — não
 * há consequência bloqueante, não há dispêndio, e somá-la às pendências
 * inflaria a exposição. Ela continua no painel da home até o `CONTAI-041` lhe
 * dar casa própria. `despesas` (custo comprovado) também não é pendência.
 */

import { COR_NOTA_SEM_ARQUIVO } from "@/lib/fiscal/documento";
import { COR_PENDENCIA_CNO } from "@/lib/fiscal/obra";
import {
  COR_PAGO_SEM_COMPROVANTE,
  COR_TERRENO_MAIS_DE_UMA_DATA,
  COR_TERRENO_SEM_DATA,
  COR_TERRENO_SEM_REGISTRO,
} from "@/lib/fiscal/terreno";
import { COR_VINCULO_CRUZANDO_OBRAS } from "@/lib/fiscal/vinculo";
import type { Obra, PendenciaPersistente, Revisao } from "@/lib/types";
import {
  montarPendenciasDeAno,
  sinalDoEmitenteErrado,
  type LinhaDeAnoDaPendencia,
  type PendenciaDeAno,
  type SinalDoEmitenteErrado,
  type VinculoDeDocumento,
} from "@/lib/fiscal/revisao";
import { GRAVIDADE_CORRECAO_ANO_ANTERIOR } from "@/lib/fiscal/revisao";
import type {
  DocumentosSemArquivo,
  FinanciamentoAguardandoInforme,
  FinanciamentoFaltaLancar,
  Pendencia,
  ResumoObra,
  TerrenoMaisDeUmaData,
  TerrenoPagoSemComprovante,
  TerrenoSemData,
  TerrenoSemRegistro,
  TipoPendencia,
  VinculoCruzandoObras,
} from "@/lib/fiscal/resumo";

/**
 * **As DEZOITO famílias — lista fechada, e a ordem desta lista é a ordem
 * doutrinária DENTRO de cada cor.**
 *
 * Fechada por `grep` em `app/page.tsx` no Gate 1 do `CONTAI-042` (o achado do
 * `cto-obra` nomeava dezessete e deixava a décima-oitava em aberto; ela é
 * `terreno_sem_registro`, que hoje só existe como uma `Consequencia` âmbar
 * DENTRO do card de custo confirmado, sem superfície própria).
 *
 * ⚠️ **Família nova entra AQUI, e o compilador cobra o resto**: `ItemDePendencia`
 * é união discriminada por `familia` e `ORDEM_DA_FAMILIA` é `Record` exaustivo.
 * Acrescentar um nome sem lhe dar posição e payload não compila — que é a mesma
 * malha do teste-trava, no compilador.
 *
 * ⚠️ As sete primeiras derivadas têm o MESMO nome do `TipoPendencia` de
 * `ResumoObra.pendencias[]` de propósito: a família **é** o tipo, e um `as`
 * a mais seria a chance de as duas listas divergirem.
 */
export const FAMILIAS_DE_PENDENCIA = [
  // ── Primeira do grupo vermelho, SEMPRE — e a razão não é a cor ─────────
  // Gate Fiscal do `CONTAI-042` (`contador`, 2026-09-21, §4), transcrito em
  // `docs/pareceres/2026-09-21-gate-fiscal-contai-042.md`:
  //   1. prazo legal de 30 dias correndo contra um TERCEIRO (Lei 8.212/91,
  //      art. 49, II) — é a única família cujo relógio não é do app;
  //   2. o dano ACUMULA POR NOTA e é irreversível na parte já emitida ("não
  //      começa no dia 31"), e a alavanca de conserto morre com o último
  //      pagamento à empreiteira;
  //   3. é a ÚNICA pendência do app que impede a VENDA — sem averbação o banco
  //      do comprador não financia e o cartório não lavra.
  // Quem reordenar isto por estética está desfazendo adjudicação do `contador`.
  "cno",
  // ── Persistentes: linha GRAVADA, sobre correção de registro passado ────
  // Vêm antes das derivadas pela mesma razão que já as põe antes na home: a
  // derivada é recalculada a cada carga e some sozinha quando o fato muda; a
  // persistente só sai com um desfecho escolhido pelo Mateus.
  "correcao_ano_anterior",
  "emitente_errado",
  // ── As 7 de `ResumoObra.pendencias[]`, na ordem em que `calcularResumo`
  //    as empilha ─────────────────────────────────────────────────────────
  "quarentena",
  "boleto_sem_nf",
  "pago_sem_nota",
  "diferenca_sem_explicacao",
  "pago_sem_comprovante",
  "retencao_sem_recolhedor",
  "nf_servico_sem_cno",
  // ── Os agregados que só viviam soltos na home ──────────────────────────
  "vinculo_cruzando_obras",
  "terreno_pago_sem_comprovante",
  "documentos_sem_arquivo",
  "terreno_sem_data",
  "terreno_mais_de_uma_data",
  "financiamento_falta_lancar",
  "terreno_sem_registro",
  // ── Aviso informativo, nunca omitido, e sem cor da régua ───────────────
  "financiamento_aguardando_informe",
] as const;

export type FamiliaDePendencia = (typeof FAMILIAS_DE_PENDENCIA)[number];

/**
 * Trava de leitura: as sete derivadas de `ResumoObra.pendencias[]` são
 * exatamente sete nomes desta lista. Se o `TipoPendencia` ganhar um membro que
 * a lista não tem, **isto não compila** — e a família nova não pode entrar em
 * produção sem passar por aqui.
 */
type _TipoPendenciaEhFamilia = TipoPendencia extends FamiliaDePendencia
  ? true
  : never;
const _TRAVA: _TipoPendenciaEhFamilia = true;
void _TRAVA;

const ORDEM_DA_FAMILIA: Record<FamiliaDePendencia, number> = Object.fromEntries(
  FAMILIAS_DE_PENDENCIA.map((f, i) => [f, i]),
) as Record<FamiliaDePendencia, number>;

/**
 * **O bloco da fila — e por que ele não é `Gravidade`.**
 *
 * Gate Fiscal do `CONTAI-042` (`contador`, 2026-09-21). A minuta anterior deste
 * módulo passava as dezoito famílias por `gravidadeDaRegua`, declarando os dois
 * fatos de cada uma em constante própria. **Reprovada**, e o fundamento
 * importa mais que a forma:
 *
 * - **Dez das dezoito já têm `Gravidade` branded** (as 7 de `pendencias[]`,
 *   `correcao_ano_anterior`, `emitente_errado` e `financiamento_falta_lancar`).
 *   **As outras oito têm cor LITERAL em JSX** e nunca passaram pela régua.
 *   10 + 8 = 18 — a procedência da cor fecha a mesma contagem da lista, o que é
 *   uma segunda confirmação dela.
 * - Declarar `dinheiroSaiu`/`apoioHabilNoAnoCerto` para essas oito **não é
 *   portar cor, é fabricar fato fiscal** para a fila ordenar bonito — e o
 *   ticket põe "qualquer regra de cor nova" em Fora de Escopo.
 * - O caso que prova: **`cno`**. A régua mede o eixo do CUSTO DE AQUISIÇÃO
 *   ("o acervo sustenta *o valor* no ano certo?"). A pendência de CNO não tem
 *   valor, não tem dispêndio e, por constante do próprio app
 *   (`CNO_NAO_MUDA_IRPF`), **não toca o IRPF**: é obrigação acessória
 *   previdenciária, a outra apuração. Passada pela régua ela sairia **âmbar** —
 *   como artefato do branch default da função, não como adjudicação — e a única
 *   pendência do app que **impede a venda** (sem averbação o banco do comprador
 *   não financia e o cartório não lavra) desceria para depois de toda vermelha.
 *   É o D46/D47 alcançado por desvio de type system.
 *
 * Então a cor das oito migra **por referência, não por reconstrução**: cada uma
 * virou constante nomeada no módulo que já é dono dos textos da família
 * (`obra.ts`, `terreno.ts`, `documento.ts`, `vinculo.ts`), e **a tela de hoje
 * passa a ler a mesma constante**. Uma definição só onde havia literal solto —
 * estritamente melhor que antes, e sem furar o verificador: a marca de
 * `Gravidade` existe para impedir pendência **nova** de chutar cor, e portar
 * pendência existente não é chutar.
 */
export type BlocoDaFila = "vermelho" | "ambar" | "informativo";

/** A cor que uma família declara, quando não é `Gravidade`. */
export type CorDeclarada = "red" | "amb";

function bloco(cor: CorDeclarada): BlocoDaFila {
  return cor === "red" ? "vermelho" : "ambar";
}

interface Comum {
  /** Chave estável — de React e de teste. */
  id: string;
  /**
   * Onde o item entra na fila. `"informativo"` **só** para o aviso que não
   * cobra nada — e ele continua na fila, nunca omitido.
   */
  bloco: BlocoDaFila;
}

/**
 * Um item da fila única. **Discriminado por `familia`, e o payload é o objeto
 * de origem inteiro** — quem desenha reaproveita o componente que já existe
 * (`PendenciaCno`, `CardPagoSemComprovante`, `CardDocumentosSemArquivo`,
 * `PendenciaDeDatas`) em vez de remontar o texto.
 */
export type ItemDePendencia =
  | (Comum & { familia: "cno"; obra: Obra })
  | (Comum & { familia: "correcao_ano_anterior"; correcao: PendenciaDeAno })
  | (Comum & {
      familia: "emitente_errado";
      persistente: PendenciaPersistente;
      sinal: SinalDoEmitenteErrado;
    })
  | (Comum & { familia: TipoPendencia; derivada: Pendencia })
  | (Comum & { familia: "vinculo_cruzando_obras"; vinculo: VinculoCruzandoObras })
  | (Comum & {
      familia: "terreno_pago_sem_comprovante";
      terrenoPagoSemComprovante: TerrenoPagoSemComprovante;
    })
  | (Comum & {
      familia: "documentos_sem_arquivo";
      documentosSemArquivo: DocumentosSemArquivo;
    })
  | (Comum & { familia: "terreno_sem_data"; terrenoSemData: TerrenoSemData })
  | (Comum & {
      familia: "terreno_mais_de_uma_data";
      terrenoMaisDeUmaData: TerrenoMaisDeUmaData;
    })
  | (Comum & {
      familia: "financiamento_falta_lancar";
      financiamentoFaltaLancar: FinanciamentoFaltaLancar;
    })
  | (Comum & {
      familia: "terreno_sem_registro";
      terrenoSemRegistro: TerrenoSemRegistro;
    })
  | (Comum & {
      familia: "financiamento_aguardando_informe";
      bloco: "informativo";
      financiamentoAguardandoInforme: FinanciamentoAguardandoInforme;
    });

export interface EntradaPendenciasUnificadas {
  /**
   * O resumo da obra ABERTA. `null` quando nenhuma está aberta (preferência
   * limpa, aparelho novo, mais de uma obra e nenhuma escolhida): aí só as
   * persistentes entram na fila, e a tela **diz** que as derivadas dependem de
   * uma obra aberta — some-se em silêncio é o defeito que este ticket mata.
   */
  resumo: ResumoObra | null;
  /** A obra aberta, de onde sai a pendência de CNO. `null` junto com o resumo. */
  obra: Obra | null;
  /**
   * O painel das persistentes, **de todas as obras** — é assim que `/pendencias`
   * já funciona hoje, e restringi-lo à obra aberta esconderia a correção de
   * outra obra, que é perda de superfície.
   */
  painel: {
    pendencias: readonly PendenciaPersistente[];
    linhas: readonly LinhaDeAnoDaPendencia[];
    revisoes: readonly Revisao[];
    vinculos: readonly VinculoDeDocumento[];
  };
  /** Regime de caixa: quem decide a escalada do "CNPJ errado" é o ano. */
  anoCorrente: number;
}

export interface PendenciasUnificadas {
  /**
   * A fila inteira, já ordenada: vermelhas, âmbares, avisos. **Sem truncar e
   * sem paginar** — esconder a mais grave atrás de um "ver mais" é a D47 com
   * outro nome.
   */
  itens: ItemDePendencia[];
  /**
   * **Critério 4 — a contagem de abertas, e é ESTE export que o `CONTAI-040`
   * consome para o badge da sidebar.** Vermelhas + âmbares; o aviso
   * informativo fica de fora, porque badge é cobrança e aviso não cobra nada.
   */
  abertas: number;
  vermelhas: number;
  ambares: number;
  /** Contados à parte, nunca omitidos da fila. */
  avisos: number;
  /**
   * O histórico das persistentes já baixadas — **fora da fila**, como hoje. A
   * baixa é acréscimo: nada some, nada é editado (parecer §6.3).
   */
  baixadas: {
    correcoes: PendenciaDeAno[];
    emitente: PendenciaPersistente[];
  };
}

/** Vermelho antes de âmbar, âmbar antes de informativo. Não há quarto grupo. */
const PESO_DO_BLOCO: Record<BlocoDaFila, number> = {
  vermelho: 0,
  ambar: 1,
  informativo: 2,
};

/**
 * Agrega as dezoito famílias numa fila só, ordenada por gravidade.
 *
 * Pura: recebe o que já foi carregado, não consulta nada. A ordenação é
 * **estável** — dentro da mesma cor e da mesma família, a ordem de origem é
 * preservada (a de `calcularResumo`, que é a ordem em que a home as mostra
 * hoje).
 */
export function unificarPendencias(
  entrada: EntradaPendenciasUnificadas,
): PendenciasUnificadas {
  const { resumo, obra, painel, anoCorrente } = entrada;
  const itens: ItemDePendencia[] = [];

  // ── 1 · CNO: obrigação acessória da obra aberta ────────────────────────
  if (obra !== null && obra.cno === null) {
    itens.push({
      id: `cno:${obra.id}`,
      familia: "cno",
      bloco: bloco(COR_PENDENCIA_CNO),
      obra,
    });
  }

  // ── 2 · Persistentes (de TODAS as obras) ───────────────────────────────
  const correcoes = montarPendenciasDeAno({
    pendencias: painel.pendencias,
    linhas: painel.linhas,
    revisoes: painel.revisoes,
  });
  for (const c of correcoes) {
    if (c.desfecho !== null) continue;
    itens.push({
      id: c.id,
      familia: "correcao_ano_anterior",
      bloco: bloco(GRAVIDADE_CORRECAO_ANO_ANTERIOR),
      correcao: c,
    });
  }

  const emitente = painel.pendencias.filter((p) => p.tipo === "emitente_errado");
  for (const p of emitente) {
    if (p.desfecho !== null) continue;
    // A única pendência da régua cuja cor é CONDICIONAL: âmbar enquanto
    // nenhum pagamento herdou o favorecido errado, vermelha depois. Calculada
    // UMA vez — a cor da fila e a cor do card são o mesmo sinal, por
    // construção.
    const sinal = sinalDoEmitenteErrado({
      documentoId: p.documentoId ?? "",
      vinculos: painel.vinculos,
      anoCorrente,
    });
    itens.push({
      id: p.id,
      familia: "emitente_errado",
      bloco: bloco(sinal.gravidade),
      persistente: p,
      sinal,
    });
  }

  if (resumo !== null) {
    // ── 3 · As 7 derivadas, com a cor que cada uma já traz ───────────────
    for (const p of resumo.pendencias) {
      itens.push({
        id: p.id,
        familia: p.tipo,
        bloco: bloco(p.gravidade),
        derivada: p,
      });
    }

    // ── 4 · Os agregados que só viviam soltos na home ────────────────────
    for (const v of resumo.vinculosCruzandoObras) {
      itens.push({
        id: `vinculo-cruzando:${v.pagamentoId}:${v.documentoId}`,
        familia: "vinculo_cruzando_obras",
        bloco: bloco(COR_VINCULO_CRUZANDO_OBRAS),
        vinculo: v,
      });
    }

    if (resumo.terrenoPagoSemComprovante !== null) {
      itens.push({
        id: "terreno-pago-sem-comprovante",
        familia: "terreno_pago_sem_comprovante",
        bloco: bloco(COR_PAGO_SEM_COMPROVANTE),
        terrenoPagoSemComprovante: resumo.terrenoPagoSemComprovante,
      });
    }

    if (resumo.documentosSemArquivo !== null) {
      itens.push({
        id: "documentos-sem-arquivo",
        familia: "documentos_sem_arquivo",
        bloco: bloco(COR_NOTA_SEM_ARQUIVO),
        documentosSemArquivo: resumo.documentosSemArquivo,
      });
    }

    for (const t of resumo.terrenoSemData) {
      itens.push({
        id: t.id,
        familia: "terreno_sem_data",
        bloco: bloco(COR_TERRENO_SEM_DATA),
        terrenoSemData: t,
      });
    }

    for (const t of resumo.terrenoMaisDeUmaData) {
      itens.push({
        id: t.id,
        familia: "terreno_mais_de_uma_data",
        bloco: bloco(COR_TERRENO_MAIS_DE_UMA_DATA),
        terrenoMaisDeUmaData: t,
      });
    }

    for (const f of resumo.financiamentoFaltaLancar) {
      itens.push({
        id: `financiamento-falta-lancar:${f.ano}`,
        familia: "financiamento_falta_lancar",
        // Já vem calculada da origem (CONTAI-035, item B): a home e o painel
        // do terreno mostram a mesma pendência e divergiam da régua.
        bloco: bloco(f.gravidade),
        financiamentoFaltaLancar: f,
      });
    }

    if (resumo.terrenoSemRegistro !== null) {
      itens.push({
        id: "terreno-sem-registro",
        familia: "terreno_sem_registro",
        bloco: bloco(COR_TERRENO_SEM_REGISTRO),
        terrenoSemRegistro: resumo.terrenoSemRegistro,
      });
    }

    // ── 5 · O aviso informativo — sem cor da régua, e nunca omitido ──────
    if (resumo.financiamentoAguardandoInforme !== null) {
      itens.push({
        id: `financiamento-aguardando-informe:${resumo.financiamentoAguardandoInforme.ano}`,
        familia: "financiamento_aguardando_informe",
        bloco: "informativo",
        financiamentoAguardandoInforme: resumo.financiamentoAguardandoInforme,
      });
    }
  }

  itens.sort((a, b) => {
    const cor = PESO_DO_BLOCO[a.bloco] - PESO_DO_BLOCO[b.bloco];
    if (cor !== 0) return cor;
    return ORDEM_DA_FAMILIA[a.familia] - ORDEM_DA_FAMILIA[b.familia];
  });

  const vermelhas = itens.filter((i) => i.bloco === "vermelho").length;
  const ambares = itens.filter((i) => i.bloco === "ambar").length;
  const avisos = itens.filter((i) => i.bloco === "informativo").length;

  return {
    itens,
    abertas: vermelhas + ambares,
    vermelhas,
    ambares,
    avisos,
    baixadas: {
      correcoes: correcoes.filter((c) => c.desfecho !== null),
      emitente: emitente.filter((p) => p.desfecho !== null),
    },
  };
}
