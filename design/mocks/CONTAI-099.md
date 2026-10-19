# CONTAI-099 — CTA "Registrar pagamento" na confirmação do documento

Cenário: **captura** (`/adicionar/documento`, fase "salvo" — a tela de
confirmação que o componente `Registrado` renderiza logo depois de "Salvar").
O Teste do Canteiro continua valendo para ESTA tela, mas com uma ressalva:
ela não é o instante sagrado da captura (fotografar a nota, digitar o PIX) —
é o passo seguinte, depois que o documento já está gravado. Nada aqui
bloqueia a saída: "Voltar ao início" continua ali, uma só mão, um toque. O
botão novo soma uma opção sem alongar o caminho de quem só quer sair.

Esta tela já vive sob o teto `COLUNA_DO_FORMULARIO` (`registrado.tsx:68-70`,
CONTAI-047) — 430px mesmo em tela larga, por design deliberado ("não se
estica pelos 940px da casca larga"). A permissão de 2026-09-22 (telas de
`/adicionar/*` também podem ganhar tratamento desktop) existe, mas este
ticket **não a exercita**: é um delta de um botão dentro do shell atual, não
um redesenho de layout. Não há decisão de largura em aberto aqui — ficaria
para um ticket de design à parte, se o Mateus quiser esse tratamento também
para `/adicionar/documento`.

Nível **2** (spec + ASCII). O destino (`/adicionar/pagamento?documento=<id>`)
já existe, já funciona e já herda favorecido/CNPJ/valor sugerido
(`pagamento/page.tsx:147-233`) — é fiação de um `BotaoLink` já testado para
dentro de uma tela que já existe, igual ao padrão de nível 2 do CONTAI-097.
Não há desenho de tela nova, não há componente novo, não há campo novo.

Fonte fiscal: nenhuma pergunta fiscal nova — ver "Nenhum campo fiscal novo"
abaixo. O único cuidado fiscal é de RÓTULO (gate do `contador`, já no
relato): o texto do botão não pode afirmar fato consumado.

## Rótulo do botão

**"Registrar o pagamento desta nota"** — reaproveita, byte a byte, o rótulo
já em produção em `app/(gestao)/documento/[id]/page.tsx:363-365` (mesmo
destino, mesma ação, hoje só alcançável depois de abrir o documento salvo
pela gestão). Decisão deliberada de **não inventar um rótulo novo**:

- É convite, não afirmação — "registrar" é verbo de ação futura, não "nota
  paga" nem "pagamento registrado". Passa o Gate Fiscal do relato.
- É curto (28 caracteres), nomeia a ação e o objeto ("desta nota" ancora
  qual documento, já que a tela não teria outro contexto por perto).
- É **reconhecível**: quem já viu este botão em `/documento/[id]` (vindo de
  qualquer outro lugar do app) encontra o mesmo texto aqui — não há risco de
  o Mateus se perguntar se são ações diferentes.

Texto de apoio, abaixo do botão (novo, `Dica`): **"Favorecido, CNPJ e valor
sugerido já vêm desta nota."** — reduz a hesitação de clicar (ele já sabe,
antes de ir, que não vai redigitar nada) e é uma afirmação verdadeira hoje
(mesmo mecanismo de herança do CONTAI-097, já em produção).

## Campos

- SEM CAMPOS — esta mudança é 100% navegação: um `BotaoLink` para uma rota que
  já existe. Nenhum controle novo, nenhum rótulo de campo, nenhum default
  tocado.

## Fluxo

1. `/adicionar/documento` → "Salvar" → fase muda para `"salvo"` (comportamento
   atual, inalterado).
2. `Registrado` é renderizado com os props atuais (`aviso`, `extra`,
   `proximoPasso`, `custo`, etc.) **mais um prop novo**: `acaoProximoPasso?:
   ReactNode`, renderizado dentro do mesmo `Card` que já tem as três `Linha`
   ("Obra" / "Próximo passo" / "Custo"), imediatamente **depois** da última
   `Linha` e **antes** de `{extra}`.
