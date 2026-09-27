# CONTAI-066 Compra de cartão retroativa — atalho até confirmar a fatura + texto de contexto

## Tipo e Prioridade
fricção de UX — **P1** (o `contador` não viu obrigação fiscal nova: os dois
documentos que sustentam o item — NF do favorecido e comprovante do
pagamento da fatura — já existem e já são capturados hoje).

## Dor de Origem
`docs/backlog/80-2026-09-26-comprovante-fatura-e-agendamento-retroativo-cartao.md`.
Relato do Mateus, com screenshot, registrando uma compra no cartão
**tardiamente** (`Data da compra = 28/04/2026`, `Vencimento da fatura =
15/05/2026`, hoje é 26/09/2026 — ele sabe que aquele ciclo já foi pago de
verdade). Palavras dele:

> *"não é possível carregar o comprovante do pagamento. No caso eu abro a
> fatura, pegaria o item referente ao pagamento, o comprovante do pagamento
> e anexaria, mas não é possível anexar nenhum documento agora [...] E eu
> posso anexar o comprovante do pagamento específico do item. Agora não é
> possível"*

> *"mesmo as datas de pagamento e de vencimento da fatura serem no passado o
> dizer do botão é 'Agendar - não entra no custo', isso é estranho. Vão
> existir registros de fatura que já foram pagas e registro que não foram."*

## User Story
Como dono da obra fazendo backfill de compras antigas do cartão, em casa,
sentado, quando registro uma compra cuja fatura eu **sei** que já foi paga,
quero ser levado direto para confirmar esse pagamento (e anexar o
comprovante da fatura), em vez de cair numa tela neutra sem indicação do
próximo passo — para não sair procurando um campo de anexo que não existe
nesta tela por desenho.

## Critérios de Aceite
1. [x] Na tela "Agendado" (estado `fase.nome === "agendado"` de
   `app/(captura)/adicionar/compra-cartao/page.tsx`), quando
   `fase.dataVencimento <= hoje`, o link primário do rodapé leva a
   `/fatura/{fase.faturaId}/confirmar` em vez de `/fatura/{fase.faturaId}`.
   Quando `dataVencimento > hoje` (fatura genuinamente futura), comportamento
   atual mantido ("Ver a fatura" → `/fatura/{id}`).
