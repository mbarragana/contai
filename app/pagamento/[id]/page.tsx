"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  AppBar,
  Banner,
  BarraAdicionar,
  BotaoLink,
  Card,
  Carregando,
  Chip,
  Consequencia,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
} from "@/app/_components/ui";
import {
  carregarPagamento,
  carregarPainel,
  classificarErro,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { rotulosPagoSemNota } from "@/lib/fiscal/pagamento";
import { alocarCusto, type PagamentoAlocado } from "@/lib/fiscal/vinculo";
import { formatarBRL } from "@/lib/money";
import type { Documento, Pagamento } from "@/lib/types";

const NOME_TIPO: Record<Documento["tipo"], string> = {
  nf_material: "NF de material",
  nf_servico: "NF de serviço",
  boleto: "Boleto",
};

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      pagamento: Pagamento;
      painel: PainelDados;
      alocado: PagamentoAlocado | undefined;
      ligados: Documento[];
    };

/**
 * Detalhe do pagamento — critério 3 do CONTAI-018.
 *
 * Até aqui só existia `/pagamento/[id]/obra`: metade do parque de registros do
 * Mateus nasceu como PIX avulso e não tinha porta nenhuma para ganhar a nota
 * depois. Esta tela é essa porta, e o seletor inverso sai dela.
 */
export default function DetalhePagamento() {
  const { id } = useParams<{ id: string }>();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const pagamento = await carregarPagamento(id);
        const painel = await carregarPainel(pagamento.obraId);
        if (cancelado) return;
        const alocacao = alocarCusto(painel);
        setEstado({
          fase: "pronto",
          pagamento,
          painel,
          alocado: alocacao.porPagamento.get(pagamento.id),
          ligados: painel.documentos.filter((d) =>
            pagamento.documentoIds.includes(d.id),
          ),
        });
      } catch (erro) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  if (estado.fase !== "pronto") {
    return (
      <>
        <AppBar titulo="Pagamento" />
        <Corpo>
          {estado.fase === "carregando" ? (
            <Carregando rotulo="Carregando o pagamento" />
          ) : (
            <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
          )}
        </Corpo>
        <BarraAdicionar
          voltar={<BotaoLink href="/">Voltar ao início</BotaoLink>}
        />
      </>
    );
  }

  const p = estado.pagamento;
  const comprovado = estado.alocado?.comprovadoCentavos ?? 0;
  const semNota = estado.alocado?.semNotaCentavos ?? p.valorCentavos;
  const rotulos = rotulosPagoSemNota(p.favorecidoTipo);

  return (
    <>
      <AppBar
        titulo="Pagamento"
        sub={`${p.favorecidoNome ?? "favorecido não informado"} · ${estado.painel.obra.nome}`}
      />
      <Corpo>
        <Card>
          <Linha rotulo="Valor">
            <span className="mono">{formatarBRL(p.valorCentavos)}</span>
          </Linha>
          <Linha rotulo="Data do pagamento">
            <span className="mono">{formatarDataBR(p.dataPagamento)}</span>
          </Linha>
          <Linha rotulo="Meio">{p.meio.toUpperCase()}</Linha>
          <Linha rotulo="Comprovante">
            {p.comprovantePath ? (
              <span className="font-semibold text-grn">anexado ✓</span>
            ) : (
              <span className="font-semibold text-red">sem comprovante</span>
            )}
          </Linha>
          <Dica>
            A data que vale para o custo é a do <strong>pagamento</strong>, não
            a da nota — regime de caixa.
          </Dica>
        </Card>

        {comprovado > 0 ? (
          <Card className="border-grn">
            <Chip cor="grn">Custo comprovado</Chip>
            <div className="mono mt-1.5 text-[26px] font-bold tracking-tight">
              {formatarBRL(comprovado)}
            </div>
            <Dica>
              entra no custo de aquisição de {p.dataPagamento.slice(0, 4)} —
              pela data do pagamento
            </Dica>
          </Card>
        ) : null}

        {semNota > 0 ? (
          <Card className="border-red">
            <Chip cor="red">{rotulos.chip}</Chip>
            <div className="mono mt-1.5 text-[19px] font-bold">
              {formatarBRL(semNota)}
            </div>
            <Consequencia cor="red">{rotulos.consequencia}</Consequencia>
            <div className="mt-2.5">
              <BotaoLink href={`/pagamento/${p.id}/ligar`} variante="primary">
                Ligar a uma nota
              </BotaoLink>
            </div>
          </Card>
        ) : null}

        <Card>
          <div className="font-semibold">Documentos deste pagamento</div>
          {estado.ligados.length === 0 ? (
            <Dica>Nenhum documento ligado a este pagamento.</Dica>
          ) : (
            estado.ligados.map((d) => (
              <div key={d.id} className="mt-2 border-t border-line pt-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px]">
                    {NOME_TIPO[d.tipo]} · {d.favorecidoNome ?? "sem favorecido"}
                  </span>
                  <span className="mono flex-none text-[13.5px]">
                    {formatarBRL(d.valorCentavos ?? 0)}
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  <BotaoLink href={`/documento/${d.id}`}>Ver o documento</BotaoLink>
                  <BotaoLink href={`/documento/${d.id}/desligar?pagamento=${p.id}`}>
                    Desligar esta nota
                  </BotaoLink>
                </div>
              </div>
            ))
          )}
          {semNota === 0 && estado.ligados.length > 0 ? (
            <Banner cor="grn" role="status">
              Este pagamento está coberto por documento hábil — ele e a nota são{" "}
              <strong>uma despesa só</strong>.
            </Banner>
          ) : null}
        </Card>

        <Card>
          <Linha rotulo="Obra">{estado.painel.obra.nome}</Linha>
          <div className="mt-2">
            <BotaoLink href={`/pagamento/${p.id}/obra`}>
              Corrigir a obra deste registro
            </BotaoLink>
          </div>
        </Card>
      </Corpo>
      <BarraAdicionar
        voltar={
          <BotaoLink href="/" variante="primary">
            Voltar ao início
          </BotaoLink>
        }
      />
    </>
  );
}
