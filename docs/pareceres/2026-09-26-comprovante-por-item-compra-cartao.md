# Parecer fiscal — comprovante por item de compra no cartão vs. comprovante único da fatura

- **Data**: 2026-09-26 · **Autor**: agente `contador`, execução read-only
- **Provocação**: relato do Mateus (com screenshot) registrando uma compra no
  cartão retroativamente (`data da compra` 28/04/2026, `vencimento da
  fatura` 15/05/2026, hoje é 26/09/2026 — ele sabe que aquele ciclo já
  aconteceu e já foi pago de verdade). Palavras dele: *"eu abro a fatura,
  pegaria o item referente ao pagamento, o comprovante do pagamento e
  anexaria, mas não é possível anexar nenhum documento agora [...] E eu
  posso anexar o comprovante do pagamento específico do item. Agora não é
  possível"*.
- **Pergunta**: a regra vigente do `CONTAI-022` — "a compra no cartão não
  tem comprovante e nunca terá; quem tem é a fatura" (comentário literal em
  `app/(gestao)/fatura/[id]/confirmar/page.tsx`) — continua correta, ou o
  pedido do Mateus é um requisito fiscal novo de comprovante por item que a
  arquitetura atual não suporta?
- **Consome**: nenhum parecer anterior é revisto; este parecer **confirma**
  a decisão original do `CONTAI-022` com um ângulo novo (registro tardio) que
  ainda não tinha sido testado.
- **Normativo para**: `CONTAI-066` (texto e navegação da tela de compra no
  cartão quando o registro é retroativo). Não normativo para o cálculo de
  aferição INSS/CNO — compra no cartão não é lançamento de mão de obra, e
  este parecer não toca a dívida D57.
- **Status**: **revisado por ADENDO em 2026-09-26** (mesma data, rodada
  seguinte). O corpo original abaixo permanece como registro do que foi
  perguntado e respondido primeiro; o veredito vigente é o da tabela
  atualizada + ADENDO ao final do arquivo. Não fecha mais sem ressalva: o
  ADENDO abre um requisito novo.

> `[Certain]` / `[Likely]` / `[Guessing]` seguem a convenção do projeto. Nada
> aqui substitui contador humano (CRC) na assinatura da declaração.

---

## Veredito resumido

| Pergunta | Resposta |
|---|---|
| 1. Comprovante único por fatura (cobrindo N compras) é correto e suficiente **para o evento de pagamento**? | **Sim** `[Certain]` |
| 2. Existe comprovante **por item** que a fatura não supre? | **Não** `[Certain]` — pedido original do Mateus continua sem categoria fiscal própria |
| 2b. *(ADENDO)* Existe um documento **por fatura**, diferente do comprovante de pagamento, que a arquitetura atual não captura e que falta para fechar a cadeia probatória? | **Sim** `[Likely]` — o extrato/fatura da administradora. Ver ADENDO |
| 3. Registro tardio (meses depois do evento) muda a resposta? | **Não** `[Certain]` |

⚠️ **Ver ADENDO ao final do arquivo antes de usar este parecer como Gate
Fiscal de qualquer ticket.** Ele não derruba 1 e 3, mas revisa o alcance de 2
e adiciona um requisito documental novo.

---

## 1 — Comprovante único por fatura está correto

`[Certain]`. O evento de caixa real é **um** desembolso (PIX/débito) que
quita a fatura inteira — N compras, um pagamento. Para custo de aquisição em
regime de caixa, o que a IN SRF 84/2001 art. 17 exige documentar é o
dispêndio efetivo, e esse dispêndio (saída de caixa) acontece na **liquidação
da fatura**, não no ato da compra. Um comprovante por fatura é suficiente e
correto — é a mesma lógica já usada no projeto para "um documento cobrindo N
lançamentos", só que invertida: aqui um pagamento cobre N itens/notas, em vez
de uma nota cobrir N pagamentos.

## 2 — Não existe comprovante por item que a fatura não supra

`[Likely]`, por razão estrutural: no cartão, a "compra" não é evento de
pagamento, é lançamento que vira dívida até a fatura ser quitada. Não existe
"comprovante de pagamento do item X" porque o Mateus não pagou o item X
isoladamente — ele pagou a fatura. O que sustenta fiscalmente aquele item são
dois documentos que já existem, separados, no sistema:

- a **NF/recibo do favorecido** — prova o dispêndio, discrimina material ×
  serviço, tem o CPF/CNPJ dele;
