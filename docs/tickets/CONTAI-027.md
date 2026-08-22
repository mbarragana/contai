# CONTAI-027 — Ver o anexo, e anexar mais de um

## Tipo e Prioridade

feature — **P1 (fricção com consequência de acervo)**, em **duas rodadas**.

- **Rodada 1 — abrir o anexo (dor D35)**: o app **não abre anexo nenhum, em tela
  nenhuma**. Vai primeiro.
- **Rodada 2 — N anexos por lançamento (dor D37)**: começa em
  `terreno_desembolso`, com o **molde decidido para o modelo inteiro**.

**Por que não P0 hoje**: nenhum número está errado por causa disto. O que existe
é acervo que entra e nunca mais é lido, e comprovante que fica de fora por falta
de lugar.

**O gatilho que vira P0, nomeado**: o **primeiro pagamento por medição à
empreiteira** que chegar com **recibo + comprovante** (dois papéis, um
desembolso) — a partir daí, a escolha é anexar um e perder o outro.

- **Gate 0 (mock)**: ⚠️ **PENDENTE — rodar `/design` antes do `/develop`.**
  Não existe mock. É o critério de aceite nº 1.
- **Gate Fiscal**: `contador`, 2026-08-21 — **transcrito na íntegra abaixo**.
  Derrubou duas exigências que o `po` tinha proposto.
- **Viabilidade**: `cto-obra`, 2026-08-21 — aprovado, com **uma discordância de
  formato registrada** (ele queria dois tickets; ver "Por que um ticket só").

## Dor de Origem

Relato do Mateus, 2026-08-21, registrando o desembolso da **entrada do terreno**:

> *"deveria poder ser múltiplos arquivos porque eu fiz mais de uma
> transferência"*

Perguntado se as transferências foram no mesmo dia: *"pode ser dias diferentes,
meu caso atual são dias diferentes"*.

### ⚠️ O caso dele NÃO é o caso deste ticket — e isso fica escrito

**No caso do Mateus não é um desembolso com N comprovantes: são N desembolsos**,
cada um com a sua data de débito. Regime de caixa é por **data**; juntar os três
num lançamento só põe custo no período errado — pior ainda se cruzar o
ano-calendário. **A tela já suporta N lançamentos hoje**, e ele já foi orientado
a registrar três, cada um com a sua data e o seu comprovante.

**O que sobra, e é o que o ticket resolve**: **um único desembolso com mais de um
documento de suporte** — quando o **limite do PIX** obriga a quebrar a
transferência **no mesmo dia**, ou quando o comprovante vem acompanhado de
recibo/contrato/escritura.

O `contador` acrescentou o enquadramento que faltava: **o modelo fiscal do
projeto já é de conjunto, não de par 1:1** — `min(Σ pagamentos, Σ documentos
hábeis)` (parecer de 17/08, §3) e *"a fatura de cartão é um documento para N
pagamentos"* (adendo 2). **A coluna única de `arquivo_path` sempre foi a
anomalia**; este ticket não cria caso novo, remove limitação que a regra fiscal
nunca teve.

### A dor irmã, que vem junto — D35

Do Gate 4 do `CONTAI-021` (`docs/backlog.md`): **não existe um `createSignedUrl`
no repositório**. Três telas mostram o nome do arquivo e uma delas manda, com
todas as letras, *"Papel anexado — **confira antes de digitar**"*
(`app/documento/[id]/corrigir/valor/page.tsx:308`). **Conferir o quê, se não dá
para abrir?**

Morde a **meta 3** de frente: acervo que ninguém consegue ler é acervo que não
cumpre o prazo de decadência. E **anexar vários sem conseguir ver nenhum é meio
caminho para acervo inútil**.

## User Story

Como dono da obra, **em casa, sentado, revisando o que registrei**, quero
**abrir** os papéis que anexei e **anexar mais de um** ao mesmo desembolso — para
que o comprovante quebrado pelo limite do PIX e o recibo que veio junto com ele
fiquem no acervo, legíveis por quem for ler isso em 2034.

## Por que um ticket só, e não dois — decisão do `po` com dissidência registrada

