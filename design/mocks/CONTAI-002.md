# CONTAI-002 — spec do mock
Nível: 1 (HTML navegável)   Cenário: captura (o login acontece na porta do canteiro) — telas 5 e 7 são de gestão   Arquivo: CONTAI-002.html
Telas: 7

## Telas e estados
- **Entrar** (`#s1`): formulário de e-mail; CTA "Enviar código". Sem loading, sem vazio, sem erro (o erro de e-mail inexistente não está no mock — ver Dúvidas).
- **Digitar o código** (`#s2`): 6 caixas de dígito (5 preenchidas + 1 vazia tracejada); CTA "Entrar", secundário "Enviar de novo", link "Voltar". Sem loading, sem vazio, sem erro (o erro é `#s3`).
- **Código não confere** (`#s3`): **erro** — 6 dígitos em vermelho + banner. Retry "Digitar de novo"; alternativa "Pedir um código novo". Sem loading/vazio/sucesso.
- **Entrando… (volta à rota pedida)** (`#s4`): sucesso — mostra a rota original e a origem (deep link). CTA "Continuar". Sem loading explícito/vazio/erro.
- **Sem sessão ≠ banco fora** (`#s5`): dois estados de erro lado a lado — (a) "Sua sessão terminou", retry "Entrar"; (b) "Sem conexão com o servidor", retry "Tentar de novo". Sem loading/vazio/sucesso.
- **Sessão caiu no meio do registro** (`#s6`): erro com preservação de rascunho. Retry "Entrar e continuar". Sem loading/vazio/sucesso.
- **Sua conta** (`#s7`): sucesso — resumo da conta + bloco "Sair". CTAs "Sair da conta" / "Voltar". Sem loading/vazio/erro.

## Campos
- `email` — e-mail — obrigatório — o e-mail tem que existir (signup desligado, `shouldCreateUser: false`) — SEM DEFAULT
- `codigo` — 6 dígitos numéricos — obrigatório — expira; **pedir um novo invalida o anterior**; teclado numérico e autofill de OTP do iOS/Android — SEM DEFAULT
- Rascunho preservado em `#s6` (não são campos desta tela, são do formulário de registro que sobreviveu): `anexo`, `emitente`, `valor`, `nota_no_seu_cpf`

## Textos com consequência fiscal
- "O app guarda CPF, CNO e as notas da obra. O login é o que separa esses dados de qualquer outra pessoa — não é formalidade." — `#s1`, card
- "Você recebe um **código de 6 dígitos** por e-mail e digita aqui. Sem senha para lembrar no meio do canteiro." — `#s1`
- "**Você entra neste aparelho, sempre.** O código é digitado aqui dentro — não existe link que possa abrir no navegador errado e deixar o app deslogado." — `#s2`, banner verde
- "Não chegou em 1 minuto? Veja o spam antes de pedir outro — pedir de novo invalida o código anterior." — `#s2`
- "**Esse código não vale.** Ou foi digitado errado, ou expirou, ou você pediu outro depois — pedir um novo invalida o anterior." — `#s3`, banner vermelho
- "Nada foi perdido: seus documentos e pagamentos continuam guardados. É só digitar de novo." — `#s3`
- "**Sua sessão terminou.**" / "Entre de novo para ver a obra." — `#s5`, chip + consequência âmbar
- "**Sem conexão com o servidor**" / "Não foi possível falar com o servidor." — `#s5`, chip + consequência vermelha
- "**Sua sessão terminou enquanto você preenchia.** Entre de novo — o que você digitou continua aqui." — `#s6`, banner âmbar
- "Nada foi perdido: anexo, valor e respostas dos checks fiscais estão guardados nesta tela." — `#s6`, bloco verde tracejado
- "Perder o formulário no "salvar" é o jeito mais rápido de ensinar a não registrar no canteiro — e custo não comprovado não existe na declaração." — `#s6`
- "Você continua logado entre visitas ao canteiro — fechar o app não pede link de novo. Sair só é necessário se este aparelho deixar de ser seu." — `#s7`
- "Sair apaga a sessão deste aparelho. Para voltar, você precisa do link no e-mail — e sem sinal no canteiro isso pode significar não registrar a nota hoje." — `#s7`, consequência vermelha ⚠️ ver Dúvidas

## Navegação
- `#s1` → `#s2` — "Enviar código"
- `#s2` → `#s4` — "Entrar" (código correto); `#s2` → `#s2` — "Enviar de novo"; `#s2` → `#s1` — "Voltar" (trocar de e-mail)
- `#s2` → `#s3` — código errado/expirado (transição implícita: não há gatilho no mock)
- `#s3` → `#s2` — "Digitar de novo"; `#s3` → `#s1` — "Pedir um código novo"
- `#s4` → rota originalmente pedida — "Continuar" (no mock vai para `#s5`)
- `#s5` → `#s1` — "Entrar" (sessão terminou); `#s5` → `#s5` — "Tentar de novo" (servidor fora); `#s5` → `#s6` — "Ver o caso do formulário"
- `#s6` → `#s1` — "Entrar e continuar" (volta ao formulário preservado depois do login)
- `#s7` → `#s1` — "Sair da conta"; `#s7` → `#s5` — "Voltar"

## Decisões de design visíveis no mock
- **Código de 6 dígitos, nunca link** (decisão 2026-08-10): link abre no navegador padrão e deixa o PWA deslogado. O banner de `#s2` diz isso na cara do usuário.
- **Sem sessão e servidor fora são dois erros diferentes** com ações diferentes — "Tentar de novo" nunca resolve falta de sessão; o mock coloca os dois lado a lado justamente para fixar a distinção.
- **O rascunho do formulário sobrevive à queda de sessão** (`#s6`), anexo e respostas dos checks fiscais incluídos — perder o formulário ensina a não registrar.
- **Deep link volta à rota pedida** (`#s4`), não à home: quem chega por lembrete de boleto vem para aquele boleto.
- Sessão é longa por decisão explícita ("continua logado entre visitas"); "Sair" é tratado como ação destrutiva, com consequência escrita e botão `danger-ghost`.

## Dúvidas
- ⚠️ `#s7` diz "Para voltar, você precisa do **link no e-mail**" — **contradiz** o resto do mock e a decisão de 2026-08-10 (código de 6 dígitos, sem link). Resíduo da versão anterior. Texto correto tem que vir do `po`; não implementar como está.
- `#s1` não tem estado de erro para "não existe conta com esse e-mail" — cenário real, já que signup está desligado. Texto ausente no mock.
- Não há estado de **limite de envio de e-mail** (o SMTP embutido do Supabase manda 2/hora e já reprovou uma suíte) nem de rate limit de tentativas do código. Ambos acontecem no canteiro; texto não existe no mock.
- `#s2` não mostra estado de loading entre "Entrar" e o resultado, nem contador para "Enviar de novo".
- Não há transição desenhada de `#s2` para `#s3` (qual gatilho, quantas tentativas antes de invalidar).
