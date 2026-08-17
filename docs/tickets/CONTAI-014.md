# CONTAI-014 — Manifest de PWA, `apple-touch-icon` e a prova no aparelho real

## Tipo e Prioridade

chore + verificação — **P1, DENTRO da R1** por decisão do Mateus (2026-08-16).

**Fundamento da admissão, e ele importa para não virar precedente solto**: entra
pela **mesma exceção que admitiu o CONTAI-009**, aberta no Gate 2 do CONTAI-003 —
*"critério de aceite de item da R1 que não foi cumprido volta como ticket da
R1"*. O critério 3 do CONTAI-002 é item da R1 e **não é verificável no modo de
uso real** sem o manifest. **Não é porta nova; é a porta que já estava aberta.**
A regra de admissão original — *captura irreversível no ato do registro* — segue
intacta e **não** foi invocada aqui.

- **Gate 0 (mock)**: **não se aplica como mock HTML** — substituído pelo critério
  1. Registrado como **substituição, não como equivalência**.
- **Gate Fiscal**: **sem impacto fiscal** (ver seção).

## Isto reabre o Gate 4 do CONTAI-002?

**Não. É critério deste ticket — e o Gate 4 do CONTAI-002 também não fica
limpo.**

Precedente já existente no projeto: o **critério 7 do CONTAI-001** (≤3
interações) foi **formalmente transferido** para a US-008 em vez de reabrir o
gate. Mesmo movimento aqui. Reabrir um Gate 4 fechado criaria um estado em que
nenhum item da R1 fecha e o gate deixa de significar coisa alguma.

O preço da transferência é **nominal e obrigatório**: a **R2 do CONTAI-002** fica
marcada como *"transferida para o CONTAI-014"*, **nunca como resolvida**, e o
CONTAI-002 fica registrado como **"DONE com ressalva aberta"** até este ticket
fechar (critério 8). Sem isso, a transferência vira o mecanismo pelo qual a
dívida some do radar — que é o que a regra de admissão da R1 existe para impedir.

## Dor de Origem

Backlog, achado de 2026-08-16, reprecificado de P2 para P1 no Gate 4 do
CONTAI-002:

> "Não há `app/manifest.ts` nem `apple-touch-icon`, e o `viewport` tem
> `maximumScale: 1`. 'Adicionar à Tela de Início' não garante modo standalone —
> e **o container do ícone no iOS tem storage separado do Safari**, então o
> critério 3 do CONTAI-002 pode passar no Safari e falhar no ícone, **que é o uso
> real**."

E a R2 do Gate 4 do CONTAI-002:

> "O pre-mortem 1 deste ticket exige, com todas as letras, *'testar no celular
> real antes de dar DONE'*, e **isso não aconteceu**."

Dor de fundo, do `CLAUDE.md`: o cenário primário é **celular, no canteiro, uma
mão livre**. Abrir o Safari, achar a aba certa e conferir a URL é atrito no exato
momento em que o Relato 001 já mostrou o comportamento de fuga — voltar para a
planilha.

## User Story

Como dono da obra, quero abrir o contai por um ícone na tela de início do
celular e cair direto na obra, sem barra de navegador e sem login toda vez, para
registrar a nota no canteiro em um toque em vez de procurar uma aba com a nota na
mão.

## Critérios de Aceite

1. [ ] **Gate 0 substituído**: não existe HTML que mocke o ícone na tela de
   início do iOS nem o modo standalone. No lugar, **aprovação explícita do
   Mateus** sobre **(a)** a arte do ícone e **(b)** o `short_name` que aparece
   embaixo dele (o iOS trunca por volta de 12 caracteres — "contai" resolve).
   **Uma mensagem, não um mock.** Registrado como **substituição, não
   equivalência** — mesmo cuidado do desvio de mock carimbado no Gate 2 do
   CONTAI-003
2. [ ] `app/manifest.ts` exportando `MetadataRoute.Manifest`, com
   `display: "standalone"`, `name`, `short_name`, `start_url: "/"`,
   `theme_color`, `background_color` e ícones 192/512 (com `purpose: "maskable"`
   para Android). **Convenção confirmada nos docs empacotados deste Next 16**
   (`node_modules/next/dist/docs/.../01-metadata/manifest.md`): é route handler
   especial, servido em `/manifest.webmanifest`. **Não há breaking change aqui** —
   a convenção é a mesma desde o 13.3
