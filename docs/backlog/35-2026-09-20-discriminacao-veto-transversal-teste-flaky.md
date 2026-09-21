# `e2e/discriminacao.spec.ts:215` vermelho — é o TESTE, não o veto fiscal

**Correção do diagnóstico do Gate 2 do CONTAI-005.** O `cto-obra`, revisando o
CONTAI-005, achou `e2e/discriminacao.spec.ts:215` (teste "(c) compromisso
vencido sem resposta: a saída NÃO sai") vermelho já na árvore antes do
CONTAI-005 (confirmado por `git stash` na base `3481cd9`) e concluiu que era
"o veto transversal do CONTAI-036 não dispara com compromisso vencido sem
resposta — erro fiscal silencioso na saída anual", recomendando ticket
próprio com prioridade P0.

**Investigado a fundo antes de abrir esse ticket — o diagnóstico estava
errado.** `podeGerarRelatorioAnual` (`lib/fiscal/compromisso.ts`) está
correto: 40+ testes unitários (`compromisso.test.ts`) cobrem
`ehVencidoSemResposta` e o veto transversal, todos verdes. O bug é no
**helper do teste**, `e2e/discriminacao.spec.ts` linha ~217:

```ts
const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
```

`toISOString()` é sempre UTC. `hojeIso()` (`lib/hoje.ts`), que o app usa de
verdade, é no **fuso local** (Brasil, UTC−3), de propósito — comentário no
próprio arquivo explica por quê (regime de caixa não pode trocar de dia perto
da meia-noite). Rodando o teste entre ~21h e 23h59 local, o relógio UTC já
virou o dia seguinte: `Date.now() - 86_400_000` em UTC cai no dia de HOJE em
horário local, não em ontem. `dataPrevista` grava "hoje", `hojeIso()` também
devolve "hoje", `dataPrevista < hojeIso` é falso, `ehVencidoSemResposta`
devolve `false`, e a saída sai — não porque o veto falhou, mas porque o
compromisso criado pelo teste nunca esteve de fato vencido.

Reproduzido isolando a causa: às 22:01 local (01:01 UTC do dia seguinte), o
helper calcula `ontem = "2026-09-20"` (= hoje local), enquanto `hojeIso()`
também devolve `"2026-09-20"`. Testado às 22h; falha **depende do horário em
que a suíte roda**, não do dia.

## Correção sugerida (fora do escopo desta verificação, não aplicada aqui)

Trocar o cálculo de "ontem" no teste para fuso local, espelhando `hojeIso()`,
em vez de `toISOString()`. É uma linha no teste, não requer parecer do
`contador` nem ticket de produto — é dívida de qualidade de teste.

## Não vira D-número de bug fiscal

Como não há defeito na regra fiscal nem no produto, isto NÃO é uma dívida
fiscal (D-série): é um lembrete de manutenção de teste. Registrado aqui só
para a próxima pessoa que vir esse teste vermelho não repetir o diagnóstico
de "bug em produção" e abrir um ticket sobre um problema que não existe.
