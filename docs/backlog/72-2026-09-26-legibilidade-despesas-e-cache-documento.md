# Achado em produção pós-CONTAI-056: total por linha em Despesas e cache velho do shell — 2026-09-26

## Contexto do relato

Mateus testou o `CONTAI-056` (correção da soma pagamento+retenção como custo
comprovado) direto em produção e trouxe duas observações no mesmo relato.
Investigação técnica desta sessão (não repetida aqui, só citada): a Home já
soma certo desde o `CONTAI-056`; os dois problemas reais são (1) legibilidade
de uma célula específica em Despesas e (2) o `ProvedorDeGestao`
(`app/_components/gestao.tsx`) nunca revalida depois de uma mutação feita em
qualquer subrota de `app/(gestao)/documento/[id]/*` — confirmado por leitura
de código: `documento/[id]/page.tsx` define seu próprio `tentarDeNovo` local
(linha ~351) e nunca importa `useGestao`, então nenhuma mutação lá (ligar,
desligar, corrigir valor/classificação/emitente, cnpj-errado, outro-dado)
invalida o contexto que a Home e Despesas leem.

## Dores extraídas (citação do relato)

1. **"o valor total na visão geral é diferente se somar todas as despesas"**
   — o Mateus bateu o olho na tabela de Despesas, somou de cabeça a coluna
   "Valor" de várias linhas, e o total não bateu com o KPI da Home. A Home
   está certa (soma pagamento + retenção); a tabela nunca soma nada, por
   design deliberado do `CONTAI-005` (comentário no topo de
   `despesas/page.tsx`). A dor real, uma vez investigada, não é "os números
   discordam" — é que a coluna de maior destaque visual de uma linha (o
   "Valor" do pagamento, negrito grande) não é o número que virou custo de
   aquisição comprovado daquela nota desde o `CONTAI-056`; o número certo
   (pagamento + retenção) mora só numa anotação pequena e cinza dentro da
   célula "Situação".

2. **"na despesa em si o valor atualizou imediatamente (...) mas no geral
   continuou contando, até que eu fiz o refresh da página, daí atualizou.
   Isso tem que melhorar."** — o Mateus mudou a config de imposto de "a
   empresa paga" para "eu pago" num documento (efeito: a retenção deixa de
   contar como custo, porque passa a exigir guia real em vez de vínculo ao
   CNO). A tela do próprio documento reagiu na hora; a Home/Despesas ficaram
   com o número velho até F5. Confirmado como bug sistêmico de cache, não
   específico de retenção: qualquer mutação nas subrotas de
   `documento/[id]/*` tem o mesmo problema, só ficou visível agora porque
   antes retenção nunca influenciava total nenhum.

## Consulta ao `contador` (Dor 1)

Pergunta feita: existe regra fiscal ou de apresentação que exija que o valor
exibido por documento, numa tela de gestão, bata visualmente com o custo de
aquisição comprovado daquele documento?

**Veredito: não é regra fiscal — decisão de UX/produto, sem Gate Fiscal.**
Citação do parecer:

> "Não existe, em IN 84/2001, em prática de escrituração ou em qualquer norma
> que eu conheça, uma terceira exigência de que uma tela interna de gestão
> apresente, por linha, um número visualmente proeminente que já seja o
> total comprovado daquele item. A lei regula o que vai para o Fisco (a
> discriminação) e o que sustenta o gasto (o documento) — não regula layout
> de software de controle pessoal."

O contador registrou risco, não regra (citado porque orienta o critério de
aceite abaixo, sem virar obrigação fiscal): *"o desenho atual (...) induz
sistematicamente o próprio usuário a somar de cabeça um número que não é o
custo de aquisição (...) o risco não é 'a tela está feia' — é 'o usuário
confia na leitura errada e monta a discriminação anual de cabeça, fora do
sistema, errado'"*. Recomendação **não vinculante**: rotular a coluna hoje
chamada "Valor" de forma que não sugira "total da nota" (ex.: "Valor pago"),
e dar ao total comprovado (pagamento + retenção) peso visual mais próximo do
que a anotação cinza tem hoje. Fica a critério do `po`/`designer`.

