# Parecer fiscal — o vínculo pagamento↔documento e a trava `conciliado`

- **Data**: 2026-08-17 · **Autor**: agente `contador`, execução read-only
- **Provocação**: caso real do Mateus — NF de serviço PJ de R$ 3.000 sem
  retenção, com "Custo confirmado R$ 0,00" na home
- **Consome**: parecer de 2026-08-16 (Gate Fiscal CONTAI-004/005), art. 17 da
  IN SRF 84/2001
- **Normativo para**: `CONTAI-018`

> `[Certain]` / `[Likely]` são do contador. Nada aqui substitui contador humano
> (CRC).

---

## 0. A retenção nunca foi a variável

**A falta de retenção de 11% não impede a nota de compor o custo de aquisição.**
[Certain] São duas apurações que nunca se tocam: a retenção reduz a **base da
aferição do INSS**; o custo de aquisição reduz o **ganho de capital na venda**.
Nota em nome e CPF do declarante, paga por ele, **entra 100% no custo — com ou
sem retenção**.

**Texto para o usuário:**

> Sim, entra. A retenção de 11% é da conta do INSS da obra, não da conta do IR.
> Essa nota, estando no seu CPF e paga por você, soma integralmente no custo do
> imóvel para quando vender. O que a falta de retenção causa é outra coisa: essa
> nota não vai abater a base da aferição do INSS no CNO — você pode acabar
> pagando INSS sobre essa mão de obra na regularização da obra. São dois
> prejuízos possíveis em contas separadas; um não anula o outro.

**O que decide o caso é outra pergunta**: *existe pagamento registrado?* E há um
dano maior que o número — **cada dia com "Custo confirmado R$ 0,00" ensina um
modelo fiscal falso: que custo é aquilo que o app carimba.** Custo de aquisição
não é estado do app; é fato do mundo que o app registra ou deixa de registrar.

---

## 1. Quando um dispêndio compõe o custo — "se X e Y → Z"

**Todas as quatro condições, e só elas** [Certain; base: art. 17]:

1. **Houve desembolso efetivo do declarante, com data** (regime de caixa); **E**
2. o desembolso corresponde a **bem ou serviço incorporado ao imóvel** — fora da
   lista de exclusões (móveis soltos, eletrodomésticos, consumo, IPTU, multas e
   juros de mora); **E**
3. existe **documentação hábil e idônea em nome e CPF dele** que descreve o que
   foi adquirido, o valor, e **corresponde àquele desembolso**; **E**
4. o dispêndio é **discriminado na DAA** do ano do pagamento.

**Então**: o valor **pago** compõe o custo no **ano-calendário da data de
pagamento**.

**Retenção de 11% não é condição de nenhuma das quatro.**

## 2. O vínculo é fiscal; o clique não é

**A correspondência entre dispêndio e documento é requisito FISCAL** [Certain] —
é a condição 3, e a palavra "correspondente" está no coração dela.

**Mas o clique em "conciliar" não é fiscal.** É como o app toma conhecimento de
uma correspondência que **já existe no mundo**. Se ele pagou R$ 3.000 por PIX e
tem a NF de R$ 3.000 no CPF dele, **o custo existe fiscalmente antes de qualquer
clique** — existiu no instante em que o dinheiro saiu com a nota lastreando. A
Receita não pergunta o que o contai marcou; pergunta o que está no acervo.

### Três estados, não dois

| Estado | O que é | O que o app deve dizer |
|---|---|---|
| **(a) Custo comprovado** | par completo no acervo | soma no custo confirmado |
| **(b) Custo real, ainda não demonstrável pelo app** | o par existe na vida dele, o app não conhece a correspondência | **aparece em tela, em linha própria, como "a confirmar" — nunca como zero** |
| **(c) Custo inexistente** | falta desembolso ou documento hábil, de verdade | fica de fora, vira pendência |

**Hoje o app colapsa (b) em (c). É esse o defeito.** [Certain]

### Veredicto sobre `status === "conciliado"`

**É uma trava fiscalmente correta implementada sobre um campo que ninguém
preenche — o que a torna, na prática, um bug de produto que esconde custo real.**
[Certain]

A exigência de correspondência **está certa e não se remove**. O que está errado
é (i) fazer a correspondência depender de um `status` que nenhuma tela grava, e
(ii) reportar a ausência de conhecimento do app como ausência de custo.

