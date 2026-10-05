# CONTAI-086 Reabrir o gate de retenção de um documento já registrado

## Tipo e Prioridade
feature — **P0 fiscal** — a pendência real de ISS a recolher (R$1.797,03,
prazo de trabalho até 10/11/2026 por
`docs/pareceres/2026-10-02-iss-retido-floripa-perfuratec-nfse263.md` §3)
não aparece em lugar nenhum do sistema enquanto o gate ficar travado em
"nenhuma". Toca meta 1 (rastro correto do pagamento) e tem prazo correndo
— mais urgente em relógio que o CONTAI-085.

## Dor de Origem
Dívida **D90**, `docs/backlog/101-2026-10-05-correcao-nota-substituida-com-retencao-nova.md`:
`BlocoRetencao` só oferece `ConfirmarGateLegado` quando
`documento.retencaoNaNota === null`; com gate = `'nenhuma'` o bloco
inteiro retorna `null` — não existe caminho para flipar um gate já
respondido de "nenhuma" para "destacada". Caso real: a nota substitutiva
(263) revelou ISS retido que a nota original (261) não tinha; o documento
261 já respondeu "nenhuma" e fica preso.

## User Story
Como dono da obra, quando a nota substitutiva muda a situação tributária
("Normal"→"Retenção"), quero reabrir a resposta já dada sobre "esta nota
destaca alguma retenção?", para que o repeater de linhas de retenção
(CONTAI-038) fique disponível e a pendência real de "quem recolhe" apareça.

## Critérios de Aceite
1. [x] Proposta nível 1 (rota nova) + nível 2 (delta em `BlocoRetencao`)
   em `design/mocks/CONTAI-086.md` (cobre também o CONTAI-087 — mesma
   tela/fluxo).
2. [x] Rota nova `/documento/[id]/corrigir/retencao`, fluxo de 4 passos:
   `PassoMotivo` → gate (resposta atual + nova escolha) → linhas (se
   destacada) → anexo (condicional, critério 9).
3. [x] Quando o gate hoje é "nenhuma", `BlocoRetencao` mostra um card
   "Esta nota: sem retenção destacada — Corrigir" (deixa de retornar
   `null`).
4. [x] Quando o gate hoje é "destacada", o `Repeater` existente ganha um
   link "Corrigir a resposta sobre retenção" ao lado de "+ Adicionar
   outra linha".
5. [x] Nova escolha **igual** à atual **e** zero linha nova (ramo 3c) →
   botão desabilitado "Nada a corrigir". **Zero rastro gravado — nem o
   motivo escolhido no Passo 1** (confirmado pelo `contador`: gravar um
   não-evento contrariaria o propósito do acervo append-only).
6. [x] Nova escolha "destacada" (de "nenhuma", ou reafirmando "destacada"
   com linha nova — caso do CONTAI-087) → formulário de linhas
   acumulando em memória (mesmo padrão de `BlocoRetencaoDaCaptura`), pelo
   menos 1 linha obrigatória antes de confirmar. Gate+linhas+anexo são
   **um ato só**, gravado junto — nenhum estado intermediário visível.
7. [x] Nova escolha "nenhuma" com linhas **já existentes** → aviso
   explícito antes de confirmar, texto verbatim: *"As N linhas de
   retenção desta nota serão removidas. O fato fica registrado no
   histórico da correção — mas elas deixam de contar como pendência."*
8. [x] Reversão destacada→nenhuma: a RPC grava **snapshot completo** das
   linhas removidas (`id`, `rotulo_literal`, `valor`, `composicao`,
   `tributo`, `e_desconto_efetivo`, `quem_recolhe`, `created_at`, **quem
   reverteu**, **documento_id/obra_id**) em `revisao.antes` (JSON) e
   **DELETA** as linhas de `documento_retencao`. **O `DELETE` só existe
   dentro desta RPC nomeada — nenhuma rota genérica de delete nessa
   tabela fora deste fluxo.**
