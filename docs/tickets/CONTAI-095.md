# CONTAI-095 Colaborador cria compromisso; trava estrutural contra pagamento automático

## Tipo e Prioridade
feature — P1 — completa o escopo de papéis do relato 109 (engenheiro também
agenda compromissos de pagamento, não só cadastra nota). Depende de
`CONTAI-093`.

## Dor de Origem
`docs/backlog/109-2026-10-14-engenheiro-acesso-multiusuario.md`, correção do
próprio Mateus: "essa pessoa já colocaria a data do vencimento, adicionaria a
nota e todos os detalhes [...] Daí eu adiciono o pagamento ou agendamento de
pagamento" — corrigido por ele mesmo para deixar claro que o
agendamento/compromisso também pode ser feito pelo engenheiro; só a
confirmação do pagamento fica exclusiva do Mateus.

## User Story
**Como** o engenheiro da obra, **quero** criar um `compromisso` (vencimento,
valor previsto, favorecido, nota de origem) direto no sistema quando fecho um
serviço ou uma compra, **para que** o Mateus já tenha o agendamento pronto
para revisar e confirmar — e **como** o Mateus, **quero** ter certeza
absoluta de que nenhuma ação do colaborador pode, por si só, registrar um
pagamento como feito, mesmo que ele informe uma data vencida, **para que** eu
nunca descubra um "pagamento" fantasma na minha apuração.

## Critérios de Aceite

1. [ ] Rota nova e exclusiva `/adicionar/compromisso` para o colaborador —
   mesmos campos do ramo de agendamento já existente em `/adicionar/pagamento`
   (favorecido, CNPJ/CPF, valor previsto, vencimento, nota de origem
   opcional), **sem** passo de comprovante (o ramo de agendamento de hoje já
   não pede comprovante). A tela **nunca** usa a palavra "pagamento" em
   nenhum momento (nem formulário, nem confirmação final).
2. [ ] **A bifurcação por data não existe nesta rota.** Toda submissão produz
   `compromisso` com `situacao = 'aberto'`, mesmo com vencimento no passado
   ou "hoje" — **nunca** produz `pagamento`, em nenhuma circunstância. Isto é
   garantido em três camadas, da mais forte para a mais fraca:
   (a) **banco**: `pagamento` permanece `insert/update with check (user_id =
   auth.uid())`; o trigger `user_id_da_obra` (`CONTAI-093`) grava `user_id =
   obra.user_id` (o dono) antes do check — um INSERT de colaborador em
   `pagamento` é recusado pela RLS mesmo que um bug de UI chame
   `criarPagamento`; (b) **rota**: `/adicionar/compromisso` não importa
   `decidirRegistro` nem `criarPagamento` — a função que decide entre
   compromisso e pagamento fica fisicamente fora do alcance desta tela; (c)
   **teste-trava** Vitest (padrão `lib/agenda/reconciliacao.test.ts`):
   varredura de `app/(captura)/adicionar/compromisso/` proibindo os
   literais `decidirRegistro`, `criarPagamento`,
   `subirParaAcervo(.*"comprovante"`.
3. [ ] RLS de `compromisso`: mesma partição de `documento` (`CONTAI-094`
   critério 2) — `select` por dono/visibilidade, `insert with check
   (criado_por = auth.uid())`, `update` só dono (colaborador não corrige o
   que criou; qualquer resposta ao compromisso — mudar data, confirmar
   pagamento, cancelar — é sempre ato do Mateus). `compromisso_documento_previsto`
   (pré-vínculo) ganha `insert` para colaborador — pré-vínculo é intenção,
   não custo (ADENDO 6 §J.1 de
   `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`).
   `compromisso_data_historico`/`compromisso_valor_historico` continuam
   dono-only (derivam de correção, que é sempre do Mateus).
4. [ ] `/compromisso/[id]`: quando o compromisso foi criado por colaborador,
   mostra "criado por {nome}" (mesmo padrão tipográfico secundário das
   demais telas de autoria desta rodada); os botões de resposta/confirmação
   de pagamento **não aparecem** para o colaborador — ausência condicional
   ao papel de quem está vendo a tela (RLS de `update`/`pagamento` já barra
   no nível de dados; a UI não é a única trava).
5. [ ] `app/api/google/agenda/*` (`CONTAI-092`) recusa (403) qualquer
   requisição de usuário com papel colaborador — hoje `integracao_google` é
   por `user_id = auth.uid()`; sem essa trava, um colaborador com visão
   total poderia conectar a própria agenda e sincronizar compromissos do
   Mateus.
6. [ ] GRANT: nenhum verbo novo em `compromisso`/
   `compromisso_documento_previsto` (já têm os verbos necessários);
   `e2e/privilegios.spec.ts` atualizado se houver trigger/função nova nesta
   fatia.
