# 112 — 2026-10-19 — CTA "Registrar pagamento" na confirmação do documento

## Dor

Citação literal do Mateus: *"quando eu adiciono um registro, deveriamos
adicionar um novo passo que é registrar pagamento, já na sequencia da nota
fiscal, porque agora por exemplo eu recebi a nota e já paguei e já cadastrei
tudo ao mesmo tempo, daí eu tive que cadastrar a nota, voltar ao inicio e
cadastrar o pagamento."*

Caso real recorrente: nota fiscal recebida e paga no mesmo ato. Hoje, depois
de cadastrar o documento, não existe caminho direto para registrar o
pagamento correspondente — é preciso voltar à Home e navegar de novo.

## Investigação técnica (verificada, com arquivo:linha)

1. **Hoje, depois de "Salvar" em `/adicionar/documento`**
   (`app/(captura)/adicionar/documento/page.tsx:976-1146`), a própria tela
   muda pra fase "salvo" e mostra uma tela de confirmação (componente
   `Registrado`, `app/_components/registrado.tsx:25-120`): banner de sucesso
   + card "Obra / **Próximo passo** / Custo". Quando não há pagamento já
   vinculado, o campo "Próximo passo" é **só texto, não clicável**:
   "registrar o pagamento quando ele acontecer"
   (`documento/page.tsx:1235-1244`). As únicas ações clicáveis da tela são
   "Corrigir a obra deste registro" e "Voltar ao início"
   (`registrado.tsx:99-117`, `href="/"`).
