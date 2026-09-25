# CONTAI-056 Retenção confirmada não conta como custo comprovado (bug fiscal)

## Tipo e Prioridade
bug — **P0** (fiscal). Achado por auditoria de código (não relato espontâneo
do Mateus), confirmado em
`docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`, seções "ADENDO 2"
e "ADENDO 3" (2026-09-25): subestima custo de aquisição na ficha Bens e
Direitos, o que infla ganho de capital tributável na venda futura — dinheiro
real saindo do bolso do Mateus sem necessidade.

## Dor de Origem
Numa nota real do Mateus (retenção confirmada, `quem_recolhe` já resolvido
como "empresa", sem pendência aberta), a tela mostra permanentemente "Custo
comprovado" (só a perna paga em dinheiro) e **"Excedente da nota — nota ainda
não paga"** para o valor retido — como se essa fatia nunca tivesse sido
quitada. O Mateus notou a contradição com o que o `contador` já havia dito na
mesma sessão ("custo de aquisição = valor bruto da nota") e perguntou se isso
não contradizia o parecer; a suspeita virou auditoria de `lib/fiscal/vinculo.ts`
e confirmação formal no ADENDO 2 (a palavra `retencao` não existe nesse
arquivo — `alocarCusto` só soma `Pagamento`, nunca `documento_retencao`).

## User Story
Como dono da obra que já confirmou a retenção destacada numa nota de serviço
PJ (`e_desconto_efetivo = true`) e sabe que quem recolhe é a empresa (ou
ainda não sabe quem recolhe), quero que essa fatia conte como custo
comprovado assim que confirmada, para que a ficha de Bens e Direitos não
subestime meu custo de aquisição.

