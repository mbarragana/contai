# CONTAI-088 Ponto de entrada único para correção de documento com anexo reaproveitado

## Tipo e Prioridade
feature — **P1 (fricção de processo)** — nenhuma correção individual está
bloqueada hoje (CONTAI-085/086/087 já entregues e funcionam isoladamente),
mas a navegação repetida entre telas de correção, quando mais de uma se
aplica ao mesmo documento novo, já produziu um efeito colateral
concreto: upload duplicado no acervo.

## Dor de Origem
`docs/backlog/103-2026-10-05-ponto-entrada-unico-correcao-documento.md`:
no mesmo dia da correção PerfuraTec 261→263, o Mateus usou o CONTAI-086
pra registrar a nota 263 e, no processo, acabou subindo o arquivo errado
numa de duas ações separadas que precisou fazer — resultado, 2 cópias do
mesmo `NFSE_261_9012085_1_1.pdf` no acervo, sem caminho de remoção
(`documento_anexo` nunca teve GRANT de DELETE). Frase que fecha o relato:
*"eu deveria poder fazer tdoas as correções em uma unica edição: número,
valor, retenção"* — fusão avaliada e recusada na mesma conversa
(reafirma CONTAI-021); solução acordada foi este ponto de entrada sem
fundir dados, aceite do Mateus: *"sim, vamos seguir esta sua ideia do
fluxo."*

## User Story
Como o Mateus, gerenciando a obra em casa, sentado, depois de receber de
um prestador um documento substituto/corrigido, quando eu abro "Recebi um
documento novo para esta nota" a partir da tela de detalhe do documento
já registrado, eu quero anexar o novo arquivo uma vez (ou escolher um já
existente) e marcar quais correções ele traz (número/série, valor,
retenção — uma ou mais), para que eu percorra cada correção já existente
(CONTAI-085/086/087) sem re-navegar, re-explicar o motivo nem re-subir o
mesmo PDF em cada tela separada.

## Critérios de Aceite

**Fatia A — chip de reaproveitar anexo em `corrigir/numero` e `corrigir/valor`**
(hoje só existe em `corrigir/retencao`, CONTAI-086; entregável e
deployável sozinha, vem antes da fatia B)

1. [ ] `/documento/[id]/corrigir/numero` e `/documento/[id]/corrigir/valor`,
   com `motivo = emitente_corrigiu_a_nota`, ganham chip para reaproveitar
   um anexo adicional já existente (data+origem) — mesmo componente e
   regra dos critérios 9/10 do CONTAI-086. O anexo ORIGINAL do documento
   (`documento.arquivo_path`) nunca aparece como chip. Componente
   compartilhado novo (`app/_components/corrigir.tsx`), extraído do
   CONTAI-086 no mesmo diff que o consome — não duplicado 3×.

**Fatia B — ponto de entrada + navegação sequencial**

2. [ ] Rota nova `/documento/[id]/documento-novo`, linkada de
   `/documento/[id]` (topo do bloco "Corrigir este registro"): "Recebi um
   documento novo para esta nota — corrigir número, valor e/ou
   retenção".
3. [ ] Passo 1 do ponto de entrada: lista os anexos adicionais já
   existentes no documento (arquivo, data, origem) como chips, OU a
   opção "Vou anexar um arquivo novo". **O ponto de entrada não faz
   upload nem grava nada**: com "arquivo novo", o upload só acontece
   dentro da PRIMEIRA correção da sequência, e o `arquivo_path`
   resultante é repassado às seguintes — evita objeto órfão no bucket se
   o Mateus desistir no meio do pacote.
4. [ ] Passo 2: checkboxes das 3 correções (número/série, valor,
   retenção), pelo menos uma marcada pra habilitar "Continuar". Ordem
   default de navegação: número → valor → retenção (não é regra, é
   ordem).
5. [ ] "Continuar" leva à primeira correção marcada com
   `?pacote=<restantes>&anexo=<arquivo_path ou vazio>` na URL.
