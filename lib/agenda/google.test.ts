import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConfigGoogle } from "@/lib/agenda/config";
import {
  AgendaIndisponivelError,
  AgendaRecusouError,
  AutorizacaoRevogadaError,
} from "@/lib/agenda/erros";
import { eventoDesejado, type CompromissoParaAgenda } from "@/lib/agenda/evento";
import {
  TENTATIVAS_MAXIMAS,
  descobrirEmailDaConta,
  gravarEvento,
  removerEvento,
  renovarAccessToken,
  trocarCodigoPorToken,
} from "@/lib/agenda/google";

/**
 * **CONTAI-092 — o cliente HTTP do Google, com `fetch` stubado.**
 *
 * ⚠️ **A API real do Google não entra em teste nenhum, e isso é decisão do
 * ticket, não limitação escondida** (critérios 5 e 18): ela exige credencial
 * OAuth de verdade, que não existe no CI nem no stack local — a porta 3100 do
 * Playwright nem se registra como URI de redirecionamento. O que se prova aqui é
 * o CONTRATO do nosso lado: quais requisições saem, com que corpo, e o que o app
 * faz com cada resposta.
 *
 * Isto NÃO viola a regra dura de E2E do projeto ("stub de backend é proibido"):
 * aquela regra é sobre o Supabase, que roda local em Docker e por isso pode ser
 * exercitado de verdade. Aqui o backend é de terceiro, e a alternativa a stubar
 * é não testar.
 *
 * Mesmo padrão de `lib/extracao/gemini.test.ts`.
 */

const CONFIG: ConfigGoogle = {
  clientId: "cliente-de-teste",
  clientSecret: "segredo-de-teste",
  redirectUri: "http://localhost:3200/api/google/agenda/callback",
};

const PIX_ABERTO: CompromissoParaAgenda = {
  id: "11111111-2222-3333-4444-555555555555",
  origem: "pix",
  situacao: "aberto",
  dataPrevista: "2026-11-20",
  valorPrevistoCentavos: 320_000,
  favorecidoNome: "Empreiteira XYZ",
};
const EVENTO = eventoDesejado(PIX_ABERTO)!;
const EVENT_ID = "11111111222233334444555555555555";

function resposta(
  status: number,
  corpo: unknown = {},
  texto = JSON.stringify(corpo),
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => corpo,
    text: async () => texto,
  };
}

function ultimaChamada(espiao: ReturnType<typeof vi.fn>, indice = 0) {
  const [url, init] = espiao.mock.calls[indice] as [string, RequestInit];
  return {
    url,
    metodo: init.method,
    corpo: init.body as string,
    headers: init.headers as Record<string, string>,
  };
}

