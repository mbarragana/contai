# CONTAI-003 — Cadastro de obra e obra ativa (o app deixa de assumir obra única)

## Tipo e Prioridade
feature — **P0** (promovido de P1 em 2026-08-09, ver justificativa) — segundo
bloqueador de deploy e, a partir da segunda obra, bloqueador **fiscal**.

**Por que subiu de P1 para P0.** Eram dois motivos independentes:
1. Sem obra cadastrada o app publicado é beco sem saída (`carregarObra()`
   lança `ObraAusenteError` e não há tela que crie obra);
2. **O novo**: com duas obras e o código atual (`select * from obra order by
   created_at limit 1`), todo documento da obra 2 cai silenciosamente na obra
   1. A consequência não é estética. Segundo o contador (Q8c, 2026-08-09): a
   base de aferição do CNO errado fica inflada, o INSS é pago duas vezes, **a
   regularização daquele CNO não sai, e sem regularização não há averbação da
   construção na matrícula — banco do comprador não financia e o cartório não
   lavra.** Erro de obra não é erro de imposto: é impedimento de venda.

**Atualização 2026-08-09 (respostas do Mateus).** O motivo 2 deixou de ser
prospectivo: **as duas obras já estão em andamento hoje**. Este ticket passa a
ser **pré-requisito de existir produção**, não item da fila — e **bloqueia o
CONTAI-007** (ver Dependências). Detalhe nas seções "Respostas do Mateus" e
"Perguntas Abertas".

## Respostas do Mateus — 2026-08-09 (fecham Q11 e Q12; Q13 em parte)

**Q11 — FECHADA.** *"sim, cada obra tem sua própria unidade"*: matrícula
própria, uma unidade autônoma cada, sem desmembramento/loteamento. **Os
relatórios deste produto continuam valendo** — a hipótese de equiparação a PJ
está afastada pelos fatos, não por interpretação (contador Q7b: a equiparação é
taxativa). Efeito no ticket: o critério 11 sobrevive, mas **nunca dispara com
os fatos de hoje** — é rede de segurança para uma terceira obra ou um terreno
de origem diferente, não caminho a ser desenhado no mock nem testado como
caminho comum.

**Q12 — FECHADA, e é a que muda a fila.** *"obra ativa é urgência, as duas
obras já estão em andamento"*. **A aposta que sustentava a fila anterior caiu**:
não existe janela em que este ticket possa ir a produção com uma obra só e o
resto vir depois. Os critérios 6–9 deixam de ser "quando a segunda obra
começar" e passam a ser condição de existir produção. Consequência direta:
**a simplificação "com uma obra só o seletor não aparece" deixa de ser o
caminho comum e vira estado de primeiro uso (dia 1, entre cadastrar a obra A e
cadastrar a obra B)**. O mock deve ser desenhado para N=2 como normal.

**Q13 — PARCIAL.** *"não, uma das obras não tem CNO"*. A parte de "as NFs de
serviço trazem o CNO impresso?" segue aberta (ver Perguntas Abertas).
**Não decido a regra deste ponto.** O agente `contador` está produzindo parecer
sobre obra em andamento sem CNO (obrigatoriedade, prazo, efeito sobre notas já
emitidas, e se o cadastro deve bloquear / aceitar com pendência / ignorar).
Até o parecer chegar, o critério 3 fica marcado **[AGUARDANDO PARECER DO
CONTADOR — em curso]** e nenhum mock desse ramo entra em desenvolvimento.

### O fluxo desenhado pelo Mateus (é hipótese de solução, não requisito)

> *"eu acredito que o CNO é por obra. eu vejo um fluxo de ... cria a obra, anexa
> o CNO, etc / cria outra obra, anexa o cno se existir, etc / duas obras na
> lista em um dashboard / eu seleciono a que quero interagir agora e vai / essa
> obra aberta fica em localstorage e abrir de novo pode abrir direto nela, ou
> então sempre abrir a lista de obras"*

O que eu aceito dele: **"o CNO é por obra"** (bate com o contador, Q8),
**cadastro por obra com o CNO anexado quando existir**, e **lista de obras como
porta de entrada**. O que eu trato como hipótese e reescrevo: o **"dashboard"**
e o **"localStorage"**.

