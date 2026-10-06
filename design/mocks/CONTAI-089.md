# CONTAI-089 — herdar texto (não vínculo) no criador em lote de parcelas

Cenário: **gestão** (mesmo do CONTAI-084; "Teste do Canteiro" não se aplica).

**Nível do mock: 2** — delta sobre duas telas que já têm spec
(`compra-cartao/page.tsx` e `compra-cartao/parcelas/page.tsx`, ambas em
`design/mocks/CONTAI-084.md`). Só o que muda; o resto de cada spec vale igual.

## 1. Fluxo do delta

Documento → "Adicionar pagamento" → Cartão (`?documento=<id>`) → "Parcelado?"
= Parcelado → **novo**: enquanto nota + sugestão de saldo não terminam de
resolver, o lugar do link mostra "Carregando a nota…"; ao terminar (com valor
ou sem), o link aparece → clique →
`.../parcelas?favorecidoNome=...&favorecidoDocumento=...&valorTotal=...` →
Tela 1 do lote com os 3 campos preenchidos (editáveis) + ajuda → segue o
fluxo do CONTAI-084 sem mudança (gerar → revisão → confirmar → sucesso).

## 2. Telas e estados

### `compra-cartao/page.tsx` — card do `parcelado === "parcelado"`

No lugar onde hoje só existe o `<Link>` "Lançar as parcelas em lote →",
abaixo do `Banner` de `RECUSA_PARCELADO`:

- **loading** — `documentoDeOrigemId` truthy e o efeito inteiro ainda não
  terminou (nome/CNPJ já vieram, mas `sugerirValorDaNota` ainda não
  resolveu): nova flag `notaPronta` (`false` até o `then`/`catch` da sugestão
  de valor rodar, com valor ou `null`) controla isto — texto inline mudo,
  mesmo peso do link que substitui, sem spinner nem retry (o carregamento
  principal já tem seu `Carregando` na seção "À vista"):
  `<p className="text-[13.5px] text-mut">Carregando a nota…</p>`.
- **pronto, com herança** — `notaPronta === true`: mesmo `<Link>` de hoje,
  `href` carrega os 3 valores como query string de texto puro (valor pode
  vir vazio — ver Navegação).
- **pronto, sem contexto (vazio)** — sem `?documento=` na URL (acesso direto,
  ou terceira+ compra): mesmo link de hoje, sem query — zero regressão.
- **erro de carregamento da nota** — fetch falha: cai no mesmo estado "sem
  contexto" (`catch` já existente zera `documentoDeOrigemId`) — link aparece
  igual, sem herança, sem retry específico aqui.

### `compra-cartao/parcelas/page.tsx` — Tela 1, campos `lFavorecido`,
`lFavorecidoDocumento`, `lValorTotal`

Mesmos três `CampoTexto` de hoje, **sem componente de favorecido travado**
(nada de `FavorecidoHerdado`/`LigadoANota` — texto comum, editável igual a
qualquer campo). Diferença: `useState` nasce com o valor da query string em
vez de `""`, e cada um ganha `ajuda` enquanto o valor atual == valor herdado
(mesmo padrão de `ajudaDoValorDaNota`, por campo, independente):

> "Vem da compra que você estava registrando. Dá para trocar."

Ajuda some ao editar ESSE campo (comparação por campo, não um interruptor
único para os três). "Data da compra"/"Vencimento da 1ª fatura" **não
mudam** — vazios, sem ajuda (decisão já fechada). Sem contexto (acesso
direto, ou "Lançar outro lote"): os 3 campos nascem vazios — idêntico a hoje.

## Campos

- `lFavorecido`, `lFavorecidoDocumento`, `lValorTotal` — mesmos campos do
  CONTAI-084. "SEM DEFAULT" não é violado: herdar da nota é a MESMA exceção
  já aberta pelo CONTAI-064 (dado replicado de fonte real, origem visível
  via `ajuda`). Nenhum campo novo; `lCompra`/`lVenc1`/`lParcelas` sem mudança.

## Textos com consequência fiscal

Nenhum texto novo — `contador` confirmou que herança de TEXTO não reabre o
ADENDO 9. A `Dica` existente ("Vínculo com nota não é feito aqui...") cobre.

## Navegação

- `compra-cartao` → `compra-cartao/parcelas` — clique em "Lançar as parcelas
  em lote →", com os 3 valores (quando disponíveis) na query string de TEXTO
  puro: `favorecidoNome`, `favorecidoDocumento` (formatado, via
  `formatarDocumento`, não só dígitos), `valorTotal` (texto decimal, via
  `centavosParaInput`). Cada parâmetro só entra na URL se o dado existir
  (nota sem emitente não manda `favorecidoNome` vazio).
- **`valorTotal` herdado é o estado `valor` de `compra-cartao/page.tsx`** (o
  SALDO descoberto de `sugerirValorDaNota`, ou o que o Mateus já tiver
  digitado) — **nunca** `documentoDeOrigem.valorCentavos` (face): repetir o
  valor cheio de uma nota com pagamento parcial dobraria o custo, a única
  direção de erro com passivo tributário (mesmo parecer de
  `sugerirValorDaNota`; decisão do Mateus de 2026-08-18). Por isso o link
  espera o efeito INTEIRO (`notaPronta`), não só o documento. Nota sem saldo
  sugerível (`null`): `valorTotal` fica fora da query e "Valor total" chega
  vazio na Tela 1, perguntando — não trava o link nem o fluxo.
- `compra-cartao/parcelas` passa a precisar de `useSearchParams` + fronteira
  de `Suspense` — a rota continua **nunca lendo id de documento** (critério 2
  do CONTAI-084 intacto), só os 3 textos. Mesmo padrão de `herdarDaUrl`: só a
  1ª "rodada" herda da URL; "Lançar outro lote" precisa (a) incrementar
  `rodada` como já faz e (b) `router.replace(".../parcelas", { scroll: false
  })` antes, para a URL não resgatar a herança antiga num F5 pós-2º lote.

## Decisões de design e perguntas abertas

- Decidido: herança independe de `obraDivergente` (só texto, sem vínculo a
  desfazer) e sem retry específico para falha de carregamento da nota aqui
  (degrada para "sem contexto" em silêncio, como pedido).
- Sem pergunta pendente de requisito — as do `backlog/104` (datas não
  herdam; mecanismo do link) já vieram respondidas como insumo deste ticket.
