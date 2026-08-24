# CONTAI-025 — Registrar o desembolso do terreno sem data, sem comprovante, ou sem os dois

## Roteamento do `/develop`
- **Tipo**: feature — **P0**. Nasceu P1 em 19/08 com **um eixo** (a data); o
  relato 005 trouxe o outro (o comprovante) e o desfecho: **o Mateus parou de
  usar o app**, e continua parado. Dor **ativa**, no presente do indicativo
- **UI**: **SIM** — proposta **nível 1**, **4 telas**. ⛔ **PENDENTE: rodar
  `/design` e obter aprovação do Mateus antes do `/develop`**
- **Gate Fiscal**: **SIM, e FECHADO** —
  `docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`
  (⚠️ o **ADENDO 1 vence o corpo** onde divergir). Estava aberto desde 19/08
- **Migration**: **NENHUMA** — o banco sempre aceitou. A trava são ~30 linhas
  de validação em `desembolsos/page.tsx`
- **Entrega em 2 fatias**, com o critério 13 travando a segunda

## Tipo e Prioridade
feature — **P0** — dor **ativa** que expulsou o único usuário do produto.

## Dor de Origem

Relato 005 (`docs/backlog/24-2026-08-23-relato-005.md`), e é o pior desfecho que
este backlog registrou:

> *"eu estava colocando o valor de entrada do terreno, eu queria colocar todos os
> registros mas **fui bloqueado pelos comprovantes e daí parei de usar**. Os
> comprovantes não estão de fácil acesso no momento porque é conta da minha
> esposa, parte da minha conta."*

E na rodada 2, em presente do indicativo: *"neste momento **está me
bloqueando** de usar o app."*

⚠️ **O critério 2 anterior deste ticket está REVOGADO.** Ele dizia *"Comprovante
obrigatório neste estado. É o que o separa de um chute"* — e **bloquearia o caso
exato do relato**. Entregar assim reinstalaria a trava com rótulo novo: o Mateus
sairia de *"não posso registrar sem comprovante"* para *"não posso registrar sem
data **e** sem comprovante"*.

⚠️ **A trava nunca teve parecer** (dívida **D49**). O texto que parecia
justificá-la — *"Sem o extrato anexado, este lançamento não grava"* — é de
**outra entidade**, o informe anual do financiamento. No desembolso, a única
justificativa escrita era um comentário de código. O §1.3 do parecer **substitui**
esse comentário e o trecho da migration `0008`.

## User Story

> **Como** dono da obra, **em casa e sentado**, transcrevendo desembolsos antigos
> do terreno, **quando** tenho o valor mas falta a data, falta o comprovante, ou
> faltam os dois, **quero** gravar assim mesmo e ser cobrado depois pelo que
> falta, **para** o custo existir no app antes de eu ter os papéis na mão — e
> não voltar para a planilha.

## Critérios de Aceite

### Fatia 1 — destrava

1. [ ] **Proposta nível 1 (4 telas) em `design/mocks/CONTAI-025.md` aprovada
       pelo Mateus** — ⛔ sem isto, o `/develop` não começa
2. [ ] Desembolso `pago` **grava** nas **quatro combinações**: com/sem data ×
       com/sem comprovante. E2E cobrindo as quatro, conferindo o estado gravado
       (`data_pagamento` nulo, zero linhas em `terreno_desembolso_anexo`), no
       padrão de `e2e/ingestao.spec.ts:439`
3. [ ] A trava `anexos.length === 0` (`desembolsos/page.tsx:244`) sai, **e o
       comentário que a carimbava também**
4. [ ] Data e comprovante continuam **perguntados e sem default** (§1.4.2;
       critério 22 do `CONTAI-010` intocado): nenhum caminho preenche data — nem
       `created_at`, nem hoje. A ausência **não bloqueia**
5. [ ] **`papel` continua obrigatório para o anexo que EXISTIR** (critério 14 do
       `CONTAI-027`): zero anexo grava; anexo sem papel respondido, não
