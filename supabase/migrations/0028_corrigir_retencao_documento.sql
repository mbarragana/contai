-- ══════════════════════════════════════════════════════════════════════════
-- CONTAI-086 + CONTAI-087 · reabrir o GATE DE RETENÇÃO de um documento já
-- registrado, e provar a linha que nasce depois do registro
--
-- Dor real (dívida D90): `BlocoRetencao` só oferecia a pergunta quando
-- `documento.retencao_na_nota is null` (o legado). Com o gate em `'nenhuma'` o
-- bloco inteiro devolvia `null` — não existia caminho nenhum para flipar um gate
-- já respondido. Caso real: a NFS-e 263 (substitutiva da 261, CONTAI-085)
-- revelou ISS retido que a nota original não tinha; o documento 261 respondeu
-- "nenhuma" no registro e ficou preso, com R$ 1.797,03 de ISS a recolher
-- invisível no sistema inteiro
-- (`docs/pareceres/2026-10-02-iss-retido-floripa-perfuratec-nfse263.md` §3).
--
-- Fonte normativa, e nada aqui é inferido:
-- · `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` §5 (o
--   rastro; "duas regras duras", das quais a 2 é o anexo no mesmo ato) e ADENDO
--   §3 (revalidar o papel antes de alterar fato fiscal já gravado);
-- · `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` §2 e ADENDO A.2
--   (a linha de retenção NUNCA abate a aferição do SERO — por isso **nenhuma**
--   função deste arquivo toca ano-calendário, custo ou pendência);
-- · ratificação desta rodada, transcrita no Gate Fiscal do CONTAI-086:
--   "sem assimetria de direção" (as duas direções exigem motivo e anexo pela
--   mesma regra) e "DELETE + snapshot completo em `revisao.antes` é ACEITO como
--   equivalente a 'nada se apaga do rastro'", condicionado a (a) o DELETE só
--   existir dentro desta RPC nomeada e (b) o snapshot incluir quem reverteu e
--   `documento_id`/`obra_id`.
--
-- ── A PERGUNTA OBRIGATÓRIA DO REPO ──────────────────────────────────────
-- "Isto depende de algum default do stack local que o projeto remoto não tem?"
-- **Não.** Nenhuma tabela, sequence ou view nasce aqui: uma COLUNA numa tabela
-- que já tem os privilégios da 0017 (nullable, sem default de servidor) e DUAS
-- FUNÇÕES. Privilégio no Postgres é por tabela, nunca por coluna — então não há
-- GRANT de tabela a repetir. O que há é o `revoke`/`grant` de EXECUTE das duas
-- funções, no fim deste arquivo: função nasce com `execute` para `public`, e
-- `public` inclui `anon`.
-- ══════════════════════════════════════════════════════════════════════════

-- ══ 1 · O par (entidade, campo) do rastro admite o gate e a linha ══════════
--
-- Mesmo movimento das 0019 e 0027: o check CRESCE por migration, e `campo` é
-- `text` justamente para crescer sem `alter type` (que é irreversível).
--
-- ⚠️ **`entidade_revisao` NÃO é estendido**, e a ausência é decisão de ticket
-- (CONTAI-087, critério 9 / Viabilidade): a identidade da linha de retenção vai
-- no JSON de `depois`, não numa entidade nova. `entidade_id` continua sendo o
-- DOCUMENTO — é por ele que o histórico do detalhe acha o ato, e um
-- `entidade = 'linha_retencao'` obrigaria toda leitura de rastro de documento a
-- conhecer um segundo caminho, de forma irreversível (não há `drop value`).
--
-- ⚠️ Os dois campos entram SÓ em `entidade = 'documento'`. `favorecido` e
-- `pagamento` não têm gate de retenção nem linha — admiti-los ali deixaria o
-- histórico de 2034 com linhas que não descrevem fato nenhum.
alter table revisao drop constraint revisao_campo_da_entidade;