O `cto-obra` recomendou **dois tickets**, com a D35 primeiro. O argumento dele é
bom e está adotado **na ordem**: *"o multi-anexo cria pela primeira vez uma lista
de anexos em tela, e é o visualizador que define como um item dessa lista se
apresenta e se abre. Multi-anexo primeiro = construir a lista burra agora e
retrofitar o Abrir depois, em todas as telas."*

**Onde eu discordo dele: no número de tickets, não na ordem.** A razão é o
recurso mais escasso do projeto — **rodada de mock com o Mateus**. "Lista de
anexos, cada um com **Abrir**" é **um desenho só**. Dois tickets = duas rodadas
de `/design` e duas aprovações para a mesma tela, e a segunda chegaria pedindo
para mudar o que ele acabou de aprovar. A preocupação de retrabalho do `cto-obra`
é integralmente resolvida pela **ordem das rodadas dentro do ticket**, que é a
que ele pediu.

**Rodada 1 fecha e vai ao ar sozinha.** Ela não depende de migration nenhuma.

## Critérios de Aceite

### Rodada 0 — o portão

1. [ ] **Mock em `design/mocks/CONTAI-027.html` aprovado pelo Mateus.** Cobre as
       duas rodadas num desenho só: lista de anexos com **Abrir** em cada um, e o
       formulário aceitando mais de um arquivo. **PENDENTE: rodar `/design`.**

### Rodada 1 — abrir o anexo (D35). Sem migration.

2. [ ] Componente **único e reusável** de anexo, com botão **Abrir**, aplicado em
       **todas** as telas que hoje só exibem o nome do arquivo: as três de
       correção do `CONTAI-021`, o detalhe do documento, o detalhe do pagamento,
       o painel do terreno e o informe do financiamento. Nenhuma tela fica
       mostrando nome sem poder abrir.
3. [ ] O link é **assinado e temporário** (`createSignedUrl`) — o bucket `acervo`
       é privado e continua privado. **Nenhuma URL pública é gerada.**
4. [ ] `acervo_dono_select` (migration `0002_storage.sql`) já é a única
       autorização: o anexo de outro usuário **não abre**, e o teste prova isso.
5. [ ] Falha ao gerar o link tem **estado de erro visível com "Tentar de novo"** —
       não um botão que não faz nada (é o item 1 da **D36**, que entra aqui de
       carona porque é a mesma superfície).
6. [ ] A tela que manda *"confira antes de digitar"* passa a ter o **Abrir** ao
       lado da frase. **Nenhuma tela promete comportamento que não existe.**

### Rodada 2 — N anexos, começando pelo terreno (D37)

7. [ ] `terreno_desembolso` aceita **N anexos**. A coluna `arquivo_path`
       **morre** na mesma migration, precedida de **backfill** das linhas
       existentes.
8. [ ] O formulário de desembolso aceita **mais de um arquivo** no mesmo ato de
       registro. **O caminho de captura continua curto**: anexar um só arquivo
       não ganha passo nenhum a mais.
9. [ ] Depois de gravado, o desembolso **lista todos os anexos**, cada um com
       **Abrir** (o componente da rodada 1).
10. [ ] **Nenhum campo de valor por anexo.** O valor do lançamento é digitado
        **uma vez**, no lançamento. (Gate Fiscal §1 — a soma dos anexos é
        exigência inventada e está **derrubada**.)
11. [ ] **Nenhum campo de data por anexo.** (Gate Fiscal §2 — data por anexo é
        campo que só existe se ele digitar, que ninguém confere, e que o app
        trataria como fato: seria **fabricar a evidência que o app não tem**.)
