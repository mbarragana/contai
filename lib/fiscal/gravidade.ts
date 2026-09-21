/**
 * **A régua de cor — D39 revisada (CONTAI-035).**
 *
 * A régua existe desde 21/08 e nunca tinha sido reconciliada com os call sites
 * reais: em 23/08 o `po` achou **seis pendências com o dinheiro fora do bolso
 * pintadas de âmbar**, e o caso mais gritante era o comentário da home
 * confessando a razão do vermelho — *"o extrato existe, o dinheiro saiu, e o
 * custo daquele ano não existe no sistema"* — com `border-amb` na linha
 * seguinte. Alguém escreveu o argumento contra a própria cor e não percebeu
 * (`docs/backlog/25-2026-08-23-a-regua-de-cor-e-o-que-ela-escondia.md`).
 *
 * A redação vigente, do `po`, e continua **binária**:
 *
 * > **saiu? → tem apoio hábil no ano certo? → não = vermelho**
 * >
 * > vermelho = fato consumado + consequência fiscal aberta **e nada no acervo
 * > sustenta o valor no lugar certo**; âmbar = nada saiu ainda, **ou** o valor
 * > já está sustentado e falta só corroboração.
 *
 * ## Por que o tipo é BRANDED, e não `"red" | "amb"`
 *
 * A D39 mandava *"toda pendência nova declarar qual das duas metades a
 * colore"* — **norma sem verificador**, que é a D44 outra vez. O verificador é
 * este tipo: `Gravidade` **só nasce aqui**, de `gravidadeDaRegua`, a partir dos
 * dois fatos. Uma pendência nova não compila com cor literal chutada — para
 * ter cor ela precisa dizer se o dinheiro saiu e se há apoio hábil no ano
 * certo.
 *
 * ⚠️ **Limite honesto, registrado como dívida no ticket**: `<Chip cor="amb">`
 * literal em JSX NOVO continua compilando, porque a prop do componente aceita
 * a união crua. O compilador tranca os PRODUTORES (`Pendencia.gravidade`, os
 * rótulos de pagamento, os sinais de terreno e revisão); o chip solto em tela
 * nova é cobertura de review no Gate 2, não de tipo.
 */

declare const MARCA_DE_GRAVIDADE: unique symbol;

/**
 * A cor de uma pendência. **Não se escreve — se deriva** (ver o cabeçalho).
 *
 * É assinável em `cor=` e em comparação com `"red"`/`"amb"`: a marca só impede
 * o caminho inverso, que é o que interessa.
 */
export type Gravidade = ("red" | "amb") & {
  readonly [MARCA_DE_GRAVIDADE]: "gravidade";
};

/** Os dois eixos da régua, e não há um terceiro. */
export interface FatosDaRegua {
  /**
   * **Fato consumado**: o dinheiro já saiu da conta dele. O que está apenas
   * agendado, o boleto a vencer e a previsão de desembolso respondem `false` —
   * nada saiu ainda, e é essa a metade âmbar da régua.
   */
  dinheiroSaiu: boolean;
  /**
   * O acervo sustenta esse valor **no ano-calendário certo** (regime de caixa,
   * a data do pagamento). `false` quando não há documento hábil, quando o
   * documento não é hábil (quarentena), ou quando o custo daquele ano
   * simplesmente não existe no sistema.
   */
  apoioHabilNoAnoCerto: boolean;
}

/**
 * **As exceções nomeadas — união FECHADA, e hoje ela tem DUAS entradas.**
 *
 * Exceção é o caso em que a cor adjudicada por parecer **diverge** da que a
 * régua produz sozinha. Cada uma declara, no mapa `DIRECAO` logo abaixo, em
 * que sentido ela diverge — e é por isso que a lista continua sendo uma lista
 * de decisões fundamentadas, e não uma segunda régua paralela: cada entrada é
 * uma linha visível em review, com o parecer citado ao lado.
 *
 * ⚠️ É união de TypeScript, **não string de rótulo de tela**: renomear o chip
 * "Pago sem comprovante" não tira a exceção da malha do teste-trava (D54).
 *
 * - `pj_pago_sem_comprovante` (**abranda**) —
 *   `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` §601-602: para
 *   PJ a NF já sustenta o *quê*, o *quanto* e o *para quem*; o comprovante
 *   corrobora um desembolso pouco duvidoso, não o constitui. Para PF não vale,
 *   e lá a cor é vermelha — o comprovante é constitutivo.
 *
 * - `retencao_sem_recolhedor` (**agrava**) — `CONTAI-038`, critério 7a, com
 *   fundamento no ADENDO A.4 de
 *   `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`. Pela
 *   tabela-verdade geral esta pendência cairia em âmbar: o valor retido **não
 *   saiu do bolso do Mateus** e a nota hábil **existe**. O vermelho se funda em
 *   outra coisa — *"retenção que ninguém recolhe não é economia, é passivo não
 *   identificado"* —, e passivo aberto não é o mesmo objeto que os dois eixos
 *   da régua medem. Declarar isso aqui é o que impede a alternativa: uma cor
 *   literal solta em `resumo.ts`, que o teste-trava D54 pegaria como dívida.
 */
