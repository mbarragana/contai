import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  OPCOES_DE_REGISTRO,
  VIEWS_DE_GESTAO,
  ehViewAtiva,
  migalhaDaRota,
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
    // ⚠️ Depois do `CONTAI-046` a única filha que ainda mora em `(captura)` é
    // `/obras/nova` — e ela continua casando, porque o casamento é por rota, e
    // não por pasta. As outras estão todas dentro do shell.
    expect(ehViewAtiva("/pendencias/abc-123", "/pendencias")).toBe(true);
    expect(ehViewAtiva("/obras/nova", "/obras")).toBe(true);
    expect(ehViewAtiva("/obras/abc/terreno", "/obras")).toBe(true);
    expect(ehViewAtiva("/despesas", "/despesas")).toBe(true);
  });

  /**
   * **CONTAI-046** — a família inteira de obra e terreno acende **Obras**, e
   * só ela. São as rotas com mais texto fiscal por área de tela do produto;
   * abrir a discriminação anual com a sidebar apagada seria a revisão da
   * declaração acontecendo fora da navegação.
   */
  it("obra, terreno, discriminação e notas sem CNO marcam Obras — e só Obras", () => {
    const rotas = [
      "/obras/abc-123",
      "/obras/abc-123/terreno",
      "/obras/abc-123/terreno/desembolsos",
      "/obras/abc-123/terreno/financiamento",
      "/obras/abc-123/terreno/informe/2025",
      "/obras/abc-123/discriminacao/2025",
      "/obras/abc-123/notas-sem-cno",
    ];
    for (const rota of rotas) {
      expect(ehViewAtiva(rota, "/obras")).toBe(true);
      for (const v of VIEWS_DE_GESTAO) {
        if (v.href === "/obras") continue;
        expect(ehViewAtiva(rota, v.href)).toBe(false);
      }
      expect(tituloDaView(rota)).toBe("Obras");
    }
  });

  it("uma rota fora do grupo não marca item nenhum", () => {
    for (const v of VIEWS_DE_GESTAO) {
      if (v.href === "/") continue;
      expect(ehViewAtiva("/adicionar/pagamento", v.href)).toBe(false);
    }
    expect(tituloDaView("/adicionar/pagamento")).toBe("contai");
  });

  /**
   * **CONTAI-043** — a rota de detalhe não começa por `/despesas`, e mesmo
   * assim é uma despesa. Sem esta atribuição, abrir um documento a partir do
   * dashboard apagaria a sidebar inteira: a tela pareceria fora da navegação
   * no meio da revisão que o shell existe para dar.
   */
  it("o detalhe de documento marca Despesas — a lista-mãe dele", () => {
    expect(ehViewAtiva("/documento/abc-123", "/despesas")).toBe(true);
    expect(ehViewAtiva("/documento/abc-123/corrigir/valor", "/despesas")).toBe(
      true,
    );
    // E só Despesas: item de menu que acende junto é sidebar mentindo.
    for (const v of VIEWS_DE_GESTAO) {
      if (v.href === "/despesas") continue;
      expect(ehViewAtiva("/documento/abc-123", v.href)).toBe(false);
    }
  });

  /**
   * **CONTAI-044** — o mesmo vale para pagamento e fatura: nenhuma das duas
   * rotas começa por `/despesas`, e as duas são despesa (PIX/boleto direto e
   * compra no cartão).
   */
  it("o detalhe de pagamento e de fatura também marcam Despesas", () => {
    for (const raiz of ["pagamento", "fatura"]) {
      expect(ehViewAtiva(`/${raiz}/abc-123`, "/despesas")).toBe(true);
      expect(ehViewAtiva(`/${raiz}/abc-123/ligar`, "/despesas")).toBe(true);
      for (const v of VIEWS_DE_GESTAO) {
        if (v.href === "/despesas") continue;
        expect(ehViewAtiva(`/${raiz}/abc-123`, v.href)).toBe(false);
      }
    }
  });

  /**
   * **CONTAI-045** — a agenda e o agendamento acendem **Visão geral**, que é
   * onde o bloco de agendados vive (spec `detalhe-no-shell-v1`, decisão 1). A
   * lista `/compromisso` entra junto com o detalhe: ela é o destino do "ver
   * todos (N)" do dashboard, não uma view de primeira classe.
   */
  it("a agenda e o agendamento marcam Visão geral", () => {
    for (const rota of [
      "/compromisso",
      "/compromisso/abc-123",
      "/compromisso/abc-123/confirmar",
      "/compromisso/abc-123/cancelar",
      "/compromisso/abc-123/data",
    ]) {
      expect(ehViewAtiva(rota, "/")).toBe(true);
      for (const v of VIEWS_DE_GESTAO) {
        if (v.href === "/") continue;
        expect(ehViewAtiva(rota, v.href), `${rota} × ${v.href}`).toBe(false);
      }
    }
  });

  /**
   * **CONTAI-045** — `/pendencias/[id]` já casava por prefixo desde o `040`.
   * O caso fica escrito porque a tela mudou de pasta neste ticket, e mudar de
   * pasta não podia mudar o item aceso: a fila é o caminho de volta dela.
   */
  it("o detalhe de pendência continua marcando Pendências, e só", () => {
    expect(ehViewAtiva("/pendencias/abc-123", "/pendencias")).toBe(true);
    for (const v of VIEWS_DE_GESTAO) {
      if (v.href === "/pendencias") continue;
      expect(ehViewAtiva("/pendencias/abc-123", v.href)).toBe(false);
    }
  });
});

