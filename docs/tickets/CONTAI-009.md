# CONTAI-009 — Detalhe do pagamento, com a correção de obra alcançável a partir dele

## ✅ SUPERADO pelo CONTAI-018 — fechado em 2026-08-24

**Este ticket foi implementado sem citar o próprio nome.** `/pagamento/[id]`
existe em produção desde 18/08 — construído como critério 3 do `CONTAI-018`
(incidente independente, 2 dias depois do mock deste ticket ter sido
aprovado), sem nunca referenciar o `CONTAI-009`. As duas dores de origem
(D20, D21) foram resolvidas de carona. Reconciliação completa, critério a
critério, em `docs/backlog/29-2026-08-24-reconciliacao-contai-009.md`.

Os 4 pontos que o `designer` deixou em aberto no mock (`design/mocks/CONTAI-009.md`
"Dúvidas") foram fechados no mesmo dia:
- **Lista do grupo (`#s2`)**: não entra em lugar nenhum — o `CONTAI-018`
  resolveu isso de outro jeito (a home já linka cada pagamento pendente
  individualmente).
- **Vocabulário do chip**: o do mock, e já está em produção
  (`rotulosPagoSemNota`).
- **Anexar comprovante que faltou**: fora de escopo, virou dívida nova
  **D56** (mock e parecer próprios, quando priorizado).
- **Pagamento conciliado sem porta**: é bug real, verificado no código —
  virou o único trabalho vivo restante (ver critério 8 abaixo, migrado para
  ticket próprio).
- **Textos fiscais** (`#s12` prazo de guarda, `#s7` regime de caixa, `#s6`
  favorecido ausente) — os 3 ratificados pelo `contador` em 2026-08-24: o
  primeiro já estava certo (reaproveitava o texto do `CONTAI-030`), o segundo
  confirmado sem alteração, o terceiro trocado (recusada a exceção de
  "preencher favorecido vazio" — vira ticket próprio se a dor se confirmar).

**Critérios 2 e 5, texto final reconciliado contra o código de hoje:**

> 2. [x] Existe `/pagamento/[id]` (já em produção via CONTAI-018), com: valor,
>    data efetiva do pagamento, favorecido, nome da obra por extenso, chip de
>    status — Pago sem nota (PJ) / Pago sem recibo (PF) / Pago sem documento
>    (indefinido) / Custo comprovado, vocabulário de
>    `lib/fiscal/pagamento.ts::rotulosPagoSemNota` — e o comprovante anexado
>
> 5. [x] A tela é alcançável a partir de onde o pagamento aparece hoje: (a) a
>    home já linka cada pagamento pendente individualmente — a "exposição por
>    favorecido" (`lib/fiscal/resumo.ts` §3, herdada do CONTAI-018) emite um
>    botão por item, N=1 ou N>1; (b) para o pagamento CONCILIADO, a porta é o
>    critério 8 — hoje a home só leva ao documento

**Não fica aberto neste ticket** — o único trabalho vivo (a porta que falta
para o pagamento conciliado quando um documento tem mais de um pagamento
vinculado) foi migrado para um ticket pequeno próprio (S, P1), para não
reabrir os ~90% já entregues como se fossem net-new.

---

## Tipo e Prioridade (histórico, como escrito originalmente)
feature — **P0, DENTRO da R1**.

**Este ticket não é feature nova: é a metade não cumprida do critério 13 do
CONTAI-003.** O critério pede a correção de obra *"com a correção visível no
detalhe do documento/pagamento"*. Ela ficou visível no detalhe do **documento**
(`/documento/[id]` existe). No **pagamento** não ficou, porque **não existe
tela de detalhe de pagamento em lugar nenhum do app** — `/pagamento/[id]/obra`
só é alcançável pela tela de "salvo"; fechada ela, só por URL digitada.

Sai como ticket separado por um motivo só: **precisa de mock** (premissa
mock-first do CLAUDE.md), e enxertar tela nova no CONTAI-003 durante a
implementação seria o desvio de mock que o Gate 2 já carimbou com ressalva.

**A regra de admissão que eu aplico aqui, e ela é nova**: *critério de aceite
de item da R1 que não foi cumprido volta como ticket da R1*. Sem essa regra,
"fatiar o que não coube" vira a porta por onde a R1 encolhe no papel e a dívida
some do radar.

## Dor de Origem
Review técnico do `cto-obra` no Gate 2 do CONTAI-003 (ressalva R2, 2026-08-10).

A dor de fundo é a **D15**, já catalogada no Relato 003 e classificada
**P0 fiscal**: *"erro de obra é descoberto tarde e não tem conserto pela
interface"*. O CONTAI-003 matou a D15 para documento e a deixou viva para
pagamento — e pagamento é justamente o registro do fluxo que o Mateus mais usa
hoje (PIX para a AJE sem nota, Relato 002).

Agravante que torna isto pior do que "falta um atalho": **sem tela de detalhe,
o pagamento salvo some da interface**. Ele não é só incorrigível — é
**invisível**. O Mateus não descobre o erro tarde; ele não descobre. É o mesmo
achado da US-009 ("o que já foi registrado some depois de salvo"), aqui com
consequência fiscal direta em cima do `obra_id`.

Dores extraídas:
- **D20 [P0 fiscal]** — pagamento com `obra_id` errado é irrecuperável pela
  interface depois que a tela de "salvo" é fechada; volta a exigir SQL, que é a
  **D9 pela porta dos fundos**
- **D21 [P1 fricção]** — pagamento salvo não tem tela que o mostre; conferir
  exige abrir o banco

## User Story
Como dono da obra, quero abrir um pagamento que já registrei, ver em qual obra
ele entrou e corrigir dali se estiver errado, para que um PIX registrado com
pressa não fique preso no imóvel errado até a hora da declaração.

