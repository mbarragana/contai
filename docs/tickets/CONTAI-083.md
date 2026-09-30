# CONTAI-083 Desfazer a origem herdada de um agendamento

## Tipo e Prioridade
Bug/Feature — **P0** (proposto pelo `po`, confirmado pelo `contador`) — o
gatilho real não é uma data-limite, é a **confirmação do primeiro pagamento**:
enquanto os 3 compromissos afetados continuarem "aberto", a correção é
leve; se qualquer um for pago antes deste ticket, o vínculo errado é
gravado de verdade e o problema sai de escopo (viraria CONTAI-021).

## Dor de Origem
Relato: `docs/backlog/99-2026-09-30-desvincular-origem-herdada-compromisso.md`.

Caso real confirmado em produção (favorecido "Ilhamix Concreto Ltda"): 3
compromissos de R$15.000,00 (`situacao='aberto'`, vencimentos 15/10, 15/11,
15/12/2026) têm a MESMA origem herdada (`documento_origem_id`), apontando
todos para a NF nº 1531 (R$30.340,00). As outras 2 notas do mesmo
favorecido (NF 1541, R$29.760,00; NF 1543, R$16.240,00) nunca recebem
prova de pagamento, porque cada compromisso, ao ser pago, resolve N=1 (só
a origem) e converte automaticamente para a 1531, três vezes (ADENDO 7
§K.2). Hoje não existe NENHUMA tela que permita mudar ou remover
`documento_origem_id` depois da criação — o problema só foi visível
consultando o banco direto.

## User Story
Como dono da obra, quando eu perceber que um agendamento ainda em aberto
herdou a origem errada na criação, quero uma ação explícita para desfazer
esse vínculo, para declarar depois o vínculo correto pela tela de
pré-vínculo já existente, em vez de o sistema confirmar sozinho, no
pagamento, uma ligação que eu já sei que está errada.

## Critérios de Aceite
1. [x] Proposta nível 1 (rota nova) + nível 2 (3 telas existentes) em
   `design/mocks/CONTAI-083.md`.
2. [x] Rota nova `/compromisso/[id]/origem` ("Desfazer a nota de origem"),
   mesmo molde de `/compromisso/[id]/cancelar` — card de consequência
   ANTES do clique, `RodapeDeAcao` com "Desfazer a origem" + "Voltar sem
   salvar". SEM campo de motivo (ADENDO 9 §M.4: duas colunas de auditoria
   bastam, sem pedir texto).
