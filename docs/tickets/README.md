# Índice de tickets — por ordem de execução

**Este arquivo é a FONTE DA ORDEM.** Mudou em 2026-08-23: antes a ordem canônica
vivia numa "fila revista" dentro de uma entrada datada do diário, e este arquivo
só a espelhava. Os dois divergiram — a 6ª revisão passou cinco dias dizendo que
o `CONTAI-018` era o 1º item **com ele já em produção**. Retrato datado dentro de
diário não acompanha ticket que anda; este mapa acompanha, porque é ele que o
gate atualiza.

Quem guarda o quê, e é para ficar assim:

| Fato | Dono |
|---|---|
| **ordem de execução**, prioridade, status, hash de gate | **este arquivo** |
| **por que** a ordem mudou; dores, relatos, adjudicações fiscais | `../backlog.md` + `../backlog/` |
| escopo, critérios de aceite, Gate Fiscal | o ticket, em `CONTAI-0XX.md` |

Reordenar é ato do `po`, e ele escreve o **porquê** como entrada nova no diário —
mas a ordem em si se aplica **aqui**, e em nenhum outro lugar.

✅ **7ª revisão da fila — aplicada em 2026-08-23 pelo `po`.** É a primeira que
nasce aqui em vez de nascer no diário. O **porquê** de cada movimento está em
`../backlog/21-2026-08-23-setima-revisao-da-fila.md` — inclusive o que foi
cortado e o que continua parado esperando o Mateus. A ordem, o status e os
hashes são deste arquivo.

✅ **Adendo do `contador` aplicado no mesmo dia (23/08).** A 7ª revisão nasceu
desatualizada em três pontos — o parecer
`../pareceres/2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md`
destravou o `008`, criou o `032` e trouxe o `025` para dentro da fila. O adendo
que registrava esse fato **como texto solto neste arquivo foi absorvido pela
ordem e apagado**: ele existia só para o fato não ficar sem registro enquanto o
`po` não reordenava. O **porquê** está em
`../backlog/22-2026-08-23-adendo-a-setima-revisao.md`.

**Legenda**: ✅ done · 🔨 em desenvolvimento · 🟢 pronto para `/develop`
· 🟡 bloqueado por gate · 🔴 sem arquivo (só backlog)

## ⚠️ Regra de formato — ✅ sem lastro é impossível por construção

*Criada pelo `cto-obra` em 2026-08-18, depois de o ✅ do CONTAI-003 sobreviver a
**cinco revisões de fila** sem nenhum gate registrado.*

> **Um ticket só exibe ✅ se a linha citar os quatro hashes de gate —
> `G1:x G2:y G3:z G4:w`. Sem os quatro, o status é ⚠️.**

Não é questão de atenção, é questão de formato: *"verde era uma afirmação sem
referente; com hash obrigatório, a afirmação carrega a própria prova ou não se
escreve"*.

**Verificação mecânica**, a rodar no passo de revisão de fila do `/develop`:

```sh
grep -n '^|.*✅' docs/tickets/README.md | grep -v 'G1:.*G2:.*G3:.*G4:'
```

Achou linha? A revisão falha.

*Ajuste de 18/08 (`po`): a âncora `^|` foi acrescentada porque a versão anterior
casava também com a legenda e com este próprio parágrafo — o comando falhava
sempre, e um verificador que falha sempre é um verificador que ninguém roda. Só
**linha de tabela** conta.*

**Aplicado para trás em 18/08**: o `001` e o `002` foram **rebaixados a ⚠️**. Não
é dúvida sobre eles estarem no ar — é que ✅ sem os quatro hashes é afirmação sem
referente, e o critério do `cto-obra` é do projeto, vale para trás e não depende
de quem escreveu a linha.

---

## ⚠️ BLOQUEIO DE RELEASE — código pushado exigindo migration que pode não estar no remoto

*Levantado na 7ª revisão (23/08). É o item nº 1 do projeto, e não é ticket.*

A regra do `CLAUDE.md` é **`npx supabase db push` ANTES de `git push`**, sem
exceção. Hoje `origin/main` está **0 commits atrás de `main`** — ou seja, tudo
foi pushado, e na Vercel push é deploy. Mas:

