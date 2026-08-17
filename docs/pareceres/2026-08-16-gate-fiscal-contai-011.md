# Parecer fiscal — CONTAI-011 (export periódico do acervo)

- **Data**: 2026-08-16
- **Autor**: agente `contador` (autoridade fiscal do projeto)
- **Objeto**: Gate Fiscal do `docs/tickets/CONTAI-011.md` — perguntas F1 a F4 e
  revisão dos critérios de aceite
- **Veredicto**: **APROVADO COM RESSALVAS** — 5 bloqueantes (R1–R5), 5 não
  bloqueantes (R6–R10)

> Transcrição do parecer emitido pelo agente `contador` em execução read-only.
> As marcações `[Certain]` / `[Likely]` / `[Guessing]` são dele e indicam grau
> de confiança — onde ele diz que precisa de confirmação, precisa mesmo. Nada
> aqui substitui contador humano (CRC) na assinatura da declaração.

---

## Enquadramento: o export não é backup, é dossiê probatório

O rascunho tratava o export como backup. Fiscalmente ele não é, e a diferença
muda critério de aceite.

Backup responde "o arquivo existe". Dossiê responde "este arquivo sustenta
**este** valor, pago **nesta** data, declarado **nesta** ficha, **deste** ano".
O art. 17 da IN SRF 84/2001 exige as duas coisas juntas — dispêndio comprovado
com documentação hábil e idônea **e** discriminado na Declaração de Ajuste
Anual [Certain]. Um zip com 300 PDFs prova a primeira metade e nada da segunda.

---

## F1 — De quando conta o relógio "venda + 5 anos"

**Nenhuma das três alternativas da pergunta.** Não é a data da escritura, não é
a do registro no cartório, e não é o fim do prazo de entrega da declaração.

> **Nota de processo**: esta pergunta **já havia sido respondida** na Q10 do
> parecer de 2026-08-09 e estava registrada no backlog. Foi reaberta por erro
> de quem redigiu o rascunho. A resposta abaixo **confirma** a Q10 e acrescenta
> quatro pontos.

**Regra estabelecida.** O relógio é o da **decadência tributária**: 5 anos
contados do **primeiro dia do exercício seguinte** àquele em que o lançamento
poderia ter sido efetuado — CTN, art. 173, I [Certain quanto ao texto]. Para o
IRPF de um ano-calendário X, declarado em X+1, o prazo corre de 1º/1/X+2 e se
encerra em 31/12/X+6.

Existe um segundo dispositivo em tese aplicável: o art. 150, §4º do CTN
(tributo por homologação, 5 anos do fato gerador) [Certain quanto ao texto],
que daria prazo **menor**. A jurisprudência do STJ o afasta quando não há
pagamento antecipado (Súmula 555) [Likely — confirmar a numeração]. Como o
ganho de capital pode legitimamente resultar em imposto zero (fator de redução,
isenção por reinvestimento), o cenário "sem pagamento antecipado" é plausível,
e **o prazo a seguir é o maior — o do art. 173, I**. Escolher o menor economiza
dois anos de armazenamento e arrisca a prova inteira.

### Quatro acréscimos à Q10

1. **O que ancora o relógio é a DAA, e o que define a DAA é o recebimento do
   preço — não a escritura.** No ganho de capital o imposto é devido à medida do
   **recebimento**; venda com sinal em novembro e escritura em janeiro tributa
   parte do ganho no ano do sinal, e venda parcelada espalha o ganho por vários
   anos-calendário. Logo: **o relógio ancora na última DAA que declarou qualquer
   parcela daquele ganho**. Escritura e registro só servem para determinar em
   que ano cada recebimento caiu. [Certain no mecanismo; Likely na formulação
   "última DAA", que é leitura conservadora.]

2. **Somam-se ~1 ano e 9 meses ao "venda + 5 anos" do `CLAUDE.md`.** Venda
   concluída em março/2028 → DAA do ano-calendário 2028 entregue em 2029 →
   prazo encerra em **31/12/2034**. São 6 anos e 9 meses da escritura, não 5.
   Quem dimensionar armazenamento pelo número "5" erra por quase dois anos.

