# Parecer fiscal — compromisso × pagamento (previsto × executado)

- **Data**: 2026-08-18 · **Autor**: agente `contador`, execução read-only
- **Provocação**: *"o pagamento pode ser um registro para futuro ou já feito,
  isso será contabilizado pela data de execução"* — Mateus, 2026-08-18. Hoje o
  app recusa data futura (`lib/fiscal/pagamento.ts:137`) e o compromisso
  conhecido não tem onde morar.
- **Consome**: `2026-08-17-vinculo-pagamento-documento.md` (as quatro condições
  do custo, o mínimo pagamento×documento, o adendo da repartição cronológica),
  `2026-08-16-gate-fiscal-contai-004-005.md` (boleto fora de toda soma),
  `2026-08-17-terreno-financiado.md` (juros do financiamento — não confundir),
  Q4 e Q6 fechadas no `docs/backlog.md`.
- **Normativo para**: `CONTAI-019` (materializa o Gate Fiscal transcrito no
  ticket), a tabela `compromisso`, a tela de confirmação e a exportação.

> Marcações `[Certain]` / `[Likely]` / `[Guessing]` são do contador. Nada aqui
> substitui contador humano (CRC) na assinatura da declaração.

---

## 1. Compromisso não é custo, e não é custo "ainda pequeno" — é zero

**O que gera custo de aquisição é o pagamento, na data do pagamento.**
`[Certain]` É a condição 1 das quatro do parecer de 17/08 (§1, base art. 17 da
IN SRF 84/2001): *houve desembolso efetivo do declarante, com data*. Regime de
caixa não é convenção do app; é o regime da ficha Bens e Direitos, que descreve
a **situação em 31/12** — e em 31/12 o que existe é o que já saiu da conta.

Não entram na apuração, em nenhum valor e sob nenhum rótulo:

- boleto emitido e não pago, agendado ou não;
- PIX programado;
- parcela vincenda de contrato assinado;
- medição executada e ainda não paga.

**Vale com a nota já emitida.** `[Certain]` Nota emitida e não paga **não é
custo** — falha a condição 1, e o parecer de 17/08 §3 já dizia isso por extenso:
*"Documento hábil sem pagamento — falha a condição 1. Nota emitida não é
dinheiro que saiu. Não soma, e não é pendência de risco: é documento no acervo
esperando o desembolso que vai lastrear."* No app essa nota tem lugar próprio —
o **terceiro número**, "notas hábeis sem pagamento vinculado", que **não soma**
com o custo confirmado. Nota emitida entra como **documento**; ela nunca vira
compromisso, e o compromisso nunca a substitui.

Corolário para o produto: **a recusa de data futura em `pagamento` fica,
literalmente.** `[Certain]` O que falta não é afrouxar a validação — é dar ao
compromisso uma entidade própria, fora do alcance de qualquer cálculo.

## 2. Onde o compromisso pode aparecer — e a lista que protege o número

**Pode**: agenda/lista de previstos, lembrete, detalhe do favorecido, e a
exportação **em arquivo separado**.

**Não pode aparecer, em nenhuma hipótese** `[Certain]`:

1. no **custo confirmado** e em qualquer acumulado de custo (ano ou total);
2. na **discriminação de Bens e Direitos** (US-004) — nem no valor, nem no texto;
3. na ficha **Pagamentos Efetuados** (prestador PF só entra com pagamento feito);
4. na **base de aferição do INSS** (SERO) — previsão não abate e não acresce nada;
5. em **"pago sem nota"** e em qualquer indicador de exposição/pendência fiscal —
   não há fato consumado, logo não há risco fiscal;
6. no **terceiro número** ("notas hábeis sem pagamento vinculado"), que é
   composto por documentos, não por previsões;
7. no **grafo de conectividade** de `lib/fiscal/vinculo.ts` — compromisso não é
   nó de `alocarCusto`, nem pelo lado do pagamento, nem pelo do documento;
8. em **qualquer soma mista**, com qualquer rótulo. Não existe "total previsto +
   realizado" em lugar nenhum do app.

O campo se chama **"valor previsto"**, nunca "valor". Na exportação, cabeçalho
literal: *"AGENDA DE COMPROMISSOS — VALORES PREVISTOS, NÃO EXECUTADOS. NÃO
COMPÕEM CUSTO DE AQUISIÇÃO."*

**Por que tabela própria e não uma coluna a mais em `pagamento`** `[Certain]`: a
proteção tem de ser de **tipo**, não de atenção. Registro com data anulável
transforma a regra em *"todo cálculo lembra de filtrar nulo"* — é o defeito do
`status` com outro rosto, o mesmo que o CONTAI-018 está removendo. Um cálculo
escrito daqui a seis meses não pode ter como pegar um compromisso por engano.

## 3. A transição compromisso → pagamento

**Dois registros distintos com vínculo. Não conversão.** `[Certain]` Três razões,
todas probatórias:

1. **Natureza diferente**: o compromisso afirma uma intenção, o pagamento afirma
   um fato do mundo com data e comprovante. Um registro que muda de natureza no
   tempo impede responder "isto já foi contado como custo antes de tal data?".
2. **1 para N**: um compromisso pode ser quitado por vários pagamentos (o caso
   comum da obra). Conversão não modela isso; vínculo, sim.
3. **Acervo append-only** (CONTAI-009): o compromisso registra que a previsão
   existiu — inclusive quando não se realizou.

**Qual data vale**: a da **execução** — o dia em que o dinheiro saiu da conta.
`[Certain]` A data prevista é descartada na gravação, e nunca pode ser gravada
por default. Confirmar em 17/09 um compromisso de 15/09 grava 17/09. Em
**cartão de crédito**, a data é a do **pagamento da fatura** que contém a
parcela (Q4, fechada em 08/08, com a ressalva de que a tese pede confirmação de
CRC antes da primeira declaração que a use) — não a da compra, nem a do
agendamento.

**Quando o valor executado difere do previsto** — o caso do Mateus, com nota por
medição e boleto com encargos:

- **Só o principal compõe custo.** `[Certain]` **Juros e multa de mora ficam
  fora** — não remuneram bem ou serviço incorporado ao imóvel (condição 2 do §1
  de 17/08). Boleto pago com R$ 320 de encargos sobre R$ 10.000 gera custo de
  R$ 10.000; os R$ 320 são registrados e ficam fora.
