# CONTAI-067 — extrato da fatura do cartão: dois pontos de captura + pendência nova

Cenário: **gestão** (`/fatura/[id]/confirmar`, `/fatura/[id]`) — o Mateus concilia
pagamentos de cartão sentado, em casa, com calma. **O "Teste do Canteiro" não
se aplica a nenhuma das duas telas.**

Nível 2 (spec + ASCII). Reaproveita componentes já testados — `CampoArquivo`,
`Card`, `Banner`, `Chip`, `Consequencia`, `Dica`, `BotaoLink`, `ListaDeAnexos`
— e o padrão exato de `app/_components/documento-sem-arquivo.tsx` para a
pendência nova. Nenhum componente novo de layout.

Fonte fiscal: `docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md`,
**ADENDO** (texto do requisito) e **ADENDO 2** (cor/gravidade). Todo texto de
consequência abaixo é citação próxima do ADENDO/ADENDO 2 — nada redigido de
memória. Onde a redação é minha (produto, não fiscal — CTA, rótulo de botão),
está marcado como tal.

## Campos

### `/fatura/[id]/confirmar`
- `extrato` — Arquivo (`CampoArquivo`, `accept=".pdf,image/*"`) — **opcional**
  (critério 4 do ticket: nunca bloqueia "Confirmar pagamento") — SEM DEFAULT —
  banco: `fatura.extrato_path`, gravado no mesmo ato que o desembolso
  (critério 3). Por já nascer opcional não há pergunta fiscal pendente na
  ausência: a ausência vira pendência (critérios 8-10 do ticket, seção 4
  abaixo), nunca um bloqueio nem um silêncio.
- `comprovante` — SOMENTE LEITURA — já existente, **rótulo e ajuda não
  mudam**, este ticket não toca.

### `/fatura/[id]` (bloco novo, upload inline)
- `extrato` — mesmo arquivo, mesmo `accept` — SEM DEFAULT — gravado via
  `anexar_extrato_fatura` ao clicar em "Anexar extrato" (não ao simplesmente
  escolher o arquivo — disciplina do projeto: quem afirma o registro é uma
  ação explícita, nunca a seleção do arquivo por si).

## 1. `/fatura/[id]/confirmar` — os dois `CampoArquivo`, empilhados

```
┌ Card ──────────────────────────────────────────────────┐
│ Data em que a fatura foi paga              [__________] │
│ ajuda: "Vira a data de cada um dos N pagamentos abaixo." │
│                                                           │
│ Comprovante da fatura                                    │
│ ajuda: "Compartilhado pelos pagamentos gerados — um      │
│ documento para N."                                       │
│ [ Escolher arquivo ]                                     │
│                                                           │
│ Extrato da fatura (emitido pelo cartão)                  │
│ ajuda: "O comprovante prova a saída de caixa; o extrato  │
│ prova a composição — quais compras estavam dentro dela." │
│ [ Escolher arquivo ]                                     │
└───────────────────────────────────────────────────────────┘
```

- **Rótulos**: mantém a proposta do ticket sem alterar — **"Comprovante da
  fatura"** (existente) e **"Extrato da fatura (emitido pelo cartão)"** (novo),
  nesta ordem, empilhados no mesmo `Card`. O parêntese "(emitido pelo cartão)"
  é o que evita a confusão do pre-mortem 1: o rótulo já diz de quem é o
  documento, sem precisar de "Anexo 1"/"Anexo 2".
