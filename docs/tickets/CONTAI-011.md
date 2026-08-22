# CONTAI-011 — Export do acervo: rotina periódica + dossiê por obra

## Tipo e Prioridade

- **Tipo**: infraestrutura de dados + meta 3 (acervo que sobrevive até venda + 5 anos)
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
  ⚠️ **A aprovação é do desenho e do fluxo. NÃO fecha as 3 perguntas
  bloqueantes** (P1, P2 e P3, em "Perguntas Abertas"). Em particular, **P1 é
  pré-requisito duro do Gate 1**: hoje não existe fonte de dados que o app
  consiga ler para a linha de estado, e sem ela o critério 6(c) não existe —
  o ticket volta a ser o cron que morre em silêncio do próprio pre-mortem.
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
periodicamente para um storage que é meu, com índice legível sem o app, e quero
poder gerar sob demanda o dossiê completo de **uma** obra, para que a
comprovação do custo de aquisição sirva a mim na declaração e ao comprador e ao
contador dele na venda — mesmo que a conta do Supabase, o app e o repositório
não existam mais.

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
4. [ ] O export é **segmentável por obra**: produz-se o pacote de UMA obra sem o
   acumulado das outras. Origem: backlog, Relato 003, ajustes de 2026-08-09 — na
   venda pede-se o dossiê **daquele** imóvel, e o relógio de guarda é por obra
   (contador, Q10).
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
10. [ ] **Export sob demanda, por obra (dossiê)**: o Mateus dispara e recebe o
    pacote completo de uma obra — mesmos índice, integridade e segmentação dos
    critérios 3, 4, 5 e 8. É esta saída, e não a rotina periódica, que atende a
    venda e o horizonte de guarda longa, porque não depende de agendamento
    nenhum continuar vivo.
11. [ ] **O destino é privado.** O pacote é uma segunda cópia de todas as NFs,
    com CPF, CNPJ, valores e endereço. Nenhuma pasta ou link fica acessível a
    "qualquer pessoa com o link"; verifica-se abrindo numa janela anônima. Sem
    isso este ticket **cria** um risco maior do que o que elimina. *(R8 do
    contador: o índice carrega CPF de terceiros — prestadores —, não só do
    Mateus.)*
12. [ ] **(R3 do contador)** Por ano-calendário, o pacote carrega a
    **discriminação de Bens e Direitos como declarada** (por matrícula), a
    **lista de Pagamentos Efetuados como declarada** (CPF por CPF) e o **recibo
    de entrega da DAA**. Base: IN SRF 84/2001 art. 17 — comprovado **e**
    discriminado. Enquanto a US-004 não existir, o critério é atendido por
    espaço reservado + menção no LEIA-ME.
13. [ ] **(R4 do contador)** Todo pacote contém `LEIA-ME.txt` em português
    corrente com: (a) o aviso de cópia digital vs. papel — texto **copiado** do
    parecer, versão longa; (b) o relógio de guarda e a proibição de expurgo
    automático; (c) **a lista do que o pacote não contém** (escritura, matrícula,
    ITBI, alvará, ART, habite-se, CND — F4).
14. [ ] **(R5 do contador)** **Imutabilidade do pacote de ano fechado**:
    correção posterior de valor, data ou obra **não reescreve** pacote já
    exportado — gera pacote novo, datado, que referencia o anterior. A DAA pode
    ser retificada, e defender uma retificadora exige mostrar o que foi
    declarado antes e o que mudou.
15. [ ] **Triagem de objeto sem vínculo** — ver "Dependências", decisão do
    Mateus de 2026-08-16. Objeto no bucket sem linha no banco **não entra no
    pacote principal** e **bloqueia o fechamento do export** até receber um dos
    três destinos: **resolvido** (vinculado ao registro certo), **descartado**
    (marcado como lixo de retry), ou **anotado como legítimo sem vínculo**
    (documento descritivo da obra — alvará, ART, matrícula, habite-se). O
    terceiro destino é uma categoria nova e é o que o F4 do contador já exigia.

## Gate Fiscal (Contador) — FECHADO

Parecer transcrito em `docs/pareceres/2026-08-16-gate-fiscal-contai-011.md`,
2026-08-16. **APROVADO COM RESSALVAS**: R1–R5 bloqueantes, incorporadas aos
critérios 3, 8, 12, 13 e 14. R6, R7, R9 e R10 são notas para o Gate 2.

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

## Dependências