3. Em `documento/page.tsx`, no ponto onde `Registrado` é chamado
   (hoje `:1148-1250`), `acaoProximoPasso` é passado assim:
   - `fase.ligados > 0` → `undefined` (nada muda; comportamento atual
     preservado).
   - `fase.vinculoFalhou === true` → `undefined` (a CTA de pagamento NOVO não
     aparece aqui — evita duplicar o que o `aviso` vermelho já está pedindo
     para resolver por outro caminho: "Ligar a um pagamento").
   - `fase.ligados === 0 && !fase.vinculoFalhou` → o bloco novo: `BotaoLink`
     + `Dica`, como descrito no ASCII "depois" abaixo.
4. O texto da `Linha rotulo="Próximo passo"` **não muda** em nenhum dos três
   casos — a condição que hoje escolhe entre "nada pendente — N
   pagamento(s) ligado(s)" e "registrar o pagamento quando ele acontecer"
   continua exatamente a mesma. O que muda é só o que aparece **debaixo**
   das três `Linha`, dentro do mesmo `Card`, quando `ligados === 0 &&
   !vinculoFalhou`.
5. Clique no botão → `router` (via `Link`, que é o que `BotaoLink` usa) para
   `/adicionar/pagamento?documento=${fase.id}` — mecanismo 100% existente,
   zero lógica nova de herança (critério 3 do backlog 112 já cumprido por
   construção).
6. As duas ações hoje existentes — "Corrigir a obra deste registro" (Card
   própria, mais abaixo) e "Voltar ao início" (`Rodape`) — continuam
   presentes, sem mudança de posição nem de texto.

## ASCII — bloco "Próximo passo" (dentro do Card principal)

### ANTES — `fase.ligados > 0` (pagamento já ligado neste ato)

Comportamento atual. **Sem mudança neste caso.**

```
┌ Card ──────────────────────────────────────────────────────┐
│ Obra                                      Fazenda do Mateus │
│ Próximo passo        nada pendente — 1 pagamento ligado     │
│ Custo 2026        conta pela data do pagamento ligado —     │
│                                           regime de caixa    │
└───────────────────────────────────────────────────────────┘
```

### ANTES — `fase.vinculoFalhou === true` (vínculo automático falhou)

Comportamento atual. **Sem mudança neste caso** (a CTA nova NÃO aparece
aqui — ver "Nota lateral" abaixo para uma melhoria opcional, fora de
escopo).

```
┌ Banner vermelho (aviso) ─────────────────────────────────────┐
│ O documento foi salvo, mas ficou SEM VÍNCULO com os           │
│ pagamentos que você marcou. [...] abra o documento e use       │
│ "Ligar a um pagamento".                                        │
└─────────────────────────────────────────────────────────────┘

┌ Card ──────────────────────────────────────────────────────┐
│ Obra                                      Fazenda do Mateus │
│ Próximo passo       registrar o pagamento quando ele          │
│                                                acontecer       │
│ Custo 2026        soma quando o pagamento for registrado e    │
│                                             ligado a esta nota │
└───────────────────────────────────────────────────────────┘
```

### DEPOIS — `fase.ligados === 0 && !fase.vinculoFalhou` (caso novo)

```
┌ Card ──────────────────────────────────────────────────────┐
│ Obra                                      Fazenda do Mateus │
│ Próximo passo       registrar o pagamento quando ele          │
│                                                acontecer       │
│ Custo 2026        soma quando o pagamento for registrado e    │
│                                             ligado a esta nota │
│ ───────────────────────────────────────────────────────── │
│         [ Registrar o pagamento desta nota        ]         │ ← novo
│   Favorecido, CNPJ e valor sugerido já vêm desta nota.       │ ← novo
└───────────────────────────────────────────────────────────┘
```

O botão é `variante="primary"` (igual ao "Voltar ao início" do rodapé, em
contraste com o "Corrigir a obra deste registro", que fica `ghost` mais
abaixo, fora deste Card) — é a ação que este ticket existe para destacar, não
mais uma opção secundária entre outras.

## Os 4 estados (delta)

- **Carregando**: inalterado — a tela de confirmação só existe depois que o
  salvamento já terminou; não há estado de carregamento novo.
