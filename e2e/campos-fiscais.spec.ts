import { readdirSync } from "node:fs";
import { join } from "node:path";

import { expect as expectBase, type Page } from "@playwright/test";

import { lerTodosOsSpecs } from "../lib/design/specs";
import type { CampoDoSpec } from "../lib/design/campos-do-spec";
import { OBRA_ID_SEED } from "./ambiente";
import { criarCompromisso, criarFavorecido, type Db } from "./banco";
import { expect, test } from "./fixtures";

/**
 * CONTAI-034 — metade 2 da trava: a TELA obedece ao que o spec declara.
 *
 * A metade 1 é `lib/design/campos-do-spec.test.ts`, que garante que o
 * `## Campos` dos mocks é legível por máquina. Aqui os dois lados se encontram:
 * o `data-campo="<id do spec>"` de cada controle contra a linha do spec com o
 * mesmo id.
 *
 * ── POR QUE ESTE ARQUIVO EXISTE ──────────────────────────────────────────
 *
 * D44: `useState(hojeIso)` e `useState("pix")` em `/adicionar/pagamento`
 * contradiziam o mock aprovado, foram para produção e ficaram lá CINCO DIAS.
 * Quem achou foi o `po`, lendo — nenhum gate pegou. A data escolhe o
 * ano-calendário e, por `decidirRegistro`, escolhe a ENTIDADE
 * (pagamento × compromisso); o meio pré-selecionado tornava a `RECUSA_CARTAO`
 * inalcançável pela inação.
 *
 * O desenho copia `privilegios.spec.ts`, a resposta ao incidente de
 * 2026-08-17: compara o mapa REAL com o DECLARADO, e o que nasce fora do mapa
 * deixa a suíte vermelha COM O NOME. Lá era tabela sem `GRANT`; aqui é rota sem
 * classificação e campo nascendo preenchido.
 *
 * ── O QUE ESTE TESTE PROVA, E O QUE NÃO PROVA ────────────────────────────
 *
 * PROVA, nas rotas visitadas:
 * 1. todo controle dentro do `<main>` tem `data-campo` — sem ele, vermelho com
 *    o rótulo do controle;
 * 2. todo `data-campo` está declarado em algum spec da rota;
 * 3. todo campo `SEM DEFAULT` nasce vazio / sem escolha;
 * 4. todo id declarado como INICIAL está no DOM no instante em que a tela
 *    nasce (é o "fecha nos dois sentidos" do critério 2).
 *
 * NÃO PROVA — falso negativo assumido, igual ao `privilegios.spec.ts`, que só
 * confere tabela que existe:
 * - **rota não visitada** (`foraDaVisita`): a classificação dela é declarada,
 *   o comportamento não é conferido. A lista está abaixo, com motivo, e o
 *   teste de cobertura imprime quantas são;
 * - **estado que a suíte não alcança**: campo condicional só é conferido
 *   quando está presente (critério 9) — `cEncargos` só existe com pago >
 *   previsto, e este teste não chega lá;
 * - **a família inteira das escolhas feitas com `<Botao>`/cartão tocável**, e
 *   não com controle de formulário — a enumeração vê `input`/`select`/
 *   `textarea` e `fieldset[data-campo]`, e botão nenhum. São quatro, todas
 *   declaradas SEM DEFAULT — campo fiscal no spec e **nenhuma** conferida
 *   aqui:
 *     · `escolhaMenor`   — CONTAI-019, `/compromisso/[id]/confirmar`
 *     · `obraDestino`    — CONTAI-008 e CONTAI-021, em `/pagamento/[id]/obra`
 *                          e `/documento/[id]/obra`
 *     · `escolhaDoc[d]`  — CONTAI-008, por documento vinculado
 *     · `escolhaPag[p]`  — CONTAI-021, por pagamento vinculado
 *   Dar `data-campo` a elas é redesenho de componente (o botão vira grupo com
 *   estado marcável), não ajuste deste teste — e é por isso que ficam aqui
 *   escritas em vez de caladas.
 * - **violação VIVA e conhecida**: `unidades_autonomas` (state
 *   `unidadesAutonomas`) nasce `"1"` em `app/obras/_campos.tsx`
 *   (`ESTADO_VAZIO`), e o CONTAI-003 declara o campo SEM DEFAULT — campo
 *   fiscal (>1 dispara o aviso de equiparação). O campo só
 *   existe no PASSO 4 do assistente de `/obras/nova`, e a visita aqui é só do
 *   passo 1 — logo, esta suíte fica VERDE com a violação de pé. O ticket é de
 *   provar, não de consertar; o conserto é ticket próprio.
 *
 * ⚠️ Verde aqui **não** quer dizer "todos os campos do app conferidos".
 */

