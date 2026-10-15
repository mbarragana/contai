# CONTAI-098 — reaproveitar comprovante entre irmãos da mesma fatura (D56-b, ponta B)

Cenário: **gestão** (em casa, sentado — anexar comprovante tardio a um
pagamento já gravado, mesmo cenário da tela-mãe CONTAI-061. Teste do Canteiro
não se aplica: nada aqui acontece no instante do pagamento no canteiro —
é conciliação posterior, de um pagamento que já está em aberto na lista de
pendências).

Nível **2** (spec + ASCII), e a decisão foi pesada contra o nível 1 — ver
"Por que nível 2, e não nível 1" abaixo.

Fonte fiscal: nenhuma pergunta fiscal nova nos dois caminhos (upload ou
reaproveitar) — mesma restrição que já vale para `/pagamento/[id]/comprovante`
(CONTAI-061, Gate Fiscal já fechado). O `contador` recusou explicitamente
qualquer rótulo que chame um chip de "o comprovante oficial" (ver `## Textos`).
Delta sobre `design/mocks/CONTAI-061.md`, que continua valendo por completo —
este arquivo só descreve o que muda.

## Por que nível 2, e não nível 1

O ticket toca a estrutura da tela (uma decisão nova, "upload vs. reaproveitar",
lado a lado), o que é exatamente o critério que levaria a nível 1. A escolha
por nível 2 é porque:

- O **mecanismo visual** não é novo: `ChipDePapel`/`ChipsDeAnexoExistente`
  (`app/_components/corrigir.tsx:415-507`) já está em produção, com os mesmos
  estados (marcado/não-marcado, `aria-pressed`, cor), e o próprio
  `comArquivoNovo` (chip "Vou anexar um arquivo novo.") já resolve a pergunta
  "upload vs. reaproveitar lado a lado" — é o padrão do próprio ponto de
  entrada do CONTAI-088. Não há decisão de hierarquia/densidade para resolver
  com pixels: o único elemento genuinamente novo é o **texto dentro do chip**
  (favorecido + valor, em vez de data + origem), que é conteúdo, e conteúdo se
  fecha por escrito, não em HTML.
- **Nenhum estado de página novo**: carregando/erro continuam a mesma união já
  existente (`carregado`/`erroCarregar`); o que muda é um `Card` condicional
  dentro do estado "pronto", não uma tela nova.
- Precedente do próprio projeto: CONTAI-088 Fatia A classificou como nível 2
  "portar um padrão já aprovado e já no ar" para uma tela-irmã — este ticket é
  o mesmo movimento, com uma fonte de dados nova (`carregarIrmaosDeComprovante`
  em vez de `carregarAnexosDoDocumento`) no lugar do mesmo componente.

## Dados — contrato que a tela consome

Função nova em `lib/data.ts`, no padrão de `carregarAnexosDoDocumento`:

```ts
interface OrigemDoComprovanteIrmao {
  pagamentoId: string;
  favorecidoNome: string | null;
  valorCentavos: number;
}

interface ComprovanteIrmao {
  /** Um grupo por `comprovante_path` DISTINTO entre os irmãos. */
  comprovantePath: string;
  /** Todo pagamento irmão que usa este MESMO arquivo — pode ser >1. */
  origens: OrigemDoComprovanteIrmao[];
}

async function carregarIrmaosDeComprovante(
  pagamentoId: string,
): Promise<ComprovanteIrmao[] | null>
```

- `null` → pagamento avulso (sem fatura nenhuma) — não há irmão a buscar.
- `[]` → há fatura, mas nenhum irmão tem `comprovante_path` preenchido ainda.
- `ComprovanteIrmao[]` com ≥1 item → há pelo menos um arquivo distinto
  reaproveitável.

Para a TELA, `null` e `[]` renderizam **exatamente igual** (nenhum componente
novo aparece) — a distinção entre os dois só importa na camada de dados, não
na UI. A junção exata (`pagamento → compromisso_pagamento → compromisso →
fatura_compromisso → fatura → de volta por todos os compromissos/pagamentos
da fatura`) é decisão de implementação do `cto-obra`/`lead-engineer`; este
spec fixa só o contrato de retorno que a tela consome.

⚠️ **A granularidade é por FATURA, nunca por desembolso individual** — fato
confirmado do modelo de dados, citado no ticket. É por isso que o chip "Vou
anexar um arquivo novo." nunca pode faltar: o único arquivo visível entre os
irmãos pode não ser prova do pagamento em aberto, se vier de um desembolso
diferente da mesma fatura.

