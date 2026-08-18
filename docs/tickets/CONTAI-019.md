# CONTAI-019 — Pagamento agendado: compromisso previsto × pagamento executado

## Tipo e Prioridade

feature (fiscal + usabilidade) — **P1**. **2º da fila da R1**, atrás do CONTAI-018.

Desmembrado do CONTAI-018 (diretriz D2, 2026-08-18) e **reescreve a US-002**: ela
deixa de ser "fila de boletos a pagar com lembrete" e vira compromisso de
pagamento previsto, com boleto sendo *uma* origem e o PIX agendado sendo outra.

- **Gate 0 (mock)**: **OBRIGATÓRIO** — 3 estados.
- **Gate Fiscal**: **FECHADO no mérito, com dívida de arquivo.** O parecer do
  `contador` de 2026-08-18 foi emitido em sessão e **ainda não está em
  `docs/pareceres/`**. ⚠️ **Materializar antes do Gate 1** — parecer que só existe
  no transcript é "regra fiscal de memória" com outro nome. O texto abaixo é
  transcrição literal e vale como fonte enquanto o arquivo não existe; **não**
  substitui o arquivo.

## Dor de Origem

> "o pagamento pode ser um registro para futuro ou já feito, isso será
> contabilizado pela data de execução" — Mateus, 2026-08-18

Hoje o app **recusa** data futura (`lib/fiscal/pagamento.ts:137`) — e a recusa
está fiscalmente certa. O resultado prático é que o compromisso conhecido **não
tem onde morar**. Duas consequências:

1. O Mateus registra com a data de hoje para o app aceitar — e o custo entra no
   dia errado, possivelmente **no ano errado**. Ver pergunta 3: se já aconteceu,
   o ticket vira **P0**.
2. Ou não registra nada, e o compromisso vive na cabeça dele. **Dinheiro que sai
   da obra sem registro é a falha da meta 1 pelo lado de fora.**

## Gate Fiscal (Contador) — transcrito de 2026-08-18

**Nada aqui é negociável em implementação.**

1. **"Pagamento futuro" não é pagamento — é COMPROMISSO.** **Duas entidades**,
   não um registro com dois estados.
   - `pagamento` só existe com **desembolso ocorrido**: `dataPagamento`
     obrigatória e no passado. **A recusa de data futura FICA, literalmente.**
   - `compromisso` tem favorecido, **valor previsto**, data prevista, origem e
     documento de origem — e **não tem campo de data de pagamento**.
2. **Motivo de serem duas entidades, e é o coração do ticket**: se fosse um
   registro com data anulável, a proteção viraria *"todo cálculo lembra de
   filtrar nulo"* — **o defeito do `status` com outro rosto**, exatamente o que o
   CONTAI-018 está removendo. Um cálculo escrito daqui a seis meses não pode ter
   como pegar um compromisso por engano: ele tem que estar em outra tabela, com
   outro tipo.
3. **Confirmação CRIA o pagamento** e grava o id no compromisso. Um compromisso
   pode ser quitado por **N pagamentos**.
4. **Vencido sem resposta**: item **âmbar** com **três respostas de um toque —
   saiu / não saiu / mudou a data**. **Nunca vermelho** e **nunca no bloco de
   pendências fiscais**: não há fato consumado, logo não há risco fiscal ainda.
   **Nunca some e nunca expira sozinho.**
   O dente vem uma vez por ano: **compromisso vencido sem resposta BLOQUEIA a
   geração do relatório anual daquele ano.** É o único ponto do sistema que
   obriga resposta, e é o certo — na virada do ano é que a omissão custa.
5. **Comprovante não bloqueia a confirmação** — *"nunca recuse o registro de um
   fato consumado"*. Confirmado sem comprovante é o **estado (b)** do parecer do
   CONTAI-018: não entra no custo confirmado, vira pendência **"pago sem
   comprovante"**.
