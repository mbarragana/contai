# CONTAI-038 — spec do fluxo e das telas

Cenário: **misto, por tela** (confirmado no próprio ticket) — `/adicionar/documento`
é captura (canteiro, uma mão); `/documento/[id]` e a home são gestão (em casa,
sentado). Sem HTML (regra vigente desde 2026-09-20): este documento é a entrega
completa, com ASCII onde a estrutura precisa ser vista, não só lida — em
particular o repeater de linhas, que não tem precedente no produto.

Fontes: `docs/tickets/CONTAI-038.md` (corpo inteiro, incluindo Gate Fiscal,
Viabilidade, Pre-mortem); `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`
(corpo + ADENDO 2026-09-19). Nenhum texto de consequência fiscal abaixo é
redigido de memória — o que é citação literal está marcado como tal; o que é
copy de produto (chip, título de card, rótulo de botão) está marcado como
proposta do design, a confirmar.

---

## Fluxo de usuário

### 1 — Captura (`/adicionar/documento`, canteiro, uma mão)

```
Registrar NF de serviço
        │
        ▼
"Esta nota destaca alguma retenção?"  (gate — 2 opções, sem pré-marcada)
   ├─ Nenhuma ────────────────► segue o formulário, sem mais nada sobre retenção
   └─ Destacada ──────────────► segue o formulário — SEM repeater aqui
        │                        (Teste do Canteiro: 5 perguntas por linha,
        │                         N linhas, estouraria o limite de ~3 interações)
        ▼
   Salvar registro
        │
        ▼
  Documento salvo. Se gate = "destacada": 0 linhas gravadas ainda —
  a pendência "sem linha registrada" já existe, visível ao abrir o
  documento (nunca lida como "sem retenção").
```

### 2 — Resolução (`/documento/[id]`, em casa, sentado)

```
Abre /documento/[id] (nf_servico, gate = "destacada")
        │
        ▼
   Bloco "Retenção" — 0 ou N linhas
        │
        ├─ 0 linhas → card âmbar "retenção destacada, nenhuma linha ainda"
        │        │
        │        ▼
        │   "+ Adicionar linha de retenção" (formulário some/aparece,
        │    não navega — mesma tela)
        │        │
        │        ▼
        │   rótulo literal · valor · composição (+ tributo, se identificado)
        │   · é desconto efetivo? (+ quem recolhe, se sim)
        │        │
        │        ▼
        │   Linha só grava COMPLETA — o banco recusa qualquer combinação
        │   parcial via CHECK; a tela bloqueia o botão antes disso
        │
        └─ N linhas → cada uma exibida, sozinha ou junto de:
                 │
                 ▼
     linha com e_desconto_efetivo = true E quem_recolhe ∈ {"ainda não sei"}
     (nunca null — o CHECK do banco não permite) ──► pendência VERMELHA
     nesta linha e na home:
     "Retenção descontada do pagamento sem confirmação de quem recolhe —
      se ninguém recolher, não é economia, é passivo não identificado."
     (citação literal — Gate Fiscal, P1)
                 │
                 ▼
        Responde "Quem recolhe isto?" (editável depois, é a única correção
        de linha que este ticket entrega)
           ├─ "A empresa" ────────► fecha — sem exigir comprovante do prestador
           └─ "Eu" ───────────────► fecha SE Σ pagamentos ligados a esta nota
                                     == valor bruto da nota (o mesmo cálculo
                                     que já existe no bloco "Pagamentos desta
                                     nota" — não é uma segunda soma nova)
```

---

## Telas e estados

### `/adicionar/documento` — delta sobre o mock do CONTAI-004/CONTAI-001

Mesmo formulário, mesma posição na ordem de campos (…CPF → **retenção** → CNO).
Só o campo de retenção muda; nada mais no formulário se altera.

- **Sucesso / vazio inicial**: o gate nasce sem opção marcada, como todo campo
  fiscal do formulário. Botão "Salvar registro" seguindo desabilitado até
  responder (mesma disciplina já vigente para CPF e CNO).
