import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  OPCOES_DE_REGISTRO,
  VIEWS_DE_GESTAO,
  ehViewAtiva,
  subtituloDaView,
  tituloDaView,
} from "./navegacao";

/**
 * CONTAI-040 — o que este arquivo trava.
 *
 * A promessa do desenho é que a navegação é **a mesma em toda tela** e que
 * **nenhum item é morto**. As duas são afirmações sobre uma lista, e lista se
 * testa.
 */
describe("as quatro views do shell de gestão", () => {
  it("são exatamente quatro, na ordem do desenho, e nenhuma aponta para o vazio", () => {
    expect(VIEWS_DE_GESTAO.map((v) => v.rotulo)).toEqual([
      "Visão geral",
      "Despesas",
      "Pendências",
      "Obras",
    ]);
    // ⚠️ `/despesas` incluída: o item existe no menu desde este ticket, e a
    // rota existe junto. Item de menu sem rota é link morto (critério 1).
    expect(VIEWS_DE_GESTAO.map((v) => v.href)).toEqual([
      "/",
      "/despesas",
      "/pendencias",
      "/obras",
    ]);
    for (const v of VIEWS_DE_GESTAO) {
      expect(v.href.startsWith("/")).toBe(true);
    }
  });
});

/**
 * **O teste-trava da copy de "+ Novo registro" — CONTAI-040, Gate 2.**
 *
 * O critério 5 manda o menu do topbar reaproveitar **literalmente** os rótulos
 * e descrições de `/adicionar`; o critério 7 proíbe alterar aquela tela em uma
 * linha que seja. As duas coisas juntas obrigam a copy a existir em dois
 * lugares — e copy em dois lugares diverge, em silêncio, no dia em que só um
 * for atualizado (é a mesma mecânica da D46, com texto de produto no lugar do
 * fiscal).
 *
 * A saída não é confiar na atenção de quem edita: é LER o arquivo de origem e
 * exigir a frase inteira lá dentro. Se alguém reescrever o rótulo do pagamento
 * em `/adicionar` e esquecer do shell, este teste fica vermelho **com a frase
 * que divergiu no nome da falha** — que é o que os testes-trava de `lib/fiscal`
 * fazem com texto de parecer.
 *
 * ⚠️ **Só leitura.** O teste não autoriza tocar em `/adicionar/page.tsx`: ele
 * existe justamente porque não se pode.
 */
describe("as três portas de '+ Novo registro'", () => {
  const ORIGEM = "app/(captura)/adicionar/page.tsx";
  const fonte = readFileSync(ORIGEM, "utf-8");

  it("são as três de /adicionar, apontando para as rotas de lá", () => {
    expect(OPCOES_DE_REGISTRO.map((o) => o.href)).toEqual([
      "/adicionar/documento",
      "/adicionar/pagamento",
      "/adicionar/compra-cartao",
    ]);
    for (const o of OPCOES_DE_REGISTRO) {
      expect(fonte, `${ORIGEM} não aponta para ${o.href}`).toContain(
        `href="${o.href}"`,
      );
    }
  });

  for (const opcao of OPCOES_DE_REGISTRO) {
    it(`o rótulo "${opcao.rotulo}" é o mesmo de /adicionar`, () => {
      expect(
        normalizar(fonte),
        `o rótulo do menu do shell não existe mais em ${ORIGEM} — a copy ` +
          "divergiu. Corrija o shell (`lib/gestao/navegacao.ts`), nunca " +
          "afrouxe esta trava: /adicionar é a origem, e o critério 7 do " +
          "CONTAI-040 proíbe editá-la",
      ).toContain(normalizar(opcao.rotulo));
    });

    it(`a descrição de "${opcao.href}" é a mesma de /adicionar`, () => {
      expect(
        normalizar(fonte),
        `a descrição do menu do shell não existe mais em ${ORIGEM} — a copy ` +
          "divergiu. Corrija o shell (`lib/gestao/navegacao.ts`)",
      ).toContain(normalizar(opcao.descricao));
    });
  }
});

