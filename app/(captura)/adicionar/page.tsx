import {
  COLUNA_DO_FORMULARIO,
  PassosDaCaptura,
} from "@/app/_components/captura";
import { AppBar, BotaoLink, Corpo, Dica, Rodape } from "@/app/_components/ui";

/**
 * Tela 2 do mock: as duas portas de entrada.
 *
 * Diretriz D1 do CONTAI-018 (Mateus, 2026-08-18): as duas entradas FICAM
 * separadas, e o rótulo do pagamento perde a negativa. "Pagamento — PIX sem
 * nota" enquadrava como exceção justamente o caminho que ele mais usa (a nota
 * costuma existir; ele é que não tinha onde dizer isso), e empurrava para
 * fora quem tem nota.
 *
 * Critério 19: nenhuma frase daqui promete comportamento que não existe. A
 * frase "Pagou e o documento ainda não existe? Registra agora; a NF vincula
 * depois" saiu — ela ensinava a confiar num mecanismo inexistente, e o
 * passivo de registros soltos crescia com o consentimento do usuário.
 *
 * ⚠️ **CONTAI-047 — as três portas lado a lado na tela larga.** O texto é o
 * MESMO, byte a byte; o que muda é a grade. O critério 4 do ticket dizia "sem
 * mudança de código — herda a casca larga de graça", mas o mesmo critério exige
 * que os três cartões fiquem *"legíveis (não esticados)"* — e três botões de
 * 900px empilhados são exatamente o defeito que o Mateus rejeitou no
 * `CONTAI-039`. A grade de 3 colunas do mock (`.hub-grid`) é o que concilia os
 * dois, e é a única linha de código que esta tela ganhou.
 */
export default function Adicionar() {
  return (
    <>
      <AppBar titulo="Adicionar" sub="Passo 1 de 3" />
      <PassosDaCaptura atual={1} />
      <Corpo>
        <div className="flex flex-col gap-3 larga:grid larga:grid-cols-3 larga:items-start larga:gap-4">
          {/* Cada porta é botão + dica, e as duas andam juntas: na grade larga
              a dica tem de ficar DENTRO da coluna do botão que ela explica. */}
          <div className="flex flex-col gap-3">
            <BotaoLink href="/adicionar/documento" variante="primary">
              📄 Documento — PDF, XML ou foto
            </BotaoLink>
            <Dica>
              Nota ou boleto que chegou no WhatsApp/e-mail. O arquivo fica no
              acervo; você preenche os campos (extração automática: fase 2).
            </Dica>
          </div>

          <div className="flex flex-col gap-3">
            <BotaoLink href="/adicionar/pagamento" variante="primary">
              💸 Pagamento
            </BotaoLink>
            <Dica>
              O dinheiro que saiu da conta — PIX com comprovante. A data do
              pagamento é o que define o ano do custo (regime de caixa).
            </Dica>
          </div>

          <div className="flex flex-col gap-3">
            <BotaoLink href="/adicionar/compra-cartao" variante="primary">
              💳 Compra no cartão
            </BotaoLink>
            <Dica>
              Nasce sempre agendamento — o custo só entra quando a fatura for
              paga, uma compra de cada vez (CONTAI-022).
            </Dica>
          </div>
        </div>
      </Corpo>
      <Rodape className={COLUNA_DO_FORMULARIO}>
        <BotaoLink href="/">Cancelar</BotaoLink>
      </Rodape>
    </>
  );
}
