# CONTAI-018 — Vínculo pagamento↔nota no ato do registro

## Tipo e Prioridade

feature (fiscal + usabilidade) — **P0**. **Posição: 1º da fila da R1.**

É a US-003 do backlog, promovida a bloqueador da meta 1. Prioridade alta pedida
pelo Mateus em 2026-08-18.

- **Gate 0 (mock)**: **OBRIGATÓRIO — PENDENTE.** Ver seção própria.
- **Gate Fiscal**: **FECHADO** — parecer do `contador` de 2026-08-16 (as regras
  estão transcritas abaixo e são normativas para a implementação).

## Dor de Origem

> "isso torna a usabilidade do app muito ruim, fico com coisas duplicadas
> referente a mesma coisa e não tem um link para acessar a página /adicionar o
> que é um absurdo" — Mateus, 2026-08-18

Caso real que originou o relato: NF de **R$ 3.000 da WK** registrada, o PIX
correspondente registrado como pagamento avulso, e a home mostrando **"Custo
confirmado R$ 0,00"** com os dois registros aparecendo separados na tela — a
mesma despesa contada como duas coisas, nenhuma delas virando custo.

Três defeitos distintos no mesmo sintoma:

1. **Não existe caminho na interface para vincular — e o app promete que existe.**
   `app/adicionar/pagamento/page.tsx:154` e `app/adicionar/documento/page.tsx:206`
   prometem literalmente "(em breve — US-003)". A promessa venceu.
   **Pior: a promessa também está na tela `/adicionar`**, no momento exato da
   decisão de registrar (print do Mateus, 2026-08-18):
   > *"Pagamento — PIX sem nota. Pagou e o documento ainda não existe? Registra
   > agora; **a NF vincula depois**."*
   **Não vincula.** Texto de produto que afirma um comportamento inexistente é
   pior que ausência de funcionalidade: ele ensina o usuário a confiar num
   mecanismo que não vai acontecer, e o passivo de registros soltos cresce com o
   consentimento dele. **Critério 19.**
   Segundo achado do mesmo print: o rótulo **"PIX sem nota"** enquadra o
   pagamento como exceção, quando no caso do Mateus a nota costuma existir — ele
   só não tem onde dizer isso. O rótulo empurra para o caminho errado.
2. **O cálculo colapsa "não demonstrável" em "inexistente".**
   `lib/fiscal/resumo.ts:78` — `if (pagamento.status !== "conciliado") return false`.
   Como nada cria vínculo, todo pagamento é `aguardando_nf` e o custo confirmado
   é estruturalmente R$ 0,00.
3. **Navegação.** O FAB `+ Adicionar` existe **só na home**
   (`app/page.tsx:213-219`). Nenhuma outra tela leva a `/adicionar`:
   `app/documento/[id]/page.tsx` oferece apenas "Voltar ao início". **Isso é fato
   verificado.** Se o FAB também não aparece na home do aparelho dele, é um
   segundo defeito, e a causa não está determinada — ver critério 12.

Dores de backlog atendidas: D2 (pago sem nota), D9 (correção sem SQL), R5 do
parecer do CONTAI-005 ("Custo confirmado R$ 0,00" sem ressalva é falso).

## Gate Fiscal (Contador) — FECHADO em 2026-08-16

Transcrito do parecer. **Nada aqui é negociável em implementação.**

1. **O vínculo entre dispêndio e documento é requisito fiscal** — condição 3 do
   art. 17 da IN SRF 84/2001; a palavra é *"correspondente"*. **Mas o clique em
   "conciliar" não é requisito fiscal**: é só como o app toma conhecimento de uma
   correspondência que já existe no mundo. **O custo existe fiscalmente antes de
   qualquer clique.**
2. **São três estados, não dois**: (a) custo comprovado — par completo;
   (b) **custo real que o app não consegue demonstrar**; (c) custo inexistente.
   **O defeito de hoje é colapsar (b) em (c).**
