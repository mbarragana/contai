# CONTAI-087 Anexo de prova em linha de retenção adicionada depois do registro

## Tipo e Prioridade
feature — **P1**. No caso real, a linha de retenção nasce sempre amarrada
a um gate flip do CONTAI-086 (a linha só existe depois que o gate
reabre) — o cenário "isolado" (gate já "destacada", linha esquecida)
existe mas é mais raro e tem regra mais restrita.

## Dor de Origem
`docs/backlog/101-2026-10-05-correcao-nota-substituida-com-retencao-nova.md`,
Dor 1: `BlocoRetencao` não tem nenhum campo de anexo para uma linha de
retenção adicionada a um documento já registrado — não existe caminho,
dentro da disciplina do app (anexo visível + afirmação), para anexar um
documento novo a um já registrado quando a correção é só de composição de
retenção.

## User Story
Como dono da obra, quando descubro depois do registro que uma nota tem
retenção que a versão original não tinha, quero provar essa linha com o
documento que revelou isso, para que a pendência de "quem recolhe" não
fique sem lastro documental.

## Critérios de Aceite
1. [ ] Mesmo mock do CONTAI-086 (`design/mocks/CONTAI-086.md`) — não cria
   spec próprio, é a mesma tela/fluxo (`cto-obra`: 086 e 087 são o mesmo
   Gate 1).
2. [ ] Linha nascida **dentro** da correção do CONTAI-086 (passo 3, gate
   muda para "destacada") → `revisao_id` = revisão do gate, mesmo
   `ato_id`, motivo herdado automaticamente, nenhuma pergunta extra.
3. [ ] Linha tardia com gate **já** "destacada" e **zero** linhas
   (`faltaRegistrarLinha`): se existe uma `revisao` com
   `campo='retencao_na_nota'` e `depois='destacada'` para o documento, a
   linha nova amarra a essa revisão (motivo herdado, sem pergunta nova).
   Se **não existe** nenhuma `revisao` assim (documento sempre foi
   "destacada" desde a captura, só faltou preencher a linha) → é
   **primeira afirmação**: `revisao_id null`, sem motivo.
4. [ ] Linha tardia com gate "destacada" **e** ≥1 linha **já** gravada
   (caso isolado) → RPC nova `adicionar_linha_retencao_registrada(p_documento_id
   uuid, p_linha jsonb, p_motivo motivo_revisao, p_motivo_texto text
   default null, p_anexo_path text default null) returns uuid`: grava
   `revisao` (`entidade='documento'`, `campo='linha_retencao'`,
   `antes=null`, `depois=`JSON da linha, `motivo`), linha nova em
   `documento_retencao` com esse `revisao_id`, anexo conforme motivo
   (critério 5).
