"use client";

/**
 * SUGESTÃO DE QUITAÇÃO — CONTAI-019, critérios 35 a 41.
 *
 * ⚠️ **Aparece DEPOIS do pagamento gravado e NUNCA bloqueia a gravação**
 * (critério 37, parecer §4): *nunca recuse o registro de um fato consumado.*
 * Por isso este componente **carrega sozinho**, montado abaixo da confirmação
 * de sucesso e no detalhe do pagamento — ele nunca está no caminho do
 * "Salvar".
 *
 * ⚠️ **Nada aqui cria vínculo sem ato humano** (critério 41): o único caminho
 * que grava é o `onClick` do botão "Sim". "Não pode existir caminho de código
 * que grave a quitação sem ato humano explícito" (adendo §C(d)).
 *
 * ⚠️ **Lista TODOS os elegíveis** (critério 36). Escolher o mais próximo seria
 * heurística decidindo vínculo, e vínculo inferido errado infla custo em
 * silêncio E mata o alerta (§5.5 do parecer de 17/08).
 *
 * O texto é o **literal do ADENDO 3 §G.1**, nas quatro linhas.
 *
 * ⚠️ **O "sim" NÃO fecha o agendamento incondicionalmente** (achado do
 * `contador` no Gate 2). A faixa do §C(a)(2) é **simétrica**: previsto
 * R$ 25.000 e pago R$ 20.000 dispara a sugestão (`|5.000| ≤ 5.000`), e um
 * único toque fecharia um compromisso ainda devido, evaporando R$ 5.000 de
 * saldo. É literalmente o dano que o §D nomeia — *"assumir desconto fecha um
 * compromisso ainda devido e mata o alerta"*. Por isso, quando o pago é MENOR
 * que o previsto, o card oferece **os dois botões do §D**, no mesmo peso e sem
 * pré-seleção, exatamente como a tela de confirmação já fazia.
 */

import { useCallback, useEffect, useState } from "react";

import { CampoTexto } from "@/app/_components/campos";
import {
  Banner,
  Botao,
  Card,
  Carregando,
  Dica,
} from "@/app/_components/ui";
import {
  carregarCompromissos,
  carregarRecusasQuitacao,
  mensagemDeErro,
  quitarCompromisso,
  recusarQuitacao,
} from "@/lib/data";
import {
  compromissosElegiveisParaQuitacao,
  perguntaQuitacao,
  QUITACAO_CONSEQUENCIA_DO_NAO,
  QUITACAO_NAO,
  QUITACAO_SIM,
  resumoDoAgendamento,
} from "@/lib/fiscal/compromisso";
import { formatarBRL } from "@/lib/money";
import type { Compromisso, Pagamento } from "@/lib/types";

export function SugestaoQuitacao({
  pagamento,
  onQuitou,
}: {
  pagamento: Pagamento;
  /** A tela que hospeda decide o que fazer depois — recarregar, navegar. */
  onQuitou?: () => void;
}) {
  const [elegiveis, setElegiveis] = useState<Compromisso[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, setGravando] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const [compromissos, recusas] = await Promise.all([
          carregarCompromissos(pagamento.obraId),
          carregarRecusasQuitacao(),
        ]);
        if (cancelado) return;
        setElegiveis(
          compromissosElegiveisParaQuitacao(pagamento, compromissos, recusas),
        );
      } catch {
        // ⚠️ Falha aqui NÃO é erro de tela: o pagamento já está gravado, e a
        // sugestão é acessório. Some em silêncio em vez de sujar a confirmação
        // de um registro que deu certo.
        if (!cancelado) setElegiveis([]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [pagamento, tentativa]);

  const responder = useCallback(
    async (
      compromisso: Compromisso,
      escolha:
        | { tipo: "quita" }
        | { tipo: "falta"; novaDataPrevista: string | null }
        | { tipo: "recusa" },
    ) => {
      setGravando(compromisso.id);
      setErro(null);
      try {
        if (escolha.tipo === "recusa") {
          await recusarQuitacao(pagamento.id, compromisso.id);
        } else {
          await quitarCompromisso({
            compromisso,
            pagamento,
            // ⚠️ DECISÃO HUMANA, nunca cálculo (§D): "nenhum dos dois erros é
            // mais barato, então não há default seguro para onde cair".
            quitaIntegralmente: escolha.tipo === "quita",
            ...(escolha.tipo === "falta"
              ? { novaDataPrevista: escolha.novaDataPrevista }
              : {}),
          });
          onQuitou?.();
        }
        setTentativa((t) => t + 1);
      } catch (e) {
        setErro(mensagemDeErro(e));
      } finally {
        setGravando(null);
      }
    },
    [pagamento, onQuitou],
  );

  if (elegiveis === null) {
    return <Carregando rotulo="Procurando agendamentos parecidos" />;
  }
  if (elegiveis.length === 0) return null;

  return (
    <div className="flex flex-col gap-3" data-bloco="sugestao-quitacao">
      {erro ? (
        <Banner cor="red" role="alert">
          {erro}
        </Banner>
      ) : null}
      {elegiveis.map((c) => (
        <CartaoSugestao
          key={c.id}
          compromisso={c}
          pagoCentavos={pagamento.valorCentavos}
          ocupado={gravando !== null}
          onResponder={(escolha) => void responder(c, escolha)}
        />
      ))}
    </div>
  );
}

