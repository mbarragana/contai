# CONTAI-019 — Pagamento agendado: compromisso previsto × pagamento executado

## Tipo e Prioridade

feature (fiscal + usabilidade) — **P1**. **2º da fila da R1**, atrás do CONTAI-018.

Desmembrado do CONTAI-018 (diretriz D2, 2026-08-18) e **reescreve a US-002**: ela
deixa de ser "fila de boletos a pagar com lembrete" e vira compromisso de
pagamento previsto, com boleto sendo *uma* origem e o PIX agendado sendo outra.

- **Gate 0 (mock)**: **APROVADO pelo Mateus** — mock v2, `012fb13`
  (`design/mocks/CONTAI-019.html`). As três reprovações dele foram atendidas.
  ⚠️ **O mock v2 NÃO aplicou 3 das 8 correções que este ticket lista** (itens 1,
  2 e 3 de *"Correções pendentes no mock"*), e por isso está **defasado do
  código** em quatro pontos — ver *Divergências declaradas*, abaixo.
- **Gate Fiscal**: **FECHADO** — `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`
  (`4e0cf87`), mais **ADENDO 1** (§§A–E), **ADENDO 2** (`238a650`), **ADENDO 3**
  (`397095b`, §§F–G) e **ADENDO 4** (`d69a3cf`, §§H.1–H.7, a quinta resolução).
  **A fonte é o arquivo**; a transcrição abaixo permanece como histórico e perde
  para o parecer em qualquer divergência.
- **Gates do `/develop`**: G1a `0441187` · G1b `df36b41` · G2 `50958a1`
  (retrabalho dos 4 bloqueadores) · G3 `3ec2913` · **G4 (`po`)**: **FAIL em
  18/08**, por lastro documental — a quinta resolução estava no enum e **não no
  parecer**. Fechado por `d69a3cf` (`contador`) + esta revisão.
- **Pendências fechadas em 18/08** pelo `po` + `designer` + `contador`, sem ida
  ao Mateus: seção *Decisões de fechamento* no fim.

## Divergências declaradas do mock v2 — RATIFICADAS no Gate 4

*A regra do `/develop` é que divergir do mock aprovado é FAIL **a menos que
aprovada**. As quatro abaixo foram ratificadas pelo `po` em 18/08, e a
**precedência é ticket > mock** — mas só neste caso e por este motivo: o mock v2
foi aprovado sobre uma versão que **o próprio ticket já declarava incompleta**.
**Aprovação não converte pendência declarada em decisão tomada.** Divergência em
ponto que o ticket NÃO listava seria FAIL sem discussão.*

1. **A data da confirmação nasce VAZIA, sem atalho "hoje"** — o mock v2 ainda
   pré-preenche (s10). Vence o **critério 17** + decisão nº 1: é a **mitigação
   real do item 3 do pre-mortem**, e o ticket original apontava como mitigação o
   próprio critério que causava o risco.
2. **Borda TRACEJADA nos dois estados**, com `border-2` no vencido — o mock v2
   troca por sólida (`CONTAI-019.html:660`, `:894`) e **perde uma das quatro
   marcas**. O próprio ticket lista isso como **defeito** (critério 8).
3. **A lacuna da s12 virou pendência vermelha na home**, com as resoluções do
   §F.2 e *"não sei ainda"* inicial — correção nº 3, não aplicada na v2.
4. **Escopo acrescentado: a tela `/compromisso` ("ver todos")** — o critério 43
   a exige por implicação, e **link que não abre nada é o defeito que o
   CONTAI-018 veio matar**. Fura mock-first na letra; aceita porque é lista sem
   campo, sem regra fiscal e sem decisão. **Entra no mock retroativamente.**

⚠️ **O mock precisa ser atualizado, e não é opcional**: enquanto a v2 estiver
defasada, o próximo `/design` lê `CONTAI-019.html:660`, vê borda sólida no
vencido e **reimplanta o defeito com a bênção de um arquivo aprovado**.

## Dor de Origem

> "o pagamento pode ser um registro para futuro ou já feito, isso será
> contabilizado pela data de execução" — Mateus, 2026-08-18

Hoje o app **recusa** data futura (`lib/fiscal/pagamento.ts:137`) — e a recusa
está fiscalmente certa. O resultado prático é que o compromisso conhecido **não
tem onde morar**. Duas consequências:

1. O Mateus registra com a data de hoje para o app aceitar — e o custo entra no
   dia errado, possivelmente **no ano errado**. Ver pergunta 3: se já aconteceu,
   o ticket vira **P0**.
2. Ou não registra nada, e o compromisso vive na cabeça dele. **Dinheiro que sai
   da obra sem registro é a falha da meta 1 pelo lado de fora.**

## Gate Fiscal (Contador) — transcrito de 2026-08-18

**Nada aqui é negociável em implementação.**

1. **"Pagamento futuro" não é pagamento — é COMPROMISSO.** **Duas entidades**,
   não um registro com dois estados.
   - `pagamento` só existe com **desembolso ocorrido**: `dataPagamento`
     obrigatória e no passado. **A recusa de data futura FICA, literalmente.**
   - `compromisso` tem favorecido, **valor previsto**, data prevista, origem e
     documento de origem — e **não tem campo de data de pagamento**.
2. **Motivo de serem duas entidades, e é o coração do ticket**: se fosse um
   registro com data anulável, a proteção viraria *"todo cálculo lembra de
   filtrar nulo"* — **o defeito do `status` com outro rosto**, exatamente o que o
   CONTAI-018 está removendo. Um cálculo escrito daqui a seis meses não pode ter
   como pegar um compromisso por engano: ele tem que estar em outra tabela, com
   outro tipo.
3. **Confirmação CRIA o pagamento** e grava o id no compromisso. Um compromisso
   pode ser quitado por **N pagamentos**.
4. **Vencido sem resposta**: item **âmbar** com **três respostas de um toque —
   saiu / não saiu / mudou a data**. **Nunca vermelho** e **nunca no bloco de
   pendências fiscais**: não há fato consumado, logo não há risco fiscal ainda.
   **Nunca some e nunca expira sozinho.**
   O dente vem uma vez por ano: **compromisso vencido sem resposta BLOQUEIA a
   geração do relatório anual daquele ano.** É o único ponto do sistema que
   obriga resposta, e é o certo — na virada do ano é que a omissão custa.
5. **Comprovante não bloqueia a confirmação** — *"nunca recuse o registro de um
   fato consumado"*. Confirmado sem comprovante é o **estado (b)** do parecer do
   CONTAI-018: não entra no custo confirmado, vira pendência **"pago sem
   comprovante"**.
