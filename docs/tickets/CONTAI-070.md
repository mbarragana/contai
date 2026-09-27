# CONTAI-070 Sugestão automática de `composicao`+`tributo`, a partir do rótulo lido na retenção

## Tipo e Prioridade
feature — P2 por mérito técnico (mesma classe do `CONTAI-069`: automação
nova, sem corrigir expectativa quebrada, sem efeito em relatório até
confirmação). Fila real é decisão do Mateus.

## Dor de Origem
Relato direto do Mateus, hoje (`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`):
depois de ver a extração automática ler corretamente o rótulo "Valor
ISS"/"ISSRF" para sugerir a linha de retenção, perguntou por que o campo
`tributo` (e o botão "Tributo único", ou seja `composicao =
"tributo_identificado"`) não vêm preenchidos junto.

> "por que o campo `tributo` (e o botão 'Tributo único') não são preenchidos
> junto [com a linha de retenção]?"

**O `contador` reprovou esse pedido, sem exceção**, no parecer original
(`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`, Pergunta 1). **O
Mateus concordou** com essa reprovação na hora — não virou pedido de
implementação imediato. Depois, no mesmo dia, ao ver a implementação do
`CONTAI-069` (CNO) tomar forma, o Mateus **estendeu a mesma decisão de
sobrepor a recomendação fiscal** também ao tributo: *"aplique a mesma
abordagem ao tributo"* (registrado no ADENDO de
`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`). Este
ticket implementa essa extensão, com a salvaguarda técnica que o `contador` e
o `cto-obra` identificaram como necessária dada a diferença real entre os dois
campos — ver Gate Fiscal.

## User Story
Como dono da obra, capturando uma NF de serviço com retenção destacada em
`/adicionar/documento` ou `/documento/[id]`, quero que os campos "composição"
e "tributo" da linha de retenção venham preenchidos como sugestão quando o
rótulo lido no papel nomear uma única categoria de forma inequívoca, para não
escolher manualmente algo que já está impresso e legível — sem que isso vire
uma afirmação que eu não confirmei, e sem que o sistema arrisque adivinhar
quando o rótulo for ambíguo.

## Critérios de Aceite
1. [x] Proposta nível 2 aprovada em `design/mocks/CONTAI-070.md` antes do
   desenvolvimento.
2. [x] Classificador novo recebe o CONJUNTO de rótulos empatados que já
   colapsaram na mesma linha de retenção (`rotulosEmpatados`, campo aditivo
   da resposta de sugestão de linha) — nunca só o primeiro rótulo — e devolve
   1 de 6 categorias (`iss|inss|irrf|pis|cofins|csll`) OU `null`.
3. [x] A sugestão só existe quando TODOS os rótulos do conjunto:
   (a) não contêm nenhum marcador de combinação/agregação (vocabulário
   genérico de "mais de um", nunca jargão específico de prefeitura — mesma
   doutrina do `RE_NAO_TRIBUTARIO` do `CONTAI-068`); e
   (b) casam com EXATAMENTE UMA das 6 categorias, a mesma para todos os
   rótulos do conjunto.
   Qualquer violação de (a) ou (b) → `null`, sem sugestão — nunca "melhor
   palpite". O contraexemplo real do corpus, "Total das Retenções (ISSQN /
   Federais)", precisa produzir `null` (teste obrigatório).
4. [x] PIS, COFINS e CSLL são reconhecidos individualmente, cada um sua
   própria categoria — nunca como grupo combinado; rótulo de grupo (ex.
   "CSRF", "Contribuições Sociais Retidas", 4,65% combinado e não aberto) cai
   na regra do critério 3(a) e não sugere nada.
5. [x] Quando a sugestão existe e o campo `composicao` da linha ainda está
   vazio (`null`), os DOIS campos são sugeridos JUNTOS — `composicao =
   "tributo_identificado"` E `tributo = <categoria>` — cada um com a pílula
   âmbar + selo/texto "Sugerida" (dois canais, nunca só cor). Os dois nascem
   e morrem como par: nunca existe estado com um sugerido e o outro manual.
6. [x] Quando o rótulo é ambíguo, composto ou não casa com categoria nenhuma,
   os dois campos permanecem vazios — silêncio simples, sem aviso especial
   (diferente do `CONTAI-069`: aqui não há dois números para comparar, é
   campo de categoria, então não há "veredito" a exibir).