3. **`sustentaCusto` não deve consultar `pagamento.status`.** A condição fiscal é
   *existe vínculo em `pagamento_documento` com documento hábil*.
   `status = 'conciliado'` passa a ser **derivado**, nunca pré-requisito.
4. **Custo comprovado de um par = mínimo entre a soma dos pagamentos vinculados e
   a soma dos documentos hábeis vinculados.** O excedente de cada lado cai na
   coluna correspondente — pagou mais do que a nota, o excedente é "pago sem
   nota".
5. **Proibido inferir vínculo por heurística** ("mesmo favorecido, mesmo valor").
   Sugere, **nunca vincula sozinho**.
6. **Documento em quarentena vinculado não produz custo confirmado.**

## User Story

**Como** dono da obra, no canteiro, de celular e com uma mão livre,
**quando** a nota da empreiteira chega no WhatsApp e eu já paguei o PIX (ou o
contrário),
**quero** ligar os dois com um toque, na tela onde já estou,
**para que** o custo apareça como confirmado na discriminação anual e a despesa
pare de aparecer duas vezes.

## Critérios de Aceite

### Os dois caminhos

1. [ ] **Caminho A — no registro do documento**: o formulário de
   `/adicionar/documento` oferece **"já paguei esta nota"**. Marcando, o Mateus
   escolhe entre pagamentos já registrados e/ou registra o pagamento ali mesmo.
   Salvar cria documento + vínculo em uma operação: se o vínculo falhar, a tela
   diz que o documento ficou **sem vínculo** e mostra como completar — nunca fica
   um sucesso mentiroso.
2. [ ] **Caminho B — a partir do documento já registrado** (é o caso do Mateus
   **hoje**, com a NF da WK): `/documento/[id]` ganha a ação **"registrar
   pagamento desta nota"**, que leva a: selecionar pagamentos já registrados **ou**
   registrar um novo pagamento já vinculado. A ação aparece em todo documento
   hábil sem cobertura total, inclusive quando alcançado pela pendência da home.
3. [ ] **A partir do pagamento**: `/pagamento/[id]` (ou o cartão "pago sem nota"
   da home) leva ao mesmo seletor, no sentido inverso. Sem isso, a metade do
   parque de registros que nasceu como PIX continua sem porta.

### O cálculo (Gate Fiscal)

4. [ ] `sustentaCusto` **não lê `pagamento.status`**. Lê o vínculo. Teste
   unitário com um pagamento `status = 'aguardando_nf'` vinculado a documento
   hábil: **sustenta custo**. E um `status = 'conciliado'` sem vínculo: **não
   sustenta**.
5. [ ] **Custo comprovado = min(Σ pagamentos, Σ documentos hábeis)** do conjunto
   vinculado. Testes unitários com, no mínimo: 1↔1 igual; pagamento > nota
   (excedente vira "pago sem nota"); nota > pagamento (excedente **não** vira
   custo — regime de caixa, sem desembolso não há dispêndio); N pagamentos ↔ 1
   nota; 1 pagamento ↔ N notas.
6. [ ] ⚠️ **O mínimo é calculado por componente conexo do grafo
   `pagamento_documento`, não par a par.** Cinco PIX ligados à mesma NF são **um**
   conjunto; somar par a par conta a mesma nota cinco vezes. **Teste explícito
   deste caso.**
7. [ ] `status = 'conciliado'` é **gravado como consequência** do vínculo e não é
   lido por nenhum cálculo fiscal. Grep no código: nenhuma decisão de custo
   condicionada a `status`.
8. [ ] **Documento em quarentena pode ser vinculado** (o vínculo é o que permite
   a dedup do headline do CONTAI-005) **e não produz custo confirmado**. A tela
   diz isso na hora do vínculo, com o texto do parecer.
9. [ ] **Boleto vinculado não produz custo confirmado** — não é documento hábil.
   Vincular é permitido (é a prova de que o boleto foi pago); a máquina de estados
   completa do boleto fica fora deste ticket.
