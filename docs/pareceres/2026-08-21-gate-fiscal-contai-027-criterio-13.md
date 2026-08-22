# Gate Fiscal do CONTAI-027 — o critério 13, e o que fica no lugar dele

- **Data**: 2026-08-21 · **Autor**: agente `contador`
- **Provocação**: o `/design` (Gate 0) do CONTAI-027 relatou que o `contador`
  alterou o próprio Gate Fiscal **durante** o gate, cortando o **critério 13**, e
  que o `po` acatou. **A alteração não foi escrita em lugar nenhum**: o ticket
  segue com o critério 13 intacto e não havia adendo em `docs/pareceres/`. O
  `lead-engineer` recusou implementar ticket e relato — corretamente.
- **Normativo para**: `CONTAI-027` (critérios 12, 13 e 14), o ticket novo de
  **correção de valor de desembolso** (a criar) e `CONTAI-011` (dossiê).
- **Revisa**: o **§2** do Gate Fiscal transcrito em `docs/tickets/CONTAI-027.md`
  (a frase *"o dente dela é o critério 13"*).

> `[Certain]` / `[Likely]` / `[Guessing]` são meus. Nada aqui substitui contador
> humano (CRC).

---

## 0. A parte desconfortável, antes de tudo

**O processo falhou antes da regra.** Uma decisão fiscal foi tomada dentro de um
gate de design, sobreviveu num mock **já aprovado pelo Mateus** e não existiu em
arquivo nenhum por um dia inteiro. Isso é exatamente a falha que o `CLAUDE.md`
proíbe — *"parecer que só existe no transcript é a mesma falha que a regra
proíbe, com outro nome"* —, e o agravante é que ela produziu **um mock aprovado
contra um ticket vigente**: dois artefatos oficiais em contradição, com o
Mateus tendo aprovado o lado não escrito.

**Regra que eu fixo aqui, e vale para mim mesmo** `[Certain]`: **eu não altero
Gate Fiscal dentro de outro gate.** Se, no meio de um `/design`, eu perceber que
um critério meu está errado, o produto daquele momento é **um adendo em
`docs/pareceres/`, escrito no ato** — o mock e o ticket passam a apontar para
ele. Alteração fiscal falada é alteração que não aconteceu.

**Segunda parte desconfortável**: o mock já está aprovado. Isso **não** me
obriga a nada. Se o corte fosse fiscalmente errado, eu diria que é errado e o
mock voltaria para uma rodada — o custo de uma rodada de mock é menor que o de
um ano-calendário declarado errado. Não é o caso, mas quero registrado que a
aprovação **não entrou na conta**.

---

## 1. Cortei o critério 13, ou não?

**O que eu posso afirmar e o que não posso** `[Certain]`: eu não tenho o
transcript daquele gate e **não vou fingir memória que não tenho** — seria o
mesmo defeito do campo preenchido que afirma o que ninguém conferiu. O que eu
faço aqui é **adjudicar a posição**: examinar o corte pelo mérito e dizer se ele
é meu ou não.

**É meu. O corte está CONFIRMADO** `[Certain]` **— com uma correção de
fundamentação que não é cosmética** (§2 abaixo). O critério 13, **como está
escrito no ticket, sai desta rodada** e migra para o ticket de correção de valor
de desembolso.

**Nada no relato distorceu minha posição quanto ao resultado.** Um dos quatro
argumentos relatados, porém, **não é meu e não deve ser reusado** — e é o §2.

---

## 2. O argumento que eu REJEITO — *"a discriminação não é transmitida pelo app"*

`[Certain]` **Este argumento prova demais, e por isso não prova nada.**

Ele diz: como a discriminação é texto que o Mateus **copia** para a declaração,
um bloqueio se contorna fechando o app e digitando à mão; logo o bloqueio não
protege declaração nenhuma.

Se isso valesse, **derrubaria junto o bloqueio do relatório anual por compromisso
vencido sem resposta** (parecer de 2026-08-18, §A), que está de pé, é correto e
não vai a lugar nenhum. **Toda** saída deste app é copiável — o app nunca
transmitiu e nunca vai transmitir nada à RFB. Um critério que invalida qualquer
bloqueio não é critério, é a abolição da categoria.

**O que o bloqueio faz não é impedir fisicamente: é obrigar a parar.** Isso é
legítimo — desde que haja onde parar **e** por onde sair. É essa segunda parte
que falta aqui, e é a única razão do corte.

