import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  AUTOR_DESCONHECIDO,
  AUTOR_DONO,
  AUTOR_EU,
  destinoDoPapel,
  nomeDoAutor,
  papelDaSessao,
  papelNaObra,
  ROTA_DO_COLABORADOR,
} from "@/lib/papel";

const MATEUS = "11111111-1111-4111-8111-111111111111";
const ENGENHEIRO = "55555555-5555-4555-8555-555555555555";
const OUTRO = "99999999-9999-4999-8999-999999999999";

describe("papelNaObra", () => {
  it("dono da obra é dono", () => {
    expect(papelNaObra(MATEUS, MATEUS)).toBe("dono");
  });

  it("qualquer outro é colaborador NAQUELA obra", () => {
    expect(papelNaObra(MATEUS, ENGENHEIRO)).toBe("colaborador");
  });
});

describe("nomeDoAutor", () => {
  const ctx = {
    usuarioId: MATEUS,
    donoUserId: MATEUS,
    colaboradores: [{ colaboradorUserId: ENGENHEIRO, nome: "Engenheiro João" }],
  };

  it("o que eu criei diz 'Você' — mesmo sendo eu o dono", () => {
    expect(nomeDoAutor(MATEUS, ctx)).toBe(AUTOR_EU);
  });

  it("o nome do colaborador vem do vínculo", () => {
    expect(nomeDoAutor(ENGENHEIRO, ctx)).toBe("Engenheiro João");
  });

  it("o nome SOBREVIVE à revogação — a linha do vínculo nunca é apagada", () => {
    // Critério 13: `removido_em` não apaga, não desvincula e não altera
    // `criado_por`. Quem lê o nome é `obra_colaborador`, com `removido_em`
    // preenchido ou não — e por isso o vínculo removido continua na lista que
    // chega aqui.
    expect(nomeDoAutor(ENGENHEIRO, ctx)).toBe("Engenheiro João");
  });

  it("vínculo PENDENTE (sem conta) não resolve autor nenhum", () => {
    // `colaboradorUserId === null` não pode casar com um `criado_por` null-ish
    // nem com qualquer uuid: sem conta, aquela pessoa não criou nada ainda.
    const pendente = {
      ...ctx,
      colaboradores: [{ colaboradorUserId: null, nome: "Ainda sem conta" }],
    };
    expect(nomeDoAutor(ENGENHEIRO, pendente)).toBe(AUTOR_DESCONHECIDO);
  });

  it("o colaborador vê 'Dono da obra' no que o Mateus criou", () => {
    const olhandoComoColaborador = {
      usuarioId: ENGENHEIRO,
      donoUserId: MATEUS,
      colaboradores: [{ colaboradorUserId: ENGENHEIRO, nome: "Engenheiro" }],
    };
    expect(nomeDoAutor(MATEUS, olhandoComoColaborador)).toBe(AUTOR_DONO);
    expect(nomeDoAutor(ENGENHEIRO, olhandoComoColaborador)).toBe(AUTOR_EU);
  });

  it("item de OUTRO colaborador: sem nome (Pergunta Aberta 7, resposta provisória)", () => {
    // A RLS da 0030 não dá ao colaborador como ler o vínculo do outro, então a
    // lista que chega aqui não tem o nome dele. A tela diz o que sabe em vez de
    // inventar — e trocar isto por nome real é decisão do Mateus, com uma
    // função `security definer` nova no pacote.
    const olhandoComoColaborador = {
      usuarioId: ENGENHEIRO,
      donoUserId: MATEUS,
      colaboradores: [{ colaboradorUserId: ENGENHEIRO, nome: "Engenheiro" }],
    };
    expect(nomeDoAutor(OUTRO, olhandoComoColaborador)).toBe(AUTOR_DESCONHECIDO);
  });
});

describe("papelDaSessao — critério 16", () => {
  it("possui obra → dono", () => {
    expect(papelDaSessao({ obrasProprias: 1, vinculosDeColaborador: 0 })).toBe(
      "dono",
    );
  });

  it("possui obra E colabora em outra → dono (consequência aceita do desenho)", () => {
    // Out of Scope do ticket: o caso não foi perguntado ao Mateus. Enquanto
    // tiver obra própria, os vínculos de colaborador dele ficam
    // estruturalmente invisíveis — e é esta asserção que registra a escolha.
    expect(papelDaSessao({ obrasProprias: 1, vinculosDeColaborador: 3 })).toBe(
      "dono",
    );
  });

  it("sem obra, com vínculo → colaborador", () => {
    expect(papelDaSessao({ obrasProprias: 0, vinculosDeColaborador: 1 })).toBe(
      "colaborador",
    );
  });

  it("vínculo REMOVIDO ainda abre o shell do colaborador", () => {
    // `vinculosDeColaborador` conta ativas e removidas (ver o tipo). O
    // engenheiro cujo acesso foi revogado lê "você ainda não foi vinculado a
    // nenhuma obra" em vez de receber um convite para cadastrar obra própria.
    expect(papelDaSessao({ obrasProprias: 0, vinculosDeColaborador: 1 })).toBe(
      "colaborador",
    );
  });

  it("nem obra nem vínculo → dono (primeiro acesso, vai cadastrar a obra)", () => {
    expect(papelDaSessao({ obrasProprias: 0, vinculosDeColaborador: 0 })).toBe(
      "dono",
    );
  });
});