- ⚠️ **Não confundir com os juros do financiamento do terreno**, que **integram**
  o custo (parecer de 17/08, adendo — IN SRF 84/2001, art. 17, I, "g",
  *"juros e demais acréscimos pagos para a aquisição do imóvel"* — **texto e
  inciso verificados; a letra da alínea é secundária e se confere no ato
  publicado**). São
  juros pagos **para adquirir o imóvel**; encargo de mora por atraso de boleto
  não é. Fundir os dois casos é erro fiscal, não de escopo.
- **Desconto / valor menor**: o custo é o **efetivamente pago**, o menor.
  `[Certain]`
- **Pagamento parcial**: cria um pagamento pelo valor pago, o compromisso segue
  com saldo. O custo do ano é o pago, não o previsto — e o teto continua sendo o
  mínimo contra os documentos hábeis do conjunto (§3 de 17/08).
- **Valor maior sem encargos identificados**: registra o pago e vai para
  **revisão humana**. Diferença não explicada não se acomoda em campo.

**Quando o compromisso não se realiza**: **cancelado, nunca apagado**, com o
motivo. Não gera lançamento nenhum — nunca gerou. **Não expira sozinho e não
some**: sumiço silencioso devolve o compromisso para a cabeça dele, que é a
falha da meta 1 pelo lado de fora. O dente é anual: **compromisso vencido sem
resposta bloqueia a geração do relatório anual daquele ano**, porque é na virada
do ano que a omissão custa.

## 4. Documento hábil — o compromisso é a única entidade que nasce sem anexo

**Compromisso não exige anexo.** `[Certain]` A exigência de documentação hábil
(art. 17) é condição para **compor custo**; compromisso não compõe custo nenhum,
logo não há o que sustentar. Exigir anexo aqui produziria o pior resultado
possível: atrito que faz ele não registrar, e a previsão volta para a memória.

> ⚠️ **Ponto que contraria a leitura literal do `CLAUDE.md`.** A linha *"o anexo
> obrigatório no ato do registro"* está entre as coisas que **não mudam** na
> régua de 18/08. Ela vale para o registro de **fato consumado** — pagamento e
> documento. **Compromisso é a exceção nomeada**, e é exceção por não afirmar
> fato nenhum. Se o `CLAUDE.md` for atualizado, que seja com esse recorte
> explícito, e não afrouxando a regra geral.

**Boleto não pago é documento hábil para quê** — reconciliando com o que já está
escrito, sem contradizer:

- **Para custo: não, nunca.** `[Certain]` Boleto não é hábil **nem depois de
  pago** (parecer de 16/08; `ehDocumentoHabil` em `lib/fiscal/vinculo.ts`): é
  título de cobrança, não descreve o que foi adquirido nem prova o destinatário.
  Quem sustenta o custo é a NF.
- **Para a agenda: sim** — identifica credor, valor e vencimento com precisão
  suficiente para o compromisso existir.
- **Para a conectividade do vínculo: sim** — é o papel já registrado em
  `vinculo.ts:37`. O boleto liga o pagamento à nota e **impede contar a mesma
  despesa duas vezes**, contribuindo **zero** para a soma hábil.

Anexar o boleto ou o contrato ao compromisso é **útil e recomendado**, jamais
bloqueante. E **comprovante não bloqueia a confirmação**: *nunca recuse o
registro de um fato consumado.* Confirmado sem comprovante grava, **não entra no
custo confirmado** e vira a pendência **"pago sem comprovante"**.

## 5. Dupla contagem — onde o risco está de verdade

O compromisso, por si, não infla nada: ele não entra em soma alguma (§2). **O
risco real é o desembolso registrado duas vezes** — uma pela confirmação do
compromisso, outra por registro avulso do mesmo PIX. Quatro defesas, em ordem de
força `[Certain]`:

1. **Estrutural — o teto do mínimo.** Pelo §3 de 17/08, o custo comprovado de um
   conjunto conexo é o **mínimo** entre a soma dos pagamentos e a soma dos
   documentos hábeis. Dois pagamentos do mesmo desembolso ligados à mesma nota
   **não inflam o custo**: o excedente cai em "pago sem nota". O erro aparece
   como **ruído no alerta**, na direção segura (subestima), e pela **repartição
   cronológica ratificada em 18/08** (adendo ao parecer de 17/08) recai sobre o
   pagamento **mais recente** — que é justamente o duplicado. Isso é aritmética
   da regra, não regra nova.
   ⚠️ **A defesa só age dentro do conjunto conexo.** Pagamento duplicado **sem
   vínculo** com nota nenhuma não é travado por nada: vira "pago sem nota" pelo
   valor cheio e polui o indicador de exposição.
2. **De produto — a marca visual.** O pago não carrega marca de agendamento; o
   agendado carrega. Um pagamento que "parece agendado" é o que faz ele
   registrar de novo. A redundância de marcas é requisito, não enfeite.
3. **De fluxo — o compromisso quitado sai da lista de abertos** assim que o
   pagamento é criado, e o saldo fica visível quando a quitação é parcial.
4. **De detecção — sugerir, nunca fundir.** Mesmo favorecido, valor próximo,
   data próxima ⇒ o app **pergunta** *"este pagamento quita o compromisso de
   15/09?"*. **Proibido inferir vínculo por heurística** (§5.5 de 17/08):
   vínculo inferido errado infla custo em silêncio **e** mata o alerta.

## 6. Quantos compromissos abertos ao mesmo tempo

`[Likely]`, a partir dos fatos já registrados no `docs/backlog.md` e na memória
do projeto — parcelas da empreiteira pagas **uma a uma, por medição** (não é
série), material comprado online/WhatsApp com boleto de vencimento curto, e
cartão: **2 a 5 abertos na maior parte do tempo**, com picos em mês de medição
somada a compras de material. Não vejo base para 15.

**Recomendação**: desenhar para **lista na home** e não construir tela própria
antes de o uso exigir. Se a lista passar de ~8 itens abertos com frequência, aí
sim é tela própria — e o corte é medível depois, não agora. **Marcado como
pergunta**, porque a única fonte confiável é ele.

## 7. Automático × humano

