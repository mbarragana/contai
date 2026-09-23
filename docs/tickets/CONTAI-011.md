# CONTAI-011 (011-A) — Export do acervo: rotina periódica + sinal no app

## 🛑 EM ESPERA — decisão do Mateus, 2026-09-23

Implementação do Gate 1 concluída (DONE, não commitada) mas **posta em espera
antes do Gate 2** — não é falha técnica, é lacuna de requisito descoberta
tarde demais para ser barata de corrigir agora.

**A lacuna**: todo o desenho de "Export do acervo" (deste ticket e do
`CONTAI-049`/`CONTAI-050`) assume um único destino fixo — o Google Drive do
Mateus, com credencial guardada centralmente (GitHub Secrets/Vercel). Isso
não escala se o contai deixar de ser ferramenta pessoal e virar produto
multiusuário: cada usuário precisaria conectar o **próprio** Drive (fluxo de
OAuth por usuário, token por usuário, sem credencial compartilhada) — desenho
bem diferente do que foi especificado e implementado aqui. Palavras do
Mateus: *"e se eu quiser tornar o app público e ter outros usuários, eles têm
que ser capaz de colocar no drive deles o export."*

**Condição de retorno, escrita para não depender de lembrança**: só retomar
`011-A`/`049`/`050` — Gate 2 em diante, e qualquer novo `/design` que a
correção de requisito exigir — **quando o fluxo comum de registrar despesas e
apurar custo (captura, conciliação, discriminação anual) estiver estável e
correto**. Guarda documental é a meta 3; o fluxo de despesas é as metas 1 e 2,
e não faz sentido aprofundar infraestrutura de exportação multiusuário antes
de o core do produto — single-tenant, hoje — estar redondo.

**O que NÃO fazer enquanto isso está em espera**: não iniciar Gate 2, não
fazer `db push` da migration `0018`, não commitar o trabalho do Gate 1 (fica
na árvore de trabalho ou em stash/branch, decisão de quem retomar). Não
apagar o trabalho feito — o desenho single-tenant pode sobreviver como está
se o Mateus decidir não abrir o produto para terceiros; a dúvida é se vale a
pena, não se está errado para o uso dele sozinho.

---

⚠️ **FATIADO em 2026-09-23 — este arquivo é só o 011-A.** O `lead-engineer`
tentou o Gate 1 do ticket original (que cobria rotina + triagem de órfão +
dossiê sob demanda) e devolveu sem implementar nada: dois achados de fundo
(um de arquitetura, um fiscal/produto) que ninguém tinha visto até então.
O `po` fatiou em três, com autoridade de backlog (mesmo padrão dos
`CONTAI-043`-`046`):

- **`CONTAI-011` (011-A, este arquivo)** — rotina periódica + sinal no app.
  Critérios 1, 2, 3, 5, 6, 8, 9, 11, 13, 14 + **detecção** de objeto órfão
  (sem a triagem completa). **Zero decisão pendente. Pronto para `/develop`.**
- **`CONTAI-049` (011-B)** — triagem completa do objeto órfão (critério 15
  original, os três destinos). Estava bloqueada pelo achado fiscal/produto
  (ver abaixo); **destravada em 2026-09-23** pelo `contador`.
- **`CONTAI-050` (011-C)** — dossiê sob demanda, por obra (critérios 4, 10 e
  12 originais). Estava bloqueada pelo achado de arquitetura (ver abaixo);
  **destravada em 2026-09-23** pelo `cto-obra`.

**Os dois achados, resumidos** (detalhe completo em
`docs/backlog/62-2026-09-23-fatiamento-contai-011.md`):

1. **Arquitetura (`cto-obra`)** — a Decisão 2 abaixo (service role key e
   refresh token do Drive só em GitHub Secrets, nunca na Vercel) deixava sem
   resposta "quem roda o dossiê sob demanda quando o Mateus clica o botão".
   Resolvido: fila de pedidos no Postgres (`export_solicitacao`) + o app
   "acorda" o workflow do GitHub via `workflow_dispatch` **sem nenhum
   parâmetro**, com um PAT fine-grained, só-Actions, só-este-repo, guardado em
   env server-only da Vercel. Essa credencial não lê dado fiscal nenhum e não
   aceita input — por isso não repete o problema que a Decisão 2 evitava.
   Detalhe em `docs/tickets/CONTAI-050.md`, "Viabilidade (CTO)".
2. **Fiscal/produto (`contador`)** — a triagem de órfão previa "vincular" um
   objeto a qualquer documento, mas a migration `0014` só permite isso quando
   o documento-alvo **ainda não tem arquivo** (`anexar_arquivo_documento`
   opera só `where arquivo_path is null`; o trigger
   `documento_arquivo_path_imutavel` proíbe reescrever). O `contador`
   confirmou que a restrição está **certa e não muda** — reescrever
   apagaria o lastro dos dois checks fiscais já afirmados sobre aquele
   arquivo. "Vincular" vira duas rotas: **(a)** documento sem arquivo — já
   funciona, sem mudança de modelo; **(b)** documento já tem arquivo — via
   `documento_anexo` como anexo adicional do mesmo desembolso, **nunca**
   reabrindo os dois checks fiscais do arquivo original; se o papel novo
   muda a resposta fiscal (ex.: nota substitutiva com CNPJ diferente), não é
   "vincular", é correção (`corrigir_documento`). Detalhe e a decisão sobre
   os campos do 3º destino (documento sem gasto) em
   `docs/tickets/CONTAI-049.md`.

O texto abaixo é o ticket original, **podado** para o escopo do 011-A: os
critérios que saíram estão marcados `~~riscado~~` com o destino, não
apagados — é a mesma convenção já usada aqui para o antigo critério 7
(virou `CONTAI-012`).

## Tipo e Prioridade

- **Tipo**: infraestrutura de dados + meta 3 (acervo que sobrevive ao prazo de
  decadência — CTN art. 173, I, **não** "venda + 5 anos"; ver `CLAUDE.md`)
- **Prioridade**: **P0**
- **Origem**: US-011 do `docs/backlog.md`
- **Posição na fila**: **FORA da R1.** 2º item pós-R1, pareado com a US-010
  (4ª revisão da fila, 2026-08-16). A proposta de promover para a R1 foi
  **rejeitada pelo `po`** — justificativa na "Dor de Origem".
