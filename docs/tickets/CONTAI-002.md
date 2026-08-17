# CONTAI-002 — Autenticação real (entrar e sair do app)

## Tipo e Prioridade
enabler — **P0** — bloqueador de deploy. Sem isto o app publicado é
inutilizável: criar usuário no dashboard do Supabase e injetar sessão no
`localStorage` pelo DevTools do celular não sobrevive ao uso real.

## Dor de Origem
Relato 003 (2026-08-09): *"criar um ticket para login e criação de nova obra"*.
Fato técnico que a motivou: RLS está ligada em toda tabela (`0001_init.sql`),
o app exige sessão e **não existe tela de login**. Em desenvolvimento isso é
suprido por `supabase/seed.sql` (usuário `mateus@contai.local`); em produção
não há seed.

## User Story
Como dono da obra, no canteiro, de celular, quero entrar no app com o meu
e-mail e continuar logado entre visitas, para registrar uma nota sem passar
pelo dashboard do Supabase.

## Critérios de Aceite
1. [x] **Mock APROVADO pelo Mateus em 2026-08-10** —
       `design/mocks/CONTAI-002.html`, 7 telas, 375px, uma mão: login,
       digitação do código, código inválido/expirado, volta à rota pedida,
       "sem sessão" ≠ "banco fora", sessão caída no meio do formulário, e
       conta/sair
2. [x] Login por **código de 6 dígitos no e-mail** (`signInWithOtp` +
       `verifyOtp` do Supabase Auth), sem senha e **sem magic link**.
       **Decisão do Mateus, 2026-08-10**: o app pode virar nativo, e link em
       e-mail abre no navegador padrão — quem entra é a aba, não o app. O
       código é digitado dentro do app que pediu, então a sessão nasce onde
       tem de nascer. Mesmo padrão do `surf-forecast`
       (`src/lib/auth/actions.ts`, `src/components/email-code-form.tsx`).
       Campo com `inputMode="numeric"` e `autoComplete="one-time-code"` para o
       sistema oferecer o código colado de uma vez.
       **`shouldCreateUser: false`** — o login nunca cria conta: a base guarda
       CPF, CNO e as notas da obra, e conta de terceiro não tem o que fazer ali
3. [x] A sessão persiste entre aberturas do app — fechar e reabrir o PWA não
       pede login de novo
4. [x] Rota pedida sem sessão → redireciona para o login e **volta para a rota
       pedida** depois de entrar (o deep link do lembrete do Google Calendar,
       US-002, não pode cair na home)
5. [x] Erro "sem sessão" é distinguível em tela do erro "banco fora" — hoje os
       dois viram a mesma tela (ligado a CONTAI-006)
6. [x] Existe logout, e ele limpa a sessão
7. [x] E2E afirma o **estado gravado, não a tela**: cliente sem sessão não lê
       nenhuma linha de `obra`, `documento` ou `pagamento` — a RLS é a única
       guarda do acervo fiscal (CPF, CNO, notas)
8. [x] `supabase/seed.sql` deixa de ser o caminho de criação de usuário em
       produção; segue existindo só para dev/e2e

## Gate Fiscal (Contador)
**Não aplicável — este ticket não carrega regra fiscal.** A consulta ao
contador em 2026-08-09 (Q7–Q10) não produziu nenhuma exigência sobre
autenticação. Registro a única consequência fiscal indireta:

- **Se** a sessão cair no meio de um registro → o dado já digitado **não pode
  sumir em silêncio**: o documento que não é registrado no canteiro tende a
  não ser registrado nunca, e custo não comprovado não existe
  (IN SRF 84/2001 art. 17).

## Out of Scope
- Multiusuário / convidar o contador para ver a obra — não serve nenhuma das
  três metas hoje e alarga a superfície da RLS
- Senha, SSO, 2FA, recuperação de conta por outro canal
- Cadastro de obra e obra ativa — **CONTAI-003** (deploy conjunto, ver abaixo)

## Pre-mortem
1. ~~Magic link abre no navegador padrão e não no PWA instalado → ele "loga"
   numa aba e o app continua deslogado.~~ **Eliminado pela decisão de 2026-08-10**
   (critério 2): com código digitado no app, não existe link para abrir no
   lugar errado. Era o pre-mortem mais provável deste ticket, e a mitigação
   anterior ("testar no celular real") só detectava o problema, não o resolvia.
   Continua valendo testar no celular real antes de dar DONE