**Se este argumento aparecer de novo em ticket, mock ou tela, ele é para ser
recusado.** Deixá-lo no acervo como fundamento é plantar a demolição do bloqueio
do compromisso vencido para quem ler isto daqui a um ano.

---

## 3. O argumento que sustenta o corte — três, e o segundo é decisivo

### 3.1 O teste do corolário 3: bloqueio exige resposta declarável

`[Certain]` O bloqueio do compromisso vencido é legítimo porque a pendência
**sempre tem resposta**, inclusive a resposta *"não sei"*: o parecer de 18/08
fixou **"sem data definida"** como opção explícita e o corolário 3 diz que
**incerteza declarada não é silêncio** — e por isso não bloqueia.

A pendência *"um lançamento, mais de uma data"* **não tem resposta declarável
nenhuma**. A ação que ela nomeia é *"corrija o valor deste lançamento e registre
um por data"*, e **o app não corrige valor de desembolso já gravado**:
`completarDesembolsoTerreno` (`lib/data.ts`) completa a **data** e traz escrito
que **o valor não é tocado**. Não há tela, não há caminho, não há "não sei".

**Regra geral que eu fixo, e que vale para toda pendência futura** `[Certain]`:

> **Uma pendência só pode bloquear uma saída anual se existir, no app, um fato
> que a feche — inclusive o fato "declaro que não sei".** Pendência sem fato de
> baixa é informação, nunca trava. Trava sem baixa não coleta o fato que falta:
> coleta a resposta que destrava.

### 3.2 O dente só morde quem disse a verdade — e este é o argumento decisivo

`[Certain]` A pendência só existe se o Mateus responder **"em mais de um dia"**.
Quem clica **"tudo no dia X"** por reflexo — o pre-mortem nº 2 do `po`, o risco
real — **passa pelo bloqueio intacto**, porque para ele não há pendência nenhuma.

Ou seja: o bloqueio **não alcança o caso que ele existe para alcançar**, e
alcança **só quem foi honesto**, deixando o honesto travado e o desatento
livre — com o desatento, ainda por cima, **premiado**, porque o único jeito de
sair da trava é ir lá e mudar a resposta para a falsa.

**Um dente que fere só quem disse a verdade não é dente: é ensinamento.** Ele
ensina, na prática e uma vez só, qual é a resposta que não dá trabalho. E a
resposta que não dá trabalho é a que apaga o problema do app, do dossiê e de
2034 — **erro invisível**, contra o **erro nomeado** que a pendência preserva.
Entre um erro nomeado no acervo e um erro invisível, o nomeado é sempre o
melhor: ele é corrigível, inclusive por retificadora, e não é omissão.

### 3.3 O escopo do bloqueio era o ano inteiro

`[Certain]` O critério 13 trava **a discriminação daquele ano**, não o
lançamento. Um único desembolso com data colapsada travaria o texto de **todos
os demais lançamentos corretos do ano** — e o efeito prático seria o Mateus
montar a discriminação **à mão, fora do app**, justamente no ano em que ela
precisa carregar composição (total do ano, materiais × mão de obra, CNO, e a
frase *"declarado pelo valor efetivamente pago"*, que o parecer de 17/08 declara
**não cortável**). O bloqueio destinado a proteger a meta 2 a entregaria pior.

### 3.4 O que se perde, dito por extenso

`[Certain]` **A meta 2 perde a única trava mecânica deste ticket.** O pre-mortem
nº 2 do `po` fica **sem mitigação mecânica** e passa a depender de texto na tela.
Isso é mais fraco, e eu não vou fingir que não é. O que resta é: pergunta sem
default, pendência indispensável em três superfícies, aviso na saída e a
regravação da pergunta quando o fato muda (§6).

**A compensação é temporal, não conceitual**: o bloqueio **volta** no ticket de
correção de valor — e volta valendo, porque lá a pendência terá baixa. Enquanto
isso, o CONTAI-027 entrega as **metas 1 e 3**; a **meta 2** sai do veredito dele.

---

## 4. O que fica no lugar — textos copiáveis para tela

Texto de tela com consequência fiscal **se copia daqui, não se reescreve**.
`[valor]`, `[data]`, `[ano]` e `[N]` são substituições do app.

### 4a. A pergunta binária (critério 12) — obrigatória, sem default, sem pré-seleção

**Título**

```
Quando esse dinheiro saiu da sua conta?
```

**As duas opções** (mesmo peso visual, nenhuma pré-marcada)

