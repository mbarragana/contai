# Corrigir CNO ausente na nota, depois que o prestador reemite com o dado — 2026-10-22

## Relato

Citação literal do Mateus: *"a nota fiscal que recebi não constava CNO da obra,
solicitei e eles me enviaram, mas não consigo adicionar uma nova nota com a
razão adição de CNO."*

Caso real: nota fiscal recebida sem o CNO da obra impresso
(`notaTrazCno = false` no cadastro, resposta `nao_traz` na pergunta "Qual CNO
está impresso nesta nota?"). O Mateus pediu ao prestador uma nova emissão com
o CNO, recebeu, mas não encontrou nenhuma forma de atualizar o registro já
existente pra refletir isso.

## Dor extraída

Fricção de processo: o Mateus fez exatamente o que o produto pede quando uma
nota chega sem CNO (cobrar o prestador) e, do lado do prestador, o problema já
está resolvido — ele tem a nota reemitida na mão. O produto não tem onde
registrar essa resolução. A pendência de cobrança (lista "notas sem CNO")
nunca fecha sozinha, e a aferição INSS daquela obra específica fica
permanentemente incompleta por um dado que já existe, só não tem onde entrar.

## Investigação técnica (confirmada em código nesta sessão)

- Campo/gate: `Documento.cnoReferenciado`/`notaTrazCno` (`lib/types.ts:186-208`),
  pergunta na captura "Qual CNO está impresso nesta nota?"
  (`app/(captura)/adicionar/documento/page.tsx:1988-1989`), 3 respostas:
  `desta_obra`, `outra_obra` (bloqueia o registro), `nao_traz` (salva com
  pendência âmbar).
- Nenhuma das 5 telas de correção existentes toca o campo: `corrigir/numero`,
  `corrigir/valor`, `corrigir/retencao`, `corrigir/emitente`,
  `corrigir/classificacao` — zero ocorrências de "cno" em qualquer uma.
- O ponto de entrada único (`/documento/[id]/documento-novo`, `CONTAI-088`) só
  oferece `numero`/`valor`/`retencao` como opções de "o que mudou"
  (`CorrecaoDoPacote`, `lib/gestao/pacote-correcao.ts:24`) — CNO não está na
  lista.
- Caso-irmão já resolvido: o `CONTAI-085` resolveu exatamente este padrão
  (prestadora reemite a nota, agora com um dado novo) pra número/série, mas
  nunca foi estendido pra CNO. O Out of Scope do `CONTAI-085` nem menciona
  CNO.
- A lista fechada de corrigibilidade
  (`docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` §1) não
  contempla `cnoReferenciado`/`notaTrazCno` porque esses campos só nasceram um
  mês depois (`CONTAI-007`, migration 0015, 2026-09-20). Nenhum parecer
  posterior estendeu a lista. **Precisa de Gate Fiscal novo.**
- Impacto fiscal hoje: pendência âmbar informativa
  (`lib/fiscal/resumo.ts:891-915`), texto `CONSEQUENCIA_CNO_DA_NOTA`/
  `CNO_NAO_ALCANCA_O_CUSTO` (`lib/fiscal/obra.ts:255-269`). Não bloqueia
  nenhuma das 3 saídas anuais (`podeGerarRelatorioAnual`,
  `lib/fiscal/compromisso.ts:365-398` não lê esse campo) — só a posição da
  aferição INSS daquela obra fica incompleta enquanto a pendência não fecha.

## Distinção que o Gate Fiscal precisa aplicar (não confundir)

`outra_obra` é doutrina **diferente**: `lib/types.ts:205-206` documenta que
"CNO de outra obra" é bloqueio de entrada de propósito, "erro sem conserto
depois da emissão". O caso do Mateus não é esse — ele tem `nao_traz` (sem CNO)
virando `desta_obra` (CNO desta obra, agora impresso): é a correção de um
campo que ERA genuinamente desconhecido/ausente na nota original, não um erro
de identificação de obra. A doutrina de bloqueio definitivo de `outra_obra`
não é tocada por esta story e não deve ser confundida com ela no Gate Fiscal.

## Classificação

**P1 — fricção de processo, não P0.** Não bloqueia nenhuma das 3 saídas
anuais declaradas (discriminação, Pagamentos Efetuados, relatório de
declaração) — `podeGerarRelatorioAnual` nem lê o campo, então não perder isso
não custa imposto nem multa diretamente. Mas é P1 e não P2 porque: (a) trava
permanentemente uma pendência de cobrança que o próprio produto gera e nunca
fecha sem esta tela — pendência eterna é pior que ausência de pendência; (b)
degrada a posição da aferição INSS, que é uma das 3 saídas do sistema
explicitamente listadas no escopo (mesmo não sendo "relatório anual de
declaração", é saída oficial do produto); (c) o Mateus fez exatamente o
processo correto (cobrou o prestador) e o produto não tem onde aceitar o
resultado — é a mesma classe de dor que motivou o `CONTAI-085`, já tratada
como P1/P2 tratável naquele ticket para número/série.

## User Story (preliminar)

Como dono da obra, sentado em casa, revisando o detalhe de uma nota com
pendência de CNO, quando eu receber do prestador a reemissão com o CNO da
obra impresso, quero corrigir o registro já existente para refletir que a
nota agora traz o CNO desta obra, anexando a nota reemitida, para que a
pendência de cobrança feche e a aferição INSS daquela nota passe a contar
corretamente.

## Critérios de aceite (preliminares)

1. Documento com `notaTrazCno = false` (resposta `nao_traz`) ganha, no ponto de
   entrada único de correção (`/documento/[id]/documento-novo`), uma 4ª opção
   de "o que mudou" equivalente a "recebi a nota com o CNO" — verificável:
   `CorrecaoDoPacote` passa a listar essa opção quando e só quando
   `notaTrazCno === false`.
2. Confirmar essa correção exige anexo da nota reemitida (mesmo padrão
   condicional por motivo já usado em `086`/`087`/`088`) e grava
   `notaTrazCno = true` + `cnoReferenciado` preenchido com o CNO informado —
   verificável lendo o documento depois da correção salva.
3. A correção fica rastreada em `revisao` com motivo próprio (não reaproveita
   o motivo de número/valor/retenção) — verificável lendo a tabela `revisao`
   depois da correção.
4. A pendência âmbar "nota sem CNO" (`lib/fiscal/resumo.ts:891-915`) deixa de
   listar esse documento depois da correção — verificável comparando o resumo
   de pendências antes/depois.
5. Documento com `notaTrazCno = null` (pergunta nunca feita) ou
   `notaTrazCno = true`/`outra_obra` **não** ganha essa opção — ela só existe
   para o estado `nao_traz`. `outra_obra` continua sem rota de correção
   (doutrina de bloqueio definitivo intocada).

## Gate Fiscal — flag para o `contador` no próximo `/tickets-req`

1. Ratificar explicitamente que `nao_traz → desta_obra` é corrigível (dado
   genuinamente ausente, agora obtido por reemissão) e que isso **não** reabre
   nem afrouxa a doutrina de `outra_obra` (bloqueio definitivo, "erro sem
   conserto") — são dois estados de origem diferentes, não dois pontos da
   mesma régua. Pedir fundamentação no próprio parecer de correção
   (`2026-08-18-correcao-de-documento-registrado.md`), com adendo que estenda
   a lista fechada de corrigibilidade (§1) para incluir
   `cnoReferenciado`/`notaTrazCno` — hoje ausente porque o campo nasceu um mês
   depois do parecer.
2. Confirmar se a correção precisa reabrir/recalcular alguma posição de
   aferição INSS já fechada (ex.: um relatório de posição gerado antes da
   correção), ou se a aferição é sempre calculada on-demand a partir do estado
   atual do documento (leitura do PO: on-demand, dado que
   `podeGerarRelatorioAnual` nem lê o campo — mas quem confirma é o
   `contador`).

## Perguntas abertas (máx. 3)

1. **Para o `contador`/`cto-obra`, não para o Mateus** — a doutrina de
   `outra_obra` (bloqueio definitivo) também deveria ganhar uma rota de
   correção quando o prestador reemite trocando o CNO errado pelo correto? O
   relato do Mateus não cobre esse caso (o dele é `nao_traz`, não
   `outra_obra`), e esta story deliberadamente não o resolve — mas é a
   pergunta natural que vem a seguir, e vale decidir aqui se fica fora de
   escopo por doutrina (erro sem conserto, intencional) ou se é só lacuna não
   pedida ainda.
2. O anexo exigido na correção é sempre a nota fiscal reemitida inteira (novo
   XML/PDF), ou o produto deveria aceitar uma complementar/carta de correção
   quando a legislação do município permitir isso em vez de reemissão total?
   Isso é pergunta de regra fiscal, não de produto — encaminhar ao `contador`
   junto com o Gate Fiscal acima, antes do `/tickets-req` fechar a tela.
3. Confirmar com o Mateus: a nota reemitida que ele já tem em mãos está pronta
   para anexar agora, ou esta story deve esperar a tela existir para ele
   cobrar o anexo depois? (Não trava o requisito, só ajuda priorizar a fila —
   resposta curta.)

## Out of scope explícito

- Qualquer mudança na doutrina de `outra_obra` (bloqueio definitivo na
  entrada) — fica para a pergunta 1 acima, não decidida nesta story.
- Recalcular retroativamente relatórios de posição de aferição já gerados
  antes da correção — pendente de resposta do `contador` (Gate Fiscal item 2);
  por ora a leitura é que não existe "relatório congelado" a recalcular.
- Fundir esta correção com número/valor/retenção no mesmo ato do
  `documento-novo` — o `CONTAI-088` já decidiu não fundir regimes de
  consequência fiscal distintos (`CONTAI-021`); CNO ganha sua própria opção,
  não um campo dentro de outra.
- Gestão de cronograma, orçamento de engenharia ou comunicação com o
  prestador (cobrar a reemissão em si) — fora de escopo declarado do produto;
  o produto só registra o resultado depois que o Mateus já cobrou por fora.
