# Fatiamento do CONTAI-011 — 2026-09-23

## O que aconteceu

O `lead-engineer` tentou o Gate 1 do `CONTAI-011` (declarado "pronto para
`/develop`" no dia anterior, `docs/backlog/61-2026-09-23-po-fecha-lacunas-contai-011-048.md`)
e não implementou nada — árvore limpa. Trouxe de volta um fatiamento
recomendado e dois achados que nenhuma das rodadas anteriores (incluindo a de
destravamento do dia 22/23) tinha visto.

## Fatiamento

O `po` aceitou a proposta do `lead-engineer`, com ajustes de detalhe:

- **`CONTAI-011` (011-A)** — rotina periódica + sinal no app. Critérios 1, 2,
  3, 5, 6, 8, 9, 11, 13, 14 + **detecção** (não triagem) de objeto órfão.
  Reescrito no mesmo arquivo, escopo podado, critérios movidos marcados
  `~~riscado~~` (mesma convenção já usada para o antigo critério 7 →
  CONTAI-012). **Zero decisão pendente, pronto para `/develop`.**
- **`CONTAI-049` (011-B)** — triagem completa do órfão (critério 15
  original, os três destinos). Estava bloqueado pelo achado 2; destravado
  pelo `contador` nesta rodada, mas ainda precisa de retoque de mock
  (`designer`) e de uma decisão de sequenciamento do `cto-obra` — não é
  "pronto para `/develop`" ainda.
- **`CONTAI-050` (011-C)** — dossiê sob demanda (critérios 4, 10, 12
  originais). Estava bloqueado pelo achado 1; destravado pelo `cto-obra`
  nesta rodada, mas com uma nota fiscal em aberto (conflito R6, "gerar
  assim mesmo") e um corte de mock (`#s20`) — também não é "pronto para
  `/develop`" ainda.

## Achado 1 (arquitetura) — quem roda o dossiê sob demanda

A Decisão 2 do `CONTAI-011` original (service role key + refresh token do
Drive só em GitHub Secrets, nunca em env da Vercel) não deixava claro quem
executa o dossiê sob demanda quando o Mateus clica o botão no app — a Vercel
não tem nenhuma das duas credenciais.

**Decisão do `cto-obra`**: o app não gera o pacote. Ele grava um pedido numa
tabela nova (`export_solicitacao`, RLS por `auth.uid()`) e "acorda" o mesmo
job do GitHub Actions via `workflow_dispatch` **sem nenhum input**, usando um
PAT fine-grained (`GITHUB_DISPATCH_TOKEN`), escopo só-Actions-só-este-repo,
guardado em env server-only da Vercel. O script drena os pedidos pendentes a
cada execução (schedule ou dispatch) e grava o resultado em
`export_execucao` (schema do 011-A, com duas colunas novas). O app faz
polling simples via PostgREST para saber quando terminou.

Por que essa credencial nova não repete o problema que a Decisão 2 evitava:
ela não lê nenhum dado fiscal e não aceita parâmetro — o pior cenário de
vazamento é acordar um job que só atende pedidos que um usuário logado já
inseriu sob RLS, com destino no Drive do próprio Mateus. **Decisão 2b**: *a
Vercel pode guardar credencial só se ela não lê dado nenhum e o que ela
dispara não aceita parâmetro.*

Detalhe completo em `docs/tickets/CONTAI-050.md`.

## Achado 2 (fiscal/produto) — semântica de "vincular" um órfão

A migration `0014` (trigger `documento_arquivo_path_imutavel` + função
`anexar_arquivo_documento` operando só `where arquivo_path is null`) torna
fisicamente impossível "vincular" um objeto órfão a um `documento` que já
tem arquivo — algo que nem o ticket nem o mock da triagem (critério 15)
tinham registrado.

**Decisão do `contador`**: a restrição da 0014 está certa e não muda (existe
para não apagar o lastro de `destinatario_cpf_ok`/`retencao_11` já
afirmados). "Vincular" vira duas rotas: **(a)** documento sem arquivo — já
funciona, sem mudança de modelo; **(b)** documento com arquivo — via
`documento_anexo` como anexo adicional do mesmo desembolso, nunca reabrindo
os dois checks fiscais do arquivo original (se o papel novo muda a resposta
fiscal, é correção, não vínculo). Nota técnica para o `cto-obra`:
`documento_anexo` não tem coluna `papel` hoje — decisão de sequenciamento com
o `CONTAI-027` fica para o Gate 1 do `CONTAI-049`.

Também decidido: os campos do 3º destino da triagem ("documento legítimo sem
vínculo") — tipo + obra obrigatórios, número obrigatório só para os tipos
com numeração própria de órgão (Alvará, ART/RRT, Matrícula, Habite-se, CND),
sem campo de "órgão emissor" à parte (o tipo já implica o órgão), e
**escritura do terreno e ITBI ficam FORA dessa categoria** (têm valor e
favorecido, pertencem ao custo de aquisição — colocá-los ali apagaria custo
real em silêncio).

Detalhe completo em `docs/tickets/CONTAI-049.md`.

## Achado menor — texto do LEIA-ME

O `contador` confirmou, palavra por palavra, que o texto do `LEIA-ME.txt` já
escrito no mock (`design/mocks/CONTAI-011.md`, blocos "LEIA-ME.txt" e "Por
quanto tempo guardar") está correto desde a correção de 2026-08-22 do
parecer — bate com a regra do `CLAUDE.md` (última DAA que declarou qualquer
parcela do ganho, não "venda + 5 anos"). A "Dúvida" que o próprio mock tinha
registrado apontava para uma redação mais antiga, já substituída — fechada,
sem ação. Nenhum ajuste de texto necessário; cópia literal no código do
011-A.

## Resultado

| Ticket | Escopo | Status |
|---|---|---|
| `CONTAI-011` (011-A) | rotina periódica + sinal no app | **pronto para `/develop`** |
| `CONTAI-049` (011-B) | triagem completa do órfão | destravado; falta mock + sequenciamento `cto-obra` |
| `CONTAI-050` (011-C) | dossiê sob demanda | destravado; falta decisão R6 + "gerar assim mesmo" + corte de mock |

`docs/tickets/README.md` e `docs/backlog.md` atualizados no mesmo commit.
