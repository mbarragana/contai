# Adendo à 7ª revisão — 2026-08-23 — o parecer chegou no mesmo dia e mudou quatro postos

**Isto é adendo, não 8ª revisão.** O teste que eu aplico: *revisão* reexamina
todos os itens da fila; *adendo* aplica um fato novo aos itens que o fato toca.
Reexaminei quatro (`025`, `032`, `022`, `008`) e mexi em dois de escopo (`004`,
`007`) — os outros ficaram onde a 7ª os pôs, com o mesmo fundamento. Chamar isto
de 8ª esvaziaria a palavra: o projeto teve seis "filas revistas" que eram
inventário, e a 7ª existe justamente para separar as duas coisas.

**A ordem está em `docs/tickets/README.md`, e só lá.** Esta entrada é o
**porquê**. Parecer que a origina:
`../pareceres/2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md`.

## O desconfortável primeiro: a 7ª revisão nasceu desatualizada em três pontos, no mesmo dia

Ela terminou com duas perguntas ao `contador` e as duas voltaram na mesma
rodada. Não é azar de timing — é o formato: **eu levantei as duas perguntas
dentro da revisão e apliquei a ordem sem esperá-las.** O resultado foi um mapa
que ficou correto por algumas horas, e um adendo em prosa colado no topo do
README para o fato não ficar sem registro. Esse adendo era andaime, e andaime
que fica vira segunda fonte de ordem — exatamente o defeito que a 7ª revisão
existiu para matar. **Ele foi absorvido pela fila e apagado hoje.**

Lição para a próxima: **pergunta que pode virar reordenação sai da revisão como
pergunta, e a revisão sai como fila condicionada** — ou se espera a resposta.

## Os quatro movimentos

### 1. `CONTAI-025` sobe de "Depois" para o 2º posto — e não é por mérito próprio

Ele continua sendo o que era: um P1 de fricção. O que mudou é que o `032`
**não pode entrar sem ele**, e o `032` é P0. Prioridade herdada por
pré-requisito é prioridade real — a alternativa é um P0 parado atrás de um P1,
que é como fila trava sem ninguém decidir travá-la.

Dois fatos a mais, e o segundo é constrangedor:

- **O Gate Fiscal dele fechou hoje**, e a favor: *pago-sem-data é melhor que não
  registrar* — preserva o comprovante, não entra em ano nenhum, não afirma nada
  falso. Mais a emenda: no formulário direto a data escolhe **entidade**, então
  *"pago, não sei a data"* cai **sempre em `pagamento`**.
- **O README dizia `🔴 sem arquivo` e o arquivo existe desde 19/08** (`b514f7d`).
  O mesmo valia para o `024` e o `026`. Status estagnado por quatro dias no
  arquivo que se declara dono do status é a mesma doença da 6ª revisão, em
  escala menor. Corrigidos os três.

**Trava que sobra**: eu fechar os 6 critérios da minuta e o `designer` dizer o
nível de proposta. Nenhuma das duas é o dedo do Mateus — e isso é o argumento
mais forte a favor do posto 2, porque **hoje o gargalo do projeto é a fila de
mocks**, e este é o único item da classe P0 que não está nela.

### 2. `CONTAI-032` nasce no 3º posto, e continua P0 — com fundamento mais largo

Ver a seção própria, abaixo.

### 3. `CONTAI-022` mantém o posto, mas o diagnóstico dele estava errado

A 7ª revisão o promoveu escrevendo *"a compra no cartão não é registrada em
lugar nenhum — é a meta 1 falhando pelo lado de fora"*. **O parecer mostrou que
essa frase é falsa hoje**: com `meio = "pix"` pré-selecionado, a compra no
cartão **é** registrada — como PIX, na data da compra. A `RECUSA_CARTAO` só
alcança quem toca no campo.

Isso não rebaixa o `022`; **muda o que ele conserta**. E cria uma ordem entre os
dois que antes não existia: o `032` converte a falha de **registro falso
silencioso** em **recusa explícita**, e só depois disso o `022` passa a ser o
ticket que a 7ª descreveu. Fazer o `022` primeiro deixaria o buraco do default
aberto do mesmo jeito — porque quem não toca no campo nunca chega à tela nova.

### 4. `CONTAI-008` destrava no fiscal e **não sobe**

