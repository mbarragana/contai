/**
 * O parser da seção `## Campos` dos specs de `design/mocks/*.md`.
 *
 * ⚠️ **ISTO NÃO É CÓDIGO DE PRODUTO.** Nada em `app/` importa este arquivo: ele
 * existe para o teste do CONTAI-034 (`lib/design/campos-do-spec.test.ts` e
 * `e2e/campos-fiscais.spec.ts`) cruzar o que o spec DECLARA com o que a tela
 * FAZ. Mora em `lib/` só porque é o único diretório que o Vitest e o Playwright
 * enxergam igual.
 *
 * ── O CONTRATO (v1) ───────────────────────────────────────────────────────
 *
 * O formato tabular do `## Campos` é **contrato versionado**, não convenção
 * (CONTAI-034, critério 5). Ele está escrito aqui, e a gramática abaixo é a
 * única fonte: spec que diverge fica VERMELHO com arquivo:linha, nunca é
 * ignorado (critério 4).
 *
 * Dentro de `## Campos` (até o próximo `## `), toda linha não vazia é uma de:
 *
 * 1. `### <texto>`            — subtítulo, agrupa as entradas seguintes
 * 2. `- <entrada>`            — entrada de campo, na coluna 0
 * 3. linha indentada (2+ esp) — continuação da entrada anterior
 * 4. qualquer outra coisa     — ERRO
 *
 * Uma **entrada** é uma destas três formas:
 *
 *   - `<id>`[, `<id>`…] ["<rótulo na tela>"] [(<âncora>)] — <resto>
 *   - NÃO É CONTROLE — <texto>
 *   - SEM CAMPOS — <justificativa>
 *
 * O id vem **sempre em crase e sempre primeiro**: é ele que o
 * `data-campo="<id>"` da tela repete, e é por ele que os dois lados se cruzam.
 * Rótulo entre aspas e âncora entre parênteses são opcionais e decorativos.
 *
 * E toda entrada de campo declara **como ela nasce**, com exatamente um destes
 * marcadores no `<resto>` (`**negrito**` ao redor é indiferente):
 *
 *   SEM DEFAULT            — nasce vazia / sem escolha. É a trava.
 *   DEFAULT DECLARADO: …   — nasce preenchida, de propósito, com a razão junto
 *   SOMENTE LEITURA        — não é editável; não há o que nascer
 *
 * `campo fiscal` (ou `campos fiscais`) marca a entrada cuja resposta decide
 * consequência fiscal.
 *
 * ── POR QUE FAIL-CLOSED ───────────────────────────────────────────────────
 *
 * "Parser que ignora o que não entende é a D44 de novo: o spec deriva para
 * prosa e a trava se desliga em silêncio" — `cto-obra`, no ticket. Por isso
 * prosa SOLTA não passa: ela seria o esconderijo perfeito para um campo não
 * declarado.
 *
 * ⚠️ **Nota livre existe, e chama-se `NÃO É CONTROLE`** (correção do Gate 2).
 * A diferença é que ela é NOMEADA: escrever a linha é um ato deliberado de
 * quem edita o spec, não o default de quem só digitou um parágrafo. E ela não
 * fecha o buraco sozinha — quem fecha é o outro lado da trava: um controle
 * escondido numa nota continua aparecendo no DOM, e
 * `e2e/campos-fiscais.spec.ts` reprova todo `data-campo` que nenhum spec da
 * rota declare (e todo controle sem `data-campo`). Nas rotas visitadas, mentir
 * na nota não compra silêncio nenhum; nas não visitadas, compra — e é por isso
 * que a lista de rotas fora da visita está escrita lá, uma a uma.
 *
 * ⚠️ Quando um spec novo divergir, **o spec é que se conserta** — afrouxar a
 * gramática aqui é desligar a trava (Pre-mortem 1 do ticket).
 */

