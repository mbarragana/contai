# CONTAI-100 Pré-vínculo automático no lote de parcelas com origem

## Tipo e Prioridade
feature — **P1** — fricção de processo real e recorrente, vivida ao vivo
pelo Mateus no padrão de maior volume do produto (fornecedor parcelado).
Não é P0: pré-vínculo nunca é custo, nunca abate a base do INSS e nunca
entra em relatório (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`,
ADENDO 6 §J.1) — não perder isso não gera erro fiscal, só retrabalho. Não é
P2: é pedido direto do Mateus ("vamos fazer já"), não inferência do `po`, e
tem risco concreto de a nota aparecer indevidamente "sem pagamento ligado"
até a confirmação manual.

## Dor de Origem
Relato: `docs/backlog/113-2026-10-20-pre-vinculo-automatico-lote-parcelas-com-origem.md`.

Caso real: Mateus cadastrou a NF 1726 (Ilhamix Concreto Ltda, R$12.340,00) e,
no mesmo ato, registrou o pagamento parcelado no cartão (2x de R$6.170,00)
usando "Registrar o pagamento desta nota" (`CONTAI-099`) → Cartão → "Lançar
as parcelas em lote" (`CONTAI-084`/`089`). Os 2 compromissos salvaram certo
(favorecido, valor, datas), sem nenhum vínculo com a nota — nem
`documento_origem_id` (correto, proibido pelo ADENDO 9), nem pré-vínculo (que
não é proibido, só nunca foi automatizado nesse caminho). Ao abrir depois o
detalhe da nota, pareceu que o pagamento não tinha sido salvo. Citação
literal: *"vamos fazer essa pré vinculação já na hora do registro do
pagamento, não faz sentido, eu registrar um pagamento na nota e depois ter
que fazer novamente."*

## User Story
Como dono da obra, sentado em casa, quando eu chegar em
`/adicionar/compra-cartao/parcelas` a partir de uma nota específica (contexto
de `documento.id` carregado — hoje só pelo caminho `CONTAI-099`, "Registrar
o pagamento desta nota"), quero que cada uma das N parcelas geradas nasça já
com pré-vínculo automático a essa nota, para não ter que abrir cada
compromisso depois e repetir manualmente uma ligação que eu já declarei no
ato de registrar o pagamento.

## Critérios de Aceite
1. [ ] Proposta de design nível 2 em `design/mocks/CONTAI-100.md` (4 estados
   do bloco de pré-vínculo nas Telas 1 e 2 do lote — carregando, nota
   carregada, nota não carregou, obra divergente — mais a bifurcação da
   `Dica` da Tela 3).
2. [ ] Quando `/adicionar/compra-cartao` carrega com `?documento=<id>`
   resolvido para a mesma obra (hoje só alcançável via `CONTAI-099` →
   "Registrar o pagamento desta nota" → Cartão, mas a regra pendura na
   condição real de `compra-cartao/page.tsx` — `origemParaGravar !== null` —
   não num caminho específico, para que o 4º caminho já existente
   (`documento/[id]/corrigir/emitente/page.tsx`, `voltar=compra-cartao`)
   herde de graça), o link "Lançar as parcelas em lote →" propaga esse `id`
   para `/adicionar/compra-cartao/parcelas` como `?documento=<id>`, **além**
   dos 3 textos que o `CONTAI-089` já propaga.
3. [ ] Ao confirmar o lote, se o `?documento=<id>` da URL resolveu para um
   documento válido da mesma obra, cada uma das N linhas de `compromisso`
   recém-criadas recebe, na MESMA transação da RPC `compra_cartao_gravar_lote`
   (migration nova, parâmetro aditivo `p_documento_previsto_id`), uma linha
   correspondente em `compromisso_documento_previsto` apontando para essa
   nota — verificável lendo a tabela depois do lote confirmado.
4. [ ] Nenhuma das N parcelas recebe `documento_origem_id` preenchido em
   nenhuma circunstância — proibição de
   `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` (ADENDO 9),
   que este ticket reforça e não reabre. Verificável por E2E: todas as N
   linhas de `compromisso` têm `documento_origem_id = null`.
5. [ ] O `id` usado para gravar o pré-vínculo é sempre o vigente no momento
   do salvamento efetivo do lote — lido reativamente da URL, nunca congelado
   num estado inicializado uma única vez (ao contrário do texto herdado do
   `CONTAI-089`, que pode ficar como está). Verificável por E2E: abrir
   `/parcelas?documento=A`, navegar (sem salvar) para a mesma rota com
   `?documento=B`, salvar — as N parcelas pré-vinculam exclusivamente à Nota
   B, nenhuma à A.
6. [ ] Antes do salvamento (Telas 1 e 2 do lote), a tela exibe qual nota está
   sendo usada como origem do pré-vínculo (número/tipo, favorecido, valor),
   nos 4 estados especificados em `design/mocks/CONTAI-100.md` §2-3:
   carregando; nota carregada (chip `CHIP_PRE_VINCULO` + identificação da
   nota); nota não carregou (aviso visível, nunca silêncio — lote segue sem
   pré-vínculo, com opção de tentar de novo); obra divergente (aviso visível
   com o texto de `MOTIVO_OBRA_DIFERENTE` — lote segue sem pré-vínculo, não
   bloqueia).
7. [ ] O detalhe da nota de origem passa a listar as N parcelas como
   pré-ligadas (`compromissosQuePreLigam`, `CONTAI-091`), e o chip
   `CHIP_PRE_VINCULO` (variante N=1 do ADENDO 8 §L.2 do parecer) aparece nas
   3 superfícies já existentes (detalhe do compromisso, detalhe da nota,
   seletor de `/pagamento/[id]/ligar`), sem exigir ação manual adicional
   depois do lote salvo.
8. [ ] O pré-vínculo criado continua revisável/desfazível, individualmente
   por parcela, antes da confirmação de pagamento de cada uma, pela tela
   `/pre-vincular` já existente (`CONTAI-080`/`081`) — não existe, neste
   ticket, ação de desfazer o pré-vínculo das N parcelas de uma vez só
   (dívida nomeada no Out of Scope).
9. [ ] Fora do contexto de `documento.id` (lote acessado sem nota de
   origem — caminho atual do `CONTAI-089`), nada muda: zero pré-vínculo
   criado, `documento_origem_id` continua `null`, comportamento idêntico ao
   de hoje — verificável por E2E (`count(compromisso_documento_previsto) = 0`
   para as N linhas do lote).
10. [ ] A `Dica` fixa da Tela 3 (sucesso), que hoje sempre afirma "Nenhuma
    delas está ligada a nota", se bifurca conforme o lote nasceu ou não com
    pré-vínculo (texto exato em `design/mocks/CONTAI-100.md` §4) — para não
    afirmar um fato falso sobre o próprio resultado deste ticket.
11. [ ] Os comentários-guarda existentes que afirmam que esta rota "nunca lê
    `?documento=`"/"não recebe id de documento"
    (`compra-cartao/parcelas/page.tsx` ~linhas 10-28; `compra-cartao/page.tsx`
    ~linhas 288-296 e 631-641; cabeçalho de `texto-herdado.ts`; comentário da
    migration `0026`; comentário de `lib/data.ts:2381`) são reescritos para
    refletir a nova realidade — comentário que afirma uma invariante morta é
    o mesmo defeito que a disciplina fiscal persegue, com outro nome.
12. [ ] Nenhum campo, checkbox ou toggle novo nesta tela oferece "desligar"
    o pré-vínculo automático no ato — é informativo e automático, nunca
    editável nesta tela; desfazer continua sendo só via `/pre-vincular`,
    depois, por compromisso.
13. [ ] `e2e/privilegios.spec.ts` continua verde sem mudança no mapa de
    GRANTs (nenhuma tabela nova; `compromisso_documento_previsto` já tem
    `INSERT` para `authenticated` desde a migration `0023`) — só a entrada de
    `FUNCOES_ESPERADAS` para `compra_cartao_gravar_lote` precisa casar com a
    aridade nova (DROP + CREATE, sem sobrecarga viva da assinatura antiga).
14. [ ] "Lançar outro lote" (rodada > 0) e a fase de sucesso não reaproveitam
    o `?documento=` de uma rodada anterior — mesmo padrão de não-herança que
    o `CONTAI-089`/`071` já aplicam ao texto.

## Out of Scope
- Qualquer mudança em `CONTAI-089` (herança de texto) — continua existindo
  exatamente como está, para o caminho sem documento de origem.
- `documento_origem_id` automático em lote — proibição do ADENDO 9 intocada.
- Fundir as N parcelas num evento fiscal único — fora de escopo desde o
  `CONTAI-084` (`RECUSA_PARCELADO`), não revisitado aqui.
- Mudar a doutrina de N=1 converter sem clique na confirmação (ADENDO 7) —
  este ticket só estende o mesmo mecanismo a uma origem nova de pré-vínculo,
  não redesenha a conversão.
- **Ação de "desfazer pré-vínculo em lote"** (as N de uma vez) — se o
  Mateus mudar de ideia sobre a nota de origem depois de salvar um lote de
  6-7 parcelas (padrão real do `CONTAI-084`/`091`), a correção é
  compromisso por compromisso via `/pre-vincular`. Observação do `contador`:
  não é bloqueio fiscal, é a mesma fricção em sentido inverso — registrado
  para o `po`/`designer` decidirem se vale ticket futuro.
- **Migrar o fluxo individual** (`/adicionar/compra-cartao`, sem lote) de
  `documento_origem_id` para pré-vínculo — dívida nomeada pelo `cto-obra`
  (assimetria entre os dois caminhos), decisão futura do `contador`, não
  decidida aqui.
- Texto fiscal novo de consequência (custo/INSS/relatório) — nenhum é
  inventado; todo texto que toca os três é reuso verbatim de constante já
  existente (`CHIP_PRE_VINCULO`, `MOTIVO_OBRA_DIFERENTE`, variante N=1 do
  ADENDO 8 §L.2). Os textos novos deste ticket são classificados como
  produto (identificação da nota, avisos de carregamento/erro/obra
  divergente, bifurcação da Dica), não consequência fiscal.

## Gate Fiscal (Contador)
Regra completa: `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`
— ADENDO 6 (§J.0-J.5), ADENDO 7 (§K.1-K.5), ADENDO 8 (§L.1-L.4) e ADENDO 9
(§M.0-M.8). Caso real que motivou o ADENDO 9: `docs/tickets/CONTAI-083.md`.

**Ponto 1 — pré-vínculo automático em lote NÃO reabre o ADENDO 9**
`[Certain]`. O pré-vínculo nunca é custo, nunca é nó de `alocarCusto`, nunca
abate INSS, nunca tira a nota de "sem pagamento vinculado" (ADENDO 6 §J.1).
O ADENDO 9 regula a remoção/preenchimento automático de `documento_origem_id`
(campo **fixo e imutável** desde a criação, §M.0) — campo e mecanismo
diferentes do que este ticket toca (nunca escreve `documento_origem_id`,
critério 4). A única cláusula que parece tocar este ticket (§M.2) proíbe
auto-transferir um valor **já suspeito, nunca reexaminado** para
`compromisso_documento_previsto` no mesmo clique de desfazer — o próprio
§M.2 nomeia o que diferencia este caso: *"Essa segunda declaração, feita
depois de olhar o caso de novo, é uma afirmação nova e válida"*. O clique em
"Registrar o pagamento desta nota" partindo do detalhe da própria nota é
esse "olhar de novo".

**Ponto 2 — a conversão automática N=1 (ADENDO 7 §K.2/§K.5) NÃO recria o
CONTAI-083, condicionado aos critérios 5 e 6** `[Certain]` quanto à
distinção estrutural. No `CONTAI-083`, `documento_origem_id` foi fixado em 3
atos de criação **separados no tempo**, herdando sem comparar contra outras
notas hábeis do mesmo favorecido — erro de **correspondência** entre notas
(§M.0: *"sem nunca revalidar contra o executado nem contra as outras duas
notas hábeis do mesmo favorecido"*). Neste ticket, as N parcelas nascem num
**único ato atômico** (o lote), e a nota de origem é a que está sendo olhada
*agora*, sem ambiguidade de "qual nota do fornecedor é esta" (ADENDO 7 §K.1
item 3: o único risco real do N:M é rateio entre documentos, que não existe
aqui — as N parcelas **são** a divisão de uma nota já identificada). A
condição que falta para isso ser seguro, e que se tornou critério de aceite
explícito (não ficou implícita): (a) o `id` usado no salvamento tem que ser
o vigente no instante do salvamento, nunca um valor obsoleto de uma
tentativa anterior (**critério 5**); (b) a tela tem que mostrar qual nota
vai ser pré-vinculada, antes do salvamento, para que o ato de salvar seja
uma afirmação vista (**critério 6**). Sem essas duas garantias existiria um
cenário técnico análogo ao CONTAI-083 (contexto obsoleto sobrevivendo a uma
troca de nota no meio do fluxo, sem o Mateus ver).

**Ponto 3 — regras no formato do projeto**:
1. **Se** o lote é alcançado com `documento.id` presente no contexto no
   momento do salvamento **e** as N parcelas são geradas → o sistema
   **marca** automaticamente uma linha em `compromisso_documento_previsto`
   para cada uma das N parcelas, apontando para essa nota — nunca
   `documento_origem_id`.
2. **Se** o lote é alcançado sem `documento.id` no contexto → nada muda:
   zero pré-vínculo criado.
3. **Se**, depois do lote salvo, a confirmação de pagamento de uma das N
   parcelas ocorrer e o conjunto de documentos pré-vinculados a ela resolver
   para N=1 **e** nenhum vínculo já existir em `pagamento_documento` → o
   sistema **marca** automaticamente o vínculo formal, sem clique adicional
   (ADENDO 7 §K.2) — doutrina já em produção, não criada por este ticket.
4. **Se** o Mateus, antes de qualquer confirmação, editar o pré-vínculo de
   uma parcela em `/pre-vincular` → o sistema **revalida** o N na próxima
   renderização (ADENDO 8 §L.3) e, se N passar a ≥2, **exige confirmação
   explícita** na hora do pagamento em vez de marcar sozinho.
5. **Se** a tela do lote gerar as N parcelas sem exibir, antes de salvar,
   qual nota está sendo usada como origem → **recusar** o desenho (critério
   de aceite, não recusa de runtime — ver critério 6).
6. **Se** o `documento.id` do contexto mudar entre o início e o salvamento
   do lote (reentrada por outra nota sem ter salvo a primeira) → o sistema
   grava o pré-vínculo usando o `documento.id` **vigente no momento do
   salvamento**, nunca um valor obsoleto — garantido por teste (critério 5).

**Ponto 4 — automático × humano**:
- **Sistema sozinho**: gravar os N pré-vínculos ao salvar o lote (lendo o
  `id` no momento do salvamento); manter os N pré-vínculos fora de toda
  soma, fora do grafo de `alocarCusto`, fora de todo relatório; exibir o
  chip/texto nas 3 superfícies existentes, variante N=1; marcar
  automaticamente o vínculo formal na confirmação futura quando resolver
  para N=1 sem vínculo prévio (comportamento herdado, não novo).
- **Só o Mateus**: decidir, antes de cada confirmação de pagamento, se o
  pré-vínculo automático daquela parcela ainda corresponde ao que ele quer
  pagar (via `/pre-vincular`); desfazer/trocar o pré-vínculo parcela por
  parcela, se mudar de ideia; confirmar explicitamente qual documento
  corresponde ao pagamento quando a confirmação resolver para N≥2.

**Nada aqui exige CRC** — extensão do mesmo arcabouço dos ADENDOS 6/7/8,
nenhum número ou tese de legislação nova.

## Pre-mortem
1. **Gatilho de contexto vaza para caminhos que não deveriam ter
   `documento.id`.** Se a regra tivesse ficado pendurada só no caminho
   `CONTAI-099`, um caminho futuro (ou o 4º caminho já existente,
   `documento/[id]/corrigir/emitente/page.tsx`) poderia chegar ao lote com
   `documento.id` sem a intenção de pré-vincular. Mitigado pelo critério 2:
   a regra pendura na condição real de `/adicionar/compra-cartao`
   (`origemParaGravar !== null`), não num caminho nomeado — qualquer entrada
   futura herda a mesma regra de graça, sem precisar de um novo ticket.
2. **N=1 convertendo sem clique reabre, na prática, o que o ADENDO 9/
   CONTAI-083 corrigiu**, se o Mateus trocar de nota no meio do fluxo do
   lote sem o contexto antigo ser descartado. Mitigado pelos critérios 5
   (id sempre vigente, nunca congelado) e 6 (nota exibida antes de salvar) —
   ambos exigidos pelo Gate Fiscal, não apenas sugeridos.
3. **Pré-vínculo "grátis" em lote reduz a checagem manual que antes
   existia.** A automação remove a fricção que antes forçava revisão. Se o
   chip/texto não deixar claro que N parcelas foram pré-vinculadas
   automaticamente, o Mateus pode confirmar pagamentos em lote assumindo
   que "já está tudo certo" sem checar exceções. Mitigado pelos critérios 6
   (aviso antes de salvar) e 7 (chip visível nas 3 superfícies depois) — a
   revisão continua disponível, só deixa de ser obrigatória para o caso
   comum (N=1, nota correta).

## Viabilidade (CTO)
- **Modelo de dados**: nenhuma tabela/coluna nova.
  `0032_compra_cartao_lote_pre_vinculo.sql` substitui (DROP + CREATE) a RPC
  `compra_cartao_gravar_lote` com parâmetro aditivo
  `p_documento_previsto_id uuid default null` (default só no banco, para a
  janela `db push` → deploy; em TypeScript o campo correspondente é
  obrigatório, sem default). Guarda de servidor nova: se o parâmetro não for
  nulo e não existir `documento` com esse id na mesma obra → `raise`, nada
  gravado (segunda camada da mesma regra que o cliente já checa).
- **Por que dentro da RPC, na mesma transação, e não como chamada JS
  separada**: a alternativa (RPC do lote + `upsert` de N pares depois) não é
  atômica — uma falha entre as duas chamadas deixaria o lote gravado e zero
  pré-vínculo, reproduzindo exatamente a dor do relato ("pareceu que não
  tinha salvo"), agora com a tela de sucesso mentindo. Não contraria a
  doutrina do `CONTAI-081` (RPC não decide, só executa): a decisão (qual
  `id`, obra bate) é tomada em JS por `podeVincular` antes da chamada; a RPC
  só insere o par já autorizado N vezes — mesmo padrão de
  `p_propagar_origem_ids` da migration `0024`.
- **GRANT**: nenhum ajuste necessário. A RPC é `security invoker`, roda como
  `authenticated`, que já tem `INSERT` em `compromisso_documento_previsto`
  (migration `0023`) e `SELECT` em `documento`; a policy (`auth.uid()` =
  dono do compromisso) passa porque os N compromissos nascem na mesma
  transação, pelo mesmo usuário. `e2e/privilegios.spec.ts`: mapa de tabelas
  intocado; a entrada de `FUNCOES_ESPERADAS` para `compra_cartao_gravar_lote`
  só precisa casar com a aridade nova (sem sobrecarga viva da assinatura
  antiga — por isso DROP + CREATE, não `create or replace`, mesmo precedente
  das migrations `0017`/`0021`/`0024`).
- **Transporte do contexto** (resposta à pergunta 1 do relato): hoje nenhum
  `documento.id` chega a `/adicionar/compra-cartao/parcelas` — o
  `CONTAI-089` cortou isso de propósito, com comentários explícitos ("esta
  rota nunca lê `?documento=`"). Existem **4 caminhos** que hoje chegam a
  `/adicionar/compra-cartao?documento=<id>` (não só o `CONTAI-099`): o CTA do
  detalhe do documento (`documento/[id]/page.tsx:362`), a confirmação da
  captura (`adicionar/documento/page.tsx:1214`), `documento/[id]/ligar/
  page.tsx:585`, e um 4º não citado no relato — `documento/[id]/corrigir/
  emitente/page.tsx:177` (`voltar=compra-cartao`). Por isso a regra deste
  ticket pendura na condição de `/adicionar/compra-cartao` ter
  `origemParaGravar !== null`, não num caminho nomeado (critério 2) — os 4
  caminhos herdam de graça, e qualquer caminho futuro também.
- **Granularidade do pré-vínculo** (resposta à pergunta 2 do relato): por
  parcela, sem alternativa no modelo. A tabela `compromisso_documento_previsto`
  (migration `0023`) tem PK composta `(compromisso_id, documento_id)`, sem
  conceito de lote/série persistido; `Compromisso.documentoPrevistoIds` é por
  compromisso; toda a resolução de N (`idsDaUniaoDoPreVinculo`,
  `documentosResolvidosNaConfirmacao`, `planoDeConversaoDaFatura`) já opera
  por compromisso individual. Resultado: N linhas, todas com o mesmo
  `documento_id` — soma livre do ADENDO 6 §J.4, sem trava.
- **Garantia de id vigente** (critério 5 do Gate Fiscal): a leitura do
  `?documento=` em `/parcelas` tem que ser derivada da URL a cada
  renderização (via `useSearchParams`, não copiada para um `useState`
  inicializado uma única vez, como o texto do `CONTAI-089` faz
  deliberadamente) — Next 16 não remonta o segmento ao navegar para a mesma
  rota com query diferente, então um estado congelado sobreviveria à troca.
  A nota correspondente é carregada por esse id reativo e exibida (critério
  6); no momento do salvamento, o `id` só entra se a nota carregada ainda
  corresponder ao id atual da URL e a obra bater.
- **Arquivos prováveis**: `supabase/migrations/0032_compra_cartao_lote_pre_vinculo.sql`
  (novo); `lib/data.ts` (`NovoLoteCompraCartao` ganha campo obrigatório de
  documento previsto + chamada a `podeVincular` antes da RPC);
  `lib/database.types.ts` (regen); `app/(captura)/adicionar/compra-cartao/page.tsx`
  (`hrefDoLote` passa a incluir `?documento=<id>` condicionalmente);
  `app/(captura)/adicionar/compra-cartao/parcelas/page.tsx` (novo efeito de
  carregamento da nota, os 4 estados do mock, gate de salvamento);
  `app/(captura)/adicionar/compra-cartao/texto-herdado.ts` (só cabeçalho —
  contrato "texto" continua, o id viaja por fora); comentários reescritos em
  `supabase/migrations/0026_compra_cartao_lote.sql` e `lib/data.ts:2381`
  (não editar SQL já aplicado — só o comentário aponta para a `0032`);
  `e2e/cartao-lote.spec.ts` (3 casos novos: caminho com nota de origem,
  cenário A→B do critério 5, lote sem `?documento=` com contagem zero);
  `design/mocks/CONTAI-100.md` (já escrito).
- **Complexidade: M.** Migration pequena mas com DROP+CREATE de função em
  produção, 2 telas tocadas, 3 E2E novos, e reescrita de ~5 comentários que
  afirmavam uma invariante que este ticket derruba de propósito.
- **Dívidas criadas/nomeadas**:
  1. Assimetria entre o fluxo individual (`/adicionar/compra-cartao`, grava
     `documento_origem_id`, imutável) e o lote (grava pré-vínculo, editável)
     — convergem na mesma linha de `pagamento_documento` na confirmação, mas
     com regras de desfazer diferentes. Não é deste ticket.
  2. "Lançar outro lote" nunca herda contexto de documento (critério 14) —
     correto pelo padrão existente, mas pode surpreender quem espera a 2ª
     série do mesmo fornecedor herdar também.
  3. A garantia estrutural "a rota nunca recebe id" do `CONTAI-089` deixa de
     existir; o único guardião da disciplina fica sendo o nome do parâmetro
     (`previsto`, nunca `origem`) + os E2E novos — garantia mais fraca que a
     anterior, registrada aqui, não escondida.
  4. Corrida entre abas no pré-vínculo (mesma dívida nomeada no `CONTAI-081`)
     continua, sem agravamento.

## Dependências
- Bloqueado por: nenhum (`CONTAI-080`/`081`/`084`/`089`/`091`/`099` já
  entregues).
- Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma pergunta fiscal ou técnica sem resposta fechada. Três observações de
produto ficam registradas para decisão futura do `po` (não bloqueiam este
ticket, ver Out of Scope): ação de desfazer pré-vínculo em lote (as N de uma
vez); migrar o fluxo individual de `documento_origem_id` para pré-vínculo
(assimetria nomeada pelo `cto-obra`); "Lançar outro lote" não herdar
contexto de documento.

## Cenário e checagem final
**Gestão** (em casa, sentado) — mesmo cenário que o próprio código de
`compra-cartao/parcelas/page.tsx` já declara (comentário de topo: "Teste do
Canteiro não se aplica"). O delta é um bloco informativo a mais dentro do
`COLUNA_DO_FORMULARIO` já existente (~430px) na Tela 1 e um `Card` extra na
Tela 2 (tela larga, com tabela) — não exige layout novo nem tratamento
desktop novo, apesar da permissão de 2026-09-22 estar disponível para
`/adicionar/*`.

Serve a meta 1 do produto ("nenhum pagamento sem documento hábil"): reduz o
risco de uma nota já paga em parcelas ficar com os compromissos criados mas
sem nenhum rastro de vínculo visível, parecendo "sem pagamento" até a
confirmação manual.

Varredura de condição fiscal órfã (`grep -rniE` do `/tickets-req`): todas as
condições de obrigação/proibição tributária citadas neste ticket apontam
para `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` (ADENDOS
6/7/8/9) na mesma frase — nenhum achado órfão.

Veredito: **APROVADO**. Pronto para `/develop`.

---

## Design (nível 2)
Spec completo em `design/mocks/CONTAI-100.md`. 4 estados do bloco de
pré-vínculo (carregando / nota carregada / nota não carregou / obra
divergente) nas Telas 1 (`formulario`) e 2 (`revisao`) do lote de parcelas,
usando `CHIP_PRE_VINCULO` e `MOTIVO_OBRA_DIFERENTE` verbatim; texto novo de
produto (identificação da nota, avisos) sem reproduzir a consequência fiscal
completa do ADENDO 8 §L.2, que continua restrita às 3 superfícies do
`CONTAI-091`. Achado adicional fora do mandato original: a `Dica` fixa da
Tela 3 (sucesso) bifurca para não afirmar "nenhuma ligada a nota" quando o
lote nasceu pré-vinculado. Cenário gestão (ver "Cenário e checagem final").
Sem campo fiscal novo, sem toggle de "desligar" pré-vínculo.