7. [x] Tocar qualquer um dos dois campos (mesmo só um) confirma o PAR inteiro
   como manual — nunca fica um campo `"sugerida"` e o outro `"manual"`
   simultaneamente. Trocar `composicao` para um valor diferente de
   `"tributo_identificado"` limpa `tributo` (comportamento já existente,
   sem mudança).
8. [x] `eDescontoEfetivo` e `quemRecolhe` continuam 100% manuais e
   obrigatórios antes de "Adicionar linha" — nenhuma mudança de
   comportamento nesses dois campos. A sugestão de `composicao`/`tributo`
   nunca dispensa essa etapa manual.
9. [x] A linha só entra em `linhasPendentes`/é gravada por "Adicionar linha"
   → "Salvar registro", exatamente como hoje — nenhuma sugestão vira fato
   sozinha; o Mateus sempre toca o formulário (pelo menos para confirmar
   `eDescontoEfetivo`/`quemRecolhe`) antes da linha existir.
10. [x] Troca de anexo invalida a sugestão de `composicao`/`tributo` (os dois
    voltam a `null` se ainda não confirmados manualmente) — mesma correção já
    aplicada à sugestão de rótulo/valor da linha no Gate 2 do `CONTAI-062`;
    resposta manual sobrevive à troca de papel.
11. [x] O critério 14 do `CONTAI-038` ("o pipeline nunca preenche
    `composicao`, o tributo específico... sozinho — mesmo quando o texto
    permitir uma inferência plausível") é atualizado no próprio arquivo do
    ticket `CONTAI-038`, ou recebe uma nota explícita apontando para este
    ticket como exceção registrada — para que um Gate 0 futuro não leia
    "proibido, sem exceção" e reverta esta feature por engano.
12. [x] Teste automatizado cobre, no mínimo: rótulos exclusivos de cada uma
    das 6 categorias (ex. "Valor ISS", "ISSRF", "INSS Retido", "IR", "PIS",
    "COFINS", "CSLL") → sugestão correta; "Total das Retenções (ISSQN /
    Federais)" → `null`; "ISS/INSS" (dois marcadores na mesma string) →
    `null`; "CSRF" e "Retenções Federais" (grupo, sem categoria única) →
    `null`; conjunto de rótulos empatados de categorias DIFERENTES → `null`;
    resposta manual em qualquer um dos dois campos sobrevivendo à troca de
    anexo.

## Out of Scope
- `cnoNaNota` — ticket irmão (`CONTAI-069`), campo e mecanismo diferentes
  (igualdade de dígitos vs. classificação de texto).
- `quem_recolhe`, `e_desconto_efetivo`, `natureza_da_retencao` — permanecem
  100% manuais, nenhuma mudança de comportamento.
- Ampliar a lista de palavras-chave por categoria além das citadas no
  critério 4/12 — calibração fina fica para quando houver taxa de falso
  negativo medida na prática, mesma doutrina do `CONTAI-062`/§3 nota final do
  ADENDO 5 do parecer de 2026-09-18.
- Botão "Tributo único" — o rótulo do botão não muda; o que muda é o VALOR
  que ele nasce marcando quando a sugestão existe.
- PDF sem camada de texto (scan/foto) — parser não roda, campos permanecem
  manuais, mesma limitação de sempre.

## Gate Fiscal (Contador)
**Parecer completo**: `docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`
(Pergunta 1). **Registro da divergência e da extensão da decisão**:
`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md` (ADENDO —
"a decisão do Mateus se estende ao `tributo`").

- O `contador` reprovou a sugestão de `tributo` **sem exceção**, no parecer
  original: mapear um rótulo em língua natural para 1 de 6 categorias legais
  fixas é interpretar texto livre contra taxonomia jurídica — categoricamente
  diferente de ler um fato aritmético (o teste que aprovou `retencaoNaNota`
  no ADENDO 5 do parecer de 2026-09-18). O próprio corpus do projeto já
  produziu um rótulo ambíguo/composto ("Total das Retenções (ISSQN /
  Federais)") que uma regra ingênua de palavra-chave classificaria errado —
  calando, em silêncio, a pendência de recolhimento certa (uma retenção
  parcialmente federal rotulada como puramente municipal).
