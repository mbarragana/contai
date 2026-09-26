# Achado em produção pós-CONTAI-056/057/058: texto do banner de retenção e escopo de ano em Despesas — 2026-09-26

## Contexto do relato

Mateus testou os últimos entregáveis (`CONTAI-056`/`057`/`058`) direto em
produção e trouxe duas observações, com print de tela na primeira.

## Dores extraídas (citação do relato)

1. **"isso aqui não está correto, eu coloquei que quem deve pagar aquilo ali
   sou eu, logo, se sabe quem vai pagar, eu só não paguei ainda."** — reação
   ao banner vermelho *"Retenção descontada do pagamento sem confirmação de
   quem recolhe — se ninguém recolher, não é economia, é passivo não
   identificado."*, mostrado mesmo depois de ele já ter respondido "Eu" para
   "Quem recolhe isto?".

2. **"outra coisa, o somatório na visão geral ainda esta diferente se eu
   somar todas as despesas"** — o total da Home continua diferente da soma
   manual que ele faz na tabela de Despesas.

## Investigação técnica (não repetida aqui, só citada)

**Achado 1** — bug real de TEXTO, não de lógica nem de cálculo.
`lib/fiscal/retencao.ts:495-503` (`linhaSemRecolhedor`) já distingue
corretamente, na lógica, dois estados de pendência aberta:
- **Estado A** — `quem_recolhe` sem resposta útil (na prática sempre
  `"nao_sei"`: `null` com `e_desconto_efetivo=true` é estado inválido que o
  CHECK da migration `0017` não deixa persistir);
- **Estado C** — `quem_recolhe = "eu"` **e** a soma dos pagamentos vinculados
  à nota ainda não cobre o bruto (`notaCoberta=false`): já confirmado quem
  recolhe, falta a guia real ser paga.
(Um terceiro estado hipotético, `"empresa"` com nota não fechada, **não
existe** — `linhaSemRecolhedor` retorna `false` incondicionalmente para
`"empresa"`.) O texto `CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR`
(`lib/fiscal/retencao.ts:194-196`) é usado sem distinção nos dois estados em
`app/_components/retencao.tsx:382` — correto para A, errado para C (descreve
"sem confirmação de quem recolhe" quando quem recolhe já foi confirmado).

**Achado 2** — NÃO é bug de cálculo. `lib/fiscal/despesas.ts` e
`lib/fiscal/vinculo.ts` concordam matematicamente (mesma `Alocacao`, sem soma
duplicada). Causa real: `app/(gestao)/despesas/page.tsx` não tem filtro de
ano nenhum (confirmado por grep) — lista despesas de TODOS os anos da obra.
A Home mostra "Custo confirmado **em [ano]**"
(`custoConfirmadoAnoCentavos`, escopado por ano em `lib/fiscal/resumo.ts`).
Somar manualmente todas as linhas de Despesas (todos os anos) contra o KPI de
um ano específico da Home diverge sempre que a obra tiver pagamento em mais
de um ano-calendário — e a obra cruza ~20 meses / pelo menos dois anos.

Existe uma dívida de produto já registrada sobre este tema:
`docs/backlog/48-2026-09-21-gate1-decisoes-contai-040.md` — "ticket futuro não
numerado: seletor de ano sincronizado dashboard + `/pendencias`", decidido em
2026-09-21. **Mas aquele ticket, na época, tinha escopo restrito a manter o
badge de contagem da sidebar e o dashboard sincronizados** (`/despesas` ainda
era stub). Este relato confirma que a lacuna se estende a `/despesas`, que
deixou de ser stub desde o `CONTAI-041`/`057` — **não é achado novo em
espécie, é a mesma dívida se materializando num lugar que na época não
existia ainda como superfície real.**

Nenhuma relação com o achado da entrada `72-2026-09-26-…md` (que tratou de
legibilidade de coluna e cache de revalidação, já resolvidos pelo `CONTAI-057`
e `CONTAI-058`, entregues no mesmo dia) — são causas técnicas totalmente
diferentes.

## Consulta ao `contador` — Achado 1

