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

⚠️ **Pendente: a 7ª revisão.** A ordem abaixo é a 6ª (18/08) com os entregues
removidos por mim. Ela **não** absorveu o que mudou desde então — D41, D42, D43,
os dois P0 sem arquivo (`CONTAI-022`, `CONTAI-031`) nem o `CONTAI-031` bloqueando
a fatia 5 do `CONTAI-028`. Até o `po` reordenar, trate isto como inventário
ordenado, não como decisão de prioridade.*

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

## Em produção — o que já está no ar

| # | Ticket | Status | Ressalva viva |
|---|---|---|---|
| 001 | Ingestão de NF/boleto | ⚠️ **rebaixado em 18/08** (era "done") | os quatro hashes **não estão registrados**. O ticket está em produção e ninguém duvida disso — o que falta é a prova em formato auditável. Ressalva viva: critério 7 (≤3 interações) transferido à US-008 |
| 002 | Autenticação | ⚠️ **rebaixado em 18/08** (era "done") | mesmos quatro hashes ausentes. Ressalva **aberta**: R2 (prova no aparelho real) **transferida ao 014**, não resolvida. **Método trocado para e-mail+senha em 18/08** — reabre a validação de tela |
| 018 | Vínculo pagamento↔nota | ⚠️ `G1:b574316 G2:22279c0 G3:1710dc6 G4:3b9c26e` | **Quatro gates fechados e em produção** (push de 18/08, `b807901`). Fica ⚠️ e não ✅ porque os hashes acima foram **reconstruídos das mensagens de commit**, não lidos de um log de gate no ticket. Vira ✅ quando o `/develop` registrar os quatro no corpo do `CONTAI-018.md`. Corte vivo: critério 18 → `CONTAI-020` |
| 003 | Cadastro de obra e obra ativa | ⚠️ `G1:5550d11 G2:e72bf35 G3:papel G4:papel` | **Desempatado em 18/08**: o `cto-obra` adotou a posição do `lead`. G3 fecha por **evidência transitiva** (o quality do CONTAI-002 rodou sobre árvore que já continha o 003 — hash no ticket), G4 vira **passe de papel em paralelo**. Vira ✅ só **junto com o commit de registro** |

## Fila de implementação

*Renumerada em 2026-08-23: começava em 4 porque os itens 1-3 foram entregues e
migraram para "Em produção". Fechar o buraco é manutenção; **reordenar é ato do
`po`**, e a 7ª revisão continua devendo.*

