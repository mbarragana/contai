# CONTAI-065 Propagar vínculo com a nota da previsão para a quitação (D79)

## Tipo e Prioridade
fix — P1, sem gate fiscal de prioridade alta (o `contador` confirmou que é
replicação de dado já afirmado, não decisão fiscal nova). Materializa a
dívida **D79**, nomeada em
`docs/backlog/78-2026-09-26-cartao-nao-herda-documento.md`.

## Dor de Origem
Achado técnico do `cto-obra`, na consulta de arquitetura do `CONTAI-064`
(`docs/backlog/78-2026-09-26-cartao-nao-herda-documento.md`): `grep -rn
documentoOrigemId app lib` devolve **uma única escrita** (PIX/boleto
agendado, `pagamento/page.tsx:504`) e **zero leituras** em todo o app.
`compromisso.documento_origem_id` é **write-only**: o Mateus afirma, no
agendamento, qual nota originou a compra/o compromisso, mas quando ele é
quitado — `fatura_desembolso_gravar`/`fatura_alocar` (compra no cartão,
fatura paga) ou `quitarCompromisso` (PIX/boleto agendado, pago) — o
`pagamento` que nasce daí **não herda** esse vínculo: nasce sem nenhuma
linha em `pagamento_documento`.

Efeito prático: o Mateus vê a compra "aguardando NF" ou a nota "sem
pagamento ligado" mesmo tendo dito, semanas antes, qual nota era. Ele teria
que religar manualmente em `/pagamento/<id>` → "Ligar a uma nota", achando
que o app perdeu um vínculo que ele já tinha feito. Não é erro fiscal na
direção perigosa (o app fica conservador: custo NÃO comprovado até religar
à mão), mas é rastreabilidade quebrada e a mesma família de armadilha de UX
que motivou o parecer original de 17/08 ("custo real tratado como
inexistente até segundo clique manual").

## User Story
Como dono da obra, quando já afirmei no agendamento (PIX, boleto ou compra
no cartão) qual nota originou aquele compromisso, quero que o pagamento
nasça automaticamente ligado a essa mesma nota quando eu quitar o
compromisso, para não ter que repetir uma afirmação que já fiz.

## Critérios de Aceite
1. [x] `fatura_desembolso_gravar`/`fatura_alocar` (migration `0013`) e
   `quitarCompromisso` (lib/data.ts) passam a inserir em
   `pagamento_documento` quando `compromisso.documento_origem_id` não é
   nulo **e** a obra do documento é a mesma obra do compromisso **no
   momento da quitação** (pode ter mudado desde o agendamento — se
   divergir, não replica; mesma guarda de obra que o `CONTAI-064` já usa
   na captura).
2. [x] Nunca sobrescreve vínculo que o Mateus já tenha ajustado manualmente
   em `pagamento_documento` — só cria vínculo **ausente**. Se o pagamento
   já nasce com vínculo explícito (fluxo que já existir hoje), a
   replicação automática não roda por cima.
3. [x] Quitação que resolve N compromissos num só pagamento (fatura de
   cartão com N compras, cada uma com seu próprio
   `documento_origem_id`) gera N linhas em `pagamento_documento` — caso
   `multiplos_documentos` já previsto no desenho da migration `0007`, sem
   invenção de estrutura nova.
4. [x] Diferença entre valor previsto (`compromisso.valor_previsto`) e
   valor efetivamente pago não bloqueia a replicação do vínculo — quem
   decide quanto do vínculo compõe custo continua sendo a regra do mínimo
   (Σ pagamentos × Σ documentos hábeis) de `alocarCusto`
   (`lib/fiscal/vinculo.ts`), intocada por este ticket.
5. [x] RPC valida que `documento_origem_id` pertence ao mesmo `user_id` da
   sessão antes de inserir o vínculo (achado extra do `cto-obra`: a FK
   hoje aceita qualquer uuid existente; a leitura é coberta por RLS, a
   escrita não era validada) — nunca confiar só na FK.
6. [x] Teste unitário/integração: compromisso com `documento_origem_id`
   preenchido, quitado com a mesma obra → `pagamento_documento` ganha a
   linha automaticamente, sem ação manual. Compromisso com obra divergente
   na quitação → nenhuma linha criada, comportamento igual a hoje (sem
   regressão silenciosa). Compromisso quitado que já tinha vínculo manual
   → vínculo manual preservado, replicação não roda.
7. [x] `e2e/privilegios.spec.ts` cobre qualquer RPC alterada, se a mudança
   tocar `security definer`/privilégios novos.
8. [x] Gate Fiscal: `contador` confirma (já pré-aprovado na consulta de
   escopo) que a implementação segue as 5 condições do parecer sem
   adicionar lógica nova de decisão de custo.

---

## ✅ Entregue em 2026-09-26

Gate 4 (`po`), 8/8 critérios PASS. Arquivos finais tocados:

- `supabase/migrations/0020_propagar_vinculo_de_origem.sql` — função
  `propagar_vinculo_de_origem` (as 5 condições do parecer, silêncio nunca
  exceção nos desvios); `fatura_desembolso_gravar`/`fatura_alocar`
  recriadas (`create or replace`, privilégios preservados) chamando-a.
- `lib/data.ts` (`quitarCompromisso`) — chama a RPC quando
  `documentoOrigemId` não é nulo, ANTES do `update` de situação e de
  `mudarDataPrevista` (idempotência de retry).
- `lib/database.types.ts` — regen com `propagar_vinculo_de_origem`.
- `app/(captura)/adicionar/compra-cartao/page.tsx` — texto da tela
  "Agendado" reescrito: a frase antiga mandava religar manualmente o
  vínculo que o app agora faz sozinho; o que continua verdadeiro (nada
  entra em custo aqui) segue escrito.
- `e2e/vinculo-de-origem.spec.ts` (novo, 11 casos — cartão e PIX/boleto,
  N documentos, obra divergente, dono alheio, vínculo manual preservado,
  valor menor que o previsto).
- `e2e/cartao.spec.ts` — asserções do texto reescrito da tela "Agendado".
- `e2e/banco.ts` — `criarCompraCartao` aceita `documentoOrigemId`;
  `plantarDocumentoDeOutroDono`/`contarVinculosSemRls` novos.
- `e2e/privilegios.spec.ts` — `propagar_vinculo_de_origem: "authenticated"`.

Nenhum arquivo mudou depois do último APPROVE do `cto-obra` no Gate 2.
`npm run quality` verde: lint limpo, typecheck limpo, **1125 Vitest** /
**350 Playwright**. Migration `0020` aplicada no stack local.

⚠️ **Esta ticket tem migration** — ordem obrigatória do release:
`npx supabase db push` ANTES de `git push` (regra do `CLAUDE.md`), a
executar pelo orquestrador.

**Dívidas nomeadas — D82 e D83**: (D82) pagamento único que quita dois ou
mais compromissos com `documento_origem_id` distintos propaga o vínculo só
do primeiro compromisso processado — a guarda "não sobrescreve" olha o
pagamento inteiro, não o par documento-pagamento; (D83) `pagamento.status`
não acompanha o vínculo no caminho propagado — fica `aguardando_nf` mesmo
com nota hábil ligada, confirmado sem impacto fiscal. Detalhe completo em
`docs/backlog/81-2026-09-26-contai-065-entregue-e-d82-d83.md`.

## Out of Scope
- A herança na **tela de captura** (favorecido/CNPJ/valor pré-preenchidos
  ao trocar para Cartão) — é o `CONTAI-064`, entregável independente deste.
- Retroagir sobre compromissos **já quitados** antes deste ticket (rodar a
  propagação para pagamentos históricos) — não pedido pelo relato original;
  se algum dia for necessário, é migração de dados própria, com decisão
  explícita do Mateus sobre quais pagamentos tocar.
- Mudar a regra do mínimo (Σ pagamentos × Σ documentos hábeis) de
  `alocarCusto` — intocada; este ticket só garante que o vínculo existe
  para ela consumir.
- UI nova — a UI que já mostra "Ligado a: nota X" em `/pagamento/[id]` e
  `/documento/[id]` já lê `pagamento_documento`; com o vínculo passando a
  existir, ela aparece de graça, sem tela nova.

## Gate Fiscal (Contador)
Fonte: `docs/pareceres/2026-09-26-replicar-vinculo-documento-quitacao.md`.

1. Replicar automaticamente o vínculo na quitação **não é** vínculo por
   heurística (proibido pelo §5 do parecer de 2026-08-17) — é persistência
   de uma afirmação humana já feita no agendamento, mesmo padrão do
   favorecido herdado read-only (ADENDO 2 do mesmo parecer).
2. Condições obrigatórias na implementação (guarda-corpos de produto, não
   regra fiscal nova): só replica com `documento_origem_id` preenchido; só
   replica com obra batendo na hora da quitação; nunca sobrescreve vínculo
   manual; N compromissos → N linhas permitido; diferença de valor não
   bloqueia a replicação.
3. Automático no caso normal (mesma obra, vínculo intacto, sem ajuste
   manual prévio); exige toque humano só nos edge cases já mapeados (obra
   divergente, vínculo manual anterior).

## Pre-mortem
1. **Replicação sobrescreve vínculo manual que o Mateus já tinha
   corrigido.** Guarda: critério 2, só cria vínculo ausente, nunca
   substitui.
2. **Obra muda entre agendamento e quitação, e o vínculo replica mesmo
   assim** (nota de uma obra virando custo de outra). Guarda: critério 1,
   checagem de obra **no momento da quitação**, não no do agendamento.
3. **RPC confia na FK e aceita `documento_origem_id` de outro usuário**
   (mesmo se a FK aceitar o uuid, o dado não é do Mateus). Guarda: critério
   5, validação explícita de `user_id`.

## Viabilidade (CTO)
Achados da consulta de arquitetura prévia (`docs/backlog/78-2026-09-26-
cartao-nao-herda-documento.md`): toca `fatura_desembolso_gravar`,
`fatura_alocar` (migration `0013`, cartão) e `quitarCompromisso`
(`lib/data.ts`, PIX/boleto). Exige migration nova (RPCs mudam de
comportamento) e regen de `lib/database.types.ts`. Tamanho **M** —
confirmar arquivos exatos e desenho da migration com o `cto-obra` no Gate 1
(este ticket nasce com a decisão de escopo fechada, não com o SQL pronto).

## Dependências
- Bloqueado por: nenhum (independente do `CONTAI-064`).
- Bloqueia: nenhum. Sem este ticket, o `CONTAI-064` sozinho deixa D79
  **parcialmente paga** — a captura herda, mas a quitação ainda não
  propaga; a tela "Agendado" do `064` já avisa disso no texto (critério 9
  daquele ticket).

## Perguntas Abertas
Nenhuma — arquitetura e condição fiscal fechadas em consulta prévia
(`cto-obra` e `contador`) antes deste ticket nascer.

## Cenário e checagem final
**Gestão** — mudança de mecanismo interno (RPC de quitação), sem tela
nova; nenhum cenário de captura/canteiro se aplica. Sem mock — não há UI
nova a desenhar (a UI que exibe o vínculo já existe e passa a mostrar dado
que antes faltava).
⚠️ **Esta ticket tem migration** — lembrar da ordem obrigatória no release:
`npx supabase db push` ANTES de `git push` (regra do `CLAUDE.md`).
