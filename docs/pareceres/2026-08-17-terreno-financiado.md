# Parecer fiscal — terreno adquirido com FINANCIAMENTO

- **Data**: 2026-08-17 · **Autor**: agente `contador`, execução read-only
- **Provocação**: pergunta do Mateus, com o app já em produção e a obra cadastrada
- **Veredicto**: **o campo `valor_terreno` em produção está fiscalmente errado
  para terreno financiado** — e o erro é de **forma**, não de valor: nenhum
  número único resolve.

> Transcrição do parecer do agente `contador`. `[Certain]` / `[Likely]` /
> `[Guessing]` são dele. Nada aqui substitui contador humano (CRC).

---

## 0. A resposta desconfortável

Se o Mateus digitou **o preço da escritura** no campo "valor do terreno", o
número está errado. Se digitou **"o quanto já paguei"**, está certo **hoje** e
errado **em 31/12** — porque esse número não é atributo da obra, é um **saldo
que muda todo ano**.

O app modelou o terreno como escalar porque assumiu compra à vista. Com
financiamento, o terreno tem **exatamente a mesma forma que a construção já
tem**: uma sequência de desembolsos datados que se acumulam. O app já sabe fazer
isso — só não sabia que precisava fazer para o terreno.

E há um segundo erro, mais caro: **a regra "juros de financiamento ficam fora do
custo" não sobrevive ao caso de imóvel.** Vale para cartão (Q4), não vale aqui.
Ver 2d — **o contador muda de posição**, com ressalva de confirmação.

---

## 1. O campo `valor_terreno` — o que está errado e o que fazer hoje

O app tem `obra.valor_terreno numeric(14,2)`, mais `valor_itbi` e
`valor_escritura_registro` (`0004_obra_multipla.sql`), somados por
`custoTerrenoCentavos()` e injetados **integralmente em todo ano** em
`lib/fiscal/resumo.ts:199`.

O CONTAI-010 já diagnosticou metade (valor sem data). **O financiamento quebra a
outra metade: não é um valor com uma data, são N valores com N datas.** A
pergunta 1 do Gate Fiscal do CONTAI-010 previu o caso — a resposta é **sim, o
terreno vira lista de desembolsos**, e o ticket sai de S para **M**.

### O número correto para Bens e Direitos

[Likely, confiança alta — **confirmar no "Perguntas e Respostas IRPF" do ano**]

| Candidato | Serve? |
|---|---|
| Preço contratado (o da escritura) | **Não** — inclui o que o banco pagou e ele ainda não |
| Só a entrada | **Não** — congela no ano 1 e ignora as parcelas |
| Total pago até hoje | **Quase** — é a forma certa, mas "hoje" é a data errada |

O correto é **o total efetivamente desembolsado por ele até 31/12 do ano
declarado** — entrada + parcelas pagas naquele e nos anos anteriores + ITBI +
escritura/registro (+ juros, se confirmado o 2d). É um número **por ano**, e por
isso não cabe numa coluna.

### O que corrigir HOJE, com uma obra só no banco

1. **Trocar o conteúdo de `valor_terreno` pelo total efetivamente pago do
   principal até hoje** (entrada + parcelas quitadas), **não** pelo preço da
   escritura. É provisório e some quando o CONTAI-010 revisado entrar.
2. **Registrar em anotação da obra, hoje, antes que se perca**: preço
   contratado, instituição, nº do contrato, data do contrato, valor e data da
   entrada, valor da parcela, nº de parcelas, saldo devedor atual. **Nada disso
   tem campo.** Papel de banco desaparece; preço de escritura, não.
3. **Não criar campo de "dívida"** nem lançar saldo devedor em nenhum lugar do
   custo (item 3).

### Por que "preço da escritura" não é erro cosmético

[Certain] Declarar o bem pelo preço integral **sem** declarar a dívida
correspondente produz **evolução patrimonial sem lastro de renda** — e, na
venda, custo de aquisição maior que o desembolso comprovado. Mesma moeda do
double-count do CONTAI-005 (§5): **custo inflado em Bens e Direitos é redução
indevida de ganho de capital, cobrada com multa.** Só que aqui não é display:
vai para a declaração.

Existe um par consistente alternativo — bem pelo preço cheio **e** dívida em
Dívidas e Ônus. **O app não vai oferecer esse par**, porque não é a orientação
da RFB para imóvel financiado, e porque misturar os dois pares (o erro provável)
é errado nas duas direções.

---

## 2. A regra, em "se X e Y → Z"

### a) Entrada / sinal / FGTS

- **Se** houve entrada paga em `D` **e** há comprovante de saída da conta do
  declarante (ou extrato de uso do FGTS) → **integra o custo no ano de `D`**.
  [Certain]
- **FGTS usado na entrada é desembolso dele** — recurso próprio, não do banco.
  Entra. [Likely]

### b) Cada parcela paga

