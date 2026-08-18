# CONTAI-006 — Estados de rede lenta e indisponível

## Tipo e Prioridade

feature (usabilidade / confiabilidade) — **P1**. Bloco "Depois", primeiro item
depois de CONTAI-010 e CONTAI-011.

Origem: achado do **Gate 3 do CONTAI-001**, virado ticket no Gate 4 (2026-08-08).

- **Gate 0 (mock)**: **NÃO exige mock.** Não há tela, fluxo nem campo novo — são
  **estados de telas que já existem**, e o padrão de erro com "Tentar de novo" já
  está aprovado nos mocks do 001/003. **Exige aprovação de texto**: as frases de
  espera e de erro são lidas num momento de frustração.
- **Gate Fiscal**: **SEM IMPACTO.** Nenhum dado fiscal muda. Dizer isso
  explicitamente evita que alguém invente um gate para se sentir seguro.
  ⚠️ **Ressalva de fronteira**: se a solução incluir *fila de gravação offline*, o
  Gate Fiscal **reabre** (dado fiscal gravado depois, com qual data?). Por isso
  está em Out of Scope.

## Dor de Origem

Achado do Gate 3, medido: o E2E "banco fora, com saída" leva **7,8 s** —
retry do postgrest-js, **1 s + 2 s + 4 s**.

> "**Não é aceitável — mas o problema não é a duração, é a mentira.** Durante os
> 7,7 s a tela diz 'Carregando a obra' quando, a partir do primeiro segundo, ela
> já sabe que a primeira tentativa falhou."

E o sintoma esconde pior: **nenhuma tela tem teto de espera.** Numa 4G ruim o
"Carregando a obra" pode durar **indefinidamente**.

## O que mudou desde o Gate 3 — e reprecifica o ticket

1. ⚠️ **O app está em PRODUÇÃO** (17/08). O achado deixou de ser hipótese de
   laboratório: é o que o Mateus encontra quando o Supabase está lento, quando o
   projeto acorda de pausa (CONTAI-012), ou quando a rede oscila.
2. **A premissa de cenário caiu** (18/08). O argumento original era *"3 s de
   spinner mudo e ele guarda o celular"* — argumento de canteiro. **Sob a régua
   nova o ticket não perde valor, muda de razão**: em casa ele não guarda o
   celular, ele **recarrega a página** — e recarregar durante uma gravação é como
   se cria registro duplicado, que é o defeito que o uso real produziu em 24h.
3. **Os dois atenuantes do Gate 4 continuam válidos**, e por isso não é P0:
   (a) ninguém perde dado — na home é leitura, e no formulário a falha ocorre
   antes de ele digitar; (b) o cenário dos 7,7 s é 5xx (servidor de pé, backend
   fora), não celular offline — offline falha rápido.

## User Story

**Como** dono da obra, na maior parte das vezes em casa e às vezes no canteiro
com 4G ruim, **quando** o servidor está lento ou fora, **quero** que a tela me
diga a verdade em até ~2 segundos e me dê uma saída, **para que** eu não fique
olhando um spinner que já sabe que falhou, nem recarregue a página no meio de uma
gravação.

## Critérios de Aceite

1. [ ] **Feedback progressivo aos ~2 s**, em **todas** as telas que carregam
   dados: a mensagem muda de "carregando" para *"sem resposta do servidor —
   tentando de novo"*. **Texto aprovado antes da implementação.**
2. [ ] ⚠️ **A tela nunca diz "carregando" depois de saber que uma tentativa
   falhou.** É o critério que responde à palavra "mentira" do achado. A partir da
   primeira falha, a mensagem reflete o estado real, mesmo com o retry rodando por
   baixo. Teste com 5xx no primeiro request, afirmando a troca **antes** do fim
   do backoff.
3. [ ] **Teto de espera em toda tela**, com erro acionável e **"Tentar de novo"**.
   **Nenhum caminho de carregamento pode esperar indefinidamente** — auditoria de
   todas as leituras de tela. Teste de um request que nunca responde.
4. [ ] **Retry do postgrest-js revisto para leituras de tela.** 1+2+4 s é padrão
   de job de servidor, não de tela na mão de gente. **A definição é do
   `cto-obra`** — o ticket exige que o comportamento seja *decidido*, não um
   número específico.
5. [ ] **O total de espera até o erro final cai de ~7,7 s** para um valor
   escolhido e documentado. **E2E medindo**: o teste de "banco fora, com saída"
   afirma o teto novo e **falha se alguém devolver o backoff antigo**.
6. [ ] ⚠️ **Estado de gravação tratado à parte do de leitura.** Em gravação lenta,
   o botão fica desabilitado com estado visível, e **o erro diz se gravou ou
   não** — ou, quando não dá para saber, **diz exatamente isso** e manda conferir
   antes de repetir. *"Não sei se salvou" honesto é melhor que um erro que induz
   o segundo toque.* É o critério que ataca a duplicação.
