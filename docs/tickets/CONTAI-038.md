# CONTAI-038 Retenção de NF de serviço PJ vira lista de linhas, não booleano de 11%

## Tipo e Prioridade
feature — **P0 fiscal** — o campo hoje modela um fato binário ("é 11%?") que
não existe estruturalmente para tomador pessoa física (parecer, §0), e a
pendência que ele alimenta hoje (`servico_sem_retencao`) está calibrada para
uma conta que a aferição do SERO nunca faz. Enquanto isso não fecha, o
produto continua com um sinal fiscal fundamentado em premissa já corrigida.

## Dor de Origem
`docs/backlog/30-2026-09-19-retencao-variavel-servico-pj.md`. Palavras do
Mateus:

> *"A NF tem retenção aparente de 3%, não 11% tem que validar isso, as notas
> do francisco vem com 3% a do Alex vem com 4,8%, ou seja cada um tem a sua,
> portanto eu acho que tem ser um input"*

> *"[Francisco/Alex] foi só um exemplo, podemos ter N outras empresas
> envolvidas"*

## User Story
Como dono da obra que paga prestadores PJ com retenções heterogêneas e nem
sempre discriminadas por tributo, quero registrar cada linha de retenção da
nota exatamente como ela aparece, sem o app supor o que ela significa, para
que o custo de aquisição, a discriminação anual e o dossiê reflitam o fato
real da nota, e a aferição do SERO nunca seja contaminada por um número que
não tem nenhuma relação legal com ela (parecer, §0 e §2).

## Critérios de Aceite

**Fluxo de captura — `/adicionar/documento` (canteiro, uma mão)**

1. [x] O campo booleano atual "NF de serviço: tem retenção de 11%?" é
   substituído por UMA pergunta de gate, sem opção pré-marcada: "Esta nota
   destaca alguma retenção?" — **nenhuma** / **destacada**. Nenhuma outra
   pergunta de retenção aparece nesta tela — o repeater de linhas vive na
   tela de detalhe (Gate de Mock, §"o problema": conteúdo de gestão não entra
   em tela de captura, CLAUDE.md, tabela de cenários).
2. [x] `documento` grava a resposta do gate (nova coluna, ver Viabilidade) — o
   documento pode ser salvo com "destacada" e zero linhas ainda gravadas: essa
   combinação é **visível como pendência aberta na tela de detalhe**, nunca
   lida como "nota sem retenção" (Viabilidade, dissent do `cto-obra`).

**Fluxo de resolução — `/documento/[id]` (gestão, em casa, sentado)**

3. [x] Quando o gate = "destacada", a tela de detalhe oferece um repeater
   (adicionar/remover linha livremente) de "linhas de retenção". Cada linha
   tem, sem nenhum valor pré-marcado:
   - `rotulo_literal`: texto livre, copiado da nota, nunca normalizado nem
     sugerido pelo sistema;
   - `valor`: numérico, obrigatório;
   - `composicao`: **tributo único identificado** / **total combinado, não
     aberto pela nota** / **não sei o que este valor representa** (parecer,
     ADENDO A.1);
   - se `composicao = tributo único identificado` → pergunta adicional de
     qual tributo, entre ISS/INSS/IRRF/PIS/COFINS/CSLL, sem opção pré-marcada
     (parecer, ADENDO A.1);
   - `e_desconto_efetivo`: sim/não, sem pré-marcado — "esse valor é de fato
     abatido do que você transfere ao prestador?" (parecer, §3);
   - se `e_desconto_efetivo = sim` → pergunta adicional obrigatória "quem
     recolhe isto: **eu** / **a empresa** / **ainda não sei**", com "ainda não
     sei" como resposta válida de primeira classe, não erro de preenchimento
     (parecer, ADENDO A.2 e A.4).
4. [x] `composicao = combinado, não aberto pela nota` ou `não sei` →
   **nenhuma tela do produto** (registro, detalhe, discriminação anual,
   Pagamentos Efetuados, dossiê) oferece decompor esse valor entre tributos —
   nem sugestão, nem estimativa (parecer, ADENDO A.1 — regra dura).
