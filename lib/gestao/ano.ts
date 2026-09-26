/**
 * **CONTAI-060 — o rótulo do ano em exibição, em um lugar só.**
 *
 * Regra geral de texto do spec (`design/mocks/CONTAI-060.md`, item 2): onde a
 * tela hoje diz *"em {ano}"*, com o ano em `null` o trecho vira **"em todos os
 * anos"**, por extenso, sempre — nunca um `null` vazado para a frase, nunca um
 * "—" e nunca a omissão do escopo. Quatro superfícies dizem essa frase (o KPI da
 * Visão geral, a contagem de `/despesas`, o escopo de `/pendencias` e o estado
 * vazio compartilhado); quatro cópias divergiriam, e "apuradas em null" é o
 * defeito que este módulo de uma linha existe para impedir.
 *
 * Copy de produto, não consequência fiscal: o que tem consequência fiscal é o
 * CORTE por ano (`filtrarPorAno`, `calcularResumo`), e ele mora em
 * `lib/fiscal/`.
 */

/** `2026` → `"2026"`; `null` (todos os anos) → `"todos os anos"`. */
export function rotuloDoAno(ano: number | null): string {
  return ano === null ? "todos os anos" : String(ano);
}