- **Texto de ajuda do campo novo** — citação quase literal do ADENDO
  ("Requisito novo": *"o comprovante prova a saída de caixa; o extrato prova a
  composição"*; e do ADENDO 1, seção "Por que o vínculo importa": *"não prova a
  **composição** desse valor (quais compras estão dentro)"*):
  > **"O comprovante prova a saída de caixa; o extrato prova a composição —
  > quais compras estavam dentro dela."**

  Constante nova sugerida, ao lado de `RECUSA_PARCELADO` em
  `lib/fiscal/fatura.ts` (ex.: `EXTRATO_DA_FATURA_AJUDA`) — mesma disciplina de
  "texto fiscal vem de constante nomeada, nunca inline reescrito a cada tela".
- **Ordem**: comprovante primeiro (já existente, não reordena), extrato logo
  abaixo — o ticket já fixou essa ordem (critério 2, "segundo `CampoArquivo`,
  empilhado abaixo").
- Os dois campos **não têm relação de dependência** entre si: pode anexar só
  um, os dois, ou nenhum — cada `CampoArquivo` guarda seu próprio `File | null`
  (mesmo padrão de estado local que `comprovante` já usa nesta página).
- **Upload no mesmo ato** (critério 3): `salvar()` sobe os dois arquivos via
  `subirParaAcervo` (se escolhidos) antes de chamar
  `registrarDesembolsoDeFatura`, que ganha `extratoPath` no mesmo parâmetro
  novo do critério 12 do ticket. Falha em qualquer subida não grava nada — nem
  o desembolso, nem o comprovante, nem o extrato (mesma trava que já existe
  hoje para o comprovante sozinho).

### Estado "extrato já anexado" (fatura chega em `/confirmar` com `extratoPath` já preenchido — ex.: parte da fatura já foi paga por `/parcial` e o extrato foi anexado antes, por `/fatura/[id]`)

O segundo `CampoArquivo` **não aparece**. No lugar dele, dentro do mesmo `Card`,
a mesma linha de leitura que `ListaDeAnexos` já produz para "papel já
resolvido" em outras telas:

```
Extrato da fatura (emitido pelo cartão)
Extrato já anexado — [ Ver arquivo ]
```

- Sem campo de upload, sem texto de ajuda (não há mais decisão a tomar aqui) —
  só o rótulo do campo + `ListaDeAnexos` com o item único
  `{ path: fatura.extratoPath, papel: "extrato" }` (link ao acervo).
- Não é um banner de bloqueio como o guard de `/pagamento/[id]/comprovante`
  (CONTAI-061) — ali a tela inteira é sobre um documento, aqui é só um dos dois
  campos do card; o resto do fluxo de confirmação segue normal.

## 2. `/fatura/[id]` — bloco novo "Extrato da fatura"

**Posição**: logo depois do Card "Valores já pagos a esta fatura" (linhas
135-152 do arquivo hoje) e antes do Card de ações ("Confirmar fatura
paga"/"Registrar pagamento parcial"/"Registrar outra compra"). Ordem de
leitura: o que foi comprado → o que já foi pago → o que sustenta esse
pagamento documentalmente → o que fazer a seguir. Só aparece quando
`fatura.desembolsos.length > 0` (critério 5 do ticket) — sem desembolso, não
há o que documentar ainda, e o bloco fica ausente (não vazio, ausente — mesma
disciplina do Card "Valores já pagos", que também só aparece com
`desembolsos.length > 0`).

### 2a. Já tem `extratoPath`

```
┌ Card ──────────────────────────────────────────────┐
│ EXTRATO DA FATURA                                    │
│ Extrato anexado ✓ — [ Ver arquivo ]                  │
└───────────────────────────────────────────────────────┘
```

`ListaDeAnexos titulo="Extrato da fatura" itens={[{path: extratoPath, papel: "extrato"}]}`.
Card neutro, sem cor de alerta — está resolvido.

### 2b. Sem `extratoPath`, com desembolso (a pendência em carne viva)

```
┌ Card · borda vermelha ──────────────────────────────┐
│ FATURA SEM EXTRATO                                   │
│                                                       │
│ Você já pagou esta fatura, mas não tem o documento   │
│ da administradora que prova quais compras estavam    │
│ dentro dela — falta o apoio hábil que fixa o         │
│ ano-calendário certo dessas compras na ficha Bens e  │
│ Direitos.                                            │
│                                                       │
│ Isso não trava a lista de Pagamentos Efetuados nem a │
│ posição da aferição do INSS — compra no cartão não é │
│ mão de obra.                                         │
│                                                       │
│ Extrato da fatura (emitido pelo cartão)              │
│ [ Escolher arquivo ]                                 │
│                                                       │
│ [ Anexar extrato ]  (desabilitado até escolher arquivo)│
└───────────────────────────────────────────────────────┘
```

- **Título do Card**: "Fatura sem extrato" — mesmo texto do chip da pendência
  (seção 4), para quem chega aqui pelo CTA da fila reconhecer a mesma frase.
- **Parágrafo 1 (consequência)** — citação do ADENDO 1 ("Por que o vínculo
  importa") + ADENDO 2 ("Nuance para o `cto-obra`"): explica o que falta e por
  quê, no vocabulário do próprio parecer ("apoio hábil", "ano-calendário
  certo", "Bens e Direitos").
- **Parágrafo 2 (escopo do não-veto)** — citação do Gate Fiscal item 4 e do
  critério 16 do ticket: existe precisamente para que o Mateus não generalize
  o vermelho como "trava tudo", igual `documentos_sem_arquivo` trava. Sem esta
  frase, a cor vermelha sozinha convida à leitura errada.
- **`CampoArquivo`** com o mesmo rótulo e mesma ajuda da seção 1 (constante
  reaproveitada — não redige de novo).
- **Botão "Anexar extrato"** (`BotaoSalvar`, variante secundária — não é a
  ação primária da tela, que continua sendo "Confirmar fatura paga"/"Registrar
  pagamento parcial" quando existir `abertas`): desabilitado até um arquivo ser
  escolhido; ao clicar, sobe o arquivo (`subirParaAcervo`) e chama
  `anexar_extrato_fatura`. Estados do botão: "Anexar extrato" → "Anexando…" →
  (sucesso: card vira 2a, banner verde "Extrato anexado." some após navegação
  ou fica fixo, sem `router.push`, mesma disciplina de "o Mateus decide quando
  sair" do CONTAI-061) → (erro: ver seção 3).

## 3. Os 4 estados

**`/fatura/[id]/confirmar`** — carregamento e erro de carregamento não mudam
(já existem). Novidades:
- **Vazio**: os dois `CampoArquivo` sem arquivo — nenhum bloqueia o botão
  "Confirmar pagamento" (só `dataPagamento` válida bloqueia, como hoje).
- **Erro de gravação**: mensagem existente
  (`mensagemDeErroDeGravacao`) não muda de texto — cobre os dois arquivos
  juntos, porque a falha (se houver) é da mesma chamada única.
- **Sucesso**: tela "salvo" ganha na `Dica` final **uma cláusula por documento
  anexado** — nunca uma frase só para os dois (correção do Gate 2, `cto-obra`,
  2026-09-26: os dois **não têm o mesmo grão**, e a frase anterior dizia que
  fazem a mesma coisa). Só o comprovante é COPIADO para cada um dos N
  `pagamento` gerados (RPC da 0013 §3); o extrato fica em `fatura` e cobre o
  ciclo, sem ser replicado por pagamento:
  > (comprovante anexado) "O comprovante vale para o(s) {N} pagamento(s)
  > gerado(s)."
  > (extrato anexado) "O extrato fica na fatura e cobre o ciclo inteiro."

  Sem anexo nenhum, nenhuma das duas aparece — a `Dica` não afirma sobre
  documento que não existe. (Reaproveita o padrão da `Dica` já existente sobre
  juros/encargos — mesmo parágrafo, as frases extras.)

**`/fatura/[id]`** — a tela em si não ganha loading/erro novos (o bloco só
existe depois que `carregarFatura` já resolveu). Estados do bloco:
- **Ausente**: `desembolsos.length === 0` → bloco não renderiza.
- **Vazio/pendente** (2b, sem arquivo escolhido ainda): botão desabilitado.
- **Ocupado**: arquivo escolhido, botão "Anexando…", campo desabilitado
  durante o upload.
- **Erro**: `Banner cor="red"` inline dentro do próprio Card 2b, acima do
  `CampoArquivo`, texto: **"Não deu para anexar o extrato. Nada foi
  alterado — a fatura continua sem extrato."** (mesma estrutura de
  `ErroDeGravacao` usada em `anexar/page.tsx`). Arquivo escolhido permanece no
  campo; o Mateus pode tentar de novo sem reescolher.
- **Sucesso**: vira o estado 2a (Card neutro, "Extrato anexado ✓").

## 4. Pendência nova na fila unificada — `fatura_sem_extrato`

Mesmo componente/estrutura de `CardDocumentosSemArquivo`
(`app/_components/documento-sem-arquivo.tsx`) — sugiro um componente irmão
`CardFaturaSemExtrato` no mesmo arquivo ou em `app/_components/fatura-sem-extrato.tsx`,
reaproveitando `Card`/`Chip`/`Consequencia`/`Dica`/`BotaoLink` na mesma
disposição, com constantes próprias em `lib/fiscal/fatura.ts` (paralelas a
`CHIP_NOTA_SEM_ARQUIVO`/`COR_NOTA_SEM_ARQUIVO`/`..._EFEITO`/`..._ALAVANCA` de
`lib/fiscal/documento.ts`):

```
┌ Card · borda vermelha ──────────────────────────────┐
│ [Chip vermelho] Fatura sem extrato                   │
│                                                       │
│ R$ 12.340,00                        ← soma do valor  │
│                                        desembolsado   │
│                                        das faturas    │
│                                        nesta condição │
│ 1 fatura                            ← ou "N faturas"  │
│                                                       │
│ Fatura sem extrato. Você já pagou esta fatura, mas   │
│ não tem o documento da administradora que prova      │
│ quais compras estavam dentro dela — falta o apoio    │
│ hábil que fixa o ano-calendário certo dessas compras │
│ na ficha Bens e Direitos.                            │
│                                                       │
│ Peça o extrato à administradora do cartão: nem todo   │
│ banco disponibiliza extrato de ciclo antigo no        │
│ aplicativo — quanto antes pedir, mais fácil obter.    │
│                                                       │
│ Isso não trava a lista de Pagamentos Efetuados nem a │
│ posição da aferição do INSS — compra no cartão não é │
│ mão de obra. O que fica em risco é o ano-calendário   │
│ certo do gasto na discriminação de Bens e Direitos.  │
│                                                       │
│ [ Ver a fatura ]              ← só quando quantidade=1│
└───────────────────────────────────────────────────────┘
```

- **Chip**: "Fatura sem extrato" — constante nova `CHIP_FATURA_SEM_EXTRATO`.
- **Cor**: vermelha — `COR_FATURA_SEM_EXTRATO = "red"` (ADENDO 2, "Veredito").
- **Valor exibido**: soma de `totalDesembolsadoCentavos(fatura)` de todas as
  faturas com `desembolsos.length > 0 && extratoPath === null` — é dinheiro já
  saído sem apoio hábil que fixe o ano, o mesmo tipo de número que
  `documentosSemArquivo.totalCentavos` já mostra para o caso irmão.
- **`Dica` de quantidade**: "1 fatura" / "{N} faturas" — mesma concordância de
  `CardDocumentosSemArquivo`.
- **`Consequencia` (parágrafo 1)**: citação do ADENDO 1 + ADENDO 2, mesma frase
  da seção 2b acima, com concordância plural quando `quantidade > 1` ("Você já
  pagou estas faturas, mas não tem os documentos da administradora que provam
  quais compras estavam dentro delas — falta o apoio hábil que fixa o
  ano-calendário certo dessas compras na ficha Bens e Direitos.").
- **Alavanca** (produto, não fiscal — paralelo a `NOTA_SEM_ARQUIVO_ALAVANCA`):
  "Peça o extrato à administradora do cartão: nem todo banco disponibiliza
  extrato de ciclo antigo no aplicativo — quanto antes pedir, mais fácil
  obter." Espelha o `[Guessing]` do ADENDO sobre extrato de ciclo antigo
  genuinamente inobtível, sem prometer nem proibir nada — é aviso de janela que
  fecha, igual ao par de "Nota sem arquivo".

  ⚠️ **CONDICIONAL, e a forma é correção do Gate 2** (`contador`, 2026-09-26).
  A redação proposta antes — *"bancos costumam guardar poucos ciclos no
  aplicativo"* — afirmava como FATO o que o parecer registrou como `[Guessing]`
  (o ADENDO diz que o extrato antigo **pode** não estar em autoatendimento "em
  todo banco/administradora", não que costume não estar). Texto de tela que sobe
  o grau de certeza de um parecer é a mesma falha de "copia, não reescreve" —
  para cima.
- **`Dica` de escopo (parágrafo 2, a diferença estrutural do CardDocumentosSemArquivo)**:
  **NÃO** repete a frase de veto ("nenhuma saída anual é gerada") — essa frase
  é exclusiva de `documentos_sem_arquivo`, onde é verdadeira. Aqui a frase
  correta, citada do Gate Fiscal item 4/critério 16, é o oposto: diz
  explicitamente que Pagamentos Efetuados e a aferição INSS **não** são
  afetados, e nomeia o que é (a discriminação do ano-calendário certo em Bens
  e Direitos). Omitir esse parágrafo seria deixar o Mateus inferir, pela
  semelhança visual com o card vermelho vizinho, um veto que o Gate Fiscal
  explicitamente descartou (pre-mortem 3 do ticket, por extensão).
- **CTA**: mesma regra de `DocumentosSemArquivo.href` — **1 fatura** → aponta
  para `/fatura/${fatura.id}` (a tela do bloco 2b, onde a ação mora); **mais de
  uma** → sem `BotaoLink`, card informativo (o ticket já fecha esse
  comportamento no critério 14; aqui só se fixa o texto e o corte em 1 vs. N,
  idêntico ao precedente de `documentos_sem_arquivo`).
- **Sem estados de loading/erro/vazio próprios** — é card derivado, existe
  só quando a regra pura (`desembolsos.length > 0 && extratoPath === null`)
  é verdadeira para pelo menos uma fatura; desaparece da fila sozinho quando
  deixa de ser (mesmo comportamento de todo o resto da fila unificada).

## 5. Nota técnica não vinculante (fora de design, registrada para não se perder)

`PapelDeAnexo` (`lib/types.ts:455`) hoje é `"comprovante" | "nota" | "contrato"`
— não tem `"extrato"`. `subirParaAcervo`/`ListaDeAnexos` precisam do papel novo
para rotular o item corretamente no acervo e na lista. Decisão de tipo, não de
layout — para o `cto-obra`/`lead-engineer` no Gate 1/2, citada aqui só para não
travar a implementação por falta de aviso.

## Decisões e perguntas abertas

Nenhuma pergunta bloqueante de design. Duas coisas ficam explicitamente fora
deste spec, por já estarem fechadas em outro lugar: (a) nome exato da RPC, da
coluna e do parâmetro — critérios 7-12 do ticket, já fechados pelo `cto-obra`;
(b) mecanismo técnico de qual saída anual a pendência trava — critério 16,
Gate 2 do `cto-obra`. O texto de consequência fiscal citado acima (seções 2b e
4) é próximo do literal do ADENDO/ADENDO 2 desta sessão; se o `contador` quiser
ajustar palavra por palavra no Gate 2, troca sem reabrir layout — mesmo padrão
que o CONTAI-061 já registrou para os avisos de ano anterior.
