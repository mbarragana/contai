# CONTAI-007 — CNO referenciado na NF de serviço (captura irreversível)

## Tipo e Prioridade
feature — **P0 condicionado** — precisa entrar **antes da próxima NF de
serviço registrada em produção** e, obrigatoriamente, **antes de existir uma
segunda obra no sistema**. É captura: fazer agora custa um campo; fazer depois
custa reabrir documento por documento e, se a nota já foi emitida com o CNO
errado, não custa retrabalho — custa a nota.

**Atualização 2026-08-10 (Gate 2 do CONTAI-003).** O ticket **cresceu** com
três itens que o CONTAI-003 deixou explicitamente para cá — critérios 7, 8 e 9.
Nenhum deles é ideia nova: dois estavam no mock aprovado carimbados como
"CONTAI-007", e o terceiro é uma **armadilha deixada em código** pelo
CONTAI-003, de propósito e documentada, que só este ticket desarma. **A ordem
`003 → 007` continua**; o que muda é que o 007 não é mais só "uma coluna e uma
validação".


⚠️ **Gate 0 satisfeito em 2026-08-24** — mesmo mock do `CONTAI-004`, que é o passe único para o formulário `/adicionar/documento` (`design/mocks/CONTAI-004.html`). Regra do próprio `CONTAI-004`: "duas levas de campo novo são duas levas de mock a aprovar".

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

### Acrescentados em 2026-08-10 (desdobramentos do Gate 2 do CONTAI-003)

7. [ ] **Ligar `cnoReferenciado` na tela de correção de obra.** Hoje
       `app/documento/[id]/obra/page.tsx` passa `cnoReferenciado={null}`
       **literal**, com comentário explicando que o campo só nasce aqui. A
       revalidação de CNO exigida pelo critério 13 do CONTAI-003 já está
       escrita e **avisa em vez de barrar**, porque não tem o que comparar.
       **Se este ticket popular a coluna e ninguém trocar o literal, a
       revalidação nunca passa a barrar — e ninguém percebe**: a tela continua
       funcionando, o teste continua verde, e uma NF de serviço é
       contrabandeada para uma obra cujo CNO ela não referencia. Aceite:
       (a) o literal sai e o valor real do documento é passado; (b) o
       comportamento vira **bloqueio** quando `cno_referenciado` diverge do CNO
       da obra de destino, com a mesma redação do critério 2; (c) **teste que
       falha se o literal voltar** — um E2E que move NF de serviço com CNO
       divergente e afirma que o `obra_id` **não** mudou. Sem esse teste, o item
       é um comentário e comentário não protege nada
8. [ ] **Lista das notas emitidas sem CNO — tela 14 do mock aprovado**
       (`design/mocks/CONTAI-003.html`), com o link de entrada *"Ver as [N]
       notas desta obra emitidas sem CNO"* na tela 13 (registro de NF de serviço
       em obra sem CNO). **Já estão desenhados e aprovados pelo Mateus em
       2026-08-10**; ficaram fora do CONTAI-003 porque dependem de `numero`,
       `data_emissao` (CONTAI-004) e `cno_referenciado` (este ticket) — o
       próprio mock traz essa anotação. Conteúdo: número, data, prestador e
       valor das notas daquela obra emitidas entre `data_inicio_obra` e
       `cno_registrado_em`. **É o único item deste lote que recupera valor em
       vez de só registrar perda**, e vale só enquanto houver parcela a liberar.
       **Não precisa de mock novo** — o mock existe e está aprovado
9. [ ] **Aviso ao pagar favorecido PJ em obra sem CNO.** Ao registrar
       **pagamento** (não documento) a favorecido **PJ** numa obra sem CNO,
       mostrar **só a frase da alavanca do parecer** — exigir CNO impresso nas
       próximas notas e retificação da EFD-Reinf **antes de liberar a próxima
       parcela**. **Sem atrito adicional**: sem caixa a marcar, sem toque a
       mais, sem bloqueio. Razão de existir: **é o único momento em que o app
       sabe que ainda há parcela a pagar**, e a alavanca do parecer morre no
       último pagamento. Restrições, e elas são o ticket:
       (a) **só PJ** — a alavanca é sobre EFD-Reinf de prestador PJ; em
       favorecido PF a frase é ruído e ruído fabrica cegueira ao aviso;
       (b) **só obra sem CNO**;
       (c) **nunca bloqueia** e não muda a contagem de toques do fluxo
       (critério 15 do CONTAI-003, e adendo do contador de 2026-08-10:
       confirmação obrigatória a cada registro é bloqueio disfarçado);
       (d) a redação sai do parecer, não é escrita aqui

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
4. *(2026-08-10)* A coluna é populada, o app passa a saber o CNO da nota, e o
   `cnoReferenciado={null}` continua na tela de correção de obra. **Tudo fica
   verde**: nenhum teste quebra, nenhuma tela muda, e a única porta que permite
   levar uma NF de serviço para a obra errada segue aberta — agora com o
   agravante de que o sistema **tinha** a informação para barrar e não usou.
   É a falha mais silenciosa deste ticket. **Mitigação: critério 7(c)** — o
   teste que falha se o literal voltar. Sem ele, o critério 7 é um comentário

## Viabilidade (CTO)
- Uma coluna em `documento` + validação em `lib/fiscal/documento.ts` (onde já
  vivem `destinatario_cpf_ok` e `retencao_11`) + um campo condicional em
  `app/adicionar/documento/page.tsx` (o formulário já tem campo que só aparece
  em boleto — o padrão existe)
- *(2026-08-10)* Os critérios 7–9 acrescentam: trocar um literal e o
  comportamento da revalidação em `app/documento/[id]/obra/page.tsx` (+ o teste
  que impede o literal de voltar), uma tela de lista já desenhada (tela 14 do
  mock), e uma frase condicional no registro de pagamento
- Complexidade: **S → M** *(revista em 2026-08-10)*

## Dependências
- **Bloqueado por**: CONTAI-003 — **já satisfeito (Gate 2 concluído em
  2026-08-10)**. *(O motivo correto da dependência não é "sem CNO não há contra
  o que validar" — o contador desmontou isso; é material: o 007 precisa de
  `cno`, `data_inicio_obra` e `cno_registrado_em`, colunas que só o 003 cria.
  Sem `cno_registrado_em` não existe a janela, e sem a janela não existe a
  lista de cobrança do critério 8.)*
- **Mock**: os critérios 8 e 9 **não pedem mock novo** — a tela 14 e o link
  estão aprovados no mock do CONTAI-003, e o critério 9 é uma frase de parecer
  em tela existente. O critério 7 não tem superfície nova
- **Depende de CONTAI-004** para o critério 8: a lista de cobrança mostra
  **número e data de emissão** das notas, campos que só o 004 captura. Reforça
  o "implementar junto de CONTAI-004" logo abaixo — que deixa de ser economia
  de migration e passa a ser dependência de conteúdo
- **Implementar junto de CONTAI-004** (nº do documento e data de emissão):
  mesmo formulário, mesma migration, mesmo argumento de irreversibilidade.
  Duas migrations separadas em cima da mesma tabela para dois campos é
  desperdício, e cada leva de campo novo é uma leva de mock a aprovar.
  *(2026-08-10 — isto deixou de ser conveniência e virou ordem: **dentro do par,
  o 004 vem primeiro**, porque o critério 8 lista as notas por número e data de
  emissão, que são campos do 004. A "2ª revisão" da fila colocava 007 antes de
  004 sem motivo declarado; corrigido na 3ª revisão.)*
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
