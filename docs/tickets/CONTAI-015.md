# CONTAI-015 — Captcha na tela de login

## Tipo e Prioridade

feature (segurança) — **P2**.

**Origem da separação**: o captcha estava listado como quinto item de dashboard
do `CONTAI-013`. O `po` mostrou que **isso está errado** e recomendou cortar para
P2. **Decisão do Mateus em 2026-08-17: não cortar — vira ticket próprio, este.**

**NÃO entra na R1.** Não captura dado, não é bloqueador de deploy, e o risco que
mitiga fica muito menor depois do `CONTAI-013`.

- **Gate 0 (mock)**: **OBRIGATÓRIO — PENDENTE.** Widget de terceiro em tela é
  mudança visível ao usuário.
- **Gate Fiscal**: **sem impacto fiscal**.

## Por que não é configuração de dashboard — o fato que criou este ticket

[Certain quanto ao mecanismo] Com o captcha habilitado no Attack Protection do
Supabase, o GoTrue passa a **exigir** um token de captcha em **toda** chamada de
auth. `signInWithOtp` **sem** `options.captchaToken` volta erro.

Consequência direta: **ligar a chave no dashboard sem shipar o widget derruba
100% dos logins** — inclusive o do único usuário do sistema.

E o CI **não pega**: os 31 testes Playwright rodam contra o stack local, com
captcha desligado. Ou seja, é possível quebrar o login inteiro em produção com a
suíte toda verde.

**É a mesma classe de falha silenciosa que criou o `CONTAI-013`** — configuração
invisível ao código, que falha sem erro. Pô-la como item de checklist teria
reencenado, dentro do ticket que existe para matá-la, exatamente a doença que ele
trata.

## Dor de Origem

Gate 4 do CONTAI-002 (2026-08-16) e relatório do agente do Vercel (2026-08-16):

> "No plano Hobby da Vercel o domínio de produção **não é protegível**. Qualquer
> um com a URL pode pedir código de login para um e-mail qualquer e **queimar o
> limite de envio**, travando o login do Mateus."

E a ressalva do próprio Gate 4:

> "`shouldCreateUser: false` é parâmetro de **cliente** — com a publishable key
> no bundle, qualquer um monta um `POST /auth/v1/otp` com `create_user: true` e
> cria conta no projeto, queimando a cota do free tier de que o acervo depende."

⚠️ **Nota importante sobre a segunda dor**: ela **não se resolve com captcha
sozinha**. Quem a resolve é desligar *"Allow new users to sign up"* no dashboard
— um clique, e `classificarFalhaAuth` já trata `signup_disabled`. **Esse clique
pertence ao `CONTAI-013`, não a este ticket**, e deve ser feito
independentemente da decisão sobre o captcha.

## User Story

Como dono da obra, quero que um terceiro que descubra a URL do app não consiga
queimar minha cota de e-mail nem criar contas no meu projeto, para que o login
esteja disponível quando eu precisar registrar uma nota no canteiro.

## O contra-argumento, registrado porque o PO recomendou o corte

O `po` recomendou **cortar para P2 condicionado a evidência de abuso**, e o
raciocínio fica aqui para a decisão ser revisitável:

> "O risco que ele mitiga — queimar a cota de envio e trancar o login do Mateus —
> some quase todo com o critério 3 do CONTAI-013: um SMTP próprio com cota mensal
> decente troca '2 e-mails por hora' por milhares por mês, e o Supabase já limita
> OTP por IP/hora. Pagar widget de terceiro + Gate 0 + furo de E2E para proteger
> um app de um usuário é caro para o que sobra."

**O Mateus decidiu manter como ticket próprio, em P2.** Este ticket existe, e
implementá-lo é decisão de quando — não de se.

## Critérios de Aceite

1. [ ] **Mock aprovado pelo Mateus.** Widget de terceiro ocupa espaço na tela de
   login mais protegida do produto, e o cenário é 375px com uma mão. O mock
   mostra: onde o widget entra, o que acontece enquanto ele carrega, e o que a
   tela diz quando ele **falha ao carregar** (rede ruim no canteiro)
2. [ ] Provedor escolhido e registrado no ticket, com a razão. Candidatos:
   **hCaptcha** e **Cloudflare Turnstile** (os dois suportados pelo Supabase).
   Critério de escolha declarado: menor fricção no celular, e **modo invisível**
   sempre que possível — desafio visual no canteiro, com uma mão, é o oposto da
   meta do produto
3. [ ] `options.captchaToken` passado em **todas** as chamadas de auth do app —
   não só `signInWithOtp`, mas `verifyOtp` e qualquer outra que o GoTrue passe a
   exigir. Um caminho esquecido = um caminho morto em produção
