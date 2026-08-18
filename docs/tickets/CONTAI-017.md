# CONTAI-017 — Lista das notas emitidas sem CNO (tela 14)

## Tipo e Prioridade

feature (display) — **sem prioridade atribuída. FORA DA R1.**

Cortado do CONTAI-007 pelo `po` em 2026-08-18. Era o critério 8 daquele ticket,
junto do link de entrada *"Ver as [N] notas desta obra emitidas sem CNO"* na
tela 13.

- **Gate 0 (mock)**: **NÃO exige mock.** Herda a **tela 14 já desenhada e
  aprovada pelo Mateus em 2026-08-10** em `design/mocks/CONTAI-003.html`, junto
  com o link de entrada na tela 13.
  ⚠️ Isso **não** dispensa o CONTAI-007 de mock: lá o que falta desenhar é a
  **captura** do `cno_referenciado` (critérios 1–3), que não está desenhada em
  lugar nenhum. Os dois fatos convivem e já causaram a contradição interna
  registrada no ponto (a) da revisão do 007.
- **Gate Fiscal**: **SEM IMPACTO.** É leitura de dados já capturados, sem regra
  nova. A janela que a lista usa — notas emitidas entre `data_inicio_obra` e
  `cno_registrado_em` — vem do parecer de 2026-08-09 e **não é redefinida aqui**.

## Dor de Origem

Notas de serviço emitidas antes do CNO existir não referenciam CNO nenhum. São
recuperáveis: dá para exigir da empreiteira o CNO impresso nas próximas notas e a
**retificação da EFD-Reinf** — mas só **enquanto houver parcela a liberar**.

## Por que foi cortado — os três motivos

Registrados por extenso porque o item é tentador e vai voltar à mesa.

1. **Nasce vazia.** O app tem **zero documentos** desses no banco: as notas
   antigas estão na planilha, e a **US-005 (migrar planilha) não está na fila**.
   Um zero falso é pior que ausência de tela, porque sugere que não há nada a
   cobrar.
2. **A cobrança que recupera valor não passa por software.** É o **item 0 da
   fila** desde 2026-08-10: falar com a empreiteira **antes da próxima parcela**.
   Construir a tela primeiro **atrasa a ação que efetivamente recupera dinheiro**.
3. **É display, não captura.** A regra de admissão da R1 é *captura irreversível
   no ato do registro*. Nada se perde por ele existir depois. **É o oposto exato
   do CONTAI-004/007.**

**Contraponto honesto**: este era *"o único item daquele lote que recupera valor
em vez de só registrar perda"*. O corte não nega isso — nega que **o software**
seja o que recupera o valor.

## Condição de volta (explícita, sem discussão)

> **Volta para a R1 se o Mateus disser que vai registrar as notas antigas no
> app.**

Se as notas antigas entrarem no sistema, o motivo 1 cai e a lista vira o
inventário da conversa de cobrança. Repriorizado **sem nova justificativa**.

## User Story

**Como** dono da obra, sentado com o contrato antes de liberar a próxima parcela,
**quero** ver a lista das notas daquela obra emitidas antes do CNO existir, com
número, data, prestador e valor, **para que** a cobrança seja feita com os
números na mão, enquanto ainda há parcela a segurar.

## Critérios de Aceite

1. [ ] **Tela 14, como aprovada no mock**: lista das notas da obra ativa emitidas
   **entre `data_inicio_obra` e `cno_registrado_em`**, com **número, data de
   emissão, prestador e valor**.
2. [ ] **Link de entrada na tela 13**: *"Ver as [N] notas desta obra emitidas sem
   CNO"*, com N real.
3. [ ] **Escopo da obra ativa.** Nada soma nem lista entre obras.
4. [ ] ⚠️ **Estado vazio honesto — responde ao motivo 1 do corte.** Com zero
   notas na janela, a tela **não diz "nada a cobrar"**. Diz que **não há notas
   registradas nesse período no app** e que as anteriores à adoção do sistema
   podem existir fora dele. Texto que transforma "não registrado" em "não existe"
   é a mesma falha que o CONTAI-018 corrige no custo.
5. [ ] **Sem CNO registrado na obra**, a tela informa que a janela ainda está
   aberta e lista as notas desde o início da obra.
6. [ ] **Nenhuma ação de escrita.** Não edita, não marca como cobrado.
7. [ ] **A lista é copiável em texto** para levar à conversa. *(Se for custoso,
   corta: é o item mais dispensável do ticket.)*
8. [ ] **E2E contra o Postgres local**, cobrindo lista com itens, estado vazio e
   obra sem CNO registrado.

## Out of Scope

- **Marcar nota como "já cobrada"** — acompanhamento de conversa com empreiteiro,
  fora de escopo declarado.
- **Gerar o texto do e-mail de cobrança.** Idem.
- **Migrar as notas antigas da planilha** — é a **US-005**, e é ela que decide se
  este ticket volta.
- **Qualquer efeito sobre a aferição INSS.** A lista informa; não recalcula.

## Pre-mortem

1. **A tela sobe vazia e o Mateus conclui que não há nada a cobrar** — o app
   apaga a única ação que recupera dinheiro. *Mitigação: critério 4.*
2. **O ticket é feito antes da conversa com a empreiteira** e a janela de força
   fecha enquanto se escreve código. *Mitigação: o corte em si.*
3. **A tela vira embrião de um inventário geral** e absorve a US-009 por dentro.
   *Mitigação: critério 1 fixa o conteúdo na janela do CNO.*

## Viabilidade (CTO)

- **Sem migration.** Só leitura de `documento` com filtro de data e tipo.
- **Depende de campos de outros tickets**: `numero` e `data_emissao`
  (**CONTAI-004**) e `cno_referenciado` (**CONTAI-007**).
- **Complexidade: S.**

## Dependências

- **Bloqueado por**: `CONTAI-004` **e** `CONTAI-007` (campos).
- **Reabre por**: decisão do Mateus de registrar as notas antigas (US-005).
- **Herda**: tela 14 + link da tela 13, aprovados em 2026-08-10.

## Perguntas Abertas

1. **Você vai registrar no app as notas antigas que estão na planilha?** É a
   única pergunta que importa.
2. **Quantas notas de serviço foram emitidas antes do CNO?** Se forem 3, a lista
   é dispensável. Se forem 30, o argumento muda.
3. **A conversa com a empreiteira já aconteceu?**

## Teste do Canteiro (régua de 2026-08-18)

- **Cenário principal — gestão em casa, com o contrato aberto.** É preparação de
  conversa, não captura. **375px é piso de leitura**: a lista pode ser densa.
- **Metas atendidas**: **nenhuma das três, diretamente.** Serve à **recuperação
  de valor**, que é legítimo e não é meta.
- **Veredito: FORA DA R1, sem prioridade atribuída.** É o ticket que o filtro de
  escopo manda cortar, e ele está cortado — com a condição de volta escrita para
  que a decisão não precise ser tomada de novo.
