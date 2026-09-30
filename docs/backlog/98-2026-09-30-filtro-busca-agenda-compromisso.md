# Relato — filtro e busca na Agenda (`/compromisso`) — 2026-09-30

## Origem

Relato curto e direto do Mateus, sem incidente ao vivo por trás desta vez:

> *"deveríamos adicionar um filtro também nos /compromisso, e pesquisa por
> nome/favorecido"*

Contexto real que motiva (já conhecido do backlog, ver `CONTAI-081`,
`docs/backlog/96-2026-09-28-pre-vinculo-compromisso-nota-antes-do-pagamento.md`):
a obra já tem um fornecedor (concreto) com **7 parcelas agendadas ao mesmo
tempo**. `/compromisso` (a Agenda) lista hoje **todos** os agendamentos em
aberto sem nenhum filtro nem busca — `montarAgendaDaHome` é chamada com teto
`Infinity` (`app/(gestao)/compromisso/page.tsx:59`), renderizada por
`BlocoAgendados`. A lista só cresce com o tempo (obra de ~20 meses); achar um
agendamento específico em meio a vários do mesmo fornecedor já dói agora e vai
doer mais.

## Dor extraída (não a solução)

Dificuldade crescente de **encontrar um agendamento específico** numa lista
que só cresce e já tem casos reais de várias parcelas do mesmo favorecido
juntas. O "filtro" e a "busca" citados no relato são a solução que o Mateus
já imaginou — a dor de origem é "a lista está ficando difícil de navegar",
o mesmo tipo de fricção (não a mesma gravidade) que motivou o `CONTAI-078`
na tela de "ligar" pagamento↔nota.

## Investigação de código (confirmada nesta rodada)

- `/compromisso` (`app/(gestao)/compromisso/page.tsx`) chama
  `montarAgendaDaHome(estado.compromissos, hoje, Infinity)` — sem filtro, sem
  busca, sem paginação.
- **A tela só mostra `situacao === "aberto"`** — `montarAgendaDaHome`
  (`lib/fiscal/compromisso.ts:570`) filtra isso antes de tudo. `quitado` e
  `cancelado` **nunca aparecem** em `/compromisso` (saem da lista assim que
  respondidos, por design — parecer §5, defesa 3, comentário na própria
  função). O enum real de `Compromisso["situacao"]` (`SituacaoCompromisso`,
  `lib/types.ts:28`) tem só três valores: `aberto` | `quitado` | `cancelado`.
- Dentro de `aberto`, existem **subestados derivados por data**, calculados
  por `chipDoAgendado`/`ehVencidoSemResposta` (`lib/fiscal/compromisso.ts:480`
  em diante): **vencido sem resposta** (sem teto, sempre no topo — critério
  43/11), **vence hoje**, **vence amanhã**, e o resto genérico ("Agendado").
  Não existe hoje nenhum campo `situacao` com esses quatro valores — são
  calculados na hora, a partir de `dataPrevista` e `hojeIso`.
- Padrão visual pronto e em produção que resolve o mesmo problema em
  `/despesas` (`app/(gestao)/despesas/page.tsx`): dropdown "Todas as
  situações" (`data-filtros="despesas"`, linha 243), dropdown de tipo de
  documento, e campo `aria-label="Buscar favorecido"` / placeholder "Buscar
  favorecido…" (linhas 314-315).
- Precedente de busca-em-lista já entregue: `CONTAI-078` (busca por
  favorecido/valor na lista de candidatos de `/documento/[id]/ligar` e
  `/pagamento/[id]/ligar`), com `filtrarCandidatos` em
  `lib/gestao/busca-candidatos.ts` e `normalizar` (NFD sem diacrítico) em
  `lib/texto.ts` — reaproveitável para a Agenda sem reinventar normalização.

## Classificação de prioridade — P1 (fricção de processo)

O relato mesmo sugeriria P2 (conveniência, zero impacto fiscal — nenhum
relatório, apuração ou documento hábil depende de achar um item na Agenda
mais rápido). Subo para **P1** porque:

1. **A dor já é real hoje, não hipotética**: 7 parcelas do mesmo fornecedor
   agendadas ao mesmo tempo já existem na obra, com mais de um ano de obra
   pela frente — a lista só cresce.
2. `/compromisso` é tela do **cenário principal de gestão** (em casa,
   sentado, revisão periódica) — não é uma tela secundária; é onde o Mateus
   decide o que responder/aguardar.
3. O custo de resolver é baixo: existe padrão visual pronto e testado em
   produção (`/despesas`) e função de busca pronta e testada
   (`CONTAI-078`/`lib/gestao/busca-candidatos.ts`, `lib/texto.ts`) — reuso,
   não invenção.

**Diferença deliberada do `CONTAI-078`** (que também é P1): lá, a ausência de
busca já bloqueava uma tarefa fiscal ativa (ligar pagamento↔nota, necessário
para o custo de aquisição ficar correto). Aqui, não bloqueia nada fiscal —
é puramente "dá pra fazer (rolar a lista inteira), mas dói e vai doer mais".
A analogia é pista de gravidade semelhante de fricção, não motivo de gate
fiscal — por isso este relato não precisa passar pelo `contador`.

## User stories

### US-A [P1] — buscar por favorecido/nome na Agenda

