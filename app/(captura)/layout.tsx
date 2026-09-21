/**
 * **A casca de 430px — o app como ele sempre foi.**
 *
 * Este grupo de rotas é o que o `CONTAI-040` deixou **intocado** (critério 7):
 * `/adicionar/*` (captura, Teste do Canteiro aplicável como sempre) e as telas
 * de DETALHE que o próprio ticket põe Fora de Escopo — `/documento/[id]`,
 * `/pagamento/[id]`, `/fatura/[id]`, `/compromisso/*`, `/obras/[id]/*`,
 * `/pendencias/[id]`, `/conta`, `/entrar`. Nenhuma delas mudou de uma linha:
 * mudou a pasta, e é a pasta que decide a casca.
 *
 * ⚠️ O nome do grupo é o do ticket. Ele hospeda hoje mais do que captura pura —
 * as telas de detalhe entram no shell numa rodada futura (Fora de Escopo do
 * `CONTAI-040`), e até lá é aqui que elas ficam legíveis: esticá-las em coluna
 * única por 1244px foi medido no Gate 2 do `CONTAI-039` como **menos** legível
 * que os 430px de hoje, e texto fiscal perdendo legibilidade é regressão.
 *
 * ⚠️ Altura fixa: quem rola é o corpo da tela (`Corpo`), não a página — o
 * rodapé com a ação principal fica sempre ao alcance do polegar.
 */
export default function CapturaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden">
      {children}
    </div>
  );
}