6. [ ] **`previsto` nunca é oferecido como SAÍDA** (§1.4.1): nenhum texto, ajuda
       ou erro sugere marcar *"ainda não paguei"* a quem já disse que pagou —
       isso tiraria o custo de **todo** ano-calendário, e é **pior** que a trava.
       `previsto` continua ofertado no formulário: é estado legítimo (ITBI a
       recolher)
7. [ ] **D50, nesta mesma entrega.** `custoTerrenoAteOAno` e `custoTerrenoDoAno`
       (`lib/fiscal/terreno.ts:258,275`) hoje somam por `estado === "pago"` +
       `dataPagamento`, **sem olhar anexo**. Passam a exigir comprovante. Testes
       unitários afirmando **cada "não"**, no padrão de `terrenoSemData`
8. [ ] **O portão é o papel `comprovante`, não anexo qualquer** —
       `comprovantesDe(d).length > 0`. **Fonte: §2.1** do parecer
       (*"soma apenas desembolso pago, com data e com comprovante"*).
       ⚠️ **`pagoSemPapel` NÃO pode ser reaproveitado**: ele é
       `anexos.length === 0`, subconjunto estrito — trocá-lo por dentro
       reintroduz a **D49 invertida**. Predicado **novo**, ao lado dele
9. [ ] **Card do ano mostra DOIS números** — confirmado (principal) e, logo
       abaixo, nomeado e vermelho, o registrado sem comprovante. **Não é
       cortável**: sem ele a D50 faz o total encolher em silêncio, e o §2.4 diz
       que *"excluído em silêncio é tão ruim quanto incluído em silêncio"*
10. [ ] **Duas pendências independentes e SIMULTÂNEAS** no mesmo lançamento,
        ordem **data → comprovante** (§4 do gate abaixo), com **uma** consequência
        e nunca dois blocos empilhados. Teste do caso duplo
11. [ ] **Superfície (US-C, fatia terreno)**: campo próprio no `ResumoObra`, no
        padrão de `terrenoSemData`/`terrenoMaisDeUmaData`
        (`lib/fiscal/resumo.ts:249`) — **fora** de `custoConfirmadoAnoCentavos`,
        de `pendencias` e de `emPendenciaCentavos` (critério 21 do `CONTAI-010`),
        com teste afirmando cada "não" — mais **card próprio na home**, em
        **VERMELHO** (D39: *vermelho = fato consumado com consequência fiscal
        aberta*; o dinheiro saiu), com **valor total + contagem** e link para a
        lista. Hoje `pagoSemPapel` só existe **dentro da linha**
        (`terreno/page.tsx:382`): é a **D47** com outro nome
12. [ ] **Textos COPIADOS do parecer, não redigidos**: chip **§4.1**, texto da
        pendência **§4.2**, linha auxiliar **§4.3** — esta exibida **junto da
        pendência** *e* **no momento de escolher o papel** (ver defeito derivado
        no gate). Constantes em `lib/fiscal/terreno.ts`, com teste de string
13. [ ] **A mensagem de sucesso não pode mentir.** Hoje
        `desembolsos/page.tsx:397` afirma *"Data informada — o valor passa a
        compor o custo de {ano}"*, escolhida só por `faltaData`, ignorando o
        comprovante. Dois textos, no gate abaixo
14. [ ] **Baixa sem tela nova**: `completarDesembolsoTerreno` (critério 9b do
        `CONTAI-027`, mock `s2d`) já anexa depois — é o caminho de baixa dos dois
        eixos, com mais um uso
15. [ ] **Critério 3 do `CONTAI-010` reescrito, não contornado**: *"valor sem
        data não entra em ano nenhum; valor sem comprovante não entra no custo
        confirmado; nenhum dos dois recusa a gravação"*
16. [ ] ⛔ **GUARDA DA FATIA 2**: enquanto o critério 17 não entrar, **nenhuma
        saída anual é gerada** existindo desembolso pago-sem-comprovante — falha
        **nomeada**, nunca número mudo. É o antídoto do padrão que já produziu a
        D47 nesta base

### Fatia 2 — saídas anuais

17. [ ] Linha nomeada do **§4.5** logo abaixo do total no relatório anual
        (critério 20 do `CONTAI-010`) e destaque na revisão pré-declaração.
        **O app NÃO suprime** da discriminação de Bens e Direitos um custo pago e
        real (§2.1): mostra os dois números, e a escolha é do Mateus com o
        profissional com CRC