Perguntado: a distinção fiscal entre os estados está correta? Qual a
consequência real de cada um? Qual o texto que deve substituir o banner
genérico?

**Resultado: vira ADENDO 4 do parecer
`docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`** (parecer
completo lá, não repetido aqui). Veredito resumido:

- A distinção A/C está correta e já é a que o código implementa. Não há
  nuance real entre `null`/`"nao_sei"` (`null` nunca persiste com
  `e_desconto_efetivo=true`) nem existe o terceiro estado hipotético.
- **Estado A**: texto atual correto, sem alteração — o valor já conta como
  custo (regra do ADENDO 3), o risco é passivo civil/de terceiro (prestador
  cobrar de volta), não do custo de aquisição do Mateus.
- **Estado C**: consequência diferente do texto genérico — não é passivo não
  identificado (o responsável já é conhecido, é ele mesmo), é pendência de
  **fluxo de caixa**: enquanto a guia não for paga e vinculada, a fatia não
  conta como custo (regime de caixa, IN 84/2001 art. 17), mecânica normal, não
  ameaça por si só. Risco que o texto novo cobre e o atual não: se a guia
  nunca for paga, (a) a fatia fica fora do custo para sempre (infla ganho de
  capital futuro) e (b) se o tributo era devido, o valor retido vira dívida
  tributária vencida em nome do Mateus, com juros e multa (`[Guessing]`
  alíquota/tributo exato exigem CRC humano se a cobrança acontecer de fato).
- Texto novo (constante sugerida `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA`), citação
  literal, ver ADENDO 4: *"Você já confirmou que quem recolhe esta retenção é
  você — a pendência aqui não é de identificação, é de pagamento: enquanto a
  guia não for paga e vinculada a este documento, esta fatia não entra no
  custo de aquisição do ano nenhum. Se a guia nunca for paga, o efeito não é
  apenas essa fatia ficar fora do custo para sempre — o valor retido se torna
  dívida tributária vencida em seu nome, sujeita a juros e multa."*
- Recomendação técnica (não normativa): `linhaSemRecolhedor` passar a expor o
  motivo (`"sem_confirmacao" | "eu_sem_guia"`), não só `boolean`, para o
  componente escolher o texto certo — decisão do `cto-obra`/`lead-engineer`.

## Consulta ao `contador` — Achado 2

Perguntado: existe uso legítimo de "custo confirmado"/total sem escopo de ano,
ou é sempre leitura equivocada dado o regime de caixa por ano-calendário?

**Veredito: não é "sempre errado" nem "sempre por ano" — são DUAS grandezas
fiscalmente válidas, uma terceira não é.** Citação-chave: a ficha Bens e
Direitos é cumulativa por construção ("Situação em 31/12" = situação do ano
anterior + gastos pagos no ano corrente); não existe campo "gasto do ano"
isolado na DAA, é um componente do cálculo, não o que se declara.

- **Delta do ano** (`custoConfirmadoAnoCentavos`, já existe): quanto foi pago
  NUM ano — regime de caixa se aplica aqui, sem data no ano não entra.
- **Acumulado até uma data** (`acumuladoImovelCentavos`, já existe): quanto o
  imóvel vale na ficha até 31/12 de um ano — uso legítimo e nomeado (conferir
  contra a "Situação em 31/12" de uma declaração específica; base do ganho de
  capital na venda, que é sempre sobre o custo total, não o custo do ano da
  venda).
- **O que NÃO tem significado fiscal**: somar tudo sem filtro nenhum,
  incluindo pagamentos sem data — isso não é "acumulado até 31/12 de X", é
  "tudo que existe na tabela hoje", que mistura anos sem ninguém saber até
  quando. Pagamento sem data é **pendência de captura** (falta o campo data),
  não uma segunda visão fiscal válida, e não deveria entrar silenciosamente em
  nenhum total lido como confiável.

Conclusão do contador para o requisito de produto: `/despesas` deve ter
**default = ano-calendário selecionado** (mesmo seletor de ano da Home, ainda
não implementado — fecha a lacuna do `48-…`), com uma **visão acumulada
opcional e explicitamente rotulada** ("acumulado da obra até [data]",
espelhando o padrão que `acumuladoImovelCentavos` já usa na Home) — nunca como
default silencioso, e nunca uma terceira leitura sem corte temporal declarado.

