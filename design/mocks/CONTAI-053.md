# CONTAI-053 — repeater de retenção na captura, em tela larga

Delta sobre `design/mocks/captura-no-desktop-v1.md` (casca larga de
`/adicionar/documento`, piso 880px). Não repete o que já está lá: casca,
stepper, rail, dropzone, grade `formulário + rail`, breakpoint `larga`. Este
documento só especifica o que o Gate de Mock do `/tickets-req` marcou como
faltante para o `CONTAI-053`.

Nível 2 (spec + ASCII do bloco) — reuso de componente já validado
(`FormularioDeLinha`), não fluxo novo.

## Campos
- SEM CAMPOS — nenhum campo novo, nenhuma mudança de nome, rótulo, tipo ou
  validação. Os seis controles que o bloco mostra (`rotuloLiteral`, `valor`,
  `composicao`, `tributo`, `eDescontoEfetivo`, `quemRecolhe`) são os MESMOS
  declarados no `CONTAI-038` (`## Campos`, seção do formulário "Adicionar
  linha"), reusados pelo mesmo componente: seguem todos **SEM DEFAULT — campo
  fiscal**, em qualquer largura de tela (critério 7 do ticket). O gate
  `retencaoNaNota` também continua como o `CONTAI-038` o declarou. Este
  documento só decide ONDE o bloco aparece, o que ele recapitula e o que a
  confirmação diz quando alguma linha não grava.

## Correção sobre `captura-no-desktop-v1.md`

A Decisão 4 daquele documento ("consequência nunca sai do campo que a gera")
continua válida e é a régua que este spec segue: o gate de retenção continua
inline, no mesmo card de hoje, e não migra para o rail — isso vale também para
o repeater que este ticket acrescenta. O que ficou **obsoleto** é a leitura
implícita de que `DICA_GATE_DESTACADA` é texto único em qualquer largura
("nenhum é reescrito", na tabela de Textos daquele doc): a frase "você detalha
isso depois, sentado" fica **falsa** quando o detalhamento já está visível ali
mesmo. Ver a correção aplicada na própria tabela de Textos do documento base.

## 1. Onde entra na grade

**Não é bloco do rail, e não é card separado.** Entra **dentro do mesmo Card**
que já tem "A nota está no seu CPF?" → "Esta nota destaca alguma retenção?" →
"Qual CNO está impresso nesta nota?" (ordem de hoje, `page.tsx` ~1192-1282) —
**entre** a resposta "Destacada" (com sua Dica) e a pergunta do CNO. Fica na
coluna **formulário** (556px), nunca na coluna **rail** (320px): o rail só
espelha o já confirmado, e este bloco é onde uma pendência fiscal nova pode
nascer (retenção sem recolhedor), o que a Decisão 4 proíbe de sair do card que
a gera.

Ordem final da pergunta, na tela larga, com `retencao_na_nota = "destacada"`:

```
A nota está no seu CPF?
Esta nota destaca alguma retenção?  → Destacada
  [Dica de fluxo, variante larga — texto 2]
  ── bloco de retenção (este ticket) ──
Qual CNO está impresso nesta nota?
```

**Renderização é por CSS, não por JS de largura** — mesma disciplina de
`PassosDaCaptura`/`GradeDaCaptura` (`captura.tsx`): o bloco **sempre monta no
DOM** quando `retencao_na_nota === "destacada"`, e uma classe
`hidden larga:flex flex-col gap-3.5` (ou equivalente) o esconde abaixo de
880px. Não existe unmount condicionado a `window.innerWidth`: é o que deixa
`e2e/viewport.spec.ts` (`toBeHidden()`, não `toHaveCount(0)`) provar a
ausência visual em vez de uma corrida de hidratação. Sugestão de atributo:
`data-captura="retencao"` no wrapper, para o E2E mirar sem depender de classe
Tailwind.

## 2. Os 4 "estados" do bloco, antes do documento existir

Não são loading/vazio/erro/sucesso do jeito usual, porque não há
`documento.id` e as linhas ainda não tocam rede — a gravação em
`documento_retencao` só acontece depois de `criarDocumento` (critério 3 do
ticket). Mapeamento:

| Estado usual | Aqui | Gatilho | O que aparece |
|---|---|---|---|
| **loading** | **não existe** | — | Adicionar uma linha ao array local `linhasPendentes` é síncrono (sem rede): não há nada para esperar. Nenhuma UI de carregamento é necessária neste bloco. |
| **vazio** | `linhasPendentes.length === 0` | acabou de responder "Destacada" | `FormularioDeLinha` **já aberto**, sem exigir um clique de "+ Adicionar a primeira linha" antes — diferente do `Repeater` da gestão, de propósito: a Dor de Origem é "preencher tudo junto", e cobrar um clique extra para abrir o que o usuário já veio preencher reintroduz a fricção que o ticket remove. Formulário nasce em branco (`LINHA_RETENCAO_VAZIA`), nenhum campo pré-marcado (critério 7). |
| **sucesso** | `linhasPendentes.length ≥ 1` | pelo menos uma linha local preenchida e validada | Lista recapitulando cada linha local (`LinhaLocal`, nome do CTO na Viabilidade) — rótulo entre aspas, valor, composição, "Abatido do pagamento", "A recolher como" (se aplicável), "Quem recolhe" (se aplicável) — **e nada mais**: sem o banner `CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR`, porque esse julgamento depende de `notaCoberta` (Σ pagamentos vinculados), que só existe depois que o documento e os vínculos gravam. Julgar isso agora seria adivinhar; o julgamento real acontece em `/documento/[id]` com o dado de verdade. Cada linha tem "Remover esta linha" (sem confirmação, splice local — nunca rede). Abaixo da lista: `FormularioDeLinha` **fechado**, com botão "+ Adicionar outra linha" (aqui sim, igual à gestão — o clique extra faz sentido quando já existe pelo menos uma linha visível, para o formulário não ficar permanentemente aberto no fim da lista). |
| **erro** | **não existe neste bloco** | — | Impossível por construção: não há chamada de rede antes de "Salvar registro". A única coisa parecida com erro aqui é validação de campo dentro do próprio `FormularioDeLinha` (já existente, reusado sem mudança: `tentou`, `erroDe`, botão nomeando quantas respostas faltam). A falha real — linha que não gravou **depois** do "Salvar" — aparece na tela de confirmação (`Registrado`), nunca aqui: quando ela acontece, o bloco já foi desmontado (a página navegou). Ver item 4. |

Consequência prática: zerar `linhasPendentes` quando o gate muda de
"destacada" para "nenhuma" (já decidido na Viabilidade do CTO) devolve o bloco
ao estado **vazio** se o usuário voltar para "destacada" depois — nunca há
linha fantasma.

## 3. Textos — dicas de fluxo (produto, não consequência fiscal)

Os dois pares abaixo coexistem no DOM; a visibilidade é por CSS
(`larga:hidden` / `hidden larga:block`), igual ao padrão de
`PassosDaCaptura`. Nenhuma modificação em `Dica` (`ui.tsx`) é necessária —
basta envolver cada uma num `div` com a classe de visibilidade.

**a) `DICA_GATE_DESTACADA` — abaixo de 880px, sem mudança nenhuma (regressão travada pelo critério 6):**
> "Você detalha isso depois, sentado — aqui só marcamos que a nota tem retenção."

