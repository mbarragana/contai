# CONTAI-066 entregue (2026-09-26) — atalho até confirmar + texto de contexto

Gate 4 (`po`) fechado: 8/8 critérios PASS. Sem migration.

Na tela "Agendado" de `/adicionar/compra-cartao`, quando
`fase.dataVencimento <= hoje`, o link primário do rodapé passa a levar a
`/fatura/{faturaId}/confirmar` com o rótulo **"Confirmar o pagamento"** —
antes disso, "Ver a fatura" apontando para uma tela sem campo de anexo era o
beco sem saída do relato original. Vencimento futuro mantém o comportamento
de sempre (`/fatura/{faturaId}`, "Ver a fatura"). O mesmo Card ganha uma
segunda `<Dica>` de wayfinding quando a fatura já venceu, e o banner âmbar do
formulário ganha a mesma frase (substância única, duas ocasiões — presente na
tela salva, futuro no formulário) assim que o Mateus digita um vencimento
`<= hoje`. Guard de string vazia no formulário (`dataVencimento !== "" && ...
<= hoje`) evita a frase aparecer com o campo em branco.

O rótulo do botão final continua **"Agendar — não entra no custo"** literal,
byte a byte, independente de qualquer data — os 4 seletores E2E
(`e2e/cartao.spec.ts` ×3 antigos + 2 novos, `e2e/compromisso.spec.ts` ×1)
seguem batendo. Mecanismo de gravação intocado: a compra continua nascendo
sempre `compromisso` via `criarCompraCartao`, nunca passa por
`decidirRegistro` (adendo §B(c)) — o redirect só muda para onde o Mateus vai
depois de salvar, não afirma que a fatura foi paga (vencido ≠ pago; quem
afirma o pagamento continua sendo o clique dentro de `/fatura/[id]/confirmar`,
Pre-mortem 1 do ticket).

Gate Fiscal: os dois textos novos são paráfrases da mesma frase, conferidos
byte a byte contra `design/mocks/CONTAI-066.md` — nenhum reescreve a Dica
fiscal existente nem introduz categoria/percentual novo. Achado de navegação,
não fiscal, como o parecer já diagnosticava.

Arquivos finais tocados (só estes, confirmados sem mudança desde o APPROVE do
`cto-obra` no Gate 2):
- `app/(captura)/adicionar/compra-cartao/page.tsx` — `faturaVencida` em dois
  escopos (formulário e tela "Agendado"), frase extra no banner âmbar
  existente, segunda `<Dica>` no Card "Agendado", rodapé condicional.
- `e2e/cartao.spec.ts` — 2 casos novos (`hoje()`/`maisDias()`, datas
  relativas de propósito — data fixa trocaria de significado sozinha).

`npm run typecheck` limpo, `npm run lint` limpo, `npx playwright test
e2e/cartao.spec.ts` (16/16) e `e2e/compromisso.spec.ts` (12/12, o 4º seletor
do critério 4) verdes. `npm run quality` completo não rodado nesta rodada —
escopo do Gate 4 foi os specs citados no critério 4, por instrução explícita
de quem acionou o Gate 4; nenhuma unidade/E2E fora de `cartao`/`compromisso`
foi tocada pelo diff, então o risco de regressão residual é baixo, mas fica
registrado como pendência de confirmação formal antes do próximo `git push`.

`067` fica sozinho na fila, pronto.
