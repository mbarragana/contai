# CONTAI-047 Captura (`/adicionar/*`) ganha casca de tela larga

## Tipo e Prioridade
chore/refactor de UI — **P1, fricção de processo**. Mesma família de dívida
dos `CONTAI-043`/`044`/`045`/`046` (dar tratamento de tela larga a algo que
nasceu só em 430px), mas de natureza diferente: aqueles moviam rota para
dentro do shell de gestão; este **mantém a rota em `(captura)`** e larga só a
casca — decisão técnica do `cto-obra`, ver "Fora de Escopo".

## Dor de Origem
O Mateus respondeu, em 2026-09-22, a pergunta que ficara em aberto desde o
pivô desktop-first do `CONTAI-039`: *"eu vou usar mais em casa do que no
canteiro"* já valia para a home (resolvido pelos `040`/`043`-`046`), mas as
telas de **captura** — `/adicionar/documento`, `/adicionar/pagamento`,
`/adicionar/compra-cartao` — ficaram de fora daquela rodada inteira (eram
"intocadas" por decisão explícita do `CONTAI-040`, comentário em
`app/(captura)/layout.tsx`). Ele viu `/adicionar/documento` **"esticada sem
nenhum aproveitamento de tela larga"** no uso real — hoje o formulário fica
confinado a uma coluna de 430px centralizada num monitor largo, o mesmo
sintoma que motivou a rejeição do `CONTAI-039` na home, só que nunca corrigido
aqui. Registrado em `CLAUDE.md` ("Cenários de uso — 2ª correção", bloco
"RESPONDIDA em 2026-09-22") e em
`docs/backlog/58-2026-09-22-captura-tela-larga-contai-047-048.md`.

Seam concreto já em produção: `app/_components/shell.tsx` (`MenuNovoRegistro`,
`CONTAI-040`) já oferece as 3 opções de registro a partir da sidebar/topbar em
telas largas — mas os `href`s continuam apontando para `/adicionar/documento`
etc., que hoje aterrissam na casca de 430px de sempre. Ou seja: mesmo quem
está gerenciando a obra em casa, sentado, e clica em "+ Novo registro" no
shell largo, cai numa coluna estreita centralizada — o mesmo defeito visual
que os `043`-`046` corrigiram para as telas de detalhe, só que nunca pago
para a captura.

## User Story
Como dono da obra registrando um documento, um pagamento ou uma compra no
cartão **em casa, sentado, num monitor largo** (cenário principal hoje,
segundo o próprio Mateus), quero que o formulário aproveite a largura da tela
— sem virar uma coluna de celular esticada no meio de um monitor — para não
sentir que uso o app de canteiro fora do canteiro. Quando o mesmo formulário
é aberto **do celular, no canteiro, com uma mão** (cenário eventual), quero
que continue exatamente como é hoje: rápido, em 430px, sem nada a mais para
ler ou navegar.

## Escopo e Critérios de Aceite — Gate 0 FECHADO em 2026-09-22
`design/mocks/captura-no-desktop-v1.md` + `.html` (`designer`). Os critérios
abaixo já refletem o mock — não há mais "valor a decidir no Gate 0" pendente
nesta lista; o que resta é o `cto-obra` confirmar que a implementação bate com
o spec no Gate 1, mesma régua dos `043`-`046`.

