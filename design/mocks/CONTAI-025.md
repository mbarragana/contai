# CONTAI-025 — spec do mock
Nível: 1 (HTML navegável)   Cenário: gestão (casa, sentado; 375px = piso, 720px = mesa)   Arquivo: CONTAI-025.html
Telas: 4 (+1 fluxo ASCII) — 1 Home/painel · 2 Formulário do desembolso · 3 Lista de desembolsos · 4 Revisão anual
Status: **v2** AGUARDANDO APROVAÇÃO do Mateus · 2 perguntas em aberto (1 ao `po`, 2 ao `contador`)

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
- `fData` — date — opcional no desembolso pago — vazia grava e abre a pendência da data, **vermelha** (v2); em `previsto` o campo não existe (constraint `terreno_desembolso_previsto_sem_data`) — SEM DEFAULT
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
  "**Gravar — e abrir as duas pendências**" · "Diga o que é cada papel para gravar (N sem resposta)" ·
  "Preencha o desembolso para gravar" · "Gravar o compromisso" (`previsto`)
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
2. **`contador` via `po`** — falta o **terceiro rótulo do Gravar**: tem comprovante, falta a data. Os dois
   adjudicados cobrem só "sem comprovante" e "as duas". Pus "Gravar — e abrir a pendência da data"
   **marcado em tela como não adjudicado**. Não redijo texto fiscal de memória
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