- **Se** a parcela foi **efetivamente debitada** em `D` → **integra o custo no
  ano de `D`**. [Certain]
- **A chave continua sendo a data do pagamento** — não a do contrato, não a da
  escritura, não a do vencimento, não a competência ("parcela 14/240"). É a
  **data do débito no extrato**. Parcela com vencimento em 05/01/2027 debitada em
  28/12/2026 é custo de **2026**.
- Mesma sistemática da Q6 (NF consolidada em parcelas) e da Q4 (fatura de
  cartão): **o ano sai do desembolso.** [Certain]
- **Regra negativa**: proibido derivar o ano do número da parcela, do cronograma
  do contrato ou do vencimento. **Contrato é previsão; extrato é fato.**

### c) Saldo devedor em aberto

- **Não integra o custo** (não foi pago) **e não entra em Dívidas e Ônus** (item
  3). [Certain quanto ao custo; Likely quanto à ficha]
- **Ele não some**: reaparece integralmente como custo **no ano em que for
  quitado**, inclusive se a quitação for com o dinheiro da venda (item 6).
- Se aparecer em tela, com rótulo: *"não vai para a declaração"*.

### d) Juros do financiamento — **mudança de posição, e é o ponto mais caro**

**Leitura: os juros do financiamento imobiliário INTEGRAM o custo de aquisição.
A conclusão da Q4 não se estende ao financiamento do imóvel.**

- **[Likely, confiança alta — CONFIRMAR o inciso vigente antes de virar código
  ou tela]** A IN SRF 84/2001, art. 17, ao listar os componentes do custo de
  aquisição **de imóveis**, traz item expresso de **"juros e demais acréscimos
  pagos para a aquisição do imóvel"**, ao lado do ITBI, da contribuição de
  melhoria, do laudêmio, da corretagem e dos dispêndios de construção. **Não é
  analogia: é item de lista, e é específico de imóvel.**
- **Por que não contradiz a Q4** [Certain no raciocínio]: a Q4 decidiu duas
  coisas e só uma era sobre juros.
  - Vale integralmente aqui: *o custo entra quando o recurso sai*.
  - **Não se transporta**: *"encargo de financiamento não é custo"* era sobre
    juros de **cartão sobre compra de material** — encargo de financiar um
    **insumo**. Aqui são juros pagos **para adquirir o próprio imóvel**, que a
    lista alcança nominalmente. **Regra específica vence princípio geral.**
- **A tese contrária existe**: há leitura de que o item cobre juros do preço
  parcelado **com o vendedor**, não o custo de crédito bancário. [Guessing
  quanto a qual prevalece na malha.]
- **Correção monetária (TR, IPCA) paga na parcela**: mesmo tratamento
  ("demais acréscimos"), mesma ressalva. [Likely]

**Implicação prática, e é de captura, não de cálculo:** enquanto não confirmado,
o sistema **não pode decidir na entrada**. Tem de **guardar amortização e juros
separados, todo mês**, e decidir a composição **na saída** (relatório). Se ficar
tudo num valor só de parcela e a confirmação vier favorável, recuperar a
decomposição de 240 parcelas dois anos depois é impossível — o extrato analítico
não fica disponível para sempre.

**Captura irreversível no ato; decisão reversível no relatório.** É o mesmo
critério que colocou `numero` e `data_emissao` na R1 do CONTAI-004.

**Segunda implicação, de transparência**: se os juros entrarem, vão
**nomeados na discriminação**, nunca diluídos no total. Item contestado incluído
em silêncio é o pior dos mundos; incluído com nome é posição declarada.

**Pergunta que nasce daqui** [Guessing]: se o item alcança "juros pagos para a
aquisição do imóvel", alcança juros de financiamento **de construção**? A Q4
(material no cartão) segue de pé; vale perguntar ao CRC.

### e) Taxas do financiamento

[Likely, e é onde há menos certeza]

| Item | Leitura | Ação do sistema |
|---|---|---|
| ITBI | **Dentro** [Certain] | já tem coluna |
| Escritura e registro (inclui registro da alienação fiduciária) | **Dentro** [Certain] | já tem coluna |
| Tarifa de avaliação do imóvel | **Fora** — custo de obter crédito | capturar separado, **revisão humana** |
| Tarifa de administração do contrato | **Fora** — serviço bancário recorrente | capturar separado, **revisão humana** |
| Seguros MIP e DFI embutidos na parcela | **Fora** — cobertura de risco do mutuário | capturar separado, **revisão humana** |
| IOF | **Fora** | capturar separado, **revisão humana** |

**Regra dura: o sistema nunca soma dentro do custo item marcado "revisão
humana"** — mesmo tratamento já dado a marcenaria planejada.

---

## 3. Bens e Direitos e Dívidas e Ônus

### Situação em 31/12

[Likely, confiança alta — **confirmar no Perguntas e Respostas do ano**]

**Valor pago acumulado, nunca o preço contratado.** Terreno e casa continuam
sendo **um único item** (mesma matrícula):