1. `app/(captura)/layout.tsx` ganha um segundo breakpoint largo além do piso
   de 430px. O número **muda em relação à sugestão original do `cto-obra`
   (720px)** porque o Gate 0 acrescentou o rail do critério 1a abaixo: a
   grade `form + rail` do mock cabe em **~940px**, colapsando para 1 coluna
   por volta de **~860-880px** (`.captura-grid` do mock). `documento/page.tsx`
   é o caso que define o teto do grupo; `pagamento/page.tsx` e
   `compra-cartao/page.tsx` (sem rail) não precisam da largura toda, mas
   herdam a mesma casca — não há breakpoint por página nesta rodada.
   **Não full-width**: o Gate 2 do `CONTAI-039` mediu que largura cheia é
   *menos* legível que uma coluna limitada, a mesma razão pela qual
   `ColunaDeDetalhe` (`043`-`046`) parou em 640px, não em 1280px.
   1a. **`documento/page.tsx` ganha o rail do mock (Decisões 2 e 3 do Gate
       0)**: coluna auxiliar à direita com (i) dropzone/preview do anexo —
       miniatura 52×52 + nome + tamanho + "Trocar arquivo", reposicionando o
       que hoje já existe no formulário, sem criar arquivo nem estado novo —
       (ii) o botão "🪄 Extrair dados da nota (beta)" logo abaixo do anexo em
       vez de no meio do formulário, mesmo componente, só de lugar — e (iii)
       um resumo **somente-leitura** do já afirmado (Tipo, Emitente, Valor,
       Nota no seu CPF?, CNO impresso), cada linha "ainda não respondido" em
       itálico até existir resposta, nada inferido. **Isto é reflow, não
       feature**: nenhum dos três elementos é novo, só muda de posição/
       tamanho na tela — por isso cabe no escopo deste ticket e não no
       `CONTAI-048` (ver "Fora de Escopo" e o ticket irmão para a fronteira
       exata). Abaixo do breakpoint largo, o rail sobe para cima do
       formulário (`grid-template-areas: "rail" "form"`), reproduzindo a
       ordem de hoje — decisão 5 do mock.
   1b. **Banners de consequência fiscal (quarentena, gate de retenção, CNO
       sem obra, vínculo) continuam inline, no mesmo card/pergunta de hoje —
       nunca migram para o rail.** O rail só espelha o que já foi confirmado;
       nunca é onde uma pendência aparece pela primeira vez (Decisão 4 do
       mock). Guarda de Gate 2, ao lado do critério 2 abaixo.
2. Dentro de `documento/page.tsx`, `pagamento/page.tsx` e
   `compra-cartao/page.tsx`: campos escalares curtos (datas, valor, número da
   nota, série, meio de pagamento) podem ir lado a lado (`lg:grid-cols-2`)
   acima do breakpoint largo. **Blocos de pergunta fiscal continuam em coluna
   única** (a `Escolha` + o texto de consequência que a acompanha, ex. o aviso
   de CNO de outra obra, "pago sem nota", retenção) — não esticar a linha do
   texto de consequência fiscal é a mesma regra de legibilidade que o `046`
   aplicou à discriminação anual.
3. Zero mudança de campo, validação, texto, default, ordem ou número de
   passo. Este ticket é reflow de layout — mesma disciplina dos
   `043`-`046` ("zero mudança de lógica/campo/validação"). Nenhuma pergunta
   fiscal muda de lugar no fluxo, só de largura na tela. O rail do critério
   1a está sujeito à mesma regra: espelha campos e respostas que já existem,
   não cria nenhum.
4. Hub `/adicionar/page.tsx`: sem mudança de código — herda a casca larga do
   `layout.tsx` de graça. Gate 0 confirma que os 3 cartões ficam legíveis
   (não esticados) na largura nova.
5. `/obras/nova` (assistente de cadastro, mesmo grupo de rotas) herda a
   mesma casca larga e pode receber o mesmo tratamento de grid nos campos
   escalares, se o `designer` achar que vale a pena no Gate 0 — não é
   obrigatório, é carona.
6. `/entrar` **se autolimita a 430px com um wrapper próprio** — login
   esticado numa tela larga é regressão visual, não ganho. Uma linha de CSS
   isolando essa rota do breakpoint novo do grupo.
7. `/conta` herda a largura nova sem tratamento dedicado (baixa frequência,
   fora do motivo que originou este ticket) — sem critério de teste próprio.
8. Toda saída de fluxo que hoje devolve o usuário a "Voltar ao início" (tela
   `Registrado`, confirmações de agendamento) precisa continuar levando a uma
   tela real do produto quando alcançada a partir do shell de gestão em tela
   larga — sem deixar a pessoa "presa" numa tela de captura sem chrome nenhum
   depois de ter chegado por um clique no dashboard. Confirmar no Gate 1 se
   algum `href` precisa mudar.
9. Atualizar `e2e/shell-desktop.spec.ts`: os asserts de largura 430px contra
   `/adicionar/pagamento` (hoje ~linhas 249-261) e `/obras/nova` (hoje ~linha
   1211) passam a esperar o valor novo em viewport largo. O assert de
   **ausência** de `[data-shell]` nessas rotas **não muda** — captura continua
   sem sidebar/chrome de gestão em qualquer largura, é só a coluna que cresce.
