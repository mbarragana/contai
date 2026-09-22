# CONTAI-045 Compromisso e Pendência — detalhe migra para o shell de gestão

## Tipo e Prioridade
chore/refactor de UI — **P1, fricção de processo**. Mesma natureza dos
`CONTAI-043`/`044`. **Terceiro dos quatro tickets** da dívida do
`CONTAI-040` (ordem sugerida: `043` → `044` → `045` → `046`).

## Dor de Origem
Mesma dívida nomeada em `app/(captura)/layout.tsx`. Dois seams já em
produção, e este ticket fecha os dois de uma vez porque nasceram das duas
telas do dashboard que o próprio `CONTAI-040` entregou:

- `app/_components/agendado.tsx` (painel "Agenda" do dashboard) linka
  `/compromisso`, `/compromisso/${id}`, `/compromisso/${id}/confirmar`,
  `/compromisso/${id}/cancelar` e `/compromisso/${id}/data`.
- `app/_components/fila-pendencias.tsx` (fila do dashboard **e** de
  `/pendencias`, já unificada pelo `CONTAI-042`) linka
  `/pendencias/${p.id}`.

Ou seja: as duas telas mais visitadas do shell novo (dashboard e
`/pendencias`) já derrubam o usuário na casca velha a cada clique num
compromisso ou numa pendência persistente.

## User Story
Como dono da obra confirmando que um pagamento agendado saiu, adiando uma
data ou resolvendo uma pendência da fila, quero que o clique a partir do
dashboard ou de `/pendencias` continue dentro do shell — sem trocar de casca
para uma ação de dois cliques.

## Escopo e Critérios de Aceite

**✅ Entregue em 2026-09-21, 6/6 critérios.** `compromisso`/`compromisso/[id]`
(+ `cancelar`, `confirmar`, `data`) e `pendencias/[id]` migraram para o
shell, coluna 640px. D65 (`cValor` sem default) confirmada intacta pelo
`contador` com os próprios olhos. Gate 2 (`cto-obra`+`contador`) APPROVE
sem retrabalho. 887 unitários + 256/257 E2E (1 falha pré-existente) +
validação manual. Gate 4 (`po`) PASS. Sem migration.

1. Mover para `app/(gestao)/`: `compromisso` (lista) e `compromisso/[id]`
   (+ `cancelar`, `confirmar`, `data`); `pendencias/[id]`. Comportamento
   idêntico, casca nova.
2. Coluna ~560px, mesmo padrão dos irmãos.
3. Nenhum texto fiscal muda — mesma prova de aceite (comparação byte a byte).
   Atenção especial em `compromisso/[id]/confirmar`: é a tela que o
   `CONTAI-034` corrigiu por default fiscal indevido (`cValor` pré-preenchido
   com o saldo previsto, **D65**) — a migração de casca não pode reintroduzir
   nenhum default em campo fiscal, e o teste-trava de `data-campo` (também do
   `034`) precisa continuar passando depois da mudança de rota.
4. `pendencias/[id]`: hoje é uma tela que resolve uma família específica
   entre as 18 unificadas pelo `CONTAI-042` — confirmar que o link de volta
   aponta para `/pendencias` (dentro do shell), não para a home antiga.
5. Sidebar, obra ativa e ano lidos de `useGestao()`, sem segunda leitura.
6. `375px` deixa de ser piso obrigatório. `/adicionar/*` intocado (nenhuma
   rota de compromisso/pendência é captura).

## Fora de Escopo
- Qualquer mudança na lógica de agendamento (`lib/fiscal/compromisso.ts`) ou
  na lista unificada de pendências (`lib/fiscal/pendencias-unificadas.ts`).
- O "seletor de ano sincronizado dashboard + `/pendencias`" (ticket futuro
  P1 já registrado no Gate 1 do `040`, ainda sem número) — fora deste ticket.

## Gate Fiscal (Contador)
Sem regra fiscal nova. Conferência do `contador` no Gate 2, com atenção
reforçada ao item 3 (a tela já teve um bug fiscal real de default indevido —
o `contador` confirma que o teste-trava do `034` sobrevive à mudança de rota
sem alteração).

## Pre-mortem
1. **`data-campo` do `CONTAI-034` quebrando silenciosamente na migração de
   rota.** `e2e/campos-fiscais.spec.ts` classifica toda rota de
   `app/**/page.tsx` — mover a pasta sem mover a âncora correta faz a suíte
   ficar vermelha nomeando o arquivo (comportamento desejado, não bug: é a
   trava funcionando). Conferir antes de considerar o ticket pronto.
2. **Link de volta de `/pendencias/[id]` apontando para rota que não existe
   mais** (`app/(captura)/pendencias` depois de mover) — mesmo risco de
   qualquer link relativo hardcoded em vez de derivado da rota atual.

## Dependências
- **Gate 0 RESOLVIDO em 2026-09-21**: mesmo spec "detalhe dentro do shell"
  (`design/mocks/detalhe-no-shell-v1.md`/`.html`, coluna 640px)
  do `CONTAI-043`.
- Não bloqueia nem é bloqueado pelos irmãos `043`/`044`/`046`.

## Cenário e checagem final
**Gestão** — em casa, sentado, resolvendo a fila. O "Teste do Canteiro" não
se aplica.
