# Índice de tickets — por ordem de execução

## 🔎 O que está em aberto — 10 tickets (mais 1 parado, aguardando o Mateus)

*Uma linha por ticket, sem justificativa. O **porquê** de cada posição está nas
seções longas abaixo; o **porquê da decisão** está em `../backlog.md`.
Atualizado em 2026-08-24 — `004` e `036` saíram da fila (entregues e
commitados); `027` saiu de "esperando commit" (commitado em 21/08, hash
`53acc37`). Alinhamento completo da fila no mesmo dia: `032`, `022`, `033`,
`031`, `035` ganharam ticket + mock (quando aplicável); `007`, `008`, `005`
tiveram mock desenhado e aprovado. `009` **saiu da fila** — reconciliação de
24/08 achou que ele já foi entregue via `CONTAI-018`, sem citação cruzada
(`docs/backlog/29-2026-08-24-reconciliacao-contai-009.md`); o único resto vivo
virou o `037` (XS, P1), ticket + mock escritos e aprovados no mesmo dia.

**2026-09-19**: entrou **`038`** (retenção variável em NF de serviço PJ, P0
fiscal), sequenciado logo depois de `035` por dependência técnica — precisa de
`lib/fiscal/gravidade.ts` (criado pelo `035`) para nascer sem cor literal
chutada. `035` perdeu o item F de escopo no mesmo dia (premissa fiscal
substituída pelo parecer que originou o `038` — não é mudança de
comportamento, é remoção). Decisão completa:
`docs/backlog/31-2026-09-19-sequenciamento-contai-035-038.md`.
**`038` ainda não está pronto para `/develop`**: falta rodar `/design` (mock
nível 1, repeater inédito). Os outros 9 itens da fila continuam prontos.

**2026-09-19**: **`032`** e **`022`** saíram da fila — implementados, testados
(617 unitários + E2E) e commitados (`13953f2`). Ver "Em produção" abaixo.

**2026-09-20**: **`033`** saiu da fila — implementado (`lead-engineer`),
revisado (`cto-obra`, APROVADO COM RESSALVAS não bloqueantes) e testado no
browser (639 unitários + 180 E2E, incluindo 3 bugs achados no teste manual e
corrigidos na hora — `docs/backlog/33-2026-09-20-tres-bugs-achados-no-teste-manual-do-contai-033.md`).
Commitado (`3c3f4de`). Ver "Veredito final" no corpo de `docs/tickets/CONTAI-033.md`.

**2026-09-20**: **`007`** saiu da fila — implementado (`lead-engineer`),
revisado duas vezes pelo Gate 2 (`cto-obra` + `contador`; a primeira rodada
voltou REQUEST CHANGES do `contador` por um erro fiscal real no critério 7 —
ver `docs/pareceres/2026-09-20-cno-nao-bloqueia-correcao-de-obra.md` — corrigido
e reconfirmado na segunda), testado (669 unitários + 195 E2E + validação manual
no browser: registro de NF de serviço com CNO desta obra/de outra obra/sem CNO,
tela de correção de obra, `/obras/[id]/notas-sem-cno`) e validado pelo `po`
(Gate 4 PASS). **Mudança de processo no mesmo dia**: o `/design` deixou de
exigir HTML e aprovação explícita — ver "Premissas de processo" no
`CLAUDE.md`.

**2026-09-20**: **`008`** saiu da fila — implementado (`lead-engineer`),
revisado pelo Gate 2 (`cto-obra` + `contador`, ambos APPROVE sem retrabalho —
a leitura fiscal já vinha corrigida pelo Gate 2 do `007` no mesmo dia),
testado (687 unitários + 202 E2E + validação manual no browser: duas obras
com CNO diferentes, NF de serviço + PIX vinculados, move do pagamento com a
nota "vai junto" mostrando o aviso e preservando o vínculo) e validado pelo
`po` (Gate 4 PASS). `app/_components/corrigir-obra.tsx` (órfão desde o `007`)
apagado. Dívida nova: **D60** (histórico de correção de pagamento invisível
em `/pagamento/[id]`, `docs/backlog/34-2026-09-20-contai-008-entregue.md`).

