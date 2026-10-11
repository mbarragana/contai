import { afterEach, describe, expect, it, vi } from "vitest";

import { configDoGoogle, ESCOPO_GOOGLE } from "@/lib/agenda/config";
import {
  TEXTO_EXPIRADO,
  TEXTO_NAO_CONECTADO,
  TEXTO_NAO_CONFIGURADO,
  TEXTO_NEGADO,
  qualEstado,
  type DadosDaIntegracao,
} from "@/lib/agenda/estado";
import {
  gerarState,
  stateConfere,
  urlDeConsentimento,
} from "@/lib/agenda/oauth";

/**
 * **CONTAI-092 — os 4 estados do card e o Gate Fiscal do texto de tela.**
 *
 * ⚠️ O **estado 1 ("Não configurado") só é provado aqui.** O E2E não o alcança:
 * o servidor do Playwright sobe com as três variáveis de ambiente presentes, de
 * propósito, para os estados 2, 3 e 4 serem alcançáveis a partir de linhas reais
 * no Postgres (ver `playwright.config.ts`). Este arquivo é onde os quatro ficam
 * lado a lado.
 */

const CONECTADO: DadosDaIntegracao = {
  configurado: true,
  concedidoEm: "2026-09-12T10:00:00Z",
  revogadoEm: null,
  emailConta: "mateus@gmail.com",
  pendentes: 0,
};

describe("qualEstado — os 4 estados do card (critério 16)", () => {
  it("estado 1: variável de ambiente ausente → não configurado", () => {
    expect(qualEstado({ ...CONECTADO, configurado: false })).toBe(
      "nao-configurado",
    );
  });

  it("estado 2: configurado, mas OAuth nunca concluído → não conectado", () => {
    expect(
      qualEstado({ ...CONECTADO, concedidoEm: null, emailConta: null }),
    ).toBe("nao-conectado");
  });

  it("estado 3: autorização válida → conectado", () => {
    expect(qualEstado(CONECTADO)).toBe("conectado");
  });

  it("estado 4: autorização revogada/expirada → expirado (critério 6)", () => {
    expect(
      qualEstado({ ...CONECTADO, revogadoEm: "2026-10-01T08:00:00Z" }),
    ).toBe("expirado");
  });

  it("'não configurado' VENCE uma autorização antiga no banco (critério 15)", () => {
    // Mostrar "conectado" sem as variáveis prometeria lembrete que não sai: sem
    // elas nenhuma rota chama o Google.
    expect(
      qualEstado({
        ...CONECTADO,
        configurado: false,
        revogadoEm: "2026-10-01T08:00:00Z",
      }),
    ).toBe("nao-configurado");
  });
});

describe("Gate Fiscal 7a-c nos textos do card", () => {
  /**
   * Mesma lista do texto do evento. A diferença é o que ela protege aqui: o
   * card de `/conta` é a primeira coisa que o Mateus lê sobre o recurso, e é
   * nele que "lembrete não saiu" poderia virar, por descuido de redação,
   * "pagamento irregular" (7b).
   */
  const PROIBIDOS = [
    "vencimento fiscal",
    "obrigação",
    "obrigacao",
    "prazo legal",
    "darf",
    "aferição",
    "afericao",
    "inss",
    "irpf",
    "retenção",
    "retencao",
    "documentação hábil",
    "documentacao habil",
    "em dia com o fisco",
    "irregular",
    "pendência fiscal",
    "pendencia fiscal",
  ];

  const TEXTOS = {
    TEXTO_NAO_CONFIGURADO,
    TEXTO_NAO_CONECTADO,
    TEXTO_EXPIRADO,
    TEXTO_NEGADO,
  };

  it("nenhum termo de controle fiscal em texto nenhum do card", () => {
    for (const [nome, texto] of Object.entries(TEXTOS)) {
      for (const termo of PROIBIDOS) {
        expect(texto.toLowerCase(), `${nome} contém "${termo}"`).not.toContain(
          termo,
        );
      }
    }
  });

  it("o estado 2 já diz que é conveniência e não substitui conferir o app", () => {
    expect(TEXTO_NAO_CONECTADO).toContain(
      "É conveniência — não substitui conferir o app",
    );
  });

  it("o estado 4 fala da SINCRONIZAÇÃO, nunca do pagamento (7b)", () => {
    expect(TEXTO_EXPIRADO).toContain("A sincronização com o Google Agenda");
    expect(TEXTO_EXPIRADO).toContain("Os lembretes não estão sendo criados");
    // Nada neste texto afirma nada sobre o compromisso ou sobre o dinheiro: o
    // sujeito das duas frases é a sincronização e o lembrete, nunca o pagamento.
    expect(TEXTO_EXPIRADO.toLowerCase()).not.toContain("pagamento");
  });

  it("o aviso de conexão não concluída afirma que nada foi alterado", () => {
    // É literal e é verdade: o callback não grava linha nenhuma quando o
    // consentimento não se concluiu (critério 17).
    expect(TEXTO_NEGADO).toContain("nada foi alterado");
  });
});

