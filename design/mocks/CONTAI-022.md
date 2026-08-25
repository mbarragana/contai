# CONTAI-022 — spec do mock
Nível: 1 (HTML navegável)   Cenário: gestão (conciliação de fatura, sentado, com calma)   Arquivo: CONTAI-022.html
Telas: 11 (s0, s1, s2, s3l, s3, s4, s5, s6, s7, s7v, s8). Hoje congelado no mock: 24/10/2026 (fictício
— as três faturas do exemplo já venceram). 375px piso, 720px mesa (padrão).
Preenche as duas lacunas que o próprio `CONTAI-019` (mock v2, s18) devolveu sem desenhar: compra
parcelada no cartão, e fatura paga parcialmente (rotativo). Acrescenta "vencimento da fatura" na
compra, ausente até aqui (achado crítico do `cto-obra`, Gate 1 do CONTAI-019).

## Por que nível 1
Fluxo novo, tela nova (hoje só existe a recusa total de `meio = cartao`). Três decisões pedem visão,
não leitura: o gate do parcelamento (botão nasce desabilitado, muda de rótulo e cor conforme a
escolha), a alocação com teto dinâmico (checkbox trava sozinho antes de estourar o valor pago), e a
densidade da fatura (N compras + total, sem virar dashboard).

## Telas e estados
- **s0 — Fluxo (ASCII)**: só sucesso; documentação.
- **s1 — Registrar a compra** (interativo): sucesso (agenda); **recusa** = parcelado escolhido (gate
  de negócio, não erro de rede: botão vermelho-fantasma desabilitado + banner de orientação); **erro**
  no anexo da nota (retry / salvar sem a nota); sem loading; sem vazio.
- **s2 — Compra registrada**: só sucesso (marcas de agendado + ressalva Q4).
- **s3l — Fatura, carregando**: loading isolado (busca as compras do vencimento).
- **s3 — Fatura, detalhe**: só sucesso; vazio não se aplica — fatura só existe com ≥1 compra vinculada.
- **s4 — Confirmar fatura paga (integral)**: sucesso; **erro** no anexo da fatura (mesmo padrão);
  sem loading; sem vazio.
- **s5 — Resultado: N pagamentos gerados**: só sucesso.
- **s6 — Registrar valor pago (parcial)**: só sucesso — valor **nunca recusado**, é fato consumado;
  botão só desabilita por campo vazio, nunca por decisão fiscal.
- **s7 — Alocação manual** (interativo): sucesso (dentro do teto); **erro** = tentativa de marcar
  compra que estouraria o valor pago (checkbox trava, aviso vermelho temporário); sem loading.
- **s7v — Alocação, vazio**: nenhuma compra elegível (todas já pagas) — estado nomeado, não erro.
- **s8 — Resultado: alocação confirmada**: só sucesso (N pagas, resto segue agendamento aberto).

## Campos
- `parc` (s1) — "À vista" | "Parcelado" — **nasce sem nenhum marcado, SEM DEFAULT** — parcelado
  bloqueia a gravação, à vista libera o resto do formulário
- `fValor` (s1) — "Valor da compra *" — `number` — obrigatório — SEM DEFAULT
- `fCompra` (s1) — "Data da compra *" — `date` — obrigatória — não decide ano — SEM DEFAULT
- `fVenc` (s1) — "Vencimento da fatura *" — `date` — obrigatória — **vira a data prevista do
  agendamento** — campo novo deste ticket — SEM DEFAULT
- anexo de nota (s1) — opcional, exceção nomeada do agendamento (CONTAI-019 §4) — nunca bloqueia
- `fFaturaData` (s4) — "Data em que a fatura foi paga *" — `date` — vira a data de cada um dos N
  pagamentos — SEM DEFAULT (mock traz 10/09 de demonstração). Anexo da fatura (s4) — um só, compartilhado
  por N pagamentos — nunca bloqueia
- `fParcData` (s6) — "Data em que você pagou *" — `date` — obrigatória — SEM DEFAULT
- `fParcValor` (s6) — "Valor pago *" — `number` — obrigatório — **sempre aceito**, mesmo abaixo do
  previsto — SEM DEFAULT
- seleção de compras (s7) — N checkboxes, cada um trava se marcá-lo estourar a soma do valor pago —
  nenhuma pré-marcada — SEM DEFAULT