2. [x] Nessa mesma tela, quando `dataVencimento <= hoje`, um texto adicional (não
   fiscal, puramente de wayfinding) explica que o próximo passo é onde ele
   confirma o pagamento e anexa o comprovante da fatura — sem repetir nem
   contradizer a Dica fiscal já existente ("A data da compra não decide ano
   nenhum. Quem decide é o dia em que a fatura for paga").
3. [x] No formulário (antes de salvar), quando a `Vencimento da fatura` digitada
   é `<= hoje`, o banner âmbar existente ("Esta compra nasce sempre
   agendamento...") ganha uma frase preparando a expectativa: se a fatura já
   foi paga, o próximo passo leva a confirmar o pagamento — mesmo texto de
   substância do critério 2, não um terceiro texto novo.
4. [x] **O rótulo do botão final permanece "Agendar — não entra no custo"
   literal, byte a byte, independente de qualquer data.** Não mudar o
   prefixo "Agendar": 4 seletores E2E dependem dele
   (`e2e/cartao.spec.ts` ×3, `e2e/compromisso.spec.ts` ×1, todos
   `getByRole("button", { name: /^Agendar/ })`).
5. [x] Nenhuma mudança de mecanismo de gravação: a compra continua nascendo
   sempre `compromisso` via `criarCompraCartao`, nunca passa por
   `decidirRegistro`, independente de qualquer data (adendo §B(c)) — trava já
   coberta por `lib/fiscal/compromisso.test.ts`, sem alteração.
6. [x] Nenhum campo de anexo novo em `/adicionar/compra-cartao`. O comprovante do
   pagamento da fatura continua existindo só em `/fatura/[id]/confirmar` (e
   `/parcial`), coberto pelo `comprovantePath` único por fatura, denormalizado
   para os N pagamentos — decisão fiscal ratificada nesta rodada (ver Gate
   Fiscal).
7. [x] Gate Fiscal: `contador` confirma que nenhum texto novo introduzido por
   este ticket faz alegação fiscal nova — todo texto sobre "quando o custo
   entra" reaproveita a Dica já existente no estado "agendado", nunca
   redigido do zero.
8. [x] `npm run quality` verde, incluindo os 4 specs E2E citados no critério 4.
   ⚠️ **Ressalva do Gate 4**: só os specs citados no critério 4
   (`e2e/cartao.spec.ts`, `e2e/compromisso.spec.ts`) e `typecheck`/`lint`
   rodaram nesta rodada, por instrução explícita de quem acionou o gate —
   `npm run quality` completo (Vitest inteiro + suíte E2E inteira) não foi
   executado. Ver bloco "Entregue" abaixo.

## Fora de Escopo
- **Comprovante por compra individual dentro da fatura** — investigado e
  descartado por parecer fiscal
  (`docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md`, §2,
  **exclusão ratificada pelo ADENDO da mesma data**): não tem função
  probatória própria (nesse momento o banco ainda não recebeu nada do
  Mateus, só o emissor do cartão; quem sustenta o item são a NF do
  favorecido + o comprovante do pagamento da fatura). ⚠️ Não confundir com o
  **extrato da fatura** (documento distinto, um por fatura, que o mesmo
  ADENDO classificou como gate fiscal novo) — esse requisito é de outra
  pergunta e vira `CONTAI-067`, sem tocar este ticket.
- **Formulário fundido** (registrar a compra e já confirmar o pagamento da
  fatura numa RPC só, com data de pagamento + comprovante dentro de
  `/adicionar/compra-cartao`) — avaliado e recusado pelo `cto-obra`: o
  "confirmar integral" fecha TODAS as compras abertas da fatura; se há
  outras compras abertas na mesma fatura, fundir esconderia isso do usuário
  no momento de confirmar. M + migration, sem ganho sobre o redirect.
- **D81** (nova, achado do `cto-obra`, não do relato): compra atrasada
  entrando numa fatura que já tem um `fatura_desembolso` gravado cria um
  SEGUNDO desembolso, duplicando o registro de saída de caixa perante o
  banco (o custo por pagamento continua correto). Relevante para o padrão de
  backfill que o Mateus está fazendo agora, mas é achado derivado, não a dor
  relatada — fica fora deste ticket, registrada em `docs/backlog.md`
  (tabela de dívidas) como candidata a ticket próprio.
- Detecção automática/heurística de "esta fatura provavelmente já foi paga"
  — o critério 1 usa só a data de vencimento já digitada pelo próprio
  Mateus, nunca infere a partir de outra fonte.

## Gate Fiscal (Contador)
Fonte: `docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md`,
**corpo original + ADENDO (mesma data)**. ⚠️ O corpo original sozinho está
desatualizado — o parecer só fecha sem ressalva lido com o ADENDO junto.

1. Comprovante único por FATURA (cobrindo N compras) está correto e
   suficiente para o evento de pagamento — o evento de caixa é a liquidação
   da fatura, não a compra individual (IN SRF 84/2001 art. 17: o que se
   documenta é o dispêndio efetivo). Não revisto pelo ADENDO.
2. Não existe comprovante **por item** que a fatura não supra — o pedido
   original do Mateus ("comprovante do pagamento específico do item")
   continua sem categoria fiscal própria; o item já é sustentado por NF/
   recibo do favorecido + comprovante do pagamento da fatura. **Essa
   exclusão permanece válida e é a única coisa que este ticket decide sobre
   documentação — ver Fora de Escopo.**
   ⚠️ **Ressalva do ADENDO, fora do escopo deste ticket**: a resposta acima
   cobre só "quem prova que o Mateus PAGOU o item" — não cobre "quem prova
   que ESTE item estava DENTRO desta fatura específica". O ADENDO identificou
   que falta um terceiro documento — o **extrato da fatura emitido pela
   administradora** (um por fatura, nunca por item) — como elo de terceiro
   entre compra e fatura, e classificou isso como **gate fiscal novo, não
   conveniência**. Esse requisito é de outra pergunta, com outra superfície
   (documento na tela de confirmação da fatura), e vira ticket próprio
   (`CONTAI-067`) — **não bloqueia o Gate Fiscal deste ticket**, que trata só
   de navegação/wayfinding.
3. Registro tardio (meses depois do evento) não muda o regime de caixa nem a
   exigência documental — a data que importa é a do pagamento real, não a da
   digitação no app. Não revisto pelo ADENDO.
4. Diagnóstico: a dor **deste ticket** (`CONTAI-066`) é de navegação, não
   fiscal. Nenhuma pergunta pendente ao Mateus quanto ao escopo dele.

## Viabilidade (CTO)
- O "atalho de 3 passos" já é de 2 hoje: a tela de sucesso da compra já
  linka para `/fatura/{faturaId}` (`page.tsx`, rodapé do estado "agendado").
  Falta só trocar o destino e ajustar texto — **não é problema de
  arquitetura**.
- `criarCompraCartao` já devolve `faturaId`; `fatura_desembolso_gravar`
  (migration 0020) aceita N desembolsos por fatura. Encadear as duas telas
  (registrar → `/confirmar`) não exige RPC nova nem migration.
- **Complexidade: PP.** Arquivos esperados: `app/(captura)/adicionar/
  compra-cartao/page.tsx` (link condicional do rodapé, texto condicional no
  banner âmbar e no card do estado "agendado"), `e2e/cartao.spec.ts` (ajustar
  ou confirmar os 3 seletores `/^Agendar/`), `e2e/compromisso.spec.ts`
  (idem, 1 seletor). Sem migration, sem RPC nova.
- Formulário fundido (RPC `compra_cartao_gravar_e_quitar`) foi avaliado e
  recusado: M + migration, duplica upload/alocação e esconde compras irmãs
  da mesma fatura no momento de confirmar — o redirect preserva a lista de
  compras abertas de graça, porque é a mesma tela `/confirmar` de sempre.

## Pre-mortem
1. **O redirect vira roteamento automático "fatura paga" sem confirmação
   humana.** Guarda: o redirect só leva para a tela de confirmação — quem
   afirma que a fatura foi paga (e informa a data real + comprovante)
   continua sendo o clique em "Confirmar pagamento" dentro de `/confirmar`,
   nunca este ticket. Vencido ≠ pago (rotativo, atraso) — a mesma disciplina
   de "campo vazio pergunta, campo preenchido afirma".
2. **Texto novo introduz alegação fiscal não carimbada.** Guarda: critério 7
   — todo texto reaproveita a Dica já existente do estado "agendado", Gate
   Fiscal confere byte a byte antes do Gate 2 fechar.
3. **Seletor E2E quebra em silêncio.** Guarda: critério 4 nomeia os 4
   seletores exatos; `npm run quality` roda a suíte inteira antes do Gate 4.

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: nenhum. (D81, achado durante a investigação deste ticket, fica
  registrada separadamente e não bloqueia nem é bloqueada por este.)

## Perguntas Abertas
Nenhuma — as duas leituras possíveis de "comprovante do pagamento específico
do item" (comprovante do PIX/débito que pagou a fatura inteira × comprovante
próprio do item) foram fechadas pelo parecer fiscal desta rodada, sem
precisar voltar ao Mateus.

## Cenário e checagem final
**Captura** (`/adicionar/compra-cartao`) — mas o "Teste do Canteiro" não é a
régua aqui: o Mateus está fazendo backfill em casa, sentado, de compras
antigas. O critério 375px (piso, não alvo) continua valendo por ser rota de
`(captura)`, mas a decisão que motiva o ticket é de gestão/organização, não
de pressa no canteiro.

⚠️ **Sem migration** — não se aplica a ordem de release
`db push` antes de `git push`.

**Gate 0 fechado** em `design/mocks/CONTAI-066.md` (nível 2, ≤100 linhas, sem
HTML). Decisões do spec: as duas frases novas entram nos elementos JÁ
EXISTENTES (banner âmbar do formulário; segundo `<Dica>` no mesmo Card da
tela "Agendado"), nunca em Card/Banner novo; o link primário do rodapé troca
destino **e** rótulo junto (`/fatura/{id}/confirmar` + "Confirmar o
pagamento" quando `dataVencimento <= hoje`, mantendo "Ver a fatura" quando
futuro) — trocar só o `href` sem o rótulo seria wayfinding falso. **Pronto
para `/develop`.**

---

## ✅ Entregue em 2026-09-26

Gate 4 (`po`), 8/8 critérios PASS. Arquivos finais tocados (só estes,
confirmados sem mudança desde o APPROVE do `cto-obra` no Gate 2):

- `app/(captura)/adicionar/compra-cartao/page.tsx` — `faturaVencida` em dois
  escopos (formulário, com guard de string vazia; tela "Agendado", já
  preenchida); frase extra no banner âmbar existente do formulário; segunda
  `<Dica>` no mesmo Card da tela "Agendado"; rodapé condicional
  (`/fatura/{id}/confirmar` + "Confirmar o pagamento" quando vencida;
  `/fatura/{id}` + "Ver a fatura" quando futura).
- `e2e/cartao.spec.ts` — 2 casos novos com datas relativas (`hoje()`/
  `maisDias()`, nunca data fixa em arquivo).

`npm run typecheck` limpo, `npm run lint` limpo. `npx playwright test
e2e/cartao.spec.ts` — 16/16 (as 4 pré-existentes + os 2 casos novos).
`npx playwright test e2e/compromisso.spec.ts` — 12/12 (o 4º seletor do
critério 4, confirmado intocado). Os textos novos batem byte a byte com
`design/mocks/CONTAI-066.md`.

⚠️ **`npm run quality` completo NÃO rodou nesta rodada** — escopo do Gate 4
foi restrito aos specs do critério 4 mais `typecheck`/`lint`, por instrução
explícita de quem acionou o gate. O diff não toca nenhum arquivo fora de
`compra-cartao/page.tsx` e `cartao.spec.ts`, então o risco de regressão em
outras suítes é baixo, mas a confirmação formal com `npm run quality`
completo fica pendente antes do próximo `git push` (registrado em
`docs/backlog/83-2026-09-26-contai-066-entregue.md`).

`067` fica sozinho na fila. Sem migration — não se aplica a ordem
`db push` antes de `git push`.
