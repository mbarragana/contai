# CONTAI-064 Compra no cartão herda favorecido/CNPJ/valor da nota de origem

## Tipo e Prioridade
fix — P1 (fricção de processo real, sem imposto/multa vencendo — mas
reabre digitação que o app já tinha resolvido um passo antes). Materializa
a dívida **D79**, nomeada em
`docs/backlog/78-2026-09-26-cartao-nao-herda-documento.md`.

## Dor de Origem
`docs/backlog/78-2026-09-26-cartao-nao-herda-documento.md`. Palavras do
Mateus, com screenshot: *"vincular pagamento via cartão não está
preenchendo os dados do favorecido automaticamente, mesmo sendo vinculado a
nota fiscal. Deveria vir preenchido já."*

Em `/adicionar/pagamento?documento=<id>` (favorecido/CNPJ/valor já
herdados via `FavorecidoHerdado`), trocar "Como foi pago" para Cartão
redireciona para `/adicionar/compra-cartao` **sem nenhum parâmetro** —
`app/(captura)/adicionar/pagamento/page.tsx:812-816` faz só
`router.push("/adicionar/compra-cartao")`, descartando
`documentoDeOrigemId`, `nome`, `documento` e `sugestaoValor` já resolvidos.
`compra-cartao/page.tsx` não tem `useSearchParams` nem qualquer mecanismo
de receber contexto de origem — a tela nasce sempre vazia, mesmo vindo de
um documento já identificado.

Confirmado com o `cto-obra` (consulta de arquitetura antes deste ticket):
**é lacuna de UI, não de schema.** `compromisso.documento_origem_id`
(migration `0007`) já é genérico para qualquer origem de compromisso
(pix/boleto/cartão) e a RPC `compra_cartao_gravar` (migration `0013`) já
aceita e grava `p_documento_origem_id`. O caminho irmão — PIX/boleto com
data futura virando `compromisso` — já usa esse campo
(`criarCompromisso`, `pagamento/page.tsx:504`). Este ticket **não tem
migration**.

## User Story
Como dono da obra, em casa ou no canteiro, registrando o pagamento de uma
nota que já abri no app, quando escolho "Cartão" como meio de pagamento,
quero que a tela de compra no cartão já venha com o favorecido, o CNPJ e
uma sugestão de valor da nota, para não digitar de novo o que o app já
sabia um passo atrás.

## Critérios de Aceite
1. [x] `pagamento/page.tsx`, ao escolher `"cartao"`: o redirect leva o
   documento de origem na URL —
   `router.push(documentoDeOrigemId ? \`/adicionar/compra-cartao?documento=${documentoDeOrigemId}\` : "/adicionar/compra-cartao")`.
   Usa o **estado** `documentoDeOrigemId`, não o parâmetro cru da URL —
   "Desfazer o vínculo antes de salvar" zera esse estado, e o redirect
   precisa respeitar isso (se o Mateus desfez o vínculo antes de trocar
   para Cartão, a compra nasce sem herança nenhuma).
2. [x] `compra-cartao/page.tsx` lê `useSearchParams().get("documento")` no
   primeiro render (não `window.location` — mesma razão do comentário em
   `pagamento/page.tsx:157-160`: chegando por navegação client-side, o
   `location` ainda não tem a query). Página ganha fronteira de
   `<Suspense>` (mesmo padrão de `pagamento/page.tsx`, exigido pelo Next 16
   para `useSearchParams`).
3. [x] Com documento na URL: chama `carregarDocumento(id)` e pré-popula
   `nome`/`documento` com o padrão `atual || carregado...` (nunca
   sobrescreve o que o Mateus já digitou), replicando o bloco de
   `pagamento/page.tsx:252-275` **incluindo o `catch`** que zera o id se o
   documento não abrir (documento que falha ao carregar não trava o
   registro da compra).