2. Sessão expira em silêncio no meio do formulário de documento → ele digita
   tudo e perde no "salvar". Mitigação: critério 5 + preservar o formulário
3. Login vira fricção diária no canteiro (código no e-mail toda vez) → ele para
   de registrar na hora. Mitigação: critério 3 é o critério que mais importa
   deste ticket
4. O e-mail com o código demora ou não chega, e ele está sem sinal bom no
   canteiro → não entra e não registra. Mitigação: critério 3 (sessão longa,
   para o login ser raro) — o código só aparece quando a sessão realmente
   caiu, não a cada visita

## Viabilidade (CTO)
- Supabase Auth com código de e-mail (`signInWithOtp` sem `emailRedirectTo` +
  `verifyOtp`); `@supabase/ssr` para sessão em Server Components (o app é
  Next.js 16 App Router). O template de e-mail do projeto precisa expor
  `{{ .Token }}` — por padrão o Supabase envia `{{ .ConfirmationURL }}`, e sem
  essa troca o e-mail chega com link em vez de código
- Referência pronta no `surf-forecast`: `src/lib/auth/actions.ts`,
  `src/components/email-code-form.tsx` e o E2E
  `e2e/playwright/auth-002-email-otp-code.spec.ts`
- Nada muda no schema. `auth.uid()` já é o default de `user_id` em todas as
  tabelas
- Complexidade: **S/M**

## Dependências
- **Bloqueado por**: mock aprovado (critério 1)
- **Bloqueia**: qualquer uso do app em produção
- **Deploy conjunto obrigatório com CONTAI-003**: sozinho, este ticket entrega
  um login que desemboca em `ObraAusenteError` — beco sem saída. Os dois são
  tickets separados (trabalho e teste independentes), mas **uma única release**

## Perguntas Abertas
- Nenhuma que bloqueie. O e-mail de login é o `mateus.barragana@gmail.com`
  (assumido; se for outro, só muda o dado do primeiro acesso)

## Teste do Canteiro
- Metas atendidas: nenhuma diretamente — é o que **destrava** as três em
  produção. Registro isso com honestidade: é infraestrutura, não valor fiscal
- Uma mão, com pressa: sim, se o critério 3 segurar (não pedir link toda vez)
- **Veredito: APROVADO** — condicionado a mock aprovado

---

## Gate 4 — Validação do PO (2026-08-16)

**Veredito: DONE COM RESSALVAS.** Nenhum critério volta ao Gate 1; nenhuma
correção de código é exigida por este gate. O que segura o valor deste ticket
não está no código — está em quatro passos de dashboard do Supabase, hoje
descritos só no `CLAUDE.md` e sem dono. Vira `CONTAI-013` (abaixo).

Estado verificado no gate: Gates 1–3 fechados (`2572c01`, `e492888`);
`npm run quality` com lint e typecheck limpos, 118/118 Vitest e 31/31
Playwright, sem skip.

### Critério por critério

