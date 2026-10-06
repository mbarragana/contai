# Ponto de entrada único — "recebi um documento novo pra esta nota" (2026-10-05)

## A dor

Mesmo dia da PerfuraTec 261→263 (ver `101-2026-10-05-correcao-nota-substituida-com-retencao-nova.md`
e `102-2026-10-05-gate4-contai-086-087.md`, CONTAI-085/086/087, Gate 4 fechado
hoje). O Mateus usou o CONTAI-086 (reabrir gate de retenção) pra registrar a
nota 263 substituindo a 261, e no processo:

1. Achou, por um instante, que o saldo de R$34.901,00 (R$59.901,00 −
   R$25.000,00 já pago) era sintoma de bug de retenção. Não é — é saldo não
   pago por regime de caixa normal. Já expliquei a ele nesta sessão, não é
   requisito.
2. Ainda não corrigiu o número da nota (261→263) — fez só a correção de
   retenção. A correção de número (CONTAI-085, parecer já ratificado em
   2026-08-18) é ação separada que falta ele fazer.
3. Efeito colateral real: o acervo ficou com **2 cópias do mesmo arquivo**
   `NFSE_261_9012085_1_1.pdf` (3 papéis no total: 261, 261 de novo, 263). Ele
   confirmou que foi upload por engano — não reaproveitou o chip "usar a nota
   já anexada" (existe desde o CONTAI-086, critério 9, `docs/tickets/CONTAI-086.md`
   linha ~61) entre as duas ações que fez (gate flip + linha de retenção), e
   resubiu o arquivo errado numa delas. Não dá pra apagar o duplicado:
   `documento_anexo` nunca teve GRANT de DELETE (migrations 0009/0017, acervo
   append-only por desenho). Fica como clutter inofensivo, não fiscal.

A citação que fecha o relato, dele mesmo, depois de viver isso:

> **"eu deveria poder fazer tdoas as correções em uma unica edição: número,
> valor, retenção"**

## Por que a solução literal foi recusada (de novo)

Fundir número + valor + retenção num único formulário/INSERT/UPDATE foi
avaliado e recusado nesta mesma conversa, reafirmando doutrina já estabelecida
no CONTAI-021 e nos tickets 085/086/087 desta sessão: os três campos vivem em
regimes de consequência fiscal diferentes —

- **valor** move custo de aquisição entre exercícios (regime de caixa, IRPF);
- **retenção** nunca move custo nem aferição (é só "quem recolhe", D57);
- **número/série** não move nada (metadado de identificação do documento).

Fundir os três num ato só esconderia essa distinção atrás de uma única tela,
exatamente o risco que a doutrina de "ato nomeado por regime" existe para
evitar. O Mateus **concordou em não fundir os campos**.

## A solução acordada: ponto de entrada único, sem fundir dados

Proposta que eu (sessão anterior) levei a ele: um **PONTO DE ENTRADA único** —
"recebi um documento novo pra esta nota" — que:

- pede o anexo **uma vez só**;
- pergunta quais correções o Mateus precisa fazer (número? valor? retenção?
  pode marcar mais de uma);
- leva ele por cada correção específica marcada, **reaproveitando o mesmo
  anexo em todas elas** sem re-perguntar nem re-subir o arquivo;
- mas **cada correção continua sendo um ato nomeado**, com seu próprio motivo
  e seu próprio rastro em `revisao` — não funde dado, só poupa repetição de
  navegação/upload/motivo.

Ele respondeu: **"sim, vamos seguir esta sua ideia do fluxo"**.

## Classificação e prioridade

**P1 — fricção de processo real e repetida**, não obrigação fiscal isolada:
nenhuma correção individual está bloqueada hoje (085/086/087 já entregues e
funcionam cada uma isoladamente). A dor é a navegação repetida entre telas de
correção quando mais de uma se aplica ao mesmo documento novo — e ela já
causou um efeito colateral concreto (upload duplicado no acervo, ver acima).

## User story preliminar

