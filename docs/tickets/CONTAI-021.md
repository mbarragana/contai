# CONTAI-021 — Corrigir documento já registrado

## Tipo e Prioridade

feature — **P1 (fricção com consequência fiscal latente)**.

**Por que não P0 hoje**: o banco tem **uma única nota, e ela está certa**
(confirmado pelo Mateus em 18/08). Não há dado errado a corrigir agora.

**O gatilho que vira P0, nomeado**: o registro da **2ª nota real, de
R$ 40.857,14** (empreiteira, obra Casa Tanheiros). É o próximo evento de
digitação da obra, e é exatamente quando typo acontece. **A partir do instante
em que uma nota for registrada errada, isto é P0**, porque hoje não existe
desfazer — nome de favorecido gravado errado é **permanente** desde `b807901`.

- **Gate 0 (mock)**: **v2 APROVADA pelo Mateus em 19/08** (commit `ad07fd8`,
  `design/mocks/CONTAI-021.html`, 27 telas). A v2 fechou as três superfícies que
  faltavam: ciclo da pendência (critérios 20 e 21), ação da tela de CNPJ errado
  (critério 19) e a correção de obra dos dois lados (critério 13).
- **Gate Fiscal**: `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md`
  — **APROVADO**. O parecer é normativo; este ticket **transcreve, não
  reinterpreta**.
- **Viabilidade**: `cto-obra`, 18/08 — aprovado com **discordância de forma**
  (ações nomeadas, não formulário genérico) e **três achados devolvidos**,
  incorporados abaixo.

## Dor de Origem

Dor **D23** do backlog. O adendo de 2026-08-18 (§4) fechou o impasse do
favorecido read-only com uma saída em quatro passos, e o `b807901` implementou o
primeiro deles:

> Saída do impasse, nesta ordem: 1. **Link "corrigir na nota"** → edição do
> documento, com rastro (§2).

**O link existe e está em produção. A tela de edição do documento não existe.**
As únicas telas do documento são detalhe, `/obra`, `/ligar` e `/desligar` —
nenhuma edita. O usuário clica em "Corrigir na nota" e chega numa tela que não
corrige. É a disciplina do critério 19 do CONTAI-018 (*nenhuma tela promete
comportamento que não existe*) violada por um **botão**.

Serve à **meta 3** (acervo que sobrevive ao prazo de decadência): correção sem
rastro faz o acervo deixar de ser append-only na prática, ainda que seja no
banco.

## User Story

Como dono da obra, **em casa, sentado, revisando o que registrei**, quero
corrigir um dado que digitei errado no documento — e ver, antes de gravar, o que
isso muda no custo de cada ano — para que o acervo bata com o papel anexado e a
correção fique registrada para quem for ler isso em 2034.

## Escopo da rodada 1 — três ações nomeadas

`/documento/[id]/corrigir/{valor|classificacao|emitente}`, no padrão que já
existe em `/documento/[id]/obra` ("Corrigir a obra deste registro").

**Não é um formulário "editar documento" com N campos** — decisão do `cto-obra`,
e o fundamento é de domínio: os campos têm **regimes de consequência
diferentes** (valor recalcula custo e pode pedir retificadora; classificação
muda composição e não muda total; nome do emitente é outra tabela; CNPJ é
proibido). Um form único precisaria expressar os cinco ao mesmo tempo, e o campo
proibido sentado ao lado dos editáveis é o convite que o §4.4 do adendo
descreve: *inventar dado no campo que sobrou*.

## Critérios de Aceite

1. [x] **Mock aprovado pelo Mateus** antes do desenvolvimento — **v2 aprovada
   em 19/08** (`ad07fd8`); nada em aberto. ⚠️ **Régua corrigida em 2026-08-18**:
   corrigir nota registrada errada é **gestão em casa, sentado, com calma** —
   cenário **principal**. Avaliar esta tela com "uma mão, com pressa" é medir a
   coisa errada. **375px é piso, não alvo**: pode ter mais campos, mais
   densidade e mais passos que a captura.
2. [x] **O link "Corrigir na nota"** (`app/adicionar/pagamento/page.tsx`) leva a
   uma tela que corrige, e volta ao pagamento com o dado novo.
3. [x] **Corrigir o valor** — campo único. Antes de gravar, a tela mostra
   **custo confirmado por ano-calendário, antes → depois** (mesmo padrão da tela
   `/desligar`, que já faz isso). Reusa `alocarCusto` sobre cópia com o valor
   novo; nenhuma linha nova em `lib/fiscal/vinculo.ts`.
4. [x] **Se a correção muda o custo de um ano anterior ao corrente**, o app grava
   **pendência persistente** — *"esta correção mudou o custo de um ano
   anterior; se a DAA daquele ano já foi entregue, avalie retificadora com seu
   contador"* — que **não some ao fechar a tela** (§6 do parecer: aviso que só
   existe no clique é aviso que não existiu). **O app não decide nem redige
   retificadora — CRC.** Agregação e baixa: critérios **20 e 21**.
5. [x] **Corrigir a classificação** (material ↔ mão de obra) — sem trava.
   Muda a composição da discriminação, não o total; a tela diz isso.
6. [x] **Corrigir o nome do emitente** — grava em `favorecido.nome`, **com
   rastro**, e é o **único** caminho pelo qual o nome muda. Resolve a ferida
   deixada aberta em `b807901` (*"nome gravado errado é permanente"*).
   **CNPJ/CPF não tem campo** nesta tela.
7. [x] **Toda correção grava rastro antes→depois** — §5 do parecer: campo,
   antes, depois, quando, quem, **motivo** (`erro_de_digitacao_minha` /
   `emitente_corrigiu_a_nota` / `outro`) e **anos afetados**. ⚠️ **Sempre — com
   ou sem pagamento vinculado.** O contador **mudou de posição** aqui: o adendo
   condicionava o rastro ao vínculo, e "ter pagamento vinculado" é estado
   mutável e futuro; rastro não gravado não se recupera.
