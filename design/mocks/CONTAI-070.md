# CONTAI-070 — sugestão automática de `composicao`+`tributo`, a partir do rótulo lido

Cenário: **captura** (`/adicionar/documento`, dentro do `FormularioDeLinha` de
retenção). Nível 2: ajuste de campo/estado num componente existente
(`app/_components/retencao.tsx`, `FormularioDeLinha`) — reaproveita `Escolha`
(prop `sugerido`, CONTAI-062) e o mesmo bloco de leitura-em-render que já
preenche `rotuloLiteral`/`valorCentavos` sugeridos (`retencao.tsx:558-576`).
Sem rota nova, sem tela nova — a MESMA rota `/api/sugerir-retencao` que o
CONTAI-069 estende ganha um segundo campo na resposta.

## Gate Fiscal — decisão já registrada, não redecidida aqui

Esta automação **reabre uma porta que o compilador foi construído para manter
fechada**. `SugestaoDeLinha` (`lib/fiscal/retencao.ts:388-391`) hoje só aceita
`rotuloLiteral`/`valorCentavos` por construção — o comentário da linha
378-386 é explícito: *"os quatro campos de classificação fiscal
(`composicao`, `tributo`, `eDescontoEfetivo`, `quemRecolhe`) não cabem neste
tipo por construção — a trava do Gate Fiscal não é disciplina de quem chama, é
o compilador."* Isto é o **critério 14 do CONTAI-038**, testado em
`lib/fiscal/retencao.test.ts:151` (*"'tributo identificado' exige QUAL
tributo — nunca inferido do rótulo"*), e o parecer de hoje reprovou de novo,
"sem exceção", exatamente este pedido (Pergunta 1,
`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`).

**O Mateus sobrepôs a reprovação** — registrado no ADENDO da mesma entrada do
backlog (`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`):
depois de decidir o CNO (CONTAI-069), pediu a mesma abordagem para `tributo`.
Este mock desenha essa decisão. **A salvaguarda que sobra da reprovação não
desaparece — vira critério de implementação**, e é ela que faz este ticket
diferente de simplesmente "reverter o critério 14":

> Só sugerir uma categoria quando o rótulo nomeá-la de forma **INEQUÍVOCA E
> EXCLUSIVA** — contém palavra-chave de uma única categoria, sem mistura com
> outra. Rótulo composto/ambíguo (o próprio exemplo real do parecer,
> **"Total das Retenções (ISSQN / Federais)"**) não sugere nada — mesma
> doutrina "ambíguo vira silêncio, nunca melhor palpite" que já rege o resto
> do parser de retenção.

A lista de palavras-chave por categoria e a regra de desambiguação são
**decisão técnica do `cto-obra`**, fora do escopo deste mock — o que este
documento fixa é o contrato de UI: como a sugestão aparece, como nasce, como
morre, e o que continua 100% manual.

## Campos

- SEM CAMPOS — nenhum campo novo no banco. `composicao` e `tributo`
  continuam os mesmos enums (`ComposicaoRetencao`, `TributoRetido`) e o
  mesmo `CHECK documento_retencao_tributo_coerente`. A origem
  (`"manual"` | `"sugerida"`) é estado local do `FormularioDeLinha`,
  efêmero, nunca grava — `linhaRetencaoParaBanco`
  (`lib/fiscal/retencao.ts:486`) continua recebendo só `entrada`, sem
  qualquer rastro de origem. O que NÃO muda, sem exceção (critério 14 do
  CONTAI-038 continua de pé para os outros dois campos):
  `eDescontoEfetivo` e `quemRecolhe` seguem 100% manuais e obrigatórios
  antes de "Adicionar" — a sugestão deste ticket nunca os toca, nunca os
  pré-marca, nunca os torna opcionais.

## 1. Contrato de dados — extensão da MESMA resposta do CONTAI-069

```ts
// lib/extracao/retencao-texto.ts
export type SugestaoLinhaRetencao = {
  rotuloLiteral: string;
  valorCentavos: number;
  /** NOVO — CONTAI-070. `null` = rótulo ambíguo ou sem match; nunca "melhor
   *  palpite". Regra de match: decisão do `cto-obra`. */
  categoriaSugerida: TributoRetido | null;
};
```

```ts
// app/api/sugerir-retencao/route.ts
type Resposta = {
  sugestao: SugestaoLinhaRetencao | null; // agora inclui categoriaSugerida
  cno: CandidatoCnoLido[]; // CONTAI-069, inalterado por este ticket
};
```

Nova função pura, ao lado de `sugerirLinhaRetencao`
(`lib/extracao/retencao-texto.ts:290`) — provavelmente um novo módulo,
`lib/extracao/tributo-texto.ts`, para não misturar "achar o trio aritmético"
com "classificar o rótulo":

```ts
function categoriaPorRotulo(rotuloLiteral: string): TributoRetido | null {
  // cto-obra define as palavras-chave por categoria e a regra de
  // desambiguação. Contrato: uma palavra-chave de UMA categoria só → aquela
  // categoria; zero ou 2+ categorias competindo → null, sempre.
}
```

Contraexemplo real que qualquer implementação tem que acertar (já citado no
parecer, ADENDO 6/7 do parecer de 2026-09-18): rótulo **"Total das Retenções
(ISSQN / Federais)"** cita duas categorias (ISS + potencialmente
INSS/IRRF/PIS/COFINS/CSLL sob "Federais") → `categoriaPorRotulo` tem que
devolver `null`, não `"iss"`.

