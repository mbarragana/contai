# detalhe-no-shell-v1 — telas de detalhe/formulário dentro do shell desktop

## Por que este documento existe

O CONTAI-040 entregou o shell (sidebar + dashboard) mas deixou as telas de
DETALHE (`/documento/[id]`, `/pagamento/[id]`, `/fatura/[id]`,
`/compromisso/*`, `/obras/[id]/*` incl. terreno, `/pendencias/[id]`) numa casca
de 430px centralizada, fora do shell — eram `app/(captura)/*`, pensadas para o
Teste do Canteiro. O Mateus quer essas telas dentro do shell agora.

O achado do Gate 2 do CONTAI-039 continua valendo: esticar formulário/detalhe
para largura total piora a legibilidade. Este documento fixa o padrão de
coluna estreita dentro do shell que o `cto-obra` recomendou sem desenhar.

## Campos
SEM CAMPOS NOVOS — este spec é só layout/composição. Nenhum dado, regra fiscal
ou texto novo é introduzido; todo texto de consequência é cópia literal de
`lib/fiscal/*` (ver rodapé "Textos").

## Cenário
Gestão, em casa, sentado — mesma doutrina do `desktop-shell-v1`. Estas telas
não são de captura: são leitura pós-registro e correção/complemento. Podem ter
mais densidade e mais passos.

## Decisão de layout

1. **Sidebar idêntica, sempre presente.** Nenhuma tela de detalhe abre em modal
   ou em página "nua" — ela vive dentro do `.main` do shell, com a mesma
   sidebar de 264px. O item de navegação primária ou secundária mais próximo
   fica `active`: `/documento`, `/pagamento`, `/fatura` → **Despesas**;
   `/pendencias/[id]` → **Pendências**; `/obras/[id]/*` (incl. terreno) →
   **Obras** (ou o link secundário "Terreno", quando a rota é
   especificamente de terreno); `/compromisso/*` → **Visão geral** (é onde a
   Agenda vive hoje — perguntar ao `po` se isso merece item próprio no futuro).
2. **Coluna de conteúdo: 640px, não full-width.** Um pouco mais larga que o
   ~560px que o `cto-obra` cogitou, porque o grupo de opções (`Escolha`, ex.
   os 5 tipos de desembolso de terreno) quebra menos linhas nessa largura —
   ainda uma coluna de leitura, nunca um grid de duas colunas. Fica
   **alinhada à esquerda**, sob o topbar; o espaço à direita fica
   deliberadamente vazio (papel) — não é "sobrando para preencher depois", é
   o que sinaliza "documento/formulário", não dashboard. `.detalhe{max-width:640px}`.
3. **Breadcrumb substitui o botão fixo "Voltar".** Hoje `BarraAdicionar`/
   `Rodape` fixam "Voltar ao início" no rodapé da casca de 430px. Dentro do
   shell isso **muda de lugar, não se duplica**: uma linha pequena
   (`.crumb`, 12px, cor mut, "‹ Despesas" / "‹ Terreno") aparece no topbar,
   acima do H1, e sempre aponta para a **rota canônica da lista-mãe**
   (`/despesas`, `/pendencias`, `/obras/[id]/terreno`) — nunca para
   "histórico do navegador", que quebra em link direto/refresh. O
   "+ Adicionar" do rodapé mobile já foi substituído pelo "+ Novo registro"
   do topbar no CONTAI-040; aqui não reaparece.
4. **Rodapé de ação principal: sticky, escopado à largura da coluna — só
   quando existe UMA ação de página.** Regra:
   - Página de **leitura** com várias ações pequenas espalhadas em cards
     (`/documento/[id]`: "Corrigir valor", "Ligar a um pagamento", "Anexar
     arquivo"...) → **sem rodapé fixo**. Cada ação fica inline, no fim do
     card a que pertence — é o que a doutrina "consequência nunca atrás de
     clique" já pede: a ação certa ao lado do fato certo.
   - Página de **formulário com uma ação central** (`/terreno/desembolsos`,
     seção "Registrar um desembolso") → rodapé `position: sticky; bottom: 0`
     **dentro da coluna de 640px** (não da largura da janela, não por baixo da
     sidebar), com o rótulo dinâmico existente
     (`estadoDoGravar` — ex. "Gravar — e abrir a pendência do comprovante").
     Sticky porque o formulário cresce com pendências acima dele e o botão
     precisa continuar alcançável sem rolar até o fim.
   - Dentro da MESMA tela de terreno, as ações de **completar um desembolso
     já existente** (data ou papel que faltava) são ações de CARD, não de
     página — ficam inline naquele card, exatamente como hoje. O rodapé
     sticky pertence só à ação "Registrar um desembolso"; não confundir as
     duas camadas de ação foi o erro que uma generalização ingênua do padrão
     mobile cometeria aqui.
5. **Pendência nunca atrás de clique — mantido.** Toda `Consequencia`,
   `Chip` e `Card` de pendência renderiza aberta, na largura da coluna,
   igual ao app mobile — só a moldura (sidebar, topbar, coluna) muda.

## O que NÃO muda
- Nenhum componente de campo (`CampoTexto`, `Escolha`, `EscolhaDeAnexos`,
  `ListaDeAnexos`) muda por dentro — só o contêiner ao redor.
- Nenhum texto fiscal foi reescrito; todos vêm de `lib/fiscal/retencao.ts`,
  `lib/fiscal/terreno.ts`, `lib/fiscal/documento.ts` (citações literais, ver
  o mock HTML linha a linha).
- Disciplina de captura (anexo obrigatório no ato, sem default em campo
  fiscal) não muda — estas são telas de gestão, não de captura.

## Perguntas em aberto (para `po`/`cto-obra`)
1. Item de sidebar para `/compromisso/*` — usar "Visão geral" ou criar
   "Agenda" próprio?
2. Rota canônica do breadcrumb de `/pendencias/[id]` e `/fatura/[id]` — assumo
   `/pendencias` e `/despesas`; confirmar no ticket de migração de cada rota.
3. Breakpoint abaixo de ~1200px de janela — fora de escopo, mesma posição do
   `desktop-shell-v1.md`.

## Arquivos
- `design/mocks/detalhe-no-shell-v1.html` — protótipo navegável: sidebar →
  "Despesas" abre a tela de leitura (`/documento/[id]`, NF de serviço com
  retenção sem recolhedor); "Terreno" (nav secundária) abre a tela de
  formulário denso (`/terreno/desembolsos`), com pendência de data+comprovante,
  pendência de comprovante isolada e o formulário de registro com rodapé
  sticky. Os demais itens de sidebar mostram um placeholder (já cobertos por
  `desktop-shell-v1.html`).
- `design/mocks/detalhe-no-shell-v1.md` — este documento.
