# CONTAI-061 Anexar comprovante tardiamente a pagamento já registrado (D56)

## Tipo e Prioridade
feature — P1 (mantida — o `contador` não vê CRC bloqueado nem prazo
vencendo hoje). Materializa a dívida **D56**, nomeada desde
`docs/backlog/29-2026-08-24-reconciliacao-contai-009.md`, agora confirmada
também como lacuna de backend (não só de UI).

## Dor de Origem
`docs/backlog/74-2026-09-26-anexo-tardio-comprovante-pagamento-d56.md`.
Palavras do Mateus: *"não consigo anexar o comprovante de pagamento nesta
tela"* — reação a `/pagamento/[id]` (pagamento com "sem comprovante" em
vermelho), tentando resolver de verdade a pendência real "Custo em risco
no IR" que a Home aponta (achado 2 do backlog 73, já esclarecido: o
sistema estava certo em não contar esse pagamento como custo confirmado —
faltava só um jeito de anexar o comprovante que ele já tinha em mãos).

Confirmado por leitura de código: não existe controle de upload na tela, e
não existe nenhuma função de escrita no backend para gravar
`comprovantePath` depois da criação do pagamento — só existe no fluxo de
criação (`criarPagamento`). É lacuna de capacidade, não de UI escondida.

## User Story
Como dono da obra, revisando pendências em casa, sentado, quando encontro
um pagamento "pago sem comprovante" pro qual já tenho o comprovante em
mãos, quero anexá-lo em `/pagamento/[id]`, para que o pagamento saia de
"Custo em risco no IR" e passe a custo confirmado no ano em que foi de
fato pago.

## Critérios de Aceite
1. [ ] Card "PAGO SEM COMPROVANTE" em `/pagamento/[id]` ganha uma ação
   "Anexar comprovante" (mesmo padrão visual do botão "Ligar a uma nota"
   do card irmão de "sem nota") → leva a `/pagamento/[id]/comprovante`.
2. [ ] Subpágina nova `/pagamento/[id]/comprovante`: guarda de reentrada
   (se o pagamento já tem comprovante, mostra banner e nada mais); campo
   de anexo simples (`CampoArquivo` + `subirParaAcervo(arquivo,
   "comprovante")`, mesmo padrão já testado) — **sem nenhuma pergunta
   fiscal** (diferente de `/documento/[id]/anexar`, que pergunta CPF/
   retenção; comprovante de pagamento não pergunta nada disso).
3. [ ] Antes de confirmar a gravação, a tela calcula e mostra o delta —
   reusa `lib/fiscal/revisao.ts::anosAfetadosDeUmaObra`/`abrePendencia`
   (mesma função e mesmo layout "antes → depois" de
   `/documento/[id]/corrigir/valor`), simulando o pagamento com
   `comprovantePath` preenchido.
4. [ ] Sem pendência de "ano já declarado": confirmação simples, um clique
   grava. Com pendência: mostra o aviso citando literalmente
   `AVISO_ANO_ANTERIOR`/`SO_SEI_QUE_E_ANO_ANTERIOR` (constantes já
   existentes em `lib/fiscal/revisao.ts`, mesmo texto que
   `corrigir/valor` já usa) antes de confirmar — nunca redige texto fiscal
   novo.
5. [ ] RPC nova (`anexar_comprovante_pagamento` ou nome equivalente
   decidido pelo `cto-obra`) só grava se `comprovante_path is null` —
   segunda tentativa contra um pagamento que já tem comprovante falha
   explicitamente (não sobrescreve). Trigger de imutabilidade no banco
   garante isso mesmo se alguém tentar um UPDATE direto pela tabela, não
   só pela RPC.
6. [ ] A gravação registra rastro completo (entidade, campo `comprovante`,
   antes `null`, depois o path, ato, motivo) na mesma tabela `revisao` que
   já guarda correções de documento — precisa de migration ampliando o
   `check` de `revisao` para aceitar `campo = 'comprovante'` em
   `entidade = 'pagamento'`, e um novo valor de `motivo_revisao`
   (`comprovante_chegou_depois`) em migration própria e anterior (não pode
   ser criado na mesma transação em que é usado).
7. [ ] Teste unitário: pagamento com `data_pagamento` de ano anterior,
   comprovante anexado no ano corrente → custo confirmado aparece no ano
   do PAGAMENTO, nunca no ano do anexo — trava o regime de caixa.
8. [ ] Pagamento sem nenhuma nota vinculada: anexar o comprovante não muda
   `custoComprovado` (não há documento hábil pra contar) → `anos` afetados
   vazio → sem pendência de ano anterior. Comportamento correto, não bug —
   vira teste, não crítica.
9. [ ] `e2e/privilegios.spec.ts` ganha as duas entradas novas (a RPC e a
   função de trigger) — tabela nova de privilégios não fica sem `GRANT`
   explícito.
10. [ ] Gate Fiscal: `contador` confirma que todo texto de tela é cópia
    literal do parecer/constantes já existentes, nunca parafraseado.

## Out of Scope
- Extensão a `documento` (já resolvido por `anexar_arquivo_documento`) ou a
  `favorecido` vazio (recusado pelo `contador` no Gate 4 do `CONTAI-009`).
- `fatura_desembolso.comprovante_path` tem a mesma lacuna — fica fora
  deste ticket, registrada como dívida nova **D56-b**.
- Proxy real de "DAA do ano X entregue em DD/MM/AAAA" — dívida separada,
  nomeada desde 2026-08-18; este ticket usa o proxy improvisado atual
  (`anoCorrente`/heurística já existente) como está.