## 2. Estado local do `FormularioDeLinha` (`retencao.tsx:496-530`)

Novo estado, ao lado de `entrada`/`valorTexto`:

```ts
const [origemComposicaoTributo, setOrigemComposicaoTributo] =
  useState<"manual" | "sugerida" | null>(null);
```

Estende o bloco de leitura-em-render que já existe (linhas 558-576) — mesmo
padrão de "só preenche campo vazio" já usado para `rotuloLiteral`/
`valorCentavos`:

```ts
const [sugestaoVista, setSugestaoVista] = useState(sugestao);
if (sugestaoVista !== sugestao) {
  setSugestaoVista(sugestao);
  if (sugestao !== null) {
    const composicaoVazia = valorTexto === ""
      ? true
      : entradaAtualTemComposicaoVazia; // === entrada.composicao === null, lido ANTES do patch
    setEntrada((atual) => ({
      ...atual,
      rotuloLiteral: atual.rotuloLiteral || sugestao.rotuloLiteral,
      valorCentavos: /* como já é hoje */,
      composicao:
        atual.composicao === null && sugestao.categoriaSugerida
          ? "tributo_identificado"
          : atual.composicao,
      tributo:
        atual.composicao === null && sugestao.categoriaSugerida
          ? sugestao.categoriaSugerida
          : atual.tributo,
    }));
    if (entrada.composicao === null && sugestao.categoriaSugerida) {
      setOrigemComposicaoTributo("sugerida");
    }
  }
}
```

**Nunca sobrescreve o que ele já escolheu** — mesma regra do resto da linha:
se o Mateus já tinha marcado `composicao` manualmente antes da sugestão
chegar, `categoriaSugerida` fica ignorado (guardado em `sugestao`, mas sem
efeito no `entrada`), exatamente como um `valorCentavos` sugerido não
sobrescreve um valor já digitado.

**Ciclo de vida em troca de anexo**: `composicao`/`tributo` sugeridos seguem
o MESMO ciclo de vida que `rotuloLiteral`/`valorCentavos` sugeridos já têm
nesta linha (spec do CONTAI-054/055, inalterada por este ticket) — não há
tratamento adicional a inventar aqui. Na prática, a troca de anexo com o gate
de retenção em `"sugerida"` já desmonta `BlocoRetencaoDaCaptura` inteiro (o
gate volta a `null`, CONTAI-062 §1), o que apaga este formulário e todo o seu
estado local junto.

## 3. As pílulas — zero mudança em `campos.tsx`