3. **Há um segundo relógio, previdenciário, que o ticket ignorava.** Os
   documentos que sustentam a aferição do CNO (NF de serviço com retenção,
   recibos de PF, folha do empreiteiro) respondem à fiscalização do INSS, cujo
   prazo decadencial também é de 5 anos desde a Súmula Vinculante 8 do STF, que
   derrubou o prazo decenal dos arts. 45 e 46 da Lei 8.212/91 [Likely,
   confiança alta]. Mas há regra própria de **guarda** de documentos
   previdenciários — Lei 8.212/91 art. 32, §11 ("até que ocorra a prescrição") e
   Decreto 3.048/99 art. 225, §5º (dez anos) [Likely — confirmar numeração e
   vigência antes de citar em tela]. **Regra prática: guardar o maior dos dois
   relógios**, contado o previdenciário da regularização/CND da obra.

4. **Obra não vendida = prazo indefinido** [Certain]. Enquanto o bem estiver na
   ficha Bens e Direitos, o custo pode ser questionado na venda futura, que
   ainda não tem data.

**Consequência para o produto, e é a mais importante desta pergunta:** o app
**não sabe** quando a venda aconteceu, nem quando o último recebimento entrou,
nem quando a DAA foi entregue. Portanto **a rotina de export não pode ter data
de término calculada**. Ela roda indefinidamente; parar exige ação humana com
parecer, nunca condição no código. Isto reforça a Q10: *o relógio nunca dispara
exclusão automática — só informa*.

---

## F2 — O que o índice precisa ter para servir de comprovação

**Sim, o índice precisa amarrar cada arquivo ao valor e à data de pagamento
declarados. O arquivo sozinho não basta.**

**Distinção que precisa ficar clara**: **o índice não tem valor probatório
nenhum.** É documento produzido pelo próprio contribuinte; ninguém prova gasto
com a própria planilha. Quem prova é a NF, o recibo, o comprovante. O índice
tem outra função, indispensável:

- **É a memória de cálculo que liga o acervo à declaração.** Na malha, a
  pergunta não é "esta nota existe?", é "o R$ 480.000 que você declarou como
  situação em 31/12/2027 é composto de quê?". Responder isso sete anos depois,
  com 300 arquivos e sem índice, é refazer a apuração de memória.
- **É o que sobrevive ao app.** O pacote precisa ser legível por um CRC, um
  comprador ou um herdeiro que nunca viu o contai.

### Campos mínimos do índice

Por **documento**: obra (nome + matrícula + CNO), tipo (NF material / NF serviço
/ boleto / recibo PF / comprovante), favorecido com **nome e CPF/CNPJ
completos**, **número e data de emissão**, valor total, **classificação material
vs. mão de obra**, para NF de serviço a **retenção de 11% (sim / não / a
confirmar)** e o **CNO referenciado na nota**, **status** (registrado ou
quarentena, com motivo), caminho no pacote, tamanho e hash.

Por **pagamento**: valor, **data de pagamento**, **ano-calendário do custo**
(derivado dela), meio, e no cartão as **duas datas** — `data_compra` e
`data_pagamento` da fatura (Q4 do parecer de 2026-08-08).

E o **vínculo entre os dois**.

### Por que "uma linha por arquivo, com um valor" é fiscalmente errado

O modelo é **N pagamentos ↔ 1 documento** (Q6: NF consolidada paga em parcelas
cruzando o ano) e, com a US-012, **1 documento ↔ N obras** (rateio). Uma linha
por arquivo com um campo "valor" e um campo "data de pagamento" **não representa
isso**. Quem ler o pacote vai somar a coluna de valor e chegar a um número que
não é o custo de ano nenhum: conta a NF inteira num ano só, conta o valor cheio
numa obra só, e conta duas vezes o documento que aparece em dois anos.

**Um índice que induz a soma errada é pior que índice nenhum**, pelo mesmo
motivo que o parecer do Gate 2 do CONTAI-001 recusou número de imposto fixo em
tela: número errado contamina a confiança nos certos.

**Forma exigida**: três tabelas relacionadas — `documentos.csv`,
`pagamentos.csv`, `vinculos.csv` (par documento↔pagamento com o valor imputado)
— mais, quando a US-012 existir, `rateios.csv` (obra, percentual, **critério
textual do rateio**, memória de cálculo obrigatória). JSON equivalente serve; o
que não serve é achatar em uma linha por arquivo.

