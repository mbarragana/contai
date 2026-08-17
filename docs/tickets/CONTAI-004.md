# CONTAI-004 — Nº do documento e data de emissão no formulário

## Tipo e Prioridade

feature — **P0, DENTRO da R1**, primeiro item do par `004 + 007`.

Regra de admissão invocada: *captura irreversível no ato do registro* (2ª
revisão da fila). Custo agora: dois campos no formulário que já existe. Custo
depois: reabrir documento por documento — e o `numero` está no papel que ele
fotografou, ou seja, **o dado só é barato enquanto a nota está na mão**.

- **Gate 0 (mock)**: **OBRIGATÓRIO — PENDENTE.** Ver critério 1.
- **Gate Fiscal**: `docs/pareceres/2026-08-16-gate-fiscal-contai-004-005.md`,
  Parte 1 — APROVADO COM RESSALVAS (R1–R5 bloqueantes, incorporadas abaixo).

## Dor de Origem

Backlog, Gate 4 do CONTAI-001 (2026-08-08):

> "O contador já fixou o formato da discriminação anual: *'NF nº X, valor total
> R$ Z, pago R$ Y no ano'* (Q6). Hoje o formulário não pergunta o número da nota
> e o schema (`documento`) não tem a coluna — sem isso a US-004 não gera o
> texto."

Confirmado no schema: `documento` (`supabase/migrations/0001_init.sql:49`) não
tem `numero` nem `data_emissao`.

Dor de fundo: **D3** do Relato 001 — *"tenho que depois pensar e entender como
colocar tudo isso no ir"* —, classificada **P0 fiscal**.

Segunda dor, que não estava clara quando o item nasceu: **`data_emissao` é o que
define a janela do CNO**. O critério 8 do CONTAI-007 lista as notas emitidas
entre `data_inicio_obra` e `cno_registrado_em` — sem `data_emissao` não existe
janela, e sem janela não existe a única saída deste projeto que **recupera**
valor em vez de registrar perda (parecer de 2026-08-09).

## User Story

Como dono da obra, quero informar o número e a data de emissão da nota no mesmo
momento em que anexo o arquivo, para que a discriminação anual saia com o número
da nota e a lista de cobrança do prestador saia com as notas certas — sem eu ter
que reabrir cada documento em abril.

## Critérios de Aceite

1. [ ] **Mock aprovado pelo Mateus** antes do desenvolvimento. **Não existe mock
   com estes campos**: `design/mocks/CONTAI-001.html` não tem "nº da nota", e o
   mock do CONTAI-003 só cobre as telas 13 e 14. O mock é **o mesmo passe do
   CONTAI-007** — os dois mexem no mesmo formulário (`/adicionar/documento`), e
   duas levas de campo novo são duas levas de mock a aprovar
2. [ ] **(R5 do contador)** `numero` e `data_emissao` capturados no registro,
   **obrigatórios e bloqueantes** em `nf_material` e `nf_servico`; **não
   perguntados** em boleto (o campo obrigatório do boleto segue `vencimento`)
3. [ ] **(R5)** A obrigatoriedade vale **inclusive em documento com
   `status = 'quarentena'`.** Contraintuitivo e correto: é justamente a nota
   errada que precisa ser identificada para ser **cancelada e reemitida** junto
   ao fornecedor — em NF-e, carta de correção **não** altera destinatário. Sem
   número não há o que pedir
4. [ ] **(R3)** **Sem valor padrão em `data_emissao`.** Nenhuma tela pré-preenche
   com "hoje", `created_at` ou `data_pagamento`. Fundamento já exercido:
   *"data inventada em campo fiscal é pior do que campo vazio — vazio pergunta,
   preenchido afirma"* (Gate 2 do CONTAI-003)
5. [ ] **(R4)** `data_emissao` **futura é recusada**, com **mensagem própria** —
   proibido reaproveitar a mensagem de data de pagamento futura. São regras
   diferentes: esta é coerência documental, aquela é regime de caixa.
   `data_emissao` **anterior ao início da obra é legítima** e não gera aviso
   (projeto, ART, ITBI e escritura antecedem a obra)
