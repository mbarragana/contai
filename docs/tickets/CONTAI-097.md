# CONTAI-097 Comprovante opcional no registro da fatura paga · parcial (D56-b, ponta A)

## Tipo e Prioridade
feature — P1 — fricção de processo recorrente (não P0: o `contador` já
descartou risco fiscal). Materializa a ponta "raiz" da dívida **D56-b**,
nomeada no "Out of Scope" do `CONTAI-061.md`, agora com dor real medida (7
`pagamento`s numa única fatura, 4+ uploads redundantes do mesmo arquivo).

## Dor de Origem
`docs/backlog/110-2026-10-15-reaproveitar-comprovante-fatura-parcial.md`.
Caso real: fatura de cartão em 3 desembolsos parciais gerou 7 `pagamento`s a
favorecidos diferentes (Ilhamix Concreto; Casas Da Água Mat. — 3 lojas). O
Mateus usou "Fatura paga · parcial" (`/fatura/[id]/parcial` →
`/fatura/[id]/alocar`), que não captura comprovante nenhum — o PIX/
transferência real cobrindo a fatura precisou ser anexado DEPOIS, um a um,
em cada `pagamento`, via `/pagamento/[id]/comprovante` (CONTAI-061):

> "temos que adicionar este fluxo agora para eu não precisar subir
> novamente o mesmo comprovante de pagamento 4 vezes e poder só vincular
> ao que acabei de subir."

