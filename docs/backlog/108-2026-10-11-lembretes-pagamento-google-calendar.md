# Relato — 2026-10-11 — lembretes de pagamento (5d/2d/dia) via Google Calendar

## Origem (relato)

Mateus pediu lembrete automático de pagamento agendado:

> "se eu tenho um pagamento agendado para hoje e ele é PIX ou boleto eu
> recebo uma msg me lembrando sobre este pagamento com 5 dias de
> antecedência, depois 2 dias, depois no dia"

Pedido inicial foi WhatsApp. Avaliado o custo de infra (Business API,
verificação Meta, templates pré-aprovados) contra o canal já **decidido**
no `CLAUDE.md` (seção Stack, 2026-08-07: "Lembretes: Google Calendar API")
e nunca implementado. Mateus decidiu:

> "vamos então no Google Calendar"

## Dor extraída

Pagamento agendado (PIX/boleto) não tem lembrete nenhum fora do app — o
Mateus só sabe que venceu hoje se abrir a tela. Risco é esquecer um
pagamento agendado, não um problema de documentação ou apuração.

## Classificação

**Conveniência operacional — não é obrigação fiscal, não é fricção de
processo dentro do app.** É gestão de caixa (não esquecer de pagar), não
apuração. Ver seção de override abaixo antes de ler a prioridade.

## ⚠️ Override explícito do filtro das três metas

Este requisito **não serve nenhuma das três metas do produto** (documento
hábil / relatórios anuais / acervo que sobrevive à decadência). É
conveniência de não esquecer de pagar — gestão de caixa.

Isto já foi avaliado e cortado antes: `docs/tickets/CONTAI-019.md`, seção
"Out of Scope":

> "Lembrete no Google Calendar." P2 com recomendação de corte: *"não pagar
> juros" é gestão de caixa e não serve nenhuma das três metas.* ⚠️ Parte
> desse raciocínio assumia uso só no canteiro, premissa que caiu em 18/08;
> **reavaliado sob a régua nova e mantido**, agora pelo argumento das
> metas.

A razão do corte original continua válida em abstrato — o PO levantou essa
tensão com o Mateus **antes** de prosseguir. A decisão dele foi seguir
mesmo assim:

**Isto não é "o filtro mudou" — é o Mateus usando a prerrogativa dele de
pedir algo que conscientemente não serve às três metas.** Registra-se o
pedido e a decisão dele de prosseguir, sem reinterpretar o filtro de
escopo do PO para caber o requisito. O corte do `CONTAI-019` permanece
correto para quem chegar a esse ticket depois; este relato é uma exceção
nomeada, não uma reversão da doutrina.

## Escopo fechado nesta conversa (não reabrir)

