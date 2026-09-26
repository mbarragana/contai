# Parecer fiscal — pagamento sem data, filtro por ano-calendário e regime de caixa (CONTAI-060)

- **Data**: 2026-09-26 · **Autor**: agente `contador`, execução read-only
- **Provocação**: o `cto-obra`, desenhando o seletor de ano de `/despesas`
  (CONTAI-060, ver `docs/backlog/73-2026-09-26-texto-pendencia-retencao-e-escopo-ano-despesas.md`,
  Achado 2), perguntou como uma linha sem `dataPagamento` (nota órfã, captura
  incompleta) deve se comportar quando o filtro por ano-calendário existir, e
  propôs: ela aparece em TODO ano, nunca escondida pelo filtro.
- **Consome**: o próprio Achado 2 da entrada `73-…`, já com veredito do
  `contador` sobre "delta do ano" vs. "acumulado até uma data" serem as duas
  únicas grandezas fiscalmente válidas, e "somar tudo sem filtro, incluindo
  sem data" não ser uma terceira grandeza válida.

> Marcações `[Certain]` / `[Likely]` / `[Guessing]` seguem a convenção do
> projeto. Nada aqui substitui contador humano (CRC) na assinatura da
> declaração.

## Veredito

[Certain] **Ratifico o princípio — pendência não pode desaparecer atrás de um
filtro de ano — mas preciso separar duas coisas que a frase "aparece em TODO
ano" junta, porque só uma delas é fiscalmente correta.**

O regime de caixa (IN SRF 84/2001, art. 17) exige a **data do pagamento** para
decidir a que ano-calendário um gasto pertence. Uma linha sem essa data não
"pertence a todos os anos" — ela **não pertence a nenhum ano ainda**, porque
falta o dado que faria essa atribuição. Tratá-la como pertencente a todo ano
seria dar a ela um destino fiscal (implicitamente: "conta para este ano
também") sem a prova que o regime de caixa exige para isso — e abriria risco
de contagem duplicada se algum total futuro somar por ano sem excluir
explicitamente as linhas sem data.

A regra correta tem duas partes, e as duas já estão parcialmente escritas em
lugares diferentes — este parecer as junta:

1. **Nunca soma em nenhum total monetário exibido como confiável** — nem no
   delta do ano selecionado (`custoConfirmadoAnoCentavos`), nem no acumulado
   (`acumuladoImovelCentavos`). Isto já é critério de aceite explícito na
   entrada `73-…` (US-B: "Pagamento sem data de pagamento registrada não
   entra silenciosamente em nenhum dos dois totais"). Este parecer confirma
   que esse critério está fiscalmente certo e não deve ser enfraquecido.
2. **Nunca some (some = desaparece) da tela ao trocar de ano** — aqui está o
   ponto novo que o `cto-obra` trouxe. A linha continua **visível como
   pendência de captura**, constante, independentemente de qual ano-calendário
   está selecionado no filtro. Isto é a mesma disciplina que o produto já
   aplica a outras pendências (campo vazio pergunta, nunca esconde) aplicada a
   um campo que também é fiscal (a data de pagamento é a chave do regime de
   caixa) — só que faltando.

A diferença prática para o `cto-obra`/`lead-engineer`: a linha **não entra em
nenhuma soma por ano**, mas **aparece sempre na lista/seção de pendências**,
sem filtro de ano se aplicar a ela. Não é "pertence a todo ano" (existencial,
sobre o dado) — é "visível em toda visão de ano" (sobre a interface). A
distinção evita que uma implementação apressada some a linha em todo ano por
engano, lendo a frase do jeito errado.

## Por que isto não é uma terceira grandeza fiscal

Já estabelecido no Achado 2 da entrada `73-…`, e reafirmado aqui: dado sem
data não é uma visão fiscal alternativa (não é "acumulado sem corte", não é
"delta de um ano hipotético") — é **pendência de captura**, no mesmo balde
conceitual de nota sem anexo ou documento sem CPF do prestador. A diferença é
só o campo que falta. O tratamento de produto deve refletir isso: local de
pendência, não card de totalização.

## Alcance da regra

Vale para `/despesas` (objeto imediato do CONTAI-060) e para qualquer outra
tela que ganhe filtro por ano-calendário no futuro (a Home já tem
`acumuladoImovelCentavos`/`custoConfirmadoAnoCentavos` como as duas grandezas
válidas; `/pendencias`, quando ganhar o mesmo seletor por força do
`docs/backlog/48-2026-09-21-gate1-decisoes-contai-040.md`, herda a mesma
regra). Não é regra específica de uma tela — é regra do regime de caixa
aplicada a dado incompleto, e deveria ser codificada uma vez (ex.: no
provedor de estado do ano compartilhado que o `cto-obra` já está desenhando
para o CONTAI-060) em vez de reimplementada tela por tela.

## O que este parecer NÃO decide

- Onde a pendência aparece na tela (seção separada, badge, aba) — é
  `designer`.
- Se o filtro por ano vive num contexto único compartilhado entre
  Home/`/despesas`/`/pendencias` ou outro mecanismo — é arquitetura do
  `cto-obra`, já registrado como dependência aberta na entrada `73-…`.

**O contai redige, dateia e organiza. Não assina.**
