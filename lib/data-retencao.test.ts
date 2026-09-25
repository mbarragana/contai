import { beforeEach, describe, expect, it, vi } from "vitest";

import { criarLinhasRetencao } from "@/lib/data";
import type { EntradaLinhaRetencao } from "@/lib/fiscal/retencao";

/**
 * **CONTAI-053, critério 3 — a gravação das linhas que a captura acumulou.**
 *
 * ⚠️ **Arquivo SEPARADO de `data.test.ts` de propósito**: aqui o
 * `@/lib/supabase` é mockado, e `data.test.ts` precisa do `SemSessaoError` REAL
 * para provar que `classificarErro` distingue sessão morta de falha de servidor.
 * Mockar o módulo lá tornaria aquele teste verde contra uma classe inventada.
 *
 * ⚠️ **Só o `getSupabase` é substituído** (`importOriginal` mantém o resto): o
 * que se prova aqui é o CONTRATO com o PostgREST — um único `insert` com array,
 * a contagem lida do `select` e o descarte de linha incompleta. O comportamento
 * contra o Postgres de verdade (RLS, `numeric(14,2)`, CHECKs da 0017) é provado
 * no E2E, que é onde a regra do projeto manda: stub de backend valida a suposição
 * de quem escreveu o teste, não o sistema.
 */

const insert = vi.hoisted(() => vi.fn());
const select = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase")>()),
  getSupabase: () => ({ from }),
}));

/** O caso real do Francisco: linha única, combinada, descontada de fato. */
function linha(over: Partial<EntradaLinhaRetencao> = {}): EntradaLinhaRetencao {
  return {
    rotuloLiteral: "Total das Retenções (ISSQN / Federais)",
    valorCentavos: 54_000,
    composicao: "combinado_nao_aberto",
    tributo: null,
    eDescontoEfetivo: true,
    quemRecolhe: "nao_sei",
    ...over,
  };
}

beforeEach(() => {
  from.mockReset();
  insert.mockReset();
  select.mockReset();
  from.mockReturnValue({ insert });
  insert.mockReturnValue({ select });
});

describe("criarLinhasRetencao", () => {
  it("grava TODAS as linhas em um único insert — nunca uma chamada por linha", async () => {
    select.mockResolvedValue({ data: [{ id: "a" }, { id: "b" }], error: null });

    const entraram = await criarLinhasRetencao("doc-1", [
      linha(),
      linha({ rotuloLiteral: "INSS", composicao: "tributo_identificado", tributo: "inss" }),
    ]);

    expect(entraram).toBe(2);
    // ⚠️ UMA statement: array é atômico no Postgres. Um laço multiplicaria as
    // combinações de falha parcial sem tornar nenhuma recuperável.
    expect(insert).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("documento_retencao");
    expect(insert.mock.calls[0][0]).toHaveLength(2);
  });

  it("converte centavos para o numeric(14,2) em REAIS da coluna `valor`", async () => {
    select.mockResolvedValue({ data: [{ id: "a" }], error: null });

    await criarLinhasRetencao("doc-1", [linha({ valorCentavos: 54_000 })]);

    // ⚠️ A coluna é `valor numeric(14,2)`, em reais — não existe
    // `valor_centavos` no banco (achado do `contador` no Gate Fiscal).
    expect(insert.mock.calls[0][0][0]).toEqual({
      documento_id: "doc-1",
      rotulo_literal: "Total das Retenções (ISSQN / Federais)",
      valor: 540,
      composicao: "combinado_nao_aberto",
      tributo: null,
      e_desconto_efetivo: true,
      quem_recolhe: "nao_sei",
    });
  });

  /**
   * **Gate Fiscal do ticket, literal**: linha incompleta *"não é gravada; a
   * lacuna vira pendência visível em `/documento/[id]` — nunca lida como 'sem
   * retenção'"*. Ela conta como NÃO ENTROU, e é a tela de confirmação que relata.
   */
  it("descarta a linha incompleta e NÃO a grava pela metade", async () => {
    select.mockResolvedValue({ data: [{ id: "a" }], error: null });

    const entraram = await criarLinhasRetencao("doc-1", [
      linha(),
      // "sim" no desconto efetivo sem dizer quem recolhe: o CHECK
      // `documento_retencao_recolhedor_coerente` recusaria a linha inteira e
      // abortaria a statement — junto com a linha boa.
      linha({ quemRecolhe: null }),
    ]);

    expect(entraram).toBe(1);
    expect(insert.mock.calls[0][0]).toHaveLength(1);
  });

  it("lista vazia (ou só com linhas incompletas) não chama o banco", async () => {
    expect(await criarLinhasRetencao("doc-1", [])).toBe(0);
    expect(await criarLinhasRetencao("doc-1", [linha({ composicao: null })])).toBe(
      0,
    );
    expect(from).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ **A contagem sai do `select`, não do array enviado.** RLS que filtra não
   * é erro para o PostgREST: ele devolve 200 com menos linhas — o mesmo silêncio
   * que `removerLinhaRetencao` transforma em mensagem. Contar o que se mandou
   * seria dar por gravado o que o banco recusou em silêncio.
   */
  it("conta o que o servidor devolveu, não o que o app mandou", async () => {
    select.mockResolvedValue({ data: [], error: null });
    expect(await criarLinhasRetencao("doc-1", [linha(), linha()])).toBe(0);

    select.mockResolvedValue({ data: null, error: null });
    expect(await criarLinhasRetencao("doc-1", [linha()])).toBe(0);
  });

  it("erro do PostgREST sobe — quem decide o que dizer é a tela", async () => {
    select.mockResolvedValue({
      data: null,
      error: { code: "PGRST000", message: "could not connect" },
    });

    await expect(criarLinhasRetencao("doc-1", [linha()])).rejects.toMatchObject({
      code: "PGRST000",
    });
  });
});