10. [ ] **Sugestão nunca vincula.** O seletor pode ordenar candidatos por
    favorecido/valor/data e rotulá-los como **sugestão**, mas nenhum vínculo é
    criado sem toque explícito, e nenhum candidato vem pré-marcado.
11. [ ] **Vínculo só entre registros da mesma obra.** Nada soma entre obras (Q9b).
    Tentativa entre obras diferentes é recusada com o motivo na tela.

### Interface, navegação e reversão

12. [ ] **`/adicionar` é alcançável de toda tela principal.** Investigar as duas
    hipóteses do FAB — (a) não renderiza no aparelho dele; (b) renderiza onde ele
    não olha — **sem presumir qual**, mexendo em `sticky bottom-0 mt-auto self-end`
    dentro de `Corpo` (`overflow-y-auto` em `h-dvh`) se for o caso. Verificação:
    E2E em `devices["iPhone SE"]` (375px) com a home em **duas condições —
    conteúdo curto e lista longa de pendências rolada até o meio** — afirmando que
    o alvo está visível e clicável; e ao menos um acesso a `/adicionar` partindo
    de `/documento/[id]`. **Confirmar no aparelho real do Mateus antes do DONE** —
    o simulador não reproduz PWA standalone nem safe-area.
13. [ ] **A despesa vinculada aparece uma vez.** Depois do vínculo, home e listas
    mostram **um** item (par), não a NF e o PIX lado a lado. Este é o critério que
    responde à palavra "duplicadas" do relato.
14. [ ] **Nunca mais "Custo confirmado R$ 0,00" mudo.** Se o custo confirmado for
    zero havendo pagamento ou documento registrado, a tela diz **por quê** e o que
    resolve — o terceiro estado (b) do Gate Fiscal fica visível como "gasto real
    ainda sem vínculo", nunca como ausência de gasto.
15. [ ] **Desvincular pela interface**, com confirmação e com o efeito no custo
    dito antes do toque. Vínculo errado infla custo de aquisição, que vai para a
    declaração; correção que exige SQL é a dor D9 de volta.
16. [ ] **E2E contra o Postgres local** (regra dura do projeto), cobrindo os
    caminhos A e B ponta a ponta e conferindo as linhas gravadas em
    `pagamento_documento` com o mesmo client autenticado — a RLS `dono_vinculo` da
    migration 0001 tem que valer para o teste também.

### Os registros que já existem

17. [ ] **Nenhum backfill automático, nenhuma heurística retroativa** (Gate
    Fiscal, item 5). Os registros de hoje permanecem exatamente como estão:
    documentos sem vínculo e pagamentos `aguardando_nf`.
19. [ ] **Nenhuma tela promete comportamento que não existe.** Auditar os textos
    de `/adicionar`, `/adicionar/documento` e `/adicionar/pagamento`: as frases
    "a NF vincula depois" e "(em breve — US-003)" ou passam a ser verdade (este
    ticket), ou saem. **Enquanto o ticket não fechar, a frase é removida** — é
    edição de uma linha e para de fabricar confiança falsa hoje.
    E o rótulo **"Pagamento — PIX sem nota"** é reavaliado: ele enquadra como
    exceção o caminho que o Mateus usa quando a nota existe e ele não tem onde
    dizer.

18. [ ] Existe uma **fila de conciliação pendente** — a lista dos registros sem
    vínculo, com os candidatos sugeridos — para o Mateus limpar o passivo (a NF da
    WK inclusive) em uma sessão, sem caçar registro por registro.

## Diretriz de desenho (Mateus, 2026-08-18)

**As duas entradas de `/adicionar` FICAM.** Documento e Pagamento continuam
separados — a correção é de **rótulo e de escopo do formulário**, não de
arquitetura de navegação.

*(Registro de percurso: eu propus colapsar as duas numa porta única "registrar
gasto". **Foi excesso meu** — ele pediu troca de texto. A diretriz abaixo é a
dele.)*

