# CONTAI-028 Quebrar `lib/data.ts` em módulos por entidade

## Roteamento do `/develop`
- **Tipo**: chore (refatoração, movimentação pura de código)
- **Prioridade**: **P2** — não serve a nenhuma das três metas do produto de
  forma direta. **Cede lugar a qualquer item com consequência fiscal em aberto
  na fila vigente.** Ver "Quando este ticket NÃO deve rodar", no fim
- **UI**: **não há.** Nenhuma tela muda, nenhum texto muda → **Gate 0 não se
  aplica**, não existe mock e não se roda `/design`
- **Gate Fiscal**: **SIM** — nenhuma regra muda de propósito, mas o arquivo é a
  única fronteira entre o banco e as duas apurações. Gate 2 roda o `contador`
- **Concorrência**: **este ticket roda sozinho.** Toca o arquivo que quase toda
  tela importa; em paralelo com qualquer ticket de dados, o merge escolhe um
  lado e uma regra do `CONTAI-021` volta em silêncio para a versão antiga

## Tipo e Prioridade
chore — P2 — dívida **D40**, registrada em
`docs/backlog/16-2026-08-22-custo-de-contexto-do-pipeline.md`.

## Dor de Origem

> *"esta sessão está consumindo demais… o agente me falou que estava lendo todos
> os arquivos novamente a cada agente que rodava no `/develop`"* — Mateus,
> 2026-08-22

Consertar os prompts do pipeline (feito em 2026-08-22) não reduz a leitura de
**código**. `lib/data.ts` tem **2065 linhas**, **63 exports** e é a camada
inteira de acesso a dados. **36 arquivos importam dele** — 35 em `app/` mais o
próprio `lib/data.test.ts`.

**Para quem é a dor, sem maquiar (`po`): é do time de agentes, não do Mateus.**
Nenhuma das três metas melhora um milímetro quando o arquivo vira 13. Pelo
filtro literal de escopo isto é candidato a corte — e seria cortado, não fosse
um efeito de segunda ordem que é fiscal: é ali que moram `criarPagamento`,
`criarDocumento`, `criarVinculos`, `quitarCompromisso` e as quatro ações
nomeadas do `CONTAI-021`. **Agente que lê 20% de um arquivo de 2065 linhas e
escreve gravação fiscal por inferência é risco da meta 1**, não é só custo.

Dois agravantes medidos: `lib/data.test.ts` tem **62 linhas para 2065 de
código** (a camada é coberta quase só por Playwright — a rede é curta); e os
mappers são compartilhados entre blocos, então quebrar sem um módulo comum
produz duplicação, que é pior que o arquivo grande.

## User Story

Como **time de agentes que mantém o contai** — e, por tabela, como Mateus, que
paga o token e come o risco de gravação fiscal errada — quando abro um gate do
`/develop` que mexe em acesso a dados, quero **abrir só o módulo do assunto**,
para que o agente leia 100% do que vai alterar em vez de amostrar um arquivo
que não cabe no orçamento de leitura.

## Critérios de Aceite

Refactor não tem critério verificável em tela. O critério é **equivalência de
comportamento provada por ausência de mudança**.

1. [ ] `npm run quality` verde **sem uma única linha alterada em arquivo de
       teste** — nem `lib/*.test.ts`, nem `lib/fiscal/*.test.ts`, nem
       `e2e/*.spec.ts`, nem `e2e/banco.ts`. Teste alterado no mesmo diff passa a
       provar o teste novo, não a equivalência. **Exceção única**: caminho de
       import, se algum precisar mudar
2. [ ] **Nenhum dos 36 importadores aparece no diff.** `lib/data.ts` permanece
       como barrel reexportando os mesmos nomes com as mesmas assinaturas
3. [ ] **Superfície de export idêntica**: `grep '^export'` no conjunto dos
       módulos novos = a lista atual dos **63 exports** de `lib/data.ts`, em
       nome e em tipo. Comparação mecânica, não olhômetro
4. [ ] O diff é auditável como **movimentação**: para cada função exportada, o
       corpo em `git show HEAD:lib/data.ts` e o corpo no módulo novo são
       idênticos a menos de import e indentação. Renomear, mudar parâmetro,
       "aproveitar e melhorar" — tudo fora
