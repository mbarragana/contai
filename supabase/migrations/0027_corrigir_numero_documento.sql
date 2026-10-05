-- ══════════════════════════════════════════════════════════════════════════
-- CONTAI-085 · corrigir o NÚMERO/SÉRIE de um documento já registrado
--
-- Dor real (dívida D89): a NFS-e nº 261 da prestadora foi CANCELADA e
-- substituída pela nº 263 — mesmo valor, número diferente. O acervo continuava
-- apontando para um papel cancelado como se fosse o vigente, e não existia
-- caminho nenhum para consertar: `numero`/`serie` só nasceram no CONTAI-004
-- (migration 0012), semanas depois de o CONTAI-021 fechar a lista de campos
-- corrigíveis.
--
-- O campo já estava PRÉ-APROVADO pelo parecer
-- `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` §1, linha
-- `numero`/`serie`: "CORRIGÍVEL COM CONDIÇÃO… como transcrição, texto literal,
-- zeros à esquerda preservados. Ao gravar, reroda a checagem de duplicidade".
-- O comentário de `revisao.campo` na 0009 previu literalmente esta migration:
-- *"a lista corrigível CRESCE sem reabrir gate fiscal quando o CONTAI-004
-- trouxer `numero`/`serie` (parecer §1)"*.
-- ══════════════════════════════════════════════════════════════════════════

-- ══ 1 · O par (entidade, campo) do rastro passa a admitir número e série ══
--
-- Mesmo movimento da 0019: o check CRESCE por migration, e `campo` é `text`
-- justamente para ele crescer sem `alter type` (que não roda em transação).
--
-- ⚠️ `numero` e `serie` entram SÓ em `entidade = 'documento'`. Número de nota é
-- do papel; `favorecido` e `pagamento` não têm nenhum dos dois, e admiti-los
-- ali deixaria o histórico de 2034 com linhas que não descrevem fato nenhum —
-- é a razão de o check existir fechado desde a 0009.
alter table revisao drop constraint revisao_campo_da_entidade;

alter table revisao add constraint revisao_campo_da_entidade check (
  (entidade = 'documento'  and campo in ('valor', 'classificacao', 'obra', 'numero', 'serie')) or
  (entidade = 'favorecido' and campo in ('nome')) or
  (entidade = 'pagamento'  and campo in ('obra', 'vinculo', 'comprovante'))
);

