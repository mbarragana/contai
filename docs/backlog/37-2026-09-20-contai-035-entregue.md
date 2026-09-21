# CONTAI-035 entregue — 2026-09-20

D39 revisada (saiu + sem apoio hábil no ano certo = vermelho; senão = âmbar)
reconciliada com todos os call sites reais: `gravidadeDaRegua(...)` em
`lib/fiscal/gravidade.ts` vira o único produtor de um tipo `Gravidade`
branded — nenhuma pendência nova compila com cor literal chutada (D54).

Item C ficou com **9 sites, não 7** como a correção de 24/08 registrou (que já
tinha corrigido o inventário original de 5). Os 2 a mais são
`app/pagamento/[id]/obra/page.tsx:355` e `:632`, gêmeos de
`documento/[id]/obra` — a tela nasceu no CONTAI-008, **depois** do inventário
de 23/08 que gerou este ticket, então não existia para ser contada. Achado
pelo `lead-engineer` no Gate 1, aceito pelo `cto-obra` e pelo `contador` no
Gate 2 (a mesma constante `GRAVIDADE_CORRECAO_ANO_ANTERIOR`, o mesmo fato
fiscal — custo de ano anterior mudou, nada sustenta o valor até desfecho de
retificadora — se aplica igualmente nos dois sentidos do move ratificado
pelo Gate Fiscal do CONTAI-008). **Se um próximo ticket tocar telas
espelhadas (documento↔pagamento), confira as duas antes de fechar o
inventário de sites afetados.**

Testado: 742 unitários (30 novos em `gravidade.test.ts`, tabela-verdade
completa da D39 + exceção nomeada fechada por união de TypeScript) + 203/204
E2E (falha restante é o teste flaky de fuso horário já documentado em
`docs/backlog/35-...md`, não fiscal) + validação manual no browser.

Nenhuma dívida fiscal nova. Dívida técnica já registrada no próprio ticket:
`<Chip cor="amb">` literal em JSX novo ainda compila (o brand tranca os
produtores de `lib/fiscal/`, não a prop do componente) — mitigação é review
no Gate 2, sem trava de compilador (guarda adicional quebraria os âmbares
legítimos que não são pendência da régua).
