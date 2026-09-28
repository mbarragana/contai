# CONTAI-078 Busca na lista de candidatos de vínculo pagamento↔nota

## Tipo e Prioridade
Feature — **P1** — fricção real sobre feature recém-entregue (CONTAI-074):
sem busca, a lista de candidatos não escala para a quantidade real de
pagamentos da obra (Mateus estima ~300).

## Dor de Origem
Relato: `docs/backlog/94-2026-09-28-scroll-e-busca-nas-telas-de-ligar.md`.

Mateus, tentando ligar uma parcela à nota real da Ilhamix Concreto: *"imagina
com 300 pagamentos para achar um pagamento compartilhado vai ficar
horrível"*. Confirmado: nenhuma das duas telas do CONTAI-074 tem filtro
textual sobre a lista de candidatos — só ordenação algorítmica.

## User Story
Como dono da obra ligando pagamento e nota, quero filtrar a lista de
candidatos por texto, para não depender só da ordenação numa lista com
dezenas a centenas de itens.

## Critérios de Aceite
1. [x] Spec nível 2 em `design/mocks/CONTAI-078.md` cobre o campo, os dois
   estados de vazio e a regra de contagem — implementação segue o spec.
2. [x] `/documento/[id]/ligar` tem um campo de busca (`<input>`, `aria-label
   ="Buscar pagamentos"`, placeholder "Buscar por favorecido ou valor…")
   que filtra a lista de candidatos pelo texto digitado.
3. [x] `/pagamento/[id]/ligar` tem o mesmo campo (`aria-label="Buscar
   notas"`, placeholder "Buscar por favorecido, valor ou número da nota…").
4. [x] O campo só é renderizado quando o total de candidatos (visíveis +
   cobertos) é maior que 5; com 5 ou menos, não aparece.
5. [x] Índice de busca: favorecido (normalizado, sem diacrítico) e valor
   (comparação por dígitos — "16240" ou "16.240,00" casam R$16.240,00); em
   `/pagamento/[id]/ligar`, também o número da nota.
6. [x] A busca filtra o CONJUNTO de candidatos; a ordenação dentro do
   conjunto filtrado permanece a mesma de hoje (não introduz ordenação
   nova).
7. [x] O botão "Mostrar N já cobertos" conta N do subconjunto FILTRADO — com
   busca vazia, é igual a hoje; some por completo quando o filtro zera os
   cobertos.
8. [x] O bloco de cobertos continua colapsado por padrão mesmo quando algum
   item dele corresponde ao termo buscado — revelar continua sendo ação
   explícita do usuário (clique em "Mostrar N…"), nunca automático por
   causa da busca.
9. [x] Quando o termo de busca não é vazio e a lista filtrada (visíveis)
   fica vazia, aparece um card de **vazio-por-filtro**, distinto do
   vazio-de-verdade existente: texto "Nada encontrado para
   '{termo}'" + explicação curta + ação "Limpar busca" — **sem** a
   `Consequencia` fiscal que o card de vazio-de-verdade tem hoje.
10. [x] O card de vazio-de-verdade existente (com a `Consequencia` "os R$X
    ficam fora do Custo confirmado") passa a depender só do conjunto SEM
    filtro — nunca aparece por causa de busca sem resultado, só quando não
    há candidato nenhum de verdade.
11. [x] Função pura `filtrarCandidatos(candidatos, termo)` testável por
    Vitest, sem I/O, em `lib/gestao/busca-candidatos.ts`.
12. [x] `normalizar` (NFD sem diacrítico) é promovida de
    `lib/fiscal/despesas.ts` para `lib/texto.ts`; `despesas.ts` passa a
    importar de lá — não há duas implementações da mesma função.

## Out of Scope
- Busca no servidor — os candidatos já estão carregados em memória, filtro
  é 100% client-side.
- Scroll — vira `CONTAI-077`, ticket separado (zero arquivo em comum).
- "Vincular a nota antes de pagar" — fora de escopo, já comunicado ao
  Mateus, pode virar relato próprio no futuro.

## Gate Fiscal (Contador)
**Sem impacto fiscal** — filtro de exibição sobre dado já existente e já
correto. Os dois textos novos (vazio-por-filtro) não afirmam fato fiscal
nenhum — por isso não carregam `Consequencia`, ao contrário do vazio de
verdade.

## Pre-mortem
1. **Busca revela o bloco colapsado automaticamente**: mitigado pelos
   critérios 7 e 8 (só o número reage, revelar continua manual).
2. **Card de vazio-por-filtro reaproveita o texto fiscal do vazio-de-verdade
   por engano** (copy-paste do card existente): mitigado pelos critérios 9
   e 10, que exigem os dois estados literalmente distintos e testáveis.
3. **`normalizar` duplicada** entre `despesas.ts` e a nova busca, divergindo
   com o tempo: mitigado pelo critério 12 (promovida para `lib/texto.ts`,
   uma fonte só).

## Viabilidade (CTO)
- **Modelo de dados**: zero. Filtro client-side sobre `PainelDados` já
  carregado.
- **Arquivos**: `lib/gestao/busca-candidatos.ts` (+ `.test.ts`),
  `lib/texto.ts` (`normalizar` promovida), `lib/fiscal/despesas.ts` (passa a
  importar de `lib/texto.ts`), `app/(gestao)/documento/[id]/ligar/page.tsx`,
  `app/(gestao)/pagamento/[id]/ligar/page.tsx`, `e2e/vinculo.spec.ts`,
  `design/mocks/CONTAI-078.md` (já escrito).
- **Complexidade: M**.
- **Dívidas criadas**: nenhuma.

## Dependências
Bloqueado por / Bloqueia: nenhum. Independente do `CONTAI-077` (zero arquivo
em comum, confirmado pelo `cto-obra`).

## Perguntas Abertas
Nenhuma.

## Cenário e checagem final
**Gestão** (conciliação pagamento↔nota, em casa, sentado). Serve à meta 1
(nenhum pagamento sem documento hábil): reduz a chance de o Mateus desistir
de procurar um candidato numa lista longa e deixar um pagamento sem nota
por cansaço de rolar/procurar. Sem condição fiscal órfã (Gate Fiscal
fechado, sem impacto). Sem UI que quebre disciplina de campo fiscal (o
campo de busca não é fiscal, não precisa de "sem default"). **Veredito:
APROVADO.** Pronto para `/develop`.

✅ **Entregue em 2026-09-28.** Gate 4 (`po`) PASS, 12/12 critérios. Campo de
busca (`aria-label` distinto por tela) em `/documento/[id]/ligar` e
`/pagamento/[id]/ligar`, só acima de 5 candidatos, filtrando por favorecido
(normalizado, `lib/texto.ts`) e valor (por dígitos); `filtrarCandidatos`
função pura nova em `lib/gestao/busca-candidatos.ts`. Filtro preserva a
ordenação de entrada, nunca revela sozinho o bloco "Mostrar N já cobertos"
(só o número reage). Estado de vazio-por-filtro é card novo e distinto do
vazio-de-verdade — sem a `Consequencia` fiscal, que continua exclusiva de
quando não há candidato nenhum de verdade (não por causa do filtro). Gate 2
(`cto-obra`) aprovou sem pendências bloqueantes (1 sugestão sobre
`e2e/campos-fiscais.spec.ts`, não aplicada). Suíte completa (`npm run
quality`, em paralelo com CONTAI-076/077): 408/409 E2E, única falha é flake
confirmado em arquivo não relacionado. Sem migration. Sem dívida nova.