**Furo 1 — o dashboard.** "Duas obras na lista em um dashboard" é, nas palavras
dele, a porta de entrada do **painel consolidado que este ticket já cortou**.
Bens e Direitos não soma entre matrículas e a aferição não soma entre CNOs: um
total das duas obras é um número que não existe em nenhuma declaração. **A
lista de obras mostra identidade e estado acionável — nome, CNO ou pendência de
CNO, nº de pendências — e nenhum valor em dinheiro** (critério 14). Dois
valores lado a lado estão a uma soma mental de virar um número inexistente, e
nenhuma decisão de "qual obra vou abrir" precisa de dinheiro para ser tomada.
Dinheiro mora dentro da obra, rotulado com o nome dela (critério 9).

**Furo 2 — o localStorage decide um campo fiscal.** Ele está tratando "qual
obra está aberta" como estado de navegação. **No instante do salvar isso deixa
de ser navegação e vira `obra_id` gravado no banco** — o campo cujo erro o
contador classificou como impedimento de venda. Estado de cliente decidindo
campo fiscal é o defeito, e trocar `localStorage` por tabela no banco **não
conserta**: uma preferência errada persistida no servidor erra com a mesma
elegância. O conserto é de requisito, não de armazenamento: **a obra gravada
tem de vir de uma afirmação que esteve na tela no momento do salvar, nunca de
um padrão ambiente que ninguém leu** (critérios 6, 7 e 13). Onde a preferência
mora continua sendo decisão do `cto-obra`; o que ela **não pode** fazer é ser a
única fonte do `obra_id`.

**Recomendação sobre "abrir direto na última" vs "sempre abrir a lista":
abrir direto na última.** Lista obrigatória a cada abertura é pedágio pago em
100% dos usos para um erro que acontece em poucos — e pedágio pago sempre vira
carimbo: ele aprende a tocar sem ler, e aí a lista deixa de proteger e passa a
**fabricar confiança falsa** ("eu escolhi", quando não escolheu). O lugar certo
da afirmação não é a abertura do app, é a tela de registro (critério 7) e a
confirmação de salvo. **Com duas exceções, que são requisito:** (i) se não há
valor confiável de obra ativa — primeiro uso, celular novo, storage limpo,
outro dispositivo — o app **cai na lista** e **nunca** escolhe uma obra
implicitamente (o `order by created_at limit 1` de hoje é exatamente esse bug,
critério 6); (ii) o registro precisa ser **corrigível depois** (critério 13),
porque este erro é silencioso e se descobre tarde.

## Dor de Origem
Relato 003 (2026-08-09): *"criar um ticket para login e criação de nova obra,
assim posso gerenciar mais de uma obra ao mesmo tempo. Por exemplo, tenho uma
casa que estou construindo para vender e tenho outra construindo para morar."*

Dores extraídas (a solução proposta no relato — "seletor de obra" — é
hipótese, não requisito):
- **D9 [P0 fiscal]** — não há como cadastrar obra pela interface; `cno`,
  `matricula` e `valor_terreno` (que compõe Bens e Direitos) só entram por SQL
- **D10 [P0 fiscal]** — o app assume obra única no código; um gasto da obra 2
  registrado hoje entra no imóvel errado, sem aviso e sem erro
- **D11 [P1 fricção]** — ele mantém duas obras na cabeça e precisa saber, ao
  registrar, em qual está mexendo

## User Story
Como dono da obra, quero cadastrar cada obra com a sua identificação fiscal
(matrícula, CNO, valor do terreno) e ver **em qual obra estou registrando**,
para que cada gasto entre no imóvel certo e cada obra gere a sua própria
discriminação de Bens e Direitos e a sua própria aferição no SERO.

## Critérios de Aceite
1. [ ] **Mock aprovado pelo Mateus antes de qualquer desenvolvimento**
       (premissa mock-first, CLAUDE.md), 375px, uma mão. Telas obrigatórias no
       mock: (a) cadastro/edição de obra; (b) **lista de obras** — a porta de
       entrada, sem valores em dinheiro; (c) **como a obra ativa é afirmada na
       tela de registro** de documento e de pagamento; (d) **confirmação de
       salvo nomeando a obra**; (e) **correção da obra de um registro já
       salvo**. As telas (b)–(e) são novas em relação ao mock v3 aprovado
2. [ ] Obra é cadastrada em tela; **nenhum campo de obra exige SQL**. Campos:
       nome, matrícula, cartório, município, CNO, valor do terreno
