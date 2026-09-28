# CONTAI-072 — Notas com compromisso aberto aparecem como "sem pagamento vinculado"

## Tipo e Prioridade
bug (apresentação, não cálculo) — **P1** (fricção de processo: nenhum valor fiscal muda, mas o Mateus lê errado o estado de uma pendência e pode agir em cima da leitura errada — ex.: tentar "ligar um pagamento" a uma nota que já tem compra de cartão agendada esperando fatura)

## Dor de Origem
Achado desta sessão, confirmado por consulta direta do Mateus ao banco de produção (read-only): o card **"Notas hábeis sem pagamento vinculado"** na Home mostra 3 notas com CTA "Ligar a um pagamento", como se nada estivesse em andamento. As mesmas 3 notas JÁ TÊM um `compromisso` aberto (compra no cartão agendada) vinculado via `documento_origem_id`, e aparecem ao mesmo tempo em "Agenda — próximos compromissos", com o mesmo favorecido e valor.

Palavras do Mateus: *"isso aqui não faz sentido para mim. Se já tem um pagamento agendado ao item, não faz sentido ele aparecer na lista de itens: 'Notas hábeis sem pagamento vinculado'."*

Causa raiz: `documentosHabeisSemPagamento` (`lib/fiscal/vinculo.ts:981-987`) filtra só `d.habil && d.pagamentos.length === 0`, sem olhar se existe `compromisso` aberto referenciando o documento. Essa função alimenta tanto `resumo.notasSemPagamento` na Home (`lib/fiscal/resumo.ts:951`) quanto o chip `CHIP_SEM_PAGAMENTO`/`linha.semPagamentoLigado` em `/despesas` (`lib/fiscal/despesas.ts:625`) — mesma fonte, mesmo problema nas duas telas.

## User Story
Como Mateus, gerenciando a obra em casa e revisando o card "Notas hábeis sem pagamento vinculado" (Home) ou a tabela `/despesas`, quando um documento hábil sem pagamento registrado já tem um compromisso aberto vinculado (`compromisso.documentoOrigemId`), quero que a interface distinga esse caso de um documento hábil sem nenhum rastro de pagamento, para não tratar como igualmente urgentes um item "com plano" e um item "esquecido".

## Critérios de Aceite

1. [x] Sem UI nova: a spec deste ticket (tabela + ASCII abaixo) é a proposta de design aprovada — **não precisa** de `design/mocks/CONTAI-072.md` separado (Gate de Mock nível 3, justificado pelo `designer`: troca de texto/cor/destino de link em slots que já existem nas duas telas, zero componente ou layout novo).
2. [x] **Dado** um documento hábil sem pagamento e **sem** nenhum `compromisso` com `situacao === "aberto"` vinculado (via `documentoOrigemId`), **quando** o card da Home e a linha de `/despesas` forem renderizados, **então** a aparência é a atual, sem mudança: chip "Sem pagamento ligado" (Home: `Chip cor="amb"`; despesas: pill `cor="neutra"`), CTA "Ligar a um pagamento" (Home, `variante="primary"`) linkando para `${href}/ligar`, texto de consequência = `EXPLICACAO_NOTAS_SEM_PAGAMENTO`.
3. [x] **Dado** um documento hábil sem pagamento com um `compromisso` `situacao === "aberto"` vinculado cuja `dataPrevista` é `null` ou `>= hoje` ("dentro do prazo"), **quando** as duas telas forem renderizadas, **então**:
   - Home: o chip vira o texto de `chipDoAgendado(compromisso, hojeIso).texto` = `"Agendado"` (`Chip cor="amb"` **vazado**); o detalhe passa a exibir `resumoDoAgendamento(compromisso)` (`"{favorecido} — previsto R$X para DD/MM/AAAA"`, ou `"sem data definida"` quando não há data); nenhum bloco de consequência extra aparece; o CTA vira `"Ver agendamento"` (`variante="ghost"`) linkando para `/compromisso/{compromissoId}` em vez de `${href}/ligar`.
   - `/despesas`: o pill continua `cor="neutra"` (não é urgente); o chip mostra o mesmo texto `"Agendado"`; a célula ganha `resumoDoAgendamento(compromisso)` como nota de apoio; `consequencia` continua `EXPLICACAO_NOTAS_SEM_PAGAMENTO`; o link da linha aponta para `/compromisso/{compromissoId}`.
