import { describe, expect, it } from "vitest";

import { descreverErros, lerCamposDoSpec } from "./campos-do-spec";
import { lerTodosOsSpecs, specsExistentes } from "./specs";

/**
 * CONTAI-034 — metade 1 da trava: o SPEC é legível por máquina.
 *
 * A metade 2 é `e2e/campos-fiscais.spec.ts`, que cruza o que sai daqui com o
 * DOM da tela. Uma sem a outra não prova nada: este arquivo garante que o
 * "SEM DEFAULT" escrito no mock é um fato que dá para consultar, e o E2E
 * garante que a tela obedece.
 *
 * ⚠️ **O contrato do formato está em `campos-do-spec.ts`, e é versionado**
 * (critério 5). Spec novo que não caiba nele deixa a suíte vermelha com
 * arquivo:linha — e o conserto é no spec, nunca afrouxando a gramática
 * (Pre-mortem 1 do ticket). Afrouxar aqui é desligar a trava em silêncio, que
 * é a própria D44 com outro nome.
 */

describe("gramática do `## Campos` (contrato v1)", () => {
  const spec = (corpo: string) =>
    lerCamposDoSpec("TESTE-001", `# titulo\n\n## Campos\n${corpo}\n\n## Outra\n`);

  it("lê a forma tabular: id, marcadores e campo fiscal", () => {
    const { campos, erros } = spec(
      "- `fData` — `type=date` — obrigatória — SEM DEFAULT — campo fiscal",
    );
    expect(erros).toEqual([]);
    expect(campos).toHaveLength(1);
    expect(campos[0]).toMatchObject({
      id: "fData",
      semDefault: true,
      campoFiscal: true,
      defaultDeclarado: null,
      somenteLeitura: false,
      linha: 4,
    });
  });

  it("aceita rótulo entre aspas e âncora entre parênteses, nos dois casos", () => {
    const { campos, erros } = spec(
      '- `iTotal` "Total Pago no Exercício" (s10) — nº — SEM DEFAULT',
    );
    expect(erros).toEqual([]);
    expect(campos[0].id).toBe("iTotal");
  });

  it("um controle com dois ids irmãos vira duas linhas de campo", () => {
    const { campos } = spec("- `fArq`, `fCam` — file — SEM DEFAULT");
    expect(campos.map((c) => c.id)).toEqual(["fArq", "fCam"]);
  });

  it("junta a continuação indentada na mesma entrada", () => {
    const { campos, erros } = spec(
      "- `numero` — texto livre — **obrigatório e bloqueante** em `nf_material`,\n" +
        "  ausente em boleto — SEM DEFAULT — campo\n" +
        "  fiscal",
    );
    expect(erros).toEqual([]);
    expect(campos).toHaveLength(1);
    expect(campos[0].campoFiscal).toBe(true);
  });

  it("guarda o `###` como subtítulo da entrada", () => {
    const { campos } = spec(
      "### `#s10` — registrar pagamento\n- `valor` — moeda — SEM DEFAULT",
    );
    expect(campos[0].subtitulo).toBe("`#s10` — registrar pagamento");
  });

  // ── fail-closed: o coração do ticket (critério 4) ────────────────────────

  it("⛔ prosa solta debaixo de `## Campos` fica VERMELHA com a linha", () => {
    const { erros } = spec("A interação inteira é escolha por clique.");
    expect(erros).toHaveLength(1);
    expect(erros[0].linha).toBe(4);
    expect(erros[0].conteudo).toContain("escolha por clique");
  });

  it("⛔ campo que não diz como nasce fica VERMELHO com o nome dele", () => {
    const { erros, campos } = spec("- `serie` — texto opcional, não-bloqueante");
    expect(campos).toEqual([]);
    expect(erros[0].motivo).toContain("`serie`");
    expect(erros[0].motivo).toContain("não declara como nasce");
  });

  it("⛔ dois marcadores de nascimento na mesma linha é ambiguidade, não escolha", () => {
    const { erros } = spec(
      "- `cData` — date — SEM DEFAULT — DEFAULT DECLARADO: a data prevista",
    );
    expect(erros[0].motivo).toContain("mais de um jeito de nascer");
  });

  it("⛔ segunda seção `## Campos` no mesmo spec fica vermelha", () => {
    const { erros } = lerCamposDoSpec(
      "TESTE-003",
      "# t\n\n## Campos\n- `a` — texto — SEM DEFAULT\n\n## Outra\n\n## Campos\n- `b` — texto — SEM DEFAULT\n",
    );
    expect(erros).toHaveLength(1);
    expect(erros[0].linha).toBe(8);
    expect(erros[0].motivo).toContain("segunda seção");
  });

  it("⛔ sub-item indentado abrindo com id em crase não some dentro do pai", () => {
    const { erros, campos } = spec(
      "- `composicao` — escolha — SEM DEFAULT\n" +
        "  - `tributo` — escolha de 6 — SEM DEFAULT",
    );
    expect(campos.map((c) => c.id)).toEqual(["composicao"]);
    expect(erros[0].motivo).toContain("sub-item indentado");
  });

  it("sub-item de OPÇÃO continua passando — a crase não abre a linha", () => {
    const { erros, campos } = spec(
      "- `quemRecolhe` — escolha — SEM DEFAULT\n" +
        '  - "Eu" → banco `eu`\n' +
        '  - "A empresa" → banco `empresa`',
    );
    expect(erros).toEqual([]);
    expect(campos.map((c) => c.id)).toEqual(["quemRecolhe"]);
  });

  it("⛔ spec sem a seção `## Campos` fica vermelho — tela não nasce invisível", () => {
    const { erros } = lerCamposDoSpec("TESTE-002", "# titulo\n\n## Telas\n- s1\n");
    expect(erros).toHaveLength(1);
    expect(erros[0].motivo).toContain("sem seção `## Campos`");
  });

  it("⛔ seção `## Campos` vazia também fica vermelha", () => {
    const { erros } = spec("");
    expect(erros[0].motivo).toContain("vazia");
  });

  it("`SEM CAMPOS` é declaração explícita, e exige a justificativa", () => {
    expect(spec("- SEM CAMPOS — tela é só leitura.").erros).toEqual([]);
    expect(spec("- SEM CAMPOS").erros[0].motivo).toContain("justificativa");
  });

  it("`NÃO É CONTROLE` tira a linha da conta sem virar campo", () => {
    const { campos, erros } = spec(
      "- `iAmort` — nº — SEM DEFAULT\n" +
        "- NÃO É CONTROLE — derivado (não editável): custo = `iAmort + iJuros`",
    );
    expect(erros).toEqual([]);
    expect(campos.map((c) => c.id)).toEqual(["iAmort"]);
  });

  it("⛔ seção só com `NÃO É CONTROLE` não classifica a tela: fica vermelha", () => {
    const { erros } = spec("- NÃO É CONTROLE — derivado, não editável");
    expect(erros[0].motivo).toContain("vazia");
  });

  it("`**SEM DEFAULT**` em negrito é o mesmo marcador", () => {
    expect(spec("- `x` — escolha — **SEM DEFAULT — campo fiscal**").campos[0])
      .toMatchObject({ semDefault: true, campoFiscal: true });
  });

  it("`DEFAULT DECLARADO:` carrega a razão junto — declarar sem razão não vale", () => {
    const comRazao = spec(
      "- `cData` — date — DEFAULT DECLARADO: a data prevista, editável",
    );
    expect(comRazao.campos[0].defaultDeclarado).toBe("a data prevista, editável");
    expect(spec("- `cData` — date — DEFAULT DECLARADO:").erros[0].motivo).toContain(
      "não declara como nasce",
    );
  });
});

