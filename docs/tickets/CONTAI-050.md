# CONTAI-050 (011-C) — Dossiê sob demanda, por obra

## Tipo e Prioridade

- **Tipo**: meta 3 (acervo probatório) — completa os critérios 4, 10 e 12
  originais do `CONTAI-011`
- **Prioridade**: **P0** — é a saída que atende a venda e o horizonte de
  guarda longa, porque não depende de agendamento nenhum continuar vivo
  (pre-mortem risco 1 do `CONTAI-011`)
- **Origem**: fatiamento do `CONTAI-011` em 2026-09-23 — ver
  `docs/tickets/CONTAI-011.md` (cabeçalho) e
  `docs/backlog/62-2026-09-23-fatiamento-contai-011.md`
- **Gate 0 (mock)**: herdado do `CONTAI-011.html`/`.md` v1 (aprovado
  2026-08-16) — telas `#s16` (escolher obra) a `#s21` (falhou). **Precisa de
  retoque do `designer`** para o estado novo "pedido não atendido" (ver
  Viabilidade abaixo) e para a recomendação do `cto-obra` de cortar
  compartilhar/revogar nomeado do `#s20` para fora deste ticket.
- **Gate Fiscal**: R3 do parecer `docs/pareceres/2026-08-16-gate-fiscal-contai-011.md`
  (critério 12, discriminação + Pagamentos Efetuados + recibo da DAA), mais
  R6 (conflito: dossiê do comprador não deveria levar a ficha do declarante
  inteira, que soma as duas obras) — **nota de Gate 2, não resolvida ainda**,
  fica para o `cto-obra`/`contador` no Gate 1 deste ticket.

## Dor de Origem

Ver `CONTAI-011` (011-A), seção "Dor de Origem" — o horizonte de guarda
(CTN art. 173, I, indefinido enquanto não houver venda) é maior do que a
vida útil provável de qualquer rotina agendada em free tier (pre-mortem
risco 1). O dossiê sob demanda é a segunda saída que não depende do
schedule continuar vivo: é o que a venda pede, e o que sobrevive ao app.

## User Story

Como dono da obra, quero poder gerar sob demanda o dossiê completo de
**uma** obra — mesmo índice, integridade e conteúdo fiscal da rotina
periódica, mas segmentado — para que a comprovação do custo de aquisição
sirva a mim na declaração e ao comprador e ao contador dele na venda, sem
depender de eu ter clicado em nada antes.

## O achado de arquitetura e a decisão do `cto-obra` (2026-09-23)

O `lead-engineer`, ao tentar o Gate 1 do `CONTAI-011` original, achou que a
Decisão 2 do ticket (service role key e refresh token do Drive **só** em
GitHub Secrets, nunca em env da Vercel) deixava sem resposta "quem roda o
dossiê sob demanda quando o Mateus clica o botão" — o app na Vercel não tem
credencial nenhuma para gerar o pacote nem escrever no Drive.

> Transcrição da decisão do agente `cto-obra`.

**A premissa errada era "quem gera o dossiê"; a certa é "de onde ele é
gerado".** O executor certo é o **mesmo job do 011-A**, trabalhando sobre o
espelho que ele já mantém no Drive: o dossiê é o incremental daquela obra
(Decisão 3 do 011-A, idempotente) + cópia dos arquivos dela para um pacote
próprio + índice + LEIA-ME. **GitHub Actions continua sendo o único
executor**; a Vercel não gera pacote, não toca o Drive, e não ganha nenhuma
das duas credenciais do 011-A. **A Decisão 2 do 011-A fica intacta.**

### Decisão 5 — o pedido mora no banco; o GitHub só é "acordado"

1. **`export_solicitacao`** (migration `0019`, mesmo formato da `0018`):
   `id uuid pk` · `user_id uuid not null default auth.uid()` (aqui o
   escritor É o usuário, ao contrário da `export_execucao`) · `obra_id uuid
   not null references obra` · `tipo text check in ('dossie')` ·
   `criado_em timestamptz not null default now()`. Append-only. RLS:
   `select`/`insert` com `user_id = auth.uid()`; grants revoke-antes-grant:
   `authenticated: select, insert`; `service_role: select`; sem update/delete
   para ninguém. `e2e/privilegios.spec.ts`: `export_solicitacao: "SELECT,
   INSERT"`.
2. **O clique** (`#s17` → `#s18`) é um Route Handler/Server Action que (a)
   valida a sessão pelo cookie `@supabase/ssr`, (b) insere a solicitação
   **pelo client do usuário, sujeito à RLS**, (c) chama `POST
   /repos/<owner>/contai/actions/workflows/export-acervo.yml/dispatches`
   com `{ref:"main"}` e **zero inputs** [Certain: o endpoint devolve 204 e
   não retorna run id — o app não precisa dele].
