## Adjudicação fiscal do `CONTAI-027` — 2026-08-21 — o critério 13 cai, e três coisas mudam de dono

**Fonte normativa**:
`docs/pareceres/2026-08-21-gate-fiscal-contai-027-criterio-13.md`.
**Executada em** `docs/tickets/CONTAI-027.md` e `docs/tickets/CONTAI-011.md`
nesta mesma data.

### O que aconteceu, e por que fica registrado

Uma decisão fiscal — o corte do **critério 13** do `CONTAI-027` — foi tomada
**dentro do Gate 0 (`/design`)**, sobreviveu num **mock aprovado pelo Mateus** e
**não existiu em arquivo nenhum por um dia inteiro**. Ficaram dois artefatos
oficiais em contradição, com o Mateus tendo aprovado o lado não escrito. O
`lead-engineer` **recusou implementar ticket e relato — corretamente**.

**Regra que o `contador` fixou para si e que vale para todo o time**: *"eu não
altero Gate Fiscal dentro de outro gate. Se, no meio de um `/design`, eu perceber
que um critério meu está errado, o produto daquele momento é **um adendo em
`docs/pareceres/`, escrito no ato**. Alteração fiscal falada é alteração que não
aconteceu."*

**Consequência para o `po` (eu)**: acatar corte de critério fiscal **não é
registro**. Enquanto não está no ticket, o ticket é a especificação — e é contra
ele que o Gate 4 valida.

### O argumento que está PROIBIDO de voltar

*"A discriminação não é transmitida pelo app, logo o bloqueio não protege
declaração nenhuma."* **Rejeitado pelo `contador`** (§2 do parecer): *"prova
demais, e por isso não prova nada"* — derrubaria junto o **bloqueio do relatório
anual por compromisso vencido** (parecer de 2026-08-18, §A), que está de pé e
correto. **Toda** saída deste app é copiável. Se este argumento aparecer em
ticket, mock ou tela, **é para ser recusado**.

### Regra geral nova, que vale para toda pendência futura

> **Uma pendência só pode bloquear uma saída anual se existir, no app, um fato
> que a feche — inclusive o fato "declaro que não sei".** Pendência sem fato de
> baixa é informação, nunca trava. Trava sem baixa não coleta o fato que falta:
> coleta a resposta que destrava.

Segundo teste, do mesmo parecer: **um dente que fere só quem disse a verdade não
é dente, é ensinamento** — ele ensina qual resposta não dá trabalho, e a resposta
que não dá trabalho é a que apaga o problema do app, do dossiê e de 2034.

### D39 — a regra de cor mudou, e a decisão é do `po`

| | Dor / decisão | Origem | Prioridade |
|---|---|---|---|
| **D39** | **A regra de cor de pendência estava escrita em termos de acervo, e a régua certa é a consequência fiscal.** A regra antiga era *"vermelho = dinheiro que saiu e não está no custo; âmbar = nada saiu ainda"*. Ela **não cobre** a pendência *"Um lançamento, mais de uma data"*: ali o dinheiro saiu **e** está no custo — o que está aberto é **o ano em que ele cai**. A regra passa a ser **"vermelho = fato consumado com consequência fiscal aberta; âmbar = nada saiu ainda"** | Gate 0 do `CONTAI-027` + §10 do parecer de 2026-08-21 | **decidida** — vale a partir de agora, sem ticket próprio |

**Quem decide isto sou eu, e está registrado que é meu**: §10 do parecer —
*"o que continua exigindo o `po` é a apresentação da pendência (cor, superfície,
ordem) — a mudança da regra de cor para 'vermelho = fato consumado com
consequência fiscal aberta' é dele, e eu não a disputo: minha objeção original
(o acervo está completo, logo âmbar) olhava o acervo; a régua certa aqui é a
consequência fiscal, que está aberta."*

**Consequência prática**: a pendência *"Um lançamento, mais de uma data"* é
**vermelha**, como está no mock aprovado. Nenhuma pendência existente muda de cor
por causa disto — a regra nova é **superconjunto** da antiga: tudo que era
vermelho pela régua do acervo continua vermelho pela régua da consequência.
**Toda pendência nova declara qual das duas metades da regra a colore.**

### Ticket novo a criar — correção de valor de desembolso do terreno

**Não tem ID ainda; precisa passar pelo `/tickets-req`.** É a contrapartida
temporal do corte: o critério 13 **migra inteiro para lá, na forma em que está
escrito hoje**, e lá ele volta a valer, porque **a pendência terá baixa**.

O que o ticket tem de carregar (§5 do parecer):

1. **Corrigir o valor** de um desembolso do terreno já gravado —
   `completarDesembolsoTerreno` hoje completa a **data** e diz por extenso que
   **o valor não é tocado**. Não há tela, não há caminho, não há "não sei".
2. **Rastro append-only** da alteração: *"o acervo é append-only — correção é
   revisão registrada, nunca sobrescrita silenciosa"*. O molde existe: é a
   revisão do `CONTAI-021`.
3. ⚠️ **Se o lançamento for de ano-calendário JÁ DECLARADO**, a correção **não é
   só de app — é retificadora, e exige CRC**. A tela **pergunta o ano** e diz
   isso. *"Corrigir número de ano declarado dentro do app, calado, é o app
   fabricando divergência entre o que ele mostra e o que foi entregue à RFB."*
4. **O critério 13 do `CONTAI-027`**, inteiro, como critério de aceite: a
   pendência *"Um lançamento, mais de uma data"* bloqueia a discriminação do ano.
5. **A meta 2 vai junto.** O `CONTAI-027` entrega metas **1 e 3**; a meta 2 é
   deste ticket novo.

**Relação com a D38** (desdobrar um lançamento em N, já no backlog, P2, sem
ticket): são **irmãs e a ordem importa**. Desdobrar sem corrigir o original
**soma o valor duas vezes** — custo inflado em Bens e Direitos é **redução
indevida de ganho de capital, cobrada com multa**. É por isso que a pendência do
`CONTAI-027` nomeia **as duas metades da ação**, e não só a primeira.

### O que ficou mais fraco, dito por extenso

O **pre-mortem nº 2 do `CONTAI-027`** (*"a pergunta virou clique automático no
sim"*) ficou **sem mitigação mecânica**, e o parecer não disfarça: *"isso é mais
fraco, e eu não vou fingir que não é."* O que resta é pergunta sem default,
consequência que **não lidera pela punição**, pendência **indispensável em três
superfícies** (home, card do desembolso, lista de revisão pré-declaração), aviso
**fora da área copiável** e **regravação da pergunta quando o fato muda**.
Quem medir o `CONTAI-027` no Gate 4 mede **isso**, não o bloqueio.
