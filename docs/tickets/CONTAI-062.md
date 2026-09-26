# CONTAI-062 Sugestão automática do gate de retenção, a partir da leitura do PDF

## Tipo e Prioridade
feature — P1 — fricção de processo (nenhum campo de valor/classificação
fiscal muda; o efeito é só a captura não corresponder à expectativa criada
pelo próprio botão "extrair automaticamente"). Estende um mecanismo já
entregue (`CONTAI-053`/`054`/`055`), sem migration.

## Dor de Origem
Relato direto do Mateus, hoje (`docs/backlog/75-2026-09-26-gate-retencao-sugerido-na-extracao.md`):
anexou um PDF de NF de serviço do mesmo padrão que ele próprio deu como
exemplo de origem do `CONTAI-054`, clicou em "extrair automaticamente"
(Gemini) e a retenção não veio — porque `sugerirLinhaRetencao` só roda depois
de o gate `retencaoNaNota` já estar marcado manualmente como `"destacada"`.

> "eu não espero clicar em nada, se estou anexando o pdf e mandando extrair
> automaticamente, eu espero que todo o formulário seja preenchido a partir
> daí, não que eu tenha que clicar em partes do formulário para que a
> extração funcione."

## User Story
Como dono da obra, capturando uma NF de serviço em `/adicionar/documento`,
quero que o gate "esta nota destaca alguma retenção?" venha preenchido como
sugestão — junto com o rótulo e o valor da linha — sempre que o parser
determinístico reconhecer o padrão na nota, para não precisar marcar
manualmente uma pergunta cuja resposta já está impressa e legível no papel,
sem que isso vire uma afirmação que eu não conferi.

## Critérios de Aceite
1. [x] Proposta nível 2 aprovada em `design/mocks/CONTAI-062.md` antes do
   desenvolvimento.
2. [x] Com PDF anexado num tipo que exige retenção (`exigeRetencao(tipo)`) e
   o gate `retencaoNaNota` ainda vazio, se o parser determinístico
   reconhecer o padrão (mesmo critério do `CONTAI-054`/`055`: par único
   total−terceiro=líquido, tolerância de 1 centavo), o gate é preenchido com
   `"destacada"` e a linha (rótulo+valor) chegam juntos, na mesma leitura —
   sem exigir que o Mateus marque o gate manualmente primeiro, e
   independente de o clique em "extrair automaticamente" (Gemini, caminho
   separado) ter acontecido ou não (`docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`,
   ADENDO 5, §3, salvaguarda 4).
3. [x] A sugestão nunca assume `"nao_destacada"` nem `"nao_sei"` — ausência
   de padrão reconhecido deixa o gate em `null`, exatamente como hoje
   (ADENDO 5, §3, salvaguardas 2 e 3).
4. [x] O gate sugerido é visualmente distinto de uma resposta marcada
   manualmente por DOIS canais — cor âmbar E selo/texto "Sugerida" (com
   equivalente para leitor de tela) — nunca só cor, conforme
   `design/mocks/CONTAI-062.md` §2 (ADENDO 5, §3, salvaguarda 1).
5. [x] O trecho literal (rótulo + valor) lido da nota aparece ao lado do
   próprio gate em qualquer largura de tela — inclusive abaixo de 880px,
   onde o repeater de linha continua invisível — para o Mateus conferir
   contra o papel sem precisar procurar (ADENDO 5, §3, salvaguarda 1;
   `design/mocks/CONTAI-062.md` §3).
6. [x] Nada da sugestão (gate ou linha) é gravado em tabela nenhuma até
   "Salvar registro" — a origem (`"manual"`/`"sugerida"`) é estado de tela
   efêmero; só o valor final de `retencaoNaNota` viaja para
   `criarDocumento`, sem novo valor de enum no banco e sem migration
   (ADENDO 5, §3, salvaguarda 1).