describe("destinoDoPapel — o pós-login e a guarda de rota", () => {
  it("colaborador com destino de dono vai para a área dele", () => {
    expect(destinoDoPapel("colaborador", "/")).toBe(ROTA_DO_COLABORADOR);
    expect(destinoDoPapel("colaborador", "/despesas")).toBe(ROTA_DO_COLABORADOR);
  });

  it("colaborador com deep link da área dele mantém o destino", () => {
    expect(destinoDoPapel("colaborador", "/colaborador/abc")).toBe(
      "/colaborador/abc",
    );
    expect(destinoDoPapel("colaborador", ROTA_DO_COLABORADOR)).toBe(
      ROTA_DO_COLABORADOR,
    );
  });

  it("dono que cai na área do colaborador volta para a home", () => {
    expect(destinoDoPapel("dono", "/colaborador")).toBe("/");
    expect(destinoDoPapel("dono", "/colaborador/abc")).toBe("/");
  });

  it("dono com destino de dono mantém o deep link", () => {
    expect(destinoDoPapel("dono", "/documento/abc")).toBe("/documento/abc");
  });

  it("não confunde prefixo: `/colaboradores` é tela do DONO", () => {
    // `/obras/[id]/colaboradores` é gestão. Um `startsWith("/colaborador")`
    // ingênuo mandaria o dono dessa tela para a home a cada abertura.
    const rota = "/obras/22222222-2222-4222-8222-222222222222/colaboradores";
    expect(destinoDoPapel("dono", rota)).toBe(rota);
  });
});

/**
 * **CONTAI-093, critério 12 — a ausência é ESTRUTURAL, não botão escondido.**
 *
 * Texto do critério: a área do colaborador *"**nunca** renderiza Home,
 * `/despesas`, `/pendencias` ou relatórios anuais — ausência estrutural, não
 * botão escondido"*.
 *
 * ⚠️ **Um teste de comportamento não cobre isso**: ele provaria que HOJE o link
 * não está lá. A regra é sobre AMANHÃ — sobre a fatia `094`/`095`, que vai
 * encher a tela (c) de documentos e compromissos e vai ter todo incentivo para
 * "só reaproveitar o card da home". O que fecha a porta é a direção da
 * dependência, e ela se mede lendo os imports. Mesmo desenho (e mesma razão) do
 * teste do critério 9 em `lib/agenda/reconciliacao.test.ts`.
 */
describe("critério 12 — a área do colaborador não alcança o fiscal do dono", () => {
  const RAIZ = join(import.meta.dirname, "..");
  const AREA = join(RAIZ, "app", "(colaborador)");

  function arquivosDe(pasta: string): string[] {
    const achados: string[] = [];
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) {
        achados.push(...arquivosDe(caminho));
        continue;
      }
      if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
        achados.push(caminho);
      }
    }
    return achados;
  }

  const arquivos = arquivosDe(AREA);

  it("a varredura acha os arquivos (vazia, a trava não está travando)", () => {
    // Sem esta asserção, um erro de caminho transformaria os testes abaixo num
    // laço sobre zero arquivos — verde, e sem ter conferido nada.
    expect(arquivos.length).toBeGreaterThanOrEqual(3);
  });

  it("nenhum arquivo importa `lib/fiscal/resumo`", () => {
    // `calcularResumo` é o que monta os KPIs da Visão geral do DONO: custo
    // acumulado do imóvel, custo do ano, base de aferição. Nada disso é do
    // colaborador em fatia nenhuma deste desenho.
    for (const caminho of arquivos) {
      expect(
        semComentarios(readFileSync(caminho, "utf8")),
        `${caminho} importa o resumo fiscal do dono`,
      ).not.toMatch(/@\/lib\/fiscal\/resumo|calcularResumo/);
    }
  });

  it("nenhum arquivo alcança módulo de SAÍDA ANUAL", () => {
    // A porta única das saídas anuais (discriminação de Bens e Direitos, lista
    // de Pagamentos Efetuados, posição da aferição) e os módulos que a
    // alimentam. Relatório anual é ato do declarante — é o CPF dele na DAA.
    const proibidos = [
      "@/lib/dados/saida-anual",
      "@/lib/fiscal/discriminacao",
      "@/lib/fiscal/afericao",
      "carregarSaidaAnual",
      "podeGerarRelatorioAnual",
      "LiberadoBensEDireitos",
      "LiberadoPagamentosEfetuados",
      "LiberadoAfericaoInss",
    ];
    for (const caminho of arquivos) {
      const fonte = semComentarios(readFileSync(caminho, "utf8"));
      for (const proibido of proibidos) {
        expect(fonte, `${caminho} alcança "${proibido}"`).not.toContain(
          proibido,
        );
      }
    }
  });

  it("nenhum arquivo navega para Home, `/despesas` ou `/pendencias`", () => {
    // O outro sentido do critério 12: não é só o cálculo que fica fora, é a
    // NAVEGAÇÃO. Um `BotaoLink href="/despesas"` levaria o colaborador a uma
    // tela que a RLS devolve vazia — pior que recusar, porque parece que a obra
    // não tem despesa nenhuma.
    for (const caminho of arquivos) {
      const fonte = semComentarios(readFileSync(caminho, "utf8"));
      for (const rota of ["/despesas", "/pendencias", "/obras"]) {
        expect(fonte, `${caminho} linka ${rota}`).not.toContain(`"${rota}`);
      }
      expect(fonte, `${caminho} linka a Home do dono`).not.toMatch(
        /href=\{?["'`]\/["'`]/,
      );
    }
  });
});

/**
 * Comentário não é código: as duas travas acima falam de DEPENDÊNCIA, e os
 * arquivos da área citam `/despesas` e "resumo" justamente para explicar por
 * que não os alcançam. Medir o texto do comentário tornaria a explicação
 * proibida — e explicação proibida é como nasce código sem explicação.
 */
function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
}