5. [x] Documento com `gate = destacada` e alguma linha sem `composicao`, ou
   com `e_desconto_efetivo = sim` sem "quem recolhe" respondido, é
   **incompleto**: mesma disciplina de "campo vazio pergunta" já vigente no
   produto — banco recusa via CHECK (Viabilidade), tela nomeia o que falta
   (parecer, §4).

**Pendência e cálculo**

6. [x] A pendência atual `servico_sem_retencao` (chip "Sem retenção 11%",
   gravidade âmbar, `lib/fiscal/resumo.ts:563-578`) é **removida por
   inteiro**, junto com a constante `CONSEQUENCIA_SEM_RETENCAO`.
7. [x] Nasce pendência nova, `tipo: "retencao_sem_recolhedor"`, disparada por
   linha com `e_desconto_efetivo = sim` **e** (`quem_recolhe`
   vazio/"ainda não sei" OU `quem_recolhe = "eu"` sem a perna de pagamento da
   guia vinculada fechando `Σ pagamentos vinculados == valor_bruto_nota`).
   Fecha quando `quem_recolhe = "a empresa"`, ou quando a guia paga aparece
   vinculada. Texto de consequência, copiado literal do parecer (Gate
   Fiscal): *"Retenção descontada do pagamento sem confirmação de quem
   recolhe — se ninguém recolher, não é economia, é passivo não
   identificado."*
7a. [x] **A gravidade não é `"red"` literal** — nasce de
   `gravidadeDaRegua(...)` (`lib/fiscal/gravidade.ts`, produtor único do tipo
   `Gravidade` branded, `CONTAI-035`), como **segunda exceção nomeada** da
   união (a primeira é `pj_pago_sem_comprovante`), fundada no ADENDO A.4 do
   parecer — confirmado pelo `cto-obra` (Viabilidade): pela tabela-verdade
   geral (`dinheiroSaiu` × `apoioHabilNoAnoCerto`) esta pendência cairia em
   âmbar (o valor retido não saiu do bolso do Mateus; a nota hábil existe),
   mas o vermelho se funda em outra coisa — passivo não identificado, não
   fato consumado sem apoio. O teste-trava D54 (`CONTAI-035`, critério 11)
   ganha esta segunda entrada na lista de exceções.
8. [x] A pendência nova **nunca** soma em `custoConfirmadoAnoCentavos`, nunca
   é lida por lógica de abatimento da aferição SERO, e nunca nasce quando
   `e_desconto_efetivo = não` (linha meramente informativa).
9. [x] `documento.retencao11: boolean` sai do **schema** (migration), não só
   da UI — nenhuma tela volta a mostrar ou gravar esse campo em nenhuma
   forma (parecer, §3 e ADENDO A.5).
10. [x] `favorecido.retencao_11` (a flag de "% padrão do prestador", hoje sem
    uso na UI) sai do schema no mesmo diff — é a materialização exata do
    "% padrão por prestador" que o parecer já rejeitou (§3); deixá-la viva é
    convite para a próxima feature reintroduzir a ideia (Viabilidade,
    `cto-obra`).
11. [x] `grep -rn "servico_sem_retencao\|retencao11\|retencao_11" app lib e2e`
    devolve zero ocorrências fora dos arquivos desta migração/histórico de
    testes já atualizados.
12. [x] O custo de aquisição de qualquer NF de serviço continua sendo
    `valor_bruto_nota`, no regime de caixa da data de pagamento, **qualquer**
    que seja a composição, natureza ou percentual das linhas de retenção —
    isto não muda (parecer, §6; ADENDO A.2 e A.5).
13. [x] A base de aferição do SERO não lê `rotulo_literal`, `valor`,
    `composicao`, `e_desconto_efetivo` nem `quem_recolhe` de nenhuma linha —
    o único fato que abateria a aferição (declaração vinculada ao CNO) é
    **fora de escopo deste ticket** (ver Perguntas Abertas).

