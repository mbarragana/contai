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
 * **As exceções nomeadas — união FECHADA, e hoje ela tem uma entrada.**
 *
 * Exceção é o caso em que a régua diria vermelho e a cor adjudicada é âmbar,
 * por decisão escrita do `contador`. Nunca o contrário: a exceção só **abranda**
 * o que a régua acendeu, e por isso não tem como fabricar vermelho nenhum.
 *
 * ⚠️ É união de TypeScript, **não string de rótulo de tela**: renomear o chip
 * "Pago sem comprovante" não tira a exceção da malha do teste-trava (D54).
 *
 * - `pj_pago_sem_comprovante` — `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`
 *   §601-602: para PJ a NF já sustenta o *quê*, o *quanto* e o *para quem*; o
 *   comprovante corrobora um desembolso pouco duvidoso, não o constitui. Para
 *   PF não vale, e lá a cor é vermelha — o comprovante é constitutivo.
 *
 * A segunda entrada já tem dono: `retencao_sem_recolhedor`, do `CONTAI-038`
 * (`docs/backlog/31-2026-09-19-sequenciamento-contai-035-038.md`). Ela nasce
 * aqui, e não como cor solta que precisaria de retrofit depois.
 */
export type ExcecaoNomeada = "pj_pago_sem_comprovante";

/** O único ponto do sistema que produz um `Gravidade`. */
function marcar(cor: "red" | "amb"): Gravidade {
  return cor as Gravidade;
}

/**
 * A régua, em função pura: **saiu? → tem apoio hábil no ano certo? → não =
 * vermelho**.
 *
 * @param excecao exceção nomeada que abranda o vermelho para âmbar. Em caso
 * que a régua já pinta de âmbar ela é inócua por construção — nunca acende.
 */
export function gravidadeDaRegua(
  fatos: FatosDaRegua,
  excecao?: ExcecaoNomeada,
): Gravidade {
  const vermelho = fatos.dinheiroSaiu && !fatos.apoioHabilNoAnoCerto;
  if (!vermelho) return marcar("amb");
  return excecao === undefined ? marcar("red") : marcar("amb");
}

/** A borda do `Card` que corresponde à cor — para a tela não remontar o mapa. */
export function bordaDaGravidade(g: Gravidade): "border-red" | "border-amb" {
  return g === "red" ? "border-red" : "border-amb";
}

/**
 * O `role` do `Banner` que corresponde à cor. Vermelho interrompe o leitor de
 * tela (`alert`), âmbar não (`status`) — a distinção já era a convenção do app
 * e passa a acompanhar a cor quando ela é calculada, e não escrita.
 */
export function papelDaGravidade(g: Gravidade): "alert" | "status" {
  return g === "red" ? "alert" : "status";
}
