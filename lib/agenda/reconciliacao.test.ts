import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  INTERVALO_MS,
  HORAS_ENTRE_TENTATIVAS,
  deveReconciliar,
} from "@/lib/agenda/reconciliacao";

const AGORA = Date.parse("2026-10-11T12:00:00Z");

describe("deveReconciliar — o acelerador do critério 11", () => {
  it("aparelho sem memória nenhuma: reconcilia (é o backfill)", () => {
    expect(deveReconciliar(null, AGORA)).toBe(true);
  });

  it("dentro da janela de 6h: não reconcilia", () => {
    const umaHoraAtras = String(AGORA - 60 * 60 * 1000);
    expect(deveReconciliar(umaHoraAtras, AGORA)).toBe(false);
  });

  it("exatamente na janela: reconcilia", () => {
    expect(deveReconciliar(String(AGORA - INTERVALO_MS), AGORA)).toBe(true);
  });

  it("depois da janela: reconcilia", () => {
    expect(deveReconciliar(String(AGORA - INTERVALO_MS - 1), AGORA)).toBe(true);
  });

  it("carimbo corrompido conta como 'nunca'", () => {
    // Errar para o lado de sincronizar custa uma requisição; errar para o outro
    // custa um lembrete que nunca sai.
    for (const lixo of ["", "ontem", "NaN", "{}"]) {
      expect(deveReconciliar(lixo, AGORA), lixo).toBe(true);
    }
  });

  it("carimbo no FUTURO (relógio do aparelho mexido) reconcilia", () => {
    expect(deveReconciliar(String(AGORA + INTERVALO_MS), AGORA)).toBe(true);
  });

  it("a janela é de 6 horas", () => {
    expect(HORAS_ENTRE_TENTATIVAS).toBe(6);
  });
});

/**
 * **CONTAI-092, critério 9 — a ressalva do `contador`, como teste estrutural.**
 *
 * O texto do critério: falha de sincronização *"**nunca** entra na tabela
 * `pendencia` fiscal do app, e **nunca** aparece nos relatórios anuais
 * (discriminação Bens e Direitos, lista de Pagamentos Efetuados, posição de
 * aferição INSS) nem no dossiê de venda — é estado de integração operacional,
 * não pendência fiscal"*. E a ressalva de implementação: *"a função/query que
 * monta esses relatórios não deve ter acesso ou dependência de nenhum campo de
 * status de sincronização do Calendar"*.
 *
 * Um teste de comportamento não cobre isso: ele provaria que HOJE a pendência
 * não aparece, e a regra é sobre AMANHÃ. O que fecha a porta é a direção da
 * dependência — e ela se mede lendo os imports dos dois lados.
 */
describe("critério 9 — a agenda e o fiscal não se tocam", () => {
  const RAIZ = join(import.meta.dirname, "..", "..");

  function arquivosDe(pasta: string): string[] {
    return readdirSync(join(RAIZ, pasta))
      .filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))
      .map((n) => join(RAIZ, pasta, n));
  }

  it("nenhum módulo de `lib/agenda/` conhece `pendencia`", () => {
    for (const caminho of arquivosDe("lib/agenda")) {
      const fonte = readFileSync(caminho, "utf8");
      // A palavra aparece em COMENTÁRIO (explicando por que não entra lá), e é
      // por isso que a varredura é sobre código: `from("pendencia")`,
      // `pendencia_desfecho`, `baixar_pendencia`, `tipo_pendencia`.
      expect(fonte, `${caminho} fala com a tabela pendencia`).not.toMatch(
        /from\(\s*["']pendencia|baixar_pendencia|pendencia_desfecho|TipoPendencia/,
      );
    }
  });

  it("nenhum módulo de `lib/agenda/` importa `lib/fiscal/`", () => {
    for (const caminho of arquivosDe("lib/agenda")) {
      const fonte = readFileSync(caminho, "utf8");
      // ⚠️ `lib/fiscal/obra` é a exceção NOMEADA, e só por `formatarDataBR`: ela
      // é formatação de data pt-BR, não regra fiscal (o módulo guarda as duas
      // coisas desde o CONTAI-003). Qualquer OUTRO import de `lib/fiscal/` aqui
      // significa que a agenda passou a depender de regra de apuração, e é isso
      // que o critério 9 proíbe.
      const imports = [...fonte.matchAll(/from "@\/lib\/fiscal\/([a-z-]+)"/g)].map(
        (m) => m[1],
      );
      expect(
        imports.filter((m) => m !== "obra"),
        `${caminho} importa regra fiscal`,
      ).toEqual([]);
    }
  });

  it("`lib/dados/saida-anual.ts` não conhece a agenda do Google", () => {
    // É o módulo que monta as saídas anuais. Se o nome da tabela ou do módulo
    // aparecer aqui, o relatório anual passou a depender de status de
    // sincronização do Calendar — exatamente a ressalva do `contador`.
    const fonte = readFileSync(join(RAIZ, "lib/dados/saida-anual.ts"), "utf8");
    for (const proibido of [
      "compromisso_agenda",
      "integracao_google",
      "lib/agenda",
      "google_event_id",
      "sincronizad",
    ]) {
      expect(fonte, `saida-anual conhece "${proibido}"`).not.toContain(proibido);
    }
  });
});

