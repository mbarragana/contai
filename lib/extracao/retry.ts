/**
 * Laço de retry + timeout compartilhado pelos provedores de extração
 * (CONTAI-052, decisão técnica 6). Veio de `gemini.ts` (commit `4f8a1c6`) sem
 * mudança de política: a Groq usa a MESMA cadeia, não uma versão simplificada
 * — um provedor com retry e outro sem é a diferença que aparece só em
 * produção, no pior dia.
 *
 * Novo em relação ao original: `AbortSignal.timeout()` por tentativa. Fecha a
 * **dívida D70** — sem timeout, resposta pendurada não aciona o retry (que só
 * cobre quem *responde* com erro) e a tela do Mateus fica girando até a função
 * serverless ser cortada.
 */

import { ExtracaoIndisponivelError } from "@/lib/extracao/erros";

/**
 * Retry para o que pode mudar de resultado na próxima tentativa:
 * - qualquer 5xx — 503 UNAVAILABLE ("model is currently experiencing high
 *   demand") é o que já mordeu em produção, mas 500/502/504 são da mesma
 *   família: falha do lado deles, não do nosso pedido
 * - 429 RESOURCE_EXHAUSTED — rate limit (a conta Gemini é tier gratuito, 5
 *   req/min; a Groq tem cota própria, mas o limite existe do mesmo jeito)
 *
 * O 4xx restante é erro de configuração/request (foi o caso do
 * `thinkingLevel: "minimal"` em 2026-09-24): repetir devolve o mesmo 400 e só
 * queima tempo do Mateus na tela. A fronteira é exatamente essa — 429 e 5xx
 * repetem, o resto do 4xx falha na hora.
 *
 * Erro de rede (fetch rejeitando: timeout, DNS, socket) também repete: é o
 * transitório mais comum de todos, e nesse caso não há resposta para ler
 * `Retry-After`, então vale só o backoff fixo.
 */