## Fluxo

1. Carregamento: `carregarPagamento(id)` → (se `pagamento.comprovantePath ===
   null`, ou seja, depois do guard de reentrada já decidido) `carregarPainel`
   e `carregarIrmaosDeComprovante(pagamento.id)` em paralelo (mesmo
   `Promise.all` do padrão já usado em outras telas). Guard de reentrada
   (comprovante já existe) continua **idêntico** ao de hoje e roda **antes**:
   quando ele dispara, a chamada de irmãos nem precisa ser feita (otimização
   opcional — não é bloqueante para o Gate 1).
2. **Pagamento avulso ou sem irmão com comprovante** (`null` ou `[]`): a tela
   é **byte-a-byte** a de hoje (CONTAI-061) — só `CampoArquivo`, zero
   componente novo, zero regressão.
3. **≥1 arquivo distinto entre os irmãos**: no lugar do `CampoArquivo` solto
   de hoje, aparece primeiro o `Card` novo `ChipsDeComprovanteIrmao` — um chip
   por arquivo distinto + o chip "Vou anexar um arquivo novo." **sempre
   presente**, mesmo quando há só 1 arquivo distinto. `escolhido:
   PapelDoPacote | null` nasce **`null` em qualquer caso** — nenhum chip vem
   pré-marcado, nem quando há um único candidato.
4. Escolher um chip de reaproveitamento → `escolhido = { tipo: "existente",
   path }`; o `CampoArquivo` permanece **fora da tela** (não some um campo
   que já estava visível — ele nunca aparece neste ramo, até o Mateus trocar
   para "arquivo novo").
5. Escolher "Vou anexar um arquivo novo." → `escolhido = { tipo: "novo" }` e
   **só então** aparece, abaixo do `Card` de chips, o `CampoArquivo`
   "Comprovante do pagamento" de sempre (mesmo rótulo/ajuda/`accept` do
   CONTAI-061). Trocar de volta para um chip de reaproveitamento esconde o
   `CampoArquivo` de novo e descarta o `File` em memória, se havia um
   selecionado — upload e chip são a mesma pergunta, como já vale no padrão
   de `corrigir.tsx` (`PapelDoPacote`).
6. **Delta "antes → depois"**, calculado antes de confirmar, nos dois
   caminhos, pelo **mesmo mecanismo** (`anosAfetadosDeUmaObra` sobre uma
   cópia do painel):
   - `escolhido.tipo === "novo"`: simula com o sentinel já existente
     `CAMINHO_SIMULADO` (nenhum upload ainda) — igual a hoje.
   - `escolhido.tipo === "existente"`: simula com o **`comprovantePath` real
     da origem escolhida** (já existe no acervo, não precisa de sentinel) —
     única diferença mecânica dos dois ramos; a chamada a
     `anosAfetadosDeUmaObra`/`alocarCusto` é idêntica.
7. **Confirmar**:
   - `"novo"`: fluxo de hoje — `subirParaAcervo` → `anexarComprovantePagamento`
     (RPC existente).
   - `"existente"`: `reaproveitarComprovanteDeIrmao(pagamento.id,
     origemPagamentoId, anos)` → RPC nova `reaproveitar_comprovante_de_irmao`
     (assinatura do `cto-obra`: `p_pagamento_id, p_origem_pagamento_id,
     p_anos`). Grava o **mesmo** `comprovante_path` da origem, registra
     `revisao` com `motivo = 'comprovante_reaproveitado_de_irmao'`, **sem**
     criar objeto novo no Storage — nenhum `subirParaAcervo` neste ramo.
8. Falha em qualquer ramo: mesmo `ErroDeGravacao` de hoje, nada gravado,
   `escolhido` preservado (não força escolher de novo).

## ASCII

### Estado atual, sem irmão com comprovante (zero regressão)

```
┌ CampoArquivo — "Comprovante do pagamento" ──────────────────┐
│ [ Escolher arquivo… ]                                        │
│  PDF, foto ou print — é ele que comprova este pagamento.     │
└─────────────────────────────────────────────────────────────┘
```

### Estado novo — 1 arquivo distinto entre os irmãos