**2026-09-20**: **`005`** saiu da fila — implementado (`lead-engineer`),
revisado pelo Gate 2 (`cto-obra` APPROVE; `contador` REQUEST CHANGES na
primeira rodada, respondendo duas lacunas fiscais que o mock de 16/08 não
previa — "pago sem comprovante" vira 3ª parcela do headline, `nf_servico_sem_cno`
entra na base de exposição do INSS deduplicada por documento — parecer
`docs/pareceres/2026-09-20-gate-fiscal-contai-005-rodada-2.md`, ambos APPROVE
na segunda rodada), testado (712 unitários + 201/202 E2E — a falha restante é
um teste flaky de fuso horário, não fiscal, `docs/backlog/35-...md` — validação
manual no browser confirmando a decomposição de 3 parcelas) e validado pelo
`po` (FAIL na 1ª rodada por falta de parecer transcrito, PASS após o contador
escrever o parecer formal). Dívida nova: **D61** (`terrenoPagoSemComprovante`
fora do headline por corte de escopo herdado, mesma moeda fiscal — precisa de
decisão de arquitetura do `cto-obra`, `docs/backlog/36-2026-09-20-contai-005-entregue.md`).

**2026-09-20**: **`031`** saiu da fila — implementado (`lead-engineer`), sem
UI nova nem regra fiscal nova (cobertura de teste para a condição 6, já
adjudicada). Revisado pelo Gate 2 (`cto-obra` APPROVE, com um ajuste
cosmético de âncora por conteúdo já aplicado), testado (17/17 em
`e2e/correcao.spec.ts`; suíte completa 202/203, a única falha é a mesma
pré-existente e não-fiscal já documentada) e validado no browser (correção
de classificação real, material → mão de obra, custo não muda) e pelo `po`
(Gate 4 PASS).

**2026-09-20**: **`035`** saiu da fila — implementado (`lead-engineer`),
revisado pelo Gate 2 (`cto-obra` + `contador`, ambos APPROVE — item C tinha
9 sites, não 7 como o inventário original media, extensão confirmada
técnica e fiscalmente), testado (742 unitários + 203/204 E2E — falha
restante é a mesma pré-existente e não-fiscal já documentada — validação
manual no browser confirmando o item D vermelho + aviso condicional de
retificadora) e validado pelo `po` (Gate 4 PASS). `lib/fiscal/gravidade.ts`
criado — **destrava o `038`** (falta só `/design`, sem HTML nem aprovação
pela política atual).

