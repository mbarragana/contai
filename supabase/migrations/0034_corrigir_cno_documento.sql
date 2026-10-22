-- ══════════════════════════════════════════════════════════════════════════
-- CONTAI-101 · registrar que a nota PASSOU A TRAZER o CNO desta obra
--
-- Dor real (`docs/backlog/114-2026-10-22-corrigir-cno-ausente-apos-reemissao.md`),
-- palavras do Mateus: *"a nota fiscal que recebi não constava CNO da obra,
-- solicitei e eles me enviaram, mas não consigo adicionar uma nova nota com a
-- razão adição de CNO."* O documento fica com `nota_traz_cno = false` para
-- sempre, a pendência âmbar "nota sem CNO" nunca fecha, e a posição de aferição
-- INSS continua sem contar uma nota que hoje referencia o CNO da obra.
--
-- Fonte normativa:
-- `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` §1 e
-- **ADENDO — 2026-10-22**, que ratifica `nao_traz → desta_obra` como
-- CORRIGÍVEL (dois estados de origem, não dois pontos da mesma régua) e deixa
-- `outra_obra` intocado: aquele estado **bloqueia no ato do registro e nunca
-- persiste** (`nota_traz_cno` é `boolean | null`, sem terceiro valor gravável),
-- então não existe linha para corrigir. Esta migration não o afrouxa.
-- ══════════════════════════════════════════════════════════════════════════

-- ══ 1 · O par (entidade, campo) do rastro passa a admitir o CNO da nota ════
--
-- Mesmo movimento da 0019/0027/0028: o check CRESCE por migration, e `campo` é
-- `text` justamente para ele crescer sem `alter type`.
--
-- ⚠️ `cno_referenciado` entra SÓ em `entidade = 'documento'`. O CNO impresso é
-- fato do papel; `favorecido` e `pagamento` não têm nenhum, e admiti-los ali
-- deixaria o histórico de 2034 com linhas que não descrevem fato nenhum.
--
-- ⚠️ **E `nota_traz_cno` NÃO entra nesta lista** (critério 10). Os dois campos
-- são UM FATO SÓ, amarrado pelo check `documento_cno_coerente` da 0015
-- (`nota_traz_cno is true` ⇔ `cno_referenciado is not null`): duas linhas de
-- rastro mostrariam duas correções onde houve uma — a mesma armadilha do
-- `LinhaDoAto` que o CONTAI-085 consertou. A linha de `cno_referenciado`
-- (`null → '12.345.67890/01'`) já diz as duas coisas.
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
     'linha_retencao',
     -- CONTAI-101 — o CNO impresso na nota, obtido do prestador depois do
     -- registro. `antes` é SEMPRE `null` (o estado de origem é `nao_traz`, e a
     -- 0015 obriga `cno_referenciado is null` nele) e `depois` é o CNO da obra,
     -- lido no servidor.
     'cno_referenciado'
  )) or
  (entidade = 'favorecido' and campo in ('nome')) or
  (entidade = 'pagamento'  and campo in ('obra', 'vinculo', 'comprovante'))
);