- **Erro de validação**: tentar salvar sem responder → erro de campo "Responda
  se esta nota destaca alguma retenção." no mesmo padrão visual dos outros
  `erroDe(...)` do formulário (borda vermelha no campo, sem bloquear o resto).
- **Loading / erro de rede**: nenhum novo — reaproveita o "Salvando…"/retry que
  já existe no formulário inteiro (não há chamada de rede própria deste campo).
- Sem estado "destacada com aviso": ao contrário do campo antigo (que abria
  `avisaInss`, banner âmbar "Sem retenção 11%…"), a escolha "Destacada" **não
  abre banner de consequência aqui** — não há consequência fiscal ainda
  aberta neste momento, só um dado a completar depois. O que aparece é uma
  `Dica` neutra (ver Textos).

### `/documento/[id]` — bloco "Retenção" (novo; substitui a "Tela 7" antiga)

⚠️ **A tela inteira dedicada "NF de serviço sem retenção" (o `return` antecipado
em `app/documento/[id]/page.tsx:614-657`, Tela 7 do mock do CONTAI-004) É
REMOVIDA por completo.** No lugar dela, o detalhe do documento sempre passa
pelo render normal (o `return` de baixo, com todos os blocos), e a retenção
vira **mais um bloco aditivo** — igual a `blocoSemArquivo` — inserido em TODAS
as ramificações que hoje existem (a de quarentena e a normal), sempre que
`d.tipo === "nf_servico"`. Boleto e NF de material nunca mostram este bloco.

Estados do bloco, por valor de `documento.retencao_na_nota`:

1. **`"nenhuma"`** — sucesso, sem pendência. Não é um Card à parte: uma `Linha`
   dentro do card de identificação (`rotulo="Retenção"` → `nenhuma destacada
   nesta nota`). Sem loading/vazio/erro — é leitura direta do campo.
2. **`null` (legado — só existe entre a migration e a conferência do critério
   18)** — card âmbar com o gate reaparecendo **ali mesmo**, inline, para
   confirmar olhando o papel: mesma pergunta e mesmas duas opções do
   formulário de captura, sem pré-marcada. Estados: **vazio** (nada marcado,
   botão "Confirmar" desabilitado); **loading** ("Confirmando…"); **erro**
   (banner vermelho, retry, resposta escolhida preservada — mesmo padrão do
   s3e do CONTAI-021); **sucesso** (some, vira um dos outros dois estados).
3. **`"destacada"`, zero linhas gravadas** — card âmbar, pendência **visível,
   nunca lida como "sem retenção"** (critério 2): chip "Retenção sem linha
   registrada", texto "Esta nota destaca retenção, mas nenhuma linha foi
   registrada ainda." + CTA "+ Adicionar a primeira linha de retenção". Sem
   loading/erro neste estado em si (são do formulário de adicionar, ver
   abaixo).
4. **`"destacada"`, N linhas gravadas** — lista das linhas (ver ASCII), cada
   uma com seu próprio possível sub-estado de pendência (vermelha, se
   `e_desconto_efetivo=true` e `quem_recolhe` ainda não é `"empresa"` nem
   `"eu"`-com-pagamento-cobrindo). Sempre com "+ Adicionar outra linha" ao
   final.
5. **Formulário "Adicionar linha" (expande inline, não navega)**: **vazio**
   inicial (nada preenchido, nem herdado da linha anterior — cada linha nasce
   em branco, sem exceção); os campos condicionais (tributo, quem recolhe)
   aparecem/somem conforme a resposta pai muda; **erro de validação** por
   campo faltante (botão nomeia o que falta, padrão "Faltam N respostas…" do
   CONTAI-021 s8); **loading** ("Adicionando…"); **erro de rede** (banner
   vermelho, retry, formulário preservado, nada gravado — a linha só existe no
   banco depois do INSERT confirmado).
6. **Responder/corrigir "quem recolhe" numa linha já gravada**: Escolha inline
   + botão "Salvar resposta" (habilitado só quando a escolha muda em relação à
   gravada). **Loading** ("Salvando…", controle desabilitado); **erro**
   (banner vermelho, retry, resposta escolhida preservada, valor antigo
   continua valendo até confirmar); **sucesso** (a linha atualiza, e se era a
   última pendência vermelha do documento, ela sai da home no próximo
   carregamento).