## Classificação

- **Achado 1 — P1 (fricção/confiança), não P0.** O cálculo de custo já está
  certo desde o `CONTAI-056`/ADENDO 3; isto é bug de texto que descreve mal um
  estado real, mas não gera erro de apuração nem de documentação hábil por si
  só — o dado gravado é o correto, o que engana é a leitura. Ainda assim, é
  texto de consequência fiscal errado sendo mostrado ao usuário, o que pesa
  contra deixar para "depois": vira story própria, não conveniência.
- **Achado 2 — P1 (fricção de processo), não P0.** Nenhum documento fica sem
  checagem por isso; o sinal fiscal que importa (discriminação anual) já está
  correto. Mas é a mesma classe de dívida do `48-…` (P1) se manifestando em
  produção, confirmando que precisa ser paga antes que a obra feche mais um
  ano-calendário.

## Decisão: DOIS tickets, não um

Causas técnicas totalmente diferentes, sem dependência real entre si:

- **Achado 1** é composição de texto condicional num componente já existente
  (`app/_components/retencao.tsx`), amarrada a uma constante nova em
  `lib/fiscal/retencao.ts` — sem tocar em modelo de dado, sem tocar em cálculo.
- **Achado 2** é adicionar um controle de ano funcional a uma tela que hoje
  não tem nenhum, sincronizado com o mesmo estado que a Home e (pelo `48-…`)
  `/pendencias` deveriam usar — toca em três telas e no contrato de estado
  compartilhado do `ProvedorDeGestao`, é escopo bem maior que o achado 1 e
  fecha, de vez, o ticket "não numerado" que está em aberto desde 21/09.

Amarrar os dois forçaria um Gate Fiscal (achado 1, texto de consequência) e um
Gate técnico maior (achado 2, estado compartilhado entre 3 telas) na mesma
revisão, sem nenhum ganho — e travaria a entrega do texto (rápida, sem
dependência) pela do seletor de ano (mais lenta, depende de decisão do
`cto-obra` sobre onde mora o estado do ano selecionado).

## User stories

### US-A (P1) — Texto do banner de retenção reflete o estado real, não um genérico reaproveitado

Como dono da obra revisando uma linha de retenção **em casa, sentado**, ao
confirmar "Eu" para "Quem recolhe isto?" quando a guia ainda não foi paga,
quero ver um texto que diga corretamente que a pendência é de PAGAMENTO da
guia (não de identificação de quem recolhe), para não desconfiar de um número
que já registrei certo.

**Critério de aceite verificável:**
- Quando `quem_recolhe = "eu"` e `notaCoberta = false`, a tela mostra o texto
  do ADENDO 4 (`CONSEQUENCIA_RETENCAO_EU_SEM_GUIA`), citado literalmente do
  parecer, nunca parafraseado.
- Quando `quem_recolhe` está sem resposta útil (`"nao_sei"`/pendente), a tela
  continua mostrando `CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR`, sem alteração.
- Teste unitário (Vitest) cobre os dois estados: dado o mesmo componente,
  input com `quem_recolhe="eu"` + `notaCoberta=false` produz o texto novo;
  input com `quem_recolhe="nao_sei"` produz o texto antigo. Nenhum teste novo
  precisa cobrir `quem_recolhe=null` com `e_desconto_efetivo=true` — a
  migration `0017` já impede esse estado de existir persistido.
- Nenhuma mudança em `retencaoContaComoPerna`/`alocarCusto` — critério de
  aceite trava que o valor do custo de aquisição não muda com este ticket.
- Gate Fiscal: revisão do `contador` confirma que o texto em produção é
  cópia literal do ADENDO 4, não reescrita.

### US-B (P1) — `/despesas` tem escopo de ano explícito e sincronizado

Como dono da obra revisando Despesas **em casa, sentado**, quero que a tabela
mostre por padrão as despesas de um ano-calendário específico (o mesmo que a
Home mostra) e, se eu quiser ver o total acumulado da obra inteira, quero que
isso seja uma visão separada e claramente rotulada, para poder somar de
cabeça sem comparar grandezas diferentes por engano.

