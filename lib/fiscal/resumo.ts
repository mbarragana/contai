/**
 * Resumo da home: custo confirmado do ano, acumulado do imóvel, as pendências
 * com a consequência fiscal explícita e — desde o CONTAI-018 — o TERCEIRO
 * ESTADO e as despesas já comprovadas. Módulo puro.
 *
 * Regras aplicadas (todas do parecer / CLAUDE.md):
 * - Custo é regime de caixa: entra pela DATA DO PAGAMENTO.
 * - Só conta como custo o pagamento coberto por documento hábil VINCULADO —
 *   boleto sozinho não sustenta, e documento em quarentena não é hábil.
 * - `pagamento.status` NÃO é consultado por decisão de custo nenhuma
 *   (parecer §2; critérios 4 e 7 do CONTAI-018). O cálculo inteiro vem de
 *   `lib/fiscal/vinculo.ts`.
 * - Acumulado = situação em 31/12 na ficha Bens e Direitos = terreno + obra,
 *   e o terreno é preço + ITBI + escritura/registro (IN SRF 84/2001 art. 17).
 * - Nada é somado entre obras: a entrada é de UMA obra (CONTAI-003, crit. 9).
 */

import type { Documento, Obra, Pagamento, TipoFavorecido } from "@/lib/types";
import {
  CONSEQUENCIA_BOLETO,
  CONSEQUENCIA_QUARENTENA,
  CONSEQUENCIA_SEM_RETENCAO,
} from "./documento";
import { custoTerrenoCentavos } from "./obra";
import { anoCalendario, rotulosPagoSemNota } from "./pagamento";
import {
  alocarCusto,
  custoComprovadoAteOAno,
  custoComprovadoDoAno,
  despesasComprovadas,
  documentosHabeisSemPagamento,
  type Alocacao,
} from "./vinculo";

export type TipoPendencia =
  | "quarentena"
  | "boleto_sem_nf"
  | "pago_sem_nota"
  | "servico_sem_retencao";

/** Registro individual por trás de uma pendência agregada — leva ao seletor. */
export interface ItemPendencia {
  id: string;
  rotulo: string;
  href: string;
}

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
  /** Critério 3: o cartão "pago sem nota" leva ao seletor, registro a registro. */
  itens?: ItemPendencia[];
}

/**
 * O terceiro estado do parecer §5.2: nota hábil registrada, ainda sem
 * pagamento ligado. **Não soma** com o custo confirmado nem com o em risco —
 * é por isso que isto NÃO é uma `Pendencia` (a lista de pendências alimenta
 * `emPendenciaCentavos`, e somar aqui inflaria a exposição).
 */
export interface NotaSemPagamento {
  id: string;
  titulo: string;
  detalhe: string;
  valorCentavos: number;
  href: string;
}

/**
 * Critério 13: depois do vínculo a despesa aparece UMA vez — o par, não a NF e
 * o PIX lado a lado. É a resposta à palavra "duplicadas" do relato.
 */
export interface DespesaComprovada {
  id: string;
  titulo: string;
  detalhe: string;
  /** Custo comprovado do conjunto inteiro (todos os anos). */
  valorCentavos: number;
  /** A parte que cai no ano em tela — regime de caixa. */
  noAnoCentavos: number;
  href: string;
}

export interface ResumoObra {
  ano: number;
  custoConfirmadoAnoCentavos: number;
  acumuladoImovelCentavos: number;
  emPendenciaCentavos: number;
  pendencias: Pendencia[];
  /** Terceiro número em tela (parecer §5.2) — fora das duas somas. */
  notasSemPagamento: NotaSemPagamento[];
  notasSemPagamentoCentavos: number;
  despesas: DespesaComprovada[];
  /** Critério 14: havendo registro, o zero nunca pode aparecer mudo. */
  temRegistro: boolean;
  /** Para as telas que precisam do detalhe por registro. */
  alocacao: Alocacao;
}

export interface EntradaResumo {
  obra: Obra;
  documentos: Documento[];
  pagamentos: Pagamento[];
  ano: number;
}

const SEM_FAVORECIDO = "Favorecido não informado";

const NOME_TIPO_CURTO: Record<Documento["tipo"], string> = {
  nf_material: "NF de material",
  nf_servico: "NF de serviço",
  boleto: "Boleto",
};

