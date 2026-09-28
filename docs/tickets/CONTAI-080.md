# CONTAI-080 Pré-vínculo compromisso↔nota antes do pagamento (fluxo PIX/boleto)

## Tipo e Prioridade
Feature — **P1** — fricção de processo (confirmado pelo `po`): não é
obrigação fiscal em si, mas evita repetir a busca de nota toda vez que uma
parcela é paga, numa obra com muitas parcelas e notas sem correspondência
1-para-1.

## Dor de Origem
Relato: `docs/backlog/96-2026-09-28-pre-vinculo-compromisso-nota-antes-do-pagamento.md`.

Mesmo fornecedor real do CONTAI-074 (concreto usinado, 3 notas fiscais
pagas por 7 parcelas, sem correspondência 1-para-1): o Mateus já sabe, no
momento de agendar, a qual nota (ou notas) uma parcela futura se refere —
quer declarar isso antecipadamente em vez de procurar de novo quando o
pagamento for confirmado.

## User Story
Como dono da obra, revisando um compromisso em aberto cujo fornecedor eu já
sei a quais notas fiscais ele se refere, quero declarar esse vínculo
antecipadamente — sem que conte como custo comprovado antes da hora — para
não repetir a busca de nota quando o pagamento for confirmado.

## Critérios de Aceite
1. [x] Proposta nível 1 (tela nova) + nível 2 (blocos em telas existentes)
   em `design/mocks/CONTAI-080.md`.
2. [x] Tabela nova `compromisso_documento_previsto` (`compromisso_id`,
   `documento_id`, `criado_em`, PK composta) — N:M, sem coluna de valor
   (é intenção, não quantia) e sem `situacao` própria (a vida do
   pré-vínculo é a do compromisso: só exibido/editável enquanto `situacao
   = 'aberto'`). GRANT explícito (`revoke all` antes; `grant select,
   insert, delete on … to authenticated` — DELETE é exceção nomeada, mesma
   régua de `pagamento_documento`) e `e2e/privilegios.spec.ts` atualizado.
3. [x] Tela nova `/compromisso/[id]/pre-vincular`: editor único (não duas
   telas de adicionar/remover) — busca (reaproveita `filtrarCandidatos`,
   limiar de 5 candidatos), lista de notas da obra com checkbox, SEM
   semântica de cobertura/teto do CONTAI-074 (aqui é candidato de NOTA
   pura, livre, sem chip "coberto por inteiro"). A nota de origem
   (`documentoOrigemId`), quando existir, aparece fixa e NÃO desmarcável,
   rotulada como herdada do agendamento. Salvar grava o diff
   (adiciona/remove) numa chamada só. 4 estados (carregando/vazio/erro/
   sucesso).
4. [x] CTA nova em `/compromisso/[id]` para `/pre-vincular`, visível só
   quando `situacao === "aberto"`. ⚠️ **D2, achado no Gate 2, e não estava no
   Passo 1 original**: o CTA (e o bloco do critério 5) NÃO aparece para
   `origem === "cartao"` — a quitação por fatura (`fatura_desembolso_gravar`/
   `fatura_alocar`) não conta N e não pergunta nada, então as duas variantes
   do critério 5 seriam falsas nas duas pontas para essa origem. A rota
   `/pre-vincular` recusa (banner âmbar) se alcançada à mão para um
   compromisso de cartão. Cartão é o CONTAI-081, inteiro — ver Out of Scope.