**b) Nova constante — variante ≥880px (nome sugerido: `DICA_GATE_DESTACADA_LARGA`, `lib/fiscal/retencao.ts`, mesmo padrão de comentário "orientação de fluxo, não regra fiscal" que já marca a original):**
> "As linhas de retenção aparecem logo abaixo — preencha agora, com a nota na mão, ou deixe em branco e complete depois, na tela desta nota."

**c) Dica final da página (`page.tsx`, ~1419-1423) — abaixo de 880px, sem mudança:**
> "Olhe na nota antes de responder — "não" no CPF leva à quarentena; "destacada" na retenção abre o detalhamento linha a linha, que você preenche depois. Sem responder, não salva."

**d) Dica final da página — variante ≥880px (só a cláusula da retenção muda; resto idêntico byte a byte):**
> "Olhe na nota antes de responder — "não" no CPF leva à quarentena; "destacada" na retenção abre o detalhamento linha a linha, logo abaixo, nesta mesma tela. Sem responder, não salva."

## 4. Mensagem de resultado parcial (critério 3) — documento salvo, alguma linha falhou ao gravar

Mesmo padrão já usado para falha de vínculo (`aviso` de `Registrado`,
CONTAI-018 critério 1) e para CNO sem obra (`extra`, CONTAI-007 critério 8):
card `border-amb` no slot `extra` de `Registrado`, **não** o slot `aviso`
vermelho — a nota foi salva e é documentação hábil normalmente; o que fica
pendente é só a informação de retenção, mesma severidade visual da pendência
de CNO.

Renderiza **somente quando** `totalTentadas > 0 && falharam > 0` (linhas
tentadas = as que estavam em `linhasPendentes` no momento do "Salvar"). Se
todas gravarem, nenhum card aparece — sucesso é silencioso, igual ao vínculo.
Se a lista estava vazia (usuário deixou "para depois"), isto não é falha: é o
estado já coberto pelo `CHIP_RETENCAO_SEM_LINHA` existente em
`/documento/[id]`.

```
┌ Card border-amb ──────────────────────────────────────┐
│ [Chip amb] Retenção parcialmente gravada               │
│                                                          │
│ Entrou 1 de 3 linhas de retenção — 2 não gravaram.      │
│                                                          │
│ Abra o documento e registre as que faltam de novo,      │
│ olhando a nota — elas ficam como pendência até lá,      │
│ nunca como "sem retenção".                              │
│                                                          │
│ [ Abrir esta nota → ]                                    │
└──────────────────────────────────────────────────────────┘
```

**Chip/título (texto 3):**
> "Retenção parcialmente gravada"

**Corpo (texto 4 — template com concordância singular/plural, mesmo padrão de `fase.ligados` em `page.tsx`):**

