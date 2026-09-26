# CONTAI-062 — sugestão automática do gate de retenção, a partir do PDF (sem clique)

Cenário: **captura** (`/adicionar/documento`). Nível 2: ajuste de campo/estado
numa tela existente — reaproveita `Escolha` (`app/_components/campos.tsx`),
`BlocoRetencaoDaCaptura`/`FormularioDeLinha` (`app/_components/retencao.tsx`) e
o efeito de leitura já existente em `page.tsx`. Sem rota nova, sem HTML.

O "Teste do Canteiro" aqui não é veto a densidade (não é o caso) — é o próprio
motivo do ticket: o princípio 1 (`CLAUDE.md`) diz que o momento de captura é
sagrado e que tudo que puder ser adiado deve sair do caminho manual. Hoje o
gate exige um toque manual antes de a leitura automática rodar; este ticket
zera esse toque. O caminho de captura fica mais curto, não mais longo.

## Campos

- SEM CAMPOS — nenhum campo fiscal novo. `retencaoNaNota` continua com as
  mesmas duas opções do banco (`"nenhuma"` / `"destacada"`,
  `Enums<"retencao_na_nota">`) — não existe (e não pode existir) um terceiro
  valor "sugerida" gravado. A origem (`"manual"` | `"sugerida"`) é **estado de
  tela, efêmero, nunca grava**: no "Salvar registro" só `retencaoNaNota` viaja
  para `criarDocumento` (linha 746 de `page.tsx`), exatamente como hoje.
  Disciplina fiscal intocada: campo vazio pergunta, campo preenchido afirma,
  nenhum default fiscal, `notaNoCpf` não muda em nada (confirmado — nenhuma
  linha deste ticket toca `notaNoCpf`).

## 1. Contrato de estado (herdado do Gate 3 do `cto-obra` — citado, não redecidido)

Novo estado em `RegistrarDocumento` (`page.tsx`), ao lado de
`retencaoNaNota`/`setRetencaoNaNota` (linha ~259-260):

```ts
const [origemGateRetencao, setOrigemGateRetencao] =
  useState<"manual" | "sugerida" | null>(null);
```

- `responderGateDeRetencao` (linha 296-299) passa a sempre marcar origem
  manual, em QUALQUER toque — inclusive tocar de novo na opção já marcada
  como sugerida (ver §4, isso é o "confirmar implícito" que o `cto-obra`
  decidiu não ter botão próprio):

  ```ts
  function responderGateDeRetencao(resposta: RespostaRetencaoNaNota) {
    setOrigemGateRetencao("manual");
    setRetencaoNaNota(resposta);
    if (resposta !== "destacada") setLinhasPendentes([]);
  }
  ```

  ❌ **ERRADO — corrigido no Gate 1/2 do CONTAI-062, 2026-09-26.** O texto
  original desta seção dizia: *"Isto funciona porque o `input[type=radio]` do
  `Escolha` já dispara `onChange` em TODO clique, mesmo quando a opção clicada
  já estava marcada — é assim que o React normaliza radio/checkbox. **Não é
  preciso reescrever `Escolha` para botões avulsos nem inventar um `onClick`
  paralelo**"*.

  **A premissa é falsa, e foi MEDIDA duas vezes** (pelo `lead-engineer` no Gate
  1 e conferida pelo `cto-obra` no Gate 2, comentando a correção e vendo o
  teste quebrar): o `ChangeEventPlugin` do react-dom só sintetiza `change` a
  partir do `click` de um rádio quando `node.checked` **mudou**, e clicar no
  rádio já marcado não muda nada. Com a spec como estava, tocar na pílula
  sugerida não teria efeito nenhum e o selo "Sugerida" sobreviveria ao dedo do
  Mateus — o critério 8 do ticket não fecharia.

  **O mecanismo real, como ficou implementado:**

  - `app/_components/campos.tsx` — um `onClick` no `input` que existe **só
    quando `ehSugerido`**: `onClick={ehSugerido ? () => onChange(o.valor) :
    undefined}`. Nenhum outro `Escolha` passa `sugerido`, então o handler nem
    chega ao DOM no resto do app, e no único caso em que existe o `onChange`
    não pode disparar junto (o valor não muda) — logo não há chamada dupla.
  - O texto da opção passou a morar num `<span>` próprio dentro do `<label>`:
    com o selo e o `sr-only` ao lado, o `textContent` do label deixa de ser só
    "Destacada" e o `getByText(opcao, { exact: true })` do `escolher`
    (`e2e/formularios.ts`, usado por ~20 testes) não acharia mais a opção.
  - A resposta e a origem viraram **um estado só** —
    `{ resposta, origem }` — em vez de `retencaoNaNota` +
    `origemGateRetencao` separados (os dois nomes seguem existindo como
    valores derivados). É o que torna a decisão do critério 7 atômica e pura:
    `setGateDeRetencao((atual) => atual ?? …)` recebe o valor mais recente, sem
    depender de um `ref` espelhado ter sido atualizado antes de a resposta
    chegar.

  O que a spec acertou e continua valendo: **não** reescrever `Escolha` para
  botões avulsos, o que é o que preserva o `getByRole("group"…)` /
  `getByRole("radio")` que `e2e/retencao.spec.ts` (linhas 119-134, 279) já usa
  contra este mesmo fieldset.

