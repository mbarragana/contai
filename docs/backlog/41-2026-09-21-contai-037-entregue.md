# CONTAI-037 entregue — 2026-09-21 — porta para o pagamento conciliado a partir do documento

Achado na reconciliação do CONTAI-009 (24/08): quando uma nota tem mais de um
pagamento vinculado, a home só levava até `/documento/[id]` — não havia, de
lá, como abrir cada pagamento individual (só por SQL direto).

Cada linha de "Pagamentos desta nota" (`app/documento/[id]/page.tsx`,
`PagamentosDesteDocumento`) ganhou o `BotaoLink` "Ver o pagamento"
(`/pagamento/${p.id}`), antes do "Desligar este pagamento" existente —
simetria literal com o par já em produção na direção inversa ("Ver o
documento" em `/pagamento/[id]`, mesmo `className`). Nenhum dado de linha
mudou; reusa `alocado.pagamentos`, sem segunda derivação.

Sem regra fiscal nova (Gate Fiscal fechado, automático, sem CRC) — é segunda
porta de leitura para dado já calculado. Gate 2 (`cto-obra`) APPROVE sem
retrabalho. Testado: 839 unitários + 240 E2E (novo teste em
`e2e/vinculo.spec.ts` prova que o clique na 2ª linha abre o pagamento
clicado, não o primeiro) + validação manual no browser. Gate 4 (`po`) PASS,
5/5 critérios. Sem migration, sem dívida nova.

Fecha a fila ativa do índice de tickets — nenhum item restante em
"Fila de implementação" (ver `docs/tickets/README.md`).