### D1 — o rótulo perde a negativa

**"Pagamento — PIX sem nota"** vira **"Pagamento"**, e só.

O rótulo atual enquadra o caminho como exceção ("sem nota") e empurra para fora
quem tem nota. A nota deixa de ser o que define a entrada e passa a ser **campo
opcional dentro do registro de pagamento** — que é o vínculo deste ticket,
oferecido no lugar certo.

Some junto a frase *"Pagou e o documento ainda não existe? Registra agora; a NF
vincula depois"* (critério 19): ela deixa de descrever o caminho quando a nota
é opcional ali dentro.

### D2 — pagamento futuro é registro legítimo, e conta pela data de execução

Palavras dele: *"o pagamento pode ser um registro para futuro ou já feito, isso
será contabilizado pela data de execução"*.

Consequência que o ticket tem de carregar, e ela **não é de interface**:

⚠️ **Pagamento com data futura NÃO é dispêndio e NÃO pode compor custo até ser
executado.** Regime de caixa — sem desembolso não há dispêndio (art. 17; e é a
mesma regra que já mantém boleto fora do custo). Um pagamento agendado que
componha custo confirmado é **custo inflado indo para a declaração**, que o
`contador` classificou como o único erro que gera passivo tributário.

Portanto o registro de pagamento passa a ter **dois estados e possivelmente duas
datas**: *previsto* (data planejada, não conta) e *executado* (data real do
débito, conta). **A data que vale é sempre a da execução**, nunca a do
planejamento — mesma disciplina de "contrato é previsão; extrato é fato" do
parecer do terreno financiado.

**Pergunta em aberto ao `contador`** (Gate Fiscal deste ticket fica reaberto
neste ponto):

1. O pagamento previsto e o executado são **um registro que muda de estado** ou
   **dois registros**? Se for um, o que impede a data planejada de virar a data
   de custo por descuido?
2. Quando a data prevista passa **sem confirmação**, qual é o comportamento — o
   app pergunta, marca pendência, ou fica calado? Pagamento previsto e nunca
   confirmado que some da tela é dinheiro que sai da obra sem registro.
3. O comprovante continua **obrigatório na execução**? (Hoje é obrigatório no
   registro; com previsão, não existe comprovante ainda.)

**Isto se junta à US-002** (fila de boletos a pagar com lembrete) — que é
exatamente "documento que chega antes do pagamento". Avaliar com o `po` se a
US-002 ainda é ticket separado depois desta diretriz.

## Gate 0 — mock

**Obrigatório.** É formulário novo em tela de canteiro, e o seletor de candidatos
é a peça mais difícil do produto até aqui: lista de escolha múltipla, com
dinheiro, com uma mão, no sol.

**Escopo mínimo do mock (5 estados, 375px):**

1. `/documento/[id]` com a ação do caminho B (a tela da NF da WK).
2. **O seletor de pagamentos candidatos** — valor de cada candidato, o que é
   sugestão e o que não é, e o **saldo restante do documento atualizando** à
   medida que se marca.
3. **Estado vazio do seletor**: nenhum candidato → "registrar o pagamento agora".
4. **Depois do vínculo**: o par com o custo comprovado, e **o excedente de cada
   lado nomeado** (o caso "paguei R$ 3.500 numa nota de R$ 3.000").
5. **Home com o terceiro estado** (critério 14) e **a posição do acesso a
   `/adicionar`** (critério 12).

Fora do mock: extração automática; a fila de conciliação em massa (critério 18)
pode ser wireframe ASCII.

## Out of Scope

- **Valor por vínculo (rateio explícito).** A regra do mínimo do Gate Fiscal
  torna isso desnecessário nesta rodada. Se o mínimo se mostrar insuficiente em
  uso real, volta como ticket próprio — não se antecipa.
