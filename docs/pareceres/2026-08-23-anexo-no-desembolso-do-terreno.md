# Parecer fiscal — o anexo no ato do registro: onde grava e cobra, onde recusa

*(e o dinheiro que saiu da conta do cônjuge)*

> ⚠️ **O escopo deste arquivo cresceu em 23/08, na mesma data.** O corpo abaixo
> responde à pergunta estreita (o desembolso do terreno). O **ADENDO 1**, ao
> final, responde à pergunta larga — **as seis superfícies de registro do app** —
> depois de o Mateus corrigir o escopo: *"eu não quero afrouxar isso para
> terreno, eu quero afrouxar isso para qualquer despesa"*. Onde o corpo e o
> ADENDO 1 divergirem, **vale o ADENDO 1**.

- **Data**: 2026-08-23
- **Origem**: relato do Mateus de 23/08 — **ele parou de usar o app** ao ser
  recusado no registro dos desembolsos do terreno por não ter os comprovantes à
  mão. Gate fiscal pedido pelo `po` antes de escrever requisito (D46/D48).
- **Normativo para**: `app/obras/[id]/terreno/desembolsos/page.tsx` (a trava de
  `anexos.length === 0`), o ticket que nascer deste relato, e a leitura da
  premissa *"anexo obrigatório no ato do registro"* do `CLAUDE.md`.
- **Depende de**: `2026-08-18-compromisso-versus-pagamento.md` (**ADENDO 2**,
  §§1, 2, 4, 5, 6 e 7; **ADENDO 3** §G.3) e `2026-08-17-terreno-financiado.md`
  (§2a, §5 e o Ponteiro de 21/08).
- **Substitui**: o comentário de código *"Anexo obrigatório para toda linha NOVA
  paga (disciplina do anexo no ato do registro)"* e o trecho da migration `0008`
  que diz *"OBRIGATÓRIO NO FORMULÁRIO para toda linha gravada como `pago`"*.
  Nenhum dos dois tem parecer por trás — ver §1.3.

---

## 0. A resposta desconfortável, primeiro

**A trava do desembolso do terreno é o mesmo defeito que este projeto já
diagnosticou e corrigiu em 18/08 — reintroduzido no dia seguinte, em outra
tela.** `[Certain]`

O ADENDO 2 §5 do parecer de 18/08 nomeia o defeito com todas as letras, sobre o
mock do `CONTAI-019`:

> ⚠️ **Defeito no mock, a corrigir**: (…) a gravação está **bloqueada**. Isso
> contradiz o caminho da confirmação, para o **mesmo fato do mundo**. Dois pesos
> para o mesmo pagamento ensinam que a regra é do app, não do fisco — e o atrito
> empurra para não registrar, que é a falha da meta 1. **O botão grava sempre; o
> que muda é o estado que nasce.**

O `CONTAI-010` fechou em **19/08** — um dia depois — com a trava dura no
formulário do terreno. O parecer que a proibia já existia e não foi consultado.
O `CLAUDE.md` diz que regra fiscal vem do parecer, nunca de memória de sessão;
aqui ela veio de comentário de código.

E o preço já foi pago: **o banco de produção está vazio, e o usuário voltou para
a planilha.** A trava não impediu nenhum erro fiscal — impediu o registro. Meta 1
do produto ("nenhum pagamento sem documento hábil") existe para que o custo seja
demonstrável na venda; um app que ninguém usa entrega **zero** custo
demonstrável. A trava otimizou a qualidade do dado ao custo da existência do
dado.

---

## 1. P1 — desembolso pago pode gravar sem comprovante?

### 1.1 Resposta

**Pode, e deve.** `[Certain]` Nasce gravado, com valor e data, **fora do custo
confirmado**, como pendência visível — exatamente o tratamento que
`/adicionar/pagamento` já dá, pelo ADENDO 2 §5.

**A assimetria de hoje entre as duas telas NÃO tem fundamento fiscal.** `[Certain]`
Não existe dispositivo que exija a apresentação simultânea do comprovante para
que o dispêndio exista. A IN SRF 84/2001, art. 17, condiciona o cômputo do
dispêndio no custo de aquisição a duas coisas — comprovação por documentação
hábil e idônea **e** discriminação na Declaração de Ajuste Anual — e **nenhuma
delas tem prazo de "no ato"**. A comprovação é exigível **quando o custo for
oposto ao Fisco**: na declaração e, sobretudo, na apuração do ganho de capital.
O momento em que o contribuinte anota o fato num caderno, numa planilha ou neste
app é fiscalmente irrelevante. `[Certain]` quanto ao princípio; `[Likely]` quanto
à letra do inciso/alínea — a própria `lib/fiscal/terreno.ts` já registra que a
alínea do art. 17 está sob "confirmar" e **não deve ser escrita em tela**.

### 1.2 O que a trava do informe anual tem e a do desembolso não tem