6. **Cinco regras para previsão nunca ser lida como dispêndio:**
   1. **Tabela e tipo próprios** — nunca uma coluna a mais em `pagamento`.
   2. **Nenhum total que contenha pagamento contém compromisso.** Não existe soma
      mista, em lugar nenhum, com rótulo nenhum.
   3. O campo se chama **"valor previsto"** — nunca "valor".
   4. **Discriminação anual e Pagamentos Efetuados nunca recebem compromisso.**
   5. Na **exportação**, sai em **arquivo separado**, com o cabeçalho literal:
      *"AGENDA DE COMPROMISSOS — VALORES PREVISTOS, NÃO EXECUTADOS. NÃO COMPÕEM
      CUSTO DE AQUISIÇÃO."*
7. **Boleto e PIX previsto são fiscalmente idênticos: zero.** A diferença é
   **probatória**, e por isso `origem` é campo, não bifurcação de regra.
8. ⚠️ **Achado que ninguém tinha visto — valor previsto ≠ valor pago.** Com
   **juros, multa ou desconto**, o desembolso difere da previsão. **Juros e multa
   de mora NÃO compõem custo de aquisição** (dor D2). A confirmação **precisa
   aceitar valor diferente e separar principal de encargos** — só o principal vira
   custo. **Sem isso, boleto pago em atraso infla o custo em silêncio**, e custo
   inflado indo para a declaração é a única classe de erro que gera passivo
   tributário.

## Diretriz de desenho (`designer`, 2026-08-18)

1. **A DATA é o controle.** Sem segmented control "já paguei / vou pagar" —
   seria um toque a mais no caminho de 95%. `data ≤ hoje` → pagamento;
   `data > hoje` → agendamento.
   ⚠️ **Exceção nomeada, achada pelo `contador` em 18/08 (§B do adendo): isto NÃO
   vale para cartão de crédito.** A compra tem data passada e mesmo assim não
   houve desembolso — o que decide é *"a fatura que contém esta compra já foi
   paga?"*. Enquanto o cartão não tiver fluxo próprio, ele **continua recusado na
   entrada** (critério 25).
2. **Três mudanças simultâneas** quando a data digitada é futura: aviso colado no
   campo; o **comprovante obrigatório desaparece**; o botão troca de **verbo e de
   peso**.
3. **Vocabulário: "agendado" e "pago".** Nunca "previsto/efetivado", nunca
   "regime de caixa" em tela. **A preposição carrega o tempo**: *"pago em 05/08"*
   × *"para 15/09"*.
4. **O pago é mudo; o agendado carrega marca.** O inverso produz o erro caro — um
   pagamento que perde a marca parece agendado e ele **registra de novo**. Quatro
   marcas redundantes: `~` e cinza no valor, chip âmbar, preposição, borda
   tracejada.
5. ~~**Na confirmação, a data prevista vem pré-preenchida mas editável.**~~
   **DERRUBADA em 18/08** — o campo nasce **vazio**. Ver decisão nº 1.
6. **"Cancelar agendamento" mora só no detalhe**, nunca no cartão da home.

## User Story

**Como** dono da obra, gerenciando de casa no fim do dia, **quando** sei que a
parcela sai dia 15 ou que o boleto vence sexta, **quero** registrar isso agora
sem que vire custo, **para que** nada saia da obra sem registro e o custo do ano
continue sendo só o que o dinheiro realmente pagou.

## Critérios de Aceite

### O modelo

1. [ ] **`compromisso` é tabela própria**, com favorecido, valor previsto, data
   prevista, origem, documento de origem e obra. **Não tem coluna de data de
   pagamento.** Teste: inspeção de schema afirmando a ausência.
2. [ ] **`pagamento` não ganha coluna nova** e a recusa de data futura continua
   ativa, com o teste unitário existente intacto.
3. [ ] ⚠️ **Nenhuma função fiscal aceita compromisso.** `sustentaCusto`, o resumo,
   a discriminação e Pagamentos Efetuados não têm caminho de código que receba um
   compromisso — **a tipagem impede, não a disciplina**.

### Registrar

4. [ ] Data **≤ hoje** grava **pagamento**, com comprovante **exigido**. O
   caminho de 95% muda em **uma** coisa, e só nela: **a ausência do comprovante
   deixa de recusar a gravação** (critérios 46-47). Fora isso, nada muda.
   ⚠️ **Não vale para `meio = cartao`** — ver critérios 25-27.
5. [ ] Data **> hoje** dispara **as três mudanças simultâneas**. E2E em 375px
   afirmando as três, no mesmo passo.
6. [ ] Salvar com data futura cria **compromisso**, não pagamento. E2E confere:
   uma linha em `compromisso`, **zero** em `pagamento`.
7. [ ] **Nas telas de registro e de compromisso**, o texto nunca diz
   **"previsto/efetivado"** nem **"regime de caixa"** — formulário de pagamento,
   home, detalhe do pagamento e as telas novas sob `/compromisso`.
   ⚠️ **O escopo foi NOMEADO no Gate 4 (18/08); a redação anterior dizia
   "nunca", sem recorte.** Ela foi cumprida nas telas que este ticket abriu e
   **não** nas três telas de documento que ele nunca tocou
   (`app/adicionar/page.tsx:35`, `app/adicionar/documento/page.tsx:365`,
   `app/documento/[id]/page.tsx:139`). O que sobrou virou **`CONTAI-023`**.
   **O recorte é do trabalho, não da régua**: trocar texto fiscal em tela que
   ninguém revisou nesta rodada passa no build, passa no teste e só aparece no
   dedo do Mateus — o argumento do `lead-engineer` está certo e foi aceito. Mas
   deixar o critério dizendo *"nunca"* depois de cumpri-lo *"nas telas que este
   ticket toca"* seria a **D29 aplicada a requisito**: **ajustar a régua ao que
   se entregou é como se apaga um requisito.** Por isso o escopo está escrito e
   o resto tem ID, em vez de virar dor solta num backlog de 1.800 linhas.

### Ver

8. [ ] Todo cartão de compromisso — **aberto ou vencido** — carrega **as quatro
   marcas**: borda **tracejada**, chip âmbar, `~` + cinza no valor, e a
   preposição de tempo (*"para 15/09"* / *"era para 10/08"*). E2E afirma as
   quatro **nos dois estados**. Perder uma em qualquer um deles é regressão — a
   redundância *é* o requisito.
   ⚠️ O mock hoje **viola isto**: o cartão do vencido troca a tracejada por
   sólida (`design/mocks/CONTAI-019.html:456`). Achado pelo próprio `designer`;
   está na lista de correções.
