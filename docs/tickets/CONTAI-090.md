# CONTAI-090 Quebrar "Excedente da nota" entre fornecedor e retenção a recolher

## Tipo e Prioridade
feature (apresentação) — P2 — clareza de leitura, zero obrigação fiscal: o
valor agregado já está certo, nenhum cálculo de custo comprovado muda.

## Dor de Origem
`docs/backlog/105-2026-10-10-excedente-nota-nao-compoe-retencao-pendente.md`.
Depois de corrigir o valor da nota PerfuraTec, o Mateus leu o banner âmbar
"Excedente da nota: R$34.901,00 — nota ainda não paga" e reagiu: *"para mim
aquele dizer em âmbar não faz sentido, porque não é os 34mil referente a
nota, é 33 e pouco referente a nota e 1797 referente ao ISS"*. O banner trata
como uma coisa só duas pendências de natureza diferente: R$33.103,97 a pagar
ao fornecedor (pré-vínculo PerfuraTec) e R$1.797,03 de ISS retido que o
próprio Mateus vai recolher (`quem_recolhe='eu'`, guia ainda não paga).

## User Story
Como Mateus, revisando o detalhe de um documento em casa (cenário gestão,
sentado, com calma), quando a nota tem simultaneamente (a) saldo a pagar ao
fornecedor e (b) uma retenção no estado `eu_sem_guia`, quero que o bloco
"Excedente da nota" mostre essas duas pendências como linhas nomeadas, em vez
de um total único — para não precisar refazer de cabeça a conta que o
sistema já tem os dois números para fazer.

## Critérios de Aceite
1. [x] Spec nível 2 em `design/mocks/CONTAI-090.md` — delta no card
   `PagamentosDesteDocumento` (`app/(gestao)/documento/[id]/page.tsx:288-302`).
   Sem rota, sem campo, sem estado novo — condição de existir do bloco
   continua `alocado && faltaPagamentoCentavos > 0`.
2. [x] Função pura nova `quebrarExcedenteDaNota` em `lib/fiscal/retencao.ts`
   (ao lado de `motivoDaRetencaoDoDocumento`), assinatura:
   ```ts
   export type QuebraDoExcedente =
     | { quebra: false; motivo: "sem_retencao_eu_sem_guia" | "retencao_excede_falta" }
     | { quebra: true;
         aPagarAoFornecedorCentavos: number;
         porTributo: { rotulo: string; valorCentavos: number }[] };

   export function quebrarExcedenteDaNota(
     linhas: readonly Pick<LinhaRetencao, "eDescontoEfetivo" | "quemRecolhe" | "composicao" | "tributo" | "valorCentavos">[],
     faltaPagamentoCentavos: number,
   ): QuebraDoExcedente
   ```
   Invariante: `aPagarAoFornecedorCentavos + Σ porTributo.valorCentavos === faltaPagamentoCentavos`
   sempre que `quebra: true`. A função não lê nem altera `alocarCusto`.
3. [x] Identificação do estado usa **só** `motivoDaRetencaoAberta(linha, notaCoberta) === "eu_sem_guia"`
   (`lib/fiscal/retencao.ts:675`) — proibido reimplementar
   `eDescontoEfetivo && quemRecolhe === "eu"` (já duplicado em
   `app/_components/retencao.tsx:288`; não criar uma terceira cópia).
   `notaCoberta` deriva de `faltaPagamentoCentavos <= 0` — nenhuma segunda soma.
4. [x] Linhas `eu_sem_guia` do mesmo tributo somam num único item, rotulado
   por `nomeDaRetencao(linha)` — **exceto** quando `nomeDaRetencao` devolveria
   "retenção não discriminada, presumivelmente recolhida por terceiros"
   (composição não discriminada), caso em que o rótulo usado é a nova
   constante `ROTULO_RETENCAO_NAO_DISCRIMINADA_RECOLHEDOR_CONFIRMADO` =
   "retenção não discriminada" (sem o sufixo contraditório — ver Gate Fiscal,
   D92). Tributos distintos geram um item por tributo, ordem de 1ª
   ocorrência na nota. Nunca um item "retenção" genérico somando tributos
   diferentes.
5. [x] Quando `aPagarAoFornecedorCentavos === 0` (caso Francisco/JA SILVA), a
   linha "A pagar ao fornecedor" e seu parágrafo **não aparecem** — nunca
   "R$ 0,00 — nota ainda não paga".
6. [x] Quando `Σ porTributo > faltaPagamentoCentavos` (dado contraditório), a
   função devolve `{quebra: false, motivo: "retencao_excede_falta"}` e o
   bloco é exibido **sem alteração** (valor único, texto atual) — nenhum
   texto novo inventado para esse caso; registrado como dívida (critério 12).
