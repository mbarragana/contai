# Pré-vínculo automático no lote de parcelas quando a origem já é conhecida — 2026-10-20

## Relato

Caso real, vivido ao vivo nesta sessão. Mateus cadastrou a NF 1726 (Ilhamix
Concreto Ltda, R$12.340,00) pelo fluxo normal de captura e, no mesmo ato,
registrou o pagamento parcelado no cartão (2x de R$6.170,00) usando o botão
"Registrar o pagamento desta nota" (`CONTAI-099`) → Cartão → "Lançar as
parcelas em lote" (`CONTAI-084`/`089`). Ao abrir depois o detalhe da nota, não
viu nenhum pagamento ligado — pareceu que não tinha salvo.

Investigação confirmou: os 2 compromissos salvaram certo (favorecido, valor,
datas), **sem nenhum vínculo com a nota** — nem `documento_origem_id` (correto,
proibido pelo ADENDO 9), nem pré-vínculo (que **não** é proibido, só nunca foi
implementado automaticamente nesse caminho). Causa: o `CONTAI-089` decidiu
deliberadamente herdar só TEXTO (favorecido/CNPJ/valor) no lote, nunca vínculo
— e isso continua certo para o caso que o `089` resolveu (lote acessado a
partir da tela **individual** de cartão, sem documento de origem no contexto).
O caso de hoje é diferente: o lote foi alcançado **a partir de uma nota
específica**, via `CONTAI-099`, que carrega `documento.id` no contexto.

Citação literal do Mateus, depois de entender o que aconteceu: *"vamos fazer
essa pré vinculação já na hora do registro do pagamento, não faz sentido, eu
registrar um pagamento na nota e depois ter que fazer novamente."*

## Dor extraída

