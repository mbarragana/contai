# Parecer fiscal — Gate Fiscal do CONTAI-004 e do CONTAI-005

- **Data**: 2026-08-16
- **Autor**: agente `contador` (autoridade fiscal do projeto), execução read-only
- **Veredicto**: **CONTAI-004 — APROVADO COM RESSALVAS** (R1–R5 bloqueantes) ·
  **CONTAI-005 — APROVADO COM RESSALVAS** (R1–R5 bloqueantes)

> Transcrição do parecer do agente `contador`. As marcações `[Certain]` /
> `[Likely]` / `[Guessing]` são dele. Nada aqui substitui contador humano (CRC)
> na assinatura da declaração.

---

## Achado que atravessa os dois tickets

**O headline vai ser renderizado abaixo de um "Custo confirmado: R$ 0,00" que é
estrutural, não factual.** `sustentaCusto` (`lib/fiscal/resumo.ts`) exige
`pagamento.status === "conciliado"`, e **nada na interface cria conciliação** —
a US-003 não existe. Hoje a home diz *"você confirmou R$ 0 de custo e tem
R$ 49.850 em risco"*: falso sobre a obra, verdadeiro apenas sobre o app.

É a mesma classe de erro que o Gate 2 do CONTAI-001 recusou no "~R$ 728" — não
um número errado isolado, mas moldura que faz concluir errado a partir de
números individualmente corretos. [Certain no mecanismo.] Virou a R5 do 005.

---

# PARTE 1 — CONTAI-004

## Correção de premissa

"Nota fiscal, recibo, boleto e comprovante" não são quatro casos do mesmo eixo.
**Boleto é título de cobrança** (não é documentação hábil — Gate 2 do
CONTAI-001, R1) e **comprovante de PIX não é `documento`, é `pagamento`**. Só
dois dos quatro compõem a discriminação.

## 1. A regra, em "se X e Y → Z"

### Bloqueantes (impedem salvar)

- **Se** `tipo ∈ {nf_material, nf_servico}` → `numero` e `data_emissao`
  **obrigatórios**. [Certain] São os campos que identificam a nota na
  discriminação e numa intimação; sem eles a metade "discriminado" do art. 17 da
  IN SRF 84/2001 fica sem lastro.
- **Se** `tipo ∈ {nf_material, nf_servico}` **e** `status = 'quarentena'` →
  **continuam obrigatórios**. [Certain] Contraintuitivo e correto: é a nota
  errada que precisa ser identificada para ser **cancelada e reemitida** — e em
  NF-e carta de correção **não** altera destinatário. Sem número não há o que
  pedir.
- **Se** `tipo = nf_servico` → `data_emissao` obrigatória **também** porque
  posiciona a nota dentro/fora da janela sem CNO (`data_inicio_obra` →
  `cno_registrado_em`), que é a lista de cobrança do CONTAI-007, critério 8.
- **Se** `data_emissao` **posterior a hoje** → **recusar**. [Certain] Documento
  não existe antes de ser emitido. É coerência documental, **não** é a regra de
  data de pagamento futura — não reaproveitar a mensagem de uma na outra.

### Não bloqueantes

- **Se** `tipo = boleto` → `numero` e `data_emissao` **opcionais**. [Certain]
  Boleto não entra em discriminação nenhuma; exigir campo em documento que não
  compõe saída fiscal é atrito sem consequência, e atrito sem consequência
  fabrica carimbo. O campo obrigatório do boleto segue `vencimento`.
- **Se** `tipo = recibo de PF` (não existe no enum; nasce com a US-006) →
  `data_emissao` **obrigatória**, `numero` **opcional com ausência declarada**
  ("recibo sem número"), nunca em branco por omissão.

**"Recibo de pedreiro tem número?" Em regra, não.** [Certain] O que o torna
documentação hábil é outra coisa: nome, **CPF completo**, descrição do serviço,
valor, data, assinatura, mais o comprovante da transferência da conta do
declarante. **O sistema nunca gera número para recibo que não tem** — número
inventado em campo fiscal é a falha do backfill de `data_inicio_obra`: *campo
vazio pergunta, campo preenchido afirma*.

### Conteúdo dos campos

