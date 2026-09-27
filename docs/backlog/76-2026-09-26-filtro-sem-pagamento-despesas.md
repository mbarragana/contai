# Falta filtro de situação para isolar notas "Sem pagamento ligado" em `/despesas` — 2026-09-26

## Contexto do relato

Mateus estava em `/despesas`, filtrou por texto "casa" (campo de busca), e viu
4 linhas, todas com a situação "Sem pagamento ligado". Apontou o dropdown
"Todas as situações" e disse que faltava uma opção ali para isolar essas notas
sem depender de digitar texto na busca.

## Dor extraída

*"aqui deveria ter um filtro: 'sem pagamento'"* — reação ao dropdown de
Situação em `/despesas`, depois de precisar de um atalho de texto ("casa")
para conseguir ver só as notas sem pagamento ligado.

## Investigação técnica (dada, não repetida)

- `FiltroSituacao = "todas" | "comprovadas" | "pendencia"`
  (`lib/fiscal/despesas.ts:657`, `SITUACOES` em
  `app/(gestao)/despesas/page.tsx:218-219`).
- `casaSituacao` (`lib/fiscal/despesas.ts:687-690`): `"comprovadas"` testa
  `linha.comprovada`, `"pendencia"` testa `linha.temPendencia`, `"todas"` não
  filtra. **Nenhuma das três opções isola a situação "Sem pagamento ligado"**
  (`CHIP_SEM_PAGAMENTO`, linha 119) — ela nasce **neutra** por desenho (bloco 6
  de `linhasDeDespesa`, comentário explícito: "Não mexe em `temPendencia`: nem
  comprovado nem em risco"). Não é bug de cálculo nem de classificação — é
  ausência de opção de filtro para um estado que já existe e já é exibido
  corretamente linha a linha.
- Forma de implementação (quarto valor de `FiltroSituacao` vasculhando
  `linha.situacoes` por chip, vs. campo booleano dedicado
  `linha.semPagamentoLigado`) é decisão de implementação, não do relato — não
  prescrita aqui.

## Classificação

**P1 — fricção de processo.** Confirmo a avaliação trazida: é filtro de
leitura/apresentação de uma tabela, não altera nenhum cálculo de custo de
aquisição, aferição INSS ou dado gravado — não há Gate Fiscal. Também não
enxergo o ângulo de "esconder pendência sem querer": a opção é **aditiva**
(as três opções atuais continuam existindo e funcionando exatamente como
hoje) e "Sem pagamento ligado" já é, por desenho anterior, uma situação
**neutra** — nem pendência nem comprovação — então filtrar para vê-la isolada
não mascara nada que hoje contasse como risco; ao contrário, é o Mateus
querendo *achar* essas notas mais rápido, provavelmente para decidir se
agenda ou registra o pagamento delas (o que serve à Meta 1 indiretamente:
"nenhum pagamento sem documento hábil" tem como contraparte de leitura "nota
válida sem pagamento ainda", que é exatamente o que ele quer localizar em
lote). Não acionei o `contador` — não há regra fiscal em jogo.

## User story

**Persona**: o Mateus em casa, sentado, gestão — revisando `/despesas` para
decidir quais notas já validadas ainda precisam de pagamento agendado ou
registrado.

**Gatilho**: ele quer ver, sem digitar nada na busca, só as linhas cuja
situação é "Sem pagamento ligado".

**Ação**: seleciona, no dropdown de Situação já existente em `/despesas`, uma
quarta opção que isola essas linhas (rótulo exato é decisão do `designer`).

**Resultado**: a tabela mostra exclusivamente as linhas com `CHIP_SEM_
PAGAMENTO`; nenhuma linha comprovada nem em pendência aparece; as três opções
atuais ("Todas as situações"/"Comprovadas"/"Pendência") continuam se
comportando exatamente como hoje.

**Critério de aceite verificável**:
1. Com a nova opção selecionada, toda linha visível tem o chip "Sem pagamento
   ligado" e nenhuma outra — reproduz o cenário exato do relato (filtrar
   "casa" + ver 4 linhas "sem pagamento"), mas usando só o filtro de Situação,
   sem precisar digitar texto de busca.
2. A nova opção compõe corretamente com Tipo e Busca já existentes, na mesma
   lógica de composição de `casaSituacao` hoje (E lógico entre os filtros
   ativos) — e, quando o `CONTAI-060` (seletor de ano) estiver em produção,
   com o filtro de ano também.
3. A contagem da barra ("N de M lançamentos...") reflete o total filtrado
   corretamente com a nova opção ativa, no mesmo padrão hoje usado por
   "Comprovadas"/"Pendência".
4. As opções "Todas as situações", "Comprovadas" e "Pendência" continuam
   produzindo exatamente o mesmo resultado de hoje (filtro aditivo, não
   substitutivo — regressão zero).

## Filtro de escopo — o que fica fora e por quê

- **Rótulo exato da opção** ("Sem pagamento", "Sem pagamento ligado", etc.) —
  decisão de UI, cabe ao `designer` no `/design`, não é requisito.
- **Mecanismo de implementação** (novo valor de `FiltroSituacao` vs. campo
  booleano dedicado) — decisão do `cto-obra`/`lead-engineer`, não do relato.
- **Qualquer mudança na classificação de `CHIP_SEM_PAGAMENTO` como neutra**
  — fora de escopo; a situação continua nem comprovada nem em risco, isso não
  muda, só passa a ser filtrável.
- **Ações em lote a partir da lista filtrada** (ex.: "agendar pagamento para
  todas") — não foi pedido no relato; seria feature nova, candidata a relato
  próprio se o Mateus sentir a falta depois de usar o filtro.
- **Espelhar a opção em `/pendencias`** — não se aplica: `/pendencias` é a
  fila das 18 famílias de pendência real, e "Sem pagamento ligado" por
  desenho não é pendência; não deveria aparecer lá.
- **Sequenciamento de código**: `lib/fiscal/despesas.ts` está em uso pelo
  `CONTAI-060` (seletor de ano) em andamento — este requisito não deve virar
  ticket/implementação em paralelo no mesmo arquivo. Fila sugerida: depois do
  `CONTAI-060` fechar Gate 4, ou explicitamente coordenado com ele no mesmo
  ticket, para evitar dois agentes editando `casaSituacao`/`SITUACOES` ao
  mesmo tempo.

## Perguntas abertas

Nenhuma bloqueante. O relato é inequívoco sobre a necessidade (dropdown de
Situação ganha uma opção que isola "Sem pagamento ligado") e as únicas
variáveis reais (rótulo, mecanismo) são decisões que cabem a outros papéis,
não ao Mateus.

## O que NÃO foi feito aqui

- Não foi aberto ticket em `docs/tickets/` — isso é passo do `/tickets-req`.
- Não foi escrito mock — Gate 0 do `/design`, corre depois do ticket existir.
- Nenhum código foi tocado (`lib/fiscal/despesas.ts` intocado, por instrução
  explícita: está em uso pelo `CONTAI-060`).
