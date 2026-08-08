/**
 * Resumo da home (mock v4, tela 1): custo confirmado do ano, acumulado do
 * imóvel e a lista de pendências com a consequência fiscal explícita.
 * Módulo puro.
 *
 * Regras aplicadas (todas do ticket / CLAUDE.md):
 * - Custo é regime de caixa: entra pela DATA DO PAGAMENTO.
 * - Só conta como custo o pagamento sustentado por documento hábil — boleto
 *   sozinho não sustenta, e documento em quarentena não é hábil.
 * - Acumulado = situação em 31/12 na ficha Bens e Direitos = terreno + obra.
 */

import type { Documento, Obra, Pagamento } from "@/lib/types";
import {
  CONSEQUENCIA_BOLETO,
  CONSEQUENCIA_QUARENTENA,
  CONSEQUENCIA_SEM_RETENCAO,
} from "./documento";
import { anoCalendario, CONSEQUENCIA_PAGO_SEM_NOTA } from "./pagamento";

export type TipoPendencia =
  | "quarentena"
  | "boleto_sem_nf"
  | "pago_sem_nota"
  | "servico_sem_retencao";

export interface Pendencia {
  id: string;
  tipo: TipoPendencia;
  chip: string;
  titulo: string;
  detalhe: string;
  valorCentavos: number;
  consequencia: string;
  gravidade: "red" | "amb";
  /** Rota do detalhe, quando existe documento único por trás. */
  href?: string;
}

export interface ResumoObra {
  ano: number;
  custoConfirmadoAnoCentavos: number;
  acumuladoImovelCentavos: number;
  emPendenciaCentavos: number;
  pendencias: Pendencia[];
}

export interface EntradaResumo {
  obra: Obra;
  documentos: Documento[];
  pagamentos: Pagamento[];
  ano: number;
}

const SEM_FAVORECIDO = "Favorecido não informado";

/**
 * O pagamento sustenta custo quando está conciliado a pelo menos um documento
 * que não está em quarentena. Documento em quarentena não é documento hábil.
 */
function sustentaCusto(
  pagamento: Pagamento,
  documentosHabeisIds: ReadonlySet<string>,
): boolean {
  if (pagamento.status !== "conciliado") return false;
  return pagamento.documentoIds.some((id) => documentosHabeisIds.has(id));
}

export function calcularResumo(entrada: EntradaResumo): ResumoObra {
  const { obra, documentos, pagamentos, ano } = entrada;

  const habeis = new Set(
    documentos.filter((d) => d.status !== "quarentena").map((d) => d.id),
  );

  let custoAno = 0;
  let custoAteFimDoAno = 0;
  for (const p of pagamentos) {
    if (!sustentaCusto(p, habeis)) continue;
    const anoPagamento = anoCalendario(p.dataPagamento);
    if (anoPagamento === ano) custoAno += p.valorCentavos;
    if (anoPagamento <= ano) custoAteFimDoAno += p.valorCentavos;
  }

  const pendencias: Pendencia[] = [];

  // 1 · Documento fora do CPF do dono → quarentena.
  for (const d of documentos) {
    if (d.status !== "quarentena") continue;
    pendencias.push({
      id: `quarentena:${d.id}`,
      tipo: "quarentena",
      chip: "Quarentena",
      titulo: d.tipo === "boleto" ? "Boleto fora do seu CPF" : "NF fora do seu CPF",
      detalhe: d.favorecidoNome ?? SEM_FAVORECIDO,
      valorCentavos: d.valorCentavos ?? 0,
      consequencia: CONSEQUENCIA_QUARENTENA,
      gravidade: "red",
      href: `/documento/${d.id}`,
    });
  }

  // 2 · Boleto registrado: título de cobrança, ainda sem NF que sustente.
  for (const d of documentos) {
    if (d.tipo !== "boleto" || d.status !== "aguardando_pagamento") continue;
    pendencias.push({
      id: `boleto:${d.id}`,
      tipo: "boleto_sem_nf",
      chip: "Aguardando NF",
      titulo: "Boleto sem nota vinculada",
      detalhe: d.favorecidoNome ?? SEM_FAVORECIDO,
      valorCentavos: d.valorCentavos ?? 0,
      consequencia: CONSEQUENCIA_BOLETO,
      gravidade: "amb",
    });
  }

  // 3 · Exposição "pago sem nota", acumulada por favorecido (US-007, item 4).
  const porFavorecido = new Map<
    string,
    { nome: string; total: number; qtd: number; sohPix: boolean }
  >();
  for (const p of pagamentos) {
    if (p.status !== "aguardando_nf") continue;
    const chave = p.favorecidoId ?? `sem-favorecido:${p.id}`;
    const atual = porFavorecido.get(chave) ?? {
      nome: p.favorecidoNome ?? SEM_FAVORECIDO,
      total: 0,
      qtd: 0,
      sohPix: true,
    };
    atual.total += p.valorCentavos;
    atual.qtd += 1;
    atual.sohPix = atual.sohPix && p.meio === "pix";
    porFavorecido.set(chave, atual);
  }
  for (const [chave, agregado] of porFavorecido) {
    const unidade = agregado.sohPix
      ? "PIX"
      : agregado.qtd === 1
        ? "pagamento"
        : "pagamentos";
    pendencias.push({
      id: `pago-sem-nota:${chave}`,
      tipo: "pago_sem_nota",
      chip: "Pago sem nota",
      titulo: `${agregado.qtd} ${unidade} sem NF vinculada`,
      detalhe: agregado.nome,
      valorCentavos: agregado.total,
      consequencia: CONSEQUENCIA_PAGO_SEM_NOTA,
      gravidade: "red",
    });
  }

  // 4 · NF de serviço sem retenção confirmada → não abate no INSS (SERO).
  for (const d of documentos) {
    if (d.tipo !== "nf_servico" || d.status === "quarentena") continue;
    if (d.retencao11 === true) continue;
    pendencias.push({
      id: `sem-retencao:${d.id}`,
      tipo: "servico_sem_retencao",
      chip: "Sem retenção 11%",
      titulo: "NF de serviço sem retenção",
      detalhe: d.favorecidoNome ?? SEM_FAVORECIDO,
      valorCentavos: d.valorCentavos ?? 0,
      consequencia: CONSEQUENCIA_SEM_RETENCAO,
      gravidade: "amb",
      href: `/documento/${d.id}`,
    });
  }

  const emPendencia = pendencias.reduce((s, p) => s + p.valorCentavos, 0);

  return {
    ano,
    custoConfirmadoAnoCentavos: custoAno,
    acumuladoImovelCentavos: obra.valorTerrenoCentavos + custoAteFimDoAno,
    emPendenciaCentavos: emPendencia,
    pendencias,
  };
}