### O que transforma o pacote de backup em comprovação

Por ano-calendário, o pacote precisa carregar:

- o **texto da discriminação de Bens e Direitos como foi efetivamente
  declarado** naquele ano (saída da US-004), por matrícula;
- a **lista de Pagamentos Efetuados como foi declarada**, CPF por CPF —
  lembrando o Q9a: essa ficha é **do declarante**, soma as duas obras, e
  portanto **não cabe dentro do dossiê de uma obra só**;
- o **recibo de entrega da DAA** daquele ano e, se houver, o PDF da declaração.

Sem isso o pacote prova a primeira metade do art. 17 (o gasto) e não prova a
segunda (que foi discriminado). É a segunda metade que costuma faltar, porque o
gasto ninguém esquece — o que se esquece é qual número foi para a ficha.

**Marcação da quarentena é obrigatória no índice** [Certain]. Documento em
quarentena (nota fora do CPF, por exemplo) **não entrou no custo declarado**. Se
aparece no pacote sem marcação, o pacote sugere custo maior do que o declarado —
e divergência entre acervo e declaração é o que atrai pergunta.

---

## F3 — Cópia digital de documento de papel

**Não tem o mesmo valor probatório. O export NÃO substitui a guarda física, e
isso precisa virar texto de tela.**

**Regra** [Likely, confiança alta — confirmar numeração antes de ir para tela]:
a digitalização só produz os mesmos efeitos legais do original **perante pessoa
jurídica de direito público** se cumprir os requisitos técnicos da Lei
12.682/2012, com as alterações da Lei 13.874/2019, regulamentados pelo
**Decreto 10.278/2020** — o que inclui **assinatura digital ICP-Brasil**,
metadados obrigatórios e padrões de formato. Foto de celular e PDF simples não
cumprem nada disso.

No processo judicial a cópia vale enquanto a autenticidade não for impugnada
(CPC/2015, art. 425) [Likely], mas **em fiscalização administrativa o auditor
pode exigir o original**, e a exigência é legítima. Logo: **o papel é a prova; o
arquivo do contai é o localizador.**

**Escopo — não é tudo.** NF-e e NFS-e **nascem digitais**: o XML é o original e
não existe papel a guardar (o DANFE é representação, não original) [Certain]. O
aviso se aplica a: **recibo de prestador PF assinado**, comprovantes impressos,
contrato de empreitada assinado a caneta, ART/RRT com assinatura física,
alvará, habite-se e certidões em papel. Dar o aviso em toda tela seria carimbo —
o mesmo vício que o adendo de 2026-08-10 rejeitou no "Salvar mesmo assim".

### Texto de tela — versão curta

*(abaixo do anexo, quando o documento nasceu em papel)*

> **Cópia digital não substitui o papel.** Guarde o recibo assinado — a foto
> aqui serve para achar e conferir, não para descartar o original.

### Texto de tela — versão longa

*(detalhe do documento, e no LEIA-ME do pacote exportado)*

> **Este arquivo é uma cópia, não o original**
>
> Documento que nasceu em papel — recibo assinado, comprovante impresso,
> contrato — só teria o mesmo valor do original se a digitalização seguisse os
> requisitos técnicos e a assinatura digital ICP-Brasil da Lei 12.682/2012 e do
> Decreto 10.278/2020. O contai não faz isso: o que ele guarda é cópia simples.
>
> Na prática: a cópia serve para localizar, conferir e não perder. Se a Receita
> pedir, quem responde é o papel.
>
> **Guarde o original assinado** enquanto o imóvel não for vendido, e por 5 anos
> contados do primeiro dia do ano seguinte à declaração que informar a venda.
>
> Nota fiscal eletrônica (NF-e / NFS-e) é diferente: ela já nasce digital, o
> arquivo é o original e não há papel a guardar.

**Onde aparece**: (a) no registro de documento cujo tipo nasce em papel, versão
curta; (b) no detalhe do documento (US-010 / CONTAI-009), versão longa; (c) no
`LEIA-ME.txt` do pacote exportado, versão longa. **Não é caixa de marcação
obrigatória** — mesmo fundamento do adendo de 2026-08-10.

