# CONTAI-064 — compra no cartão herda favorecido/CNPJ/valor da nota de origem

Cenário: **captura** (`/adicionar/*`). 375px continua piso — não é permissão de
desktop-first (essa vale para `/adicionar/*` desde 2026-09-22, mas não é o foco
deste ticket, e nada aqui exige tela larga). **Nível 2**: ajuste de campo/estado
numa tela existente — `compra-cartao/page.tsx` passa a se comportar, ao receber
`?documento=<id>`, como `pagamento/page.tsx` já se comporta hoje. Não há decisão
de layout nova: os blocos que entram (`Card` "Ligado a", banner de obra
divergente, `FavorecidoHerdado`) já existem, prontos, em `pagamento/page.tsx` —
o trabalho de design aqui é **onde** cada um entra na tela de cartão e **o que
o texto do "Agendado" pode honestamente afirmar**.

Fonte: `docs/tickets/CONTAI-064.md`. Nenhuma regra fiscal nova — Gate Fiscal do
ticket confirma que não é necessário. O único texto de autoria própria deste
spec é o aviso da tela "Agendado" (item 6), que é honestidade de produto sobre
o mecanismo, não regra tributária.

## Campos

- SEM CAMPOS — nenhum campo novo. Os três campos que já existem
  (`Favorecido`, `CNPJ/CPF`, `Valor da compra`) passam a poder nascer
  **preenchidos** (herdados da nota) em vez de nascerem sempre vazios —
  mesma disciplina de sempre: campo preenchido pelo app é sugestão editável
  (valor) ou herança travada (favorecido/CNPJ, que nunca foram editáveis no
  par nota↔pagamento), nunca fato imposto. `Data da compra` e `Vencimento
  da fatura` continuam manuais, sem herdar nada da nota — o ticket não pede
  isso, e datas fiscais não têm default.

## 0. Redirect — de onde a herança começa

Critério 1 do ticket, só para registrar a dependência: `pagamento/page.tsx`
(linha ~812-816), ao escolher `"cartao"`, passa a levar o documento —
`router.push(documentoDeOrigemId ? \`/adicionar/compra-cartao?documento=${documentoDeOrigemId}\` : "/adicionar/compra-cartao")`,
usando o **estado**, não o parâmetro cru da URL (se o Mateus já tinha
desfeito o vínculo antes de trocar para Cartão, a compra nasce sem herança —
correto, é o que ele pediu ao desfazer).

## 1. Entrada em `/adicionar/compra-cartao?documento=<id>`

- Mesma fronteira de `<Suspense>` de `pagamento/page.tsx` (exigida pelo Next 16
  para `useSearchParams`): a função principal de hoje
  (`export default function NovaCompraCartao()`) vira o componente interno, e
  um novo `export default` a envolve em `<Suspense fallback={<Carregando
  rotulo="Carregando a obra" />}>`.
- `useSearchParams().get("documento")` no primeiro render, nunca
  `window.location` (mesmo motivo do comentário em `pagamento/page.tsx:157-160`).
- Estados novos, espelhando `pagamento/page.tsx` linha a linha:
  `documentoDeOrigemId` (inicializado do parâmetro), `documentoDeOrigem`
  (`Documento | null`), `tentativaDaNota` (para o retry).
- `useEffect` sobre `documentoDeOrigemId`: `carregarDocumento(id)` →
  `setDocumentoDeOrigem` + pré-popula `nome`/`documento` com
  `atual || carregado...` (nunca sobrescreve o que o Mateus já digitou) →
  sugestão de valor (item 5). **Catch**: documento que não abre zera
  `documentoDeOrigemId` (`setDocumentoDeOrigemId(null)`) e a tela segue como se
  tivesse chegado sem parâmetro nenhum — a compra não pode travar por causa de
  uma nota que não carregou.
- Enquanto `documentoDeOrigemId` está setado mas `documentoDeOrigem` ainda não
  chegou (janela de carregamento), o slot onde os campos de favorecido
  apareceriam mostra `<Carregando rotulo="Carregando a nota"
  onTentarDeNovo={recarregarNota} />` — mesmo papel do equivalente em
  `pagamento/page.tsx:857-861`. Esse slot só é visível quando
  `parcelado === "vista"` (ver item 4), porque é aí que os campos de
  favorecido já existem hoje.
