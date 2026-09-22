# CONTAI-044 Pagamento e Fatura — detalhe migra para o shell de gestão

## Tipo e Prioridade
chore/refactor de UI — **P1, fricção de processo**. Mesma natureza do
`CONTAI-043`: move rota, redesenha layout, texto fiscal intocado. **Segundo
dos quatro tickets** da dívida do `CONTAI-040` (ordem sugerida: `043` →
`044` → `045` → `046`).

## Dor de Origem
Mesma dívida nomeada em `app/(captura)/layout.tsx` (ver `CONTAI-043`). Seams
concretos já em produção: `resumo.despesas[].href` (consumido pelo stub de
`/despesas`, `CONTAI-041`) aponta para `/pagamento/[id]` quando a despesa
comprovada nasceu de um PIX/boleto direto, e o "Ver o pagamento" entregue
pelo `CONTAI-037` em `/documento/[id]` (já migrado no `CONTAI-043`) leva
para lá também. `/fatura/[id]` é o destino de qualquer compra no cartão
(`CONTAI-022`) — hoje só alcançável a partir de uma tela que, depois do
`043`, já estará dentro do shell.

## User Story
Como dono da obra conciliando um PIX/boleto com a nota ou fechando/alocando
a fatura do cartão do mês, quero abrir `/pagamento/[id]` ou `/fatura/[id]`
dentro do mesmo shell de gestão — sem trocar de casca no meio da
conciliação.

## Escopo e Critérios de Aceite

**✅ Entregue em 2026-09-21, 5/5 critérios.** `pagamento/[id]` e `fatura/[id]`
(+ subrotas) migraram para o shell, coluna 640px (mesma do `043`).
`fatura/[id]/alocar` resolvido sem exceção de largura (lista label+checkbox,
não tabela). Gate 2 (`cto-obra` + `contador`) APPROVE sem retrabalho. 883
unitários + 252/253 E2E (1 falha pré-existente, `discriminacao.spec.ts:215`)
+ validação manual. Gate 4 (`po`) PASS. Sem migration. Implementado em
Sonnet (instabilidade momentânea do Opus) — sem efeito no contrato de
revisão, confirmado pelo `cto-obra`.

1. Mover para `app/(gestao)/`: `pagamento/[id]` (+ `ligar`, `obra`) e
   `fatura/[id]` (+ `alocar`, `confirmar`, `parcial`). Comportamento
   idêntico, casca nova — mesma técnica do `CONTAI-040`.
2. Coluna ~560px para as telas de formulário simples (`pagamento/[id]`,
   `pagamento/[id]/ligar`, `pagamento/[id]/obra`, `fatura/[id]/confirmar`).
   **Pergunta aberta para o `designer`**: `fatura/[id]/alocar` tem uma tabela
   de desembolsos/linhas de alocação do rotativo mais densa que um formulário
   simples — decidir no Gate 0 se ela cabe em 560px ou se é a exceção
   nomeada que usa mais largura (com justificativa registrada, não conforto
   de layout).
3. Nenhum texto fiscal muda — mesma prova de aceite do `CONTAI-043`
   (comparação byte a byte do texto renderizado, sem reescrita).
4. Sidebar, obra ativa e ano lidos de `useGestao()`, nunca uma segunda leitura
   própria da tela.
5. `375px` deixa de ser piso obrigatório (cenário gestão). `/adicionar/
   pagamento` e `/adicionar/compra-cartao` (captura) continuam intocados.

## Fora de Escopo
- Mudar `lib/fiscal/fatura.ts` (matemática de alocação do rotativo) — só a
  casca muda.
- `/adicionar/*` — intocado.
- O corte de escopo já registrado do `CONTAI-022` (`/fatura/[id]/alocar` só
  funciona chegando via `?desembolso=`) não é revisitado aqui.

## Gate Fiscal (Contador)
Sem regra fiscal nova. Conferência do `contador` no Gate 2: nenhum texto de
consequência (retenção, CNO, aviso de vínculo) mudou no reflow.

## Pre-mortem
1. **Mesmo risco do `CONTAI-043` item 1**, espelhado: pagamento vinculado a
   uma obra diferente da obra aberta na sidebar precisa continuar mostrando
   a obra certa sem forçar troca de contexto.
2. **Tabela de alocação da fatura espremida em 560px** vira ilegível em vez
   de mais legível — é exatamente o erro que motivou a régua de 560px em
   primeiro lugar (esticar não ajuda, mas espremer uma tabela densa em coluna
   estreita demais é o erro oposto). Por isso a pergunta 2 do escopo é
   aberta ao `designer`, não decidida por padrão.

## Dependências
- **Gate 0 RESOLVIDO em 2026-09-21**: mesmo spec "detalhe dentro do shell"
  (`design/mocks/detalhe-no-shell-v1.md`/`.html`, coluna 640px)
  do `CONTAI-043`, mais a pergunta específica da alocação de fatura (item 2
  do escopo).
- Não bloqueia nem é bloqueado pelos irmãos `043`/`045`/`046`.

## Cenário e checagem final
**Gestão** — em casa, sentado, conciliando. O "Teste do Canteiro" não se
aplica.