`Escolha` de composição (`retencao.tsx:684-699`):

```tsx
<Escolha
  destaque
  rotulo={PERGUNTA_COMPOSICAO}
  opcoes={OPCOES_COMPOSICAO}
  valor={entrada.composicao}
  onChange={responderComposicao}
  sugerido={origemComposicaoTributo === "sugerida" ? "tributo_identificado" : null}
  erro={erroDe("composicao")}
/>
```

`Escolha` de tributo (`retencao.tsx:702-709`), só visível quando
`composicao === "tributo_identificado"` (inalterado):

```tsx
{entrada.composicao === "tributo_identificado" ? (
  <Escolha
    destaque
    rotulo={PERGUNTA_TRIBUTO}
    opcoes={OPCOES_TRIBUTO}
    valor={entrada.tributo}
    onChange={responderTributo}
    sugerido={origemComposicaoTributo === "sugerida" ? entrada.tributo : null}
    erro={erroDe("tributo")}
  />
) : null}
```

Ambas reaproveitam a MESMA classe de pílula âmbar + selo "Sugerida" do
CONTAI-062 — nenhuma cor nova, nenhum componente novo.

## 4. Nascem e morrem juntos — handlers dedicados

```ts
function responderComposicao(v: ComposicaoRetencao) {
  setOrigemComposicaoTributo("manual");
  mudar({ composicao: v, tributo: v === "tributo_identificado" ? entrada.tributo : null });
}

function responderTributo(v: TributoRetido) {
  setOrigemComposicaoTributo("manual");
  mudar({ tributo: v });
}
```

**Os dois campos têm UM estado de origem só**, não dois separados — é o que
faz a regra "nascem e morrem como par" ser estrutural, não uma convenção que
alguém pode esquecer de aplicar a um dos dois:

| Toque | Antes | Depois |
|---|---|---|
| Toca a pílula de composição já sugerida ("Tributo único identificado") | `composicao="tributo_identificado"`, `tributo="iss"`, origem `"sugerida"` | valor não muda; origem vira `"manual"` para **os dois campos** — a pílula de tributo perde o selo junto, mesmo sem ter sido tocada |
| Toca a pílula de tributo já sugerida ("ISS") | idem | mesmo efeito, na direção oposta: tocar QUALQUER um dos dois confirma o par inteiro |
| Muda composição para outra opção (ex.: "Total combinado, não aberto") | sugerida | `tributo` some (já era o comportamento existente, `v !== "tributo_identificado" ? null`) e origem vira `"manual"` — não sobra selo órfão em campo que nem aparece mais |
| Não toca em nada, aperta "Adicionar linha" com o par ainda sugerido | origem `"sugerida"` | Grava `composicao`/`tributo` normalmente — só o valor viaja, nunca a origem. Confirmação implícita, mesma doutrina do CONTAI-062 |

## 5. Estado sem sugestão — silêncio simples, sem aviso

Diferente do CNO (CONTAI-069), aqui **não existe** um bloco de "achou mas não
bate" para mostrar: ou o rótulo casa de forma inequívoca com uma categoria
(sugestão nasce), ou não casa (nada acontece). Não há dois números para
comparar lado a lado — é campo de categoria, não comparação de dígitos. Rótulo
ambíguo ou sem match:

- `categoriaSugerida: null` na resposta;
- `composicao`/`tributo` nascem em `null`, exatamente como
  `LINHA_RETENCAO_VAZIA` já define;
- **nenhum texto novo aparece** — nem aviso, nem "não encontrei categoria".
  Silêncio simples, igual ao comportamento de hoje para quem preenche à mão.

## 6. ASCII — o card `FormularioDeLinha`, com sugestão de composição+tributo

Estado com match inequívoco (ex.: nota traz "Valor ISS"):