---

## F4 — O que o acervo precisa preservar e o app hoje não captura

**Sim, e a lista é grande.** O `documento` de hoje é sempre ligado a um
favorecido e a um pagamento. Nenhum dos itens abaixo é: são **documentos da obra
e do imóvel**, sem favorecido e às vezes sem valor. Fiscalmente é categoria
nova; a modelagem é decisão do `cto-obra`.

### Indispensáveis para sustentar o custo de aquisição

| Documento | Por quê |
|---|---|
| Escritura/contrato de compra do terreno | Prova o valor de aquisição do terreno — a maior linha isolada do custo |
| Certidão da matrícula com o registro da compra | Prova a propriedade e a **data de aquisição**, que comanda o fator de redução (Lei 11.196/2005, art. 40) [Certain] |
| Guia e comprovante do **ITBI** | Integra o custo (parecer de 2026-08-08, item 1); o CONTAI-010 captura a data, **não o documento** |
| Guia e comprovante de **escritura e registro** | Idem |
| **Projeto aprovado + alvará de construção** | O `CLAUDE.md` já os lista como documentação hábil; amarra o material comprado *àquela* obra |
| **ART/RRT** do responsável técnico | Sustenta o custo do projeto e é peça da aferição/SERO |
| **Contrato de empreitada** | Não prova pagamento, mas define **empreitada total vs. parcial** — a Q14, que decide de quem é o CNO |
| **DARF do INSS da regularização (aferição SERO)** | [Likely] Dispêndio necessário da construção, comprovado por DARF vinculado ao CNO, **entra no custo de aquisição**. Pode ser um dos maiores valores isolados da obra e hoje não tem onde ser guardado. **Confirmar com CRC antes de virar regra de cálculo** |
| **Habite-se / certidão de conclusão** | Data de conclusão; pré-requisito da averbação |
| **CND da obra e averbação na matrícula** | Sem averbação não há venda financiada (parecer de 2026-08-09, item 1) |
| Memória de cálculo de rateio (US-012) | Guardada **junto** do documento rateado (Q9c) |

### Indispensáveis no momento da venda

- **Recibos de entrega das DAA de todos os anos da obra**, e de preferência os
  PDFs — prova de que o custo foi *discriminado*, exigência do art. 17 [Certain]
- **Escritura de venda + matrícula com o registro da venda**
- **CND / averbação**
- **Demonstrativo do GCAP do ano da venda + arquivo do programa + DARF código
  4600** pago até o último dia útil do mês seguinte ao do recebimento [Certain
  no mecanismo; **confirmar código e prazo no programa do ano**]
- **Comprovante de corretagem** paga pelo vendedor — [Likely, confirmar
  dispositivo] reduz o valor de alienação
- Se houver isenção por reinvestimento (Lei 11.196/2005, art. 39): **documentos
  da compra do novo imóvel residencial dentro de 180 dias**, com as datas — a
  isenção é 1 vez a cada 5 anos, e o Q7c registrou que usá-la numa obra queima a
  da outra

**Impacto imediato no CONTAI-011, e é barato:** enquanto essa categoria não
existir, o pacote exportado **precisa declarar o que não contém**. Um dossiê que
parece completo e não tem escritura, matrícula, ITBI, alvará, ART, habite-se e
CND é pior que um dossiê que diz "faltam estes sete itens, guardados fora do
contai" — o primeiro faz parar de procurar.

---

## Ressalvas aos critérios de aceite

### Bloqueantes (entram no ticket antes do Gate 1)

- **R1 — Índice incompleto e indutor de soma errada.** Substituir pela
  especificação de F2: campos mínimos de documento e de pagamento, relação N:M
  em tabela própria, marcação de quarentena. Nada de "uma linha por arquivo com
  um valor".
- **R2 — "Contagem + tamanho" não verifica integridade.** Tamanho não detecta
  corrupção de bits, que é o modo de falha de acervo guardado por 7+ anos.
  Exigir **hash SHA-256 por arquivo**, gravado no índice no momento do export.
