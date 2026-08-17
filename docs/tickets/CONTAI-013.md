# CONTAI-013 — Configuração de produção do login (runbook + prova no alvo real)

## Tipo e Prioridade

chore de infraestrutura — **P0 de deploy**.

**NÃO entra na fila de implementação da R1.** Entra onde sempre estiveram "push
do repo", "conectar a Vercel" e o `CONTAI-012`: **não é escopo de release, é
condição para produção existir**. Não bloqueia a implementação de 004, 007, 009
nem 005; **bloqueia o deploy**.

- **Gate 0 (mock)**: **não se aplica** — nenhuma tela nova, com o captcha fora
  (ver critério 8 e `CONTAI-015`).
- **Gate Fiscal**: **sem impacto fiscal** (ver seção).

## Dor de Origem

Backlog, Gate 4 do CONTAI-002 (2026-08-16), ressalva R1:

> "O SMTP embutido do Supabase manda 2 e-mails por hora e **só entrega para
> membros do time do projeto**. Se o Gmail do Mateus não for membro, o primeiro
> login em produção não dá erro — o código simplesmente **nunca chega**, com os
> 31 testes verdes. É a falha silenciosa mais cara do CONTAI-002: **um P0 que
> entrega zero**."

> "Hoje isso existe só como parágrafo no `CLAUDE.md` — e **parágrafo em arquivo
> de contexto não tem dono nem fila**."

Dor de fundo: **D13** do Relato 003 (*"não existe login"*, **P0 bloqueador de
deploy**). O CONTAI-002 fechou o código dela e deixou viva a metade que não é
código.

## User Story

Como dono da obra, quero que o primeiro login no app publicado funcione no meu
celular, com o meu e-mail, para que a release que já está pronta e testada não
morra numa configuração que ninguém tem como enxergar lendo o código.

## Isto é ticket ou runbook? — as duas coisas, e a separação é o produto

**Ticket agora**: tem dono, posição na fila e relação de bloqueio com o deploy —
três coisas que um parágrafo no `CLAUDE.md` não tem, e é por isso que ele falhou
até aqui.

**Runbook para sempre**: a configuração precisa sobreviver ao ticket. Projeto
Supabase recriado, plano trocado, SMTP expirado, chave rotacionada — tudo isso
acontece depois do DONE.

Daí a regra que estrutura os critérios: **a entrega deste ticket não são os
cliques.** Cliques não são verificáveis e apodrecem em silêncio. A entrega é
(1) um runbook versionado, (2) **uma prova executada no alvo real**, (3) um
detector de regressão proporcional ao dano.

**Como se prova config de dashboard**: com **um login de produção completo**, num
aparelho/container que nunca logou, feito pelo Mateus com o e-mail dele. Uma
prova cobre os quatro itens de uma vez — se o código chega (SMTP + conta com Auto
Confirm), se é **código** e não link (template `{{ .Token }}`), e se a sessão
abre no domínio publicado. **Captura de tela do dashboard não serve**: envelhece
e não falha quando alguém desfaz.

**Como se detecta que alguém desfez**, em três camadas com o custo na mesa:

- **Barata e certa — o próprio uso.** Este app tem **um** usuário; qualquer
  regressão aparece na próxima vez que ele abrir. Aceitar isso é honesto: o dano
  é indisponibilidade, recuperável — não perda de acervo (a mesma distinção que
  separou o CONTAI-012 do CONTAI-011)
- **Média — repetição agendada.** Lembrete no Google Calendar a cada 90 dias:
  *"repetir o login de aparelho limpo"*. É o único jeito de descobrir **antes**
  de precisar
