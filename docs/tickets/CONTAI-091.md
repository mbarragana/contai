# CONTAI-091 Terceiro estado visual para pré-vínculo em Home e `/despesas`

## Tipo e Prioridade
feature (apresentação) — P1 — fricção de processo recorrente, não
conveniência: o estado atual já confundiu o Mateus mais de uma vez na mesma
sessão de suporte e gera investigação repetida (reabrir o detalhe do
documento para descobrir que a nota já tinha candidato de pagamento).

## Dor de Origem
`docs/backlog/106-2026-10-10-pre-vinculo-invisivel-em-despesas.md`. Caso real
Ilhamix (notas 1541/1543): compromissos de cartão criados com
`documentoOrigemId` apontando para a nota 1531 também têm
`documentoPrevistoIds` pré-ligando 1541 e 1543 (pré-vínculo do ADENDO 6,
`docs/backlog/96-2026-09-28-pre-vinculo-compromisso-nota-antes-do-pagamento.md`,
parecer completo `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`
§J). Em `/despesas`, 1541/1543 aparecem com "Sem pagamento ligado" + CTA
"Ligar a um pagamento" — como se não houvesse nenhum rastro. Mateus:

> "mas por que aqui ainda aparece para ligar pagamento e não ver agendamento
> como os outros?"

> "mas temos que identificar de alguma forma que já tem algum pagamento
> pré-vinculado aquela nota nesta lista e nas despesas também, porque fica
> parecendo que esta pendente de trabalho meu de inserir os pagamentos"

Causa técnica confirmada: `agendamentosPorDocumento`
(`lib/fiscal/compromisso.ts:728-751`) só elege via `documentoOrigemId` —
linha 735 descarta por completo quem só tem `documentoPrevistoIds`
(deliberado, comentário cita CONTAI-072 "1 aviso por nota", não é bug). O
detalhe do documento usa `compromissosQuePreLigam`
(`lib/fiscal/compromisso.ts:1511-1521`), que conta as duas fontes — por isso
`/documento/[id]` já mostra certo. A lacuna é só na lista (e, confirmado pelo
`cto-obra`, também na Home, que consome o mesmo par chip+CTA por nota).

## User Story
Como o Mateus, gerenciando a obra em casa, sentado, revisando a Home e
`/despesas` antes de decidir o que fazer, quando uma nota já tem pelo menos um
compromisso `situacao === "aberto"` que a pré-liga (via
`documentoPrevistoIds`) e nenhum compromisso com `documentoOrigemId`
confirmado apontando para ela, quero ver um estado visualmente distinto de
"Sem pagamento ligado" e de "Agendado", para não gastar tempo investigando ou
tentando ligar um pagamento do zero numa nota que já tem um candidato
esperando minha confirmação — e para que o CTA me leve direto a
confirmar/revisar esse candidato, não ao fluxo manual.

## Critérios de Aceite

1. [ ] Função pura nova `preVinculosPorDocumento(compromissos, hojeIso)` em
   `lib/fiscal/compromisso.ts` (ao lado de `agendamentosPorDocumento`),
   devolvendo `Map<documentoId, PreVinculoDoDocumento>` com
   `PreVinculoDoDocumento = { compromissoIds: string[]; n: number; href:
   string; chip: string; resumo: string }`. Elegibilidade: compromisso com
   `situacao === "aberto"` cujo `documentoPrevistoIds` referencia o
   documento. As chaves do Map são **disjuntas** das de
   `agendamentosPorDocumento(compromissos, hojeIso)` — documento já elegido
   por `agendamentosPorDocumento` nunca aparece neste Map (garante
   precedência "Agendado > Pré-vínculo" dentro da própria função, não nos
   consumidores). Teste unitário afirma a disjunção dos dois Maps com o
   fixture do caso Ilhamix (backlog 96).
2. [ ] `href` de `PreVinculoDoDocumento`: quando `n === 1`,
   `href = /compromisso/${compromissoIds[0]}` (é lá que já mora a bifurcação
   cartão × PIX/boleto — "Ver a fatura" vs. "Registrar o pagamento"); quando
   `n >= 2`, `href = /documento/${documentoId}` — nunca elege um dos N como
   "o" candidato.