- **Só `compromisso`** com `meio` PIX ou boleto e `situacao='aberto'`.
  Cartão fica de fora — vai pela fatura (tela própria de "Confirmar
  vínculos"/alocação); lembrete de calendário não serve a esse fluxo.
- **3 lembretes por evento**: 5 dias antes, 2 dias antes, no dia — via
  `reminders.overrides` do próprio evento do Google Calendar. É **1 evento
  por compromisso com 3 offsets de lembrete**, não 3 eventos.
- **Sincronização com o ciclo de vida do `compromisso`**:
  - criar o evento quando o compromisso nasce aberto (PIX/boleto);
  - atualizar quando a data prevista muda (fluxo já existente de "mudou a
    data"/`CONTAI-073`);
  - remover (ou marcar) o evento quando o compromisso é quitado ou
    cancelado — senão fica lembrete fantasma de pagamento já resolvido.
- **Autenticação**: OAuth2 do Google Calendar, autorizado uma vez pelo
  Mateus; token armazenado (onde/como é pergunta para o `cto-obra` no
  `/tickets-req`, não decidida aqui). Setup do projeto no Google Cloud
  Console é passo de dashboard do Mateus, fora do código — mesmo padrão já
  usado para o Google Drive do `CONTAI-011` e os passos de dashboard do
  Supabase no `CLAUDE.md`.

## User story

**Como** o Mateus, gerenciando a obra em casa, sentado, com os
compromissos de pagamento já cadastrados no app,
**quando** um `compromisso` com `meio` PIX ou boleto nasce com
`situacao='aberto'`,
**eu quero** um evento no meu Google Calendar com lembretes em 5 dias
antes, 2 dias antes e no dia do vencimento,
**para que** eu não dependa de abrir o app para lembrar que um pagamento
está chegando, e para que o lembrete desapareça quando o pagamento for
resolvido (sem lembrete fantasma de algo já pago ou cancelado).

### Critérios de aceite (verificáveis)

1. Todo `compromisso` criado com `meio` PIX ou boleto e
   `situacao='aberto'` gera um evento no Google Calendar do Mateus com
   `reminders.overrides` contendo exatamente 3 entradas: 5 dias antes, 2
   dias antes, no dia.
2. `compromisso` com `meio` cartão **não** gera evento nenhum.
3. Quando a data prevista do compromisso muda (fluxo do `CONTAI-073`), o
   evento existente é atualizado para a nova data — não cria um segundo
   evento.
4. Quando o compromisso é marcado como quitado ou cancelado, o evento
   correspondente é removido (ou marcado de forma que pare de alertar) do
   Google Calendar — não existe estado em que um compromisso resolvido
   ainda tenha lembrete pendente no calendário.
5. Sem autorização OAuth2 concedida pelo Mateus, nenhuma chamada ao
   Google Calendar é feita e o app continua funcionando normalmente para
   todo o resto (criação/edição de compromisso não trava por falta de
   integração).

## Perguntas em aberto (para `/tickets-req`, não bloqueiam este registro)

- Onde/como armazenar o token OAuth (nova tabela? criptografia?) —
  `cto-obra`.
- O que fazer se a chamada ao Google Calendar API falhar numa escrita
  (criar/atualizar/remover evento): retry, fila, ou pendência visível ao
  Mateus? — `cto-obra`.
- Se um lembrete perdido (compromisso criado e a chamada ao Calendar
  falhou) precisa de reconciliação/retry em segundo plano, ou fica
  "melhor esforço, sem garantia"? — `cto-obra`.
- Formato exato do texto do evento/popup (favorecido, valor, o quê
  aparece) — `designer`/`po` no `/tickets-req`.

Nenhuma pergunta de esclarecimento ao Mateus sobre o requisito em si: as
decisões de canal, exclusão de cartão e os 3 offsets já estão fechadas por
ele nesta conversa.

## O que fica de fora, e por quê

- **WhatsApp como canal** — avaliado e descartado pelo custo de infra
  (Business API, verificação Meta, templates pré-aprovados) frente ao
  Google Calendar, que já era a decisão de stack de 2026-08-07.
- **Cartão no lembrete** — vai pela fatura, que já tem fluxo próprio de
  confirmação de vínculo; lembrete de calendário duplicaria um controle
  que já existe noutro lugar.
- **Gestão de cronograma de obra, orçamento vs. realizado, comunicação
  com empreiteiro** — fora de escopo do produto, reafirmado por
  disciplina, não aplicável aqui além do lembrete de pagamento em si.
- **Mudar o filtro de escopo do PO** — não é o que aconteceu aqui; o
  filtro continua valendo para requisitos futuros. Este é um override
  pontual e consciente do dono do produto, não uma reinterpretação da
  doutrina das três metas.

## Priorização

**P1.** Justificativa: não é fiscal (não há documento hábil, apuração
anual ou prazo de decadência em jogo — por isso não é P0), mas também não
é um "nice to have" qualquer de backlog frio — é conveniência real,
pedida explicitamente pelo dono do produto, com decisão de escopo já
fechada (canal, exclusão de cartão, offsets) e impacto direto no caso real
que motivou o pedido (risco de atraso de pagamento PIX/boleto). Fica acima
de P2 porque o Mateus já investiu a conversa fechando escopo — sinal de
que quer isso na próxima fila, não "algum dia".
