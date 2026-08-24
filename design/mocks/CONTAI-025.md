# CONTAI-025 — spec do mock
Nível: 1 (HTML navegável)   Cenário: gestão (casa, sentado; 375px = piso, 720px = mesa)   Arquivo: CONTAI-025.html
Telas: 4 (+1 fluxo ASCII) — 1 Home/painel · 2 Formulário do desembolso · 3 Lista de desembolsos · 4 Revisão anual
Status: **v2.1** — v2 **APROVADA pelo Mateus em 2026-08-23**; a v2.1 recolhe três adjudicações do
`contador` no Gate 2 do `/develop` (nenhuma muda layout, hierarquia ou fluxo — só texto)

## v2.1 — o que mudou da v2 (2026-08-23, Gate 2 do `/develop`)
1. **O terceiro rótulo do Gravar foi ADJUDICADO** — era a pergunta 2, e o `contador` **recusou a
   simetria óbvia** que eu havia proposto. Vale *"Gravar — e abrir a pendência da data **que
   falta**"*. Razão: *"da data" × "de datas"* faria uma distinção fiscal real depender de **uma
   letra**, no mesmo formulário em que nasce a pendência *"um lançamento, mais de uma data"*
   (CONTAI-027). A palavra carrega a distinção, não o singular/plural. ⚠️ O rótulo do CONTAI-027
   **não** se alinha a este agora — é ticket P2 próprio.
2. **A recusa de DATA NO FUTURO tem texto novo** (não aparecia em tela no mock v2 — é erro de
   validação). O texto antigo oferecia **só** *"registre como 'ainda não paguei'"*, e isso ganhou um
   defeito quando o campo vazio passou a gravar: o erro mais provável deixou de ser "ainda não
   pagou" e passou a ser **data errada num pagamento real**, para o qual `previsto` é a pior saída
   possível (tira o valor de **todo** ano-calendário). Redação do `contador`, literal:
   "**Data no futuro — o dinheiro não pode ter saído depois de hoje. Se você errou a data,
   corrija-a; se não lembra, deixe o campo vazio: o valor grava assim mesmo e a data fica como
   pendência. Só marque 'ainda não paguei' se o dinheiro realmente não saiu — isso tira este valor
   de todo ano-calendário.**"
   ⚠️ Isto **não** contraria o critério 6: ali o próprio dado diz que o dinheiro não saiu — é
   contradição interna, não `previsto` oferecido como fuga a valor já pago.
3. **A recusa de data no futuro tem DOIS textos, um por ato** — e são **constantes separadas**, não
   uma reaproveitada. Palavras do `contador`: *"são dois atos diferentes, e colapsar os dois textos
   é o que faria o 'deixe vazio' aparecer onde não cabe"*. No **registro**, campo vazio **grava** e
   abre a pendência; no **complemento** ("Informar a data", `s2d` do CONTAI-027) o ato **existe para
   informar a data**, e a saída segura é **sair sem gravar** — a pendência continua aberta e nada se
   perde. Texto do complemento, literal: "**Data no futuro — o dinheiro não pode ter saído depois de
   hoje. Confira a data no extrato: é ela que decide o ano-calendário deste custo. Se não achar
   agora, saia sem gravar — a pendência continua aberta e nada se perde.**"
   ⚠️ Ele **não** menciona `previsto` (critério 6): quem completa a data **já disse que pagou** — ali
   não há a contradição interna que justifica a menção no texto do registro. O texto anterior
   (*"informe a data real do pagamento"*) mandava acertar **sem nomear o que faz quem não sabe**.
   Nenhuma das duas telas do mock renderiza validação de data futura: é registro de texto, sem
   mudança de layout.

## v2 — o que mudou da v1 (2026-08-23)
1. **"Falta a data" vira VERMELHA** (s1 e s3) — veredito do `po` na pergunta 3. Régua binária, **sem
   terceiro nível**: *saiu? → tem apoio hábil no ano certo? → não = vermelho*. Na v1 era cinza por herança
   do CONTAI-027, não por critério — e a inversão ficava de pé: "mais de uma data" (valor no custo, só o
   ano em aberto) vermelha, "falta a data" (valor em **ano nenhum**) cinza. `.divida mud` deixa de ser
   usada para pendência.
