# CONTAI-069 Detecção automática do CNO impresso, sugerindo `cnoNaNota = "desta_obra"`

## Tipo e Prioridade
feature — P2 por mérito técnico (não corrige expectativa quebrada como o
`CONTAI-062`; acrescenta automação nova, sem efeito em relatório algum até o
Mateus confirmar). Fila real é decisão do Mateus, não técnica.

## Dor de Origem
Relato direto do Mateus, hoje (`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`):
depois de testar o `CONTAI-062` numa nota real, pediu para o parser também
comparar o CNO impresso no PDF com o CNO cadastrado da obra e marcar o gate
sozinho quando os dígitos batessem exato.

> "eu discordo e quero que implemente. não terá dúvida neste ponto. No
> momento que o CNO bater iguais não haverá dúvida e erro. É número, ou é
> igual ou não é."

**Este ticket nasce de uma decisão de produto que sobrepõe a recomendação
fiscal do `contador`** — ver Gate Fiscal abaixo. A decisão é do Mateus,
registrada com transparência total no backlog citado; este ticket especifica
a implementação, não reabre a discussão.

## User Story
Como dono da obra, capturando uma NF de serviço em `/adicionar/documento`,
quero que o gate "esta nota traz o CNO desta obra?" venha preenchido como
sugestão quando o CNO impresso no papel for idêntico, dígito a dígito, ao CNO
cadastrado da minha obra, para não precisar comparar dois números de 12+
dígitos de cabeça — sem que isso vire uma afirmação que eu não confirmei no
"Salvar registro".

## Critérios de Aceite
1. [x] Proposta nível 2 aprovada em `design/mocks/CONTAI-069.md` antes do
   desenvolvimento.
2. [x] O parser procura, no texto do PDF, um número associado a um rótulo
   contendo literalmente "CNO", "Cadastro Nacional de Obras" ou "Matrícula
   CEI"/"CEI" — nunca busca de 12 dígitos soltos sem rótulo. Mesmo padrão
   estrutural (rótulo + valor associado, mesma linha ou linha seguinte) já
   usado por `extrairLinhasRotuladas`, em extrator próprio (não reaproveita a
   âncora de valor monetário do parser de retenção, que nunca casaria com um
   CNO).
3. [x] O candidato só é aceito com exatamente 12 dígitos depois de remover
   pontuação (`.`, `/`, `-`, espaço) — nunca 11 (CPF), 14 (CNPJ) nem 44
   (chave de acesso).
4. [x] A comparação usa `cnoNormalizado` (`lib/fiscal/obra.ts`) — a única
   função de comparação de CNO do sistema — contra o `obra.cno` da obra
   corrente. Nenhuma segunda normalização é criada.
5. [x] A comparação só produz SUGESTÃO (`"desta_obra"`) quando AMBOS os lados
   (CNO lido, CNO cadastrado) normalizam para exatamente 12 dígitos idênticos.
   Cadastro com formato diferente (histórico, digitado à mão, 11/13+ dígitos)
   nunca gera sugestão — mas **não cai em silêncio**: o veredito é `"diverge"`,
   e a tela exibe os dois números lado a lado (mesmo texto do critério 7).
   ⚠️ **Texto corrigido no Gate 2 do `cto-obra`** — a redação original desta
   linha ("cai em silêncio") contradizia o comportamento correto do código.
   Gate Fiscal: mostrar o comparativo sempre que houver ao menos um número
   lido é mais seguro do que silenciar um cadastro histórico errado
   (pre-mortem 1) — silêncio pareceria "a automação não funciona" em vez de
   expor o número cadastrado divergente. Nunca falso positivo por comparação
   de tamanhos diferentes — igualdade continua exigindo 12 dígitos idênticos
   dos dois lados. O estado `formato_invalido` separado, sugerido pelo
   `contador` como possível melhoria futura, **não foi implementado** — vira
   dívida nomeada (**D87**, `docs/backlog.md`), não critério deste ticket.
6. [x] Com o gate `cnoNaNota` ainda vazio (`null`) e igualdade EXATA
   confirmada pelo critério 5, o gate é preenchido com a sugestão
   `"desta_obra"` (pílula âmbar + selo/texto "Sugerida", nos dois canais,
   nunca só cor — mesmo padrão do `CONTAI-062`). A sugestão nunca assume
   `"outra_obra"` nem `"nao_traz"` — essas duas continuam 100% manuais, sem
   exceção.
