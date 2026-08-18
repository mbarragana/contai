# Parecer fiscal — NFS-e de empreitada, prestador do Simples Nacional, tomador pessoa física

- **Data**: 2026-08-18 · **Autor**: agente `contador`, execução read-only
- **Provocação**: NFS-e real recebida pelo Mateus (R$ 40.857,14, ISS retido de
  R$ 1.888,74, INSS 0,00, CNO 900298420564 impresso), lida de captura de tela,
  mais a diretriz de produto *"o app tem que suportar todos os casos possíveis
  através de configurações"*.
- **Consome**: `2026-08-09-obra-sem-cno.md` (empreitada, Q14, pergunta nº 1 ao
  CRC), `2026-08-16-gate-fiscal-contai-004-005.md` (discriminação, INSS fora de
  soma), `2026-08-17-vinculo-pagamento-documento.md` (as quatro condições do
  custo, mínimo pagamento×documento, regra cronológica),
  `2026-08-17-terreno-financiado.md` (captura irreversível × decisão reversível).
- **Normativo para**: o registro de NFS-e com retenções; o campo de regime de
  execução da obra; o texto do aviso "esta nota não abate a aferição".

> Transcrição do parecer do agente `contador`. As marcações `[Certain]` /
> `[Likely]` / `[Guessing]` são dele — onde ele diz que precisa de confirmação,
> **precisa mesmo**. Nada aqui substitui contador humano (CRC) na assinatura da
> declaração.

---

## 0. A resposta desconfortável, em quatro linhas

1. **A nota NÃO confirma empreitada total. Ela contém um indício forte do
   contrário**, e o indício é o próprio CNO impresso nela: em empreitada total a
   obra é matriculada em nome da **empresa construtora**, e aqui o CNO é do
   Mateus. Ou o contrato não é o que ele acha que é, ou o cadastro no fisco está
   no nome errado. As duas hipóteses custam dinheiro e **nenhuma se resolve pelo
   documento** — resolve-se pelo contrato e pela ART.
2. **O ISS retido de R$ 1.888,74 não é desconto. É obrigação de dono
   indefinido.** Retenção de ISS por tomador **pessoa física** é fora do padrão
   da LC 116/2003, que dirige a substituição ao tomador **pessoa jurídica**. Se
   ele pagar o líquido e ninguém recolher, sobra uma dívida — dele com o
   município ou dele com a empreiteira. Em nenhum cenário correto ele economiza
   R$ 1.888,74.
3. **Não liberar a próxima parcela antes de resolver os itens 1 e 2.** É o mesmo
   argumento de 2026-08-09 e ele não envelheceu: **a alavanca é o saldo a
   pagar.** Depois do último pagamento, tudo vira pedido de favor — e o art. 30,
   VI da Lei 8.212/91 **expressamente autoriza** reter valor devido ao construtor
   como garantia das obrigações previdenciárias. É o único poder que ele tem.
4. **INSS 0,00 está provavelmente certo, e é a pior notícia do parecer**, não a
   melhor: não haver retenção significa que **nada nesta nota abate a base de
   aferição** do CNO 900298420564. R$ 40.857,14 de obra executada, R$ 0,00 de
   redução da base. Ver §3.

---

## 0.1 Antes de tudo: a captura está incompleta para o filtro de entrada

A tabela lida da tela **não mostra a identificação do tomador**. Isso não é
detalhe de conferência — é o **primeiro filtro do sistema**:

- **Sem o CPF do Mateus como tomador, esta nota não é documentação hábil**, não
  compõe custo de aquisição e vai para quarentena. [Certain]
- Faltam também, e são obrigatórios pelo CONTAI-004: **`numero`**, **`serie`**,
  **`data_emissao`** e a **identificação do prestador (razão social + CNPJ)**.
- **Regra que não se flexibiliza**: nenhum desses campos se preenche por
  inferência, e nenhum se deriva do outro. Campo vazio pergunta.

Tudo o que segue pressupõe que a nota traz o CPF do Mateus como tomador. **Se
não trouxer, o parecer inteiro vira um problema só: cancelamento e reemissão,
enquanto ainda há parcela a pagar.**

Três campos da captura eu **não decodifico e não vou adivinhar**: o **código de
serviço 70202**, o **local de prestação 8105** e a **situação tributária
"TIST"**. São códigos do sistema municipal de NFS-e. **Confirmar no manual do
município** — e o município precisa ser nomeado (pergunta P1).

---

## 1. É empreitada total? O que a nota prova e o que não prova

