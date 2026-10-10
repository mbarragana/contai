# Excedente da nota não compõe retenção pendente vs. a pagar — 2026-10-10

## Relato (vivido ao vivo na sessão, logo depois de corrigir o valor da PerfuraTec)

Depois de corrigir o valor bruto da nota PerfuraTec (R$59.901,00), o Mateus
reparou no card "Custo comprovado" do detalhe do documento — banner âmbar:
"Excedente da nota: R$34.901,00 — nota ainda não paga", com o texto "Este
pedaço da nota não vira custo: regime de caixa...".

> "para mim aquele dizer em ambar não faz sentido, porque não é os 34mil
> referente a nota, é 33 e pouco referente a nota e 1797 referente ao ISS"

## O que já foi investigado nesta sessão (não repetir)

Documento: Valor R$59.901,00; pagamento confirmado R$25.000,00 (PIX, 18/09);
linha de retenção ISS R$1.797,03 (`documento_retencao`,
`composicao=tributo_identificado`, `tributo=iss`, `e_desconto_efetivo=true`,
`quem_recolhe='eu'` — **guia ainda não paga/vinculada**); pré-vínculo de
compromisso futuro PerfuraTec R$33.103,97 (previsto 18/10/2026).

A matemática do "excedente" bate duas vezes:
- R$59.901,00 − R$25.000,00 = **R$34.901,00** (o que a tela mostra hoje, como
  um bloco só)
- R$33.103,97 (a pagar ao fornecedor) + R$1.797,03 (ISS a recolher via guia)
  = **R$34.901,00** (mesmo total, duas naturezas diferentes)

O sistema já tem a distinção certa — só não está ativa para este estado:
`lib/fiscal/vinculo.ts` (função que monta `AlocacaoPorDocumento`, ~linha
790-849, CONTAI-056 critérios 4 e 5) separa `explicadoPorRetencaoCentavos`
(verde, "quitado por retenção") de `faltaPagamentoCentavos` (âmbar, "falta
pagamento genuína"). Mas `explicadoPorRetencaoCentavos` só é alimentado
quando a perna de retenção já foi **absorvida por um pagamento confirmado**
(ligada a guia paga). O estado intermediário — retenção identificada,
`quem_recolhe='eu'`, guia declarada mas **ainda não paga** — não tem balde
próprio: cai dentro de `faltaPagamentoCentavos`, misturado com o que é
genuinamente "ainda devido ao fornecedor".

Esse estado intermediário já tem nome e texto em outro lugar do produto: a
lista `/despesas` mostra, para documentos nessa mesma situação (ex: JA SILVA,
FRANCISCOALMEIDA), o chip `CHIP_RETENCAO_GUIA_PENDENTE` = "Guia de retenção
pendente" (`lib/fiscal/retencao.ts:278`) com o texto
`CONSEQUENCIA_RETENCAO_EU_SEM_GUIA` (linhas 264-270):

> "Você já confirmou que quem recolhe esta retenção é você — a pendência aqui
> não é de identificação, é de pagamento: enquanto a guia não for paga e
> vinculada a este documento, esta fatia não entra no custo de aquisição do
> ano nenhum. Se a guia nunca for paga, o efeito não é apenas essa fatia
> ficar fora do custo para sempre — o valor retido se torna dívida tributária
> [vencida no nome dele]."

Esse texto e esse estado (`eu_sem_guia`, `TITULO_RETENCAO_GUIA_PENDENTE` =
"Recolhedor confirmado — guia ainda não paga") já existem e já passaram pelo
gate fiscal (CONTAI-059, ADENDO 4 Pergunta 2). O que falta é refleti-los
dentro do breakdown "Excedente da nota" do card de custo do detalhe do
documento — hoje esse card só conhece "falta pagamento", não "falta pagamento
*e também* falta recolhimento de retenção já identificada".

## Classificação da dor

**P2 — clareza de leitura/composição do número.** Não bloqueia fluxo, não
produz erro fiscal: o valor agregado (R$34.901,00) já está certo e o custo
comprovado calculado por `alocarCusto`/`vinculo.ts` não muda. É puramente a
tela não contar ao Mateus que aquele bloco é dinheiro-a-fornecedor + imposto-
a-recolher, quando ele já sabe disso e a tela não ajuda.

## User story (preliminar — a confirmar no `/tickets-req`)

Como Mateus, revisando o detalhe de um documento em casa, quando a nota tem
simultaneamente (a) saldo a pagar ao fornecedor e (b) uma retenção com
`quem_recolhe='eu'` cuja guia ainda não foi paga/vinculada, quero que o
banner âmbar "Excedente da nota" quebre o valor nessas duas linhas nomeadas
em vez de apresentar um total único — para não precisar refazer de cabeça a
conta que o sistema já tem os dois números para fazer.

### Critério de aceite (preliminar)

- Quando o documento tiver retenção(ões) no estado `eu_sem_guia` dentro do
  valor hoje agregado em `faltaPagamentoCentavos`, o card "Custo comprovado"
  mostra pelo menos duas linhas: "a pagar ao fornecedor: R$X" e algo como
  "retenção a recolher (guia pendente): R$Y", com X + Y = o total que a tela
  já mostra hoje (nenhuma mudança de valor agregado).
- O texto de consequência da linha de retenção reaproveita
  `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA`/`CHIP_RETENCAO_GUIA_PENDENTE` já
  existentes em `lib/fiscal/retencao.ts` — sem reescrever, salvo ajuste de
  contexto que o `contador` explicitamente aprovar (pergunta 2 abaixo).
  Critério verificável: a string em tela é byte-a-byte a mesma constante, ou
  o parecer do `contador` registra a variação aprovada.
- Quando não houver retenção `eu_sem_guia` associada (caso comum, maioria dos
  documentos), o banner continua exatamente como está hoje — zero regressão
  para o caso sem retenção pendente.

## Gate Fiscal — perguntas para o `contador` levar ao `/tickets-req`

1. Confirmar que esta quebra de **apresentação** não muda nenhum cálculo de
   custo comprovado — zero alteração em `alocarCusto`, `explicadoPorRetencaoCentavos`
   ou `faltaPagamentoCentavos`; é só como o número já certo é decomposto na
   tela.
2. Confirmar se o texto do chip "Guia de retenção pendente"/
   `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA`, já aprovado para a lista `/despesas`,
   serve sem reescrita dentro do card de custo do detalhe do documento, ou se
   esse novo contexto (dentro do breakdown "Excedente da nota", não na lista)
   pede adaptação de texto.

## Fora de escopo (explícito)

- Mudar o cálculo de `faltaPagamentoCentavos`/`explicadoPorRetencaoCentavos`
  — está certo, é questão de apresentação quando a retenção ainda não foi
  paga.
- Qualquer mudança na doutrina de quando a retenção "quita"/abate custo
  (ADENDO 9 de `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`,
  intocado).
- Generalizar para outros estados de retenção (`sem_recolhedor`,
  `recolhida_por_terceiro` etc.) — este relato é especificamente sobre
  `eu_sem_guia` convivendo com saldo a pagar no mesmo documento. Se existir
  caso real de outro estado misturado no mesmo breakdown, é relato novo.

## Perguntas de esclarecimento

Nenhuma pendente — o relato já veio com a investigação técnica feita na
sessão (matemática, origem dos dois números, texto a reaproveitar). As duas
perguntas acima são para o `contador` no `/tickets-req`, não para o Mateus.
