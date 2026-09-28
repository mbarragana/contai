# CONTAI-074 — ligar o mesmo pagamento (ou a mesma nota) a mais de um documento

**Cenário: gestão** (em casa, sentado). As duas telas afetadas —
`/documento/[id]/ligar` e `/pagamento/[id]/ligar` — já são gestão hoje
(conciliação pagamento↔nota, fora do momento de captura), e nada neste ticket
muda isso. O "Teste do Canteiro" não se aplica: a tarefa que a tela resolve —
"este pagamento também prova esta outra nota, quero ligar os dois" — não
acontece no instante do pagamento no canteiro, acontece depois, olhando o
extrato e as notas lado a lado. A terceira tela citada no ticket
(`app/(captura)/adicionar/documento/page.tsx`) é captura de verdade e fica
**fora de escopo** — o ticket já fixa isso, não é decisão minha.

375px não é piso obrigatório para nenhuma das duas telas (são shells de
gestão), mas nenhuma delas quebra nesse layout hoje, e este ticket não abre
decisão de layout novo — é adicionar campo/estado/aviso dentro da estrutura
existente.

## Nível do mock: **Nível 2 (spec + ASCII do bloco que muda)**

Não é Nível 1 (HTML navegável): as duas telas já existem, em produção, com
`Card` de saldo sticky, `Passo`, lista de `label`+checkbox e `RodapeDeAcao` —
nenhuma decisão de estrutura de tela está em aberto. A mudança é:

1. um bloco novo (disclosure colapsado) no fim da lista de candidatos;
2. uma marca informativa a mais em linhas que já existem;
3. um aviso condicional (`Consequencia` âmbar) inline, sob o item marcado;
4. três textos (dois substituindo constantes existentes, um novo) e um rótulo
   de botão condicional.

Nada disso é decisão de layout — é o mesmo padrão de disclosure que já existe
em produção (`app/(gestao)/despesas/page.tsx`, botão `Botao variante="ghost"`
dentro de um `Banner`/bloco informativo) e o mesmo padrão de aviso amarelo
inline que as duas telas já usam para outros casos (`VINCULO_QUARENTENA_NAO_GERA_CUSTO`,
`VINCULO_BOLETO_NAO_GERA_CUSTO`).

---

## 1. Modelo — o que a tela passa a receber (referência, não é a sua decisão de tipo exato)

O ticket já fecha isto no Gate de Viabilidade: `Candidato<T, Outro>` ganha
`jaLigadoA: Outro[]` e `cobertoPorInteiro: boolean`; uma lista só,
`pronto.candidatos`, sem lista paralela de ocultos. Para o spec de tela, o que
importa:

- Em `/documento/[id]/ligar`: `Candidato<Pagamento, Documento>` — cada
  candidato pagamento carrega os **documentos** a que já está ligado.
- Em `/pagamento/[id]/ligar`: `Candidato<Documento, Pagamento>` — cada
  candidato documento carrega os **pagamentos** a que já está ligado.
- `cobertoPorInteiro === true` ⇔ é o caso que hoje desaparece da lista
  (`temSaldoSemNota` / `temSaldoDescoberto` falso). Esses vão para o bloco
  colapsado do item 3 abaixo.
- Todo candidato com `jaLigadoA.length > 0` — **coberto por inteiro ou não** —
  mostra a marca do item 2. A marca não é exclusiva do bloco colapsado: o
  exemplo do próprio ticket (pagamento de R$ 3.000 parcialmente absorvido por
  NF de R$ 1.000) já é candidato visível hoje e passa a mostrar a marca sem
  sair da lista normal.

Identificador de "Outro" nos textos (reaproveita padrão já em produção, não
invento formato novo):

- **Documento** (quando o "Outro" é uma nota): `NOME_TIPO_CURTO[tipo]` +
  `" nº " + numero` se houver número — mesmo padrão de
  `documento/[id]/obra/page.tsx` e `pagamento/[id]/ligar/page.tsx`
  (`NOME_TIPO`). Ex.: `"NF de material nº 1234"`, ou `"Boleto"` quando não há
  número.
- **Pagamento** (quando o "Outro" é um pagamento): `formatarDataBR(dataPagamento)`
  + `" · "` + `favorecidoNome ?? "favorecido não informado"` — mesmo padrão
  de `documento/[id]/page.tsx` ("Pagamentos desta nota"). Ex.:
  `"12/03/2026 · Concretos Cachoeira"`.
- Os dois sempre seguidos de `" — " + formatarBRL(valorCentavos)`.
- Múltiplos "Outro": junte com `", "` e o último com `" e "` normal de
  linguagem — ex.: `"NF de material nº 1234 — R$ 1.000,00 e NF de serviço
  nº 88 — R$ 500,00"`. (Na prática hoje isso quase sempre é 1 item; a
  formatação de lista é só para não quebrar se um dia forem 2+.)