- **Vazio**: não se aplica — não é um campo, é um botão condicional que
  nasce visível ou ausente conforme `fase.ligados`/`fase.vinculoFalhou`,
  sem estado intermediário.
- **Erro**: não se aplica a este delta — nenhuma gravação nova acontece
  aqui; o clique é só navegação (`Link`). Qualquer erro de gravação é da
  tela de destino (`/adicionar/pagamento`), já tratado lá e fora de escopo
  deste ticket.
- **Sucesso**: inalterado na forma — a tela de confirmação continua sendo a
  tela de sucesso do salvamento do documento; o botão novo não cria um novo
  estado de sucesso, só uma saída adicional a partir dele.

## Navegação

Uma rota nova acessível a partir desta tela:
`/adicionar/pagamento?documento=<id>` — já existe, já é usada a partir de
`/documento/[id]`; nada muda na tela de destino.

## Decisões de design

- **Onde o botão entra**: dentro do MESMO `Card` que já tem Obra/Próximo
  passo/Custo, não numa `Card` separada. O critério de aceite preliminar 1
  do backlog 112 permitia duas formas ("vira, ou ganha ao lado, um botão
  real") — nenhuma das duas é literal aqui, porque `Linha` é
  `flex justify-between` com o valor alinhado à direita em texto, e
  `BotaoLink` é `block w-full`: colar um botão de largura total dentro da
  `span` de uma `Linha` quebraria esse componente para todo o resto do app
  que o usa. A solução adotada — texto da `Linha` inalterado, botão no
  rodapé do mesmo `Card` — cumpre o espírito ("ganha ao lado", mesmo bloco
  visual) sem abrir uma segunda variante de `Linha`.
- **Por que `acaoProximoPasso` é prop novo do `Registrado`, e não um uso do
  `extra` existente**: `extra` já é ocupado, neste mesmo call site, pelos
  avisos de CNO ausente e retenção parcial (`documento/page.tsx:1190-1234`),
  que são ortogonais a `ligados`/`vinculoFalhou` e podem coexistir com o
  caso novo. Reaproveitar `extra` forçaria concatenar três condições
  independentes num único `ReactNode` compilado à mão; um prop dedicado
  mantém cada condição isolada e legível no call site.
- **Rótulo igual ao de `/documento/[id]`, de propósito** (ver seção acima) —
  é a mesma ação, o mesmo destino; textos diferentes para o mesmo botão em
  dois lugares do app custariam reconhecimento, não ganhariam nada.
- **`variante="primary"`**: esta tela já tem um botão `ghost`
  ("Corrigir a obra deste registro", para o caso de erro) e um `primary`
  ("Voltar ao início", a saída padrão). O botão novo preenche o papel que o
  rótulo "Próximo passo" já prometia como texto e nunca cumpria como ação —
  por isso herda o mesmo peso visual do `primary`, não o do `ghost`.

## Nota lateral (fora de escopo, melhoria opcional — não obrigatória)

Quando `fase.vinculoFalhou === true`, o `aviso` vermelho hoje diz em texto
"abra o documento e use 'Ligar a um pagamento'" sem link. Trocar esse trecho
por um `BotaoLink`/link real para `/documento/${fase.id}/ligar` resolveria a
mesma fricção de navegação que este ticket resolve para o caso
`ligados === 0`, só que para o caso de vínculo que falhou. Não é critério de
aceite deste ticket (o relato já marcou como nota lateral); registrado aqui
só para não se perder, caso vire ticket próprio.

## Nenhum campo fiscal novo

Esta mudança é 100% navegação: um botão que leva a uma tela que já existe,
com um mecanismo de herança que já existe. Não introduz pergunta fiscal
nova, não cria `Linha`/campo novo no formulário de documento, não toca em
"nota no CPF?" nem em retenção. O rótulo foi escolhido para nunca afirmar
fato consumado (ver "Rótulo do botão" acima) — é o único ponto onde o Gate
Fiscal do `contador` tem interesse, e já está respeitado por reaproveitar um
rótulo que o próprio app já usa noutro lugar.
