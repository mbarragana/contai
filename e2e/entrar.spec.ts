import type { APIRequestContext, Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  CHAVE_PUBLICAVEL_LOCAL,
  EMAIL_SEED,
  URL_SUPABASE_LOCAL,
  USER_ID_SEED,
} from "./ambiente";
import { criarDocumento, criarFavorecido, criarPagamento } from "./banco";
import { expect, test } from "./fixtures";
import { codigoNaCaixa, limparCaixaDeEntrada } from "./mailpit";

/**
 * CONTAI-002 contra o stack LOCAL: GoTrue de verdade, e-mail de verdade no
 * Mailpit, cookie de sessão escrito pela própria biblioteca e RLS ligada.
 *
 * Nada de backend falsificado (regra dura do CLAUDE.md): o código digitado é o
 * que o Supabase mandou, e a asserção que mais importa (critério 7) olha o
 * ESTADO GRAVADO — quem não tem sessão não lê linha nenhuma do acervo fiscal.
 */

const CNPJ_AJE_DIGITOS = "11222333000181";
const EMAIL_SEM_CONTA = "nao-sou-o-dono@contai.local";

/**
 * Pede o código pela tela e chega no passo de digitação.
 *
 * A repetição existe por causa do GoTrue, não do app: `max_frequency = "1s"`
 * recusa dois pedidos para o MESMO endereço a menos de um segundo, e a suíte
 * encadeia logins mais rápido do que qualquer humano no canteiro. Esperar a
 * janela e pedir de novo é exatamente o que a tela oferece a quem toma esse
 * 429 — o teste não contorna nada, faz o que o usuário faria.
 */
async function pedirCodigoNaTela(
  page: Page,
  request: APIRequestContext,
  email: string = EMAIL_SEED,
) {
  await limparCaixaDeEntrada(request);
  await page.getByLabel("Seu e-mail").fill(email);

  const botao = page.getByRole("button", { name: "Enviar código" });
  const campo = page.getByLabel("Código do e-mail");

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    await botao.click();
    try {
      await expect(campo).toBeVisible({ timeout: 5_000 });
      return campo;
    } catch (erro) {
      if (tentativa === 3) throw erro;
      await page.waitForTimeout(1_500);
    }
  }
  throw new Error("inalcançável");
}

/** Faz o login pela tela, com o código lido do e-mail real. */
async function entrarPelaTela(
  page: Page,
  request: APIRequestContext,
  email: string = EMAIL_SEED,
) {
  const campo = await pedirCodigoNaTela(page, request, email);

  let codigo = "";
  await expect
    .poll(async () => (codigo = await codigoNaCaixa(request, email)), {
      timeout: 15_000,
    })
    .toMatch(/^\d{6}$/);

  await campo.fill(codigo);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  return codigo;
}

