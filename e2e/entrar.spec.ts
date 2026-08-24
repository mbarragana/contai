import { createClient } from "@supabase/supabase-js";

import {
  CHAVE_PUBLICAVEL_LOCAL,
  EMAIL_SEED,
  SENHA_SEED,
  URL_SUPABASE_LOCAL,
  USER_ID_SEED,
} from "./ambiente";
import { COOKIE_SESSAO } from "../lib/auth";
import { criarDocumento, criarFavorecido, criarPagamento } from "./banco";
import { expect, test } from "./fixtures";
import { entrarPelaTela } from "./formularios";

/**
 * CONTAI-002 contra o stack LOCAL: GoTrue de verdade, senha de verdade, cookie
 * de sessão escrito pela própria biblioteca e RLS ligada.
 *
 * O login mudou em 2026-08-17 (código de 6 dígitos por e-mail → e-mail +
 * senha), e com ele saiu o Mailpit destes testes: nenhum e-mail é enviado.
 *
 * Nada de backend falsificado (regra dura do CLAUDE.md): a senha vai para o
 * GoTrue, e a asserção que mais importa (critério 7) olha o ESTADO GRAVADO —
 * quem não tem sessão não lê linha nenhuma do acervo fiscal.
 */

const CNPJ_AJE_DIGITOS = "11222333000181";
const EMAIL_SEM_CONTA = "nao-sou-o-dono@contai.local";

/**
 * Login pela tela — e o laço de preenchimento NÃO é paranoia.
 *
 * O formulário é controlado: `email` sai de `emailDigitado ?? emailConhecido ??
 * ""` (app/_components/entrar.tsx), e quem valida é `entrar()`, lendo o ESTADO
 * do React, não o DOM. O `fill()` do Playwright escreve no DOM; se a página
 * ainda não hidratou, o `onChange` não dispara, `emailDigitado` continua `null`
 * e o submit vê e-mail vazio — a tela responde "Digite um e-mail válido", a URL
 * não muda, e o teste falha apontando para o lugar errado.
 *
 * Foi o que derrubou o CI em 2026-08-23 (run 32640902865): 1 vermelho e 4
 * flaky, todos aqui, todos com essa mensagem. Na máquina do Mateus a hidratação
 * ganha a corrida; no runner frio do GitHub, às vezes não.
 *
 * O `toPass` conserta porque o input é controlado: se a hidratação chegar
 * depois do `fill`, o React repinta o campo com o estado dele (vazio) e o
 * `toHaveValue` reprova — a iteração seguinte preenche com a página já viva.
 * Esperar por `networkidle` ou por um `waitForTimeout` não serviria: nenhum dos
 * dois diz que o React assumiu o campo.
 */