| Migration | Quem exige | O que este arquivo afirmava |
|---|---|---|
| `0009_correcao_documento.sql` | `CONTAI-021` (em produção desde 21/08) | *"NÃO está no ar … `db push` quando o Mateus autorizar"* |
| `0010_terreno_anexo.sql` | `CONTAI-027` rodada 2 (commitada e pushada em 21/08) | nunca registrada como aplicada |

**Se as duas não estiverem no remoto, a correção de documento e o anexo do
terreno estão quebrando em produção desde 21/08** — e quebrando do jeito que o
`CLAUDE.md` descreve: não aparece no build, não aparece no teste, aparece no
dedo do Mateus. **Uma linha do Mateus fecha isto**: *as migrations 0009 e 0010
já foram aplicadas no projeto remoto?* Se não, `npx supabase db push` antes de
qualquer outra coisa.

## Em produção — o que já está no ar

| # | Ticket | Status | Ressalva viva |
|---|---|---|---|
| 001 | Ingestão de NF/boleto | ⚠️ **rebaixado em 18/08** (era "done") | os quatro hashes **não estão registrados**. O ticket está em produção e ninguém duvida disso — o que falta é a prova em formato auditável. Ressalva viva: critério 7 (≤3 interações) transferido à US-008 |
| 002 | Autenticação | ⚠️ **rebaixado em 18/08** (era "done") | mesmos quatro hashes ausentes. Ressalva **aberta**: R2 (prova no aparelho real) **transferida ao 014**, não resolvida. **Método trocado para e-mail+senha em 18/08** — reabre a validação de tela |
| 018 | Vínculo pagamento↔nota | ⚠️ `G1:b574316 G2:22279c0 G3:1710dc6 G4:3b9c26e` | **Quatro gates fechados e em produção** (push de 18/08, `b807901`). Fica ⚠️ e não ✅ porque os hashes acima foram **reconstruídos das mensagens de commit**, não lidos de um log de gate no ticket. Vira ✅ quando o `/develop` registrar os quatro no corpo do `CONTAI-018.md`. Corte vivo: critério 18 → `CONTAI-020` |
| 003 | Cadastro de obra e obra ativa | ⚠️ `G1:5550d11 G2:e72bf35 G3:papel G4:papel` | **Desempatado em 18/08**: o `cto-obra` adotou a posição do `lead`. G3 fecha por **evidência transitiva** (o quality do CONTAI-002 rodou sobre árvore que já continha o 003 — hash no ticket), G4 vira **passe de papel em paralelo**. Vira ✅ só **junto com o commit de registro** |
| 019 | Pagamento agendado (compromisso × pagamento) | ⚠️ `G1:df36b41 G2:50958a1 G3:3ec2913 G4:7c37b45` | **Entregue em 18/08, 49/49 critérios**, depois de um FAIL de Gate 4 por lastro documental (fechado pelo ADENDO 4, `d69a3cf`). Migration **0007**. Fica ⚠️ porque o hash do G4 foi **reconstruído da mensagem de commit** — vira ✅ quando o corpo do ticket registrar os quatro. Ressalva viva: **o mock v2 está DEFASADO em 4 pontos** (borda sólida no vencido, data pré-preenchida, s12 sem as cinco resoluções, sem a tela `/compromisso`) — não bloqueia o PASS, bloqueia quem for desenhar em cima. Ressalva **D28**: a `US-004` tem de chamar `podeGerarRelatorioAnual`. **Destravou o `CONTAI-022`** |
| 010 | Terreno financiado (Passo 1: captura) | ✅ `G1:ebe0bfc G2:be31bc4 G3:f54751c G4:960578c` | **DONE em 19/08**, com o log no corpo do ticket. Migration **0008** — a primeira destrutiva do projeto, **sem backfill**, descarte autorizado pelo Mateus. ⚠️ **Ressalva viva, e não é de software**: a obra está com terreno **R$ 0,00** até o Mateus redigitar os três desembolsos com as datas e lançar o informe de 2025 — e o ano-base 2025 **já foi declarado com o terreno dentro**. Seguros seguem em aberto (ADENDO 4). Passo 2 (critérios 17 e 20) foi para a **US-004** |
| 021 | Corrigir documento já registrado | ✅ `G1:2cefc62 G2:29d6144 G3:e517cc2 G4:32914b1` | **DONE em 21/08 — os quatro gates, com o log no corpo do ticket.** Mock v2 aprovado em 19/08 (`ad07fd8`, 27 telas). Gate 2 fechou depois de um loop de **seis bloqueantes**, o primeiro fiscal: a tela do desfecho misto afirmava número **falso, sempre para MAIS**. Entregou o **critério 13** (conserto de bug em produção, `moverDocumentoDeObra`) — **só do lado do documento**; o espelho é o `008`. ⚠️ **Exige a migration `0009` no remoto** — ver o BLOQUEIO DE RELEASE no topo. Ressalvas **R1-R5** no backlog; **R1-R3 viraram os critérios 13-15 do `008`** |
| 030 | Prazo de guarda que o app afirma depois de todo registro | ⚠️ `934f81a` **(rebaixado na 7ª revisão)** | **Entregue em 22/08** e corrigiu **erro fiscal em produção**: a confirmação de TODO registro dizia *"Original guardado no acervo — fica disponível até a venda + 5 anos"* — errado no prazo **e** na palavra *Original*. Texto novo sancionado pelo `contador`, sem número de prazo em tela; o **parecer foi corrigido primeiro**, porque o LEIA-ME do `011` o copia literalmente. **Fica ⚠️, não verde**: entregue em commit único, sem os quatro hashes de gate. É a regra do `cto-obra` aplicada a quem a escreveu depois — o `grep` de verificação acusava esta linha hoje |
| 029 | Teste unitário para os mappers da camada de dados | ⚠️ `20d4d0e` **(rebaixado na 7ª revisão)** | **Entregue em 23/08**: 76 casos, 14/14 mappers, Vitest 412→488, zero código de produção no diff. Achou **D42** (condição fiscal 6 sem rede nenhuma → `CONTAI-031`) e **D43** (formato do rastro protegido por uma única asserção E2E). O critério 4 estava **pedindo um bug** e foi reescrito em 4a/4b. **Fica ⚠️, não verde**: quatro gates rodaram, um hash só foi registrado |
| 028 | Quebrar `lib/data.ts` em módulos por entidade — **fatia 1 de 7** | 🔨 `a9ef819` | **Só a fatia 1 está entregue** (23/08): os 14 mappers puros foram para `lib/dados/comum.ts`, barrel de volta a **63 exports exatos**, golden snapshot byte a byte. O ticket **segue aberto** e as fatias 2-7 estão no fim da fila — ver a proposta de corte em "Depois" |