8. [x] **O rastro é append-only na estrutura, não por convenção**: tabela
   própria com `insert, select` para `authenticated`, **sem `update`, sem
   `delete`**, e a linha do `ESPERADO` em `e2e/privilegios.spec.ts` **no mesmo
   diff da migration** (senão a suíte fica vermelha com o nome da tabela — é
   para isso que o teste existe).
9. [x] **Correção sem rastro é impossível**: as duas escritas (update + rastro)
   acontecem numa **função Postgres transacional** criada na mesma migration —
   o PostgREST não dá transação entre tabelas, e das duas ordens possíveis uma
   deixa rastro de correção que não aconteceu e a outra deixa correção sem
   rastro. Mesma filosofia do check `documento_quarentena_coerente`.
10. [x] **Se `motivo = emitente_corrigiu_a_nota`**, o documento novo (carta de
    correção ou NF substitutiva) é **anexado no mesmo ato**. Sem anexo, não
    grava.
11. [x] **Texto de tela para o erro que não é do app** — copiado **literalmente**
    do §3 do parecer (*"Esse dado está errado na nota, ou só aqui no app?"*),
    incluindo a distinção carta de correção × nota substitutiva. Não reescrever.
12. [x] **CNPJ/CPF errado tem saída declarada, sem campo**: a tela explica que
    CNPJ errado **não é typo, é outro favorecido**, que a nota antiga **continua
    no acervo** e qual é o caminho (§4 do parecer). Texto com saída declarada
    **não** é o "bloqueio total" que o §4.4 proíbe — o que ele proíbe é impasse
    sem explicação.
13. [x] **Retrofit — mover documento vira ato transacional com escolha por
    pagamento.** ⚠️ **Isto conserta um bug que está EM PRODUÇÃO**, e o texto
    anterior deste critério ("passa pela mesma função") subestimava o problema.
    `moverDocumentoDeObra` (`lib/data.ts`, tela `/documento/[id]/obra`) é um
    `UPDATE documento SET obra_id` **seco**: não toca em `pagamento.obra_id`,
    não toca em `pagamento_documento`, não grava rastro. Ele cria pela porta dos
    fundos o estado que o **critério 11 do CONTAI-018 proíbe** pela porta da
    frente — vínculo cruzando duas obras —, e `alocarCusto`
    (`lib/fiscal/vinculo.ts`) o ignora **em silêncio**, sob um comentário que
    afirma que *"o critério 11 impede que esse caso nasça pela interface"*.
    Com as **duas obras** que o Mateus tem hoje, o efeito de mover uma nota
    vinculada é: (1) o custo do ano **cai na origem**; (2) o **"pago sem nota"
    da origem sobe pelo mesmo valor** — alarme vermelho da meta 1 por um fato
    que não aconteceu; (3) **nada sobe no destino** (`min(0, valor) = 0`); (4)
    fica vínculo vivo no banco, invisível nas duas telas. Não é transferência,
    é evaporação (parecer, **adendo §5.1**, retratação de 19/08).

    **Forma — tela 8 do mock v2, aprovada, e §5.2 do adendo:** mover documento
    com pagamento vinculado é **UM ato transacional que não conclui com
    pagamento indeciso**. Para **cada** pagamento vinculado o Mateus escolhe,
    **um a um, em ato explícito** (a forma que o §4.4 do parecer **manda** usar
    — cascata silenciosa é proibida):
    - **(i) "este pagamento também é da obra de destino"** → vai junto
      (`pagamento.obra_id` muda), com rastro. **É o único desfecho que
      transfere custo** entre obras;
    - **(ii) "este pagamento é mesmo da obra de origem"** → **o vínculo se
      desfaz**, com rastro, e o pagamento volta a "pago sem nota" na origem —
      que aí é **a verdade**: a nota de outro imóvel nunca comprovou aquele
      pagamento.

    **Não existe terceira saída.** ⚠️ **Correção de texto de tela exigida pelo
    §5.2**: *"o total não muda"* só vale quando **todos** os pagamentos
    acompanham a nota. Em **desfecho misto**, o custo comprovado somado das duas
    obras **cai legitimamente** (a diferença é o pagamento que ficou sem
    documento hábil) — a tela não pode afirmar o contrário, e nisto o parecer
    vence a frase do mock.

    **Texto final das três frases, decidido pelo `po` em 19/08 e já APLICADO ao
    mock aprovado** (`design/mocks/CONTAI-021.html`, tela `s8` — correção de
    texto, sem redesenho, no precedente do critério 14; o parecer é normativo e
    isto **não** volta para aprovação do Mateus). O `lead-engineer` implementa
    **estas** strings, não as do mock v2 original:

    - **Desfecho (i)**, no lugar de *"O custo sai de uma obra e entra na outra —
      o total não muda"*:
      > Vai junto com a nota. O par pagamento↔nota continua inteiro, só muda de
      > imóvel: sai do custo de aquisição de um bem e entra no do outro, sem que o
      > seu gasto mude um centavo.
    - **Desfecho (ii)** — e ele **não pode sugerir prejuízo nem erro do Mateus**
      (ressalva 3 do `contador`: o pagamento continua sendo dispêndio da obra, o
      que falta é documento hábil que o comprove):
      > Então foi ligado ao papel errado. O vínculo se desfaz, com registro, e ele
      > volta a "pago sem nota" na obra de origem. O pagamento continua sendo
      > dispêndio dela — o que falta é o documento hábil que o comprove.
    - **Resumo do desfecho MISTO**, onde a queda aparece (é o único lugar em que
      a tela narra a mistura):
      > Dos R$ {total}, R$ {junto} acompanham a nota e R$ {fica} voltam a "pago
      > sem nota" em {obra de origem}. O custo confirmado somado das duas obras
      > cai R$ {fica}. Isso **não é perda**: esses R$ {fica} continuam sendo
      > dispêndio de {obra de origem} — o que falta é o documento hábil que os
      > comprove.

    ⚠️ **O lado espelhado deste bug — mover PAGAMENTO — não está neste ticket.**
    `moverPagamentoDeObra` (`lib/data.ts`, tela `/pagamento/[id]/obra`, mesmo
    componente `app/_components/corrigir-obra.tsx`) é o **mesmo `UPDATE` seco**,
    com o mesmo dano na direção inversa. É o **`CONTAI-008`**, reaberto em 19/08.
    Este ticket **não** o conserta e **não** o disfarça: nada aqui altera o
    comportamento da tela do pagamento.

    **Gravação**: documento + N pagamentos + N rastros numa **única função
    Postgres** (critério 9) — falha no meio sem transação é o estado inválido
    nascendo sozinho (adendo §5.5). As N linhas de `revisao` compartilham um
    **`ato_id`**: granular no banco, **uma** linha no histórico e **uma** na
    pendência (critérios 16 e 20). Motivo é `arquivamento_corrigido`, gravado
    sozinho — **esta tela não pergunta motivo** (adendo §5). **Sem pagamento
    vinculado** (tela 8b): rastro e aviso, **sem pendência** — não muda número
    em obra nenhuma (adendo §5.3, que confirma a tela). **Com** pagamento
    vinculado e delta em **ano anterior**: abre pendência do ano, nas obras
    cujo número mudou (§5.4).
