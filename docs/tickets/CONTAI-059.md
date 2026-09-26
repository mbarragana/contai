# CONTAI-059 Texto e cor da pendência de retenção refletem o estado real (A ≠ C)

## Tipo e Prioridade
bug — P1 — texto e cor de consequência fiscal incorretos exibidos ao
usuário. O dado gravado já está certo (custo de aquisição não muda); o que
está errado é a tela descrever mal um risco que já mudou de natureza.

## Dor de Origem
`docs/backlog/73-2026-09-26-texto-pendencia-retencao-e-escopo-ano-despesas.md`,
US-A. Citação literal do Mateus: *"isso aqui não está correto, eu coloquei
que quem deve pagar aquilo ali sou eu, logo, se sabe quem vai pagar, eu só
não paguei ainda."* — reação ao banner genérico
(`CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR`) mostrado mesmo depois de já ter
confirmado "Eu" para "Quem recolhe isto?".

## User Story
Como dono da obra revisando uma linha de retenção em casa, sentado, ao
confirmar "Eu" para "Quem recolhe isto?" enquanto a guia ainda não foi
paga, quero ver um texto e uma cor que descrevam corretamente que a
pendência é de PAGAMENTO da guia — não de identificação de quem recolhe —
para não desconfiar de um dado que já registrei certo.

## Critérios de Aceite
1. [ ] Estado C (`quem_recolhe = "eu"` e `notaCoberta = false`): a tela
   mostra `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA`, cópia literal da
   "Continuação — 2026-09-26" do ADENDO 4 de
   `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` — nunca
   parafraseado.
2. [ ] Estado A (`quem_recolhe` sem resposta útil, na prática `null`/
   `"nao_sei"`): a tela continua mostrando
   `CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR`, sem alteração de texto nem de
   cor (continua vermelho).
3. [ ] Estado "empresa": nenhum banner de pendência é exibido — comportamento
   atual de `linhaSemRecolhedor` (retorna sem pendência para esse valor) já
   está correto; este ticket não cria nem altera texto para ele.
4. [ ] Chip e título da pendência também ganham variante para o Estado C
   (ratificado pelo contador — corrigir só o parágrafo criaria uma
   contradição nova e mais visível entre título e corpo): chip **"Guia de
   retenção pendente"**, título **"Recolhedor confirmado — guia ainda não
   paga"** (texto de produto, ajustável em forma desde que preserve os dois
   fatos: não sugerir "sem confirmar" e não sugerir "resolvido"). Estado A
   mantém chip/título atuais (`CHIP_RETENCAO_SEM_RECOLHEDOR`/
   `TITULO_RETENCAO_SEM_RECOLHEDOR`), sem alteração.
5. [ ] Gravidade/cor do Estado C muda de vermelho para **âmbar**
   (`gravidade.ts`) — ratificado pelo contador como o próprio parecer que a
   dívida D54 exigia para justificar a mudança: vermelho carrega o
   significado "passivo não identificado", que o ADENDO 4 já havia dito não
   se aplicar ao Estado C. Estado A continua vermelho — é o único caso
   desta família de pendência que ainda é "passivo não identificado".
6. [ ] Card na Home/Despesas (pendência é por DOCUMENTO, não por linha —
   um documento pode ter uma linha em Estado A e outra em Estado C ao
   mesmo tempo): se **qualquer** linha aberta do documento é Estado A, o
   card mostra o conjunto de texto/cor de A; só quando **todas** as linhas
   abertas estão em Estado C, mostra o conjunto de C. Ratificado pelo
   contador — não é escolha estética, A é o caso mais grave (risco de
   terceiro em aberto) e o card-resumo mostra o pior caso, sem inventar um
   terceiro texto "misto".
7. [ ] Teste unitário (Vitest) cobre: os dois estados isolados (texto, chip,
   título, cor); o caso documento com linha A + linha C simultâneas
   (card mostra o conjunto de A); estado "empresa" sem pendência, sem
   mudança.
8. [ ] `linhaSemRecolhedor` (quando a pendência abre/fecha) e
   `retencaoContaComoPerna`/`alocarCusto` (quando a retenção conta como
   custo) não sofrem nenhuma alteração — trava de que o custo de aquisição
   e o mecanismo de fechamento da pendência não mudam com este ticket, só
   o texto/cor exibidos.
9. [ ] Gate Fiscal: revisão do `contador` confirma que os textos em
   produção (parágrafo, chip, título) são fiéis ao ADENDO 4/continuação, e
   que a mudança de cor está correta.

## Out of Scope
- Alterar `linhaSemRecolhedor` — mecanismo já corrigido/decidido no
  `CONTAI-056`; este ticket só troca texto/cor exibidos.
- Qualquer mudança no cálculo de custo de aquisição (`lib/fiscal/vinculo.ts`,
  `lib/fiscal/despesas.ts`).
- `CONTAI-060` (escopo de ano em `/despesas`) — achado 2 do mesmo relato,
  causa técnica diferente, ticket separado.
- Alerta ativo (ex.: lembrete de calendário) para "guia nunca paga" — fora
  do texto do card, hipótese de solução não relatada.