-- ══ 2 · O ato: número + série + rastro + anexo adicional ══════════════════
--
-- ⚠️ **FUNÇÃO NOVA, e `corrigir_documento` NÃO foi estendida** — é decisão de
-- ticket (critério 11), não preferência de estilo. Aquela função tem a guarda
-- *"`p_depois is null` → exception"*, correta para `valor` e `classificacao`
-- ("apagar o valor de uma nota já registrada tiraria custo sem que fato nenhum
-- tivesse mudado") e ERRADA para `serie`: série ausente é `null` LEGÍTIMO — é o
-- caso comum da NFS-e municipal, e corrigir "série 1 digitada por engano" para
-- "esta nota não tem série" é uma correção real. Relaxar a guarda lá dentro
-- atrás de um `if p_campo = 'serie'` enfraqueceria a proteção de `valor` para
-- atender um campo que não é dela.
--
-- Outra diferença de regime: esta função corrige DOIS campos num ato só (a nota
-- substitutiva troca número e série juntos), e `corrigir_documento` é
-- um-campo-por-chamada. Duas chamadas dariam dois `ato_id` para um ato único, e
-- o histórico mostraria duas correções onde houve uma.
--
-- ⚠️ **`p_anos` NÃO EXISTE nesta função**, e a ausência é o Gate Fiscal escrito
-- em assinatura: §0(a) do parecer é literal em que o único campo de `documento`
-- que move custo entre anos-calendário é `valor`. Número nunca entrou na conta
-- `C = min(Σ pagamentos, Σ documentos)` e nunca entrará. Um parâmetro de anos
-- aqui seria um lugar para o app mandar o que não existe — e por isso o
-- snapshot é gravado com `'[]'` FIXO, de dentro, não com o que a tela mandar.
create function corrigir_numero_documento(
  p_documento_id uuid,
  p_numero       text,
  p_serie        text,
  p_motivo       motivo_revisao,
  -- Anuláveis vêm com `default null` e por isso no fim da lista (o Postgres
  -- exige). Não é estilo: `supabase gen types` traduz parâmetro COM default em
  -- campo OPCIONAL do TypeScript. O PostgREST chama por NOME, então a ordem não
  -- afeta chamada nenhuma. Mesma nota de `corrigir_documento` (0009).
  p_motivo_texto text default null,
  p_anexo_path   text default null
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ato           uuid := gen_random_uuid();
  v_revisao       uuid;
  -- A revisão a que o anexo se soma. Um ato pode gravar DUAS linhas de rastro
  -- (número e série) e `documento_anexo.revisao_id` é UMA só: o papel novo
  -- pertence ao ato inteiro, e a linha do `numero` é a que o representa. O
  -- fallback para a linha da série é explícito porque "mudou só a série" é ato
  -- legítimo — sem ele o anexo entraria com `revisao_id` nulo e o critério 18
  -- ("qual valor veio de qual papel") perderia a resposta nesse caso.
  v_revisao_anexo uuid;
  v_antes_numero  text;
  v_antes_serie   text;
begin
  -- ⚠️ `p_numero` NUNCA é nulo (R2 do CONTAI-004, e critério 11 deste ticket).
  -- O parecer §1 conhece "o número impresso está errado no app" e NÃO conhece
  -- "apagar o número de uma nota já registrada": sem número a nota deixa de ser
  -- identificável na discriminação anual e cai fora da lista de cobrança do CNO
  -- — é regressão de acervo disfarçada de correção.
  if p_numero is null or btrim(p_numero) = '' then
    raise exception 'numero nao se apaga, corrige-se: o numero impresso na nota e obrigatorio';
  end if;

  -- ⚠️ Série ausente é `null`, NUNCA `''`. `serieParaBanco` (lib/fiscal/
  -- documento.ts) já devolve `null` para branco; a guarda está aqui porque a
  -- promessa é do ato, não da tela — e `''` no banco estragaria a comparação de
  -- duplicidade que a série existe para afinar ("sem série" é um estado, não um
  -- coringa).
  if p_serie = '' then
    raise exception 'serie vazia se grava como null, nunca como string vazia';
  end if;

  -- Parecer §5, regra dura 2: "se motivo = emitente corrigiu a nota, o
  -- documento novo é anexado NO MESMO ATO". É exatamente o caso real deste
  -- ticket — a nota 263 é o papel que prova que a 261 foi substituída. A guarda
  -- é do banco porque a promessa é do ato, não da tela.
  if p_motivo = 'emitente_corrigiu_a_nota' and p_anexo_path is null then
    raise exception 'motivo emitente_corrigiu_a_nota exige o documento novo anexado no mesmo ato';
  end if;

  -- Os dois motivos que a MÁQUINA grava em outros atos, e que nenhuma tela de
  -- correção de campo oferece: `arquivamento_corrigido` é o motivo do move de
  -- obra (adendo §5) e `comprovante_chegou_depois` é o do anexo tardio do
  -- comprovante (CONTAI-061). Aceitá-los aqui gravaria um rastro que descreve
  -- um ato que não aconteceu.
  if p_motivo in ('arquivamento_corrigido', 'comprovante_chegou_depois') then
    raise exception 'motivo % pertence a outro ato, nao a correcao de numero/serie', p_motivo;
  end if;

  -- O `antes` é LIDO AQUI, do próprio banco, dentro da transação — mesma razão
  -- de `corrigir_documento`: deixá-lo vir da tela abriria a janela entre
  -- carregar e gravar. `for update` porque a decisão "mudou?" e a escrita
  -- precisam ver a mesma linha.
  select d.numero, d.serie
    into v_antes_numero, v_antes_serie
    from documento d where d.id = p_documento_id for update;

  -- ⚠️ `found` logo DEPOIS do `select into`, e não depois do `update`: é aqui
  -- que o id inexistente (ou invisível pela RLS) tem de parar. Em
  -- `corrigir_documento` o teste vem depois do UPDATE; aqui a comparação
  -- "mudou?" roda ANTES dele, e sobre uma linha que não existe ela leria
  -- `null is not distinct from null` → "nada a corrigir", trocando a mensagem
  -- certa por uma errada.
  if not found then
    raise exception 'documento % nao encontrado', p_documento_id;
  end if;

  -- ⚠️ Comparação TEXTUAL LITERAL, por `is distinct from` — nunca parse
  -- numérico (parecer §1, e pre-mortem 1 do ticket). `'0263'` e `'263'` são
  -- valores DIFERENTES: NFS-e municipal usa numeração própria e normalizar
  -- destrói a identificação da nota. `is distinct from` e não `<>` porque
  -- `null` participa dos dois lados (série).
  if v_antes_numero is not distinct from p_numero
     and v_antes_serie is not distinct from p_serie then
    raise exception 'nada a corrigir: numero e serie informados sao identicos aos gravados';
  end if;

  -- ⚠️ `documento.arquivo_path` NÃO É TOCADO em lugar nenhum desta função
  -- (parecer §1, linha `arquivo_path`: "NÃO CORRIGÍVEL… anexa-se adicional").
  -- Desde a 0014 um trigger o torna imutável, então nem por descuido isto
  -- mudaria — mas o UPDATE abaixo nomeia as duas colunas que ele mexe, e só
  -- elas, para que quem ler em 2034 não precise do trigger para saber.
  update documento set numero = p_numero, serie = p_serie
    where id = p_documento_id;

  -- UMA LINHA DE RASTRO POR CAMPO QUE DE FATO MUDOU, mesmo `ato_id` (critério
  -- 8). A nota substitutiva que troca só o número grava uma linha; a que troca
  -- número e série grava duas, e a tela as mostra como UMA correção, porque foi
  -- um ato só (`agruparPorAto`).
  --
  -- Gravar a linha do campo que não mudou seria "uma correção que não
  -- aconteceu" — e o check `revisao_antes_difere_depois` da 0009 recusaria o
  -- INSERT de qualquer forma.
  if v_antes_numero is distinct from p_numero then
    insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
    values (v_ato, 'documento', p_documento_id, 'numero', v_antes_numero, p_numero, p_motivo, p_motivo_texto)
    returning id into v_revisao;
    -- ⚠️ `'[]'::jsonb` FIXO, e não um parâmetro: ver o cabeçalho da função.
    -- A chamada existe (em vez de ser omitida) porque "anos afetados: nenhum" é
    -- uma AFIRMAÇÃO do §0(a), não um esquecimento — e quem lê este arquivo
    -- procurando "onde está o snapshot" encontra a resposta aqui.
    perform revisao_gravar_anos(v_revisao, '[]'::jsonb);
    v_revisao_anexo := v_revisao;
  end if;

  -- Bloco PRÓPRIO, e não um `else` do de cima: os dois campos são independentes
  -- — "mudei só a série" é caso legítimo ("digitei série 1 numa NFS-e que não
  -- tem série"), e "mudei os dois" é o caso real da nota substitutiva.
  if v_antes_serie is distinct from p_serie then
    insert into revisao (ato_id, entidade, entidade_id, campo, antes, depois, motivo, motivo_texto)
    values (v_ato, 'documento', p_documento_id, 'serie', v_antes_serie, p_serie, p_motivo, p_motivo_texto)
    returning id into v_revisao;
    perform revisao_gravar_anos(v_revisao, '[]'::jsonb);
    -- Só vira o alvo do anexo quando o número não mudou (ato de série sozinha).
    v_revisao_anexo := coalesce(v_revisao_anexo, v_revisao);
  end if;

  -- ⚠️ ANEXO ADICIONAL, nunca substituição. O papel novo (nota substitutiva ou
  -- carta de correção) entra em `documento_anexo`, que é append-only, e o
  -- arquivo original continua no acervo: o dossiê lista os DOIS.
  if p_anexo_path is not null then
    insert into documento_anexo (documento_id, arquivo_path, revisao_id)
    values (p_documento_id, p_anexo_path, v_revisao_anexo);
  end if;

  return v_ato;
end;
$$;

comment on function corrigir_numero_documento(uuid, text, text, motivo_revisao, text, text) is
  'CONTAI-085 — corrige numero/serie de um documento registrado, com rastro. '
  'Comparacao textual literal (zeros a esquerda preservados); anos afetados '
  'sempre vazio (parecer 2026-08-18, §0(a): so `valor` move custo entre anos).';

-- ══ 3 · EXECUTE: revoke de public/anon, grant só a authenticated ══════════
--
-- Função nasce com `execute` para `public`, e `public` inclui `anon`. Sem o
-- revoke, o anônimo poderia reescrever o número de uma nota do acervo e gravar
-- rastro em nome de ninguém. Nenhum GRANT de tabela entra aqui: a função é
-- `security invoker` e escreve em `documento`, `revisao`, `revisao_ano_afetado`
-- e `documento_anexo`, todas já concedidas a `authenticated` desde a 0005/0009.
revoke execute on function
  corrigir_numero_documento(uuid, text, text, motivo_revisao, text, text)
  from public, anon;

grant execute on function
  corrigir_numero_documento(uuid, text, text, motivo_revisao, text, text)
  to authenticated;