- `numero` é **texto literal** — zeros à esquerda, letras, barras, pontos.
  [Certain] NFS-e municipal usa numeração própria; converter para inteiro
  destrói a identificação.
- `data_emissao` **anterior ao início da obra é legítima** (projeto, ART, ITBI,
  escritura antecedem a obra) e não gera aviso.
- **Não existe unicidade global de `numero`.** [Certain] É único por
  **emitente + série + modelo**. Detecção de duplicidade tem que considerar
  emitente.
- Para NF-e, capturar a **data de emissão** (`dhEmi`), não a data de saída
  (`dhSaiEnt`). [Certain] Registrado agora porque a US-008 vai ler XML.

## 2. Texto da discriminação — literal

**Bloco A — núcleo (campo "Discriminação" de Bens e Direitos):**

```
IMÓVEL RESIDENCIAL EM CONSTRUÇÃO. Terreno matrícula nº [matrícula] do
[cartório], [município]/[UF], adquirido em [dd/mm/aaaa] por R$ [valor do
terreno], acrescido de ITBI de R$ [itbi] e de escritura e registro de
R$ [escritura e registro]. Construção de residência unifamiliar iniciada em
[dd/mm/aaaa], obra inscrita no CNO nº [cno]. Situação em 31/12/[ano-1]:
R$ [acumulado anterior]. Dispêndios pagos no ano-calendário de [ano]:
R$ [total pago no ano], sendo R$ [materiais] em materiais e R$ [mão de obra]
em mão de obra e serviços. Situação em 31/12/[ano]: R$ [acumulado].
Dispêndios comprovados por notas fiscais e recibos emitidos em nome e CPF do
declarante, mantidos em seu poder.
```

**Bloco B — identificação das notas (onde `numero` e `data_emissao` entram):**

```
Principais documentos: NF nº [numero], série [serie], emitida em
[dd/mm/aaaa] por [nome do fornecedor], CNPJ [cnpj], valor total
R$ [valor total do documento], pago R$ [valor pago neste ano-calendário] em
[ano]; NF nº [...]; recibo de [nome], CPF [cpf], emitido em [dd/mm/aaaa],
R$ [valor].
```

### Cinco regras de geração que não se reinventam

1. **`data_emissao` sai como "emitida em"; `data_pagamento` como "pago R$ Y em
   [ano]".** Convivem na mesma linha e **não são intercambiáveis**. É o ponto
   exato onde a troca aconteceria.
2. **"Valor total" é do documento; "pago" é do ano-calendário.** NF consolidada
   paga em parcelas cruzando o ano (Q6) aparece na discriminação de **dois
   anos**, com valores pagos diferentes e o mesmo valor total. Somar "valor
   total" das notas dá número que não é o custo de ano nenhum.
3. **Documento sem número não vira "NF nº —".** Sai como `recibo de [nome], CPF
   [cpf], emitido em [data]`. Nunca com placeholder vazio.
4. **Documento em quarentena não entra em nenhum dos dois blocos.** [Certain]
   Não é documentação hábil e não compôs o custo declarado; aparecer sugeriria
   custo maior que o declarado.
5. **Se o Bloco B não couber, corta-se o B — nunca o A.** O campo tem limite de
   caracteres [Likely — historicamente 512; **confirmar no programa do ano**].
   Prioridade: composição do ano e material/mão de obra > CNO > matrícula >
   enumeração de notas. **O Bloco B completo é sempre gerado e vai para o pacote
   do CONTAI-011 (R3)** — lá não há limite.

**O sistema não escreve o código/grupo do bem** ("01/xx"): a nomenclatura muda
entre versões do programa. Quem escolhe é quem preenche a declaração.

## 3. Data de emissão × data de pagamento

| Campo | Governa | Nunca governa |
|---|---|---|
| **`data_pagamento`** | O **ano-calendário do custo** (regime de caixa, art. 17); "dispêndios pagos no ano"; situação em 31/12; ano da ficha Pagamentos Efetuados | A identificação do documento |
| **`data_emissao`** | A **identificação** do documento; a **janela sem CNO**; a **competência** do serviço para a aferição | **O ano do custo — nunca** |
| **`vencimento`** (boleto) | O lembrete da US-002 | Qualquer coisa fiscal |
| **`data_compra`** (cartão) | Só provar que a fatura paga contém a compra (Q4) | O ano do custo — sai da fatura paga |