9. [x] Anexo **CONDICIONAL**: `motivo = emitente_corrigiu_a_nota` →
   **RECUSA** gravar sem anexo (upload novo OU reaproveitar um anexo já
   existente do mesmo documento, oferecido como chip clicável com data +
   origem). `motivo = erro_de_digitacao_minha`/`outro` → sem upload novo,
   mas com afirmação explícita de reconferência do anexo já existente
   antes de gravar.
10. [x] Chips de reaproveitar anexo mostram data e origem (ex: "Usar a
    nota anexada em dd/mm (correção de número)") — vêm de
    `carregarAnexosDoDocumento` enriquecida via embed `documento_anexo` →
    `revisao` (sem coluna nova; `revisao_id` já existe desde a `0009`).
11. [x] Rastro quando algo muda: `revisao` (`entidade='documento'`,
    `campo='retencao_na_nota'`, `antes`, `depois`, `quando`, `quem`,
    `motivo`) — mesmo padrão das outras correções. "Anos afetados" sempre
    vazio (retenção nunca move custo nem aferição).
12. [x] Migration `0028` (**compartilhada com o CONTAI-087**):
    `revisao_campo_da_entidade` ganha `'retencao_na_nota'` e
    `'linha_retencao'` em `entidade = 'documento'` (sem `alter type
    entidade_revisao`). `documento_retencao` ganha `revisao_id uuid
    references revisao(id)`, nullable.
13. [x] RPC `corrigir_gate_retencao(...)` — nenhuma→destacada insere as
    linhas novas com o `revisao_id` do mesmo ato (atômico); destacada→nenhuma
    faz snapshot+delete (critério 8); exige `retencao_na_nota is not
    null` (o legado continua em `responderGateRetencao`/`.is(null)`,
    intocado); exige gate novo diferente do atual, **exceto** quando há
    linha nova a adicionar com o mesmo gate "destacada" (caso do
    CONTAI-087).
14. [x] `revoke execute ... from public, anon` + `grant ... to
    authenticated` na mesma migration; `FUNCOES_ESPERADAS` de
    `e2e/privilegios.spec.ts` atualizado.
15. [x] `HistoricoDeCorrecoes` aprende a renderizar `retencao_na_nota`
    (rótulos de `OPCOES_GATE`) e o snapshot de linhas removidas em
    `antes`.
16. [x] `lib/fiscal/vinculo.ts` e `lib/fiscal/resumo.ts` (que leem
    `d.retencoes` direto, sem olhar o gate) **não precisam de nenhuma
    alteração** — a remoção física das linhas (critério 8) já garante que
    elas param de contar, sem precisar de filtro adicional em nenhum
    leitor.
17. [x] `carregarAnexosDoDocumento` (`lib/data.ts`) passa a devolver
    `{ arquivoPath, anexadoEm, origem }` via embed com `revisao` (sem
    coluna nova) — `revisao_id is null` → `origem = "registro original"`.

## ✅ Entregue — 2026-10-05
Pipeline completo, implementado junto com o CONTAI-087 (mesmo Gate 1/2):
Gate 1 (lead-engineer, DONE — corrigiu também o erro de gramática
pré-existente do spec que bloqueava `npm run test`) → Gate 2 (cto-obra +
contador, APPROVE, fiscal ratificado 5/5 — DELETE+snapshot cercado à RPC
nomeada confirmado, 8 campos + quem reverteu + documento/obra no
snapshot; 2 ajustes pontuais de texto/UX corrigidos no mesmo agente) →
Gate 3 (coberto pelos E2E) → Gate 4 (po, PASS nos 17 critérios,
revalidado item a item contra código/migration/E2E, não só aceito do
relato do Gate 2). Typecheck/lint limpos, 1371 testes unitários,
`corrigir-retencao.spec.ts` 10/10, `privilegios` 7/7. Dívida nova
registrada: **D91** (`removerLinhaRetencao` sem rastro, P1) —
`docs/backlog/102-2026-10-05-gate4-contai-086-087.md`.

## Out of Scope
- **Reverter destacada→nenhuma mantendo a linha viva (soft-delete/coluna
  de status)** — avaliado e rejeitado: exigiria filtro em todo leitor
  (`vinculo.ts`, `resumo.ts`, detalhe, dossiê, E2E), com risco de um
  `where` esquecido virar pendência fiscal silenciosa. Decisão: deletar +
  snapshot em `revisao` (critério 8).
- **Cálculo de aferição INSS/SERO** — retenção de ISS nunca entra; a
  linha de retenção é só pendência de "quem recolhe" (invariante do
  CLAUDE.md). Esta tela não toca `lib/fiscal/vinculo.ts` no sentido de
  alterar seu cálculo.
- **Novo tipo de documento "comprovante de recolhimento de guia de
  ISS"** — lacuna apontada no parecer `2026-10-02`, §5, fora desta rodada.
- **Resolver o excedente pago à PerfuraTec / gerar e pagar a guia** — fora
  do software.
- **Generalizar `ConfirmarGateLegado` com uma prop de modo** — rejeitado
  (ver Pre-mortem 1): componente/rota novos.

## Gate Fiscal (Contador)
Regra em parte nova (o parecer `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md`
é anterior ao CONTAI-038, que criou `retencaoNaNota`) + ratificação
pontual desta rodada.

- **Anexo CONDICIONAL**: `motivo = emitente_corrigiu_a_nota` → **RECUSAR**
  sem anexo (ratificação direta de §5, "duas regras duras": "Se motivo =
  emitente_corrigiu_a_nota, o documento novo é anexado no mesmo ato").
  `motivo = erro_de_digitacao_minha`/`outro` → **REVALIDAR** com o anexo
  já existente + afirmação explícita (extensão por analogia do princípio
  do ADENDO §3 do mesmo parecer — alterar um fato fiscal já gravado sem
  olhar o papel de novo é o mesmo "flip barato" que o §2 proíbe).
- **Sem assimetria de direção** — `nenhuma→destacada` **e**
  `destacada→nenhuma` são igualmente arriscadas (ao contrário de
  `destinatarioCpfOk`, onde só uma direção é segura): a primeira fabrica
  uma pendência sem prova; a segunda esconde uma pendência real. A regra
  de anexo/motivo acima vale igual nas duas direções.
- **Reversão destacada→nenhuma: DELETE das linhas + snapshot completo em
  `revisao.antes` (JSON, append-only) é ACEITO como equivalente a "nada se
  apaga do rastro"** — ratificado nesta rodada, condicionado a: (a) o
  `DELETE` só existe dentro desta RPC nomeada, nenhuma rota genérica; (b)
  o snapshot inclui quem reverteu + `documento_id`/`obra_id`, além dos 8
  campos próprios da linha. Paralelo aceito com ADENDO 9 §M.4
  (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`) — trocar
  "tabela de histórico própria" por "rastro dentro de auditoria já
  append-only" já é padrão aceito no projeto.
- **Ramo "nada a corrigir" (gate igual, zero linha nova): ZERO rastro,
  nem o motivo do Passo 1** — mesmo padrão das outras 3 correções
  (`corrigir/valor`/`classificacao`/`emitente`), que quando "igual ao já
  gravado" simplesmente desabilitam o botão. Gravar essa reafirmação
  seria registrar um não-evento no acervo, contra o próprio propósito do
  append-only (guardar fatos com consequência).

Automático: recusar reabertura sem motivo; recusar
`emitente_corrigiu_a_nota` sem anexo; gravar rastro sempre que algo
muda; exibir a pendência pelo mecanismo já existente (CONTAI-059). Só o
Mateus: qual motivo; a afirmação de reconferência. Doutrina de
aferição INSS/custo de aquisição: intocada.

## Pre-mortem
1. **Componente reaproveitado escondendo que é correção.** Se
   `ConfirmarGateLegado` for reusado com uma prop de modo em vez de um
   componente novo, a tela de correção fica visualmente idêntica à
   pergunta original — sem motivo, sem anexo, sem rastro visíveis — o
   mesmo risco que o parecer nomeia para `status` ("dropdown de status é
   caminho de fraude silenciosa"), aplicado por analogia a este gate.
   Mitigado: componente/rota novos (decisão do `cto-obra`).
2. **Gate Fiscal passando batido pro Gate 1.** A pergunta de profundidade
   do rastro precisava estar fechada ANTES do Gate 1 — está, nesta
   própria rodada.
3. **Pendência fantasma.** Se `/pendencias` filtra por algum estado
   derivado de `retencaoNaNota` calculado no momento do registro
   original, a correção precisa invalidar esse estado — mitigado pelo
   critério 16 (remoção física das linhas, não filtro adicional a manter
   sincronizado).

## Viabilidade (CTO)
- **Modelo de dados**: migration `0028_corrigir_retencao_documento.sql`
  (compartilhada com o CONTAI-087) — `revisao_campo_da_entidade` ganha
  `'retencao_na_nota'`/`'linha_retencao'`; `documento_retencao` ganha
  `revisao_id` (nullable). Sem GRANT de tabela novo (coluna em tabela já
  concedida) — só privilégio de função + `FUNCOES_ESPERADAS`.
- **RPC**: `corrigir_gate_retencao(p_documento_id uuid, p_gate
  retencao_na_nota, p_motivo motivo_revisao, p_linhas jsonb, p_motivo_texto
  text default null, p_anexo_path text default null) returns uuid`.
- **Anexo compartilhado**: `p_anexo_path` pode ser o path de um
  `documento_anexo` já existente do mesmo documento OU um path novo — em
  ambos os casos a RPC insere uma linha NOVA em `documento_anexo` com o
  `revisao_id` deste ato (um objeto no bucket, múltiplos atos apontando,
  cada um com seu próprio rastro — nenhum upload duplicado).
- **Tela**: componente/rota novos, não generalização de
  `ConfirmarGateLegado` (ver Pre-mortem 1). Rota
  `app/(gestao)/documento/[id]/corrigir/retencao/page.tsx`: passo 1
  `PassoMotivo` (reuso), passo 2 gate (atual + nova escolha), passo 3 (se
  destacada) `FormularioDeLinha` acumulando em memória, passo 4 anexo
  condicional.
- **Arquivos**: migration `0028`, `lib/data.ts` (`corrigirGateRetencao`,
  ajuste de `carregarAnexosDoDocumento`), `lib/database.types.ts`,
  `retencao.tsx` (`BlocoRetencao`, novo card), `corrigir.tsx`,
  `corrigir/retencao/page.tsx`, `documento/[id]/page.tsx`,
  `e2e/privilegios.spec.ts`, `e2e/corrigir-retencao.spec.ts`.
- **Complexidade: M isolado, L junto com o CONTAI-087** (implementados no
  mesmo Gate 1 — mesma migration, mesma rota, mesmo E2E).
- **Dívida nova nomeada**: `removerLinhaRetencao` (DELETE direto) segue
  sem rastro em documento já registrado — incoerente com o CONTAI-087
  (adicionar com rastro, remover sem), mas não bloqueia esta rodada.

## Dependências
Bloqueado por: nenhum formalmente, mas vai **depois** do CONTAI-085 na
ordem de implementação (o chip "usar a nota já anexada" aponta para o que
o 085 pode ter subido). Bloqueia: **CONTAI-087 conceitualmente, mas os
dois são implementados no MESMO Gate 1** (mesma migration `0028`, mesma
rota, mesmo E2E) — não entram no `/develop` como dois ciclos separados.

## Perguntas Abertas
Nenhuma — as 2 levantadas pelo `designer` (metadado de anexo para os
chips; rastro do ramo 3c) foram resolvidas nesta mesma rodada do
`/tickets-req` (ver Gate Fiscal e Viabilidade acima).

## Cenário e checagem final
**Gestão**. Serve à meta 1 (rastro correto da pendência de retenção) e
tem prazo real correndo (10/11/2026, caso real). Sem condição fiscal
órfã — toda condição cita o parecer ou a ratificação desta sessão. Sem UI
que quebre disciplina de campo fiscal.
**Veredito: APROVADO.** Pronto para `/develop` — implementar junto com o
CONTAI-087, mesmo Gate 1.