**Extração automática (US-008 Fase 2)**

14. [x] O pipeline de extração automática (`lib/extracao/`) nunca preenche
    `composicao`, o tributo específico, `e_desconto_efetivo` nem
    `quem_recolhe` sozinho — os quatro chegam sempre em branco para
    confirmação humana, mesmo quando o texto da nota permitir uma inferência
    plausível (parecer, §3/§4). `rotulo_literal` e `valor` da(s) linha(s) de
    retenção **podem** ser sugeridos pela extração (são leitura de texto
    impresso, não classificação fiscal) — o Mateus confirma antes de salvar,
    igual a qualquer outro campo extraído hoje.

**Modelo de dados / migration**

15. [x] Tabela nova `documento_retencao` (colunas, enums e CHECKs conforme
    Viabilidade) nasce com `revoke all` seguido de
    `grant select, insert, update, delete` para `authenticated` no mesmo
    diff da migration — nunca `alter default privileges`, nunca
    `all tables in schema public` (regra dura do `CLAUDE.md`). **DELETE
    concedido — decisão do `cto-obra`, 2026-09-20** (ver Viabilidade
    abaixo, "Correção de linha (2026-09-20)"): esta tabela é **afirmação**
    do Mateus sobre o papel (como `pagamento_documento`), não **acervo**
    com arquivo no bucket (como `documento_anexo`, que segue sem DELETE) —
    a prova (a NF) continua intacta em `documento`. Policy `for all` precisa
    de `using` **e** `with check` iguais, senão o DELETE passa pelo grant e
    é barrado em silêncio pela RLS (0 linhas, sem erro).
16. [x] `e2e/privilegios.spec.ts` ganha a linha `documento_retencao:
    "DELETE,INSERT,SELECT,UPDATE"` (ordem alfabética, como
    `pagamento_documento`) no mesmo diff da migration, com comentário do
    porquê: DELETE é exceção nomeada da 0006 (mesma razão que
    `pagamento_documento`); UPDATE só para responder/corrigir
    `quem_recolhe`.
17. [x] Nenhum campo fiscal desta tabela nasce com `DEFAULT` no banco —
    confirmado pela leitura da migration no Gate 2 (mesmo naipe de invariante
    do "append-only" e "anexo obrigatório", `CONTAI-034`).
18. [ ] **Critério de release, não de Gate 1**: antes de `db push` no projeto
    remoto, rodar `select count(*) from documento where tipo='nf_servico' and
    retencao_11 is not null` e anotar o resultado no backlog. Se > 0, essas
    notas recebem `gate = null` (não `nenhuma`) e a tela de detalhe pede a
    conferência — nunca backfill por inferência do valor antigo.

## Out of Scope
- Recolhimento efetivo de guia pelo Mateus (gerar DARF/guia) — a resposta
  "ainda não sei" a "quem recolhe" já satisfaz a meta ao nomear a pendência;
  resolvê-la é ação humana fora do app (parecer, §7).
- Contatar a contabilidade de Francisco/Alex para confirmar o que o
  percentual representa — ação fora do software (parecer, §7, "Exige CRC").
- Cadastro de prestador com "% padrão de retenção" — solução já descartada
  pelo parecer (§3), não é versão futura deste ticket.
- Campo "esta mão de obra foi declarada no CNO?" (o único fato que de fato
  abate a aferição do SERO, parecer 2026-08-18 A.5 Pergunta 2) — confirmado
  que não existe no produto hoje; é feature ortogonal, própria, sem ticket.
  Recomendação ao `po`: abrir entrada de backlog para não perder o fio.
- Mudar `alocarCusto`/`vinculo.ts` para tratar "retenção recolhida pela
  empresa" como perna paga na data do líquido — o `cto-obra` recomenda manter
  o comportamento atual (saldo descoberto = valor retido) e só rotular melhor
  o texto do detalhe; virar ticket próprio se o `contador` decidir o
  contrário.