## Fila de implementação

*7ª revisão, 2026-08-23, **com o adendo do mesmo dia aplicado** — o `contador`
respondeu as duas perguntas que a revisão levantou e o tabuleiro mudou em três
pontos. Raciocínio da revisão em
`../backlog/21-2026-08-23-setima-revisao-da-fila.md`; o **porquê dos movimentos
do adendo** em `../backlog/22-2026-08-23-adendo-a-setima-revisao.md`. Parecer
que os produziu:
`../pareceres/2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md`.*

**O critério de ordenação, dito uma vez**: primeiro o que já está **em voo**
(código sem revisor é a dívida mais cara do projeto), depois o **P0 fiscal** que
falha por fora (fato que não tem onde ser registrado), depois o **P0 fiscal** que
falha por dentro (registro que grava estado inválido), depois o resto.

⚠️ **O adendo de 23/08 abriu uma exceção ao critério, e ela é fundamentada**: o
par `025 + 032` passa na frente do `022` **porque o parecer mostrou que a falha
do `022` não é "por fora"**. Com `meio = "pix"` pré-selecionado, a compra no
cartão **não deixa de ser registrada — ela é registrada como PIX**, na data da
compra. Não é ausência de custo, é **custo falso no acervo**, e a doutrina do
projeto (*campo vazio pergunta, campo preenchido afirma*) põe o registro falso
acima da ausência. O `032` é o que converte a falha do `022` de *registro falso
silencioso* em *recusa explícita* — e só então o `022` fica sendo o que a 7ª
revisão descreveu.

