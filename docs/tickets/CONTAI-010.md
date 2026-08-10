# CONTAI-010 — Datas de pagamento do terreno, do ITBI e da escritura (regime de caixa)

## Tipo e Prioridade
feature / correção fiscal — **P0, FORA da R1 — obrigatório antes da US-004**.

**Dano hoje: zero.** O app só mostra o ano corrente, então nenhum número em
tela está errado agora. **Dano no dia da US-004: erro de declaração.** O
CONTAI-003 captura `valor_terreno`, `valor_itbi` e `valor_escritura_registro`
como três valores **sem data de pagamento**. Sem data não há regime de caixa —
e o custo do terreno inteiro passa a compor **todo** ano-calendário que a
US-004 gerar, inclusive os anteriores ao desembolso.

Caso concreto e nada exótico: terreno pago em 2024, ITBI recolhido em 2025.
A discriminação de 31/12/2024 sai **inflada pelo ITBI que ainda não tinha sido
pago**, e a de 2025 sai sem ele. Situação declarada a maior num ano e a menor
no outro, nos dois casos sem lastro de desembolso.

**Por que P0 e mesmo assim fora da R1.** Ele é P0 porque produz **número errado
em declaração**, não fricção. Fica fora da R1 porque o critério de admissão da
R1 é *"este campo é impossível ou caro de capturar depois?"* — e este é
**barato**: são **duas obras**, um formulário visto duas vezes na vida, três
datas. Não é safra de documentos, é reabrir dois cadastros. Colocar na R1 seria
contradizer a regra que mantém a R1 fechada, e essa regra vale mais do que
economizar uma reabertura de tela.

**Carona explícita, se surgir**: se o mock do CONTAI-003 for reaberto por
qualquer outro motivo antes do merge da R1, **estes três campos entram junto** —
as três colunas de valor já existem separadas (`0004_obra_multipla.sql`), então
é uma migration e três campos no mesmo formulário. O que eu **não** faço é
reabrir o mock só por causa disto.

## Dor de Origem
**Não veio de relato do Mateus.** Veio do review fiscal do `contador` no Gate 2
do CONTAI-003 (ressalva R2, 2026-08-10).

É a **invariante central do CLAUDE.md aplicada a um lugar onde ninguém tinha
olhado**: *"custo de aquisição (IRPF): regime de caixa — a chave é a DATA DO
PAGAMENTO"*. O produto inteiro foi construído em torno disso para documento e
pagamento, e o **terreno**, que é a maior linha isolada de custo da obra, entrou
como um valor sem data.

Dor extraída:
- **D22 [P0 fiscal]** — o custo do terreno (preço + ITBI + escritura) não tem
  data de desembolso registrada, então não tem ano-calendário; qualquer
  discriminação retroativa gerada pela US-004 o alocará em todos os anos

## User Story
Como dono da obra, quero registrar **quando** paguei o terreno, o ITBI e a
escritura, para que a situação declarada em 31/12 de cada ano some só o que eu
tinha efetivamente desembolsado até ali.

## Critérios de Aceite
1. [ ] Três datas de pagamento capturadas no cadastro/edição da obra, uma por
       componente: `data_pagamento_terreno`, `data_pagamento_itbi`,
       `data_pagamento_escritura_registro`
2. [ ] Cada componente com valor > 0 **exige** a sua data. Valor sem data é
       exatamente o defeito que este ticket conserta — não pode ser gravável
3. [ ] Componente ainda não pago (ITBI a recolher, escritura a lavrar) é
       registrável com **valor previsto e sem data**, e nesse caso **não entra
       em ano nenhum** — nem no corrente. Previsto não é pago; regime de caixa
4. [ ] O acumulado de Bens e Direitos de um ano soma **apenas os componentes
       com data de pagamento ≤ 31/12 daquele ano**
5. [ ] Obras já cadastradas antes deste ticket: as datas viram **pendência de
       complemento**, com a consequência escrita — *"sem a data, este valor não
       tem ano-calendário e a discriminação não pode ser gerada"*. **Não é
       bloqueio**: são registros que já existem e a obra segue operando (mesma
       lógica do critério 15 do CONTAI-003)
6. [ ] Nenhum backfill inventa data. Data ausente permanece ausente e visível —
       **nunca `created_at`, nunca a data de hoje** (ver Gate 2 do CONTAI-003:
       data falsa em campo fiscal é pior do que campo vazio)
7. [ ] Teste unitário da regra do critério 4, com o caso do parecer: terreno
       pago em 2024 + ITBI em 2025 → 2024 soma só o terreno; 2025 soma os dois