6. **Cinco regras para previsão nunca ser lida como dispêndio:**
   1. **Tabela e tipo próprios** — nunca uma coluna a mais em `pagamento`.
   2. **Nenhum total que contenha pagamento contém compromisso.** Não existe soma
      mista, em lugar nenhum, com rótulo nenhum.
   3. O campo se chama **"valor previsto"** — nunca "valor".
   4. **Discriminação anual e Pagamentos Efetuados nunca recebem compromisso.**
   5. Na **exportação**, sai em **arquivo separado**, com o cabeçalho literal:
      *"AGENDA DE COMPROMISSOS — VALORES PREVISTOS, NÃO EXECUTADOS. NÃO COMPÕEM
      CUSTO DE AQUISIÇÃO."*
7. **Boleto e PIX previsto são fiscalmente idênticos: zero.** A diferença é
   **probatória**, e por isso `origem` é campo, não bifurcação de regra.
8. ⚠️ **Achado que ninguém tinha visto — valor previsto ≠ valor pago.** Com
   **juros, multa ou desconto**, o desembolso difere da previsão. **Juros e multa
   de mora NÃO compõem custo de aquisição** (dor D2). A confirmação **precisa
   aceitar valor diferente e separar principal de encargos** — só o principal vira
   custo. **Sem isso, boleto pago em atraso infla o custo em silêncio**, e custo
   inflado indo para a declaração é a única classe de erro que gera passivo
   tributário.

## Diretriz de desenho (`designer`, 2026-08-18)

1. **A DATA é o controle.** Sem segmented control "já paguei / vou pagar" —
   seria um toque a mais no caminho de 95%. `data ≤ hoje` → pagamento;
   `data > hoje` → agendamento.
2. **Três mudanças simultâneas** quando a data digitada é futura: aviso colado no
   campo; o **comprovante obrigatório desaparece**; o botão troca de **verbo e de
   peso**.
3. **Vocabulário: "agendado" e "pago".** Nunca "previsto/efetivado", nunca
   "regime de caixa" em tela. **A preposição carrega o tempo**: *"pago em 05/08"*
   × *"para 15/09"*.
4. **O pago é mudo; o agendado carrega marca.** O inverso produz o erro caro — um
   pagamento que perde a marca parece agendado e ele **registra de novo**. Quatro
   marcas redundantes: `~` e cinza no valor, chip âmbar, preposição, borda
   tracejada.
5. **Na confirmação, a data prevista vem pré-preenchida mas editável, e é
   descartada na gravação.** *(Ponto em aberto: pré-preencher induz confirmar com
   a data errada?)*
6. **"Cancelar agendamento" mora só no detalhe**, nunca no cartão da home.

## User Story

**Como** dono da obra, gerenciando de casa no fim do dia, **quando** sei que a
parcela sai dia 15 ou que o boleto vence sexta, **quero** registrar isso agora
sem que vire custo, **para que** nada saia da obra sem registro e o custo do ano
continue sendo só o que o dinheiro realmente pagou.

## Critérios de Aceite

### O modelo

1. [ ] **`compromisso` é tabela própria**, com favorecido, valor previsto, data
   prevista, origem, documento de origem e obra. **Não tem coluna de data de
   pagamento.** Teste: inspeção de schema afirmando a ausência.
2. [ ] **`pagamento` não ganha coluna nova** e a recusa de data futura continua
   ativa, com o teste unitário existente intacto.
3. [ ] ⚠️ **Nenhuma função fiscal aceita compromisso.** `sustentaCusto`, o resumo,
   a discriminação e Pagamentos Efetuados não têm caminho de código que receba um
   compromisso — **a tipagem impede, não a disciplina**.

### Registrar

4. [ ] Data **≤ hoje** grava **pagamento**, com comprovante obrigatório. Nada
   muda no caminho de 95%.
5. [ ] Data **> hoje** dispara **as três mudanças simultâneas**. E2E em 375px
   afirmando as três, no mesmo passo.
6. [ ] Salvar com data futura cria **compromisso**, não pagamento. E2E confere:
   uma linha em `compromisso`, **zero** em `pagamento`.
