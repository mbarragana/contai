# Reconciliação do CONTAI-009 — 2026-08-24 — o ticket já foi implementado por baixo do nome de outro

## O achado, antes das 4 perguntas do designer

O pedido era decidir 4 dúvidas de escopo deixadas no mock do CONTAI-009
(`design/mocks/CONTAI-009.md`, seção "Dúvidas", ~linha 82). Antes de decidir,
conferi o estado do código — e `/pagamento/[id]` **já existe**, com 461 linhas,
implementado como **critério 3 do `CONTAI-018`**
(`app/pagamento/[id]/page.tsx:120-124`, comentário do próprio arquivo:
*"Detalhe do pagamento — critério 3 do CONTAI-018... Até aqui só existia
`/pagamento/[id]/obra`... Esta tela é essa porta"*).

`CONTAI-018` nasceu de um incidente **independente** (2026-08-18, PIX
duplicado com NF, "Custo confirmado R$ 0,00") e, para resolver o vínculo
pagamento↔nota, construiu **a mesma tela** que o CONTAI-009 pedia — sem citar
o CONTAI-009 uma vez sequer no ticket, no parecer ou nos commits (`grep -rn
"CONTAI-009" docs/tickets/CONTAI-018.md` não bate). As duas dores do
CONTAI-009 (D20/D21 — "correção sem porta", "pagamento invisível") foram
resolvidas de carona.

**Consequência de processo**: `CONTAI-009` não aparece **em lugar nenhum** da
tabela de status do `docs/tickets/README.md` — nem entregue, nem pendente.
Caiu do radar entre a aprovação do mock (16/08) e a entrega do 018 (18/08), e
ninguém fechou o loop. É a mesma classe da D46/D48 (fato que devia estar no
mapa único e não está), do lado do backlog em vez do fiscal.

## Verificação dos critérios do CONTAI-009 contra o código de hoje

| Critério | Estado real (24/08) |
|---|---|
| 2 — campos + status | ✅ em produção: valor, data, meio, favorecido, obra, comprovante (`ListaDeAnexos`), chips via `lib/fiscal/pagamento.ts` |
| 3 — correção de obra alcançável | ✅ "Corrigir a obra deste registro" → `/pagamento/[id]/obra` |
| 4 — mesmo rótulo no documento | ✅ idêntico nas duas telas (grep confirma, `app/documento/[id]/page.tsx` e `app/_components/registrado.tsx`) |
| 5 — alcançável de onde o pagamento aparece hoje | ⚠️ parcial — ver decisões 1 e 4 |
| 6 — E2E registra→fecha→navega→corrige→afirma `obra_id` | ✅ coberto (`e2e/obra.spec.ts`, `e2e/vinculo.spec.ts`); a robustez transacional do lado do pagamento (espelho do que o `CONTAI-021` fez para documento) é o `CONTAI-008`, já **pronto para `/develop`** |
| 7 — sem soma entre obras | ✅ tela é de um registro só |

## As 4 decisões do designer

### 1 — Lista do grupo (`#s2`): CORTADA, não vira US-009

Motivo verificado, não hipótese: `lib/fiscal/resumo.ts` (seção 3, "exposição
por favorecido") já emite **um item por pagamento exposto**, com `href:
/pagamento/${p.id}`, renderizado em `app/page.tsx:479-487` como um botão **por
item** ("Ligar a uma nota — {data}") — vale para N=1 e para N>1 igualmente.
Isso nasceu no `CONTAI-018` (critério 3), **depois** do mock do CONTAI-009 ter
sido aprovado (16/08 → 18/08 dois dias depois): a suposição do designer ("o
card não tem id individual para linkar") era verdadeira quando ele desenhou e
deixou de ser verdadeira dois dias depois. Não há lacuna a fechar; não é corte
de escopo, é constatação de que o problema já foi resolvido por outro caminho.
`#s2` não entra neste ticket nem na US-009.

### 2 — Vocabulário do chip: o do mock, e já está em produção

`app/pagamento/[id]/page.tsx` usa `rotulosPagoSemNota(p.favorecidoTipo)` —
"Pago sem nota" (PJ) / "Pago sem recibo" (PF) / "Pago sem documento"
(indefinido) — e "Custo comprovado" (verde) para a parte coberta. Mesma fonte
(`lib/fiscal/pagamento.ts`) carimbada no Gate 2 do CONTAI-001. "aguardando NF /
conciliado" do critério 2 original nunca foi para produção.

### 3 — Anexar comprovante que faltou: fora de escopo, dor nova registrada (D56)

A produção confirma a decisão do mock: para `comprovantePath === null` a tela
mostra chip + consequência (`rotulosPagoSemComprovante`) e a frase "o que
falta é a prova" — **sem botão de anexar**. Continua "buraco visível > botão
inventado" até existir mock e parecer próprios. Não é US-010 (que é sobre
SERVIR um anexo existente) — é dor nova, ver D56 abaixo.

### 4 — Pagamento conciliado sem porta: opção (a), e é lacuna REAL hoje

Não é mais proposta — é bug verificado: `despesas[].href` em
`lib/fiscal/resumo.ts:625` aponta para `/documento/${doc.id}` (nunca para o
pagamento individual) quando uma despesa comprovada tem **mais de um**
pagamento vinculado. `/documento/[id]/page.tsx` não lista os pagamentos
vinculados a ele — só `/documento/[id]/obra` os enxerga, via
`pagamentosVinculados` (função já existe, já usada, não precisa ser escrita de
novo). Decisão: **(a)** — `/documento/[id]` passa a listar os pagamentos
vinculados, cada um linkando para `/pagamento/[id]`.

## Critérios prontos para colar

Substituem os critérios 2 e 5 originais do CONTAI-009 e acrescentam o 8:

> 2. [x] Existe `/pagamento/[id]` (já em produção via CONTAI-018), com: valor,
>    data efetiva do pagamento, favorecido, nome da obra por extenso, chip de
>    status — Pago sem nota (PJ) / Pago sem recibo (PF) / Pago sem documento
>    (indefinido) / Custo comprovado, vocabulário de
>    `lib/fiscal/pagamento.ts::rotulosPagoSemNota` — e o comprovante anexado
>
> 5. [ ] A tela é alcançável a partir de onde o pagamento aparece hoje: (a) a
>    home já linka cada pagamento pendente individualmente — a "exposição por
>    favorecido" (`lib/fiscal/resumo.ts` §3, herdada do CONTAI-018) emite um
>    botão por item, N=1 ou N>1; (b) para o pagamento CONCILIADO, a porta é o
>    critério 8 — hoje a home só leva ao documento
>
> 8. [ ] `/documento/[id]` lista os pagamentos vinculados a ele (reaproveita
>    `pagamentosVinculados`, já usado em `/documento/[id]/obra`), cada um
>    linkando para `/pagamento/[id]` — porta para o pagamento CONCILIADO que
>    hoje só é alcançável por SQL quando a despesa tem mais de um pagamento
>    (`lib/fiscal/resumo.ts:625` aponta só para o documento)

## Recomendação de status

`CONTAI-009` deveria ser fechado como **SUPERADO pelo CONTAI-018** em
`docs/tickets/README.md` — não edito essa tabela diretamente aqui: quem a
mantém é o fluxo `/develop`/`cto-obra`, e ela é o mapa único de status
(regra do próprio índice: "duplicar status nos dois faria os dois
divergirem"). O critério 8 acima é o **único trabalho vivo restante**;
recomendo migrá-lo para um ticket pequeno (complexidade S) em vez de reabrir o
009 inteiro — a maior parte dele já está entregue e não deve voltar para
`/develop` como se fosse net-new.

## Dor nova registrada

**D56 [P1 fricção]** — comprovante que falta em registro antigo (anterior à
obrigatoriedade do anexo) não tem caminho de correção pela interface; hoje só
o texto aponta o buraco (`app/pagamento/[id]/page.tsx`, bloco "pago sem
comprovante"). Não é US-010 (que é sobre servir um anexo já existente).
Precisa de mock próprio antes de virar critério, e checar com o `contador` se
anexo tardio carrega alguma exigência de rastro (data do anexo ≠ data do
registro) antes de aprovar o mock.