alter table revisao add constraint revisao_campo_da_entidade check (
  (entidade = 'documento'  and campo in (
     'valor', 'classificacao', 'obra', 'numero', 'serie',
     -- CONTAI-086 — a resposta do gate: `antes`/`depois` são os literais do
     -- enum `retencao_na_nota` ('nenhuma'/'destacada'), e a tela os traduz por
     -- `OPCOES_GATE`.
     'retencao_na_nota',
     -- CONTAI-087 — uma LINHA de `documento_retencao` que nasceu (antes `null`,
     -- `depois` = JSON da linha) ou que foi removida pela reversão do gate
     -- (`antes` = JSON completo da linha, `depois` null).
     'linha_retencao'
  )) or
  (entidade = 'favorecido' and campo in ('nome')) or
  (entidade = 'pagamento'  and campo in ('obra', 'vinculo', 'comprovante'))
);

-- ══ 2 · A linha de retenção sabe de qual ATO ela veio ══════════════════════
--
-- ⚠️ **NULLABLE, e o `null` é um FATO, não um dado faltando** (CONTAI-087,
-- critério 3): linha gravada na captura, ou a primeira linha de um documento
-- cujo gate já era "destacada" desde o registro, é **afirmação original** — não
-- há correção a apontar, e inventar uma revisão para ela seria registrar um ato
-- que não aconteceu. `not null` aqui obrigaria exatamente essa invenção.
--
-- Sem `on delete cascade`: `revisao` não tem DELETE para `authenticated` (0009,
-- append-only), então a cascata não teria caminho para rodar. Deixá-la escrita
-- sugeriria que a linha pode sumir junto com o rastro — o oposto da promessa.
alter table documento_retencao add column revisao_id uuid references revisao(id);

comment on column documento_retencao.revisao_id is
  'CONTAI-086/087 — o ato que trouxe esta linha. `null` = afirmacao original '
  '(captura, ou primeira linha de um gate respondido no registro), nunca '
  'ausencia de dado.';

