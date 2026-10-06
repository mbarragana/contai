# Herdar favorecido/CNPJ/valor por TEXTO (não por vínculo) no criador em lote de parcelas — 2026-10-05

## Relato

Mateus, registrando um pagamento parcelado no cartão a partir de uma nota já
cadastrada, seguiu o caminho **documento → "Adicionar pagamento" → "Cartão" →
"Definir parcelas"** — ou seja, chegou em
`/adicionar/compra-cartao/parcelas` vindo de
`/adicionar/compra-cartao?documento=<id>`, que por sua vez veio da tela do
documento. Citação: *"eu fui na nota e cliquei em adicionar pagamento e
depois cartao e depois definir parcelas"* — esperando chegar com favorecido,
CNPJ/CPF e valor total já preenchidos, e não chegou.

## Dor extraída

Fricção de digitação: ele tinha acabado de identificar a nota de origem (é
assim que chega em `/adicionar/compra-cartao?documento=<id>` — herança já
resolvida ali pelo `CONTAI-064`/`071`), mas o link "Lançar as parcelas em
lote →" (sob o banner `RECUSA_PARCELADO`, critério 3 do `CONTAI-084`) larga o
parâmetro no caminho por desenho, e ele teve que redigitar favorecido,
CNPJ/CPF e valor total na Tela 1 do lote.

## O que já está decidido e não está em questão

- `/adicionar/compra-cartao/parcelas` **nunca lê `documento_origem_id` para
  vínculo** e nenhuma das N parcelas geradas recebe esse campo — critério 2 e
  10 do `CONTAI-084`, ratificado pelo `contador` (ADENDO 9 do parecer
  `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`). Motivo: herança
  em massa de origem, mesmo para uma nota única que cobre o valor total,
  escalaria o mesmo bug do `CONTAI-083` (Ilhamix, N compromissos presos à
  mesma origem sem revalidação individual no pagamento).
- Confirmado com o Mateus nesta conversa: ele **não** quer as parcelas
  vinculadas à nota — já reconhece essa recusa como correta. Ele quer só
  **preenchimento de texto** (favorecido/CNPJ/valor) por conveniência de
  digitação. É uma distinção real e deliberada: pré-preencher um campo de
  texto não é o mesmo ato que gravar `documento_origem_id` no banco.
- `/adicionar/compra-cartao` (tela individual) já tem a herança completa via
  `?documento=` desde o `CONTAI-064`/`071` — essa tela não muda.

## Classificação

**P2 — conveniência.** Não bloqueia: ele preenche manualmente hoje e o fluxo
funciona. Vira story porque é dor repetida (mesmo padrão de "fornecedor com
várias parcelas" que motivou o `CONTAI-084` originalmente) e porque o risco de
implementação errada (vazar vínculo) é real e precisa de critério explícito
contra ele.

## User Story (preliminar)

Como dono da obra, sentado em casa, quando eu chegar em
`/adicionar/compra-cartao/parcelas` a partir de uma nota já identificada (via
`/adicionar/compra-cartao?documento=<id>`, ou do jeito que o `cto-obra`
decidir carregar o contexto), quero que a Tela 1 já venha com Favorecido
(nome), CNPJ/CPF e Valor total preenchidos a partir dessa nota, continuando
livre para editar qualquer um dos três antes de gerar as parcelas, para não
redigitar o que já informei na tela anterior.

## Critérios de aceite (preliminares)

1. Favorecido (nome), CNPJ/CPF e Valor total da Tela 1 vêm pré-preenchidos
   quando a navegação carrega contexto de um documento de origem — mesmos três
   campos que `/adicionar/compra-cartao?documento=<id>` já pré-preenche hoje
   (`CONTAI-064`), aplicados à Tela 1 do lote.
2. **Nenhuma das N parcelas geradas recebe `documento_origem_id` nem qualquer
   outro campo de vínculo/origem, em nenhuma circunstância** — isso reforça,
   não reabre, o critério 2/10 do `CONTAI-084`. Pré-preencher o TEXTO do
   favorecido não é licença para também preencher o vínculo: são atos
   diferentes, e fazer o segundo sem pedir é violação de doutrina, não
   melhoria.
3. Os três campos pré-preenchidos continuam editáveis como qualquer campo da
   Tela 1 hoje — nenhum fica travado/read-only por ter vindo de uma nota.
4. Verificável por E2E: gerar um lote a partir de um documento de origem e
   confirmar que as N linhas de `compromisso` gravadas têm
   `documento_origem_id = null` em todas, mesmo com favorecido/CNPJ/valor
   herdados por texto.

## Gate Fiscal — sinalizar ao `contador` no próximo `/tickets-req`

Pedir confirmação explícita (deve ser rápida, mas não pular): pré-preencher
TEXTO (favorecido/CNPJ/valor), sem tocar `documento_origem_id`, não reabre
nenhuma questão do ADENDO 9 do `CONTAI-084`. A expectativa é que não — é a
mesma distinção que o parecer já faz entre "dado replicado por conveniência de
digitação" e "vínculo fiscal gravado" —, mas a confirmação formal fica
registrada antes de virar critério fechado de ticket.

## Out of scope explícito

- Qualquer forma de vínculo/origem automático nas parcelas do lote — a recusa
  do `CONTAI-084`/ADENDO 9 está intocada; isto aqui é puramente herança de
  texto para digitação.
- Mudar o comportamento de `/adicionar/compra-cartao` (tela individual) — já
  funciona (`CONTAI-064`/`071`), não é tocada por este relato.
- Fundir as N parcelas num evento fiscal único — fora de escopo desde o
  `CONTAI-084` (`RECUSA_PARCELADO`), não revisitado aqui.

## Perguntas abertas

1. **RESPONDIDA em 2026-10-06 — ficam em branco.** "Data da compra" e
   "Vencimento da 1ª fatura" NÃO herdam da nota. Decisão do Mateus: a data de
   emissão da nota raramente é a data certa de vencimento da 1ª fatura do
   cartão — melhor ele escolher. Critério 1 acima fica restrito aos três
   campos (favorecido/CNPJ/valor); datas continuam só manuais, como hoje.
2. Hoje o link de entrada do lote fica sob o banner `RECUSA_PARCELADO` em
   `compra-cartao/page.tsx`, acessível só a partir da tela **individual** de
   cartão. Para o caminho citado no relato funcionar (nota → pagamento →
   cartão → parcelas), esse link precisa carregar o contexto do documento de
   origem (ex. `?documento=<id>` na própria URL do link, sem a rota de
   parcelas *ler* isso como vínculo — só como dado de pré-preenchimento). Fica
   como decisão de implementação do `cto-obra`, mas registrando para não
   escapar do próximo Gate 2: "carregar contexto" e "ler para vínculo" têm que
   ser mecanismos visivelmente diferentes no código, não a mesma leitura
   reaproveitada.
3. Nenhuma pergunta pendente de resposta do Mateus para destravar o Gate 0 —
   as duas acima são de desenho técnico/fiscal, não de preferência de produto.