3. [ ] **[AGUARDANDO PARECER DO CONTADOR — em curso, 2026-08-09]** Tratamento
       da obra **sem CNO**. Fato confirmado pelo Mateus (Q13): **uma das duas
       obras em andamento não tem CNO hoje**. O comportamento provisório aqui
       registrado — cadastro aceita "ainda não tenho", obra nasce com
       **pendência de CNO** com a consequência escrita, nunca em branco
       silencioso — é **hipótese do PO, não regra fechada**. O parecer em curso
       decide obrigatoriedade, prazo, efeito sobre as notas já emitidas e se o
       cadastro deve **bloquear**, **aceitar com pendência** ou **ignorar**.
       Este critério **não vai para o mock nem para desenvolvimento** antes do
       parecer; o resto do ticket não fica parado por ele
4. [ ] `valor_terreno` é capturado com a composição já fixada pelo contador
       (Gate 2): **terreno + ITBI + escritura/registro**, com os três itens
       perguntados separadamente ou a composição explicada em tela
5. [ ] A obra é **editável** depois de criada (CNO, matrícula, valor do
       terreno). O CNO sai depois do início da obra e o ITBI/escritura pode
       ser pago depois da compra do terreno — cadastro imutável obrigaria SQL
       de novo
6. [ ] **N obras cadastráveis** e existe **obra ativa** persistida.
       `carregarObra()` deixa de ser `order by created_at limit 1`.
       **Sem valor confiável de obra ativa (primeiro uso, celular novo, storage
       limpo, outro dispositivo) o app abre a lista de obras e NÃO escolhe obra
       implicitamente** — nem a primeira, nem a mais recente, nem a única.
       Escolher em silêncio é o bug de hoje com outro nome
7. [ ] Na tela em que se registra documento e pagamento, a obra é **afirmada,
       não subentendida**: o **nome da obra** (campo `nome`, por extenso, não
       sigla) aparece no topo do formulário, junto de uma ação explícita de
       trocar ali mesmo — **sem sair do fluxo e sem ir a menu distante**. A
       confirmação de "salvo" **nomeia a obra** em que salvou. O padrão de
       interação é **afirmação com escape** (uma frase que se lê), não um
       `select` que se opera. Com uma obra só cadastrada — estado de dia 1, não
       caminho comum (Q12) — a afirmação continua aparecendo; some só a ação de
       trocar
8. [ ] E2E afirma o **estado gravado**: registrar na obra A, trocar a obra
       ativa para B, e o documento de A continua com `obra_id` de A
9. [ ] Home e `lib/fiscal/resumo.ts` mostram os números **da obra ativa**,
       rotulados com o nome dela. **Nada é somado entre obras** (ver Gate
       Fiscal: Bens e Direitos e aferição INSS nunca somam)
10. [ ] Duas obras com o **mesmo CNO** → bloqueio. O CNO é a chave da
        aferição; dois imóveis no mesmo CNO quebram a segregação por construção
11. [ ] Campos de premissa do produto: `unidades_autonomas` (inteiro) e
        `origem_desmembramento_loteamento` (S/N). Se `unidades_autonomas > 1`
        **ou** desmembramento = sim → aviso persistente na obra: *"a sua
        situação pode ser de incorporação imobiliária; os relatórios deste app
        assumem ganho de capital de pessoa física — confirme com o seu contador
        antes de usá-los"*. **Não bloqueia** o cadastro
12. [ ] E2E: usuário novo, sem nenhuma obra, cai no cadastro de obra em vez de
        tela de erro (`ObraAusenteError` deixa de ser tela final)
13. [ ] **A obra de um registro já salvo é corrigível pela interface**, com a
        correção visível no detalhe do documento/pagamento. Sem isto, um
        `obra_id` errado é permanente ou exige SQL — que é a dor D9 voltando
        pela porta dos fundos. Justificativa: este erro é **silencioso e
        descoberto tarde** (pre-mortem 1); um produto que só previne e não
        conserta perde o caso real. **Restrição fiscal**: corrigir a obra de
        **NF de serviço** obriga a revalidar `cno_referenciado` contra o CNO da
        obra de destino (CONTAI-007, critério 2) — a correção não pode
        contrabandear uma nota para uma obra cujo CNO ela não referencia
14. [ ] A **lista de obras** mostra nome, CNO (ou a pendência de CNO) e nº de
        pendências. **Nenhum valor em dinheiro, e nenhuma linha de total** —
        ver Out of Scope. É tela de navegação, não painel
