# CONTAI-034 entregue — 2026-09-21 — a D44 vira trava executável

O invariante *"campo fiscal não nasce preenchido"* já estava escrito no
`CLAUDE.md`; virou teste. `data-campo="<id do mock>"` (nunca o nome do state)
em todo controle fiscal, elo entre `design/mocks/*.md` e o DOM.

`lib/design/campos-do-spec.ts` parseia a seção `## Campos` dos specs,
**fail-closed**: linha que não casa com a gramática (`- \`id\` — ... — SEM
DEFAULT / DEFAULT DECLARADO: <razão> / SOMENTE LEITURA`) deixa a suíte
vermelha com arquivo:linha, nunca é ignorada — conserta-se o spec, nunca a
gramática. `e2e/campos-fiscais.spec.ts` cruza o declarado com o real: toda
rota de `app/**/page.tsx` tem que estar classificada (campos + specs, ou
`semCamposFiscais` com o motivo), todo controle no DOM carrega `data-campo`,
e nenhum campo `SEM DEFAULT` nasce preenchido.

Provado contra o caso real: reintroduzindo `useState(hojeIso)`/`useState("pix")`
em `/adicionar/pagamento` (a D44 original), a suíte fica vermelha nomeando
exatamente `fData` e `meio`; revertendo, volta a verde (validação manual do
`po` no Gate 4, além da automática do próprio critério 11 do ticket).

Cobertura é **a das rotas que a suíte já abre** (9 das 21) — falso negativo
assumido e escrito no próprio teste, mesmo desenho do `privilegios.spec.ts`.
Não prova nada sobre escolha feita por `<Botao>`/cartão tocável (fora do
alcance da enumeração de `input`/`select`/`textarea`) nem sobre campo
condicional que a visita não alcança.

Testado: 839 unitários (22 novos, parser) + 239 E2E (19 novos,
`campos-fiscais.spec.ts`) + validação manual confirmando `fData`/`meio` vazios
e o defeito reproduzido/revertido no Gate 4.

## Dívidas nomeadas

- **D65 — RESPONDIDA no próprio Gate 2 (decisão do `contador`, 21/09)**:
  `cValor` em `/compromisso/[id]/confirmar` pré-carregava o saldo do
  agendamento (`centavosParaInput(saldoDoCompromisso(...) || valorPrevisto)`)
  — a mesma forma da D44, o previsto ocupando o lugar do pago no regime de
  caixa. Corrigida **dentro deste ticket**, não em ticket separado: é
  divergência ativa que o teste novo ia denunciar como exceção inventada no
  mapa, e o `contador` tem autoridade de Gate Fiscal para decidir isso no
  próprio Gate 2 quando a alternativa é o ticket nascer com uma exceção sem
  proveniência fiscal real. ⚠️ **Só existia em comentário de código até esta
  entrada** (`app/compromisso/[id]/confirmar/page.tsx:151-158`) — sem parecer
  nem linha no backlog, a mesma falha de documentação que a regra
  *"parecer que só existe no transcript"* proíbe, com outro nome. Fechada por
  esta entrada; sem ticket futuro.
- **D66 — achada, não corrigida, doutrina "prova, não conserta" do próprio
  ticket**: `unidades_autonomas` (state `unidadesAutonomas`) nasce `"1"` em
  `app/obras/_campos.tsx` (`ESTADO_VAZIO`), contra o `SEM DEFAULT — campo
  fiscal` do `CONTAI-003` (>1 dispara aviso de equiparação a incorporação).
  Não pega pela suíte: o campo mora no **passo 4** do assistente de
  `/obras/nova`, e a visita testada é só do passo 1. Documentada em código
  (`e2e/campos-fiscais.spec.ts:65-71`) e aqui — falta ticket de conserto.
