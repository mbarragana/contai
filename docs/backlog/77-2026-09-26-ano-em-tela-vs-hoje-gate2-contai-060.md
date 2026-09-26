# "Ano em tela" ≠ "hoje": o que o Gate 2 do `CONTAI-060` corrigiu, e a D78 — 2026-09-26

## Como isto apareceu

O `CONTAI-060` (seletor de ano no shell) deu ao app, pela primeira vez, a
capacidade de **ler um ano-calendário que não é o de hoje**. Até ele, `ano` e
`anoCorrente` eram sempre o mesmo número (`hojeIso()`, calculado uma vez no
`ProvedorDeGestao`), e nenhuma regra precisava distinguir os dois.

O Gate 1 entregou o seletor e **classificou como "dívida latente, hoje
inalcançável"** o efeito disso sobre o informe do financiamento. O `cto-obra`
rejeitou a classificação no Gate 2, e estava certo: a dívida **vira ativa em
01/01/2027**, e vira ativa exatamente no cenário principal da feature — a
revisão anual de **março-maio de 2027**, com o ano **2026** selecionado no
shell e o informe de 2026 já publicado pelo banco.

## A doutrina que saiu daqui (vale para toda regra futura)

> **"Ano fechado × ano corrente" é do CALENDÁRIO, nunca da TELA.**
> Um filtro de leitura pode mudar QUAIS números aparecem. Não pode mudar a
> GRAVIDADE nem a EXISTÊNCIA de uma pendência.

Quem depende de "hoje" lê `anoCorrente`; quem é recorte de leitura lê `ano`.
`calcularResumo` passou a receber os **dois**, com o contrato escrito no tipo
(`EntradaResumo`, `lib/fiscal/resumo.ts`).

## Os dois defeitos corrigidos no Gate 2

**1. `financiamentoAguardandoInforme` / `financiamentoFaltaLancar`** —
`anosDoFinanciamento(dataContrato, informes, ano)` recebia o ano EM TELA e o
tratava como "hoje". Consequência a partir de 01/01/2027: selecionar 2026
marcava 2026 como `aguardando_informe` — **âmbar**, com o texto *"não afeta
declaração nenhuma, que é preenchida com o informe já na mão"* — em vez de
`falta_lancar`, **vermelha**. A declaração de 2026 já afeta, e o extrato já
saiu: é download. Um filtro de leitura rebaixando pendência real.
Correção: `aguardando_informe` só existe quando `ano === anoCorrente`; a lista
de `falta_lancar` é enumerada **sempre até hoje** e é idêntica em qualquer ano
selecionado. Travas em `lib/fiscal/resumo.test.ts` (três testes, um deles com
`ano: 2026, anoCorrente: 2027`).

**2. `terrenoSemRegistro`** — a condição era "nenhum valor datado **até o ano em
tela**". Com o terreno pago e comprovado em 2025, selecionar 2024 acendia
*"nada foi registrado ainda"* + CTA para registrar um terreno **que já está no
sistema**: alarme falso e CTA falso nascidos de filtro de leitura.
Correção: a pergunta é da **obra inteira**, sem ano — `terrenoTemRegistro`
(`lib/fiscal/terreno.ts`), função pura nova, com teste próprio. O R$ 0,00 de um
ano anterior à compra continua sendo exibido, e continua honesto: nada havia
sido pago até lá.

⚠️ **O E2E `e2e/pendencias.spec.ts` consagrava o defeito 2 como esperado** (o
teste criava terreno em ANO−1, selecionava ANO−2 e **exigia** ver "Terreno sem
registro"). Foi reescrito: agora prova que `falta_lancar` de ano fechado **não**
sai da fila nem muda de cor com o seletor, e que o badge é **invariante** ao
recorte de leitura. Teste que consagra defeito é pior que teste ausente — ele
transforma o conserto em "quebra de teste".

## D78 — o que fica aberto, com data-gatilho 01/01/2027

Nada disso é erro de cálculo hoje; tudo é **rótulo que só fica ambíguo quando a
obra cruzar de ano**. Revisar os três ao entrar em 2027, antes da revisão anual:

1. **"Despesas recentes" da Home fica ancorado no ano real mesmo sob "todos os
   anos"** (`resumo.despesas[].noAnoCentavos` usa o ano em tela, e sob "todos"
   o ano em tela é o de hoje). Já nomeado no spec do designer
   (`design/mocks/CONTAI-060.md`, "Decisões e perguntas abertas") como malha
   para o `po` avaliar se vale ticket próprio.
2. **"Custo em risco no IR" e "Base de aferição do INSS" são da OBRA INTEIRA,
   enquanto o KPI ao lado ("Custo confirmado em {ano}") é do ANO** — e nenhum
   dos dois diz isso no rótulo. Pré-existente ao `CONTAI-060` (as pendências que
   os compõem nunca foram recortadas por ano), mas **invisível** enquanto não se
   podia trocar o ano: a partir de 2027, trocar o ano vai mexer num tile e não
   nos outros dois, na mesma linha da tela. É decisão de redação do `contador` +
   `designer`, não de cálculo.
3. **Redação de `/pendencias` sob "todos os anos"**: *"apuradas em todos os
   anos"* pode ser lido como *"pendências de todos os anos"*, quando o que a
   frase quer dizer é que a apuração se ancora em hoje. Apontado pelo
   `cto-obra` no mesmo Gate 2, classificado por ele como **não bloqueante** —
   trabalho de redação do `designer`, fora do `CONTAI-060`.

## Onde está cada coisa

- Regra e travas: `lib/fiscal/resumo.ts`, `lib/fiscal/terreno.ts`,
  `lib/fiscal/resumo.test.ts`, `lib/fiscal/terreno.test.ts`
- Comportamento em tela: `e2e/pendencias.spec.ts` (teste reescrito)
- Ticket: `docs/tickets/CONTAI-060.md` (Pre-mortem 3 previu a classe do
  problema; o Gate 2 é que fixou a doutrina)
