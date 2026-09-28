# Relato — scroll quebrado e busca ausente em `/documento/[id]/ligar` e `/pagamento/[id]/ligar` — 2026-09-28

## Origem

Mateus tentou ligar uma segunda parcela de cartão à nota real "Ilhamix
Concreto Ltda" (NF de serviço nº 1543, R$ 16.240,00) em produção, com 2
screenshots. Relatou três sintomas em um só fôlego: *"os agendamentos não
aparecem na lista para seleção"*, *"o scroll tá quebrado"*, e falta de busca
— *"imagina com 300 pagamentos para achar um pagamento compartilhado vai
ficar horrível"*. Também propôs, sem saber que já existe, buscar a partir da
parcela/pagamento em vez do documento.

Investigação ao vivo (browser real, antes de responder) separou isso em
quatro coisas distintas — uma delas não é dor (é comportamento correto já
esclarecido), uma já existe (não sabia), duas são dores reais.

## Esclarecimento, não dor — não vira ticket

> *"os agendamentos não aparecem na lista para seleção"*

**Comportamento correto.** A parcela que o Mateus mostrou é um compromisso
"Em aberto" (cartão, não pago, vence 15/10/2026) — não é um pagamento.
`pagamentosCandidatos` (`lib/fiscal/vinculo.ts:1274`) recebe `pagamentos:
readonly Pagamento[]` e filtra sobre isso; o chamador passa
`painel.pagamentos`, que são só os JÁ realizados. Vínculo pagamento↔documento
pressupõe regime de caixa (dinheiro já saiu) — é a mesma régua que rege custo
de aquisição no IRPF. Quando a fatura dessa parcela for paga, o registro vira
`Pagamento` de verdade e passa a aparecer normalmente, sem mudança nenhuma no
sistema. Já explicado ao Mateus ao vivo. Documentado aqui só para não voltar
como dúvida repetida — fato da obra/sistema, consulte este arquivo antes de
perguntar de novo.

## Dor 1 [P1] — rodapé fixo sobrepõe a lista durante o scroll

> *"o scroll tá quebrado"*

**Confirmado, reproduzido ao vivo** em `/documento/[id]/ligar`, com a lista
de candidatos revelada (24 linhhas na nota real testada). O `RodapeDeAcao`
(sticky/fixo, `app/_components/detalhe.tsx:132`) cobre parte das linhas da
lista durante boa parte do scroll — só para de sobrepor no fim de verdade da
lista.

**Causa provável, confirmada por leitura de código**: `ColunaDeDetalhe`
(`app/_components/detalhe.tsx:94`) e `RodapeDeAcao` são **irmãos**, não
aninhados — em ambas as telas (`documento/[id]/ligar/page.tsx:478-480` e
`pagamento/[id]/ligar/page.tsx:448-450`, mesmo padrão exato, char por char).
`ColunaDeDetalhe` não reserva `padding-bottom` do tamanho do `RodapeDeAcao`,
então o conteúdo de baixo da coluna fica atrás do rodapé sticky. Esse é o
padrão compartilhado por toda tela que usa os dois componentes juntos — não é
exclusivo de `ligar`, mas essas duas são onde a lista é longa o bastante para
o sintoma aparecer.

**Reproduzido diretamente**: `/documento/[id]/ligar`.
**Não testado, suspeita alta por padrão compartilhado**: `/pagamento/[id]/ligar`
(mesmos dois componentes, mesma relação de irmãos, confirmado por grep — só
não houve reprodução visual ao vivo nessa tela).

## Dor 2 [P1] — sem busca na lista de candidatos, em nenhuma das duas telas

> *"imagina com 300 pagamentos para achar um pagamento compartilhado vai
> ficar horrível"*

**Confirmado.** Nem `/documento/[id]/ligar` nem `/pagamento/[id]/ligar` (as
duas telas do `CONTAI-074`) têm campo de busca/filtro textual sobre a lista
de candidatos — só ordenação algorítmica (mesmo favorecido → mesmo valor →
menor diferença → cronológico, ver `pagamentosCandidatos`/
`documentosCandidatos` em `lib/fiscal/vinculo.ts`). Já são 24 candidatos na
nota testada, a maioria "Coberto por inteiro" (comportamento normal e
esperado do `CONTAI-074` — cobertura prévia não exclui da lista). O Mateus
estima 300 pagamentos como escala real da obra — a ordenação sozinha não
resolve achar um favorecido/valor específico nesse volume.

## Achado à parte — a "solução" proposta já existe

O Mateus sugeriu buscar a partir da parcela/pagamento em vez do documento.
Essa tela **já existe**: `/pagamento/[id]/ligar`, criada no `CONTAI-074`
como espelho de `/documento/[id]/ligar` — ele não sabia. Não falta construir
fluxo novo; falta consertar o padrão compartilhado (scroll + busca) que serve
as duas direções de uma vez. Nenhuma ação aqui além de registrar — não é
dor, é falta de descoberta de feature existente (fora do escopo deste
processamento; se persistir como padrão, é assunto de UX/onboarding, não de
requisito de tela).

## Fora de escopo — dito explicitamente, com o porquê

