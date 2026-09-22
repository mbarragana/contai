"use client";

/**
 * "Mudou a data" — CONTAI-019, critérios 33 e 34.
 *
 * ⚠️ **MANTÉM O MESMO AGENDAMENTO**: mesmo id, mesmos vínculos, mesmo saldo. A
 * data anterior vai para o histórico. **Não cancela e não cria agendamento
 * novo** — fechar-e-abrir orfanaria o vínculo 1:N com pagamentos já feitos, e
 * usaria "cancelado" (reservado no parecer §3 à previsão que NÃO se realizou)
 * para um adiamento, poluindo o sinal de auditoria.
 *
 * **Data nova no passado é aceita** — é correção legítima — e o item fica
 * vencido na hora (critério 34).
 */

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CampoTexto } from "@/app/_components/campos";
import {
  CabecalhoDaTela,
  ColunaDeDetalhe,
  RodapeDeAcao,
} from "@/app/_components/detalhe";
import {
  Banner,
  Botao,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  Dica,
  EstadoErro,
  Linha,
} from "@/app/_components/ui";
import {
  carregarCompromisso,
  classificarErro,
  mensagemDeErroDeGravacao,
  mudarDataCompraCartao,
  mudarDataPrevista,
  type ErroDeTela,
} from "@/lib/data";
import { preposicaoDeTempo } from "@/lib/fiscal/compromisso";
import { ehDataValida } from "@/lib/fiscal/pagamento";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import type { Compromisso } from "@/lib/types";

export default function MudarData() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [compromisso, setCompromisso] = useState<Compromisso | null>(null);
  const [erroCarregar, setErroCarregar] = useState<ErroDeTela | null>(null);
  // ⚠️ Nasce VAZIA: a data nova não é afirmada por documento nenhum, e default
  // em campo fiscal é o app afirmando fato que não tem como saber.
  const [nova, setNova] = useState("");
  const [semData, setSemData] = useState(false);
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

  // CONTAI-022: compra no cartão sempre tem vencimento — "sem data" não é
  // resposta válida para ela (a fatura só existe com data exata).
  const ehCartao = compromisso?.origem === "cartao";
  const podeSalvar = ehCartao
    ? nova !== "" && ehDataValida(nova)
    : semData || (nova !== "" && ehDataValida(nova));

  async function salvar() {
    if (!compromisso || !podeSalvar) return;
    setSalvando(true);
    setErro(null);
    try {
      if (ehCartao) {
        // RE-ALOCA a fatura do novo vencimento (RPC própria, migration
        // 0013) — bloqueada pelo banco se a compra já foi quitada.
        await mudarDataCompraCartao(compromisso.id, nova);
      } else {
        await mudarDataPrevista(
          compromisso.id,
          compromisso.dataPrevista,
          semData ? null : nova,
        );
      }
      router.push(`/compromisso/${compromisso.id}`);
    } catch (e) {
      setErro(mensagemDeErroDeGravacao(e, "na lista de compromissos"));
      setSalvando(false);
    }
  }

  return (
    <>
      <CabecalhoDaTela
        titulo="Mudou a data"
        sub={compromisso?.favorecidoNome ?? undefined}
      />
      <ColunaDeDetalhe>
        {erroCarregar ? <EstadoErro erro={erroCarregar} /> : null}
        {!compromisso && !erroCarregar ? (
          <Carregando rotulo="Carregando o agendamento" />
        ) : null}

        {/* ⚠️ Guarda de SITUAÇÃO: por URL direta dava para mudar a data de um agendamento
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
            Não há o que mudar a data de aqui.
          </Banner>
        ) : null}

        {compromisso && compromisso.situacao === "aberto" ? (
          <>
            <Card className="border-dashed border-amb">
              <Linha rotulo="Valor previsto">
                <span className="mono text-mut">
                  ~ {formatarBRL(compromisso.valorPrevistoCentavos)}
                </span>
              </Linha>
              <Linha rotulo="Hoje está">
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
                campo="fNovaData"
                rotulo={ehCartao ? "Novo vencimento da fatura" : "Nova data prevista"}
                tipo="date"
                valor={nova}
                onChange={(v) => {
                  setNova(v);
                  setSemData(false);
                }}
              />
              {ehCartao ? null : (
                <div className="mt-2">
                  <Botao
                    variante={semData ? "primary" : "ghost"}
                    onClick={() => {
                      setSemData(true);
                      setNova("");
                    }}
                  >
                    Ainda não sei — deixar sem data
                  </Botao>
                </div>
              )}
              {ehCartao ? (
                <Dica>
                  A compra passa a pertencer à fatura deste novo vencimento —
                  criada na hora, se ainda não existir.
                </Dica>
              ) : (
                <Dica>
                  &quot;Ainda não sei&quot; é resposta válida: o agendamento
                  continua visível e <strong>não trava</strong> relatório
                  nenhum — incerteza declarada não é silêncio.
                </Dica>
              )}
            </Card>

            <Banner cor="amb" role="status">
              É o <strong>mesmo agendamento</strong> — mesmo saldo, mesmos
              pagamentos ligados. A data anterior fica no histórico.{" "}
              <strong>Nenhuma das duas vira data de pagamento</strong>: a que
              vale é a do dia em que o dinheiro sair.
            </Banner>
          </>
        ) : null}
      </ColunaDeDetalhe>

      <RodapeDeAcao>
        <BotaoSalvar
          ocupado={salvando}
          variante="primary"
          onClick={salvar}
          disabled={salvando || !podeSalvar || compromisso?.situacao !== "aberto"}
        >
          {salvando ? "Salvando…" : "Salvar a nova data"}
        </BotaoSalvar>
        <BotaoLink href={`/compromisso/${id}`}>Voltar sem salvar</BotaoLink>
      </RodapeDeAcao>
    </>
  );
}