- **Modelagem**: `sustentaCusto` **não deve consultar `pagamento.status`**. A
  condição fiscal é *existe vínculo em `pagamento_documento` com documento
  hábil*. `status = 'conciliado'` vira **consequência**, nunca pré-requisito.
- **Verdade em tela**: enquanto ninguém puder criar o vínculo, **o zero não pode
  ser exibido como fato**.

## 3. Pagamento sozinho e documento sozinho

Nenhum sustenta custo declarável — e **falham por condições diferentes**.

- **Documento hábil sem pagamento** — falha a condição 1. Nota emitida não é
  dinheiro que saiu. **Não soma, e não é pendência de risco**: é documento no
  acervo esperando o desembolso que vai lastrear.
- **Pagamento sem documento hábil** — falha a condição 3. O dinheiro saiu e o
  custo econômico é real, mas **não é comprovável**: na intimação é glosado, com
  imposto, multa e juros. É o "pago sem nota", e está certo contar como risco.

**A meia medida, que é o caso comum da obra** — NF de valor alto paga em
parcelas:

> **Custo comprovado de um par = mínimo entre a soma dos pagamentos vinculados e
> a soma dos documentos hábeis vinculados. O excedente de qualquer lado cai na
> coluna correspondente.** [Certain]

Pagou R$ 1.000 de nota de R$ 3.000 → custo do ano = R$ 1.000. Pagou R$ 4.000
contra nota de R$ 3.000 → custo comprovado R$ 3.000, e o excedente de R$ 1.000 é
**"pago sem nota"**, não custo.

## 4. Os dois erros simétricos não são igualmente graves

**Contar documento sem exigir pagamento é o erro caro** [Certain]:

1. **custo inflado que vai para a declaração** — redução indevida de ganho de
   capital, cobrada na venda com multa e juros. **É a única direção de erro que
   produz passivo tributário.**
2. **custo no ano errado** — nota de dezembro paga em janeiro quebra o regime de
   caixa em dois anos ao mesmo tempo.
3. **duplicidade estrutural** — a nota consolidada contada integral **mais** os
   PIX que a pagaram.

**Contar pagamento sem exigir documento é erro real e menos grave**: o total fica
certo enquanto o acervo estiver completo, e mente na intimação. Danos extras:
entra o que **não é custo** (móveis, juros, IPTU), e **some o alerta** — o "pago
sem nota" deixaria de ser pendência e ninguém correria atrás da nota **enquanto
ainda há parcela a liberar**.

**Assimetria que fecha a decisão**: exigir os dois lados **subestima** — erro
corrigível a qualquer momento, sem custo tributário. Dispensar um lado
**superestima** — erro que só aparece na fiscalização. **Entre subestimar e
superestimar custo de aquisição, subestima-se.** Mas isso vale para o número que
compõe a declaração, **não** para o que a tela afirma sobre a obra: subestimar em
silêncio é o que o app faz hoje, e é o que precisa parar.

## 5. Regras mínimas para o número em tela ser verdadeiro

1. **O zero nunca aparece sozinho.** Texto:
   > **Custo confirmado no IR (2026): R$ 0,00**
   > Este número só conta o que o app consegue provar: pagamento **e** nota hábil
   > ligados entre si. **Não significa que seu custo é zero** — significa que o
   > app ainda não sabe qual pagamento pertence a qual nota.
2. **Terceiro número em tela — "documentos hábeis registrados, ainda sem
   pagamento vinculado"**, que **não soma** com o confirmado nem com o em risco:
   > **Notas hábeis sem pagamento vinculado: R$ 3.000**
   > Estas notas estão no seu CPF e valem como custo. Elas entram no "custo
   > confirmado" quando o pagamento correspondente estiver registrado e ligado a
   > elas.
3. **`sustentaCusto` deixa de consultar `pagamento.status`.**
4. **O caminho mais curto é o vínculo no ato do registro** — o caso dele é 1↔1,
   mesmo valor. A US-003 completa (N:M, parcial) é grande e não precisa vir toda.
5. **Proibido inferir vínculo por heurística.** "Mesmo favorecido, mesmo valor,
   datas próximas" **sugere**, nunca vincula sozinho. Vínculo inferido errado
   inflaciona custo em silêncio **e** mata o alerta — os dois erros de uma vez.
6. **Continua proibido**: boleto não sustenta custo; documento em quarentena não
   sustenta; **NF de serviço sem retenção sustenta integralmente.**

