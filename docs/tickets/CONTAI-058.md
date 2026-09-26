# CONTAI-058 Shell de gestão revalida ao navegar, em vez de ficar com dado velho até F5

## Tipo e Prioridade
bug — P1 (fricção/confiança de dado). Achado em produção pelo Mateus logo
depois do `CONTAI-056`: os dados gravados já estão corretos em todos os
casos — o que está errado é só a leitura em tela até um F5 forçar o
recarregamento.

## Dor de Origem
`docs/backlog/72-2026-09-26-legibilidade-despesas-e-cache-documento.md`,
US-B. Palavras do Mateus: *"eu fui em despesas, selecionei a nota, alterei
a configuração do imposto de 'a empresa paga' para 'eu pago' [...] na
despesa em si o valor atualizou imediatamente [...] mas no geral continuou
contando, até que eu fiz o refresh da página, daí atualizou. Isso tem que
melhorar."*

Causa raiz confirmada por leitura de código (não hipótese):
`ProvedorDeGestao` (`app/_components/gestao.tsx`) é 100% client-side
(`"use client"`, `useEffect`+`useState`) e busca os dados da obra **uma
única vez**, guardando em contexto React compartilhado por toda a árvore
`(gestao)/*` (33 rotas — Home, Despesas, Pendências, etc.). Nenhuma rota
de mutação dentro do grupo invalida esse contexto ao gravar; cada uma tem
seu próprio `tentarDeNovo` local, que só atualiza a própria tela.

**Achado do `cto-obra` que amplia o escopo do relato original**: o bug não
é específico das 6 subrotas de `documento/[id]/*` citadas no relato — são
na verdade **10** (o relato não contava `anexar` e `outro-dado`), e o mesmo
padrão isolado se repete em `pagamento/[id]/*`, `fatura/[id]/*`,
`compromisso/[id]/confirmar` (cria pagamento → muda KPI da Home),
`obras/[id]/terreno/*`, `pendencias/[id]` — qualquer rota do grupo
`(gestao)` que grava algo. Só `(captura)` escapa, por acidente de ser outro
layout Next (remonta o provedor ao voltar). O critério de aceite é sobre o
GRUPO inteiro, não uma lista fechada de subrotas.

## User Story
Como dono da obra corrigindo ou respondendo uma pendência em qualquer tela
de gestão, quero que a Home e a Despesas mostrem o efeito assim que eu
navegar de volta, sem precisar dar F5, para confiar que o número que vejo é
o número atual.

## Critérios de Aceite
1. [x] **Qualquer rota do grupo `(gestao)`** que grave uma mutação
   afetando total agregado, seguida de navegação por link do app (sem F5)
   para `/` ou `/despesas`, mostra o KPI/linha já atualizado — não uma
   lista fechada de subrotas.
2. [x] Teste E2E cobre o caso do relato: mudar `quem_recolhe` de um
   documento (empresa → eu) e, sem reload, conferir que o KPI de custo
   comprovado da Home mudou.
3. [x] Teste E2E cobre pelo menos mais um caso **fora** de
   `documento/[id]/*` (ex.: `compromisso/[id]/confirmar` criando um
   pagamento) chegando ao mesmo comportamento — prova que a correção é do
   grupo, não de uma pasta específica.
4. [x] Navegação dentro do grupo `(gestao)` **nunca** mostra um estado de
   "carregando" que apague o shell — o dado anterior continua visível até
   o novo chegar (stale-while-revalidate). Só o `tentarDeNovo` explícito
   (botão de erro) continua mostrando loading, como hoje.
5. [x] Falha na revalidação por navegação vira `fase: "erro"` com
   `tentarDeNovo` — nunca mantém o número velho em silêncio (isso seria o
   mesmo bug, com outro nome).
