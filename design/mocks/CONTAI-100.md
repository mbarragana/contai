# CONTAI-100 — pré-vínculo automático no lote de parcelas com origem

Dor de origem: `docs/backlog/113-2026-10-20-pre-vinculo-automatico-lote-parcelas-com-origem.md`.

Cenário: **gestão** (em casa, sentado) — mesmo cenário do resto de
`compra-cartao/parcelas/page.tsx` (CONTAI-084/089), que já documenta no topo
do arquivo que o "Teste do Canteiro" não se aplica aqui: densidade de até 24
linhas editáveis é aceitável, e o caminho de captura individual
(`/adicionar/compra-cartao`) continua intocado. O delta deste ticket não
muda esse veredito — é um bloco informativo a mais dentro de uma tela que já
é de gestão.

**Nível do mock: 2** — delta sobre uma tela que já tem spec (CONTAI-084.md,
com delta anterior em CONTAI-089.md). Só o que muda; o resto de cada spec
continua valendo, inclusive a estrutura de 3 fases (`formulario` → `revisao`
→ `sucesso`) e os campos existentes.

## 0. Confirmação de layout (item 5 do meu mandato)

**Não precisa de layout novo.** O bloco entra dentro do `COLUNA_DO_FORMULARIO`
que a Tela 1 já usa (`Corpo className={COLUNA_DO_FORMULARIO}`, linha 737) —
mesmo teto de ~430px que o CONTAI-099 confirmou para `/adicionar/documento`.
A permissão de 2026-09-22 (telas de `/adicionar/*` podem ganhar tratamento
desktop) existe mas **não precisa ser exercitada aqui**: é um `Card`/`Banner`
a mais empilhado verticalmente, do mesmo jeito que `LigadoANota` e o card
"Nota de origem" já se empilham em `compra-cartao/page.tsx` sem pedir grade
nem sidebar. A Tela 2 (`revisao`) não usa `COLUNA_DO_FORMULARIO` (é a tela
larga, com tabela) — o bloco entra lá como um `Card` extra no topo, acima da
tabela, e funciona nas duas larguras sem CSS condicional novo.

## 1. Achado arquitetural que precisa ir para o ticket (item 1 do meu mandato)

Lendo `app/(captura)/adicionar/compra-cartao/parcelas/page.tsx` e
`.../compra-cartao/page.tsx` de ponta a ponta: a tela tem **3 fases**, não 1 —
`formulario` (Tela 1, campos comuns), `revisao` (Tela 2, lista de N parcelas
editável) e `sucesso` (Tela 3, confirmação pós-gravação). O comentário no
topo do arquivo (linhas 10-28) e o de `compra-cartao/page.tsx` (linhas
288-296, 631-641) **proíbem explicitamente**, com justificativa extensa
(Pre-mortem 1 do CONTAI-089, incidente P0 do CONTAI-083), que a rota do lote
leia `?documento=` ou receba qualquer id de nota — "Esta rota nunca lê
`?documento=`" é texto literal do código hoje.

Este ticket **reabre essa proibição por fora**, e de propósito: o relato e o
Gate Fiscal já decidiram que pré-vínculo automático (nunca
`documento_origem_id`) é seguro aqui porque pré-vínculo não é custo (ADENDO 6
§J.1) e a proibição do ADENDO 9 é só sobre o segundo campo. Isso **não é uma
contradição a esconder** — é uma correção de arquitetura que precisa de uma
frase explícita no ticket final e de edição dos dois blocos de comentário
acima (eles vão ficar FALSOS depois deste ticket, e comentário falso no
código é o mesmo defeito que a doutrina fiscal persegue, com outro nome).
Sinalizo para o `cto-obra` confirmar no Gate 2: quem muda é
`hrefDoLote`/`compra-cartao/page.tsx` (passar `?documento=<id>` também,
condicionalmente, além dos 3 textos já herdados) e a leitura em
`compra-cartao/parcelas/page.tsx` (novo efeito, espelhando o de
`compra-cartao/page.tsx` linhas 173-226: carrega por `carregarDocumento`,
guarda `notaPronta`, aplica `podeVincular` para a obra). Não é trabalho de
design decidir o mecanismo — só de avisar que os comentários-guarda existem e
precisam ser reescritos, não só o código.

## 2. Os 4 estados — Tela 1 (`formulario`)

