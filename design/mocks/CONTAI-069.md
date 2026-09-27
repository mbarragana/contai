# CONTAI-069 — sugestão automática do gate `cnoNaNota`, a partir do CNO impresso na nota

Cenário: **captura** (`/adicionar/documento`). Nível 2: ajuste de campo/estado
numa tela existente — reaproveita `Escolha` (`app/_components/campos.tsx`,
prop `sugerido` já construída no CONTAI-062, byte a byte, sem tocar o
componente) e a rota `POST /api/sugerir-retencao` que já roda a cada PDF
anexado num tipo que exige retenção (`app/(captura)/adicionar/documento/page.tsx`,
efeito de leitura em torno das linhas 445-485). Sem rota nova, sem tela nova.

## Gate Fiscal — decisão já registrada, não redecidida aqui

Este ticket implementa uma automação que o `contador` **reprovou duas vezes**
e o Mateus **sobrepôs duas vezes**, com transparência total — está tudo em
`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md` (Pergunta 2 + ADENDO) e
`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`. Resumo
para quem só vai ler este mock:

- O parecer aprova **ler e comparar** o CNO impresso automaticamente, mas
  reprova **marcar `cnoNaNota = "desta_obra"` sozinho** — mesmo como sugestão
  a confirmar. Razão final (ADENDO §3): `cnoNaNota` é o único dos três campos
  desta família em que o próprio `CONTAI-007` já trata a direção "incluir"
  como erro sem conserto (`bloqueiaPorCnoDeOutraObra` bloqueia o espelho,
  `outra_obra`), e trocar "decidir" por "confirmar uma decisão do sistema" é
  mudança de tarefa cognitiva, não redução de taxa de erro.
- **O Mateus decidiu implementar mesmo assim** — apetite de risco do dono do
  produto, registrado por inteiro no backlog 85. Este mock desenha essa
  decisão, não a repesa.
- A recomendação de UX do 2º parecer (ADENDO §5) — "computar o veredito da
  igualdade exata e exibi-lo em texto… números idênticos / números
  diferentes" — **é seguida à risca aqui**, mesmo quando o veredito automático
  vai além dela (marcar o campo): é o texto que o contador pediu, citado, não
  reescrito.

## Campos

- SEM CAMPOS — SEM CAMPO NOVO no banco e nenhum controle novo na tela.
  `cno_referenciado`/`nota_traz_cno` continuam exatamente como
  `cnoReferenciadoParaBanco`/`notaTrazCnoParaBanco`
  (`lib/fiscal/documento.ts:419-441`) já gravam hoje — três respostas possíveis
  de `RespostaCnoNota`, nenhuma quarta. A origem (`"manual"` | `"sugerida"`) é
  **estado de tela, efêmero, nunca grava** — mesma disciplina do
  `origemGateRetencao` do CONTAI-062. Nenhuma linha deste ticket toca
  `notaNoCpf`, `retencaoNaNota` ou qualquer campo dos quatro fiscais da linha de
  retenção. O gate `cno_referenciado` continua **SEM DEFAULT**: no instante em
  que a tela nasce não há PDF anexado, logo não há leitura e nenhuma pílula está
  marcada — a sugestão chega depois, e chega marcada como sugestão.

## 1. Contrato de dados — o que a rota devolve, o que o cliente decide

**Decisão de arquitetura**: a rota `/api/sugerir-retencao` só lê o PDF, nunca
sabe qual é "a obra corrente" (ela não recebe esse dado no corpo hoje, e não
deveria passar a receber). A comparação contra o CNO cadastrado é FISCAL e já
tem casa — `cnoNormalizado` (`lib/fiscal/obra.ts:509`), a única função que
compara CNO no projeto ("quem compara CNO importa daqui", comentário na linha
501-504). Então: **a rota devolve os candidatos crus lidos do papel; quem
compara é `page.tsx`**, que já tem `obra.cno` em mão.

Extensão da resposta de `app/api/sugerir-retencao/route.ts` (hoje só
`{ sugestao }`, linha 48):