4. [x] **Dado** um documento hábil sem pagamento com um `compromisso` `situacao === "aberto"` vinculado cuja `dataPrevista < hoje` ("vencido sem resposta"), **quando** as duas telas forem renderizadas, **então**:
   - Home: o chip mostra `chipDoAgendado(compromisso, hojeIso).texto` = `"Venceu em DD/MM/AAAA · N dia(s) sem resposta"` (`Chip cor="amb"` **preenchido**, `vazado={false}`); detalhe = `resumoDoAgendamento(compromisso)`; aparece um bloco de consequência com o texto literal de `VENCIDO_SEM_RESPOSTA` (ver critério 9 sobre onde essa constante passa a morar); CTA = `"Responder agendamento"` (`variante="primary"`) linkando para `/compromisso/{compromissoId}`.
   - `/despesas`: o pill sobe para `cor="amb"` (deixa de ser neutro — este estado já bloqueia a geração do relatório anual, ver Gate Fiscal); chip com o mesmo texto escalado; `consequencia` = `VENCIDO_SEM_RESPOSTA`; `nota` = `resumoDoAgendamento(compromisso)`; link para `/compromisso/{compromissoId}`.
   - Nenhum dos dois estados usa cor vermelha: a régua já usada em `app/_components/agendado.tsx` para "vencido" escala por **peso** (vazado→preenchido, borda fina→dupla), nunca por matiz — vermelho no app significa "dinheiro já saiu e não está no custo", o que não é o caso aqui (nada saiu da conta).
5. [x] **Dado** um documento com compromisso vinculado cuja `situacao` é `"quitado"` ou `"cancelado"`, **quando** as duas telas forem renderizadas, **então** o documento aparece exatamente como no critério 2 (nenhum dos dois sub-estados novos se ativa) — a marca reflete o estado atual do compromisso, não o histórico de FK no banco.
6. [x] **Dado** mais de um `compromisso` com `situacao === "aberto"` vinculado ao mesmo documento, **quando** as telas forem renderizadas, **então** o app escolhe um único compromisso para exibir, pela regra: qualquer vencido tem prioridade sobre qualquer não vencido; entre vencidos, o de mais dias sem resposta; entre não vencidos, o de `dataPrevista` mais próxima (`null` por último). Não há indicador de "+N outros agendamentos" nesta rodada (fora de escopo, item 4 abaixo).
7. [x] O CTA do sub-estado vencido ("Responder agendamento") **não duplica**, dentro do card/linha de "Notas hábeis sem pagamento", os três botões de resposta que já existem em `/compromisso/{id}` ("Foi pago" / "Não vai ser pago" / "Mudou a data" — `TresRespostas`, `app/_components/agendado.tsx`). Ele só leva para lá — uma única casa para agir sobre o mesmo compromisso vencido, que já aparece com as três respostas no bloco "Agenda — próximos compromissos" da mesma tela.
8. [x] **Dado** que a mesma correção é aplicada, **quando** a soma `resumo.notasSemPagamentoCentavos` do card na Home for conferida (e a contagem de linhas com `CHIP_SEM_PAGAMENTO`/situação equivalente em `/despesas`), **então** ela permanece calculada exatamente como hoje — nenhum documento sai da lista, nenhum valor sai da soma, independentemente de existir compromisso aberto vinculado (Gate Fiscal abaixo).
9. [x] `VENCIDO_SEM_RESPOSTA` (hoje em `app/_components/agendado.tsx:105-108`) passa a morar em `lib/fiscal/compromisso.ts` (ao lado de `resumoDoAgendamento`/`chipDoAgendado`), reexportada por `app/_components/agendado.tsx`, **sem qualquer mudança de redação** — porque `lib/fiscal/despesas.ts` é lib pura e não deve importar de um arquivo de componente (`app/_components/*`) para preencher `consequencia`.
10. [x] `lib/fiscal/vinculo.ts` e `lib/fiscal/resumo.ts` continuam **sem importar** `lib/fiscal/compromisso.ts` (barreira de tipo já existente e comentada em `resumo.ts:490-493` e `compromisso.ts:20-24`, com teste de tipo cobrindo). O cruzamento entre documento e compromisso para a Home acontece fora desses dois arquivos: `NotaSemPagamento` (`lib/fiscal/resumo.ts`) ganha um campo novo `documentoId: string` (string simples, sem import de `Compromisso`), e o lookup contra os compromissos da obra acontece no consumidor (`app/(gestao)/page.tsx`), que já tem `resumo` e `agenda`/`compromissos` no mesmo estado.
11. [x] `lib/fiscal/despesas.ts` **pode** importar `lib/fiscal/compromisso.ts` (sem barreira equivalente): `linhasDeDespesa`/`EntradaLinhasDeDespesa` ganha os parâmetros novos `compromissos: readonly Compromisso[]` e `hojeIso: string`.
12. [x] Nova função pura `agendamentosPorDocumento(compromissos: readonly Compromisso[], hojeIso: string)` em `lib/fiscal/compromisso.ts`, cobrindo por teste unitário: compromisso aberto dentro do prazo; compromisso aberto vencido; `dataPrevista === null` (não bloqueia, não é vencido); `situacao` quitado/cancelado ignorados; dois compromissos abertos apontando para o mesmo documento (regra de desempate do critério 6).
13. [x] Nenhuma migration é criada; nenhuma coluna nova em `compromisso`, `documento` ou `pagamento`; nenhum `unique` novo em `documento_origem_id` (múltiplos compromissos pela mesma nota — ex. boleto parcelado — é caso legítimo, não defeito).
14. [x] E2E: `e2e/vinculo.spec.ts` (ou equivalente da Home) e `e2e/despesas.spec.ts` cobrindo os três sub-estados (sem compromisso / aberto no prazo / vencido) nas duas telas, com fixture de `compromisso` + `documento_origem_id`.

