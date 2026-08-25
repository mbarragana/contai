# CONTAI-037 Porta para o pagamento conciliado a partir do documento

## Tipo e Prioridade
bug — **P1** — pagamento já conciliado (vinculado a nota) só é alcançável por
SQL direto quando o documento dele tem mais de um pagamento vinculado.

## Dor de Origem
Achado na reconciliação do `CONTAI-009` (24/08,
`docs/backlog/29-2026-08-24-reconciliacao-contai-009.md`, "4 — Pagamento
conciliado sem porta"). Verificado no código, não hipótese: `despesas[].href`
(`lib/fiscal/resumo.ts:625`) aponta sempre para `/documento/${doc.id}`, nunca
para os pagamentos individuais — quando uma despesa comprovada tem mais de um
pagamento vinculado, a home só leva ao documento, e não há, de lá, como
chegar a cada pagamento. É o espelho da porta que a home já tem para
pagamento pendente (exposição por favorecido, resolvida via `CONTAI-018`).

## User Story
Como dono da obra revisando uma nota já ligada a pagamentos, quero abrir
cada pagamento vinculado a partir do detalhe da nota, para conferir ou
corrigir a obra dele sem precisar do banco.

## Critérios de Aceite
1. [x] **Gate de mock nível 3 em `design/mocks/CONTAI-037.md`** — tabela
       antes/depois, sem tela nova. Mock aprovado em 2026-08-24.
2. [ ] Em `/documento/[id]`, cada linha da lista "Pagamentos desta nota"
       (`app/documento/[id]/page.tsx`, `PagamentosDesteDocumento`, ~linhas
       206-224) ganha um `BotaoLink` **"Ver o pagamento"**, `href="/pagamento/${p.id}"`,
       posicionado **antes** do "Desligar este pagamento" existente (ordem:
       navegação antes de ação de estado — mesma ordem já usada na tela
       irmã).
3. [ ] O rótulo espelha a convenção já em produção na direção inversa:
       `app/pagamento/[id]/page.tsx:305` já tem "Ver o documento" apontando
       de volta para `/documento/${d.id}`.
4. [ ] Nenhum campo, dado ou formatação da linha muda — data
       (`formatarDataBR`), favorecido (`p.favorecidoNome`) e valor
       (`formatarBRL(p.valorCentavos)`) continuam exatamente como estão.
5. [ ] E2E: documento com 2+ pagamentos vinculados → abrir `/documento/[id]`
       → clicar "Ver o pagamento" na segunda linha → chegar em
       `/pagamento/[id]` correto (o `id` do pagamento clicado, não do
       primeiro da lista).

## Out of Scope
- Qualquer mudança em `lib/fiscal/resumo.ts:625` (o `href` da despesa
  continuar apontando para o documento passa a ser correto agora que o
  documento vira hub navegável para seus pagamentos — não precisa mudar).
- Unificar as duas derivações de "pagamentos vinculados a um documento"
  (`alocado.pagamentos` aqui vs. `pagamentosVinculados` em
  `/documento/[id]/obra`) — dívida pré-existente, registrada, não deste
  ticket.
- Exibir status por linha (`conciliado`, etc.) — decisão fiscal explícita
  (ver Gate Fiscal): seria tautológico e arriscado.
- Qualquer mudança na tela `/pagamento/[id]` — ela já existe e já funciona.

## Gate Fiscal (Contador) — FECHADO
**Sem regra fiscal nova — exposição de dado já calculado.** Nenhum fato
fiscal é criado, nenhum custo é recalculado; é uma segunda porta de leitura
para dado que a tela já carrega (`alocado.pagamentos`, de `alocarCusto`).

**O que aparece em cada linha, e por quê** (já em produção, não muda): data
do pagamento (decide o ano-calendário em regime de caixa), valor bruto (não
uma fração alocada), favorecido. **O que não aparece, e por quê**: status
por linha — seria tautológico (todo item já está na lista porque
`documentoIds` contém este documento) e arriscado (se a coluna `status`
algum dia divergir do vínculo computado, mostrar o texto da coluna mentiria
por cima do dado correto já implícito na lista — mesma lição do `CONTAI-018`,
que trocou de fonte por esse motivo exato). Nenhum valor de custo/alocação
por linha — isso pertence à tela do próprio pagamento, não a este resumo.

Automático, sem exigência de revisão humana (CRC).

## Pre-mortem
1. **Reimplementar a lista com `pagamentosVinculados` em vez de linkar a que
   já existe** — criaria uma segunda derivação paralela do mesmo dado na
   mesma tela (achado do `cto-obra`), que descola no dia em que uma regra de
   alocação mudar. Guarda: critério 4, "nenhum dado muda", e a instrução
   explícita de reusar `alocado.pagamentos`, já carregado pela página.

## Viabilidade (CTO)
**Complexidade: XS.** Nenhuma mudança de modelo de dados, nenhuma query
nova — a página já carrega tudo via `carregarPainel` + `alocarCusto`. O
componente `PagamentosDesteDocumento` já renderiza a lista inteira (data,
favorecido, valor, botão "Desligar") em todos os ramos (normal, quarentena,
sem-retenção); o delta é literalmente um `BotaoLink` a mais por linha.

**Arquivos**: `app/documento/[id]/page.tsx` (único arquivo de produto) ·
`e2e/vinculo.spec.ts` (asserção de navegação, caso multi-pagamento já tem
cenário lá).

**Dívidas criadas**: nenhuma. Dívida pré-existente registrada, não paga por
este ticket: duas derivações do mesmo vínculo (`alocarCusto` vs.
`pagamentosVinculados`) em telas irmãs.

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: nada identificado.

## Perguntas Abertas
Nenhuma.

## Cenário e checagem final
**Gestão** — revisão de nota já ligada, em casa, sentado. Teste do Canteiro
não se aplica.

**Veredito: APROVADO.**