14. [x] **`design/mocks/CONTAI-018.html`, tela s3b**: a dica *"Vem da nota — dá
    para trocar."* sai — o adendo a derruba e o código já não faz isso. É
    correção de mock, uma linha.
15. [x] **E2E contra o Postgres local** (regra dura do projeto): correção de
    valor com pagamento vinculado, conferindo pelo mesmo client autenticado (i)
    o valor novo, (ii) a linha de rastro, (iii) o custo por ano recalculado, e
    (iv) que o rastro **não** aceita update nem delete.

### Decisões do `po` — 2026-08-19 (as cinco perguntas do mock v1)

Mock `design/mocks/CONTAI-021.html` **v1 aprovado pelo Mateus em 19/08**; os
cinco blocos âmbar eram perguntas em aberto. Decididas pelo `po` por delegação
explícita do Mateus. **v2 do mock precisa desenhar só duas coisas** — a escolha
de desfecho do critério 21 e o botão do critério 19; o resto já está no v1.

16. [x] **O histórico de correções é EXIBIDO na rodada 1** — card read-only no
    detalhe do documento (`/documento/[id]`), uma linha por correção: quando,
    quem, campo, antes→depois, motivo e anos afetados; vazio diz *"Nenhuma
    correção neste registro."* **Não é tela nova**: é um `select` na tabela do
    critério 7, dentro de tela que já existe. Rastro que só o banco vê não
    cumpre a **meta 3** — quem vai ler isso em 2034 é o Mateus, não o Postgres.
17. [x] **Formulário de pagamento pela metade: aviso, não rascunho.** Sair por
    "Corrigir na nota" com qualquer campo preenchido abre confirmação de dois
    botões nomeados — *"Continuar o pagamento"* (padrão) e *"Sair e corrigir a
    nota — perco o que digitei"* — e o texto dá a saída barata: **o nome do
    emitente pode ser corrigido depois**, porque o pagamento aponta para o
    favorecido, não para o texto do nome; corrigir antes ou depois grava o mesmo
    dado. **Rascunho fica fora**: persistir formulário fiscal pela metade é
    escopo novo (o **anexo já escolhido não sobrevive à navegação em hipótese
    nenhuma**) e devolve dias depois um formulário sem contexto — o oposto de
    *campo vazio pergunta, campo preenchido afirma*.
18. [x] **Nota substitutiva entra como ANEXO ADICIONAL do mesmo registro**, no
    mesmo ato da correção de valor, com `motivo = emitente_corrigiu_a_nota`.
    **Não abre registro novo na rodada 1**: o app não tem estado "cancelada" e o
    §1 do parecer proíbe editar `status` — dois documentos vivos para o mesmo
    fato dobrariam `Σ documentos` e inflariam o custo, que é o passivo da **D25**
    com outro nome. Um registro, dois papéis anexados, o rastro dizendo qual
    valor veio de qual. **Decisão reversível**: quando o `CONTAI-004` trouxer
    número/série e a anotação da D25 existir, a substitutiva pode virar registro
    próprio *"substitui o documento X"* — sem reabrir gate fiscal.