⚠️ **Corrigido no Gate 2 do CONTAI-053**: a fórmula abaixo trazia o verbo
concordando com `total` (*"3 linhas … entraram"*), o que contradizia o ASCII
logo acima (*"Entrou 1 de 3 linhas de retenção"*). O substantivo concorda com
`total`; o **verbo** concorda com `entraram` — quem entrou é o sujeito.

⚠️ **Segunda correção, revisão de texto pós-Gate-2**: o verbo veio para o
INÍCIO da frase, não depois da quantidade. Com o verbo depois ("1 linha …
entraram"), o caso `total=1, entraram=0` lia mal: substantivo singular
("1 linha") colado ao verbo plural ("entraram"). Com o verbo na frente, a
frase lê bem nos dois sentidos.

> "`{entraram === 1 ? "Entrou" : "Entraram"}` `{entraram}` de `{total}` `{total === 1 ? "linha" : "linhas"}` de retenção — `{falharam}` `{falharam === 1 ? "não gravou" : "não gravaram"}`."
>
> "Abra o documento e registre `{falharam === 1 ? "a que falta" : "as que faltam"}` de novo, olhando a nota — elas ficam como pendência até lá, nunca como "sem retenção"."

Link do botão: `/documento/{fase.id}` (mesmo padrão de `hrefCorrigirObra`,
`BotaoLink` já importado em `page.tsx`).

**Fora de escopo, registrado aqui para não virar suposição do
`lead-engineer`:** o conteúdo das linhas que falharam **não** é preservado
para reabertura pré-preenchida em `/documento/[id]` — o usuário retorna ao
papel (a nota) como fonte, igual a qualquer correção de linha na gestão
("remova e registre de novo"). Nenhuma persistência client-side (localStorage,
query param) é necessária para isto.

Se `vinculoFalhou` **e** retenção parcial acontecerem juntos (raro, duas
falhas de rede na mesma gravação): os dois cards coexistem — `aviso`
(vínculo, vermelho) continua no topo do `Corpo`, o card de retenção entra no
`extra`, na mesma posição relativa que o card de CNO já ocupa hoje (depois do
`Card` de resumo). Nenhuma composição nova: é o mesmo slot já usado por CNO,
com dois cards em vez de um quando os dois casos coincidem.

## 5. ASCII — estado "sucesso" (1 linha local) + CNO abaixo, ≥880px

```
/adicionar/documento · Passo 2 de 3                         [rail →]
┌─ formulário (556px) ──────────────────────────────┐  ┌ resumo ──────┐
│ Card ─────────────────────────────────────────────│  │ Tipo: NF     │
│  A nota está no seu CPF?                           │  │  serviço     │
│   (●) Sim   ( ) Não                                │  │ Emitente: … │
│                                                     │  │ Valor:      │
│  Esta nota destaca alguma retenção?                │  │  R$ 4.200,00│
│   ( ) Nenhuma   (●) Destacada                      │  └──────────────┘
│                                                     │  ┌ anexo ───────┐
│  As linhas de retenção aparecem logo abaixo —      │  │ [preview]    │
│  preencha agora, com a nota na mão, ou deixe em    │  │ 🪄 Extrair   │
│  branco e complete depois, na tela desta nota.     │  └──────────────┘
│  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │
│  "Total das Retenções (ISSQN/Federais)" R$ 320,00  │
│  Tributo único identificado — ISS                  │
│  Abatido do pagamento: sim                         │
│  A recolher como: ISS                              │
│  Quem recolhe: Ainda não sei                       │
│  [ Remover esta linha ]                            │
│                                                     │
│  [ + Adicionar outra linha ]                       │
│  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │
│  Qual CNO está impresso nesta nota?                │
│   (●) É desta obra   ( ) Não traz   ( ) Outra obra │
└─────────────────────────────────────────────────────┘
```

Estado **vazio** (gate acabou de virar "Destacada", zero linhas): o mesmo
espaço mostra `FormularioDeLinha` já aberto — rótulo, valor, composição,
tributo condicional, "abatido do pagamento", "quem recolhe" condicional,
botão "Adicionar linha" — no lugar da recapitulação, sem o "+ Adicionar
outra linha" (não existe "outra" ainda) e sem o divisor duplo.

## 6. O que NÃO muda (herdado, não redecidido aqui)

- Abaixo de 880px: zero campo de retenção na captura, gate continua só
  perguntando "Nenhuma"/"Destacada" com a Dica antiga — critério 6 e 8.
- Nenhum campo nasce marcado (`composicao`, `tributo`, `e_desconto_efetivo`,
  `quem_recolhe`) — critério 7, mesma proibição do `CONTAI-038`.
- `FormularioDeLinha` é reusado tal como está em `app/_components/retencao.tsx`
  — mesma validação (`validarLinhaRetencao`), mesmos textos
  (`lib/fiscal/retencao.ts`). Este spec não pede nenhum campo, pergunta ou
  ordem nova dentro dele.
- Composição combinada/não sei nunca decompõe por tributo — herdado por reuso
  do componente, não redesenhado.

## Arquivos

- `design/mocks/CONTAI-053.md` — este documento.
- `design/mocks/captura-no-desktop-v1.md` — casca larga da captura (corrigido,
  ver seção 1 acima).
