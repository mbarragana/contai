/**
 * COMPROMISSO — a previsão de pagamento (CONTAI-019). Módulo puro: nada de
 * rede, nada de UI.
 *
 * Fonte normativa, e nada aqui é inferido:
 * `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` (§§1-7,
 * ADENDO 1 §§A-E, ADENDO 2 §§1-7 e §§F.1-F.5).
 *
 * ⚠️ **POR QUE ESTE ARQUIVO EXISTE, E POR QUE NÃO É UM TRECHO DE
 * `pagamento.ts`** (parecer §2):
 *
 *     "Compromisso não é custo, e não é custo 'ainda pequeno' — é zero. [...]
 *     A proteção tem de ser de TIPO, não de atenção. Registro com data
 *     anulável transforma a regra em 'todo cálculo lembra de filtrar nulo' — é
 *     o defeito do `status` com outro rosto. Um cálculo escrito daqui a seis
 *     meses não pode ter como pegar um compromisso por engano."
 *
 * Consequências que valem para quem for mexer aqui:
 *
 * 1. **Nada deste arquivo é importado por `resumo.ts` ou por `vinculo.ts`.**
 *    A dependência é de mão única: compromisso pode olhar pagamento; cálculo
 *    de custo não olha compromisso. `alocarCusto` não tem nó de compromisso
 *    (§2, item 7), e `calcularResumo` não recebe compromisso por parâmetro
 *    nenhum (critério 3) — há teste de tipo afirmando as duas coisas.
 * 2. **Nenhuma função aqui devolve dinheiro que possa ser somado a custo.**
 *    O que sai daqui é decisão de branch, lista de compromissos, saldo devido
 *    e texto. `valor previsto` nunca se chama "valor" (Gate Fiscal 6.3).
 * 3. **Nenhuma função aqui cria vínculo** (critério 41): a sugestão de
 *    quitação sugere e nada mais. "Proibido inferir vínculo por heurística" —
 *    vínculo inferido errado infla custo em silêncio E mata o alerta (§5.5 do
 *    parecer de 17/08).
 */

import type {
  Compromisso,
  MeioPagamento,
  Pagamento,
} from "@/lib/types";
import { centavosParaInput } from "@/lib/money";
import type { Permissao } from "./vinculo";

// ── Data: utilitários locais (ISO yyyy-mm-dd compara lexicograficamente) ──

const MS_DIA = 24 * 60 * 60 * 1000;

