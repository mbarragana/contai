/**
 * Contrato da extração automática de documento (US-008, Fase 2). Puro — sem
 * chamada de rede aqui, só o formato que qualquer provedor tem que devolver.
 *
 * Deliberadamente FORA daqui: `notaNoCpf` e o gate de retenção. São perguntas
 * fiscais que o parecer do `contador` (2026-08-xx, regra "campo fiscal não
 * tem default") exige resposta humana — a extração nunca responde por ele, só
 * preenche o que é leitura de dado impresso na nota.
 *
 * ⚠️ **CONTAI-038, critério 14 — a trava que impede o pre-mortem 2.** Quando as
 * linhas de retenção entrarem aqui (não entram nesta rodada; ver decisão de
 * design 4 do spec), `composicao`, o tributo específico, `e_desconto_efetivo` e
 * `quem_recolhe` chegam **SEMPRE EM BRANCO**, mesmo que o texto da nota permita
 * uma inferência plausível: são classificação fiscal, não leitura de texto
 * impresso, e o app nunca rotula a linha antes de o Mateus escolher (parecer de
 * 2026-09-18, §3/§4). `rotulo_literal` e `valor`, esses sim, **podem** ser
 * sugeridos — são leitura, e ele confirma antes de salvar, como todo campo
 * extraído hoje.
 */

import { z } from "zod";

export const ExtracaoDocumentoSchema = z.object({
  tipo: z.enum(["nf_material", "nf_servico", "boleto"]).nullable(),
  numero: z.string().nullable(),
  serie: z.string().nullable(),
  /** AAAA-MM-DD, ou `null` quando a nota não deixa claro. Nunca inventada. */
  dataEmissao: z.string().nullable(),
  /** Só relevante para boleto — AAAA-MM-DD. */
  vencimento: z.string().nullable(),
  favorecidoNome: z.string().nullable(),
  /** Só dígitos — CPF (11) ou CNPJ (14) de quem EMITIU o documento. */
  favorecidoDocumento: z.string().nullable(),
  /** Valor BRUTO do documento, em reais (não em centavos). */
  valorReais: z.number().nullable(),
  classificacao: z.enum(["material", "mao_obra"]).nullable(),
  /**
   * Leitura honesta de confiança do próprio modelo — não é validação fiscal,
   * é "quão legível estava o PDF". `baixa` é o sinal para o Mateus olhar
   * campo a campo antes de confiar.
   */
  confianca: z.enum(["alta", "media", "baixa"]).nullable(),
});

export type ExtracaoDocumento = z.infer<typeof ExtracaoDocumentoSchema>;

/** Nenhum campo lido — o caso "PDF ilegível" ou "não é nota nenhuma". */
export const EXTRACAO_VAZIA: ExtracaoDocumento = {
  tipo: null,
  numero: null,
  serie: null,
  dataEmissao: null,
  vencimento: null,
  favorecidoNome: null,
  favorecidoDocumento: null,
  valorReais: null,
  classificacao: null,
  confianca: null,
};

/** `valorReais` → centavos, arredondado — a mesma unidade do resto do app. */
export function paraCentavos(valorReais: number | null): number | null {
  if (valorReais === null || !Number.isFinite(valorReais)) return null;
  return Math.round(valorReais * 100);
}