**Achado que reduz este ticket a troca de UI, sem migration**: as RPCs
`fatura_desembolso_gravar` e `fatura_alocar`
(`supabase/migrations/0024_fatura_propagar_por_n.sql:113-116,132-138,187-189,200-206`)
**já propagam** o `comprovante_path` do desembolso para TODOS os `pagamento`s
que geram — é o mesmo mecanismo já em produção no caminho "fatura paga
integral" (denormalização deliberada, não bug). `lib/data.ts::
registrarDesembolsoDeFatura` já aceita `comprovantePath: string | null` e já
o repassa à RPC. A lacuna é só que `/fatura/[id]/parcial`
(`app/(gestao)/fatura/[id]/parcial/page.tsx`) nunca oferece esse campo —
sempre chama com `null`.

## User Story
Como o Mateus, conciliando em casa, sentado, uma fatura de cartão paga em
desembolsos parciais que geram vários `pagamento`s a favorecidos diferentes,
quando eu já tenho em mãos o comprovante real daquele desembolso (um PIX/
transferência cobrindo o valor todo) no momento de registrar a fatura como
paga parcialmente, quero subir esse arquivo uma única vez em
`/fatura/[id]/parcial`, para que ele seja propagado automaticamente a todos
os `pagamento`s que a alocação gerar dali — sem custar um upload por
favorecido.

## Critérios de Aceite
1. [ ] `/fatura/[id]/parcial` ganha um campo de anexo **opcional**
   (`CampoArquivo`, rótulo "Comprovante deste pagamento (opcional)", ajuda
   "PDF, foto ou print — se você tiver à mão agora. Pode anexar depois, no
   detalhe do pagamento.", `accept=".pdf,image/*"`), dentro do `Card` já
   existente de data/valor (terceiro campo do mesmo formulário, não uma
   `Card` nova) — spec em `design/mocks/CONTAI-097.md`.
2. [ ] `podeSalvar` não muda: o anexo nunca entra na condição de habilitar
   "Salvar" — ausência de arquivo não bloqueia a gravação, em nenhum caso.
3. [ ] Em `salvar()`, se houver arquivo selecionado: `subirParaAcervo(arquivo,
   "comprovante")` roda ANTES de `registrarDesembolsoDeFatura` (mesma ordem
   já usada em `/fatura/[id]/confirmar/page.tsx:249-259,374`), e o
   `comprovantePath` resultante substitui o `null` fixo de hoje no payload.
4. [ ] Dado o Mateus preenche o anexo e confirma, quando a RPC
   (`fatura_desembolso_gravar`, e depois `fatura_alocar` ao alocar) grava os
   `pagamento`s daquele desembolso, então TODOS eles recebem o MESMO
   `comprovante_path` informado — verificável por dois ou mais `pagamento`s
   da mesma alocação apontando ao mesmo `comprovante_path` no banco, sem
   criar objeto novo no Storage por `pagamento`. Capacidade já implementada
   nas RPCs (0024); este critério é de verificação por E2E, não de código
   novo nas RPCs.
5. [ ] Dado o Mateus NÃO preenche o anexo, quando confirma, então o
   comportamento é byte-a-byte o de hoje: `pagamento`s gerados com
   `comprovante_path = null`, cada um elegível ao fluxo retroativo
   (CONTAI-061/CONTAI-098) depois — zero regressão.
6. [ ] Falha no upload do anexo (antes de chamar a RPC): mesmo banner de
   erro já usado pela tela (`mensagemDeErroDeGravacao`); o estado volta a
   `"pronto"` com `data`, `valor` e o **arquivo selecionado preservados** —
   não força escolher o arquivo de novo numa nova tentativa.
7. [ ] Nenhuma pergunta fiscal nova (CPF, retenção) é introduzida por este
   campo — ele é só um anexo probatório opcional.
8. [ ] Navegação de sucesso inalterada:
   `/fatura/${fatura.id}/alocar?desembolso=${desembolsoId}`.
9. [ ] E2E novo (`e2e/fatura-parcial-comprovante.spec.ts`, contra o Postgres
   local) cobre: (a) registrar o parcial COM anexo → alocar 2+ compromissos
   → os `pagamento`s gerados compartilham o mesmo `comprovante_path`; (b)
   registrar SEM anexo → `pagamento`s com `comprovante_path = null`, sem
   regressão no fluxo atual.
10. [ ] Vitest: nenhuma função pura nova é necessária nesta ponta (a
    propagação já é comportamento de RPC existente) — este critério existe
    para registrar explicitamente que o Gate 2 não deve esperar um teste
    unitário de `lib/fiscal/` para este ticket; a prova é só E2E (critério 9).

## Out of Scope
- **Campo de anexo em `/fatura/[id]/alocar`** (o segundo passo da raiz, DEPOIS
  de o desembolso já estar criado) — decisão do `cto-obra`: o comprovante de
  um desembolso nasce no ato de pagar; quem não o tem em `/parcial`
  normalmente ainda não o tem minutos depois em `/alocar`. O caso "decidiu
  anexar dias depois" é coberto pelo caminho retroativo (CONTAI-098), não por
  este ticket. Cobrir também `/alocar` exigiria uma RPC nova de "anexar
  tardiamente ao desembolso" (reabriria a própria D56-b original) — fora de
  escopo aqui, registrado como dívida nova na Viabilidade.
- **Qualquer mudança em `fatura_desembolso_gravar`/`fatura_alocar`** — a
  propagação já existe; este ticket só passa a exercitá-la pela UI.
- **Reaproveitar comprovante entre `pagamento`s já existentes** (fluxo
  retroativo) — é o **CONTAI-098**, ticket irmão, sem dependência técnica
  entre os dois.
- **Verificar o exportador do CONTAI-011 contra comprovante compartilhado**
  — o comportamento "mesmo `comprovante_path` em N `pagamento`s" já existe em
  produção desde o caminho "fatura integral"; se o exportador duplica por
  `pagamento` em vez de por `comprovante_path` distinto, é correção do
  `CONTAI-011`, não deste ticket (ele não cria a condição, só a exercita mais).

## Gate Fiscal (Contador)
**Sem impacto fiscal direto.** Toca documentação hábil apenas na medida em
que destrava, pela UI, uma capacidade de propagação de `comprovante_path`
que **já é o padrão aprovado em produção** no caminho "fatura paga integral"
(mesma denormalização deliberada). Não é caso fiscal novo.

- Nenhuma pergunta de CPF, retenção ou qualquer dado de documentação hábil é
  introduzida — o campo é upload opcional, mesmo tratamento de
  `/pagamento/[id]/comprovante` (CONTAI-061): "**Não copiar** os checks
  fiscais de `anexar_arquivo_documento`... comprovante de pagamento não
  pergunta isso."
- Nenhum texto fiscal novo é necessário nesta tela (campo opcional, sem
  afirmação).
- Automático × humano: a propagação do `comprovante_path` para os N
  `pagamento`s é **automática** quando o campo é preenchido — mesmo
  mecanismo já em produção no `fatura_alocar`/`fatura_desembolso_gravar`,
  sem decisão fiscal nova a tomar a cada alocação. O ato de preencher o
  campo e clicar "Salvar" continua sendo sempre humano e explícito.

## Pre-mortem
1. **O campo existe mas ninguém o usa.** Por ser opcional e sem destaque
   entre data e valor, e por o Mateus raramente ter o arquivo em mãos no
   exato momento de registrar o desembolso (fluxo natural: paga primeiro,
   organiza comprovante depois), a fricção de N uploads pode continuar
   idêntica mesmo com o critério 1-5 "fechado" no papel — só que agora
   mascarada como resolvida. Mitigação: nenhuma neste ticket (é decisão de
   produto, não de código); vale medir no Gate 4/uso real se o CONTAI-098
   (retroativo) continua sendo o caminho predominante.
2. **Export para o Google Drive (CONTAI-011) duplica o arquivo N vezes.**
   Se o exportador iterar por `pagamento` em vez de por `comprovante_path`
   distinto, N `pagamento`s com o mesmo path geram N cópias no Drive —
   contradizendo a premissa "é o mesmo arquivo, exportado uma vez" do
   relato de origem. Não é dívida nova deste ticket (a condição já existe
   desde o caminho integral), mas fica registrada para o `CONTAI-011`.
3. **Falha de upload no meio do "Salvar" deixa o Mateus sem saber se o
   desembolso foi gravado sem o anexo.** Mitigado pelo critério 6 (upload
   roda ANTES da RPC; falha de upload nunca chega a gravar o desembolso —
   ou os dois aconteceram, ou nenhum).

## Viabilidade (CTO)
- **Modelo de dados**: nenhuma migration. `fatura_desembolso.comprovante_path`
  já existe (migration 0013) e já é propagado por `fatura_desembolso_gravar`/
  `fatura_alocar` (0024). `registrarDesembolsoDeFatura` (`lib/data.ts`) já
  aceita `comprovantePath: string | null`.
- **Arquivos**: `app/(gestao)/fatura/[id]/parcial/page.tsx` (campo + upload
  antes da RPC); `e2e/fatura-parcial-comprovante.spec.ts` (novo).
- **Complexidade: S.** Troca de UI pura sobre capacidade de backend já
  existente e já testada noutro caminho (fatura integral).
- **Dívida nova**: anexar tardiamente a um `fatura_desembolso` já criado
  (entre `/parcial` e `/alocar`, ou depois de `/alocar` sem ter alocado
  ainda) continua sem RPC — D56-b, na parte que este ticket não fecha, fica
  mitigada (não resolvida) pelo caminho retroativo via `pagamento`
  individual (CONTAI-098). Sem link persistido `pagamento ↔
  fatura_desembolso` (nenhuma coluna registra qual desembolso gerou qual
  `pagamento`) — qualquer feature futura de "anexar/corrigir por desembolso"
  depende de criar essa coluna; registrado aqui como dívida arquitetural,
  não bloqueante.

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: nenhum. **Sem dependência técnica com o CONTAI-098** (ticket
  irmão, mesma dívida D56-b, ponta retroativa) — não compartilham código nem
  migration; a ordem de entrega é por valor/custo (este é mais barato), não
  por bloqueio.

## Perguntas Abertas
Nenhuma. Decisão de não cobrir `/alocar` com campo próprio está registrada
e justificada em "Out of Scope" e na Viabilidade.

## Cenário e checagem final
**Gestão** — pagar fatura de cartão é ato de conciliação bancária em casa,
sentado, nunca o instante de uma compra no canteiro. O "Teste do Canteiro"
não se aplica.

Varredura de condição fiscal órfã (`grep -rniE` do `/tickets-req`): nenhuma
condição fiscal nova citada sem parecer — este ticket não introduz regra
fiscal, só exercita capacidade já aprovada.

Veredito: **APROVADO**.

---

## Design (nível 2)
Spec completo em `design/mocks/CONTAI-097.md`. Campo opcional dentro do
`Card` existente de `/fatura/[id]/parcial`, reusando byte-a-byte o padrão já
em produção de `/fatura/[id]/confirmar` (`CampoArquivo` +
`subirParaAcervo("comprovante")`). Cenário gestão. Sem campo fiscal novo.