## 6. O que fazer com o registro que já existe

**Deixar. Não refazer, não apagar** — refazer produz duplicidade, que é o erro
caro. Complementar em quatro passos: registrar o pagamento com a **data em que o
dinheiro saiu da conta** e comprovante anexado; vincular os dois; completar
`numero`, `serie` e `data_emissao`; e tratar a ponta do INSS **separadamente**,
sem contaminar o custo.

## 7. Automático × humano

**Sistema sozinho** [Certain]: exigir os dois lados do par; alocar o custo no ano
da data de pagamento; aplicar o mínimo e jogar o excedente na coluna certa;
separar material de mão de obra; manter a exposição INSS fora de qualquer soma de
custo; avisar duplicidade; **e dizer por que um número é zero**.

**Só o Mateus**: confirmar que aquele PIX pagou aquela nota. É conhecimento dele,
e é a razão pela qual a heurística é proibida.

**Exige CRC**: o regime da empreitada e de quem é a responsabilidade
previdenciária desta nota; a pergunta nº 1, ainda pendente; o percentual da multa
de ofício em caso de custo inflado; e o texto que vai à declaração.

---

# ADENDO — 2026-08-18 · repartição cronológica do custo comprovado

- **Origem**: ratificação do agente `contador` no **Gate 2 do CONTAI-018**
  (item A1 do parecer de revisão), transcrita aqui porque **regra fiscal que só
  existe em transcript é a falha que o `CLAUDE.md` proíbe**. As emendas E1
  (ressalva do pagamento retroativo), E2 (separação dos tags do argumento 3) e
  E3 (a frase que se lia ao contrário) vieram da **2ª passada do Gate 2** do
  mesmo ticket, e estão incorporadas abaixo, no texto.
- **Status**: **regra fiscal do projeto** — deixou de ser "decisão de
  implementação pendente de ratificação", que era como o código a marcava.
- **Normativo para**: `lib/fiscal/vinculo.ts` (função `cronologico` e o laço de
  repartição de `alocarCusto`), e para qualquer cálculo futuro que reparta
  custo comprovado entre pagamentos.

## A regra

> **Se** um conjunto conexo tem custo comprovado
> **C = min(Σ pagamentos, Σ documentos hábeis)** e **Σ pagamentos > C**,
> **então** C é atribuído aos pagamentos do conjunto **em ordem crescente de
> data de pagamento**, cada um absorvendo até o seu valor integral, e o
> excedente não coberto ("pago sem nota") recai sobre os **pagamentos mais
> recentes**.
>
> Empate de data → ordem estável arbitrária (**sem efeito fiscal**: mesma data,
> mesmo ano-calendário).

Ela só muda o custo de um ANO quando o conjunto cruza anos-calendário; dentro
do mesmo ano ela continua decidindo em qual pagamento recai o "pago sem nota" —
o alerta do §4. (Regime de caixa: §1 e §3 deste parecer.)

## Por que cronológica, e não pro-rata

1. **Imutabilidade do ano já declarado** `[Certain]` — é o argumento decisivo.
   Qualquer regra não-cronológica faz o número de um ano mudar por causa de um
   fato de **outro** ano: pro-rata daria R$ 1.500 a 2026 num caso em que o app
   já dissera R$ 2.000, **contradizendo uma DAA entregue**. Sob a regra
   cronológica, **acrescentar um pagamento posterior nunca altera a alocação de
   um pagamento anterior**.

   > **Ressalva.** A imutabilidade vale para pagamentos acrescentados **depois**
   > na linha do tempo. Registrar um pagamento com data **anterior** à de
   > pagamentos já alocados, ou corrigir a data de um já registrado,
   > **redistribui o custo comprovado do conjunto e pode mover custo entre
   > anos-calendário** — inclusive de um ano já declarado. Não é defeito da
   > regra: é o fato novo chegando fora de ordem. Quando o ano afetado já foi
   > declarado, o caminho é **retificadora**, e isso **exige CRC**.

2. **A fotografia de 31/12** `[Likely]` — o que a ficha Bens e Direitos
   descreve naquela data é o que de fato estava **desembolsado e coberto**
   naquela data.
