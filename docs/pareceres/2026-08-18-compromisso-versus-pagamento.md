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
