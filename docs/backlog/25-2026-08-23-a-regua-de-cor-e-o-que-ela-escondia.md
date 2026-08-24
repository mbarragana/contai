## A régua de cor — 2026-08-23 — seis pendências com o dinheiro fora do bolso pintadas de âmbar

Origem: o Mateus, olhando o mock do `CONTAI-025`, respondeu à pergunta da cor com
*"o que ficar consistente com todo resto do app"* — e mandou **arrumar agora**.

**"Consistente" não era resposta simples: o app está inconsistente consigo
mesmo.** A régua existe desde 21/08 (**D39**) e o código nunca foi reconciliado.

### A D39 revisada — binária, com o eixo que faltava

A original dizia: *vermelho = fato consumado com consequência fiscal aberta;
âmbar = nada saiu ainda*. Ela **atropelava** uma gradação já ratificada pelo
`contador` (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md:601-602`):
PJ pago sem comprovante é **amarelo** (a NF hábil já sustenta o custo, falta
corroborar), PF é **vermelho** (o comprovante é constitutivo).

**Redação nova, do `po`, e continua binária:**

> **saiu? → tem apoio hábil no ano certo? → não = vermelho**
>
> vermelho = fato consumado + consequência fiscal aberta **e nada no acervo
> sustenta o valor no lugar certo**; âmbar = nada saiu ainda, **ou** o valor já
> está sustentado e falta só corroboração.

### O inventário — 13 call sites em 5 arquivos

| | Pendência | Veredito |
|---|---|---|
| **A** | **Falta a data** | **→ vermelho.** Entra no `CONTAI-025` |
| **B** | falta lançar {ano} | **→ vermelho** |
| **C** | correção mexeu em ano anterior | **→ vermelho** |
| **D** | CNPJ errado — tratar | **vermelho quando houver pagamento ligado** — ⚠️ **gate fiscal** |
| **E** | contrato do financiamento não cadastrado | **→ vermelho** se a natureza for `financiado` |
| **F** | sem retenção 11% | ⚠️ **duvidoso — pergunta ao `contador`** |

⚠️ **O item B tem um detalhe que vale ler.** O comentário em `app/page.tsx:514`
**confessa**: *"o extrato existe, o dinheiro saiu, e o custo daquele ano não
existe no sistema"* — e **a linha seguinte é `border-amb`**. Alguém escreveu o
argumento contra a própria cor e não percebeu.

**A inversão de ordem, que é o achado mais claro**: *"mais de uma data"* — valor
**no** custo, só o ano em aberto — é **vermelha**; *"falta a data"* — valor em
**ano nenhum** — é **âmbar**. O app pinta **o caso pior de âmbar e o brando de
vermelho**.

**Âmbar legítimo, confirmado** (o dinheiro não saiu): "sem pagamento ligado",
"boleto aguardando pagamento", "aguardando informe", "previsto — ainda não pago",
chip de agendado, "falta dizer como o terreno foi adquirido".

**Exceção fundamentada, uma só**: **"pago sem comprovante" PJ** fica âmbar por
decisão escrita do `contador` (§601). Agora **nomeada como exceção**, não como
descuido.

### A divergência com o `designer`, e como ela fechou

Ele propôs um **terceiro nível** — *vermelho = depende de terceiro / prazo
correndo · âmbar = você fecha sozinho* — com o argumento de que, na home, *"todo
card de pendência já é vermelho, então o chip é o único eixo de leitura que
sobrou"*.

**O `po` foi ao arquivo**: `design/mocks/CONTAI-021.html:139` —
`.divida{border:1px solid var(--amb)…}`. **O container é ÂMBAR.** Não há vermelho
ao redor para o chip apagar.

E derrubou o eixo dele por mérito: *"depende de terceiro / fecha sozinho"* é
**roteamento de ação, não consequência fiscal** — é a coluna "próximo passo", que
já existe como botão. E o *"fecha sozinho em 30 segundos"* é **refutado pelo
relato 005**: o Mateus parou de usar o app **exatamente nesses campos**.
*"Ausência que dura meses não é tarefa de 30 segundos."*

O `designer` **concedeu, e achou a origem do próprio erro**: *"li `.divida` do
025 — que é vermelho, eu mesmo escrevi — e atribuí ao 021, que é âmbar."*

⚠️ **E o `po` deixou a porta aberta**: *"discordância resolvida por evidência de
arquivo, não por hierarquia — se ele achar o `.divida` vermelho em algum mock que
eu não vi, **reabro**."*

### O que ficou para o `designer`, e é dele

O eixo que a lista **realmente** perde não é a cor: é a **ordem de topo, que é
cronológica em vez de fiscal**. O `po` apoiou, e não custa cor nenhuma. Proposta
dele, registrada como aberta: ordenar por **valor fora da soma**, desempate pelo
eixo que tranca mais adiante.

### D54 — a régua não tem gate

A D39 diz que *"toda pendência nova declara qual das duas metades a colore"* —
**norma sem verificador**, que é a D44 outra vez. Proposta do `po` para o
`CONTAI-035`: **teste unitário que trava a régua** — nenhuma pendência com
dinheiro saído e sem apoio hábil pode ser âmbar **sem estar numa lista de exceções
nomeadas**. *"Assim a próxima divergência fica vermelha na suíte, não em 2034."*