**Sistema sozinho** `[Certain]`: manter compromisso fora de toda soma; gravar o
pagamento na data de execução; separar principal de encargos quando ele
informar; bloquear o relatório anual com compromisso vencido sem resposta;
sugerir o vínculo de quitação; avisar duplicidade.

**Só o Mateus**: confirmar que aquele desembolso quitou aquele compromisso, e
dizer quanto do valor pago foi encargo.

**Exige CRC** `[Certain]`: o alcance do art. 17, I, "g" para juros de
financiamento **de construção** (segue aberto); o tratamento de qualquer
divergência de valor não explicada por encargo; o texto que vai à declaração; e
qualquer retificadora decorrente de pagamento registrado fora de ordem
cronológica.

---

**Pergunta ao Mateus (uma)**: hoje, olhando contrato e boletos, **quantos
pagamentos você consegue enxergar com data marcada ao mesmo tempo** — 2, 5 ou
mais de 10? É o que decide entre lista na home e tela própria (pergunta 2 do
CONTAI-019; as perguntas 1 e 3 do ticket **já estão respondidas** no
`docs/backlog.md` e na memória do projeto).

---

# ADENDO — 2026-08-18 · quatro pontos do CONTAI-019 que o parecer deixou implícitos

- **Origem**: consulta do agente `po` fechando as pendências do `CONTAI-019`
  para virar critério de aceite. Transcrito aqui porque **regra fiscal que só
  existe em transcript é a falha que o `CLAUDE.md` proíbe**.
- **Normativo para**: `CONTAI-019` (critérios 13, 21 e os novos de cartão e de
  sugestão de quitação), `US-004` (o bloqueio anual), `CONTAI-011` (a exportação).

## A. Escopo do bloqueio anual — a data prevista NÃO recorta o bloqueio

**Decisão** `[Certain]`: **qualquer compromisso vencido sem resposta bloqueia a
geração de qualquer relatório anual**, e não apenas o do ano em que cai a data
prevista. A leitura do mock ("daquele ano" = data prevista dentro do ano do
relatório) está **errada** e infla o risco exatamente onde ele é mais caro.