/**
 * **O achado do Gate 2 do CONTAI-092, virado trava.**
 *
 * O hook de sincronização existia em cinco dos seis pontos de escrita do ciclo
 * de vida do compromisso e faltava **exatamente no mais usado** —
 * `/compromisso/[id]/confirmar`, o caminho principal de quitação de PIX/boleto
 * agendado, que é a dor de origem do ticket. O efeito do esquecimento é o pior
 * possível para a confiança no recurso: o popup soa às 09:00 do vencimento
 * lembrando de um pagamento que o Mateus **já fez** — e "lembrete fantasma"
 * ensina a ignorar o calendário, que é pior do que não ter lembrete nenhum.
 *
 * ⚠️ **Um teste de comportamento não pega isto**: ele provaria os caminhos que
 * alguém lembrou de escrever. O que falta é sempre o ponto de chamada que
 * ninguém viu — então a trava tem de ser sobre a FORMA do código, não sobre o
 * comportamento de uma tela específica. É o mesmo desenho do teste do critério 9
 * acima, pela mesma razão: a regra é sobre amanhã.
 *
 * ⚠️ **Como satisfazer esta trava num arquivo novo**: chame
 * `sincronizarAgenda(id)` depois da gravação, mesmo que o caso pareça não
 * precisar (compromisso de cartão, por exemplo). A chamada é derivada de estado
 * e idempotente — para cartão o servidor conclui "nenhum evento deve existir" e
 * nada acontece. Pular a chamada "porque eu sei que este caso não gera evento" é
 * exatamente o raciocínio que produziu o bug: quem sabe o que o caso gera é
 * `eventoDesejado`, no servidor, não a tela.
 */
describe("todo ponto de escrita do compromisso dispara a sincronização", () => {
  const RAIZ = join(import.meta.dirname, "..", "..");

  /** As gravações que podem MUDAR o estado desejado do evento no Google. */
  const ESCRITAS =
    /\b(criarCompromisso|quitarCompromisso|cancelarCompromisso|mudarDataPrevista|corrigirValorPrevisto)\s*\(/;

  function telasDe(pasta: string): string[] {
    const achados: string[] = [];
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) {
        achados.push(...telasDe(caminho));
        continue;
      }
      // Só código de tela: `app/api/` não chama estas funções (são do client),
      // e `.test.ts` não é ponto de escrita.
      if (!/\.tsx?$/.test(nome) || /\.test\.tsx?$/.test(nome)) continue;
      achados.push(caminho);
    }
    return achados;
  }

  const telas = telasDe(join(RAIZ, "app"));

  it("a varredura acha os arquivos (se vier vazia, a trava não está travando)", () => {
    // Sem esta asserção, um erro de caminho transformaria o teste abaixo num
    // laço sobre zero arquivos — verde, e sem ter conferido nada.
    expect(telas.length).toBeGreaterThan(40);
  });

  it("nenhuma tela grava compromisso sem chamar `sincronizarAgenda`", () => {
    const esquecidas = telas.filter((caminho) => {
      const fonte = readFileSync(caminho, "utf8");
      if (!ESCRITAS.test(fonte)) return false;
      return !fonte.includes("sincronizarAgenda(");
    });

    expect(
      esquecidas.map((c) => c.slice(RAIZ.length + 1)),
      "estes arquivos gravam compromisso e não sincronizam o lembrete — o " +
        "evento no Google fica apontando para um estado que já mudou. Chame " +
        "`sincronizarAgenda(id)` depois da gravação (ver o cabeçalho deste bloco)",
    ).toEqual([]);
  });

  it("os seis pontos de escrita conhecidos continuam todos cobertos", () => {
    // Asserção POSITIVA, e ela é o par da de cima: aquela ficaria verde se
    // alguém APAGASSE as chamadas junto com as gravações. Esta lista é o
    // inventário do ticket (Viabilidade/CTO: "seis pontos de chamada") e muda
    // quando o produto ganhar um sétimo — de propósito.
    const esperados = [
      "app/(captura)/adicionar/pagamento/page.tsx",
      "app/(gestao)/compromisso/[id]/cancelar/page.tsx",
      "app/(gestao)/compromisso/[id]/confirmar/page.tsx",
      "app/(gestao)/compromisso/[id]/data/page.tsx",
      "app/(gestao)/compromisso/[id]/valor/page.tsx",
      "app/_components/quitacao.tsx",
    ];
    const gravam = telas
      .filter((c) => ESCRITAS.test(readFileSync(c, "utf8")))
      .map((c) => c.slice(RAIZ.length + 1))
      .sort();
    expect(gravam).toEqual(esperados);
    for (const caminho of esperados) {
      expect(
        readFileSync(join(RAIZ, caminho), "utf8"),
        `${caminho} perdeu a chamada de sincronização`,
      ).toContain("sincronizarAgenda(");
    }
  });
});
