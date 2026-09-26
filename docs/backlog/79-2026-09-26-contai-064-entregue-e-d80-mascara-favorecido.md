# CONTAI-064 entregue (26/09) e dívida D80 nomeada

## CONTAI-064 — compra no cartão herda favorecido/CNPJ/valor da nota de origem

Gate 4 fechado. Os 11 critérios de aceite do ticket (`docs/tickets/CONTAI-064.md`)
passaram PASS, incluindo o critério 9 — achado do `designer` fora da Viabilidade
original do `cto-obra`, confirmado no escopo do ticket no Gate 2:
`app/(gestao)/documento/[id]/corrigir/emitente/page.tsx` ganhou
`?voltar=compra-cartao`, sem o qual "Corrigir na nota" a partir da compra no
cartão devolvia o Mateus para `/adicionar/pagamento` vazio, trocando o meio de
pagamento sem avisar.

`npm run quality` verde: lint limpo, typecheck limpo, **1121 Vitest** / **338
Playwright**. Zero migration, como a Viabilidade previa.

## D80 — `favorecido.documento` com máscara gravado por `compra-cartao` ANTES do CONTAI-064

Nomeada por pedido do Gate 2 do `cto-obra`. Antes deste ticket,
`app/(captura)/adicionar/compra-cartao/page.tsx` gravava
`favorecido.documento` com o CNPJ **formatado** (máscara `00.000.000/0000-00`)
em vez de só dígitos — o `criarCompraCartao` de hoje corrige isso
(`soDigitos(documento)` antes de `garantirFavorecido`, ver
`compra-cartao/page.tsx`, comentário no `salvar()`), mas **linhas antigas,
gravadas em produção antes de 2026-09-26, podem ter ficado com a máscara**.

A dedup de `garantirFavorecido` é pela chave `(user_id, documento)` — se a
mesma empresa também tiver uma linha só-dígitos (criada pelo caminho de
pagamento avulso, que sempre gravou certo), a ficha Pagamentos Efetuados sai
com a mesma empresa em duas linhas.

### Query de diagnóstico (rodar no banco REMOTO)

```sql
select id, nome, documento from favorecido where documento ~ '\D';
```

- **Vazio** → a dívida está **fechada sem migration nenhuma** (nunca aconteceu
  na prática, ou as linhas afetadas já foram corrigidas por outro caminho).
- **Alguma linha** → ver a regra de correção abaixo antes de tocar em qualquer
  UPDATE.

### Regra de correção — NÃO fazer `update regexp_replace` cego

Para cada linha que a query acima devolver:

1. Calcular a versão só-dígitos do `documento` (`regexp_replace(documento,
   '\D', '', 'g')`).
2. Verificar se **já existe** uma segunda linha de `favorecido` com essa
   versão só-dígitos, para o mesmo `user_id`.
   - **Se NÃO existir**: seguro fazer o `UPDATE` direto nessa linha
     (`documento = regexp_replace(documento, '\D', '', 'g')`) — não colide com
     a unique `(user_id, documento)`, não há segunda linha para reconciliar.
   - **Se JÁ existir**: **não faz o UPDATE** — colidiria com a unique
     `(user_id, documento)`. Exige merge manual:
     a. decidir qual das duas linhas de `favorecido` sobrevive (a mais antiga,
        normalmente — é a que tem mais FKs apontando para ela);
     b. repassar as FKs de `compromisso`, `pagamento` e `documento` que
        apontam para a linha perdedora, para a linha sobrevivente;
     c. só então apagar a linha perdedora (ou, se o schema não permite DELETE
        de `favorecido` pelo papel `authenticated`, via administrador do
        banco, mesma exceção nomeada para limpeza de teste no CLAUDE.md).

Nenhuma migration entra automaticamente por esta dívida — a correção, se
precisar acontecer, é uma operação pontual no banco remoto, não um script que
roda sozinho.

### Status

Aberta. Ninguém rodou a query de diagnóstico ainda no banco remoto (fora do
escopo deste Gate 4 — é ação de banco de produção, não de código). Quem fechar
esta dívida deve rodar a query, documentar o resultado nesta mesma entrada (ou
numa nova, referenciando esta) e só então marcar D80 como fechada no índice.