function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** dd/MM — o formato do texto literal do parecer ("o compromisso de 15/09"). */
function diaMes(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

/** Dias de `a` até `b` (positivo quando `b` é depois). */
function diasEntre(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((tb - ta) / MS_DIA);
}

// ── O branch do registro (critérios 4, 5, 6, 25, 26, 27) ─────────────────

/**
 * Para onde vai o que o Mateus acabou de digitar.
 *
 * `recusado` NÃO é "erro de validação": é um fato do mundo que este app ainda
 * não sabe representar sem errar o ano do custo.
 */
export type Destino =
  | { tipo: "pagamento" }
  | { tipo: "compromisso" }
  | { tipo: "recusado"; motivo: string };

/**
 * Critério 25 — texto literal do ticket. A recusa nunca é muda: ela diz por
 * que e diz o que fazer no lugar.
 */
export const RECUSA_CARTAO =
  "compra no cartão ainda não tem fluxo neste app — o custo é do ano em que a " +
  "fatura for paga";

/**
 * A segunda metade do critério 25: o caminho que existe hoje. O fluxo completo
 * (compra → compromisso, fatura paga → um pagamento POR COMPRA) é o
 * `CONTAI-022`; enquanto ele não existe, o registro correto é depois de a
 * fatura ser paga, com a data em que ela foi paga.
 */
export const RECUSA_CARTAO_ONDE_REGISTRAR =
  "Registre depois que a fatura for paga, uma compra de cada vez, com a data " +
  "em que a fatura saiu da sua conta.";

/**
 * ⚠️ **A EXCEÇÃO NOMEADA DO CARTÃO — critério 27** (adendo 1 §B(c)):
 *
 *     "'data ≤ hoje → pagamento' NÃO VALE PARA CARTÃO. A data da compra é
 *     passada e mesmo assim não há pagamento. O que decide o branch é 'a
 *     fatura que contém esta compra já foi paga?' — nunca a data da compra."
 *
 * Por isso o teste do meio vem ANTES do teste da data, e não depois: uma
 * compra de ONTEM no cartão não pode cair em `pagamento` por nenhum caminho.
 * No instante da compra não houve desembolso do declarante — falha a condição
 * 1 do §1 do parecer de 17/08, exatamente como o boleto emitido e não pago.
 *
 * Fora do cartão, **a DATA é o controle** (diretriz de desenho 1): sem
 * segmented control "já paguei / vou pagar", que seria um toque a mais no
 * caminho de 95%.
 */
export function decidirRegistro(
  entrada: { meio: MeioPagamento; data: string },
  hojeIso: string,
): Destino {
  if (entrada.meio === "cartao") {
    return { tipo: "recusado", motivo: RECUSA_CARTAO };
  }
  return entrada.data <= hojeIso ? { tipo: "pagamento" } : { tipo: "compromisso" };
}

// ── Vencido sem resposta e o bloqueio anual (critérios 20, 21, 21b, 21c) ──

/**
 * Vencido sem resposta: aberto, com data prevista, e a data já passou.
 *
 * **Nunca some e nunca expira sozinho** (critério 20, parecer §3): "sumiço
 * silencioso devolve o compromisso para a cabeça dele, que é a falha da meta 1
 * pelo lado de fora". Não há janela, não há prazo — 90 dias depois continua
 * aqui, do mesmo jeito.
 *
 * `dataPrevista === null` **não é vencido** (critério 21b): incerteza
 * declarada não é silêncio.
 */
export function ehVencidoSemResposta(
  c: Pick<Compromisso, "situacao" | "dataPrevista">,
  hojeIso: string,
): boolean {
  if (c.situacao !== "aberto") return false;
  if (c.dataPrevista === null) return false;
  return c.dataPrevista < hojeIso;
}

/**
 * Os compromissos que travam a geração de relatório anual, agora.
 *
 * Desbloqueiam, e sempre existe uma disponível — o bloqueio nunca é uma prisão
 * (critério 21c, adendo §A corolário 2):
 * - **saiu** → cria pagamento, o compromisso vira `quitado`;
 * - **não saiu** → `cancelado` com motivo;
 * - **mudou a data** → nova data prevista (o mesmo compromisso, com histórico).
 *
 * **NÃO desbloqueia** o *"não, é outro pagamento"* da sugestão de quitação
 * (adendo §A, corolário 4): recusar um par não responde nada sobre o
 * compromisso.
 */
export function compromissosQueBloqueiam(
  cs: readonly Compromisso[],
  hojeIso: string,
): Compromisso[] {
  return cs.filter((c) => ehVencidoSemResposta(c, hojeIso));
}

export type PermissaoRelatorio =
  | { ok: true }
  | { ok: false; faltamResponder: Compromisso[] };

/**
 * ⚠️ **O DENTE DO MECANISMO — critério 21.** É o único ponto do sistema que
 * obriga resposta, e é na virada do ano que a omissão custa.
 *
 * ⚠️ **`ano` NÃO RECORTA NADA, e está na assinatura de propósito.** Decisão do
 * `contador` no adendo §A, `[Certain]`:
 *
 *     "Qualquer compromisso vencido sem resposta bloqueia a geração de
 *     QUALQUER relatório anual, e não apenas o do ano em que cai a data
 *     prevista. [...] A data prevista é uma previsão, e previsão não decide
 *     nada fiscal — é a espinha deste parecer inteiro. Deixar a previsão
 *     recortar o bloqueio é devolver à previsão um efeito fiscal, com outro
 *     rosto."
 *
 * O caso real prova a regra: previsto para 28/12/2025, pago de fato em
 * 05/01/2026. Enquanto ele estiver sem resposta, **ninguém sabe se aquele
 * desembolso pertence a 2025 ou a 2026** — as duas hipóteses estão vivas ao
 * mesmo tempo. Recortando por ano, o relatório de 2026 sairia liberado com um
 * desembolso possivelmente dele, não registrado, e sem ninguém perguntar nada.
 *
 * O parâmetro fica na assinatura para que o teste possa PROVAR que ele não
 * recorta, e para que quem tentar "otimizar" filtrando por ano tenha de apagar
 * um teste com nome próprio para conseguir.
 *
 * Sobre-bloqueio consciente (corolário 5): gerar o relatório de 2025 em 2027
 * com um compromisso de 2026 vencido e sem resposta também trava. É
 * deliberado — o custo é um toque, e a resposta é justamente o dado que decide
 * o ano.
 */
export function podeGerarRelatorioAnual(
  cs: readonly Compromisso[],
  hojeIso: string,
  ano: number,
): PermissaoRelatorio {
  void ano; // ver acima: existe para ser PROVADAMENTE ignorado.
  const faltamResponder = compromissosQueBloqueiam(cs, hojeIso);
  return faltamResponder.length === 0 ? { ok: true } : { ok: false, faltamResponder };
}

// ── Saldo (critérios 15, 29 e 30) ────────────────────────────────────────

/**
 * Quanto ainda falta pagar deste compromisso.
 *
 * ⚠️ **O saldo NÃO É CUSTO DE NADA** (critério 29, adendo §D): "não é custo
 * deste ano, não é custo de ano nenhum, e só vira custo se e quando for pago".
 * Ele é dívida conhecida, e por isso a conta é sobre o VALOR CHEIO dos
 * pagamentos — o que quita o credor é o que saiu da conta, encargo incluído.
 * Custo é outra pergunta, e ela se responde em `lib/fiscal/vinculo.ts`.
 */
export function saldoDoCompromisso(
  c: Compromisso,
  pagamentos: readonly Pagamento[],
): number {
  // ⚠️ Quitado e cancelado NÃO TÊM SALDO — critério 28: "quita o compromisso"
  // fecha sem **nenhum resíduo**: sem saldo, sem pendência, sem "pago sem
  // nota" pela diferença. Quando ele diz que o pagamento menor QUITA, o que
  // sobrava deixou de ser devido; um saldo residual aqui reabriria pela
  // aritmética uma dívida que a decisão humana encerrou.
  if (c.situacao !== "aberto") return 0;
  const pago = pagamentos
    .filter((p) => c.pagamentoIds.includes(p.id))
    .reduce((s, p) => s + p.valorCentavos, 0);
  return Math.max(0, c.valorPrevistoCentavos - pago);
}

// ── Exportação em ARQUIVO SEPARADO (critério 23, Gate Fiscal 6.5) ─────────

/**
 * Cabeçalho **literal** do Gate Fiscal 6.5 / parecer §2. Copiado, não
 * reescrito, e é a primeira linha do arquivo: quem abrir o CSV no Excel dois
 * anos depois lê isto antes de qualquer número.
 */
export const CABECALHO_AGENDA_COMPROMISSOS =
  "AGENDA DE COMPROMISSOS — VALORES PREVISTOS, NÃO EXECUTADOS. NÃO COMPÕEM CUSTO DE AQUISIÇÃO.";

/** O mesmo aviso em linguagem de tela, no topo do bloco de agendados da home. */
export const CABECALHO_BLOCO_AGENDADOS =
  "Valores previstos, não executados. Não compõem custo de aquisição.";

const SEPARADOR_CSV = ";";

function campoCsv(texto: string): string {
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const NOME_ORIGEM: Record<Compromisso["origem"], string> = {
  boleto: "Boleto",
  pix: "PIX",
  cartao: "Cartão",
};

const NOME_SITUACAO: Record<Compromisso["situacao"], string> = {
  aberto: "Em aberto",
  quitado: "Quitado",
  cancelado: "Cancelado",
};

/**
 * A agenda, em **arquivo separado** — nunca uma coluna a mais na exportação do
 * custo. A separação física é a quinta das cinco regras do Gate Fiscal 6: se o
 * previsto e o realizado saíssem no mesmo arquivo, alguém somaria a coluna.
 *
 * Sai TUDO, inclusive cancelado e quitado, com a situação numa coluna própria:
 * o parecer §3 diz que a previsão que não se realizou fica **registrada**, e
 * omitir linha de um arquivo de auditoria é o sumiço silencioso com outro
 * nome. Ordem: data prevista crescente, sem data por último, desempate por id.
 */
export function exportarAgendaCompromissos(
  cs: readonly Compromisso[],
): string {
  const ordenados = [...cs].sort((a, b) => {
    if (a.dataPrevista !== b.dataPrevista) {
      if (a.dataPrevista === null) return 1;
      if (b.dataPrevista === null) return -1;
      return a.dataPrevista < b.dataPrevista ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const linhas = [
    CABECALHO_AGENDA_COMPROMISSOS,
    [
      "favorecido",
      "valor previsto (R$)",
      "data prevista",
      "origem",
      "situação",
      "motivo do cancelamento",
    ].join(SEPARADOR_CSV),
    ...ordenados.map((c) =>
      [
        campoCsv(c.favorecidoNome ?? "Favorecido não informado"),
        centavosParaInput(c.valorPrevistoCentavos),
        c.dataPrevista === null ? "sem data definida" : dataBR(c.dataPrevista),
        NOME_ORIGEM[c.origem],
        NOME_SITUACAO[c.situacao],
        campoCsv(c.motivoCancelamento ?? ""),
      ].join(SEPARADOR_CSV),
    ),
  ];

  return linhas.join("\n");
}

// ── Sugestão de quitação (critérios 35-41, adendo §C) ─────────────────────

/**
 * A faixa de valor e a janela de datas são **convenção de produto**
 * (`[Likely]` no parecer), e o parecer diz por que isso é aceitável: **a
 * sugestão nunca cria vínculo**, então errar a faixa não tem consequência
 * fiscal — no máximo pergunta a mais ou pergunta a menos.
 *
 * Faixa e não valor exato **de propósito**: divergir é o normal (juros, multa,
 * desconto — §3), e exigir igualdade perderia justamente os casos que
 * interessam.
 */
export const TOLERANCIA_PERCENTUAL = 0.2;
export const TOLERANCIA_MINIMA_CENTAVOS = 50_000; // R$ 500,00
/** Assimétrica porque atraso é mais comum que antecipação (§C(a)(3)). */
export const JANELA_DIAS_ANTES = 30;
export const JANELA_DIAS_DEPOIS = 60;

/** `|pago − previsto| ≤ 20% do previsto ou ≤ R$ 500,00, o que for maior`. */
function dentroDaFaixaDeValor(
  pagoCentavos: number,
  previstoCentavos: number,
): boolean {
  const limite = Math.max(
    Math.round(previstoCentavos * TOLERANCIA_PERCENTUAL),
    TOLERANCIA_MINIMA_CENTAVOS,
  );
  return Math.abs(pagoCentavos - previstoCentavos) <= limite;
}

/**
 * Data do pagamento entre 30 dias ANTES e 60 dias DEPOIS da prevista.
 *
 * ⚠️ **SEM RECORTE DE ANO-CALENDÁRIO** (§C(a)(3)): "o par 28/12 → 05/01 é
 * exatamente onde a duplicidade custa mais caro (custo no ano errado)". Por
 * isso a conta é em DIAS corridos e nunca toca no ano.
 */
function dentroDaJanelaDeDatas(
  dataPagamento: string,
  dataPrevista: string,
): boolean {
  const dias = diasEntre(dataPrevista, dataPagamento);
  return dias >= -JANELA_DIAS_ANTES && dias <= JANELA_DIAS_DEPOIS;
}

export interface QuitacaoRecusada {
  pagamentoId: string;
  compromissoId: string;
}

/**
 * Os compromissos que este pagamento **pode** estar quitando.
 *
 * ⚠️ **ESTA FUNÇÃO NÃO CRIA VÍNCULO** (critério 41, §C(d)): ela devolve uma
 * lista para o app PERGUNTAR. "Não pode existir caminho de código que grave a
 * quitação sem ato humano explícito."
 *
 * Gatilho **cumulativo** — as três condições ao mesmo tempo (§C(a)):
 * 1. **mesmo `favorecidoId`**, cuja chave é o CNPJ/CPF. ⚠️ **Proibido casar
 *    por nome**: "CNPJ errado não é typo, é outro favorecido". Pagamento sem
 *    favorecido identificado não casa com nada — `null === null` não é
 *    identidade;
 * 2. **valor dentro da faixa**;
 * 3. **data dentro da janela**, sem recorte de ano.
 *
 * Além disso, e por construção: só `situacao === 'aberto'` (quitado ou
 * cancelado não têm o que quitar), só com `dataPrevista !== null` (sem data
 * não há janela a comparar) e nunca um par já recusado (critério 39 — "o app
 * não repergunta daquele par: repetir ensina a dispensar sem ler").
 *
 * ⚠️ **Quarta condição que o parecer não lista, e que eu acrescentei: MESMA
 * OBRA.** O §C não a considerou porque escreveu o gatilho antes de olhar o
 * multi-obra do CONTAI-003. Sugerir a quitação de um compromisso de outra
 * matrícula produziria um vínculo que `lib/data.ts` recusa de qualquer forma
 * (mesma guarda do critério 11 do CONTAI-018: nada soma entre obras, porque
 * cada matrícula é um item da declaração) — a sugestão só ensinaria o Mateus a
 * ver botão que não funciona. **Registrado para o Gate 2.**
 *
 * ⚠️ **Devolve TODOS os elegíveis** (critério 36, §5.5 do parecer de 17/08):
 * "proibido escolher o mais próximo — escolher é heurística decidindo
 * vínculo". A ordenação abaixo é só para a lista não dançar entre dois
 * carregamentos; ela não elege ninguém.
 */
export function compromissosElegiveisParaQuitacao(
  pagamento: Pick<
    Pagamento,
    "id" | "obraId" | "favorecidoId" | "valorCentavos" | "dataPagamento"
  >,
  compromissos: readonly Compromisso[],
  recusas: readonly QuitacaoRecusada[],
): Compromisso[] {
  const recusados = new Set(
    recusas
      .filter((r) => r.pagamentoId === pagamento.id)
      .map((r) => r.compromissoId),
  );

  return compromissos
    .filter((c) => c.situacao === "aberto")
    .filter((c) => c.dataPrevista !== null)
    .filter((c) => c.obraId === pagamento.obraId)
    .filter(
      (c) =>
        pagamento.favorecidoId !== null && c.favorecidoId === pagamento.favorecidoId,
    )
    .filter((c) => !recusados.has(c.id))
    .filter((c) =>
      dentroDaFaixaDeValor(pagamento.valorCentavos, c.valorPrevistoCentavos),
    )
    .filter((c) => dentroDaJanelaDeDatas(pagamento.dataPagamento, c.dataPrevista!))
    .sort((a, b) => {
      if (a.dataPrevista !== b.dataPrevista) {
        return a.dataPrevista! < b.dataPrevista! ? -1 : 1;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

// ── Guarda de obra na quitação ───────────────────────────────────────────

export const MOTIVO_QUITACAO_OBRA_DIFERENTE =
  "Este pagamento e este agendamento estão em obras diferentes. Nada é somado " +
  "entre obras — cada matrícula é um item da declaração. Corrija a obra de um " +
  "dos dois antes de quitar.";

/**
 * Mesma guarda do critério 11 do CONTAI-018, do lado do compromisso: o banco
 * não impede (a policy `dono_compromisso_pagamento` só exige mesmo DONO), e um
 * pagamento de outra matrícula quitando este compromisso somaria custo entre
 * obras no momento em que o vínculo com o documento fosse criado.
 *
 * Vale para o caminho de escrita E para a sugestão: `compromissosElegiveisParaQuitacao`
 * já filtra por obra, e esta função é a rede de baixo, para o caminho que
 * chegar sem passar pela sugestão.
 */
export function podeQuitar(
  compromisso: Pick<Compromisso, "obraId">,
  pagamento: Pick<Pagamento, "obraId">,
): Permissao {
  if (compromisso.obraId !== pagamento.obraId) {
    return { ok: false, motivo: MOTIVO_QUITACAO_OBRA_DIFERENTE };
  }
  return { ok: true };
}

// ── Textos da sugestão — literais do adendo §C(b), critério 38 ────────────
// Copiados do parecer, não reescritos. O `{data}` do template é dd/MM, como no
// exemplo do próprio parecer ("o compromisso de 15/09").

export const PERGUNTA_QUITACAO = "Este pagamento quita o compromisso de {data}?";

export function perguntaQuitacao(dataPrevistaIso: string): string {
  return PERGUNTA_QUITACAO.replace("{data}", diaMes(dataPrevistaIso));
}

export const QUITACAO_SIM = "Sim, quita este compromisso";
export const QUITACAO_NAO = "Não, é outro pagamento";

/**
 * O que acontece se ele não quitar — dito ANTES da escolha, porque a escolha
 * silenciosa é a que ele repete sem ler.
 */
export const QUITACAO_CONSEQUENCIA_DO_NAO =
  "Se não quitar, o compromisso continua em aberto e este pagamento fica registrado sozinho.";
