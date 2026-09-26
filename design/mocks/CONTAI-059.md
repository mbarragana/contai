# CONTAI-059 — texto e cor da pendência de retenção refletem o estado real (A ≠ C)

Cenário: gestão (`/documento/[id]`, Home, `/pendencias`, `/despesas` — revisão
em casa, sentado; Teste do Canteiro não se aplica). Nível 3: só texto/cor
mudam, num componente e numa função já existentes. Sem campo, fluxo ou HTML.

## Telas e estados

Controlado por `motivo` da linha (`"sem_recolhedor"` = Estado A,
`"eu_sem_guia"` = Estado C, `null` = sem pendência) e, no card agregado, pela
regra de prioridade por documento (critério 6 / Pergunta 4 do parecer).

### (a) Banner por linha, `/documento/[id]` — `app/_components/retencao.tsx:379-385`

Layout intocado: um parágrafo (`<Consequencia>`) abaixo de "A recolher como",
acima de "Quem recolhe isto?". Muda a condição e o conteúdo:

| motivo | Antes | Depois |
|---|---|---|
| `sem_recolhedor` (A) | `cor="red"` + `CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR` | sem mudança |
| `eu_sem_guia` (C) | `cor="red"` + mesmo texto de A (bug) | `cor="amb"` + `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA` (texto novo) |
| `null` | sem banner | sem mudança |

(Sem chip nem título nesta superfície hoje — não se introduz um.)

### (b)+(c) Card agregado — Home, `/pendencias` e chip "sozinho"

Achado por leitura de código: Home e `/pendencias` já renderizam o **mesmo**
componente, `CardPendenciaDerivada` (`app/_components/pendencias-derivadas.tsx:78-95`),
alimentado por uma fonte única, `calcularResumo` em `lib/fiscal/resumo.ts`
(bloco 4, ~linha 770-806). `grep -rn "CHIP_RETENCAO_SEM_RECOLHEDOR" app/ lib/`
só acha a definição (`retencao.ts:209`) e este uso (`resumo.ts:783`) — não há
chip isolado em outro lugar. (b) e (c) do pedido são a mesma superfície; uma
tabela cobre as duas.

Hoje a função agrega por documento mas sempre monta o card com o conjunto de
A, pouco importa o motivo real das linhas abertas:

| Linhas abertas do documento | Antes | Depois |
|---|---|---|
| todas A | conjunto de A | sem mudança |
| mistura A + C | conjunto de A (hoje por acaso; vira regra) | conjunto de **A** — qualquer linha em A vence |
| todas C | conjunto de A (bug) | conjunto de **C**: `CHIP_RETENCAO_GUIA_PENDENTE` / `TITULO_RETENCAO_GUIA_PENDENTE` / `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA` / cor **âmbar** |
| nenhuma aberta | sem card | sem mudança |

Layout do card não muda (`Card`→`Chip`→título→`Dica`→`Consequencia`→botão); só
o conteúdo dos 4 campos (`chip`, `titulo`, `consequencia`, `gravidade`) que
`Pendencia` já expõe ao componente.

**Efeito colateral de graça**: `lib/fiscal/despesas.ts` (~linha 294-305,
`ORIGEM_DA_PENDENCIA.retencao_sem_recolhedor = "documento"`) anota a linha de
`/despesas` copiando `chip`/`consequencia` do mesmo `Pendencia` — propaga
sozinho, não é 4ª superfície. **4 estados** (loading/vazio/erro/sucesso): sem
mudança — as três superfícies só trocam texto/cor dentro do sucesso já
renderizado; o erro de gravação existente (`retencao.tsx:373-377`) é de outra
ação (salvar resposta) e não muda.

## Campos

- SEM CAMPOS — sem campo novo; a tela só muda o que mostra após a resposta já
  gravada. Nenhum controle, nenhum rótulo de campo, nenhum default tocado.

## Textos com consequência fiscal

Nenhum texto redigido aqui — tudo copiado literalmente da fonte indicada.

**Estado A (sem alteração)** — `CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR`,
`CHIP_RETENCAO_SEM_RECOLHEDOR`, `TITULO_RETENCAO_SEM_RECOLHEDOR`: já em
produção, texto e cor (vermelho) intocados.

**Estado C — parágrafo**, cópia literal de
`docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`, ADENDO 4,
"Pergunta 3" (~linha 804-813), constante `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA`:

> "Você já confirmou que quem recolhe esta retenção é você — a pendência
> aqui não é de identificação, é de pagamento: enquanto a guia não for paga
> e vinculada a este documento, esta fatia não entra no custo de aquisição
> do ano nenhum. Se a guia nunca for paga, o efeito não é apenas essa fatia
> ficar fora do custo para sempre — o valor retido se torna dívida
> tributária vencida em seu nome, sujeita a juros e multa."

**Estado C — chip e título**, texto de produto (não citação de parecer),
mesma fonte, "Continuação — 2026-09-26", "Pergunta 5" (~linha 841-866): chip
`CHIP_RETENCAO_GUIA_PENDENTE` = **"Guia de retenção pendente"**; título
`TITULO_RETENCAO_GUIA_PENDENTE` = **"Recolhedor confirmado — guia ainda não
paga"**. Ajustável em forma, preservando 2 fatos: não sugerir "sem confirmar"
(já foi) nem "resolvido"/"quitado" (risco de a guia nunca ser paga segue de pé).

**Estado C — cor**, mesma fonte, "Pergunta 6" (~linha 868-898): âmbar
(`cor="amb"`/`border-amb`), nunca vermelho, nunca verde/neutro — token já
existente no design system, roteado por `lib/fiscal/gravidade.ts`.

## Navegação

Sem mudança — "Ver detalhes" continua indo a `/documento/[id]` nos dois estados.

## Decisões de design e perguntas abertas

(b) e (c), pedidas separadas, são na prática uma só superfície
(`CardPendenciaDerivada` + `resumo.ts`). Nenhuma lacuna além dos 9 critérios
de aceite — "Perguntas Abertas: Nenhuma" do ticket se confirma no design.
