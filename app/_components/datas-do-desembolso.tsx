"use client";

/**
 * As duas metades do **critério 12** do CONTAI-027: a pergunta binária e a
 * pendência que ela pode abrir.
 *
 * Texto: **copiado** do parecer `2026-08-21-gate-fiscal-contai-027-criterio-13`
 * (§4a e §4b), via as constantes de `lib/fiscal/terreno.ts`. Nada aqui é
 * redigido nesta camada — nem "encurtado para caber".
 *
 * ⚠️ **O critério 13 está CORTADO** (§3 do parecer): esta pendência **não
 * bloqueia saída nenhuma** e **não tem "ok, entendi"** — não se dispensa, não
 * se adia, não se esconde. Ela também **não tem baixa no app** (§5), e nenhum
 * botão daqui oferece uma: *"pendência fiscal baixada por declaração de
 * intenção é o campo preenchido que afirma o que ninguém conferiu, com um
 * botão na frente"*.
 */

import { Chip, Consequencia, Dica } from "@/app/_components/ui";
import { Escolha } from "@/app/_components/campos";
import { formatarDataBR } from "@/lib/fiscal/obra";
import {
  acaoDaPendenciaDeDatas,
  CONSEQUENCIA_DA_DATA_COLAPSADA,
  corpoDaPendenciaDeDatas,
  NAO_E_RETRABALHO,
  opcaoTudoEm,
  OPCAO_MAIS_DE_UM_DIA,
  PENDENCIA_MAIS_DE_UMA_DATA,
  PERGUNTA_QUANDO_SAIU,
  SAIDA_QUANDO_A_CORRECAO_EXISTIR,
} from "@/lib/fiscal/terreno";

/**
 * A resposta em tela. `null` = ainda não respondeu — **e não existe default**
 * (critério 12): as duas opções têm o mesmo peso visual e nenhuma nasce
 * marcada.
 */
export type RespostaDeDatas = "mesmo_dia" | "varios_dias";

/**
 * A pergunta do §4a, com a data do lançamento no próprio botão.
 *
 * ⚠️ **A consequência não lidera pela punição, e isso é decisão do
 * `contador`, não estilo**: *"frase que começa pelo castigo ensina a responder
 * o que escapa dele — e, com o bloqueio fora, a qualidade dessa resposta é a
 * única defesa que sobrou."* Reordenar os blocos aqui desfaz a decisão.
 */
export function PerguntaQuandoSaiu({
  dataPagamento,
  valor,
  onChange,
  erro,
}: {
  /** ISO. Sem ela a pergunta é impronunciável e nem aparece (§6, represada). */
  dataPagamento: string;
  valor: RespostaDeDatas | null;
  onChange: (v: RespostaDeDatas) => void;
  erro?: string;
}) {
  return (
    <div
      data-pergunta="quando-saiu"
      className="rounded-lg border border-red border-l-[3px] bg-white px-3 py-2.5"
    >
      {/* O título é a LEGENDA do grupo de rádio, não um parágrafo acima dele:
          é o que dá nome acessível às duas opções — e uma pergunta fiscal cujo
          enunciado não pertence ao grupo é uma pergunta que o leitor de tela
          entrega sem o enunciado. */}
      <Escolha
        destaque
        rotulo={PERGUNTA_QUANDO_SAIU}
        opcoes={[
          {
            valor: "mesmo_dia" as const,
            texto: opcaoTudoEm(formatarDataBR(dataPagamento)),
          },
          { valor: "varios_dias" as const, texto: OPCAO_MAIS_DE_UM_DIA },
        ]}
        valor={valor}
        onChange={onChange}
        erro={erro}
      />
      <Consequencia cor="amb">{CONSEQUENCIA_DA_DATA_COLAPSADA}</Consequencia>
      <div className="mt-1.5">
        <Dica>{NAO_E_RETRABALHO}</Dica>
      </div>
    </div>
  );
}

/**
 * A pendência do §4b — **em VERMELHO** (D39 do `po`: *"vermelho = fato
 * consumado com consequência fiscal aberta; âmbar = nada saiu ainda"*).
 *
 * ⚠️ **A segunda metade da ação nomeada não é opcional**: sem ela, cumprir a
 * primeira — registrar os lançamentos separados sem corrigir o original —
 * **soma o valor duas vezes** no custo do terreno, que é redução indevida de
 * ganho de capital, cobrada com multa. *"Pendência que nomeia meia ação induz
 * o erro pior que a original."*
 */
export function PendenciaDeDatas({
  valorCentavos,
  titulo,
  children,
}: {
  valorCentavos: number;
  /** O lançamento, para quem vê a pendência fora do card dele (a home). */
  titulo?: string;
  /** Ação de navegação, quando a superfície não é a do próprio desembolso. */
  children?: React.ReactNode;
}) {
  return (
    <div data-pendencia="terreno-mais-de-uma-data">
      <Chip cor="red">{PENDENCIA_MAIS_DE_UMA_DATA}</Chip>
      {titulo ? <div className="mt-1.5 font-semibold">{titulo}</div> : null}
      <div className="mt-1.5">
        <Dica>{corpoDaPendenciaDeDatas(valorCentavos)}</Dica>
      </div>
      <Consequencia cor="red">{acaoDaPendenciaDeDatas(valorCentavos)}</Consequencia>
      <div className="mt-1.5">
        <Dica>{SAIDA_QUANDO_A_CORRECAO_EXISTIR}</Dica>
      </div>
      {children ? <div className="mt-2.5">{children}</div> : null}
    </div>
  );
}
