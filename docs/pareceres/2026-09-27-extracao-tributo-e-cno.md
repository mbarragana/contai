# Parecer fiscal — extração automática de dois campos novos: `tributo` (classificação) e `cnoNaNota` (identificação/escopo da obra)

- **Provocação**: Gate Fiscal pontual, ainda sem ticket. O Mateus testou o
  fluxo de extração numa nota real (Palhoça/SC, a mesma do CONTAI-068) e, como
  o parser leu corretamente o rótulo "Valor ISS"/"ISSRF" para sugerir a linha
  de retenção, perguntou por que o campo `tributo` (e o botão "Tributo único")
  não são preenchidos junto. Separadamente, propôs detectar automaticamente o
  CNO impresso na nota e comparar com o CNO da obra para preencher o gate
  `cnoNaNota` (CONTAI-007).
- **Por que um parecer só para as duas**: ambas nasceram no mesmo instinto —
  "o parser já lê o texto, por que não usar para poupar mais um clique?" — e a
  resposta é diferente em cada uma, mas pelo mesmo método: não é "fato vs.
  intenção" sozinho (critério do ADENDO 5 de
  `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`), é fato **e**
  o que acontece depois que o Mateus aceita a sugestão sem reler o papel.

---

## Pergunta 1 — sugerir `tributo` a partir do rótulo do texto

### Resposta desconfortável primeiro

**Reprovado, e isto não é uma leitura nova — é um critério que já existe, por
escrito, com o nome do próprio risco que o Mateus descreveu hoje.**
`docs/tickets/CONTAI-038.md`, critério 14:

> O pipeline de extração automática (`lib/extracao/`) nunca preenche
> `composicao`, o tributo específico, `e_desconto_efetivo` nem `quem_recolhe`
> sozinho — os quatro chegam sempre em branco para confirmação humana,
> **mesmo quando o texto da nota permitir uma inferência plausível**.

E o pre-mortem 2 do mesmo ticket, escrito em 2026-09-20, nomeia por
antecipação exatamente o caso de hoje:

> A Fase 2 (extração automática) reintroduz a inferência que este ticket
> proíbe: sem trava explícita (critério 14), é natural o pipeline "adivinhar"
> `composicao`/tributo a partir do texto para poupar clique — violando "o app
> nunca rotula a linha antes do Mateus escolher".

Isso já está testado em código: `lib/fiscal/retencao.test.ts:151`,
`"'tributo identificado' exige QUAL tributo — nunca inferido do rótulo"`.
A nota de Palhoça não traz um fato novo que reabra essa análise — é o próprio
caso que o critério 14 previu.

### 1. Por que a distinção do ADENDO 5 não se aplica aqui — fato vs. classificação

[Certain] O ADENDO 5 aprovou sugerir `retencaoNaNota` porque a pergunta é
"existe, no papel, um trio total/retenção/líquido cuja aritmética fecha?" —
teste fechado, universal, sem depender de vocabulário de prefeitura ou de
taxonomia legal. `tributo` é outra pergunta: **mapear um rótulo em língua
natural, que varia por emissor e por município, para uma de 6 categorias
fixas do enum `tributo_retido`** (`iss | inss | irrf | pis | cofins | csll`,
`lib/database.types.ts:1212`). Isso não é "ler um fato impresso" — é
interpretar texto livre contra uma taxonomia jurídica. É exatamente a mesma
distinção que o ADENDO 5 §1 usou para manter `quem_recolhe` fora de qualquer
sugestão: não é o mesmo tipo de leitura que uma data ou um CNPJ.

### 2. A "clareza aparente" do rótulo não generaliza — o próprio corpus do projeto já mostra rótulo combinado

[Certain] O comentário do próprio `lib/extracao/retencao-texto.ts` (Critério
4) explica por que o parser não hardcoda rótulo nenhum: *"vocabulário de
retenção varia por prefeitura e por sistema emissor; whitelist envelheceria na
terceira nota"*. A segunda nota real medida neste mesmo projeto (2026-09-25,
citada nos ADENDO 6/7 do parecer de 2026-09-18) já mostrou o contra-exemplo:
uma linha rotulada **"Total das Retenções (ISSQN / Federais)"** — um valor
único cobrindo mais de um tributo, sem abertura. Se o sistema tivesse
aprendido "rótulo contém 'ISS' → `tributo = iss`" a partir da nota de Palhoça,
essa mesma regra teria classificado errado a nota seguinte: parte do valor
"Federais" (que pode incluir INSS) ficaria rotulada como puramente municipal.
Uma inferência que parece segura na primeira nota e erra na segunda é
precisamente o padrão que a doutrina do módulo já existe para evitar — só que
aplicado, aqui, a uma classificação legal, não a um valor.