7. [x] Quando um número candidato é encontrado mas os dígitos NÃO batem, o
   gate permanece `null` (sem sugestão), e a tela exibe os dois números lado
   a lado, na mesma formatação, com o texto do parecer, copiado literalmente,
   nunca reescrito: **"CNO da obra: [número] · CNO da nota: [número] —
   números idênticos"** (caso do critério 6) ou **"— números diferentes"**
   (este caso) — `docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`,
   ADENDO, §5.
8. [x] Quando nenhum número rotulado como CNO é encontrado no texto, nada
   aparece — comportamento idêntico ao de hoje.
9. [x] Quando são encontrados dois ou mais candidatos rotulados como CNO com
   dígitos DIFERENTES entre si, o gate permanece `null` (sem sugestão), e a
   tela mostra um aviso explícito ("mais de um número encontrado — confira no
   papel") — nunca silêncio mudo, para não parecer que a automação falhou.
10. [x] Candidatos com os MESMOS dígitos repetidos (mesmo leiaute impresso
    duas vezes) contam como um candidato só — mesma doutrina de colapso por
    valor idêntico do `CONTAI-068` (ordem de aparição no texto, nunca
    vocabulário de rótulo).
11. [x] Uma resposta manual do Mateus ao gate, a qualquer momento — inclusive
    com o fetch de leitura em andamento — sempre vence a sugestão; o efeito
    que aplica a sugestão lê o valor mais recente do gate no momento em que a
    resposta chega, nunca um valor capturado em closure antigo (mesma
    condição de corrida do critério 7 do `CONTAI-062`, aplicada a
    `cnoNaNota`).
12. [x] Tocar a opção já sugerida (`"desta_obra"`) apenas muda a origem para
    `"manual"`, sem alterar a resposta; tocar outra opção troca a resposta
    para `"manual"` (mecanismo espelhado do critério 8 do `CONTAI-062`).
13. [x] Troca de anexo invalida a sugestão do CNO (gate volta a `null` e o
    número lido some da tela) da mesma forma corrigida no Gate 2 do
    `CONTAI-062` — uma resposta manual sobrevive à troca de papel; só a
    origem `"sugerida"` morre.
14. [x] Troca de obra no meio do formulário (`page.tsx:1115`, já zera o gate
    hoje) rederiva a sugestão contra o CNO da NOVA obra, sem novo fetch nem
    novo parse do PDF — comparando o mesmo `cnoLido` já obtido contra o
    `cnoNormalizado(obra.cno)` atual. Obra sem CNO cadastrado produz `null`
    naturalmente (sem erro, sem sugestão). ⚠️ Verificado por leitura de código
    (`comparacaoCno` é `useMemo` com `obra?.cno` na lista de dependências, e o
    bloco de render reage a qualquer mudança de referência) — não há E2E
    dedicado para troca de obra nesta suíte (mesma lacuna pré-existente do
    `CONTAI-062`, `TelaTrocarObra` não é exercitada por nenhum spec hoje).
15. [x] Nada da sugestão (gate ou número lido) é gravado em tabela nenhuma
    até "Salvar registro" — a origem (`"manual"`/`"sugerida"`) é estado de
    tela efêmero; só o valor final de `cnoNaNota` viaja para `criarDocumento`
    via `cnoReferenciadoParaBanco`/`notaTrazCnoParaBanco`, sem novo valor de
    enum e sem migration.
16. [x] O estado de leitura/falha do CNO reaproveita (ou estende, por spec de
    `design/mocks/CONTAI-069.md`) o indicador de "Lendo…"/"Não consegui ler"
    já existente ao lado do gate de retenção — mesma requisição HTTP, mesmo
    PDF, mesmos tipos de documento (`exigeRetencao`/`exigeCnoReferenciado`
    são ambos só `nf_servico`).
17. [x] Os comentários em `page.tsx` (≈348-356) e em qualquer módulo de
    extração que hoje afirmam "`cnoNaNota` continua 100% manual" são
    corrigidos, citando os dois pareceres
    (`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md` e seu ADENDO) e a
    decisão do Mateus registrada em
    `docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md` — nunca
    deixados a contradizer o código (mesmo cuidado do critério 10 do
    `CONTAI-062`).
18. [x] Teste automatizado cobre pelo menos seis casos: (a) número encontrado
    e idêntico ao CNO da obra, gate vazio → sugestão `"desta_obra"`; (b)
    número encontrado e diferente → gate `null` + banner "diferentes"; (c)
    nenhum número encontrado → nada muda; (d) dois candidatos com dígitos
    diferentes → aviso de ambiguidade, sem sugestão; (e) gate já respondido
    manualmente antes de a leitura terminar → resposta preservada; (f)
    resposta manual chegando DURANTE o fetch em voo → resposta manual vence.
    Inclui pelo menos uma fixture real anonimizada com CNO (hoje nenhuma
    fixture do projeto tem esse dado).

## Out of Scope
- `outra_obra` e `nao_traz` — permanecem 100% manuais, nenhuma automação, sem
  exceção.
- `tributo`/`composicao` do gate de retenção — ticket separado
  (`CONTAI-070`).
- `quem_recolhe`, `e_desconto_efetivo`, `natureza_da_retencao` — intocados.
- Tightening de `validarObra` para exigir 12 dígitos em CADASTRO NOVO de
  obra — vira dívida nomeada (ver Dependências); este ticket só protege a
  COMPARAÇÃO (critério 5), não a validação de entrada da obra.
- Renomear `app/api/sugerir-retencao/route.ts` para um nome mais genérico —
  opcional, decisão do `cto-obra` no Gate 2, não critério deste ticket.
- Qualquer mudança em `/documento/[id]` (tela de gestão pós-criação) — dor
  relatada é específica de `/adicionar/documento`.
- PDF sem camada de texto (scan/foto) — parser não roda, campo permanece
  manual, mesma limitação de sempre.

## Gate Fiscal (Contador)
**Parecer completo**: `docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`
(Pergunta 2 + ADENDO de reexame). **Registro da divergência**:
`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`.

- O `contador` reprovou a marcação automática de `cnoNaNota = "desta_obra"`
  **duas vezes** — a 2ª vez já sob a condição exata proposta pelo Mateus
  (igualdade EXATA de dígitos). Motivo final: `desta_obra` é o único dos três
  valores do gate em que o próprio `CONTAI-007` já trata o erro no sentido
  oposto (`outra_obra`) como **sem conserto** (bloqueia o salvamento);
  automatizar a marcação, mesmo sob correspondência exata, troca "decidir"
  por "confirmar uma decisão que o sistema já tomou" (vigilância degradada),
  sem rede de segurança — o valor entra limpo em `baseCentavos`, proxy da
  aferição INSS já conhecidamente superestimado (dívida D57).
- Recomendação do `contador` (a que valeria sem a decisão do Mateus): nunca
  MARCAR o campo — só computar e exibir o veredito da igualdade em texto,
  campo continua vazio, decisão 100% do Mateus.
- **O Mateus, depois de ouvir essa recomendação, decidiu implementar a
  marcação automática mesmo assim** — decisão de apetite de risco do dono do
  produto, não erro de especificação. Este ticket implementa a decisão do
  Mateus, com a responsabilidade da escolha registrada e visível.
- Condição → consequência (verbo: **marcar**, é sugestão editável, nunca
  fato até "Salvar registro"): **SE** o parser encontra exatamente um número
  claramente rotulado CNO/"Cadastro Nacional de Obras"/"Matrícula CEI" **E**
  a normalização de ambos os lados (nota, obra) produz exatamente 12 dígitos
  **E** os dígitos são idênticos **E** o gate ainda está vazio **→** marca
  `cnoNaNota = "desta_obra"` como sugestão. **SE** qualquer uma dessas
  condições falhar (nenhum número, mais de um candidato, dígitos diferentes,
  formato não normalizável) **→** o gate permanece `null`, exibindo o texto
  comparativo quando houver ao menos um número lido (critério 7).
- **Automático**: leitura do PDF, extração do número rotulado, comparação de
  dígitos, preenchimento da sugestão do gate.
- **Exige revisão humana** (do Mateus, não CRC): confirmar a sugestão contra
  o papel antes de "Salvar registro" — a interface facilita a conferência
  (números lado a lado), mas a revisão não é obrigatória por trava técnica,
  é a mesma disciplina que já vale para tipo/número/valor extraídos hoje.
- **Exige CRC**: nada novo — a dívida D57 (aferição real depende de
  eSocial/EFD-Reinf) não é fechada nem agravada por este ticket.
- `outra_obra`/`nao_traz` continuam impossíveis de sugerir — decisão
  unânime entre `contador` e Mateus, sem divergência neste ponto.

## Pre-mortem
1. **[Novo, achado pelo `cto-obra`] Igualdade exata contra um cadastro sem
   formato garantido.** `validarObra` (`lib/fiscal/obra.ts`) hoje só exige
   "não vazio" — um CNO cadastrado com 11 dígitos (erro de digitação
   histórico) nunca bateria com nota nenhuma, e o sintoma seria "a automação
   não funciona", indistinguível do comportamento normal. Pior: um cadastro
   com dígito trocado e uma nota com o MESMO erro (cópia do mesmo documento
   de origem errado) casariam entre si, afirmando `"desta_obra"` sobre dois
   números igualmente errados. Mitigado pelo critério 5 (exigir 12 dígitos
   dos dois lados antes de comparar) e pelo critério 7 (mostrar os dois
   números sempre que um for lido, mesmo sem bater) — mas não elimina um
   cadastro histórico já com 12 dígitos porém errado; isso só se resolve
   corrigindo o cadastro da obra, fora do escopo deste ticket.
2. **[Novo, achado pelo `cto-obra`] Nota com mais de um número candidato.**
   A nota cita o CNO da obra atual E uma matrícula antiga/outra obra no
   mesmo texto (ex.: referência a contrato anterior). Sem tratamento
   explícito, a régua "dígitos diferentes = `null`" protegeria o gate, mas o
   Mateus veria silêncio numa nota que "claramente" traz o CNO, e poderia
   concluir que a automação quebrou. Mitigado pelo critério 9 (aviso
   explícito de ambiguidade, nunca silêncio mudo).
3. **[Herdado do `CONTAI-062`, com uma dimensão nova] Corrida entre fetch em
   voo e troca de obra.** O Mateus troca a obra no seletor enquanto a leitura
   do PDF ainda está em andamento; a resposta chega e precisa comparar contra
   o CNO da obra CORRENTE no momento da chegada, não a que estava selecionada
   quando o fetch começou. Resolvido comparando no cliente (critério 4), não
   na rota — a rota nunca conhece dado de obra, só devolve o número lido; a
   comparação acontece sempre com o `obra.cno` mais atual.

## Viabilidade (CTO)
- **Modelo de dados**: nenhum impacto. O CNO da obra mora em `obra.cno`
  (`text`, migration 0001). O que se grava continua sendo
  `documento.cno_referenciado` + `nota_traz_cno` via
  `cnoReferenciadoParaBanco`/`notaTrazCnoParaBanco` (migration 0015), só no
  "Salvar registro". Sem migration, sem enum novo, sem coluna nova. A origem
  (`"manual"`/`"sugerida"`) é estado de tela efêmero, mesmo padrão do
  `CONTAI-062`.
- **Comparação**: reaproveita `cnoNormalizado` (`lib/fiscal/obra.ts`) — o
  próprio arquivo já a declara "a única regra de comparação de CNO do
  sistema". Função pura nova em `lib/fiscal/documento.ts`:
  `sugerirCnoNaNota(cnoLido: string | null, cnoDaObra: string | null):
  "desta_obra" | null` — só devolve `"desta_obra"` quando
  `cnoNormalizado(a) === cnoNormalizado(b)`, ambos não-nulos e com 12
  dígitos; qualquer outro caso, `null`. O tipo de retorno não admite
  `"outra_obra"`/`"nao_traz"` por construção (o compilador impede, não só a
  disciplina de quem escreve o código).
- **Onde compara**: no CLIENTE (`page.tsx`), não na rota. A rota devolve só
  os candidatos crus lidos (`cnoLido`/lista de candidatos); a página compara
  contra `obra.cno`. Preserva a rota "burra" (não lê dado de obra nenhuma) e
  resolve a corrida de troca de obra (Pre-mortem 3) sem novo fetch.
- **Parser**: arquivo novo `lib/extracao/cno-texto.ts` (não extensão de
  `extrairLinhasRotuladas`, que ancora em valor monetário e nunca casaria com
  um CNO). Nova função `lerCnoDoTexto(texto): string | string[] | null`
  (ou tipo equivalente que distinga "nada", "um candidato" e "múltiplos
  candidatos divergentes" — decisão de tipo do Gate 1): rótulo
  `/\b(CNO|Cadastro Nacional de Obras?|Matr[íi]cula (CEI|CNO)|CEI)\b/i`
  seguido (mesma linha ou linha seguinte, mesmos dois padrões já medidos no
  `CONTAI-054`) de um token com exatamente 12 dígitos após normalização.
  Candidatos com os MESMOS dígitos colapsam (critério 10); dígitos diferentes
  ativam o aviso de ambiguidade (critério 9). Sem `confiança`, sem fuzzy, sem
  "melhor palpite".
- **Rota**: estende `app/api/sugerir-retencao/route.ts` (mesmo PDF, mesmo
  parse via `unpdf`, mesmo alvo `nf_servico` de `exigeRetencao` e
  `exigeCnoReferenciado`) em vez de criar rota paralela — evita segundo
  upload e segunda cadeia de invalidação do mesmo arquivo. Resposta ganha
  campo `cnoLido` (ou lista de candidatos), passando pela mesma porteira
  `avaliarTexto`. Renomear a rota (ex. `/api/ler-nota`) é decisão opcional do
  Gate 2, não critério bloqueante.
- **`page.tsx`**: `cnoNaNota: RespostaCnoNota | null` vira
  `gateDeCno: { resposta; origem: "manual" | "sugerida" } | null` — o mesmo
  padrão de `gateDeRetencao`, com `cnoNaNota` derivado. Estado novo
  `cnoLido` preenchido pelo mesmo efeito de fetch já existente. Sugestão
  aplicada com updater funcional (lê o valor mais recente do gate),
  resolvendo o critério 11. Invalidação por troca de anexo e por troca de
  obra seguem os pontos já descritos nos critérios 13/14. `Escolha` recebe
  `sugerido` — prop já existente, sem mudança em `campos.tsx`.
- **Arquivos**: `lib/extracao/cno-texto.ts` (+ `.test.ts`, com fixture
  sintética E uma fixture real anonimizada com CNO — hoje nenhuma fixture do
  projeto tem esse dado), `lib/fiscal/documento.ts` (+ `.test.ts`),
  `app/api/sugerir-retencao/route.ts`, `app/(captura)/adicionar/documento/page.tsx`,
  `e2e/captura-retencao-desktop.spec.ts` ou spec irmão `captura-cno.spec.ts`.
- **Complexidade**: M — mesma ordem de grandeza do `CONTAI-062`; a lógica
  cabe em dezenas de linhas, o volume é teste e a migração de `cnoNaNota`
  para estado com origem.
- **Dívidas criadas**: `validarObra` não valida formato do CNO cadastrado
  (Pre-mortem 1) — fica como dívida nomeada, não bloqueia este ticket porque
  o critério 5 já protege a comparação; endurecer a validação de CADASTRO é
  trabalho separado, do `po`/`cto-obra`, quando houver decisão de exigir
  12 dígitos na criação/edição de obra.

## Dependências
- Bloqueado por: nenhum tecnicamente. `cto-obra` recomenda sequenciar a
  implementação ANTES do `CONTAI-070` (ambos estendem o mesmo
  `app/api/sugerir-retencao/route.ts`) para evitar retrabalho de merge — não
  é bloqueio duro, é ordem de fila sugerida.
- Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma bloqueante — Gates 1-4 (`po`/`contador`/`cto-obra`/`designer`)
fechados na mesma rodada. A forma exata do tipo de retorno do parser
(string única vs. lista de candidatos) fica a critério de quem implementa o
Gate 1, desde que os critérios 6/7/9/10 sejam satisfeitos.

## Cenário e checagem final
**Captura** (`/adicionar/documento`). Mesmo raciocínio do `CONTAI-062`: não
introduz densidade nova nem fluxo novo — adiciona uma sugestão a mais dentro
de um gate que já existe, reduzindo toque manual no momento da captura. O
"Teste do Canteiro" continua de pé e fica mais fácil de passar.

**Varredura de condição fiscal órfã**: todo critério com obrigação/proibição
fiscal (5, 6, 7, 9, 13, 15, 17) cita, na mesma frase, o parecer
`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md` e/ou o backlog
`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`. Nenhuma
condição fiscal órfã encontrada.

**Veredito: APROVADO**, com a ressalva explícita de que este ticket
implementa uma decisão de produto que **sobrepõe** a recomendação do
`contador` — registrada nos dois pareceres citados e no backlog, com a
responsabilidade da escolha atribuída ao Mateus. Serve à meta 2 (relatórios
prontos) por via indireta: reduz fricção que poderia levar a um gate
respondido errado por cansaço, sem mudar a régua de quando `outra_obra`
bloqueia. Nenhuma mudança em documentação hábil, nenhuma mudança em acervo.
Escopo contido, sem migration.

---

## ✅ Entregue em 2026-09-27

Gate 4 (`po`), **18/18 critérios PASS**. Sem migration.

⚠️ **Registro para a integridade histórica**: esta feature foi implementada por
decisão do Mateus **contrária à recomendação do `contador`**, que reprovou a
marcação automática de `cnoNaNota = "desta_obra"` duas vezes — a segunda já
sob a condição exata de igualdade de dígitos proposta pelo próprio Mateus
(`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`, Pergunta 2 + ADENDO).
A decisão de implementar mesmo assim é do Mateus, registrada por inteiro em
`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`; este Gate 4
confirma que o CÓDIGO entregue bate com as salvaguardas que o próprio ticket
exigiu para tornar essa decisão aceitável — não reabre a discussão de mérito.

`compararCandidatosCno`/`sugerirCnoNaNota`/`CandidatoCnoLido` (novo,
`lib/fiscal/obra.ts`, ao lado de `cnoNormalizado`) comparam o CNO impresso na
nota (achado por `extrairCandidatosCno`, novo módulo próprio
`lib/extracao/cno-texto.ts`, âncora de rótulo — nunca dígito solto) contra o
`obra.cno` CORRENTE, sempre no cliente. Igualdade EXATA de 12 dígidos dos dois
lados → sugestão `"desta_obra"` (pílula âmbar + selo "Sugerida", mesmo padrão
visual do `CONTAI-062`); cadastro fora de formato ou dígitos diferentes →
`"diverge"` (gate fica vazio, banner mostra os dois números — nunca silêncio,
critério 5 corrigido nesta rodada, ver abaixo); 2+ candidatos com dígitos
diferentes → aviso explícito de ambiguidade (critério 9); mesmos dígitos
repetidos colapsam num candidato só, por ordem de aparição no texto (critério
10, mesma doutrina do `CONTAI-068`). `outra_obra`/`nao_traz` continuam 100%
manuais por construção — o tipo de retorno de `sugerirCnoNaNota` não os admite.

A rota `/api/sugerir-retencao` passou a devolver também `cno: CandidatoCnoLido[]`
crus (nunca compara — decisão de arquitetura, resolve o pre-mortem 3 de troca
de obra com leitura em voo sem segundo fetch). `page.tsx` unificou
`cnoNaNota`/origem num estado só (`gateDeCno: { resposta; origem } | null`),
mesmo padrão do `gateDeRetencao` do `CONTAI-062`, com updater atômico
(`atual ?? …`) garantindo que resposta manual sempre vence a corrida contra a
leitura (critério 11, E2E 7.6). O banner "Lendo…"/"Não consegui ler" virou
compartilhado entre retenção e CNO (mesma requisição, mesmo PDF,
`exigeRetencao`/`exigeCnoReferenciado` nunca divergem) — texto ampliado em
`lib/fiscal/retencao.ts`, nome das constantes intocado, condição de silêncio
passou a olhar os DOIS gates.

**Ação do Gate 2 executada**: o critério 5 original ("cadastro fora de formato
→ silêncio") foi reescrito para bater com o comportamento correto do código
(exibe o comparativo com veredito `"diverge"`, nunca silencia um número lido).
O estado `formato_invalido` separado que o `contador` sugeriu como possível
melhoria futura **não foi implementado** — registrado como dívida nomeada
**D87** em `docs/backlog.md`, não como ticket novo (não há decisão de
prioridade do Mateus ainda).

**Arquivos alterados após o último APPROVE do `cto-obra` (Gate 2, 2ª rodada)**:
nenhum. Confirmado por `find . -newer e2e/captura-cno.spec.ts` (o último
arquivo de implementação, mtime 11:50) — só artefatos de build/execução
(`tsconfig.tsbuildinfo`, `next-env.d.ts`, `test-results/`) são mais novos,
nada de código-fonte.

**Testes**: `npx vitest run` — **1169/1169** (38 arquivos). `npm run test:e2e`
completo (stack local de pé) — **369/369** (362 pré-existentes + 7 novos em
`e2e/captura-cno.spec.ts`, casos 7.1–7.7, cobrindo os seis cenários do
critério 18 mais os critérios 12/13 espelhados do `CONTAI-062`). `npm run
typecheck` e `npm run lint` limpos. Equivalente completo de `npm run quality`
rodado em quatro comandos separados nesta sessão (lint, typecheck, unit, e2e),
todos verdes.

**Pendências**: nenhuma bloqueante. D87 (estado `formato_invalido`) fica sem
ticket até o Mateus priorizar. Critério 14 (rederivação na troca de obra) é
verificado por leitura de código (`useMemo` com `obra?.cno` como dependência)
— não há E2E dedicado para `TelaTrocarObra` nesta suíte, lacuna pré-existente
também no `CONTAI-062`, não introduzida por este ticket.