5. [ ] **Golden snapshot contra o Postgres local** (critério do `contador`):
       antes do refactor, com `supabase/seed.sql` carregado, serializar
       `carregarPaineis()`, `carregarPainelDePendencias()`,
       `carregarCorrecoesDoDocumento()` e `carregarAlcanceDoFavorecido()` em
       JSON com chaves ordenadas. Depois: **igualdade byte a byte**. Um centavo,
       uma ordem ou um `null`→`0` que mude **reprova**
6. [ ] **Inventário de conversão**: hoje há **38** ocorrências de
       `numericParaCentavos`/`centavosParaNumeric` em `lib/data.ts`. A contagem
       por call-site bate antes e depois, campo por campo. Conversão que sumiu
       ou dobrou é erro de 100×
7. [ ] Mapper compartilhado fica em **um** módulo comum. Zero duplicação
8. [ ] Nenhuma migration, nenhum `GRANT`, nenhuma linha de SQL no diff
9. [ ] Nenhum módulo resultante acima de ~400 linhas

## Out of Scope

- **Redesenho da camada** (repository, DI, client injetado, troca de
  assinatura). É proposta de arquitetura, não dívida de leitura — ticket próprio
- **Escrever os testes unitários que faltam.** A tentação é enorme e o argumento
  é bom, e ainda assim destrói o critério 1. → **`CONTAI-029`**, que depende da
  fatia 1 deste ticket: é ela que leva os 14 mappers puros para
  `lib/dados/comum.ts`, onde ser exportado é legítimo e o teste enxerga.
  ⚠️ Consequência assumida: **este ticket move ~2000 linhas sem essa rede** —
  quem segura o veredito são os critérios 4 (auditoria de movimentação) e 5
  (golden snapshot), não teste unitário
- **Migrar os 36 importadores para o módulo específico.** Diff de rename em 36
  arquivos no mesmo PR do move esconde qualquer erro real no review. O que
  encarece o gate é o arquivo que se **abre para editar**, não o caminho do
  import
- **Corrigir bug encontrado no caminho.** Anota, não conserta: bug consertado
  dentro de refactor é bug sem teste e sem gate fiscal
- **Tocar `lib/fiscal/*`, `lib/types.ts` ou `lib/acervo.ts`** — a seta é
  inversa (`data.ts` importa deles) e eles estão fora da dor medida

## Gate Fiscal (Contador)

**Refactor sem mudança de regra.** Mas o arquivo é a única fronteira entre o
banco e as duas apurações, e quatro zonas movem dinheiro em silêncio se o módulo
novo "limpar" o que parece redundância.

⚠️ **Correção de premissa**: `alocarCusto` **não está** em `lib/data.ts` — está
em `lib/fiscal/vinculo.ts:413`, puro e com teste unitário. O que `data.ts` detém
é a **entrada** dele (`carregarPainel` → `PainelDados`).

### As condições que o refactor preserva

