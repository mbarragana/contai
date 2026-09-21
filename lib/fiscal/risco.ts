/**
 * **CONTAI-005 — o headline da home: "Custo em risco no IR".**
 *
 * Substitui o `emPendenciaCentavos`, que era a soma crua de `pendencias[]` e
 * por isso somava **quatro moedas diferentes** (perda de custo, conta a pagar,
 * base de INSS) — número que não corresponde a nenhuma linha de nenhuma
 * declaração. O agregado misturado **morre**; a lista de pendências item a item
 * fica.
 *
 * Fonte, literal e sem reescrita: `docs/pareceres/2026-08-16-gate-fiscal-contai-004-005.md`,
 * **Parte 2** (ressalvas R1–R5, bloqueantes). Os textos de tela são cópia do
 * §4, Blocos 1 a 3 — *"não se reescrevem"*.
 *
 * ## A regra de composição (§1 do parecer, item por item)
 *
 * 1. **A unidade de conta é o dispêndio, não o registro.** Um mesmo dispêndio
 *    conta **uma vez**.
 * 2. **Entram**: (a) o que foi **pago e não tem nota** que o cubra, pelo valor
 *    exposto do pagamento; (b) todo **documento em quarentena**, pelo valor do
 *    documento **menos** o valor dos pagamentos vinculados já contados em (a);
 *    (c) o que foi **pago sem comprovante**, pelo valor bloqueado por ele.
 * 3. **Não entram**: boleto (qualquer status); NF de serviço com retenção
 *    destacada; documento sem número/data; pagamento coberto por documento
 *    hábil; **diferença sem explicação**.
 * 4. **Nada soma entre obras** — a entrada é de UMA obra.
 *
 * ⚠️ **(c) entrou no Gate 2 do CONTAI-005 (REQUEST CHANGES do `contador`)**, e
 * o fundamento fecha a questão: o **art. 17 da IN SRF 84/2001 exige dispêndio
 * comprovado E documentação hábil — condição COMPOSTA**. `pago_sem_nota` falha
 * a perna documental; `pago_sem_comprovante` falha a perna da comprovação do
 * desembolso. **Mesma moeda** (perda de custo de aquisição), mesma unidade,
 * mesma consequência — logo, mesma soma. O tipo é posterior ao parecer de
 * 16/08 (nasceu no CONTAI-019/025), e era essa a razão de ele não estar na
 * lista original.
 *
 * ⚠️ **`diferenca_sem_explicacao` FICA FORA, e isso é decisão, não omissão**
 * (mesmo Gate 2): a natureza fiscal dela é **indeterminada** — pode nunca virar
 * custo (mora, item não incorporado ao imóvel, erro de registro). Somá-la
 * afirmaria perda de um custo que pode não existir.
 *
 * ⚠️ **(a) mudou de fonte, não de significado.** O parecer diz *"todo pagamento
 * com status `aguardando_nf`"*, redação de 16/08. O parecer de 18/08 (§2) e o
 * CONTAI-018 derrubaram o filtro por `status` — hoje quem responde "quanto
 * deste pagamento está sem nota" é `alocarCusto`, pelo **excedente não coberto
 * por documento hábil vinculado**. É a mesma pergunta com resposta melhor: o
 * pagamento coberto pela metade expõe metade, e não o valor cheio.
 *
 * ⚠️ **A dedup de (b) só opera sobre VÍNCULO EXPLÍCITO** (`pagamento_documento`),
 * jamais sobre heurística de "mesmo favorecido, mesmo valor" — *"heurística que
 * subtrai em silêncio some com o alerta e ninguém vê"* (§5). Ela hoje opera
 * quase sempre sobre conjunto vazio; existe para o número **não passar a mentir**
 * quando a conciliação crescer (mesma classe de defeito latente do CONTAI-008,
 * D19).
 *
 * ## O que NÃO está aqui, e por quê
 *
 * - **Boleto**: título de cobrança, não desembolso. No regime de caixa, sem
 *   dispêndio não há custo a perder — e o risco dele é de outra moeda (juros e
 *   mora, que não integram o custo). *"O headline conta desembolsos e
 *   documentos, nunca títulos de cobrança"* (§3).
 * - **INSS**: apuração diferente, base diferente, **nunca se somam, em direção
 *   nenhuma** (§2). E a nota de serviço sem retenção que está no CPF do Mateus e
 *   foi paga é custo **confirmado** — pô-la em "custo em risco" afirmaria o
 *   oposto exato da verdade fiscal daquele documento. Por isso ela tem campo
 *   próprio, **em base**, e a frase de fechamento do Bloco 2 não é opcional.
 */