```
situação 31/12 do ano anterior
+ desembolsos do terreno pagos no ano (entrada, parcelas, ITBI, escritura)
+ dispêndios da construção pagos no ano
```

Sem valorização, sem correção monetária, sem valor de mercado. [Certain]

### Dívidas e Ônus Reais: **NÃO**

E o porquê, que o Mateus vai pedir:

**A ficha Dívidas e Ônus existe para dar coerência à variação patrimonial — ela
explica um ativo que entrou no patrimônio sem renda que o justifique.** Como o
imóvel **nunca foi lançado pelo preço integral** (só pelo pago), o patrimônio
declarado **nunca incorporou os R$ do banco**. Lançar a dívida abateria um
passivo contra um ativo que não está lá: a evolução patrimonial ficaria
**negativa sem causa** — anomalia de malha tão boa quanto a oposta.

**Em uma frase:** a dívida acompanha o bem lançado pelo valor cheio. Bem lançado
pelo pago, dívida fora. **Os dois pares são consistentes; a mistura é que erra.**
[Likely, confiança alta]

Consequência: **o app não cria conceito fiscal de dívida.** Saldo devedor, se
aparecer, é texto da discriminação ou lembrete operacional — jamais linha de
apuração, jamais somado ou subtraído de qualquer número do painel.

---

## 4. Texto da discriminação — reescrita da parte do terreno

Substitui a primeira frase do **Bloco A** do parecer de 2026-08-16. O resto do
Bloco A não muda.

### Versão completa

```
IMÓVEL RESIDENCIAL EM CONSTRUÇÃO. Terreno matrícula nº [matrícula] do
[cartório], [município]/[UF], adquirido em [dd/mm/aaaa] pelo preço de
R$ [preço contratado], financiado junto a [instituição], contrato nº
[contrato]. Declarado pelo valor efetivamente pago, conforme regime de caixa:
entrada de R$ [entrada] paga em [dd/mm/aaaa] e R$ [parcelas pagas até 31/12]
em parcelas do financiamento pagas até 31/12/[ano], dos quais R$ [juros] a
título de juros e encargos do financiamento. Acrescido de ITBI de R$ [itbi],
pago em [dd/mm/aaaa], e de escritura e registro de R$ [escritura e registro],
pagos em [dd/mm/aaaa]. Saldo devedor do financiamento em 31/12/[ano]:
R$ [saldo devedor], não incluído por não ter sido pago.
```

### Versão curta (quando o campo não couber)

```
IMÓVEL RESIDENCIAL EM CONSTRUÇÃO. Terreno matrícula nº [matrícula] do
[cartório], [município]/[UF], adquirido em [dd/mm/aaaa] por R$ [preço
contratado], financiado junto a [instituição]; declarado pelo valor
efetivamente pago — R$ [total pago do terreno] até 31/12/[ano], incluídos
ITBI e escritura/registro. Saldo devedor em 31/12/[ano]: R$ [saldo devedor].
```

### Quatro regras de geração, novas

1. **A frase "declarado pelo valor efetivamente pago" não é enfeite e não é
   cortável.** É ela que explica por que o valor declarado é **menor que o preço
   da escritura** — a divergência mais visível desta declaração, e a primeira que
   um cruzamento com o registro de imóveis levanta. **Sobrevive a qualquer corte
   por limite de caracteres.**
2. **O saldo devedor aparece e é rotulado "não incluído por não ter sido
   pago"** — fecha a conta na cabeça de quem lê (pago + saldo = preço).
3. **Os juros vão nomeados ou não vão.** **Proibido incluir juros dentro de um
   total sem dizer.**
4. **Ordem de corte**, do primeiro a cair ao último a sobreviver: nº do contrato
   → data e valor da entrada em separado → nome da instituição → destaque dos
   juros → saldo devedor → *"declarado pelo valor efetivamente pago"*.

---

## 5. Fatos a capturar (modelagem é do `cto-obra`)

### Da aquisição (uma vez)

- **`natureza_aquisicao_terreno`** — à vista / financiado com instituição /
  parcelado direto com o vendedor / recebido (herança, doação, permuta). **É o
  campo que decide qual regra roda.** Hoje o app não pergunta, e por isso
  respondeu errado sozinho.
- Preço contratado, data do contrato, data da escritura, instituição credora,
  nº do contrato, nº de parcelas, sistema de amortização.
- Entrada: valor, **data do pagamento**, origem (próprio / FGTS), comprovante.

### De cada parcela (recorrente — é aqui que mora o dano)

- **Data do débito efetivo** (não o vencimento).
- Valor total debitado, **decomposto em cinco números**: amortização (principal),
  juros, correção/atualização, seguros (MIP/DFI), tarifas.
- Anexo: extrato ou boleto do mês.

### Anual

- Saldo devedor em 31/12 e **informe anual do financiamento** — documento hábil
  que sustenta o ano inteiro numa peça só.

