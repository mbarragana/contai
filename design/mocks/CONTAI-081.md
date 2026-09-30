# CONTAI-081 — pré-vínculo compromisso↔nota antes do pagamento (fluxo de cartão)

**Cenário: gestão** (em casa, sentado — mesma família de `/fatura/[id]`,
`/fatura/[id]/confirmar`, `/fatura/[id]/alocar`, `/compromisso/[id]/pre-vincular`
do CONTAI-080). O "Teste do Canteiro" não se aplica. 375px não é piso
obrigatório, mas nada aqui quebra nele — é recombinação de shells já em
produção.

## Nível do mock: **1** (rota nova `/fatura/[id]/vinculos` + componente
`BlocoRevalidacao`), com os blocos 2 e 3 em **Nível 2** (spec pontual sobre
telas existentes) dentro deste mesmo arquivo.

**Gate Fiscal consumido** (não redecidido aqui, só desenhado em cima): ADENDO 6
§J.0-J.5, ADENDO 7 §K.1-K.5, ADENDO 8 §L.1-L.4 de
`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` — os mesmos do
CONTAI-080, agora aplicados ao caso em que **vários** compromissos resolvem
N≥2 ao mesmo tempo (uma fatura inteira sendo confirmada ou alocada). Todo
texto entre `>` abaixo é cópia literal do parecer ou de constante já em
produção (`lib/fiscal/compromisso.ts`) — nenhuma palavra fiscal foi redigida
por mim.

**Condições obrigatórias do `contador` para a tela agregada** (dadas como
requisito, não sugestão — repetidas aqui para rastreio, cumpridas nos §1 e §1.6
abaixo):

1. Nasce neutro — nenhum bloco marcado/destacado como "Sim" por padrão.
2. Cada clique grava só aquele bloco, sem depender de enviar tudo junto.
3. "Revisar" de um bloco não trava nem confirma os outros.
4. Confirmados persistem; só os pendentes reaparecem ao voltar.

**Arquitetura consumida** (`cto-obra`, não redecidida): `podePreVincular` deixa
de recusar origem cartão; CTA "Ligar notas a este agendamento" e o chip/texto
do compromisso passam a existir para cartão igual a PIX/boleto (reaproveitam
as telas do CONTAI-080, sem mudança visual — ver §4). Rota nova
`/fatura/[id]/vinculos`, derivada do estado gravado, sem query param para a
lista em si (um query param cosmético é usado só para a frase de transição do
§3, nunca para decidir o que a lista mostra). `/fatura/[id]/confirmar` e
`/fatura/[id]/alocar` redirecionam para cá quando sobra pendência N≥2 depois
de gravar.

---

## 1. Tela nova — `/fatura/[id]/vinculos`

### 1.1 O que a tela lista

Todo compromisso desta fatura (`fatura.compromissoIds`) que:

- já foi quitado (`situacao !== "aberto"` — a fatura acabou de ser confirmada
  ou alocada, ou foi quitado em outra sessão e ficou pendente); **e**
- a união (pré-vínculos ∪ `documentoOrigemId`, deduplicada) resolve para
  **N ≥ 2** no momento atual; **e**
- ainda não tem, para o `pagamento` gerado por esse compromisso, os N vínculos
  formais em `pagamento_documento` (ou seja, a revalidação do §J.3 ainda não
  aconteceu).

Cada compromisso que bate as três condições vira **um `BlocoRevalidacao`**,
independente dos demais — mesmo grão de independência que o CONTAI-080 já
fixou para a tela `/compromisso/[id]/confirmar`, aqui replicado N vezes numa
lista em vez de 1 vez numa tela cheia.

Compromissos com N=0 ou N=1 **não aparecem aqui** — N=1 já converteu sozinho
(ADENDO 7 §K.2, automático, sem UI) e N=0 nunca teve pré-vínculo. Compromissos
`aberto` (ainda não pagos) também não aparecem — pendência de pré-vínculo
antes do pagamento é o CTA do CONTAI-080 em `/compromisso/[id]`, não esta
tela.