6. [ ] **Verificável em E2E**: ao confirmar N correções do mesmo pacote
   com o mesmo papel, `documento_anexo` ganha N linhas com o MESMO
   `arquivo_path` e `revisao_id` distintos (cada ato tem seu próprio
   rastro — nunca reusa a linha física de outro ato), e o bucket
   `acervo` ganha no máximo UM objeto novo (zero se o papel já existia).
7. [ ] Se o Mateus sair no meio do pacote, cada correção já confirmada
   fica valendo normalmente (aparece no histórico) — o pacote nunca é
   tudo-ou-nada; as correções pendentes continuam acessíveis
   individualmente pelas rotas de hoje.
8. [ ] O ponto de entrada em si **não grava nenhuma linha própria em
   `revisao`** — o rastro é exclusivamente a soma das correções
   individuais efetivamente confirmadas.
9. [ ] Nenhum texto de consequência fiscal é escrito ou reescrito nesta
   rodada: todo texto fiscal mostrado dentro de cada correção é o já
   existente, copiado dos pareceres já citados nos tickets
   CONTAI-085/086/087.
10. [ ] **`PassoMotivo` é perguntado e decidido POR correção, nunca uma
    vez só pro pacote inteiro** — a obrigatoriedade de anexo depende do
    motivo daquela correção específica (parecer
    `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` §5;
    CONTAI-085 critério 6; CONTAI-086 critério 9). `?anexo=<path>` só
    pré-seleciona o chip; é ignorado quando o motivo daquela correção
    não exige anexo.
11. [ ] `?anexo=<path>` só é aceito se o path estiver na lista de
    `carregarAnexosDoDocumento(d.id)` daquele documento; senão nada é
    pré-selecionado e a tela diz: "O papel indicado não está neste
    documento — escolha um abaixo ou anexe." Sem `?anexo`/`?pacote`, as
    três rotas se comportam exatamente como hoje (E2E existentes passam
    sem mudar asserção).
12. [ ] Tela "gravado" de cada correção, em modo pacote (há próxima no
    `?pacote`): botão primário "Continuar: corrigir o {próximo} →" com o
    `?pacote` restante e `?anexo` = path efetivamente usado neste ato
    (upload novo ou chip); o botão padrão de hoje ("Ver o documento"/
    equivalente) vira secundário. No passo do campo (antes de gravar),
    "Cancelar" vira "Pular esta e continuar: corrigir o {próximo} →"
    quando em modo pacote, sem gravar nada.
13. [ ] Antes de "Gravar" em cada correção do pacote, a tela mostra o
    papel escolhido: upload novo → preview inline
    (`ControleVerDocumento`/`LightboxDoAnexo`); anexo via chip → o
    anexo selecionado renderizado como `ItemDeAnexo` com "Abrir" (mesmo
    mecanismo já usado no detalhe do documento e em `ListaDeAnexos` —
    `LightboxDoAnexo` exige um `File` em memória, que não existe para um
    anexo já no acervo).
14. [ ] `ListaDeAnexos` do detalhe do documento agrupa entradas com o
    mesmo `arquivo_path` repetido (uma linha por correção que o usou)
    como um item só, com "usado em N correções".

## Out of Scope
- **Fundir número + valor + retenção num único formulário/INSERT/UPDATE.**
  Avaliado e recusado explicitamente na conversa de origem, reafirmando a
  doutrina do CONTAI-021 e dos tickets 085/086/087: os três campos vivem
  em regimes de consequência fiscal diferentes.
- **Apagar o anexo duplicado já existente no acervo.** Sem caminho por
  desenho (`documento_anexo` nunca teve GRANT de DELETE) — clutter
  inofensivo, não distorce nenhuma das três metas do produto.
- **Deduplicação ou merge automático de anexos existentes** na lista do
  Passo 1 do ponto de entrada — listar duplicados sem tratamento
  especial é suficiente.
- **Correção/investigação do chip do CONTAI-086/087.** Investigado nesta
  rodada (Viabilidade): não é bug de não-exibição — o duplicado do caso
  real foi o Mateus escolhendo o arquivo errado no seletor de upload
  (261 em vez de 263), e o chip corretamente não oferece o anexo
  original. Não vira ticket de correção; o que endereça essa classe de
  erro é o critério 13 (preview antes de gravar).
