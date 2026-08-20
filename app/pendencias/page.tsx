"use client";

import { useCallback, useEffect, useState } from "react";

import {
  AppBar,
  BarraAdicionar,
  Banner,
  BotaoLink,
  Card,
  Carregando,
  Chip,
  Consequencia,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
  Passo,
} from "@/app/_components/ui";
import {
  carregarObras,
  carregarPainelDePendencias,
  classificarErro,
  type ErroDeTela,
} from "@/lib/data";
import { formatarDataBR } from "@/lib/fiscal/obra";
import {
  AVISO_ANO_ANTERIOR,
  EMITENTE_ERRADO_O_QUE_FALTA,
  montarPendenciasDeAno,
  type PendenciaDeAno,
} from "@/lib/fiscal/revisao";
import { formatarBRL } from "@/lib/money";
import type { PendenciaPersistente } from "@/lib/types";

const ROTULO_DESFECHO: Record<string, string> = {
  retifiquei_a_daa: "retifiquei a DAA",
  contador_avaliou_nao_retifica: "meu contador avaliou e não é preciso retificar",
  daa_ainda_nao_entregue: "a DAA ainda não foi entregue",
  cnpj_gravado_esta_certo:
    "conferi o papel: o CNPJ gravado está certo — o erro foi meu ao marcar",
  apontamento_corrigido: "o apontamento foi corrigido",
};

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      anos: PendenciaDeAno[];
      emitente: PendenciaPersistente[];
      obras: Map<string, string>;
    };

/**
 * A lista de pendências persistentes — **abertas e baixadas** (critérios 19, 20
 * e 21).
 *
 * Parecer §6.3: "aviso que só existe no momento do clique é aviso que não
 * existiu". Nada aqui some sozinho, e a baixa **não apaga**: a pendência sai da
 * lista de abertas e fica no HISTÓRICO, com quem, quando e qual desfecho —
 * legível em 2034, que é a meta 3.
 */
export default function Pendencias() {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const [painel, obras] = await Promise.all([
          carregarPainelDePendencias(),
          carregarObras(),
        ]);
        if (cancelado) return;
        setEstado({
          fase: "pronto",
          anos: montarPendenciasDeAno(painel),
          emitente: painel.pendencias.filter((p) => p.tipo === "emitente_errado"),
          obras: new Map(obras.map((o) => [o.id, o.nome])),
        });
      } catch (erro) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  return (
    <>
      <AppBar
        titulo="Pendências de correção"
        sub="não somem ao fechar a tela — só saem com um desfecho escolhido"
      />
      <Corpo>
        {estado.fase === "carregando" ? (
          <Carregando rotulo="Carregando as pendências" />
        ) : null}
        {estado.fase === "erro" ? (
          <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
        ) : null}

        {estado.fase === "pronto" ? (
          <ListaDePendencias
            anos={estado.anos}
            emitente={estado.emitente}
            obras={estado.obras}
          />
        ) : null}
      </Corpo>
      <BarraAdicionar voltar={<BotaoLink href="/">Voltar ao início</BotaoLink>} />
    </>
  );
}

function ListaDePendencias({
  anos,
  emitente,
  obras,
}: {
  anos: PendenciaDeAno[];
  emitente: PendenciaPersistente[];
  obras: Map<string, string>;
}) {
  const abertas = anos.filter((p) => p.desfecho === null);
  const baixadas = anos.filter((p) => p.desfecho !== null);
  const emitenteAbertas = emitente.filter((p) => p.desfecho === null);
  const emitenteBaixadas = emitente.filter((p) => p.desfecho !== null);

  const vazio =
    abertas.length === 0 &&
    baixadas.length === 0 &&
    emitenteAbertas.length === 0 &&
    emitenteBaixadas.length === 0;

  if (vazio) {
    return (
      <Banner cor="grn" role="status">
        <strong>Nenhuma pendência de correção.</strong> Nenhuma correção sua
        mexeu no custo de um ano anterior, e nenhum registro está marcado com
        CNPJ errado.
      </Banner>
    );
  }

  return (
    <>
      {abertas.length > 0 || emitenteAbertas.length > 0 ? (
        <Passo>O que está faltando</Passo>
      ) : null}

      {abertas.map((p) => (
        <Card key={p.id} className="border-amb" data-pendencia={p.ano}>
          <Chip cor="amb">Correção mexeu em ano anterior</Chip>
          <div className="mt-1.5 font-semibold">
            {p.ano} — o custo do ano mudou depois de {p.quantidadeDeAtos}{" "}
            {p.quantidadeDeAtos === 1 ? "correção sua" : "correções suas"}
          </div>
          {/* ⚠️ Uma linha POR OBRA, com o delta DELA. Nunca somadas: dinheiro
              de duas obras na mesma linha é a soma que não existe em declaração
              nenhuma (critério 14 de /obras). */}
          {p.obras.map((o) => (
            <Linha key={o.obraId} rotulo={obras.get(o.obraId) ?? "outra obra"}>
              <span className="mono">
                {formatarBRL(o.antesCentavos)} →{" "}
                <span className="font-semibold">
                  {formatarBRL(o.depoisCentavos)}
                </span>
              </span>
            </Linha>
          ))}
          <Dica>
            aberta em {formatarDataBR(p.abertaEm.slice(0, 10))} · última correção
            em {formatarDataBR(p.ultimaCorrecaoEm.slice(0, 10))}
          </Dica>
          <Consequencia cor="amb">{AVISO_ANO_ANTERIOR}</Consequencia>
          <div className="mt-2.5">
            <BotaoLink href={`/pendencias/${p.id}`} variante="primary">
              Abrir a pendência de {p.ano}
            </BotaoLink>
          </div>
        </Card>
      ))}

      {emitenteAbertas.map((p) => (
        <Card key={p.id} className="border-amb" data-pendencia-emitente={p.id}>
          <Chip cor="amb">CNPJ errado — tratar</Chip>
          <div className="mt-1.5 font-semibold">
            O CNPJ do emitente de 1 documento está errado
          </div>
          <Dica>marcado por você em {formatarDataBR(p.abertaEm.slice(0, 10))}</Dica>
          <Consequencia cor="amb">{EMITENTE_ERRADO_O_QUE_FALTA}</Consequencia>
          <div className="mt-2.5">
            <BotaoLink href={`/documento/${p.documentoId}`}>
              Ver o documento marcado
            </BotaoLink>
          </div>
          <div className="mt-2">
            <BotaoLink href={`/pendencias/${p.id}`}>
              Como esta pendência termina
            </BotaoLink>
          </div>
        </Card>
      ))}

      {baixadas.length > 0 || emitenteBaixadas.length > 0 ? (
        <>
          <Passo>Histórico — pendências já tratadas</Passo>
          {baixadas.map((p) => (
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
          {emitenteBaixadas.map((p) => (
            <Card key={p.id}>
              <div className="text-[11.5px] text-mut">
                {formatarDataBR(p.desfecho!.baixadaEm.slice(0, 10))} · por você
              </div>
              <div className="mt-0.5 font-semibold">
                CNPJ errado — baixada
              </div>
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
