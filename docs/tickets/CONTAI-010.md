# CONTAI-010 — Custo do terreno: desembolsos datados e o informe anual do financiamento

## Tipo e Prioridade
feature / correção fiscal — **P0, FORA da R1 — obrigatório antes da US-004**.

**Reescrito em 2026-08-18.** A versão anterior tratava o terreno como três
valores com uma data cada e afirmava que juros de parcelamento ficavam **fora**
do custo. As duas coisas estão erradas para o caso real, e a segunda produz erro
de declaração de **dezenas de milhares de reais por ano**. O que segue substitui
o ticket antigo; o que não muda está marcado.

**Tamanho**: **M pequeno**, fatiado em dois S — este ticket é o **Passo 1
(captura + correção do cálculo)**; o Passo 2 (texto da discriminação e o caso do
ano da venda) vai junto da **US-004**. Ver *Viabilidade (CTO)*.
**Gate 0: PENDENTE — não existe mock.**

---

## ⚠️ Correção fiscal — o que este ticket dizia errado

A linha *"Juros e correção de parcelamento do terreno: **fora do custo**"*
(pergunta 2 do Gate Fiscal da versão anterior) **está errada** e foi apagada.

- **Juros e correção monetária pagos no financiamento do terreno INTEGRAM o
  custo de aquisição.** Fonte: `docs/pareceres/2026-08-17-terreno-financiado.md`,
  §2d e adendos 1, 2 e 3 de 18/08.
- A regra que o ticket antigo transportou (Q4 — encargo de cartão sobre compra
  de material) **não alcança** juros pagos para adquirir o próprio imóvel.
  Regra específica vence princípio geral.
- **Referência**: IN SRF 84/2001, **art. 17, I** — *"os juros e demais
  acréscimos pagos para a aquisição do imóvel"*. ⚠️ **A alínea é "i" na
  listagem do Perguntas e Respostas IRPF**; os adendos 1 e 2 citaram "g" e o
  `contador` **corrigiu a própria referência** no adendo 3, com a instrução de
  **confirmar na IN vigente**. O inciso I (bens imóveis) é o que vale; a letra
  é secundária e checável. **Não afirmar a letra como fato em tela, texto de
  declaração ou comentário de código.**
- **Ordem de grandeza no caso real**: em 2025, juros/correção somaram
  **R$ 43.051,23** contra **R$ 16.883,52** de amortização — **72% do desembolso
  do ano**. Implementar o ticket como estava escrito jogaria fora essa cifra
  todo ano, por ~20 anos.

**Ressalva que vai ao corpo do produto, palavras do `contador`**: nessa ordem de
grandeza a inclusão dos juros *"é assinatura de CRC, não decisão de app"*. Isso
**não trava o software** — o app soma, nomeia em linha própria e guarda o
número separado. O que ele **não** faz é apresentar o resultado como veredito:
todo número gerado por este ticket é **insumo para revisão profissional**.

---

## Dor de Origem

**D22** (original, do review fiscal do Gate 2 do CONTAI-003) — terreno, ITBI e
escritura entram **sem data de pagamento**, logo sem ano-calendário, logo o
custo do terreno inteiro compõe **todo** ano que a US-004 gerar.

**D33 [P0 fiscal] — nova, 18/08.** O terreno do Mateus é **financiado (só o
terreno, ~20 anos)**, e o financiamento **não tem onde morar no app**. O custo
de 2025 — **R$ 59.934,75** de amortização + juros/correção — está **inteiro
fora do sistema**, e não é hipótese: o documento existe e está na mão dele.

**D34 [P1 fricção, com cara de fiscal] — nova, 18/08.** Enquanto o informe do
ano corrente não existir (ele só é publicado em jan/fev), o painel de custo
**subestima o financiamento**. Subestimar em silêncio é o defeito do CONTAI-005
ao contrário: número errado em tela sem rótulo que o explique.

---