-- ══ 3 · CONTAI-086 · corrigir o gate (e o que vem com ele) ════════════════
--
-- ⚠️ **FUNÇÃO NOVA, e `responderGateRetencao` continua INTOCADA** (critério
-- 13). Aquele caminho é um UPDATE direto com `.is("retencao_na_nota", null)`, e
-- ele se sustenta por ser a PRIMEIRA RESPOSTA: não há valor anterior a
-- rastrear, e o `.is(null)` torna a segunda gravação impossível. Esta função é o
-- regime oposto — reescrever um campo fiscal JÁ AFIRMADO —, e por isso exige
-- motivo, grava rastro e (conforme o motivo) cobra anexo.
--
-- ⚠️ **`p_anos` NÃO EXISTE**, e a ausência é o Gate Fiscal escrito em
-- assinatura: retenção não move custo de aquisição nem base de aferição (§2 e
-- ADENDO A.2 do parecer de 2026-09-18, mais a doutrina do `CLAUDE.md`). O
-- snapshot de anos é gravado com `'[]'` FIXO, de dentro — não existe parâmetro
-- por onde a tela mandar ano nenhum. Quem procurar "onde está o snapshot"
-- encontra a resposta aqui, afirmada, em vez de ausente.
--
-- ⚠️ **TRÊS ramos, um ato só** (critério 6: "nenhum estado intermediário
-- visível"):
--   a) `nenhuma → destacada`: grava o rastro do gate e insere as linhas de
--      `p_linhas` com o `revisao_id` DESSE rastro (CONTAI-087, critério 2 — o
--      motivo é herdado, sem pergunta nova);
--   b) `destacada → nenhuma`: snapshot completo de cada linha em
--      `revisao.antes` e **DELETE** das linhas;
--   c) `destacada → destacada` com linha nova: o gate não muda (e
--      `revisao_antes_difere_depois` recusaria a linha de rastro do gate), então
--      o rastro é um `linha_retencao` por linha nova — é o caso do CONTAI-087
--      chegando por esta porta, quando ele nasce dentro da tela de correção.
create function corrigir_gate_retencao(
  p_documento_id uuid,
  p_gate         retencao_na_nota,
  p_motivo       motivo_revisao,
  -- As linhas NOVAS, no formato do banco: `rotulo_literal`, `valor`,
  -- `composicao`, `tributo`, `e_desconto_efetivo`, `quem_recolhe`. Array vazio
  -- (`'[]'`) é o caso da reversão para "nenhuma".
  p_linhas       jsonb,
  -- Anuláveis vêm com `default null` e por isso no fim da lista (o Postgres
  -- exige). Mesma nota de `corrigir_numero_documento` (0027): o PostgREST chama
  -- por NOME, então a ordem não afeta chamada nenhuma.
  p_motivo_texto text default null,
  p_anexo_path   text default null
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ato      uuid := gen_random_uuid();
  v_revisao  uuid;
  -- A linha de rastro DO GATE, quando ele muda. É ela que as linhas novas do
  -- ramo (a) herdam — e o `null` dela é o que distingue o ramo (c), onde cada
  -- linha nova tem rastro próprio.
  v_revisao_gate  uuid;
  -- A revisão a que o ANEXO se soma. Um ato pode gravar N linhas de rastro e
  -- `documento_anexo.revisao_id` é UMA só: o papel novo pertence ao ato inteiro,
  -- e a primeira linha gravada é a que o representa.
  v_revisao_anexo uuid;
  v_antes    retencao_na_nota;
  v_obra     uuid;
  v_novas    integer;
  v_linha    jsonb;
  v_removida record;
begin
  -- `jsonb_array_length` levanta erro em não-array; a mensagem própria é mais
  -- útil do que `cannot get array length of a non-array`.
  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' then
    raise exception 'p_linhas tem de ser um array json (use [] quando nao ha linha nova)';
  end if;
  v_novas := jsonb_array_length(p_linhas);

  -- Os dois motivos que a MÁQUINA grava em outros atos: `arquivamento_corrigido`
  -- é o do move de obra (adendo §5) e `comprovante_chegou_depois` é o do anexo
  -- tardio do comprovante (CONTAI-061). Aceitá-los aqui gravaria um rastro que
  -- descreve um ato que não aconteceu.
  if p_motivo in ('arquivamento_corrigido', 'comprovante_chegou_depois') then
    raise exception 'motivo % pertence a outro ato, nao a correcao do gate de retencao', p_motivo;
  end if;

  -- Parecer §5, regra dura 2: "se motivo = emitente corrigiu a nota, o documento
  -- novo é anexado NO MESMO ATO". É o caso real desta dívida — a nota 263 é o
  -- papel que revela a retenção que a 261 não tinha. A guarda é do BANCO porque
  -- a promessa é do ato, não da tela.
  --
  -- ⚠️ E ela vale NAS DUAS DIREÇÕES (Gate Fiscal, "sem assimetria de direção"):
  -- `nenhuma→destacada` fabrica uma pendência sem prova; `destacada→nenhuma`
  -- esconde uma pendência real. Nenhuma das duas é a direção segura.
  if p_motivo = 'emitente_corrigiu_a_nota' and p_anexo_path is null then
    raise exception 'motivo emitente_corrigiu_a_nota exige o documento novo anexado no mesmo ato';
  end if;

  -- `for update` porque a decisão "mudou?" e a escrita precisam ver a mesma
  -- linha; o `antes` é LIDO AQUI, do banco, nunca informado pela tela (mesma
  -- razão de `corrigir_documento`: deixá-lo vir de fora abriria a janela entre
  -- carregar e gravar).
  select d.retencao_na_nota, d.obra_id
    into v_antes, v_obra
    from documento d where d.id = p_documento_id for update;

  if not found then
    raise exception 'documento % nao encontrado', p_documento_id;
  end if;

  -- ⚠️ `null` é O LEGADO, e ele NÃO entra aqui (critério 13): documento gravado
  -- antes da 0017 nunca respondeu o gate, e a primeira resposta dele é afirmação
  -- original — `responderGateRetencao`, sem motivo e sem anexo. Tratar o legado
  -- como correção gravaria um `antes` que nunca foi afirmado por ninguém.
  if v_antes is null then
    raise exception 'esta nota nunca respondeu o gate de retencao: a primeira resposta nao e correcao';
  end if;

  -- Ramo 3c do spec — **ZERO RASTRO, nem o motivo escolhido no passo 1**
  -- (critério 5, ratificado pelo `contador`): gravar uma reafirmação seria
  -- registrar um NÃO-EVENTO num acervo que existe para guardar fatos com
  -- consequência. A tela já desabilita o botão; esta é a trava de verdade.
  if v_antes = p_gate and v_novas = 0 then
    raise exception 'nada a corrigir: o gate informado e igual ao gravado e nao ha linha nova';
  end if;

  -- "Sem retenção destacada" e linha nova na mesma chamada é contradição, não
  -- correção: a linha afirmaria a retenção que o gate acabou de negar.
  if p_gate = 'nenhuma' and v_novas > 0 then
    raise exception 'gate nenhuma nao admite linha de retencao nova no mesmo ato';
  end if;

  -- ⚠️ Flipar para "destacada" SEM linha é proibido aqui (critério 6: "pelo
  -- menos 1 linha obrigatória"), e a razão é fiscal: a correção existe para a
  -- pendência de "quem recolhe" aparecer com lastro. Um flip a seco criaria
  -- exatamente a "pendência sem prova" que o Gate Fiscal nomeia — e o estado
  -- "destacada com zero linhas" legítimo é outro (o da CAPTURA, que
  -- `faltaRegistrarLinha` mostra), não o de uma correção deliberada.
  if v_antes = 'nenhuma' and p_gate = 'destacada' and v_novas = 0 then
    raise exception 'corrigir para destacada exige ao menos uma linha de retencao no mesmo ato';
  end if;

  -- ── O gate, quando ele de fato muda ───────────────────────────────────
  if v_antes is distinct from p_gate then
    update documento set retencao_na_nota = p_gate where id = p_documento_id;

    insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
    values (v_ato, 'documento', p_documento_id, 'retencao_na_nota',
            v_antes::text, p_gate::text, p_motivo, p_motivo_texto)
    returning id into v_revisao_gate;
    -- `'[]'::jsonb` FIXO: ver o cabeçalho da função. A chamada existe (em vez de
    -- ser omitida) porque "anos afetados: nenhum" é uma AFIRMAÇÃO do parecer, não
    -- um esquecimento.
    perform revisao_gravar_anos(v_revisao_gate, '[]'::jsonb);
    v_revisao_anexo := v_revisao_gate;

    -- ── Ramo (b): a reversão APAGA as linhas, com snapshot completo ─────
    --
    -- ⚠️ **ESTE É O ÚNICO `DELETE` em `documento_retencao` dentro de função
    -- nomeada deste repo, e é condição (a) do Gate Fiscal.** `removerLinhaRetencao`
    -- (DELETE direto pelo PostgREST, CONTAI-038) continua existindo para a
    -- correção de uma linha isolada — e a incoerência está nomeada como dívida no
    -- CONTAI-086 ("adicionar com rastro, remover sem"). O que NÃO pode existir é
    -- uma segunda rota que apague a LISTA inteira sem snapshot.
    --
    -- ⚠️ Soft-delete foi avaliado e REJEITADO no ticket (Out of Scope): exigiria
    -- um `where` a mais em todo leitor (`vinculo.ts`, `resumo.ts`, detalhe,
    -- dossiê), e um `where` esquecido viraria pendência fiscal silenciosa. A
    -- remoção FÍSICA é o que faz o critério 16 ser verdade sem tocar leitor
    -- nenhum.
    if p_gate = 'nenhuma' then
      for v_removida in
        select * from documento_retencao
         where documento_id = p_documento_id
         order by created_at
      loop
        insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
        values (
          v_ato, 'documento', p_documento_id, 'linha_retencao',
          jsonb_build_object(
            'id',                 v_removida.id,
            'rotulo_literal',     v_removida.rotulo_literal,
            -- ⚠️ `::text`, e não o número: `valor` é `numeric(14,2)` e o que
            -- este snapshot precisa preservar é a ESCALA impressa na nota
            -- ("1797.03"), não um float que alguém reinterpreta em 2034. É a
            -- mesma razão de `revisao.antes` ser texto para o campo `valor`
            -- (parecer §5: "texto preserva null, zeros à esquerda e enum").
            'valor',              v_removida.valor::text,
            'composicao',         v_removida.composicao,
            'tributo',            v_removida.tributo,
            'e_desconto_efetivo', v_removida.e_desconto_efetivo,
            'quem_recolhe',       v_removida.quem_recolhe,
            'created_at',         v_removida.created_at,
            -- O ato que trouxe a linha, quando houve um: o snapshot guarda a
            -- cadeia inteira, não só o último elo.
            'revisao_id',         v_removida.revisao_id,
            -- Condição (b) do Gate Fiscal: quem reverteu, e os dois ids que
            -- dizem DE ONDE a linha saiu. Sem eles o snapshot não se basta — e
            -- ele é a única coisa que resta da linha.
            'documento_id',       v_removida.documento_id,
            'obra_id',            v_obra,
            'revertida_por',      auth.uid()
          )::text,
          null, p_motivo, p_motivo_texto
        )
        returning id into v_revisao;
        perform revisao_gravar_anos(v_revisao, '[]'::jsonb);
      end loop;

      delete from documento_retencao where documento_id = p_documento_id;
    end if;
  end if;

  -- ── As linhas NOVAS (ramos a e c) ─────────────────────────────────────
  for v_linha in select * from jsonb_array_elements(p_linhas) loop
    if v_revisao_gate is null then
      -- Ramo (c): o gate não mudou, então não existe linha de rastro do gate à
      -- qual pendurar a linha — e `revisao_antes_difere_depois` recusaria uma
      -- ('destacada' → 'destacada'). O fato aqui é a LINHA que nasce, e é ela que
      -- o rastro descreve (CONTAI-087, critério 4) — **uma por linha**, nunca a
      -- primeira servindo de guarda-chuva para as outras.
      insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
      values (v_ato, 'documento', p_documento_id, 'linha_retencao',
              null, v_linha::text, p_motivo, p_motivo_texto)
      returning id into v_revisao;
      perform revisao_gravar_anos(v_revisao, '[]'::jsonb);
      v_revisao_anexo := coalesce(v_revisao_anexo, v_revisao);
    else
      -- Ramo (a): o motivo é HERDADO do rastro do gate, sem rastro próprio por
      -- linha (CONTAI-087, critério 2 — "mesmo ato, nenhuma pergunta extra").
      v_revisao := v_revisao_gate;
    end if;

    perform documento_retencao_inserir(p_documento_id, v_linha, v_revisao);
  end loop;

  -- ⚠️ ANEXO ADICIONAL, nunca substituição (parecer §1, linha `arquivo_path`):
  -- `documento.arquivo_path` não é tocado em lugar nenhum desta função, e o
  -- trigger da 0014 o torna imutável de qualquer forma.
  --
  -- ⚠️ **LINHA NOVA mesmo quando o `arquivo_path` já está em `documento_anexo`**
  -- (Viabilidade do CONTAI-086): o chip "usar a nota anexada em dd/mm" manda o
  -- path de um anexo que já existe, e cada ATO tem o seu próprio rastro — um
  -- objeto no bucket, N atos apontando. Reusar a linha antiga apagaria a resposta
  -- de "qual papel sustentou QUAL correção".
  if p_anexo_path is not null then
    insert into documento_anexo (documento_id, arquivo_path, revisao_id)
    values (p_documento_id, p_anexo_path, v_revisao_anexo);
  end if;

  return v_ato;
end;
$$;

comment on function corrigir_gate_retencao(uuid, retencao_na_nota, motivo_revisao, jsonb, text, text) is
  'CONTAI-086 — corrige o gate de retencao de um documento registrado, com '
  'rastro. Reverter para "nenhuma" faz snapshot completo das linhas em '
  'revisao.antes e DELETA (unico delete da lista inteira no repo). Anos '
  'afetados sempre vazio: retencao nao move custo nem afericao.';

-- ══ 4 · O INSERT de uma linha, UMA vez para as duas RPCs ══════════════════
--
-- ⚠️ Função auxiliar, e não um `insert` copiado em dois lugares: as duas RPCs
-- gravam a MESMA linha com o MESMO formato de JSON, e duas cópias divergiriam —
-- a primeira coisa a divergir seria o `nullif` do tributo, que é o que mantém o
-- CHECK `documento_retencao_tributo_coerente` satisfeito.
--
-- A validação de conteúdo continua sendo dos CHECKs da 0017 (`valor > 0`,
-- tributo coerente, recolhedor coerente): eles são a trava de verdade, e
-- repetí-los aqui criaria uma segunda régua para discordar da primeira. O que
-- esta função acrescenta é a mensagem legível do rótulo em branco, que nenhum
-- CHECK cobre (`rotulo_literal` é `not null`, e `' '` passaria).
create function documento_retencao_inserir(
  p_documento_id uuid,
  p_linha        jsonb,
  p_revisao_id   uuid
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if coalesce(btrim(p_linha ->> 'rotulo_literal'), '') = '' then
    raise exception 'linha de retencao sem rotulo_literal: o rotulo e copiado como esta impresso na nota';
  end if;

  insert into documento_retencao (
    documento_id, rotulo_literal, valor, composicao, tributo,
    e_desconto_efetivo, quem_recolhe, revisao_id
  ) values (
    p_documento_id,
    btrim(p_linha ->> 'rotulo_literal'),
    (p_linha ->> 'valor')::numeric,
    (p_linha ->> 'composicao')::composicao_retencao,
    -- `->>` de um `null` json já devolve SQL NULL; o `nullif` cobre o `''` que
    -- um cliente poderia mandar no lugar da ausência.
    nullif(p_linha ->> 'tributo', '')::tributo_retido,
    (p_linha ->> 'e_desconto_efetivo')::boolean,
    nullif(p_linha ->> 'quem_recolhe', '')::quem_recolhe_retencao,
    p_revisao_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function documento_retencao_inserir(uuid, jsonb, uuid) is
  'CONTAI-086/087 — o INSERT de uma linha de retencao a partir do JSON, '
  'compartilhado pelas duas RPCs de correcao. Validacao de conteudo continua '
  'nos CHECKs da 0017.';

-- ══ 5 · CONTAI-087 · a linha que nasce DEPOIS do registro, com prova ══════
--
-- O caso isolado (critério 4): o gate já é "destacada", já existe pelo menos uma
-- linha gravada, e aparece outra agora. Aqui `createdAt` sozinho **não basta** —
-- falta "por que a linha aparece só agora", que é a pergunta de auditor do §5 do
-- parecer de 2026-08-18. Por isso o ato grava rastro próprio
-- (`campo = 'linha_retencao'`, `antes` null, `depois` = JSON da linha).
--
-- ⚠️ **`comprovante_chegou_depois` é RECUSADO aqui** (critério 5), e não por
-- simetria de estilo: aquele motivo é do ciclo do COMPROVANTE DE PAGAMENTO
-- (CONTAI-061), e uma linha de retenção se lê na NOTA. Aceitá-lo gravaria um
-- rastro que descreve outro ato.
create function adicionar_linha_retencao_registrada(
  p_documento_id uuid,
  p_linha        jsonb,
  p_motivo       motivo_revisao,
  p_motivo_texto text default null,
  p_anexo_path   text default null
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ato     uuid := gen_random_uuid();
  v_revisao uuid;
  v_gate    retencao_na_nota;
begin
  if p_linha is null or jsonb_typeof(p_linha) <> 'object' then
    raise exception 'p_linha tem de ser um objeto json com os campos da linha';
  end if;

  if p_motivo in ('arquivamento_corrigido', 'comprovante_chegou_depois') then
    raise exception 'motivo % pertence a outro ato, nao a linha de retencao registrada', p_motivo;
  end if;

  -- Critério 5, e é a regra dura 2 do §5 outra vez: o dado da linha que NÃO está
  -- conferível no papel já anexado só entra com o papel novo no mesmo ato.
  if p_motivo = 'emitente_corrigiu_a_nota' and p_anexo_path is null then
    raise exception 'motivo emitente_corrigiu_a_nota exige o documento novo anexado no mesmo ato';
  end if;

  select d.retencao_na_nota into v_gate
    from documento d where d.id = p_documento_id for update;

  if not found then
    raise exception 'documento % nao encontrado', p_documento_id;
  end if;

  -- ⚠️ Esta porta NÃO flipa gate. Linha nova num documento que respondeu
  -- "nenhuma" (ou que nunca respondeu) é contradição entre a linha e o gate — e
  -- o caminho certo é o `corrigir_gate_retencao`, que pergunta o gate e grava a
  -- mudança dele. Deixar passar aqui criaria uma nota com retenção registrada e
  -- gate dizendo que não há.
  if v_gate is distinct from 'destacada' then
    raise exception 'o gate desta nota nao e destacada: corrija o gate (corrigir_gate_retencao) antes de adicionar linha';
  end if;

  -- ⚠️ `depois` é o JSON COMO ELE CHEGOU (normalizado só no `rotulo_literal` do
  -- insert), **sem** o `id` da linha criada: `revisao` é append-only e não tem
  -- UPDATE para `authenticated` (0009), então a linha de rastro tem de nascer
  -- completa ANTES do INSERT que gera o id. O caminho de volta existe pelo outro
  -- lado: `documento_retencao.revisao_id` aponta para cá.
  insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
  values (v_ato, 'documento', p_documento_id, 'linha_retencao',
          null, p_linha::text, p_motivo, p_motivo_texto)
  returning id into v_revisao;
  -- Anos afetados vazio, pela mesma afirmação do §2: nenhuma linha de retenção
  -- move custo de aquisição nem base de aferição.
  perform revisao_gravar_anos(v_revisao, '[]'::jsonb);

  perform documento_retencao_inserir(p_documento_id, p_linha, v_revisao);

  -- Anexo ADICIONAL, com o `revisao_id` DESTE ato — inclusive quando o path é o
  -- de um `documento_anexo` que já existe (ver a nota da RPC do gate).
  if p_anexo_path is not null then
    insert into documento_anexo (documento_id, arquivo_path, revisao_id)
    values (p_documento_id, p_anexo_path, v_revisao);
  end if;

  return v_ato;
end;
$$;

comment on function adicionar_linha_retencao_registrada(uuid, jsonb, motivo_revisao, text, text) is
  'CONTAI-087 — linha de retencao acrescentada a um documento JA registrado, '
  'com rastro proprio (campo linha_retencao) e anexo conforme o motivo. '
  'Recusa comprovante_chegou_depois e gate diferente de destacada.';

-- ══ 6 · EXECUTE: revoke de public/anon, grant só a authenticated ══════════
--
-- Função nasce com `execute` para `public`, e `public` inclui `anon`. Sem o
-- revoke, o anônimo poderia apagar as linhas de retenção de uma nota do acervo
-- (a RPC do gate faz DELETE) e gravar rastro em nome de ninguém. Nenhum GRANT de
-- tabela entra aqui: as três funções são `security invoker` e escrevem em
-- `documento`, `documento_retencao`, `revisao`, `revisao_ano_afetado` e
-- `documento_anexo`, todas já concedidas a `authenticated` desde a 0005/0009/0017.
revoke execute on function
  corrigir_gate_retencao(uuid, retencao_na_nota, motivo_revisao, jsonb, text, text)
  from public, anon;

grant execute on function
  corrigir_gate_retencao(uuid, retencao_na_nota, motivo_revisao, jsonb, text, text)
  to authenticated;

revoke execute on function
  adicionar_linha_retencao_registrada(uuid, jsonb, motivo_revisao, text, text)
  from public, anon;

grant execute on function
  adicionar_linha_retencao_registrada(uuid, jsonb, motivo_revisao, text, text)
  to authenticated;

-- A auxiliar precisa de EXECUTE porque as duas de cima são `security invoker`:
-- sem o privilégio, a chamada interna falharia com o papel do app.
revoke execute on function
  documento_retencao_inserir(uuid, jsonb, uuid)
  from public, anon;

grant execute on function
  documento_retencao_inserir(uuid, jsonb, uuid)
  to authenticated;
