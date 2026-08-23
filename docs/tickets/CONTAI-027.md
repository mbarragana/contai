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

- **Gate 0 (mock)**: ✅ **`design/mocks/CONTAI-027.html` aprovado pelo Mateus em
  2026-08-21**, já **com o corte do critério 13 dentro**.
- **Gate Fiscal**: `contador`, 2026-08-21 — **transcrito na íntegra abaixo**.
  Derrubou duas exigências que o `po` tinha proposto.
- ⚠️ **Adjudicação fiscal de 2026-08-21 — a regra deste ticket mudou.**
  Fonte: `docs/pareceres/2026-08-21-gate-fiscal-contai-027-criterio-13.md`.
  O corte do **critério 13** foi decidido *dentro* do Gate 0 e ficou **um dia
  sem existir em arquivo nenhum**: o ticket seguiu contradizendo um mock já
  aprovado. O parecer adjudica pelo mérito — **o corte está CONFIRMADO**, com
  **fundamentação corrigida**: o argumento *"a discriminação não é transmitida
  pelo app"* está **REJEITADO** (§2 do parecer) e **não pode ser reusado em
  ticket, mock ou tela** — ele derrubaria junto o bloqueio do compromisso
  vencido, que está de pé. Esta revisão do ticket executa o **§8** do parecer.
  **Regra fiscal e texto de tela deste ticket vêm de lá, não daqui.**
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

1. [x] **Mock em `design/mocks/CONTAI-027.html` — APROVADO pelo Mateus em
       2026-08-21.** Cobre as duas rodadas num desenho só: lista de anexos com
       **Abrir** em cada um, e o formulário aceitando mais de um arquivo. O mock
       aprovado já traz **o corte do critério 13** e o **critério 9b**; era o
       ticket que estava desatualizado, não ele.

### Rodada 1 — abrir o anexo (D35). Sem migration.

2. [x] Componente **único e reusável** de anexo, com botão **Abrir**, aplicado em
       **todas** as telas que hoje só exibem o nome do arquivo: as três de
       correção do `CONTAI-021`, o detalhe do documento, o detalhe do pagamento,
       o painel do terreno e o informe do financiamento. Nenhuma tela fica
       mostrando nome sem poder abrir.
3. [x] O link é **assinado e temporário** (`createSignedUrl`) — o bucket `acervo`
       é privado e continua privado. **Nenhuma URL pública é gerada.**
4. [x] `acervo_dono_select` (migration `0002_storage.sql`) já é a única
       autorização: o anexo de outro usuário **não abre**, e o teste prova isso.
5. [x] Falha ao gerar o link tem **estado de erro visível com "Tentar de novo"** —
       não um botão que não faz nada (é o item 1 da **D36**, que entra aqui de
       carona porque é a mesma superfície).
6. [x] A tela que manda *"confira antes de digitar"* passa a ter o **Abrir** ao
       lado da frase. **Nenhuma tela promete comportamento que não existe.**

### Rodada 2 — N anexos, começando pelo terreno (D37)

7. [x] `terreno_desembolso` aceita **N anexos**. A coluna `arquivo_path`
       **morre** na mesma migration, precedida de **backfill** das linhas
       existentes.
8. [x] O formulário de desembolso aceita **mais de um arquivo** no mesmo ato de
       registro. **O caminho de captura continua curto**: anexar um só arquivo
       não ganha passo nenhum a mais.
9. [x] Depois de gravado, o desembolso **lista todos os anexos**, cada um com
       **Abrir** (o componente da rodada 1).

**9b.** [x] **Anexar papel DEPOIS, num desembolso já gravado.** O papel que
chega dias depois — o recibo que o vendedor mandou no WhatsApp, a escritura —
tem lugar. **Sem tela nova**: é a **mesma ação que hoje completa a data**
(`completarDesembolsoTerreno`), agora disponível também para desembolso que
**já tem data e já tem papel**.

- Cada papel novo entra **por INSERT na tabela filha — nunca substituição, nunca
  remoção**. O acervo é append-only, e um papel anexado não é corrigido por cima
  de outro.
- O anexo novo pede o **`papel`** dele (critério 14), obrigatório e sem default,
  como qualquer outro.
- Se o anexo novo for o **segundo `Comprovante do pagamento`**, ele **dispara a
  pergunta do critério 12** ali mesmo — *"no mesmo ato de registro ou dias
  depois, indiferente"* (parecer de 2026-08-21, §6).

Está no mock aprovado (tela `2d`). O ticket já mandava isso sem ter percebido:
*"anexo vira INSERT na filha"*, em Arquivos prováveis.

10. [x] **Nenhum campo de valor por anexo.** O valor do lançamento é digitado
        **uma vez**, no lançamento. (Gate Fiscal §1 — a soma dos anexos é
        exigência inventada e está **derrubada**.)
11. [x] **Nenhum campo de data por anexo.** (Gate Fiscal §2 — data por anexo é
        campo que só existe se ele digitar, que ninguém confere, e que o app
        trataria como fato: seria **fabricar a evidência que o app não tem**.)