**Critério de aceite verificável:**
- `/despesas` tem um controle de ano funcional (não texto decorativo), com o
  mesmo estado de ano que o dashboard (fecha a dívida do
  `48-2026-09-21-gate1-decisoes-contai-040.md` também para esta tela, não só
  para `/pendencias`).
- Ano-default = ano corrente (ou o último ano com movimento, a decidir pelo
  `designer` dentro do padrão que a Home já usa) — nunca "todos os anos"
  silenciosamente.
- Se existir visão de "acumulado da obra até [data]", ela é uma escolha
  explícita do usuário (aba, toggle ou filtro dedicado — forma é do
  `designer`), rotulada de forma que não permita confundi-la com "despesas
  do ano".
- Pagamento sem data de pagamento registrada não entra silenciosamente em
  nenhum dos dois totais mostrados como "confiável" — aparece separado ou
  como pendência de dado (o rótulo/local exato é do `designer`, ancorado
  neste critério).
- Teste (Vitest/Playwright) cobre: trocar o ano no seletor da Home reflete o
  mesmo ano em `/despesas` (e vice-versa, se a interação permitir trocar dos
  dois lados).

**Dependência**: decisão técnica do `cto-obra` sobre onde mora o estado do
ano compartilhado (contexto único consumido por Home/`/despesas`/`/pendencias`,
ou outro mecanismo) — é arquitetura, não requisito de produto que o `po` deva
prescrever. Recomendo passagem por `/design` (o `48-…` já apontava isso).

## Filtro de escopo — o que ficou de fora e por quê

- **Redesenhar `/despesas` além do escopo de ano** — fora. US-B só adiciona o
  controle de ano e a visão acumulada opcional; o resto da tela (`CONTAI-041`)
  está entregue e sem dor relatada.
- **Resolver a "nota de acompanhamento" do ADENDO 3 sobre custo caindo
  retroativamente quando `quem_recolhe` muda de `"nao_sei"` para `"eu"` depois
  do ano já declarado** — citada no ADENDO 3 como não bloqueante, sem story
  nova aqui: não foi o que o Mateus relatou desta vez, e já está nomeada
  como pendência de UX a cargo do `cto-obra` quando for priorizada.
- **Alertar sobre a consequência de "guia nunca paga" em algum outro lugar do
  produto (ex.: lembrete de calendário) além do texto do banner** — fica de
  fora por ora: o texto novo já comunica o risco no lugar onde a decisão
  acontece; lembrete ativo (Google Calendar) é hipótese de solução, não dor
  relatada, e abriria escopo (quando lembrar? com que antecedência?) que
  nenhum relato pediu ainda.
- **Mudar o cálculo de custo de aquisição** — fora dos dois achados: ambos
  são, respectivamente, texto e escopo de apresentação; nenhum toca em
  `lib/fiscal/vinculo.ts`/`lib/fiscal/despesas.ts`.

## Perguntas abertas

1. US-B: quando existir a visão "acumulado da obra até [data]", ela deve ficar
   dentro de `/despesas` (aba/toggle) ou como card adicional na Home, no
   mesmo padrão de `acumuladoImovelCentavos`? Decide o formato de superfície
   antes do `/design`.
2. US-B: o seletor de ano compartilhado deve nascer já cobrindo as três telas
   (Home, `/despesas`, `/pendencias`) de uma vez, ou entra primeiro só em
   Home+`/despesas` e `/pendencias` (que já tinha o requisito desde o `48-…`
   e ainda não foi feito) fica para depois? Isso decide se este ticket paga
   sozinho a dívida do `48-…` ou só parte dela.
3. US-A: o rótulo do card/seção ainda diz "Retenção sem recolhedor" — faz
   sentido revisar esse rótulo para o Estado C (onde o recolhedor já existe),
   ou o rótulo genérico do card é aceitável desde que o texto de dentro dele
   esteja certo? (Sugestão do próprio `contador`, não vinculante.)