6. [ ] **(R1 — a ressalva mais cara)** **É PROIBIDA a validação
   `data_pagamento >= data_emissao`.** Ela parece higiene e **quebra o caso mais
   frequente do projeto**: PIX mensal à AJE e NF consolidada meses depois
   (Relato 002, D6). **Exigir teste unitário que falhe se alguém a
   introduzir** — comentário não protege nada, lição do `cnoReferenciado`
   hard-coded (Gate 2 do CONTAI-003)
7. [ ] **(R2)** `numero` é **texto preservado literalmente** — zeros à esquerda,
   letras, barras e pontos. Proibida conversão numérica ou normalização: NFS-e
   municipal usa numeração própria e converter destrói a identificação da nota
8. [ ] O rótulo do campo diz **o que a data é e o que ela não é**: a data de
   emissão **não decide o ano do custo** (Q6 — quem decide é a data do
   pagamento). Verificável em tela: o campo não pode ser lido como "a data que
   vale para o IR"
9. [ ] Os dois campos aparecem no detalhe do documento (`/documento/[id]`) —
   dado que entra e não se confere é dado que não entrou
10. [ ] Os dois campos aparecem por extenso na **tela 14 do mock aprovado**
    ("Notas a cobrar"), quando o CONTAI-007 a implementar:
    `NF 1042 · 20/03 · R$ 18.000,00`
11. [ ] **(R7 do contador)** **Aviso de duplicidade, não bloqueio**: mesmo
    `numero` + mesmo **emitente** (+ série, quando houver) na mesma obra →
    *"essa nota já foi registrada em DD/MM"*, com link para o registro
    existente. É a **primeira defesa do produto contra custo contado duas
    vezes** — e custo inflado em Bens e Direitos vai para a declaração, cobrado
    com multa. **Não existe unicidade global de `numero`**: número é único por
    emitente + série + modelo
12. [ ] **(R3)** **Estado do banco verificado por consulta, não por suposição**,
    antes do merge: quantas linhas tem `documento` no projeto REMOTO? Se zero, a
    migration adiciona as colunas e **não há backfill nem pendência**. Se não for
    zero, o ticket volta ao PO — nem backfill (data inventada) nem `not null` sem
    saída. Este critério existe por um motivo nomeado: no Gate 2 do CONTAI-003
    dois agentes propagaram uma suposição sobre o estado do banco sem consultá-lo
13. [ ] **Pendência de campo faltante é âmbar e fica FORA do headline** do
    CONTAI-005 (R7 do parecer). Texto de tela, copiado do parecer:
    > **Falta o número ou a data da nota**
    > [fornecedor] · R$ [valor]
    > O custo **não** está em risco: o documento está no acervo e continua
    > valendo. Sem o número e a data, a discriminação do ano sai sem identificar
    > esta nota, e ela fica de fora da lista de cobrança do CNO.
    > [Abrir o anexo e completar]
14. [ ] Rótulo **"Interação X de 3" → "Passo X de 3"** (backlog, ajustes em itens
    existentes). Está em `app/adicionar/documento/page.tsx:239`, `:240` e `:391`.
    A tela afirma um número que ela não cumpre (o caminho comum tem ~10)
15. [ ] E2E afirma o **estado gravado**: NF salva sem número **não gera linha**
    em `documento` nem objeto no bucket

## Gate Fiscal (Contador) — FECHADO

Parecer em `docs/pareceres/2026-08-16-gate-fiscal-contai-004-005.md`, Parte 1.
**APROVADO COM RESSALVAS**: R1–R5 bloqueantes (critérios 2–7 e 12), R6–R9 como
notas de Gate 2.

**Regra de obrigatoriedade, em "se X e Y → Z"** — copiada do parecer:

| Condição | Consequência |
|---|---|
| `tipo ∈ {nf_material, nf_servico}` | `numero` e `data_emissao` **obrigatórios** |
| idem, **e** `status = 'quarentena'` | **continuam obrigatórios** |
| `tipo = nf_servico` | `data_emissao` obrigatória **também** pela janela do CNO |
| `data_emissao` > hoje | **recusar**, com mensagem própria |
| `tipo = boleto` | ambos **opcionais** |
| recibo de PF (nasce na US-006) | `data_emissao` obrigatória; `numero` opcional, com a ausência **declarada** ("recibo sem número") |

