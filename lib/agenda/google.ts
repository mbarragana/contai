/**
 * **CONTAI-092 — HTTP cru contra o Google (OAuth2 + Calendar v3).**
 *
 * ⚠️ **Sem o SDK `googleapis`, e a escolha é do `cto-obra`** (Viabilidade do
 * ticket): o pacote passa de 10 MB, o app não tem dependência Google nenhuma
 * hoje, e o que precisamos são quatro chamadas HTTP. O preço de carregar um SDK
 * inteiro para isso é bundle de função serverless e uma superfície de
 * atualização a mais — num recurso que o próprio ticket classifica como
 * conveniência fora das três metas do produto.
 *
 * ⚠️ **Testado com `vi.stubGlobal("fetch")`** — mesmo padrão de
 * `lib/extracao/gemini.test.ts`. A API real do Google não entra em teste
 * nenhum: ela exige credencial OAuth de verdade, que não existe no CI nem no
 * stack local (critério 18 — a porta 3100 do Playwright nem se registra como
 * URI de redirecionamento). O que este módulo promete é provado contra `fetch`
 * stubado; o que só a credencial real prova está listado como pendência no
 * fechamento do Gate 1.
 *
 * ⚠️ **A POLÍTICA DE RETRY É CÓPIA, não reuso** — dívida D-f do ticket, resolvida
 * do jeito que ele autorizava ("o Gate 1 copia a política ou extrai um módulo
 * neutro — extrair é opcional"). `lib/extracao/retry.ts` lança
 * `ExtracaoIndisponivelError` e fala de "provedor de extração": importá-lo aqui
 * faria uma falha de calendário chegar à tela de captura de documento com o
 * nome errado. A política (429/5xx/rede, 3 tentativas) é a mesma de propósito —
 * dois tetos diferentes para o mesmo tipo de blip é a divergência que só aparece
 * em produção, no pior dia.
 */

import {
  AgendaIndisponivelError,
  AgendaRecusouError,
  AutorizacaoRevogadaError,
} from "@/lib/agenda/erros";
import type { ConfigGoogle } from "@/lib/agenda/config";
import type { EventoDesejado } from "@/lib/agenda/evento";

const URL_TOKEN = "https://oauth2.googleapis.com/token";
const URL_CALENDARIO = "https://www.googleapis.com/calendar/v3/calendars/primary";

/**
 * 3 no total: a original + 2 repetições (critério 10 — "tenta de novo até 2
 * vezes dentro da mesma chamada"). Esperas curtas: o alvo é o blip de segundos,
 * não "esperar a indisponibilidade passar" — a reconciliação sob demanda
 * (critério 11) é quem cobre indisponibilidade longa.
 */
export const TENTATIVAS_MAXIMAS = 3;
const ESPERAS_MS = [500, 1_500];
/** Teto por tentativa. Chamada de calendário é pequena e rápida por natureza. */
const TIMEOUT_MS = 10_000;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 429 e 5xx mudam de resultado na próxima tentativa; o resto do 4xx não. */
function repetivel(status: number): boolean {
  return status === 429 || status >= 500;
}

interface Pedido {
  /** Como a falha é nomeada no log e em `ultimo_erro`. */
  rotulo: string;
  url: string;
  init: Omit<RequestInit, "signal">;
  /**
   * Status fora do 2xx que o CHAMADOR sabe interpretar e que por isso não são
   * erro aqui: 409 em `insert` ("já existe" → vira `patch`) e 404/410 em
   * `delete` ("já removido" → já feito, critério 4).
   */
  aceitos?: readonly number[];
}

/**
 * Uma chamada com retry e classificação de falha. Devolve a `Response` quando
 * ela é 2xx ou está em `aceitos`; lança uma das três famílias de
 * `lib/agenda/erros.ts` no resto.
 *
 * ⚠️ **401 nunca repete** e sobe como `AutorizacaoRevogadaError`: é a credencial
 * morta, e insistir com ela é o pre-mortem 1 (falha silenciosa) com cota
 * queimada de brinde.
 */