- **R3 — Falta o critério que transforma backup em comprovação.** O pacote
  carrega, por ano-calendário, a **discriminação como declarada**, a **lista de
  Pagamentos Efetuados como declarada** e o **recibo de entrega da DAA**. Base:
  IN SRF 84/2001 art. 17 — comprovado **e** discriminado.
- **R4 — Falta o `LEIA-ME.txt`.** Todo pacote contém um LEIA-ME em português
  corrente com (a) o aviso do F3, (b) o relógio de guarda do F1 e a proibição de
  expurgo automático, (c) **a lista do que o pacote não contém** (F4).
- **R5 — Falta imutabilidade do pacote de ano fechado.** Correção posterior de
  valor, data ou obra **não reescreve** pacote já exportado: gera pacote novo,
  datado, que referencia o anterior. A DAA pode ser retificada dentro de 5 anos
  [Likely — confirmar o prazo], e defender uma retificadora exige mostrar **o
  que foi declarado antes e o que mudou**.

### Não bloqueantes

- **R6 — Segmentação por obra é necessária e insuficiente.** O dossiê por obra
  não comporta a ficha Pagamentos Efetuados, que é **do declarante** e soma as
  duas obras (Q9a). São **dois recortes**: dossiê do imóvel e acervo do
  declarante. E têm públicos diferentes: o dossiê que vai ao comprador **não
  deve** conter a outra obra nem cópia da DAA.
- **R7 — Reconciliação inversa.** Falta o terceiro caso: **linha do banco sem
  arquivo nenhum** (pagamento com `comprovante_path` nulo). Não é erro do
  export, é **pendência fiscal já existente**. Sai em relatório "sem comprovante
  no acervo", não falha a rotina.
- **R8 — LGPD e terceiros.** O índice carrega CPF completo de prestadores — dado
  pessoal de terceiro. O destino tem que ser pasta privada, sem link público.
- **R9 — Não duplicar documento por ano.** NF consolidada paga em duas parcelas
  pertence a dois anos (Q6). Se o pacote a copiar em duas pastas, quem contar
  pastas conta duas vezes. **O arquivo aparece uma vez; o ano vive no índice.**
- **R10 — Campos que o índice exige e o schema não tem.** `numero` e
  `data_emissao` (CONTAI-004) e `cno_referenciado` (CONTAI-007) ainda não
  existem em `documento`. São obrigatórios do índice — o primeiro porque a
  discriminação é *"NF nº X, valor total R$ Z, pago R$ Y no ano"*, o segundo
  porque sem ele o pacote não sustenta a aferição do CNO. Enquanto não
  existirem, o índice sai incompleto e o LEIA-ME tem que dizer isso.

---

## Apuração automática vs. exige contador humano (CRC)

**O sistema pode fazer sozinho**: montar o índice, calcular o ano-calendário a
partir da data de pagamento, separar material de mão de obra, segmentar por obra
e por CNO, reconciliar acervo × banco, hashear e verificar integridade, avisar
de falha.

**Exige CRC**: decidir quando o relógio de guarda parou; confirmar se o DARF do
INSS da aferição entra no custo de aquisição; confirmar a dedutibilidade da
corretagem na venda; conduzir retificação de DAA; e assinar qualquer declaração.
O contai organiza e informa — não assina.

## Pontos a confirmar antes de virar texto de tela

Súmula 555 do STJ (numeração); Súmula Vinculante 8 do STF (numeração); Decreto
3.048/99 art. 225, §5º e Lei 8.212/91 art. 32, §11 (guarda previdenciária e
vigência); numeração da Lei 12.682/2012 / Decreto 10.278/2020 no texto do F3;
prazo de retificação da DAA; código e prazo do DARF 4600 no programa do ano;
dispositivo da corretagem. **Nenhum desses números vai para tela sem conferência
na legislação vigente.**

---

## Veredicto

**APROVADO COM RESSALVAS.** O ticket segue para o Gate 1 depois de R1–R5
entrarem nos critérios de aceite. R6–R10 entram como notas e podem ser
resolvidas no Gate 2 pelo `cto-obra`. As perguntas M1–M4 ao Mateus não têm
impedimento fiscal — qualquer destino serve, desde que privado (R8) e não
dependente do mesmo fornecedor que já guarda o acervo.