// ── O MAPA ────────────────────────────────────────────────────────────────

interface RotaComCampos {
  /** Os specs de `design/mocks/` que governam esta tela. */
  specs: string[];
  /**
   * Os ids que EXISTEM no instante em que a tela nasce. É a lista que fecha o
   * critério 2 no outro sentido: id daqui que não aparece no DOM fica
   * vermelho com o nome dele. Campo condicional NÃO entra aqui — ele é
   * conferido só quando aparece (critério 9).
   */
  iniciais: string[];
  /** Abre a rota (e monta o cenário que ela exige). Devolve a URL. */
  abrir?: (db: Db) => Promise<string>;
  /** Por que esta rota não é visitada nesta rodada. Cobertura, não exceção. */
  foraDaVisita?: string;
}

type Classificacao = RotaComCampos | { semCamposFiscais: string };

/**
 * TODA rota de `app/**​/page.tsx` aparece aqui. Rota nova sem linha própria
 * deixa a suíte vermelha com o caminho dela — é a propriedade que fez o
 * `privilegios.spec.ts` escalar, e é o critério 8.
 *
 * "Não tem campo fiscal" é classificação legítima e exige o motivo escrito.
 */
const MAPA: Record<string, Classificacao> = {
  // ── Captura: onde a D44 nasceu ────────────────────────────────────────
  "/adicionar/pagamento": {
    specs: ["CONTAI-032"],
    iniciais: [
      "meio",
      "favorecido",
      "favorecidoDocumento",
      "fData",
      "fValor",
      "comprovante",
    ],
    abrir: async () => "/adicionar/pagamento",
  },
  "/adicionar/documento": {
    specs: ["CONTAI-001", "CONTAI-004", "CONTAI-018", "CONTAI-038"],
    iniciais: [
      "arquivo",
      "tipo",
      "emitente",
      "cnpj",
      "valor",
      "classificacao",
      "nota_no_seu_cpf",
      "jaPaguei",
    ],
    abrir: async () => "/adicionar/documento",
  },
  "/adicionar/compra-cartao": {
    specs: ["CONTAI-022"],
    // Só o gate do parcelamento nasce: o resto do formulário só existe depois
    // de "À vista" (é o desenho do CONTAI-022, decisão 1).
    iniciais: ["parc"],
    abrir: async () => "/adicionar/compra-cartao",
  },

  // ── Ciclo do agendamento (CONTAI-019) ─────────────────────────────────
  "/compromisso/[id]/confirmar": {
    specs: ["CONTAI-019"],
    iniciais: ["cData", "cValor", "comprovante"],
    abrir: async (db) => `/compromisso/${await umCompromisso(db)}/confirmar`,
  },
  "/compromisso/[id]/cancelar": {
    specs: ["CONTAI-019"],
    iniciais: ["fMotivo"],
    abrir: async (db) => `/compromisso/${await umCompromisso(db)}/cancelar`,
  },
  "/compromisso/[id]/data": {
    specs: ["CONTAI-019"],
    iniciais: ["fNovaData"],
    abrir: async (db) => `/compromisso/${await umCompromisso(db)}/data`,
  },

  // ── Obra e terreno ────────────────────────────────────────────────────
  "/obras/nova": {
    specs: ["CONTAI-003", "CONTAI-010"],
    // Passo 1 do assistente. CNO, terreno e premissas são passos seguintes.
    // ⚠️ **ESTA ROTA ESCONDE UMA VIOLAÇÃO VIVA, e o verde aqui não a
    // desmente**: `unidades_autonomas` (state `unidadesAutonomas`) nasce
    // `"1"` (`ESTADO_VAZIO` de `app/obras/_campos.tsx`) contra o SEM
    // DEFAULT — campo fiscal do CONTAI-003. O campo mora no PASSO 4, e a
    // visita abaixo é do passo 1 —
    // chegar lá exige clicar "Continuar", que já não é "o instante em que a
    // tela nasce". Fica nomeada aqui e no bloco NÃO PROVA para que ninguém
    // leia esta linha verde como "os campos de obra estão conferidos".
    iniciais: [
      "nome_obra",
      "municipio",
      "matricula_imovel",
      "cartorio_registro",
      "data_inicio_obra",
    ],
    abrir: async () => "/obras/nova",
  },
  "/obras/[id]/terreno/desembolsos": {
    specs: ["CONTAI-025", "CONTAI-027", "CONTAI-010"],
    // Data e papéis só aparecem depois de "Já saiu da conta".
    iniciais: ["fTipo", "fValor", "fEstado"],
    abrir: async () => `/obras/${OBRA_ID_SEED}/terreno/desembolsos`,
  },

  // ── Home: sem campo próprio, mas hospeda a pergunta do CONTAI-027 ─────
  "/": {
    specs: ["CONTAI-027"],
    // Nenhum campo nasce: a pergunta "quando esse dinheiro saiu" só existe
    // com desembolso pendente de datas, e a home sem pendência não tem
    // controle nenhum.
    iniciais: [],
    abrir: async () => "/",
  },

  // ── Login ─────────────────────────────────────────────────────────────
  "/entrar": {
    specs: ["CONTAI-002"],
    iniciais: ["email", "senha"],
    // Sem `abrir`: a rota exige AUSÊNCIA de sessão e roda no bloco próprio,
    // com `test.use({ sessao: false })`.
    foraDaVisita: "visitada no bloco sem sessão, logo abaixo",
  },

  // ── Telas de leitura e de navegação: sem campo, com o motivo ──────────
  "/adicionar": { semCamposFiscais: "menu de duas opções, só links" },
  "/compromisso": { semCamposFiscais: "lista de agendados, só leitura" },
  "/compromisso/[id]": {
    semCamposFiscais: "detalhe do agendamento; as ações são links para as três telas de resposta",
  },
  "/conta": { semCamposFiscais: "resumo da conta + sair; nenhum campo" },
  "/documento/[id]/cnpj-errado": {
    semCamposFiscais: "explica por que CNPJ não se edita e oferece saídas — só texto e links",
  },
  "/documento/[id]/desligar": {
    semCamposFiscais: "confirmação de desfazer vínculo: dois botões, nenhum campo",
  },
  // ⚠️ **NÃO são "sem campos fiscais"** (correção do Gate 2): as duas telas
  // pedem `obraDestino`, declarado SEM DEFAULT — campo fiscal, e mais uma
  // escolha por registro vinculado. Elas ficam fora da VISITA porque a escolha
  // é cartão tocável (`<Botao>`), invisível para a enumeração — não porque não
  // tenham campo. Classificar como "sem campos" era o mapa contradizendo o
  // spec, que é o erro que este arquivo existe para impedir.
  "/documento/[id]/obra": {
    specs: ["CONTAI-021"],
    iniciais: [],
    foraDaVisita:
      "escolha por cartão, fora do alcance da enumeração — `obraDestino` e `escolhaPag[p]` são botões, não controles de formulário",
  },
  "/documento/[id]/outro-dado": {
    semCamposFiscais: "índice das correções possíveis, só links",
  },
  "/fatura/[id]": { semCamposFiscais: "detalhe da fatura, só leitura e links" },
  "/obras": { semCamposFiscais: "lista de obras, só leitura" },
  "/obras/[id]/discriminacao/[ano]": {
    semCamposFiscais: "texto anual da ficha Bens e Direitos, só leitura",
  },
  "/obras/[id]/notas-sem-cno": {
    semCamposFiscais: "lista das notas emitidas sem CNO, só leitura",
  },
  "/pagamento/[id]/obra": {
    specs: ["CONTAI-008"],
    iniciais: [],
    foraDaVisita:
      "espelho de `/documento/[id]/obra`: escolha por cartão, fora do alcance da enumeração — `obraDestino` e `escolhaDoc[d]` são botões",
  },
  "/pendencias": { semCamposFiscais: "lista de pendências, só leitura" },
  // ⚠️ CONTAI-040: a rota nasce sem a tabela (que é do CONTAI-041) — hoje é o
  // aviso do que falta mais a lista de despesas comprovadas, sem um controle.
  "/despesas": {
    semCamposFiscais: "lista de despesas comprovadas + aviso; nenhum campo",
  },

  // ── Classificadas, ainda não visitadas ────────────────────────────────
  // Cada linha diz o que a suíte deixa de conferir. É cobertura declarada,
  // não exceção à regra: nenhuma delas dispensa `data-campo` nem autoriza
  // default.
  "/documento/[id]": {
    specs: ["CONTAI-038"],
    iniciais: [],
    foraDaVisita:
      "o formulário de linha de retenção nasce dentro de um documento com NF de serviço e gate respondido — cenário de várias etapas",
  },
  "/documento/[id]/anexar": {
    specs: ["CONTAI-033", "CONTAI-038"],
    iniciais: [],
    foraDaVisita:
      "exige documento gravado SEM arquivo; a repergunta em branco só aparece depois de escolher o arquivo",
  },
  "/documento/[id]/corrigir/classificacao": {
    specs: ["CONTAI-021"],
    iniciais: [],
    foraDaVisita: "correção de documento — cenário do CONTAI-021, coberto por `correcao.spec.ts` no comportamento",
  },
  "/documento/[id]/corrigir/emitente": {
    specs: ["CONTAI-021"],
    iniciais: [],
    foraDaVisita: "idem `corrigir/classificacao`",
  },
  "/documento/[id]/corrigir/valor": {
    specs: ["CONTAI-021"],
    iniciais: [],
    foraDaVisita: "idem `corrigir/classificacao`",
  },
  "/documento/[id]/ligar": {
    specs: ["CONTAI-018"],
    iniciais: [],
    foraDaVisita: "a lista de candidatos exige pagamentos já gravados na mesma obra",
  },
  "/pagamento/[id]": {
    specs: ["CONTAI-009", "CONTAI-019"],
    iniciais: [],
    foraDaVisita:
      "tela de leitura; o único campo é o `cSaldoData` da sugestão de quitação, que só aparece com agendamento parecido",
  },
  "/pagamento/[id]/ligar": {
    specs: ["CONTAI-018"],
    iniciais: [],
    foraDaVisita: "espelho de `/documento/[id]/ligar`",
  },
  "/fatura/[id]/alocar": {
    specs: ["CONTAI-022"],
    iniciais: [],
    foraDaVisita: "exige fatura com compras e pagamento parcial já gravado",
  },
  "/fatura/[id]/confirmar": {
    specs: ["CONTAI-022"],
    iniciais: [],
    foraDaVisita: "exige fatura com compras",
  },
  "/fatura/[id]/parcial": {
    specs: ["CONTAI-022"],
    iniciais: [],
    foraDaVisita: "exige fatura com compras",
  },
  "/obras/[id]": {
    specs: ["CONTAI-003", "CONTAI-010"],
    iniciais: [],
    foraDaVisita:
      "edição dos dados da obra: os mesmos campos de `/obras/nova`, mas NASCENDO PREENCHIDOS com o que está gravado — é o caso em que 'nasce vazio' não se aplica, e o desenho de como conferir isso é ticket próprio",
  },
  "/obras/[id]/terreno": {
    specs: ["CONTAI-027"],
    iniciais: [],
    foraDaVisita: "resumo do terreno; só hospeda a pergunta `quando` quando há desembolso pendente",
  },
  "/obras/[id]/terreno/financiamento": {
    specs: ["CONTAI-010"],
    iniciais: [],
    foraDaVisita: "cadastro do financiamento — cenário do CONTAI-010, coberto por `terreno.spec.ts`",
  },
  "/obras/[id]/terreno/informe/[anoBase]": {
    specs: ["CONTAI-010"],
    iniciais: [],
    foraDaVisita: "exige financiamento cadastrado antes",
  },
  "/pendencias/[id]": {
    specs: ["CONTAI-021"],
    iniciais: [],
    foraDaVisita: "baixa de pendência: exige a pendência aberta pelo caminho que a cria",
  },
};