---

## 2. Marca sempre visível — candidato com `jaLigadoA.length > 0`

Aplica-se a **qualquer** candidato com vínculo prévio, revelado ou não. Entra
como uma linha nova dentro do `<label>` do candidato, **depois** da linha de
`sugestao` (que continua condicional e é sobre outra coisa — mesmo favorecido/
valor —, não sobre vínculo prévio):

```
<span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-amb">
  <Chip cor="amb" vazado>{cobertoPorInteiro ? "Coberto por inteiro" : "Vínculo parcial"}</Chip>
  <span>já ligado a: {listaDeOutros}</span>
</span>
```

- Cor âmbar (texto e chip) porque é informação que pede atenção antes de
  marcar — não é erro (vermelho) nem confirmação positiva (verde).
- O `Chip` diferencia os dois casos com uma palavra, sem duplicar a explicação
  inteira em toda linha: **"Coberto por inteiro"** (só possível dentro do
  bloco revelado do item 3) vs. **"Vínculo parcial"** (candidato que já
  aparecia normalmente hoje, como o exemplo dos R$ 3.000/R$ 1.000).
- Isto substitui, para este candidato, nenhuma linha existente — é aditivo.

## 3. Bloco colapsado — candidatos `cobertoPorInteiro === true`

Fica na mesma posição em que hoje vive a `Dica` estática de
`CANDIDATO_OCULTO_PAGAMENTO`/`CANDIDATO_OCULTO_DOCUMENTO`: **depois** da lista
de candidatos (ou depois do card vazio "Nenhum pagamento/documento para
ligar", se a lista visível estiver vazia) e **antes** de "Não achou o
pagamento?" / do botão "Registrar o documento agora".

Estado local novo: `revelarCobertos` (`boolean`, inicia `false`, não
persiste — recarregar a tela volta a colapsar; não precisa de mais que isso,
não é preferência que valha a pena lembrar).

**Colapsado** (`revelarCobertos === false` e existe ao menos 1 candidato com
`cobertoPorInteiro`):

```
┌──────────────────────────────────────────────┐
│ Pagamento já ligado a outra nota, com valor   │
│ totalmente absorvido, não aparece aqui por    │
│ padrão. Se este pagamento também é desta      │
│ nota — é permitido: o mesmo pagamento pode    │
│ servir de prova para mais de uma nota, desde  │
│ que a soma não ultrapasse o que foi realmente │
│ pago —, revele-o para escolher. Se ele foi    │
│ ligado à nota errada por engano, abra a nota  │
│ errada e desligue-o antes de ligar aqui.      │
│                                                │
│ [ Mostrar 2 pagamentos já cobertos ]          │
└──────────────────────────────────────────────┘
```

- Texto = `CANDIDATO_OCULTO_PAGAMENTO` novo (dado pelo ticket, literal — não eu
  reescrevendo), dentro de um `Dica` (mesma tag de hoje).
- Botão logo abaixo, `Botao variante="ghost"`, rótulo
  `` `Mostrar ${n} ${n === 1 ? "pagamento já coberto" : "pagamentos já cobertos"}` ``
  onde `n = candidatos.filter(c => c.cobertoPorInteiro).length`.
- Em `/pagamento/[id]/ligar`: mesmo bloco, texto = `CANDIDATO_OCULTO_DOCUMENTO`
  novo, rótulo `` `Mostrar ${n} ${n === 1 ? "nota já coberta" : "notas já cobertas"}` ``.
- Clique em "Mostrar N…" → `setRevelarCobertos(true)`. **Não tem botão de
  esconder de novo** — decisão de simplicidade: revelar é sempre seguro (nunca
  proíbe, só amplia a lista), esconder de novo não protege nada e é mais um
  estado para o `lead-engineer` testar sem ganho.

**Revelado** (`revelarCobertos === true`, ou não há nenhum
`cobertoPorInteiro`): o bloco acima desaparece, e os candidatos que tinham
`cobertoPorInteiro === true` entram **na mesma lista de checkboxes**, mesma
ordenação já usada para os visíveis (favorecido igual → valor igual → menor
diferença → data), anexados ao fim da lista visível (não misturados por
ordenação global — ficam claramente "a parte revelada", o que já é sinalizado
pelo `Chip` "Coberto por inteiro" de cada um). Usam o **mesmo** `<label>` de
checkbox que qualquer outro candidato, com a marca do item 2 sempre presente
(porque todo `cobertoPorInteiro` tem `jaLigadoA.length > 0` por definição).
Nenhuma borda ou cor de fundo diferente no item — o `Chip` já é o sinal
visual; duplicar em borda/fundo seria o quarto canal sem necessidade (mesmo
princípio do comentário sobre `vazado` em `ui.tsx`).

Se **todos** os candidatos forem `cobertoPorInteiro` (lista visível vazia) —
continua aparecendo o card vazio de hoje ("💸 Nenhum pagamento para ligar" /
"📄 Nenhum documento para ligar") **e**, logo abaixo, o bloco colapsado com a
contagem certa. O card vazio não muda de texto: ele já é literalmente
verdadeiro ("não há pagamento com saldo livre"), e o bloco colapsado é quem
oferece a saída.

## 4. Aviso obrigatório ao marcar — `Consequencia` inline

Quando o usuário marca (`alternar`) um candidato cujo `jaLigadoA.length > 0`
— revelado ou já visível, tanto faz —, aparece **imediatamente abaixo do
`<label>` daquele item** (dentro do mesmo bloco/`<div>` do candidato, não
lá embaixo perto do rodapé — a referência "este pagamento" só é inequívoca
colada no item):

```
<Consequencia cor="amb">
  Este pagamento já está ligado a {listaDeOutros}. Ligá-lo também a esta nota
  é permitido: o mesmo pagamento pode servir de prova para mais de um
  documento, sem duplicar valor — o sistema nunca conta o mesmo pagamento
  duas vezes na soma. Confirme que este pagamento realmente corresponde
  também a esta nota, e não é engano.
</Consequencia>
```

- Texto literal do parecer, só com `{listaDeOutros}` substituído pelo mesmo
  formato do item 1 (ex.: `"Nota nº 1234 — R$ 1.000,00"`).
- Some quando o item é desmarcado — é aviso de confirmação de intenção, não
  registro permanente de tela.
- Se **mais de um** candidato marcado tiver vínculo prévio, aparece **um
  `Consequencia` por item marcado**, cada um sob o seu próprio `<label>` —
  não agrega num único bloco no fim, porque "este pagamento" deixaria de ser
  claro qual pagamento.
- **Achado do CTO — trate explicitamente no texto do rodapé, não aqui**: como
  este aviso já deixa claro que o vínculo é permitido e não duplica valor, o
  rodapé (`Dica` de "Custo confirmado se ligar agora") não precisa de texto
  extra quando o acréscimo é R$ 0,00 SÓ POR causa de um vínculo de cobertura
  total — mas fica ambíguo com R$ 0,00 por outros motivos (documento não
  hábil, por exemplo). Ver item 5.

### Texto mirror para `/pagamento/[id]/ligar` — CONFIRMADO pelo `contador`

O `contador` corrigiu a cláusula final do espelhamento mecânico: as duas
direções não protegem contra a mesma duplicação. Em `/documento/[id]/ligar`
(candidato = pagamento), o nó que não pode ser contado duas vezes é o
**pagamento**. Em `/pagamento/[id]/ligar` (candidato = documento), são **dois
pagamentos distintos e reais** provando a **mesma nota** — o que não pode
duplicar é a **nota** no custo, não "o pagamento". Texto final, aprovado:

```
<Consequencia cor="amb">
  Esta nota já está ligada a {listaDeOutros}. Ligá-la também a este pagamento
  é permitido: a mesma nota pode ser comprovada por mais de um pagamento, sem
  duplicar valor — o sistema nunca conta a mesma nota duas vezes na soma do
  custo. Confirme que esta nota realmente corresponde também a este
  pagamento, e não é engano.
</Consequencia>
```

Todo o resto do espelhamento (identificadores, bloco colapsado, marca,
rótulo do botão, frase de custo zero) estava correto como proposto — só esta
cláusula final mudou.

## 5. Rodapé (`RodapeDeAcao`) — rótulo do `BotaoSalvar` e a `Dica` de custo

**`Dica` de custo confirmado** — acrescentar uma frase condicional, só quando
`marcadosDeVerdade` inclui ao menos um candidato com `jaLigadoA.length > 0` **e**
o acréscimo mostrado é `R$ 0,00`:

```
Custo confirmado se ligar agora: R$ 0,00
Não muda o custo confirmado — muda a prova documental: o pagamento passa a
comprovar também esta nota.
```

(a segunda linha só aparece nessa combinação exata: vínculo prévio marcado +
acréscimo zero. Acréscimo zero por documento não hábil continua usando o
texto que já existe hoje — " — a nota não é hábil" —, sem essa frase extra,
porque a causa ali é outra.)

**`BotaoSalvar`** — dois rótulos possíveis quando há algo marcado (a versão
"Marque ao menos um pagamento/documento" e o "Ligando…" continuam iguais):

- Nenhum marcado tem `jaLigadoA.length > 0`: rótulo igual ao de hoje —
  `` `Ligar ${n} ${n === 1 ? "pagamento" : "pagamentos"} — ${valor}` `` (ou
  "documento(s)" na tela espelhada).
- Ao menos um marcado tem `jaLigadoA.length > 0`: troca para
  `` `Confirmar ligação também a esta nota — ${valor}` `` em
  `/documento/[id]/ligar`, e
  `` `Confirmar ligação também a este pagamento — ${valor}` `` em
  `/pagamento/[id]/ligar`. Mantém o `${valor}` (soma dos marcados) no final,
  igual ao padrão atual — só troca o verbo/objeto da frase, não tira o
  número.
  - Se houver 2+ marcados e só alguns têm vínculo prévio, ainda assim usa o
    rótulo "Confirmar ligação também..." (o singular "esta nota"/"este
    pagamento" refere-se ao documento/pagamento CORRENTE da tela — o alvo da
    ligação —, não aos candidatos; por isso não pluraliza com a contagem de
    candidatos aqui, diferente do outro rótulo).

## 6. Os 4 estados — só sucesso muda

- **Loading**: sem mudança (`Dica` + `Carregando`).
- **Erro**: sem mudança (`Banner` vermelho + `EstadoErro`).
- **Vazio** (nenhum candidato, nem visível nem `cobertoPorInteiro`): sem
  mudança — o card 💸/📄 de hoje continua sozinho, sem bloco colapsado (`n=0`
  não renderiza o bloco do item 3).
- **Sucesso**: os quatro pontos acima (marca sempre visível, bloco colapsado,
  aviso inline ao marcar, rótulo condicional do botão). Um sub-caso do
  sucesso passa a existir — "lista visível vazia, mas há cobertos" — coberto
  no fim do item 3.

## 7. Espelhamento para `/pagamento/[id]/ligar` — confirmação final

Mesmo nível, mesmo mecanismo, trocando nota↔pagamento em tudo (identificador,
textos, emoji do card vazio continua `📄`, `NOME_TIPO` local do arquivo em vez
de import novo — o arquivo já tem seu próprio `NOME_TIPO`, então não precisa
trocar por `NOME_TIPO_CURTO` ali; só `/documento/[id]/ligar` precisa importar
`NOME_TIPO_CURTO` de `lib/fiscal/resumo.ts`, porque hoje não tem mapa de tipo
nenhum). Única diferença real: o texto do `Consequencia` de aviso não é um
espelhamento mecânico puro — o `contador` corrigiu a cláusula final (item 4),
porque a garantia que não pode duplicar nesta direção é a NOTA, não "o
pagamento". Com essa correção aplicada, o resto (bloco colapsado, marca
sempre visível, rótulo do botão, frase de custo zero) é mecanicamente
idêntico. Gate Fiscal fechado para as duas direções — nada pendente para o
Gate 1.

