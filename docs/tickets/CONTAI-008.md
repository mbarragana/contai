# CONTAI-008 — Mover registro entre obras não pode quebrar o vínculo pagamento↔documento

> ⚠️ **REABERTO E REESCOPADO em 2026-08-19, pelo `po`, no Gate 1 do
> `CONTAI-021`.** Duas coisas mudaram desde a redação original (10/08):
> **(1)** a condição que o segurava — *"o defeito é inatingível pela interface,
> nada no app cria linha em `pagamento_documento` fora de teste"* — **caducou em
> 18/08**, quando o `CONTAI-018` (vínculo pagamento↔nota) foi para produção no
> `b807901`. O defeito **é alcançável hoje**;
> **(2)** o **lado do DOCUMENTO** (`moverDocumentoDeObra`) foi absorvido pelo
> **critério 13 do `CONTAI-021`**, que já está em Gate 1. **O que sobra aqui é o
> lado espelhado: `moverPagamentoDeObra`** — e ele é o mesmo `UPDATE` seco, com o
> mesmo dano na direção inversa.

## Tipo e Prioridade

bug **em produção** / integridade fiscal — **P0**.

**Não é mais "P0 condicionado à US-003"**: a US-003 chegou como `CONTAI-018` e
está no ar desde 18/08. As duas pré-condições do dano existem: o app **cria**
vínculo pagamento↔documento pela interface, e o Mateus tem **duas obras**.

**Posição na fila: imediatamente depois do `CONTAI-021`** — não por ser menos
grave, mas porque **depende inteiro** da máquina que o 021 constrói (tabela
`revisao`, `ato_id`, função Postgres transacional, pendência por ano com conjunto
de obras). Feito depois, é uma fração; feito agora, duplica desenho e trava o
021 num mock que o Mateus não aprovou.

⚠️ **A janela de exposição está nomeada, não escondida**: enquanto este ticket
não entrar, `/pagamento/[id]/obra` continua gravando o estado inválido em
silêncio, e o `CONTAI-021` **não muda isso** (ele conserta a porta da frente e
declara, no `Out of Scope`, que a dos fundos é este ticket). Meia correção
registrada é dívida; meia correção não registrada é armadilha.

## Dor de Origem

**Não veio de relato do Mateus.** Veio do review técnico do `cto-obra` no
Gate 2 do CONTAI-003 (ressalva R1, 2026-08-10) — e voltou, do outro lado, no
review de código do `/develop` do CONTAI-021 (19/08).

`moverDocumentoDeObra` e `moverPagamentoDeObra` (`lib/data.ts`) atualizam **só a
própria linha**. O vínculo `pagamento_documento` não é consultado nem
revalidado, `pagamento.obra_id` não acompanha, e nada grava rastro.

**Dor D19 [P0 fiscal]** — a correção de obra de um registro conciliado desfaz a
apuração da obra de origem **em silêncio**: nenhuma das duas obras acusa, e o
erro só aparece quando o total do ano não fecha, um ano depois.

### O lado que sobra: mover o PAGAMENTO (o espelho do critério 13 do 021)

Pagamento P vinculado ao documento D, ambos na obra A. O Mateus corrige a obra
de **P** para B. Hoje, `UPDATE pagamento SET obra_id = B`, e mais nada:

1. **na origem (A)** — o documento fica sozinho: `min(Σ pagamentos, Σ documentos)`
   cai para **zero** naquele componente, e o **custo comprovado do ano cai**;
2. **no destino (B)** — entra pagamento **sem documento naquela obra**:
   `min(valor, 0) = 0`, o custo **não sobe**, e **"pago sem nota" SOBE em B** —
   alarme vermelho da **meta 1** por um fato que não aconteceu, porque o
   pagamento **tem** nota, ela é que ficou em A;
3. **no banco** — sobra vínculo vivo **cruzando duas obras**, o estado que o
   critério 11 do `CONTAI-018` proíbe pela porta da frente, ignorado **em
   silêncio** por `alocarCusto` (`lib/fiscal/vinculo.ts`), sob um comentário que
   afirma que *"o critério 11 impede que esse caso nasça pela interface"*.