6. [x] Não reintroduz soma nenhuma em `despesas/page.tsx` (doutrina "nenhuma
   soma em tela" do `CONTAI-005` continua valendo) — o que muda é a
   atualidade do dado que a Home já soma, não onde a soma acontece.
7. [x] Navegação que **não** envolveu mutação nenhuma não fica
   perceptivelmente mais lenta: no máximo UMA recarga do shell por
   navegação (mesmo conjunto de chamadas que já roda hoje na montagem —
   `carregarObras` + `carregarPainelDePendencias` + `carregarPainel` +
   `carregarCompromissos`); nenhum polling, nenhum gatilho de foco de
   janela; navegação em voo é substituída pela mais recente, nunca
   enfileirada; a revalidação do shell nunca bloqueia o fetch próprio da
   página de destino (os dois corem em paralelo, como hoje).

## Out of Scope
- Fazer `despesas/page.tsx` somar valores em tela — doutrina do
  `CONTAI-005`, não reaberta aqui.
- Qualquer mudança de cálculo fiscal — os números já estão certos desde o
  `CONTAI-056`; este ticket é só re-renderização/atualidade de cache.
- Expor uma função `revalidar()` sob demanda no contexto para chamada
  manual por mutação — reabriria o "por lembrança" que o pre-mortem já
  rejeitou; fora de escopo, ticket futuro se um dia for necessário.
- Migrar para SWR/TanStack Query ou qualquer lib de data-fetching nova —
  desproporcional ao tamanho real do bug.
- Unificar as 10 subrotas de `documento/[id]/*` para ler do contexto em vez
  de buscar por conta própria (eliminaria uma chamada duplicada) — ticket
  separado, sem gate fiscal, registrado como dívida abaixo.
- Badge da sidebar ficar velho após mutação **sem navegar** (ex.:
  `BlocoRetencao.onMudou` na própria tela) — o critério de aceite é sobre
  navegar de volta, não sobre a tela onde a mutação aconteceu.

## Gate Fiscal (Contador)
**Sem impacto fiscal.** Bug de arquitetura/reatividade (cache do shell de
gestão) — os dados gravados já estão corretos em todos os casos; o que
está errado é só a leitura em tela até F5. Não há regra de IRPF, INSS/SERO
ou documentação hábil envolvida.

## Pre-mortem
1. **Remendo por lembrança.** Corrigir chamando "invalidar contexto"
   manualmente em cada rota de mutação reintroduziria o bug na próxima
   rota nova que alguém escrever. Mitigação: a correção decidida
   (Viabilidade abaixo) é estrutural — vive no provedor, não em cada rota.
2. **Refetch excessivo deixando a navegação lenta.** Mitigação: critério 7
   define em termos técnicos concretos o que "não perceptivelmente mais
   lento" significa, para o `lead-engineer` não inventar um número.
3. **Cobertura parcial disfarçada de completa** (corrigir só as rotas
   "óbvias" e deixar outras de fora). Mitigação: critério 1 é sobre o
   grupo inteiro, não uma lista; critério 3 exige prova com um caso fora
   de `documento/[id]/*`.

## Viabilidade (CTO)
- **Fatos confirmados por leitura de código**: `ProvedorDeGestao` é 100%
  client-side — sem Server Component, Server Action, `revalidatePath`/
  `revalidateTag` nem `router.refresh()` em uso em nenhum lugar de `app/`
  ou `lib/`. Isso descarta `router.refresh()` como solução: ele só refaz
  payload de RSC e preserva estado de client component, então o `useState`
  do provedor continuaria com o dado velho.
- **Decisão: revalidação por mudança de rota, implementada DENTRO do
  provedor, com stale-while-revalidate.** Sem tocar em nenhuma rota de
  mutação, sem lib nova.
  1. `ProvedorDeGestao` passa a ler `usePathname()` (já usado em
     `shell.tsx`) e inclui `pathname` nas dependências do efeito de carga
     — toda navegação dentro do grupo refaz o fetch.
  2. **Não** zera para `fase: "carregando"` na revalidação por navegação:
     o `pronto` anterior continua na tela até o novo chegar (o cleanup
     `cancelado = true` já existente descarta resposta superada).
     `tentarDeNovo` continua sendo o único caminho que mostra loading.
  3. Falha na revalidação → `fase: "erro"` com `tentarDeNovo`, como hoje.
  4. Nada novo exposto no contexto — `revalidar()` sob demanda fica fora
     deste ticket (out of scope acima).
- **Por que não as alternativas**: (a) cada rota chamar `tentarDeNovo` —
  33 rotas e ~35 funções de escrita para lembrar, e o `tentarDeNovo` atual
  apaga o shell inteiro para loading a cada mutação; (b) sinal de mutação
  em `lib/data.ts` — ainda é "por lembrança" numa função nova, e não é
  testável sem mock; (c) SWR/TanStack Query — trocaria o padrão de
  fetching de ~30 telas por causa de um efeito com dependência faltando,
  dependência nova desproporcional.
- **Arquivos e complexidade — S**: `app/_components/gestao.tsx` (única
  mudança de produto, ~10 linhas + comentário explicando o motivo); E2E
  novo cobrindo o caso do relato **e** um caso fora de `documento/*`.
- **Dívida nova (registrar, não resolver aqui)**:
  - Mutação na própria rota sem navegar deixa o badge da sidebar velho até
    a próxima navegação — o critério do ticket (navegar de volta) não é
    afetado por isso.
  - As 10 subrotas de `documento/[id]/*` ainda buscam o painel por conta
    própria em vez de ler do contexto (o que o `CONTAI-045` já fez para
    `/compromisso`) — unificar eliminaria a busca 2× em toda entrada em
    `documento/[id]` (shell + página). Ticket separado, sem gate fiscal.

    ⚠️ **A magnitude, MEDIDA e não estimada** (Gate 2, 2026-09-25 — as duas
    contagens anteriores subestimavam: "4 chamadas do shell" no retorno do
    `lead-engineer` e "~11 em 3 ondas" na recontagem do `cto-obra`). Contado
    por `page.on("request")` sobre `/rest/v1/` no stack local, webkit:
    - **uma navegação qualquer dentro de `(gestao)` = 16 requisições em 4
      ondas sequenciais**, idêntico em `/` e em `/despesas`. A composição:
      onda 1 (5) `carregarObras` + `carregarPainelDePendencias`
      (`pendencia`, `pendencia_desfecho`, `revisao_ano_afetado`,
      `pagamento_documento`); onda 2 (1) o `carregarObra` de dentro de
      `carregarPainel`; onda 3 (7) o `Promise.all` de `carregarPainel`;
      onda 4 (3) `carregarCompromissos`. Com pendência que tenha revisão
      vinculada entram 2 a mais (`revisao`, `revisao_ano_afetado`).
    - **entrar em `documento/[id]` por link = 42 requisições** medidas em
      `next dev`, das quais 16 são o shell. O resto é a própria página, e
      vem **em dobro** porque o StrictMode do `next dev` invoca o efeito de
      montagem duas vezes — em produção o total cai para ~29 (16 + ~13).
      O `carregarPainel` inteiro aparece **3×** nesse rastro (1 do shell +
      2 da página): é exatamente a duplicação que a unificação mataria.

    Isto **não** é regressão deste ticket em uma navegação isolada — é o
    mesmo conjunto que já rodava na montagem (critério 7, com teste que
    conta). O que o ticket muda é a FREQUÊNCIA: antes 1× por sessão, agora
    1× por navegação. Quem priorizar a unificação decide com estes números.

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma — mecanismo de correção decidido pelo `cto-obra` na Viabilidade
acima, critérios de aceite já descritos como comportamento observável.

## Cenário e checagem final
**Gestão** — o bug afeta qualquer tela do grupo `(gestao)`, cenário
principal (em casa, sentado). Teste do Canteiro não se aplica (o grupo
`(captura)` não é afetado). **Veredito: APROVADO**, sem Gate 0 de design
(nenhuma mudança visível — é atualidade de dado, não UI nova).

✅ **Entregue em 2026-09-26.** 7/7 critérios PASS — Gate 4 (`po`). Fix de
9 linhas em `app/_components/gestao.tsx` (`ProvedorDeGestao` passa a
depender de `usePathname()`, com stale-while-revalidate — dado anterior
fica na tela até o novo chegar). Gate 2 técnico (`cto-obra`) aprovou direto
e pediu 2 ajustes pequenos: robustez de um teste (`expect.poll`, corrida
real entre KPI stale e o `GET obra` sair) e números medidos de verdade
(não estimados) para a dívida documentada — uma navegação normal em
`(gestao)` são 16 requisições em 4 ondas; entrar em `documento/[id]` soma
~29 esperadas em produção, por causa da duplicação já existente do
`carregarPainel` (StrictMode + busca própria da página). Sem Gate Fiscal
(sem impacto fiscal, confirmado no relato de origem). 1085 unitários +
317 E2E verdes, sem migration.