- **Cara e recomendada pelo CTO — verificação declarativa por script.** [Likely]
  a Management API do Supabase (`GET /v1/projects/{ref}/config/auth`, com
  personal access token) expõe template, SMTP e Site URL. Um
  `scripts/verificar-login-producao.ts` afirma: template contém `{{ .Token }}` e
  **não** contém `{{ .ConfirmationURL }}`; SMTP externo habilitado; Site URL de
  produção. Isso pega **três das quatro falhas silenciosas antes de qualquer
  e-mail existir**. ⚠️ **Confirmar o contrato do endpoint antes de escrever isto
  como critério "com teste"** — está marcado [Likely], não verificado

**O elo que não fecha por código**: "chegou código e não link" exige ler a caixa
de entrada. **Exceção**: se o SMTP próprio for provedor com API de mensagens
enviadas (Resend, Postmark), o script lê a última mensagem e afirma os 6 dígitos
no corpo — aí o loop fecha. Com SMTP "burro" (Gmail SMTP), o elo fica manual — e
já tem dono: a prova no aparelho real do `CONTAI-014`.

## Critérios de Aceite

1. [ ] `docs/runbooks/deploy-producao.md` versionado, um passo por item, cada um
   com: **o que configurar**, **como conferir** e **o que quebra em silêncio se
   estiver errado**. O `CLAUDE.md` passa a **apontar** para o runbook em vez de
   descrever os passos
2. [ ] **SMTP próprio** configurado, com provedor, remetente e limite anotados no
   runbook. Critério de saída: **o limite não é 2/hora** e a entrega **não
   depende de o destinatário ser membro do time do projeto**
3. [ ] **Conta do Mateus criada à mão** no dashboard, com **Auto Confirm**. O
   `seed.sql` não é o caminho de produção (critério 8 do CONTAI-002, já PASS)
4. [ ] **Template de e-mail** (o **Magic Link** — é o que `signInWithOtp` dispara
   para usuário já existente) com `{{ .Token }}` e **sem**
   `{{ .ConfirmationURL }}`. O HTML de `supabase/templates/magic_link.html`
   **não sai deste repositório sozinho**: aplicá-lo no dashboard é passo do
   runbook
5. [ ] **Site URL — verificar antes se ainda tem função.** Depois da troca de
   magic link por código, o app **não passa `emailRedirectTo`** (confirmado no
   Gate 4 do CONTAI-002). Se nenhum fluxo depender de redirect, **o item sai do
   ticket** em vez de virar passo de cargo cult. Decidir com o `cto-obra` e
   **registrar a decisão no runbook nos dois casos**
6. [ ] **`scripts/verificar-login-producao.ts`**, rodável como
   `npm run smoke:producao`, afirmando o que a Management API expuser (item 2, 4
   e 5). ⚠️ Se o contrato do endpoint não sustentar, o critério degrada para
   "conferência manual documentada no runbook" — e isso é registrado, não
   silenciado
7. [ ] **A prova**: o Mateus entra no app publicado, do celular dele, com o
   e-mail dele, num container que nunca logou, e o código chega em **≤2
   minutos**. Data e hora registradas neste ticket. **Sem esta prova o ticket não
   fecha** — nenhum outro critério prova sozinho que o e-mail sai do Supabase e
   chega no Gmail
8. [ ] **O captcha NÃO faz parte deste ticket** — virou **`CONTAI-015`**, por
   decisão do Mateus em 2026-08-17. Motivo técnico na seção abaixo
9. [ ] Lembrete de **90 dias** no Google Calendar: *"repetir o login de aparelho
   limpo"*
10. [ ] **Executar no mesmo deploy de preview do `CONTAI-014`** — não faz sentido
    gastar dois deploys para duas provas que precisam do mesmo alvo

## Por que o captcha saiu deste ticket

[Certain quanto ao mecanismo] Com o captcha habilitado no Attack Protection, o
GoTrue passa a **exigir** token de captcha em toda chamada de auth:
`signInWithOtp` **sem** `options.captchaToken` volta erro.

Logo, **ligar a chave no dashboard sem shipar o widget derruba 100% dos logins**
— inclusive o do único usuário. E o CI não pega: os 31 testes Playwright rodam
contra o stack local, com captcha desligado.