## O fato novo que redesenha o ticket: o informe é anual e ele baixa sozinho

A peça é o **"Extrato do Imposto de Renda"** da instituição credora — **um por
exercício**, publicado automaticamente para o IR, **baixado pelo próprio Mateus
no site do banco**. **Pedidos ao gerente durante o ano: zero** — exigência dele,
acatada pelo `contador`, que revisou o parecer (*"a exigência de todo mês era
rastreabilidade, não apuração"*) e **cancelou** o pedido de extrato analítico
mensal e retroativo.

Consequência de produto: **um lançamento por ano-base, por contrato** — não
doze. O documento traz a decomposição pronta:

| Rubrica do extrato | Entra no custo? | Por quê |
|---|---|---|
| Amortização | **Sim** `[Certain]` | é preço do imóvel |
| Juros / Correção Monetária | **Sim** | IN SRF 84/2001 art. 17, I (ver ressalva da alínea acima) |
| Seguros (MIP/DFI) | ⚠️ **EM ABERTO — não decidir no código** | o parecer do agente `contador` diz "não entra" (cobertura de risco, não preço); **o contador com CRC que assina a declaração INCLUIU** no total pago de 2025, e o Mateus decidiu manter (2026-08-19). **Guardar separado e não fixar a regra** — ver ADENDO 4 do parecer |
| Taxas + FCVS | **Não somar hoje** | taxa de administração é serviço bancário, **fora**. ⚠️ **FCVS NÃO ESTÁ FECHADO**: tem cara de encargo do contrato e é **candidato a inclusão** — guardar separado, marcado *"confirmar"* |
| Mora / Multa | **Não** `[Certain]` | penalidade nunca é custo |
| **Diferença Teórico / Pago** | ⚠️ **Desconhecida** | o `contador` **não sabe o que é** e não supõe. **Fora da soma, revisão humana.** No caso real: R$ 167,43 — a 15%, ~R$ 25. Custa um chamado à instituição, **uma vez, vale para todos os anos** |
| Total Pago no Exercício | — | é a **trava** |
| Saldo Devedor em 31/12 | **Não** | não foi pago. Informativo; **nunca** vira "dívida" no custo |

**Trava obrigatória 1 — a soma fecha ou o app recusa.** A soma das rubricas tem
de bater com o total pago no exercício. Se não bater, existe rubrica que o app
não conhece: **recusar e pedir revisão humana**, nunca somar o resto e seguir.

**Trava obrigatória 2 — informe OU parcelas, nunca os dois.** Por
**ano-base + contrato**. Dupla contagem aqui é custo inflado em Bens e Direitos,
que é redução indevida de ganho de capital, cobrada com multa.

---

## User Stories

**Principal (gestão, em casa, sentado — jan/fev, uma vez por ano)**
Como dono da obra, quero registrar **o informe anual do financiamento do
terreno** com as rubricas separadas e o extrato anexado, para que o custo de
aquisição daquele ano-calendário exista no sistema com lastro documental, sem
eu precisar pedir nada ao banco.

**Original (mantida)**
Como dono da obra, quero registrar **quando** paguei a entrada, o ITBI e a
escritura, para que a situação declarada em 31/12 de cada ano some só o que eu
tinha efetivamente desembolsado até ali.

---

## Critérios de Aceite

### Gate 0 — antes de qualquer linha de código
1. [ ] **Mock aprovado explicitamente pelo Mateus.**
       ⚠️ **PENDENTE: rodar `/design`.** Há UI nova (formulário do informe
       anual, o aviso de "aguardando informe" e a natureza da aquisição).
       **Não existe mock hoje.** Cenário: **gestão em casa, sentado** — a tela
       pode ter mais campos, mais densidade e mais passos; 375px continua sendo
       o piso, não o alvo. **O Teste do Canteiro não se aplica a esta tela**
       (régua corrigida no `CLAUDE.md` em 18/08).

### Natureza da aquisição e componentes à vista
2. [ ] Campo **`natureza_aquisicao_terreno`** — à vista / financiado com
       instituição / parcelado direto com o vendedor / recebido (herança,
       doação, permuta). **É ele que decide qual regra roda.** Hoje o app não
       pergunta e por isso respondeu errado sozinho.
3. [ ] Entrada, ITBI e escritura/registro: cada componente com valor > 0
       **exige a sua data de pagamento**. Valor sem data é o defeito que este
       ticket conserta — não é gravável.
4. [ ] O critério 3 vale **só para aquisição onerosa**. Terreno **recebido**
       tem data de aquisição **sem desembolso**, e o custo é o valor constante
       na declaração do doador/de cujus — o critério 3 não pode ser absoluto.
5. [ ] Componente ainda não pago (ITBI a recolher, escritura a lavrar) é
       registrável com **valor previsto e sem data**, e nesse caso **não entra
       em ano nenhum** — nem no corrente. Previsto não é pago.
6. [ ] Bens e Direitos de um ano soma **apenas os componentes com data de
       pagamento ≤ 31/12 daquele ano**.

### O contrato de financiamento (uma vez na vida)
7. [ ] Cadastro do contrato: instituição, número, data do contrato, preço
       contratado, nº de parcelas, valor e data da **entrada** com comprovante,
       origem da entrada (recurso próprio / FGTS — **FGTS na entrada é
       desembolso dele e entra**).
8. [ ] **Preço contratado nunca vai para o custo.** Ele existe para o texto da
       discriminação e para fechar a conta na cabeça de quem lê
       (pago + saldo devedor = preço). Declarar o bem pelo preço integral sem
       declarar a dívida produz evolução patrimonial sem lastro de renda.

### O lançamento anual do informe
9. [ ] **Um lançamento por ano-base + contrato**, contendo: ano-base, as
       **rubricas separadas** da tabela acima, **total pago no exercício**,
       **saldo devedor em 31/12** (informativo) e o **extrato em anexo**.
10. [ ] **Anexo obrigatório no ato do registro.** Sem o extrato, não grava —
        é a meta 1 aplicada a um desembolso de dezenas de milhares de reais.
11. [ ] **Trava da soma**: `amortização + juros/correção + seguros + taxas/FCVS
        + mora/multa + diferença teórico-pago` **tem de fechar com o total
        pago**. Não fechou → **recusa** com a razão em tela. Nunca somar o
        resto e seguir.
12. [ ] **As sete rubricas são guardadas SEPARADAS, sempre** — é isso que
        permite recompor o custo sob qualquer entendimento sem redigitar nada.
        ⚠️ **A composição do custo NÃO é decidida no código deste ticket**:
        amortização e juros/correção somam `[Certain]`; **seguros seguem a
        prática do contador com CRC** (hoje: incluídos) e o app **não afirma
        em tela** que ficam fora. Mora e multa nunca somam `[Certain]`.
        Ver ADENDO 4 de `docs/pareceres/2026-08-17-terreno-financiado.md`.
13. [ ] **FCVS** é guardado com marca própria — *"candidato a inclusão,
        pendente de confirmação"*. Não herda o tratamento de nenhuma outra
        rubrica, e em especial **não é resolvido por analogia com seguros**,
        que está em aberto (critério 12).
14. [ ] **Trava da dupla contagem, na versão estrutural**: o caminho de
        lançamento **mensal não é construído**. Sem tipo para "parcela do
        financiamento", a dupla contagem é impossível **por ausência de tipo**,
        não por regra que alguém precisa lembrar. Complemento no banco:
        **um informe por contrato + ano-base** (chave única).
14b.[ ] **As colunas `valor_terreno`, `valor_itbi` e `valor_escritura_registro`
        morrem na mesma migration que cria o modelo novo.** Coluna velha
        convivendo com tabela nova é o mesmo dinheiro em dois lugares — a
        dupla contagem entrando pela porta que a trava 14 fechou.
15. [ ] **Saldo devedor** nunca é somado nem subtraído de número nenhum, não
        vira campo de "dívida" e não entra na discriminação do bem. Aparece
        como informativo, rotulado.

### O que a tela tem de dizer
16. [ ] **Ano corrente sem informe** aparece nomeado — algo como
        *"financiamento [ano]: aguardando informe anual"* — e **nunca em
        silêncio**. O painel subestima o custo do financiamento entre janeiro e
        a chegada do informe, e isso é fato conhecido, não bug.
17. [ ] **Exceção do ano da venda**: o informe daquele ano só chega no ano
        seguinte e o ganho de capital é apurado antes. A tela pede, nesse ano,
        **extrato do período** + **termo de quitação** do financiamento.
        É **1x na vida**.
18. [ ] ⚠️ **REMOVIDO em 2026-08-19 por decisão do Mateus.** O texto que
        afirmava em tela que *"o seguro não entra, mesmo sendo obrigatório"*
        **não vai para a interface**: ele apresenta como pacífico algo que o
        contador com CRC pratica de outro modo. Nenhuma tela deste ticket
        afirma o tratamento dos seguros — a tela mostra a rubrica, o valor e
        de onde ele veio, e cala sobre a classificação. Ver ADENDO 4.
19. [ ] Todo número de custo do financiamento é apresentado como **insumo para
        revisão profissional (CRC)**, nunca como veredito. Texto no relatório,
        não só no formulário.

### Saídas
20. [ ] Na discriminação de Bens e Direitos, **juros vão em linha nomeada
        própria**. **Proibido incluir juros dentro de um total sem dizer** —
        item contestado incluído em silêncio é o pior dos mundos; incluído com
        nome é posição declarada, e isso muda o tratamento numa glosa.
21. [ ] O lançamento do financiamento **não é `pagamento`**: não entra em
        **Pagamentos Efetuados**, não entra na **base de aferição do INSS**, e
        **não entra no headline de "custo em risco"** do CONTAI-005 (o
        favorecido é o banco; o documento hábil é contrato + informe, não NF).
22. [ ] **Nenhum backfill inventa data** — nunca `created_at`, nunca a data de
        hoje. Data ausente permanece ausente e visível.
23. [ ] Obras já cadastradas: as datas e a natureza da aquisição viram
        **pendência de complemento** com a consequência escrita — *"sem a data,
        este valor não tem ano-calendário e a discriminação não pode ser
        gerada"*. **Não é bloqueio.**
24. [ ] Testes unitários de: (a) terreno pago em 2024 + ITBI em 2025 → 2024
        soma só o terreno, 2025 soma os dois; (b) a trava da soma recusando um
        informe que não fecha; (c) a trava de dupla contagem;
        (d) `amortização + juros` somando e as demais rubricas **não**.

---

## Gate Fiscal (Contador) — FECHADO

Fonte normativa: **`docs/pareceres/2026-08-17-terreno-financiado.md`**, com os
**adendos 1, 2 e 3 de 2026-08-18**. Onde o corpo do parecer e os adendos
divergirem, **valem os adendos**.

As três perguntas da versão anterior estão **respondidas**:

1. **Terreno parcelado/financiado** → cada desembolso no ano da sua quitação.
   Uma data por componente **não basta**. **SIM**, o terreno vira lista de
   desembolsos — mas com **uma linha por ano** para o financiamento, não doze.
2. **Juros e correção** → **INTEGRAM o custo**, ao contrário do que o ticket
   presumia. Ver a correção fiscal no topo.
3. **Terreno recebido** → há data de aquisição **sem desembolso**; por isso o
   critério 3 não é absoluto e existe o campo do critério 2.

**Escopo fechado pelo Mateus em 18/08**: o financiamento é **só do terreno** —
não cobre construção, não há liberação por medição, não há rateio. Isso
**elimina** a zona cinzenta do parecer e some com a pergunta ao CRC sobre
liberações por medição. **A aferição do INSS não é tocada por nada disto.**

**Regras adicionais registradas aqui para não se perderem:**

- **Corolário do MIP**: dívida quitada por **sinistro do seguro** **não é custo
  de aquisição** — não houve dispêndio do adquirente. `[Certain]` no princípio
  do art. 17 (dispêndio *pago pelo proprietário*). Evento improvável; a regra
  fica escrita porque o dia em que ela importar não é dia de deduzir.
- **Indenização do DFI**: reparo custeado por indenização **não é dispêndio
  dele** — quem pagou foi a seguradora, **não soma no custo**. O tratamento da
  **indenização recebida em dinheiro** ficou **"confirmar"** — o `contador` não
  tem o dispositivo e não supõe.
- **A quitação do saldo devedor com o dinheiro da venda É dispêndio pago** e
  integra o custo **no ano da venda**. Financiar não amputa o custo, só desloca
  o momento. **Multa/tarifa de quitação antecipada: fora.**

**Continua "confirmar" (não bloqueia este ticket, bloqueia a assinatura):**
a alínea do art. 17 na IN vigente · a natureza da *"Diferença Teórico / Pago"*
(pergunta à instituição) · o **FCVS** · a indenização em dinheiro do DFI.

---

## Out of Scope

- **Ficha Dívidas e Ônus Reais** — **não**, e é decisão, não omissão. O imóvel
  nunca é lançado pelo preço integral (só pelo pago), então o patrimônio nunca
  incorporou o dinheiro do banco; lançar a dívida deixaria a evolução
  patrimonial **negativa sem causa**. Os dois pares são consistentes; a mistura
  é que erra. **O app não cria conceito fiscal de dívida.**
- **Corrigir monetariamente o custo do terreno** — não existe atualização de
  custo de aquisição desde 1996. Pedido nesse sentido é erro conceitual.
- **Fator de redução por data de aquisição** (Lei 11.196/05 art. 40) — pertence
  ao ganho de capital e exige CRC. O app entrega o custo desembolsado **ano a
  ano, datado**, que é o insumo que o GCAP e o contador vão pedir.
- **Captura mensal de parcelas** — cortada. Não há razão fiscal para
  granularidade mensal: nenhuma das duas apurações do projeto olha mês. Se
  voltar como pedido, é a rastreabilidade que o `contador` já pesou e descartou.
- **Retificadora da DAA do exercício 2026** (ano-base 2025) — é ação do Mateus
  com CRC, não função do app. O app **registra** o lançamento de 2025 com a
  data certa para o acervo sustentar o número na venda; **quem decide se
  retifica é humano**. Depende da **D24** (o app não sabe qual ano-calendário
  já foi declarado).
- **Anexar escritura, ITBI e matrícula ao acervo** — meta 3, legítimo, outro
  ticket. Aqui se captura **quando foi pago**; o extrato do financiamento é a
  única exceção, e é anexo porque **é** o documento hábil do lançamento.

---

## Pre-mortem

1. **Alguém implementa a linha antiga e joga R$ 43 mil/ano fora.** Mitigação:
   a correção fiscal está no **topo** do ticket, não no meio, e o texto errado
   foi **apagado** em vez de riscado.
2. **A "diferença teórico/pago" é somada porque fecha a conta bonitinho.**
   Mitigação: critério 11 exige que ela **participe da trava** e o 12 exige que
   ela **não participe do custo**. São coisas diferentes e o teste (d) separa.
3. **FCVS herda o tratamento de outra rubrica** e perde a marca de candidato —
   quando a confirmação vier favorável, ninguém lembra de revisitar. O risco
   cresceu em 19/08: com os seguros **em aberto** (critério 12), resolver o FCVS
   "por analogia" não resolve nada. Mitigação: critério 13.
4. **Dupla contagem**: alguém acha útil deixar registrar parcela avulsa "além"
   do informe. Mitigação: critério 14, e o motivo escrito (custo inflado =
   redução indevida de ganho de capital).
5. **O painel subestima e ninguém percebe** até a declaração. Mitigação:
   critério 16 — o rótulo é obrigatório, não decorativo.
6. **Juros diluídos no total da discriminação** "para o texto caber".
   Mitigação: critério 20 — e a ordem de corte do parecer põe o destaque dos
   juros acima do saldo devedor e abaixo da frase do valor pago.
7. **Data fiscal de memória.** Mitigação: critério 22 — vazio pergunta,
   memória afirma.

---

## Viabilidade (CTO)

*Leitura do `cto-obra`, 2026-08-18. Ele acrescentou uma decisão que eu não tinha
listado e que é a mais importante do lote — ver critério 14b.*

**Modelo**: três tabelas novas e três colunas mortas.
- `obra.natureza_aquisicao_terreno` — enum
  (`a_vista | financiado | parcelado_vendedor | recebido`), **nullable e sem
  backfill**: obra existente vira pendência de complemento. O app não inventa
  fato, nem fato que "todo mundo sabe".
- `terreno_desembolso` — desembolsos avulsos e datados (entrada, ITBI,
  escritura/registro, parcela ao vendedor, quitação), com `data_pagamento`
  **nullable** para que valor sem data seja pendência **visível**, e anexo.
  **O caso à vista é o caso degenerado — um desembolso.** Isso resolve o
  ticket uma vez, não duas.
- `financiamento` — o contrato, 1x na vida.
- `financiamento_informe` — **um por contrato + ano-base**, com as **sete
  rubricas em colunas fixas**, total pago, saldo devedor em 31/12 e anexo
  obrigatório. Guardar **`ano_base`** e derivar o exercício: duas colunas para
  o mesmo fato descolam.

**Por que colunas fixas e não tabela de rubricas**: o layout do extrato é
fechado e conhecido. Com colunas fixas, rubrica nova do banco **não tem onde
entrar**, a soma não fecha e o registro é recusado — o critério 11 sai de
graça. Uma tabela filha tornaria a trava da soma inexprimível em SQL e deixaria
rubrica desconhecida entrar em silêncio, que é o oposto do pedido.

**Trava da soma nos dois lugares**: validação na aplicação (com a mensagem) e
`CHECK` no banco como backstop. `numeric(14,2)` compara exato — sem float.

**Sem FK para `pagamento` e sem coluna em `pagamento`** — proteção de **tipo**,
mesmo desenho do `compromisso`. É assim que o critério 21 deixa de depender de
disciplina.

**Impacto em `lib/fiscal/`**: `custoTerrenoCentavos(obra)` **morre**; entra uma
função por ano (`custoTerrenoAteOAno(desembolsos, informes, ano)`) que soma
desembolsos com data ≤ 31/12 e, dos informes com `ano_base ≤ ano`, **só
amortização + juros/correção**. `resumo.ts:411` passa a usá-la — e conserta de
carona o defeito original (terreno inteiro em todo ano). Os dois estados novos
de tela (valor sem data; "aguardando informe") ficam em campo próprio do
`ResumoObra`, **fora das somas e fora do headline do CONTAI-005**.
**CONTAI-005 não muda de código** — ganha um teste afirmando que informe e
desembolso não aparecem em pendência nenhuma.

**Migration**: carrega DDL **e movimentação de dado em produção** (as três
colunas viram linhas, **todas com data nula** — nunca `created_at`), mais
`revoke` antes de `grant` para as três tabelas novas, **sem DELETE** (acervo
append-only), e a atualização do mapa em `e2e/privilegios.spec.ts` **no mesmo
diff**. Três tabelas novas é o cenário exato do incidente de 2026-08-17.
Molde a copiar: `supabase/migrations/0007_compromisso.sql`.

### Complexidade — divirjo do `contador`, com concordância no essencial

Ele disse que o lançamento anual traz o ticket de **M para ~S**. **A apuração
é S de verdade** — funções puras triviais, um lançamento por ano. Mas o ticket
inteiro carrega migration com movimentação de dado + drop de colunas, três
tabelas com grants e **três telas novas** com gate de mock antes. **Isso é M
pequeno.** A saída é fatiar em dois S — e aí ele tem razão:

- **Passo 1 — P0, é este ticket.** Migration completa (tabelas, backfill sem
  data, drop das três colunas, grants, mapa do E2E) + captura (natureza,
  contrato, desembolsos datados, informe anual com trava da soma e anexo) + a
  troca de `custoTerrenoCentavos` pela função por ano. **A troca não é
  adiável**: dropar as colunas quebra o build sem ela, e ela **é** a correção
  fiscal que motivou o ticket. Destrava o registro do ano-base 2025.
- **Passo 2 — junto da US-004.** Texto da discriminação (juros em linha
  nomeada, saldo devedor rotulado — critério 20), refinamento dos estados
  informativos e o **caso do ano da venda** (critério 17). Não existe antes de
  a US-004 existir.

**Fora dos dois passos**: lançamento mensal opcional, qualquer campo de
"dívida", e FCVS somando (fica **capturado em coluna, fora da soma**, aguardando
confirmação).

---

## Dependências

- **Bloqueado por**: CONTAI-003 (campos de valor da obra) — satisfeito.
  **Gate 0 (mock) — pendente.**
- **Bloqueia**: **US-004** — nenhuma discriminação de Bens e Direitos de ano
  anterior pode ser gerada antes deste ticket.
- **Relação com D24** (ano-calendário já declarado): o aviso de "isto mexe em
  ano já declarado" para o lançamento retroativo de 2025 depende dela. **Não
  bloqueia** — sem a D24 o lançamento é registrado do mesmo jeito, só sem o
  aviso.
- Sem relação com CONTAI-008 e CONTAI-009.

---

## Perguntas Abertas

1. **Para a instituição credora** (um chamado, uma vez, vale para todos os anos
   do contrato): qual é a natureza da rubrica **"Diferença Teórico / Pago"**?
2. **Para o Mateus**: em que datas foram pagos a **entrada**, o **ITBI** e a
   **escritura**? É o único dado deste ticket que só ele tem.
3. **Para o contador com CRC — ele existe e assinou a declaração de 2025**:
   **por que os seguros entram no total pago que ele declarou?** É entendimento
   dele, praxe do escritório, ou dispositivo que o agente não achou? Some-se a
   alínea do art. 17 e o tratamento de tarifas e FCVS. É a pergunta que fecha o
   ADENDO 4 do parecer e o critério 12 — conversa de dez minutos.

*A pergunta 3 do Gate Fiscal da versão anterior (terreno parcelado) está
**resolvida**, não mais aberta.*

---

## Filtro de escopo (as três metas)

- **Meta 1 (nenhum pagamento sem documento hábil)**: **move** — o critério 10
  põe o extrato como condição de gravação de um desembolso anual de dezenas de
  milhares de reais que hoje não tem registro nenhum.
- **Meta 2 (relatórios anuais)**: **move, e é a razão do ticket existir** — sem
  ele a discriminação de qualquer ano sai errada, e agora sabe-se de quanto.
- **Meta 3 (acervo até a decadência)**: **move** — o informe anual é peça de
  guarda longa, e o contrato tem 20+ anos de vida. Digitalizar no ato.
- **Cenário**: **gestão em casa, sentado**, 1x por ano. **Não é captura de
  canteiro** e não se julga por essa régua (`CLAUDE.md`, correção de 18/08).

**Veredito: APROVADO — P0 fora da R1, obrigatório antes da US-004, Gate 0
(mock) pendente.**
