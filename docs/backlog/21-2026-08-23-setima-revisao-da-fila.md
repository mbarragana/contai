# 7ª revisão da fila — 2026-08-23 — a primeira que não mora aqui

**A ordem está em `docs/tickets/README.md`, e só lá.** Esta entrada é o
**porquê** — o que mudou de posição, o que foi cortado, o que continua parado
esperando o Mateus. Se as duas divergirem um dia, quem manda é o README: foi
exatamente a duplicação que apodreceu a 6ª.

*Revisão do `po`. Substitui a 6ª (18/08), que está marcada SUPERADA em
`08-2026-08-17-incidente-producao-e-fila-vigente.md` e cujo raciocínio continua
valendo como registro.*

## O que mudou em relação à 6ª revisão, e por quê

A 6ª ordenava **`018` → `019` → `014`/`004`+`007`/`009`/`005`**, e ficou cinco
dias afirmando que o `018` era o 1º item **com ele já em produção**. Não é
descuido de quem escreveu: é o defeito de guardar ordem em retrato datado.

**Sete movimentos, cada um com o seu motivo:**

1. **`CONTAI-027` entra em 1º, e ele não estava na fila da 6ª.** Não é
   preferência de escopo — é que o Gate 1 das **duas** rodadas está commitado
   **e pushado** desde 21/08 (`1ff74c9`…`53acc37`, com a migration `0010`), e os
   **Gates 2, 3 e 4 nunca rodaram**. A regra do projeto é que quem implementa
   nunca revisa o próprio código; hoje há código do `lead-engineer` na frente do
   Mateus que **nenhum revisor viu**. Abrir ticket novo em cima disso é empilhar
   sobre uma base não revisada.
   ⚠️ **E o README mentia sobre ele**: dizia *"Trava: mock (Gate 0) não existe —
   rodar `/design`"*. O mock foi **aprovado em 21/08** (`2824ae5`), está com o
   corte do critério 13 dentro, e o critério 1 do ticket está marcado `[x]`.
   Nada travava o `027`; ele parou por não estar em fila nenhuma.

2. **`CONTAI-022` sobe de "Depois" para 2º.** É o **item mais velho em aberto do
   projeto** — reservado em 18/08, cinco dias sem arquivo — e o que o segurava
   **caiu**: ele dependia da entidade `compromisso`, entregue pelo `CONTAI-019`.
   Enquanto ele não existe, `meio = cartao` segue recusado na entrada e a compra
   no cartão **não é registrada em lugar nenhum**: é a meta 1 falhando pelo lado
   de fora, que é a mesma falha que o `019` existiu para consertar do lado de
   dentro.

3. **`CONTAI-008` desce de 2º para 3º, e não é rebaixamento.** Continua P0 e
   continua bug alcançável em produção. Desceu porque o `022` é P0 **sem
   nenhuma trava** e o `008` tem duas (mock da tela espelhada + a pergunta 1 do
   Gate Fiscal, aberta desde 10/08). Ordenar por gravidade sem olhar trava
   produz fila que ninguém consegue executar.

4. **`CONTAI-014` cai de 1º da 6ª para 8º.** Ele é o **único 🟢 da fila
   inteira**, e essa é justamente a tentação: seria o item fácil de puxar. Não
   serve a nenhuma das três metas. Deixá-lo no topo por estar destravado é
   escolher trabalho pela facilidade, não pela consequência.

5. **`019`, `021`, `010`, `029`, `030` saem da fila para "Em produção".**
   Inventário, não decisão — mas a linha do `019` foi reescrita: ele fica com os
   quatro hashes e a ressalva do mock v2 defasado em 4 pontos.

6. **As fatias 2-7 do `CONTAI-028` passam de "fim da fila" para CORTE
   PROPOSTO.** O Gate 4 da fatia 1 já as tinha mandado para trás do bloco
   fiscal; a 7ª vai um passo além, e o filtro de escopo é explícito: elas
   entregam **custo de leitura de agente**, que não serve a nenhuma das três
   metas. A fatia 1 tinha consumidor a jusante (`029`) e por isso foi feita; as
   outras seis não têm. **Sobrevive uma exceção nomeada**: a extração de
   `textoDoRastro` (fatia 5), que é a cura da **D43** e tem consequência fiscal.

7. **`CONTAI-026` e `CONTAI-015` viram corte proposto** — ver "O que eu cortei".

## O que a 6ª não podia saber, e mudou o desenho da fila

### ⛔ O achado que vale mais que a reordenação: a ordem do release foi invertida