/**
 * Exceção nomeada, com proveniência — o mesmo formato da exceção do DELETE no
 * E2E (2026-08-17). Hoje está **vazia**, e isso é informação: nenhum campo do
 * app precisou de licença para nascer preenchido.
 *
 * ⚠️ **Campo com `SEM DEFAULT` no spec não pode entrar aqui** (critério 6). O
 * teste abaixo recusa, e é de propósito: mapa escrito à mão é escape hatch
 * exatamente para quem a trava existe. Default legítimo se declara na LINHA DO
 * SPEC (`DEFAULT DECLARADO: <razão>`), onde quem desenha a tela o vê.
 */
const EXCECOES: { rota: string; campo: string; motivo: string; proveniencia: string }[] =
  [];

// ── Enumeração das rotas do filesystem ────────────────────────────────────

// Mesma razão de `lib/design/specs.ts`: o spec roda como CommonJS.
const RAIZ = process.cwd();

/** `app/obras/[id]/page.tsx` → `/obras/[id]`. */
function rotasDoFilesystem(): string[] {
  const achadas: string[] = [];
  const andar = (dir: string, rota: string) => {
    for (const entrada of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
      if (entrada.isDirectory()) {
        // `_components` e afins são pastas privadas do Next: não viram rota.
        if (entrada.name.startsWith("_")) continue;
        // ⚠️ CONTAI-040: `(gestao)` e `(captura)` são ROUTE GROUPS — organizam
        // a árvore e escolhem a casca, mas não entram na URL. Sem esta linha o
        // mapa passaria a cobrar rotas que não existem ("/(gestao)/despesas").
        const ehGrupo = /^\(.+\)$/.test(entrada.name);
        andar(
          join(dir, entrada.name),
          ehGrupo ? rota : `${rota}/${entrada.name}`,
        );
      } else if (entrada.name === "page.tsx") {
        achadas.push(rota === "" ? "/" : rota);
      }
    }
  };
  andar("app", "");
  return achadas.sort();
}

