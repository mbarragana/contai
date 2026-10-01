# Relato — criador em lote de parcelas, 2026-09-30

## Relato (verbatim)

> "agora temos que fazer o parcelado verdadeiro. Porque hoje não é possível
> inserir pagamentos parcelados, eu tenho que adicionar cada parcela. isso é
> inviável."

## Contexto já investigado (não repetir)

- Não existe tela de criação em lote. Um `Compromisso` nasce um de cada vez,
  em `app/(captura)/adicionar/pagamento/page.tsx` (PIX/boleto com data
  futura, via `decidirRegistro`/`vaiAgendar`) ou
  `app/(captura)/adicionar/compra-cartao/page.tsx` (cartão, via RPC
  `compra_cartao_gravar`). Favorecido, CPF/CNPJ, valor, data e meio são
  preenchidos uma vez **por parcela**, sem atalho.
- Já existe recusa deliberada e correta de tratar a compra parcelada como UM
  evento fiscal só: `RECUSA_PARCELADO` (`lib/fiscal/fatura.ts:20-33`, ADENDO 5
  do parecer `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`,
  §I.1-I.3, texto carimbado pelo `contador` em 2026-09-19). Doutrina: cada
  parcela cai numa fatura diferente, e o ano do custo é o da fatura em que ela
  é paga — regime de caixa, não o ano da compra. **Essa doutrina não muda.**
- Caso real que motivou a fala: Ilhamix Concreto, 3 parcelas de R$15.000 no
  cartão (15/10, 15/11, 15/12/2026), criadas uma a uma manualmente — o mesmo
  caso que gerou o bug P0 do `CONTAI-083` (herança repetida de
  `documento_origem_id` entre as 3 parcelas, sem tela que desfizesse).
- Não existe no schema nenhum conceito de "série"/"lote"/"parcelamento"
  ligando compromissos relacionados (migrations 0007, 0022, 0023, 0025
  revisadas).

## Dor extraída

**D1 (única, citada acima).** Não é "o sistema recusa parcelado" — isso é
doutrina correta e intencional (ADENDO 5), e o Mateus não contestou isso em
nenhum momento. A dor é **o custo de digitação de criar N registros
fiscalmente independentes um a um**, repetindo favorecido/CPF-CNPJ/meio em
cada um — fricção que já provou ter consequência real: foi exatamente o
padrão de criação repetida e manual que abriu a janela para o bug de herança
do `CONTAI-083`.

Classificação: **P1 — fricção de processo**. Não é obrigação fiscal em si
(nenhum imposto ou multa se perde por não ter isso), mas é fricção que já
causou um incidente P0 e tende a se repetir — a obra tem outros fornecedores
de pagamento parcelado além do concreto (empreiteiro, por exemplo).

## Hipótese de framing aplicada

A feature é um **criador em lote**: o Mateus preenche favorecido, CPF/CNPJ e
meio de pagamento uma vez, declara número de parcelas (N≥2) + valor + data da
1ª parcela, e o sistema gera N `Compromisso` separados, com vencimentos
subsequentes — continuam sendo N registros fiscalmente independentes,
**nunca** um evento único. Avaliada contra o relato: bate. "Parcelado
verdadeiro" lido como "o app finalmente trata parcelamento como um padrão de
entrada reconhecido" (ergonomia de captura), não como pedido para reverter o
ADENDO 5 (ele nem é mencionado ou contestado no relato).

## User stories

### US1 (P1) — Criar N parcelas de uma vez

Como dono da obra, sentado em casa revisando ou agendando pagamentos, quando
eu for registrar uma compra ou acordo que já sei de antemão que será pago em
N parcelas, quero preencher os dados comuns (favorecido, CPF/CNPJ, meio,
valor da parcela, data da 1ª) uma única vez e deixar o sistema gerar os N
compromissos, para não repetir manualmente o mesmo cadastro N vezes.

**Critérios de aceite (preliminares — Gate Fiscal decide os detalhes
numerados abaixo):**
1. Ao confirmar o lote, a Agenda (`/compromisso` e a home) passa a exibir N
   compromissos distintos, cada um editável, cancelável e pagável
   independentemente — nenhuma fusão de registro.
2. Nenhuma parcela nasce com `documento_origem_id` preenchido
   automaticamente. Verificável por consulta: as N linhas criadas pelo lote
   têm `documento_origem_id is null`. Cada vínculo com nota continua sendo
   confirmação explícita, uma a uma, pela tela de pré-vínculo já existente
   (`CONTAI-080`/`081`).
3. Criação é tudo-ou-nada: se o Mateus sair no meio do preenchimento do lote
   antes de confirmar, nenhum compromisso parcial é gravado.
