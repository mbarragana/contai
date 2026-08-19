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

- **Gate 0 (mock)**: **v1 APROVADA pelo Mateus em 19/08**
  (`design/mocks/CONTAI-021.html`). Restam **duas superfícies** para a v2, já
  decididas: desfecho da pendência (critério 21) e o botão do critério 19.
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

1. [ ] **Mock aprovado pelo Mateus** antes do desenvolvimento — **v1 aprovada em
   19/08**; falta a v2 com as duas superfícies dos critérios 19 e 21. ⚠️ **Régua corrigida em 2026-08-18**:
   corrigir nota registrada errada é **gestão em casa, sentado, com calma** —
   cenário **principal**. Avaliar esta tela com "uma mão, com pressa" é medir a
   coisa errada. **375px é piso, não alvo**: pode ter mais campos, mais
   densidade e mais passos que a captura.
2. [ ] **O link "Corrigir na nota"** (`app/adicionar/pagamento/page.tsx`) leva a
   uma tela que corrige, e volta ao pagamento com o dado novo.
3. [ ] **Corrigir o valor** — campo único. Antes de gravar, a tela mostra
   **custo confirmado por ano-calendário, antes → depois** (mesmo padrão da tela
   `/desligar`, que já faz isso). Reusa `alocarCusto` sobre cópia com o valor
   novo; nenhuma linha nova em `lib/fiscal/vinculo.ts`.
4. [ ] **Se a correção muda o custo de um ano anterior ao corrente**, o app grava
   **pendência persistente** — *"esta correção mudou o custo de um ano
   anterior; se a DAA daquele ano já foi entregue, avalie retificadora com seu
   contador"* — que **não some ao fechar a tela** (§6 do parecer: aviso que só
   existe no clique é aviso que não existiu). **O app não decide nem redige
   retificadora — CRC.** Agregação e baixa: critérios **20 e 21**.
5. [ ] **Corrigir a classificação** (material ↔ mão de obra) — sem trava.
   Muda a composição da discriminação, não o total; a tela diz isso.
6. [ ] **Corrigir o nome do emitente** — grava em `favorecido.nome`, **com
   rastro**, e é o **único** caminho pelo qual o nome muda. Resolve a ferida
   deixada aberta em `b807901` (*"nome gravado errado é permanente"*).
   **CNPJ/CPF não tem campo** nesta tela.
7. [ ] **Toda correção grava rastro antes→depois** — §5 do parecer: campo,
   antes, depois, quando, quem, **motivo** (`erro_de_digitacao_minha` /
   `emitente_corrigiu_a_nota` / `outro`) e **anos afetados**. ⚠️ **Sempre — com
   ou sem pagamento vinculado.** O contador **mudou de posição** aqui: o adendo
   condicionava o rastro ao vínculo, e "ter pagamento vinculado" é estado
   mutável e futuro; rastro não gravado não se recupera.
8. [ ] **O rastro é append-only na estrutura, não por convenção**: tabela
   própria com `insert, select` para `authenticated`, **sem `update`, sem
   `delete`**, e a linha do `ESPERADO` em `e2e/privilegios.spec.ts` **no mesmo
   diff da migration** (senão a suíte fica vermelha com o nome da tabela — é
   para isso que o teste existe).
9. [ ] **Correção sem rastro é impossível**: as duas escritas (update + rastro)
   acontecem numa **função Postgres transacional** criada na mesma migration —
   o PostgREST não dá transação entre tabelas, e das duas ordens possíveis uma
   deixa rastro de correção que não aconteceu e a outra deixa correção sem
   rastro. Mesma filosofia do check `documento_quarentena_coerente`.
10. [ ] **Se `motivo = emitente_corrigiu_a_nota`**, o documento novo (carta de
    correção ou NF substitutiva) é **anexado no mesmo ato**. Sem anexo, não
    grava.
11. [ ] **Texto de tela para o erro que não é do app** — copiado **literalmente**
    do §3 do parecer (*"Esse dado está errado na nota, ou só aqui no app?"*),
    incluindo a distinção carta de correção × nota substitutiva. Não reescrever.
12. [ ] **CNPJ/CPF errado tem saída declarada, sem campo**: a tela explica que
    CNPJ errado **não é typo, é outro favorecido**, que a nota antiga **continua
    no acervo** e qual é o caminho (§4 do parecer). Texto com saída declarada
    **não** é o "bloqueio total" que o §4.4 proíbe — o que ele proíbe é impasse
    sem explicação.
