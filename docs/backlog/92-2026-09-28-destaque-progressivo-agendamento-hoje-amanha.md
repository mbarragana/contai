# Relato processado — 2026-09-28 — destaque progressivo do agendamento antes do vencimento

**Origem**: pergunta do Mateus sobre se o app notifica ou destaca compromissos
perto do vencimento, seguida de investigação de código e escolha entre duas
soluções apresentadas.

## Dor extraída

> "hoje o app só reage a agendamento (...) DEPOIS que ele vence"

`chipDoAgendado` (`lib/fiscal/compromisso.ts:436-450`) devolve
`{ texto: "Agendado", forte: false }` para **qualquer** compromisso aberto
dentro do prazo — o mesmo texto e o mesmo peso visual para o que vence daqui a
30 dias e para o que vence amanhã. Só muda (`forte: true`, texto de urgência
"Venceu em DD/MM/AAAA · N dia(s) sem resposta") no dia seguinte ao vencimento,
via `ehVencidoSemResposta`. `porPrioridadeDoAgendamento`
(`compromisso.ts:604-618`) tem a mesma lacuna na ordenação: promove vencido
para o topo, mas entre os não vencidos ordena só por data mais próxima —
"vence amanhã" e "vence em 3 semanas" pesam igual na fila.

Não existe notificação ativa nenhuma (push, e-mail, Google Calendar): o item
"Lembretes: Google Calendar API" está na decisão de stack do `CLAUDE.md` mas
nunca foi implementado — confirmado por grep no repo inteiro, zero ocorrência
de integração real.

O gap real: nada chama atenção para o pagamento que vence hoje ou amanhã até
ele já estar atrasado. E o cenário de uso aqui é gestão em casa (revisar a
agenda com calma), não checagem constante do celular — a régua do "Teste do
Canteiro" não se aplica a esta tela.

## Duas soluções levantadas, uma escolhida

- (a) lembrete via Google Calendar (empurrar evento pro calendário do Mateus
  no ato de agendar) — depende de OAuth com o Google, escopo maior de
  integração.
- (b) destaque progressivo **dentro do próprio app** — hoje/amanhã ganham peso
  visual antes de vencer, não só depois. Reaproveita a lógica de data que já
  existe (`chipDoAgendado`, `porPrioridadeDoAgendamento`); precisa de um estado
  novo além do binário vencido/não vencido.

**Mateus escolheu (b) agora**: *"vamos implementar a opção b sobre os
pagamentos agendados que falamos agora pouco"*.

## Classificação de prioridade

**P1 — fricção de processo.** Não é obrigação fiscal: nenhum documento fica
sem tratamento fiscal e nenhuma apuração (discriminação, Pagamentos
Efetuados, aferição INSS) é afetada por isto — o compromisso continua não
sendo pagamento, e o bloqueio de relatório anual por "vencido sem resposta"
(parecer `2026-08-18-compromisso-versus-pagamento.md`, ADENDO §A) já existe e
não muda aqui. O que esta dor evita é atraso evitável (perder o pagamento na
data certa por falta de destaque prévio) — dói, mas dá para viver sem, e não
gera multa nem imposto por si só. Classificação do relato (P1) confirmada, não
corrigida.

## User story

**Persona**: o dono da obra em casa, sentado, revisando a Agenda/Home com
calma (cenário principal de gestão — não captura no canteiro).

**Gatilho**: existe pelo menos um compromisso aberto cuja `dataPrevista` cai
dentro da janela de destaque (hoje/amanhã, a definir — ver pergunta 1) e ainda
não venceu.

**Ação do sistema**: o item ganha um estado visual intermediário — mais peso
que "Agendado" comum, sem usar o texto nem o peso do vencido — tanto no chip
quanto na posição da lista.

**Resultado esperado**: o Mateus enxerga, sem abrir cada item, quais
compromissos vencem no curtíssimo prazo, antes de eles virarem atraso.

**Critério de aceite (esqueleto verificável, a fechar depois das perguntas
abaixo)**:
1. Um compromisso aberto com `dataPrevista` = hoje ou = amanhã (`hojeIso + 1`)
   recebe do estado novo um texto e/ou peso visual diferentes tanto de
   "Agendado" (não urgente) quanto do vencido (`forte`/"Venceu em...") — nunca
   reaproveita o texto nem o peso de nenhum dos dois estados existentes.
