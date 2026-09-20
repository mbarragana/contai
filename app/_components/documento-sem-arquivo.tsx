"use client";

/**
 * **CONTAI-033, critério 11** — a superfície agregada da pendência **"Nota sem
 * arquivo"** na home (mock s4).
 *
 * Texto: **copiado** do parecer `2026-08-23-anexo-no-desembolso-do-terreno`
 * (⚠️ ADENDO 1 vence o corpo), §A.7.2, via as constantes de
 * `lib/fiscal/documento.ts`. Nada aqui é redigido nesta camada.
 *
 * ⚠️ **Por que o card existe, e por que ele é bloqueante no ticket.** Liberar a
 * gravação sem dar superfície à pendência é trocar *"não registra"* por
 * *"registra e esquece"* — o defeito **D47**, §A.5: *"quatro superfícies
 * gravando e nenhuma cobrando"*. Na venda dá no mesmo, com a agravante de
 * parecer resolvido.
 *
 * ⚠️ **VERMELHO**, confirmado pelo `contador` em 2026-09-19 pela régua do
 * ADENDO 2 §A.4 (*"saiu? → tem apoio hábil no ano certo? → não = vermelho"*):
 * aqui não há apoio hábil nenhum — o arquivo que falta **é** o documento hábil,
 * não uma prova de pagamento sobre nota que já existe. Mais grave que o caso
 * PJ-âmbar. E **sem "ok, entendi"**: a baixa é o arquivo chegar.
 *
 * ⚠️ Irmão de `pago-sem-comprovante.tsx` no visual e no papel, e **diferente em
 * uma coisa**: o CTA pode não existir. Decisão do `po` em 2026-09-19 (opção b,
 * sem lista nova) — com um documento o card aponta para ele; com vários fica
 * informativo, porque não existe lista de documentos no app e criar uma é
 * fricção de processo, não obrigação fiscal.
 */

import { BotaoLink, Card, Chip, Consequencia, Dica } from "@/app/_components/ui";
import {
  CHIP_NOTA_SEM_ARQUIVO,
  NOTA_SEM_ARQUIVO_ALAVANCA,
  NOTA_SEM_ARQUIVO_EFEITO,
} from "@/lib/fiscal/documento";
import { formatarBRL } from "@/lib/money";

export function CardDocumentosSemArquivo({
  totalCentavos,
  quantidade,
  href,
}: {
  totalCentavos: number;
  quantidade: number;
  /** `null` com mais de um documento: card sem CTA, decisão do `po`. */
  href: string | null;
}) {
  const uma = quantidade === 1;
  return (
    <Card className="border-red" data-pendencia="documentos-sem-arquivo">
      <Chip cor="red">{CHIP_NOTA_SEM_ARQUIVO}</Chip>
      <div className="mono mt-1.5 text-[20px] font-semibold">
        {formatarBRL(totalCentavos)}
      </div>
      <Dica>{uma ? "1 documento" : `${quantidade} documentos`}</Dica>
      <Consequencia cor="red">
        <strong>{CHIP_NOTA_SEM_ARQUIVO}.</strong>{" "}
        {uma ? (
          NOTA_SEM_ARQUIVO_EFEITO
        ) : (
          // Mesmo texto do §A.7.2 no PLURAL — só a concordância muda, porque o
          // card é agregado. A consequência fiscal é palavra por palavra a
          // mesma: não entra no custo comprovável, não abate a aferição.
          <>
            Você registrou os dados das notas, mas os arquivos não estão no
            acervo. Enquanto não estiverem, elas não entram no custo comprovável
            e não abatem a aferição do INSS.
          </>
        )}{" "}
        {NOTA_SEM_ARQUIVO_ALAVANCA}
      </Consequencia>
      {/* A linha do veto (mock s4): a mesma porta única do CONTAI-025/036 —
          `podeGerarRelatorioAnual` não libera saída anual nenhuma enquanto
          existir nota sem arquivo. Dizer isso aqui é o que transforma o card em
          cobrança, e não em aviso. */}
      <Dica>
        Enquanto {uma ? "ela" : "alguma delas"} estiver sem arquivo, nenhuma
        saída anual é gerada — nem a discriminação de Bens e Direitos, nem os
        Pagamentos Efetuados, nem a posição da aferição.
      </Dica>
      {href !== null ? (
        <div className="mt-2.5">
          <BotaoLink href={href} variante="primary">
            Ver o documento
          </BotaoLink>
        </div>
      ) : null}
    </Card>
  );
}
