"use client";

/**
 * **BLOCO DE REVALIDAÇÃO — CONTAI-081, critérios 11 e 12** (spec
 * `design/mocks/CONTAI-081.md` §1.3/§1.4).
 *
 * Um card por compromisso de fatura que resolveu **N ≥ 2** e ainda não teve os
 * vínculos confirmados. É o bloco do ADENDO 6 §J.3 — o MESMO texto e os MESMOS
 * dois botões que `/compromisso/[id]/confirmar` já mostra para PIX/boleto desde o
 * CONTAI-080 —, aqui repetido N vezes numa lista em vez de uma vez numa tela
 * cheia.
 *
 * ⚠️ **AS QUATRO CONDIÇÕES DO GATE FISCAL vivem neste arquivo**, e são a razão de
 * ele existir separado da página:
 *
 * 1. **Nasce neutro.** Nenhum botão vem pré-marcado, nenhum checkbox vem
 *    preenchido como "Sim". `variante="primary"` no botão de cima é hierarquia de
 *    ação (a convenção de toda tela de confirmação do produto), não resposta
 *    esperada.
 * 2. **Cada clique grava SÓ este bloco**, com uma chamada `criarVinculos` própria
 *    — nunca um envio em lote, nunca um botão único "confirmar tudo". O que a
 *    doutrina do §J.3 proíbe é *"2+ conversões com um único ato de vontade"*, e é
 *    exatamente isso que um "confirmar tudo" produziria.
 * 3. **"Revisar" de um bloco não trava nem confirma os outros**: ele navega, sem
 *    gravar nada, e os demais blocos continuam como estavam.
 * 4. **O que foi confirmado PERSISTE.** A gravação é o fato; a lista da página é
 *    derivada do estado gravado. Sair no meio não desfaz o que já entrou.
 *
 * ⚠️ **ESTADO PRÓPRIO, nunca de lista** (spec §1.4, e a diferença com
 * `quitacao.tsx` é deliberada): `SugestaoQuitacao` usa um `gravando: string | null`
 * e um `erro` COMPARTILHADOS por toda a lista. Aqui isso violaria a condição 3 —
 * um erro de rede num bloco apareceria colado a um bloco que ninguém tocou. Cada
 * `BlocoRevalidacao` guarda o seu, e por isso o estado mora no componente e não
 * na página.
 */

import { useEffect, useState } from "react";

import {
  Banner,
  Botao,
  BotaoLink,
  BotaoSalvar,
  Card,
  Dica,
} from "@/app/_components/ui";
import { criarVinculos, mensagemDeErroDeGravacao } from "@/lib/data";
import {
  identificarDocumentoPreLigado,
  perguntaConfirmarPreVinculos,
  PRE_VINCULO_CONFIRMAR,
  PRE_VINCULO_REVISAR,
} from "@/lib/fiscal/compromisso";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { ehDocumentoHabil } from "@/lib/fiscal/vinculo";
import { formatarBRL } from "@/lib/money";
import type { Compromisso, Documento } from "@/lib/types";

/** Quanto tempo o "Vínculo confirmado." fica visível antes de o bloco sair. */
const MS_ATE_SAIR = 1200;

type Fase = "pronto" | "gravando" | "confirmado" | "erro";