É o mesmo desfecho do D10 (gasto na obra errada) chegando pela ferramenta que
foi construída para **consertar** o D10 — e o dano mais caro dos três é o alarme
falso da meta 1: *"pago sem nota"* é o número pelo qual o Mateus decide se pode
pagar alguém.

## User Story

Como dono da obra, **em casa, sentado, revisando o que registrei**, quando eu
corrigir a obra de um pagamento que já está ligado a uma nota, quero decidir
**o que acontece com essa nota** antes de gravar — e ver o que muda no custo dos
dois lados — para que não sobre vínculo cruzando duas obras nem alarme de "pago
sem nota" por um fato que não aconteceu.

## Critérios de Aceite

1. [x] **Gate 0 (mock) — nível 1, 8 telas, `design/mocks/CONTAI-008.md` (+
   `.html`).** Espelho da tela 8 do mock v2 do `CONTAI-021` (lá é
   **documento → N pagamentos**; aqui é **pagamento → N documentos**), mais
   o estado de recusa por CNO incompatível (critério 16). Cenário: gestão
   em casa, sentado — 375px é piso, não alvo. Mock aprovado em 2026-08-24.
2. [ ] **Mover pagamento com vínculo em `pagamento_documento` é UM ato
   transacional que não conclui com documento indeciso.** Para **cada**
   documento vinculado, o Mateus escolhe **um a um, em ato explícito** (§4.4 do
   parecer de 18/08 — **cascata silenciosa é proibida**):
   - **(i) "esta nota também é da obra de destino"** → vai junto
     (`documento.obra_id` muda), com rastro. **É o único desfecho que transfere
     custo entre obras** (adendo §5.2, desfecho (i));
   - **(ii) "esta nota é mesmo da obra de origem"** → **o vínculo se desfaz**,
     com rastro, e o pagamento entra em "pago sem nota" **no destino** — que aí
     é a verdade: a nota de outro imóvel nunca comprovou aquele pagamento
     (adendo §5.2, desfecho (ii)).

   **Não existe terceira saída**, e **é proibido o caminho que grava e não
   avisa** (critério 1 da versão original deste ticket).
3. [ ] **A revalidação de CNO roda no desfecho (i), por documento.**
   `podeCorrigirObra` (`lib/fiscal/obra.ts`) recusa mover **NF de serviço**
   para obra cujo CNO ela não referencia — a tela do pagamento hoje a chama
   com `tipo: null`; passa a chamar com `documento.cno_referenciado`
   (`CONTAI-007`) e o CNO da obra de destino. Levar a nota junto **pela
   porta do pagamento** não pode contrabandear o que a porta do documento
   barra. Respondida pela pergunta 1 do Gate Fiscal (24/08) — ver critério
   11 para o estado de tela que essa resposta abre.
4. [ ] **Gravação atômica**: pagamento + N documentos + N rastros numa **única
   função Postgres**, com **`ato_id` compartilhado** — granular no banco, **uma**
   linha no histórico e **uma** na pendência. Reusa a função e a tabela `revisao`
   do `CONTAI-021` (critérios 7-9); **não** cria mecanismo paralelo.
5. [ ] **Motivo é `arquivamento_corrigido`, gravado sozinho — esta tela não
   pergunta motivo** (adendo §5: o papel não tem obra).
6. [ ] **Delta antes→depois por ano-calendário das duas obras, antes de gravar**,
   pelo **mesmo detector** do critério 4 do `CONTAI-021` — construído uma vez.
7. [ ] **Pendência**: mesma regra do critério 20 do `CONTAI-021`, sem emenda —
   chave por **ano**, conjunto de **obras afetadas** vindo do **rastro**
   (`antes ∪ depois` do campo `obra`), **filtrado** para as obras cujo custo
   daquele ano efetivamente mudou. **Sem documento vinculado**: rastro e aviso,
   **sem pendência** — pagamento sozinho não comprova custo em obra nenhuma
   (`min(valor, 0) = 0` dos dois lados), então o delta é zero nas duas. É o
   espelho exato da tela `s8b` do mock do 021 — confirmado pela pergunta 4
   do Gate Fiscal (24/08), sem emenda.
8. [ ] **O par nunca fica atravessado sem registro**: não existe estado em que P
   (obra B, vinculado) aponte para D (obra A) e as duas obras se declarem em
   ordem.
