# Relato — CONTAI-077 em produção: topo ainda sobrepõe, agendamento reconfirmado — 2026-09-28

## Origem

Mateus testou o CONTAI-077 (fix do scroll no rodapé de ação) em produção,
mesma nota real usada no relato anterior ("Ilhamix Concreto Ltda", NF de
serviço nº 1543). Relatou dois pontos num só fôlego: *"o problema do scroll
foi resolvido em baixo, mas não em cima. Tem o mesmo problema na parte de
cima"* e *"os agendamentos não estão listados para selecionar"*.

Investigação ao vivo (browser real, produção) antes de responder — separa
isso em uma dor real nova e uma reconfirmação do que já tinha sido explicado.

## Esclarecimento, não dor — reconfirmação, não vira ticket

> *"os agendamentos não estão listados para selecionar"*

**Mesmo comportamento já explicado**, ver
`docs/backlog/94-2026-09-28-scroll-e-busca-nas-telas-de-ligar.md`, seção
"Esclarecimento, não dor". Reconfirmado ao vivo nesta sessão: a parcela
"Ilhamix Concreto Ltda, R$ 15.000,00, para 15/10/2026" continua "Agendado" na
Agenda — ainda não paga. `pagamentosCandidatos` só lista pagamentos JÁ
realizados (regime de caixa é a régua, a mesma que rege custo de aquisição no
IRPF). Quando a parcela for paga, o registro vira `Pagamento` de verdade e
passa a aparecer, sem mudança nenhuma no sistema. **Segunda vez que o mesmo
fato é perguntado na mesma janela de trabalho** — registrado aqui de novo só
para reforçar o ponteiro: `grep -rn "agendamentos não aparecem\|regime de
caixa" docs/backlog/` acha as duas entradas antes de gastar rodada de agente
outra vez.

## Dor [P1] — o card sticky do topo sobrepõe a lista durante o scroll

> *"o problema do scroll foi resolvido em baixo, mas não em cima. Tem o mesmo
> problema na parte de cima"*

**Confirmado, reproduzido ao vivo**, mesma nota real, mesma tela. O card
`sticky top-0` "Falta ligar desta nota"
(`<Card className="sticky top-0 z-10 bg-soft">`) sobrepõe linhas da lista de
candidatos durante o scroll — rolando a lista, a linha "PIX · pago em
18/09/2026 · comprovante ✓" aparece cortada, nome do favorecido escondido
atrás do card fixo. Mecanismo idêntico ao que o `RodapeDeAcao` tinha embaixo
antes do CONTAI-077: sticky DENTRO do `<main overflow-y-auto>` sobrepõe
conteúdo que rola por baixo dele por definição — só que aqui é o topo, não o
rodapé.

**Não é bug novo — é dívida já nomeada.** O Out of Scope do CONTAI-077 dizia
explicitamente: *"O card `sticky top-0` ('Falta ligar desta nota') continua
sobrepondo linhas no TOPO durante o scroll — é cabeçalho de leitura,
comportamento convencional (sticky header), fora deste relato/ticket"*
(`docs/tickets/CONTAI-077.md`, Out of Scope e "Dívidas criadas" do Gate 2).
O Mateus, ao ver o comportamento em produção, pediu para corrigir agora — a
dívida deixa de ser aceita e vira requisito.

**Blast radius pequeno**: `grep -rn "sticky top-0" app` (excluindo testes) só
acha 2 ocorrências, as duas nas telas do par CONTAI-074/077/078:
- `app/(gestao)/documento/[id]/ligar/page.tsx:380`
- `app/(gestao)/pagamento/[id]/ligar/page.tsx:344`

Escopo bem menor que o CONTAI-077 (que tocou 22 telas via componente
compartilhado): aqui são só essas duas ocorrências pontuais do card, não um
componente genérico reusado em outro lugar — a checar no `/tickets-req`/Gate 2
do `cto-obra` se cabe resolver com o mesmo princípio de portal (tirar o card
de dentro da área que rola) ou algo mais simples, dado o escopo menor.

## Classificação de prioridade

**P1** — mesma classe do CONTAI-077: fricção de processo real (não é
obrigação fiscal — nenhum campo, texto ou regra fiscal envolvida), mas sobre
uma feature recém-entregue que continua não escalando para lista longa,
exatamente o padrão já usado para priorizar o CONTAI-077. Confirma o
enquadramento: não vira P2/"depois" só porque já foi nomeada como dívida
aceita uma vez — o próprio dono do produto revogou essa aceitação ao ver o
comportamento ao vivo.

## User story

### US — o card "Falta ligar desta nota" não pode esconder linhas da lista durante o scroll

Como Mateus, gerenciando em casa e revisando uma lista longa de candidatos
para ligar a um documento ou a um pagamento, quando eu rolo a lista **em
qualquer ponto do meio do scroll**, eu preciso continuar vendo o conteúdo de
cada linha sem parte dela escondida atrás do card fixo do topo, para poder
ler favorecido/valor/data/comprovante antes de marcar — do mesmo jeito que já
vale para o rodapé desde o CONTAI-077.

**Critérios de aceite:**
1. Em `/documento/[id]/ligar`, com uma lista de candidatos longa o bastante
   para exigir scroll (reproduzível com a nota real de 24 candidatos), nenhuma
   linha fica parcial ou totalmente coberta pelo card `sticky top-0` ("Falta
   ligar desta nota") em nenhum ponto intermediário do scroll.
2. O mesmo critério vale, sem exceção, para `/pagamento/[id]/ligar` — mesma
   verificação, mesmo padrão (`app/(gestao)/pagamento/[id]/ligar/page.tsx:344`).
3. A correção cobre as duas ocorrências localizadas por
   `grep -rn "sticky top-0" app` (excluindo testes) — não uma correção pontual
   em só uma das duas telas que deixa a outra quebrada.
4. Não regride o comportamento de leitura do card em si (ele continua visível
   e fixo quando não há sobreposição — ex.: no topo do scroll, repouso
   inicial); o que muda é só deixar de cobrir linha da lista durante o meio do
   scroll.
5. Reaproveita ou adapta o padrão de correção do CONTAI-077 (portal para fora
   da área rolável) se o `cto-obra` avaliar que serve aqui — decisão técnica
   dele no `/tickets-req`, não travada neste requisito.
6. Não regride nenhuma outra tela que usa o mesmo `Card sticky top-0` (checar
   se o padrão aparece em mais algum lugar antes de mudar comportamento
   compartilhado — hoje o grep só acha as duas).

## Perguntas abertas

Nenhuma. O `cto-obra` já tem o diagnóstico e o padrão de correção do
CONTAI-077 para reaproveitar ou adaptar no `/tickets-req` — não há decisão de
produto pendente aqui, só decisão técnica de como aplicar o mesmo princípio a
um card diferente do rodapé.

## Fora de escopo

Nada novo além do já registrado em `94-2026-09-28-scroll-e-busca-nas-telas-de-ligar.md`:
"vincular a nota antes de pagar" continua fora, pelo mesmo motivo (mudança de
modelo com implicação fiscal a validar com o `contador`, não ajuste de UI).

## Cortes

Nenhum corte novo — este relato é puramente a continuação de uma dívida já
nomeada; não introduziu escopo candidato a corte.

## Próximo passo

Sem impacto fiscal (UI/scroll sobre dado que já existe corretamente) — não
precisa de gate do `contador`. Pronto para `/tickets-req` abrir ticket
(candidato a `CONTAI-079`, a confirmar no momento da abertura).