Retomo o teste que **eu mesmo corrigi em 2026-08-09**: *material não decide
nada; decide se o dono contrata mão de obra diretamente.* O relato do Mateus
("é empreitada, valor fixo, tudo passa pela empreiteira, não contrato mão de
obra direto") passa nesse teste. **Mas o teste é meu, e a definição que vale é a
da norma previdenciária**, que é mais exigente.

**Empreitada total, na acepção previdenciária** [Likely; **confirmar os
dispositivos na IN vigente** — a IN RFB 971/2009 foi consolidada, ao que consta,
pela **IN RFB 2.110/2022**, e a numeração dos artigos mudou]:

- contrato celebrado **com empresa construtora**, assim entendida a que tem
  registro no CREA/CAU e **responsável técnico**;
- que assume a execução de **todos os itens** da obra, podendo subcontratar;
- **e que, por isso, responde pela matrícula (CNO) e pela regularização da
  obra.**

### O que a nota diz a favor

| Elemento | Leitura |
|---|---|
| NBS 1.0101.11.00 — "construção de edificações residenciais" | objeto é a **edificação**, não "serviço de pedreiro" [Likely] |
| Descrição "Obra Residencial unifamiliar." | escopo global, não etapa [Guessing — descrição genérica não prova escopo] |
| UN / Quantidade = 1 | um objeto indivisível, compatível com preço fechado [Likely, fraco] |

### O que a nota diz contra — e pesa mais

1. **O CNO impresso é o do Mateus.** Em empreitada total a obra é matriculada em
   nome da construtora e o dono da obra **não teria CNO próprio para ela**.
   [Likely, confiança alta] O documento, portanto, **descreve uma obra cujo
   responsável perante o fisco previdenciário é o Mateus** — que é o oposto do
   efeito que a empreitada total produziria.
2. **Dedução de materiais 0,00.** Em construção civil existe a discussão da
   dedução da base do ISS pelos materiais fornecidos pelo prestador (LC 116/2003,
   lista, item 7.02, parte final). Zerada, a linha é **compatível com preço sem
   material** — e também com município que não admite a dedução, e com regime do
   Simples que a apura de outro jeito. **Não decide nada sozinho** [Guessing],
   mas remove a nota da coluna das provas a favor.
3. **INSS 0,00 é neutro**: o tomador ser pessoa física já explica o zero em
   qualquer dos regimes (§2). **Zero de INSS não é evidência de empreitada
   total.** Somar esse argumento seria empilhar fundamento que não se aplica.

### Veredicto

**Refuto a inferência.** [Certain quanto ao raciocínio] A nota é **compatível**
com empreitada total e **igualmente compatível** com empreitada parcial de mão de
obra a preço fechado. O que decide são **três documentos que o app não tem**:

1. o **contrato** (cláusula de escopo: quem fornece **todo** o material);
2. a **ART/RRT de execução** da obra — em nome da empreiteira ou não;
3. o **cadastro do CNO** — quem consta como responsável.

**Enquanto o item 3 apontar para o Mateus, o sistema deve tratar a obra como
"aferição minha", qualquer que seja o rótulo do contrato.** [Certain como regra
operacional] Quem tem o CNO é quem responde pela aferição; e hoje o CNO é dele.

### ⚠️ Isto NÃO responde a Q14

A **Q14** do backlog pergunta se **a obra SEM CNO** é empreitada total. Esta nota
traz o CNO **900298420564**, da **Casa Tanheiros**. Ela não fala da outra obra,
não migra para a outra obra e **não autoriza ninguém a herdar a resposta**.
**Q14 continua aberta.** E o app **nunca** deve copiar, sugerir ou propagar CNO
entre obras.

**Q15, nova, e é gêmea da Q14 pelo outro lado**: *se a Casa Tanheiros é
empreitada total, por que o CNO está em nome do Mateus?*

---

## 2. Pergunta 1 — INSS 0,00 está correto?

**Sim, com confiança alta — e por um fundamento só.** [Likely, confiança alta]

### O fundamento que vale: tomador pessoa física

A Lei 8.212/91, **art. 31** impõe a retenção de 11% à **"empresa contratante"**
de serviços executados mediante cessão de mão de obra ou empreitada. O Mateus é
**pessoa física, dono de obra de residência própria**. A equiparação a empresa do
**art. 15, parágrafo único** alcança o contribuinte individual **"em relação a
segurado que lhe presta serviço"** — trata do prestador **pessoa física**, não da
retenção sobre nota de **pessoa jurídica**.

**Isto sozinho zera a retenção**, independentemente do regime de empreitada e do
anexo do Simples. [Likely, confiança alta — **é a "pergunta nº 1 ao CRC",
registrada desde 2026-08-09 e ainda em aberto**; confirmar também o dispositivo
da IN vigente que exclui a retenção quando o contratante é pessoa física.]

**Coerência interna da própria nota reforça a leitura** [Certain quanto ao fato,
[Likely] quanto à conclusão]: **IR, CSLL, PIS e COFINS também vieram 0,00**.
Todas essas retenções pressupõem tomador **pessoa jurídica** (IRRF sobre serviços
entre PJ; a retenção da Lei 10.833/2003, art. 30, também entre PJ, e da qual os
optantes pelo Simples são excluídos). **A nota inteira está zerada exatamente nas
retenções que dependem de tomador PJ.** A única retenção não-zerada é a
**municipal** — e é justamente a que está fora do padrão (§5).

### O fundamento que é verdadeiro mas aqui é redundante: empreitada total

Em empreitada total com empresa construtora, **não há retenção** e a
responsabilidade pela matrícula e pela regularização se desloca para a
construtora [Likely; **confirmar artigo na IN vigente**]. Isso é verdade — **mas
não é o que explica o 0,00 desta nota**, porque o tomador ser PF já resolve. E,
como o regime da empreitada nem sequer está confirmado (§1), invocá-lo aqui seria
apoiar uma conclusão certa num pressuposto duvidoso.

**Onde a empreitada total importa de verdade é no §3** — quem faz a aferição.

### O fundamento que é irrelevante aqui: o anexo do Simples

A regra do Simples (a retenção previdenciária alcançar apenas as prestadoras
tributadas no **Anexo IV**, e não as do Anexo III) [Likely] **só entra em cena
quando o tomador é empresa**. Com tomador PF não há retenção a fazer, e o anexo
da prestadora não muda nada nessa conta. **Não somo esse argumento.**

**Mas o anexo não é irrelevante no §3**, e por um motivo prático: se a
empreiteira for do **Anexo IV** — e construção de imóveis e obras de engenharia
em geral é Anexo IV [Likely, confiança alta; **confirmar na LC 123/2006 art. 18**
e no enquadramento real dela] — a contribuição patronal fica **fora do DAS**, ela
**tem folha e declarações previdenciárias próprias**, e é exatamente isso que
pode ser vinculado ao CNO. Se for do Anexo III, a conversa muda e vira pergunta
ao CRC. Ver P4.

### Uma advertência que não pode faltar

**"INSS 0,00 na nota" não é atestado de que o INSS da obra está pago.** [Certain]
São coisas distintas: a retenção é um mecanismo de antecipação; a contribuição da
obra existe de qualquer forma e é apurada na **aferição**. A nota diz apenas que
**nada foi antecipado ali**.

---

## 3. Pergunta 2 — a aferição do CNO 900298420564 ⚠️ PRIORIDADE

### 3.1 Esta nota abate alguma coisa? **Não. Zero.** [Certain]

Duas razões independentes, e cada uma basta:

1. **Não houve retenção de 11% recolhida em nome da empreiteira.** O que reduz a
   base da aferição é **remuneração de mão de obra declarada e vinculada àquele
   CNO** (EFD-Reinf / DCTFWeb / eSocial), e a retenção é a via ordinária de
   comprová-la. Isto é a repetição do invariante do `CLAUDE.md`, e ele se aplica
   aqui inteiro.
2. **Nota não é declaração.** [Certain] Já estava no parecer de 2026-08-09: *"o
   caminho não é a nota — é a declaração do prestador"*. O CNO impresso na nota
   é **necessário e não suficiente** (§6).

**Efeito prático, e é ele que dói**: R$ 40.857,14 de obra executada e paga com a
base de aferição **integralmente cheia**. Na regularização, o INSS da mão de obra
contida nesse valor será cobrado **de novo** — ele já pagou uma vez, dentro do
preço.

**Não converto isso em reais.** [Certain quanto à recusa] A base se apura por
área e CUB, não por soma de notas; qualquer número que eu escrevesse aqui seria
palpite vestido de cálculo. A regra do parecer de 2026-08-16 continua valendo: a
exposição INSS vive **em bloco próprio, fora de qualquer soma**, e *"o valor em
reais só existe quando a aferição for calculada"*.

### 3.2 O Mateus tem ou não tem aferição a fazer neste CNO?

**Hoje, tem. [Certain como fato cadastral.]** O CNO está em nome dele; quem
responde pelo CNO responde pela aferição e pede a CND da obra. Rótulo de contrato
não muda cadastro.

**Se — e só se — a empreitada total for comprovada e o CNO for corrigido para o
nome da construtora**, a aferição passa a ser dela. **E mesmo assim ele não sai
livre**, pelos dois motivos abaixo, que são o coração deste parecer:

1. **Responsabilidade solidária do dono da obra.** Lei 8.212/91, **art. 30, VI**:
   o proprietário, o incorporador, o dono da obra e o condômino da unidade são
   **solidários com o construtor** pelas obrigações previdenciárias, **"qualquer
   que seja a forma de contratação"**, com direito de regresso, **admitida a
   retenção de importância devida ao construtor como garantia**, e **sem
   benefício de ordem**. [Likely, confiança alta — **confirmar a redação vigente
   do inciso e eventuais hipóteses de elisão da solidariedade**.]
   → **Tradução**: se a empreiteira não recolher, o fisco pode cobrar dele
   **direto**, sem precisar tentar cobrar dela antes. "É empreitada total, o
   problema é dela" **não é uma defesa**.
2. **Sem CND da obra não há averbação; sem averbação não há venda.** Lei
   8.212/91, **art. 47, II** [Likely, confiança alta]. É a mesma cadeia do
   parecer de 2026-08-09, e é a consequência que ele sente no dia da venda, com o
   comprador na mesa.

**Conclusão que o produto tem de refletir**: **não existe configuração de
empreitada que retire o risco previdenciário do Mateus.** Ela move **quem
declara**; **não move quem paga se ninguém declarar.** Qualquer tela que sugira
"empreitada total → INSS não é problema meu" está mentindo.

### 3.3 O que exigir da empreiteira — antes de cada parcela

Em ordem de força, e **por escrito**:

1. **Contrato assinado com a cláusula de escopo** e a **ART/RRT de execução** em
   nome dela, com o responsável técnico identificado. Sem isso, "empreitada
   total" é adjetivo, não regime.
2. **Definição documentada de quem é o titular do CNO desta obra** — e, se for
   para ser dela, a matrícula própria feita e o número informado por escrito.
   Enquanto o CNO for dele, item 3 abaixo.
3. **Comprovação mensal de que a mão de obra da obra foi declarada com o CNO
   900298420564** — o evento de **serviços prestados** da EFD-Reinf (série
   **R-2020**, [Likely] quanto ao código) e/ou o eSocial/DCTFWeb do período.
   Observação que evita pedido impossível: **o evento de serviços tomados
   (R-2010) é do tomador, e tomador pessoa física não transmite EFD-Reinf** — o
   pedido é sempre da ponta dela.
4. **Retenção contratual de uma parcela final até a emissão da CND da obra.** É
   o instrumento que o art. 30, VI nomeia. É também o único que sobrevive ao fim
   do contrato.
5. **Declaração da empreiteira, por escrito, de que a nota se refere
   integralmente à obra do CNO 900298420564**, com número e data da nota.

**O que NÃO recomendo**: passar a reter 11% por conta própria. [Certain] Reter
tributo que pode não ser devido não gera dedução na aferição dele, cria problema
de crédito para a prestadora e **não substitui a declaração vinculada ao CNO**,
que é o que realmente abate. O caminho é a declaração, não a retenção improvisada.

---

## 4. Pergunta 3 — custo de aquisição: bruto ou líquido?

### **R$ 40.857,14 — o bruto.** [Certain quanto ao critério]

O art. 17 da IN SRF 84/2001 manda compor o custo pelos **dispêndios pagos**,
comprovados por documentação hábil e discriminados na DAA. O **preço do serviço
é R$ 40.857,14**; o ISS retido não é abatimento do preço, é **forma de
pagamento** de uma parcela dele — sai da conta dele para o município em vez de
sair para a empreiteira.

Testando os dois cenários possíveis, o resultado é o mesmo:

| Cenário | Ele desembolsa | Custo |
|---|---|---|
| Ele é o responsável pelo ISS | 38.968,40 à empreiteira **+** 1.888,74 ao município | **40.857,14** |
| Ele **não** é o responsável (o ISS está no DAS da empreiteira) | 40.857,14 **inteiros** à empreiteira | **40.857,14** |

**R$ 38.968,40 só seria o custo no cenário em que ele paga o líquido e o ISS
nunca sai da conta dele — que é justamente o cenário incoerente**, em que alguém
fica devendo (§5). **Economia aparente de R$ 1.888,74 que é passivo em aberto,
não redução de custo.**

**Regime de caixa, e a armadilha**: cada perna entra no ano da **sua própria
data de pagamento**. Líquido pago em dezembro e guia de ISS recolhida em janeiro
**compõem anos-calendário diferentes**. É a regra cronológica já ratificada no
adendo de 2026-08-18 do parecer do vínculo — **não é exceção, é o caso normal
aplicado a duas pernas**.

### 4.1 Como registrar no app — normativo

**A regra em uma linha: o documento carrega o BRUTO; os pagamentos carregam o que
efetivamente saiu; a soma dos pagamentos vinculados fecha no bruto.**

1. **`documento.valor` = R$ 40.857,14 (valor total da nota).** [Certain]
   **Proibido registrar a nota pelo líquido.** Nota registrada pelo líquido
   subdeclara custo de aquisição de forma silenciosa e permanente — e
   subdeclarar custo é pagar imposto sobre lucro que não existiu.
2. **Dois pagamentos, ambos vinculados à MESMA nota**:
   - R$ 38.968,40 · favorecido = **empreiteira** · comprovante da transferência;
   - R$ 1.888,74 · favorecido = **município** · comprovante da guia (§5).
3. **O fechamento é `Σ pagamentos vinculados == documento.valor`.** Enquanto
   faltar a guia, a nota está **parcialmente paga**, e a diferença **é retenção,
   não excesso**. [Certain]
4. **Proibições que evitam os dois erros simétricos** [Certain]:
   - **contar duas vezes**: a guia de ISS **não vira `documento` próprio** que
     some ao custo — ela é **pagamento da mesma nota**;
   - **contar de menos**: o pagamento à empreiteira **não** se registra pelo
     bruto quando saiu o líquido — isso quebra a conciliação e esconde a guia;
   - **alerta falso**: a diferença de R$ 1.888,74 **não** pode cair em *"pago sem
     nota"* nem em *"custo em risco"*. Ela tem nota; falta é a perna do ISS.
     Pendência própria, com texto próprio: *"falta a guia de ISS de R$ 1.888,74
     para fechar esta nota"*.
5. **Capturar as retenções uma a uma, mesmo zeradas** — ISS, INSS, IR, CSLL, PIS,
   COFINS — **mais o valor líquido**. Mesmo critério do parecer do terreno
   financiado: **captura irreversível no ato, decisão reversível no relatório**.
   Reconstruir de uma captura de tela, dois anos depois, qual perna era qual, é
   impossível.

### 4.2 O campo `retencao_11 boolean` não aguenta este caso ⚠️

**Achado de modelagem com consequência fiscal.** [Certain]

`documento.retencao_11 boolean` responde *"tem retenção?"*. Este documento expõe
que a pergunta útil é outra, porque **"0,00" tem dois significados opostos**:

| Significado | Consequência |
|---|---|
| 0,00 **correto** — tomador PF / empreitada total | nada a cobrar da empreiteira; a exposição é da **aferição**, e o texto certo é o do §3 |
| 0,00 **indevido** — empreitada parcial que deveria ter retido | há erro a corrigir **enquanto houver parcela** |

Hoje o app trata os dois como o mesmo alarme vermelho. Na obra do Mateus,
**empreitada com tomador PF significa alarme vermelho em toda parcela, para
sempre** — e aviso que sempre aparece vira carimbo, exatamente o que o adendo de
2026-08-10 recusou. **O `boolean` precisa virar valor (`valor_inss_retido`) +
motivo da ausência.** A forma é do `cto-obra`; a exigência fiscal é: **guardar o
número e guardar o porquê do zero**.

### 4.3 Classificação material × mão de obra

Nota de **empreitada global é material e mão de obra no mesmo documento**. O enum
`classificacao ('material','mao_obra')` não a comporta.

**Regra dura: o app NUNCA estima o percentual de mão de obra de uma empreitada.**
[Certain] Rateio inventado entra na discriminação como se fosse fato e, na
aferição, é o fisco quem aplica os percentuais dele — não o contribuinte.

**Emenda ao Bloco A** do parecer de 2026-08-16 (o resto do bloco não muda):

```
Dispêndios pagos no ano-calendário de [ano]: R$ [total pago no ano], sendo
R$ [materiais] em materiais adquiridos diretamente, R$ [mão de obra] em mão de
obra e serviços contratados diretamente e R$ [empreitada] em empreitada
contratada com [razão social], CNPJ [cnpj], compreendendo material e mão de
obra.
```

Se não houver empreitada no ano, a terceira oração **não é renderizada** — nada
de "R$ 0,00 em empreitada".

---

## 5. Pergunta 4 — ISSRF de R$ 1.888,74 com tomador pessoa física

### 5.1 A retenção em si é coerente com o Simples

A alíquota de **4,6228%**, com quatro casas, é a cara da **alíquota efetiva de
ISS do Simples Nacional** informada no documento fiscal para fins de retenção
(LC 123/2006, art. 21, §4º) [Likely, confiança alta]. Base e ISSQN marcados
"SIMPLES NACIONAL" fecham com isso. **A aritmética confere e o mecanismo existe.**
**A alíquota não identifica o anexo** — não inferir Anexo III ou IV a partir dela.

### 5.2 Quem é o responsável — e é aqui que está o problema

**Retenção de ISS por tomador pessoa física é fora do padrão.** [Likely,
confiança alta] A **LC 116/2003, art. 6º, §2º, II** atribui a responsabilidade
pelo ISS, nos serviços de construção civil da lista (subitens 7.02, 7.04, 7.05 e
correlatos), à **pessoa jurídica** tomadora. O **caput do art. 6º** permite ao
município atribuir a responsabilidade a terceiro vinculado ao fato gerador — em
tese alcançaria uma pessoa física, mas **não é o desenho usual**, e a maioria dos
municípios cadastra como responsáveis PJ, órgãos públicos e condomínios.
**Confirmar na lei do município e no manual da NFS-e** (P1).

**Dois desfechos, e eles se excluem:**

**(A) A lei municipal atribui a ele.** Então:
- ele recolhe por **guia municipal** (DAM/DAS-ISS gerado no próprio sistema da
  NFS-e), no prazo da legislação local — **prazo não cravado, confirmar**;
- **a guia paga integra o custo de aquisição** [Certain], como segunda perna da
  mesma nota (§4.1);
- **documento hábil = a NFS-e (que já discrimina a retenção) + o comprovante de
  recolhimento da guia**, em nome/CPF dele. A guia sozinha não sustenta nada;
  a nota sozinha não prova o desembolso.

**(B) A lei municipal NÃO atribui a ele.** Então a nota está com a retenção
marcada **indevidamente**, e:
- **quem deve o ISS é a prestadora**, dentro do DAS;
- **ele deve à empreiteira os R$ 40.857,14 cheios**, não os R$ 38.968,40;
- o caminho é **cancelamento e reemissão** da nota — em NFS-e a regra é
  municipal, a janela costuma ser curta [Guessing quanto ao prazo em
  Florianópolis, pendência registrada desde 2026-08-16] — **e ela se fecha muito
  antes do fim da obra**.

**O que é [Certain] nos dois desfechos**: **pagar R$ 38.968,40 e parar por aí
deixa obrigação em aberto.** Ou com o município, ou com a empreiteira. **Isso
tem que ser resolvido antes do pagamento, não depois.**

### 5.3 Regra de produto que nasce daqui

Quando a nota trouxer **retenção de ISS com tomador pessoa física**, o app
**pergunta** (nunca assume): *"quem recolhe este ISS — você ou a empresa?"*, sem
default, com as duas consequências escritas ao lado. Enquanto não respondida, a
nota fica **parcialmente paga** e a pendência é nomeada. **Proibido** o app somar
o líquido como se fosse o total, e **proibido** o app decidir sozinho o desfecho
(A) ou (B) — depende de lei municipal, que é fato externo.

---

## 6. Pergunta 5 — o CNO impresso na nota

### 6.1 Tem efeito próprio? **Sim, dois — e um terceiro que ele não tem**

1. **Aferição**: é o que vincula o serviço àquela obra. Sem CNO na nota, não há
   vínculo a corrigir depois; foi o §3 do parecer de 2026-08-09 e continua de pé.
2. **Custo de aquisição / discriminação**: é a prova documental de que a despesa
   pertence **àquele imóvel**, e não a outro bem do declarante. Numa intimação,
   é o que amarra R$ 40.857,14 à matrícula que ele vendeu. Vale mais numa obra
   com **duas** obras no mesmo CPF — que é exatamente o caso dele. [Certain]
3. **O que ele NÃO prova**: que a empreiteira **declarou** aquele CNO em
   EFD-Reinf/DCTFWeb. CNO impresso é **declaração unilateral do emitente**.
   **Necessário, não suficiente.** [Certain]

### 6.2 Vira campo obrigatório?

**Não vira campo de digitação. Vira checagem — e só onde ela pode ter duas
respostas.**

- **Aplica-se a `nf_servico`.** [Certain] NF de material não carrega CNO e não
  toca a aferição; exigir ali é atrito sem consequência, e atrito sem
  consequência fabrica carimbo (regra do parecer de 2026-08-16).
- **Só quando a obra TEM CNO.** Se a obra não tem, não se pergunta — a pendência
  já existe, é outra, e perguntar algo com uma única resposta possível é ruído.
- **Não é redigitar o número.** O app já sabe o CNO da obra; ele **exibe** o
  número e pergunta: *"o CNO 900298420564 está impresso nesta nota?"* — sim/não,
  **sem default**. Redigitar cria erro de digitação e a ilusão de conferência.
- **"Não" não bloqueia.** Mantém a decisão (b) de 2026-08-09: salva, cria
  pendência, entra na lista de cobrança da empreiteira (CONTAI-007) **enquanto
  ainda há parcela a pagar**.
- **Caso novo, e é o mais perigoso**: a nota traz um CNO **diferente** do CNO da
  obra selecionada. Isso não é typo — é **despesa atribuída à obra errada**, e
  contamina as duas apurações das duas obras. **Tem que ser alerta próprio**, com
  a pergunta *"esta nota é da outra obra?"*.
- **Proibido**: preencher, sugerir ou copiar CNO entre obras; usar o CNO de uma
  obra como default de outra.

---

## 7. A lista fechada de regimes — e o que cada um muda

Diretriz do Mateus: *"o app tem que suportar todos os casos possíveis através de
configurações"*. **Discordo da formulação, e a discordância é fiscal, não de
gosto**: "todos os casos possíveis" inclui casos que **não existem para pessoa
física construindo residência própria**, e configuração que ninguém sabe
preencher é preenchida errado — o que é pior que não existir, porque passa a
justificar o número na tela. **Lista fechada, três regimes, um híbrido. Nada
além.**

| # | Regime | (a) Retenção de INSS | (b) Quem faz a aferição | (c) O que entra no custo |
|---|---|---|---|---|
| 1 | **Empreitada total** com empresa construtora (todo o material e toda a mão de obra, ART dela) | **Nenhuma.** Dupla razão: tomador PF **e** empreitada total | **Da construtora**, no CNO dela — **mas o dono continua solidário** (art. 30, VI) e precisa da **CND da obra** para averbar | **Valor bruto da NFS-e**, no ano de cada pagamento. Material e mão de obra num só documento — **sem rateio estimado** |
| 2 | **Empreitada parcial / subempreitada** (a PJ executa parte; o dono contrata outras frentes) | **Nenhuma com tomador PF** [Likely — pergunta nº 1 ao CRC]. Com tomador PJ seria devida | **Do dono**, no CNO dele | **Valor bruto de cada nota**, no ano do pagamento. A retenção **não muda o custo** |
| 3 | **Administração direta / preço de custo** (o dono compra material e contrata mão de obra; a PJ, se houver, cobra taxa de administração) | Não há retenção de 11% sobre PF. **Mas nasce obrigação previdenciária própria do dono** sobre o segurado que lhe presta serviço (art. 15, § único) [Likely — **CRC**] | **Do dono**, no CNO dele | Material (NF no CPF) + recibos de PF (**CPF por CPF na ficha Pagamentos Efetuados**) + a taxa de administração |
| 4 | **Misto** — o mundo real: empreitada + compras diretas + diaristas | **Por nota**, conforme a linha correspondente | **Do dono**, salvo se houver empreitada total com CNO da construtora | Soma das linhas acima |

### O que eu **corto** da lista, e por quê

- **Cessão de mão de obra / trabalho temporário** (a figura pura do art. 31) —
  **cortado**: é relação entre empresas. Dono de obra PF não contrata cessão de
  mão de obra para residência própria.
- **Incorporação imobiliária / construção habitual para venda** — **cortado como
  configuração e promovido a ALERTA**. Se o padrão de uso indicar construção
  habitual para venda, há **equiparação a pessoa jurídica** (RIR/2018, art. 166 e
  seguintes) e **o regime muda por inteiro** — não é um toggle, é outro produto.
  O app **para e avisa**; não configura.
- **RET, patrimônio de afetação, Lucro Real, PoC, SPED ECD/ECF** — **cortados**:
  fora do escopo declarado do projeto.
- **Dispensa de matrícula/CNO** (residencial unifamiliar, tipo econômico, uso
  próprio, **sem mão de obra assalariada**, art. 30, VIII da Lei 8.212/91)
  [Likely] — **cortado para esta obra**: há empreiteira PJ e prestadores PF
  pagos. **Deixa de existir no instante em que alguém é pago para trabalhar.**

### Como a configuração deve se comportar

1. **Padrão na obra, divergência por nota** — confirmando o que o Mateus já havia
   dito. Justificativa fiscal, não de UX: o regime **1** e o regime **3**
   convivem na mesma obra e na mesma semana.
2. **O que a configuração MUDA**: se o app pergunta sobre retenção; **qual texto
   de aviso aparece** ("esta nota não abate a aferição **desta obra**" × "a
   aferição desta obra é da construtora — exija a CND"); quem o app diz que é o
   dono da obrigação do CNO (o texto alternativo da Q14).
3. **O que a configuração NUNCA muda**: **o custo de aquisição.** [Certain]
   Custo depende de desembolso, documento hábil no CPF dele, incorporação ao
   imóvel e discriminação na DAA — as **quatro condições** do parecer de
   2026-08-17. **Nenhum regime de empreitada altera qualquer uma delas.** Esta é
   a frase que impede a configuração de metastatizar: **ela existe para tornar o
   aviso verdadeiro, não para mudar a conta.**
4. **Sem default.** [Certain] Regime de execução é campo fiscal; campo fiscal
   preenchido sozinho **afirma** uma coisa que ninguém verificou. Cada opção
   carrega **uma linha de consequência** ao lado, e a opção *"não sei ainda"*
   **precisa existir** — porque hoje, com a Q14 e a Q15 abertas, **é a resposta
   verdadeira para as duas obras.**

---

## 8. ⚠️ Onde este parecer contraria o que está escrito

### 8.1 O invariante do `CLAUDE.md` está **incompleto**, não errado

> *"Base de aferição INSS (SERO): só NF de serviço PJ com retenção de 11% abate"*

**A regra continua correta no que afirma** e se aplica integralmente a esta nota
(§3.1). **O que ela não diz** é que **pressupõe o regime 2** — obra aferida pelo
dono. No regime 1 a pergunta certa não é *"esta nota abate?"*, é *"de quem é a
aferição?"*, e a resposta operacional é a **CND da obra**, não o abatimento.

**Emenda proposta ao invariante**, para quem for atualizar o `CLAUDE.md`:

> **Base de aferição INSS (SERO)**: só NF de serviço PJ **com retenção de 11%
> recolhida e declarada com o CNO da obra** abate; material é irrelevante aqui.
> **A regra pressupõe que a aferição é do dono da obra.** Em empreitada total com
> empresa construtora, a aferição é dela — mas o **dono permanece solidário**
> (Lei 8.212/91, art. 30, VI) e **depende da CND da obra para averbar e vender**.

### 8.2 Corrijo um recorte meu de 2026-08-09

Naquele parecer eu escrevi que, pelos fatos então registrados (material no CPF
dele, prestadores PF avulsos), *"isso é empreitada parcial e o CNO é dele"*.
**Aquilo valia para a obra SEM CNO e continua valendo lá, sem resposta.** Não se
transporta para a **Casa Tanheiros**, onde o Mateus afirma que **tudo passa pela
empreiteira**. **São duas obras, dois regimes possíveis, duas respostas.**
Tratá-las com uma configuração só é o erro que o app deve impedir.

### 8.3 Um defeito de produto que esta nota revela

O tratamento de `retencao_11 = false` como alarme uniforme (§4.2) produz, no caso
dele, **alerta vermelho permanente em toda parcela de empreitada** — pelo mesmo
raciocínio que rejeitou a caixa "Salvar mesmo assim" em 2026-08-10: **aviso que
sempre aparece deixa de ser aviso.**

---

## 9. Automático × exige contador humano (CRC)

**O sistema pode sozinho** [Certain]: registrar a nota pelo **bruto**; guardar as
seis retenções e o líquido; exigir as duas pernas de pagamento e fechar
`Σ pagamentos == valor da nota`; alocar cada perna no ano da sua data de
pagamento; perguntar se o CNO está impresso e comparar com o CNO da obra; alertar
CNO divergente; manter a exposição INSS **fora de qualquer soma de custo**;
recusar rateio estimado de material/mão de obra; gerar a discriminação com a
oração de empreitada; e **dizer, com todas as letras, que não sabe o regime
enquanto ninguém responder**.

**Só o Mateus**: o contrato, a ART, o município, o desfecho (A)/(B) do ISS, e se
já pagou o quê.

**Exige CRC** [Certain]:
1. **Se o tomador pessoa física está obrigado a reter 11%** — a *pergunta nº 1*,
   aberta desde 2026-08-09 e agora com um caso concreto de R$ 40.857,14 para
   ilustrá-la.
2. **Se o Mateus é responsável pelo ISS retido** e como recolher (lei municipal).
3. **Se a Casa Tanheiros é empreitada total** na acepção previdenciária, e **em
   nome de quem o CNO deveria estar**.
4. **Como a aferição trata obra executada por empresa optante pelo Simples**
   (Anexo III × Anexo IV) e o que efetivamente abate a base.
5. **O alcance da solidariedade do art. 30, VI** e se há hipótese de elisão.
6. **O texto que vai à declaração**, qualquer retificadora, e a assinatura.

**O contai redige, dateia e organiza. Não assina.**

---

## 10. Perguntas ao Mateus — uma linha cada

- **P1** — Qual é o município desta nota (o "local de prestação 8105"), e a lei
  dele obriga **tomador pessoa física** a reter e recolher o ISS?
- **P2** — O contrato com a empreiteira diz "empreitada global/total" e inclui o
  fornecimento de **todo** o material? (manda a cláusula de escopo)
- **P3** — Quem assina a **ART/RRT de execução** da obra: a empreiteira ou um
  profissional contratado por você?
- **P4** — A empreiteira é optante do Simples em qual **anexo** (III ou IV)?
- **P5** — Você já pagou esta nota? Pagou **R$ 38.968,40** ou **R$ 40.857,14**,
  em que data e por qual meio?
- **P6** — Você recebeu ou emitiu **guia municipal de ISS de R$ 1.888,74**, e
  está cadastrado como responsável/substituto no sistema da NFS-e do município?
- **P7** — Por que o **CNO 900298420564 está em seu nome** se a obra é empreitada
  total: foi você que registrou, ou a empreiteira pediu? (**Q15**)
- **P8** — Quantas notas dessa empreiteira já existem com esse CNO, e **quantas
  parcelas ainda faltam** pagar? (é a medida exata da alavanca)
- **P9** — A empreiteira já lhe entregou **algum comprovante de EFD-Reinf,
  DCTFWeb ou eSocial** informando esse CNO?
- **P10** — A nota traz o **seu CPF como tomador**? (§0.1 — se não trouxer, tudo
  muda)

---

## 11. A confirmar na legislação ou no programa do ano — não afirmar como fato

- **IN vigente da matrícula/aferição**: a IN RFB 971/2009 teria sido consolidada
  pela **IN RFB 2.110/2022** — numeração de artigos **não cravada**. Pendência
  aberta desde 2026-08-08.
- **Dispositivo que exclui a retenção quando o contratante é pessoa física**, e o
  que define **empreitada total** e o titular do CNO nela.
- **Redação vigente do art. 30, VI da Lei 8.212/91** e hipóteses de elisão da
  solidariedade.
- **LC 116/2003, art. 6º, §2º, II** — confirmar os subitens da lista e a
  literalidade "pessoa jurídica".
- **Lei do município** sobre responsabilidade do tomador **pessoa física**, prazo
  de recolhimento da guia e **janela de cancelamento/reemissão de NFS-e**.
- **LC 123/2006, art. 18** (enquadramento de construção civil no Anexo IV) e
  **art. 21, §4º** (alíquota efetiva de ISS na retenção).
- **Códigos do documento**: serviço **70202**, local **8105**, situação
  tributária **"TIST"** — manual da NFS-e do município.
- **Limite de caracteres do campo Discriminação** [Likely — historicamente 512].
- **Alíquotas do ganho de capital, DARF 4600 e códigos de ficha** — conferir no
  programa do ano da venda.

---

# ADENDO — 2026-08-18 · "sai no meu CNO" — a aferição é dele, e isso corrige um invariante do projeto

- **Provocação**: resposta literal do Mateus à pergunta de quem responde pela
  obra — **"sai no meu CNO"** —, somada a: *tudo passa pela empreiteira* (não
  contrata mão de obra direto) e *a empreiteira confirmou que faria exatamente
  como está na nota*.
- **Efeito**: **cai a hipótese de empreitada total deslocar a responsabilidade.**
  O §3.2 acima deixa de ser condicional: **a aferição é dele, ponto.** O §1
  (dúvida sobre o regime) fica resolvido pelo lado que importa — **não pelo
  contrato, pelo cadastro**, exatamente como aquele parágrafo previu.
- **Este adendo corrige o §3.1 deste mesmo parecer.** Ver A.0.

---

## A.0 ⚠️ Correção de uma razão que eu dei há uma hora

No §3.1 escrevi que a nota não abate nada por **duas razões independentes**, a
primeira sendo *"não houve retenção de 11%"*. **A primeira razão está errada como
razão independente.** [Certain]

A retenção nunca foi o que abate — ela é o **mecanismo de garantia** de um mundo
em que o tomador é empresa. **Vale a segunda razão, e só ela**: *nota não é
declaração*. A consequência prática muda de sinal:

| Leitura | Consequência |
|---|---|
| ~~Não abate porque não houve retenção~~ | seria **perda definitiva** — nada a fazer |
| **Não abate porque falta a declaração vinculada ao CNO** | **perda recuperável**, enquanto houver prazo de retificação **e** parcela a pagar |

**Isso é notícia melhor e mais urgente ao mesmo tempo.**

---

## A.1 ⚠️⚠️ CORREÇÃO DE INVARIANTE CENTRAL — o `CLAUDE.md` descreve hoje uma condição inalcançável

**Texto vigente**, no bloco "Invariante fiscal central":

> *"**Base de aferição INSS (SERO)**: só NF de serviço PJ com retenção de 11%
> abate; material é irrelevante aqui."*

**Por que ele não pode ficar de pé** [Likely, confiança alta]:

1. A retenção de 11% é obrigação dirigida à **"empresa contratante"** — Lei
   8.212/91, **art. 31**. O tomador deste produto é **pessoa física, dona de obra
   de residência própria**, e não é empresa para esse efeito: a equiparação do
   **art. 15, parágrafo único** alcança o contribuinte individual *"em relação a
   segurado que lhe presta serviço"* — o prestador **pessoa física**, não a nota
   de PJ. Consta ainda dispositivo da IN de arrecadação que **exclui
   expressamente** a retenção quando o contratante é pessoa física
   [**confirmar o artigo na IN vigente**].
2. Logo: **nenhuma nota de serviço desta obra — nem desta, nem da outra, nem de
   nenhuma obra de pessoa física — vai vir com retenção de 11%.** Não é falha da
   empreiteira, não é negligência do Mateus, não é corrigível por cobrança.
3. **Uma condição que nunca pode ser satisfeita não é uma regra: é um alarme
   permanente.** E alarme permanente vira carimbo — foi exatamente o argumento
   que rejeitou a caixa "Salvar mesmo assim" em 2026-08-10. Hoje o app manda o
   Mateus perseguir uma coisa que **não existe no mundo dele**, e cala sobre a
   que existe.

### Redação que substitui o invariante

> **Base de aferição INSS (SERO)**: o que reduz a base é a **remuneração de mão
> de obra declarada pela empresa prestadora e vinculada ao CNO da obra**
> (eSocial, com **lotação tributária no CNO**, mais EFD-Reinf/DCTFWeb).
> **A retenção de 11% NÃO é condição** — ela é o mecanismo do mundo em que o
> tomador é empresa (Lei 8.212/91, art. 31) e **não existe quando o tomador é
> pessoa física**. **NF de material não abate nada.**

**Isto não afrouxa nada.** A exigência ficou **mais difícil de cumprir**, não
menos: retenção é ato do tomador (ele mandaria fazer); declaração é ato **da
empreiteira**, e depende de a contabilidade dela lançar a folha com o CNO dele.
**Saiu do controle dele e passou para o controle de um terceiro** — por isso a
alavanca do saldo a pagar deixou de ser conselho e virou o instrumento principal.

### Consequência de produto, direta

`documento.retencao_11` **deixa de ser o gatilho fiscal**. Em obra de pessoa
física seu valor correto é **sempre "não"**, e um campo que nunca varia não
informa nada — só produz vermelho. Ver A.4.

---

## A.2 Então o que abate, de verdade? — o caminho que existe

**Resposta curta: a declaração da empreiteira, com o CNO dele. Não a nota, não a
retenção, não o comprovante de recolhimento dela.** [Likely, confiança alta]

### Como a conta é montada

A aferição da obra é **indireta**: a Receita apura a **remuneração da mão de obra
total** da obra a partir de **área construída, tipo e padrão da obra**, com base
no **CUB** — **não** a partir do que ele gastou. Sobre essa base incidem as
contribuições. **Deduz-se dessa base a mão de obra que já foi declarada e
vinculada àquele CNO.** [Likely; **confirmar a mecânica e os percentuais na IN
vigente e no manual do SERO**]

Três consequências que precisam estar escritas:

1. **O que ele pagou não entra na conta.** Os R$ 40.857,14 **não são teto, nem
   piso, nem base.** A base é área × CUB × percentual. Nota paga sem declaração
   vinculada é dinheiro que saiu **e** base que não desce.
2. **A dedução tem endereço: o CNO 900298420564.** O mecanismo concreto, no
   eSocial, é a **lotação tributária** da obra: a empresa cadastra o CNO como
   lotação (evento **S-1020**) e informa nele as remunerações dos trabalhadores
   alocados (**S-1200**), consolidando em **DCTFWeb**; na EFD-Reinf, o evento de
   **serviços prestados (R-2020)** carrega a obra. [Likely quanto aos códigos —
   **confirmar**.] Se a folha da obra dele estiver lançada no CNPJ da empreiteira
   **sem lotação no CNO**, aquela mão de obra **existe para o fisco e não existe
   para a obra dele**.
3. **O comprovante de recolhimento da empreiteira NÃO serve** — ver A.3.

### E se ela não declarar? A resposta honesta

**Aferição integral sobre a base do CUB, e ele paga INSS sobre mão de obra que já
pagou dentro do preço.** [Certain quanto ao mecanismo] Não há terceira via: não
existe, para pessoa física dona de obra, um caminho de dedução que dependa só
dele. **É por isso que a pergunta à empreiteira vale mais que qualquer campo do
app.**

### Um ponto que precisa de CRC, e é específico do Simples

Construção de imóveis e obras de engenharia em geral são tributadas no **Anexo
IV** [Likely, confiança alta — **confirmar LC 123/2006, art. 18, §5º-C e o
enquadramento real dela**], e o Anexo IV tem a **contribuição patronal FORA do
DAS** — ou seja, a empreiteira **tem folha, CPP própria e declarações
previdenciárias**, que é justamente o que pode ser vinculado ao CNO. **Se ela
estiver em anexo em que a CPP está dentro do DAS, o caminho da dedução muda e eu
não sei dizer como.** [Guessing] **É pergunta ao CRC, e é barata: basta saber o
anexo** (P4).

---

## A.3 Corrijo o coordenador: "comprovantes de recolhimento" não é o pedido certo

**Você está certo em ter percebido, e a correção é maior do que parece.**
[Certain]

O comprovante de recolhimento da empreiteira — DAS, DARF, guia — **é por empresa,
por competência, e não identifica obra nenhuma.** Ele prova que ela pagou os
tributos dela; **não prova que um único centavo daquilo se refere à obra do
Mateus**. Guardar essa guia dá sensação de cobertura e **não abate um real** da
aferição.

### O que substitui — lista curta, na ordem em que dá para exigir

1. **Uma pergunta, hoje, ao contador da empreiteira, por escrito**:
   > *"Vocês declaram a folha desta obra com **lotação tributária no CNO
   > 900298420564**? A partir de qual competência?"*

   **É o item mais barato e mais caro do parecer.** Se a resposta for "não",
   ele descobre **hoje**, com parcelas na mão, que vai pagar a aferição integral
   — e isso é **negociação de preço agora**, não surpresa na venda.
2. **Comprovação mensal, antes de cada parcela**: recibo de entrega do **eSocial
   / EFD-Reinf / DCTFWeb** da competência **em que o CNO apareça**. Não é a guia
   de pagamento — é o **recibo da declaração**.
3. **Retificação das competências já passadas**, enquanto o prazo permite e
   enquanto ela tem interesse (parcela a receber). **Quanto mais tarde, mais caro
   para ela — e mais ela resiste.**
4. **Cláusula contratual** (aditivo, se o contrato já existe): obrigação de
   declarar com o CNO, entrega mensal do comprovante, e **retenção de uma parcela
   final até a emissão da CND da obra** — instrumento que a **Lei 8.212/91, art.
   30, VI** nomeia expressamente ao admitir a retenção de importância devida ao
   construtor como garantia.
5. **Declaração por escrito**, por nota: número, competência, **CNO** e o valor
   da mão de obra declarada naquela obra.

**O que NÃO adianta pedir**: cópia do DAS; "declaração de que está tudo em dia";
carta de correção da nota (não muda declaração); e **passar a reter 11% por
conta própria** — retenção não devida não gera dedução para ele e cria problema
de crédito para ela.

### Sobre "a empreiteira confirmou que faria exatamente como está na nota"

**Você está certo, e há dispositivo para citar.** [Certain] **CTN, art. 123**: as
convenções particulares relativas à responsabilidade pelo pagamento de tributos
**não podem ser opostas à Fazenda Pública** para modificar a definição legal do
sujeito passivo. A empreiteira concordar não desloca obrigação nenhuma.

**Uma ressalva que joga a favor dele**: entre as partes, o acordo **vale** — é
base de **direito de regresso** e de responsabilidade contratual. Por isso a
regra prática é: **combine por escrito, e não confunda o escrito com proteção
fiscal.** O papel serve para processar a empreiteira depois, não para responder
ao fisco antes.

---

## A.4 Consequência de caixa — ordem de grandeza e vencimento

### O número

**Recuso estimar em reais, e a recusa é útil.** [Certain quanto à recusa] A base
depende de **área construída, tipo e padrão da obra e CUB do período** — três
dados que eu não tenho e que **nenhum deles está no app**. Qualquer faixa que eu
escrevesse aqui viraria "o contador disse que dá em torno de X", e número inflado
ou deflado em tela fiscal contamina a confiança nas outras (adendo de
2026-08-10).

**O que substitui a estimativa, e é melhor que ela**: o **próprio SERO calcula**,
no e-CAC, informando área e padrão. **Ele pode levantar esse número agora**, com
parcelas ainda a pagar, em vez de descobri-lo na venda. [**Confirmar se o SERO
permite aferição em rascunho/simulação sem gerar débito** — se não permitir,
é conversa de dez minutos com o CRC, que faz a conta de cabeça.]

**A única coisa que eu afirmo sobre a grandeza** [Certain]: ela **não é
proporcional ao que ele gastou**. Obra grande e barata paga a mesma aferição de
obra grande e cara. Comparar com os R$ 40.857,14 é comparar unidades diferentes.

### O vencimento — e esta é a parte desconfortável

**Não vence na venda.** [Likely, confiança alta] O fato gerador da contribuição é
**mensal**, acompanha a execução da obra. O débito **já existe**, competência a
competência, e **multa e juros já correm**. A aferição não cria a dívida: ela
**apura** uma dívida que está correndo desde a primeira semana de obra.

**A venda é apenas o momento em que ele é obrigado a resolver**: sem
regularização não sai a **CND da obra**; sem CND não há averbação da construção;
sem averbação o cartório não lavra e o banco do comprador não financia (Lei
8.212/91, **art. 47, II**) [Likely, confiança alta]. **Esperar não é neutro — é
caro e cresce.**

Sobre decadência de competências antigas: **não conto com ela** [Guessing]. Pode
haver competência alcançada pelo prazo, mas a CND exige a regularização da obra
como um todo, e apostar em decadência para não pagar é estratégia que se descobre
errada no balcão do cartório. **Pergunta ao CRC, não premissa do app.**

### O que dá para fazer com dinheiro, hoje

Enquanto houver parcela a pagar, isto é **negociação comercial**, não fiscal: se
a empreiteira **não** for declarar com o CNO, o custo do INSS não declarado é
**real e previsível**, e cabe nas parcelas que faltam. Depois da última, cabe só
no bolso dele.

---

## A.5 Produto — a lista encurta, e o campo que hoje alarma é o campo errado

O Mateus tem razão na crítica: o sistema estava caminhando para uma **taxonomia
de regimes**, e taxonomia é a forma mais elegante de engessar. **Corto.** O que
resta são **duas perguntas** — e nenhuma delas é sobre retenção.

### Pergunta 1 — por obra, uma vez: *quem responde pela aferição do INSS desta obra?*

| Opção | Consequência que o app escreve ao lado |
|---|---|
| **Eu — a obra está no meu CNO** ← **resposta do Mateus para a Casa Tanheiros** | "A base do INSS desta obra é apurada em **seu** nome. Só abate a mão de obra que as empresas declararem **com o seu CNO**." |
| A construtora — empreitada total, obra matriculada no CNO dela | "A aferição é dela. **Você continua solidário** (art. 30, VI) e **precisa da CND da obra** para averbar e vender." |
| **Não sei ainda** | "Enquanto não souber, o app não afirma nada sobre a aferição desta obra." — **é a resposta verdadeira para a obra sem CNO, e ela precisa existir.** |

**Sem default.** [Certain] E **nada hardcoded**: a resposta é dado da obra, não
constante do código. A Casa Tanheiros nasce com **"Eu"**; a segunda obra nasce
com **"Não sei ainda"**, porque **Q14 continua aberta** e este adendo **não a
responde** — a resposta "sai no meu CNO" é sobre o CNO 900298420564.

### Pergunta 2 — por nota de serviço: *esta mão de obra foi declarada no meu CNO?*

**Sim** (com comprovante da declaração anexado) · **Não** · **Ainda não sei**
(padrão de nascimento — nunca "sim" presumido).

É **este** o campo que varia, que custa dinheiro e que gera a lista de cobrança
do CONTAI-007. Só aparece quando a Pergunta 1 for **"Eu"** e a obra tiver CNO —
nos outros casos a pergunta não tem função.

### O que eu corto, e digo que cortei

- **Corto o toggle "houve retenção de 11%?" do caminho de captura.** [Certain]
  Em obra de pessoa física a resposta é **sempre "não"**, estruturalmente
  (A.1). Pergunta cuja resposta nunca muda é atrito puro — e pior: hoje ela
  **pinta de vermelho o estado normal e correto**. O valor continua sendo
  **capturado** da nota como fato (R$ 0,00, ao lado das outras retenções, §4.1),
  mas **deixa de ser pergunta e deixa de disparar alerta**.
- **Corto a taxonomia de regimes** (total / parcial / administração / misto) como
  **configuração**. Ela permanece **neste parecer, como referência fiscal** (§7),
  e **sai da tela**: o único efeito que o app precisa dela é *quem responde pela
  aferição*, que é a Pergunta 1. **Um radio, não um formulário.**
- **Mantenho cortados**: cessão de mão de obra pura, RET/afetação/Lucro Real/PoC,
  e a dispensa de CNO do art. 30, VIII (some no instante em que alguém é pago
  para trabalhar). **Equiparação a PJ continua sendo alerta, nunca opção.**
- **Nomenclatura**: o rótulo comercial ("empreitada global, preço fechado, tudo
  com a empreiteira") e o efeito previdenciário **divergem** neste caso — o
  arranjo é comercialmente global e, para o INSS, **não é empreitada total**,
  porque a matrícula ficou com o dono. **O app não deve nomear pelo rótulo
  comercial**; deve perguntar pelo efeito. É o que a Pergunta 1 faz.

---

## A.6 O que este adendo NÃO muda

- **§4 — custo de aquisição**: continua **R$ 40.857,14, o bruto**, com as duas
  pernas de pagamento e o fechamento `Σ pagamentos == valor da nota`. Regime de
  empreitada e aferição **não tocam o custo**. [Certain]
- **§5 — ISSRF**: inalterado; os dois desfechos (A)/(B) seguem abertos e
  dependem da lei municipal (P1/P6).
- **§6 — CNO impresso na nota**: **ganha peso**. Com a aferição confirmada no CNO
  dele, o CNO impresso deixa de ser boa prática e vira **o primeiro elo da única
  cadeia que abate**. A checagem "o CNO está impresso nesta nota?" é a versão
  barata da Pergunta 2 — mas **não a substitui**: nota com CNO impresso e sem
  declaração **não abate nada**.
- **§8.2** — Q14 segue aberta; **Q15 está respondida** ("sai no meu CNO") e o que
  restou dela é: *se é assim, o contrato precisa parar de ser chamado de
  empreitada total em qualquer lugar do app*.

---

## A.7 Perguntas que este adendo acrescenta

- **P11** — A empreiteira declara a folha desta obra com **lotação tributária no
  CNO 900298420564**? Desde qual competência? (uma frase ao contador dela)
- **P12** — **Qual a área total construída** e o padrão/tipo da obra? (sem isso
  não existe ordem de grandeza da aferição, nem no app nem no CRC)
- **P13** — Quantas competências de obra já se passaram desde o início, e quantas
  parcelas ainda faltam? (mede a dívida que já corre e a alavanca que resta)