**Recibo de pedreiro em regra NÃO tem número** [Certain]. O que o torna
documentação hábil é nome, **CPF completo**, descrição do serviço, valor, data e
assinatura, mais o comprovante da transferência da conta do declarante. **O
sistema nunca gera número para um recibo que não tem.**

**Texto da discriminação**: dois blocos, literais, no parecer. `data_emissao`
sai como *"emitida em"*; `data_pagamento` como *"pago R$ Y em [ano]"*. **Não são
intercambiáveis** — é o ponto exato onde a troca aconteceria. Se o Bloco B não
couber no limite de caracteres, **corta-se o B, nunca o A**.

**O que cada data governa** (tabela completa no parecer): `data_pagamento`
governa o ano-calendário do custo e **nunca** a identificação; `data_emissao`
governa identificação, janela do CNO e competência da aferição, e **nunca, em
nenhuma hipótese, o ano do custo**. Nenhum relatório anual é filtrado ou ordenado
por `data_emissao`.

**Automático × humano**: o sistema exige os campos, recusa data futura, preserva
o número como texto, monta os blocos, aloca pagamento no ano da sua data e
sinaliza duplicidade. **Exige CRC**: o texto que vai à declaração, se o Bloco B
cabe naquele ano, o código do bem, qualquer retificadora. **Marcar para revisão
humana**: recibo de PF com `data_emissao` em ano diferente do pagamento.

## Out of Scope

- **Extração automática do número e da data** do PDF/XML — é a **US-008**;
  registro é manual-first por decisão do Mateus (2026-08-07)
- **Chave de acesso da NF-e (44 dígitos), série e modelo** — 44 dígitos digitados
  com uma mão no canteiro é o oposto da meta. **Ressalva R6 do contador**:
  capturar `serie` em campo próprio (nunca concatenada no número) e o
  identificador de autenticidade (chave de 44 dígitos na NF-e, código de
  verificação na NFS-e) é o que permitiria validar a nota no portal daqui a sete
  anos — fica como nota de Gate 2, não como escopo
- **Linha digitável / nosso-número do boleto** — não serve nenhuma das três metas
- **Validar o número contra a SEFAZ** — fora do alcance do produto
- **Editar número ou data de documento já salvo** — mesma trava do CONTAI-009: só
  a **obra** é corrigível. **Dívida conhecida, não esquecimento**: número
  digitado errado produz discriminação errada e hoje não tem conserto pela
  interface. Vira ticket se acontecer uma vez

## Pre-mortem

1. **Dois campos a mais quebram o fluxo que já falhou o critério de ≤3
   interações** e o Mateus para de registrar no canteiro — volta a acumular
   papel, que é a doença original do Relato 001. **Mitigação**: os campos ficam
   **no mesmo passo do valor**, sem passo novo; `numero` com teclado numérico; a
   métrica de aceite é *"tempo até salvar ≤ 60 s com uma mão"*, não contagem de
   toques
2. **`data_emissao` é preenchida com "hoje" por hábito** — pelo usuário ou por um
   default que alguém acha conveniente — e a janela do CNO passa a listar as
   notas erradas. A lista de cobrança perde valor **exatamente onde ela é a única
   coisa que recupera valor**, e ninguém percebe porque a lista continua saindo.
   **Mitigação**: critérios 4 e 8
3. **A migration entra com restrição num banco que alguém populou** entre o Gate
   2 do CONTAI-003 e este merge. **Mitigação**: critério 12, que exige consulta
4. **Alguém acrescenta `data_pagamento >= data_emissao` "porque faz sentido"** e
   quebra o caso central do produto em silêncio. **Mitigação**: critério 6, com
   teste que falha

## Viabilidade (CTO)

**Colunas nullable, sem default, sem check de banco**: `documento.numero text`,
`documento.data_emissao date`. A obrigatoriedade "NF sim, boleto não" mora em
`validarDocumento` (`lib/fiscal/documento.ts`), **não em constraint**.

**Por que não NOT NULL com default**: default para coluna fiscal é data/número
inventado — o erro que o Gate 2 do CONTAI-003 catalogou no backfill de
`data_inicio_obra`. E um check `tipo <> 'boleto' → numero is not null`
**quebraria a US-005** (migração da planilha), onde o registro legado entra com
pendência, não bloqueio — decisão já registrada no backlog.

