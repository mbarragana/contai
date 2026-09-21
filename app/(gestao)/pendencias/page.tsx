"use client";

import Link from "next/link";

import { AvisoEquiparacao } from "@/app/_components/obra";
import { ItemDaFila, NadaAberto } from "@/app/_components/fila-pendencias";
import { useGestao } from "@/app/_components/gestao";
import {
  Banner,
  Card,
  Carregando,
  Dica,
  EstadoErro,
  Passo,
} from "@/app/_components/ui";
import { formatarDataBR } from "@/lib/fiscal/obra";
import type { PendenciasUnificadas } from "@/lib/fiscal/pendencias-unificadas";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import type { Obra } from "@/lib/types";

const ROTULO_DESFECHO: Record<string, string> = {
  retifiquei_a_daa: "retifiquei a DAA",
  contador_avaliou_nao_retifica: "meu contador avaliou e não é preciso retificar",
  daa_ainda_nao_entregue: "a DAA ainda não foi entregue",
  cnpj_gravado_esta_certo:
    "conferi o papel: o CNPJ gravado está certo — o erro foi meu ao marcar",
  apontamento_corrigido: "o apontamento foi corrigido",
};

/**
 * **A lista de pendências — as DEZOITO famílias, numa fila só (CONTAI-042).**
 *
 * Até o 042 esta tela cobria duas: a correção de ano anterior e o CNPJ errado. As
 * outras dezesseis viviam agregadas dentro da home, e nenhuma superfície do app
 * as enumerava juntas — foi assim que o banner *"Nenhuma pendência"* pôde
 * conviver com um card vermelho na mesma tela (**D59**).
 *
 * Quem decide o que entra, em que ordem e quantas são é
 * `lib/fiscal/pendencias-unificadas.ts` — pura e com teste. Esta tela **desenha**
 * e não julga: cada família é renderizada pelo componente que já existia, com o
 * texto que já existia.
 *
 * ⚠️ **CONTAI-040**: a tela perdeu o `AppBar`, o `Corpo` e a `BarraAdicionar` —
 * título, rolagem e a porta de registro agora são do shell (`app/(gestao)/`), e
 * tê-los aqui seria o mesmo alvo duas vezes na mesma tela. E o carregamento saiu
 * daqui para o contexto do shell: a obra aberta é escolhida **uma vez** por
 * carga, e é a mesma que alimenta o badge da sidebar (Pre-mortem 3 do 040).
 *
 * ⚠️ **Dois escopos, e eles são ditos, não inferidos** (Gate Fiscal do
 * `contador`, 2026-09-21, §3.4): as persistentes são de **todas as obras** — é
 * assim que esta tela sempre funcionou, e restringi-las à obra aberta faria a
 * correção de outra obra perder a única superfície que tem —, e as derivadas são
 * da **obra aberta**, porque `calcularResumo` é de uma obra só.
 *
 * ⚠️ **Nenhum valor é somado aqui.** Nem total, nem subtotal por grupo. O valor
 * por linha continua onde já estava; o que não tinha valor não ganha. É a lição
 * do `emPendenciaCentavos` morto no CONTAI-005.
 */
export default function Pendencias() {
  const { estado, tentarDeNovo } = useGestao();

  if (estado.fase === "carregando") {
    return <Carregando rotulo="Carregando as pendências" />;
  }
  if (estado.fase === "erro") {
    return <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />;
  }

  return (
    <ListaDePendencias
      unificadas={estado.unificadas}
      obra={estado.painel?.obra ?? null}
      obras={estado.obras}
      ano={estado.ano}
    />
  );
}

