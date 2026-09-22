# CONTAI-043 entregue — 2026-09-21 — /documento/[id] migra para o shell

Primeiro dos 4 tickets de migração de telas de detalhe (`043`-`046`). As 10
rotas de `/documento/[id]` (detalhe + anexar, cnpj-errado, corrigir/
{classificacao,emitente,valor}, desligar, ligar, obra, outro-dado) saem de
`app/(captura)/` (casca de 430px) e entram em `app/(gestao)/`, dentro do
shell entregue pelo CONTAI-040.

Novo `app/_components/detalhe.tsx`: `CabecalhoDaTela` (o título/subtítulo
da tela vence o da view no topbar do shell — Pre-mortem 1: documento de
outra obra não herda "nome da obra ativa" embaixo), `ColunaDeDetalhe`
(640px, não os 560px que o `cto-obra` tinha cogitado sem desenhar — o
`designer` alargou para não quebrar linha nos grupos de `Escolha`),
`RodapeDeAcao` (sticky, escopado à coluna, só em telas com UMA ação central
de formulário — leituras com ações por card não ganham rodapé). Breadcrumb
no topbar (`migalhaDaRota`, `lib/gestao/navegacao.ts`) substitui o botão
fixo "Voltar ao documento" — removido em todas as subrotas, com uma
exceção nomeada (`corrigir/emitente?voltar=pagamento`, que volta a um
formulário de captura interrompido, destino que o breadcrumb não cobre).

Nenhum texto fiscal mudou — confirmado pelo `contador` por diff filtrado
(zero hit em `Consequencia`/`Chip`/`Dica`/constantes de risco/retenção) e
pelos grep-travas de `lib/fiscal/{documento,vinculo}.test.ts`, repontados
para o caminho novo.

Achado operacional do `cto-obra` durante o Gate 2: dois agentes rodando
E2E ao mesmo tempo contra o mesmo Postgres local produzem falha espúria
(`limpar` de uma suíte apaga linhas que a outra estava usando) — mesmo
invariante de "um agente por vez na árvore de trabalho", agora reconhecido
também para o banco local, não só para o git.

Testado: 881 unitários + 249/250 E2E (1 falha pré-existente confirmada por
raio de explosão — `discriminacao.spec.ts:215`, do `CONTAI-046` futuro, não
deste ticket) + validação manual no browser. Gate 4 (`po`) PASS, 5/5
critérios. Sem migration. Próximo: `CONTAI-044` (pagamento+fatura).

## Dívidas nomeadas

- Nota para o `CONTAI-044`: `page.tsx` e `obra/page.tsx` de documento ainda
  fazem `carregarPainel`/`carregarPaineis` próprios enquanto o
  `ProvedorDeGestao` do shell já carrega os mesmos painéis — carga dupla
  pré-existente. Ao migrar pagamento/fatura, decidir se o detalhe passa a
  consumir `useGestao()` só para os painéis (nunca para "obra ativa").