| Ordem | # | Ticket | P | Status | O que trava |
|---|---|---|---|---|---|
| **1** | **027** | **Ver o anexo, e anexar mais de um** | P1 | 🔨 **EM VOO** | ⚠️ **Gate 1 das DUAS rodadas está commitado E PUSHADO desde 21/08 (`1ff74c9`…`53acc37`, migration `0010`), e os Gates 2, 3 e 4 NUNCA RODARAM.** Não há nada travando: o mock foi **aprovado em 21/08**, o Gate Fiscal está em arquivo e o critério 1 está marcado `[x]` no ticket. **Retomar no Gate 2.** É o único item da fila cujo código já está na frente do Mateus sem ter passado por revisor — a regra do projeto é que quem implementa nunca revisa o próprio código, e hoje ninguém revisou |
| **2** | **025** | ***"Paguei, mas não sei a data"* — o terceiro estado** | P1 · **P0 por dependência** | 🟡 | **Sobe de "Depois" e vira PRÉ-REQUISITO do `032`** (§3 do parecer de 23/08). O **Gate Fiscal dele está RESPONDIDO**: *registrar pago-sem-data é melhor que não registrar* — preserva o comprovante, **não entra em ano nenhum** e **não afirma nada falso** (IN SRF 84/2001, art. 17). Ganhou **emenda** do parecer: no formulário direto a data decide **entidade**, então *"pago, não sei a data"* cai **SEMPRE em `pagamento`, nunca em `compromisso`**. ⚠️ **O `🔴 sem arquivo` que este mapa exibia era falso**: `CONTAI-025.md` existe desde 19/08 (`b514f7d`), como minuta. **Trava: o `po` fechar os 6 critérios da minuta + o `designer` dizer o nível de proposta** (o ticket aposta em "sem mock novo" e isso precisa de confirmação). **É o único item da classe P0 cuja trava não é o dedo do Mateus** |
| **3** | **032** | **Tirar `data = hoje` e `meio = "pix"` do formulário de pagamento** | **P0** | 🔴 sem arquivo | **Nasce do adendo de 23/08, e a D44 foi confirmada nos DOIS campos.** Em produção, `app/adicionar/pagamento/page.tsx` nasce com `data = hoje` (`:163`) e `meio = "pix"` (`:169`) — e um campo intocado afirma **três** coisas: o **ano-calendário** (regime de caixa), a **entidade** (`decidirRegistro` escolhe `pagamento` × `compromisso` pela mesma data) e o **meio**. Pior: com `pix` pré-selecionado, a `RECUSA_CARTAO` (critério 27 do `019`) vira **código inalcançável pela inação** — guarda que depende de escolher o que já está escolhido **não é guarda**. **Trava: `/tickets-req` + o `025` na frente.** Entrar sozinho troca *data errada em silêncio* por *data inventada pelo dedo*, e a segunda é pior. ⚠️ **Recomendação do `po` ao `contador`, uma linha**: a metade `meio` **não** depende do `025` (não existe "não sei o meio" — quem afirma o meio é o comprovante) e poderia ir na frente, sozinha; a condição de aprovação do parecer foi escrita para o ticket inteiro, então quem a solta é o `contador`, não eu |
| **4** | **022** | **Cartão de crédito (compra → fatura)** | **P0** | 🔴 sem arquivo | **Item mais velho em aberto do projeto — reservado em 18/08.** ⚠️ **O diagnóstico mudou em 23/08, o posto não**: não é verdade que a compra no cartão *"não é registrada em lugar nenhum"* — hoje ela é registrada **como PIX**, por causa do default do `032`. A recusa só alcança quem toca no campo. **O bloqueio caiu** (dependia da entidade `compromisso`, entregue pelo `019`) e **não espera nada do Mateus**: a Q4 fechou em 08/08 e o §B do parecer de 18/08 traz os **10 critérios já redigidos**. Precisa de `/tickets-req` e de `/design` (o mock do 019 não tem uma única tela de cartão). Única decisão de escopo, e é do `po`: **parcelado entra na v1 ou é recusado na entrada com mensagem explícita** |
| **5** | **008** | **Mover PAGAMENTO entre obras sem quebrar o vínculo** | **P0** | 🟡 | Bug **alcançável pela interface** desde que o `018` foi ao ar: `/pagamento/[id]/obra` grava estado inválido em silêncio. 🔓 **DESTRAVADO no fiscal em 23/08 — a pergunta 1 é INDEPENDENTE da Q14** (a Q14 decide **de quem é a obrigação** do CNO; a pergunta 1 decide **a que CNO o valor se vincula**, e a regra é idêntica com o CNO em qualquer nome). **A regra emitida**: mover **é permitido**, com **marca permanente** *"CNO impresso ≠ CNO desta obra"*; a nota **não abate aferição de obra nenhuma** até reemissão ou retificação da R-2000, e entra na lista de cobrança do `007`. **O critério 3 muda de "recusar" para "permitir com marca"** e a trava migra para o `004`. **Trava que sobra: só o mock da tela espelhada.** Segue atrás do `022` porque destravar o fiscal encurtou a lista de travas dele, mas **não antecipou a data mais cedo em que ele pode entrar** — que continua sendo a do mock. Herdou os **critérios 13-15** do Gate 4 do `021` |
| **6** | **004** + **007** | Nº do documento e data de emissão · CNO referenciado na NF de serviço | **P0** | 🟡 | **Dividem a ordem de propósito**: mesmo formulário, mesmo passe de mock. **Trava: mock.** ⚠️ **Os dois GANHARAM ESCOPO em 23/08**: o **`004`** recebe a trava da aferição que sai do `podeCorrigirObra` — *só abate a base da obra X a NF de serviço cujo CNO impresso seja o de X* —, e ela é **mais forte** que a recusa de hoje, porque pega também **a nota arquivada errada sem nenhum move**; o **`007`** recebe **a nota movida** na lista de cobrança. O `007` já carregava a trava de mock desta revisão: a contradição interna dele (*"não precisa de mock, a tela é mínima para o polegar"*) **caiu junto com a régua velha**, e a revisão de Passo 1 (6 pontos) começa por aí |
| **7** | **009** | Detalhe do pagamento | **P0** | 🟡 | Gate 0 aprovado em 16/08; **5 perguntas em aberto**. Ganhou vizinho na 7ª revisão: o texto *"o ano sai da data do pagamento, não a da nota"* do `#s7` é **redação do `designer` sem carimbo do `contador`** (D41) |
| **8** | **005** | Headline da home (reduzido a corte) | **P0** | 🟡 | **mock v5 pendente**. Decisão nº 1 fechada em 17/08: R$ 49.850. É o último P0 da fila que depende **só de mock** |
| **9** | **031** | E2E da condição fiscal 6 | P1 | 🔴 sem arquivo | Precisa de `/tickets-req`. O código está **certo** hoje — falta rede. **Bloqueia a fatia 5 do `CONTAI-028`**: rede antes do refactor, nunca depois. Leva junto o comentário-guarda de `e2e/correcao.spec.ts:96` (D43) |
| **10** | **014** | Manifest de PWA + prova no aparelho | P1 | 🟢 | **Único 🟢 da fila inteira.** Gate 0 substituído por aprovação de ícone. Fica no fim de propósito: nenhuma das três metas depende dele |
| **11** | **006** | Estados de rede lenta/indisponível | P1 | 🟢 | Sem bloqueio. ⚠️ **rodar sozinho na árvore** — toca muitos arquivos |

