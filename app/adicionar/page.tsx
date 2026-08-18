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
 */
export default function Adicionar() {
  return (
    <>
      <AppBar titulo="Adicionar" sub="Interação 1 de 3" />
      <Corpo>
        <BotaoLink href="/adicionar/documento" variante="primary">
          📄 Documento — PDF, XML ou foto
        </BotaoLink>
        <Dica>
          Nota ou boleto que chegou no WhatsApp/e-mail. O arquivo fica no
          acervo; você preenche os campos (extração automática: fase 2).
        </Dica>

        <BotaoLink href="/adicionar/pagamento" variante="primary">
          💸 Pagamento
        </BotaoLink>
        <Dica>
          O dinheiro que saiu da conta — PIX com comprovante. A data do
          pagamento é o que define o ano do custo (regime de caixa).
        </Dica>
      </Corpo>
      <Rodape>
        <BotaoLink href="/">Cancelar</BotaoLink>
      </Rodape>
    </>
  );
}