3. [ ] `app/apple-icon.png` (180×180) — a convenção de arquivo do Next gera o
   `<link rel="apple-touch-icon">` sozinho. Mais as metas
   `apple-mobile-web-app-capable` / `mobile-web-app-capable`. [Likely] o iOS só
   honra o `display` do manifest a partir de versões recentes; as duas coisas
   juntas custam uma linha
4. [ ] ⚠️ **`maximumScale: 1` sai do viewport — MAS NÃO SOZINHO.** É problema de
   acessibilidade (WCAG 1.4.4, bloqueia pinch-zoom) e [Likely] o iOS o ignora
   desde o iOS 10, ou seja, hoje ele só pune Android sem entregar o que promete.
   **A armadilha**: os inputs do app são `text-[15px]`
   (`app/_components/campos.tsx:58`), e **abaixo de 16px o Safari faz auto-zoom a
   cada foco de campo**. Remover o `maximumScale` **exige subir os inputs para
   16px no mesmo commit** — senão é um pulo de tela por campo, oito vezes por
   registro, no canteiro. Quem tratar isso como "apagar uma linha" reintroduz
   fricção exatamente no fluxo que o produto mais protege
5. [ ] **A prova no aparelho real** — feita **pelo Mateus**, no iPhone dele,
   contra um **deploy de preview** apontando para o Supabase de produção (**no
   mesmo deploy da prova do `CONTAI-013`**):
   - (a) "Adicionar à Tela de Início" põe o **ícone certo e o nome certo**
   - (b) abrir pelo ícone abre **sem a barra do Safari** (standalone de fato)
   - (c) o login por código funciona **dentro do container do ícone**: sair para
     o Mail buscar o código e voltar **não perde a tela**
   - (d) **fechar o app pelo multitarefa e reabrir pelo ícone não pede login de
     novo** — este é o **critério 3 do CONTAI-002 no modo de uso real**, e é o
     único jeito de verificá-lo
   - (e) abrir o formulário de registro e **acionar a câmera dentro do
     standalone**, sem salvar — prova que a captura funciona no container **sem
     sujar o acervo de produção com registro de teste**
6. [ ] **A prova diferida, e não dá para encurtar.** O critério 3 do CONTAI-002
   afirma sobrevivência de sessão por **mais de 14 dias**; nenhuma sessão de
   teste prova 14 dias. Aceite: lembretes no Google Calendar em **D+7 e D+21** —
   abrir pelo ícone sem ter aberto no meio e reportar se pediu login. Até o D+21
   responder, o critério 3 fica **provado por asserção de cookie no E2E e não
   provado no aparelho**, e o ticket diz isso com todas as letras em vez de dar
   por fechado
7. [ ] **Nenhuma tela vira beco sem saída em standalone**: sem a barra do Safari
   não existe botão Voltar do navegador. Cada rota que hoje depende dele precisa
   de saída dentro da própria tela. O critério é a **ausência de beco**, não uma
   contagem — o mapeamento é do `lead-engineer` na implementação
8. [ ] **A R2 do `CONTAI-002` é marcada como *transferida para o CONTAI-014***
   no arquivo dele, e o CONTAI-002 fica como **"DONE com ressalva aberta"** até
   este ticket fechar
9. [ ] **O CI afirma os artefatos** (E2E já roda em webkit / iPhone SE): GET em
   `/manifest.webmanifest` devolve 200 com `display: "standalone"`; cada ícone
   resolve 200; `<link rel="manifest">` e `<link rel="apple-touch-icon">` no
   head; e a meta viewport **não** contém `maximum-scale` — esta última trava a
   regressão do critério 4.
   ⚠️ **O que o CI NÃO prova, e é o que mais importa**: o container do ícone no
   iOS com cookie jar separado do Safari. Não é lacuna de ferramenta, é
   isolamento do iOS — [Likely] nenhuma emulação do Playwright exercita o storage
   do web app da tela de início. **O teste no aparelho real continua sendo a
   condição do DONE**

## Gate Fiscal (Contador)

**Sem impacto fiscal.** Não toca documento, valor, data nem saída de declaração.
Registrado assim em vez de inventar regra.