13. [ ] **Retrofit**: `moverDocumentoDeObra` (`/documento/[id]/obra`) hoje é um
    UPDATE de documento possivelmente vinculado **sem rastro**. Passa pela mesma
    função. Senão a regra do critério 7 nasce com uma exceção não declarada.
14. [ ] **`design/mocks/CONTAI-018.html`, tela s3b**: a dica *"Vem da nota — dá
    para trocar."* sai — o adendo a derruba e o código já não faz isso. É
    correção de mock, uma linha.
15. [ ] **E2E contra o Postgres local** (regra dura do projeto): correção de
    valor com pagamento vinculado, conferindo pelo mesmo client autenticado (i)
    o valor novo, (ii) a linha de rastro, (iii) o custo por ano recalculado, e
    (iv) que o rastro **não** aceita update nem delete.

### Decisões do `po` — 2026-08-19 (as cinco perguntas do mock v1)

Mock `design/mocks/CONTAI-021.html` **v1 aprovado pelo Mateus em 19/08**; os
cinco blocos âmbar eram perguntas em aberto. Decididas pelo `po` por delegação
explícita do Mateus. **v2 do mock precisa desenhar só duas coisas** — a escolha
de desfecho do critério 21 e o botão do critério 19; o resto já está no v1.

16. [ ] **O histórico de correções é EXIBIDO na rodada 1** — card read-only no
    detalhe do documento (`/documento/[id]`), uma linha por correção: quando,
    quem, campo, antes→depois, motivo e anos afetados; vazio diz *"Nenhuma
    correção neste registro."* **Não é tela nova**: é um `select` na tabela do
    critério 7, dentro de tela que já existe. Rastro que só o banco vê não
    cumpre a **meta 3** — quem vai ler isso em 2034 é o Mateus, não o Postgres.
17. [ ] **Formulário de pagamento pela metade: aviso, não rascunho.** Sair por
    "Corrigir na nota" com qualquer campo preenchido abre confirmação de dois
    botões nomeados — *"Continuar o pagamento"* (padrão) e *"Sair e corrigir a
    nota — perco o que digitei"* — e o texto dá a saída barata: **o nome do
    emitente pode ser corrigido depois**, porque o pagamento aponta para o
    favorecido, não para o texto do nome; corrigir antes ou depois grava o mesmo
    dado. **Rascunho fica fora**: persistir formulário fiscal pela metade é
    escopo novo (o **anexo já escolhido não sobrevive à navegação em hipótese
    nenhuma**) e devolve dias depois um formulário sem contexto — o oposto de
    *campo vazio pergunta, campo preenchido afirma*.
18. [ ] **Nota substitutiva entra como ANEXO ADICIONAL do mesmo registro**, no
    mesmo ato da correção de valor, com `motivo = emitente_corrigiu_a_nota`.
    **Não abre registro novo na rodada 1**: o app não tem estado "cancelada" e o
    §1 do parecer proíbe editar `status` — dois documentos vivos para o mesmo
    fato dobrariam `Σ documentos` e inflariam o custo, que é o passivo da **D25**
    com outro nome. Um registro, dois papéis anexados, o rastro dizendo qual
    valor veio de qual. **Decisão reversível**: quando o `CONTAI-004` trouxer
    número/série e a anotação da D25 existir, a substitutiva pode virar registro
    próprio *"substitui o documento X"* — sem reabrir gate fiscal.
19. [ ] **A tela de CNPJ errado oferece UMA ação hoje**: *"Marcar: o CNPJ deste
    registro está errado — tratar"*, que abre pendência do mesmo mecanismo do
    critério 4 (tipo `emitente_errado`), **uma por documento** (idempotente),
    **sem campo editável, sem tocar `status` nem quarentena**. Motivo de
    produto, não fiscal: o §4.4 proíbe impasse mudo, e o risco concreto é ele dar
    vazão à intenção **trocando o nome do favorecido** — que é exatamente o que a
    tela pede para não fazer, hoje sem oferecer nada em troca. Baixa pelo
    critério 21, ou **automática** quando a rodada 2 repontar `favorecido_id`.
20. [ ] **A pendência de retificadora é por ANO-CALENDÁRIO, não por correção.**
    Havendo pendência aberta para 2025, toda correção seguinte que mexa em 2025
    **acumula nela**: a lista de correções que a compõem cresce e o delta exibido
    é o **acumulado do ano** (primeiro `antes` → último `depois`). Cinco
    correções não viram cinco linhas em "O que está faltando" — alarme que se
    multiplica é o mesmo defeito do alarme que não desliga.
21. [ ] **Só o Mateus baixa a pendência, em ato nomeado, e a baixa não apaga.**
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
- **Bloqueia**: nada.
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
