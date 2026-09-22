# CONTAI-045 entregue — 2026-09-21 — compromisso e pendência migram para o shell

Terceiro dos 4 tickets de migração de telas de detalhe (`043`-`046`).
`compromisso` (lista) + `compromisso/[id]` (+ `cancelar`, `confirmar`,
`data`) e `pendencias/[id]` saem de `app/(captura)/` e entram em
`app/(gestao)/`, mesma casca dos tickets anteriores (coluna 640px). O
provedor do shell (`useGestao()`) ganhou `compromissos` (lista crua, sem o
corte de 3 da agenda) para `/compromisso` ler obra ativa/ano do contexto
em vez de repetir `carregarObras`+`escolherObraAtiva`.

Atenção reforçada do próprio ticket: `compromisso/[id]/confirmar` é a tela
que o CONTAI-034 corrigiu por um bug fiscal real (D65 — `cValor`
pré-preenchido com o saldo previsto). O `contador` conferiu com os
próprios olhos (não só o relato do lead) que a migração de casca não
reintroduziu o default: `useState("")` intacto, comentário histórico "NADA
DE PRÉ-PREENCHER O VALOR" preservado, `e2e/campos-fiscais.spec.ts` (19/19)
continua passando — a trava resolve rotas por URL, não por pasta, então a
mudança de route group não a confunde.

Três decisões do `cto-obra` no Gate 2, todas aceitas sem mudança de
código: `/compromisso` sem obra aberta virou banner âmbar consistente com
`/despesas`/`/pendencias` (era `throw`/erro antes — correção de
comportamento, não regressão); `/compromisso` mantém coluna de 640px em
vez de largura cheia (é a pilha de cards do dashboard, não uma view de
fila como `/pendencias` — esticar repetiria o achado do Gate 2 do
CONTAI-039); a duplicação `TresRespostas` + ações de página no detalhe de
agendamento vencido é pré-existente (já existia na casca de 430px),
preservada, fora de escopo deste ticket.

Testado: 887 unitários + 256/257 E2E (1 falha pré-existente,
`discriminacao.spec.ts:215`, do `CONTAI-046` futuro) + validação manual no
browser (D65 confirmada vazia na tela migrada, breadcrumb correto,
`/adicionar/*` intocado). Gate 4 (`po`) PASS, 6/6 critérios. Sem migration.
Último ticket da sequência: `CONTAI-046` (obras+terreno).

## Dívidas nomeadas

- `TresRespostas` (3 botões) + `data-acoes="agendamento"` (3 ações de
  página) convivem na mesma coluna do detalhe de agendamento vencido —
  seis controles para três ações. Fix sugerido pelo `cto-obra`: prop em
  `CabecalhoDoAgendamento` para omitir `TresRespostas` quando renderizado
  no detalhe (o cartão da home continua com as três). Pode entrar junto
  com o `CONTAI-046` ou como chore próprio.
- Comentário desatualizado (não corrigido agora, só registrado): o
  cabeçalho de `compromisso/[id]/page.tsx` cita "cancelar nunca no cartão
  da home" como regra viva, mas `TresRespostas` já linka `/cancelar`
  desde os critérios 43/49 do CONTAI-019/022.
