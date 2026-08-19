"use client";

/**
 * O AGENDADO na tela — CONTAI-019, critérios 8, 8b, 9, 42 e 43.
 *
 * ⚠️ **AS QUATRO MARCAS MORAM AQUI, JUNTAS, DE PROPÓSITO.** O critério 8 exige
 * borda **tracejada**, chip âmbar, `~` + cinza no valor e preposição de tempo —
 * **nos DOIS estados**, aberto e vencido. "Perder uma em qualquer um deles é
 * regressão: a redundância *é* o requisito" (parecer §5, defesa 2).
 *
 * Se cada tela desenhasse o seu cartão, a quarta marca cairia numa delas sem
 * ninguém notar. Aqui só existem dois componentes, e os dois passam pelo mesmo
 * `MarcasAgendado`.
 *
 * ⚠️ **O PAGO NÃO PASSA POR AQUI** (critério 9): pagamento não carrega marca
 * nenhuma de agendamento. O inverso produz o erro caro — um pagamento que
 * "parece agendado" faz o Mateus registrar o mesmo PIX de novo.
 *
 * ⚠️ **NENHUM TOKEN VERMELHO DENTRO DESTE ARQUIVO** (critérios 19 e 8b): nada
 * saiu da conta, logo não há risco fiscal ainda. **Âmbar = nada saiu ainda;
 * vermelho = saiu e não está no custo.**
 */

import Link from "next/link";
import type { ReactNode } from "react";

import {
  BotaoLink,
  Card,
  Chip,
  Consequencia,
  Dica,
  Passo,
} from "@/app/_components/ui";
import {
  CABECALHO_BLOCO_AGENDADOS,
  chipDoAgendado,
  ehVencidoSemResposta,
  preposicaoDeTempo,
  type AgendaHome,
} from "@/lib/fiscal/compromisso";
import { formatarBRL } from "@/lib/money";
import type { Compromisso } from "@/lib/types";

/**
 * Marca 3 — `~` e CINZA no valor previsto, e o rótulo diz **"valor previsto"**,
 * nunca "valor" (critério 11 / Gate Fiscal 6.3). O til não é enfeite: ele
 * marca o número como não-executado no mesmo lugar em que o olho procura
 * dinheiro.
 */
export function ValorPrevisto({ centavos }: { centavos: number }) {
  return (
    <span className="mono text-mut" data-marca="valor-previsto">
      ~ {formatarBRL(centavos)}
    </span>
  );
}

/**
 * As marcas 2, 3 e 4 numa linha só. A marca 1 (borda tracejada) é do
 * contêiner — ver `CartaoVencido` e `LinhaAberta`, que usam `border-dashed`
 * nos DOIS casos.
 */
export function MarcasAgendado({
  compromisso,
  hoje,
}: {
  compromisso: Compromisso;
  hoje: string;
}) {
  const chip = chipDoAgendado(compromisso, hoje);
  return (
    <>
      {/* Marca 2 — chip âmbar: PREENCHIDO no vencido, VAZADO no aberto. */}
      <Chip cor="amb" vazado={!chip.forte}>
        {chip.texto}
      </Chip>
      <div className="mt-1.5 font-semibold">
        {compromisso.favorecidoNome ?? "Favorecido não informado"}
      </div>
      <Dica>
        <span className="text-mut">Valor previsto</span>{" "}
        {/* Marca 3 */}
        <ValorPrevisto centavos={compromisso.valorPrevistoCentavos} /> ·{" "}
        {/* Marca 4 — a preposição carrega o tempo. */}
        <strong data-marca="preposicao">
          {preposicaoDeTempo(compromisso, hoje)}
        </strong>
        {compromisso.adiamentos >= 2 ? (
          <>
            {" "}
            · <strong>adiado {compromisso.adiamentos}×</strong>
          </>
        ) : null}
      </Dica>
    </>
  );
}

/**
 * O texto do vencido sem resposta. Copiado do que o Gate Fiscal 4 e o adendo
 * §A dizem, sem prometer nada além disso: **isto não é pendência fiscal**, e
 * mesmo assim **não some sozinho**.
 */
export const VENCIDO_SEM_RESPOSTA =
  "Isto não é pendência fiscal: nada saiu da conta, então não há risco fiscal " +
  "ainda. Mas não some sozinho — enquanto ficar sem resposta, nenhum " +
  "relatório anual pode ser gerado, nem o deste ano nem o de outro.";

/**
 * As TRÊS RESPOSTAS DE UM TOQUE (critérios 18 e 49), pelos três EFEITOS:
 * (i) criar pagamento pela confirmação; (ii) cancelar com motivo; (iii) nova
 * data prevista. Os verbos são do mock v2 aprovado.
 *
 * ⚠️ **Elas existem só no VENCIDO** — é a terceira diferença estrutural do
 * critério 8b, e a que carrega o peso. No aberto não há nenhuma.
 *
 * ⚠️ "Foi pago" **abre a confirmação**, em qualquer contexto: não existe
 * estado "declarou que saiu" (critério 44). Um "ele disse que saiu" sem data é
 * um registro em formato de mentira — afirma o fato e não sabe quando.
 */