### ⚠️ O que a fila diz de si mesma, e é desconfortável

**Oito dos onze itens não podem entrar no `/develop` hoje.** Cinco travam em
**mock** (`008`, `004`, `007`, `005`, e o `022` que ainda nem tem ticket), três
travam em **arquivo de ticket** (`022`, `031`, `032`) e o `025` trava em
**critério não fechado**. **Mock é aprovação do Mateus** — o gargalo do projeto
não é capacidade de implementar, é a fila de mocks esperando o dedo dele. Isso
não se resolve reordenando; está dito aqui para não ser descoberto de novo daqui
a cinco dias.

**O que o adendo de 23/08 mudou nesse quadro, e é a razão de o `025` ter subido**:
ele é o primeiro item da classe P0 em muitos dias cuja trava **não** é o dedo do
Mateus — o Gate Fiscal fechou hoje, o ticket já existe em minuta e a aposta do
próprio ticket é que não precisa de mock novo. Enquanto a fila de mocks não anda,
o par `025 + 032` é o que **pode** andar.

⚠️ **`CONTAI-020` está RESERVADO e não tem arquivo** — é a **fila de
conciliação**, cortada do critério 18 do `CONTAI-018` (ver
`CONTAI-018.md:201`). Ele só vira ticket se a **pergunta aberta nº 2** do 018
disser que a home não basta. Não reutilizar o ID.

