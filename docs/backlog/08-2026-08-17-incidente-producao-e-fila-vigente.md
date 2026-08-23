## Incidente de produção — 2026-08-17 — `permission denied for table obra`

**O que aconteceu.** App publicado, Mateus logou com sucesso e toda leitura
devolveu `{"code":"42501","message":"permission denied for table obra"}`. Não
era RLS — policy que nega devolve **lista vazia**; `permission denied for table`
é o Postgres barrando **antes** da policy, por falta de `GRANT`. Confirmado no
próprio projeto remoto: o PostgREST devolveu o diagnóstico na dica da resposta
("Grant the required privileges to the current role").

**Causa.** As migrations 0001-0004 criam tabela, índice e policy e **não
concedem privilégio nenhum**. Quem concedia era o `alter default privileges` do
schema `public`, que o stack local do CLI traz ligado e o projeto remoto (com
"expose new tables" desligado no setup) não tem. Corrigido pela migration
`0005_grants.sql`.

### O achado de processo — a regra de E2E contra o Postgres local tem ponto cego

A regra dura do projeto ("E2E roda contra o banco local em Docker, stub de
backend é proibido") continua certa e **não** está em questão. O que ela prova é
**comportamento**; o que ela não prova é **configuração**. O stack local do CLI e
o projeto remoto não são o mesmo banco, e toda divergência de configuração entre
os dois é invisível para teste de comportamento: os 30 E2E rodavam num banco
mais permissivo que a produção e passavam por isso, não apesar disso.

**É a segunda vez.** A primeira foi `numeric(14,2)` voltando do PostgREST como
number e não como string — E2E verde em cima de um formato inventado. Mesmo
padrão, sintoma diferente: o teste valida a suposição de quem escreveu o
ambiente, não o ambiente de verdade.

**O que se fez agora**, em ordem de valor:

1. **A migration revoga antes de conceder.** Não é só somar `GRANT`: `revoke all
   … from anon, authenticated` desfaz o que o default privileges do local havia
   dado. Depois da 0005 o banco local tem **exatamente** os privilégios do
   remoto para as cinco tabelas, e os 30 E2E existentes passaram a rodar sob o
   modelo de privilégio de produção. Efeito colateral revelador: dois testes
   alcançavam estado por `DELETE`, uma operação que o app **não pode** executar
   em produção — viraram andaime de administrador (ver CLAUDE.md).
2. **`e2e/privilegios.spec.ts`** compara o mapa de privilégios de `public` com o
   declarado. Tabela nova sem GRANT explícito deixa a suíte vermelha com o nome
   dela. É o que fecha o caso para as tabelas de amanhã.
3. **`alter default privileges` foi recusado de propósito** — resolveria a
   tabela futura e, ao resolvê-la em silêncio, recriaria a mesma classe de
   decisão invisível que causou o incidente. O argumento inteiro está por
   extenso em `supabase/migrations/0005_grants.sql`.

**O que continua descoberto, e é decisão do Mateus/`cto-obra`:** só as cinco
tabelas e o schema `public` foram normalizados. Auth, extensões, configuração do
PostgREST (schemas expostos, limites), políticas de storage no remoto, e
qualquer outro default do painel do Supabase seguem sem espelho no local. A
pergunta a fazer em todo ticket que toque schema: *isto depende de algum default
do stack local que o projeto remoto não tem?*

**Pergunta em aberto (P):** vale um smoke test pós-deploy que autentique no
projeto **remoto** com uma conta de verificação e faça um SELECT por tabela? É a
única defesa que pega divergência de configuração que nenhum banco local espelha
— e custa uma credencial de produção guardada em algum lugar, que é exatamente o
tipo de coisa que este projeto evita. Não implementado; decisão do Mateus.


### Fila revista — 2026-08-18 (6ª revisão) — **SUPERADA**

> **SUPERADA em 2026-08-23, e não por uma 7ª revisão: por mudança de lugar.**
> A ordem de execução passou a viver em `docs/tickets/README.md`, que é o
> arquivo que o gate atualiza. Esta fila ficou cinco dias afirmando que o
> `CONTAI-018` era o 1º item **com ele já em produção** — retrato datado dentro
> de diário não acompanha ticket que anda.
>
> **O que continua valendo aqui é o raciocínio**, não a ordem: as duas premissas
> que caíram, a reescrita da US-002, o Google Calendar descendo a P2 e os dois
> defeitos que vieram do uso real. Isso é registro e não se edita.
>
> ⚠️ A **7ª revisão continua devendo** — reordenar é ato do `po`, e ela se
> aplica no `README.md` dos tickets, não aqui.

*Substitui a 5ª revisão. Escrita depois de o app entrar em produção e de o
Mateus usá-lo com dado real — o que mudou mais coisa que dez dias de análise.*

**A premissa que caiu, e ela reordena tudo**: o problema nunca foi volume de
escopo, foi **nada ter ido ao ar**. Diagnóstico do `po` em 2026-08-17, com o app
ainda na `main`. Corrigido no mesmo dia: Vercel conectada, login por senha,
migration `0005_grants` aplicada no remoto, obra cadastrada, primeira NF
registrada.

**A segunda premissa que caiu, e é do Mateus (2026-08-18)**: *"quem gerencia a
obra, não gerencia do canteiro"*. O `CLAUDE.md` foi corrigido — gestão em casa é
o cenário **principal**; captura no canteiro é o **eventual**. **Isso torce para
trás várias decisões de 2026-08-17/18** que usaram "uma mão, com pressa" como
veto. Reavaliar caso a caso, não em bloco.

**Fila de implementação:**

1. **`CONTAI-018`** — vínculo pagamento↔nota. **P0, 1º.** Gate Fiscal fechado,
   mock em desenho. É o que faz o custo existir na tela: hoje `sustentaCusto`
   exige `status = 'conciliado'` e **nenhuma tela cria esse status**.
2. **`CONTAI-019`** — pagamento agendado (previsto × executado). **P1, 2º.**
   Desmembrado do 018 pelo `po` em 2026-08-18. Reescreve a **US-002**.
3. `CONTAI-014` (código) · `CONTAI-004` + `CONTAI-007` · `CONTAI-009` ·
   `CONTAI-005` reduzido.

**Bloco de deploy** (fora da fila de implementação): `CONTAI-012` ·
`CONTAI-013` (encolheu — SMTP e template saíram com a troca para senha) ·
`CONTAI-014` (prova no aparelho real).

**Depois:** `CONTAI-010` revisado (terreno financiado, Passo 1) ·
`CONTAI-011` · `CONTAI-016` · `CONTAI-017` · `CONTAI-015` (captcha, P2) ·
`CONTAI-008` · `US-008` (extração) · `US-009` · `US-012`.

#### US-002 — REESCRITA, não fundida

Deixa de ser *"fila de boletos a pagar com lembrete"* e vira **compromisso de
pagamento previsto**, com boleto sendo **uma origem** e o PIX agendado sendo
outra. Absorvida pelo `CONTAI-019`.

**A decisão de 2026-08-07** (*"o lembrete nasce junto com a confirmação do
boleto na ingestão"*) **está morta** — ela amarrava o lembrete ao boleto, e a
premissa não sobrevive ao previsto genérico.

**O Google Calendar desce a P2, com recomendação de corte** (`po`, 2026-08-18):
*"não pagar juros" não serve a nenhuma das três metas — é gestão de caixa.* O
que serve é **data prevista passou sem confirmação = dinheiro possivelmente fora
da obra sem registro**, e isso é pendência in-app, custo zero, sem OAuth.
⚠️ **Revisitar**: parte desse raciocínio assumia uso só no canteiro, premissa que
caiu no mesmo dia.

#### O que o uso real produziu em 24 horas

Os dois defeitos que mais importam **não vieram de análise, vieram de uso**:

1. **Duplicação**: a mesma despesa aparecendo como NF e como PIX, e nenhuma
   virando custo → `CONTAI-018`.
2. **A bifurcação de `/adicionar`**: nenhuma das duas opções é o caso comum
   (*"paguei e tenho a nota"* não tem porta) → diretriz de rótulo no 018.

E um terceiro, de processo: **o app promete por escrito o que não cumpre** —
*"a NF vincula depois"* na tela `/adicionar`. Virou o critério 19 do 018, com a
frase saindo **antes** do ticket fechar.

### Dores levantadas no Gate 2 do CONTAI-018 (2026-08-18)

Saíram do review fiscal (`contador`) e técnico (`cto-obra`) do vínculo
pagamento↔nota. **Nenhuma bloqueou o 018** — todas foram classificadas por eles
como ticket próprio. Estão aqui para o `po` priorizar.

1. **D-018.1 [P1] — o headline soma duas apurações que nunca se tocam.**
   `emPendenciaCentavos` (`lib/fiscal/resumo.ts`) soma, num único número em
   reais, exposição de **IRPF** (pago sem nota, quarentena) e exposição de
   **INSS** (NF de serviço sem retenção, pelo valor cheio da nota). Depois do
   018, a NF da WK conciliada mostra na home *"Custo confirmado R$ 3.000"*,
   *"Despesa comprovada R$ 3.000"* **e** *"Em pendência: R$ 3.000"*. Palavras do
   `contador`: somar as duas *"ensina exatamente o modelo mental errado que o §0
   do parecer existe para desfazer"*. É **pré-existente**, ficou mais visível.
   Separar `emRiscoIrpfCentavos` de `exposicaoInssCentavos`, com rótulo dizendo
   a qual conta cada um pertence. O `contador` escreve os dois textos.

2. **D-018.2 [P1] — vínculo novo pode mudar um ano JÁ DECLARADO, em silêncio.**
   Consequência direta da repartição cronológica ratificada (adendo de
   2026-08-18 ao parecer). Caso que vai acontecer: PIX de R$ 3.000 em dez/2026
   sem nota; DAA 2026 entregue em abril/2027; a NF chega em maio/2027 e é
   ligada. O custo de 2026 sobe R$ 3.000 — e a resposta certa é **retificar a
   DAA de 2026**, não jogar o custo em 2027. Hoje o app faz a conta certa e
   **não diz nada**: nenhuma tela distingue "ano em curso" de "ano já
   declarado". A ressalva do adendo (registro **retroativo** redistribui o
   conjunto) é a forma geral disso. ⚠️ **Retificadora exige CRC** — o app
   detecta e avisa; não decide nem redige. Primeira janela de dano: abril/2027.
   Ganhou superfície nova no 018: o rodapé do seletor pode mostrar um acréscimo
   **inteiramente de ano anterior** (`acumulado` sobe, `2026: R$ 0 → R$ 0`).

3. **D-018.3 [P2] — o saldo da nota parcialmente paga some da home.**
   NF de R$ 3.000 com R$ 1.000 pago e ligado: R$ 1.000 vira custo confirmado e
   os R$ 2.000 restantes não aparecem em lugar nenhum (não estão no terceiro
   número, que filtra notas **sem nenhum** pagamento; não são pendência; não são
   custo). **Regra do `contador`**: o terceiro número deve ser **Σ dos saldos
   não cobertos de documentos hábeis**, não Σ dos valores cheios de documentos
   sem pagamento — uma fórmula cobre os dois casos. O erro atual **subestima**,
   que é a direção segura. Como isso aparece na tela (junto das notas intocadas
   ou em linha separada) é **decisão do Mateus**.

4. **D-018.4 [P3] — ~~candidato oculto sem explicação~~ JÁ RESOLVIDO no Gate 2.**
   `CANDIDATO_OCULTO_PAGAMENTO`/`CANDIDATO_OCULTO_DOCUMENTO` foram implementados
   e são renderizados no seletor (correção C4). **Resíduo real, se houver**: a
   frase explica que o candidato sumiu, mas não oferece o caminho de desligar
   dali. Conferir no primeiro uso antes de virar ticket — não reimplementar o
   que já existe.

5. **D-018.5 [P3] — nota sem valor: avisa, mas não deixa completar.**
   `DOCUMENTO_SEM_VALOR` já foi implementado e aparece no seletor e na tela do
   documento (correção C5 do Gate 2) — o silêncio acabou. **Resíduo real**: o
   app diz que a nota sem valor não comprova nada e **não oferece o campo para
   informar o valor ali**. É a mesma família do §6 do parecer, que manda
   completar `numero`, `serie` e `data_emissao`.

6. **D-018.6 [P1 — reclassificado de P2 pelo `po` no Gate 4] — a confirmação de
   TODO registro afirma um prazo de guarda falso.** `app/_components/registrado.tsx`
   ainda diz *"fica disponível até a venda + 5 anos"*. O `CLAUDE.md` corrigiu
   isso em 2026-08-16: o relógio é o do CTN art. 173, I — venda em 2028 →
   **31/12/2034**, quase 7 anos, mais o **segundo relógio previdenciário** do
   CNO, e obra não vendida = **prazo indefinido**. Palavras do `po`: é texto com
   consequência fiscal, aparece na confirmação de **todo** registro, e **ensina
   o Mateus a descartar acervo anos antes do prazo real** — a meta 3 do produto
   inteira. Edição de uma linha, custo zero, dano potencial alto. É a doença do
   critério 19 sobrevivendo em outra tela.

7. **D-018.7 — o rótulo do rodapé do seletor mostra um DELTA sob um nome que na
   home nomeia um NÍVEL.** *"Custo confirmado se ligar agora: R$ 2.000,00"* pode
   ser lido como *"meu custo confirmado passa a ser R$ 2.000"*. Um `+` na frente
   ou *"o custo confirmado sobe R$ X"* elimina a ambiguidade. O rótulo veio do
   **mock aprovado**, então a mudança é do `designer` com o Mateus — não é
   decisão de engenharia nem do `contador`.

8. **D-018.8 [P2 — achado do `po` no Gate 4] — dois links seguidos com o mesmo
   rótulo, e o primeiro não faz o que diz.** O cartão "pago sem nota" da home e o
   botão da tela de detalhe do pagamento se chamam **ambos** *"Ligar a uma
   nota"*; o primeiro não liga nada — leva ao detalhe. O próprio E2E clica duas
   vezes no mesmo nome. Ou o cartão da home aponta direto para
   `/pagamento/[id]/ligar`, ou muda de rótulo. É a disciplina do critério 19
   (nenhuma tela promete o que não faz) aplicada a **botão**, não a frase.

9. **D-018.9 — DÍVIDA DE ARQUIVO, e bloqueia o Gate 1 do `CONTAI-019`.** O Gate
   Fiscal do 019 está *"fechado no mérito"*, mas o parecer do `contador` de
   2026-08-18 **só existe em transcript de sessão**. É a violação exata que o
   `CLAUDE.md` proíbe — *"parecer que só existe no transcript é a mesma falha que
   a regra proíbe, com outro nome"*. Materializar em `docs/pareceres/` **antes**
   de abrir o Gate 1 do 019. Recomendação do `po`: não abrir o 019 sem esse
   arquivo no disco.

### Dores da correção de documento — 2026-08-18 (origem: adendo + commit `b807901`)

Extraídas pelo `po` ao escrever o `CONTAI-021`. Origem: o **adendo de
2026-08-18** ao parecer `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md`
(§2 e §4) e o commit **`b807901`**, que implementou o primeiro passo da saída do
impasse — *"Link 'corrigir na nota' → edição do documento, com rastro"* — e
parou aí.

| ID | Dor | Origem | Prioridade |
|----|-----|--------|-----------|
| D23 | **O link "Corrigir na nota" está em produção e leva a uma tela que não corrige.** Nenhuma das telas do documento (detalhe, `/obra`, `/ligar`, `/desligar`) edita coisa alguma. É o critério 19 do CONTAI-018 (*nenhuma tela promete o que não faz*) violado por um **botão**. Consequência do mesmo commit: **nome de favorecido gravado errado é permanente** — o app deixou de renomear em qualquer fluxo, e o "ato deliberado com rastro" que deveria substituir isso não existe | `b807901` + adendo §4 | **P1**, vira **P0** no registro da 2ª nota (R$ 40.857,14) |
| D24 | **O app não sabe qual ano-calendário já foi declarado.** Sem esse dado, nenhum aviso de "isso mexe em ano já declarado" consegue ser verdadeiro: ou nunca dispara, ou dispara sempre. Inferir por calendário ("ano anterior = declarado") erra de **janeiro a abril**, que é exatamente a janela em que ele mexe no acervo. Falta uma informação simples que só o Mateus tem: *"DAA do ano X entregue em DD/MM/AAAA"*. **Trava o aviso preciso do CONTAI-021 e o da D-018.2 ao mesmo tempo** — as duas compartilham o mesmo detector | `contador`, Gate Fiscal do 021 | **P1** (destrava dois avisos fiscais) |
| D25 | **Documento registrado em duplicidade não tem saída depois do registro.** Não se resolve editando campo: precisa de *"marcar como duplicata de X"*, que é **anotação, não delete** (acervo append-only). O CONTAI-004 só **avisa no ato do registro**; passado esse instante, os dois registros convivem e a duplicidade é o erro que o parecer de 17/08 (§4) classifica como **gerador de passivo tributário** | `contador`, Gate Fiscal do 021 | **P1** (P0 quando houver o 2º registro do mesmo papel) |
| D26 | ⚠️ **Compra no cartão de crédito não tem onde morar, e o app finge que o problema é outro.** O Mateus paga parte do material no cartão; `meio = cartao` está **recusado na entrada** desde o CONTAI-001, e o comentário do código (`lib/fiscal/pagamento.ts:16-21`) justifica a recusa dizendo que *"cartão depende da Q4"* — a **Q4 fechou em 2026-08-08**. O bloqueio, por acaso, está certo: pelo adendo §B a compra **nasce compromisso**, e o custo é do ano em que a **fatura** é paga, não da compra. Mas hoje o efeito é que essas compras **não são registradas em lugar nenhum** — é a meta 1 falhando pelo lado de fora, exatamente como o compromisso do CONTAI-019 | `contador`, adendo §B do parecer de 18/08 | **P0 fiscal** → **`CONTAI-022`** (bloqueado pelo 019) |
| D27 | **O formulário de pagamento direto RECUSA a gravação sem comprovante, e a confirmação de compromisso não recusa — dois pesos para o mesmo fato do mundo.** O ADENDO 2 do `contador` derrubou o bloqueio: *"nunca recuse o registro de um fato consumado"* — grava, não entra no custo confirmado, vira pendência "pago sem comprovante". O atrito do bloqueio empurra para **não registrar**, que é a falha da meta 1. Reprovado também pelo Mateus lendo o mock | ADENDO 2 (`238a650`) + Mateus, 18/08 | **P1** → absorvido pelo **CONTAI-019** (critérios 46-48) |

**D23 tem dano ZERO hoje** e registro isso em vez de esconder: há **uma única
nota no banco, e ela está certa**. A prioridade vem do gatilho nomeado, não de
urgência de calendário.

**Duas mudanças de posição registradas no Gate Fiscal do 021** — o `contador`
corrigiu o próprio adendo, e o parecer novo
(`docs/pareceres/2026-08-18-correcao-de-documento-registrado.md`) prevalece:

1. **Rastro é obrigatório em TODA correção**, não só quando o documento já tem
   pagamento vinculado. *"Ter pagamento vinculado é estado mutável e futuro; o
   rastro que não foi gravado não se recupera."*
2. **`documento.favorecido_id` É corrigível** — o que é imutável é a **string
   CNPJ/CPF de um favorecido já cadastrado**. O adendo colapsava as duas coisas.

**Achado do `lead-engineer` que NÃO virou ticket**: `documento` não tem número
de nota no schema — isso já é o **`CONTAI-004`**, escrito e priorizado. Nada
novo a abrir.

**Achado do `lead-engineer` que virou decisão, não ticket**: a deriva de
privilégio (`update` em `favorecido` concedido e não executado desde `b807901`)
**morre por uso** no critério 6 do 021, sem migration de revogação. Revogar
agora para reconceder depois é churn de duas migrations e dois `db push`.

**Cinco decisões de escopo do `po` — 2026-08-19**, por delegação explícita do
Mateus, fechando os blocos âmbar do mock v1 do `CONTAI-021` (critérios 16-21 do
ticket). Em uma linha cada:

1. **Histórico de correções é exibido** no detalhe do documento — rastro que só
   o banco vê não cumpre a meta 3, e é `select` em tela que já existe.
2. **Formulário de pagamento pela metade: aviso, não rascunho** — com a saída
   barata dita na tela (o nome do emitente pode ser corrigido depois, e o
   pagamento aponta para o favorecido, não para o texto do nome).
3. **Nota substitutiva = anexo adicional do mesmo registro** na rodada 1 —
   registro novo sem estado "cancelada" dobraria `Σ documentos`. Vira registro
   próprio quando o `CONTAI-004` e a anotação da **D25** existirem.
4. **CNPJ errado ganha uma ação hoje**: marcar *"CNPJ errado — tratar"* como
   pendência, sem campo e sem mexer em status — porque impasse mudo empurra para
   trocar o nome, que é o dano que a tela existe para evitar.
5. **A pendência de retificadora é por ano, acumula correções, e só o Mateus a
   baixa** escolhendo um desfecho (retifiquei / contador avaliou / DAA ainda não
   entregue), gravado por INSERT; correção nova depois da baixa abre pendência
   nova. É a resposta ao "alarme que não desliga" recusado em 10/08 **sem** virar
   alarme que se apaga sozinho.

⚠️ **Dívida de processo, aberta aqui**: `.claude/agents/po.md` e
`.claude/agents/designer.md` ainda carregam as **duas premissas já corrigidas no
`CLAUDE.md`** — *"venda + 5 anos"* (corrigido em 16/08) e *"majoritariamente de
celular, no canteiro… julgado nesse cenário primeiro"* (corrigido em 18/08).
Os briefs reinjetam a régua velha em toda execução — inclusive no `/design`
deste ticket, que é justamente uma tela de **gestão**. Corrigir os dois arquivos
é decisão do Mateus (é configuração do time), não de agente.

---
