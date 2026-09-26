# Parecer fiscal — anexo tardio de comprovante a pagamento já registrado (D56)

- **Data**: 2026-09-26 · **Autor**: agente `contador`, execução read-only
- **Provocação**: achado em produção que confirma a dívida **D56**
  (`docs/backlog/29-2026-08-24-reconciliacao-contai-009.md`) como lacuna real
  de BACKEND, não só de UI — não existe função de escrita para anexar
  comprovante a um pagamento já existente, só no fluxo de criação. Caso
  concreto: pagamento a FRANCISCO ALMEIDA, registrado sem comprovante, aparece
  na Home como "Custo em risco no IR"; o comprovante existe em mãos do Mateus
  e a tela `/pagamento/[id]` não tem controle de upload.
- **Consome**: parecer de 2026-08-18 (`2026-08-18-correcao-de-documento-registrado.md`),
  §5 (rastro obrigatório) e §6 (mecanismo de "ano já declarado" → aviso, grava,
  pendência persistente de retificadora); parecer de 2026-08-16
  (`2026-08-16-gate-fiscal-contai-011.md`), F1 (relógio da decadência) e F3
  (digitalização não substitui original).
- **Normativo para**: o mock e o ticket que vão pagar a D56, e para o campo de
  schema que registra a data do anexo.
- **Status**: **estende** o mecanismo do §6 do parecer de 2026-08-18 a um
  gatilho novo (preencher `comprovantePath` que nasceu `null`), em vez de criar
  princípio novo. Não contradiz nada anterior.

> `[Certain]` / `[Likely]` / `[Guessing]` seguem a convenção do projeto. Nada
> aqui substitui contador humano (CRC) na assinatura da declaração.

---

## Veredito resumido

| Pergunta | Resposta |
|---|---|
| 1. Anexo tardio muda validade documental ou prazo decadencial? | **Não, nenhum dos dois** — com uma ressalva no mecanismo, não na regra |
| 2. Precisa capturar metadado novo (data do anexo)? | **Sim, obrigatório** — não basta o campo deixar de ser `null` |
| 3. Conta como custo no ano do anexo ou no ano do pagamento? | **No ano do pagamento, sempre** — e se esse ano já foi declarado, é o mesmo mecanismo do §6 do parecer de 2026-08-18, não um caso novo |

---

## 1 — Anexo tardio e validade documental / prazo decadencial

**Não muda nenhum dos dois.** `[Certain]` no mecanismo.

**Validade como documentação hábil e idônea** (IN SRF 84/2001, art. 17) é
propriedade do **documento em si** — nome e CPF completos do prestador,
descrição do serviço, valor, data, e comprovante de transferência da conta
dele, no caso de recibo de autônomo (regra já fixada no `CLAUDE.md` do
projeto). Nenhuma dessas propriedades muda com a data em que o arquivo foi
digitalizado ou anexado ao contai. Um recibo assinado em março que só é
fotografado e anexado em outubro **não é menos hábil** por causa disso — é o
mesmo recibo. "O documento existe agora, passa a valer" está certo, com uma
condição: **precisa continuar valendo desde quando o pagamento foi feito**, não
passar a valer só a partir do anexo — é isso que a pergunta 3 desenvolve.

**Prazo de decadência (CTN art. 173, I)** não se move um dia por causa do
anexo. O relógio, fixado no F1 do parecer de 2026-08-16, ancora na **última DAA
que declarou qualquer parcela do ganho** — evento que só existe na venda
futura. A data em que um comprovante entrou no acervo do contai não é fato
gerador de nada, não interrompe, não suspende, não reinicia esse prazo. O
prazo de guarda documental (que sobrevive ao app, meta 3) também não é afetado:
o documento vale para compor o dossiê pelo mesmo tempo que valeria se tivesse
sido anexado no dia do pagamento.

**A ressalva, e é a única**: o requisito do art. 17 é duplo — "comprovado **e**
discriminado na Declaração de Ajuste Anual". Anexar tarde resolve a primeira
metade (comprovado) a qualquer momento. A segunda metade (discriminado no ano
certo) depende de **quando** a DAA daquele ano foi ou será entregue em relação
à data do anexo — não é sobre a validade do documento, é sobre **em qual
declaração** o valor entra. Isso é o objeto da pergunta 3, não desta.

**Nota lateral, sem force normativa aqui**: quanto mais distante no tempo o
anexo acontece do pagamento, maior é o peso probatório que recai sobre a
consistência interna do documento (data impressa nele compatível com a data do
pagamento registrado, valor batendo). Isso não é uma trava nova a construir —
é o mesmo julgamento que qualquer documento antigo já exige, e a IN 84/2001
não impõe prazo máximo entre pagamento e guarda do comprovante. **Não vira
critério de aceite** (não é "recusar anexo depois de X dias"); é só o
raciocínio que explica por que a pergunta 2 (rastro com data) importa.

---

## 2 — Metadado novo: data do anexo, separada da data do pagamento

