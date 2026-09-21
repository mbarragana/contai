import { describe, expect, it } from "vitest";

import {
  ESPERAS_ENTRE_TENTATIVAS_MS,
  MS_ATE_AVISAR,
  MS_ATE_SEGUNDO_AVISO,
  MS_POR_TENTATIVA,
  SemRespostaDoServidorError,
  TETO_DE_GRAVACAO_MS,
  TETO_DE_LEITURA_MS,
  criarFetchDeTela,
  ehSemResposta,
  nivelDeEspera,
  observarTentativaSemResposta,
} from "./rede";

/**
 * CONTAI-006 — a política de rede das telas.
 *
 * O que estes testes travam é o comportamento que o Gate 3 do CONTAI-001
 * mediu e o ticket mandou mudar: a espera até o erro final, o aviso à tela ANTES
 * do fim do backoff, e a diferença entre "o servidor recusou" e "não houve
 * resposta" — que é o que separa "não foi salvo" de "não sei se salvou".
 */

const URL_REST = "http://127.0.0.1:54331/rest/v1/documento?select=*";
const URL_AUTH = "http://127.0.0.1:54331/auth/v1/token?grant_type=password";

function resposta(status: number): Response {
  return new Response(status === 204 ? null : "{}", { status });
}

/** Relógio de mentira: só anda quando o teste manda. */
function relogio() {
  let t = 0;
  return {
    agora: () => t,
    dormir: async (ms: number) => {
      t += ms;
    },
    andar: (ms: number) => {
      t += ms;
    },
    get valor() {
      return t;
    },
  };
}

describe("ehSemResposta", () => {
  it("reconhece o erro deste módulo, inclusive depois de o postgrest-js o embrulhar", () => {
    expect(ehSemResposta(new SemRespostaDoServidorError("nada"))).toBe(true);
    // É assim que o erro chega às telas: o postgrest-js devolve um objeto
    // simples com `message` = `${name}: ${message}`, perdendo a classe.
    expect(
      ehSemResposta({ message: "SemRespostaDoServidor: Sem resposta", code: "" }),
    ).toBe(true);
  });

  it("reconhece a falha de rede crua do browser", () => {
    expect(ehSemResposta({ message: "TypeError: Failed to fetch" })).toBe(true);
    // WebKit — o motor do iPhone e o do E2E.
    expect(ehSemResposta({ message: "Load failed" })).toBe(true);
    expect(ehSemResposta({ message: "AbortError: aborted" })).toBe(true);
  });

  it("NÃO confunde recusa do servidor com ausência de resposta", () => {
    // O ramo que não pode falhar: um erro COM corpo é resposta, e a tela pode
    // afirmar "não foi salvo".
    expect(
      ehSemResposta({
        message: 'duplicate key value violates unique constraint "x"',
        code: "23505",
      }),
    ).toBe(false);
    expect(ehSemResposta(new Error("CNPJ/CPF inválido."))).toBe(false);
    expect(ehSemResposta(null)).toBe(false);
  });
});