**2026-09-21**: **`038`** saiu da fila — `/design` rodado (3 perguntas abertas
fechadas antes do Gate 1: correção de linha = remover+recriar com DELETE
concedido em `documento_retencao`, decisão de arquitetura do `cto-obra`;
pendência nova fora de `pagoSemComprovanteCentavos`; correção do gate vira
dívida D62). Implementado (`lead-engineer`), Gate 2 com uma rodada de
REQUEST CHANGES do `contador` (texto citava premissa morta "retenção de
11%", corrigido) e ajustes cosméticos do `cto-obra`, ambos APPROVE na
segunda rodada. Testado (791 unitários + 217/217 E2E + validação manual no
browser: gate de captura sem repeater, repeater completo com cascata,
pendência vermelha nascendo e aparecendo na home). Validado pelo `po` (Gate
4 PASS). **Commitado (`6dd771e`), mas NÃO pushado**: a migration `0017`
dropa `retencao_11`, e o critério 18 exige uma contagem no banco remoto
antes do `db push` — bloqueio genuíno de credencial/dado de produção,
aguardando o Mateus. Dívidas novas: **D62**, **D63**
(`docs/backlog/38-2026-09-21-contai-038-entregue.md`).

**2026-09-21**: **`006`** saiu da fila — implementado (`lead-engineer`),
revisado pelo Gate 2 (`cto-obra` APPROVE com 3 pendências pequenas; a 1ª
corrigida no mesmo commit — aviso de "sem resposta" disparava também em
escrita, movido para dentro do ramo repetível, com 2 testes novos), testado
(817 unitários + 220/220 E2E + validação manual no browser: Postgres local
pausado/despausado nos 4 estados de leitura/gravação, textos exatos do spec
confirmados, ambiente restaurado sem registro órfão) e validado pelo `po`
(Gate 4 PASS, 9/9 critérios). Decisão do `cto-obra` sobre a tensão critério
3×8: teto de leitura se prova por unitário com relógio injetado, não por
rota que pendura em E2E — o 503 do PostgREST continua a única falsificação
de rede permitida. Sem migration. Dívida nova: **D64**
(`docs/backlog/39-2026-09-21-contai-006-entregue.md`).

**2026-09-21**: **`034`** saiu da fila — implementado (`lead-engineer`),
revisado pelo Gate 2 (`cto-obra` APPROVE + `contador` REQUEST CHANGES numa
rodada — achou bug fiscal real, não só nota de cobertura: `cValor` em
`/compromisso/[id]/confirmar` pré-preenchia com o saldo previsto, mesma forma
da D44; corrigido dentro do próprio ticket por decisão do `contador`, virou
**D65**, RESPONDIDA), testado (839 unitários + 239 E2E + validação manual no
browser confirmando o campo vazio e o botão nomeando o que falta) e validado
pelo `po` (Gate 4 PASS, 12/12 critérios). Prova executável do invariante
"campo fiscal nasce sem default": `data-campo` amarra spec↔DOM, parser
`fail-closed` da seção `## Campos`, `e2e/campos-fiscais.spec.ts` classificando
as 40 rotas do app. Achou também **D66** (`unidades_autonomas` nasce `"1"`
contra o CONTAI-003, não corrigida — doutrina "prova, não conserta" do
próprio ticket). Sem migration.

**2026-09-21**: **`014`** ficou **PARADO, não fechado** — critérios 1-3
(ícone/manifest) exigem aprovação explícita do Mateus sobre a arte, e os
critérios 5-6 exigem teste no iPhone físico dele (com lembretes D+7/D+21 em
datas futuras) — nenhum dos dois é delegável a subagente. Só o **critério
4** foi implementado e fechado, isolado do resto (`maximumScale` sai do
viewport + inputs sobem para 16px, para não quebrar o auto-zoom do Safari
no canteiro), revisado pelo `cto-obra` (APPROVE) e testado (3/3 E2E novos +
suíte completa verde). Commitado (`e7dd434`). Nota de pausa no corpo do
ticket; retomar quando o Mateus puder aprovar o ícone e testar no aparelho.

### Fila de implementação — nesta ordem

| # | ID | O que é | P |
|---|---|---|---|
| 1 | **037** | **Porta para o pagamento conciliado a partir do documento** | P1 |

### Parado, aguardando o Mateus (fora da fila ativa)

| ID | O que é | P | O que falta |
|---|---|---|---|
| **014** | Manifest de PWA + prova no aparelho | P1 | Aprovar arte do ícone/`short_name` (critérios 1-3) e testar no iPhone físico (critérios 5-6, com lembretes D+7/D+21). Critério 4 já entregue |

### Bloco de deploy — fora da fila

| ID | O que é | P |
|---|---|---|
| **012** | Manter o Supabase acordado | P1 |
| **013** | Configuração de produção do login | **P0** |
| **014** | Prova no aparelho real | P1 |

### Depois

| ID | O que é | P | |
|---|---|---|---|
| **011** | Export do acervo | **P0** | serve à meta 3 |
| **016** | Tipo de empreitada na obra | **P0** | ramo `total` travado pela **Q14** |
| **024** | Corrigir informe/contrato do financiamento, com rastro | P1 | |
| **023** | Tirar "regime de caixa" das 4 telas restantes | P2 | |
| **017** | Lista de notas a cobrar | — | **corte**, com condição de volta |
| **028** | Quebrar `lib/data.ts` — fatias 2-7 | P2 | **corte proposto** |
| **015** | Captcha no login | P2 | **corte re-recomendado** |
| **026** | Terreno recebido (herança, doação, permuta) | P2 | **corte proposto** |

### O que segura a fila hoje

| | |
|---|---|
| **Espera o Mateus** | apenas a **Q14** (13 dias, trava o `016`) — nenhum mock pendente na fila ativa |
| **Saiu da fila, superado** | `009` — entregue via `CONTAI-018` sem citação cruzada; resto vivo virou o `037` |
| **Saiu da fila, entregue** | `032`, `022` — commitados em 2026-09-19 (`13953f2`); `033`, `007`, `008`, `005`, `031`, `035` — entregues em 2026-09-20; `038`, `006`, `034` — entregues em 2026-09-21 (**push pendente** — ver nota no topo); ver "Em produção" |
| **Parado, aguardando o Mateus** | `014` — só o critério 4 entregue; ícone/aparelho físico não são delegáveis |
| **Pronto para `/develop`** | `037` — único item restante da fila ativa |
| **Falta mock (`/design`)** | `038` — dependência técnica (`lib/fiscal/gravidade.ts`) já entregue pelo `035`; falta só rodar `/design` (sem HTML nem aprovação pela política atual) |

⚠️ **Esta tabela é resumo, não fonte.** Ela repete o que está abaixo — se
divergir, **vale o de baixo**, e o resumo é que está errado.

---

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

## ✅ RESOLVIDO em 24/08 — migrations 0009-0012 confirmadas no remoto

*Levantado na 7ª revisão (23/08), fechado em 24/08. Histórico, não é mais
bloqueio.*

`npx supabase migration list` em 24/08 confirma `0001`-`0012` **iguais** entre
Local e Remote — inclui `0009_correcao_documento.sql` (CONTAI-021),
`0010_terreno_anexo.sql` + `0011_resposta_recarimbada.sql` (CONTAI-027, que
ficaram pushadas em código sem a migration aplicada por 2-3 dias) e a nova
`0012_documento_numero_emissao.sql` (CONTAI-004, `db push` autorizado pelo
Mateus antes do `git push`, ordem respeitada). A regra do `CLAUDE.md`
(**migration antes de código, sempre**) segue valendo para toda migration
futura — este bloco fica só como prova de que o furo de 21-23/08 foi fechado.

## Em produção — o que já está no ar

| # | Ticket | Status | Ressalva viva |
|---|---|---|---|
| 009 | **Detalhe do pagamento** | ✅ **SUPERADO pelo `018`** | Implementado como critério 3 do `CONTAI-018` (18/08), sem citar o `009` uma vez — as duas dores de origem (D20, D21) resolvidas de carona, mas o ticket nunca apareceu como entregue nem pendente no índice. Reconciliado em 24/08 (`docs/backlog/29-2026-08-24-reconciliacao-contai-009.md`): critérios 2-7 confirmados contra o código real. Único resto vivo: pagamento CONCILIADO sem porta quando um documento tem mais de um pagamento vinculado — migrado para ticket pequeno próprio (S, P1), sem número ainda. Registrou **D56** (comprovante que falta em pagamento antigo, sem caminho de correção — fora de escopo, mock próprio no futuro) |
| 025 | **Desembolso do terreno sem data, sem comprovante, ou sem os dois** | ⚠️ `f5cc0ac` | **Fatia 1 ENTREGUE, 16/16** (Gate 4 em 24/08). A fatia 2 é o `CONTAI-036`, entregue no mesmo dia — ver linha própria abaixo. Resolveu a dor do relato 005 — o Mateus voltou a poder registrar. Fecha **D49**, **D50** e **D47**. Sem migration. Fica ⚠️ (um hash só, não os quatro de gate) pela mesma régua do `018`/`019`/`003` |
| 036 | **Fatia 2 do 025 — a linha do §4.5 nas saídas anuais, e a primeira tela de relatório anual do produto** | ⚠️ `2240931` | **Gates 0-4 fechados em 24/08, 16/16 critérios** (14 originais + 2 promovidos retroativamente no próprio Gate 4: 15 = composição material/mão-de-obra por ano, 16 = marca da porta não pode ser forjada — achado do `cto-obra`, provado com exploit plantado antes do fix pelo `lead-engineer`). `podeGerarRelatorioAnual` virou porta única com veto por bloco (`bensEDireitos`/`pagamentosEfetuados`/`afericaoInss`), destravando os dois portões que o `025` deixou fechados por tipo. Nova rota `/obras/[id]/discriminacao/[ano]`. Registrou **D55** (defeito vivo em `composicaoDaDiscriminacao`, no ar desde o `CONTAI-021` — agregado bate, peso por documento é arbitrário; não corrigido aqui, decisão do `po`). Vitest 591/591, Playwright 152/152. Sem migration. Fica ⚠️ (um hash só, não os quatro de gate) pela mesma régua do `018`/`019`/`003` |
| 004 | **Nº do documento, data de emissão e série** | ⚠️ `05cb1e7` | **17/17 critérios** (2 promovidos retroativamente: 16 = coluna `serie`, 17 = limitação assimétrica da detecção de duplicata). Migration `0012` (4 colunas nullable, sem default, sem backfill — `select count(*) from documento` no remoto confirmou zero linhas antes do push). `db push` autorizado pelo Mateus, aplicado **antes** do `git push`. `007` (CNO na NF de serviço) compartilha o mock e segue **não construído**. Fica ⚠️ pela mesma régua acima |
| 027 | **Ver o anexo, e anexar mais de um** | ✅ `G1:1ff74c9…53acc37 G2-G4:02fd6fb` | **Duas dívidas vivas: D47** (`perguntaPendente` sem superfície de tela — ticket novo, e o `contador` exige parecer do texto do chip ANTES do mock) e **D48** (a justificativa de `completarDesembolsoTerreno` não ser atômico invoca uma tela que não existe). ⚠️ **Item 12d PENDENTE**, critério 13 CORTADO. Placar: 22 itens — 20 PASS. O Gate 1 ficou **2 dias pushado sem revisor**; os Gates 2-4 rodaram em 23/08 e acharam um defeito de rastro fiscal que **nunca virou dado** só porque o banco de produção está vazio |
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
| 032 | Tirar `data = hoje` e `meio = "pix"` do formulário de pagamento | ⚠️ `13953f2` | **7/7 critérios, entregue em 2026-09-19** junto com o `022` (mesmo commit — ver a ressalva do `022` abaixo sobre o motivo de irem juntos). `decidirRegistro` só decide o destino quando `meio` e `data` foram digitados; até lá o formulário mostra o que falta, sem gravar. `RECUSA_CARTAO`/`RECUSA_CARTAO_ONDE_REGISTRAR` saíram daqui — o cartão foi para o fluxo próprio do `022`. 617 testes unitários + E2E verdes. Fica ⚠️ (commit único, sem os quatro hashes de gate) pela mesma régua do `018`/`019`/`003` |
| 022 | Cartão de crédito (compra → fatura) | ⚠️ `13953f2` | **16/16 critérios, entregue em 2026-09-19**. Migration `0013` (3 tabelas: `fatura`, `fatura_compromisso`, `fatura_desembolso` + 4 funções transacionais + `GRANT`s explícitos). `lib/fiscal/fatura.ts` novo (matemática de alocação do rotativo). 5 telas novas, `e2e/cartao.spec.ts` (10 testes) verde contra o Postgres local. **Commitado junto com o `032`** porque os dois evoluíram nos mesmos arquivos (`compromisso.ts`, `pagamento/page.tsx`) na mesma sessão sem commit intermediário — separar agora arriscava um estado quebrado no meio. **Corte de escopo disclosed**: `/fatura/[id]/alocar` só funciona chegando via `?desembolso=`; acesso direto mostra fallback em vez de seletor de desembolso. Fica ⚠️ pela mesma régua acima |
| 033 | Captura de documento sem arquivo (CTA) | ⚠️ `3c3f4de` | **Entregue em 2026-09-20**, revisado (`cto-obra`, aprovado com ressalvas não bloqueantes) e testado no browser (639 unitários + 180 E2E, 3 bugs achados no teste manual e corrigidos na hora). Migration `0014`. Fica ⚠️ (commit único, sem os quatro hashes de gate) pela mesma régua acima |
| 007 | CNO referenciado na NF de serviço | ⚠️ *(ver nota no topo do arquivo)* | **Entregue em 2026-09-20, 9/9 critérios.** Migration `0015` (`documento.cno_referenciado` + `nota_traz_cno`, tri-estado). Gate 2 rodou duas vezes: a primeira rodada do `contador` achou erro fiscal real no critério 7 (bloqueio indevido ao corrigir obra de um documento já lançado) — parecer `docs/pareceres/2026-09-20-cno-nao-bloqueia-correcao-de-obra.md` reverteu para aviso permanente, nunca bloqueio, e **invalidou a leitura anterior do `CONTAI-008`** (pergunta 1/critério 16 — já anotado no corpo daquele ticket). 669 unitários + 195 E2E + validação manual no browser. Gate 4 (`po`) PASS. **Mudança de processo no mesmo dia**: `/design` deixou de exigir HTML e aprovação explícita |
| 008 | Mover PAGAMENTO entre obras sem quebrar o vínculo | ⚠️ *(ver nota no topo do arquivo)* | **Entregue em 2026-09-20, 16/16 critérios** (2-16; 16 substituído, ver abaixo). Migration `0016` (`mover_pagamento_de_obra`, ato transacional espelho do `moverDocumentoDeObra` do `021`; guarda de contagem de decisões aplicada também em `mover_documento_de_obra`). Gate 2 aprovou sem retrabalho — a leitura fiscal já vinha corrigida pelo Gate 2 do `007` no mesmo dia. `app/_components/corrigir-obra.tsx` (órfão desde o `007`) apagado. 687 unitários + 202 E2E + validação manual no browser (duas obras, CNO diferentes, move com "vai junto" mostrando aviso e preservando o vínculo). Gate 4 (`po`) PASS. Dívida nova: **D60** (histórico de correção de pagamento invisível em `/pagamento/[id]`) |
| 005 | Headline da home: "Custo em risco no IR" | ⚠️ *(ver nota no topo do arquivo)* | **Entregue em 2026-09-20, 6/6 critérios da Parte A.** `emPendenciaCentavos` (4 moedas fiscais somadas) removido; `custoEmRiscoIr` (3 parcelas: pago sem nota, nota fora do CPF, pago sem comprovante) + `exposicaoInssBaseCentavos` (base, deduplicada por `documento.id`). Gate 2 fiscal voltou REQUEST CHANGES na 1ª rodada — o mock de 16/08 não previa "pago sem comprovante" nem `nf_servico_sem_cno` (nasceram depois, no CONTAI-019/025); o `contador` decidiu as duas lacunas, parecer `docs/pareceres/2026-09-20-gate-fiscal-contai-005-rodada-2.md`. Gate 4 (`po`) FAIL na 1ª rodada por falta do parecer transcrito (regra "parecer só em transcript é a mesma falha"), PASS depois de escrito. 712 unitários + 201/202 E2E (falha restante é teste flaky de fuso horário, não fiscal — `docs/backlog/35-...md`) + validação manual no browser. Dívida nova: **D61** (`terrenoPagoSemComprovante` fora do headline, mesma moeda fiscal, precisa de decisão de arquitetura do `cto-obra`) |
| 031 | E2E da condição 6 do Gate Fiscal (CONTAI-028) | ⚠️ *(ver nota no topo do arquivo)* | **Entregue em 2026-09-20, 8/8 critérios.** Sem UI nova, sem regra fiscal nova — cobertura de teste para a condição 6 (corrigir classificação nunca abre pendência de retificadora nem grava ano afetado), já adjudicada. `test.describe` novo em `e2e/correcao.spec.ts` + comentário-guarda da D43 ancorado por conteúdo. Gate 2 (`cto-obra`) APPROVE. 17/17 no spec tocado; suíte completa 202/203 (falha restante pré-existente e não-fiscal, `docs/backlog/35-...md`) + validação manual no browser (correção real material → mão de obra). Gate 4 (`po`) PASS. Marca a fatia 5 do CONTAI-028 como bloqueada por este ticket |
| 035 | Reconciliar a régua de cor (D39) com todo o app | ⚠️ *(ver nota no topo do arquivo)* | **Entregue em 2026-09-20, 11/11 critérios.** `gravidadeDaRegua(...)` (`lib/fiscal/gravidade.ts`) vira único produtor de `Gravidade` branded — zero cor literal sobrevive (D54). Itens B/C/D/E reconciliados em ~19 call sites; item C tinha 9 sites, não 7 (2 a mais nasceram no `CONTAI-008`, depois do inventário original) — extensão confirmada por `cto-obra` e `contador` no Gate 2, ambos APPROVE. 742 unitários (30 novos) + 203/204 E2E (falha pré-existente e não-fiscal, `docs/backlog/35-...md`) + validação manual no browser (CNPJ errado + pagamento de ano anterior → card vermelho + aviso condicional de retificadora). Gate 4 (`po`) PASS. Sem migration. **Destrava o `038`** |
| 038 | Retenção de NF de serviço PJ vira lista de linhas | ⚠️ **commitado (`6dd771e`), push pendente** | **Entregue em 2026-09-21, 18/18 critérios** (7a incluído). `retencao_11` sai do schema; entram o gate `retencao_na_nota` (captura) e a tabela `documento_retencao` (repeater na gestão). `retencao_sem_recolhedor` é a primeira pendência que AGRAVA a régua de cor. `lib/fiscal/risco.ts`/`afericao.ts` pararam de ler retenção para decidir abatimento do SERO (§2 do parecer 18/09 — efeito correto, não regressão). Gate 2 com 1 rodada de REQUEST CHANGES fiscal (texto desatualizado, corrigido), APPROVE na segunda. 791 unitários + 217/217 E2E + validação manual no browser. Gate 4 (`po`) PASS. **BLOQUEADO para `db push`**: critério 18 exige contar `retencao_11 is not null` no remoto antes da migration `0017` dropar a coluna — aguardando o Mateus rodar a contagem e o push. Dívidas novas: **D62**, **D63** |
| 034 | Campo fiscal não nasce preenchido, e o teste prova | ⚠️ **commitado (`79237c3`), push pendente** | **Entregue em 2026-09-21, 12/12 critérios.** `data-campo="<id do mock>"` amarra `design/mocks/*.md` a todo controle fiscal; `lib/design/campos-do-spec.ts` parseia a seção `## Campos` fail-closed (linha fora da gramática = vermelho com arquivo:linha, nunca `skip`); `e2e/campos-fiscais.spec.ts` exige toda rota de `app/**/page.tsx` classificada e cruza spec×DOM no instante em que a tela nasce. Provado contra a D44 real: reintroduzir `useState(hojeIso)`/`useState("pix")` deixa a suíte vermelha nomeando `fData`/`meio`. Gate 2 achou bug fiscal ativo (não só cobertura): `cValor` em `/compromisso/[id]/confirmar` pré-preenchia com o saldo previsto — mesma forma da D44 — corrigido dentro do próprio ticket por decisão do `contador` (**D65**, RESPONDIDA). 839 unitários + 239 E2E + validação manual no browser. Gate 4 (`po`) PASS. Sem migration. Dívida nova, não corrigida: **D66** (`unidades_autonomas` nasce `"1"` contra o CONTAI-003, fora do alcance da suíte hoje) |
| 006 | Estados de rede lenta/indisponível | ⚠️ **commitado (`234db4d`), push pendente** | **Entregue em 2026-09-21, 9/9 critérios.** Política de rede única em `lib/rede.ts` (`db.retry:false`): leitura 3 tentativas/teto 5s com texto honesto desde a 1ª falha; gravação 1 tentativa/teto 10s, nunca repetida, distinguindo "não foi salvo" de "não deu para confirmar" (evita duplicar registro). `Carregando` virou máquina de 4 níveis (45 usos/38 arquivos); novo trio `BotaoSalvar`/`AvisoDeGravacao`/`ErroDeGravacao`. Gate 2 (`cto-obra`) APPROVE com 1 rodada de rework (aviso de "sem resposta" disparava também em escrita — falso; corrigido, 2 testes novos). Decisão do `cto-obra`: teto de leitura se prova por unitário com relógio injetado, não por rota que pendura em E2E — o 503 do PostgREST segue sendo a única falsificação de rede permitida. 817 unitários + 220/220 E2E + validação manual no browser (Postgres pausado/despausado, 4 estados, textos exatos confirmados). Gate 4 (`po`) PASS. Sem migration. Dívida nova: **D64** |
| 014 | Manifest de PWA + prova no aparelho (critério 4 apenas) | ⚠️ **commitado (`e7dd434`)** | **PARADO em 2026-09-21** — critérios 1-3 (ícone/manifest) e 5-6 (teste no iPhone físico, lembretes D+7/D+21) exigem o Mateus pessoalmente, não delegável. Só o **critério 4** entregue: `maximumScale` sai do viewport, inputs sobem para 16px (evita auto-zoom do Safari no canteiro), com E2E travando a regressão. Gate 2 (`cto-obra`) APPROVE. 3/3 E2E novos + suíte completa verde. Ver nota no topo de `docs/tickets/CONTAI-014.md` para retomar |

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
⚠️ **`027`, `025` e `036` saíram desta tabela em 24/08** — os três estão
entregues e commitados; ver "Em produção" acima. `004` também saiu (entregue,
commit `05cb1e7`). **`032` e `022` saíram em 2026-09-19** (entregues,
`13953f2`). **`033`, `007`, `008`, `005`, `031`, `035`, `038`, `006` e `034`
saíram em 2026-09-20/21** (entregues — ver a nota no topo do arquivo; `038`,
`006` e `034` com push pendente). **`014` saiu para "Parado, aguardando o Mateus"** (só o
critério 4 entregue). Nenhum item desta tabela fica sem construir.

| **1** | **034** | **Campo fiscal não nasce preenchido, e o teste prova** | P1 | 🟢 **pronto para `/develop`** | Chore de infraestrutura de teste, sem Gate 0 (sem tela) e sem regra fiscal nova. `data-campo` nos controles + parser `fail-closed` do `## Campos` dos specs (`design/mocks/*.md`) + `e2e/campos-fiscais.spec.ts` enumerando rotas/controles. Prova contra a D44 real (`useState(hojeIso)`/`"pix"` tem que acender vermelho). Decisão já delegada pelo Mateus em 23/08 |
| **2** | **037** | **Porta para o pagamento conciliado a partir do documento** | P1 | 🟢 **pronto para `/develop`** | Nasceu em 24/08 da reconciliação do `009` (único trabalho vivo do que sobrou). Ticket + mock nível 3 escritos e aprovados em 24/08 (`docs/tickets/CONTAI-037.md`, `design/mocks/CONTAI-037.md`) — complexidade XS, sem migration, um `BotaoLink` a mais numa linha que já existe |

### ⚠️ O que a fila diz de si mesma, e é desconfortável

**O quadro virou por completo no fim de 24/08.** Era oito de onze travados em
23/08. Uma rodada de `/tickets-req` cobrindo os quatro tickets sem arquivo
(`022`, `031`, `033`, `035`) seguida de `/design` em todos os mocks pendentes
da fila (`032`, `022`, `033`, `035`, `008`, `005`) — mais a reconciliação do
`009` (que virou `037` no meio do caminho) — deixou **os 11 itens da fila,
todos, prontos para `/develop`**. O `009` original não é mais item travado:
reconciliação de 24/08 achou que já estava entregue via `CONTAI-018` desde
18/08, sem citação cruzada nenhuma
(`docs/backlog/29-2026-08-24-reconciliacao-contai-009.md`); o único resto
vivo (porta para pagamento conciliado) virou o `037`, ticket + mock também
fechados no mesmo dia. O gargalo histórico do projeto (fila de mocks
esperando o dedo do Mateus) **zerou** nesta rodada; o volume de trabalho que
se abre agora em `/develop` é grande o suficiente para valer a pena avisar
antes de começar, não depois.

*(Nota histórica, 23/08: o `025` foi o primeiro item da classe P0 em vários
dias cuja trava não era o dedo do Mateus — Gate Fiscal fechado, sem mock novo.
Entregue no dia seguinte, junto com a fatia 2, `036`.)*

⚠️ **`CONTAI-020` está RESERVADO e não tem arquivo** — é a **fila de
conciliação**, cortada do critério 18 do `CONTAI-018` (ver
`CONTAI-018.md:201`). Ele só vira ticket se a **pergunta aberta nº 2** do 018
disser que a home não basta. Não reutilizar o ID.

## Bloco de deploy — fora da fila de implementação

*Ordem alterada na 7ª revisão: o item **0** não é ticket e vem antes de tudo.*

| # | Ticket | P | Status | Nota |
|---|---|---|---|---|
| **0** | ~~Aplicar `0009` e `0010` no projeto remoto~~ | **P0** | ✔️ **FEITO em 23/08** | **Não é ticket, é a ordem obrigatória do release invertida.** Ver o BLOQUEIO DE RELEASE no topo deste arquivo. `npx supabase db push`, conferir em Database → Migrations, e só então seguir. **Bloqueia o `013` e qualquer deploy novo** |
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

⚠️ **A `US-004` já nasce com três obrigações herdadas, e elas NÃO podem viver só
no ticket que as transferiu** (registrado no Gate 4 do `CONTAI-027`, 23/08):

1. **D28** — a tela promete que o relatório trava e nada trava: a `US-004` **tem
   de** chamar `podeGerarRelatorioAnual`.
2. **Critério 12c do `CONTAI-027`, terceira superfície** — a pendência *"Um
   lançamento, mais de uma data"* aparece na **lista de revisão
   pré-declaração**, e ali ela **não é dispensável, adiável nem colapsável**.
3. **Critério 12d do `CONTAI-027`** — **nenhum** texto de pendência, alerta ou
   instrução nossa entra em **área copiável**, neste ou em qualquer relatório: o
   bloco é colado literalmente na ficha Bens e Direitos e aviso lá dentro vira
   **texto declarado à RFB** (IN SRF 84/2001, art. 17). **Regra geral, não
   exceção de um ticket.** Texto no §4c de
   `docs/pareceres/2026-08-21-gate-fiscal-contai-027-criterio-13.md`.

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