É a **mesma classe de falha que criou este ticket**, reproduzida por quem tenta
fechá-lo. O captcha não é o quinto item de um checklist de dashboard: é código,
tem tela, tem Gate 0 e tem decisão de E2E. Está no **`CONTAI-015`**.

## Gate Fiscal (Contador)

**Sem impacto fiscal.** Não toca documento, valor, data, nem produz saída para
declaração. Registrado assim em vez de inventar regra.

Consequência indireta que vale nomear e **não** é regra fiscal: sem login não há
registro, e sem registro nenhuma das três metas anda — mas isso é
disponibilidade.

## Out of Scope

- **Conectar o projeto à Vercel** — item de infraestrutura próprio, já na fila
- **Manter o projeto Supabase acordado** — `CONTAI-012`
- **Captcha** — `CONTAI-015`
- **Monitorar uptime do app** — outro problema, outra ferramenta
- **Qualquer coisa de acervo** — `CONTAI-011`
- **Segundo usuário / convidar o contador para ver a obra** — cortado no Relato
  003; alargaria a superfície da RLS sem servir as três metas

## Pre-mortem

1. **Os cliques são feitos e ninguém escreve o runbook.** Um ano depois —
   projeto recriado, plano trocado, SMTP expirado — não existe registro de qual
   era a configuração certa, e o Mateus refaz por tentativa e erro com uma nota
   na mão. **É o desfecho mais provável, e é por isso que o artefato do ticket é
   o runbook e não os cliques**
2. **Ligar o captcha "de brinde" e derrubar o login com os 31 testes verdes** —
   a falha silenciosa que este ticket existe para matar, reencenada por quem o
   fecha. **Mitigação**: critério 8
3. **A prova é feita no navegador do Mac "para ir mais rápido"** e o Gmail no
   celular nunca é exercitado. A falha aparece no canteiro, com a nota na mão e
   sem plano B. **Mitigação**: o critério 7 fixa os três — **aparelho, e-mail e
   pessoa**

## Viabilidade (CTO)

- **Complexidade: S + S** (runbook + script). **S no relógio, M no risco**: o
  trabalho é de minutos e o modo de falha é silencioso
- ⚠️ **Dívida criada**: o personal access token da Management API é a **segunda
  credencial poderosa do projeto** (a primeira será a service role do
  `CONTAI-011`). Roda **local, nunca em CI, nunca versionado** — mesma disciplina
  do critério 9 do 011
- **Regressão**: config de dashboard só muda por mão humana, então drift é raro.
  O script roda como passo do runbook de deploy, **não como cron** — depois da
  lição do CONTAI-011, não se pendura um relógio em free tier para vigiar outro

## Dependências

- **Bloqueado por**: existir um deploy (Vercel conectada). **Não depende de
  nenhum ticket de código**
- **Bloqueia**: o **deploy da R1**
- **Par de execução**: `CONTAI-014` (prova no aparelho real), mesmo deploy de
  preview
- **Relacionado**: `CONTAI-015` (captcha), que se entrar muda o critério 8

## Perguntas Abertas

1. **O Site URL ainda tem função depois da troca para OTP?** (critério 5)
2. **Qual provedor de SMTP e em que domínio?** Remetente em domínio próprio reduz
   spam; remetente genérico aumenta — e **o e-mail que não chega é a falha que
   este ticket existe para matar**
3. A Management API expõe mesmo template e Site URL para leitura? (critério 6)

## Teste do Canteiro

- **Metas atendidas**: nenhuma diretamente — é o que **destrava** as três em
  produção. Mesma honestidade registrada no CONTAI-002: é infraestrutura, não
  valor fiscal
- Uma mão, com pressa: **o teste é literalmente esse** — o critério 7 exige que o
  primeiro login aconteça no celular, com uma mão, com o Gmail dele
- **Veredito: APROVADO — P0 de deploy**, com o captcha fora do escopo
