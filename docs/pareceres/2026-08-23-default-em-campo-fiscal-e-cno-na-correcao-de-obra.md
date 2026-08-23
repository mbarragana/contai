# Parecer — default em campo fiscal, CNO na correção de obra, e o terceiro estado

**Data**: 2026-08-23
**Autor**: agente `contador`
**Origem**: duas perguntas levantadas na 7ª revisão da fila
(`docs/backlog/21-2026-08-23-setima-revisao-da-fila.md`), respondidas na mesma
rodada por serem primas. Transcrito do gate pelo orquestrador — **regra do
projeto: parecer que só existe no transcript é a mesma falha que a regra
proíbe, com outro nome.**

---

## 1. D44 — o default alcança a data **e** o meio; e o `meio` é o mais grave dos dois

**Veredito: os dois campos nascem vazios.** Vira `CONTAI-032`, na classe do
`CONTAI-030` (afirmação errada em produção, conserto de um dia). Sem número novo
a confirmar na legislação.

### A data afirma DOIS fatos, não um

`[Certain]` `data = hojeIso` não escolhe só o ano-calendário. `decidirRegistro`
(`lib/fiscal/compromisso.ts:118-126`) usa **a mesma data** para escolher a
**entidade**: `data <= hoje → pagamento`, senão `compromisso`.

Um campo intocado, portanto, afirma **dois** fatos: *"o dinheiro saiu"* e *"saiu
hoje"*. Isso é **mais** do que o `CONTAI-019` julgou no caso irmão — e a frase
dele, *"preencher afirma fato inexistente"*, serve inteira aqui.

### O `meio` é pior, e torna uma guarda inalcançável

`[Certain]` A recusa do cartão (`RECUSA_CARTAO`, critério 27 do `CONTAI-019`) é a
exceção **nomeada** que impede uma compra no cartão de virar custo na data da
compra. Com `pix` pré-selecionado, **essa guarda só existe para quem toca no
campo**.

Quem não toca produz um pagamento PIX com a data da compra — custo no ano errado
—, e a exceção do cartão vira **código inalcançável pela inação**. Guarda que
depende do usuário escolher o que já está escolhido **não é guarda**.

Não existe "meio provável" documentado: **quem afirma o meio é o comprovante,
não a estatística.**

### O que salvava o pré-preenchimento, e não salva mais

`[Certain]` Nada. O único argumento que restaria — *"o app sabe o fato"* — é
**falso nos dois campos**: só o extrato sabe. A régua que sustentava o
pré-preenchimento era *"captura no canteiro, com pressa"*, e ela **caiu em
2026-08-18**, quando o Mateus corrigiu a premissa (*"quem gerencia a obra, não
gerencia do canteiro"*).

⚠️ **Condição desta aprovação: o `CONTAI-032` NÃO entra sozinho.** Ver seção 3.

---

## 2. `CONTAI-008`, pergunta 1 — "não para a aferição, sim para o custo"; e o bloqueio total de hoje está errado no saldo

**Veredito: mover é permitido, com marca permanente. E é INDEPENDENTE da Q14 —
o `CONTAI-008` destrava sem o Mateus responder nada.**

### O que o código acerta

`[Certain]` Mover a NF de serviço **não a faz abater a aferição da obra de
destino**. O que amarra valor a obra é o **CNO impresso e declarado na
EFD-Reinf**, nunca o `obra_id` do app — parecer
`docs/pareceres/2026-08-09-obra-sem-cno.md`, §5.

### O que ele erra, e o saldo é negativo

`[Likely, confiança alta]` `podeCorrigirObra` (`lib/fiscal/obra.ts:296-303`)
transforma isso em **recusa total**. O saldo é ruim: ele protege uma aferição que
**o app ainda nem calcula** — não há apuração de base em `lib/fiscal/` — ao preço
de **travar o custo de aquisição no imóvel errado**, que é o único dos dois erros
que já produz passivo hoje, e em **duas** vendas futuras.

⚠️ A restrição veio do **critério 13 do `CONTAI-003`**, redigida pelo `po` como
*"restrição fiscal"*. **Nenhum parecer a carimbou.**

### A regra que emito

**Mover é permitido**, e a nota carrega **marca permanente**:
*"CNO impresso ≠ CNO desta obra"*.

- **Não abate a aferição de obra nenhuma** enquanto não houver reemissão ou
  retificação da R-2000 pela empreiteira.
- Entra na **lista de cobrança** do `CONTAI-007`.

**A trava real muda de camada**: vai para a apuração da aferição
(`CONTAI-004`) — *só abate a base da obra X a NF de serviço cujo CNO impresso
seja o de X*.

Essa trava é **mais forte** que a atual, porque também pega **a nota arquivada
errada sem nenhum move** — caso que a recusa de hoje não alcança.

O desfecho (ii) do critério 2 segue **intacto**.

### Por que é independente da Q14

`[Certain]` A **Q14** decide **de quem é a obrigação** do CNO (o titular: o
Mateus ou a construtora). A **pergunta 1** decide **a que CNO o valor se
vincula**. A segunda regra é **idêntica com o CNO em qualquer nome**.

A Q14 continua travando o ramo `total` do `CONTAI-016` e o texto do
`CONTAI-003` — **não isto**.

---

## 3. D25 — o terceiro estado é **PRÉ-REQUISITO** do `CONTAI-032`, não vizinho

`[Certain]` Tirar o default **sem** oferecer o terceiro estado troca **data
errada em silêncio** por **data inventada pelo dedo** — e a segunda é **pior**,
porque campo preenchido **afirma**.

### Respondendo o Gate Fiscal do `CONTAI-025`

`[Certain]` **Registrar pago-sem-data é melhor que não registrar.** A
IN SRF 84/2001, art. 17 exige documentação hábil **e** discriminação; documento
não registrado é **custo que não existe**, enquanto o pago-sem-data:

- preserva o comprovante,
- **não entra em ano nenhum**,
- e **não afirma nada falso**.

A data se recupera do extrato.

### A emenda para o formulário direto

`[Certain]` No `CONTAI-025` a data só decide **ano**. No formulário direto ela
decide **entidade** (seção 1). Portanto:

> **"Pago, não sei a data" cai SEMPRE em `pagamento` — nunca em `compromisso`.
> O dinheiro saiu.**

---

## Consequência para a fila

1. **`CONTAI-032`** (tirar os dois defaults) **depende do `CONTAI-025`** (o
   terceiro estado). Entrar sozinho piora a situação em vez de melhorar.
2. **`CONTAI-008`** está **destravado** — não espera a Q14.
3. **`CONTAI-004`** ganha a trava da aferição que sai do `podeCorrigirObra`.
4. **`CONTAI-007`** recebe a nota movida na lista de cobrança.

Reordenar é ato do `po`, e a ordem se aplica em `docs/tickets/README.md`.
