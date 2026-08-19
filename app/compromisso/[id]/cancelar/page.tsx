"use client";

/**
 * "Não vai ser pago" — CONTAI-019, critério 22.
 *
 * **NÃO APAGA**: fica registrado como cancelado, com o motivo (parecer §3:
 * "cancelado, nunca apagado, com o motivo. Não gera lançamento nenhum — nunca
 * gerou"). O motivo é obrigatório e o banco também o exige (o check
 * `compromisso_cancelado_exige_motivo` da migration 0007) — daqui a dois anos,
 * um agendamento encerrado sem motivo é a mesma coisa que registro nenhum.
 *
 * Esta é uma das três respostas que DESBLOQUEIAM o relatório anual
 * (critério 21c).
 */

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CampoTexto } from "@/app/_components/campos";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
  Rodape,
} from "@/app/_components/ui";
import {
  cancelarCompromisso,
  carregarCompromisso,
  classificarErro,
  mensagemDeErro,
  type ErroDeTela,
} from "@/lib/data";
import { preposicaoDeTempo } from "@/lib/fiscal/compromisso";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import type { Compromisso } from "@/lib/types";

export default function CancelarAgendamento() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [compromisso, setCompromisso] = useState<Compromisso | null>(null);
  const [erroCarregar, setErroCarregar] = useState<ErroDeTela | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const hoje = hojeIso();

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const c = await carregarCompromisso(id);
        if (!cancelado) setCompromisso(c);
      } catch (e) {
        if (!cancelado) setErroCarregar(classificarErro(e));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

  async function salvar() {
    if (motivo.trim().length < 3) {
      setErro("Escreva o motivo — campo obrigatório.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await cancelarCompromisso(id, motivo.trim());
      router.push(`/compromisso/${id}`);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  return (
    <>
      <AppBar titulo="Não vai ser pago" sub={compromisso?.favorecidoNome ?? undefined} />
      <Corpo>
        {erroCarregar ? <EstadoErro erro={erroCarregar} /> : null}
        {!compromisso && !erroCarregar ? (
          <Carregando rotulo="Carregando o agendamento" />
        ) : null}

        {/* ⚠️ Guarda de SITUAÇÃO: por URL direta dava para cancelar um agendamento
            já quitado ou já cancelado. Nenhum dos dois é reversível pela tela,
            e o parecer §3 reserva 'cancelado' à previsão que NÃO se realizou —
            cancelar o que já foi pago poluiria o sinal de auditoria. */}
        {compromisso && compromisso.situacao !== "aberto" ? (
          <Banner cor="amb" role="status">
            <strong>
              Este agendamento já foi respondido
              {compromisso.situacao === "quitado"
                ? " — ele foi pago"
                : " — foi marcado como não vai ser pago"}
              .
            </strong>{" "}
            Não há o que cancelar aqui.
          </Banner>
        ) : null}

        {compromisso && compromisso.situacao === "aberto" ? (
          <>
            <Banner cor="amb" role="status">
              <strong>O registro fica, com o motivo — nada é apagado.</strong>{" "}
              Este agendamento nunca gerou lançamento nenhum, então não há o que
              desfazer.
            </Banner>

            <Card className="border-dashed border-amb">
              <Linha rotulo="Valor previsto">
                <span className="mono text-mut">
                  ~ {formatarBRL(compromisso.valorPrevistoCentavos)}
                </span>
              </Linha>
              <Linha rotulo="Quando">
                <strong>{preposicaoDeTempo(compromisso, hoje)}</strong>
              </Linha>
            </Card>

            {erro ? (
              <Banner cor="red" role="alert">
                {erro}
              </Banner>
            ) : null}

            <Card>
              <CampoTexto
                rotulo="Por que não vai ser pago?"
                valor={motivo}
                onChange={setMotivo}
                placeholder="Compra cancelada — comprei em outro fornecedor"
                erro={erro ?? undefined}
              />
              <Dica>
                Campo obrigatório. Daqui a dois anos, um agendamento encerrado
                sem motivo é a mesma coisa que registro nenhum.
              </Dica>
            </Card>

            <Card>
              <Linha rotulo="Custo de aquisição">inalterado</Linha>
              <Linha rotulo="Bloqueio dos relatórios anuais">
                este item destrava
              </Linha>
              <Linha rotulo="Sai da lista de agendados">sim</Linha>
            </Card>
          </>
        ) : null}
      </Corpo>
      <Rodape>
        <Botao
          variante="primary"
          onClick={salvar}
          disabled={
            salvando ||
            motivo.trim().length < 3 ||
            compromisso?.situacao !== "aberto"
          }
        >
          {salvando ? "Salvando…" : "Marcar que não vai ser pago"}
        </Botao>
        <BotaoLink href={`/compromisso/${id}`}>Voltar sem salvar</BotaoLink>
      </Rodape>
    </>
  );
}