- **O Mateus concordou com essa reprovação inicialmente** — o pedido original
  não virou ticket de auto-preenchimento. **Depois, no mesmo dia, estendeu a
  decisão que já tinha tomado para o CNO também ao tributo**, sobrepondo a
  reprovação — decisão de apetite de risco do dono do produto, registrada com
  transparência.
- **A diferença técnica entre `cnoNaNota` e `tributo` não desaparece com a
  decisão do Mateus — vira salvaguarda de implementação, obrigatória neste
  ticket**: `cnoNaNota` é igualdade EXATA de dígitos, sem meio-termo.
  `tributo` é mapear texto livre para 1 de 6 categorias — por isso a sugestão
  só existe sob match ÚNICO E EXCLUSIVO (critério 3), nunca por aproximação
  ou "categoria mais provável".
- Condição → consequência (verbo: **marcar**, sugestão editável, nunca fato
  até "Salvar registro" E até "Adicionar linha"): **SE** todos os rótulos
  empatados da linha casam com exatamente uma categoria, sem nenhum marcador
  de combinação, **E** `composicao` ainda está vazio **→** marca
  `composicao = "tributo_identificado"` e `tributo = <categoria>` juntos,
  como sugestão. **SE** houver ambiguidade, combinação ou nenhum match **→**
  os dois campos permanecem vazios, sem sugestão, sem aviso especial
  (silêncio simples).
- **Automático**: leitura do(s) rótulo(s) já colapsados da linha,
  classificação por palavra-chave exclusiva, preenchimento do par como
  sugestão.
- **Exige revisão humana** (do Mateus, não CRC): confirmar `composicao`,
  `tributo`, `eDescontoEfetivo` e `quemRecolhe` — os dois últimos continuam
  obrigatoriamente manuais, sem sugestão nenhuma, antes de "Adicionar linha".
- **Exige CRC**: nada novo — o parecer de 2026-09-18 (ADENDO 3/4) já cobre a
  confirmação de linhas combinadas com a contabilidade do prestador quando o
  caso concreto exigir; este ticket não fecha nem agrava essa dívida.
- `quem_recolhe`/`e_desconto_efetivo`/`natureza_da_retencao` continuam
  impossíveis de sugerir — decisão unânime entre `contador` e Mateus, sem
  divergência neste ponto.

## Pre-mortem
1. **Lista de palavras-chave envelhece na primeira prefeitura/emissor
   criativo.** Um rótulo real futuro pode nomear uma categoria com
   vocabulário que a regex não cobre (falso negativo, silêncio — seguro) ou,
   pior, um vocabulário novo pode casar por engano com uma palavra-chave de
   OUTRA categoria (falso positivo). Mitigado pelo critério 3(a) (marcadores
   de combinação vetam primeiro) e pela doutrina de calibração fora de escopo
   deste ticket — mas exige que qualquer ajuste futuro de vocabulário passe
   pelo `contador`, mesma regra do `RE_NAO_TRIBUTARIO`.
2. **Confundir INSS com ISS por substring.** As duas siglas compartilham
   três letras; um `.match(/ISS/i)` ingênuo casaria dentro de "INSS".
   Mitigado exigindo fronteira de palavra (`\b`) nas expressões — já nomeado
   como risco conhecido no parecer de 2026-09-18 ("Confundir INSS com ISS") e
   deve ser coberto por teste explícito (critério 12 já cobre "INSS Retido"
   isolado, mas o teste precisa provar que não colide com "ISS").
3. **Rótulo de PIS/COFINS/CSLL aparecer só como grupo em um emissor
   específico**, sem abertura individual — a regra do critério 4 trataria
   isso como combinação e não sugeriria nada, o que é o comportamento seguro,
   mas pode surpreender o Mateus esperando a mesma automação do
   CNO/retenção-ISS. Mitigação: nenhuma ação de código — é o comportamento
   correto (silêncio sob ambiguidade); registrar como expectativa a alinhar
   com o Mateus, não como bug.

## Viabilidade (CTO)
- **Modelo de dados**: nenhum impacto. `tributo_retido`
  (`lib/database.types.ts:1212`) já tem os 6 valores; a linha só chega ao
  banco no INSERT pós-documento do `CONTAI-053`. A sugestão vive no estado de
  `FormularioDeLinha` até "Adicionar linha".
