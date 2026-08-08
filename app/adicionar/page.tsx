import { AppBar, BotaoLink, Corpo, Dica, Rodape } from "@/app/_components/ui";

/** Tela 2 do mock: as duas portas de entrada. */
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
          💸 Pagamento — PIX sem nota
        </BotaoLink>
        <Dica>
          Pagou e o documento ainda não existe? Registra agora; a NF vincula
          depois.
        </Dica>
      </Corpo>
      <Rodape>
        <BotaoLink href="/">Cancelar</BotaoLink>
      </Rodape>
    </>
  );
}
