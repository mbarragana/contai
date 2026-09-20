# Design — Descrição Escrita do Fluxo

Desenha o fluxo e produz uma **descrição detalhada, escrita ANTES de existir
código**, suficiente para o `lead-engineer` implementar sem abrir dúvida de
campo, estado ou texto.

**Mudou em 2026-09-20, a pedido do Mateus**: não há mais gate de aprovação nem
HTML. Regra anterior (2026-08-07, revista em 2026-08-22 para níveis mais
baratos que HTML): nada visível entrava em desenvolvimento sem mock aprovado
pelo Mateus. Os mocks HTML custavam ~5,6 KB por tela (o `CONTAI-021` chegou a
27 telas e 152 KB) e o gate de aprovação parava o pipeline esperando sinal
verde — dois custos que não compravam decisão que valesse o token gasto.
Agora o `/design` produz só o spec `.md` (abaixo) e o `/develop` segue direto
para o Gate 1, sem parar para aprovação.

## O que entregar

Sempre o mesmo formato — o spec `.md` descrito em **Saída**, abaixo. Sem HTML,
sem espera por aprovação. O que muda com o tamanho da mudança é só o quanto do
formulário **Campos**/**Telas e estados** você preenche: uma tela nova
descreve tudo; um campo a mais descreve só o delta (o resto continua valendo
o spec já existente daquela tela).

**A régua que decide o nível de detalhe**: descreva o suficiente para que o
`lead-engineer` não precise adivinhar densidade, hierarquia, o que cabe em
375px ou ordem de leitura. Texto vago substituindo o que só um desenho mostra
foi como o time colapsou o cenário de captura no de gestão em 2026-08-17/18 —
o risco não desapareceu só porque o HTML saiu do processo.

## Instruções

1. Rode como subagent `designer` (`subagent_type: designer`). A definição dele
   já é o system prompt — **não leia `.claude/agents/designer.md`**
2. O `CLAUDE.md` já está carregado no contexto — **não o releia**
3. Leia o ticket em `docs/tickets/` (se existir) — o mock materializa requisito
   fechado pelo PO; lacuna de requisito volta como pergunta, não vira decisão
   embutida no mock
4. Para consistência entre telas, leia os **specs** (`design/mocks/*.md`) dos
   mocks vizinhos — specs antigos em nível 1 ainda têm `.html` companheiro;
   abra-o só quando a dúvida for de marcação concreta, nunca por padrão

## Input

- **O que desenhar**: tela, componente ou fluxo (idealmente um TICKET-ID)
- **Cenário de uso** (os dois do `CLAUDE.md`, e a diferença muda o desenho):
  **gestão** — em casa, sentado, com calma (o principal: conciliar, agendar,
  corrigir, revisar) — ou **captura** — canteiro, celular, uma mão (eventual).
  Se o ticket não disser qual é, pergunte antes de desenhar

## Processo

1. **Fluxo primeiro**: passos, estados, pontos de decisão — em texto ou ASCII.
   Acorde o fluxo na conversa ANTES de desenhar tela
2. **375px é o piso, não o alvo**: nenhuma tela pode quebrar no celular, mas
   "não cabe com uma mão" não é veto em tela de gestão — essas podem ter mais
   campos, densidade e passos, desde que o caminho de captura continue curto
3. **Regras do designer**: captura em ≤3 interações; pendência como cidadã de
   primeira classe; consequência fiscal visível na interface — **o texto se
   copia do parecer em `docs/pareceres/`, nunca se reescreve de memória**
4. **4 estados**: loading, vazio (com CTA), erro (com retry), sucesso

## Saída

1. **Salve o spec em `design/mocks/[TICKET-ID-ou-nome].md`, ≤100 linhas.** Sem
   HTML — este arquivo é a entrega inteira, e é o que o `/develop` lê nos
   Gates 1 e 4. Conteúdo:
   ```markdown
   # [ID] — descrição do design
   Cenário: [gestão | captura]
   ## Telas e estados
   - [tela]: loading | vazio (CTA "…") | erro (retry "…") | sucesso — descreva
     layout, densidade e ordem de leitura em texto/ASCII, o suficiente para
     implementar sem ver renderizado
   ## Campos
   - `[nome]` — [tipo] — [obrigatório?] — [validação] — SEM DEFAULT (se fiscal)
   ## Textos com consequência fiscal
   - "[texto exato]" — origem: docs/pareceres/[arquivo].md
   ## Navegação
   - [origem] → [destino] — [gatilho]
   ## Decisões de design e perguntas abertas
   ```
   Numa mudança pequena (campo, estado ou texto a mais numa tela que já tem
   spec), descreva só o delta — o resto do spec existente continua valendo
2. **Apresente ao Mateus** o spec direto na conversa, com as decisões de design
   tomadas e as perguntas abertas — não é aprovação, é visibilidade. Ele pode
   pedir mudança a qualquer momento, antes ou depois do código existir
3. O ticket fica elegível para `/develop` assim que o spec existe em
   `design/mocks/[ID].md` — sem esperar por sinal verde separado

## Regra dura

O fim do gate de aprovação **não afrouxa a disciplina fiscal**: campo vazio
pergunta e campo preenchido afirma, default em campo fiscal continua proibido,
e o anexo no ato do registro continua obrigatório. Isso vale igual numa
mudança de uma frase e num fluxo novo inteiro.