19. [x] **A tela de CNPJ errado oferece UMA ação hoje, e a pendência dela tem
    lista de desfecho PRÓPRIA.**

    **A ação**: *"Marcar: o CNPJ deste registro está errado — tratar"*, que abre
    pendência do mesmo mecanismo do critério 4 (tipo `emitente_errado`), **uma
    por documento** (idempotente — voltar e marcar de novo deixa a lista com uma
    linha só, não existe "marcado duas vezes"), **sem campo editável, sem tocar
    `status` nem quarentena**. Motivo de produto, não fiscal: o §4.4 proíbe
    impasse mudo, e o risco concreto é ele dar vazão à intenção **trocando o nome
    do favorecido** — que é exatamente o que a tela pede para não fazer, hoje sem
    oferecer nada em troca.

    ⚠️ **Corrigido pelo `po` em 19/08** (tela `s6c` do mock v2, que estava à
    frente deste ticket): a versão anterior mandava baixar *"pelo critério 21"*, e
    os três desfechos do 21 são **todos sobre DAA** — nenhum descreve "resolvi o
    CNPJ errado". **A chave desta pendência é o DOCUMENTO, não o ano**, e a lista
    de desfecho é esta:

    - **Desfecho manual — um só, hoje**: *"Conferi o papel: o CNPJ gravado está
      certo — o erro foi meu ao marcar"* **+ data**.
    - **Desfecho automático — `apontamento_corrigido`**: gravado **sozinho**,
      por acréscimo, quando a **rodada 2** repontar `documento.favorecido_id`,
      apontando para a correção que fez a troca. É a **única baixa automática do
      sistema**, e é legítima onde a da retificadora não seria: aqui o app
      **prova** o fato — o ponteiro mudou no banco; lá ele não tem como saber se
      a DAA foi retificada.
    - **O que NÃO está na lista, e é de propósito**: *"já não é mais um problema,
      o registro aponta para o favorecido certo"*. Afirmação manual do que a
      máquina prova é **carimbo que não prova nada** — e na rodada 1 nada pode
      ter repontado, então a opção só serviria para **silenciar o alarme sem o
      conserto**.
    - **Enquanto a rodada 2 não existir, a pendência declara o que está
      esperando**: *"a correção do apontamento ainda não existe no app"*.
      Pendência que declara a própria saída não é o defeito do critério 20 —
      alarme **mudo** é.

    **Mecanismo, igual ao do critério 21**: o desfecho é **INSERT, não update**;
    a pendência **sai da lista** e fica no **histórico do documento** (critério
    16), com quem, quando e qual desfecho, legível em 2034; **marcar de novo
    depois da baixa abre pendência NOVA**, nunca ressuscita a antiga.

    **Marcar não gera linha de `revisao`**: nenhum dado do documento mudou, não
    há antes→depois a registrar (adendo §1 do parecer). O que existe é a
    pendência aberta, com a data.

    **E2E**: marcar duas vezes → uma linha; baixar com o desfecho manual → sai da
    lista e aparece no histórico **do documento**; marcar de novo depois da baixa
    → pendência **nova**.
20. [x] **A pendência de retificadora é por ANO-CALENDÁRIO, não por correção —
    e carrega um CONJUNTO DE OBRAS AFETADAS.**

    **(a) Acumulação.** Havendo pendência aberta para 2025, toda correção
    seguinte que mexa em 2025 **acumula nela**: a lista de correções que a compõem
    cresce e o delta exibido é o **acumulado do ano** (primeiro `antes` → último
    `depois`), **por obra**. Cinco correções não viram cinco linhas em "O que
    está faltando" — alarme que se multiplica é o mesmo defeito do alarme que não
    desliga. Um **move** (critério 13) entra como **uma** linha — *"Documento
    movido de A para B, com 2 pagamentos"* —, nunca como três: no banco são N
    linhas de `revisao` com o mesmo `ato_id`, na tela é um ato só.

    **(b) De onde vem o conjunto de obras — `[Certain]`, §5.4 do adendo.** As
    obras **candidatas** saem do **RASTRO**: `antes ∪ depois` do campo `obra` do
    ato. **Nunca de `documento.obra_id`** — depois do move o documento só conhece
    o **destino**, e derivar a obra dele apagaria a **origem**, que é justamente o
    lado onde o custo caiu e onde "pago sem nota" subiu. Perder o alarme no lado
    que piorou é o pior resultado possível desta tela.

    **(c) O filtro, e ele é obrigatório — decisão do `po`, 19/08** (ressalva 2 do
    `contador` sobre o desenho de `s7c`/`s8c`): **`antes ∪ depois` é o conjunto de
    CANDIDATAS; afetada é a candidata cujo custo daquele ano efetivamente
    mudou**, lido do **snapshot de anos afetados por obra** que o critério 7 já
    grava. **Fica com filtro**, e a versão sem filtro está descartada: sem ele, o
    desfecho em que **todos** os pagamentos ficam na origem acenderia pendência
    numa obra onde **nenhum número se mexeu**, contradizendo o §5.3 na frase
    seguinte a ela — e alarme falso é exatamente a doença que este ticket existe
    para curar. Custo de implementação: zero, o dado já está gravado.
    **Se, depois do filtro, nenhuma obra teve número alterado naquele ano, não
    abre pendência nenhuma** (é o caso `s8b`: documento sem pagamento vinculado).

    **(d) Onde ela aparece.** Na **tela inicial de cada obra afetada**, mostrando
    ali o delta **daquela** obra e **nomeando a(s) outra(s) SEM VALOR** — critério
    14 de `/obras`: dinheiro de duas obras somado na mesma tela é soma que não
    existe em declaração nenhuma. Na **tela da pendência**, onde o contexto é o
    ano, cada obra tem **a sua linha com o seu delta**, lado a lado e **nunca
    somadas**.

    **(e) É UMA pendência, não duas.** A chave é o **ano**, porque a **DAA é do
    contribuinte, não da obra**: uma retificadora de 2025 corrige as linhas das
    duas obras no mesmo ato, e **o desfecho do critério 21 não é divisível por
    obra** — uma baixa tira a pendência das duas telas iniciais ao mesmo tempo.

    **(f) Quando NÃO abre** (§5.3): documento **sem** pagamento vinculado (não
    muda número em obra nenhuma — documento sozinho comprova zero dos dois lados);
    e delta **só no ano corrente** (o número se corrige sozinho antes da DAA).

    **E2E**: mover documento com dois pagamentos em **desfecho misto** e provar
    que existe **uma** pendência de 2025, com **as duas** obras e o delta de cada
    uma; repetir com **todos** os pagamentos ficando na origem e provar que a obra
    de **destino não entra** no conjunto.