Local: logo depois de `<AfirmacaoObra ... />` e **antes** do `Banner`
existente (`LOTE_BANNER_AGENDAMENTO`) — mesma posição relativa que
`compra-cartao/page.tsx` usa para `obraDivergente`/`LigadoANota` em relação
ao próprio banner de agendamento. Só aparece quando a URL chegou com
`?documento=<id>`; sem ele, nada deste bloco existe e a tela é byte a byte a
de hoje (zero regressão, mesmo critério do CONTAI-089).

### Estado 1 — Carregando

```
┌ AfirmacaoObra ───────────────────────────────────────────┐
│ Registrando em                          Fazenda do Mateus │
└────────────────────────────────────────────────────────┘
  Carregando a nota de origem…
┌ Banner (âmbar) ──────────────────────────────────────────┐
│ [LOTE_BANNER_AGENDAMENTO — texto de hoje, inalterado]      │
└────────────────────────────────────────────────────────┘
```

Texto: **"Carregando a nota de origem…"** — parágrafo mudo (`text-mut`, sem
spinner, sem retry), mesmo peso e mesmo padrão do "Carregando a nota…" que
`compra-cartao/page.tsx` já usa para o link do lote (critério 9 do
CONTAI-089). Não bloqueia nenhum campo da Tela 1: o Mateus pode preencher
favorecido/valor/data enquanto a nota resolve.

### Estado 2 — Nota carregada (mesma obra)

```
┌ AfirmacaoObra ───────────────────────────────────────────┐
│ Registrando em                          Fazenda do Mateus │
└────────────────────────────────────────────────────────┘
┌ Card (border-dashed) ─────────────────────────────────────┐
│ [chip âmbar vazado] Pré-vínculo — ainda não é custo        │
│                                                             │
│ Pré-vínculo com Nota nº 1726 — Ilhamix Concreto Ltda —     │
│ R$ 12.340,00                                               │
│                                                             │
│ As parcelas que você gerar aqui vão nascer já ligadas a    │
│ esta nota. Fica visível e desfazível em cada agendamento,  │
│ em "Ligar notas a este agendamento", enquanto ele estiver  │
│ em aberto.                                                 │
└──────────────────────────────────────────────────────────┘
┌ Banner (âmbar) ──────────────────────────────────────────┐
│ [LOTE_BANNER_AGENDAMENTO — texto de hoje, inalterado]      │
└────────────────────────────────────────────────────────┘
```

Textos:
- **Chip**: `CHIP_PRE_VINCULO` verbatim (`"Pré-vínculo — ainda não é custo"`,
  `lib/fiscal/compromisso.ts`), `<Chip cor="amb" peso="vazado">` — a MESMA
  cor/peso das 3 superfícies existentes (nunca vermelho, nunca verde, ADENDO
  6 §J.2).
- **Linha de identificação** (Critério 6 do Gate Fiscal — número, favorecido
  e valor, visíveis ANTES de gerar/salvar qualquer coisa): `"Pré-vínculo com
  {Nota nº X, ou o rótulo do tipo se não houver número} — {favorecido, ou
  "documento sem emitente"} — {valor, ou "sem valor informado"}"`. Isto
  **reaproveita os mesmos fragmentos** de `identificarDocumentoPreLigado`
  (quem/quanto) **com o favorecido inserido no meio** — não é um reuso
  byte a byte da função existente, porque ela não imprime favorecido hoje.
  Sinalizo para o Gate 2: ou se estende `identificarDocumentoPreLigado` para
  aceitar um modo "com favorecido", ou se compõe localmente puxando os
  mesmos fragmentos — mas nunca reescrevendo o "quem"/"quanto" do zero numa
  segunda função, que é exatamente a divergência que já produziu D40/D55.
- **Parágrafo de mecanismo** (texto NOVO de produto, não de consequência
  fiscal — mesma classificação de `PRE_VINCULO_SO_EM_ABERTO`): *"As parcelas
  que você gerar aqui vão nascer já ligadas a esta nota. Fica visível e
  desfazível em cada agendamento, em 'Ligar notas a este agendamento',
  enquanto ele estiver em aberto."* — descreve o MECANISMO (o que vai
  acontecer), nunca afirma fato consumado (nenhuma parcela existe ainda
  nesta tela), e não reproduz a consequência fiscal completa do ADENDO 8
  §L.2 (regra do Gate Fiscal, critério 8) — essa fica só nas 3 superfícies
  já existentes, depois que a parcela existir.

