# CONTAI-076 Agenda no menu lateral do shell de gestão

## Tipo e Prioridade
Navegação — **P2** — conveniência de navegação (confirmado pelo `po`): não é
obrigação fiscal, nem fricção que bloqueia processo (a Agenda já é
alcançável hoje via link na Home).

## Dor de Origem
Relato: `docs/backlog/93-2026-09-28-menu-lateral-agenda-e-faturas.md`.

> "temos que adicionar no menu da lateral, faturas e compromissos, ou agenda
> para ter de fácil acesso as rotas existentes"

`/compromisso` (Agenda) já é tela completa e funcional, hoje só alcançável
clicando num link específico dentro da Home — 2+ cliques a partir de
qualquer outra tela do shell de gestão (uso principal: em casa, sentado).

Faturas foi cortado desta rodada por decisão explícita do Mateus: não existe
hoje tela de lista de faturas (só `/fatura/[id]`, sempre com id) — construir
uma seria feature nova, não "adicionar item de menu". Registrado para
retomada futura no mesmo arquivo de backlog.

## User Story
Como dono da obra, em qualquer tela do shell de gestão, quero chegar na
Agenda em 1 clique pelo menu lateral, sem depender do link dentro da Home.

## Critérios de Aceite
1. [x] Existe um 5º item em `VIEWS_DE_GESTAO` (`lib/gestao/navegacao.ts:30-35`)
   com `href: "/compromisso"` e rótulo **"Agenda"**, na **4ª posição**
   (Visão geral · Despesas · Pendências · Agenda · Obras).
2. [x] O item aparece tanto no menu lateral (desktop) quanto na faixa
   estreita mobile — mesma garantia que os 4 itens atuais já têm.
3. [x] A partir de qualquer tela do grupo `(gestao)` (ex. `/despesas`), o
   clique no item leva a `/compromisso` sem passar pela Home.
4. [x] O link "ver todos (N)" já existente na Home continua lá, inalterado
   — o item de menu é caminho adicional, não substituição.
5. [x] O item novo ACENDE (fica marcado como ativo) quando a rota é
   `/compromisso` ou qualquer subrota (`/compromisso/[id]`,
   `/compromisso/[id]/{confirmar,cancelar,data,valor}`) — a entrada
   `["/compromisso", "/"]` de `VIEW_DA_ROTA_DE_DETALHE` é removida (o
   casamento por prefixo resolve sozinho, como já resolve `/pendencias/[id]`
   e `/obras/[id]`).
6. [x] `RAIZES_DE_DETALHE.compromisso` perde o campo `daRaiz` (e o campo é
   removido da interface, junto com a linha
   `if (partes.length === 1) return entrada.daRaiz ?? null` de
   `migalhaDaRota`, que vira `return null`) — `/compromisso` é topo de
   navegação agora, como `/obras` e `/pendencias`.
7. [x] `RAIZES_DE_DETALHE.compromisso.mae` vira
   `{ href: "/compromisso", rotulo: "Agenda" }` — o breadcrumb do detalhe
   (`/compromisso/[id]`) passa a ser "‹ Agenda", não mais "‹ Visão geral".
8. [x] A tela `/compromisso` (`app/(gestao)/compromisso/page.tsx`) deixa de
   chamar `CabecalhoDaTela` nas 3 fases (carregando/erro/pronto) — o título
   passa a vir de `tituloDaView` = "Agenda", mesmo padrão de `/obras`,
   `/despesas` e `/pendencias` (um nome só por view: menu = título = crumb).
9. [x] `subtituloDaView` ganha uma cláusula própria para `/compromisso`
   (nome da obra, **sem ano**) antes da cláusula genérica que apenderia
   "· {ano}" — a Agenda não tem recorte por ano.
10. [x] `navegacao.test.ts` atualizado: `VIEWS_DE_GESTAO` tem 5 entradas;
    `/compromisso*` acende só o item "Agenda" (não mais "/"); `migalhaDaRota`
    do detalhe do compromisso aponta para `{ "/compromisso", "Agenda" }`;
    `tituloDaView("/compromisso")` → "Agenda"; subtítulo sem ano.
11. [x] Nenhuma rota nova é criada; nenhuma mudança em `/fatura/[id]`.

## Out of Scope
- Faturas — não existe tela de lista hoje (só `/fatura/[id]`, sempre com
  id); construir uma é feature nova, não coberta por este ticket. 3 opções
  levantadas ficam registradas em `docs/backlog/93-...md` para retomada
  futura.