21. [x] **Só o Mateus baixa a pendência, em ato nomeado, e a baixa não apaga.**
    Botão *"Marcar como tratada"* na tela da pendência, que **exige escolher um
    desfecho** — nunca ao fechar a tela, nunca em lote, nunca automático, nunca
    sugerido pelo app:
    - *"Retifiquei a DAA de {ano}"* + data
    - *"Meu contador avaliou e não é preciso retificar"* + data
    - *"A DAA de {ano} ainda não foi entregue"* — não é retificadora: a correção
      entra na declaração normal
    O desfecho é **INSERT, não update** (mesma disciplina do critério 8): a
    pendência **sai da lista** e fica no histórico do ano, com quem, quando e
    qual desfecho, legível em 2034. **Correção nova depois da baixa abre
    pendência NOVA** — baixa não silencia delta futuro. **E2E**: abrir, acumular
    segunda correção no mesmo ano, baixar com desfecho, e provar que uma terceira
    correção reabre como pendência nova.

## Out of Scope — cortado da rodada 1, com o porquê

- **`destinatario_cpf_ok`, `tipo` e `vencimento`** — corrigíveis segundo o §1 do
  parecer, mas cada um traz regra própria (flip assimétrico com afirmação
  explícita; re-perguntar `classificacao`+`retencao_11` na troca de tipo).
  **Zero casos reais.** Entram quando aparecer o primeiro.
- **`numero`, `serie`, `data_emissao`** — **não existem no schema**. São o
  CONTAI-004, que ainda não entrou. **Não vira coluna aqui**; a tela não promete
  campo que o banco não tem. Quando o 004 entrar, a lista corrigível cresce pelo
  §1 do parecer, sem reabrir gate.
- **Fluxo de CNPJ errado** (trocar `favorecido_id` + repontar
  `pagamento.favorecido_id` um a um + favorecido órfão fora das sugestões) —
  **M–L**, zero casos reais, e o critério 12 já dá saída honesta. Rodada 2.
- **Detector de "ano já declarado"** — o app **não sabe** qual ano foi
  declarado, e inferir por calendário erra de janeiro a abril. O critério 4 diz
  a verdade que o app pode provar ("ano anterior"), não a que ele não tem.
- **Marcar documento como duplicata** — irmão natural deste ticket, apontado
  pelo `contador`. Não é edição de campo, é anotação. Dor **D25**.
- **Apagar documento ou pagamento** — segue fora de escopo (CONTAI-009, acervo
  append-only). Correção não é remoção.
- **Rascunho do formulário de pagamento** — critério 17. Volta se o aviso não
  resolver na prática (sinal: ele reclamar de digitação perdida), não antes.
- **Nota substitutiva como registro próprio** — critério 18. Depende do
  `CONTAI-004` (número/série) e da anotação da D25 para não gerar duplicidade.
- **Texto livre no desfecho da pendência** — critério 21 fecha em três opções.
  Campo livre em registro fiscal vira lugar de guardar o que ninguém relê.
- **Mover PAGAMENTO entre obras (o lado espelhado do critério 13)** — mesmo bug,
  mesma classe de dano, **outro ticket**: `CONTAI-008`, reaberto e reescrito em
  19/08. Fica fora daqui por três razões nomeadas: (1) a tela espelhada
  (*"escolha, documento a documento"*) **não está no mock v2 aprovado**, e
  mock-first é regra do Mateus, não do `po`; (2) ela reabre uma pergunta fiscal
  que o adendo §5 **não** responde — levar junto uma **NF de serviço** para obra
  cujo CNO ela não referencia, que é a pergunta 1 do Gate Fiscal do `CONTAI-008`,
  aberta desde 10/08 (`podeCorrigirObra` barra isso no caminho do documento e
  **não** roda no caminho do pagamento, onde `tipo` é `null`); (3) ela reusa
  inteira a máquina que **este** ticket constrói (`revisao`, `ato_id`, função
  transacional, pendência por ano) — feita depois custa uma fração, feita agora
  duplica o desenho. **Meia correção não é desculpa**: o `CONTAI-008` entra na
  fila **imediatamente depois deste**, e a exposição no intervalo está nomeada
  lá.

## Gate Fiscal (Contador)

Íntegra em `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md`.
O que este ticket **não pode** contrariar:

- **Só `valor` move custo entre anos-calendário.** `data_emissao` **nunca**
  governa o ano do custo — quem faz isso é `pagamento.data_pagamento`, fora deste
  ticket. Não escrever "correção de valor/data".
- **`status` e `motivo_quarentena` não são corrigíveis** — `status` é derivado.
  Dropdown de status é o caminho de fraude silencioso: não exige mentir sobre
  fato nenhum, só escolher um valor.
- **`arquivo_path` não é corrigível** — o anexo é a prova. Não se substitui,
  anexa-se adicional.
- **A string CNPJ/CPF de um favorecido existente nunca é reescrita.** O que é
  corrigível é o **ponteiro** `documento.favorecido_id` (rodada 2), não a chave.
- **Rastro**: exigência da **meta 3 do projeto**, `[Likely]` — *"não conheço
  regra que exija versionamento de um controle pessoal"*, **confirmar na
  legislação**. Não afirmar norma que o contador não afirmou.
- **Exige CRC**: qualquer retificadora; o efeito de correção em ano já
  declarado; se a correção de valor justifica retificar ou é imaterial.

## Pre-mortem

1. **A tela vira formulário genérico na implementação** e o rastro sai como diff
   de 8 campos misturados — a consequência fiscal certa nunca aparece no momento
   certo, e a linha de `revisao` fica ilegível em 2034.