- Correção/edição de `rotulo_literal`/`valor` de uma linha já gravada por uma
  RPC dedicada — dívida declarada, ticket futuro que estende `corrigir_documento`.

## Gate Fiscal (Contador)

**Fonte normativa única**: `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`
(corpo §§0–7 + ADENDO 2026-09-19, que vence onde divergir do corpo). Nenhuma
regra abaixo é nova — é a transcrição operacional do parecer já fechado.

### P1 — a pendência `servico_sem_retencao` não desaparece: nasce pendência nova

Remover a pendência sem substituto faria o painel silenciar exatamente o caso
mais perigoso das quatro hipóteses do §1 (retenção indevida, ninguém recolhe).

- **Se** existe uma linha com `e_desconto_efetivo = true` **e** "quem recolhe"
  ainda não tem resposta → nasce pendência nova, gravidade **vermelha**
  (convenção D39: fato consumado + consequência fiscal aberta — o dinheiro já
  saiu do valor transferido ao prestador). Texto de consequência a copiar
  literal, nunca reescrever: *"Retenção descontada do pagamento sem
  confirmação de quem recolhe — se ninguém recolher, não é economia, é
  passivo não identificado."*
- **Se** a resposta for "a empresa recolhe" → a pendência fecha (o parecer não
  exige comprovante do recolhimento do prestador como condição de bloqueio).
- **Se** a resposta for "eu recolho" → aplica-se o fechamento
  `Σ pagamentos vinculados == valor_bruto_nota` já normatizado no parecer de
  2026-08-18 §4.1: falta a perna de pagamento (guia) vinculada → pendência
  continua aberta, agora por comprovante de pagamento da guia.
- **Se** `e_desconto_efetivo = false` (informativo, ex.: composição do DAS do
  Simples) → nenhuma pendência nasce. Esta é a nova condição de saída — nunca
  o valor de um percentual.
- Esta pendência **nunca** soma em `custoConfirmadoAnoCentavos`, **nunca**
  soma em `notasSemPagamento`, e **nunca** é lida por lógica de abatimento da
  aferição SERO — visibilidade de passivo em aberto, mesmo espírito de
  `diferenca_sem_explicacao`, sem bloquear o relatório anual.

### P2 — o campo "declarado no CNO?" não existe, e isso não bloqueia este ticket

Confirmado: o campo "esta mão de obra foi declarada no CNO?" (Pergunta 2 do
A.5, parecer de 2026-08-18) genuinamente não existe no produto — nem em
`lib/`, nem em schema, nem em UI, nem em nenhum backlog/ticket. **Não é
dependência bloqueante.** Os dois pontos são ortogonais por desenho do
próprio parecer (§2, reforçado em A.2): *"a aferição do SERO nunca lê nenhum
desses campos [de retenção]. Ela só lê a resposta à Pergunta 2 do A.5."* Este
ticket entrega apenas a garantia (critério 13): os campos novos de retenção
nunca entram em cálculo de abatimento da aferição — nem hoje, nem por herança
futura. Recomendação, fora deste gate: abrir backlog próprio para o campo
real do CNO.

### Regras adicionais — "se X e Y → Z"

- Nota discrimina por tributo → `composicao = tributo identificado` **e** o
  Mateus escolhe qual tributo — nunca inferido a partir do rótulo (A.1).
