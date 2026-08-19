"use client";

/**
 * Detalhe do agendamento — CONTAI-019, critérios 15, 22, 33 e 34.
 *
 * ⚠️ **"Marcar que não vai ser pago" mora SÓ AQUI** (diretriz de desenho 6 /
 * critério 22), nunca no cartão da home: cancelar é ato deliberado com motivo
 * obrigatório, e um alvo de cancelamento a um toque na home é o caminho para
 * apagar por engano o que o parecer §3 manda preservar.
 */

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CabecalhoDoAgendamento } from "@/app/_components/agendado";
import {
  AppBar,
  BarraAdicionar,
  Banner,
  BotaoLink,
  Card,
  Carregando,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarCompromisso,
  carregarHistoricoDeData,
  carregarPainel,
  classificarErro,
  type ErroDeTela,
} from "@/lib/data";
import { saldoDoCompromisso } from "@/lib/fiscal/compromisso";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import type {
  Compromisso,
  CompromissoDataHistoricoRow,
  Pagamento,
} from "@/lib/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      compromisso: Compromisso;
      pagamentos: Pagamento[];
      historico: CompromissoDataHistoricoRow[];
      obraNome: string;
    };

const NOME_SITUACAO = {
  aberto: "Em aberto",
  quitado: "Quitado",
  cancelado: "Não vai ser pago",
} as const;

export default function DetalheAgendamento() {
  const { id } = useParams<{ id: string }>();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const hoje = hojeIso();

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const compromisso = await carregarCompromisso(id);
        const [painel, historico] = await Promise.all([
          carregarPainel(compromisso.obraId),
          carregarHistoricoDeData(compromisso.id),
        ]);
        if (cancelado) return;
        setEstado({
          fase: "pronto",
          compromisso,
          // ⚠️ Os pagamentos vêm do painel, e o painel NÃO conhece
          // compromisso — a leitura é de mão única (critério 3).
          pagamentos: painel.pagamentos.filter((p) =>
            compromisso.pagamentoIds.includes(p.id),
          ),
          historico,
          obraNome: painel.obra.nome,
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
        <AppBar titulo="Agendamento" />
        <Corpo>
          {estado.fase === "carregando" ? (
            <Carregando rotulo="Carregando o agendamento" />
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

  const c = estado.compromisso;
  const saldo = saldoDoCompromisso(c, estado.pagamentos);
  const aberto = c.situacao === "aberto";

  return (
    <>
      <AppBar
        titulo="Agendamento"
        sub={`${c.favorecidoNome ?? "favorecido não informado"} · ${estado.obraNome}`}
      />
      <Corpo>
        {/* As quatro marcas, pelo mesmo componente da home — nada de cartão
            paralelo que perca uma delas (critério 8). */}
        <CabecalhoDoAgendamento compromisso={c} hoje={hoje} />

        {aberto ? null : (
          <Banner cor={c.situacao === "quitado" ? "grn" : "amb"} role="status">
            <strong>{NOME_SITUACAO[c.situacao]}.</strong>{" "}
            {c.situacao === "cancelado" ? (
              <>
                O registro fica, com o motivo — nada é apagado. Este agendamento
                nunca gerou lançamento nenhum, então não há o que desfazer.
                <br />
                <strong>Motivo:</strong> {c.motivoCancelamento}
              </>
            ) : (
              <>
                O agendamento continua existindo — quem virou custo foram os{" "}
                <strong>pagamentos</strong> ligados a ele.
              </>
            )}
          </Banner>
        )}

        <Card>
          <Linha rotulo="Situação">{NOME_SITUACAO[c.situacao]}</Linha>
          <Linha rotulo="Como vai ser pago">{c.origem.toUpperCase()}</Linha>
          {/* Critério 34: o detalhe mostra a data vigente E a anterior. */}
          {c.adiamentos > 0 && estado.historico.length > 0 ? (
            <Linha rotulo="Data prevista">
              <strong>
                {c.dataPrevista ? `para ${formatarDataBR(c.dataPrevista)}` : "sem data definida"}
              </strong>{" "}
              <span className="text-mut">
                (era{" "}
                {estado.historico.at(-1)?.data_anterior
                  ? formatarDataBR(estado.historico.at(-1)!.data_anterior!)
                  : "sem data definida"}
                )
              </span>
            </Linha>
          ) : null}
          <Linha rotulo="Ainda falta pagar">
            <span className="mono text-mut">~ {formatarBRL(saldo)}</span>
          </Linha>
        </Card>

        <Card>
          <Passo>O que isso muda hoje</Passo>
          <Linha rotulo="Custo de aquisição">
            <span className="mono">{formatarBRL(0)}</span>
          </Linha>
          <Linha rotulo="Base de aferição INSS">
            <span className="mono">{formatarBRL(0)}</span>
          </Linha>
          <Linha rotulo="Pendência fiscal gerada">nenhuma</Linha>
          <Dica>
            Vai continuar assim até o dinheiro sair. Um agendamento não entra em
            soma nenhuma do app.
          </Dica>
        </Card>

        {/* Critério 15: 1 agendamento, N pagamentos, com saldo visível. */}
        <Card>
          <Passo>Pagamentos ligados</Passo>
          {estado.pagamentos.length === 0 ? (
            <Dica>Nenhum pagamento ligado a este agendamento ainda.</Dica>
          ) : (
            estado.pagamentos.map((p) => (
              <div key={p.id} className="mt-2 border-t border-line pt-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px]">
                    <span className="mono font-semibold">
                      {formatarBRL(p.valorCentavos)}
                    </span>{" "}
                    · <strong>pago em {formatarDataBR(p.dataPagamento)}</strong>
                  </span>
                </div>
                {p.encargosCentavos > 0 ? (
                  <Dica>
                    {formatarBRL(p.encargosCentavos)} de juros e multa
                    registrados e <strong>fora do custo</strong>.
                  </Dica>
                ) : null}
                <div className="mt-2">
                  <BotaoLink href={`/pagamento/${p.id}`}>
                    Ver o pagamento
                  </BotaoLink>
                </div>
              </div>
            ))
          )}
        </Card>

        {/* Critério 34: o histórico completo fica no detalhe. */}
        {estado.historico.length > 0 ? (
          <Card>
            <Passo>Histórico da data prevista</Passo>
            {estado.historico.map((h) => (
              <Linha key={h.id} rotulo={formatarDataBR(h.registrado_em.slice(0, 10))}>
                {h.data_anterior ? formatarDataBR(h.data_anterior) : "sem data"} →{" "}
                {h.data_nova ? formatarDataBR(h.data_nova) : "sem data definida"}
              </Linha>
            ))}
            <Dica>
              A data anterior fica registrada. <strong>Nenhuma das duas vira
              data de pagamento</strong> — a que vale é a do dia em que o
              dinheiro sair.
            </Dica>
          </Card>
        ) : null}
      </Corpo>
      <Rodape>
        {aberto ? (
          <>
            <BotaoLink href={`/compromisso/${c.id}/confirmar`} variante="primary">
              Registrar o pagamento
            </BotaoLink>
            <BotaoLink href={`/compromisso/${c.id}/data`}>Mudou a data</BotaoLink>
            {/* ⚠️ SÓ AQUI (critério 22). */}
            <BotaoLink href={`/compromisso/${c.id}/cancelar`}>
              Marcar que não vai ser pago
            </BotaoLink>
          </>
        ) : null}
        <BotaoLink href="/">Voltar ao início</BotaoLink>
      </Rodape>
    </>
  );
}