2. **O rastro é gravado pelo app em duas chamadas** e uma delas falha. Metade
   dos casos deixa correção sem rastro, em silêncio. É o critério 9.
3. **A correção de valor move custo de 2026 depois de abril/2027** e ninguém
   avisa — o app faz a conta certa e não diz nada. É a D-018.2 chegando por
   outro gatilho, com o mesmo dano.

## Viabilidade (CTO)

- **Modelo de dados**: tabela nova **`revisao`**, genérica
  (`entidade` in `documento`/`favorecido`), `antes`/`depois` como snapshot dos
  campos alterados. **Não** JSONB em `documento` (privilégio é por tabela, não
  por coluna — append-only viraria promessa de código), **não** versionamento do
  próprio `documento` (quebra `pagamento_documento` por id, custo L).
  Sem FK em `entidade_id`: nada neste banco é apagado.
  **`lib/fiscal/vinculo.ts` não precisa de uma linha** — `alocarCusto` é puro e
  recalculado a cada carga; não há agregado persistido.
- **Deriva de privilégio em `favorecido`** (achado do `lead-engineer`):
  a 0005 concede `update` e o app não executa nenhum desde `b807901`.
  **Decisão: não revogar.** O critério 6 **volta a executar o UPDATE** —
  corrigir o nome do emitente é fisicamente `update favorecido set nome`. A
  deriva morre por uso, sem migration de revogação. Revogar agora para
  reconceder em seguida é churn de duas migrations e dois `db push`.
  **Se** o critério 6 for cortado no `/design`, o fallback é comentar a exceção
  no `ESPERADO` apontando para este ticket — **nunca revogação especulativa**.
- **Impacto das decisões 16-21** (forma é do `cto-obra`; comportamento está nos
  critérios): o critério 4 já exigia **pendência persistente** — os critérios
  19-21 dizem que ela tem **tipo** (`retificadora_possivel`, `emitente_errado`),
  **chave por ano-calendário** no primeiro caso e **desfecho gravado por INSERT**,
  nunca update. O critério 16 não pede nada novo do modelo: é `select` na
  `revisao`.
- **Arquivos**: `supabase/migrations/0009_*.sql` (0007 e 0008 já existem) (tabela + RLS + GRANT +
  função) · `e2e/privilegios.spec.ts` (`revisao: "INSERT,SELECT"`) ·
  `app/documento/[id]/corrigir/**` · `app/documento/[id]/page.tsx` (entradas) ·
  `app/documento/[id]/obra/page.tsx` (retrofit) ·
  `app/adicionar/pagamento/page.tsx` (link) · `lib/data.ts` · E2E ·
  `design/mocks/CONTAI-018.html`.
- **Complexidade**: **M** (rastro M · ações M · confirmação por ano S · link S).
- ⚠️ **`npx supabase db push` ANTES do `git push`** — migration de tabela nova
  com GRANT é exatamente o caso do incidente de 2026-08-17.

## Dependências

- **Bloqueado por**: Gate 0 (mock) · `CONTAI-018` (a tela de custo por ano
  antes→depois reusa o que o 018 entrega).
- **Bloqueia**: **`CONTAI-008`** (o lado espelhado — mover pagamento), que
  depende da tabela `revisao`, do `ato_id`, da função transacional e da pendência
  por ano que este ticket cria.
- **Relação**: `CONTAI-004` amplia a lista corrigível quando entrar, sem reabrir
  gate. A dor **D-018.2** compartilha o **mesmo detector** deste ticket
  (recalcular custo por ano e comparar) — **construir uma vez**; se sair duas
  vezes, o Mateus vê dois avisos diferentes para o mesmo evento fiscal.

## Perguntas Abertas (só o Mateus responde)

> As **cinco perguntas do `designer`** não estão aqui: foram decididas pelo `po`
> em 19/08 (critérios 16-21). As três abaixo continuam sendo do Mateus.

1. Corrigir **o nome do emitente** (critério 6) entra na rodada 1, ou eu corto e
   o nome errado segue permanente até a rodada 2?
2. Você quer registrar **em que data entregou a DAA de cada ano**? É o dado que
   falta para o app dizer "ano **já declarado**" em vez de "ano anterior".
3. Algum pagamento da obra já saiu para conta **diferente do emitente** da nota
   (boleto sacado por banco, PIX para CPF de sócio da WK)? — pergunta do
   contador ainda aberta desde 17/08; decide se a rodada 2 precisa do caso 3.

## Teste do Canteiro — **não se aplica como veto**

**APROVADO.** Cenário desta tela é **gestão em casa, sentado** (régua corrigida
no `CLAUDE.md` em 18/08). Ela serve à **meta 3** de forma direta: sem correção
com rastro, o acervo diverge do papel e não é append-only na prática; e serve à
**meta 2**, porque valor errado vai para a discriminação anual.
**375px continua sendo piso obrigatório** — nenhuma tela pode quebrar no
celular —, mas "não cabe com uma mão" **não é veto** aqui.


## Gate 3 — exercício dos fluxos — 2026-08-21 — **PASS**

Os quatro estados a **375px** (piso, não alvo — a régua de 18/08), na tela real,
contra o Postgres local, com o caminho do **move com pagamento vinculado** no
centro, que é o bug que estava em produção.