- Decidir ou redigir retificadora — é CRC, fora do produto por desenho.
- Mudar `alocarCusto`/regime de caixa — mecanismo de alocação por ano já
  está correto (`CONTAI-056`); este ticket só destrava a entrada do
  comprovante.

## Gate Fiscal (Contador)
Fonte: `docs/pareceres/2026-09-26-anexo-tardio-de-comprovante-d56.md`
(§1-§3) + `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md`
(§5 rastro, §6 detector "ano já declarado", reaproveitados).

1. Anexo tardio não muda validade documental (IN 84/2001 art. 17) nem o
   prazo de decadência (CTN 173, I) — o documento vale desde quando o
   pagamento foi feito, não desde quando foi anexado.
2. A DATA DO ANEXO é rastro obrigatório (mesmo mecanismo de toda correção
   de campo já gravado, parecer 2026-08-18 §5) — nunca usada para calcular
   ano de custo.
3. Custo sempre conta no ano do PAGAMENTO, nunca no ano do anexo (regime
   de caixa). Se a DAA do ano do pagamento já foi entregue quando o anexo
   chega: mostra delta, grava, abre pendência persistente de avaliar
   retificadora com CRC (app nunca decide/redige sozinho). Se ainda não
   foi entregue: grava sem drama.

## Pre-mortem
1. **RPC vira porta de edição disfarçada.** Guarda: só grava se
   `comprovante_path is null`; trigger de imutabilidade no banco impede
   sobrescrita mesmo por UPDATE direto — não é só promessa da RPC.
2. **Data do anexo vaza pro cálculo de ano.** Critério 7 trava com teste
   que ancora pagamento de ano anterior e confirma custo no ano do
   pagamento, nunca no ano do anexo.
3. **App decide sozinho se precisa de retificadora.** A tela só mostra
   delta, grava, e abre pendência pro CRC avaliar — nunca conclui nem
   redige.

## Viabilidade (CTO)
- **Migration (`0018`)**: não cria coluna de data do anexo separada — o
  metadado É o rastro de `revisao.quando` (já existe, `timestamptz`,
  migration 0009), evitando duplicar "quando" em dois lugares. Precisa:
  (a) ampliar o `check` de `revisao` para aceitar `campo = 'comprovante'`
  quando `entidade = 'pagamento'` (hoje só admite `obra`/`vinculo`); (b)
  novo valor de enum `motivo_revisao = 'comprovante_chegou_depois'`, em
  migration própria anterior (limite do Postgres: não dá pra usar um valor
  de enum na mesma transação em que ele é criado); (c) trigger
  `pagamento_comprovante_path_imutavel` (cópia do padrão de
  `documento_arquivo_path_imutavel`, migration 0014) — sem ele, "só grava
  se null" é só promessa da RPC, não do banco, já que `pagamento` tem
  UPDATE liberado para `authenticated` desde a 0005. Nenhuma tabela nova.
- **RPC**: `anexar_comprovante_pagamento(p_pagamento_id uuid,
  p_comprovante_path text, p_anos jsonb) returns uuid` (o id do "ato",
  mesmo padrão de `mover_pagamento_de_obra`). `select ... where
  comprovante_path is null for update` → não encontrado ⇒
  `raise exception`; `update`; `insert into revisao`;
  `perform revisao_gravar_anos`. `security invoker`, `set search_path`,
  revoke `public`/`anon`, grant `authenticated`. **Não copiar** os checks
  fiscais de `anexar_arquivo_documento` (nota no CPF etc.) — comprovante de
  pagamento não pergunta isso, o parecer D56 não pede.
- **Detector reusado sem adaptação**: `lib/fiscal/revisao.ts`,
  `anosAfetadosDeUmaObra`/`abrePendencia`; `alocarCusto`
  (`lib/fiscal/vinculo.ts`) já zera o elegível quando `comprovantePath` é
  `null`, então o delta aparece só simulando o pagamento com o path
  preenchido — sem lógica nova. Padrão de chamada já existe em
  `/documento/[id]/corrigir/valor/page.tsx`.
- **UI**: `CampoArquivo` (`app/_components/campos.tsx`) +
  `subirParaAcervo(arquivo, "comprovante")` (`lib/data.ts`) — o mesmo par
  já usado em `/documento/[id]/anexar`. Subpágina nova
  `/pagamento/[id]/comprovante` (não input inline — o passo de mostrar o
  delta antes de gravar não cabe num controle inline).
- **Arquivos e complexidade — M**: `supabase/migrations/0018*.sql` (1-2
  arquivos), `lib/database.types.ts` (regen), `lib/data.ts`
  (`anexarComprovantePagamento`), `lib/types.ts` (união de `Revisao.campo`
  ganha `'comprovante'`, rótulo no histórico), `app/(gestao)/pagamento/[id]/
  comprovante/page.tsx` (novo), `app/(gestao)/pagamento/[id]/page.tsx`
  (link novo), `e2e/privilegios.spec.ts`, `e2e/pagamento-comprovante-
  tardio.spec.ts` (novo).
- **Dívida nova**: **D56-b** — `fatura_desembolso.comprovante_path` (0013)
  tem a mesma lacuna, fora deste ticket.

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma — mecanismo decidido pelo `cto-obra`, fluxo decidido pelo
`designer`, condição fiscal ratificada pelo `contador`.

## Cenário e checagem final
**Gestão** — correção pontual feita em casa, sentado, não é fluxo de
captura no canteiro. Teste do Canteiro não se aplica. **Veredito:
APROVADO**, Gate 0 fechado em `design/mocks/CONTAI-061.md` (nível 2).
⚠️ **Esta ticket tem migration** — lembrar da ordem obrigatória no release:
`npx supabase db push` ANTES de `git push` (regra do `CLAUDE.md`).