### Estado 3 — Nota não carregou (erro/catch)

```
┌ AfirmacaoObra ───────────────────────────────────────────┐
│ Registrando em                          Fazenda do Mateus │
└────────────────────────────────────────────────────────┘
┌ Banner (âmbar) role="status" ────────────────────────────┐
│ A nota de origem não carregou. As parcelas vão nascer sem  │
│ pré-vínculo — você pode ligar cada uma a esta nota depois, │
│ pelo pré-vínculo do agendamento.          [Tentar de novo] │
└────────────────────────────────────────────────────────┘
┌ Banner (âmbar) ──────────────────────────────────────────┐
│ [LOTE_BANNER_AGENDAMENTO — texto de hoje, inalterado]      │
└────────────────────────────────────────────────────────┘
```

Texto: *"A nota de origem não carregou. As parcelas vão nascer sem
pré-vínculo — você pode ligar cada uma a esta nota depois, pelo pré-vínculo
do agendamento."* — aviso visível, nunca silêncio (requisito explícito do
`cto-obra`, Passo 3). `role="status"`, cor âmbar (não é erro bloqueante: o
lote segue funcionando). `[Tentar de novo]` é um botão `ghost` inline,
mesmo padrão de `recarregarNota`/`onTentarDeNovo` já usado em
`compra-cartao/page.tsx` — oferecido porque, diferente do CONTAI-089 (onde a
falha degradava em silêncio para "sem contexto"), aqui o requisito explícito
é NÃO silenciar, e dar uma saída de recuperação sem perder o que já foi
digitado nesta tela custa pouco.

### Estado 4 — Obra divergente (nota é de outra obra)

```
┌ AfirmacaoObra ───────────────────────────────────────────┐
│ Registrando em                          Fazenda do Mateus │
└────────────────────────────────────────────────────────┘
┌ Banner (vermelho) role="alert" ──────────────────────────┐
│ Estas parcelas não vão nascer com pré-vínculo. Este        │
│ pagamento e este documento estão em obras diferentes.      │
│ Nada é somado entre obras — cada matrícula é um item da    │
│ declaração. Troque a obra desta tela antes de gerar as     │
│ parcelas, ou prossiga — elas nascem sem pré-vínculo.        │
└────────────────────────────────────────────────────────┘
┌ Banner (âmbar) ──────────────────────────────────────────┐
│ [LOTE_BANNER_AGENDAMENTO — texto de hoje, inalterado]      │
└────────────────────────────────────────────────────────┘
```

