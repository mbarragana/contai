# Relato — 2026-10-10 — pré-vínculo fica invisível em `/despesas` (aparenta "sem pagamento ligado")

## Origem (relato, dor vivida na sessão de suporte)

Contexto real: 3 notas da Ilhamix (1531, 1541, 1543), pagas por PIX + 2
parcelamentos de cartão. Os compromissos de cartão foram criados com
`documentoOrigemId` apontando para a nota 1531, mas também têm
`documentoPrevistoIds` pré-ligando as outras duas (1541, 1543) — pré-vínculo
na forma do ADENDO 6 do parecer de `docs/backlog/96-2026-09-28-pre-vinculo-compromisso-nota-antes-do-pagamento.md`:
intenção pura, sem teto, revisável, exige confirmação explícita do Mateus
("Sim, confirmar os vínculos" ou "Revisar antes de confirmar").

Na lista `/despesas`, as notas 1541 e 1543 aparecem com o chip **"Sem
pagamento ligado"** e CTA "Ligar a um pagamento" — exatamente como uma nota
sem rastro nenhum. Citação da reação do Mateus, ao ver isso numa captura de
tela:

> "mas por que aqui ainda aparece para ligar pagamento e não ver agendamento
> como os outros?"

Depois de receber a explicação técnica (abaixo), a reação foi:

> "mas temos que identificar de alguma forma que já tem algum pagamento
> pré-vinculado aquela nota nesta lista e nas despesas também, porque fica
> parecendo que esta pendente de trabalho meu de inserir os pagamentos"

## Causa técnica (já levantada nesta sessão de suporte, não repetir investigação)

`agendamentosPorDocumento` (`lib/fiscal/compromisso.ts:728-751`) é a função
que decide o badge "Agendado" em `/despesas` (e aparentemente também na
Home). Ela só elege compromissos via `documentoOrigemId` — a linha 735
(`if (c.documentoOrigemId === null) continue;`) descarta por completo
qualquer compromisso que só tenha `documentoPrevistoIds`. Comentário no
código cita `CONTAI-072` ("1 aviso por nota") — é deliberado, não bug.

O detalhe do documento usa outra função, `compromissosQuePreLigam`
(`lib/fiscal/compromisso.ts:1511-1521`), que conta as duas fontes
(`documentoOrigemId` **e** `documentoPrevistoIds`) — por isso abrindo
`/documento/1541` ou `/documento/1543` o bloco de pré-vínculo aparece
normalmente. A lacuna é só na **lista**, não no detalhe.

## Dor extraída

"Sem pagamento ligado" mente por omissão quando já existe uma sugestão de
vínculo esperando confirmação do Mateus: a lista não distingue "nota órfã,
nenhum trabalho feito" de "nota com candidato de pagamento esperando eu
confirmar ou revisar". Isso gera investigação repetida (ele já teve que
reabrir o detalhe do documento para descobrir que não estava realmente
"sem pagamento ligado") e teve mais de uma ocorrência nesta sessão.

## Classificação

**Fricção de processo — P1.** Não é erro fiscal (o dado correto existe e é
usado certo na aferição/discriminação; o que está errado é só a leitura
visual da lista). Mas é recorrente, gera trabalho de investigação repetido e
já confundiu o Mateus mais de uma vez na mesma sessão — qualifica como
fricção séria, não conveniência.

## Filtro de escopo do PO

Serve à meta 1 (nenhum pagamento sem documento hábil) de forma indireta: a
lista de pendências é o painel que orienta o Mateus a agir, e um estado que
mente por omissão o leva a investigar ou agir em cima de algo que já tem
candidato de resolução — desperdício de atenção na tela que deveria
priorizar o que realmente falta. Não é mudança de cálculo fiscal nem de
critério de elegibilidade de pagamento — é puramente uma questão de
**visibilidade/exibição** na lista.

Fora de escopo deste relato, deliberadamente:
- **Mudar a doutrina do ADENDO 6** (pré-vínculo continua sem teto, continua
  exigindo confirmação explícita, continua revisável). Este relato é só
  sobre o Mateus *ver* que o candidato existe — nunca sobre auto-confirmar
  nada.