### 1.2 Ordem dos blocos — cronológica, pela data da compra

`compromissos.sort((a, b) => a.dataCompra localeCompare b.dataCompra)`,
ascendente (a compra mais antiga primeiro). Razão: é a mesma ordem em que a
fatura já lista suas compras hoje (`Card` "Compras vinculadas" em
`/fatura/[id]`), e o Mateus acabou de olhar essa lista antes de clicar no CTA
— manter a ordem evita reler a fatura mentalmente para achar "qual é qual".
Nada de ordenar por valor: valor não é o eixo em que ele pensa a fatura.

### 1.3 `BlocoRevalidacao` — layout do card

Um `Card` por compromisso pendente, borda tracejada âmbar (mesma linguagem de
"decisão em aberto" que `/fatura/[id]/alocar` já usa no card "Seguem
agendamento aberto" — `className="border-dashed border-amb"`).

```
┌─ Card (border-dashed border-amb) ──────────────────────────┐
│ Superbeton — concreto usinado                              │
│ compra 03/03/2026 · R$ 4.850,00                             │
│                                                              │
│ Confirmar este pagamento também confirma o vínculo com     │
│ Nota nº 1042 — R$ 3.200,00, Nota nº 1051 — R$ 1.650,00,     │
│ como você já tinha indicado?                                │
│                                                              │
│ [ Sim, confirmar os vínculos ]                              │
│ [ Revisar antes de confirmar ]                               │
└──────────────────────────────────────────────────────────────┘
```

- **Cabeçalho** (2 linhas, mesmo padrão tipográfico dos itens de
  "Compras vinculadas" em `/fatura/[id]`):
  - linha 1, `font-semibold`: `c.favorecidoNome ?? "favorecido não informado"`
  - linha 2, `text-mut`: `compra {formatarDataBR(c.dataCompra)} · {formatarBRL(c.valorPrevistoCentavos)}`
- **Texto da pergunta**: `perguntaConfirmarPreVinculos(resolvidos)` — a mesma
  função já em produção (`lib/fiscal/compromisso.ts:1420`), sem reescrever
  nada; `resolvidos` é a união deduplicada dos documentos deste compromisso.
- **Botões**, mesmos rótulos/hierarquia do CONTAI-080 (`lib/fiscal/
  compromisso.ts:1431-1432`, `PRE_VINCULO_CONFIRMAR`/`PRE_VINCULO_REVISAR`):
  - **"Sim, confirmar os vínculos"** (`variante="primary"`) — grava só este
    bloco.
  - **"Revisar antes de confirmar"** (`variante="ghost"`) — `router.push`
    para `/pagamento/[id]/ligar` **daquele** `pagamento` específico deste
    compromisso, sem query param (mesma tela do §5 do CONTAI-080, que já
    deriva sozinha o que pré-marcar).

**Nasce sempre neutro** (condição 1 do Gate Fiscal): nenhum dos dois botões
tem `variante="primary"` destacando-o como "resposta esperada" além do peso
visual padrão já usado em toda tela de confirmação com 2 saídas do produto
(mesmo par de pesos de `CartaoSugestao` em `quitacao.tsx`) — "primary" aqui é
convenção de hierarquia de ação (o clique mais provável fica em cima), não
uma pré-marcação de resposta. Nenhum checkbox, nenhum campo vem preenchido
como "Sim".

### 1.4 Estado por bloco — independente, nunca compartilhado

Cada `BlocoRevalidacao` guarda seu **próprio** estado local
(`"pronto" | "gravando" | "confirmado" | "erro"`), **não** um estado único de
lista (diferente de `SugestaoQuitacao`/`quitacao.tsx`, que hoje usa um
`gravando: string | null` e um `erro` compartilhados por toda a lista — aqui
isso violaria a condição 3 do Gate Fiscal: um erro de rede num bloco não pode
aparecer, nem por engano, colado a outro bloco que nunca foi tocado).

- **`pronto`**: os dois botões ativos, como no §1.3.
- **`gravando`** (clique em "Sim, confirmar os vínculos"): os dois botões
  desabilitados, `BotaoSalvar`-like feedback só dentro deste card
  (`ocupado` no botão primário, texto "Confirmando…"). "Revisar" também
  desabilita durante a gravação deste bloco — evita navegar para longe
  enquanto uma chamada deste mesmo bloco está em voo.
- **`confirmado`** (sucesso): o card mostra, por ~1,2s, `Banner cor="grn"
  role="status"` **"Vínculo confirmado."** dentro do próprio card, e então o
  bloco **sai da lista** (o compromisso não bate mais a condição de "N≥2 sem
  vínculo formal" do §1.1). Nenhum `router.push` — o Mateus continua na tela,
  vendo os blocos restantes.
- **`erro`** (falha de rede/gravação): `Banner cor="red" role="alert"` **só
  dentro deste card**: "Não deu para confirmar este vínculo. Nada foi
  alterado — tente de novo." + o botão primário volta a `pronto` (mesmo
  clique tenta de novo). Os demais blocos continuam exatamente como estavam
  — nenhum re-fetch da lista inteira, nenhum re-render que os afete.

Chamada de gravação: reaproveita a mesma função de conversão do CONTAI-080
(`criarVinculos` para os documentos resolvidos deste compromisso,
`documentoHabil: ehDocumentoHabil(doc)` por item) — nenhuma função nova, só
chamada da tela de lista em vez da tela cheia de `/compromisso/[id]/
confirmar`.

### 1.5 Cabeçalho da tela e contador

```
CabecalhoDaTela
  titulo="Vínculos a confirmar"
  sub={`${M} ${M === 1 ? "compra" : "compras"} desta fatura, ${M === 1 ? "pré-ligada a mais de uma nota" : "pré-ligadas a mais de uma nota"}`}
```

`‹ Fatura` no breadcrumb, voltando para `/fatura/${fatura.id}` (mesmo padrão
de `‹ Agendamento` do CONTAI-080). `M` é sempre o número de blocos
**atualmente renderizados** (decresce a cada confirmação, nunca fixo desde o
carregamento).

### 1.6 M chega a zero e estado vazio — o mesmo card terminal, dois textos

As duas situações do enunciado ("todos resolvidos" e "chegou direto pela URL
sem nada pendente") convergem para o **mesmo** `Card` terminal — é
deliberado: nos dois casos a tela não tem bloco nenhum para mostrar, e criar
dois layouts diferentes para o mesmo fato visual (lista vazia) seria
complexidade sem ganho. O que muda é só o texto, porque a origem é diferente:

- **Resolvido agora** (o Mateus acabou de confirmar o último bloco nesta
  sessão — controlado por uma flag local `resolvidoNestaVisita`, setada
  quando uma confirmação esvazia a lista):

  ```
  Banner cor="grn" role="status"
    "Vínculo(s) confirmado(s)." Nenhum compromisso desta fatura ainda
    espera decisão.
  [ Voltar à fatura ]  (BotaoLink, variante="primary", href=/fatura/[id])
  ```

- **Vazio ao carregar** (chegou pela URL, ou voltou depois, sem nunca ter
  confirmado nada nesta visita):

  ```
  Card
    Nenhum vínculo pendente nesta fatura no momento. Compromissos com uma
    única nota pré-ligada já foram vinculados automaticamente; os demais
    seguem em aberto até o pagamento.
  [ Voltar à fatura ]  (BotaoLink, href=/fatura/[id])
  ```

  Sem `Banner` de sucesso aqui (nada foi confirmado agora) — só o fato,
  neutro, mesmo tom do card vazio de `/pagamento/[id]/ligar` já em produção.

**Sem `router.push` automático em nenhum dos dois casos.** Cenário de gestão,
sentado: o Mateus decide quando sair, mesma disciplina já usada no
`anexar()` de `/fatura/[id]` (CONTAI-067) e no card de sucesso de
`/fatura/[id]/confirmar`/`/alocar`. Forçar navegação no instante em que o
último bloco confirma tiraria dele a chance de ver a confirmação antes da
tela mudar.

### 1.7 Erro ao carregar a tela inteira

Falha ao buscar fatura/compromissos/pré-vínculos (não um erro de gravação de
bloco — isso é o §1.4): `EstadoErro` + "Tentar de novo", mesmo padrão de
`/fatura/[id]` e `/fatura/[id]/confirmar`. Estado `carregando`:
`Carregando rotulo="Carregando os vínculos pendentes desta fatura"`.

### 1.8 ASCII completo (2 blocos pendentes)

```
┌─────────────────────────────────────────────────┐
│ ‹ Fatura                                         │
│ Vínculos a confirmar                             │
│ 2 compras desta fatura, pré-ligadas a mais de    │
│ uma nota                                          │
├─────────────────────────────────────────────────┤
│ ┌─ (border-dashed, âmbar) ──────────────────────┐ │
│ │ Superbeton — concreto usinado                 │ │
│ │ compra 03/03/2026 · R$ 4.850,00                │ │
│ │                                                │ │
│ │ Confirmar este pagamento também confirma o    │ │
│ │ vínculo com Nota nº 1042 — R$ 3.200,00, Nota   │ │
│ │ nº 1051 — R$ 1.650,00, como você já tinha      │ │
│ │ indicado?                                      │ │
│ │                                                │ │
│ │ [ Sim, confirmar os vínculos ]                 │ │
│ │ [ Revisar antes de confirmar ]                 │ │
│ └────────────────────────────────────────────────┘ │
│ ┌─ (border-dashed, âmbar) ──────────────────────┐ │
│ │ Marcenaria Ilha                               │ │
│ │ compra 11/03/2026 · R$ 6.400,00                │ │
│ │                                                │ │
│ │ Confirmar este pagamento também confirma o    │ │
│ │ vínculo com Nota nº 87 — R$ 6.400,00, Nota nº  │ │
│ │ 90 — R$ 0,00 (boleto), como você já tinha      │ │
│ │ indicado?                                      │ │
│ │                                                │ │
│ │ [ Sim, confirmar os vínculos ]                 │ │
│ │ [ Revisar antes de confirmar ]                 │ │
│ └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

Depois de confirmar o primeiro bloco (transição, ~1,2s, só naquele card):

```
│ ┌─ (border sólida, verde) ──────────────────────┐ │
│ │ Superbeton — concreto usinado                 │ │
│ │ ✓ Vínculo confirmado.                          │ │
│ └────────────────────────────────────────────────┘ │
│ ┌─ (border-dashed, âmbar, intocado) ────────────┐ │
│ │ Marcenaria Ilha ... [ os dois botões ainda ]  │ │
│ └────────────────────────────────────────────────┘ │
```

E, ~1,2s depois, o primeiro card some e o cabeçalho passa a ler "1 compra
desta fatura, pré-ligada a mais de uma nota" — sem reload de página, só o
item saindo do array local.

Erro de rede no segundo bloco, primeiro intocado:

```
│ ┌─ (border-dashed, âmbar, intocado) ────────────┐ │
│ │ Marcenaria Ilha [confirmado antes, já sumiu]  │ │
│ └────────────────────────────────────────────────┘ │
│ ┌─ (border-dashed, âmbar) ──────────────────────┐ │
│ │ [outro compromisso pendente]                  │ │
│ │ ⚠ Não deu para confirmar este vínculo. Nada   │ │
│ │   foi alterado — tente de novo.               │ │
│ │ [ Sim, confirmar os vínculos ]                 │ │
│ │ [ Revisar antes de confirmar ]                 │ │
│ └────────────────────────────────────────────────┘ │
```

---

## 2. CTA novo em `/fatura/[id]` — Nível 2

**Onde**: dentro de `app/(gestao)/fatura/[id]/page.tsx`, um `Card` novo,
inserido **logo depois** do `Banner` de abertura ("A fatura não é documento
hábil...") e **antes** do `Card` "Compras vinculadas". Justificativa de
posição: é pendência acionável desta fatura específica (Princípio 2 — "o que
está faltando aparece primeiro"), então vem antes da leitura passiva das
compras, não depois — o Mateus decide primeiro "tenho vínculo pendente?"
antes de reler o que já sabe (a lista de compras). Aparece **independente**
de `abertas.length` (compras já pagas também podem ter vínculo N≥2
pendente — é justamente o caso comum, fatura já confirmada com pendência
sobrando).

Condição de renderização: `M > 0`, onde `M` é a mesma contagem do §1.1
(compromissos desta fatura, quitados, N≥2, sem vínculo formal completo).
Quando `M === 0`, o `Card` **não renderiza nada** — sem estado vazio aqui,
porque a ausência já é o "vazio" (mesma lógica do `Card` "Valores já pagos",
que também só aparece quando há o que mostrar).

```
┌─ Card (border-dashed border-amb) ─────────────────┐
│ 2 compras com vínculo a confirmar                 │
│ Foram pagas com um pré-vínculo declarado antes,   │
│ mas ainda esperam sua confirmação — até lá         │
│ seguem contando em "Notas hábeis sem pagamento     │
│ vinculado".                                        │
│                                                     │
│           [ Confirmar vínculos ]                   │
└─────────────────────────────────────────────────────┘
```

**Texto exato do CTA (botão)**: `{M} {M === 1 ? "compra" : "compras"} com
vínculo a confirmar` — não é um rótulo fixo tipo "Confirmar vínculos"; é a
própria contagem interpolada, igual pediu o requisito, e por isso é o
**título** do card (linha em destaque, `font-semibold`), não o texto do
botão. O botão embaixo é a ação ("Confirmar vínculos"), levando para
`/fatura/${fatura.id}/vinculos`. Separar os dois evita um botão gigante com
frase inteira dentro (padrão de botão do resto do produto é verbo curto — ver
"Confirmar pagamento", "Confirmar alocação", "Anexar extrato").

**Texto de apoio** (uma frase, `text-mut`, sem `Dica` própria por ser curto
o bastante para caber junto do título): recorta do §J.2 (nota) — "seguem
contando em 'Notas hábeis sem pagamento vinculado'" é o mesmo fato já usado
literalmente no bloco §3 do CONTAI-080, então é citação, não redação nova.

`BotaoLink href={`/fatura/${fatura.id}/vinculos`} variante="primary"`.

---

## 3. Redirecionamento pós-confirmação — Nível 2

**Onde**: `app/(gestao)/fatura/[id]/confirmar/page.tsx` (`salvar()`) e
`app/(gestao)/fatura/[id]/alocar/page.tsx` (`confirmar()`), na função que hoje
sempre termina em `setEstado({ fase: "salvo", ... })`.

**Mudança**: depois que a gravação principal (desembolso/alocação) tiver
sucesso, checar quantos compromissos **desta fatura** ainda batem a condição
do §1.1 (quitados, N≥2, sem vínculo formal completo) — nome de função fica
para o `cto-obra` no Gate 2 (proposta: `contarVinculosPendentesDaFatura(faturaId)`,
mesma família de `carregarPreVinculosDoCompromisso` do CONTAI-080).

```
gravação principal (desembolso ou alocação) — sucesso
                    │
      M = contarVinculosPendentesDaFatura(fatura.id)
                    │
        ┌───────────┴───────────┐
        │                       │
      M === 0                 M > 0
        │                       │
  setEstado("salvo")   router.push(
  — tela de sucesso      `/fatura/${fatura.id}/vinculos?confirmouFatura=1`
  de sempre, intacta   )
```

**Como o Mateus percebe que foi levado para `/vinculos` em vez da tela de
sucesso normal**: o query param `confirmouFatura=1` é lido **só** por
`/fatura/[id]/vinculos` para decidir se mostra, no topo da `ColunaDeDetalhe`,
**antes** da lista de blocos, um `Banner cor="amb" role="status"` de
transição:

> **Fatura confirmada.** Falta só decidir {M} {M === 1 ? "vínculo" :
> "vínculos"} antes de fechar de vez.

Esse banner some assim que M chegar a zero nesta mesma visita (o estado
terminal do §1.6, variante "Resolvido agora", já cobre a despedida — não
precisa dos dois ao mesmo tempo). O query param **não** participa da lógica
de quais blocos aparecem (isso continua 100% derivado do estado gravado,
§1.1) — ele só liga/desliga esta única frase, e recarregar a página sem o
param (ou voltar depois) simplesmente não mostra a frase de transição,
mostrando só os blocos pendentes normalmente. Mesmo padrão de query param
cosmético que `desembolsoId` já usa em `/fatura/[id]/alocar` hoje.

Cor **âmbar, não verde**: a fatura foi de fato confirmada (fato consumado,
merece reconhecimento), mas ainda sobra decisão do Mateus — verde aqui
mentiria "terminado".

---

## 4. Confirmação — mesmos componentes visuais do CONTAI-080, sem variante nova

O CTA "Ligar notas a este agendamento" em `/compromisso/[id]` e o chip/texto
"Pré-vínculo — ainda não é custo" (com as variantes N=1/N≥2) em
`/compromisso/[id]` e `/documento/[id]`, ao passarem a existir também para
`origem === "cartao"`, usam **exatamente** os componentes já especificados em
`design/mocks/CONTAI-080.md` §1.1, §2 e §3 — mesmo `BotaoLink` secundário,
mesmo `Chip cor="amb" peso="vazado"`, mesmo texto literal (`textoPreVinculoDoCompromisso`,
ADENDO 8 §L.2), mesma posição no bloco `data-acoes="agendamento"`. **Nenhuma
variante visual nova é criada para cartão** — a única mudança é a condição
`podePreVincular` (arquitetura, `cto-obra`) deixar de excluir essa origem. A
tela `/compromisso/[id]/pre-vincular` (§1 do CONTAI-080) também é
reaproveitada sem alteração: a lista de documentos candidatos não depende da
origem do compromisso.

A única superfície **nova** de tela que o CONTAI-081 introduz é a agregação
por fatura (§1-§3 acima) — porque só o cartão tem o conceito de "uma fatura
confirma/aloca vários compromissos de uma vez", caso que PIX/boleto não tem
(cada compromisso de PIX/boleto se confirma sozinho, em
`/compromisso/[id]/confirmar`, que já ganhou seu próprio bloco de revalidação
no CONTAI-080 §4).

---

## Campos

- SEM CAMPOS — nenhuma tela deste spec tem campo digitável. A rota nova
  `/fatura/[id]/vinculos` é decisão **por clique** (dois botões por bloco, §1.3);
  o CTA do §2 é título + link; o banner de transição do §3 é texto. Os
  formulários de `/fatura/[id]/confirmar`, `/fatura/[id]/parcial` e
  `/fatura/[id]/alocar` continuam **exatamente** com os campos dos specs do
  CONTAI-022 e do CONTAI-067 — este ticket não acrescenta, não remove e não
  muda nenhum deles (o único parâmetro novo, `propagarOrigemIds`, é calculado
  pelo app e nunca digitado).
