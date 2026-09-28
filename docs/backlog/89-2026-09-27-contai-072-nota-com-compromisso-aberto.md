# Achado + ticket novo — 2026-09-27 — nota com compromisso aberto aparece como "sem pagamento vinculado"

**Origem**: consulta direta do Mateus ao banco de produção (read-only). O card
"Notas hábeis sem pagamento vinculado" na Home mostrava 3 notas com CTA "Ligar
a um pagamento", como se nada estivesse em andamento — mas as 3 já tinham um
`compromisso` **aberto** (compra no cartão agendada) vinculado via
`documento_origem_id`, e apareciam ao mesmo tempo em "Agenda — próximos
compromissos", com o mesmo favorecido e valor.

Palavras dele: *"isso aqui não faz sentido para mim. Se já tem um pagamento
agendado ao item, não faz sentido ele aparecer na lista de itens: 'Notas
hábeis sem pagamento vinculado'."*

**Causa raiz**: `documentosHabeisSemPagamento` (`lib/fiscal/vinculo.ts:981-987`)
filtra só `d.habil && d.pagamentos.length === 0`, sem olhar `compromisso`
nenhum. Alimenta tanto `resumo.notasSemPagamento` (Home) quanto
`CHIP_SEM_PAGAMENTO`/`linha.semPagamentoLigado` (`/despesas`) — mesma fonte,
mesmo problema nas duas telas.

**Passo 1 (`po`)**: user story + 3 riscos de pre-mortem + critérios formulados
como comportamento observável, sem prejulgar se a nota sai da lista (isso
ficou para o Gate Fiscal).

**Passo 2 (`contador`)**: confirmou que o parecer `2026-08-18-compromisso-
versus-pagamento.md` já fecha o caso — a nota **nunca sai** da lista/soma
(§1, §2 itens 6 e 8: compromisso não é pagamento, pode ser cancelado, e não
entra em soma nenhuma sob nenhum rótulo). Só o **texto/CTA** pode mudar, e
achou um ângulo que ninguém tinha citado: o ADENDO §A do mesmo parecer já diz
que **compromisso vencido sem resposta bloqueia a geração de qualquer
relatório anual** — então o card precisa de **dois** sub-estados de texto, não
um: "agendado, dentro do prazo" (baixa urgência) vs. "agendado e vencido, sem
resposta" (alta urgência, ecoando um bloqueio que já existe em outro lugar do
produto). Nenhum parecer novo necessário — citação exata com números de linha
no ticket.

**Passo 3 (`cto-obra`)**: zero migration. Achado de arquitetura importante:
compromisso **não pode** entrar em `lib/fiscal/vinculo.ts` nem em
`lib/fiscal/resumo.ts` — barreira de tipo já existente e comentada nos dois
arquivos (`resumo.ts:490-493`, `compromisso.ts:20-24`), motivada pelo parecer
§2 item 7. Solução: função pura nova `agendamentosPorDocumento` em
`lib/fiscal/compromisso.ts`; `NotaSemPagamento` (Home) ganha só um
`documentoId: string` simples e o cruzamento acontece no consumidor
(`app/(gestao)/page.tsx`, que já tem `resumo` e `agenda`/`compromissos` no
mesmo estado); `lib/fiscal/despesas.ts` pode importar `compromisso.ts`
diretamente (sem a mesma barreira) e recebe `compromissos`/`hojeIso` como
parâmetro novo. Reaproveita `chipDoAgendado`/`resumoDoAgendamento`/
`ehVencidoSemResposta`, textos já existentes. Complexidade S/M. Dívidas
registradas e conscientemente não corrigidas: vínculo cross-obra, compromissos
quitados antes da migration `0020` sem vínculo propagado (D82/D83) — os dois
degradam para "sem compromisso", não é regressão.

**Passo 4 (`designer`)**: nível 3 (tabela antes/depois + um ASCII do card da
Home) — sem `design/mocks/CONTAI-072.md` separado, é troca de texto/cor/link
em slots que já existem. Nenhum texto novo inventado: reusa `chipDoAgendado`
("Agendado" / "Venceu em DD/MM/AAAA · N dia(s) sem resposta"),
`resumoDoAgendamento` ("{favorecido} — previsto R$X para DD/MM/AAAA") e
`VENCIDO_SEM_RESPOSTA` (hoje em `app/_components/agendado.tsx`). Achou dois
pontos técnicos, ambos incorporados como critério no ticket: (1) o mesmo
conflito de barreira de tipo que o `cto-obra` já tinha resolvido — achado
independente, em paralelo, chegando à mesma conclusão; (2) `VENCIDO_SEM_
RESPOSTA` mora hoje num arquivo de componente (`app/_components/agendado.tsx`)
e `lib/fiscal/despesas.ts` (lib pura) precisaria dela — vira critério 9 do
ticket: mover a constante para `lib/fiscal/compromisso.ts`, reexportada,
mesma redação. Confirmou que nenhum dos dois sub-estados usa vermelho — a
régua do app escala "vencido" por peso visual (vazado→preenchido), nunca por
matiz, porque nenhum dinheiro saiu da conta em nenhum dos dois casos.

**Resultado**: `CONTAI-072` criado (P1, sem migration, sem UI nova, Gate
Fiscal fechado sem parecer novo), `docs/tickets/CONTAI-072.md`. Pronto para
`/develop` — nenhuma pergunta pendente do Mateus.
