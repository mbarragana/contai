import {
  EMAIL_COLABORADOR,
  OBRA_ID_SEED,
  PREFIXO_CONTA_DE_TESTE,
  USER_ID_COLABORADOR,
  USER_ID_SEED,
} from "./ambiente";
import {
  colaboradores,
  contarColaboradoresSemRls,
  contasResolvidasSemRls,
  criarColaborador,
  criarObra,
  injetarSessao,
  obras,
  plantarConta,
  sessaoDoColaborador,
  visibilidadeNaObra,
  type Db,
} from "./banco";
import { expect, test } from "./fixtures";

/**
 * **CONTAI-093, critério 15 — os cinco cenários do colaborador.**
 *
 * ⚠️ **Nada de stub, em lugar nenhum**: Postgres local, duas sessões REAIS
 * (`entrar()` pelo fixture, para o Mateus; `sessaoDoColaborador()`, para o
 * engenheiro), as duas sujeitas à mesma RLS do app. É a regra dura de E2E do
 * projeto, e aqui ela é mais do que disciplina: o que este arquivo prova é
 * **policy**, e policy stubada é a afirmação de quem escreveu o teste.
 *
 * ⚠️ **Quatro dos cinco cenários não abrem tela nenhuma**, e isso é desenho, não
 * atalho. O que o critério 15 pede é a prova de que a RLS da migration 0030 faz
 * o que diz — "o colaborador vê a obra", "deixa de ver", "não escreve", "lê a
 * visibilidade certa de cada obra". Isso se mede no banco, com o client
 * autenticado de cada um; medir pela tela acrescentaria render e esconderia a
 * causa quando falhasse (uma lista vazia pode ser policy, carregamento ou
 * `useEffect`). O cenário (a) tem o par de tela, porque lá a pergunta também é
 * "o shell certo abre?".
 *
 * ⚠️ **A obra do seed é do MATEUS** (`USER_ID_SEED`), e o engenheiro nasce no
 * seed SEM vínculo nenhum — cada teste concede o acesso que vai exercitar.
 */

/** O vínculo do engenheiro na obra do seed, concedido pelo dono. */
async function concederAoEngenheiro(
  db: Db,
  visibilidade: "restrita" | "total" = "restrita",
) {
  return criarColaborador(db, {
    nome: "Engenheiro João",
    email: EMAIL_COLABORADOR,
    visibilidade,
  });
}