4. [ ] ⚠️ **A ordem de ativação é critério, não detalhe**: o widget vai a
   produção **antes** de a chave ser ligada no dashboard. Ligar primeiro derruba
   o login. O ticket documenta a ordem no runbook do `CONTAI-013`
5. [ ] **Decisão de E2E tomada e registrada**, entre as duas únicas saídas
   honestas:
   - **(a)** o stack local liga captcha em **modo de teste** (os dois provedores
     têm chaves de teste que sempre passam), e a suíte passa a cobrir o caminho
     de produção; **ou**
   - **(b)** a suíte continua sem captcha, e fica **escrito no ticket e no
     `CLAUDE.md`** que o E2E **não cobre** o caminho de produção do login.
   Não existe terceira via. Escolher (b) sem registrar é como este ticket vira a
   falha que ele foi criado para evitar
6. [ ] **Estado de falha do widget é tratado na tela.** Se o captcha não carregar
   — rede ruim, provedor fora, bloqueador —, o Mateus precisa ver **por que** não
   consegue entrar. Um botão desabilitado sem explicação, no canteiro, é
   indistinguível de app quebrado
7. [ ] As chaves do provedor: a **site key** é pública (vai no bundle, sem
   problema); a **secret key** vai **só no dashboard do Supabase**, nunca no
   repositório — que é público

## Gate Fiscal (Contador)

**Sem impacto fiscal.** Não toca documento, valor, data nem saída de declaração.

Consequência indireta, nomeada e **não** é regra: o captcha protege a
disponibilidade do login, e sem login não há registro. Mesma natureza do
`CONTAI-012` e do `CONTAI-013` — disponibilidade, não regra fiscal.

## Out of Scope

- **Desligar "Allow new users to sign up"** — é um clique, resolve a dor de
  criação de conta melhor que o captcha, e pertence ao **`CONTAI-013`**
- **Rate limiting próprio** — o Supabase já limita OTP por IP/hora
- **Proteger o domínio de produção** (Password Protection da Vercel) — add-on de
  plano Pro, decisão de custo do Mateus, não deste ticket
- **Captcha em qualquer outra tela** — só o login pede

## Pre-mortem

1. **A chave é ligada no dashboard antes de o widget subir** e o login some, com
   a suíte verde. **É o risco número um deste ticket e é a razão de ele
   existir.** **Mitigação**: critério 4
2. **O widget vira desafio visual em vez de invisível**, e o Mateus passa a
   resolver quebra-cabeça de semáforo com uma mão, com a nota na outra, no sol.
   Ele para de registrar. **Mitigação**: critério 2, modo invisível como
   requisito de escolha do provedor
3. **O E2E deixa de cobrir o login de produção e ninguém percebe** — a suíte
   continua verde e passa a testar um caminho que não existe mais em produção.
   **Mitigação**: critério 5, que obriga a escolha a ser explícita e escrita

## Viabilidade (CTO)

- **Modelo de dados**: nenhum
- **Arquivos prováveis**: `app/_components/entrar.tsx` (widget + token),
  `lib/sessao.ts` ou equivalente (repassar `captchaToken`), `e2e/` conforme a
  decisão do critério 5, `.env.example` (site key)
- **Complexidade: S no código, M no risco de ativação** — o trabalho é pequeno e
  a janela de erro derruba o produto inteiro
- **Dívida criada**: uma dependência de rede de terceiro no caminho crítico do
  login. Se o provedor cair, o Mateus não entra. É o custo que o critério 6 torna
  ao menos visível

## Dependências

- **Bloqueado por**: mock aprovado (Gate 0)
- **Relacionado**: `CONTAI-013` — o SMTP próprio dele **reduz muito** a dor que
  este ticket ataca, e o critério 4 daqui entra no runbook de lá
- **Bloqueia**: nada

## Perguntas Abertas

1. **hCaptcha ou Turnstile?** (critério 2)
2. **E2E: (a) ou (b) do critério 5?** É decisão do `cto-obra` com o Mateus, e ela
   muda o que a suíte significa dali em diante
3. Vale mesmo implementar, dado que o SMTP próprio do `CONTAI-013` já derruba a
   maior parte do risco? O `po` recomendou cortar; o Mateus decidiu manter como
   ticket. **Revisitável sem constrangimento** — é P2

## Teste do Canteiro

- **Metas atendidas**: nenhuma diretamente — protege a **disponibilidade** do
  login, que é pré-requisito das três
- Uma mão, com pressa: **é exatamente onde este ticket pode dar errado.** Captcha
  invisível: neutro. Captcha com desafio: **reprovado** — vira o atrito que
  devolve o Mateus para a planilha
- **Veredito: APROVADO como P2**, condicionado a mock aprovado e a captcha
  invisível. **Se o único provedor viável exigir desafio visual, o ticket volta
  ao PO** em vez de ir ao `/develop`