7. [x] Uma resposta manual do Mateus ao gate, a qualquer momento — inclusive
   enquanto a leitura do PDF ainda está em andamento (o fetch em voo) —
   sempre vence a sugestão; a sugestão nunca sobrescreve silenciosamente uma
   resposta já dada. Cobre a condição de corrida nomeada no Gate 4 do
   `designer`: o efeito de leitura não pode decidir com base no valor do
   gate capturado no momento em que ele nasceu (closure velho), tem que ler
   o valor mais recente no momento em que a resposta chega.
8. [x] Tocar na opção já sugerida (mesmo valor) apenas muda a origem para
   `"manual"`, sem alterar a resposta nem apagar `linhasPendentes`; tocar na
   outra opção troca a resposta para `"manual"` e apaga `linhasPendentes`
   (mecanismo já existente de `responderGateDeRetencao`, sem exceção para o
   caminho de sugestão).
9. [x] O estado de falha da leitura (`falhouSugestaoRetencao`) aparece num
   banner âmbar calmo, nunca vermelho, nunca bloqueia "Salvar registro" —
   mesmo padrão já usado no `CONTAI-055`, agora visível em qualquer largura,
   mesmo com o gate ainda vazio.
10. [x] O comentário em `lib/extracao/retencao-texto.ts:12-15` é corrigido
    para refletir o ADENDO 5 — deixa de citar o parecer como proibição do
    gate; mantém, sem ambiguidade, a proibição de `composicao`/`tributo`/
    `eDescontoEfetivo`/`quemRecolhe`.
11. [x] `notaNoCpf` não recebe nenhuma sugestão nem muda de comportamento
    (ADENDO 5, §1, "não abre precedente para `notaNoCpf`").
12. [x] `quem_recolhe`, `composicao`, `natureza_da_retencao` e
    `e_desconto_efetivo` continuam exclusivamente manuais, sem sugestão em
    ponto nenhum do fluxo — herdado do `CONTAI-053`/`054`/`055`, sem
    mudança.
13. [x] Teste automatizado cobre pelo menos quatro casos: (a) nota
    reconhecida com gate vazio → gate+linha sugeridos juntos; (b) nota sem
    padrão reconhecido → gate permanece `null`; (c) gate já respondido
    manualmente antes de a leitura terminar → resposta preservada, sugestão
    não aplicada ao gate; (d) resposta manual chegando DURANTE o fetch em
    voo → resposta manual vence. `e2e/captura-retencao-desktop.spec.ts`
    migrado para os seletores `data-sugestao="gate-lendo"`/`"gate-falhou"`
    fora do repeater, sem quebra silenciosa de seletor.

## Out of Scope
- `notaNoCpf`, `quem_recolhe`, `composicao`, `natureza_da_retencao` e
  `e_desconto_efetivo` — todos permanecem exclusivamente manuais, nenhuma
  mudança de comportamento neste ticket.
- Qualquer ajuste na heurística/threshold do parser determinístico
  (`sugerirLinhaRetencao`, `extrairLinhasRotuladas`) além de deixar de
  exigir o gate como pré-condição — calibração de falso positivo fica para
  quando houver taxa medida na prática (ADENDO 5, §3, nota final).
- Tipos de documento que não exigem retenção (`!exigeRetencao(tipo)`) — o
  gate simplesmente não existe para eles, sem mudança.
- PDF sem camada de texto (scan/foto) — mesma limitação já existente do
  `CONTAI-054`/`055`; parser não roda, campo permanece manual.
- Qualquer mudança em `/documento/[id]` (tela de gestão, pós-criação) — a
  dor relatada é específica de `/adicionar/documento`; se a mesma lacuna
  existir na edição pós-criação, é achado separado.
- A extração via Gemini (`extrairDaNota`) ganhar qualquer novo campo fiscal
  — ela continua restrita a tipo/número/série/data/favorecido/valor; o
  gatilho da sugestão de retenção é o parser local, não o Gemini.
- Botão de "confirmar sugestão" dedicado — não existe; a confirmação é
  implícita em "Salvar registro" (mesmo padrão de tipo/número/valor
  extraídos hoje).

