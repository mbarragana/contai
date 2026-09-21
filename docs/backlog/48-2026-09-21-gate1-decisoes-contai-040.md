# Gate 1 do CONTAI-040 — 2026-09-21 — 4 decisões de produto sobre pendências do lead-engineer

O `lead-engineer` devolveu 4 pontos do Gate 1 (shell desktop + dashboard) que
tocavam decisão de produto, não implementação. `cto-obra` resolveu as técnicas
em paralelo. Decisões do `po`:

## 1 — Seletor de ano do critério 5: aceito como texto, não controle funcional

O lead não implementou o seletor porque mudar o `ano` só no dashboard sem
mudar o mesmo `ano` em `/pendencias` quebraria o Gate Fiscal do `CONTAI-042`
§5 (badge da sidebar e contagem real têm que usar o MESMO ano). Aceito para
esta rodada — o risco de divergência é real e o ticket não previa
sincronização entre as duas telas.

**Não é conveniência adiada de graça**: a obra cruza anos-calendário
(~20 meses), e o Mateus vai querer olhar 2025 a partir do dashboard antes do
fim do produto. Vira **ticket novo, não numerado ainda** — rótulo de trabalho
"seletor de ano sincronizado dashboard + /pendencias" —, escopo: um único
estado de ano que os dois consomem, para o badge nunca divergir da contagem.
Não é P0 fiscal (nenhum documento/pagamento fica sem checagem por causa
disso), é P1 fricção.

## 2 — Painel de pendências com cards completos, não linha compacta: aceito

O mock (`design/mocks/desktop-shell-v1.md`, critério 9 do ticket) desenhava
uma linha compacta "chip+título+detalhe+valor"; o lead usou os cards
completos de `ItemDaFila` porque 11 das 18 famílias só têm texto fiscal
estruturado nos componentes de card já existentes — montar a linha exigiria
redigir texto novo, proibido pelo critério 9 (nunca reescrever texto fiscal).

Aceito a divergência do mock. Entre um desenho e a regra que proíbe inventar
frase fiscal, a regra vence — o mock é hipótese de layout, não afirmação
fiscal. **Rejeitada a alternativa híbrida** (linha compacta para as 7
famílias com dado estruturado, card completo para as outras 11): criaria dois
padrões visuais na mesma lista sem ganho nenhum para as 3 metas, e é escopo
extra que ninguém pediu. `design/mocks/desktop-shell-v1.md` deve ser
atualizado para registrar esta decisão como a versão vigente do painel
"Pendências urgentes" (correção de registro, não dívida).

## 3 — `/despesas` stub + painel "Notas hábeis sem pagamento" mantido: confirmado, com ressalva de processo

Confirmo as duas:
- `/despesas` como stub que avisa "tabela pendente" e nesse meio tempo lista
  as despesas comprovadas — preserva superfície entre o `040` e o `041`, sem
  inventar UI que o `041` vai substituir.
- Manter "Notas hábeis sem pagamento" no dashboard — é sinal fiscal (nota
  válida ainda sem pagamento é rastro que Meta 1 quer visível), cortar
  esvaziaria superfície sem nenhum ticket cobrindo o destino dela ainda.

**Ressalva**: a autoridade usada para a segunda decisão foi um comentário em
`pendencias-unificadas.ts`, não um critério do ticket nem uma decisão
registrada do `po`. Comentário de código não é proveniência de decisão de
produto — é o mesmo problema, em miniatura, que fez o CONTAI-039 ser
rejeitado por decisão informal. Não vira dívida (a decisão em si está
correta), mas fica registrado aqui como a decisão formal, e o `CONTAI-041`
deve tratar explicitamente onde esse painel migra ou se permanece no
dashboard em definitivo.

## 4 — Texto "na fila de pendências": confirmado, sem carimbo do contador

É referência de navegação (onde clicar), não afirmação fiscal — a constante
`EXPLICACAO_CUSTO_ZERO` em si não mudou. Não precisa de CRC do `contador`;
mudança de copy de produto é decisão de design/PO.

## Fora desta decisão

Nenhuma das 4 pendências reabre regra fiscal, cor de gravidade ou cálculo —
confirmado no próprio Gate Fiscal do ticket. Nenhuma cria campo novo.