## Gate Fiscal (Contador)
**Origem: ressalva R2 do review fiscal do Gate 2 do CONTAI-003, 2026-08-10.**
Regra dada: o custo de aquisição segue o **regime de caixa** (IN SRF 84/2001
art. 17) — a data que importa é a do **desembolso de cada componente**, não a da
escritura, não a da matrícula, não a da posse.

**Pendente do `contador` antes do `/develop`** — três pontos que o PO não
decide:
1. Terreno pago **parcelado** (financiamento, parcelas ao vendedor): cada
   parcela no ano da sua quitação, como já vale para NF consolidada (Q6)? Se
   sim, uma data só por componente **não basta** e o terreno vira uma lista de
   desembolsos — o que muda o tamanho deste ticket
2. **Juros e correção** de parcelamento do terreno: fora do custo, como já
   ficou fixado para cartão (Q4) e para NF consolidada (Q6)?
3. Terreno **recebido** (herança, doação, permuta) em vez de comprado: existe
   data de aquisição sem desembolso? Não é o caso do Mateus hoje; pergunto
   porque a resposta decide se o critério 2 pode ser absoluto

## Out of Scope
- **Anexar escritura, ITBI e matrícula ao acervo** — é meta 3 e é legítimo, mas
  é outro ticket: aqui se captura **quando foi pago**, não o documento. Anotado
  no backlog para não voltar como "óbvio"
- **Cálculo do fator de redução por data de aquisição** (Lei 11.196/05 art. 40)
  — depende de contador humano (CRC) e pertence ao ganho de capital, não ao
  registro. Já está na lista "exige CRC" do CONTAI-003
- **Corrigir monetariamente o custo do terreno** — não existe atualização de
  custo de aquisição desde 1996; se aparecer como pedido, é erro conceitual

## Pre-mortem
1. O ticket é adiado para "junto da US-004", e na US-004 alguém precisa da
   discriminação **agora** e preenche as datas de memória. **Data fiscal de
   memória é pior do que campo vazio** — vazio pergunta, memória afirma.
   **Mitigação: critério 6** e a dependência declarada (US-004 não fecha antes
   deste ticket)
2. Alguém "resolve" com um backfill usando `created_at` da obra, exatamente o
   padrão que o Gate 2 do CONTAI-003 já flagrou. **Mitigação: critério 6**,
   escrito para ser impossível de ler de outro jeito
3. O terreno é parcelado e o ticket entra desenhado para uma data só. **É a
   pergunta 1 do Gate Fiscal**, e por isso ela vem antes do `/develop` e não
   durante

## Viabilidade (CTO)
- As três colunas de valor **já existem separadas** (`valor_terreno`,
  `valor_itbi`, `valor_escritura_registro`, migration `0004_obra_multipla.sql`)
  — este ticket acrescenta a data de cada uma. Se a resposta 1 do Gate Fiscal
  for "parcelado", o modelo muda de três colunas para uma tabela de desembolsos
  e a complexidade sobe
- Complexidade estimada pelo PO: **S** (uma data por componente) / **M** (lista
  de desembolsos)

## Dependências
- **Bloqueado por**: CONTAI-003 (cria os campos de valor) — já satisfeito;
  parecer do `contador` sobre os três pontos do Gate Fiscal
- **Bloqueia**: **US-004** — nenhuma discriminação de Bens e Direitos de ano
  anterior pode ser gerada antes deste ticket. É a dependência que importa
- Sem relação com CONTAI-008 e CONTAI-009

## Perguntas Abertas
- As três do Gate Fiscal, todas para o `contador`
- Para o **Mateus**, e é barata: *em que datas foram pagos o terreno, o ITBI e
  a escritura de cada uma das duas obras?* Se as duas foram do mesmo ano e não
  há retroativo a declarar, o ticket continua P0 mas perde a urgência — e vale
  saber disso antes de dimensioná-lo

## Teste do Canteiro
- **Meta 1**: neutro — não é pagamento sem documento; é pagamento sem data
- **Meta 2** (relatórios anuais): move, e é a única razão do ticket existir —
  sem ele a discriminação de qualquer ano que não o corrente sai errada
- **Meta 3**: neutro
- Uma mão, com pressa: irrelevante — cadastro de obra não é tarefa de canteiro,
  acontece duas vezes na vida
- **Veredito: APROVADO — P0 fora da R1, obrigatório antes da US-004**, com Gate
  Fiscal pendente