> **Como** o Mateus, gerenciando a obra em casa, sentado, depois de receber um
> documento substituto/corrigido de um prestador,
> **quando** eu abro "recebi um documento novo pra esta nota" a partir do
> documento já registrado,
> **eu quero** anexar o novo arquivo uma vez e marcar quais correções ele traz
> (número, valor, retenção — uma ou mais),
> **para que** eu não precise re-navegar, re-explicar o motivo nem re-subir o
> mesmo PDF em cada tela de correção separada.

### Critérios de aceite preliminares (a fechar no `/tickets-req`)

- O ponto de entrada mostra o(s) papel(is) já anexado(s) ao documento e pede
  **um novo anexo só se o Mateus confirmar que há um arquivo novo** (reaproveita
  o já existente quando ele disser que não há arquivo novo, mesma lógica do
  chip do CONTAI-086).
- Ao marcar N correções (ex.: número + retenção), o mesmo `documento_anexo`
  (mesmo `id`/path) é referenciado pelas N correções — **critério verificável**:
  inspecionar que as revisões geradas no mesmo "pacote" apontam para o mesmo
  `documento_anexo.id`, não para N uploads distintos.
- Cada correção marcada grava sua **própria linha em `revisao`**, com seu
  próprio motivo e seu próprio rastro — nunca uma linha fundida cobrindo mais
  de um campo. (Verificável: número de linhas em `revisao` após o fluxo = número
  de correções marcadas, cada uma com `tipo`/motivo distinto.)
- Se o Mateus sair no meio do pacote (ex.: fez a correção de retenção e saiu
  antes da de número), o que já foi gravado persiste como hoje (cada correção
  é transacional por si) — o pacote não é tudo-ou-nada, é só o roteamento e o
  anexo compartilhado que são "um ato de entrada".
- Não existe estado novo que precise sobreviver a um refresh de página além do
  anexo já salvo no primeiro passo (a ser confirmado com `cto-obra`, pergunta
  (a) abaixo).

## Gate Fiscal — perguntas para o próximo `/tickets-req`

Registradas aqui, **não respondidas nesta rodada** (trabalho do `contador`/
`cto-obra` no próximo `/tickets-req`, não desta sessão de `/relato`):

**(a)** Esse ponto de entrada é só um **menu/roteador de UI** — zero mudança de
RPC ou de rastro, cada correção continua chamando a mesma RPC e escrevendo a
mesma linha de `revisao` de hoje — ou precisa de alguma mudança de dado (estado
intermediário) pra "lembrar" qual anexo usar entre as telas, caso o fluxo vire
mais de uma navegação de página?

**(b)** O reaproveitamento automático do anexo entre ações sucessivas no mesmo
"pacote de correção" — isso **já deveria ter acontecido** via os chips do
CONTAI-086/087 (chip "usar a nota já anexada", critério 9 do CONTAI-086,
`docs/tickets/CONTAI-086.md` linha ~61) e não aconteceu: o Mateus resubiu por
engano. Vale investigar se foi **falha de descoberta** (o chip existe mas não
ficou visível/claro no fluxo que ele seguiu) ou **bug real** (o chip não
apareceu quando deveria ter aparecido). Essa investigação pode destravar sem
precisar do ponto de entrada novo — ou pode confirmar que o ponto de entrada é
mesmo necessário porque o chip, por desenho, só cobre o caso de permanecer na
mesma tela.

## Fora de escopo, com porquê

- **Fundir número + valor + retenção num único INSERT/UPDATE.** Recusado nesta
  conversa (e reafirma CONTAI-021 + 085/086/087): esconderia a distinção de
  regime de consequência fiscal atrás de uma tela só. O Mateus concordou com a
  recusa.
- **Apagar o anexo duplicado do acervo.** Sem caminho por desenho —
  `documento_anexo` nunca teve GRANT de DELETE (migrations 0009/0017,
  acervo append-only). Não é fiscal (clutter inofensivo, não distorce nenhuma
  das três saídas), não é deste ticket.

## Perguntas abertas

Nenhuma pendente de resposta do Mateus nesta rodada — o relato já fechou
solução, prioridade e recusa de alternativa em conversa. As duas perguntas de
Gate Fiscal ((a) e (b)) ficam para o `contador`/`cto-obra` no próximo
`/tickets-req`, não para o Mateus agora.