## Out of Scope

- **US-D / `origem_conta` e a titularidade repartida** — fora, e **cresceu de
  campo para ticket** com as respostas do Mateus. ⚠️ Contamina o **critério 17**,
  não os de gravação — ver o gate fiscal
- **Rateio entre N pessoas / 2ª obra com o sogro** — cortado **pelo próprio
  Mateus** (*"não vem o caso agora"*), com condição de volta. Generalizar de um
  caso é como nasceu a D49
- **US-B (nota sem arquivo, superfície 3)** — **ticket próprio**: exige migration
  (D52) e **três guardas**, e a direção do erro é **invertida** (aqui subestima,
  lá superestimaria)
- **Superfícies 5 e 6** (informe anual, correção por reemissão) — **recusa
  mantida**: ali o anexo é **fonte**, não prova (§1.2, §A.4). Critério 10 do
  `CONTAI-010` fica de pé
- **Importar OFX** para recuperar data e comprovante — P2. Resolve a dor e é
  tentador; as travas removidas já destravam o uso
- **Conciliação de quem-pagou-o-quê entre o casal** — controle financeiro
  doméstico, não serve a nenhuma das três metas
- **Push/notificação** — P2. A palavra do relato era *"aviso"*; virou superfície

## Gate Fiscal (Contador)

**Parecer normativo**: `docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`
(**ADENDO 1 vence o corpo**). Adjudicado em 2026-08-23. `[Certain]` salvo marca.

### 1. O portão do custo confirmado é o papel `comprovante`

**Fonte: §2.1.** ⚠️ **Correção de citação**: a minuta citava o §4.3, que é *texto
de tela sobre o que serve como comprovante por tipo* e **não define o portão** —
atribuir a ele a regra é a **D46 na forma inversa**. O §4.3 **corrobora pelo
fato** (*"a escritura prova o preço, não o pagamento"*), e o caso do Mateus é
literalmente esse: ele tem a escritura, não tem os comprovantes.

⚠️ **Defeito derivado, novo — `ROTULO_DO_PAPEL.nota = "Nota ou recibo"`** captura
o **recibo do vendedor**, que pelo §4.3 é comprovante de entrada. Papel mal
escolhido = desembolso legítimo fora do custo confirmado, **em silêncio**.
Remédio: a linha do §4.3 aparece **no momento de escolher o papel**, não só na
pendência. O `contador` não redefine rótulo sem mock.

### 2. Titularidade repartida — o ticket SAI assim mesmo, com uma condição

O valor cheio do desembolso é número **verdadeiro** (foi o que saiu pelo bem);
errado seria rotulá-lo *"seu custo"* ou *"sua discriminação"*. Com dois nomes na
matrícula e cada um declarando sua parcela, a saída imprime o total do bem **e
uma linha nomeada** — mesma disciplina do critério 20 do `CONTAI-010`.

**O app não calcula rateio nenhum**: *"percentual do financiamento"* é como eles
fazem, não é regra carimbável; em comunhão universal a divisão entre as duas DAAs
**exige CRC** (§3.4). **Segurar o ticket pelo rateio repete o trade que produziu
a D49** — com o banco vazio e ele na planilha.

> **Este total é o que saiu pelo bem inteiro.** A matrícula está em dois nomes e
> cada um declara a sua parcela — a divisão deste número entre as duas
> declarações é decisão do seu contador, não deste app.

### 3. Um chip só: **"Pago sem comprovante"** (§4.1)

Doutrina do ADENDO 3 §G.3: *o chip nomeia o fato fiscal, que é o mesmo*. O mock
de 21/08 **não é contrariado** — ele foi aprovado quando *"tem papel, mas nenhum
comprovante"* **não existia na interface**, porque a trava garantia o
comprovante. **Aprovação não se estende a estado que não existia.**

Os dois casos **não são o mesmo estado**: o fato fiscal é um (o custo não é
demonstrável), o buraco de acervo é diferente, e a diferença vive na
**consequência**, não no chip. `PAGO_SEM_PAPEL` continua sendo o texto do caso
**zero-anexo** (carimbado no critério 15 do `CONTAI-027`); o **§4.2** é o texto
do caso **com papel**.

