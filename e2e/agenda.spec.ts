import { OBRA_ID_SEED } from "./ambiente";
import {
  conectarGoogle,
  criarCompromisso,
  criarFavorecido,
  linhasDaAgenda,
  pendencias,
  sincronizacaoDoCompromisso,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * **CONTAI-092 — o card "Integrações" e a linha de lembrete, contra o Postgres
 * LOCAL.**
 *
 * ⚠️ **O que este arquivo NÃO faz, e por quê.** Ele não fala com o Google, em
 * nenhum teste. Não é limitação escondida: é o critério 18 do ticket ("a porta
 * 3100 do Playwright não se registra — E2E não fala com o Google de verdade") e
 * a regra dura de E2E do projeto ao mesmo tempo. Stub de rede para o Supabase é
 * proibido porque o Supabase roda local e pode ser exercitado de verdade; para o
 * Google, a alternativa a não chamar seria credencial OAuth real no CI.
 *
 * O servidor do Playwright sobe com as três `GOOGLE_OAUTH_*` **falsas** (ver
 * `playwright.config.ts`), o que torna alcançáveis os estados 2, 3 e 4 do card a
 * partir de linhas REAIS no Postgres. O estado 1 ("Não configurado") é provado
 * por unit test da função pura `qualEstado` (`lib/agenda/estado.test.ts`), onde
 * os quatro ficam lado a lado — aqui ele não existe porque o servidor sobe
 * configurado.
 *
 * E nenhum teste CLICA em "Conectar": o clique navegaria para
 * accounts.google.com de verdade. O que se prova da rota de autorização é o
 * `Location` do redirecionamento, sem seguir.
 *
 * `/conta` é tela de GESTÃO (em casa, sentado) — o "Teste do Canteiro" não se
 * aplica a nenhum dos quatro estados, está dito no ticket e no spec.
 */

/** Hoje no fuso do aparelho — o mesmo `hojeIso()` do app. */
function hoje(): string {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function maisDias(dias: number): string {
  const d = new Date(`${hoje()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function agendamentoPix(db: Db, over = {}) {
  const favorecidoId = await criarFavorecido(db, {
    tipo: "pj",
    nome: "WK Construções LTDA",
    documento: "11222333000181",
  });
  return criarCompromisso(db, {
    favorecido_id: favorecidoId,
    valor_previsto: 3200,
    data_prevista: maisDias(10),
    origem: "pix",
    ...over,
  });
}

test.describe("card Integrações em /conta", () => {
  test("estado 2 — sem autorização nenhuma, oferece conectar", async ({
    page,
  }) => {
    await page.goto("/conta");

    const card = page.locator("[data-integracao-google]");
    await expect(card).toHaveAttribute("data-integracao-google", "nao-conectado");
    await expect(
      card.getByRole("button", { name: "Conectar Google Agenda" }),
    ).toBeVisible();
    // A restrição do Gate Fiscal aparece já na primeira vez que ele vê o
    // recurso, não só no corpo do evento.
    await expect(card).toContainText("É conveniência — não substitui conferir o app");
    // Estado 2 não tem contagem de pendentes nem botão de sincronizar.
    await expect(
      card.getByRole("button", { name: "Sincronizar agora" }),
    ).toBeHidden();
  });

  test("estado 3 — conectado mostra conta, data e pendentes (inclusive 0)", async ({
    page,
    db,
  }) => {
    await conectarGoogle(db);
    await page.goto("/conta");

    const card = page.locator("[data-integracao-google]");
    await expect(card).toHaveAttribute("data-integracao-google", "conectado");
    await expect(card).toContainText("mateus.obra@gmail.com");
    await expect(card).toContainText("12/09/2026");
    // ⚠️ Zero é MOSTRADO, não escondido (spec): é a confirmação de que está
    // tudo sincronizado, não um buraco na tela.
    await expect(card.locator("[data-agenda-pendentes]")).toHaveAttribute(
      "data-agenda-pendentes",
      "0",
    );
  });

  test("estado 3 — agendamento PIX sem lembrete conta como pendente; CARTÃO não", async ({
    page,
    db,
  }) => {
    await conectarGoogle(db);
    await agendamentoPix(db);
    // Compra no cartão: **nunca** gera evento (critério 2), então nunca pode
    // aparecer como pendência de sincronização — senão uma compra em 24
    // parcelas encheria o card de pendentes que nada resolve.
    const favorecidoId = await criarFavorecido(db, {
      tipo: "pj",
      nome: "Loja de Material",
      documento: "11444777000161",
    });
    await criarCompromisso(db, {
      favorecido_id: favorecidoId,
      valor_previsto: 500,
      data_prevista: maisDias(40),
      origem: "cartao",
      data_compra: hoje(),
    });

    await page.goto("/conta");
    await expect(
      page.locator("[data-agenda-pendentes]"),
    ).toHaveAttribute("data-agenda-pendentes", "1");
    await expect(page.locator("[data-integracao-google]")).toContainText(
      "1 compromisso",
    );
  });

  test("estado 4 — autorização revogada vira aviso âmbar e 'Conectar de novo'", async ({
    page,
    db,
  }) => {
    // O par é obrigatório no banco (check `integracao_google_revogacao_par_completo`):
    // revogado sem motivo é estado impossível.
    await conectarGoogle(db, {
      revogado_em: "2026-10-05T09:00:00Z",
      motivo_revogacao: "invalid_grant",
    });
    await page.goto("/conta");

    const card = page.locator("[data-integracao-google]");
    await expect(card).toHaveAttribute("data-integracao-google", "expirado");
    await expect(card).toContainText(
      "A sincronização com o Google Agenda está interrompida",
    );
    await expect(
      card.getByRole("button", { name: "Conectar de novo" }),
    ).toBeVisible();
    // ⚠️ O e-mail anterior continua visível: ajuda a saber se é a conta certa
    // ao reconectar.
    await expect(card).toContainText("mateus.obra@gmail.com");
    // ⚠️ ÂMBAR, nunca vermelho: nenhum dinheiro saiu errado e nenhum documento
    // está faltando — é uma conveniência pausada. O vermelho do app é reservado
    // a custo fora do lugar e documentação faltante.
    await expect(card.locator("[role=status]")).toHaveClass(/text-amb/);
  });

  test("'Sincronizar agora' com nada pendente não muda a contagem", async ({
    page,
    db,
  }) => {
    // ⚠️ Cenário com ZERO pendentes de propósito: com essa condição o servidor
    // encerra a sincronização ANTES de pedir access token, então este clique
    // não produz tráfego nenhum para o Google. É o único jeito honesto de
    // exercitar o botão num ambiente sem credencial real.
    await conectarGoogle(db);
    await page.goto("/conta");

    const card = page.locator("[data-integracao-google]");
    await card.getByRole("button", { name: "Sincronizar agora" }).click();
    await expect(
      card.getByRole("button", { name: "Sincronizar agora" }),
    ).toBeVisible();
    await expect(card.locator("[data-agenda-pendentes]")).toHaveAttribute(
      "data-agenda-pendentes",
      "0",
    );
    // Nenhuma linha nasceu: não havia o que sincronizar.
    expect(await linhasDaAgenda(db)).toEqual([]);
  });

  test("a volta negada do Google cai no estado 2 com aviso, sem gravar nada", async ({
    page,
    db,
  }) => {
    await page.goto("/conta?google=negado");

    const card = page.locator("[data-integracao-google]");
    await expect(card).toHaveAttribute("data-integracao-google", "nao-conectado");
    await expect(card).toContainText("A conexão não foi concluída");
    await expect(card).toContainText("nada foi alterado");
    // E é literal: o callback não grava linha nenhuma quando o consentimento
    // não se concluiu (critério 17).
    expect(await linhasDaAgenda(db)).toEqual([]);
    // O parâmetro é consumido e descartado: não persiste em refresh (spec).
    await expect(page).toHaveURL(/\/conta$/);
  });
});

test.describe("fluxo OAuth — só o nosso lado", () => {
  test("a rota de autorização redireciona ao Google com offline+consent e só calendar.events", async ({
    page,
  }) => {
    // `page.request` carrega os cookies do contexto (a sessão injetada pela
    // fixture), então isto exercita a guarda de sessão de verdade. `maxRedirects:
    // 0` é o que impede o teste de ir ao Google.
    const resposta = await page.request.get("/api/google/agenda/autorizar", {
      maxRedirects: 0,
    });
    expect(resposta.status()).toBe(307);

    const destino = new URL(resposta.headers()["location"]);
    expect(destino.origin + destino.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(destino.searchParams.get("access_type")).toBe("offline");
    expect(destino.searchParams.get("prompt")).toBe("consent");
    expect(destino.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/calendar.events",
    );
    const state = destino.searchParams.get("state");
    expect(state).toMatch(/^[0-9a-f]{32}$/);

    // O `state` sai em cookie httpOnly: é a prova de que ESTE navegador
    // começou o fluxo, e sem ela o callback recusa a volta.
    const cookie = (await page.context().cookies()).find(
      (c) => c.name === "contai-google-state",
    );
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.value).toBe(state);

    // E o segredo do cliente OAuth nunca viaja numa URL que vai para a barra de
    // endereço.
    expect(resposta.headers()["location"]).not.toContain("client_secret");
  });

  test("callback com state que não confere não grava nada e volta avisando", async ({
    page,
    db,
  }) => {
    const resposta = await page.request.get(
      "/api/google/agenda/callback?code=qualquer&state=state-inventado",
      { maxRedirects: 0 },
    );
    expect(resposta.status()).toBe(307);
    expect(resposta.headers()["location"]).toContain("/conta?google=falhou");
    // Concluir sem o `state` seria gravar credencial a partir de uma volta que
    // alguém montou.
    expect(await linhasDaAgenda(db)).toEqual([]);
  });

  test("callback com error=access_denied volta para o estado 2 sem gravar", async ({
    page,
    db,
  }) => {
    const resposta = await page.request.get(
      "/api/google/agenda/callback?error=access_denied",
      { maxRedirects: 0 },
    );
    expect(resposta.headers()["location"]).toContain("/conta?google=negado");
    expect(await linhasDaAgenda(db)).toEqual([]);
  });
});

test.describe("detalhe do compromisso — a linha do lembrete", () => {
  test("falha registrada acende a linha âmbar e NÃO vira pendência fiscal", async ({
    page,
    db,
  }) => {
    await conectarGoogle(db);
    const compromissoId = await agendamentoPix(db);
    await sincronizacaoDoCompromisso(db, compromissoId, {
      ultimo_erro: "criação do evento devolveu 503: backendError",
    });

    await page.goto(`/compromisso/${compromissoId}`);

    const linha = page.locator("[data-agenda-sincronizacao=falhou]");
    await expect(linha).toBeVisible();
    await expect(linha).toContainText(
      "Lembrete no Google Agenda: não sincronizado.",
    );
    await expect(linha.getByRole("button", { name: "tentar de novo" })).toBeVisible();

    /**
     * ⚠️ **CRITÉRIO 9 — a ressalva do `contador`, verificada no banco.**
     *
     * "Falha de sincronização de um compromisso específico **nunca** entra na
     * tabela `pendencia` fiscal do app, e **nunca** aparece nos relatórios
     * anuais nem no dossiê de venda."
     *
     * A tabela continua vazia, e a tela de pendências continua dizendo que não
     * há nada aberto. Esta é a asserção que separa "estado de integração
     * operacional" de "pendência fiscal" — e vale mais do que a ausência do
     * código: ela falha no dia em que alguém resolver "aproveitar a fila de
     * pendências, que já existe", e um lembrete que não saiu passar a bloquear
     * o relatório anual.
     */
    expect(await pendencias(db)).toEqual([]);
    await page.goto("/pendencias");
    await expect(page.locator("body")).not.toContainText("Google Agenda");
    await expect(page.locator("body")).not.toContainText("Lembrete");

    // E o card "O que isso muda hoje" continua com os três zeros literais: o
    // lembrete não entra em soma nenhuma.
    await page.goto(`/compromisso/${compromissoId}`);
    // O `<Passo>` é um `div` dentro do `Card`: subir um nível dá o card inteiro.
    // (`filter({hasText})` + `.last()` pegaria o próprio `<Passo>`, que contém
    // só o título.)
    const cardDoQueMuda = page
      .getByText("O que isso muda hoje", { exact: true })
      .locator("..");
    await expect(cardDoQueMuda).toContainText("Pendência fiscal gerada");
    await expect(cardDoQueMuda).toContainText("nenhuma");
  });

  test("sem integração conectada, a linha não aparece — nunca houve tentativa", async ({
    page,
    db,
  }) => {
    const compromissoId = await agendamentoPix(db);
    await sincronizacaoDoCompromisso(db, compromissoId, {
      ultimo_erro: "criação do evento devolveu 503: backendError",
    });

    await page.goto(`/compromisso/${compromissoId}`);
    await expect(page.locator("[data-agenda-sincronizacao]")).toBeHidden();
  });

  test("sincronização em dia não acende linha nenhuma", async ({ page, db }) => {
    await conectarGoogle(db);
    const data = maisDias(10);
    const compromissoId = await agendamentoPix(db, { data_prevista: data });
    await sincronizacaoDoCompromisso(db, compromissoId, {
      estado: "presente",
      data_sincronizada: data,
      situacao_sincronizada: "aberto",
      sincronizado_em: "2026-10-10T12:00:00Z",
      ultimo_erro: null,
    });

    await page.goto(`/compromisso/${compromissoId}`);
    await expect(page.locator("[data-agenda-sincronizacao]")).toBeHidden();
    // E o card de `/conta` concorda: nada pendente. É a MESMA régua
    // (`precisaSincronizar`) dos dois lados, de propósito.
    await page.goto("/conta");
    await expect(page.locator("[data-agenda-pendentes]")).toHaveAttribute(
      "data-agenda-pendentes",
      "0",
    );
  });

  test("agendamento QUITADO com evento ainda presente é o lembrete fantasma, e conta como pendente", async ({
    page,
    db,
  }) => {
    // Pre-mortem 3 do ticket: quitação por caminho alternativo que não disparou
    // a remoção. A reconciliação detecta pela divergência de situação.
    await conectarGoogle(db);
    const data = maisDias(10);
    const compromissoId = await agendamentoPix(db, { data_prevista: data });
    await sincronizacaoDoCompromisso(db, compromissoId, {
      estado: "presente",
      data_sincronizada: data,
      situacao_sincronizada: "aberto",
      sincronizado_em: "2026-10-10T12:00:00Z",
    });
    const { error } = await db
      .from("compromisso")
      .update({ situacao: "quitado" })
      .eq("id", compromissoId);
    expect(error).toBeNull();

    await page.goto("/conta");
    await expect(page.locator("[data-agenda-pendentes]")).toHaveAttribute(
      "data-agenda-pendentes",
      "1",
    );
  });
});

test.describe("a integração não pode vazar para o fiscal", () => {
  test("obra sem lembrete nenhum não muda a Home nem a agenda", async ({
    page,
    db,
  }) => {
    // Critério 5: sem autorização, criar e ver agendamento continua funcionando
    // normalmente — nada na tela muda, nada é bloqueado, nada avisa.
    const compromissoId = await agendamentoPix(db);
    await page.goto("/");
    await expect(page.locator("body")).toContainText("WK Construções");
    await expect(page.locator("body")).not.toContainText("Google Agenda");

    await page.goto(`/compromisso/${compromissoId}`);
    await expect(page.locator("body")).not.toContainText("Google Agenda");
    expect(await linhasDaAgenda(db)).toEqual([]);
    expect(OBRA_ID_SEED).toBeTruthy();
  });
});
