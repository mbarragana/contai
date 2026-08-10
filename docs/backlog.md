# Backlog — contai

Backlog vivo. Dores extraídas dos relatos do Mateus, stories priorizadas
(P0 fiscal / P1 fricção / P2 conveniência), perguntas abertas e cortes.

---

## DECISÕES PENDENTES DO MATEUS (Gate 4 do CONTAI-001, 2026-08-08)

*Bloco destacado: nada aqui avança sem resposta explícita do Mateus.*

1. **Headline "Em pendência" — recomendação do PO: nem 92.850, nem 47.850.**
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
3. **Priorização da fila proposta pelo PO** (ver "Fila recomendada" abaixo):
   CONTAI-004 (nº e data do documento, P0) e CONTAI-005 (headline, P0) antes
   de CONTAI-002 (login, P0) ir a produção; depois CONTAI-003 (obra, P1),
   CONTAI-006 (estados de rede, P1) e US-009 (ver o que já registrei, P1).

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

**US-004 [P0] — Relatório anual pronto para o IRPF**
Como dono da obra, quero o total do ano quebrado em materiais vs. mão de obra e
o texto da discriminação pronto para colar na ficha Bens e Direitos.
Aceite:
1. [ ] Total do ano por data de pagamento, materiais vs. serviços
2. [ ] Texto da discriminação gerado (modelo do contador, com CNO)
3. [ ] Lista CPF-por-CPF de pagamentos a PF (Pagamentos Efetuados), se houver
4. [ ] Posição da aferição INSS: serviços PJ com vs. sem retenção 11%

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
Escopo proposto: magic link/OTP por e-mail (Supabase Auth, single-user),
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
| **CONTAI-002** | **P0** — bloqueador de deploy | Autenticação real (magic link, sessão persistente, redirect pós-login, logout). **Sem regra fiscal** — registrado assim no Gate Fiscal do ticket, em vez de inventar uma |
| **CONTAI-003** | **P0** (promovido de P1) | Cadastro de obra (CNO obrigatório, valor do terreno com ITBI+escritura, edição) + **obra ativa**: o app deixa de assumir obra única. Carrega o Gate Fiscal pesado do parecer |
| **CONTAI-007** | **P0 condicionado** | `cno_referenciado` na NF de serviço, com **bloqueio** se divergir do CNO da obra. Captura irreversível: antes da próxima NF de serviço em produção |

**Por que três e não um.** CONTAI-002 é infraestrutura pura e testável
sozinho; CONTAI-003 é o que destrava a produção e carrega a regra fiscal;
CONTAI-007 é captura de campo no formulário e tem outro dono de risco.
**Mas 002 e 003 são uma única release**: login que desemboca em
`ObraAusenteError` é beco sem saída, então não vão a produção separados.

### Fila revista — 2026-08-09

*Substitui a proposta do item 3 do bloco de decisões pendentes no topo. O
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

### Perguntas abertas (as 3 que mais destravam)

- **Q11** — *"Cada uma das duas obras fica na sua própria matrícula, com uma
  única unidade autônoma (uma casa)? Algum dos dois terrenos veio de
  desmembramento ou loteamento de um terreno maior?"*
  É a única pergunta que separa ganho de capital de equiparação a PJ. Se a
  resposta for "mais de uma unidade" ou "veio de desmembramento", **os
  relatórios deste produto deixam de valer** e o escopo do contai muda.
- **Q12** — *"A segunda obra já está em andamento hoje, com nota ou pagamento
  chegando?"*
  **É a pergunta que mais muda a fila.** Se sim, os critérios de obra ativa do
  CONTAI-003 são urgência de agora e nada pode ir a produção sem eles. Se ela
  começa em meses, CONTAI-002+003 podem ir ao ar com uma obra só e o seletor
  vem em seguida.
- **Q13** — *"As duas obras já têm CNO próprio, e as NFs de serviço da AJE vêm
  com o CNO da obra impresso na nota?"*
  Define se o CONTAI-007 é validação (caminho comum = nota traz o CNO) ou
  cobrança de nota correta ao prestador (caminho comum = nota não traz).
  **Fecha de carona a Q5**, aberta desde o relato 002 — é a mesma nota na mão.

*Pergunta do contador que eu deliberadamente não trago ao Mateus como
requisito*: "quantos imóveis você vendeu nos últimos 5 anos e pretende
repetir?" — importa para habitualidade e para o art. 39, mas é conversa com o
CRC, não pergunta que muda uma linha de software.

### Cortado (com justificativa)

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
