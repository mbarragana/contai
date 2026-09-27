# `CONTAI-069` entregue — Gate 4, 18/18 critérios PASS — 2026-09-27

## Contexto

Gate 4 (`po`) do `docs/tickets/CONTAI-069.md` — sugestão automática do gate
`cnoNaNota` a partir do CNO impresso no PDF, correspondência EXATA de dígitos.
Gate 1 (implementação) e Gate 2 (técnico + fiscal via `cto-obra`, 2 rodadas)
já fechados e aprovados antes desta rodada.

⚠️ **Esta feature existe por decisão do Mateus que sobrepõe a recomendação do
`contador`**, que reprovou a marcação automática duas vezes — a segunda já
sob a condição exata proposta pelo próprio Mateus. Está tudo documentado em
`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md` e
`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`. Este Gate 4 confirma
que a IMPLEMENTAÇÃO bate com os critérios do ticket — não reabre a discussão
de mérito, que não é deste agente.

## Verificação, critério por critério

Os 18 critérios do ticket foram lidos e conferidos contra o código real
(diff completo de cada arquivo tocado, não só a Viabilidade do ticket).
Resultado: **18/18 PASS**. Detalhe de cada um em
`docs/tickets/CONTAI-069.md` (checkboxes fechados + bloco final de entrega).

Dois achados nesta rodada, sem virar bloqueio:

1. **Critério 5 estava com texto desatualizado.** A redação original dizia
   "cadastro fora de formato → silêncio", mas o código (corretamente) exibe
   os dois números e o veredito `"diverge"` nesse caso — comportamento mais
   seguro do que silenciar (mostra o cadastro histórico errado em vez de
   parecer "a automação não funciona"). Texto do critério reescrito para
   bater com o código, citando o motivo. Ação pedida pelo Gate 2, executada
   aqui.
2. **Critério 14 (rederivação na troca de obra) não tem E2E dedicado.**
   Verificado por leitura de código (`comparacaoCno` é `useMemo` com
   `obra?.cno` na lista de dependências — qualquer troca de obra recalcula o
   veredito sem novo fetch nem novo parse). `TelaTrocarObra` não é exercitada
   por nenhum spec da suíte hoje — lacuna pré-existente, também presente no
   `CONTAI-062`, não introduzida por este ticket. Não bloqueia o Gate 4.

## `formato_invalido` — não implementado, virou dívida D87

O `contador` sugeriu, como possível melhoria futura, um estado separado
`formato_invalido` para distinguir "cadastro da obra fora do padrão de 12
dígitos" de "CNO da nota genuinamente diferente" — hoje os dois caem no
mesmo veredito `"diverge"`. **Não foi implementado neste ticket** (instrução
explícita: é melhoria futura, não critério de aceite). Registrado como
**D87** em `docs/backlog.md`, sem ticket e sem prioridade do Mateus.

## Testes

- `npx vitest run` — **1169/1169** (38 arquivos), como esperado.
- `npm run test:e2e` completo, stack local de pé — **369/369** (362
  pré-existentes + 7 novos em `e2e/captura-cno.spec.ts`, casos 7.1 a 7.7,
  cobrindo os seis cenários do critério 18 mais os critérios 12/13
  espelhados do `CONTAI-062`). Suíte inteira, um worker, ~6.2min, exit 0.
- `npm run typecheck` e `npm run lint` limpos.
- Equivalente completo de `npm run quality`, rodado em quatro comandos
  separados nesta sessão (o dev server local não estava de pé, então não
  havia conflito de porta).

## Arquivos alterados após o último APPROVE do `cto-obra`

Nenhum. Confirmado por `find . -newer e2e/captura-cno.spec.ts` (mtime
11:50:26, o último arquivo de implementação tocado) — só artefatos de
build/execução (`tsconfig.tsbuildinfo`, `next-env.d.ts`, `test-results/`)
são mais novos que ele, nenhum arquivo de código-fonte.

## O que fica

`070` (sugestão automática de `tributo`, mesma família de decisão) fica
sozinho na fila, pronto para `/develop`.
