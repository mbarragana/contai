# Relato — "Nova compra no cartão" retroativa: comprovante que não acha o lugar, botão que soa errado — 2026-09-26

Relato do Mateus, com screenshot, sobre `/adicionar/compra-cartao` passo 2
("Preencher e anexar"). Ele já confirmou que a herança de dados da nota
(`CONTAI-064`, recém-entregue) está funcionando — não é dor nova.

**Cenário do screenshot**: `Data da compra = 28/04/2026`,
`Vencimento da fatura = 15/05/2026` — as duas já passadas (hoje é
26/09/2026). É registro **tardio** de algo que já aconteceu de verdade, não
um agendamento futuro real.

## Dores extraídas (citação literal)

> *"agora está carregando os dados corretamente, mas não é possível carregar
> o comprovante do pagamento. No caso eu abro a fatura, pegaria o item
> referente ao pagamento, o comprovante do pagamento e anexaria, mas não é
> possível anexar nenhum documento agora."*

**D-nova (sem número — resolvida sem virar dívida, ver Gate Fiscal)**:
confusão entre dois documentos com função diferente. O Mateus quer anexar
"o comprovante do pagamento específico do item"; o que existe hoje é
comprovante único por FATURA em `/fatura/[id]/confirmar`, decisão deliberada
do `CONTAI-022` ("a compra no cartão não tem comprovante e nunca terá; quem
tem é a fatura").

> *"mesmo as datas de pagamento e de vencimento da fatura serem no passado o
> dizer do botão é 'Agendar - não entra no custo', isso é estranho. Vão
> existir registros de fatura que já foram pagas e registro que não foram."*

Botão correto no mecanismo (a compra SEMPRE nasce compromisso, regime de
caixa — adendo §B(c), `decidirRegistro` nunca decide por data de compra no
cartão) mas confuso na leitura, porque ele sabe que aquele ciclo específico
já foi pago.

## Investigação e Gate Fiscal + Gate Técnico desta rodada

Duas consultas em paralelo, ambas fecham sem precisar de pergunta ao Mateus:

**`contador`** — parecer novo,
`docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md`. Veredito:
comprovante único por fatura está **certo e suficiente** (o evento de caixa
é a liquidação da fatura, não a compra); não existe comprovante por item que
a fatura não supra — o item já é sustentado por dois documentos que já
existem (NF do favorecido + comprovante do pagamento da fatura); registro
tardio não muda regime de caixa nem exigência documental. **Diagnóstico:
confusão de navegação, não dívida fiscal nova.**

**`cto-obra`** — achado: o "atalho de 3 passos" já é de 2 hoje (a tela de
sucesso da compra já linka para `/fatura/[id]`). Recomenda variante
**redirect** (PP, sem migration): quando `dataVencimento < hoje`, a tela de
sucesso ("Agendado") leva direto para `/fatura/[id]/confirmar` em vez de
`/fatura/[id]` — resolve a dor do comprovante por navegação, sem tocar o
invariante "comprovante é da fatura". Rejeitou formulário fundido (M +
migration, esconderia compras irmãs da mesma fatura na hora de confirmar).
Sobre o texto do botão: nenhuma razão técnica contra enriquecer contexto
quando a data já passou — só cuidado de manter o prefixo **"Agendar"** por
causa de 4 seletores E2E (`e2e/cartao.spec.ts` ×3, `e2e/compromisso.spec.ts`)
que usam `getByRole("button", { name: /^Agendar/ })`.

**D81, nova (achado do `cto-obra`, não do relato)**: compra atrasada
registrada numa fatura que **já tem** um `fatura_desembolso` gravado cria um
SEGUNDO desembolso — duplica o registro de saída de caixa perante o banco
(o custo por pagamento continua correto, cada compra vira 1 pagamento na
data certa; o que duplica é só o registro de "quanto saiu do banco"). Achado
relevante porque é exatamente o padrão do backfill que o Mateus está fazendo
agora (compra a compra, de uma fatura antiga já paga). Fica **fora do
CONTAI-066**, registrada como dívida — candidata a ticket próprio (aviso em
`/confirmar` quando a fatura já tem desembolso, P complexidade, sem
migration, segundo o `cto-obra`). Modelar "saldo não alocado" pra evitar a
duplicação de vez é G + migration, só se o `contador` disser que o registro
duplicado de saída importa (não avaliado).

## Classificação e story

**P1 fricção** (não P0 — o `contador` não viu obrigação fiscal nova, os dois
documentos que sustentam o item já existem e já são capturados).

**US — Registro retroativo de compra no cartão guia até a confirmação da
fatura**: como dono da obra fazendo backfill de compras antigas em casa,
sentado, quando registro uma compra cuja fatura eu sei que já foi paga,
quero ser levado direto para confirmar esse pagamento (e anexar o
comprovante da fatura), em vez de cair numa tela neutra da fatura sem
indicação do próximo passo — critério de aceite: a partir da tela "Agendado"
com `dataVencimento <= hoje`, o link primário leva a
`/fatura/[id]/confirmar`.

Vira `CONTAI-066`.

## Cortado do escopo (e por quê)

- **Comprovante por compra individual dentro da fatura** — descartado por
  parecer fiscal (§2 do parecer novo): não tem função probatória própria.
  Se o Mateus quiser guardar a "linha do extrato" por organização pessoal, é
  conveniência (P2), não requisito fiscal — não teve pedido explícito nesse
  sentido, então fica de fora até haver um.
- **Formulário fundido** (registrar compra + confirmar pagamento da fatura
  numa RPC só) — recusado pelo `cto-obra`: esconde compras irmãs da mesma
  fatura, M + migration, sem ganho sobre o redirect.
- **D81** (desembolso duplicado) — registrada acima, não vira ticket nesta
  rodada por disciplina de escopo (não é a dor relatada, é achado derivado);
  fica na fila para revisão de prioridade.

## Perguntas abertas

Nenhuma. As duas perguntas de arquitetura do relato original ((a) comprovante
por item, (b) atalho de registro retroativo) foram fechadas pelo
`contador`+`cto-obra` sem precisar voltar ao Mateus — o parecer fiscal
resolve as duas leituras possíveis de "o comprovante do pagamento específico
do item".
