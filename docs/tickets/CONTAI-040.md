# CONTAI-040 Shell de navegação desktop + Dashboard ("Visão geral")

## Tipo e Prioridade
feature — **P1, fricção de processo**. Não cria obrigação fiscal nova; é a
substituição do padrão `aside`+`Secao` do `CONTAI-039` (rejeitado pelo
Mateus) por uma experiência de desktop de verdade, no cenário principal do
produto (gestão, em casa, sentado). **Segundo dos três tickets da rodada
"desktop shell"** — vem depois do `CONTAI-042` (unificação de pendências),
por decisão de sequenciamento do `cto-obra`: o dashboard deste ticket
consome a lista/contagem unificada já pronta, em vez de nascer mostrando só
7 das 18 famílias de pendência que existem hoje. Bloqueia o `CONTAI-041`.

## Dor de Origem
`CONTAI-039` entregou o Conceito 2 (régua fixa `sticky` + grid 2 colunas) e
foi rejeitado em produção: *"ficou horrível a tela, ficou várias telas de
celular lado a lado, eu quero uma experiência de desktop."* Diagnóstico
completo em `design/mocks/desktop-shell-v1.md` (por que este documento
existe): a largura de cada card do `039` foi ajustada para ficar igual ao
card mobile — decisão de design pedindo, ela mesma, para o resultado ser
mobile espremido.

Doutrina nova, literal do Mateus, que muda a régua para esta superfície:
*"o uso atualmente é 100% desktop"* / *"se tiver que quebrar a
compatibilidade com o mobile pode quebrar"* — registrada em
`docs/backlog/45-2026-09-21-cenario-desktop-first-contai-039.md` e no
`CLAUDE.md`. **"Pode quebrar" não é "não há como registrar do celular"** —
ver critério 6 e a Viabilidade abaixo, achado do `cto-obra` no Gate 0.

## User Story
Como dono da obra revisando a posição fiscal em casa, sentado, num monitor
largo, quero uma casca de navegação permanente (sidebar) e um painel de
visão geral com os três números-chave, a fila de pendências mais graves e as
despesas recentes visíveis sem rolar, para não precisar tratar o desktop
como um celular esticado — sem perder, no celular, a porta para registrar o
que acabou de acontecer no canteiro.

## Escopo e Critérios de Aceite

Fonte de verdade do desenho: `design/mocks/desktop-shell-v1.md` (seções
"Shell de navegação" e "Dashboard") e o protótipo navegável
`design/mocks/desktop-shell-v1.html`. Arquitetura de separação
mobile×desktop fechada pelo `cto-obra` no Gate 0 (não é mais pergunta
aberta — ver `docs/backlog/46-2026-09-21-cinco-decisoes-desktop-shell-
contai-040-042.md`).

**Ativação — route groups do Next 16, não breakpoint/media query.**
`app/(gestao)/` passa a hospedar a experiência nova (home/`Visão geral`,
futura `/despesas` do `CONTAI-041`, `/pendencias`, `/obras`) sob um único
`layout.tsx` com o shell; `app/(captura)/` (ou equivalente — o `adicionar`
atual e o que mais for puramente captura) permanece **intocado**, fora do
shell, sem sidebar/topbar nenhuma, exatamente como hoje. A escolha
**explicitamente rejeita** duplicar a árvore de componentes por
`lg:`/media query dentro de uma página só (foi o que o `CONTAI-039` tentou
e o Mateus rejeitou) — a separação é estrutural, por rota, não visual
condicional dentro do mesmo componente.

1. **Sidebar** (~264px, fundo escuro, distinto do papel claro do app) em
   telas largas, com, de cima para baixo: marca ("contai"); bloco "Obra
   aberta" (nome, CNO, ano, botão "Trocar obra" — mesmo mecanismo de troca
   de obra já existente); navegação primária de 4 itens (Visão geral /
   Despesas / Pendências / Obras); navegação secundária (Dados da obra /
   Terreno / Sua conta / Sair).
2. A obra continua sendo contexto **global** da sessão: todo número no shell
   (KPIs, painéis, futura tabela) é sempre da obra aberta. Trocar de obra
   troca o contexto inteiro, como hoje.
