import { describe, expect, it } from "vitest";

import {
  classificarFalhaAuth,
  destinoSeguro,
  ehEmailValido,
  mensagemDeFalhaAuth,
  mesmoEmail,
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

describe("mesmoEmail", () => {
  it("ignora espaço e caixa — o teclado do iPhone capitaliza a primeira letra", () => {
    expect(mesmoEmail("mateus@contai.local", " Mateus@Contai.local ")).toBe(true);
    expect(mesmoEmail("mateus@contai.local", "outro@contai.local")).toBe(false);
  });

  it("sem os dois lados não há comparação", () => {
    expect(mesmoEmail(null, "mateus@contai.local")).toBe(false);
    expect(mesmoEmail("mateus@contai.local", "")).toBe(false);
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
 * O GoTrue responde em inglês e, no login por senha, responde IGUAL para senha
 * errada e para e-mail sem conta — conferido no stack local em 2026-08-17:
 * `400 {"error_code":"invalid_credentials","msg":"Invalid login credentials"}`
 * nos dois casos, byte a byte.
 *
 * Quem desempata é a memória do aparelho (o e-mail do último login que deu
 * certo). O Mateus é o único usuário: dizer "e-mail ou senha" e deixá-lo
 * adivinhar qual dos dois é o mesmo que não dizer nada.
 */
const CREDENCIAL_INVALIDA = {
  code: "invalid_credentials",
  status: 400,
  message: "Invalid login credentials",
};

describe("classificarFalhaAuth", () => {
  it("no aparelho conhecido, e-mail que bate = senha errada", () => {
    const ctx = {
      emailTentado: " Mateus@Contai.local ",
      emailConhecido: "mateus@contai.local",
    };
    expect(classificarFalhaAuth(CREDENCIAL_INVALIDA, ctx)).toBe("senha_incorreta");
    expect(mensagemDeFalhaAuth(CREDENCIAL_INVALIDA, ctx)).toContain(
      "A senha não confere",
    );
    // Nada de inglês na tela.
    expect(mensagemDeFalhaAuth(CREDENCIAL_INVALIDA, ctx)).not.toContain("Invalid");
  });

  it("no aparelho conhecido, e-mail que NÃO bate = conta que não é a dele", () => {
    const ctx = {
      emailTentado: "outro@exemplo.com",
      emailConhecido: "mateus@contai.local",
    };
    expect(classificarFalhaAuth(CREDENCIAL_INVALIDA, ctx)).toBe("sem_conta");
    const mensagem = mensagemDeFalhaAuth(CREDENCIAL_INVALIDA, ctx);
    expect(mensagem).toContain("Confira o e-mail");
    // A mensagem diz QUAL é o e-mail deste aparelho — senão ele fica tentando.
    expect(mensagem).toContain("mateus@contai.local");
  });

  it("as duas causas produzem mensagens DIFERENTES", () => {
    const senha = mensagemDeFalhaAuth(CREDENCIAL_INVALIDA, {
      emailTentado: "mateus@contai.local",
      emailConhecido: "mateus@contai.local",
    });
    const conta = mensagemDeFalhaAuth(CREDENCIAL_INVALIDA, {
      emailTentado: "outro@exemplo.com",
      emailConhecido: "mateus@contai.local",
    });
    expect(senha).not.toBe(conta);
  });

  it("aparelho novo não finge saber qual dos dois foi", () => {
    // Sem login anterior neste aparelho não há com o que comparar. Inventar um
    // veredito aqui mandaria ele trocar a senha por causa de um e-mail errado.
    expect(classificarFalhaAuth(CREDENCIAL_INVALIDA, {})).toBe(
      "credencial_invalida",
    );
    expect(
      classificarFalhaAuth(CREDENCIAL_INVALIDA, {
        emailTentado: "mateus@contai.local",
        emailConhecido: null,
      }),
    ).toBe("credencial_invalida");
    expect(mensagemDeFalhaAuth(CREDENCIAL_INVALIDA, {})).toContain(
      "E-mail ou senha não conferem",
    );
  });

  it("conta criada sem Auto Confirm tem causa própria", () => {
    // Senha certa e login recusado: sem esta causa ele trocaria a senha para
    // sempre, sem nunca entrar.
    const erro = {
      code: "email_not_confirmed",
      status: 400,
      message: "Email not confirmed",
    };
    expect(classificarFalhaAuth(erro, { emailTentado: "a@b.com", emailConhecido: "a@b.com" })).toBe(
      "email_nao_confirmado",
    );
    expect(mensagemDeFalhaAuth(erro)).toContain("nunca foi confirmado");
  });

  it("excesso de tentativas", () => {
    expect(
      classificarFalhaAuth({ status: 429, message: "rate limit exceeded" }),
    ).toBe("muitas_tentativas");
    expect(classificarFalhaAuth({ code: "over_request_rate_limit" })).toBe(
      "muitas_tentativas",
    );
  });

  it("banco fora não vira 'senha errada'", () => {
    // Digitar a senha certa sem sinal no canteiro não pode acusar a senha —
    // ele trocaria a senha no painel por causa de um problema de rede.
    const ctx = {
      emailTentado: "mateus@contai.local",
      emailConhecido: "mateus@contai.local",
    };
    expect(
      classificarFalhaAuth({ name: "AuthRetryableFetchError", status: 0 }, ctx),
    ).toBe("rede");
    expect(classificarFalhaAuth({ status: 503 }, ctx)).toBe("rede");
    expect(classificarFalhaAuth({ name: "TypeError" }, ctx)).toBe("rede");
  });

  it("falha desconhecida não acusa credencial nenhuma", () => {
    expect(classificarFalhaAuth({ status: 400, message: "algo novo" })).toBe(
      "desconhecida",
    );
    expect(classificarFalhaAuth(null)).toBe("desconhecida");
    expect(mensagemDeFalhaAuth({ status: 400 })).toBe(
      "Não foi possível entrar agora. Tente de novo.",
    );
  });
});