| # | Critério | Veredito | Evidência |
|---|---|---|---|
| 1 | Mock aprovado em 2026-08-10 | **PASS** | `design/mocks/CONTAI-002.html`, 7 telas; aprovação registrada no próprio critério. Comparação tela a tela na seção seguinte |
| 2 | Código de 6 dígitos, sem senha e sem magic link, `shouldCreateUser: false` | **PASS** | `lib/sessao.ts` — `signInWithOtp({ shouldCreateUser: false })` sem `emailRedirectTo`, `verifyOtp({ type: "email" })`. Campo com `inputMode="numeric"` e `autoComplete="one-time-code"` (`app/_components/entrar.tsx`). E2E `e2e/entrar.spec.ts`: *"pede o código, aceita o código do e-mail e abre a obra"* (código lido do Mailpit, não fabricado), *"o campo do código pede teclado numérico e aceita o código colado sujo"*, *"e-mail sem conta recebe português, não o erro do GoTrue"* (prova o `shouldCreateUser: false`: o passo do código nem aparece). Template local com `{{ .Token }}` e sem `{{ .ConfirmationURL }}`: `supabase/templates/magic_link.html`; `otp_length = 6` em `supabase/config.toml`. **Em produção o template é passo de dashboard — ver ressalva R1** |
| 3 | Sessão persiste entre aberturas do app | **PASS (com ressalva R2)** | E2E `e2e/entrar.spec.ts`: *"a sessão sobrevive a fechar e reabrir o app"* — exige `expires` do cookie > 14 dias e reabre num `browser.newContext()` levando só cookie persistente. É a asserção que trava a regressão de "cookie de sessão", que passaria em qualquer teste de navegação e morreria no aparelho dele. Renovação pelo servidor em `proxy.ts` (`getUser()` → `Set-Cookie` a cada navegação), que é o que sobrevive ao ITP do Safari. **Não verificado no alvo real** — ver R2 |
| 4 | Rota pedida sem sessão volta para a rota pedida | **PASS** | `proxy.ts` monta `?destino=` no servidor (sem piscar a tela protegida); `destinoSeguro`/`urlDeEntrada` em `lib/auth.ts`. E2E: *"a rota pedida é retomada depois de entrar, com a query junto"* — entra por `/adicionar/documento?origem=agenda` e volta com a query, que é o caso do deep link do lembrete da agenda (US-002). E *"destino forjado para outro site é ignorado"*. Unit: `lib/auth.test.ts`, `describe("destinoSeguro")` — 5 casos, incluindo `//host`, `/\host` e caractere de controle |
| 5 | "Sem sessão" ≠ "banco fora" na tela | **PASS** | Dois comportamentos distintos, cada um E2E: sem sessão → `/entrar`, e o teste *"pede o código, aceita o código do e-mail e abre a obra"* afirma `toHaveCount(0)` no botão "Tentar de novo" — a tela errada não aparece. Banco fora → `e2e/ingestao.spec.ts`, *"estado de erro: banco fora, com saída"* (503 do PostgREST) mostra alerta + "Tentar de novo". No código: `EstadoErro` (`app/_components/ui.tsx`) ramifica em `sem_sessao` (chip âmbar "Sua sessão terminou" + botão Entrar) vs. erro genérico; `proxy.ts` **não** redireciona em `AuthRetryableFetchError`/5xx, justamente para banco fora não virar "entre de novo" |
| 6 | Existe logout e ele limpa a sessão | **PASS** | `sair()` com `scope: "local"` (`lib/sessao.ts`), botão na tela de conta (`app/conta/page.tsx`). E2E *"sair apaga a sessão deste aparelho"*: nenhum cookie com prefixo `contai-auth` sobra, e voltar a `/` devolve o login |
| 7 | E2E afirma o estado gravado: cliente sem sessão não lê `obra`, `documento` nem `pagamento` | **PASS** | `e2e/entrar.spec.ts`, describe *"a RLS é a guarda do acervo"* → *"cliente sem sessão não lê obra, documento nem pagamento"*. O teste primeiro prova que as três linhas existem **com** sessão (senão o vazio não provaria nada além de banco vazio), depois abre um client anônimo e exige `[]` nas três tabelas, e ainda exige erro no insert. Sem service key |
| 8 | `seed.sql` deixa de ser o caminho de criação de usuário em produção | **PASS** | `supabase/seed.sql`, cabeçalho: declara o critério 8, explica que a conta de produção se cria à mão no dashboard e que `db push` não leva o seed. `CLAUDE.md` repete o passo na seção "Antes do primeiro deploy". O seed segue existindo para dev/E2E, que é o que o critério pede |

Consequência fiscal registrada no Gate Fiscal (sessão que cai no meio do
registro não pode levar o formulário junto — IN SRF 84/2001 art. 17):
**atendida e provada**. `PortaoSessao` distingue "chegou sem sessão" (navega)
de "a sessão caiu com a tela montada" (sobreposto, sem navegar); os dois
formulários chamam `pedirReautenticacao` no erro de gravação
(`app/adicionar/pagamento/page.tsx:137`, `app/adicionar/documento/page.tsx:190`).
E2E *"o que foi digitado sobrevive à reautenticação e o registro entra no
banco"*: apaga os cookies no meio do preenchimento, reautentica pelo sobreposto,
confere os campos preservados **e a linha no Postgres com valor e data certos**.
O E2E cobre o formulário de pagamento; o de documento está ligado ao mesmo
hook e componente, verificado por leitura.