## Gate Fiscal (Contador)
Fechado antes de abrir este ticket — **ADENDO 5**, 2026-09-26, em
`docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`.

- `retencaoNaNota` ("a nota destaca retenção?") é **fato objetivamente
  legível** no papel — mesma categoria de data de emissão ou CNPJ —
  categoricamente diferente de `quem_recolhe`/`composicao`/
  `natureza_da_retencao`, que continuam 100% proibidos de sugestão, sem
  exceção.
- Condição → consequência: **SE** o parser encontra um par único (total,
  líquido, terceiro) com aritmética `total − terceiro = líquido` (tolerância
  1 centavo) **E** o gate ainda está vazio (`null`) **→** sugere
  `retencaoNaNota = "destacada"` **junto** com a linha (rótulo+valor), nunca
  separado, nunca gravado até "Salvar registro". **SE** não encontra um par
  único **→** o gate permanece `null` (nunca sugere `"nao_destacada"` nem
  `"nao_sei"` — ausência de padrão não é prova de ausência de retenção).
- **Automático**: leitura do PDF, reconhecimento do padrão, preenchimento
  inicial do gate+linha como sugestão editável.
- **Exige revisão humana** (do Mateus, não CRC): confirmar cada sugestão
  contra o papel antes de "Salvar registro" — mesmo gesto que já existe hoje
  para tipo/número/valor extraídos.
- **Exige CRC**: nada novo neste ticket.
- `notaNoCpf` não é afetado — fica fora de qualquer sugestão, decide a
  admissibilidade do documento inteiro, pergunta de natureza diferente
  (ADENDO 5, §1).
- Ação corretiva de código exigida pelo próprio parecer: o comentário em
  `lib/extracao/retencao-texto.ts:12-15` cita este parecer para uma leitura
  que ele nunca sustentou para o gate — corrigir para não voltar a ser lido
  como proibição (critério 10).

## Pre-mortem
1. **Falso positivo do gate abrindo seção sem necessidade real.** A nota tem
   uma terceira linha que bate por coincidência com "total"/"líquido" (frete,
   desconto comercial, parcelamento, arredondamento de imposto ainda não
   vigente), e o gate se marca "destacada" numa nota que não tem retenção
   nenhuma — o Mateus precisa notar e descartar toda vez. Mitigado pelas
   quatro salvaguardas do ADENDO 5 (nunca afirma, mostra o trecho literal ao
   lado, mesmo critério aritmético já usado hoje só para a linha) — mas não
   eliminado: se a taxa de falso positivo for perceptível na prática, o
   próprio parecer já prevê a resposta (apertar o reconhecimento de padrão é
   decisão técnica, não reabrir a proibição do gate).
2. **O Mateus não perceber que é sugestão, não fato afirmado**, e confundir
   um campo pré-marcado pela extração com uma resposta que ele mesmo deu —
   inverteria a disciplina "campo vazio pergunta, campo preenchido afirma"
   na direção errada (o campo PARECE afirmado por ele, mas foi o sistema).
   Mitigação: distinção visual obrigatória em dois canais (critério 4) — mas
   a mitigação depende de execução correta do spec no Gate 1/2, não é
   automática só por existir a regra.
3. **Colisão com o mecanismo de limpeza `responderGateDeRetencao`** e
   condição de corrida real (achada pelo próprio `designer` lendo o código,
   não hipotética): o efeito que busca a sugestão pode fechar sobre um
   `retencaoNaNota` desatualizado; se o Mateus responder manualmente o gate
   ENQUANTO a leitura do PDF ainda está em voo, a chegada tardia da
   sugestão poderia sobrescrever a resposta manual dele — pior que o bug
   relatado, porque desta vez o app **afirmaria algo que o Mateus já tinha
   negado**. Coberto pelo critério 7; a implementação precisa ler o valor
   mais atual do gate no momento em que a resposta chega, não o valor
   capturado quando o efeito nasceu.