test.describe("entrar no app", () => {
  // Estes testes precisam do estado que todos os outros evitam: sem sessão.
  test.use({ sessao: false });

  test("pede o código, aceita o código do e-mail e abre a obra", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    // Sem sessão nenhuma rota do app abre — e o que aparece é o login, não uma
    // tela de erro com "Tentar de novo" (critério 5).
    await expect(page).toHaveURL(/\/entrar$/);
    await expect(
      page.getByRole("button", { name: "Tentar de novo" }),
    ).toHaveCount(0);

    const campo = page.getByLabel("Seu e-mail");
    await expect(campo).toHaveAttribute("autocomplete", "email");

    await entrarPelaTela(page, request);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Casa Cachoeira").first()).toBeVisible();
  });

  test("o campo do código pede teclado numérico e aceita o código colado sujo", async ({
    page,
    request,
  }) => {
    await page.goto("/entrar");
    const campo = await pedirCodigoNaTela(page, request);

    // O sistema só oferece o código do e-mail com estes dois atributos.
    await expect(campo).toHaveAttribute("inputmode", "numeric");
    await expect(campo).toHaveAttribute("autocomplete", "one-time-code");

    // Colar "417 209" (ou o trecho da notificação) tem de virar o código.
    await campo.fill("417 209");
    await expect(campo).toHaveValue("417209");
  });

  test("código errado diz o que houve, sem perder o caminho de volta", async ({
    page,
    request,
  }) => {
    await page.goto("/entrar");
    const campo = await pedirCodigoNaTela(page, request);

    await campo.fill("000000");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    await expect(
      page.getByRole("main").getByRole("alert"),
    ).toContainText("Esse código não vale");
    // Continua no login e continua editável: erro com saída, nunca tela morta.
    await expect(page).toHaveURL(/\/entrar/);
    await expect(campo).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Entrar", exact: true }),
    ).toBeEnabled();
  });

  test("e-mail sem conta recebe português, não o erro do GoTrue", async ({
    page,
  }) => {
    await page.goto("/entrar");
    await page.getByLabel("Seu e-mail").fill(EMAIL_SEM_CONTA);
    await page.getByRole("button", { name: "Enviar código" }).click();

    // Escopo no <main>: o anunciador de rota do Next também é role=alert.
    const alerta = page.getByRole("main").getByRole("alert");
    await expect(alerta).toContainText("Não existe conta com esse e-mail");
    // O GoTrue responde 422 "Signups not allowed for otp". Isso não pode
    // chegar ao Mateus: quem lê entende "o app quebrou", e o app não quebrou.
    await expect(alerta).not.toContainText("Signups");
    // E o login NÃO cria conta (shouldCreateUser: false) — o passo do código
    // nem aparece.
    await expect(page.getByLabel("Código do e-mail")).toHaveCount(0);
  });

  test("a rota pedida é retomada depois de entrar, com a query junto", async ({
    page,
    request,
  }) => {
    // O deep link do lembrete da agenda (US-002) não pode cair na home.
    await page.goto("/adicionar/documento?origem=agenda");

    await expect(page).toHaveURL(
      `/entrar?destino=${encodeURIComponent("/adicionar/documento?origem=agenda")}`,
    );

    await entrarPelaTela(page, request);

    await expect(page).toHaveURL("/adicionar/documento?origem=agenda");
    await expect(
      page.getByRole("heading", { name: "Registrar documento" }),
    ).toBeVisible();
  });

  test("destino forjado para outro site é ignorado", async ({
    page,
    request,
  }) => {
    // Redirect aberto aqui viraria link de phishing com o domínio do contai —
    // e o Mateus acabou de digitar o código.
    await page.goto("/entrar?destino=https://exemplo-malicioso.test/roubar");
    await entrarPelaTela(page, request);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Casa Cachoeira").first()).toBeVisible();
  });
});

test.describe("sair da conta", () => {
  test("sair apaga a sessão deste aparelho", async ({ page }) => {
    await page.goto("/conta");
    await expect(page.getByText(EMAIL_SEED).first()).toBeVisible();

    await page.getByRole("button", { name: /Sair da conta/ }).click();

    await expect(page).toHaveURL(/\/entrar/);
    // Não sobra cookie de sessão nenhum no aparelho.
    const cookies = await page.context().cookies();
    expect(cookies.filter((c) => c.name.startsWith("contai-auth"))).toEqual([]);

    // E a porta continua fechada: voltar para a rota protegida devolve o login.
    await page.goto("/");
    await expect(page).toHaveURL(/\/entrar$/);
  });
});

/**
 * Critério 7 — o teste mais importante do ticket. A tela pode mentir; a RLS
 * não. Quem protege CPF, CNO e as notas da obra é a policy do Postgres, e é
 * ela que este teste interroga.
 */
