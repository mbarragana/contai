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
  carregarCompromisso,
  classificarErro,
  mensagemDeErro,
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

  const podeSalvar = semData || (nova !== "" && ehDataValida(nova));

  async function salvar() {
    if (!compromisso || !podeSalvar) return;
    setSalvando(true);
    setErro(null);
    try {
      await mudarDataPrevista(
        compromisso.id,
        compromisso.dataPrevista,
        semData ? null : nova,
      );
      router.push(`/compromisso/${compromisso.id}`);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  return (
    <>
      <AppBar titulo="Mudou a data" sub={compromisso?.favorecidoNome ?? undefined} />
      <Corpo>
        {erroCarregar ? <EstadoErro erro={erroCarregar} /> : null}
        {!compromisso && !erroCarregar ? (
          <Carregando rotulo="Carregando o agendamento" />
        ) : null}

        {compromisso ? (
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
                rotulo="Nova data prevista"
                tipo="date"
                valor={nova}
                onChange={(v) => {
                  setNova(v);
                  setSemData(false);
                }}
              />
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
              <Dica>
                &quot;Ainda não sei&quot; é resposta válida: o agendamento
                continua visível e <strong>não trava</strong> relatório nenhum —
                incerteza declarada não é silêncio.
              </Dica>
            </Card>

            <Banner cor="amb" role="status">
              É o <strong>mesmo agendamento</strong> — mesmo saldo, mesmos
              pagamentos ligados. A data anterior fica no histórico.{" "}
              <strong>Nenhuma das duas vira data de pagamento</strong>: a que
              vale é a do dia em que o dinheiro sair.
            </Banner>
          </>
        ) : null}
      </Corpo>
      <Rodape>
        <Botao
          variante="primary"
          onClick={salvar}
          disabled={salvando || !podeSalvar}
        >
          {salvando ? "Salvando…" : "Salvar a nova data"}
        </Botao>
        <BotaoLink href={`/compromisso/${id}`}>Voltar sem salvar</BotaoLink>
      </Rodape>
    </>
  );
}