describe("cliente do Google Agenda", () => {
  beforeEach(() => {
    // As esperas do retry são reais (500ms, 1500ms): com temporizadores falsos a
    // suíte não espera, e sem eles cada teste de retry custaria 2 segundos.
    vi.useFakeTimers();
    // O retry loga cada tentativa falha (telemetria da Vercel); no teste é ruído.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * Roda a promessa deixando os temporizadores do retry correrem.
   *
   * ⚠️ O `.catch` vazio da primeira linha não engole nada: ele só marca a
   * promessa como TRATADA antes do `await` dos temporizadores. Sem ele, uma
   * rejeição que acontece durante `runAllTimersAsync` — exatamente o caso dos
   * testes de retry esgotado — sobe como "unhandled rejection" e o Vitest
   * reprova a suíte mesmo com todas as asserções passando.
   */
  async function comRetry<T>(promessa: Promise<T>): Promise<T> {
    promessa.catch(() => {});
    await vi.runAllTimersAsync();
    return promessa;
  }

  // ── Escrita do evento ──────────────────────────────────────────────────

  it("cria o evento com o id DERIVADO do compromisso e os 3 lembretes", async () => {
    const espiao = vi.fn().mockResolvedValue(resposta(200, { id: EVENT_ID }));
    vi.stubGlobal("fetch", espiao);

    expect(await comRetry(gravarEvento("token", EVENTO))).toBe("criado");

    const chamada = ultimaChamada(espiao);
    expect(chamada.url).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    );
    expect(chamada.metodo).toBe("POST");
    const corpo = JSON.parse(chamada.corpo);
    // O id vai NO CORPO da criação: é o que faz o Google recusar a segunda com
    // 409 em vez de criar um evento novo (critério 3).
    expect(corpo.id).toBe(EVENT_ID);
    expect(corpo.reminders).toEqual({
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 7200 },
        { method: "popup", minutes: 2880 },
        { method: "popup", minutes: 0 },
      ],
    });
    expect(corpo.start).toEqual({
      dateTime: "2026-11-20T09:00:00",
      timeZone: "America/Sao_Paulo",
    });
  });

  it("409 na criação vira PATCH do MESMO evento — nunca um segundo (critério 3)", async () => {
    const espiao = vi
      .fn()
      .mockResolvedValueOnce(resposta(409, {}, "The requested identifier already exists"))
      .mockResolvedValueOnce(resposta(200, { id: EVENT_ID }));
    vi.stubGlobal("fetch", espiao);

    expect(await comRetry(gravarEvento("token", EVENTO))).toBe("atualizado");
    expect(espiao).toHaveBeenCalledTimes(2);

    const patch = ultimaChamada(espiao, 1);
    expect(patch.metodo).toBe("PATCH");
    expect(patch.url).toBe(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${EVENT_ID}`,
    );
    // `status: "confirmed"` revive um evento que o app tinha REMOVIDO antes (o
    // id continua reservado no Google). Sem isso, "Mudou a data" de um saldo que
    // estava sem data não devolveria o lembrete — perda silenciosa.
    expect(JSON.parse(patch.corpo).status).toBe("confirmed");
  });

  it("409 NÃO é tratado como falha repetível: não há terceira criação", async () => {
    const espiao = vi
      .fn()
      .mockResolvedValueOnce(resposta(409))
      .mockResolvedValueOnce(resposta(200));
    vi.stubGlobal("fetch", espiao);

    await comRetry(gravarEvento("token", EVENTO));
    expect(espiao.mock.calls.filter(([, i]) => (i as RequestInit).method === "POST"))
      .toHaveLength(1);
  });

  // ── Remoção ────────────────────────────────────────────────────────────

  it("remove o evento por DELETE (critério 4: removido, nunca 'marcado')", async () => {
    const espiao = vi.fn().mockResolvedValue(resposta(204, {}, ""));
    vi.stubGlobal("fetch", espiao);

    await comRetry(removerEvento("token", EVENT_ID));

    const chamada = ultimaChamada(espiao);
    expect(chamada.metodo).toBe("DELETE");
    expect(chamada.url).toContain(`/events/${EVENT_ID}`);
  });

  it.each([404, 410])(
    "%i na remoção é 'já feito', não erro (critério 4)",
    async (status) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(status)));
      // Não lança: a segunda remoção do mesmo evento tem de terminar em sucesso,
      // senão a linha âmbar acenderia num compromisso cujo lembrete já não existe.
      await expect(comRetry(removerEvento("token", EVENT_ID))).resolves
        .toBeUndefined();
    },
  );

  // ── Retry (critério 10) ────────────────────────────────────────────────

  it.each([429, 500, 503])(
    "%i repete até o teto e termina em AgendaIndisponivelError",
    async (status) => {
      const espiao = vi.fn().mockResolvedValue(resposta(status, {}, "ocupado"));
      vi.stubGlobal("fetch", espiao);

      await expect(comRetry(gravarEvento("token", EVENTO))).rejects.toThrow(
        AgendaIndisponivelError,
      );
      expect(espiao).toHaveBeenCalledTimes(TENTATIVAS_MAXIMAS);
    },
  );

  it("3 tentativas no total — a original + 2 repetições", () => {
    expect(TENTATIVAS_MAXIMAS).toBe(3);
  });

  it("falha de rede repete e, se a segunda der certo, o evento é criado", async () => {
    const espiao = vi
      .fn()
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(resposta(200));
    vi.stubGlobal("fetch", espiao);

    expect(await comRetry(gravarEvento("token", EVENTO))).toBe("criado");
    expect(espiao).toHaveBeenCalledTimes(2);
  });

  it.each([400, 403])(
    "%i de configuração NÃO repete (critério 10) e sobe como AgendaRecusouError",
    async (status) => {
      const espiao = vi.fn().mockResolvedValue(resposta(status, {}, "não"));
      vi.stubGlobal("fetch", espiao);

      await expect(comRetry(gravarEvento("token", EVENTO))).rejects.toThrow(
        AgendaRecusouError,
      );
      // Repetir devolveria o mesmo erro e só queimaria cota.
      expect(espiao).toHaveBeenCalledTimes(1);
    },
  );

  // ── Credencial morta (critério 6) ──────────────────────────────────────

  it("401 na escrita sobe como AutorizacaoRevogadaError e NÃO repete", async () => {
    const espiao = vi.fn().mockResolvedValue(resposta(401, {}, "Invalid Credentials"));
    vi.stubGlobal("fetch", espiao);

    await expect(comRetry(gravarEvento("token", EVENTO))).rejects.toThrow(
      AutorizacaoRevogadaError,
    );
    expect(espiao).toHaveBeenCalledTimes(1);
  });

  it("`invalid_grant` na renovação é revogação, não erro de configuração", async () => {
    // O Google responde **400**, não 401, quando o refresh token foi revogado no
    // painel da conta. Tratar isso como 4xx comum faria o app tentar de novo em
    // cada reconciliação, para sempre, sem nunca contar ao Mateus — pre-mortem 1.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        resposta(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }),
      ),
    );

    await expect(
      comRetry(renovarAccessToken(CONFIG, "refresh-velho")),
    ).rejects.toThrow(AutorizacaoRevogadaError);
  });

  it("400 de outro motivo na renovação é AgendaRecusouError, não revogação", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(resposta(400, { error: "invalid_client" })),
    );
    await expect(
      comRetry(renovarAccessToken(CONFIG, "refresh")),
    ).rejects.toThrow(AgendaRecusouError);
  });

  it("renovação bem-sucedida devolve o access token", async () => {
    const espiao = vi
      .fn()
      .mockResolvedValue(resposta(200, { access_token: "token-novo" }));
    vi.stubGlobal("fetch", espiao);

    expect(await comRetry(renovarAccessToken(CONFIG, "refresh"))).toBe(
      "token-novo",
    );
    const chamada = ultimaChamada(espiao);
    expect(chamada.url).toBe("https://oauth2.googleapis.com/token");
    expect(chamada.corpo).toContain("grant_type=refresh_token");
    // O segredo vai no corpo da requisição de SERVIDOR — nunca no browser.
    expect(chamada.corpo).toContain("client_secret=segredo-de-teste");
  });

  // ── Troca do código (critério 17) ──────────────────────────────────────

  it("troca do código manda o redirect_uri e devolve o refresh token", async () => {
    const espiao = vi.fn().mockResolvedValue(
      resposta(200, {
        access_token: "acesso",
        refresh_token: "refresh",
        scope: "https://www.googleapis.com/auth/calendar.events",
      }),
    );
    vi.stubGlobal("fetch", espiao);

    const concedida = await comRetry(trocarCodigoPorToken(CONFIG, "codigo"));
    expect(concedida.refreshToken).toBe("refresh");
    expect(concedida.escopo).toBe(
      "https://www.googleapis.com/auth/calendar.events",
    );
    expect(ultimaChamada(espiao).corpo).toContain(
      "redirect_uri=http%3A%2F%2Flocalhost%3A3200%2Fapi%2Fgoogle%2Fagenda%2Fcallback",
    );
  });

  it("resposta SEM refresh token é falha, não sucesso parcial", async () => {
    // Sem ele a integração morreria na primeira expiração do access token,
    // deixando o Mateus com a impressão de que conectou.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(resposta(200, { access_token: "acesso" })),
    );
    await expect(
      comRetry(trocarCodigoPorToken(CONFIG, "codigo")),
    ).rejects.toThrow(/refresh token/);
  });

  // ── E-mail da conta (melhor esforço) ───────────────────────────────────

  it("descobre o e-mail da conta pelo `summary` do calendário primário", async () => {
    const espiao = vi
      .fn()
      .mockResolvedValue(resposta(200, { summary: "mateus@gmail.com" }));
    vi.stubGlobal("fetch", espiao);

    expect(await descobrirEmailDaConta("token")).toBe("mateus@gmail.com");
    expect(ultimaChamada(espiao).url).toContain("fields=summary");
  });

  it("NUNCA lança: falha ao descobrir o e-mail não pode impedir a autorização", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));
    expect(await descobrirEmailDaConta("token")).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(403)));
    expect(await descobrirEmailDaConta("token")).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(200, {})));
    expect(await descobrirEmailDaConta("token")).toBeNull();
  });
});
