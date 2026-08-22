# Design — Proposta Visual + Aprovação do Mateus

Desenha o fluxo e produz uma **proposta que o Mateus avalia ANTES de existir
código**. Premissa do projeto, intacta: **nenhuma alteração visível ao usuário
entra em desenvolvimento sem proposta aprovada.**

**O que mudou em 2026-08-22, a pedido do Mateus**: a proposta nem sempre é HTML.
Os mocks custam ~5,6 KB por tela (medido nos 10 arquivos existentes) — o
`CONTAI-021` tem 27 telas e 152 KB. Renderizar 27 telas para acrescentar um
campo, ou 4 telas para trocar uma frase, é gastar sem comprar decisão nenhuma.

## Os três níveis de proposta

**O designer escolhe o nível e justifica a escolha. O Mateus pode SUBIR de nível
("quero ver renderizado") — o designer nunca desce sozinho.** Na dúvida entre
dois níveis, suba: ver de menos custa retrabalho, ver de mais custa tokens.

| Nível | Quando | O que se entrega |
|---|---|---|
| **1 — HTML navegável** | **tela nova ou fluxo novo** | HTML **só das telas novas ou alteradas**. Nunca re-renderizar o fluxo inteiro para mudar parte dele — o mock antigo continua valendo para o que não mudou |
| **2 — spec `.md` + ASCII do bloco** | campo, estado, aviso ou validação a mais em tela **que já existe** | o **delta**: o bloco que muda em ASCII, os textos novos por extenso, o estado novo descrito. A tela inteira não se redesenha |
| **3 — tabela antes/depois em markdown** | **só o texto muda** | uma tabela por tela: texto atual → texto novo → origem (parecer). Zero renderização |

**A regra que decide**: pergunte *"o Mateus consegue julgar isto lendo, ou ele
precisa ver?"*. Densidade, hierarquia, o que cabe em 375px, ordem de leitura —
precisa ver, nível 1. Frase, regra, campo a mais numa tela que ele já conhece —
ele julga lendo.

⚠️ **O nível 1 não é opcional quando é tela nova.** "Descrevi bem em markdown"
não substitui ver: foi assim que o time colapsou o cenário de captura no de
gestão em 2026-08-17/18, decidindo no texto o que só a tela mostra.

## Instruções

1. Rode como subagent `designer` (`subagent_type: designer`). A definição dele
   já é o system prompt — **não leia `.claude/agents/designer.md`**
2. O `CLAUDE.md` já está carregado no contexto — **não o releia**
3. Leia o ticket em `docs/tickets/` (se existir) — o mock materializa requisito
   fechado pelo PO; lacuna de requisito volta como pergunta, não vira decisão
   embutida no mock
4. Para consistência entre telas, leia os **specs** (`design/mocks/*.md`) dos
   mocks vizinhos, não os HTMLs inteiros. HTML de mock passa de 150 KB e cada
   leitura integral custa ~40k tokens; abra o `.html` só quando a dúvida for de
   marcação concreta
5. **Declare o nível antes de desenhar** e diga por quê, em uma linha. Se for
   nível 1, diga **quais telas** entram no HTML e quais ficam de fora por não
   terem mudado

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
5. **A proposta, no nível escolhido**:
   - **Nível 1** — arquivo HTML self-contained (zero dependências externas,
     CSS/JS inline), navegável entre os estados das telas **que mudam**.
     Fidelidade baixa, velocidade alta — mock é descartável. Um `<style>`
     compartilhado, não `style="…"` repetido em cada elemento
   - **Nível 2** — o spec `.md` com o bloco novo em ASCII e os textos por extenso
   - **Nível 3** — a tabela antes/depois, e nada mais

## Saída

1. **Nível 1 apenas**: salve o HTML em `design/mocks/[TICKET-ID-ou-nome].html`.
   Níveis 2 e 3 **não geram HTML** — o spec `.md` é a entrega inteira
2. **Salve o spec em `design/mocks/[TICKET-ID-ou-nome].md` — obrigatório nos
   TRÊS níveis, ≤100 linhas.** É o arquivo que o `/develop` lê nos Gates 1 e 4.
   Conteúdo:
   ```markdown
   # [ID] — spec do mock
   Cenário: [gestão | captura]   Arquivo: [ID].html
   ## Telas e estados
   - [tela]: loading | vazio (CTA "…") | erro (retry "…") | sucesso
   ## Campos
   - [nome] — [tipo] — [obrigatório?] — [validação] — [sem default se for fiscal]
   ## Textos com consequência fiscal
   - "[texto exato]" — origem: docs/pareceres/[arquivo].md
   ## Navegação
   - [origem] → [destino] — [gatilho]
   ## Decisões de design e perguntas abertas
   ```
   A primeira linha do spec declara o **nível** e, se for 1, quais telas o HTML
   cobre. Sem o spec, o `/develop` é obrigado a ler o HTML inteiro três vezes
3. Atualize `design/mocks/index.html` — hub com link para todos os mocks
4. **Apresente ao Mateus para avaliação**, dizendo o nível e por quê:
   - **Nível 1**: renderize como Artifact (ou indique `open design/mocks/X.html`)
   - **Níveis 2 e 3**: o delta ou a tabela, direto na conversa
   Em qualquer nível, liste as decisões de design tomadas e as perguntas abertas
5. Itere até aprovação explícita. Registre no ticket: "Mock aprovado em [data]"
   — só então o ticket fica elegível para `/develop`

## Regra dura

Sem aprovação explícita do Mateus, a proposta NÃO está aprovada — em qualquer
nível. Silêncio ou mudança de assunto não é aprovação.

O nível mais barato **não afrouxa a disciplina fiscal**: campo vazio pergunta e
campo preenchido afirma, default em campo fiscal continua proibido, e o anexo no
ato do registro continua obrigatório. Isso vale igual numa tabela de markdown e
num HTML de 27 telas.
