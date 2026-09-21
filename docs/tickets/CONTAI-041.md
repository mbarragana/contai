# CONTAI-041 Despesas — tabela de verdade (rota `/despesas`)

## Tipo e Prioridade
feature — **P1, fricção de processo com efeito direto na Meta 1**. Não cria
obrigação fiscal nova (nenhuma regra de custo muda), mas é a primeira
superfície do produto que junta comprovado e pendente do lado do
pagamento/documento **na mesma tabela**, sem exigir rolar a home inteira —
serve diretamente a "nenhum pagamento sem documento hábil" ao tornar
impossível esconder uma linha pendente atrás de um filtro padrão.
**Terceiro e último ticket da sequência** (`CONTAI-042` → `CONTAI-040` →
`CONTAI-041`), bloqueado pelo shell do `CONTAI-040`.

## Dor de Origem
`design/mocks/desktop-shell-v1.md`, seção "Despesas — tabela de verdade":
resposta literal ao pedido do Mateus ("despesas em formato de tabela"),
substituindo a necessidade de rolar a home para ver "despesas comprovadas" +
"pendências" separadamente.

## User Story
Como dono da obra revisando o que já foi pago nesta obra, quero uma tabela
única — data, favorecido, documento, meio, valor, situação — que mostre toda
despesa da obra, comprovada ou pendente, com a consequência fiscal completa
visível quando há pendência, para decidir o que falta resolver sem abrir
tela por tela.

## Escopo e Critérios de Aceite

### Decisões de escopo já fechadas (as 5 perguntas do `desktop-shell-v1.md`)
Registradas em `docs/backlog/46-2026-09-21-cinco-decisoes-desktop-shell-
contai-040-042.md`:

1. **Escopo de obra**: só a obra aberta. Sem coluna "Obra", sem visão
   consolidada — mantém "nada se soma entre obras" sem reabrir a discussão.
2. **Paginação**: nenhuma nesta rodada. Carregamento único com scroll, mesma
   filosofia do `Corpo` de hoje. Revisitar **só se** um ticket futuro medir o
   volume real e achá-lo proibitivo (mesma condição de volta usada para o
   corte do `CONTAI-028`, fatias 2-7).
3. **Escopo de linhas** (pergunta 5 do mock): a tabela cobre **todo
   `Documento` e todo `Pagamento` da obra**, comprovado ou não — nunca só
   `DespesaComprovada`.

   ⚠️ **Achado técnico do `cto-obra` (avaliação de 2026-09-21), que muda a
   forma de construir isto**: `ResumoObra.despesas` (`DespesaComprovada[]`)
   é agregado **por COMPONENTE** — o cluster inteiro de NFs+PIX que
   `alocarCusto` juntou como "uma despesa, não duas" (critério 13 do
   CONTAI-008/vínculo) — **não por pagamento individual**. A tabela do mock
   é uma linha por pagamento/documento. Isso significa que esta tela **não
   reusa `resumo.despesas` diretamente**: precisa de uma projeção pura
   NOVA, sugestão de nome `linhasDeDespesa` (`lib/fiscal/despesas.ts` ou
   módulo que o `cto-obra` fixar no Gate 1), que decompõe cada componente
   de `alocacao` de volta em linhas por pagamento/documento, preservando o
   critério 4 abaixo (nenhum centavo duas vezes). `resumo.despesas` continua
   existindo e sendo usado pelo painel "Despesas recentes" do `CONTAI-040`
   (que quer o cluster, não a linha) — os dois formatos coexistem, cada um
   com seu consumidor, sem um substituir o outro.

   Cada `Pagamento`/`Documento` vira UMA linha (nunca uma linha por
   pendência, quando a pendência é sobre o mesmo par documento/pagamento):
   - `DespesaComprovada` → linha verde, compacta, só o chip "Comprovada".
   - `Pendencia` do tipo `pago_sem_nota`, `pago_sem_comprovante`,
     `diferenca_sem_explicacao`, `quarentena`, `boleto_sem_nf` → linha com o
     chip da pendência + a `Consequencia` completa, sem truncar.
   - `NotaSemPagamento` (documento hábil sem pagamento vinculado) → linha
     própria, chip neutro ("Aguardando pagamento" ou equivalente — **não**
     fiscal-negativo, é o terceiro estado do parecer §5.2, nem comprovado
     nem em risco).
   - `retencao_sem_recolhedor` e `nf_servico_sem_cno` **não geram linha
     própria**: são anotações **dentro** da linha do documento a que já
     pertencem (uma NF de serviço pode estar comprovada E carregar uma
     dessas duas pendências ao mesmo tempo — a linha mostra os dois).
   - **Terreno fica fora desta tabela** — `TerrenoDesembolso` não é
     `Documento`/`Pagamento` da obra e continua em `/obras/[id]/terreno`,
     que já é a superfície dele.
4. **Nenhum centavo pode ser contado duas vezes** entre linhas (ver
   Pre-mortem 1) — este é o critério de aceite mais importante da tabela,
   não uma nota de rodapé.