4. Cada parcela paga gera sua própria linha na ficha de Pagamentos Efetuados
   e entra na discriminação/custo do ano em que **ela** for efetivamente paga
   — nunca o ano da criação do lote (regime de caixa preservado,
   consistente com o ADENDO 5).

### US2 (P2, separada, não bloqueante) — Sinalizar que compromissos pertencem ao mesmo lote

Como dono da obra, quando eu olhar a Agenda e vir várias parcelas do mesmo
fornecedor, quero identificar visualmente que elas vieram do mesmo
parcelamento (ex. "parcela 2 de 3 — Ilhamix Concreto"), para não precisar
abrir cada uma para entender se são relacionadas.

**Critério de aceite preliminar**: a lista/agenda mostra a posição do item
dentro do lote de origem, sem impedir edição, cancelamento ou pagamento
individual de cada parcela, e sem criar vínculo fiscal entre elas. Toca
`montarAgendaDaHome`/`lib/fiscal/compromisso.ts` — fora do escopo imediato de
US1, candidata a ticket próprio depois.

## Filtro de escopo — o que fica de fora, e por quê

- **Fundir as N parcelas num evento fiscal único.** Permanece recusado. A
  doutrina do ADENDO 5 (`RECUSA_PARCELADO`) não é revisitada por este
  relato — o Mateus não pediu isso, e reverter mudaria o ano de custo de
  parcelas futuras, o que é um erro de regime de caixa, não uma melhoria.
- **Gestão de cronograma de obra / orçamento vs. realizado / comunicação com
  empreiteiro.** Fora de escopo declarado do produto (`CLAUDE.md`). O
  criador em lote serve estritamente à meta 1 (nenhum pagamento sem
  documento hábil, reduzindo a fricção que gerou o `CONTAI-083`) — não é uma
  ferramenta de planejamento de obra.
- **Valor de parcela variável com juros/resíduo não especificado.** Não
  decidido aqui — vai como pergunta ao Gate Fiscal/`/tickets-req`. Não
  assumir divisão igual automática sem confirmação do `contador` e do
  Mateus.

## Pontos para o Gate Fiscal (`contador`) no `/tickets-req` — não decidir aqui

1. O criador em lote pode setar `documento_origem_id` igual para as N
   parcelas? Risco: recriar em massa, de propósito, o exato bug do
   `CONTAI-083` (que foi por acidente de herança individual repetida) — pior,
   porque seria o comportamento padrão de uma feature nova, não um acidente.
   Hipótese forte do `po`: **não**, nenhuma parcela do lote deveria herdar
   origem automaticamente (ver AC2 da US1).
2. Se os valores das N parcelas não forem exatamente divisíveis (ex. R$1.000
   em 3x), como distribuir o resíduo — quem leva o centavo a mais? Questão
   fiscal residual (custo de aquisição por parcela precisa somar certo).
3. A feature vale para os dois meios (PIX/boleto e cartão), ou só cartão?
   O cartão já tem fatura mensal puxando parcela por parcela — o criador em
   lote pode servir apenas para pré-cadastrar as N compromissos de cartão
   antes de qualquer fatura chegar (hoje teria que entrar manualmente em
   cada mês na data certa).
4. Precisa de trava visual/relatório para ver que N compromissos pertencem
   ao mesmo parcelamento (US2), mesmo sem fundir o evento fiscal? Toca
   `montarAgendaDaHome`/`lib/fiscal/compromisso.ts`.

## Perguntas de esclarecimento ao Mateus (máximo 3)

1. O criador em lote precisa cobrir PIX/boleto parcelado fora do cartão
   (ex. empreiteiro combinando parcelas por fora), ou o caso real que motivou
   o relato é só cartão (como o Ilhamix)? Decide se a feature toca uma tela
   ou as duas.
2. Quando o valor total não divide exatamente entre as N parcelas, você
   prefere digitar o valor de cada parcela individualmente (o lote só repete
   favorecido/CPF-CNPJ/meio) ou quer que o sistema sugira valor igual e você
   ajuste a última parcela à mão? (A regra de "quem leva o centavo" fica com
   o `contador`; isto aqui é só sobre a interação.)
3. A cadência entre parcelas é sempre mensal (como no caso Ilhamix: 15/10,
   15/11, 15/12), ou o lote precisa aceitar outras periodicidades (quinzenal,
   datas digitadas uma a uma)?

## Estado

Relato processado, sem ticket ainda. Aguarda: (a) resposta às 3 perguntas
acima, (b) Gate Fiscal do `contador` nos 4 pontos listados, antes do
`/tickets-req`.
