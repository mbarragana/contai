# CONTAI-095 — Colaborador cria compromisso; rota sem bifurcação de pagamento

Nível 1 para a rota em si (`/adicionar/compromisso` é tecnicamente nova), mas
o conteúdo do formulário **não é novo trabalho de design**: é o mesmo
conjunto de campos que a ramificação de agendamento dentro de
`/adicionar/pagamento` já usa em produção hoje (favorecido, CNPJ/CPF, valor
previsto, vencimento, nota de origem/vínculo opcional) — só muda o **ponto
de entrada e o desligamento da bifurcação por data**.

## Cenário

Captura, pelo colaborador, no mesmo sentido do `CONTAI-094` — mesma pressa
potencial, mesmo orçamento de interação que o agendamento já tem hoje (este
ticket não aumenta o número de perguntas da tela, só muda quem pode abri-la
e em qual rota). Ganha o mesmo tratamento desktop de
`captura-no-desktop-v1.md`, com uma diferença: **sem anexo**, então sem a
seção de dropzone/rail de arquivo daquele documento — não há arquivo para
subir aqui, "nota de origem" é uma referência a um documento já existente,
não um upload novo.

## O que é de fato novo nesta tela

- **Nunca bifurca por data.** Hoje, em `/adicionar/pagamento`,
  `decidirRegistro` manda data futura para compromisso e data passada/hoje
  para pagamento direto. Nesta rota exclusiva, essa bifurcação **não
  existe**: toda submissão produz `compromisso` "aberto", mesmo com
  vencimento no passado — nunca produz `pagamento`. A tela não deve mostrar
  a linguagem de "pagamento" em nenhum momento (nem no formulário, nem na
  confirmação), porque isso sugeriria ao colaborador que ele confirmou um
  pagamento de verdade.
- **Sem passo de comprovante.** O ramo de agendamento de hoje já não pede
  comprovante; isto continua, e esta rota nunca entra no fluxo de
  comprovante em nenhuma circunstância.
- **Tela de confirmação final**: precisa dizer explicitamente que o
  compromisso ficou aberto, aguardando o dono — nunca "agendamento
  confirmado" de forma genérica, que no app de hoje pode conviver com o
  sentido de "já virou um compromisso reconhecido oficialmente". **Texto
  exato: pergunta aberta.**
- **Rail em tela larga (≥880px)**: se existir, mostra só o resumo do já
  afirmado (favorecido, valor previsto, vencimento, nota de origem se
  houver) — sem seção de anexo, porque não há.

## Delta em `/compromisso/[id]`

Quando o compromisso foi criado por colaborador, a tela passa a mostrar
"criado por {nome}" (mesmo padrão tipográfico secundário já usado em outras
telas de autoria desta rodada) e os botões de resposta/confirmação de
pagamento **não aparecem** para o colaborador — nem escondidos por CSS, a
ausência é condicional ao papel de quem está vendo a tela.

## Campos

Favorecido (nome + CNPJ/CPF), valor previsto, vencimento, nota de origem
(opcional) — todos campos fiscais, todos já existentes hoje no ramo de
agendamento, todos nascem vazios sem default, exatamente como já funcionam.
Nenhum campo novo nasce neste ticket.

## Textos com consequência fiscal

Nenhum texto fiscal novo — campos e validações são as mesmas de hoje. O
único texto novo é de workflow (quem criou, estado "aberto aguardando o
dono"), não fiscal.

## Perguntas abertas

1. Texto exato da tela de confirmação ao final de `/adicionar/compromisso`.
2. O campo "nota de origem" (vínculo opcional com documento existente):
   qual é o widget de busca/seleção hoje dentro de `/adicionar/pagamento`
   (autocomplete, lista, tela própria)? Se for tela própria, precisa de uma
   variante restrita ao escopo de documentos visíveis para aquele
   colaborador quando a visibilidade é restrita.
3. Confirmar com `cto-obra`: ao desligar a bifurcação de data, o componente
   de formulário é literalmente o mesmo React component com uma prop a
   menos, ou já ficou decidido que é um componente duplicado? Não muda o
   que a tela mostra, mas muda o que deve ser descrito como "reaproveitado"
   vs. "novo" no Gate 1.