export function BlocoRevalidacao({
  compromisso,
  resolvidos,
  pagamentoId,
  onConfirmado,
}: {
  compromisso: Compromisso;
  /** A união deduplicada, já resolvida — nunca recontada aqui dentro. */
  resolvidos: readonly Documento[];
  /** O pagamento que nasceu da quitação desta compra. */
  pagamentoId: string;
  /** Avisa a página que este bloco saiu — chamado DEPOIS da gravação. */
  onConfirmado: (compromissoId: string) => void;
}) {
  const [fase, setFase] = useState<Fase>("pronto");
  const [erro, setErro] = useState<string | null>(null);

  // O bloco sai da lista pouco depois do sucesso: a saída imediata tiraria da
  // tela a confirmação antes de ele conseguir lê-la, e um `router.push` tiraria
  // dele os blocos que ainda faltam decidir (spec §1.4/§1.6).
  useEffect(() => {
    if (fase !== "confirmado") return;
    const t = setTimeout(() => onConfirmado(compromisso.id), MS_ATE_SAIR);
    return () => clearTimeout(t);
  }, [fase, compromisso.id, onConfirmado]);

  /**
   * ⚠️ **UMA chamada, para os documentos DESTE compromisso e mais nada.** O
   * conjunto inteiro do §J.3 entra de uma vez (a revalidação cobre o conjunto,
   * não par por par) — e o conjunto é o deste bloco.
   *
   * Erro não desfaz nada e não navega: o pagamento já está salvo e os
   * pré-vínculos continuam gravados, então repetir o clique é seguro.
   */
  async function confirmar() {
    if (fase === "gravando") return;
    setFase("gravando");
    setErro(null);
    try {
      await criarVinculos(
        resolvidos.map((d) => ({
          pagamentoId,
          documentoId: d.id,
          obraDoPagamentoId: compromisso.obraId,
          obraDoDocumentoId: d.obraId,
          documentoHabil: ehDocumentoHabil(d),
        })),
      );
      setFase("confirmado");
    } catch (e) {
      setErro(
        mensagemDeErroDeGravacao(
          e,
          "no detalhe do pagamento, se as notas já aparecem ligadas",
        ),
      );
      setFase("erro");
    }
  }

  const quando = compromisso.dataCompra ?? compromisso.dataPrevista;

  if (fase === "confirmado") {
    return (
      <Card
        className="border-grn"
        data-bloco="revalidacao"
        data-compromisso={compromisso.id}
      >
        <div className="text-[13px] font-semibold">
          {compromisso.favorecidoNome ?? "favorecido não informado"}
        </div>
        <div className="mt-2">
          <Banner cor="grn" role="status">
            <strong>Vínculo confirmado.</strong>
          </Banner>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="border-dashed border-amb"
      data-bloco="revalidacao"
      data-compromisso={compromisso.id}
    >
      {/* Cabeçalho, no mesmo padrão tipográfico dos itens de "Compras
          vinculadas" em `/fatura/[id]` — é a lista que ele acabou de olhar. */}
      <div className="text-[13px]">
        <strong>{compromisso.favorecidoNome ?? "favorecido não informado"}</strong>
        <br />
        <span className="text-mut">
          compra {formatarDataBR(quando ?? "")} ·{" "}
          {formatarBRL(compromisso.valorPrevistoCentavos)}
        </span>
      </div>

      {/* Texto LITERAL do ADENDO 6 §J.3, montado por
          `perguntaConfirmarPreVinculos` — o bloco não redige nem reordena. */}
      <p className="mt-2 text-[14.5px] font-semibold">
        {perguntaConfirmarPreVinculos(resolvidos)}
      </p>
      <div className="mt-1 text-[12.5px] text-mut">
        {resolvidos.map((d) => (
          <div key={d.id}>
            {identificarDocumentoPreLigado(d)} ·{" "}
            {d.favorecidoNome ?? "emitente não informado"}
          </div>
        ))}
      </div>

      {/* ⚠️ Erro SÓ DENTRO deste card (condição 3 do Gate Fiscal): nenhum
          re-fetch da lista, nenhum estado compartilhado, e o botão volta a
          `pronto` — o mesmo clique tenta de novo. */}
      {fase === "erro" && erro !== null ? (
        <div className="mt-2">
          <Banner cor="red" role="alert">
            Não deu para confirmar este vínculo. <strong>Nada foi
            alterado</strong> — tente de novo. {erro}
          </Banner>
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        <BotaoSalvar
          ocupado={fase === "gravando"}
          variante="primary"
          onClick={() => void confirmar()}
          disabled={fase === "gravando"}
        >
          {fase === "gravando" ? "Confirmando…" : PRE_VINCULO_CONFIRMAR}
        </BotaoSalvar>
        {/* Durante a gravação DESTE bloco o "Revisar" também desabilita — evita
            navegar para longe com uma chamada deste mesmo bloco em voo. Sem query
            param: `/pagamento/[id]/ligar` deriva sozinha o que pré-marcar
            (critério 13 do CONTAI-080). */}
        {fase === "gravando" ? (
          <Botao disabled>{PRE_VINCULO_REVISAR}</Botao>
        ) : (
          <BotaoLink href={`/pagamento/${pagamentoId}/ligar`}>
            {PRE_VINCULO_REVISAR}
          </BotaoLink>
        )}
      </div>
      <Dica>
        Você pode revisar: o valor pago pode não bater com o que estava previsto,
        e a nota certa pode ser outra. <strong>Nada é rateado
        automaticamente</strong> — quem divide é a regra do mínimo, depois de o
        vínculo existir.
      </Dica>
    </Card>
  );
}
