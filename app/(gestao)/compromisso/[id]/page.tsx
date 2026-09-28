"use client";

/**
 * Detalhe do agendamento — CONTAI-019, critérios 15, 22, 33 e 34.
 *
 * ⚠️ **"Marcar que não vai ser pago" mora SÓ AQUI** (diretriz de desenho 6 /
 * critério 22), nunca no cartão da home: cancelar é ato deliberado com motivo
 * obrigatório, e um alvo de cancelamento a um toque na home é o caminho para
 * apagar por engano o que o parecer §3 manda preservar.
 *
 * ⚠️ **CONTAI-045**: a tela migrou para o shell de gestão. É tela de LEITURA com
 * várias ações — logo, **sem rodapé fixo** (decisão 4 do `detalhe-no-shell-v1`):
 * as três respostas ficam no fim do card a que pertencem, que é o que a doutrina
 * "consequência nunca atrás de clique" já pede. O "Voltar ao início" virou o
 * breadcrumb do topbar — muda de lugar, não se duplica. Ele diz **"‹ Agenda"**
 * desde o `CONTAI-076`, e nenhuma linha deste arquivo mudou para isso: o rótulo
 * mora em `RAIZES_DE_DETALHE.compromisso.mae`, e quem desenha é o shell.
 */

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CabecalhoDoAgendamento } from "@/app/_components/agendado";
import { CabecalhoDaTela, ColunaDeDetalhe } from "@/app/_components/detalhe";
import {
  Banner,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Chip,
  Dica,
  EstadoErro,
  Linha,
  Passo,
} from "@/app/_components/ui";
import {
  buscarFaturaDoCompromisso,
  carregarCompromisso,
  carregarHistoricoDeData,
  carregarHistoricoDeValorPrevisto,
  carregarPainel,
  classificarErro,
  type ErroDeTela,
} from "@/lib/data";
import {
  CHIP_PRE_VINCULO,
  documentosResolvidosNaConfirmacao,
  saldoDoCompromisso,
  textoPreVinculoDoCompromisso,
} from "@/lib/fiscal/compromisso";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL, numericParaCentavos } from "@/lib/money";
import type {
  Compromisso,
  CompromissoDataHistoricoRow,
  CompromissoValorHistoricoRow,
  Documento,
  Pagamento,
} from "@/lib/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      compromisso: Compromisso;
      pagamentos: Pagamento[];
      /**
       * CONTAI-080 — as notas da obra, só para RESOLVER os ids do pré-vínculo
       * em texto (`documentosResolvidosNaConfirmacao`). Nenhum número desta
       * lista é somado aqui: o card "O que isso muda hoje" continua com os três
       * zeros literais que o parecer §1 exige.
       */
      documentos: Documento[];
      historico: CompromissoDataHistoricoRow[];
      /** CONTAI-073 — tabela SEPARADA da de data (critério 20). */
      historicoDeValor: CompromissoValorHistoricoRow[];
      obraNome: string;
      /**
       * CONTAI-022 — só para `origem === "cartao"`. `null` enquanto a busca
       * não volta (o botão espera; ver a guarda no card de situação).
       */
      faturaId: string | null;
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
        const [painel, historico, historicoDeValor, faturaId] = await Promise.all([
          carregarPainel(compromisso.obraId),
          carregarHistoricoDeData(compromisso.id),
          carregarHistoricoDeValorPrevisto(compromisso.id),
          compromisso.origem === "cartao"
            ? buscarFaturaDoCompromisso(compromisso.id)
            : Promise.resolve(null),
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
          documentos: painel.documentos,
          historico,
          historicoDeValor,
          obraNome: painel.obra.nome,
          faturaId,
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
        <CabecalhoDaTela titulo="Agendamento" />
        <ColunaDeDetalhe>
          {estado.fase === "carregando" ? (
            <Carregando rotulo="Carregando o agendamento" />
          ) : (
            <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  const c = estado.compromisso;
  const saldo = saldoDoCompromisso(c, estado.pagamentos);
  const aberto = c.situacao === "aberto";

  /**
   * **CONTAI-080 — o N, RECALCULADO A CADA RENDER** (ADENDO 8 §L.3, `[Certain]`):
   * *"o N que decide a variante não pode ser calculado uma vez e guardado junto
   * do chip — ele precisa ser recalculado toda vez que a tela do detalhe
   * renderiza"*. A lista é editável até a confirmação: quem pré-liga 1 nota e
   * depois acrescenta a segunda tem de ver a variante N≥2 na renderização
   * seguinte, e o inverso ao remover.
   *
   * É a UNIÃO deduplicada (pré-vínculos ∪ nota de origem), pela mesma função que
   * a confirmação usa — nunca uma segunda contagem (critério 10).
   */
  const resolvidos = documentosResolvidosNaConfirmacao(c, estado.documentos);

  /**
   * ⚠️ **D2 do Gate 2 — cartão não tem pré-vínculo, e por isso não tem CTA nem
   * texto.** A quitação de uma compra de cartão acontece pela fatura, por RPC
   * que não conta N e não pergunta nada: as duas variantes do ADENDO 8 §L.2
   * ("vai vincular automaticamente" / "vai te perguntar") seriam falsas nas
   * duas pontas. O fluxo de cartão é o CONTAI-081.
   *
   * A régua é a MESMA de `podePreVincular` (a guarda de escrita) — não uma
   * segunda condição escrita à mão: o que muda é só que aqui não há documento
   * para checar obra, então a tela lê a única condição que depende do
   * compromisso.
   */
  const preVinculoDisponivel = c.origem !== "cartao";

  return (
    <>
      <CabecalhoDaTela
        titulo="Agendamento"
        sub={`${c.favorecidoNome ?? "favorecido não informado"} · ${estado.obraNome}`}
      />
      <ColunaDeDetalhe>
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

          {/* ⚠️ **CONTAI-080 — o pré-vínculo, e ele NÃO é confirmação de custo.**
              Chip ÂMBAR VAZADO, o mesmo peso do chip "Agendado": §J.2 é
              explícito — *"nunca vermelho, nunca verde: não é pendência de risco
              nem confirmação de custo"*. O texto é literal do ADENDO 8 §L.2, na
              variante do N atual, e está aqui (dentro do card do FATO) e não
              atrás de clique, pela mesma doutrina de "consequência nunca atrás
              de clique". */}
          {aberto && preVinculoDisponivel && resolvidos.length > 0 ? (
            <div className="mt-2" data-pre-vinculo="compromisso">
              <Chip cor="amb" peso="vazado">
                {CHIP_PRE_VINCULO}
              </Chip>
              <p className="mt-1.5 text-[13px]">
                {textoPreVinculoDoCompromisso(resolvidos)}
              </p>
            </div>
          ) : null}

          {/* ⚠️ **As três respostas, no fim do card do FATO que elas respondem**
              (CONTAI-045, decisão 4 do `detalhe-no-shell-v1`): esta é tela de
              leitura com várias ações, e no shell ela não ganha rodapé fixo. Os
              rótulos, a ordem e a guarda do cartão são os mesmos do rodapé de
              430px — o que mudou foi o lugar. */}
          {aberto ? (
            <div
              data-acoes="agendamento"
              className="mt-3 flex flex-col gap-2 border-t border-line pt-3"
            >
              {/* ⚠️ CONTAI-022 — achado do `cto-obra`: compra no cartão NUNCA
                  vai para o pagamento avulso. Sem esta guarda, a compra seria
                  quitada com a data da COMPRA (o erro que este ticket existe
                  para consertar) e o teto de alocação da fatura contaria um
                  pagamento que não saiu dela. */}
              {c.origem === "cartao" ? (
                estado.faturaId ? (
                  <BotaoLink href={`/fatura/${estado.faturaId}`} variante="primary">
                    Ver a fatura
                  </BotaoLink>
                ) : (
                  <Botao variante="primary" disabled>
                    Carregando a fatura…
                  </Botao>
                )
              ) : (
                <BotaoLink href={`/compromisso/${c.id}/confirmar`} variante="primary">
                  Registrar o pagamento
                </BotaoLink>
              )}
              {/* ⚠️ **CONTAI-080 — logo DEPOIS da ação primária e ANTES das duas
                  correções**: agrupa "preparar o pagamento" antes de "corrigir o
                  agendamento", pela mesma lógica que juntou "Mudou a data" e
                  "Corrigir o valor previsto" no CONTAI-073. A guarda de
                  `situacao === 'aberto'` é a do bloco inteiro — o pré-vínculo não
                  tem guarda própria (critério 4).

                  ⚠️ **NÃO aparece para `origem === "cartao"`** — D2 do Gate 2.
                  O parecer não restringe por origem, e uma compra de cartão pode
                  de fato corresponder a mais de uma nota; o que não existe para
                  cartão é a CONVERSÃO (a fatura quita por RPC, sem contar N e
                  sem perguntar). Oferecer a declaração sem a conversão faria o
                  texto do §L.2 prometer os dois comportamentos que o caminho da
                  fatura não tem. Cartão é o CONTAI-081, inteiro. */}
              {/* ⚠️ **NÃO aparece para origem cartão** (D2 do Gate 2): ver
                  `preVinculoDisponivel` acima. Antes ele aparecia, e levava a
                  uma tela que prometia um automatismo que o caminho da fatura
                  não tem. */}
              {preVinculoDisponivel ? (
                <BotaoLink href={`/compromisso/${c.id}/pre-vincular`}>
                  Ligar notas a este agendamento
                </BotaoLink>
              ) : null}
              {/* "Mudou a data" de compra no cartão re-aloca a fatura — mesma
                  tela, RPC diferente (ver
                  `app/(gestao)/compromisso/[id]/data/page.tsx`). */}
              <BotaoLink href={`/compromisso/${c.id}/data`}>Mudou a data</BotaoLink>
              {/* CONTAI-073, critério 12 — entre as duas correções e ANTES da
                  ação mais drástica: agrupa "consertar o que digitei errado" e
                  deixa "não vai ser pago" isolada no fim. A guarda de
                  `situacao === 'aberto'` é a do bloco inteiro. */}
              <BotaoLink href={`/compromisso/${c.id}/valor`}>
                Corrigir o valor previsto
              </BotaoLink>
              {/* ⚠️ SÓ AQUI (critério 22 do CONTAI-019). */}
              <BotaoLink href={`/compromisso/${c.id}/cancelar`}>
                Marcar que não vai ser pago
              </BotaoLink>
            </div>
          ) : null}
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
                    {formatarBRL(p.encargosCentavos)} de juros e multa registrados
                    e <strong>fora do custo</strong>.
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

        {/* CONTAI-073, critério 19 — o histórico do VALOR, em card próprio ao
            lado do de data. As duas tabelas são independentes de propósito: o
            "adiado N×" conta linhas da de DATA, e uma correção de valor ali
            viraria um adiamento que nunca aconteceu (critério 20). Este é o
            único dos dois históricos com MOTIVO, e por isso ele aparece. */}
        {estado.historicoDeValor.length > 0 ? (
          <Card>
            <Passo>Histórico do valor previsto</Passo>
            {estado.historicoDeValor.map((h) => (
              <div key={h.id} className="border-b border-line py-[9px] last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex-none text-[12px] text-mut">
                    {formatarDataBR(h.registrado_em.slice(0, 10))}
                  </span>
                  <span className="mono text-right text-[13.5px]">
                    {formatarBRL(numericParaCentavos(h.valor_anterior) ?? 0)} →{" "}
                    <strong>
                      {formatarBRL(numericParaCentavos(h.valor_novo) ?? 0)}
                    </strong>
                  </span>
                </div>
                <Dica>motivo: {h.motivo}</Dica>
              </div>
            ))}
            <Dica>
              O valor anterior fica registrado. Corrigir o previsto{" "}
              <strong>não muda nenhum pagamento já feito</strong>.
            </Dica>
          </Card>
        ) : null}
      </ColunaDeDetalhe>
    </>
  );
}