5. [ ] Anexo **CONDICIONAL** nesta RPC: `motivo = emitente_corrigiu_a_nota`
   → **RECUSA** sem anexo. `motivo = erro_de_digitacao_minha`/`outro` →
   sem upload novo, com checkbox de revalidação ("o valor está visível na
   nota já anexada"). `motivo = comprovante_chegou_depois` → **RECUSA**
   (é motivo de comprovante de pagamento, não se aplica aqui).
6. [ ] O `Repeater` (`retencao.tsx`) **para de chamar `criarLinhaRetencao`
   direto** em documento registrado com ≥1 linha — abre
   `/documento/[id]/corrigir/retencao` em modo "só linha" (gate mostrado
   como afirmado, sem opção de mudar, só adicionar linha com
   anexo/revalidação).
7. [ ] `criarLinhaRetencao`/`criarLinhasRetencao` (INSERT direto)
   **continuam intocadas** para o fluxo de captura (`/adicionar/documento`)
   e `/anexar` (CONTAI-033) — zero mudança de comportamento ali.
8. [ ] "Anos afetados" nunca se aplica — mesma doutrina do CONTAI-086
   (retenção não move custo nem aferição).
9. [ ] Migration `0028` (**compartilhada com o CONTAI-086**) — **sem**
   extensão do enum `entidade_revisao` (a identidade da linha vai no JSON
   de `depois`, não em `entidade` nova).

## Out of Scope
- **Criar a peça de schema genérica `documento_anexo` "universal"
  (CONTAI-049/050)** — projeto próprio, em espera por razão independente;
  este ticket não o reabre.
- **Anexo em linha adicionada no MESMO ato do registro original** — já
  coberto pelo fluxo normal do CONTAI-038, fora daqui.
- **Ciclo de vida do comprovante de pagamento da guia de ISS** — lacuna
  separada (parecer `2026-10-02`, §5).
- **Detecção automática de "dado visível no anexo original"** — não é
  detectável por código; o motivo escolhido é o proxy, e a tela diz isso
  com todas as letras.

## Gate Fiscal (Contador)
Regra nova, construída sobre peça já existente no schema (`motivo_revisao`
já tem `comprovante_chegou_depois`).

- **Anexo CONDICIONAL**: se o dado da linha (rótulo, valor retido) **NÃO**
  é visível/conferível no anexo original já existente → **RECUSAR** salvar
  sem anexar o documento novo no mesmo ato. Se o dado **JÁ** é
  visível/conferível no anexo original → **NÃO** exige upload novo;
  **REVALIDAR** (reexibir o anexo + afirmação de reconferência) antes de
  salvar.
- **Rastro**: criação não tem "antes" — não usa literalmente o padrão de
  6 colunas das correções de campo. Mas `createdAt` sozinho **não basta**:
  falta "por que a linha aparece só agora" (mesma pergunta de auditor do
  parecer §5). Quando nasce dentro de uma correção já rastreada
  (CONTAI-086), reaproveita o motivo automaticamente. Quando nasce
  isolada, só é legítima se o dado já bate com o anexo original — senão o
  caminho correto é abrir o CONTAI-086, nunca criar a linha "a seco".
- **Primeira linha de um documento cujo gate foi respondido na captura é
  afirmação original, não correção** (critério 3) — `revisao_id null`,
  sem motivo.
- Doutrina de aferição INSS/custo de aquisição: **intocada** — confirmado,
  nenhum critério a viola.

Automático: reaproveitar motivo de uma correção de documento já em
andamento no mesmo ato; recusar linha isolada cujo dado não bate com o
anexo já gravado (empurrar para o CONTAI-086); gravar `createdAt`. Só o
Mateus: a afirmação de reconferência quando o dado já está no anexo
original.

## Pre-mortem
1. **Dois mecanismos de "anexo adicional" convivendo sem necessidade.**
   Mitigado por ser implementado junto com o CONTAI-086 (mesmo Gate 1),
   não em ordem separada — evita UI/modelo divergentes só por ordem de
   chegada.
2. **Default de obrigatoriedade inventado.** Mitigado pela regra
   condicional explícita (critério 5) e pelo motivo como proxy explícito
   na tela, nunca decidido por conveniência de implementação.
3. **Sequenciamento.** Depende funcionalmente do CONTAI-086 (só existe
   `LinhaRetencao` para anexar prova depois que o gate reabre, ou quando
   o gate já é "destacada"). Mitigado por serem o mesmo Gate 1.

## Viabilidade (CTO)
- **Modelo de dados**: mesma migration `0028` do CONTAI-086 — campo
  próprio (`documento_retencao.revisao_id`), **sem** extensão do enum
  `entidade_revisao` (seria irreversível e desnecessária — `entidade_id`
  continua sendo o documento).
- **RPC nova** `adicionar_linha_retencao_registrada(...)` — distinta de
  `corrigir_gate_retencao` (CONTAI-086), mas na mesma migration.
- **Banco não distingue primeira afirmação de linha tardia por trigger**
  — a guarda é de código (`Repeater` + RPC) e de E2E, não de constraint
  (heurísticas de trigger — tempo, existência de anexo — dão falsa
  confiança). **Dívida nomeada, não corrigida aqui.**
- **Arquivos**: migration `0028` (compartilhada), `lib/data.ts`
  (`adicionarLinhaRetencaoRegistrada`), `lib/fiscal/retencao.ts` (textos),
  `lib/dados/comum.ts` (mapear `revisaoId`), `lib/types.ts`,
  `retencao.tsx`, `corrigir.tsx`, `corrigir/retencao/page.tsx`
  (compartilhada com o 086), `documento/[id]/page.tsx`,
  `e2e/privilegios.spec.ts`, `e2e/corrigir-retencao.spec.ts`
  (compartilhado com o 086).
- **Complexidade: M isolado**, implementado no mesmo Gate 1 que o
  CONTAI-086 (L combinado).

## Dependências
Bloqueado por: **CONTAI-086** (mesmo Gate 1 — não entra no `/develop`
como ciclo separado em sequência; é parte do mesmo ciclo de
implementação). Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma.

## Cenário e checagem final
**Gestão**. Serve à meta 1 (lastro documental da pendência de retenção).
Sem condição fiscal órfã. Sem UI que quebre disciplina de campo fiscal.
**Veredito: APROVADO.** Pronto para `/develop` — junto com o CONTAI-086,
mesmo Gate 1.