| Estado | O que foi exercitado | Resultado |
|---|---|---|
| **Erro** | move sem destino → botão *"Escolha a obra de destino"* **desabilitado**; com destino e um pagamento indeciso → *"Responda 1 pagamento para continuar"*; **trocar o destino zera as escolhas** e o rótulo volta a *"Responda 2 pagamentos"* | o ato **não conclui com pagamento indeciso**, e nenhuma linha de `revisao` nasce no caminho |
| **Feliz** | os dois pagamentos `vai_junto` | a frase proibida *"o total não muda"* **não aparece em lugar nenhum**, e o resumo do misto **não** é exibido (não há mistura a narrar) |
| **Edge** | **Σ pagamentos (12.000) > valor da nota (9.400)** — PIX 6.000 junto, boleto 6.000 fica | a tela afirma *"o custo confirmado, somando as duas obras, **cai R$ 3.400,00**"* e **não** R$ 6.000,00. É o bloqueante 1 do Gate 2 exercitado no caso que o expunha: a queda vem da **alocação**, não da partição dos pagamentos |
| **Vazio** | documento **sem** pagamento vinculado; `/pendencias` sem nada; histórico de documento nunca corrigido | *"Nenhum número mudou"*, **zero** linhas de ano afetado, **zero** pendências; *"Nenhuma correção neste registro."*; o vazio da lista nomeia **os dois** tipos de pendência |

Depois do move, a cadeia inteira foi percorrida na tela: **home da obra** (delta
**desta** obra, a outra **nomeada sem valor**) → **lista de pendências** →
**pendência do ano** (as duas obras, **linhas separadas, nunca somadas**) →
**histórico do documento** (o ato de 3 linhas de `revisao` aparece como **uma**
correção, *"com 2 pagamentos"*, com o motivo e o custo de cada obra).

Também exercitadas a 375px: as três ações nomeadas (valor — passos 1/2/3, com o
antes→depois por ano e o botão que diz a consequência no rótulo; classificação;
emitente), a tela de CNPJ errado com a marcação idempotente, e o link *"Corrigir
na nota"* do formulário de pagamento.

**Nenhuma tela rolou na horizontal a 375px** (`scrollWidth - clientWidth ≤ 1`
verificado em todas), e as tabelas de duas obras rolam **dentro do próprio
contêiner**.

**Um defeito encontrado e consertado** (`e517cc2`): a tela de CNPJ errado
renderizava *"rodada 2deste trabalho"* — o JSX come o espaço entre `</strong>` e
o texto da linha seguinte. Divergia da v2 do mock aprovada
(`design/mocks/CONTAI-021.html:1392`). Consertado com a asserção que trava a
regressão no mesmo diff, e varredura do mesmo padrão nas **nove** superfícies do
ticket, nos dois sentidos: era a **única** ocorrência.

## Gate 4 — validação do `po` — 2026-08-21 — **PASS**, com um loop

⚠️ **Régua**: corrigir nota registrada errada é **gestão, em casa, sentado**
(`CLAUDE.md`, correção de 18/08, e é do Mateus). **O "Teste do Canteiro" não se
aplica a esta tela** — 375px é **piso**, não alvo, e mais campos, mais densidade
e mais passos são legítimos aqui. Foi assim que ela foi medida.

| # | Critério | Veredito | Onde se prova |
|---|---|---|---|
| 1 | Mock aprovado antes do desenvolvimento | **PASS** | v2, `ad07fd8`, 19/08 |
| 2 | O link *"Corrigir na nota"* leva a tela que corrige e volta | **PASS** | `app/adicionar/pagamento/page.tsx:1050,1056` → `?voltar=pagamento` → `voltaHref` |
| 3 | Valor: custo por ano-calendário, antes → depois | **PASS** | exercitado na tela; `alocarCusto` sobre cópia, zero linha nova em `lib/fiscal/vinculo.ts` |
| 4 | Pendência persistente quando muda ano anterior | **PASS** | E2E + tela; ela **não some ao fechar** |
| 5 | Classificação sem trava, e a tela diz que muda composição e não total | **PASS** | `classificacao/page.tsx:340-346` |
| 6 | Nome do emitente com rastro, **único** caminho | **PASS** | não existe **nenhum** `.update` em `favorecido` no `lib/data.ts` — só o RPC `corrigir_nome_favorecido` |
| 7 | Rastro antes→depois **sempre**, com ou sem pagamento vinculado | **PASS** | E2E do move sem pagamento: 1 linha de `revisao`, 0 anos afetados |
| 8 | Append-only **na estrutura** + `privilegios.spec.ts` no mesmo diff | **PASS** | `update` e `delete` devolvem **42501** no E2E; o mapa de privilégios passou a cobrir **função** |
| 9 | Correção sem rastro é impossível (função transacional) | **PASS** | E2E que chama o RPC direto e prova o **rollback do ato inteiro** |
| 10 | `emitente_corrigiu_a_nota` exige o anexo no mesmo ato | **PASS** | as **duas** funções exigem (bloqueante 2 do Gate 2 fechou a assimetria) |
| 11 | Texto do §3 **copiado literalmente** | **PASS** | conferido **palavra por palavra** contra `2026-08-18-correcao-de-documento-registrado.md:65-80`, incluindo *"Peça ao emitente:"* e a distinção carta × substitutiva |
| 12 | CNPJ errado: saída declarada, **sem campo** | **PASS** | `cnpj-errado/page.tsx` — nenhum input; a saída está escrita |
| 13 | **Retrofit do move** (o bug em produção) | **PASS** | é o coração do Gate 3, exercitado inclusive com **Σ pagamentos > valor da nota** |
| 14 | A dica do mock do `CONTAI-018` sai | **PASS** | `8ecbe03` — *"Vem da nota — dá para trocar."* → *"Vem da nota. Se estiver errado, corrige-se na nota."* |
| 15 | E2E contra o Postgres local | **PASS** | `e2e/correcao.spec.ts`, 9 testes, sem stub |
| 16 | **Histórico exibido no detalhe do documento** | **FAIL → PASS** | ver o loop abaixo |
| 17 | Formulário pela metade: aviso, não rascunho | **PASS** | dois botões nomeados, o que se perde listado item a item, e a saída barata dita |
| 18 | Nota substitutiva como **anexo adicional** do mesmo registro | **PASS** no comportamento; ver ressalva | a tela diz *"o anexo não se substitui; se precisar, anexa-se um adicional"* |
| 19 | CNPJ errado: **uma** ação, lista de desfecho **própria** | **PASS** | marcar duas vezes → **uma** linha; desfecho da lista errada **recusado pelo banco** |
| 20 | Pendência por **ano** com **conjunto de obras afetadas** | **PASS** | (a) o move é **uma** linha · (b) o conjunto vem do **rastro** · (c) o **filtro** provado nos dois sentidos · (d) home nomeia a outra **sem valor** · (e) **uma** pendência, não duas · (f) não abre sem pagamento vinculado |
| 21 | Só o Mateus baixa, em ato nomeado, e a baixa **não apaga** | **PASS** | desfecho é **INSERT**; correção nova depois da baixa abre pendência **NOVA** |