1. **Objeto órfão — BLOQUEANTE, por decisão do Mateus (2026-08-16).**
   Confirmado no código: `subirParaAcervo` (`lib/data.ts:364`) gera
   `crypto.randomUUID()` a cada chamada e o upload precede o insert; retry após
   falha do insert cria segundo objeto; a migration 0002 não tem policy de
   delete. O lixo é real e permanente.
   - **Os três revisores divergiram.** `cto-obra`: export dirigido pelo banco
     deixa o órfão para trás por construção → não bloqueia. `po`: órfão vai para
     área e seção próprias no índice → não bloqueia, e o export vira o único
     detector de órfão do sistema. `contador`: órfão no pacote é documento sem
     vínculo com pagamento nenhum — numa conferência levanta *"e este gasto, por
     que não está declarado?"* → **bloqueia**.
   - **Decisão do Mateus**: vale o contador — **é bloqueante até ser resolvido,
     descartado, ou anotado como ok de manter sem vínculo** (documento
     descritivo). Virou o critério 15.
   - **O que a decisão revela e nenhum revisor viu**: nem todo objeto sem
     vínculo é lixo. O F4 do contador lista justamente os documentos que a obra
     precisa guardar e que **não têm favorecido nem pagamento** — alvará, ART,
     matrícula, habite-se. Esses nascem sem vínculo por natureza. A triagem do
     critério 15 é o que separa as duas populações, e o terceiro destino
     ("legítimo sem vínculo") é o embrião da categoria que o F4 pede.
   - **Correção da mitigação do backlog**: reutilizar o path no retry **resolve
     só metade** — cobre o retry dentro da mesma montagem do componente, não
     cobre o abandono (usuário fecha o app entre upload e insert). A solução
     completa é **path derivado do sha256 do conteúdo** em vez de UUID: mesmo
     arquivo → mesmo path → o segundo upload colide e a colisão se trata como
     sucesso; de brinde, deduplica anexo enviado duas vezes. **Ticket próprio**
     (S) — não entra neste, misturaria escrita do app com rotina de servidor.
2. **CONTAI-004** (`numero`, `data_emissao`) e **CONTAI-007**
   (`cno_referenciado`) — R10 do contador: são **campos obrigatórios do índice**
   e ainda não existem em `documento`. Enquanto não existirem, o índice sai
   incompleto e o LEIA-ME tem que dizer isso.
3. **CONTAI-002 (login)** — a escolha entre service role e sessão de usuário
   depende do modelo de auth existir. Resolvida pelo `cto-obra` (ver
   Viabilidade), mas o ticket não vai ao Gate 1 antes do CONTAI-002 fechar.
4. **CONTAI-003** — entregue. É o que torna o critério 4 possível.
5. **US-004 (relatórios)** — o critério 12 só fica completo quando ela existir.
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
  rastro do critério 6. É também o argumento mais forte a favor do critério 10.

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
duplicar no schema seria dado que dessincroniza. **Não criar tabela de execuções
de export**: o recibo commitado cumpre o papel com menos schema.

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
   guarda.** É o risco nº 1, e o argumento mais forte a favor do critério 10.
2. **O export nunca rodou uma vez, porque a credencial do destino nunca foi
   configurada.** Falha na primeira execução, e a falha vira e-mail do GitHub
   Actions — canal que ninguém lê.
3. **O pacote existe, tem 300 arquivos, e não serve na hora da venda.** O
   comprador pede o dossiê de uma obra; o pacote é o acumulado das duas, sem
   amarrar documento a matrícula e a CNO. Mitigado por 3, 4 e 10.
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
- **M2 — RESPONDIDA de fato pelo `cto-obra`**: **semanal**, não mensal.
  Confirmar.
- **M3** — Você quer ser avisado a cada export bem-sucedido, ou só quando
  falhar? Note que "só quando falhar" **não cobre** o modo (c) do critério 6 —
  por isso o sinal positivo dentro do app é obrigatório de qualquer forma.
- **M4 — RESPONDIDA pelo `po`**: a reclassificação para a R1 foi **rejeitada**.
  A story vai para 2º item pós-R1, pareada com a US-010.

## Teste do Canteiro

Esta rotina não tem tela de captura e não roda no canteiro — mas duas coisas
aqui acontecem no celular: conferir *"o último export rodou?"* e mandar o dossiê
para alguém. O teste tem três partes, e o ticket só passa nas três:

1. **Achar** — abrir o storage, sem abrir o contai, e localizar a nota de um
   pagamento específico usando só o índice. Se precisar do app para entender o
   pacote, o ticket falhou.
2. **Confiar** — escolher um favorecido, contar as notas dele no índice e bater
   com o que o app mostra. Achar um arquivo prova legibilidade; só a contagem
   prova que não faltam quarenta.
3. **Entregar** — produzir o dossiê da obra A e conferir que ele não contém
   **nada** da obra B, e que dá para mandar ao comprador como está.

E um teste do critério 6, que é o que separa este ticket de um placebo:
**quebrar o export de propósito** (revogar a credencial do destino) e cronometrar
quantos dias levam até o Mateus **descobrir sem ir procurar**. Se a resposta for
"quando ele lembrar de conferir", o critério 6 não foi cumprido.