/** Um campo declarado por uma linha do spec. */
export interface CampoDoSpec {
  /** `CONTAI-019` — o nome do arquivo, sem extensão. */
  spec: string;
  /** Linha (1-based) onde a entrada começa. É o que vai na mensagem de erro. */
  linha: number;
  /** O id do mock: `fData`, `cData`, `iTotal`… Nunca o nome do state. */
  id: string;
  /** O `###` sob o qual a entrada está, quando há. */
  subtitulo: string | null;
  /** A entrada inteira, já com as continuações juntadas. */
  texto: string;
  /** `SEM DEFAULT` no spec. Nasce vazio, e nenhuma justificativa derruba isso. */
  semDefault: boolean;
  /** `DEFAULT DECLARADO: <razão>` — default legítimo, declarado por linha. */
  defaultDeclarado: string | null;
  /** `SOMENTE LEITURA` — exibido, não editável. */
  somenteLeitura: boolean;
  /** `campo fiscal` / `campos fiscais`. */
  campoFiscal: boolean;
}

/** Linha que não casa com o contrato. Uma só já deixa a suíte vermelha. */
export interface ErroDeSpec {
  spec: string;
  linha: number;
  conteudo: string;
  motivo: string;
}

export interface SpecLido {
  spec: string;
  /** `true` quando a seção declarou `SEM CAMPOS`. */
  semCampos: boolean;
  campos: CampoDoSpec[];
  erros: ErroDeSpec[];
}

const MARCADOR_SEM_DEFAULT = "SEM DEFAULT";
const MARCADOR_SOMENTE_LEITURA = "SOMENTE LEITURA";
const MARCADOR_DEFAULT_DECLARADO = "DEFAULT DECLARADO:";
const ENTRADA_NAO_CONTROLE = "NÃO É CONTROLE";
const ENTRADA_SEM_CAMPOS = "SEM CAMPOS";

/**
 * `- \`id\`[, \`id\`]… ["rótulo"] [(âncora)] — resto`
 *
 * O travessão é o `—` (em dash), o mesmo que os specs já usam. Hífen simples
 * não passa: a separação precisa ser inconfundível para quem lê e para o
 * parser.
 */