| Função | Apuração | Se X → Y |
|---|---|---|
| `carregarPainel` / `carregarPaineis` | custo IRPF + INSS + acervo | se `numeric(14,2)` volta do PostgREST ora `number` ora `"4850.00"` → continua passando por `numericParaCentavos` (aceita os dois, `Math.round(n*100)`), **nunca** `Number(x)*100` nem `parseFloat`. Incidente registrado no `CLAUDE.md` |
| idem | custo IRPF | se um informe pertence a contrato de **outra** obra → continua filtrado por `contratosDaObra`; e se há N obras → **nada soma entre matrículas** (Bens e Direitos é por matrícula) |
| idem | custo IRPF | se `documento.valor` é `null` → `valorCentavos` fica `null`, mas pagamento/desembolso caem em `?? 0`. Essa **assimetria é deliberada**: unificar em `?? 0` faz nota sem valor virar R$ 0,00 declarado |
| `corrigirValorDoDocumento` | custo IRPF + pendência de retificadora | se o valor muda → `p_depois` vai como **texto** `.toFixed(2)` e `p_anos` **não vazio**, por RPC transacional. Perder o `toFixed(2)` ou trocar por `String(n)` corrompe o antes→depois do rastro (`docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` §5) |
| idem | custo IRPF | se `motivo = emitente_corrigiu_a_nota` → `anexoPath` é exigido **pela função**, não pela tela, e entra como anexo **adicional** (`arquivo_path` não se substitui) |
| `corrigirClassificacaoDoDocumento` | discriminação (material × mão de obra) + INSS | se só a classificação muda → `p_anos: []`. Nenhum total se move, logo **nenhuma pendência nasce** (mesmo parecer, §1). Passar `anos` aqui inventa retificadora |
| `corrigirNomeDoFavorecido` | Pagamentos Efetuados | se o nome muda → CPF/CNPJ **não é parâmetro** e não se reescreve; sem pendência (mesmo parecer, §1, §4.2, adendo §4) |
| `garantirFavorecido` | Pagamentos Efetuados | se o favorecido já existe → `ignoreDuplicates: true` e o nome digitado agora é **descartado**. Virar `on conflict do update` renomeia retroativamente registro já declarado (`docs/pareceres/2026-08-17-vinculo-pagamento-documento.md` §3–§4) |
| `carregarPendencias` / `carregarAnosDasPendencias` / `carregarPainelDePendencias` | pendência de retificadora | se não há linha em `pendencia_desfecho` → a pendência está **aberta** (ausência = aberta, não flag). `paraAnoAfetado` mantém `?? 0`, e a ordem `aberta_em desc` com `slice()` antes de `sort` fica — mutar array do PostgREST reordena o acumulado do ano |
| `baixarPendencia` | pendência | se baixa → **INSERT** por RPC, nunca UPDATE. Quem valida desfecho×tipo é o banco |
| `marcarEmitenteErrado` | pendência | idempotente: marcar duas vezes = uma linha, **sem** linha de `revisao` |
| `criarDocumento` / `criarPagamento` / `criarInforme` / `registrarDiferenca` / `criarFinanciamento` | custo IRPF | se centavos entram → `centavosParaNumeric` (÷100) na gravação, **exatamente uma vez** |
| `criarDesembolsoTerreno` | custo IRPF (terreno) | se há N anexos → **um ato só**, RPC `terreno_desembolso_gravar`. Quebrar em dois INSERTs reabre o retry que **duplica o pai** — custo inflado, o pior erro do projeto |
| `completarDesembolsoTerreno` | custo IRPF (terreno) | se chegam anexo **e** resposta → anexos **primeiro**, resposta depois (o `now()` é do trigger, `docs/pareceres/2026-08-21-gate-fiscal-contai-027-criterio-13.md` §6). Inverter faz a re-pergunta disparar para sempre. E o **valor nunca é tocado** aqui |
| `moverDocumentoDeObra` / `moverPagamentoDeObra` / `criarVinculos` / `apagarVinculo` | custo IRPF (qual matrícula) | se pagamento e documento são de obras diferentes → `VinculoEntreObrasError` **no código**: a policy só exige mesmo dono e deixaria passar |
| `subirParaAcervo` / `criarLinkDeLeitura` / `carregarAnexosDoDocumento` / `carregarCorrecoesDoDocumento` | acervo — decadência (`docs/pareceres/2026-08-16-gate-fiscal-contai-011.md`) | se um papel é aberto → link **assinado, 120 s**; `getPublicUrl` não entra em módulo nenhum. E as duas consultas separadas de `carregarCorrecoesDoDocumento` não viram `.or()` montado à mão: rastro que some em silêncio é o oposto da meta 3 |

### O que trava para humano hoje e não pode passar a decidir sozinho

- **Quitação integral × parcial** (`quitarCompromisso`): nenhum dos dois é
  inferido do valor. Vem de toque explícito, e o saldo parcial exige nova data
  (`null` = "sem data definida" é resposta, não default)
- **`resolucaoDiferenca`** nasce `NULL` ("não sei ainda") e o **valor da
  diferença nunca muda** — por isso `registrarDiferenca` e `resolverDiferenca`
  são funções separadas; fundi-las devolve ao UPDATE o poder de reescrever valor
- **`debitosMesmoDia`** é `boolean | null`, e `null` significa "a pergunta não
  foi feita". Módulo novo que dê default a esse campo responde por ele
- **`estado: 'previsto'`** nunca leva `dataPagamento` — previsto não é pago, e o
  app não inventa data (nem a de hoje)
- **Classificação material × mão de obra e marcenaria fixa**: o app propõe, não
  decide. Nada disso vira derivação automática dentro do módulo novo

## Pre-mortem

1. **A prova de equivalência era mais fraca do que parecia.** Com 62 linhas de
   unit test para a camada, quem carrega o veredito são 10 specs de Playwright e
   o `tsc`. Caminhos que o E2E não exercita — `classificarErro`, ramos de
   `mensagemDeErro`, `AcervoNegadoError`, correções pouco visitadas — podem ter
   sido movidos com um import trocado e ninguém viu. Estoura em produção,
   semanas depois, e a autópsia culpa o ticket errado.
   *Mitigação: o critério 4 existe porque "compila e a suíte passa" não basta.*