### Na quitação

- Data, valor pago, **desconto por antecipação** (reduz o pago, logo reduz o
  custo — automático) e **multa/tarifa de quitação** (**fora do custo**,
  [Certain]).

### A parcela é um `pagamento` comum do app? **NÃO**

Quatro consequências fiscais, não gosto arquitetural. [Certain]

1. **Cairia como "pago sem nota" todo mês.** O documento hábil aqui é contrato +
   extrato/informe anual, não NF nem recibo. Geraria pendência vermelha
   recorrente e **inflaria o headline de "custo em risco"** que o CONTAI-005
   acabou de calibrar em R$ 49.850 — o mesmo defeito de moeda misturada que
   condenou boleto e INSS.
2. **O valor debitado não é integralmente custo.** Seguro e tarifa saem; juros
   estão sub judice. `pagamento` tem um valor só.
3. **A apuração INSS não vê nada disso** — não é material, não é mão de obra,
   não tem competência, não referencia CNO. Entraria como ruído.
4. **O favorecido é o banco**, e o cadastro de favorecidos existe para sustentar
   a ficha Pagamentos Efetuados e a cobrança de nota. Banco não pertence a
   nenhuma das duas.

**Natureza própria** — *desembolso de aquisição do terreno* — que alimenta
**exclusivamente** a apuração de custo (IRPF), **nunca** a base de aferição,
**nunca** o headline de risco, **nunca** Pagamentos Efetuados.

**O caso à vista vira caso degenerado do mesmo modelo** (um desembolso) — isso
resolve o CONTAI-010 inteiro em vez de duas vezes.

### Fecha as três perguntas do Gate Fiscal do CONTAI-010

1. **Parcelado/financiado → cada parcela no ano da sua quitação. SIM.** Uma data
   por componente **não basta**. Complexidade **M**.
2. **Juros → NÃO ficam fora**, ao contrário do que o ticket presumia da Q4.
   **É o item que muda o ticket.**
3. **Terreno recebido (herança, doação, permuta)** → há data de aquisição **sem
   desembolso**; o custo é o valor constante na declaração do doador/de cujus.
   **Logo o critério 2 do CONTAI-010 não pode ser absoluto** — "valor sem data é
   ingravável" só vale para aquisição onerosa. [Likely] A saída é o campo
   `natureza_aquisicao_terreno`.

---

## 6. O que muda na venda

- **[Certain] O preço de venda é o BRUTO da escritura.** Nunca líquido do saldo
  devedor. Se o comprador ou o banco dele quita o financiamento diretamente,
  aquele valor **foi recebido pelo Mateus** na forma de extinção de dívida.
  Subtrair o saldo é subdeclarar alienação, e o valor da escritura está no
  cruzamento da RFB via DOI do cartório. **Escrever isso na US-004 antes de
  alguém "simplificar".**
- **[Certain] A quitação do saldo devedor com o dinheiro da venda É dispêndio
  pago e integra o custo no ano da venda.** **Financiar não amputa o custo — só
  desloca o momento.**
- **Efeito líquido**: ganho ≈ preço bruto − tudo o que ele efetivamente
  desembolsou, quitação inclusa. Se os juros entrarem (2d), o custo é maior e o
  ganho menor — por isso aquela confirmação vale dinheiro real.
- **Multa/tarifa de quitação antecipada: fora do custo.**
- **[Likely — confirmar] Fator de redução** (Lei 11.196/2005, art. 40): com
  desembolsos plurianuais, "a data de aquisição" deixa de ser óbvia e o GCAP
  historicamente pede o custo **por data de pagamento**. **O app não calcula
  fator de redução**; entrega o custo desembolsado ano a ano, datado — que é o
  insumo que o GCAP e o CRC vão pedir.
- **[Likely — confirmar na Lei 11.196/2005 art. 39 e na IN SRF 599/2005; é a
  informação mais desagradável deste item]**: a isenção por reinvestimento em
  180 dias **não alcança a parcela do produto da venda usada para quitar débito
  de aquisição de imóvel residencial já possuído pelo alienante**. Ou seja:
  **vender e usar o dinheiro para quitar o financiamento deste mesmo imóvel não
  gera isenção sobre essa parte.** Se o plano envolve isso, é conversa com o CRC
  **antes** da venda.
- **DARF 4600** até o último dia útil do mês seguinte ao da alienação; alíquotas
  15% até R$ 5 mi, depois 17,5% / 20% / 22,5%. [Certain na estrutura; confirmar
  valores vigentes no programa do ano.]
- **Equiparação a PJ: financiamento não é gatilho.**
- **Guarda documental**: contrato e informes anuais entram no acervo com o mesmo
  relógio. Contrato costuma ter 20+ anos de vida; **digitalizar no ato**.

---

## 7. Automático × CRC