- **Confirmação explícita, não implícita**: a linha só entra em
  `linhasPendentes` por "Adicionar linha", e `validarLinhaRetencao` já exige
  `eDescontoEfetivo` e `quemRecolhe` manuais (`retencao.ts`) — o Mateus toca
  o formulário obrigatoriamente antes de a sugestão virar linha. Isso é
  diferença estrutural favorável em relação ao `CONTAI-069` (onde a sugestão
  pode, em tese, sobreviver até "Salvar registro" sem mais nenhum toque).
- **Classificador**: arquivo novo `lib/extracao/tributo-rotulo.ts`, função
  pura `sugerirTributoDoRotulo(rotulos: readonly string[]): TributoRetido |
  null`. Três passos, nesta ordem: (1) marcador de combinação/agregação
  (`/federa|retenc[oõ]es|tributos|contribui[cç][oõ]es|csrf|\+|\//i`) em
  QUALQUER rótulo do conjunto → `null`; (2) contagem de categorias por
  palavra-chave com fronteira (`\b`) — `iss: /\bISS(QN|RF)?\b/i`,
  `inss: /\bINSS\b/i`, `irrf: /\bIR(RF|PJ)?\b/i`, `pis: /\bPIS\b/i`,
  `cofins: /\bCOFINS\b/i`, `csll: /\bCSLL\b/i` — exatamente UMA categoria em
  TODOS os rótulos, senão `null`; (3) termos sem categoria
  (`"CPP"`, `"Retido"`, `"Federal"` sozinhos) → `null`.
- **Entrada é o CONJUNTO de rótulos colapsados**, não só o primeiro.
  `sugerirLinhaRetencao` (`retencao-texto.ts`) já tem o `Set` internamente
  (usado no desempate do `CONTAI-068`) e hoje devolve só o primeiro rótulo —
  ganha campo aditivo `rotulosEmpatados: string[]` (ordem de aparição). Se
  "Valor ISS" e "ISSRF" colapsaram, os dois classificam como `iss` → sugere;
  se colapsarem rótulos de categorias DIFERENTES com valor igual, `null`.
- **Rota**: `app/api/sugerir-retencao/route.ts` devolve, na mesma resposta,
  `sugestao: { rotuloLiteral, valorCentavos, rotulosEmpatados }` e um campo
  IRMÃO `tributoSugerido: TributoRetido | null` — nunca dentro de
  `SugestaoLinhaRetencao` (o tipo garante, por construção, que
  `eDescontoEfetivo`/`quemRecolhe` não existem ali; o campo irmão deixa a
  exceção de `tributo` visível no tipo, em vez de escondê-la).
- **`app/_components/retencao.tsx` (`FormularioDeLinha`)**: `entrada` ganha
  companheiro `sugeridos: Set<"composicao" | "tributo">`; o bloco de render
  que já herda rótulo/valor só em campo vazio passa a herdar `composicao`+
  `tributo` juntos quando `entrada.composicao === null`. `mudar()` remove
  qualquer campo tocado do `Set`; trocar `composicao` manualmente já limpa
  `tributo` (comportamento existente). Os dois `Escolha` recebem `sugerido`.
  Troca de anexo zera `sugeridos` e os campos de origem sugerida voltam a
  `null`; resposta manual sobrevive.
- **Arquivos**: `lib/extracao/tributo-rotulo.ts` (+ `.test.ts`, corpus
  mínimo do critério 12), `lib/extracao/retencao-texto.ts` (+
  `rotulosEmpatados`, cabeçalho corrigido citando os dois pareceres e o
  ADENDO da decisão do Mateus), `app/api/sugerir-retencao/route.ts`,
  `app/_components/retencao.tsx`, `lib/fiscal/retencao.ts` (constantes de
  texto/ajuda), `e2e/captura-retencao-desktop.spec.ts` (≥880px, onde o
  `FormularioDeLinha` existe).
- **Complexidade**: M− (menor que o `CONTAI-069`: sem migração de estado com
  origem no `page.tsx`; o peso é o corpus de teste do classificador, que
  precisa ser desproporcional ao código porque é a única defesa contra
  classificação errada).
