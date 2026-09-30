"use client";

/**
 * **VÍNCULOS A CONFIRMAR — CONTAI-081, critérios 10 a 15** (spec
 * `design/mocks/CONTAI-081.md` §1).
 *
 * A única superfície de tela NOVA do ticket, e ela existe porque só o cartão tem
 * o conceito de "uma fatura confirma/aloca vários compromissos de uma vez": em
 * PIX/boleto cada compromisso se confirma sozinho, e o bloco N≥2 mora na própria
 * `/compromisso/[id]/confirmar` (CONTAI-080 §4).
 *
 * ⚠️ **A LISTA É DERIVADA DO ESTADO GRAVADO, 100%** (critério 10):
 * `revalidacoesPendentesDaFatura` decide quais blocos existem a partir de
 * `compromisso.situacao`, da união de pré-vínculos resolvida AGORA e da ausência
 * de linha em `pagamento_documento`. O único query param desta tela
 * (`confirmouFatura`) liga uma FRASE e nada mais — recarregar sem ele mostra
 * exatamente os mesmos blocos.
 *
 * ⚠️ **Não existe "confirmar tudo", e a ausência é o Gate Fiscal** (§J.3): cada
 * `BlocoRevalidacao` grava com uma chamada própria, no seu clique. Um botão único
 * produziria 2+ conversões com um único ato de vontade — é o que a doutrina
 * proíbe, e é o pre-mortem 2 do ticket.
 *
 * ⚠️ **Sem `router.push` automático em estado nenhum** (critério 15): cenário de
 * gestão, sentado. Quem decide quando sair é o Mateus — forçar navegação no
 * instante em que o último bloco confirma tiraria dele a chance de ver a
 * confirmação antes de a tela mudar.
 *
 * Cenário: gestão (revisar vínculos depois de confirmar a fatura, em casa).
 */

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { BlocoRevalidacao } from "@/app/_components/bloco-revalidacao";
import { CabecalhoDaTela, ColunaDeDetalhe } from "@/app/_components/detalhe";
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
  carregarPainel,
  classificarErro,
  type ErroDeTela,
} from "@/lib/data";
import {
  revalidacoesPendentesDaFatura,
  type RevalidacaoPendente,
} from "@/lib/fiscal/compromisso";
import type { Fatura } from "@/lib/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | { fase: "pronto"; fatura: Fatura; pendentes: RevalidacaoPendente[] };