5. [x] Chip neutro **"Pré-vínculo — ainda não é custo"** (nunca vermelho,
   âmbar-de-alerta ou verde) em `/compromisso/[id]`, com o texto expandido
   verbatim do ADENDO 8 (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`,
   §L.2) — variante conforme o N atual (recalculado a cada render, nunca
   congelado, porque o pré-vínculo é editável):
   - N=1: "...Quando você confirmar o pagamento, o sistema vai vincular
     esta nota automaticamente — sem perguntar de novo."
   - N≥2: "...Quando você confirmar o pagamento, o sistema vai te
     perguntar se este pré-vínculo ainda vale."
6. [x] Mesmo chip + texto verbatim do ADENDO 6 §J.2 (bloco da nota) em
   `/documento/[id]`, dentro de `PagamentosDesteDocumento` — cobrindo o
   caso de N≥2 compromissos pré-ligando a mesma nota (lista em colchetes).
   Este texto do lado da nota NÃO muda por N (nunca prometeu pergunta
   nenhuma).
7. [x] Pré-vínculo NUNCA conta em nenhuma apuração — custo de aquisição,
   base de aferição INSS, discriminação anual, Pagamentos Efetuados — não
   é nó de `alocarCusto` (ADENDO 6, §J.1). Verificável comparando as
   saídas antes/depois de declarar um pré-vínculo (nenhum número muda).
8. [x] Nota pré-ligada por um compromisso não pago continua aparecendo em
   "Notas hábeis sem pagamento vinculado" até que um pagamento de verdade
   seja confirmado e ligado a ela (ADENDO 6, §J.1, mesma régua do
   CONTAI-072).
9. [x] Sem teto de soma no estado de pré-vínculo, em nenhuma direção —
   nem por compromisso, nem por documento (ADENDO 6, §J.4).
10. [x] O N usado para decidir a bifurcação da conversão (critério 11) é
    contado sobre a **união deduplicada** `documentoPrevistoIds ∪
    {documentoOrigemId}` (filtrada por `podeVincular` de obra), nunca só
    sobre a tabela nova isolada — achado do `cto-obra`: contar só sobre o
    pré-vínculo faria o mecanismo novo e o `propagar_vinculo_de_origem`
    (CONTAI-065) rodarem como dois automatismos independentes competindo
    pela mesma guarda ("nenhuma linha em `pagamento_documento`"), com
    resultado dependente da ordem de execução. Função pura
    `documentosResolvidosNaConfirmacao(compromisso, documentos)` em
    `lib/fiscal/compromisso.ts`, testada nos 3 ramos e na deduplicação
    origem=pré-vínculo.
11. [x] Conversão em vínculo formal (`pagamento_documento`), no ato de
    confirmar o pagamento (fluxo PIX/boleto, `/compromisso/[id]/confirmar`),
    bifurcada por N (ADENDO 7, §K.2, citação exata: *"Se o conjunto de
    documentos pré-vinculados a um compromisso resolver para exatamente 1
    documento (N=1) no momento da confirmação do pagamento, e nenhum
    vínculo já existir para esse pagamento em `pagamento_documento` → o
    sistema marca automaticamente o vínculo formal, sem clique adicional
    de confirmação, no mesmo padrão de `propagar_vinculo_de_origem`
    (CONTAI-065). Se o conjunto resolver para 2 ou mais documentos (N≥2)
    → o sistema exige confirmação explícita (revalidar + avisar),
    pré-preenchida com os candidatos e valores. Se resolver para 0
    documentos → segue o fluxo padrão de 'Ligar a uma nota', sem
    pré-preenchimento nem automação."*):
    - **N=0**: fluxo idêntico ao de hoje, sem código novo neste ramo.
    - **N=1**: sem UI nova — depois do PASSO 4 (`quitarCompromisso`), um
      PASSO 5 novo chama `criarVinculos` com o único documento resolvido,
      rastreado em `progresso` (retry idempotente via upsert
      `ignoreDuplicates`). Se esse único documento já foi ligado pelo
      CONTAI-065 dentro do PASSO 4 (é a nota de origem), o PASSO 5 é
      duplicata ignorada — os dois caminhos convergem na mesma linha, sem
      RPC nova.
    - **N≥2**: bloco literal do ADENDO 6 §J.3 (*"Confirmar este pagamento
      também confirma o vínculo com [Nota nº X — R$ valor][, Nota nº Y —
      R$ valor], como você já tinha indicado?"*) substitui o botão único,
      com **"Sim, confirmar os vínculos"** (grava o pagamento + todos os
      resolvidos) e **"Revisar antes de confirmar"** (grava o pagamento,
      redireciona para `/pagamento/[id]/ligar`) — nenhum dos dois recusa
      nem silencia o pagamento em si.
12. [x] "Revisar antes de confirmar" leva a `/pagamento/[id]/ligar` sem
    perder os pré-vínculos ainda não ligados formalmente.
13. [x] Em `/pagamento/[id]/ligar`, os candidatos da união (critério 10)
    que ainda não foram ligados formalmente nascem MARCADOS com o chip
    "Pré-vínculo — ainda não é custo" — exceção nomeada e testada à
    doutrina "nenhum candidato nasce marcado" (comentário de
    `Candidato`, `lib/fiscal/vinculo.ts`, atualizado para citar este
    ticket e o ADENDO 7 §K.2 como autorização).
14. [x] Na mesma tela, os documentos já ligados automaticamente pelo
    caminho N=1 aparecem num card "Já ligados a este pagamento" (chip
    "Ligado automaticamente"), reaproveitando `jaLigados` — campo que a
    tela já carrega hoje mas nunca renderizava.
15. [x] O pré-vínculo é editável a qualquer momento antes da conversão —
    adicionar/remover notas pela tela `/pre-vincular`, refletido na
    confirmação seguinte (diferente de `documento_origem_id`, único e
    imutável desde a criação, CONTAI-065 — os dois continuam coexistindo,
    sem alteração no campo existente).
16. [x] `lib/fiscal/vinculo.ts`, `resumo.ts`, `afericao.ts` e
    `discriminacao.ts` continuam sem importar `Compromisso` nem
    `compromisso_documento_previsto` — barreira de tipo já existente
    (CONTAI-072) estendida ao dado novo; teste-trava por grep atualizado.
17. [x] `pagamentosCandidatos`/`documentosCandidatos` (CONTAI-074/077/078/079)
    não mudam — continuam só com pagamentos/documentos já realizados.
18. [x] **A propagação da nota de origem (CONTAI-065) é CONDICIONADA ao N, nos
    DOIS caminhos de quitação** — acrescentado no Gate 2 (D1). `quitarCompromisso`
    recebe `propagarOrigem: boolean` **obrigatório, sem default**, e só chama
    `propagar_vinculo_de_origem` quando ele é `true`:
    - **N < 2** (`resolvidos.length < 2`): propaga, comportamento do CONTAI-065
      intacto — N=0 não tem o que propagar, N=1 é o caso que o §K.2 autoriza a
      converter sozinho.
    - **N ≥ 2**: **não propaga**. Sem isso, a origem era gravada em
      `pagamento_documento` ANTES de qualquer clique e a revalidação do §J.3
      cobria só o que sobrava — *parte do conjunto convertia sozinha*, que é o
      pre-mortem 1 acontecendo por dentro. O §K.4 preserva a condição 3 do
      CONTAI-065 ("não sobrescrever vínculo existente"); ele não autoriza
      propagar dentro de um fluxo que deve ser 100% revalidado.
    A união é contada por UMA definição só (`idsDaUniaoDoPreVinculo`, de que
    `documentosResolvidosNaConfirmacao` é a versão resolvida por obra).

## Comportamento nomeado — a sugestão de quitação rápida com N ≥ 2

⚠️ **Aprovado como está pelo Gate 2 (`cto-obra` + `contador`), não tolerado como
dívida.** `quitarCompromisso` tem **dois** chamadores: a tela
`/compromisso/[id]/confirmar` e a **sugestão de quitação rápida**
(`app/_components/quitacao.tsx`, CONTAI-019 §C), que aparece no detalhe de um
pagamento já gravado.

Quando um compromisso com **N ≥ 2** é quitado pela sugestão rápida:
- a quitação acontece normalmente (fato consumado nunca é recusado, §4);
- **nada é convertido em `pagamento_documento`** — nem a nota de origem;
- a união inteira continua gravada como intenção e aparece **pré-marcada** em
  `/pagamento/[id]/ligar` (critério 13), a um clique de fechar.

**Por que esta é a saída certa, e não conservadorismo excessivo**: o §K.2 exige
confirmação explícita para N ≥ 2, e este componente **não tem onde perguntar** —
ele é um card de resposta rápida embaixo de uma confirmação de pagamento, sem o
bloco do §J.3. Inventar uma tela de revalidação dentro dele seria desenho sem
spec. Converter parte do conjunto seria o D1 de volta pela segunda porta.

Detalhe de implementação que decorre disso: a sugestão rápida carrega a **agenda**,
não o painel, então ela não tem `Documento[]` para resolver a união — conta sobre
os **ids** (`idsDaUniaoDoPreVinculo`), que é um **limite superior** do N resolvido
(resolver só encolhe o conjunto). Errar para cima aqui erra sempre para o lado
seguro: no máximo deixa de automatizar um N=1, nunca converte parte de um N ≥ 2.
Travado por `e2e/pre-vinculo.spec.ts` ("N≥2 pela SUGESTÃO RÁPIDA") e pelo teste
unitário `porIds ≥ resolvido`.

🔓 **Pergunta em aberto, para o `po`/`designer`** (não decidida aqui): a
`SugestaoQuitacao` merece um bloco §J.3 próprio, para fechar os vínculos de N ≥ 2
sem sair da tela? Hoje o caminho existe e é curto (dois cliques), mas é um passo
a mais que o fluxo de `confirmar` não tem. Registrada em `docs/backlog.md`.

## Out of Scope
- **Fluxo de cartão/fatura** (RPC `fatura_desembolso_gravar`/
  `fatura_alocar`) — vira **CONTAI-081**, ticket separado, decisão do
  Mateus após o `cto-obra` apontar arquitetura distinta o suficiente para
  não caber neste. No CONTAI-080, um pagamento originado de fatura de
  cartão só recebe a pré-marcação passiva do critério 13 em
  `/pagamento/[id]/ligar` — nenhuma automação de conversão para cartão.
- **Rateio automático de pagamento parcial entre múltiplas pré-ligações**
  — recusado pelo `contador` (ADENDO 6, §J.3): fica sempre manual, no ato
  da confirmação (N≥2).
- **Aviso não-bloqueante de estouro de soma pré-ligada** — sugestão do
  `contador` (ADENDO 6, §J.4), decisão de produto do `po`: fica fora do
  escopo obrigatório desta versão. O spec do `designer` descreve como
  ficaria (referência futura), mas **não é critério de aceite aqui** — o
  Gate 1 não precisa implementá-lo.
- **Pré-marcação em `/documento/[id]/ligar`** (direção nota→pagamento) —
  simétrico ao critério 13, mas não motivado pelo relato; dívida nomeada,
  não corrigida.
- **Chip de pré-vínculo na Home ou em `/despesas`** — o parecer só nomeia
  os dois detalhes (compromisso e nota).
- **`compromisso.documento_origem_id`** — campo existente não é alterado.

## Gate Fiscal (Contador)
Regras completas em `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`:
- **ADENDO 6** (§J.0-J.5): natureza do pré-vínculo (intenção, não prova),
  textos base, proibição de rateio automático, ausência de teto antes da
  conversão.
- **ADENDO 7** (§K.1-K.5): bifurcação N=1 (automático, sem clique,
  convergindo com o padrão já em produção do CONTAI-065) vs. N≥2
  (confirmação explícita) — emitido depois que o Mateus contestou, com um
  fato real do produto, a redação original do ADENDO 6 que exigia clique
  sempre.
- **ADENDO 8** (§L.2): correção do texto do §J.2 do lado do compromisso,
  que ficara falso para N=1 depois do ADENDO 7 — duas variantes por N,
  citadas no critério 5.

## Pre-mortem
1. **Dois automatismos silenciosos competindo pela mesma guarda**
   (CONTAI-065 e o mecanismo novo, cada um contando N sobre sua própria
   fonte) — achado real do `cto-obra`, mitigado pelo critério 10 (N
   contado sobre a união deduplicada, uma função pura só).
2. **Leitura de "custo comprovado" antes da hora** — se a tela usar cor de
   sucesso ou a palavra "vínculo" desqualificada, o pré-vínculo pode ser
   lido como pagamento comprovado. Mitigado pelo chip neutro e pelos
   textos verbatim (ADENDO 6 §J.2, ADENDO 8 §L.2, que já corrigiu
   "vínculo" para "pré-vínculo" nos dois textos).
3. **Conversão silenciosa disfarçando rateio** — com N≥2, se a
   implementação "aproveitar" o pré-vínculo sem clique explícito, vira
   inferência de vínculo por heurística disfarçada. Mitigado pelo
   critério 11 (N≥2 sempre exige confirmação explícita).
4. **Texto de tela promete o que a regra não faz** — já aconteceu uma vez
   nesta mesma rodada (o §J.2 original prometia pergunta sempre, e o
   ADENDO 7 tornou isso falso para N=1). Mitigado pelo critério 5 exigir
   a variante certa por N, recalculada a cada render.

## Viabilidade (CTO)
- **Modelo de dados**: tabela nova `compromisso_documento_previsto`
  (migration `0023_compromisso_documento_previsto.sql`) — sem RPC nova,
  sem coluna em tabela existente. `lib/types.ts`:
  `Compromisso.documentoPrevistoIds: string[]` (espelho de
  `pagamentoIds`). `lib/data.ts`: `carregarCompromisso`/
  `carregarCompromissos` ganham a query nova; função
  `salvarDocumentosPrevistos(compromissoId, { adicionar, remover })`
  (upsert `ignoreDuplicates` + delete por par). Regen de
  `lib/database.types.ts`.
- **Guardas** (compromisso aberto, mesma obra) ficam no app
  (`podePreVincular` em `lib/fiscal/compromisso.ts`, reaproveitando
  `podeVincular` de `vinculo.ts`), não em trigger — mesma disciplina de
  `pagamento_documento`/`criarVinculos`.
- **Arquivos**: `supabase/migrations/0023_…sql` (novo),
  `lib/database.types.ts` (regen), `lib/types.ts`, `lib/data.ts`,
  `lib/fiscal/compromisso.ts` (+ `.test.ts`) — inclui
  `documentosResolvidosNaConfirmacao`, `lib/fiscal/vinculo.ts` (comentário
  de `Candidato` atualizado) + `.test.ts` (barreira de tipo estendida),
  `app/(gestao)/compromisso/[id]/pre-vincular/page.tsx` (novo),
  `app/(gestao)/compromisso/[id]/page.tsx`,
  `app/(gestao)/compromisso/[id]/confirmar/page.tsx`,
  `app/(gestao)/pagamento/[id]/ligar/page.tsx`,
  `app/(gestao)/documento/[id]/page.tsx`, `e2e/privilegios.spec.ts`,
  `e2e/pre-vinculo.spec.ts` (novo — cobrindo os 3 ramos de N e a
  deduplicação origem=pré-vínculo), `design/mocks/CONTAI-080.md` (já
  escrito).
- **Complexidade: L**, no limite inferior — o ADENDO 7 tirou UI do caso
  mais frequente (N=1 vira só uma função pura + um PASSO a mais na
  quitação), mas não tira nenhuma peça estrutural (migration, editor
  novo, chips em duas telas, bloco N≥2, pré-marcação e o E2E).
- **Dívidas criadas**: nenhuma nova de código. Nomeadas, não corrigidas
  aqui: pré-marcação em `/documento/[id]/ligar` (simétrica, não
  motivada); aviso não-bloqueante de estouro de soma (decisão de produto
  adiada); cartão fica inteiro no CONTAI-081.

## Dependências
Bloqueado por / Bloqueia: nenhum. **CONTAI-081** (fluxo de cartão) depende
conceitualmente deste — reaproveita a mesma função
`documentosResolvidosNaConfirmacao` e a mesma doutrina N=0/N=1/N≥2, mas é
ticket separado, ainda sem critérios escritos.

## Perguntas Abertas
Nenhuma — as 3 perguntas técnicas originais foram todas ao `contador`
(Gate Fiscal, ADENDO 6/7/8); a divisão 080/081 foi confirmada pelo
Mateus.

## Cenário e checagem final
**Gestão** (declarar/revisar pré-vínculo, confirmar pagamento — em casa,
sentado). Serve à meta 1 (nenhum pagamento sem documento hábil):
reduz a chance de o Mateus esquecer, no momento da quitação, a qual nota
uma parcela se referia, numa obra com muitas parcelas sem correspondência
simples. Sem condição fiscal órfã — toda condição cita o ADENDO
correspondente. Sem UI que quebre disciplina de campo fiscal (nenhum
campo fiscal nasce preenchido; a tela de pré-vínculo é seleção, não
digitação). **Veredito: APROVADO.** Pronto para `/develop`.

✅ **Entregue em 2026-09-28.** Gate 4 (`po`) PASS, 18/18 critérios. Tabela
nova `compromisso_documento_previsto` (migration `0023`, N:M, sem valor,
sem situação própria, GRANT explícito). Tela `/compromisso/[id]/pre-vincular`
(editor único, sem semântica de cobertura/teto). Chip "Pré-vínculo — ainda
não é custo" + textos verbatim dos ADENDOS 6/7/8 nas duas telas
(compromisso e nota), nunca entra em nenhuma apuração. Conversão em
`pagamento_documento` bifurcada por N (`documentosResolvidosNaConfirmacao`,
união deduplicada pré-vínculo+origem): N=0 sem mudança, N=1 automático sem
clique, N≥2 exige confirmação explícita ("Sim, confirmar os vínculos" /
"Revisar antes de confirmar"). Gate 2 (`cto-obra`+`contador`) teve 1 rodada
de REQUEST CHANGES com 2 bloqueantes reais: (D1) a nota de origem estava
sendo propagada pelo CONTAI-065 ANTES do clique mesmo em N≥2 — corrigido
com `propagarOrigem: boolean` obrigatório, calculado a partir do N já
resolvido; (D2) o CTA/chip apareciam também para compromissos de cartão,
prometendo automação que não existe ali (cartão é CONTAI-081) — corrigido
com `podePreVincular` recusando origem cartão. Achado extra julgado
CORRETO no Gate 2: a quitação pela sugestão rápida (`quitacao.tsx`) com
N≥2 não converte nada, deixa a união pré-marcada em `/pagamento/[id]/ligar`
— não tem onde perguntar, e não é regressão. `npm run quality` completo:
1291/1291 unit, 430/430 E2E. Pendências nomeadas, não corrigidas: pré-vínculo
não gera aviso de estouro de soma (decisão de produto adiada);
pré-marcação simétrica em `/documento/[id]/ligar`; se `SugestaoQuitacao`
merece bloco de revalidação próprio (pergunta aberta pro `po`/`designer`).
⚠️ **A migration `0023` ainda não foi publicada** — `npx supabase db push`
precisa rodar ANTES do `git push`.