7. **Remover uma linha**: ação direta "Remover esta linha", sem diálogo de
   confirmação (critério 3 diz "livremente"). **Loading** ("Removendo…",
   linha desabilitada); **erro** (banner vermelho na linha, ela permanece
   visível — nunca some da tela antes do servidor confirmar); **sucesso** (a
   linha some da lista).

### Home (`app/page.tsx`) — pendência nova

Nível de mudança equivalente ao nível 3 do CONTAI-035 (tabela, não tela nova):
o card de pendência já é genérico (`Card`/`Chip`/`Consequencia`/`BotaoLink`
lendo o array `resumo.pendencias`) — só muda o `tipo`, os textos e a cor.

| Campo do objeto `Pendencia` | Valor |
|---|---|
| `tipo` | `"retencao_sem_recolhedor"` (substitui `"servico_sem_retencao"`, que é removido por inteiro) |
| `chip` | proposta de design: **"Retenção sem recolhedor"** — a confirmar, não é citação do parecer |
| `titulo` | proposta de design: **"Retenção descontada, sem confirmar quem recolhe"** — a confirmar |
| `detalhe` | favorecido do documento (padrão já usado em todas as outras pendências) |
| `valorCentavos` | soma das linhas ainda abertas deste documento (uma `Pendencia` por documento, não por linha — Viabilidade) |
| `consequencia` | **citação literal**: "Retenção descontada do pagamento sem confirmação de quem recolhe — se ninguém recolher, não é economia, é passivo não identificado." |
| `gravidade` | vermelha, via `gravidadeDaRegua(...)` (critério 7a) — visualmente idêntica a qualquer outra pendência vermelha do app (`Chip cor="red"`, `border-red`), nada novo a desenhar |
| `href` | `/documento/${d.id}` |
| `ACAO_POR_TIPO` | "Ver detalhes" (mesmo rótulo que `servico_sem_retencao` já usava) |

Sem loading/vazio/erro próprios — é o mesmo array/render que já existe; o
estado vazio geral da lista de pendências ("Nenhuma pendência…") já cobre o
caso de esta pendência não existir.

### `/documento/[id]/anexar` — achado, não coberto pela Viabilidade do ticket

Ver "Achados" abaixo — esta tela pergunta a retenção de novo quando o arquivo
chega depois, e por isso também precisa mudar, mesmo não estando na lista
"Arquivos a tocar" do CTO.

---

## ASCII — o repeater (o padrão inédito)

Card "Retenção", 375px, com 1 linha já gravada e o formulário de nova linha
fechado:

```
┌ 375px ────────────────────────────────┐
│ Retenção                              │
│ ⓘ Nenhuma retenção desta nota abate o  │
│   INSS (SERO) — só a declaração        │
│   vinculada ao CNO abate, e isso é     │
│   separado deste registro.             │
│                                         │
│ ── Linha 1 ─────────────────────────── │
│ "INSS" · R$ 340,00                     │
│ Tributo único identificado — INSS      │
│ Abatido do pagamento: sim              │
│                                         │
│ [red] Retenção sem recolhedor          │
│ Retenção descontada do pagamento sem   │
│ confirmação de quem recolhe — se       │
│ ninguém recolher, não é economia, é    │
│ passivo não identificado.              │
│                                         │
│ Quem recolhe isto?                     │
│ ( Eu )  ( A empresa )  ( Ainda não sei)│
│ [ Salvar resposta ]                    │
│                                         │
│ [ Remover esta linha ]                 │
│ ─────────────────────────────────────  │
│ [ + Adicionar outra linha ]            │
└─────────────────────────────────────────┘
```

Formulário "Adicionar linha" aberto (substitui o botão "+ Adicionar…" no
mesmo lugar — não é modal, não é rota nova):

