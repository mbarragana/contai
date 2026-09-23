import type { ReactNode } from "react";

import {
  COLUNA_DO_FORMULARIO,
  PassosDaCaptura,
} from "@/app/_components/captura";
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
  arquivoNoAcervo = true,
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
   * CONTAI-033 — achado no teste manual no browser (não no unitário nem no
   * E2E): esta tela sempre dizia "Arquivo guardado no acervo", mesmo quando
   * `/adicionar/documento` passou a aceitar gravar SEM arquivo. Sucesso
   * mentiroso é a mesma classe de defeito do critério 1 acima, com outro
   * campo. Default `true` preserva o texto de sempre para quem não passa a
   * prop — hoje só `/adicionar/documento`.
   */
  arquivoNoAcervo?: boolean;
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
      <PassosDaCaptura atual={3} />
      {/* CONTAI-047: a confirmação é texto de consequência fiscal de ponta a
          ponta — ela para na mesma coluna do formulário que a produziu, e não
          se estica pelos 940px da casca larga. */}
      <Corpo className={COLUNA_DO_FORMULARIO}>
        {aviso ? (
          <Banner cor="red" role="alert">
            {aviso}
          </Banner>
        ) : null}
        <Banner cor="grn" role="status">
          {arquivoNoAcervo ? (
            <>
              Salvo em <strong>{obraNome}</strong>. Arquivo guardado no acervo
              — nada se apaga, e o prazo de guarda só começa a correr depois
              da venda.
            </>
          ) : (
            <>
              Salvo em <strong>{obraNome}</strong>. Os dados ficam guardados,
              mas <strong>o arquivo não foi anexado</strong> — sem ele esta
              nota não sustenta custo nem abate a aferição do INSS. Anexe
              assim que puder.
            </>
          )}
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
      {/* ⚠️ CONTAI-047, critério 8 — a saída do fluxo. `/` é a Visão geral, que
          vive em `app/(gestao)/` e abre COM o shell (sidebar + topbar): quem
          chegou aqui pelo "+ Novo registro" do dashboard volta para um lugar
          reconhecível do produto, e não para uma tela sem chrome nenhum. Este
          `href` não muda sem mover a home. */}
      <Rodape className={COLUNA_DO_FORMULARIO}>
        <BotaoLink href="/" variante="primary">
          Voltar ao início
        </BotaoLink>
      </Rodape>
    </>
  );
}
