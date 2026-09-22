# Decisão do `po` sobre o Gate 0 de captura desktop — 2026-09-22 — reconciliação entre `CONTAI-047`/`048` e `design/mocks/captura-no-desktop-v1.md`

## Contexto

O `po` escreveu `CONTAI-047`/`CONTAI-048` em 2026-09-22 a partir da consulta
técnica ao `cto-obra` (`docs/backlog/58-2026-09-22-captura-tela-larga-
contai-047-048.md`), sem ver ainda o Gate 0. Em paralelo, o `designer`
publicou `design/mocks/captura-no-desktop-v1.md` + `.html`. Os dois
documentos divergiam em três pontos e traziam duas perguntas do designer sem
resposta. Esta entrada fecha os cinco.

## 1 — Escopo do anexo: nem (a) fundir, nem (b) cortar — fronteira nova

Checagem física do mock (`grep` em `captura-no-desktop-v1.html`) mostrou que
o `.preview` do rail é uma **miniatura de 52×52px** (nome + tamanho +
"Trocar arquivo"), não um render legível do arquivo. Isso muda a pergunta:
a Decisão 3 do mock não é a mesma feature do `CONTAI-048` (que pede ler
CNPJ/valor/data no documento, ao lado do formulário) — é reposicionamento de
elementos que já existem (dropzone, botão de extração) mais um resumo
somente-leitura do que o usuário já digitou. Isso é reflow, cabe na
disciplina "zero mudança de campo/lógica" do `047`.

**Decisão**: o rail (miniatura + extração + resumo do digitado) entra no
escopo do `047`, criticado no critério 1a. O `CONTAI-048` continua vivo,
sem Gate 0, para a parte que de fato falta: render grande o bastante para
ler o documento. Os dois tickets ficam com fronteira escrita nos dois
arquivos, para ninguém reabrir a confusão depois.

## 2 — Takeover de tela cheia: confirmado com o `cto-obra`, é (a)

Perguntei ao `cto-obra` se a "moldura trocando" que o mock descreve exige
algum "modo" novo no `ShellDeGestao`. Resposta, conferida na árvore de
arquivos: **não** — `(gestao)/layout.tsx` e `(captura)/layout.tsx` são
layouts irmãos; o Next desmonta um e monta o outro na navegação, de graça,
sem estado nem código novo. É exatamente o que o `CONTAI-047` já mantinha em
Fora de Escopo (Pre-mortem 3 do `CONTAI-040`). Duas notas do `cto-obra`
registradas no ticket: a troca é um swap seco, sem animação de saída
(animar seria feature nova, cortada); o header "‹ Cancelar" é da página, não
do layout.

## 3 — Largura: ~900px, não 720px, por causa do rail

Como o rail (item 1) entrou no escopo, o teto de `documento/page.tsx` deixa
de ser os 720px que o `cto-obra` tinha sugerido antes de ver o mock — vira o
número do mock: grade `form+rail` até ~940px, colapsando para 1 coluna por
volta de ~860-880px. Sem breakpoint por página nesta rodada: o grupo inteiro
(`layout.tsx`) herda o mesmo valor; `pagamento`/`compra-cartao` não
precisam da largura toda, mas não ganham exceção própria.

## 4 — "Passo 2 de 3"/"Passo 3 de 3": D68, sem ticket

Confirmado no código (`app/(captura)/adicionar/documento/page.tsx:771` diz
"Passo 2 de 3", `:1197` diz "Passo 3 de 3" na mesma página de formulário; o
hub em `adicionar/page.tsx:20` fixa "Passo 1 de 3"). Inconsistência
pré-existente, não introduzida por este ticket nem pelo mock. Vira **D68**
no índice de dívidas — pequena, sem prioridade hoje, ticket quando o Mateus
priorizar.

## 5 — Rail em `pagamento`/`compra-cartao`: não, por ora

Mesma razão que já valia para o `CONTAI-048`: são fluxos mais curtos, sem
extração para conferir campo a campo. Registrado como corte explícito no
`Fora de Escopo` do `047`, não como omissão silenciosa.

## Efeito na fila

`CONTAI-047` está com Gate 0 fechado e as três perguntas do mock respondidas
— pronto para `/develop`. `CONTAI-048` continua fora da fila ativa,
"Depois", sem Gate 0 (a fronteira ficou mais clara, mas o desenho da feature
em si não avançou).

## Arquivos tocados
- `docs/tickets/CONTAI-047.md` — critérios 1/1a/1b, Fora de Escopo,
  Dependências, Pre-mortem 0
- `docs/tickets/CONTAI-048.md` — ressalva de fronteira na Dor de Origem,
  Dependências
- `docs/backlog.md` — D68 na tabela de dívidas; linha do estado vigente
- `docs/tickets/README.md` — `047` sai de "bloqueado por Gate 0", entra
  "pronto para `/develop`"
