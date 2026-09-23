# Export do acervo posto em espera — 2026-09-23

Decisão do Mateus, depois de ver o Gate 1 do `CONTAI-011` (011-A) concluído
(DONE, 1012 unitários + 292 E2E verdes, não commitado): o trio inteiro
"Export do acervo" — `CONTAI-011` (011-A, rotina periódica + sinal no app),
`CONTAI-049` (011-B, triagem de órfão) e `CONTAI-050` (011-C, dossiê sob
demanda) — vai para espera, antes do Gate 2.

## A lacuna

Todo o desenho, do mock aprovado em 2026-08-16 até a implementação de hoje,
assume um **destino único**: o Google Drive do próprio Mateus, com credencial
central (service role key + refresh token do Drive só em GitHub Secrets; PAT
de disparo só na Vercel — Decisões 2 e 2b da Viabilidade do `CONTAI-011`).

Isso não escala se o contai deixar de ser ferramenta pessoal e virar produto
com outros usuários. Palavras do Mateus: *"e se eu quiser tornar o app
público e ter outros usuários, eles têm que ser capaz de colocar no drive
deles o export."* Cada usuário precisaria de um fluxo de OAuth **próprio**
(conectar a própria conta do Google, token por usuário, revogável por
usuário) — arquitetura bem diferente da que foi especificada e implementada.
Nenhum agente (`po`, `cto-obra`, `contador`, `designer`, `lead-engineer`)
identificou essa lacuna antes — o desenho todo partiu implicitamente do "só
existe um usuário: o Mateus", que era verdade até agora ser questionada.

## Por que não é bug do que foi entregue

O `011-A` implementado hoje está correto **para o uso atual, single-tenant**.
Nada foi feito errado dado o requisito como estava escrito. A questão é se
vale a pena manter esse requisito implícito ou reabri-lo — decisão de
produto, não de qualidade técnica.

## Condição de retorno

Só reabrir Gate 2 em diante — e qualquer `/design` que a correção de
requisito exigir — **quando o fluxo comum de registrar despesas e apurar
custo (captura, conciliação, discriminação anual) estiver estável e
correto**. Guarda documental é a meta 3; o fluxo de despesas são as metas 1
e 2, e a ordem de valor entre elas favorece consolidar o core antes de
aprofundar infraestrutura multiusuário que talvez nem seja usada.

## O que fica intocado enquanto isso

- Nenhum commit do trabalho do `011-A` (fica em árvore de trabalho ou
  stash/branch — decisão de quem retomar).
- Nenhum `npx supabase db push` da migration `0018_export_execucao.sql`.
- Gate 2 (`cto-obra`/`contador`) não se inicia em nenhum dos três tickets.

Flag "🛑 EM ESPERA" adicionada no topo de `docs/tickets/CONTAI-011.md`,
`CONTAI-049.md` e `CONTAI-050.md`, e nova seção em `docs/tickets/README.md`
("🛑 Em espera — decisão do Mateus, 2026-09-23"), substituindo a entrada dos
três na fila ativa.