2. **O estado combinado passa a ter UM chip** — "Pago — falta a data e o comprovante". Duas travas do `po`:
   o chip **nomeia os dois fatos** (nenhum some na fusão) e a consequência **não** funde — continuam as
   **duas frases** do parecer, com **"Comece pela data" literal**.
3. **A linha da titularidade repartida SAIU** (s4) — decisão do Mateus, virou a **D53**: o problema é
   rateio por pagador em cada lançamento, não "dois nomes na matrícula". Era a pergunta 4.
4. **O CONTAI-027 não foi reescrito** — o "Falta a data" cinza de lá é da versão aprovada em 21/08 e
   recebe **nota datada de 23/08**; o carimbo novo sai aqui. Os outros cinco itens do inventário de cor
   viraram o **CONTAI-035**.

## Por que nível 1, e não 2
O card do ano deixa de ser **um** número e o **estado combinado** não tem precedente em tela nenhuma.
São decisões de hierarquia e ordem de leitura — o Mateus não julga isso lendo. Nenhuma pendência nasce
nova; o que nasce é a **exclusão da soma** e a **superfície agregada**.

## Telas e estados
- **Fluxo** (`#s0`): ASCII, só sucesso — tela de acordo de fluxo, não de produto
- **Home / painel da obra** (`#s1`): sucesso com pendência (2 números no card do ano + card agregado
  vermelho + card **vermelho** da pendência de data — v2). **Vazio** = sem desembolso pago-sem-comprovante: o card
  agregado **não aparece** e o card do ano volta a ter **um** número. Loading e erro herdados
  (`Carregando`, `EstadoErro`), não redesenhados
- **Formulário do desembolso** (`#s2`, interativa): vazio | `previsto` (sem data e sem papel) | papel sem
  classificação (Gravar desabilitado) | 4 combinações de pago (com/sem data × com/sem comprovante).
  Sem loading e sem erro nesta rodada — o `salvando` já existe
- **Lista de desembolsos** (`#s3`): sucesso com 4 linhas — combinada (**1 chip**, v2) · pago-sem-comprovante ·
  pago-sem-papel-nenhum · confirmada. Mais **2 estados de mensagem** depois de "Informar a data"
  (§5, dois textos). Sem loading, sem vazio, sem erro
- **Revisão anual** (`#s4`): **fatia 1** = saída não gerada, falha nomeada (crit. 16) | **fatia 2** =
  bloco copiável + linha do §4.5 + linha da titularidade. Sem loading, sem vazio, sem erro

## Campos
- `fTipo` — escolha 1-de-3 (Entrada / ITBI / Escritura e registro) — obrigatório — sem escolha o Gravar fica desabilitado — SEM DEFAULT
- `fValor` — texto `inputmode="decimal"` — obrigatório — vazio desabilita o Gravar — SEM DEFAULT
- `fEstado` — escolha 1-de-2 (Já saiu da conta / Ainda vou pagar) — obrigatório — sem escolha o Gravar fica desabilitado — SEM DEFAULT
- `fData` — date — opcional no desembolso pago — vazia grava e abre a pendência da data, **vermelha** (v2); data **no futuro** é a única recusa que sobrou, com o texto novo da v2.1; em `previsto` o campo não existe (constraint `terreno_desembolso_previsto_sem_data`) — SEM DEFAULT
- `fPapeis` — `input[type=file][multiple]` — opcional — zero papéis grava, e é o ponto do ticket — SEM DEFAULT
- `fPapel` — escolha 1-de-3 por papel (Comprovante do pagamento / Nota ou recibo / Contrato ou escritura) — obrigatório para o papel que existir — validação `PAPEL_SEM_RESPOSTA` do CONTAI-027, crit. 14 — SEM DEFAULT