type Escolha =
  | { tipo: "quita" }
  | { tipo: "falta"; novaDataPrevista: string | null }
  | { tipo: "recusa" };

function CartaoSugestao({
  compromisso,
  pagoCentavos,
  ocupado,
  onResponder,
}: {
  compromisso: Compromisso;
  pagoCentavos: number;
  ocupado: boolean;
  onResponder: (escolha: Escolha) => void;
}) {
  const [dataSaldo, setDataSaldo] = useState("");
  const [semData, setSemData] = useState(false);
  const [pedindoData, setPedindoData] = useState(false);

  // ⚠️ A faixa do gatilho é SIMÉTRICA: pago menor entra nela. Aqui o "sim"
  // sozinho fecharia um agendamento ainda devido.
  const pagouMenos = pagoCentavos < compromisso.valorPrevistoCentavos;
  const saldo = compromisso.valorPrevistoCentavos - pagoCentavos;

  return (
    <Card className="border-ink">
      <div className="text-[14.5px] font-semibold">
        {/* Data com ANO — ADENDO 3 §G.2. */}
        {perguntaQuitacao(compromisso.dataPrevista!)}
      </div>
      <Dica>{resumoDoAgendamento(compromisso)}</Dica>

      {pagouMenos ? (
        <>
          <Dica>
            <strong>
              Este pagamento é {formatarBRL(saldo)} menor que o previsto.
            </strong>{" "}
            O app não tem como saber o que aconteceu. Você é quem diz:
          </Dica>
          <div className="mt-2.5 flex flex-col gap-2">
            {/* Os dois botões do §D: mesmo peso, nenhum pré-selecionado, e
                rotulados pelo RESULTADO — nunca pela causa. */}
            <Botao
              variante="ghost"
              disabled={ocupado}
              onClick={() => onResponder({ tipo: "quita" })}
            >
              Sim, e quita este agendamento
            </Botao>
            <Botao
              variante="ghost"
              disabled={ocupado}
              onClick={() => setPedindoData(true)}
            >
              Sim, mas falta pagar o resto
            </Botao>
            <Botao
              variante="ghost"
              disabled={ocupado}
              onClick={() => onResponder({ tipo: "recusa" })}
            >
              {QUITACAO_NAO}
            </Botao>
          </div>

          {/* Critério 30: o saldo PRECISA de data, ou nasce vencido-sem-resposta
              e trava o relatório anual para sempre. */}
          {pedindoData ? (
            <div className="mt-2.5 flex flex-col gap-2">
              <CampoTexto
                rotulo="Quando você pretende pagar o resto?"
                tipo="date"
                valor={dataSaldo}
                onChange={(v) => {
                  setDataSaldo(v);
                  setSemData(false);
                }}
              />
              <Botao
                variante={semData ? "primary" : "ghost"}
                onClick={() => {
                  setSemData(true);
                  setDataSaldo("");
                }}
              >
                Ainda não sei — deixar sem data
              </Botao>
              <Botao
                variante="primary"
                disabled={ocupado || (!semData && dataSaldo === "")}
                onClick={() =>
                  onResponder({
                    tipo: "falta",
                    novaDataPrevista: semData ? null : dataSaldo,
                  })
                }
              >
                Salvar — o agendamento continua com {formatarBRL(saldo)}
              </Botao>
              <Dica>
                <strong>&quot;Ainda não sei&quot; é resposta válida</strong> e
                não trava nada. O saldo <strong>não é custo de nada</strong> até
                sair da conta.
              </Dica>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-2.5 flex flex-col gap-2">
          {/* O "sim" é o único caminho que grava vínculo (critério 41). */}
          <Botao
            variante="primary"
            disabled={ocupado}
            onClick={() => onResponder({ tipo: "quita" })}
          >
            {QUITACAO_SIM}
          </Botao>
          <Botao
            variante="ghost"
            disabled={ocupado}
            onClick={() => onResponder({ tipo: "recusa" })}
          >
            {QUITACAO_NAO}
          </Botao>
        </div>
      )}

      <Dica>{QUITACAO_CONSEQUENCIA_DO_NAO}</Dica>
    </Card>
  );
}