**Sistema sozinho** [Certain]: perguntar a natureza da aquisição; alocar cada
desembolso no ano da sua data de pagamento; acumular a situação em 31/12;
separar amortização, juros, correção, seguro e tarifa **guardando os cinco**;
manter o saldo devedor fora de qualquer soma; gerar a discriminação com a frase
do valor pago e o saldo devedor; recusar valor sem data em aquisição onerosa;
marcar seguros e tarifas como "revisão humana"; **nunca somar item marcado**.

**Leitura humana do Mateus**: transcrever a decomposição da parcela do extrato;
informar o saldo devedor de 31/12; dizer se o financiamento é só do terreno ou
terreno + construção.

**Exige CRC** [Certain]:

1. **Se os juros integram o custo** (2d). **É a pergunta nº 1 ao CRC, e vale
   mais dinheiro que qualquer outra do projeto hoje.**
2. Seguros MIP/DFI, tarifas e IOF.
3. Se o financiamento cobre construção: como as liberações por medição entram.
4. Data de aquisição e fator de redução com desembolsos plurianuais.
5. A vedação da isenção do art. 39 quando o produto quita o financiamento do
   imóvel vendido.
6. O texto que vai à declaração, o código do bem e qualquer retificadora.

**O contai redige, dateia e organiza. Não assina.**

---

## Pergunta ao Mateus, antes de qualquer linha de código

**O financiamento é só do terreno, ou é "aquisição de terreno + construção" com
liberação por medição?**

Não é detalhe. No segundo caso, **parte do dinheiro da construção sai do banco
direto para o empreiteiro**, e a pergunta muda de natureza: quem desembolsou,
quando, e qual documento hábil sustenta cada liberação. O modelo de dados é outro
e a conversa com o CNO/aferição também. **Uma frase de resposta, e ela decide o
tamanho do CONTAI-010.**

Junto dela, três dados baratos que ninguém tem: **valor e data da entrada; valor
da parcela e nº de parcelas; saldo devedor hoje.**

---

# ADENDO — 2026-08-18 · verificação do dispositivo dos juros

Provocado por: o Mateus fechou o escopo (**o financiamento é SÓ DO TERRENO** —
não cobre construção, não há liberação por medição) e pediu confirmação da
leitura do item 2d.

**Este adendo atualiza os itens 2d, 5 e 7 acima.**

## 1. Escopo fechado torna a leitura MAIS forte

Terreno é bem imóvel, e o art. 17, **I** trata de "bens imóveis" sem distinguir
terreno de construído. O financiamento ser só do terreno **elimina a zona
cinzenta** que o parecer havia deixado aberta: não há juros de financiamento de
**construção** (que seriam encargo de financiar execução, não aquisição), não há
liberação por medição, não há rateio. São juros pagos para adquirir o imóvel, no
sentido literal da norma. **Terreno não tem tratamento próprio — tem o caso mais
limpo da alínea.**

Some também a pergunta 3 do bloco "Exige CRC" (liberações por medição). E a
aferição do INSS não é tocada por nada disso.

## 2. Dispositivo localizado

**IN SRF 84/2001, art. 17, I, "g"** — *"os juros e demais acréscimos pagos para
a aquisição do imóvel"*.

`[Certain]` quanto ao **texto** e quanto a ser inciso de **bens imóveis**.
Confirmado em duas transcrições integrais independentes; a ordem das alíneas é
e) imposto de transmissão · f) contribuição de melhoria · **g) juros** ·
h) laudêmio.

⚠️ **Ressalva de citação**: um artigo de prática cita a mesma expressão como
alínea **"f"** — provavelmente compilação com alíneas renumeradas. **Numa
intimação, citar o texto e o inciso I; a letra é secundária e checável no ato
publicado no site da RFB.**

**Correção de uma frase do parecer original**: *"juros e demais acréscimos
pagos"* aparece **duas vezes** no art. 17 — em I/g (imóveis) e no inciso II
(outros bens). A que vale aqui é a de **imóveis**.

## 3. NÃO vira `[Certain]` — e o CRC continua necessário

O que subiu para `[Certain]` foi a **existência e a redação do dispositivo**, não
a subsunção *"juros bancários = juros pagos para a aquisição"*. A norma diz "para
a aquisição do imóvel", não diz "de financiamento", e não foi localizado
pronunciamento vinculante da RFB especificamente sobre juros bancários.

**A pergunta ao CRC encolheu**: de *"os juros entram?"* para *"confirma a alínea
g e o tratamento de seguros e tarifas?"* — conversa de dez minutos com o
dispositivo na mão, não pedido de parecer.

## 4. Erro de inclusão é mais barato — desde que NOMEADO

- **Incluir indevidamente**: glosa da parcela de juros → IR diferencial + multa
  + Selic. **Se os juros foram nomeados na discriminação, é divergência de
  interpretação declarada, não omissão** — não abre espaço para agravamento por
  ocultação.
