# Backlog — contai

Backlog vivo. Dores extraídas dos relatos do Mateus, stories priorizadas
(P0 fiscal / P1 fricção / P2 conveniência), perguntas abertas e cortes.

---

## DECISÕES PENDENTES DO MATEUS (Gate 4 do CONTAI-001, 2026-08-08)

*Bloco destacado: nada aqui avança sem resposta explícita do Mateus.*

1. ~~**Headline "Em pendência"**~~ — **DECIDIDA em 2026-08-17: R$ 49.850.**
   Fechada pelo **contador + PO**, sob a delegação do Mateus do mesmo dia
   (decisão técnica é do Lead+CTO; fiscal e de produto, do Contador+PO — ele
   decide só mock, fatos que só ele sabe, ações fora do app e push).
   O contador **não carimbou nem os 92.850 nem os 47.850**; carimbou a
   recomendação do PO. Parecer completo em
   `docs/pareceres/2026-08-16-gate-fiscal-contai-004-005.md`, Parte 2, com os
   textos de tela prontos e três ressalvas bloqueantes — sendo a maior a R5: o
   *"Custo confirmado R$ 0,00"* ao lado do headline é **estrutural**, e como
   está a home afirma que 100% do que foi gasto está em risco.
   **O `CONTAI-005` está destravado** (ver `docs/tickets/CONTAI-005.md`,
   alternativa (a)). Texto original da pendência, preservado para histórico:

   **Headline "Em pendência" — recomendação do PO: nem 92.850, nem 47.850.**
   Os R$ 47.850 do mock são aritmética de antes do card "pago sem nota"
   existir; os R$ 92.850 somam quatro moedas diferentes (perda de custo,
   conta a pagar e base de INSS). Proposta: headline = **"Custo em risco no
   IR"** = quarentena + pago sem nota (R$ 49.850 no cenário do mock);
   exposição INSS em linha separada expressa **em base** ("R$ 18.000 de NF de
   serviço sem retenção"), sem reais perdidos até o contador fechar o cálculo
   na US-004; boleto sai do headline e fica só como card (o lugar dele é a
   fila "a pagar" da US-002). Efeito colateral: some o double-count apontado
   pelo cto-obra. → **CONTAI-005 [P0]**. Raciocínio completo no Gate 4 do
   ticket CONTAI-001.
2. **Divergências menores do mock — recomendação do PO por item** (detalhe no
   Gate 4 do ticket):
   - linha de imposto da tela 6 → **ratificar a omissão**; volta com a
     fórmula do contador ("até R$ X", com disclaimer);
   - "Destinatário: AJE" omitido → **backlog, anexado à US-008** (a extração
     entrega de graça; perguntar hoje custa mais um campo no caminho ruim);
   - botão "Anotar: falar com o empreiteiro" → **cortar em definitivo**
     (comunicação com empreiteiro é escopo declarado fora do produto);
   - botão "Pedir nota corrigida" → **backlog P2 com trava**: só deep-link de
     WhatsApp com texto pronto, zero estado no sistema;
   - FAB "+ Adicionar" → **ratificar e corrigir o mock** (o mock é que
     ficou com o rótulo da v2);
   - tela 8 parametrizada por porta → **ratificar**;
   - "Favorecido (recente)" → **backlog P1**, primeiro da fila depois do
     login (não é conveniência: CNPJ digitado errado parte a agregação
     CPF-por-CPF da US-004 em dois).
3. ~~**Priorização da fila proposta pelo PO**~~ — **OBSOLETA** (2026-08-09).
   Valia enquanto o produto era de uma obra só. Vale a **"Fila revista — 3ª
   revisão"**, no Gate 2 do CONTAI-003 (fim deste arquivo). As decisões 1 e 2
   acima seguem abertas.

### ⚠️ Q14 — A PERGUNTA MAIS CARA EM ABERTO (acrescentada em 2026-08-10)

> **"A obra sem CNO é empreitada TOTAL — a construtora fornece o material e
> assina a ART da obra inteira?"**

Custa uma frase de resposta e decide **de quem é a obrigação do CNO**. Se for
empreitada total, o CNO é **da construtora**, e o texto que o CONTAI-003 põe em
produção **cobra do Mateus uma obrigação de terceiro** — mandando a pessoa
errada agir e deixando a certa parada, na **única janela de força que existe**
(antes de liberar a próxima parcela; depois do último pagamento não há mais o
que segurar).

- **Não bloqueia** o CONTAI-003 nem a implementação
- **Bloqueia o texto em tela**, junto de uma 2ª condição cumulativa:
  **confirmar na IN vigente de quem é o titular do CNO em empreitada total**
- O `contador` **já redigiu o texto alternativo completo** para o caso de
  empreitada total (título, frase do prazo, próximo passo, rótulo do campo de
  CNO). Ele saiu no review fiscal do Gate 2 e **ainda não está em arquivo** —
  materializar em `docs/pareceres/2026-08-09-obra-sem-cno.md` antes de usar
- **Também muda a ação nº 0 da fila** (registrar o CNO no e-CAC): se for
  empreitada total, essa ação **troca de dono**

---

## Gate 4 do CONTAI-001 — 2026-08-08 — validação do PO

**Veredito: DONE COM RESSALVAS.** Verificação independente: 64/64 unit,
typecheck limpo, 10/10 e2e contra Postgres local. Critérios 1–6 atendidos
(o 6 por bloqueio em vez de pendência — ratificado); **critério 7 (≤3
interações) NÃO atendido** e formalmente transferido para a US-008: o caminho
comum tem ~10 interações, 4 delas de digitação.

Leitura das metas: meta 1 move muito (mas o app **cria** pendências e não
**fecha** nenhuma — US-003 é o fecho obrigatório, não um "depois"); meta 2
quase não move (e o "Custo confirmado" da home é estruturalmente R$ 0,00 até
a US-003, porque nada cria pagamento `conciliado`); meta 3 move o mínimo
(preserva, mas não recupera, não verifica legibilidade e não exporta).

### Fila recomendada pelo PO

**push do repo** → `CONTAI-004` → `CONTAI-005` → `CONTAI-002` → `CONTAI-003`
→ `CONTAI-006` → `US-009`. Duas regras por trás: **o que é irreversível vem
antes do que é caro** (daí o push em primeiro lugar, 5 minutos contra perder
tudo), e **tudo que gera retrabalho manual depois do primeiro registro real
entra antes do login** (CONTAI-004 e 005 antes do CONTAI-002 ir ao ar).

### Novos tickets / stories

**CONTAI-004 [P0] — nº do documento e data de emissão no formulário**
O contador já fixou o formato da discriminação anual: *"NF nº X, valor total
R$ Z, pago R$ Y no ano"* (Q6). Hoje o formulário não pergunta o número da
nota e o schema (`documento`) não tem a coluna — sem isso a US-004 não gera o
texto. Custo agora: um campo. Custo depois: reabrir documento por documento.
Aceite:
1. [ ] `numero` e `data_emissao` capturados no registro de documento
2. [ ] Obrigatórios em NF (material e serviço); opcionais em boleto
3. [ ] Campos disponíveis para o texto da discriminação da US-004

**CONTAI-005 [P0] — headline "Custo em risco no IR" + exposição INSS separada**
Ver decisão pendente nº 1. Toca `lib/fiscal/resumo.ts`, a home e o mock.
Aceite:
1. [ ] Headline soma só quarentena + pago sem nota, rotulado "Custo em risco
       no IR"
2. [ ] Exposição INSS em linha própria, em base (R$ de NF sem retenção), sem
       valor de imposto até o contador definir (US-004)
3. [ ] Boleto fora do headline; segue como card
4. [ ] Mock v5 atualizado com os mesmos números

**CONTAI-006 [P1] — estados de rede lenta/indisponível no canteiro**
Achado do Gate 3: a tela fica ~7,7 s em "Carregando a obra" antes de mostrar
erro (retry do postgrest-js, 1 s+2 s+4 s — confirmado, e2e leva 7,8 s). O
problema não é a duração, é a tela mentir por 7 s; e o sintoma esconde algo
pior: **nenhuma tela tem teto de espera**, então numa 4G ruim o spinner pode
durar indefinidamente. Não é P0 — não põe custo em risco e ninguém perde dado.
Aceite:
1. [ ] Feedback progressivo aos ~2 s ("sem resposta do servidor — tentando de
       novo") — mínimo aceitável
2. [ ] Teto de espera com erro acionável e "Tentar de novo"
3. [ ] Retry do postgrest-js revisto para leituras de tela (definição
       técnica: `cto-obra`)

**US-009 [P1] — ver o que já foi registrado**
Como dono da obra, quero uma lista do que já registrei (com busca por
favorecido) para conferir sem abrir o banco. Hoje o documento registrado
**some da interface** depois de salvo — só pendência aparece. Quem vem de uma
planilha onde vê tudo não confia num app que esconde tudo: ele registra duas
vezes, ou volta para a planilha.
Aceite:
1. [ ] Lista de documentos e pagamentos do ano, com filtro por favorecido
2. [ ] Cada item abre o detalhe já existente

**US-010 [P1] — abrir/baixar o original do acervo**
Preservar sem recuperar não é acervo (meta 3). Hoje o arquivo sobe para o
bucket e nenhuma tela o abre. Aceite: no detalhe do documento/pagamento, o
original abre ou baixa; falha de leitura é visível, não silenciosa.

**US-011 [P0 — antes do 1º ano fechar] — export periódico do acervo**
Requisito **permanente** do CLAUDE.md, ainda inexistente: zip periódico dos
documentos + índice para storage do próprio Mateus (ex.: Google Drive). A
guarda até venda + 5 anos não pode depender de free tier de terceiro.
Depende de resolver o upload órfão (Gate 2), senão o export carrega lixo.

**Legibilidade do anexo [P2]** — o CLAUDE.md pede "legibilidade verificada" e
hoje o app aceita arquivo de 0 byte ou foto tremida. Mínimo barato: recusar
arquivo vazio e avisar em foto abaixo de um limiar de resolução.

**"Pedir nota corrigida ao fornecedor" [P2 — com trava de escopo]** — deep-link
de WhatsApp com texto pronto a partir da tela de quarentena, **zero estado no
sistema**. Se em algum momento pedir caixa de entrada, thread ou histórico de
conversa, cortar: é escopo declarado fora do produto.

**"Favorecido (recente)" [P1]** — ver decisão pendente nº 2.

### Risco de projeto (não é feature, mas é decisão de priorização)

**PUSH DO REPO [P1 — custa 5 minutos]** — o repositório nunca foi enviado para
o GitHub. Um HD queimado hoje leva junto o backlog, os pareceres do contador,
as migrations e o app que vai guardar o acervo fiscal até venda + 5 anos. Isso
é a **meta 3 dependendo de um laptop**. Priorizo acima de qualquer feature
desta lista porque o custo é trivial e a perda é irreversível.

**CI [P2 — enquanto for um dev só]** — não há CI; nada impede commit quebrado.
Com `npm run quality` (lint + typecheck + test + test:e2e) disponível na mão e
um único desenvolvedor, o ganho marginal de CI hoje é pequeno. Vira P1 no dia
em que houver push automático para a Vercel — aí um commit quebrado vai a
produção sozinho. Definição técnica: `cto-obra`.

**`npm run dev` aponta para o banco REMOTO [P1 — mitigação barata]** — o
comando padrão, o que se digita sem pensar, grava no projeto de verdade;
`npm run dev:local` (porta 3200) é que fala com o banco local. Um teste manual
distraído injeta documento de brincadeira no acervo que vira declaração. Não
é hipótese: `playwright.config.ts` já documenta esse tiro no pé
(`reuseExistingServer: false`, com comentário explicando exatamente isso).
Mitigação sugerida: `npm run dev` passa a ser o local, e o remoto ganha nome
explícito (`dev:remoto`) — quem quer tocar em dado real que digite por
extenso.

### Ajustes em itens existentes

- **US-008 (extração)**: absorve o campo "destinatário real" da tela de
  quarentena e absorve o **critério 7 do CONTAI-001** (≤3 interações). No
  fluxo manual a métrica de aceite passa a ser **"tempo até salvar ≤ 60 s com
  uma mão"**, medida no primeiro uso real — não contagem de toques.
- **US-003 (conciliação)**: promovida de fato a bloqueador da meta 1 — o app
  hoje só abre pendências e não fecha nenhuma; e a meta 2 não sai do zero
  porque "custo confirmado" exige pagamento `conciliado`, que nada cria.
- **Rótulo "Interação X de 3"**: trocar por "Passo X de 3" junto com
  CONTAI-004. A tela afirma um número que ela não cumpre.

### Cortado no Gate 4 (com justificativa)

- **Botão "Anotar: falar com o empreiteiro"** (tela 7 do mock): comunicação
  com empreiteiro é escopo declarado fora do produto (CLAUDE.md). Não vai
  para o backlog — vai para cá.
- **Linha de imposto na tela de quarentena, com número fixo**: número de
  imposto errado é pior que ausente; só volta com a fórmula do contador e a
  palavra "até".

---

## Relato 001 — 2026-08-07 — "Planilha, agenda e o medo do IR"

> "hoje eu estou fazendo um planilha onde eu tenho a data do pagamento, a nota,
> o valor, sempre que chega uma nota ou boleto para pagamento eu tenho que
> adicionar nesta planilha, adicionar um lembre na minha agenda de quando tal
> boleto vence para eu não esquecer de pagar e tenho que depois pensar e
> entender como colocar tudo isso no ir. Eu gostaria de subir a nota fiscal e o
> boleto e o sistema faz todo o resto" — "ambos provavelmente serão pdf"

### Dores extraídas

| ID | Dor | Citação | Prioridade |
|----|-----|---------|-----------|
| D1 | Registro manual duplicado: cada nota/boleto = entrada na planilha + lembrete na agenda, na mão | "tenho que adicionar nesta planilha, adicionar um lembre na minha agenda" | P1 fricção |
| D2 | Medo de esquecer boleto e pagar juros/multa. Agravante fiscal: multas e juros de mora NÃO entram no custo de aquisição — atraso é perda seca [validar formulação exata com contador] | "para eu não esquecer de pagar" | P1 fricção |
| D3 | Carga cognitiva do IR adiada: registra hoje sem saber o formato que a declaração vai exigir | "tenho que depois pensar e entender como colocar tudo isso no ir" | **P0 fiscal** |
| D4 | (implícita) Planilha atual não captura os campos das duas apurações: material vs. serviço, emitente CNPJ/CPF, destinatário=CPF do Mateus, retenção 11%, comprovante de pagamento | estrutura citada: "data do pagamento, a nota, o valor" | **P0 fiscal** |
| D5 | (implícita) Vínculo pagamento ↔ documento ↔ comprovante mora na cabeça dele, não em registro | — | **P0 fiscal** |

### Hipótese de solução do usuário (não é requisito)

"Subir NF e boleto (PDF) e o sistema faz todo o resto." Registrada como
hipótese; o valor está na dor (digitação + lembrete + tradução para o IR),
não no formato PDF — NF-e tem XML canônico, preferível quando existir.

### User stories

**US-001 [P0] — Ingestão de documento com extração assistida**
*(status 2026-08-08: entregue na versão manual pelo CONTAI-001 — DONE com
ressalvas no Gate 4. Os itens 2 e 4 abaixo seguem abertos na US-008.)*
Como dono da obra, quero subir uma NF (PDF/XML) ou boleto (PDF) e ter os campos
extraídos automaticamente (emitente, CNPJ/CPF, destinatário, valor, vencimento,
material vs. serviço) para só confirmar em vez de digitar.
Aceite:
1. [ ] Mock em `design/mocks/` aprovado pelo Mateus antes do desenvolvimento
2. [ ] Dado um PDF/XML de NF, quando subo, o sistema propõe o registro
       preenchido e pede confirmação em ≤3 interações
3. [ ] Destinatário ≠ CPF do Mateus → alerta de quarentena com a consequência
       explícita ("não entra no custo de aquisição")
4. [ ] Extração incerta → campo marcado para revisão, nunca aceito em silêncio

**US-002 [P1] — Fila de boletos a pagar com lembrete**
Como dono da obra, quero que boletos subidos entrem numa fila "a pagar"
ordenada por vencimento, com lembrete antes da data, para não pagar juros.
Decisão (2026-08-07): o lembrete **nasce junto** com a confirmação do boleto
na ingestão (CONTAI-001) — sem passo separado de "criar lembrete".
Aceite:
1. [ ] Boleto subido aparece em "a pagar" com vencimento extraído
2. [ ] Lembrete criado automaticamente ao confirmar o boleto (canal a definir:
       candidato natural é o Google Calendar que o Mateus já usa)
3. [ ] Boleto vencido e não pago fica em destaque com dias de atraso

**US-003 [P0] — Conciliação pagamento ↔ documento (regime de caixa)**
Como dono da obra, quero marcar um boleto como pago (data real do pagamento +
comprovante) e ter o pagamento ligado à NF correspondente, para o custo entrar
no ano certo com prova completa.
Aceite:
1. [ ] Registro de pagamento exige data efetiva (não a de vencimento)
2. [ ] Pagamento sem documento hábil vinculado → pendência visível
3. [ ] NF sem pagamento registrado → pendência visível
4. [ ] O ano-calendário do custo é o da data do pagamento [regra: contador]
5. [ ] *(2026-08-10)* **A US-003 não fecha sem o CONTAI-008.** Ela é quem cria
       a primeira linha real em `pagamento_documento` e, com isso, torna
       **alcançável** o defeito latente de mover registro conciliado entre
       obras (D19). Hoje o defeito é inatingível pela UI; no dia em que a
       conciliação existir, ele passa de latente a ativo **sem que nada mude de
       cor no repositório**

**US-004 [P0] — Relatório anual pronto para o IRPF**
Como dono da obra, quero o total do ano quebrado em materiais vs. mão de obra e
o texto da discriminação pronto para colar na ficha Bens e Direitos.
Aceite:
1. [ ] Total do ano por data de pagamento, materiais vs. serviços
2. [ ] Texto da discriminação gerado (modelo do contador, com CNO)
3. [ ] Lista CPF-por-CPF de pagamentos a PF (Pagamentos Efetuados), se houver
4. [ ] Posição da aferição INSS: serviços PJ com vs. sem retenção 11%
5. [x] *(2026-08-10)* **Nenhuma discriminação de ano anterior pode ser gerada
       antes do CONTAI-010.** Sem data de pagamento do terreno, do ITBI e da
       escritura não há regime de caixa, e o custo do terreno inteiro compõe
       **todo** ano-calendário — inclusive os anteriores ao desembolso (D22).
       ✅ **DESBLOQUEADO em 2026-08-19**: CONTAI-010 entregue (Passo 1)

> ⚠️ **Os três critérios abaixo são o PASSO 2 do CONTAI-010**, e vivem aqui
> porque é aqui que serão implementados. *(Registrados no Gate 4 do CONTAI-010,
> 2026-08-19, a pedido do `po`: até então só existiam no corpo daquele ticket e
> em comentário de código — e requisito que só mora no ticket do vizinho é
> requisito que se perde.)*

6. [ ] **Juros/correção do financiamento vão em linha nomeada própria** no texto
       da discriminação — **proibido incluí-los dentro de um total sem dizer**
       (critério 20 do CONTAI-010). Item contestado incluído em silêncio é o
       pior dos mundos; incluído com nome é **posição declarada**, e isso muda o
       tratamento numa glosa
7. [ ] **Ano da venda**: a tela pede **extrato do período + termo de quitação**,
       porque o informe daquele ano só chega no ano seguinte e o ganho de
       capital é apurado antes (critério 17 do CONTAI-010). **1x na vida**
8. [ ] **Onde o saldo devedor aparece no texto** — ⚠️ **o parecer se
       contradiz**: `2026-08-17-terreno-financiado.md` §4 regra 2 manda que ele
       **apareça**, rotulado *"não incluído por não ter sido pago"*; o adendo 2
       §4 diz que ele **não entra** na discriminação. **Exige adendo do
       `contador` ANTES de a US-004 ser especificada.** Até lá a tela cala, e
       cala de propósito — é a mesma disciplina aplicada aos seguros no
       CONTAI-010: onde a fonte se contradiz, o app não afirma

**US-008 [P2 — pós-MVP] — Extração automática de campos de PDF/XML**
*(extraída do escopo original da US-001; decisão do Mateus 2026-08-07:
manual-first)* Como dono da obra, quero que o sistema proponha os campos a
partir do arquivo subido (XML determinístico; PDF via Claude API) para reduzir
digitação. Pré-requisito: fluxo manual em produção. Nota: custo Anthropic é
centavos/doc — a razão do corte é velocidade de MVP, não custo.

**US-005 [P1] — Migração da planilha atual**
Como dono da obra, quero importar o que já registrei na planilha para não
retrabalhar.
Aceite:
1. [ ] Registros existentes entram com os campos que a planilha tem
2. [ ] Campos faltantes (material/serviço, destinatário, retenção) viram
       pendências de complemento, não bloqueio

**US-006 [P0 — MVP, logo após CONTAI-001] — Pagamento a prestador PF com
captura de CPF** *(adicionada 2026-08-07, decisão do Mateus)*
Como dono da obra, quero registrar na hora uma diária/serviço de pessoa física
(nome, CPF, valor, data, foto do recibo), para o custo ser documentação hábil e
a ficha Pagamentos Efetuados sair pronta.
Contexto: a captura do CPF é irrepetível — é na hora do pagamento ou nunca.
Sem CPF: multa por omissão na ficha [confirmar % com contador] E custo fora do
IR. Registro manual simples: recibo manuscrito não extrai, então sem OCR.
Aceite:
1. [ ] Mock aprovado (fluxo dentro do padrão de captura ≤3 interações)
2. [ ] CPF obrigatório e validado; sem CPF o registro fica em quarentena com a
       consequência dupla explícita
3. [ ] Foto do recibo anexada como arquivo (câmera do celular, fora do app)
4. [ ] Registro alimenta a lista CPF-por-CPF da US-004 automaticamente

### Ação imediata (antes de qualquer código)

- [ ] **Adicionar hoje na planilha atual as colunas**: material vs. serviço,
      CNPJ/CPF emitente, destinatário da nota, retenção 11% (S/N), meio de
      pagamento, link/status do comprovante. Custo: minutos. Evita: retrabalho
      em abril e custo perdido.

### Cortado (com justificativa)

- Pagamento automático de boleto (integração bancária): fora das três metas;
  risco alto, valor marginal sobre o lembrete
- Captura automática de e-mail: prematuro até responder Q1

### Perguntas respondidas (2026-08-07)

- **Q1 — canais**: NFs e boletos chegam por **WhatsApp e e-mail**. Implicação:
  captura MVP = upload manual do arquivo pelo celular (o documento já está no
  telefone); encaminhamento automático de e-mail/WhatsApp fica para depois
- **Q2 — meios de pagamento**: **PIX, boleto (código de barras) e alguns no
  cartão de crédito**. Implicações: comprovante = comprovante PIX / recibo de
  boleto / fatura do cartão; ver Q4 (nova) sobre cartão
- **Q3 — prestadores PF**: até agora **todos os pagamentos com nota (PJ)**.
  Implicação: ficha Pagamentos Efetuados sem urgência imediata, mas o sistema
  mantém o alerta "pegar CPF na hora" para quando a primeira diária aparecer

---

## Relato 002 — 2026-08-07 — "PIX mensal pra AJE, nota depois (talvez única)"

> "mês passado por exemplo eu paguei uma parcela da AJE, mas eles não me
> geraram nota ainda, nem boleto teve, foi direto via pix porque eu tenho que
> pagá-los todo mês algum valor [...] pode ser que tenha vários pagamentos e
> depois uma unica NF"

### Dores extraídas

| ID | Dor | Prioridade |
|----|-----|-----------|
| D6 | Pagamento acontece SEM documento prévio (nem NF nem boleto): o fluxo de captura do CONTAI-001 começa pelo documento e não cobre esse caso | **P0 fiscal** |
| D7 | Exposição acumulada "pago sem nota" invisível: cada PIX sem NF é custo que não se sustenta no IR (e serviço sem retenção = INSS pago 2x na aferição) até o documento chegar | **P0 fiscal** |
| D8 | Vínculo pode ser N:M — vários pagamentos ↔ uma NF consolidada — e o modelo/telas precisam suportar | **P0 fiscal** |

### User stories

**US-007 [P0 — MVP, junto do CONTAI-001] — Registrar pagamento avulso (sem documento)**
*(status 2026-08-08: entregue pelo CONTAI-001; itens 1–3 atendidos. O item 4
(exposição acumulada por fornecedor na home) está entregue mas com o headline
errado — corrigido por CONTAI-005.)*
Como dono da obra, quero registrar um PIX feito sem nota/boleto (valor, data,
favorecido, comprovante) na hora, para o pagamento não se perder e virar
pendência "aguardando NF".
Aceite:
1. [ ] Mock aprovado (entrada "registrar pagamento" além de "adicionar documento")
2. [ ] Registro exige: valor, data efetiva, favorecido (CNPJ/CPF), comprovante
3. [ ] Nasce com status "aguardando NF" e aparece nas pendências
4. [ ] A home mostra a exposição acumulada por fornecedor: "pago sem nota:
       R$ X" com a consequência explícita

**Ajuste na US-003 (conciliação)** — o vínculo pagamento↔documento é **N:M**:
1. [ ] Uma NF pode ser vinculada a vários pagamentos (e vice-versa)
2. [ ] Conciliação de valores: soma dos pagamentos vinculados vs. valor da NF;
       divergência vira pendência
3. [ ] NF consolidada cruzando ano-calendário → cada pagamento aloca no ano
       do seu desembolso (Q6 FECHADA em 2026-08-08 — regra abaixo); o alerta
       "regra a confirmar" saiu do escopo

### Ação do Mateus (fora do app)

- [ ] Conversar com Francisco/AJE: **nota mensal** (preferível) e cláusula
  "entrega das NFs do período condiciona a liberação da parcela seguinte"
- [ ] Conferir se as NFs virão com retenção de 11% (Q5)

### Perguntas fechadas pelo contador (2026-08-08, review fiscal do CONTAI-001)

- **Q4 — cartão de crédito — FECHADA**: o custo entra no ano do **pagamento
  da fatura** que contém a parcela (regime de caixa, IN SRF 84/2001 art. 17 —
  em 31/12 sem fatura paga não houve desembolso). Cartão liberado como meio de
  pagamento, com `data_compra` + `data_pagamento` obrigatórias. Parcelado:
  cada parcela entra no ano da SUA fatura paga. Juros/encargos de cartão ficam
  FORA do custo. Comprovação: NF + fatura identificando a compra + comprovante
  de pagamento da fatura. **Ressalva do contador**: tese defensável
  (desembolso), mas existe tese contrária — confirmar com contador humano
  (CRC) antes da primeira declaração que a use.
- **Q6 — NF consolidada cruzando ano — FECHADA**: alocação por parcela, pelo
  ano do pagamento efetivo de cada uma; a NF consolidada sustenta todas as
  parcelas; a data de emissão da NF é irrelevante. Discriminação anual:
  "NF nº X, valor total R$ Z, pago R$ Y no ano". Juros de parcelamento
  destacados ficam fora do custo.

### Perguntas abertas

- **Q5**: as NFs de serviço do empreiteiro estão vindo com retenção de 11%?
  Conferir na primeira nota — define a posição da aferição INSS na US-004

---

## Gate 2 do CONTAI-001 — 2026-08-08 — reviews aprovados com ressalvas

Review técnico (cto-obra) e review fiscal (contador): ambos **APROVADO COM
RESSALVAS**. Q4 e Q6 fechadas (ver Relato 002). Decisões que dependem do
Mateus estão na seção destacada no topo deste arquivo.

### Novos tickets propostos (a priorizar pelo Mateus)

**LOGIN [P0] — proposto como CONTAI-002 (cto-obra)**
O app exige sessão (RLS) e não há tela de login — inutilizável em produção.
Escopo proposto: código de 6 dígitos por e-mail (Supabase Auth, single-user;
decisão do Mateus em 2026-08-10 — sem magic link, que abre no navegador errado
se o app virar nativo),
redirect pós-login, logout, e distinguir o erro "sem sessão" do erro
"banco fora".

**CADASTRO/ONBOARDING DA OBRA [P1] — proposto como CONTAI-003**
O app lê a primeira obra; sem obra cadastrada é beco sem saída. Hoje
`valor_terreno` (compõe o acumulado de Bens e Direitos) só entra por SQL.
Gate fiscal já definido pelo contador: valor do terreno = terreno + ITBI +
escritura/registro.

**CNPJ ALFANUMÉRICO [follow-up — resolver antes de 2027]**
A validação atual só aceita 14 dígitos numéricos; CNPJs emitidos a partir de
jul/2026 são alfanuméricos (IN RFB 2229/2024, a confirmar com o contador).
Sem correção, fornecedor novo fica impossível de cadastrar.

### Requisitos anotados em stories existentes

- **US-004 (relatórios)**: o relatório de aferição INSS deve distinguir
  `retencao_11 = false` ("sem retenção — confirmado", vira provisão) de
  `null` em NF de serviço ("a confirmar" — estado acionável). O "sim" do
  usuário não é prova: a retenção precisa estar destacada no corpo da NF
  (conferência prevista na US-004). Confirmar a IN vigente do SERO antes de
  citá-la em tela.
- **US-003 (conciliação)**: definir a máquina de estados do boleto
  (pago → conciliado → NF vinculada). Reavaliar o headline "Em pendência":
  recomendação do cto-obra é headline só com custo-IRPF em risco
  (quarentena + pago-sem-nota) e exposição INSS em linha separada — hoje a
  soma inclui tudo e pode contar em dobro um boleto registrado + o pagamento
  avulso do mesmo boleto. Ligada à decisão pendente nº 1 (topo do arquivo).
- **US-006 / prestadores PF**: pagamento a contribuinte individual PF gera
  obrigação previdenciária própria do dono da obra (equiparação a empresa,
  Lei 8.212/91 art. 15 § único, a confirmar) — exigirá parecer próprio do
  contador quando a US for especificada.
- **Acervo/export (meta 3)**: upload órfão é possível (o arquivo sobe antes
  do insert; retry cria segundo arquivo; bucket sem delete por design) — o
  export periódico carregará lixo. Mitigação futura: reutilizar o mesmo path
  no retry.
- **Tela 6 (quarentena)**: a linha de imposto pode voltar com a fórmula do
  contador: "até R$ X a mais na venda", onde X = 15% × valor do documento,
  com a palavra "até" e disclaimer de redução/isenção (Lei 8.981/95 art. 21;
  Lei 11.196/05 arts. 39–40). Depende de o Mateus aprovar a volta no mock.
  *(Correção do contador, 2026-08-09: a Lei 8.981/95 art. 21 é a regra de
  alíquotas — 15% a 22,5%, redação da Lei 13.259/2016 —, não o fator de
  redução. O fator de redução é só o art. 40 da Lei 11.196/05. Corrigir a
  citação antes de qualquer texto desses ir para tela.)*

---

## Relato 003 — 2026-08-09 — "Duas obras ao mesmo tempo: uma para vender, outra para morar"

> "criar um ticket para login e criação de nova obra, assim posso gerenciar
> mais de uma obra ao mesmo tempo. Por exemplo, tenho uma casa que estou
> construindo para vender e tenho outra construindo para morar."

Este relato **muda uma premissa do produto**, não pede uma tela. O `CLAUDE.md`
descreve *uma* obra ("a construção da residência do Mateus... com venda futura
provável"); passam a ser duas, simultâneas, uma delas explicitamente para
vender. Consultei o `contador` antes de escrever requisito (Q7–Q10 abaixo).

### Dores extraídas

| ID | Dor | Citação / origem | Prioridade |
|----|-----|------------------|-----------|
| D9 | Não há como cadastrar obra pela interface: `cno`, `matricula` e `valor_terreno` (que compõe Bens e Direitos) só entram por SQL. Login publicado sem isso desemboca em `ObraAusenteError` | "criação de nova obra" | **P0 fiscal** |
| D10 | O código assume obra única (`carregarObra()` = `order by created_at limit 1`); um gasto da obra 2 cai **silenciosamente** na obra 1 | "gerenciar mais de uma obra ao mesmo tempo" | **P0 fiscal** |
| D11 | Ao registrar, ele precisa saber em qual obra está mexendo — hoje a tela não diz | "tenho uma casa... e tenho outra" | P1 fricção |
| D12 | *(derivada do parecer, não do relato)* A dedução da NF de serviço no SERO é amarrada ao **CNO impresso na nota**; o app não captura esse CNO. Nota da obra A entra como dedutível na obra B | contador Q8b | **P0 fiscal** |
| D13 | Não existe login: usar o app publicado exigiria criar usuário no dashboard do Supabase e injetar sessão pelo DevTools do celular | "criar um ticket para login" | **P0 bloqueador de deploy** |

### Hipóteses do relato que **não** viraram requisito

- **"Seletor de obra"** — é a solução proposta, não a dor. A dor é atribuição
  correta; o seletor é uma das formas (e com uma obra só ele não deve existir).
- **"Gerenciar duas obras"** — a palavra "gerenciar" é a porta de entrada da
  gestão de cronograma e orçado vs. realizado, escopo declarado fora do
  produto. O que entra é **segregar**, não gerenciar.

### O que o contador respondeu (parecer 2026-08-09)

**A hipótese principal caiu.** Eu e o lead-engineer suspeitávamos que
"construir para vender" mudasse o tratamento fiscal e obrigasse um campo
**destinação**. Não muda:

- **Q7 — construir para vender vs. para morar**: tratamento **idêntico** no
  registro — custo de aquisição, Bens e Direitos, regime de caixa, ganho de
  capital (IN SRF 84/2001 art. 17) [Certain]. **Aval expresso para cortar o
  campo destinação.**
- **Q7b — equiparação a empresa**: é **taxativa** (loteamento, desmembramento
  ou incorporação), **não** decorre de quantidade de obras nem de intenção
  declarada. Duas casas, duas matrículas, uma unidade cada = **ruído, não
  risco**. Base: RIR/2018, origem DL 1.381/74 e DL 2.072/83; Lei 4.591/64.
  *Correção: o DL 1.598/77 art. 27 que eu havia citado é regra de PJ.*
  O risco real e diferente é **habitualidade** (construir-e-vender repetido →
  tributação como atividade comercial, não ganho de capital): duas obras não
  caracterizam; a terceira e a quarta começam a caracterizar [Likely].
- **Q7c — benefícios de ganho de capital**: o art. 39 da Lei 11.196/05
  (reinvestir em 180 dias) **vale** para imóvel construído para vender, mas é
  **1 vez a cada 5 anos** — usar na venda da casa 1 queima a da casa 2. O fator
  de redução (art. 40) vale, mas com prazo curto rende pouco. **A isenção do
  art. 23 da Lei 9.250/95 (único imóvel até R$ 440 mil) morreu com os fatos**:
  com dois imóveis, nenhum é "o único" [Certain]. Não é requisito de software —
  é informação que muda a conversa com o CRC.
- **Q8 — CNO e aferição**: **um CNO por obra, obrigatório**; nenhuma hipótese
  de dispensa se aplica (há empreiteiro PJ e prestadores PF). A aferição no
  SERO é **isolada por CNO**; NF da obra A jamais abate base da obra B. A
  saída "posição da aferição INSS" deixa de ser um número e vira um relatório
  **por CNO**. Consequência de atribuir errado, e é a mais cara do projeto até
  hoje: base inflada, INSS pago 2x, **a regularização daquele CNO não sai; sem
  regularização não há averbação da construção na matrícula; sem averbação o
  banco do comprador não financia e o cartório não lavra.** *Erro de CNO não é
  erro de imposto — é impedimento de venda.*
- **Q9a — Pagamentos Efetuados**: a ficha é **do declarante, não do imóvel** —
  um lançamento por beneficiário com o **total do ano somando as duas obras**.
  Logo a US-004 precisa de **dois cortes da mesma base**: agregado por CPF
  (para a ficha) e segregado por obra (para a discriminação). Nunca um só.
- **Q9b — Bens e Direitos**: **um item por matrícula**, duas discriminações
  independentes, cada uma com o seu CNO. Terreno + construção da mesma
  matrícula seguem como um item só.
- **Q9c — rateio**: material **pode** ser rateado (exige memória de cálculo
  guardada junto do documento); **NF de serviço não pode** — a dedução é
  amarrada ao CNO impresso, então um documento de serviço pertence a uma obra
  e só. Recibo de PF: um por obra. *Recomendação de processo antes de
  software: pedir nota separada por obra ao fornecedor — o caminhão de areia
  dividido é problema criado na compra.*
- **Q9d — documento sem obra**: não entra em nenhuma discriminação → custo não
  declarado não existe (IN SRF 84/2001 art. 17) → na venda vira ganho
  tributado. **Mas a pendência é o remédio errado**: com duas obras não há
  default seguro e escolher custa um toque → **obra é campo obrigatório e
  bloqueante**, igual ao destinatário CPF. Pendência só no legado da US-005.
- **Q10 — guarda**: o relógio é **por imóvel** — 5 anos do 1º dia do exercício
  seguinte à DAA que declarou aquela venda (CTN art. 173, I). Obra não vendida
  = prazo **indefinido**. Documento rateado sobrevive ao **maior** dos dois
  prazos. O relógio **nunca** dispara exclusão automática — só informa.

### Tickets criados

| Ticket | Prioridade | O quê |
|---|---|---|
| **CONTAI-002** | **P0** — bloqueador de deploy | Autenticação real (código de 6 dígitos no e-mail — decisão do Mateus 2026-08-10, sem magic link —, sessão persistente, redirect pós-login, logout). **Sem regra fiscal** — registrado assim no Gate Fiscal do ticket, em vez de inventar uma |
| **CONTAI-003** | **P0** (promovido de P1) | Cadastro de obra (CNO obrigatório, valor do terreno com ITBI+escritura, edição) + **obra ativa**: o app deixa de assumir obra única. Carrega o Gate Fiscal pesado do parecer |
| **CONTAI-007** | **P0 condicionado** | `cno_referenciado` na NF de serviço, com **bloqueio** se divergir do CNO da obra. Captura irreversível: antes da próxima NF de serviço em produção |

**Por que três e não um.** CONTAI-002 é infraestrutura pura e testável
sozinho; CONTAI-003 é o que destrava a produção e carrega a regra fiscal;
CONTAI-007 é captura de campo no formulário e tem outro dono de risco.
**Mas 002 e 003 são uma única release**: login que desemboca em
`ObraAusenteError` é beco sem saída, então não vão a produção separados.

### Fila revista — 2026-08-09 (1ª revisão) — **SUPERADA**

> **SUPERADA em 2026-08-09 pelas respostas Q11–Q13** (ver "Fila revista — 2ª
> revisão", mais abaixo neste mesmo relato). Mantida aqui só como registro do
> raciocínio e do que eu errei: esta fila apostava que a segunda obra era
> futura, e colocava CONTAI-007 antes do CONTAI-003, de quem ele depende.

*Substituía a proposta do item 3 do bloco de decisões pendentes no topo. O
bloco em si segue intocado — as decisões 1 e 2 continuam esperando o Mateus.*

**push do repo** → `CONTAI-004` + `CONTAI-007` (mesma migration, mesmo
formulário, mesmo mock) → `CONTAI-005` → `CONTAI-002` + `CONTAI-003` (release
única) → `CONTAI-006` → `US-009` → `US-012`.

A regra que move CONTAI-007 para tão cedo é a mesma que já colocou o
CONTAI-004 lá: **tudo que gera retrabalho manual depois do primeiro registro
real entra antes do login ir ao ar**. Capturar `cno_referenciado` hoje custa um
campo; capturar depois custa reabrir documento a documento — e, se a nota já
foi emitida com o CNO errado, não custa retrabalho, custa a nota.

### Novas stories

**US-012 [P1] — Rateio de documento de material entre obras**
Como dono da obra, quero dividir uma NF de material entre as duas obras com um
critério registrado, para que cada imóvel receba a parcela de custo que é dele.
Só **material** (serviço é impossível, ver Q9c). Vínculo N:M documento↔obra.
Aceite:
1. [ ] Percentuais somando 100%, bloqueio se não somarem
2. [ ] Campo textual de **critério do rateio** obrigatório (é a memória de
       cálculo que sustenta a prova — o ônus é do Mateus)
3. [ ] Cada parcela entra na discriminação da sua obra (US-004)
4. [ ] O documento rateado sobrevive ao **maior** dos prazos de guarda (US-011)
5. [ ] Bloqueado para NF de serviço e recibo de PF, com o motivo em tela

**P1 e não P0, deliberadamente**: o contador recomendou **corrigir no
processo, não no software** — pedir nota separada por obra ao fornecedor.
Enquanto isso não existir, um documento compartilhado registrado 100% numa
obra é reaberto depois; é um documento, não uma safra.

**Ação do Mateus (fora do app)**: pedir a fornecedores **nota separada por
obra/entrega**, e recibo de PF separado por obra. Custa zero e elimina o
rateio.

### Ajustes em stories existentes

- **US-004 (relatórios)**: passa a exigir **três saídas com cortes
  diferentes** — discriminação de Bens e Direitos **por matrícula**; posição da
  aferição INSS **por CNO** (nunca somada); Pagamentos Efetuados **agregado por
  CPF somando as duas obras** (a ficha é do declarante), com corte auxiliar por
  obra para conferência. Gerar um relatório só é gerar um relatório errado.
- **US-011 (export do acervo)**: o export precisa ser **segmentável por obra**
  — na venda, o comprador e o contador pedem o dossiê **daquele** imóvel, não o
  acumulado. E o relógio de guarda é por obra (Q10).
- **US-005 (migração da planilha)**: é o **único** lugar onde "documento sem
  obra" vira pendência em vez de bloqueio — o registro legado já nasceu sem
  obra. Nos registros novos, obra é bloqueante.
- **US-006 (prestadores PF)**: a obrigação previdenciária do dono da obra sobre
  contribuinte individual (Lei 8.212/91 art. 15 § único) é **por CNO** — com
  duas obras, dobra. Segue exigindo parecer próprio do contador quando a US for
  especificada.
- **US-002 (lembretes no Calendar)**: o lembrete precisa dizer **de qual obra**
  é o boleto, senão ele paga certo e registra errado.

### Perguntas Q11–Q13 — respondidas pelo Mateus em 2026-08-09

- **Q11 — FECHADA.** *"sim, cada obra tem sua própria unidade"*: matrícula
  própria, **uma unidade autônoma cada**, sem desmembramento/loteamento.
  **Os relatórios do produto continuam valendo** — a equiparação a PJ está
  afastada pelos fatos (contador Q7b: é taxativa). Efeito: os campos
  `unidades_autonomas` e `origem_desmembramento_loteamento` **ficam**, mas o
  aviso do critério 11 do CONTAI-003 **nunca dispara com os fatos de hoje** —
  é rede para uma terceira obra ou um terreno de outra origem, não caminho a
  desenhar no mock nem a testar como caminho comum. **O escopo do contai não
  muda.**
- **Q12 — FECHADA, e derruba a aposta da fila anterior.** *"obra ativa é
  urgência, as duas obras já estão em andamento"*. Não existe janela para
  CONTAI-002+003 irem ao ar com uma obra só e o seletor vir depois. Fila
  refeita abaixo.
- **Q13 — FECHADA na parte do CNO** (parecer do contador chegou em 2026-08-09,
  ver abaixo). Segue aberta só a parte *"as NFs de serviço da AJE trazem o CNO
  impresso?"* — que continua fechando de carona a **Q5** (retenção de 11%),
  aberta desde o relato 002: é a mesma nota, olhada uma vez.

### 2º parecer do contador — 2026-08-09 — obra em andamento SEM CNO

**Decisão: (b) aceitar a obra sem CNO, com pendência de consequência fiscal
explícita. NÃO bloquear.** Fecha o critério 3 do CONTAI-003.

- **CNO obrigatório em 30 dias do início da obra** (Lei 8.212/91 art. 49, II).
  A dispensa do art. 30, VIII **não se aplica** — há mão de obra remunerada.
  Obra sem CNO não está "pendente de cadastro": está com **obrigação vencida**
- **Sem CNO**: notas de serviço não abatem a aferição daquela obra → sem
  aferição não há **CND** (art. 47, II) → sem CND não há averbação → sem
  averbação não há financiamento nem lavratura
- **O custo de aquisição no IRPF é indiferente ao CNO** (IN SRF 84/2001 art.
  17) — **registrar continua valendo, e é por isso que não se bloqueia**:
  bloquear destruiria a apuração que funciona para proteger a que já está
  danificada, e faria isso na obra que acumula documento hoje
- **A alavanca, e ela tem prazo**: exigir do prestador **CNO impresso na nota e
  retificação da EFD-Reinf antes de liberar a próxima parcela**. Depois do
  último pagamento não há mais força para pedir

**Onde eu estava certo e onde estava errado.** A hipótese provisória que eu
tinha escrito ("aceitar com pendência") **se confirmou, mas eu a justificava
por fricção** — "se bloquear, ele volta para a planilha". O motivo correto é
fiscal e mais forte. **E eu tinha aceitado do Mateus, sem questionar, o
"anexa o CNO se existir"** — o contador derrubou: "se existir" ensina que o CNO
é opcional, quando ele é **dívida vencida**. Corrigido no ticket.

**Lacuna do meu ticket, apontada pelo contador**: faltava `data_inicio_obra`.
Sem ela não há como ancorar os 30 dias, definir o período da aferição, nem
escrever *"[N] dias em atraso"* — e aviso sem número não faz agir. Entrou como
campo **obrigatório em toda obra**, com ou sem CNO, junto de
`cno_registrado_em` (a janela entre as duas é o intervalo das notas
irregulares, e é o que permite gerar a lista de cobrança).

**Fronteira de escopo que eu guardo aqui, porque a alavanca a tensiona**: o
app **gera a lista de cobrança** e mostra a consequência. Ele **não** envia
mensagem, não guarda thread, não acompanha status de conversa com o prestador —
comunicação com empreiteiro é escopo declarado fora do produto (CLAUDE.md). A
lista é uma **saída**, como a discriminação anual; a cobrança é do Mateus.

### Fila revista — 2026-08-09 (2ª revisão, depois das respostas Q11–Q13)

*Substitui a "Fila revista" da 1ª revisão, logo acima. O bloco de decisões
pendentes no topo do arquivo segue intocado — as decisões 1 e 2 continuam
esperando o Mateus.*

**0. Ação do Mateus, fora do app — o item mais urgente desta lista e o único
que não é software** *(detalhado com o 2º parecer, 2026-08-09)*: a obra sem
CNO. O prazo **já venceu** (30 dias do início, Lei 8.212/91 art. 49, II) e as
duas obras estão em andamento, então notas já foram emitidas para uma obra sem
CNO. Três ações, nesta ordem:
  1. **Registrar o CNO dessa obra no e-CAC** — antes disso nada mais funciona;
  2. **Antes de liberar a próxima parcela**, exigir do prestador **CNO impresso
     na nota** e **retificação da EFD-Reinf** das notas já emitidas. **Esta é a
     única janela de força**: depois do último pagamento não há mais alavanca;
  3. Confirmar se a obra é **empreitada total** (Q14 abaixo) — se for, o CNO é
     da construtora e as ações 1 e 2 mudam de dono.
Nenhum ticket protege contra isso. Priorizo acima de qualquer código porque o
custo de agir é uma conversa e o custo de não agir é a averbação da matrícula.

**1. push do repo** — inalterado, 5 minutos contra perda irreversível.

**2. Release R1 — a primeira produção do contai, como release única:**
`CONTAI-003` → `CONTAI-007` → `CONTAI-004` → `CONTAI-002` → `CONTAI-005`
(essa é a ordem de **implementação**; o **deploy é um só**).

**3. Depois:** `CONTAI-006` → `US-009` → `US-010` → `US-011` → `US-012`.

#### Por que a fila mudou (e o que eu errei antes)

A fila anterior era `004 + 007` → `005` → `002 + 003`. Ela apostava que a
segunda obra era futura. **A aposta caiu**, e com ela caem três coisas:

1. **CONTAI-003 não pode mais ser fatiado.** Antes ele podia ir a produção com
   uma obra só (critérios 6–9 depois). Com as duas em andamento, os critérios
   6–9 **são** o ticket.
2. **CONTAI-007 não pode mais vir antes do CONTAI-003.** Isso não é urgência,
   é dependência — e era uma **contradição que já existia nos documentos**: o
   CONTAI-007 declarava "bloqueado por CONTAI-003" e mesmo assim aparecia
   antes dele na fila. Com duas obras vivas, o caminho comum do 007 é *"esse
   CNO é o da outra obra"*, que não existe sem cadastro de obra — e a
   mitigação do pre-mortem 1 do 007 (escolher o CNO em vez de digitar) exige a
   lista de CNOs cadastrados. Ordem corrigida: **003 antes de 007**.
3. **CONTAI-005 desce, e pelo motivo inverso do que o colocou no topo.** Ele
   estava cedo por "nada vai ao ar com número enganoso". Com duas obras, **o
   headline do 005 não tem como estar certo antes do 003**: todo número em tela
   passa a precisar do rótulo da obra (Bens e Direitos não soma entre
   matrículas, aferição não soma entre CNOs). Fazer 005 primeiro é produzir um
   número de aparência correta que mistura obras — exatamente a classe de erro
   desta leva. Além disso 005 e 003 tocam a mesma home e o mesmo mock.
   **005 é também o único item de R1 que não captura dado**, logo o único
   descartável se R1 crescer demais: é display, e display se conserta depois.

**O que NÃO mudou, e é a regra que sustenta o resto:** *tudo que gera
retrabalho manual depois do primeiro registro real entra antes de o login ir ao
ar*. O que mudou é a leitura dela. **O contai nunca esteve em produção**;
produção começa com o CONTAI-002 (login). Logo o corte não é "antes ou depois
do 002" — é **"dentro ou fora da primeira release"**. Tudo que é captura
irreversível no ato do registro tem de estar na R1:
- **obra correta** (003) — erro = base de aferição inflada = impedimento de venda;
- **CNO referenciado** (007) — não dá para reabrir: se a nota saiu errada, custa a nota;
- **nº e data de emissão** (004) — reabrir documento a documento.

**Por que isso não é "empurrar tudo para uma release gigante":** a R1 é grande
porque a estreia é grande, não porque eu empilhei desejos. Nada de 006, US-009,
US-010, US-011 ou US-012 entrou nela. O critério de admissão foi um só: *este
campo é impossível ou caro de capturar depois?* Se não for, ficou de fora.

**Consequência de aceitar esta fila, e é desconfortável:** o Mateus fica mais
tempo na planilha. Trocar isso por uma produção antecipada só é possível
sacrificando captura irreversível — que é o oposto da meta 1. Se ele quiser
encurtar, o único corte legítimo é **CONTAI-005** (o headline sai errado por
mais um tempo, e é conserto de tela).

*Pergunta do contador que eu deliberadamente não trago ao Mateus como
requisito*: "quantos imóveis você vendeu nos últimos 5 anos e pretende
repetir?" — importa para habitualidade e para o art. 39, mas é conversa com o
CRC, não pergunta que muda uma linha de software.

### Dores novas, extraídas das respostas de 2026-08-09

O Mateus descreveu um **fluxo** ("cria a obra, anexa o CNO / duas obras na lista
em um dashboard / seleciono a que quero interagir / obra aberta em localstorage
/ abrir direto nela ou sempre abrir a lista"). Fluxo é hipótese de solução. As
dores por trás dele:

| ID | Dor | Citação / origem | Prioridade |
|----|-----|------------------|-----------|
| D14 | A obra gravada no registro pode vir de **estado de cliente que ninguém leu** — storage limpo, celular novo, outro dispositivo, sessão velha. O erro é silencioso e o campo é fiscal | "essa obra aberta fica em localstorage" | **P0 fiscal** |
| D15 | Erro de obra é descoberto tarde e hoje **não tem conserto pela interface**: `obra_id` errado é permanente ou volta a exigir SQL (a D9 pela porta dos fundos) | derivada do pre-mortem 1 do CONTAI-003 | **P0 fiscal** |
| D16 | Ele precisa de uma porta de entrada para escolher a obra do dia — hoje não existe nenhuma | "duas obras na lista... eu seleciono a que quero interagir agora e vai" | P1 fricção |
| D17 | Uma das obras em andamento **não tem CNO**, e o prazo legal já venceu | "não, uma das obras não tem CNO" | **P0 fiscal** — ação do Mateus fora do app + pendência no app (parecer 2026-08-09) |
| D18 | As notas de serviço emitidas para a obra **antes** do CNO sair não abatem a aferição — e hoje nada as identifica. Sem lista, não há o que cobrar do prestador enquanto ainda há parcela para segurar | 2º parecer do contador | **P0 fiscal** → CONTAI-007 |

**Todas as D14–D16 viraram critérios do CONTAI-003** (6, 7, 13, 14, 16), e não
tickets novos: são o mesmo ticket, que agora tem de nascer completo.
**D17 virou requisito depois do parecer**: critérios 2, 3 e 15 do CONTAI-003
(campos `data_inicio_obra`/`cno_registrado_em`, pendência com o atraso em dias,
e a proibição explícita de bloquear). **D18 é a única dor deste lote que
recupera valor em vez de só registrar perda** — vai para o CONTAI-007.

**Requisito de UI → mock obrigatório antes de desenvolvimento** (premissa
mock-first, CLAUDE.md). O CONTAI-003 passa a exigir mock de **cinco** telas, e
três delas não existem em nenhum mock aprovado: **lista de obras** (sem valores
em dinheiro), **afirmação da obra ativa na tela de registro** + **confirmação
de salvo nomeando a obra**, e **correção da obra de um registro já salvo**.
Enquanto o mock não for aprovado pelo Mateus, o CONTAI-003 não entra no
`/develop` — e, como ele é o primeiro item da R1, **o mock é hoje o caminho
crítico do projeto inteiro**.

### Ajustes adicionais em stories existentes (2026-08-09, 2ª revisão)

- **US-012 (rateio de material)**: continua **P1** e continua com a mesma
  recomendação do contador — **corrigir no processo, não no software**. Mas a
  **ação do Mateus deixa de ser preventiva e passa a ser de hoje**: com as duas
  obras em andamento ao mesmo tempo, a entrega de material compartilhada entre
  elas é evento corrente, não hipótese. **Pedir nota separada por obra, agora**,
  custa zero e elimina a story.
- **US-004 (relatórios)**: as duas obras estão em andamento **dentro do mesmo
  ano-calendário**, então a primeira declaração já nasce com duas
  discriminações de Bens e Direitos e duas posições de aferição. Não muda a
  fila (US-004 é de fechamento de ano), mas mata qualquer versão "primeiro uma
  obra, depois generaliza".
- **US-002 (lembrete no Calendar)**: reforçado — o lembrete precisa dizer de
  qual obra é o boleto. Com as duas ativas simultaneamente, o lembrete sem obra
  é convite direto ao erro do D10.
- **CONTAI-007** *(atualizado com o 2º parecer — o ticket precisa ser reescrito
  antes de ir ao `/develop`)*:
  1. **"A nota não traz CNO" deixa de ser exceção** e vira o **caso comum** da
     obra sem CNO. O critério 3 do 007 foi escrito como desvio raro; ele é o
     caminho principal daquela obra;
  2. **A escolha de três opções quebra**. O pre-mortem 1 do 007 mandava trocar
     digitação por escolha entre *"é o CNO desta obra" / "é o da outra obra" /
     "a nota não traz CNO"*. Numa obra sem CNO, **a primeira opção não é
     ofertável** — oferecer é induzir resposta falsa. O mock precisa de um
     estado próprio para essa obra;
  3. **Critério novo — lista de cobrança [P0]**: as notas daquela obra
     emitidas **entre `data_inicio_obra` e `cno_registrado_em`**, com **número,
     data, prestador e valor**. É a **única coisa deste lote que recupera valor
     em vez de só registrar perda**, e ela só vale enquanto houver parcela a
     liberar — depois do último pagamento vira histórico;
  4. **A dependência declarada estava com o motivo errado.** Eu escrevi "sem
     obra cadastrada com CNO não há contra o que validar"; o contador desmontou
     — há trabalho de sobra sem CNO nenhum. **A ordem 003 → 007 se mantém**,
     por outro motivo, material: o 007 precisa de `cno`, `data_inicio_obra` e
     `cno_registrado_em`, que só o 003 cria. Sem `cno_registrado_em` não existe
     a janela, e sem a janela não existe lista de cobrança.

### Perguntas e riscos que o 2º parecer abriu (não viram requisito hoje)

- **Q14 — para o Mateus, e pode trocar o titular da obrigação**: *"a obra sem
  CNO é empreitada TOTAL — a construtora fornece o material e assina a ART da
  obra inteira?"* Se for, **o CNO é dela, não dele**. Não bloqueia o
  CONTAI-003 (os campos e a pendência valem nos dois casos), **mas bloqueia o
  texto da pendência**: cobrar do Mateus uma obrigação de terceiro é pior do
  que não cobrar. É a 1ª pergunta a fazer a ele no próximo ciclo.
- **Pergunta nº 1 para contador humano (CRC) — e é um risco no código que já
  está em produção interna**: o app trata `retencao_11 = não` como **fatal**,
  mas o art. 31 da Lei 8.212/91 dirige a retenção à **empresa** contratante, e
  é discutível que o tomador **pessoa física** esteja obrigado a reter. Se a
  tese do CRC for essa, o produto está classificando como perda algo que pode
  não ser perda — e a exposição INSS do headline (CONTAI-005) fica inflada.
  **NÃO mudar código antes da resposta do CRC** — nem para "corrigir": trocar
  fatal por benigno com base em inferência é o mesmo erro na direção oposta,
  e essa é mais cara, porque some com o alerta.
  Anotado como pergunta obrigatória do bloco "exige contador humano" do
  CONTAI-003, junto das demais que travam a US-004.
- **Risco de processo, e é meu**: os pareceres do `contador` de 2026-08-09 —
  inclusive os **dois textos de tela** que o CONTAI-003 manda copiar — **não
  existem em arquivo neste repositório**; vivem no transcript da sessão. O
  CLAUDE.md manda regra fiscal vir do contador *"nunca de memória"*, e parecer
  que só existe em memória de sessão é a mesma falha com outro nome. **Ação:
  materializar os pareceres em `docs/pareceres/` antes do mock** — senão quem
  desenhar vai reinventar a redação fiscal, que é exatamente o que a regra
  proíbe. Isso vale para os textos de tela mais do que para o resto: eles são
  a parte do parecer que vai para os olhos do usuário.

### Cortado (com justificativa)

- **"Dashboard" com as duas obras** *(2026-08-09 — corte feito contra as
  palavras do próprio Mateus)*: "duas obras na lista em um dashboard". A
  **lista** fica (é navegação: nome, CNO ou pendência de CNO, nº de
  pendências). O **dashboard** não: valor em dinheiro na lista de obras é o
  painel consolidado já cortado, entrando por outra porta. Dois números
  corretos lado a lado estão a uma soma mental de virar um total que não existe
  em declaração nenhuma — e nenhuma decisão de "qual obra eu vou abrir" precisa
  de dinheiro para ser tomada.
- **"Sempre abrir a lista de obras" como comportamento padrão de abertura**
  *(2026-08-09)*: era a alternativa que o próprio Mateus levantou, e eu
  recomendo a outra. Pedágio cobrado em 100% das aberturas para um erro que
  acontece em poucas vira carimbo — ele aprende a tocar sem ler, e aí a tela
  deixa de proteger e passa a **fabricar confiança falsa**. A proteção certa
  fica onde o dano acontece: a afirmação da obra na tela de registro e na
  confirmação de salvo. **A lista continua sendo o comportamento obrigatório
  em um caso**: quando não há obra ativa confiável — aí o app **nunca** escolhe
  sozinho.
- **Campo "destinação (morar / vender)"** — o item mais chamativo do relato, e
  o primeiro a cair. Não altera custo, documentação hábil, regime de caixa nem
  discriminação (contador Q7d, aval expresso). Num produto cuja disciplina é
  "todo campo tem consequência fiscal", um campo decorativo ensina o oposto —
  e o campo `nome` da obra já resolve ("Casa de morar" / "Casa de vender").
- **Painel consolidado / comparação entre as duas obras** — não serve nenhuma
  das três metas **e é fiscalmente enganoso**: Bens e Direitos não soma entre
  matrículas, aferição INSS não soma entre CNOs. Um total das duas obras é um
  número que não existe em nenhuma declaração. Esta é a parte do relato que é
  **conveniência**, e é a que eu corto.
- **`registro_incorporacao` e `alienações nos últimos 5 anos` como campos** —
  o contador sugeriu cinco campos de indício de equiparação; fico com **dois**
  (`unidades_autonomas`, `origem_desmembramento_loteamento`). Incorporação é
  implicada por unidades > 1, e "nº de alienações" é um número sobre o
  titular que decai e envelhece dentro do app — pertence à conversa com o CRC,
  não a um formulário preenchido duas vezes na vida.
- **Validar CNO contra a Receita / e-CAC** e **conferir EFD-Reinf do
  prestador** — fora do alcance do produto; obrigação de terceiro.
- **Multiusuário / convidar o contador para ver a obra** — não pedido, e
  alargaria a superfície da RLS sem servir as três metas. Anotado aqui para
  não voltar como "óbvio" quando o login existir.
- **"Gerenciar" as obras** (cronograma, orçado vs. realizado, status de
  andamento) — escopo declarado fora do produto (CLAUDE.md). A palavra
  "gerenciar" no relato é exatamente a porta por onde isso entra; o que o
  produto faz é **segregar**, não gerenciar.

---

## Gate 2 do CONTAI-003 — 2026-08-10 — reviews aprovados com ressalvas

`contador` e `cto-obra`: **APROVADO COM RESSALVAS**. **Gate 2 concluído** — o
ticket segue para o Gate 3. Nenhuma ressalva ficou bloqueante: a única que era
caiu por verificação de fato.

**Este lote não veio de relato do Mateus.** Veio de review, e registro isso
porque muda o peso das dores: são dores que ele **ainda não sentiu** e sentiria
tarde — uma delas só na declaração, outra só na regularização.

### A ressalva bloqueante que caiu — o backfill de `data_inicio_obra`

O `contador` marcou como **BLOQUEANTE** o backfill da migration
`0004_obra_multipla.sql` (`update obra set data_inicio_obra = created_at::date
where data_inicio_obra is null`), supondo que ele tivesse gravado **data falsa
numa obra real** no banco remoto. O `cto-obra` **repetiu a suposição** e propôs
ação do Mateus para corrigir os dados.

**A premissa factual caiu, verificada na sessão principal**: o dump do banco remoto mostrou que
a tabela `obra` está **VAZIA** — o backfill afetou **zero linhas**. O seed local
traz `data_inicio_obra` explícita, então nem lá o `update` teve efeito. **Não há
dado corrompido. Não há ação do Mateus a fazer.** Ressalva desfeita.

**O texto do parecer segue válido como regra, e integralmente**: `data_inicio_obra`
é campo fiscal — ancora o prazo dos 30 dias (Lei 8.212/91 art. 49, II), o
período da aferição e a frase *"[N] dias em atraso"*. **Data inventada em campo
fiscal é pior do que campo vazio**: vazio pergunta, `created_at` afirma. Caiu a
premissa de fato, não a regra — e a regra já está exercida por escrito no
critério 6 do CONTAI-010.

**O que o processo perdeu aqui, e é meu registro de risco**: dois agentes
propagaram uma suposição sobre o estado do banco **sem consultá-lo**, e a
segunda opinião confirmou a primeira em vez de verificá-la. Quem verificou foi o
Mateus. Revisor que herda a premissa do revisor anterior não é segunda revisão;
é a mesma revisão contada duas vezes.

### Dores extraídas das ressalvas

| ID | Dor | Origem | Prioridade |
|----|-----|--------|-----------|
| D19 | Corrigir a obra de um registro **conciliado** desfaz a apuração da obra de origem **em silêncio**: o custo some do resumo de A, nenhuma pendência captura, e cada linha isolada parece correta. É o D10 chegando pela ferramenta feita para consertar o D10 | `cto-obra` R1 | **P0 fiscal** (latente) |
| D20 | Pagamento com `obra_id` errado é **incorrigível pela interface** depois que a tela de "salvo" fecha — só por URL. É a **D9 pela porta dos fundos**, e a **D15 viva** para metade dos registros | `cto-obra` R2 | **P0 fiscal** |
| D21 | Pagamento salvo **não tem tela que o mostre**: ele não é só incorrigível, é invisível. O Mateus não descobre o erro tarde — não descobre | `cto-obra` R2 | P1 fricção |
| D22 | Terreno, ITBI e escritura entram **sem data de pagamento** → sem regime de caixa → o custo do terreno inteiro compõe **todo** ano-calendário. Terreno pago em 2024 com ITBI em 2025 infla a situação em 31/12/2024 | `contador` R2 | **P0 fiscal** |

**D19 e D22 têm dano ZERO hoje** e eu registro isso em vez de esconder: nada na
UI cria `pagamento_documento`, e o app só mostra o ano corrente. Elas são P0
pela consequência quando o gatilho existir — US-003 e US-004, respectivamente —,
não por urgência de calendário. **Por isso nenhuma das duas entra na R1.**

### Tickets criados

| Ticket | Prioridade | O quê | Onde entra |
|---|---|---|---|
| **CONTAI-008** | **P0 condicionado** | Mover registro entre obras não pode quebrar o vínculo `pagamento_documento` em silêncio. As três saídas possíveis (mover o par / bloquear / pendência nas duas obras) têm consequência fiscal distinta → **Gate Fiscal obrigatório** antes do `/develop` | **Fora da R1** — antes/junto da **US-003**, que não fecha sem ele |
| **CONTAI-009** | **P0** | Detalhe do pagamento (`/pagamento/[id]`), com a correção de obra alcançável a partir dele. **Não é feature nova: é a metade não cumprida do critério 13 do CONTAI-003.** Precisa de mock | **Dentro da R1**, depois do 003 |
| **CONTAI-010** | **P0** | Datas de pagamento do terreno, do ITBI e da escritura — regime de caixa aplicado ao maior custo isolado da obra | **Fora da R1** — obrigatório antes da **US-004** |

**Regra nova de admissão na R1, e ela nasce aqui**: *critério de aceite de item
da R1 que não foi cumprido volta como ticket da R1*. Sem ela, "fatiar o que não
coube" vira a porta por onde a R1 encolhe no papel e a dívida some do radar.
É o único motivo de o CONTAI-009 entrar — e note que ele **não** captura dado
irreversível, que era o critério anterior.

**Por que o CONTAI-010 é P0 e mesmo assim fica fora da R1**: são **duas obras**,
um formulário visto duas vezes na vida, três datas. Reabrir dois cadastros é
barato; não é safra de documentos. Metê-lo na R1 seria contradizer a regra que
mantém a R1 fechada — e essa regra vale mais do que economizar uma reabertura de
tela. **Carona explícita**: se o mock do CONTAI-003 for reaberto por qualquer
outro motivo antes do merge, os três campos entram junto.

### Acrescentado ao CONTAI-007 (sem ticket novo)

Três itens, todos já com desenho ou parecer prontos — nenhum pede mock novo:

1. **Ligar `cnoReferenciado` na tela de correção de obra** — hoje é `null`
   **hard-coded** em `app/documento/[id]/obra/page.tsx:100`, com comentário
   explicando que o campo nasce no 007. **Se o 007 popular a coluna e ninguém
   trocar o literal, a revalidação nunca passa a barrar e ninguém percebe**:
   nada quebra, nenhum teste fica vermelho, e a porta que leva NF de serviço
   para a obra errada segue aberta — agora com o agravante de que o sistema
   **tinha** o dado para barrar. Exige **teste que falha se o literal voltar**;
   sem ele o critério é um comentário, e comentário não protege nada.
2. **Tela 14 do mock** (lista das notas emitidas sem CNO) e o link *"Ver as [N]
   notas desta obra emitidas sem CNO"* na tela 13 — **já aprovados pelo Mateus
   em 2026-08-10**, adiados do CONTAI-003 porque dependem de `numero`,
   `data_emissao` (CONTAI-004) e `cno_referenciado` (007). É o **único item
   deste lote que recupera valor** em vez de só registrar perda.
3. **Aviso ao pagar favorecido PJ em obra sem CNO** — **só a frase da alavanca
   do parecer, sem atrito adicional**: sem caixa a marcar, sem toque a mais,
   sem bloqueio. Razão de existir: **é o único momento em que o app sabe que
   ainda há parcela a pagar**, e a alavanca morre no último pagamento.
   Restrições: só **PJ** (em PF a frase é ruído, e ruído fabrica cegueira ao
   aviso) e só obra **sem CNO**.

**Consequência de ordem que isso expôs**: o item 2 lista as notas por **número e
data de emissão**, campos do **CONTAI-004**. A "2ª revisão" da fila punha 007
antes de 004 sem motivo declarado — **é a mesma classe de contradição que já
tinha posto o 007 antes do 003**. Corrigido: dentro do par, **004 primeiro**.

### Dívidas nomeadas do CONTAI-003 (nenhuma segura o Gate 2)

- **Critério 13 fica meio cumprido** — vale para documento, não para pagamento.
  Nomeado, não carimbado. Resto no CONTAI-009.
- **Desvio formal de mock**: a tela de edição `/obras/[id]` **não existe no mock
  aprovado**; foi **composta na implementação a partir de blocos aprovados**
  porque o critério 5 a exige. O `cto-obra` carimbou **com ressalva**. **O aval
  do Mateus continua devido na revisão da release** — registro o desvio como
  desvio, e não como equivalência: mock-first pede aprovação **explícita**, e
  reuso de blocos não é aprovação. Sem registro, "compus de blocos aprovados"
  vira o precedente que dispensa mock na próxima vez.
- **Gap conhecido — terceiro gatilho da equiparação**: o Gate Fiscal lista três
  (unidades > 1, desmembramento/loteamento, **registro de incorporação**); só os
  dois primeiros viraram campo. O `contador` está certo em dizer que
  "incorporação é implicada por unidades > 1" **não é implicação perfeita**.
  **Fica como gap aceito, não como ticket**: os fatos de hoje afastam a hipótese
  (Q11 — duas matrículas, uma unidade cada) e o critério 11 produz **aviso, não
  bloqueio**, então o falso-negativo custa um aviso que não aparece numa
  situação que o Mateus saberia antes do app. **Vira ticket se aparecer uma
  terceira obra.**
- **Materializar o texto alternativo de empreitada total** em
  `docs/pareceres/2026-08-09-obra-sem-cno.md` — ele existe, redigido pelo
  `contador` no Gate 2, e vive só no transcript. É o mesmo risco de processo já
  registrado no Relato 003: parecer em memória de sessão é "regra fiscal de
  memória" com outro nome.

### Fila revista — 2026-08-10 (3ª revisão)

*Substitui a "2ª revisão" do Relato 003. O bloco de decisões pendentes no topo
segue intocado — as decisões 1 e 2 continuam esperando o Mateus.*

**0. Ação do Mateus, fora do app — inalterada e ainda o item mais urgente**: a
obra sem CNO (registrar no e-CAC com a **data real de início**; exigir CNO
impresso + retificação da EFD-Reinf **antes de liberar a próxima parcela**).
**Com uma ressalva nova: responda a Q14 primeiro** — se for empreitada total,
esta ação inteira **troca de dono**.

**1. Q14 ao Mateus** — custa uma frase e é pré-requisito do texto que vai a
produção. Subiu de "próximo ciclo" para **primeira coisa a fazer**.

**2. Mock do CONTAI-009 ao Mateus** — em paralelo com o item 3. **É o novo
caminho crítico da R1**, pelo mesmo motivo que o mock do CONTAI-003 foi: nada
entra no `/develop` sem ele, e a aprovação não depende de nós.

**3. Release R1 (deploy único), ordem de implementação:**
`CONTAI-003` ✅ *(Gate 2 concluído)* → `CONTAI-004` + `CONTAI-007` (nesta ordem
dentro do par) → `CONTAI-009` → `CONTAI-002` → `CONTAI-005`.

**4. Depois da R1:** `CONTAI-010` *(antes da US-004)* → `CONTAI-006` →
`US-003` + `CONTAI-008` *(juntos — a US-003 não fecha sem o 008)* → `US-009` →
`US-010` → `US-011` → `US-012`.

#### O que mudou em relação à 2ª revisão, e por quê

1. **CONTAI-003 sai da fila** — Gate 2 concluído, segue para o Gate 3.
2. **004 e 007 trocam de ordem dentro do par.** Não é preferência: o critério 8
   do 007 (lista de cobrança) mostra **número e data de emissão**, que são
   campos do 004. Deixa de ser "economia de migration" e passa a ser
   dependência de conteúdo.
3. **CONTAI-009 entra na R1** — pela regra nova de admissão (dívida de critério
   de aceite de item da R1). É o **único** acréscimo à R1 deste lote.
4. **CONTAI-008 e CONTAI-010 ficam fora da R1**, apesar de P0. Os dois têm dano
   **zero** hoje e gatilho conhecido (US-003 e US-004). Amarrá-los ao gatilho
   protege mais do que antecipá-los: dentro da R1 eles competiriam por atenção
   com captura irreversível, que é o que a R1 existe para proteger.
5. **CONTAI-005 continua sendo o único corte legítimo** se a R1 crescer demais.
   Com o 009 dentro, ela cresceu — e o 005 segue sendo o único item que **não
   captura dado**. Display se conserta depois; captura, não.

**O que NÃO mudou, e sustenta o resto**: *tudo que gera retrabalho manual depois
do primeiro registro real entra antes de o login ir ao ar*, e o corte é **dentro
ou fora da primeira release**.

### Cortado no Gate 2 (com justificativa)

- **Ação do Mateus para "corrigir" `data_inicio_obra` no banco remoto** —
  proposta pelo `cto-obra` em cima de premissa que não se sustenta. **Não
  existe dado a corrigir.** Cortado, e registrado aqui para não voltar como
  pendência fantasma numa próxima leitura dos pareceres.
- **Histórico/auditoria de movimentações entre obras** (levantado ao redor do
  CONTAI-008) — tentador e não serve nenhuma das três metas hoje. Só volta se o
  `contador` exigir trilha para sustentar declaração retificadora.
- **Campo para "registro de incorporação"** — ver gap aceito acima.
- **Inventário/busca de tudo que foi registrado** dentro do CONTAI-009 — é a
  **US-009 [P1]** e continua fora da R1. O 009 entrega o **detalhe de um
  registro**, alcançável dos pontos que já existem; não entrega lista.
- **Edição geral de campo de pagamento** (valor, data, favorecido) no detalhe do
  CONTAI-009 — só a **obra** é corrigível. Abrir edição de campo fiscal sem
  parecer é como se cria erro novo consertando erro velho.
- **Anexar escritura, ITBI e matrícula ao acervo** (levantado ao redor do
  CONTAI-010) — é meta 3 e é legítimo, mas é outro ticket: o 010 captura
  **quando foi pago**, não o documento. Anotado para não voltar como "óbvio".

### Fila revista — 2026-08-16 (4ª revisão)

*Substitui a "3ª revisão" do Gate 2 do CONTAI-003. O bloco de decisões
pendentes no topo segue intocado — as decisões 1 e 2 continuam esperando o
Mateus.*

**0. Ação do Mateus, fora do app — inalterada e ainda o item mais urgente**: a
obra sem CNO, com a Q14 antes (se for empreitada total, a ação troca de dono).

**0.1. ~~`git push`~~ FEITO (2026-08-16, `94bed1a..2572c01`).** O repositório
remoto estava em 2026-08-09: sete dias de trabalho — o Gate 2 inteiro do
CONTAI-003, os pareceres e as migrations — existiam **só no Mac do Mateus**. Era
a tese do CONTAI-011 aplicada a nós mesmos. Registrado aqui porque a lição vale
mais que a tarefa: *a meta 3 falha primeiro por onde ninguém está olhando.*

**1. Q14 ao Mateus** — inalterada.

**2. Mock do CONTAI-009** — inalterado, caminho crítico da R1.

**2.1. Mock do CONTAI-011** — pode ser desenhado **em paralelo com a R1**,
porque não compete por implementação e a aprovação não depende de nós (mesma
jogada do mock do 009). Escopo mínimo: a linha de estado *"último export: há N
dias"* na home, em dois estados, e o disparo do dossiê por obra.

**3. Release R1 (deploy único), ordem de implementação — INALTERADA:**
`CONTAI-003` ✅ → `CONTAI-004` + `CONTAI-007` (nesta ordem) → `CONTAI-009` →
`CONTAI-002` ✅ *(implementado fora de ordem, a pedido do Mateus; os quatro
gates fechados em 2026-08-16 — Gate 4 DONE COM RESSALVAS, ver o fim deste
arquivo)* → `CONTAI-005`.
**A R1 ganhou uma condição de deploy que não existia**: `CONTAI-013`
(configuração de produção do login). Sem ele o CONTAI-002 sobe e não loga
ninguém, em silêncio.

**⚠️ ADENDO 2026-08-16 — a R1 ganhou UM item.** `CONTAI-014` (manifest de PWA +
`apple-touch-icon`) **entra na R1**, por decisão do Mateus. Vai **junto do
CONTAI-002**, não no fim: os dois fecham o mesmo critério.
Fila da R1 fica: `CONTAI-003` ✅ → `CONTAI-004` + `CONTAI-007` → `CONTAI-009` →
`CONTAI-002` ✅ + **`CONTAI-014`** → `CONTAI-005`.
**A frase "nada foi acrescentado à R1" da 4ª revisão está SUPERADA** — mas só
por este item, e pela exceção que já existia (dívida de critério de aceite de
item da R1, a mesma que admitiu o CONTAI-009). A regra de admissão original —
*captura irreversível no ato do registro* — segue intacta e não foi invocada
aqui. Justificativa completa na ficha do CONTAI-014, no fim deste arquivo.

**3.1. Infraestrutura de deploy** (fora do escopo da R1, condição para ela ir ao
ar): conectar a Vercel + **`CONTAI-012` (manter o projeto Supabase acordado)**.

**4. Depois da R1:** `CONTAI-010` *(antes da US-004)* → **`CONTAI-011` +
`US-010`** *(par de meta 3: mesma superfície de leitura do bucket)* →
`CONTAI-006` → `US-003` + `CONTAI-008` *(juntos)* → `US-009` → `US-012`.

#### O que mudou em relação à 3ª revisão, e por quê

1. **A US-011 (CONTAI-011) sobe de penúltima para o 2º item pós-R1**, pela regra
   que o backlog já usa: *o irreversível vem antes do caro*. Não fazer a US-003
   custa pendência que não fecha — visível e recuperável. Não fazer a US-011
   custa acervo que não volta.
2. **A US-011 NÃO entra na R1**, apesar do argumento do auto-pause. Hoje ela
   protege um bucket vazio: o contai nunca esteve em produção e a `obra` remota
   estava vazia no Gate 2. O risco nasce no deploy. Some-se o Gate Fiscal com 5
   ressalvas bloqueantes e o fato de a decisão de segurança do job (service role
   vs. sessão) preceder o CONTAI-002.
3. **O auto-pause vira `CONTAI-012`** — 30 minutos, pré-requisito de deploy e
   não de release. Resolve disponibilidade; **não** resolve acervo, e o ticket
   diz isso com todas as letras para não virar falsa sensação de proteção.
4. **A US-011 passa a exigir mock** (linha de estado do último export na home),
   desenhável em paralelo com a R1.
5. **Não existiam `docs/tickets/CONTAI-004.md`, `005` nem `006`** — o próximo
   item da R1 não tem ticket escrito. Antes de rodar `/develop` no par 004+007,
   o 004 precisa passar pelo `/tickets-req`.

### Achados de 2026-08-16 que viram item de backlog

- **[P1] Path do anexo derivado do sha256 do conteúdo, não de UUID.** Hoje
  `subirParaAcervo` (`lib/data.ts:364`) gera `crypto.randomUUID()` a cada
  chamada e o upload precede o insert — retry ou abandono deixam objeto órfão, e
  o bucket não tem policy de delete. A mitigação antes anotada aqui (reutilizar o
  path no retry) **cobre só metade**: não cobre o usuário fechar o app entre o
  upload e o insert. Path por hash faz o segundo upload colidir, e a colisão se
  trata como sucesso; de brinde, deduplica anexo enviado duas vezes.
- **[P1] Categoria de "documento da obra sem favorecido e sem pagamento".**
  Decisão do Mateus em 2026-08-16 ao resolver a divergência dos três revisores
  sobre o órfão: objeto sem vínculo é bloqueante **até ser resolvido, descartado,
  ou anotado como ok de manter sem vínculo**. O terceiro destino é categoria
  nova, e é exatamente o que o F4 do parecer fiscal de 2026-08-16 já exigia —
  alvará, ART, matrícula, habite-se nascem sem favorecido e sem pagamento.
- **[P0 informativo] O "venda + 5 anos" do `CLAUDE.md` está subdimensionado em
  ~1 ano e 9 meses.** O relógio é o do CTN art. 173, I, ancorado na **última DAA
  que declarou qualquer parcela do ganho** — venda em 2028 → prazo até
  **31/12/2034**. E há um **segundo relógio previdenciário**, do CNO. Guardar o
  maior dos dois. Parecer completo em
  `docs/pareceres/2026-08-16-gate-fiscal-contai-011.md`.
- **[P1] O acervo pode estourar o free tier de origem antes do fim da obra.**
  Estimativa do `cto-obra`: 400–600 arquivos, 0,5 a 2 GB; o storage gratuito do
  Supabase é [Likely] ~1 GB. É outro relógio, independente do auto-pause.
- **[P2] Aviso de cópia digital vs. papel no fluxo de captura (CONTAI-001).**
  Cópia simples não substitui o original em fiscalização administrativa (Lei
  12.682/2012, Decreto 10.278/2020 — exigem ICP-Brasil); NF-e/NFS-e são exceção,
  nascem digitais. Textos de tela **prontos e copiáveis** no parecer de
  2026-08-16. Vale para recibo de PF, contrato, ART e comprovante impresso.
- **[P2] Manifest de PWA não existe.** Não há `app/manifest.ts` nem
  `apple-touch-icon`, e o `viewport` tem `maximumScale: 1`. "Adicionar à Tela de
  Início" não garante modo standalone — e o container do ícone no iOS tem
  storage separado do Safari, então o critério 3 do CONTAI-002 pode passar no
  Safari e falhar no ícone, que é o uso real.
  → **Reprecificado para [P1] e promovido a `CONTAI-014` no Gate 4 do
  CONTAI-002 (2026-08-16)**: deixou de ser conveniência quando virou a única
  coisa entre o critério mais importante do login e o modo de uso real.

---

## Gate 4 do CONTAI-002 — 2026-08-16 — DONE COM RESSALVAS

Validação completa em `docs/tickets/CONTAI-002.md`, seção "Gate 4". Os oito
critérios passaram, com evidência nomeada por teste; **nada volta ao Gate 1**.
O que fica registrado aqui é o que sobrou fora do código.

### Aprovação do Mateus registrada neste gate (escopo exato)

Perguntado se duas mudanças feitas **depois** da aprovação do mock de
2026-08-10 contavam como divergência — (1) a sessão sair do `localStorage` para
**cookie via `@supabase/ssr` + `proxy.ts`**, e (2) o **botão de atalho de
desenvolvimento** na tela `/entrar` —, o Mateus respondeu **"mocks ok"**
(2026-08-16). Vale para **esses dois itens e nada mais**. Não aprova mock do
`CONTAI-009` nem do `CONTAI-011`: esses mocks **não existem** (`design/mocks/`
tem 001, 002 e 003) e seguem pendentes de `/design`.

**Ciência registrada, do CONTAI-003** (fora deste gate, aqui pelo histórico): o
Mateus deu ciência da alteração feita no mock do CONTAI-003 **depois** da
aprovação, por ordem do contador — o atraso do CNO conta do **vencimento**
(início + 30 dias), então "148 dias" virou **118**, e "Salvar mesmo assim"
deixou de ser caixa obrigatória e virou **rótulo de botão**.

### Tickets novos propostos (precisam passar pelo `/tickets-req`)

- **`CONTAI-013` [P0 de deploy] — Configuração de produção do login.** Os quatro
  passos de dashboard do Supabase (template Magic Link com `{{ .Token }}` e sem
  `{{ .ConfirmationURL }}`; conta do Mateus criada à mão com Auto Confirm; **SMTP
  próprio**; Site URL), mais **captcha no Attack Protection**. Hoje isso existe
  só como parágrafo no `CLAUDE.md` — e parágrafo em arquivo de contexto não tem
  dono nem fila.
  **Por que é P0 e não checklist**: o SMTP embutido do Supabase manda 2 e-mails
  por hora e **só entrega para membros do time do projeto**. Se o Gmail do
  Mateus não for membro, o primeiro login em produção não dá erro — o código
  simplesmente **nunca chega**, com os 31 testes verdes. É a falha silenciosa
  mais cara do CONTAI-002: um P0 que entrega zero.
  O captcha entra no mesmo ticket porque o domínio de produção não é protegível
  no plano Hobby da Vercel: qualquer um com a URL queima a cota de envio e
  **tranca o login do Mateus** — que é o risco real do login aberto, e não a
  enumeração de e-mail (ver decisão abaixo).
- **`CONTAI-014` [P1] — Manifest de PWA + `apple-touch-icon`.** Promovido do
  achado [P2] acima. Sem ele, "Adicionar à Tela de Início" não garante
  standalone, e o container do ícone no iOS tem storage separado do Safari — ou
  seja, o critério 3 do CONTAI-002 ("fechar e reabrir o PWA não pede login de
  novo"), que o próprio ticket chama de o que mais importa, **não é verificável
  no modo de uso real**. Junto vai o que o pre-mortem 1 do CONTAI-002 já exigia
  e ninguém fez: **testar o login no celular real antes do DONE de verdade**.
  → ~~**Pergunta ao Mateus: entra na R1?**~~ **RESPONDIDA — SIM, entra**
  (Mateus, 2026-08-16).
  **Fundamento, e ele importa para não virar precedente solto**: o CONTAI-014
  não entra por ser P1 nem por ser barato — entra pela **mesma exceção que
  admitiu o CONTAI-009**, aberta no Gate 2 do CONTAI-003: *"dívida de critério
  de aceite de item da R1 volta como ticket da R1"*. O critério 3 do CONTAI-002
  é item da R1 e não é verificável no modo de uso real sem o manifest. Não é
  porta nova; é a porta que já estava aberta.
  A regra de admissão da R1 — *captura irreversível no ato do registro* —
  **segue intacta**, e o CONTAI-014 não a invoca.

### Decisão tomada no gate (não vira ticket)

- **A mensagem "Não existe conta com esse e-mail no contai" FICA como está.**
  Ela permite enumerar e-mails, e o ganho de trocar por texto neutro é quase
  nada num app pessoal; o custo é real — e-mail digitado errado com uma mão só
  ficaria indistinguível de "o código não chegou". O risco de verdade do domínio
  aberto é a **cota de envio queimada**, que mensagem neutra não toca. Quem
  resolve é o `CONTAI-013`.
- **Sourcemap do servidor com a senha de desenvolvimento: ressalva, sem
  ticket.** `contai-local-123` aparece em `.next/server/chunks/ssr/*.js.map`; o
  bundle do cliente está limpo. A mesma string já está publicada em texto em
  `supabase/seed.sql`, versionado; sourcemap de servidor não é servido ao
  navegador; e o atalho exige Supabase local em runtime. Abrir ticket seria
  trabalho que não serve nenhuma das três metas e não reduz exposição nenhuma.

### Dívidas da implementação fora de ordem (002 antes de 004, 007 e 009)

- **[P1] O E2E do login depende do formulário de `/adicionar/pagamento`.** O
  teste da tela 6 (sessão que cai no meio do preenchimento) preenche aquele
  formulário campo a campo. `CONTAI-004`, `007` e `009` deveriam ter vindo antes
  e mexem nessa área: quando mexerem, **quebra um teste de login**, e o sintoma
  vai parecer regressão de autenticação. Quem pegar esses tickets já sabe onde
  olhar.
- **[P1] `proxy.ts` é o novo ponto de entrada de toda navegação.** Rota nova que
  precise ser pública entra em `PUBLICAS`; hoje só `/entrar` está lá. Cada
  navegação custa uma chamada ao GoTrue — preço consciente da sobrevivência ao
  ITP do Safari, mas é latência a mais em rede ruim de canteiro. Território do
  `cto-obra` quando aparecer.
- **Chore do designer (sem ticket): corrigir o texto da tela 7 do mock
  `CONTAI-002.html`** — ele ainda diz "para voltar, você precisa do **link** no
  e-mail", texto da era do magic link. A decisão do Mateus de 2026-08-10 trocou
  link por código, e o app diz "código". O mock é que ficou desatualizado, e
  mock desatualizado é a próxima divergência falsa que alguém vai reportar.

### Ressalvas R5–R7 do Gate 4 do CONTAI-002 — gravadas em 2026-08-17

*O Gate 4 do CONTAI-002 rodou **duas vezes em paralelo**, por erro de
orquestração da sessão principal: um `po` foi spawnado para o gate enquanto o
agente do `/develop` já o executava e tinha sido informado de que era dono
exclusivo da árvore. Não houve commit sobrescrito porque os dois adicionaram
arquivo por arquivo, mas era exatamente a condição que o `CLAUDE.md` proíbe. Os
dois chegaram ao mesmo veredito; estes três achados vieram só do segundo e
ficaram fora do backlog na hora porque a árvore estava ocupada.*

- **R5 [P1] — Corrida de refresh token, e é o achado mais concreto dos três.**
  [Likely] Depois da migração para cookie existem **dois renovadores**: o browser
  client (`autoRefreshToken: true`) e o `proxy.ts`, que renova a cada navegação.
  Com `enable_refresh_token_rotation = true` e `refresh_token_reuse_interval = 10`,
  reapresentar um token já usado **fora da janela de 10s revoga a sessão**.
  **Sintoma**: *"o app me deslogou do nada"* — intermitente, invisível para o
  E2E, e atacando justamente o **critério 3**, que é o que o ticket chama de o
  que mais importa. **Mitigação barata**: subir o intervalo para 30s. É knob de
  dashboard, chamada do `cto-obra`, e entra no runbook do `CONTAI-013`.
- **R6 [P2] — A premissa do ITP é mais fraca do que o enunciado.** [Likely] o
  teto de 7 dias do Safari **não se aplica a web app adicionado à tela de
  início** — que é justamente o cenário primário do ticket. Isso **não invalida**
  a migração para cookie (o mecanismo `Set-Cookie` server-side está correto por
  construção e foi conferido linha a linha), mas significa que o argumento que
  motivou a decisão vale sobretudo para o **uso pelo Safari**, não pelo ícone.
  Registrado para a próxima decisão não herdar a premissa forte sem conferir.
- **R7 [P2] — Duas dívidas técnicas conscientes, não corrigidas para não inflar
  o ticket**: o matcher do `proxy.ts` não exclui assets de `public/` (teórico até
  o PWA existir — vira real com o `CONTAI-014`), e o `erro={registro.erro ?? {…}}`
  cosmético nas duas telas de adicionar.

### Fila revista — 2026-08-17 (5ª revisão)

*Substitui a 4ª revisão e o adendo de 2026-08-16. Incorpora a reordenação
proposta pelo `cto-obra` e aprovada pelo Mateus, e a separação entre fila de
implementação e bloco de deploy proposta pelo `po`.*

**0. Ação do Mateus, fora do app**: a obra sem CNO, com a **Q14** antes.

**1. Q14 ao contador/Mateus** — inalterada, e é pré-requisito de texto que vai a
produção.

**2. Fila de implementação da R1:**
`CONTAI-003` ✅ → **`CONTAI-014` (código)** → `CONTAI-004` + `CONTAI-007` →
`CONTAI-009` → `CONTAI-002` ✅ → `CONTAI-005` *(ou corte automático)*.

**Por que o 014 foi para a frente** (decisão do Mateus, 2026-08-17): com o 002 já
implementado, o slot "junto do 002" perdeu sentido de sequência. O 014 é o único
item restante que não depende de mock em desenho, não toca formulário nenhum, é
XS de código, e **destrava a verificação no aparelho real do critério 3 do
CONTAI-002** — dívida aberta e envelhecendo. Os conjuntos de arquivos são
disjuntos, então o risco da troca é nenhum que o `cto-obra` enxergue.

**3. Bloco de deploy** (fora da fila de implementação; condição para produção):
conectar a Vercel → `CONTAI-012` → **deploy de preview** → `CONTAI-013` +
`CONTAI-014` (prova no aparelho real, mesmo deploy) → **deploy de produção**.

**4. Depois da R1:** `CONTAI-010` → `CONTAI-011` + `US-010` → `CONTAI-006` →
`US-003` + `CONTAI-008` → `CONTAI-015` *(captcha, P2)* → `US-009` → `US-012`.

#### O que mudou, e por quê

1. **`CONTAI-013` e `CONTAI-014` deixam de ser "itens da fila da R1" e viram
   bloco de deploy.** A parte de código do 014 é independente e cabe em qualquer
   ponto (XS); a **verificação** de 013 e 014 roda **uma vez, junto, no primeiro
   deploy de preview**. Pôr o 014 "junto do 002" na fila de implementação, como
   estava no adendo de 2026-08-16, **não é executável**: o 002 já está
   implementado, e o que falta do 014 não é código.
2. **O captcha saiu do `CONTAI-013` e virou `CONTAI-015` [P2]**, por decisão do
   Mateus em 2026-08-17. O `po` recomendara cortar para P2 sem ticket; o Mateus
   optou por ticket próprio. Motivo técnico da separação: ligar o captcha no
   dashboard **sem shipar o widget derruba 100% dos logins**, e o CI não pega —
   a suíte roda contra o stack local com captcha desligado.
3. **`CONTAI-005` ganha prazo de corte automático**: sem resposta à **decisão
   pendente nº 1** até o merge do `CONTAI-009`, ele sai da R1. A decisão está
   aberta desde 2026-08-08 e é o único item da release que não captura dado.
4. **O par `004 + 007` NÃO está pronto para o `/develop`** — o 007 precisa de
   revisão de Passo 1. Ver abaixo.

#### ⚠️ O CONTAI-007 precisa de revisão antes do `/develop` — seis pontos

Apurados pelo `po` e pelo `cto-obra` em 2026-08-16/17. Ele **não** foi escrito
antes do CONTAI-003 (é de 2026-08-10 e já traz a seção "Atualização 2026-08-10");
o eixo real de desatualização é outro.

- **(a) Contradição interna, a mais cara.** "Dependências → Mock" diz que os
  critérios 8 e 9 não pedem mock novo — **e isso está correto**: as telas 13 e 14
  existem e estão aprovadas em `design/mocks/CONTAI-003.html`. Mas os
  **critérios 1–3 — a captura do `cno_referenciado` no formulário, que é o núcleo
  do ticket — não estão desenhados em lugar nenhum**, e o Teste do Canteiro do
  próprio ticket fecha com *"APROVADO — condicionado ao mock sem campo livre de
  14 dígitos"*. Corrigir para: **exige mock, no mesmo passe do CONTAI-004**.
- **(b) Não incorporou o item 2 da atualização que declara ter incorporado.** O
  Relato 003 derrubou a escolha fixa de três opções: em obra **sem** CNO, *"é o
  CNO desta obra"* **não é ofertável — oferecer é induzir resposta falsa**; e com
  N obras a oferta é **a lista de CNOs cadastrados**, não "a outra obra". O
  pre-mortem 1 e os critérios 1–3 ainda descrevem as três opções. Os itens 1, 3 e
  4 daquela atualização entraram; o **2 não**.
- **(c) Condição de urgência vencida.** "obrigatoriamente antes de existir uma
  segunda obra no sistema" — as duas obras existem desde a Q12 e o CONTAI-003 já
  entregou multi-obra. A condição que ainda vale é só *"antes da próxima NF de
  serviço registrada em produção"*, e a fila já a satisfaz por construção.
- **(d) Dependência declarada satisfeita cedo demais.** "Bloqueado por:
  CONTAI-003 — já satisfeito (Gate 2 concluído)". **Gate 2 não é o fim do
  `/develop`.** Confirmar em que gate o 003 está antes de tratar como satisfeito.
- **(e) Não menciona a R4 do Gate 4 do CONTAI-002** (o E2E de login preenchendo
  formulário de registro). Anotado nos dois tickets — com a ressalva de que o
  `cto-obra` verificou o teste e **a dívida está superdimensionada**: ele preenche
  o formulário de *pagamento*, que o 004 não toca, e o aviso do 007 só dispara com
  favorecido **PJ** enquanto o teste usa **PF**.
- **(f) Complexidade "S → M"** estimada antes de o 004 virar ticket. Reavaliar no
  Gate 2.

#### Migrations: uma por ticket

O `cto-obra` **discorda da frase do CONTAI-007** ("duas migrations na mesma
tabela é desperdício"): o custo de uma migration é zero (`db reset` roda todas) e
o benefício é real — cada gate revisa um diff autocontido, e se o 007 atrasar a
migration do 004 não embarca coluna morta. A convenção do repo já é
**1 migration ↔ 1 ticket** (0004 = CONTAI-003). **O argumento verdadeiro do
"junto" nunca foi a migration: é o mock e o formulário**, e esse se mantém.

## Incidente de produção — 2026-08-17 — `permission denied for table obra`

**O que aconteceu.** App publicado, Mateus logou com sucesso e toda leitura
devolveu `{"code":"42501","message":"permission denied for table obra"}`. Não
era RLS — policy que nega devolve **lista vazia**; `permission denied for table`
é o Postgres barrando **antes** da policy, por falta de `GRANT`. Confirmado no
próprio projeto remoto: o PostgREST devolveu o diagnóstico na dica da resposta
("Grant the required privileges to the current role").

**Causa.** As migrations 0001-0004 criam tabela, índice e policy e **não
concedem privilégio nenhum**. Quem concedia era o `alter default privileges` do
schema `public`, que o stack local do CLI traz ligado e o projeto remoto (com
"expose new tables" desligado no setup) não tem. Corrigido pela migration
`0005_grants.sql`.

### O achado de processo — a regra de E2E contra o Postgres local tem ponto cego

A regra dura do projeto ("E2E roda contra o banco local em Docker, stub de
backend é proibido") continua certa e **não** está em questão. O que ela prova é
**comportamento**; o que ela não prova é **configuração**. O stack local do CLI e
o projeto remoto não são o mesmo banco, e toda divergência de configuração entre
os dois é invisível para teste de comportamento: os 30 E2E rodavam num banco
mais permissivo que a produção e passavam por isso, não apesar disso.

**É a segunda vez.** A primeira foi `numeric(14,2)` voltando do PostgREST como
number e não como string — E2E verde em cima de um formato inventado. Mesmo
padrão, sintoma diferente: o teste valida a suposição de quem escreveu o
ambiente, não o ambiente de verdade.

**O que se fez agora**, em ordem de valor:

1. **A migration revoga antes de conceder.** Não é só somar `GRANT`: `revoke all
   … from anon, authenticated` desfaz o que o default privileges do local havia
   dado. Depois da 0005 o banco local tem **exatamente** os privilégios do
   remoto para as cinco tabelas, e os 30 E2E existentes passaram a rodar sob o
   modelo de privilégio de produção. Efeito colateral revelador: dois testes
   alcançavam estado por `DELETE`, uma operação que o app **não pode** executar
   em produção — viraram andaime de administrador (ver CLAUDE.md).
2. **`e2e/privilegios.spec.ts`** compara o mapa de privilégios de `public` com o
   declarado. Tabela nova sem GRANT explícito deixa a suíte vermelha com o nome
   dela. É o que fecha o caso para as tabelas de amanhã.
3. **`alter default privileges` foi recusado de propósito** — resolveria a
   tabela futura e, ao resolvê-la em silêncio, recriaria a mesma classe de
   decisão invisível que causou o incidente. O argumento inteiro está por
   extenso em `supabase/migrations/0005_grants.sql`.

**O que continua descoberto, e é decisão do Mateus/`cto-obra`:** só as cinco
tabelas e o schema `public` foram normalizados. Auth, extensões, configuração do
PostgREST (schemas expostos, limites), políticas de storage no remoto, e
qualquer outro default do painel do Supabase seguem sem espelho no local. A
pergunta a fazer em todo ticket que toque schema: *isto depende de algum default
do stack local que o projeto remoto não tem?*

**Pergunta em aberto (P):** vale um smoke test pós-deploy que autentique no
projeto **remoto** com uma conta de verificação e faça um SELECT por tabela? É a
única defesa que pega divergência de configuração que nenhum banco local espelha
— e custa uma credencial de produção guardada em algum lugar, que é exatamente o
tipo de coisa que este projeto evita. Não implementado; decisão do Mateus.


### Fila revista — 2026-08-18 (6ª revisão)

*Substitui a 5ª revisão. Escrita depois de o app entrar em produção e de o
Mateus usá-lo com dado real — o que mudou mais coisa que dez dias de análise.*

**A premissa que caiu, e ela reordena tudo**: o problema nunca foi volume de
escopo, foi **nada ter ido ao ar**. Diagnóstico do `po` em 2026-08-17, com o app
ainda na `main`. Corrigido no mesmo dia: Vercel conectada, login por senha,
migration `0005_grants` aplicada no remoto, obra cadastrada, primeira NF
registrada.

**A segunda premissa que caiu, e é do Mateus (2026-08-18)**: *"quem gerencia a
obra, não gerencia do canteiro"*. O `CLAUDE.md` foi corrigido — gestão em casa é
o cenário **principal**; captura no canteiro é o **eventual**. **Isso torce para
trás várias decisões de 2026-08-17/18** que usaram "uma mão, com pressa" como
veto. Reavaliar caso a caso, não em bloco.

**Fila de implementação:**

1. **`CONTAI-018`** — vínculo pagamento↔nota. **P0, 1º.** Gate Fiscal fechado,
   mock em desenho. É o que faz o custo existir na tela: hoje `sustentaCusto`
   exige `status = 'conciliado'` e **nenhuma tela cria esse status**.
2. **`CONTAI-019`** — pagamento agendado (previsto × executado). **P1, 2º.**
   Desmembrado do 018 pelo `po` em 2026-08-18. Reescreve a **US-002**.
3. `CONTAI-014` (código) · `CONTAI-004` + `CONTAI-007` · `CONTAI-009` ·
   `CONTAI-005` reduzido.

**Bloco de deploy** (fora da fila de implementação): `CONTAI-012` ·
`CONTAI-013` (encolheu — SMTP e template saíram com a troca para senha) ·
`CONTAI-014` (prova no aparelho real).

**Depois:** `CONTAI-010` revisado (terreno financiado, Passo 1) ·
`CONTAI-011` · `CONTAI-016` · `CONTAI-017` · `CONTAI-015` (captcha, P2) ·
`CONTAI-008` · `US-008` (extração) · `US-009` · `US-012`.

#### US-002 — REESCRITA, não fundida

Deixa de ser *"fila de boletos a pagar com lembrete"* e vira **compromisso de
pagamento previsto**, com boleto sendo **uma origem** e o PIX agendado sendo
outra. Absorvida pelo `CONTAI-019`.

**A decisão de 2026-08-07** (*"o lembrete nasce junto com a confirmação do
boleto na ingestão"*) **está morta** — ela amarrava o lembrete ao boleto, e a
premissa não sobrevive ao previsto genérico.

**O Google Calendar desce a P2, com recomendação de corte** (`po`, 2026-08-18):
*"não pagar juros" não serve a nenhuma das três metas — é gestão de caixa.* O
que serve é **data prevista passou sem confirmação = dinheiro possivelmente fora
da obra sem registro**, e isso é pendência in-app, custo zero, sem OAuth.
⚠️ **Revisitar**: parte desse raciocínio assumia uso só no canteiro, premissa que
caiu no mesmo dia.

#### O que o uso real produziu em 24 horas

Os dois defeitos que mais importam **não vieram de análise, vieram de uso**:

1. **Duplicação**: a mesma despesa aparecendo como NF e como PIX, e nenhuma
   virando custo → `CONTAI-018`.
2. **A bifurcação de `/adicionar`**: nenhuma das duas opções é o caso comum
   (*"paguei e tenho a nota"* não tem porta) → diretriz de rótulo no 018.

E um terceiro, de processo: **o app promete por escrito o que não cumpre** —
*"a NF vincula depois"* na tela `/adicionar`. Virou o critério 19 do 018, com a
frase saindo **antes** do ticket fechar.

### Dores levantadas no Gate 2 do CONTAI-018 (2026-08-18)

Saíram do review fiscal (`contador`) e técnico (`cto-obra`) do vínculo
pagamento↔nota. **Nenhuma bloqueou o 018** — todas foram classificadas por eles
como ticket próprio. Estão aqui para o `po` priorizar.

1. **D-018.1 [P1] — o headline soma duas apurações que nunca se tocam.**
   `emPendenciaCentavos` (`lib/fiscal/resumo.ts`) soma, num único número em
   reais, exposição de **IRPF** (pago sem nota, quarentena) e exposição de
   **INSS** (NF de serviço sem retenção, pelo valor cheio da nota). Depois do
   018, a NF da WK conciliada mostra na home *"Custo confirmado R$ 3.000"*,
   *"Despesa comprovada R$ 3.000"* **e** *"Em pendência: R$ 3.000"*. Palavras do
   `contador`: somar as duas *"ensina exatamente o modelo mental errado que o §0
   do parecer existe para desfazer"*. É **pré-existente**, ficou mais visível.
   Separar `emRiscoIrpfCentavos` de `exposicaoInssCentavos`, com rótulo dizendo
   a qual conta cada um pertence. O `contador` escreve os dois textos.

2. **D-018.2 [P1] — vínculo novo pode mudar um ano JÁ DECLARADO, em silêncio.**
   Consequência direta da repartição cronológica ratificada (adendo de
   2026-08-18 ao parecer). Caso que vai acontecer: PIX de R$ 3.000 em dez/2026
   sem nota; DAA 2026 entregue em abril/2027; a NF chega em maio/2027 e é
   ligada. O custo de 2026 sobe R$ 3.000 — e a resposta certa é **retificar a
   DAA de 2026**, não jogar o custo em 2027. Hoje o app faz a conta certa e
   **não diz nada**: nenhuma tela distingue "ano em curso" de "ano já
   declarado". A ressalva do adendo (registro **retroativo** redistribui o
   conjunto) é a forma geral disso. ⚠️ **Retificadora exige CRC** — o app
   detecta e avisa; não decide nem redige. Primeira janela de dano: abril/2027.
   Ganhou superfície nova no 018: o rodapé do seletor pode mostrar um acréscimo
   **inteiramente de ano anterior** (`acumulado` sobe, `2026: R$ 0 → R$ 0`).

3. **D-018.3 [P2] — o saldo da nota parcialmente paga some da home.**
   NF de R$ 3.000 com R$ 1.000 pago e ligado: R$ 1.000 vira custo confirmado e
   os R$ 2.000 restantes não aparecem em lugar nenhum (não estão no terceiro
   número, que filtra notas **sem nenhum** pagamento; não são pendência; não são
   custo). **Regra do `contador`**: o terceiro número deve ser **Σ dos saldos
   não cobertos de documentos hábeis**, não Σ dos valores cheios de documentos
   sem pagamento — uma fórmula cobre os dois casos. O erro atual **subestima**,
   que é a direção segura. Como isso aparece na tela (junto das notas intocadas
   ou em linha separada) é **decisão do Mateus**.

4. **D-018.4 [P3] — ~~candidato oculto sem explicação~~ JÁ RESOLVIDO no Gate 2.**
   `CANDIDATO_OCULTO_PAGAMENTO`/`CANDIDATO_OCULTO_DOCUMENTO` foram implementados
   e são renderizados no seletor (correção C4). **Resíduo real, se houver**: a
   frase explica que o candidato sumiu, mas não oferece o caminho de desligar
   dali. Conferir no primeiro uso antes de virar ticket — não reimplementar o
   que já existe.

5. **D-018.5 [P3] — nota sem valor: avisa, mas não deixa completar.**
   `DOCUMENTO_SEM_VALOR` já foi implementado e aparece no seletor e na tela do
   documento (correção C5 do Gate 2) — o silêncio acabou. **Resíduo real**: o
   app diz que a nota sem valor não comprova nada e **não oferece o campo para
   informar o valor ali**. É a mesma família do §6 do parecer, que manda
   completar `numero`, `serie` e `data_emissao`.

6. **D-018.6 [P1 — reclassificado de P2 pelo `po` no Gate 4] — a confirmação de
   TODO registro afirma um prazo de guarda falso.** `app/_components/registrado.tsx`
   ainda diz *"fica disponível até a venda + 5 anos"*. O `CLAUDE.md` corrigiu
   isso em 2026-08-16: o relógio é o do CTN art. 173, I — venda em 2028 →
   **31/12/2034**, quase 7 anos, mais o **segundo relógio previdenciário** do
   CNO, e obra não vendida = **prazo indefinido**. Palavras do `po`: é texto com
   consequência fiscal, aparece na confirmação de **todo** registro, e **ensina
   o Mateus a descartar acervo anos antes do prazo real** — a meta 3 do produto
   inteira. Edição de uma linha, custo zero, dano potencial alto. É a doença do
   critério 19 sobrevivendo em outra tela.

7. **D-018.7 — o rótulo do rodapé do seletor mostra um DELTA sob um nome que na
   home nomeia um NÍVEL.** *"Custo confirmado se ligar agora: R$ 2.000,00"* pode
   ser lido como *"meu custo confirmado passa a ser R$ 2.000"*. Um `+` na frente
   ou *"o custo confirmado sobe R$ X"* elimina a ambiguidade. O rótulo veio do
   **mock aprovado**, então a mudança é do `designer` com o Mateus — não é
   decisão de engenharia nem do `contador`.

8. **D-018.8 [P2 — achado do `po` no Gate 4] — dois links seguidos com o mesmo
   rótulo, e o primeiro não faz o que diz.** O cartão "pago sem nota" da home e o
   botão da tela de detalhe do pagamento se chamam **ambos** *"Ligar a uma
   nota"*; o primeiro não liga nada — leva ao detalhe. O próprio E2E clica duas
   vezes no mesmo nome. Ou o cartão da home aponta direto para
   `/pagamento/[id]/ligar`, ou muda de rótulo. É a disciplina do critério 19
   (nenhuma tela promete o que não faz) aplicada a **botão**, não a frase.

9. **D-018.9 — DÍVIDA DE ARQUIVO, e bloqueia o Gate 1 do `CONTAI-019`.** O Gate
   Fiscal do 019 está *"fechado no mérito"*, mas o parecer do `contador` de
   2026-08-18 **só existe em transcript de sessão**. É a violação exata que o
   `CLAUDE.md` proíbe — *"parecer que só existe no transcript é a mesma falha que
   a regra proíbe, com outro nome"*. Materializar em `docs/pareceres/` **antes**
   de abrir o Gate 1 do 019. Recomendação do `po`: não abrir o 019 sem esse
   arquivo no disco.

### Dores da correção de documento — 2026-08-18 (origem: adendo + commit `b807901`)

Extraídas pelo `po` ao escrever o `CONTAI-021`. Origem: o **adendo de
2026-08-18** ao parecer `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md`
(§2 e §4) e o commit **`b807901`**, que implementou o primeiro passo da saída do
impasse — *"Link 'corrigir na nota' → edição do documento, com rastro"* — e
parou aí.

| ID | Dor | Origem | Prioridade |
|----|-----|--------|-----------|
| D23 | **O link "Corrigir na nota" está em produção e leva a uma tela que não corrige.** Nenhuma das telas do documento (detalhe, `/obra`, `/ligar`, `/desligar`) edita coisa alguma. É o critério 19 do CONTAI-018 (*nenhuma tela promete o que não faz*) violado por um **botão**. Consequência do mesmo commit: **nome de favorecido gravado errado é permanente** — o app deixou de renomear em qualquer fluxo, e o "ato deliberado com rastro" que deveria substituir isso não existe | `b807901` + adendo §4 | **P1**, vira **P0** no registro da 2ª nota (R$ 40.857,14) |
| D24 | **O app não sabe qual ano-calendário já foi declarado.** Sem esse dado, nenhum aviso de "isso mexe em ano já declarado" consegue ser verdadeiro: ou nunca dispara, ou dispara sempre. Inferir por calendário ("ano anterior = declarado") erra de **janeiro a abril**, que é exatamente a janela em que ele mexe no acervo. Falta uma informação simples que só o Mateus tem: *"DAA do ano X entregue em DD/MM/AAAA"*. **Trava o aviso preciso do CONTAI-021 e o da D-018.2 ao mesmo tempo** — as duas compartilham o mesmo detector | `contador`, Gate Fiscal do 021 | **P1** (destrava dois avisos fiscais) |
| D25 | **Documento registrado em duplicidade não tem saída depois do registro.** Não se resolve editando campo: precisa de *"marcar como duplicata de X"*, que é **anotação, não delete** (acervo append-only). O CONTAI-004 só **avisa no ato do registro**; passado esse instante, os dois registros convivem e a duplicidade é o erro que o parecer de 17/08 (§4) classifica como **gerador de passivo tributário** | `contador`, Gate Fiscal do 021 | **P1** (P0 quando houver o 2º registro do mesmo papel) |
| D26 | ⚠️ **Compra no cartão de crédito não tem onde morar, e o app finge que o problema é outro.** O Mateus paga parte do material no cartão; `meio = cartao` está **recusado na entrada** desde o CONTAI-001, e o comentário do código (`lib/fiscal/pagamento.ts:16-21`) justifica a recusa dizendo que *"cartão depende da Q4"* — a **Q4 fechou em 2026-08-08**. O bloqueio, por acaso, está certo: pelo adendo §B a compra **nasce compromisso**, e o custo é do ano em que a **fatura** é paga, não da compra. Mas hoje o efeito é que essas compras **não são registradas em lugar nenhum** — é a meta 1 falhando pelo lado de fora, exatamente como o compromisso do CONTAI-019 | `contador`, adendo §B do parecer de 18/08 | **P0 fiscal** → **`CONTAI-022`** (bloqueado pelo 019) |
| D27 | **O formulário de pagamento direto RECUSA a gravação sem comprovante, e a confirmação de compromisso não recusa — dois pesos para o mesmo fato do mundo.** O ADENDO 2 do `contador` derrubou o bloqueio: *"nunca recuse o registro de um fato consumado"* — grava, não entra no custo confirmado, vira pendência "pago sem comprovante". O atrito do bloqueio empurra para **não registrar**, que é a falha da meta 1. Reprovado também pelo Mateus lendo o mock | ADENDO 2 (`238a650`) + Mateus, 18/08 | **P1** → absorvido pelo **CONTAI-019** (critérios 46-48) |

**D23 tem dano ZERO hoje** e registro isso em vez de esconder: há **uma única
nota no banco, e ela está certa**. A prioridade vem do gatilho nomeado, não de
urgência de calendário.

**Duas mudanças de posição registradas no Gate Fiscal do 021** — o `contador`
corrigiu o próprio adendo, e o parecer novo
(`docs/pareceres/2026-08-18-correcao-de-documento-registrado.md`) prevalece:

1. **Rastro é obrigatório em TODA correção**, não só quando o documento já tem
   pagamento vinculado. *"Ter pagamento vinculado é estado mutável e futuro; o
   rastro que não foi gravado não se recupera."*
2. **`documento.favorecido_id` É corrigível** — o que é imutável é a **string
   CNPJ/CPF de um favorecido já cadastrado**. O adendo colapsava as duas coisas.

**Achado do `lead-engineer` que NÃO virou ticket**: `documento` não tem número
de nota no schema — isso já é o **`CONTAI-004`**, escrito e priorizado. Nada
novo a abrir.

**Achado do `lead-engineer` que virou decisão, não ticket**: a deriva de
privilégio (`update` em `favorecido` concedido e não executado desde `b807901`)
**morre por uso** no critério 6 do 021, sem migration de revogação. Revogar
agora para reconceder depois é churn de duas migrations e dois `db push`.

**Cinco decisões de escopo do `po` — 2026-08-19**, por delegação explícita do
Mateus, fechando os blocos âmbar do mock v1 do `CONTAI-021` (critérios 16-21 do
ticket). Em uma linha cada:

1. **Histórico de correções é exibido** no detalhe do documento — rastro que só
   o banco vê não cumpre a meta 3, e é `select` em tela que já existe.
2. **Formulário de pagamento pela metade: aviso, não rascunho** — com a saída
   barata dita na tela (o nome do emitente pode ser corrigido depois, e o
   pagamento aponta para o favorecido, não para o texto do nome).
3. **Nota substitutiva = anexo adicional do mesmo registro** na rodada 1 —
   registro novo sem estado "cancelada" dobraria `Σ documentos`. Vira registro
   próprio quando o `CONTAI-004` e a anotação da **D25** existirem.
4. **CNPJ errado ganha uma ação hoje**: marcar *"CNPJ errado — tratar"* como
   pendência, sem campo e sem mexer em status — porque impasse mudo empurra para
   trocar o nome, que é o dano que a tela existe para evitar.
5. **A pendência de retificadora é por ano, acumula correções, e só o Mateus a
   baixa** escolhendo um desfecho (retifiquei / contador avaliou / DAA ainda não
   entregue), gravado por INSERT; correção nova depois da baixa abre pendência
   nova. É a resposta ao "alarme que não desliga" recusado em 10/08 **sem** virar
   alarme que se apaga sozinho.

⚠️ **Dívida de processo, aberta aqui**: `.claude/agents/po.md` e
`.claude/agents/designer.md` ainda carregam as **duas premissas já corrigidas no
`CLAUDE.md`** — *"venda + 5 anos"* (corrigido em 16/08) e *"majoritariamente de
celular, no canteiro… julgado nesse cenário primeiro"* (corrigido em 18/08).
Os briefs reinjetam a régua velha em toda execução — inclusive no `/design`
deste ticket, que é justamente uma tela de **gestão**. Corrigir os dois arquivos
é decisão do Mateus (é configuração do time), não de agente.

---

## D31 — "regime de caixa" ainda em três telas que o CONTAI-019 não tocou

⚠️ **Renumerada de D24 para D31 no Gate 4 (18/08).** O ID **D24 já estava
ocupado** pela dor do ano-calendário declarado (tabela acima, linha do Gate
Fiscal do `CONTAI-021`), aberta no mesmo dia. Dois itens com o mesmo nome num
backlog vivo destroem a rastreabilidade que o ID existe para dar: a partir da
colisão, toda referência a "D24" é ambígua e nenhuma das duas dores pode ser
citada em ticket. **D24 = ano-calendário declarado. D31 = esta.**

*Aberta pelo `lead-engineer` no Gate 1b do `CONTAI-019`, 2026-08-18.
**Promovida a ticket no Gate 4**: virou **`CONTAI-023`**, junto com o
reescopo do critério 7 — dor sem ID de ticket não tem quem a pegue.*

O **critério 7 do CONTAI-019 proíbe "regime de caixa" em tela**, e a **decisão
10** do fechamento de 18/08 fixou a frase substituta, ratificada pelo `contador`
em §F.5:

> **A data que vale para o custo é a do pagamento, não a da nota. Nota de
> dezembro paga em janeiro é custo do ano seguinte.**

**O que o Gate 1b trocou** — e só isto, porque a decisão 10 nasceu de um
conflito entre dois mocks **na mesma superfície**, e não autoriza varredura em
tela que ninguém revisou nesta rodada:

- `app/page.tsx` — o parêntese saiu da linha das despesas comprovadas;
- `app/pagamento/[id]/page.tsx` — passou a exibir a frase do §F.5, com o exemplo;
- `app/adicionar/pagamento/page.tsx` — o rótulo do custo deixou de nomear a
  regra, e a frase do §F.5 entrou no campo de data.

**O que FICOU, e onde** — quatro ocorrências, em três telas que este ticket não
abriu:

| Arquivo | Linha | Texto |
|---|---|---|
| `app/adicionar/page.tsx` | 35 | *"…pagamento é o que define o ano do custo (regime de caixa)."* |
| `app/adicionar/documento/page.tsx` | 365 | *"conta pela data do pagamento ligado — regime de caixa"* |
| `app/documento/[id]/page.tsx` | 139 | *"— regime de caixa"* |
| `app/documento/[id]/page.tsx` | 157 | *"Este pedaço da nota não vira custo: regime de…"* |

⚠️ **A receita de busca já falhou DUAS vezes, e a segunda foi minha** (`po`,
Gate 4, 18/08). O Gate 1b descobriu que `grep "regime de caixa"` perde a frase
quebrada pelo formatador — faltavam `app/page.tsx:254-255` (já trocada) e
`app/documento/[id]/page.tsx:157` — e prescreveu buscar por **`de caixa`**.
**Essa receita também é insuficiente**: na linha 157 o formatador quebra
**entre `de` e `caixa`** —

```
              Este pedaço da nota <strong>não vira custo</strong>: regime de
              caixa — sem desembolso não há dispêndio.
```

— e `grep "de caixa"` **não acha**. Foi assim que meu relatório de Gate 4
contou **três** ocorrências onde há **quatro**: o mesmo erro do Gate 1b, um
nível abaixo.

**Receita correta, e é a única que fecha**: `grep -rn "caixa" app/`, a palavra
sozinha. Qualquer separador que contenha espaço pode virar quebra de linha; só
o token indivisível é seguro. **A lição não é sobre esta frase** — vale para
toda varredura de texto de tela: procure pela **palavra mais longa que não pode
ser quebrada**, nunca pela frase.

**Por que não é urgente**: o dano é de vocabulário, não fiscal — *"regime de
caixa"* é o **nome** da regra, e a regra continua certa nas quatro. O argumento
do critério 7 é que o nome **não ensina nada a um usuário de uma pessoa só**, e
esse argumento não expira.

**Por que também não é zero**: as três telas restantes são de **documento**, e é
exatamente ali que a confusão entre data da nota e data do pagamento nasce.
Trocar lá tem mais valor didático do que teve na tela do pagamento.

## Dívidas nomeadas no Gate 2 do CONTAI-019 — 2026-08-18

*Três, todas levantadas pelo `cto-obra` e pelo `contador` e conscientemente
NÃO implementadas na rodada. A D28 é a única que promete alguma coisa ao
Mateus na tela — as outras duas são defesa de suíte e de acervo.*

### D28 — a tela promete que o relatório trava, e hoje nada trava

⚠️ **É a que não pode se perder, e a frase é literal:**

> o texto em tela **promete que o relatório trava**, e hoje **nada trava** — o
> ticket da **US-004** tem de chamar `podeGerarRelatorioAnual`, senão aquele
> texto vira mentira.

**Onde a promessa está escrita**, em três lugares que o CONTAI-019 acabou de
publicar:

- `app/compromisso/[id]/page.tsx` — o cartão do vencido diz que, sem resposta,
  **nenhum relatório anual pode ser gerado**;
- `app/_components/agendado.tsx` — a mesma consequência no cartão da home;
- `app/page.tsx` — o bloco de agendados.

**O mecanismo existe e está testado**: `podeGerarRelatorioAnual`
(`lib/fiscal/compromisso.ts`), com o `ano` recebido e provadamente ignorado
(§A do adendo 1), e unitários cobrindo 28/12/2025 bloqueando 2026, "sem data
prevista não bloqueia" e "o *não, é outro pagamento* não desbloqueia".
**O que não existe é o CHAMADOR** — a tela de relatório anual é da US-004.

**Por que isso é pior que uma funcionalidade faltando**: o critério 21 do
CONTAI-019 diz, com todas as letras, que *"este critério não pode ser adiado
com a US-004 — é o único dente do mecanismo"*. A função entregue satisfaz o
critério; a **promessa em tela**, não. O Mateus vai ler que o app trava o
relatório e confiar nisso. Se a US-004 nascer sem chamar a função, ele gera um
relatório anual com buraco conhecido **acreditando que o app o teria impedido**
— e é exatamente na virada do ano que a omissão custa.

**Amarração explícita**: quem pegar a **US-004** topa com esta exigência antes
de começar. Não é sugestão de implementação; é pré-condição de o texto já
publicado continuar verdadeiro. Alternativa aceitável, se a US-004 demorar:
tirar a promessa das três telas — mas aí o dente do critério 21 fica sem
nenhuma expressão para o usuário, e o `contador` precisa ser consultado.

### D29 — `getByRole(..., { name })` sem `exact` erra na direção de APROVAR

O Gate 1b achou **quatro** testes que passavam na página de ORIGEM: `"Pagamento"`
casa por SUBSTRING com `"Registrar o pagamento"`, e as asserções nunca chegavam
na tela que diziam testar. Foram consertados com `waitForURL`, que é o conserto
certo — **ajustar o locator ao que a tela mostra é como se apaga um requisito**.

O que ficou por fazer é a **defesa estrutural**: o `cto-obra` levantou ~31
`getByRole(..., { name })` sem `exact: true` na suíte. Nenhum deles é
falso-positivo hoje; o problema é que **nada impede o próximo**. Teste verde
pelo motivo errado não aparece em relatório nenhum, e a suíte é a única defesa
do projeto contra "passa local, quebra remoto".

Entra no mesmo pacote o `getByRole("alert")` × route-announcer do Next
(escopado em `main` no Gate 2) — mesma família: locator que casa com mais coisa
do que quem escreveu imaginou.

### D30 — `pagamento_diferenca` aceita UPDATE no valor, e não deveria

O critério 32 do CONTAI-019 é explícito: **resolver não apaga o registro da
diferença** (acervo append-only, CONTAI-009). O código só escreve `resolucao` e
`resolvido_em`, e o comentário da migration diz isso — mas o `grant update` é
de **tabela**, não de coluna, porque `information_schema.role_table_grants` só
enxerga privilégio de tabela e um `grant update (col)` viraria falso negativo
em `e2e/privilegios.spec.ts`.

Resultado: **nada no banco impede** um caminho futuro de sobrescrever
`encargos` ou `nao_explicado`. A defesa correta é um **trigger de
imutabilidade** nessas duas colunas, que não interfere no mapa de privilégios.
Não entrou na rodada por ser risco de código futuro, não de código presente.

### D32 — enum fiscal sem contrapartida no parecer é classe, não incidente

*Levantada pelo `contador` no ADENDO 4 (`d69a3cf`) e **decidida pelo `po` no
Gate 4**: **entra como dívida P1, não entra agora.** Vai junto com a D29, no
mesmo passe de defesa estrutural da suíte.*

**O achado, na frase dele:** o `grep` que pegou a divergência entre o enum
`resolucao_diferenca` (cinco valores) e o §F.2 (quatro resoluções) **só existiu
porque o `po` foi olhar**. Vigilância humana não é defesa — é a mesma coisa que
o `status` do CONTAI-018 e o `alter default privileges` do incidente de 17/08:
**proteção de atenção, não de tipo.** Valor de enum fiscal que só existe em
comentário de código é regra fiscal fora do arquivo, que é exatamente o que o
`CLAUDE.md` proíbe.

**A defesa proposta**: um teste que quebre quando um valor de enum com efeito
fiscal não aparecer em `docs/pareceres/`.

⚠️ **Ela não funciona como está, e a correção é pré-requisito, não detalhe.**
O teste compara um identificador `snake_case` com prosa em português. Hoje ele
passaria por sorte de redação — o ADENDO 4 escreve `previsao_errada` entre
crases porque o `contador` quis, não porque alguma regra o obrigue. Sem essa
obrigação, o próximo parecer descreve a resolução pelo **rótulo de tela** e o
teste fica vermelho sem que nada esteja errado. **Teste que fica vermelho sem
motivo é pior que teste nenhum**: ele treina o time a afrouxar a asserção, que é
a D29 pelo outro lado.

**Ordem certa, então:**

1. **Regra primeiro** (`po` + `contador`): parecer que crie ou altere valor de
   enum fiscal **cita o identificador entre crases**. É barato e é o que dá ao
   teste algo estável para procurar.
2. **Teste depois**, junto com a D29.

**Escopo, e é deliberadamente estreito**: só enums cujo valor **muda se o
dinheiro entra ou não no custo** — hoje, `resolucao_diferenca`. `situacao_compromisso`
e `origem_compromisso` não decidem custo (o parecer é explícito em que boleto e
PIX previsto são fiscalmente idênticos: zero) e não entram. Alargar isto para
"todo enum" transformaria uma defesa em cerimônia.

**Por que não agora** `[Certain]`: o Gate 4 é o gate de **fechamento**, e o
FAIL que eu dei foi explícito em **não reabrir código** — os quatro arquivos a
mexer eram todos de `docs/`. Abrir `lib/` agora para acrescentar um teste torna
meu próprio veredito incoerente e reabre o `quality` que já fechou com 295
unitários e 63 E2E verdes. **A dívida está registrada com dono, ordem e
escopo**, que é o que impede ela de virar folclore.

---

## Terreno financiado — 2026-08-18 (absorvidas pelo `CONTAI-010`)

*Fonte normativa: `docs/pareceres/2026-08-17-terreno-financiado.md` + **adendos
1, 2 e 3 de 18/08**. Onde o corpo do parecer e os adendos divergirem, valem os
adendos.*

⚠️ **Antes das dores, uma correção de rota**: o `CONTAI-010` afirmava, na linha
86, que *"juros e correção de parcelamento do terreno ficam fora do custo"*.
**Estava errado** — juros e correção **integram** o custo de aquisição de imóvel
(IN SRF 84/2001, art. 17, I; ⚠️ a alínea é **"i"** na listagem do Perguntas e
Respostas, o `contador` corrigiu a própria citação e mandou **confirmar na IN
vigente**). A frase foi **apagada** do ticket, não riscada. No caso real são
**R$ 43.051,23 em 2025** — **72% do desembolso do ano**. É o tipo de erro que
não aparece em teste, não aparece em build, e só aparece na declaração.

| # | Dor | Origem | Prioridade |
|---|---|---|---|
| D33 | **O financiamento do terreno não tem onde morar no app.** O terreno é financiado (~20 anos, só o terreno), e o custo de 2025 — **R$ 59.934,75** de amortização + juros/correção — está **inteiro fora do sistema**. Não é hipótese: o documento existe e o Mateus já o tem na mão | `contador`, adendos de 18/08 | **P0 fiscal** → `CONTAI-010` |
| D34 | **Durante o ano corrente o painel subestima o custo do financiamento**, porque o informe anual só é publicado em jan/fev. Subestimar **em silêncio** é o defeito do `CONTAI-005` ao contrário: número errado em tela sem rótulo que o explique | `contador`, adendo 1 §6 | **P1** → `CONTAI-010`, critério 16 |

**O fato que redesenhou o ticket** (e é o que o Mateus trouxe): existe um
**"Extrato do Imposto de Renda"** da instituição credora, **um por exercício**,
que ele **baixa sozinho no site** — publicação automática para o IR, não
solicitação. **Pedidos ao banco durante o ano: zero.** O `contador` revisou o
parecer para acomodar isso e **cancelou** a exigência de captura mensal e o
pedido de extrato analítico retroativo: *"a exigência de todo mês era
rastreabilidade, não apuração"*.

Consequência: **um lançamento por ano-base + contrato**, com as rubricas
separadas. Somam no custo **amortização e juros/correção**. Ficam **fora da
soma, guardados, em revisão humana**: seguros (exclusão firme), taxa de
administração, mora/multa, a rubrica **"Diferença Teórico / Pago"** (natureza
**desconhecida** — o `contador` disse que não sabe e não supôs) e o **FCVS**,
este último marcado **candidato a inclusão**, não exclusão.

**Duas travas que o ticket carrega como critério**: a soma das rubricas tem de
**fechar com o total pago** (se não fechar, **recusar**, nunca somar o resto); e
por ano+contrato é **o informe OU as parcelas, nunca os dois** — o `cto-obra`
resolveu esta segunda na versão forte, **não construindo o caminho mensal**, de
modo que a dupla contagem seja impossível por ausência de tipo.

**Regras registradas agora para não se perderem no dia em que importarem**:
dívida quitada por **sinistro do MIP não é custo de aquisição** (não houve
desembolso dele); **reparo custeado por indenização do DFI não é dispêndio
dele** — o tratamento da indenização **em dinheiro** ficou *"confirmar"*.

**Ressalva de peso, e ela vai ao corpo do ticket**: nas palavras do `contador`,
juros nessa ordem de grandeza *"é assinatura de CRC, não decisão de app"*. Isso
**não trava o software** — o app soma, **nomeia os juros em linha própria** e
guarda cada rubrica separada. O que ele não faz é vender o resultado como
veredito: todo número deste ticket é **insumo para revisão profissional**.

**Complexidade**: o `contador` avaliou que o lançamento anual traz o ticket de
**M para ~S**. O `cto-obra` **discorda em parte e tem razão** — a *apuração* é S,
mas o ticket inteiro carrega migration com movimentação de dado em produção
(as três colunas de `obra` **morrem** e viram linhas datáveis), três tabelas
novas com `grant` explícito, e **três telas novas** com Gate 0 antes. **M
pequeno, fatiável em dois S**: Passo 1 (captura + correção do cálculo) é o
`CONTAI-010`; Passo 2 (texto da discriminação e o caso do ano da venda) vai
junto da **US-004**.

**Gate 0 do `CONTAI-010`: PENDENTE.** Há UI nova e **não existe mock** — rodar
`/design`. Cenário: **gestão em casa, sentado**, uma vez por ano. Não é captura
de canteiro e não se julga por essa régua.
