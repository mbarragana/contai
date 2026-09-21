"use client";

/**
 * **CONTAI-005** — os dois cards do topo da home: o headline **"Custo em risco
 * no IR"** e, logo abaixo e separada dele, a **aferição do INSS em base**.
 *
 * Mock v5 aprovado pelo Mateus em 2026-08-24 (`design/mocks/CONTAI-005.html`).
 * Textos: **copiados** do §4 do parecer
 * `docs/pareceres/2026-08-16-gate-fiscal-contai-004-005.md`, Blocos 1 e 2, via
 * as constantes de `lib/fiscal/risco.ts`. Nada é redigido nesta camada — *"os
 * textos de tela completos estão no parecer; não se reescrevem"*.
 *
 * ⚠️ **Os dois cards vivem no mesmo arquivo de propósito.** O card do INSS só
 * tem sentido ao lado do headline: o chip dele ("não soma com a de cima") e a
 * frase de fechamento existem exatamente para impedir que o leitor some os dois
 * números de cabeça. Separá-los em dois arquivos convidaria alguém a usar um
 * sem o outro.
 *
 * ⚠️ **R4 vira estrutura aqui.** *"O total nunca aparece sem a decomposição
 * visível"* — por isso o componente recebe o objeto `CustoEmRiscoIr` inteiro e
 * desenha total, parcelas e linha de imposto num bloco só. Não existe prop que
 * mostre só o número.
 */

import { Card, Chip, Consequencia, Dica } from "@/app/_components/ui";
import {
  CUSTO_EM_RISCO_EXPLICACAO,
  CUSTO_EM_RISCO_TITULO,
  CUSTO_EM_RISCO_ZERO,
  INSS_CONTINUAM_VALENDO_NO_IRPF,
  INSS_EM_NOTAS,
  INSS_NAO_E_IMPOSTO,
  INSS_OUTRA_APURACAO,
  textoImpostoAte,
  tituloAfericaoInss,
  type CustoEmRiscoIr,
} from "@/lib/fiscal/risco";
import { formatarBRL } from "@/lib/money";

export function CardCustoEmRisco({
  risco,
  nomeDaObra,
}: {
  risco: CustoEmRiscoIr;
  /** Critério 9 do CONTAI-003: todo número carrega o nome da obra. */
  nomeDaObra: string;
}) {
  const zerado = risco.totalCentavos === 0;
  return (
    <Card
      className={zerado ? "border-grn" : "border-red"}
      data-custo-em-risco={risco.totalCentavos}
    >
      <Dica>
        {CUSTO_EM_RISCO_TITULO} · {nomeDaObra}
      </Dica>
      <div
        className={`mono text-[26px] font-bold tracking-tight ${
          zerado ? "text-grn" : "text-red"
        }`}
      >
        {formatarBRL(risco.totalCentavos)}
      </div>
      {zerado ? (
        // ⚠️ O card NÃO some no zero, ao contrário do de INSS e do de "notas
        // sem pagamento" (decisão 3 do mock v5): zero risco de IR **não** é o
        // mesmo fato que zero pendência — pode haver boleto e "sem retenção"
        // abertos e nenhum risco de IR. Sumir esconderia a confirmação.
        //
        // E não há decomposição nem linha de imposto aqui: não há o que
        // decompor, e 15% de zero não informa nada.
        <Dica>{CUSTO_EM_RISCO_ZERO}</Dica>
      ) : (
        <>
          <Dica>{CUSTO_EM_RISCO_EXPLICACAO}</Dica>
          {/* R4, bloqueante: a composição anda colada ao total, e as TRÊS
              parcelas aparecem mesmo quando uma delas é zero — a frase do
              Bloco 1 é uma só, e mostrar meia composição deixaria o leitor
              sem saber de onde veio o número.

              ⚠️ A terceira parcela entrou no Gate 2 (REQUEST CHANGES do
              `contador`): o art. 17 da IN SRF 84/2001 é condição COMPOSTA —
              dispêndio comprovado E documentação hábil —, e "pago sem
              comprovante" falha a perna da comprovação do desembolso. Mesma
              moeda das outras duas. */}
          <Dica>
            Composto de:{" "}
            <span className="mono font-semibold">
              {formatarBRL(risco.pagosSemNotaCentavos)}
            </span>{" "}
            pagos sem nota ·{" "}
            <span className="mono font-semibold">
              {formatarBRL(risco.notaForaDoCpfCentavos)}
            </span>{" "}
            em nota fora do seu CPF ·{" "}
            <span className="mono font-semibold">
              {formatarBRL(risco.pagosSemComprovanteCentavos)}
            </span>{" "}
            pagos sem comprovante.
          </Dica>
          {/* R3: só com "até", com a fórmula visível e o disclaimer de
              redução/isenção — e aplicada EXCLUSIVAMENTE sobre a base de IRPF.
              Âmbar, não vermelho: é teto hipotético de imposto futuro, não
              fato consumado. */}
          <Consequencia cor="amb">
            {textoImpostoAte(risco.totalCentavos)}
          </Consequencia>
        </>
      )}
    </Card>
  );
}

/**
 * Bloco 2 do parecer — **em base, nunca em reais de imposto** (R2).
 *
 * ⚠️ **Só aparece com CNO.** O parecer é explícito: *"obra sem CNO: esta linha
 * cede lugar ao texto do parecer de 2026-08-09, item 4"* — que já está em tela
 * como `PendenciaCno`. Sem CNO o título não teria número para citar, a ação
 * seria inexequível (não se pede abatimento numa aferição que não existe) e o
 * card competiria com a pendência que de fato destrava tudo: registrar o CNO no
 * e-CAC.
 */
export function CardAfericaoInss({
  cno,
  baseCentavos,
}: {
  cno: string;
  baseCentavos: number;
}) {
  return (
    <Card className="border-amb" data-afericao-inss={baseCentavos}>
      <Chip cor="amb">{INSS_OUTRA_APURACAO}</Chip>
      <div className="mt-1.5 font-semibold">{tituloAfericaoInss(cno)}</div>
      <div className="mono text-[20px] font-bold">
        {formatarBRL(baseCentavos)}
      </div>
      <Dica>{INSS_EM_NOTAS}</Dica>
      <Consequencia cor="amb">{INSS_NAO_E_IMPOSTO}</Consequencia>
      {/* ⚠️ NÃO É OPCIONAL (R2). É esta frase que impede o leitor de somar esta
          base ao headline com a própria cabeça — e a nota que está no CPF dele
          e foi paga é custo CONFIRMADO, não custo em risco. */}
      <Consequencia cor="grn">
        <strong>{INSS_CONTINUAM_VALENDO_NO_IRPF}</strong>
      </Consequencia>
    </Card>
  );
}
