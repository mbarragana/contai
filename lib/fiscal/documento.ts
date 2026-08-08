/**
 * Regras fiscais do registro de documento (CONTAI-001, Gate Fiscal).
 * Módulo puro: nenhuma dependência de rede ou de UI.
 *
 * Fonte das regras — nada aqui é inferido:
 * - "Documento hábil: NF de material com CPF do dono como destinatário; NF de
 *   serviço com ele como tomador. Divergência → quarentena" (Gate Fiscal)
 * - "NF de serviço PJ → capturar flag de retenção 11%" (Gate Fiscal)
 * - "Boleto NÃO é documento hábil sozinho — é título de cobrança" (Gate Fiscal)
 * - "Classificação material vs. serviço: incerteza → revisão humana, nunca
 *   chute silencioso" (Gate Fiscal)
 */

import type { Classificacao, StatusDocumento, TipoDocumento } from "@/lib/types";
import { tipoPorDocumento } from "./identificacao";

/** Check fiscal obrigatório 1 — "esta nota está no seu CPF?" (critério 4). */
export type RespostaCpf = "sim" | "nao";

/** Check fiscal obrigatório 2 — "tem retenção de 11%?" (critério 5). */
export type RespostaRetencao = "sim" | "nao" | "nao_sei";

export interface EntradaDocumento {
  tipo: TipoDocumento | null;
  favorecidoNome: string;
  favorecidoDocumento: string;
  valorCentavos: number | null;
  /** ISO (yyyy-mm-dd) — só boleto. */
  vencimento: string | null;
  classificacao: Classificacao | null;
  notaNoCpf: RespostaCpf | null;
  retencao11: RespostaRetencao | null;
  temArquivo: boolean;
}

export interface ErroCampo {
  campo: keyof EntradaDocumento;
  mensagem: string;
}

export const MOTIVO_QUARENTENA_CPF =
  "Documento não está no CPF do dono da obra — não entra no custo de aquisição.";

export const CONSEQUENCIA_QUARENTENA =
  "Não entra no custo de aquisição. Peça a nota no seu CPF.";

export const CONSEQUENCIA_SEM_RETENCAO =
  "Não abate na aferição do INSS da obra (SERO).";

export const CONSEQUENCIA_BOLETO =
  "Boleto não é documento hábil. O custo só se sustenta com a NF.";

/**
 * Proposta de classificação a partir do tipo escolhido. Boleto não diz o que
 * foi comprado → `null`, e o formulário exige resposta humana.
 */
export function classificacaoProposta(
  tipo: TipoDocumento | null,
): Classificacao | null {
  if (tipo === "nf_material") return "material";
  if (tipo === "nf_servico") return "mao_obra";
  return null;
}

/** A pergunta de retenção só faz sentido em NF de serviço. */
export function exigeRetencao(tipo: TipoDocumento | null): boolean {
  return tipo === "nf_servico";
}

/** "não sei" não vira "não": vai como desconhecido (null) para o banco. */
export function retencaoParaBanco(
  resposta: RespostaRetencao | null,
): boolean | null {
  if (resposta === "sim") return true;
  if (resposta === "nao") return false;
  return null;
}

/**
 * Status de nascimento do documento.
 * - nota fora do CPF → quarentena (constraint documento_quarentena_coerente)
 * - boleto → aguardando_pagamento: título de cobrança, não sustenta custo
 * - demais → registrado
 */
export function statusDocumento(
  tipo: TipoDocumento | null,
  notaNoCpf: RespostaCpf | null,
): StatusDocumento {
  if (notaNoCpf === "nao") return "quarentena";
  if (tipo === "boleto") return "aguardando_pagamento";
  return "registrado";
}

export function motivoQuarentena(notaNoCpf: RespostaCpf | null): string | null {
  return notaNoCpf === "nao" ? MOTIVO_QUARENTENA_CPF : null;
}

/**
 * Aviso do INSS (não bloqueia — critério 5): NF de serviço sem retenção
 * confirmada não abate na aferição do SERO.
 */
export function avisaInss(
  tipo: TipoDocumento | null,
  retencao11: RespostaRetencao | null,
): boolean {
  return exigeRetencao(tipo) && retencao11 !== null && retencao11 !== "sim";
}

/**
 * Validação do formulário. Nada é aceito em silêncio: sem arquivo, sem os
 * dois checks fiscais e sem classificação, não salva.
 */
export function validarDocumento(entrada: EntradaDocumento): ErroCampo[] {
  const erros: ErroCampo[] = [];

  // Critério 6 + decisão manual-first: anexo obrigatório, o acervo nasce aqui.
  if (!entrada.temArquivo) {
    erros.push({
      campo: "temArquivo",
      mensagem: "Anexe o arquivo do documento — sem ele o registro não é aceito.",
    });
  }

  if (entrada.tipo === null) {
    erros.push({ campo: "tipo", mensagem: "Escolha o tipo do documento." });
  }

  if (entrada.favorecidoNome.trim().length < 2) {
    erros.push({
      campo: "favorecidoNome",
      mensagem: "Informe o nome do emitente.",
    });
  }

  if (tipoPorDocumento(entrada.favorecidoDocumento) === null) {
    erros.push({
      campo: "favorecidoDocumento",
      mensagem: "CNPJ/CPF inválido — confira os dígitos na nota.",
    });
  }

  if (entrada.valorCentavos === null || entrada.valorCentavos <= 0) {
    erros.push({ campo: "valorCentavos", mensagem: "Informe o valor." });
  }

  if (entrada.tipo === "boleto" && !entrada.vencimento) {
    erros.push({
      campo: "vencimento",
      mensagem: "Informe o vencimento do boleto.",
    });
  }

  // Gate Fiscal: classificação incerta → revisão humana, nunca chute.
  if (entrada.classificacao === null) {
    erros.push({
      campo: "classificacao",
      mensagem: "Classifique como material ou mão de obra.",
    });
  }

  // Critério 4: sem resposta não salva.
  if (entrada.notaNoCpf === null) {
    erros.push({
      campo: "notaNoCpf",
      mensagem: "Responda se o documento está no seu CPF.",
    });
  }

  // Critério 5: obrigatório responder em NF de serviço ("não sei" é resposta).
  if (exigeRetencao(entrada.tipo) && entrada.retencao11 === null) {
    erros.push({
      campo: "retencao11",
      mensagem: "Responda sobre a retenção de 11% (vale responder 'não sei').",
    });
  }

  return erros;
}