- **Dívidas criadas**: o critério 14 do `CONTAI-038` passa a ter uma exceção
  nomeada (`composicao`/`tributo`, sob as condições deste ticket) — resolvido
  pelo critério 11 deste ticket, atualizando o texto do `038` no mesmo commit
  em vez de deixar a contradição para o próximo Gate 0 achar.

## Dependências
- Bloqueado por: nenhum tecnicamente. `cto-obra` recomenda implementar DEPOIS
  do `CONTAI-069` — os dois estendem o mesmo `app/api/sugerir-retencao/route.ts`,
  sequenciar evita retrabalho de merge. Não é bloqueio duro.
- Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma bloqueante — Gates 1-4 fechados na mesma rodada. Confirmação
informal recomendada com o Mateus (não bloqueante): se PIS/COFINS/CSLL só
aparecerem como grupo combinado nos próximos documentos reais, a automação
ficará silenciosa nesses casos por desenho (Pre-mortem 3), não por bug.

## Cenário e checagem final
**Captura** (`/adicionar/documento`, ≥880px onde o `FormularioDeLinha` já é
visível — mesma regra de largura do `CONTAI-053`/`062`, não reaberta aqui) e
gestão (`/documento/[id]`, mesma tela de linha de retenção). Não introduz
fluxo novo nem densidade nova — sugestão a mais dentro de um formulário que
já existe. O "Teste do Canteiro" não é a régua aqui (a tela só aparece em
largura ≥880px, que já não conta como captura de uma mão).

**Varredura de condição fiscal órfã**: todo critério com obrigação/proibição
fiscal (2, 3, 4, 5, 6, 8, 9, 11, 12) cita, na mesma frase ou no Gate Fiscal
acima, o parecer `docs/pareceres/2026-09-27-extracao-tributo-e-cno.md` e/ou o
backlog `docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`.
Nenhuma condição fiscal órfã encontrada.

**Veredito: APROVADO**, com a mesma ressalva do `CONTAI-069`: este ticket
implementa uma decisão de produto que **sobrepõe** a recomendação do
`contador` — registrada com transparência, responsabilidade da escolha
atribuída ao Mateus. A salvaguarda técnica (match único e exclusivo, silêncio
sob ambiguidade) é condição de aceite, não sugestão opcional. Nenhuma
mudança em documentação hábil, nenhuma mudança em acervo, sem migration.

## ✅ Entregue em 2026-09-27

⚠️ **Nota de transparência, igual à do `CONTAI-069`**: este ticket implementa
uma automação que o `contador` **reprovou sem exceção**
(`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`, Pergunta 1, citando o
critério 14 do `CONTAI-038`) e que o Mateus decidiu construir mesmo assim,
estendendo ao tributo a mesma sobreposição de recomendação fiscal já feita
para o CNO (`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`,
ADENDO). A decisão de implementar é do Mateus, registrada por inteiro nesse
mesmo arquivo; este Gate 4 confirma que o CÓDIGO entregue bate com as
salvaguardas que o próprio ticket exigiu para tornar essa decisão aceitável —
não reabre a discussão de mérito.

`sugerirTributoDoRotulo` (novo, `lib/extracao/tributo-rotulo.ts`) recebe o
CONJUNTO de rótulos empatados da linha (`rotulosEmpatados`, campo novo
aditivo de `SugestaoLinhaRetencao`, `lib/extracao/retencao-texto.ts` —
`sugerirLinhaRetencao` já tinha o `Set` internamente desde o `CONTAI-068` e
hoje devolve só o primeiro rótulo junto com o conjunto inteiro) e devolve 1 de
6 categorias ou `null`, em três passagens: (1) marcador de
combinação/agregação (`reten[cç][oõ]es|tributos|contribui[cç][oõ]es|federa|
\bcsrf\b|\+|\/`) em QUALQUER rótulo do conjunto vence primeiro, antes de
contar categoria nenhuma; (2) exatamente UMA categoria por palavra-chave com
fronteira de palavra (`\b`) — mitigação nomeada contra a colisão ISS×INSS —,
a MESMA em todos os rótulos empatados; (3) o que sobra é a categoria, nunca
"a mais provável". O contraexemplo real do parecer, "Total das Retenções
(ISSQN / Federais)" (com e sem acentuação), produz `null`, testado byte a
byte, junto com "ISS/INSS", "CSRF", "Retenções Federais", "Contribuições
Sociais Retidas" e rótulos empatados de categorias diferentes.