- **[Certain]** A discriminação cita a nota, mas quem determina o ano é o
  pagamento. *"NF emitida em 12/12/2026, paga R$ 45.000 em 2027"* é correto e
  comum. **Nenhum relatório anual é filtrado ou ordenado por `data_emissao`.**
- **[Certain, e é a armadilha] Não validar `data_pagamento >= data_emissao`.**
  Parece higiene e **quebra o caso mais frequente do projeto**: PIX mensal à AJE
  e NF consolidada meses depois (Relato 002, D6).
- **[Certain]** Nenhuma das duas datas se deriva da outra. Proibido
  `data_emissao` assumir `data_pagamento`, `created_at` ou "hoje" como default.
- **[Likely, confiança alta]** As duas apurações usam regimes diferentes: IRPF é
  **caixa**; a aferição do INSS é por **competência**. É por isso que
  `data_emissao` não é decorativa — é a única data que serve à segunda apuração.

## 4. Registros já feitos sem os campos

**Recusa de premissa**: não afirmo quantos registros existem — não tenho como
verificar, e este projeto já pagou por revisor que herdou suposição sobre o
estado do banco (Gate 2 do CONTAI-003). **O Gate 1 começa contando as linhas de
`documento` no banco remoto**, e o número apurado entra no ticket como fato.

**Backfill: proibido, sem exceção.** [Certain] Nada de `''`, `'S/N'`, `'0'`,
`data_emissao = created_at` ou `= data_pagamento`.

**Pendência: sim, com consequência calibrada.** A tentação é escrever "custo em
risco". **Seria falso.** [Certain] O que sustenta o custo é o documento hábil no
acervo, e ele continua lá. A consequência real é só:

1. A discriminação sai **sem identificar aquela nota** no Bloco B;
2. A nota **não aparece na lista de cobrança do CNO** — a única perda ainda
   recuperável, enquanto houver parcela a liberar;
3. O índice do pacote exportado sai incompleto (CONTAI-011, R10).

**Gravidade: âmbar, nunca vermelha. Não bloqueia nada. E não entra no headline
do CONTAI-005.**

### Texto de tela da pendência

> **Falta o número ou a data da nota**
> [fornecedor] · R$ [valor]
> O custo **não** está em risco: o documento está no acervo e continua valendo.
> Sem o número e a data, a discriminação do ano sai sem identificar esta nota, e
> ela fica de fora da lista de cobrança do CNO.
> [Abrir o anexo e completar]

**É a única pendência do produto que o Mateus resolve sozinho, sem falar com
ninguém** — o dado está no arquivo que ele mesmo subiu.

## 5. Automático × humano (CONTAI-004)

**Sistema sozinho** [Certain]: exigir os campos conforme a regra; recusar data
futura; preservar número como texto; montar Blocos A e B; alocar pagamento no
ano da sua data; separar material de mão de obra; montar a lista de cobrança por
`data_emissao`; sinalizar duplicidade (emitente + série + número).

**Leitura humana do Mateus**: ler o número no papel; declarar "recibo sem
número"; conferir a série.

**Exige CRC** [Certain]: o texto que vai à declaração; se a enumeração do Bloco
B cabe naquele ano; limite de caracteres e código do bem; qualquer retificadora.
**O contai redige e organiza; não assina.**

**Marcar para revisão humana**: recibo de PF com `data_emissao` em
ano-calendário **diferente** do pagamento.

## Ressalvas — CONTAI-004

### Bloqueantes

- **R1 — Proibida a validação `data_pagamento >= data_emissao`.** Quebra o caso
  central do Relato 002. **Exigir teste que falhe se alguém a introduzir** —
  comentário não protege nada.
- **R2 — `numero` é texto preservado literalmente.** Proibida conversão
  numérica, remoção de zeros à esquerda ou normalização.
- **R3 — Proibido backfill e proibido default.** Ausente é `null` + pendência
  âmbar. O Gate 1 abre contando as linhas do banco remoto.
- **R4 — `data_emissao` futura é recusada**, com mensagem própria.
- **R5 — Obrigatoriedade conforme o item 1**, inclusive em quarentena, e **não
  obrigatório em boleto**.

