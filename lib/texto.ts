/**
 * Texto para COMPARAÇÃO — nunca para exibição, nunca para gravação.
 *
 * Existe porque a mesma normalização já era usada em dois lugares (o filtro de
 * `/despesas` e a busca de candidatos do CONTAI-078) e duas cópias divergem com
 * o tempo: uma passa a ignorar diacrítico e a outra não, e o Mateus digita
 * "jose" e acha o José em uma tela e não na outra. Critério 12 do CONTAI-078.
 */

/**
 * Minúsculas em pt-BR, sem diacrítico, sem espaço nas pontas — a forma em que
 * dois textos se COMPARAM.
 *
 * ⚠️ O resultado nunca vai para a tela nem para o banco: "josé" normalizado é
 * "jose", e gravar isso apagaria o nome que o favorecido tem de verdade. É
 * índice de busca, não dado.
 */
export function normalizar(texto: string): string {
  return texto
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
