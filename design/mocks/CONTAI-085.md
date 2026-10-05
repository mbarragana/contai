# CONTAI-085 — corrigir o número/série de um documento já registrado
Nível: 1 (rota nova)   Cenário: gestão   Rota: `/documento/[id]/corrigir/numero`

Esqueleto idêntico a `corrigir/valor/page.tsx` (mesmos componentes:
`PassoMotivo`, `ListaDeAnexos`/`papelOriginal`, `CampoArquivo`,
`BotaoSalvar`/`RodapeDeAcao`, `MotivoEscolhidoResumo`, `ErroDeGravacao`,
`HistoricoDeCorrecoes`), **menos** o bloco "O que isso muda no seu custo" —
número não move custo (`valorCentavos`/`anos` continuam de fora deste campo).

## Telas e estados

- **Carregando**: igual à `corrigir/valor` — `Carregando rotulo="Carregando o documento"`.
- **Erro ao carregar**: `EstadoErro` com retry — igual.
- **Passo 1 — `PassoMotivo`** (reuso integral, sem alteração): vazio inicial
  (nada escolhido, CTA "Escolha o motivo para continuar"); 4ª opção
  "A nota está errada e eu ainda não pedi nada ao emitente" leva a
  `ErroEstaNaNota`, beco sem saída, sem rastro — reuso integral.
- **Passos 2/3 — o campo** (fundidos numa tela, como em `valor`):
  - Card "Número gravado hoje" (`Nº {numero}{serie ? ` · série ${serie}` : ""}`).
  - `ListaDeAnexos` "Papel anexado — confira antes de digitar" + `Dica` "o anexo
    não se substitui".
  - Campo `numero` (texto) + campo `serie` (texto, opcional), lado a lado se
    couber, senão um abaixo do outro — larguras de 375px empilham.
  - Se `motivo === "emitente_corrigiu_a_nota"`: `CampoArquivo` obrigatório
    ("Carta de correção ou nota substitutiva… Sem ele, esta correção não
    grava.") + `Consequencia cor="amb"` com o texto fiscal abaixo.
  - **Aviso de duplicidade** (não-bloqueante): acima do botão, só quando
    `duplicataDe({numero, serie, emitenteDocumento: d.favorecidoDocumento},
    registrados)` encontra outro documento (mesma obra+emitente, **excluindo
    o próprio documento em edição** da lista `registrados`). Reusa o texto
    literal já em produção em `adicionar/documento/page.tsx:1690-1701`:
    > "Essa nota já foi registrada em {data}. Confira antes de salvar — a
    > mesma nota registrada duas vezes conta o custo em dobro na declaração."
    > com link "Ver registro existente" → `/documento/{id-do-outro}`.
    Não bloqueia o botão — é aviso, igual à captura.
  - Card "O que fica registrado": `numero: {antes} → {depois}` e, só se a
    série mudou, `serie: {antes} → {depois}`. **Nunca** mostra "anos
    afetados" (o campo não existe nesta tela — número não move custo).
  - Botão: "Nada a corrigir" (desabilitado) se número E série digitados
    batem exatamente com o gravado; "Anexe o documento novo para gravar" se
    faltar anexo obrigatório; senão "Gravar a correção".
- **Gravando**: `BotaoSalvar` ocupado, rótulo "Gravando…".
- **Erro ao gravar**: `ErroDeGravacao` — "Não deu para gravar. **Nada foi
  alterado** — o número continua {numero atual} e nenhum registro de
  correção foi criado." Retry sem redigitar (campo e anexo preservados).
- **Gravado (sucesso)**: `CabecalhoDaTela titulo="Número corrigido ✓"`.
  `Banner cor="grn"`: "Corrigido. O número desta nota agora é **{numero
  novo}**{série, se mudou}, e a correção ficou registrada no histórico do
  documento." Sem cards de "custo confirmado por ano" (não se aplica).
  `HistoricoDeCorrecoes` embaixo, igual às três telas-irmãs.

## Campos

- `numero` — texto — obrigatório — comparação **literal** (zeros à esquerda
  preservados, nunca normalizada) — recusa: vazio (CTA desabilitado) e igual
  ao gravado ("Nada a corrigir") — SEM DEFAULT (campo fiscal)
- `serie` — texto — opcional — comparação literal — SEM DEFAULT
- `anexo` — arquivo — obrigatório **só quando** `motivo === "emitente_corrigiu_a_nota"` — mesma validação/mensagem de `corrigir/valor`

## Textos com consequência fiscal

- "`documento.arquivo_path` não muda. A nota nova entra como anexo adicional
  do documento — o arquivo original continua lá. O dossiê lista os dois
  arquivos." — já fechado no Gate Fiscal deste ticket (copiar verbatim); raiz
  normativa em `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md`
  §1, linha `arquivo_path` ("NÃO CORRIGÍVEL… anexa-se adicional").
- Aviso de duplicidade: texto citado acima, origem
  `app/(captura)/adicionar/documento/page.tsx:1690-1701` (já em produção —
  reuso literal, não nova redação).

## Navegação

- `/documento/[id]` → `/documento/[id]/corrigir/numero` — novo link na lista
  de correções, junto de "Corrigir o valor" / "Corrigir a classificação" /
  "Corrigir o nome do emitente": rótulo **"Corrigir o número/série — hoje: Nº
  {numero}"** (mostra só o número no link; série aparece dentro da tela).
- Botão "Cancelar" / `ErroEstaNaNota` → `/documento/[id]` — sem gravar.

## Decisões de design e perguntas abertas

- Decisão: não reuso de `conta`/`anosAfetadosDeUmaObra` nesta tela — número
  nunca entra na conta de custo, então todo o bloco "passo 3" de `valor`
  (incluindo a chamada a `alocarCusto`) é **cortado**, não ocultado por CSS.
- Decisão: o aviso de duplicidade dispara com debounce de 500ms, igual à
  captura — é a mesma função pura (`duplicataDe`), só a fonte de
  `registrados` muda (aqui vem de `carregarPainel`/documentos da obra, já
  carregado pela tela, filtrando o próprio `id`).
- Pergunta ao `cto-obra`/`lead-engineer`: `duplicataDe` hoje recebe
  `DocumentoRegistrado[]` — confirmar que o painel já carregado pela tela
  (`carregarPainel`) tem esse formato pronto, sem chamada de rede extra para
  o aviso.