8b. [ ] **Vencido se distingue de aberto por três diferenças simultâneas, e
   nenhuma delas é a troca da borda tracejada**: (i) chip âmbar **preenchido**
   contra chip âmbar **vazado**; (ii) o chip nomeia vencimento e silêncio
   (*"Venceu em 10/08 · 8 dias sem resposta"*) contra *"Agendado"*; (iii) as três
   respostas aparecem **no cartão** do vencido e **não existem** no aberto. E2E
   com um de cada na mesma tela: ambos com `border-style: dashed`; três botões no
   vencido, zero no aberto; **nenhum token vermelho dentro do bloco de
   agendados**.
9. [ ] **O pago não carrega marca nenhuma** de agendamento. É o critério que
   evita o erro caro (registrar duas vezes).
10. [ ] ⚠️ **Nenhum total mistura.** Auditoria de cada número da home e das
    listas. O agendado, se aparecer, é **em bloco separado com rótulo próprio** —
    nunca ao lado do custo.
11. [ ] O campo e o rótulo dizem **"valor previsto"**.

### Confirmar

12. [ ] Confirmar **cria um pagamento** e grava o id no compromisso. E2E ponta a
    ponta com as duas linhas e o vínculo.
13. [ ] **A confirmação aceita valor diferente do previsto.** **Valor MAIOR**
    exige a separação principal × encargos. **Valor MENOR** exige escolha humana
    explícita entre **"Quita o compromisso"** e **"Falta pagar o resto"** —
    **sem default e sem pré-seleção**, dois botões de mesmo peso. Rótulo pelo
    **resultado**, nunca pela causa: ele não tem que caracterizar se foi desconto
    ou previsão errada, e para o custo dá no mesmo (parecer, adendo §D).
14. [ ] ⚠️ **Só o principal compõe custo.** Unitário: compromisso de R$ 10.000
    confirmado com R$ 10.320 (R$ 320 de juros e multa) → custo **R$ 10.000**, e
    os R$ 320 registrados e **fora do custo**.
14b. [ ] ⚠️ **A ORDEM do cálculo é critério, não prosa** (`contador`, §F.3,
    `[Certain]`): **o encargo sai do pagamento ANTES do teto do mínimo, nunca
    depois.** Primeiro `pagamento elegível = pago − encargos`, depois
    `min(Σ elegíveis, Σ documentos hábeis)`. **Unitário obrigatório com estes
    números**: nota de R$ 10.400, pago R$ 10.500 com R$ 500 de mora → ordem certa
    `min(10.000; 10.400) = 10.000`; ordem invertida daria
    `min(10.500; 10.400) = 10.400`, com **R$ 400 de mora entrando como obra**. É o
    **risco nº 1 do pre-mortem acontecendo dentro da fórmula** — e é assim que
    esse tipo de bug sobrevive a um ticket inteiro escrito em prosa.
15. [ ] **Um compromisso pode ser quitado por N pagamentos**, com saldo visível.
16. [ ] **Comprovante não bloqueia.** Confirmado sem comprovante grava, **não
    entra no custo** e vira pendência **"pago sem comprovante"** — texto do
    parecer, não reescrito.
17. [ ] ⚠️ **O campo "Data em que o dinheiro saiu" nasce VAZIO** — não é
    pré-preenchido com a data prevista, nem com hoje, e **não existe botão de
    atalho que preencha data**. A data prevista aparece só como **referência
    read-only**, cinza e com `~` (*"era para 10/08"*). Botão de gravar
    desabilitado enquanto o campo estiver vazio. A linha que separa o permitido
    do proibido: **default de navegação sim, default de valor não** — o date
    picker pode abrir no mês corrente; nada é gravado até ele escolher o dia.
    Teste: abrir a confirmação de um compromisso previsto para **10/08** no dia
    **18/08** → campo vazio e botão desabilitado; preenchido com 18/08 grava
    `dataPagamento = 18/08`; **nenhum caminho de código grava 10/08**. Ver
    decisão nº 1.

### Vencido sem resposta

18. [ ] Vira item **âmbar** com três respostas de um toque cada — *saiu / não
    saiu / mudou a data* pelo **efeito**; os rótulos são do mock (critério 49).
19. [ ] **Nunca vermelho, nunca no bloco de pendências fiscais.** *Isto vale para
    o **compromisso**, porque nada saiu. Não conflita com o critério 31: lá o
    dinheiro **já saiu**, e pagamento com diferença sem explicação é vermelho no
    bloco fiscal. **Âmbar = nada saiu ainda; vermelho = saiu e não está no
    custo.***
20. [ ] **Nunca some e nunca expira sozinho.** Teste com data de 90 dias atrás.
21. [ ] ⚠️ **Compromisso vencido sem resposta BLOQUEIA a geração de QUALQUER
    relatório anual** — **não só o do ano da data prevista** —, com a lista do
    que falta responder. *(A tela é da US-004; enquanto ela não existe, o
    bloqueio vive na função e o teste é unitário. **Este critério não pode ser
    adiado com a US-004** — é o único dente do mecanismo.)*
    **Corrigido em 18/08**: o mock lia *"daquele ano"* como *data prevista dentro
    do ano do relatório*, e o `contador` derrubou (§A) — recortar o bloqueio pela
    data prevista devolve efeito fiscal à **previsão**, que é o que o parecer
    inteiro proíbe. Unitário: previsto para **28/12/2025** sem resposta bloqueia
    **também** o relatório de **2026** — enquanto não há resposta, as duas
    hipóteses de ano estão vivas.
21b. [ ] **Compromisso com data prevista ≥ hoje não bloqueia relatório nenhum**
    (não há incógnita, há futuro). **Compromisso sem data prevista definida não é
    vencido e não bloqueia**, e continua na agenda — estado alcançável **só** pelo
    saldo de quitação parcial (critério 28), nunca na criação.
21c. [ ] **Desbloqueiam**: *saiu*, *não saiu*, *mudou a data*. **Não desbloqueia**
    o *"não, é outro pagamento"* da sugestão de quitação (critério 33).

### Cancelar e exportar

22. [ ] **"Cancelar agendamento" só no detalhe**, com confirmação. **Não apaga**:
    fica registrado como cancelado.
23. [ ] Na exportação, sai em **arquivo separado** com o cabeçalho literal do
    Gate Fiscal 6.5. Teste sobre o texto exato.
24. [ ] **E2E contra o Postgres local**, com o mesmo client autenticado.

### Cartão de crédito — a guarda desta rodada

*Buraco achado pelo `contador` em 18/08 (adendo §B) e **não previsto no ticket
original**. O fluxo inteiro do cartão **não entra aqui** — ver o porquê em
"Decisões de fechamento", item 7. O que entra é a guarda que impede o custo de
cair no mês (e no ano) errado em silêncio.*