import { formatarBRL } from "@/lib/money";
import type { Documento, Pagamento } from "@/lib/types";
import { valorBloqueadoPorComprovante, type Alocacao } from "./vinculo";

// ── Textos de tela — cópia literal do §4 do parecer ──────────────────────

/** Bloco 1, primeira linha. O rótulo diz **risco**, nunca perda (pre-mortem 1). */
export const CUSTO_EM_RISCO_TITULO = "Custo em risco no IR";

export const CUSTO_EM_RISCO_EXPLICACAO =
  "Gastos desta obra que hoje não entram no custo de aquisição — falta documento hábil no seu CPF.";

/**
 * Estado zero. **Não está no parecer** (ele só cobre o cenário com exposição):
 * foi proposto pelo `designer` no mock v5 e **ratificado pelo `contador` em
 * 2026-08-24**, junto da aprovação do mock pelo Mateus (critério 1 do ticket).
 *
 * O "hoje" é a palavra que faz o trabalho: afirma o estado de agora, não uma
 * quitação — documento em falta pode nascer amanhã.
 */
export const CUSTO_EM_RISCO_ZERO =
  "Nenhum gasto desta obra está sem documento hábil no seu CPF, hoje.";

/**
 * **R3 — a linha de imposto só existe com "até".** Alíquota da Lei 8.981/1995
 * art. 21 (redação da Lei 13.259/2016); as reduções citadas são a Lei
 * 11.196/2005 **art. 40** (fator de redução por tempo de posse) e **art. 39**
 * (reinvestimento). A citação errada foi corrigida em 2026-08-09 e não volta.
 *
 * ⚠️ O denominador é **exclusivamente** o headline de IRPF. Nada de INSS entra
 * nesta conta, em direção nenhuma.
 */
export const ALIQUOTA_GANHO_CAPITAL = 0.15;

/** `0,15 × headline`, em centavos — a fórmula visível do §4. */
export function impostoAteCentavos(custoEmRiscoCentavos: number): number {
  return Math.round(ALIQUOTA_GANHO_CAPITAL * custoEmRiscoCentavos);
}

/**
 * Bloco 1, última linha.
 *
 * ⚠️ Existe porque *"R$ 49.850 em risco", sozinho, é lido como "perdi
 * R$ 49.850"* — erra por quase sete vezes, na direção do pânico. E existe só
 * **com** o "até" e o disclaimer: sem eles, é a previsão em reais que o parecer
 * de 2026-08-08 recusou.
 */
export function textoImpostoAte(custoEmRiscoCentavos: number): string {
  return (
    `Pode custar até ${formatarBRL(impostoAteCentavos(custoEmRiscoCentavos))}` +
    " a mais de imposto na venda (15% sobre o valor em risco; o fator de" +
    " redução por tempo de posse e as isenções podem diminuir)."
  );
}

/** Bloco 2 — o chip que impede a soma de cabeça. */
export const INSS_OUTRA_APURACAO = "Outra apuração — não soma com a de cima";

export function tituloAfericaoInss(cno: string): string {
  return `Aferição do INSS — CNO ${cno}`;
}

export const INSS_EM_NOTAS =
  "em notas de serviço que não abatem a base da aferição desta obra.";

export const INSS_NAO_E_IMPOSTO =
  "Isso não é imposto a pagar nem custo perdido: é base que deixa de ser reduzida. O valor em reais só existe quando a aferição for calculada.";