2. Um compromisso aberto com `dataPrevista` fora da janela (ex.: daqui a 30
   dias) continua devolvendo exatamente o que devolve hoje — comportamento
   atual não regride para o caso comum.
3. Na ordenação da lista, um compromisso na janela de destaque aparece antes
   de qualquer compromisso não vencido fora da janela, e depois de todo
   compromisso vencido — sem alterar a posição relativa entre vencidos
   (regra de `porPrioridadeDoAgendamento` para vencidos fica intocada).
4. Verificação automatizável por teste unitário direto em
   `chipDoAgendado`/`porPrioridadeDoAgendamento` (ou nas funções que os
   sucederem), sem precisar de E2E — é lógica pura de data, como o resto do
   arquivo já é.
5. Nenhum novo estado usa matiz (vermelho/verde): a régua vigente, confirmada
   no `CONTAI-072`, escala por peso (vazado → semi → preenchido, ou
   equivalente), nunca por cor, porque nenhum dinheiro saiu da conta em
   nenhum dos três estados.

## Filtro de escopo

**Dentro**: lógica de data e destaque visual dentro do app (`chipDoAgendado`,
`porPrioridadeDoAgendamento`, e os campos que a home/`/compromisso`/`/despesas`
já leem a partir deles).

**Fora, explicitamente** — é a opção (a), não escolhida agora:
- Notificação push.
- E-mail.
- Integração com Google Calendar (o item de stack existe no `CLAUDE.md` mas
  segue não implementado; isto não é o ticket que o implementa).

Não serve a nenhuma das três metas do produto de forma direta (não é
documento hábil, não é saída anual, não é acervo) — é fricção de processo
pura, releva o "Teste do Canteiro" não se aplicar (é tela de gestão) e cabe
como P1 por reduzir atraso evitável, não por obrigação fiscal. Registrado
para transparência do corte, não como veto: o Mateus já decidiu que entra.

## Perguntas de esclarecimento (até resposta, não vira ticket)

1. **Quais janelas de destaque?** Só hoje/amanhã (2 estados: não urgente /
   urgente-pré-vencimento / vencido), ou também "vence em N dias" (ex.: 2, 3,
   7) com mais de um degrau de peso? O `chipDoAgendado` hoje devolve `forte`
   como booleano — se forem 2+ degraus antes do vencimento, o tipo de retorno
   precisa mudar de binário para algo com mais estados, o que é decisão de
   contrato de função, não só de texto.
2. **Escopo de telas**: isto vale só na Home (`montarAgendaDaHome`) e na lista
   completa de `/compromisso`, ou também em `/despesas`
   (`agendamentosPorDocumento`, que já reusa `chipDoAgendado` para notas com
   compromisso vinculado desde o `CONTAI-072`)? Os três consumidores hoje
   (`app/_components/agendado.tsx`, `app/_components/gestao.tsx`,
   `app/(gestao)/compromisso/page.tsx`, `lib/fiscal/despesas.ts`) leem a
   mesma fonte — decidir "só a Home" versus "todo lugar que lê o chip" muda o
   raio do ticket.
3. **Cor/matiz do estado intermediário**: a régua vigente (confirmada no
   `CONTAI-072`) é "nunca vermelho, só peso, porque nenhum dinheiro saiu da
   conta". Um terceiro estado (hoje/amanhã) segue escalando só por peso
   (ex.: âmbar vazado → âmbar semi-preenchido → âmbar preenchido), ou abre
   exceção para um tom diferente já que agora são 3 estados em vez de 2? Isto
   é desenho, mas decide se o ticket pede mock novo do `designer` ou reaproveita
   token de cor existente.

## Encaminhamento

Não vira ticket ainda — falta resposta do Mateus às 3 perguntas acima.
Depois de respondidas, segue para `/tickets-req` (Gate Fiscal deve ser rápido:
sanity check do `contador` de que isto não move nenhum campo de apuração, já
adiantado aqui) e para o `designer` só se a pergunta 3 abrir estado de cor
novo — do contrário é troca de texto/peso em slots existentes, nível 2/3 como
o `CONTAI-072`.