10. **375px continua sendo piso obrigatório testado**, não só "não quebra" —
    ao contrário do que a 2ª correção fez com as telas de gestão. A doutrina
    de 2026-09-22 só *acrescenta* a permissão de tela larga à captura; não
    retira a garantia de que o canteiro (celular, uma mão, rápido) continua
    funcionando exatamente como hoje. O "Teste do Canteiro" continua sendo a
    régua de aceite destas 3 rotas, ao lado do teste de tela larga — não é
    substituído por ele.
11. Disciplina fiscal inalterada em qualquer largura: campo vazio pergunta,
    nenhum default em campo fiscal, anexo obrigatório no ato do registro.
    Nenhuma tela de bloqueio (CNO de outra obra), diálogo de confirmação de
    saída ou texto de consequência muda uma palavra.

## Fora de Escopo
- **Mover `/adicionar/*` para `app/(gestao)/`.** Avaliado e rejeitado pelo
  `cto-obra` (consulta técnica de 2026-09-22, ver
  `docs/backlog/58-2026-09-22-captura-tela-larga-contai-047-048.md`): o shell
  de gestão, mesmo abaixo de `lg`, já renderiza a faixa de navegação e o
  topbar — mover a captura para lá traria chrome de gestão para dentro do
  canteiro (piorando, não aliviando, o "Teste do Canteiro"), duplicaria a
  fonte de "obra ativa" (`useGestao` do shell × `useObraDoRegistro` dos 3
  formulários, reabrindo o Pre-mortem 3 do `CONTAI-040`) e colocaria fetch de
  dashboard/pendências no caminho de rede do canteiro. É refactor de
  estrutura, não de largura.
- **Renderizar o arquivo (PDF/foto) grande o bastante para LER e conferir
  CNPJ/valor/data contra o formulário** — permanece **feature nova**, não
  casca, e continua fora deste ticket. **Fronteira exata, fechada em
  2026-09-22** depois de checar o mock pixel a pixel: o rail do critério 1a
  só carrega uma **miniatura 52×52** do arquivo (não dá para ler nada nela) e
  um resumo do que já foi *digitado pelo usuário* — não uma leitura do
  documento em si. Ver o documento de verdade (`<object>`/`<img>` a partir de
  blob URL, tamanho de leitura) continua sendo o `CONTAI-048`, que **não
  ganhou Gate 0 nesta rodada** — o mock deste ticket não o substitui.
- Full-width (sem coluna) — decisão técnica fechada: mede pior que coluna
  limitada (Gate 2 do `CONTAI-039`).
- Qualquer campo, validação, texto fiscal, ordem de passo ou lógica de
  decisão (`decidirRegistro`, gate de retenção, bloqueio de CNO de outra
  obra, extração automática) — zero mudança.
- Parametrizar `ShellDeGestao` com um "modo captura" para reaproveitá-lo aqui
  — mesma razão da primeira exclusão: reabre a bifurcação de JSX que o
  `CONTAI-040` rejeitou no Gate 0. **Confirmado tecnicamente em 2026-09-22**
  (consulta ao `cto-obra`, ver "Dependências"): o "takeover de tela cheia" que
  o mock descreve (Decisão 1) — sidebar/topbar do shell de gestão somem ao
  navegar para `/adicionar/*` — já acontece hoje, de graça, porque
  `(gestao)/layout.tsx` e `(captura)/layout.tsx` são árvores de layout
  **irmãs**: o Next desmonta uma e monta a outra na navegação. Zero código
  novo, zero estado de "modo". A troca é um swap seco (sem animação de saída);
  se algum dia se quiser a sidebar "deslizando" para fora, isso é feature nova
  fora deste ticket, e cortada pela mesma razão desta exclusão. O header
  "‹ Cancelar" é responsabilidade da própria página de captura, não do
  layout — nenhuma mudança de contrato entre os dois.
- **Rail para `pagamento/page.tsx` e `compra-cartao/page.tsx`** — decisão do
  `po` em 2026-09-22: não, por ora. Esses dois fluxos são mais curtos e não
  têm extração para conferir campo a campo (mesmo raciocínio já usado no
  Fora de Escopo do `CONTAI-048`). Se um relato pedir depois, é ticket novo.

