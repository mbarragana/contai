# CONTAI-031 E2E da condição 6 do Gate Fiscal (CONTAI-028) — correção de classificação, mais guarda da D43

## Tipo e Prioridade
chore — **P1** — fecha um buraco de cobertura de uma regra fiscal já
implementada e correta; não é P0 porque o código está certo hoje, o que falta
é rede ("P0 neste projeto é número errado na frente do Mateus" — Gate 4 do
`CONTAI-029`, `docs/backlog/20-2026-08-23-gate4-contai-029.md`).

## Dor de Origem
**D42**, `docs/backlog/20-2026-08-23-gate4-contai-029.md`: o mapa das 16
condições do Gate Fiscal do `CONTAI-028`, no cabeçalho de
`lib/dados/comum.test.ts`, marca a condição 6
(`corrigirClassificacaoDoDocumento`) como **"não — I/O, e hoje sem rede
nenhuma"** — zero cobertura para "só classificação muda → `p_anos: []`.
Nenhum total se move, logo nenhuma pendência nasce. Passar `anos` aqui
inventa retificadora."

**D43** (metade barata, mesma entrada): a asserção de formato-texto do rastro
em `lib/dados/comum.test.ts:275` só vale como prova porque aponta
`e2e/correcao.spec.ts` como o call-site real — e essa asserção real, hoje,
não tem guarda contra ser "simplificada" para `Number(...)`, o que mataria em
silêncio a prova de que `p_depois` sai como texto de duas casas.

## User Story
Como dono da obra que revisa o acervo antes da declaração (gestão, em casa,
sentado), quero que a correção de classificação de um documento (material ↔
mão de obra) nunca abra pendência de retificadora nem grave ano afetado, e
quero essa garantia provada contra o banco de verdade — para que uma
regressão futura (ex.: a fatia 5 do `CONTAI-028`) seja pega por teste, não
pelo Mateus na hora de montar a discriminação.

## Critérios de Aceite
1. [ ] E2E em `e2e/correcao.spec.ts`, contra o Postgres local (sem stub),
       exercitando a tela `/documento/[id]/corrigir/classificacao`.
2. [ ] **Given** documento com `classificacao: "material"`, vinculado a
       pagamento com `data_pagamento` de ano **anterior** ao ano corrente do
       teste — calculado (`new Date().getFullYear() - 1`, padrão de
       `e2e/acervo.spec.ts:241-242`), **nunca hardcoded** — **When** corrige
       para `"mao_obra"` pela tela — **Then** `documento.classificacao` grava
       `"mao_obra"` (`docs/tickets/CONTAI-028.md` tabela de 16 condições +
       `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` §1).
       Este é o cenário mais forte possível: como a RPC não olha vínculos ao
       gravar classificação, só um vínculo em ano passado torna uma
       regressão futura observável.
3. [ ] **Then**: `revisoes(db)` ganha exatamente **1** linha
       (`entidade: "documento"`, `campo: "classificacao"`,
       `antes: "material"`, `depois: "mao_obra"`) — rastro obrigatório mesmo
       sem número se mover (mesmo parecer §5). **Asserção de presença antes
       das de ausência** (critérios 4-5) — provar "zero linhas" antes de
       provar que o ato gravou é asserção vazia.
4. [ ] **Then**: `anosAfetados(db)` **não ganha linha nova** — `p_anos: []`
       (condição 6). Critério distinto do 5, não substituível por ele: uma
       regressão que grave `revisao_ano_afetado` com `pendencia_id: null`
       passaria despercebida se só o critério 5 existisse.
5. [ ] **Then**: `pendencias(db)` **não ganha linha nova**.
6. [ ] **Then**: a tela mostra a confirmação de gravação (padrão já usado no
       spec, `getByRole("status")`) — prova que o caminho passou pela UI
       real, não por chamada direta à função.
7. [ ] **Comentário-guarda** na asserção `depois: "12800.00"` do teste de
       correção de **valor** já existente no mesmo arquivo (âncora pelo
       conteúdo da asserção, não por número de linha — o teste novo desloca
       a numeração do próprio arquivo no mesmo diff), com três pontos: (a)
       essa linha prova, contra o Postgres local, que `p_depois` sai como
       texto de duas casas (condição 4a,
       `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` §5);
       (b) não pode virar `Number(...)` — mataria a prova em silêncio,
       porque `Number("12800")` e `Number("12800.00")` são iguais; (c) é o
       par, do lado do call-site, do comentário-guarda já existente em
       `lib/dados/comum.test.ts` perto da linha 275.
8. [ ] `npm run test:e2e` verde com o teste novo, stack local de pé.

## Out of Scope
- Extração de `textoDoRastro` (raiz estrutural da D43) — fica para a fatia 5
  do `CONTAI-028`; este ticket resolve só a fragilidade da asserção com
  comentário, não com refactor.
