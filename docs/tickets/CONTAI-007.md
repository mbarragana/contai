# CONTAI-007 — CNO referenciado na NF de serviço (captura irreversível)

## Tipo e Prioridade
feature — **P0 condicionado** — precisa entrar **antes da próxima NF de
serviço registrada em produção** e, obrigatoriamente, **antes de existir uma
segunda obra no sistema**. É captura: fazer agora custa um campo; fazer depois
custa reabrir documento por documento e, se a nota já foi emitida com o CNO
errado, não custa retrabalho — custa a nota.

## Dor de Origem
**Não veio do relato do Mateus.** Veio do parecer do contador de 2026-08-09
(Q8b), disparado pelo relato 003. Registro isso porque a origem muda o peso: é
uma dor que ele ainda não sentiu e vai sentir na regularização da obra, quando
já não der para corrigir.

Dor extraída:
- **D12 [P0 fiscal]** — a dedução da NF de serviço PJ na aferição do SERO é
  amarrada ao **CNO impresso na nota**. O app captura `retencao_11` mas não
  captura o CNO referenciado. Uma nota emitida com o CNO da outra obra (ou sem
  CNO) hoje entra como se fosse dedutível, e o erro só aparece na aferição

## User Story
Como dono da obra, quero que o sistema me pergunte qual CNO está impresso na
NF de serviço e recuse a nota cujo CNO não é o da obra do registro, para que a
aferição daquele CNO feche e a construção possa ser averbada na matrícula.

## Critérios de Aceite
1. [ ] `cno_referenciado` capturado em **toda NF de serviço PJ** (coluna nova
       em `documento`; não se aplica a NF de material nem a boleto)
2. [ ] Se `cno_referenciado` ≠ CNO da obra do registro → **bloqueio**, não
       aviso, com a consequência escrita: *"esta nota não abate a aferição
       desta obra. Sem a aferição fechada não há regularização, e sem
       regularização a construção não é averbada na matrícula."*
3. [ ] "A nota não traz CNO" é resposta possível → **salva com pendência** e o
       mesmo texto de consequência; nunca em branco silencioso
4. [ ] A pendência de CNO ausente aparece junto das demais pendências, com a
       ação óbvia ("pedir nota com o CNO ao prestador")
5. [ ] O campo alimenta a **posição da aferição INSS** da US-004, **segregada
       por CNO** — nunca somada entre obras
6. [ ] E2E afirma o **estado gravado, não a tela**: NF de serviço com CNO
       divergente **não gera linha** em `documento` nem objeto no bucket

## Gate Fiscal (Contador)
Parecer de 2026-08-09, questão Q8. Formato "se X → Y":

- **Se** documento = NF de serviço PJ → **então** a dedução da base de
  aferição só vale se a nota **referenciar o CNO daquela obra** *e* a retenção
  de 11% tiver sido declarada em EFD-Reinf pelo prestador. **NF da obra A
  jamais abate base da obra B.** [Likely, confiança alta]
- **Se** o CNO da nota diverge do CNO da obra → **então** é erro **sem conserto
  depois da emissão** → por isso bloqueio na entrada, e não pendência. A
  pendência é o remédio para o que ainda dá para corrigir; esta não dá
- **Se** a aferição de um CNO não fecha → **então** não há regularização
  daquele CNO → **não há averbação da construção na matrícula** → o banco do
  comprador não financia e o cartório não lavra. **Erro de CNO não é erro de
  imposto: é impedimento de venda.** É o pior desfecho catalogado no projeto
  até hoje, e é o que justifica o P0
- **Se** a nota não traz CNO nenhum → **então** ela não abate a aferição, mas
  **continua sendo documentação hábil para o custo de aquisição** (IN SRF
  84/2001 art. 17). São duas apurações distintas: bloquear o registro inteiro
  perderia o custo para salvar o INSS. Daí pendência, e não bloqueio, no
  critério 3
