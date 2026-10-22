# CONTAI-101 Corrigir "nota sem CNO" depois que o prestador reemite com o CNO impresso

## Tipo e Prioridade
feature — **P1 fricção de processo** (não P0 fiscal: `podeGerarRelatorioAnual`
não lê `notaTrazCno`/`cnoReferenciado`, então a ausência não bloqueia nenhuma
das 3 saídas anuais declaradas). Fica P1 e não P2 porque trava permanentemente
uma pendência de cobrança que o próprio produto gera e nunca fecha sem esta
tela, e degrada uma das 3 saídas oficiais do sistema — a posição da aferição
INSS.

## Dor de Origem
Dívida registrada em `docs/backlog/114-2026-10-22-corrigir-cno-ausente-apos-reemissao.md`.
Citação literal do Mateus: *"a nota fiscal que recebi não constava CNO da
obra, solicitei e eles me enviaram, mas não consigo adicionar uma nova nota
com a razão adição de CNO."* Caso-irmão de padrão já resolvido para outro
campo: `CONTAI-085` (prestadora reemite a nota com dado novo, para
número/série) — nunca estendido para CNO.

## User Story
Como dono da obra, sentado em casa, revisando o detalhe de um documento com a
pendência "nota sem CNO" (`notaTrazCno = false`), quando eu receber do
prestador a nota reemitida já com o CNO da obra impresso, quero corrigir o
registro existente para refletir que a nota agora traz o CNO desta obra,
anexando a nota reemitida como prova, para que a pendência de cobrança feche
e a posição da aferição INSS passe a considerar esse documento corretamente.

## Critérios de Aceite
1. [ ] Proposta nível 2 em `design/mocks/CONTAI-101.md`.
2. [ ] Documento com `notaTrazCno = false` ganha, no ponto de entrada único
   `/documento/[id]/documento-novo`, uma 4ª opção em `CorrecaoDoPacote`
   (`lib/gestao/pacote-correcao.ts:24`) com token `"cno"`, rótulo "CNO — hoje:
   não traz CNO" — entra em `ORDEM_DO_PACOTE` por último; aparece quando, e só
   quando, `notaTrazCno === false`. O rótulo do link de `documento-novo`
   ("corrigir número, valor e/ou retenção") ganha " e/ou CNO" na mesma
   condição.
3. [ ] Para `notaTrazCno = null` (pergunta nunca feita), `notaTrazCno = true`
   (já tinha `desta_obra`) ou resposta `outra_obra` (bloqueio definitivo no
   registro, nunca persiste — confirmado em código, `lib/types.ts:205-206`),
   a opção não aparece em `documento-novo`, e a rota
   `/documento/[id]/corrigir/cno` recusa no topo, sem gravar nada, se acessada
   por URL direta.
4. [ ] Rota nova `/documento/[id]/corrigir/cno`, cópia reduzida de
   `corrigir/numero/page.tsx`: **sem** `PassoMotivo` (nenhuma escolha de
   motivo — diferente de `corrigir/numero`/`corrigir/valor`/`corrigir/retencao`,
   que perguntam o motivo), **sem** campo de texto para digitar o CNO, **sem**
   bloco de "custo confirmado por ano", **sem** estado "Nada a corrigir" (as
   recusas do critério 6 já cobrem os únicos casos sem o que fazer).
5. [ ] Tela mostra, read-only, "CNO na nota — hoje: não traz CNO" → "depois:
   {obra.cno}, o CNO cadastrado nesta obra" — nunca campo editável de CNO.
