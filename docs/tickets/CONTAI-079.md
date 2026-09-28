# CONTAI-079 Card fixo no topo das telas de ligar também sobrepõe a lista

## Tipo e Prioridade
Bug — **P1** — mesma classe do CONTAI-077: usabilidade real quebrada em
feature recém-entregue, sobre uma tela onde o Mateus precisa conferir
favorecido/valor/data/comprovante antes de marcar o vínculo.

## Dor de Origem
Relato: `docs/backlog/95-2026-09-28-contai-077-topo-ainda-sobrepoe.md`.

> "o problema do scroll foi resolvido em baixo, mas não em cima. Tem o
> mesmo problema na parte de cima."

Dívida já nomeada no Out of Scope do CONTAI-077 ("aceitável, não tratado
aqui"), agora revogada pelo Mateus ao ver o comportamento real em produção
(nota Ilhamix, NF de serviço nº 1543): o card `sticky top-0` ("Falta ligar
desta nota") esconde linhas da lista durante o scroll intermediário — mesma
causa raiz do `RodapeDeAcao` antes do CONTAI-077 (sticky dentro do `<main
overflow-y-auto>` sobrepõe por definição).

## User Story
Como dono da obra revisando uma lista longa de candidatos nas telas de
ligar pagamento↔nota, quero ver cada linha por inteiro durante o scroll,
sem parte dela escondida atrás do card fixo do topo — assim como já vale
para o rodapé desde o CONTAI-077.

## Critérios de Aceite
1. [x] Em `/documento/[id]/ligar`, com lista de candidatos longa o bastante
   para exigir scroll (reproduzível com a nota real de 24 candidatos),
   nenhuma linha fica parcial ou totalmente coberta pelo card fixo do topo
   durante o scroll intermediário.
2. [x] O mesmo vale, sem exceção, em `/pagamento/[id]/ligar`
   (`app/(gestao)/pagamento/[id]/ligar/page.tsx:344`).
3. [x] A correção cobre as duas ocorrências verificadas por `grep -rn
   "sticky top-0" app` (excluindo testes) — não é aceito fechar com uma
   tela corrigida e a outra pendente.
4. [x] No repouso inicial (topo do scroll, sem scroll realizado), o card
   continua visível e fixo no topo, mesma largura (640px) e mesmo `x` da
   coluna — a correção não regride o comportamento de cabeçalho de leitura
   fora da janela em que ele hoje sobrepõe conteúdo.
5. [x] Mecanismo: `slotDoTopo`/`publicarSlotDoTopo` no mesmo contexto que já
   carrega `slotDoRodape` (`app/_components/detalhe.tsx`); `ShellDeGestao`
   publica um `<div data-shell="slot-topo">` irmão de `<main>`, entre
   `</header>` e `<main>`, só com a goteira (`px-[18px] lg:px-9`).
6. [x] Componente `TopoFixo` (espelho de `RodapeDeAcao`, com `top` em vez de
   `bottom`) renderiza por portal no slot; sem slot no contexto (SSR/fora
   do shell), cai no fallback inline `sticky top-0 z-10` — comportamento de
   hoje preservado como caminho defensivo.
7. [x] `TopoFixo` carrega `w-full max-w-[640px]` e o respiro de cima
   (`pt-4 lg:pt-7`); o slot em si mede zero vazio quando não publicado.
8. [x] As duas telas trocam `<Card className="sticky top-0 z-10 bg-soft">`
   por `<TopoFixo><Card className="bg-soft">…</Card></TopoFixo>`, sem
   extrair o conteúdo interno do card num componente compartilhado — o
   rótulo/`Dica` diferem entre as duas telas (3 ramos vs. 2), e
   parametrizar isso por só 2 usos é generalização prematura.
9. [x] Nenhum outro uso do padrão `sticky top-0` no app é afetado — checado
   por grep próprio antes da implementação (`app/_components/captura.tsx`
   tem um `sticky` de rail que NÃO é o mesmo padrão, não se toca).
10. [x] Novo teste E2E de geometria (espelho do CONTAI-077): lista longa,
    `main` scrollado a meio caminho, nenhum item visível dentro do `main`
    intersecta a caixa de `[data-topo="fixo"]` — cobrindo as duas telas.

## Out of Scope
- Nada novo além do já registrado no CONTAI-077/078 — não reabre "vincular
  a nota antes de pagar".
- Extrair um `CardResumoFixo` compartilhado com o conteúdo interno do card
  — só o invólucro (`TopoFixo`) é comum; se um 3º card fixo aparecer no
  futuro, aí se extrai o conteúdo também.
- Restringir o `TopoFixo`/`RodapeDeAcao` a partir de `lg` no celular —
  dívida nomeada (ver Pre-mortem/Viabilidade), não corrigida aqui.

## Gate Fiscal (Contador)
**Sem impacto fiscal** — correção de mecanismo de layout/scroll sobre dado
que já existe e já está correto; nenhum texto, campo ou regra fiscal
tocado.

## Pre-mortem
1. **Corrigir só uma das duas telas** (arquivos separados, mesmo bug):
   mitigado pelos critérios 2 e 3, que nomeiam os dois caminhos.
2. **"Resolver" escondendo o card durante o scroll** em vez de tirá-lo da
   área rolável, regredindo o cabeçalho de leitura: mitigado pelo critério
   4.
3. **Generalizar demais e afetar outro uso do padrão**: mitigado pelo
   critério 9 (grep próprio antes de mudar comportamento compartilhado) —
   confirmado pelo `cto-obra` que não há outro uso do mesmo padrão hoje.
4. **Orçamento vertical no celular** (header + faixa + card fixo + rodapé
   fixo somam boa fatia da viewport de um iPhone SE): aceito pela doutrina
   desktop-first vigente, nomeado explicitamente para não virar surpresa se
   retornar como relato — a saída, se necessário, é `TopoFixo` fixar só a
   partir de `lg`.

## Viabilidade (CTO)
- **Diagnóstico**: o card sobrepondo linhas é o mesmo mecanismo — sticky
  DENTRO do `<main>` que rola — do `RodapeDeAcao` antes do CONTAI-077.
  Ganho funcional real além do visual: hoje, focar um item da lista rola o
  alvo para a borda do scrollport (por baixo do card, já que sticky dentro
  do scroller não move essa borda); fora do scroller, o alvo pousa visível.
- **Mecanismo escolhido**: `slotDoTopo`, espelho exato do `slotDoRodape` já
  construído no CONTAI-077 — o plumbing já existe (contexto em
  `detalhe.tsx`, shell publicando slot irmão de `<main>`). Alternativas
  locais descartadas: tirar o `sticky` (perde o número que atualiza junto
  com a marcação); `scroll-padding-top` (só resolve foco, não scroll
  manual, e dependeria da altura variável do card); fundir no
  `RodapeDeAcao` (mistura duas grandezas que o CONTAI-074 separou de
  propósito).
- **Modelo de dados**: zero.
- **Arquivos**: `app/_components/detalhe.tsx` (`slotDoTopo`,
  `publicarSlotDoTopo`, `usePublicarSlotDoTopo`, componente `TopoFixo`),
  `app/_components/shell.tsx` (slot novo entre `</header>` e `<main>`),
  `app/(gestao)/documento/[id]/ligar/page.tsx:380`,
  `app/(gestao)/pagamento/[id]/ligar/page.tsx:344`,
  `e2e/shell-desktop.spec.ts` (teste espelhado do CONTAI-077, nas duas
  telas).
- **Complexidade: S** (~60 linhas de código, ~80 de teste).
- **Dívidas criadas**: nenhuma nova de código. Efeito nomeado (não dívida
  de bug): orçamento vertical no celular, registrado no Pre-mortem/Out of
  Scope.

## Dependências
Bloqueado por / Bloqueia: nenhum. Depende conceitualmente do mecanismo de
slot já entregue no CONTAI-077, sem modificar aquele código além de
adicionar o par simétrico.

## Perguntas Abertas
Nenhuma.

## Cenário e checagem final
**Gestão** (conciliação pagamento↔nota, em casa, sentado). Serve à meta 1
indiretamente: a tela onde o Mateus confere se um pagamento prova uma nota
precisa ser legível para essa conferência acontecer direito. Sem condição
fiscal órfã (Gate Fiscal fechado, sem impacto). Sem UI que quebre
disciplina de campo fiscal (não há campo). **Veredito: APROVADO.** Pronto
para `/develop`.

✅ **Entregue em 2026-09-28.** Gate 4 (`po`) PASS, 10/10 critérios. `TopoFixo`
espelha `RodapeDeAcao` (`slotDoTopo`/`publicarSlotDoTopo`, mesmo contexto,
mesmo mecanismo de portal com fallback inline) — o card "Falta ligar desta
nota"/"Falta ligar deste pagamento" sai da área rolável em
`/documento/[id]/ligar` e `/pagamento/[id]/ligar`, sem extrair o conteúdo
interno num componente compartilhado (só o invólucro é comum). `grep -rn
"sticky top-0" app` confirma zero ocorrência fora do fallback; o rail de
`captura.tsx` (padrão diferente) não foi tocado. Gate 2 (`cto-obra`)
aprovou sem pendências bloqueantes; discutiu e aceitou o `ErroDeGravacao`
passar a aparecer abaixo do card (inevitável dado o mecanismo de portal,
`role="alert"` não depende de ordem linear) e sugeriu, como ticket futuro
separado, focar/rolar até o banner de erro ao aparecer — não aplicado
aqui. Suíte completa (`npm run quality`): 412/412 E2E, incluindo os 3
testes novos e os 2 do CONTAI-077 intactos (prova de independência dos
dois slots). Sem migration. Dívida nomeada, aceita: orçamento vertical no
celular (header + faixa + `TopoFixo` + `RodapeDeAcao`) — saída futura, se
necessário, é fixar só a partir de `lg`.
