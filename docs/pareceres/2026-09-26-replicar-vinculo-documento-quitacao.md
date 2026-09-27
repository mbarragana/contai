# Parecer fiscal curto — replicar `documento_origem_id` na quitação do compromisso

- **Data**: 2026-09-26 · **Autor**: agente `contador`, execução read-only
- **Provocação**: relato do Mateus sobre "compra no cartão não herda o
  favorecido da nota" (`docs/backlog/78-2026-09-26-cartao-nao-herda-documento.md`)
  — na investigação técnica do `cto-obra`, achado que `compromisso.
  documento_origem_id` é **write-only**: o vínculo que o Mateus afirma no
  agendamento (PIX, boleto ou compra no cartão) nunca chega a
  `pagamento_documento` quando o compromisso é quitado
- **Consome**: `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md`
  (§2, §5, ADENDO 2)
- **Normativo para**: `CONTAI-065` (a nascer)
- **Não é gate fiscal completo** — pergunta pontual de um ticket, sem
  provocação de caso real ainda materializado em pagamento perdido; é
  liberação de escopo, não descoberta de regra nova

> `[Certain]` / `[Likely]` são do contador. Nada aqui substitui contador
> humano (CRC).

---

## Pergunta

Replicar automaticamente, no ato da quitação (fatura do cartão paga, ou
PIX/boleto agendado pago), o vínculo pagamento↔nota que o Mateus **já
afirmou** no agendamento (`compromisso.documento_origem_id`) — sem pedir
confirmação de novo — fere a doutrina "campo preenchido afirma, o sistema
nunca assume por conta própria" (proibição de default fiscal / vínculo por
heurística)?

## Veredicto

**Pode automatizar.** [Certain] Replicar o vínculo na quitação **não é**
inferência nova do sistema — é persistência de uma afirmação humana já
feita. A doutrina do produto proíbe o app *adivinhar* vínculo (mesmo
favorecido, valor e datas próximas "sugerindo" ligação); aqui não há
adivinhação: o Mateus já escolheu a nota, no agendamento, com o dedo dele.

## Fundamentação

- `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md` §5 proíbe
  vínculo por **heurística** ("mesmo favorecido, mesmo valor, datas
  próximas sugere, nunca vincula sozinho"). Não é o caso: `documento_
  origem_id` é ato deliberado, gravado no momento do agendamento.
- O mesmo parecer, **ADENDO 2** (favorecido herdado quando o pagamento nasce
  ligado a um documento), já resolveu um caso estruturalmente idêntico: o
  favorecido é herdado **read-only**, sem reconfirmação — "o pagamento não
  tem opinião própria sobre quem emitiu a nota". Este caso é o mesmo padrão
  um passo adiante no tempo (do agendamento para a quitação).
- §2 do mesmo parecer: "o vínculo é fiscal; o clique não é" — a
  correspondência já existe no mundo desde o agendamento; replicar é o app
  **tomar conhecimento** de um fato já afirmado, não criar fato novo.
- Não replicar recria o defeito nomeado no parecer original como
  transição (b)→(c): custo real e já afirmado tratado como inexistente até
  segundo clique manual — a mesma família do "Custo confirmado R$ 0,00" que
  motivou aquele parecer.

## Condições que o ticket precisa carregar (guarda-corpos de produto, não regra fiscal nova)

1. Só replica se `documento_origem_id` estiver preenchido.
2. Só replica se a obra do documento == obra do compromisso **na hora da
   quitação** (pode ter mudado desde o agendamento — se divergir, não
   replica; caso já identificado pelo `cto-obra`).
3. Nunca sobrescreve vínculo que o Mateus já tenha ajustado manualmente em
   `pagamento_documento` — só cria vínculo **ausente**.
4. Vínculo replicado continua visível e editável, nunca uma trava. Quitação
   que resolve N compromissos num só pagamento (fatura de cartão com N
   compras) pode gerar N linhas — caso `multiplos_documentos` já previsto
   na migration `0007`.
5. Diferença entre valor previsto e valor pago não bloqueia a replicação do
   vínculo; quem decide quanto disso compõe custo continua sendo a regra do
   mínimo (Σ pagamentos × Σ documentos hábeis), já existente e intocada.

## Automático × humano

Replicar é 100% sistema no caso normal (mesma obra, vínculo intacto,
nenhum ajuste manual prévio). Só exige o Mateus nos edge cases já mapeados:
obra divergente, fatura com múltiplos documentos, vínculo manual anterior
que a replicação respeitaria sem sobrescrever.

## Consequência de escopo

`CONTAI-065` nasce **sem** gate fiscal de prioridade alta: é replicação de
dado já afirmado, não decisão fiscal nova. Segue o gate técnico padrão
(migration + RPC) porque altera `fatura_desembolso_gravar`, `fatura_alocar`
e `quitarCompromisso`.