## Viabilidade (CTO)
- **Modelo de dados**: nenhum impacto. `documento.retencao_na_nota` continua
  gravado só no "Salvar registro", com o mesmo valor de hoje; a linha
  continua em `linhasPendentes` (memória) até o INSERT pós-documento do
  `CONTAI-053`. Sem migration, sem tabela, sem coluna nova.
- **Arquivos**:
  - `lib/extracao/retencao-texto.ts` — remove o parâmetro `gate` de
    `sugerirLinhaRetencao` (função vira só `texto → sugestão | null`);
    cabeçalho reescrito citando o ADENDO 5, §1 e §3.
  - `lib/extracao/retencao-texto.test.ts`, `retencao-texto-real.test.ts` —
    tirar o argumento; apagar o caso "gate ≠ destacada → null".
  - `app/api/sugerir-retencao/route.ts` — apaga `lerGate` e o campo
    `retencaoNaNota` do form; a resposta `{ sugestao }` não muda de formato
    (o cliente deriva o gate de `sugestao !== null`, o que garante
    estruturalmente a salvaguarda 4: não existe caminho que sugira o gate
    sem a linha). Cabeçalho reescrito.
  - `app/(captura)/adicionar/documento/page.tsx` — estado
    `origemGateRetencao`, `alvoDaSugestaoDeRetencao` sem a pré-condição de
    gate já marcado, efeito de chegada da sugestão decidindo o gate quando
    ele ainda está `null` (lendo valor atual, não capturado no closure),
    bloco novo do trecho literal fora do repeater; corrige os comentários
    que hoje afirmam "nunca toca o gate" (≈300-303, 315-317, 1246-1250).
  - `app/_components/campos.tsx` — `Escolha` ganha prop opcional
    `sugerido?: T | null` (pílula marcada em âmbar + selo, em vez do
    preenchido escuro de sempre); sem efeito em nenhum outro uso existente
    do componente.
  - `app/_components/retencao.tsx` — remove os blocos de loading/falha
    duplicados de `BlocoRetencaoDaCaptura` (linhas 837-848), agora
    redundantes com o bloco novo fora do repeater; ajusta comentários.
  - `lib/fiscal/retencao.ts` — nova constante `SUGESTAO_GATE_CONFIRA`, texto
    de produto (não citação de parecer).
  - `e2e/captura-retencao-desktop.spec.ts` — migra seletores
    `data-sugestao="lendo"|"falhou"` para `"gate-lendo"|"gate-falhou"` fora
    do repeater; `"retencao"` (dentro do `FormularioDeLinha`) não muda;
    adiciona caso em largura estreita (375px) provando gate sugerido +
    trecho literal sem repeater visível.
- **Complexidade**: M. A lógica nova cabe em poucas dezenas de linhas; o
  volume é comentário, teste e E2E que hoje codificam a premissa oposta
  (gate precisa vir antes).
- **Decisão de gatilho**: reaproveita o efeito `alvoDaSugestaoDeRetencao` já
  existente, removendo a condição `retencaoNaNota === "destacada"`. O alvo
  passa a ser `exigeRetencao(tipo) && PDF anexado`. Não fica atrelado ao
  clique de "extrair automaticamente" (esse é o Gemini — cota, latência,
  falha; a leitura do gate é parser local, gratuito e já automático hoje) —
  amarrar ao botão criaria dois caminhos com dois modos de falha e deixaria
  quem escolhe o tipo manualmente sem sugestão.
- **Decisão de largura (<880px)**: o gate se sugere em qualquer largura; o
  `FormularioDeLinha` sugerido já fica montado no DOM (escondido por CSS,
  `hidden larga:flex`, mesmo mecanismo do `CONTAI-053`) e aparece se a
  largura cruzar 880px. Para cumprir a salvaguarda 1 em tela estreita, o
  trecho literal (rótulo+valor) é renderizado ao lado do próprio gate, fora
  do repeater, em qualquer largura — nunca só dentro do bloco escondido.