4. [x] Sugestão de valor: mesmo padrão de `preencherValorDaNota`
   (`pagamento/page.tsx:229-250`) — `carregarPainel(obraId)` +
   `alocarCusto` + `saldoDescobertoDaNota`, mesmo rótulo "valor da nota /
   falta da nota". É sugestão (campo `valor` nasce preenchido só se vazio);
   o texto de ajuda some assim que o Mateus digitar outro número (mesma
   regra do `sugestaoValor` em pagamento).
5. [x] Card "Ligado a: [favorecido] · [valor]" com "Desfazer o vínculo
   antes de salvar" — reaproveita o mesmo componente/JSX de
   `pagamento/page.tsx:774-793` (extrair para componente compartilhado se
   ainda não existir um; não duplicar o JSX).
6. [x] **Obra divergente**: se `documentoDeOrigem.obraId !== obra.id` (obra
   corrente do registro), banner "Esta compra não vai nascer ligada à
   nota." com o mesmo `MOTIVO_OBRA_DIFERENTE` de `lib/fiscal/vinculo.ts`,
   e a chamada a `criarCompraCartao` sobe `documentoOrigemId: null` nesse
   caso — nunca grava vínculo de obra errada.
7. [x] `criarCompraCartao` passa a receber
   `documentoOrigemId: documentoDeOrigem && !obraDivergente ? documentoDeOrigem.id : null`.
8. [x] `FavorecidoHerdado` (hoje função local em `pagamento/page.tsx:1100`)
   é movida para um módulo compartilhado (`app/_components/`) e importada
   nos dois lugares — não duplicada. A extração exige dois ajustes de
   interface (achados pelo `designer`, `design/mocks/CONTAI-064.md` §4):
   (a) o link "Corrigir na nota" ganha um `voltarPara: "pagamento" |
   "compra-cartao"` parametrizável, em vez do `"pagamento"` fixo hoje; (b)
   `onSairParaCorrigir`/`temAlgoDigitado` viram opcionais — quando ausentes
   (caso `compra-cartao`, que não replica `confirmandoSaida`), o componente
   sempre renderiza o `BotaoLink` direto.
9. [x] **`app/(gestao)/documento/[id]/corrigir/emitente/page.tsx`** ganha a
   opção `voltar=compra-cartao` (hoje só lê `?voltar=pagamento`,
   `corrigir/emitente/page.tsx:166-169`): `voltarPara === "compra-cartao"`
   → `voltaHref = /adicionar/compra-cartao?documento=${id}`, botão "Voltar
   para a compra — com o nome novo". Achado do `designer` fora da
   Viabilidade original do `cto-obra` (que listava só `pagamento/page.tsx`,
   `compra-cartao/page.tsx` e `app/_components/`) — **sem este ajuste, o
   link "Corrigir na nota" a partir da compra no cartão devolve o Mateus
   para `/adicionar/pagamento` vazio**, trocando o meio de pagamento sem
   avisar — o mesmo sumiço mudo que este ticket existe para eliminar do
   lado do favorecido/valor, só que do lado de "para onde eu volto". `cto-
   obra` confirma no Gate 2 que este arquivo entra no escopo do ticket.
10. [x] Texto da tela "Agendado" (`compra-cartao/page.tsx:167-214`), quando
    a compra veio de um documento: afirma só o que o sistema garante hoje —
    a nota fica **anotada como origem** da compra; o vínculo de custo só se
    confirma **quando a fatura for paga** (hoje, à mão em
    `/pagamento/[id]`, até o `CONTAI-065` fechar a propagação automática).
    Nunca escrever "ligado à nota" sem essa ressalva — texto exato em
    `design/mocks/CONTAI-064.md` §6 (autoria do `designer`, sem citar
    tickets/dívidas internas na tela).