## Textos com consequência fiscal — COPIADOS do parecer, não redigidos
Fonte: `docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md` (ADENDO 1 vence o corpo).
- Chip **"Pago sem comprovante"** (§4.1) — s1 (agregado), s2 (consequência), s3 (2 linhas)
- Pendência (§4.2): "**Pago sem comprovante.** O valor e a data ficam registrados — o custo existe, ainda
  não está demonstrável. Enquanto faltar o papel, este desembolso não entra no custo confirmado. /
  Recupere o comprovante enquanto o banco ainda o mostra: ele é o documento do acervo que expira primeiro."
- Linha auxiliar (§4.3) — **em DOIS lugares**: junto da pendência (s1) **e no momento de escolher o papel**
  (s2). "**Entrada ou sinal** — comprovante da transferência, ou recibo do vendedor. A escritura prova o
  preço, não o pagamento. / **ITBI** — a guia paga, com a autenticação. A prefeitura costuma reemitir a
  segunda via. / **Escritura e registro** — o recibo de custas do cartório, que costuma reemitir."
- Estado combinado (Gate Fiscal §4) — **um chip** "Pago — falta a data e o comprovante" (v2) e **uma**
  caixa, ordem data → comprovante. A fusão é só de **apresentação**: o chip nomeia os dois fatos, a caixa
  mantém as duas frases e **"Comece pela data" é literal**. Texto: "**Pago — falta a data e
  falta o comprovante.** As duas faltas são independentes e nenhuma delas apaga o registro. Sem a data,
  este valor não tem ano-calendário e não entra em ano nenhum. Sem o comprovante, ele não entra no custo
  confirmado nem no ano em que a data o puser. / Comece pela data: ela está no extrato, no mesmo lugar em
  que o comprovante está — as duas costumam voltar da mesma busca."
- Rótulos do Gravar: "Gravar o desembolso" · "**Gravar — e abrir a pendência do comprovante**" ·
  "**Gravar — e abrir a pendência da data que falta**" (adjudicado em 23/08, v2.1) ·
  "**Gravar — e abrir as duas pendências**" · "Diga o que é cada papel para gravar (N sem resposta)" ·
  "Preencha o desembolso para gravar" · "Gravar o compromisso" (`previsto`)
- Recusa de **data no futuro** (v2.1, `contador`): "Data no futuro — o dinheiro não pode ter saído
  depois de hoje. Se você errou a data, corrija-a; se não lembra, deixe o campo vazio: o valor grava
  assim mesmo e a data fica como pendência. Só marque 'ainda não paguei' se o dinheiro realmente não
  saiu — isso tira este valor de todo ano-calendário."
- Recusa de **data no futuro NO COMPLEMENTO** (v2.1, `contador`) — **texto diferente do de cima, de
  propósito**: "Data no futuro — o dinheiro não pode ter saído depois de hoje. Confira a data no
  extrato: é ela que decide o ano-calendário deste custo. Se não achar agora, saia sem gravar — a
  pendência continua aberta e nada se perde."
- Mensagem de sucesso, **dois textos** (§5, crit. 13): "Data informada — o valor passa a compor o custo de
  {ano}." (só com `comprovantesDe(d).length > 0`) · "Data informada — o valor é de {ano}. Falta o
  comprovante: até ele chegar, este desembolso não entra no custo confirmado."
- Linha do relatório anual (§4.5), s4: "**Fora do custo confirmado por falta de comprovante: R$ X.** Foi
  pago e está registrado, mas ainda não tem o papel que o demonstra, e por isso não entra na soma acima.
  Decida com seu contador antes de declarar: deixar de discriminar na declaração um custo real também
  custa caro — o custo que não é discriminado não existe na venda."
- ~~Titularidade repartida (Gate Fiscal §2), s4~~ — **REMOVIDA na v2**. Não é condicional, não é "aparece
  depois da US-D": é a **D53**, ticket próprio. Não implementar nesta rodada.
- "Pago, e sem papel nenhum" (crit. 15 do CONTAI-027) — **fica**, e é o texto do caso **zero anexo**. §4.2 é
  o caso **tem papel, nenhum comprovante**. Conjuntos diferentes, chips diferentes, mesma exclusão da soma
- A data (crit. 4): "A data que vale é a do débito no extrato." · "O app nunca inventa a data."

