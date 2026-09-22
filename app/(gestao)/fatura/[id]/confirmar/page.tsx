"use client";

/**
 * CONFIRMAR FATURA PAGA — INTEGRAL (CONTAI-022, mock s4/s5, critérios 6-8,
 * 10, 13).
 *
 * ⚠️ "Um anexo por pagamento" não fecha aqui: a compra no cartão não tem
 * comprovante e nunca terá — quem tem é a fatura. `comprovantePath` é
 * COPIADO para os N pagamentos gerados (ADENDO 2 §5) — denormalização
 * deliberada, não bug (path nunca muda, storage append-only).
 *
 * Cada compra vira UM pagamento, na mesma data (a da fatura), com o
 * favorecido/valor/classificação DELA — nunca um pagamento único pela
 * fatura (ADENDO §B(b), literal).
 */

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { CampoArquivo, CampoTexto } from "@/app/_components/campos";
import {
  CabecalhoDaTela,
  ColunaDeDetalhe,
  RodapeDeAcao,
} from "@/app/_components/detalhe";
import {
  Banner,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  Dica,
  EstadoErro,
} from "@/app/_components/ui";
import {
  carregarCompromissos,
  carregarFatura,
  classificarErro,
  mensagemDeErroDeGravacao,
  registrarDesembolsoDeFatura,
  subirParaAcervo,
  type ErroDeTela,
} from "@/lib/data";
import { compromissosAbertosDaFatura } from "@/lib/fiscal/fatura";
import { ehDataValida } from "@/lib/fiscal/pagamento";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { formatarBRL } from "@/lib/money";
import type { Compromisso, Fatura } from "@/lib/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | { fase: "pronto"; fatura: Fatura; abertas: Compromisso[] }
  | { fase: "salvando"; fatura: Fatura; abertas: Compromisso[] }
  | { fase: "salvo"; abertas: Compromisso[]; dataPagamento: string };

export default function ConfirmarFaturaIntegral() {
  const { id } = useParams<{ id: string }>();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [dataPagamento, setDataPagamento] = useState("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const fatura = await carregarFatura(id);
        const todos = await carregarCompromissos(fatura.obraId);
        if (cancelado) return;
        setEstado({
          fase: "pronto",
          fatura,
          abertas: compromissosAbertosDaFatura(fatura, todos),
        });
      } catch (e) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(e) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

  if (estado.fase === "carregando" || estado.fase === "erro") {
    return (
      <>
        <CabecalhoDaTela titulo="Fatura paga · integral" />
        <ColunaDeDetalhe>
          {estado.fase === "carregando" ? (
            <Carregando rotulo="Carregando a fatura" />
          ) : (
            <EstadoErro erro={estado.erro} />
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  if (estado.fase === "salvo") {
    return (
      <>
        <CabecalhoDaTela
          titulo={`${estado.abertas.length} ${estado.abertas.length === 1 ? "pagamento gerado" : "pagamentos gerados"}`}
          sub={`fatura paga em ${formatarDataBR(estado.dataPagamento)}`}
        />
        <ColunaDeDetalhe>
          <Banner cor="grn" role="status">
            <strong>Salvo.</strong> As {estado.abertas.length}{" "}
            {estado.abertas.length === 1 ? "compra virou" : "compras viraram"}{" "}
            pagamento, cada uma na data em que a fatura foi paga.
          </Banner>
          <Card>
            {estado.abertas.map((c) => (
              <div
                key={c.id}
                className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2 first:mt-0 first:border-t-0 first:pt-0"
              >
                <span className="text-[13px]">
                  <strong>{c.favorecidoNome ?? "favorecido não informado"}</strong>
                  <br />
                  <span className="text-mut">
                    pago em {formatarDataBR(estado.dataPagamento)}
                  </span>
                </span>
                <span className="mono">{formatarBRL(c.valorPrevistoCentavos)}</span>
              </div>
            ))}
          </Card>
          <Dica>
            Juros de rotativo, juros de parcelamento, IOF, anuidade e multa
            ficam fora do custo — a mesma separação principal × encargos de
            sempre.
          </Dica>
        </ColunaDeDetalhe>
      </>
    );
  }

  const { fatura, abertas } = estado;
  const total = abertas.reduce((s, c) => s + c.valorPrevistoCentavos, 0);
  const podeSalvar = dataPagamento !== "" && ehDataValida(dataPagamento);

  async function salvar() {
    if (!podeSalvar || estado.fase !== "pronto") return;
    setErro(null);
    setEstado({ fase: "salvando", fatura, abertas });
    try {
      const comprovantePath = comprovante
        ? await subirParaAcervo(comprovante, "comprovante")
        : null;
      await registrarDesembolsoDeFatura({
        faturaId: fatura.id,
        valorCentavos: total,
        dataPagamento,
        comprovantePath,
        compromissoIds: abertas.map((c) => c.id),
      });
      setEstado({ fase: "salvo", abertas, dataPagamento });
    } catch (e) {
      setEstado({ fase: "pronto", fatura, abertas });
      setErro(mensagemDeErroDeGravacao(e, "na fatura, se o pagamento já aparece lançado"));
    }
  }

  return (
    <>
      <CabecalhoDaTela
        titulo="Fatura paga · integral"
        sub={`${abertas.length} ${abertas.length === 1 ? "compra" : "compras"} · um comprovante para todas`}
      />
      <ColunaDeDetalhe>
        {erro ? (
          <Banner cor="red" role="alert">
            {erro}
          </Banner>
        ) : null}

        <Banner cor="amb" role="status">
          <strong>Aqui &quot;um anexo por pagamento&quot; não fecha</strong> —
          a compra no cartão não tem comprovante e nunca terá; quem tem é a
          fatura.
        </Banner>

        <Card>
          <CampoTexto
            rotulo="Data em que a fatura foi paga"
            tipo="date"
            valor={dataPagamento}
            onChange={setDataPagamento}
            ajuda={`Vira a data de cada um dos ${abertas.length} pagamentos abaixo.`}
          />
          <CampoArquivo
            rotulo="Comprovante da fatura"
            ajuda="Compartilhado pelos pagamentos gerados — um documento para N."
            accept=".pdf,image/*"
            arquivo={comprovante}
            onChange={setComprovante}
          />
        </Card>

        <Card>
          <div className="text-[11px] uppercase tracking-wide text-mut">
            Vai criar {abertas.length}{" "}
            {abertas.length === 1 ? "pagamento" : "pagamentos"} — um por
            compra, nunca um pela fatura
          </div>
          {abertas.map((c) => (
            <div
              key={c.id}
              className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2 first:mt-0 first:border-t-0 first:pt-0"
            >
              <span className="text-[13px]">{c.favorecidoNome ?? "favorecido não informado"}</span>
              <span className="mono">{formatarBRL(c.valorPrevistoCentavos)}</span>
            </div>
          ))}
          <Dica>
            Cada um com seu favorecido, sua nota e sua classificação material
            × serviço.
          </Dica>
        </Card>
      </ColunaDeDetalhe>
      <RodapeDeAcao>
        <BotaoSalvar
          ocupado={estado.fase === "salvando"}
          variante="primary"
          onClick={salvar}
          disabled={!podeSalvar || estado.fase === "salvando"}
        >
          {estado.fase === "salvando"
            ? "Salvando…"
            : `Confirmar pagamento — ${abertas.length} ${abertas.length === 1 ? "pagamento" : "pagamentos"}`}
        </BotaoSalvar>
        <BotaoLink href={`/fatura/${fatura.id}`}>Voltar sem salvar</BotaoLink>
      </RodapeDeAcao>
    </>
  );
}