3. **O workflow não recebe parâmetro nenhum.** Ao rodar (por schedule, por
   dispatch ou pelo botão "Run workflow" da UI do GitHub), o
   `scripts/export-acervo.ts` **drena** todas as `export_solicitacao` sem
   `export_execucao` correspondente, uma a uma, e no schedule semanal faz o
   periódico depois. `concurrency: { group: export-acervo,
   cancel-in-progress: false }` no YAML — dois cliques não geram dois
   dossiês; o app também desabilita o botão enquanto houver pedido aberto
   para aquela obra.
4. **Conclusão**: cada pedido termina com **uma linha** em
   `export_execucao` (`tipo='dossie'`, sucesso ou falha, gravada pelo passo
   `if: failure()` no pior caso). O app **faz polling via PostgREST**
   (10–15 s, só com a tela aberta) e deriva o estado em
   `lib/export/estado.ts` (pura, Vitest, estendida do 011-A): pedido sem
   execução e idade ≤ `LIMITE_PEDIDO_MIN` → `#s18` "gerando, pode fechar";
   execução `sucesso` → `#s19` com link; `falha` → `#s21` com o texto de
   `erro`; pedido sem execução e idade > limite → estado novo **"o pedido
   não foi atendido"** (não existe no mock — `designer` desenha). Realtime
   do Supabase: rejeitado, é publication + config a mais para o que um poll
   resolve.

### A credencial nova — e por que ela NÃO fura a Decisão 2 do 011-A

`GITHUB_DISPATCH_TOKEN`, env **server-only** da Vercel (nunca
`NEXT_PUBLIC_*`, nunca versionada). **PAT fine-grained** da conta do Mateus,
*Only select repositories: contai*, permissão de repositório **Actions: Read
and write** (+ Metadata: read, obrigatório) [Likely: é o que
`workflow_dispatch` exige], nenhuma permissão de conta. Expiração: a maior
que o GitHub permitir [Guessing se "sem expiração" é aceito hoje]; **data de
expiração a registrar no ticket quando o token for criado**.

Classe diferente da Decisão 2 do 011-A, e é isso que a torna aceitável: a
service role lê o acervo inteiro; o token do Drive escreve no storage do
Mateus. **Este PAT não lê um byte de dado fiscal e não escolhe nada** — o
pior que um vazamento faz é acordar um job que atende pedidos que só
existem porque um usuário logado os inseriu sob RLS, com destino no Drive do
próprio Mateus. Por isso a regra **"zero inputs no workflow" é invariante de
segurança, não estilo**: se o dossiê aceitasse `obra_id` ou e-mail por
input, o PAT viraria exfiltração do acervo com CPF de terceiros.

**Decisão 2b (nova, complementa a Decisão 2 do 011-A)**: *a Vercel pode
guardar credencial só se ela não lê dado nenhum e o que ela dispara não
aceita parâmetro.*

**Revogação**: github.com/settings/tokens → revoke; remover a env na Vercel
e redeployar. **Falha do PAT (expirado/revogado) é visível, não silenciosa**:
o dispatch devolve 401/404, o pedido fica gravado e o app diz "pedido
registrado, não consegui acordar a rotina" — com dois caminhos: o schedule
semanal do 011-A drena o pedido, ou o Mateus aperta "Run workflow" na UI do
GitHub (fallback manual, sem credencial nenhuma). **Não** adicionar cron
frequente de polling (ex.: */15 min): milhares de runs/mês para um botão
apertado poucas vezes por ano, e latência de 5–30 min [Likely] no melhor
caso.

### O que muda no `CONTAI-011` (011-A)

- **Nada de schema já decidido lá é revertido.** `export_execucao` ganha,
  **nesta migration (0019)**, `solicitacao_id uuid null references
  export_solicitacao` com `check ((tipo='dossie') = (solicitacao_id is not
  null))`, e `pacote_url text` (o `webViewLink` que o Drive devolve — o app
  entrega o link sem montar URL). O 011-A não precisa esperar por isso.
- O 011-A já entrega `on: workflow_dispatch:` **sem inputs** no
  `export-acervo.yml` (pedido barato do `cto-obra`, incorporado ao 011-A) —
  este ticket só acrescenta o passo de drenagem no script.

### Alternativas rejeitadas (`cto-obra`)

- **Vercel gera o pacote** (sessão do usuário + signed URLs): 0,5–2 GB numa
  função com limite de tempo/memória, egress cheio do Supabase a cada
  dossiê, sem Drive, e duplica em outro runtime o código de índice/
  integridade do 011-A. Uma fonte de verdade para o pacote, não duas.
- **Database Webhook (pg_net) → GitHub API**: o PAT passa a morar na config
  do Supabase, invisível no repo, e não dispara com projeto pausado.
- **Só schedule frequente, sem PAT**: zero credencial, mas UX de 5–30 min e
  milhares de runs vazios.

## Critérios de Aceite

1. [ ] O export é **segmentável por obra** (critério 4 original): produz-se
   o pacote de UMA obra sem o acumulado das outras (`where obra_id = X`, de
   graça pela Decisão 0 do 011-A).