```ts
type CandidatoCnoLido = {
  /** Como impresso — "CNO", "Cadastro Nacional de Obras" ou "Matrícula CEI". */
  rotuloLiteral: string;
  /** Como impresso, com pontuação (ex.: "12.345.67890/26") — não normalizado. */
  numeroBruto: string;
};

type Resposta = {
  sugestao: SugestaoLinhaRetencao | null;
  /** NOVO — CONTAI-069. Lista crua, nunca comparada aqui. `[]` = nada achado. */
  cno: CandidatoCnoLido[];
};
```

Extração (`lib/extracao/`, novo `extrairCandidatosCno(texto: string):
CandidatoCnoLido[]`, mesma família de padrão par-rotulado que
`extrairLinhasRotuladas` já usa para retenção — cto-obra define a forma exata
do regex/âncora): rótulo contendo literalmente "CNO", "Cadastro Nacional de
Obras" ou "Matrícula CEI", número imediatamente associado. Sem rótulo
inequívoco, lista vazia — mesma doutrina de silêncio (nunca "melhor
palpite") que já rege a linha de retenção.

No cliente (`page.tsx`), nova função pura (`lib/fiscal/obra.ts`, ao lado de
`cnoNormalizado`):

```ts
type ComparacaoCno =
  | { estado: "bate"; candidato: CandidatoCnoLido }
  | { estado: "diverge"; candidato: CandidatoCnoLido }
  /** 2+ candidatos com DÍGITOS DIFERENTES entre si — nunca por citar "CNO" duas
   *  vezes com o mesmo número, que não é ambiguidade, é repetição. */
  | { estado: "ambiguo"; candidatos: CandidatoCnoLido[] }
  | null; // nenhum candidato achado — comportamento de hoje, sem UI nova

function compararCandidatosCno(
  candidatos: CandidatoCnoLido[],
  cnoDaObra: string | null,
): ComparacaoCno {
  if (candidatos.length === 0 || cnoDaObra === null) return null;
  const digitosUnicos = new Set(
    candidatos.map((c) => cnoNormalizado(c.numeroBruto)),
  );
  if (digitosUnicos.size > 1) return { estado: "ambiguo", candidatos };
  const candidato = candidatos[0];
  const bate = cnoNormalizado(candidato.numeroBruto) === cnoNormalizado(cnoDaObra);
  return { estado: bate ? "bate" : "diverge", candidato };
}
```

`cnoDaObra === null` (obra sem CNO, `semCnoNaObra` já existe em `page.tsx`)
devolve `null` de propósito: a opção "desta obra" já some do próprio gate
nesse caso (`RESPOSTAS_CNO.filter(...)`, linha 1753), então não há com o que
comparar.

## 2. Estado novo em `RegistrarDocumento` (`page.tsx`)

Ao lado de `cnoNaNota`/`setCnoNaNota` (linha 357):

```ts
const [candidatosCno, setCandidatosCno] = useState<CandidatoCnoLido[]>([]);
const [origemGateCno, setOrigemGateCno] =
  useState<"manual" | "sugerida" | null>(null);

const comparacaoCno = useMemo(
  () => compararCandidatosCno(candidatosCno, semCnoNaObra ? null : obra?.cno ?? null),
  [candidatosCno, semCnoNaObra, obra?.cno],
);
```

No efeito de leitura já existente (mesmo bloco que recebe `corpo.sugestao`,
linha ~475): acrescentar `if (corpo.cno) setCandidatosCno(corpo.cno);` —
**incondicional**, igual à sugestão de retenção (guarda sempre, decide depois
se mexe no gate).

Decisão do gate, só quando ele ainda está intocado:

```ts
if (comparacaoCno?.estado === "bate" && /* cnoNaNota ainda null */) {
  setCnoNaNota("desta_obra");
  setOrigemGateCno("sugerida");
}
```

⚠️ **Mesma condição de corrida já medida no CONTAI-062, aplicada aqui por
antecipação**: ler `cnoNaNota` fechado num closure de efeito pode estar
desatualizado se o Mateus responder o gate manualmente enquanto o fetch ainda
está em voo. O mecanismo exato (valor mais recente via `ref`, ou
equivalente) é decisão do `lead-engineer`/`cto-obra` no Gate 1/2 — registrado
aqui para não ser perdido, exatamente como o CONTAI-062 registrou o mesmo
risco antes de ele quebrar teste.

`responderGateDeCno` substitui `onChange={setCnoNaNota}` (linha 1757),
mesmo mecanismo do `responderGateDeRetencao`:

```ts
function responderGateDeCno(resposta: RespostaCnoNota) {
  setOrigemGateCno("manual");
  setCnoNaNota(resposta);
}
```

Todo toque — inclusive tocar de novo na opção já sugerida — passa por aqui e
marca origem manual. O `onClick` que dispara `onChange` em cima do valor já
marcado **já existe** em `campos.tsx` (`ehSugerido ? () => onChange(o.valor)
: undefined`, CONTAI-062): nenhuma mudança em `Escolha` é necessária.

**Invalidação — troca de anexo mata só a resposta de origem `"sugerida"`**
(mesma correção do Gate 2 do CONTAI-062, §1, aplicada ao CNO): no bloco que já
zera `sugestaoRetencao`/`falhou`/`lendo` quando o `alvo` muda, acrescentar:

```ts
setCandidatosCno([]);
if (origemGateCno === "sugerida") {
  setCnoNaNota(null);
  setOrigemGateCno(null);
}
```

Uma resposta **manual** de `cnoNaNota` — `"nao_traz"` e `"outra_obra"`
inclusive — é afirmação do Mateus sobre a nota e sobrevive à troca de anexo,
igual à disciplina já estabelecida para a retenção.

**`escolherTipo` (linha 442)** já limpa `cnoNaNota` ao sair de "NF de
serviço"; estender para limpar também `origemGateCno` e `candidatosCno` na
mesma linha, pela mesma razão (resposta/sugestão guardada num tipo que não a
pergunta é órfã).

## 3. A pílula do gate — zero mudança em `campos.tsx`

No `<Escolha campo="cno_referenciado" ...>` (linha 1747-1759):

```tsx
<Escolha
  destaque
  campo="cno_referenciado"
  rotulo="Qual CNO está impresso nesta nota?"
  opcoes={semCnoNaObra ? RESPOSTAS_CNO.filter((o) => o.valor !== "desta_obra") : RESPOSTAS_CNO}
  valor={cnoNaNota}
  onChange={responderGateDeCno}
  sugerido={origemGateCno === "sugerida" ? "desta_obra" : null}
  erro={erroDe("cnoNaNota")}
/>
```

`sugerido="desta_obra"` é o ÚNICO valor possível aqui — o parser nunca sugere
`outra_obra` nem `nao_traz` (a rota nem tem como concluir isso; ela só devolve
"achei este número"). Pílula "Desta obra" fica `border-amb bg-amb-bg
text-ink` + selo "Sugerida" — **mesmo par de classes e mesmo selo do
CONTAI-062**, nenhuma cor nova.

### Matriz visual do gate `cnoNaNota`

| | "Desta obra" | "Outra obra" | "Não traz" |
|---|---|---|---|
| Nada respondido | `border-line bg-white` | `border-line bg-white` | `border-line bg-white` |
| Erro (salvar sem responder) | `border-red bg-white` | `border-red bg-white` | `border-red bg-white` |
| Marcado manualmente | `border-ink bg-ink text-paper` | `border-ink bg-ink text-paper` | `border-ink bg-ink text-paper` |
| **Sugerido, ainda não confirmado** | `border-amb bg-amb-bg` **+ selo "Sugerida"** | *(nunca)* | *(nunca)* |

## 4. O bloco de comparação — os dois números lado a lado

Novo trecho em `page.tsx`, entre o `<Escolha>` do gate e a `<Dica>` que já
mostra `{obra.nome} · CNO {obra.cno}` (linha 1760-1773) — a `<Dica>` de hoje
fica intocada, isto entra DEPOIS dela:

```tsx
{comparacaoCno?.estado === "bate" || comparacaoCno?.estado === "diverge" ? (
  <div data-sugestao={comparacaoCno.estado === "bate" ? "cno-bate" : "cno-diverge"}>
    <Banner cor="amb" role="status">
      <Chip cor="amb">{SUGESTAO_RETENCAO_CHIP}</Chip>
      <p className="mt-1.5 text-[13px] mono">
        CNO da obra: {obra.cno}
      </p>
      <p className="mt-0.5 text-[13px] mono">
        CNO da nota: {comparacaoCno.candidato.numeroBruto}
      </p>
      <p className="mt-1.5 text-[12px] font-bold">
        {comparacaoCno.estado === "bate"
          ? "— números idênticos."
          : "— números diferentes. Confira à mão qual resposta vale para esta nota."}
        {/* ⚠️ Só quando a SUGESTÃO decidiu o campo — ver o item abaixo. */}
        {comparacaoCno.estado === "bate" && cnoSugerido !== null
          ? " A resposta abaixo já veio marcada; confira antes de salvar."
          : ""}
      </p>
    </Banner>
  </div>
) : null}

{comparacaoCno?.estado === "ambiguo" ? (
  <div data-sugestao="cno-ambiguo">
    <Banner cor="amb" role="status">
      <p className="text-[13px] font-bold">
        Mais de um número de CNO encontrado nesta nota — confira no papel
        antes de responder.
      </p>
      <ul className="mt-1.5 text-[12px] mono">
        {comparacaoCno.candidatos.map((c, i) => (
          <li key={i}>{c.rotuloLiteral}: {c.numeroBruto}</li>
        ))}
      </ul>
    </Banner>
  </div>
) : null}
```

- **"— números idênticos"/"— números diferentes"** é o texto que o `contador`
  pediu literalmente no ADENDO §5 do parecer (*"CNO da obra: [número] · CNO
  da nota: [número] — números idênticos/diferentes"*) — reproduzido, não
  reescrito.
- ⚠️ **CORRIGIDO no Gate 2 do `cto-obra` (bloqueante) — "A resposta abaixo já
  veio marcada" é uma SEGUNDA afirmação, e ela só aparece com
  `cnoSugerido !== null`.** A primeira versão deste mock colava a frase dentro do
  veredito, e aí o banner mentia exatamente no caso que o critério 11 existe para
  proteger: resposta MANUAL vencendo a corrida contra a leitura (E2E 7.6 — gate
  em `"nao_traz"` pelo dedo dele, banner dizendo que o campo "veio marcado" pela
  leitura). O veredito é sobre os NÚMEROS e vale sempre; a frase sobre o campo é
  sobre a ORIGEM da resposta. Duas afirmações, duas condições — constantes
  separadas em `lib/fiscal/obra.ts` (`CNO_VEREDITO_IDENTICOS` e
  `CNO_SUGESTAO_JA_MARCADA`).
- `SUGESTAO_RETENCAO_CHIP` ("Lido automaticamente desta nota") é **reaproveitado
  como está**, sem renomear: já é a legenda de "isto veio da leitura do PDF,
  ainda não é fato" que o app usa em dois lugares (gate de retenção,
  formulário da linha); aqui vira um terceiro, sem inventar uma segunda
  legenda para dizer a mesma coisa.
- `mono` nos dois números — mesma formatação lado a lado, exigência explícita
  do `cto-obra` (a comparação tem que ser tão fácil de ler quanto a máquina
  fez).

## 5. Os 4 estados, na íntegra

| Estado | Condição | O que aparece |
|---|---|---|
| (c) Não achou rótulo de CNO no PDF | `candidatosCno === []` (nenhum candidato) | **nada** — comportamento de hoje, gate vazio, sem banner |
| (a) Achou 1, bate exato | `comparacaoCno.estado === "bate"` | gate `cnoNaNota` nasce em `"desta_obra"` + selo "Sugerida"; banner âmbar com os dois números e "— números idênticos" (mais "A resposta abaixo já veio marcada…" **só** enquanto a resposta for a sugerida — Gate 2, §4) |
| (b) Achou 1, não bate | `comparacaoCno.estado === "diverge"` | gate continua **vazio** (nenhuma pílula marcada); banner âmbar com os dois números e "— números diferentes" — para o Mateus perceber a divergência e decidir manualmente, exatamente o achado do Gate 2 do `cto-obra` |
| (d) Achou 2+ com dígitos diferentes | `comparacaoCno.estado === "ambiguo"` | gate continua vazio; aviso curto explícito ("mais de um número encontrado"), nunca silêncio — a nota que cita CNO da obra e uma matrícula antiga na mesma página é exatamente este caso |

**Carregando/falhou**: reaproveita o MESMO indicador que o CONTAI-062 já
colocou ao lado do gate de retenção (`data-sugestao="gate-lendo"|"gate-falhou"`,
`page.tsx` ~1629-1650) — **decisão deste mock: banner compartilhado, não um
estado irmão**. É a mesma requisição HTTP, o mesmo PDF, o mesmo instante; dois
"Lendo…"/"Não foi possível ler…" separados (um para retenção, outro para CNO)
apareceriam juntos sempre que um tipo exige um exige o outro (`exigeRetencao`
e `exigeCnoReferenciado` são ambas `tipo === "nf_servico"` — nunca divergem em
quais tipos se aplicam), e duplicar o aviso é ruído no momento sagrado da
captura. Ajuste de texto (só a STRING, o nome da constante não muda —
`retencao.test.ts:747` continua passando, ainda contém "o registro segue
normalmente"):

```ts
// lib/fiscal/retencao.ts
export const SUGESTAO_RETENCAO_LENDO = "Lendo os dados desta nota…";
export const SUGESTAO_RETENCAO_FALHOU =
  "Não foi possível ler os dados desta nota automaticamente (retenção, CNO). " +
  "Preencha à mão — o registro segue normalmente.";
```

⚠️ **A CONDIÇÃO de silêncio também mudou — Gate 2 do `cto-obra`, item não
bloqueante da mesma raiz.** O CONTAI-062 calava os dois indicadores com
`retencaoNaNota !== "nenhuma"`, e isso fazia sentido enquanto o banner era só da
retenção. Compartilhado, ele passou a ficar mudo com a leitura do CNO ainda em
voo — e uma FALHA real de leitura virava indistinguível de "esta nota não traz
CNO". A condição passa a olhar os dois gates:
`retencaoNaNota !== "nenhuma" || cnoNaNota === null` (há gate esperando a leitura
→ o aviso é devido; os dois resolvidos → silêncio, como antes).

Falha nunca bloqueia "Salvar registro" — critério 4 do CONTAI-055, herdado sem
exceção: gate e formulário seguem vazios/como estavam, nenhum erro de campo é
gerado por causa disto.

## 6. O que acontece ao tocar

| Toque | Antes | Depois |
|---|---|---|
| Toca "Desta obra" (já sugerida, âmbar+selo) | `cnoNaNota="desta_obra"`, origem `"sugerida"` | valor não muda; origem vira `"manual"` — pílula troca para preenchido escuro, selo some |
| Toca "Outra obra" ou "Não traz" (enquanto "Desta obra" está sugerida) | `cnoNaNota="desta_obra"`, origem `"sugerida"` | `cnoNaNota` muda para a opção tocada, origem `"manual"`; consequência de hoje dispara normalmente (bloqueio para "Outra obra", banner de pendência para "Não traz"); `comparacaoCno` continua guardado — se ele voltar para "Desta obra" à mão, o banner reaparece sem novo fetch |
| Toca "Desta obra" (gate vazio, sem sugestão nenhuma — CNO não achado ou divergente) | `cnoNaNota=null` | Fluxo de hoje: origem `"manual"` desde o primeiro toque |
| Não toca em nada, aperta "Salvar registro" com o gate ainda sugerido | origem `"sugerida"` | Grava `desta_obra` normalmente — só a resposta viaja, nunca a origem. Confirmação implícita: seguir em frente sem tocar já vale como aceitar |

## 7. ASCII — bloco completo (qualquer largura, sem split narrow/larga)

Diferente do repeater de linhas de retenção do CONTAI-062 (`hidden
larga:flex`), o gate `cno_referenciado` **já é visível em qualquer largura
hoje** — não há decisão de esconder por CSS aqui, então um ASCII só cobre os
dois pisos.

Estado (a) — achou e bate:

```
Qual CNO está impresso nesta nota?
┌───────────────────────┬─────────────┬───────────┐
│ ╭─────────╮           │             │           │
│ │Sugerida │           │ Outra obra  │ Não traz  │
│ ╭─────────────────╮   │ border-line │border-line│
│ │   Desta obra    │   │             │           │
│ ╰─────────────────╯   │             │           │
└───────────────────────┴─────────────┴───────────┘
   ↑ corpo âmbar claro (bg-amb-bg), selo âmbar sólido

Residência Mateus · CNO 12.345.67890/26
Três toques, zero digitação — o CNO não se digita aqui.

┌ banner âmbar ──────────────────────────────────┐
│ [Lido automaticamente desta nota]              │
│ CNO da obra: 12.345.67890/26                   │
│ CNO da nota: 12.345.67890/26                   │
│ — números idênticos. A resposta abaixo já veio │
│ marcada; confira antes de salvar.              │
└──────────────────────────────────────────────────┘
```

Estado (b) — achou e não bate (gate continua vazio):

```
Qual CNO está impresso nesta nota?
┌─────────────┬─────────────┬───────────┐
│ Desta obra  │ Outra obra  │ Não traz  │  ← nenhuma marcada
│ border-line │ border-line │border-line│
└─────────────┴─────────────┴───────────┘

Residência Mateus · CNO 12.345.67890/26
Três toques, zero digitação — o CNO não se digita aqui.

┌ banner âmbar ──────────────────────────────────┐
│ [Lido automaticamente desta nota]              │
│ CNO da obra: 12.345.67890/26                   │
│ CNO da nota: 98.765.43210/25                   │
│ — números diferentes. Confira à mão qual       │
│ resposta vale para esta nota.                  │
└──────────────────────────────────────────────────┘
```

Estado (d) — mais de um candidato, dígitos diferentes:

```
Qual CNO está impresso nesta nota?
┌─────────────┬─────────────┬───────────┐
│ Desta obra  │ Outra obra  │ Não traz  │  ← nenhuma marcada
└─────────────┴─────────────┴───────────┘

┌ banner âmbar ──────────────────────────────────┐
│ Mais de um número de CNO encontrado nesta nota │
│ — confira no papel antes de responder.         │
│ Matrícula CEI: 98.765.43210/18                 │
│ CNO: 12.345.67890/26                           │
└──────────────────────────────────────────────────┘
```

Estado (c) — nada achado: idêntico ao estado sem sugestão de hoje, nenhuma
linha nova na tela.

## Cenário e checagem final

**Cenário: captura** (`/adicionar/documento`). **375px não é bloqueio aqui**
por um motivo mais simples que o do CONTAI-062: o gate `cno_referenciado` já
renderiza em qualquer largura hoje (sem `hidden larga:flex`), então este
ticket não introduz nenhuma decisão nova de mostrar/esconder por viewport —
só acrescenta texto e um selo que já empilham verticalmente como qualquer
outro `Escolha`/`Banner` da tela. Não há "tratamento de desktop" a desenhar
aqui (ao contrário do que a permissão de 2026-09-22 abriria se fosse preciso)
porque a tela de captura, no piso de 375px, já é exatamente onde esta leitura
precisa aparecer primeiro: é lá que o Mateus decide o gate, na hora, com a
nota na mão ou na tela.

O "Teste do Canteiro" (captura, ≤3 interações, anexo obrigatório) fica mais
fácil de passar, não mais difícil — mesmo espírito do CONTAI-062: quando a
leitura bate, o toque que faltava (marcar "Desta obra") deixa de ser
necessário; quando não bate ou é ambígua, o Mateus ganha os números na tela
em vez de precisar procurá-los no PDF ou decorar o CNO da obra.