```
┌ Nova linha de retenção ──────────────────────────┐
│ ╭ chip âmbar ╮                                   │
│ │ Lido automaticamente desta nota │              │
│ ╰──────────────────────────────────╯             │
│ "Valor ISS"                                      │
│ R$ 42,00                                         │
│ Confira na nota antes de adicionar: a leitura    │
│ acha esta linha pela aritmética...               │
│                                                   │
│ Rótulo (copie exatamente da nota)  [Valor ISS  ] │
│ Valor                              [42,00      ] │
│                                                   │
│ O que este valor representa?                     │
│ ╭─────────╮                                      │
│ │Sugerida │                                      │
│ ╭──────────────────────────────╮  ╭────────────╮ │
│ │ Tributo único identificado   │  │  Total ...  │ │
│ ╰──────────────────────────────╯  ╰────────────╯ │
│  ↑ corpo âmbar claro + selo                       │
│                                                   │
│ Qual tributo?                                    │
│ ╭─────────╮                                      │
│ │Sugerida │                                      │
│ ╭──────╮ ╭──────╮ ╭──────╮ ╭─────╮ ╭───────╮    │
│ │ ISS  │ │ INSS │ │ IRRF │ │ PIS │ │COFINS │... │
│ ╰──────╯ ╰──────╯ ╰──────╯ ╰─────╯ ╰───────╯    │
│  ↑ âmbar+selo, as outras 5 pílulas em border-line │
│                                                   │
│ Esse valor é de fato abatido do que você         │
│ transfere ao prestador?           ← MANUAL, vazio │
│ [ Sim ]  [ Não ]                                 │
│                                                   │
│ [Adicionar linha]  ← continua bloqueado até       │
│                       eDescontoEfetivo responder  │
└───────────────────────────────────────────────────┘
```

Estado sem match (ex.: "Total das Retenções (ISSQN / Federais)") — idêntico ao
formulário de hoje, sem nenhuma pílula marcada e sem aviso:

```
┌ Nova linha de retenção ──────────────────────────┐
│ ╭ chip âmbar ╮ (mesmo de sempre, só rótulo+valor) │
│ │ Lido automaticamente desta nota │              │
│ ╰──────────────────────────────────╯             │
│ "Total das Retenções (ISSQN / Federais)"         │
│ R$ 180,00                                        │
│                                                   │
│ Rótulo (copie exatamente da nota)  [Total das...] │
│ Valor                              [180,00     ] │
│                                                   │
│ O que este valor representa?                     │
│ ┌──────────────────────────────┐ ┌─────────────┐ │
│ │ Tributo único identificado   │ │  Total...   │ │
│ └──────────────────────────────┘ └─────────────┘ │
│  ↑ nenhuma marcada, border-line/white — igual hoje│
│                                                   │
│ (campo "Qual tributo?" nem aparece — composicao   │
│  ainda vazia)                                     │
└───────────────────────────────────────────────────┘
```

## Cenário e checagem final

**Cenário: captura** (`/adicionar/documento`). **375px não é bloqueio aqui**
pela mesma razão do CONTAI-069 e do CONTAI-062: este bloco é o
`FormularioDeLinha` que já existe, já visível dentro do repeater ≥880px
(`hidden larga:flex`, herdado do CONTAI-053) — este ticket não muda ESSA
regra de visibilidade, só o que acontece DENTRO do formulário quando ele está
visível. Em ≥880px é onde o Mateus, sentado ou de pé com o papel na mão,
preenche a linha inteira; abaixo de 880px o formulário de retenção continua
fora da tela de captura (comportamento inalterado desde o CONTAI-053), e este
ticket não reabre essa decisão.

O ponto do `cto-obra` que este mock deixa explícito: a sugestão de
`composicao`/`tributo` só existe **dentro do card que já pede confirmação
manual de `eDescontoEfetivo` e `quemRecolhe`** — ela nunca "vira fato" sozinha.
O Mateus sempre toca esse mesmo formulário (para responder os dois campos que
continuam 100% manuais) antes de "Adicionar linha" gravar a linha inteira em
memória; o "Salvar registro" da tela, por sua vez, é o único ato que grava
qualquer coisa no banco — nada deste ticket muda essa cadeia.