9. [ ] **O resumo (`lib/fiscal/resumo.ts`) nunca perde valor sem contrapartida**:
   se um custo sai da obra A, ou ele aparece em B, ou vira pendência em A.
   Não existe evaporação.
10. [ ] **E2E contra o Postgres local** afirma **estado gravado**, não tela:
    montar P vinculado a D na obra A, mover P para B com desfecho misto, e provar
    que (i) não sobrou vínculo cruzando obras, (ii) o rastro tem as N linhas com o
    mesmo `ato_id`, (iii) a soma dos custos de A e B mais as pendências fecha com
    o total de antes, (iv) o rastro não aceita update nem delete.
11. [ ] **Regressão do caso benigno**: mover pagamento **sem** vínculo continua
    funcionando exatamente como hoje, **sem atrito novo** — é 99% dos casos.
12. [ ] **`alocarCusto` REPORTA o vínculo órfão — não basta "deixar de ignorar
    em silêncio"**. ⚠️ **Redigido pelo `po` no Gate 4 do `CONTAI-021`
    (21/08), e o verbo mudou de propósito.** O comentário de
    `lib/fiscal/vinculo.ts:394-411` já ficou honesto no Gate 1 do `021` — ele
    diz, por extenso, que o lado do pagamento continua aberto. Só que
    **comentário honesto não é rede**: enquanto `moverPagamentoDeObra` existir,
    o estado inválido nasce e o `continue` de `alocarCusto` o engole. Fechar
    este ticket é fechar a porta; **reportar** é a rede que sobra para o dia em
    que uma porta nova aparecer. Nenhum vínculo cruzando obras pode ser
    descartado sem que alguém fique sabendo.

### Herdados do Gate 4 do `CONTAI-021` — 2026-08-21

*O `021` construiu a máquina (`revisao`, `ato_id`, função transacional,
pendência por ano). Estes três são defeitos **da máquina**, achados no review e
na validação, que **não seguraram** aquele gate porque são inalcançáveis pela
tela ou puramente cosméticos hoje. Este ticket escreve a função **espelhada** —
ela não pode nascer com eles.*

13. [ ] **A guarda do array de decisões conta, não só verifica existência.**
    Em `supabase/migrations/0009_correcao_documento.sql:762-771`, a guarda de
    *"o ato não conclui com pagamento indeciso"* pergunta se **existe** desfecho
    para cada pagamento vinculado — nunca **quantos**. Duas consequências, as
    duas inalcançáveis pela tela e alcançáveis por **RPC direto**:
    - `vai_junto` **duplicado** para o mesmo pagamento → o laço de `:780` roda
      duas vezes e grava **duas linhas de rastro do mesmo fato** (duplicado, mas
      verdadeiro);
    - `vai_junto` **+** `fica_na_origem` para o mesmo pagamento → o rastro narra
      um ato **contraditório**: mudou de obra *e* teve o vínculo desfeito.

    **Conserto de uma linha**: comparar `jsonb_array_length(p_pagamentos)` com o
    `count(distinct (e ->> 'pagamento_id'))` do mesmo array e recusar quando
    divergirem. Vale para a função **espelhada** deste ticket e, no mesmo diff,
    para a do `021`.
14. [ ] **O rastro do vínculo é legível por gente.** `legivel()`
    (`app/_components/corrigir.tsx:318-332`) não tem ramo para
    `campo = "vinculo"`, cujo `antes` é `documento_id::text`
    (`0009_correcao_documento.sql:823`). Hoje **some**, porque no move do
    documento a linha principal do ato é sempre `documento:obra`; **aparece** no
    instante em que este ticket fizer do vínculo a linha principal — e aí o
    histórico exibe **UUID cru**. Junto: `quandoLegivel()` fatia a string ISO e
    mostra a hora em **UTC** (17:19 de Florianópolis vira "20:19") numa tela cujo
    propósito declarado é ser lida em **2034**.
15. [ ] **`app/_components/corrigir-obra.tsx` não sobrevive a este ticket.** A
    tela do documento deixou de reusá-lo de propósito no `021`
    (`app/documento/[id]/obra/page.tsx:75-95`): um lado pergunta o desfecho de
    cada pagamento, o outro não pergunta nada. Quando este ticket reescrever o
    lado do pagamento, o componente fica **sem nenhum dono** — e componente
    compartilhado que sobrou de uma bifurcação é o próximo a receber "só mais um
    parâmetro".