- O gatilho da leitura (`alvoDaSugestaoDeRetencao`, `page.tsx` linhas
  424-430) **remove a pré-condição `retencaoNaNota === "destacada"`** —
  decisão já fechada do `cto-obra`, citada aqui só para a spec ficar
  implementável:

  ```ts
  const alvoDaSugestaoDeRetencao =
    exigeRetencao(tipo) &&
    arquivo !== null &&
    arquivo.type === "application/pdf"
      ? arquivo
      : null;
  ```

- Dentro do efeito que já existe (linhas 449-485), no ponto em que
  `corpo.sugestao` chega (linha 475, `if (corpo.sugestao) setSugestaoRetencao(corpo.sugestao)`),
  a sugestão continua sendo **armazenada incondicionalmente** — isso já é o
  comportamento de hoje e não muda. O que se ACRESCENTA é: só quando o gate
  ainda está intocado (`null`) na hora em que a resposta chega, a chegada da
  sugestão TAMBÉM decide o gate:

  ```ts
  if (corpo.sugestao) {
    setSugestaoRetencao(corpo.sugestao);
    if (/* retencaoNaNota ainda null */) {
      setRetencaoNaNota("destacada");
      setOrigemGateRetencao("sugerida");
    }
  }
  ```

  ⚠️ **Achado na leitura, não hipotético — condição de corrida real**: o
  efeito fecha sobre o `retencaoNaNota` de quando ele foi criado
  (`[alvoDaSugestaoDeRetencao]` é a única dependência). Se o Mateus responder
  o gate manualmente enquanto o fetch ainda está em voo, ler o `retencaoNaNota`
  fechado no closure pode estar desatualizado e reabrir o gate por cima da
  resposta manual dele — exatamente o que a salvaguarda técnica 2 ("uma
  resposta manual, a qualquer momento, sempre vence, inclusive em voo")
  proíbe. Isto precisa ler o valor MAIS RECENTE (um `ref` espelhando o
  estado, ou equivalente) — não decido o mecanismo aqui, é do
  `lead-engineer`/`cto-obra`, só fica registrado para não ser perdido no Gate
  1/2.
- Se o gate já está manualmente `"nenhuma"` ou `"destacada"` quando a
- ⚠️ **FALTAVA nesta spec, e o silêncio virou o bloqueante do Gate 2 — troca
  de anexo mata o gate SUGERIDO.** O bloco de invalidação de `page.tsx` já
  zerava `sugestaoRetencao`/`falhou`/`lendo` quando o `alvo` muda (outro PDF,
  uma foto, anexo removido), mas a spec não dizia nada sobre o gate — e a
  primeira implementação o deixou de pé: pílula "Destacada" com selo
  "Sugerida", sem trecho literal embaixo e sem linha, motivada por um papel que
  já não está mais anexado. É a leitura de um papel exibida ao lado de outro, o
  que o próprio bloco existe para impedir. Regra correta, pelas salvaguardas 1
  e 4 do ADENDO 5 §3 (gate e linha se sugerem juntos, logo morrem juntos):
  **só a resposta de origem `"sugerida"` morre com o anexo** (e leva
  `linhasPendentes` com ela, como `escolherTipo` já faz); uma resposta
  **manual** — `"nenhuma"` inclusive — é afirmação do Mateus sobre a nota e
  sobrevive à troca, que é o critério 7 aplicado à troca de papel e não só à
  corrida do fetch. Coberto por `6.6`/`6.7` em
  `e2e/captura-retencao-desktop.spec.ts`.
- Se o gate já está manualmente `"nenhuma"` ou `"destacada"` quando a
  sugestão chega, ela NUNCA muda `retencaoNaNota` nem `origemGateRetencao` —
  só fica guardada em `sugestaoRetencao`. Isso tem um efeito colateral bom e
  gratuito: se ele respondeu `"nenhuma"` primeiro e muda de ideia depois,
  marcando `"destacada"` à mão, o trecho literal (§3) aparece na hora, sem
  precisar de um novo fetch — porque a condição de exibição do trecho é só
  "há sugestão guardada E o gate está em destacada" (ver §3), nunca "a
  sugestão chegou associada ao gate destacada".

## 2. Extensão do `Escolha` (`app/_components/campos.tsx`)

Novo prop opcional, `default null` — **sem efeito em nenhum outro uso
existente** de `Escolha` (classificação, CPF, CNO, composição, tributo,
quem-recolhe, `SIM_NAO` etc.):

```ts
export function Escolha<T extends string>({
  // ...props atuais
  sugerido = null,
}: ComCampo & {
  // ...tipos atuais
  /**
   * Valor cuja pílula MARCADA deve usar o estilo de SUGESTÃO (âmbar, com
   * selo), em vez do preenchido escuro de sempre. `null` (default) = nenhuma
   * mudança de visual — todo outro `Escolha` do app continua idêntico.
   */
  sugerido?: T | null;
}) { /* ... */ }
```

Dentro do `.map((o) => ...)`, ao lado de `marcado`:

```ts
const marcado = valor === o.valor;
const ehSugerido = marcado && sugerido === o.valor;
```

Classe da pílula (substitui o ternário atual de 3 vias por um de 4):

| Estado | Classe |
|---|---|
| Sugerida (marcada, ainda não confirmada) | `border-amb bg-amb-bg text-ink` |
| Marcada manual (como hoje) | `border-ink bg-ink text-paper` |
| Vazia com erro (como hoje) | `border-red bg-white text-ink` |
| Vazia sem erro (como hoje) | `border-line bg-white text-ink` |

`border-amb`/`bg-amb-bg` já existem como tokens (`app/globals.css`:
`--color-amb: #92600a`, `--color-amb-bg: #fdf3df`) — é o MESMO par de cores
que `Chip cor="amb"` e o banner de `FormularioDeLinha` (`data-sugestao="retencao"`)
já usam. Não se inventa cor nova.

Dentro do mesmo `<label>` (já `relative`, por causa do `sr-only` do radio),
quando `ehSugerido`, um selo no canto:

```tsx
{ehSugerido ? (
  <span
    aria-hidden="true"
    className="absolute -top-2 right-1 rounded-full bg-amb px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-paper"
  >
    Sugerida
  </span>
) : null}
```

`bg-amb text-paper` (âmbar sólido, texto claro) contra o corpo da pílula, que
é `bg-amb-bg` (o tom claro) — o selo precisa se destacar do próprio corpo da
pílula, não pode usar o mesmo par claro/claro.

Acessibilidade — texto para leitor de tela, dentro do mesmo `<label>`, só
quando `ehSugerido`:

```tsx
{ehSugerido ? (
  <span className="sr-only"> — sugerida automaticamente, ainda não confirmada</span>
) : null}
```

**Por que cor + selo + texto, e não só cor**: a salvaguarda fiscal 2 exige
"visualmente distinta, nunca parecendo resposta que ele deu" — e o próprio
código já documenta o princípio de não confiar num canal só (`ui.tsx`,
comentário do `Chip vazado`: *"sozinho é um canal só e falha no sol"*). Cor
âmbar sozinha falharia para quem não distingue bem cor; o selo com a palavra
"Sugerida" é o segundo canal, textual.

### Matriz visual completa do gate `retencaoNaNota`

| | "Nenhuma" | "Destacada" |
|---|---|---|
| Nada respondido ainda | `border-line bg-white text-ink` | `border-line bg-white text-ink` |
| Erro (tentou salvar sem responder) | `border-red bg-white text-ink` | `border-red bg-white text-ink` |
| Marcado manualmente | `border-ink bg-ink text-paper` (preenchido escuro) | `border-ink bg-ink text-paper` (preenchido escuro) |
| **Sugerido pelo parser, ainda não confirmado** | *(nunca — parser nunca sugere "Nenhuma", salvaguarda fiscal 1)* | `border-amb bg-amb-bg text-ink` **+ selo "Sugerida"** no canto |

## 3. O trecho literal ao lado do gate (qualquer largura)

Novo bloco em `page.tsx`, logo abaixo do `<Escolha campo="retencaoNaNota" .../>`
(antes de `DICA_GATE_DESTACADA`/`DICA_GATE_DESTACADA_LARGA`, linhas 1490-1503) —
já dentro do `{retencaoNaNota === "destacada" ? (...) : null}` que envolve tudo
isso hoje, então não aparece nunca com o gate em "Nenhuma" ou vazio:

```tsx
{lendoSugestaoRetencao ? (
  <div role="status" data-sugestao="gate-lendo">
    <Dica>{SUGESTAO_RETENCAO_LENDO}</Dica>
  </div>
) : null}

{!lendoSugestaoRetencao && falhouSugestaoRetencao && sugestaoRetencao === null ? (
  <div data-sugestao="gate-falhou">
    <Banner cor="amb" role="status">{SUGESTAO_RETENCAO_FALHOU}</Banner>
  </div>
) : null}

{sugestaoRetencao ? (
  <div data-sugestao="gate">
    <Banner cor="amb" role="status">
      <Chip cor="amb">{SUGESTAO_RETENCAO_CHIP}</Chip>
      <p className="mt-1.5 text-[14px] leading-tight font-bold break-words">
        "{sugestaoRetencao.rotuloLiteral}"
        {" — "}
        <span className="mono">{formatarBRL(sugestaoRetencao.valorCentavos)}</span>
      </p>
      <p className="mt-1.5 text-[12px]">{SUGESTAO_GATE_CONFIRA}</p>
    </Banner>
  </div>
) : null}
```

Reaproveita literalmente `SUGESTAO_RETENCAO_CHIP` ("Lido automaticamente desta
nota") — a MESMA legenda que o banner de dentro do `FormularioDeLinha` já usa
(`retencao.tsx` linha 650) — e o MESMO formato de citação (aspas, negrito,
valor em `mono`). Isso é o que impede os dois lugares (aqui e dentro do
`FormularioDeLinha`, em largura larga) de parecerem dois achados diferentes:
mesma legenda, mesma formatação da citação, cor âmbar nos dois. O que muda
entre os dois é só o comprimento do texto de rodapé — aqui é curto (produto),
lá dentro é o `SUGESTAO_RETENCAO_CONFIRA` longo (que explica a aritmética,
porque ali ele está prestes a editar campos de verdade).

Nova constante em `lib/fiscal/retencao.ts`, ao lado de `SUGESTAO_RETENCAO_CHIP`
(linha 142) — texto de produto, não citação de parecer:

```ts
export const SUGESTAO_GATE_CONFIRA =
  "Sugerido a partir da leitura do PDF — confira antes de salvar.";
```

### Onde isso deixa órfão o bloco antigo de loading/falha

`BlocoRetencaoDaCaptura` (`retencao.tsx` linhas 837-848) tem hoje os blocos
`vazio && lendoSugestao` / `vazio && falhouSugestao` — só visíveis ≥880px E só
quando o gate já está "destacada" (porque o componente inteiro só monta
dentro desse branch). Com o trecho do gate aparecendo em QUALQUER largura
(inclusive quando o gate ainda está `null`, que é justamente o caso novo
deste ticket), esses dois blocos ficam redundantes em ≥880px — o mesmo texto
apareceria duas vezes na tela ao mesmo tempo. **Remover as linhas 837-848 de
`retencao.tsx`.** As props `lendoSugestao`/`falhouSugestao` de
`BlocoRetencaoDaCaptura` ficam sem uso e podem sair da assinatura na mesma
oportunidade (limpeza, não obrigatório).

⚠️ **Isso muda dois seletores de E2E**, então não é regressão silenciosa —
está aqui para o `lead-engineer` migrar no mesmo commit:
- `e2e/captura-retencao-desktop.spec.ts` linhas 662-664, 693-699:
  `bloco.locator('[data-sugestao="lendo"|"falhou"|"retencao"]')` — os dois
  primeiros (`"lendo"`, `"falhou"`) migram para
  `page.locator('[data-sugestao="gate-lendo"|"gate-falhou"]')` (fora do
  `bloco`, porque agora vivem fora do repeater); `"retencao"` (o banner de
  dentro do `FormularioDeLinha`) não muda.
- Linhas 745, 796 (`bloco.locator('[data-sugestao="lendo"]')`) — mesma
  migração.

## 4. O que acontece ao tocar

| Toque | Antes do toque | Depois do toque |
|---|---|---|
| Toca "Destacada" (que já está sugerida, âmbar+selo) | `retencaoNaNota="destacada"`, `origem="sugerida"` | **valor não muda**; `origem` vira `"manual"` — pílula troca de âmbar+selo para preenchido escuro, selo some. Nenhuma linha em `linhasPendentes` é tocada. |
| Toca "Nenhuma" (enquanto "Destacada" está sugerida) | `retencaoNaNota="destacada"`, `origem="sugerida"` | `retencaoNaNota="nenhuma"`, `origem="manual"`; `linhasPendentes` esvazia (comportamento já existente, linha 298); o trecho do §3 some (sai do branch `=== "destacada"`); `sugestaoRetencao` continua guardado em memória — se ele voltar a marcar "Destacada" à mão, o trecho reaparece na hora, sem novo fetch (ver nota do §1). |
| Toca "Destacada" (gate estava vazio, sem sugestão nenhuma ainda) | `retencaoNaNota=null` | Fluxo de hoje, sem mudança: `origem="manual"` desde o primeiro toque, pílula preenchida escura direto — nunca passa por âmbar. |
| Não toca em nada, aperta "Salvar registro" com o gate ainda sugerido | `origem="sugerida"` | Grava `retencao_na_nota: "destacada"` normalmente (só a resposta viaja, nunca a origem) — a confirmação implícita do `cto-obra`: seguir em frente SEM tocar já vale como aceitar a sugestão. |

## 5. Os 4 estados de leitura, na íntegra

| Estado | Condição | O que aparece perto do gate (qualquer largura) |
|---|---|---|
| Vazio | sem PDF anexado, ou tipo não exige retenção, ou ainda não houve leitura | nada — gate como está (vazio ou já respondido manualmente) |
| Carregando | `lendoSugestaoRetencao === true` | `<Dica role="status">{SUGESTAO_RETENCAO_LENDO}</Dica>` — "Lendo a retenção nesta nota…", texto já existente, agora visível em qualquer largura e mesmo com o gate ainda `null` |
| Sugestão chegou | `sugestaoRetencao !== null` | banner âmbar do §3 (chip + citação + `SUGESTAO_GATE_CONFIRA`) |
| Falhou | `falhouSugestaoRetencao === true && sugestaoRetencao === null` | O padrão real do CONTAI-055 (`BlocoRetencaoDaCaptura`, `falhouSugestao` atual) já mostra `SUGESTAO_RETENCAO_FALHOU` num `Banner cor="amb"`: calmo, não-bloqueante, nunca vermelho — mas VISÍVEL. Reaproveitar esse mesmo texto e essa mesma cor aqui, na mesma posição do §3, em vez de inventar um terceiro grau de severidade ou apagar a mensagem que já existe. Nunca bloqueia "Salvar", gate e formulário seguem vazios/como estavam, nenhum erro de campo é gerado. |

## 6. ASCII — narrow (<880px)

```
Esta nota destaca alguma retenção?
┌───────────────────┬───────────────────┐
│      Nenhuma       │  ╭─────────╮      │
│  border-line/white │  │Sugerida │      │ ← selo âmbar sólido
│                    │╭─────────────────╮│
│                    ││    Destacada    ││ ← corpo âmbar claro
│                    │╰─────────────────╯│   (bg-amb-bg), não preto
└───────────────────┴───────────────────┘

┌ banner âmbar ──────────────────────────┐
│ [Lido automaticamente desta nota]      │
│ "Total das Retenções" — R$ 42,00       │
│ Sugerido a partir da leitura do PDF —  │
│ confira antes de salvar.               │
└─────────────────────────────────────────┘

Você detalha isso depois, sentado — aqui só
marcamos que a nota tem retenção.

(repeater continua invisível — hidden larga:flex)
```

Se em vez disso a leitura ainda estiver em andamento (PDF acabou de ser
anexado, gate ainda `null`, nenhuma pílula marcada):

```
Esta nota destaca alguma retenção?
┌───────────────────┬───────────────────┐
│      Nenhuma       │     Destacada     │  ← nenhuma marcada
│  border-line/white │ border-line/white │
└───────────────────┴───────────────────┘
Lendo a retenção nesta nota…
```

## 7. ASCII — larga (≥880px), gate sugerido

```
Esta nota destaca alguma retenção?
[ Nenhuma ]  [ Destacada (Sugerida) ]  ← mesma pílula âmbar+selo de cima

[banner âmbar — mesmo do narrow, mesma legenda/citação/copy]

As linhas de retenção aparecem logo abaixo — preencha agora,
com a nota na mão, ou deixe em branco e complete depois,
na tela desta nota.
┌ Nova linha de retenção ──────────────────────┐
│ [Lido automaticamente desta nota]            │  ← MESMA legenda de novo
│ "Total das Retenções"                        │  ← MESMA citação
│ R$ 42,00                                     │
│ Confira na nota antes de adicionar: a        │  ← aqui o texto longo
│ leitura acha esta linha pela aritmética...   │     (SUGESTAO_RETENCAO_CONFIRA,
│                                               │      inalterado)
│ Rótulo (copie exatamente da nota) [_______]  │
│ Valor                              [_______] │
│ ...                                          │
└───────────────────────────────────────────────┘
```

A repetição da citação (uma vez compacta perto do gate, outra vez completa
dentro do formulário) é intencional — mesma legenda, mesma formatação da
citação, mesma cor, para não parecerem dois achados.

## Cenário e checagem final

**Cenário: captura** (`/adicionar/documento`). Isto não conflita com o
princípio "375px deixou de ser piso obrigatório" (correção de 2026-09-21) nem
com sua extensão às telas de captura (2026-09-22) — aquilo libera DENSIDADE
extra em tela larga, e este ticket não pede densidade nova, pede **remoção**
de um toque manual no meio do fluxo de captura. Ele serve ao princípio 1
diretamente: menos interação no momento sagrado da captura, não mais. O
"Teste do Canteiro" (captura, ≤3 interações, anexo obrigatório) continua de
pé e fica mais fácil de passar, não mais difícil — é exatamente esse o ponto
do relato original do Mateus.