- **RPC/transação única cobrindo o pacote inteiro.** Cada correção
  continua sua própria RPC/transação, como hoje — o pacote é roteamento
  de UI, não unidade de gravação.
- **Upload dentro do ponto de entrada.** Ver critério 3 — evita objeto
  órfão no bucket.
- **Chip de anexo em `corrigir/classificacao`/`corrigir/emitente`.**
  Dívida nomeada, fora desta rodada (não fazem parte do pacote de
  correções deste ticket).
- **Gestão de cronograma de obra, orçamento vs. realizado.** Fora de
  escopo permanente do produto (CLAUDE.md).

## Gate Fiscal (Contador)
**Sem impacto fiscal NOVO**, com uma condição herdada que vira critério
de aceite obrigatório (critério 10).

O desenho (roteador de UI puro, anexo pedido/escolhido uma vez, cada
correção chamando sua própria RPC já aprovada e gravando sua própria
linha em `revisao`) não introduz regra, cálculo ou afirmação fiscal
nova — consequência direta de fatos já ratificados nos tickets de
origem:
- Os três campos são **ortogonais entre si**: `numero`/`serie` não move
  custo nem aferição (CONTAI-085); `retencao_na_nota`/linhas não move
  custo nem aferição (CONTAI-086/087); `valor` é o único que move custo
  entre exercícios (parecer `2026-08-18-correcao-de-documento-registrado.md`
  §0(a)). Nenhum dos três lê ou decide em função do valor atual dos
  outros dois — rodar as três RPCs em sequência sobre o mesmo documento
  não cria caminho de cálculo cruzado que não existisse já com as
  correções feitas em dias separados.