```
┌ Card — "Ou reaproveite um comprovante já enviado nesta fatura" ┐
│                                                                 │
│ [ ] Usar o comprovante de PerfuraTec — R$ 1.797,03             │
│     (já enviado para outro pagamento desta fatura)             │
│                                                                 │
│ [ ] Vou anexar um arquivo novo.                                │
│                                                                 │
│ O mesmo comprovante pode provar o pagamento de mais de um      │
│ favorecido dentro da mesma fatura — cada reaproveitamento fica │
│ registrado como uma revisão própria, com data e motivo.        │
└─────────────────────────────────────────────────────────────┘
      nenhum chip marcado — botão de confirmar desabilitado

   ↓ se "Vou anexar um arquivo novo." for clicado, abaixo do Card:

┌ CampoArquivo — "Comprovante do pagamento" (igual ao CONTAI-061) ┐
│ [ Escolher arquivo… ]                                            │
└───────────────────────────────────────────────────────────────┘
```

### Estado novo — N arquivos distintos (ex.: 3 lojas da mesma rede)

```
┌ Card — "Ou reaproveite um comprovante já enviado nesta fatura" ┐
│ [ ] Usar o comprovante de Loja Rede X — R$ 420,00               │
│     (já enviado para outro pagamento desta fatura)              │
│ [ ] Usar o comprovante de Loja Rede X — R$ 980,00               │
│     (já enviado para outro pagamento desta fatura)              │
│ [ ] Usar o comprovante de Loja Rede X — R$ 300,00               │
│     (já enviado para outro pagamento desta fatura)              │
│ [ ] Vou anexar um arquivo novo.                                 │
└─────────────────────────────────────────────────────────────┘
```
Favorecido + valor é o mínimo exigido pelo ticket; quando o nome por si só não
desambigua (mesma rede, nomes iguais), o valor é o que diferencia os chips —
caso de dois irmãos com nome E valor idênticos fica fora de escopo desta
rodada (não citado no ticket).

## Textos de produto (não fiscais)

- Título do Card novo: **"Ou reaproveite um comprovante já enviado nesta
  fatura"**.
- Rótulo de cada chip de reaproveitamento (função `rotuloDoChipIrmao`, uma
  origem): **"Usar o comprovante de {favorecidoNome ?? "favorecido não
  informado"} — {valor formatado} (já enviado para outro pagamento desta
  fatura)"**. Com >1 origem para o mesmo arquivo, junta as origens com
  `" · "` e pluraliza o parêntese: **"(já enviado para outros pagamentos
  desta fatura)"**.
- Chip de arquivo novo: reaproveita **verbatim** `CHIP_ARQUIVO_NOVO` —
  **"Vou anexar um arquivo novo."** (`app/_components/corrigir.tsx`).
- Dica do Card: **"O mesmo comprovante pode provar o pagamento de mais de um
  favorecido dentro da mesma fatura — cada reaproveitamento fica registrado
  como uma revisão própria, com data e motivo."**
- ⚠️ **Nunca**: "comprovante oficial", "o comprovante certo desta fatura" ou
  qualquer rótulo que sugira que um chip é a prova correta e os outros não —
  recusado explicitamente pelo `contador`. O rótulo é sempre um fato neutro
  (quem usou este arquivo e quanto pagou), nunca uma afirmação de correção.
- Demais textos (guard de reentrada, banner de erro, avisos de ano anterior)
  reaproveitam **verbatim** o que já está em `/pagamento/[id]/comprovante`
  (CONTAI-061) — nenhuma redação nova nesses pontos.
- Botão de confirmar, dinâmico (substitui o texto único de hoje):
  - `escolhido === null`: **"Escolha um comprovante para continuar"**.
  - `escolhido.tipo === "novo"` e `arquivo === null`: **"Escolha o
    comprovante para continuar"** (igual a hoje).
  - `escolhido.tipo === "novo"` e `arquivo !== null`: igual a hoje —
    "Anexar comprovante — o custo confirmado de {ano} passa a {valor}" (ou a
    variante "mesmo assim" com pendência).
  - `escolhido.tipo === "existente"`: mesma fórmula, verbo trocado —
    **"Usar este comprovante — o custo confirmado de {ano} passa a
    {valor}"** (ou "Usar mesmo assim — o custo de {ano} passa a {valor}" com
    pendência) — o texto nunca diz "anexar" quando nenhum arquivo novo está
    subindo.
- Banner de sucesso, dinâmico: **"Comprovante anexado ✓"** (ramo novo, igual
  a hoje) ou **"Comprovante reaproveitado ✓"** (ramo existente) — mesma
  estrutura de `ListaDeAnexos` abaixo, mesma tabela de anos, em ambos.