- **Reaproveitar o badge "Agendado" existente** para o caso de pré-vínculo.
  Isso seria o erro espelhado: diria que algo está "agendado" (fechado,
  com teto) quando na verdade é só candidato, sujeito a confirmação ou
  revisão — a mesma categoria de confusão que já apareceu no caso Ilhamix
  quando a soma de pré-vínculo passava longe do valor da nota por falta de
  teto (ver `docs/backlog/96-...md`). Precisa de um **terceiro estado
  visual**, distinto de "Sem pagamento ligado" e de "Agendado".
- Gestão de cronograma de obra, orçamento vs. realizado de engenharia,
  comunicação com empreiteiro — fora de escopo do produto, não aplicável
  aqui mas reafirmado por disciplina.

## User story (preliminar)

**Como** o Mateus, gerenciando a obra em casa, sentado, revisando
`/despesas` antes de decidir o que fazer,
**quando** uma nota já tem um compromisso de pagamento pré-vinculado a ela
(via `documentoPrevistoIds`, ainda não confirmado),
**eu quero** ver um estado distinto de "Sem pagamento ligado" — algo como
"Pagamento sugerido, aguardando confirmação" —
**para que** eu não gaste tempo investigando ou tentando "ligar um
pagamento do zero" numa nota que já tem um candidato esperando minha decisão,
e para que o CTA me leve direto à confirmação/revisão do vínculo, não ao
fluxo de vínculo manual.

### Critérios de aceite (verificáveis)

1. Em `/despesas`, uma nota com pelo menos um compromisso cujo
   `documentoPrevistoIds` a referencia (e que ainda não tem
   `documentoOrigemId` confirmado apontando para ela) exibe um chip
   diferente de "Sem pagamento ligado" e diferente de "Agendado" — texto
   final a definir no `/design`, mas semanticamente "sugerido, aguardando
   confirmação".
2. O CTA desse novo estado abre a confirmação/revisão do pré-vínculo
   (equivalente ao que `compromissosQuePreLigam` já expõe no detalhe do
   documento), não o fluxo de "ligar a um pagamento" do zero.
3. Uma nota sem nenhum compromisso referenciando-a (nem por
   `documentoOrigemId`, nem por `documentoPrevistoIds`) continua mostrando
   "Sem pagamento ligado" exatamente como hoje — este ticket não pode
   reduzir a precisão do caso genuinamente órfão.
4. Uma nota com `documentoOrigemId` confirmado continua mostrando
   "Agendado" exatamente como hoje — este ticket não toca esse caminho.
5. `/documento/[id]` (o detalhe) não muda de comportamento — a lacuna era só
   na lista.

## Escopo a decidir antes do ticket (registrar para `/tickets-req`)

- **Onde o terceiro estado aparece**: só `/despesas`, ou também a Home (ela
  usa a mesma `agendamentosPorDocumento`)? Produto não decidiu aqui.
- **Pergunta técnica para o `cto-obra`**: isto é só uma terceira categoria
  de exibição ao lado do que `agendamentosPorDocumento` já retorna, ou exige
  mudar a função em si (e por extensão o critério de elegibilidade que
  outras telas consomem)? Hipótese do PO é que é só exibição — mas quem
  decide é o `cto-obra` em vista do código real.
- Texto exato do chip/estado e desenho do CTA: trabalho do `designer`, não
  decidido aqui.

## Perguntas de esclarecimento ao Mateus

Nenhuma — o relato já trouxe fato e reação suficientes para gerar a story.
As duas decisões de escopo acima (Home ou não; exibição vs. critério) vão
para o `/tickets-req` resolver com `cto-obra`/`designer`, não são perguntas
que bloqueiam o registro no backlog.

## O que fica de fora, e por quê

- Mudar a doutrina de teto/confirmação do pré-vínculo (ADENDO 6) — não é o
  que o Mateus pediu; ele pediu visibilidade, não comportamento novo de
  confirmação automática.
- Reaproveitar "Agendado" para pré-vínculo — rejeitado explicitamente acima,
  é o erro espelhado da mesma categoria que gerou o caso Ilhamix.
- Resolver no Home vs. só Despesas — fica como pergunta aberta para o
  `cto-obra`/`designer` no `/tickets-req`, não decidida aqui.
