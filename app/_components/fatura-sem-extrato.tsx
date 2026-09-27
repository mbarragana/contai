"use client";

/**
 * **CONTAI-067, critério 14** — a superfície agregada da pendência **"Fatura sem
 * extrato"** na fila unificada e no painel da home.
 *
 * Texto: **copiado** do parecer
 * `docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md` (ADENDO e
 * ADENDO 2), via as constantes de `lib/fiscal/fatura.ts`. Nada aqui é redigido
 * nesta camada.
 *
 * ⚠️ **Por que o card existe.** O bloco de anexo tardio mora em `/fatura/[id]`, e
 * o app **não tem lista de faturas**: sem este card, a pendência ficaria invisível
 * da home — ninguém navega para uma fatura que não sabe que existe. É o mesmo
 * argumento que já tornou o card do `CONTAI-033` bloqueante (**D47**: *"quatro
 * superfícies gravando e nenhuma cobrando"*).
 *
 * ⚠️ **VERMELHO**, adjudicado pelo `contador` no ADENDO 2 pela régua do A.4
 * (*"saiu? → tem apoio hábil no ano certo? → não = vermelho"*): o dinheiro já
 * saiu, mas falta o apoio hábil que fixa o **ano-calendário** das compras — e
 * ambiguidade sobre qual ano vale é tratada com a gravidade mais alta, mesmo com
 * o valor do custo já provado item a item pelas NFs.
 *
 * ⚠️ **Irmão de `documento-sem-arquivo.tsx` no visual, e DIFERENTE numa coisa que
 * é fiscal, não estética**: lá a última `Dica` diz que **nenhuma** saída anual é
 * gerada; aqui ela diz o **oposto** — Pagamentos Efetuados e a aferição do INSS
 * **não** são afetados (compra no cartão não é mão de obra), e o que fica em risco
 * é só a discriminação do ano-calendário em Bens e Direitos (Gate Fiscal item 4 do
 * ticket, critério 16). Sem essa frase, a semelhança com o card vermelho vizinho
 * convidaria a inferir um veto que o Gate Fiscal explicitamente descartou.
 *
 * ⚠️ O CTA pode não existir, pelo mesmo corte de `CardDocumentosSemArquivo`: com
 * uma fatura o card aponta para ela; com várias fica informativo, porque não
 * existe lista de faturas no app e criar uma é fricção de processo, não obrigação
 * fiscal.
 */

import { BotaoLink, Card, Chip, Consequencia, Dica } from "@/app/_components/ui";
import {
  CHIP_FATURA_SEM_EXTRATO,
  COR_FATURA_SEM_EXTRATO,
  FATURA_SEM_EXTRATO_ALAVANCA,
  FATURA_SEM_EXTRATO_EFEITO,
  FATURA_SEM_EXTRATO_EFEITO_PLURAL,
  FATURA_SEM_EXTRATO_NAO_VETA,
} from "@/lib/fiscal/fatura";
import { bordaDaCor } from "@/lib/fiscal/gravidade";
import { formatarBRL } from "@/lib/money";

export function CardFaturaSemExtrato({
  totalCentavos,
  quantidade,
  href,
}: {
  /** Σ do que já foi pago às faturas sem extrato — dinheiro saído sem apoio. */
  totalCentavos: number;
  quantidade: number;
  /** `null` com mais de uma fatura: card sem CTA, mesmo corte do `CONTAI-033`. */
  href: string | null;
}) {
  const uma = quantidade === 1;
  return (
    <Card
      className={bordaDaCor(COR_FATURA_SEM_EXTRATO)}
      data-pendencia="fatura-sem-extrato"
    >
      <Chip cor={COR_FATURA_SEM_EXTRATO}>{CHIP_FATURA_SEM_EXTRATO}</Chip>
      <div className="mono mt-1.5 text-[20px] font-semibold">
        {formatarBRL(totalCentavos)}
      </div>
      <Dica>{uma ? "1 fatura" : `${quantidade} faturas`}</Dica>
      <Consequencia cor={COR_FATURA_SEM_EXTRATO}>
        <strong>{CHIP_FATURA_SEM_EXTRATO}.</strong>{" "}
        {uma ? FATURA_SEM_EXTRATO_EFEITO : FATURA_SEM_EXTRATO_EFEITO_PLURAL}{" "}
        {FATURA_SEM_EXTRATO_ALAVANCA}
      </Consequencia>
      {/* A linha do NÃO-veto — a diferença estrutural em relação ao card irmão.
          Ver o ⚠️ do cabeçalho: ela é exigência do Gate Fiscal, não ornamento. */}
      <Dica>{FATURA_SEM_EXTRATO_NAO_VETA}</Dica>
      {href !== null ? (
        <div className="mt-2.5">
          <BotaoLink href={href} variante="primary">
            Ver a fatura
          </BotaoLink>
        </div>
      ) : null}
    </Card>
  );
}