function repetivel(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * 3 tentativas no total (a original + 2), esperando 1s e depois 3s. O teto de
 * ~4s de espera extra é deliberado: o 503 de 2026-09-24 ainda estava lá 20
 * minutos depois, então "esperar a indisponibilidade passar" não é objetivo
 * alcançável — o alvo é só o blip de segundos. Espera maior travaria a tela
 * de captura sem aumentar a chance de sucesso.
 */
export const TENTATIVAS_MAXIMAS = 3;
const ESPERAS_MS = [1_000, 3_000];
/** `Retry-After` acima disto é ignorado: vira espera longa, não blip. */
const RETRY_AFTER_MAXIMO_MS = 5_000;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `Retry-After` em segundos; `null` se ausente, inválido ou não-numérico. */
function retryAfterMs(resposta: Response): number | null {
  const bruto = resposta.headers.get("retry-after");
  if (!bruto) return null;
  const segundos = Number(bruto.trim());
  if (!Number.isFinite(segundos) || segundos <= 0) return null;
  return segundos * 1_000;
}

/** Sem `resposta` (falha de rede) só existe o backoff fixo. */
function esperaAposFalha(tentativa: number, resposta?: Response): number {
  const padrao = ESPERAS_MS[tentativa - 1] ?? ESPERAS_MS[ESPERAS_MS.length - 1];
  const sugerido = resposta ? retryAfterMs(resposta) : null;
  return sugerido !== null && sugerido <= RETRY_AFTER_MAXIMO_MS
    ? sugerido
    : padrao;
}

export type PedidoComRetry = {
  /** Nome do provedor como aparece na mensagem de erro: "Gemini", "Groq". */
  nome: string;
  url: string;
  /** Sem `signal`: o timeout de cada tentativa é injetado aqui. */
  init: Omit<RequestInit, "signal">;
  /**
   * Teto por tentativa. Gemini 20s (manda o PDF inteiro em base64 e roda
   * visão), Groq 10s (recebe texto e é rápida por construção). Pior caso das
   * duas cadeias somadas (~98s) passa do `maxDuration=60` da rota e isso é
   * aceito no ticket: exige os dois provedores fora do ar ao mesmo tempo, e a
   * UI já trata falha de rota como "preencha à mão".
   */
  timeoutMs: number;
};

/**
 * ⚠️ **Observação registrada no Gate 2 do CONTAI-052, não corrigida aqui de
 * propósito.** O `AbortSignal.timeout()` cobre a chamada até os headers
 * chegarem; a leitura do corpo (`resposta.json()`, que roda no provedor, depois
 * deste módulo devolver) fica **fora** do teto. Um body pendurado no meio da
 * leitura sairia como erro cru do fetch, não como o 502 tratado da rota.
 *
 * Por que fica assim: o `maxDuration = 60` da rota é o backstop, e a D70 —
 * "resposta pendurada não aciona o retry" — está fechada na prática, porque o
 * caso que morde é o servidor que nunca responde, não o que responde headers e
 * depois trava no corpo. Passar o signal adiante para cobrir o `json()` exigiria
 * mudar a fronteira deste módulo (devolver o signal junto com a resposta) por um
 * cenário que ninguém viu em produção. Vira ticket se aparecer no log.
 */

/**
 * Faz o POST com retry. Devolve a resposta 2xx e em quantas tentativas ela
 * saiu; lança `ExtracaoIndisponivelError` quando esgota.
 *
 * Interpretar o corpo é responsabilidade do provedor: resposta cortada, JSON
 * inválido ou schema divergente NÃO são repetíveis e não voltam para cá.
 */
export async function postComRetry({
  nome,
  url,
  init,
  timeoutMs,
}: PedidoComRetry): Promise<{ resposta: Response; tentativas: number }> {
  const tag = nome.toLowerCase();
  let ultimaFalha = "";
  let tentativasFeitas = 0;

  // Log da Vercel é a única telemetria de produção: sem isto, um retry
  // bem-sucedido some e "o provedor está instável" fica sem evidência.
  const avisarRepeticao = (tentativa: number, motivo: string, espera: number) =>
    console.warn(
      `[${tag}] tentativa ${tentativa}/${TENTATIVAS_MAXIMAS} falhou ` +
        `(${motivo}); repetindo em ${espera}ms.`,
    );

  for (let tentativa = 1; tentativa <= TENTATIVAS_MAXIMAS; tentativa++) {
    tentativasFeitas = tentativa;
    const ultima = tentativa === TENTATIVAS_MAXIMAS;

    let resposta: Response;
    try {
      resposta = await fetch(url, {
        ...init,
        // Um signal NOVO por tentativa: reaproveitar o mesmo abortaria a
        // segunda chamada no instante em que ela nasce.
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (erro) {
      // `TimeoutError` do AbortSignal chega aqui como qualquer falha de rede —
      // e é tratado como transitório de propósito: é exatamente o caso que a
      // D70 deixava passar sem retry nenhum.
      const motivo = erro instanceof Error ? erro.message : String(erro);
      ultimaFalha = `${nome} indisponível: ${motivo}`;
      if (ultima) break;
      const espera = esperaAposFalha(tentativa);
      avisarRepeticao(tentativa, motivo, espera);
      await esperar(espera);
      continue;
    }

    if (resposta.ok) return { resposta, tentativas: tentativa };

    ultimaFalha = `${nome} devolveu ${resposta.status}: ${await resposta.text()}`;
    if (!repetivel(resposta.status) || ultima) break;

    const espera = esperaAposFalha(tentativa, resposta);
    avisarRepeticao(tentativa, String(resposta.status), espera);
    await esperar(espera);
  }

  throw new ExtracaoIndisponivelError(
    tentativasFeitas > 1
      ? `${nome} indisponível após ${tentativasFeitas} tentativas: ${ultimaFalha}`
      : ultimaFalha,
    tentativasFeitas,
  );
}