`origin/main` está **0 commits atrás de `main`** — tudo pushado, e na Vercel push
é deploy. Mas o README afirmava, na linha do `021`, que a migration **`0009` NÃO
está no ar** (*"`db push` antes do `git push`, quando o Mateus autorizar"*), e a
**`0010`** do `027` nunca foi registrada como aplicada.

Se as duas não estiverem no remoto, **a correção de documento e o anexo do
terreno estão quebrados em produção desde 21/08** — e quebrados exatamente do
jeito que o `CLAUDE.md` descreve: não aparece no build, não aparece no teste,
aparece no dedo do Mateus. Virou o **item 0** do bloco de deploy e o primeiro
bloco do README. **Não é ticket, e não custa uma rodada de agente**: custa uma
linha de resposta do Mateus.

### 🕯️ D44 — o formulário de pagamento nasce com a data preenchida, em produção

Achado desta revisão, lendo o código e não o mock. `app/adicionar/pagamento/page.tsx`:

- `:163` — `const [data, setData] = useState(hojeIso)`
- `:169` — `const [meio, setMeio] = useState<MeioPagamento>("pix")`

O spec do mock do `CONTAI-019` diz, do mesmo campo: *"`fData` … **SEM DEFAULT —
campo fiscal**"*. E a **decisão nº 1 de fechamento do `019`** já julgou o caso
irmão — a data prevista na confirmação de compromisso — com a frase que serve
inteira aqui: *"preencher afirma fato inexistente, e a proibição de default em
campo fiscal existe exatamente para isso"*.

**A data do pagamento é a chave do regime de caixa.** Um PIX de 30/12 registrado
em 03/01 sem tocar no campo cai no **ano errado**, calado — e nada na tela
acusa. O `meio` é o irmão menor do mesmo problema: PIX pré-selecionado é o
caminho por onde uma compra no cartão vira PIX sem ninguém decidir (a **D26**
pelo avesso).

**O que salvava o pré-preenchimento era *"captura no canteiro, com pressa"* — a
régua que caiu em 18/08.** Isto não é coincidência: é a dívida da premissa
cobrando juros num lugar onde ninguém tinha ido procurar.

⚠️ **Não escalei sozinho, de propósito.** Regra fiscal não é do `po`. A pergunta
ao `contador` é de uma linha: *a proibição de default em campo fiscal alcança a
data e o meio do formulário de registro direto, ou o caso de captura a
excepciona?* Se alcançar, é `CONTAI-032`, da classe do `CONTAI-030` (defeito em
produção, conserto de um dia) e entra na **ordem 2**.

⚠️ **Isto corrige o enquadramento da D41.** Ela foi registrada como *"4 textos
desatualizados em mocks **aprovados**"*, e a leitura natural é *dor de
documentação*. Dos quatro, **três são mesmo só de mock** — varri `app/` e `lib/`
e não achei em produção nem *"link no e-mail"*, nem a data fixa do `inpDataS2`,
nem o texto de regime de caixa sem carimbo naquela redação. **O quarto não é de
mock: está no ar.** A lição do `CONTAI-030` se repetiu com outra roupa — mock
aprovado envelhece em silêncio, e quem só lê o mock acha que a dor é do mock.

### O verificador do ✅ estava vermelho, e por dois motivos diferentes

O `grep` de verificação do próprio README (`^|.*✅` sem os quatro hashes)
acusava **duas linhas** hoje: `029` (um hash só) e `030` (nenhum). Os dois foram
**rebaixados a ⚠️** — é a regra do `cto-obra` aplicada a quem a escreveu depois,
e ela vale para trás por construção.

E um defeito do verificador, encontrado ao consertar: ele casa com o **glifo em
qualquer lugar da linha**, então escrever *"fica ⚠️, não ✅"* na coluna de
ressalva **deixa a suíte vermelha por prosa**. As linhas novas dizem *"não
verde"*. Fica registrado porque a próxima pessoa vai tropeçar igual.

## O que eu cortei, e por quê

1. **`CONTAI-026` (terreno recebido por herança, doação, permuta) — CORTE.**
   O sistema existe para **esta** obra. O terreno **já foi adquirido e é
   financiado**; nenhuma das três naturezas pode ocorrer nela. Manter o item é
   escrever produto para construtora, que é escopo declarado fora. O buraco real
   que ele nomeia — *quem escolher essa natureza fica com custo zero* — se fecha
   **não oferecendo a natureza**, e isso é uma linha, não um ticket.
   **Condição de volta**: uma segunda obra cujo terreno venha por uma das três.