11. [x] E2E: clonar os casos de `?documento=` de `e2e/vinculo.spec.ts` (ou
    equivalente) para um spec de cartão — chega em `/adicionar/compra-
    cartao?documento=<id>` já com favorecido/CNPJ/valor preenchidos;
    salvar grava `compromisso.documento_origem_id`; obra divergente grava
    `null` e mostra o banner. Cobrir também o retorno de "Corrigir na
    nota" (critério 9) de volta a `/adicionar/compra-cartao?documento=<id>`.

---

## ✅ Entregue em 2026-09-26

Gate 4 (`po`), 11/11 critérios PASS. Arquivos finais tocados:

- `app/_components/nota-de-origem.tsx` (novo — módulo compartilhado:
  `FavorecidoHerdado`, `LigadoANota`, `sugerirValorDaNota`/
  `ajudaDoValorDaNota`).
- `app/(captura)/adicionar/compra-cartao/page.tsx` — `<Suspense>`, herança
  via `?documento=`, obra divergente, card "Nota de origem" na tela
  "Agendado".
- `app/(captura)/adicionar/pagamento/page.tsx` — redirect para Cartão leva
  `?documento=` do estado; refatorado para importar de `nota-de-origem.tsx`
  (comportamento idêntico, confirmado pelo `cto-obra`).
- `app/(gestao)/documento/[id]/corrigir/emitente/page.tsx` —
  `?voltar=compra-cartao`.
- `e2e/cartao.spec.ts`.

Nenhum arquivo mudou depois do último APPROVE do `cto-obra` no Gate 2.
`npm run quality` verde: lint limpo, typecheck limpo, **1121 Vitest** /
**338 Playwright**. Zero migration, como a Viabilidade previa.

**Dívida nomeada — D80**: `favorecido.documento` com máscara gravado por
`compra-cartao` antes deste ticket (a tela gravava o CNPJ formatado em vez de
só dígitos; corrigido aqui, mas linhas antigas em produção podem ter ficado
com a máscara). Ver
`docs/backlog/79-2026-09-26-contai-064-entregue-e-d80-mascara-favorecido.md`
para a query de diagnóstico e a regra de correção (nunca `UPDATE` cego —
colide com a unique `(user_id, documento)` se a versão só-dígitos já existir).

Paga **parcialmente** a D79 (a captura herda; a quitação ainda não propaga —
falta o `CONTAI-065`).

## Out of Scope
- **Propagar o vínculo até `pagamento_documento` na quitação da fatura** —
  é o `CONTAI-065` (schema + RPC), separado por ser migration e por
  corrigir um buraco mais largo (também vale para PIX/boleto agendado, não
  só cartão). Este ticket resolve a herança na **tela de captura**; o
  `065` resolve a herança **sobreviver** até o pagamento nascer.
- Bloquear a compra por nota não hábil, em quarentena, ou com saldo zerado
  — a compra no cartão nasce sempre agendamento, nada entra em custo no
  ato do registro (`lib/fiscal/fatura.ts`); `saldoDescobertoDaNota` entra
  só como sugestão de valor, nunca como trava.
- Validar que `documento_origem_id` pertence ao mesmo `user_id` do
  favorecido — achado extra do `cto-obra` (a FK aceita qualquer uuid
  existente; RLS de leitura cobre a superfície, escrita não), fica dentro
  do `CONTAI-065`.
- Persistir formulário fiscal pela metade na navegação pagamento→cartão —
  mesma doutrina do `CONTAI-021` (aviso antes de sair, não rascunho); não
  entra aqui.
- Replicar `confirmandoSaida` (aviso de "Corrigir na nota" ao sair) na tela
  de compra-cartao — ela não tem esse link de saída; achado do `cto-obra`
  ao decidir o que replicar 1:1 e o que não.

## Gate Fiscal (Contador)
Não é necessário. Confirmado pelo `contador` na consulta de escopo: o
pré-preenchimento é sugestão editável, e o campo probatório
(`documento_origem_id`) é afirmado pelo próprio Mateus ao salvar — nenhuma
regra, custo ou ano muda com este ticket.