7. [ ] E2E novo (`e2e/colaborador-compromisso.spec.ts`, Postgres local,
   client autenticado): colaborador cria compromisso com vencimento no
   passado e ele nasce `situacao = 'aberto'`, nunca `pagamento`; tentativa
   direta de `criarPagamento` pelo client do colaborador é recusada pela
   RLS (erro de permissão, não "0 linhas"); `/compromisso/[id]` não mostra
   botão de confirmar pagamento para o colaborador; `app/api/google/agenda/*`
   devolve 403 para sessão de colaborador.

## Out of Scope
- Qualquer caminho, automático ou manual, que produza `pagamento` a partir
  de uma entrada do colaborador — recusado estruturalmente (critério 2), não
  é decisão a reabrir neste ou em ticket futuro sem novo Gate Fiscal.
- Reembolso ao colaborador que eventualmente pague com recursos próprios —
  mesma nota do Gate Fiscal do `CONTAI-094`: se esse padrão existir na
  prática, a tela de confirmação de pagamento do Mateus precisaria perguntar
  explicitamente "este valor saiu da sua conta ou foi reembolso a alguém que
  pagou por você" (campo vazio pergunta, não assume) — não implementado
  aqui porque o relato não descreve esse padrão.
- Colaborador corrigir compromisso que criou (data, valor, cancelamento) —
  sempre ato do Mateus, com o mesmo rastro de correção já existente.

## Gate Fiscal (Contador)

**1. Toca regra fiscal?** Sim — regime de caixa (quem pode afirmar que "o
dinheiro saiu") e a classificação de compromisso como custo zero.

**2. Regras — "se X e Y → Z":**
- **Se** o colaborador cria compromisso com data no passado ou qualquer
  indicação equivalente a "já paguei" → **recusar** qualquer caminho de
  código que produza `pagamento` a partir dessa entrada, independentemente
  da data informada; **marcar** o registro como "compromisso aberto,
  pendente de confirmação do Mateus". Fundamento: a condição 1 do custo de
  aquisição (`docs/pareceres/2026-08-17-vinculo-pagamento-documento.md` §1)
  exige desembolso do **declarante** (o Mateus); o colaborador não é o
  declarante, então nenhuma entrada dele pode, por si, constituir o fato "o
  dinheiro saiu". **Isto é mais restritivo que a branch "data ≤ hoje →
  pagamento" já aplicada ao fluxo do dono** (`lib/fiscal/compromisso.ts`,
  `decidirRegistro`, documentada no parecer
  `docs/pareceres/2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md`
  §1) — essa branch **não pode ser herdada tal qual** para o colaborador; a
  rota exclusiva (critério 1-2) é a forma de implementar essa recusa sem
  tornar a função pura condicional a um parâmetro de autoria (ver
  Viabilidade).
- **Se** o compromisso é criado pelo colaborador → tratado exatamente como
  compromisso criado pelo dono para fins de custo: zero, fora de toda soma,
  sujeito às mesmas regras de `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`
  (§1-§2) — nenhuma regra nova, autoria não altera a natureza do registro.
- **Se** vai confirmar/registrar `pagamento` → **recusar** essa ação para
  qualquer identidade que não seja o Mateus, em UI **e** em RLS/API — não é
  cosmético, é a trava que sustenta a regra anterior (critério 2 deste
  ticket implementa isso).

**3. Automático × revisão humana.**
- **Automático**: classificar compromisso de colaborador como custo zero,
  igual ao do dono; recusar estruturalmente qualquer produção de `pagamento`
  a partir de entrada do colaborador.
- **Só o Mateus, sempre**: confirmar/registrar `pagamento`; responder ao
  compromisso (mudar data, cancelar, confirmar).
- **Trava adicional, não automação a menos**: o fluxo do colaborador não tem
  — e não pode ter — a branch de "data ≤ hoje → pagamento" que o fluxo do
  dono tem. Não é "mesma automação, outro usuário"; é um caminho de código
  que simplesmente não existe para autoria de colaborador.

**4. Sem parecer novo necessário** — as duas regras citadas (condição 1 do
custo de aquisição; compromisso custo zero) já estão em
`docs/pareceres/2026-08-17-vinculo-pagamento-documento.md` §1 e
`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` §1-§2,
respectivamente; este Gate Fiscal só aplica regra existente a um autor novo,
sem reinterpretar nenhuma das duas.

## Pre-mortem
1. **Um refactor futuro reaproveita o componente de formulário entre
   `/adicionar/pagamento` e `/adicionar/compromisso`** sem preservar a
   ausência estrutural de `decidirRegistro`/`criarPagamento` — a trava do
   critério 2 depende de a rota do colaborador nunca importar essas funções;
   um "unificar os dois formulários parecidos" desfaria a garantia sem que
   ninguém perceba até um pagamento fantasma aparecer. Mitigado pelo
   teste-trava (critério 2c), que fica vermelho pelo nome do arquivo se isso
   acontecer.