describe("criarFetchDeTela — leitura", () => {
  it("repete o 503 e desiste dentro do teto, muito antes dos 7,7 s de antes", async () => {
    const r = relogio();
    let chamadas = 0;
    const buscar = criarFetchDeTela(
      async () => {
        chamadas += 1;
        return resposta(503);
      },
      r.agora,
      r.dormir,
    );

    await expect(buscar(URL_REST)).rejects.toBeInstanceOf(
      SemRespostaDoServidorError,
    );
    expect(chamadas).toBe(ESPERAS_ENTRE_TENTATIVAS_MS.length + 1);
    // Só as esperas entram no relógio (o 503 volta na hora); o ponto é que o
    // total fica abaixo do teto — e muito abaixo dos 7 s do backoff antigo.
    expect(r.valor).toBeLessThan(TETO_DE_LEITURA_MS);
    expect(r.valor).toBeLessThan(7_000);
  });

  it("avisa a tela a cada tentativa que falha, e o primeiro aviso vem na primeira falha", async () => {
    const r = relogio();
    const avisos: number[] = [];
    const parar = observarTentativaSemResposta(() => avisos.push(r.valor));
    const buscar = criarFetchDeTela(async () => resposta(503), r.agora, r.dormir);

    await expect(buscar(URL_REST)).rejects.toBeInstanceOf(
      SemRespostaDoServidorError,
    );
    parar();

    // Critério 2: o primeiro aviso sai ANTES de qualquer espera de backoff —
    // é o que impede a tela de continuar dizendo "carregando".
    expect(avisos[0]).toBe(0);
    expect(avisos).toHaveLength(ESPERAS_ENTRE_TENTATIVAS_MS.length + 1);
  });

  it("para de assinar não vaza aviso para quem já saiu da tela", async () => {
    const r = relogio();
    let avisos = 0;
    observarTentativaSemResposta(() => {
      avisos += 1;
    })();
    const buscar = criarFetchDeTela(async () => resposta(503), r.agora, r.dormir);
    await expect(buscar(URL_REST)).rejects.toBeTruthy();
    expect(avisos).toBe(0);
  });

  it("devolve a resposta boa assim que ela vem, sem gastar as tentativas restantes", async () => {
    const r = relogio();
    let chamadas = 0;
    const buscar = criarFetchDeTela(
      async () => {
        chamadas += 1;
        return resposta(chamadas === 1 ? 503 : 200);
      },
      r.agora,
      r.dormir,
    );
    const res = await buscar(URL_REST);
    expect(res.status).toBe(200);
    expect(chamadas).toBe(2);
  });

  it("não repete erro que o servidor RESPONDEU (4xx, RLS, constraint)", async () => {
    const r = relogio();
    let chamadas = 0;
    const buscar = criarFetchDeTela(
      async () => {
        chamadas += 1;
        return resposta(401);
      },
      r.agora,
      r.dormir,
    );
    const res = await buscar(URL_REST);
    expect(res.status).toBe(401);
    expect(chamadas).toBe(1);
  });

  it("nenhuma tentativa NOVA começa depois do teto — é o fim da espera indefinida", async () => {
    const r = relogio();
    const inicios: number[] = [];
    const buscar = criarFetchDeTela(
      async () => {
        inicios.push(r.valor);
        // O pedido que PENDURA: consome o teto de uma tentativa inteira em vez
        // de responder 503 na hora.
        r.andar(MS_POR_TENTATIVA);
        throw new Error("Failed to fetch");
      },
      r.agora,
      r.dormir,
    );
    await expect(buscar(URL_REST)).rejects.toBeInstanceOf(
      SemRespostaDoServidorError,
    );
    expect(inicios.length).toBeGreaterThan(0);
    for (const inicio of inicios) {
      expect(inicio).toBeLessThan(TETO_DE_LEITURA_MS);
    }
    expect(inicios.length).toBeLessThanOrEqual(
      ESPERAS_ENTRE_TENTATIVAS_MS.length + 1,
    );
  });
});