25. [ ] **`meio = cartao` continua recusado na entrada**, com mensagem explícita
    (*"compra no cartão ainda não tem fluxo neste app — o custo é do ano em que a
    fatura for paga"*) e **link para o registro depois do pagamento da fatura**.
    Nunca aceito como se fosse pagamento à vista.
26. [ ] ⚠️ **O comentário obsoleto sai do código.**
    `lib/fiscal/pagamento.ts:16-21` bloqueia cartão dizendo que *"cartão depende
    da Q4"* — a **Q4 fechou em 2026-08-08** (`docs/backlog.md`, seção de
    perguntas fechadas). O bloqueio fica; a razão passa a ser a verdadeira
    (*falta o fluxo de fatura — `CONTAI-022`*). Comentário que aponta para uma
    pergunta já respondida é a mesma classe de defeito que o botão que promete o
    que não faz.
27. [ ] **Nenhuma compra no cartão pode virar pagamento pela regra da data.** Se
    o `meio = cartao` chegar por qualquer caminho, o branch é decidido por *"a
    fatura já foi paga?"* — nunca por `data ≤ hoje`. Unitário nomeando a exceção.

### Confirmar — valor MENOR (adendo §D)

28. [ ] **Quita o compromisso**: custo = **valor pago** (o menor), compromisso
    **quitado**, **nenhum resíduo** — sem saldo, sem pendência, sem "pago sem
    nota" pela diferença. Unitário: previsto R$ 10.000, pago R$ 9.500 → custo
    R$ 9.500 e zero resíduo. *(O teto do mínimo do parecer de 17/08 §3 já acerta
    sozinho quando a nota é do valor cheio — não há tratamento especial.)*
29. [ ] **Falta pagar o resto**: pagamento de R$ 9.500, compromisso aberto com
    saldo de R$ 500, e **o saldo não é custo de nada** — não deste ano, não de ano
    nenhum, e só vira custo se e quando sair da conta.
30. [ ] ⚠️ **A quitação parcial PEDE a nova data prevista do saldo**, com a opção
    explícita **"sem data definida"**. Sem isto o saldo nasce vencido-sem-resposta
    e **trava o relatório anual para sempre**, pelo critério 21. Incerteza
    declarada não é silêncio: "sem data definida" mantém o compromisso visível e
    **não** bloqueia (critério 21b).

### Diferença não explicada — onde mora o "em revisão"

*Lacuna que nem ticket nem parecer cobriam. Fechada pelo `designer` em 18/08.*

31. [ ] **Pagamento com diferença não explicada aparece no bloco de pendências
    fiscais da home**, com o **mesmo peso** das demais pendências de fato
    consumado, **nunca** no bloco de agendados e **nunca** em lista própria.
    Rótulo: **"Diferença sem explicação"**. E2E: confirmar R$ 10.500 sobre
    previsto de R$ 10.000, com R$ 200 identificados como encargo → a home passa a
    listar a pendência com R$ 300,00.
    **O porquê**: o que o parecer §2.5 mantém fora do bloco de exposição é o
    **compromisso**, porque nada saiu. Aqui **saiu** — o pagamento está gravado,
    é fato consumado com dinheiro fora do custo, mesma família de "pago sem nota".
    Regra de cor que isso fecha, e que fica mono-semântica: **vermelho = dinheiro
    que saiu e não está no custo; âmbar = nada saiu ainda.**
31b. [ ] ⚠️ **Diferença sem resposta NÃO bloqueia o relatório anual** — ao
    contrário do compromisso vencido (critério 21). Aqui o fato consumado já está
    registrado e o único erro possível **subestima** o custo. Ela entra na **lista
    de revisão pré-declaração**. Unitário afirmando que o relatório gera.