16. [ ] **NOVO — estado de tela achado na resposta da pergunta 1 do Gate
    Fiscal (24/08).** Quando a revalidação de CNO do critério 3 recusa o
    desfecho (i) para um documento (CNO nulo na obra de destino, ou CNO
    referenciado diferente do CNO da obra de destino), a opção "esta nota
    também é da obra de destino" fica **indisponível** só na linha daquele
    documento — com o texto de consequência do critério 2 do `CONTAI-007` —
    e o desfecho (ii) ("esta nota é mesmo da obra de origem") permanece como
    **único** caminho, ainda exigindo clique explícito (não é
    auto-selecionado). Documentos sem essa restrição no mesmo ato continuam
    com os dois desfechos disponíveis normalmente — a recusa é por
    documento, nunca pelo ato inteiro.

⚠️ **Nota de concorrência, que NÃO vira critério**: o trigger
`pendencia_uma_aberta` (`0009_correcao_documento.sql:354-383`) lê antes de o
outro ter commitado, então dois atos simultâneos podem abrir duas pendências do
mesmo ano. **É single-user** — está escrito na própria migration, e é por isso
que não segurou o Gate 2 do `021`. Fica registrado para o dia em que deixar de
ser.

## Gate Fiscal (Contador)

**Fechado em 2026-08-24.** Parcialmente respondido pelo adendo de 2026-08-19
ao parecer `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md`
(§5.1 a §5.5), que é **normativo** e foi escrito para o lado do documento —
a simetria foi ratificada, não reinventada. As duas perguntas que
permaneciam abertas foram respondidas em 24/08, aproveitando o `CONTAI-007`
(CNO referenciado na NF de serviço, ticket escrito no mesmo dia) para tornar
a pergunta 1 decidível.

| # | Pergunta original (10/08) | Situação |
|---|---|---|
| 1 | Mover a **NF de serviço** de obra levando junto os pagamentos conciliados é admissível, sabendo que o CNO impresso continua sendo o da obra de origem? | **RESPONDIDA — 24/08.** Condicional, por documento, não por pagamento. No desfecho (i), a tela **REVALIDA** cada NF de serviço vinculada chamando `podeCorrigirObra` (reuso literal, `lib/fiscal/obra.ts:267-306`) com `cnoReferenciado = documento.cno_referenciado` (CONTAI-007) e `cnoDestino` = CNO da obra de destino: **(a)** `cno_referenciado` nulo → **AVISA** e permite; **(b)** obra de destino sem CNO, ou CNO diferente → **RECUSA** o desfecho (i) só daquele documento, com o texto de consequência do critério 2 do `CONTAI-007`; **(c)** CNO bate → ambos os desfechos liberados. NF de material/boleto: revalidação não roda, segue a regra geral do adendo §5.2. **Estado novo de tela** (critério 11 abaixo): quando (b), o desfecho (ii) fica **único** para aquele documento — não é terceira saída, é (i) bloqueada com (ii) remanescente, ainda exigindo clique explícito. Fonte: §5.2 + `CONTAI-007` critério 2 + `podeCorrigirObra`. |
| 2 | Um pagamento que perde o documento que o sustentava volta a **"pago sem nota"** ou vira pendência de classe própria? | **RESPONDIDA** — adendo §5.2, desfecho (ii): volta a "pago sem nota", e **isso é registro verdadeiro, não perda de custo** |
| 3 | Se o custo migrar de obra **entre anos já declarados**, é correção do app ou retificadora? | **RESPONDIDA** — adendo §5.3: o app **abre pendência por ano** e **não decide retificadora** (CRC) |
| 4 | *(nova, 19/08)* Mover pagamento **sem** documento vinculado muda número em alguma obra? | **RESPONDIDA — 24/08. Confirma a hipótese do `po`: não muda número em obra nenhuma** (`min(valor, 0) = 0` nos dois lados, sem documento não há o que comprovar). **MARCA** rastro (`campo=obra`, `motivo=arquivamento_corrigido`) e **AVISA** que nada mudou; **sem RECUSA**, **sem pendência** — nenhum número declarado se move. É o espelho exato da tela `s8b` do mock do `CONTAI-021`. Critério 7 confirmado sem emenda. Fonte: §5.1 (`min(Σ pagamentos, Σ documentos)`) + §5.3. |