const CABECALHO_ENTRADA =
  /^((?:`[^`]+`)(?:\s*[/,]\s*`[^`]+`)*)((?:\s*"[^"]*"|\s*\([^)]*\))*)\s*—\s*([\s\S]+)$/;

/**
 * Extrai o corpo do `## Campos` de um spec inteiro, com número de linha.
 *
 * ⚠️ **Duas seções `## Campos` no mesmo arquivo é ERRO** (Gate 2 do
 * CONTAI-034): antes, a primeira vencia e a segunda sumia em silêncio — e uma
 * seção inteira de campos invisível para a trava é o pior dos furos possíveis,
 * porque quem a escreveu acha que declarou. `linhaDuplicada` diz onde está.
 */
export function secaoCampos(
  conteudo: string,
): {
  linhas: { n: number; texto: string }[];
  linhaDuplicada: number | null;
} | null {
  const linhas = conteudo.split("\n");
  const cabecalhos: number[] = [];
  for (let i = 0; i < linhas.length; i++) {
    if (/^## Campos\b/.test(linhas[i])) cabecalhos.push(i);
  }
  if (cabecalhos.length === 0) return null;

  const corpo: { n: number; texto: string }[] = [];
  for (let i = cabecalhos[0] + 1; i < linhas.length; i++) {
    if (/^## /.test(linhas[i])) break;
    corpo.push({ n: i + 1, texto: linhas[i] });
  }
  return {
    linhas: corpo,
    linhaDuplicada: cabecalhos.length > 1 ? cabecalhos[1] + 1 : null,
  };
}

/**
 * Lê a seção `## Campos` de UM spec. Nunca lança: o que não casa volta em
 * `erros`, e é o teste que deixa a suíte vermelha — com arquivo, linha e
 * conteúdo.
 */
export function lerCamposDoSpec(spec: string, conteudo: string): SpecLido {
  const secao = secaoCampos(conteudo);
  if (secao === null) {
    return {
      spec,
      semCampos: false,
      campos: [],
      erros: [
        {
          spec,
          linha: 0,
          conteudo: "",
          motivo:
            "spec sem seção `## Campos`. Toda tela desenhada declara os campos " +
            "dela — ou declara `- SEM CAMPOS — <por quê>`. Sem a seção, a tela " +
            "nasce invisível para a trava (CONTAI-034, critério 8)",
        },
      ],
    };
  }

  const campos: CampoDoSpec[] = [];
  const erros: ErroDeSpec[] = [];
  let subtitulo: string | null = null;
  let semCampos = false;

  if (secao.linhaDuplicada !== null) {
    erros.push({
      spec,
      linha: secao.linhaDuplicada,
      conteudo: "## Campos",
      motivo:
        "segunda seção `## Campos` no mesmo spec. Só a primeira é lida, e a " +
        "de baixo ficaria invisível para a trava — junte as duas",
    });
  }

  /** A entrada sendo montada (o `- ` mais as continuações indentadas). */
  let aberta: { n: number; partes: string[] } | null = null;

  const fechar = () => {
    if (aberta === null) return;
    const texto = aberta.partes.join(" ").replace(/\s+/g, " ").trim();
    const n = aberta.n;
    aberta = null;

    if (texto.startsWith(ENTRADA_SEM_CAMPOS)) {
      if (!/^SEM CAMPOS\s*—\s*\S/.test(texto)) {
        erros.push({
          spec,
          linha: n,
          conteudo: texto,
          motivo: "`SEM CAMPOS` exige a justificativa depois de ` — `",
        });
        return;
      }
      semCampos = true;
      return;
    }

    if (texto.startsWith(ENTRADA_NAO_CONTROLE)) {
      if (!/^NÃO É CONTROLE\s*—\s*\S/.test(texto)) {
        erros.push({
          spec,
          linha: n,
          conteudo: texto,
          motivo: "`NÃO É CONTROLE` exige a explicação depois de ` — `",
        });
      }
      return;
    }

    const casou = CABECALHO_ENTRADA.exec(texto);
    if (casou === null) {
      erros.push({
        spec,
        linha: n,
        conteudo: texto,
        motivo:
          "não casa com a gramática do `## Campos`. Formas aceitas: " +
          "``- `id` [(âncora)] — <resto>``, `- NÃO É CONTROLE — <texto>` ou " +
          "`- SEM CAMPOS — <por quê>`",
      });
      return;
    }

    const ids = (casou[1].match(/`[^`]+`/g) ?? []).map((i) => i.slice(1, -1));
    const resto = casou[3];
    const semDefault = contem(resto, MARCADOR_SEM_DEFAULT);
    const somenteLeitura = contem(resto, MARCADOR_SOMENTE_LEITURA);
    const defaultDeclarado = extrairDefault(resto);

    const declaracoes = [
      semDefault,
      somenteLeitura,
      defaultDeclarado !== null,
    ].filter(Boolean).length;

    if (declaracoes === 0) {
      erros.push({
        spec,
        linha: n,
        conteudo: texto,
        motivo:
          `o campo \`${ids.join("`/`")}\` não declara como nasce. Escolha um: ` +
          `\`${MARCADOR_SEM_DEFAULT}\`, \`${MARCADOR_DEFAULT_DECLARADO} <razão>\` ` +
          `ou \`${MARCADOR_SOMENTE_LEITURA}\``,
      });
      return;
    }
    if (declaracoes > 1) {
      erros.push({
        spec,
        linha: n,
        conteudo: texto,
        motivo:
          `o campo \`${ids.join("`/`")}\` declara mais de um jeito de nascer. ` +
          "Os três marcadores são exclusivos",
      });
      return;
    }

    for (const id of ids) {
      campos.push({
        spec,
        linha: n,
        id,
        subtitulo,
        texto,
        semDefault,
        defaultDeclarado,
        somenteLeitura,
        campoFiscal: /campos?\s+fisca(l|is)/i.test(resto),
      });
    }
  };

  for (const { n, texto } of secao.linhas) {
    if (texto.trim() === "") {
      fechar();
      continue;
    }
    // Régua horizontal fecha a seção visualmente e não pode esconder campo
    // nenhum — é a única pontuação de Markdown que passa.
    if (/^-{3,}\s*$/.test(texto)) {
      fechar();
      continue;
    }
    if (/^###\s+/.test(texto)) {
      fechar();
      subtitulo = texto.replace(/^###\s+/, "").trim();
      continue;
    }
    if (/^- /.test(texto)) {
      fechar();
      aberta = { n, partes: [texto.slice(2)] };
      continue;
    }
    if (/^\s{2,}\S/.test(texto) && aberta !== null) {
      // ⚠️ Gate 2 do CONTAI-034: sub-item indentado que COMEÇA com um id em
      // crase (`  - \`quemRecolhe\` — …`) quase sempre é um campo que o autor
      // achou que estava declarando — e ele sumia, absorvido no texto do pai.
      // Sub-item de opção (`  - "Eu" → banco \`eu\``) continua passando: o que
      // dispara o erro é o id NA ABERTURA.
      if (/^\s{2,}[-*]\s+`[^`]+`/.test(texto)) {
        erros.push({
          spec,
          linha: n,
          conteudo: texto,
          motivo:
            "sub-item indentado abrindo com um id em crase: isto vira texto " +
            "do campo de cima e o id não é declarado. Se é campo, promova a " +
            "linha para a coluna 0; se não é, tire a crase da abertura",
        });
        continue;
      }
      aberta.partes.push(texto.trim());
      continue;
    }
    fechar();
    erros.push({
      spec,
      linha: n,
      conteudo: texto,
      motivo:
        "linha solta debaixo de `## Campos`. Ali só existe `### subtítulo`, " +
        "entrada começando em `- ` e continuação indentada — prosa livre é o " +
        "esconderijo de campo não declarado (critério 4)",
    });
  }
  fechar();

  if (campos.length === 0 && !semCampos && erros.length === 0) {
    erros.push({
      spec,
      linha: 0,
      conteudo: "",
      motivo:
        "seção `## Campos` vazia. Se a tela não tem campo, diga: " +
        "`- SEM CAMPOS — <por quê>`",
    });
  }
  if (campos.length > 0 && semCampos) {
    erros.push({
      spec,
      linha: 0,
      conteudo: "",
      motivo: "`SEM CAMPOS` convive com campos declarados na mesma seção",
    });
  }

  return { spec, semCampos, campos, erros };
}

/** `**SEM DEFAULT**` e `SEM DEFAULT` são a mesma coisa para o contrato. */
function contem(resto: string, marcador: string): boolean {
  return resto.replace(/\*/g, "").includes(marcador);
}

function extrairDefault(resto: string): string | null {
  const limpo = resto.replace(/\*/g, "");
  const i = limpo.indexOf(MARCADOR_DEFAULT_DECLARADO);
  if (i === -1) return null;
  const razao = limpo.slice(i + MARCADOR_DEFAULT_DECLARADO.length).trim();
  return razao === "" ? null : razao;
}

/** Formata os erros do jeito que a mensagem de falha precisa: um por linha. */
export function descreverErros(erros: ErroDeSpec[]): string {
  return erros
    .map(
      (e) =>
        `design/mocks/${e.spec}.md:${e.linha || "?"} — ${e.motivo}\n` +
        `    > ${e.conteudo.slice(0, 160)}`,
    )
    .join("\n");
}
