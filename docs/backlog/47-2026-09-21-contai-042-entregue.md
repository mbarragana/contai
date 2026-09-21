# CONTAI-042 entregue — 2026-09-21 — /pendencias vira a fila única das 18 famílias

Primeiro ticket da sequência "desktop shell" (ordem reconciliada com o
`cto-obra`: 042 → 040 → 041, para o dashboard nunca nascer escondendo
pendência). `lib/fiscal/pendencias-unificadas.ts` (novo) agrega as 18
famílias — as 7 de `ResumoObra.pendencias[]` mais 11 que hoje só existiam
agregadas em `app/page.tsx` (PendenciaCno, pendenciasDeCorrecao,
emitenteErrado, vinculosCruzandoObras, terrenoPagoSemComprovante,
documentosSemArquivo, terrenoSemData, terrenoMaisDeUmaData,
financiamentoFaltaLancar, financiamentoAguardandoInforme,
terrenoSemRegistro) — numa lista única, agrupada por gravidade.
`app/pendencias/page.tsx` passa a renderizar tudo, sem shell nenhum (isso é
o CONTAI-040). `notasSemPagamento` fica de fora por não ser pendência
(terceiro estado neutro, parecer §5.2).

Decisão fiscal formal do `contador` (`docs/pareceres/2026-09-21-gate-fiscal-
contai-042.md`): as 8 famílias que hoje usam cor literal em JSX NÃO passam
por `gravidadeDaRegua` — usar a régua fabricaria fato fiscal (ex.: CNO, que
não toca o IRPF, sairia âmbar pelo branch default da régua, descendo a
única pendência que impede a venda). Viraram constantes `"red"|"amb"`
nomeadas no módulo dono de cada texto, lidas também pela home.

Gate 2 com 1 rodada de REQUEST CHANGES do `cto-obra`: 6 cards tinham sido
copiados de `app/page.tsx` para `/pendencias` em vez de extraídos — corrigido
com `app/_components/pendencias-derivadas.tsx`, fonte única para as duas
telas. A extração revelou e corrigiu duas divergências pré-existentes entre
home e `/pendencias` (borda extra num card, redação do chip "Aguardando
informe") — confirmadas pelo `contador` como mudança de onde/como o texto
aparece, nunca do que ele afirma.

Testado: 859 unitários (20 novos) + 247 E2E (5 novos) + validação manual no
browser com 3 famílias de pendência simultâneas (agrupamento por
gravidade, texto fiscal sem corte, escopo declarado em tela, home
intocada). Gate 4 (`po`) PASS, 6/6 critérios + 9/9 do checklist fiscal.
Sem migration.

## Dívidas nomeadas

- Dívidas do próprio parecer fiscal (§10), não bloqueantes: auditoria dos
  2 predicados de "nota sem CNO"; ordenação de `financiamentoFaltaLancar`
  de ano antigo; linha de status do veto das saídas anuais; garantir que
  `AvisoEquiparacao` não perca superfície quando o CONTAI-040 reduzir a
  home.
- Achado do `cto-obra` no Gate 2, não deste ticket: `bloco(cor)` e
  `bordaDaCor` aceitam `"red"|"amb"` solto, não branded — uma família
  futura pode chamar sem constante nomeada. Brandar `CorDeclarada` (mesma
  técnica de `Gravidade`) fecha isso, ticket próprio.
- Achado colateral do `cto-obra`, fora do diff deste ticket: `app/obras/[id]
  /terreno/page.tsx` e `.../terreno/desembolsos/page.tsx` ainda pintam o
  chip "Falta a data" com `cor="red"` literal, apesar de `COR_TERRENO_SEM_
  DATA` já existir como "definição única" — mesmo padrão de risco (D46),
  ticket de 3 linhas.