Fricção de processo: o Mateus já tinha declarado a origem (clicou em
"Registrar o pagamento desta nota" partindo do documento), mas o produto
descarta essa informação no lote de parcelas e devolve o trabalho de religar
manualmente — um passo por parcela (abrir cada compromisso, "Ligar notas a
este agendamento", marcar, salvar). Para N=2 já irritou; para o padrão real do
`CONTAI-084`/`091` (6-7 parcelas por fornecedor) o custo escala.

## O que já está decidido e não está em questão (escopo fechado pelo Mateus)

- Isto é **pré-vínculo** (`compromisso_documento_previsto`), nunca
  `documento_origem_id` automático em lote — o ADENDO 9 continua proibindo
  exatamente esse segundo campo, e esta story não o reabre.
- Vale quando o lote é alcançado com um `documento.id` de origem explícito no
  contexto (via `CONTAI-099` ou qualquer caminho equivalente) — não é um
  redesenho do fluxo "digitei manualmente, sem nota nenhuma" do `CONTAI-089`,
  que continua sem pré-vínculo (não há de onde tirar o `id`).
- `CONTAI-089` (herdar texto) não é revisto nem desfeito — esta story soma
  vínculo de verdade por cima da herança de texto que já existe, só quando o
  contexto permite.

## Classificação

**P1 — fricção de processo.** Não é dívida fiscal (pré-vínculo nunca é custo,
nunca abate INSS, nunca entra em relatório — ADENDO 6 §J.1/§J.2): não perder
isso não custa imposto nem multa, então não é P0. Mas é dor repetida, vivida ao
vivo, no padrão de maior volume do produto (fornecedor parcelado — mesmo perfil
que motivou `CONTAI-084` e `091`), com risco concreto de a nota aparecer
indevidamente "sem pagamento ligado" em `/despesas` até a confirmação (mesma
classe de confusão que o `CONTAI-091` corrigiu para pré-vínculo já existente —
aqui o pré-vínculo nem chega a existir). Pedido direto do Mateus ("vamos fazer
já"), não inferência do PO.

## User Story (preliminar)

Como dono da obra, sentado em casa, quando eu chegar em
`/adicionar/compra-cartao/parcelas` a partir de uma nota específica (contexto
de `documento.id` carregado — hoje só pelo caminho `CONTAI-099`, "Registrar o
pagamento desta nota"), quero que cada uma das N parcelas geradas nasça **já
com pré-vínculo automático** a essa nota, para não ter que abrir cada
compromisso depois e repetir manualmente uma ligação que eu já declarei no ato
de registrar o pagamento.

## Critérios de aceite (preliminares)

1. Gerar um lote de N parcelas a partir de um documento de origem (contexto
   `documento.id` presente) grava, para cada uma das N linhas de
   `compromisso`, uma linha correspondente em
   `compromisso_documento_previsto` apontando para essa nota — verificável
   lendo a tabela depois do lote confirmado.
2. Nenhuma das N parcelas recebe `documento_origem_id` preenchido em
   nenhuma circunstância — critério que o `CONTAI-089`/ADENDO 9 já fixa e que
   esta story reforça, não reabre. Verificável por E2E: todas as N linhas de
   `compromisso` têm `documento_origem_id = null`.
3. O detalhe da nota de origem passa a mostrar as N parcelas como pré-ligadas
   (mesma superfície do `CONTAI-091` — `compromissosQuePreLigam` — e o chip
   `CHIP_PRE_VINCULO` nas 3 superfícies já existentes), sem precisar de ação
   manual adicional depois do lote salvo.
4. O pré-vínculo criado continua **revisável/desfazível** antes da
   confirmação de pagamento de cada parcela, pela tela `/pre-vincular`
   existente (`CONTAI-080`/`081`) — esta story não cria um pré-vínculo
   travado, só um pré-vínculo que nasce preenchido em vez de nascer vazio.
5. Fora do contexto `documento.id` (lote acessado sem nota de origem, caminho
   atual do `CONTAI-089`), nada muda: zero pré-vínculo criado, como hoje.

## Gate Fiscal — flag para o `contador` no próximo `/tickets-req`

Pedir confirmação explícita, com dois pontos específicos:

1. **A premissa central do relato** — que pré-vínculo automático em lote não
   reabre o ADENDO 9, porque pré-vínculo nunca é custo/base/relatório (ADENDO
   6 §J.1) e o ADENDO 9 só proíbe `documento_origem_id` automático (que
   converte sem segunda chance). Pedir que o `contador` confirme isso com
   fundamento no próprio parecer, não que valide por inferência do PO.
2. **Achado novo, levantado nesta análise, que o relato não menciona**: pelo
   ADENDO 7 §K.2/§K.5 do mesmo parecer, um pré-vínculo que resolve para
   **N=1 no momento da confirmação do pagamento converte automaticamente,
   sem clique** — é a doutrina já em produção desde o `CONTAI-065`/`080`/`081`.
   Como cada parcela do lote proposto nasce pré-vinculada a exatamente 1 nota
   (a de origem), cada confirmação de pagamento de parcela vai converter esse
   pré-vínculo em vínculo real **sem pedir confirmação de novo** — mesmo
   mecanismo de qualquer pré-vínculo manual hoje, não um comportamento novo
   criado por este ticket. Pedir ao `contador` para confirmar que isto **não**
   recria o cenário do `CONTAI-083`/ADENDO 9 (onde N=1 convertia sozinho para
   a nota ERRADA, repetidamente, sem revalidação) — a leitura do PO é que não
   recria, porque aqui a nota é a que o próprio Mateus escolheu no ato (botão
   da nota, não herança cega de tela antiga), mas isso é leitura do PO, não
   carimbo fiscal.

## Perguntas abertas (para o pipeline, não para o Mateus — ele já deu a direção)

1. Confirmar com o `cto-obra`: o único gatilho hoje para existir
   `documento.id` no contexto do lote é o caminho `CONTAI-099` → Cartão →
   "Lançar parcelas em lote", ou existe algum outro caminho atual/planejado
   que chegue em `/adicionar/compra-cartao/parcelas` com esse mesmo contexto
   e deveria herdar a mesma regra?
2. Cada parcela individual se pré-vincula à mesma nota de origem (mesmo
   padrão que o pré-vínculo já aplica a casos parecidos, soma livre do ADENDO
   6 §J.4 — pré-vínculo pode exceder o valor da nota/compromisso sem trava),
   ou o `cto-obra` vê razão técnica para pré-vincular só o conjunto? Leitura
   do PO: cada parcela, individualmente, pelo próprio texto do §J.4 — mas
   confirmar lendo o código de `compromisso_documento_previsto`, não assumir.
3. A tela do lote precisa de texto/aviso novo avisando que o pré-vínculo
   automático vai acontecer, ou o texto já existente do chip de pré-vínculo
   (ADENDO 6 §J.2/ADENDO 8, já replicado nas 3 superfícies do `CONTAI-091`)
   cobre o suficiente sem exigir cópia nova? Trabalho do `designer`, mas
   registrando a pergunta para não escapar do Gate 1 do `/tickets-req`.

## Out of scope explícito

- Qualquer mudança em `CONTAI-089` (herança de texto) — continua existindo
  exatamente como está, para o caminho sem documento de origem.
- `documento_origem_id` automático em lote — proibição do ADENDO 9 intocada.
- Fundir as N parcelas num evento fiscal único — fora de escopo desde o
  `CONTAI-084` (`RECUSA_PARCELADO`), não revisitado aqui.
- Mudar a doutrina de N=1 converter sem clique na confirmação (ADENDO 7) —
  este ticket só estende o mesmo mecanismo a uma origem nova de pré-vínculo,
  não redesenha a conversão.