## Out of Scope

- **O lado do DOCUMENTO** — é o **critério 13 do `CONTAI-021`**. Não refazer
  aqui; **reusar**.
- **Desfazer conciliação como feature própria** — é da conciliação (`CONTAI-018`,
  telas `/ligar` e `/desligar`). Aqui o vínculo só se desfaz **como desfecho de
  um move**, no mesmo ato.
- **Apagar documento ou pagamento** — segue fora (CONTAI-009, acervo
  append-only).
- **Histórico/auditoria como tela nova** — o histórico é o card read-only do
  critério 16 do `CONTAI-021`, que já existe quando este ticket entra.

## Pre-mortem

1. **O `CONTAI-021` entra, a porta da frente fica correta, e esta fica aberta.**
   O Mateus aprende que "corrigir a obra" é seguro — pela tela do documento — e
   usa a do pagamento com a mesma confiança. **É a pior versão do risco**, e a
   mitigação é a posição na fila: imediatamente depois do 021.
2. Alguém "resolve" no caminho mais barato — mover o par inteiro sempre — e
   contrabandeia uma NF de serviço para uma obra cujo CNO ela não referencia.
   **É trocar um erro mudo por um erro pior**, com consequência de averbação.
   **Mitigação: critério 3 + pergunta 1 do Gate Fiscal.**
3. A trava vira atrito no caso comum (pagamento sem vínculo) e o Mateus deixa de
   corrigir. **Mitigação: critério 11.**
4. O ticket é implementado **antes** do 021 e recria `revisao`/`ato_id`/função
   transacional do zero. **Mitigação: a dependência está declarada nos dois
   sentidos.**

## Viabilidade (CTO)

- **A avaliar pelo `cto-obra` quando o ticket subir na fila.** Anotação do `po`:
  o ponto de mudança é `moverPagamentoDeObra` (`lib/data.ts`), a tela
  `app/pagamento/[id]/obra/page.tsx` e o componente **compartilhado**
  `app/_components/corrigir-obra.tsx` — que hoje serve às duas telas e vai
  precisar de decisão explícita (parametrizar × separar), porque as duas passam a
  ter perguntas diferentes.
- **Complexidade estimada pelo `po`: S/M**, e **só** porque o 021 entrega antes a
  tabela, a função, o `ato_id`, o detector de delta e a pendência por ano. Sem o
  021 na frente, é M/L.

## Dependências

- **Bloqueado por**: **`CONTAI-021`** (tabela `revisao`, `ato_id`, função
  transacional, detector de delta, pendência por ano com conjunto de obras,
  já entregue, `docs/tickets/CONTAI-021.md`) · **`CONTAI-007`**
  (`cno_referenciado` precisa existir no documento para a revalidação do
  critério 3 ter o que comparar — ticket escrito e mock aprovado em 24/08,
  ainda não implementado) · **Gate 0 (mock)**, único item que segue aberto.
- **Bloqueia**: nada formalmente — mas enquanto não entrar, o `CONTAI-021`
  entrega **meia correção**, e isso está escrito no `Out of Scope` de lá.
- **Satisfeito**: a dependência da US-003, que chegou como `CONTAI-018` (18/08).

## Perguntas Abertas

Nenhuma — as duas perguntas do Gate Fiscal (pergunta 1 e pergunta 4) foram
respondidas em 24/08, ver tabela acima. Falta só o Gate 0 (mock).

## Teste do Canteiro — **não se aplica como veto**

Cenário é **gestão em casa, sentado** (régua corrigida no `CLAUDE.md` em 18/08).

- **Meta 1** (nenhum pagamento sem documento hábil): move — o defeito produz
  exatamente o estado que a meta 1 existe para impedir, com o agravante de que o
  app **acha que está tudo certo** e ainda **acende alarme falso**.
- **Meta 2** (relatórios anuais): move — a discriminação de uma das obras sai a
  menos e ninguém sabe quanto.
- **Meta 3** (acervo): move — hoje a movimentação **não deixa rastro nenhum**.
- **Veredito: APROVADO como P0**, com Gate 0 e Gate Fiscal antes da
  implementação.
