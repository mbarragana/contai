# CONTAI-057 — coluna "Custo confirmado" em Despesas (delta sobre CONTAI-041)
Cenário: **gestão** (revisão de despesas, em casa, sentado). Teste do Canteiro
não se aplica — tabela densa é o ponto, não o veto.

Este é um **delta** sobre a tabela já especificada em
`design/mocks/desktop-shell-v1.md` (seção "Despesas — tabela de verdade") e
implementada em `app/(gestao)/despesas/page.tsx`. Só o que muda está aqui; o
resto do spec anterior continua valendo (filtros, ordenação, 4 estados da
tela, doutrina "uma linha por Pagamento/Documento").

## Decisões deste `/design`

1. **Rótulo da coluna "Valor" vira "Valor lançado".** Verdadeiro nas duas
   origens da linha: pagamento (valor transferido) e documento sem pagamento
   vinculado (valor da nota, nada desembolsado ainda). Não afirma "pago". O
   próprio E2E já nomeia o conceito assim (`e2e/despesas.spec.ts:337`,
   *"nota sem valor lançado mostra…"*) — termo já em uso, não novo.
2. **Cabeçalho da coluna nova: "Custo confirmado"** — não "Custo comprovado".
   (a) evita colisão de `getByText` com o chip `CHIP_CUSTO_COMPROVADO`
   ("Custo comprovado") que continua na célula Situação (achado do CTO,
   `e2e/despesas.spec.ts:161`); (b) reaproveita o nome do **KPI equivalente**
   já usado na Home e no fluxo de vínculo (`resumo.custoConfirmadoAnoCentavos`,
   `TileCustoConfirmado`, "Custo confirmado se ligar agora" em
   `pagamento/[id]/ligar`/`documento/[id]/ligar`) — mesma grandeza, decomposta
   por linha em vez de somada por ano. Nenhum termo novo no produto.
3. Coluna nova é **não sortável** (critério 8) → `ThFixo`, não `Cabecalho`,
   alinhada à direita como "Valor lançado" (adicionar variante de alinhamento
   a `ThFixo`, mesma classe `lg:text-right` que `Cabecalho` já usa).

## Telas e estados

Um só estado muda (sucesso — a tabela com linhas). Loading/vazio/erro do
CONTAI-041 são inalterados.

### Cabeçalho da tabela (desktop, ordem completa)
```
Data pagamento▾ | Favorecido | Documento | Meio | Valor lançado▾ | Custo confirmado | Situação | Ação
```
(▾ = sortável; só "Data pagamento" e "Valor lançado" continuam sortáveis.)

### Linha — caso A: só pagamento, sem retenção (comprovadoPorRetencaoCentavos = 0)
```
12/03/2026   Madeireira Silva LTDA   NF 4521    PIX   R$ 12.500,00   R$ 12.500,00   [Custo comprovado]   Abrir →
             PJ                     material          (regular)     (mono, semibold)
```
`Valor lançado` = `Custo confirmado`: sem retenção, os dois números coincidem
— esperado, não é bug (invariante do CTO: `custoConfirmado > valorLançado ⇔
há retenção`).

### Linha — caso B: pagamento + retenção (comprovadoPorRetencaoCentavos > 0)
```
08/04/2026   João Empreiteiro (PJ)   NF 118 serviço   PIX   R$ 8.000,00   R$ 10.000,00   [Custo comprovado]
                                                             (regular)    (mono,          [Quitado por retenção] R$ 2.000,00
                                                                           semibold,       "Esta fatia da nota foi quitada
                                                                           data-custo-      por RETENÇÃO, não por
                                                                           comprovado)      transferência…"
                                                                                                          Abrir →
```
`Custo confirmado` (R$ 10.000,00) > `Valor lançado` (R$ 8.000,00) — a
diferença é a retenção, explicada ao lado na célula Situação: o chip
`Quitado por retenção` mantém seu valor inline (R$ 2.000,00) e a
`Consequencia` `RETENCAO_EXPLICA_A_SOBRA` inteira (`lib/fiscal/retencao.ts`) —
nada reescrito. Só o chip `CHIP_CUSTO_COMPROVADO` ao lado perde o valor
inline (critério 5): duplicaria o número que a coluna nova já carrega.

### Célula da coluna nova, os dois estados de valor
- `custoComprovadoCentavos > 0` → `formatarBRL(...)`, `mono font-semibold`,
  `whitespace-nowrap` (mesmas classes que "Valor" tinha antes deste ticket).
- `custoComprovadoCentavos === 0` → `SEM_DADO` (`—`), nunca "R$ 0,00" — mesma
  regra que já vale para `valorCentavos` nesta tabela.
- Atributo programático (critério 7), padrão já usado em `kpi.tsx`
  (`data-custo-em-risco={...}`): `data-custo-comprovado={linha.custoComprovadoCentavos}`
  no `<span>` do valor, não em texto solto.

### Mobile (<lg) — sem bifurcar JSX
Mesma marcação, empilhada por CSS: a nova célula entra entre "Valor lançado"
e "Situação", com `<Rotulo>Custo confirmado</Rotulo>` à esquerda do número —
mesmo padrão de toda outra célula da tabela. Nenhum JSX condicional novo.

## Campos
Nenhum — não há formulário nem entrada do usuário; é célula de leitura
derivada (`custoComprovadoCentavos` em `LinhaDeDespesa`, calculado no módulo
puro `lib/fiscal/despesas.ts`, nunca no componente).

## Textos com consequência fiscal
Nenhum texto novo. `RETENCAO_EXPLICA_A_SOBRA` e o chip `CHIP_CUSTO_COMPROVADO`
já existem desde `CONTAI-056`/`CONTAI-038` — este ticket só move onde o
**número** aparece, não o texto. Origem:
`docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (ADENDO 2/3).

## Navegação
Nenhuma mudança — a linha continua levando a `/documento/[id]` ou
`/pagamento/[id]` pelo mesmo "Abrir →".

## Decisões de design e perguntas abertas
- Nenhuma pergunta aberta para o `po` — o rótulo de "Valor" era a única
  decisão delegada a este `/design` e está fechada acima.
- `design/mocks/desktop-shell-v1.md` (lista de colunas) recebe o mesmo delta
  nesta mesma rodada: `Valor` → `Valor lançado`, `Custo confirmado` inserida
  entre ela e `Situação`.