3. **Pendências** ganha item de primeira classe no menu, com contador de
   abertas em badge. **Fonte do contador**: a contagem exportada por
   `lib/fiscal/pendencias-unificadas.ts` (`CONTAI-042`, já entregue quando
   este ticket começa) — nasce direto na fonte definitiva, sem contagem
   provisória e sem risco de duas definições divergentes de "pendência
   aberta" (a classe de risco da D54, evitada por este ticket vir depois do
   `042`, não antes).
4. **Obras** aponta para a rota `/obras` já existente, sem alteração nela
   neste ticket — só o link no shell.
5. **Barra superior** (telas largas): título da view + subtítulo (obra/ano
   ou contagem); seletor de ano (só em Visão geral/Despesas); botão
   primário "+ Novo registro" com menu de 3 opções (Documento / Pagamento /
   Compra no cartão), reaproveitando **literalmente** rótulos e descrições
   de `app/adicionar/page.tsx` (copy de produto, não texto fiscal — decisão
   de design, não parecer).
6. **Faixa mínima de navegação abaixo do breakpoint desktop** — achado do
   `cto-obra` no Gate 0, incorporado como critério obrigatório: em telas
   estreitas, a sidebar colapsa para uma **faixa superior** com os mesmos 4
   links de navegação primária + o botão "+ Novo registro". "Pode quebrar"
   significa que a densidade/layout do dashboard não precisa ficar bonito
   nem otimizado para uma mão no celular (o Teste do Canteiro não se aplica
   às telas de `(gestao)`); **não significa que o canteiro perde a porta de
   entrada para `/adicionar`** — essa porta continua alcançável em 1 toque
   a partir de qualquer tela de `(gestao)`, em qualquer largura.
7. `/adicionar/*` (captura) **não muda em nenhuma linha** — continua sendo
   fluxo mobile-first, Teste do Canteiro aplicável como sempre, fora do
   grupo de rotas `(gestao)`.
8. **Dashboard — 3 KPI tiles lado a lado**, componentes NOVOS (não `Card`
   mobile redimensionado): tipografia 32px para o número, borda superior
   3px na cor da gravidade, padding 20-22px.
   - **Custo confirmado no ano**: número + "Acumulado do imóvel" + a frase
     completa "= situação em 31/12 na ficha Bens e Direitos (terreno + obra).
     Nada é somado com as outras obras." — texto **literal** de
     `app/page.tsx`, não reescrito.
   - **Custo em risco no IR**: número + decomposição em 3 linhas **sempre
     visível** (R4 do `CONTAI-005` não muda — a régua nunca aparece sem a
     decomposição) + a frase de imposto estimado (`textoImpostoAte`).
   - **Aferição do INSS (base)**: só aparece com CNO (mesma condição de
     hoje); número em base (nunca em reais de imposto) + as frases já
     existentes `INSS_NAO_E_IMPOSTO` e `INSS_CONTINUAM_VALENDO_NO_IRPF`.
   - ⚠️ **Todo texto citado aqui é para conferir contra `lib/fiscal/risco.ts`
     e `app/page.tsx` NO MOMENTO da implementação, não contra a
     transcrição do mock** — as constantes podem ter mudado desde
     21/09 (ex.: o `CONTAI-038` já mudou o que compõe a exposição de INSS).
     Nenhuma frase nova é permitida; toda frase é cópia literal do que a
     constante contém **hoje**.
9. **Painel "Pendências mais urgentes"** (a maior das duas colunas abaixo
   dos KPIs): as 4 pendências de maior gravidade/valor lidas de
   `pendencias-unificadas.ts` (`CONTAI-042`) — não mais de
   `resumo.pendencias` sozinho, que cobre só 7 das 18 famílias —, no mesmo
   formato compacto (chip + título + detalhe + valor) da view Pendências,
   com link "Ver todas (N) →" apontando para `/pendencias`. É um
   subconjunto dos mesmos itens, nunca um resumo com texto reescrito.
10. **Painel "Despesas recentes"**: as 4 `DespesaComprovada` mais recentes
    (`resumo.despesas`, já ordenado mais recente primeiro), com link "Ver
    todas (N) →" apontando para `/despesas` (rota que só ganha conteúdo no
    `CONTAI-041`; até lá o link pode ficar desativado ou o painel omitido —
    decisão do `lead-engineer` no Gate 1, sem bloquear este ticket).
