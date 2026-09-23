# `CONTAI-051` — lacuna achada na migração desktop: `/obras` ficou de fora

**2026-09-23**

## O achado

O coordenador auditou, rota por rota, quais telas de `app/(gestao)/` já
receberam tratamento de shell desktop desde o `CONTAI-040`. `app/(gestao)/
obras/page.tsx` — a tela "Trocar obra" (seletor que aparece quando não há
obra ativa confiável, e destino do link "Trocar obra" da sidebar) — nunca
entrou em nenhum dos tickets `040`, `043`-`046` ou `047`.

Confirmado por leitura direta do código:
- Não usa `ColunaDeDetalhe`/`CabecalhoDaTela` — retorna Fragment cru.
- `app/(gestao)/layout.tsx` não impõe teto de largura no `<main>`; cada
  página cuida do próprio, e esta não tem nenhum.
- `ListaDeEscolha` (`app/_components/obra.tsx`) renderiza os cards de obra
  sem largura máxima.
- Os botões "Cadastrar a primeira obra" e "+ Nova obra" estão hardcoded em
  `max-w-[430px]`, resquício isolado da era pré-shell.
- Resultado numa tela larga: lista esticada ao lado de botão apertado — a
  mesma classe de inconsistência que motivou a rejeição do Conceito 1 do
  `CONTAI-039`.

## Decisão do `po`

- Vira **`CONTAI-051`** (P1, reflow de layout puro, zero mudança de
  campo/lógica/texto fiscal — mesma disciplina dos `043`-`046`).
- **`ColunaDeDetalhe`/`CabecalhoDaTela` NÃO se aplicam aqui.** Esses dois
  componentes (`detalhe-no-shell-v1.md`) são para telas de DETALHE de um
  registro já carregado (documento, pagamento, obra aberta), com título
  vindo de dado e no máximo uma ação de página. `/obras` é a lista que se
  visita **antes** de haver uma obra aberta para detalhar — estruturalmente
  irmã de `/despesas` e `/pendencias` (nível superior da sidebar), não do
  `/obras/[id]`. Nem `/despesas` nem `/pendencias` usam esses componentes
  hoje, e `/obras` não deveria ser a exceção.
- **Gate 0 fechado por reaproveitamento — sem acionar o `designer`.** Não há
  campo novo nem decisão de qual moldura de detalhe usar (não é nenhuma). A
  única variável de desenho é a largura do envoltório da lista de escolha;
  o ticket já deixa um número de partida (640px — mesma medida que
  `ColunaDeDetalhe` usa como "coluna confortável", reaproveitada só como
  medida) para o `cto-obra` fechar no próprio Gate 1, do mesmo jeito que já
  se ajustam medidas sem novo mock dentro desta família de tickets.
- Entra na fila ativa em **posição 2**, logo depois do `CONTAI-048` (que já
  estava pronto para `/develop`) — nenhum dos dois bloqueia o outro.

Ticket completo: `docs/tickets/CONTAI-051.md`. Índice de execução atualizado
em `docs/tickets/README.md` (contagem de abertos sobe para 19, fila de
implementação passa a `048` → `051`).
