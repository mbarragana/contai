"use client";

/**
 * FATURA PAGA · PARCIAL — o rotativo (CONTAI-022, mock s6, critério 9).
 *
 * ⚠️ **O valor pago é gravado SEMPRE** — fato consumado, nunca recusado
 * (ADENDO §B). O que muda é que nenhuma compra é confirmada sozinha: a
 * próxima tela (alocação manual) é onde o Mateus escolhe quais.
 */

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CampoTexto } from "@/app/_components/campos";
import {
  AppBar,
  Banner,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  Corpo,
  EstadoErro,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarCompromissos,
  carregarFatura,
  classificarErro,
  mensagemDeErroDeGravacao,
  registrarDesembolsoDeFatura,
  type ErroDeTela,
} from "@/lib/data";
import { compromissosAbertosDaFatura } from "@/lib/fiscal/fatura";
import { ehDataValida } from "@/lib/fiscal/pagamento";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { formatarBRL, parseValorInput } from "@/lib/money";
import type { Compromisso, Fatura } from "@/lib/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | { fase: "pronto"; fatura: Fatura; abertas: Compromisso[] }
  | { fase: "salvando"; fatura: Fatura; abertas: Compromisso[] };

export default function RegistrarValorPagoParcial() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [data, setData] = useState("");
  const [valor, setValor] = useState("");
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
        <AppBar titulo="Fatura paga · parcial" />
        <Corpo>
          {estado.fase === "carregando" ? (
            <Carregando rotulo="Carregando a fatura" />
          ) : (
            <EstadoErro erro={estado.erro} />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href="/">Voltar ao início</BotaoLink>
        </Rodape>
      </>
    );
  }

  const { fatura, abertas } = estado;
  const totalPrevisto = abertas.reduce((s, c) => s + c.valorPrevistoCentavos, 0);
  const valorCentavos = parseValorInput(valor);
  const podeSalvar =
    data !== "" && ehDataValida(data) && valorCentavos !== null && valorCentavos > 0;

  async function salvar() {
    if (!podeSalvar || valorCentavos === null || estado.fase !== "pronto") return;
    setErro(null);
    setEstado({ fase: "salvando", fatura, abertas });
    try {
      // Sem alocação neste ato (crit. 9) — array vazio. A tela seguinte
      // pergunta quais compras este valor cobriu.
      const desembolsoId = await registrarDesembolsoDeFatura({
        faturaId: fatura.id,
        valorCentavos,
        dataPagamento: data,
        comprovantePath: null,
        compromissoIds: [],
      });
      router.push(`/fatura/${fatura.id}/alocar?desembolso=${desembolsoId}`);
    } catch (e) {
      setEstado({ fase: "pronto", fatura, abertas });
      setErro(mensagemDeErroDeGravacao(e, "na fatura, se o pagamento parcial já aparece lançado"));
    }
  }

  return (
    <>
      <AppBar
        titulo="Fatura paga · parcial"
        sub={`vence ${formatarDataBR(fatura.dataVencimento)} · rotativo`}
      />
      <Corpo>
        {erro ? (
          <Banner cor="red" role="alert">
            {erro}
          </Banner>
        ) : null}

        <Banner cor="amb" role="status">
          <strong>O valor pago é gravado sempre</strong> — é fato consumado,
          nunca recusado. O que muda é que <strong>nenhuma compra é
          confirmada sozinha</strong>: na próxima tela você escolhe quais.
        </Banner>

        <Card>
          <div className="text-[11px] uppercase tracking-wide text-mut">
            Compras em aberto desta fatura
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
          <div className="mt-2.5 flex justify-between border-t border-line pt-2 font-semibold">
            <span className="text-[12px] text-mut">Total previsto</span>
            <span className="mono">{formatarBRL(totalPrevisto)}</span>
          </div>
        </Card>

        <Card>
          <CampoTexto
            rotulo="Data em que você pagou"
            tipo="date"
            valor={data}
            onChange={setData}
          />
          <CampoTexto
            rotulo="Valor pago"
            valor={valor}
            onChange={setValor}
            inputMode="decimal"
            placeholder="0,00"
            ajuda={
              valorCentavos !== null && valorCentavos > 0 && valorCentavos < totalPrevisto
                ? `Pagou menos que o previsto de ${formatarBRL(totalPrevisto)} — é rotativo, não integral.`
                : undefined
            }
          />
        </Card>
      </Corpo>
      <Rodape>
        <BotaoSalvar
          ocupado={estado.fase === "salvando"}
          variante="primary"
          onClick={salvar}
          disabled={!podeSalvar || estado.fase === "salvando"}
        >
          {estado.fase === "salvando"
            ? "Salvando…"
            : valorCentavos !== null && valorCentavos > 0
              ? `Salvar pagamento — ${formatarBRL(valorCentavos)} registrado`
              : "Informe a data e o valor pago"}
        </BotaoSalvar>
        <BotaoLink href={`/fatura/${fatura.id}`}>Voltar sem salvar</BotaoLink>
      </Rodape>
    </>
  );
}
