# Design — Fluxo + Mock HTML Obrigatório

Desenha o fluxo de usuário e produz um **mock HTML navegável** para o Mateus
avaliar. Premissa do projeto: **nenhuma alteração visível ao usuário entra em
desenvolvimento sem mock aprovado.** Este comando é o caminho para essa aprovação.

## Instruções

1. Leia e incorpore `.claude/agents/designer.md`
2. Leia `CLAUDE.md` para contexto e premissas
3. Leia o ticket em `docs/tickets/` (se existir) — o mock materializa requisito
   fechado pelo PO; lacuna de requisito volta como pergunta, não vira decisão
   embutida no mock
4. Leia mocks existentes em `design/mocks/` para manter consistência entre telas

## Input

- **O que desenhar**: tela, componente ou fluxo (idealmente um TICKET-ID)
- **Contexto de uso**: quando/onde o Mateus interage? (default: celular, no
  canteiro, uma mão livre)

## Processo

1. **Fluxo primeiro**: passos, estados, pontos de decisão — em texto ou ASCII.
   Acorde o fluxo na conversa ANTES de desenhar tela
2. **Mobile-first (375px)**: o cenário-base é canteiro + pressa; desktop é
   expansão, nunca o design primário
3. **Regras do designer**: captura em ≤3 interações; pendência como cidadã de
   primeira classe; consequência fiscal visível na interface (texto conferido
   com `.claude/agents/contador.md`, nunca de memória)
4. **4 estados**: loading, vazio (com CTA), erro (com retry), sucesso
5. **Mock HTML**: um arquivo self-contained (zero dependências externas, CSS/JS
   inline), navegável entre os estados/telas do fluxo. Fidelidade baixa,
   velocidade alta — mock é descartável

## Saída

1. Salve em `design/mocks/[TICKET-ID-ou-nome].html`
2. Atualize `design/mocks/index.html` — hub com link para todos os mocks
3. **Apresente ao Mateus para avaliação**: renderize como Artifact (ou indique
   `open design/mocks/X.html`) e liste as decisões de design tomadas + as
   perguntas em aberto
4. Itere até aprovação explícita. Registre no ticket: "Mock aprovado em [data]"
   — só então o ticket fica elegível para `/develop`

## Regra dura

Sem aprovação explícita do Mateus, o mock NÃO está aprovado. Silêncio ou mudança
de assunto não é aprovação.