Aqui eu resisti à tentação óbvia. A pergunta 1 estava aberta desde 10/08 e era
tratada como prima da Q14; o parecer separou as duas de vez (*a Q14 decide de
quem é a obrigação do CNO; a pergunta 1 decide a que CNO o valor se vincula*) e
emitiu a regra: **mover é permitido, com marca permanente**.

Destravar encurtou a **lista** de travas do `008` — mas não antecipou **a data
mais cedo em que ele pode entrar**, que continua sendo a do mock da tela
espelhada. Reordenar por lista de travas em vez de por data possível é
reordenação cosmética, e fila que se reembaralha todo dia deixa de ser
consultada. **Ele fica em 5.**

O que muda dentro dele é maior que a posição: **o critério 3 vira "permitir com
marca"**, e a trava real migra para o `004` — onde é **mais forte**, porque a
trava na apuração pega também a nota **arquivada errada sem nenhum move**, caso
que a recusa de hoje nem enxerga. Trocar uma recusa larga na porta por uma trava
estreita na apuração é o padrão certo, e vale registrar como padrão.

## O `032` continua P0? Sim — e por três razões, não uma

Quando eu o propus, o argumento era um: *a data do pagamento é a chave do regime
de caixa*. O parecer acrescentou dois, e o terceiro é o pior:

1. **Ano-calendário** — custo no ano errado, calado (meta 2).
2. **Entidade** — `decidirRegistro` usa a **mesma** data para escolher entre
   `pagamento` e `compromisso`. Campo intocado afirma *"o dinheiro saiu"*, e
   isso é fato inexistente, não imprecisão.
3. **Guarda desativada** — com `pix` pré-selecionado, a `RECUSA_CARTAO` vira
   **código inalcançável pela inação**. Uma exceção fiscal nomeada, testada e
   morta na prática. Guarda que só existe para quem escolhe o que já está
   escolhido não é guarda (meta 1).

Some-se a exposição: o formulário direto é **a tela mais usada do app**. O `008`
mora numa tela rara; o `022` depende de uma compra no cartão; o `032` é cobrado
em **todo** registro. **P0 confirmado, e mais grave do que quando foi proposto.**

**O que mudou foi o custo, não a gravidade.** Ele deixou de ser conserto de um
dia na classe do `030`: o `030` era texto, e texto se troca sozinho. O `032`
depende de oferecer uma saída ao usuário antes de tirar a que existe, e a saída
é o `025`. **O par é P0; o `032` sozinho seria um regresso.**

### A recomendação que eu deixo aberta, e ela não é minha para fechar

A dependência do `025` é da **data**. O **`meio`** não tem terceiro estado
possível: não existe *"não sei o meio"* — quem afirma o meio é o comprovante,
como o próprio parecer diz. A metade `meio` do `032` é conserto de uma linha e
ressuscita a `RECUSA_CARTAO` sozinha.

**Não parti o ticket por conta própria.** A condição de aprovação do parecer diz
*"o `CONTAI-032` NÃO entra sozinho"*, escrita para o ticket inteiro, e o
fundamento dela está na seção da data. Soltar a metade `meio` é uma linha do
`contador`, não minha — e é exatamente o erro do critério 13 do `003` que a
seção seguinte trata: **`po` não emite condição fiscal.**

## O achado de processo, e a redação era minha

O `contador` derrubou uma restrição que **eu** escrevi, no critério 13 do
`CONTAI-003`, assim:

> **Restrição fiscal**: corrigir a obra de **NF de serviço** obriga a revalidar
> `cno_referenciado` contra o CNO da obra de destino (CONTAI-007, critério 2)

Três defeitos, e o terceiro só apareceu 13 dias depois:

1. **Ela cita um ticket, não um parecer.** `CONTAI-007, critério 2` é requisito
   meu, não regra fiscal de ninguém. Nenhum parecer carimbou esta condição.
2. **O rótulo fez o trabalho.** A palavra *"Restrição fiscal"* em negrito deu à
   frase a autoridade que a origem dela não tinha. Ninguém a questionou —
   inclusive eu, que a escrevi, nas revisões seguintes.
3. **O código a endureceu.** Eu escrevi *revalidar*; `podeCorrigirObra` virou
   **recusa total**. Condição fiscal sem parecer não só entra como cresce no
   caminho, porque quem implementa, na dúvida, aperta — e apertar parece o lado
   seguro. Aqui não era: o saldo é proteger uma aferição que o app **nem
   calcula** ao preço de travar o custo de aquisição no imóvel errado, em **duas**
   vendas futuras.

