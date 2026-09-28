# Relato + Gate Fiscal — 2026-09-28 — pré-vincular compromisso a nota antes de pagar

## Origem (relato)

Mesmo caso real do `CONTAI-074`: fornecedor de concreto usinado
(Superbeton/Ilhamix), 3 notas fiscais pagas por 7 parcelas (PIX + 2 cartões em
3x cada), sem correspondência 1-para-1 entre parcela e nota. O `CONTAI-074`
resolveu o lado de DEPOIS (pagamento já realizado ↔ nota). O Mateus agora quer
o lado de ANTES: vincular uma parcela agendada, **ainda não paga**, a uma ou
mais notas fiscais — "ficar tudo certo já", em vez de refazer a busca de nota
toda vez que uma fatura é confirmada como paga, numa obra com muitas parcelas
e notas sem correspondência simples, quando a intenção já é conhecida com
antecedência.

**Dor extraída**: repetir o trabalho de achar a nota certa no momento da
quitação, quando ele já sabe, no momento de agendar, a qual nota (ou notas)
aquele compromisso se refere. Fricção de processo — não é obrigação fiscal em
si (nenhum documento hábil deixa de existir por causa disso), mas nasce direto
de uma dor que já é fiscal em espécie (a mesma do `CONTAI-074`).

**Opções apresentadas e decisão do Mateus**: apresentadas 3 alternativas
(vínculo de verdade gravado no banco / só anotação-lembrete / explicar melhor
o que já existe). Escolheu a primeira: **vínculo de verdade, gravado, que
converte automaticamente para vínculo formal (`pagamento_documento`) quando o
compromisso for confirmado como pago** — rejeitou tratar isso como mera nota
de lembrete.

## Estado técnico (já levantado nesta sessão, não repetido aqui em detalhe)

- `pagamento_documento`: único vínculo formal hoje, N:M, só entre pagamentos
  JÁ REALIZADOS e documentos. É o que `alocarCusto` (`lib/fiscal/vinculo.ts`)
  usa para custo comprovado, teto `min(Σ pagamentos elegíveis, Σ documentos
  hábeis)` por componente conexo (`CONTAI-074`).
- `compromisso.documento_origem_id` (`CONTAI-065`): vínculo PARCIAL já
  existente — campo único (1 documento por compromisso), setado só na criação
  (herança de nota, `CONTAI-064`), não editável depois, não N:M. Não cobre o
  caso real (3 notas, 7 parcelas).
- `pagamentosCandidatos`/`documentosCandidatos` (telas `/documento/[id]/ligar`,
  `/pagamento/[id]/ligar`, `CONTAI-074`/`077`/`078`/`079`) só listam pagamentos
  JÁ REALIZADOS — compromissos em aberto nunca aparecem, por desenho (regime
  de caixa). **Isso não muda.**

## Gate Fiscal — `contador`, ADENDO 6 (2026-09-28)

Rodado nesta mesma entrada, antes de priorizar, por ser decisão de arquitetura
fiscal (mistura intenção declarada com apuração). Parecer completo:
`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`, **ADENDO 6,
seções J.0–J.5**, consumindo `2026-08-17-vinculo-pagamento-documento.md` (§1
condição 3, §2 "o clique não é fiscal", §3 teto do mínimo, ADENDO
2026-09-28 do `CONTAI-074`) e o corpo do próprio parecer de 18/08 (§1, §2, §3,
§C, §F). **Nada aqui exige CRC** — é extensão de capacidade dentro do
arcabouço já fixado, nenhuma tese ou número de legislação novo. A capacidade
nova (pré-vínculo N:M compromisso↔documento, criável/editável a qualquer
momento antes do pagamento) é **distinta** de `documento_origem_id`
(`CONTAI-065`: único, imutável, só na criação) — os dois convivem.

**(a) Texto que evita leitura de "custo comprovado"** — condição →
consequência: se o pré-vínculo aparece em qualquer tela (detalhe do
compromisso, detalhe da nota), carrega chip **neutro** (nunca vermelho, nunca
verde): **"Pré-vínculo — ainda não é custo"**, mais texto expandido:

> Detalhe do compromisso: "Você ligou este agendamento a [Nota nº X — R$
> valor][, Nota nº Y — R$ valor] antes de pagar. Isso é só uma intenção
> registrada: enquanto o pagamento não for confirmado, esse valor não entra no
> custo de aquisição, não abate a base do INSS e não aparece em nenhum
> relatório da declaração. Quando você confirmar o pagamento, o sistema vai te
> perguntar se este vínculo ainda vale."
>
> Detalhe da nota: "[Favorecido] — previsto R$ valor para DD/MM/AAAA está
> pré-ligado a esta nota, mas nenhum pagamento aconteceu ainda. Esta nota
> continua sem pagamento vinculado até que um pagamento de verdade seja
> confirmado e ligado a ela — ela segue contando em 'Notas hábeis sem
> pagamento vinculado'."