12. [x] ⚠️ **A pergunta binária — dispara por PAPEL, nunca por contagem de
    arquivos.** ⚠️ **A redação anterior deste critério (*"ao anexar o
    segundo arquivo"*) está ERRADA e foi substituída** — ela voltou a contar
    arquivos, e o §2 do Gate Fiscal exige que a pergunta seja **sobre o
    lançamento**. Vale a tabela de disparo do **§6 do parecer de
    2026-08-21**:

    | | Regra |
    |---|---|
    | ✅ **Dispara** | quando o lançamento passa a ter **dois papéis marcados `Comprovante do pagamento`** — no mesmo ato de registro ou dias depois, indiferente |
    | ✅ **Uma vez por ato** | três comprovantes de uma vez perguntam **uma vez só**. Não é por arquivo |
    | ✅ **Dispara de novo** | se a resposta vigente era *"tudo no dia X"* e chega **comprovante novo**: o fato mudou, e o app **não carrega adiante um "sim" que não sustenta mais** |
    | ❌ **Nunca** | para `Nota ou recibo` nem `Contrato ou escritura` |
    | ❌ **Não** | se a pendência **já está aberta** — ele já respondeu |
    | ❌ **Represada** | enquanto o desembolso **não tiver data**; dispara **junto com o preenchimento da data** |

    A pergunta é **obrigatória, sem default e sem pré-seleção**, as duas
    opções com o **mesmo peso visual**. Texto **copiado do §4a do parecer**,
    literalmente — `[data]` é substituição do app:

    ```
    Quando esse dinheiro saiu da sua conta?
    ```
    ```
    Tudo em [data do lançamento, dd/mm/aaaa]
    ```
    ```
    Em mais de um dia
    ```

    Consequência (âmbar), **abaixo** das opções:

    ```
    Cada dia em que o dinheiro saiu é um pagamento com a sua própria data — e é a
    data que decide em que ano o custo entra. Se foi em mais de um dia, o registro
    é gravado do mesmo jeito e fica uma pendência.
    ```

    Nota de apoio:

    ```
    Não é retrabalho: dois débitos em dias diferentes são dois fatos, e o app não
    tem como saber quanto foi em cada dia — nem deve fingir que tem.
    ```

    ⚠️ **A consequência não lidera pela punição, e isso é decisão, não
    estilo** (§4a): *"frase que começa pelo castigo ensina a responder o que
    escapa dele — e, com o bloqueio fora, a qualidade dessa resposta é a
    única defesa que sobrou."*

    - **"Tudo em [data]"** → grava, **e grava a resposta** (critério 12b).
    - **"Em mais de um dia"** → **grava assim mesmo** e abre a pendência
      **"Um lançamento, mais de uma data"** (critério 12a).

    **Recusar a gravação está proibido** (adendo 2: *"nunca recuse o registro
    de um fato consumado"*).

**12a.** [x] ⚠️ **A pendência — e a ação nomeada tem DUAS metades.** Texto **copiado
do §4b do parecer**, literalmente. Chip/título, em **vermelho**:

```
Um lançamento, mais de uma data
```

Corpo:

```
Você respondeu que o dinheiro saiu em mais de um dia, e este lançamento tem
R$ [valor] numa data só. É a data do pagamento que decide o ano do custo.
```

**A segunda metade da ação nomeada** (vermelho, logo abaixo) — **ela
existe, e não é opcional**:

```
Ainda não dá para arrumar aqui: o app não corrige o valor de um desembolso do
terreno já gravado. Não registre os lançamentos separados antes disso —
enquanto este continuar com os R$ [valor], os novos somam por cima e o custo do
terreno fica maior do que foi.
```

E a saída, quando ela existir:

```
Quando a correção de valor existir: corrija este para o que saiu na primeira
data e registre um lançamento para cada uma das outras.
```

**Por que a segunda metade é obrigatória** (§4b): cumprir só a primeira —
registrar os lançamentos separados sem corrigir o original — **soma o
valor duas vezes**. Custo inflado em Bens e Direitos é **redução indevida
de ganho de capital, cobrada com multa**. *"Pendência que nomeia meia
ação induz o erro pior que a original."*

❌ **Sem "ok, entendi"**: não se dispensa, não se adia, não se esconde.
**A pendência não tem baixa hoje** e o app **não oferece nenhuma** (§5 do
parecer) — *"pendência fiscal baixada por declaração de intenção é o
campo preenchido que afirma o que ninguém conferiu, com um botão na
frente"*.

**12b.** [x] ⚠️ **A resposta se grava — sempre, inclusive o "sim" — com a data em que
foi dada.** **É requisito fiscal, não de UI** (§4d do parecer). O
`"tudo no dia [data]"` **não pode ser apenas a ausência de pendência**.
Razão, por extenso: o corte do critério 13 se apoia em *"erro nomeado é
melhor que erro invisível"*; se o "sim" não deixa rastro, **ele É o erro
invisível**, e em 2034 ninguém distingue *"ele afirmou que foi tudo no
mesmo dia"* de *"ninguém perguntou"* — a primeira é declaração do
contribuinte, a segunda é lacuna do sistema. Quando a pergunta dispara de
novo (§6), **a resposta nova é gravada sem apagar a anterior** — o acervo
é append-only.

> ⚠️ **Achado do Gate 4 (2026-08-23) — a última frase deste critério NÃO está no
> §4d, e NÃO está implementada.** Conferido palavra por palavra contra
> `docs/pareceres/2026-08-21-gate-fiscal-contai-027-criterio-13.md`, §4d: o
> parecer exige *"a resposta se grava com a data em que foi dada, nos dois
> casos"* — **e só isso**, que está entregue (migrations `0010`+`0011`,
> `e2e/terreno-anexo.spec.ts:449`). A frase *"a resposta nova é gravada sem
> apagar a anterior"* foi acrescentada pelo `po` ao redigir o critério e
> **atribuída ao §4d sem estar lá**. Na implementação, `debitos_mesmo_dia` é
> coluna única: re-responder **sobrescreve** a resposta anterior. O `cto-obra`
> recusou a tabela de rastro com argumento próprio (`0010`, linhas 116-120:
> *"a resposta superada não foi corrigida — o CONJUNTO DE FATOS é que mudou, e
> o `created_at` dos anexos reconstrói a linha do tempo"*), e o argumento é
> técnico, não fiscal.
>
> **Isto é a D46 na forma inversa** — condição fiscal em ticket **sem parecer
> que a carimbe**, aqui carimbando um requisito que o parecer não fez. **Não
> apaguei a frase**: quem decide se a afirmação superada precisa sobreviver no
> acervo é o `contador`, não o `po` e não o `cto-obra`. **Pergunta aberta nº 3**,
> abaixo. Enquanto ela não for respondida, o `[x]` deste critério vale **pelo
> §4d**, não pela frase extra.

**12c.** [x] ⚠️ **Onde a pendência aparece — três superfícies, e ela é
INDISPENSÁVEL.** Com o critério 13 fora, a visibilidade é o que resta
(§3.4 e §4b): **home**, **card do desembolso** e **lista de revisão
pré-declaração**. Em nenhuma delas ela é dispensável, adiável ou
colapsável.

- **Home** e **card do desembolso** existem hoje — é onde o critério fecha nesta
  rodada.
- A **lista de revisão pré-declaração** e a saída da discriminação são da
  **US-004**; a exigência **viaja com elas** e está anotada em Dependências.
  Enquanto a US-004 não existir, este critério fecha nas duas superfícies que
  existem — **e nenhuma tela promete a terceira**.

**12d.** [—] ⚠️ **O aviso que acompanha a discriminação do ano fica FORA da área
copiável** — banner acima de tudo e uma linha por lançamento afetado,
entre o banner e o bloco. Texto **copiado do §4c do parecer**.
**Nenhum texto de pendência, alerta ou instrução nossa entra em área
copiável, neste ou em qualquer relatório** — o bloco é colado literalmente
na ficha Bens e Direitos, e aviso lá dentro vira **texto declarado à RFB**
(IN SRF 84/2001, art. 17). **Regra geral, não exceção deste ticket.**
Vale a partir da **US-004** (ver 12c).

13. [—] ~~A pendência do critério 12 bloqueia a geração da discriminação daquele
        ano.~~ ⛔ **CORTADO desta rodada em 2026-08-21** — a pendência **não tem
        fato de baixa no app** (o app não corrige valor de desembolso já gravado),
        e o bloqueio **só morde quem respondeu a verdade**. Fundamento inteiro em
        `docs/pareceres/2026-08-21-gate-fiscal-contai-027-criterio-13.md`, §3.
        ➡️ **MIGRA, na forma exata em que estava escrito, para o ticket de
        correção de valor de desembolso do terreno** — lá a pendência terá baixa e
        a trava passa a ser legítima. **A compensação é temporal, não conceitual.**
        ⚠️ **Não reimplemente este critério aqui.** No lugar dele ficam os
        critérios **12a–12d**.
14. [x] **Campo `papel` por anexo** — **obrigatório, sem default, conjunto
        fechado de TRÊS valores**, fixados no §7 do parecer de 2026-08-21:

        | Valor | Rótulo em tela | O que sustenta |
        |---|---|---|
        | `comprovante` | **Comprovante do pagamento** | condição 1 — que o dinheiro saiu, quando, e da conta dele. **É o único que dispara a pergunta do critério 12** |
        | `nota` | **Nota ou recibo** | condição 3 — o que foi adquirido, por quanto, em nome de quem |
        | `contrato` | **Contrato ou escritura** | o título e o preço contratado: escritura, contrato de financiamento, matrícula, guia de ITBI |

        Ele não alimenta apuração nenhuma — existe para o dossiê responder, em
        2034, **qual papel sustenta o quê**. **Por que três e não dois**: no
        terreno o papel de título é peça própria e frequente. **Por que não
        quatro**: taxonomia grande faz o segundo papel não ser anexado, e o ticket
        que existe para completar o acervo passaria a esvaziá-lo (pre-mortem nº 1).
        ⚠️ **Valor novo neste conjunto exige parecer do `contador`** — mesma
        contrapartida da **D32** para o enum de pendência.
        ⚠️ **Armadilha desarmada pelo §7**: o §3 do Gate Fiscal manda oferecer
        *"registre isto como `documento`"* quando o usuário marca um anexo como
        nota/recibo — **isso vale para `pagamento` e NÃO para
        `terreno_desembolso`**. O desembolso do terreno tem natureza própria:
        alimenta **só** a apuração de custo, **nunca** a base de aferição,
        **nunca** o headline de risco, **nunca** Pagamentos Efetuados, e **não tem
        pendência de "pago sem nota"**. Construir a oferta na tela do terreno
        criaria **pendência falsa onde o acervo está completo**.
15. [x] **Pago sem anexo continua VISÍVEL.** A pendência de complemento
        (critério 23 do `CONTAI-010`) passa a derivar de *"não existe anexo"* na
        tabela filha, **não** de `arquivo_path is null`. Teste próprio, montando
        o cenário pelo client autenticado.
16. [x] ⚠️ **O modelo não pode fechar a porta de N→1** (Gate Fiscal §5): a fatura
        de cartão é **um comprovante para N pagamentos**, e isso já está
        registrado como pendência. **Nenhum `unique` em `arquivo_path`**: o mesmo
        objeto do acervo pode sustentar mais de um lançamento.
17. [x] `e2e/privilegios.spec.ts` atualizado **no mesmo diff** da migration
        (`terreno_desembolso_anexo: "INSERT,SELECT"` — append-only, sem UPDATE e
        sem DELETE, como `documento_anexo`).

## Out of Scope

- **Desdobrar automaticamente** um lançamento em N quando a resposta do critério
  12 for "não". A pendência **nomeia a ação**; quem executa é o Mateus,
  registrando os lançamentos certos. Desdobrar sozinho mexe em valor e data de
  registro já gravado — território do `CONTAI-024`/`CONTAI-025`, e, se o ano já
  foi declarado, **exige CRC e retificadora** (Gate Fiscal §6). **Registrado como
  D38** no `docs/backlog.md`, sem ticket.
- **Corrigir o VALOR de um desembolso do terreno já gravado** — não existe hoje
  (`completarDesembolsoTerreno` completa a **data** e diz por extenso que **o
  valor não é tocado**), e **continua não existindo neste ticket**. É o motivo
  pelo qual a pendência do critério 12a **não tem baixa** e o critério 13 caiu.
  ➡️ **Ticket novo, a criar** (§5 do parecer de 2026-08-21): rastro append-only da
  alteração, e — se o lançamento for de **ano-calendário já declarado** — tela que
  **pergunta o ano** e diz que a correção é **retificadora e exige CRC**.
  *"Corrigir número de ano declarado dentro do app, calado, é o app fabricando
  divergência entre o que ele mostra e o que foi entregue à RFB."*
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
arquivos: é o **critério 12**. **O dente que eu havia posto no critério 13
(bloquear a discriminação do ano) não vai nesta rodada** — ele não tem caminho de
baixa e só morde quem responde a verdade; ver o parecer de 2026-08-21. Fica no
lugar: pendência indispensável em três superfícies, aviso fora da área copiável,
e a resposta gravada nos dois casos.

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
discriminação é o §2.

⚠️ **Correção de 2026-08-21**: a frase original terminava em *"e é por isso que a
pendência bloqueia o relatório"*. **O bloqueio saiu** (critério 13). O que a
pendência faz na discriminação passa a ser **avisar, fora da área copiável** —
critério **12d**, texto no §4c do parecer de 2026-08-21.

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

- **Sistema sozinho** — ⚠️ **lista substituída em 2026-08-21 (§9 do parecer)**;
  a redação anterior dizia *"fazer a pergunta binária ao segundo anexo"* e
  *"bloquear a discriminação do ano"*, e as duas caíram: disparar a pergunta
  **pela regra do §6** (dois papéis `Comprovante do pagamento`); gravar sempre,
  com pendência ou sem ela; **gravar a resposta e a data dela**; manter a
  pendência **indispensável nas três superfícies**; imprimir o aviso **fora** do
  bloco copiável; **não** desdobrar lançamento nenhum; **não** oferecer baixa.
  Somam-se as que não mudaram: gravar N anexos sem exigir soma e sem pedir valor
  por anexo; manter o recibo fora dos anexos do pagamento; montar o índice do
  dossiê.
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
   lançamento com duas datas passou silencioso. ⚠️ **Este risco ficou SEM
   MITIGAÇÃO MECÂNICA em 2026-08-21**, e o parecer diz isso com todas as letras
   (§3.4): *"o pre-mortem nº 2 do `po` fica sem mitigação mecânica e passa a
   depender de texto na tela. Isso é mais fraco, e eu não vou fingir que não é."*
   O que resta: pergunta **sem default e sem pré-seleção**, consequência que
   **não lidera pela punição**, pendência **indispensável em três superfícies**,
   **aviso fora da área copiável**, e a **regravação da pergunta quando o fato
   muda** (§6). **A mitigação mecânica volta com o critério 13**, no ticket de
   correção de valor. Quem for medir este ticket no Gate 4 mede o que está aqui —
   não o bloqueio.
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
- **Transfere para**: o ticket de **correção de valor de desembolso do terreno**
  (a criar, ainda sem ID) — recebe o **critério 13 inteiro** e, com ele, a
  **meta 2** deste ticket.
- **Aguarda a US-004** (relatórios anuais): a **lista de revisão pré-declaração**
  (critério 12c) e o **aviso fora da área copiável** (critério 12d) só têm
  superfície quando ela existir. Enquanto não existir, este ticket fecha nas duas
  superfícies que existem — e **nenhuma tela promete a terceira**.
- **Bloqueado por**: nada na fila. ⚠️ **Mas a rodada 2 exige que a migration
  `0009` (do `CONTAI-021`) esteja no remoto** — as duas sobem juntas.
- **Restringe**: `CONTAI-011` (dossiê) — o §4 do Gate Fiscal é requisito de lá.
- **Absorve**: **D35** (rodada 1) e o item 1 da **D36** (critério 5).

## Perguntas Abertas — nenhuma para o Mateus

⚠️ **A pergunta nº 1 (os valores do campo `papel`) foi RESPONDIDA** no §7 do
parecer de 2026-08-21 e virou o **critério 14**: `comprovante` / `nota` /
`contrato`. Removida daqui para não voltar como pergunta já fechada.

1. **Ao `cto-obra`, no Gate 1**: a pendência do critério 12 entra como **valor
   novo no enum `tipo_pendencia`** da `0009` (o que exige a contrapartida em
   `docs/pareceres/`, pela **D32**), ou é estado derivado de uma coluna no
   próprio desembolso? A `0009` ainda não está no remoto — a janela para alterar
   o enum sem migration extra é agora.
2. **Ao `cto-obra`, no Gate 1**: `terreno_desembolso_anexo` entra na limpeza do
   `e2e/fixtures.ts` por qual caminho, já que a exceção do `docker exec … psql`
   é nomeada e fechada?

⚠️ **As duas acima foram respondidas no Gate 1** (o estado é derivado, sem valor
novo no enum `tipo_pendencia`; a limpeza segue pelo caminho já existente).

3. ⚠️ **Ao `contador`, aberta no Gate 4 de 23/08 e VIVA**: a **afirmação
   superada** precisa sobreviver no acervo? Ver a **D48** e o texto completo em
   *"Saídas deste Gate 4"*, no fim deste arquivo. **É a única pergunta aberta
   deste ticket hoje**, e ela não é para o Mateus.

## Teste do Canteiro — **não se aplica, e a régua certa é outra**

Pela régua de 18/08: registrar desembolso do terreno e revisar anexo é **gestão —
em casa, sentado, com calma**. **375px é piso, não alvo**: nenhuma tela pode
quebrar no celular, mas *"não cabe com uma mão"* **não é veto** aqui.

O que continua valendo, e é critério: **o caminho de captura não pode alongar**.
Anexar **um** arquivo no canteiro tem que ter exatamente os passos de hoje.
⚠️ **Correção de 2026-08-21**: a frase anterior dizia *"a pergunta do critério 12
só aparece a partir do segundo anexo"* — a régua não é o **anexo**, é o **papel**.
A pergunta só aparece quando o lançamento passa a ter **dois papéis marcados
`Comprovante do pagamento`**, e **nunca** aparece para quem anexou comprovante +
recibo, nem para quem anexou um só. *"Comprovante + recibo são dois papéis e um
débito; pergunta óbvia treina o clique automático que esvazia a pergunta que
importa"* (§6 do parecer). E, sem data no desembolso, a pergunta fica
**represada** — nem no canteiro nem em casa ela aparece antes da data existir.

**Veredito: APROVADO**, com Gate 0 (mock) **aprovado em 2026-08-21**.

⚠️ **Este ticket entrega as metas 1 e 3. A meta 2 SAIU dele** em 2026-08-21,
junto com o critério 13 (§3.4 e §8.5 do parecer).

- **Meta 1** — nenhum pagamento sem documento hábil: o segundo papel deixa de não
  ter lugar, e o papel que chega depois também (critério 9b).
- **Meta 3** — acervo que sobrevive à decadência: a rodada 1 é **meta 3 pura** —
  acervo que ninguém abre não cumpre prazo nenhum. A **gravação da resposta**
  (critério 12b) é meta 3 também: sem ela, *"o sim É o erro invisível"*, e em 2034
  ninguém distingue a afirmação do contribuinte da lacuna do sistema.
- **Meta 2 — FORA desta rodada.** O que sobra dela aqui é **informação, não
  trava**: pendência em três superfícies, aviso fora da área copiável, resposta
  gravada. A trava **volta no ticket de correção de valor de desembolso do
  terreno**, com o critério 13 inteiro — *"a compensação é temporal, não
  conceitual: o bloqueio volta, e volta valendo, porque lá a pendência terá
  baixa"*.

---

## Gate 4 — validação do `po` — 2026-08-23 — **PASS COM RESSALVA**

⚠️ **Régua**: registrar desembolso do terreno, conciliar papel e revisar anexo é
**gestão — em casa, sentado, com calma** (`CLAUDE.md`, correção de 18/08). 375px
é **piso**, não alvo; *"não cabe com uma mão"* **não é veto** aqui. O que se
mediu como captura foi só o caminho de anexar **um** papel.

⚠️ **Este gate não confiou em relato de gate anterior.** O Gate 1 deste ticket
foi commitado **e pushado** sem revisor e ficou dois dias assim; validar por
resumo seria repetir a falha com outro nome.

### O que foi reverificado aqui, e não herdado

| Prova | Resultado |
|---|---|
| `npm run test` (Vitest) | **488/488** — rodado neste gate |
| `npm run test:e2e` (Playwright/webkit, Postgres local) | **132/132** — rodado neste gate |
| Leitura direta de código, migration, parecer e mock | critério a critério, na tabela abaixo |

⚠️ **Ruído de ambiente, registrado para não virar caça a fantasma**: a primeira
tentativa da suíte reprovou **38 testes** com *"Test timeout … while setting up
`db`"*, inclusive `entrar.spec.ts` inteiro. **Não é código**: é o Kong com o
upstream velho depois do `db reset` do `globalSetup`, exatamente como o
`CLAUDE.md` descreve. `docker stop/start supabase_kong_contai
supabase_rest_contai` e a suíte foi a 132/132. Nenhum arquivo foi tocado entre
as duas rodadas.

### Critério a critério

| # | Critério | Veredito | Onde se prova |
|---|---|---|---|
| 1 | Mock aprovado antes do desenvolvimento | **PASS** | `design/mocks/CONTAI-027.html`, aprovado em 21/08 |
| 2 | Componente único de anexo, com **Abrir**, em todas as telas | **PASS** | `app/_components/anexo.tsx`; importado nas **7** superfícies (3 de correção, detalhe do documento, detalhe do pagamento, painel do terreno, informe anual) + a lista de desembolsos. A 8ª (confirmar compromisso) fica fora **por decisão do mock**: lá o papel está sendo escolhido, não lido |
| 3 | Link assinado e temporário; nenhuma URL pública | **PASS** | `lib/data.ts:criarLinkDeLeitura`, `createSignedUrl(path, 120)`. **Nenhuma chamada a `getPublicUrl` no repositório** — as duas ocorrências do nome são comentários que proíbem o uso, uma delas com asserção de E2E atrás (`e2e/acervo.spec.ts:83`: se alguém trocar, o caminho vira `/object/public/` e o teste acusa). O link é gerado no CLIQUE, não ao montar a lista |
| 4 | `acervo_dono_select` é a única autorização | **PASS** | nenhum `if` de dono antes da chamada; `e2e/acervo.spec.ts:292` prova a recusa da policy e a ausência de "Tentar de novo" no caso `negado` |
| 5 | Falha de link com estado de erro e "Tentar de novo" | **PASS** | `e2e/acervo.spec.ts:346` (503 do PostgREST, a falsificação de rede já autorizada). Estado é do **item**, não da tela — numa lista de três, um falha sem derrubar os outros |
| 6 | *"Confira antes de digitar"* ganha o **Abrir** ao lado | **PASS** | `app/documento/[id]/corrigir/valor/page.tsx:314-318`; `e2e/acervo.spec.ts:393` |
| 7 | N anexos; `arquivo_path` morre **com backfill antes** | **PASS** | `0010_terreno_anexo.sql:189` (backfill) → `:198` (drop). Ordem conferida no arquivo, não na descrição |
| 8 | Formulário aceita >1 arquivo; captura não alonga | **PASS**, com a definição registrada | `app/_components/anexos-novos.tsx` — **um** `input type="file" multiple`. ⚠️ *"Passo"* aqui é **tela, confirmação ou navegação** — definição do mock aprovado (*"uma tela e um Gravar"*), não "campo": o `papel` obrigatório é campo novo **por força do critério 14**, e o Mateus aprovou os dois no mesmo desenho. Quem ler só o critério 8 vai achar que há conflito; não há, e é por isto que está escrito |
| 9 | Desembolso gravado lista **todos** os anexos, cada um com Abrir | **PASS** | `papeisDoDesembolso` (definição **única**, para nenhuma tela contar anexos por conta própria) |
| 9b | Anexar papel **depois**, sem tela nova, por INSERT | **PASS** | `completarDesembolsoTerreno`; `e2e/terreno-anexo.spec.ts:335-448`. **A ordem das duas escritas é regra**: anexos primeiro, resposta depois — invertida, a re-pergunta do §6 dispararia sozinha para sempre |
| 10 | Nenhum campo de **valor** por anexo | **PASS** | `AnexoEscolhido` tem `arquivo` e `papel`. Nada mais |
| 11 | Nenhum campo de **data** por anexo | **PASS** | idem |
| 12 | Pergunta dispara por **papel**, tabela do §6 inteira | **PASS** | `lib/fiscal/terreno.ts:perguntaPendente / perguntaRepresada / perguntaNoRegistro / perguntaNoComplemento`; textos **conferidos palavra por palavra** contra o §4a do parecer, inclusive a consequência que **não lidera pela punição** |
| 12a | Pendência com as **DUAS metades** da ação nomeada | **PASS** | `datas-do-desembolso.tsx:118-122` — corpo, segunda metade em vermelho e a saída futura. **Sem "ok, entendi"** em lugar nenhum |
| 12b | Resposta gravada **sempre**, com a data em que foi dada | **PASS pelo §4d** — ver ressalva 2 | `0010` (colunas + constraint `resposta_datada` + trigger do servidor) e `0011` (re-carimbo da re-resposta de mesmo valor); `e2e/terreno-anexo.spec.ts:449`. ⚠️ A frase *"sem apagar a anterior"* **não é do §4d** e **não está implementada** — ver a anotação no próprio critério e a **pergunta aberta nº 3** |
| 12c | Pendência na **home** e no **card** | **PASS nas duas superfícies que existem** | `app/page.tsx:496-509` (home, **antes** da pendência de data, porque é vermelha) e `lib/fiscal/resumo.ts:596`; card em `terreno/page.tsx:353` e `terreno/desembolsos/page.tsx:587`. **Nenhuma tela promete a terceira** — conferido |
| 12d | Aviso **fora** da área copiável | **PENDENTE — transferido** | Não há saída de discriminação no app: **nenhuma** área copiável existe (`grep` por `Copiar`/`clipboard` em `app/`: zero). Fecha com a **US-004**. ⚠️ **Ver ressalva 3**: hoje esta obrigação não está escrita em nenhum lugar que a US-004 vá ler |
| 13 | ~~Bloqueio da discriminação~~ | **CORTADO em 21/08** | Não reimplementado — conferido. Nada no código bloqueia geração nenhuma |
| 14 | `papel` obrigatório, sem default, três valores | **PASS** | `check (papel in ('comprovante','nota','contrato'))` na `0010:70`; nasce `null` na tela; `e2e/terreno-anexo.spec.ts:136` (não grava sem papel) e `:736` (valor fora dos três **recusado pelo banco**) |
| 15 | "Pago sem papel" continua visível, derivado da **filha** | **PASS** | `pagoSemPapel(d) = estado === "pago" && anexos.length === 0`; **não sobrou nenhum `arquivoPath === null`** em `app/` ou `lib/` (grep). `e2e:574`, `:594`, `:627` |
| 16 | Nenhum `unique` em `arquivo_path` (a porta de N→1 fica aberta) | **PASS** | ausência conferida na `0010` (comentário `(b)`, linha 48) e provada em `e2e/terreno-anexo.spec.ts:682` |
| 17 | `privilegios.spec.ts` no **mesmo diff** da migration | **PASS** | `e2e/privilegios.spec.ts:129` — `terreno_desembolso_anexo: "INSERT,SELECT"`, sem UPDATE e sem DELETE |

**Placar: 22 itens de aceite (1-17, com 9b e 12a-12d) — 20 PASS · 1 PENDENTE
(12d, por dependência declarada) · 1 CORTADO (13).**

### Ressalvas vivas — o ticket fecha COM elas, e nenhuma vira ✅

1. **A pergunta pendente não tem superfície fora do formulário** (o "defeito 2"
   do Gate 2). `perguntaPendente` e `perguntaRepresada` só são lidas por
   `perguntaNoComplemento` e pelos testes: um "sim" superado **não acende em
   card nem na home**. O `lead-engineer` **parou em vez de inventar tela**, e
   fez certo — o mock não desenha este chip. → **ticket novo**, condições em
   *"Saídas deste Gate 4"*, no fim deste arquivo.

   ⚠️ **Como isto convive com 20 de 20 marcados, e a resposta é incômoda:
   NENHUM critério deste ticket pede essa superfície.** Conferido um a um. O
   critério 12 manda a pergunta **disparar por papel**, e ela dispara em **todo
   ato** — registro (`perguntaNoRegistro`) e complemento
   (`perguntaNoComplemento`), inclusive a represada, que abre junto com a data.
   O critério 12c manda a **pendência** (`debitosMesmoDia === false`) à home e
   ao card, e ela está nos dois. **A pergunta pendente é um terceiro estado, e o
   ticket é silencioso sobre ele.** Não é critério descumprido: é **lacuna de
   especificação**, e a minha, não do `lead-engineer`.

   ⚠️ **O que agrava, e é achado deste gate**: `completarDesembolsoTerreno` faz
   **duas escritas sem transação** (INSERT dos anexos, depois UPDATE do pai), e
   a decisão de não virar função de banco está justificada em comentário assim:
   *"a falha entre as duas escritas cai em estados que a pendência do critério
   15 e a re-pergunta do §6 já nomeiam **em tela**"* (`lib/data.ts`). **A
   segunda metade dessa frase é falsa.** A re-pergunta do §6 só é "nomeada em
   tela" **dentro do formulário de anexar**; se o INSERT passa e o UPDATE cai, o
   lançamento fica com dois comprovantes, com data e **sem resposta**, e nem a
   home nem o card dizem uma palavra. Ou seja: **a única janela de falha que
   cria o estado órfão é a que o app abriu por conta própria**, e ela foi aceita
   com base numa superfície que não existe. É esse o argumento do ticket novo —
   não *"faltou um chip"*.
2. **O critério 12b carrega uma frase que nenhum parecer carimbou** (*"sem
   apagar a anterior"*). Não apaguei, não implementei, não fingi entregue.
   → **pergunta aberta nº 3**, ao `contador`.
3. **12c (terceira superfície) e 12d viajam para a US-004 — e a US-004 não é
   arquivo nenhum.** Ela é uma linha em *"Stories ainda sem ticket"*. Requisito
   que só existe no ticket que fecha é requisito que some: foi **exatamente**
   isso com o corte do critério 13, que passou um dia sem existir em arquivo, e
   com a **D46**. Registrado no índice do backlog neste gate.

### O que este gate NÃO reprovou, e por quê

- **Divergências declaradas do mock não são desvio**: o item de anexo não mostra
  tamanho nem data de anexação (o app tem um `text` no banco, não o arquivo na
  mão), e a mensagem de erro ocupa a largura inteira do item (na coluna do meio
  do mock ela vira tiras de duas palavras a 375px). As duas trazem o motivo
  escrito ao lado do código.
- **A recusa da alternativa simples no retrabalho da `0011`** — carimbar em todo
  update com resposta não-nula — está certa e é a decisão mais importante do
  ticket: ela faria qualquer UPDATE futuro **re-datar uma afirmação que ninguém
  fez**, que é o app fabricando declaração do contribuinte. Pior, fiscalmente,
  que o defeito consertado, e igualmente invisível.

### Log dos gates

| Gate | Estado | Data |
|---|---|---|
| **0 — mock** | aprovado pelo Mateus, `design/mocks/CONTAI-027.html` | 21/08 |
| **1 — implementar** | duas rodadas, `1ff74c9`…`53acc37`, **commitado E PUSHADO sem revisor** | 21/08 |
| **2 — review (pós-fato)** | `REQUEST CHANGES` do `cto-obra` + `APROVADO COM RESSALVAS` do `contador`; **os dois acharam o mesmo defeito, independentemente** | 23/08 |
| **2b — retrabalho** | migration `0011`, `lib/data.ts`, `e2e/terreno-anexo.spec.ts`; APPROVE dos dois sobre o diff final. ⛔ **SEM HASH — nada foi commitado** | 23/08 |
| **3 — quality** | 488 unitários + 132 E2E. ⛔ **SEM HASH — nada foi commitado** | 23/08 |
| **4 — validação do `po`** | **PASS COM RESSALVA** (esta seção). ⛔ **SEM HASH — nada foi commitado** | 23/08 |

⛔ **Os três `SEM HASH` são a condição de saída deste gate, não um detalhe de
formatação.** Enquanto eles existirem, este ticket **não pode receber ✅** em
`docs/tickets/README.md` — a coluna de lá é `G1:… G2:… G3:… G4:…`, e o
`CONTAI-019` já ficou com ⚠️ permanente por ter **um** hash reconstruído da
mensagem de commit. O estado correto é **🔨 fechado, aguardando commit**: quem
commitar o retrabalho substitui os três `SEM HASH` pelos hashes reais, **na
mesma passada**, e só então o ✅ tem lastro.

⚠️ **E o commit não é `git push`.** Ver *"O que este caso ensina"*, adiante: no
Gate 1 deste ticket o push aconteceu **antes de qualquer revisor**, e é isso que
está em revisão de processo.

### Arquivos alterados após o último APPROVE — **não é `nenhum`**

| Arquivo | Quando | Linha do revisor |
|---|---|---|
| `supabase/migrations/0011_resposta_recarimbada.sql` (novo), `lib/data.ts`, `e2e/terreno-anexo.spec.ts` | retrabalho do Gate 2 | **APPROVE do `cto-obra` e do `contador` sobre o diff final** — pedidos e obtidos |
| `design/mocks/CONTAI-027.html`, `design/mocks/CONTAI-027.md` | pelo orquestrador, **depois** dos APPROVEs | **pré-autorização do `contador`**, que especificou a forma antes de o texto existir. **Julgado neste Gate 4: vale como linha de revisor** — ver adiante |
| `docs/tickets/CONTAI-027.md` (marcação dos critérios + esta seção) | pelo `po`, neste gate | é o **produto** do Gate 4, não um alterado a revisar |

⚠️ **Ordem de release, e ela não é opcional**: `npx supabase db push` das
migrations **`0009`, `0010` e `0011`** **antes** de qualquer `git push`. O código
que depende da `0010` está no ar desde 21/08 e a migration **nunca foi
registrada como aplicada** (`docs/tickets/README.md`, bloqueio de release). Uma
linha do Mateus fecha isto.

### Pré-autorização conta como a linha do revisor? **Neste caso, sim** — e a fronteira fica escrita

O orquestrador editou os dois arquivos de mock **depois** dos APPROVEs, com a
forma especificada **antes** pelo `contador`, e pediu que este gate julgasse por
ser parte interessada. **Julgo que vale**, por três condições que aqui batem
todas — e a regra é a conjunção, não qualquer uma delas:

1. **O revisor especificou o conteúdo, não só a intenção.** A anotação é
   *citação* do §2 de `2026-08-21-gate-fiscal-contai-027-criterio-13.md`, com o
   caminho do arquivo dentro do próprio texto.
2. **Terceiro nenhum precisa acreditar em quem escreveu**: qualquer um abre o
   parecer e confere. Pré-autorização de texto **conferível** é diferente de
   pré-autorização de texto **inventado**.
3. **A edição não pode mudar comportamento**: mexeu num card de *justificativa*
   do mock, não numa tela; nenhum código lê `design/mocks/`.

**Onde a pré-autorização deixa de valer, e não é negociável:**

- **Tela do mock** (não card de justificativa): isso é **Gate 0**. Volta ao
  **Mateus**, não ao revisor — e nem o `contador` pode pré-autorizar por ele.
- **Texto cuja fonte seja o próprio autor**, e não um parecer em arquivo: aí a
  pré-autorização vira o autor carimbando a si mesmo.
- **Qualquer arquivo que o código leia.**

⚠️ **O que faltou não foi revisão: foi registro.** A regra do campo *"arquivos
alterados após o último APPROVE"* existe para transformar *"confie em mim"* em
*"confira"*. Ela se cumpre nomeando **quem pré-autorizou, o que foi especificado
e quem escreveu** — o que a tabela acima agora faz. Voltar ao revisor para ele
reler uma citação que ele mesmo ditou seria cerimônia; deixar o campo em branco
foi a falha real, e ela está fechada aqui.

## O que este caso ensina sobre o pipeline — recomendações do `po`

⚠️ **Nada disto é decisão minha para instalar.** Ajuste em
`.claude/commands/develop.md`, `CLAUDE.md` ou hook é do **Mateus** — mesmo
tratamento dado ao remédio da **D46**.

**A regra que entrou em 22/08 é necessária e insuficiente.** *"Gate 1 não é fim
de nada: o estado vai para o corpo do ticket antes de qualquer push"* trata do
**registro** do estado. Se ela estivesse valendo em 21/08, teríamos hoje um
**bug bem documentado em produção**: a frase manda **escrever**, não manda
**segurar**. As quatro que faltam:

**P1 — `git push` é ato de RELEASE, e não pertence ao Gate 1.** Na Vercel, push
é deploy. Manter o push no gate de implementação entrega a chave da produção a
quem escreveu o código — exatamente o que *"quem implementa nunca revisa o
próprio código"* existe para negar. **Gate 1 commita; quem pusha é o Gate 3**,
depois do APPROVE do Gate 2 e do `quality` verde. É uma linha, e é a única
que teria impedido as duas consequências de 21/08 de uma vez.

**P2 — a ordem `db push` → `git push` precisa de ponto de APLICAÇÃO, não de mais
uma frase.** Ela já está no `CLAUDE.md` desde 17/08, em maiúsculas, com o
incidente narrado por extenso — e foi violada com a `0010` **quatro dias
depois**, sem que nada acendesse por **dois dias**. Frase que já falhou uma vez
não se conserta repetindo: o remédio é um `pre-push` que reprova quando há
migration em `supabase/migrations/` mais nova que a última registrada como
aplicada.

**P3 — invariante de fila, verificável por script**: nenhum ticket pode estar
`EM VOO` com **código pushado e sem log de Gate 2 no corpo**. Isso teria
acendido em 22/08, e não na 7ª revisão da fila.

**P4 — a lição de teste, e é a mais barata das quatro.** O Gate 3 ficou verde
**por cima do defeito**: o teste existente exercia a transição que **muda de
valor** (`true`→`false`), e o caso real comum é a **idempotente** (`true`→`true`,
re-afirmar *"Tudo em [data]"*). Onde houver carimbo de rastro por transição de
estado — todo `is distinct from` de trigger —, o conjunto de testes tem de
incluir a **re-afirmação do mesmo valor**. Sem isso, o teste prova o caso raro e
deixa passar o comum.

⚠️ **E o que salvou o projeto desta vez não foi processo, foi o banco de produção
estar vazio.** Vale registrar por quê: a data da afirmação do contribuinte
**nunca foi gravada** nos casos afetados, então não existiria fonte para
backfill. **O defeito era irreparável retroativamente** — e ficou 2 dias em
produção. É esse o tamanho do P1.

## Saídas deste Gate 4 — o que nasce daqui

### 1. Ticket novo — **a superfície da pergunta pendente** (D47)

**Sim, é ticket novo, e passa no filtro de escopo** — não por conforto, mas pela
**meta 3**: o critério 12b existe para que, em 2034, *"ele afirmou"* se distinga
de *"ninguém perguntou"*. Uma pergunta que o app **sabe que deve fazer** e não
faz em superfície nenhuma produz exatamente a segunda coisa. Não é conveniência.

**Escopo, e é estreito de propósito:**

- `perguntaPendente === true` acende **no card do desembolso e na home**, como a
  pendência do 12c já acende — mesmas duas superfícies, **nem uma a mais**.
- **Não** é chip de pendência fiscal aberta: o fato aqui é *"falta a sua
  resposta"*, não *"você respondeu que saiu em mais de um dia"*. Os dois não
  podem ter a mesma cara, sob pena de o vermelho perder valor.
- `perguntaRepresada` **fica de fora**: sem data, a pendência *"Falta a data"*
  já cobre, **com precedência** (§6), e as duas nunca aparecem juntas.
- **Corolário técnico, e é do `cto-obra`**: se `completarDesembolsoTerreno`
  virar ato atômico (função de banco, como o RPC de registro já é), a janela que
  cria o estado órfão **fecha na origem**. A decisão entre *"dar superfície ao
  estado"* e *"impedir o estado"* — ou as duas — é dele; o requisito é que **o
  estado não fique mudo**.

⛔ **Condição de nascimento, imposta pelo `contador` e acatada por mim sem
ressalva**: este ticket **nasce com parecer dele para o texto do chip, ANTES do
mock**. *"Chip fiscal escrito no `/design` é a falha de 21/08 outra vez."* Ele
tem razão e o histórico é dele: foi assim que o corte do critério 13 passou um
dia sem existir em arquivo, e é a forma exata da **D46**. **Ordem obrigatória:
parecer → ticket → `/design` → `/develop`.** Nenhum mock antes do parecer.

### 2. Pergunta aberta nº 3 — ao `contador`, uma linha

> **A afirmação superada precisa sobreviver no acervo?** Hoje `debitos_mesmo_dia`
> é coluna única: re-responder **sobrescreve**. O §4d exige a resposta **datada**
> — entregue. O que não tem carimbo de parecer é a frase *"sem apagar a
> anterior"*, que o `po` escreveu no critério 12b atribuindo-a ao §4d. **Se
> sobreviver**: é tabela de rastro, e é ticket. **Se não**: a frase sai do
> critério, e sai por decisão fiscal registrada — não por conveniência técnica.

⚠️ O `cto-obra` já deu o argumento **técnico** contra a tabela (`0010`, linhas
116-120), e ele é bom. Mas **argumento técnico não revoga requisito fiscal** —
esta é a mesma assimetria da **D45**, com os papéis trocados.

### 3. Transferências que precisam existir FORA deste ticket

| O que | Para onde | Estado |
|---|---|---|
| Critério **13** inteiro (bloqueio da discriminação) | ticket de **correção de valor de desembolso do terreno** | ⛔ **o ticket não existe como arquivo** — §5.1 do parecer manda o `po` abri-lo |
| Critério **12c**, terceira superfície (revisão pré-declaração) | **US-004** | ⛔ **a US-004 não é arquivo nenhum**: é uma linha em *"Stories ainda sem ticket"* |
| Critério **12d** (aviso fora da área copiável — **regra geral, não exceção**) | **US-004** | ⛔ idem |
| Restrições do §4/§4d (dossiê) | **`CONTAI-011`** | ✅ **já está lá**, seção *"Restrições vindas do `CONTAI-027`"* — a única das quatro que aterrissou |

⚠️ **Três de quatro transferências vivem só no ticket que está fechando.** É a
forma exata do defeito que este projeto já nomeou duas vezes (o corte do
critério 13; a **D46**). Anotado no índice do backlog neste gate — mas anotação
em índice não é ticket, e o §5.1 do parecer pede um.
