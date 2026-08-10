# CONTAI-008 — Mover registro entre obras não pode quebrar o vínculo pagamento↔documento

## Tipo e Prioridade
bug latente / integridade fiscal — **P0 condicionado à US-003**.

**Não entra na R1.** Hoje o defeito é **inatingível pela interface**: nada no
app cria linha em `pagamento_documento` fora de teste, então não existe par
conciliado para quebrar. Ele entra na fila **coladinho na US-003
(conciliação)** — e a US-003 **não pode ser dada como pronta sem ele**.

**Por que P0 mesmo sendo latente.** O critério de admissão da R1 é *"este campo
é impossível ou caro de capturar depois?"*, e este ticket não captura nada — é
consistência. Mas a classe do erro é a mais cara catalogada no projeto: **custo
que some de uma apuração sem gerar pendência**. Um erro que ninguém vê não é
menos caro por ser raro; é mais caro por ser mudo.

## Dor de Origem
**Não veio de relato do Mateus.** Veio do review técnico do `cto-obra` no
Gate 2 do CONTAI-003 (ressalva R1, 2026-08-10).

`moverDocumentoDeObra` e `moverPagamentoDeObra` — a implementação do critério
13 do CONTAI-003 — atualizam **só a própria linha**. O vínculo
`pagamento_documento` não é consultado nem revalidado.

Cenário: pagamento P conciliado com o documento D, ambos na obra A. O usuário
corrige a obra de **D** para B. Resultado:

- D passa a compor a discriminação de B;
- P continua em A, mas **conciliado** — logo deixa de contar como "pago sem
  nota" em A;
- **o custo de P desaparece do resumo de A** (o documento que o sustentava não
  está mais lá) **e nenhuma pendência captura o caso** — P está conciliado, D
  está atribuído, cada linha isolada parece correta;
- na venda de A, custo não declarado não existe (IN SRF 84/2001 art. 17) e o
  valor inteiro vira ganho tributado.

É o mesmo desfecho do D10 (gasto na obra errada), chegando pela ferramenta que
foi construída para **consertar** o D10. Nasce armado.

Dor extraída:
- **D19 [P0 fiscal]** — a correção de obra de um registro conciliado desfaz a
  apuração da obra de origem **em silêncio**: nenhuma das duas obras acusa, e o
  erro só aparece quando o total do ano não fecha, um ano depois.

## User Story
Como dono da obra, quando eu corrigir a obra de um documento ou de um pagamento
que já está conciliado com outro, quero que o sistema não me deixe partir o par
em silêncio, para que o custo não suma de uma obra sem aparecer em lugar nenhum.

## Critérios de Aceite
1. [ ] Mover documento ou pagamento **com vínculo em `pagamento_documento`**
       tem comportamento **definido e visível**. O PO fixa o requisito, não a
       mecânica: **é proibido o caminho que grava e não avisa**
2. [ ] A decisão entre as três saídas possíveis é do `cto-obra` **com Gate
       Fiscal do `contador`**, porque as três têm consequência diferente:
       (a) mover o par inteiro (documento + pagamentos vinculados) — **atenção:
       para NF de serviço isto move a nota para uma obra cujo CNO ela não
       referencia**, o que o critério 13 do CONTAI-003 já proíbe;
       (b) bloquear enquanto houver vínculo, exigindo desfazer a conciliação
       antes;
       (c) permitir e **abrir pendência nas duas obras**, nomeando a outra ponta
3. [ ] Qualquer que seja a saída, **o par nunca fica atravessado sem registro**:
       não existe estado em que P (obra A, conciliado) aponte para D (obra B) e
       as duas obras se declarem em ordem
4. [ ] O resumo (`lib/fiscal/resumo.ts`) de uma obra **nunca perde valor sem
       contrapartida**: se um custo sai da obra A, ou ele aparece em B, ou vira
       pendência em A. Não existe evaporação
5. [ ] E2E afirma **estado gravado**, não tela: montar P conciliado com D na
       obra A, mover D para B, e provar que a soma dos custos de A e B mais as
       pendências das duas fecha com o total de antes da correção