- **Gate 0 (mock)**: **APROVADO pelo Mateus em 2026-08-16** —
  `design/mocks/CONTAI-011.html`, v1, 23 telas. Cobre a linha de estado na home
  (com um estado âmbar intermediário que o ticket não pedia), a triagem do
  critério 15 com os três destinos, e o dossiê por obra com acesso nomeado e
  revogável.
  ⚠️ **A aprovação é do desenho e do fluxo.** Esta linha citava "3 perguntas
  bloqueantes (P1, P2 e P3, em 'Perguntas Abertas')".
  🔍 **Investigação do `po`, 2026-09-23 — essa numeração nunca existiu como
  conjunto.** A seção "Perguntas Abertas" só teve M1–M4 (perguntas ao
  Mateus); o Gate Fiscal só teve F1–F4 (perguntas ao contador, as 4 já
  fechadas — ver "Gate Fiscal" abaixo); `grep -rn` em `docs/backlog/` e
  `docs/pareceres/` não acha "P1", "P2" nem "P3" nomeados em lugar nenhum.
  O único item com identidade própria e rótulo de bloqueio é o da lista
  "Dúvidas" do mock (`design/mocks/CONTAI-011.md`, final do arquivo):
  *"De onde o app lê o estado do export?"*, marcada ali, textualmente, como
  "bloqueante do Gate 2" — **é esse o P1** que o resto do cabeçalho já tratava
  como pré-requisito duro (sem ele o critério 6(c) não existe, e o ticket
  vira o cron que morre em silêncio do próprio pre-mortem).
  ✅ **P1 RESOLVIDA em 2026-09-23 pelo `cto-obra`** — tabela `export_execucao`
  no Postgres do próprio app; ver "Decisão 4" em "Viabilidade (CTO)".
  ❌ **P2 e P3 não existem — declarado aqui, não inventado.** Ninguém os
  nomeou, em ticket, backlog ou parecer. A frase "3 perguntas bloqueantes"
  era imprecisão de quem escreveu o cabeçalho, corrigida nesta entrada. O
  veredicto do Gate Fiscal (`docs/pareceres/2026-08-16-gate-fiscal-contai-011.md`)
  já é categórico sobre o que bloqueia: **só R1–R5**, todos incorporados aos
  critérios 3, 8, 12, 13 e 14; R6–R10 "entram como notas e podem ser
  resolvidas no Gate 2 pelo `cto-obra`" — não há um segundo e um terceiro
  bloqueio fiscal escondido. O resto das "Dúvidas" do mock (numeração de lei
  do LEIA-ME, conflito critério 12 × R6, perguntas sobre `drive.file` e
  reconexão do Drive, campos da categoria "documento da obra", "gerar assim
  mesmo", busca de vínculo em outra obra) são reais, mas **nenhuma bloqueia
  o Gate 1** — são notas de Gate 2 / implementação, listadas no "Veredicto"
  no fim deste arquivo.
- **Gate Fiscal**: `docs/pareceres/2026-08-16-gate-fiscal-contai-011.md` —
  APROVADO COM RESSALVAS (R1–R5 bloqueantes, já incorporadas abaixo).

## Dor de Origem

O `CLAUDE.md` registra como **requisito permanente**: "exportação periódica dos
documentos para storage do próprio Mateus (ex: zip mensal no Google Drive) — a
guarda até venda+5 anos não pode depender de free tier de terceiro."

Hoje isso não existe em nenhuma linha de código. O acervo inteiro vive em
exatamente um lugar: o bucket `acervo` do projeto Supabase
`holgxocpmffwrlhwfqjn` (us-west-2), em plano gratuito, sem cópia em lugar nenhum.

**Origem, com a ressalva declarada**: esta é a única story P0 do backlog que
**não veio de relato do Mateus** — veio de uma linha do `CLAUDE.md`. Como as D19
e D22 do Gate 2, é dor não sentida ainda, que se sentiria uma vez só, tarde e
sem conserto. Registrado assim em vez de vestido de urgência vivida.

**O que hoje está de fato em risco: quase nada, e isso decide a fila.** O contai
nunca esteve em produção; no Gate 2 do CONTAI-003 a tabela `obra` do projeto
remoto estava vazia. O bucket protege hoje volume próximo de zero. **O risco
desta story nasce no dia do deploy da R1 e cresce por mês** — o que faz dela o
primeiro item pós-R1, não um item da R1.

**O horizonte que o requisito nomeia é maior do que a vida útil provável de
qualquer rotina agendada em free tier.** O prazo real não é "venda + 5 anos": é
5 anos do 1º dia do exercício seguinte à última DAA que declarou o ganho (CTN
art. 173, I) — para venda em 2028, **31/12/2034**, quase 7 anos; e **indefinido**
enquanto não houver venda. Nenhum cron sobrevive sozinho a isso. Por isso este
ticket entrega **duas** saídas e não uma: a rotina periódica (protege o
acumulado durante a obra) e o **export sob demanda por obra** (o dossiê, que é o
que a venda pede e o que sobrevive ao app).

### O que este ticket NÃO resolve

O argumento do auto-pause do free tier (projeto pausado após ~7 dias sem
atividade) foi **desmembrado** para o **CONTAI-012**. Ele é pré-requisito de
*deploy*, não de *release*, e não protege o acervo.

## User Story

Como dono da obra, quero que os originais do acervo sejam copiados
periodicamente para um storage que é meu, com índice legível sem o app, para
que a comprovação do custo de aquisição sobreviva mesmo que a conta do
Supabase, o app e o repositório não existam mais.

*(A segunda metade da história original — "e quero poder gerar sob demanda o
dossiê completo de uma obra... ao comprador e ao contador dele na venda" —
é o `CONTAI-050` (011-C). Fatiada porque tem executor e credencial próprios,
não porque deixou de importar.)*

## Critérios de Aceite

1. [ ] **Verificável sem ler código**: passada uma periodicidade cheia sem
   ninguém tocar em nada, existe no storage do Mateus um pacote **novo**, com
   data, produzido sem intervenção. O teste é olhar a pasta, não o workflow.
2. [ ] Ao fim de cada execução, a **contagem de objetos referenciados pelo
   banco** (`documento.arquivo_path` + `pagamento.comprovante_path`) é igual à
   contagem de objetos presentes no destino (acumulado). Divergência não é
   registro em log: falha a execução e dispara o critério 6.
3. [ ] **(R1 do contador)** O índice é **legível sem o app** e tem forma
   relacional, não achatada: `documentos.csv`, `pagamentos.csv` e
   `vinculos.csv` (par documento↔pagamento com o valor imputado). JSON
   equivalente ao lado, opcional.
   - **`documentos`**: obra (nome + matrícula + CNO), tipo, favorecido (nome +
     CPF/CNPJ completos), **número** e **data de emissão**, valor total,
     **material vs. mão de obra**, **retenção de 11% (sim/não/a confirmar)**,
     **CNO referenciado na nota**, **status (registrado / quarentena, com
     motivo)**, caminho no pacote, tamanho, **sha256**.
   - **`pagamentos`**: valor, **data de pagamento**, ano-calendário derivado
     dela, meio e — no cartão — as **duas datas** (`data_compra` e
     `data_pagamento` da fatura, Q4).
   - ⚠️ **Uma linha por arquivo com um campo "valor" é PROIBIDO.** O modelo é
     N pagamentos ↔ 1 documento (Q6); achatar induz quem ler a somar a coluna e
     chegar num custo que não é de ano nenhum.
4. [ ] ~~O export é **segmentável por obra**...~~ **MOVIDO — `CONTAI-050`
   (011-C).** A rotina periódica deste ticket exporta o acumulado de todas as
   obras do usuário (é o que protege o acumulado durante a obra); segmentar
   por UMA obra só importa para o dossiê sob demanda, que é o que a venda
   pede. `where obra_id = X` já é de graça pela Decisão 0 abaixo — o 011-C
   só precisa expor o parâmetro, não reconstruir a query.
5. [ ] O índice cobre **100%** dos objetos exportados: nenhum arquivo no pacote
   sem linha no índice, nenhuma linha apontando para arquivo ausente.
   Divergência falha a execução, alto e visível.
6. [ ] **Falha é visível, inclusive a falha de não ter rodado.** Três modos
   distintos, e o ticket só fecha se os três forem cobertos:
   - **(a) rodou e deu erro** → alerta ativo no canal definido em M3;
   - **(b) rodou e exportou menos do que devia** → cai nos critérios 2 e 5, que
     falham a execução e caem em (a);
   - **(c) não rodou** — o mais provável e o único que nenhum alerta-em-falha
     detecta, porque silêncio é indistinguível de sucesso. Cobertura
     obrigatória: **sinal positivo com validade**, visível dentro do app —
     *"último export bem-sucedido: há N dias, X arquivos"*, em **estado de erro**
     quando N passar de 2× a periodicidade. Sem este item o critério 6 é
     decorativo e o ticket é placebo.
   - ⚠️ Restrição de desenho: a detecção de (c) **não pode** depender de outro
     serviço gratuito de terceiro. Mitigar dependência de free tier com outra
     dependência de free tier é como esta story falha de novo, com outro nome.
7. [ ] ~~A rotina toca o banco Postgres...~~ **REMOVIDO** — virou
   **CONTAI-012**. Motivo: com o critério escrito aqui, um job que só bate no
   banco cumpriria o ticket e falharia a story sem nenhum teste ficar vermelho.
8. [ ] **(R2 do contador)** Integridade verificável sem abrir os arquivos: o
   índice registra **sha256 e tamanho** de cada arquivo, gravados no momento do
   export, e existe procedimento documentado de conferência que roda sobre o
   pacote **sem o contai e sem o Supabase**. Contagem e tamanho sozinhos
   detectam ausência, não corrupção.
9. [ ] Nenhum segredo (service role key, token de longa duração de escopo amplo)
   fica versionado. O repositório **é público — confirmado em 2026-08-16**.
   Requisitos: segredo só no secret store do runner, escopo mínimo, e **caminho
   de revogação escrito no ticket**.
10. [ ] ~~Export sob demanda, por obra (dossiê)...~~ **MOVIDO — `CONTAI-050`
    (011-C).** Era o item que dependia do achado de arquitetura (quem roda o
    dossiê sem credencial na Vercel); resolvido pelo `cto-obra`, mas em
    ticket próprio — tem executor (workflow acordado por fila de pedidos),
    schema (`export_solicitacao`) e telas (`#s16`-`#s21`) que não pertencem
    à rotina periódica.
11. [ ] **O destino é privado.** O pacote é uma segunda cópia de todas as NFs,
    com CPF, CNPJ, valores e endereço. Nenhuma pasta ou link fica acessível a
    "qualquer pessoa com o link"; verifica-se abrindo numa janela anônima. Sem
    isso este ticket **cria** um risco maior do que o que elimina. *(R8 do
    contador: o índice carrega CPF de terceiros — prestadores —, não só do
    Mateus.)*
12. [ ] ~~Por ano-calendário, o pacote carrega a discriminação de Bens e
    Direitos, a lista de Pagamentos Efetuados e o recibo da DAA...~~
    **MOVIDO — `CONTAI-050` (011-C).** É conteúdo do dossiê, não da rotina
    periódica — e carrega o conflito com R6 (dossiê do comprador não deveria
    levar a ficha do declarante inteira, que soma as duas obras), que o
    `cto-obra`/`contador` resolvem dentro do 011-C, não aqui.
13. [ ] **(R4 do contador)** Todo pacote (periódico **e** dossiê) contém
    `LEIA-ME.txt` em português corrente com: (a) o aviso de cópia digital vs.
    papel — texto **copiado** do parecer, versão longa; (b) o relógio de
    guarda e a proibição de expurgo automático; (c) **a lista do que o pacote
    não contém** (escritura, matrícula, ITBI, alvará, ART, habite-se, CND —
    F4). **Texto confirmado palavra por palavra pelo `contador` em
    2026-09-23** (sem ajuste — o bloco do mock já estava certo desde a
    correção de 2026-08-22 do parecer): ver `design/mocks/CONTAI-011.md`,
    seção "Textos com consequência fiscal", blocos "LEIA-ME.txt" e "Por
    quanto tempo guardar". Cópia literal, não parafraseada, no código.
14. [ ] **(R5 do contador)** **Imutabilidade do pacote de ano fechado**:
    correção posterior de valor, data ou obra **não reescreve** pacote já
    exportado — gera pacote novo, datado, que referencia o anterior. A DAA pode
    ser retificada, e defender uma retificadora exige mostrar o que foi
    declarado antes e o que mudou.
15. [ ] **Detecção** de objeto sem vínculo (versão **reduzida** — a triagem
    completa dos três destinos é `CONTAI-049`/011-B). Objeto no bucket sem
    linha no banco (`documento.arquivo_path` / `pagamento.comprovante_path`)
    **não entra no pacote principal** e **fica listado, contado e visível**
    como pendência (quantos, desde quando) — sem isso o critério 2
    (contagem bate) e o critério 5 (índice cobre 100%) não são verificáveis
    na presença de órfãos. Este ticket **não** resolve o destino de cada
    objeto (isso bloqueia o *fechamento* do export só a partir do 011-B, que
    entrega os três destinos); aqui a existência de órfãos é **visível, não
    silenciosa**, o que já é a mudança de comportamento que falta hoje.

## Gate Fiscal (Contador) — FECHADO

Parecer transcrito em `docs/pareceres/2026-08-16-gate-fiscal-contai-011.md`,
2026-08-16. **APROVADO COM RESSALVAS**: R1–R5 bloqueantes. Depois do
fatiamento de 2026-09-23: R1, R2, R4 e R5 estão incorporadas aos critérios 3,
8, 13 e 14 **deste ticket**; **R3 migrou com o critério 12 para o
`CONTAI-050`/011-C** (é o dossiê que carrega Bens e Direitos + Pagamentos
Efetuados + recibo da DAA, não a rotina periódica). R6, R7, R9 e R10 são
notas para o Gate 2 dos tickets que carregam os critérios a que se referem.

- **F1 — CORTADA.** Já respondida na Q10 do parecer de 2026-08-09 e registrada
  no backlog. Reabri por erro; o parecer novo confirma a Q10 e acrescenta quatro
  pontos (o relógio ancora na **última DAA** que declarou qualquer parcela do
  ganho; o prazo real é ~1 ano e 9 meses maior que "venda + 5"; existe um
  segundo relógio previdenciário; obra não vendida = prazo indefinido).
- **F2 — RESPONDIDA.** Ver critério 3.
- **F3 — RESPONDIDA, com a consequência roteada para fora deste ticket.** Cópia
  digital não substitui papel (Lei 12.682/2012, Decreto 10.278/2020 — exigem
  ICP-Brasil); NF-e/NFS-e são exceção, nascem digitais. O aviso pertence ao
  **fluxo de captura do anexo (CONTAI-001)**, que este ticket não tem. Aqui ele
  entra só no LEIA-ME (critério 13).
- **F4 — CORTADA como pergunta, mantida como consequência.** A captura de
  escritura/ITBI/matrícula **já havia sido cortada** no Gate 2 do CONTAI-003
  ("é outro ticket"). Voltou como óbvio. O que fica deste ticket é o critério 13
  (c): o pacote **declara o que não contém**.

### Restrições vindas do `CONTAI-027` — anotadas aqui em 2026-08-21

⚠️ **Estas duas não são deste ticket por origem: elas caem aqui porque o dossiê é
onde elas se cumprem.** Nenhuma delas estava anotada neste arquivo até hoje —
o `CONTAI-027` dizia *"anotada lá"* e não estava. Ambas entram no **índice**
(critério 3) e valem a partir do momento em que a tabela filha de anexos existir.
**Ficam no 011-A** porque definem o formato do índice (`documentos.csv`/
`vinculos.csv`) que o critério 3 exporta — e o `CONTAI-050` (011-C), pela nota
do `cto-obra` de 2026-09-23, **reusa esse mesmo módulo de índice** para o
dossiê em vez de duplicá-lo, então valem para os dois pacotes sem precisar
repetir aqui.

**(a) N anexos compõem UM desembolso** — Gate Fiscal §4 do `CONTAI-027`
(2026-08-21):

> **Se** um lançamento tem N anexos, **então** no índice do dossiê: cada anexo é
> **linha própria com hash SHA-256** e **papel** (`comprovante` / `nota` /
> `contrato`); **o valor aparece uma única vez, na linha do lançamento, nunca
> repetido por anexo**; e o índice **declara que os N anexos compõem UM
> desembolso**.

*"Sem essa última frase, quem abrir o pacote em 2034 lê três comprovantes e conta
três pagamentos. **Um dossiê que induz soma errada é pior que um incompleto**."*

**(b) A resposta vigente e a pendência aberta do ano entram no índice** — §4d do
parecer `docs/pareceres/2026-08-21-gate-fiscal-contai-027-criterio-13.md`:

- A resposta da pergunta *"Quando esse dinheiro saiu da sua conta?"* — **nos dois
  casos, inclusive o "tudo no dia X"** —, **com a data em que foi dada**, entra no
  índice do dossiê **do ano daquele lançamento**.
- A pendência **"Um lançamento, mais de uma data"** que estiver **aberta** naquele
  ano entra junto, nomeada.

**Por que isto é bloqueante para o argumento fiscal, e não enfeite**: o corte do
critério 13 do `CONTAI-027` se sustenta em *"erro nomeado é melhor que erro
invisível"*. Se o rastro só existe dentro do app, *"o erro nomeado só está nomeado
dentro de um app que pode não existir em 2034 — e o argumento que sustenta o corte
deixa de ser verdadeiro no momento em que ele mais importa"*. **O dossiê é o que
torna o corte defensável.**

## Out of Scope

- **Restaurar** o acervo de volta para o Supabase a partir do pacote.
- **Expurgo** de documento vencido. Decisão fiscal, não simplificação: o relógio
  *"nunca dispara exclusão automática — só informa"* (Q10). Quem apaga é humano
  com parecer.
- **Verificação de legibilidade** do anexo (foto tremida, arquivo de 0 byte) —
  item P2 separado.
- **Abrir/baixar o original pela tela** — é a US-010, par deste ticket.
- **Captura** de escritura, ITBI, matrícula, alvará, ART, habite-se — ticket
  próprio (F4). Aqui só se declara a ausência.
- **Backup do Postgres orientado a restauração** (`pg_dump`, PITR, recriar o
  banco). O índice do critério 3 exporta o subconjunto **fiscalmente relevante**
  do banco de propósito — é o que faz o pacote ser lido sem o app. Restaurar o
  **sistema** é outro assunto, com outra ferramenta.
- **Export sob demanda / dossiê por obra** — `CONTAI-050` (011-C). Este
  ticket entrega só a rotina periódica sobre o acumulado de todas as obras.
- **Triagem completa do objeto órfão** (os três destinos) — `CONTAI-049`
  (011-B). Este ticket só detecta e mostra a contagem.

## Dependências

1. **Objeto órfão — detecção é deste ticket, destino é do `CONTAI-049`
   (011-B).** Confirmado no código: `subirParaAcervo` (`lib/data.ts:364`) gera
   `crypto.randomUUID()` a cada chamada e o upload precede o insert; retry após
   falha do insert cria segundo objeto; a migration 0002 não tem policy de
   delete. O lixo é real e permanente.
   - **Os três revisores divergiram** (histórico, 2026-08-16). `cto-obra`:
     export dirigido pelo banco deixa o órfão para trás por construção → não
     bloqueia. `po`: órfão vai para área e seção próprias no índice → não
     bloqueia, e o export vira o único detector de órfão do sistema.
     `contador`: órfão no pacote é documento sem vínculo com pagamento
     nenhum → **bloqueia o fechamento** até receber destino.
   - **Decisão do Mateus (2026-08-16)**: vale o contador. **A parte que
     bloqueia — dar destino ao órfão — é o `CONTAI-049` (011-B)**, não este
     ticket. Este ticket entrega só a detecção (critério 15 reduzido): a
     rotina roda mesmo com órfãos presentes (Decisão 0 já os deixa fora do
     pacote por construção), mas os mostra, contados, em vez de silenciá-los.
   - **Correção da mitigação do backlog**: reutilizar o path no retry **resolve
     só metade** — cobre o retry dentro da mesma montagem do componente, não
     cobre o abandono (usuário fecha o app entre upload e insert). A solução
     completa é **path derivado do sha256 do conteúdo** em vez de UUID: mesmo
     arquivo → mesmo path → o segundo upload colide e a colisão se trata como
     sucesso; de brinde, deduplica anexo enviado duas vezes. **Ticket próprio**
     (S) — não entra neste, misturaria escrita do app com rotina de servidor.
2. ~~**CONTAI-004** (`numero`, `data_emissao`) e **CONTAI-007**
   (`cno_referenciado`) — R10 do contador: são **campos obrigatórios do índice**
   e ainda não existem em `documento`.~~ ✅ **ENTREGUES — confirmado em
   2026-09-23 pelo `cto-obra` no código**: migration `0012` (CONTAI-004,
   `numero`, `serie`, `data_emissao`, `chave_acesso`) e migration `0015`
   (CONTAI-007, `cno_referenciado` + `nota_traz_cno`, tri-estado). O índice
   do critério 3 tem de onde ler. Atenção do Gate 1: `retencao_11` **não
   existe mais** como campo — o índice exporta as **linhas de retenção** de
   `documento_retencao` (CONTAI-038, migration `0017`), e a coluna do critério
   3 "retenção de 11% (sim/não/a confirmar)" tem que ser reescrita nesses
   termos (o `contador` decide o rótulo; ver CLAUDE.md, invariante central).
3. ~~**CONTAI-002 (login)** — a escolha entre service role e sessão de usuário
   depende do modelo de auth existir. Resolvida pelo `cto-obra` (ver
   Viabilidade), mas o ticket não vai ao Gate 1 antes do CONTAI-002 fechar.~~
   ✅ **CAI — 2026-09-23.** O que esta dependência pedia era o **modelo de
   auth existir**, e ele existe em produção de fato (`/entrar`, `proxy.ts`,
   cookie `contai-auth` via `@supabase/ssr`, RLS por `auth.uid()`). O status
   "⚠️ rebaixado" do 002 no `README.md` é sobre hash de gate e prova em
   aparelho real (R2 → `CONTAI-014`), não sobre o modelo — e a Decisão 2
   (service role) não depende de qual método de login o Mateus usa.
4. ~~**CONTAI-003** — entregue... É o que torna o critério 4 possível.~~
   **Critério 4 mudou de ticket** (é `CONTAI-050`/011-C agora); a entrega do
   `CONTAI-003` (G1 `5550d11`, G2 `e72bf35`) continua valendo como pré-requisito
   de fato (`obra_id` em `documento`/`pagamento`), só que para o 011-C, não
   para este.
5. ~~**US-004 (relatórios)** — o critério 12...~~ **Critério 12 mudou de
   ticket** (é `CONTAI-050`/011-C agora). US-004 continua pré-requisito, só
   que do 011-C.
6. **`CONTAI-027`** — enquanto a tabela filha de anexos não existir, as duas
   restrições da seção *"Restrições vindas do `CONTAI-027`"* não têm o que
   exportar. Elas **não bloqueiam** este ticket; **este ticket é que não pode
   fechar sem elas depois que o `027` subir**.

## Viabilidade (CTO) — decidido em 2026-08-16

### Decisão 0 — o export é dirigido pelo BANCO, não pelo bucket

Copia-se **todos os paths referenciados pelo banco**
(`documento.arquivo_path` + `pagamento.comprovante_path`), não "tudo que existe
no bucket". Arquivo sem linha no banco não sustenta declaração nenhuma. Efeitos:
o critério 5 vira consequência automática; a segmentação por obra sai de graça
(`where obra_id = X`); e a divergência inversa — linha apontando para objeto
ausente — é detectada e **falha alto**.

### Decisão 1 — a rotina roda em GitHub Actions com `schedule`

Padrão já provado nesta conta (`../surf-forecast/.github/workflows/daily-refresh.yml`).

- **Supabase Edge Function + pg_cron: eliminada por circularidade.** O job
  moraria dentro da coisa que pausa; projeto pausado não roda pg_cron.
- **Vercel Cron: eliminada.** O deploy nem existe ainda; no Hobby o cron tem
  precisão frouxa e roda função serverless com limite de tempo/memória — o pior
  ambiente para mover centenas de MB.
- ⚠️ **Risco que o ticket carrega como critério**: [Likely] o GitHub **desativa
  workflows agendados após ~60 dias sem atividade no repositório**, e este job
  precisa viver ~7 anos, incluindo anos em que ninguém commita — ou seja, o
  agendamento morre **precisamente quando começa o período longo de guarda**.
  Mitigação: o passo final commita um **recibo** (`docs/export/ultimo-export.md`
  — data, nº de arquivos, bytes, hash do índice). Mantém o repo ativo **e** dá o
  rastro do critério 6. É também o argumento mais forte a favor do dossiê sob
  demanda (`CONTAI-050`/011-C).

⚠️ **Adição barata para o 011-A, pedida pelo `cto-obra` em 2026-09-23**: o
`export-acervo.yml` deste ticket ganha `on: workflow_dispatch:` **sem
nenhum input**, ao lado do `schedule`. Custa uma linha de YAML e dá de graça
o botão manual "Run workflow" na UI do GitHub (fallback do critério 6 se o
cron falhar) — e é o gancho que o `CONTAI-050` (011-C) usa depois para
"acordar" o job a partir do app, sem que este ticket precise saber disso.

### Decisão 2 — service role key, só em GitHub Secrets

Autenticar como usuário está **eliminado por um fato do CONTAI-002**: o login é
por código de 6 dígitos, sem senha. Um job não recebe OTP. Fazer isso exigiria
criar uma senha extra na conta que carrega CPF e CNO — abrir uma segunda porta
na conta pessoal para evitar usar a porta de serviço.

⚠️ **Custo, dito por extenso**: a partir deste ticket existe uma credencial que
**ignora a RLS inteira**, e a premissa "o MVP não usa secret key" morre.
Atualizar o comentário do `.env.example` de "não usada" para "usada SOMENTE pelo
workflow de export, via GitHub Secrets". A chave **nunca** entra em variável
`NEXT_PUBLIC_*`, nunca em env da Vercel, nunca em arquivo versionado. Blast
radius real: single-user. Rotacionável no dashboard, e deve ser rotacionada se
qualquer log vazar.

### Decisão 3 — incremental por diff de listagem, índice sempre completo

Volume estimado [Guessing, ordem de grandeza]: ~400–600 arquivos, **0,5 a 2 GB**.

- **Pacote completo a cada execução: eliminado.** [Likely] O free tier dá ~5 GB
  de egress/mês; full re-export semanal no mês 20 seria 4–8 GB/mês para copiar
  arquivos **que nunca mudam** (o bucket é append-only).
- **Incremental sem estado no banco**: o rastreador do "já foi" é o **próprio
  destino** — listar, comparar por path e tamanho com a query do banco, subir a
  diferença. Idempotente e re-executável, sem coluna `exportado_em` que não
  sobreviveria a um destino apagado. O índice é regenerado **completo** a cada
  execução (são KB).
- ⚠️ **Cadência: SEMANAL, não mensal.**
- ⚠️ **Alerta lateral**: [Likely] o storage do free tier do Supabase é ~1 GB —
  **o acervo pode estourar o plano gratuito de origem antes do fim da obra**.
  Não é deste ticket; registrar no backlog.

### Modelo de dados

Sustenta o índice com uma query. `documento` já tem `obra_id`, `favorecido_id`,
`valor`, `arquivo_path`; a data de pagamento vem por `pagamento_documento` →
`pagamento.data_pagamento`. Como o vínculo é N:M, **uma linha de índice por
vínculo** (agregar esconderia o ano-calendário). `pagamento` já tem tudo.
Tamanho e checksum vêm da metadata de `storage.objects` na hora do export —
duplicar no schema seria dado que dessincroniza. ~~**Não criar tabela de
execuções de export**: o recibo commitado cumpre o papel com menos schema.~~
⚠️ **REVISTO em 2026-09-23 pelo próprio `cto-obra`** — a frase estava errada
e o mock (`#s6`) pegou: o recibo vive no Git, e o app na Vercel **não lê o
Git**. Lê-lo exigiria a API do GitHub — o terceiro gratuito que o critério 6
proíbe. A tabela existe: **Decisão 4**, abaixo. O recibo commitado
**continua**, com outro papel (keepalive contra os 60 dias do GitHub).

### Decisão 4 — `export_execucao`: o sinal positivo mora no Postgres do app (P1, 2026-09-23)

**Onde.** Tabela `export_execucao` (singular, padrão do repo), migration
`supabase/migrations/0018_export_execucao.sql`, no mesmo formato das `0013`
e `0017`: cabeçalho com o porquê, tabela, índice, RLS, **revoke-antes-grant**,
e a resposta por extenso à pergunta obrigatória do CLAUDE.md. Um **log
append-only** — uma linha por execução, nunca UPDATE, nunca DELETE.

Colunas: `id uuid pk` · `user_id uuid not null references auth.users` (**sem
`default auth.uid()`**: o escritor é service role, onde `auth.uid()` é NULL —
o `not null` é o que obriga o script a dizer de quem é o acervo) · `tipo text
check in ('periodico','dossie')` · `obra_id uuid null references obra`, com
`check ((tipo = 'dossie') = (obra_id is not null))` — o periódico cobre o
acumulado do usuário, o dossiê é de UMA obra (critério 10) ·
`iniciado_em`/`concluido_em timestamptz not null` · `resultado text check in
('sucesso','falha')` · `arquivos int` · `bytes bigint` · `indice_sha256 text` ·
`pacote_ref text` (pasta/nome do pacote no destino — é o que o critério 14
usa para "pacote novo que referencia o anterior") · `script_sha text` (commit
que rodou) · `erro text`. Checks de coerência: `sucesso` ⇒ `arquivos`,
`bytes`, `indice_sha256`, `pacote_ref` not null **e** `erro` null; `falha` ⇒
`erro` not null. Índice `(user_id, tipo, concluido_em desc)`.

**Quem escreve.** `scripts/export-acervo.ts`, com a service role key do
GitHub Secret (Decisão 2), **uma linha ao final** de cada execução — o passo
`if: failure()` do workflow grava a linha de `falha` com a mensagem. O
`user_id` vem de `obra.user_id` dos registros exportados; **mais de um
`user_id` distinto = falha alta**, não "exporta o primeiro" (multiusuário está
fora de escopo e fica fora fazendo barulho). Uma execução que morre antes de
conseguir gravar **não deixa linha** — e isso é proposital: vira modo (c),
detectado pela validade do último sucesso. Não se escreve linha "em
andamento" no início: exigiria o app julgar "travada há quanto tempo?", que é
uma segunda regra de validade para cobrir o mesmo caso.

**Quem lê, e como isso respeita a restrição do critério 6.** O app, pela
sessão do usuário, via PostgREST — `lib/data.ts` ganha `ultimoExport()`: a
última linha `tipo = 'periodico'` com `resultado = 'sucesso'` **e** a última
linha de qualquer resultado. É o **mesmo Postgres** do produto, não um
terceiro a mais: a restrição proíbe a *detecção* depender de outro free
tier, e se o Supabase cair o app inteiro some com ele — sinal mais alto que
qualquer linha. Regra da linha de estado (critério 6c), em `lib/export/estado.ts`,
pura, coberta por Vitest: sem linha nenhuma → **erro "nunca rodou"**; último
sucesso há N dias, N ≤ 7 → ok; 7 < N ≤ 14 → o âmbar do mock; N > 14
(2× semanal, Decisão 3) → **erro**; e se a linha mais recente é `falha` mais
nova que o último sucesso → **erro com o texto de `erro`**, que é o modo (a)
visível dentro do app **independente do canal da M3**. Consequência: **M3
deixa de bloquear o Gate 1** — ela só decide o canal de push.
As constantes `PERIODICIDADE_DIAS = 7` e `LIMITE_ERRO_DIAS = 14` vivem em
`lib/export/politica.ts`, e um teste unitário lê `.github/workflows/export-acervo.yml`
e falha se o `cron` deixar de ser semanal — o YAML não importa TypeScript, e
sem esse teste as duas pontas divergem em silêncio.

**RLS e grants (lição de 2026-08-17).** `enable row level security`; policy
`dono_export_execucao for select using (user_id = auth.uid())` — **só SELECT**,
sem policy de insert/update/delete para `authenticated`. Grants, no mesmo diff:
`revoke all on table export_execucao from anon, authenticated, service_role;`
`grant select on table export_execucao to authenticated;`
`grant select, insert on table export_execucao to service_role;` — explícito
mesmo que o remoto conceda por default, porque a pergunta obrigatória é
exatamente *"isto depende de default que o remoto pode não ter?"*, e a
resposta tem que ser "não" por construção. `e2e/privilegios.spec.ts` ganha
`export_execucao: "SELECT"` no `ESPERADO`. ⚠️ **Ponto cego declarado**: esse
mapa exclui `service_role` de propósito, então o grant do escritor **não é
provado pelo E2E** — quem prova é a **primeira execução real contra o remoto**,
que o critério 1 já exige, e ela falha alto (modo a) se o grant faltar.
Também sem DELETE para o script: o histórico de execuções é o rastro que
sustenta o critério 14 e a defesa de uma retificadora.

**Ordem de release**: `0018` entra por `npx supabase db push` **antes** do
merge do workflow (CLAUDE.md, ordem obrigatória). Aditiva e inofensiva sozinha.

**O que fica de fora, de propósito**: view/função `ultimo_export()` (uma
query simples não paga schema); linha "em andamento"; `exportado_em` por
documento (Decisão 3: o rastreador é o destino); ler o recibo do Git pelo
app (é o terceiro proibido). Complexidade do ticket **não muda** (M): a
tabela e a regra pura são ~S, e o peso segue no destino.

### Complexidade: **M**

Arquivos prováveis: `.github/workflows/export-acervo.yml` ·
`scripts/export-acervo.ts` (standalone via tsx, fora do Next e fora do bundle) ·
`lib/export/indice.ts` (montagem do índice, pura, coberta por Vitest) ·
`lib/export/destino.ts` · atualização de `.env.example` e `CLAUDE.md`. O peso do
M está quase todo no destino.

**Dívidas que a implementação cria**: (a) primeira credencial que fura RLS no
projeto; (b) commit automatizado de bot no repo — precisa de path próprio
(`docs/export/`) para nunca colidir com árvore em uso; (c) um workflow que
precisa sobreviver 7 anos.

### Destino: Google Drive — escolhido pelo Mateus em 2026-08-16

O `cto-obra` **discordou** e recomendou destino S3-compatível (Backblaze B2 ou
Cloudflare R2, ~R$ 0,10/mês para 2 GB, credencial estática, zero OAuth). O risco
do Drive não é cota (15 GB comportam) — é **OAuth**: [Likely] refresh token de
app em modo *testing* expira em 7 dias, sair do testing pede verificação do
Google, e token revogado mata o job em silêncio.

O contraponto que sustenta a escolha, e que o próprio `cto-obra` concedeu: o
Teste do Canteiro exige que o Mateus **abra o storage sem o app**, e Drive ele
abre no celular hoje; B2 não. E a US-002 já traria o consentimento Google.

⚠️ **Condições obrigatórias da escolha**: escopo mínimo `drive.file`; app OAuth
**PUBLICADO**, nunca em "testing"; refresh token em GitHub Secret; e o critério
6 cobrindo explicitamente **"token morto"** como falha visível.

## Pre-mortem

*"É 16 de novembro de 2026. A R1 está no ar há dois meses, o export foi feito, e
o acervo continua desprotegido. Por quê?"*

1. **O cron desligou sozinho e ninguém viu.** O GitHub desabilita workflows
   agendados em repo público após 60 dias sem commit, avisando por um e-mail que
   se perde. Este projeto é de um dev só, que para de commitar quando a obra
   acaba — **o agendamento morre precisamente quando começa o período longo de
   guarda.** É o risco nº 1, e o argumento mais forte a favor do dossiê sob
   demanda (`CONTAI-050`/011-C, que não depende do schedule continuar vivo).
2. **O export nunca rodou uma vez, porque a credencial do destino nunca foi
   configurada.** Falha na primeira execução, e a falha vira e-mail do GitHub
   Actions — canal que ninguém lê.
3. **O pacote existe, tem 300 arquivos, e não serve na hora da venda.** O
   comprador pede o dossiê de uma obra; o pacote é o acumulado das duas, sem
   amarrar documento a matrícula e a CNO. Mitigado pela segmentação e conteúdo
   do dossiê — `CONTAI-050`/011-C, não deste ticket.
4. **Vazou — não a credencial, o conteúdo.** Uma pasta do Drive com todas as
   NFs, CPFs e CNPJs, compartilhada uma vez por link e nunca revogada. É o dano
   maior e o mais provável, porque a pasta é usada por gente e não por máquina.
   Critério 11.
5. **O export virou keepalive.** Com o antigo critério 7 escrito no ticket, essa
   degradação viraria **conformidade e não desvio**: um job que só bate no banco
   cumpriria o critério e falharia a story sem nenhum teste ficar vermelho. Por
   isso o 7 saiu daqui e virou CONTAI-012.
6. **O projeto pausou mesmo assim** — porque o keepalive dependia do mesmo
   GitHub Actions do risco 1, ou porque o tráfego que o job gera não é o que o
   Supabase conta como atividade [Guessing].

## Perguntas Abertas (Mateus)

- **M1 — RESPONDIDA (2026-08-16)**: destino = **Google Drive**, com as condições
  de OAuth acima.
- **M2 — CONFIRMADA pelo `po` em 2026-09-23**: **semanal**, não mensal. Ratifica
  a recomendação do `cto-obra` (Decisão 3) — parâmetro técnico reversível
  (`PERIODICIDADE_DIAS = 7` em `lib/export/politica.ts`, testado por
  `e2e/privilegios...` não, pelo teste unitário do cron citado na Decisão 4),
  não é decisão de arquitetura nem tem consequência fiscal: mudar depois é
  trocar uma constante e o `cron` do workflow, sem redesenho. Não precisa
  esperar o Mateus revisitar.
- **M3** — Você quer ser avisado a cada export bem-sucedido, ou só quando
  falhar? Note que "só quando falhar" **não cobre** o modo (c) do critério 6 —
  por isso o sinal positivo dentro do app é obrigatório de qualquer forma.
  **Desde 2026-09-23 NÃO bloqueia o Gate 1** (Decisão 4): os modos (a) e (c)
  ficam visíveis dentro do app pela `export_execucao`; a M3 só decide o canal
  de push, e o mock já a desenhou como preferência (`#s23`). Pode entrar
  depois, sem migration.
- **M2, nota de 2026-09-23**: a resposta vira número em
  `lib/export/politica.ts` (7 dias / erro em 14). Se a resposta for outra, é
  uma constante e um `cron` — não muda desenho.
- **M4 — RESPONDIDA pelo `po`**: a reclassificação para a R1 foi **rejeitada**.
  A story vai para 2º item pós-R1, pareada com a US-010.

## Veredicto (po, 2026-09-23) — reconfirmado após o fatiamento

✅ **PRONTO PARA `/develop`, escopo 011-A.** Todos os itens que bloqueavam
Gate 1 estão fechados, e os dois achados do `lead-engineer` (arquitetura e
fiscal) **não tocam este ticket** — os dois só bloqueavam critérios que
saíram daqui (10/12 → 011-C; 15 completo → 011-B):

- **P1** (fonte de dados do estado do export) — resolvida, Decisão 4.
- **P2/P3** — não existiam; ver correção no cabeçalho, acima.
- **Gate Fiscal** — R1, R2, R4 e R5 incorporados aos critérios 3, 8, 13 e 14
  (R3, do critério 12, migrou para o 011-C junto com o critério).
- **M1** (destino) — respondida. **M2** (cadência) — confirmada acima. **M3**
  (canal de aviso) — deixou de bloquear (Decisão 4): só decide push, não
  arquitetura.
- **Dependências de código** — CONTAI-002 (auth), CONTAI-004 e CONTAI-007
  entregues; CONTAI-003 e US-004 seguem como pré-requisito, mas do 011-C.
  Objeto órfão: só a **detecção** é deste ticket (critério 15 reduzido).

**O que fica de fora do Gate 1 de código, sem bloquear o começo dele:**

- **OAuth do Google Drive é ação de dashboard do Mateus** (publicar o app
  OAuth fora de "testing", conceder o escopo `drive.file`, gerar o refresh
  token e gravá-lo em GitHub Secret) — nenhuma linha disso é código. Bloqueia
  a **primeira execução real** do workflow, não o desenvolvimento dele.
- **Confirmação de numeração legal antes do texto ir para tela** (Lei
  12.682/2012, Decreto 10.278/2020) — o `contador` já confirmou em 2026-09-23
  que o texto do mock está correto **tal como está** (ver critério 13); a
  numeração em si continua sujeita à ressalva do próprio parecer ("confirmar
  vigência"), mas isso não muda o texto a colar agora.

As três notas de Gate 2 que o parecer original levantava sobre o **dossiê**
(conflito critério 12 × R6, campos de "documento da obra", "gerar assim
mesmo", busca de vínculo em outra obra) foram **herdadas pelos tickets que
carregam esses critérios** — `CONTAI-050` (a primeira) e `CONTAI-049` (as
outras três) — e já vêm com decisão do `cto-obra`/`contador` nesta rodada.

## Teste do Canteiro

Esta rotina não tem tela de captura e não roda no canteiro — mas uma coisa
aqui acontece no celular: conferir *"o último export rodou?"*. O teste tem
duas partes, e o ticket só passa nas duas (a 3ª parte original, "Entregar o
dossiê", virou teste do `CONTAI-050`/011-C):

1. **Achar** — abrir o storage, sem abrir o contai, e localizar a nota de um
   pagamento específico usando só o índice. Se precisar do app para entender o
   pacote, o ticket falhou.
2. **Confiar** — escolher um favorecido, contar as notas dele no índice e bater
   com o que o app mostra. Achar um arquivo prova legibilidade; só a contagem
   prova que não faltam quarenta.

E um teste do critério 6, que é o que separa este ticket de um placebo:
**quebrar o export de propósito** (revogar a credencial do destino) e cronometrar
quantos dias levam até o Mateus **descobrir sem ir procurar**. Se a resposta for
"quando ele lembrar de conferir", o critério 6 não foi cumprido.