2. **O mecanismo pra fazer exatamente o que falta JÁ EXISTE e já funciona**,
   só nunca é oferecido nesse ponto: `/adicionar/pagamento?documento=<id>`
   (`app/(captura)/adicionar/pagamento/page.tsx:147-233`) herda
   favorecido/CNPJ da nota (campos não editáveis, com link "Corrigir na
   nota"), sugere o valor (saldo da nota, via `sugerirValorDaNota`,
   `app/_components/nota-de-origem.tsx:54-73`), e já cria o vínculo
   pagamento↔documento no salvar. Hoje só é acionado a partir de botões em
   `app/(gestao)/documento/[id]/page.tsx:357-365` ("Registrar o pagamento
   desta nota") e `documento/[id]/ligar/page.tsx:585` — ou seja, só quando o
   Mateus abre o documento já salvo pela gestão, nunca a partir da própria
   tela de confirmação do fluxo de captura.
3. **Única exceção hoje**: se a nota cai em quarentena (e nada mais falhou),
   o salvar pula a tela de confirmação e já cai direto em `/documento/[id]`
   — que por acaso já tem a CTA. É incidental, não desenho de produto pra
   esse fim.
4. **Precedente a não confundir**: `docs/tickets/CONTAI-018.md:116-117` e o
   hub `/adicionar` (`app/(captura)/adicionar/page.tsx:10-19`) registram que
   uma frase do tipo "a NF vincula depois" foi **removida de propósito**, por
   prometer comportamento que não existia — Documento e Pagamento são portas
   deliberadamente separadas no hub (decisão do Mateus, CONTAI-018). **Isto
   não é o mesmo caso**: o relato pede um CTA ATIVO e funcional (reaproveita
   mecanismo que já existe e já funciona) na tela de confirmação — não uma
   promessa passiva de vínculo automático. O Gate Fiscal/Passo 3 não devem
   vetar citando esse precedente por engano.
5. **Caso do cartão não está coberto pelo mesmo mecanismo**: compra no cartão
   usa herança por TEXTO (`texto-herdado.ts`, CONTAI-089), nunca
   `?documento=` (compra no cartão nunca pode herdar `documento_origem_id`,
   doutrina ADENDO 9). Se o Mateus pagou no cartão (não PIX/boleto), o
   caminho técnico é outro — ver pergunta 1 abaixo.
6. **Caminho A do CONTAI-018 ("já paguei esta nota") é outro mecanismo, não
   serve pra este caso**: ele busca pagamentos JÁ REGISTRADOS na obra pra
   ligar à nota nova (`documento/page.tsx`, estado `jaPaguei`, linhas
   787-793 e 896-949) — é o sentido inverso (documento→pagamento existente,
   não documento→pagamento novo). Quando não há candidato, a própria tela já
   diz "dá pra registrar depois de salvar a nota" — e é exatamente essa
   promessa que a tela de confirmação hoje não cumpre (só texto, sem botão).

## Classificação

**P1** — fricção de processo real e recorrente, citada ao vivo pelo Mateus.
Não é fiscal (não é P0): nenhuma regra de documentação hábil muda, é só
atalho de navegação pra um mecanismo que já existe e já funciona. Não é P2:
não é capricho, é o caso comum de obra (nota chega e já foi paga) ficando
sem caminho direto.

## User Story

Como Mateus, depois de cadastrar uma nota que ele já pagou, quero um botão
real na própria tela de confirmação pra registrar esse pagamento na hora —
com favorecido, CNPJ e valor sugerido já herdados da nota, e o vínculo já
criado ao salvar — para não precisar voltar à Home e navegar de novo até o
detalhe do documento só pra achar o mesmo link que eu já sei que existe lá.

## Critérios de aceite preliminares

1. [ ] Na tela de confirmação (`Registrado`, chamada a partir de
   `/adicionar/documento` em fase "salvo"), quando `fase.ligados === 0`
   (nenhum pagamento já vinculado nesse ato), o campo "Próximo passo" deixa
   de ser texto estático e vira (ou ganha ao lado) um botão real levando
   para `/adicionar/pagamento?documento=<id>`.
2. [ ] Quando `fase.ligados > 0` (já tem pagamento vinculado nesse ato), o
   comportamento atual (texto "nada pendente — N pagamento(s) ligado(s)")
   permanece inalterado — sem regressão do caso já coberto.
3. [ ] O botão reaproveita 100% o mecanismo já existente de
   `/adicionar/pagamento?documento=<id>` (herança de favorecido/CNPJ,
   sugestão de valor pelo saldo, criação do vínculo no salvar) — zero
   lógica nova de herança, zero mudança de schema.
4. [ ] As duas ações hoje existentes na tela de confirmação ("Corrigir a
   obra deste registro", "Voltar ao início") continuam presentes e
   funcionando — o botão novo se soma, não substitui nenhuma delas.
5. [ ] E2E novo cobrindo: salvar documento sem vínculo → botão aparece →
   clicar → cai em `/adicionar/pagamento?documento=<id>` com favorecido/CNPJ
   herdados e valor sugerido corretos.

## Perguntas abertas

1. **Caminho do cartão**: se o Mateus pagou a nota no cartão (não
   PIX/boleto), o mecanismo `?documento=` não serve — compra no cartão usa
   herança por texto (CONTAI-089), nunca `documento_origem_id` (ADENDO 9). A
   CTA nova oferece só "Registrar o pagamento" (PIX/boleto) ou também
   "Comprei no cartão" (herança por texto)? Decide o `cto-obra`/`designer`.
2. **Rótulo do botão** — trabalho do `designer`/`/design`, não decidido aqui.
3. **A CTA cobre também o caso `fase.vinculoFalhou`** (tentativa de vínculo
   automático que não deu certo) **ou só `ligados === 0`** (nunca houve
   tentativa)? Decide o `cto-obra`.

## Fora de escopo

- Reformular o Caminho A (CONTAI-018) pra criar pagamento inline dentro do
  próprio formulário do documento — alternativa mais cara, registrada mas
  não escolhida; o caminho via `?documento=` já existe e é mais barato.
- Reabrir a separação deliberada de portas no hub `/adicionar` (decisão
  fechada do CONTAI-018) — este relato não promete vínculo automático, só
  oferece um atalho ativo pra um fluxo que já existe.

## Próximo passo

`/tickets-req`, com as 3 perguntas acima endereçadas a `cto-obra`/`designer`
no Passo 3/4.
