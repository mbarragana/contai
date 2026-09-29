# 97 — Achado técnico: parser de retenção não reconhece "Valor bruto"

**2026-09-29.** Mateus reportou uma NFS-e real (PerfuraTec Fundações Ltda,
nº 261, obra dele) onde achou que nossa sugestão automática de retenção
(`lib/extracao/retencao-texto.ts`, CONTAI-054/062/068/070) deveria ter
pegado o ISS impresso na nota (R$1.797,03, 3% sobre R$59.901,00) e não
pegou.

## Investigação

Lido o PDF real. A nota mostra:
```
RETENÇÕES FEDERAIS
PIS/PASEP R$0,00  COFINS R$0,00  INSS R$0,00  IR R$0,00  CSLL R$0,00  Outras Retenções R$0,00
Valor bruto = R$ 59.901,00     Valor líquido = R$ 59.901,00
Situação Tributária do ISSQN: Normal
```

`contador` confirmou (consultado antes de tratar como bug): **não há
retenção destacada nesta nota** — "Valor bruto" = "Valor líquido", exatos,
prova que nada foi descontado do que o Mateus paga. O R$1.797,03 é o ISS
que a **PerfuraTec** apura e recolhe por conta própria (regime "Normal",
não "Retido na Fonte"); toda NFS-e de serviço imprime esse valor, com ou
sem retenção, por obrigação legal do documento. Reforço: tomador pessoa
física não é, de regra, responsável por substituição de ISS (LC 116/2003
art. 6º §2º II) — mesmo raciocínio do parecer
`docs/pareceres/2026-08-18-nfse-empreitada-simples-nacional.md` §5.2.

**O app está correto.** Não vira ticket de correção fiscal, não vira aviso
ao Mateus além da explicação já dada.

## Achado real, mas de baixa prioridade

`sugerirLinhaRetencao` (`retencao-texto.ts`) só reconhece o rótulo **"Valor
Total"**/`RE_TOTAL = /total/i` como o lado "bruto" do trio
total−retenção=líquido. Esta nota usa **"Valor bruto"**, que não casa com
`/total/i` — o parser não reconheceria o par mesmo se houvesse retenção de
verdade sob esse rótulo.

**Não fez diferença neste caso**: bruto=líquido zera a diferença de
qualquer forma, e diferença zero já é descartada pelo próprio filtro `if
(diferenca <= 0) continue;` (retenção não pode ser 100% nem negativa).

**Mas importaria numa nota futura** que use "Valor bruto" como rótulo E
tenha retenção real (ex.: `Valor bruto = R$X`, `Valor líquido = R$X − Y`,
com Y sendo uma retenção genuína). Nesse caso o parser devolveria `null`
(não reconheceria o padrão) em vez de sugerir a linha.

## Proposta

P2 — conveniência/robustez, sem urgência (nenhum caso real perdido até
aqui). Se retomado: ampliar `RE_TOTAL` para casar também "bruto"
(`/total|bruto/i`), seguindo a mesma doutrina do módulo (vocabulário
genérico, nunca específico de emissor/prefeitura) — critério 4 do cabeçalho
de `retencao-texto.ts` já cobre esse tipo de ampliação. Precisa de nota
real com retenção sob esse rótulo para virar teste de regressão (o módulo
é medido contra notas reais, nunca fixture reconstruída — doutrina do
próprio arquivo).

**Sem pergunta pendente.** Sem Gate Fiscal (não muda nenhuma regra, só
vocabulário reconhecido). Pode entrar na fila quando/se aparecer outra nota
real com esse padrão, ou como limpeza de baixa prioridade.