test.describe("entrar no app", () => {
  // Estes testes precisam do estado que todos os outros evitam: sem sessão.
  test.use({ sessao: false });

  test("entra com e-mail e senha e abre a obra", async ({ page }) => {
    await page.goto("/");
    // Sem sessão nenhuma rota do app abre — e o que aparece é o login, não uma
    // tela de erro com "Tentar de novo" (critério 5).
    await expect(page).toHaveURL(/\/entrar$/);
    await expect(
      page.getByRole("button", { name: "Tentar de novo" }),
    ).toHaveCount(0);

    const campoEmail = page.getByLabel("Seu e-mail");
    await expect(campoEmail).toHaveAttribute("autocomplete", "email");

    // Os dois atributos que fazem o gerenciador do iPhone oferecer a senha
    // guardada. Sem eles, entrar no canteiro vira digitar senha com uma mão.
    const campoSenha = page.getByLabel("Sua senha");
    await expect(campoSenha).toHaveAttribute("type", "password");
    await expect(campoSenha).toHaveAttribute("autocomplete", "current-password");

    await entrarPelaTela(page);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Casa Cachoeira").first()).toBeVisible();
  });

  /**
   * O GoTrue devolve a MESMA resposta para senha errada e para e-mail sem conta
   * (`invalid_credentials`). Quem desempata é o e-mail do último login DESTE
   * aparelho — e é isto que este teste exerce, do jeito real: entra, sai, e
   * erra cada um dos dois campos.
   *
   * O Mateus é o único usuário do app. "E-mail ou senha inválidos" o deixaria
   * trocando a senha no painel do Supabase por causa de um e-mail digitado
   * errado.
   */
  test("no aparelho conhecido, senha errada e e-mail errado dizem coisas diferentes", async ({
    page,
  }) => {
    await page.goto("/entrar");
    await entrarPelaTela(page);
    await expect(page).toHaveURL(/\/$/);

    // Sai: a sessão morre, a memória do e-mail fica.
    await page.goto("/conta");
    await page.getByRole("button", { name: /Sair da conta/ }).click();
    await expect(page).toHaveURL(/\/entrar/);

    // O campo já vem preenchido com o e-mail deste aparelho — um toque a menos.
    await expect(page.getByLabel("Seu e-mail")).toHaveValue(EMAIL_SEED);

    // 1. E-mail certo, senha errada.
    await entrarPelaTela(page, EMAIL_SEED, "senha-que-nao-e-a-dele");
    // Escopo no <main>: o anunciador de rota do Next também é role=alert.
    const alerta = page.getByRole("main").getByRole("alert");
    await expect(alerta).toContainText("A senha não confere");
    // Nada de inglês do GoTrue: "Invalid login credentials" vira "o app
    // quebrou" na cabeça de quem lê, e o app não quebrou.
    await expect(alerta).not.toContainText("Invalid");

    // Erro com saída, nunca tela morta — e o que foi digitado continua lá.
    await expect(page).toHaveURL(/\/entrar/);
    await expect(page.getByLabel("Sua senha")).toHaveValue(
      "senha-que-nao-e-a-dele",
    );
    await expect(
      page.getByRole("button", { name: "Entrar", exact: true }),
    ).toBeEnabled();

    // 2. Mesma resposta do GoTrue, outra causa: e-mail que não é o da conta.
    await entrarPelaTela(page, EMAIL_SEM_CONTA, SENHA_SEED);
    await expect(alerta).toContainText("Confira o e-mail");
    // E diz QUAL é o e-mail deste aparelho, senão ele fica tentando às cegas.
    await expect(alerta).toContainText(EMAIL_SEED);
    await expect(alerta).not.toContainText("A senha não confere");
  });

  test("aparelho novo não finge saber se foi o e-mail ou a senha", async ({
    page,
  }) => {
    // Sem login anterior neste aparelho não há com o que comparar, e o GoTrue
    // não conta. Inventar um veredito aqui seria mentir com cara de precisão.
    await page.goto("/entrar");
    await expect(page.getByLabel("Seu e-mail")).toHaveValue("");

    await entrarPelaTela(page, EMAIL_SEM_CONTA, "qualquer-coisa");

    const alerta = page.getByRole("main").getByRole("alert");
    await expect(alerta).toContainText("E-mail ou senha não conferem");
    await expect(alerta).not.toContainText("Invalid");
    // Continua no login: o app nunca cria conta, nem quando o e-mail não existe.
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("a rota pedida é retomada depois de entrar, com a query junto", async ({
    page,
  }) => {
    // O deep link do lembrete da agenda (US-002) não pode cair na home.
    await page.goto("/adicionar/documento?origem=agenda");

    await expect(page).toHaveURL(
      `/entrar?destino=${encodeURIComponent("/adicionar/documento?origem=agenda")}`,
    );

    await entrarPelaTela(page);

    await expect(page).toHaveURL("/adicionar/documento?origem=agenda");
    await expect(
      page.getByRole("heading", { name: "Registrar documento" }),
    ).toBeVisible();
  });

  /**
   * Critério 3 — o critério que o pre-mortem 3 do ticket chama de o que mais
   * importa: se o app pedir código a cada visita, ele para de registrar no
   * canteiro, e documento que não se registra na hora tende a não ser
   * registrado nunca.
   *
   * O que os outros testes provam é que a sessão sobrevive à NAVEGAÇÃO, que é
   * outra coisa. Aqui a asserção é sobre o cookie ser PERSISTENTE: cookie de
   * sessão passaria em qualquer teste de navegação e morreria no iPhone real,
   * na primeira vez que ele fechasse o app.
   */
  test("a sessão sobrevive a fechar e reabrir o app", async ({
    page,
    browser,
  }) => {
    await page.goto("/entrar");
    await entrarPelaTela(page);
    await expect(page).toHaveURL(/\/$/);

    const cookies = await page.context().cookies();
    const daSessao = cookies.filter((c) => c.name.startsWith(COOKIE_SESSAO));
    expect(daSessao.length).toBeGreaterThan(0);

    // `expires` = -1 é como o Playwright devolve cookie de sessão. Exigir data
    // lá na frente é o que trava a regressão: no dia em que alguém passar um
    // `cookieOptions` sem `maxAge`, ou o default da lib mudar, este teste cai.
    const daquiADuasSemanas = Date.now() / 1000 + 14 * 24 * 60 * 60;
    for (const cookie of daSessao) {
      expect(
        cookie.expires,
        `o cookie ${cookie.name} não sobrevive a fechar o app`,
      ).toBeGreaterThan(daquiADuasSemanas);
    }

    // "Reabrir o PWA": contexto novo — processo novo, memória zerada — levando
    // só o que um navegador guarda em DISCO. Cookie de sessão ficaria para
    // trás neste filtro, exatamente como ficaria no aparelho dele.
    const origem = new URL(page.url()).origin;
    const persistentes = cookies.filter((c) => c.expires > 0);
    const reaberto = await browser.newContext();
    try {
      await reaberto.addCookies(persistentes);
      const aberturaNova = await reaberto.newPage();

      // Direto na rota protegida, sem passar pelo login.
      await aberturaNova.goto(`${origem}/conta`);
      await expect(aberturaNova).toHaveURL(/\/conta$/);
      await expect(aberturaNova.getByText(EMAIL_SEED).first()).toBeVisible();
    } finally {
      await reaberto.close();
    }
  });

  test("destino forjado para outro site é ignorado", async ({ page }) => {
    // Redirect aberto aqui viraria link de phishing com o domínio do contai —
    // e o Mateus acabou de digitar a senha.
    await page.goto("/entrar?destino=https://exemplo-malicioso.test/roubar");
    await entrarPelaTela(page);

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
    expect(cookies.filter((c) => c.name.startsWith(COOKIE_SESSAO))).toEqual([]);

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
      // São DUAS barreiras, e esta é a de fora: sem GRANT para `anon`
      // (migration 0005) o Postgres barra antes de a policy ser avaliada —
      // 42501, "permission denied for table". Foi a AUSÊNCIA desta barreira no
      // remoto que derrubou o app publicado em 2026-08-17, com o banco local
      // verde por ser mais permissivo que a produção.
      expect(error?.code, `select em ${tabela} sem sessão`).toBe("42501");
      expect(data, `linhas de ${tabela} vazadas sem sessão`).toBeNull();
    }

    // Escrever também não passa. Aqui as duas barreiras diriam não: o `anon`
    // não tem INSERT, e ainda que tivesse a policy exige `user_id = auth.uid()`.
    const { error: erroInsert } = await semSessao
      .from("obra")
      .insert({ nome: "Obra de estranho", data_inicio_obra: "2026-01-01" });
    expect(erroInsert).not.toBeNull();
  });
});
