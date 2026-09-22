"use client";

/**
 * FATURA — DETALHE (CONTAI-022, mock s3).
 *
 * ⚠️ A fatura **não é documento hábil e não tem favorecido próprio** — o
 * custo se atribui por compra, cada uma com seu favorecido, sua nota e sua
 * classificação (parecer, ADENDO §B).
 *
 * Cenário: gestão — conciliação de fatura, sentado, com calma.
 */

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  CabecalhoDaTela,
  ColunaDeDetalhe,
} from "@/app/_components/detalhe";
import {
  Banner,
  BotaoLink,
  Card,
  Carregando,
  Dica,
  EstadoErro,
} from "@/app/_components/ui";
import {
  carregarCompromissos,
  carregarFatura,
  classificarErro,
  type ErroDeTela,
} from "@/lib/data";
import { compromissosAbertosDaFatura } from "@/lib/fiscal/fatura";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { formatarBRL } from "@/lib/money";
import type { Compromisso, Fatura } from "@/lib/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | { fase: "pronto"; fatura: Fatura; compromissos: Compromisso[] };

export default function DetalheFatura() {
  const { id } = useParams<{ id: string }>();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const fatura = await carregarFatura(id);
        const todos = await carregarCompromissos(fatura.obraId);
        if (cancelado) return;
        const idsDaFatura = new Set(fatura.compromissoIds);
        setEstado({
          fase: "pronto",
          fatura,
          compromissos: todos.filter((c) => idsDaFatura.has(c.id)),
        });
      } catch (erro) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

  if (estado.fase !== "pronto") {
    return (
      <>
        <CabecalhoDaTela titulo="Fatura" />
        <ColunaDeDetalhe>
          {estado.fase === "carregando" ? (
            <Carregando rotulo="Carregando as compras desta fatura" />
          ) : (
            <EstadoErro erro={estado.erro} />
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  const { fatura, compromissos } = estado;
  const abertas = compromissosAbertosDaFatura(fatura, compromissos);
  const totalPrevistoAbertas = abertas.reduce(
    (s, c) => s + c.valorPrevistoCentavos,
    0,
  );

  return (
    <>
      <CabecalhoDaTela
        titulo={`Fatura · vence ${formatarDataBR(fatura.dataVencimento)}`}
        sub={`${compromissos.length} ${compromissos.length === 1 ? "compra" : "compras"} · ${
          abertas.length > 0 ? "ainda aberta" : "sem compras em aberto"
        }`}
      />
      <ColunaDeDetalhe>
        <Banner cor="amb" role="status">
          A fatura <strong>não é documento hábil</strong> e não tem
          favorecido próprio — o custo se atribui por compra, cada uma com
          seu favorecido, sua nota e sua classificação.
        </Banner>

        <Card>
          <div className="text-[11px] uppercase tracking-wide text-mut">
            Compras vinculadas
          </div>
          {compromissos.map((c) => (
            <div
              key={c.id}
              className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2 first:mt-0 first:border-t-0 first:pt-0"
            >
              <span className="text-[13px]">
                <strong>{c.favorecidoNome ?? "favorecido não informado"}</strong>
                <br />
                <span className="text-mut">
                  compra {formatarDataBR(c.dataCompra ?? c.dataPrevista ?? "")}
                  {c.situacao !== "aberto" ? ` · ${c.situacao}` : ""}
                </span>
              </span>
              <span className="mono">{formatarBRL(c.valorPrevistoCentavos)}</span>
            </div>
          ))}
          {abertas.length > 0 ? (
            <div className="mt-2.5 flex justify-between border-t border-line pt-2 font-semibold">
              <span className="text-[12px] text-mut">Total previsto (em aberto)</span>
              <span className="mono">{formatarBRL(totalPrevistoAbertas)}</span>
            </div>
          ) : null}
        </Card>

        {fatura.desembolsos.length > 0 ? (
          <Card>
            <div className="text-[11px] uppercase tracking-wide text-mut">
              Valores já pagos a esta fatura
            </div>
            {fatura.desembolsos.map((d) => (
              <div
                key={d.id}
                className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2 first:mt-0 first:border-t-0 first:pt-0"
              >
                <span className="text-[13px] text-mut">
                  pago em {formatarDataBR(d.dataPagamento)}
                </span>
                <span className="mono">{formatarBRL(d.valorCentavos)}</span>
              </div>
            ))}
          </Card>
        ) : null}

        {abertas.length === 0 ? (
          <Dica>
            Nenhuma compra em aberto nesta fatura — nada mais a confirmar
            aqui.
          </Dica>
        ) : null}

        {/* Decisão 4 do spec de design: leitura com ações por card, sem
            rodapé fixo — a ação certa ao lado do fato certo, mesmo padrão de
            `blocoPagamentos`/`blocoCorrigir` em `/documento/[id]`. O "Voltar
            ao início" da `Rodape` de 430px não sobrevive: quem navega agora é
            a sidebar e o breadcrumb do topbar. */}
        <Card>
          <div className="flex flex-col gap-2">
            {abertas.length > 0 ? (
              <>
                <BotaoLink
                  href={`/fatura/${fatura.id}/confirmar`}
                  variante="primary"
                >
                  Confirmar fatura paga (integral)
                </BotaoLink>
                <BotaoLink href={`/fatura/${fatura.id}/parcial`}>
                  Registrar pagamento parcial (rotativo)
                </BotaoLink>
              </>
            ) : null}
            <BotaoLink href="/adicionar/compra-cartao">
              Registrar outra compra
            </BotaoLink>
          </div>
        </Card>
      </ColunaDeDetalhe>
    </>
  );
}