```
Tudo em [data do lançamento, dd/mm/aaaa]
```
```
Em mais de um dia
```

**Consequência (âmbar), abaixo das opções**

```
Cada dia em que o dinheiro saiu é um pagamento com a sua própria data — e é a
data que decide em que ano o custo entra. Se foi em mais de um dia, o registro
é gravado do mesmo jeito e fica uma pendência.
```

**Nota de apoio**

```
Não é retrabalho: dois débitos em dias diferentes são dois fatos, e o app não
tem como saber quanto foi em cada dia — nem deve fingir que tem.
```

⚠️ **A consequência não lidera pela punição, e isso é decisão, não estilo**
`[Certain]`: frase que começa pelo castigo ensina a responder o que escapa dele —
e, com o bloqueio fora, a qualidade dessa resposta é a **única** defesa que
sobrou.

### 4b. A pendência — título, corpo e a segunda metade da ação

**Título / chip** (vermelho)

```
Um lançamento, mais de uma data
```

**Corpo** — no card do desembolso, na home e na lista de revisão pré-declaração

```
Você respondeu que o dinheiro saiu em mais de um dia, e este lançamento tem
R$ [valor] numa data só. É a data do pagamento que decide o ano do custo.
```

**A segunda metade da ação nomeada** (vermelho, logo abaixo) — **ela existe, e
não é opcional**

```
Ainda não dá para arrumar aqui: o app não corrige o valor de um desembolso do
terreno já gravado. Não registre os lançamentos separados antes disso —
enquanto este continuar com os R$ [valor], os novos somam por cima e o custo do
terreno fica maior do que foi.
```

**A saída, quando existir**

```
Quando a correção de valor existir: corrija este para o que saiu na primeira
data e registre um lançamento para cada uma das outras.
```

`[Certain]` **Por que a segunda metade é obrigatória**: cumprir só a primeira
metade — registrar os lançamentos separados sem corrigir o original — **soma o
valor duas vezes** no custo do terreno. Custo inflado em Bens e Direitos é
**redução indevida de ganho de capital**, cobrada com multa (parecer de 17/08,
§1). Dos dois erros simétricos, esse é o caro; a data colapsada põe custo no ano
errado, a duplicação põe custo que não existe. **Pendência que nomeia meia ação
induz o erro pior que a original.**

**Sem "ok, entendi"** `[Certain]`: não se dispensa, não se adia, não se esconde.
Pendência fiscal baixada por declaração de intenção é o campo preenchido que
afirma o que ninguém conferiu, com um botão na frente.

### 4c. O aviso que acompanha a discriminação do ano

**O mock está certo, e eu confirmo a posição: ACIMA do bloco copiável, FORA
dele** `[Certain]`.

**Banner (acima de tudo)**

```
Revise antes de copiar — [N] lançamento pede atenção.
A discriminação sai; o que a linha abaixo diz é onde o número pode estar no ano
errado.
```
(plural: `[N] lançamentos pedem atenção`)

**Uma linha por lançamento afetado**, entre o banner e o bloco copiável

```
Um lançamento, mais de uma data
[Tipo do desembolso] · R$ [valor] · [data]
Este valor inteiro está caindo em [ano] pela data do lançamento. Se parte dele
saiu em outro dia — e principalmente em outro ano — o ano está errado para essa
parte.
```

**Rótulo do bloco copiável**

```
O texto — daqui para baixo é o que vai para a declaração
```

⚠️ **Por que o aviso não pode entrar no bloco** `[Certain]`: o bloco é colado
literalmente na ficha Bens e Direitos. Aviso lá dentro vira **texto declarado à
RFB** — o Mateus passaria a discriminar dúvida onde a norma pede composição
(IN SRF 84/2001, art. 17). **Nenhum texto de pendência, alerta ou instrução
nossa entra em área copiável, neste ou em qualquer relatório.** Regra geral.

### 4d. A resposta se grava — sempre, inclusive o "sim"

`[Certain]` **Requisito fiscal, não de UI**: a resposta da pergunta 4a é
**gravada com a data em que foi dada**, nos dois casos. O `"tudo no dia [data]"`
não pode ser apenas a ausência de pendência.

Razão: o corte inteiro se apoia em *"erro nomeado é melhor que erro invisível"*.
Se o `"sim"` não deixa rastro, ele **é** o erro invisível — e em 2034 ninguém
distingue *"ele afirmou que foi tudo no mesmo dia"* de *"ninguém perguntou"*.
São coisas diferentes: a primeira é declaração do contribuinte; a segunda é
lacuna do sistema.