**Sim, é obrigatório capturar. Não basta `comprovantePath` deixar de ser
`null`.** `[Certain]` quanto à necessidade; a forma de gravar é decisão do
`cto-obra`, mas o dado tem que existir.

Dois motivos, e nenhum dos dois é capricho de auditoria:

**(a) É o mesmo rastro que o parecer de 2026-08-18 já exige para toda correção
de registro gravado (§5).** Preencher um campo que nasceu `null` é
exatamente o caso "null → valor" citado naquele parecer para `documento.valor`
(dor D-018.5), "sem exceção". Anexar comprovante a um pagamento que nasceu sem
ele é o mesmo tipo de evento — passa a existir um "antes" (sem comprovante) e
um "depois" (com), e esse antes→depois **muda um número que alimenta relatório
fiscal**: tira o pagamento de "pago sem comprovante" e o move para "custo
confirmado". A regra daquele parecer — "rastro obrigatório em TODA correção...
com ou sem pagamento vinculado" — se aplica aqui sem precisar de exceção nova.
O rastro mínimo é o já especificado: entidade/id, campo, antes, depois, quando
(timestamptz — **este é o dado que a pergunta 2 pede**), quem, motivo.

**(b) É o dado que decide se o mecanismo do §6 do mesmo parecer dispara.**
Aquele parecer já define: correção que muda um número **em ano já declarado**
gera aviso + grava + pendência persistente de retificadora; correção que muda
número em ano **ainda não declarado** só grava, sem drama. Para aplicar essa
distinção a um anexo tardio, o sistema precisa saber **quando** o anexo
aconteceu em relação à entrega da DAA do ano do pagamento — e "quando" é
justamente a data de anexação, que hoje **não existe em lugar nenhum do
schema**. Sem ela, o detector não tem como decidir se o caso é "a" ou "b" da
tabela da pergunta 3, abaixo.

**O que isto não é**: não é pedir uma segunda data de pagamento, nem reabrir o
regime de caixa (a data que define o ano do custo continua sendo,
exclusivamente, `pagamento.data_pagamento` — parecer de 2026-08-18, item 0(a),
fechado e não se reabre aqui). É um metadado **do ato de anexar**, não do
pagamento em si — mesma categoria de dado que "quando" e "quem" no rastro,
nunca usado para calcular ano de custo.

**Lacuna que este achado reabre, e vale registrar**: o parecer de 2026-08-18 já
apontava que "não existe no modelo nada que diga qual ano-calendário já foi
declarado" (a DAA do ano X foi entregue em DD/MM/AAAA), e que sem esse dado o
detector de "ano já declarado" **nunca dispara ou dispara sempre** — hoje o
proxy é "ano anterior ao ano corrente". Essa lacuna é a mesma que o anexo
tardio de comprovante vai tropeçar; **não precisa ser resolvida de novo aqui**,
mas o ticket da D56 deve reaproveitar o mesmo proxy/detector, não inventar um
segundo.

---

## 3 — Ano do custo: sempre o do pagamento, nunca o do anexo