Uma consequência indireta que vale nomear e **não** é regra: o critério 4
(`maximumScale`) afeta a **legibilidade do acervo** — a meta 3 exige
"legibilidade verificada", e um app que proíbe dar zoom numa foto de nota
trabalha contra ela.

## Out of Scope

- **Notificação push** — não pedida; os lembretes da US-002 vão pelo Google
  Calendar
- **Funcionamento offline / service worker de cache** — outra classe de problema,
  e **perigosa aqui**: cache de página autenticada serve **dado fiscal velho com
  cara de atual**. Não entra sem parecer
- **Splash screens por tamanho de tela do iOS** — conveniência pura, backlog P2
- **Android / Play Store** — o alvo é o iPhone do Mateus
- **Ícone "bonito" / identidade visual** — o critério é **reconhecível na tela de
  início**, não marca

## Pre-mortem

1. **O app vira standalone e alguma tela fica sem saída** porque o Voltar do
   Safari sumiu — o Mateus fica preso e mata o app com a nota na mão. **É o risco
   mais provável deste ticket**, e ele **não aparece em nenhum teste que rode em
   navegador com barra**, que são todos os que existem hoje. **Mitigação**:
   critério 7 + prova 5(e)
2. **O container do ícone tem storage separado**: o primeiro login **dentro** do
   PWA vai pedir código de novo, mesmo tendo logado no Safari cinco minutos
   antes. **Isso é comportamento esperado e vai parecer defeito.**
   **Mitigação**: escrever isso no critério 5(c) **antes** de o Mateus testar —
   senão ele reporta bug e a prova vira discussão sobre o que é bug
3. **O iOS mata o app em segundo plano** enquanto ele está no Mail copiando o
   código — ou na câmera fotografando a nota — e a tela volta do zero. Se
   acontecer **no fluxo de registro**, o CONTAI-014 vira ticket de bug em cima do
   CONTAI-001, e é **muito melhor descobrir agora do que com 40 documentos
   registrados**. Provas 5(c) e 5(e) existem para forçar essa descoberta

## Viabilidade (CTO)

- **Modelo de dados**: nenhum
- **Arquivos**: `app/manifest.ts` (novo) · `app/apple-icon.png` (180×180) ·
  `public/icon-192.png` + `public/icon-512.png` · `app/layout.tsx` (viewport +
  metas) · `app/_components/campos.tsx` (inputs para 16px, ver critério 4) ·
  e2e do critério 9
- **Complexidade do código: XS.** **Complexidade da verificação: M**, e ela é
  calendário, não trabalho — depende de deploy e de dois lembretes com semanas de
  intervalo
- **Separação que o ticket exige**: a **parte de código** é independente e pode
  entrar em qualquer momento da R1; a **parte de verificação** não roda antes de
  existir deploy
- **Dívida**: verificar no aparelho que a navegação sobrevive sem o chrome do
  navegador. [Likely] o "Voltar" próprio dos fluxos é suficiente — confirmar no
  teste real (critério 7)

## Dependências

- **Bloqueado por**: aprovação do ícone e do `short_name` (critério 1);
  **deploy de preview** para os critérios 5 e 6
- **Bloqueia**: o **DONE de verdade do critério 3 do CONTAI-002**
- **Par de execução**: `CONTAI-013`, mesmo deploy de preview

## Perguntas Abertas

1. Qual arte de ícone? (uma imagem, uma resposta — critério 1)
2. Qual versão de iOS o aparelho do Mateus roda? Muda o quanto o manifest é
   honrado sozinho e o quanto a meta legada carrega o peso [Likely]

## Teste do Canteiro

- **Meta 1**: **move indiretamente, e é o ponto do ticket** — registrar no
  canteiro exige que o app abra em um toque a partir da tela de início. Abrir o
  Safari, achar a aba e conferir a URL é o atrito que devolve o Mateus para a
  planilha
- **Meta 2**: neutro
- **Meta 3**: **move um pouco** — o critério 4 destrava o zoom em foto de nota
- Uma mão, com pressa: **é o ticket que existe para o uso de uma mão**
- **Veredito: APROVADO — P1 dentro da R1**, com Gate 0 substituído por aprovação
  de ícone e nome