6. [ ] Tela recusa no topo, antes de qualquer campo, sem gravar nada, nos três
   casos: (a) `documento.tipo` não é NF de serviço (`!exigeCnoReferenciado`);
   (b) `notaTrazCno !== false`, com texto distinguindo `null` ("esta nota
   nunca foi perguntada sobre o CNO impresso") de `true` ("esta nota já traz
   CNO impresso: {cnoReferenciado}"); (c) `obra.cno === null` — recusa oferece
   link para cadastrar o CNO da obra (`/obras/[id]`, bloco `CamposCno`).
7. [ ] Anexo (nota substitutiva, carta de correção ou documento complementar —
   qualquer papel em que o CNO apareça impresso e legível; a UI não distingue
   o tipo de instrumento) é **sempre obrigatório, de forma incondicional** —
   não há motivo que dispense. Botão "Gravar a correção" nasce desabilitado e
   só habilita com anexo escolhido (chip existente) ou enviado (arquivo novo).
   Sem anexo, a RPC também recusa gravar.
8. [ ] RPC `corrigir_cno_documento(p_documento_id uuid, p_anexo_path text)
   returns uuid` lê `obra.cno` no servidor (nunca recebe CNO como parâmetro),
   e grava, no mesmo ato, `notaTrazCno = true` e `cnoReferenciado = obra.cno`
   — verificável lendo o documento depois da correção salva.
9. [ ] RPC recusa (`raise exception`, nada gravado) quando: `p_anexo_path` é
   nulo/vazio; `p_documento_id` não encontrado; `notaTrazCno` do documento é
   diferente de `false`; `obra.cno` do documento é nulo/vazio.
10. [ ] Rastro: uma única linha em `revisao` por ato — `entidade = 'documento'`,
    `campo = 'cno_referenciado'`, `antes = null`, `depois = {CNO gravado}`,
    `motivo = 'cno_obtido_do_prestador'` (valor novo do enum `motivo_revisao`,
    gravado automaticamente pelo servidor — nunca escolhido em tela),
    `motivo_texto = null`. O campo `notaTrazCno`/`nota_traz_cno` **não** gera
    linha própria — é o mesmo fato de `cno_referenciado`, amarrado pelo check
    `documento_cno_coerente` (migration `0015`), não uma segunda correção.
11. [ ] "Anos afetados" sempre vazio para esta correção
    (`revisao_gravar_anos(..., '[]'::jsonb)`) — CNO nunca move custo entre
    anos (mesma doutrina do `numero`/`serie` no CONTAI-085).
12. [ ] O anexo da nota reemitida entra em `documento_anexo`, vinculado à
    `revisao_id` do ato — `documento.arquivo_path` do registro original
    **não muda** (imutável por trigger desde a migration `0014`, append-only,
    mesmo princípio do CONTAI-085). O dossiê do documento passa a listar os
    dois arquivos.
13. [ ] Depois da correção salva, a pendência âmbar "nota sem CNO"
    (`lib/fiscal/resumo.ts:891-915`) deixa de listar esse documento —
    verificável comparando o resumo de pendências antes/depois. Automático,
    sem recálculo manual: a pendência é gerada ao vivo a partir de
    `notaTrazCno` a cada chamada.
14. [ ] `posicaoDeAfericao` (`lib/fiscal/afericao.ts`) passa a contar a nota na
    próxima chamada (sujeita às demais condições já existentes de
    `motivoForaDaBase`), sem necessidade de reabrir/recalcular nenhuma posição
    anterior — não existe tabela de "posição" de aferição persistida no
    projeto.
15. [ ] Link condicional em `/documento/[id]`, só quando `notaTrazCno ===
    false`: "Registrar que a nota agora traz o CNO — hoje: não traz CNO" →
    `/documento/[id]/corrigir/cno` (mesmo padrão dos outros links de
    correção).
16. [ ] Histórico de correções do documento mostra a mudança com os rótulos:
    campo "CNO impresso na nota" (`ROTULO_CAMPO.cno_referenciado`), motivo "o
    prestador enviou a nota com o CNO desta obra"
    (`ROTULO_MOTIVO_NO_RASTRO.cno_obtido_do_prestador`).
17. [ ] Migration `0033_motivo_cno_obtido_do_prestador.sql` (só `alter type
    motivo_revisao add value 'cno_obtido_do_prestador'`, sozinha — valor de
    enum é irreversível, mesmo precedente das migrations `0018`/`0030`) e
    migration `0034_corrigir_cno_documento.sql` (constraint
    `revisao_campo_da_entidade` recriada com `'cno_referenciado'` para
    `entidade = 'documento'`; a RPC do critério 8; `revoke execute ... from
    public, anon` + `grant execute ... to authenticated` explícito na mesma
    migration). `e2e/privilegios.spec.ts` (`FUNCOES_ESPERADAS.corrigir_cno_documento
    = "authenticated"`) e `lib/database.types.ts` atualizados no mesmo diff.

## Out of Scope
- **Doutrina de `outra_obra`** (bloqueio definitivo na entrada, "erro sem
  conserto depois da emissão") — não ganha rota de correção nesta story.
  Decisão do `contador` (Gate Fiscal): fica fora não por ser "mais arriscado",
  mas por ser "sem objeto" — `outra_obra` nunca persiste um documento (bloqueia
  no ato do registro, nunca grava esse estado), então não existe linha para
  corrigir. Lacuna futura (nota reemitida trocando um CNO *impresso* errado
  por outro) registrada no ADENDO 2026-10-22 do parecer de correção, não
  decidida aqui.
- **Recalcular retroativamente qualquer posição de aferição INSS** — não
  existe o que recalcular: confirmado pelo `contador` que `posicaoDeAfericao`
  é função pura, sempre on-demand, sem tabela de "posição" persistida.
- **Fundir esta correção com número/valor/retenção no mesmo ato de
  `documento-novo`** — CNO ganha seu próprio motivo de revisão, não um campo
  dentro de outro (mesma decisão já tomada no CONTAI-088/CONTAI-021 para
  regimes de consequência fiscal distintos).
- **Campo de motivo escolhível pelo usuário** — ao contrário de
  `corrigir/numero`/`corrigir/valor`/`corrigir/retencao`, esta tela não
  oferece `PassoMotivo`: o único motivo ratificado pelo Gate Fiscal é "dado
  ausente, agora obtido por reemissão do prestador", gravado automaticamente.
- **Diferenciar o tipo de instrumento do anexo na UI** (nota substitutiva vs.
  carta de correção vs. documento complementar) — o produto só exige que o
  papel mostre o CNO impresso e legível, não qual norma municipal o emitiu.
- **Redirecionamento automático** da tela de cadastro de CNO da obra de volta
  para `/documento/[id]/corrigir/cno` depois que o Mateus cadastra o CNO que
  faltava (Recusa 3) — fica com o link manual "Voltar ao documento" que a
  recusa já oferece; ver Pergunta Aberta 1.
- Gestão de cronograma, orçamento de engenharia ou comunicação com o
  prestador (cobrar a reemissão em si) — fora de escopo declarado do produto;
  o sistema só registra o resultado depois que o Mateus já cobrou por fora.

## Gate Fiscal (Contador)

**Fontes**: `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md`
§1 e **ADENDO — 2026-10-22** (ratifica `notaTrazCno`/`cnoReferenciado` como
corrigível); `docs/pareceres/2026-09-20-cno-nao-bloqueia-correcao-de-obra.md`
(parecer vizinho sobre CNO, confirmado como **não aplicável aqui** — trata de
`podeCorrigirObra`/`documento.obra_id`, eixo diferente do campo tratado nesta
story).

### Ratificação — `nao_traz → desta_obra` é corrigível

**Ratificado**, com ADENDO escrito e salvo no parecer acima. São dois estados
de origem, não dois pontos da mesma régua:
- **Se** `notaTrazCno = false` (documento já salvo, CNO genuinamente ausente
  na nota original) **e** o prestador reemitir a nota já com o CNO impresso →
  **corrigível**: grava `notaTrazCno = true` + `cnoReferenciado` = o CNO da
  própria obra, com anexo no mesmo ato.
- **Se** a resposta fosse `outra_obra` → não há o que corrigir aqui: esse
  estado bloqueia o registro no ato (critério 2 do CONTAI-007,
  `lib/types.ts:205-206`) e nunca chega a persistir (`notaTrazCno` é `boolean
  | null`, sem terceiro valor gravável). A doutrina de bloqueio definitivo de
  `outra_obra` **não é tocada, não é reaberta, não é afrouxada** por esta
  story.

### Posição de aferição INSS — sempre on-demand, confirmado em código

**Confirmado, não é leitura de produto — é fato de código**:
`posicaoDeAfericao` (`lib/fiscal/afericao.ts`) é função pura, recalculada a
cada chamada a partir do `Documento`/`Obra` atuais; não existe tabela de
"posição" ou "relatório de aferição" persistida nas migrations. A pendência
âmbar "nota sem CNO" (`lib/fiscal/resumo.ts:891-915`) também é gerada ao vivo.
**Consequência**: não existe nada para reabrir ou recalcular. No instante em
que `notaTrazCno` virar `true`, a próxima chamada de `posicaoDeAfericao` já
conta a nota (sujeita às demais condições de `motivoForaDaBase`), e a próxima
chamada de `resumo` já para de listar a pendência.

### Escopo de `outra_obra` ganhar rota de correção — lacuna registrada, não doutrina fechada por impossibilidade

**Decisão do contador: fica fora do CONTAI-101**, e a razão não é "mais
arriscado" — é "sem objeto". `outra_obra` nunca produz uma linha de
`documento` para corrigir. Se um dia aparecer o caso diferente — nota que
**imprimiu** um CNO (não ausente) e precisa trocá-lo por outro — isso cairia
na régua geral do §3 do corpo do parecer de 18/08 e seria um terceiro estado
que o produto hoje não modela. Registrado como lacuna futura no ADENDO de
22/10, não como porta fechada para sempre.

### Tipo de anexo exigido — nem toda correção de CNO exige nota substitutiva integral

A régua do CONTAI-085 (sempre nota reemitida inteira) **não se transfere
automaticamente** para CNO. O §3 do corpo do parecer de 18/08 distingue: dado
com efeito no valor da nota (valor, CPF/CNPJ do destinatário, data de
emissão) → só nota substitutiva; dado **sem** efeito no valor → carta de
correção serve. CNO impresso é dado sem efeito no valor — mais perto da
segunda classe. **Se** o município permitir carta de correção/documento
complementar para incluir CNO em NFS-e já emitida → o produto deve aceitar
esse anexo, não exigir reemissão integral por padrão. **Se** não houver
certeza sobre o que a legislação municipal específica permite →
`[Likely, confirmar na legislação municipal]`, nunca afirmado como fato.
**Regra para a tela, independente do instrumento**: exigir um anexo em que o
CNO apareça impresso e legível — o produto não diferencia o tipo de
instrumento na UI, só exige que o papel mostre o dado (critério 7).

### Automático × só o Mateus × CRC

**Automático**: oferecer a opção "CNO" em `documento-novo` apenas quando
`notaTrazCno === false` (nunca para `null`/`true`); recusar gravar sem anexo;
gravar `notaTrazCno = true` + `cnoReferenciado = obra.cno`; rastro em
`revisao` com motivo próprio `cno_obtido_do_prestador`; "anos afetados"
sempre vazio; pendência "nota sem CNO" deixa de listar o documento e
`posicaoDeAfericao` passa a contá-lo, ambos sem ação extra; recusar a opção
para `outra_obra` (não existe, nunca persiste) e para `null` (fora de
escopo).

**Só o Mateus**: afirmar que o CNO do anexo reemitido é o impresso nele
(mesmo padrão do §2/§3 do corpo do parecer de 18/08, aplicado a este campo) —
ação implícita no clique de "Gravar a correção" com o anexo visível na tela.

**CRC**: nenhum. Este campo não alimenta a ficha Bens e Direitos nem a GCAP —
o que ele alimenta é a posição de aferição do INSS, que não é apuração da
DAA e não tem retificadora própria no escopo deste produto.

## Pre-mortem
1. **Reemissão troca mais de um campo.** Em 3 meses, uma nota reemitida chega
   com CNO *e* número/série diferentes ao mesmo tempo (comum: reemissão
   completa reabre o documento inteiro), e esta tela só aceita corrigir CNO
   isoladamente. O Mateus fecha a pendência de CNO e esquece de abrir a
   correção de número/série porque "já resolvi o que vim aqui resolver" — o
   acervo fica com um número de nota que não bate com o anexo mais recente, e
   não existe pendência que avise isso.
2. **Pendência recalculada por caminho diferente do gravado.** Em 3 meses,
   algum outro ponto do código que monta a lista de pendências âmbar lê
   `notaTrazCno` de um jeito que não reflete a correção recém-gravada (cache,
   view materializada, campo derivado desatualizado), e o documento corrigido
   continua aparecendo como "nota sem CNO" — é a classe de bug que o critério
   13 (antes/depois) existe para pegar, mas só pega se alguém de fato testar
   o antes/depois e não só a gravação do campo.
3. **Posição de aferição "congelada" ignorada.** Em 3 meses, descobre-se que
   existia sim uma posição de aferição INSS já fechada/registrada antes da
   correção (contrariando a confirmação do contador), e ninguém avisou o
   Mateus que aquele relatório antigo ficou desatualizado — ele passa a
   confiar numa posição que não reflete mais o estado real do documento, sem
   saber que precisa regerar.

## Viabilidade (CTO)

**Desvio em relação ao critério 3 original do `po`** ("anexo condicional por
motivo, igual às correções existentes"): o ADENDO 2026-10-22 ratifica uma
única causa (dado genuinamente ausente, agora obtido do prestador) — não há
motivo a perguntar. Oferecer `PassoMotivo` abriria um caminho sem anexo (ex.
"eu digitei errado") que gravaria `notaTrazCno = true` sem papel nenhum
mostrando o CNO — a divergência app↔papel que o §3 do parecer proíbe.
Resolvido: motivo fixo, gravado pela máquina, anexo incondicional — mesmo
regime de `arquivamento_corrigido` (0009), `comprovante_chegou_depois` (0018)
e `comprovante_reaproveitado_de_irmao` (0030). Já incorporado nos critérios
4, 7 e 10 acima.

- **Modelo de dados**: zero tabela, zero coluna nova. Duas migrations,
  separadas pelo precedente das migrations `0018`/`0030` (`add value` em enum
  é irreversível e fica isolado para auditoria): `0033` só adiciona o valor
  de enum `motivo_revisao`; `0034` recria `revisao_campo_da_entidade` com
  `'cno_referenciado'` para `entidade = 'documento'`, cria a RPC e faz
  `revoke`/`grant` explícito. **Uma linha de `revisao`, não duas**:
  `cno_referenciado`/`nota_traz_cno` são um fato só, amarrado pelo check
  `documento_cno_coerente` (0015) — duas linhas mostrariam duas correções
  onde houve uma (a mesma armadilha do `LinhaDoAto` que o CONTAI-085
  consertou). `lib/types.ts`: `CampoRevisao` ganha `"cno_referenciado"`;
  `MotivoRevisao` cresce sozinho via `Enums<"motivo_revisao">`.
- **RPC**: `corrigir_cno_documento(p_documento_id uuid, p_anexo_path text)
  returns uuid` — `language plpgsql`, `security invoker`, `set search_path =
  public, pg_temp`. Função **nova**, não extensão de `corrigir_documento` nem
  de `corrigir_numero_documento`: aridade diferente (sem motivo), com guarda
  de pré-condição de estado que nenhuma das duas tem, e lê `obra`. Ordem:
  anexo ausente/vazio → exception; documento não encontrado (`for update of
  d`) → exception; `nota_traz_cno is distinct from false` → exception (cobre
  `null` e `true`); `obra.cno` nulo/vazio → exception; grava
  `nota_traz_cno = true`, `cno_referenciado = obra.cno` (lido no servidor,
  dentro da transação — nunca `p_cno`, mesmo valor que
  `cnoReferenciadoParaBanco(tipo, "desta_obra", obra.cno)` grava na captura);
  insere a linha de `revisao` (`motivo = 'cno_obtido_do_prestador'`,
  `motivo_texto = null`) + `revisao_gravar_anos(..., '[]'::jsonb)`; insere
  `documento_anexo` vinculado à `revisao_id`; retorna o `ato_id`. A única
  coisa que `cnoReferenciado` tem e `numero` não tinha: o valor é derivado de
  outro registro corrigível (`obra.cno`) — se a obra tiver o CNO corrigido
  depois, o documento guarda a string antiga de propósito (0015: "o papel não
  muda quando o cadastro muda") e `posicaoDeAfericao` devolve
  `cno_divergente`, comportamento já existente, sem trabalho extra.
- **Tela**: `app/(gestao)/documento/[id]/corrigir/cno/page.tsx`, cópia de
  `corrigir/numero/page.tsx` cortando `PassoMotivo`, `exigeAnexoNovo`, o
  bloco de custo por ano, `duplicataDe` e os dois `CampoTexto`. Mantém
  `Suspense`+`useSearchParams` (`lerPacote`/`lerAnexoDoPacote`/
  `proximaDoPacote`), `ListaDeAnexos`, `ChipsDeAnexoExistente`/`CampoArquivo`,
  `subirParaAcervo(anexo, "documento")` antes da RPC,
  `useSessao().pedirReautenticacao`, `mensagemDeErroDeGravacao`. Carrega
  também `carregarObra(d.obraId)` para mostrar o CNO que vai ser gravado.
  Passo único (sem motivo, sem campo digitável); três recusas no topo
  (mesmo padrão de "recusar cedo" de `corrigir/retencao`).
- **Pacote**: `CorrecaoDoPacote = "numero" | "valor" | "retencao" | "cno"`;
  `ORDEM_DO_PACOTE` ganha `"cno"` por último (ordem, não regra fiscal);
  `ROTULO_DA_CORRECAO.cno = "o CNO"`. Em `documento-novo/page.tsx`, 4ª opção
  no mesmo spread condicional da retenção. `lerPacote` continua whitelist.
  `pacote-correcao.test.ts` ganha o 4º token.
- **Link em `/documento/[id]`**: condicional, ao contrário dos outros links
  de correção (ali sempre há o que corrigir; aqui a pré-condição é o ponto).
  A pendência âmbar (`resumo.ts:891-915`) já aponta para `/documento/[id]` e
  filtra por `notaTrazCno !== false` — critério 13 sai sem mudar
  `resumo.ts`; `lib/fiscal/afericao.ts` já devolve `conta` para `true` + CNO
  coincidente: on-demand, nada a recalcular.
- **Privilégios/tipos**: `e2e/privilegios.spec.ts` →
  `FUNCOES_ESPERADAS.corrigir_cno_documento: "authenticated"`.
  `lib/database.types.ts` à mão: `Functions.corrigir_cno_documento: { Args: {
  p_documento_id: string; p_anexo_path: string }; Returns: string }` (sem
  default — os dois parâmetros são obrigatórios) e `Enums.motivo_revisao` +
  `"cno_obtido_do_prestador"`. `lib/data.ts` →
  `corrigirCnoDoDocumento({ documentoId, anexoPath }): Promise<string>`.
- **`app/_components/corrigir.tsx`**: `MotivoEscolhido` exclui também
  `"cno_obtido_do_prestador"` (nunca entra em `PassoMotivo` de nenhuma tela);
  `ROTULO_MOTIVO_NO_RASTRO.cno_obtido_do_prestador = "o prestador enviou a
  nota com o CNO desta obra"`; `ROTULO_CAMPO.cno_referenciado = "CNO impresso
  na nota"`.
- **Testes**: `e2e/corrigir-cno.spec.ts` (molde `corrigir-numero.spec.ts`):
  (1) `nao_traz` + anexo → grava corretamente, 1 linha de `revisao`, +1
  `documento_anexo`, `arquivo_path` intacto, zero `revisao_ano_afetado`; (2)
  sem anexo → botão desabilitado e RPC recusa; (3) documento `true`/`null` →
  tela recusa e `documento-novo` não lista a opção; (4) pendência "Nota sem
  CNO" presente antes, ausente depois; (5) obra sem CNO → recusa (RPC e
  tela); (6) `privilegios.spec.ts` verde com a função nova.
- **Arquivos**: `supabase/migrations/0033_motivo_cno_obtido_do_prestador.sql`,
  `supabase/migrations/0034_corrigir_cno_documento.sql`,
  `lib/database.types.ts`, `lib/types.ts`, `lib/data.ts`,
  `lib/gestao/pacote-correcao.ts` + `.test.ts`, `app/_components/corrigir.tsx`,
  `app/(gestao)/documento/[id]/corrigir/cno/page.tsx` (novo),
  `app/(gestao)/documento/[id]/documento-novo/page.tsx`,
  `app/(gestao)/documento/[id]/page.tsx`, `e2e/privilegios.spec.ts`,
  `e2e/corrigir-cno.spec.ts` (novo). **Não tocar**: `lib/fiscal/resumo.ts`,
  `lib/fiscal/afericao.ts`, `lib/fiscal/obra.ts`,
  `app/(captura)/adicionar/documento/page.tsx`.
- **Complexidade: S** — menor que o `085` em lógica (sem motivo, sem
  duplicidade, sem comparação de campo), com um arquivo de migration a mais
  pelo precedente do enum.
- **Dívidas**: nenhuma nova. As lacunas do ADENDO §3 (`null` legado;
  `outra_obra` reemitida com o CNO certo) ficam registradas no parecer, não
  neste ticket. Release: `npx supabase db push` (0033 e 0034) **antes** do
  `git push`.
- **Pergunta obrigatória do repo** ("depende de default do stack local?"):
  não — sem tabela, coluna, sequence ou view; função nova com revoke/grant
  explícito no mesmo diff, e o mapa de `privilegios.spec.ts` fica vermelho se
  faltar.

## Dependências
Bloqueado por / Bloqueia: nenhum. **Independente** — os caso-irmãos
(`CONTAI-085`/`086`/`087`/`088`) já estão entregues; esta story só reaproveita
o molde deles, sem ordem obrigatória com nenhum ticket aberto na fila.

## Perguntas Abertas
1. **Não bloqueante, para o `cto-obra`/`lead-engineer` confirmar no Gate 1**:
   confirmar que `carregarDocumento` já traz `cnoReferenciado` sem chamada
   extra, para o texto da Recusa 2 (`notaTrazCno === true`) mostrar o CNO já
   impresso.
2. **Não bloqueante, para o `po`/Mateus decidirem se importa**: na Recusa 3
   (obra sem CNO cadastrado), depois de cadastrar o CNO em `/obras/[id]`, o
   Mateus deveria ser redirecionado de volta a
   `/documento/[id]/corrigir/cno` automaticamente, ou basta o link manual
   "Voltar ao documento" que a recusa já oferece hoje? Leitura padrão até
   resposta: (b), sem redirecionamento automático — não presumir fluxo sem
   requisito fechado.

## Cenário e checagem final
**Gestão** — correção documental, em casa, sentado, não captura no canteiro.
Serve à meta 1 (documento hábil correto) e à meta 2 (aferição INSS íntegra:
fecha a pendência "Nota sem CNO" que hoje nunca fecha sozinha). Sem condição
fiscal órfã — os textos citados (`CNO_NAO_ALCANCA_O_CUSTO` e
`CONSEQUENCIA_CNO_DA_NOTA`, `lib/fiscal/obra.ts:255-267`) vêm verbatim do
ADENDO 2026-10-22 ao parecer `2026-08-18-correcao-de-documento-registrado.md`,
nenhum reescrito de memória. Sem UI que quebre disciplina de campo fiscal:
não há campo fiscal em branco nesta tela — o único "campo" é o anexo (ato,
não pergunta), e o CNO exibido é fato derivado de `obra.cno`, lido no
servidor, nunca digitado. Teste do Canteiro não se aplica (tela de gestão,
não de captura).
**Veredito: APROVADO.** Pronto para `/develop`.