3. **O "pago sem nota" fica no pagamento mais recente** `[Certain]` — isto é
   aritmética da regra. Que esse pagamento seja **o único ainda cobrável do
   empreiteiro** é outra afirmação, inferência prática sobre a relação
   comercial: `[Likely]`, no máximo (§4 deste parecer: o alerta só serve se
   apontar para a nota que ainda dá para exigir). Os dois tags separados porque
   **"tag inflado é a mesma doença do número inflado"**.

## Alcance da ratificação

- A convenção **não exige CRC**.
- **Continuam exigindo CRC**: o **texto da discriminação** que vai à
  declaração; qualquer **retificadora**; e o caso de **venda entre os dois
  anos-calendário** do conjunto.

---

# ADENDO — 2026-08-18 · favorecido do pagamento que nasce ligado a uma nota

- **Origem**: pergunta do Mateus sobre `/adicionar/pagamento?documento=<id>` —
  "o nome e CNPJ podem ser read only carregados da NOTA neste caso?"
- **Motivo imediato**: `garantirFavorecido` (`lib/data.ts`) faz upsert por
  `user_id,documento` **sem** `ignoreDuplicates` e **sobrescreve o nome**.
  Um typo digitado hoje renomeia o favorecido em **todos os registros
  anteriores**, em silêncio.
- **Normativo para**: a tela de pagamento vinculado, a edição de documento e a
  integridade do cadastro de favorecidos.

## 1. Divergência entre favorecido do pagamento e emitente da nota

**Fiscalmente, o par que sustenta custo é `documento hábil ↔ desembolso
correspondente` (§1, condição 3 deste parecer). Quem recebe o dinheiro não é um
terceiro grau de liberdade: é atributo do documento.** `[Certain]`

Casos legítimos de o dinheiro ir para outro CNPJ existem — cessão de crédito /
factoring (boleto sacado por banco), pagamento por conta e ordem, e o clássico
"PIX para o CPF do sócio". Mas nenhum deles é um **favorecido diferente**:

- **Cessão/factoring** `[Certain]`: o credor da nota continua sendo o emitente.
  O banco é **instrumento de pagamento**, não beneficiário do negócio. Prova-se
  com o boleto + comprovante anexados, não trocando o nome do favorecido.
- **PIX para CPF de sócio contra nota da PJ** `[Certain]`: isso **enfraquece a
  prova**, não a fortalece. É exatamente a divergência que a fiscalização usa
  para dizer que o desembolso não corresponde ao documento. E na ponta do INSS
  é pior: pagamento a PF, com nota de PJ, contamina a leitura da empreitada.
  Não é caso a acomodar em campo — é caso a **sinalizar**.
- **Frequência numa obra residencial de PF**: rara. `[Likely]`

**Conclusão: o produto não deve oferecer o campo.** Divergência real se
documenta em observação + comprovante anexado, e entra na fila de **revisão
humana** — nunca reescrevendo o cadastro do favorecido.

## 2. Correção é na origem, e há dois erros diferentes

**Sim: corrige-se no documento; o pagamento herda.** `[Certain]` O pagamento não
tem opinião própria sobre quem emitiu a nota.

Mas separe os dois casos, porque um o app resolve e o outro não:

| O que está errado | Quem corrige |
|---|---|
| **A transcrição no app** (typo ao registrar a nota) | o Mateus, editando o documento |
| **A nota em si** (o emitente errou nome/CNPJ) | **só o emitente** — carta de correção ou NF substitutiva. Digitar por cima produz um registro que **não bate com o papel do acervo**, e é a divergência que derruba a prova |

**Rastro** `[Likely]` — não conheço regra que exija versionamento de um controle
pessoal (**confirmar na legislação**), mas a meta 3 do projeto já exige: quem
corrige dado de documento **que já tem pagamento vinculado** grava
antes→depois, data e autor. Sem isso, o acervo deixa de ser append-only na
prática, ainda que seja no banco.

**Regra dura**: **CNPJ/CPF não é campo corrigível.** É a identidade do
favorecido. CNPJ errado não é typo — é **outro favorecido**, e a saída é
corrigir o documento e refazer o vínculo, nunca reescrever a chave.

## 3. Efeito na ficha Pagamentos Efetuados

- A ficha é **por CPF, um lançamento por prestador PF** (§ regra do projeto).
  **A chave é o CPF; o nome tem que ser o que corresponde àquele CPF na base da
  Receita e no recibo.** `[Certain]` Nome divergente do CPF é gerador de malha.