Evitar a palavra "vínculo" desqualificada de propósito (colapsaria intenção
com fato). Confirma que o precedente do `CONTAI-072` (pré-vínculo muda
texto/CTA, nunca o número) vale aqui também.

**(b) Verbo da conversão** — condição → consequência: se o compromisso
pré-ligado é confirmado como pago, a tela **revalida e pede confirmação
explícita** (pré-preenchida com os documentos já pré-ligados). **Nunca**
automática/silenciosa, **nunca** recusa. Doutrina "na dúvida, o mais duro"
aplicada entre revalidar/avisar/marcar/recusar: descartou **recusar**
(violaria "nunca recuse fato consumado", §4 do parecer de 18/08) e descartou
**silenciar** (herdar sem toque). Ficou com **revalidar + avisar + confirmar**,
mesmo princípio que já rege a sugestão de quitação (§C.d: "não pode existir
caminho de código que grave a quitação sem ato humano explícito") — reforçado
aqui porque o pré-vínculo foi declarado contra o **previsto**, e a confirmação
acontece sobre o **executado**, que diverge rotineiramente (desconto, parcial,
encargo — §3/§F). Com N:M o risco cresce: o valor pago pode não bater 1:1 com
nenhuma pré-ligação isolada (o caso do concreto), e confirmar automaticamente
exigiria o app decidir sozinho como ratear — vínculo por heurística com outro
nome. Texto sugerido:

> "Confirmar este pagamento também confirma o vínculo com [Nota nº X — R$
> valor][, Nota nº Y — R$ valor], como você já tinha indicado?"
> `[ Sim, confirmar os vínculos ]`  `[ Revisar antes de confirmar ]`

**(c) Restrição de soma** — condição → consequência: se o compromisso/nota
ainda não foi confirmado como pago, **não há teto nenhum** — pré-vínculo é
livre em qualquer direção (uma nota pré-ligada por vários compromissos, um
compromisso pré-ligado a várias notas, soma podendo exceder qualquer um dos
valores), porque nenhum dos dois lados é custo ainda. Se o pagamento é
confirmado e o pré-vínculo vira `pagamento_documento` formal, passa a valer o
**mesmo teto já em produção**: `min(Σ pagamentos elegíveis, Σ documentos
hábeis)` por conjunto conexo (§3 do parecer de 17/08 + ADENDO de repartição
cronológica + ADENDO 2026-09-28 do `CONTAI-074`) — nenhuma fórmula nova: o
pagamento confirmado entra como nó, os pré-vínculos confirmados viram arestas,
`alocarCusto` recalcula. O `contador` sugere (não decide, é produto) um aviso
não-bloqueante quando a soma pré-ligada estourar muito o previsto/valor da
nota — mesmo padrão do aviso de cobertura prévia do `CONTAI-074`, nunca
bloqueio.

**Divisão automático × humano (fixada pelo `contador`)**:
- **Sistema sozinho**: gravar pré-vínculo sem exigir anexo novo; mantê-lo fora
  de toda soma e fora do grafo de `alocarCusto`; manter a nota em "sem
  pagamento vinculado"; pré-preencher a tela de confirmação; recalcular o teto
  na conversão.
- **Só o Mateus**: confirmar no ato do pagamento que o pré-vínculo declarado
  antes ainda corresponde ao desembolso real — o clique nunca é dispensável.

## User story (preliminar — mecanismo e tela ficam para `/tickets-req`)

> Como Mateus, gerenciando a obra em casa e sentado (cenário principal), quando
> eu agendar ou revisar um compromisso em aberto cujo fornecedor eu já sei a
> quais notas fiscais ele se refere (ex.: parcelas de concreto sem
> correspondência 1-para-1), eu quero declarar esse vínculo antecipadamente,
> para não ter que procurar a nota de novo quando o pagamento for confirmado —
> sem que essa declaração conte como custo comprovado antes da hora.

**Critérios de aceite preliminares** (amarrados às saídas do sistema; o
mecanismo exato de gravação e a tela ficam para `cto-obra`/`designer`):

1. É possível declarar um pré-vínculo entre um compromisso "Em aberto" e uma
   ou mais notas fiscais (N:M), a partir de `/compromisso/[id]` ou de onde o
   `designer` desenhar — ponto de entrada explícito, hoje não existe nenhum
   (as opções atuais são só "Ver a fatura"/"Mudou a data"/"Corrigir o valor
   previsto"/"Marcar que não vai ser pago").
2. Enquanto o compromisso não for confirmado como pago, o pré-vínculo **não**
   aparece em: soma de custo de aquisição, base de aferição INSS,
   discriminação anual, Pagamentos Efetuados, nem no grafo de `alocarCusto`.
   Verificável comparando o resumo/discriminação antes e depois de criar um
   pré-vínculo — número não muda.
3. A nota pré-ligada continua aparecendo em "Notas hábeis sem pagamento
   vinculado" até que um pagamento de verdade seja confirmado e ligado a ela
   (mesma régua fixada para o caso 1:1 no `CONTAI-072`).
4. Qualquer tela que exiba o pré-vínculo usa o chip neutro "Pré-vínculo —
   ainda não é custo" e o texto fixado pelo `contador` (verbatim, não
   reescrito) — nunca cor de sucesso (verde) nem de risco (vermelho/âmbar de
   pendência fiscal real).