### Não bloqueantes

- **R6 — Capturar `serie` em campo próprio** e, quando disponível, o
  identificador de autenticidade: **chave de acesso de 44 dígitos** (NF-e)
  [Certain] ou **código de verificação** (NFS-e municipal). É o que permite a
  terceiro validar a nota daqui a sete anos.
- **R7 — Aviso de possível duplicidade** (emitente + série + número). É a
  **primeira ferramenta do produto contra custo contado duas vezes** — e custo
  inflado em Bens e Direitos vai para a declaração. Aviso, nunca bloqueio.
- **R8 — A regra do recibo de PF fica escrita**, mesmo sem o tipo existir.
- **R9 — A categoria "documento da obra sem favorecido e sem pagamento"**
  (alvará, ART, matrícula, habite-se) **nasce com número e data obrigatórios**:
  alvará e ART têm número, e é por ele que se referenciam.

**Veredicto: APROVADO COM RESSALVAS.** Segue ao Gate 1 depois de R1–R5 nos
critérios. **A prioridade está correta**: os campos são captura irreversível no
ato do registro.

---

# PARTE 2 — CONTAI-005

## 1. Que pendências podem ser somadas

**Podem: quarentena + pago sem nota. Não podem: boleto, INSS, e a pendência de
campo faltante do CONTAI-004.**

**Fundamento** [Certain]: quarentena e "pago sem nota" são a **mesma moeda** —
reais de dispêndio desta obra que hoje **não compõem o custo de aquisição por
falta de documentação hábil em nome e CPF do declarante** (art. 17). Muda o
motivo da falta, não a natureza nem a unidade nem a consequência.

O princípio do "índice que induz a soma errada" (CONTAI-011, F2) **vale aqui
integralmente** — e **condena boleto e INSS, absolvendo quarentena + pago sem
nota**. O teste: *o leitor que somar as parcelas chega a um número que existe em
alguma apuração?* Para os dois primeiros, sim. Para os outros, não.

### Regra de composição

1. **A unidade de conta é o dispêndio, não o registro.** Um mesmo dispêndio
   conta **uma vez**.
2. **Entram**: (a) todo `pagamento` com status `aguardando_nf`, pelo valor do
   pagamento; (b) todo `documento` em `quarentena`, pelo valor do documento,
   **menos** o valor dos pagamentos vinculados já contados em (a).
3. **Não entram**: boleto (qualquer status); NF de serviço sem retenção;
   documento sem número/data; pagamento conciliado a documento hábil.
4. **Nada soma entre obras.** [Certain] Bens e Direitos é um item por matrícula
   (Q9b).

Com os dados de hoje a fórmula dá **R$ 49.850** (45.000 + 4.850) — a subtração
de (b) opera sobre conjunto vazio, porque nada cria `pagamento_documento` antes
da US-003. **A subtração existe para o número não passar a mentir quando a
conciliação nascer**: mesma classe de defeito latente do CONTAI-008 (D19).

**Sobre o rótulo "em risco", e ele está certo** [Certain]: não é "custo
perdido". A nota reemitida ou o recibo assinado recuperam o custo integralmente,
e documento atrasado ainda sustenta pagamento de ano anterior (Q6). **O que
transforma risco em perda não é a virada do ano** — é o fim da alavanca (última
parcela paga) e o fim da janela municipal de cancelamento/reemissão.

## 2. Por que o INSS não entra na mesma soma

Três motivos independentes; o terceiro sozinho basta.

1. **Apurações diferentes, bases diferentes.** [Certain] Custo se apura por
   dispêndio pago e comprovado (art. 17); a aferição se apura pela **obra**
   (área/CUB), e o que a reduz é remuneração de mão de obra vinculada **àquele
   CNO** (Lei 8.212/91 art. 31). Não há operação aritmética definida entre as
   duas. **As duas apurações nunca se somam, em direção nenhuma.**
2. **A unidade está errada.** R$ 18.000 de NF de serviço sem retenção **não são
   R$ 18.000 de nada**: são base que deixa de ser reduzida. O custo eventual é a
   contribuição sobre a parcela de mão de obra contida na nota.
