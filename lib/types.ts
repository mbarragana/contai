/**
 * Tipos do schema. Enums, rows e inserts DERIVAM dos tipos gerados do banco
 * (`lib/database.types.ts`, produzido por `npx supabase gen types typescript
 * --linked`) — as migrations 0001/0002 estão aplicadas no projeto linkado.
 * Não redeclare coluna à mão aqui: é assim que o tipo descola do banco sem
 * ninguém perceber.
 *
 * Convenção: `*Row` = o que o PostgREST devolve; os tipos de domínio (sem
 * sufixo) já vêm com dinheiro em CENTAVOS (inteiro), para somar valor fiscal
 * sem erro de ponto flutuante.
 */

import type {
  Enums,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/lib/database.types";

// ── Enums ────────────────────────────────────────────────────────────────
export type TipoFavorecido = Enums<"tipo_favorecido">;
export type TipoDocumento = Enums<"tipo_documento">;
export type Classificacao = Enums<"classificacao">;
export type StatusDocumento = Enums<"status_documento">;
export type MeioPagamento = Enums<"meio_pagamento">;
export type StatusPagamento = Enums<"status_pagamento">;
export type OrigemCompromisso = Enums<"origem_compromisso">;
export type SituacaoCompromisso = Enums<"situacao_compromisso">;
export type ResolucaoDiferenca = Enums<"resolucao_diferenca">;
// ── CONTAI-010 ────────────────────────────────────────────────────────────
export type NaturezaAquisicaoTerreno = Enums<"natureza_aquisicao_terreno">;
export type TipoDesembolsoTerreno = Enums<"tipo_desembolso_terreno">;
export type EstadoDesembolsoTerreno = Enums<"estado_desembolso_terreno">;
export type OrigemRecursoEntrada = Enums<"origem_recurso_entrada">;
// ── CONTAI-021 ────────────────────────────────────────────────────────────
export type EntidadeRevisao = Enums<"entidade_revisao">;
export type MotivoRevisao = Enums<"motivo_revisao">;
export type TipoPendencia = Enums<"tipo_pendencia">;
export type DesfechoPendencia = Enums<"desfecho_pendencia">;

// ── Rows (PostgREST) ─────────────────────────────────────────────────────
export type ObraRow = Tables<"obra">;
export type FavorecidoRow = Tables<"favorecido">;
export type DocumentoRow = Tables<"documento">;
export type PagamentoRow = Tables<"pagamento">;
export type PagamentoDocumentoRow = Tables<"pagamento_documento">;
export type CompromissoRow = Tables<"compromisso">;
export type CompromissoPagamentoRow = Tables<"compromisso_pagamento">;
export type CompromissoDataHistoricoRow = Tables<"compromisso_data_historico">;
export type PagamentoDiferencaRow = Tables<"pagamento_diferenca">;
export type QuitacaoRecusadaRow = Tables<"quitacao_recusada">;
export type TerrenoDesembolsoRow = Tables<"terreno_desembolso">;
export type TerrenoDesembolsoAnexoRow = Tables<"terreno_desembolso_anexo">;
export type FinanciamentoRow = Tables<"financiamento">;
export type FinanciamentoInformeRow = Tables<"financiamento_informe">;
export type RevisaoRow = Tables<"revisao">;
export type RevisaoAnoAfetadoRow = Tables<"revisao_ano_afetado">;
export type DocumentoAnexoRow = Tables<"documento_anexo">;
export type PendenciaRow = Tables<"pendencia">;
export type PendenciaDesfechoRow = Tables<"pendencia_desfecho">;

// ── Inserts ──────────────────────────────────────────────────────────────
export type ObraInsert = TablesInsert<"obra">;
export type FavorecidoInsert = TablesInsert<"favorecido">;
export type DocumentoInsert = TablesInsert<"documento">;
export type PagamentoInsert = TablesInsert<"pagamento">;
export type CompromissoInsert = TablesInsert<"compromisso">;
export type TerrenoDesembolsoInsert = TablesInsert<"terreno_desembolso">;
export type FinanciamentoInsert = TablesInsert<"financiamento">;
export type FinanciamentoInformeInsert = TablesInsert<"financiamento_informe">;
export type TerrenoDesembolsoAnexoInsert =
  TablesInsert<"terreno_desembolso_anexo">;

// ── Updates ──────────────────────────────────────────────────────────────
// Só existe um: o UPDATE de `terreno_desembolso`, que serve a DOIS atos —
// completar a data (CONTAI-010, critério 23) e responder / re-responder a
// pergunta do critério 12 (CONTAI-027).
export type TerrenoDesembolsoUpdate = TablesUpdate<"terreno_desembolso">;

// ── Domínio (centavos) ───────────────────────────────────────────────────
export interface Obra {
  id: string;
  nome: string;
  cno: string | null;
  matricula: string | null;
  cartorio: string | null;
  municipio: string | null;
  /**
   * A bifurcação do CONTAI-010: é ela que decide qual regra roda. `null` é a
   * obra cadastrada antes do ticket — pendência de COMPLEMENTO, nunca bloqueio.
   * O app não inventa fato, nem fato que "todo mundo sabe".
   *
   * ⚠️ O custo do terreno NÃO é mais atributo da obra: ele saiu daqui e virou
   * `terreno_desembolso` + `financiamento_informe`, porque é um número POR ANO
   * (regime de caixa) e nunca coube numa coluna.
   */
  naturezaAquisicaoTerreno: NaturezaAquisicaoTerreno | null;
  /** Obrigatória: ancora o prazo de 30 dias do CNO e o período da aferição. */
  dataInicioObra: string;
  /** Quando o CNO saiu; do início até aqui é a janela das notas sem CNO. */
  cnoRegistradoEm: string | null;
  unidadesAutonomas: number;
  origemDesmembramentoLoteamento: boolean;
}

export interface Documento {
  id: string;
  /** Obra a que o registro pertence — corrigível pela interface (crit. 13). */
  obraId: string;
  tipo: TipoDocumento;
  status: StatusDocumento;
  valorCentavos: number | null;
  vencimento: string | null;
  classificacao: Classificacao | null;
  destinatarioCpfOk: boolean;
  retencao11: boolean | null;
  motivoQuarentena: string | null;
  favorecidoNome: string | null;
  /**
   * O PONTEIRO para o favorecido. Existe no domínio desde o CONTAI-021 porque
   * corrigir o nome do emitente (critério 6) grava em `favorecido.nome`, e a
   * tela precisa saber em QUAL linha — o nome não identifica ninguém.
   *
   * ⚠️ Corrigir este ponteiro (apontar o documento para outro favorecido) é a
   * RODADA 2, e não existe caminho para isso hoje: o parecer §4 e o critério
   * 12 dão a saída declarada, sem campo.
   */
  favorecidoId: string | null;
  /**
   * CNPJ/CPF do emitente, só dígitos. Vem junto do nome porque a tela de
   * registrar o pagamento da nota preenche os dois: fazer o Mateus redigitar o
   * documento arrisca um favorecido duplicado por typo — e a dedup de
   * `garantirFavorecido` é pelo DOCUMENTO, não pelo nome.
   */
  favorecidoDocumento: string | null;
  arquivoPath: string;
}

export interface Pagamento {
  id: string;
  obraId: string;
  valorCentavos: number;
  /** Regime de caixa: é DAQUI que sai o ano-calendário do custo. */
  dataPagamento: string;
  meio: MeioPagamento;
  status: StatusPagamento;
  favorecidoId: string | null;
  favorecidoNome: string | null;
  /** PF x PJ decide qual documento hábil está faltando (NF vs. recibo). */
  favorecidoTipo: TipoFavorecido | null;
  comprovantePath: string | null;
  /** Documentos hábeis vinculados (N:M — Relato 002). */
  documentoIds: string[];

  // ── Composição do desembolso (CONTAI-019, tabela `pagamento_diferenca`) ──
  // ⚠️ Estes três campos são DERIVADOS de `pagamento_diferenca`, e não colunas
  // de `pagamento`: o critério 2 do CONTAI-019 é explícito em que `pagamento`
  // não ganha coluna nova. Quem não tem linha lá chega aqui com 0/0/null.

  /**
   * Juros e multa de mora identificados na confirmação. **Não compõem custo de
   * aquisição** (parecer de 2026-08-18, §3): não remuneram bem ou serviço
   * incorporado ao imóvel. Saem do pagamento ANTES do teto do mínimo (§F.3).
   */
  encargosCentavos: number;
  /**
   * O que sobrou do pagamento sem explicação. Fica fora do custo enquanto a
   * resolução for `null` — direção segura, subestima (§F.2).
   */
  naoExplicadoCentavos: number;
  /**
   * `null` é o **"não sei ainda"** do §F.2 — estado permitido e o único que
   * pode ser inicial, porque é o único que não afirma nada.
   */
  resolucaoDiferenca: ResolucaoDiferenca | null;
}

/**
 * A previsão. **Não é custo, e não é custo "ainda pequeno" — é zero**
 * (parecer de 2026-08-18, §1).
 *
 * Tipo separado de `Pagamento` por decisão fiscal, não por conveniência
 * (parecer §2): a proteção tem de ser de TIPO, não de atenção. Nenhuma função
 * de apuração aceita este tipo na entrada — a tipagem impede, não a
 * disciplina (critério 3).
 */
export interface Compromisso {
  id: string;
  obraId: string;
  favorecidoId: string | null;
  favorecidoNome: string | null;
  /** O campo se chama **valor previsto**, nunca "valor" (Gate Fiscal 6.3). */
  valorPrevistoCentavos: number;
  /**
   * `null` = "sem data definida", estado legítimo alcançável só pelo saldo de
   * uma quitação parcial. Não é vencido e não bloqueia (adendo §A, corolário 3).
   */
  dataPrevista: string | null;
  origem: OrigemCompromisso;
  documentoOrigemId: string | null;
  situacao: SituacaoCompromisso;
  motivoCancelamento: string | null;
  /** Cartão: data da compra. Dado probatório — **não decide ano nenhum**. */
  dataCompra: string | null;
  /** Vínculo 1:N — um compromisso pode ser quitado por vários pagamentos. */
  pagamentoIds: string[];
  /** Quantas vezes a data prevista já mudou — o "adiado N×" do critério 34. */
  adiamentos: number;
}

// ── CONTAI-010 · terreno e financiamento (centavos) ──────────────────────

/**
 * Um desembolso do terreno, com a SUA data. O caso à vista é o caso degenerado
 * — um desembolso (parecer §5).
 *
 * ⚠️ **Não é `Pagamento`, e o tipo separado é decisão fiscal** (parecer §5, "A
 * parcela é um `pagamento` comum do app? NÃO"): não entra em Pagamentos
 * Efetuados, não entra na base de aferição do INSS e não entra no headline de
 * "custo em risco" do CONTAI-005. O favorecido é o banco ou o cartório; o
 * documento hábil é contrato/guia, não NF. A proteção é de TIPO.
 */
export interface TerrenoDesembolso {
  id: string;
  obraId: string;
  tipo: TipoDesembolsoTerreno;
  valorCentavos: number;
  /**
   * `null` = a data não é conhecida. **Nunca inventada** (critério 22): nem
   * `created_at`, nem hoje. Sem ela o valor não tem ano-calendário — vira
   * pendência de complemento, visível e sem bloquear nada.
   */
  dataPagamento: string | null;
  /** `previsto` não entra em ano nenhum, nem no corrente (critério 5). */
  estado: EstadoDesembolsoTerreno;
  /** FGTS na entrada é desembolso dele e ENTRA no custo (parecer §2a). */
  origemRecurso: OrigemRecursoEntrada | null;
  /**
   * Os papéis deste desembolso, do mais antigo para o mais novo
   * (CONTAI-027, critério 7). A coluna única `arquivoPath` **morreu** na
   * migration 0010, com backfill: `papel = 'comprovante'`.
   *
   * ⚠️ Lista VAZIA **não diz nada sobre o ano-calendário** — quem decide isso
   * é `dataPagamento`, e só ela. As duas situações em que ela fica vazia:
   * - `previsto` — nada foi pago, não há o que anexar (critério 5);
   * - uma linha `pago` que nunca recebeu papel. Ela **SOMA normalmente no ano
   *   dela** — o custo existe, o lastro documental é que está fraco —, e é
   *   **pendência visível** pelo critério 15 (`pagoSemPapel`, em
   *   `lib/fiscal/terreno.ts`).
   *
   * ⚠️ Ninguém conta anexos por conta própria: quem responde "tem papel?",
   * "tem dois comprovantes?" e "a pergunta dispara?" é `lib/fiscal/terreno.ts`.
   * Uma terceira via de contagem na tela é como o pre-mortem nº 5 silencia.
   */
  anexos: TerrenoDesembolsoAnexo[];
  /**
   * A resposta VIGENTE do critério 12 — *"o dinheiro saiu todo no mesmo
   * dia?"*. `null` = nunca respondida (ou represada, por falta de data).
   *
   * `false` é a pendência **"Um lançamento, mais de uma data"**, e ela **não
   * tem baixa no app** (§5 do parecer de 2026-08-21): não se dispensa, não se
   * adia, não se esconde.
   */
  debitosMesmoDia: boolean | null;
  /**
   * Quando a resposta vigente foi dada — **critério 12b, requisito fiscal**
   * (§4d): a resposta se grava com a data em que foi dada, **nos dois casos,
   * inclusive o "sim"**. Sem ela, em 2034 ninguém distingue *"ele afirmou que
   * foi tudo no mesmo dia"* de *"ninguém perguntou"*.
   *
   * É também o que faz a re-pergunta (§6) ser derivação pura: comprovante com
   * `createdAt` posterior a esta marca é fato novo que a resposta não cobre.
   */
  debitosMesmoDiaRespondidoEm: string | null;
}

/**
 * Um papel pendurado num desembolso do terreno (migration 0010).
 *
 * ⚠️ **Sem valor e sem data próprios**, e as duas ausências são critério
 * (10 e 11): o valor do lançamento é digitado UMA vez, no lançamento, e data
 * por anexo seria "fabricar a evidência que o app não tem" (Gate Fiscal §§1
 * e 2). O que o anexo carrega é `papel`, e só.
 */
export interface TerrenoDesembolsoAnexo {
  id: string;
  arquivoPath: string;
  papel: PapelDeAnexo;
  /** Do banco. É ele que ordena a linha do tempo da re-pergunta (§6). */
  createdAt: string;
}

/**
 * Critério 14 e §7 do parecer de 2026-08-21 — conjunto FECHADO de três,
 * obrigatório e sem default. Não alimenta apuração nenhuma: existe para o
 * dossiê responder, em 2034, qual papel sustenta o quê.
 *
 * ⚠️ **Valor novo neste conjunto exige parecer do `contador`** (mesma
 * contrapartida da D32). E `comprovante` é o **único** que dispara a pergunta
 * do critério 12.
 */
export type PapelDeAnexo = "comprovante" | "nota" | "contrato";

/** O contrato, 1x na vida (critério 7). Um por obra. */
export interface Financiamento {
  id: string;
  obraId: string;
  instituicao: string;
  numeroContrato: string | null;
  dataContrato: string;
  /**
   * ⚠️ **NUNCA vai para o custo** (critério 8). Existe para o texto da
   * discriminação e para fechar a conta de quem lê (pago + saldo = preço).
   */
  precoContratadoCentavos: number;
  numeroParcelas: number | null;
}

/**
 * O informe anual — um por contrato + ano-base (critério 9). As SETE rubricas
 * ficam guardadas SEPARADAS, sempre: é isso que permite recompor o custo sob
 * qualquer entendimento sem redigitar nada.
 */
export interface FinanciamentoInforme {
  id: string;
  financiamentoId: string;
  /** O exercício é DERIVADO (`anoBase + 1`) — duas colunas descolariam. */
  anoBase: number;
  amortizacaoCentavos: number;
  jurosCorrecaoCentavos: number;
  segurosCentavos: number;
  taxasFcvsCentavos: number;
  moraCentavos: number;
  multaCentavos: number;
  diferencaTeoricoPagoCentavos: number;
  /** A trava: é contra ele que as sete linhas têm de bater (critério 11). */
  totalPagoCentavos: number;
  /** Informativo. Nunca somado, nunca subtraído (critério 15). */
  saldoDevedorCentavos: number;
  arquivoPath: string;
}

// ── CONTAI-021 · correção de documento registrado (centavos) ─────────────

/**
 * Um ano-calendário cujo custo comprovado mudou por causa de uma correção,
 * **numa obra**.
 *
 * ⚠️ A dimensão `obraId` não é decoração: sem ela o critério 20(c) é
 * impossível — depois de um move o documento só conhece o DESTINO, e derivar a
 * obra dele apagaria a ORIGEM, que é justamente o lado onde o custo caiu e
 * onde "pago sem nota" subiu (adendo §5.4).
 */
export interface AnoAfetado {
  obraId: string;
  ano: number;
  antesCentavos: number;
  depoisCentavos: number;
  /**
   * Abre (ou acumula em) pendência de retificadora? Só quando o ano é
   * ANTERIOR ao corrente — §5.3. A decisão mora em `lib/fiscal/revisao.ts`,
   * onde "hoje" é injetável e testável, nunca no Postgres do container.
   */
  pendencia: boolean;
}

/** Uma linha do rastro (§5). `antes`/`depois` são texto: `null` ≠ zero. */
export interface Revisao {
  id: string;
  atoId: string;
  entidade: EntidadeRevisao;
  entidadeId: string;
  campo: string;
  antes: string | null;
  depois: string | null;
  quando: string;
  motivo: MotivoRevisao;
  motivoTexto: string | null;
  anosAfetados: AnoAfetado[];
}

/**
 * A pendência persistente (§6.3): não some ao fechar a tela.
 *
 * ⚠️ Nome com sufixo de propósito: `lib/fiscal/resumo.ts` já exporta uma
 * `Pendencia`, que é OUTRA COISA — o cartão derivado do estado atual da obra
 * ("pago sem nota", "quarentena"), recalculado a cada carga e que desaparece
 * sozinho quando o fato muda. Esta aqui é LINHA GRAVADA: nasce de um ato,
 * sobrevive ao recálculo e só sai da lista por um desfecho escolhido.
 */
export interface PendenciaPersistente {
  id: string;
  tipo: TipoPendencia;
  /** `retificadora_possivel`: a chave. A DAA é do contribuinte, não da obra. */
  ano: number | null;
  /** `emitente_errado`: a chave. */
  documentoId: string | null;
  abertaEm: string;
  /** `null` = aberta. Preenchido = baixada, e a baixa é acréscimo. */
  desfecho: {
    desfecho: DesfechoPendencia;
    dataInformada: string | null;
    baixadaEm: string;
  } | null;
}
