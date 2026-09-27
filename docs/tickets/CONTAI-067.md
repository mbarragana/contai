# CONTAI-067 Extrato da fatura do cartão — o elo compra↔fatura ganha documento de terceiro

## Tipo e Prioridade
feature — **P0 fiscal**. O ADENDO do parecer fiscal desta rodada classifica o
requisito explicitamente como "gate fiscal novo, não conveniência de
produto": falta documento de terceiro que amarre qual compra estava dentro
de qual fatura, e essa associação é o que decide em qual ano-calendário o
gasto entra na ficha Bens e Direitos (regime de caixa, IN SRF 84/2001
art. 17). O ADENDO 2 (cor/gravidade) confirma **vermelho**, mesma classe do
"Nota sem arquivo" do `CONTAI-033`.

## Dor de Origem
Entrada de origem do relato: `docs/backlog/80-2026-09-26-comprovante-fatura-e-agendamento-retroativo-cartao.md`.
A dor específica deste ticket nasce do **ADENDO** de 2026-09-26 ao parecer
`docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md`, escrito
depois que o Mateus leu o corpo original e perguntou:

> *"mas o que comprova que aquele pagamento foi pago em tal fatura se não
> tem o comprovante único do pagamento?"*

O ADENDO expôs que a associação compra↔fatura hoje é sustentada só pela
autodeclaração do próprio Mateus (o campo `vencimento da fatura` digitado ao
registrar a compra) — nenhum dos dois documentos hoje capturados (NF do
favorecido, comprovante do pagamento da fatura) prova QUAL fatura cobriu
QUAL compra. Achado técnico que confirma a lacuna: nem `fatura` nem
`fatura_desembolso` têm hoje campo de documento próprio da fatura em si; só
existe `fatura_desembolso.comprovante_path`, que prova a saída de caixa
agregada, não a composição.

## User Story
Como dono da obra que concilia pagamentos de cartão em casa, sentado
(cenário gestão), quando confirmo que uma fatura foi paga — ou, depois, ao
revisitar uma fatura já paga sem esse documento — quero anexar o **extrato
da fatura** (PDF itemizado emitido pela administradora do cartão, documento
de terceiro distinto do comprovante de pagamento) para que a fatura tenha,
além da minha própria digitação, um documento que prove quais compras
estavam dentro dela — fechando o elo que hoje só existe como afirmação minha
no banco de dados, e que decide o ano-calendário do custo.

## Critérios de Aceite
1. [x] Proposta nível 2 em `design/mocks/CONTAI-067.md` fechada — layout dos
   dois pontos de tela do critério 2 e 5, com rótulos que não confundam
   "extrato da fatura" com "comprovante do pagamento".
2. [x] Em `/fatura/[id]/confirmar`, um segundo `CampoArquivo`, empilhado
   abaixo do "Comprovante da fatura" já existente, rotulado **"Extrato da
   fatura (emitido pelo cartão)"** — distinto do rótulo "Comprovante do
   pagamento" do campo já existente — captura o extrato. Texto de ajuda
   (composição × saída de caixa) copiado do ADENDO, nunca reescrito.
3. [x] O upload do extrato acontece **no mesmo ato** de "Confirmar
   pagamento" (mesma chamada de `subirParaAcervo` antes da RPC, mesma
   transação de gravação) — nunca dois passos separados, para não deixar o
   desembolso gravado com o extrato perdido em caso de falha parcial.
4. [x] O extrato é **opcional** na gravação — nunca bloqueia "Confirmar
   pagamento" nem "Registrar pagamento parcial" (mesma disciplina de "nunca
   recusa o fato consumado" do `fatura_desembolso`, parecer original §1). A
   ausência vira pendência vermelha visível (critérios 8-10), nunca um
   silêncio.
5. [x] `/fatura/[id]` (tela de detalhe) ganha um bloco "Extrato da fatura":
   mostra o documento já anexado (link ao acervo) ou, quando ausente **e** a
   fatura já tem ao menos um `fatura_desembolso`, o upload inline (chama a
   RPC do critério 7). É o ponto único de anexo tardio e do caminho
   rotativo — nem `/parcial` nem `/alocar` ganham campo de extrato próprio
   (critério 6).