- **O que a declaração exige preservar é o nome como consta no documento e como
  foi declarado à época** `[Likely]` — porque a DAA já entregue é um documento
  fechado; o app não pode passar a contar uma história diferente daquela.
  Renomear retroativamente cria divergência entre o acervo e uma declaração
  entregue, e é o Mateus que explica isso numa intimação, anos depois.
- Mesma pessoa com grafias diferentes não divide a obrigação (a chave é o CPF),
  mas **quebra a consolidação do app** e produz um acervo que parece
  desleixado. `[Certain]`

**O que isso decide**: nome de favorecido **muda por ato deliberado, com
rastro** — nunca como efeito colateral de registrar um pagamento. Read-only na
tela de pagamento implementa isso; **não substitui** corrigir o
`garantirFavorecido`, que é o caminho pelo qual o dano acontece.

## 4. Recomendação para a tela

**Read-only.** `[Certain]` Favorecido e CNPJ/CPF vêm da nota, exibidos como
herdados ("Favorecido — da nota NF 123"), sem campo de edição.

Saída do impasse, nesta ordem:
1. **Link "corrigir na nota"** → edição do documento, com rastro (§2). Volta ao
   pagamento com o dado novo.
2. **CNPJ/CPF errado** → não se edita: é outro favorecido. Corrige-se o
   documento e refaz-se o vínculo.
3. **Dinheiro foi mesmo para outro CNPJ** (cessão, factoring) → o favorecido
   segue sendo o emitente; a divergência vai em **observação + comprovante**, e
   o registro entra em **revisão humana**.
4. **Bloqueio total, nunca** — impasse sem saída ensina o usuário a inventar
   dado no campo que sobrou.

Fora da tela, e mais importante: **nenhum registro novo pode alterar
retroativamente dado de registro anterior.** Isso é requisito do acervo, não
preferência de UX.

## 5. Automático × humano

- **Sistema sozinho**: herdar o favorecido da nota; recusar edição de
  CNPJ/CPF; gravar rastro na correção do documento; sinalizar divergência
  emitente↔beneficiário do comprovante.
- **Exige CRC**: o efeito de uma correção de nome/CNPJ em ano **já declarado**
  (pode virar retificadora) e o tratamento da nota que o próprio emitente
  emitiu errado.

**Pergunta ao Mateus (uma só)**: algum pagamento da obra já saiu para conta
diferente do emitente da nota — boleto sacado por banco, ou PIX para CPF de
sócio da WK? Se nunca aconteceu, o caso 3 acima fica só como sinalização e não
vira caminho no produto.

---

# ADENDO — 2026-09-28 · cobertura prévia não é motivo de exclusão da lista de candidatos

- **Origem**: `CONTAI-074`. Caso real — fornecedor de concreto usinado com 3
  notas pagas por 7 lançamentos (PIX + parcelas de dois cartões diferentes),
  sem correspondência 1:1 limpa entre parcela e nota. `pagamentosCandidatos`
  (`lib/fiscal/vinculo.ts`) esconde um pagamento já 100% absorvido por uma nota
  quando o Mateus tenta ligá-lo TAMBÉM a uma segunda nota do mesmo fornecimento.
  O Mateus confirmou que precisa da capacidade — não é caso de redistribuir sem
  repetir, é o mesmo pagamento contando para mais de uma nota mesmo.
- **Consome**: §1 (condição 3 — correspondência), §2 (o vínculo é fiscal, o
  clique não) e §3 (teto do mínimo por conjunto conexo) deste parecer; o ADENDO
  de 18/08 do mesmo arquivo (repartição cronológica); e
  `2026-08-18-compromisso-versus-pagamento.md` §5.1 (defesa estrutural do teto
  do mínimo contra dupla contagem).
- **Normativo para**: `pagamentosCandidatos`, `documentosCandidatos`,
  `pagamentosOcultosPorCobertura`, `documentosOcultosPorCobertura` e as
  constantes `CANDIDATO_OCULTO_PAGAMENTO`/`CANDIDATO_OCULTO_DOCUMENTO`, todas em
  `lib/fiscal/vinculo.ts`.

## 1. Não existe regra fiscal que proíba um pagamento de servir a duas notas

