# CONTAI-005 — spec do mock
Nível: 1 (HTML navegável)   Cenário: gestão (casa, sentado; 375px = piso)   Arquivo: CONTAI-005.html
Telas: 1 phone com 2 estados (cheio / zero) — SÓ o card que muda, não a home inteira
Status: v1 AGUARDANDO APROVAÇÃO

## Por que nível 1, e não 2
A composição inteira mudou (4 moedas somadas → 2, com decomposição nova, obrigatória e sempre visível) e
nasce um card de INSS separado com hierarquia própria (chip "não soma", número em base, frase de fechamento
que impede o leitor de somar de cabeça) mais uma linha nova no card de boleto. É pergunta de densidade e
ordem de leitura — "o total nunca aparece sem decomposição" só se avalia vendo o bloco inteiro junto, não
lendo cada frase isolada. Na dúvida, o orquestrador pediu para subir; subi.

## Achado do grep pedido no enunciado
`status = 'conciliado'` **já é gravado em produção** desde o CONTAI-018 (`lib/data.ts:1219`,
`.update({ status: "conciliado" })`). Mas isso não é o que decide o zero: `lib/fiscal/resumo.ts` (linha 10)
diz explicitamente que `pagamento.status` **não é consultado por decisão de custo nenhuma** — o cálculo
inteiro vem de `alocarCusto()` em `lib/fiscal/vinculo.ts`, que decide por vínculo `pagamento_documento`
explícito, não pelo status gravado. **"Custo confirmado R$ 0,00" deixou de ser estruturalmente garantido**
(depende de existir vínculo, não de existir status) — e a ressalva do R5 já está em produção, com texto
diferente do que o ticket sugeria: `EXPLICACAO_CUSTO_ZERO` (`lib/fiscal/vinculo.ts:52-55`), renderizada em
`app/page.tsx:208-213` quando `custoConfirmadoAnoCentavos === 0 && temRegistro`. **R5 já está coberto por
código que não é deste ticket** — o card novo não precisa repetir a ressalva.

## Telas e estados
- **Card "Custo em risco no IR"** (novo, substitui a linha "Em pendência: R$ X — resolver abaixo" que hoje
  vive dentro do card de "Custo confirmado", `app/page.tsx:290-298`). Passa a ser **card próprio**, logo
  abaixo do card de "Custo confirmado" — o texto de Bloco 1 não cabe como linha secundária sem quebrar a
  regra R4 (decomposição sempre visível junto do total)
  - **Cheio**: headline + explicação + decomposição + linha de imposto (`Consequencia cor="amb"`)
  - **Zero**: número em verde, uma linha de confirmação, **sem** decomposição (nada a decompor) e **sem**
    linha de imposto (15% de zero não informa nada). Card continua aparecendo — não é condicional por
    `length > 0` como os outros blocos, porque "zero risco de IR" não é o mesmo fato que "zero pendência":
    pode haver boleto ou "sem retenção" pendentes e mesmo assim nenhum risco de IR
- **Card "Aferição do INSS — CNO [nº]"** (novo, agregado da obra/CNO — não é mais um card por documento).
  Só aparece com exposição > 0 (mesma regra condicional de "Notas hábeis sem pagamento",
  `app/page.tsx:320`). Estado zero: **não desenhado** — segue o precedente já em produção
- **Card de boleto** (existente, `app/page.tsx` bloco de pendências / mock CONTAI-001.html linha
  112-117): ganha **uma linha nova**, as duas de cima continuam intactas

## Textos com consequência fiscal — copiados do parecer, não redigidos
Fonte: `docs/pareceres/2026-08-16-gate-fiscal-contai-004-005.md`, §4, Blocos 1-3.
- Bloco 1 (headline): "Custo em risco no IR · [nome da obra]" / "R$ 49.850" / "Gastos desta obra que hoje
  não entram no custo de aquisição — falta documento hábil no seu CPF." / "Composto de: R$ 45.000 pagos sem
  nota · R$ 4.850 em nota fora do seu CPF." / "Pode custar até R$ 7.478 a mais de imposto na venda (15%
  sobre o valor em risco; o fator de redução por tempo de posse e as isenções podem diminuir)."