A rota `/api/sugerir-retencao` devolve `tributoSugerido: TributoRetido | null`
como campo **IRMÃO** de `sugestao`, nunca dentro de `SugestaoLinhaRetencao` —
**divergência do mock original registrada e julgada melhoria legítima no Gate
2**: o mock (`design/mocks/CONTAI-070.md`, §1) desenhava `categoriaSugerida`
DENTRO do tipo da sugestão; a implementação move para um campo irmão porque
`SugestaoLinhaRetencao`/`SugestaoDeLinha` são a trava do Gate Fiscal do
`CONTAI-055` — o tipo garante, por construção, que `eDescontoEfetivo` e
`quemRecolhe` não existem ali, e enfiar a categoria sugerida lá dentro
esconderia a exceção que o Mateus abriu, em vez de deixá-la visível no tipo
da resposta. `linhaSugerida` (`lib/fiscal/retencao.ts`) ganha um segundo
parâmetro (`tributoSugerido`, default `null`) que preenche `composicao` e
`tributo` juntos, nunca meio par — o CHECK `documento_retencao_tributo_
coerente` fica satisfeito por construção.

`FormularioDeLinha` (`app/_components/retencao.tsx`) ganha estado único
`origemComposicaoTributo: "manual" | "sugerida" | null` para os DOIS campos —
estruturalmente impossível representar um sugerido e o outro manual. Tocar em
qualquer um dos dois (mesmo a opção já sugerida) confirma o PAR inteiro como
manual. Troca de anexo zera só a parte SUGERIDA (a manual sobrevive, mesma
assimetria do Gate 2 do `CONTAI-062`). `eDescontoEfetivo`/`quemRecolhe`
seguem 100% manuais e obrigatórios antes de "Adicionar linha", sem nenhuma
mudança de comportamento — a linha sugerida continua reprovando em
`validarLinhaRetencao` até o humano responder os dois. Critério 14 do
`CONTAI-038` recebeu exceção nomeada no próprio arquivo do ticket, apontando
para este.

**Ação do Gate 2 executada**: achado não-bloqueante do `cto-obra` —
`/\bIR(RF|PJ)?\b/i` é case-insensitive numa sigla de só 2 letras e casaria o
verbo comum "ir" (ex. "Valor a ir" sugeriria IRRF por engano); risco baixo na
prática porque o rótulo ainda precisa fechar a aritmética total−líquido do
parser e passar pelo veto de `RE_NAO_TRIBUTARIO` antes de chegar ao
classificador. Registrado como dívida nomeada **D88** em `docs/backlog.md`
(não implementado — é vocabulário de classificação fiscal, exige olhar do
`contador` antes de mexer na regex).

**Arquivos alterados após o último APPROVE do `cto-obra`**: nenhum. A lista de
arquivos tocados é exatamente a do corpo deste ticket
(`lib/extracao/tributo-rotulo.ts`+`.test.ts`, `lib/extracao/retencao-texto.ts`
+`.test.ts`/`-real.test.ts`, `app/api/sugerir-retencao/route.ts`,
`lib/fiscal/retencao.ts`+`.test.ts`, `app/_components/retencao.tsx`,
`app/(captura)/adicionar/documento/page.tsx`, `e2e/pdf-sintetico.ts`,
`e2e/captura-retencao-desktop.spec.ts`, `docs/tickets/CONTAI-038.md`), sem
diferença entre o que o Gate 2 aprovou e o que chegou a este Gate 4.

**Testes**: `npm run test` (Vitest) — **1185/1185** (39 arquivos). `npm run
test:e2e` completo, stack local de pé — **373/373**, incluindo os quatro casos
novos da seção 8 (`e2e/captura-retencao-desktop.spec.ts`, 8.1–8.4: match único
sugere o par; tocar em um confirma os dois; rótulo ambíguo não sugere nada,
sem aviso; troca de anexo mata só a parte sugerida). `npm run lint` e `npm run
typecheck` limpos. `npm run quality` completo rodado nesta sessão, com o
stack local de Docker de pé, todos os passos verdes.

**Pendências**: nenhuma bloqueante. **D88** (regex de IRRF sem fronteira de
maiúsculas na sigla nua "IR") fica sem ticket até passar pelo `contador`.