| Ordem | # | Ticket | P | Status | O que trava |
|---|---|---|---|---|---|
| **1** | **021** | **Corrigir documento já registrado** | P1 | ✅ `G1:2cefc62 G2:29d6144 G3:e517cc2 G4:32914b1` | **DONE em 21/08 — os quatro gates, com o log no corpo do ticket.** Mock **v2** aprovado pelo Mateus em 19/08 (`ad07fd8`, 27 telas); Gate Fiscal em arquivo, com adendo de 19/08 (§5.1-5.5). Gate 2 fechou com **APPROVE dos dois revisores** depois de um loop de **seis bloqueantes** — o primeiro deles fiscal: a tela do desfecho misto afirmava número **falso, sempre para MAIS**. Gate 4 teve **um loop** (`3f04536`): o histórico mostrava o **token do enum** onde o mock mostra a frase do Mateus. Entregou o **critério 13**, que é conserto de bug **em produção** (`moverDocumentoDeObra`) — e **só do lado do documento**. ⚠️ **NÃO está no ar**: migration **0009** e assinatura de função alterada, `db push` **antes** do `git push`, quando o Mateus autorizar. Ressalvas vivas: **R1-R5** no backlog, das quais **R1-R3 viraram os critérios 13-15 do `008`**; **D35** (o app não abre anexo nenhum) virou dor P1 → **`CONTAI-027`, rodada 1** |
| **2** | **008** | **Mover PAGAMENTO entre obras sem quebrar o vínculo** | **P0** | 🟡 | **REABERTO em 19/08** — a condição que o segurava ("defeito inatingível pela interface") **caducou** quando o `CONTAI-018` foi ao ar em 18/08. `moverPagamentoDeObra` é o **mesmo `UPDATE` seco** do critério 13 do `021`, na direção espelhada: custo cai na origem, **"pago sem nota" sobe no destino** por um fato que não aconteceu, e sobra vínculo cruzando duas obras. **Trava**: mock (a tela espelhada não existe) + **pergunta 1 do Gate Fiscal**, aberta desde 10/08 (NF de serviço + CNO). **Dependência do `021` SATISFEITA em 21/08** (os quatro gates fechados) — a máquina que ele reusa (`revisao`, `ato_id`, função transacional, pendência por ano) existe. **Passa a ser a ordem 1 da fila.** Herdou do Gate 4 do `021` os **critérios 13-15**: dedupe do array de decisões, rastro do vínculo legível (UUID cru e hora **UTC**) e a morte do `corrigir-obra.tsx`. O critério 12 mudou de verbo: `alocarCusto` **reporta** o vínculo órfão, não basta comentário honesto |
| **3** | **019** | **Pagamento agendado (compromisso × pagamento)** | P1 | 🔨 | **G4 fechado em 18/08 após um FAIL e o conserto.** G1a `0441187` · G1b `df36b41` · G2 `50958a1` · G3 `3ec2913` · G4 `po`. O FAIL foi por **lastro documental** — a quinta resolução da diferença estava no enum e **não no parecer**; fechado pelo **ADENDO 4** (`d69a3cf`). ⚠️ **Ressalva viva: o mock v2 está DEFASADO em 4 pontos** (borda sólida no vencido, data pré-preenchida, s12 sem as cinco resoluções, sem a tela `/compromisso`) — tarefa do `designer`, **não bloqueia o PASS**, bloqueia quem for desenhar em cima. Ressalva **D28**: a `US-004` tem de chamar `podeGerarRelatorioAnual` |
| 1 | 014 | Manifest de PWA + prova no aparelho | P1 | 🟢 | Gate 0 substituído por aprovação de ícone |
| 2 | 004 | Nº do documento e data de emissão | P0 | 🟡 | **mock pendente** — mesmo passe do 007 |
| 2 | 007 | CNO referenciado na NF de serviço | P0 | 🟡 | **mock pendente** + **6 pontos a reescrever** |
| 3 | 009 | Detalhe do pagamento | P0 | 🟡 | Gate 0 aprovado 16/08; **5 perguntas em aberto** |
| 4 | 005 | Headline da home (reduzido a corte) | P0 | 🟡 | **mock v5 pendente**. Decisão nº 1 fechada em 17/08: R$ 49.850 |

*O `004` e o `007` dividem a ordem 5 de propósito: mesmo formulário, mesmo passe
de mock. O `008` entrou na ordem 2 em 19/08 e empurrou todos os demais um degrau:
não é preferência, é a **outra metade** do bug que o `021` conserta — deixá-lo
para depois de cinco tickets é manter a porta dos fundos aberta com a da frente
consertada, que é a pior combinação possível.*

⚠️ **`CONTAI-022` está RESERVADO e não tem arquivo** — é o **fluxo do cartão de
crédito** (dor **D26**), aberto pelo `contador` no adendo §B de 18/08: a compra
**nasce compromisso**, e o custo é do ano em que a **fatura** é paga. **P0
fiscal** — hoje essas compras não são registradas em lugar nenhum —, **bloqueado
pelo `CONTAI-019`** (precisa da entidade `compromisso`) e **precisa de mock
próprio**: o mock do 019 não tem uma única tela de cartão. A **regra fiscal já
está escrita**; falta ticket e Gate 0. O 019 fica com a **guarda** (critérios
25-27), que impede o custo de cair no mês errado enquanto isso.

⚠️ **`CONTAI-020` está RESERVADO e não tem arquivo** — é a **fila de
conciliação**, cortada do critério 18 do `CONTAI-018` (ver
`CONTAI-018.md:201`). Ele só vira ticket se a **pergunta aberta nº 2** do 018
disser que a home não basta. Não reutilizar o ID.