6. [x] `/fatura/[id]/parcial` **não** ganha campo de extrato — pedir o
   documento a cada pagamento parcial da mesma fatura duplicaria a entrada
   do mesmo documento (a administradora emite um extrato por CICLO, não por
   desembolso). Mantém-se sem `CampoArquivo` nenhum, como hoje.
7. [x] Coluna nova `fatura.extrato_path` (`text`, nullable) — nunca em
   `fatura_desembolso`: um extrato serve TODOS os desembolsos (integrais ou
   parciais) da mesma fatura, mesmo grão do comprovante de pagamento, mas em
   cardinalidade 1:1 com a fatura, não 1:N.
8. [x] Migration concede **`grant update (extrato_path) on table fatura to
   authenticated`** — grant de COLUNA, nunca de tabela inteira (`fatura` só
   tem `select, insert` de propósito: `data_vencimento` é a chave natural, e
   "mudou a data" só re-aloca por RPC própria; UPDATE de tabela liberaria
   reescrever a chave pelo PostgREST).
9. [x] `e2e/privilegios.spec.ts` ganha um mapa novo lendo
   `information_schema.role_column_grants` (o mapa atual só lê
   `role_table_grants`, que não enxerga grant de coluna) com a entrada
   `fatura.extrato_path: UPDATE` — sem isso o grant fica invisível ao teste
   e reabre o ponto cego local≠remoto que a suíte existe para fechar.
10. [x] Trigger `fatura_extrato_path_imutavel` (before update em `fatura`):
    transição única `null → path`, nunca `path → outro path` — mesmo padrão
    de `pagamento_comprovante_path_imutavel` (migration `0019`). "Substituir
    extrato" fica fora de escopo.
11. [x] RPC `anexar_extrato_fatura(p_fatura_id uuid, p_extrato_path text)
    returns void` — `security invoker`, `set search_path`, grava só se
    `extrato_path is null`, `raise exception` se a fatura não existir (do
    dono) ou já tiver extrato, `raise exception` se `p_extrato_path` nulo —
    revoke de `public`/`anon`, grant só a `authenticated`, entrada nova em
    `e2e/privilegios.spec.ts`.
12. [x] `fatura_desembolso_gravar` ganha parâmetro opcional
    `p_extrato_path text default null` **no fim da assinatura** (padrão da
    migration `0017` — default no fim mantém compatibilidade posicional e
    permite chamada por nome via PostgREST); quando informado, grava com a
    mesma guarda do critério 11 (nunca sobrescreve um extrato já existente
    em silêncio — `raise` se a fatura já tiver). Assinatura nova
    revoke/grant e atualizada em `e2e/privilegios.spec.ts`.
13. [x] Nenhuma linha nova em `revisao` para o extrato — decisão deliberada:
    (a) o extrato não entra em nenhuma apuração (`alocarCusto`/aferição não
    o leem), logo não há "anos afetados" para rastrear nem pendência de
    retificadora; (b) `entidade_revisao` é ENUM e ganhar valor novo exigiria
    migration própria, separada, só para isso. Se o `contador` exigir rastro
    explícito de "quando o extrato foi anexado" no futuro, é migration nova,
    não retrofit desta.
14. [x] Nova família de pendência **`fatura_sem_extrato`** em
    `FAMILIAS_DE_PENDENCIA`/`ORDEM_DA_FAMILIA`
    (`lib/fiscal/pendencias-unificadas.ts`) — regra pura e testada:
    `desembolsos.length > 0 && extratoPath === null` (fatura sem nenhum
    pagamento ainda não cobra extrato). Cor **vermelha** (ADENDO 2 do
    parecer, §"Veredito"). Card na fila unificada de pendências (mesmo
    padrão de `documentos_sem_arquivo`), com CTA quando é uma fatura só,
    informativo quando são várias.
15. [x] Leitor novo `carregarFaturas(obraId)` em `lib/data.ts` — hoje só
    existe `carregarFatura(id)` (uma por vez); a fila unificada precisa
    listar todas as faturas da obra para alimentar a família do critério 14.