## Bloco de deploy — fora da fila de implementação

*Ordem alterada na 7ª revisão: o item **0** não é ticket e vem antes de tudo.*

| # | Ticket | P | Status | Nota |
|---|---|---|---|---|
| **0** | **Aplicar `0009` e `0010` no projeto remoto** | **P0** | ⛔ | **Não é ticket, é a ordem obrigatória do release invertida.** Ver o BLOQUEIO DE RELEASE no topo deste arquivo. `npx supabase db push`, conferir em Database → Migrations, e só então seguir. **Bloqueia o `013` e qualquer deploy novo** |
| 012 | Manter o Supabase acordado | P1 | 🟢 | sem tela, sem impacto fiscal |
| 013 | Configuração de produção do login | P0 | 🟢 | **encolheu** — SMTP e template saíram com a troca para senha |
| 014 | Prova no aparelho real | P1 | 🟢 | mesmo deploy de preview do 013 |

## Depois

*Reordenado na 7ª revisão. **Nenhum item daqui entra no `/develop` antes de a
fila acima esvaziar** — e três deles estão propostos para corte.*

| # | Ticket | P | Status | Nota |
|---|---|---|---|---|
| 011 | Export do acervo | **P0** | 🟡 | **O único P0 desta seção, e ele serve a META 3 diretamente.** Gate 0 aprovado em 16/08; trava é a **P1 do CTO** (fonte do estado) — decisão do `cto-obra`, **não do Mateus**. ⚠️ **Restrição nova de 21/08** (§4 do Gate Fiscal do `027`): com N anexos por lançamento, o índice do dossiê põe **cada anexo em linha própria com hash**, o **valor uma única vez** na linha do lançamento e a declaração de que os N anexos compõem **um** desembolso — *"um dossiê que induz soma errada é pior que um incompleto"*. **Sobe para a fila assim que a P1 do CTO for respondida** |
| 016 | Tipo de empreitada na obra | P0 | 🟡 | Ramo `total` **bloqueado** pela mesma coisa há 13 dias: o parecer de **empreitada total × parcial** (10/08) **só existe em transcript**. Não exige mock. ⚠️ **Amarrado à Q14** — as duas se resolvem com a mesma resposta |
| 024 | Corrigir informe/contrato do financiamento, **com rastro** | P1 | 🟡 | Criado no Gate 2 do `010`. O Gate 2 **tirou o `grant update`** de `financiamento` e `financiamento_informe`: grant sem tela não entrega o remédio que promete — informe com **duas rubricas trocadas entre si** fecha a soma, então nem a trava nem o CHECK acusam, e o `unique` trava o ano-base **para sempre**. Grant volta no mesmo diff que a tela e o histórico. Inclui `previsto` → `pago` |
| 017 | Lista de notas a cobrar (tela 14) | — | 🟡 | **cortado**, com condição de volta escrita. Depende de 004 + 007 |
| 023 | Tirar "regime de caixa" das 4 telas restantes | P2 | 🟢 | Da dor **D31**. Sem mock e sem Gate Fiscal — texto já ratificado no §F.5. **S.** Segue sendo dos primeiros a ceder se a fila apertar |
| 028 | Quebrar `lib/data.ts` — **fatias 2-7** | P2 | 🟡 | ⚠️ **CORTE PROPOSTO na 7ª revisão, com uma exceção.** As seis fatias restantes entregam **custo de leitura de agente** — que não serve a nenhuma das três metas. A fatia 1 tinha consumidor (`029`) e foi entregue; as outras não têm. **Exceção que sobrevive**: a extração de `textoDoRastro` (fatia 5), que é a cura da **D43** e tem consequência fiscal — ela se agrega ao próximo ticket que tocar aquele call-site. **Condição de volta**: um ticket fiscal medir de novo o custo de leitura de `lib/data.ts` e achá-lo proibitivo. Enquanto isso, a trava do `erros.ts` continua valendo (não ganha export novo antes do reexport nomeado) |
| 015 | Captcha no login | P2 | 🟡 | ⚠️ **CORTE RE-RECOMENDADO na 7ª revisão, com argumento novo.** O `po` já recomendara cortar por fricção com uma mão — **esse argumento morreu** com a régua de 18/08. O que o substitui é mais forte: o captcha existia para proteger o **limite de 2 e-mails/hora** do envio de código, e o login **virou e-mail+senha em 18/08** — não há mais envio a proteger. Não serve a nenhuma das três metas. **Decisão do Mateus**, que já o manteve uma vez |
| 026 | Terreno recebido (herança, doação, permuta) | P2 | 🟡 | ⚠️ **CORTE PROPOSTO na 7ª revisão.** O sistema existe para **esta** obra: o terreno **já foi adquirido e é financiado**, e nenhuma das três naturezas pode ocorrer nela. Manter o item é escrever produto para construtora, que é o escopo declarado fora. **Condição de volta escrita**: uma segunda obra cujo terreno venha por herança, doação ou permuta. O buraco real que ele nomeia — *quem escolher essa natureza fica com custo zero* — se fecha hoje **não oferecendo a natureza**, e isso é uma linha, não um ticket |


