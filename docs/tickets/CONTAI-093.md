# CONTAI-093 Colaborador na obra: vínculo, RLS de leitura, autoria e gestão de acesso

## Tipo e Prioridade
feature (arquitetura) — P1 — base estrutural do relato 109; sem esta fatia,
`CONTAI-094`/`095`/`096` não têm onde pousar (dependência de arquitetura, não
escolha de prioridade de produto).

## Dor de Origem
`docs/backlog/109-2026-10-14-engenheiro-acesso-multiusuario.md`: o engenheiro
da obra manda nota por WhatsApp/e-mail e o Mateus baixa e sobe manualmente —
duas pessoas, duas etapas manuais, risco de a nota atrasar ou nunca entrar no
sistema. Esta fatia entrega a base sem a qual nenhum colaborador consegue
logar, ser visto pela obra, ou ter o acesso gerenciado.

## User Story
**Como** o Mateus, que delega a um engenheiro de confiança parte das compras e
do acerto de serviços da obra, **quero** conceder acesso próprio a
colaboradores (por e-mail, sem convite) com visibilidade configurável
(restrita ou total da obra) e poder revogar esse acesso quando quiser, **para
que** eu possa trazer mais de uma pessoa a operar no sistema sem abrir mão do
controle de quem vê o quê, nem perder o rastro de quem cadastrou cada
registro mesmo depois de essa pessoa sair.

## Critérios de Aceite

1. [ ] Tabela nova `obra_colaborador` (migration `0030_obra_colaborador.sql`):
   `id uuid pk`, `obra_id` (FK `obra`, `on delete cascade`), `user_id` (dono
   que concedeu, `default auth.uid()`), `email text not null` (gravado
   `lower(trim())`, `check (email = lower(email))`), `nome text not null`
   (como o Mateus chama a pessoa — aparece em "criado por"),
   `colaborador_user_id uuid references auth.users(id)` (nullable, sem
   cascade), `visibilidade` do tipo enum novo `visibilidade_colaborador`
   (`'restrita' | 'total'`, **sem default no banco** — a UI pré-seleciona
   "restrita", mas nenhum chamador pode inserir sem decidir), `concedido_em
   timestamptz not null default now()`, `removido_em timestamptz`.
2. [ ] `unique (obra_id, email) where removido_em is null`. Índices:
   `(colaborador_user_id) where removido_em is null`, `(obra_id)`.
3. [ ] Remover acesso é `update removido_em = now()`, **nunca** `DELETE` — a
   linha é a única fonte de nome/e-mail para o rastro de autoria depois que o
   colaborador sai (critério 11). Readmitir a mesma pessoa cria linha nova.
4. [ ] RLS de `obra_colaborador`: `select` quando `user_id = auth.uid()`
   (dono) **ou** `colaborador_user_id = auth.uid()` (o próprio colaborador lê
   seu vínculo — é como o app descobre papel e visibilidade); `insert`/
   `update` só pelo dono (`with check exists (select 1 from obra where
   id = obra_id and user_id = auth.uid())`). A policy de `select` **não**
   referencia `obra` (recursão de policy é recusada pelo Postgres).
5. [ ] GRANT explícito para `obra_colaborador` (`INSERT,SELECT,UPDATE`,
   revoke-antes-grant) na própria migration, e `e2e/privilegios.spec.ts`
   atualizado com a tabela nova e com as funções de trigger/helper desta
   fatia (ver critérios 6-8) — regra do projeto para toda tabela/função nova.
6. [ ] Colunas novas `criado_por uuid not null default auth.uid() references
   auth.users(id)` (sem `on delete cascade`), `revisado_em timestamptz`,
   `revisado_por uuid references auth.users(id)` em `documento` e
   `compromisso`, com backfill `criado_por = user_id` nos registros
   existentes. Trigger `criado_por_imutavel` (`before update`, mesmo molde de
   `documento_arquivo_path_imutavel` da migration `0009`): nenhum UPDATE pode
   mudar `criado_por` depois de gravado — o rastro de autoria sobrevive a
   `corrigir_documento`, quitação e qualquer correção futura.
7. [ ] Trigger `user_id_da_obra` (`before insert` em `documento` e
   `compromisso`, `security definer`, `set search_path = ''`): força
   `new.user_id := (select user_id from obra where id = new.obra_id)`.
   `documento.user_id = obra.user_id` passa a ser invariante de banco, não só
   convenção de código — é o que faz o registro do colaborador nascer no
   acervo do dono, nunca no dele.
8. [ ] Função `visibilidade_na_obra(p_obra_id uuid) returns
   visibilidade_colaborador` (`security definer stable`, `null` quando o
   usuário não é colaborador daquela obra): lê `obra_colaborador where
   colaborador_user_id = auth.uid() and removido_em is null`. É a **única**
   função usada por todas as policies desta fatia e das fatias `094`/`095`/
   `096` — nenhuma policy duplica essa leitura (doutrina CONTAI-072: fonte
   única, nunca duas funções calculando a mesma coisa).