## Gate Fiscal (Contador)
Fonte: `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`, ADENDO 4
+ "Continuação — 2026-09-26" (resposta aos 4 pontos do Gate 2 do
`cto-obra`, nesta ticket e no `CONTAI-060`).

1. **Prioridade do card**: se qualquer linha aberta é Estado A → card
   mostra texto/cor de A; só com todas em C → card mostra texto/cor de C.
   Razão: A é problema de fundamento (retenção pode não ter base legal,
   risco de terceiro em aberto); C já superou isso, só falta pagar a guia
   — resumo correto de um documento misto é o do pior caso, não um
   terceiro texto inventado.
2. **Chip/título entram no escopo**: corrigir só o parágrafo e deixar
   título/chip afirmando "sem confirmar quem recolhe" cria contradição
   nova dentro do mesmo card — pior que o bug original relatado. Redação
   dada acima (critério 4), ajustável em forma pelo `designer`/`cto-obra`
   desde que preserve os dois fatos fiscais.
3. **Cor**: Estado C vira âmbar, nunca vermelho nem verde/neutro — o risco
   de dívida tributária futura (se a guia nunca for paga) é real, então não
   é "resolvido"; mas não é mais "passivo não identificado" (isso já foi
   identificado: é o próprio Mateus). Vermelho fica exclusivo do Estado A
   nesta família de pendência.

## Pre-mortem
1. Alguém "aproveita" o ticket para mexer em `linhaSemRecolhedor` — critério
   8 trava isso; revisor confere que o diff toca só texto/cor/componente.
2. Texto novo sai parafraseado — critério 1 exige cópia literal do ADENDO 4,
   Gate Fiscal confere.
3. A regra de prioridade do card (critério 6) é esquecida e o
   `lead-engineer` escolhe sozinho qual texto mostrar num documento misto —
   mitigado por virar critério formal, não deixado para depois.

## Viabilidade (CTO)
- **Onde entra a condição**: módulo puro, não no componente. Função nova
  `motivoDaRetencaoAberta(linha, notaCoberta): "sem_recolhedor" |
  "eu_sem_guia" | null` ao lado de `linhaSemRecolhedor` em
  `lib/fiscal/retencao.ts` (que passa a ser
  `motivoDaRetencaoAberta(...) !== null` — os 7 testes existentes
  continuam passando sem tocar em nada). Ao lado, um
  `Record<Motivo, {consequencia, chip, titulo, gravidade}>` mapeando os
  dois estados. Decisão "abre?" e "qual texto/cor?" ficam no mesmo
  arquivo, testáveis sem render.
- **`notaCoberta` já chega ao banner**: `Repeater` (`retencao.tsx`) já
  chama `linhaSemRecolhedor(linha, notaCoberta)`; a prop booleana `aberta`
  vira `motivo: Motivo | null`, e o componente lê o mapa. Nenhuma prop nova
  desce de `page.tsx`.
- **Outros lugares que renderizam o mesmo texto**: `lib/fiscal/resumo.ts`
  (card da Home, a pendência é por documento) e `lib/fiscal/despesas.ts`
  (copia `pendencia.consequencia` do resumo — corrigir o resumo corrige
  Despesas de graça). É onde a regra de prioridade do critério 6 se aplica
  — `resumo.ts` precisa agregar o motivo mais grave entre as linhas do
  documento antes de escolher texto/chip/cor.
- **Arquivos e complexidade**: `lib/fiscal/retencao.ts` (+função +mapa),
  `lib/fiscal/retencao.test.ts` (motivo por estado + literalidade),
  `app/_components/retencao.tsx` (prop e leitura do mapa),
  `lib/fiscal/resumo.ts` + `resumo.test.ts` (agregação por documento, caso
  misto A+C), `lib/fiscal/gravidade.ts` (cor por motivo, não mais fixa),
  `e2e/retencao.spec.ts` (asserção do texto/cor novos em
  `/documento/[id]` e em `/pendencias`). **S**, vira **M** com a agregação
  por documento em `resumo.ts`.
- **O que NÃO fazer**: não criar um segundo `notaCoberta` no componente
  (já causou bug antes); não tocar em `retencaoContaComoPerna`/
  `alocarCusto` — este ticket é só texto/cor.
- **Dívida nova: nenhuma.**

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma — os 4 pontos que a Viabilidade levantou foram todos ratificados
pelo `contador` (ver Gate Fiscal acima).

## Cenário e checagem final
**Gestão** — revisão de documento/pendências é o cenário principal (em
casa, sentado). Teste do Canteiro não se aplica. **Veredito: APROVADO**,
Gate 0 fechado em `design/mocks/CONTAI-059.md` (nível 3, tabela
antes/depois). Achado do `/design`: as superfícies (b) "card agregado" e
(c) "chip resumido" do critério original são a MESMA superfície (mesmo
componente `CardPendenciaDerivada`, mesma função `calcularResumo`) — spec
trata como um bloco só, não como lacuna. Cor âmbar confirmada como token
já existente no design system (`cor="amb"`), não inventada. Pronto para o
Gate 1.