test.describe("a RLS é a guarda do acervo", () => {
  test("cliente sem sessão não lê obra, documento nem pagamento", async ({
    db,
  }) => {
    const aje = await criarFavorecido(db, {
      nome: "AJE Construções",
      documento: CNPJ_AJE_DIGITOS,
      tipo: "pj",
    });
    await criarDocumento(db, {
      favorecido_id: aje,
      tipo: "nf_servico",
      classificacao: "mao_obra",
      valor: 18000,
      destinatario_cpf_ok: true,
      status: "registrado",
    });
    await criarPagamento(db, {
      favorecido_id: aje,
      valor: 15000,
      data_pagamento: "2026-05-06",
      meio: "pix",
      status: "aguardando_nf",
      comprovante_path: `${USER_ID_SEED}/comprovante/pix.png`,
    });

    // Com sessão as três linhas estão lá — senão o vazio de baixo não provaria
    // nada além de um banco vazio.
    for (const tabela of ["obra", "documento", "pagamento"] as const) {
      const { data, error } = await db.from(tabela).select("id");
      expect(error).toBeNull();
      expect(data?.length ?? 0).toBeGreaterThan(0);
    }

    const semSessao = createClient(URL_SUPABASE_LOCAL, CHAVE_PUBLICAVEL_LOCAL, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    for (const tabela of ["obra", "documento", "pagamento"] as const) {
      const { data, error } = await semSessao.from(tabela).select("*");
      // A policy não devolve erro: devolve VAZIO. É por isso que o app trata
      // ausência de sessão como erro explícito, e nunca como "nada cadastrado".
      expect(error, `select em ${tabela} sem sessão`).toBeNull();
      expect(data, `linhas de ${tabela} vazadas sem sessão`).toEqual([]);
    }

    // Escrever também não passa: a policy vale nos dois sentidos.
    const { error: erroInsert } = await semSessao
      .from("obra")
      .insert({ nome: "Obra de estranho", data_inicio_obra: "2026-01-01" });
    expect(erroInsert).not.toBeNull();
  });
});

/**
 * Tela 6 do mock e a única consequência fiscal registrada no ticket: sessão
 * que cai no meio do preenchimento não pode levar o formulário junto
 * (IN SRF 84/2001 art. 17 — custo não comprovado não existe).
 */
test.describe("sessão que cai no meio do formulário", () => {
  test("o que foi digitado sobrevive à reautenticação e o registro entra no banco", async ({
    page,
    request,
    db,
  }) => {
    await page.goto("/adicionar/pagamento");
    await expect(
      page.getByRole("heading", { name: "Registrar pagamento" }),
    ).toBeVisible();

    await page.getByLabel("Favorecido", { exact: true }).fill("José da Silva");
    await page.getByLabel("CNPJ / CPF do favorecido").fill("529.982.247-25");
    await page.getByLabel("Valor").fill("1.250,00");
    await page.getByLabel("Data do pagamento").fill("2026-05-06");
    await page.getByLabel("Comprovante").setInputFiles({
      name: "pix-jose.png",
      mimeType: "image/png",
      buffer: Buffer.from("PNG pix-jose"),
    });

    // A sessão morre em silêncio — é assim que ela morre de verdade: cookie
    // expirado, ou apagado pelo ITP do Safari depois de dias sem abrir o app.
    await page.context().clearCookies();

    await page.getByRole("button", { name: /^Salvar/ }).click();

    // Sobreposto, não navegação: o formulário continua montado atrás.
    await expect(
      page.getByText("Sua sessão terminou enquanto você preenchia."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/adicionar\/pagamento$/);

    await entrarPelaTela(page, request);

    // O sobreposto some e os campos estão como ele deixou.
    await expect(
      page.getByText("Sua sessão terminou enquanto você preenchia."),
    ).toHaveCount(0);
    await expect(page.getByLabel("Favorecido", { exact: true })).toHaveValue(
      "José da Silva",
    );
    await expect(page.getByLabel("Valor")).toHaveValue("1.250,00");
    await expect(page.getByLabel("Data do pagamento")).toHaveValue("2026-05-06");
    await expect(page.getByText("pix-jose.png")).toBeVisible();

    await page.getByRole("button", { name: /^Salvar/ }).click();

    // E o que interessa: a linha existe no Postgres, com o valor certo.
    await expect
      .poll(async () => {
        const { data } = await db.from("pagamento").select("valor");
        return data?.length ?? 0;
      }, { timeout: 15_000 })
      .toBe(1);

    const { data } = await db.from("pagamento").select("valor, data_pagamento");
    expect(Number(data![0].valor)).toBe(1250);
    expect(data![0].data_pagamento).toBe("2026-05-06");
  });
});
