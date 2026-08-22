## Custo de contexto do pipeline — 2026-08-22 — o `/develop` estava pagando a mesma leitura N vezes

Origem: relato do Mateus em 2026-08-22 — *"esta sessão está consumindo demais…
a última vez o agente me falou que estava lendo todos os arquivos novamente a
cada agente que rodava no `/develop`"*.

Não é dor de obra: é dor de processo. Mas encarece todo ticket e, pior, empurra
o agente a ler menos do que precisa — que é como erro fiscal silencioso entra.

### O que foi medido (2026-08-22)

| Artefato | Tamanho | ≈ tokens por leitura |
|---|---|---|
| Todos os `.claude/*.md` **somados** | 30 KB | ~8k |
| `docs/backlog.md` (antes da quebra) | 150 KB | **~38k** |
| `design/mocks/CONTAI-021.html` | 152 KB | **~40k** |
| `docs/tickets/CONTAI-019.md` | 49 KB | ~12k |
| `CLAUDE.md` | 20 KB | ~5k |
| Código da app (`.ts`/`.tsx`/`.sql`) | 1,5 MB | ~380k |

**O texto dos prompts não era o problema** — o time inteiro cabe em 8k tokens.
O gasto estava no desenho do pipeline.

### As quatro causas, e o conserto de cada uma

1. **Retrabalho spawnava agente novo.** `REQUEST CHANGES` no Gate 2 mandava
   "volta ao Gate 1", e o `lead-engineer` novo relia ticket + mock + código
   (~80k tokens) para aplicar cinco linhas.
   → Agora o retrabalho é `SendMessage` ao mesmo agente, com o contexto dele
   intacto. Custa o delta do feedback.
2. **Leituras do que já estava em contexto.** Os quatro comandos mandavam ler o
   `CLAUDE.md` (que já é injetado em todo contexto, inclusive de subagent) e ler
   `.claude/agents/*.md` para "incorporar" a persona — que já é o system prompt
   de quem roda como `subagent_type`. Persona paga duas vezes, e no contexto
   errado: o do orquestrador, que é reenviado a cada chamada.
   → Removidas as 5 leituras de persona e os 4 "Leia `CLAUDE.md`".
3. **Conteúdo grande no contexto do hub.** O orquestrador lia o ticket inteiro
   (12k tokens) e o carregava pelos 4 gates.
   → Hub lê só `sed -n '1,60p'`; o corpo é lido por quem executa o gate, em
   contexto descartável. `/tickets-req` passou a garantir que tipo, prioridade,
   critérios, UI e Gate Fiscal caibam nessas 60 linhas.
4. **Mock só existia como HTML de 150 KB.** Gate 1 e Gate 4 liam os 152 KB do
   `CONTAI-021.html` para achar um texto de estado vazio.
   → `/design` passa a gravar `design/mocks/[ID].md` (spec ≤100 linhas: telas,
   4 estados, campos, textos fiscais com o parecer de origem, navegação). O
   `.html` continua sendo a fonte visual para aprovação do Mateus, e só se abre
   quando a dúvida for de marcação.

Somado a isso: contrato de retorno de gate (≤30 linhas, proibido colar código,
diff ou HTML) nos comandos e nos agentes `lead-engineer` e `cto-obra`, e review
do Gate 2 sobre o `git diff` em vez da área inteira do código.

### Este arquivo é consequência do item que sobrou

O backlog era um único `docs/backlog.md` de 2353 linhas / 150 KB — um diário
cronológico, não um backlog categorizado. Toda consulta a "fato da obra já
respondido" custava ~38k tokens.

Quebrado em 2026-08-22 em `docs/backlog/`, uma entrada por data, com
`docs/backlog.md` virando índice de ~13 KB que **aponta e não duplica**.
Conteúdo movido byte a byte: as 23.520 palavras das linhas 81–2353 conferidas
idênticas antes e depois. Nenhuma linha reescrita, nenhuma decisão reclassificada.

⚠️ Havia **6 "Fila revista"** no arquivo e só a 6ª vale. O índice diz isso por
extenso, porque a estrutura antiga convidava a citar fila morta.

### D40 — `lib/data.ts` com 2065 linhas é o custo que sobrou

Consertar os prompts não reduz a leitura de **código**. `lib/data.ts` é a camada
inteira de acesso a dados (obras, painel, documentos, pagamentos, as três
correções do `CONTAI-021`, pendências, revisões, acervo, favorecidos, vínculos)
e **44 arquivos importam dele** — todo `app/**/page.tsx`, `lib/fiscal/*`,
`lib/acervo.ts`, `e2e/banco.ts`.

Todo gate que toca dados abre 2065 linhas para mexer em 20. O risco não é só
custo: é o agente ler parcialmente um arquivo que contém a agregação de custo
e as três correções com consequência fiscal.

→ **`CONTAI-028`**, criado em 2026-08-22.

### O que este item NÃO é

Não é otimização de performance do app — o usuário final não vê diferença
nenhuma. É custo e risco do processo de desenvolvimento. Se disputar prioridade
com item que serve a uma das três metas do produto, **perde**.
