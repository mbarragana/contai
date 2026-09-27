# CONTAI-068 criado — 2026-09-26 — retenção sugerida falha quando o mesmo valor aparece sob dois rótulos

## Relato de origem

Bug real, achado hoje com reprodução contra PDF real (não hipótese): o Mateus
testou `sugerirLinhaRetencao` (CONTAI-054/062) contra a NFS-e de Palhoça/SC
que ele mesmo deu como exemplo ao especificar o `CONTAI-054`, e o parser
devolveu `null` mesmo com a aritmética batendo perfeitamente (Total 40.857,14
− Retenção 1.889,48 = Líquido 38.967,66).

## Causa raiz

A nota imprime o mesmo valor de retenção **duas vezes**, sob dois rótulos
diferentes, em dois blocos do documento — "Valor ISS" (bloco de descrição do
item) e "ISSRF" (bloco de resumo financeiro). O `Map` de sugestões, chaveado
por `rótulo|valor`, trata isso como duas candidatas distintas; como só aceita
quando sobra exatamente 1, devolve `null` — mesmo padrão de "ambiguidade
genuína" do total/líquido, aplicado por engano à própria candidata de
retenção.

## Gate Fiscal

Fechado no mesmo dia — **ADENDO 6** de
`docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`: valor idêntico
sob rótulos diferentes é repetição do mesmo fato (não ambiguidade); valores
diferentes continuam ambiguidade genuína, sem mudança. `contador` vetou
desempate por vocabulário de emissor/prefeitura — só critério estrutural
(ordem de aparição no texto, ou proximidade ao par total/líquido).

## Ticket

`docs/tickets/CONTAI-068.md` (P1, bug, complexidade S, sem UI, sem migration).
`cto-obra` escolheu ordem de aparição no texto como critério de desempate
(proximidade ao par foi descartada: o total aparece mais de uma vez em notas
reais, então "o par" nem sempre é único).

**Achado no Passo 1/3, não hipótese**: o teste já existente
`lib/extracao/retencao-texto.test.ts` ("dois rótulos diferentes com o valor
da diferença: ambiguidade genuína", ~linha 275, `ISSRF`/`Desconto Condicional`
ambos R$ 500,00) cai na MESMA categoria que o ADENDO 6 manda colapsar — o
parecer não distingue "mesmo fato repetido" de "dois fatos coincidindo em
valor", só olha `valorCentavos`. Esse teste muda de `null` para sugestão como
parte deste ticket (critério 5), não como efeito colateral silencioso.
Pergunta aberta não bloqueante: confirmar com o `contador`, quando houver
sessão, se essa generalização era intencional.

Pronto para `/develop` sem Gate 0 (módulo puro, sem tela nova).
