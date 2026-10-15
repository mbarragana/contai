# CONTAI-097 — comprovante opcional em "fatura paga · parcial" (D56-b, ponta A)

Cenário: **gestão** (em casa, sentado — registrar o pagamento do rotativo da
fatura de cartão. Teste do Canteiro não se aplica: pagar fatura de cartão é
ato de conciliação bancária, nunca o instante de uma compra no canteiro —
fica na coluna "conciliar pagamento↔nota / corrigir" da régua de cenários).

Nível **2** (spec + ASCII). Não há decisão de layout em aberto: o campo novo
reusa **exatamente** o padrão já em produção de
`/fatura/[id]/confirmar/page.tsx:249-259` (`CampoArquivo` +
`subirParaAcervo(arquivo, "comprovante")`, envio no `salvar()` em torno da
linha 374) — é recombinação de componente já testado, não desenho novo.

Fonte fiscal: nenhuma. O Gate Fiscal do `contador` já descartou pergunta
fiscal nova para esta ponta — o campo é um anexo probatório opcional, sem
"nota no CPF" e sem gate de retenção.

## Campos

### `/fatura/[id]/parcial`

- `comprovanteParcial` — Arquivo (`CampoArquivo`, `accept=".pdf,image/*"`) —
  opcional — banco: `fatura_desembolso.comprovante_path` via
  `registrarDesembolsoDeFatura({ comprovantePath })` (parâmetro já existe na
  assinatura hoje; esta tela sempre passava `null`, passa a passar o path
  quando houver arquivo) — SEM DEFAULT (nasce sem arquivo selecionado; a
  ausência não bloqueia "Salvar" — comportamento idêntico ao atual).

## Nota: nenhum campo fiscal novo

SEM CAMPOS FISCAIS NOVOS — o anexo é documento probatório (comprovante de
pagamento), não uma pergunta fiscal: não há "nota no CPF?" nem gate de
retenção nesta tela, antes ou depois do ticket. Por ser opcional e
probatório, sua ausência não abre pendência nem viola "campo vazio pergunta,
preenchido afirma" — essa regra dura é sobre campos que AFIRMAM um fato
fiscal (ex. `notaNoCpf`), e este não afirma nada: é só onde o documento, se
existir, entra no acervo.

## Fluxo

1. Carregamento idêntico ao atual (`carregarFatura` → `carregarCompromissos`
   → `compromissosAbertosDaFatura`). Nenhum estado de carregamento novo.
2. Dentro do `Card` que já tem "Data em que você pagou" e "Valor pago", ganha
   um terceiro controle, **depois** do campo de valor, na mesma `Card` (não
   uma `Card` nova): `CampoArquivo` rotulado **"Comprovante deste pagamento
   (opcional)"**, `ajuda` **"PDF, foto ou print — se você tiver à mão agora.
   Pode anexar depois, no detalhe do pagamento."**, `accept=".pdf,image/*"`.
3. `podeSalvar` **não muda** — continua `data !== "" && ehDataValida(data) &&
   valorCentavos !== null && valorCentavos > 0`. O anexo nunca entra nessa
   conta; não bloqueia "Salvar" em nenhum caso.
4. Em `salvar()`: se `arquivo !== null`, `await subirParaAcervo(arquivo,
   "comprovante")` **antes** de `registrarDesembolsoDeFatura` (mesma ordem
   do padrão de `confirmar/page.tsx`: upload primeiro, porque a RPC precisa
   do path já existente no acervo). O `comprovantePath` resultante substitui
   o `null` fixo de hoje no payload. Se `arquivo === null`, o payload é
   byte-a-byte o de hoje (`comprovantePath: null`) — zero regressão.
5. Falha no upload (antes de chamar a RPC): mesmo banner de erro que a tela
   já usa (`mensagemDeErroDeGravacao`), estado volta a `"pronto"` com `data`,
   `valor` **e o arquivo selecionado preservados** — não força escolher o
   arquivo de novo numa tentativa seguinte.
6. Sucesso: navegação idêntica à atual —
   `router.push(`/fatura/${fatura.id}/alocar?desembolso=${desembolsoId}`)`.
   Nenhuma tela de sucesso nova nesta ponta; a tela de alocação é o próximo
   passo já existente e fica fora de escopo deste ticket.

## ASCII — o bloco do campo novo (dentro do Card já existente)

```
┌ Card ──────────────────────────────────────────────────────┐
│ Data em que você pagou          [ dd/mm/aaaa            ]   │
│ Valor pago                       [ 0,00                 ]   │
│  (ajuda condicional de rotativo, inalterada — linha hoje)   │
│ ───────────────────────────────────────────────────────── │
│ Comprovante deste pagamento (opcional)                      │
│   [ Escolher arquivo… ]           nenhum selecionado         │
│   PDF, foto ou print — se você tiver à mão agora. Pode       │
│   anexar depois, no detalhe do pagamento.                    │
└─────────────────────────────────────────────────────────┘
```

## Os 4 estados (delta)

- **Carregando**: inalterado (`Carregando rotulo="Carregando a fatura"`).
- **Vazio**: o campo nasce sem arquivo — é o estado normal de repouso, não um
  "vazio" de erro; idêntico em espírito ao resto do formulário (data/valor
  também nascem vazios).
- **Erro**: dois casos, ambos já cobertos pela tela — (a) erro ao
  **carregar** a fatura, inalterado (`EstadoErro`); (b) erro ao **subir o
  anexo ou gravar**, mesmo banner vermelho de hoje
  (`mensagemDeErroDeGravacao`), sem perder a seleção do arquivo.
- **Sucesso**: inalterado na navegação; a única mudança invisível na tela é
  que `comprovantePath` deixa de ser sempre `null` no payload gravado.

## Navegação

Nenhuma nova.

## Decisões de design

- O anexo entra **dentro** do `Card` existente, não numa `Card` separada: é
  o terceiro campo de um formulário de três campos, não um bloco temático
  próprio (ao contrário do extrato/comprovante de `confirmar`, que são dois
  documentos com papéis distintos).
- "Pode anexar depois, no detalhe do pagamento" é uma afirmação verdadeira
  hoje, não uma promessa: `/pagamento/[id]/comprovante` (CONTAI-061) já
  cobre comprovante tardio para qualquer pagamento, incluindo os gerados por
  este desembolso.