- **Máquina de estados completa do boleto** (registrado → pago → NF chegou).
- **Extração automática de NF/comprovante** — fase 2 da US-008.
- **Conciliação bancária por OFX** — não é vínculo documento↔dispêndio.
- **Cobrança do empreiteiro pela nota que falta** — comunicação com empreiteiro é
  fora de escopo declarado do produto.

## Pre-mortem

1. **O mínimo é calculado par a par e a mesma nota é contada N vezes** — custo
   inflado que vai para a declaração, cobrado com multa. É o risco nº 1.
   **Mitigação**: critério 6.
2. **`status` volta a ser pré-requisito por outra porta** — alguma tela ou query
   nova filtra por `conciliado` e o defeito de hoje ressurge com outro rosto.
   **Mitigação**: critérios 4 e 7.
3. **A sugestão vira vínculo com um toque acidental** no canteiro, o custo sobe
   sozinho e ninguém vê. **Mitigação**: critérios 10 e 15.
4. **O FAB é "corrigido" no simulador e continua invisível no aparelho dele** — a
   causa real era safe-area/PWA e o ticket fecha com a dor viva. **Mitigação**:
   critério 12, confirmação no aparelho real.
5. **O seletor fica bom no desktop e impraticável com uma mão** — ele para de
   conciliar e o passivo cresce. **Mitigação**: Gate 0.

## Viabilidade (CTO)

- **Modelo de dados**: `pagamento_documento` **já existe** (migration 0001, PK
  composta, RLS `dono_vinculo`) e já é lido em `lib/data.ts`. A migration 0005 já
  concedeu os grants das cinco tabelas — **nenhuma migration nova esperada**; se
  surgir, ela responde à pergunta do incidente de 2026-08-17 (*isto depende de
  algum default do stack local que o remoto não tem?*).
- **Arquivos prováveis**: `lib/fiscal/resumo.ts` (o cálculo — mudança central),
  `lib/data.ts` (criar/apagar vínculo), `app/adicionar/documento/page.tsx`,
  `app/adicionar/pagamento/page.tsx`, `app/documento/[id]/page.tsx`,
  `app/pagamento/[id]/`, `app/_components/ui.tsx` (navegação), telas novas do
  seletor.
- **Complexidade: M/L.** O grafo N:M com mínimo por componente conexo é a parte
  onde o bug caro mora; o resto é formulário.

## Dependências

- **Bloqueado por**: Gate 0 (mock aprovado pelo Mateus).
- **Bloqueia**: `CONTAI-005` — a dedup do headline só opera sobre vínculo
  explícito, e hoje ela roda sobre conjunto vazio.
- **Atenção — dívida registrada no Gate 4 do CONTAI-002**: o E2E do login preenche
  `/adicionar/pagamento` campo a campo. Mexer nesse formulário **quebra um teste
  de login**, e o sintoma vai parecer regressão de autenticação. Não é.
- **Relacionado**: `CONTAI-008` (mover registro entre obras não pode quebrar o
  vínculo em silêncio) — o critério 11 daqui é a metade preventiva disso.

## Perguntas Abertas

1. **A fila de conciliação pendente (critério 18) entra nesta rodada ou vira
   ticket próprio?** Ela é o que resolve o passivo já criado; sem ela, o Mateus
   ganha o mecanismo e não ganha a limpeza.
2. **Quantos registros sem vínculo existem hoje de verdade?** Muda se o critério
   18 é uma lista simples ou uma tela com filtro.
3. **O FAB aparece na home do aparelho dele — sim ou não?** Uma foto da tela
   decide entre as duas causas antes de alguém mexer em CSS.

## Teste do Canteiro

- **Metas atendidas**: 1 (nenhum pagamento sem documento hábil) e 2 (relatórios
  anuais) — diretamente. É o ticket que faz a meta 1 existir.
- Uma mão, com pressa: o seletor é o ponto de risco; o Gate 0 é o que protege.
- **Veredito: APROVADO como P0, 1º da fila.**