3. [x] Card de consequência mostra a nota resolvida (favorecido, tipo,
   número, valor) e o texto verbatim do ADENDO 9: o que muda ("este
   agendamento deixa de ligar sozinho a esta nota na confirmação") e o que
   NÃO muda ("custo de aquisição inalterado", "base INSS inalterada",
   "esta nota continua em 'Notas hábeis sem pagamento vinculado'").
4. [x] CTA novo `BotaoLink` "Desfazer a nota de origem" em
   `/compromisso/[id]`, logo depois de "Ligar notas a este agendamento" e
   antes de "Mudou a data", visível só quando `situacao === "aberto" &&
   documentoOrigemId !== null`.
5. [x] A ação NUNCA se aplica a compromisso com `situacao !== "aberto"` —
   recusa TOTAL (nem tenta gravar), banner âmbar se a rota for acessada
   diretamente, mesmo padrão do CONTAI-080 para cartão. Verbo: recusar
   (ADENDO 9 §M.5).
6. [x] A ação NUNCA se aplica quando `documentoOrigemId === null` (nunca
   teve origem, ou já foi desfeita) — mesma recusa total, banner âmbar.
7. [x] Migration `0025`: `compromisso` ganha `origem_desfeita_id uuid
   references documento(id)` e `origem_desfeita_em timestamptz`, com CHECK
   garantindo que os dois são preenchidos juntos
   (`(origem_desfeita_id is null) = (origem_desfeita_em is null)`) e CHECK
   garantindo que desfeita implica origem nula
   (`origem_desfeita_id is null or documento_origem_id is null`) — o
   "escrito uma vez, desfeito no máximo uma vez" do ADENDO 9 §M.4, em SQL.
8. [x] Sem GRANT novo — `compromisso` já tem `UPDATE` de tabela para
   `authenticated` desde a migration `0007`, que cobre a coluna nova;
   `e2e/privilegios.spec.ts` não precisa de edição no mapa (só confirmar
   que continua verde).
9. [x] Função `desfazerOrigemDoCompromisso` (`lib/data.ts`) faz UM
   `update` condicional: `documento_origem_id = null`,
   `origem_desfeita_id = <origem antiga>`, `origem_desfeita_em = now()`,
   filtrado por `id`, `situacao = 'aberto'` E `documento_origem_id =
   <origem antiga>` no mesmo `WHERE` — 0 linhas afetadas é erro nomeado
   ("o agendamento mudou enquanto você olhava — foi pago/cancelado em
   outra aba, ou a origem já foi desfeita"), nunca sucesso silencioso.
10. [x] Guarda de domínio `podeDesfazerOrigem(compromisso)` nova em
    `lib/fiscal/compromisso.ts` (mesmo padrão de `podePreVincular`), com
    os dois motivos nomeados (`ORIGEM_SO_EM_ABERTO`, `ORIGEM_NAO_HA`) —
    tela e função de gravação leem a MESMA guarda. Testada.
11. [x] Depois de desfeita, `/compromisso/[id]/pre-vincular` **não muda de
    comportamento** (a origem já não existe, `origem === null`, o card
    "Nota de origem — herdada" simplesmente para de renderizar — zero
    mudança de lógica) — só a `Dica` do card, enquanto a origem ainda
    existe, ganha a frase "Quer parar de ligar esta nota automaticamente?
    Desfazer a origem." com link para a rota nova.
12. [x] Depois de desfeita, `/compromisso/[id]` mostra uma linha "Nota de
    origem desfeita em DD/MM/AAAA — Nota nº X" dentro do card do fato já
    existente (não é card novo), condicionada a `origemDesfeitaId !==
    null`.
13. [x] `documentosResolvidosNaConfirmacao`/`idsDaUniaoDoPreVinculo`
    (CONTAI-080) NÃO mudam — já leem `documentoOrigemId` do compromisso
    atual; `null` depois da remoção já produz N=0 (fluxo padrão de "Ligar
    a uma nota", sem automação) sem nenhuma alteração nessas funções.
14. [x] NUNCA auto-cria pré-vínculo no mesmo ato de desfazer a origem
    (ADENDO 9 §M.2) — remoção e nova declaração são dois atos deliberados
    e separados; combiná-los recriaria o mesmo N=1 com a mesma nota
    errada.
15. [x] Sem alerta proativo de "mesma origem em N compromissos + soma >
    valor da nota" neste ticket — decisão adiada (ADENDO 9 §M.6), fica
    para ticket futuro de detecção.

## ✅ Entregue — 2026-09-30
Pipeline completo: Gate 1 (lead-engineer, DONE) → Gate 2 (cto-obra +
contador, APPROVE após 1 retrabalho não-funcional: rota nova faltando no
mapa de `e2e/campos-fiscais.spec.ts`) → Gate 3 (coberto pelos E2E já
rodados nos Gates 1/2 — caminho feliz, erro e edge cases) → Gate 4 (po,
PASS nos 15 critérios). Typecheck/lint limpos, 1341 testes unitários
verdes, suíte E2E verde (`desfazer-origem.spec.ts` 5/5,
`campos-fiscais.spec.ts` 20/20, `privilegios.spec.ts` 6/6). Nenhuma
mudança de escopo em relação ao ticket original.

## Out of Scope
- **Rateio automático entre notas** — recusado; doutrina do ADENDO 6 não
  muda.
- **Qualquer ação sobre pagamento já feito** — acervo append-only
  (CONTAI-009); nenhum dos 3 compromissos do caso real tem pagamento.
- **O sistema decidir sozinho qual nota é a certa** — a escolha continua
  sendo do Mateus, via pré-vínculo, depois de desfazer.
- **Alerta proativo de origem compartilhada** — ticket futuro (ver
  critério 15).
- **Trigger de banco pra `situacao`** — a guarda é app + `WHERE`
  condicional no mesmo `UPDATE` (defesa em profundidade sem RPC nova);
  dívida nomeada se um dia "banco vale para qualquer caminho" for exigido
  também para `cancelar`/`mudar data` (ver Viabilidade).

## Gate Fiscal (Contador)
Regra completa: `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`,
**ADENDO 9** (§M.0-M.8):
- Desfazer `documento_origem_id` de compromisso `aberto` sem pagamento é
  fiscalmente seguro sem ressalva — nenhum fato consumado existe pra
  desfazer (§M.1).
- Mecanismo: só limpar (`null` + auditoria), nunca auto-converter em
  pré-vínculo no mesmo ato (§M.2) — evita recriar o mesmo N=1 com a mesma
  nota errada.
- N cai pra 0 depois da remoção — efeito desejado, não colateral (§M.3).
- Auditoria: duas colunas bastam, não tabela de histórico (§M.4).
- Recusa total (nem tenta) para `situacao !== 'aberto'` (§M.5).
- Sem alerta proativo neste ticket, condicionado a "Notas hábeis sem
  pagamento vinculado" continuar visível na revisão pré-declaração — já é
  (§M.6).
- **Prioridade P0** confirmada, com o gatilho certo sendo a confirmação do
  primeiro pagamento, não uma data de calendário (§M.7/M.8) — mitigação
  imediata registrada em memória do projeto: segurar a confirmação dos 3
  pagamentos da Ilhamix até este ticket entrar em produção.

## Pre-mortem
1. **Degradar a propagação automática que funciona no caso comum**: a
   ação é deliberada e pontual sobre um compromisso específico já
   identificado como errado — não um novo passo de confirmação universal.
   Mitigado pelo critério 4 (CTA só aparece quando há origem a desfazer).
2. **"Desfazer" virar apagamento silencioso do histórico**: mitigado pelo
   critério 7 (colunas de auditoria, nunca UPDATE que perde o rastro).
3. **Estado pós-remoção ambíguo**: mitigado pelo critério 13 (N=0 cai no
   fluxo padrão já existente, visível como qualquer compromisso sem
   pré-vínculo) e pelo critério 12 (linha de auditoria visível no
   detalhe).

## Viabilidade (CTO)
- **Onde a ação vive**: rota própria `/compromisso/[id]/origem`, não
  botão inline nem seção dentro de `/pre-vincular` — toda mutação de
  compromisso já é rota própria com card de consequência
  (`/cancelar`/`/data`/`/valor`/`/pre-vincular`/`/confirmar`); embutir em
  `/pre-vincular` quebraria o critério 15 do CONTAI-080 ("nenhuma linha
  desta tela a toca") e misturaria dois atos deliberados num só Salvar.
- **Migration**: `0025_compromisso_origem_desfeita.sql` — 2 colunas + 2
  CHECKs, sem índice (nenhuma tela consulta por essa coluna ainda), sem
  GRANT novo.
- **Gravação**: UPDATE condicional com `situacao`+`documento_origem_id`
  no mesmo `WHERE` (fecha a corrida "carreguei aberto, mudou em outra
  aba, cliquei" sem precisar de RPC) — 0 linhas afetadas é erro nomeado.
- **Modelo de dados**: 2 colunas novas em `compromisso`, sem tabela nova.
- **Arquivos**: `supabase/migrations/0025_compromisso_origem_desfeita.sql`
  (novo), `lib/database.types.ts` (regen), `lib/types.ts`,
  `lib/dados/comum.ts`, `lib/fiscal/compromisso.ts` (+ `.test.ts` —
  `podeDesfazerOrigem`), `lib/data.ts`
  (`desfazerOrigemDoCompromisso`), `app/(gestao)/compromisso/[id]/origem/page.tsx`
  (novo), `app/(gestao)/compromisso/[id]/page.tsx` (CTA + linha de
  auditoria), `app/(gestao)/compromisso/[id]/pre-vincular/page.tsx` (Dica
  + link), `e2e/desfazer-origem.spec.ts` (novo — aberto+origem grava e
  chip some; quitado recusa; sem origem recusa; desfazer duas vezes dá
  erro nomeado sem tocar a coluna).
- **Complexidade: S** (tela pequena no molde de `/cancelar`, um
  statement, migration aditiva).
- **Dívidas criadas**: guarda de `situacao` só no app + `WHERE`, sem
  trigger, para as 3 ações de compromisso (cancelar, mudar data, desfazer
  origem) — nomeada, não corrigida aqui; detecção proativa de origem
  compartilhada (ADENDO 9 §M.6) — ticket futuro.
- **Dívida herdada, registrada no Gate 2 e explicitamente fora deste
  ticket**: a linha de auditoria de `origemDesfeitaEm` formata a data com
  `.slice(0, 10)` sobre o timestamp em **UTC**, então um desfazimento
  feito depois das 21h BRT pode aparecer com a data do dia seguinte. É a
  mesma dívida das duas linhas de histórico já em produção
  (`/compromisso/[id]` e `fila-pendencias.tsx`) — o Gate 2 decidiu que
  não é regressão nem bloqueio aqui. Correção futura: um único helper de
  data local para as três linhas de uma vez, não um remendo nesta tela.

## Dependências
Bloqueado por / Bloqueia: nenhum. Depende conceitualmente do mecanismo de
pré-vínculo do CONTAI-080/081 (reaproveitado depois da remoção, sem
modificá-lo).

## Perguntas Abertas
Nenhuma.

## Cenário e checagem final
**Gestão** (desfazer origem, em casa, sentado). Serve à meta 2
(relatórios anuais prontos): evita que a discriminação anual/Pagamentos
Efetuados saiam com uma nota superavaliada em prova e outras notas hábeis
órfãs, sem aviso antes da declaração. Sem condição fiscal órfã — toda
condição cita o ADENDO 9. Sem UI que quebre disciplina de campo fiscal
(não há campo digitável; a tela é confirmação de ação, sem motivo).
**Veredito: APROVADO.** Pronto para `/develop`, com prioridade P0.