Como Mateus, revisando a Agenda em casa, sentado, quando a lista de
agendamentos em aberto tem vários itens do mesmo favorecido (ex.: várias
parcelas do fornecedor de concreto) ou já está longa, eu preciso digitar um
nome/favorecido para filtrar a lista e achar o agendamento específico sem
rolar tudo.

**Critérios de aceite:**
1. `/compromisso` tem um campo de busca textual que filtra a lista de
   agendamentos exibida (vencidos + abertos) pelo favorecido/nome digitado.
2. A busca usa comparação normalizada (sem diacrítico, case-insensitive) —
   mesma função `normalizar` de `lib/texto.ts`, sem reimplementar.
3. Quando o termo não vazio zera a lista, aparece um estado de
   "vazio-por-filtro" distinto do "Nenhum agendamento em aberto" existente
   (`Banner cor="grn"` na página atual) — sem reaproveitar aquele texto, que
   afirma um fato diferente (não há agendamento nenhum vs. nenhum bate o
   filtro).
4. A busca não muda a regra de ordenação/agrupamento existente (vencidos
   sempre primeiro e sem teto, depois abertos por data prevista crescente) —
   filtra o conjunto, não reordena dentro dele.
5. Não altera `montarAgendaDaHome` nem o teto de 3 da home (`MAX_ABERTOS_NA_HOME`)
   — o filtro/busca é exclusivo da tela `/compromisso` (destino do "ver todos"),
   não da home.

### US-B [P1] — filtrar a Agenda por situação/urgência

Como Mateus, revisando a Agenda em casa, quando eu quero ver só os
agendamentos vencidos (ou só os que vencem em breve), eu preciso de um
filtro por situação para não precisar escanear a lista inteira visualmente
toda vez.

**Critérios de aceite (sujeitos à resposta da Pergunta 1 abaixo):**
1. `/compromisso` tem um controle de filtro por situação, no mesmo padrão
   visual do dropdown "Todas as situações" de `/despesas`.
2. As opções do filtro correspondem a estados **reais e verificáveis** do
   sistema — não a rótulos inventados na tela. (Quais estados exatamente é
   o que a Pergunta 1 decide: os subestados de urgência calculados por
   `chipDoAgendado` — vencido / vence hoje / vence amanhã / agendado comum
   — ou, se a resposta expandir o escopo da tela, também `quitado`/
   `cancelado`.)
3. O filtro convive com a busca por favorecido (US-A) — os dois se compõem
   sobre o mesmo conjunto, não um substitui o outro.
4. Vencidos continuam sem teto de exibição quando o filtro os inclui —
   nenhuma interação nova com o filtro pode reintroduzir o corte que o
   critério 43 da home proíbe aqui.

## Perguntas abertas

1. **[destrava o desenho do filtro]** `/compromisso` hoje só mostra
   `situacao === "aberto"` — `quitado` e `cancelado` nunca aparecem nessa
   tela (saem da lista assim que respondidos, por design). Quando você disse
   "filtro", quis dizer filtrar pelos **subestados de urgência que já
   existem dentro do aberto** (vencido sem resposta / vence hoje / vence
   amanhã / agendado), que é uma mudança pequena — ou você quer que
   `/compromisso` passe a **incluir quitados/cancelados também**, com um
   filtro para alternar entre eles (uma mudança bem maior, que muda o que a
   tela mostra, não só como se filtra)? Assumindo a primeira leitura (menor)
   até resposta, porque é a que resolve a dor citada (achar agendamento
   específico numa lista de abertos que cresce) sem expandir escopo.

Nenhuma outra pergunta bloqueante: o texto da busca já responde por si só
("pesquisa por nome/favorecido" — favorecido/nome, não valor nem número de
documento, ao contrário do índice mais amplo do `CONTAI-078`), e detalhe de
rótulo/posição do controle é trabalho do `designer` no `/design`, não do
`po`.

## Fora de escopo — dito explicitamente, com o porquê

- **Filtro por origem (PIX/boleto/cartão)**, que `/despesas` também tem —
  o relato não pediu; não incluído nos critérios de aceite acima. Se o
  Mateus quiser depois de usar a busca+filtro de situação, é extensão
  natural, não redesenho.
- **Paginação da lista** — fora do que o relato pede; a busca/filtro já
  reduz o problema de volume sem precisar paginar.
- Este relato **não é regra fiscal** (nenhuma das duas stories muda
  apuração, discriminação anual ou acervo), **não é acervo documental** e
  **não é relatório anual** — é usabilidade de gestão sobre uma lista que
  cresce. Registrado explicitamente porque é o filtro de escopo do PO, não
  porque havia algo a cortar do relato em si (o relato já veio pequeno e
  direto, sem pedido fora do produto).

## Próximo passo

Sem impacto fiscal — não precisa de Gate do `contador`. Depende da resposta
à Pergunta 1 para o `/tickets-req` fechar os critérios de aceite de US-B com
precisão (US-A já está pronta para virar ticket independente da resposta,
já que a busca por favorecido não depende dela). Padrão visual e função de
busca já existem em produção (`/despesas`, `CONTAI-078`) — reuso, não
desenho do zero; `/design` deve ser rápido (nível 1 ou 2).