## Classificação

- **Dor 1 — P1 (fricção/legibilidade), não P0.** Confirmado pelo `contador`:
  o cálculo agregado (Home) e a discriminação anual já estão corretos e são
  a fonte que importa para a DAA; a tabela de Despesas não precisa bater
  visualmente linha a linha para ser fiscalmente válida. Vira story de
  hierarquia visual, não de cálculo.
- **Dor 2 — P1 (fricção de processo, sistêmica).** Não é obrigação fiscal
  isolada — o dado gravado no banco está sempre correto, o que fica velho é
  a leitura em tela até F5. Mas é fricção de processo real e ampla (afeta
  qualquer mutação nas seis subrotas de `documento/[id]/*`, não só
  `quem_recolhe`) num produto cujo objetivo central é o usuário confiar no
  número que vê sem precisar adivinhar se está atualizado.

## Decisão: DOIS tickets, não um

As duas dores nasceram do mesmo teste manual, mas são causas técnicas
independentes e devem virar tickets separados:

- **Dor 1** é composição visual de uma célula/coluna específica em
  `despesas/page.tsx` — mudança pequena, local, sem tocar em cálculo, sem
  tocar em estado.
- **Dor 2** é arquitetura de cache/revalidação do `ProvedorDeGestao`
  (`app/_components/gestao.tsx`) — genérica, cruza seis subrotas que hoje
  cada uma mantém seu próprio estado local (`page.tsx` e as de `obra`,
  `ligar`, `desligar`, `corrigir/*`, `cnpj-errado`, `outro-dado`), e a
  correção correta provavelmente envolve uma decisão do `cto-obra` (revalidar
  o contexto ao montar cada subrota, invalidar cache compartilhado a cada
  mutação bem-sucedida, ou trocar o padrão de data-fetching) — não é decisão
  que o `po` deva fechar sozinho.

Amarrar as duas ao mesmo ticket forçaria o `lead-engineer` a decidir
arquitetura de cache e composição visual na mesma revisão, e um reviewer
(`cto-obra`) a aprovar os dois de uma vez — quando só um dos dois é dele.
Também travaria a entrega de uma pela outra sem necessidade: a Dor 1 pode
sair sem esperar decisão de arquitetura nenhuma.

## User stories

### US-A (P1) — Total comprovado legível por linha em Despesas

Como dono da obra revisando Despesas **em casa, sentado** (cenário principal
de gestão), quando uma nota tem retenção qualificada contando como parte do
custo (a linha mostra o chip "Quitado por retenção"), quero identificar sem
somar de cabeça qual é o custo de aquisição comprovado total daquela nota
(pagamento + retenção), para não montar uma leitura errada do que já foi
gasto.

**Critério de aceite verificável:**
- Em qualquer linha onde o custo comprovado do documento (pagamento +
  retenção) seja maior que o valor do pagamento isolado, a tela comunica
  qual dos dois números é o custo de aquisição comprovado sem depender de
  soma manual — por rótulo, ênfase tipográfica, ou os dois (a implementação
  concreta é do `designer`/`lead-engineer`; o contador não fixou uma forma).
- Teste de render (Vitest) cobre o caso: documento com retenção contabilizada
  como perna de custo produz saída onde o valor total comprovado é
  identificável programaticamente (atributo/rótulo próprio), não apenas
  presente como texto solto de mesma classe CSS que qualquer anotação.
- Nenhuma mudança em `lib/fiscal/despesas.ts` nem em `lib/fiscal/vinculo.ts`
  — é composição visual, o cálculo já está certo desde o `CONTAI-056`.
