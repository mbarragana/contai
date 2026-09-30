# Desvincular origem herdada de compromisso — 2026-09-30 — relato + investigação em produção

## Relato

Mateus, em conversa, confirmado por query read-only em produção:

> pediu a capacidade de "desvincular um agendamento de uma nota", explicando
> que vinculou 3 agendamentos de R$15.000 a uma nota de R$30.000 e está
> preocupado que o sistema "distribua automaticamente" o valor.

## Investigação (read-only, favorecido "Ilhamix Concreto Ltda")

- 4 compromissos desse favorecido: 3 `situacao='aberto'`, R$15.000,00 cada
  (vencimentos 15/10, 15/11, 15/12/2026), e 1 `situacao='cancelado'`
  (R$25.340,00).
- **Os 3 compromissos abertos têm o mesmo `documento_origem_id`**, apontando
  para a NF de serviço nº 1531 (R$30.340,00). Não é o pré-vínculo editável do
  `CONTAI-080`/`081` (`compromisso_documento_previsto`, tela
  `/compromisso/[id]/pre-vincular`) — é a **origem herdada** do
  `CONTAI-064`/`065` (`compromisso.documento_origem_id`), que a própria tela
  de pré-vínculo documenta como *"não editável aqui... única e imutável desde
  a criação do agendamento"* (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md:1117`,
  `docs/tickets/CONTAI-080.md:129`). **Não existe hoje nenhuma tela que mude ou
  remova esse campo depois de criado.**
- As outras 2 notas do mesmo favorecido (NF 1541, R$29.760,00; NF 1543,
  R$16.240,00) estão sem pagamento vinculado e **vão continuar assim
  indefinidamente**: as 3 parcelas de R$15.000 só "conhecem" a 1531 via
  origem; quando forem pagas, cada uma resolve N=1 (só a origem, nenhum
  pré-vínculo) e o sistema vincula automaticamente à 1531 nas 3 vezes (regra
  do ADENDO 7 §K.2, ratificada no `CONTAI-080`/`081`). O `min()` de
  `alocarCusto` evita contar em dobro (R$45.000 pagos vs. R$30.340 de nota,
  custo comprovado trava em R$30.340), mas as notas 1541/1543 nunca recebem
  prova nenhuma, porque nenhuma parcela chega a ser oferecida a elas — o
  `documento_origem_id` fixo é o que impede a oferta.
- **Nada foi pago ainda** (as 3 estão `aberto`) — não há dano fiscal já
  consumado, só o risco de acontecer quando as parcelas forem pagas.

## Dor extraída

Origem herdada imutável impede corrigir um engano real de vínculo
(3 parcelas presas à nota errada), e o engano **não aparece em lugar nenhum
da interface** — só foi visível investigando o banco diretamente. Não é
fricção de uso pontual: é uma distorção real entre notas (uma superavaliada
em prova de pagamento, duas nunca provadas) que vai se consumar sozinha,
sem aviso, no dia em que as parcelas forem pagas.

## Classificação

**P0/P1 — tratado como P0 pelo potencial de consequência fiscal silenciosa,
mas a regra exata (se isso é distorção de custo dedutível ou só de
apresentação/relatório) precisa de adjudicação do `contador` antes de virar
ticket.** Justificativa da cautela:
- Não é uma obrigação fiscal já descumprida (nada pago ainda), por isso não é
  P0 "puro" pela definição do método (perder isso custa imposto ou multa
  *agora*).
- Mas é o tipo de coisa que, se ignorada, produz exatamente o que a meta 2
  do produto (relatórios anuais prontos) existe para evitar: a discriminação
  anual e a ficha Pagamentos Efetuados podem acabar refletindo uma nota
  "provada" com pagamento que não é dela e duas notas hábeis nunca
  amarradas a pagamento nenhum — sem que nada na tela tenha avisado o
  Mateus disso antes da declaração.
- A prioridade final (P0 vs. P1) e o "como resolver" ficam para o
  `/tickets-req`, com o `contador` adjudicando se a janela até o pagamento
  das parcelas (15/10, 15/11, 15/12/2026) é urgente o bastante para furar a
  fila atual.

## Gate Fiscal — sinalização para o `/tickets-req`