### O loop: critério 16 reprovou, e o que ele era

O card do histórico existia e estava certo em tudo — menos no **motivo**, que
saía como o **token do enum**: *"motivo: erro de digitacao minha"*, sem acento.
A v2 do mock aprovada mostra a frase inteira que o Mateus escolheu
(`design/mocks/CONTAI-021.html:1640-1656, 1779-1793`): *"motivo: eu digitei
errado no app — o papel está certo"*. Divergência **silenciosa** de mock
aprovado, nos três lugares em que o rastro é lido por gente — e o rótulo humano
já existia no mesmo arquivo, **sem uso**.

Não é preciosismo de texto: o critério 16 existe porque *"rastro que só o banco
vê não cumpre a meta 3"*, e quem abrir esse acervo em **2034** não tem o enum
`motivo_revisao` à mão para traduzir. O defeito era **invisível** para as
asserções de estado gravado: o banco estava certo, a tela é que falava enum.

⚠️ **`arquivamento_corrigido` continua exibido como token** — de propósito, e a
v2 do mock o desenha assim (`:2183, 2258, 2334`): ele é gravado pela **máquina**
no move, sem pergunta, e não há frase do Mateus para mostrar.

### O que NÃO foi reprovado, e por quê

- **Divergências do mock declaradas no Gate 1/2 são decisão, não desvio** — e
  todas trazem o motivo escrito ao lado do código: a tabela de classificação sem
  quebra por ano (o dado não existe no schema; inventá-lo seria o palpite que o
  ticket proíbe), a linha *"sem classificação"*, o `status` real na tela de CNPJ
  errado, o alcance do nome sem quebra por ano, o anexo obrigatório nas **três**
  ações, o resumo do desfecho misto redigido pelo `contador`, a revalidação de
  CNO, o pagamento impedido de ir junto e o zeramento das escolhas ao trocar o
  destino.
- **O mock v2 ficou para trás em vários pontos** — a implementação está à frente
  dele, e isso **não bloqueia o PASS**; bloqueia quem for desenhar em cima.
  Registrado como tarefa do `designer` (mesmo tratamento dado ao `CONTAI-019`).

### Log dos gates

| Gate | Commit | Data |
|---|---|---|
| **0 — mock** | `ad07fd8` (v2, 27 telas, aprovada pelo Mateus) | 19/08 |
| **1 — implementar** | `9a088ed` → `67a1bcd` → `3ffbda9` → **`2cefc62`** (4 frentes) | 19-20/08 |
| **2 — review** | **`29d6144`** — APPROVE do `cto-obra` **e** do `contador`, depois de um loop com **seis bloqueantes** | 20/08 |
| **3 — fluxo** | **`e517cc2`** — 4 estados a 375px + o defeito do espaço | 21/08 |
| **4 — validação** | este commit — 21 critérios, **um loop** (`3f04536`) | 21/08 |

**Verificações da rodada final**: `lint` limpo · `typecheck` limpo ·
`npm run test` **369 passed** · `npx playwright test e2e/correcao.spec.ts`
**9 passed** · o exercício de Gate 3 (6 cenários a 375px) **passou em 45s**.

⚠️ **Flake conhecido, não é deste ticket**: `e2e/terreno.spec.ts:576`
(*"o saldo devedor aparece rotulado como fora da declaração"*, CONTAI-010)
falhou **uma vez** em 21/08, numa rodada da suíte completa que levou **17,4 min**
contra ~1,8 min normal — máquina sob pressão. **Passou isolada.** O `CONTAI-021`
não toca terreno nem financiamento.

### Ressalvas que saem daqui vivas

Todas com endereço em `../backlog.md` (seção *"Gates 2 a 4 do CONTAI-021"*):
**R1** dedupe do array do move · **R2** `alocarCusto` deveria **reportar** o
vínculo órfão · **R3** trigger concorrente, UUID cru e hora **UTC** no rastro,
morte do `corrigir-obra.tsx` — **R1 a R3 viram critérios 13-15 do `CONTAI-008`**
· **R4** pendência do `contador` sobre a repartição do coberto entre documentos
de **classificações diferentes** (morde o relatório da discriminação, não este
ticket) · **R5** `p_depois is null` recusado, ratificado **com a condição de
voltar ao `contador` se aparecer caso real**.

### ⚠️ Release ainda NÃO feito — e a ordem não é negociável

Este ticket traz **migration nova (`0009`)** e **assinatura de função alterada**.
Quando o Mateus autorizar:

1. `npx supabase db push` — **primeiro**, sempre;
2. conferir no dashboard (Database → Migrations) que a `0009` entrou;
3. `git push` — só então a Vercel deploya.

Código na frente da migration quebra em produção **em silêncio para quem
testou** — foi o incidente de 17/08, com o E2E local verde.