test.describe("(a) o colaborador vê a obra, e deixa de ver quando o acesso sai", () => {
  test("vínculo concedido → a obra aparece para ele; revogado → desaparece", async ({
    db,
  }) => {
    const vinculo = await concederAoEngenheiro(db);

    // ⚠️ O trigger `obra_colaborador_resolver_conta` (0030) resolveu a conta no
    // próprio INSERT: é o caso (a) do critério 11, e sem isto o resto do teste
    // provaria "vínculo pendente não dá acesso", que é outra coisa.
    expect(
      vinculo.colaborador_user_id,
      "a conta do engenheiro existe no seed: o vínculo tinha de nascer resolvido",
    ).toBe(USER_ID_COLABORADOR);

    const { db: dbEngenheiro } = await sessaoDoColaborador();
    const vistas = await obras(dbEngenheiro);
    expect(
      vistas.map((o) => o.id),
      "a policy `obra_select` da 0030 passa a devolver a obra ao colaborador",
    ).toEqual([OBRA_ID_SEED]);
    expect(await visibilidadeNaObra(dbEngenheiro, OBRA_ID_SEED)).toBe(
      "restrita",
    );

    // ── Revogação: `removido_em`, NUNCA delete (critério 3) ───────────────
    const { error } = await db
      .from("obra_colaborador")
      .update({ removido_em: new Date().toISOString() })
      .eq("id", vinculo.id);
    expect(error).toBeNull();

    expect(
      (await obras(dbEngenheiro)).map((o) => o.id),
      "revogado o acesso, a obra sai da leitura dele na requisição seguinte",
    ).toEqual([]);
    expect(
      await visibilidadeNaObra(dbEngenheiro, OBRA_ID_SEED),
      "`visibilidade_na_obra` devolve null para quem não é mais colaborador",
    ).toBeNull();

    // ⚠️ E a LINHA continua lá, com o nome: é dela que sai "criado por Fulano"
    // depois que a pessoa sai do projeto (critério 13). O colaborador segue
    // vendo o próprio vínculo removido — é o que faz `papelDaSessao` continuar
    // abrindo o shell dele em vez de oferecer "cadastre sua primeira obra".
    const dele = await colaboradores(dbEngenheiro);
    expect(dele.map((c) => [c.nome, c.removido_em !== null])).toEqual([
      ["Engenheiro João", true],
    ]);
  });

  test("o shell que abre é o do colaborador, nunca a gestão", async ({
    page,
    db,
  }) => {
    await concederAoEngenheiro(db);
    const { sessao } = await sessaoDoColaborador();
    // Substitui a sessão do Mateus que o fixture plantou: o shell é escolhido
    // por `papelDaSessao()`, que lê o banco com a identidade do cookie.
    await page.context().clearCookies();
    await injetarSessao(page, sessao);

    await page.goto("/colaborador");
    await expect(
      page.locator(`[data-obra-colaborador="${OBRA_ID_SEED}"]`),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Entrar nesta obra" }),
    ).toBeVisible();

    // ⚠️ **Ausência ESTRUTURAL** (critério 12): não é botão escondido. A casca
    // de `(colaborador)` não importa o `ShellDeGestao`, então não existe faixa,
    // sidebar, badge nem link para Visão geral / Despesas / Pendências.
    await expect(page.locator('[data-shell="faixa"]')).toHaveCount(0);
    for (const rotulo of ["Visão geral", "Despesas", "Pendências"]) {
      await expect(page.getByRole("link", { name: rotulo })).toHaveCount(0);
    }

    // "Entrar nesta obra" leva à tela (c) daquela obra — e exige o clique
    // mesmo com uma obra só (preferência de obra ativa nunca é auto-escolha).
    await page.getByRole("button", { name: "Entrar nesta obra" }).click();
    await expect(page).toHaveURL(new RegExp(`/colaborador/${OBRA_ID_SEED}$`));
    await expect(page.getByText("Nada a fazer ainda")).toBeVisible();
  });

  test("o DONO que cair na área do colaborador volta para a gestão", async ({
    page,
  }) => {
    // Critério 16, guarda inversa. A sessão do fixture é a do Mateus, que possui
    // a obra do seed — `papelDaSessao()` devolve 'dono'.
    await page.goto("/colaborador");
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("(b) a conta nasce DEPOIS do vínculo, e as duas ordens convergem", () => {
  const EMAIL_NOVO = `${PREFIXO_CONTA_DE_TESTE}novo@contai.local`;
  const ID_NOVO = "88888888-8888-4888-8888-888888888881";

  test("vínculo pendente liga sozinho quando a conta é criada", async ({
    db,
  }) => {
    const vinculo = await criarColaborador(db, {
      nome: "Ainda sem conta",
      email: EMAIL_NOVO,
      visibilidade: "restrita",
    });
    expect(
      vinculo.colaborador_user_id,
      "e-mail sem conta: o vínculo nasce PENDENTE (caso (b) do critério 11)",
    ).toBeNull();

    // O passo que em produção é do dashboard (Authentication → Users).
    plantarConta(EMAIL_NOVO, ID_NOVO);

    expect(
      contasResolvidasSemRls(EMAIL_NOVO),
      "o trigger `after insert` em auth.users liga o vínculo sem ação do app",
    ).toEqual([ID_NOVO]);
  });

  test("ordem inversa: a conta já existe → o vínculo nasce ativo", async ({
    db,
  }) => {
    plantarConta(EMAIL_NOVO, ID_NOVO);

    const vinculo = await criarColaborador(db, {
      nome: "Conta primeiro",
      email: EMAIL_NOVO,
      visibilidade: "total",
    });
    expect(
      vinculo.colaborador_user_id,
      "o trigger `before insert` resolve a conta pelo e-mail na hora",
    ).toBe(ID_NOVO);
  });

  test("o e-mail é normalizado: maiúscula e espaço não criam uma segunda pessoa", async ({
    db,
  }) => {
    plantarConta(EMAIL_NOVO, ID_NOVO);

    const vinculo = await criarColaborador(db, {
      nome: "Digitado torto",
      email: `  ${EMAIL_NOVO.toUpperCase()} `,
      visibilidade: "restrita",
    });
    expect(vinculo.email).toBe(EMAIL_NOVO);
    expect(
      vinculo.colaborador_user_id,
      "sem o `lower(btrim())` do trigger, o e-mail não casaria com a conta",
    ).toBe(ID_NOVO);
  });
});

test.describe("(c) o vínculo de uma obra não vaza para colaborador de outra", () => {
  test("colaborador da obra 2 não enxerga o vínculo da obra 1", async ({
    db,
  }) => {
    const EMAIL_OUTRO = `${PREFIXO_CONTA_DE_TESTE}outro@contai.local`;
    const ID_OUTRO = "88888888-8888-4888-8888-888888888882";
    plantarConta(EMAIL_OUTRO, ID_OUTRO);

    const obra2 = await criarObra(db, { nome: "Obra 2" });

    // O engenheiro na obra do seed; outra pessoa na obra 2.
    await concederAoEngenheiro(db);
    await criarColaborador(db, {
      obra_id: obra2,
      nome: "Pessoa da obra 2",
      email: EMAIL_OUTRO,
      visibilidade: "total",
    });

    const { db: dbEngenheiro } = await sessaoDoColaborador();
    const vistos = await colaboradores(dbEngenheiro);
    expect(
      vistos.map((c) => [c.obra_id, c.email]),
      "a policy de select devolve só o PRÓPRIO vínculo — nunca o do colega, " +
        "nunca o de outra obra",
    ).toEqual([[OBRA_ID_SEED, EMAIL_COLABORADOR]]);

    // E a obra alheia também não aparece.
    expect((await obras(dbEngenheiro)).map((o) => o.id)).toEqual([
      OBRA_ID_SEED,
    ]);
  });
});

test.describe("(d) conceder e alterar acesso é só do dono", () => {
  test("o colaborador não insere nem altera `obra_colaborador`", async ({
    db,
  }) => {
    const vinculo = await concederAoEngenheiro(db, "restrita");
    const { db: dbEngenheiro } = await sessaoDoColaborador();

    // ── INSERT: a policy exige ser dono da obra ──────────────────────────
    const insercao = await dbEngenheiro.from("obra_colaborador").insert({
      obra_id: OBRA_ID_SEED,
      nome: "Amigo do engenheiro",
      email: `${PREFIXO_CONTA_DE_TESTE}amigo@contai.local`,
      visibilidade: "total",
    });
    expect(
      insercao.error,
      "colaborador não convida colaborador: a policy de insert pede a obra",
    ).not.toBeNull();

    // ── UPDATE: ele se promoveria a "total" ──────────────────────────────
    //
    // ⚠️ **O PostgREST devolve 200 com ZERO linhas quando a RLS filtra** — não
    // devolve erro. É por isso que a asserção é sobre o ESTADO GRAVADO, lido de
    // volta pelo dono: um teste que só conferisse `error === null` passaria
    // aqui com a policy aberta. Foi a lição do `removerLinhaRetencao` (0017).
    const promocao = await dbEngenheiro
      .from("obra_colaborador")
      .update({ visibilidade: "total" })
      .eq("id", vinculo.id);
    expect(promocao.error).toBeNull();

    const depois = await colaboradores(db);
    expect(
      depois.map((c) => c.visibilidade),
      "o colaborador não muda a própria visibilidade",
    ).toEqual(["restrita"]);

    // Nem revoga o próprio vínculo (ou o de outro).
    await dbEngenheiro
      .from("obra_colaborador")
      .update({ removido_em: new Date().toISOString() })
      .eq("id", vinculo.id);
    expect((await colaboradores(db)).map((c) => c.removido_em)).toEqual([null]);

    // E o dono continua podendo — senão o teste acima provaria só que a tabela
    // está trancada para todos.
    const doDono = await db
      .from("obra_colaborador")
      .update({ visibilidade: "total" })
      .eq("id", vinculo.id);
    expect(doDono.error).toBeNull();
    expect((await colaboradores(db)).map((c) => c.visibilidade)).toEqual([
      "total",
    ]);
  });

  /**
   * **O FURO QUE O GATE 2 ACHOU, virado trava** (2026-10-15).
   *
   * A primeira versão da migration 0030 tinha `with check (exists (… from obra
   * …))` e nada mais. `user_id` tem `default auth.uid()`, mas **default não é
   * trava**: o PostgREST aceita a coluna no corpo do POST, e o dono conseguia
   * gravar um vínculo com `user_id` de OUTRA conta.
   *
   * ⚠️ **O estrago é pior do que "campo errado"**: a linha concede acesso de
   * verdade (o trigger resolve `colaborador_user_id` pelo e-mail, e a policy de
   * `obra` passa a devolver a obra àquela pessoa) e ao mesmo tempo DESAPARECE da
   * lista do dono, porque `obra_colaborador_select` filtra por `user_id =
   * auth.uid()`. É o Pre-mortem 1 do ticket com a mitigação desligada: o ticket
   * conta com "lista visível + remoção rápida" (critério 10), e não há remoção
   * rápida do que não aparece na lista.
   *
   * Sem este teste, a correção ficaria sendo uma linha de SQL que o próximo
   * refactor de policy pode desfazer sem nada ficar vermelho.
   */
  test("nem o DONO grava vínculo com `user_id` de outra conta", async ({
    db,
  }) => {
    // ⚠️ A conta alheia precisa EXISTIR: com um uuid inventado a recusa viria
    // da FK, e o teste ficaria verde provando "uuid inexistente não entra" —
    // que é outra coisa, e passaria com a policy aberta.
    const ALHEIO = plantarConta(
      `${PREFIXO_CONTA_DE_TESTE}alheio@contai.local`,
      "88888888-8888-4888-8888-888888888884",
    );

    const recusado = await db.from("obra_colaborador").insert({
      obra_id: OBRA_ID_SEED,
      user_id: ALHEIO,
      nome: "Vínculo órfão",
      email: EMAIL_COLABORADOR,
      visibilidade: "total",
    });
    expect(
      recusado.error,
      "`with check` tem de exigir `user_id = auth.uid()`: sem isso o acesso é " +
        "concedido e fica invisível na lista de quem concedeu",
    ).not.toBeNull();

    // E nada foi gravado — a asserção sobre o ESTADO, e não só sobre o erro:
    // `insert` sem `returning` é justamente como o furo passava despercebido,
    // e a linha órfã é invisível para o client do dono (é o furo inteiro).
    expect(contarColaboradoresSemRls()).toBe(0);

    // O mesmo pelo UPDATE: o dono não empurra um vínculo dele para outra conta.
    const vinculo = await concederAoEngenheiro(db);
    await db
      .from("obra_colaborador")
      .update({ user_id: ALHEIO })
      .eq("id", vinculo.id);
    expect(
      (await colaboradores(db)).map((c) => c.user_id),
      "o vínculo continua pertencendo a quem o concedeu",
    ).toEqual([USER_ID_SEED]);
  });
});

test.describe("(e) multi-obra — a correção da Emenda 2026-10-14", () => {
  test("o mesmo colaborador lê a visibilidade CERTA de cada obra", async ({
    db,
  }) => {
    const obra2 = await criarObra(db, { nome: "Obra 2" });

    await concederAoEngenheiro(db, "restrita");
    await criarColaborador(db, {
      obra_id: obra2,
      nome: "Engenheiro João",
      email: EMAIL_COLABORADOR,
      visibilidade: "total",
    });

    const { db: dbEngenheiro } = await sessaoDoColaborador();

    // ⚠️ **É ESTA A PROVA DIRETA DO CRITÉRIO 8.** Sem o filtro por `obra_id` na
    // função `visibilidade_na_obra`, o `limit 1` escolheria uma das duas linhas
    // e as duas chamadas devolveriam o MESMO valor — o bug latente que a Emenda
    // corrigiu antes de ele ser exercitado em produção.
    expect(await visibilidadeNaObra(dbEngenheiro, OBRA_ID_SEED)).toBe(
      "restrita",
    );
    expect(await visibilidadeNaObra(dbEngenheiro, obra2)).toBe("total");

    // E ele vê as DUAS obras — multi-obra é escopo desde a resposta do Mateus.
    expect((await obras(dbEngenheiro)).map((o) => o.id).sort()).toEqual(
      [OBRA_ID_SEED, obra2].sort(),
    );
  });

  test("duas obras na tela (b), cada uma com a própria ação de entrar", async ({
    page,
    db,
  }) => {
    const obra2 = await criarObra(db, { nome: "Obra 2" });
    await concederAoEngenheiro(db, "restrita");
    await criarColaborador(db, {
      obra_id: obra2,
      nome: "Engenheiro João",
      email: EMAIL_COLABORADOR,
      visibilidade: "total",
    });

    const { sessao } = await sessaoDoColaborador();
    await page.context().clearCookies();
    await injetarSessao(page, sessao);

    await page.goto("/colaborador");
    await expect(
      page.locator(`[data-obra-colaborador="${OBRA_ID_SEED}"]`),
    ).toBeVisible();
    await expect(
      page.locator(`[data-obra-colaborador="${obra2}"]`),
    ).toBeVisible();
    // Nenhum número fiscal nesta tela: nome e cidade, e nada mais (critério 12).
    await expect(page.getByText("12.345.67890/26")).toHaveCount(0);
  });

  test("vínculo pendente em DUAS obras resolve as DUAS quando a conta nasce", async ({
    db,
  }) => {
    const EMAIL_DUPLO = `${PREFIXO_CONTA_DE_TESTE}duplo@contai.local`;
    const ID_DUPLO = "88888888-8888-4888-8888-888888888883";
    const obra2 = await criarObra(db, { nome: "Obra 2" });

    for (const obra_id of [OBRA_ID_SEED, obra2]) {
      const vinculo = await criarColaborador(db, {
        obra_id,
        nome: "Convidado em duas",
        email: EMAIL_DUPLO,
        visibilidade: "restrita",
      });
      expect(vinculo.colaborador_user_id).toBeNull();
    }

    plantarConta(EMAIL_DUPLO, ID_DUPLO);

    // ⚠️ **AS DUAS, nunca só a primeira** — é a Emenda do critério 11. Um
    // trigger escrito com `limit 1` deixaria a segunda pendente para sempre,
    // sem erro, sem log e sem tela que mostrasse isso.
    expect(contasResolvidasSemRls(EMAIL_DUPLO)).toEqual([ID_DUPLO, ID_DUPLO]);
  });
});

test.describe("autoria — o invariante que as fatias 094/095 vão usar", () => {
  test("o registro nasce no acervo do DONO, com a autoria de quem digitou", async ({
    db,
  }) => {
    // Critério 7: `documento.user_id = obra.user_id` é invariante de BANCO
    // (trigger `user_id_da_obra`), não convenção de código. Nesta fatia quem
    // cadastra é só o Mateus, então as duas colunas coincidem — e é justamente
    // essa coincidência que o trigger garante continuar valendo quando o
    // colaborador começar a cadastrar, na `CONTAI-094`.
    const { data, error } = await db
      .from("documento")
      .insert({
        obra_id: OBRA_ID_SEED,
        tipo: "nf_material",
        arquivo_path: `${USER_ID_SEED}/documento/autoria.pdf`,
        valor: 100,
        destinatario_cpf_ok: true,
        status: "registrado",
      })
      .select("user_id, criado_por, pendente_revisao")
      .single();
    expect(error).toBeNull();
    expect(data!.user_id).toBe(USER_ID_SEED);
    expect(data!.criado_por).toBe(USER_ID_SEED);
    // ⚠️ A coluna gerada: `criado_por = user_id` ⇒ **não** é pendência de
    // revisão. É a metade que a leitura ingênua ("`revisado_em is null`")
    // erraria, tratando o acervo inteiro do dono como pendente (critério 6).
    expect(data!.pendente_revisao).toBe(false);
  });

  test("`criado_por` não pode ser reescrito depois de gravado", async ({
    db,
  }) => {
    const { data } = await db
      .from("documento")
      .insert({
        obra_id: OBRA_ID_SEED,
        tipo: "nf_material",
        arquivo_path: `${USER_ID_SEED}/documento/imutavel.pdf`,
        valor: 100,
        destinatario_cpf_ok: true,
        status: "registrado",
      })
      .select("id")
      .single();

    // Pre-mortem 3 do ticket: o rastro de autoria sobrevive a qualquer UPDATE
    // futuro, por trigger — não por disciplina de quem escreve o próximo código.
    const { error } = await db
      .from("documento")
      .update({ criado_por: USER_ID_COLABORADOR })
      .eq("id", data!.id);
    expect(
      error?.message ?? "",
      "o trigger `criado_por_imutavel` tem de recusar a reescrita",
    ).toContain("criado_por");
  });
});