/**
 * ⚠️ **NÃO É OPCIONAL** (R2, literal): *"é ela que impede o leitor de somar
 * 18.000 aos 49.850 com a própria cabeça"*. Quem apaga esta frase reabre o erro
 * que o card inteiro existe para fechar.
 */
export const INSS_CONTINUAM_VALENDO_NO_IRPF =
  "Estas notas continuam valendo integralmente como custo de aquisição no IRPF.";

// ── O número ─────────────────────────────────────────────────────────────

/**
 * **R4 — o total nunca aparece sem a decomposição.** Por isso o total e as
 * parcelas viajam num tipo só: não existe caminho em que a tela receba o
 * número e não tenha as partes na mão.
 */
export interface CustoEmRiscoIr {
  /** Soma das TRÊS parcelas abaixo, sempre. */
  totalCentavos: number;
  /** (a) — dispêndio já feito, sem documento hábil que o cubra. */
  pagosSemNotaCentavos: number;
  /** (b) — documento em quarentena, líquido dos pagamentos já contados em (a). */
  notaForaDoCpfCentavos: number;
  /**
   * (c) — dispêndio sem o comprovante que prova que ele saiu da conta do
   * declarante. A outra perna da condição composta do art. 17.
   */
  pagosSemComprovanteCentavos: number;
}

export interface EntradaCustoEmRisco {
  documentos: Documento[];
  pagamentos: Pagamento[];
  alocacao: Alocacao;
}

/**
 * A fórmula do §1, e **este teste é o registro que não envelhece** (pre-mortem
 * 2 do ticket): no dia em que alguém perguntar o que o número significava na
 * declaração de 2026, a resposta está em `risco.test.ts`.
 */
export function custoEmRiscoIr(entrada: EntradaCustoEmRisco): CustoEmRiscoIr {
  const { documentos, pagamentos, alocacao } = entrada;

  // (a) O que foi pago e continua sem nota que o cubra. Não é o valor cheio do
  // pagamento: encargos e diferença sem explicação estão fora do elegível por
  // motivos próprios, cada um na sua pendência (CONTAI-019, ADENDO 2 §5).
  //
  // (c) O que foi pago sem o comprovante do desembolso.
  //
  // ⚠️ **(a) e (c) são MUTUAMENTE EXCLUSIVOS por construção**, e é isso que
  // impede o mesmo dinheiro de entrar duas vezes: sem comprovante o elegível é
  // ZERO, logo `semNotaCentavos` é zero e só (c) tem valor; com comprovante,
  // `valorBloqueadoPorComprovante` é zero e só (a) tem. A soma por pagamento
  // abaixo é sempre "um ou o outro", nunca os dois.
  const exposto = new Map<string, number>();
  let pagosSemNotaCentavos = 0;
  let pagosSemComprovanteCentavos = 0;
  for (const p of pagamentos) {
    const semNota = alocacao.porPagamento.get(p.id)?.semNotaCentavos ?? 0;
    const semComprovante = valorBloqueadoPorComprovante(p);
    pagosSemNotaCentavos += semNota;
    pagosSemComprovanteCentavos += semComprovante;
    const total = semNota + semComprovante;
    if (total > 0) exposto.set(p.id, total);
  }

  // (b) Quarentena, MENOS o que já foi contado em (a) ou em (c) pelo vínculo
  // explícito. O abatimento vale para as duas parcelas de pagamento porque a
  // regra 1 é sobre o DISPÊNDIO: contado uma vez, não importa por qual perna do
  // art. 17 ele entrou.
  //
  // ⚠️ O orçamento de cada pagamento é **consumível**: um pagamento ligado a
  // dois documentos em quarentena abate no primeiro e não abate de novo no
  // segundo. Sem isso a subtração passaria a subestimar o risco — e o §5 é
  // explícito em que esse é o erro perigoso, o que **some com o alerta**.
  const restante = new Map(exposto);
  let notaForaDoCpfCentavos = 0;
  for (const d of documentos) {
    if (d.status !== "quarentena") continue;
    let valor = d.valorCentavos ?? 0;
    for (const p of pagamentos) {
      if (valor <= 0) break;
      // VÍNCULO EXPLÍCITO, nunca heurística de favorecido + valor (§5).
      if (!p.documentoIds.includes(d.id)) continue;
      const disponivel = restante.get(p.id) ?? 0;
      if (disponivel <= 0) continue;
      const abatido = Math.min(valor, disponivel);
      valor -= abatido;
      restante.set(p.id, disponivel - abatido);
    }
    notaForaDoCpfCentavos += valor;
  }

  return {
    totalCentavos:
      pagosSemNotaCentavos + notaForaDoCpfCentavos + pagosSemComprovanteCentavos,
    pagosSemNotaCentavos,
    notaForaDoCpfCentavos,
    pagosSemComprovanteCentavos,
  };
}