**Sempre o ano em que o pagamento foi efetivamente feito. Nunca o ano em que o
comprovante foi anexado.** `[Certain]` — é decorrência direta do regime de
caixa (IN SRF 84/2001, art. 17): o que muda o valor do bem na ficha Bens e
Direitos é a **data de pagamento**, ponto fechado desde o parecer de
2026-08-18, item 0(a) ("nenhuma data do `documento` move custo entre
anos-calendário... o campo que move custo por data é `pagamento.data_pagamento`").
Um comprovante anexado em 2027 referente a um pagamento feito em 2026 não faz
o custo "nascer" em 2027 — ele **já existia** em 2026, sem prova até então; o
anexo só destrava a prova que faltava. Tratar como custo de 2027 duplicaria o
erro que a IN 84/2001 tenta evitar: contaria o gasto no ano errado, o mesmo
defeito que o parecer de 2026-09-26 (regime de caixa / dado incompleto)
acabou de nomear para o caso inverso (dado que falta não pertence a nenhum
ano; aqui o dado que chega tarde pertence ao ano do pagamento, não ao ano em
que chegou).

A pergunta prática — isso "importa" para a discriminação anual quando o anexo
cruza de ano — tem duas respostas, e a resposta certa depende só de uma coisa:
**a DAA do ano do pagamento já foi entregue quando o anexo acontece?**

| Situação | O que acontece |
|---|---|
| **DAA do ano do pagamento ainda não foi entregue** | Sem drama. O pagamento simplesmente entra como custo confirmado desse ano quando a discriminação for gerada — é o fluxo normal. Nenhuma pendência especial. Exemplo: pagamento em 2026, anexo em outubro/2026 ou em qualquer momento antes da DAA de 2026 ser entregue (normalmente até abril/maio de 2027) |
| **DAA do ano do pagamento já foi entregue** | É **o mesmo mecanismo do §6 do parecer de 2026-08-18** — não um caso novo, uma aplicação nova do mesmo detector: (1) mostra o delta antes de gravar — *"2026 (ano já declarado): custo confirmado R$X → R$X + R$7.449,76"*; (2) grava o anexo, com o rastro da pergunta 2; (3) abre **pendência persistente** — *"anexo tardio confirmou custo de ano já declarado; avaliar retificadora com contador"*; (4) **o app não decide nem redige retificadora — CRC.** É exatamente o exemplo que a pergunta 3 traz (pago em 2026, anexado em 2027 depois da DAA de 2026 entregue) |

**Por que não é um terceiro caminho** (ex.: "conta em 2027, já que é quando
ficou comprovado"): isso inverteria o regime de caixa em proveito da
conveniência do software, não do fato. O custo de aquisição sobe com o gasto
**pago**, não com o gasto **provado ao app** — a prova é condição para o app
**exibir/declarar** o custo com segurança, não para determinar a que ano ele
pertence. Contar em 2027 subestimaria a situação em 31/12/2026 (que já estava
errada por faltar aquele valor) e ainda inflaria artificialmente o gasto de
2027 com algo que não foi pago naquele ano — dois erros por um.

**Sobre o caso concreto citado (Francisco Almeida, R$ 7.449,76)**: sem saber a
data do pagamento nem se a DAA do ano correspondente já foi entregue, não dá
para dizer qual das duas linhas da tabela se aplica — **este parecer não
confirma qual delas é o caso real, só a regra que decide**. Se for pagamento
de 2026 (obra em andamento, ano corrente, DAA ainda não entregue), hoje **não
há urgência de retificadora** — mas a ausência de caminho de anexo continua
sendo defeito, porque o relógio da linha 2 da tabela corre e ninguém percebe
até a DAA de 2026 já ter saído.

---

## Sobre prioridade (P0 fiscal × P1 fricção) — informação para a decisão, não a decisão

Não há, hoje, nenhum bloqueio de CRC nem prazo fiscal vencendo: o defeito em si
não gera multa nem risco de infração — na pior direção, ele faz o Mateus **pagar
mais imposto do que devido na venda futura** (base de custo subdeclarada),
nunca menos. Isso não é motivo para tratar como não-urgente: é motivo para
dizer que a urgência não vem do calendário fiscal, vem da **meta 1 do
produto** — "nenhum pagamento sem documento hábil" pressupõe que documentar
**depois** é um caminho tão real quanto documentar na hora, porque a doutrina
do próprio produto (append-only, "vincular depois é operação legítima") já
assume que vai acontecer. Hoje o produto assume isso na doutrina e não entrega
na interface nem no backend. Cada dia sem esse caminho é um pagamento a mais
que corre o risco de virar exatamente o cenário da linha 2 da tabela acima sem
ninguém perceber a tempo de decidir com calma se vale ou não retificar.
A escolha entre P0 e P1 é do PO; do lado fiscal, **não existe razão para
esperar** — a regra está fechada, sem pontos em aberto que peçam mais pesquisa
antes do mock.

## O que isto NÃO decide

- Onde o controle de upload aparece na tela `/pagamento/[id]` e como fica o
  texto do aviso de "ano já declarado" — é `designer`, com mock próprio, como
  o D56 já previa.
- O formato de schema do rastro e da data de anexo — é `cto-obra`.
- Se e quando o Mateus precisa efetivamente retificar uma DAA já entregue — é
  CRC, caso a caso, o app só organiza e avisa.

## Automático × exige CRC

**Sistema sozinho** `[Certain]`: aceitar anexo em pagamento já gravado sem
exigir reanexação em outro lugar; gravar rastro (antes/depois, quando, quem);
calcular o ano do custo pela `data_pagamento`, nunca pela data do anexo;
comparar contra o proxy de "ano já declarado" e, se disparar, mostrar o delta
e abrir a pendência persistente; mover o pagamento de "pago sem comprovante"
para "custo confirmado" no ano correto.

**Exige CRC**: decidir se o caso concreto pede retificadora; conduzi-la; e
qualquer efeito do anexo tardio sobre ano que já teve GCAP apurado (não é o
caso aqui, mas é a mesma doutrina se a obra já tiver sido vendida).

---

## Fecho

Este achado não é dívida fiscal nova — é a mesma dívida (D56) confirmada mais
grave (backend, não só UI) e agora respondida: **anexo tardio é caminho
fiscalmente legítimo, sem prejuízo de validade documental ou de prazo
decadencial; exige um metadado novo (data do anexo, com rastro); e o custo
sempre pertence ao ano do pagamento, reaproveitando o mesmo mecanismo de
"ano já declarado" já normatizado no parecer de 2026-08-18.** Não é adendo
formal daquele parecer porque o objeto é outro (comprovante faltante, não
correção de dado incorreto), mas o normatiza como precedente de mecanismo:
**um só detector de "número mudou em ano já declarado", reaproveitado por
todo gatilho que muda custo confirmado — correção de valor, vínculo tardio ou
anexo tardio.** Construir um segundo seria o mesmo erro que o parecer de
2026-08-18 já advertiu: dois avisos diferentes para o mesmo evento fiscal
ensinam que são coisas diferentes, e não são.

**O contai redige, dateia e organiza. Não assina.**
