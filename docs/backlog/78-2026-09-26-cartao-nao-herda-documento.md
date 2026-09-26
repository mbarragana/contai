# Compra no cartão não herda a nota — 2026-09-26

## Relato (com screenshot)

Mateus estava em `/adicionar/pagamento?documento=<id>` — pagamento já ligado
a uma nota fiscal existente, favorecido/CNPJ/valor herdados via
`FavorecidoHerdado`. Trocou "Como foi pago" para **Cartão**, foi
redirecionado para `/adicionar/compra-cartao`, e a tela chegou **vazia** —
sem favorecido, CNPJ nem valor.

> "vincular pagamento via cartão não está preenchendo os dados do
> favorecido automaticamente, mesmo sendo vinculado a nota fiscal. Deveria
> vir preenchido já."

## Investigação técnica (`po`, leitura de código, nada editado)

1. **Causa imediata** — `app/(captura)/adicionar/pagamento/page.tsx:812-816`:
   ao escolher `"cartao"`, o código faz só `router.push("/adicionar/compra-
   cartao")`, sem parâmetro nenhum. Todo contexto resolvido
   (`documentoDeOrigemId`, `nome`, `documento`, `sugestaoValor`) é
   descartado. `compra-cartao/page.tsx` não tem `useSearchParams` nem
   qualquer mecanismo de receber contexto de origem.
2. **Hipótese inicial (rejeitada na consulta ao `cto-obra`)**: que faltaria
   coluna de vínculo em `fatura_desembolso` — schema novo, escopo grande.
   **Falso**: `compromisso.documento_origem_id` (migration `0007`) já é
   genérico para qualquer origem (pix/boleto/cartão), e `compra_cartao_
   gravar` (migration `0013`) já aceita e grava `p_documento_origem_id`. O
   caminho irmão — PIX/boleto com data futura virando `compromisso` — já usa
   esse campo (`criarCompromisso`, `pagamento/page.tsx:504`,
   `documentoOrigemId: documentoDeOrigem?.id ?? null`). Zero migration
   necessária para pré-preencher a tela.

## Consulta ao `cto-obra` — achado mais sério que a pergunta original

`grep -rn documentoOrigemId app lib` devolve **uma única escrita** (a do
PIX/boleto agendado) e **zero leituras** em todo o app. O campo é
**write-only**: quando o compromisso é quitado —
`fatura_desembolso_gravar`/`fatura_alocar` (cartão) ou `quitarCompromisso`
(PIX/boleto) — o `pagamento` nasce **sem** inserir em `pagamento_documento`.
O vínculo que o Mateus afirma no agendamento **morre ali** e ele teria que
religar a nota manualmente em `/pagamento/<id>` mesmo já tendo dito qual era
a nota. Não é erro fiscal (a direção é custo NÃO comprovado, a segura), é
armadilha de UX/rastreabilidade — e é **pré-existente** no PIX/boleto
agendado; o relato só expôs pelo cartão.

Decisão de escopo do `cto-obra`: **dois tickets**, não um.

## Consulta ao `contador`

Pergunta objetiva: replicar automaticamente, na quitação, o vínculo que o
Mateus já afirmou no agendamento fere "campo preenchido afirma, sistema
nunca assume por conta própria"? **Não.** Parecer completo em
`docs/pareceres/2026-09-26-replicar-vinculo-documento-quitacao.md`: não é
inferência nova (proibida pelo §5 do parecer de 2026-08-17), é persistência
de uma afirmação humana já feita — mesmo padrão do favorecido herdado
read-only (ADENDO 2 do mesmo parecer), um passo adiante no tempo. Ticket
nasce sem gate fiscal de prioridade alta.

## Tickets criados

- **`CONTAI-064`** — lacuna de UI (S, zero migration): redirect leva
  `?documento=<id>`, `compra-cartao/page.tsx` hidrata favorecido/CNPJ/
  sugestão de valor do documento (mesmo padrão de `pagamento/page.tsx`),
  trata obra divergente + "desfazer vínculo" (replicado 1:1 da tela de
  pagamento), passa `documentoOrigemId` para `criarCompraCartao`, e corrige
  o texto da tela "Agendado" para não afirmar mais do que o sistema garante
  hoje (o vínculo de custo ainda depende do `CONTAI-065` para sobreviver à
  quitação).
- **`CONTAI-065`** — propagar `documento_origem_id` → `pagamento_documento`
  no ato da quitação (M, COM migration): `fatura_desembolso_gravar`,
  `fatura_alocar` e `quitarCompromisso` passam a inserir o vínculo quando a
  obra bate e não há vínculo manual anterior. Bloqueado por nenhum, mas
  documenta a mesma dívida que o `064` deixa visível na tela.

## Dívida nomeada

**D79** — `compromisso.documento_origem_id` é write-only: afirmado no
agendamento, nunca lido na quitação (nem pelo cartão nem pelo PIX/boleto).
Ver tabela de dívidas no índice.

## Fora de escopo (e por quê)

- Checar `saldoDescobertoDaNota`/`ehDocumentoHabil` como **bloqueio** de
  compra no cartão — a compra nasce sempre agendamento, nada entra em custo
  ali; usar o saldo só como **sugestão** de valor (mesmo padrão do
  pagamento avulso), nunca trava.
- Validar que `documento_origem_id` pertence ao mesmo `user_id` na RPC (a
  FK aceita qualquer uuid existente; RLS de leitura cobre a superfície, mas
  a escrita não é validada) — achado extra do `cto-obra`, fica dentro do
  `CONTAI-065` junto com a guarda de obra.
- Persistir formulário fiscal pela metade entre pagamento→compra-cartao —
  mesma doutrina do `CONTAI-021` (aviso, não rascunho); fora de escopo dos
  dois tickets.

## Gate 0 do `CONTAI-064` fechado

`design/mocks/CONTAI-064.md` (nível 2) publicado no mesmo dia. Achado extra
do `designer`, fora da Viabilidade original do `cto-obra`: o link "Corrigir
na nota" (dentro de `FavorecidoHerdado`) tem `?voltar=pagamento` fixo em
`app/(gestao)/documento/[id]/corrigir/emitente/page.tsx` — sem uma opção
`voltar=compra-cartao`, corrigir o emitente a partir da compra no cartão
devolveria o Mateus para `/adicionar/pagamento` vazio, trocando o meio de
pagamento sem avisar. Não bloqueou o spec; virou **critério 9** do
`CONTAI-064`, com confirmação de escopo pendente para o Gate 2 do
`cto-obra` (se este arquivo entra no escopo do ticket, o que é a leitura
óbvia — só precisa do carimbo formal).

## Perguntas abertas

Nenhuma para `po`/`contador`. **Os dois tickets (`CONTAI-064`,
`CONTAI-065`) estão prontos para `/develop`** — confirmação de escopo do
critério 9 do `064` fica para o Gate 2 do `cto-obra`, não bloqueia o
Gate 1.
