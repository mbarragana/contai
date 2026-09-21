# Cinco decisões do desktop-shell-v1 — 2026-09-21 — `po` fecha as perguntas abertas e vira três tickets

## Contexto

O Mateus rejeitou o `CONTAI-039` ("ficou horrível... quero uma experiência
de desktop") e aprovou o mock de substituição,
`design/mocks/desktop-shell-v1.html`/`.md` — reação literal: *"100% better,
that is better, that is what I'm talking about"*. O spec escrito deixou 5
perguntas abertas para o `po`/`cto-obra` fecharem antes de virar ticket.
Decisão registrada aqui.

## As 5 decisões

**1. Escopo de obra na tabela de Despesas.** **Só a obra aberta.** Sem
coluna "Obra", sem visão consolidada. `lib/fiscal/resumo.ts` é explícito —
*"Nada é somado entre obras: a entrada é de UMA obra"* — e uma tabela
consolidada reabriria exatamente a discussão que a `EntradaResumo`
(obrigatoriamente de uma obra só) existe para fechar. Visão consolidada
vira P2 de backlog se o Mateus pedir explicitamente no futuro; hoje é
conveniência, não serve a nenhuma das três metas.

**2. Paginação da tabela de Despesas.** **Nenhuma nesta rodada** —
carregamento único com scroll, mesma filosofia do `Corpo` de hoje. ~20
meses de obra não é volume que justifique paginação a priori, e é fricção
de processo, não obrigação fiscal — errar para "mais simples agora" é
reversível; a condição de volta é a mesma usada para o corte do
`CONTAI-028` (fatias 2-7): um ticket futuro medir o volume real e achá-lo
proibitivo.

**3. `/pendencias` deve absorver as pendências derivadas?** **Sim.** Hoje
`ResumoObra.pendencias[]` e os seis agregados "fora de pendencias"
(`terrenoSemData`, `terrenoMaisDeUmaData`, `terrenoPagoSemComprovante`,
`documentosSemArquivo`, `vinculosCruzandoObras`,
`financiamentoFaltaLancar`/`AguardandoInforme`) só existem agregados na
home. Com o `CONTAI-040` reduzindo o painel da home a "as 4 mais urgentes",
uma pendência fora do top-4 fica **sem superfície própria nenhuma** — o
oposto direto da Meta 1. `/pendencias` vira a lista exaustiva; a home
continua sendo ponto de partida, nunca a lista completa. `notasSemPagamento`
fica de fora (não é pendência — terceiro estado neutro, parecer §5.2).
Ligação direta com a **D59** (banner "Nenhuma pendência" da home ignorando
os agregados "fora de pendencias") — este ticket não conserta a D59, mas
cria a função unificada que o conserto futuro deve reusar, em vez de nascer
uma segunda definição divergente do que conta como pendência (classe de
risco da D54).

**4. Arquitetura da separação mobile×desktop.** **Delegada ao `cto-obra`,
não decidida aqui** — é chamada técnica, fora do escopo do `po` por
definição (`CLAUDE.md`, "Limites"). O que o `po` fixa é o requisito de
produto: `/adicionar/*` (captura) e o app abaixo do breakpoint continuam
**literalmente** o que são hoje, e o shell desktop é composição separada,
nunca variação condicional que arrisca a mesma tela mobile de novo (é
exatamente o erro do `CONTAI-039`). Breakpoint exato e estratégia de
compartilhamento de componente ficam para o Gate 1 do `CONTAI-040`.

**5. Escopo exato de "Despesas".** **Todo `Documento` e todo `Pagamento` da
obra — comprovado ou pendente, sem exceção** — não só `DespesaComprovada`.
Ler os tipos de `lib/fiscal/resumo.ts` confirma que existem hoje quatro
formas de "dispêndio ligado a esta obra" (`DespesaComprovada`, `Pendencia`
sobre pagamento/documento, `NotaSemPagamento`) e nenhuma delas sozinha
responde "o que já foi gasto ou registrado nesta obra". Terreno
(`TerrenoDesembolso`) fica de fora — não é `Documento`/`Pagamento` e já tem
página própria. Justificativa pela Meta 1: uma tabela de despesas que só
mostra o comprovado recriaria exatamente o problema que a Meta 1 existe
para evitar — pendência sem documento hábil ficando fora da visão principal
por filtro padrão.

## Tickets criados

- **`CONTAI-040`** — Shell de navegação desktop + Dashboard ("Visão
  geral").
- **`CONTAI-041`** — Despesas, tabela de verdade (`/despesas`).
- **`CONTAI-042`** — Pendências, página única para derivadas e
  persistentes.

**Ordem inicial proposta pelo `po`, `040` → `041` → `042` — SUPERADA no
mesmo dia pelo adendo abaixo.** A ordem vigente é `042` → `040` → `041`. Os
três tickets mantêm os números de criação (convenção do projeto: o ID é
carimbo de criação, não posição na fila — a ordem de execução vive só na
tabela de `docs/tickets/README.md`).

## Adendo — 2026-09-21 — reconciliação com a avaliação técnica do `cto-obra`

O `cto-obra` rodou em paralelo uma avaliação técnica do mesmo mock e achou
dois pontos que mudam o sequenciamento e o critério 4 do `CONTAI-040`,
sem reabrir nenhuma das 5 decisões de produto acima.

**Achado 1 — são 18 famílias de pendência, não 7.** A contagem em
`app/page.tsx` inclui, além das 7 de `ResumoObra.pendencias[]` que o mock
desenhava, mais 11 hoje só agregadas na home: `PendenciaCno`,
`pendenciasDeCorrecao` (persistente), `emitenteErrado` (persistente),
`vinculosCruzandoObras`, `terrenoPagoSemComprovante`,
`documentosSemArquivo`, `terrenoSemData`, `terrenoMaisDeUmaData`,
`financiamentoFaltaLancar`, `financiamentoAguardandoInforme` e uma 18ª não
nomeada no achado (o `CONTAI-042` exige fechar essa lista por `grep` no
Gate 1, não por aproximação).

**Consequência de sequenciamento** — a ordem original (`040` antes de
`042`) fazia o dashboard nascer mostrando só as 7 famílias de
`pendencias[]`, escondendo 11 das 18 até o `042` fechar — a classe de erro
**D46/D47** (pendência perdendo superfície), argumento do `cto-obra`:
*"Inverter (shell antes da unificação) obriga o dashboard a nascer
escondendo 11 famílias ou a carregar a fila inteira — os dois são o que
foi rejeitado."* **Ordem corrigida: `CONTAI-042` primeiro** (unifica as 18
famílias ainda na UI atual de `/pendencias`, sem shell — Gate Fiscal do
`contador` obrigatório e bloqueante, não sanity check), **depois
`CONTAI-040`** (shell + dashboard já nasce consumindo a lista/contagem
definitiva, sem fonte provisória), **depois `CONTAI-041`** (tabela de
Despesas). O `042` deixa de depender do `040`; o `040` passa a depender do
`042`.

**Achado 2 — arquitetura mobile×desktop (pergunta 4), fechada pelo
`cto-obra`, não mais delegada em aberto**: route groups do Next 16—
`app/(gestao)/` para a experiência nova (home, futura `/despesas`,
`/pendencias`, `/obras`), `app/(captura)/` para o que é puramente captura
(`/adicionar/*`), intocado. Rejeitada explicitamente a separação por
breakpoint/media query dentro do mesmo componente — duplicaria árvore de
componentes, o mesmo erro do `CONTAI-039`. Dentro de `(gestao)`, a
responsividade (sidebar em tela larga ↔ faixa superior mínima em tela
estreita) é CSS de **um** componente de shell, nunca dois.

**Achado 3 — "pode quebrar" não pode virar "não há como registrar do
celular"**: o `cto-obra` recomendou, e o `CONTAI-040` incorporou como
critério (6), uma faixa mínima de navegação (os 4 links + "+ Novo
registro") abaixo do breakpoint desktop — o canteiro continua tendo porta
de entrada para `/adicionar` mesmo dentro de `(gestao)` em tela estreita.
"Pode quebrar" segue significando "não precisa ficar bonito nem otimizado
para uma mão", nunca "sem navegação".

**Achado 4 — `ResumoObra.despesas` é por componente (cluster NF↔PIX), não
por pagamento.** A tabela do `CONTAI-041` precisa de uma projeção pura
nova (`linhasDeDespesa`), não de reuso direto de `resumo.despesas` — os
dois formatos coexistem, cada um com seu consumidor (painel da home usa o
cluster; a tabela usa a linha). Confirmado também: implementação
client-side sobre o que `carregarPainel` já traz, sem paginação de
servidor nem segunda implementação do cálculo fiscal em SQL — bate com a
decisão de produto 2 (sem paginação nesta rodada).

## O que fica para o `cto-obra`/`lead-engineer` decidir no Gate 1

- Fechar por `grep` a lista das 18 famílias de pendência (`CONTAI-042`),
  incluindo a 18ª não nomeada no achado.
- Nome/módulo exato de `lib/fiscal/pendencias-unificadas.ts` e de
  `linhasDeDespesa` — o `po` especificou o contrato de saída, não a
  implementação.
- Detalhe de arquivos/nomes dos route groups (`(gestao)`/`(captura)`).

## O que este lote NÃO fez

- Não decidiu se o `CONTAI-039` (o layout `aside`+`Secao`, já entregue) é
  removido do código ou só deixa de ser usado na home — decisão de
  arquitetura do `cto-obra` dentro do `CONTAI-040`.
- Não tocou a D59 (banner da home mobile) — só nomeou a função
  (`pendencias-unificadas.ts`) que o conserto futuro deve reusar.
- Não abriu ticket de visão consolidada entre obras — cortado, não
  esquecido (decisão 1).