12. [ ] ⚠️ **A pergunta do segundo anexo**: ao anexar o **segundo** arquivo, o app
        faz **uma** pergunta binária, **obrigatória e sem default**: *"esses
        débitos saíram todos no dia [data do lançamento]?"*
        - **Sim** → grava, fim.
        - **Não** → **grava assim mesmo** e abre pendência
          **"lançamento com débitos em datas diferentes"**.
        **Recusar a gravação está proibido** (adendo 2: *"nunca recuse o registro
        de um fato consumado"*).
13. [ ] A pendência do critério 12 **bloqueia a geração da discriminação daquele
        ano** até ser resolvida — mesmo mecanismo do compromisso vencido. Não
        trava a captura; trava a declaração, que é onde o erro custa.
14. [ ] **Campo `papel` por anexo**, conjunto fechado e curto (2–3 valores),
        **obrigatório e sem default**. Ele não alimenta apuração nenhuma —
        existe para o dossiê responder, em 2034, **qual papel sustenta o quê**.
15. [ ] **Pago sem anexo continua VISÍVEL.** A pendência de complemento
        (critério 23 do `CONTAI-010`) passa a derivar de *"não existe anexo"* na
        tabela filha, **não** de `arquivo_path is null`. Teste próprio, montando
        o cenário pelo client autenticado.
16. [ ] ⚠️ **O modelo não pode fechar a porta de N→1** (Gate Fiscal §5): a fatura
        de cartão é **um comprovante para N pagamentos**, e isso já está
        registrado como pendência. **Nenhum `unique` em `arquivo_path`**: o mesmo
        objeto do acervo pode sustentar mais de um lançamento.
17. [ ] `e2e/privilegios.spec.ts` atualizado **no mesmo diff** da migration
        (`terreno_desembolso_anexo: "INSERT,SELECT"` — append-only, sem UPDATE e
        sem DELETE, como `documento_anexo`).

## Out of Scope

- **Desdobrar automaticamente** um lançamento em N quando a resposta do critério
  12 for "não". A pendência **nomeia a ação**; quem executa é o Mateus,
  registrando os lançamentos certos. Desdobrar sozinho mexe em valor e data de
  registro já gravado — território do `CONTAI-024`/`CONTAI-025`, e, se o ano já
  foi declarado, **exige CRC e retificadora** (Gate Fiscal §6). **Registrado como
  D38**, sem ticket.
- **N anexos em `pagamento`** — o molde fica decidido aqui, a aplicação vem com a
  dor da medição. Copiar o molde é ~1 dia.
- **N anexos em `financiamento_informe`** — **cortado com fundamento**: o extrato
  anual é **uma peça por exercício**, de layout fechado. Mesmo argumento das sete
  rubricas em colunas fixas do `CONTAI-010`.
- **N anexos em `documento`** — **já está resolvido no modelo**:
  `documento_anexo.revisao_id` é nullable, então anexo adicional sem correção já
  é representável. Falta só UI, e ela não é desta dor.
- **Extrair valor ou data de dentro do comprovante** — é a `US-008`, e a sua
  ausência é justamente o que sustenta os critérios 10 e 11.
- **Anexar escritura, ITBI e matrícula** como acervo próprio — continua sendo o
  corte declarado do `CONTAI-010`. Este ticket dá o **lugar**; o que se anexa a
  cada desembolso é decisão de uso.

## Gate Fiscal (`contador`, 2026-08-21)

⚠️ **Correção de referência do próprio `contador`**: o adendo 2 (*"o comprovante é
constitutivo no caminho PF"*) está em
`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md:502` — **não** no
parecer de correção de documento, como este ticket dizia na primeira redação.

### §1 — Vários comprovantes para um desembolso: **indiferente**

*"Não muda nada em documentação hábil.* `[Certain]` *A condição 3 do parecer de
17/08 exige documentação que corresponde àquele desembolso — correspondência
entre o **conjunto** de papéis e o fato, nunca 'um papel por fato'. **Não existe
norma que conte arquivos**."*

**A trava de soma foi proposta pelo `po` e DERRUBADA**, por dois motivos:

1. *"Comprovante não é documento hábil, é prova da condição 1. O que entra em
   `Σ documentos` é a NF/recibo. Somar comprovantes seria criar uma terceira soma
   que não existe em nenhuma apuração."*
2. *"Como o valor do lançamento é digitado e o anexo não tem valor legível,
   exigir soma = exigir que ele digite um valor por anexo. **Número inventado por
   quem tem interesse no total, que ninguém confere, gravado no acervo que
   precisa sustentar 2034. É pior do que não ter número**."*

> **Se** um lançamento tem N anexos **e** o app não extrai valor do anexo,
> **então** nenhum anexo carrega valor, nenhum entra em soma alguma, e o valor do
> lançamento continua sendo **um só, digitado uma vez**. Automático.

**Consequência que protege o ticket**: *"dupla contagem por anexo é impossível
por construção — se o valor não vem do anexo, anexar o mesmo comprovante a dois
lançamentos não infla custo nenhum."*

### §2 — Datas diferentes: regra confirmada, implementação derrubada

*"Confirmo o `po` na regra e derrubo a implementação que ela sugere."* `[Certain]`

**A regra**: *"um lançamento = uma data de caixa. Dois débitos em dias diferentes
são dois fatos. Não é só o risco de cruzar ano-calendário — dentro do mesmo ano,
a repartição cronológica usa a ordem das datas para decidir em qual pagamento
recai o 'pago sem nota'. **Data colapsada corrompe a alocação mesmo sem virar o
ano**."*

**Onde viraria teatro**: *"'data por anexo' é campo que só existe se ele digitar,
que ninguém confere, e que o app trataria como fato. Seria fabricar a evidência
que o app não tem — o defeito que a meta 1 existe para impedir. **Não peça data
por anexo**."*

**O que é implementável** — pergunta sobre o **lançamento**, não sobre os
arquivos: é o **critério 12**, e o **dente** dela é o **critério 13**.

*"Isso resolve a tensão dos dois cenários do `CLAUDE.md`: não trava a captura no
canteiro, trava a gestão em casa — que é onde a declaração se monta."*

**Fronteira**: a pergunta **só existe onde há data de caixa** — `pagamento` e
`terreno_desembolso`. Em `documento` e `financiamento_informe`, N anexos **não
geram pergunta nenhuma**.

### §3 — PF (recibo): muda, e é o único ponto com dano fiscal real

| Papel | O que sustenta | Onde vive |
|---|---|---|
| **Recibo** (nome, CPF, descrição) | condição 3 — entra em `Σ documentos`, alimenta Pagamentos Efetuados | `documento` |
| **Comprovante da transferência** | condição 1 — **constitutivo** no caminho PF | anexo do `pagamento` |

> **Se** o recibo for anexado como mais um comprovante do pagamento em vez de
> registrado como `documento`, **então** `Σ documentos` perde aquele valor e o
> pagamento aparece como **"pago sem nota"** — o app passa a **acusar risco onde
> o acervo está completo**. É o inverso da inflação de custo, e é igualmente
> falso.

> **Se** um lançamento de pagamento recebe N anexos, **então** todos são, por
> definição, **comprovantes daquele desembolso**. Se o usuário marca um deles
> como sendo a nota/o recibo, o app **não recusa** — oferece o caminho de
> registrá-lo como `documento`, e enquanto ele não for, a pendência "pago sem
> nota" **permanece aberta e verdadeira**.

O campo `papel` do **critério 14** é *"obrigatório, conjunto fechado e curto, sem
default — não pela apuração, que não o consulta, mas pelo dossiê"*.

### §4 — Discriminação: não muda. Dossiê: muda, e é onde o trabalho está

*"A discriminação carrega composição — total do ano, materiais × mão de obra,
CNO — e **nunca listou nota por nota**, muito menos arquivo por arquivo. A
quantidade de anexos é invisível ali."* O único caminho pelo qual o ticket toca a
discriminação é o §2, e **é por isso que a pendência bloqueia o relatório**.

> **Se** um lançamento tem N anexos, **então** no índice do dossiê: cada anexo é
> **linha própria com hash SHA-256** e papel; **o valor aparece uma única vez, na
> linha do lançamento, nunca repetido por anexo**; e o índice declara que os N
> anexos compõem **um** desembolso.

*"Sem essa última frase, quem abrir o pacote em 2034 lê três comprovantes e conta
três pagamentos. **Um dossiê que induz soma errada é pior que um incompleto**."*
→ **restrição para o `CONTAI-011`**, anotada lá.

### §5 — Restrição de modelagem (é o **critério 16**)

*"O adendo 2 já declarou como falha de modelagem o caso inverso: a fatura do
cartão é **um comprovante para N pagamentos**. Se o `CONTAI-027` modelar o anexo
como filho exclusivo do lançamento, ele resolve 1→N e **fecha a porta de N→1**."*

### §6 — Automático × humano × CRC

- **Sistema sozinho**: gravar N anexos sem exigir soma e sem pedir valor por
  anexo; fazer a pergunta binária ao segundo anexo; gravar sempre e abrir a
  pendência; bloquear a discriminação do ano; manter o recibo fora dos anexos do
  pagamento; montar o índice do dossiê.
- **Só o Mateus**: responder se os débitos são do mesmo dia — *"o app não tem
  como saber, e não deve fingir que tem"* — e dizer qual papel é qual.
- **Exige CRC**: desdobrar lançamento de **ano já declarado** (retificadora).
- **Números a confirmar**: **nenhum**. Não há alíquota, ficha nem prazo novo.

## Viabilidade (`cto-obra`, 2026-08-21)

### Modelo de dados — **(a3): uma tabela filha por entidade, no molde de `documento_anexo`**

*"Decida o **padrão** para o modelo inteiro, mas implemente **só terreno** neste
ticket. A pergunta 'só terreno ou tudo?' mistura duas decisões: qual é o molde
(global, se fecha agora, por escrito) e onde ele é aplicado (dor a dor)."*

**⚠️ Isto é decisão de arquitetura do projeto, não escolha deste diff** — está
aqui para o próximo ticket copiar, não reinventar:

- **Polimórfica (`entidade`/`entidade_id`) — REJEITADA, "a pior das quatro"**:
  *"`revisao.entidade_id` é sem FK porque revisão é referência ao passado; anexo
  é parte do acervo — a própria 0009 faz essa distinção por extenso. Polimórfica
  quebra o 'dono derivado do pai': a RLS viraria um `case` por entidade, ou um
  `user_id` próprio que pode discordar do pai."*
- **Generalizar `documento_anexo` — REJEITADA**: *"é a polimórfica disfarçada, e
  mexeria na 0009, que já fechou quatro gates e só espera `db push`."*
- **As quatro tabelas de uma vez — REJEITADA**: `pagamento.comprovante_path` tem
  semântica própria (`null` = pendência de conciliação), o informe não precisa de
  N, e `documento` já está resolvido.

**A coluna morre, com backfill** — e *"isto **não** contradiz o backfill
dispensado da 0008: aquele inventaria linhas `pago` sem data; este não inventa
fato nenhum, só move um path de lugar."* Coluna convivendo com tabela filha é o
anexo em dois lugares, e toda query de pendência teria de olhar os dois para
sempre.

**Dívida assumida, não esquecida**: não há CHECK de banco para *"pago ⇒ ≥1
anexo"* (é cross-table). *"A opção honesta seria constraint trigger deferida —
não neste ticket: o fluxo previsto→pago está pendente e a trava congelaria essa
decisão."* Hoje **já existe** caminho de INSERT que grava `pago` sem anexo; a
tabela filha não piora nada, só torna a verdade visível — daí o **critério 15**.

### Arquivos prováveis

- `supabase/migrations/0010_terreno_anexo.sql` — tabela, RLS derivada do pai,
  revoke/grant, backfill, `drop column`
- `lib/data.ts` — tipos, `gravarDesembolso`, `completarDesembolsoTerreno`
  (`:1740` — data continua UPDATE no pai, anexo vira INSERT na filha), listagem
- `app/_components/` — o componente de anexo com **Abrir** (rodada 1)
- `app/obras/[id]/terreno/desembolsos/page.tsx` e `terreno/page.tsx`
- `app/documento/[id]/…`, `app/pagamento/[id]/…` — consumo do componente
- `e2e/privilegios.spec.ts` (mapa), `e2e/terreno.spec.ts`, `e2e/fixtures.ts`
  (a filha entra na limpeza)

### Complexidade: **M** — *"fronteira com S; o que pesa é a migration destrutiva + E2E"*

Rodada 1 isolada é **S**.

## Pre-mortem

**Do `po` (produto):**

1. **O campo `papel` virou taxonomia grande** e cada anexo passou a custar uma
   decisão. O Mateus parou de anexar o segundo papel — e o ticket que existia
   para completar o acervo passou a esvaziá-lo. **Mitigação**: critério 14 fixa
   2–3 valores.
2. **A pergunta do critério 12 virou clique automático no "sim"**, e o
   lançamento com duas datas passou silencioso. **Mitigação**: sem default, e o
   dente é o bloqueio da discriminação — não o aviso.
3. **A rodada 2 entrou e a rodada 1 ficou para depois.** Aí sim ele anexa três
   papéis que não consegue abrir, que é o cenário nomeado no relato como *"meio
   caminho para acervo inútil"*. **Mitigação**: a ordem é critério, não sugestão.

**Do `cto-obra` (técnico):**

4. ⚠️ **Fila de migrations destrutivas não empurradas.** *"0009 e 0010 paradas
   esperando autorização, código na `main` já lendo a filha. Um `git push` fora
   de ordem e produção quebra com E2E verde — é o incidente de 2026-08-17 com
   agravante de fila."* → **`0009` e `0010` sobem no MESMO `db push`, ANTES do
   deploy deste ticket.**
5. **Gravação em dois INSERTs deixou órfão**: upload ok, INSERT da filha falhou,
   desembolso ficou `pago` sem anexo — e a query do critério 15 não foi escrita,
   ou foi escrita com join errado e silenciou. *"Ninguém vê até 2034."*
6. **Nasceu um terceiro padrão de anexo** — ou alguém "refatorou" as filhas numa
   polimórfica para reduzir duplicação, quebrando a RLS derivada.

## Dependências

- **Bloqueia**: o ticket de N anexos em `pagamento` (medição), ainda sem ID.
- **Bloqueado por**: nada na fila. ⚠️ **Mas a rodada 2 exige que a migration
  `0009` (do `CONTAI-021`) esteja no remoto** — as duas sobem juntas.
- **Restringe**: `CONTAI-011` (dossiê) — o §4 do Gate Fiscal é requisito de lá.
- **Absorve**: **D35** (rodada 1) e o item 1 da **D36** (critério 5).

## Perguntas Abertas — nenhuma para o Mateus

1. **Ao `contador`, no `/design`**: quais são os **2–3 valores** do campo `papel`?
   O parecer fixou "curto e fechado" e nomeou dois usos (comprovante de
   transferência; recibo/nota) — falta o terceiro, se existir (contrato,
   escritura, boleto).
2. **Ao `cto-obra`, no Gate 1**: a pendência do critério 12 entra como **valor
   novo no enum `tipo_pendencia`** da `0009` (o que exige a contrapartida em
   `docs/pareceres/`, pela **D32**), ou é estado derivado de uma coluna no
   próprio desembolso? A `0009` ainda não está no remoto — a janela para alterar
   o enum sem migration extra é agora.
3. **Ao `cto-obra`, no Gate 1**: `terreno_desembolso_anexo` entra na limpeza do
   `e2e/fixtures.ts` por qual caminho, já que a exceção do `docker exec … psql`
   é nomeada e fechada?

## Teste do Canteiro — **não se aplica, e a régua certa é outra**

Pela régua de 18/08: registrar desembolso do terreno e revisar anexo é **gestão —
em casa, sentado, com calma**. **375px é piso, não alvo**: nenhuma tela pode
quebrar no celular, mas *"não cabe com uma mão"* **não é veto** aqui.

O que continua valendo, e é critério: **o caminho de captura não pode alongar**.
Anexar **um** arquivo no canteiro tem que ter exatamente os passos de hoje — a
pergunta do critério 12 só aparece a partir do **segundo** anexo, e nunca aparece
para quem anexou um só.

**Veredito: APROVADO**, com Gate 0 (mock) pendente.

- **Meta 1** — nenhum pagamento sem documento hábil: o segundo papel deixa de não
  ter lugar.
- **Meta 3** — acervo que sobrevive à decadência: a rodada 1 é **meta 3 pura**.
  Acervo que ninguém abre não cumpre prazo nenhum.
- **Meta 2** — o critério 13 impede que a discriminação saia de um ano com
  lançamento que esconde duas datas.