## Campos

- `escolhido` — escolha por clique: um chip de comprovante irmão específico
  (path) ou o chip "Vou anexar um arquivo novo" — nasce **sempre `null`**,
  em qualquer caso (0, 1 ou N arquivos distintos entre os irmãos) — SEM
  DEFAULT. Só existe no ramo com ≥1 arquivo distinto entre os irmãos; no
  ramo sem irmãos este controle não é renderizado.

- NÃO É CONTROLE — o `CampoArquivo` de upload (`arquivo`) já está declarado
  em `design/mocks/CONTAI-061.md` como `comprovante` e continua inalterado:
  mesmo rótulo, `accept` e condição de nascimento; este ticket só muda
  QUANDO ele aparece (condicional a `escolhido?.tipo === "novo"` no ramo com
  irmãos; sempre visível no ramo sem irmãos, como hoje), nunca o próprio
  campo.

## Nota: nenhum campo fiscal novo

SEM CAMPOS FISCAIS NOVOS — nenhuma pergunta de CPF ou retenção em nenhum dos
dois caminhos (upload ou reaproveitar), mesma restrição do CONTAI-061. O
controle novo (`escolhido`) decide **qual arquivo já existente** usar, não
afirma fato fiscal algum — e a disciplina "campo vazio pergunta, preenchido
afirma" é preservada pelo `null` inicial obrigatório (item 3 do Fluxo) e pelo
botão de confirmar desabilitado até o clique explícito.

## Os 4 estados

- **Carregando**: `Carregando rotulo="Carregando o pagamento"`, inalterado
  (a chamada extra de `carregarIrmaosDeComprovante` entra no mesmo
  `Promise.all`, sem rótulo próprio).
- **Vazio**: dois sentidos coexistem e não se confundem —
  (a) **vazio de irmãos** (`null`/`[]`): Card de chips não renderiza, tela
  idêntica à de hoje;
  (b) **vazio de escolha** (há irmãos, mas `escolhido === null`): Card de
  chips renderiza, nenhum marcado, botão de confirmar desabilitado — estado
  de repouso esperado, não erro.
- **Erro**: ao **carregar** → `EstadoErro` + tentar de novo (mesmo padrão;
  cobre falha em `carregarPagamento`, `carregarPainel` **ou**
  `carregarIrmaosDeComprovante`, indistintamente); ao **confirmar** →
  `ErroDeGravacao`, mesma estrutura/textos de hoje, `escolhido` e `arquivo`
  preservados para nova tentativa.
- **Sucesso**: banner dinâmico ("anexado" vs. "reaproveitado", ver
  `## Textos`), `ListaDeAnexos` com o comprovante (novo ou reaproveitado),
  mesma tabela de "Custo confirmado {ano}: antes → depois", mesmo tratamento
  de pendência de ano anterior (`abrePendencia`, sem `router.push`
  automático) — tudo igual entre os dois ramos a partir daqui.

## Navegação

Nenhuma rota nova. Toda a mudança vive dentro de
`/pagamento/[id]/comprovante`.

## Decisões de design e perguntas abertas

- Decisão: "Vou anexar um arquivo novo." é sempre um **chip**, nunca um
  `CampoArquivo` permanentemente visível ao lado dos chips de
  reaproveitamento — espelha o próprio ponto de entrada do CONTAI-088
  (`comArquivoNovo = true`), e evita duas perguntas simultâneas sobre o
  mesmo arquivo na tela.
- Decisão: trocar de chip (reaproveitar → novo, ou novo → outro
  reaproveitar) descarta silenciosamente o `File` em memória, se havia —
  nada foi gravado ainda nesse ponto, então não é "abandonar formulário",
  é só a mesma pergunta respondida de novo.
- Pergunta ao `cto-obra`/`lead-engineer` (não é lacuna de requisito de
  produto, é de implementação): forma exata da consulta/join de
  `carregarIrmaosDeComprovante` (view, RPC de leitura, ou `.select()` com
  embeds encadeados) — este spec fixa só o contrato de retorno
  (`ComprovanteIrmao[] | null`) que a tela consome.
- Fora de escopo, com porquê: desambiguar dois irmãos com favorecido E valor
  idênticos — não citado no ticket, e o caso (duas compras exatamente iguais
  na mesma fatura, mesmo favorecido) não apareceu no relato de origem.