describe("configDoGoogle (critério 15)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("as três variáveis presentes → configuração completa", () => {
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "id");
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "segredo");
    vi.stubEnv("GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:3200/cb");
    expect(configDoGoogle()).toEqual({
      clientId: "id",
      clientSecret: "segredo",
      redirectUri: "http://localhost:3200/cb",
    });
  });

  it.each([
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "GOOGLE_OAUTH_REDIRECT_URI",
  ])("faltando %s, a configuração é nula (parcial conta como ausente)", (faltante) => {
    // Client id sem secret produziria um redirecionamento ao Google que volta
    // com um `code` impossível de trocar: o Mateus veria a tela de
    // consentimento, concordaria, e voltaria para "não conectado" sem
    // explicação. Melhor dizer "não configurado" desde o começo.
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "id");
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "segredo");
    vi.stubEnv("GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:3200/cb");
    vi.stubEnv(faltante, "");
    expect(configDoGoogle()).toBeNull();
  });

  it("nenhuma das três é NEXT_PUBLIC_ (critério 15)", () => {
    // O client secret no bundle do browser deixaria qualquer pessoa com a URL
    // do app emitir token em nome deste cliente OAuth.
    const fonte = configDoGoogle.toString();
    expect(fonte).not.toContain("NEXT_PUBLIC_");
  });
});

describe("urlDeConsentimento (critério 17)", () => {
  const config = {
    clientId: "cliente",
    clientSecret: "segredo",
    redirectUri: "http://localhost:3200/api/google/agenda/callback",
  };

  it("pede offline + consent e SÓ o escopo calendar.events", () => {
    const url = new URL(urlDeConsentimento(config, "abc123"));
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    // `offline` é o que faz o Google devolver refresh token; `consent` é o que
    // faz um refresh token NOVO nascer na reautorização depois de uma revogação.
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("abc123");
    expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
  });

  it("o escopo é EXATAMENTE calendar.events — sem openid, sem email", () => {
    const url = new URL(urlDeConsentimento(config, "s"));
    expect(url.searchParams.get("scope")).toBe(ESCOPO_GOOGLE);
    expect(ESCOPO_GOOGLE).toBe(
      "https://www.googleapis.com/auth/calendar.events",
    );
    // Ampliar a autorização só para rotular um card seria pedir mais acesso do
    // que o recurso precisa.
    expect(url.searchParams.get("scope")).not.toContain("openid");
    expect(url.searchParams.get("scope")).not.toContain("userinfo");
  });

  it("o client SECRET nunca entra na URL de consentimento", () => {
    // Ela vai para a barra de endereço do browser.
    expect(urlDeConsentimento(config, "s")).not.toContain("segredo");
  });
});

describe("state do OAuth", () => {
  it("é hexadecimal de 32 caracteres e não repete", () => {
    const a = gerarState();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(gerarState());
  });

  it("confere só quando os dois lados existem e são iguais", () => {
    expect(stateConfere("abc", "abc")).toBe(true);
    expect(stateConfere("abc", "outro")).toBe(false);
  });

  it.each([
    [undefined, "abc"],
    ["abc", undefined],
    [null, null],
    ["", ""],
  ])("lado ausente (%s, %s) é RECUSA, nunca 'deixa passar'", (cookie, url) => {
    // Sem cookie não há prova de que este navegador iniciou o fluxo, e concluir
    // mesmo assim é gravar credencial a partir de uma volta que alguém montou.
    expect(stateConfere(cookie, url)).toBe(false);
  });
});
