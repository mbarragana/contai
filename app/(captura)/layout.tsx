/**
 * **A casca de 430px — o app como ele sempre foi.**
 *
 * Este grupo de rotas é o que o `CONTAI-040` deixou **intocado** (critério 7):
 * `/adicionar/*` (captura, Teste do Canteiro aplicável como sempre), mais
 * `/obras/nova`, `/conta` e `/entrar`. Nenhuma delas mudou de uma linha: mudou
 * a pasta das OUTRAS, e é a pasta que decide a casca.
 *
 * ⚠️ **A migração das telas de detalhe TERMINOU no `CONTAI-046`**, uma família
 * por ticket: `/documento/[id]` no `043`; `/pagamento/[id]` e `/fatura/[id]` (+
 * subrotas) no `044`; `/compromisso/*` e `/pendencias/[id]` no `045`;
 * `/obras/[id]` (+ terreno, discriminação e notas sem CNO) no `046` — todas
 * para `app/(gestao)/`, seguindo `design/mocks/detalhe-no-shell-v1.md`.
 *
 * ⚠️ **O que fica aqui, fica por decisão, não por atraso:**
 * - `/adicionar/*` — captura pura, o caminho curto do canteiro;
 * - `/obras/nova` — assistente usado **uma vez por obra** (Fora de Escopo do
 *   `046`): captura pontual, não gestão recorrente. Estar sob o mesmo prefixo
 *   `/obras/` das rotas que migraram é coincidência de endereço, e o
 *   Pre-mortem 3 daquele ticket existe para que ninguém a leia como esquecimento;
 * - `/entrar` — é pré-autenticação: não existe obra ativa nem sidebar para uma
 *   tela de login habitar. Estruturalmente fora, não é dívida;
 * - `/conta` — configuração de baixa frequência, sem seam em produção
 *   (nenhum link do shell leva a ela). Candidata a ticket próprio.
 *
 * ⚠️ Quem trouxer uma tela nova para cá NÃO a estica por 1244px se ela for de
 * gestão: a coluna de detalhe dentro do shell tem 640px (`ColunaDeDetalhe`).
 * Largura cheia foi medida no Gate 2 do `CONTAI-039` como **menos** legível que
 * os 430px, e texto fiscal perdendo legibilidade é regressão.
 *
 * ⚠️ Altura fixa: quem rola é o corpo da tela (`Corpo`), não a página — o
 * rodapé com a ação principal fica sempre ao alcance do polegar.
 *
 * ══ CONTAI-047 — a casca ganha um SEGUNDO teto, e só isso ═════════════════
 *
 * `larga:max-w-[940px]` (breakpoint `larga` = 880px, `app/globals.css`) é a
 * resposta ao Mateus em 2026-09-22: *"as telas de captura também devem ganhar
 * tratamento desktop"*. **Não é full-width** — o Gate 2 do `CONTAI-039` mediu
 * que largura cheia lê PIOR que coluna limitada, e é a mesma razão pela qual
 * `ColunaDeDetalhe` parou em 640px.
 *
 * ⚠️ O teto é da CASCA, não do conteúdo. Cada tela ainda diz onde a própria
 * coluna para: `documento/page.tsx` monta a grade `formulário + rail`
 * (`GradeDaCaptura`), as outras limitam o corpo e o rodapé em
 * `COLUNA_DO_FORMULARIO` (556px). Sem isso um campo de texto nasceria com
 * 900px de largura, que é o defeito que este ticket veio matar, não criar.
 *
 * ⚠️ `/entrar` se AUTOLIMITA a 430px (critério 6), com um wrapper próprio na
 * página: tela de login esticada por efeito colateral do breakpoint do grupo é
 * regressão visual, não ganho. Não mexa aqui para "consertar" o login.
 *
 * ⚠️ E continua **sem sidebar em qualquer largura** (critério 9): captura é
 * terminar um registro com atenção, não navegar entre seções. O chrome de
 * gestão não entra aqui — foi decisão do `cto-obra`, ver "Fora de Escopo" do
 * ticket.
 */
export default function CapturaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden larga:max-w-[940px]">
      {children}
    </div>
  );
}