9. [ ] RLS de `obra`: a policy única `dono_obra for all` é dividida em
   `obra_select` (`user_id = auth.uid() or visibilidade_na_obra(id) is not
   null`) e `obra_escrita` (insert/update só dono). Colaborador passa a ver a
   obra (nome, cidade) — nada além disso nesta fatia.
10. [ ] Tela de gestão de colaboradores (dono), em
    `app/(gestao)/obras/[id]/colaboradores/page.tsx`: formulário sempre
    visível no topo (nome, e-mail, visibilidade pré-selecionada "restrita" —
    não é campo fiscal, pré-seleção visível é aceitável aqui, diferente da
    proibição de default em campo fiscal); lista de colaboradores ativos com
    nome, e-mail, seletor de visibilidade inline e botão "Remover acesso"
    com diálogo de confirmação (ação irreversível na prática, mesmo que o
    banco preserve o registro). 4 estados (loading/vazio/erro/sucesso) —
    descrição completa em `design/mocks/CONTAI-093.md`.
11. [ ] Primeiro acesso por e-mail, os dois casos, sem RPC e sem service key:
    (a) e-mail já tem conta no Supabase Auth → trigger `before insert` em
    `obra_colaborador` (`security definer`) resolve `colaborador_user_id`
    pelo e-mail em `auth.users` na hora, vínculo já nasce ativo; (b) e-mail
    ainda não tem conta → vínculo nasce com `colaborador_user_id = null` e a
    tela avisa que falta criar a conta no dashboard (Authentication → Users,
    Auto Confirm, mesmo e-mail) — passo fora do app, texto exato em
    `design/mocks/CONTAI-093.md`. Trigger `after insert` em `auth.users`
    (`security definer`, função em `public`) resolve automaticamente
    qualquer vínculo pendente (`colaborador_user_id is null`) quando a conta
    nascer depois — qualquer ordem entre vínculo e conta converge sem ação
    do app.
12. [ ] Shell/área do colaborador logado: rota nova fora de `(gestao)` e
    `(captura)`, lista as obras em que a pessoa colabora (nome, cidade — sem
    CNO/números fiscais) com "nada a fazer ainda" nesta fatia; **nunca**
    renderiza Home, `/despesas`, `/pendencias` ou relatórios anuais — ausência
    estrutural, não botão escondido. Teste-trava Vitest (padrão
    `lib/agenda/reconciliacao.test.ts`): varredura dos arquivos dessa área
    proibindo import de `lib/fiscal/resumo` e de qualquer módulo de saída
    anual.
13. [ ] Revogar acesso (`removido_em`) não apaga, não desvincula e não altera
    `criado_por` em nenhum `documento`/`compromisso` já criado pelo
    colaborador — permanecem íntegros, e o nome dele continua exibível (lido
    de `obra_colaborador` mesmo com `removido_em` preenchido).
14. [ ] `supabase/seed.sql` ganha um segundo usuário de desenvolvimento
    (`engenheiro@contai.local`, mesmo molde do usuário existente) para
    viabilizar o E2E de colaborador; `e2e/banco.ts` ganha
    `sessaoDoColaborador()` (mesma receita de sessão autenticada já usada
    para o dono).
15. [ ] E2E novo (`e2e/colaborador.spec.ts`, Postgres local, client
    autenticado — nunca stub): (a) colaborador vê a obra depois do vínculo e
    deixa de ver depois de `removido_em`; (b) vínculo criado antes da conta
    existir liga sozinho quando a conta é criada depois (ordem inversa
    também testada); (c) `obra_colaborador` de uma obra não aparece para
    colaborador de outra obra; (d) colaborador não consegue `insert`/`update`
    em `obra_colaborador` (só o dono).

## Out of Scope
- Cadastro de `documento`/`compromisso` pelo colaborador — fatias
  `CONTAI-094`/`095`.
- Leitura de `pagamento` já confirmado pelo colaborador com visibilidade
  "total" — fatia `CONTAI-096`.
- Convite/aceite, redefinição de senha dentro do app, qualquer autenticação
  alternativa a usuário+senha já existente — fechado pela resposta 3 do
  Mateus (cadastro direto por e-mail, sem convite); ciclo de vida de senha
  (criar/resetar) continua passo de dashboard, fora do app (dívida D-iv,
  Viabilidade).
- Granularidade de visibilidade por tipo de documento ou faixa de valor — a
  flag fechada pela resposta 1 do Mateus é binária (restrita/total); não
  inventar granularidade não pedida.