### 3. A consequência de errar não é "abrir uma seção a mais" — é potencialmente calar uma pendência de recolhimento sem deixar rastro

[Likely] `tributo` não entra em fórmula nenhuma da aferição — conferido em
`lib/fiscal/afericao.ts`: a função não lê `rotulo_literal`, `valor`,
`composicao`, `e_desconto_efetivo` nem `quem_recolhe` de linha nenhuma
(comentário explícito nas linhas 148-152, herdado do critério 13 do
CONTAI-038). O papel real de `tributo` é **rotear qual pendência de
recolhimento se aplica** — uma retenção classificada como ISS é, por
natureza, irrelevante para a aferição do CNO (é imposto municipal); uma
classificada como INSS aponta para a pendência de "quem recolhe" que o
ADENDO 3/4 do parecer de 2026-09-18 desenharam. Errar essa classificação por
inferência de rótulo tem, então, um risco assimétrico: classificar como ISS
algo que era "combinado" (e continha uma fatia potencialmente relevante à
aferição) **apaga silenciosamente** o motivo para o Mateus prestar atenção
naquela linha — sem pendência, sem alerta, sem diferença visual de uma linha
corretamente classificada. Isso é categoricamente mais grave que o pior caso
do gate binário do ADENDO 5 (*"abrir uma seção a mais para revisar e
descartar"*), que não tem efeito nenhum até `e_desconto_efetivo`/`quem_recolhe`
também serem preenchidos manualmente.

### 4. Se aprovasse, eu estaria revertendo, sem fato novo, uma cadeia já fechada

[Certain] §3/A.1/A.3 do parecer de 2026-09-18, o §4 do ADENDO 5 do mesmo
parecer, o critério 14 + pre-mortem 2 do CONTAI-038 e o teste em
`retencao.test.ts:151` já decidiram isto, na mesma direção, em momentos
diferentes, por autores diferentes (o parecer do contador e o ticket do
cto-obra). O relato de hoje não traz um fato que altere essa análise — traz o
caso que o pre-mortem 2 já havia nomeado por antecipação. Reverter uma
proibição testada em código, com base numa nota que "parece clara", é o
próprio erro que "empate real vira `null`, nunca melhor palpite" existe para
evitar — só que aplicado a uma decisão de produto em vez de a uma linha de
extração.

### O que pode, sem tocar na proibição — alternativa de UX

[Guessing quanto a valer o esforço — decisão de produto, não fiscal] O parser
já sabe o rótulo bruto que motivou a sugestão da linha (`rotuloLiteral`).
Nada impede **exibi-lo de novo, como texto, ao lado do dropdown de
`tributo`** — por exemplo: *"a nota traz: 'Valor ISS' — confirme o tributo"`.
Isso não seta valor nenhum no campo, não é sugestão, é o mesmo texto que já
aparece hoje para a linha, reaproveitado como lembrete visual. Reduz o
esforço de reler o PDF sem tocar na classificação, que continua 100% escolha
do Mateus. Se vale a pena implementar é decisão do `designer`/`cto-obra`.

### Automático × exige contador humano (CRC)

**O sistema pode sozinho**: extrair e exibir o rótulo bruto já lido para a
linha, como lembrete ao lado do campo `tributo` — nunca preencher o campo.

**Exige revisão humana (do Mateus)**: escolher `tributo` sempre manualmente,
sem exceção — não muda com este parecer.

**Exige CRC**: o mesmo já registrado no corpo do parecer de 2026-09-18 e nos
seus adendos — confirmar com a contabilidade do prestador o que cada linha
combinada representa, quando o caso concreto exigir.

### O que este parecer NÃO muda

- Critério 14 do CONTAI-038 continua valendo, sem exceção — inclusive para
  rótulos que "parecem" inequívocos.
- `composicao`, `e_desconto_efetivo` e `quem_recolhe` continuam 100% manuais;
  esta pergunta não pediu para reabri-los e este parecer não reabre.
- `rotuloLiteral`/`valorCentavos` da linha continuam os dois únicos campos
  que a extração pode sugerir (ADENDO 5 §4, ADENDO 6, inalterados).

---

## Pergunta 2 — detectar automaticamente o CNO impresso na nota

### Resposta desconfortável primeiro

**Parcialmente reprovado.** A leitura em si (achar um número rotulado
"CNO"/"Matrícula CEI" e comparar com o CNO da obra) pode ser automática — mas
**marcar `cnoNaNota = "desta_obra"` sozinho, mesmo como sugestão a confirmar,
eu reprovo por ora**. E a diferença para o caso já aprovado da retenção não é
"fato contra intenção" — nisso os dois empatam. A diferença é **o que
acontece no sistema depois que o Mateus aperta Salvar**.

### 1. Mecanicamente é tão "fato" quanto a aritmética da retenção — mas o teste do ADENDO 5 tem duas pernas, e aqui só a primeira passa

[Certain] "Este número, rotulado CNO, impresso no papel, é idêntico ao CNO
cadastrado da obra" é uma comparação de duas strings já conhecidas — não
exige saber quem recolhe, nem interpretar taxonomia nenhuma. Pela primeira
perna do critério do ADENDO 5 (§1: fato objetivamente legível, não
intenção/classificação), isto se qualifica tão bem quanto a aritmética
total−retenção=líquido. Mas o ADENDO 5 nunca disse que "é fato" basta sozinho
— o §2 do mesmo adendo impôs uma segunda pergunta, o **raio de efeito de um
falso positivo**, e foi ela que ditou as quatro salvaguardas. Para
`retencaoNaNota` o raio de efeito era pequeno (abre uma seção revisável, sem
efeito na aferição por si só). Para `cnoNaNota` a segunda perna reprova.

### 2. O raio de efeito aqui não é "abrir uma seção" — é entrar direto na `baseCentavos` de um relatório que o CRC assina em cima

[Certain] `lib/fiscal/afericao.ts` é explícito sobre o que a resposta a este
gate faz: `motivoForaDaBase` só passa uma NF de serviço adiante quando
`notaTrazCno === true` e `cnoNormalizado(cnoReferenciado) === cnoDaObra`
(linhas 141-154); o que passa vira soma em `BaseDeAfericao.baseCentavos`
(linha 107) — um dos números da **posição da aferição INSS**, uma das três
saídas do produto (Meta 2). O próprio módulo já se declara, por escrito, um
proxy conhecidamente **superestimado** em relação ao que o fisco aceitaria
provado (dívida D57, comentário nas linhas 41-46): *"a base que sai daqui é
**maior** do que a que o fisco aceitaria provada"*. Uma segunda fonte de
inclusão indevida — um "desta_obra" aceito por engano — não é um risco
isolado; é **piorar uma imprecisão que o próprio sistema já admite ter**, no
relatório que existe para ajudar exatamente o CRC que vai assinar a
aferição de verdade.

### 3. Não existe rede de segurança para esse erro específico

[Certain] Compare os quatro casos de falso-positivo que já existem no
sistema:

| Campo | Falso positivo aceito | Efeito |
|---|---|---|
| `retencaoNaNota = "destacada"` | autoevidente ao abrir a seção; não move `baseCentavos` sozinho | revisável, sem custo silencioso |
| `cnoNaNota = "nao_traz"` | gera pendência (`nota_sem_cno`) — alguém revê depois | tem rastro |
| `cnoNaNota = "outra_obra"` | **bloqueia o salvamento** — nem grava linha, nem objeto no bucket (critério 6 do CONTAI-007) | erro caro de propósito, porque a direção era considerada grave |
| `cnoNaNota = "desta_obra"` (proposto) | soma limpo em `baseCentavos`, **sem pendência nenhuma que o distinga de uma resposta manual correta** | contamina o relatório em silêncio |

O próprio desenho do CONTAI-007 já tratou "incluir errado" como o lado mais
perigoso do erro — é por isso que só essa direção (`outra_obra`) bloqueia o
documento inteiro. Automatizar exatamente o lado oposto (facilitar
`desta_obra`) para ganhar um toque é remar contra a severidade que o próprio
ticket original já reconheceu para este campo. E como o acervo é
append-only (não há "excluir pagamento"/"excluir documento" — corrigir depois
passa pelo fluxo mais custoso de `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md`),
um "desta_obra" aceito sem reler o papel não é barato de desfazer.

### 4. O que aprovo: leitura e exibição, nunca preenchimento do campo

[Certain quanto às salvaguardas; a forma de implementar é do `cto-obra`]

1. O parser **pode** procurar, no texto, um par rótulo+número no mesmo padrão
   já usado para retenção (`extrairLinhasRotuladas`): rótulo contendo
   literalmente "CNO" ou "Matrícula CEI", número imediatamente associado. Sem
   rótulo inequívoco, ou mais de um candidato, o resultado é "nada encontrado"
   — nunca "melhor palpite", mesma doutrina de `null` que rege a linha de
   retenção.
2. Quando encontrar um candidato, **exibir os dois números lado a lado, na
   mesma formatação/agrupamento de dígitos**: o CNO cadastrado da obra e o
   número lido da nota. Isto é o que hoje o Mateus faz de cabeça — comparar
   dois números longos —, e é exatamente o tipo de tarefa em que exibição
   lado a lado bate leitura de memória em confiabilidade. Isso é ganho real,
   sem tocar na decisão.
3. **O campo `cnoNaNota` nasce vazio, como hoje.** Nenhuma das três respostas
   é pré-marcada. O Mateus continua escolhendo — mas agora com o número certo
   já na tela, sem precisar procurá-lo no PDF nem guardar o CNO da obra de
   cabeça.
4. `outra_obra` e `nao_traz` continuam impossíveis de sugerir — a pergunta já
   assumia isso, e concordo: o parser só teria, na melhor hipótese, "aqui está
   o número, compare" — nunca uma conclusão nas outras duas direções.

Isto entrega a maior parte do ganho de tempo pedido (não vasculhar o PDF,
não decorar o CNO da obra) sem entregar a decisão que alimenta `baseCentavos`
a uma correspondência de string sem trilha de auditoria.

### 5. Sob que condição eu reconsideraria uma automação mais forte

[Guessing — desenho de produto, não fiscal] Se um dia existir um **quinto
motivo** em `MotivoForaDaBase`/um novo estado de `cnoNaNota` — algo como
"CNO confirmado por leitura automática, sinalizado para nova conferência" —
que deixe rastro (a nota entra na base, mas marcada como originada de
correspondência de máquina, não de leitura humana), a conversa muda: nesse
desenho, um "desta_obra" errado ainda seria custoso, mas deixaria de ser
**indistinguível** de uma resposta manual correta, o que é o problema central
de hoje. Isso é desenho de estado novo — trabalho do `cto-obra`/`po`, fora do
escopo deste parecer, e não estou aprovando implementação nenhuma nesta
direção agora.

### Automático × exige contador humano (CRC)

**O sistema pode sozinho**: procurar rótulo+número de CNO no texto pelo
mesmo padrão de par rotulado já usado na retenção; exibir o candidato ao lado
do CNO cadastrado da obra, na mesma formatação, para conferência visual
rápida; nunca marcar nenhuma das três respostas do gate.

**Exige revisão humana (do Mateus)**: decidir `cnoNaNota` sempre manualmente,
sem exceção — isto não muda com este parecer.

**Exige CRC**: nada novo — a dívida D57 (a aferição real depende de
declaração ao eSocial/EFD-Reinf, fora do alcance do produto) continua exigindo
o CRC para fechar a aferição de verdade; este parecer não fecha essa dívida
nem a agrava.

### O que este parecer NÃO muda

- `outra_obra` e `nao_traz` continuam 100% manuais — a própria pergunta já
  não cogitava sugeri-los, e concordo que não devem ser.
- O bloqueio de `outra_obra` (critério 6 do CONTAI-007) continua intocado.
- A base de aferição continua sendo o proxy conhecido da dívida D57; este
  parecer não fecha essa dívida.

---

# ADENDO — 2026-09-27 · reexame da Pergunta 2: correspondência EXATA de dígitos não muda o veredito, mas corrige o argumento

O Mateus contestou a Pergunta 2 com um ângulo que a resposta original não
respondeu de frente: se a comparação for **rótulo inequívoco + igualdade
EXATA de dígitos** (nunca aproximação), por que não marcar `desta_obra`
sozinho? E comparou com `garantirFavorecido`, que hoje deduplica favorecido
por CPF/CNPJ cru, sem gate de confirmação humana. Fui conferir o código antes
de responder — não vale opinar sobre o precedente de memória.

### Resposta direta primeiro

**Mantenho a reprovação de marcar `cnoNaNota = "desta_obra"` automaticamente
— inclusive sob as três condições exatas propostas.** O que muda é a
justificativa: a frase que usei da primeira vez ("indistinguível de uma
resposta manual correta, sem pendência, sem rastro") estava fazendo dois
trabalhos numa frase só, e um deles não se sustenta como argumento **contra a
automação especificamente**. A parte que sustenta a reprovação é outra, e eu
devia tê-la nomeado desde a primeira resposta.

### 1. O que concedo integralmente

[Certain] Sob as três condições do Mateus, a leitura é tão "fato" quanto a
aritmética da retenção — isto já estava no §1 da Pergunta 2 original, não é
concessão nova. O que acrescento agora: a comparação por máquina de dois
números de 12+ dígitos é **provavelmente mais confiável** que a comparação
visual que hoje peço ao Mateus fazer de cabeça — e isso não é opinião solta,
é a própria doutrina do CONTAI-007. O pre-mortem 1 do ticket
(`lib/fiscal/documento.ts:51-54`) já desconfiava de humano com número longo:

> **ESCOLHA, NUNCA DIGITAÇÃO** — é o pre-mortem 1 do ticket, e ele é
> bloqueante: *"se o mock trouxer campo livre de 14 dígitos, devolvo"*. O CNO
> das obras cadastradas o app já tem; o que ele não tem é o que está no
> papel, e isso se responde com um toque.

O ticket já proibiu pedir para o Mateus *digitar* um CNO de cabeça. Aplicado
com a mesma consistência, ele também deveria desconfiar de pedir para o
Mateus *ler e comparar de cabeça* dois números de 12+ dígitos lado a lado —
que era exatamente o que minha recomendação original (§4) ainda pedia.

### 2. O que retiro: "indistinguível de resposta manual correta" não diferencia automação de decisão manual

[Certain] É verdade, e continua verdade, que uma resposta manual **certa**
hoje também não deixa rastro de auditoria distinto de uma resposta manual
**errada** — `RespostaCnoNota` grava só o enum, nunca como ou por que o
Mateus chegou lá. Isso não é peculiaridade da automação; é característica do
campo, do jeito que ele já está desenhado. Nessa parte específica, a
contestação do Mateus procede, e a frase como escrita na primeira resposta
sai do argumento.

### 3. O que sustenta a reprovação, dito com precisão desta vez: troca de "decidir" por "confirmar", no único dos três campos que o próprio ticket já tratou como o mais caro de errar

[Certain quanto ao mecanismo comportamental ser real e bem descrito fora
deste projeto; Likely quanto a ele se aplicar neste caso específico com a
mesma força] Substituir "olhar dois números e decidir" por "confirmar uma
decisão que o sistema já tomou" é uma mudança de tarefa cognitiva, não de
taxa de erro do string-match: humano tende a escrutinar menos uma resposta
pré-marcada do que a mesma resposta produzida do zero — mesmo quando a fonte
da pré-marcação é perfeitamente confiável. É o efeito (fora deste projeto
chamado de complacência de automação/vigilância degradada) que a frase
"indistinguível, sem rastro" estava tentando apontar e errou o alvo.

Isso pesa aqui porque `cnoNaNota` é o único dos três campos desta família em
que o próprio CONTAI-007 **já decidiu, por escrito, que o erro na direção
"incluir" não tem conserto** (`lib/fiscal/documento.ts:386-389`):

> Não é pendência, e a assimetria com o critério 3 é a regra inteira (Gate
> Fiscal, 2ª condição): *"a pendência é o remédio para o que ainda dá para
> corrigir; esta não dá"*. Depois de emitida, a nota com o CNO da outra obra
> não se conserta — o que se conserta é ONDE ela é registrada.

É por isso que `outra_obra` **bloqueia o registro inteiro** — a direção
oposta de erro, `desta_obra` aceito indevidamente, tem a mesma gravidade
implícita no desenho (some, sem atrito nenhum, em `baseCentavos` de um
relatório que já é um proxy conhecidamente superestimado, D57). Automatizar
justamente essa direção, no único campo em que o próprio ticket original já
reconheceu essa assimetria, retira a única camada de atenção humana
independente que hoje existe sobre o lado que o sistema trata como mais
perigoso de errar.

### 4. A comparação com `garantirFavorecido` — conferida no código; os fatos do Mateus estão certos, a analogia não se sustenta

[Certain, com base em leitura direta do código, não de memória] Os fatos
batem: `garantirFavorecido` (`lib/data.ts:1410-1442`) faz `upsert` com
`ignoreDuplicates: true` sobre a chave única `(user_id, documento)` — CPF/CNPJ
só dígitos (`soDigitos`) —, roda **dentro** do fluxo de salvar
(`app/(captura)/adicionar/documento/page.tsx:830`, `.../pagamento/page.tsx:329,451`,
`.../compra-cartao/page.tsx:242`), e associa ao favorecido existente de forma
**automática e silenciosa**, sem tela de confirmação. `e2e/ingestao.spec.ts:1088-1135`
confirma o comportamento em teste.

Ainda assim, a analogia não transfere, por dois motivos — um de identidade,
outro de arquitetura de risco:

1. **CPF/CNPJ é a própria identidade jurídica do favorecido — não um teste de
   elegibilidade fiscal.** Duas linhas com o mesmo CPF/CNPJ não são
   "provavelmente" a mesma pessoa: são, por definição, a mesma pessoa (fora
   fraude, fora do escopo de qualquer defesa de software). O único jeito real
   dessa correspondência estar errada é DIGITAÇÃO — e é exatamente esse risco
   (o oposto do caso do Mateus) que o próprio código já nomeia:
   `app/(captura)/adicionar/pagamento/page.tsx:210-214` e
   `docs/tickets/CONTAI-001.md:180` descrevem o perigo de um **dígito
   errado criar um segundo favorecido** por engano — nunca o perigo inverso,
   de dois CPFs corretos colidirem por coincidência (que não existe: CPF
   correto é identidade, não amostra de um espaço onde coincidência é
   possível). `cnoNaNota = "desta_obra"` não é esse tipo de teste fechado: é
   uma decisão de elegibilidade (esta nota conta ou não na base que o CRC
   assina) que o mesmo arquivo já trata, na direção oposta, com bloqueio.
   Identidade e elegibilidade são perguntas diferentes mesmo quando ambas se
   resolvem por igualdade exata de dígitos.

2. **Não encontrei, em nenhum parecer, ticket ou comentário do repositório,
   uma análise de risco escrita para o falso-positivo do favorecido** (dois
   favorecidos reais colididos por engano) — só para o falso-negativo
   (duplicata por dígito errado). Isso não valida o precedente como "risco
   examinado e aceito"; na leitura mais honesta, é um risco que este projeto
   ainda não escreveu. Registro para não desaparecer, fora do escopo desta
   pergunta: hoje não existe caminho implementado para desfazer uma colisão
   de favorecido — `app/(gestao)/documento/[id]/cnpj-errado/page.tsx:59-72`
   só marca o documento como "emitente errado"
   (`marcarEmitenteErrado`/`lib/data.ts:648-654`), sem mover pagamento ou
   documento para o favorecido certo; a correção de ponteiro
   (`favorecido_id`) está desenhada no parecer de 2026-08-18 mas não
   implementada. Isso toca a mesma ficha CPF-por-CPF de Pagamentos Efetuados
   (Meta 2) — **sugiro ao `po`/`cto-obra` abrir um item de backlog para essa
   lacuna**; não é o tema deste parecer e não o reabro aqui.

Resumindo o ADENDO 4: o precedente é real, automático e silencioso — mas foi
tolerado (sem exame de risco escrito) num campo onde a correspondência é
identidade fechada e onde a direção "juntar" nunca foi tratada como a
perigosa. `cnoNaNota` é o oposto nos dois pontos: é elegibilidade, não
identidade, e a direção equivalente ("juntar" = `desta_obra`) é precisamente
a que o próprio ticket trata com mais cautela ao bloquear o seu espelho
(`outra_obra`).

### 5. Recomendação de UX revisada — fortaleço a leitura, mantenho a decisão com o Mateus

Atualizo o item 2 do §4 da Pergunta 2 original. Em vez de só exibir os dois
números lado a lado (ainda comparação visual humana), o sistema deve
**computar a mesma igualdade exata de dígitos que a automação usaria e
exibir o veredito em palavras** — por exemplo: *"CNO da obra: [número] · CNO
da nota: [número] — números idênticos"* ou *"— números diferentes"*. Isso
entrega inteiro o ganho de confiabilidade que motivou a proposta (a máquina,
não o olho do Mateus, decide se os dígitos batem), sem entregar à máquina o
ato de marcar `desta_obra`. O Mateus continua apertando o botão certo — mas
informado por uma conclusão computada, não por uma comparação visual
falível. A forma de implementar é do `designer`/`cto-obra`.

### 6. Sob que condição eu mudaria de posição — sem alteração

Continua valendo o §5 original: um quinto estado (em `RespostaCnoNota` ou em
`MotivoForaDaBase`) que deixe rastro de que a marcação veio de
correspondência de máquina — não de decisão humana — reabriria a conversa,
porque resolveria o problema real (perda da camada humana sem substituição
equivalente), não o problema mal-nomeado da primeira resposta
("indistinguível"). Enquanto esse estado não existir: leitura e veredito
exibidos, sim; marcação automática do campo, não.

### Tabela da correção

| | Resposta original (Pergunta 2) | Depois deste reexame |
|---|---|---|
| Frase "indistinguível... sem rastro" | usada como razão central | reconhecida como imprecisa; retirada — é verdadeira, mas não diferencia automação de decisão manual |
| Razão real da reprovação | implícita nos itens 2/3 | explicitada: troca de decisão por confirmação (vigilância degradada), no único dos três campos em que o próprio ticket trata a direção "incluir" como sem conserto |
| Precedente `garantirFavorecido` | não avaliado | confirmado no código como real/automático/silencioso — mas não transferível: lá a chave é identidade jurídica fechada e "juntar" nunca foi tratado como perigoso; aqui a chave é elegibilidade fiscal e a direção equivalente já é bloqueada |
| Recomendação de UX | números lado a lado, sem veredito | veredito explícito da comparação exata, calculado por máquina, exibido em texto — campo continua vazio |
| Preencher `desta_obra` automaticamente | reprovado | **reprovado, mantido** — inclusive sob as três condições do Mateus |

**O contai redige, dateia e organiza. Não assina.**

---

## Síntese — por que os três campos desta família de perguntas não recebem a mesma resposta

| Campo | É fato legível? | Raio de efeito de um falso positivo aceito | Veredito |
|---|---|---|---|
| `retencaoNaNota` (ADENDO 5, já aprovado) | Sim — aritmética fechando | Abre seção revisável; não move conta sozinho | **Aprovado**, com as 4 salvaguardas do ADENDO 5 |
| `tributo` (Pergunta 1) | Não — mapeia texto livre para taxonomia legal | Pode calar, em silêncio, a pendência de recolhimento certa | **Reprovado** — critério 14 do CONTAI-038, sem exceção |
| `cnoNaNota = "desta_obra"` (Pergunta 2) | Sim — comparação de duas strings conhecidas | Entra limpo, sem pendência, na `baseCentavos` de um relatório que o CRC assina em cima | **Reprovado para preencher o campo; aprovado só para exibir o candidato lado a lado** |

O eixo que decide não é "o parser consegue ler isso" — os três, o parser
consegue ler. É se um erro aceito sem reler o papel (a) é autoevidente e
barato de descartar, ou (b) desaparece dentro de um número ou de uma decisão
que ninguém mais vai conferir depois.

**O contai redige, dateia e organiza. Não assina.**