function ListaDePendencias({
  unificadas,
  obra,
  obras,
  ano,
}: {
  unificadas: PendenciasUnificadas;
  obra: Obra | null;
  obras: Map<string, string>;
  ano: number;
}) {
  const hoje = hojeIso();
  const vermelhas = unificadas.itens.filter((i) => i.bloco === "vermelho");
  const ambares = unificadas.itens.filter((i) => i.bloco === "ambar");
  const informativos = unificadas.itens.filter((i) => i.bloco === "informativo");
  const { correcoes, emitente } = unificadas.baixadas;

  return (
    <>
      {/* ⚠️ Fora da lista e fora da contagem, por exigência do Gate Fiscal
          (§2): esta é a tela que se lê ANTES de fechar a declaração, e o aviso
          de equiparação diz que os relatórios deste app podem não se aplicar à
          situação dele. É a ressalva mais cara do produto. Ele já traz a guarda
          por dentro e some sozinho quando não se aplica. */}
      {obra ? <AvisoEquiparacao obra={obra} /> : null}

      <EscopoDaLista obra={obra} ano={ano} />

      {unificadas.itens.length === 0 ? <NadaAberto obra={obra} ano={ano} /> : null}

      {vermelhas.length > 0 ? (
        <>
          {/* Sem teto, sem "ver todos (N)", sem colapso: a régua de cor só
              governa risco se a lista inteira estiver visível (Gate §4a). */}
          <Passo>Resolver primeiro</Passo>
          {vermelhas.map((item) => (
            <ItemDaFila key={item.id} item={item} obras={obras} hoje={hoje} />
          ))}
        </>
      ) : null}

      {ambares.length > 0 ? (
        <>
          <Passo>Resolver antes de declarar</Passo>
          {ambares.map((item) => (
            <ItemDaFila key={item.id} item={item} obras={obras} hoje={hoje} />
          ))}
        </>
      ) : null}

      {informativos.length > 0 ? (
        <>
          {/* Nunca omitido, e nunca na contagem: não há obrigação aberta nem
              ação possível hoje — é o calendário do banco (Gate §7.1). */}
          <Passo>Avisos — não dependem de você</Passo>
          {informativos.map((item) => (
            <ItemDaFila key={item.id} item={item} obras={obras} hoje={hoje} />
          ))}
        </>
      ) : null}

      {correcoes.length > 0 || emitente.length > 0 ? (
        <>
          <Passo>Histórico — pendências já tratadas</Passo>
          {correcoes.map((p) => (
            <Card key={p.id} data-pendencia-baixada={p.ano}>
              <div className="text-[11.5px] text-mut">
                {formatarDataBR(p.desfecho!.baixadaEm.slice(0, 10))} · por você
              </div>
              <div className="mt-0.5 font-semibold">
                pendência de retificadora — {p.ano} · baixada
              </div>
              <Dica>
                desfecho: {ROTULO_DESFECHO[p.desfecho!.desfecho]}
                {p.desfecho!.dataInformada
                  ? ` em ${formatarDataBR(p.desfecho!.dataInformada)}`
                  : ""}
              </Dica>
              <Dica>
                compunham a pendência: {p.quantidadeDeAtos}{" "}
                {p.quantidadeDeAtos === 1 ? "correção" : "correções"} ·{" "}
                {p.obras
                  .map(
                    (o) =>
                      `${obras.get(o.obraId) ?? "outra obra"} ${formatarBRL(o.antesCentavos)} → ${formatarBRL(o.depoisCentavos)}`,
                  )
                  .join(" · ")}
              </Dica>
            </Card>
          ))}
          {emitente.map((p) => (
            <Card key={p.id}>
              <div className="text-[11.5px] text-mut">
                {formatarDataBR(p.desfecho!.baixadaEm.slice(0, 10))} · por você
              </div>
              <div className="mt-0.5 font-semibold">CNPJ errado — baixada</div>
              <Dica>desfecho: {ROTULO_DESFECHO[p.desfecho!.desfecho]}</Dica>
            </Card>
          ))}
          <Dica>
            A baixa foi gravada <strong>por acréscimo</strong>: a pendência não
            foi editada nem removida. Esta lista só cresce, como o resto do
            acervo.
          </Dica>
        </>
      ) : null}
    </>
  );
}

/**
 * **Os dois escopos, ditos — nunca inferidos** (Gate Fiscal §3.4).
 *
 * Sem esta linha a página misturaria "todas as obras" (as persistentes) com "só
 * esta obra" (as derivadas) em silêncio, e a contagem passaria a significar duas
 * coisas ao mesmo tempo. Número que não se sabe do que é não decide nada.
 */
function EscopoDaLista({ obra, ano }: { obra: Obra | null; ano: number }) {
  if (obra === null) {
    return (
      <Banner cor="amb" role="status">
        <strong>Nenhuma obra aberta neste aparelho.</strong> Abaixo estão só as
        pendências de <strong>correção</strong>, que são de todas as suas obras.
        As outras dezesseis famílias dependem do estado atual de uma obra —
        quarentena, pago sem nota, terreno, financiamento, CNO —{" "}
        <strong>e não foram apuradas</strong>.{" "}
        <Link href="/obras" className="underline">
          Abrir uma obra
        </Link>
        .
      </Banner>
    );
  }
  return (
    <Dica>
      Pendências de <strong>correção</strong>: de todas as suas obras, cada uma
      nomeada. As <strong>demais</strong>: de{" "}
      <Link href={`/obras/${obra.id}`} className="underline">
        {obra.nome}
      </Link>
      , apuradas em {ano}.
    </Dica>
  );
}