## Stories ainda sem ticket

`US-004` (relatórios anuais) · `US-005` (migrar planilha) · `US-006` (prestador
PF) · `US-008` (extração automática — **Gate Fiscal já fechado**, parecer de
17/08) · `US-009` a `US-012`.

**Dores novas de 18/08, do fechamento do `CONTAI-019`**: **D26** — compra no
cartão não tem onde morar, e o comentário do código culpa uma pergunta (Q4) que
foi respondida em 08/08 → **`CONTAI-022`**; **D27** — o formulário direto recusa
gravação sem comprovante enquanto a confirmação de compromisso não recusa (dois
pesos para o mesmo fato) → **absorvida pelo `CONTAI-019`**, critérios 46-48.

**Dores novas de 18/08, do parecer do terreno financiado**: **D33** — o
financiamento do terreno **não tem onde morar no app**, e o custo de 2025
(**R$ 59.934,75**, com documento já na mão do Mateus) está inteiro fora do
sistema → **absorvida pelo `CONTAI-010`**; **D34** — durante o ano corrente o
painel **subestima** o custo do financiamento, porque o informe só sai em
jan/fev, e hoje isso seria silencioso → **absorvida pelo `CONTAI-010`**,
critério 16.

**Dores sem ticket, abertas no Gate Fiscal do `CONTAI-021` (18/08)**: **D24** —
o app não sabe qual ano-calendário já foi declarado, e sem isso nem o aviso do
021 nem o da D-018.2 conseguem ser verdadeiros (mesmo detector, construir uma
vez); **D25** — documento em duplicidade não tem saída depois do registro
("marcar como duplicata de X" é anotação, não delete).

⚠️ **Colisão de ID corrigida no Gate 4 do `CONTAI-019` (18/08)**: o número
**D24** estava sendo usado por **duas** dores abertas no mesmo dia. A do
*"regime de caixa"* foi renumerada para **D31** e virou o **`CONTAI-023`**.
**D24 = ano-calendário declarado; D31 = "regime de caixa" nas telas restantes.**
ID repetido em backlog vivo destrói a rastreabilidade que o ID existe para dar —
a partir da colisão, nenhuma das duas pode ser citada em ticket sem ambiguidade.

**Dívidas do Gate 2/4 do `CONTAI-019`**: **D28** (a tela promete que o relatório
trava e **nada trava** — a `US-004` **tem de** chamar `podeGerarRelatorioAnual`),
**D29** (`getByRole(…, { name })` sem `exact` erra na direção de **aprovar**),
**D30** (`pagamento_diferenca` aceita UPDATE no valor) e **D32** (enum fiscal sem
contrapartida em `docs/pareceres/` — vai junto com a D29, e **exige antes** a
regra de o parecer citar o identificador entre crases).

---

## Dívidas de escrituração

1. ~~**Quatro tickets decididos e não escritos**~~ — **PAGA em 18/08**: `019`,
   `016`, `017` e `006` escritos.
   **A dívida que os bloqueava encolheu à metade em 18/08**: o parecer do
   **compromisso** virou arquivo (`4e0cf87` →
   `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`) e **destravou o
   Gate 1 do 019**. ⚠️ **Continua só em transcript** o de **empreitada total ×
   parcial** (10/08, trava o ramo `total` do 016, aberto há oito dias).
   Materializar em `docs/pareceres/`.