## Out of Scope
- Tela nova de compromissos, ou qualquer mudança no bloco "Agenda — próximos compromissos" além de ser o destino do link (`/compromisso/{id}` já existe) — é gestão de cronograma de pagamento, fora das três metas do produto.
- Editar valor, data ou qualquer campo do `compromisso` a partir desta tela.
- Campo novo de banco ou migration (item 13).
- Indicador de "+N outros agendamentos" quando há mais de um compromisso aberto pelo mesmo documento — resolvido nesta rodada por prioridade simples (critério 6), sem contador visível; candidato a ticket futuro se a obra passar a ter isso com frequência.
- Qualquer outro card/filtro da Home ou de `/despesas` que use `documentosHabeisSemPagamento` ou outras funções de `lib/fiscal/vinculo.ts` para fins diferentes deste — este ticket não amplia escopo para revisar todos os consumidores da função sem relato específico.
- Retroatividade/correção de dados históricos: não há indício de dado errado no banco (a FK `documento_origem_id` está correta); é a leitura que ignora essa FK. Nenhuma migração de dado é necessária.
- Corrigir o vínculo cross-obra (um `compromisso` de outra obra apontando, por engano de dado, para um documento desta) ou compromissos quitados antes da migration `0020` sem vínculo propagado (D82/D83, já registradas no backlog) — comportamento de degradação já é seguro (o documento cai no estado "sem compromisso"), não é regressão introduzida por este ticket.

## Gate Fiscal (Contador)
**Regra, formato condição → consequência** (parecer já existente cobre o caso — nenhum parecer novo necessário):