- Um mesmo colaborador atuando em múltiplas obras simultaneamente — não
  mencionado no relato, não assumir (ver Perguntas Abertas).
- `CONTAI-011`/`049`/`050` (export do acervo pro Google Drive) continuam em
  espera — este ticket deixa o export retomável para um único dono, não
  resolve o cenário multi-dono que o pausou (dívida D-viii).
- Banir/apagar a conta do colaborador no dashboard do Supabase — revogação de
  acesso de produto é `removido_em`; a conta em si não é apagada enquanto
  houver `criado_por` apontando para ela (violaria a FK sem cascade de
  propósito).

## Gate Fiscal (Contador)

**Esta fatia não cadastra `documento`, `compromisso` nem `pagamento`** — é
infraestrutura de vínculo e autoria. Por isso, sem impacto fiscal direto em
si, mas fixa duas garantias que as fatias seguintes dependem:

1. **Confirmar/registrar `pagamento` é exclusivo do Mateus, sempre.** `[Certain]`
   A RLS de `pagamento` já é (e continua sendo, intocada nesta fatia)
   `user_id = auth.uid()` para INSERT/UPDATE — nenhuma mudança aqui abre essa
   porta. A trava estrutural completa (o porquê de nenhum caminho de código
   do colaborador conseguir produzir `pagamento`) é desenhada em detalhe no
   Gate Fiscal do `CONTAI-095`.
2. **Visibilidade (restrita/total) é questão de produto/privacidade, não
   fiscal.** `[Certain]` Não há, na legislação de IRPF/ganho de capital/CNO-
   SERO que rege este projeto, regra sobre controle de acesso interno a um
   sistema privado. O único ponto tributário adjacente — sigilo fiscal (art.
   198 CTN) — regula o dever de sigilo da Receita Federal perante terceiros,
   não como um sistema privado do próprio contribuinte segrega visão entre
   colaboradores. Quem decide a trava de visibilidade é produto (`po`/
   `cto-obra`), não o Gate Fiscal; não travar este ticket nisso.

## Pre-mortem
1. **Erro de digitação no e-mail concede acesso a quem não devia.** O
   cadastro é direto por e-mail e libera acesso sem confirmação do lado do
   colaborador; um e-mail errado — ou certo, mas de conta já existente por
   outro motivo — pode dar a um estranho acesso imediato à obra,
   especialmente com visibilidade "total". Mitigado em parte pela lista
   visível + remoção rápida (critério 10), mas não impede a concessão
   inicial.
2. **Colaborador removido no meio da obra deixa pendência órfã.** Um
   `documento`/`compromisso` criado pelo colaborador pode ter uma pendência
   que só ele sabia explicar; se o acesso dele for revogado antes da revisão
   do Mateus, o contexto se perde — a fila mostra "quem criou", mas não
   resolve a lacuna de informação que só existia na cabeça do colaborador.
3. **Rastro de autoria se perde numa correção futura.** Uma migration ou
   feature que edite `documento`/`compromisso`/`pagamento` por outro motivo,
   sem tratar `criado_por` como campo protegido, pode sobrescrever ou
   nulificar a autoria silenciosamente — quebrando a meta 3 sem que teste
   nenhum detecte, porque o teste de hoje não cobre "autoria depois de N
   correções". Mitigado estruturalmente pelo trigger `criado_por_imutavel`
   (critério 6), não por disciplina de quem escreve o próximo código.

## Viabilidade (CTO)
- **Modelo de dados**: tabela nova `obra_colaborador` (RLS própria); colunas
  novas `criado_por`/`revisado_em`/`revisado_por` em `documento` e
  `compromisso`; enum `visibilidade_colaborador`; função helper
  `visibilidade_na_obra`; três triggers (`criado_por_imutavel`,
  `user_id_da_obra`, resolução de conta em `obra_colaborador`/`auth.users`).
  São as **primeiras funções `security definer`** do repo (dívida D-i —
  pattern break deliberado, `set search_path = ''`, revoke de `public`/
  `anon`, declaradas no mapa de privilégios).
- **Arquivos**: `supabase/migrations/0030_obra_colaborador.sql`,
  `supabase/seed.sql`, `lib/papel.ts` (novo, puro — `papelNaObra`,
  `nomeDoAutor` — com teste Vitest), `lib/data.ts` (`carregarColaboradores`,
  `adicionarColaborador`, `alterarVisibilidade`, `removerColaborador`,
  `carregarMeusVinculos`), `lib/types.ts`, `lib/database.types.ts`,
  `app/(gestao)/obras/[id]/colaboradores/page.tsx`, área nova do colaborador
  (shell/layout), `e2e/banco.ts`, `e2e/colaborador.spec.ts`,
  `e2e/privilegios.spec.ts`.
