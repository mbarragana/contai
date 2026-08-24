"use client";

/**
 * A PORTA COMPOSTA das saídas anuais — CONTAI-036, critérios 10 e 12.
 *
 * ⚠️ **Por que ela existe, e por que a tela não pode fazer isto sozinha.**
 *
 * A porta pura (`podeGerarRelatorioAnual`, `lib/fiscal/compromisso.ts`) precisa
 * de quatro coisas para decidir. Enquanto a tela montava esses quatro
 * argumentos, o **residual 1** do `CONTAI-025` ficava de pé: uma tela apressada
 * escrevia `podeGerarRelatorioAnual(cs, hoje, ano, [])`, isso **typechecava**, e
 * a guarda do terreno sumia sem ninguém apagar linha nenhuma — porque "nenhum
 * desembolso" e "não fui buscar os desembolsos" tinham a mesma forma.
 *
 * Agora não têm: o 4º parâmetro é opaco e **este arquivo é quem o produz**. A
 * tela passa `obraId` e um ano, e não tem como montar argumento nenhum.
 *
 * ⚠️ **UMA passada, não três** (critério 12): o mesmo carregamento serve aos
 * três blocos. Três varreduras e três carregadores é como se recria a D47 com
 * outro rosto — cada caminho consultando um portão diferente.
 */

import {
  desembolsosCarregados,
  podeGerarRelatorioAnual,
  type PermissaoRelatorio,
} from "@/lib/fiscal/compromisso";
import {
  gerarBensEDireitos,
  type Discriminacao,
} from "@/lib/fiscal/discriminacao";
import { alocarCusto } from "@/lib/fiscal/vinculo";
import { hojeIso } from "@/lib/hoje";
import { carregarCompromissos, carregarPainel } from "@/lib/data";
import type { Compromisso, Obra } from "@/lib/types";

/**
 * O que a tela da discriminação recebe. Repare no que **não** está aqui:
 * nenhuma marca, nenhum desembolso solto, nenhum argumento a montar.
 */
export type SaidaAnualDaObra =
  | {
      /**
       * O portão TRANSVERSAL (crit. 21 do `CONTAI-019`) fechou: compromisso
       * vencido sem resposta veta **as três** saídas, não só esta.
       */
      ok: false;
      obra: Obra;
      ano: number;
      faltamResponder: Compromisso[];
    }
  | { ok: true; obra: Obra; ano: number; discriminacao: Discriminacao };

/**
 * Carrega, consulta a porta única e — só se ela liberar — gera o texto.
 *
 * ⚠️ **A ordem importa e não é estilo**: o gerador é chamado **com a marca que
 * a porta acabou de devolver**, dentro do mesmo fluxo. Não há caminho em que a
 * discriminação nasça sem a porta ter dito sim, porque não há como obter a
 * marca de outro jeito.
 */
export async function carregarSaidaAnual(
  obraId: string,
  ano: number,
): Promise<SaidaAnualDaObra> {
  const [painel, compromissos] = await Promise.all([
    carregarPainel(obraId),
    carregarCompromissos(obraId),
  ]);

  const permissao: PermissaoRelatorio = podeGerarRelatorioAnual(
    compromissos,
    hojeIso(),
    ano,
    desembolsosCarregados(painel.desembolsosTerreno),
  );

  if (!permissao.ok) {
    return {
      ok: false,
      obra: painel.obra,
      ano,
      faltamResponder: permissao.faltamResponder,
    };
  }

  const discriminacao = gerarBensEDireitos(permissao.bensEDireitos, {
    obra: painel.obra,
    alocacao: alocarCusto({
      documentos: painel.documentos,
      pagamentos: painel.pagamentos,
    }),
    desembolsosTerreno: painel.desembolsosTerreno,
    informes: painel.informesFinanciamento,
    financiamento: painel.financiamento,
  });

  return { ok: true, obra: painel.obra, ano, discriminacao };
}