**"Vincular a nota ANTES de pagar"** (pré-associar um compromisso ainda não
pago a uma nota) — mudaria QUANDO o vínculo pode nascer (hoje: só depois do
pagamento existir, regime de caixa). Isso não é um ajuste de UI sobre as
duas telas de `ligar`; é uma mudança de modelo (vínculo compromisso↔documento
antes de haver pagamento) com implicação fiscal a validar com o `contador`
(o vínculo pagamento↔documento hoje É a prova de regime de caixa — um vínculo
"antecipado" precisaria de outro nome e outra regra, não reaproveitar o
mesmo). Já comunicado ao Mateus que fica fora deste relato. Pode virar relato
próprio no futuro, tratado como requisito novo, não como extensão do bug fix
de scroll/busca.

## Classificação de prioridade

Ambas **P1** (fricção de processo — não é obrigação fiscal, é UI/usabilidade
sobre dado que já existe corretamente). Confirmando o enquadramento do
relato: uma feature recém-entregue (`CONTAI-074`, commitado nesta mesma
janela) que não escala para o uso real descrito pelo Mateus é dívida de
usabilidade sobre entrega recente, não conveniência de "depois". Entre as
duas, o scroll é o mais urgente por já estar ativamente quebrado com 24
candidatos (bem abaixo dos 300 estimados); a busca é o que vira crítico só
na escala maior — mas nenhuma das duas serve para "depois".

## User stories

### US-A — o rodapé de ação não pode esconder linhas da lista durante o scroll

Como Mateus, gerenciando em casa e revisando uma lista longa de candidatos
para ligar a um documento ou a um pagamento, quando eu rolo a lista **em
qualquer ponto do meio do scroll** (não só no início/fim), eu preciso
continuar vendo o conteúdo de cada linha sem parte dela escondida atrás do
rodapé fixo, para poder ler favorecido/valor/data antes de marcar.

**Critérios de aceite:**
1. Em `/documento/[id]/ligar`, com uma lista de candidatos longa o bastante
   para exigir scroll (reproduzível com a nota real de 24 candidatos), a
   última linha visível acima da posição de scroll atual nunca fica
   parcialmente coberta pelo `RodapeDeAcao` — em nenhum ponto intermediário
   do scroll, só no repouso final da lista.
2. O mesmo critério vale, sem exceção, para `/pagamento/[id]/ligar` — mesma
   verificação, mesmo padrão de componentes.
3. A correção é no componente compartilhado (`ColunaDeDetalhe`/
   `RodapeDeAcao` em `app/_components/detalhe.tsx`) ou no par de telas — não
   uma correção pontual em só uma das duas que deixa a outra quebrada.
4. Não regride nenhuma outra tela que usa `ColunaDeDetalhe` + `RodapeDeAcao`
   juntos (checar quais outras telas usam o par antes de mudar o componente
   base).

### US-B — buscar/filtrar a lista de candidatos por texto

Como Mateus, gerenciando em casa e tentando ligar um pagamento a um documento
(ou vice-versa) numa obra com centenas de pagamentos registrados, quando a
lista de candidatos tem mais itens do que cabem numa tela, eu preciso
filtrar por texto (favorecido e/ou valor) para achar o candidato certo sem
depender só da ordenação algorítmica.

**Critérios de aceite:**
1. `/documento/[id]/ligar` tem um campo de busca visível acima da lista de
   candidatos, que filtra a lista renderizada conforme o texto digitado.
2. `/pagamento/[id]/ligar` tem o mesmo campo, com o mesmo comportamento.
3. A busca convive com a ordenação existente (favorecido/valor/diferença/
   cronológico) — filtra o conjunto, não substitui a ordem dentro do
   conjunto filtrado.
4. A busca não interfere no comportamento do `CONTAI-074` (chip de "já
   ligado a", bloco revelável de "coberto por inteiro", aviso de duplicação)
   — esses continuam funcionando sobre o subconjunto filtrado.
5. Campo/algoritmo de busca (só favorecido, só valor, ou os dois; fuzzy ou
   substring) é decisão de implementação do `designer`/`cto-obra`, não
   travada aqui.

## Perguntas abertas

Nenhuma pergunta bloqueante ao Mateus. As duas decisões de detalhe que
poderiam virar pergunta (o que exatamente a busca indexa; se ela aparece
sempre ou só acima de N candidatos) ficam para o `designer`/`cto-obra`
resolverem no `/tickets-req`/`/design` — não mudam o critério de aceite
acima nem têm implicação fiscal.

## Cortes

- **Descoberta de feature existente** (Mateus não sabia de
  `/pagamento/[id]/ligar`) — não é requisito de produto, é um dado para o
  time observar; sem ação aqui.
- **"Vincular antes de pagar"** — fora de escopo deste relato, ver seção
  acima; candidato a relato/ticket próprio.

## Próximo passo

Sem impacto fiscal (UI/usabilidade sobre dado que já existe corretamente) —
não precisa de gate do `contador`. Pronto para `/tickets-req` fatiar em
ticket(s): US-A e US-B tocam o mesmo par de telas e o mesmo componente
compartilhado, então cabe avaliar no `/tickets-req` se vale um ticket só
(scroll + busca) ou dois independentes — nenhuma depende da outra
tecnicamente.