16. [x] **Escopo do veto**: a pendência `fatura_sem_extrato` NÃO usa o
    mesmo veto de `documentosSemArquivo` (que trava as três saídas anuais
    via `podeGerarRelatorioAnual`) — ela é irrelevante à aferição INSS
    (compra no cartão não é mão de obra) e não deve, por si, travar a ficha
    de Pagamentos Efetuados. O que ela compromete é especificamente a
    **discriminação do ano-calendário certo na ficha Bens e Direitos**
    (ADENDO 2 do parecer, seção "Nuance para o `cto-obra`"). O mecanismo
    exato (estender `podeGerarRelatorioAnual` com granularidade por saída,
    ou um gate isolado só para a discriminação) é decisão do `cto-obra` no
    Gate 2, não fechada aqui — mas o comportamento observável (não vetar
    Pagamentos Efetuados nem a posição da aferição INSS) é obrigatório.
17. [x] Este ticket **nunca retroage** sobre faturas confirmadas antes dele
    existir: elas só aparecem com a pendência do critério 14 (se tiverem
    desembolso), nunca com um bloqueio novo em `pagamento`, `data_pagamento`
    ou ano de nenhum registro já gravado.
18. [x] Nenhum campo fiscal (incluindo `extrato_path`) nasce preenchido;
    divergência do spec exige entrada declarada e justificada — invariante
    de projeto, provada pelo `CONTAI-034`.
19. [x] `npm run quality` verde, incluindo: teste unitário da regra do
    critério 14; E2E cobrindo os dois `CampoArquivo` distintos em
    `/confirmar`; E2E do anexo tardio via `/fatura/[id]` (rotativo e
    esquecido na hora); teste de imutabilidade da RPC (segunda tentativa de
    anexar falha); `e2e/privilegios.spec.ts` com as entradas dos critérios
    9, 11 e 12.
20. [x] `PapelDeAnexo` (`lib/types.ts:455`, hoje `"comprovante" | "nota" |
    "contrato"`) ganha o valor **`"extrato"`** — achado do Gate 0
    (`design/mocks/CONTAI-067.md`, seção 5): `subirParaAcervo`/`ListaDeAnexos`
    precisam do papel novo para rotular o item nas duas telas do critério 2 e
    5. Tipo TypeScript, sem migration (não persiste em coluna própria).

## Out of Scope
- **Comprovante por compra individual dentro da fatura** — decidido e
  descartado (`docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md`,
  §2, ratificado pelo ADENDO); não reabre aqui.
- **Retroagir sobre faturas já confirmadas** antes deste ticket — nunca
  bloqueante, nunca pendência nova imposta sobre fato consumado (crit. 17).
- **Substituir um extrato já anexado** — mesma trava de imutabilidade do
  comprovante de pagamento (crit. 10); pedido de correção segue fora deste
  ticket, mesmo padrão de "não se apaga, só se corrige por trilha" do
  projeto.
- **Validar o CONTEÚDO do extrato** (conferir se os itens do PDF batem com
  as compras registradas) — o app guarda o documento, não audita a
  composição por extração/heurística.
- **Cadastro de cartão como entidade própria**, e agrupar faturas por
  heurística de "mesmo ciclo" — já fora de escopo do `CONTAI-022`, continua.
- **Rastro formal de "quando o extrato foi anexado"** em `revisao` — decisão
  deliberada (critério 13), registrada como dívida (ver Viabilidade).

## Gate Fiscal (Contador)
Fontes: `docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md`,
**ADENDO** (requisito do extrato) e **ADENDO 2** (cor/gravidade da
pendência) — ambos desta rodada, já fechados; não rederivados aqui.

1. O extrato da fatura (PDF itemizado da administradora, um por fatura) é
   documento de terceiro que falta para sustentar QUAL compra estava DENTRO
   de qual fatura — elo distinto do que a NF do favorecido e o comprovante
   de pagamento já provam (ADENDO, "Por que o vínculo importa").