### Comparação com o mock aprovado (7 telas)

**Aprovação explícita do Mateus, 2026-08-16.** Perguntado se duas mudanças
feitas **depois** da aprovação do mock contam como divergência — (1) a sessão
sair do `localStorage` para **cookie via `@supabase/ssr` + `proxy.ts`** e (2) o
**botão de atalho de desenvolvimento** na tela `/entrar` —, ele respondeu
*"mocks ok"*. Registro com essa precisão: a resposta cobre **esses dois itens e
nada mais**. Nenhum outro mock foi aprovado nesse ato.

| Tela do mock | Implementação | Veredito |
|---|---|---|
| 1 · Entrar | `app/entrar/page.tsx` + `FluxoEntrar` — marca, campo de e-mail, dica do código, card do "por que login", botão "Enviar código" | **PASS**. Acréscimo: botão "Entrar como desenvolvimento", **aprovado em 2026-08-16** |
| 2 · Digitar o código | Mesmo conteúdo (envelope, "Digite o código", destino do e-mail, banner "você entra neste aparelho", card do spam com "Enviar de novo", "Trocar de e-mail? Voltar"). **Um campo único** em vez das 6 caixas do mock | **PASS**. A troca das 6 caixas por um campo serve a exigência do próprio mock ("o iOS/Android oferece o código do e-mail para colar de uma vez"): caixa por dígito quebra o colar inteiro. O mock se declara de fidelidade média ("avalie fluxo e conteúdo, não estética final"), e conteúdo e fluxo estão preservados. Aceito pelo PO, sem decisão pendente |
| 3 · Código não confere | Banner vermelho com o texto do mock, card "nada foi perdido", campo e botão continuam habilitados, "Enviar de novo" disponível | **PASS**. As duas saídas do mock existem, em posição diferente |
| 4 · Volta à rota pedida | Sem tela intermediária: `router.replace(destino)` direto | **PASS**. A tela 4 do mock é o jeito de demonstrar comportamento num protótipo estático; o comportamento é o requisito, e está provado no E2E. Inserir um passo de confirmação custaria um toque no canteiro |
| 5 · Sem sessão ≠ banco fora | `EstadoErro` — chip âmbar + "Entrar" vs. banner vermelho + "Tentar de novo" | **PASS** |
| 6 · Sessão caiu no formulário | `SobrepostoReautenticar` — mesmo banner âmbar e mesmo bloco verde "Nada foi perdido: anexo, valor e respostas dos checks fiscais estão guardados nesta tela", com o formulário montado atrás | **PASS** |
| 7 · Conta e sair | `app/conta/page.tsx`. **Divergência de texto**: o mock diz *"para voltar, você precisa do **link** no e-mail"*; o app diz **código** | **PASS, com pendência de ciência**. Aqui quem está desatualizado é o mock: ele foi aprovado em 2026-08-10 com texto da era do magic link, e a decisão do Mateus do **mesmo dia** (critério 2 deste ticket) trocou o link pelo código. Manter "link" na tela seria mentir sobre o mecanismo que o app tem. **Ação (designer, sem ticket): corrigir o texto da tela 7 do mock**, para o mock parar de contradizer o app aprovado |

Não foi encontrada nenhuma outra divergência.

### Os três pontos abertos, julgados

**1. "Não existe conta com esse e-mail no contai" permite enumerar e-mails —
muda ou fica? → FICA. E o risco real é outro.**

A mensagem neutra ("se existir conta, o código foi enviado") compraria pouco:
o que um enumerador ganha aqui é confirmar que um e-mail tem conta num app
pessoal de obra. E custaria caro no canteiro — o e-mail digitado errado com uma
mão só ficaria indistinguível de "o e-mail não chegou", e a saída seria esperar
o código que nunca vem.

O que o domínio aberto do plano Hobby realmente expõe **não é a enumeração, é a
fila de envio**: qualquer um com a URL pede código para o e-mail do Mateus até
estourar o limite do SMTP, e quem fica de fora do app é ele. Mensagem neutra
não muda uma vírgula disso. Quem muda é captcha (Attack Protection) + SMTP
próprio — que entram no `CONTAI-013`. Trocar o texto seria a mitigação que dá
sensação de segurança sem tocar no risco.