3. **A nota, se está no CPF do Mateus e foi paga, entra 100% no custo de
   aquisição.** [Certain] Ela é custo **confirmado**. Pô-la numa linha chamada
   "Custo em risco no IR" **afirma o oposto exato da verdade fiscal daquele
   documento** — inversão de sinal, não imprecisão.

**Quarto motivo, prudencial** [Likely]: a exposição INSS pode estar **inflada na
origem** — a pergunta nº 1 ao CRC segue aberta (o art. 31 dirige a retenção à
"empresa"; é discutível que o tomador **pessoa física** esteja obrigado).
**Não mudar isso agora**, mas é razão adicional para o número ficar em **base**,
isolado e rotulado como "a confirmar".

## 3. Boleto entra ou fica fora?

**Fica fora**, e o fundamento é mais forte que "evitar double-count".

- **[Certain] Boleto não é documentação hábil** (Gate 2 do CONTAI-001, R1). Um
  boleto pendente **ainda não é custo**: no regime de caixa, sem desembolso não
  há dispêndio. Não há o que perder.
- **[Certain] O risco real do boleto é de outra moeda**: juros e multa de mora,
  que **não integram o custo de aquisição** (dor D2). É dinheiro que sai e nunca
  vira custo — o oposto de custo que existe e não se comprova.
- **[Certain] O double-count é real**: boleto registrado + o pagamento desse
  mesmo boleto como avulso conta duas vezes o mesmo desembolso.

**Regra limpa**: o headline conta **desembolsos e documentos**, nunca **títulos
de cobrança**. Boleto pago cuja NF não chegou entra pela porta certa — pelo
`pagamento`.

## 4. Textos exatos para a tela

### Bloco 1 — headline

> **Custo em risco no IR** · [nome da obra]
> **R$ 49.850**
> Gastos desta obra que hoje **não entram no custo de aquisição** — falta
> documento hábil no seu CPF.
> Composto de: **R$ 45.000** pagos sem nota · **R$ 4.850** em nota fora do seu
> CPF.
> Pode custar **até R$ 7.478 a mais** de imposto na venda (15% sobre o valor em
> risco; o fator de redução por tempo de posse e as isenções podem diminuir).

**Condições obrigatórias da linha de imposto:**

- Fórmula: `impostoAdicionalMax = 0,15 × (valor do headline)`. [Certain quanto à
  base: Lei 8.981/1995 art. 21, redação da Lei 13.259/2016.]
- A palavra **"até"** é obrigatória, e a menção a reduções/isenções também
  (Lei 11.196/2005, **art. 40** = fator de redução; **art. 39** =
  reinvestimento). A citação errada foi corrigida em 2026-08-09 e não volta.
- **O denominador é exclusivamente o headline de IRPF.**
- **[Certain]** O "até" deixa de ser teto se o ganho total ultrapassar R$ 5 mi.

**Por que autorizo a linha de imposto tendo recusado número em 2026-08-08**: lá
era valor fixo apresentado como previsão; aqui é teto com fórmula visível e
disclaimer. E há motivo positivo: **"R$ 49.850 em risco", sozinho, é lido como
"perdi R$ 49.850"** — erra por quase sete vezes, na direção do pânico.

### Bloco 2 — exposição INSS, fora de qualquer soma

> **Aferição do INSS — CNO [nº]** · outra apuração, **não soma com a de cima**
> **R$ 18.000** em notas de serviço que **não abatem** a base da aferição desta
> obra.
> Isso não é imposto a pagar nem custo perdido: é base que deixa de ser
> reduzida. O valor em reais só existe quando a aferição for calculada.
> **Estas notas continuam valendo integralmente como custo de aquisição no
> IRPF.**

A última frase **não é opcional**: é ela que impede o leitor de somar 18.000 aos
49.850 com a própria cabeça. [Certain]

Obra **sem** CNO: esta linha cede lugar ao texto do parecer de 2026-08-09,
item 4 — que se copia de lá.

### Bloco 3 — boleto (card, sem soma)

> **Aguardando pagamento**
> Boleto sem nota vinculada — [fornecedor] · **R$ 25.000**
> Boleto não é documento hábil. O custo só se sustenta com a NF.
> **Não entra no total acima**: enquanto não for pago, não houve dispêndio.

