/**
 * **A casca de 430px — o app como ele sempre foi.**
 *
 * Este grupo de rotas é o que o `CONTAI-040` deixou **intocado** (critério 7):
 * `/adicionar/*` (captura, Teste do Canteiro aplicável como sempre) e as telas
 * de DETALHE que o próprio ticket põe Fora de Escopo — `/obras/[id]/*`,
 * `/conta`, `/entrar`. Nenhuma delas mudou de uma linha: mudou a pasta, e é a
 * pasta que decide a casca.
 *
 * ⚠️ O nome do grupo é o do ticket, e ele hospeda hoje mais do que captura pura
 * — as telas de detalhe estão SAINDO daqui, uma família por ticket.
 * `/documento/[id]` migrou no `CONTAI-043`; `/pagamento/[id]` e `/fatura/[id]`
 * (+ subrotas) migraram no `CONTAI-044`; `/compromisso/*` (lista + detalhe +
 * cancelar/confirmar/data) e `/pendencias/[id]` migraram no `CONTAI-045` —
 * todas para `app/(gestao)/`, seguindo `design/mocks/detalhe-no-shell-v1.md`. A
 * família que falta é a do `046` (obras + terreno).
 *
 * ⚠️ Quem migrar a próxima família NÃO estica a tela por 1244px: a coluna de
 * detalhe dentro do shell tem 640px (`ColunaDeDetalhe`). Largura cheia foi
 * medida no Gate 2 do `CONTAI-039` como **menos** legível que os 430px, e texto
 * fiscal perdendo legibilidade é regressão.
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
