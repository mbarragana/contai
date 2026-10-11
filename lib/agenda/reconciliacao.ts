/**
 * **CONTAI-092, critério 11 — o acelerador da reconciliação automática.**
 *
 * Módulo puro, separado do componente que o usa
 * (`app/_components/reconciliacao-agenda.tsx`), por um motivo prático: o Vitest
 * deste repo só roda `.test.ts` e não tem ambiente de DOM (ver
 * `vitest.config.mts`). Lógica que decide SE uma requisição sai tem de ser
 * testável sem browser — e esta decide, a cada abertura da Home, se o app
 * incomoda o servidor ou não.
 */

/** Onde o aparelho guarda quando foi a última tentativa. */
export const CHAVE_RECONCILIACAO = "contai-agenda-reconciliada-em";

/**
 * 6 horas. Curto o bastante para um lembrete perdido voltar no mesmo dia de uso,
 * longo o bastante para abrir a Home dez vezes numa tarde não virar dez
 * requisições.
 *
 * ⚠️ **"Por aparelho", não por conta** (critério 11): o carimbo vive no
 * `localStorage`, então celular e desktop reconciliam em horários próprios. Com
 * carimbo no banco, abrir o app no celular depois de uma rodada no desktop
 * deixaria o celular sem nunca reconciliar — e é no celular que o Mateus abre o
 * app às pressas.
 */
export const HORAS_ENTRE_TENTATIVAS = 6;
export const INTERVALO_MS = HORAS_ENTRE_TENTATIVAS * 60 * 60 * 1000;

/** Já passou tempo suficiente desde a última tentativa deste aparelho? */
export function deveReconciliar(
  ultimaEm: string | null,
  agoraMs: number,
): boolean {
  if (!ultimaEm) return true;
  const quando = Number(ultimaEm);
  // Valor corrompido (storage de outra versão, edição à mão) conta como
  // "nunca": errar para o lado de sincronizar custa uma requisição, errar para
  // o outro custa um lembrete que nunca sai.
  if (!Number.isFinite(quando)) return true;
  // Carimbo no FUTURO (relógio do aparelho mexido, fuso trocado) também
  // reconcilia: senão o aparelho ficaria mudo até o relógio alcançar o carimbo.
  if (quando > agoraMs) return true;
  return agoraMs - quando >= INTERVALO_MS;
}