/**
 * **R2 — a exposição da aferição do INSS, EM BASE.**
 *
 * A regra do `contador` no Gate 2 do CONTAI-005 tinha DUAS condições:
 * o booleano de 11% não ser `true`, **OU** `(obra tem CNO e
 * notaTrazCno === false)`.
 *
 * ⚠️ **A PRIMEIRA MORREU NO CONTAI-038, e a remoção é o item mais caro do
 * ticket.** O §2 do parecer de 2026-09-18 é literal, e classifica esta leitura
 * como *"o achado mais grave deste parecer"*:
 *
 * > A base de aferição **não é reduzida pelo valor da nota, nem pelo valor
 * > retido, nem pelo percentual de retenção.** É reduzida **apenas** pela
 * > remuneração de mão de obra que a empresa prestadora **declara e vincula ao
 * > CNO da obra** (eSocial + EFD-Reinf/DCTFWeb).
 *
 * Ou seja: "esta nota não tem 11%" nunca foi "não abate" — era uma conta que a
 * aferição do SERO não faz. Mantê-la depois de trocar o campo seria o
 * pre-mortem 1 do CONTAI-038 acontecendo por dentro: a leitura sobrevive, só
 * que agora sobre as linhas novas, e o erro fiscal volta com outro nome.
 *
 * **Efeito visível, e ele é intencional**: este número CAI. Quase toda NF de
 * serviço entrava por aqui; agora só entra a que não traz o CNO impresso.
 *
 * ⚠️ **O que sobrou ainda é um PROXY, e isso está declarado** (dívida D57): o
 * fato que de fato abate é a resposta a *"esta mão de obra foi declarada no meu
 * CNO?"*, que **não existe no produto** (Gate Fiscal do CONTAI-038, P2) e está
 * explicitamente fora do escopo. `notaTrazCno` é o mais perto que o app chega
 * hoje.
 *
 * ⚠️ **União de ids, nunca a soma de `pendencias` filtradas** — a razão
 * original continua de pé mesmo com uma condição só: este cálculo sai dos
 * DOCUMENTOS, e é isso que impede contar o mesmo documento duas vezes no dia
 * em que uma segunda família voltar a existir.
 *
 * ⚠️ **Sem CNO na obra, a condição não existe** — e o silêncio é o mesmo do
 * CONTAI-007: não se cobra do prestador um CNO que ainda não foi registrado. A
 * pendência que destrava é a da obra, não a da nota.
 */
export function exposicaoInssBaseCentavos(entrada: {
  documentos: Documento[];
  obraTemCno: boolean;
}): number {
  const { documentos, obraTemCno } = entrada;
  const contados = new Set<string>();
  let base = 0;
  for (const d of documentos) {
    if (d.tipo !== "nf_servico" || d.status === "quarentena") continue;
    const naoAbate = obraTemCno && d.notaTrazCno === false;
    if (!naoAbate || contados.has(d.id)) continue;
    contados.add(d.id);
    base += d.valorCentavos ?? 0;
  }
  return base;
}