-- ══ 2 · O ato: nota_traz_cno + cno_referenciado + rastro + anexo ═══════════
--
-- ⚠️ **FUNÇÃO NOVA, e nem `corrigir_documento` nem `corrigir_numero_documento`
-- foram estendidas.** Três diferenças de regime, nenhuma cosmética:
--
-- (a) **Aridade sem motivo.** O motivo é FIXO (`cno_obtido_do_prestador`, 0033)
--     e gravado aqui dentro. Um `p_motivo` nesta assinatura seria um lugar por
--     onde a tela mandaria a causa de um fato que o próprio ato já descreve —
--     e, pior, por onde um cliente mandaria um motivo que dispensa anexo.
--
-- (b) **Guarda de PRÉ-CONDIÇÃO DE ESTADO**, que nenhuma das outras duas tem:
--     esta correção só existe partindo de `nota_traz_cno = false`. `null` ("a
--     pergunta nunca foi feita") e `true` ("já traz CNO") não são o caso que o
--     ADENDO ratificou, e gravar a partir deles inventaria um `antes` que
--     ninguém nunca afirmou.
--
-- (c) ⚠️ **O VALOR GRAVADO NÃO VEM DO CLIENTE — ele é LIDO DE `obra` AQUI
--     DENTRO, na mesma transação.** Não existe `p_cno`, e a ausência é a trava
--     estrutural do ticket (critério 8): com um parâmetro, qualquer chamada ao
--     PostgREST poderia escrever em `documento.cno_referenciado` um número que
--     papel nenhum mostra — e `documento_cno_coerente` (0015) aceitaria, porque
--     ela só exige que o campo não seja nulo. A tela MOSTRA `obra.cno` para
--     confirmação; quem o grava é esta função. É o mesmo valor que
--     `cnoReferenciadoParaBanco(tipo, 'desta_obra', obra.cno)` grava na captura.
--
-- ⚠️ **`p_anos` NÃO EXISTE**, pela mesma razão da 0027: §0(a) do parecer é
-- literal em que o único campo de `documento` que move custo entre
-- anos-calendário é `valor`. CNO nunca entrou na conta
-- `C = min(Σ pagamentos, Σ documentos)`. O snapshot é gravado com `'[]'` FIXO,
-- de dentro — não com o que a tela mandar.
create function corrigir_cno_documento(
  p_documento_id uuid,
  -- ⚠️ **SEM `default null`, e os dois parâmetros são obrigatórios** (critério
  -- 7): o anexo é incondicional aqui. `default null` traduziria em parâmetro
  -- OPCIONAL do TypeScript (`supabase gen types`) e deixaria a chamada sem
  -- papel parecer legítima no call site, para falhar só no servidor.
  p_anexo_path   text
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ato     uuid := gen_random_uuid();
  v_revisao uuid;
  v_traz    boolean;
  v_cno     text;
  v_tipo    tipo_documento;
begin
  -- ⚠️ **ANEXO SEMPRE, INCONDICIONAL** (critério 7 e 9). Não há motivo que
  -- dispense, porque não há motivo a escolher: o único ato que esta função
  -- descreve é "o prestador mandou o papel com o CNO impresso", e sem o papel
  -- o ato não aconteceu. Gravar `nota_traz_cno = true` sem anexo seria o app
  -- afirmando sobre o papel mais do que o papel mostra — §3 do parecer.
  if p_anexo_path is null or btrim(p_anexo_path) = '' then
    raise exception 'o papel com o CNO impresso e obrigatorio: sem anexo nao se grava que a nota traz CNO';
  end if;

  -- O estado de origem e o CNO da obra, LIDOS AQUI, numa leitura só e dentro da
  -- transação. `for update of d` porque a decisão "esta nota está em
  -- `nao_traz`?" e a escrita precisam ver a mesma linha. `obra` NÃO é travada:
  -- nada aqui a altera, e travá-la serializaria toda correção de CNO da obra.
  --
  -- O join é seguro: `documento.obra_id` é `not null` desde a 0001, então
  -- `not found` aqui significa documento inexistente (ou invisível pela RLS),
  -- nunca obra ausente.
  select d.nota_traz_cno, d.tipo, o.cno
    into v_traz, v_tipo, v_cno
    from documento d
    join obra o on o.id = d.obra_id
   where d.id = p_documento_id
     for update of d;

  if not found then
    raise exception 'documento % nao encontrado', p_documento_id;
  end if;

  -- ⚠️ `is distinct from false` cobre `null` E `true` numa comparação só, e as
  -- duas recusas são do ADENDO, não de simetria de código:
  --   - `null`: a pergunta do CNO nunca foi feita nesta nota (registro anterior
  --     ao CONTAI-007, ou tipo que não a faz). A primeira resposta é afirmação
  --     original, não correção — ela não tem `antes` para registrar;
  --   - `true`: a nota já traz CNO impresso. Trocar um CNO impresso por outro é
  --     o terceiro estado que o produto não modela (lacuna registrada no ADENDO
  --     §3), e tratá-lo aqui sobrescreveria em silêncio o número que está no
  --     papel.
  -- ⚠️ **O TIPO ENTRA NA GUARDA, e não por simetria** (ressalva do Gate 2). Hoje
  -- `nota_traz_cno = false` só nasce em NF de serviço, porque
  -- `notaTrazCnoParaBanco` devolve `null` para os outros tipos — mas isso é
  -- **invariante de aplicação, não de schema**: a 0015 amarra
  -- `nota_traz_cno is true` ⇔ `cno_referenciado is not null` e **não diz nada
  -- sobre `tipo`**. Um INSERT direto, um backfill ou uma migration futura podem
  -- produzir um boleto com `false`, e sem esta cláusula o ato gravaria CNO
  -- impresso num papel que não tem CNO impresso. A promessa é do ato: ela é do
  -- próprio SQL, não da tela nem de uma função TypeScript que este arquivo não
  -- pode exigir. A tela recusa pelo tipo ANTES, só para não pedir trabalho que
  -- iria para o lixo.
  if v_tipo is distinct from 'nf_servico' then
    raise exception 'CNO impresso so existe em NF de servico: este documento e %', coalesce(v_tipo::text, 'sem tipo');
  end if;

  if v_traz is distinct from false then
    raise exception 'esta nota nao esta no estado "nao traz CNO" (nota_traz_cno = %): nao ha o que corrigir aqui', coalesce(v_traz::text, 'null');
  end if;

  -- Sem CNO na obra não há valor a gravar — e `documento_cno_coerente` (0015)
  -- recusaria `nota_traz_cno = true` com `cno_referenciado` nulo de qualquer
  -- forma. A exception explícita existe para a mensagem ser a certa: o conserto
  -- é cadastrar o CNO da obra, não mexer nesta nota.
  if v_cno is null or btrim(v_cno) = '' then
    raise exception 'a obra deste documento nao tem CNO cadastrado: cadastre o CNO da obra antes de registrar que a nota o traz';
  end if;

  -- ⚠️ **UM UPDATE, DUAS COLUNAS, UM FATO.** `documento_cno_coerente` (0015)
  -- exige as duas juntas — e é por isso que o rastro é UMA linha só.
  --
  -- ⚠️ `documento.arquivo_path` NÃO é tocado (parecer §1, linha `arquivo_path`:
  -- "NÃO CORRIGÍVEL… anexa-se adicional"). Desde a 0014 um trigger o torna
  -- imutável; o UPDATE nomeia as duas colunas que mexe, e só elas, para quem
  -- ler em 2034 não precisar do trigger para saber.
  update documento
     set nota_traz_cno   = true,
         cno_referenciado = v_cno
   where id = p_documento_id;

  -- UMA linha de rastro (critério 10). `antes` é `null` por construção: a 0015
  -- obriga `cno_referenciado is null` enquanto `nota_traz_cno` não é `true`.
  -- `motivo_texto` é `null` — `revisao_motivo_texto_coerente` (0009) só admite
  -- texto livre em `motivo = 'outro'`.
  insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
  values (v_ato, 'documento', p_documento_id, 'cno_referenciado', null, v_cno, 'cno_obtido_do_prestador', null)
  returning id into v_revisao;

  -- ⚠️ `'[]'::jsonb` FIXO, e não um parâmetro (critério 11). A chamada existe
  -- (em vez de ser omitida) porque "anos afetados: nenhum" é uma AFIRMAÇÃO do
  -- §0(a), não um esquecimento — mesma doutrina de `numero`/`serie` na 0027.
  perform revisao_gravar_anos(v_revisao, '[]'::jsonb);

  -- ⚠️ ANEXO ADICIONAL, nunca substituição (critério 12). O papel novo (nota
  -- reemitida, carta de correção ou documento complementar — o produto não
  -- distingue o instrumento, só exige que o CNO apareça impresso e legível)
  -- entra em `documento_anexo`, que é append-only, vinculado à `revisao_id`
  -- deste ato. O arquivo original continua no acervo: o dossiê lista os DOIS.
  insert into documento_anexo (documento_id, arquivo_path, revisao_id)
  values (p_documento_id, p_anexo_path, v_revisao);

  return v_ato;
end;
$$;

comment on function corrigir_cno_documento(uuid, text) is
  'CONTAI-101 — registra que a nota passou a trazer o CNO desta obra, com '
  'rastro e anexo obrigatorio. O CNO gravado e LIDO DE `obra` no servidor: nao '
  'existe parametro de CNO (parecer 2026-08-18, ADENDO 2026-10-22). Anos '
  'afetados sempre vazio (§0(a): so `valor` move custo entre anos).';

-- ══ 3 · EXECUTE: revoke de public/anon, grant só a authenticated ══════════
--
-- Função nasce com `execute` para `public`, e `public` inclui `anon`. Sem o
-- revoke, o anônimo poderia marcar como "traz CNO" uma nota do acervo que não
-- traz, e gravar rastro em nome de ninguém — e o efeito não é cosmético: a nota
-- sairia de `foraDaBase` (motivo `nota_sem_cno`, `lib/fiscal/afericao.ts`) sem
-- papel que a sustente. ⚠️ Sair de `foraDaBase` **não é abater a aferição**: a
-- base não é reduzida pelo valor da nota nem por percentual nenhum (D57) — quem
-- a reduz é a mão de obra declarada e vinculada ao CNO. O dano aqui é de
-- POSIÇÃO: a pendência desapareceria do relatório sem fato que a resolvesse, e a
-- nota passaria a compor o `baseCentavos`, que é proxy declarado (D57) e já
-- maior do que a que o fisco aceitaria provada.
-- Nenhum GRANT de tabela entra aqui: a função é `security invoker` e escreve em
-- `documento`, `revisao`, `revisao_ano_afetado` e `documento_anexo`, todas já
-- concedidas a `authenticated` desde a 0005/0009, e LÊ `obra` (0005).
revoke execute on function corrigir_cno_documento(uuid, text) from public, anon;

grant execute on function corrigir_cno_documento(uuid, text) to authenticated;