describe("os specs de `design/mocks/` obedecem ao contrato", () => {
  it("⛔ nenhuma linha fora da gramática, em spec nenhum", () => {
    const erros = lerTodosOsSpecs().flatMap((s) => s.erros);
    expect(
      erros.length,
      erros.length === 0
        ? ""
        : "spec fora do contrato do `## Campos` — conserte o SPEC, nunca a " +
          "gramática (o parser que ignora o que não entende é a D44 de novo):\n" +
          descreverErros(erros),
    ).toBe(0);
  });

  it("todo spec declara campos ou declara que não tem", () => {
    const lidos = lerTodosOsSpecs();
    expect(lidos.map((s) => s.spec)).toEqual(specsExistentes());
    for (const s of lidos) {
      expect(s.campos.length > 0 || s.semCampos, `${s.spec} não classificou`).toBe(
        true,
      );
    }
  });

  /**
   * Critério 12 — o falso positivo que TEM que passar. `cData` nasce com a
   * data prevista e isso é legítimo: está DECLARADO na linha do spec. A trava é
   * por linha, nunca pela regra geral "todo campo fiscal nasce vazio".
   */
  it("o `cData` do CONTAI-019 é default declarado, não violação", () => {
    const campo = campoDe("CONTAI-019", "cData");
    expect(campo.semDefault).toBe(false);
    expect(campo.defaultDeclarado).toContain("data prevista");
  });

  /**
   * Critério 11 — a base da prova contra a D44. Estes dois são os campos que
   * `useState(hojeIso)` e `useState("pix")` preenchiam em produção.
   */
  it("`fData` e `meio` do CONTAI-032 são SEM DEFAULT — é o que a D44 violava", () => {
    for (const id of ["fData", "meio"]) {
      expect(campoDe("CONTAI-032", id).semDefault, id).toBe(true);
    }
  });
});

function campoDe(spec: string, id: string) {
  const lido = lerTodosOsSpecs().find((s) => s.spec === spec);
  const campo = lido?.campos.find((c) => c.id === id);
  if (!campo) throw new Error(`${spec} não declara \`${id}\``);
  return campo;
}