> SE um documento hábil sem pagamento vinculado (`d.habil && d.pagamentos.length === 0`) tem um `compromisso` **aberto** (não cancelado) vinculado via `compromisso.documentoOrigemId`
> ENTÃO o documento **permanece integralmente** na lista e na soma de "notas hábeis sem pagamento vinculado" — nenhum valor sai, nenhuma nota é removida, porque compromisso não é pagamento e pode ser cancelado (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`, §1 e §2 item 6: "é composto por documentos, não por previsões"; item 8: proibição de qualquer soma mista).
> A ÚNICA coisa que pode mudar é texto/CTA, nunca o número, com dois sub-estados:
> - compromisso **dentro do prazo** (`dataPrevista` `null` ou `>= hoje`): texto/CTA de baixa urgência ("Já agendado"/"Ver agendamento" — §5 item 2: "a redundância de marcas é requisito, não enfeite"; datas sempre com ano, ADENDO §G.2).
> - compromisso **vencido sem resposta** (`dataPrevista < hoje`): texto deve ESCALAR, nunca suavizar — esse estado já bloqueia a geração de qualquer relatório anual (ADENDO §A, regra pré-existente e já implementada em `compromissosQueBloqueiam`/`faltamResponder`, `lib/fiscal/compromisso.ts:287-372` — este ticket não implementa o bloqueio, só reflete visualmente um estado que o app já trata como bloqueante em outro lugar).

Aferição INSS e as três saídas anuais: sem impacto — este card não é nenhuma das três saídas (discriminação, Pagamentos Efetuados, aferição), é indicador operacional; compromisso não abate nem acresce base de aferição em nenhum caso.

Pareceres de origem: `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` (§1 linhas ~21-47; §2 itens 1/6/8, linhas ~54-67; §5 item 2, linhas ~179-181; ADENDO §A, linhas ~236-282; ADENDO §G.2, linhas ~776-790).

## Pre-mortem
1. **A correção tirou o item da lista em vez de só marcá-lo, e o compromisso caiu** (cartão não passou, prestador não cobrou) — mitigado pelo Gate Fiscal: a nota nunca sai da lista/soma, só o texto muda.
2. **A distinção visual foi implementada só na Home, e `/despesas` ficou com o texto antigo** (ou vice-versa) — mitigado pelo critério 14 (E2E nas duas telas) e pelos critérios 10/11 (mesma função-fonte `agendamentosPorDocumento`, dois consumidores, não duas lógicas).
3. **A nova lógica não filtra por `situacao`, e um compromisso cancelado/quitado continua marcando a nota como "agendada"** — coberto explicitamente pelo critério 5 e pelo teste unitário do critério 12.

## Viabilidade (CTO)
- **Modelo de dados**: zero migration. Tudo já existe e já está em memória nas duas telas: `compromisso.documentoOrigemId`/`situacao`/`dataPrevista`, o predicado `ehVencidoSemResposta` (`lib/fiscal/compromisso.ts:120`), e a lista de compromissos que `useGestao` já expõe ao lado de `resumo`/`agenda` (`app/_components/gestao.tsx:313`) — `/despesas` também consome `useGestao`. Não criar `unique` em `documento_origem_id` (N compromissos por nota é caso legítimo).
- **Onde entra a lógica**: função pura nova `agendamentosPorDocumento` em `lib/fiscal/compromisso.ts` (não dentro de `vinculo.ts`/`resumo.ts` — barreira de tipo proibindo compromisso no grafo de `alocarCusto`, parecer §2 item 7, e comentário explícito em `resumo.ts:490-493`/`compromisso.ts:20-24`). Reaproveita `ehVencidoSemResposta`, `dataBR`, `chipDoAgendado` (texto do sub-estado vencido já existe) e `resumoDoAgendamento`.
- **Arquivos prováveis**:
  - `lib/fiscal/compromisso.ts` — `agendamentosPorDocumento` (nova) + mover `VENCIDO_SEM_RESPOSTA` para cá.
  - `lib/fiscal/resumo.ts` — `NotaSemPagamento` ganha campo `documentoId: string`.
  - `lib/fiscal/despesas.ts` — `EntradaLinhasDeDespesa` ganha `compromissos`/`hojeIso`; bloco 6 (`:625-642`) ganha os dois chips novos.
  - `app/(gestao)/page.tsx:203-217` — lookup no resultado de `agendamentosPorDocumento` por `documentoId`; troca de chip/CTA/link.
  - `app/(gestao)/despesas/page.tsx:88` — passa `compromissos`/`hoje` para `linhasDeDespesa`.
  - `app/_components/agendado.tsx` — reexporta `VENCIDO_SEM_RESPOSTA`.
  - Testes: `lib/fiscal/compromisso.test.ts`, `lib/fiscal/despesas.test.ts`, `e2e/vinculo.spec.ts`/`e2e/despesas.spec.ts`.
- **Complexidade**: S/M — S de lógica (função pura pequena), M pelo custo de E2E com fixture de compromisso tocando dois consumidores.
- **Dívidas conhecidas, registradas e não corrigidas aqui**: vínculo cross-obra em `documento_origem_id` (aceita qualquer uuid) degrada silenciosamente mas corretamente para "sem compromisso"; compromissos quitados antes da migration `0020` sem vínculo propagado ficam também como "sem compromisso" (não é regressão); `hojeIso()` é relógio do cliente, mesma premissa já usada em `gestao.tsx`.

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: nenhum. Constrói sobre o `CONTAI-065` (D79 — propagação de `documento_origem_id`, já entregue em 2026-09-26), que é pré-requisito de fato (dado) mas não de código.

## Perguntas Abertas
Nenhuma pendente de resposta do Mateus antes do Gate 1 — Gate Fiscal, viabilidade técnica e spec de apresentação já fechados nesta rodada.

## Cenário e checagem final
**Gestão** — Home e `/despesas` são telas de gestão (em casa, sentado); o Teste do Canteiro não se aplica. Serve à meta 2 (relatórios anuais prontos: reduz a chance de o Mateus deixar de agir sobre um compromisso vencido por não diferenciá-lo de "nada aconteceu") e, indiretamente, à meta 1 (evita ação redundante/confusa sobre pagamento). Veredito: **APROVADO** — sem migration, sem UI nova, Gate Fiscal fechado sem parecer novo, viabilidade S/M.

✅ **Entregue em 2026-09-28.** 14/14 critérios PASS — Gate 4 (`po`). Gate 2
técnico (`cto-obra`) aprovou sem bloqueantes; Gate Fiscal já estava fechado
pelo parecer de 18/08, sem necessidade de nova rodada do `contador`.

`agendamentosPorDocumento` (nova, `lib/fiscal/compromisso.ts`) cruza
documentos hábeis sem pagamento com compromissos abertos vinculados por
`documentoOrigemId`, com desempate vencido > mais dias sem resposta > data
mais próxima > id. A soma e a lista de "notas sem pagamento" não mudam em
nenhum caso — só o texto/chip/CTA da linha individual, nas duas telas (Home
e `/despesas`), a partir da mesma fonte. `lib/fiscal/vinculo.ts`/`resumo.ts`
continuam sem importar `Compromisso` (barreira de tipo preservada);
`NotaSemPagamento` ganhou só `documentoId: string`, e o cruzamento acontece
no consumidor (`app/(gestao)/page.tsx`). `despesas.ts` ganhou uma 3ª exceção
nomeada e estreita à mesma barreira, testada por mutação (o Gate 2 injetou
uma leitura fake de `valorPrevistoCentavos` e confirmou que o teste quebra).

**Correção de higiene pós-APPROVE** (sugerida pelo próprio Gate 2, aplicada
pelo orquestrador depois de o lead-engineer travar): `AgendamentoDoDocumento`
passou a expor só `compromissoId: string` em vez do `Compromisso` inteiro —
nenhum consumidor de produção lia mais que o `.id`, e devolver o objeto
completo vazava `valorPrevistoCentavos`/`saldoDoCompromisso` para fora da
barreira por TIPO, não só pelo teste. Confirmado: typecheck limpo, 1202/1202
Vitest, E2E de `vinculo.spec.ts`/`despesas.spec.ts` verde (36/37 numa rodada
completa; a 1 falha foi ruído de ambiente — Docker sob estresse ao fim de uma
sessão longa — reproduzida como flake e confirmada passando limpo (1.8s) em
duas re-execuções isoladas após reiniciar o stack local).
