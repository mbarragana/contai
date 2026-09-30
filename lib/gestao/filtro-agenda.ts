/**
 * **CONTAI-082 — o filtro de urgência e a busca por favorecido da Agenda.**
 *
 * Módulo puro: nada de rede, nada de UI, nenhum texto fiscal. Mora em
 * `lib/gestao/` e **não** em `lib/fiscal/compromisso.ts` (critério 13) pela
 * mesma razão de `busca-candidatos.ts`: filtro de EXIBIÇÃO não é regra fiscal,
 * e uma função de recorte de tela dentro da lib fiscal convida a próxima pessoa
 * a filtrar apuração.
 *
 * ⚠️ **Sem consequência fiscal** (Gate Fiscal do ticket): reduz o array de
 * entrada e não toca custo de aquisição, base de aferição, discriminação anual
 * nem acervo. `filter` preserva a ordem de entrada — quem agrupa e ordena
 * continua sendo `montarAgendaDaHome`, que **não muda** (critério 6): vencidos
 * todos no topo, sem teto, e os abertos por `dataPrevista` crescente, agora
 * sobre o conjunto já filtrado.
 *
 * ⚠️ **`filtrarCandidatos` (CONTAI-078) não serve aqui** (critério 14):
 * `ItemBuscavel` pede `valorCentavos`, e `Compromisso` tem
 * `valorPrevistoCentavos` — o campo se chama **valor previsto**, nunca "valor"
 * (Gate Fiscal 6.3 de `compromisso.ts`), e renomeá-lo para caber no tipo
 * apagaria justamente a distinção que o parecer protege. Só `normalizar` é
 * reaproveitada, e é a 3ª cópia da linha de uma linha
 * `normalizar(nome ?? "").includes(termo)` — dívida nomeada no ticket: extrair
 * na 4ª ocorrência, não nesta.
 */

import {
  chipDoAgendado,
  type UrgenciaDoAgendamento,
} from "@/lib/fiscal/compromisso";
import { normalizar } from "@/lib/texto";
import type { Compromisso } from "@/lib/types";

/**
 * O que o dropdown oferece: os quatro valores de `UrgenciaDoAgendamento`
 * (CONTAI-075) mais o `"todos"`, que é o padrão e não filtra nada.
 *
 * ⚠️ É `UrgenciaDoAgendamento`, **nunca `SituacaoCompromisso`** (pre-mortem 2):
 * aberto/quitado/cancelado é outra dimensão, e `/compromisso` continua
 * mostrando só os abertos — quem garante isso é `montarAgendaDaHome`, não este
 * filtro.
 */
export type FiltroUrgencia = "todos" | UrgenciaDoAgendamento;

export interface FiltrosDaAgenda {
  filtroUrgencia: FiltroUrgencia;
  /** Substring do nome do favorecido. `""` = não filtra. */
  buscaFavorecido: string;
}

/**
 * ⚠️ **É o estado de TODA chegada na Agenda** (critério 12): o filtro nunca é
 * persistido — nem localStorage, nem sessionStorage, nem query string. Um
 * filtro esquecido de uma visita anterior esconderia um vencido sem o Mateus
 * ter acabado de escolher isso, e vencido escondido é o único estado que trava
 * relatório anual.
 */
export const FILTROS_DA_AGENDA_PADRAO: FiltrosDaAgenda = {
  filtroUrgencia: "todos",
  buscaFavorecido: "",
};

/**
 * Os compromissos que casam com os filtros, na ordem em que entraram.
 *
 * Os dois critérios compõem por **E lógico** (critério 5): com os dois ativos,
 * só passa o que bate nos dois — e limpar um reaplica o outro sozinho, porque
 * cada um é lido do seu próprio campo.
 *
 * ⚠️ **A urgência vem de `chipDoAgendado(c, hoje).urgencia`, nunca de
 * `chip.texto`** (critério 3): o texto muda por dia e por contagem de dias sem
 * resposta ("Venceu em 22/09 · 8 dias sem resposta"), e comparar rótulo de tela
 * faria o filtro parar de casar de um dia para o outro.
 *
 * ⚠️ **O `hojeIso` é o MESMO da tela** (critério 7): esta função não deriva
 * data nenhuma. Duas leituras de "hoje" na mesma tela fariam o filtro e o
 * agrupamento discordarem sobre o que está vencido.
 */
export function filtrarAgenda(
  cs: readonly Compromisso[],
  filtros: FiltrosDaAgenda,
  hojeIso: string,
): Compromisso[] {
  const busca = normalizar(filtros.buscaFavorecido);
  const { filtroUrgencia } = filtros;
  return cs.filter(
    (c) =>
      (filtroUrgencia === "todos" ||
        chipDoAgendado(c, hojeIso).urgencia === filtroUrgencia) &&
      // Compromisso sem favorecido só aparece com a busca vazia: "Favorecido
      // não informado" é rótulo de tela, não dado do registro.
      (busca === "" || normalizar(c.favorecidoNome ?? "").includes(busca)),
  );
}