- o **comprovante do pagamento da fatura** — prova a saída de caixa, no valor
  agregado.

A "linha do extrato/fatura" que o relato menciona como "comprovante do
cartão" não tem função probatória própria: não prova pagamento (nesse
momento o banco ainda não recebeu nada do Mateus, só o emissor do cartão
recebeu o lançamento) nem prova o dispêndio em si (isso é papel da NF do
favorecido). Anexá-la teria no máximo valor de rastreabilidade/organização
pessoal, não de documentação hábil adicional — **isso é ponderação de
produto, não fiscal**, e fica com o `po` decidir se vale a pena como
conveniência (P2), nunca como requisito fiscal.

## 3 — Registro tardio não muda a resposta

`[Certain]`. Regime de caixa ancora na data em que o evento aconteceu no
mundo (pagamento da fatura, 15/05/2026), não na data de digitação no sistema
(26/09/2026). O gasto entra na ficha Bens e Direitos do ano-calendário 2026
independentemente de quando foi lançado no app, desde que fique discriminado
na DAA de 2026 (entregue em 2027) — e como ainda estamos dentro do próprio
ano-calendário 2026, não há questão de "ano já declarado" neste caso
concreto. A exigência de documentação hábil (NF + comprovante do pagamento da
fatura) é idêntica para lançamento em tempo real ou tardio.

## Diagnóstico