15. [ ] E2E do caminho perigoso, afirmando **estado gravado**: com duas obras
        cadastradas, abrir o app sem obra ativa persistida **não grava** nada
        em nenhuma obra antes de uma escolha explícita; e um registro salvo na
        obra A, após correção (critério 13) para a obra B, tem `obra_id` de B e
        deixa de aparecer em qualquer saída da obra A

## Gate Fiscal (Contador)
Parecer de 2026-08-09, questões Q7–Q10. Formato "se X → Y":

- **Se** existe uma obra → **então** ela tem CNO **próprio e obrigatório**, em
  até 30 dias do início. Não existe CNO único para duas obras em matrículas
  distintas. As hipóteses de dispensa (reforma sem alteração estrutural;
  unifamiliar econômica sem mão de obra remunerada) **não se aplicam** — há
  empreiteiro PJ e prestadores PF. *IN RFB 2.119/2022 (sucedeu a IN 1.845/2018)
  — confirmar a IN vigente antes de citar norma em tela.* [Likely]
- **Se** um documento ou pagamento é registrado → **então** a obra é campo
  **obrigatório e bloqueante**, igual ao check do destinatário CPF — **não** é
  pendência. Sem obra atribuída o gasto não entra em nenhuma discriminação de
  Bens e Direitos; custo não declarado não existe (IN SRF 84/2001 art. 17) e na
  venda o valor inteiro vira ganho tributado. Pendência só no caso legado da
  US-005 (migração da planilha), onde o registro já nasceu sem obra.
- **Se** há duas obras → **então** a **discriminação de Bens e Direitos é uma
  por matrícula**: dois lançamentos, duas discriminações independentes, cada
  uma com o seu CNO e a sua composição anual. Terreno + construção da mesma
  matrícula continuam sendo um item só. *Códigos do grupo 01 mudam de layout
  entre anos — conferir no programa do ano-calendário (CRC).*
- **Se** há duas obras → **então** a **aferição INSS é isolada por CNO**. NF de
  serviço da obra A **jamais** abate base da obra B. A saída "posição da
  aferição INSS" deixa de ser um número e passa a ser um relatório por CNO,
  nunca somado (impacto na US-004).
- **Se** a obra é "para morar" ou "para vender" → **então nada muda no
  registro.** Custo de aquisição, documentação hábil, regime de caixa,
  Bens e Direitos e ganho de capital funcionam **igual** nos dois casos
  (IN SRF 84/2001 art. 17). [Certain] — **por isso o campo "destinação" foi
  cortado**, com aval expresso do contador (Q7d).
- **Se** `unidades_autonomas > 1` **ou** o terreno veio de
  desmembramento/loteamento **ou** houve registro de incorporação → **então** a
  situação pode ser de **equiparação a empresa por operações imobiliárias**, e
  os relatórios deste produto (que assumem ganho de capital de PF) deixam de
  valer. *RIR/2018, origem DL 1.381/74 e DL 2.072/83; Lei 4.591/64 para
  incorporação.* [Likely na regra, Guessing na numeração] → **aviso, não
  bloqueio** (critério 11).
- **Não é risco, e o ticket não deve tratá-lo como tal**: duas obras, duas
  matrículas, **uma unidade autônoma cada** = ruído. A equiparação é
  **taxativa** (loteamento, desmembramento ou incorporação) e **não** decorre
  de quantidade de obras nem de intenção declarada. Correção do contador: o
  DL 1.598/77 art. 27, que eu havia citado, é regra de **pessoa jurídica** e
  não se aplica aqui.
- **Se** um imóvel é vendido → **então** o prazo de guarda corre **por
  imóvel**: 5 anos do primeiro dia do exercício seguinte à DAA que declarou
  aquela venda (CTN art. 173, I). Obra não vendida = prazo **indefinido**.
  Impacto na meta 3 e na US-011 (export segmentável por obra).

**Exige contador humano (CRC) antes da 1ª declaração** (nenhum destes bloqueia
este ticket; todos bloqueiam a US-004 no ano da primeira venda):
- códigos de Bens e Direitos (casa/terreno/construção) e da ficha Pagamentos
  Efetuados no programa do ano;
- IN vigente do CNO/SERO e a numeração dos artigos de equiparação no RIR/2018,
  antes de qualquer texto desses aparecer em tela;
- data de aquisição para o fator de redução quando o terreno é de um ano e a
  construção de outro (Lei 11.196/05 art. 40);