2. **O ticket cresceu no meio.** Alguém abriu o arquivo, viu duplicação real e
   "aproveitou". O diff virou movimentação + melhoria, ninguém mais separa as
   duas, e o Gate 2 aprova no voto de confiança.
   *Mitigação: critérios 4 e 8 são de rejeição — o Gate 2 reprova o diff
   inteiro, não pede ajuste.*
3. **Conflito de árvore.** Este ticket toca o arquivo que todo outro toca. Já
   houve commit sobrescrito neste repo; o merge escolheria um lado e uma regra
   do `CONTAI-021` voltaria em silêncio. É o modo de falha mais provável e o
   mais caro, porque não deixa rastro.
   *Mitigação: fila parada, agente sozinho, ticket fechado no mesmo dia.*

## Viabilidade (CTO)

⚠️ **Correção de fato**: `lib/fiscal/{compromisso,revisao,vinculo}.ts`,
`lib/acervo.ts` e `lib/types.ts` **não importam** de `lib/data.ts` — a seta é
inversa. `e2e/banco.ts` e `e2e/privilegios.spec.ts` só citam o caminho em
comentário. **Não há ciclo a desfazer, só volume a fatiar.**

### O corte — por ENTIDADE

Critério: **um ticket toca uma entidade** — o histórico prova (`CONTAI-019` =
compromisso, `CONTAI-010` = terreno, `CONTAI-021` = correção), e o arquivo já
está seccionado assim por comentários de ticket. O corte por entidade só
materializa fronteiras que existem.

O que se perde no corte alternativo, por **capacidade**: `leitura.ts` viraria
~900 linhas (metade do problema de volta) e um ticket de compromisso abriria 4
arquivos em vez de 1.

Novo diretório `lib/dados/` (nome evita colisão com `lib/acervo.ts`):

| Módulo | Conteúdo |
|---|---|
| `comum.ts` | tipos `ComFavorecido*`, mappers compartilhados — **regra: só entra o que ≥2 módulos usam** |
| `obra.ts` | `ObraNaoEncontradaError`, `carregarObras/Obra`, `criarObra`, `atualizarObra`, `EntradaObraBanco` |
| `painel.ts` | `PainelDados`, `carregarPainel`, `carregarPaineis` |
| `documento.ts` | `carregarDocumento`, `criarDocumento`, `moverDocumentoDeObra` |
| `pagamento.ts` | `carregarPagamento`, `criarPagamento`, `moverPagamentoDeObra` |
| `favorecido.ts` | `garantirFavorecido`, `carregarFavorecido`, `carregarAlcanceDoFavorecido` |
| `correcao.ts` | as 4 ações do `CONTAI-021` + `carregarCorrecoesDoDocumento` |
| `pendencia.ts` | `carregarPendencias`, `baixarPendencia`, `carregarAnosDasPendencias`, `carregarPainelDePendencias`, `carregarRevisoesPorId` |
| `anexo.ts` | `subirParaAcervo`, `AcervoNegadoError`, `criarLinkDeLeitura`, `carregarAnexosDoDocumento` |
| `vinculo.ts` | `VinculoEntreObrasError`, `VinculoNovo`, `criarVinculos`, `apagarVinculo` |
| `compromisso.ts` | todo o bloco `CONTAI-019` (11 funções) |
| `terreno.ts` | todo o bloco `CONTAI-010` (financiamento, desembolsos, informes) |
| `erros.ts` | `mensagemDeErro`, `ErroDeTela`, `classificarErro` — importa as classes de erro dos módulos; acíclico |

### Compatibilidade — barrel, e a restrição decide sozinha

`lib/data.ts` vira barrel (`export * from "./dados/..."`, ~15 linhas).
`lib/data.test.ts` importa de `@/lib/data` e **não pode ser alterado** (critério
1) — reescrever os importadores exigiria mexer no teste.

**Downside assumido**: o acoplamento continua invisível no import site, e com
`"use client"` em tudo cada página puxa o grafo inteiro no bundle — mitigado
pelo tree-shaking de ESM do build de produção, **a conferir no `next build` da
fatia final**.

**Regra pós-ticket, para conter a dívida**: código novo importa do módulo
específico; página migra de import quando um ticket já a tocar por outro motivo.

### Ordem em fatias (suíte verde após cada uma)

