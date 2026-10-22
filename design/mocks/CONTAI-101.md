# CONTAI-101 — corrigir "nota sem CNO" depois que o prestador reemite com o CNO impresso
Nível: 2 (rota nova, 1 passo só — sem motivo, sem campo digitável; spec+ASCII em vez de HTML)
Cenário: gestão   Rota: `/documento/[id]/corrigir/cno`

Esqueleto de `corrigir/numero/page.tsx`, **reduzido**: sem `PassoMotivo` (motivo
fixo `cno_obtido_do_prestador`, gravado sem pergunta), sem campo de texto (o
valor gravado é sempre `obra.cno`, lido no servidor), sem "custo confirmado por
ano" (CNO não move custo), sem estado "Nada a corrigir" (as recusas de
pré-condição já cobrem os únicos casos sem o que fazer). Reaproveita
`ListaDeAnexos`/`ChipsDeAnexoExistente`/`CampoArquivo` (`app/_components/
anexo.tsx`) e `EstadoErro`/`Carregando`/`Banner`/`Card`/`BotaoLink`/
`BotaoSalvar` (`app/_components/ui.tsx`) do padrão de `corrigir/numero`/`valor`.

## Telas e estados

- **Carregando**: `Carregando rotulo="Carregando o documento"` — igual.
- **Erro ao carregar**: `EstadoErro erro={...} onTentarDeNovo={...}` — igual.
- **Recusa 1 — não é NF de serviço** (`!exigeCnoReferenciado(d.tipo)`, mesmo
  predicado que já esconde a `Linha "CNO na nota"` em
  `/documento/[id]/page.tsx:719`; só por URL direta). `Card border-amb` +
  `Banner cor="amb" role="status"`: "Este documento não é uma NF de serviço —
  o CNO impresso só se aplica a notas de serviço. Nada foi alterado."
  `BotaoLink` primário "Voltar ao documento" → `/documento/[id]`.
- **Recusa 2 — `notaTrazCno` ≠ `false`**: mesmo padrão visual, texto distingue
  os dois outros estados do tri-estado:
  - `null`: "Esta nota nunca foi perguntada sobre o CNO impresso — não é o
    caso de 'nota sem CNO' que esta correção resolve. Nada foi alterado."
  - `true`: "Esta nota já traz CNO impresso (**{cnoReferenciado}**) — não há
    'nota sem CNO' aqui para corrigir. Nada foi alterado."

  Mesmo `BotaoLink` "Voltar ao documento".
- **Recusa 3 — obra sem CNO cadastrado** (`obra.cno === null`): única recusa
  cuja saída não é só voltar — sem CNO na obra não há valor a gravar. "Esta
  obra ainda não tem CNO cadastrado. Sem ele, não há o que gravar aqui —
  primeiro registre o CNO da obra, depois volte para confirmar que esta nota
  o traz. Nada foi alterado." Dois links: `BotaoLink` primário **"Cadastrar o
  CNO da obra"** → `/obras/[obraId]` (bloco `CamposCno`) e secundário "Voltar
  ao documento" → `/documento/[id]`.
- **Pronto — tela normal** (nenhuma recusa se aplica):

  ```
  ┌─────────────────────────────────────────┐
  │ ← Corrigir o CNO da nota                 │
  ├───────────────────────────────────────── │
  │ Card "CNO na nota"                       │
  │  Hoje:    não traz CNO                   │
  │  Depois:  {obra.cno}                     │
  │           o CNO cadastrado nesta obra    │
  ├───────────────────────────────────────── │
  │ Dica: isto não é pergunta — é o que vai  │
  │ ser gravado, lido do cadastro da obra.   │
  │ CNO da obra errado? Corrija em "Dados    │
  │ da obra" primeiro.                       │
  ├───────────────────────────────────────── │
  │ ListaDeAnexos "Papel anexado — confira   │
  │ antes de salvar"                         │
  │ ChipsDeAnexoExistente | CampoArquivo     │
  │ (a nota reemitida, CNO visível)          │
  ├───────────────────────────────────────── │
  │ Consequencia cor="amb": CNO_NAO_ALCANCA_ │
  │ O_CUSTO (texto abaixo)                   │
  ├───────────────────────────────────────── │
  │ [Cancelar]         [Gravar a correção]   │
  └─────────────────────────────────────────┘
  ```

  Ordem de leitura: fato (hoje→depois, read-only) → por que não é pergunta
  (Dica) → prova documental (anexo, único campo de fato) → consequência →
  ação. Card "CNO na nota" reusa o `Linha rotulo="CNO na nota"` já existente
  no detalhe do documento, só com dois valores em vez de um. Sem `Passo`
  numerado — é campo único, não wizard.