- se a isenção do art. 39 da Lei 11.196/05 vale quando o reinvestimento é
  **construção** em vez de aquisição, e como o limite de 1 vez a cada 5 anos
  se comporta entre as duas vendas.

**Morreu com os fatos, e é bom o Mateus saber**: a isenção do art. 23 da Lei
9.250/95 (único imóvel até R$ 440 mil) **não existe mais** para ele — com dois
imóveis, nenhum é "o único". Não é requisito de software; é informação que
muda a conversa com o CRC.

## Out of Scope
- **Campo "destinação (morar / vender)"** — cortado. Não altera nem o custo,
  nem a documentação hábil, nem o regime de caixa, nem a discriminação
  (contador Q7d, aval expresso). Num produto cuja disciplina é "todo campo tem
  consequência fiscal", um campo decorativo ensina o oposto. O campo `nome` da
  obra já resolve ("Casa de morar" / "Casa de vender")
- **Painel consolidado / comparação entre as duas obras** — não serve nenhuma
  das três metas **e é fiscalmente enganoso**: Bens e Direitos não soma entre
  matrículas e a aferição INSS não soma entre CNOs. Um total das duas obras é
  um número que não existe em nenhuma declaração.
  **Reafirmado em 2026-08-09 contra as palavras do próprio Mateus** ("duas
  obras na lista em um dashboard"): a palavra "dashboard" é a porta de entrada
  desse painel. Fica a **lista** (critério 14) — identidade e estado
  acionável — e **nenhum valor em dinheiro nela**, mesmo que cada valor seja,
  isoladamente, verdadeiro. Dois números corretos lado a lado convidam a uma
  soma que não existe em declaração nenhuma; e nenhuma decisão de "qual obra
  eu vou abrir" precisa de dinheiro para ser tomada
- **Rateio de um documento entre obras** — US-012 [P1], só material
- **Arquivar/encerrar obra vendida** — P2; o relógio de guarda por obra entra
  junto da US-011
- Convidar o contador / multiusuário (também fora do CONTAI-002)
- Gestão de cronograma, orçado vs. realizado, comunicação com empreiteiro —
  escopo declarado fora do produto (CLAUDE.md), e "gerenciar mais de uma obra"
  é a porta de entrada natural dessa tentação

## Pre-mortem
1. Ele cadastra a 2ª obra, registra três documentos e só percebe semanas
   depois que a obra ativa era a 1ª → custo no imóvel errado e base de CNO
   contaminada, descoberto na regularização (tarde demais). **Mitigação:
   critério 7** — o nome da obra ativa na tela de registro *e* na confirmação
   de salvo. É o critério mais importante deste ticket
2. Ele ainda não tem o CNO da 2ª obra, o cadastro bloqueia, e ele volta para a
   planilha. **Mitigação: critério 3** ("ainda não tenho" + pendência)
3. O seletor de obra vira troca de contexto casual e ele registra por hábito na
   obra errada. **Mitigação**: com uma obra só, o seletor não existe; com duas,
   a obra é afirmada na tela de registro, não escolhida em menu distante
4. A home passa a mostrar números por obra e ele lê como se fossem o total do
   patrimônio. **Mitigação: critério 9** — rótulo com o nome da obra em todo
   número
5. *(novo, 2026-08-09)* A obra ativa some ou nasce errada **sem ninguém tocar
   em nada**: celular novo, storage limpo, PWA reinstalado, aba de outro
   dispositivo. O app cai no fallback, escolhe a obra 1 e ele registra três
   documentos achando que escolheu. **É o mesmo bug de hoje com roupa nova.**
   **Mitigação: critério 6** — sem valor confiável, abre a lista e não escolhe
   nada; e **critério 7**, que põe a afirmação na tela onde o dano acontece
6. *(novo, 2026-08-09)* O erro acontece assim mesmo — porque ele leu e não viu
   — e é descoberto semanas depois. **Mitigação: critério 13** (correção pela
   interface). Prevenção sem conserto perde o caso real; e o conserto sem a
   revalidação de CNO do critério 13 cria um erro pior que o original

## Viabilidade (CTO)
- O schema **já comporta N obras**: `obra` tem `id`/`user_id` e `documento` e
  `pagamento` já têm `obra_id` **obrigatório**. Nada precisa nascer para
  múltiplas obras existirem
- Migration nova, pequena: `unidades_autonomas int`, `origem_desmembramento
  boolean`, unique parcial `(user_id, cno) where cno is not null`
- **Onde mora a "obra ativa"** segue sendo decisão do `cto-obra` — banco
  (sobrevive à troca de celular, custa uma tabela) vs. `localStorage` (barato,
  o que o Mateus propôs, some no celular novo). **Mas o PO retira este ponto da
  lista de riscos fiscais**: a escolha de armazenamento não decide a correção
  do `obra_id`. Uma preferência errada persistida no banco erra tão bem quanto
  uma no `localStorage`. O que protege é o requisito — critérios 6, 7 e 13 —,
  não a caixa onde a preferência dorme. **Requisitos que o `cto-obra` não pode
  otimizar para longe, seja qual for a caixa escolhida:**
  1. **ausência de valor confiável nunca vira escolha implícita** (critério 6);
  2. **o `obra_id` gravado corresponde à obra afirmada em tela no momento do
     salvar** — se as duas puderem divergir (troca em outra aba, sessão velha,
     preferência atualizada por outro dispositivo entre o abrir e o salvar), a
     gravação usa **o que estava na tela**, não a preferência mais recente;
  3. **a correção posterior existe** (critério 13)
- `lib/data.ts::carregarObra()` e `carregarPainel()` mudam de assinatura;
  `lib/fiscal/resumo.ts` já filtra pelo que o painel traz
- Complexidade: **M**

## Dependências
- **Bloqueado por**: CONTAI-002 (sem sessão não há `user_id` para a obra);
  mock aprovado
- **Deploy conjunto obrigatório com CONTAI-002** — release única
- **Bloqueia**: US-004 (discriminação por matrícula, aferição por CNO),
  US-011 (export segmentável por obra), US-012 (rateio)
- **Bloqueia CONTAI-007** *(corrigido em 2026-08-09)*: o CONTAI-007 já
  declarava "bloqueado por CONTAI-003", mas a fila de 2026-08-09 o colocava
  **antes** deste ticket. Era contradição, e a resposta da Q12 a resolve no
  sentido único possível: com duas obras em andamento, o caminho comum do
  CONTAI-007 é justamente *"o CNO é o da outra obra"*, que não existe sem
  cadastro de obra. **CONTAI-007 passa a vir depois deste ticket**, na mesma
  release (ver Fila revista no backlog)

## Perguntas Abertas
**Q11 e Q12 fechadas em 2026-08-09** (ver seção "Respostas do Mateus" no topo).
**Q13 parcial**: confirmado que **uma das obras não tem CNO**; segue aberta a
parte *"as NFs de serviço da AJE vêm com o CNO da obra impresso?"* — ela não
bloqueia este ticket, bloqueia o mock do CONTAI-007.

**Aguardando parecer do `contador` (em curso, 2026-08-09)**: obra em andamento
**sem CNO** — obrigatoriedade e prazo, efeito sobre as notas já emitidas para
essa obra, e o comportamento do cadastro (bloquear / aceitar com pendência /
ignorar). **É o único item deste ticket que não pode ser desenhado nem
implementado hoje** (critério 3). O restante segue.

## Teste do Canteiro
- **Meta 1** (nenhum pagamento sem documento hábil): move — a obra passa a ser
  campo bloqueante, e "documento sem obra" é uma forma de gasto sem
  comprovação que hoje o app aceitaria em silêncio
- **Meta 2** (relatórios anuais): move estruturalmente — é o que torna
  possível uma discriminação por matrícula e uma aferição por CNO. Sem isto a
  US-004 gera um relatório errado com cara de certo
- **Meta 3** (acervo até venda + 5 anos): move — o relógio de guarda é por
  obra, e sem `obra_id` confiável o dossiê do imóvel vendido não se monta
- Uma mão, com pressa: o cadastro não é tarefa de canteiro (acontece duas
  vezes na vida); **a troca de obra ativa é**, e é ela que o mock precisa
  resolver em 375px. *(2026-08-09)* Com as duas obras em andamento, o mock deve
  assumir **N=2 como estado normal** — a tela de uma obra só é o dia 1
- **Veredito: APROVADO** — Q12 respondida (as duas obras já estão em
  andamento), o que **remove a condicional e sobe a urgência**. Condicionado
  apenas a: (1) **mock aprovado pelo Mateus** cobrindo as cinco telas do
  critério 1 (mock-first, CLAUDE.md); (2) **parecer do contador sobre a obra
  sem CNO** antes de o critério 3 ir a mock/desenvolvimento — os demais
  critérios não esperam