function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function calcularResumo(entrada: EntradaResumo): ResumoObra {
  const { obra, documentos, pagamentos, ano } = entrada;

  // TODO o cálculo de custo sai daqui — e nenhuma linha dele olha `status`.
  const alocacao = alocarCusto({ documentos, pagamentos });

  const custoAno = custoComprovadoDoAno(alocacao, ano);
  const custoAteFimDoAno = custoComprovadoAteOAno(alocacao, ano);

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
      // O chip reflete o estado gravado (`aguardando_pagamento`): o boleto
      // ainda não foi pago. O ciclo de vida completo do boleto continua fora.
      chip: "Aguardando pagamento",
      titulo: "Boleto sem nota vinculada",
      detalhe: d.favorecidoNome ?? SEM_FAVORECIDO,
      valorCentavos: d.valorCentavos ?? 0,
      consequencia: CONSEQUENCIA_BOLETO,
      gravidade: "amb",
      href: `/documento/${d.id}`,
    });
  }

  // 3 · Exposição "pago sem nota", acumulada por favorecido (US-007, item 4).
  //
  // Mudou no CONTAI-018: o que expõe NÃO é mais `status === 'aguardando_nf'`
  // (filtro que o parecer §2 derrubou), é o EXCEDENTE NÃO COBERTO do
  // pagamento. Pagamento coberto por inteiro some daqui — critério 13, a
  // despesa vinculada deixa de aparecer duas vezes.
  const porFavorecido = new Map<
    string,
    {
      nome: string;
      tipo: TipoFavorecido | null;
      total: number;
      qtd: number;
      sohPix: boolean;
      itens: ItemPendencia[];
    }
  >();
  for (const p of pagamentos) {
    const semNota = alocacao.porPagamento.get(p.id)?.semNotaCentavos ?? 0;
    if (semNota <= 0) continue;
    const chave = p.favorecidoId ?? `sem-favorecido:${p.id}`;
    const atual = porFavorecido.get(chave) ?? {
      nome: p.favorecidoNome ?? SEM_FAVORECIDO,
      tipo: p.favorecidoTipo,
      total: 0,
      qtd: 0,
      sohPix: true,
      itens: [],
    };
    atual.total += semNota;
    atual.qtd += 1;
    atual.sohPix = atual.sohPix && p.meio === "pix";
    atual.itens.push({
      id: p.id,
      rotulo: dataBR(p.dataPagamento),
      href: `/pagamento/${p.id}`,
    });
    porFavorecido.set(chave, atual);
  }
  for (const [chave, agregado] of porFavorecido) {
    const unidade = agregado.sohPix
      ? "PIX"
      : agregado.qtd === 1
        ? "pagamento"
        : "pagamentos";
    const rotulos = rotulosPagoSemNota(agregado.tipo);
    pendencias.push({
      id: `pago-sem-nota:${chave}`,
      tipo: "pago_sem_nota",
      chip: rotulos.chip,
      titulo: `${agregado.qtd} ${unidade} ${rotulos.semVinculo}`,
      detalhe: agregado.nome,
      valorCentavos: agregado.total,
      consequencia: rotulos.consequencia,
      gravidade: "red",
      itens: agregado.itens,
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

  // O terceiro estado. Fica FORA de `pendencias` de propósito: o parecer §5.2
  // exige que este número não some com o confirmado nem com o em risco.
  const notasSemPagamento: NotaSemPagamento[] = documentosHabeisSemPagamento(
    alocacao,
  ).map(({ documento: d }) => ({
    id: `sem-pagamento:${d.id}`,
    titulo: `${NOME_TIPO_CURTO[d.tipo]} sem pagamento ligado`,
    detalhe: d.favorecidoNome ?? SEM_FAVORECIDO,
    valorCentavos: d.valorCentavos ?? 0,
    href: `/documento/${d.id}`,
  }));

  // Mais recente primeiro: é o que o Mateus acabou de conciliar. A ordenação
  // vem antes do `map` para o tipo de saída não carregar campo de ordenação.
  const despesas: DespesaComprovada[] = [...despesasComprovadas(alocacao)]
    .sort((a, b) =>
      (a.pagamentos.at(-1)?.dataPagamento ?? "") <
      (b.pagamentos.at(-1)?.dataPagamento ?? "")
        ? 1
        : -1,
    )
    .map((c) => {
      const habeis = c.documentos.filter(
        (d) => d.tipo !== "boleto" && d.status !== "quarentena",
      );
      const noAno = c.pagamentos.reduce(
        (s, p) =>
          anoCalendario(p.dataPagamento) === ano
            ? s + (alocacao.porPagamento.get(p.id)?.comprovadoCentavos ?? 0)
            : s,
        0,
      );
      const doc = habeis[0] ?? c.documentos[0];
      const nomes = [...new Set(habeis.map((d) => d.favorecidoNome ?? SEM_FAVORECIDO))];
      return {
        id: c.id,
        titulo: nomes.join(" · ") || SEM_FAVORECIDO,
        detalhe:
          `${habeis.length} ${habeis.length === 1 ? "documento hábil" : "documentos hábeis"}` +
          ` + ${c.pagamentos.length} ${c.pagamentos.length === 1 ? "pagamento" : "pagamentos"}` +
          " — uma despesa, não duas",
        valorCentavos: c.custoComprovadoCentavos,
        noAnoCentavos: noAno,
        href: doc ? `/documento/${doc.id}` : `/pagamento/${c.pagamentos[0].id}`,
      };
    });

  return {
    ano,
    custoConfirmadoAnoCentavos: custoAno,
    acumuladoImovelCentavos: custoTerrenoCentavos(obra) + custoAteFimDoAno,
    emPendenciaCentavos: emPendencia,
    pendencias,
    notasSemPagamento,
    notasSemPagamentoCentavos: notasSemPagamento.reduce(
      (s, n) => s + n.valorCentavos,
      0,
    ),
    despesas,
    temRegistro: documentos.length > 0 || pagamentos.length > 0,
    alocacao,
  };
}