async function chamar({ rotulo, url, init, aceitos = [] }: Pedido): Promise<Response> {
  let ultimaFalha = "";
  let feitas = 0;

  for (let tentativa = 1; tentativa <= TENTATIVAS_MAXIMAS; tentativa++) {
    feitas = tentativa;
    const ultima = tentativa === TENTATIVAS_MAXIMAS;

    let resposta: Response;
    try {
      resposta = await fetch(url, {
        ...init,
        // Signal NOVO por tentativa: reaproveitar abortaria a segunda chamada
        // no instante em que ela nasce.
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      ultimaFalha = `${rotulo}: ${motivo}`;
      if (ultima) break;
      // Log é a única telemetria de produção (Vercel): sem ele, um retry
      // bem-sucedido some e "o Google está instável" fica sem evidência.
      console.warn(
        `[agenda] ${rotulo} tentativa ${tentativa}/${TENTATIVAS_MAXIMAS} falhou ` +
          `(${motivo}); repetindo.`,
      );
      await esperar(ESPERAS_MS[tentativa - 1] ?? 1_500);
      continue;
    }

    if (resposta.ok || aceitos.includes(resposta.status)) return resposta;

    const corpo = await resposta.text();

    if (resposta.status === 401) {
      throw new AutorizacaoRevogadaError(`${rotulo} devolveu 401: ${corpo}`);
    }

    ultimaFalha = `${rotulo} devolveu ${resposta.status}: ${corpo}`;
    if (!repetivel(resposta.status)) {
      // 4xx de configuração: sem retry automático (critério 10).
      throw new AgendaRecusouError(ultimaFalha, resposta.status);
    }
    if (ultima) break;
    console.warn(
      `[agenda] ${rotulo} tentativa ${tentativa}/${TENTATIVAS_MAXIMAS} devolveu ` +
        `${resposta.status}; repetindo.`,
    );
    await esperar(ESPERAS_MS[tentativa - 1] ?? 1_500);
  }

  throw new AgendaIndisponivelError(
    feitas > 1 ? `${ultimaFalha} (após ${feitas} tentativas)` : ultimaFalha,
    feitas,
  );
}

// ── OAuth ───────────────────────────────────────────────────────────────

export interface AutorizacaoConcedida {
  refreshToken: string;
  accessToken: string;
  /** O escopo que o Google CONFIRMOU, não o que o app pediu. */
  escopo: string;
}

/**
 * Troca o `code` do consentimento por tokens (critério 17). Roda **no servidor**
 * e só lá: usa o `client_secret`.
 *
 * ⚠️ **Sem `refresh_token` na resposta é falha, não sucesso parcial.** O Google
 * só o devolve com `access_type=offline` e quando há consentimento novo — e sem
 * ele a integração morreria na primeira expiração do access token, dando ao
 * Mateus a impressão de que conectou. `prompt=consent` em
 * `lib/agenda/oauth.ts` existe exatamente para forçar isso em toda reautorização.
 */
export async function trocarCodigoPorToken(
  config: ConfigGoogle,
  code: string,
): Promise<AutorizacaoConcedida> {
  const resposta = await chamar({
    rotulo: "troca do código OAuth",
    url: URL_TOKEN,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    },
  });

  const corpo = (await resposta.json()) as {
    refresh_token?: string;
    access_token?: string;
    scope?: string;
  };
  if (!corpo.refresh_token || !corpo.access_token) {
    throw new AgendaRecusouError(
      "O Google não devolveu refresh token na troca do código. " +
        "Sem ele a autorização não sobrevive à expiração do access token.",
      400,
    );
  }
  return {
    refreshToken: corpo.refresh_token,
    accessToken: corpo.access_token,
    escopo: corpo.scope ?? "",
  };
}

/**
 * Access token novo a partir do refresh token. Chamado uma vez por chamada de
 * sincronização (o access token **não é persistido** — ver o cabeçalho da
 * migration 0029).
 *
 * ⚠️ **`invalid_grant` é a revogação** (critério 6): o Google responde 400, não
 * 401, quando o refresh token foi revogado no painel da conta ou expirou por
 * inatividade. Tratar esse 400 como "4xx de configuração" faria o app tentar de
 * novo em cada reconciliação, para sempre, sem nunca contar ao Mateus que os
 * lembretes pararam — o pre-mortem 1 do ticket.
 */
export async function renovarAccessToken(
  config: ConfigGoogle,
  refreshToken: string,
): Promise<string> {
  const resposta = await chamar({
    rotulo: "renovação do access token",
    url: URL_TOKEN,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    },
    // 400 é aceito aqui para poder LER o corpo e distinguir `invalid_grant`
    // (credencial morta) de um 400 de configuração.
    aceitos: [400],
  });

  const corpo = (await resposta.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (resposta.status === 400) {
    const erro = corpo.error ?? "erro desconhecido";
    if (erro === "invalid_grant") {
      throw new AutorizacaoRevogadaError(
        corpo.error_description ?? "invalid_grant",
      );
    }
    throw new AgendaRecusouError(
      `renovação do access token devolveu 400: ${erro}`,
      400,
    );
  }

  if (!corpo.access_token) {
    throw new AgendaRecusouError(
      "O Google não devolveu access token na renovação.",
      400,
    );
  }
  return corpo.access_token;
}

/**
 * A conta Google autorizada, para o card de `/conta` mostrar **qual** conta
 * recebe os lembretes (spec de design, estados 3 e 4).
 *
 * ⚠️ **Melhor esforço, e `null` é resposta legítima.** O escopo concedido é só
 * `calendar.events` (critério 17): ele **não** dá acesso ao perfil, e pedir
 * `openid`/`email` só para rotular um card ampliaria a autorização além do que o
 * recurso precisa. O que dá para ler com o escopo que temos é o `summary` do
 * calendário primário, que na conta Google é o próprio endereço de e-mail.
 *
 * ⚠️ **Nunca lança**: falhar aqui não pode impedir a autorização de ser gravada.
 * Uma integração que funciona com o card dizendo "conta não identificada" é
 * melhor do que nenhuma integração.
 *
 * ⚠️ **PENDENTE DE VALIDAÇÃO COM OAUTH REAL**: que `events.list` responda com
 * `summary` sob o escopo `calendar.events` não é verificável sem credencial de
 * verdade. Se não responder, o efeito é só `null` — o caminho degradado já está
 * coberto e testado.
 */
export async function descobrirEmailDaConta(
  accessToken: string,
): Promise<string | null> {
  try {
    const resposta = await fetch(
      `${URL_CALENDARIO}/events?maxResults=1&fields=summary`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!resposta.ok) return null;
    const corpo = (await resposta.json()) as { summary?: string };
    const summary = corpo.summary?.trim();
    return summary && summary.length > 0 ? summary : null;
  } catch {
    return null;
  }
}

// ── Calendar v3 ─────────────────────────────────────────────────────────

/**
 * O corpo do evento. ⚠️ **Só os campos do Gate Fiscal 8**: `summary`,
 * `description`, `start`, `end` e `reminders`. Nada de `attendees`, nada de
 * `extendedProperties` com id de nota, nada de `location` — e, acima de tudo,
 * nenhum CPF em campo nenhum. Quem monta `summary`/`description` é
 * `lib/agenda/evento.ts`, que nem recebe o dado proibido.
 */
function corpoDoEvento(evento: EventoDesejado) {
  return {
    summary: evento.titulo,
    description: evento.descricao,
    start: { dateTime: evento.inicio, timeZone: evento.fuso },
    end: { dateTime: evento.fim, timeZone: evento.fuso },
    reminders: { useDefault: false, overrides: evento.lembretes },
  };
}

/** Como a escrita terminou — só para log e teste; a tela não mostra isso. */
export type ResultadoEscrita = "criado" | "atualizado";

/**
 * Cria **ou** atualiza o evento, com o id derivado do compromisso (critério 3).
 *
 * ⚠️ **O 409 é o mecanismo, não um caso de borda.** O app não pergunta ao Google
 * se o evento existe: ele tenta criar com o id determinístico, e se o Google
 * disser "esse id já existe" (409), a mesma chamada vira `patch`. É isso que
 * torna "nunca um segundo evento" estrutural — nenhuma leitura prévia pode ficar
 * velha entre a consulta e a escrita.
 *
 * ⚠️ **`status: "confirmed"` no `patch`** cobre o caminho que o `insert` não
 * cobre: um evento REMOVIDO pelo app (quitação, cancelamento, data que virou
 * nula) deixa o id reservado no Google, e um `insert` posterior continua
 * devolvendo 409. Sem reconfirmar o status, "Mudou a data" de um saldo que
 * estava sem data reviveria o compromisso no app e não o lembrete no
 * calendário — lembrete perdido em silêncio, que é a dor que o ticket existe
 * para resolver.
 */
export async function gravarEvento(
  accessToken: string,
  evento: EventoDesejado,
): Promise<ResultadoEscrita> {
  const cabecalhos = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const criacao = await chamar({
    rotulo: "criação do evento",
    url: `${URL_CALENDARIO}/events`,
    init: {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify({ id: evento.eventId, ...corpoDoEvento(evento) }),
    },
    aceitos: [409],
  });
  if (criacao.status !== 409) return "criado";

  // O corpo do 409 não é lido: a informação que ele carrega ("já existe") é o
  // próprio status, e deixá-lo sem consumir seria vazamento de socket.
  await criacao.text();

  await chamar({
    rotulo: "atualização do evento",
    url: `${URL_CALENDARIO}/events/${encodeURIComponent(evento.eventId)}`,
    init: {
      method: "PATCH",
      headers: cabecalhos,
      body: JSON.stringify({ status: "confirmed", ...corpoDoEvento(evento) }),
    },
  });
  return "atualizado";
}

/**
 * Remove o evento (critério 4) — **`events.delete`, nunca "marcar"**: evento
 * marcado continua aparecendo na agenda do Mateus, e o histórico do compromisso
 * já mora no app.
 *
 * ⚠️ **404 e 410 são "já feito", não erro** (critério 4): a segunda tentativa de
 * remoção — reconciliação reprocessando, duas abas, retry depois de uma falha
 * parcial — tem de terminar em sucesso. Tratar isso como falha acenderia a linha
 * âmbar de "não sincronizado" num compromisso cujo lembrete já não existe.
 */
export async function removerEvento(
  accessToken: string,
  eventId: string,
): Promise<void> {
  const resposta = await chamar({
    rotulo: "remoção do evento",
    url: `${URL_CALENDARIO}/events/${encodeURIComponent(eventId)}`,
    init: {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    aceitos: [404, 410],
  });
  await resposta.text().catch(() => "");
}
