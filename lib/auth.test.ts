import { describe, expect, it } from "vitest";

import {
  classificarFalhaAuth,
  codigoCompleto,
  destinoSeguro,
  ehEmailValido,
  mensagemDeFalhaAuth,
  normalizarCodigo,
  urlDeEntrada,
} from "./auth";

/**
 * O destino do redirect é o único ponto de segurança desta tela: quem controla
 * `?destino=` controla para onde o app manda o Mateus depois de entrar. Um
 * redirect aberto aqui produz um link de phishing que sai com o domínio do
 * próprio contai — e ele acabou de digitar o código.
 */
describe("destinoSeguro", () => {
  it("aceita caminho interno com query string", () => {
    expect(destinoSeguro("/adicionar/documento")).toBe("/adicionar/documento");
    expect(destinoSeguro("/documento/abc?origem=agenda")).toBe(
      "/documento/abc?origem=agenda",
    );
    expect(destinoSeguro("/obras/1#custo")).toBe("/obras/1#custo");
  });

  it("recusa URL absoluta de outro host", () => {
    expect(destinoSeguro("https://evil.com/roubar")).toBe("/");
    expect(destinoSeguro("http://evil.com")).toBe("/");
    expect(destinoSeguro("javascript:alert(1)")).toBe("/");
    expect(destinoSeguro("data:text/html,<script>")).toBe("/");
  });

  it("recusa caminho protocol-relative, que é outro host disfarçado", () => {
    expect(destinoSeguro("//evil.com")).toBe("/");
    expect(destinoSeguro("//evil.com/adicionar")).toBe("/");
    // Alguns navegadores normalizam a barra invertida para barra.
    expect(destinoSeguro("/\\evil.com")).toBe("/");
  });

  it("recusa caractere de controle", () => {
    expect(destinoSeguro("/obras\nLocation: https://evil.com")).toBe("/");
    expect(destinoSeguro("/obras\r\n")).toBe("/");
  });

  it("recusa o próprio login como destino, que seria laço", () => {
    expect(destinoSeguro("/entrar")).toBe("/");
    expect(destinoSeguro("/entrar?destino=%2Fentrar")).toBe("/");
  });

  it("cai na home quando não há destino", () => {
    expect(destinoSeguro(null)).toBe("/");
    expect(destinoSeguro(undefined)).toBe("/");
    expect(destinoSeguro("")).toBe("/");
    expect(destinoSeguro("adicionar")).toBe("/");
  });
});

describe("urlDeEntrada", () => {
  it("escapa o destino no parâmetro", () => {
    expect(urlDeEntrada("/documento/abc?origem=agenda")).toBe(
      "/entrar?destino=%2Fdocumento%2Fabc%3Forigem%3Dagenda",
    );
  });

  it("omite o parâmetro quando o destino é a home", () => {
    expect(urlDeEntrada("/")).toBe("/entrar");
    expect(urlDeEntrada(null)).toBe("/entrar");
    expect(urlDeEntrada("https://evil.com")).toBe("/entrar");
  });
});

describe("normalizarCodigo", () => {
  it("fica só com os dígitos, no máximo seis", () => {
    expect(normalizarCodigo("417209")).toBe("417209");
    expect(normalizarCodigo("417 209")).toBe("417209");
    expect(normalizarCodigo("Seu código é 417209 — contai")).toBe("417209");
    expect(normalizarCodigo("41720999")).toBe("417209");
    expect(normalizarCodigo("abc")).toBe("");
  });

  it("só considera completo com seis dígitos", () => {
    expect(codigoCompleto("417209")).toBe(true);
    expect(codigoCompleto("41720")).toBe(false);
    expect(codigoCompleto("")).toBe(false);
    expect(codigoCompleto("41720a")).toBe(false);
  });
});

describe("ehEmailValido", () => {
  it("aceita o e-mail do Mateus e o do stack local", () => {
    expect(ehEmailValido("mateus.barragana@gmail.com")).toBe(true);
    expect(ehEmailValido(" mateus@contai.local ")).toBe(true);
  });

  it("recusa o que não é e-mail", () => {
    expect(ehEmailValido("mateus")).toBe(false);
    expect(ehEmailValido("mateus@")).toBe(false);
    expect(ehEmailValido("mateus@gmail")).toBe(false);
    expect(ehEmailValido("")).toBe(false);
  });
});

/**
 * O GoTrue responde em inglês. `otp_disabled` (422) é a resposta para e-mail
 * sem conta com `shouldCreateUser: false` — "Signups not allowed for otp"
 * chegando cru ao Mateus vira "o app quebrou", que é o diagnóstico errado.
 */
describe("classificarFalhaAuth", () => {
  it("e-mail sem conta cadastrada", () => {
    const erro = {
      code: "otp_disabled",
      status: 422,
      message: "Signups not allowed for otp",
    };
    expect(classificarFalhaAuth(erro, "email")).toBe("sem_conta");
    expect(mensagemDeFalhaAuth(erro, "email")).toContain("Não existe conta");
    // Nada de inglês na tela.
    expect(mensagemDeFalhaAuth(erro, "email")).not.toContain("Signups");
  });

  it("código errado e código expirado dão a MESMA causa", () => {
    // O GoTrue funde os dois casos; a tela promete os dois na mesma frase.
    const errado = {
      code: "otp_expired",
      status: 403,
      message: "Token has expired or is invalid",
    };
    const invalido = { status: 403, message: "Invalid token" };
    expect(classificarFalhaAuth(errado, "codigo")).toBe("codigo_invalido");
    expect(classificarFalhaAuth(invalido, "codigo")).toBe("codigo_invalido");
    expect(mensagemDeFalhaAuth(errado, "codigo")).toContain("expirou");
  });

  it("excesso de pedidos", () => {
    expect(
      classificarFalhaAuth({ status: 429, message: "rate limit exceeded" }, "email"),
    ).toBe("muitas_tentativas");
    expect(
      classificarFalhaAuth({ code: "over_email_send_rate_limit" }, "email"),
    ).toBe("muitas_tentativas");
  });

  it("falha de rede não vira 'código inválido'", () => {
    // Digitar o código certo sem sinal no canteiro não pode acusar o código.
    expect(
      classificarFalhaAuth({ name: "AuthRetryableFetchError", status: 0 }, "codigo"),
    ).toBe("rede");
    expect(classificarFalhaAuth({ status: 503 }, "codigo")).toBe("rede");
  });

  it("falha desconhecida cai na causa da etapa, nunca em texto do servidor", () => {
    expect(classificarFalhaAuth({ status: 400 }, "email")).toBe("envio");
    expect(classificarFalhaAuth({ status: 400 }, "codigo")).toBe("codigo_invalido");
    expect(classificarFalhaAuth(null, "email")).toBe("envio");
  });
});
