## Duas condições fiscais sem rede — 2026-08-23 — achado do Gate 2 do `CONTAI-029`

O `CONTAI-029` pôs teste unitário nos 14 mappers puros. O valor previsto era
esse. **O valor real foi outro**: obrigar o `contador` a conferir condição por
condição contra o código expôs duas que **ninguém segura**.

### D42 — a condição 6 não tem rede NENHUMA, nem unitária nem E2E ⚠️

**A condição** (Gate Fiscal do `CONTAI-028`): *se só a classificação muda →
`p_anos: []`. Nenhum total se move, logo **nenhuma pendência nasce**. Passar
`anos` aqui **inventa retificadora**.*

**O que se descobriu:**

- O teste unitário do `CONTAI-029` prova `paraAnosJson([]) → []`. **Não serve**:
  `corrigirClassificacaoDoDocumento` **nunca chama `paraAnosJson`** — passa
  `p_anos: []` literal (`lib/data.ts:532`). Trocar aquela linha por
  `paraAnosJson(anos)` deixaria o teste verde **do mesmo jeito**.
- **E não há E2E.** `e2e/acervo.spec.ts:205` só abre a tela para conferir o
  anexo; não submete a correção de classificação nem confere que
  `revisao_ano_afetado` ficou vazio.

**A consequência, se a condição quebrar:** corrigir a classificação de um
documento (material ↔ mão de obra) passaria a **abrir pendência de
retificadora** sobre um ano já declarado, por uma correção que **não move um
centavo do total**. O Mateus veria o app dizendo que precisa conversar com o
contador sobre um ano fechado, por nada. E o inverso — pendência que devia
nascer e não nasce — é pior e igualmente desprotegido.

Palavras do `contador` no gate: *"é o resultado mais valioso desta revisão"*.
**Merece ticket próprio de E2E**, não uma linha de backlog: o caminho é de I/O,
e teste unitário não alcança.

### D43 — o formato do rastro é uma expressão anônima dentro de uma RPC

`corrigirValorDoDocumento` (`lib/data.ts:504`) grava `p_depois` como
`centavosParaNumeric(c).toFixed(2)` — **texto de duas casas**, porque
`revisao.antes`/`revisao.depois` são colunas `text` (migration 0009). Texto é o
que preserva `null` (o "(em branco)" da tela s3c), zeros à esquerda e enum.
`String(n)` publicaria `"4850"`; `toString()`, `"4850.5"`. Os dois quebram o
antes→depois que sustenta a conversa de retificadora.

**O problema não é o código — é que a expressão não tem nome.** Sendo anônima
dentro da chamada de RPC, só um teste que fale com o Postgres pode vê-la, e hoje
isso é **uma única asserção**: `e2e/correcao.spec.ts:96` (`depois: "12800.00"`).

⚠️ **E ela é frágil de um jeito específico**: duas linhas abaixo, as asserções
de `custo_antes` já usam `Number(...)`. O dia em que alguém "uniformizar" a linha
96 para `Number(rastro[0].depois)`, **o formato perde a rede inteira e ninguém
fica sabendo** — a suíte continua verde.

**A cura, nomeada pelo `contador`**: dar nome à expressão — um
`textoDoRastro(centavos): string` puro em `lib/dados/comum.ts`, que o teste
unitário alcança.

**Onde**: é refactor, proibido pelo Out of Scope do `CONTAI-029` e fora da fatia
1 do `CONTAI-028`. Vai para a **fatia 5 do `CONTAI-028`**, que move aquela linha
para `lib/dados/correcao.ts` de qualquer jeito.

### O mapa que sobrou: 10 das 16 condições só têm E2E

Não é falha de ticket nenhum — são condições de I/O, o Out of Scope do
`CONTAI-029` as exclui, e **stub de backend é proibido no projeto**. Mas a lista
explícita não existia, e agora existe:

| # | Condição | Quem cobre |
|---|---|---|
| 2 | informe de outra obra filtrado; nada soma entre matrículas | E2E `obra.spec.ts` |
| 5 | `emitente_corrigiu_a_nota` exige anexo, e ele é **adicional** | E2E `correcao.spec.ts` |
| **6** | **só classificação → `p_anos: []`, nenhuma pendência nasce** | **NINGUÉM** — ver D42 |
| 7 | nome do favorecido muda sem tocar CPF/CNPJ | E2E `correcao.spec.ts` |
| 8 | `garantirFavorecido` com `ignoreDuplicates` | E2E |
| 10 | `baixarPendencia` é INSERT, nunca UPDATE | E2E `correcao.spec.ts` |
| 11 | `marcarEmitenteErrado` idempotente | E2E |
| 13 | desembolso de terreno em **um ato só** (RPC) | E2E `terreno.spec.ts` |
| 15 | `VinculoEntreObrasError` no código, não na policy | E2E |
| 16 | link assinado 120 s; duas consultas separadas | E2E `acervo.spec.ts` |

Mais duas **parciais**: a **4** (o lado do mapper está unitário; o `.toFixed(2)`
é E2E — ver D43) e a **14** (a ordem dos anexos lidos está unitária; "anexos
antes da resposta" e "o valor nunca é tocado" são E2E).

### A correção da condição 4, e o erro era de redação

A condição 4 original juntava duas coisas que o banco separa. Foi desdobrada em
**4a** (call-site de I/O, texto, coluna `text`) e **4b** (mapper puro, número,
coluna `numeric(14,2)`) no `docs/tickets/CONTAI-028.md`, com a redação do
`contador`.

O `CONTAI-029` chegou a nascer com o critério 4 apontando para o **call-site
errado** — erro do orquestrador ao transcrever. Quem pegou foi o
`lead-engineer`, que **anotou e não consertou**, como o ticket manda.

⚠️ **Não introduzir `.toFixed(2)` em `paraAnosJson` "por simetria" com o 4a.**
Os dois formatos estão certos para os seus destinos.