- **Dívidas criadas**: nenhuma nova. Em <880px, salvar com o gate sugerido e
  sem completar a linha deixa a mesma pendência "linha a completar" que já
  existe hoje quando o Mateus marca "destacada" manualmente no celular — não
  é comportamento novo introduzido por este ticket.

## Dependências
- Bloqueado por: nenhum. `CONTAI-053`/`054`/`055` (o mecanismo que este
  ticket estende) já estão entregues.
- Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma bloqueante — Gates 1-4 (`po`/`contador`/`cto-obra`/`designer`)
fechados na mesma rodada, antes de abrir este ticket.

## Cenário e checagem final
**Captura** (`/adicionar/documento`). Não conflita com "375px deixou de ser
piso obrigatório" (2026-09-21) nem com sua extensão às telas de captura
(2026-09-22) — aquilo libera densidade extra em tela larga; este ticket não
pede densidade nova, pede **remoção** de um toque manual no meio do fluxo de
captura, servindo ao princípio 1 diretamente (menos interação no momento
sagrado da captura, não mais). O "Teste do Canteiro" (captura, ≤3
interações, anexo obrigatório) continua de pé e fica mais fácil de passar,
não mais difícil.

**Varredura de condição fiscal órfã**: todo critério com obrigação/proibição
fiscal (2, 3, 5, 6, 10, 11, 12) cita o parecer
`docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (ADENDO 5) pelo
caminho, na mesma frase. Nenhuma condição fiscal órfã encontrada.

**Veredito: APROVADO.** As três metas do produto: serve à meta 1 (nenhum
pagamento sem documento hábil) por vias indiretas — reduz a chance de o
Mateus abandonar o preenchimento da retenção por fricção, sem o qual a nota
fica documentada de forma incompleta. Nenhuma mudança em relatórios anuais
nem em acervo. Escopo contido, sem invenção de regra fiscal, sem migration,
sem tocar nos quatro campos que continuam proibidos de sugestão.

✅ **Entregue em 2026-09-26.** 13/13 critérios PASS — Gate 4 (`po`). O gate
`retencaoNaNota` e a resposta e a origem (`"manual"`/`"sugerida"`) viraram um
estado único (`gateDeRetencao`) em `page.tsx`, o que torna a decisão do
critério 7 atômica: o updater lê o valor MAIS RECENTE do gate no momento em
que a sugestão chega, nunca o capturado quando o efeito nasceu — a resposta
manual do Mateus vence sempre, inclusive com o fetch em voo (E2E 6.4). O
Gate 1/2 corrigiu duas premissas erradas do Gate 0: (1) o `onChange` do React
não dispara em todo clique de rádio — só quando `checked` muda —, então
tocar na pílula já sugerida exigiu um `onClick` próprio em `Escolha`,
existente só enquanto `sugerido` está setado (E2E 6.2); (2) a invalidação por
troca de anexo zerava a sugestão da LINHA mas esquecia o GATE — corrigido
para os dois morrerem juntos, e só a resposta de origem `"sugerida"` morre;
uma resposta manual (`"nenhuma"` inclusive) sobrevive à troca de papel (E2E
6.6/6.7). O trecho literal (rótulo+valor) e os estados de leitura/falha
saíram de dentro do `BlocoRetencaoDaCaptura` (só ≥880px, só com o gate já
"destacada") para o lado do próprio gate em `page.tsx`, visíveis em qualquer
largura e com o gate ainda vazio — os dois blocos redundantes de
`retencao.tsx` (linhas antigas 837-848) foram removidos. Nenhum arquivo
mudou depois do APPROVE final do Gate 2. 1121 unitários + 334 E2E verdes
(local, Docker), sem migration. Achado não bloqueante do Gate 2 registrado em
`docs/backlog/75-2026-09-26-gate-retencao-sugerido-na-extracao.md`: troca de
anexo não invalida nada digitado à mão no formulário — comportamento
consistente com o resto da tela, não regressão, avaliação de produto futura.