7. [ ] **Vale para o cenário do projeto pausado** (CONTAI-012): a primeira
   requisição depois do auto-pause é lenta por construção. A tela precisa dizer
   algo útil nesse caso, não um erro genérico.
8. [ ] **E2E contra o Postgres local.** A **única falsificação de rede permitida**
   continua sendo a que já existe: o 503 do PostgREST.
9. [ ] **Nenhuma regressão de custo de navegação**: `proxy.ts` já custa uma
   chamada ao GoTrue por navegação. Este ticket **não pode somar outra**.

## Out of Scope

- **Modo offline / fila de gravação.** Outro produto, e ⚠️ **reabriria o Gate
  Fiscal** (com que data entra um pagamento gravado offline três dias depois?).
- **Cache de leitura / stale-while-revalidate.** O ticket é sobre **dizer a
  verdade**, não sobre parecer rápido. Mostrar dado velho sem dizer que é velho é
  uma mentira nova no lugar da antiga.
- **Retry automático de gravação.** Retry de escrita sem idempotência é a receita
  do registro duplicado — o que o critério 6 evita.
- **Indicador de conectividade global.** Pode voltar como conveniência.
- **Otimização de performance do backend.** Outro problema.

## Pre-mortem

1. **O teto é implementado só na home** e as telas de detalhe, adicionar e lista
   continuam sem. O ticket fecha e a dor sobrevive em quatro rotas. *Mitigação:
   critério 3 é auditoria de todas as chamadas.*
2. **O retry é encurtado e o app passa a falhar em oscilações que hoje absorve** —
   troca-se espera longa por erro fácil, e em 4G ruim isso é pior. *Mitigação:
   critério 4 com número documentado, e o 5 mede.*
3. **O erro de gravação ambíguo continua ambíguo** e o Mateus toca "Salvar" de
   novo, criando o duplicado — a dor que o uso real já produziu. *Mitigação:
   critério 6.*

## Viabilidade (CTO)

- **Sem migration. Sem dado novo. Sem tela nova.**
- **Arquivos**: `lib/supabase.ts` (retry/timeout), `lib/data.ts`, o componente de
  carregamento em `app/_components/ui.tsx`, e cada rota que carrega dados.
- **Complexidade: M.** Individualmente trivial; o custo é a auditoria de todos os
  pontos de leitura e a disciplina de não deixar um de fora.
- ⚠️ **Toca muitos arquivos com pouca lógica** — colide com quase qualquer outro
  `/develop`. **Rodar sozinho na árvore** ou em worktree próprio.

## Dependências

- **Bloqueado por**: nada. Pode rodar quando a árvore estiver livre.
- **Relacionado**: `CONTAI-012` — o 012 reduz a frequência do cenário lento, este
  trata o cenário quando ocorre. **Um não substitui o outro.**
- **Atenção**: mexer em estados de carregamento **toca telas cobertas pelos E2E de
  login e de registro**. Se um teste de login quebrar, o suspeito é este ticket,
  não a autenticação.

## Perguntas Abertas

1. **Já aconteceu com você em produção?** Uma tela parada em "Carregando a obra"
   desde 17/08 — se sim, quanto tempo e em qual tela. Muda a prioridade na hora.
2. **Você já recarregou a página no meio de um "Salvando"?** É a hipótese por trás
   do critério 6, e ela é do `po`, não sua. Se nunca aconteceu, o critério 6
   encolhe.
3. **Qual é o teto tolerável para você** — 3 s, 5 s? A definição técnica é do
   `cto-obra`, mas o número aceitável é seu.

## Teste do Canteiro (régua de 2026-08-18)

- **Principal — gestão em casa, wi-fi bom.** A dor não é a espera: é a
  **ambiguidade da gravação** (critério 6) e o **spinner infinito** quando o
  backend está fora ou acordando de pausa. **A régua nova não enfraquece o
  ticket, desloca o peso** dos critérios 1–2 para o 3 e o 6.
- **Eventual — canteiro, 4G ruim**: é onde os critérios 1 e 2 valem por si. Erro
  honesto em 2 s permite guardar o celular sabendo que não registrou; 7,7 s de
  mentira, não.
- **Metas**: **1, indiretamente e de verdade** — gravação ambígua produz pagamento
  duplicado ou pagamento nenhum, e as duas quebram "nenhum pagamento sem
  documento hábil". Metas 2 e 3, não toca.
- **Filtro de escopo, honesto**: metade deste ticket é polimento de percepção, e
  polimento não é meta. **O que o salva do corte é o critério 6** — e se precisar
  encolher, é por ele que se começa, cortando o resto.
- **Veredito: APROVADO como P1**, fora da R1, para rodar sozinho na árvore.