```
┌ 375px ────────────────────────────────┐
│ Nova linha de retenção                 │
│                                         │
│ Rótulo (copie exatamente da nota)      │
│ [_____________________________]        │
│                                         │
│ Valor                                  │
│ [ 0,00 ]                               │
│                                         │
│ O que esta linha representa?           │
│ ( Tributo único identificado )         │
│ ( Total combinado, não aberto pela nota)│
│ ( Não sei o que este valor representa )│
│                                         │
│  ↳ só se "tributo único":              │
│  Qual tributo?                         │
│  (ISS)(INSS)(IRRF)(PIS)(COFINS)(CSLL)  │
│                                         │
│ Esse valor é de fato abatido do que    │
│ você transfere ao prestador?           │
│ ( Sim )   ( Não )                      │
│                                         │
│  ↳ só se "sim":                        │
│  Quem recolhe isto?                    │
│  ( Eu )  ( A empresa )  ( Ainda não sei)│
│                                         │
│ [ Adicionar linha ]  ← rótulo muda para │
│   "Faltam 2 respostas para adicionar"  │
│   enquanto incompleto (padrão CONTAI-021)│
│ [ Cancelar ]                            │
└──────────────────────────────────────────┘
```

---

## Campos

### `/adicionar/documento` (e `/documento/[id]/anexar` — mesma pergunta)

- `retencaoNaNota` — Escolha, 2 opções: **"Nenhuma"** / **"Destacada"** —
  banco: `documento.retencao_na_nota` (`"nenhuma" | "destacada"`) — obrigatório
  em `nf_servico` (mesma condição de `exigeRetencao`) — **SEM DEFAULT — campo
  fiscal**. Tipo TS sugerido: `RespostaRetencaoNaNota = "nenhuma" |
  "destacada"` (substitui `RespostaRetencao`, que deixa de existir com esse
  nome/significado).

### `/documento/[id]` — formulário "Adicionar linha" (tabela `documento_retencao`)

- `rotuloLiteral` — texto livre, obrigatório, nunca normalizado — placeholder
  "Copie exatamente como está na nota" — SEM DEFAULT.
- `valor` — numérico > 0, obrigatório — SEM DEFAULT.
- `composicao` — Escolha, 3 opções, obrigatório, **SEM DEFAULT — campo
  fiscal**:
  - "Tributo único identificado" → banco `tributo_identificado`
  - "Total combinado, não aberto pela nota" → banco `combinado_nao_aberto`
  - "Não sei o que este valor representa" → banco `nao_sei`
- `tributo` — Escolha, 6 opções (ISS/INSS/IRRF/PIS/COFINS/CSLL), **só aparece
  quando `composicao = tributo_identificado`**, obrigatório nesse ramo — SEM
  DEFAULT — campo fiscal.
- `eDescontoEfetivo` — Escolha sim/não, rótulo literal do critério 3: "Esse
  valor é de fato abatido do que você transfere ao prestador?" — obrigatório,
  **SEM DEFAULT — campo fiscal**.
- `quemRecolhe` — Escolha, 3 opções, **só aparece quando `eDescontoEfetivo =
  sim`**, obrigatório nesse ramo, rótulo literal: "Quem recolhe isto?" — **SEM
  DEFAULT — campo fiscal**:
  - "Eu" → banco `eu`
  - "A empresa" → banco `empresa`
  - "Ainda não sei" → banco `nao_sei` (resposta de primeira classe, não erro)
- NÃO É CONTROLE — nenhum anexo por linha: o papel já é o mesmo anexado no
  registro do documento — a linha só transcreve um valor que já está nesse arquivo.
- NÃO É CONTROLE — cada linha nova nasce **inteiramente em branco**, mesmo que a anterior já
  tenha sido preenchida — nenhum campo herda valor da linha anterior (mesmo
  princípio do CONTAI-021 s8: "obrigatórios, um a um, nunca em cascata").

### `/documento/[id]` — correção de linha já gravada

- NÃO É CONTROLE — `quemRecolhe` é o **único** campo de uma linha existente que este ticket
  torna editável (grant de UPDATE existe exatamente para isto — Viabilidade,
  critério 16). `rotuloLiteral`/`valor`/`composicao`/`tributo`/`eDescontoEfetivo`
  não têm edição nesta rodada (dívida já declarada no Out of Scope do ticket
  para rótulo/valor; ver "Perguntas abertas" abaixo para o resto).