## Decisões de design
1. **O segundo número usa o rótulo do §4.5 também na home** ("Fora do custo confirmado por falta de
   comprovante"), em vez de um nome novo. Texto de consequência fiscal se copia; dois nomes para o mesmo
   número é como nasce a D46
2. **O card do ano é por ANO; o card agregado é da OBRA.** O desembolso sem data não tem ano-calendário e
   por isso **não** entra no segundo número de 2026 (R$ 85.000,00), mas entra no agregado (R$ 89.200,00).
   A diferença é dita em tela — número que não bate sem explicação é pior que número ausente
3. **O agregado inclui o caso zero-anexo.** Se ficasse de fora, os dois números deixariam de fechar com o
   que o portão (`comprovantesDe(d).length > 0`) exclui — pre-mortem 2 do ticket. A distinção vive na
   **linha**, com chip próprio (ver pergunta 1)
4. **`previsto` esconde data e papéis** em vez de desabilitá-los: previsto sem data é constraint de banco
   (`0008`). E nenhum texto oferece `previsto` como saída de quem já disse que pagou (§1.4.1)
5. **A linha do §4.5 fica FORA do bloco copiável, imediatamente abaixo dele** — o total é a última linha do
   bloco, então "logo abaixo do total" é atendido. Dentro do bloco é texto de declaração; o §4.5 é
   orientação, e colá-lo na ficha seria o app escrevendo na DAA
6. **A fatia 2 está no mesmo mock, atrás de um seletor de fatia** — desenhar não é entregar, e o crit. 16
   continua travando a geração. Evita uma segunda rodada de `/design`
7. **Cor da pendência: régua binária, sem terceiro nível** (v2). Propus um terceiro nível separando
   "depende de terceiro" de "fecha sozinho"; o `po` recusou, e procede: esforço de resolução é **roteamento
   de ação** — já é o **botão** de cada card — e promovê-lo a cor faria o app dizer "isto é leve" sobre um
   valor que não cai em ano nenhum. O relato 005 desmente o "fecha em 30 segundos": o comprovante está na
   conta de outra pessoa, e a ausência dura **meses**. O que a lista realmente perde é **ordem de topo
   cronológica em vez de fiscal** — dor real, minha, e **não custa cor nenhuma**; fica anotada abaixo.
8. **Zero papel grava; papel sem classificação, não** (crit. 5/14). O rótulo do Gravar diz qual falta —
   botão cinza mudo faz achar que quebrou

## Perguntas em aberto — nenhuma delas eu decido sozinho
1. **`po`** — o card agregado é **um só**, com o chip do §4.1, contando também os zero-anexo? (Desenhei sim)
2. ✅ **RESPONDIDA pelo `contador` em 23/08, e ele RECUSOU a minha proposta.** O rótulo é
   "Gravar — e abrir a pendência da data **que falta**" — ver v2.1, item 1. Aplicada.
3. ✅ **RESPONDIDA pelo `po` em 23/08** — vermelho, régua binária, sem terceiro nível. Aplicada na v2.
4. ✅ **DECIDIDA pelo Mateus em 23/08** — a linha sai; virou a **D53**. Aplicada na v2.

## Aberta, e é minha — não custa cor
A lista de pendências ordena por **data do lançamento**. Com todos os chips vermelhos, a ordem de topo é o
que resta de hierarquia, e hoje ela é cronológica, não fiscal. Proposta a fechar numa próxima rodada
(candidata a nível 2, spec + ASCII): ordenar por **quanto está fora da soma** e, no empate, pelo eixo que
tranca mais adiante (sem data > sem comprovante). Não entra nesta v2 — é mudança de regra de listagem, e o
`po` precisa dizer se o critério é valor ou eixo.

## Navegação
- s1 → s3 ("Ver os 3 desembolsos") · s1 → s2 ("Registrar um desembolso") · s4 → s3 ("Abrir a lista")
- **Não redesenhado**: "Informar a data" / `completarDesembolsoTerreno` — aprovado no CONTAI-027 (`s2d`),
  é o caminho de baixa dos **dois** eixos. O fluxo de captura de pagamento e o resto do painel do terreno
  também ficam fora: não mudaram