## Bloco de deploy — fora da fila de implementação

| # | Ticket | P | Status | Nota |
|---|---|---|---|---|
| 012 | Manter o Supabase acordado | P1 | 🟢 | sem tela, sem impacto fiscal |
| 013 | Configuração de produção do login | P0 | 🟢 | **encolheu** — SMTP e template saíram com a troca para senha |
| 014 | Prova no aparelho real | P1 | 🟢 | mesmo deploy de preview do 013 |

## Depois

| # | Ticket | P | Status | Nota |
|---|---|---|---|---|
| 010 | Terreno financiado (Passo 1: captura) | P0 | ✅ `G1:ebe0bfc G2:be31bc4 G3:f54751c G4:960578c` | **DONE em 19/08 — os cinco gates, com o log no corpo do ticket.** Migration **0008** (a primeira destrutiva do projeto: as tres colunas de terreno morrem, **sem backfill** — descarte autorizado pelo Mateus em 19/08). O Gate 2 deu **REQUEST CHANGES** nos dois: os bloqueadores eram o mesmo defeito **D34** em dois lugares — numero menor que a realidade **sem dizer que era menor**. ⚠️ **Ressalva viva, e nao e de software**: a obra esta com terreno **R$ 0,00** ate o Mateus redigitar os tres desembolsos com as datas e lancar o informe de 2025 — e o ano-base 2025 **ja foi declarado com o terreno dentro**. Seguros seguem **em aberto** (ADENDO 4). Passo 2 (criterios 17 e 20) foi para a **US-004** no backlog |
| 011 | Export do acervo | P0 | 🟡 | Gate 0 aprovado 16/08; **P1 do CTO** (fonte do estado) pendente. ⚠️ **Restrição nova de 21/08** (§4 do Gate Fiscal do `027`): com N anexos por lançamento, o índice do dossiê põe **cada anexo em linha própria com hash**, o **valor uma única vez na linha do lançamento** e a declaração de que os N anexos compõem **um** desembolso — *"um dossiê que induz soma errada é pior que um incompleto"* |
| 016 | Tipo de empreitada na obra | P0 | 🟡 | ramo `total` **bloqueado** — o texto do contador não está em arquivo. Não exige mock |
| 017 | Lista de notas a cobrar (tela 14) | — | 🟡 | **cortado**, com condição de volta escrita. Depende de 004 + 007 |
| 006 | Estados de rede lenta/indisponível | P1 | 🟢 | sem bloqueio. ⚠️ **rodar sozinho na árvore** — toca muitos arquivos |
| 015 | Captcha no login | P2 | 🟡 | mock pendente. `po` recomendou cortar; Mateus manteve como ticket |
| 022 | Cartão de crédito (compra → fatura) | P0 | 🔴 | **reservado em 18/08**, sem arquivo. Bloqueado pelo 019; regra fiscal pronta (adendo §B) |
| 023 | Tirar "regime de caixa" das 4 telas restantes | P2 | 🟢 | **criado no Gate 4 do 019** (18/08), da dor **D31**. Sem mock e sem Gate Fiscal — texto já ratificado no §F.5. **S.** Dos primeiros a ceder se a fila apertar |
| 024 | Corrigir informe/contrato do financiamento, **com rastro** | P1 | 🔴 | **criado no Gate 2 do 010** (19/08). O Gate 2 **tirou o `grant update`** de `financiamento` e `financiamento_informe`: grant sem tela nao entrega o remedio que promete — informe com **duas rubricas trocadas entre si** fecha a soma, entao nem a trava nem o CHECK acusam, e o `unique` trava o ano-base **para sempre**. Grant volta no mesmo diff que a tela e o historico. Inclui `previsto` -> `pago` |
| 025 | *"Paguei, mas nao sei a data"* — o terceiro estado | P1 | 🔴 | **criado no Gate 2 do 010** (19/08). O estado `(pago, sem data)` **ja e representavel e ja foi testado**, mas ficou inalcancavel depois do descarte do backfill. O formulario, diante de quem nao lembra o dia, **convida a inventar uma data**. Desempatar o criterio 3 do 010 contra o *"nao bloqueie quando o fato ja aconteceu"* do 019 e de `po` + `contador` |
| 026 | Terreno recebido (heranca, doacao, permuta) | P2 | 🔴 | **criado no Gate 2 do 010** (19/08). A natureza e oferecida e a tela explica que ha **data de aquisicao sem desembolso**, mas nao ha onde registrar o valor: quem escolher fica com **custo zero**. Nao afeta o Mateus (financiado) |
| 027 | **Ver o anexo, e anexar mais de um** | P1 | 🟡 | **criado em 21/08**, do **relato 004** (*"eu fiz mais de uma transferência"*). **Duas rodadas**: a **1** é a **D35** — o app não abre anexo nenhum, em tela nenhuma — e **vai primeiro**, sem migration; a **2** é a **D37**, N anexos por lançamento, começando pelo terreno. **Gate Fiscal fechado** (21/08): derrubou a trava de soma e o campo de data por anexo, e pôs no lugar **uma pergunta binária no 2º anexo** cuja pendência **bloqueia a discriminação do ano**. **Viabilidade fechada**: molde é **tabela filha por entidade** (no padrão de `documento_anexo`) — decisão de arquitetura para o modelo inteiro, aplicada **só ao terreno** agora. ⚠️ **Trava: mock (Gate 0) não existe** — rodar `/design`. ⚠️ A rodada 2 exige a **`0009` no remoto**: as duas migrations sobem no **mesmo `db push`**. **M**
| 028 | **Quebrar `lib/data.ts` em módulos por entidade** | P2 | 🟡 | **FATIA 1 DE 7 ENTREGUE em 23/08** (`a9ef819`): os 14 mappers puros foram para `lib/dados/comum.ts`, barrel de volta a **63 exports exatos**, golden snapshot byte a byte, 4 gates fechados. **Fatias 2-7 no fim da fila** (atrás do bloco fiscal). ⚠️ A **fatia 5 está bloqueada pelo `CONTAI-031`** — rede antes do refactor. | **criado em 22/08**, da dívida **D40** (`docs/backlog/16-2026-08-22-custo-de-contexto-do-pipeline.md`). Chore de **movimentação pura**: 2065 linhas / 63 exports / 36 importadores viram `lib/dados/` com 13 módulos, e `lib/data.ts` fica como **barrel** — nenhum importador no diff. **Sem UI**, sem mock, sem migration, sem `GRANT`. **Tem Gate Fiscal**: o arquivo é a única fronteira entre o banco e as duas apurações, e o `contador` nomeou 16 condições que o refactor preserva (`numericParaCentavos` aceitando `number` e string, `p_anos: []` na classificação, `ignoreDuplicates` em `garantirFavorecido`, o ato atômico do desembolso do terreno). Prova de equivalência = `npm run quality` verde **sem editar teste** + **golden snapshot byte a byte** contra o Postgres local. ⚠️ **Roda sozinho, com a fila parada** — toca o arquivo que quase toda tela importa. ⚠️ **P2 que cede a qualquer item fiscal em aberto**: a dor é do time de agentes, não do Mateus |
| 029 | Teste unitário para os **mappers** da camada de dados | P1 | ✅ `20d4d0e` | **DONE em 23/08**, 4 gates. 76 casos, 14/14 mappers, Vitest 412→488. Achou **D42** (condição fiscal 6 sem rede nenhuma → `CONTAI-031`) e **D43** (formato do rastro protegido por uma única asserção E2E). | **criado em 22/08**, do out-of-scope do `028`. ⚠️ **Corrige uma premissa errada**: `lib/data.test.ts` **não é monolítico** — tem **62 linhas**. O buraco são as **14 funções puras** de `row`→domínio dentro de `data.ts` (`paraObra`, `paraDocumento`, `paraAnosJson`, `paraAnoAfetado`, `agruparVinculos`…), **nenhuma exportada, nenhuma testada** — e é nelas que mora a assimetria deliberada `documento.valor null → null` × `pagamento → ?? 0` (unificar faz nota sem valor virar **R$ 0,00 declarado**). `lib/fiscal/*` já tem 5.400+ linhas de teste e `lib/money.ts` já cobre `numeric`↔centavos. **Bloqueado pelo `028` fatia 1**: testar antes exigiria exportar privado só para o teste ver, quebrando o critério 3 do `028`. Sem UI, sem migration |
| 030 | **Prazo de guarda que o app afirma depois de todo registro** | **P0** | ✅ | **criado e corrigido em 22/08.** Achado extraindo os specs dos mocks: `app/_components/registrado.tsx` dizia *"Original guardado no acervo — fica disponível até a **venda + 5 anos**"* **em produção**, depois de TODO registro. **Dois** erros: o prazo (atalho errado, corrigido em 16/08 — o relógio é o CTN art. 173, I; obra não vendida = **indefinido**) e a palavra *Original* (F3: *o papel é a prova, o arquivo é o localizador*) — a frase autorizava descartar o documento **e** o papel. Texto novo sancionado pelo `contador`, sem número de prazo em tela. ⚠️ O erro estava **no parecer** também (*"declaração que informar a venda"* × *última que informar **qualquer parcela***): corrigido **primeiro**, porque o LEIA-ME do `011` o copia literalmente. Nível 3 (só texto), sem mock. E2E `ingestao.spec.ts` reforçado com 2 asserções negativas |
| 031 | **E2E da condição fiscal 6 — a correção de classificação que não pode inventar retificadora** | P1 | 🔴 | **reservado em 23/08 no Gate 4 do `029`, ainda SEM ARQUIVO — precisa de `/tickets-req`.** Da dívida **D42**. O `contador` achou no Gate 2 do `029`: a condição *"só a classificação muda → `p_anos: []`, nenhuma pendência nasce"* **não tem rede nenhuma** — nem unitária (o call-site é I/O) nem E2E (`acervo.spec.ts:205` só abre a tela, não submete). Se quebrar, corrigir material↔mão de obra passa a **abrir pendência de retificadora sobre ano já declarado** por uma correção que não move um centavo; e o inverso, pendência que devia nascer e não nasce, é pior. Escopo: E2E que submete a correção de classificação e confere `revisao_ano_afetado` **vazio**, mais o **comentário-guarda** em `e2e/correcao.spec.ts:96` (D43) avisando que `depois` é **texto** e que uniformizar a asserção para `Number(...)` derruba a única rede do formato do rastro. **P1, não P0** — o código está certo hoje, falta rede. Entra **atrás** do bloco fiscal (Q14, `CONTAI-022` P0, D24, D25, D-018.1/2/9), mas **BLOQUEIA a fatia 5 do `CONTAI-028`**: rede antes do refactor, porque teste escrito por quem acabou de mover a linha prova a movimentação, não a regra |

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
4. **Decisões tomadas sob a régua velha de cenário** — as três mais afetadas,
   nomeadas pelo `cto-obra` em 18/08, **a reavaliar caso a caso**:
   1. **corte do Google Calendar** — o veto era *"não abre agenda no canteiro"*;
   2. **CONTAI-015 (captcha)** — o `po` recomendou cortar por fricção com uma
      mão; **em casa a objeção enfraquece**;
   3. **a contradição do CONTAI-007 sobre precisar de mock** — o *"não precisa,
      a tela é mínima para o polegar"* **perde o fundamento**. A revisão de
      Passo 1 do 007 deve reabrir este ponto primeiro.
5. ~~**Dois briefs de agente contradizem o `CLAUDE.md`**~~ — **PAGA em 18/08**
   pelo Mateus, no commit `f7c22e6`: `.claude/agents/po.md` não diz mais
   *"venda + 5 anos"* e `.claude/agents/designer.md` não diz mais *"no canteiro…
   julgado nesse cenário primeiro"*. **Consequência que fica registrada**: toda
   decisão anterior a `f7c22e6` foi tomada com a régua velha reinjetada no
   prompt — quando uma delas for reaberta, o argumento "não cabe com uma mão"
   não vale sozinho para tela de gestão (é o item 4 acima).