7. [ ] **O texto nunca diz "previsto/efetivado" nem "regime de caixa".**

### Ver

8. [ ] O agendado carrega **as quatro marcas**. Perder uma é regressão — a
   redundância *é* o requisito.
9. [ ] **O pago não carrega marca nenhuma** de agendamento. É o critério que
   evita o erro caro (registrar duas vezes).
10. [ ] ⚠️ **Nenhum total mistura.** Auditoria de cada número da home e das
    listas. O agendado, se aparecer, é **em bloco separado com rótulo próprio** —
    nunca ao lado do custo.
11. [ ] O campo e o rótulo dizem **"valor previsto"**.

### Confirmar

12. [ ] Confirmar **cria um pagamento** e grava o id no compromisso. E2E ponta a
    ponta com as duas linhas e o vínculo.
13. [ ] **A confirmação aceita valor diferente do previsto**, e quando difere
    **exige a separação principal × encargos**.
14. [ ] ⚠️ **Só o principal compõe custo.** Unitário: compromisso de R$ 10.000
    confirmado com R$ 10.320 (R$ 320 de juros e multa) → custo **R$ 10.000**, e
    os R$ 320 registrados e **fora do custo**.
15. [ ] **Um compromisso pode ser quitado por N pagamentos**, com saldo visível.
16. [ ] **Comprovante não bloqueia.** Confirmado sem comprovante grava, **não
    entra no custo** e vira pendência **"pago sem comprovante"** — texto do
    parecer, não reescrito.
17. [ ] A data prevista vem **pré-preenchida e editável** e é **descartada na
    gravação**. Teste: confirmar em 17/09 um compromisso de 15/09 grava
    `dataPagamento = 17/09`.

### Vencido sem resposta

18. [ ] Vira item **âmbar** com **saiu / não saiu / mudou a data**, um toque cada.
19. [ ] **Nunca vermelho, nunca no bloco de pendências fiscais.**
20. [ ] **Nunca some e nunca expira sozinho.** Teste com data de 90 dias atrás.
21. [ ] ⚠️ **Compromisso vencido sem resposta BLOQUEIA a geração do relatório
    anual daquele ano**, com a lista do que falta responder. *(A tela é da
    US-004; enquanto ela não existe, o bloqueio vive na função e o teste é
    unitário. **Este critério não pode ser adiado com a US-004** — é o único
    dente do mecanismo.)*

### Cancelar e exportar

22. [ ] **"Cancelar agendamento" só no detalhe**, com confirmação. **Não apaga**:
    fica registrado como cancelado.
23. [ ] Na exportação, sai em **arquivo separado** com o cabeçalho literal do
    Gate Fiscal 6.5. Teste sobre o texto exato.
24. [ ] **E2E contra o Postgres local**, com o mesmo client autenticado.

## Gate 0 — mock

**Obrigatório**, três razões: o formulário muda de comportamento no meio da
digitação, a distinção pago × agendado é o que evita o erro caro, e a resposta de
três toques é padrão novo no app.

**3 estados** (375px como piso, desenhar também a leitura confortável):

1. **Registrar-agendado** — o formulário no instante em que a data vira futura.
2. **Home-com-vencido** — o item âmbar entre itens pagos, mostrando que o
   agendado carrega marca e o pago não.
3. **Confirmar-execução** — data pré-preenchida editável, valor previsto × pago,
   e **a separação principal × encargos** quando divergem.

## Out of Scope

- **Lembrete no Google Calendar.** P2 com recomendação de corte: *"não pagar
  juros" é gestão de caixa e não serve nenhuma das três metas.* ⚠️ Parte desse
  raciocínio assumia uso só no canteiro, premissa que caiu em 18/08; **reavaliado
  sob a régua nova e mantido**, agora pelo argumento das metas.
- **Série recorrente de parcelas.** Depende da pergunta 1 — se a resposta for
  "série", **este desenho não serve** e vira ticket próprio antes do Gate 1.