7. [x] Quando não há nenhuma linha `eu_sem_guia` (caso comum), o bloco
   continua **byte a byte** igual a hoje: uma linha "Excedente da nota:
   R$(valor) — nota ainda não paga" com o texto de consequência atual.
8. [x] A linha "A pagar ao fornecedor" mantém o texto de consequência atual
   do bloco ("Este pedaço da nota não vira custo: regime de caixa — sem
   desembolso não há dispêndio. Ele passa a contar quando o pagamento
   existir e for ligado aqui.", `page.tsx:296-300`, inalterado) — agora
   cobrindo só a fatia do fornecedor, não o total.
9. [x] A(s) linha(s) de retenção levam o chip `CHIP_RETENCAO_GUIA_PENDENTE`
   (`retencao.ts:278`), cor de `TEXTO_DA_RETENCAO_ABERTA.eu_sem_guia.gravidade`
   — nunca `"amb"` literal escolhido na tela. **Sem repetir o parágrafo**
   `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA` neste card: ele já existe na mesma
   tela, no card da própria linha (`BlocoRetencao`, `page.tsx:652`,
   `data-motivo="eu_sem_guia"`) — repetir seria ruído, não erro, mas a
   decisão do `cto-obra` é não repetir.
10. [x] Atributos `data-excedente="fornecedor"` / `data-excedente="retencao"`
    no padrão já usado por `data-retencao="sobrecoberta"`.
11. [x] Vitest em `lib/fiscal/retencao.test.ts` cobre os 8 casos: (i) zero
    linha `eu_sem_guia` → `quebra:false`; (ii) linha `eu` com
    `eDescontoEfetivo=false` → `quebra:false`; (iii) 1 linha ISS, falta > Y →
    X>0, 1 item; (iv) 1 linha ISS, falta == Y → X=0, 1 item; (v) 2 linhas ISS
    → 1 item somado; (vi) ISS + INSS → 2 itens, ordem estável; (vii) ΣY >
    falta → `motivo:"retencao_excede_falta"`; (viii) invariante X + ΣY =
    falta em (iii)-(vi).
12. [x] `e2e/retencao.spec.ts:813-824` (caso Francisco/JA SILVA, X=0) é
    **reescrito**: a asserção de `"nota ainda não paga"` visível passa para
    `toHaveCount(0)`, e o card passa a mostrar só o chip "Guia de retenção
    pendente" + R$540,00. Teste novo cobre X>0 + Y com pagamento parcial,
    ponta a ponta contra o Postgres local.
13. [x] Nenhum teste existente de `alocarCusto`/`vinculo.ts` muda de valor
    esperado — a mudança é só em `lib/fiscal/retencao.ts` (nova função pura)
    e na camada de apresentação de `app/(gestao)/documento/[id]/page.tsx`.

## Out of Scope
- Qualquer mudança em `alocarCusto`, `explicadoPorRetencaoCentavos` ou
  `faltaPagamentoCentavos` em `lib/fiscal/vinculo.ts` — valores agregados já
  corretos; o ticket só decompõe a apresentação.
- Revisão da doutrina do ADENDO 9 sobre quando retenção "quita"/abate custo —
  intocada.
- Generalizar a quebra para `quem_recolhe='a_empresa'` (dívida da empresa, não
  pendência do Mateus) ou `'nao_sei'`/estado `sem_recolhedor` (pendência de
  *identificação*, chip e texto já são outros, Estado A) — nenhum dos dois
  tem dor de origem relatada.
- Reescrever ou parafrasear `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA`/
  `CHIP_RETENCAO_GUIA_PENDENTE` — usados verbatim.
- Mudar o comportamento do chip/texto em `/despesas` — este ticket só estende
  o reuso para o detalhe do documento.
- Qualquer ação de "resolver" a pendência direto desta tela (vincular guia
  paga) — este ticket é só leitura/apresentação.

## Gate Fiscal (Contador)

**1. Impacto fiscal — CONFIRMADO, zero risco.** `cobertoCentavos` e
`faltaPagamentoCentavos` (`vinculo.ts:841-845`) não mudam. `porRetencaoDaNota`
só é alimentado por `retencaoContaComoPerna`, que **exclui por construção**
`quem_recolhe='eu'` (ADENDO 3 — "a exclusão de 'eu' é DE ESTADO, não de
tempo"). Toda fatia `eu_sem_guia` já está, hoje, dentro de
`faltaPagamentoCentavos`, nunca em `explicadoPorRetencaoCentavos`. Decompor a
exibição é reagrupar na tela um número que o cálculo já produz — sem risco
de dupla contagem, porque as duas linhas somadas são sempre subconjunto do
mesmo `faltaPagamentoCentavos`, nunca duas fontes independentes.

**2. Texto — serve verbatim, sem adaptação.** `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA`
(citação literal do ADENDO 4, Pergunta 3, protegida por teste byte-a-byte) já
é genérica quanto a onde aparece — fala de "esta fatia"/"este documento", não
da lista `/despesas` especificamente. Mudar de contexto (lista → card do
documento) não fere as duas proibições do ADENDO 4 Pergunta 5 (não sugerir
"sem confirmar", não sugerir "resolvido"). Nenhuma variação registrada — usar
a constante como está.

**3. Agregação por tributo — regra NOVA do contador (CONTAI-090, não citação
de parecer anterior).** Hoje hipotético (nenhum documento real relatado com
2 tributos `eu_sem_guia` simultâneos), mas o produto já pressupõe N linhas
"eu recolho" no mesmo documento (`RETENCAO_FECHA_POR_NOTA`). Regra: linhas do
mesmo tributo (mesmo `nomeDaRetencao`) somam num valor só; tributos
identificados diferentes (ex. ISS + INSS) quebram em uma linha por tributo —
fundir tributos já abertos na nota reproduziria, em escala menor, a mesma
opacidade que motivou o ticket. Implementar a agregação por `nomeDaRetencao`
desde já (barato fazer certo agora), mesmo sem caso real hoje.

**4. D92 — achado durante a ratificação, correção já decidida.** Linha
`eu_sem_guia` com composição não discriminada faz `nomeDaRetencao` devolver
"retenção não discriminada, presumivelmente recolhida por terceiros" — rótulo
que contradiz o que o Mateus já confirmou (`quem_recolhe='eu'`). Correção:
nova constante `ROTULO_RETENCAO_NAO_DISCRIMINADA_RECOLHEDOR_CONFIRMADO` =
"retenção não discriminada" (sem o sufixo), usada neste ticket (critério 4) e
também nos pontos pré-existentes `app/_components/retencao.tsx:444`/`:1084`
(registrado como D92 em `docs/backlog.md`, corrigir os dois pontos juntos
neste ticket já que a constante nasce aqui).

**5. Sem parecer novo necessário** — aplicação de regras já normatizadas
(CONTAI-056 ADENDO 3, CONTAI-059 ADENDO 4) a uma nova superfície de tela, mais
a regra de agregação nova acima (citar como "regra do contador, CONTAI-090",
não como citação de parecer antigo).

## Pre-mortem
1. **"A pagar ao fornecedor" pode esconder múltiplos pré-vínculos como se
   fosse um valor único.** Mitigação: critério de aceite não exige
   detalhamento por pré-vínculo — só que X seja o residual após subtrair a
   fatia de retenção; detalhamento fica para decisão futura de design.
2. **Caso real X=0 (Francisco/JA SILVA) não é hipotético** — é o teste E2E
   já existente, que quebra com a mudança (não é "zero regressão", é
   reescrita necessária). Coberto pelos critérios 5 e 12.
3. **ΣY > falta (dado contraditório)** daria X negativo se não tratado —
   coberto pelo critério 6 (função devolve `quebra:false`, sem inventar
   texto).

## Viabilidade (CTO)
- **Modelo de dados**: zero migration, zero schema, zero query nova.
  `documento.retencoes` já vem embutido no `Documento`;
  `faltaPagamentoCentavos` já é calculado em `DocumentoAlocado`
  (`vinculo.ts:485-516`). 100% apresentação.
- **Cadeia até a tela**: `page.tsx:444 alocarCusto(estado.painel)` →
  `:445 alocacao.porDocumento.get(d.id)` → prop `alocado` de
  `PagamentosDesteDocumento` (`:140`) → bloco `:288-302`. `documento` já é
  prop do mesmo componente.
- **Arquivos**: `lib/fiscal/retencao.ts` (+função e tipo),
  `lib/fiscal/retencao.test.ts`, `app/(gestao)/documento/[id]/page.tsx`
  (bloco `:288-302`), `app/_components/retencao.tsx` (D92, pontos `:444`/
  `:1084`), `e2e/retencao.spec.ts`.
- **Complexidade**: S (~40 linhas de lib, ~15 de tela, testes).
- **Dívida criada**: Σ `eu_sem_guia` > `faltaPagamentoCentavos` (dado
  contraditório, espelho `eu` da `RETENCAO_SOBRECOBERTA`) é só detectada
  (`quebra:false`), não textualizada em tela — registrar no backlog se
  aparecer um caso real.

## Dependências
Bloqueado por / Bloqueia: nenhum.

## Perguntas Abertas
- Rótulo de grupo adotado pelo designer: `"${nomeDaRetencao(linha)} a
  recolher (guia pendente)"` (ex. "ISS a recolher (guia pendente)"), não o
  genérico do relato — necessário para diferenciar 2+ grupos no estado (d).
  Pergunta ao `contador`, não bloqueante: esse padrão mantém a cautela do
  ADENDO A.2 (nunca compor "guia de X" quando a composição não é
  discriminada)? Quando a composição não é discriminada o rótulo já cai para
  "retenção não discriminada a recolher (guia pendente)" (critério 4), que
  não nomeia tributo — então não há conflito com A.2 nesse caso.

## Cenário e checagem final
**Gestão** — `/documento/[id]`, revisão de documento, sentado, nunca
captura.

Varredura de condição fiscal órfã (`grep -rniE` do `/tickets-req`): toda
condição citada acima está amarrada a Gate Fiscal próprio (seção acima) ou a
parecer existente (ADENDO 3/4 do CONTAI-056/059) — nenhuma condição nova sem
parecer, exceto a regra de agregação por tributo e a correção D92, ambas
explicitamente marcadas como "regra do contador, CONTAI-090" e não citação de
parecer anterior.

Veredito: **APROVADO**.

---

## Design (nível 2)
Spec completo em `design/mocks/CONTAI-090.md`. 5 estados (sem quebra; 1 grupo
X>0; X=0; 2+ tributos; dado contraditório), hierarquia fornecedor-antes-de-
retenção, zero texto fiscal novo reescrito.

## Status: DONE (2026-10-10)

- **Gate 0** — spec nível 2 já existia em `design/mocks/CONTAI-090.md` antes
  do `/develop` começar. OK.
- **Gate 1 (lead-engineer)** — DONE. Implementou `quebrarExcedenteDaNota` +
  `QuebraDoExcedente` em `lib/fiscal/retencao.ts`, a constante D92
  `ROTULO_RETENCAO_NAO_DISCRIMINADA_RECOLHEDOR_CONFIRMADO`, o card
  `ExcedenteDaNota` em `app/(gestao)/documento/[id]/page.tsx`, a correção D92
  nos dois pontos pré-existentes de `app/_components/retencao.tsx` (`:444`/
  `:1084`), 10 casos novos em `lib/fiscal/retencao.test.ts`, ajuste de guarda
  em `lib/fiscal/terreno.test.ts`, e reescreveu `e2e/retencao.spec.ts` (caso
  Francisco/JA SILVA + teste novo X>0+Y). Sem retrabalho.
- **Gate 2 (cto-obra + subagent contador)** — APPROVE de primeira. Confirmou
  a invariante do critério 2, a agregação por tributo, a correção D92, que
  `lib/fiscal/vinculo.ts`/`vinculo.test.ts` ficaram com diff vazio (critério
  13), e que o card não repete `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA`. O
  `contador` aprovou fiscalmente e respondeu a Pergunta Aberta do ticket: o
  padrão de rótulo "ISS a recolher (guia pendente)" respeita o ADENDO A.2.
  Registrou dívida não bloqueante, fora de escopo: com `quem_recolhe=
  'a_empresa'` o rótulo ainda diz "presumivelmente" — não é D92, é dívida
  nova se quiserem fechar depois.
- **Gate 3 (testes de fluxo)** — suíte Playwright completa (mobile+desktop)
  rodada duas vezes pelo orquestrador: 1ª rodada 492 passed + 2 falhas por
  timeout em specs não relacionados (`cartao-lote.spec.ts`, `cno.spec.ts`);
  reexecutados isolados, os dois passaram — flake confirmada, não é
  regressão deste ticket. `e2e/retencao.spec.ts` 21/21 contra o Postgres
  local.
- **Gate 4 (po)** — PASS, 13/13 critérios, validados item a item contra o
  ticket e o spec do mock, com `git diff --stat` conferido (nenhum arquivo
  fora do escopo esperado, `vinculo.ts` sem diff). "Arquivos alterados após
  o último APPROVE": nenhum.
- **`npm run quality`** (lint + typecheck + unit + E2E) rodado pelo
  orquestrador depois do Gate 4, inteiro verde: Vitest 1410/1410, Playwright
  494/494 (mobile+desktop), sem a flake da rodada anterior.
- **Migration**: nenhuma — mudança só de apresentação (critério 1).
- **Dívida nova, não bloqueante, fora de escopo**: rótulo de retenção ainda
  diz "presumivelmente recolhida por terceiros" quando `quem_recolhe=
  'a_empresa'` — achado pelo `contador` no Gate 2, registrar em
  `docs/backlog.md` se aparecer caso real que peça a correção.
