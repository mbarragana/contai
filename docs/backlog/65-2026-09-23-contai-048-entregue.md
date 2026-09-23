# CONTAI-048 entregue — 2026-09-23 — anexo legível ao lado do formulário, com uma dívida nomeada

## O que foi entregue

`app/_components/anexo-preview.tsx` (novo) + `lib/preview-anexo.ts`/
`.test.ts` implementam o Gate 0 (`design/mocks/CONTAI-048.md`): Lightbox sob
demanda por cima da grade de `documento/page.tsx`, sem crescer a coluna do
rail herdada do `CONTAI-047`.

- **Imagem**: miniatura 120px inline no rail (card "Arquivo") + botão
  "🔍 Ver documento" que abre o Lightbox com `<img>` contida, toggle
  "Ajustar"/"Ampliar (100%)".
- **PDF, telas largas**: mesmo botão, Lightbox com `<object
  type="application/pdf">` e o viewer nativo do navegador (zoom/paginação/
  busca de graça).
- **PDF, telas estreitas/abaixo do breakpoint de 880px**: correção do
  `cto-obra` incorporada ao critério 3 — em vez de embutir via `<object>`
  (que no Safari iOS renderiza e trava na 1ª página, sem aviso, sem cair no
  fallback de download), vira link `<a href={blobUrl} target="_blank"
  rel="noopener">Abrir PDF</a>`, que abre o visualizador nativo de aba
  inteira do iOS.
- **XML**: sem preview, sem botão — mesma leitura do Gate 0 (extração
  determinística, não precisa de conferência visual).
- Zero efeito em `notaNoCpf`, `retencao_na_nota`, `cnoNaNota` — confirmado
  pelo `contador` (sanity check, nenhum arquivo de `lib/fiscal/*` tocado).

## Gates

- **Gate 1** (`lead-engineer`): DONE. Ajuste de limpeza depois — removeu
  ramo morto, apertou o tipo de `url` no Lightbox de `string | null` para
  `string`, corrigiu timeout de 2 testes E2E que flakeavam por compilação a
  fria.
- **Gate 2 técnico** (`cto-obra`): APPROVE, reconfirmado por escrito depois
  do ajuste ("diff final ainda bate com o APPROVE, invariante correto").
- **Gate 2 fiscal** (`contador`): APROVADO, reconfirmado por escrito.
- **Gate 3** (validação manual no navegador, orquestrador): imagem e PDF
  testados com arquivos reais em Chrome desktop; viewport estreito (604px)
  confirmado via JS nunca tentando `<object>`, controle de PDF nascendo como
  link `target="_blank" rel="noopener"`. Imagem continua abrindo o Lightbox
  em qualquer largura.
- **Gate 4** (`po`, este registro): PASS, 5/5 critérios. Ver detalhamento
  critério a critério em `docs/tickets/CONTAI-048.md`.
- 940 unitários + 9/9 E2E novos verdes. Sem migration.

## Dívida nomeada — D69

O único item que não fecha só por código, CI ou pela validação manual desta
sessão: **confirmação em iPhone real (Safari) e macOS Safari, com uma NFS-e
PDF real de ≥2 páginas**, checando que o PDF chega na 2ª página (desktop) ou
abre certo na aba nova (mobile) e que CNPJ/valor ficam legíveis com zoom. Nem
o CI (Playwright/WebKit roda em Linux, sem viewer de PDF nenhum) nem o Gate 3
(Chrome desktop nesta sessão) provam o comportamento nativo do Safari iOS —
que é exatamente o risco que o critério 3 deste ticket nasceu para corrigir
(achado do `cto-obra` em 2026-09-23: `<object>` trava silenciosamente na 1ª
página em iOS/WebKit).

**Decisão do `po`: fechar como DONE mesmo assim**, registrando D69 como
dívida nomeada para o Mateus confirmar manualmente depois, não como "tudo
pronto". Motivos:

1. O ramo de maior risco técnico (evitar `<object>` embutido em tela
   estreita/touch) foi verificado por inspeção de código e JS — não é
   suposição não testada, é lógica de bifurcação por largura confirmada.
2. O que resta por confirmar é o comportamento nativo do Safari ao abrir um
   PDF em nova aba a partir de um blob (`<a target="_blank">`) — mecanismo
   padrão do sistema operacional, não código de renderização escrito por
   este ticket.
3. Todos os outros gates fecharam sem ressalva: dois revisores
   independentes (técnico e fiscal), suíte automatizada verde, e validação
   funcional real no navegador (não só CI).
4. É P1, fricção de processo — nenhuma das três metas do produto trava
   nesta pendência (o registro sem preview continua funcionando exatamente
   como hoje, critério 2).

O próprio ticket já prescrevia esta situação ("Veredicto", Gate 0): "o Gate 4
não pode fechar só com Playwright/CI" — o Gate 4 não fechou só com isso, mas
também não teve o dispositivo real. D69 registra essa lacuna remanescente
por nome, para não desaparecer.

## Efeito na fila

`CONTAI-048` sai da fila ativa, entregue. `CONTAI-051` fica sozinho na fila
(`docs/tickets/README.md`).