- **Gravando**: `BotaoSalvar` ocupado, rótulo "Gravando…".
- **Erro ao gravar**: `ErroDeGravacao` — "Não deu para gravar. **Nada foi
  alterado** — a nota continua sem CNO e nenhum registro de correção foi
  criado." Retry sem redigitar (anexo preservado).
- **Sucesso**: `CabecalhoDaTela titulo="CNO corrigido ✓"`. `Banner cor="grn"`:
  "Corrigido. Esta nota agora traz o CNO **{obra.cno}**, e a correção ficou
  registrada no histórico do documento. A pendência de cobrança deste
  prestador fecha sozinha." Sem card de "anos afetados". `HistoricoDeCorrecoes`
  embaixo, igual às telas-irmãs.

## Campos

- `anexo`/`chipEscolhido` — um dos dois, arquivo — **sempre obrigatório** (não
  condicional por motivo — não há motivo a escolher, diferente de
  `numero`/`valor`) — validação/mensagem de `corrigir/valor`. Botão primário
  nasce desabilitado, rótulo "Anexe a nota reemitida para gravar"; habilita só
  com chip escolhido ou upload concluído.
- Não existe campo de CNO digitável: o valor gravado é **sempre** `obra.cno`,
  lido no servidor no ato da gravação (nunca por URL/estado do cliente). Isto
  não é campo fiscal em branco esperando resposta — é exibição de um fato já
  gravado no cadastro da obra, mostrado para confirmação, não perguntado. Não
  viola "campo vazio pergunta, campo preenchido afirma": não há pergunta
  aqui, só o anexo afirma algo.
- Motivo de `revisao`: fixo `cno_obtido_do_prestador`, gravado pelo servidor —
  nunca campo de tela, nunca escolha do usuário (decisão do `cto-obra`).

## Textos com consequência fiscal

- `CNO_NAO_ALCANCA_O_CUSTO` (verbatim, `lib/fiscal/obra.ts:264-267`): "A nota
  continua sendo documentação hábil para o custo de aquisição no IRPF — o que
  ela não faz é reduzir a base de INSS de uma obra que ela não referencia."
  Usado na Recusa 2 (`true`) e como `Consequencia` na tela normal.
- `CONSEQUENCIA_CNO_DA_NOTA` (verbatim, `lib/fiscal/obra.ts:255-258`) — descreve
  o estado ANTES da correção (já na pendência "Nota sem CNO" do painel); **não
  aparece nesta tela**, citada só para o `lead-engineer` não trocar os dois
  textos por engano.
- Origem: `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md`,
  ADENDO 2026-10-22, §1 (tabela de corrigibilidade) e §2 (`nao_traz`×
  `outra_obra`).

## Navegação

- `/documento/[id]` → `/documento/[id]/corrigir/cno` — link **só quando
  `notaTrazCno === false`**: "Registrar que a nota agora traz o CNO — hoje:
  não traz CNO" (mesma lista de "Corrigir o valor"/"...número/série"/
  "...emitente").
- `/documento/[id]/documento-novo` — `CorrecaoDoPacote` ganha 4ª opção, **só
  quando `notaTrazCno === false`**: "CNO — hoje: não traz CNO" (mesmo padrão
  das outras três, `design/mocks/CONTAI-088.md` linha 88-91); sem passo de
  motivo dentro dela.
- "Cancelar" / qualquer `BotaoLink` de recusa → `/documento/[id]`, sem gravar.
- Recusa 3, link extra → `/obras/[id]` (`CamposCno`).
- Sucesso → `/documento/[id]`, sem tela própria separada da `CabecalhoDaTela`.

## Decisões de design e perguntas abertas

- Decisão: tela normal **não é wizard** (diferente de `corrigir/retencao`, 4
  passos) — campo único (hoje→depois + anexo), sem motivo a escolher nem
  valor a digitar.
- Decisão: ordem de leitura (fato → por que não é pergunta → anexo →
  consequência → ação) — a `Dica` logo após o card resolve a dúvida óbvia de
  "por que não tem campo para digitar" antes que o Mateus procure um.
- Pergunta ao `cto-obra`/`lead-engineer`: Recusa 2 (`true`) mostra
  `{cnoReferenciado}` — confirmar que vem de `carregarDocumento`, sem chamada
  extra.
- Pergunta ao `po`: na Recusa 3, depois de cadastrar o CNO da obra, o Mateus
  reabre esta rota pela mesma URL, ou o fluxo deveria redirecionar de volta
  automaticamente? Hoje só devolve "Voltar ao documento" — sem presumir
  redirecionamento sem requisito fechado.