describe("criarFetchDeTela — gravação", () => {
  it("NUNCA repete uma escrita, nem quando o 503 seria repetível numa leitura", async () => {
    const r = relogio();
    let chamadas = 0;
    const buscar = criarFetchDeTela(
      async () => {
        chamadas += 1;
        return resposta(503);
      },
      r.agora,
      r.dormir,
    );
    // ⚠️ E devolve a resposta: 503 numa escrita é RESPOSTA. A tela continua
    // podendo dizer "não foi salvo" — repetir escrita sem idempotência é como
    // nasce o registro duplicado.
    const res = await buscar(URL_REST, { method: "POST", body: "{}" });
    expect(res.status).toBe(503);
    expect(chamadas).toBe(1);
  });

  it("⚠️ escrita NÃO avisa a tela: o aviso é do módulo e mentiria para a leitura ao lado", async () => {
    // Gate 2 do CONTAI-006. O aviso troca o texto de QUALQUER `<Carregando>`
    // montado naquele instante para "sem resposta do servidor — tentando de
    // novo". Num POST as duas metades são falsas: o 503 TEVE resposta, e
    // escrita não é repetida. Quem pagava era a leitura viva do mesmo
    // formulário ("Procurando agendamentos parecidos").
    const r = relogio();
    let avisos = 0;
    const parar = observarTentativaSemResposta(() => {
      avisos += 1;
    });
    const buscar = criarFetchDeTela(async () => resposta(503), r.agora, r.dormir);

    const res = await buscar(URL_REST, { method: "POST", body: "{}" });
    parar();

    expect(res.status).toBe(503);
    expect(avisos).toBe(0);
  });

  it("nem quando a escrita não recebe resposta nenhuma — continua sem avisar a tela", async () => {
    // O outro ramo da escrita: aqui "não houve resposta" é verdade, mas
    // "tentando de novo" continua não sendo — escrita não repete. Quem informa
    // a ambiguidade do critério 6 é a tela que fez a gravação, não o módulo.
    const r = relogio();
    let avisos = 0;
    const parar = observarTentativaSemResposta(() => {
      avisos += 1;
    });
    const buscar = criarFetchDeTela(
      async () => {
        throw new TypeError("Failed to fetch");
      },
      r.agora,
      r.dormir,
    );

    await expect(buscar(URL_REST, { method: "POST" })).rejects.toBeInstanceOf(
      SemRespostaDoServidorError,
    );
    parar();
    expect(avisos).toBe(0);
  });

  it("falha de rede numa escrita vira 'não houve resposta', não erro genérico", async () => {
    const r = relogio();
    const buscar = criarFetchDeTela(
      async () => {
        throw new TypeError("Failed to fetch");
      },
      r.agora,
      r.dormir,
    );
    const erro = await buscar(URL_REST, { method: "POST" }).catch((e) => e);
    expect(ehSemResposta(erro)).toBe(true);
  });

  it("dá à escrita um teto mais largo que o da leitura, de propósito", () => {
    // Desistir cedo de um GET não custa nada; desistir cedo de um POST fabrica
    // a ambiguidade que o critério 6 existe para eliminar.
    expect(TETO_DE_GRAVACAO_MS).toBeGreaterThan(TETO_DE_LEITURA_MS);
  });
});

describe("criarFetchDeTela — fora do PostgREST", () => {
  it("não toca no GoTrue: sem teto, sem repetição, sem embrulhar o erro", async () => {
    const r = relogio();
    let chamadas = 0;
    const buscar = criarFetchDeTela(
      async () => {
        chamadas += 1;
        throw new TypeError("Failed to fetch");
      },
      r.agora,
      r.dormir,
    );
    // O auth-js decide o que é repetível pelo TIPO do erro; embrulhar trocaria
    // a mensagem de login por uma genérica.
    await expect(buscar(URL_AUTH, { method: "POST" })).rejects.toBeInstanceOf(
      TypeError,
    );
    expect(chamadas).toBe(1);
  });
});

describe("nivelDeEspera", () => {
  it("começa no esqueleto e só troca de texto aos ~2 s", () => {
    expect(nivelDeEspera(0, 0)).toBe(0);
    expect(nivelDeEspera(MS_ATE_AVISAR - 1, 0)).toBe(0);
    expect(nivelDeEspera(MS_ATE_AVISAR, 0)).toBe(1);
  });

  it("⚠️ a primeira falha derruba o 'carregando' na hora, sem esperar o relógio", () => {
    // É o critério 2 inteiro: a tela nunca diz "carregando" depois de saber
    // que uma tentativa falhou — os 7,7 s de mentira do achado morrem aqui.
    expect(nivelDeEspera(0, 1)).toBe(1);
  });

  it("falha NÃO antecipa o 'ainda tentando' — ele fala de duração, não de contagem", () => {
    // A home dispara várias leituras em paralelo: duas falhas no mesmo instante
    // são um ciclo visto duas vezes. Se contassem, a tela diria "ainda
    // tentando" aos 400 ms, quando não há nada de "ainda".
    expect(nivelDeEspera(10, 2)).toBe(1);
    expect(nivelDeEspera(10, 9)).toBe(1);
  });

  it("explica a demora do servidor que estava inativo antes de desistir", () => {
    expect(nivelDeEspera(MS_ATE_SEGUNDO_AVISO, 0)).toBe(2);
    expect(nivelDeEspera(TETO_DE_LEITURA_MS - 1, 0)).toBe(2);
  });

  it("o teto vence tudo, inclusive o pedido que só pendura e nunca falha", () => {
    expect(nivelDeEspera(TETO_DE_LEITURA_MS, 0)).toBe(3);
    expect(nivelDeEspera(TETO_DE_LEITURA_MS + 10_000, 0)).toBe(3);
  });
});
