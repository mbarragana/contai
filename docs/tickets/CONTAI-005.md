# CONTAI-005 — Headline da home: o que o número em risco soma

## Tipo e Prioridade

feature (display) — **P0 na etiqueta do backlog; último da R1 e o único corte
legítimo dela** (2ª e 3ª revisões: *"005 é o único item de R1 que não captura
dado, logo o único descartável — é display, e display se conserta depois"*).

✅ **DESTRAVADO em 2026-08-17.** A **decisão pendente nº 1** — aberta desde
2026-08-08 — foi fechada pelo **contador + PO**, sob a delegação do Mateus:
**vale a alternativa (a) da Parte B — headline "Custo em risco no IR" =
R$ 49.850**. O corte automático da R1 previsto na alternativa (d) **não se
aplica mais**.

O que ainda segura o `/develop`: **mock v5 aprovado pelo Mateus** (Gate 0), que
agora é desenhável, porque a composição do número está fechada.

- **Gate 0 (mock)**: **OBRIGATÓRIO — PENDENTE e não desenhável ainda.** É
  revisão do card da home do `design/mocks/CONTAI-001.html` (v5), não mock novo.
- **Gate Fiscal**: `docs/pareceres/2026-08-16-gate-fiscal-contai-004-005.md`,
  Parte 2 — APROVADO COM RESSALVAS (R1–R5 bloqueantes).

## Dor de Origem

Backlog, decisão pendente nº 1 e ressalva do `cto-obra` no Gate 2 do CONTAI-001:

> "Os R$ 47.850 do mock são aritmética de antes do card 'pago sem nota' existir;
> os R$ 92.850 somam **quatro moedas diferentes** (perda de custo, conta a pagar
> e base de INSS)."

> "hoje a soma inclui tudo e **pode contar em dobro** um boleto registrado + o
> pagamento avulso do mesmo boleto."

Verificado no código: `emPendenciaCentavos` é a soma crua de `pendencias[]`
(`lib/fiscal/resumo.ts:194`) sobre os quatro tipos. A home exibe esse número como
**"Em pendência"** (`app/page.tsx:147`).

Dor de fundo: **D7** do Relato 002 (*"exposição acumulada 'pago sem nota'
invisível"*, **P0 fiscal**) e o item 4 da **US-007**, registrado como *"entregue
mas com o headline errado — corrigido por CONTAI-005"*.

**Achado do Gate 4 do CONTAI-001, que este ticket carrega**: o *"Custo
confirmado"* da home é **estruturalmente R$ 0,00** até a US-003, porque nada cria
pagamento `conciliado`. Confirmado: `sustentaCusto()` exige
`status === "conciliado"` (`lib/fiscal/resumo.ts:78`) e **nenhuma tela produz
esse status**. O maior número da home é um zero que não tem como não ser zero.

## User Story

Como dono da obra, quero que o número em destaque na home signifique **uma coisa
só** — quanto de custo eu perco no IR se eu não resolver as pendências —, para
que eu saiba o que resolver primeiro em vez de olhar um total que não corresponde
a nenhuma linha de nenhuma declaração.

## Critérios de Aceite

### Parte A — valem em qualquer resposta da decisão nº 1

1. [x] **Mock aprovado pelo Mateus** (v5 do card da home,
   `design/mocks/CONTAI-005.md` + `.html`). Mock aprovado em 2026-08-24 —
   headline "Custo em risco no IR" (R$ 49.850), card de INSS separado (em
   base), boleto fora da soma. Texto do estado zero ratificado pelo
   `contador` no mesmo dia. Não desenhável antes
   da resposta
2. [ ] **Nenhum número da home soma entre obras.** Não regredir o critério 9 do
   CONTAI-003 — `app/page.tsx:129` já carrega `· {obra.nome}` e a dica *"Nada é
   somado com as outras obras"*. Bens e Direitos não soma entre matrículas
   (Q9b); aferição não soma entre CNOs
3. [ ] **(R5 do contador — a ressalva maior desta tela)** **A tela não pode
   exibir "Custo confirmado R$ 0,00" ao lado do headline sem dizer por quê.** Ou
   o zero ganha a ressalva (*"ainda não é possível confirmar custo: a vinculação
   entre pagamento e nota chega na US-003"*), ou os dois números não convivem.
   Como está, a home afirma que **100% do que foi gasto está em risco** — e isso
   é falso sobre a obra, verdadeiro apenas sobre o app. **Uma linha de texto de
   estado, nenhum número novo**
4. [ ] **(R2)** A exposição de INSS é expressa **em base** (R$ de NF de serviço
   sem retenção), **nunca em reais de imposto**. A razão não é estética: a
   **pergunta nº 1 ao CRC** está aberta — o art. 31 da Lei 8.212/91 dirige a
   retenção à **empresa** contratante, e é discutível que o tomador pessoa física
   esteja obrigado a reter. Um número em reais de imposto vira número errado em
   tela se o CRC disser isso; um número **em base** continua verdadeiro nos dois
   desfechos
5. [ ] **Não mexer na classificação de `retencao_11 = false`** neste ticket. O
   backlog proíbe até a resposta do CRC: *"trocar fatal por benigno com base em
   inferência é o mesmo erro na direção oposta, e essa é mais cara, porque some
   com o alerta"*
6. [ ] **(R1)** Teste unitário de `lib/fiscal/resumo.ts` cobre a composição do
   headline com cada tipo isolado e combinado, e afirma que o headline **não** é
   a soma de `pendencias[]`. Inclui a **dedup por vínculo explícito**, escrita já
   agora **mesmo sem efeito hoje** — sem ela, o número passa a mentir quando a
   US-003 nascer (mesma classe de defeito latente do CONTAI-008, D19)

### Parte B — o que muda conforme a resposta do Mateus

**(a) Recomendação do PO, carimbada pelo contador — headline "Custo em risco no
IR" = R$ 49.850**

- Headline = **quarentena + pago sem nota**. Regra de composição, do parecer:
  a unidade de conta é o **dispêndio, não o registro**; entram (i) todo
  `pagamento` com status `aguardando_nf`, pelo valor do pagamento, e (ii) todo
  `documento` em `quarentena`, pelo valor do documento **menos** os pagamentos
  vinculados já contados em (i)
- **(R4)** O total **nunca aparece sem a decomposição visível**: *"composto de:
  R$ 45.000 pagos sem nota · R$ 4.850 em nota fora do seu CPF"*
- **(R3)** Linha de imposto **só com "até"**, fórmula `0,15 × headline` e
  disclaimer de redução/isenção, aplicada **exclusivamente** sobre a base de
  IRPF. Citação correta: Lei 8.981/95 art. 21 (alíquotas, redação da Lei
  13.259/2016); Lei 11.196/05 **art. 40** (fator de redução) / **art. 39**
  (reinvestimento)
- **(R2)** Exposição INSS em **linha própria, em base**, com a frase que **não é
  opcional**: *"Estas notas continuam valendo integralmente como custo de
  aquisição no IRPF."* É ela que impede o leitor de somar 18.000 aos 49.850 com
  a própria cabeça
- Boleto **sai do headline** e continua como card, com a linha nova *"Não entra
  no total acima: enquanto não for pago, não houve dispêndio"*
- **Textos de tela completos, prontos para copiar, estão no parecer** — Blocos 1
  a 3 (headline, INSS, boleto). Não se reescrevem
- Trabalho: dois campos novos em `ResumoObra`, `emPendenciaCentavos` **removido
  do tipo** (não coexiste), rótulo da home, mock v5. **Complexidade S**

**(b) Manter os R$ 92.850 (o que está implementado hoje)**

- O ticket encolhe para **só rótulo**: trocar "Em pendência" por um nome que
  admita o que a soma é
- **Não recomendado pelo PO nem pelo contador.** O contador **não carimba os
  92.850**: somam quatro moedas, e uma delas (INSS) **afirma o inverso da verdade
  fiscal** sobre as notas que a compõem — nota no CPF do Mateus e paga é custo
  **confirmado**, não em risco
- Cai o critério 6 da Parte A

**(c) Os R$ 47.850 do mock (sem pago-sem-nota)**

- Mesmo trabalho de (a), resultado pior: é aritmética anterior ao card "pago sem
  nota" existir, ainda inclui boleto e INSS, e **esconde exatamente a exposição
  do Relato 002** — o PIX mensal para a AJE sem nota, que é o fluxo corrente do
  Mateus, não hipótese. **Não carimbado pelo contador**

**(d) Sem resposta até o merge do CONTAI-009 → corte automático**

- O CONTAI-005 **sai da R1** e a release vai ao ar com "Em pendência" como está
- Proposto explicitamente pelo PO, e é a parte desconfortável: a decisão está
  aberta há mais de uma semana, o ticket é o único da R1 que não captura dado, e
  travar a estreia inteira num rótulo de tela é pior do que estrear com o rótulo
  errado por mais um ciclo. **Display se conserta depois; a R1 parada não volta**

## Gate Fiscal (Contador) — FECHADO

Parecer em `docs/pareceres/2026-08-16-gate-fiscal-contai-004-005.md`, Parte 2.
**APROVADO COM RESSALVAS**, com **a recomendação do PO carimbada**: headline =
quarentena + pago sem nota; INSS em linha separada em base; boleto fora.
**O número correto no cenário do mock é R$ 49.850** — nem 92.850, nem 47.850.

**Por que o INSS não entra** — três motivos independentes, e o terceiro basta:

1. Apurações diferentes com bases diferentes; **nunca se somam, em direção
   nenhuma**
2. A unidade está errada: R$ 18.000 de NF sem retenção **não são R$ 18.000 de
   nada** — são base que deixa de ser reduzida
3. **Aquela nota, se está no CPF do Mateus e foi paga, entra 100% no custo de
   aquisição.** Ela é custo **confirmado**. Pô-la em "Custo em risco no IR"
   **afirma o oposto exato da verdade fiscal daquele documento** — inversão de
   sinal, não imprecisão

**Por que o boleto fica fora**: boleto pendente **ainda não é custo** — no regime
de caixa, sem desembolso não há dispêndio. E o risco real dele é de outra moeda
(juros e multa de mora, que **não integram o custo**). O headline conta
**desembolsos e documentos**, nunca **títulos de cobrança**.

**Double-count**: no headline é **display** — nenhuma declaração é alimentada por
ele. E ainda assim custa caro, por dois canais: faz agir errado, e **contamina a
confiança nos números certos**. **Onde vira fiscal** [Certain]: quando o mesmo
dispêndio é registrado duas vezes *como dispêndio* — aí o acumulado em 31/12 sobe
e vai para a declaração. **A primeira defesa nasce no CONTAI-004** (aviso de
duplicidade), mais um motivo para 004 vir antes de 005.

⚠️ **A dedup só opera sobre vínculo explícito** (`pagamento_documento`), jamais
sobre heurística de "mesmo favorecido, mesmo valor": heurística que subtrai em
silêncio **some com o alerta e ninguém vê**.

## Out of Scope

- **Calcular imposto ou aferição em reais** — US-004, e depende do CRC
- **Voltar a linha de imposto na tela de quarentena** — cortada no Gate 4 do
  CONTAI-001; só volta com "até R$ X" e aprovação do Mateus no mock
- **Painel consolidado / total das duas obras** — cortado no Relato 003 e
  **fiscalmente enganoso**: número que não existe em declaração nenhuma
- **Mexer no ciclo de vida do boleto** — US-003 + CONTAI-008
- **Fazer o "Custo confirmado" deixar de ser zero** — isso é a US-003. A
  diferença é explicar o zero (dentro) × produzir custo conciliado (fora)

## Pre-mortem

1. **Sai um headline chamado "Custo em risco no IR" que não é custo em risco**:
   pago-sem-nota vira nota na semana seguinte e nunca foi risco. Urgência falsa
   repetida cria cegueira ao alerta — o mecanismo que fez cortar o aviso genérico
   do CONTAI-007. **Mitigação**: o rótulo diz **risco**, não perda; cada card
   mantém a consequência copiada do parecer. E o contador confirma que "em risco"
   é o rótulo certo: o que transforma risco em perda **não é a virada do ano**, é
   o fim da alavanca (última parcela paga) e o fim da janela municipal de
   cancelamento/reemissão
2. **A definição do número muda depois da primeira declaração** e ninguém sabe
   qual valia. **Mitigação**: a fórmula fica no ticket **e no teste unitário** —
   o teste é o registro que não envelhece
3. **O ticket fica bloqueado para sempre esperando a decisão e trava a R1.** É o
   desfecho mais provável. **Mitigação**: alternativa (d), corte automático

## Viabilidade (CTO)

**Função pura em `lib/fiscal/resumo.ts` — nem cliente ad-hoc, nem view do
Postgres.** O módulo já existe e já é o único lugar que sabe o que é documento
hábil. Sai `emPendenciaCentavos`, entram `custoEmRiscoIrCentavos` e
`exposicaoInssBaseCentavos`.

⚠️ **Remover `emPendenciaCentavos` do tipo, não deixar coexistir.** Dois
agregados no mesmo módulo é o convite para a próxima tela usar o errado. A lista
de pendências item a item fica; o total misturado morre.

**O anti-divergência com a US-004 é importar a mesma função, não mover o cálculo
para o banco.** Uma view SQL duplicaria em SQL regras que hoje têm 118 testes em
TypeScript — criaria exatamente a segunda implementação que se teme, e fora do
alcance do Vitest. O dia em que precisar de agregação pesada no servidor, a view
nasce **derivada dos testes existentes**, não antes.

**Double-count**: o schema atual **não permite detectar** — não existe vínculo
entre boleto e pagamento avulso até a US-003 criar `pagamento_documento`, e casar
por favorecido+valor seria chute. A decisão nº 1 **dissolve** o problema em vez
de detectá-lo: com boleto fora do headline, a mesma dívida entra uma vez só.
**Registrar que é dissolução, não detecção** — para ninguém reabrir como bug.

**Arquivos**: `lib/fiscal/resumo.ts` + `resumo.test.ts` · `app/page.tsx` ·
`design/mocks/CONTAI-001.html` (v5). **Complexidade: S** em (a) e (c), **XS** em
(b). **Dívida criada: nenhuma** — ao contrário, paga uma. A linha de INSS em base
é o hedge correto para a pergunta do CRC: se a tese cair, muda o rótulo, não o
dado.

## Dependências

- **Bloqueado por**: **decisão pendente nº 1 do Mateus** (bloqueio duro) → mock
  v5 aprovado
- **Bloqueia**: nada. Último item da R1 e o único descartável dela
- **Relacionado**: US-003 (a única coisa que tira o "Custo confirmado" do zero
  estrutural); **CONTAI-004** (o aviso de duplicidade é a defesa real contra
  double-count); pergunta nº 1 ao CRC

## Perguntas Abertas

1. **A decisão nº 1** — a pergunta inteira, e a única bloqueante
2. Quando a resposta for (a): o rótulo é *"Custo em risco no IR"* mesmo, ou o
   Mateus prefere outra palavra? Ele é quem lê a tela às 7h da manhã no canteiro

## Teste do Canteiro

- **Meta 1**: **move** — é o número que dirige qual pendência ele resolve
  primeiro; hoje ele dirige errado
- **Meta 2**: neutro — nenhuma saída de declaração muda
- **Meta 3**: neutro
- Uma mão, com pressa: **sim** — é leitura, não captura. Não acrescenta um toque
- **Veredito: PRECISA MUDAR — bloqueado na decisão nº 1.** APROVADO
  condicionalmente na resposta (a); **corte automático** da R1 na ausência de
  resposta até o merge do CONTAI-009