2. **Colaborador com visão total conecta a própria agenda Google e
   sincroniza compromissos do Mateus** sem que o Mateus saiba — mitigado
   pelo critério 5, mas é uma superfície que só foi lembrada porque o
   `cto-obra` leu o `CONTAI-092` de propósito; qualquer integração futura
   por `user_id = auth.uid()` tem o mesmo risco se não for revisada contra
   papel de colaborador.
3. **O texto da tela de confirmação final usa a palavra "agendamento" de um
   jeito que soa como confirmação oficial** (o app hoje já usa essa palavra
   em outros contextos com sentido de "reconhecido"), fazendo o colaborador
   pensar que terminou algo que na verdade ainda espera o Mateus — mitigado
   por manter a redação explícita "aberto, aguardando o dono" (critério 1),
   com texto exato ainda em aberto (ver Perguntas Abertas).

## Viabilidade (CTO)
- **Modelo de dados**: nenhuma tabela nova. Migration `0032`: split de RLS
  em `compromisso`/`compromisso_documento_previsto` (mesmo molde de
  `CONTAI-094`).
- **Decisão arquitetural central**: a trava fica **fora** de
  `decidirRegistro` (função pura em componente `"use client"`), nunca
  **dentro** dela como um parâmetro de autoria — pôr "autoria" dentro da
  função pura reproduziria o defeito do campo `status` que o parecer de
  18/08 §2 proíbe: um flag que todo chamador tem de lembrar de passar
  certo. A garantia real mora na RLS de `pagamento` (camada a, critério 2) e
  na rota nunca importar a função (camada b); a função pura em si continua
  dono-exclusiva **por localização**, não por parâmetro.
- **Arquivos**: `supabase/migrations/0032_compromisso_colaborador.sql`,
  `app/(captura)/adicionar/compromisso/page.tsx` (rota nova, reaproveitando o
  formulário do ramo de agendamento de `/adicionar/pagamento` sem a
  bifurcação de data nem o passo de comprovante), `app/(gestao)/compromisso/[id]/page.tsx`
  (autoria + ocultação de botões), `app/api/google/agenda/*` (gate de
  papel), `e2e/colaborador-compromisso.spec.ts`, `e2e/privilegios.spec.ts`.
- **Complexidade: M.**
- **Dívidas**: nenhuma nova além das já registradas em `CONTAI-093`/`094`.

## Dependências
Bloqueado por `CONTAI-093`. Independente de `CONTAI-094`/`CONTAI-096`.

## Perguntas Abertas
1. Texto exato da tela de confirmação ao final de `/adicionar/compromisso`
   (designer).
2. O campo "nota de origem" (vínculo opcional com documento existente): qual
   é o widget hoje dentro de `/adicionar/pagamento` (autocomplete, lista,
   tela própria)? Se for tela própria, ela precisa de uma variante restrita
   ao escopo de documentos visíveis para aquele colaborador quando a
   visibilidade é "restrita" (designer, pergunta 2).
3. Ao desligar a bifurcação de data: o formulário é o mesmo componente React
   com uma prop a menos, ou é um componente duplicado? Não muda o que a
   tela mostra, mas muda o que o `lead-engineer` deve tratar como
   "reaproveitado" vs. "novo" no Gate 1 (designer, pergunta 3).

## Cenário e checagem final
**Captura**, pelo colaborador — mesma pressa potencial e mesmo orçamento de
interação que o ramo de agendamento já tem hoje; este ticket não aumenta o
número de perguntas da tela, só muda quem pode abri-la e em qual rota. Ganha
o mesmo tratamento desktop de `captura-no-desktop-v1.md`, sem a seção de
anexo/dropzone (não há arquivo para subir nesta tela). `/compromisso/[id]`
com a autoria é tela de **gestão** do dono, revisão sentada.

Varredura de condição fiscal órfã: as três condições citadas amarram a
pareceres existentes (`2026-08-17-vinculo-pagamento-documento.md` §1,
`2026-08-18-compromisso-versus-pagamento.md` §1-§2,
`2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md` §1) —
nenhuma condição nova sem parecer.

Veredito: **APROVADO**, condicionado às Perguntas Abertas 1-3 (não bloqueiam
a trava estrutural, só detalhes de UI e reaproveitamento de componente).

---

## Design (nível 1)
Descrição completa em `design/mocks/CONTAI-095.md`: a rota é tecnicamente
nova, mas o formulário reaproveita o que o ramo de agendamento de
`/adicionar/pagamento` já tem hoje — a descrição aponta o que se reaproveita
literalmente e descreve só o que é de fato diferente (sem bifurcação de
data, sem passo de comprovante, texto de confirmação explícito sobre
"aberto, aguardando o dono").
