# CONTAI-005 entregue — 2026-09-20

Headline "Custo em risco no IR" reescrito: `emPendenciaCentavos` (soma crua de
`pendencias[]`, quatro moedas fiscais diferentes) removido; entra
`custoEmRiscoIr` como estrutura de três parcelas (pago sem nota, nota fora do
CPF, pago sem comprovante) e `exposicaoInssBaseCentavos` separado (base, não
reais de imposto). Dedup por vínculo explícito com orçamento consumível por
pagamento — nunca por heurística.

Gate 2 fiscal (`contador`) fechou duas lacunas que o mock original de 16/08 não
previa (os tipos de pendência nasceram depois, no CONTAI-019/025): a 3ª parcela
"pago sem comprovante" entra no headline (mesma moeda, art. 17 da IN SRF
84/2001 — falha a perna de comprovação do desembolso); `nf_servico_sem_cno`
entra na base de exposição do INSS, deduplicada por `documento.id` (união de
ids, nunca soma de dois arrays de pendências) para não contar duas vezes um
documento com duas pendências simultâneas (sem retenção E sem CNO).

Testado: 712 unitários + 201/202 E2E (a falha restante é pré-existente, não
fiscal — ver `35-2026-09-20-discriminacao-veto-transversal-teste-flaky.md`).

## Dívida fiscal nova

- **D61** — `terrenoPagoSemComprovante` (desembolso do TERRENO pago sem
  comprovante) continua FORA do headline "Custo em risco no IR", pela mesma
  exclusão herdada do critério 21 do CONTAI-010/025 (decisão de escopo, não
  fiscal). O `contador` confirmou que é a MESMA moeda que a 3ª parcela que
  acabou de entrar (falha a perna de comprovação do art. 17, é fato consumado
  — D39 vermelha), e que terreno + obra são o MESMO bem (mesma matrícula;
  `acumuladoImovelCentavos` já soma os dois). O headline hoje **subestima** a
  exposição real do imóvel único. Não corrigido aqui porque envolve unificar
  duas pipelines de agregação distintas (`alocarCusto` de
  documentos/pagamentos vs. `desembolsosTerreno`) — decisão de arquitetura do
  `cto-obra`, fora de escopo do CONTAI-005. Abrir ticket próprio; prioridade é
  decisão do `po`.