- **Excluir indevidamente**: em financiamento longo os juros podem se aproximar
  do principal; a 15%+ isso é dinheiro grande. Recuperável só por retificação
  dentro de 5 anos, **e só se os números tiverem sido guardados**.
- **Assimetria decisiva**: o erro de inclusão é corrigível pelo fisco; o erro de
  **não capturar é irreversível**.

### Mudança de regra, e ela altera o item 2e acima

**Os juros SAEM da marca "revisão humana"** (que trava a soma) e **passam a somar
no custo, nomeados em linha própria na discriminação**.

**Seguros MIP/DFI, tarifas e IOF continuam** em "revisão humana" e **fora da
soma** — para eles não há alínea nominal, e imprensa dizendo "seguros e taxas
também entram" não é fonte.

## 5. Recomendação operacional: inalterada e reforçada

Guardar **amortização, juros, correção, seguros e tarifas separados, todo mês**;
decidir a composição na saída.

Ao pedir o extrato analítico ao banco, pedir **retroativo à data do contrato** e
junto o **informe anual de pagamentos** — é a peça única que sustenta o ano
inteiro se o analítico mensal se perder.

---

# Adendo de 2026-08-18 — o informe anual substitui a captura mensal

> ⚠️ **Este adendo REVISA a recomendação da seção 5 acima** (*"guardar
> amortização, juros, correção, seguros e tarifas separados, **todo mês**"*) e
> **cancela** o pedido de extrato analítico retroativo. Motivo: a exigência
> mensal era de **rastreabilidade**, não de apuração — e custava um pedido ao
> banco por mês, que o Mateus recusou com razão. Onde as duas seções
> divergirem, **vale este adendo**.

## 1. O informe anual sozinho sustenta o custo do ano? **Sim.**

[Certain, quanto ao regime] Custo de aquisição é **regime de caixa por
ano-calendário**. A ficha Bens e Direitos tem **uma** situação em 31/12 — não
tem casa para mês. O informe anual do financiamento é emitido pelo próprio
banco, nominal ao CPF, com nº do contrato: é **documentação hábil e idônea**
(IN SRF 84/2001, art. 17), e cobre exatamente o recorte que a apuração precisa.

**Condição única**: o informe precisa **separar** o que entra do que não entra.
Pelas regras já fixadas neste parecer, o custo do ano é
`amortização + juros + correção`, e **não** `seguros MIP/DFI + tarifas + IOF`.
Se o informe trouxer só *"total pago no ano"* num número só, **falta um número**
— e aí sim é preciso uma peça complementar (extrato do ano, **um download**, não
um pedido mensal).

**O que se perde ao abrir mão do mensal**, nomeado:
- **Auditoria item a item sob intimação.** Recuperável: o extrato analítico
  continua no internet banking e pode ser baixado **quando (se) for pedido**.
  [Guessing na janela de disponibilidade por banco — confirmar no app dele.]
- **Detecção precoce de erro do banco** (parcela cobrada errada). Passa a ser
  descoberta em janeiro, não no mês. Consequência fiscal: nenhuma.
- **Nada mais.** Não se perde base de cálculo, não se perde ano, não se perde
  comprovação.

## 2. Existe razão fiscal para granularidade mensal? **Não. Derrubado.**

[Certain] Nenhuma das duas apurações do projeto olha mês:
- **IRPF/custo**: o corte é 31/12. Quem faz o corte de competência de caixa
  dentro do informe é o **próprio banco** — parcela debitada em 02/jan cai no
  informe do ano seguinte, que é o certo.
- **Aferição INSS/SERO**: **não vê financiamento nenhum** (§5 acima, item 3).
  Parcela de terreno não é material, não é mão de obra, não tem competência.

A exigência "todo mês" era **medo de perder o dado**, escrito antes de eu
tratar o informe anual como peça suficiente. Com o informe, o dado não se perde
— ele é **reemitido** pelo banco todo ano. Rastreabilidade que custa 12
interações por ano e não muda um centavo de imposto **cede à realidade do
usuário**.

**Uma exceção, e só uma**: o **ano da venda**. O informe daquele ano só chega no
ano seguinte, e o GCAP é apurado antes. Ver passo 3c.

## 3. O mínimo do ano — e é a boa notícia

| # | O que | Quantas vezes |
|---|---|---|
| **a** | Registrar contrato (instituição, nº, data, preço, nº de parcelas), **entrada** (valor + data + comprovante), ITBI e escritura | **1x na vida** — já pendente, não é novo |
| **b** | **Baixar o informe anual no app/site do banco** e registrar **um** desembolso do ano com os números separados + anexar o PDF | **1x por ano**, em **jan/fev**, quando o informe é publicado |
| **c** | No **ano da venda**: extrato do período do ano corrente + **termo de quitação** do financiamento | **1x na vida**, no ano da venda |

**Pedidos ao gerente durante o ano: zero.** O informe anual é publicação
automática do banco para o IR — ele não é solicitado, ele **aparece**.

## 4. O boleto/extrato mensal que ele já recebe traz a decomposição?

**Pergunta — não vou supor.** [Likely] extrato de financiamento habitacional
costuma discriminar amortização, juros, seguro MIP, seguro DFI e taxa de
administração; mas isso varia por banco e por canal (PDF do boleto ≠ tela do
app), e o parecer não inventa fato do banco dele.

**Importa menos do que parece**: se trouxer, é dado que ele **já tem**, e o
problema vira só de **captura** — bônus, não requisito. Se não trouxer, o passo
3b continua bastando. **Nenhuma decisão deste adendo depende dessa resposta.**

## 5. O passado — **cancelado o pedido retroativo**

A seção 5 acima mandava pedir extrato analítico **retroativo à data do
contrato**. **Retiro.** No lugar:

- **Anos-calendário já encerrados**: baixar o **informe anual de cada ano**, já
  emitido e disponível no internet banking. É **download**, não pedido.
- **Ano corrente**: **nada a fazer** até jan/fev do ano que vem.

**Pedidos ao banco: nenhum.** Só volta a existir pedido se o informe não trouxer
a separação (§1) — e aí é **um**, do ano em questão.

## 6. Consequência para o produto

**Sim: um lançamento por ano, por contrato**, com os componentes separados —
não doze mensais. E isso **simplifica**, não quebra:

- **`valor_terreno`**: nada muda na direção. O número continua sendo *total
  efetivamente desembolsado até 31/12 do ano declarado* (§1 acima) — só que a
  lista de desembolsos passa a ter **1 linha de financiamento por ano** em vez
  de 12. O CONTAI-010 revisado volta de **M** para perto de **S**.
- **Discriminação de Bens e Direitos**: **inalterada**. Os juros continuam
  precisando de **linha nomeada própria** (§4 acima), então o lançamento anual
  guarda **os componentes separados**, não um total. Um lançamento, vários
  números.
- **O que quebra de verdade, e é aceitável**: durante o ano corrente o painel de
  custo **subestima** o financiamento, porque o informe ainda não existe. Não
  afeta declaração nenhuma (Bens e Direitos é preenchido em jan-abril, com o
  informe já na mão), afeta só o número na tela. **Tem que ser nomeado na
  interface** — algo como *"financiamento 2026: aguardando informe anual"* —
  e nunca silenciado, senão vira o defeito do CONTAI-005 ao contrário.
- **Trava obrigatória**: se o app aceitar lançamento mensal opcional, **por
  ano+contrato é o informe OU as parcelas, nunca os dois**. Dupla contagem aqui
  é custo inflado em Bens e Direitos = redução indevida de ganho de capital.

## 7. Limite

Isto é **apuração automatizável**. O que continua exigindo **contador humano
(CRC)**: a decisão final sobre incluir juros na composição declarada e a
conferência do informe contra o contrato no ano da venda.

**Números do informe (rubricas, layout) e disponibilidade retroativa: confirmar
no app do banco dele** — não são legislação, são prática de instituição.

---

**Pergunta única ao Mateus**: o informe anual do seu financiamento separa
amortização, juros, seguros e tarifas, ou vem um total só? (Se não souber, o
plano acima não muda — só ganha um download a mais no primeiro ano.)

---

# Adendo 2 de 2026-08-18 — o documento real: Extrato do IR da CAIXA

Chegou o **"Extrato do Imposto de Renda"** da CAIXA, **exercício 2026 / ano-base
2025 / referência 31/12/2025**, baixado pelo próprio Mateus no site, sem pedido
ao banco. Sem identificadores aqui (repositório público): **só rubricas e
valores**.

**Confirmado em uma linha cada**: a decomposição **existe** e é **anual** ·
ele **obtém sozinho, 1x/ano** · traz **saldo devedor em 31/12** · o pedido
retroativo segue **cancelado**. O Adendo 1 vale como está.

## 1. ⚠️ "Diferença Teórico / Pago" — R$ 167,43: **não sei o que é. Confirmar.**

Nenhum parecer meu previu essa linha, e ela **está dentro** do total pago
(16.883,52 + 43.051,23 + 499,56 + 167,43 = 60.601,74).

[Guessing — **não use isto como fato**] Em contrato SFH com plano de reajuste
vinculado a renda, a CAIXA registra a diferença entre a **prestação teórica**
(a que o sistema de amortização exigiria) e a **efetivamente paga**, com o
resíduo historicamente ligado ao **FCVS**. **Não tenho certeza de qual é o
lançamento no contrato dele** — e a natureza é o que decide, não o nome.

**Tratamento enquanto não se confirma**: **fica FORA da soma**, marcada como
**revisão humana** — mesma regra já aplicada a seguros e tarifas (§4 acima),
pelo mesmo motivo: **não há alínea nominal que a sustente**.

**Por que isso não custa nada**: são **R$ 167,43** — a 15%, ~R$ 25 de imposto.
E como o app **guarda o número separado**, se a CAIXA confirmar que é
juros/correção, entra por **retificadora**, sem perda. O erro irreversível é
**não capturar**; capturar e não somar é reversível.
**Ação**: perguntar à CAIXA a natureza dessa rubrica. Custa um chamado, **uma
vez** — vale para todos os anos do contrato.

## 2. Dos R$ 60.601,74, quanto é custo de aquisição de 2025

| Rubrica | R$ | Entra? |
|---|---|---|
| Amortização | 16.883,52 | **Sim** [Certain] — é preço do imóvel |
| Juros / Correção Monetária | 43.051,23 | **Sim** — IN SRF 84/2001, art. 17 (juros e demais acréscimos pagos na aquisição); decidido no §4 acima. **Confirmar a alínea na IN vigente** |
| Seguros (MIP/DFI) | 499,56 | **Não** — cobertura de risco, não preço. Fica em revisão humana |
| Taxas + FCVS | 0,00 | **Não**, quando houver — administração do contrato ≠ aquisição; FCVS é fundo, não preço |
| Mora / Multa | 0,00 | **Não** [Certain] — penalidade nunca é custo |
| Diferença Teórico / Pago | 167,43 | **Suspenso** (§1) |
| **Custo de aquisição de 2025** | **59.934,75** | |

⚠️ **A parte desconfortável**: **R$ 43.051,23 de 72% do desembolso do ano
dependem da tese dos juros.** Não é rubrica marginal — é a maior do extrato. A
tese é sólida e está no §4, mas nesta ordem de grandeza a inclusão **exige
assinatura de contador com CRC**, não decisão de app. O app soma e **nomeia em
linha própria**; quem assume a posição na declaração é humano.

**Saldo devedor (585.815,19) não é custo de nada.** Guardar como informativo,
nunca somar, nunca virar campo de "dívida" no custo (§1 acima, item 3).

## 3. Ano-base 2025 já está inteiro fora do sistema

**Fato**: R$ 59.934,75 de custo de 2025 que o app não tem. E o ano-base 2025 foi
declarado na DAA do **exercício 2026**, cujo prazo **encerrou em 30/04/2026**
[confirmar o prazo do ano] — ou seja, **já passou**.

**Não pergunto se ele declarou** — a lacuna já está registrada como **D24** no
`docs/backlog.md` (*"o app não sabe qual ano-calendário já foi declarado"*). O
que muda é que agora ela tem **valor e urgência**, não é mais hipótese.

Dois caminhos, e o dele é um dos dois:
- **DAA entregue com o terreno pelo preço de escritura** (o defeito do §1 acima)
  → **retificadora** da DAA do exercício 2026, dentro de **5 anos**. Sem multa
  quando não altera imposto a pagar [confirmar]. **Exige CRC** — o backlog já
  diz isso (linha 1597).
- **DAA entregue já com o desembolso correto** → nada a retificar; **só
  registrar no app** o lançamento de 2025 com a data certa, para o acervo
  sustentar o número lá na frente.

**Não há prazo curto correndo**, mas há prazo: o art. 17 exige o dispêndio
**discriminado na DAA**. Custo pago e não discriminado **não existe** na venda.

## 4. Um lançamento anual basta? **Sim — com estes campos**

**Um lançamento por exercício, por contrato**, contendo:
`exercício/ano-base` · as **sete rubricas separadas** · `saldo devedor em 31/12`
(informativo) · `total pago` (para bater a soma) · **extrato em anexo**.

**Trava obrigatória**: `amortização + juros + seguros + taxas + mora + multa +
diferença` **tem que fechar** com o total pago. Fechou (60.601,74). Se não
fechar, é rubrica que o app não conhece — **recusar e pedir revisão humana**,
nunca somar o resto e seguir.

**Efeito no `valor_terreno`**: sem quebra. Ele continua sendo *total
desembolsado até 31/12 do ano declarado*, e passa a receber **uma linha por
ano** do financiamento (aqui: +59.934,75 em 2025), além de entrada, ITBI e
escritura. Confirma o Adendo 1: CONTAI-010 volta de **M** para perto de **S**.

**Efeito na discriminação de Bens e Direitos**: **juros em linha nomeada
própria** (§4 acima) — no texto do ano, algo como *"amortização R$ X e juros e
correção monetária R$ Y de financiamento imobiliário, conforme extrato anual da
instituição credora"*. Seguros, taxas e a diferença **não aparecem na soma**;
ficam no acervo. Saldo devedor **não entra na discriminação** do bem.

## 5. Limite

**Apuração automática**: somar as rubricas, fechar o total, montar a
discriminação, guardar o extrato.
**Exige CRC**: a inclusão dos R$ 43 mil de juros e **qualquer retificadora**.
**Confirmar**: natureza da "Diferença Teórico / Pago" (com a CAIXA) e a alínea
do art. 17 na IN vigente.