6. [ ] Teste de regressão do caso benigno: mover documento **sem** vínculo
       continua funcionando exatamente como hoje, sem atrito novo

## Gate Fiscal (Contador)
**Pendente — e é pré-requisito do critério 2.** As três saídas do critério 2
têm consequências fiscais distintas e o PO não escolhe entre elas. Perguntas
para o `contador` quando este ticket for para o `/develop`:

1. Mover a **NF de serviço** de obra levando junto os pagamentos conciliados é
   admissível, sabendo que o CNO impresso na nota continua sendo o da obra de
   origem? *(A hipótese do PO é que não — a dedução é amarrada ao CNO impresso,
   contador Q9c —, o que empurraria a saída (b) ou (c) para NF de serviço.)*
2. Um pagamento que perde o documento que o sustentava volta a ser **"pago sem
   nota"** (exposição do CONTAI-005) ou vira uma pendência de classe própria?
3. Se o custo migrar de obra **entre anos-calendário já declarados**, a
   correção é do app ou é retificadora? *(O regime de caixa fixa o ano pela
   data do pagamento, que não muda ao trocar de obra — mas a discriminação da
   matrícula muda nos dois anos.)*

## Out of Scope
- **Desfazer conciliação como feature própria** — é da US-003, e este ticket
  só depende de ela existir
- **Histórico/auditoria de movimentações entre obras** — tentador e não serve
  nenhuma das três metas hoje. Volta se o `contador` exigir trilha para
  sustentar retificadora (pergunta 3 do Gate Fiscal)

## Pre-mortem
1. A US-003 é implementada, cria o primeiro `pagamento_documento` real, e este
   ticket ainda não entrou → o defeito passa de latente a ativo **sem que nada
   mude de cor no repositório**. **Mitigação**: a dependência está declarada
   nos dois sentidos (aqui e na US-003 do backlog), e a US-003 não fecha sem
   este ticket
2. Alguém "resolve" no caminho mais barato — mover o par inteiro sempre — e
   contrabandeia uma NF de serviço para uma obra cujo CNO ela não referencia.
   **É trocar um erro mudo por um erro pior**, porque o segundo tem consequência
   de averbação. **Mitigação: critério 2**, que manda passar pelo `contador`
3. A trava vira atrito na correção do caso comum (registro sem vínculo, que é
   99% deles hoje) e o Mateus deixa de corrigir. **Mitigação: critério 6**

## Viabilidade (CTO)
- A avaliação é do `cto-obra` — ele é quem levantou a ressalva. Anotação do PO
  a partir do que ele descreveu: o ponto de mudança são as duas funções de
  mover, e o dado necessário (`pagamento_documento`) já existe no schema
- Complexidade estimada pelo PO: **S/M** — depende inteiramente de qual das
  três saídas do critério 2 for escolhida

## Dependências
- **Bloqueado por**: CONTAI-003 (é a ferramenta de mover que ele cria) —
  **já satisfeito**
- **Bloqueia**: **US-003 (conciliação)**. Esta é a dependência que importa: a
  US-003 é quem torna o defeito alcançável, e não pode ser dada como pronta
  antes dele
- Toca a mesma superfície do CONTAI-009 (correção de obra a partir do detalhe
  de pagamento); nada impede que sejam feitos separados

## Perguntas Abertas
- As três do Gate Fiscal, todas para o `contador`, todas antes do `/develop`

## Teste do Canteiro
- **Meta 1** (nenhum pagamento sem documento hábil): move — o defeito produz
  exatamente o estado que a meta 1 existe para impedir, com o agravante de que
  o app **acha que está tudo certo**
- **Meta 2** (relatórios anuais): move — a discriminação da obra de origem sai
  a menos e ninguém sabe quanto
- **Meta 3** (acervo): neutro — o documento continua no acervo, só está na obra
  errada
- Uma mão, com pressa: o caminho comum (mover registro sem vínculo) **não pode
  ganhar toque nenhum** por causa deste ticket
- **Veredito: APROVADO como P0 condicionado**, fora da R1, com Gate Fiscal
  obrigatório antes da implementação