- Cada RPC lê o "antes" do estado **atual do banco** no momento da
  própria chamada (nunca passado pelo client) — elimina risco de
  encadeamento (ex: "correção 2 grava antes errado porque a tela não
  recarregou depois da correção 1").
- Checagem de duplicidade de `numero`/`serie` compara contra OUTROS
  documentos da obra, nunca é afetada por `valor` ou `retencao_na_nota`
  do próprio documento.
- **Não há ordem obrigatória** entre número, valor e retenção — nenhuma
  depende do resultado das outras.
- **Condição obrigatória**: motivo (`PassoMotivo`) é perguntado e
  decidido por correção, nunca uma vez só pro pacote inteiro — a
  obrigatoriedade/condição de anexo é função do motivo daquela correção
  específica (parecer `2026-08-18-correcao-de-documento-registrado.md`
  §5; CONTAI-085 critério 6; CONTAI-086 critério 9). Motivo
  compartilhado por desenho herdaria silenciosamente a decisão de
  anexo-obrigatório de uma correção para as outras, mesmo quando elas
  genuinamente diferem (ex.: número corrigido por erro de digitação
  minha, mas retenção revelada por carta do emitente).

Nada aqui exige CRC — é agrupamento de navegação sobre regras já
aprovadas, nunca regra nova.

## Pre-mortem
1. **O roteador vira uma 4ª implementação em vez de casca sobre as 3
   existentes.** Risco: reimplementar lógica de upload/anexo dentro do
   ponto de entrada em vez de reutilizar os componentes/RPCs já
   existentes — criaria um 4º caminho de gravação de anexo pra manter,
   contrariando o próprio motivo do ticket. Mitigado pelos critérios 1
   (componente compartilhado) e 3 (upload só dentro da 1ª correção).
2. **A lista de anexos existentes (Passo 1) reproduz a mesma ambiguidade
   que causou o incidente original.** Com 2+ cópias do mesmo arquivo já
   no acervo, um menu de anexos pode reproduzir a mesma escolha errada
   — agora com mais opções na lista, não menos. Mitigado pelo critério
   13 (preview antes de gravar em cada correção, não só no ponto de
   entrada).
3. **O pacote presume que as 3 correções aceitam "anexo pré-preenchido"
   de forma simétrica, mas elas não nasciam simétricas.** Mitigado pela
   fatia A (critério 1): `numero`/`valor` ganham o mesmo mecanismo de
   chip que `retencao` já tinha, antes da fatia B existir.

## Viabilidade (CTO)

### Correções de premissa (fundamentam os critérios acima)
- **Não existe "passar `documento_anexo.id`"**: o contrato das RPCs é
  `p_anexo_path text`, e cada ato grava uma linha NOVA em
  `documento_anexo` (migrations `0027`/`0028`: "LINHA NOVA mesmo quando
  o `arquivo_path` já está em `documento_anexo`"). A identidade que
  viaja entre telas é o **`arquivo_path`**, não um id.
- **O duplicado do caso real não foi falha do chip** — foi arquivo
  errado escolhido no seletor de upload (o chip exclui de propósito o
  anexo original, que foi o arquivo duplicado). Não recomendado ticket
  de correção de chip (ver Out of Scope).
- **`corrigir/numero` e `corrigir/valor` só tinham `CampoArquivo` →
  upload** (sem chip) antes deste ticket — por isso a fatia A é
  trabalho real deste ticket, não suposição.

### Mecanismo
- Anexo viaja como `?anexo=<arquivo_path>` (URL-encoded) na querystring
  entre as rotas. Cada rota roda `carregarAnexosDoDocumento(d.id)`
  (RLS-scoped) e só pré-seleciona o chip se o path estiver nessa lista —
  nunca manda à RPC um path que a tela não viu na lista do próprio
  documento (critério 11). Sem `?anexo`, comportamento idêntico a hoje.
  `numero`/`valor` ganham `Suspense` em volta de `useSearchParams`
  (padrão já usado em `corrigir/retencao`).
- Sequência: `?pacote=valor,retencao` consumido rota a rota. Função pura
  nova `lib/gestao/pacote-correcao.ts`: `lerPacote(searchParams)`
  (whitelist, ignora lixo) e `proximaDoPacote(pacote, anexoUsado) →
  {href, rotulo} | null`, com Vitest.
- **Modelo de dados**: nenhuma tabela, coluna, RPC ou migration nova —
  reaproveita `corrigir_numero_documento`, `corrigir_valor_documento`,
  `corrigir_gate_retencao`/`adicionar_linha_retencao_registrada`, todas
  já aceitando `p_anexo_path` de objeto existente. `privilegios.spec.ts`
  intocado.

### Arquivos
Novo: `app/(gestao)/documento/[id]/documento-novo/page.tsx`;
`lib/gestao/pacote-correcao.ts` + `.test.ts`;
`e2e/pacote-correcao.spec.ts`. Alterados:
`app/(gestao)/documento/[id]/corrigir/{numero,valor,retencao}/page.tsx`;
`app/_components/corrigir.tsx` (componente compartilhado de chip);
`app/_components/anexo.tsx` (agrupamento por path); `documento/[id]/page.tsx`
(link); `e2e/corrigir-numero.spec.ts`, `e2e/correcao.spec.ts` (chip em
numero/valor); `design/mocks/CONTAI-088.md`.

**Complexidade: M** (zero SQL; risco é regressão nas três rotas
existentes — os E2E delas são a rede de proteção). **Dívida nova**: chip
de anexo em `classificacao`/`emitente` fica fora (nomeada, não fiscal).

## Dependências
Bloqueado por / Bloqueia: nenhum ticket externo. Dentro deste ticket:
fatia A (critério 1) é pré-requisito técnico da fatia B (critérios 2+) —
mesma implementação/Gate 1, não tickets separados.

## Perguntas Abertas
Nenhuma — as duas perguntas do relato 103 (ponto de entrada é só UI
roteadora; por que o chip não evitou o duplicado) foram resolvidas nesta
rodada (Gate Fiscal: sem impacto fiscal novo; Viabilidade: não é bug,
foi escolha errada de arquivo no upload).

## Cenário e checagem final
**Gestão** — correção documental, em casa, sentado. Serve à meta 1
(documento hábil correto) e à meta 3 (acervo correto, sem duplicação de
esforço nem de arquivo). Sem condição fiscal órfã — toda condição cita o
parecer de origem ou a ratificação desta rodada. Sem UI que quebre
disciplina de campo fiscal (motivo sempre perguntado por correção,
nunca default compartilhado).
**Veredito: APROVADO.** Pronto para `/develop`.
