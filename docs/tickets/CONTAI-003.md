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
1. [ ] Mock aprovado pelo Mateus (cadastro de obra + como a obra ativa aparece
       na hora de registrar), 375px, uma mão
2. [ ] Obra é cadastrada em tela; **nenhum campo de obra exige SQL**. Campos:
       nome, matrícula, cartório, município, CNO, valor do terreno
3. [ ] **CNO é obrigatório.** Se ainda não foi emitido, o cadastro aceita
       "ainda não tenho" e a obra nasce com **pendência de CNO** com a
       consequência escrita — nunca em branco silencioso
4. [ ] `valor_terreno` é capturado com a composição já fixada pelo contador
       (Gate 2): **terreno + ITBI + escritura/registro**, com os três itens
       perguntados separadamente ou a composição explicada em tela
5. [ ] A obra é **editável** depois de criada (CNO, matrícula, valor do
       terreno). O CNO sai depois do início da obra e o ITBI/escritura pode
       ser pago depois da compra do terreno — cadastro imutável obrigaria SQL
       de novo
6. [ ] **N obras cadastráveis** e existe **obra ativa** persistida.
       `carregarObra()` deixa de ser `order by created_at limit 1`
7. [ ] O nome da obra ativa é **visível na tela em que se registra** documento
       e pagamento, e na confirmação de "salvo" — não escondido em menu. Com
       uma obra só cadastrada, ela é pré-selecionada e o seletor não aparece
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
  um número que não existe em nenhuma declaração
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

## Viabilidade (CTO)
- O schema **já comporta N obras**: `obra` tem `id`/`user_id` e `documento` e
  `pagamento` já têm `obra_id` **obrigatório**. Nada precisa nascer para
  múltiplas obras existirem
- Migration nova, pequena: `unidades_autonomas int`, `origem_desmembramento
  boolean`, unique parcial `(user_id, cno) where cno is not null`
- **Onde mora a "obra ativa"** é decisão do `cto-obra`: preferência no banco
  (sobrevive à troca de celular, custa uma tabela) vs. `localStorage` (barato,
  some no celular novo — e "some" aqui significa voltar a registrar na obra
  errada). Minha inclinação de PO é banco, pelo pre-mortem 1; a decisão é dele
- `lib/data.ts::carregarObra()` e `carregarPainel()` mudam de assinatura;
  `lib/fiscal/resumo.ts` já filtra pelo que o painel traz
- Complexidade: **M**

## Dependências
- **Bloqueado por**: CONTAI-002 (sem sessão não há `user_id` para a obra);
  mock aprovado
- **Deploy conjunto obrigatório com CONTAI-002** — release única
- **Bloqueia**: US-004 (discriminação por matrícula, aferição por CNO),
  US-011 (export segmentável por obra), US-012 (rateio)
- **Relacionado**: CONTAI-007 (CNO referenciado na NF de serviço) — sem obra
  cadastrada com CNO não há contra o que validar

## Perguntas Abertas
Ver Q11, Q12 e Q13 no `docs/backlog.md` (Relato 003). **Q12 é a que mais muda
este ticket**: se a segunda obra já tem documento chegando hoje, os critérios
6–9 são urgência de agora; se ela começa em meses, este ticket pode entrar em
produção com uma obra só e o seletor vem depois.

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
  resolver em 375px
- **Veredito: APROVADO** — condicionado a mock aprovado e à resposta da Q12