## Campos

- SEM CAMPOS — nenhum controle de ENTRADA novo e nenhum campo novo no banco. O
  único controle que nasce é o botão `Mostrar N … já cobertos`, que revela
  candidatos já existentes e **não grava nada**; a marca (`Chip` + "já ligado
  a"), o aviso `Consequencia` e a frase de custo zero são TEXTO derivado do
  estado. Os checkboxes do seletor já existem e continuam **SEM DEFAULT** —
  nada nasce marcado, nem na parte visível nem na revelada (critério 16 do
  ticket). Nenhum campo fiscal (`notaNoCpf`, `retencaoNaNota`, valor, data,
  anexo) é tocado por este spec.

---

## Resumo do que muda por arquivo (para o `lead-engineer`, não é meu papel decidir a implementação exata da lib)

- `lib/fiscal/vinculo.ts`: `Candidato<T, Outro>` ganha `jaLigadoA: Outro[]` e
  `cobertoPorInteiro: boolean`; `pagamentosCandidatos`/`documentosCandidatos`
  passam a incluir os hoje ocultos (com a flag ligada) em vez de filtrá-los;
  `pagamentosOcultosPorCobertura`/`documentosOcultosPorCobertura` só mudam se
  ainda forem necessárias para outra tela — não achei outro consumidor além
  destas duas telas, então podem virar apenas a contagem `cobertoPorInteiro`
  dentro da lista unificada. `CANDIDATO_OCULTO_PAGAMENTO`/`_DOCUMENTO` trocam
  de texto (item 3).
- `app/(gestao)/documento/[id]/ligar/page.tsx`: importar `NOME_TIPO_CURTO`;
  estado `revelarCobertos`; itens 2–5 acima.
- `app/(gestao)/pagamento/[id]/ligar/page.tsx`: mesmo, usando o `NOME_TIPO`
  local já existente no arquivo; itens 2–5 espelhados.