### Colunas e comportamento
5. Colunas: `Data pagamento` (sortável) · `Favorecido` (+ tipo PF/PJ) ·
   `Documento` (tipo + número, ou "sem NF vinculada") · `Meio` (PIX/Boleto/
   Cartão) · `Valor` (sortável) · `Situação` · `Ação`.
6. **Situação**: linha comprovada é compacta (só o chip). Linha com
   pendência mostra o chip **e**, na mesma célula, a `Consequencia` completa
   — texto integral, sem "...", sem exigir clique. A linha cresce em altura
   para caber. Nunca atrás de clique (doutrina do produto).
7. Todo texto de `Consequencia` usado é cópia literal das constantes já
   existentes (`lib/fiscal/documento.ts`, `lib/fiscal/pagamento.ts`,
   `lib/fiscal/retencao.ts`, `lib/fiscal/obra.ts`) — mesma tabela de origem
   do `desktop-shell-v1.md`. Nenhum texto novo é redigido para esta tela.
8. **Filtros**: Situação (Todas / Só comprovadas / Só com pendência); Tipo
   de documento (Todos / NF material / NF serviço / Boleto / Sem
   documento); busca por favorecido (texto livre).
9. **Ordenação**: por clique no cabeçalho — Data pagamento (padrão: mais
   recente primeiro) e Valor.
10. Link "Ver todas (N) →" do painel "Despesas recentes" do `CONTAI-040`
    aponta para esta rota, sem parâmetro de filtro pré-aplicado (mostra
    tudo, ordenado como o padrão desta tela).
11. **Implementação client-side** sobre o que `carregarPainel` já traz —
    decisão técnica do `cto-obra`, que bate com a decisão de produto do
    item 2 (sem paginação nesta rodada): sem paginação de servidor, sem uma
    segunda implementação do cálculo fiscal em SQL/view. `linhasDeDespesa`
    roda no cliente sobre o `PainelDados` já carregado, do mesmo jeito que
    `calcularResumo` já roda hoje.

## Fora de Escopo
- Terreno (`TerrenoDesembolso`) — fica em `/obras/[id]/terreno`.
- Visão consolidada entre obras.
- Paginação, exportação em CSV/planilha, edição inline — nenhuma ação além
  do que já existe hoje ao abrir o documento/pagamento (`Ação` = link para
  `/documento/[id]` ou `/pagamento/[id]`, já existentes).
- Qualquer mudança de regra de cálculo ou de cor de gravidade — a tabela
  consome o que `calcularResumo` já produz, não recalcula nada.

## Gate Fiscal (Contador)
Sem regra fiscal nova — todo valor e todo texto já existe e já foi
adjudicado. **Precisa de revisão estrutural do `contador` no Gate 2**, não
por texto novo, mas porque é a primeira tela que projeta `Documento` e
`Pagamento` linha a linha lado a lado: confirmar que a soma das linhas da
tabela nunca diverge da soma que os cards de hoje já mostram (custo
confirmado + custo em risco + notas sem pagamento) — nenhuma linha pode
sobrar de fora e nenhuma pode duplicar valor de outra.

## Pre-mortem
1. **Double-count entre `DespesaComprovada` e `Pendencia`.** Um pagamento
   pode estar parcialmente coberto (`alocacao.porPagamento`): parte
   comprovada, parte `pago_sem_nota`. Se a implementação gerar uma linha
   para cada fonte de dado sem checar que é o MESMO pagamento, o valor
   aparece duas vezes na tabela. Guarda: a projeção da linha precisa nascer
   de uma função pura testada (`lib/fiscal/`, não um `.map()` solto na
   tela) que garanta 1 pagamento/documento → 1 linha, com sub-anotações,
   nunca 1 → N linhas de valor.
2. **Filtro "Só comprovadas" escondendo pendência sem querer.** Doutrina do
   produto: pendência nunca fica atrás de interação. O filtro é opt-in do
   usuário e reversível na mesma tela (nunca é o estado padrão) — critério
   8 já registra "Todas" como não sendo o padrão implícito? **Correção**:
   o padrão ao abrir a tela é **"Todas"**, nunca "Só comprovadas" — anotar
   explicitamente no ticket para não nascer com o filtro errado escondendo
   pendência na primeira visita.
3. **`retencao_sem_recolhedor`/`nf_servico_sem_cno` sumindo por não terem
   linha própria.** Precisam aparecer com destaque dentro da linha do
   documento (não como rodapé discreto) — mesma régua do critério 9 do
   `CONTAI-039` ("nenhuma `Consequencia` fica truncada nem escondida atrás
   de interação nova").

## Dependências
- Bloqueado por: `CONTAI-040` (shell + item de menu "Despesas").
- Bloqueia: nada.

## Cenário e checagem final
**Gestão** — em casa, sentado, revisando o que falta resolver. O "Teste do
Canteiro" não se aplica.
