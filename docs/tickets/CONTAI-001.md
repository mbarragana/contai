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

## Re-escopo (decisão do Mateus, 2026-08-07): manual-first, sem extração

Extração automática (Claude API) movida para US-008 [P2]. O registro é
manual com anexo obrigatório do arquivo; os checks fiscais que a extração
faria viram **perguntas obrigatórias do formulário** — condição do corte.

## Critérios de Aceite
1. [x] Mock aprovado — v3 em 2026-08-07; v4 (fluxo manual) aprovado em
       2026-08-08
2. [x] Upload do arquivo (PDF/XML/foto) funciona em viewport 375px e o
       original é preservado no acervo (meta 3), associado ao registro
3. [x] Formulário manual: tipo (NF material/NF serviço/boleto), emitente
       (CNPJ), valor, vencimento (boleto), material vs. serviço
4. [x] **Check obrigatório: "esta nota está no seu CPF?"** — "não" →
       quarentena com a consequência explícita ("não entra no custo de
       aquisição"); sem resposta não salva
5. [x] **Check obrigatório em NF de serviço: "tem retenção de 11%?"** —
       "não"/"não sei" → aviso "não abate na aferição INSS" (não bloqueia)
6. [x] Registro sem arquivo anexado não é aceito silenciosamente — vira
       pendência "sem comprovante" *(atendido por bloqueio, não por
       pendência — ver Gate 4)*
7. [ ] Fluxo de captura continua em ≤3 interações para o caso comum
       — **NÃO ATENDIDO; transferido para a US-008** (ver Gate 4)

## Out of Scope
- **Extração automática de campos (Claude API) — movida para US-008 [P2]**
- Conciliação com pagamento e data efetiva (US-003)
- Captura automática de e-mail/WhatsApp (futuro; upload manual no MVP)
- Fotografar nota de papel dentro do app (upload de foto como arquivo, sim)

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
- **Stack decidida (2026-08-07)**: Next.js 16 + Supabase + Claude API + Vercel
  — ver CLAUDE.md. Pendência resolvida
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

---

# Gate 4 — validação do PO, 2026-08-08

**Veredito: DONE COM RESSALVAS.** O ticket entrega a porta de entrada que ele
prometeu: nenhum registro nasce sem arquivo, sem os dois checks fiscais e sem
favorecido identificado. O que ele **não** entrega — e o texto do ticket
sugeria que entregaria — é o fluxo de ≤3 interações (critério 7) e qualquer
movimento real na meta 2 (relatórios). As duas coisas são consequência
aceita do re-escopo manual-first, não falha de execução.

Evidência independente rodada pelo PO em 2026-08-08:
`npm test` → 64/64; `npx tsc --noEmit` → limpo; `npm run test:e2e` →
10/10 contra o Supabase local (Postgres real, RLS ligada, bucket real).
(Hoje o mesmo se roda de uma vez com `npm run quality`.)

Riscos de projeto levantados fora do ticket e registrados no backlog: repo
nunca pushado, ausência de CI e `npm run dev` apontando para o banco REMOTO.

## 1 · Critério a critério

| # | Veredito | Evidência (verificada, não relatada) |
|---|---|---|
| 1 | **Atendido** | `design/mocks/CONTAI-001.html` (v4, telas 1–10, inclui a porta de pagamento avulso). Ressalva: o mock ficou com o headline "Em pendência R$ 47.850", que é aritmética velha — corrigir junto com CONTAI-005 para não contaminar o próximo ticket |
| 2 | **Atendido** | `playwright.config.ts` fixa viewport 375×812; o e2e "fluxo completo" afirma `arquivo_path` com prefixo `${USER_ID}/documento/` **e** confere o objeto dentro do bucket `acervo` — não só que a tela disse "salvo". Ressalva de meta (não de critério): preservar ≠ recuperar; ver §2 |
| 3 | **Atendido** | `app/adicionar/documento/page.tsx` + `validarDocumento` em `lib/fiscal/documento.ts`; vencimento só aparece e só é exigido em boleto. **Buraco fora do critério**: não há campo de nº do documento nem data de emissão (schema `0001_init.sql` confirma) — ver ressalva R1 |
| 4 | **Atendido** | Dois e2e distintos: "sem responder os checks fiscais, não salva" afirma **estado gravado zerado** (0 documentos, 0 favorecidos, 0 arquivos no bucket) — prova que não há meio-registro; e "nota fora do CPF" afirma `status: quarentena` + `motivo_quarentena` preenchido + a tela de quarentena aberta na URL do documento gravado |
| 5 | **Atendido, e mais estrito que o pedido** | e2e com "Não sei" grava `retencao_11: null` (não vira `false`), mostra o aviso do SERO e **salva assim mesmo**. A implementação exige *responder* (`null` → erro de campo); é mais duro que o critério e está certo — "não sei" é a válvula de escape. Ratificado |
| 6 | **Atendido por outra via** | `documento.test.ts:97` e a validação bloqueiam sem anexo; o e2e do pagamento afirma 0 linhas quando falta comprovante. **Divergência**: o critério pedia "vira pendência sem comprovante", a implementação **bloqueia**. É o que o re-escopo ("anexo obrigatório") mandou, e o re-escopo é mais recente. Ratifico o bloqueio, com o risco anotado em R2 |
| 7 | **NÃO ATENDIDO** | Caminho comum (NF material) medido no código: 2 toques de navegação + seletor de arquivo + tipo + 3 campos digitados (emitente, CNPJ de 14 dígitos, valor) + check do CPF + salvar ≈ **10 interações, 4 delas de digitação**. Pior: a AppBar afirma "Interação 2 de 3" / "Interação 3 de 3" — rótulo herdado do fluxo com extração, hoje factualmente falso. Ver R3 |

Nota metodológica: os e2e não se contentam com o que a tela diz — quase todos
terminam afirmando linha gravada no Postgres. Isso é o padrão certo para este
produto (o que vira declaração é o estado gravado) e é a razão de eu aceitar
os critérios 2, 4, 5 e 6 sem exigir teste manual adicional.

## 2 · As três metas do produto

**Meta 1 — nenhum pagamento sem documento hábil: move muito.** É o coração
desta entrega. A quarentena nasce com a consequência escrita, o boleto é
tratado como não-hábil por construção (`ehDocumentoHabil` em
`lib/fiscal/resumo.ts`), o pagamento avulso nasce "aguardando NF" e o
comprovante é obrigatório. **Onde não move**: o app **cria** pendências e não
**fecha** nenhuma — não há vincular NF a pagamento, tirar da quarentena nem
marcar boleto pago. Uma lista que só cresce vira ruído em poucas semanas;
US-003 é o fecho obrigatório desta meta, não um "depois".

**Meta 2 — relatórios anuais prontos: quase não move.** Nenhum relatório
existe, o que era esperado. O que **não** era esperado e eu registro aqui:
o único número fiscal da home ("Custo confirmado em 2026") é
**estruturalmente R$ 0,00** enquanto a US-003 não existir, porque custo só
soma com pagamento `conciliado` e nada no app cria esse status. No primeiro
uso real o Mateus vai registrar NF + PIX e ver "custo confirmado R$ 0,00"
com uma parede vermelha de pendências embaixo. Isso não é bug — é a
consequência honesta do escopo — mas precisa ser dito antes de ele abrir o
app achando que substituiu a planilha. Some-se R1 (sem nº da NF a
discriminação anual definida pelo contador não sai).

**Meta 3 — acervo até venda + 5 anos: move o mínimo indispensável.** O
original é obrigatório, sobe para a pasta do dono e fica associado à linha.
**Onde não move**: (a) nenhuma tela abre ou baixa o arquivo — preservação sem
recuperação não é acervo; (b) legibilidade não é verificada (aceita foto
tremida ou arquivo de 0 byte, e o CLAUDE.md pede "legibilidade verificada");
(c) o export periódico para storage do próprio Mateus — requisito
**permanente** do CLAUDE.md — não existe; (d) upload órfão já mapeado no
Gate 2 vai poluir esse export. Itens (a) e (c) viraram backlog.

## 3 · Divergências do mock — decisão do PO

| Divergência | Recomendação | Razão |
|---|---|---|
| Linha de imposto da tela 6 ("~R$ 728 a mais") omitida | **Ratificar a omissão**; volta como item de backlog com a fórmula do contador | Número de imposto errado é pior que número ausente: é o argumento que ele usa com o fornecedor. 15% cheio ignora fator de redução e isenções. Volta como "até R$ X", com disclaimer, quando o contador fechar a fórmula |
| "Destinatário: AJE" omitido por falta de campo | **Backlog, anexado à US-008** (não ticket próprio) | Perguntar "quem é o destinatário então?" custa mais um campo no caminho ruim, e o PDF anexado já tem a resposta a um toque. A extração automática entrega isso de graça — esperar por ela é o negócio certo |
| Botão "Anotar: falar com o empreiteiro" removido | **Cortar em definitivo** | Comunicação com empreiteiro é escopo declarado como fora do produto (CLAUDE.md). Não vai para o backlog; vai para a lista de cortes |
| Botão "Pedir nota corrigida ao fornecedor" removido | **Backlog P2, com trava de escopo** | Tentador porque é a única ação que salva o custo. Aceitável só como deep-link de WhatsApp com texto pronto e **zero estado no sistema**. Se virar caixa de entrada de conversa, é escopo proibido — candidato a corte na revisão seguinte |
| FAB "+ Documento" → "+ Adicionar" | **Ratificar; corrigir o mock** | Não foi divergência, foi correção: o mock v4 já tem duas portas e o rótulo "+ Documento" era resquício da v2. O mock é que está errado |
| Tela 8 parametrizada por porta de entrada | **Ratificar** | O "próximo passo" honesto é diferente entre documento e pagamento. O mock tinha uma tela só porque foi desenhada antes da porta de pagamento existir |
| "Favorecido (recente)" não implementado | **Backlog P1 — primeiro da fila depois do login** | Não é conveniência. O caso real do relato 002 é PIX mensal para a AJE: mesmo CNPJ de 14 dígitos, todo mês, digitado de celular com uma mão. Um dígito errado cria favorecido novo e **parte a exposição "pago sem nota" e a agregação CPF-por-CPF da US-004 em dois** — o upsert só protege quem digita certo. Tem consequência fiscal indireta |

## 4 · Decisão pendente nº 1 — o headline "Em pendência"

**Nem ratificar os R$ 92.850, nem voltar aos R$ 47.850.** Os dois estão
errados, por motivos diferentes.

Os R$ 47.850 do mock = 4.850 + 25.000 + 18.000. É a soma **de antes** de o
card "pago sem nota" existir; ninguém recalculou o topo quando a US-007
entrou. Voltar para lá é ratificar um erro de aritmética do mock — e, pior,
esconder justamente os R$ 45.000 que são o dinheiro mais em risco da tela.

Os R$ 92.850 somam quatro coisas que não são a mesma moeda:
- **quarentena (4.850)** — custo de aquisição que se perde se não corrigir: é
  perda real;
- **pago sem nota (45.000)** — custo que não se sustenta enquanto a NF não
  chega: é perda real;
- **boleto sem NF (25.000)** — o dinheiro **ainda não saiu**. É conta a pagar,
  não custo em risco. Somar aqui mistura "vou perder" com "vou pagar", e é a
  fonte do double-count que o cto-obra apontou (boleto registrado + o
  pagamento avulso do mesmo boleto);
- **NF de serviço sem retenção (18.000)** — esse custo **entra normal no IR**.
  O que está exposto é INSS, e não são R$ 18.000: é a base de cálculo de uma
  aferição cujo valor quem define é o contador. Colocar o valor de face na
  soma superestima a exposição em quase 10×.

**Minha recomendação (raciocínio de canteiro):** no canteiro ele olha **um**
número, por dois segundos, com uma mão. Um número que mistura moedas
diferentes não guia ação nenhuma — ou ele ignora, ou entra em pânico com
R$ 92.850 quando o dinheiro em risco é R$ 49.850. O número certo é o que
**sobe quando ele paga sem nota e desce quando a nota chega**, porque é
exatamente esse o comportamento que o produto quer ensinar (cobrar a nota da
AJE antes da próxima parcela).

Portanto:
1. **Headline = custo em risco no IR = quarentena + pago sem nota**
   (R$ 49.850 no cenário do mock), rotulado **"Custo em risco no IR"** — não
   "Em pendência", que não diz o que se perde;
2. **Exposição INSS em linha separada, em base, não em reais perdidos**:
   "1 NF de serviço sem retenção — R$ 18.000 de base". O valor em reais da
   exposição só entra quando o contador definir o cálculo da aferição
   (US-004). Não inventar percentual em tela;
3. **Boleto sai do headline** e continua como card. Ele já tem lugar próprio:
   a fila "a pagar" da US-002;
4. Efeito colateral bom: com o boleto fora, o double-count apontado pelo
   cto-obra deixa de existir sem precisar de regra de deduplicação.

Isso vira **CONTAI-005 [P0]** — muda `lib/fiscal/resumo.ts`, a home e o mock.
Não bloqueia o DONE deste ticket porque, sem login (CONTAI-002), ninguém usa
a tela; mas **tem que entrar antes de CONTAI-002 chegar a produção**.

## 5 · O ticket pode ser dado como DONE?

**Sim — DONE COM RESSALVAS**, com estas cinco registradas:

- **R1 [P0] — falta nº do documento e data de emissão.** O contador já
  escreveu o formato da discriminação anual: *"NF nº X, valor total R$ Z,
  pago R$ Y no ano"* (Q6, backlog). Sem o número gravado, a US-004 não
  consegue gerar o texto, e todo registro feito antes da correção terá que
  ser reaberto um a um. Custo hoje: um campo. Custo depois: retrabalho
  manual documento a documento. **Vira CONTAI-004 [P0]** e precisa entrar
  antes do primeiro registro real (isto é, antes de CONTAI-002 ir ao ar).
- **R2 — bloqueio em vez de pendência (critério 6).** Ratificado. Risco
  aceito: se um dia a nota chegar por um canal que não põe o arquivo no
  celular, ele não conseguirá registrar nada e o dado se perde. Se acontecer
  na vida real, reabrir como "registrar agora, anexar depois → pendência".
  Não antecipar.
- **R3 — critério 7 não atendido.** Formalmente transferido para a US-008. Na
  mesma leva, trocar o rótulo "Interação X de 3" por "Passo X de 3": hoje a
  tela afirma um número que ela mesma não cumpre, e ele vai perceber na
  primeira nota. A métrica de aceite do fluxo manual passa a ser **"tempo até
  salvar ≤ 60 s com uma mão"**, medido no primeiro uso real — não contagem de
  toques.
- **R4 — headline errado** (§4) → CONTAI-005 [P0], antes de produção.
- **R5 — acervo só preserva, não recupera nem exporta** (§2, meta 3) → duas
  entradas novas no backlog (US-010, US-011).

O que **não** exijo antes do DONE, e por quê: login, cadastro de obra,
conciliação, lista de registros e relatórios são escopo de outros tickets já
mapeados. Cobrar aqui seria alargar o ticket depois do fato.

## 6 · Achado do Gate 3 — 7,7 s parado em "Carregando a obra"

Confirmado por mim: o e2e "banco fora, com saída" leva **7,8 s** de ponta a
ponta (retry do postgrest-js, 1 s + 2 s + 4 s).

**É aceitável? Não — mas o problema não é a duração, é a mentira.** Durante
os 7,7 s a tela diz "Carregando a obra" quando, a partir do primeiro
segundo, ela já sabe que a primeira tentativa falhou. No canteiro, com sol na
tela e uma mão livre, 3 s de spinner mudo já é o ponto em que ele guarda o
celular e volta para a planilha (é o pre-mortem nº 2 deste ticket, com outra
roupa).

Dois atenuantes honestos: (a) ninguém perde dado — na home é leitura, e no
formulário a falha ocorre antes de ele digitar; (b) o cenário exato dos 7,7 s
é resposta 5xx (servidor de pé, backend fora), não celular offline — offline
falha rápido. Por isso **não é P0**: não põe custo fiscal em risco.

**Recomendação: vira ticket CONTAI-006 [P1]**, com escopo maior que o achado —
o achado é sintoma. Hoje **nenhuma** tela tem teto de espera: numa 4G ruim, o
"Carregando a obra" pode ficar indefinidamente, o que é pior que 7,7 s.
Escopo: (1) feedback progressivo aos ~2 s ("sem resposta do servidor —
tentando de novo"), que é o mínimo aceitável; (2) teto de espera com erro
acionável; (3) revisar o retry do postgrest-js para leituras de tela. O
"Tentar de novo" que já existe continua sendo a saída. A definição técnica é
do `cto-obra`.