## Pre-mortem
1. **Redirect usa o parâmetro da URL em vez do estado, e ignora "Desfazer
   o vínculo".** Guarda: critério 1 usa explicitamente o estado
   `documentoDeOrigemId`, não `documentoNaUrl`.
2. **Texto da tela "Agendado" promete mais do que o sistema entrega hoje**
   (ex.: "compra ligada à nota", sem ressalva) — vira armadilha idêntica à
   que motivou a dívida D79 (afirmação morre na quitação). Guarda:
   critério 9, texto explícito exigido, revisão do `designer`.
3. **Duplicar `FavorecidoHerdado` em vez de compartilhar** — mesma classe
   de defeito que motivou D40/D55 (código repetido diverge). Guarda:
   critério 8.
4. **"Corrigir na nota" a partir da compra no cartão devolve o Mateus para
   `/adicionar/pagamento` vazio** — achado do `designer` no Gate 0
   (`design/mocks/CONTAI-064.md` §4, ponto 1): `corrigir/emitente/page.tsx`
   só sabia voltar para `pagamento`. Trocaria o meio de pagamento da
   compra sem avisar — o mesmo sumiço mudo que este ticket existe para
   eliminar, só que do lado do "para onde eu volto". Guarda: critério 9.

## Viabilidade (CTO)
Confirmada em consulta prévia (`docs/backlog/78-2026-09-26-cartao-nao-
herda-documento.md`): zero migration, zero mudança de RPC, zero mudança em
`lib/data.ts` além de passar o parâmetro que a assinatura já aceita.
**Arquivos e complexidade — S**: `app/(captura)/adicionar/pagamento/
page.tsx` (redirect), `app/(captura)/adicionar/compra-cartao/page.tsx`
(hidratação + obra divergente + texto), `app/_components/` (extração de
`FavorecidoHerdado`), `app/(gestao)/documento/[id]/corrigir/emitente/
page.tsx` (opção `voltar=compra-cartao`, achado do `designer` fora da
Viabilidade original — **`cto-obra` confirma no Gate 2** que este arquivo
entra no escopo do ticket e não fica como buraco novo), `e2e/*.spec.ts`
(spec novo ou casos adicionados).

## Dependências
- Bloqueado por: nenhum. **Gate 0 fechado** — `design/mocks/CONTAI-064.md`
  (nível 2), fluxo e texto da herança/obra divergente/tela "Agendado"/
  retorno de "Corrigir na nota" já descritos.
- Bloqueia: nenhum. Não bloqueia nem depende do `CONTAI-065` — os dois são
  entregáveis de forma independente (D79 fica só parcialmente paga se este
  entrar sozinho: a captura herda, mas a quitação ainda não propaga).

## Perguntas Abertas
Nenhuma para `po`/`contador` — arquitetura fechada pelo `cto-obra`,
condição fiscal fechada pelo `contador`, ambos em consulta prévia a este
ticket. **Uma confirmação pendente para o Gate 2 do `cto-obra`**: que
`app/(gestao)/documento/[id]/corrigir/emitente/page.tsx` (achado pelo
`designer`, fora da Viabilidade original) entra no escopo deste ticket —
ver critério 9 e Pre-mortem 4.

## Cenário e checagem final
**Captura** (registro do pagamento/compra no canteiro ou em casa) — mas a
correção em si (herdar dado já resolvido) é a mesma doutrina de
"campo preenchido afirma" que vale em qualquer cenário; o "Teste do
Canteiro" mede só o caminho de captura, não decide se o dado herda ou não.
375px continua obrigatório aqui — é tela de `/adicionar/*` (permissão de
2026-09-22 de tratamento desktop vale, mas não é o foco deste ticket).
**Gate 0 fechado** em `design/mocks/CONTAI-064.md` (nível 2). **PRONTO
PARA `/develop`**, com a confirmação de escopo do critério 9 a fechar no
Gate 2.