export function TresRespostas({ id }: { id: string }) {
  return (
    <div
      className="mt-2.5 flex flex-col gap-2"
      role="group"
      aria-label="Respostas do agendamento vencido"
    >
      <BotaoLink href={`/compromisso/${id}/confirmar`}>Foi pago</BotaoLink>
      <BotaoLink href={`/compromisso/${id}/cancelar`}>
        Não vai ser pago
      </BotaoLink>
      <BotaoLink href={`/compromisso/${id}/data`}>Mudou a data</BotaoLink>
    </div>
  );
}

/** Vencido: CARTÃO, com as três respostas dentro (critério 43). */
export function CartaoVencido({
  compromisso,
  hoje,
  children,
}: {
  compromisso: Compromisso;
  hoje: string;
  children?: ReactNode;
}) {
  return (
    // Marca 1 — TRACEJADA. ⚠️ O mock v2 troca por sólida aqui e ISSO É O
    // DEFEITO, não o requisito (critérios 8 e 8b, decisão 2 do fechamento de
    // 18/08): "a tracejada fica nos dois; precisando de mais peso,
    // engrossa-se a tracejada, nunca se troca o estilo". Daí `border-2`.
    <Card
      className="border-2 border-dashed border-amb"
      data-agendado="vencido"
    >
      <MarcasAgendado compromisso={compromisso} hoje={hoje} />
      <Consequencia cor="amb">{VENCIDO_SEM_RESPOSTA}</Consequencia>
      <TresRespostas id={compromisso.id} />
      {children}
    </Card>
  );
}

/**
 * Aberto: LINHA (~44px), não cartão (critério 43) — e mesmo assim com as
 * quatro marcas. Sem respostas: não há o que responder, a data ainda não
 * chegou.
 */
export function LinhaAberta({
  compromisso,
  hoje,
}: {
  compromisso: Compromisso;
  hoje: string;
}) {
  return (
    <Link
      href={`/compromisso/${compromisso.id}`}
      data-agendado="aberto"
      className="flex min-h-[44px] flex-col justify-center rounded-[10px] border border-dashed border-amb bg-white px-[14px] py-2"
    >
      <MarcasAgendado compromisso={compromisso} hoje={hoje} />
    </Link>
  );
}

/**
 * O bloco da home — **separado, com rótulo próprio, longe do custo**
 * (critério 10).
 *
 * ⚠️ **CONTAGEM, NUNCA SOMA** (critério 42). Número em reais a centímetros do
 * custo confirmado vira "quanto a obra tem marcado" — previsão de fluxo de
 * caixa, fora de escopo declarado. Os valores aparecem item a item, cada um
 * com `~` e cinza; o que não existe é um total.
 */
export function BlocoAgendados({
  agenda,
  hoje,
}: {
  agenda: AgendaHome;
  hoje: string;
}) {
  if (agenda.vazia) return null;
  return (
    <div data-bloco="agendados" className="flex flex-col gap-3">
      <Passo>Agendados · {agenda.contagem}</Passo>
      {/* Cabeçalho literal do Gate Fiscal 6.5, em linguagem de tela. */}
      <Consequencia cor="amb">{CABECALHO_BLOCO_AGENDADOS}</Consequencia>

      {/* ⚠️ TODOS os vencidos, sem truncar nunca. */}
      {agenda.vencidos.map((c) => (
        <CartaoVencido key={c.id} compromisso={c} hoje={hoje} />
      ))}

      {agenda.abertos.map((c) => (
        <LinhaAberta key={c.id} compromisso={c} hoje={hoje} />
      ))}

      {agenda.abertosTotal > agenda.abertos.length ? (
        <BotaoLink href="/compromisso">
          ver todos ({agenda.abertosTotal})
        </BotaoLink>
      ) : null}
    </div>
  );
}

/** Cabeçalho do detalhe, reaproveitando as marcas — nada de cartão paralelo. */
export function CabecalhoDoAgendamento({
  compromisso,
  hoje,
}: {
  compromisso: Compromisso;
  hoje: string;
}) {
  const vencido = ehVencidoSemResposta(compromisso, hoje);
  return (
    <Card
      className={`border-dashed border-amb ${vencido ? "border-2" : ""}`}
      data-agendado={vencido ? "vencido" : "aberto"}
    >
      <MarcasAgendado compromisso={compromisso} hoje={hoje} />
      {vencido ? (
        <>
          <Consequencia cor="amb">{VENCIDO_SEM_RESPOSTA}</Consequencia>
          <TresRespostas id={compromisso.id} />
        </>
      ) : null}
    </Card>
  );
}
