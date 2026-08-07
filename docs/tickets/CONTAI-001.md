# CONTAI-001 — Ingestão de NF/boleto com extração assistida

## Tipo e Prioridade
feature — **P0** — porta de entrada de todos os dados; US-002/003/004/005
dependem dela

## Dor de Origem
Relato 001 (D1, D3, D4): "sempre que chega uma nota ou boleto para pagamento eu
tenho que adicionar nesta planilha [...] Eu gostaria de subir a nota fiscal e o
boleto e o sistema faz todo o resto". Documentos chegam por WhatsApp e e-mail
(Q1) — já estão no celular do Mateus no momento da captura.

## User Story
Como dono da obra, quero subir o arquivo de uma NF (PDF/XML) ou boleto (PDF)
direto do celular e ter o registro proposto com os campos extraídos, para só
confirmar em vez de digitar na planilha.

## Critérios de Aceite
1. [ ] **Mock em `design/mocks/CONTAI-001.html` aprovado pelo Mateus**
       (PENDENTE — rodar `/design` antes de `/develop`)
2. [ ] Upload de PDF (NF ou boleto) e XML (NF-e) funciona em viewport 375px
3. [ ] Sistema propõe registro com: tipo de documento, emitente (CNPJ),
       destinatário, valor, vencimento (boleto), material vs. serviço,
       retenção 11% (NF de serviço)
4. [ ] Confirmação do registro em ≤3 interações a partir do upload
5. [ ] Campo extraído com incerteza vem marcado "revisar" — nunca aceito em
       silêncio
6. [ ] Destinatário ≠ CPF do Mateus → documento entra em quarentena com a
       consequência explícita: "não entra no custo de aquisição"
7. [ ] NF de serviço PJ sem retenção 11% identificada → aviso: "não abate na
       aferição INSS" (informativo, não bloqueia)
8. [ ] Arquivo original preservado no acervo (meta 3), associado ao registro

## Out of Scope
- Conciliação com pagamento e data efetiva (US-003)
- Captura automática de e-mail/WhatsApp (futuro; upload manual no MVP)
- **Fotografar nota de papel — cortado do MVP (decisão do Mateus, 2026-08-07)**
- Extração perfeita: a meta é propor bem e confirmar rápido, não acertar 100%

## Decisões de design (avaliação do mock, 2026-08-07)
- Resumo "em pendência" no topo: aprovado
- **Acumulado do imóvel junto ao valor do ano** (ênfase no ano, acumulado
  menor): incorporado no mock v2 — acumulado = situação 31/12 (Bens e Direitos)
- **Lembrete nasce junto com a confirmação do boleto**: a fatia de UI da US-002
  entra neste ticket (o contrato da tela); a entrega do lembrete em si segue
  na US-002

## Gate Fiscal (Contador)
- Documento hábil: NF de material com CPF do Mateus como **destinatário**; NF
  de serviço com ele como **tomador**. Divergência → quarentena (critério 6)
- Se documento = NF de serviço PJ → capturar flag de retenção 11% (alimenta a
  posição da aferição INSS na US-004)
- Classificação material vs. serviço: proposta automática a partir do documento;
  incerteza → revisão humana (nunca chute silencioso)
- Boleto NÃO é documento hábil sozinho — é título de cobrança. O custo só se
  sustenta com NF + prova de pagamento. O sistema deve refletir isso no status
  do registro ("aguardando NF" / "aguardando pagamento")
- **Q4 pendente** (cartão de crédito e ano-calendário): não afeta este ticket
  diretamente, mas o modelo de dados já deve comportar duas datas (ver CTO)

## Pre-mortem
1. Extração de PDF ruim → confirmação vira digitação disfarçada → Mateus volta
   para a planilha. Mitigação: XML quando existir; campos incertos bem marcados
2. Fluxo de captura com mais de 3 interações → documentos ficam esquecidos no
   WhatsApp. Mitigação: mock testado nesse cenário antes de codar
3. Classificação material/serviço errada e silenciosa → relatório anual errado
   descoberto só em abril. Mitigação: critério 5 + review fiscal no Gate 2

## Viabilidade (CTO)
- Modelo de dados: `Documento` (tipo, arquivo original, campos extraídos,
  status: proposto/confirmado/quarentena, motivo da quarentena) + `Favorecido`
  (CNPJ/CPF, nome, flag retenção). Preparar associação futura a `Pagamento`
  (US-003) com **duas datas possíveis** (compra e desembolso — Q4)
- Extração: XML de NF-e = parse determinístico; PDF = extração via LLM/OCR com
  confirmação humana obrigatória
- **Decisão que este ticket força: escolha da stack** (ainda não definida no
  CLAUDE.md). Precisa ser resolvida antes do Gate 1 do `/develop`
- Complexidade: **L** (upload + extração + quarentena + acervo)

## Dependências
- **Bloqueado por**: mock aprovado (critério 1); decisão de stack
- **Bloqueia**: US-002, US-003, US-004, US-005

## Perguntas Abertas
- Stack e hospedagem (decisão do Mateus com o `cto-obra`)
- Q5 do backlog (retenção nas notas do empreiteiro) — não bloqueia, mas a
  primeira nota real subida já responde

## Teste do Canteiro
- Metas atendidas: nº 1 (nenhum pagamento sem documento hábil — a quarentena
  nasce aqui) e nº 3 (acervo preservado desde o primeiro upload)
- Uma mão, com pressa: sim, se os critérios 2 e 4 segurarem no mock
- **Veredito: APROVADO** — condicionado a mock aprovado e stack definida