11. **Painel "Agenda — próximos compromissos"**: reaproveita
    `BlocoAgendados`/`montarAgendaDaHome` já existentes. Compromisso não é
    pendência fiscal — fica visualmente separado, sem chip fiscal, sem
    entrar em soma nenhuma (mesma regra de sempre).
12. **Obras** (rota existente): mock em fidelidade baixa, deliberadamente —
    o item existe no shell só para a sidebar não ter link morto. Nenhuma
    mudança funcional em `/obras` neste ticket.
13. Nenhum teste E2E do fluxo de captura (`/adicionar/*`) muda de asserção
    — o grupo `(captura)` fica fora do shell e do escopo deste ticket por
    construção de rota, não por convenção CSS.

## Fora de Escopo
- A tabela de Despesas (rota nova `/despesas`) — `CONTAI-041`.
- A unificação de pendências derivadas + persistentes — já entregue pelo
  `CONTAI-042`, que vem antes. Este ticket só consome a função e cria o
  link/badge no shell.
- Qualquer mudança de regra de cálculo, cor de gravidade ou texto de
  consequência — reposicionamento e nova casca, nunca fato fiscal novo.
- Visão consolidada entre obras — decisão do `po`: descartada por ora (ver
  backlog `46-...`); a obra continua sendo contexto único e global.
- Telas de detalhe (`/documento/[id]`, `/pagamento/[id]`, etc.) ganhando o
  shell — fica para rodada futura (achado do `cto-obra`, passo 4 da
  recomendação técnica).

## Gate Fiscal (Contador)
Sem regra fiscal nova — todo número e todo texto dos KPIs já existe e já foi
adjudicado (`CONTAI-005`, `CONTAI-035`, `CONTAI-038`). O único ponto que
precisa de sanity check do `contador` é o critério 8: confirmar que as
constantes citadas ainda são as vigentes no momento da implementação.
Automático, sem exigência de CRC — não há texto novo.

## Pre-mortem
1. **Faixa mobile mínima virando pretexto para densificar captura.** O
   critério 6 nasce para a experiência de `(gestao)`; nada impede alguém de
   copiar o padrão para `(captura)` depois achando "já que tem uma faixa
   aqui". Guarda: nenhuma trava de código — é doutrina, revisão de PR
   aplica, mesma nota do `CONTAI-039`.
2. **KPI tile reaproveitando texto desatualizado.** Ver critério 8 —
   checagem contra o código no momento da implementação, não contra o mock.
3. **Sidebar "Obra aberta" divergindo do contexto usado pelos painéis.**
   Guarda: um único ponto de leitura de obra ativa (`escolherObraAtiva`/
   `lerObraPreferida`) para toda a árvore do shell.
4. **Route group `(gestao)` reintroduzindo duplicação de árvore por dentro**
   (ex.: um componente que decide internamente "sou mobile ou desktop" e
   bifurca o JSX) — voltaria a ser o erro do `CONTAI-039`, só que dentro de
   uma pasta com nome novo. Guarda: a separação estrutural é por ROTA
   (grupo), a responsividade DENTRO de `(gestao)` é CSS de um único
   componente de shell (sidebar ↔ faixa superior), nunca dois componentes
   de shell.

## Viabilidade (CTO)
Fechada no Gate 0 pelo `cto-obra` (avaliação técnica de 2026-09-21):
route groups do Next 16 (`(gestao)`/`(captura)`), não separação por
breakpoint/media query — rejeitada explicitamente por duplicar árvore de
componentes. Detalhe de arquivos/nomes de grupo a confirmar no Gate 1.

## Dependências
- Bloqueado por: `CONTAI-042` (consome a lista/contagem unificada de
  pendências — ver critérios 3 e 9).
- Bloqueia: `CONTAI-041` (precisa do item "Despesas" no shell).

## Cenário e checagem final
**Gestão** — em casa, sentado, monitor largo. O "Teste do Canteiro" não se
aplica dentro de `(gestao)`; `/adicionar/*` continua sendo julgado por ele,
inalterado.