⚠️ **Troca visível**: exige mock atualizado e aprovação do Mateus antes de
implementar.

### 4. Estado combinado — texto e ordem

Dois chips, ordem **data → comprovante** (a data decide se entra em algum ano; o
comprovante, se o ano em que entrou é demonstrável). **Uma** consequência, nunca
dois blocos empilhados:

> **Pago — falta a data e falta o comprovante.**
> As duas faltas são independentes e nenhuma delas apaga o registro. Sem a data,
> este valor não tem ano-calendário e não entra em ano nenhum. Sem o comprovante,
> ele não entra no custo confirmado nem no ano em que a data o puser.
> Comece pela data: ela está no extrato, no mesmo lugar em que o comprovante
> está — as duas costumam voltar da mesma busca.

**Rótulos do botão** (a simetria vale, e o rótulo **nomeia a consequência** —
nunca *"gravar mesmo assim"*):

> **Gravar — e abrir a pendência do comprovante**

> **Gravar — e abrir as duas pendências**

### 5. A mensagem de sucesso — dois textos, por caso

> Data informada — o valor passa a compor o custo de {ano}.

*(só quando `comprovantesDe(d).length > 0`)*

> Data informada — o valor é de {ano}. Falta o comprovante: até ele chegar, este
> desembolso não entra no custo confirmado.

### O que o ticket NÃO pode atribuir ao parecer

- que o app **suprima** o valor da discriminação da DAA (§2.1 — metade **não
  automática**; a escolha é do Mateus com CRC)
