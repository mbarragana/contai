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
 */

import { useCallback, useEffect, useState } from "react";

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
    async (compromisso: Compromisso, quita: boolean) => {
      setGravando(compromisso.id);
      setErro(null);
      try {
        if (quita) {
          // ⚠️ `quitaIntegralmente: true` porque este caminho é o "sim" a uma
          // sugestão de valor PRÓXIMO — a quitação parcial deliberada é ato
          // que começa no agendamento, com a nova data do saldo (critério 30).
          await quitarCompromisso({
            compromisso,
            pagamento,
            quitaIntegralmente: true,
          });
          onQuitou?.();
        } else {
          await recusarQuitacao(pagamento.id, compromisso.id);
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
        <Card key={c.id} className="border-ink">
          <div className="text-[14.5px] font-semibold">
            {/* Data com ANO — ADENDO 3 §G.2. */}
            {perguntaQuitacao(c.dataPrevista!)}
          </div>
          <Dica>{resumoDoAgendamento(c)}</Dica>
          <div className="mt-2.5 flex flex-col gap-2">
            {/* Dois botões, e o "sim" é o único caminho que grava vínculo. */}
            <Botao
              variante="primary"
              disabled={gravando !== null}
              onClick={() => void responder(c, true)}
            >
              {QUITACAO_SIM}
            </Botao>
            <Botao
              variante="ghost"
              disabled={gravando !== null}
              onClick={() => void responder(c, false)}
            >
              {QUITACAO_NAO}
            </Botao>
          </div>
          <Dica>{QUITACAO_CONSEQUENCIA_DO_NAO}</Dica>
        </Card>
      ))}
    </div>
  );
}