## Critérios de Aceite
1. [ ] Dado um documento com uma linha `documento_retencao` de
   `e_desconto_efetivo = true` **e** `quem_recolhe ∈ {"empresa", "nao_sei"}**,
   e pelo menos um `Pagamento` vinculado a esse documento (qualquer data),
   quando a tela de conciliação é aberta, então essa linha soma como perna de
   pagamento em `alocarCusto`, com data-efeito igual à data do pagamento
   vinculado **mais antigo** desse mesmo documento. Regra: ADENDO 2 (item 1) +
   ADENDO 3 (Pergunta 1 e 2) do parecer acima.
2. [ ] Dado um documento com `quem_recolhe = "eu"`, a linha de retenção
   **nunca** soma como perna de pagamento — o mecanismo continua sendo
   exclusivamente a GUIA (`Pagamento` real que o Mateus paga), já implementado
   em `linhaSemRecolhedor` (`lib/fiscal/retencao.ts:341`) e coberto por
   `e2e/retencao.spec.ts:356`, que **não muda uma linha**. ADENDO 3, Pergunta 1.
3. [ ] Sem nenhum `Pagamento` vinculado ao documento ainda, a linha de
   retenção não entra em nenhum ano-calendário — mesmo estado que já vale
   hoje para nota sem pagamento nenhum. ADENDO 3, Pergunta 2.
4. [ ] Dado esse mesmo documento (critério 1) com sobra explicada pela
   retenção, o texto de tela deixa de dizer "Excedente da nota — nota ainda
   não paga" para essa fatia — ganha texto/cor próprios indicando que foi
   explicada por retenção confirmada. ADENDO 2, item 2.
5. [ ] Dado um documento com sobra sem nenhum pagamento vinculado **e** sem
   retenção que se qualifique pelos critérios 1-2, o texto "nota ainda não
   paga" continua aparecendo, só para essa fatia genuinamente sem destino.
   ADENDO 2, item 2.
6. [ ] A pendência de "quem recolhe" (`retencao_sem_recolhedor`) continua
   visível e nomeada quando `quem_recolhe` está sem resposta, **sem** usar o
   texto/cor de "nota não paga" — é risco de recolhimento em aberto, não
   custo não comprovado. ADENDO 2, item 3. `linhaSemRecolhedor` não muda.
7. [ ] Dado um documento com retenção qualificada (critério 1), `quem_recolhe`
   resolvido e nenhum outro pagamento pendente, a ficha de discriminação anual
   (`lib/fiscal/discriminacao.ts`) mostra esse documento como custo comprovado
   completo (bruto da nota) no ano correto — não mais como alarme permanente.
8. [ ] Caso sobrecoberto (pagamentos + retenção qualificada somando mais que o
   bruto da nota, dado contraditório): vira pendência visível, nunca silêncio
   nem estouro numérico.

## Out of Scope
- Cálculo da aferição INSS/SERO (`lib/fiscal/afericao.ts`) — retenção continua
  **sempre** irrelevante para a base do CNO, qualquer percentual ou natureza,
  qualquer `quem_recolhe`. Confirmado pelo `cto-obra`: `afericao.ts` não
  importa `vinculo.ts` hoje e deve continuar sem importar.
- Decomposição de retenção combinada ou estimativa de percentual (§4/A.1 do
  parecer) — sem mudança.
- Mudar `linhaSemRecolhedor`/o mecanismo de guia para `quem_recolhe = "eu"` —
  já está correto, confirmado no ADENDO 3.
- Coluna de data própria em `documento_retencao` (migration) — rejeitada no
  ADENDO 3: fixaria a retenção em regime de competência, contra a regra de
  caixa do resto do parecer.
- Corrigir `composicaoDaDiscriminacao` (defeito nomeado à parte, D55) — não
  tocar de carona.
- Levantamento retroativo de quantas notas do acervo já estão no estado
  incorreto hoje — auditoria de dados é ticket separado, não este.

## Gate Fiscal (Contador)
Fonte única: `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`,
seções "ADENDO 2" e "ADENDO 3" (2026-09-25). Resumo normativo:

1. **Se** `e_desconto_efetivo = true` **e** `quem_recolhe ∈ {"empresa",
   "nao_sei"}` **então** a linha soma como perna de pagamento em
   `alocarCusto`, com data igual à do pagamento vinculado mais antigo do
   mesmo documento — regime de caixa (IN SRF 84/2001 art. 17): o Mateus já
   transferiu o líquido e não tem mais nada a desembolsar por aquela nota; o
   que resta é risco de compliance de terceiro, irrelevante para o custo dele.
2. **Se** `quem_recolhe = "eu"` **então** a linha nunca soma — a obrigação só
   migrou de "pagar ao prestador" para "pagar ao Fisco", e essa segunda perna
   (a guia) ainda não aconteceu; contar a linha também seria reconhecer
   dispêndio de dinheiro que o Mateus ainda tem no bolso.
3. `excedenteNotaCentavos`/texto de tela precisam distinguir dois motivos hoje
   colapsados: (a) falta pagamento genuíno vs (b) fatia já explicada por
   retenção qualificada — só (a) diz "nota ainda não paga".
4. Pendência "quem recolhe" é ortogonal e não deve usar o vocabulário de
   "nota não paga" — é sobre risco de recolhimento em aberto, não custo não
   comprovado.
5. **Nota de acompanhamento, não bloqueante**: se uma linha nascer
   `"nao_sei"` (contando para custo) e depois for editada para `"eu"`, o
   custo cai retroativamente até existir guia vinculada — correto
   fiscalmente; a UX dessa transição (ex.: alerta se o ano já foi declarado)
   fica a critério do `cto-obra`/`lead-engineer`, não é bloqueio deste ticket.

## Pre-mortem
1. `alocarCusto`/`vinculo.ts` já teve bug real que só um E2E não-mockado
   pegou (`numeric(14,2)` virando number, não string). Um fix apressado que só
   soma a retenção sem reler o arquivo inteiro pode deixar de propagar o
   valor corrigido para todo output derivado (discriminação anual, tela de
   despesas). Mitigação: viabilidade abaixo já mapeia todos os arquivos
   afetados.
2. Vazamento para o lado errado: se o componente/soma de custo for reaproveitado
   pelo cálculo da aferição SERO, a retenção passaria a abater a base do
   INSS — o parecer é explícito que isso nunca muda. Mitigação: `cto-obra`
   confirmou que `afericao.ts` não importa `vinculo.ts` hoje; critério de
   aceite implícito é manter essa separação (guard de import no teste).
3. Meia-implementação que confunde os dois trilhos: somar a retenção sem
   separar os dois motivos de excedente (critério 4/5) esconderia o caso
   inverso — uma nota genuinamente sem pagamento poderia parar de alarmar.

## Viabilidade (CTO)
- **Modelo de dados**: nenhum. `Documento.retencoes[]` já chega em
  `alocarCusto` via `carregarPainel` (`lib/data.ts:216`). É lógica pura, sem
  migration (confirmado no ADENDO 3 — a data-efeito vem do pagamento
  vinculado mais antigo, não de coluna nova).
- **Arquivos e complexidade — M** (o cálculo é S; a propagação é o custo):
  - `lib/fiscal/vinculo.ts`: `alocarCusto` (l.499-605) — somar as pernas
    qualificadas (critério 1) em `somaPagamentos`, na ordem cronológica junto
    dos pagamentos reais; novo `Alocacao.porRetencao`; novo
    `Componente.somaRetencoesConfirmadasCentavos`; **renomear**
    `DocumentoAlocado.excedenteNotaCentavos` → `faltaPagamentoCentavos` +
    novo `explicadoPorRetencaoCentavos` (rename deliberado — o typecheck
    varre os ~8 `app/**/page.tsx` que leem o campo, mais seguro que grep);
    `custoComprovadoDoAno`/`AteOAno` (l.610-629) incluem `porRetencao`;
    `saldoDescobertoDaNota` (l.668) lê só a falta genuína; `notaCoberta`
    (l.697) usa a mesma condição do critério 1/2.
  - `lib/fiscal/revisao.ts`: `anosDaAlocacao` (l.723), `componentesDoAno`
    (l.855-873, alimenta a composição material/mão de obra), laço
    antes/depois (l.569-578).
  - `lib/fiscal/despesas.ts` (l.330-431) e `lib/fiscal/resumo.ts`
    (l.926-953): uma linha/parcela para a perna de retenção, ou o total da
    tela de despesas diverge da home.
  - `app/(gestao)/documento/[id]/page.tsx` (l.203-217): dois blocos, dois
    textos — o de "explicado por retenção" copiado do parecer, nunca
    reescrito.
  - Caso sobrecoberto (critério 8): pendência visível, nunca silêncio.
- **Aferição SERO — isolada, confirmado por leitura de código**:
  `posicaoDeAfericao` (`lib/fiscal/afericao.ts:177`) recebe `obras +
  documentos`, não importa `vinculo.ts`, não lê `Alocacao`; `motivoForaDaBase`
  (l.148) recusa por escrito ler `documento_retencao`. Pedir ao
  `lead-engineer` um guard de fonte (padrão `retencao.test.ts:333`):
  `afericao.ts` não importa `./vinculo`.
- **Outputs a conferir**: discriminação anual (`discriminacao.ts:345-377`,
  cláusula "Dispêndios pagos"/"sendo"); home (`resumo.ts:550`); tela de
  despesas; as ~7 páginas que leem `excedenteNotaCentavos` (rename cobre por
  typecheck); fila "pago sem nota" (`resumo.ts:620`, `risco.ts:194` — **não
  devem mudar**); pendência "quem recolhe" (`resumo.ts:776`). Pagamentos
  Efetuados: intocada por construção, desde que a perna de retenção **não**
  vire `Pagamento` sintético (nunca entra em `porPagamento`).
- **Testes**: unit em `vinculo.test.ts` (bruto 10,00 / retido 0,50 qualificado
  / pago 9,50 → custo 10,00, falta 0, explicado 0,50; caso `quem_recolhe="eu"`
  não soma; sobrecoberto; ordem cronológica cruzando ano) e
  `discriminacao.test.ts` (texto do ano reflete o bruto). **Não-mockado
  obrigatório**: E2E em `e2e/retencao.spec.ts` no Postgres local — nota +
  linha `e_desconto_efetivo`/"empresa" + PIX líquido → detalhe mostra "Custo
  comprovado" = bruto e zero "nota ainda não paga"; `/pendencias` sem "pago
  sem nota"; o teste "Eu" (l.356) existente confirma que não regrediu.
- **Não fazer**: não somar a retenção via `Pagamento` sintético; não tocar
  `afericao.ts`; não corrigir `composicaoDaDiscriminacao` (D55) de carona.

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: nenhum. Não relacionado a `CONTAI-053`/`054`/`055` (aquelas são
  sobre captura da linha; esta é sobre o cálculo de custo já usar a linha
  capturada).

## Perguntas Abertas
Nenhuma — as duas levantadas pelo `cto-obra` no Gate de viabilidade foram
resolvidas com autoridade fiscal no ADENDO 3.

## Cenário e checagem final
**Gestão** — conciliação pagamento↔nota é o cenário principal (em casa,
sentado, revisão antes da declaração). Teste do Canteiro não se aplica.
Serve diretamente à meta 2 (relatórios anuais prontos e corretos): o defeito
atual, sem correção, produz uma discriminação anual que subestima custo de
aquisição, na direção que custa dinheiro real ao Mateus no futuro.
**Veredito: APROVADO**, sem Gate 0 de design (textos de tela citam o parecer,
não inventam fluxo novo — variação de texto/cor num bloco existente).