/**
 * O JSX quebra a frase em várias linhas e indenta cada uma; o texto renderizado
 * é o mesmo. Comparar sem normalizar o espaço em branco faria a trava falhar
 * por reformatação do Prettier, que é ruído — e trava que dá falso positivo é
 * trava que alguém desliga.
 */
function normalizar(texto: string): string {
  return texto.replace(/\s+/g, " ");
}

describe("qual item fica marcado", () => {
  it("a Visão geral casa só na raiz — por prefixo ela casaria com tudo", () => {
    expect(ehViewAtiva("/", "/")).toBe(true);
    expect(ehViewAtiva("/pendencias", "/")).toBe(false);
    expect(ehViewAtiva("/obras", "/")).toBe(false);
  });

  it("as demais casam a própria árvore, inclusive as filhas fora do shell", () => {
    // `/pendencias/[id]` e `/obras/[id]` moram em `(captura)`: voltar de uma
    // delas com o menu apagado faria a tela parecer fora da navegação.
    expect(ehViewAtiva("/pendencias/abc-123", "/pendencias")).toBe(true);
    expect(ehViewAtiva("/obras/nova", "/obras")).toBe(true);
    expect(ehViewAtiva("/obras/abc/terreno", "/obras")).toBe(true);
    expect(ehViewAtiva("/despesas", "/despesas")).toBe(true);
  });

  it("uma rota fora do grupo não marca item nenhum", () => {
    for (const v of VIEWS_DE_GESTAO) {
      if (v.href === "/") continue;
      expect(ehViewAtiva("/adicionar/pagamento", v.href)).toBe(false);
    }
    expect(tituloDaView("/adicionar/pagamento")).toBe("contai");
  });

  it("o título da barra é o mesmo rótulo do menu — um nome só por view", () => {
    expect(tituloDaView("/")).toBe("Visão geral");
    expect(tituloDaView("/despesas")).toBe("Despesas");
    expect(tituloDaView("/pendencias")).toBe("Pendências");
    expect(tituloDaView("/pendencias/abc")).toBe("Pendências");
    expect(tituloDaView("/obras")).toBe("Obras");
  });
});

describe("o subtítulo", () => {
  const obra = { nomeDaObra: "Casa Cachoeira", ano: 2026, abertas: 9 };

  it("na Visão geral e em Despesas nomeia a obra E o ano", () => {
    // Todo número das duas views é daquela obra naquele ano — o subtítulo é
    // onde isso fica dito, agora que o `AppBar` saiu.
    expect(subtituloDaView("/", obra)).toBe("Casa Cachoeira · 2026");
    expect(subtituloDaView("/despesas", obra)).toBe("Casa Cachoeira · 2026");
  });

  it("sem obra aberta, a Visão geral não inventa subtítulo", () => {
    expect(
      subtituloDaView("/", { nomeDaObra: null, ano: 2026, abertas: 0 }),
    ).toBeNull();
  });

  it("em Pendências conta as abertas e mantém a distinção derivada × persistente", () => {
    const texto = subtituloDaView("/pendencias", obra)!;
    expect(texto).toContain("9 abertas");
    // ⚠️ A frase inteira, não só a contagem: é ela que diz que a derivada some
    // quando o fato muda e a de correção só sai com um desfecho. Encurtar
    // apaga a diferença.
    expect(texto).toContain("as derivadas somem quando o fato muda");
    expect(texto).toContain("as de correção, só com um desfecho escolhido");
  });

  it("concorda em número com uma pendência só", () => {
    expect(subtituloDaView("/pendencias", { ...obra, abertas: 1 })).toContain(
      "1 aberta ·",
    );
  });

  it("enquanto a carga não terminou, não afirma contagem nenhuma", () => {
    // Número não apurado aparecendo como apuração é a D59 com outro rosto.
    const texto = subtituloDaView("/pendencias", { ...obra, abertas: null })!;
    expect(texto).not.toMatch(/\d/);
    expect(texto).toContain("as derivadas somem quando o fato muda");
  });

  it("em Obras não há ano: a lista não é recortada por ano-calendário", () => {
    expect(subtituloDaView("/obras", obra)).toBe("Escolha em qual você vai mexer");
  });
});