5. Não há restrição de soma para pré-vínculos (uma nota pode ser pré-ligada
   por vários compromissos futuros, um compromisso pode ser pré-ligado a
   várias notas, mesmo somando mais que o valor de qualquer um dos lados).
6. No momento em que o compromisso é confirmado como pago (fluxo existente de
   confirmação de fatura/pagamento), o sistema apresenta os pré-vínculos
   declarados e pede confirmação explícita — nunca converte
   automática/silenciosamente, nunca recusa o pagamento por causa do
   pré-vínculo. Texto da tela de confirmação: verbatim do parecer (seção
   acima).
7. Só após essa confirmação explícita os pré-vínculos viram linhas de
   `pagamento_documento`, sujeitas ao mesmo teto `min(Σ pagamentos elegíveis,
   Σ documentos hábeis)` por componente conexo já em produção — sem fórmula
   nova.
8. Um pré-vínculo pode ser criado, revisto e (presumivelmente) desfeito a
   qualquer momento antes da confirmação de pagamento — diferente de
   `documento_origem_id`, que é imutável após a criação; o mecanismo exato
   fica para `cto-obra`.

## Priorização

**P1 — fricção de processo.** Confirmado: não é obrigação fiscal (nenhum
documento hábil deixa de existir sem isso, nenhuma multa nasce daqui — o
`contador` foi explícito: "nada aqui exige CRC"), mas nasce direto de uma dor
que já produziu um P1/M entregue (`CONTAI-074`) no mesmo fornecedor real, e
evita repetir o mesmo trabalho de busca de nota que gerou aquele ticket.

## O que fica de fora, e por quê

- **Mecanismo técnico exato (schema, migration, tela)** — trabalho do
  `cto-obra` e do `designer` no `/tickets-req`, não decidido aqui.
- **Rateio automático de pagamento parcial entre múltiplas pré-ligações** —
  fora de escopo por desenho: o `contador` (b) foi explícito que confirmação
  automática "exigiria o app decidir sozinho como ratear — vínculo por
  heurística com outro nome". Fica sempre com o Mateus, no ato da confirmação.
- **Aviso não-bloqueante de estouro de soma pré-ligada** — o `contador` sugere,
  mas não decide (é produto); vira pergunta de escopo para o `cto-obra`/`po`
  no `/tickets-req`, não critério de aceite obrigatório agora.

## 🔓 Pergunta em aberto, aberta no Gate 2 do `CONTAI-080` (2026-09-28)

**Para o `po` e o `designer` — não decidida, e não bloqueia o `CONTAI-080`.**

`quitarCompromisso` tem **dois** chamadores: a tela
`/compromisso/[id]/confirmar` e a **sugestão de quitação rápida**
(`app/_components/quitacao.tsx`, o card "Este pagamento quita o agendamento
de…?" do §C, que aparece no detalhe de um pagamento já gravado).

O `CONTAI-080` implementa o bloco de revalidação do §J.3 (ADENDO 6) **só na
primeira**. Pela segunda, um compromisso com N ≥ 2 é quitado e **nada é
convertido** em `pagamento_documento` — nem a nota de origem: a união inteira
fica pré-marcada em `/pagamento/[id]/ligar` (critério 13), a um clique de
fechar.

**Isso foi APROVADO como correto pelo Gate 2** (`cto-obra` + `contador`), não
tolerado como dívida: o ADENDO 7 §K.2 exige confirmação explícita para N ≥ 2, e
aquele componente **não tem onde perguntar** — inventar um bloco de revalidação
dentro dele seria desenho sem spec. Travado por teste em
`e2e/pre-vinculo.spec.ts` ("N≥2 pela SUGESTÃO RÁPIDA"), para que ninguém
"otimize" o caminho e reintroduza a conversão de meio conjunto em silêncio.

**A pergunta que sobra, de produto**: a `SugestaoQuitacao` merece o bloco §J.3
próprio, para fechar os vínculos de N ≥ 2 sem sair da tela? Hoje o caminho existe
e é curto (dois cliques, com o estado todo preservado), mas é um passo a mais que
o fluxo de `confirmar` não tem — e quem usa a sugestão rápida está justamente no
modo "responder rápido". Registrada também no `docs/tickets/CONTAI-080.md`, em
"Comportamento nomeado".

## Sem perguntas de esclarecimento ao Mateus

As 3 perguntas técnicas foram todas ao `contador` (Gate Fiscal acima). O que
resta (onde a tela vive exatamente, se há desfazer, nome de campo) é trabalho
do `cto-obra`/`designer` no `/tickets-req`, não lacuna de relato.

**Pronto para `/tickets-req`.** Nenhum ticket numerado ainda — este relato só
fecha o Gate Fiscal e prioriza; a materialização em `CONTAI-0NN` acontece no
próximo passo do pipeline.