## Textos com consequência fiscal (copiados do parecer 2026-08-18, Adendo §B / Adendo 2 §5,7 / Adendo 3 §G.1-G.2)
- "Esta compra nasce sempre agendamento… o favorecido é o lojista, nunca o banco nem a
  administradora." — s1
- "Compra parcelada não é aceita aqui. Lance cada parcela separada, pelo valor dela, na fatura em que
  ela vence." — s1. ⚠️ **Sem literal do `contador` para esta frase** — o parecer fixa a regra (recusar
  na entrada com mensagem explícita), não o texto. Redação provisória, ver Pergunta 1.
- "Vencimento da fatura: sem ela a compra nunca vence e nunca bloqueia relatório anual." — s1 (achado
  do `cto-obra`, explicação de produto, não texto do `contador`)
- "A data da compra não decide ano nenhum. Quem decide é o dia em que a fatura for paga." — s2
- Ressalva Q4, literal: "a tese do ano do pagamento da fatura é defensável, não pacífica… exige CRC" —
  s2 e todo relatório com custo de cartão
- "A fatura não é documento hábil e não tem favorecido próprio — o custo se atribui por compra." — s3
- "'Um anexo por pagamento' não fecha aqui… o comprovante é o da fatura — um documento para N
  pagamentos." — s4 (Adendo 2 §5). "Cada compra é confirmada, uma a uma, gerando um pagamento por
  compra — nunca um pagamento único pela fatura." — s4 (Adendo §B(b), literal)
- "A argamassa vai entrar como pago sem nota — o comprovante da fatura prova que o dinheiro saiu, não
  o que foi comprado." — s4, s5. "Juros de rotativo, parcelamento, IOF, anuidade e multa ficam fora
  do custo." — s5
- "O valor pago é gravado sempre… nenhuma compra é confirmada sozinha." — s6 (Adendo §B: "não quita
  compromisso nenhum automaticamente — vai para revisão humana")
- "Seguem sujeitas ao bloqueio anual até Foi pago / Não vai ser pago / Mudou a data." — s8 (ciclo do
  CONTAI-019, reaproveitado). "Não têm destino fiscal afirmado por esta tela — revisão humana, sem
  chute do app." — s8, sobre o valor não alocado; texto do designer, de propósito sem afirmar se é
  encargo ou compra futura

## Navegação
- s0 → s1 · s1: `parc` vazio → botão desabilitado · `parcelado` → desabilitado, vermelho · `vista` +
  campos completos → "Agendar — não entra no custo" → s2
- s2 → s3 ("Ver a fatura") | s1 ("Registrar outra compra") · s3l → s3 (sem timer real)
- s3 → s4 (integral) | s6 (parcial) | s1 · s4 → s5 · s6 → s7 (grava e já avança — nunca fica "pago"
  sem se saber o que cobre)
- s7 → s8 (mesmo com 0 selecionado; decidir depois é resposta válida) | s3 (sem gravar alocação)
- s7v é estado alternativo de s7, não destino de navegação neste mock

## Decisões de design
1. **Gate do parcelamento no padrão CONTAI-032**: botão desabilitado com o motivo no rótulo, nunca
   validação-no-clique; `parc` sem opção marcada — campo que classifica não tem default.
2. **Alocação trava no teto, não avisa depois** — marcar compra que estouraria é revertido na hora,
   não bloqueia só o botão de confirmar. **s7 aceita 0 selecionado** — o pagamento (s6) já é fato
   consumado; alocação é revisão, não condição de existência do valor.
3. **s3 não decide sozinha integral × parcial** — as ações ficam lado a lado, mesmo peso; quem decide
   é o valor digitado em s4 ou s6. **Reaproveita, não redesenha**: vocabulário, marcas do agendado e
   o ciclo de resposta ao vencido são do CONTAI-019 — s8 só referencia.

## Perguntas em aberto
1. Texto de recusa do parcelamento (s1) sem literal do `contador` — precisa passar antes do Gate 2.
2. s3 pressupõe que o app já agrupa compras por vencimento numa entidade `fatura` — modelo de dados,
   não de tela; devolvo ao `cto-obra`/`po`: nasce automática no primeiro `fVenc` novo, ou tem cadastro?
3. s7v (nada elegível), por completude — não sei se é alcançável (dependeria de alocação anterior já
   ter coberto tudo); confirmar com `cto-obra`. Valor pago (s6) MAIOR que o previsto (pagou tudo +
   adiantamento) também não foi desenhado — devolvo ao `po`: é caso real, ou só existe abaixo dele?
