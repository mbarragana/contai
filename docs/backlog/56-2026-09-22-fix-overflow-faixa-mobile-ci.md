# Fix: overflow da faixa mobile escondia "+ Novo registro" — 2026-09-22

CI do GitHub reportando falha (5 runs seguidos vermelhos desde o CONTAI-040,
todos passando localmente no Mac): `e2e/vinculo.spec.ts:907` ("fila longa
rolada até o meio: o alvo continua no lugar"), `toBeInViewport` com
`viewport ratio 0`.

Diagnóstico, via trace baixado do GitHub Actions (`gh run download`,
screenshot no `error-context.md`): a faixa mínima de navegação mobile do
shell (`app/_components/shell.tsx`, `<nav data-shell="faixa">`, abaixo de
`lg`, entregue no CONTAI-040) estourava os 375px no Linux do CI — fonte de
fallback mais larga que no Mac, somada ao badge de pendências com 2
dígitos ("10", visível no screenshot) — empurrando "+ Novo registro" para
fora da área visível. Causa raiz: o link vivia dentro do MESMO contêiner
`overflow-x-auto` dos 4 links de navegação, só posicionado à direita via
`ml-auto`; quando o conteúdo estoura, ele fica atrás do scroll (que nasce
em `scrollLeft: 0`), nunca visível sem rolar.

Isso violava diretamente o próprio propósito do componente (comentário no
código: "a porta do canteiro não pode se perder", CONTAI-040 critério 6) —
não é frescura de CI, é o mesmo bug que aconteceria no celular real do
Mateus se a fonte renderizasse um pixel mais larga ou o badge chegasse a
2 dígitos (o que já aconteceu na obra real).

**Correção**: os 4 links de navegação foram para um `<div overflow-x-auto>`
PRÓPRIO; "+ Novo registro" virou irmão `flex-none` FORA desse contêiner
rolável — sempre visível, nunca depende de scroll.

**Guarda permanente adicionada** (decisão do `cto-obra`, não excesso de
engenharia — o bug custou 5 runs de CI + investigação de trace, e o vetor
de regressão, "reunir os dois contêineres de novo" ou "badge de 3
dígitos", é refactor plausível): novo teste em `vinculo.spec.ts`, viewport
320px (proxy determinístico de "375px com fonte mais larga", reproduz o
estouro no Mac sem depender do Linux), badge inflado para 2 dígitos via
fixture (5 pagamentos + 8 documentos → badge 10, o mesmo número do
incidente real). Provado não-vacuoso: falha contra o código de antes do
fix (`viewport ratio 0`, mesmo sintoma do CI), passa depois.

Fix + guarda revisados pelo `cto-obra` (APPROVE, com verificação própria —
reproduziu a falha contra `HEAD` antes de aceitar o relato do lead).
274/274 E2E, 925 unitários. Sem migration, sem regra fiscal tocada (é
layout puro).