31c. [ ] **O conjunto de resoluções é FECHADO e tem CINCO saídas** (`contador`,
    §F.2 **conforme substituído pelo ADENDO 4 §H.6**, `d69a3cf`: *"onde o §F.2
    disser 'quatro resoluções' ou 'conjunto FECHADO e tem QUATRO saídas',
    leia-se CINCO"* — substitui, não convive em paralelo). Rotuladas **pelo
    resultado, nunca pela causa**:
    1. **"Não compõe custo da obra"** (mora, taxa, item não incorporado) → fora
       **definitivamente**, registrado, **sem pendência** — não há o que cobrar;
    2. **"É da obra e falta o documento"** → fora **hoje**, vira **"pago sem
       nota"** pelo valor da diferença, e entra no custo quando houver nota hábil
       no CPF dele que o cubra;
    3. ⚠️ **"O pagamento cobriu mais de um documento"** → resolve-se por
       **vínculo**, não por classificação, e é o **único caminho que aumenta o
       custo no ato**. **Faltava na leitura do `po`** e é caso comum da obra (um
       PIX cobrindo duas compras do mesmo favorecido); sem ela o Mateus é
       empurrado para a 1 ou a 2 e **perde custo real já comprovado no acervo**;
    4. **"Errei o valor digitado"** → não é classificação fiscal, é **correção do
       registro com rastro** — `CONTAI-021`;
    5. ⚠️ **"A previsão é que estava errada — o valor pago é o certo"** → **entra
       no custo**, e **quem volta a limitar é o documento hábil, nunca a
       previsão**. Acrescentada no **Gate 2** (`50958a1`) e materializada em
       parecer no **ADENDO 4** (`d69a3cf`), depois de o **Gate 4 reprovar a
       ausência de lastro**: o enum tinha cinco valores e o arquivo dizia quatro,
       e a regra de arbitragem do projeto (*"a fonte é o arquivo"*) mandava a
       quinta perder — quem a executasse de boa-fé removeria `previsao_errada` e
       **reintroduziria o B1**.
       ⚠️ **Resíduo, na redação do §H.4, e a redação é o critério**: *nenhum
       resíduo vem da **classificação***. O que a nota hábil não cobrir continua
       aparecendo pela regra geral, porque a quinta afirma *"este dinheiro é
       obra"*, nunca *"este dinheiro está documentado"* — **quem documenta é o
       documento**. Previsto R$ 9.000, pago R$ 10.000, **nota R$ 9.500** → custo
       `min(10.000; 9.500) = ` **R$ 9.500**, com **R$ 500 de "pago sem nota" de
       pé**. *(O corpo do `50958a1` dizia "sem resíduo" sem essa ressalva, e o
       `contador` corrigiu lendo o código: o código sempre fez o certo, o texto
       é que generalizava.)*
       ⚠️ **Não confundir com a 4.** As duas soam como *"o número está errado"* e
       **apontam para lados opostos do custo**: a **4** diz que o **registro do
       pagamento** está errado — fato ainda não confirmado, fica **fora** até o
       `CONTAI-021`; a **5** diz que o **fato está certo** e quem errou foi a
       **previsão** — **entra**. Trocar uma pela outra **inverte o efeito
       fiscal**.
       **Por que ela precisou existir** (§H.2, e é aritmética, não
       interpretação): com `resolucao = null` — o único estado inicial permitido
       — o elegível era
       `pago − encargos − (pago − previsto − encargos)` = **`previsto`**. A
       previsão virava o **teto do custo**: o §2 inteiro violado por dentro da
       fórmula que o §F.3 existe para proteger, **na direção que subestima** — a
       que não gera passivo tributário, não aparece em fiscalização e por isso
       **não se autodenuncia** até a hora de apurar o ganho de capital.
    E **"não sei ainda" é estado permitido, e é o único que pode ser o estado
    inicial**, porque é o único que não afirma nada. Forçar classificação ensina a
    inventar dado no campo que sobrou.
    ⚠️ **A quinta é resolução, não default** (§H.5): marcá-la por padrão seria
    **pior que o bug que ela conserta** — toda diferença para mais viraria custo
    automático sem ninguém ter afirmado que aquele dinheiro é obra, inclusive
    quando for juro, multa ou item não incorporado. Campo fiscal não tem default.
31d. [ ] **A opção "era principal" NÃO promete aumento de custo no ato, e mesmo
    assim FICA** (§F.1). Com nota de R$ 10.000, o teto mantém o custo em
    R$ 10.000 — o número não se move hoje. Tirar o botão é o **mais caro** dos
    dois erros: encargo fica fora **para sempre e sem pendência**, enquanto
    principal sem nota é custo real que vira **"pago sem nota"** — cobrança a
    fazer **enquanto ainda há parcela a liberar**. E chegando a nota do aditivo de
    R$ 300, o teto vira `min(10.300; 10.300)`. **A mentira não está no botão, e
    sim em prometer aumento no ato**: a tela diz que o número não se move hoje e
    diz **o que o move** (a nota).
    ⚠️ **Ajuste do Gate 4 (18/08)**: a resolução que **devolve o teto ao
    documento hábil** é a **quinta** (`previsao_errada`), não esta. As duas
    colocam o dinheiro no elegível — são idênticas dentro de
    `diferencaContaComoCusto` —, e o que difere é **o que o Mateus afirma**:
    aqui, que o documento **falta**; lá, que o documento **já cobre** e quem
    errou foi a previsão. **Nenhuma das duas fura o `min` do §F.3** (§H.4), e é
    por isso que nenhuma delas pode prometer aumento no ato.
31e. [ ] **Texto de tela literal do parecer §F.4** — copiado, **não reescrito**.
    A minuta anterior do `designer` foi **reprovada por motivo fiscal**: ancorava
    a consequência no **previsto**, e previsão não decide custo — quem limita é o
    **documento hábil** (com previsto de R$ 9.000 e nota de R$ 10.000 a frase
    estaria errada em tela).
    > **R$ 300,00 do que você pagou ainda estão sem explicação.**
    > Enquanto estiverem, ficam fora do custo de aquisição. Se forem juros, multa
    > ou algo que não é da obra, ficam fora para sempre — e não há o que cobrar.
    > Se forem obra, entram no custo quando houver nota no seu CPF que os cubra;
    > até lá, contam como pago sem nota.
32. [ ] A pendência **se resolve pelo detalhe do pagamento**, e a resolução é do
    Mateus. **Resolver não apaga o registro da diferença** (acervo append-only,
    CONTAI-009).

### "Mudou a data"

33. [ ] **"Mudou a data" mantém o MESMO compromisso** — mesmo id, mesmos
    vínculos, mesmo saldo — e grava a data anterior em **histórico**. **Não
    cancela e não cria compromisso novo.** E2E: mudar a data de um compromisso
    com um pagamento parcial vinculado → **uma** linha em `compromisso`, vínculo
    intacto, histórico com a data antiga.
    **O porquê**: append-only proíbe destruir o fato anterior, não proíbe editar a
    linha — o histórico preserva. Fechar-e-abrir órfãozaria o vínculo 1:N com
    pagamentos já feitos, e usaria "cancelado" (reservado no parecer §3 à previsão
    **que não se realizou**) para um adiamento, poluindo o sinal de auditoria.
34. [ ] O detalhe mostra **"para 25/08 (era 10/08)"** e o histórico completo. O
    cartão da home mostra só a data vigente — **exceto a partir da 2ª mudança**,
    quando passa a exibir **"adiado N×"**: compromisso empurrado várias vezes é
    candidato a cancelamento, e é esse o sinal que interessa. Data nova **no
    passado é aceita** (é correção legítima) e o item fica vencido na hora.

### Sugestão de quitação — a única defesa contra o pagamento duplicado sem nota

*O teto do mínimo só age dentro do conjunto conexo; pagamento duplicado **sem
vínculo com nota nenhuma** não é travado por nada (parecer §5.1). Gatilho fechado
pelo `contador` no adendo §C.*

35. [ ] **Gatilho cumulativo, as três condições ao mesmo tempo**: mesmo
    `favorecido_id` (chave CNPJ/CPF — **proibido casar por nome**);
    `|pago − previsto| ≤ 20% do previsto ou ≤ R$ 500,00, o que for maior`; data do
    pagamento entre **30 dias antes** e **60 dias depois** da prevista, **sem
    recorte de ano-calendário** (o par 28/12→05/01 é onde a duplicidade custa mais
    caro). Unitários nos dois lados de cada limite.
36. [ ] **Vários compromissos elegíveis → lista todos.** **Proibido escolher o
    mais próximo** — escolher é heurística decidindo vínculo (parecer de 17/08,
    §5.5).
37. [ ] **A sugestão aparece DEPOIS do pagamento gravado e nunca bloqueia a
    gravação** — *nunca recuse o registro de um fato consumado*.
38. [ ] **Texto literal do parecer (adendo §C), não reescrito**: *"Este pagamento
    quita o compromisso de 15/09?"* / *"Sim, quita este compromisso"* / *"Não, é
    outro pagamento"* / *"Se não quitar, o compromisso continua em aberto e este
    pagamento fica registrado sozinho."*
39. [ ] **O "não" é registrado por par (pagamento, compromisso)**: o app não
    repergunta **daquele par** — repetir ensina a dispensar sem ler — e segue
    livre para sugerir outros pares. O "não" **não** é resposta ao vencido e
    **não** desbloqueia o relatório anual.
40. [ ] **Ignorar ou recusar não altera número nenhum**: pagamento fica como
    está, compromisso segue aberto. Unitário sobre os totais antes e depois.
41. [ ] ⚠️ **Nenhum caminho de código cria vínculo de quitação sem ato humano.**

### O bloco de agendados na home

42. [ ] O bloco exibe **contagem** (*"3 em aberto, 1 venceu"*) e **nenhuma soma de
    valores**, sob rótulo nenhum. *Por quê*: número em reais a centímetros do
    custo confirmado vira "quanto a obra tem marcado" — previsão de fluxo de
    caixa, **fora de escopo declarado**.
43. [ ] **Todos os vencidos aparecem, sem truncar nunca** (truncar vencido é o
    sumiço silencioso que o parecer §3 proíbe); **no máximo 3 abertos**, por data
    prevista crescente, com **"ver todos (N)"**. **Aberto é linha (~44px), vencido
    é cartão** — e a linha mantém as quatro marcas do critério 8. E2E com 1
    vencido e 5 abertos: 1 cartão + 3 linhas + o link com "(5)".

### O toque "Saiu"

44. [ ] **"Saiu" abre a confirmação em qualquer contexto** — **não existe estado
    "declarou que saiu"**. Sair sem gravar não altera nada e não deixa rascunho.
    E2E: tocar "Saiu", voltar sem gravar → **zero** linhas em `pagamento`, e o
    compromisso segue vencido com as três respostas.
    **O porquê**: um "ele disse que saiu" sem data é um registro em formato de
    mentira — afirma o fato e não sabe quando. Se contasse como resposta,
    desarmaria o critério 21 com um toque que não gravou nada; se não contasse,
    não faria nada que o vencido já não faz.
45. [ ] A confirmação com **valor igual ao previsto** tem exatamente **dois
    campos obrigatórios** (data e valor) e um botão. A separação principal ×
    encargos e a escolha desconto × parcial **só aparecem quando o valor difere**.
    A densidade cresce com a complicação fiscal, não antes dela.

### Comprovante — exigido, com escape nomeado (ADENDO 2, `238a650`)

*Entrou depois de o `contador` derrubar o bloqueio e de o **Mateus reprovar o
botão** lendo o mock. O parecer §4 já valia para a confirmação de compromisso; o
formulário direto aplicava **dois pesos ao mesmo fato do mundo**, e o mais duro
dos dois é o que empurra para não registrar — falha da meta 1 pelo lado de fora.*

46. [ ] ⚠️ **O botão grava sempre; o que muda é o estado que nasce.** Sem
    comprovante, o pagamento **grava**, **não entra no custo confirmado** e vira
    pendência **"pago sem comprovante"**. *Nunca recuse o registro de um fato
    consumado.* Hoje o app recusa
    (`lib/fiscal/pagamento.ts` — *"sem ele o pagamento não é aceito"*), e o mock
    repete a recusa (`btnGravar.disabled = !fAnexo.checked`).
47. [ ] **A pendência muda de peso conforme o favorecido** (ADENDO 2, tabela —
    texto literal, não reescrito): **PJ com NF** → pendência **amarela**,
    *"pago sem comprovante — o custo existe, ainda não está demonstrável"*;
    **PF com recibo** → pendência **vermelha**, no mesmo peso de "pago sem nota",
    *"sem o comprovante da transferência, este recibo não sustenta custo nenhum"*.
48. [ ] **O anexo tem controle real de anexo**, não checkbox. *(Reprovado pelo
    Mateus no mock em 18/08; a correção é do `designer`.)*

### Rótulos — o que é critério e o que é do mock

49. [ ] O **vencido sem resposta oferece três respostas de um toque** com estes
    **efeitos**: (i) criar pagamento pela confirmação; (ii) cancelar com motivo;
    (iii) nova data prevista. **Os verbos são do mock aprovado, não deste
    ticket** — *"Saiu / Não saiu"* foi **reprovado pelo Mateus em 18/08** por
    precisar de legenda. Nenhum critério deste ticket depende de rótulo
    específico; todos dependem dos três **efeitos**.

## Gate 0 — mock

**Obrigatório**, três razões: o formulário muda de comportamento no meio da
digitação, a distinção pago × agendado é o que evita o erro caro, e a resposta de
três toques é padrão novo no app.

**3 estados** (375px como piso, desenhar também a leitura confortável):

1. **Registrar-agendado** — o formulário no instante em que a data vira futura.
2. **Home-com-vencido** — o item âmbar entre itens pagos, mostrando que o
   agendado carrega marca e o pago não.
3. **Confirmar-execução** — **campo de data vazio** (era "pré-preenchida
   editável"), valor previsto × pago, e **a separação principal × encargos**
   quando divergem.

### Correções pendentes no mock, saídas do fechamento de 18/08

*Tarefa do `designer`, em `design/mocks/`. O `po` não encosta lá.*

1. **`s6` (home)**: devolver `border-style: dashed` ao cartão do vencido
   (`CONTAI-019.html:456`) — hoje ele troca por sólida e **perde uma das quatro
   marcas**, violando o critério 8; abertos viram **linha**; aplicar o corte do
   critério 43 (todos os vencidos + 3 abertos + *"ver todos (N)"*); acrescentar o
   item vermelho **"Diferença sem explicação"** ao bloco de pendências fiscais;
   remover o bloco de perguntas a/b/c, todas decididas.
2. **`s10` (confirmar)**: campo de data **vazio**, previsto só como referência
   read-only, botão desabilitado enquanto vazio, **sem atalho "hoje"**; remover o
   bloco de pergunta sobre pré-preenchimento.
3. **`s12` (revisão)**: trocar a lacuna pela pendência na home, com o **texto
   literal do §F.4** e as **CINCO resoluções** do §F.2 (⚠️ **corrigido no Gate 4**:
   a lista nasceu com quatro, e o ADENDO 4 §H.6 fixou cinco — quem desenhar com
   quatro faz o mock nascer defasado outra vez, e desta vez num ponto fiscal) —
   incluindo *"o pagamento
   cobriu mais de um documento"*, que não estava desenhada, e o estado inicial
   *"não sei ainda"*.
4. **`s9` ("mudou a data")**: explicitar **mesmo compromisso** + *"era 10/08"* +
   histórico + *"adiado N×"* a partir da 2ª.
5. **`s7`/`s11`**: registrar que **abandonar a confirmação não deixa rastro**;
   remover a pergunta sobre o "Saiu" longe de casa.
6. **Formulário direto**: o botão **deixa de bloquear** sem anexo (critério 46), e
   o **checkbox dá lugar a controle real de anexo** (critério 48).
7. **Verbos das três respostas**: reprovados pelo Mateus, a redesenhar.
8. **`design/mocks/CONTAI-018.html:383`**: trocar pela frase do §F.5.

## Out of Scope

- **Lembrete no Google Calendar.** P2 com recomendação de corte: *"não pagar
  juros" é gestão de caixa e não serve nenhuma das três metas.* ⚠️ Parte desse
  raciocínio assumia uso só no canteiro, premissa que caiu em 18/08; **reavaliado
  sob a régua nova e mantido**, agora pelo argumento das metas.
- ~~**Série recorrente de parcelas.**~~ **RESOLVIDO, não cortado**: as parcelas
  da empreiteira são pagas **uma a uma, por medição** — não é série (fato já
  registrado no `docs/backlog.md` e na memória do projeto; parecer §6). O desenho
  serve.
- **Fluxo completo do cartão de crédito** — dois momentos (compra e pagamento da
  fatura), confirmação **compra a compra**, parcelado como um compromisso por
  parcela. **Vai para o `CONTAI-022`**, não por ser pequeno, mas porque tem tela
  própria e o mock deste ticket não tem uma única tela de cartão: enfiar aqui
  seria implementar sem mock, contra a regra mock-first. **A guarda fica**
  (critérios 25-27). Regra fiscal já escrita e pronta em `docs/pareceres/…
  compromisso-versus-pagamento.md`, adendo §B.
- ~~**Reverter o bloqueio de gravação sem comprovante no pagamento direto.**~~
  **ENTROU no escopo** (critérios 46-47) — eu tinha decidido adiar, e a decisão
  caiu no mesmo dia por dois motivos que valem mais que os meus: o `contador`
  derrubou no **ADENDO 2** (`238a650`), e **o Mateus reprovou o botão lendo o
  mock**. O que me fazia adiar era custo de implementação, não regra — e custo de
  implementação não vence nem parecer nem usuário.
- **Previsão de fluxo de caixa** — fora de escopo declarado.
- **Máquina de estados do boleto** — fica no CONTAI-018; aqui boleto é só um
  valor de `origem`.

## Pre-mortem

1. **Boleto pago em atraso infla o custo em silêncio** — juros e multa entram
   como se fossem obra, e ninguém percebe porque o número "bate" com o extrato.
   **Risco nº 1 e o mais caro.** *Mitigação: critérios 13 e 14.*
2. **Compromisso vaza para um total de custo** — alguém escreve uma query nova
   somando "tudo que é pagamento previsto ou feito". É o defeito do `status`
   renascendo. *Mitigação: critérios 1, 3 e 10 — proteção de tipo, não de
   atenção.*
3. **Ele confirma com a data pré-preenchida sem olhar** e o pagamento entra no
   dia errado — se for virada de ano, **no ano errado**. ~~*Mitigação: critério
   17 + pergunta ao Mateus.*~~ ⚠️ **O ticket original apontava como mitigação o
   próprio critério que causava o risco** — o `designer` chamou isso de *"o
   defeito mais caro deste desenho"*. **Mitigação real, a partir de 18/08: o
   campo nasce vazio** (critério 17 reescrito). Não há default para confirmar sem
   olhar.

## Viabilidade (CTO)

- **Migration nova**: tabela `compromisso` + vínculo para `pagamento`. **Próxima
  livre** (o `/develop` do 018 está consumindo números). **GRANT explícito
  obrigatório.** Pergunta do repo: *isto depende de algum default do stack local
  que o remoto não tem?*
- **Arquivos**: `app/adicionar/pagamento/page.tsx`, módulo novo em `lib/fiscal/`
  (**não** dentro de `pagamento.ts`), `lib/data.ts`, `app/page.tsx`, telas de
  detalhe e confirmação.
- **Complexidade: M → L** depois do fechamento de 18/08. Cresceram: a sugestão de
  quitação (7 critérios), a resolução da diferença (5), o comprovante que deixa de
  bloquear (3, e mexe em código de produção com teste em cima) e a ordem de
  cálculo do 14b. O risco continua não sendo o volume: está em **manter
  compromisso fora de todo caminho de cálculo** — e agora também em **não
  inverter a ordem encargo → teto**.
- ⚠️ **O `lead-engineer` deve tratar o 14b como o item mais perigoso do ticket.**
  É o único que passa por todos os testes de comportamento estando errado.
- **Ordem**: depois do CONTAI-018 — mesma superfície; em paralelo violam a regra
  de concorrência entre agentes.

## Dependências

- **Bloqueado por**: Gate 0 · **materialização do parecer** · CONTAI-018.
- **Bloqueia**: `US-004` (o critério 21 é pré-condição da geração) e
  **`CONTAI-011`**, que herda o arquivo separado do critério 23.
- **Atenção — dívida do Gate 4 do CONTAI-002**: o E2E do login preenche
  `/adicionar/pagamento` campo a campo. **Mexer aqui quebra um teste de login**, e
  o sintoma parece regressão de autenticação. Não é.
- **Bloqueia** também o **`CONTAI-022`** (fluxo do cartão de crédito), que
  precisa da entidade `compromisso` existindo. ID **reservado em 18/08**, regra
  fiscal já pronta no adendo §B — falta o ticket e o mock.
- **Relacionado**: `CONTAI-010` — parcelas de financiamento são o mesmo padrão
  *contrato é previsão, extrato é fato*. ⚠️ **Não fundir**: os juros do terreno
  **compõem** custo (art. 17, I, "g"), ao contrário dos juros de mora daqui.
  Confundir é erro fiscal, não de escopo.

## Perguntas ao Mateus — as três estão FECHADAS

*Fechadas em 18/08 sem devolver nada a ele: as três tinham resposta em fato já
registrado, e nenhuma era preferência.*

1. ~~**Série ou uma a uma?**~~ **Uma a uma, por medição** — fato já no
   `docs/backlog.md` e na memória do projeto, ratificado pelo `contador` (§6).
   Este desenho serve.
2. ~~**Quantos agendamentos abertos ao mesmo tempo?**~~ **Premissa registrada:
   2 a 5**, estimativa `[Likely]` do `contador` (§6) a partir dos fatos da obra —
   medição da empreiteira uma a uma, material com boleto curto, cartão. Não vira
   pergunta.
   ⚠️ **A premissa deixou de ser o que decide a arquitetura da tela**: com o corte
   do critério 43 (todos os vencidos + no máximo 3 abertos + *"ver todos (N)"*), a
   home sobrevive a qualquer N. O gatilho de tela própria deixa de ser *"quebrou"*
   e vira **"abrir 'ver todos' virou rotina"** — medível depois, não agora. Acima
   de ~8 abertos com frequência, o mock precisa de v2.
3. ~~**Você registrou com a data de hoje quando o app recusou a data futura?**~~
   **NÃO — ele não registrou nada.** Portanto **não existe custo com data errada
   em produção**, e a promoção condicional a **P0 está morta**. O ticket
   **continua P1**. O que sobra é a outra metade da dor, e ela é a que vale: o
   compromisso vive na cabeça dele, que é a falha da meta 1 pelo lado de fora.

## Decisões de fechamento — 18/08 (`po` + `designer` + `contador`)

*Dez pendências fechadas pelo time, com o argumento registrado. Nenhuma foi
devolvida ao Mateus: nenhuma era fato que só ele sabe.*

1. **Data prevista na confirmação → campo VAZIO** (critério 17). O valor vem
   pré-preenchido da nota porque **a nota afirma o valor** — é fato documentado.
   **A data prevista não é afirmada por documento nenhum**: é palpite, e só o
   extrato sabe quando o dinheiro saiu. Preencher afirma fato inexistente, e a
   proibição de default em campo fiscal existe exatamente para isso. Sob a régua
   de gestão ele confirma sentado, com o extrato aberto — **não há pressa a
   economizar**. A opção (c) — manter o previsto exigindo um toque de confirmação
   — foi descartada pelo `designer` como **pior que pré-preencher**: é máquina de
   habituação, ele confirma o default com a mesma mão e agora com a sensação de
   ter conferido. O caso que quase salvava o pré-preenchimento (PIX agendado que
   executa na data marcada) é o que o condena: *"acerta quase sempre"* apaga o
   valor informativo do gesto, e o caso em que erra é o que cruza ano-calendário.
2. **Âmbar × âmbar → vazado (aberto) × cheio (vencido) RATIFICADO**, com a
   emenda de que preenchimento é o **quarto** canal, não o primeiro: sozinho é um
   canal só e falha no sol. A distinção que carrega o peso é estrutural — as três
   respostas ficam **dentro** do cartão do vencido. **A tracejada fica nos dois**
   (critérios 8 e 8b); precisando de mais peso, engrossa-se a tracejada, nunca se
   troca o estilo.
3. **"Em revisão" mora no bloco de pendências fiscais da home, em vermelho**
   (critérios 31-32). Vermelho = dinheiro que saiu e não está no custo; âmbar =
   nada saiu ainda.
4. **"Mudou a data" mantém o mesmo compromisso, com histórico** (33-34).
5. **Total dos agendados na home: contagem, não soma — RATIFICADO** (42).
6. **Bloqueio anual não recorta por ano** (21) — decisão do `contador`, §A.
7. **Cartão: a compra nasce compromisso, e a diretriz "data ≤ hoje → pagamento"
   não vale para ele** (§B). Nesta rodada entra só a **guarda** (25-27); o fluxo
   vai para o `CONTAI-022` por falta de mock, não por falta de regra.
8. **Sugestão de quitação vira critério** (35-41) — sugerir, **nunca fundir**.
9. **Valor MENOR ganha critério próprio** (13, 28-30), com o buraco que o
   `contador` achou de brinde: **a quitação parcial tem que pedir a nova data do
   saldo**, senão o saldo nasce travando o relatório anual para sempre.
10. **Conflito entre mocks: o CONTAI-018 cede.** `design/mocks/CONTAI-018.html:383`
    (e `app/adicionar/pagamento/page.tsx`, em produção) diz *"…não a da nota —
    regime de caixa"*, e o **critério 7 deste ticket proíbe "regime de caixa" em
    tela**. O critério 7 é a regra geral e está certo; *"regime de caixa"* é o
    **nome** da regra, não a regra, e não ensina nada a um usuário de uma pessoa
    só. **Frase substituta, RATIFICADA pelo `contador` em §F.5 — o exemplo
    fica**, porque é ele que ensina e a sentença abstrata sozinha é esquecível:
    > **A data que vale para o custo é a do pagamento, não a da nota. Nota de
    > dezembro paga em janeiro é custo do ano seguinte.**

    A segunda sentença **não é texto fiscal novo**: é o §4 do parecer de 17/08 em
    linguagem de tela. A troca no mock do 018 é **tarefa do `designer`**; a troca
    em produção entra junto com o Gate 1 deste ticket.

## Teste do Canteiro (régua de 2026-08-18)

- **Principal — gestão em casa**: é onde o compromisso nasce (você sabe da
  parcela olhando o contrato, não na obra) e onde a confirmação com separação de
  encargos acontece, olhando o extrato. **A régua aqui é acerto, não velocidade.**
- **Eventual — canteiro, 375px como piso**: só a resposta de um toque do item
  vencido precisa passar nessa régua, e passa por construção.
- **Metas**: 1 (pelo lado do "ainda não pagou") e 2 (o critério 21 impede
  relatório com buraco). Meta 3 de raspão.
- **Veredito: APROVADO como P1, 2º da fila.** ⚠️ **As duas condições morreram em
  18/08**: a pergunta 1 tinha resposta em fato registrado (uma a uma, por
  medição) e a 3 é **não** — ele não registrou nada, logo **não há custo com data
  errada em produção** e a promoção a P0 não acontece. **P1, sem condição
  pendurada.**

## Nota de flake — `e2e/compromisso.spec.ts`

*Registrada no Gate 3 (2026-08-18) para quem topar com ela daqui a dois meses.*

- **Teste**: `"data no futuro dispara as TRÊS mudanças de uma vez"`
  (`e2e/compromisso.spec.ts`, describe *"registrar com data futura"*).
- **Quando falhou**: **uma única vez**, na rodada de `npm run quality` sobre o
  HEAD `df36b41` (fechamento do Gate 1b).
- **O que aconteceu depois**: passou **isolado**, passou em **todas** as demais
  rodadas — incluindo o `quality` de `50958a1` (63 passed, 0 failed), que já
  incluía o retrabalho do Gate 2.

**Não foi investigada, e a decisão de não investigar é deliberada**: falha única
não reproduzível vira caça a fantasma, e o custo de procurar supera o de
registrar. O que este bloco existe para evitar é a **segunda** pessoa gastando
o mesmo tempo do zero.

**Se ela voltar**, o palpite de partida — e é palpite, não diagnóstico — é que
o teste afirma **três mudanças simultâneas** disparadas por um evento de
digitação em campo de data, e o que se observa é o React tendo aplicado só
parte do lote. Comece medindo se as três asserções esperam o mesmo commit de
render, não pelo locator.
