import { describe, expect, it } from "vitest";

import { SemRespostaDoServidorError } from "@/lib/rede";
import { SemSessaoError } from "@/lib/supabase";

import {
  SEM_RESPOSTA_NA_LEITURA,
  classificarErro,
  gravacaoFoiIncerta,
  mensagemDeErro,
  mensagemDeErroDeGravacao,
} from "./erros";

/**
 * CONTAI-006, critério 6 — o ticket chama isto de "a mentira em lugar mais
 * discreto": o mesmo texto genérico saía para uma LEITURA que falhou (repetir é
 * seguro) e para uma GRAVAÇÃO que falhou sem resposta nenhuma (repetir pode
 * duplicar o registro). Estes testes travam a separação.
 */

/** Como o erro de rede chega depois de atravessar o postgrest-js. */
const SEM_RESPOSTA_EMBRULHADO = {
  message: "SemRespostaDoServidor: Sem resposta do servidor depois de 3 tentativa(s).",
  details: "",
  hint: "",
  code: "",
};

describe("mensagemDeErro (leitura)", () => {
  it("troca o ruído técnico do erro de rede por um texto com saída", () => {
    expect(mensagemDeErro(SEM_RESPOSTA_EMBRULHADO)).toBe(SEM_RESPOSTA_NA_LEITURA);
    expect(mensagemDeErro(new SemRespostaDoServidorError("x"))).toBe(
      SEM_RESPOSTA_NA_LEITURA,
    );
  });

  it("preserva a mensagem específica do servidor", () => {
    // Violação de RLS, check constraint, unicidade: erro COM resposta continua
    // chegando ao Mateus como o que é, não como problema de rede.
    expect(
      mensagemDeErro({
        message: 'new row violates check constraint "documento_quarentena_coerente"',
        code: "23514",
      }),
    ).toContain("documento_quarentena_coerente");
    expect(mensagemDeErro(new Error("CNPJ/CPF inválido."))).toBe(
      "CNPJ/CPF inválido.",
    );
  });

  it("mantém 'sem sessão' como erro próprio, com outra saída", () => {
    expect(classificarErro(new SemSessaoError())).toEqual({ tipo: "sem_sessao" });
  });
});

describe("mensagemDeErroDeGravacao", () => {
  const ONDE = "na lista de documentos desta obra";

  it("⚠️ sem resposta: admite que NÃO SABE, e manda conferir antes de repetir", () => {
    const texto = mensagemDeErroDeGravacao(SEM_RESPOSTA_EMBRULHADO, ONDE);
    expect(texto).toBe(
      "Não deu para confirmar se isso foi salvo. Antes de tentar de novo, " +
        `confira ${ONDE} — repetir sem conferir pode duplicar o registro.`,
    );
    // E não pode cair no texto de leitura, que convida a repetir sem ressalva.
    expect(texto).not.toBe(SEM_RESPOSTA_NA_LEITURA);
  });

  it("servidor recusou: a mensagem específica continua valendo", () => {
    expect(
      mensagemDeErroDeGravacao({ message: "CNPJ/CPF inválido.", code: "" }, ONDE),
    ).toBe("CNPJ/CPF inválido.");
  });

  it("marca só o caso incerto — é o que cala o 'Nada foi alterado' da tela", () => {
    expect(gravacaoFoiIncerta(mensagemDeErroDeGravacao(SEM_RESPOSTA_EMBRULHADO, ONDE))).toBe(
      true,
    );
    expect(gravacaoFoiIncerta(mensagemDeErroDeGravacao(new Error("recusado"), ONDE))).toBe(
      false,
    );
    expect(gravacaoFoiIncerta(SEM_RESPOSTA_NA_LEITURA)).toBe(false);
  });
});