O critério 10 do `CONTAI-010` (*"Anexo obrigatório no ato do registro. Sem o
extrato, não grava"*) **fica de pé, e não é incoerência**. `[Certain]` A diferença
é de natureza do documento, não de rigor:

| | `financiamento_informe` (critério 10) | `terreno_desembolso` |
|---|---|---|
| Papel do anexo | **fonte dos dados** — as sete rubricas são **transcritas** do extrato | **prova** de um fato que o usuário conhece sem ele |
| Sem o anexo, o que se grava? | números **de memória** — e a trava da soma do critério 11 não tem contra o que fechar | valor e data, que ele sabe: *"paguei o ITBI, R$ X, em dd/MM/aaaa"* |
| O que o bloqueio evita | **fato inventado** entrando na base | **nada** — evita apenas o registro |

Bloquear o informe impede o app de gravar um dado que ninguém tem. Bloquear o
desembolso impede o app de gravar um dado que o usuário tem na cabeça e cuja
prova está no banco, no cartório ou na prefeitura. **São problemas opostos, e a
mesma regra aplicada aos dois é erro de leitura, não de doutrina.**

### 1.3 De onde a trava veio (para não voltar)

Rastreamento: o texto de tela do critério 10 (*"Sem o extrato anexado, este
lançamento não grava…"*, `design/mocks/CONTAI-010.md:55`) pertence à tela do
**informe anual**. Ele foi generalizado, sem parecer, para a entidade
`terreno_desembolso`. O ADENDO 2 §6 já havia fixado a redação correta da
premissa, e ela vale aqui literalmente:

> *"anexo exigido no ato do registro; ausência grava como pendência fiscal
> explícita, nunca recusa o registro"*.

### 1.4 Três regras negativas que acompanham a liberação

1. **Proibido oferecer `previsto` como saída.** `[Certain]` Registrar como
   "ainda não paguei" um valor já pago para escapar da trava é **falsear o
   estado**: o dinheiro sai de todo ano-calendário (critério 5 do `CONTAI-010`) e
   o custo desaparece da declaração. É pior que a trava.
2. **A liberação vale para o anexo, não para a data.** `[Certain]` A data
   continua obrigatória e sem default no desembolso `pago` — é ela que decide o
   ano-calendário. Quem não souber a data grava sem ela e cai na pendência de
   complemento que o critério 23 já criou (`entraEmAlgumAno` já trata esse caso).
   **Data e comprovante são duas pendências distintas e podem coexistir.**
3. **`papel` continua obrigatório para o anexo que EXISTIR.** `[Certain]` O
   critério 14 do `CONTAI-027` não é tocado: zero anexo grava; anexo sem papel
   respondido, não.

### 1.5 A dependência que este parecer não resolve — e que decide se a liberação presta

⚠️ **A pendência precisa de superfície.** `[Certain]` Uma pendência que só existe
dentro da linha do desembolso é um buraco silencioso — e é exatamente o defeito
**D47** já registrado no Gate 4 do `CONTAI-027` (a pergunta pendente sem
superfície em card nem na home). Liberar a gravação **sem** superfície troca
"custo não registrado" por "custo registrado que ninguém vai completar", que na
venda dá no mesmo. O requisito que nascer daqui **tem de incluir a superfície da
pendência**, ou não entrega a meta 1.

---

## 2. P2 — o valor sem comprovante entra no total do ano da discriminação?

### 2.1 A resposta tem duas metades, e confundi-las é o erro

**Metade automática** `[Certain]`: **não entra no custo confirmado.** O número que
o app calcula sozinho — o painel, o total do ano, o headline de custo — soma
apenas desembolso pago, **com data** e **com comprovante**. Isso é a aplicação
literal da tabela do ADENDO 2 §5 e mantém o app coerente entre as duas telas, que
é metade do pedido do `po`.

⚠️ **Consequência técnica que o `po` precisa levar ao ticket**: hoje
`lib/fiscal/terreno.ts` soma por `estado === "pago"` + `dataPagamento`, **sem
olhar anexo** — porque o formulário garantia o anexo. Liberada a gravação, esse
módulo passa a somar custo não demonstrável **em silêncio**. A distinção
"confirmado × registrado sem comprovante" tem de nascer na mesma entrega da
liberação, ou a liberação vira defeito de número.

**Metade NÃO automática** `[Certain]`: **omitir o valor da discriminação da DAA
não é decisão do app.** Aqui está a distinção que o ADENDO 2 §5 não trata, porque
não precisava: *"custo confirmado"* é o número **interno** do app (o do CONTAI-005);
*"discriminação de Bens e Direitos"* é a **saída para a declaração**. Nenhum
parecer deste projeto autorizou o app a suprimir da declaração um custo pago e
real porque o PDF ainda não subiu — e ele não deve.

### 2.2 A direção segura do erro, com o dispositivo

A assimetria das duas condições do art. 17 é o que decide. `[Certain]`

- **"Discriminado na DAA"** é a condição com **prazo**. Perdida a entrega, só se
  recupera por **retificadora** — possível, mas dentro do prazo e com o ônus de
  explicar por que o número mudou. `[Likely]` quanto ao regime e prazo da
  retificadora — **confirmar na IN vigente do ano**.
- **"Comprovado com documentação hábil e idônea"** é a condição **sem prazo de
  apresentação**: o documento não é criado pelo app, ele **já existe** no banco,
  no cartório ou na prefeitura. Ele é obtido quando exigido.

Ou seja: **a condição que a trava protege é recuperável; a condição que a trava
destrói, não.** Registrar sem comprovante e correr atrás do papel é o erro
reversível. Não registrar — que é onde estamos hoje — é o erro que vira D34 na
declaração: custo subestimado, ganho de capital inflado, imposto sobre dinheiro
que ele gastou.

**Mas isso não autoriza declarar às cegas.** `[Certain]` Custo declarado e depois
glosado devolve o contribuinte exatamente à posição da omissão, **somada** a
risco de multa por inexatidão. Por isso a decisão não é do app: **o app mostra os
dois números, nomeia o valor sem lastro, e a escolha é do Mateus com o
profissional com CRC.** O que o app **não** pode fazer é escolher em silêncio —
nem para cima (somar), nem para baixo (omitir).

### 2.3 O R$ 0,00 de hoje é pior do que "app subestimando"

`[Certain]` A obra mostra **terreno R$ 0,00** e o **ano-base 2025 já foi declarado
com o terreno dentro** (ressalva viva nº 1 do `CONTAI-010`). Nesse estado, o app
não é apenas incompleto: se gerasse hoje a discriminação de 2026, produziria um
bem cujo valor **encolhe** de um ano para o outro sem alienação — inconsistência
patrimonial que chama atenção sozinha `[Likely]`, e que contradiz uma declaração
já entregue.

**A trava não está preservando a qualidade do dado. Ela está mantendo o app em um
estado cujo output contradiz a DAA já apresentada.** Este é, sozinho, motivo
suficiente para removê-la.

### 2.4 Onde os dois números aparecem

`[Certain]` No relatório anual, **nunca um número só**: total confirmado e, em
linha nomeada logo abaixo, o valor pago sem comprovante. Mesma disciplina do
critério 20 do `CONTAI-010` (juros em linha nomeada própria): *item incluído em
silêncio é o pior dos mundos; nomeado, é posição declarada*. Vale nos dois
sentidos — **excluído** em silêncio também.

---

## 3. P3 — o dinheiro que saiu da conta do cônjuge

### 3.1 Registro do fato novo

Fato apurado em 23/08, inédito no projeto: **parte dos desembolsos do terreno
saiu da conta bancária do cônjuge do Mateus, parte da conta dele.** Não temos
registrado o **regime de bens** do casamento nem a **titularidade na
escritura/matrícula**. Fica escrito aqui porque fato da obra não mora no
`CLAUDE.md`.

### 3.2 O comprovante em nome dela serve?

**Ele não é imprestável, e não é suficiente sozinho.** `[Certain]` Ele prova
perfeitamente **que o pagamento ocorreu, quando e por quanto**. O que ele
**não** resolve é a terceira coisa que o comprovante existe para provar (ADENDO
2 §2, item 3): **que o dispêndio foi dele**. Essa resposta não está no
comprovante — está no regime de bens e na matrícula.

⚠️ **Regra imediata, e é a única coisa que o app faz sozinho aqui** `[Certain]`:
**não descartar e não converter.** O comprovante em nome dela é anexado e
guardado como está; o app **não** o registra como se fosse dele — isso seria
inventar fato, que é a proibição estrutural deste projeto.

### 3.3 O que muda conforme os três eixos

**(a) Regime de bens**

- **Comunhão parcial** (regime legal supletivo brasileiro): o imóvel adquirido a
  título oneroso **na constância do casamento** comunica-se, **ainda que só em
  nome de um dos cônjuges** — Código Civil, art. 1.658 c/c art. 1.660, I.
  `[Certain]` quanto à substância; `[Likely]` quanto à numeração exata. O recurso
  que saiu da conta dela é recurso **comum**; o dispêndio é do casal. Este é o
  cenário benigno.
- **Comunhão universal**: idem, com alcance maior. `[Likely]`
- **Separação total (convencional)**: o cenário perigoso. `[Likely]` O pagamento
  feito por ela de um bem registrado **só no nome dele** não é dispêndio dele —
  é, conforme o caso, **coproriedade de fato** ou **doação**, esta última com
  possível incidência de **ITCMD estadual**. Aqui o valor pago por ela **não
  entra no custo de aquisição dele** sem tratamento próprio, e isso muda o
  número da venda.
- **Data do casamento × data da aquisição** importa: bem adquirido **antes** do
  casamento não se comunica na comunhão parcial. `[Likely]`

**(b) Nome na escritura/matrícula**

`[Certain]` A matrícula é quem diz **de quem é o bem** perante terceiros e perante
o Fisco na venda. Se constarem os dois, a alienação futura gera ganho de capital
para **duas** pessoas, cada uma apurando a sua parte no GCAP, com **duas** DAAs,
**dois** DARFs e o fator de redução e a isenção do art. 39 da Lei 11.196/2005
contados **por pessoa**. Isso não é detalhe de cadastro: é o desenho do
`CONTAI-011` e da saída anual inteira.

**(c) Quem declara o bem na DAA**

`[Likely]` Bens comuns podem ser declarados integralmente por um dos cônjuges ou
em partes por cada um, conforme a forma de declaração adotada (em conjunto ou em
separado) — **confirmar no Perguntas e Respostas IRPF do ano**. O que é
`[Certain]`: **o custo tem de seguir o bem.** Quem declara o bem declara o custo;
declarar o bem em uma DAA e o custo em outra não fecha em lugar nenhum, e o
desencontro só aparece na venda, quando não há mais como consertar de graça.

### 3.4 ⛔ Onde eu paro

**Não emito posição sobre qual desses cenários é o do Mateus, e o requisito não
deve fixar nenhum.** Faltam três fatos, e supor qualquer um deles é o defeito
que este parecer inteiro combate. Além disso, uma vez conhecidos, **a decisão de
como declarar o bem e o custo entre os dois cônjuges exige profissional com
CRC** — não é apuração automática.

### 3.5 O que o app precisa passar a guardar

**Por desembolso** (e, pela mesma razão, por pagamento de obra) `[Certain]`:

1. **`origem_conta`** — de qual conta o dinheiro saiu: **minha / do meu cônjuge /
   de outra pessoa**. Sem default, campo vazio pergunta (regra dura do projeto).
   É o dado que hoje se perde: daqui a seis anos, um comprovante com o nome dela
   sem contexto é uma dúvida sem resposta.
2. **Titular do comprovante**, quando não for ele — nome como consta no
   documento. Fato transcrito, não interpretado.

**Uma vez, no cadastro da obra/perfil** `[Certain]` — não por desembolso:

3. **Regime de bens** do casamento.
4. **Titularidade na matrícula** do imóvel: só ele / os dois / outra composição.
5. **Quem declara o bem** na DAA.

Os itens 3–5 são **de obra, não de linha**. Perguntá-los a cada desembolso seria
repetir uma pergunta cuja resposta não muda, e é o tipo de atrito que produziu
este relato.

⚠️ **Enquanto 3–5 estiverem vazios**, todo desembolso com `origem_conta ≠ minha`
é **pendência de revisão profissional**, não erro e não bloqueio: o valor grava,
aparece nomeado, e o relatório anual o destaca para o CRC. `[Certain]`

---

## 4. Textos de tela — literais, copiar sem reescrever

Regra do §C(b) do parecer de 18/08: **quem implementa não reescreve texto com
consequência fiscal.** Datas em **dd/MM/aaaa** (ADENDO 3 §G.2).

### 4.1 Chip da pendência

> **Pago sem comprovante**

Mesmo chip das outras superfícies (ADENDO 3 §G.3: *o chip nomeia o fato, que é o
mesmo; o que muda é a consequência*).

### 4.2 Texto da pendência do desembolso do terreno

> **Pago sem comprovante.**
> O valor e a data ficam registrados — o custo existe, ainda não está
> demonstrável. Enquanto faltar o papel, este desembolso não entra no custo
> confirmado.
> Recupere o comprovante enquanto o banco ainda o mostra: ele é o documento do
> acervo que expira primeiro.

### 4.3 Linha auxiliar — o que serve como comprovante, por tipo

Exibida junto da pendência. `[Likely]` quanto à reemissão pela prefeitura e pelo
cartório — é prática corrente, **confirme antes de prometer prazo**.

> **Entrada ou sinal** — comprovante da transferência, ou recibo do vendedor. A
> escritura prova o preço, não o pagamento.
> **ITBI** — a guia paga, com a autenticação. A prefeitura costuma reemitir a
> segunda via.
> **Escritura e registro** — o recibo de custas do cartório, que costuma
> reemitir.

### 4.4 A pergunta da conta

> **De qual conta saiu esse dinheiro?**
> [ Da minha ]  [ Da conta do meu cônjuge ]  [ De outra pessoa ]
> Comprovante em nome de outra pessoa não invalida o custo, mas muda quem pode
> declará-lo. Registre de quem é — quem decide o resto é o contador, com o
> regime de bens e a escritura na mão.

### 4.5 Linha do relatório anual

> **Fora do custo confirmado por falta de comprovante: R$ 0.000,00.**
> Foi pago e está registrado, mas ainda não tem o papel que o demonstra, e por
> isso não entra na soma acima. Decida com seu contador antes de declarar:
> deixar de discriminar na declaração um custo real também custa caro — o custo
> que não é discriminado não existe na venda.

### 4.6 O que NÃO vai para tela nenhuma

`[Certain]` Nenhum texto afirma qual regime de bens se aplica, quem é o dono do
imóvel, ou que o pagamento do cônjuge "conta" ou "não conta" como custo dele. O
app **nomeia a incerteza e pede o dado que a resolve** — mesma disciplina do
ADENDO 3 §G.3.

---

## 5. Automático × humano × CRC

**Sistema sozinho** `[Certain]`
Gravar sempre o fato consumado; manter o desembolso sem comprovante **fora do
custo confirmado**; exibir a pendência com superfície própria; cobrar o anexo na
revisão pré-declaração; separar as duas pendências (sem data / sem comprovante);
guardar `origem_conta` sem interpretá-la; marcar como "revisão profissional" todo
desembolso pago por terceiro.

**Só o Mateus**
Recuperar o comprovante enquanto o banco ainda o mostra; responder de qual conta
saiu cada valor; responder as três perguntas do §7.

**Exige CRC** `[Certain]`
Se o custo pago pela conta do cônjuge integra o custo **dele**, e em que
proporção · como bem e custo se dividem entre as duas DAAs · a decisão de
discriminar na DAA um custo ainda sem comprovante em mãos · qualquer retificadora
do ano-base 2025 decorrente disto.

**Continua "confirmar"**
A letra do inciso/alínea do art. 17 da IN SRF 84/2001 vigente · o regime e o
prazo da retificadora no ano · o tratamento de bens comuns no Perguntas e
Respostas IRPF do ano · a incidência de ITCMD na hipótese de separação total ·
a reemissão de guia de ITBI e de recibo de custas.

---

## 6. Alerta obrigatório — equiparação a pessoa jurídica

`[Certain]` Nada neste parecer altera o alerta permanente: se o padrão de uso
indicar **construção habitual para venda** (art. 166 e seguintes do RIR/2018), o
regime muda por completo e **nenhuma** conclusão aqui sobrevive. O caso analisado
é o de **uma** residência, construída pelo próprio proprietário, com venda futura
provável.

---

## 7. As três perguntas ao Mateus — uma frase cada

1. **Qual é o regime de bens do seu casamento** — comunhão parcial, comunhão
   universal ou separação total?
2. **Na escritura e na matrícula do terreno, consta só o seu nome ou o de vocês
   dois?**
3. **Na declaração do ano-base 2025, quem declarou o terreno** — você, ela, ou
   vocês declaram em conjunto?

⚠️ Se a resposta 1 for **separação total** ou a 2 trouxer **os dois nomes**, o
requisito que nascer deste relato muda de tamanho: deixa de ser "liberar o
registro" e passa a incluir **a divisão do bem e do custo entre duas pessoas**,
que atinge a discriminação de Bens e Direitos, o GCAP e o acervo. Não escreva o
ticket antes dessas respostas.

---

## 8. Resumo executivo

| # | Pergunta | Resposta |
|---|---|---|
| **P1** | Grava sem comprovante? | **Sim.** A assimetria de hoje **não tem fundamento fiscal** — é o defeito do ADENDO 2 §5 reintroduzido. A trava do **informe anual** (critério 10) fica, por motivo diferente e legítimo. |
| **P2** | Entra no total do ano? | **No custo confirmado, não** (automático). **Na discriminação da DAA, não é o app que decide** — os dois números aparecem nomeados; a escolha é do Mateus com o CRC. Direção segura: registrar é reversível, omitir da DAA não é. |
| **P3** | Comprovante da conta dela serve? | **Não se descarta e não se converte.** Depende de regime de bens, matrícula e quem declara o bem. **Paro aqui**: faltam três fatos e a decisão exige CRC. O app passa a guardar `origem_conta` por desembolso e três fatos de obra. |

---

# ADENDO 1 — 2026-08-23 · as seis superfícies de registro: o veredito uma a uma

- **Origem**: rodada 2 do `po`, com correção de escopo do Mateus — *"eu **não**
  quero afrouxar isso para terreno, eu quero afrouxar isso para **qualquer
  despesa**. (…) Neste momento **está me bloqueando** de usar o app até eu
  coletar todos os comprovantes de transferências."* Presente do indicativo: é
  dor ativa, não histórica.
- **Normativo para**: as seis superfícies de registro do app; substitui, onde
  divergir, o §1 do corpo deste parecer e o ADENDO 2 §6 de 18/08.
- **Escopo já decidido pelo Mateus**: afrouxar. O que segue é **como**, e
  **onde não**.

---

## A.0 O erro de enquadramento que produziu as seis regras diferentes

`[Certain]` "Anexo obrigatório no ato do registro" foi escrito como se o anexo
fosse sempre a mesma coisa. **Não é.** Ele exerce **dois papéis fiscalmente
opostos**, e o papel — não a tela, não o rigor de quem implementou — decide o
veredito:

- **PROVA** — o dado gravado é um **fato que o usuário conhece** (pagou R$ X em
  dd/MM/aaaa; a nota do Fulano é de R$ Y). O papel **corrobora** o fato. Sem ele
  o fato continua verdadeiro, só menos demonstrável.
- **FONTE** — o dado gravado **só existe dentro do papel** (as sete rubricas do
  informe; o valor novo da nota reemitida). Sem o papel, o que se digita é
  **memória**, e gravar memória como fato é a proibição estrutural deste
  projeto.

**Bloquear anexo-PROVA não evita erro nenhum: evita o registro.** Bloquear
anexo-FONTE evita fato inventado entrando na base. As seis superfícies foram
tratadas como uma só disciplina; são duas.

## A.1 O teste, em duas perguntas — é ele que generaliza, não a regra

`[Certain]`

> **1. O anexo é FONTE do dado ou PROVA do fato?**
> Fonte → **recusa**. Prova → candidato a liberar.
>
> **2. Esperar pelo papel perde o fato?**
> Perde → **grava e cobra**. Não perde → **pode recusar**, e recusar sai mais
> barato que mais uma pendência para alguém completar.

A segunda pergunta é a que faltava, e é ela que separa a superfície 6 das
demais. Papel que **não expira** (extrato publicado pelo banco, nota que o
emitente ainda vai emitir) pode ser esperado sem custo. Papel que **expira**
(comprovante de PIX, mídia de WhatsApp) não: esperar é perder — ADENDO 2 §4 de
18/08, *"o comprovante é o documento mais perecível do acervo e o único que o
app pode capturar de graça no instante em que existe"*.

## A.2 O veredito, superfície por superfície

| # | Superfície | Papel do anexo | Esperar perde o fato? | Veredito |
|---|---|---|---|---|
| 1 | `/adicionar/pagamento` | prova | sim | **grava e cobra** — já está certo |
| 2 | `/compromisso/[id]/confirmar` | prova | sim | **grava e cobra** — já está certo |
| 3 | `/adicionar/documento` | **prova** | **sim** | **LIBERAR**, com as três guardas do §A.3 |
| 4 | terreno · desembolsos | prova | sim | **LIBERAR** (§1.1 do corpo) |
| 5 | terreno · informe anual | **fonte** | não | **MANTÉM A RECUSA** |
| 6 | `/documento/[id]/corrigir/*` com `emitente_corrigiu_a_nota` | **fonte** | **não** | **MANTÉM A RECUSA** (§A.4) |

---

## A.3 Q1 — `/adicionar/documento` é o caso do desembolso. Libera.

`[Certain]` **O `po` empatou porque comparou o anexo com o registro; a comparação
correta é entre o anexo e os DADOS que se está gravando.**

Emitente, CNPJ, tipo, número e valor **não são lidos do PDF** — ele os lê na
mensagem do WhatsApp ou no corpo do e-mail e os digita. Isso é fato apurado da
obra (Q1 do backlog: *notas chegam por WhatsApp e e-mail*). O arquivo é **prova
do que ele digitou**, não fonte. Papel de PROVA, teste 1 passa.

E esperar **perde o fato**: mídia de WhatsApp desaparece com a conversa e com a
troca de aparelho; e-mail com nota some no volume. Pior: **nota nunca registrada
é nota nunca cobrada.** A cobrança do emitente só é acionável enquanto **há
parcela a liberar** (§4 do parecer de 17/08) — e essa janela fecha sozinha. Teste
2 passa.

⚠️ **O argumento "a NF *é* o documento hábil" está certo e é irrelevante para
gravar.** Ele é decisivo para **contar**, e é aí que ele entra — na guarda 1.

**O `po` também está certo sobre o precedente**: o projeto já convive com
**"pago sem nota"** — custo cuja nota não está no acervo. O registro sem arquivo
é o **espelho** disso: nota conhecida cujo papel não está no acervo. Modelar
metade da assimetria e recusar a outra metade é incoerência, não rigor.

### As três guardas — sem elas a liberação é defeito, não melhoria

**Guarda 1 — não levanta o teto do custo.** `[Certain]`
O custo comprovado é `C = min(Σ pagamentos elegíveis, Σ documentos hábeis)`.
O lado do **pagamento** sem comprovante, se contasse, empurraria o **piso**;
o lado do **documento** sem arquivo, se contasse, **levantaria o teto** — ou
seja, **liberaria custo confirmado que não tem lastro nenhum**. Isso é custo
inflado em Bens e Direitos, que é *redução indevida de ganho de capital, cobrada
com multa* (parecer de 17/08, §"por que preço da escritura não é erro
cosmético"). **Documento sem arquivo não entra em `Σ documentos`. Ponto.**

Não há aqui a nuance do §2.1 do corpo (o app mostra, o Mateus decide): lá o
número subestimava; aqui superestimaria. **Direção do erro invertida, tratamento
invertido.**

**Guarda 2 — não abate a aferição do INSS, e essa é mais dura que a 1.**
`[Certain]` — resposta direta à pergunta do `po`.
A base do SERO só é reduzida por **NF de serviço de PJ com retenção de 11%
recolhida e declarada** (eSocial/EFD-Reinf) pela empresa. Três motivos, e cada
um bastaria:

1. O app **não tem como ver a retenção** sem a nota. A resposta do formulário é
   declaração do usuário, não leitura do papel.
2. O abatimento não é número que ele defende depois — é **dedução pleiteada
   perante a Receita** na regularização da obra.
3. O erro aqui **não** custa glosa na venda: custa **pagar o INSS duas vezes**,
   uma ao prestador e outra na regularização. É o dano nomeado na definição do
   agente e no `CLAUDE.md`.

A pergunta da retenção **continua obrigatória no formulário** (critério 5;
*"não sei"* segue valendo como resposta) — ela é pergunta de fato, não de papel.
O que não acontece sem arquivo é o **abatimento**, qualquer que seja a resposta.

**Guarda 3 — não nasce `registrado`, e os dois checks fiscais são REPERGUNTADOS
quando o arquivo subir.** `[Certain]`
O check *"a nota está no seu CPF?"* é pergunta sobre **o que está impresso no
papel**. Respondê-la sem o papel à vista é o **"flip barato"** que o §2 do
parecer de 18/08 (correção de documento) manda impedir — e cuja mitigação é
literalmente *"anexo visível na tela, afirmação explícita e rastro"*. Sem anexo
não existe "anexo visível na tela".

Logo: enquanto não há arquivo, as respostas ficam gravadas como **declaradas de
memória**, e o registro **não é `registrado`**. Quando o arquivo subir, o app
**repergunta CPF e retenção — nunca herda a resposta anterior**. Isso não é
regra nova: é exatamente o que a tabela do §1 daquele parecer já manda fazer
quando `tipo` muda dentro da família NF.

⚠️ **Nota de engenharia, não de fisco** (para o `cto-obra`, não para mim
decidir): `documento.arquivo_path` é `not null` na `0001`, e
`status_documento` não tem valor para este estado. A liberação **exige
migration**. `quarentena` **não pode ser reaproveitada**: ela significa
*destinatário ≠ CPF*, `motivo_quarentena` é escrito pelo sistema e `status` é
campo **derivado e NÃO CORRIGÍVEL** pelo parecer de 18/08 — sobrecarregá-lo
corrompe os três.

---

## A.4 Q2 — a superfície 6 mantém a recusa. E não é por rigor.

`[Certain]` **Três razões independentes; a primeira já bastaria.**

**1. O anexo é FONTE.** O valor novo **é o que está impresso na nota
reemitida**. Sem ela, o que se digita é o número que ele acha que a nota nova
vai trazer. Gravar isso é inventar fato — teste 1 reprova.

**2. Esperar não perde absolutamente nada** — e este é o ponto que separa a 6 da
3 e da 4. A nota reemitida **ainda não existe no mundo**; ela está sendo emitida
pelo emitente, que tem obrigação de entregá-la. Não há mídia expirando, não há
janela fechando. Enquanto ela não chega, **o registro atual continua CERTO**:
ele descreve fielmente o papel que está no acervo. Não há fato se perdendo —
teste 2 reprova.

**3. Aqui se mexe em número já declarado.** `corrigirValorDoDocumento` carrega
`anos: AnoAfetado[]` e gera **pendência de retificadora**. Alterar um número que
já foi para a DAA com lastro em nota lembrada é o pior arranjo possível: produz
divergência entre acervo e declaração, que é — palavras do §2 daquele parecer —
*"a única coisa que a fiscalização olha"*.

⚠️ **O `po` levantou o rastro de correção como argumento a favor de liberar. Ele
é argumento CONTRA.** `[Certain]` O rastro registra **que** mudou e **por quê**;
ele não cria lastro para o valor novo. Um rastro apontando para um anexo que não
existe documenta a fragilidade, não a resolve — e ainda a torna auditável contra
ele.

**A saída já existe no modelo e é melhor que liberar**: `arquivo_path` é **NÃO
CORRIGÍVEL** — *anexa-se adicional*. Quando a nota reemitida chegar, ela entra
como **anexo adicional** (ou registro novo, pela regra de família) e a correção
grava no mesmo ato. **A ausência de trava aqui não desbloqueia nada que a espera
não desbloqueie sozinha.**

---

## A.5 Q3 — não é "nenhuma além da 5". São a 5 e a 6.

`[Certain]`, com todas as letras, como pedido:

- **Superfície 5 (informe anual)** — recusa mantida. Anexo é fonte: sem o
  extrato, as sete rubricas são memória e a trava da soma (critério 11 do
  `CONTAI-010`) não tem contra o que fechar. **Nenhum texto novo**: o do
  critério 10 permanece.
- **Superfície 6 (correção por reemissão)** — recusa mantida, pelos três motivos
  do §A.4.

**Nenhuma outra.** As superfícies 1, 2, 3 e 4 gravam. Não fica meia-liberação em
pé.

⚠️ **O perigo que a liberação CRIA — e que não existia antes**: liberada a 3, o
app passa a admitir um `documento` que **nunca existiu**, afirmado de memória, e
que um dia pode ser "completado" com um arquivo qualquer. As guardas 1 e 3 do
§A.3 são a resposta, e **não são opcionais**: sem entrar em `Σ documentos`, o
registro falso não vale nada para ele; com a repergunta dos checks no momento do
arquivo, a afirmação fiscal só é feita com o papel à vista. **Se o ticket cortar
a guarda 1 ou a 3, a liberação da superfície 3 vira defeito e este parecer não a
sustenta.**

E a de sempre `[Certain]`: **toda pendência criada aqui precisa de superfície
própria** (defeito **D47**, §1.5 do corpo). Quatro superfícies gravando e
nenhuma cobrando é trocar "não registra" por "registra e esquece" — que na venda
dá no mesmo, com a agravante de parecer resolvido.

---

## A.6 A linha do `CLAUDE.md` — **recomendação**, não alteração

⚠️ **Não toquei no arquivo.** Quem decide isso é o Mateus. Recomendo que a
premissa *"anexo obrigatório no ato do registro"* passe a ler:

> **Anexo exigido no ato do registro, com o papel do anexo decidindo a
> consequência.** Quando o anexo é **prova** de um fato que já aconteceu
> (comprovante de pagamento, arquivo da nota que ele já leu), a ausência **grava
> como pendência fiscal explícita e nunca recusa o registro** — o valor fica
> fora do custo confirmado até o papel chegar. Quando o anexo é a **fonte** do
> dado que se está gravando (extrato do informe anual, nota reemitida numa
> correção), **sem o papel não há o que gravar, e o registro é recusado**.

Duas frases, operacional, e cobre as seis superfícies sem exceção nomeada.

---

## A.7 Textos de tela — literais. O `po` copia, não redige.

Datas em **dd/MM/aaaa** (ADENDO 3 §G.2 de 18/08). Os textos do desembolso do
terreno (superfície 4) estão no **§4 do corpo** deste parecer e não se repetem
aqui.

### A.7.1 Superfície 3 — no ato de salvar sem o arquivo

> **Salvar sem o arquivo da nota?**
> Os dados ficam guardados e servem para cobrar a nota do emitente enquanto você
> ainda tem parcela a liberar.
> Sem o arquivo, esta nota **não sustenta custo nenhum** e **não abate a
> aferição do INSS desta obra** — o abatimento depende da nota de serviço com a
> retenção de 11%, não da lembrança dela.
>
> [ Salvar e cobrar a nota ]   [ Anexar agora ]

### A.7.2 Superfície 3 — chip e pendência

Chip: **Nota sem arquivo**

*(chip distinto de "pago sem nota", que é outra coisa: lá falta a nota inteira;
aqui a nota é conhecida e falta o papel dela)*

> **Nota sem arquivo.**
> Você registrou os dados da nota, mas o arquivo não está no acervo. Enquanto
> não estiver, ela não entra no custo comprovável e não abate a aferição do
> INSS.
> Peça o arquivo ao emitente agora: nota que ficou só na conversa desaparece com
> a conversa, e o próximo pagamento é a última hora em que você tem como
> cobrá-la.

### A.7.3 Superfície 3 — quando o arquivo chegar (repergunta dos checks)

> **Agora com a nota na mão, confirme o que está impresso nela.**
> Você respondeu de memória quando registrou. As perguntas voltam porque agora
> há papel para conferir — e é o papel que a fiscalização lê, não o app.

### A.7.4 Superfície 6 — a recusa, explicada

> **A nota corrigida ainda não chegou.**
> O valor novo vem do papel novo — e aqui você mudaria um número que já foi
> declarado. Sem a nota reemitida, não há o que gravar.
> Enquanto ela não chega, **este registro continua certo**: ele descreve a nota
> que está no acervo. Quando ela chegar, anexe e corrija no mesmo ato. **Nada se
> perde esperando.**

### A.7.5 O que nenhuma dessas telas diz

`[Certain]` Nenhuma afirma que o registro sem arquivo "vale" ou "conta"; nenhuma
promete que anexar depois recupera o custo de um ano já declarado sem
retificadora; nenhuma usa "regime de caixa", "previsto/efetivado" (critério 7) ou
o nome de qualquer ficha do programa do ano.

---

## A.8 Automático × humano × CRC (deste adendo)

**Sistema sozinho** `[Certain]`
Gravar nas superfícies 1–4; recusar nas 5 e 6 com o texto do §A.7.4; manter
documento sem arquivo fora de `Σ documentos` e fora da aferição do INSS;
reperguntar os dois checks fiscais quando o arquivo subir; dar superfície própria
a cada pendência; listar as quatro pendências na revisão pré-declaração.

**Só o Mateus**
Buscar o arquivo enquanto a conversa ainda existe; cobrar a nota do emitente
enquanto há parcela a liberar; decidir se o `CLAUDE.md` recebe a linha do §A.6.

**Exige CRC** `[Certain]`
Nada de novo neste adendo — as três frentes de CRC continuam sendo as do §5 do
corpo. As decisões aqui são de **momento de registro e de composição de número
interno**, não de tributação.

**Continua "confirmar"**
Nada novo. As pendências de confirmação são as já listadas no §5 do corpo.

---

# ADENDO 2 — 2026-08-24 — os três textos adjudicados no Gate 2 do `CONTAI-025`

⚠️ **Por que este adendo existe, e a crítica é do `po` no Gate 4:**

> *"Os três textos que o `contador` adjudicou no Gate 2 deste ticket estão no mock
> e em comentário de código, **e não em `docs/pareceres/`**. O `CLAUDE.md` diz, em
> letras: 'parecer que só existe no transcript é a mesma falha que a regra proíbe,
> com outro nome'. **Fechamos a D49 abrindo a semente da próxima.**"*

Transcritos aqui, literais, na mesma sessão em que foram adjudicados.

## A.1 — O quarto rótulo do botão Gravar

O ticket grava **quatro** combinações (com/sem data × com/sem comprovante) e o
corpo deste parecer só dava três rótulos. O que faltava:

> **Gravar — e abrir a pendência da data que falta**

**A simetria óbvia foi RECUSADA**, e o fundamento vale para além deste caso:

> *"'da data' vs 'de datas' faz uma distinção fiscal real depender de **uma
> letra**, no mesmo botão, no mesmo formulário — no `CONTAI-027` o estado 'mais de
> uma data' nasce de uma resposta **nessa mesma tela**. É a D46 com outro nome."*

**O singular/plural não pode carregar a distinção — a palavra tem que carregar.**
O *"que falta"* nomeia `DESEMBOLSO_SEM_DATA` (**valor sem ano-calendário**) e o
separa de `PENDENCIA_MAIS_DE_UMA_DATA` (**valor no custo, ano em aberto**), que é
fato diferente e mais brando.

⚠️ O rótulo do `CONTAI-027` (*"pendência de datas"*) **ficou ambíguo** com a
existência de um segundo estado de data. Alinhá-lo é **ticket P2 próprio** — está
em mock aprovado e em código. **Não bloqueia.**

**Os quatro rótulos, completos:**

| Data | Comprovante | Rótulo |
|---|---|---|
| tem | tem | `Gravar o desembolso` |
| tem | falta | `Gravar — e abrir a pendência do comprovante` |
| **falta** | tem | **`Gravar — e abrir a pendência da data que falta`** |
| falta | falta | `Gravar — e abrir as duas pendências` |

## A.2 — Data no futuro, no formulário de REGISTRO

O texto anterior vinha do `CONTAI-010` e oferecia **só** a saída que apaga o
custo. Com a liberação da gravação, **o erro mais provável passou a ser data
errada num pagamento real** — e a mensagem empurrava para `previsto`.

> **Data no futuro — o dinheiro não pode ter saído depois de hoje. Se você errou
> a data, corrija-a; se não lembra, deixe o campo vazio: o valor grava assim mesmo
> e a data fica como pendência. Só marque 'ainda não paguei' se o dinheiro
> realmente não saiu — isso tira este valor de todo ano-calendário.**

**Três saídas, na ordem certa**, e a que apaga o custo vem **por último, com a
consequência dita**. Sem jargão de ficha (§A.7.5).

⚠️ **Isto NÃO viola o critério 6 / §1.4.1.** A proibição é oferecer `previsto`
como fuga a **valor já pago**; aqui o **próprio dado do usuário** diz que o
dinheiro não saiu — é **contradição interna, não escape**.

## A.3 — Data no futuro, no ato de COMPLETAR

**Constante SEPARADA, não a mesma renomeada.** O ato é outro: aqui a linha **já
está gravada como paga**, `previsto` não é alcançável, e *"deixe o campo vazio"*
seria contraditório — o ato existe **para informar a data**.

> **Data no futuro — o dinheiro não pode ter saído depois de hoje. Confira a data
> no extrato: é ela que decide o ano-calendário deste custo. Se não achar agora,
> saia sem gravar — a pendência continua aberta e nada se perde.**

**A saída segura é SAIR SEM GRAVAR**, e o texto anterior não a nomeava.

> *"São dois atos diferentes, e colapsar os dois textos é o que faria o 'deixe
> vazio' aparecer onde não cabe."*

⚠️ **Texto que nomeia uma saída obriga a saída a existir.** No Gate 3 foi
conferido que o botão `Cancelar` está no mesmo formulário, **visível no instante
em que o erro aparece** — *"texto que nomeia controle inexistente seria regressão
pior que a redação antiga"*.

## A.4 — A régua de cor, revisada no mesmo dia

Registrada por extenso em
`docs/backlog/25-2026-08-23-a-regua-de-cor-e-o-que-ela-escondia.md`. A **D39**
original tinha dois níveis para três fatos e atropelava a gradação já ratificada
no parecer de 2026-08-18 (§601-602): **PJ pago sem comprovante é âmbar** (a NF
hábil já sustenta o custo), **PF é vermelho** (o comprovante é constitutivo).

> **saiu? → tem apoio hábil no ano certo? → não = vermelho**

**"Falta a data" é vermelho**: o valor não cai em **ano nenhum**, enquanto *"mais
de uma data"* — **menos grave**, valor no custo com o ano em aberto — já era
vermelha. O app pintava **o caso pior de âmbar e o brando de vermelho**.