- Texto novo de tela que mencione custo comprovado/retenção continua citando
  o parecer 2026-09-18 (ADENDO 2/3) e o `CONTAI-056`, nunca reescrevendo a
  regra por conta própria.

**Dependência**: recomendo passagem leve por `/design` (nível 1 — é
hierarquia visual de um dado com peso fiscal, mesma cautela do resto do
produto com texto de consequência fiscal), não bloqueante para o Gate 0
começar.

### US-B (P1) — Shell de gestão reflete mutação feita em `documento/[id]/*` sem F5

Como dono da obra corrigindo ou respondendo uma pergunta pendente num
documento (`quem_recolhe`, ligar/desligar vínculo, corrigir valor,
classificação, emitente, CNPJ errado, outro dado), quero que a Home e
Despesas mostrem o efeito dessa mutação assim que eu navegar de volta para
lá, sem precisar recarregar a página, para confiar que o número que vejo é
o número atual.

**Critério de aceite verificável:**
- Depois de uma mutação em qualquer subrota de `documento/[id]/*` que altere
  um total agregado (ex.: responder `quem_recolhe`, mudar config de imposto,
  corrigir valor), navegar via link do app (sem F5) para `/` ou `/despesas`
  mostra o KPI/linha já atualizado.
- Teste E2E (Playwright) cobre pelo menos o caso do relato: mudar a
  configuração de imposto de um documento e, sem reload, conferir que o KPI
  de custo comprovado da Home mudou.
- A correção é arquitetural, não pontual a `quem_recolhe`: cobre as seis
  subrotas de `documento/[id]/*` que hoje mantêm estado próprio, não só a
  que motivou o relato.
- Não reintroduz soma nenhuma em `despesas/page.tsx` (continua valendo a
  doutrina "nenhuma soma em tela" do `CONTAI-005`) — o que muda é a
  atualidade do dado que a Home já soma, não onde a soma acontece.

**Dependência**: decisão técnica do `cto-obra` sobre o mecanismo (revalidar
`ProvedorDeGestao` ao montar cada subrota, invalidar por evento de mutação,
ou outro padrão) antes de virar ticket fechado pelo `/tickets-req` — é
arquitetura, não requisito de produto que o `po` deva prescrever.

## Filtro de escopo — o que ficou de fora e por quê

- **Redesenhar a tabela de Despesas inteira** — fora. US-A é só a
  composição da célula/coluna afetada; o resto do desenho (`CONTAI-041`)
  está fechado e não tem dor relatada.
- **Migrar o app para uma biblioteca de data-fetching (SWR/React Query)** —
  citado como possibilidade técnica, mas é decisão de arquitetura de maior
  porte que o `cto-obra` deve avaliar, não algo que este relato justifique
  sozinho. Fica como contexto para a triagem de US-B, não como requisito.
- **Somar valores em tela** — continua fora por doutrina do `CONTAI-005`; a
  US-A não reabre essa porta, só muda ênfase visual de um número que já
  existe por linha.

## Perguntas abertas

1. US-A: a recomendação do contador foi não vinculante — relabel de "Valor"
   (ex. "Valor pago") + mais peso visual ao total comprovado. Confirma essa
   direção, ou prefere manter o rótulo "Valor" como está e só reforçar
   visualmente a anotação de retenção, sem mexer no cabeçalho da coluna?
2. US-B: a correção deve cobrir as seis subrotas de `documento/[id]/*` de
   uma vez, ou prioriza primeiro só as que mexem em total exibido
   (`quem_recolhe`/config de imposto, corrigir valor, ligar/desligar) e
   deixa as que não afetam total (anexar, corrigir emitente/CNPJ) para
   depois?
3. Confirma que Dor 2 vira ticket de infraestrutura próprio, passando por
   revisão de arquitetura do `cto-obra` antes de fechar como pronto para
   `/develop` — em vez de ser amarrado ao ticket de retenção?