## Gate Fiscal (Contador)
**Sem impacto fiscal** — navegação pura, zero campo/apuração envolvido
(confirmado pelo `po` no Passo 1; `contador` não precisou ser consultado).

## Pre-mortem
1. **Conflito de destaque de rota**: sem remover `["/compromisso", "/"]` de
   `VIEW_DA_ROTA_DE_DETALHE`, o item novo nunca acenderia (destaque
   continuaria em "Visão geral") e o teste antigo passaria escondendo o bug
   — coberto pelos critérios 5, 6, 7, 10.
2. **Faixa estreita mobile não cabe 5 itens**: descartado pelo `cto-obra` —
   o contêiner já é `overflow-x-auto`, entra na área rolável sem redesenho.
3. **Expectativa de que Faturas também entrou**: quem ler só o título do
   ticket pode assumir que Faturas foi esquecido — por isso a decisão do
   Mateus está citada explicitamente na seção Out of Scope.

## Viabilidade (CTO)
- **Modelo de dados: zero.** Sem migration, sem GRANT, `privilegios.spec.ts`
  intocado. `estado.compromissos` já chega ao shell via `ProvedorDeGestao`.
- **Complexidade: S** (~40 linhas + ajuste de testes).
- **Arquivos**: `lib/gestao/navegacao.ts` (item novo, remoção do mapeamento
  `/compromisso → "/"`, remoção de `daRaiz`, rótulo do crumb, branch de
  subtítulo), `lib/gestao/navegacao.test.ts` (blocos 21-41, 201-215, 304-319,
  367-382), `app/(gestao)/compromisso/page.tsx` (tirar `CabecalhoDaTela`, 3
  chamadas), `e2e/shell-desktop.spec.ts` (count 4→5 + ordem, view acesa e
  crumb, heading), `e2e/compromisso.spec.ts:297` (heading).
  `app/_components/shell.tsx` **não muda** (só itera `VIEWS_DE_GESTAO`).
- **Rótulo "Agenda"** (não "Compromissos" — evita 5º nome para a mesma
  view; não "Agendados" — particípio, não substantivo, e some com o
  critério 8). **Posição 4ª**, antes de "Obras": o badge de Pendências (2º
  item mais crítico) precisa continuar visível sem rolar na faixa de
  375px; "Obras" é cadastro/troca de obra e já tem porta própria
  ("Obra aberta"), fica por último por desenho.
- **Dívidas criadas**: nenhuma nova.

## Dependências
Bloqueado por / Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma.

## Cenário e checagem final
**Gestão** (menu do shell, usado em qualquer tela, em casa sentado). Serve
indiretamente à meta 2 (relatórios anuais prontos): reduz fricção para
revisar a agenda de compromissos com regularidade. Sem condição fiscal
órfã (Gate Fiscal fechado, sem impacto). Sem UI que quebre disciplina de
campo fiscal (não há campo). **Veredito: APROVADO.** Pronto para `/develop`.

✅ **Entregue em 2026-09-28.** Gate 4 (`po`) PASS, 11/11 critérios.
`VIEWS_DE_GESTAO` ganha o 5º item ("Agenda", 4ª posição, `/compromisso`), no
menu lateral e na faixa estreita mobile. A exceção `["/compromisso", "/"]`
some de `VIEW_DA_ROTA_DE_DETALHE` — o casamento por prefixo resolve sozinho,
e `/compromisso` e todas as subrotas acendem só "Agenda". `daRaiz` sai de
`RAIZES_DE_DETALHE.compromisso` (e da interface, e de `migalhaDaRota`) —
Agenda vira view de primeira classe, crumb do detalhe passa a ser
"‹ Agenda". `/compromisso/page.tsx` para de chamar `CabecalhoDaTela`; título
e subtítulo (nome da obra, sem ano) passam a vir de `tituloDaView`/
`subtituloDaView`, mesmo padrão de `/obras`/`/despesas`/`/pendencias`. "ver
todos (N)" na Home continua intocado, nenhuma rota nova, `/fatura/[id]`
intocado. Gate 2 (`cto-obra`) já havia aprovado sem pendências antes deste
gate; nenhum arquivo mudou depois — conferido por `git diff --stat` nos
arquivos do ticket. Sem Gate Fiscal (navegação pura). Suíte completa
(`npm run quality`, rodada em paralelo com `CONTAI-077`/`CONTAI-078` na
mesma árvore de trabalho): 408/409 E2E, única falha é flake confirmado
(re-executado isolado, passou) em `captura-retencao-desktop.spec.ts` —
arquivo não tocado por nenhum dos três tickets. Sem migration. Sem dívida
nova.
