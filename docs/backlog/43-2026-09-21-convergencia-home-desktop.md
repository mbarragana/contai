# Convergência home desktop — 2026-09-21 — a régua fixa entra na home, a fila esvaziada do CONTAI-037 ganha o próximo item

## A dor, sem hipótese de solução

A casca do app (`app/layout.tsx`) trava em `max-w-[430px]` para toda tela,
inclusive as de **gestão** — conciliar, revisar, gerar dossiê — que o
`CLAUDE.md` já registra como **cenário principal** desde a correção de
2026-08-18:

> *"eu vou usar mais em casa do que no canteiro… quem gerencia a obra, não
> gerencia do canteiro"*

Na home isso significa: a régua de posição fiscal (custo confirmado, custo
em risco, aferição INSS) e a fila de pendências/despesas competem pelo mesmo
espaço vertical estreito, mesmo quando o Mateus está sentado num monitor que
sobra largura. Revisar a fila exige rolar para longe do número que ela está
corrigindo.

## O que convergiu

Rodada entre `designer`, `cto-obra` e `po` (sem entrada própria até agora —
esta é a materialização, seguindo a mesma lição da D46/D32: decisão que só
existe em transcript é a mesma falha que a regra proíbe, aplicada aqui a uma
decisão de produto/arquitetura, não a um parecer fiscal).

**Escolhido: Conceito 2 — "Régua fixa + fila de trabalho"**
- Coluna esquerda `sticky`: os quatro blocos de posição fiscal
  (`AfirmacaoObra`, custo confirmado, `CardCustoEmRisco`, `CardAfericaoInss`)
- Coluna direita: a fila de pendências/despesas, mantendo a ordem fiscal de
  hoje, agrupada em grid de 2 colunas a partir de `lg`
- Cards atuais **inteiros** — nenhuma `Consequencia` trunca
- Piso de 375px intocado — tudo atrás de prefixo `lg:`

**Cortes decididos pelo `cto-obra`, e por quê:**
- **Sem abas por tipo** — esconderia pendência atrás de clique, o oposto do
  que uma régua fixa busca (visibilidade permanente)
- **Sem scroll independente como requisito** — fica só como fallback de
  2 classes se a régua crescer mais que a viewport; não é algo a construir
  adiantado

## O que virou ticket

`CONTAI-039` — home ganha layout desktop, escopo travado à home
(`app/page.tsx`) + os dois arquivos compartilhados que ela precisa
(`app/layout.tsx`, `app/_components/ui.tsx`) + config de teste
(`playwright.config.ts`, projeto `desktop` novo). Telas de gestão fora da
home (detalhe de documento/pagamento) ficam para rodada futura, reusando o
mesmo padrão (`aside` + `Secao`) se este ticket for bem-sucedido.

**Não fechado nesta convergência, herdado como Pergunta Aberta do ticket**:
o valor exato de `lg:max-w`, o particionamento dos blocos em células do grid
da `Secao`, e o alinhamento de `BarraAdicionar` em telas largas — literal
demais para uma convergência de intenção, caem no `/design`.

## Por que P1, não P0 nem P2

Não é obrigação fiscal (nenhum imposto ou multa depende de layout) nem mera
conveniência (é a tela mais visitada, no cenário que o `CLAUDE.md` já elegeu
como principal). É fricção de processo pura — dá para revisar a posição
fiscal rolando a tela hoje, mas dói, e dói mais quanto mais a fila de
pendências cresce.

## Estado da fila

A fila de implementação estava vazia desde a entrega do `CONTAI-037`
(`41-2026-09-21-contai-037-entregue.md`). `CONTAI-039` entra como único item,
**bloqueado por `/design`** antes do Gate 1 — ver Dependências do ticket.
