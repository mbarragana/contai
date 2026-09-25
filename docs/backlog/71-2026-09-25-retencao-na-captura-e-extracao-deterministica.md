# Retenção destacada: repeater na captura + extração determinística de NFS-e — 2026-09-25 — "deve ter um campo para preenchimento tudo junto na adição do registro, inclusive"

## Contexto do relato

Mateus perguntou como registrar uma nota de serviço da empreiteira com
retenção destacada (exemplo anonimizado usado por ele mesmo: nota de R$10,00,
dos quais R$9,50 são transferidos e R$0,50 ficam retidos). No processo,
anexou uma NFS-e real como exemplo. **Nenhum dado identificador dessa nota
(CPF, CNPJ, razão social, CNO, valores reais) entra neste arquivo** — só a
estrutura do layout, relevante para escopar a extração determinística:
NFS-e municipal (padrão comum em prefeituras de SC), regime Simples Nacional
com substituição tributária de ISS, PDF com texto embutido (não é
foto/scan) e três campos já rotulados pelo próprio layout: "Valor Total"
(bruto), "ISSRF" (ISS Retido na Fonte, destacado pelo tomador) e "Valor
Líquido" (= Valor Total − ISSRF, a conta bate).

Estado hoje (`CONTAI-038`, entregue em 2026-09-21): a pergunta-gate
("Esta nota destaca alguma retenção? nenhuma/destacada") fica em
`/adicionar/documento` (captura); se "destacada", o repeater completo de
linhas (rótulo, valor, composição, tributo, é desconto efetivo, quem
recolhe) só aparece depois, em `/documento/[id]` (gestão) — separação
deliberada do próprio ticket (critério 1), para não estourar o limite de
"~3 interações" da captura no canteiro.

Contexto à parte, citado no relato mas **fora de escopo aqui por instrução
explícita**: mesmo com a linha de retenção preenchida, o "excedente da nota"
não fecha sozinho hoje (só um pagamento novo fecha o saldo). Fica registrado
como pista para o `po`/`contador` decidirem depois — sem story nesta entrada.

## Dores extraídas (citação do relato)

1. **Fluxo partido em duas telas para um único fato.** *"quando destacada,
   deve ter um campo para preenchimento tudo junto na adição do registro,
   inclusive."* — o Mateus já sabe, no momento da captura, que a nota tem
   retenção e qual o valor; ter que voltar depois à tela de gestão para
   completar o que já leu na hora é fricção de processo, não perda fiscal
   (a pendência e a disciplina de "campo vazio pergunta" já existem hoje via
   `/documento/[id]`).

2. **Digitação manual de um dado que já está estruturado no PDF.** *"Dá para
   ler o valor direto da nota e ver se é destacada ou não."* — para o padrão
   de NFS-e municipal com campo "ISSRF" rotulado e aritmética batendo
   (Total − ISSRF = Líquido), o valor e o rótulo da retenção são leitura de
   texto impresso, não julgamento fiscal — mesma classe de campo que a
   extração já sugere hoje para outros dados do documento.

## Classificação e gate fiscal

Nenhuma das duas dores é obrigação fiscal isolada — a disciplina que protege
as três metas do produto (documento hábil, discriminação anual, aferição do
SERO) já está fechada pelo `CONTAI-038`. As duas são **fricção de processo
(P1)**: reduzem cliques e idas-e-voltas, sem mudar nenhum cálculo, pendência
ou regra existente.

Consultei o `contador` sobre um ponto que não estava decidido: pode a
extração sugerir a própria resposta do **gate** (`retencao_na_nota =
destacada`), não só `rotulo_literal`/`valor`, para o padrão estruturado tipo
"ISSRF"? **Veredito: não.** Citação do parecer aplicada ao caso novo:

