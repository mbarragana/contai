# Migração das telas de detalhe para o shell de gestão — 2026-09-21 — quatro tickets, `po` fecha o pedido do Mateus

## Pedido
O Mateus pediu para levar ao shell de gestão desktop (`CONTAI-040`, já
entregue) as telas de DETALHE que ficaram de fora dele — hoje moram em
`app/(captura)/` mas não são captura de verdade, são gestão (revisar,
corrigir, conciliar). O comentário do próprio `app/(captura)/layout.tsx` já
nomeia isso como dívida desde a entrega do `040`: *"as telas de detalhe
entram no shell numa rodada futura (Fora de Escopo do CONTAI-040)"*.

## Achado que fundamenta a prioridade — não é preferência de estilo
Três seams **já em produção**, achados por grep antes de escrever qualquer
ticket (não presumidos):

- `app/_components/fila-pendencias.tsx` (dashboard + `/pendencias`, já no
  shell desde o `040`/`042`) linka `/documento/${id}` e `/pendencias/${id}`.
- `app/_components/agendado.tsx` (painel "Agenda" do dashboard) linka
  `/compromisso`, `/compromisso/${id}` e as três ações dele.
- `app/_components/shell.tsx` — **o próprio shell** — linka `/obras/${id}` e
  `/obras/${id}/terreno` direto da sidebar permanente.
- O stub de `/despesas` (`CONTAI-041`, ainda não completo — confirmado lendo
  o arquivo: só lista `resumo.despesas`, tabela real não chegou) já aponta
  para `/pagamento/${id}` e `/fatura/${id}`.

Ou seja: as duas telas mais visitadas do shell novo (dashboard e
`/pendencias`) e a própria sidebar já derrubam o usuário na casca antiga de
430px a cada clique. Não é dívida abstrata — é a experiência de hoje.

## Decisão: quatro tickets, não um
Fatiado por família, como o próprio pedido cogitou:

| Ticket | Família | Rotas |
|---|---|---|
| `CONTAI-043` | Documento | `/documento/[id]` + `anexar`, `cnpj-errado`, `corrigir/classificacao`, `corrigir/emitente`, `corrigir/valor`, `desligar`, `ligar`, `obra`, `outro-dado` |
| `CONTAI-044` | Pagamento + Fatura | `/pagamento/[id]` + `ligar`, `obra`; `/fatura/[id]` + `alocar`, `confirmar`, `parcial` |
| `CONTAI-045` | Compromisso + Pendências | `/compromisso` (lista) + `/compromisso/[id]` + `cancelar`, `confirmar`, `data`; `/pendencias/[id]` |
| `CONTAI-046` | Obras + Terreno | `/obras/[id]` + `terreno` (+ `desembolsos`, `financiamento`, `informe/[anoBase]`), `discriminacao/[ano]`, `notas-sem-cno` |

**Por que fatiado, não um ticket só**: ~30 páginas ao todo, com pesos fiscais
diferentes por família (`discriminacao/[ano]` carrega o texto de Bens e
Direitos direto; `documento`/`pagamento` são conciliação do dia a dia;
`compromisso`/`obras` são mais espaçados no tempo). Um ticket só faria o
Gate 2 do `contador` revisar tudo de uma vez, sem poder aprovar a fatia mais
simples enquanto a mais arriscada (`discriminacao`) ainda está em rodada de
correção — mesmo raciocínio que já separou `042`/`040`/`041`.

**Ordem sugerida**: `043` → `044` → `045` → `046`. Critério: frequência de
uso (documento e pagamento são a conciliação diária, o coração da Meta 1) e
risco fiscal crescente por último (`046` carrega a tela de discriminação
anual, a de maior densidade de texto fiscal do produto). Nenhum dos quatro
bloqueia formalmente o outro — podem ser sequenciados fora dessa ordem se um
Gate 0 ficar pronto antes de outro.

## Achado técnico citado, nunca formalizado até hoje
O `cto-obra`, na avaliação que originou o `CONTAI-040` (a mesma que decidiu
route groups em vez de breakpoint), sugeriu que telas de detalhe dentro do
shell usem uma coluna de **~560px, não full-width** — o Gate 2 do
`CONTAI-039` já tinha medido que esticar formulário/detalhe para a largura
cheia da casca (1244px) é **menos** legível, não mais. Essa sugestão nunca
virou ticket. Os quatro tickets desta entrada são o primeiro lugar em que
ela vira critério de aceite, com a decisão final delegada ao Gate 0 de
`/design` de cada um.

## Ambíguos resolvidos
- **`/entrar`**: fora, permanentemente. Não é dívida a pagar depois — é
  pré-autenticação, não existe obra ativa nem sidebar para uma tela de login
  habitar.
- **`/conta`**: fora desta rodada. Diferente das quatro famílias acima, não
  há seam em produção apontando para lá — nenhum link do shell novo leva a
  `/conta`. Fica candidata a ticket próprio, pequeno, sem prioridade
  definida, se a fricção aparecer num relato futuro.
- **`/obras/nova`**: fora, e citado explicitamente no `CONTAI-046` (Fora de
  Escopo) para não ser arrastado por engano só por compartilhar o prefixo
  `/obras/`. É captura pontual (assistente de cadastro, uma vez por obra),
  não gestão recorrente.

## Pendência real, não fingida
**Nenhum dos quatro tickets tem Gate 0 fechado.** A rodada paralela do
`designer` está desenhando o padrão "detalhe dentro do shell" e o spec não
existia em `design/mocks/` no momento em que esta entrada foi escrita. Os
quatro tickets referenciam `design/mocks/detalhe-no-shell.md` como nome
assumido, marcado como pergunta aberta até o `designer` publicar (nome real
pode divergir). **Nenhum entra em `/develop` antes disso.**

## O que NÃO virou ticket
- Mudança de qualquer regra fiscal, cálculo ou texto — os quatro tickets são
  migração de casca, não feature. Regra que muda passa pelo `contador` como
  ticket à parte, nunca dentro de um "chore" de layout.
- Gestão de cronograma de obra, orçamento vs. realizado, comunicação com
  empreiteiro — fora de escopo declarado do produto, não tocado por nenhuma
  das quatro famílias.

## Próximo passo
Este arquivo não altera `docs/tickets/README.md` além de uma nota curta —
sequenciamento formal na fila ativa é trabalho do `/tickets-req`/`/develop`
quando o Gate 0 de cada ticket fechar.
