# CONTAI-044 entregue — 2026-09-21 — pagamento e fatura migram para o shell

Segundo dos 4 tickets de migração de telas de detalhe (`043`-`046`).
`pagamento/[id]` (+ `ligar`, `obra`) e `fatura/[id]` (+ `alocar`,
`confirmar`, `parcial`) saem de `app/(captura)/` e entram em `app/(gestao)/`,
mesma casca do CONTAI-043 (`ColunaDeDetalhe` 640px, `RodapeDeAcao`,
`CabecalhoDaTela`, breadcrumb via `migalhaDaRota`). `navegacao.ts` ganhou
`pagamento`/`fatura` na tabela `VIEW_DA_ROTA_DE_DETALHE` → "Despesas".

Telas de leitura (`pagamento/[id]`, `fatura/[id]`) perderam o rodapé fixo —
as ações (ligar/desligar, confirmar/parcial) foram para dentro do card,
mesmo padrão de `/documento/[id]` (decisão 4 do spec: "ação certa ao lado
do fato certo"). Formulários mantiveram o rodapé, agora sticky escopado à
coluna.

`fatura/[id]/alocar` tinha uma pergunta aberta no ticket: precisaria de
exceção de largura por ter uma tabela densa de alocação do rotativo? O
lead-engineer (implementou em Sonnet nesta rodada — instabilidade
momentânea do modelo Opus, 4 falhas de API seguidas antes do troca;
confirmado pelo `cto-obra` que isso não muda o contrato de revisão) abriu
o arquivo real e resolveu sozinho, com justificativa: não é tabela, é uma
lista de `<label>` com checkbox por compra — mesma forma dos seletores
`ligar` já validados a 640px. Não escalou uma exceção sem necessidade.

Testado: 883 unitários + 252/253 E2E (1 falha pré-existente,
`discriminacao.spec.ts:215`, do `CONTAI-046` futuro) + validação manual no
browser. Gate 2 (`cto-obra`+`contador`) APPROVE sem retrabalho. Gate 4
(`po`) PASS, 5/5 critérios. Sem migration. Próximo: `CONTAI-045`
(compromisso+pendências).

## Dívidas nomeadas

- Repassada do `CONTAI-043`, ainda não resolvida: `page.tsx`/subrotas de
  pagamento e fatura continuam fazendo `carregarPainel`/`carregarPaineis`
  próprios em vez de consumir os painéis já carregados pelo
  `ProvedorDeGestao` do shell — carga dupla (não é leitura duplicada de
  "obra ativa"/sidebar/ano, que já está correta desde o `043`). Ao migrar
  `045`/`046`, decidir se o detalhe passa a consumir `useGestao()` também
  para os painéis.
- Achado operacional confirmado de novo nesta rodada: agentes concorrentes
  rodando E2E no mesmo Postgres local se contaminam — mesmo invariante já
  registrado no `043`, reforçado aqui.