**Restrição adicional ao `CONTAI-011` (dossiê)**, na mesma linha do §4 do Gate
Fiscal: **a resposta vigente e a pendência aberta do ano entram no índice do
dossiê daquele ano.** Sem isso, o "erro nomeado" só está nomeado dentro de um app
que pode não existir em 2034 — e o argumento que sustenta este corte deixa de ser
verdadeiro no momento em que ele mais importa.

---

## 5. A pendência tem baixa? **Hoje, não.**

`[Certain]` **Nenhum fato disponível no app fecha esta pendência hoje.**

**O fato que a fecharia, em uma linha**: o valor deste lançamento passar a
corresponder a **um único dia** — o que exige **correção de valor de desembolso
do terreno**, que não existe (`completarDesembolsoTerreno` toca a data e diz, por
extenso, que o valor não é tocado).

**Consequência de processo, e ela é dependência de ticket novo**:

1. O `po` abre o ticket de **correção de valor de desembolso**, com rastro da
   alteração (o acervo é append-only: correção é revisão registrada, nunca
   sobrescrita silenciosa).
2. **O critério 13 migra inteiro para lá** e volta a valer **na forma em que está
   escrito hoje** — naquele ticket a pendência terá baixa, e a trava passa a ser
   legítima pelo teste do §3.1.
3. **Corolário que não pode ser esquecido**: se o lançamento a corrigir for de
   **ano-calendário já declarado**, a correção **não é só de app** — é
   **retificadora, e exige CRC**. A tela de correção tem de perguntar o ano e
   dizer isso; corrigir número de ano declarado dentro do app, calado, é o app
   fabricando divergência entre o que ele mostra e o que foi entregue à RFB.

**Não invente critério de baixa.** A única baixa disponível hoje seria um *"eu
resolvi isso"* — pendência fiscal fechada por declaração de intenção. **Recuso.**

---

## 6. A fronteira do gatilho — **confirmada, e ela CORRIGE o critério 12**

`[Certain]` A fronteira que o mock fixou é **compatível com o meu §2 e melhor do
que a redação do ticket**. O §2 exige que a pergunta seja **sobre o lançamento**,
nunca sobre os arquivos; o ticket, ao dizer *"ao anexar o segundo arquivo"*,
voltou a contar arquivos. **A redação do ticket está errada e é esta que vale:**

| | Regra |
|---|---|
| ✅ **Dispara** | quando o lançamento passa a ter **dois papéis marcados `Comprovante do pagamento`** — no mesmo ato de registro ou dias depois, indiferente |
| ✅ **Uma vez por ato** | três comprovantes de uma vez perguntam **uma vez só**. Não é por arquivo |
| ✅ **Dispara de novo** | se a resposta vigente era *"tudo no dia X"* e chega **comprovante novo**: o fato mudou, e o app **não carrega adiante um "sim" que não sustenta mais** |
| ❌ **Nunca** | para `Nota ou recibo` nem `Contrato ou escritura` |
| ❌ **Não** | se a pendência **já está aberta** — ele já respondeu |
| ❌ **Represada** | enquanto o desembolso **não tiver data**; dispara **junto com o preenchimento da data** |

**Por que disparar por papel, e não por contagem de arquivos** `[Certain]`:
comprovante + recibo são **dois papéis e um débito**. Perguntar ali é pergunta de
resposta óbvia — e **pergunta óbvia treina o clique automático que esvazia a
pergunta que importa**. Com o bloqueio fora, a pergunta é a defesa principal:
gastá-la em caso trivial é caro.

**Por que represar sem data** `[Certain]`: a pergunta cita a data no próprio
botão — sem data, ela é impronunciável. E não há o que proteger: **sem data não
há ano-calendário**, e a pendência *"falta a data"* já cobre o defeito, com
precedência. As duas **nunca aparecem juntas no mesmo desembolso**. Quando a data
entra (hoje, por `completarDesembolsoTerreno`), a represa abre e a pergunta
dispara **no mesmo ato**.

---

## 7. O campo `papel` (critério 14) — **os três valores confirmados**

`[Certain]` Fecha a **Pergunta Aberta nº 1** do ticket. Conjunto fechado,
**obrigatório, sem default**, três valores:

| Valor | Rótulo em tela | O que sustenta |
|---|---|---|
| `comprovante` | **Comprovante do pagamento** | condição 1 — que o dinheiro saiu, quando, e da conta dele. **É o único que dispara a pergunta do §6** |
| `nota` | **Nota ou recibo** | condição 3 — o que foi adquirido, por quanto, em nome de quem |
| `contrato` | **Contrato ou escritura** | o título e o preço contratado: escritura, contrato de financiamento, matrícula, guia de ITBI |

**Por que três e não dois**: no terreno o papel de título é peça própria e
frequente — escritura, contrato, matrícula — e não cabe em nenhum dos outros
dois. **Por que não quatro**: o pre-mortem nº 1 do `po` está certo, taxonomia
grande faz o segundo papel não ser anexado, e o ticket que existe para completar
o acervo passaria a esvaziá-lo. **Valor novo neste conjunto exige parecer meu**
(mesma contrapartida da D32 para o enum de pendência).

⚠️ **Armadilha de implementação que eu preciso desarmar aqui** `[Certain]`: o §3
do Gate Fiscal manda oferecer o caminho *"registre isto como `documento`"* quando
o usuário marca um anexo como nota/recibo — **isso vale para `pagamento`, e NÃO
para `terreno_desembolso`**. O desembolso do terreno tem **natureza própria**
(parecer de 17/08, §5): alimenta **só** a apuração de custo, **nunca** a base de
aferição, **nunca** o headline de risco, **nunca** Pagamentos Efetuados, e **não
tem pendência de "pago sem nota"**. Construir a oferta na tela do terreno criaria
uma pendência falsa onde o acervo está completo — o inverso da inflação, e
igualmente falso.

---

## 8. O que muda no `docs/tickets/CONTAI-027.md`

Eu não edito ticket. O que este parecer determina, para quem editar:

1. **Critério 13** — sai desta rodada, com o motivo e o ponteiro para este
   arquivo. Migra para o ticket de correção de valor de desembolso.
2. **Critério 12** — a redação *"ao anexar o segundo arquivo"* é substituída pela
   regra de disparo do **§6** (dois papéis `Comprovante do pagamento`, uma vez
   por ato, represada sem data).
3. **Critério 12** ganha a **segunda metade da ação nomeada** (§4b) e a
   **gravação da resposta nos dois casos** (§4d).
4. **§2 do Gate Fiscal** — a frase *"o dente dela é o critério 13"* fica assim:

   > *"O que é implementável — pergunta sobre o lançamento, não sobre os
   > arquivos: é o critério 12. **O dente que eu havia posto no critério 13
   > (bloquear a discriminação do ano) não vai nesta rodada** — ele não tem
   > caminho de baixa e só morde quem responde a verdade; ver o parecer de
   > 2026-08-21. Fica no lugar: pendência indispensável em três superfícies,
   > aviso fora da área copiável, e a resposta gravada nos dois casos."*
5. **Veredito** — a **meta 2** sai deste ticket e vai com o critério 13. O
   CONTAI-027 entrega **metas 1 e 3**.
6. **Critério 14** — os três valores do §7 deixam de ser Pergunta Aberta.
7. **`CONTAI-011`** — recebe a restrição do §4d, somada à do §4 do Gate Fiscal.

---

## 9. Automático × humano × CRC

**Sistema sozinho** `[Certain]`: disparar a pergunta pela regra do §6; gravar
sempre, com pendência ou sem ela; gravar a resposta e a data dela; manter a
pendência indispensável nas três superfícies; imprimir o aviso **fora** do bloco
copiável; **não** desdobrar lançamento nenhum; **não** oferecer baixa.

**Só o Mateus** `[Certain]`: dizer se os débitos são do mesmo dia — *"o app não
tem como saber, e não deve fingir que tem"* — e dizer qual papel é qual.

**Exige CRC** `[Certain]`: corrigir valor ou data de lançamento de
**ano-calendário já declarado** (retificadora). Isso é do ticket de correção, e é
condição de existência dele.

**Números a confirmar**: **nenhum**. Este parecer não move alíquota, código de
ficha nem prazo.

---

## 10. Limite

Isto é **decisão de regra e de texto**, automatizável inteira. O que continua
exigindo contador humano é a retificadora, e o que continua exigindo o `po` é a
apresentação da pendência (cor, superfície, ordem) — a mudança da regra de cor
para *"vermelho = fato consumado com consequência fiscal aberta"* é dele, e eu
não a disputo: minha objeção original (o acervo está completo, logo âmbar) olhava
o acervo; a régua certa aqui é a consequência fiscal, que está aberta.