export type ExcecaoNomeada =
  | "pj_pago_sem_comprovante"
  | "retencao_sem_recolhedor";

/**
 * **Em que sentido cada exceção diverge da régua — e a direção é obrigatória.**
 *
 * ⚠️ Até o `CONTAI-035` a exceção só sabia ABRANDAR, e o comentário de lá dizia
 * que ela "não tem como fabricar vermelho nenhum". O `CONTAI-038` precisou do
 * sentido oposto, e a saída **não** foi afrouxar a assinatura: foi obrigar cada
 * entrada a declarar a direção neste mapa. `Record<ExcecaoNomeada, ...>` é
 * exaustivo — exceção nova sem direção declarada **não compila**, que é a mesma
 * malha do teste-trava, agora no compilador.
 *
 * O invariante que sobrevive intacto: **nada pinta fora da régua sem um parecer
 * nomeado**. O que mudou é que o parecer pode adjudicar as duas direções, em
 * vez de só uma.
 */
const DIRECAO: Record<ExcecaoNomeada, "abranda" | "agrava"> = {
  pj_pago_sem_comprovante: "abranda",
  retencao_sem_recolhedor: "agrava",
};

/** O único ponto do sistema que produz um `Gravidade`. */
function marcar(cor: "red" | "amb"): Gravidade {
  return cor as Gravidade;
}

/**
 * A régua, em função pura: **saiu? → tem apoio hábil no ano certo? → não =
 * vermelho**.
 *
 * @param excecao exceção nomeada, com a direção declarada em `DIRECAO`.
 * `abranda` só age sobre o que a régua acendeu; `agrava` só age sobre o que ela
 * apagou. Nos dois casos, exceção aplicada ao caso que já está na cor dela é
 * **inócua por construção** — nunca inverte duas vezes.
 */
export function gravidadeDaRegua(
  fatos: FatosDaRegua,
  excecao?: ExcecaoNomeada,
): Gravidade {
  const vermelho = fatos.dinheiroSaiu && !fatos.apoioHabilNoAnoCerto;
  if (excecao === undefined) return marcar(vermelho ? "red" : "amb");
  if (DIRECAO[excecao] === "abranda") return marcar("amb");
  return marcar("red");
}

/** A borda do `Card` que corresponde à cor — para a tela não remontar o mapa. */
export function bordaDaGravidade(g: Gravidade): "border-red" | "border-amb" {
  return bordaDaCor(g);
}

/**
 * O mesmo mapa, para as **cores portadas** do `CONTAI-042`.
 *
 * ⚠️ Não é uma porta dos fundos da marca. Oito famílias de pendência pintavam
 * `border-red`/`cor="amb"` **literal em JSX** e nunca passaram pela régua —
 * `PendenciaCno`, `vinculosCruzandoObras`, `terrenoPagoSemComprovante`,
 * `documentosSemArquivo`, `terrenoSemData`, `terrenoMaisDeUmaData`,
 * `terrenoSemRegistro` e `financiamentoAguardandoInforme`. O Gate Fiscal do
 * `CONTAI-042` (`contador`, 2026-09-21) **proibiu** forçá-las pela régua
 * (*"declarar os dois fatos para elas não é portar cor, é fabricar fato fiscal
 * para a fila ordenar"* — o caso que prova é o CNO, que não toca o IRPF e sairia
 * âmbar pelo branch default) e mandou a cor virar constante nomeada no módulo
 * dono dos textos da família, lida pela tela de hoje **e** pela fila unificada.
 *
 * Este mapa existe para essas constantes não remontarem o `border-` na mão em
 * duas telas. A marca continua fazendo o que ela sempre fez: impedir pendência
 * **nova** de chutar cor — portar pendência existente não é chutar.
 */
export function bordaDaCor(cor: "red" | "amb"): "border-red" | "border-amb" {
  return cor === "red" ? "border-red" : "border-amb";
}

/**
 * O `role` do `Banner` que corresponde à cor. Vermelho interrompe o leitor de
 * tela (`alert`), âmbar não (`status`) — a distinção já era a convenção do app
 * e passa a acompanhar a cor quando ela é calculada, e não escrita.
 */
export function papelDaGravidade(g: Gravidade): "alert" | "status" {
  return g === "red" ? "alert" : "status";
}