function VinculosDaFatura() {
  const { id } = useParams<{ id: string }>();
  /**
   * ⚠️ **COSMÉTICO, e só** (spec §3): decide se a frase de transição aparece,
   * nunca o que a lista mostra. Mesmo padrão de `desembolsoId` em
   * `/fatura/[id]/alocar`.
   */
  const confirmouFatura = useSearchParams().get("confirmouFatura") === "1";
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  /**
   * Só o TEXTO do card terminal depende disto (spec §1.6): "acabei de resolver o
   * último" × "cheguei aqui e não havia nada". Nenhuma decisão sobre blocos passa
   * por esta flag.
   */
  const [resolvidoNestaVisita, setResolvidoNestaVisita] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const fatura = await carregarFatura(id);
        // O painel traz `documentos` (para resolver a união) e `pagamentos` (com
        // `documentoIds`, que é a terceira condição do §1.1). A agenda vem por
        // carregador PRÓPRIO — compromisso e números da declaração nunca chegam
        // na mesma variável (parecer §2).
        const [compromissos, painel] = await Promise.all([
          carregarCompromissos(fatura.obraId),
          carregarPainel(fatura.obraId),
        ]);
        if (cancelado) return;
        const idsDaFatura = new Set(fatura.compromissoIds);
        setEstado({
          fase: "pronto",
          fatura,
          pendentes: revalidacoesPendentesDaFatura(
            compromissos.filter((c) => idsDaFatura.has(c.id)),
            painel.documentos,
            painel.pagamentos,
          ),
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

  /**
   * O bloco confirmou e saiu. **Nenhum re-fetch da lista inteira** (spec §1.4):
   * recarregar tudo re-renderizaria blocos que ninguém tocou, inclusive um que
   * estivesse com erro na tela. O item sai do array local, e o estado gravado —
   * que é a verdade — já é o que o próximo carregamento vai ler.
   */
  const removerBloco = useCallback((compromissoId: string) => {
    setResolvidoNestaVisita(true);
    setEstado((atual) =>
      atual.fase === "pronto"
        ? {
            ...atual,
            pendentes: atual.pendentes.filter(
              (p) => p.compromisso.id !== compromissoId,
            ),
          }
        : atual,
    );
  }, []);

  if (estado.fase !== "pronto") {
    return (
      <>
        <CabecalhoDaTela titulo="Vínculos a confirmar" />
        <ColunaDeDetalhe>
          {estado.fase === "carregando" ? (
            <Carregando rotulo="Carregando os vínculos pendentes desta fatura" />
          ) : (
            <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  const { fatura, pendentes } = estado;
  /** Sempre o número de blocos ATUALMENTE renderizados — nunca o do carregamento. */
  const m = pendentes.length;

  // ══ M = 0 · o card terminal, um layout e dois textos (spec §1.6) ══════════
  if (m === 0) {
    return (
      <>
        <CabecalhoDaTela
          titulo="Vínculos a confirmar"
          sub="nada pendente nesta fatura"
        />
        <ColunaDeDetalhe>
          {resolvidoNestaVisita ? (
            <Banner cor="grn" role="status">
              <strong>Vínculo(s) confirmado(s).</strong> Nenhum compromisso desta
              fatura ainda espera decisão.
            </Banner>
          ) : (
            // Sem `Banner` de sucesso: nada foi confirmado agora. Só o fato,
            // neutro — mesmo tom do card vazio de `/pagamento/[id]/ligar`.
            <Card data-vinculos="vazio">
              <p className="text-[13.5px]">
                Nenhum vínculo pendente nesta fatura no momento. Compromissos com
                uma única nota pré-ligada já foram vinculados automaticamente; os
                demais seguem em aberto até o pagamento.
              </p>
            </Card>
          )}
          <BotaoLink
            href={`/fatura/${fatura.id}`}
            variante={resolvidoNestaVisita ? "primary" : "ghost"}
          >
            Voltar à fatura
          </BotaoLink>
        </ColunaDeDetalhe>
      </>
    );
  }

  return (
    <>
      <CabecalhoDaTela
        titulo="Vínculos a confirmar"
        sub={`${m} ${m === 1 ? "compra" : "compras"} desta fatura, ${
          m === 1
            ? "pré-ligada a mais de uma nota"
            : "pré-ligadas a mais de uma nota"
        }`}
      />
      <ColunaDeDetalhe>
        {/* ⚠️ ÂMBAR, não verde (spec §3): a fatura foi de fato confirmada — fato
            consumado, merece reconhecimento —, mas ainda sobra decisão dele.
            Verde aqui mentiria "terminado". Some sozinho quando M chega a zero,
            porque o card terminal já faz a despedida. */}
        {confirmouFatura ? (
          <Banner cor="amb" role="status">
            <strong>Fatura confirmada.</strong> Falta só decidir {m}{" "}
            {m === 1 ? "vínculo" : "vínculos"} antes de fechar de vez.
          </Banner>
        ) : null}

        {pendentes.map((p) => (
          <BlocoRevalidacao
            key={p.compromisso.id}
            compromisso={p.compromisso}
            resolvidos={p.resolvidos}
            pagamentoId={p.pagamentoId}
            onConfirmado={removerBloco}
          />
        ))}

        <Dica>
          Cada compra se confirma sozinha — não existe &quot;confirmar
          todas&quot;. Enquanto uma delas não for confirmada, as notas dela seguem
          contando em &quot;Notas hábeis sem pagamento vinculado&quot;.
        </Dica>
        {/* O shell não tem breadcrumb: a saída é este link, no mesmo lugar e com
            o mesmo peso de "Voltar ao agendamento" das telas do CONTAI-080. */}
        <BotaoLink href={`/fatura/${fatura.id}`}>Voltar à fatura</BotaoLink>
      </ColunaDeDetalhe>
    </>
  );
}

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando rotulo="Carregando" />}>
      <VinculosDaFatura />
    </Suspense>
  );
}