/**
 * **O breadcrumb do topbar — CONTAI-043, decisão 3 do `detalhe-no-shell-v1`.**
 *
 * A regra que estes casos travam é uma só: o destino é sempre uma ROTA, nunca
 * "a tela anterior". Link direto e refresh são o caso normal aqui (a pendência
 * do dashboard, o lembrete da agenda e a linha de `/despesas` abrem o detalhe
 * de fora), e voltar por histórico quebra justamente aí.
 */
describe("o breadcrumb das telas de detalhe", () => {
  it("do documento aponta para a lista-mãe, Despesas", () => {
    expect(migalhaDaRota("/documento/abc-123")).toEqual({
      href: "/despesas",
      rotulo: "Despesas",
    });
  });

  it("de uma subrota de correção aponta para o próprio documento", () => {
    for (const sub of [
      "anexar",
      "cnpj-errado",
      "corrigir/classificacao",
      "corrigir/emitente",
      "corrigir/valor",
      "desligar",
      "ligar",
      "obra",
      "outro-dado",
    ]) {
      expect(migalhaDaRota(`/documento/abc-123/${sub}`)).toEqual({
        href: "/documento/abc-123",
        rotulo: "Documento",
      });
    }
  });

  /**
   * **CONTAI-044** — o pagamento e a fatura entram como raiz, ao lado do
   * documento (`ROTULO_DO_DETALHE`). O detalhe aponta para Despesas; as
   * subrotas ("um nível abaixo") apontam de volta para o próprio pagamento ou
   * a própria fatura — nunca para `/despesas` direto.
   */
  it("do pagamento e da fatura seguem a mesma regra do documento", () => {
    expect(migalhaDaRota("/pagamento/abc-123")).toEqual({
      href: "/despesas",
      rotulo: "Despesas",
    });
    for (const sub of ["ligar", "obra"]) {
      expect(migalhaDaRota(`/pagamento/abc-123/${sub}`)).toEqual({
        href: "/pagamento/abc-123",
        rotulo: "Pagamento",
      });
    }

    expect(migalhaDaRota("/fatura/xyz-789")).toEqual({
      href: "/despesas",
      rotulo: "Despesas",
    });
    for (const sub of ["alocar", "confirmar", "parcial"]) {
      expect(migalhaDaRota(`/fatura/xyz-789/${sub}`)).toEqual({
        href: "/fatura/xyz-789",
        rotulo: "Fatura",
      });
    }
  });

  /**
   * **CONTAI-045** — aqui a lista-mãe deixa de ser sempre `/despesas`, e é o
   * ponto onde os dois riscos do Pre-mortem do ticket se travam:
   * - `/pendencias/[id]` volta para **`/pendencias`** (a fila unificada do
   *   `CONTAI-042`), nunca para a home antiga, que não existe desde o `040`;
   * - `/compromisso/[id]` volta para a **agenda**, que é rota de verdade, e a
   *   agenda volta para a **Visão geral**, de onde se chega nela.
   */
  it("do agendamento volta para a agenda, e a agenda para a Visão geral", () => {
    expect(migalhaDaRota("/compromisso")).toEqual({
      href: "/",
      rotulo: "Visão geral",
    });
    expect(migalhaDaRota("/compromisso/abc-123")).toEqual({
      href: "/compromisso",
      rotulo: "Agendados",
    });
    for (const sub of ["cancelar", "confirmar", "data"]) {
      expect(migalhaDaRota(`/compromisso/abc-123/${sub}`)).toEqual({
        href: "/compromisso/abc-123",
        rotulo: "Agendamento",
      });
    }
  });

  it("da pendência volta para a fila de pendências, nunca para a home", () => {
    expect(migalhaDaRota("/pendencias/abc-123")).toEqual({
      href: "/pendencias",
      rotulo: "Pendências",
    });
  });

  /**
   * **CONTAI-046** — três degraus, e o do meio é o que uma regra ingênua
   * perderia: `/obras/[id]/terreno/desembolsos` volta para o PAINEL DO
   * TERRENO, não para o cadastro da obra. Pular um degrau real aqui é o mesmo
   * defeito de mandar `/documento/[id]/corrigir/valor` direto para `/despesas`.
   */
  it("da obra volta para a lista de obras; das filhas dela, para a obra", () => {
    expect(migalhaDaRota("/obras/abc-123")).toEqual({
      href: "/obras",
      rotulo: "Obras",
    });
    for (const filha of ["terreno", "notas-sem-cno"]) {
      expect(migalhaDaRota(`/obras/abc-123/${filha}`)).toEqual({
        href: "/obras/abc-123",
        rotulo: "Dados da obra",
      });
    }
    // O ano é parâmetro de rota, e o crumb não o carrega: a mãe da
    // discriminação é a obra, em qualquer ano.
    expect(migalhaDaRota("/obras/abc-123/discriminacao/2025")).toEqual({
      href: "/obras/abc-123",
      rotulo: "Dados da obra",
    });
  });

  it("das telas de terreno volta para o painel do terreno, não para a obra", () => {
    for (const sub of [
      "desembolsos",
      "financiamento",
      "informe/2025",
      "informe/2026",
    ]) {
      expect(migalhaDaRota(`/obras/abc-123/terreno/${sub}`)).toEqual({
        href: "/obras/abc-123/terreno",
        rotulo: "Terreno",
      });
    }
  });

  it("nas views de primeira classe não existe — elas são o topo", () => {
    expect(migalhaDaRota("/")).toBeNull();
    expect(migalhaDaRota("/despesas")).toBeNull();
    expect(migalhaDaRota("/pendencias")).toBeNull();
    expect(migalhaDaRota("/obras")).toBeNull();
    // Nem em rota fora do shell: `/adicionar` tem casca própria, sem topbar.
    expect(migalhaDaRota("/adicionar/documento")).toBeNull();
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
