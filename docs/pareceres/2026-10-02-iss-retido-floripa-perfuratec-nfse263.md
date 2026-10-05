# Parecer fiscal — NFS-e 263 (substitutiva da 261), ISS retido na fonte, PerfuraTec

- **Data**: 2026-10-02 · **Autor**: agente `contador`, execução read-only
- **Provocação**: a PerfuraTec cancelou a NFS-e 261 ("Situação Tributária:
  Normal", sem retenção) e reemitiu como **NFS-e 263** ("Situação Tributária
  do ISSQN: **Retenção**"), mesmo valor de serviço (R$59.901,00), mesma
  alíquota (3%), mesmo ISS (R$1.797,03) — mas agora com **Valor líquido =
  R$58.103,97** e "Natureza da Operação: Tributada Integralmente com Retenção
  na Fonte". Mateus já havia pago R$59.901,00 cheios via PIX em 2026-09, com
  base na nota 261.
- **Consome**: `docs/backlog/97-2026-09-29-parser-retencao-nao-reconhece-valor-bruto.md`
  (concluiu, sobre a nota 261, que "não há retenção" e que "tomador pessoa
  física não é, de regra, responsável por substituição de ISS" — conclusão
  que este parecer **revisita** à luz do fato novo) e a memória de projeto
  `contai-verificar-iss-floripa-perfuratec` (pendência aberta que este parecer
  avança, mas não fecha).
- **Normativo para**: a ação do Mateus fora do app (guia de ISS, acerto com a
  PerfuraTec) e, secundariamente, para o `cto-obra`/`lead-engineer` avaliarem
  se a "linha de retenção" genérica do CONTAI-038 comporta este fato.

> Convenção do projeto: `[Certain]` = prova documental direta; `[Likely]` =
> inferência forte a partir do documento; `[Guessing]` = preenchendo lacuna
> sem prova — tratado como tal, nunca como fato. Nada aqui substitui contador
> humano (CRC) nem a Prefeitura de Florianópolis como fonte final.

---

## 0. A resposta desconfortável primeiro

**O achado de 2026-09-29 ("o app está correto, não há retenção, PF não é
responsável por substituição de ISS") estava certo *para a nota que existia
na época* e está obsoleto agora.** [Certain] A PerfuraTec não emitiu uma nota
qualquer de novo — ela **cancelou** a 261 e **reclassificou** a mesma
operação de "Normal" para "Retenção". Isso não é ruído: é a própria prestadora
(que presumivelmente conhece as regras do município onde presta o serviço,
já que tem CNO e CEI abertos na obra) corrigindo uma classificação que ela
mesma havia feito errada da primeira vez. O fato novo não é "mais uma nota" —
é a revogação do fato que sustentava a conclusão anterior.

E a consequência prática que isso carrega — se a leitura abaixo se confirmar —
é desconfortável: **Mateus pode ter pago a mais à PerfuraTec e ainda estar
devendo uma guia à Prefeitura de Florianópolis, com prazo contado em dias, não
meses.**

---

## 1. A nota confirma que a obrigação de reter é do Mateus (tomador PF)?

**[Likely], não [Certain].** A nota é evidência documental forte, mas não é o
texto da lei municipal — e falta exatamente a peça que fecharia a certeza.

A favor da leitura "sim, é obrigação do tomador":

- "Retenção na fonte" é, por definição, retenção pela **fonte pagadora** —
  quem paga é o Mateus, não existe terceiro candidato na relação. Se a nota
  diz que há retenção na fonte, o agente que retém só pode ser ele.
  [Certain, por definição do termo]
- A reclassificação completa — "Normal" → "Retenção", valor líquido reduzido
  exatamente pelo valor do ISS, "Natureza da Operação: Tributada Integralmente
  com Retenção na Fonte" — foi feita pela **própria PerfuraTec**, não por
  pedido do Mateus. Isso é mais forte do que uma nota isolada: sugere que a
  contabilidade da prestadora identificou, depois da emissão original, que
  esta operação específica (serviço do item 7.02, executado em município
  diferente do estabelecimento do prestador, obra com CNO) se sujeita a
  retenção — **independente de quem é o tomador**, porque a causa típica desse
  tipo de regra municipal não é "tomador é PJ ou PF", é "o ISS é devido aqui e
  o prestador não está aqui para eu cobrar dele depois". [Likely]
- "Serviços **tomados**: até o dia 10 do mês seguinte ao de retenção" — o
  termo "tomados" (em oposição a "prestados", que tem vencimento no fim do mês
  seguinte ao de referência) só faz sentido semântico se for a regra de
  vencimento para quando é o **tomador** quem recolhe. [Likely]

Contra a certeza total — o que falta:

- **Não tenho o texto da LC 21/2005 / Decreto 13.215/2020** citados na nota, e
  não sei com certeza se são normas de **Florianópolis** (município de
  incidência, o que faria sentido já que a nota diz "O ISS é devido fora deste
  município") ou de **São José** (município emissor, o que seria estranho
  citar como base de vencimento de um ISS que ela própria diz não ser devido
  a ela). A leitura mais provável é Florianópolis, mas isto é **[Likely], não
  Certain** — plataformas de NFS-e no padrão ABRASF às vezes importam a regra
  do município de incidência para exibição, e às vezes só reproduzem a norma
  do emissor. **Não dá para distinguir sem abrir o texto da LC 21/2005.**
- Mesmo confirmando que é de Florianópolis, falta confirmar que o dispositivo
  **inclui tomador pessoa física** e não só pessoa jurídica. É juridicamente
  possível (art. 128 do CTN permite lei atribuir responsabilidade a terceiro
  vinculado ao fato gerador, e several municípios fazem isso justamente para
  "importar" ISS de prestador de fora, sem distinguir CPF/CNPJ do tomador) —
  mas "possível e plausível" não é "confirmado". [Likely, não Certain]
- Existe uma hipótese residual, menos provável mas não descartável: a
  classificação "Retenção" ter sido aplicada pelo **software/sistema municipal
  de emissão** por regra automática do código de serviço + município de
  incidência, sem o sistema diferenciar tomador PF de PJ — ou seja, a nota
  estaria tecnicamente **errada por excesso**, não por omissão. Acho isso
  **menos provável** porque foi uma correção deliberada (cancelamento +
  reemissão), não um default de sistema, mas não posso excluir. [Guessing
  quanto a essa hipótese alternativa]

**Veredito**: a nota desloca fortemente a probabilidade para "sim, Mateus é o
responsável pela retenção e pelo recolhimento do ISS a Florianópolis", mas
isso não é documentalmente **provado** até alguém ler o texto da LC 21/2005 ou
confirmar diretamente com a Prefeitura de Florianópolis (ISS Floripa /
plantão fiscal) ou com um contador humano que já lide com retenção de ISS
nesse município. Dado o valor e o prazo envolvidos, **recomendo não agir só
com base na inferência — confirmar antes de gerar a guia**, mas tratar a
confirmação como urgente (dias, não semanas) por causa do item 3.

---

## 2. Dinheiro: houve pagamento a mais à PerfuraTec?

**[Likely], sim — no sentido relevante para o Mateus.**

Ele pagou R$59.901,00 cheios via PIX, com base na nota 261 (sem retenção). A
nota 263 (que **substitui** a 261 — a 261 está cancelada, não é mais o
documento válido da operação) diz que o valor que a PerfuraTec tinha direito
a receber líquido é R$58.103,97; os R$1.797,03 restantes são ISS que — se a
leitura do item 1 estiver certa — deveriam ter sido retidos pelo Mateus e
recolhidos **diretamente a Florianópolis**, nunca repassados à PerfuraTec.

Não existe um cenário em que isso "não seja overpayment" só porque o contrato
previa pagamento do valor cheio. [Certain quanto a este ponto específico]
Retenção na fonte de ISG não é uma cláusula contratual entre as partes — é uma
obrigação tributária do tomador perante o município. Mesmo que Mateus e a
PerfuraTec tivessem combinado informalmente "eu pago o valor cheio e você
recolhe seu próprio ISS", isso não desobriga o Mateus de reter quando a lei
(se confirmada) atribui a ele essa responsabilidade — ele não pode transferir
contratualmente uma obrigação tributária de responsável tributário para o
prestador. Se ele simplesmente "assumir que já recolheu, embutido no
pagamento cheio", isso **não é tecnicamente correto perante o município**: o
recolhimento tem que ser feito por guia própria (DAM/guia de ISS retido em
nome do responsável tributário), não por repasse informal ao prestador. É
exatamente o padrão "pagar duas vezes" que o projeto já nomeia para INSS —
aqui, o risco análogo é: pagar a PerfuraTec (feito) + ter que pagar a guia a
Florianópolis (se a leitura do item 1 estiver certa) sem conseguir reaver o
que pagou a mais à PerfuraTec.

**O que fazer com o excedente**: pedir à PerfuraTec a devolução (ou abatimento
em pagamento futuro, se houver) dos R$1.797,03 pagos a mais, por escrito,
citando a nota 263 como base. Isso é uma cobrança civil entre as partes, não
depende de confirmar a legislação de Florianópolis primeiro — a nota 263, por
si só, já declara que o valor líquido devido à PerfuraTec é R$58.103,97; é a
própria PerfuraTec, por emitir a nota assim, que está reconhecendo que não
tem direito aos R$1.797,03 retidos. [Likely — a cobrança do excedente é
razoável e documentalmente sustentada mesmo antes de resolver a dúvida do
item 1; o que depende da confirmação do item 1 é se **além disso** o Mateus
precisa gerar e pagar uma guia a Florianópolis]

---

## 3. Prazo

**[Likely], com uma ambiguidade real que preciso marcar, não esconder.**

A nota diz: "Serviços tomados: até o dia 10 do mês seguinte ao de
**retenção/substituição**." Duas leituras possíveis para "mês de
retenção/substituição":

- **Leitura A — mês da substituição da nota (emissão da 263)**: 01/10/2026 →
  mês de referência = outubro/2026 → prazo = **10/11/2026**. É a leitura mais
  natural do termo "substituição" (a nota 263 É o ato de substituição), e é a
  que eu adotaria como ponto de partida.
- **Leitura B — mês em que o pagamento efetivamente ocorreu** (setembro/2026,
  quando o Mateus pagou via PIX, momento em que a retenção *deveria* ter sido
  praticada, mas não foi). Se o mês relevante for o do fato gerador da
  obrigação de reter (pagamento), e não o da correção documental, o prazo já
  teria vencido — hoje é 02/10/2026, e "10 do mês seguinte a setembro" seria
  10/10/2026 (ainda não venceu, mas venceria em 8 dias) ou, numa leitura ainda
  mais rígida, já teria passado dependendo de como "mês de retenção" é
  definido pela norma.

Não tenho o texto da LC 21/2005 para decidir entre A e B com certeza. [Likely
para a leitura A ser a pretendida pelo sistema que emitiu a nota — é a leitura
que o próprio documento sugere ao te dizer que o fato relevante é a
"substituição", que só aconteceu em 01/10] — mas **não é Certain**, e a
diferença entre as duas leituras é a diferença entre "ainda dá tempo com
folga" e "o relógio já está correndo ou já correu". Isso é precisamente o
tipo de lacuna que não deve ser preenchida com palpite quando envolve prazo e
dinheiro.

**Recomendação**: tratar 10/11/2026 como a data-limite de trabalho, mas
**confirmar nos próximos dias** (não esperar até outubro acabar) com a
Prefeitura de Florianópolis ou um contador humano qual é de fato o termo
inicial da contagem. Se a leitura B prevalecer, o Mateus quer saber isso
agora, não no dia 9.

---

## 4. Ação concreta — o que é fato vs. o que precisa de confirmação externa

**Fato, já provado pela nota 263 (não precisa de mais ninguém confirmar):**

1. A PerfuraTec reclassificou a operação de "Normal" para "Retenção". O valor
   líquido que ela reconhece ter direito a receber é R$58.103,97.
2. O Mateus pagou R$59.901,00 — R$1.797,03 a mais do que a PerfuraTec, pela
   própria nota dela, tinha direito a receber líquido.
3. Não há retenção federal nenhuma envolvida (PIS/COFINS/INSS/IR/CSLL = 0,00)
   — o assunto é exclusivamente ISS municipal.

**Precisa de confirmação externa antes de qualquer pagamento de guia:**

4. Confirmar, com a Prefeitura de Florianópolis (ISS Floripa / plantão fiscal
   de tributos mobiliários) e/ou um contador humano (CRC) que já opere com
   retenção de ISS em Florianópolis: (a) que a legislação municipal de fato
   atribui a responsabilidade de retenção ao tomador pessoa física neste
   caso, (b) qual é exatamente o prazo e o mecanismo de geração da guia
   (nome do tributo no sistema da prefeitura, se existe DAM específico para
   "ISS retido por responsável tributário pessoa física"), e (c) a leitura
   correta do termo inicial do prazo (item 3, leitura A vs. B).

**Ordem recomendada de ação, a partir de hoje (02/10/2026):**

1. **Esta semana**: contatar a Prefeitura de Florianópolis ou um contador
   humano para confirmar os pontos 4(a)-(c). É urgente por causa do prazo,
   não porque a resposta provavelmente mude — a resposta provável é "sim,
   você deve reter", mas o prazo não pode ficar sem confirmação.
2. **Em paralelo, sem depender do passo 1**: notificar a PerfuraTec por
   escrito (e-mail/WhatsApp com confirmação de leitura, ou o que já for canal
   formal com eles) pedindo a devolução dos R$1.797,03 pagos a mais, citando
   a nota 263 como prova de que o valor líquido devido era R$58.103,97.
   Guardar essa comunicação.
3. **Depois da confirmação do passo 1**: gerar e pagar a guia/DAM de ISS
   retido à Prefeitura de Florianópolis, valor R$1.797,03, dentro do prazo
   confirmado (10/11/2026, sujeito a correção).
4. **Guardar no acervo**: nota 261 (cancelada), nota 263 (vigente), comprovante
   do PIX original (R$59.901,00), comunicação de cobrança à PerfuraTec,
   eventual comprovante de devolução da PerfuraTec, e o comprovante de
   pagamento da guia do ISS quando feito. Os dois primeiros já deveriam estar
   no app via fluxo de correção de documento (CONTAI-021); os demais são
   documentos novos, sem lar natural ainda no modelo de dados (ver §5).

---

## 5. Documentação hábil / registro no app

**Correção de documento (CONTAI-021)**: a substituição 261→263 é exatamente o
caso que esse fluxo já cobre — anexar a nota substitutiva, e como o `valor`
do serviço não mudou (R$59.901,00 em ambas), o campo a corrigir não é o valor
do serviço, é a estrutura de retenção/situação tributária, que é o ponto do
parágrafo seguinte.

**A "linha de retenção" do CONTAI-038 é o conceito certo — se ela foi
desenhada de forma genérica.** O CLAUDE.md define a linha de retenção como
algo que "alimenta a pendência de 'quem recolhe', nunca cálculo de aferição" —
e essa é exatamente a função que esta retenção de ISS precisa: não entra em
nenhum cálculo de aferição INSS/SERO (é outro tributo, outro credor, outro
propósito), mas precisa aparecer como uma pendência de "quem recolhe e até
quando". Se a implementação atual do CONTAI-038 já captura, por linha: tipo
de tributo (categoria — e pelos backlogs que revisei, ISS já é uma das
categorias que `sugerirTributoDoRotulo` reconhece), valor retido, e deixa
"quem recolhe" como campo manual — então **o mesmo conceito, sem campo novo,
comporta este caso**: é uma linha de retenção com tributo = ISS, valor =
R$1.797,03, "quem recolhe" = o próprio Mateus (tomador), e um texto de
pendência equivalente ao que já existe para a dívida D57 do INSS, mas para
ISS municipal.

**O que pode faltar, e isso é pergunta para `cto-obra`/`lead-engineer`, não
algo que eu decido aqui**: se o campo "quem recolhe" hoje só tem as opções
que fazem sentido no contexto original (prestador PJ recolhe para si mesmo,
ou é dívida D57 por falta de informação) — ele precisa comportar também a
opção "o próprio tomador recolhe por guia direta ao município", que é
estruturalmente diferente de D57 (D57 é "não sabemos quem recolhe, falta
dado"; aqui **sabemos** quem recolhe — é o Mateus — e falta é ele *agir*, não
falta dado). Tratar os dois como a mesma pendência genérica ("falta
recolhimento") pode ser suficiente; tratar como exatamente a mesma coisa que
D57 (que é sobre incerteza de dado, não sobre ação pendente de quem já sabe o
que fazer) seria perder a distinção. Decisão de modelagem, não de regra
fiscal — devolvo ao `cto-obra`.

**O que não existe ainda e pode precisar de campo novo**: o comprovante de
pagamento da guia de ISS retido (quando o Mateus pagar) é um documento
diferente da nota fiscal — é um comprovante de recolhimento de tributo, sem
"destinatário" no sentido de nota (não tem CPF de destinatário, é uma guia
municipal). Se o app não tem hoje um tipo de documento para "comprovante de
recolhimento de tributo pelo próprio Mateus", isso é uma lacuna a notar — mas
de novo, decisão de modelagem do `cto-obra`, não minha.

**Efeito no custo de aquisição (IRPF, regime de caixa)** — ponto que não
estava nas suas seis perguntas, mas é relevante e devo levantar: [Likely] o
custo de aquisição atribuível a este serviço de fundação permanece
R$59.901,00 no ano de 2026 **desde que o Mateus consiga reaver os R$1.797,03
pagos a mais à PerfuraTec** — nesse caso, o total pago na operação (PerfuraTec
R$58.103,97 + guia a Florianópolis R$1.797,03) segue batendo com o valor do
serviço, discriminável normalmente. **Se ele não conseguir reaver** o
excedente da PerfuraTec e ainda tiver que pagar a guia, o desembolso real
sobe para R$61.698,03, e **não tenho certeza** [Guessing] se a Receita aceita
o excedente não recuperado (R$1.797,03 pagos por erro/duplicidade) como parte
do custo de aquisição do imóvel, ou se isso é tratado como perda financeira
do Mateus, fora da ficha de Bens e Direitos. Recomendo resolver a cobrança à
PerfuraTec antes da declaração para não ter que decidir essa questão.

---

## 6. A pendência de memória pode ser fechada?

**Não. Avançada, não resolvida.** [Certain quanto ao estado — não é uma
chamada de confiança, é factual: ainda faltam as confirmações do §4-ponto-4]

A nota 263 muda o quadro de "provavelmente não há obrigação" (conclusão de
2026-09-29, sobre a nota 261) para "provavelmente há obrigação do tomador, e a
própria prestadora concorda" — mas continua faltando:

- confirmação externa de que a legislação de Florianópolis realmente
  responsabiliza tomador PF (não só inferência da nota);
- confirmação do prazo exato (item 3);
- resolução do excedente pago à PerfuraTec;
- pagamento efetivo da guia, se confirmada a obrigação.

Recomendo **atualizar** a memória (não apagar) para refletir o novo estado —
nota 263 emitida, leitura provável, ações pendentes — e só marcar como
resolvida depois que o passo 1 do §4 (confirmação com a Prefeitura/contador
humano) e o pagamento da guia (se confirmado) estiverem feitos.