Texto: a frase-motivo é `MOTIVO_OBRA_DIFERENTE` **verbatim**
(`lib/fiscal/vinculo.ts`: *"Este pagamento e este documento estão em obras
diferentes. Nada é somado entre obras — cada matrícula é um item da
declaração. Corrija a obra de um dos dois antes de ligar."*) — mas a frase de
abertura e a de fechamento são produto, adaptadas ao contexto do LOTE (não
existe "pagamento" nem "ligar" ainda aqui, existe "gerar parcelas"), no mesmo
espírito da frase que `compra-cartao/page.tsx` já monta ao redor da mesma
constante (linhas 574-580): *"Esta compra não vai nascer ligada à nota."* →
aqui, *"Estas parcelas não vão nascer com pré-vínculo."* `role="alert"`, cor
vermelha (mesmo peso que o caso análogo da compra individual) — mas **não
bloqueia** o botão "Gerar": o lote prossegue sem pré-vínculo, exatamente como
hoje.

## 3. Tela 2 (`revisao`) — mesmo bloco, novo Card

O Gate Fiscal exige que o aviso apareça "antes do salvamento" — isso inclui
a tela de revisão, que é onde o clique final ("Confirmar as N parcelas")
mora. Adiciono um `Card` com o MESMO conteúdo do Estado 2/3/4 acima (sem o
Estado 1 "Carregando": ao chegar na revisão a nota já resolveu, porque
"Gerar" já esperou `notaPronta` do mesmo jeito que o link do CONTAI-089
espera), posicionado **entre** o Card de resumo fixo (Favorecido/
Documento/Data da compra) e o cabeçalho sticky da tabela:

```
┌ Card — resumo fixo (como hoje) ──────────────────────────┐
│ Favorecido                                  Ilhamix ...   │
│ Documento                               12.345.678/0001-9  │
│ Data da compra                                01/09/2026   │
│ [Editar dados comuns]                                      │
└────────────────────────────────────────────────────────┘
┌ Card (border-dashed) — pré-vínculo (novo) ────────────────┐
│ [chip] Pré-vínculo — ainda não é custo                      │
│ Pré-vínculo com Nota nº 1726 — Ilhamix Concreto Ltda —      │
│ R$ 12.340,00                                                │
│ As N parcelas abaixo vão nascer já ligadas a esta nota.     │
└──────────────────────────────────────────────────────────┘
[cabeçalho sticky da tabela / linhas de parcela — como hoje]
```

Parágrafo da revisão difere em uma palavra do da Tela 1 (já sabe N):
*"As N parcelas abaixo vão nascer já ligadas a esta nota."* — mesma
disciplina de nunca afirmar fato consumado antes do "Confirmar".

## 4. Achado adicional — Tela 3 (`sucesso`) teria texto FALSO sem ajuste

Não estava nos 4 estados que o `cto-obra` listou, mas apareceu ao ler o
código: a `Dica` fixa da tela de sucesso (linhas 561-564) diz hoje, sempre,
**"Nenhuma delas está ligada a nota."** Isso fica **falso** assim que este
ticket existir e o lote tiver nascido com pré-vínculo — e "campo preenchido
afirma" vira "texto fixo afirma" com o mesmo problema. Preciso bifurcar esse
texto por saber, no momento do sucesso, se o pré-vínculo foi aplicado
(mesma condição que decide os Estados 2/3/4 acima, congelada no momento do
"Confirmar"):

```
┌ Dica (quando NASCEU pré-vinculado — caso novo) ───────────┐
│ Todas nascem pré-ligadas a Nota nº 1726 — Ilhamix          │
│ Concreto Ltda — R$ 12.340,00 (chip "Pré-vínculo — ainda    │
│ não é custo" em cada agendamento). O vínculo completo —    │
│ e a opção de desfazer — fica em cada parcela, ao abrir o   │
│ agendamento.                                                │
└───────────────────────────────────────────────────────────┘

┌ Dica (SEM pré-vínculo — texto de hoje, inalterado) ───────┐
│ Nenhuma delas está ligada a nota. O vínculo é feito         │
│ depois, parcela por parcela, no pré-vínculo de cada          │
│ agendamento.                                                 │
└────────────────────────────────────────────────────────┘
```

Note que o texto do caso novo **não reproduz** a frase completa do ADENDO 8
§L.2 (isso é disciplina do critério 8 do Gate Fiscal — essa frase mora só
nas 3 superfícies do CONTAI-091); ele só nomeia o chip e aponta para onde o
texto completo está. Não é texto de consequência fiscal nova — é texto de
produto, descrevendo o que aconteceu, da mesma classe de
`PRE_VINCULO_SO_EM_ABERTO`. Marco isto como achado desta sessão de design,
fora do pedido original do `cto-obra`, para o `po` decidir se entra como
critério de aceite deste mesmo ticket ou sai como ticket-filho — mas não
recomendo deixar passar: é a mesma tela, mesmo delta de dados, e a Dica
velha mentiria sobre o estado exato que este ticket criou.

## 5. Resposta à pergunta 3 do relato (item 3 do meu mandato)

**Sim, precisa de texto novo — mas só na Tela 1 e na Tela 2 do lote, antes
do "Confirmar".** O chip + texto expandido que já existe (ADENDO 8 §L.2, nas
3 superfícies do CONTAI-091 — detalhe do compromisso, detalhe da nota,
seletor pré-marcado) só aparece DEPOIS que a parcela já existe como
`compromisso` gravado — ele não cobre o momento em que o Mateus ainda está
decidindo gerar o lote. O bloco novo descrito nas seções 2 e 3 é esse texto
que faltava: curto, prospectivo ("vai nascer ligada", nunca "está ligada"),
sem duplicar a consequência fiscal completa. As 3 superfícies pós-salvamento
continuam usando exatamente o texto que já existe, sem mudança nenhuma —
confirmado lendo `lib/fiscal/compromisso.ts` (`textoPreVinculoDoCompromisso`,
`CHIP_PRE_VINCULO`) e os 3 call sites em `compromisso/[id]/page.tsx`,
`documento/[id]/page.tsx` e `pagamento/[id]/ligar/page.tsx`.

## 6. Campos — nenhum novo, nenhum toggle (item 6 do meu mandato)

Nenhum campo editável, nenhum checkbox, nenhuma pergunta "pré-vincular
automaticamente? sim/não". O pré-vínculo é automático e silencioso na
intenção (visível no aviso, mas sem pedir decisão) — exatamente como o
Mateus descreveu no relato ("não faz sentido eu ter que fazer de novo"). Se
ele quiser desfazer, o caminho é o que já existe: abrir o agendamento depois
de salvo e usar "Ligar notas a este agendamento" (`/compromisso/[id]/
pre-vincular`, CONTAI-080/081) — nenhum atalho de "desligar" nasce nesta
tela. A doutrina "campo vazio pergunta, campo preenchido afirma" não se
aplica aqui porque não há campo: é informativo e automático, não
digitado nem editável pelo Mateus nesta tela.

## 7. Navegação (delta sobre o que o CONTAI-089 já documentou)

- `compra-cartao/page.tsx` → `hrefDoLote` passa a incluir também
  `?documento=<id>` (condicional: só quando `documentoDeOrigem` existe e
  `!obraDivergente` — mesma condição de `origemParaGravar`), **além** dos 3
  parâmetros de texto que o CONTAI-089 já manda. Isto reabre, por decisão
  deste ticket, a proibição textual das linhas 631-641 desse arquivo —
  comentário a reescrever no Gate 2, não a ignorar.
- `compra-cartao/parcelas/page.tsx` passa a ler `?documento=` (novo efeito,
  mesmo padrão de `compra-cartao/page.tsx`: carrega via `carregarDocumento`,
  marca `notaPronta`, aplica `podeVincular` contra a obra atual) — reabre a
  proibição das linhas 10-28 do mesmo arquivo, pelo mesmo motivo.
- Critério 7 do Gate Fiscal (id sempre vigente, nunca congelado): a leitura
  via `useSearchParams` já é reativa por natureza (é o mesmo hook que o
  CONTAI-089 usa) — não introduz estado extra que possa ficar velho, desde
  que a implementação NÃO copie o id para um `useState` inicializado uma vez
  só (como `texto-herdado.ts` faz deliberadamente com o texto). Aqui a
  leitura deve ficar mais perto do padrão de `documentoDeOrigemId` em
  `compra-cartao/page.tsx`, que também é `useState` mas re-sincroniza por
  `useEffect` com dependência no valor lido — não é meu mandato decidir a
  forma exata, só apontar que "congelar na montagem" (o padrão de
  `herdado`/`SEM_HERANCA` desta mesma tela) violaria o critério 7 se
  reaproveitado sem ajuste.
- Mesma regra de `herdarDaUrl`/`rodada` já existente: só a 1ª rodada lê
  `?documento=`; "Lançar outro lote" nasce sem pré-vínculo, como nasce sem
  texto herdado hoje.

## 8. Textos com consequência fiscal — resumo para o ticket

| Texto | Fonte | Mudou? |
|---|---|---|
| `CHIP_PRE_VINCULO` | `lib/fiscal/compromisso.ts`, verbatim | Não — reuso |
| `MOTIVO_OBRA_DIFERENTE` | `lib/fiscal/vinculo.ts`, verbatim | Não — reuso |
| Variante N=1 do ADENDO 8 §L.2 | `textoPreVinculoDoCompromisso` | Não — só nas 3 superfícies já existentes, fora desta tela |
| Linha "Pré-vínculo com {nota}" | Novo, produto (identificação, não consequência) | Novo — conferir composição no Gate 2, não é texto fiscal a validar com o `contador` |
| Parágrafo de mecanismo (Tela 1/2) | Novo, produto | Novo — mesma classe de `PRE_VINCULO_SO_EM_ABERTO` |
| Aviso "nota não carregou" | Novo, produto | Novo — requisito literal do `cto-obra` (Passo 3), redigido em tom do app |
| Dica da Tela 3 bifurcada | Novo, produto | Novo — achado desta sessão (seção 4), fora do escopo original do `cto-obra` |

Nenhuma linha nova de consequência fiscal (custo/INSS/relatório) é
inventada: tudo que toca os três entra só pelas constantes já existentes,
reaproveitadas verbatim.
