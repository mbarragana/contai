# CONTAI-008 entregue — 2026-09-20

Mover pagamento entre obras vira ato transacional (`mover_pagamento_de_obra`,
migration 0016), espelho do `moverDocumentoDeObra` do CONTAI-021. Decisão por
documento vinculado (vai_junto/fica_na_origem), `ato_id` compartilhado,
pendência por ano, guarda de contagem de decisões (crit. 13, aplicada também
em `mover_documento_de_obra`). `app/_components/corrigir-obra.tsx` (órfão
desde o CONTAI-007) apagado.

Gate 2 aproveitou a correção fiscal do CONTAI-007 (parecer
`2026-09-20-cno-nao-bloqueia-correcao-de-obra.md`): a leitura de 24/08 da
pergunta 1/critério 16 (bloquear desfecho por CNO divergente) estava errada
pelo mesmo motivo do CONTAI-007 — o texto vigente já estava anotado no corpo
do `CONTAI-008.md` antes deste ticket subir na fila, então a implementação
já nasceu correta (aviso, nunca bloqueio).

Testado: 687 unitários + 202 E2E (automatizado) + validação manual no browser
(duas obras, CNO diferentes, NF de serviço + PIX vinculados, move com "vai
junto" mostrando o aviso e preservando o vínculo na obra de destino).

## Dívidas novas

- **D60** — `HistoricoDeCorrecoes` só renderiza em `/documento/[id]`. O ato de
  mover um PAGAMENTO não aparece em tela nenhuma pelo lado do pagamento: a
  nota que "fica" na origem não mostra o ato no seu histórico (`entidade`
  gravada é `pagamento`, a query busca `entidade='documento'`), e
  `/pagamento/[id]` não tem card de histórico nenhum. O dado está gravado,
  append-only, e a pendência do ano fica visível em `/pendencias` — nada
  fiscal fica mudo — mas o rastro fica invisível para o Mateus conferir na
  tela certa. Correção sugerida (não escopo deste ticket): card de histórico
  em `/pagamento/[id]`, filtrando por `entidade='pagamento'`, espelho do
  critério 16 do CONTAI-021.