- **AppBar**: o subtítulo, hoje sempre `hoje é {data}`, passa a
  `Já nasce ligado a {formatarBRL(documentoDeOrigem.valorCentavos ?? 0)}`
  quando `documentoDeOrigem && !obraDivergente` — mesmo texto literal que
  `pagamento/page.tsx:719` usa. Fora desse caso, o subtítulo não muda (a
  compra é sempre agendamento aqui, não existe o branch "vai virar
  agendamento" que `pagamento` tem).

## 2. Onde cada bloco novo entra — ordem exata (ASCII, 375px)

```
┌ AppBar: "Nova compra no cartão"                        ┐
│ sub: "Já nasce ligado a R$ 1.234,56"  ← só se linkado   │
└──────────────────────────────────────────────────────────┘
  Passo 2 de 2 ↓

  [ AfirmacaoObra: "Registrando em <obra>" ]                (já existe)

  ┌ Banner vermelho — SÓ SE obraDivergente ─────────────┐   (NOVO)
  │ Esta compra não vai nascer ligada à nota.            │
  │ <MOTIVO_OBRA_DIFERENTE, texto integral>              │
  │ Troque a obra desta tela ou desfaça o vínculo antes  │
  │ de salvar.                                           │
  └───────────────────────────────────────────────────────┘

  ┌ Card "Ligado a" — SÓ SE documentoDeOrigem ──────────┐   (NOVO)
  │ Ligado a: <favorecido da nota> · R$ <valor da nota>  │
  │ [Desfazer o vínculo antes de salvar]                 │
  └───────────────────────────────────────────────────────┘

  [ Banner âmbar: "Esta compra nasce sempre agendamento…" ]  (já existe, sem mudança)

  [ Card "Parcelado?"  (À vista / Parcelado) ]                (já existe, sem mudança)

  ┌ Card "à vista" (só quando parcelado === "vista") ───┐
  │  FavorecidoHerdado (read-only)   OU   CamposCurtos   │   (delta no item 4)
  │  Valor da compra   [ajuda "Vem da nota — …" quando   │   (delta no item 5)
  │                      aplicável]                       │
  │  Data da compra          [sempre manual, sem herança] │
  │  Vencimento da fatura    [sempre manual, sem herança] │
  └───────────────────────────────────────────────────────┘

  Rodapé: [Agendar — não entra no custo]  [Voltar]
```

O banner de obra divergente e o card "Ligado a" aparecem **independente** de
`parcelado` — o Mateus vê o que a compra ia herdar antes mesmo de escolher
"À vista"/"Parcelado", mesma ordem de aparição que `pagamento/page.tsx` usa
para meio de pagamento (linhas 763 e 774: o banner vem primeiro, o card
"Ligado a" logo depois). Os dois somem juntos se ele clicar "Desfazer o
vínculo" (zera `documentoDeOrigemId` e `documentoDeOrigem`).

## 3. Obra divergente e o card "Ligado a" — textos exatos

- **Banner** (`cor="red"`, `role="alert"`), só quando
  `documentoDeOrigem.obraId !== obra.id`:

  > **Esta compra não vai nascer ligada à nota.** {MOTIVO_OBRA_DIFERENTE}
  > Troque a obra desta tela ou desfaça o vínculo antes de salvar.

  `{MOTIVO_OBRA_DIFERENTE}` é a constante de `lib/fiscal/vinculo.ts` **reusada
  literal** (o ticket pede explicitamente o mesmo motivo, não um texto novo) —
  ela menciona "pagamento" no meio da frase mesmo aqui sendo uma compra; isso
  é aceito porque é a mesma regra de obra (nenhuma matrícula soma com outra) e
  reescrevê-la seria a autoridade fiscal falando de novo sobre uma frase que
  já existe. Só a frase de abertura ("Esta compra não vai nascer ligada à
  nota.") e o fechamento ("Troque a obra…") são texto de tela, e esses sim
  trocam de "pagamento" para "compra" em relação ao banner irmão de
  `pagamento/page.tsx:765-768`.
- **Card "Ligado a"** — reaproveita o **mesmo JSX** de
  `pagamento/page.tsx:774-793` (extraído para componente compartilhado, ver
  item 4). Texto idêntico, não muda uma palavra: `Ligado a: {favorecido} ·
  {valor}` + botão `Desfazer o vínculo antes de salvar`. Nenhum dos dois
  textos menciona "pagamento", então nada precisa de adaptação aqui.
- `criarCompraCartao` recebe
  `documentoOrigemId: documentoDeOrigem && !obraDivergente ? documentoDeOrigem.id : null`
  (critério 7) — a RPC `compra_cartao_gravar` já aceita `p_documento_origem_id`
  (`lib/data.ts:1781-1795`), então não há chamada extra nem risco de "compra
  salvou, vínculo falhou" **separadamente**: ao contrário de
  `pagamento/page.tsx` (que grava o pagamento e o vínculo em duas chamadas, e
  por isso tem o banner amarelo "se o vínculo falhar…" nas linhas 976-982),
  aqui o vínculo é gravado **no mesmo ato** que a compra. **Esse banner de
  "vínculo pode falhar separadamente" não entra em compra-cartao** — não
  existe esse modo de falha para avisar, e replicá-lo criaria um medo que a
  RPC atômica não justifica.

## 4. `FavorecidoHerdado` dentro do card "à vista"

Critério 8: a função hoje local em `pagamento/page.tsx:1100`
(`FavorecidoHerdado`) migra para um módulo compartilhado (`app/_components/`)
e os dois formulários a importam. Ao extrair, ela precisa de dois ajustes de
interface — nenhum dos dois é regra nova, é o que a extração exige para servir
os dois lugares sem duplicar comportamento:

1. **O link "Corrigir na nota" hoje aponta para
   `/documento/${nota.id}/corrigir/emitente?voltar=pagamento` com o valor
   `"pagamento"` fixo no código.** Isso precisa virar parâmetro
   (`voltarPara: "pagamento" | "compra-cartao"`), porque
   `corrigir/emitente/page.tsx:166-169` lê esse `?voltar=` para decidir para
   onde o botão final ("Voltar ao pagamento — com o nome novo" /
   "Cancelar") manda o Mateus de volta. Sem esse ajuste, corrigir o emitente
   a partir da compra no cartão devolveria o Mateus para
   `/adicionar/pagamento` vazio — trocando o meio de pagamento da compra sem
   avisar, o oposto do que este ticket resolve. **Isto não estava na lista de
   arquivos do CTO em Viabilidade** (que cita só `pagamento/page.tsx`,
   `compra-cartao/page.tsx`, `app/_components/` e os specs de E2E); sinalizo
   aqui para o `cto-obra` confirmar no Gate 2 que o ajuste em
   `app/(gestao)/documento/[id]/corrigir/emitente/page.tsx` (nova opção
   `voltarPara === "compra-cartao"` → `voltaHref =
   /adicionar/compra-cartao?documento=${id}`, botão "Voltar para a compra —
   com o nome novo") entra no escopo deste ticket, e não fica como buraco
   novo. Sem esse ajuste o critério "não promete o que não faz" (doutrina do
   CONTAI-018) fica violado por um link, do mesmo jeito que já foi violado
   uma vez antes (comentário em `pagamento/page.tsx:1154-1159`).
2. **`onSairParaCorrigir`/`temAlgoDigitado` viram opcionais.** Em
   `pagamento`, o link "Corrigir na nota" abre a tela de confirmação de saída
   (`confirmandoSaida`) quando há algo digitado. Em `compra-cartao` **isso não
   existe** — Fora de Escopo do ticket diz explicitamente para não replicar
   `confirmandoSaida` aqui. Então, quando `onSairParaCorrigir` não é passado
   (caso de `compra-cartao`), o componente **sempre** renderiza o
   `BotaoLink` direto (o mesmo ramo que hoje só aparece quando
   `!temAlgoDigitado`), nunca o botão que abriria uma confirmação que não
   existe. Isso não é regressão: é a decisão já tomada no Fora de Escopo,
   só explicitada aqui para quem for implementar não hesitar.

Fora esses dois pontos de interface, o componente é usado **verbatim**: mesmos
rótulos ("Favorecido — da {tipo} de {valor}", "CNPJ / CPF do favorecido — da
{tipo} de {valor}"), mesmo texto de ausência ("esta nota está sem emitente
identificado" / "esta nota está sem CNPJ/CPF"), mesmo parágrafo de ajuda
("Quem recebe o dinheiro é atributo da nota, não do pagamento…" — o texto
menciona "pagamento" genericamente para descrever a regra do par nota↔desembolso,
que vale igual para compra no cartão; não precisa reescrever).

Ele substitui o `CamposCurtos` de `Favorecido`/`CNPJ-CPF` que hoje existem
dentro do card "à vista" (`compra-cartao/page.tsx:295-312`), só quando
`documentoDeOrigemId` está setado — mesma estrutura condicional de
`pagamento/page.tsx:824-882` (`documentoDeOrigemId ? (documentoDeOrigem ?
<FavorecidoHerdado.../> : <Carregando.../>) : (<CamposCurtos>...</CamposCurtos>)`).

## 5. Valor — sugestão (mesmo padrão de `preencherValorDaNota`)

Reaproveita exatamente `carregarPainel(obraId)` + `alocarCusto` +
`saldoDescobertoDaNota` (`pagamento/page.tsx:229-250`), com os mesmos rótulos:

- `"valor da nota"` quando o saldo descoberto é igual ao valor cheio da nota;
- `"falta desta nota"` quando é menor (nota parcialmente coberta).

O campo `Valor da compra` nasce preenchido só se estava vazio
(`setValor((atual) => atual || texto)`), e ganha `ajuda` condicional:

```
ajuda = sugestaoValor && valor === sugestaoValor.texto
  ? `Vem da nota — ${sugestaoValor.rotulo}. Dá para trocar.`
  : undefined
```

O texto de ajuda some no instante em que o Mateus digita outro número —
idêntico à regra de `pagamento`. Nota sem valor, não hábil, ou já coberta por
inteiro não sugere nada (campo continua vazio, pergunta).

## 6. Tela "Agendado" — o texto novo (o cerne do ticket)

Só aparece quando a compra **realmente nasceu com origem gravada**, ou seja,
a mesma condição que decide `documentoOrigemId` não-nulo:
`documentoDeOrigem && !obraDivergente`. Se a obra era divergente (então
`documentoOrigemId` foi `null`) ou se não havia nota nenhuma, a tela
"Agendado" **não ganha bloco nenhum novo** — não há origem para anotar, e
dizer algo sobre uma nota que não foi ligada seria confundir, não esclarecer
(o banner pré-salvar já avisou, antes de ele clicar, que não ia ligar).

```
┌ AppBar: "Agendado"          sub: <favorecido> ┐
└──────────────────────────────────────────────┘

  Banner âmbar: "Agendado para {vencimento}. Nada entrou em custo."
                                                          (já existe, sem mudança)

  ┌ Card tracejado (já existe) ───────────────────────┐
  │ Favorecido            <nome>                       │
  │ Valor previsto        ~ R$ <valor>                 │
  │ Data da compra        <dd/mm/aaaa>                 │
  │ Quando o dinheiro sai para <dd/mm/aaaa> (vencimento│
  │                        da fatura)                  │
  │ Dica: "A data da compra não decide ano nenhum…"    │
  └─────────────────────────────────────────────────────┘

  ┌ Card tracejado — NOVO, só se documentoDeOrigem &&  ┐
  │ !obraDivergente ────────────────────────────────── │
  │ Nota de origem: <favorecido da nota> ·             │
  │ R$ <valor da nota>                                 │
  │                                                     │
  │ Fica anotada como origem desta compra — ainda não   │
  │ é vínculo de custo. Quando você pagar a fatura, o  │
  │ pagamento que nascer daqui NÃO vem ligado a esta   │
  │ nota automaticamente: hoje, para o custo entrar no  │
  │ ano certo, é preciso abrir esse pagamento e usar   │
  │ "Ligar a uma nota" à mão.                          │
  └─────────────────────────────────────────────────────┘

  Banner vermelho: "⚠️ Ressalva que viaja junto…"        (já existe, sem mudança)

  Rodapé: [Ver a fatura]  [Registrar outra compra]  [Voltar ao início]
                                                          (já existe, sem mudança)
```

Texto exato do card novo (autoria do `designer`, sem regra fiscal — é
descrição do mecanismo, não cálculo):

> **Nota de origem:** {favorecido da nota} · {valor da nota}
>
> Fica anotada como origem desta compra — ainda não é vínculo de custo. Quando
> você pagar a fatura, o pagamento que nascer daqui **não vem ligado a esta
> nota automaticamente**: hoje, para o custo entrar no ano certo, é preciso
> abrir esse pagamento e usar "Ligar a uma nota" à mão.

Por que este texto e não "compra ligada à nota" (a armadilha nomeada no
Pre-mortem 2 do ticket):

- **"anotada como origem"**, não "ligada" — é a palavra certa para o que
  `documento_origem_id` faz hoje: fica gravado no `compromisso`, mas não
  sobrevive à quitação (dívida D79, `CONTAI-065` ainda não fechado).
- **"ainda não é vínculo de custo"** — corta de raiz a leitura de que o custo
  da nota já está resolvido. Custo nasce do par pagamento↔documento, e o
  pagamento desta compra nem existe ainda.
- **"não vem ligado a esta nota automaticamente"** dito em negrito, na frase
  central — é o fato que muda de mentira para verdade dependendo de uma
  palavra, e é exatamente o que o Pre-mortem 2 pede para não deixar
  implícito.
- **"hoje, para o custo entrar no ano certo, é preciso abrir esse pagamento e
  usar 'Ligar a uma nota' à mão"** — dá o caminho, não só o aviso. Não cito
  `/pagamento/[id]` como rota clicável porque o pagamento **ainda não
  existe** neste momento (só nasce quando a fatura for paga); é instrução em
  palavras, não um link morto.
- Não menciono "CONTAI-065" nem "D79" — número de ticket e nome de dívida
  interna não aparecem em texto de usuário em nenhuma tela do produto hoje, e
  este card não abre exceção.

Este card é o **único** lugar onde a ressalva aparece — não duplico o aviso no
formulário (card "Ligado a" do item 3 continua com o texto de sempre, sem
ressalva), pela mesma razão que a alavanca do CNO (`pagamento/page.tsx:984-999`)
é só uma frase num só lugar: aviso que aparece toda vez vira aviso que se
aprende a ignorar. O momento certo para esta ressalva é a confirmação, não o
formulário.

## 7. Os 4 estados — só o que muda

- **Loading**: nada novo no carregamento da obra/painel (já existe). O que é
  novo é o carregamento da nota (`documentoDeOrigemId` setado,
  `documentoDeOrigem` ainda `null`): `Carregando rotulo="Carregando a nota"
  onTentarDeNovo={recarregarNota}` no lugar onde os campos de favorecido
  entrariam (item 1).
- **Vazio**: sem `?documento=` na URL, tela idêntica à de hoje — nada muda.
- **Erro**: documento que falha ao carregar não trava nada — o `catch` zera
  `documentoDeOrigemId` e a tela vira o formulário manual de sempre (mesmo
  padrão do `catch` de `pagamento/page.tsx:270-274`). Erro ao **salvar**
  (`criarCompraCartao`) usa a mensagem já existente
  (`mensagemDeErroDeGravacao(erro, "na lista de compras desta fatura")`) —
  nenhuma mudança, porque `documentoOrigemId` viaja dentro da mesma chamada
  atômica (não há um segundo passo que possa falhar sozinho, ver item 3).
- **Sucesso**: tela "Agendado" com o card novo do item 6, quando aplicável.

## Decisões e perguntas abertas

- **Para o `cto-obra` confirmar no Gate 2** (não bloqueia este spec, mas
  precisa entrar no escopo do ticket ou virar um achado formal): o ajuste em
  `app/(gestao)/documento/[id]/corrigir/emitente/page.tsx` para aceitar
  `?voltar=compra-cartao` (item 4, ponto 1). Sem ele, "Corrigir na nota" a
  partir da compra no cartão devolve o Mateus para `/adicionar/pagamento`
  vazio, que é exatamente o tipo de sumiço mudo que este ticket existe para
  eliminar do lado do favorecido/valor — só que agora do lado do "para onde eu
  volto".
- Nenhuma pergunta de fluxo/texto em aberto para o `po` ou o `contador`: o
  ticket fechou requisito e Gate Fiscal antes deste spec, e o único texto de
  autoria própria (item 6) está justificado linha a linha acima.