3. [ ] `chip` de `PreVinculoDoDocumento` é a constante existente
   `CHIP_PRE_VINCULO` = "Pré-vínculo — ainda não é custo"
   (`lib/fiscal/compromisso.ts:1205`), verbatim — nenhum texto novo é cunhado
   para o rótulo do estado (mandato do Gate Fiscal, ADENDO 6 §J.2 de
   `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`: todo chip de
   pré-vínculo, em qualquer tela, é neutro e usa este texto). A liberdade de
   design fica restrita ao texto do CTA e ao layout — nunca ao rótulo do
   chip.
4. [ ] Nenhuma string literal `documentoPrevistoIds` (nem o nome de coluna
   `compromisso_documento_previsto`) aparece fora de `lib/fiscal/compromisso.ts`
   e `lib/fiscal/fatura.ts` — guarda já existente em `lib/fiscal/resumo.test.ts`
   (teste 8, ~linha 1471) continua vermelha com o nome do arquivo se violado;
   este ticket não pode tocar esse teste para "passar".
5. [ ] Home (`app/(gestao)/page.tsx`, painel "Notas hábeis sem pagamento
   vinculado", ~207-299): para cada nota, `agendado =
   agendamentosPorDocumento.get(id)`; `preVinculo = agendado ? undefined :
   preVinculosPorDocumento.get(id)`. Quando `preVinculo` existe: chip
   `cor="amb"` `peso="vazado"` (mesmo peso visual que `/documento/[id]` já
   usa para `CHIP_PRE_VINCULO`); linha "Dica" = `preVinculo.resumo` (formato
   curto, não a frase integral de `textoPreVinculoDaNota`); CTA
   `variante="ghost"` (nunca `primary` — não é cobrança) com rótulo "Revisar
   vínculo" quando `n === 1` ou "Ver vínculos (N)" quando `n >= 2`,
   `href = preVinculo.href`.
6. [ ] `/despesas` (`lib/fiscal/despesas.ts` bloco 6, ~701-741, e
   `app/(gestao)/despesas/page.tsx` célula "Situação", ~547-561): mesma
   composição de precedência do critério 5. Quando `preVinculo` existe:
   `chip = preVinculo.chip`, `nota = preVinculo.resumo`,
   `href = preVinculo.href`. **A cor da pílula permanece `"neutra"`** (cinza,
   o mesmo tratamento que a tabela já dá hoje ao terceiro estado) — não
   escala para `"amb"` aqui; `consequencia` permanece
   `EXPLICACAO_NOTAS_SEM_PAGAMENTO`, inalterada.
7. [ ] Uma nota genuinamente órfã (nenhum compromisso via
   `documentoOrigemId` nem via `documentoPrevistoIds`) continua mostrando
   exatamente "Sem pagamento ligado" na Home e em `/despesas`, byte a byte
   como hoje — nenhuma regressão no caso órfão.
8. [ ] Uma nota com compromisso `documentoOrigemId` confirmado continua
   mostrando "Agendado" exatamente como hoje na Home e em `/despesas`, mesmo
   que outro compromisso também a pré-ligue via `documentoPrevistoIds` —
   "Agendado" tem precedência sempre, nunca dois chips na mesma nota.
9. [ ] `/documento/[id]` (bloco de pré-vínculo, ~305-315,
   `compromissosQuePreLigam`/`textoPreVinculoDaNota`): o texto fixado pelo
   Gate Fiscal permanece verbatim (byte a byte) — a única mudança é que cada
   compromisso já listado no texto passa a ser também um `<Link>` (import
   `next/link`, ainda ausente neste arquivo) para `/compromisso/{id}`, usando
   `resumoDoAgendamento` (já exportado, `lib/fiscal/compromisso.ts:1163`)
   como rótulo do link. Nenhuma mudança de texto fiscal, nenhuma mudança de
   cálculo, nenhuma eleição de "qual dos N é o principal".
10. [ ] Nenhuma mudança em `alocarCusto`, `documentosHabeisSemPagamento`
    (`lib/fiscal/vinculo.ts:1059`) ou `resumo.notasSemPagamento`/
    `notasSemPagamentoCentavos` (`lib/fiscal/resumo.ts:970`/`:1235`) — valores
    idênticos antes/depois, confirmados por teste unitário com o fixture do
    caso Ilhamix (backlog 96). A nota com pré-vínculo continua contando em
    "Notas hábeis sem pagamento vinculado" independentemente do novo chip
    (doutrina ADENDO 6 §J.1 critério 3).
11. [ ] Spec nível 2 em `design/mocks/CONTAI-091.md` — já escrito, cobre as 3
    superfícies (Home, `/despesas`, `/documento/[id]`), estados de chip/CTA,
    navegação aditiva e a ausência de campo fiscal novo. Sem gate de
    aprovação formal (processo revisado em 2026-09-20) — serve de referência
    direta para o `lead-engineer`.
12. [ ] Vitest novo: `lib/fiscal/compromisso.test.ts` cobre
    `preVinculosPorDocumento` — N=1 (href de compromisso), N≥2 (href de
    documento), disjunção com `agendamentosPorDocumento` (precedência),
    chip sempre `CHIP_PRE_VINCULO`. `lib/fiscal/despesas.test.ts` cobre chip/
    nota/href propagados na linha da tabela com cor/consequência inalteradas
    quando há pré-vínculo.
13. [ ] E2E novo (`e2e/despesas.spec.ts` e/ou `e2e/pre-vinculo.spec.ts`,
    contra o Postgres local) cobre: nota só pré-ligada (N=1) na Home e em
    `/despesas` mostrando o chip `CHIP_PRE_VINCULO` e CTA correto; nota com
    N≥2 pré-vínculos mostrando "Ver vínculos (N)" e navegando a
    `/documento/{id}`; `/documento/[id]` com N≥2 mostrando os links por
    compromisso.

## Out of Scope
- Mudar a doutrina do ADENDO 6 (pré-vínculo continua sem teto, revisável,
  exigindo confirmação explícita do Mateus) — fora de escopo, meta 1 não pede
  isso.
- Reaproveitar o badge "Agendado" para pré-vínculo — rejeitado explicitamente
  (relato + `po`): misturaria "custo já em trilho" com "candidato revisável",
  repetindo o erro de confiança do caso Ilhamix original.
- Eleger um dos N compromissos como "o" candidato quando N≥2, ou criar uma
  tela de desambiguação nova — decidido usar `/documento/{id}` (já existente,
  já lista os N) como destino, com navegação aditiva (critério 9).
- Confirmação ou rateio automático do pré-vínculo a partir do clique na
  lista — o CTA só abre a tela de revisão/confirmação já existente; nenhum
  clique na lista grava `pagamento_documento`.
- Qualquer mudança em `alocarCusto`, na soma de custo de aquisição ou na base
  de aferição INSS — confirmado pelo critério 10 que os números não mudam.
- Urgência/vencimento do pré-vínculo no chip da lista (ex. destacar pré-vínculo
  vencido) — a marca de pré-vínculo nasce neutra na v1; se um caso real pedir
  diferenciação por urgência, é ticket futuro (dívida registrada em
  Viabilidade).
- Gestão de cronograma de obra, orçamento vs. realizado de engenharia,
  comunicação com empreiteiro — fora de escopo do produto, reafirmado por
  disciplina.

## Gate Fiscal (Contador)

**1. Toca regra fiscal de cálculo?** Não. Toca a superfície de exibição de um
número fiscal ("Notas hábeis sem pagamento vinculado"), por isso o gate é
necessário — mas a contagem em si está estruturalmente isolada da mudança.

**2. Confirmação por código real — a nota com pré-vínculo continua
contando.** `documentosHabeisSemPagamento` (`lib/fiscal/vinculo.ts:1059-1065`)
filtra só por `d.habil && d.pagamentos.length === 0`, a partir de
`alocarCusto`, que só consome `pagamento_documento` (vínculo formal já
confirmado). `documentoPrevistoIds` tem **zero ocorrências** em
`lib/fiscal/vinculo.ts`, `lib/fiscal/resumo.ts` e `lib/fiscal/despesas.ts` —
não existe caminho de código por onde um pré-vínculo reduza essa contagem. A
mesma função alimenta `resumo.notasSemPagamento`/`notasSemPagamentoCentavos`
(`lib/fiscal/resumo.ts:970`/`:1235`, card da Home) e a tabela de `/despesas`
(`lib/fiscal/despesas.ts:688-739`). O chip/CTA decorado por
`agendamentosPorDocumento` (e, com este ticket,
`preVinculosPorDocumento`) só decide **texto e destino de link**, nunca o que
entra no array que é somado — doutrina já registrada no próprio código
(`compromisso.ts:701-726`, CONTAI-072: "ela NÃO tira nada de lista nenhuma e
NÃO devolve valor nenhum a somar"). **Conclusão: implementado como decoração
dentro do laço existente (critérios 5-6), este ticket não tem onde regredir a
contagem.**

**3. Automático vs. revisão humana.** Nada muda. A confirmação do pré-vínculo
continua exigindo clique explícito do Mateus na tela de revisão/confirmação
já existente — este ticket só troca o CTA que *leva* a essa tela (de "ligar
pagamento do zero" para "revisar/confirmar pré-vínculo"), nunca confirma nada
a partir do clique na lista.

**4. Parecer citado, não rederivado.** ADENDO 6 tem parecer formal em
`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`, §J.0-J.5
(`docs/backlog/96-2026-09-28-pre-vinculo-compromisso-nota-antes-do-pagamento.md`
é o relato que registra a rodada do gate, citando o parecer — não é fonte
fiscal por si). Trechos verbatim relevantes:
- §J.1/critério 2: "Enquanto o compromisso não for confirmado como pago, o
  pré-vínculo não aparece em: soma de custo de aquisição, base de aferição
  INSS, discriminação anual, Pagamentos Efetuados, nem no grafo de
  `alocarCusto`."
- §J.1/critério 3: "A nota pré-ligada continua aparecendo em 'Notas hábeis
  sem pagamento vinculado' até que um pagamento de verdade seja confirmado e
  ligado a ela (mesma régua fixada para o caso 1:1 no CONTAI-072)."
- §J.2: "se o pré-vínculo aparece em qualquer tela (...), carrega chip
  neutro (...) 'Pré-vínculo — ainda não é custo'" — base do critério 3 deste
  ticket.
- §J.3: a conversão do pré-vínculo em vínculo formal exige revalidar + avisar
  + confirmar explícita, nunca automática/silenciosa, nunca recusa.

**5. Sem impacto fiscal direto.** Nenhuma mudança de classificação, regime de
caixa, retenção, documentação hábil ou nos números de `alocarCusto`/
`documentosHabeisSemPagamento` — é reagrupamento de leitura (chip/CTA) sobre
um conjunto de documentos já calculado corretamente hoje.

**6. Condições fiscais — formato "se X e Y → Z".**
- **Se** a implementação filtrar, excluir ou remover documentos de
  `documentosHabeisSemPagamento` ou de `resumo.notasSemPagamento`/
  `notasSemPagamentoCentavos` por terem pré-vínculo — **então** o
  `lead-engineer` deve **recusar** essa abordagem e implementar como
  decoração dentro do laço existente (`despesas.ts:701-739`), exatamente como
  o CONTAI-072 já faz para "Agendado": regrediria o ADENDO 6 §J.1/critério 3.
- **Se** a nova detecção de pré-vínculo for construída sobre
  `compromissosQuePreLigam` (que inclui `documentoOrigemId` e
  `documentoPrevistoIds` juntos) sem excluir os casos já cobertos por
  `agendamentosPorDocumento` — **então** deve **revalidar** o filtro para
  contemplar só "só previsto, sem origem confirmada" e **marcar**
  explicitamente a exclusão mútua com "Agendado" (critério 1 deste ticket já
  exige isso via disjunção de Maps) — senão duas linhas/chips podem disputar
  a mesma nota.
- **Se** o CTA do novo estado apontar para uma rota que grava a conversão do
  pré-vínculo sem passar pela tela de revalidação do §J.3 — **então** deve
  **recusar** esse caminho: o CTA só pode abrir a tela de revisão/confirmação
  já existente, nunca gravar `pagamento_documento` a partir de um clique na
  lista.
- **Se** a Home e `/despesas` implementarem a detecção duas vezes (duas
  funções, não a mesma `preVinculosPorDocumento`) — **então** devem **avisar**
  e convergir para fonte única (mesma razão do CONTAI-072: foi divergência
  entre telas sobre a mesma nota que originou aquele ticket).

## Pre-mortem
1. **CTA aterrissa no fluxo errado** (ligação manual do zero em vez de
   revisão do pré-vínculo) por atalho de implementação que só troca o texto
   do chip. Mitigado pelos critérios 2, 5 e 6, que travam o destino do `href`
   a partir da própria função pura, não da tela.
2. **N ≥ 2 compromissos pré-ligando a mesma nota — CTA ambíguo**, caso real
   (não hipotético, backlog 96). Mitigado pela regra explícita do critério 2
   (N=1 → compromisso; N≥2 → documento) e pela navegação aditiva do critério
   9, que dá ao detalhe um caminho de ação por compromisso em vez de só
   texto.
3. **Home e `/despesas` divergem de novo** — a mesma função já causou esse
   tipo de inconsistência (comentário do CONTAI-072 registra que aquele
   ticket nasceu de "uma tela dizendo uma coisa e a outra dizendo outra sobre
   a mesma nota"). Mitigado por `preVinculosPorDocumento` ser função pura
   única, consumida pelos dois (critérios 5 e 6), nunca duplicada.

## Viabilidade (CTO)
- **Modelo de dados**: nenhum. `Compromisso.documentoPrevistoIds`
  (`lib/types.ts:356`) já é hidratado pelo mapper único de
  `lib/dados/comum.ts:361-372`; Home e `/despesas` já recebem `compromissos`
  por esse caminho. Sem migration, sem tabela nova, sem `GRANT`.
- **Arquivos**: `lib/fiscal/compromisso.ts` (+ `compromisso.test.ts`),
  `lib/fiscal/despesas.ts` bloco 6 (+ `despesas.test.ts`),
  `app/(gestao)/page.tsx` (painel das notas), `app/(gestao)/despesas/page.tsx`
  (célula Situação), `app/(gestao)/documento/[id]/page.tsx` (navegação
  aditiva do bloco de pré-vínculo), `e2e/despesas.spec.ts` e/ou
  `e2e/pre-vinculo.spec.ts`.
- **Complexidade**: M (dois consumidores de leitura + navegação aditiva no
  detalhe + unit + E2E; não é S porque toca 3 telas e precisa da garantia de
  disjunção entre os dois Maps).
- **Dívidas criadas**: (1) precedência "Agendado > pré-vínculo" esconde que
  uma nota agendada também pode estar pré-ligada por outro compromisso —
  aceito pelo "1 aviso por nota"; (2) a marca de pré-vínculo não carrega
  urgência: um compromisso vencido que só pré-liga aparece neutro na nota e
  só "grita" na Agenda — decisão consciente de manter neutro na v1 (fora de
  escopo, ver Out of Scope); (3) N≥2 resolve por navegação ao detalhe
  (`/documento/{id}`), não por tela própria de desambiguação.

## Dependências
Bloqueado por / Bloqueia: nenhum.

## Perguntas Abertas
- Formato do campo `resumo` de `PreVinculoDoDocumento`: o `designer` pediu o
  formato curto (mesmo padrão de `resumoDoAgendamento`), não a frase integral
  de `textoPreVinculoDaNota`, para a linha "Dica" das listas (Home/
  `/despesas`) — ver `design/mocks/CONTAI-091.md`, seção final. Não bloqueia
  o Gate 1: se o conteúdo colidir com a implementação mais direta, o
  `lead-engineer` trata como critério de UI do `designer` e devolve a ele em
  vez de decidir sozinho.
- Dívida 2 da Viabilidade (urgência do pré-vínculo não aparece no chip) —
  registrar em `docs/backlog.md` se aparecer caso real que peça
  diferenciação visual de pré-vínculo vencido.

## Cenário e checagem final
**Gestão** — Home e `/despesas`, revisão antes de decidir, sentado, nunca
captura. O "Teste do Canteiro" não se aplica: nenhuma das telas tocadas é de
captura no canteiro.

Varredura de condição fiscal órfã (`grep -rniE` do `/tickets-req`): toda
condição fiscal citada acima está amarrada ao parecer
`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` §J.0-J.5 — nenhuma
condição nova sem parecer.

Veredito: **APROVADO**.

---

## Design (nível 2)
Spec completo em `design/mocks/CONTAI-091.md`. Três superfícies (Home,
`/despesas`, `/documento/[id]`), chip `CHIP_PRE_VINCULO` verbatim nas três,
navegação aditiva no detalhe, zero campo fiscal novo, zero texto fiscal novo
redigido.