2. **`CONTAI-028`, fatias 2-7 — CORTE, com a exceção do `textoDoRastro`.**
   Motivo no movimento 6 acima.
3. **`CONTAI-015` (captcha) — CORTE RE-RECOMENDADO, e o argumento é novo.**
   O `po` já recomendara cortar por fricção com uma mão; **esse argumento
   morreu** com a régua de 18/08, e eu não vou reusá-lo. O que o substitui é
   mais forte: o captcha existia para proteger o **limite de 2 e-mails/hora** do
   código por e-mail, e o login **virou e-mail+senha em 18/08**. Não há mais
   envio a proteger, e ele não serve a nenhuma das três metas. **Decisão do
   Mateus**, que já o manteve uma vez — por isso é recomendação, não corte
   consumado.

## A dívida da premissa de 18/08 — PAGA aqui, caso a caso

A 6ª escreveu que a correção *"quem gerencia a obra, não gerencia do canteiro"*
**torce para trás** decisões de 17-18/08 que usaram *"uma mão, com pressa"* como
veto, e mandou **reavaliar caso a caso, não em bloco**. Nunca foi feito.

**Não vira item próprio.** Uma dívida de reavaliação sem prazo é uma dívida que
ninguém paga — cinco dias de prova disso. As três decisões nomeadas pelo
`cto-obra` custam um julgamento de uma linha cada, e o custo de mantê-las
abertas é maior que o de fechá-las:

1. **Corte do Google Calendar — MANTIDO, com o fundamento trocado.** O veto
   original (*"não abre agenda no canteiro"*) morreu. O corte se sustenta por
   outro motivo, que independe de onde ele usa o app: *"não pagar juros"* é
   **gestão de caixa** e não serve a nenhuma das três metas. O que serve —
   *data prevista passou sem confirmação* — o `019` já entrega in-app, custo
   zero, sem OAuth. **O argumento do canteiro não pode ser reusado.**
2. **`CONTAI-015` — corte re-recomendado**, acima.
3. **`CONTAI-007` — a contradição interna está RESOLVIDA: ele PRECISA de mock.**
   O *"não precisa, a tela é mínima para o polegar"* era argumento de **captura**
   aplicado a uma tela de **gestão**. A revisão de Passo 1 do `007` começa por
   este ponto.

**E a dívida cobrou uma quarta**, que ninguém tinha listado: a **D44**. O
`data = hoje` do formulário direto é decisão da régua velha, viva em produção.
Isso é o argumento de fechar a dívida agora em vez de reavaliá-la "quando o item
for reaberto": o item que mais custa **nunca é reaberto** — ele está no ar.

## O que continua parado esperando o Mateus, e nada disso é software

1. **As migrations `0009` e `0010` estão no remoto?** Item 0 do bloco de deploy.
   Uma linha de resposta.
2. **Q14** — *a obra sem CNO é empreitada TOTAL?* Aberta desde 10/08, **13
   dias**. É a pergunta mais cara do projeto: decide **de quem é a obrigação do
   CNO**, trava o ramo `total` do `016`, morde o texto que o `003` já põe em
   produção e é prima da pergunta 1 do Gate Fiscal do `008`. A janela de força
   é **antes de liberar a próxima parcela**.
3. **A fila de mocks.** Sete dos nove itens da fila não entram no `/develop`
   hoje; **cinco travam em mock**, e mock é aprovação dele. O gargalo do projeto
   não é capacidade de implementar. Está escrito no README para não ser
   redescoberto daqui a cinco dias.
4. **O parecer de empreitada total × parcial** (10/08) **só existe em
   transcript** — dívida de escrituração nº 1, aberta há 13 dias, e é do time,
   não dele.
5. **`CONTAI-015`** — corte re-recomendado, decisão dele.

## O que esta revisão deliberadamente NÃO fez

- **Não criou ticket para a D41.** Três dos quatro achados são de mock e o
  quarto virou a D44, que espera o `contador`. Ticket para desatualização de
  mock aprovado, sem consequência em tela, é trabalho que não serve a nenhuma
  das três metas — o mecanismo que os pega (o spec) já existe e é barato.
- **Não reabriu a `US-002`, o Google Calendar nem a D-018.1/2** — as três estão
  registradas e nenhuma mudou de estado; repetir aqui seria a duplicação que
  matou a 6ª.
- **Não escreveu o `CONTAI-022` nem o `CONTAI-031`.** Escrever ticket é
  `/tickets-req`, e esta revisão ordena; ela não implementa a própria ordem.