2. [ ] **Export sob demanda** (critério 10 original): o Mateus dispara pelo
   app e recebe o pacote completo de uma obra — mesmos índice, integridade
   e segmentação dos critérios do 011-A — via o mecanismo da Decisão 5.
3. [ ] **(R3 do contador)** Por ano-calendário, o pacote carrega a
   discriminação de Bens e Direitos como declarada (por matrícula), a lista
   de Pagamentos Efetuados como declarada (CPF por CPF) e o recibo de
   entrega da DAA. Enquanto a US-004 não existir, atendido por espaço
   reservado + menção no LEIA-ME.
4. [ ] **Resolver o conflito R6 antes do Gate 1 fechar**: a ficha de
   Pagamentos Efetuados é do declarante e soma as duas obras — decidir com o
   `contador`/`cto-obra` se o dossiê de uma obra só leva essa ficha inteira,
   uma versão filtrada, ou se o critério 3 vale só para o acervo próprio do
   Mateus (não o dossiê do comprador).
5. [ ] Pedido sem execução correspondente por mais de `LIMITE_PEDIDO_MIN`
   mostra o estado "pedido não atendido" — nunca fica girando pra sempre.
6. [ ] Herda do 011-A: destino privado (critério 11), LEIA-ME (critério 13),
   imutabilidade do pacote de ano fechado (critério 14).
7. [ ] `GITHUB_DISPATCH_TOKEN` documentado no `.env.example` com escopo
   exato e caminho de revogação (mesma exigência do critério 9 do 011-A).

## Notas herdadas do mock, ainda sem decisão (`cto-obra`, 2026-09-23)

- **`#s20` "entregar" com acesso nomeado e revogável exige token do Drive →
  também viraria pedido na fila.** Recomendação do `cto-obra`: **cortar do
  011-C** — o app entrega o link do pacote e o texto de consequência fiscal
  (R8), e o compartilhamento nomeado + revogação é feito **na UI do Drive**,
  que já faz isso no celular. Critério 11 continua verificável (janela
  anônima). Se o `po` quiser isso em-app depois, é
  `tipo='compartilhar'`/`'revogar'` na mesma `export_solicitacao` — fila já
  comporta, mas é ticket próprio. **Decisão do `po`: aceita a recomendação —
  cortado deste ticket.**
- `#s18` não terá progresso real (o job não reporta etapas) — barra
  indeterminada + "pode fechar, o pedido continua". Texto do estado novo
  "não atendido há N min" é trabalho do `designer`.
- `#s21` "gerar assim mesmo, com a falta declarada": no desenho da Decisão 5
  o pedido é atômico (sucesso ou falha); uma saída "com falta declarada"
  seria flag no pedido — **decisão do `contador`, ainda em aberto**: essa
  saída existe mesmo, ou o critério 5 do 011-A (falhar alto) prevalece
  também aqui?
- [Likely] Cada dossiê é cópia integral e imutável (critério 14) →
  **consome cota do Drive linearmente** (15 GB comportam poucos dossiês de
  2 GB). Aceitável porque dossiê é evento de venda, não rotina — mas o app
  deve mostrar `bytes` no `#s19` e o ticket deve dizer isso por extenso.
  Zip único vs. pasta: decisão de Gate 1, sem consequência de mecanismo.

## Dependências

- **`CONTAI-011` (011-A)** — fonte da tabela `export_execucao`, do módulo de
  índice/destino, e do workflow com `workflow_dispatch` já habilitado.
  Este ticket não entra em Gate 1 antes do 011-A estar em produção (reusa o
  runtime dele).
- **`CONTAI-003`** — entregue; é o que dá `obra_id` em `documento`/
  `pagamento`, pré-requisito do critério 1 (segmentação).
- **US-004 (relatórios)** — o critério 3 só fica completo quando ela existir.

## Fora de Escopo

- Compartilhar/revogar acesso ao dossiê dentro do app — cortado para ticket
  futuro (ver "Notas herdadas do mock" acima).
- Tudo o que já está fora de escopo do `CONTAI-011` (011-A): restaurar
  acervo, expurgo, verificação de legibilidade, captura de escritura/ITBI/
  matrícula/etc.

## Complexidade: **M**

Migration `0019` (`export_solicitacao` + alteração da `0018`) · route
handler de disparo · drenagem no `scripts/export-acervo.ts` ·
`lib/export/estado.ts` estendida · 3 telas + 1 estado novo. Ordem de
release: `0019` por `db push` antes do merge, como sempre.

## Veredicto (po, 2026-09-23)

**Destravado pelo `cto-obra`**, mas **não "pronto para `/develop`" ainda**:
falta (a) o `contador`/`cto-obra` resolverem o conflito R6 (critério 4
acima), (b) o `contador` decidir se "gerar assim mesmo" existe, (c) o
`designer` desenhar o estado "pedido não atendido" e remover `#s20` do
escopo. Nenhum dos três é bloqueio de arquitetura — a Decisão 5 já resolve o
mecanismo inteiro. Entra na fila atrás do 011-A e do 011-B.