`[Certain]` A condição 3 do §1 ("existe documentação hábil... que corresponde
àquele desembolso") nunca foi 1:1 — é apurada por **conjunto conexo**, não por
par isolado. É exatamente por isso que `alocarCusto` existe como grafo
bipartido com união por componente (§3, ADENDO de 18/08): o sistema já foi
desenhado para obra real, em que parcela e nota raramente coincidem
limpamente. Ligar o mesmo pagamento a uma segunda nota apenas **funde dois
componentes num só**; o pagamento é um nó — entra **uma vez** na soma de
`Σ pagamentos elegíveis`, qualquer que seja o número de vínculos (arestas) que
partem dele. O teto `custoComprovado = min(Σ pagamentos, Σ documentos hábeis)`
do componente resultante nunca deixa o custo exceder o que foi de fato pago,
nem conta o mesmo pagamento duas vezes.

**Conclusão**: o filtro atual (`temSaldoSemNota` escondendo pagamento com
saldo zero) é conveniência de UX para reduzir ruído na lista comum — não é
regra fiscal. Hoje ele bloqueia, sem querer, um cenário legítimo e recorrente
em obra: fornecedor que fatura em notas que não seguem o parcelamento do
pagamento.

## 2. Regra exata

**(a) Permitir a segunda ligação**

SE o pagamento e o documento pertencem à mesma obra (`MOTIVO_OBRA_DIFERENTE`,
inalterado) E o pagamento ainda não está ligado a ESTE documento específico
(inalterado) → **permitir** a ligação, mesmo que o pagamento já tenha 100% do
seu valor absorvido por vínculo com outro(s) documento(s). Cobertura prévia
por **outro** documento deixa de ser motivo de exclusão da lista de candidatos
ou de recusa da ligação.

SE a nova ligação une dois componentes conexos antes separados → **revalidar**
(recalcular) `custoComprovado` do componente resultante pela fórmula já
existente. Nenhuma trava nova é necessária: a fórmula já impede inflar custo
ou contar o mesmo pagamento mais de uma vez.

Continua **recusando** (inalterado): obras diferentes; ligação de um pagamento
a um documento ao qual ele já está ligado (vínculo idêntico repetido).

**(b) Aviso obrigatório antes da confirmação**

SE o pagamento selecionado já possui um ou mais vínculos com outro(s)
documento(s) → **avisar**, antes de gravar a nova ligação, citando
nominalmente cada nota já vinculada (identificador e valor). Texto:

> Este pagamento já está ligado a [Nota nº X — R$ valor][, Nota nº Y — R$
> valor]. Ligá-lo também a esta nota é permitido: o mesmo pagamento pode
> servir de prova para mais de um documento, sem duplicar valor — o sistema
> nunca conta o mesmo pagamento duas vezes na soma. Confirme que este
> pagamento realmente corresponde também a esta nota, e não é engano.
> [ Cancelar ]  [ Confirmar ligação também a esta nota ]

**Marcar** (sempre, não só no aviso): na própria lista de candidatos, o
pagamento já vinculado aparece identificado com a nota a que já está ligado —
mantém a doutrina "nunca sumiço mudo" (§ deste parecer, crit. 15/C4 do Gate 2).

## 3. `CANDIDATO_OCULTO_PAGAMENTO`/`CANDIDATO_OCULTO_DOCUMENTO` presumem erro — corrigir

`[Certain]` O texto vigente ("abra a nota errada e desligue-o antes de ligar
aqui") só cobre o caso em que o vínculo anterior foi engano. A partir deste
ADENDO, "pagamento já coberto" deixa de implicar "vínculo anterior é erro":
passa a ter duas saídas — engano a desfazer, ou intenção a manter e
complementar — e o texto precisa nomear as duas, nunca escolher uma no lugar
do usuário.

**Redação que substitui as constantes atuais** (adaptar ao componente, sem
perder a substância):

> Pagamento já ligado a outra nota, com valor totalmente absorvido, não
> aparece aqui por padrão. Se este pagamento também é desta nota — é
> permitido: o mesmo pagamento pode servir de prova para mais de uma nota,
> desde que a soma não ultrapasse o que foi realmente pago —, revele-o para
> escolher. Se ele foi ligado à nota errada por engano, abra a nota errada e
> desligue-o antes de ligar aqui.

(Espelhar para `CANDIDATO_OCULTO_DOCUMENTO`, trocando "nota" ↔ "pagamento".)

## 4. Pagamentos Efetuados (CPF-por-CPF) e discriminação anual — sem risco de duplicar, com uma condição técnica

`[Certain]` Nenhum relatório de saída duplica valor, **desde que** continue
agregando a partir da tabela de pagamentos (uma linha por pagamento, um valor,
uma data, um CPF/CNPJ) — nunca a partir das linhas de `pagamento_documento`
(a junção). Um pagamento ligado a duas notas continua sendo **um** pagamento
com **um** valor: soma uma vez na ficha Pagamentos Efetuados e uma vez na
discriminação, exatamente como `alocacao.porPagamento` (mapa por
`pagamento.id`) já faz hoje em `lib/fiscal/vinculo.ts` e como
`carregarSaidaAnual` (`lib/dados/saida-anual.ts`) já consome.

O motivo certo não é "é o mesmo favorecido recebendo" — é que a ficha soma
**desembolsos**, não **vínculos**, e desembolso é atributo do pagamento, não
do documento. Valeria mesmo se as duas notas fossem de favorecidos diferentes
ligados ao mesmo pagamento (cessão de crédito — ver o ADENDO de 18/08 deste
mesmo arquivo, "favorecido do pagamento que nasce ligado a uma nota").

**Ponto de atenção técnico para o `cto-obra`, não fiscal**: a ficha
"Pagamentos Efetuados" ainda não tem gerador dedicado no código (busca no
repositório não encontrou um). Quando for construída, precisa somar por
`pagamento.id` **distinto** — nunca por linha de junção pagamento×documento —
sob pena de duplicar o mesmo desembolso ao CPF de um favorecido só porque ele
tem dois vínculos.

## 5. Automático × humano

**Sistema sozinho** `[Certain]`: permitir a segunda ligação quando as condições
do §2(a) valem; recalcular o teto do componente; avisar citando as notas já
vinculadas; marcar visualmente cobertura prévia na lista de candidatos; manter
a recusa por obra diferente e por vínculo idêntico repetido.

**Exige CRC**: nenhuma exigência nova além das já registradas neste parecer e
no de 18/08 (retificadora por realocação cronológica retroativa; texto final
da discriminação).

**Alcance**: esta convenção não abre tese fiscal nova — materializa, no filtro
de candidatos e no texto de aviso, uma capacidade que a fórmula de
`alocarCusto` já suportava desde 17–18/08/2026.

---

# ADENDO — 2026-09-28 (2) · redação final ratificada: `avisoDocumentoJaLigado` e `CANDIDATO_OCULTO_DOCUMENTO`

- **Origem**: Gate 2 técnico do CONTAI-074 (`cto-obra`) — veredito **APPROVE**,
  condicionado a este registro. O ADENDO acima (mesma data) fixou a **regra**
  em §2(b) e uma **instrução de redação** em §3 ("espelhar, trocando
  nota↔pagamento"), mas não citava o **texto literal** que acabou implementado
  em `lib/fiscal/vinculo.ts`. Esta seção fecha essa pendência: cita o código
  como está hoje e ratifica o conteúdo fiscal de cada trecho, para que texto de
  tela com consequência fiscal continue vindo do parecer, e não do commit.
- **Consome**: ADENDO de 2026-09-28 acima (§2(b), §3); §1 e §3 do corpo deste
  parecer (correspondência por conjunto conexo, não por par isolado).
- **Normativo para**: `avisoDocumentoJaLigado`, `avisoPagamentoJaLigado` e
  `CANDIDATO_OCULTO_DOCUMENTO` em `lib/fiscal/vinculo.ts`; os textos exibidos
  em `app/(gestao)/pagamento/[id]/ligar/page.tsx` e
  `app/(gestao)/documento/[id]/ligar/page.tsx`.

## 1. `avisoDocumentoJaLigado` — texto literal (direção pagamento→documento)

Usada em `app/(gestao)/pagamento/[id]/ligar/page.tsx`: aviso mostrado quando o
Mateus está ligando um PAGAMENTO a uma nota candidata que **já está ligada a
outro pagamento**. Texto literal, hoje, em `lib/fiscal/vinculo.ts`:

> Esta nota já está ligada a [lista]. Ligá-la também a este pagamento é
> permitido: a mesma nota pode ser comprovada por mais de um pagamento, sem
> duplicar valor — o sistema nunca conta a mesma nota duas vezes na soma do
> custo. Confirme que esta nota realmente corresponde também a este
> pagamento, e não é engano.

**Ratificado.** `[Certain]` A razão fiscal não é a mesma do aviso irmão: aqui
não há um pagamento repetido — há **dois pagamentos reais e distintos**
provando a **mesma nota** (o caso concreto do CONTAI-074: 3 notas de concreto
usinado pagas por 7 lançamentos, sem correspondência 1:1). O nó que não pode
entrar duas vezes na soma do custo é a **NOTA**, não o pagamento — é a
condição 3 do §1 deste parecer apurada por conjunto conexo, com o teto
`min(Σ pagamentos, Σ documentos hábeis)` do §3 garantindo que a nota nunca é
contada duas vezes. Direção pagamento→documento: **"mesma nota não duplica no
custo"**.

## 2. `CANDIDATO_OCULTO_DOCUMENTO` — texto literal, e por que não é o espelho mecânico

Texto literal, hoje, em `lib/fiscal/vinculo.ts`:

> Nota já ligada a outro pagamento, com valor totalmente absorvido, não
> aparece aqui por padrão. Se esta nota também é deste pagamento — é
> permitido: a mesma nota pode ser comprovada por mais de um pagamento, desde
> que a soma não ultrapasse o que foi realmente pago —, revele-a para
> escolher. Se ela foi ligada ao pagamento errado por engano, abra o
> pagamento errado e desligue-a antes de ligar aqui.

**Ratificado — e a formulação escolhida é a correta, não a variante mais
óbvia.** `[Certain]` A instrução de §3 do ADENDO acima dizia "espelhar,
trocando nota↔pagamento", o que produziria mecanicamente *"a mesma nota pode
**servir de prova para** mais de um pagamento"* (espelho literal de
`CANDIDATO_OCULTO_PAGAMENTO`: *"o mesmo pagamento pode servir de prova para
mais de uma nota"*). O código não fez esse espelho mecânico — usou **"pode
ser comprovada por"** — e essa escolha está certa fiscalmente:

- O par que sustenta custo é `documento hábil ↔ desembolso correspondente`
  (§1, condição 3). Quem **prova** o quê tem direção: o **pagamento** (o
  desembolso, com comprovante de transferência) é a evidência de que o
  dinheiro saiu; a **nota** é o documento que descreve o que foi adquirido.
  Na relação de prova, é o pagamento que comprova a nota — não o contrário.
- Por isso **"a nota é comprovada por pagamentos"** descreve a direção real;
  **"a nota serve de prova para pagamentos"** (o espelho mecânico) inverteria
  essa direção e afirmaria algo que não é verdade: uma nota não é evidência de
  que um desembolso ocorreu, ela é evidência do que foi comprado.
- `CANDIDATO_OCULTO_PAGAMENTO` ("pagamento pode servir de prova para nota")
  está correto na sua própria direção pelo mesmo motivo: ali o pagamento
  segue sendo quem prova.

Espelho de forma (estrutura da frase, "não aparece por padrão… revele-o…
engano") continua valendo — é conteúdo semântico (quem prova o quê) que não
podia ser espelhado mecanicamente, e o código acertou ao não fazer isso.

## 3. Confirmação da direção-espelho: `avisoPagamentoJaLigado`

Usada em `app/(gestao)/documento/[id]/ligar/page.tsx` (direção
documento→pagamento). Texto literal, já citado em §2(b) do ADENDO acima e
confirmado idêntico ao código atual:

> Este pagamento já está ligado a [lista]. Ligá-lo também a esta nota é
> permitido: o mesmo pagamento pode servir de prova para mais de um
> documento, sem duplicar valor — o sistema nunca conta o mesmo pagamento
> duas vezes na soma. Confirme que este pagamento realmente corresponde
> também a esta nota, e não é engano.

**Ratificado.** `[Certain]` Aqui o nó que não pode duplicar na soma é o
**PAGAMENTO** — "mesmo pagamento não conta duas vezes". Não precisa (e não
deve) ser textualmente idêntica à de §1 acima: são duas direções do mesmo
vínculo N:M, cada uma protegendo o nó que lhe corresponde (nota de um lado,
pagamento do outro), exatamente como o código já documenta em comentário
próprio sobre as duas funções.

## 4. Automático × humano

Sem mudança em relação ao ADENDO acima (mesma data): nenhuma exigência nova de
CRC. Esta seção é registro documental de texto já implementado e já ratificado
no conteúdo fiscal — fecha a pendência do Gate 2, não abre tese nova.