- **Confirmar antes de citar norma em tela**: IN vigente do CNO/SERO
  (IN RFB 2.119/2022 sucedeu a IN 1.845/2018 — [Likely], não verificado)

## Out of Scope
- **Validar o CNO contra a Receita / e-CAC** — o app não tem como consultar, e
  um CNO "válido em formato" já resolve 100% do erro que este ticket ataca
  (nota da outra obra)
- **Conferir se a retenção foi declarada em EFD-Reinf** — obrigação do
  prestador, fora do alcance do produto. O app registra o que a nota diz e
  marca o que não sabe (o "não sei" já existe e está certo)
- **Calcular o valor da aferição** — US-004, e depende de o contador fechar a
  fórmula. Este ticket só captura a base
- Rateio de NF de serviço entre obras — **fiscalmente proibido na prática**
  (contador Q9c): a dedução é amarrada ao CNO impresso, logo um documento de
  serviço pertence a uma obra e só. Não é corte por escopo, é impossibilidade

## Pre-mortem
1. O CNO vira mais um campo de 14 dígitos digitado com uma mão no canteiro e o
   fluxo manual (já em ~10 interações, Gate 4 do CONTAI-001) piora. **Mitigação
   obrigatória**: o CNO **não se digita** — é escolha entre os CNOs das obras
   cadastradas (`é o CNO desta obra` / `é o da outra obra` / `a nota não traz
   CNO`). Três toques, zero digitação. Se o mock trouxer campo livre de 14
   dígitos, devolvo
2. O bloqueio do critério 2 pega ele no canteiro com a nota na mão e sem saída
   → ele registra na obra errada só para o app deixar salvar. **Mitigação**: a
   tela de bloqueio precisa oferecer "registrar na outra obra" como ação, não
   só recusar
3. Ele responde "é o CNO desta obra" sem conferir o papel. **Aceito**: o
   produto não tem como verificar, e o "não sei" honesto já existe como padrão
   (critério 5 do CONTAI-001, ratificado no Gate 4)

## Viabilidade (CTO)
- Uma coluna em `documento` + validação em `lib/fiscal/documento.ts` (onde já
  vivem `destinatario_cpf_ok` e `retencao_11`) + um campo condicional em
  `app/adicionar/documento/page.tsx` (o formulário já tem campo que só aparece
  em boleto — o padrão existe)
- Complexidade: **S**

## Dependências
- **Bloqueado por**: CONTAI-003 (sem obra cadastrada com CNO não há contra o
  que validar)
- **Implementar junto de CONTAI-004** (nº do documento e data de emissão):
  mesmo formulário, mesma migration, mesmo argumento de irreversibilidade.
  Duas migrations separadas em cima da mesma tabela para dois campos é
  desperdício, e cada leva de campo novo é uma leva de mock a aprovar
- **Bloqueia**: US-004 (posição da aferição INSS por CNO)

## Perguntas Abertas
- **Q13** (backlog, Relato 003): as NFs de serviço da AJE já vêm com o CNO da
  obra impresso? Se não vierem **nunca**, o critério 3 deixa de ser exceção e
  vira o caminho comum — e o ticket muda de tom: de validação para cobrança de
  nota correta ao prestador. A resposta não bloqueia a implementação, mas muda
  o mock
- Q13 fecha de carona a **Q5**, aberta desde o relato 002 (as notas vêm com
  retenção de 11%?) — é a mesma nota na mão, olhada uma vez

## Teste do Canteiro
- **Meta 1**: move — hoje uma NF de serviço com CNO errado é aceita como
  documento hábil pleno para as **duas** apurações, e só uma delas se sustenta
- **Meta 2**: move — é o dado sem o qual a "posição da aferição INSS" (uma das
  três saídas do produto) não pode ser gerada por CNO
- **Meta 3**: neutro
- Uma mão, com pressa: **só se o pre-mortem 1 for respeitado** (escolha, não
  digitação). Este é o ponto que o `designer` precisa resolver no mock
- **Veredito: APROVADO** — condicionado ao mock sem campo livre de 14 dígitos