2. Ausência do extrato: **avisa e marca pendência vermelha**, nunca
   **recusa** o registro do pagamento — a fatura/pagamento nascem como fato
   consumado independentemente do documento existir (ADENDO, "[Guessing]"
   final; mesma disciplina do §1 original: "o valor pago é gravado sempre").
3. Cor da pendência: **vermelha** — regra do A.4
   (`docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`, seção "A.4
   — A régua de cor": "saiu? → tem apoio hábil no ano certo? → não =
   vermelho"). Aqui o dinheiro já saiu, mas falta apoio hábil que fixe o
   ano-calendário certo — mesma gravidade do precedente "mais de uma data" e
   do vermelho fixo de `documentosSemArquivo` (ADENDO 2, "Veredito").
   Distinta do âmbar do Estado C do ADENDO 4 (`docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`):
   lá o custo já está 100% sustentado no valor e no ano certo, falta só ação
   futura de terceiro; aqui a lacuna é na documentação hábil do próprio
   Mateus para fixar o ano.
4. Escopo do impacto: a pendência compromete especificamente a
   **discriminação da ficha Bens e Direitos** (ano-calendário certo do
   gasto) — não a aferição INSS/CNO (compra no cartão não é mão de obra) nem,
   por si, a lista de Pagamentos Efetuados (ADENDO 2, "Nuance para o
   `cto-obra`"). Mecanismo técnico de qual saída trava fica com o `cto-obra`
   (critério 16).
5. Extrato de ciclo antigo genuinamente inobtível: não é motivo para
   rebaixar a cor nem para recusar o registro em silêncio — é caso de
   quarentena/exceção documentada, decisão de produto/técnica, não fiscal
   (ADENDO, "[Guessing]" final; ADENDO 2, item residual).
6. Nenhuma linha em `revisao`: decisão registrada no critério 13 — sem
   impacto em apuração de custo/aferição, logo sem "anos afetados" a
   rastrear.

## Viabilidade (CTO)

**Modelo — coluna em `fatura`, não em `fatura_desembolso`.** O grão do
documento é o ciclo: a administradora emite UM extrato por fatura, haja 1 ou
N desembolsos (rotativo). O argumento da `0013` para pôr `comprovante_path`
no filho (N desembolsos, cada um com SEU comprovante) aponta na direção
oposta aqui: N desembolsos, UM extrato — no filho ele seria repetido N vezes
ou ficaria num desembolso arbitrário.

**Migration** (`supabase/migrations/00NN_fatura_extrato.sql` — confirmar o
próximo número livre no Gate 1; `0020` já foi usado pelo `CONTAI-065`, `066`
não usa migration):
- `alter table fatura add column extrato_path text;` (nullable).
- `grant update (extrato_path) on table fatura to authenticated;` — **grant
  de coluna, nunca de tabela**. Consequência para `e2e/privilegios.spec.ts`:
  grant de coluna não aparece em `information_schema.role_table_grants` (a
  fonte atual do spec); o spec ganha um mapa novo lendo
  `role_column_grants` (critério 9).
- Trigger `fatura_extrato_path_imutavel` (before update), cópia do padrão de
  `pagamento_comprovante_path_imutavel` (`0019` §2).
- RPC `anexar_extrato_fatura` (critério 11) e `fatura_desembolso_gravar`
  recriada com `p_extrato_path` no fim (critério 12) — `security invoker`,
  revoke/grant, entradas novas no spec de privilégios.
- Regen `lib/database.types.ts`; `Fatura.extratoPath: string | null` em
  `lib/types.ts`; `carregarFatura` mapeia o campo; `registrarDesembolsoDeFatura`
  ganha `extratoPath`; `anexarExtratoFatura` novo em `lib/data.ts`.

**Tela — três decisões:**
1. `/fatura/[id]/confirmar`: segundo `CampoArquivo`, exibido só quando
   `fatura.extratoPath === null`; quando já existe, linha "Extrato já
   anexado" com link ao acervo. Sobe os dois arquivos antes da RPC, grava
   num ato só (critério 3).
2. `/fatura/[id]/parcial`: nenhum campo novo (critério 6) — parcial é N por
   fatura, pedir o extrato a cada parcial duplicaria o mesmo documento; hoje
   nem o comprovante de pagamento é pedido ali (D56-b, já nomeada).
3. `/fatura/[id]` (detalhe): bloco "Extrato da fatura" — lugar canônico do
   anexo tardio e do caminho rotativo (que nunca passa por `/confirmar`).
   Inline, não subrota própria: ao contrário do `CONTAI-061`, aqui não há
   delta de anos a mostrar antes de gravar. `designer` decide o layout
   exato.

**Pendência "extrato indisponível" / fila unificada**: derivada, nunca
persistida, nunca `status='quarentena'` (esse status em `documento` já
significa "destinatário ≠ CPF do dono" — não reaproveitar o nome para outra
coisa). Superfície recomendada DENTRO deste ticket (não ticket separado): a
fila unificada de pendências (critérios 14-15), pela mesma razão que já
levou o card do `CONTAI-033` a ser bloqueante — sem lista de faturas no app,
a pendência do bloco em `/fatura/[id]` fica invisível da home.

**Complexidade: L** (com a fila unificada dentro do escopo — critérios
14-15; seria M sem). Arquivos esperados: migration nova, `lib/database.types.ts`
(regen), `lib/types.ts`, `lib/data.ts`, `lib/fiscal/fatura.ts` (+`.test.ts`,
regra do critério 14), `lib/fiscal/pendencias-unificadas.ts` (+ teste),
`app/_components/fatura-sem-extrato.tsx` (novo, ou reaproveitamento do
padrão de `documento-sem-arquivo.tsx`), `app/(gestao)/fatura/[id]/page.tsx`,
`app/(gestao)/fatura/[id]/confirmar/page.tsx`, wiring da home,
`e2e/privilegios.spec.ts`, `e2e/cartao.spec.ts`.

**O que NÃO fazer**: UPDATE de tabela inteira em `fatura`; campo em
`/parcial`; extrato em `fatura_desembolso`; linha em `revisao`; permitir
"substituir extrato"; inferir "mesmo ciclo" para agrupar cartões.

**Dívidas novas** (nomeadas, não resolvidas neste ticket):
- **D84 — multicartão com mesmo vencimento colapsa num único `extrato_path`**:
  o risco residual já aceito na `0013` (dois cartões, mesmo vencimento = uma
  `fatura`) passa a ter custo documental concreto (um campo para dois PDFs).
  Correção aditiva (rótulo do cartão na chave única) só se acontecer.
- **D85 — sem leitor de "todas as faturas" antes deste ticket**: confirma a
  necessidade do critério 15; registrada porque é pré-requisito, não
  consequência, da fila unificada.
- **D86 — anexo do extrato sem rastro formal em `revisao`** (decisão do
  critério 13): se o `contador` exigir rastro explícito de "quando" no
  futuro, `entidade_revisao` (ENUM) precisa de `alter type add value` em
  migration própria, separada.
- **D56-b** (já existente, `CONTAI-061`): `/fatura/[id]/parcial` segue sem
  campo de comprovante do desembolso — não muda aqui, só registrado que este
  ticket não a resolve.

## Pre-mortem
1. **Confundir os dois campos de arquivo** (extrato × comprovante de
   pagamento) na mesma tela, anexando o documento errado no campo errado.
   Guarda: rótulos e texto de porquê distintos e específicos (nunca "Anexo
   1"/"Anexo 2"), fechados no spec de design (critério 1) e copiados do
   ADENDO (critério 2).
2. **Obrigar retroativamente** extratos de faturas já confirmadas antes
   deste ticket, quebrando a disciplina de não reabrir fato consumado.
   Guarda: critério 17 — o campo só existe daqui para frente; faturas
   antigas só ganham a pendência (crit. 14), nunca um bloqueio novo sobre
   registro já gravado.
3. **Extrato indisponível** (cartão antigo, banco não guarda histórico)
   travando o registro do pagamento ou sendo dispensado em silêncio. Guarda:
   o extrato é sempre opcional na gravação (critério 4); ausência vira
   pendência vermelha permanente e visível (critérios 14-15), nunca um
   bloqueio e nunca um silêncio — exatamente o meio-termo que o ADENDO e o
   ADENDO 2 do parecer fecham.

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma pendente ao Mateus. As duas ambiguidades genuínas desta rodada já
foram fechadas nesta própria sessão: (a) extrato indisponível de fatura
antiga não bloqueia o registro, vira pendência de quarentena com
consequência fiscal explícita — resposta do próprio ADENDO do parecer,
antecipando a pergunta que este ticket levantaria; (b) cor/gravidade da
pendência nova — **vermelha**, adjudicada pelo `contador` no ADENDO 2. O
único ponto deixado para depois é técnico, não uma pergunta: o mecanismo
exato de "qual saída anual trava" (critério 16) fica para o Gate 2 do
`cto-obra`.

## Cenário e checagem final
**Gestão** (`/fatura/[id]/confirmar`, `/fatura/[id]`) — o Mateus concilia
pagamentos de cartão sentado, em casa, com calma; o "Teste do Canteiro" não
se aplica a nenhuma das duas telas tocadas.

⚠️ Ticket **com migration** — aplica a ordem `npx supabase db push` antes de
`git push`.

**Gate 0 fechado** em `design/mocks/CONTAI-067.md` (nível 2, texto + ASCII,
sem HTML). Decisões do spec: os dois rótulos do critério 2 mantidos como
propostos ("Comprovante da fatura" / "Extrato da fatura (emitido pelo
cartão)"); estado "extrato já anexado" substitui o campo por
`ListaDeAnexos`; bloco do critério 5 em `/fatura/[id]` entra logo depois do
Card "Valores já pagos a esta fatura", com dois parágrafos (consequência +
escopo do não-veto, para o vermelho não sugerir veto total); card da
pendência unificada espelha `documentos_sem_arquivo`, mas troca a frase de
veto por uma frase de NÃO-veto (Pagamentos Efetuados/aferição INSS
intocados). Achado do Gate 0 virou critério 20 (`PapelDeAnexo` ganha
`"extrato"`). **Pronto para `/develop`.**

## ✅ Entregue em 2026-09-26

Gate 4 (`po`), 20/20 critérios PASS. **Com migration `0021_fatura_extrato.sql`**
— aplica-se a ordem `npx supabase db push` antes de `git push`.

Arquivos finais tocados (confirmados lendo o código real, sem mudança desde o
APPROVE do `cto-obra` no Gate 2):

- `supabase/migrations/0021_fatura_extrato.sql` — coluna `fatura.extrato_path`
  (nullable); `grant update (extrato_path) on table fatura to authenticated`
  (grant de COLUNA, nunca de tabela); trigger `fatura_extrato_path_imutavel`
  (`null → path`, nunca `path → outro path`); RPC `anexar_extrato_fatura`
  (`security invoker`, `where extrato_path is null` + `for update`, revoke de
  `public`/`anon`); `fatura_desembolso_gravar` recriada (`drop` + `create`,
  aridade nova) com `p_extrato_path text default null` no fim da assinatura,
  mesma guarda "não sobrescreve em silêncio" (`raise` se a fatura já tiver
  extrato).
- `lib/database.types.ts`, `lib/types.ts` (`Fatura.extratoPath`,
  `FaturaSemCompras`, `PapelDeAnexo` + `"extrato"`), `lib/dados/comum.ts`
  (`FaturaComDesembolsos`), `lib/data.ts` (`carregarFaturas`,
  `anexarExtratoFatura`, `registrarDesembolsoDeFatura` com `extratoPath`,
  `subirParaAcervo` com a pasta `"extrato"`).
- `lib/fiscal/fatura.ts` (+`.test.ts`) — `faltaOExtrato`, `faturasSemExtrato`,
  as constantes de texto (copiadas do ADENDO/ADENDO 2, nunca reescritas) e a
  cor `COR_FATURA_SEM_EXTRATO = "red"`.
- `lib/fiscal/pendencias-unificadas.ts` (+`.test.ts`) — 19ª família
  `fatura_sem_extrato`, fora do `if (resumo !== null)` de propósito (não
  depende de `calcularResumo`).
- `lib/fiscal/terreno.ts` (+`.test.ts`) — `ROTULO_DO_PAPEL.extrato`, e
  `PAPEIS_DE_ANEXO` explicitamente SEM `extrato` (o formulário do terreno
  continua oferecendo só os três que a migration `0010` aceita).
- `app/_components/fatura-sem-extrato.tsx` (novo), `fila-pendencias.tsx`,
  `gestao.tsx` — card da fila unificada com a frase de NÃO-veto (nunca a
  frase de veto do card irmão `documentos_sem_arquivo`).
- `app/(gestao)/fatura/[id]/page.tsx` — bloco canônico do anexo tardio/
  rotativo; `app/(gestao)/fatura/[id]/confirmar/page.tsx` — o segundo
  `CampoArquivo`, gravado no mesmo ato; `app/(gestao)/page.tsx`,
  `app/(gestao)/pendencias/page.tsx` — contagem "19 famílias".
- `e2e/cartao.spec.ts` — as 4 suítes novas do CONTAI-067 (captura no ato,
  anexo tardio, recusa pelo banco, pendência nas duas superfícies);
  `e2e/privilegios.spec.ts` — o primeiro mapa de GRANT DE COLUNA do repo
  (`pg_attribute.attacl`, com a razão por extenso de não usar
  `role_column_grants` como mapa exaustivo) + a assertiva positiva do
  critério 9 + as entradas de `anexar_extrato_fatura` e da assinatura
  recriada; `e2e/pendencias.spec.ts` — só comentário (dezoito → dezenove).

Os 20 critérios foram conferidos um a um contra o código: os dois pontos de
captura existem com rótulos distintos e ajuda copiada do ADENDO (crit. 1-2);
upload dos dois arquivos antes da RPC, gravação num ato só (crit. 3); extrato
nunca bloqueia a confirmação (crit. 4); bloco de anexo tardio em
`/fatura/[id]`, único ponto do caminho rotativo (crit. 5); `/parcial`
continua sem campo de arquivo (crit. 6); coluna, grant de coluna, trigger e
RPC batem com a Viabilidade (crit. 7-12); nenhuma linha em `revisao` (crit.
13); a regra `faltaOExtrato` tem as duas pernas testadas (crit. 14); leitor
`carregarFaturas` novo (crit. 15); a pendência não veta Pagamentos Efetuados
nem a aferição INSS, só a discriminação (crit. 16, com teste dedicado);
faturas antigas só ganham a pendência, nunca um bloqueio novo (crit. 17);
`extrato_path` nasce sempre `null` (crit. 18); `npm run quality` completo
verde (crit. 19); `PapelDeAnexo` ganhou `"extrato"` (crit. 20).

`npm run typecheck` limpo, `npm run lint` limpo, `npm run build` limpo.
`npm run test` (Vitest): **1144 passando** (1139 esperados deste ticket + 5
do CONTAI-068, presente na mesma árvore e ainda não commitado — consistente
com o aviso do gate). `npm run test:e2e` (Playwright): **362 passando**.

⚠️ A primeira rodada de `npm run quality` completo, dentro deste Gate 4,
pegou 9 falhas dispersas (`acervo.spec.ts`, `atualidade-do-shell.spec.ts`,
partes de `cartao.spec.ts` alheias a este ticket, e as duas suítes novas do
CONTAI-067). Isolando os arquivos (`npx playwright test e2e/cartao.spec.ts`
sozinho, e depois `npm run test:e2e` completo de novo) o resultado saiu
362/362 verde nas duas vezes — a causa foi interferência de execução
concorrente no mesmo banco local Docker (o Gate 1 do `CONTAI-068` também
mexe na mesma árvore/stack), não bug do código deste ticket. Registrado aqui
para quem revisar depois não confundir com regressão.

Nenhuma pergunta pendente ao Mateus. `068` fica sozinho na fila.