O documento que o Mateus quer anexar ("comprovante do pagamento específico
do item") **não existe como categoria fiscal própria**. O que ele precisa de
fato é o comprovante do pagamento da fatura, que já é capturado em
`/fatura/[id]/confirmar`. A dor real, pela leitura do relato, é estar
tentando anexar esse comprovante pela tela errada (registro da compra) em vez
de pela confirmação da fatura — provavelmente porque, sendo uma fatura já
paga no passado, o caminho até a confirmação não é óbvio a partir de onde ele
está. **É achado de navegação/wayfinding, não fiscal** — não há dívida fiscal
nova aqui, e nenhuma pergunta pendente de esclarecimento ao Mateus: a resposta
fiscal já resolve as duas leituras possíveis do relato.

**Fora de escopo deste parecer**: base de aferição INSS/CNO e a dívida D57
(retenção variável de PJ prestadora de serviço) — compra no cartão não é
lançamento de mão de obra; as duas apurações não se misturam aqui.

---

## ADENDO — 2026-09-26: o elo compra↔fatura não tem documento nenhum atrás dele

**Provocação**: pergunta do Mateus, verbatim: *"mas o que comprova que aquele
pagamento foi pago em tal fatura se não tem o comprovante único do
pagamento?"* — feita depois de ler o parecer acima. Junto, achado técnico
(não fiscal, mas relevante para o julgamento): a tabela `fatura` não tem
nenhum documento próprio; hoje só existem `fatura_desembolso.comprovante_path`
(o pagamento agregado) e a NF de cada compra.

### O que o corpo original errou

Não errou a resposta que deu — errou o escopo da pergunta. `§2` respondeu
"não existe comprovante de pagamento por item" (correto, e continua correto:
o Mateus não paga o item isoladamente, paga a fatura). Mas a pergunta de
fundo do Mateus é outra, e o corpo original não a separou: **não é "quem
prova que EU PAGUEI o item", é "quem prova que ESTE item específico estava
DENTRO desta fatura específica que eu paguei nesta data"**. São duas
perguntas diferentes, e só a primeira foi respondida.

### Por que o vínculo importa (e não é só rastreabilidade)

`[Likely]`. O regime de caixa (IN SRF 84/2001 art. 17) ancora no **pagamento
da fatura**, não na compra — isso está certo no `§1` e não muda. Mas segue
daí que **qual fatura cobrou qual compra** não é detalhe de organização: é o
dado que decide **em qual data — e portanto em qual ano-calendário — aquele
gasto específico entra na ficha Bens e Direitos**. Cartão de crédito tem data
de corte: uma compra de fim de mês pode cair na fatura do mês seguinte ou do
mês seguinte a esse, dependendo do dia exato e da politica do emissor. Se
essa associação estiver errada — mesmo sem má-fé, só erro de digitação ou de
premissa sobre a data de corte —, o gasto pode ser jogado para o
ano-calendário errado sem que nada no sistema hoje detecte a inconsistência.

Hoje, quem afirma "esta compra pertence a esta fatura" é **só o campo que o
Mateus digita** no formulário de captura (`vencimento da fatura`). Nenhum dos
dois documentos que `§2` cita cobre isso:

- a **NF do favorecido** prova que a compra aconteceu, com quem, por quanto —
  não diz nada sobre qual fatura a cobrou;
- o **comprovante de pagamento da fatura** prova que um valor agregado saiu
  do banco numa data — não prova a **composição** desse valor (quais compras
  estão dentro).

Não existe hoje nenhum documento de terceiro (banco/administradora do
cartão) que amarre as duas pontas. O que existe é uma afirmação do próprio
Mateus, guardada só no banco de dados do app.

### Resposta à pergunta de fundo do parecer original

**Não confundir com "comprovante por item"** — a categoria que o Mateus
pediu originalmente continua não existindo e continua incorreto pedi-la
(`§2` mantido nesse ponto). O documento que falta é outro, com função
própria, e tem o mesmo grão do comprovante de pagamento: **um por fatura**,
não um por item.

Esse documento é o **extrato/fatura em si** — o PDF que a administradora do
cartão emite, itemizando cada compra do ciclo (data, favorecido, valor) mais
o total cobrado. `[Likely]`, porque:

1. É documento de **terceiro** (a administradora), não autodeclaração do
   Mateus nem do app — mesmo padrão de idoneidade que a NF e o comprovante
   de pagamento já têm.
2. É o único documento que reconcilia **conteúdo** (quais compras) com
   **evento de caixa** (qual pagamento, em qual data) — fechando exatamente
   o elo que `§2` não tinha percebido como faltante.
3. Sobrevive ao teste da meta 3 (guarda até o CTN art. 173, I — potencialmente
   quase 7 anos após a venda, ou prazo indefinido se a obra não for vendida):
   se um fiscal pedir daqui a anos "prove que esta NF foi cobrada nesta
   fatura", hoje a resposta é "porque o app diz que sim" — o que não é
   documentação hábil, é o dado que a documentação hábil deveria sustentar.

### O que muda no veredito

- **`§1` (comprovante único por fatura) não muda** — continua correto e
  necessário para o evento de pagamento.
- **`§2` fica parcialmente revisado**: "não existe comprovante por item" está
  certo; "os dois documentos que já existem [NF + comprovante de pagamento]
  bastam" **não está mais correto sem ressalva** — falta o extrato da fatura
  como terceiro documento, também um-por-fatura.
- **`§3` (registro tardio) não muda.**

### Requisito novo

Anexar o **extrato/fatura da administradora** (PDF itemizado, um por fatura)
no mesmo ponto onde já existe o comprovante de pagamento — `/fatura/[id]/
confirmar` (e `/parcial`). São dois documentos distintos na mesma tela, com
função diferente: o comprovante prova a saída de caixa; o extrato prova a
composição. Isto é gate fiscal novo, não conveniência de produto — ao
contrário do que `§2` original sugeriu para a "linha do extrato" avulsa.

`[Guessing]`, fora da minha competência, para o `po`/`cto-obra` resolverem:
extrato de ciclos muito antigos pode não estar disponível em autoatendimento
em todo banco/administradora. Se genuinamente não for obtível, isso é
pendência de quarentena com consequência fiscal explícita (meta 1) — não
motivo para dispensar a exigência em silêncio nem para bloquear o registro
sem explicar o risco.

### Impacto nos tickets já escritos com base no parecer original

- **`CONTAI-066`**, seção "Fora de Escopo": exclui "comprovante por compra
  individual dentro da fatura" citando o `§2` original. Essa exclusão
  continua certa (é outra pergunta — por item, não por fatura), mas o
  Gate Fiscal daquele ticket (que cita `§2` como "os dois documentos que já
  existem... bastam") ficou desatualizado por este ADENDO e precisa ser
  revisto antes do ticket fechar Gate Fiscal definitivamente.
- **Requisito do extrato** não está coberto por nenhum ticket aberto hoje
  (`CONTAI-065`, `066`) — é candidato a ticket novo, não anexo dos dois
  existentes, porque a superfície é outra (documento na tela de confirmação
  de fatura, não vínculo `documento_origem_id` nem wayfinding de navegação).

---

# ADENDO 2 — 2026-09-26: cor/gravidade da pendência "fatura sem extrato" — vermelho, não âmbar

- **Provocação**: gate fiscal pontual do `cto-obra` para o `CONTAI-067` (fila
  unificada de pendências, mesmo mecanismo de `documentosSemArquivo` do
  CONTAI-033 e de `retencao_sem_recolhedor` do ADENDO 4 do parecer
  `2026-09-18-retencao-variavel-servico-pj.md`). Pergunta única: a pendência
  nova "fatura tem desembolso mas não tem extrato anexado" é vermelha (classe
  de `documentosSemArquivo`) ou âmbar (classe de "recolhedor confirmado, guia
  ainda não paga")?

## Veredito: vermelho

`[Likely]` — caso novo, primeira vez que a régua é aplicada a este padrão
específico (documento composto: N itens já documentados individualmente +
uma peça de terceiro que amarra o conjunto), por isso não sobe a `[Certain]`
mesmo com o raciocínio fechado.

**Aplicando a régua do A.4** (`docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`,
seção "A.4 — A régua de cor"): *"saiu? → tem apoio hábil no ano certo? →
não = vermelho"*.

- **Saiu?** Sim — o comprovante de pagamento da fatura já existe e prova o
  desembolso agregado.
- **Tem apoio hábil no ano certo?** **Não.** O próprio ADENDO 1 (acima, seção
  "Por que o vínculo importa") já identificou que **qual fatura cobrou qual
  compra decide em qual ano-calendário aquele gasto específico entra na
  ficha Bens e Direitos**, e que hoje essa associação é **só o campo que o
  Mateus digita** — nenhum documento de terceiro (NF do favorecido,
  comprovante de pagamento) prova a composição. Isso é exatamente o padrão
  que o A.4 já classificou como vermelho no precedente "mais de uma data":
  ambiguidade sobre **qual data/ano-calendário vale** é tratada com a
  gravidade mais alta, independentemente de o valor em si (a existência do
  custo) já estar provado por outro documento.

**Por que isso NÃO é o mesmo padrão do Estado C do ADENDO 4** (guia de
retenção pendente, âmbar): lá, a Pergunta 6 desse ADENDO fixou âmbar porque
"não há passivo não identificado... mecânica normal do produto" — o custo do
Mateus já está integralmente sustentado no valor e no ano certo, e o que
falta é a ação **futura de um terceiro** (o prestador recolher), risco de
compliance alheio, não uma lacuna na documentação do próprio Mateus. Aqui é o
oposto: a lacuna é na **documentação hábil do próprio Mateus** para sustentar
em qual ano-calendário o gasto cai — o mesmo tipo de lacuna que fundamenta o
vermelho fixo de `documentosSemArquivo` (CONTAI-042, item 8-B: *"o arquivo
que falta É o documento hábil"*), só que aqui o que falta não é a prova de
que a despesa existiu (essa está provada, item a item, pelas NFs), e sim a
prova de que ela **cai no ano certo** — que é elemento igualmente essencial
do regime de caixa do art. 17 da IN SRF 84/2001, não um detalhe acessório.

**Nuance para o `cto-obra` levar ao design, não para rebaixar a cor**: o raio
de efeito não é idêntico ao de `documentosSemArquivo`. Lá, a falta do arquivo
veta **as três saídas anuais** (`podeGerarRelatorioAnual`), porque falta o
documento hábil da despesa em si — sem NF/PJ, nem a ficha Bens e Direitos,
nem Pagamentos Efetuados, nem a aferição INSS têm o que precisam. Aqui, a
falta do extrato é **fora de escopo da aferição INSS** (compra no cartão não
é lançamento de mão de obra — dito no corpo do parecer original) e não
altera, por si, a lista CPF-por-CPF de Pagamentos Efetuados. O que ela
compromete é especificamente a **discriminação correta do ano-calendário na
ficha Bens e Direitos**. Isso não muda a cor (o teste do A.4 já resolve isso
pela pergunta "ano certo?", não pelo número de saídas afetadas) — muda apenas
qual saída anual o `cto-obra`/`lead-engineer` deve travar quando a pendência
estiver aberta. Essa é decisão técnica, não fiscal, e fica com eles.

**O que este ADENDO NÃO resolve** (fora da minha competência, para o
`po`/`cto-obra`): se um extrato de ciclo muito antigo for genuinamente
inobtível (ver `[Guessing]` já registrado acima no ADENDO 1), a cor
vermelha permanece correta como sinalização do risco — a resposta a essa
situação é tratamento de quarentena/exceção documentada, não rebaixamento
silencioso para âmbar.

**O contai redige, dateia e organiza. Não assina.**