- **Complexidade: M.** Não é L — nenhuma tela de captura, nenhuma policy de
  escrita em tabela fiscal nesta fatia. O risco mora todo na migration
  (primeiros `security definer` do repo + trigger em `auth.users`), que é
  onde o Gate 2 do `/develop` precisa concentrar atenção.
- **Dívidas criadas** (aceitas conscientemente): (D-i) primeiras funções
  `security definer`; (D-ii) `favorecido` não tem `obra_id` — colaborador de
  uma obra pode enxergar favorecidos do dono cadastrados em outras obras
  (nome + CPF/CNPJ); corrigir exige `obra_id` em `favorecido`, fora de
  escopo; (D-iv) ciclo de vida de senha fora do app; (D-v) `user_id` passa a
  significar "dono do acervo" por trigger, não "quem inseriu" — o nome do
  campo engana, renomear 30 migrations não paga; (D-vii) remoção de acesso
  não derruba sessão JWT já emitida — é a RLS que torna o acesso nulo na
  requisição seguinte (discordância registrada: "revoga login" do critério 4
  do relato original é sobre operação, não sobre banir a conta); (D-viii)
  `CONTAI-011` continua pausado — este desenho não resolve o multi-dono.
- **Primeiro acesso**: resolvido sem RPC e sem service key (critério 11) —
  dois triggers convergem os dois casos (vínculo antes da conta, conta antes
  do vínculo) sem o app precisar saber em qual ordem aconteceu.

## Dependências
Bloqueia `CONTAI-094`, `CONTAI-095`, `CONTAI-096` (os três dependem da tabela
`obra_colaborador`, da função `visibilidade_na_obra` e das colunas de
autoria). Não bloqueado por nada.

## Perguntas Abertas
1. **Interpretação de "restrita"** (dívida D-vi do `cto-obra`) — o relato diz
   "só o que cadastra + a própria fila de pendentes". Isso significa (a)
   `criado_por = auth.uid()` — só os próprios registros, incluindo os
   próprios ainda pendentes — ou (b) os próprios registros **mais** todos os
   pendentes de revisão da obra (de qualquer colaborador)? Este ticket
   implementa (a); se o Mateus quis (b), é um ajuste de policy (`or
   revisado_em is null`), não de arquitetura. **Pergunta direta ao Mateus,
   não decidida pelo pipeline.**
2. Um mesmo colaborador pode atuar em mais de uma obra do Mateus ao mesmo
   tempo? Não assumido; se sim, muda a lógica de "qual shell abre no login"
   quando a pessoa também é dono de outra obra (designer, pergunta 3).
3. Texto exato do aviso "e-mail ainda sem conta" na tela de gestão de
   colaboradores (designer, pergunta 1).
4. A lista de colaboradores mostra só os ativos, ou também os removidos com
   um estado "removido" (auditoria visível na própria tela, não só no banco)?
   (designer, pergunta 2).
5. Texto exato de "nada a fazer ainda" na área do colaborador — neutro ou já
   anunciando o que chega em `094`/`095`? (designer, pergunta 4).
6. Rótulo/chip visual para "restrita" vs. "total" na lista de colaboradores —
   texto puro ou componente `Chip` dedicado? Não há precedente de chip
   não-fiscal no projeto para reaproveitar (designer, pergunta 5).

## Cenário e checagem final
**Gestão** para a tela de gestão de colaboradores (dono, em casa, sentado). A
área do colaborador nesta fatia não é nem gestão nem captura no sentido do
CLAUDE.md — não há formulário, anexo nem decisão fiscal, é tela de
orientação; mesmo assim permanece legível em 375px por default sadio de
produto (é simples o bastante para isso ser barato), não porque a doutrina do
piso exija. O "Teste do Canteiro" não se aplica a nenhuma das duas telas desta
fatia.

Varredura de condição fiscal órfã (`grep -rniE` do `/tickets-req`): as duas
condições fiscais citadas (confirmação de pagamento exclusiva do Mateus;
visibilidade fora de competência fiscal) não introduzem obrigação/proibição
tributária nova nesta fatia — são âncoras para `CONTAI-095`/`096`, onde a
condição completa com parecer é desenvolvida.

Veredito: **APROVADO**, condicionado às Perguntas Abertas 1-2 (arquitetura
não muda se a resposta for diferente da suposta, mas a policy de visibilidade
pode precisar de ajuste pontual — não redesenho).

---

## Design (nível 1)
Descrição completa em `design/mocks/CONTAI-093.md`: tela de gestão de
colaboradores (formulário sempre visível + lista com visibilidade inline e
remoção) e shell/área do colaborador (lista de obras + "nada a fazer ainda").
Nenhum campo fiscal nesta fatia; nenhum texto de consequência fiscal a
revisar pelo `contador`.
