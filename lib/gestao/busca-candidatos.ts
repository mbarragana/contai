/**
 * **CONTAI-078 — a busca textual sobre a lista de candidatos de vínculo.**
 *
 * Módulo puro: nada de rede, nada de UI, nenhum texto fiscal. O filtro é 100%
 * client-side por decisão de escopo — os candidatos já estão todos em memória
 * (`PainelDados`), e o relato que originou o ticket é sobre ACHAR um item numa
 * lista longa, não sobre carregar menos dados.
 *
 * ⚠️ **Filtro de EXIBIÇÃO, sem consequência fiscal** (Gate Fiscal do ticket):
 * reduz o array antes de renderizar e não toca em vínculo, em valor nem em
 * ordenação. A ordem dentro do subconjunto continua sendo a que
 * `pagamentosCandidatos`/`documentosCandidatos` produziram — `filter` preserva
 * a ordem de entrada, e é de propósito que não exista ordenação por
 * relevância aqui: "sugestão é ordenação", e uma segunda ordenação, invisível,
 * disputando com a primeira só tornaria a lista imprevisível.
 */

import { normalizar } from "@/lib/texto";

/**
 * O mínimo que um item precisa expor para ser buscável — e é o que decide o
 * índice de cada tela, sem `if` de rota:
 *
 * - `Pagamento` (candidato em `/documento/[id]/ligar`) tem favorecido e valor;
 * - `Documento` (candidato em `/pagamento/[id]/ligar`) tem os dois **e**
 *   `numero`, então o número da nota entra no índice só lá — exatamente a
 *   diferença que os dois `placeholder` anunciam.
 */
export interface ItemBuscavel {
  favorecidoNome?: string | null;
  valorCentavos?: number | null;
  numero?: string | null;
}

/**
 * Os DÍGITOS de um texto qualquer. É o que faz "16240", "16.240,00" e
 * "R$ 16.240,00" serem o mesmo termo de busca: o Mateus digita o valor como ele
 * aparece na tela, ou como ele lembra, e as duas formas têm de achar a linha.
 */
function digitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

/**
 * O valor como sequência de dígitos, na MESMA forma em que a tela o imprime.
 *
 * `padStart(3, "0")` existe porque a formatação BRL sempre tem duas casas de
 * centavos: R$ 0,50 são 50 centavos, e os dígitos que o Mateus vê são "050".
 * Sem o padding, buscar "0,50" (→ "050") não acharia um item de 50 centavos.
 */
function digitosDoValor(centavos: number): string {
  return String(Math.abs(Math.trunc(centavos))).padStart(3, "0");
}

function casa(item: ItemBuscavel, texto: string, numeros: string): boolean {
  // Favorecido: substring, sem diacrítico e sem caixa ("jose pecanha" acha
  // "José Peçanha"). Ausência de favorecido não casa com nada — o texto de
  // tela "Favorecido não informado" é rótulo da tela, não dado do registro, e
  // buscar por ele acharia itens que não têm o nome buscado.
  if (normalizar(item.favorecidoNome ?? "").includes(texto)) return true;

  // Número da nota, literal (só documento tem): "1042" acha a NF nº 1042, e
  // "104" também — é substring, como o resto.
  if (item.numero && normalizar(item.numero).includes(texto)) return true;

  if (numeros === "") return false;

  if (
    item.valorCentavos != null &&
    digitosDoValor(item.valorCentavos).includes(numeros)
  ) {
    return true;
  }
  // O número da nota também por dígitos, para "nº 1.042" e "1042" casarem.
  return item.numero ? digitos(item.numero).includes(numeros) : false;
}

/**
 * Os candidatos que casam com `termo`, na ordem em que entraram.
 *
 * Termo vazio (ou só espaço) não filtra nada — a lista inteira volta, que é o
 * estado inicial e o estado depois de "Limpar busca".
 *
 * Genérica no candidato inteiro, e não só no item, porque quem chama precisa
 * dos campos que o CONTAI-074 pendurou nele (`sugestao`, `jaLigadoA`,
 * `cobertoPorInteiro`) — a função devolve os MESMOS objetos, nunca uma
 * projeção.
 */
export function filtrarCandidatos<C extends { item: ItemBuscavel }>(
  candidatos: readonly C[],
  termo: string,
): C[] {
  const texto = normalizar(termo);
  if (texto === "") return [...candidatos];
  const numeros = digitos(termo);
  return candidatos.filter((c) => casa(c.item, texto, numeros));
}
