# CONTAI-047 entregue — 2026-09-23 — captura ganha casca de tela larga

Fecha o ciclo que o `CONTAI-040` tinha deixado em aberto por decisão
explícita: `app/(captura)/adicionar/*` (documento, pagamento, compra no
cartão), `adicionar/page.tsx` (hub), `obras/nova` e `conta` ganham
tratamento de tela larga, sem sair do route group `(captura)` — decisão
técnica do `cto-obra`, mantida do Gate 0 (mover para `(gestao)` traria
chrome de gestão para dentro do canteiro e duplicaria "obra ativa").

## O que mudou

- `app/(captura)/layout.tsx` ganha um segundo teto (`larga:max-w-[940px]`,
  breakpoint `larga` = 880px em `app/globals.css`), ao lado do piso de
  430px que continua existindo.
- `documento/page.tsx` ganha a grade `formulário + rail`
  (`GradeDaCaptura`, `app/_components/captura.tsx`): a coluna auxiliar
  reposiciona o anexo/preview/"Trocar arquivo", o botão de extração
  (Gemini) e um resumo somente-leitura do já afirmado (Tipo, Emitente,
  Valor, Nota no seu CPF?, CNO impresso) — cada linha "ainda não
  respondido" em itálico até existir resposta. `lib/fiscal/documento.ts`
  ganhou `resumoAfirmado` (função pura, testada) e os rótulos
  (`ROTULO_DO_TIPO`, `ROTULO_DO_CNO_NA_NOTA`, `ROTULO_DA_RESPOSTA_CPF`) num
  lugar só, para o resumo nunca divergir do texto do botão marcado.
- Os três formulários ganham `CamposCurtos` (grid de 2 colunas a partir de
  `larga`) para campos escalares curtos (datas, valor, número, série,
  meio). Bloco de pergunta fiscal (`Escolha` + texto de consequência)
  continua em coluna única — mesma lição de legibilidade do Gate 2 do
  `CONTAI-039`.
- `PassosDaCaptura`: stepper horizontal decorativo (`aria-hidden`, não
  clicável), só a partir de `larga`, ao lado do "Passo X de Y" que as
  telas já diziam.
- `/entrar` se autolimita a 430px com wrapper próprio, isolado do
  breakpoint do grupo.
- `Registrado` (confirmação de sucesso) e as saídas de agendamento
  continuam levando a rotas de `(gestao)` (com shell) — ninguém fica preso
  numa tela de captura sem chrome depois de chegar por um clique no
  dashboard.

## Gates

- **Gate 1** (`lead-engineer`): implementado; um commit de acabamento
  fechou 5 pendências do Gate 2 antes da reconfirmação.
- **Gate 2 técnico** (`cto-obra`): APPROVE, reconfirmado por escrito depois
  do commit de acabamento — "diff final ainda bate com o APPROVE".
- **Gate 2 fiscal** (`contador`): APROVADO, reconfirmado por escrito com
  comparação byte a byte de `lib/fiscal/documento.ts` e das 3 telas —
  nenhuma string fiscal mudou.
- **Gate 3** (orquestrador, validação manual no navegador): takeover de
  tela cheia, rail espelhando o formulário em tempo real, texto de
  consequência fiscal inline em coluna única, colapso no piso de 375px
  (stepper e resumo somem via `display:none`, anexo sobe para o topo,
  coluna de 430px), "Cancelar" volta limpo ao shell de gestão.
- **Gate 4** (`po`, este): PASS, 11/11 critérios. 933 unitários + 284 E2E
  verdes (suíte rodada 2x), typecheck e lint limpos.

## Quatro divergências deliberadas do mock/critério literal — decisões, não pendência

Todas julgadas e aprovadas pelo `cto-obra` no Gate 2:

1. **Hub ganhou `.hub-grid` novo** em vez de "sem mudança de código"
   (texto do critério 4) — leitura certa do critério, que também exige os
   3 cartões "legíveis (não esticados)" na largura nova, e isso não sai de
   graça sem grade.
2. **Resumo do rail fica oculto** (não "sempre visível", como a Decisão 5
   do mock desenhava) abaixo de 880px — o critério 10 ("375px continua
   sendo piso obrigatório testado") vence a fidelidade ao protótipo:
   leitura nova acima do formulário é fricção no único momento em que o
   produto promete pressa.
3. **Stepper decorativo coexiste** com o "Passo X de Y" antigo em vez de
   substituí-lo, e não entra em `/obras/nova` — correto dado que o
   critério 3 proíbe mudar texto/número de passo. A incoerência
   pré-existente "Passo 2 de 3"/"Passo 3 de 3" em `documento/page.tsx`
   permanece **D68**, sem ticket, fora desta rodada.
4. **`design/mocks/captura-no-desktop-v1.md` ajustado só de formatação**
   (`- SEM CAMPOS —`) para não quebrar um teste que já quebrava na `main`
   antes deste ticket — não é mudança de conteúdo do spec.

## O que não mudou (confirmado)

Disciplina fiscal em qualquer largura: campo vazio pergunta, nenhum
default em campo fiscal, anexo obrigatório no ato do registro (diálogo
§A.7.1). Nenhum texto de consequência fiscal (quarentena, gate de retenção,
CNO sem obra, vínculo) mudou uma palavra ou migrou para o rail — o rail
só espelha o já confirmado, nunca é onde uma pendência aparece pela
primeira vez.

## O que fica de fora

`CONTAI-048` (renderizar o documento grande o bastante para ler e conferir
CNPJ/valor/data) continua sem Gate 0, feature nova — não casca — e segue
fora da fila ativa. Rail não se estende a `pagamento`/`compra-cartao`
(decisão do `po` no Gate 0, fluxos mais curtos, sem extração).

Sem migration. Ticket: `docs/tickets/CONTAI-047.md`.