**Não é caso isolado, e eu não tenho a chance de argumentar que é**: a **D32** já
nomeou a mesma forma em 18/08 — *"enum fiscal sem contrapartida em
`docs/pareceres/` é classe, não incidente"*. Este é o segundo caso da mesma
classe, e o primeiro a custar um P0 parado por 13 dias. Duas ocorrências com o
mesmo formato é padrão, não coincidência.

**Custo de instalar o remédio: baixo.** O `grep` abaixo, rodado hoje sobre
`docs/tickets/*.md`, acha **uma única linha ofensora** — a do `CONTAI-003:359`,
que este adendo revoga. Todos os outros casamentos são declarações de ausência
(*"não há regra fiscal neste ticket"*) ou ponteiros para parecer. Regra nova cuja
varredura retroativa cabe numa linha é regra barata.

### Redação proposta para `.claude/commands/tickets-req.md`

*Instalação é do Mateus. Duas inserções e uma linha no Passo 5.*

**No Passo 1 (PO), item 5 novo:**

> 5. **O `po` não emite condição fiscal.** Critério de aceite que contenha
>    obrigação, proibição ou revalidação de natureza tributária **cita o parecer
>    pelo caminho** (`docs/pareceres/AAAA-MM-DD-assunto.md`) na mesma frase.
>    **Citar outro ticket não serve** — ticket é requisito, não fonte fiscal.
>    Sem parecer, a condição **sai do critério** e vira **pergunta do Passo 2**.
>    Ticket não espera por isso: ele nasce **sem** a condição, e a pergunta
>    aberta é o que a traz de volta.

**No Passo 2 (Contador), item 6 novo:**

> 6. **Condição fiscal se escreve com o verbo exato** — *revalidar*, *avisar*,
>    *marcar* e *recusar* são quatro coisas diferentes, e quem implementa, na
>    dúvida, escolhe a mais dura. Diga qual das quatro, e diga o que acontece
>    com o registro quando a condição falha. **Recusa só se o parecer recusar
>    por escrito.**

**No Passo 5 (checagem final), uma linha:**

> - **Varredura de condição fiscal órfã**, e ela é um *finder*, não um
>   verificador — o casamento é por linha e critério de aceite ocupa várias, então
>   cada achado se lê à mão:
>
>   ```sh
>   grep -rniE 'restri[çc][ãa]o fiscal|regra fiscal|exig[êe]ncia fiscal|fiscalmente (obriga|exige|pro[íi]be)' docs/tickets/*.md
>   ```
>
>   Achou linha sem `docs/pareceres/` no mesmo critério? Ou entra o caminho do
>   parecer, ou a condição vira pergunta do Gate Fiscal.

**Por que não fiz disto um `grep` bloqueante como o dos quatro hashes**: aquele
casa **linha de tabela inteira** e por isso é decidível; este casaria fragmentos
de critérios multi-linha e falharia por construção. O projeto já aprendeu, no
ajuste de 18/08 do próprio verificador de ✅, que **verificador que falha sempre
é verificador que ninguém roda** — não vou instalar um segundo.

## O que este adendo NÃO fez

- **Não reexaminou** `009`, `005`, `031`, `014`, `006` nem a seção "Depois": o
  parecer não os toca, e mexer neles seria a 8ª revisão disfarçada.
- **Não partiu o `032`** — ver acima; a linha é do `contador`.
- **Não escreveu o `CONTAI-032`** nem fechou os critérios do `025`. Os dois
  passam pelo `/tickets-req`, e o `025` volta com o `designer` dizendo o nível.
- **Não instalou nada em `.claude/commands/`** — a redação está aqui, a
  instalação é do Mateus.

## Decisões que continuam esperando o Mateus (nenhuma mudou hoje)

| O que | Efeito na fila |
|---|---|
| **As migrations `0009` e `0010` já estão no remoto?** | item **0** do bloco de deploy; uma linha fecha |
| **Q14** — empreitada total? | continua travando o ramo `total` do `016` e o texto do `003`. **Não trava mais o `008`** |
| **`CONTAI-015` (captcha)** — corte re-recomendado | fora da fila de qualquer forma |

**E uma que é do `contador`, não do Mateus**: soltar a metade `meio` do `032`
para entrar sem o `025`.