- Nota traz linha combinada (caso real do Francisco, "Total das Retenções
  (ISSQN/Federais)") → `composicao = combinado, não aberto pela nota` **e** o
  sistema nunca decompõe o valor entre tributos, nem por estimativa (A.1).
- Mateus não sabe o que a linha representa → `composicao = não sei` é
  resposta válida de primeira classe, não erro de preenchimento (A.1).
- Linha de retenção sem `composicao` no momento de salvar → bloqueia o
  salvamento, nunca há default (§4, reforçado A.3).
- Percentual aparente = exatamente 11% do valor total → o sistema não
  presume que está correto por coincidir com o art. 31; mesma exigência de
  classificação se aplica, sem exceção (§4).
- Qualquer código (atual ou futuro) lendo `documento.retencao11` para decidir
  custo ou base SERO → achado mais grave possível deste gate. Alvo direto:
  `lib/fiscal/resumo.ts:576` e `CONSEQUENCIA_SEM_RETENCAO` (§3).
- Produto pede dado do prestador (regime tributário, Anexo do Simples) para
  decidir composição → regra fabricada, reprovada. Estrutura é **por
  documento**, nunca por prestador (resposta direta ao "N outras empresas",
  A.1).
- Linha com `composicao` ≠ tributo identificado **e** `e_desconto_efetivo =
  true` → a perna de pagamento correspondente não pode ser nomeada "guia de
  ISS"/"guia de INSS" — rótulo correto: "retenção não discriminada,
  presumivelmente recolhida por terceiros" (A.2).
- Em nenhum critério deste ticket o custo de aquisição muda de forma: sempre
  `valor_bruto_nota`, regime de caixa (§6, A.2, A.5).
- Em nenhum critério a base SERO é reduzida por retenção de nenhuma nota — só
  a declaração vinculada ao CNO abate, e está fora de escopo (P2).

### Automático × exige CRC

**Sistema faz sozinho**: captura a(s) linha(s) exatamente como na nota, sem
normalizar; exige `composicao`/`e_desconto_efetivo` sem default, bloqueando
salvamento se vazios; abre/fecha a pendência nova conforme "quem recolhe";
aplica o fechamento `Σ pagamentos == valor_bruto_nota`; nunca soma retenção
na base SERO; remove `retencao11` do schema e de todo cálculo; nunca decompõe
valor combinado.

**Exige CRC**: (1) confirmar com a contabilidade de Francisco, Alex ou
qualquer prestador futuro o que a linha representa e se corresponde a
obrigação real de recolhimento; (2) avaliar, se surgir caso concreto, se há
enquadramento do Mateus como "empresa contratante" para efeito do art. 31 —
não identificado até aqui.

## Pre-mortem
1. **A pendência antiga já materializa hoje a conta que o parecer proibiu**:
   `lib/fiscal/resumo.ts:576` usa `d.retencao11 === true` como proxy de
   "abate a aferição". Se o ticket só remover o campo do formulário sem
   remover essa leitura, alguém "conserta" trocando por uma leitura das
   linhas novas — reintroduzindo o erro fiscal com outro nome.
2. **A Fase 2 (extração automática) reintroduz a inferência que este ticket
   proíbe**: sem trava explícita (critério 14), é natural o pipeline
   "adivinhar" `composicao`/tributo a partir do texto para poupar clique —
   violando "o app nunca rotula a linha antes do Mateus escolher".
3. **"Combinado" vira decomposto em algum relatório futuro** (discriminação
   anual, dossiê, tela de "detalhamento por tributo" por conveniência) que
   rateia o valor combinado por estimativa "para completar a tabela" — mesmo
   erro já vetado para material×mão-de-obra, com outro nome.

## Viabilidade (CTO)

**Base conferida**: `supabase/migrations/0001–0012` (padrão tabela-filha +
revoke/grant, especialmente `0005`, `0009`, `0010`), `e2e/privilegios.spec.ts`,
`lib/fiscal/resumo.ts`, `lib/fiscal/vinculo.ts`, `lib/fiscal/documento.ts`,
`lib/types.ts`, `lib/dados/comum.ts`, `lib/data.ts`, `app/documento/[id]/page.tsx`,
`app/page.tsx`, seeds.

### Modelo de dados — tabela própria `documento_retencao`, não jsonb

O schema não tem hoje nenhuma coluna jsonb persistida — toda relação 1:N é
tabela (`documento_anexo`, `terreno_desembolso_anexo`,
`financiamento_informe`). Motivo documentado na 0009: **privilégio no
Postgres é por tabela, nunca por coluna** — jsonb herdaria o UPDATE amplo de
`documento` e ficaria invisível para `privilegios.spec.ts`. Aqui pesa mais:
`composicao`, `tributo` e `quem_recolhe` são enums sem default com
dependência entre si; em jsonb esses CHECKs viram só convenção de código.

```
documento_retencao
  id                 uuid pk default gen_random_uuid()
  documento_id       uuid not null references documento(id) on delete cascade
  rotulo_literal     text not null
  valor              numeric(14,2) not null check (valor > 0)
  composicao         composicao_retencao not null   -- tributo_identificado | combinado_nao_aberto | nao_sei
  tributo            tributo_retido                 -- iss | inss | irrf | pis | cofins | csll
  e_desconto_efetivo boolean not null
  quem_recolhe       quem_recolhe_retencao          -- eu | empresa | nao_sei
  created_at         timestamptz not null default now()
  check ((composicao = 'tributo_identificado') = (tributo is not null))
  check (e_desconto_efetivo = (quem_recolhe is not null))
index (documento_id, created_at)
policy dono_documento_retencao: for all using (exists(select 1 from documento d where d.id = documento_id and d.user_id = auth.uid())) with check (same)
```

**Dissent incorporado (critério 2)**: "0..N linhas sem afirmação explícita de
gate" deixaria lista vazia indistinguível de "não respondi" — violando
"campo vazio pergunta". Correção: `documento` ganha coluna própria
`retencao_na_nota` (enum `nenhuma` | `destacada`, nullable só para legado,
sem default), obrigatória em `nf_servico` no `validarDocumento`. `destacada`
com zero linhas gravadas é inconsistência **visível** na tela de detalhe,
nunca lida como "sem retenção".

**Correção de linha (2026-09-20, decisão do `cto-obra`, achado do `po` no
Gate de Design)**: corrigir `composicao`/`e_desconto_efetivo` de uma linha
já gravada é **remover a linha e recriar** (editar um formulário de 5 campos
com dependência condicional não vale a pena — mesma conclusão do `po` e do
`designer`, por caminhos diferentes). Isso exige DELETE, que a versão
anterior deste documento negava por "append-only". Decisão: **conceder
DELETE**, não soft-delete. Fundamento — `documento_retencao` é **afirmação**
do Mateus sobre o papel (mesma classe de `pagamento_documento`, que já tem
DELETE desde a 0006), não **acervo** com arquivo no bucket (classe de
`documento`/`documento_anexo`, que não tem DELETE porque a linha É a prova
apontando para o objeto). Uma linha de retenção errada não perde documento
nenhum — a NF continua intacta em `documento`/`documento_anexo` — e pelos
critérios 12/13 não toca custo de aquisição nem base SERO; o raio de dano é
só uma pendência vermelha errada. Soft-delete (`removida_em` nullable) foi
rejeitado: é DELETE disfarçado de UPDATE, e todo leitor (`resumo.ts`, valor
da pendência, detalhe, dossiê, CHECKs, E2E) passaria a depender de um filtro
`where removida_em is null` — um filtro esquecido em qualquer um desses
lugares é o erro fiscal silencioso que o projeto proíbe. Fora de escopo:
`documento_retencao` não entra em `entidade_revisao` (rastro de remoção) —
ninguém pediu; abre ticket se o `contador` quiser depois.

### Migration `0017_documento_retencao.sql`

**Número corrigido em 2026-09-20** — a Viabilidade original foi escrita
antes de `0013_fatura` … `0016_mover_pagamento_de_obra` existirem; a próxima
livre é `0017`.

- Dado hoje: nenhum seed de produção verificável pelo repo — critério de
  release (critério 18) confere o remoto antes do `db push`.
- `alter table documento drop column retencao_11` **e**
  `alter table favorecido drop column retencao_11` no mesmo diff (critério 10).
- Grants: `revoke all ... from anon, authenticated` depois
  `grant select, insert, update, delete on table documento_retencao to
  authenticated`, com comentário citando a 0006 ("afirmação, não acervo") e
  uma linha dizendo por que `documento_anexo` continua sem DELETE (linha =
  objeto no bucket). **DELETE concedido — ver "Correção de linha" acima.**
- `seed-demo.sql` perde a coluna do insert antigo e ganha uma linha de
  exemplo (`combinado_nao_aberto`, `e_desconto_efetivo=true`,
  `quem_recolhe=null`) para a home de dev exibir a pendência nova.

### Pendência nova em `lib/fiscal/resumo.ts`

- `TipoPendencia` perde `"servico_sem_retencao"`, ganha
  `"retencao_sem_recolhedor"`. Bloco atual (l. 563-578) e
  `CONSEQUENCIA_SEM_RETENCAO` saem; entram, depois de `alocarCusto` já
  calculado: para cada `nf_servico` fora de quarentena, para cada linha com
  `e_desconto_efetivo=true` → `quem_recolhe="empresa"` fecha;
  `quem_recolhe=null|"nao_sei"` abre; `quem_recolhe="eu"` abre sse
  `saldoDescobertoDaNota(d, alocacao) !== null` (reaproveita o cálculo
  existente, não escreve segunda soma). Uma `Pendencia` por documento,
  `valorCentavos` = soma das linhas ainda abertas.
- Comentários em `resumo.ts` (l. 22, 288, 603) e `ACAO_POR_TIPO` em
  `app/page.tsx` citam o tipo antigo — atualizar. Gate 2 confere `grep`
  (critério 11) = zero.
- **Linha para o `contador` avaliar, não decidida por este ticket**: com
  `quem_recolhe="empresa"`, `alocarCusto` deixa a nota parcialmente coberta
  para sempre (custo comprovado = líquido pago). Recomendação: manter o
  comportamento (regime de caixa — o valor retido não saiu do bolso dele) e
  só melhorar o rótulo no detalhe; virar ticket próprio em `vinculo.ts` se o
  `contador` decidir diferente.

### Arquivos a tocar

`supabase/migrations/0017_documento_retencao.sql` (**número corrigido em
2026-09-20**, era `0013` na Viabilidade original — 0013-0016 já existem),
`supabase/seed-demo.sql`, `e2e/privilegios.spec.ts`, `lib/database.types.ts`,
`lib/types.ts`, `lib/dados/comum.ts` (+ `.test.ts`), `lib/data.ts`,
`lib/fiscal/documento.ts` (+ `.test.ts`), `lib/fiscal/resumo.ts`
(+ `.test.ts`), `app/adicionar/documento/page.tsx`,
`app/documento/[id]/page.tsx`,
**`app/documento/[id]/anexar/page.tsx`** (achado do `designer` em
2026-09-20, fora da lista original — repergunta os checks fiscais quando o
arquivo chega depois e referencia `retencao11` em 6 pontos; espelha o mesmo
gate de 2 opções, sem repeater), `app/documento/[id]/outro-dado/page.tsx`,
`app/page.tsx`, `lib/extracao/schema.ts` (comentário), `CLAUDE.md`; E2E:
`ingestao.spec.ts`, `vinculo.spec.ts`, `obra.spec.ts`, spec novo para o ciclo
da pendência (nasce → responde "empresa" → some; "eu" → vincula guia → some;
remove linha com pendência aberta → pendência some da home; DELETE de linha
de outro usuário → 0 linhas, tela mostra erro).

### Complexidade: **L**

Não pela tabela (S), mas pelo repeater novo (mock inédito), reescrita da
Tela 7, ~18 pontos de E2E a atualizar, e um `drop column` em produção. Não
fatiar: pendência vermelha sem o caminho de responder "quem recolhe" é
pendência sem remédio.

**Dívidas declaradas**: correção de `rotulo_literal`/`valor` de linha já
gravada não tem RPC própria ainda (ticket futuro); troca de tipo
`nf_servico → nf_material` deixa linhas órfãs, inertes mas presentes;
documento e linhas gravam em dois statements (sem RPC única — mitigado pela
visibilidade do critério 2); legado com `retencao_na_nota = null` não gera
pendência, só rótulo no detalhe.

## Dependências

- **Bloqueado por `CONTAI-035` (sem item F)** — decisão de sequenciamento
  registrada em `docs/backlog/31-2026-09-19-sequenciamento-contai-035-038.md`.
  Dois motivos, não um: (1) o item F do `035` reclassificava a cor da
  pendência `servico_sem_retencao` no mesmo trecho que este ticket apaga —
  resolvido removendo F do escopo do `035` (fiscal, `po`); (2) a pendência
  nova deste ticket precisa de `lib/fiscal/gravidade.ts`/`gravidadeDaRegua`
  já existindo para nascer como segunda exceção nomeada, não como cor
  literal solta — confirmado pelo `cto-obra` (ver critério 7a). `CONTAI-035`
  (sem item F) entra ANTES do `CONTAI-038` na fila.
- Bloqueia: nenhum ticket a jusante identificado.
- Bloqueado por (2): aprovação do mock (ver Cenário abaixo) — **PENDENTE:
  rodar `/design` antes de `/develop`**.

## Perguntas Abertas
- Se o `contador` quiser que "retenção recolhida pela empresa" conte como
  perna paga na data do líquido em `alocarCusto`/`vinculo.ts` — hoje fora de
  escopo (ver Out of Scope), viraria ticket próprio.

~~Confirmação do `po`: abrir entrada de backlog para o campo "mão de obra
declarada no CNO"~~ — **decidido em 2026-09-19**: não abre ticket agora,
registrado como dívida nomeada D57 (`docs/backlog.md`), sem dono até o
Mateus priorizar.

~~Resolução do conflito com `CONTAI-035` item F~~ — **decidido em
2026-09-19** (ver Dependências e `docs/backlog/31-2026-09-19-sequenciamento-contai-035-038.md`).

## Cenário e checagem final

**Misto, por tela** — resolvido no Gate de Mock:
- `/adicionar/documento` (gate de 1 pergunta): **captura** — canteiro, uma
  mão. O Teste do Canteiro se aplica aqui, e é o motivo do critério 1 existir:
  o repeater inteiro (5 perguntas por linha, N linhas) estourava o limite de
  "~3 interações" do momento de captura se ficasse nesta tela.
- `/documento/[id]` (repeater + resolução de "quem recolhe") e `app/page.tsx`
  (pendência na home): **gestão** — em casa, sentado, revisando a nota com
  calma. Régua de "uma mão, com pressa" não se aplica aqui (CLAUDE.md,
  correção de 2026-08-18).

**Nível de mock**: misto — nível 1 (HTML navegável, `design/mocks/CONTAI-038.html`)
para `/adicionar/documento` (só o gate) e `/documento/[id]` (repeater +
resolução), porque o padrão de interação "repeater com campos condicionais em
cascata, sem default" não tem precedente no app; nível 3 (tabela antes/depois)
para a home, que só troca chip/texto/destino de um item de lista já existente
(mesmo padrão do `CONTAI-035`). Mocks anteriores relevantes: `CONTAI-001`
(#s7, #s1 — origem da Tela 7 e do chip antigo), `CONTAI-004` (formulário atual
de `/adicionar/documento`), `CONTAI-021` (vocabulário de "ação nomeada para
corrigir ali mesmo"), `CONTAI-035` (precedente do nível 3 na home). **Nenhum
mock existente cobre o repeater — PENDENTE: rodar `/design` antes de
`/develop`.**

**Veredito**: **APROVADO, com 2 dependências que bloqueiam o Gate 1** — não
falha de requisito: (1) `CONTAI-035` (sem item F) precisa entrar antes deste
ticket na fila — decisão já tomada em 2026-09-19, ver Dependências; (2) rodar
`/design` para o mock nível 1 (repeater e resolução de pendência), que ainda
não existe. Gate Fiscal e Viabilidade técnica estão fechados e não bloqueiam
mais nada além disso.