- **qualquer percentual de rateio** (§3.4 ⛔)
- prazo de reemissão de guia ou de custas (§4.3 é `[Likely]`, *"confirme antes de
  prometer"*)

### ⚠️ Alerta levantado pelo `contador` por conta própria — equiparação a PJ

O relato 005 registra uma **segunda obra, com o sogro, explicitamente para
venda**. Duas construções, uma declaradamente para revenda, é o padrão de fato do
**art. 166+ do RIR/2018** `[Likely]` — e se ele se confirmar, **nenhuma conclusão
deste parecer sobrevive**, porque o regime deixa de ser ganho de capital de
pessoa física.

**Não bloqueia o `CONTAI-025`** e não é veredito. É **pergunta para o CRC antes
de a obra do sogro entrar no app**, registrada aqui para não ser descoberta na
venda.

## Pre-mortem

1. **Entregar a fatia 1 sem o critério 7 ou sem o 9.** Sem o 7, o app soma custo
   não demonstrável **em silêncio** (direção da D34: ganho de capital inflado).
   Sem o 9, ele **subtrai** em silêncio. Os dois são invisíveis em teste de tela e
   só aparecem em 2028.
2. **O chip aprovado ser reusado sem decidir a extensão do conjunto.** Mock diz
   *"Pago, e sem papel nenhum"* (zero anexos); parecer diz *"Pago sem
   comprovante"* (sem papel `comprovante`). Um desembolso com só o contrato
   anexado cairia **fora da pendência e fora da soma ao mesmo tempo** — buraco
   que nenhuma tela nomeia.
3. **A fatia 2 nunca chegar.** É o padrão desta base — pendência sem superfície
   (D47), remédio da D46 redigido e não instalado. O **critério 16** é o
   antídoto: sem ele, a fatia 1 entrega um número novo e uma declaração que não o
   menciona.

## Viabilidade (CTO)

- **Modelo de dados: NENHUMA migration.** `[Certain]` O banco aceita tudo desde a
  `0008`/`0010`: a única constraint de estado é `previsto_sem_data` (**pago sem
  data é legal** — o comentário da `0008` já previa *"linhas `pago` sem data"*,
  critério 22); `terreno_desembolso_anexo` é filha **sem mínimo**, zero linhas
  passa; `terreno_desembolso_gravar` tem `p_anexos` e `p_data_pagamento`
  **anuláveis**, com guard. **Nada de `GRANT` novo, `privilegios.spec.ts`
  intacto.** A trava é **exclusivamente de aplicação**
- **Nenhuma pendência nova nasce**: `pagoSemPapel()` (`terreno.ts:671`) já é a
  pendência do comprovante, e a de data existe desde o `CONTAI-010`. O que nasce
  é a **exclusão da soma** e a **superfície agregada**
- **A D50 se conserta no cálculo puro** — nunca na query (filtrar ali esconderia
  o número que o §2.4 manda **mostrar em linha nomeada**) e nunca em campo
  derivado no banco. As funções passam a devolver **dois números**
- **Arquivos**: `desembolsos/page.tsx`, `lib/fiscal/terreno.ts`,
  `lib/fiscal/resumo.ts`, `terreno/page.tsx`, mais `terreno.test.ts`,
  `resumo.test.ts`, `e2e/terreno.spec.ts` e `e2e/terreno-anexo.spec.ts` — ⚠️ os
  specs atuais **afirmam a trava** e viram o contrário. `lib/data.ts`:
  provavelmente zero mudança
- **Complexidade: M**
- **Uma entrega, e o `cto-obra` discorda de quem quiser duas**: separar data de
  comprovante duplicaria mexida **no mesmo bloco de validação**, e o eixo da data
  custa ~10 linhas porque pendência, constraint e tela de completar já existem.
  *"O risco de duas entregas é exatamente o do relato: mais um ciclo com o Mateus
  fora do app"*
- **Dívidas criadas**: a baixa da pendência de comprovante herda o desenho do
  `CONTAI-027`, mas o volume cresce (toda gravação pode nascer pendente).
  **D49 e D50 fecham** neste ticket

## Proposta de Design — nível 1, 4 telas

O `designer` manteve o nível 1 mesmo sabendo que nenhuma pendência nasce nova:
*"o argumento do nível 2 soma deltas que individualmente são 'campo a mais' e
conclui que o conjunto também é. Não é"* — o card do ano deixa de ser **um**
número e o **estado combinado** não tem precedente em tela nenhuma; são decisões
de hierarquia e ordem de leitura, que o Mateus não julga lendo.

| # | Tela | O que muda |
|---|---|---|
| 1 | Home / painel da obra | card do ano com dois números + card agregado da pendência |
| 2 | Formulário do desembolso | o estado novo, e o rótulo do Gravar |
| 3 | Lista de desembolsos | só o item em **estado combinado**: um chip ou dois, e em que ordem |
| 4 | Revisão anual | a linha §4.5 em vermelho abaixo do total |

**Ficam de fora, por não terem mudado**: *"Informar a data"* /
`completarDesembolsoTerreno` (já desenhada e aprovada no `CONTAI-027`), o fluxo de
captura de pagamento, e todo o resto do painel do terreno.

⚠️ **Divergência resolvida pelo orquestrador, e registrada como tal**: a tela 4
serve à **fatia 2**, que o `po` pôs atrás do critério 16. Ela entra no mesmo mock
para **não exigir uma segunda rodada de `/design`** — desenhar não é entregar, e
o critério 16 continua travando a geração. Se o `designer` ou o `po` discordarem,
é uma linha de correção.

## Dependências

- **Bloqueado por**: `/design` + **aprovação do Mateus** (critério 1)
- **Bloqueia**: nada. A US-B (`CONTAI-033`) é independente

## Perguntas Abertas

- Nenhuma que segure a fatia 1
- **Para o CRC, antes de a obra do sogro entrar no app**: equiparação a PJ
  (art. 166+ do RIR/2018)
- **Gate fiscal novo, quando a US-D for especificada**: a divisão do número entre
  as duas DAAs

## Cenário e checagem final

**Gestão** — casa, sentado, transcrevendo lote de desembolsos antigos; é
literalmente o relato. 375px é piso, não alvo. **O Teste do Canteiro não se
aplica**, e o caminho de captura fica **mais curto**, não mais longo: some uma
obrigação.

Serve à **meta 1** de forma direta e invertida: a regra existia para garantir
documento hábil e produziu **nenhum registro** — o app não tem pagamento sem
documento porque não tem pagamento nenhum.

**Veredito: APROVADO, P0**, condicionado ao mock.