(As duas primeiras linhas já existem em `lib/fiscal/documento.ts`,
`CONSEQUENCIA_BOLETO`, e não mudam. Só a última é nova.)

## 5. Double-count: fiscal ou display?

**No headline, é display. E isso não o torna inofensivo.**

- **É display** [Certain]: nenhuma declaração é alimentada pelo headline.
- **E custa caro** por dois canais: (a) faz agir errado — cobrar nota que já
  existe; (b) **contamina a confiança nos números certos**. Num produto cuja
  proposta é "o número aqui é confiável", número inflado é dano ao ativo
  principal.

**Onde vira fiscal** [Certain]: quando o **mesmo dispêndio é registrado duas
vezes como dispêndio** — mesma nota lançada duas vezes, ou dois pagamentos para
uma transferência única. Aí o acumulado em 31/12 sobe e **vai para a
declaração**: custo inflado é redução indevida de ganho de capital, cobrada com
multa. **A primeira defesa nasce no CONTAI-004** (R7) — mais um motivo para 004
vir antes de 005.

**Risco na direção oposta**: subtrair pagamentos vinculados de documento em
quarentena pode **subestimar** o risco se o vínculo estiver errado. Por isso a
dedup só opera sobre vínculo **explícito** (`pagamento_documento`), jamais sobre
heurística de "mesmo favorecido, mesmo valor". Heurística que subtrai em
silêncio some com o alerta e ninguém vê.

## Ressalvas — CONTAI-005

### Bloqueantes

- **R1 — Composição exatamente pela regra do item 1**, com a **dedup por vínculo
  explícito** escrita já agora, com teste, mesmo sem efeito hoje.
- **R2 — INSS em bloco próprio, em base**, com a frase *"estas notas continuam
  valendo integralmente como custo de aquisição no IRPF"*. Proibido valor de
  imposto do INSS em tela até a US-004 e até a resposta do CRC.
- **R3 — Linha de imposto só com "até", fórmula 15% e disclaimer**, aplicada
  exclusivamente sobre a base de IRPF.
- **R4 — O total nunca aparece sem a decomposição visível.**
- **R5 — A tela não pode exibir "Custo confirmado R$ 0,00" ao lado do headline
  sem dizer por quê.** Ou o zero ganha a ressalva ("a vinculação entre pagamento
  e nota chega na US-003"), ou os dois números não convivem. Como está, a home
  afirma que 100% do que foi gasto está em risco — e isso é falso.

### Não bloqueantes

- **R6** — O "até R$ X" perde a condição de teto acima de R$ 5 mi de ganho.
- **R7** — A pendência do CONTAI-004 é âmbar e fica **fora** do headline.
- **R8** — Aviso de possível duplicidade entre documento em quarentena e
  pagamento avulso de mesmo favorecido e valor **sem vínculo**: sugerir a
  conciliação, **nunca subtrair sozinho**.

**Veredicto: APROVADO COM RESSALVAS.** A recomendação do PO (headline =
quarentena + pago sem nota; INSS separado em base; boleto fora) está
**fiscalmente correta e fica carimbada**.

**Não carimbo os R$ 92.850** — somam quatro moedas, e uma delas (INSS) afirma o
inverso da verdade sobre as notas que a compõem. **Nem os R$ 47.850 do mock**,
aritmética anterior ao card "pago sem nota" e que ainda inclui boleto e INSS.
**O número correto no cenário do mock é R$ 49.850.**

---

## A confirmar antes de virar tela ou validação

Limite de caracteres do campo "Discriminação" [Likely — historicamente 512];
código e grupo do bem (**não cravado, e o sistema não deve gerar**); regime de
competência da aferição/SERO e a IN vigente [Likely — IN RFB 2.021/2021, pedido
de confirmação de 2026-08-08 segue pendente]; **pergunta nº 1 ao CRC**
(retenção do tomador PF, Lei 8.212/91 arts. 15 § único e 31); regras municipais
de cancelamento/reemissão de NFS-e em Florianópolis [Guessing]; padrão nacional
de NFS-e [Likely].

Nada neste parecer autoriza o sistema a assinar ou substituir declaração.