Isto toca doutrina já fechada em dois lugares e não pode ser decidido aqui:

- **`CONTAI-065`** (propagação automática de `documento_origem_id`) — a
  regra de propagação assume que a origem gravada está correta; nunca previu
  o caso "está errada e precisa ser desfeita".
- **`CONTAI-080`/`081`, ADENDO 6/7/8** do parecer
  `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` — definem
  quando N=1 converte automático (§K.2) e quando N≥2 exige confirmação
  explícita, mas partem de `documento_origem_id` como dado de entrada fixo.
  Uma tela que permite apagar ou trocar esse campo depois de criado é
  mudança de doutrina, não implementação de UI — precisa da mesma adjudicação
  formal que os ADENDOs tiveram.

Perguntas que ficam para o `contador`/`cto-obra` no `/tickets-req`, **não
decididas aqui**:
1. Remover a origem herdada é (a) limpar o campo `documento_origem_id`
   direto, ou (b) converter o compromisso para o mecanismo de pré-vínculo
   N:M (`compromisso_documento_previsto`) já existente, deixando o Mateus
   redeclarar via `/compromisso/[id]/pre-vincular`? Isso é decisão técnica
   de arquitetura, não requisito de produto.
2. Uma vez desfeita a origem, o compromisso fica com N=0 (nenhuma nota
   ligada) até o Mateus pré-vincular de novo, ou herda automaticamente um
   estado intermediário? (Efeito em cascata na regra do §K.2 precisa de
   parecer.)

## User story (preliminar — critérios sujeitos a ajuste do Gate Fiscal)

**Como Mateus, gerenciando a obra em casa, sentado**, quando eu perceber que
vinculei um agendamento à nota errada (origem herdada na criação do
compromisso), **quero poder desfazer esse vínculo**, para que eu mesmo possa
declarar o vínculo correto pela tela de pré-vínculo já existente — em vez de
o sistema confirmar automaticamente, na hora do pagamento, uma ligação que eu
sei que está errada.

Critérios de aceite preliminares (a fechar no `/tickets-req` com
`contador`/`cto-obra`):
- Existe uma ação, em alguma tela de gestão do compromisso, que remove ou
  substitui `documento_origem_id` de um compromisso ainda `aberto`.
- Depois da remoção, o compromisso passa a poder receber pré-vínculo comum
  via `/compromisso/[id]/pre-vincular`, sem resíduo do vínculo antigo.
- A ação é auditável (fica registro de que a origem foi desfeita e por quem/
  quando) — acervo documental não pode perder o histórico de que aquele
  vínculo existiu.
- Nenhuma alteração retroage sobre pagamento já feito (não há, hoje, nenhum
  pagamento feito nesses 3 compromissos — a regra vale para o caso geral).
- A tela de pré-vínculo (ou a home/pendências) passa a **mostrar** quando um
  compromisso `aberto` compartilha `documento_origem_id` com outros
  compromissos do mesmo favorecido e a mesma nota tem valor menor que a soma
  — hoje esse cenário é inteiramente invisível na interface; foi encontrado
  só investigando o banco. (Este critério é candidato a ticket próprio de
  "detecção" separado do de "correção" — decisão do `/tickets-req`.)

## Fora de escopo (explícito)

- **Rateio automático entre notas** — segue recusado; a doutrina do ADENDO 6
  (natureza do pré-vínculo, nunca custo automático) não muda. O Mateus
  continua declarando manualmente qual parcela vai para qual nota.
- **Apagar ou alterar pagamento já feito** — não se aplica a este caso (nenhum
  dos 3 compromissos foi pago), e o acervo é append-only por decisão do
  `CONTAI-009`; nada aqui pede exceção a isso.
- **Regra de qual nota é "a certa" para cada parcela** — o sistema não decide
  isso por conta própria; a decisão continua sendo do Mateus, via
  pré-vínculo declarado.

## Perguntas abertas

Nenhuma pergunta pro Mateus. As duas perguntas técnicas (limpar campo vs.
converter em pré-vínculo; o que acontece com N depois da remoção) são do
`contador`/`cto-obra` no `/tickets-req`, não dele — a decisão de COMO não
precisa do relato original, precisa da doutrina fiscal e do desenho de
schema já existentes.