- As outras 9 condições marcadas "não — I/O" no mapa de
  `lib/dados/comum.test.ts` (2, 5, 7, 8, 10, 11, 13, 15, 16) — dor separada,
  sem entrada de backlog própria ainda.
- Qualquer mudança em `lib/data.ts` ou `lib/dados/comum.ts` — teste +
  comentário, não altera comportamento.
- Documento com pagamentos vinculados em mais de um ano — a RPC grava só a
  partir do array `p_anos` recebido (sempre `[]` aqui), então o número de
  vínculos não muda o caminho de código exercitado nem o resultado esperado.
  Multiplicar vínculos no cenário testaria a mesma asserção duas vezes.
- Nova tela: `/documento/[id]/corrigir/classificacao` já existe.

## Gate Fiscal (Contador) — FECHADO
**Sem regra nova — verificação de regra já adjudicada.** Fixada em
`docs/tickets/CONTAI-028.md` (tabela de 16 condições) e
`docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` §1 ("muda a
composição, não o total; pendência persistente só nasce quando a correção
muda um NÚMERO que foi ou será declarado"). Confirmado contra o código hoje:
`corrigirClassificacaoDoDocumento` (`lib/data.ts:528-533`) passa `p_anos: []`
literal, sem consultar vínculo ou pagamento — a RPC `corrigir_documento`
(migration 0009) só grava a partir do que vier em `p_anos`, não deriva nada
por conta própria. Este ticket congela esse contrato num teste, não decide
fato fiscal novo. Automático, sem exigência de revisão humana (CRC).

## Pre-mortem
1. O cenário esquece o pagamento vinculado em ano **anterior** — sem esse
   ingrediente, o teste passaria mesmo com uma regressão futura. Guarda:
   critério 2, explícito na descrição do cenário.
2. O teste checa só ausência de pendência e não ausência de linha em
   `revisao_ano_afetado` — uma regressão que grave `revisao_ano_afetado` com
   `pendencia_id: null` passaria despercebida. Guarda: critérios 4 e 5
   distintos, não fundidos.
3. Este teste prova a fiação de **hoje**. A fatia 5 do `CONTAI-028` move
   `corrigirClassificacao` para fora de `lib/data.ts` — se esse movimento
   religar o cálculo de `anos` por um caminho comum às três correções, o
   teste só pega a regressão se rodar **depois** do movimento. Por isso este
   ticket bloqueia a fatia 5, não o contrário (ver Dependências).

## Viabilidade (CTO)
**Complexidade: S.** Sem UI nova, sem migration, sem app code — o
comportamento sob teste já existe inteiro; o ticket congela o contrato, não
o cria. `e2e/privilegios.spec.ts` e a ordem de release (db push antes de git
push) são irrelevantes aqui.

**Arquivos**: só `e2e/correcao.spec.ts` (teste novo + comentário-guarda).
`anosAfetados`, `pendencias` e `revisoes` já existem em `e2e/banco.ts` e já
são importados neste spec.

**Notas técnicas**:
1. Ano do pagamento calculado (`new Date().getFullYear() - 1`) — os testes
   existentes no mesmo spec usam data hardcoded; não migrar aqui, fora de
   escopo.
2. Âncora do comentário-guarda é o **conteúdo** da asserção
   (`depois: "12800.00"`), não o número da linha.

**Dívidas criadas**: nenhuma. Paga a D42 inteira e a metade barata da D43; a
metade cara (`textoDoRastro`) permanece registrada na fatia 5 do `CONTAI-028`.

## Dependências
- **`CONTAI-031` bloqueia a fatia 5 do `CONTAI-028`** (mover `correcao.ts` +
  `pendencia.ts` para fora de `lib/data.ts`) — rede antes do refactor, nunca
  depois: teste escrito por quem acabou de mover o código prova a
  movimentação, não a regra.
- Bloqueado por: nenhum.
- **Efeito colateral obrigatório no Gate 1**: `docs/tickets/CONTAI-028.md`
  (seção Dependências, linha ~302) hoje diz "Bloqueia: nenhum / Bloqueado
  por: nenhum ticket" — desatualizado. Atualizar no mesmo commit deste
  ticket: "fatia 5 bloqueada por `CONTAI-031`".

## Perguntas Abertas
Nenhuma — escopo fechado pela entrada de backlog D42/D43; ambos os itens
descrevem comportamento já adjudicado pelo `contador`, sem regra nova a
validar no Gate 2, só citação correta pelo caminho.

## Cenário e checagem final
Sem UI nova — a tela já existe, este ticket só a exercita via E2E. Gate de
Design (`designer`) não se aplica. Teste do Canteiro não se aplica (teste
automatizado, sem operador). Serve à meta 2 (composição material×mão de obra
da discriminação) e à meta 3 (acervo/rastro que sobrevive à decadência,
protegendo o formato de texto que sustenta conversa de retificadora anos
depois).

**Veredito: APROVADO.**