---

## Textos com consequência fiscal

- **Gate de captura** (literal do critério 1 do ticket): "Esta nota destaca
  alguma retenção?" — opções "Nenhuma" / "Destacada".
- **Dica no gate de captura, quando "Destacada"** (proposta de design, sem
  reivindicar fiscal, só orienta o fluxo): "Você detalha isso depois, sentado
  — aqui só marcamos que a nota tem retenção." — a confirmar com `po`, não é
  regra fiscal.
- **`e_desconto_efetivo`** (literal do critério 3): "Esse valor é de fato
  abatido do que você transfere ao prestador?"
- **`quem_recolhe`** (literal do critério 3): "Quem recolhe isto: eu / a
  empresa / ainda não sei" — adaptado para rótulo de campo + 3 opções.
- **`composicao`**, as 3 opções (literal do A.1/critério 3): "tributo único
  identificado" / "total combinado, não aberto pela nota" / "não sei o que
  este valor representa".
- **Texto de consequência da pendência nova** (citação literal — Gate Fiscal,
  P1, e repetida no ADENDO A.4 do parecer): "Retenção descontada do pagamento
  sem confirmação de quem recolhe — se ninguém recolher, não é economia, é
  passivo não identificado." — aparece em DOIS lugares: no card da linha em
  `/documento/[id]` e no card de pendência da home. Mesmo texto, mesmo
  detector, nenhuma reescrita.
- **Rótulo obrigatório para retenção não discriminada** (citação literal do
  A.2, "regra adicional" do Gate Fiscal): "retenção não discriminada,
  presumivelmente recolhida por terceiros" — usar exatamente esta frase
  sempre que a linha tiver `composicao ∈ {combinado_nao_aberto, nao_sei}` **e**
  `e_desconto_efetivo = true` e o app precisar nomear a perna de pagamento
  correspondente (no bloco "Pagamentos desta nota" ou em qualquer lugar que
  hoje nomeie pagamentos por tipo de guia). **Nunca** "guia de ISS"/"guia de
  INSS" nesse caso — a regra é dura e nomeada no parecer.
- **Reforço do invariante do SERO** (reaproveita texto já aprovado no mock do
  CONTAI-001/CONTAI-004, tela 7 antiga — não é texto novo, é reuso): "Abate no
  INSS (SERO)" → "não", como uma `Linha` de fato, sempre visível junto do
  bloco de retenção em qualquer `nf_servico`, independente do valor do gate.
- **Zero linhas gravadas com gate "destacada"** (proposta de design, grounded
  no critério 2, mas frase minha): "Esta nota destaca retenção, mas nenhuma
  linha foi registrada ainda." — a confirmar com `po`/`contador` antes do Gate 2
  (mesmo naipe de revisão que o CONTAI-004 fez para textos parafraseados).
- **Erro de validação do gate**: "Responda se esta nota destaca alguma
  retenção." — segue o padrão de mensagem dos outros `erroDe(...)` do
  formulário (curto, imperativo, sem jargão).

---

## Navegação

- `/adicionar/documento`: nenhuma navegação nova — o gate ocupa o lugar do
  campo antigo, na mesma tela, no mesmo passo.
- `/documento/[id]`: "+ Adicionar linha de retenção" expande **na mesma
  tela** (sem navegação); "Remover esta linha" e "Salvar resposta" (quem
  recolhe) agem **na mesma tela**, sem navegação. Nenhuma rota nova é criada
  por este ticket (`app/documento/[id]/retencao/...` **não existe** — a lista
  de "Arquivos a tocar" da Viabilidade não lista nenhum arquivo assim, e o
  repeater cabe inteiro dentro de `app/documento/[id]/page.tsx`).
- Home → `/documento/${id}` — mesmo padrão de toda outra pendência
  (`BotaoLink` com o rótulo de `ACAO_POR_TIPO`).

---

## Decisões de design