> "O gate não é leitura de campo, é a decisão que a leitura ainda não
> justifica sozinha (...) 'ISSRF' com Valor Líquido = Total − ISSRF é mais
> forte que aquele caso [o 4,6228% do parecer de 18/08, que era alíquota do
> Simples, não retenção], mas o padrão de risco que motivou blindar o gate é
> justamente 'campo rotulado ≠ garantia de leitura inequívoca para todo
> emissor'. Abrir exceção por rótulo específico reintroduz o acoplamento a
> padrão de nota que o Adendo A.1 eliminou de propósito (...) pré-marcar
> 'destacada', ainda que como sugestão, já muda a psicologia de responder a
> frio para confirmar o que a tela mostra — mesmo risco que já levou a manter
> `notaNoCpf` fora, na mesma frase do comentário em `schema.ts`."

Ou seja: o gate continua **inteiramente fora da extração**, sem exceção por
padrão de nota, por mais estruturado que o layout seja. `rotulo_literal` e
`valor` só podem ser sugeridos **depois** que o Mateus já tiver respondido
"destacada" manualmente — exatamente o que o critério 14 do `CONTAI-038` já
previa ("quando as linhas de retenção entrarem aqui").

## User stories

### US-A (P1) — Repeater de retenção na própria tela de captura, em tela larga

Como dono da obra registrando uma NF de serviço **em casa, sentado, no
desktop** (cenário principal de gestão — o `CONTAI-047`, entregue em
2026-09-23, já deu à captura uma casca larga de ~880px com rail lateral),
quando respondo o gate "destacada", quero preencher as linhas de retenção
(rótulo, valor, composição, tributo condicional, é desconto efetivo, quem
recolhe) **no mesmo formulário**, sem precisar abrir o documento depois em
`/documento/[id]`, para fechar o registro de uma vez só enquanto tenho a nota
na mão.

Em tela estreita (piso de captura no canteiro, uma mão — Teste do Canteiro
continua valendo aqui, é o motivo do critério 1 do `CONTAI-038` existir),
**nada muda**: gate na captura, repeater só depois na gestão.

**Critério de aceite verificável:**
- Documento salvo em tela larga (≥880px, o mesmo piso que o `CONTAI-047`
  já define para o grupo `(captura)`) com gate = "destacada" e todas as
  linhas completas: ao abrir `/documento/[id]` logo em seguida, as linhas
  já aparecem gravadas em `documento_retencao`, idênticas às que apareceriam
  se tivessem sido digitadas na tela de gestão — **nenhuma pendência
  `retencao_sem_recolhedor` aberta** se `quem_recolhe` foi respondido.
- Documento salvo em tela larga com gate = "destacada" e repeater deixado
  incompleto (ex.: sem `composicao` numa linha): mesma disciplina do
  `CONTAI-038` critério 2/5 — o registro salva, mas a pendência fica
  **visível** na tela de detalhe (nunca lida como "sem retenção").
- Em tela estreita, `grep`/teste E2E confirma que o repeater **não** aparece
  em `/adicionar/documento` — regressão trava pela suíte existente do
  `CONTAI-038` (`ingestao.spec.ts`).
- Nenhuma opção nasce pré-marcada em nenhuma pergunta do repeater, mesma
  regra do critério 3 do `CONTAI-038`.

**Dependência**: precisa de `/design` (mock nível 1 — não existe precedente
de repeater com campos condicionais dentro do rail de captura já entregue
pelo `CONTAI-047`) antes do Gate 1.

### US-B (P1) — Extração sugere rótulo e valor da linha de retenção após o gate

Como dono da obra que já respondeu "destacada" ao gate (na captura ou na
gestão), quero que a extração automática, ao processar uma NFS-e com layout
estruturado e rotulado (ex.: campo "ISSRF" com valor > 0 e aritmética
Total − ISSRF = Líquido batendo), **pré-preencha o `rotulo_literal` e o
`valor`** de uma linha de retenção para eu confirmar, em vez de digitar os
dois campos do zero.