**Linhas existentes: não há o que fazer.** [Certain] A `obra` remota estava vazia
no Gate 2 → `documento` (FK) também; o `seed.sql` não cria documento. Backfill
afeta zero linhas em qualquer ambiente. O critério 12 confirma por consulta.

⚠️ **Duas migrations, uma por ticket** (0005 = 004, 0006 = 007). O CTO **discorda
da frase do CONTAI-007** ("duas migrations na mesma tabela é desperdício"): o
custo de uma migration é zero (`db reset` roda todas) e o benefício é real — cada
gate revisa um diff autocontido, e se o 007 atrasar a migration do 004 não
embarca coluna morta. A convenção do repo já é 1 migration ↔ 1 ticket. **O
argumento verdadeiro do "junto" nunca foi a migration: é o mock e o formulário**,
e esse se mantém.

**Arquivos prováveis**: `supabase/migrations/0005_documento_numero_emissao.sql` ·
`lib/database.types.ts` (regen via CLI) · `lib/types.ts` · `lib/data.ts`
(`paraDocumento`, `criarDocumento`) · `lib/fiscal/documento.ts` (+ testes) ·
`app/adicionar/documento/page.tsx` (o padrão de campo condicional por tipo já
existe — vencimento só em boleto) · `app/documento/[id]/page.tsx` · e2e de
ingestão.

**Complexidade: S.** **Dívida criada**: nenhuma unicidade em
(favorecido, numero) — NF duplicada registrada duas vezes não é *impedida*, só
avisada. Correto não atacar agora (é território da conciliação); nomeado para não
sumir.

⚠️ **Dívida herdada da implementação fora de ordem (R4 do Gate 4 do
CONTAI-002)** — e ela está **superdimensionada nos documentos**. O CTO foi ler o
teste (`e2e/entrar.spec.ts:333-393`): ele preenche o formulário de **pagamento**,
que o **004 não toca** (004 é só documento). O risco real é menor do que o
registrado. **A mitigação continua valendo porque é quase grátis** e elimina a
classe inteira do problema:

- **Chore pré-004, primeiro commit do Gate 1**: extrair o preenchimento para
  `e2e/formularios.ts` (`preencherPagamentoBasico`, `preencherDocumentoBasico`) e
  usar em `entrar.spec.ts`, `obra.spec.ts` e `ingestao.spec.ts`.
- **Renomear a casa do teste**: o cenário "sessão cai no meio do formulário" sai
  de `entrar.spec.ts` para um spec com o nome do que ele testa. **O sintoma
  enganoso era 90% o nome do arquivo.**

## Dependências

- **Bloqueado por**: mock aprovado (Gate 0, conjunto com o CONTAI-007)
- **Bloqueia**: **critério 8 do CONTAI-007** (lista de cobrança) e a **US-004**
  (texto da discriminação). Dentro do par, **004 primeiro** — dependência de
  conteúdo, não economia de migration
- **Implementar junto do CONTAI-007**: mesmo mock, mesmo formulário
- ⚠️ **O CONTAI-007 precisa de revisão de Passo 1 antes do `/develop`** — seis
  pontos desatualizados, listados na 5ª revisão da fila no `docs/backlog.md`

## Perguntas Abertas

1. **`data_emissao` é obrigatória também em NF de material**, ou só em serviço?
   A janela do CNO só vale para serviço. Proposta do PO: obrigatória nas duas por
   simetria de formulário. É decisão de fricção, não fiscal — o `contador`
   registrou como ponto a confirmar antes do Gate 2
2. `documento` no projeto **remoto** está vazia hoje? Uma consulta responde, e
   ela **é** o critério 12

## Teste do Canteiro

- **Meta 1** (nenhum pagamento sem documento hábil): **neutro** — não muda o que
  é hábil. Registrado assim em vez de forçar
- **Meta 2** (relatórios prontos): **move muito** — é o insumo sem o qual o texto
  da discriminação não existe, e é a única razão de o ticket ser P0
- **Meta 3** (acervo): **move pouco e move de verdade** — o número é o que permite
  achar uma nota no meio de 400–600 arquivos daqui a oito anos
- Uma mão, com pressa: **sim, se os campos ficarem no passo do valor.** Se o mock
  criar um quarto passo, o PO devolve
- **Veredito: APROVADO — P0 dentro da R1**, condicionado a mock aprovado junto do
  CONTAI-007