- **Previsão de fluxo de caixa** — fora de escopo declarado.
- **Máquina de estados do boleto** — fica no CONTAI-018; aqui boleto é só um
  valor de `origem`.

## Pre-mortem

1. **Boleto pago em atraso infla o custo em silêncio** — juros e multa entram
   como se fossem obra, e ninguém percebe porque o número "bate" com o extrato.
   **Risco nº 1 e o mais caro.** *Mitigação: critérios 13 e 14.*
2. **Compromisso vaza para um total de custo** — alguém escreve uma query nova
   somando "tudo que é pagamento previsto ou feito". É o defeito do `status`
   renascendo. *Mitigação: critérios 1, 3 e 10 — proteção de tipo, não de
   atenção.*
3. **Ele confirma com a data pré-preenchida sem olhar** e o pagamento entra no
   dia errado — se for virada de ano, **no ano errado**. *Mitigação: critério 17
   + pergunta ao Mateus sobre pré-preencher.*

## Viabilidade (CTO)

- **Migration nova**: tabela `compromisso` + vínculo para `pagamento`. **Próxima
  livre** (o `/develop` do 018 está consumindo números). **GRANT explícito
  obrigatório.** Pergunta do repo: *isto depende de algum default do stack local
  que o remoto não tem?*
- **Arquivos**: `app/adicionar/pagamento/page.tsx`, módulo novo em `lib/fiscal/`
  (**não** dentro de `pagamento.ts`), `lib/data.ts`, `app/page.tsx`, telas de
  detalhe e confirmação.
- **Complexidade: M.** O risco não está no volume: está em manter compromisso
  fora de todo caminho de cálculo.
- **Ordem**: depois do CONTAI-018 — mesma superfície; em paralelo violam a regra
  de concorrência entre agentes.

## Dependências

- **Bloqueado por**: Gate 0 · **materialização do parecer** · CONTAI-018.
- **Bloqueia**: `US-004` (o critério 21 é pré-condição da geração) e
  **`CONTAI-011`**, que herda o arquivo separado do critério 23.
- **Atenção — dívida do Gate 4 do CONTAI-002**: o E2E do login preenche
  `/adicionar/pagamento` campo a campo. **Mexer aqui quebra um teste de login**, e
  o sintoma parece regressão de autenticação. Não é.
- **Relacionado**: `CONTAI-010` — parcelas de financiamento são o mesmo padrão
  *contrato é previsão, extrato é fato*. ⚠️ **Não fundir**: os juros do terreno
  **compõem** custo (art. 17, I, "g"), ao contrário dos juros de mora daqui.
  Confundir é erro fiscal, não de escopo.

## Perguntas Abertas (ao Mateus)

1. ⚠️ **As parcelas da empreiteira (~20 meses) são uma SÉRIE recorrente ou você
   registra uma a uma?** Se for série, **este desenho não serve** — 20
   compromissos individuais é pior que a planilha.
2. **Quantos agendamentos em aberto ao mesmo tempo?** 2 ou 3 → lista na home.
   15 → tela própria, e o Gate 0 cresce.
3. ⚠️ **Quando o app recusou a data futura, você registrou com a data de hoje?**
   Se sim, **existe custo no dia errado em produção agora**, e este ticket **vira
   P0** com um item de correção dos registros existentes.

## Teste do Canteiro (régua de 2026-08-18)

- **Principal — gestão em casa**: é onde o compromisso nasce (você sabe da
  parcela olhando o contrato, não na obra) e onde a confirmação com separação de
  encargos acontece, olhando o extrato. **A régua aqui é acerto, não velocidade.**
- **Eventual — canteiro, 375px como piso**: só a resposta de um toque do item
  vencido precisa passar nessa régua, e passa por construção.
- **Metas**: 1 (pelo lado do "ainda não pagou") e 2 (o critério 21 impede
  relatório com buraco). Meta 3 de raspão.
- **Veredito: APROVADO como P1, 2º da fila**, condicionado à pergunta 1 — e
  **promovido a P0 se a resposta da 3 for "sim"**.