## Critérios de Aceite
1. [x] **Mock APROVADO pelo Mateus em 2026-08-16** —
       `design/mocks/CONTAI-009.html`, v1.
       Escopo do mock: (a) detalhe do pagamento; (b) o ponto de entrada para
       `/pagamento/[id]/obra` dentro dele. A tela de correção em si **já está
       aprovada** no mock do CONTAI-003 e **não se redesenha**.
       ⚠️ **A aprovação é do desenho e do fluxo. NÃO fecha as 5 perguntas em
       aberto** que o `designer` deixou marcadas — duas delas mudam o escopo do
       ticket e uma exige o `contador`. Gate 0 satisfeito **não** torna este
       ticket elegível para `/develop` enquanto as perguntas 1, 2 e 5 (abaixo,
       em "Perguntas Abertas") estiverem sem resposta: a tela 2 (lista do grupo)
       e a tela 14 (pagamentos vinculados no detalhe do documento) foram
       desenhadas **como proposta**, e podem não sobreviver
2. [x] ~~Existe `/pagamento/[id]`...~~ — ver texto reconciliado no topo do arquivo.
3. [x] A partir desse detalhe, a **correção da obra** (`/pagamento/[id]/obra`,
       já implementada) é alcançável **sem digitar URL** — fecha o critério 13
       do CONTAI-003 para pagamento. Confirmado em produção, 24/08.
4. [x] O mesmo ponto de entrada existe no detalhe do **documento** e a
       nomenclatura é idêntica nos dois. Confirmado por `grep`, 24/08.
5. [x] ~~A tela é alcançável a partir de onde o pagamento aparece hoje...~~ —
       ver texto reconciliado no topo do arquivo.
6. [x] E2E: registrar pagamento, **fechar a tela de salvo**, chegar ao detalhe
       pela navegação, corrigir a obra e afirmar o **`obra_id` gravado**.
       Coberto por `e2e/obra.spec.ts` e `e2e/vinculo.spec.ts`, confirmado
       24/08.
7. [x] Nada de valor somado entre obras nesta tela — ela é de um registro só,
       mas o rótulo da obra é obrigatório (critério 9 do CONTAI-003).
       Confirmado, 24/08.

## Gate Fiscal (Contador)
**Não há regra fiscal nova neste ticket** e registro isso explicitamente em vez
de inventar uma. Toda a regra que ele carrega já foi dada: a obrigatoriedade do
`obra_id` correto e a exigência de correção pela interface (parecer de
2026-08-09, Q9d) e a revalidação de `cno_referenciado` ao mover NF de serviço
(critério 13 do CONTAI-003, herdada pela tela que já existe).

**Uma consequência a não perder de vista**: quando o CONTAI-007 popular
`cno_referenciado`, a revalidação passa a poder **barrar** a correção. A tela de
detalhe precisa deixar o motivo do bloqueio legível — mas isso é problema do
CONTAI-007, não deste ticket (ver o item correspondente lá).

## Out of Scope
- **Lista/busca de tudo que foi registrado** — é a **US-009 [P1]**, e continua
  fora da R1. Este ticket entrega o **detalhe de um registro**, alcançável dos
  pontos que já existem; não entrega inventário
- **Editar valor, data ou favorecido do pagamento** — só a **obra** é
  corrigível aqui. Abrir edição geral de campo fiscal sem parecer é como se
  cria erro novo consertando erro velho
- **Excluir pagamento** — não pedido, e colide com a premissa append-only do
  acervo
- **Abrir/baixar o comprovante original** — é a **US-010**; aqui o anexo é
  citado como existente, não servido

## Pre-mortem
1. O mock vira "aproveita e faz a lista de tudo" e a US-009 entra na R1 de
   carona. **Mitigação**: Out of Scope acima, e o critério 5 fixa que a porta
   de entrada são os pontos que **já existem**
2. A tela vira edição geral e alguém corrige o valor de um pagamento já
   conciliado. **Mitigação: Out of Scope** — só a obra é editável
3. O ticket é adiado "porque é só uma tela" e a R1 vai a produção com metade
   dos registros invisíveis e incorrigíveis. **É o desfecho mais provável e é
   por isso que ele é P0 dentro da R1** — o custo de incluir é uma tela; o
   custo de adiar é o Mateus registrando PIX real sem ter como conferir a obra

## Viabilidade (CTO)
- `/pagamento/[id]/obra` **já existe e funciona**; o que falta é a tela que a
  antecede e os links que chegam nela. O `cto-obra` avalia se o detalhe do
  pagamento reaproveita a estrutura de `/documento/[id]`
- Complexidade estimada pelo PO: **S**

## Dependências
- **Bloqueado por**: CONTAI-003 (a tela de correção que ele expõe) — já
  satisfeito; **mock aprovado pelo Mateus**
- **Dentro da R1**, depois do CONTAI-003
- **Relacionado**: US-009 (inventário) o supera depois, sem substituir;
  CONTAI-008 toca a mesma superfície de correção

## Perguntas Abertas
Nenhuma que bloqueie. O mock responde as de layout.

## Teste do Canteiro
- **Meta 1**: move — o pagamento "aguardando NF" fica visível e conferível em
  vez de sumir depois de salvo
- **Meta 2**: move — `obra_id` corrigível em pagamento é pré-requisito de a
  discriminação por matrícula sair certa
- **Meta 3**: neutro hoje; vira alavanca quando a US-010 servir o comprovante
- Uma mão, com pressa: a correção é ato calmo, feito em casa. A tela pode ser
  densa; o que não pode é não existir
- **Veredito: APROVADO — P0 dentro da R1**, condicionado a mock aprovado
