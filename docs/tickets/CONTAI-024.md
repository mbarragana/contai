# CONTAI-024 — Corrigir o informe anual e o contrato do financiamento, com rastro

## Tipo e Prioridade
correção / dívida de fluxo — **P1**. Nasceu no **Gate 2 do CONTAI-010**
(2026-08-19), de um achado do `cto-obra`.

## Dor de Origem

O CONTAI-010 gravou três tabelas novas e **nenhum caminho de correção**. Três
situações ficam sem saída pela interface:

1. **Informe anual com duas rubricas trocadas entre si.** A soma fecha do mesmo
   jeito, então **nem a trava da aplicação nem o `CHECK` do banco acusam** — e
   `unique (financiamento_id, ano_base)` trava aquele ano-base **para sempre**.
   O custo do ano fica errado (amortização e juros/correção somam juntos, mas a
   discriminação de Bens e Direitos exige os **juros em linha nomeada própria**,
   critério 20 do CONTAI-010).
2. **Contrato digitado errado.** `unique (obra_id)` + sem DELETE + sem UPDATE:
   instituição, número ou data errados ficam presos.
3. **Desembolso `previsto` que foi pago.** O ITBI registrado como previsto
   (critério 5 do CONTAI-010) **não tem caminho para virar `pago`** —
   `completarDesembolsoTerreno` só escreve data e comprovante, e a constraint
   `terreno_desembolso_previsto_sem_data` recusaria. Hoje o usuário registra
   uma linha nova e a prevista fica órfã.

## Por que não foi resolvido com um `grant`

Foi a decisão explícita do Gate 2, e ela vale registro: a 0008 chegou a conceder
`update` em `financiamento` e `financiamento_informe` **sem tela**. O `cto-obra`
mandou tirar, com o argumento que fecha a questão — *o grant sem tela não
entrega o remédio que a justificativa promete*: no cenário das rubricas
trocadas, o conserto continuaria sendo PostgREST à mão. O grant só comprava
risco (reescrita de registro fiscal **sem rastro**, contra o append-only do
CONTAI-009) sem comprar remédio.

**A forma do repo para isto já existe** (migration 0007): *"desfazer uma
quitação é ticket com parecer; privilégio sem caminho é superfície à toa"*.

## Critérios de Aceite

1. [ ] **Tela de correção do informe anual**, com as sete rubricas, o total e o
       saldo devedor — sujeita à **mesma trava da soma** (tolerância zero) da
       gravação original.
2. [ ] **O rastro é obrigatório e vem no mesmo diff que o `grant`.** Molde:
       `compromisso_data_historico` (CONTAI-019). O informe é **transcrição de
       documento fiscal**; corrigi-lo sem histórico é o oposto do que o acervo
       append-only existe para fazer.
3. [ ] **Tela de correção do contrato** (instituição, número, nº de parcelas,
       data, preço contratado), com o mesmo rastro.
4. [ ] **Transição `previsto` → `pago`** do desembolso do terreno, com data e
       **comprovante obrigatório no ato** — pela meta 1, a exigência do anexo
       vale na transição, ao contrário do "completar a data" de uma linha que
       já nasceu `pago`. **Esta diferença é o ponto que precisa de decisão
       registrada, não de palpite de quem implementar.**
5. [ ] `grant update` volta para `financiamento` e `financiamento_informe`
       **no mesmo diff** que as telas, com o mapa de `e2e/privilegios.spec.ts`
       atualizado junto. Nunca antes.
6. [ ] **Nada de DELETE.** Correção é linha nova de histórico + valor corrigido,
       nunca supressão do que foi gravado.
7. [ ] E2E: corrigir rubricas trocadas muda o custo do ano **e** deixa rastro;
       correção que não fecha a soma é recusada; o `previsto` pago vira `pago`
       sem criar linha nova.
8. [ ] **A marca do FCVS sobrevive à gravação.** *(Acrescentado no Gate 4 do
       CONTAI-010, de uma ressalva do `contador`.)* A tela de leitura/correção
       mostra as **sete rubricas uma a uma**, e a linha **Taxas + FCVS** carrega
       a marca *"candidato a inclusão, pendente de confirmação"* — ela **nunca é
       agregada** com seguros nem com a "Diferença Teórico / Pago".
       **Por que isto é critério e não estética**: hoje a palavra "candidato" só
       existe no passo de digitação do CONTAI-010, e some em tudo que se lê
       depois. É o **pre-mortem 3** do CONTAI-010 acontecendo em câmera lenta —
       quando a confirmação do FCVS chegar, ninguém vai lembrar de revisitar. E
       a marca não pode virar a mesma dos seguros: seguro está **em aberto por
       divergência** (ADENDO 4), FCVS está **pendente de confirmação**. São
       coisas diferentes, e o critério 13 do CONTAI-010 manda preservar a
       diferença.
9. [ ] **Defesa em profundidade do filtro natureza → tipo de desembolso.**
       *(Ressalva do `cto-obra` no reveredito do Gate 2 do CONTAI-010.)* Hoje a
       regra `tiposDeDesembolsoPara` é imposta **só na camada de render**: nem
       `lib/data.ts` nem o banco recusam um `pagamento_terreno` numa obra
       `financiado`. O vetor residual é aba velha carregada antes de a natureza
       ser definida, ou request direto ao PostgREST. Como a camada de dados
       destas tabelas vai ser revisitada aqui de qualquer forma, a defesa entra
       junto.

## Gate Fiscal
**Necessário.** A pergunta ao `contador`: *um informe corrigido depois de o
ano-base já ter sido declarado exige alguma marca própria?* Relaciona-se com a
**D24** (o app não sabe qual ano-calendário já foi declarado).

## Dependências
- **Bloqueado por**: CONTAI-010 (entregue).
- **Relação**: CONTAI-021 (corrigir documento já registrado) — mesma família,
  provavelmente o mesmo padrão de rastro. Vale desenhar os dois juntos.