**Critério de aceite verificável:**
- `lib/extracao/` só tenta ler `rotulo_literal`/`valor` de linha de retenção
  quando `documento.retencao_na_nota = "destacada"` já foi respondido pelo
  humano — nunca antes, nunca para decidir o gate. Teste unitário cobre:
  extração rodada sobre PDF com "ISSRF" e gate ainda `null`/`"nenhuma"` não
  gera nenhuma linha nem sugestão.
- Nenhum outro campo da linha (`composicao`, `tributo`, `e_desconto_efetivo`,
  `quem_recolhe`) é preenchido pela extração — continuam sempre em branco
  para confirmação humana, sem exceção por padrão de nota (mesma trava do
  critério 14 do `CONTAI-038`, agora exercitada por um caso real).
  `grep -rn` no diff da extração confirma zero atribuição automática a esses
  quatro campos.
- A sugestão de `rotulo_literal`/`valor` passa pela mesma UI de confirmação
  que os demais campos extraídos hoje (o Mateus clica para aceitar/edita
  antes de salvar) — nenhum valor é gravado sem o "Salvar" manual.
- Escopo desta rodada: só o padrão com campo estruturado e rotulado
  (ISSRF/similar, com aritmética batendo). Nota com linha combinada
  ("Total das Retenções") ou sem rótulo claro **não é forçada** a produzir
  sugestão — cai no fluxo manual de hoje, sem regressão.

**Dependência**: nenhuma migration nova; estende `lib/extracao/schema.ts` e
o provedor de texto do `CONTAI-052` (Groq/texto local), que já lê o texto
embutido do PDF. Não bloqueado por US-A — são caminhos independentes
(US-A é sobre onde o formulário aparece; US-B é sobre o que a extração
sugere dentro dele).

## Filtro de escopo — o que ficou de fora e por quê

- **Extração sugerir a resposta do gate `retencao_na_nota` sozinha** —
  cortado pelo veredito do `contador` acima: o gate exige afirmação humana
  sempre, mesmo para layout estruturado. Não é corte do `po`, é regra fiscal.
- **"Excedente da nota" fechar sozinho quando a retenção é recolhida pela
  empresa** — citado no relato como dúvida em aberto, mas o próprio relato
  pediu para não abrir story aqui. Fica só como pista de contexto; se virar
  prioridade, é entrada de backlog própria com consulta ao `contador`
  (o `CONTAI-038` já registra recomendação equivalente em "Fora de Escopo").
- **Generalizar a extração determinística para outros padrões de NFS-e**
  (municípios diferentes, layouts sem campo rotulado) — o próprio relato já
  sugeriu isso como possível fatiamento menor; sem mais exemplos reais de
  formato, generalizar agora seria regra fabricada sem caso concreto
  (mesmo risco que o parecer do `contador` aponta no item 3 do veredito
  acima). US-B fica restrita ao padrão "campo rotulado + aritmética batendo".
- **Cadastro de "% padrão de retenção" por prestador** — já descartado pelo
  parecer de 2026-09-18 (§3) e repetido no `CONTAI-038`; não ressuscitado
  aqui.

## Perguntas abertas

1. US-A depende de largura ≥880px (piso do `CONTAI-047`) para decidir onde o
   repeater aparece. Existe algum caso de captura em tela larga que ainda
   precise ficar restrito ao fluxo de 3 interações (ex.: tablet em modo
   apoiado no canteiro, não "em casa sentado")? Sem resposta, assumo que a
   régua de largura já usada pelo `CONTAI-047` é suficiente, sem heurística
   nova de "onde a pessoa está".
2. US-B: quando a extração sugerir `rotulo_literal`/`valor` de uma linha via
   texto determinístico (não IA de visão), o valor de `confianca` deve
   seguir o mesmo critério de "texto" já definido no `CONTAI-052`
   (rebaixado por `conferirContraFonte` quando o campo não aparece no
   texto-fonte), ou a aritmética batendo (Total − ISSRF = Líquido) é sinal
   forte o bastante para tratar como `alta` sempre? Sem resposta, assumo o
   critério já existente do `CONTAI-052` (sem exceção nova).