- Bloco 2 (INSS): "Aferição do INSS — CNO [nº] · outra apuração, não soma com a de cima" / "R$ 18.000 em
  notas de serviço que não abatem a base da aferição desta obra." / "Isso não é imposto a pagar nem custo
  perdido: é base que deixa de ser reduzida. O valor em reais só existe quando a aferição for calculada." /
  **"Estas notas continuam valendo integralmente como custo de aquisição no IRPF."** — frase NÃO opcional
  (R2), é ela que impede somar 18.000 aos 49.850 de cabeça
- Bloco 3 (boleto, só a última linha é nova): "...Boleto não é documento hábil. O custo só se sustenta com
  a NF." + **"Não entra no total acima: enquanto não for pago, não houve dispêndio."**
- **Texto do estado zero do card de risco NÃO está no parecer** (ele só cobre o cenário com exposição).
  Proposto por mim: "Nenhum gasto desta obra está sem documento hábil no seu CPF, hoje." — **pergunta aberta
  ao `contador`**, não é cópia literal de nada.

## Campos
Nenhum — tela é só leitura (cenário de gestão, sem captura). Nenhum input novo.

## Navegação
Sem navegação nova. O card de risco não tem CTA próprio — a ação continua nos cards individuais de
pendência (Quarentena / Pago sem nota) que ficam abaixo, inalterados. O card de INSS não tem CTA (é
informativo/agregado); o detalhe por documento continua nos cards "Sem retenção 11%" existentes.

## Decisões de design
1. **Card de risco vira independente**, não linha dentro do card de "Custo confirmado" — R4 exige a
   decomposição sempre junto do total, e o texto completo (headline + composição + imposto) não cabe como
   linha secundária sem competir visualmente com o número principal do card de cima.
2. **INSS é card agregado da obra/CNO, não mais um card por documento.** Os cards "Sem retenção 11%" por
   documento continuam existindo mais abaixo (ação/detalhe); o card novo é o resumo que a Parte B(a) do
   ticket pede ("dois campos novos em ResumoObra"), condição pré-existente no código para blocos agregados
   (`notasSemPagamento` já segue este padrão).
3. **Estado zero do card de risco não desaparece** (ao contrário do INSS e de "Notas sem pagamento") —
   porque zero risco de IR não implica zero pendência (boleto/INSS podem seguir pendentes). Sumir o card
   inteiro esconderia a confirmação de que aquele risco específico está zerado.
4. **Ordem de leitura**: Custo confirmado → Custo em risco no IR (quanto + composição + imposto) → INSS
   (separado, não soma) → [resto da home, inalterado] → card de boleto (fora do total) — segue a ordem que
   o parecer usa nos Blocos 1→2→3 e a que o enunciado do ticket pediu.

## Perguntas abertas
1. **Texto do estado zero do card de risco** ("Nenhum gasto desta obra está sem documento hábil no seu
   CPF, hoje.") não vem do parecer — precisa de confirmação do `contador` antes de virar constante.
2. **Obra sem CNO**: o parecer diz que a linha do INSS "cede lugar ao texto de 2026-08-09, item 4" — isso já
   está implementado (`PendenciaCno`, existente); não desenhei essa variante aqui porque não muda com este
   ticket. Confirmar com `po`/`cto-obra` que não há sobreposição a resolver entre os dois blocos quando a
   obra ainda não tem CNO.
3. **Posição exata do card de risco na pilha da home** — propus logo abaixo de "Custo confirmado" e acima
   de "Notas hábeis sem pagamento"; não há requisito escrito fixando essa ordem. Se o Mateus preferir mais
   perto da lista de "Pendências" (mais abaixo, mais perto da ação), é mudança de posição, não de texto.