1. **Repeater inline, sem rota nova.** Confirmado pela ausência de qualquer
   arquivo de rota nova na lista "Arquivos a tocar" da Viabilidade — o
   repeater inteiro (lista + formulário de nova linha) vive dentro de
   `app/documento/[id]/page.tsx`, expandindo/recolhendo no lugar, no mesmo
   padrão que `jaPaguei` já usa no formulário de captura.
2. **Sem edição de `composicao`/`tributo`/`e_desconto_efetivo` de linha já
   gravada.** Só `quem_recolhe` é editável (é o único campo para o qual a
   Viabilidade justifica o grant de UPDATE). Errar a classificação de uma
   linha se corrige removendo e recriando — ver "Perguntas abertas".
3. **Nenhuma correção para o valor do GATE em si** (`documento.retencao_na_nota`
   trocar de "destacada" para "nenhuma" ou vice-versa depois de gravado) nesta
   rodada — mesma categoria de dívida que a correção de `rotulo_literal`/
   `valor` já declarada no Out of Scope do ticket. Ver "Perguntas abertas".
4. **Extração automática não ganha campo novo nesta rodada.** O item
   "`lib/extracao/schema.ts` (comentário)" da Viabilidade é só isso — comentário.
   Não existe hoje, e este ticket não cria, nenhum mecanismo para levar uma
   sugestão da extração (que roda em `/adicionar/documento`) até o repeater
   (que só existe em `/documento/[id]`, aberto depois, possivelmente noutra
   sessão). Construir esse mecanismo agora seria antecipar trabalho que o
   critério 14 permite para o futuro, mas não pede agora — e inflaria ainda
   mais uma complexidade já classificada como **L**.
5. **Ordem do bloco "Retenção" no detalhe**: logo depois do bloco de
   identificação da nota (`blocoIdentificacao`) e antes de `blocoSemArquivo` —
   os dois são pendências específicas de NF de serviço/material, a retenção
   é a terceira família de fiscal-específico. Ajustável no Gate 2 se o
   `cto-obra` preferir outra ordem; não é uma regra fiscal, é legibilidade.
6. **"Remover linha" sem diálogo de confirmação** — o critério 3 diz
   "livremente", e nenhum outro texto do ticket pede fricção aqui. Erro de
   rede não desfaz a linha da tela até o servidor confirmar (nunca otimista).
7. **"Adicionar linha" é atômica** — o formulário só chama o INSERT quando
   todos os campos exigidos pelo ramo escolhido estão preenchidos; não existe
   estado de "linha salva incompleta" na tela, porque o banco não permite essa
   linha existir (CHECK constraints da Viabilidade). O botão desabilitado
   nomeia o que falta, no padrão já usado em `s8` do CONTAI-021.
8. **Pendências de múltiplas linhas "eu recolho" na mesma nota fecham
   juntas.** O fechamento usa `saldoDescobertoDaNota`, que é por DOCUMENTO,
   não por linha (reaproveita o cálculo existente, Viabilidade). Se a nota
   tiver mais de uma linha com `quem_recolhe = "eu"`, uma `Dica` explica: "Esta
   pendência fecha pelo total pago pela nota, não linha por linha — se houver
   mais de uma linha 'eu recolho' aqui, elas fecham juntas quando o total
   pago cobrir o valor bruto." (texto de design, a confirmar).
9. **Nenhum backfill por inferência na conferência legado** (critério 18): o
   card do estado 2 (`retencao_na_nota = null`) não tenta mostrar o valor
   antigo de `retencao_11` — a migration já dropou essa coluna antes de este
   estado existir em produção (critério 9), então literalmente não há dado
   antigo para exibir. A tela pergunta do zero, olhando o papel.

---

## Achados