Do mais isolado ao mais entrelaçado. Cada fatia = mover bloco + re-export no
barrel + `npm run quality`, e cada uma é **commit próprio, revertível sozinho**:

1. Esqueleto: `comum.ts` + `erros.ts` — prova o mecanismo com o menor bloco
2. `terreno.ts` (bloco mais recente e mais autocontido)
3. `compromisso.ts`
4. `vinculo.ts` + `anexo.ts`
5. `correcao.ts` + `pendencia.ts`
6. `painel.ts`
7. `obra.ts` + `documento.ts` + `pagamento.ts` + `favorecido.ts` — `data.ts`
   fica só re-exports

Mapper privado compartilhado sobe para `comum.ts` **na fatia em que o segundo
consumidor aparecer**, não antes.

⚠️ O `po` discorda de fatiar e prefere big-bang, com o argumento de que durante
as fatias existem duas casas para a mesma coisa e o agente lê as duas. **Fica a
ordem em fatias do `cto-obra`**, porque cada fatia é revertível sozinha e o
critério 5 (golden snapshot) roda por fatia — mas a objeção é legítima e o
ticket **tem que fechar no mesmo dia**, sem fatia dormindo na árvore.

### Modelo de dados

**Nenhum impacto.** Sem tabela, coluna, view ou função nova → **sem `GRANT`, sem
migration, sem atualização de `e2e/privilegios.spec.ts`** neste ticket.

### Complexidade e dívidas

**M.** Mecânico, mas são ~2000 linhas movidas em 7 fatias com `quality` (E2E
incluso) em cada. Dívidas criadas:

- **(a)** barrel como indireção permanente até a migração oportunista dos
  imports — dois estilos de import convivendo por meses
- **(b)** `comum.ts` como candidato a novo depósito — a regra "≥2 consumidores"
  precisa ser cobrada no Gate 2
- **(c)** `lib/data.test.ts` continua monolítico (intocável por restrição);
  quebrá-lo é ticket futuro

### Discordância registrada

A hipótese *"o problema real é `carregarPainel` agregar dentro da camada de
dados"* é **falsa** — verificada: `carregarPainel` só busca e mapeia, e a
agregação fiscal está em `lib/fiscal/resumo.ts`, onde deve estar. **Não inventem
um refactor de responsabilidade aqui.** O custo real é só o de leitura por gate,
e o corte por entidade + barrel o resolve inteiro.

## Dependências

- Bloqueado por: **nenhum ticket** — mas **bloqueado pela fila**: roda sozinho,
  com a fila parada
- Bloqueia: nenhum

## Linha de base a capturar ANTES da fatia 1

Medida em 2026-08-22, para o Gate 2 conferir contra:

| Métrica | Valor |
|---|---|
| `lib/data.ts` | 2065 linhas, 63 exports |
| `lib/data.test.ts` | 62 linhas |
| Importadores reais | **36** (35 em `app/` + `lib/data.test.ts`) |
| `numericParaCentavos`/`centavosParaNumeric` em `data.ts` | 38 ocorrências |
| RPCs chamados | `baixar_pendencia`, `corrigir_documento`, `corrigir_nome_favorecido`, `marcar_emitente_errado`, `mover_documento_de_obra`, `terreno_desembolso_gravar` |
| `npm run typecheck` | limpo |
| `npm run test` (Vitest) | 412 testes, 14 arquivos, verde |
| `npm run test:e2e` | **a capturar** antes de começar — exige `npm run db:start` |

## Perguntas Abertas

- Nenhuma técnica. A única pergunta é de **prioridade**, e é do Mateus — ver
  abaixo

## Quando este ticket NÃO deve rodar

Do `po`, e fica no ticket porque é o modo de falha mais desconfortável:

> Três meses depois isso não falhou nem funcionou — foi feito, ninguém notou
> diferença no custo dos gates, e ficou o registro de que o time gastou uma
> rodada consigo mesmo enquanto a **Q14 seguia aberta** e o **CNO seguia por
> registrar**.

**Se a fila vigente ainda tiver item com consequência fiscal em aberto, este
ticket entra depois dele.** Fila vigente: 6ª revisão, em
`docs/backlog/08-2026-08-17-incidente-producao-e-fila-vigente.md`.

## Cenário e checagem final

**Nenhum dos dois** — não é tela de gestão nem de captura, é dívida interna. O
**Teste do Canteiro não se aplica** (ele mede captura, e este ticket não tem
interface). Veredito: **APROVADO como P2**, condicionado à prioridade acima.
