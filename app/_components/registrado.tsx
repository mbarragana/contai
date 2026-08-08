import type { ReactNode } from "react";

import {
  AppBar,
  Banner,
  BotaoLink,
  Card,
  Corpo,
  Linha,
  Rodape,
} from "@/app/_components/ui";

/** Tela 8 do mock — estado de sucesso das duas portas de entrada. */
export function Registrado({
  proximoPasso,
  custo,
  ano,
}: {
  proximoPasso: ReactNode;
  custo: ReactNode;
  ano: number;
}) {
  return (
    <>
      <AppBar titulo="Registrado ✓" sub="Interação 3 de 3 — pronto" />
      <Corpo>
        <Banner cor="grn" role="status">
          <strong>Salvo.</strong> Original guardado no acervo — fica disponível
          até a venda + 5 anos.
        </Banner>
        <Card>
          <Linha rotulo="Próximo passo">{proximoPasso}</Linha>
          <Linha rotulo={`Custo ${ano}`}>{custo}</Linha>
        </Card>
      </Corpo>
      <Rodape>
        <BotaoLink href="/" variante="primary">
          Voltar ao início
        </BotaoLink>
      </Rodape>
    </>
  );
}