**2. Sourcemap do servidor com as credenciais de desenvolvimento → RESSALVA,
não FAIL de critério.** Confirmado: `contai-local-123` aparece em
`.next/server/chunks/ssr/*.js.map`, e o bundle do cliente (`.next/static/`)
está limpo. Não reprova critério nenhum — nenhum dos oito fala disso — e o dano
concreto é nulo por três motivos somados: (a) a string é a senha do usuário de
**seed local**, já publicada em texto em `supabase/seed.sql`, versionada neste
repositório; (b) sourcemap de servidor não é servido ao navegador — na Vercel
ele fica no bundle da função; (c) o atalho exige, em runtime,
`ehSupabaseLocal(NEXT_PUBLIC_SUPABASE_URL)` — em produção ele não roda nem se
alguém montar a chamada à mão. Registro e **não abro ticket**: seria trabalho
que não serve nenhuma das três metas e que não reduz exposição nenhuma
enquanto o `seed.sql` existir.

**3. O limite de 2 e-mails/hora do SMTP embutido reprovou a suíte → é problema
de PRODUÇÃO, não critério de aceite não atendido.** A suíte hoje passa 31/31
contra o Mailpit local, então nada aqui reprova o ticket. Mas a leitura
tranquilizadora ("é só do stack local") está errada e precisa ficar escrita: o
SMTP embutido do Supabase **entrega apenas para membros do time do projeto**.
Se `mateus.barragana@gmail.com` não for membro, o primeiro login em produção
não falha com erro — o código simplesmente nunca chega, e a tela fica dizendo
"veja o spam". É a falha silenciosa mais cara deste ticket: um P0 que entrega
zero, com todos os testes verdes. Vira o `CONTAI-013`, com o resto dos passos
de dashboard.

### Ressalvas registradas

- **R1 (bloqueante de release, não deste ticket) — os quatro passos de
  dashboard não têm dono.** Template Magic Link com `{{ .Token }}`, conta criada
  à mão com Auto Confirm, SMTP próprio, Site URL, mais o captcha do Attack
  Protection. Estão descritos no `CLAUDE.md` e **todos falham em silêncio**.
  Parágrafo em arquivo de contexto não é item de fila: vira **`CONTAI-013`**.
- **R2 (bloqueante do "DONE de verdade" do critério 3) — o alvo real nunca foi
  exercitado.** O pre-mortem 1 deste ticket exige, com todas as letras, *"testar
  no celular real antes de dar DONE"*, e isso não aconteceu — não há deploy.
  Agrava: **não existe manifest de PWA** (achado de 2026-08-16 no backlog), e no
  iOS o container do ícone na tela de início tem storage separado do Safari.
  Ou seja, o critério que este ticket chama de o que mais importa pode passar no
  Safari e falhar no modo de uso real. Vira **`CONTAI-014`** e uma pergunta ao
  Mateus sobre entrar na R1.
- **R3 (informativa) — `proxy.ts` faz uma chamada ao GoTrue por navegação.**
  É o preço consciente da sobrevivência ao ITP, e a alternativa mais barata é
  território do `cto-obra`. Registro para não ser redescoberto como surpresa
  quando o app estiver em rede ruim de canteiro.
- **R4 (dívida de ordem) — o E2E do login depende do formulário de pagamento.**
  O teste da tela 6 preenche `/adicionar/pagamento` campo a campo. `CONTAI-004`,
  `007` e `009` deveriam ter vindo antes e mexem nessa área: quando mexerem,
  quebra um teste de **login**, e o sintoma vai parecer regressão de
  autenticação. Anotado no backlog.

### O que volta ao Gate 1

**Nada.** Nenhum critério reprovou, nenhuma divergência de mock exige código.
Tudo que falta é configuração de produção (`CONTAI-013`), verificação no
aparelho real (`CONTAI-014` + deploy) e um ajuste de texto no arquivo do mock
(designer).

### Lembrete de release

Continua valendo o que o ticket já dizia: **deploy conjunto obrigatório com o
CONTAI-003** (feito). Sozinho, este login desemboca em `ObraAusenteError`.