**`app/documento/[id]/anexar/page.tsx` não está na lista "Arquivos a tocar"
da Viabilidade, mas referencia `retencao11` em 6 pontos** (estado
`retencao11`, `RESPOSTAS_RETENCAO` de 3 opções, `retencaoParaBanco`,
`pedeRetencao`) — é a tela CONTAI-033 que **repergunta** os dois checks
fiscais quando o arquivo chega depois do registro (mesma razão do "flip
barato": sem papel à vista, resposta de memória não vale). Esta tela **precisa
mudar** para não quebrar o critério 11 (`grep` zerado), mesmo sem estar
listada. Resolução adotada aqui, sem abrir pergunta nova: espelhar exatamente
a mudança de `/adicionar/documento` — troca a `Escolha` de 3 opções
(sim/não/não sei) pelo mesmo gate de 2 opções ("Esta nota destaca alguma
retenção?" — nenhuma/destacada), **sem repeater nesta tela também** (ela é uma
repergunta rápida, não uma revisão de gestão). Se "Destacada", a Dica explica
que as linhas se preenchem depois, no detalhe. `cto-obra`/`lead-engineer`:
acrescentem este arquivo à lista de arquivos tocados no Gate 1.

---

## Perguntas abertas

**RESPONDIDA pelo `po` + `cto-obra`, 2026-09-20** — correção de uma linha de
retenção já gravada, além de `quem_recolhe`: confirmado **remover a linha e
recriar** (não vale formulário de edição em cascata para dois campos
condicionais). Isso exige DELETE em `documento_retencao`, que o critério 16
original não concedia ("append-only"); o `cto-obra` decidiu conceder DELETE
por esta tabela ser **afirmação** do Mateus sobre o papel (como
`pagamento_documento`), não **acervo** com arquivo no bucket (como
`documento_anexo`) — a prova (a NF) continua intacta em `documento`. Ver
migration/grant/policy no ticket, seção Viabilidade, atualizada na mesma
data. Estado 7 ("Remover esta linha") não muda: sem diálogo, nunca otimista,
linha some da tela só depois de o `delete().select("id")` confirmar
`data.length === 1` — tratar `data.length !== 1` como erro (RLS pode filtrar
tudo e o PostgREST devolve sucesso vazio).

**RESPONDIDA pelo `contador`, 2026-09-20** — a pendência nova (`retencao_sem_recolhedor`)
fica **fora** de `pagoSemComprovanteCentavos` (`lib/fiscal/resumo.ts`,
~linhas 830-845). Fundamento: esse somatório soma só dinheiro **já
desembolsado sem prova** (`pago_sem_nota` + `pago_sem_comprovante` —
"dinheiro que já saiu do bolso dele", comentário literal do arquivo). A
pendência nova é o caso oposto: só nasce quando `e_desconto_efetivo = true`
e falta definir **quem recolhe** — o valor retido não foi transferido a
ninguém ainda (nem ao prestador, nem a uma guia de recolhimento). É passivo
em aberto, não dinheiro desembolsado sem lastro. O próprio Gate Fiscal do
ticket (P1) já ancora essa pendência no espírito de `diferenca_sem_explicacao`
— a OUTRA exclusão histórica do mesmo somatório, pelo motivo simétrico (erro
de registro, não falta de documento). Regra geral, não precedente pontual:
qualquer pendência que represente valor não desembolsado fica fora desse
somatório, por definição.

**RESPONDIDA pelo `po`, 2026-09-20** — nenhuma correção para o valor do gate
(`documento.retencao_na_nota`) em si entra neste ticket: confirmado como
dívida declarada, mesma categoria de `rotulo_literal`/`valor`. Justificativa
do `po`: marcar "destacada" por engano vira pendência âmbar permanentemente
visível e nomeada como tal (nunca lida como "sem retenção") — incômodo, não
risco fiscal silencioso; marcar "nenhuma" por engano quando havia retenção
de fato tende a ser pego pela pendência de diferença sem explicação (§4.1)
se o valor pago não bater com o bruto da nota. Extensão futura de
`corrigir_documento` é o caminho certo para os dois casos juntos — registrar
como dívida nomeada no backlog na entrega deste ticket, sem ticket próprio
agora.

Chip/título/textos de card marcados acima como "proposta de design, a
confirmar" (a Dica do gate de captura, o texto "sem linha registrada", o
chip/título da pendência na home, a Dica sobre pendências fechando juntas)
não são citação do parecer — são copy nova, revisão leve de `po`/`contador`
recomendada antes do Gate 2, no mesmo espírito das pendências abertas do
CONTAI-004.