// ── Leitura do DOM ────────────────────────────────────────────────────────

interface ControleNaTela {
  campo: string | null;
  /** Como nomear o controle na mensagem de falha quando não há `data-campo`. */
  rotulo: string;
  tipo: string;
  preenchido: boolean;
}

/**
 * Os controles dentro do `<main>` — a região de formulário do app (não existe
 * elemento `<form>`: o "Salvar" é um `onClick`, nunca um submit).
 *
 * Um grupo de rádio conta como UM controle, pelo `fieldset[data-campo]` que o
 * `Escolha` renderiza: "nasce sem default" ali quer dizer nenhum rádio marcado.
 */
async function controlesDaTela(page: Page): Promise<ControleNaTela[]> {
  return page.locator("main").evaluate((main) => {
    const nomeDe = (el: Element): string => {
      const id = el.getAttribute("id");
      const porFor = id
        ? main.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`)
        : null;
      const texto =
        porFor?.textContent ??
        el.closest("label")?.textContent ??
        el.closest("fieldset")?.querySelector("legend")?.textContent ??
        el.getAttribute("aria-label") ??
        el.getAttribute("name") ??
        "";
      return texto.trim().replace(/\s+/g, " ").slice(0, 60) || "(sem rótulo)";
    };

    const achados: ControleNaTela[] = [];
    const jaVistos = new Set<Element>();

    for (const grupo of Array.from(
      main.querySelectorAll("fieldset[data-campo]"),
    )) {
      const radios = Array.from(
        grupo.querySelectorAll('input[type="radio"], input[type="checkbox"]'),
      ) as HTMLInputElement[];
      radios.forEach((r) => jaVistos.add(r));
      achados.push({
        campo: grupo.getAttribute("data-campo"),
        rotulo: grupo.querySelector("legend")?.textContent?.trim() ?? "(grupo)",
        tipo: "escolha",
        preenchido: radios.some((r) => r.checked),
      });
    }

    for (const el of Array.from(
      main.querySelectorAll("input, select, textarea"),
    ) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[]) {
      if (jaVistos.has(el)) continue;
      const tipo = el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase();
      if (tipo === "hidden") continue;
      const preenchido =
        el instanceof HTMLInputElement && (tipo === "checkbox" || tipo === "radio")
          ? el.checked
          : el instanceof HTMLInputElement && tipo === "file"
            ? (el.files?.length ?? 0) > 0
            : el.value !== "";
      achados.push({
        campo: el.getAttribute("data-campo"),
        rotulo: nomeDe(el),
        tipo,
        preenchido,
      });
    }

    return achados;
  });
}

/** Os campos que os specs da rota declaram, por id. */
function declaradosDe(rota: RotaComCampos): Map<string, CampoDoSpec[]> {
  const porId = new Map<string, CampoDoSpec[]>();
  for (const lido of lerTodosOsSpecs()) {
    if (!rota.specs.includes(lido.spec)) continue;
    for (const campo of lido.campos) {
      porId.set(campo.id, [...(porId.get(campo.id) ?? []), campo]);
    }
  }
  return porId;
}

/**
 * ⚠️ Dois specs governando a mesma tela podem discordar sobre um id (o `meio`
 * do CONTAI-019 × o do CONTAI-032). **`SEM DEFAULT` vence**, sempre: é a mesma
 * doutrina do critério 6 — o marcador mais estrito é o que fica de pé.
 */
const exigeVazio = (declaracoes: CampoDoSpec[]) =>
  declaracoes.some((d) => d.semDefault);

/**
 * A tela "no instante em que nasce": esperado o primeiro render pronto (os
 * campos iniciais presentes), sem tocar em nada. Rota sem campo inicial espera
 * o `<main>` existir e o carregamento passar.
 */
async function esperarNascer(page: Page, iniciais: string[]) {
  if (iniciais.length > 0) {
    await page
      .locator(`[data-campo="${iniciais[0]}"]`)
      .waitFor({ state: "attached" });
    return;
  }
  await page.locator("main").waitFor();
  await expectBase(page.getByText("Carregando", { exact: false })).toHaveCount(0);
}

async function umCompromisso(db: Db): Promise<string> {
  const favorecidoId = await criarFavorecido(db, {
    nome: "AJE Construções",
    documento: "11222333000181",
    tipo: "pj",
  });
  return criarCompromisso(db, {
    favorecido_id: favorecidoId,
    valor_previsto: 5000,
    // Vencido, para a tela de confirmar nascer no estado normal de resposta.
    data_prevista: "2026-09-10",
    origem: "boleto",
  });
}

// ── Os testes ─────────────────────────────────────────────────────────────

test.describe("campos fiscais nascem como o spec declara", () => {
  test("toda rota de app/**/page.tsx está classificada no mapa", () => {
    const doDisco = rotasDoFilesystem();
    const noMapa = Object.keys(MAPA).sort();
    expect(
      doDisco,
      "rota fora do mapa de campos fiscais: ou ela declara os campos dela " +
        "(`specs` + `iniciais`), ou declara `semCamposFiscais` com o motivo. " +
        "Tela nova sem classificação nasce invisível para a trava de default — " +
        "foi assim que a D44 ficou cinco dias em produção",
    ).toEqual(noMapa);
  });

  test("todo spec citado pelo mapa existe e declara os ids citados", () => {
    const specs = new Set(lerTodosOsSpecs().map((s) => s.spec));
    for (const [rota, classificacao] of Object.entries(MAPA)) {
      if ("semCamposFiscais" in classificacao) continue;
      for (const spec of classificacao.specs) {
        expect(specs.has(spec), `${rota} cita o spec inexistente ${spec}`).toBe(
          true,
        );
      }
      const declarados = declaradosDe(classificacao);
      for (const id of classificacao.iniciais) {
        expect(
          declarados.has(id),
          `${rota} diz que \`${id}\` nasce na tela, mas nenhum spec de ` +
            `${classificacao.specs.join(", ")} declara esse id`,
        ).toBe(true);
      }
    }
  });

  test("⛔ exceção do mapa não salva campo com SEM DEFAULT no spec", () => {
    for (const excecao of EXCECOES) {
      const classificacao = MAPA[excecao.rota];
      expect(classificacao, `exceção para rota fora do mapa: ${excecao.rota}`).
        toBeDefined();
      if ("semCamposFiscais" in classificacao) {
        throw new Error(
          `exceção em rota classificada sem campos: ${excecao.rota}`,
        );
      }
      expect(excecao.proveniencia.length, "exceção sem proveniência").
        toBeGreaterThan(0);
      const declaracoes = declaradosDe(classificacao).get(excecao.campo) ?? [];
      expect(
        exigeVazio(declaracoes),
        `\`${excecao.campo}\` está como SEM DEFAULT no spec: nenhuma ` +
          "justificativa no mapa vale. Se o default é legítimo, ele se declara " +
          "na LINHA DO SPEC com `DEFAULT DECLARADO: <razão>`",
      ).toBe(false);
    }
  });

  test("cobertura: quantas rotas com campo fiscal a suíte realmente abre", () => {
    const comCampos = Object.values(MAPA).filter(
      (c): c is RotaComCampos => !("semCamposFiscais" in c),
    );
    const visitadas = comCampos.filter((c) => c.abrir !== undefined);
    // Não é uma meta: é o número que impede alguém de ler "verde" como
    // "todos os campos do app conferidos" (Pre-mortem 3).
    expect(visitadas.length).toBeGreaterThanOrEqual(9);
    for (const fora of comCampos.filter((c) => c.abrir === undefined)) {
      expect(fora.foraDaVisita, "rota não visitada sem motivo escrito").
        toBeTruthy();
    }
  });

  for (const [rota, classificacao] of Object.entries(MAPA)) {
    if ("semCamposFiscais" in classificacao || !classificacao.abrir) continue;
    const abrir = classificacao.abrir;

    test(`${rota} — nenhum campo nasce preenchido`, async ({ page, db }) => {
      await page.goto(await abrir(db));
      await esperarNascer(page, classificacao.iniciais);

      const controles = await controlesDaTela(page);
      const declarados = declaradosDe(classificacao);

      // 1. Todo controle carrega `data-campo`.
      const semElo = controles.filter((c) => c.campo === null);
      expect(
        semElo.map((c) => `${c.tipo} "${c.rotulo}"`),
        `controle sem \`data-campo\` em ${rota}: ele não existe para a trava ` +
          "— acrescente o id do spec do mock (`campo=\"<id>\"`)",
      ).toEqual([]);

      // 2. Todo `data-campo` está declarado por algum spec da rota.
      const naoDeclarados = controles
        .map((c) => c.campo!)
        .filter((id) => !declarados.has(id));
      expect(
        [...new Set(naoDeclarados)],
        `campo na tela e em spec nenhum (${classificacao.specs.join(", ")}): ` +
          "ou o id está errado, ou o `## Campos` do mock não declarou o campo",
      ).toEqual([]);

      // 3. `SEM DEFAULT` nasce vazio. É a D44.
      const nasceramPreenchidos = controles
        .filter((c) => c.preenchido && exigeVazio(declarados.get(c.campo!) ?? []))
        .map((c) => c.campo!);
      expect(
        [...new Set(nasceramPreenchidos)],
        "campo declarado SEM DEFAULT nasceu preenchido — o app está " +
          "afirmando um fato que ninguém conferiu (foi a D44: a data do " +
          "pagamento decide o ano-calendário E a entidade que nasce)",
      ).toEqual([]);

      // 4. Os iniciais estão no DOM (critério 2, no outro sentido).
      const presentes = new Set(controles.map((c) => c.campo));
      expect(
        classificacao.iniciais.filter((id) => !presentes.has(id)),
        "campo declarado no spec e ausente do DOM no instante em que a tela " +
          "nasce: ou o `data-campo` sumiu, ou o campo deixou de ser inicial",
      ).toEqual([]);
    });
  }
});

