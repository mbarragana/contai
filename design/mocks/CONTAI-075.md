# CONTAI-075 — destaque progressivo do agendamento antes de vencer (hoje/amanhã)

**Cenário: gestão** (Home e Agenda, em casa, sentado). Sem tela nova — delta em
`MarcasAgendado`/`Chip`, componentes já em produção.

## Nível do mock: Nível 2 (spec + ASCII do chip/estado)

Estado a mais em tela existente; não reabre `LinhaAberta`/`CartaoVencido`/
`BlocoAgendados` — só o que `chipDoAgendado` devolve e como `Chip` pinta.

## 1. Confirmo a recomendação do cto-obra: 1 peso intermediário só

`vazado-forte`, compartilhado por `vence_hoje` e `vence_amanha`. Dois pesos
distintos abaixo do preenchido do vencido violariam o próprio Gate Fiscal por
excesso de zelo: a régua do contador pede peso **estritamente menor** que o
vencido, não pede hoje mais grave que amanhã visualmente. Dois níveis tão
próximos do vazado puro seriam indistinguíveis a olho — o "destaque que não
destaca" que o cto-obra apontou. Quem distingue hoje de amanhã é o texto do
chip (canal primário) e a preposição de tempo já existente (`para 28/09` vs
`para 29/09`); o peso só sinaliza "a data está perto".

**Mecanismo**: mesmo dispositivo que o produto já usa para escalar sem trocar
de estilo (borda tracejada do vencido: "engrossa-se a borda, nunca se troca o
estilo"). `vazado` = `border` 1px; `vazado-forte` = `border-2`; mesma cor,
mesmo fundo transparente. Nenhuma cor nova, nenhum peso de fonte novo.

`Chip` (`app/_components/ui.tsx`) troca o boolean `vazado` pela prop
`peso: "vazado" | "vazado-forte" | "preenchido"` (default `"vazado"`) e ganha
`...resto` (spread de `data-*`, padrão já usado em `Card`) para o
`data-urgencia` do item 4 chegar ao DOM. Nova constante `CORES_CHIP_VAZADO_FORTE`
ao lado de `CORES_CHIP`/`CORES_CHIP_VAZADO`, com `border-2` no lugar de
`border`. O único chamador não ligado a agendamento (`<Chip vazado>` em
`documento/[id]/ligar`, CONTAI-074) migra para `peso="vazado"` — mesmo
visual, prop nova.

## 2. Os textos

| `urgencia` | `chip.texto` |
|---|---|
| `comum` | `"Agendado"` (inalterado) |
| `vence_amanha` | `"Vence amanhã"` |
| `vence_hoje` | `"Vence hoje"` |
| `vencido` | `"Venceu em {data} · N dias sem resposta"` (inalterado) |

Mesmo registro do que já existe: verbo + quando, sem repetir a data — a
preposição de tempo, na linha de baixo (`Dica`), já mostra `para 28/09/2026`.
Nenhum texto de consequência novo: `vence_hoje`/`vence_amanha` não ganham
`Consequencia` nem frase de bloqueio — exclusivo do vencido
(`VENCIDO_SEM_RESPOSTA` intacto, `TresRespostas` não aparece nos dois estados
novos).

`chipDoAgendado(c, hojeIso)` passa a devolver `{ texto, urgencia }` no
lugar de `{ texto, forte }` — **sem `peso`**: peso é decisão de UI, e quem o
deriva da `urgencia` é o `Record` exaustivo `pesoDoChip`, em
`app/_components/agendado.tsx` (critério 7 do ticket). Lib fiscal devolve
estado; borda não se decide lá. Ordem de checagem (não inverter num refactor
futuro): **vencido primeiro** (`ehVencidoSemResposta`, `<` estrito — um
`dataPrevista === hojeIso` nunca é vencido por definição); depois
`dataPrevista === hojeIso` → `vence_hoje`; depois `=== hojeIso + 1 dia` →
`vence_amanha`; senão (inclusive `null`) → `comum`, igual ao atual.

## 3. Onde aparece

Só em `MarcasAgendado` (`app/_components/agendado.tsx`), ponto único das
quatro marcas — nenhum consumidor monta cartão/linha próprios:

```tsx
<Chip cor="amb" peso={chip.peso} data-urgencia={chip.urgencia}>
  {chip.texto}
</Chip>
```

Cobre de graça os três lugares que renderizam `MarcasAgendado`: Home
(`BlocoAgendados`), Agenda (`/compromisso`, mesmo `BlocoAgendados`) e o
cabeçalho de `/compromisso/[id]` (`CabecalhoDoAgendamento`). `/despesas`
(`agendamentosPorDocumento` → `AgendamentoDoDocumento.chip`) recebe o texto
novo sem decisão de layout — já consome só `.chip.texto`; o campo hoje
chamado `forte` deve virar `peso` junto (mesma fonte), mas nenhuma tela de
`/despesas` passa a ler cor/peso — acompanhamento de tipo, não design novo.

## 4. `data-urgencia` — no `<Chip>`, não no contêiner

Vai no `<span>` do chip, não em `data-agendado` do cartão/linha (que só
distingue `aberto`/`vencido`, e não muda). `data-urgencia` expõe os 4
valores igual nos três lugares do item 3, independente do contêiner por
fora. Seletor de E2E: `[data-urgencia="vence_hoje"]`, etc.

## Campos

- SEM CAMPOS — só estado derivado (`urgencia` calculado de `dataPrevista` vs.
  `hojeIso`), nada digitável, nenhum default fiscal envolvido.

## Textos com consequência fiscal

Nenhum novo — `VENCIDO_SEM_RESPOSTA` continua sendo o único, inalterado.

## Navegação

Nenhuma mudança: os três componentes continuam levando a
`/compromisso/[id]`, com ou sem as três respostas (exclusivas do vencido).

## Decisões e perguntas abertas

Nenhuma — os dois gates (PO, contador) já fecharam requisito e régua fiscal.