**O porquê fiscal, em uma linha**: a data prevista é uma previsão, e **previsão
não decide nada fiscal** — é a espinha deste parecer inteiro (§3: "a data
prevista é descartada na gravação"). Deixar a previsão recortar o bloqueio é
devolver à previsão um efeito fiscal, com outro rosto.

**O caso real prova a regra**: compromisso previsto para 28/12/2025, pago de fato
em 05/01/2026. Enquanto ele estiver **sem resposta**, ninguém sabe se aquele
desembolso pertence a 2025 ou a 2026 — as duas hipóteses estão vivas ao mesmo
tempo. Sob a leitura do mock, o relatório de 2026 seria gerado **liberado**, com
um desembolso possivelmente seu, não registrado, e sem ninguém perguntar nada. É
o buraco que o critério 21 existe para tapar.

Corolários, todos testáveis:

1. **Não vencido não bloqueia nada** (data prevista ≥ hoje): não há incógnita
   ainda, há futuro.
2. **Respostas que desbloqueiam**: *saiu* (cria pagamento), *não saiu* (cancela,
   com motivo), *mudou a data* (nova data prevista futura). Sempre existe uma
   resposta disponível — o bloqueio nunca é uma prisão.
3. **Compromisso sem data prevista definida não é vencido e não bloqueia** — mas
   continua na agenda. Esse estado é alcançável **só** pelo saldo de uma quitação
   parcial (ver §D), nunca na criação.
4. O "não, é outro pagamento" da sugestão do §C **não** é resposta ao vencido e
   **não** desbloqueia.
5. Sobre-bloqueio consciente: gerar o relatório de 2025 em 2027 com um
   compromisso de 2026 vencido e sem resposta também trava. É deliberado — o
   custo é um toque, e a resposta é justamente o dado que decide o ano.

**Texto copiável (critérios)**

- [ ] ⚠️ **Qualquer compromisso vencido sem resposta bloqueia a geração de
  qualquer relatório anual** — não só o do ano da data prevista — com a lista do
  que falta responder. Unitário: compromisso previsto para 28/12/2025 sem
  resposta bloqueia **também** o relatório de 2026.
- [ ] **Compromisso com data prevista ≥ hoje não bloqueia relatório nenhum.**
- [ ] **Compromisso sem data prevista definida não é vencido e não bloqueia**, e
  continua listado na agenda. Esse estado só existe como saldo de quitação
  parcial.
- [ ] **Desbloqueiam**: *saiu*, *não saiu*, *mudou a data*. **Não desbloqueia**: o
  "não, é outro pagamento" da sugestão de quitação.

## B. Cartão de crédito — a compra nasce compromisso

O ticket não tem critério nenhum sobre cartão, e o `meio = cartao` já existe no
enum, com `data_compra` na tabela. Sem regra, o custo entra no mês (e no ano)
errado sem ninguém notar. Fecho os quatro pontos.

**(a) Qual data o app grava** `[Certain, dentro da Q4]`: `data_pagamento` = a
data em que a **fatura foi paga**. `data_compra` = a data da compra,
**obrigatória** quando `meio = cartao`, **e que não decide ano nenhum** — existe
como dado probatório (liga a nota à fatura) e para a revisão de CRC da ressalva
da Q4. Nenhuma função de apuração lê `data_compra`.

**(c) Sim — a compra no cartão nasce compromisso** `[Certain]`, e o encaixe é
exato, não analógico: no instante da compra **não houve desembolso do
declarante**; falha a condição 1 do §1 do parecer de 17/08. É fiscalmente o mesmo
estado do boleto emitido e não pago. A previsão vira fato quando a fatura é paga.

⚠️ **Consequência que corrige a diretriz de desenho do ticket**: *"data ≤ hoje →
pagamento"* **não vale para cartão**. A data da compra é passada e mesmo assim
não há pagamento. O que decide o branch é **"a fatura que contém esta compra já
foi paga?"** — nunca a data da compra.

**(b) O que o app pergunta, e quando** — dois momentos, e é o desenho inteiro:

1. **Na compra**: favorecido, valor, data da compra, nota, e a **data de
   vencimento da fatura** que vai conter a compra → essa é a **data prevista** do
   compromisso.
2. **No pagamento da fatura**: a data em que a fatura foi efetivamente paga. Cada
   compra daquela fatura é confirmada, uma a uma, gerando **um pagamento por
   compra** — **nunca um pagamento único pela fatura**. A fatura não é documento
   hábil e não tem favorecido próprio: o custo se atribui por compra, cada uma
   com seu favorecido, sua nota e sua classificação material × serviço.

**(d) Fatura cruzando o ano-calendário** `[Certain, dentro da Q4]`: compra em
20/12/2026 com fatura paga em 10/01/2027 → **custo de 2027**. Em 31/12/2026 o
dinheiro não tinha saído, e a ficha Bens e Direitos descreve a situação naquela
data. A compra não aparece em número nenhum de 2026 — só na **agenda de
compromissos**, no arquivo separado do critério 23. A nota, se emitida em 2026,
conta no **terceiro número** ("notas hábeis sem pagamento vinculado"), como
documento, que não soma.

**Ressalva que viaja junto** `[Certain que a ressalva existe]`: a Q4 é tese
defensável, não pacífica. **Exige confirmação de contador humano (CRC) antes da
primeira declaração que a use.**

**Texto copiável (critérios)**

- [ ] **Cartão: a compra nasce compromisso.** Registro com `meio = cartao` cria
  **compromisso**, nunca pagamento, mesmo com data da compra no passado. A data
  prevista é o **vencimento da fatura** que contém a compra. E2E: compra de
  ontem no cartão → uma linha em `compromisso`, **zero** em `pagamento`.
- [ ] ⚠️ **A diretriz "data ≤ hoje → pagamento" não vale para cartão.** O branch é
  decidido por *"a fatura que contém esta compra já foi paga?"*, nunca pela data
  da compra. Unitário nomeando a exceção.
- [ ] **`data_compra` é obrigatória quando `meio = cartao` e não decide ano
  nenhum.** Nenhuma função de apuração a recebe — a tipagem impede, não a
  disciplina.
- [ ] **Confirmar a fatura paga grava `data_pagamento` = data do pagamento da
  fatura**, em cada compra daquela fatura. **Um pagamento por compra, nunca um
  pagamento único pela fatura.** E2E: fatura com 3 compras paga em 10/01 → 3
  pagamentos com `data_pagamento = 10/01`, cada um com seu favorecido.
- [ ] **O favorecido é o lojista/prestador, nunca a administradora do cartão nem
  o banco** — cartão é instrumento de pagamento (adendo de 18/08 ao parecer de
  17/08, §1).
- [ ] ⚠️ **Fatura cruzando o ano**: compra em 20/12/2026 com fatura paga em
  10/01/2027 → custo de **2027**. Unitário com essas duas datas, afirmando
  **R$ 0,00** dessa compra em 2026.
- [ ] **Encargos do cartão ficam fora do custo** — juros de rotativo, juros de
  parcelamento de fatura, IOF, anuidade e multa. Mesma separação principal ×
  encargos dos critérios 13 e 14.
- [ ] **Fatura paga parcialmente (rotativo) não quita compromisso nenhum
  automaticamente** — vai para revisão humana. Só a fatura paga integralmente
  segue o caminho automático.
- [ ] **Compra parcelada gera um compromisso por parcela**, cada um com a data
  prevista da sua fatura; cada parcela entra no ano da **sua** fatura paga (Q4).
  *Se o ticket não comportar, cartão parcelado é **recusado na entrada** com
  mensagem explícita — nunca aceito como se fosse à vista.*
- [ ] **O relatório anual que contiver custo vindo de cartão exibe a ressalva da
  Q4**: tese do ano do pagamento da fatura, **a confirmar com contador humano
  (CRC) antes da primeira declaração que a use**.

## C. Sugestão de quitação — gatilho exato, e por que ele é estreito

**(a) Gatilho, cumulativo** — as três condições ao mesmo tempo:

1. **Mesmo favorecido, exato**: mesmo `favorecido_id`, cuja chave é o CNPJ/CPF.
   `[Certain]` **Proibido casar por nome** — nome não é identidade (adendo de
   18/08, §2: "CNPJ errado não é typo, é outro favorecido").
2. **Valor dentro da faixa**: `|valor pago − valor previsto| ≤ 20% do previsto`
   **ou** `≤ R$ 500,00`, o que for maior. `[Likely]` — convenção de produto para
   ser testável, **sem consequência fiscal**, porque a sugestão nunca cria
   vínculo. Faixa e não valor exato **de propósito**: divergir é o normal (juros,
   multa, desconto — §3); exigir igualdade perderia justamente os casos que
   interessam. Pagamento muito abaixo do previsto **não** dispara: quitação
   parcial é ato deliberado, feito a partir do compromisso.
3. **Janela de datas**: data do pagamento entre **30 dias antes** e **60 dias
   depois** da data prevista. `[Likely]`, mesma natureza de convenção. Assimétrica
   porque atraso é mais comum que antecipação. ⚠️ **Sem recorte de
   ano-calendário** — o par 28/12 → 05/01 é exatamente onde a duplicidade custa
   mais caro (custo no ano errado).

**Mais de um compromisso elegível → lista todos.** `[Certain]` **Proibido
escolher o mais próximo**: escolher é heurística decidindo vínculo (§5.5 de
17/08).

**A sugestão aparece depois do pagamento gravado e nunca bloqueia a gravação** —
*nunca recuse o registro de um fato consumado* (§4).

**(b) Texto na tela** — literal, para copiar e não reescrever:

> **Este pagamento quita o compromisso de 15/09?**
> WK Construções — previsto R$ 25.000,00 para 15/09
> [ Sim, quita este compromisso ]  [ Não, é outro pagamento ]
> Se não quitar, o compromisso continua em aberto e este pagamento fica
> registrado sozinho.

**(c) Se ele ignora ou responde "não"** `[Certain]`: exatamente o que você
escreveu — o pagamento avulso **fica como está**, o compromisso **segue aberto**,
e **nenhum número muda**. O compromisso aberto continua contando para o bloqueio
anual do §A, que é onde a cobrança acontece de verdade.

**(d) Confirmações pedidas** `[Certain]`:

- A sugestão **nunca cria vínculo sozinha**. Não pode existir caminho de código
  que grave a quitação sem ato humano explícito.
- O **"não" é registrado**, por par (pagamento, compromisso): o app não pergunta
  de novo **daquele par** — perguntar de novo ensina a dispensar sem ler — e
  continua livre para sugerir outros pares.
- O "não" **não** é resposta ao vencido e **não** desbloqueia o relatório anual
  (§A, corolário 4).

**Texto copiável (critérios)**

- [ ] **Gatilho cumulativo**: mesmo `favorecido_id` (nunca por nome);
  `|pago − previsto| ≤ 20% do previsto ou ≤ R$ 500,00, o que for maior`; data do
  pagamento entre 30 dias antes e 60 dias depois da data prevista, **sem recorte
  de ano**. Unitários nos dois lados de cada limite.
- [ ] **Vários elegíveis → lista todos.** Proibido escolher o mais próximo.
- [ ] **A sugestão aparece depois do pagamento gravado e nunca bloqueia a
  gravação.**
- [ ] **Texto literal do parecer**, não reescrito (bloco acima).
- [ ] **"Não" é registrado por par**, não repergunta daquele par, e **não**
  desbloqueia o relatório anual.
- [ ] **Ignorar ou recusar não altera número nenhum**: pagamento fica como está,
  compromisso segue aberto. Unitário sobre os totais antes e depois.
- [ ] ⚠️ **Nenhum caminho de código cria vínculo de quitação sem ato humano.**

## D. Valor MENOR — desconto × parcial

**Confirmado, na frase que você pediu** `[Certain]`: **desconto** → o custo é o
valor **pago** (o menor), o compromisso é **quitado**, e não sobra resíduo em
lugar nenhum — nem saldo, nem "pago sem nota", nem pendência; **parcial** → cria
pagamento pelo **valor pago**, o compromisso **segue com saldo**, e **o saldo não
é custo de nada** — não é custo deste ano, não é custo de ano nenhum, e só vira
custo se e quando for pago.

**Sem default, e concordo com sua posição** `[Certain]`. Três razões, em ordem:

1. É **fato do mundo que só ele conhece** — a mesma razão pela qual inferir
   vínculo é proibido (§5.5 de 17/08). Default aqui é o app **afirmando** um fato
   que não tem como saber, contra a regra do `CLAUDE.md` ("campo vazio pergunta,
   campo preenchido afirma").
2. **Nenhum dos dois erros é mais barato**, então não há default "seguro" para
   onde cair: assumir desconto fecha um compromisso ainda devido e **mata o
   alerta**; assumir parcial deixa um saldo fantasma que polui a agenda e trava o
   relatório anual (§A).
3. Os dois botões saem com **o mesmo peso visual** e **nenhum pré-selecionado**.

**Melhoria que evita uma pergunta impossível**: rotule pelo **resultado**, não
pela causa — *"Quita o compromisso"* × *"Falta pagar o resto"*. Assim ele não
precisa caracterizar juridicamente se houve desconto, erro de previsão ou
abatimento; e para o custo os dois primeiros casos são idênticos de qualquer
forma.

**Interação com o teto do mínimo** `[Certain]`: no desconto, se a nota foi
emitida pelo valor cheio, `Σ documentos > Σ pagamentos` e o custo comprovado já é
o **mínimo** = o pago (§3 de 17/08). Não há tratamento especial a escrever — a
regra que já existe acerta sozinha.

⚠️ **Buraco do fluxo parcial, que o ticket não cobre**: quitação parcial **precisa
pedir a nova data prevista do saldo**. Sem isso, o saldo nasce imediatamente
vencido e sem resposta e trava o relatório anual para sempre. Opção legítima:
**"sem data definida"** — o compromisso continua aberto e visível na agenda e,
pelo corolário 3 do §A, **não bloqueia**, porque incerteza declarada não é
silêncio.

**Texto copiável (critérios)**

- [ ] **Valor menor exige escolha humana explícita entre "quita o compromisso" e
  "falta pagar o resto".** **Sem default e sem pré-seleção**, com os dois botões
  no mesmo peso.
- [ ] **Quita**: custo = valor pago, compromisso quitado, **nenhum resíduo** —
  sem saldo, sem pendência, sem "pago sem nota" pela diferença. Unitário:
  previsto R$ 10.000, pago R$ 9.500 → custo R$ 9.500 e zero resíduo.
- [ ] **Falta pagar o resto**: pagamento de R$ 9.500, compromisso aberto com
  saldo de R$ 500, e **o saldo não entra em custo nenhum**, de ano nenhum.
- [ ] **Quitação parcial pede a nova data prevista do saldo**, com a opção
  explícita **"sem data definida"** — que mantém o compromisso aberto e visível e
  **não** bloqueia o relatório anual.

## E. Automático × humano (deste adendo)

**Sistema sozinho** `[Certain]`: bloquear o relatório anual por compromisso
vencido sem resposta, sem recortar por ano; manter compra no cartão fora de todo
custo até a fatura ser paga; gravar `data_pagamento` = data da fatura paga;
disparar a sugestão de quitação pelo gatilho do §C; recusar default no valor
menor.

**Só o Mateus**: dizer se o pagamento quitou aquele compromisso; dizer se o valor
menor foi desconto ou parcial; dizer quanto do pago foi encargo.

**Exige CRC** `[Certain]`: a tese da Q4 (ano do pagamento da fatura) antes da
primeira declaração que a use; qualquer divergência de valor não explicada por
encargo; e retificadora decorrente de compromisso respondido tarde, com data de
pagamento em ano já declarado.

---

# ADENDO 2 — 2026-08-18 · o comprovante de pagamento é exigência fiscal ou disciplina de produto?

- **Origem**: pergunta direta do Mateus sobre o mock do `CONTAI-019` —
  *"por que o comprovante é obrigatório? isso tem algo fiscal incluído?"*
- **Normativo para**: `CONTAI-019` (o bloqueio de gravação do formulário de
  pagamento), `CONTAI-011` (acervo), e a leitura da premissa *"anexo obrigatório
  no ato do registro"* do `CLAUDE.md`.

## 1. A resposta não é uma só — depende de quem recebeu

**Pagamento a PF (recibo)**: o comprovante é **exigência fiscal**, e é
**constitutivo**, não acessório. `[Certain]` A definição de documentação hábil
deste projeto sempre foi *"recibo de autônomo com nome, CPF completo e descrição
do serviço **+ comprovante de transferência da conta dele**"*. Recibo é papel
unilateral, escrito por quem tem interesse no valor; sozinho ele não prova nada.
Sem o rastro bancário **não existe condição 3** (§1 do parecer de 17/08) — não é
custo mal documentado, é custo inexistente para efeito de prova.

**Pagamento a PJ (NF)**: o comprovante é **disciplina de produto com lastro
fiscal parcial**. `[Likely]` A NF sustenta *o que* foi adquirido, por quanto e em
nome de quem — condição 3, inteira. O que ela **não** sustenta é a condição 1:
que houve desembolso, **quando** e **por ele**. Em glosa de custo de aquisição a
prova de pagamento é rotineiramente pedida quando o valor é relevante ou a nota é
parcelada — **confirmar na legislação e na jurisprudência do ano**; não afirmo
como pacífico.

**Conclusão em uma linha**: a obrigatoriedade **não é dogma nosso**, mas também
não é uniforme. Ela é fiscal e inegociável no caminho PF, e é reforço probatório
forte (não constitutivo) no caminho PJ.

## 2. O que o comprovante prova que a nota não prova

A leitura do Mateus está certa e é incompleta. `[Certain]` O comprovante prova
**quatro** coisas, e nenhuma delas está na nota:

1. **A data do desembolso** — a chave do regime de caixa, que decide o
   **ano-calendário** do custo. A data da nota não decide ano nenhum.
2. **Que o dinheiro saiu** — nota emitida e não paga não é custo (§1 deste
   parecer). A nota não distingue emitida de quitada.
3. **Que saiu da conta DELE** — a nota tem destinatário, não pagador. Nota no CPF
   dele paga pela conta de terceiro não é dispêndio dele.
4. **Quanto saiu, de fato** — em obra por medição, com parcelas, desconto e
   encargo, a nota diz o previsto e o comprovante diz o executado. É o insumo do
   teto do mínimo (§3 de 17/08) e da separação principal × encargos (§3).

## 3. Fiscalização de ganho de capital — o que é efetivamente exigido

`[Likely]`, com o número/procedimento a **confirmar na legislação e no roteiro
vigente do ano**:

- **PJ com NF**: a nota é o documento central. Prova de pagamento costuma ser
  pedida como corroboração — mais provável quanto maior o valor e quanto mais
  parcelado o pagamento. Nota sem pagamento comprovado é glosa defensável pelo
  Fisco, não glosa automática.
- **PF com recibo**: aqui não há "pedem ou não". `[Certain]` O recibo isolado é
  prova frágil por natureza e a exigência do rastro bancário é o padrão. **O
  comprovante não é opcional neste caminho.**
- Agravante do caminho PF: o mesmo desembolso alimenta a ficha **Pagamentos
  Efetuados**, CPF por CPF. Um lançamento lá sem lastro bancário expõe **duas**
  frentes, não uma.

## 4. O custo real de torná-lo opcional — e é aqui que mora o buraco

`[Certain]` O prazo de guarda deste projeto é o do parecer de 16/08: venda em
2028 → **31/12/2034**, quase sete anos, com o relógio previdenciário do CNO
correndo por fora e prazo **indefinido** se a obra não for vendida.

`[Likely, confirmar]` A retenção bancária obrigatória é de **cinco anos**, e o
comprovante de PIX some da timeline do app do banco bem antes disso. **Os dois
relógios não coincidem**: existe uma janela real em que a fiscalização é
possível e o documento já não é recuperável — ou só é a custo alto, por pedido
formal ao banco.

Isso é **exatamente** a meta 3, e é o argumento decisivo: o comprovante é o
documento **mais perecível** do acervo e o **único** que o app pode capturar de
graça no instante em que existe. Tornar opcional o único documento que expira
sozinho é o pior recorte possível de flexibilização.

## 5. Recomendação — obrigatório com escape nomeado, e o escape já existe

**Não é "opcional com aviso", e não é bloqueio duro.** `[Certain]` A regra correta
é a que este parecer já fixou no §4 e que o mock aplica **só no caminho da
confirmação de compromisso**:

> *Nunca recuse o registro de um fato consumado.* Grava sem comprovante, **não
> entra no custo confirmado**, e vira a pendência **"pago sem comprovante"**.

⚠️ **Defeito no mock, a corrigir**: no formulário de pagamento direto
(`design/mocks/CONTAI-019.html`, `btnGravar.disabled = !fAnexo.checked`, e o
rótulo *"Anexe o comprovante para salvar"*) a gravação está **bloqueada**. Isso
contradiz o caminho da confirmação, para o **mesmo fato do mundo**. Dois pesos
para o mesmo pagamento ensinam que a regra é do app, não do fisco — e o atrito
empurra para não registrar, que é a falha da meta 1. **O botão grava sempre; o
que muda é o estado que nasce.**

**Diferença por favorecido** `[Certain]`:

| Caminho | Estado sem comprovante | Texto da pendência |
|---|---|---|
| **PJ com NF** | pendência **amarela**; não compõe custo confirmado até anexar | *"pago sem comprovante — o custo existe, ainda não está demonstrável"* |
| **PF com recibo** | pendência **vermelha**, no mesmo peso de "pago sem nota" | *"sem o comprovante da transferência, este recibo não sustenta custo nenhum"* |

**Diferença por meio de pagamento** `[Certain]`:

- **PIX**: exigir no ato — é o mais perecível (§4). Comprovante do app do banco.
- **Boleto**: o comprovante é o **pago**, nunca o boleto emitido. Boleto não é
  documento hábil nem depois de pago (§4) — anexá-lo não satisfaz a exigência.
- **Cartão**: ⚠️ **a compra não tem comprovante e nunca terá.** Pelo §B, a compra
  nasce compromisso; o pagamento só existe quando a **fatura** é paga, e o
  comprovante é o **da fatura** — **um documento para N pagamentos**. O modelo
  "um anexo por pagamento" quebra aqui. Exigir comprovante por compra no cartão é
  pedir um papel que não existe, e é falha de modelagem, não do usuário.

## 6. Relação com o `CLAUDE.md`

A premissa *"anexo obrigatório no ato do registro"* **sobrevive**, com o mesmo
recorte do §4: obrigatória para **fato consumado**, com **escape nomeado que
grava em pendência**. Ela nunca foi bloqueio de gravação — foi lida assim no
mock. Se o `CLAUDE.md` for tocado, que a linha diga *"anexo exigido no ato do
registro; ausência grava como pendência fiscal explícita, nunca recusa o
registro"*.

## 7. Automático × humano

**Sistema sozinho** `[Certain]`: gravar sempre; classificar o estado por tipo de
favorecido; manter pagamento sem comprovante fora do custo confirmado; cobrar o
anexo faltante na revisão anual; tratar o comprovante da fatura de cartão como
compartilhado.

**Só o Mateus**: anexar o que só ele tem acesso, enquanto o banco ainda mostra.

**Exige CRC** `[Certain]`: o peso probatório de nota de PJ sem comprovante de
pagamento em glosa de custo de aquisição; e a suficiência do extrato bancário
como substituto do comprovante avulso.

## F. Diferença não explicada — o conjunto fechado de resoluções e o texto de tela

- **Origem**: duas perguntas do `po` a partir do desenho do `designer` (2026-08-18).
- **Normativo para**: a tela de resolução da diferença no `CONTAI-019`, e o texto
  da frase substituta em produção no `CONTAI-018`.

### F.1 "Era principal" não aumenta o custo hoje — mas não é no-op, e o botão fica

**Confirmado no cálculo, corrigido na conclusão** `[Certain]`.

No caso (compromisso R$ 10.000, nota hábil R$ 10.000, pago R$ 10.500, R$ 200 de
encargo, R$ 300 sem explicação): o custo comprovado é
`min(Σ pagamentos elegíveis, Σ documentos hábeis) = min(10.300, 10.000) = 10.000`.
Dizer "os R$ 300 eram principal" **não move o custo confirmado**, porque o teto é
a nota. Até aí, a leitura do `po` está certa.

**O que está errado é concluir que a opção é mentira e deve sair da tela.** Ela
muda duas coisas, e as duas são fiscais:

1. **Muda o alerta.** Encargo é dinheiro que fica fora do custo **para sempre** e
   **não é pendência** — não há o que cobrar de ninguém. Principal sem nota é
   **custo real ainda não comprovável**: vira **"pago sem nota"**, que é risco
   registrado e cobrança a fazer **enquanto ainda há parcela a liberar** (§4 do
   parecer de 17/08 — "some o alerta" está listado lá como dano, não como
   detalhe). Classificar principal como encargo **subestima o custo em definitivo
   e mata a cobrança da nota**.
2. **Muda o número depois.** Chegando a nota do aditivo de R$ 300, o teto vira
   `min(10.300, 10.300) = 10.300`. A classificação de hoje é o que decide se esse
   custo é recuperável amanhã.

**A mentira não está no botão — está em prometer aumento de custo no ato.** A
tela não pode sugerir "+R$ 300 no custo"; tem que dizer que o número não se move
hoje e **o que o move** (a nota).

### F.2 O conjunto fechado — quatro resoluções, rotuladas pelo resultado

Rotular pelo **resultado, não pela causa** (mesma razão do §D): ele não tem de
caracterizar juridicamente nada.

| Resolução | Efeito no custo | Resíduo |
|---|---|---|
| **1. Não compõe custo da obra** — juros, multa de mora, taxa, ou item não incorporado ao imóvel | fica fora, **definitivamente** | registrado, **sem pendência** — nada a cobrar |
| **2. É da obra e falta o documento** | fica fora **hoje**; entra quando houver nota hábil no CPF dele que o cubra | **"pago sem nota"** pelo valor da diferença — pendência acionável |
| **3. O pagamento cobriu mais de um documento** | **único caminho que aumenta o custo no ato**, se o outro documento hábil já estiver no acervo | resolve-se por **vínculo**, não por classificação |
| **4. Errei o valor digitado** | não é classificação fiscal | **correção do registro**, com rastro — `CONTAI-021` |

Notas de fechamento `[Certain]`:

- **A opção 3 é a que faltava na leitura do `po`** e é caso comum da obra: um PIX
  cobrindo duas compras do mesmo favorecido. Sem ela, o Mateus é empurrado para a
  1 ou a 2 e **perde custo real que já está comprovado no acervo**.
- **Causas diferentes com o mesmo efeito colapsam numa opção só** (mora e "não é
  da obra" falham condições diferentes do §1 de 17/08 — a 2 e a lista de
  exclusões — e produzem resultado idêntico).
- ⚠️ **"Não sei ainda" é estado permitido e é o único que pode ser o estado
  inicial**, porque é o único que não afirma nada. Forçar classificação ensina a
  inventar dado no campo que sobrou. A diferença sem resposta fica **fora do
  custo** — direção segura, subestima.
- **Diferença sem resposta NÃO bloqueia o relatório anual** (ao contrário do
  compromisso vencido do §A): aqui o fato consumado já está registrado e o erro
  possível só subestima. Ela entra na **lista de revisão pré-declaração**.

### F.3 Ordem de cálculo, que é onde o erro caro mora

`[Certain]` **O encargo sai do pagamento ANTES do teto do mínimo, nunca depois.**
Primeiro `pagamento elegível = pago − encargos`, depois
`min(Σ elegíveis, Σ documentos hábeis)`.

Prova de que a ordem não é cosmética: nota de R$ 10.400, pago R$ 10.500 com
R$ 500 de mora. Na ordem certa: `min(10.000, 10.400) = 10.000`. Na ordem
invertida: `min(10.500, 10.400) = 10.400` — **R$ 400 de mora entrando como obra**,
que é o risco nº 1 do pre-mortem do ticket, acontecendo dentro da fórmula.

### F.4 Texto de tela — substitui a minuta do `designer`

A minuta (*"Saiu R$ 300,00 a mais que o previsto…"*) **não vai para a tela**, por
um motivo fiscal: ancora a consequência no **previsto**, e a previsão não decide
custo nenhum — quem limita o custo é o **documento hábil**. No exemplo os dois
valores coincidem e o erro fica invisível; com previsto de R$ 9.000 e nota de
R$ 10.000, a frase estaria fiscalmente errada em tela.

**Texto que vai para a tela, literal:**

> **R$ 300,00 do que você pagou ainda estão sem explicação.**
> Enquanto estiverem, ficam fora do custo de aquisição. Se forem juros, multa ou
> algo que não é da obra, ficam fora para sempre — e não há o que cobrar. Se
> forem obra, entram no custo quando houver nota no seu CPF que os cubra; até
> lá, contam como pago sem nota.

Por que assim: ancora no **pagamento**, não na previsão; diz **por que** o número
é o que é e **o que o muda** (§5.1 do parecer de 17/08 — "o zero nunca aparece
sozinho"); nomeia as duas saídas sem pedir que ele caracterize a causa; e não usa
"regime de caixa" nem "previsto/efetivado" (critério 7). Densidade cabe: esta é
tela de **gestão**, em casa e sentado (régua de 18/08).

### F.5 A frase substituta do CONTAI-018 — aprovada como está

> **"A data que vale para o custo é a do pagamento, não a da nota. Nota de
> dezembro paga em janeiro é custo do ano seguinte."**

`[Certain]` Fiscalmente correta nas duas sentenças, e a segunda **não é texto
novo**: é o §4 do parecer de 17/08 em linguagem de tela ("nota de dezembro paga
em janeiro quebra o regime de caixa em dois anos ao mesmo tempo"). **O exemplo
fica** — é ele que ensina; a sentença abstrata sozinha é esquecível, e errar o
ano é o item 3 do pre-mortem do `CONTAI-019`.

# ADENDO 3 — 2026-08-18 · três ratificações que travam o Gate 1b do CONTAI-019

- **Origem**: três perguntas do `lead-engineer`/`cto-obra` no Gate 1b do `CONTAI-019`.
- **Normativo para**: os textos de tela do `CONTAI-019`. Substitui, onde
  divergir, o bloco literal do §C(b) e a tabela do ADENDO 2 §5.

## G.1 "compromisso" × "agendamento" — autorizado trocar na tela

**Autorizado** `[Certain]`. É vocabulário de interface, não substância: as duas
palavras nomeiam a mesma entidade — obrigação futura **não paga**, custo **zero**
até o pagamento (§1). A consequência descrita na pergunta não muda nada. Uma
palavra que aparece **num único lugar** do produto não ensina, ela confunde: o
usuário não sabe se "compromisso" é outra coisa que ele não conhece.

⚠️ **Isto contraria o §C(b) e o critério 38 na forma, não no conteúdo.** O que o
§C(b) fixa é que este texto **não é reescrito por quem implementa** — a
literalidade continua valendo, com a redação abaixo no lugar da anterior.

**Mantém-se "compromisso"** no parecer, no modelo de dados e nos nomes de código.
Termo de domínio e termo de tela não precisam coincidir; **não** se traduz o
schema.

**Texto literal — substitui o bloco do §C(b):**

> **Este pagamento quita o agendamento de 15/09/2026?**
> WK Construções — previsto R$ 25.000,00 para 15/09/2026
> [ Sim, quita este agendamento ]  [ Não, é outro pagamento ]
> Se não quitar, o agendamento continua em aberto e este pagamento fica
> registrado sozinho.

A troca vale para **todas as quatro linhas** do bloco, inclusive os rótulos dos
botões e a consequência — meia troca deixa a tela bilíngue dentro do mesmo card.

## G.2 Data com ano — dd/MM/aaaa, e em todo texto literal deste parecer

**Autorizado, e vale para todos** `[Certain]`, não só para este texto.

A razão não é estética: o invariante central do produto é **regime de caixa** —
a data do pagamento **decide o exercício**. Data sem ano num sistema assim é
defeito onde quer que apareça, e o §C(a)(3) tirou de propósito o recorte de
ano-calendário do gatilho justamente porque o par **28/12/2025 → 05/01/2026** é
onde a duplicidade custa mais caro. Perguntar *"quita o agendamento de 28/12?"*
na tela de janeiro é esconder do usuário exatamente o dado que ele precisa para
responder.

**Regra**: todo texto de tela deste parecer que exiba data de compromisso ou de
pagamento usa **dd/MM/aaaa**. Não há caso em que omitir o ano ajude. Os quatro
caracteres extras cabem nos 375px, e esta é tela de gestão (régua de 18/08).

## G.3 "Pago sem comprovante" com favorecido de tipo desconhecido

**Vermelho ratificado** `[Certain]`, e pelo motivo que o `lead-engineer` deu, que
é o correto: sem saber o tipo, não dá para **descartar** o caminho PF, em que o
comprovante é **constitutivo** do custo (ADENDO 2 §1). Subestimar o peso de uma
pendência é o erro que faz ela não ser resolvida; superestimar custa um anexo a
mais. Mesma direção segura já fixada para o `DESCONHECIDO` do `CONTAI-001`.

O texto **não afirma consequência fiscal** — está certo que não afirme: afirmar
qual dos dois regimes se aplica, sem saber o tipo, seria inventar fato. Ele
nomeia a incerteza e **pede o dado que a resolve**.

**Terceira linha da tabela do ADENDO 2 §5 — texto literal:**

| Caminho | Estado sem comprovante | Texto da pendência |
|---|---|---|
| **Tipo do favorecido ainda não conhecido** | pendência **vermelha**, pelo pior caso (o caminho PF); não compõe custo confirmado | *"sem o comprovante não dá para dizer o quanto este pagamento sustenta — informe o CNPJ/CPF do favorecido: para PF o comprovante da transferência é o que constitui o custo"* |

Chip: **"Pago sem comprovante"**, igual às outras duas linhas — o chip nomeia o
fato, que é o mesmo; o que muda é a consequência. **Quando o CNPJ/CPF for
informado, a pendência é reclassificada** para a linha PJ ou PF: vermelho por
desconhecimento é provisório, e não pode virar vermelho permanente de uma
pendência que era amarela.

## G.4 Automático × humano (deste adendo)

**Sistema sozinho** `[Certain]`: aplicar os três textos; reclassificar a
gravidade quando o tipo do favorecido for informado.

**Nada aqui exige CRC** — são decisões de linguagem e de gravidade de aviso, não
de tributação.
