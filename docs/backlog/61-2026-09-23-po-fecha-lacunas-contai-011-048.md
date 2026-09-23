# PO fecha lacunas do CONTAI-011 e do CONTAI-048 — 2026-09-23

## CONTAI-011 — "P1, P2 e P3" investigadas

O cabeçalho do ticket dizia que o mock aprovado "NÃO fecha as 3 perguntas
bloqueantes (P1, P2 e P3, em 'Perguntas Abertas')", mas a seção "Perguntas
Abertas" só tinha M1–M4, e nem o backlog nem os pareceres tinham um P2 ou P3
nomeado em lugar nenhum.

**Investigação**: leitura integral do `docs/tickets/CONTAI-011.md`, do
`design/mocks/CONTAI-011.md` (spec extraída do mock) e do parecer fiscal
`docs/pareceres/2026-08-16-gate-fiscal-contai-011.md`.

**Achado**: a numeração "P1/P2/P3" nunca existiu como conjunto formal.
- **P1** tem identidade: é a pergunta do mock (seção "Dúvidas", final do
  arquivo) *"De onde o app lê o estado do export?"*, lá marcada como
  "bloqueante do Gate 2" — e é exatamente o que o resto do cabeçalho do
  ticket já tratava como pré-requisito duro do critério 6(c). ✅ Resolvida em
  2026-09-23 pelo `cto-obra` (tabela `export_execucao`, Decisão 4).
- **P2 e P3 não existem.** Ninguém os nomeou. O veredicto do próprio Gate
  Fiscal é categórico: só R1–R5 bloqueiam Gate 1 (já incorporados aos
  critérios 3, 8, 12, 13, 14); R6–R10 são notas de Gate 2. Não há um segundo
  ou terceiro bloqueio fiscal escondido atrás de um rótulo nunca escrito.

**Decisão do `po`**: corrigir o cabeçalho do ticket (não inventar P2/P3 nem
deixá-los como dívida fantasma) e listar os itens reais que sobram — nenhum
bloqueante — como notas de Gate 2/implementação: conflito critério 12 × R6
(dossiê por obra levando Pagamentos Efetuados, que é ficha do declarante),
campos obrigatórios de "documento da obra", "gerar assim mesmo" (`#s21`),
alcance da busca de vínculo em outra obra, e a confirmação de numeração legal
antes do `LEIA-ME.txt` ir para tela (já listada pelo próprio parecer em
"Pontos a confirmar antes de virar texto de tela").

**M2** (cadência) — confirmada pelo `po`: semanal, ratificando o `cto-obra`;
é constante reversível (`PERIODICIDADE_DIAS` em `lib/export/politica.ts`),
não decisão de arquitetura, não precisa aguardar o Mateus.

**M3** (canal de aviso) — reavaliada à luz da Decisão 4: confirmado que não
bloqueia mais o Gate 1 (só decide o canal de push; o sinal positivo/negativo
já mora dentro do app via `export_execucao`).

**Veredicto**: ✅ **PRONTO PARA `/develop`.** Fica de fora do Gate 1 de
código, sem bloqueá-lo: o OAuth do Google Drive (publicar o app fora de
"testing", conceder `drive.file`, gravar o refresh token) é ação de
dashboard do Mateus, e só bloqueia a primeira execução real do workflow, não
o desenvolvimento dele.

Detalhe completo, com as citações, em `docs/tickets/CONTAI-011.md` (seção do
cabeçalho corrigida + nova seção final "Veredicto (po, 2026-09-23)").

## CONTAI-048 — consulta ao `cto-obra` sobre PDF mobile e fechamento do Gate 0

O `designer` entregou `design/mocks/CONTAI-048.md`/`.html` (Gate 0: lightbox
sob demanda para ver imagem/PDF ampliado ao lado do formulário de
`/adicionar/documento`), com uma pergunta não-bloqueante para o `cto-obra`:
`<object type="application/pdf">` tem suporte desigual em navegador mobile —
o fallback de download pode ser comum, não exceção, no Safari iOS (o alvo
real do projeto, `defaultBrowserType: webkit` no Playwright).

**Resposta do `cto-obra`** (consulta técnica de 2026-09-23): a pergunta mirava
o risco errado. Não é o fallback de download que vira comum — é o `<object>`
"funcionar" e mostrar só a 1ª página, sem scroll interno, sem toolbar, sem
zoom próprio: degradação silenciosa que não aciona o `children` do `<object>`
e não aparece no CI (o `webkit` do Playwright roda em Linux e não tem viewer
de PDF nenhum). Correção recomendada: em telas largas/mouse, manter o
`<object>` + fallback do mock; em tela estreita/touch, PDF não embute no
Lightbox — vira link `<a target="_blank">`, que abre o visualizador nativo de
aba inteira do iOS (todas as páginas, pinch zoom, compartilhar). Imagem
continua com o Lightbox modal em qualquer largura. Deu também notas técnicas
para o Gate 1 (revogar blob URL só ao fechar/trocar arquivo, `key={blobUrl}`
para remontar o `<object>`, `<a target="_blank">` só dentro do gesto de
toque, `download` de blob funciona em iOS ≥ 13) e marcou que **teste manual
em iPhone real + macOS Safari com PDF de ≥ 2 páginas continua exigido antes
do Gate 1 fechar de vez** — nem CI nem Playwright/webkit provam isso.

**Decisão do `po`**: incorporar a resposta direto no critério 3 do ticket
(correção mecânica e sem ambiguidade de fluxo — troca de primitiva HTML por
tipo de entrada, não nova tela), sem reabrir Gate 0 nem pedir novo ciclo de
`/design`. Marcado Gate 0 como FECHADO no corpo do ticket.

**Veredicto**: ✅ **PRONTO PARA `/develop`.** Gate Fiscal é sanity check sem
regra nova. Único item que não fecha por código: a validação manual em
iPhone/macOS Safari — não impede começar o Gate 1, mas o Gate 4
(verificação) deste ticket não pode fechar só com a suíte automatizada.

Detalhe completo em `docs/tickets/CONTAI-048.md` (seções "Gate 0", critério 3
revisado, "Dependências" e nova seção final "Veredicto (po, 2026-09-23)").

## Não fiz

Não mexi na ordem/fila de execução em `docs/tickets/README.md` (é o "dono" do
sequenciamento — `docs/backlog.md`, "Estado vigente"). Os dois tickets saem
daqui **prontos para `/develop`**, mas entrar na fila ativa e decidir a ordem
entre eles (e frente a qualquer outro pronto) é decisão de sequenciamento,
fora do escopo desta rodada.