/**
 * As telas classificadas COMO SEM CAMPO, conferidas de verdade onde dá para
 * abrir sem cenário. "Não tem campo" escrito no mapa é afirmação — e afirmação
 * não conferida é o que este ticket combate.
 */
test.describe("telas declaradas sem campo fiscal não têm controle nenhum", () => {
  for (const rota of [
    "/adicionar",
    "/compromisso",
    "/conta",
    "/obras",
    "/pendencias",
  ]) {
    test(`${rota} não tem controle de formulário`, async ({ page }) => {
      await page.goto(rota);
      await page.locator("main").waitFor();
      const controles = await controlesDaTela(page);
      expect(
        controles.map((c) => `${c.tipo} "${c.rotulo}"`),
        `${rota} está no mapa como "sem campos fiscais" e tem controle na ` +
          "tela: reclassifique a rota",
      ).toEqual([]);
    });
  }
});

/** `/entrar` só existe sem sessão — com sessão o app leva para a home. */
test.describe("login", () => {
  test.use({ sessao: false });

  test("/entrar — e-mail e senha nascem vazios", async ({ page }) => {
    const classificacao = MAPA["/entrar"] as RotaComCampos;
    await page.goto("/entrar");
    await esperarNascer(page, classificacao.iniciais);

    const controles = await controlesDaTela(page);
    const declarados = declaradosDe(classificacao);

    expect(controles.filter((c) => c.campo === null).map((c) => c.rotulo)).toEqual(
      [],
    );
    expect(
      controles.filter((c) => !declarados.has(c.campo!)).map((c) => c.campo),
    ).toEqual([]);
    expect(
      controles
        .filter((c) => c.preenchido && exigeVazio(declarados.get(c.campo!) ?? []))
        .map((c) => c.campo),
    ).toEqual([]);
  });
});