2. ~~**CONTAI-003 sem Gates 3 e 4**~~ — **RECONCILIADO em 18/08**. O `cto-obra`
   cedeu à posição do `lead`, com emenda: *"Gate 3 não é pulado, é fechado por
   evidência registrada"*. Falta só o **commit de registro** dos dois passes.
   O gatilho de reabertura é único e está escrito: se o Gate 4 achar coisa que
   41 testes + produção não cobrem **e** que não cai no par 004+007.
3. **CONTAI-007 precisa de revisão de Passo 1** — seis pontos, incluindo uma
   contradição interna (declara que não precisa de mock e condiciona a própria
   aprovação a um).
4. ~~**Decisões tomadas sob a régua velha de cenário**~~ — **PAGA na 7ª revisão
   (23/08)**, caso a caso como o `cto-obra` pediu, e não em bloco. As três
   julgadas, com o resultado:
   1. **corte do Google Calendar — MANTIDO, com o fundamento trocado.** O veto
      original (*"não abre agenda no canteiro"*) **morreu** junto com a régua.
      O que sustenta o corte é outra coisa, e independe de onde ele usa o app:
      *"não pagar juros"* é **gestão de caixa** e não serve a nenhuma das três
      metas. O que serve — *data prevista passou sem confirmação* — o
      `CONTAI-019` já entrega **in-app, custo zero, sem OAuth**. Corte
      confirmado; o argumento do canteiro **não pode ser reusado**.
   2. **CONTAI-015 (captcha) — CORTE RE-RECOMENDADO, com argumento novo.** A
      objeção de fricção com uma mão caiu, mas a **razão de existir** do ticket
      caiu junto: ele protegia o limite de 2 e-mails/hora do código por e-mail,
      e o login virou **e-mail+senha em 18/08**. Ver a linha dele em "Depois".
      **Decisão do Mateus.**
   3. **CONTAI-007 — a contradição está RESOLVIDA: ele PRECISA de mock.** O
      *"não precisa, a tela é mínima para o polegar"* era argumento de captura
      aplicado a uma tela de **gestão**. A revisão de Passo 1 (dívida 3 acima)
      começa por este ponto, e a fila já o registra como travado em mock.
5. ~~**Dois briefs de agente contradizem o `CLAUDE.md`**~~ — **PAGA em 18/08**
   pelo Mateus, no commit `f7c22e6`: `.claude/agents/po.md` não diz mais
   *"venda + 5 anos"* e `.claude/agents/designer.md` não diz mais *"no canteiro…
   julgado nesse cenário primeiro"*. **Consequência que fica registrada**: toda
   decisão anterior a `f7c22e6` foi tomada com a régua velha reinjetada no
   prompt — quando uma delas for reaberta, o argumento "não cabe com uma mão"
   não vale sozinho para tela de gestão (é o item 4 acima).
6. **Condição fiscal em ticket sem parecer que a carimbe** — aberta em 23/08.
   O `contador` derrubou uma restrição que veio do **critério 13 do
   `CONTAI-003`**, escrita pelo `po` como *"**Restrição fiscal**: corrigir a obra
   de NF de serviço obriga a revalidar `cno_referenciado`…"*, citando **um
   ticket** (`CONTAI-007`, critério 2) e **nenhum parecer**. Ela sobreviveu 13
   dias, virou `podeCorrigirObra` — e o código a **endureceu** de *revalidar*
   para *recusar*, o que é uma segunda falha em cima da primeira — e travou um
   **P0**. Não é incidente: a **D32** já nomeara a mesma forma (*"enum fiscal sem
   contrapartida em `docs/pareceres/` é classe, não incidente"*). **Remédio
   proposto pelo `po` para o `/tickets-req`**, com a redação em
   `../backlog/22-2026-08-23-adendo-a-setima-revisao.md` — instalação em
   `.claude/commands/tickets-req.md` é do Mateus. **Varredura retroativa: o
   `grep` acha uma única linha ofensora hoje**, a do `CONTAI-003:359`, que este
   adendo já revoga.