## Gate Fiscal (Contador)
Sem regra fiscal nova. Gate 2 do `contador` obrigatório mesmo assim: confirmar
que nenhum texto de consequência fiscal (bloqueio de CNO de outra obra, "pago
sem nota", retenção na nota, avisos de agendamento não contar como custo)
mudou uma palavra ao entrar no grid de campos curtos ou ao mover de coluna.
Comparação byte a byte, mesma prova usada nos `043`-`046`.

## Pre-mortem
0. **Banner de consequência fiscal migrando para o rail** — o rail (critério
   1a) é tentador como "lugar de destaque" para um aviso de bloqueio, mas o
   mock (Decisão 4) é explícito: pendência nasce inline, o rail só espelha o
   que já foi respondido. Guarda: revisão explícita no Gate 1/2 de que
   nenhum `Banner`/`Consequencia` (quarentena, CNO sem obra, retenção)
   aparece no rail antes de existir na pergunta original.
1. **Bloco de pergunta fiscal entrando em `grid-cols-2` por engano** —
   reabriria o mesmo erro que o Gate 2 do `CONTAI-039` já achou (texto de
   consequência perdendo legibilidade ao dividir a largura). Guarda: revisão
   explícita no Gate 1/2 de que nenhuma `Escolha` fiscal e o texto que a
   acompanha entram em coluna dupla.
2. **`e2e/shell-desktop.spec.ts` esquecido** — os asserts de largura fixa em
   430px ficam vermelhos silenciosamente se ninguém grepar por `430` antes do
   Gate 1. Está nomeado no critério 9 para não depender de descoberta tardia.
3. **Saída de fluxo deixando o usuário sem chrome nenhum** quando chegou pelo
   shell de gestão em tela larga — nem sidebar (captura não tem), nem AppBar
   de contexto reconhecível. Sensação de "saiu do app". Ver critério 8.
4. **`/entrar` herdando a largura nova sem querer** — tela de login esticada
   por efeito colateral do breakpoint do grupo. Precisa do wrapper próprio no
   mesmo diff (critério 6), não como correção depois.

## Dependências
- **Gate 0 FECHADO em 2026-09-22**: `design/mocks/captura-no-desktop-v1.md` +
  `.html` (`designer`). As 3 perguntas em aberto do mock foram fechadas pelo
  `po` (com uma consulta técnica ao `cto-obra` no meio): pergunta 1 (takeover
  de tela cheia) → é a navegação de sempre entre route groups, sem código
  novo, ver "Fora de Escopo"; pergunta 2 (inconsistência "Passo 2 de 3"/
  "Passo 3 de 3") → não é desta rodada, virou **D68** (ver
  `docs/backlog.md`); pergunta 3 (rail para `pagamento`/`compra-cartao`) →
  não, ver "Fora de Escopo". Decisão completa em
  `docs/backlog/59-2026-09-22-decisao-po-mock-captura-desktop.md`.
- **Contingência de fatiamento — mantida, não decidida ainda**: o Gate 0
  reforçou que `documento/page.tsx` é o maior dos três (agora com o rail do
  critério 1a somado a anexo + extração + bloqueio de CNO). Se o Gate 1
  achar o diff grande demais para revisar de uma vez, este ticket pode ser
  fatiado — mecanismo de casca larga + `pagamento`/`compra-cartao`/hub/
  `entrar` primeiro, `documento` (com rail) depois — mesmo padrão dos
  `043`-`046`. Decisão do `po`, registrada como entrada nova de backlog se
  acontecer.
- Não bloqueia nem depende de nenhum ticket aberto hoje. `CONTAI-048` (ver o
  documento renderizado grande o bastante para ler, ao lado do formulário)
  reaproveita a casca larga que este ticket cria, mas não bloqueia nem é
  bloqueado por ele — e continua **sem Gate 0 próprio**, porque o rail deste
  ticket não é a mesma feature (ver "Fora de Escopo").

## Cenário e checagem final
Os dois cenários do produto, nesta ordem de peso para este ticket:
- **Principal — captura em tela larga**: em casa, sentado, registrando um
  documento/pagamento/compra a partir do desktop. É a dor de origem.
- **Eventual — captura no canteiro**: celular, uma mão, 375px. Continua sendo
  o piso testado e obrigatório (critério 10) — ao contrário das telas de
  gestão, aqui a régua do canteiro não perde peso, só ganha uma companheira.
