import type { ReactNode } from "react";

import {
  AppBar,
  Banner,
  BotaoLink,
  Card,
  Corpo,
  Dica,
  Linha,
  Rodape,
} from "@/app/_components/ui";

/**
 * Estado de sucesso das duas portas de entrada (mock CONTAI-003, tela 15).
 *
 * A confirmação NOMEIA a obra de propósito (critério 7): é a última chance de
 * perceber o erro enquanto ele ainda está fresco — e o erro de obra é
 * silencioso e descoberto tarde, quando já virou impedimento de venda.
 */
export function Registrado({
  proximoPasso,
  custo,
  ano,
  obraNome,
  hrefCorrigirObra,
  aviso,
  extra,
}: {
  proximoPasso: ReactNode;
  custo: ReactNode;
  ano: number;
  obraNome: string;
  /** Correção da obra deste registro (critério 13). */
  hrefCorrigirObra: string;
  /**
   * Critério 1 do CONTAI-018: quando o registro entra mas o VÍNCULO falha, a
   * tela diz isso e mostra como completar. Nunca um sucesso mentiroso — o
   * registro solto é justamente o passivo que este ticket veio reduzir.
   */
  aviso?: ReactNode;
  /**
   * Bloco que entra DEPOIS da confirmação — hoje, a sugestão de quitação do
   * CONTAI-019 (critério 37). Fica aqui, e não antes do "Salvar", porque a
   * pergunta **nunca bloqueia a gravação**: o fato consumado já está no banco
   * quando ela aparece.
   */
  extra?: ReactNode;
}) {
  return (
    <>
      <AppBar titulo="Registrado ✓" sub={obraNome} />
      <Corpo>
        {aviso ? (
          <Banner cor="red" role="alert">
            {aviso}
          </Banner>
        ) : null}
        <Banner cor="grn" role="status">
          Salvo em <strong>{obraNome}</strong>. Arquivo guardado no acervo —
          nada se apaga, e o prazo de guarda só começa a correr depois da venda.
        </Banner>
        <Card>
          <Linha rotulo="Obra">{obraNome}</Linha>
          <Linha rotulo="Próximo passo">{proximoPasso}</Linha>
          <Linha rotulo={`Custo ${ano}`}>{custo}</Linha>
        </Card>
        {extra}
        <Card>
          <Dica>Salvou na obra errada?</Dica>
          <div className="mt-2">
            <BotaoLink href={hrefCorrigirObra}>
              Corrigir a obra deste registro
            </BotaoLink>
          </div>
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
