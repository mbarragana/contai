"use client";

/**
 * **CONTAI-025, critérios 11 e 12** — a superfície agregada do desembolso do
 * terreno **pago sem comprovante**, e a linha do §4.3 que a acompanha.
 *
 * Texto: **copiado** do parecer `2026-08-23-anexo-no-desembolso-do-terreno`
 * (⚠️ ADENDO 1 vence o corpo), via as constantes de `lib/fiscal/terreno.ts`.
 * Nada aqui é redigido nesta camada.
 *
 * ⚠️ **Um componente, duas telas — e a unificação é o ponto.** A home
 * (`app/page.tsx`) e o painel do terreno (`app/obras/[id]/terreno/page.tsx`)
 * mostram o MESMO card. Duas cópias do mesmo markup divergem sempre, e a
 * primeira coisa que diverge é o texto: é assim que nasce a **D46 visual** —
 * o mesmo fato fiscal com dois rostos, e o Mateus decidindo qual acreditar.
 *
 * ⚠️ **VERMELHO** (D39): *vermelho = fato consumado com consequência fiscal
 * aberta*. O dinheiro saiu. E **sem "ok, entendi"**: não se dispensa, não se
 * adia, não se esconde — a baixa é o comprovante chegar.
 */

import { BotaoLink, Card, Chip, Consequencia, Dica } from "@/app/_components/ui";
import {
  CHIP_PAGO_SEM_COMPROVANTE,
  COMPROVANTE_POR_TIPO,
  O_QUE_SERVE_COMO_COMPROVANTE,
  PAGO_SEM_COMPROVANTE,
} from "@/lib/fiscal/terreno";
import { formatarBRL } from "@/lib/money";

/**
 * A linha auxiliar do §4.3 — **o que serve como comprovante, por tipo**.
 *
 * ⚠️ Ela aparece em **DOIS lugares** (critério 12), e o segundo é o que a
 * torna remédio e não decoração: junto da pendência **e no momento de escolher
 * o papel**. `ROTULO_DO_PAPEL.nota = "Nota ou recibo"` captura o **recibo do
 * vendedor**, que pelo §4.3 é comprovante de entrada — papel mal escolhido
 * joga desembolso legítimo para fora do custo confirmado **em silêncio**, e é
 * na escolha que o erro nasce.
 */
export function OQueServeComoComprovante({ titulo }: { titulo: string }) {
  return (
    <div
      className="mt-2.5 rounded-lg border border-line px-2.5 py-2 text-[12px]"
      data-o-que-serve
    >
      <strong>{titulo}</strong>
      {COMPROVANTE_POR_TIPO.map((c) => (
        <p key={c.titulo} className="mt-1">
          <strong>{c.titulo}</strong> — {c.texto}
        </p>
      ))}
    </div>
  );
}

/**
 * O card agregado da obra — **valor total + contagem + link para a lista**.
 *
 * ⚠️ É da **OBRA, não do ano**: inclui os `pago` **sem data**, que não caem em
 * ano-calendário nenhum. Por isso este total pode ser maior que o segundo
 * número do card do ano, e a diferença é dita em tela pelo chamador — número
 * que não bate sem explicação é pior que número ausente (decisão 2 do mock).
 *
 * ⚠️ E inclui o caso **zero-anexo** (decisão 3 do mock): se ele ficasse de
 * fora, os dois números deixariam de fechar com o que o portão exclui, e o
 * buraco não teria nome em tela nenhuma. A distinção entre *"tem papel, nenhum
 * comprovante"* e *"pago, e sem papel nenhum"* vive **na linha**, com chip
 * próprio — são conjuntos diferentes, mesmo fato fiscal.
 */
export function CardPagoSemComprovante({
  totalCentavos,
  quantidade,
  href,
}: {
  totalCentavos: number;
  quantidade: number;
  href: string;
}) {
  return (
    <Card className="border-red" data-pendencia="terreno-sem-comprovante">
      <Chip cor="red">{CHIP_PAGO_SEM_COMPROVANTE}</Chip>
      <div className="mono mt-1.5 text-[20px] font-semibold">
        {formatarBRL(totalCentavos)}
      </div>
      <Dica>
        {quantidade === 1
          ? "1 desembolso do terreno"
          : `${quantidade} desembolsos do terreno`}
      </Dica>
      <Consequencia cor="red">
        <strong>{CHIP_PAGO_SEM_COMPROVANTE}.</strong> {PAGO_SEM_COMPROVANTE}
      </Consequencia>
      <OQueServeComoComprovante titulo={O_QUE_SERVE_COMO_COMPROVANTE} />
      <div className="mt-2.5">
        <BotaoLink href={href} variante="primary">
          Ver os desembolsos
        </BotaoLink>
      </div>
    </Card>
  );
}
