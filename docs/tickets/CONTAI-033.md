# CONTAI-033 Nota grava sem o arquivo, com três guardas

## Tipo e Prioridade
feature — **P0** — dor ativa (D49), terceira ocorrência da classe "condição
fiscal sem parecer" e a mais cara das superfícies liberadas pelo parecer de
23/08: é a única que toca a aferição do INSS.

## Dor de Origem
**D49**, `docs/backlog/24-2026-08-23-relato-005.md`:

> *"Travas de anexo-PROVA recusam fato consumado, e nenhuma tem parecer que a
> carimbe — superfícies 3 e 4. Terceira ocorrência da classe D46/D48
> (condição fiscal sem parecer), e a mais cara: as outras duas produziram
> texto errado; esta produziu abandono do produto."*

Hoje `/adicionar/documento` recusa registrar uma nota sem o arquivo
(`lib/fiscal/documento.ts:117-121`, teste `documento.test.ts:97`). O parecer
`docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`, ADENDO 1 §A.3,
libera essa superfície — com três guardas **não opcionais**: *"Se o ticket
cortar a guarda 1 ou a 3, a liberação da superfície 3 vira defeito e este
parecer não a sustenta."*

## User Story
Como dono da obra, quando a nota chegou por WhatsApp e eu tenho emitente,
valor e tipo mas não o arquivo à mão, quero registrar os dados, para poder
cobrar a nota do emitente enquanto ainda tenho parcela a liberar.

## Critérios de Aceite

1. [x] **Proposta nível 1 em `design/mocks/CONTAI-033.md` (+ `.html`, 5
       telas) aprovada pelo Mateus.** Mock aprovado em 2026-08-24.
2. [ ] Documento grava em `/adicionar/documento` sem arquivo anexado (hoje
       recusado em `lib/fiscal/documento.ts:117-121`). E2E no padrão de
       `e2e/ingestao.spec.ts:439`, conferindo `arquivo_path` nulo no estado
       gravado (`docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`
       §A.3).
3. [ ] **Guarda 1**: documento sem arquivo (`arquivo_path IS NULL`) **não
       entra em `Σ documentos`** — não levanta o teto do custo comprovado
       (`C = min(Σ pagamentos elegíveis, Σ documentos hábeis)`). Teste em
       `sustentaCusto` (`lib/fiscal/vinculo.ts:42-44`) afirmando o "não" — a
       assinatura passa a exigir `arquivoPath`, typecheck varre os
       chamadores (§A.3, Guarda 1). **Direção do erro é inversa ao
       CONTAI-025**: lá subestimava e valia "o app mostra, o Mateus decide";
       aqui superestimaria — essa nuance não se aplica.
4. [ ] **Guarda 2**: documento sem arquivo **não abate** a base de aferição
       do INSS — teste no filtro de `lib/fiscal/resumo.ts:565`. A pergunta
       de retenção de 11% continua **obrigatória** no formulário, "não sei"
       continua valendo como resposta — muda só o abatimento (§A.3, Guarda 2).
5. [ ] **Guarda 3**: documento sem arquivo **não nasce `registrado`** —
       nenhum novo valor em `status_documento` (D52 fechado pelo `cto-obra`:
       `quarentena` não pode ser reaproveitada). `arquivo_path` vira
       nullable; "registrado sem arquivo" é estado **derivado**
       (`arquivo_path IS NULL`), exibido por função pura única
       (`estadoExibido`, `lib/fiscal/documento.ts`) — nenhuma tela monta o
       rótulo à mão.
6. [ ] Anexar o arquivo depois (tela nova, `/documento/[id]/anexar`)
       **REPERGUNTA** os dois checks fiscais (CPF, retenção) — nascem
       **vazios**, nunca herdam a resposta anterior, mesmo que o Mateus
       responda exatamente igual. Ato atômico único: RPC
       `anexar_arquivo_documento(id, path, nota_no_cpf, retencao)`, aceita só
       documento com `arquivo_path IS NULL`, grava o path e recomputa
       `status`/`motivo_quarentena` num só ato (§A.3, Guarda 3 — impede o
       "flip barato" do parecer de 18/08).
7. [ ] Texto do diálogo ao salvar sem arquivo, literal
       (`docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md` §A.7.1):
       > "Salvar sem o arquivo da nota?
       > Os dados ficam guardados e servem para cobrar a nota do emitente
       > enquanto você ainda tem parcela a liberar.
       > Sem o arquivo, esta nota **não sustenta custo nenhum** e **não
       > abate a aferição do INSS desta obra** — o abatimento depende da
       > nota de serviço com a retenção de 11%, não da lembrança dela.
       >
       > [ Salvar e cobrar a nota ]   [ Anexar agora ]"
8. [ ] Chip **"Nota sem arquivo"** (distinto de "Pago sem nota") + texto da
       pendência, literal (§A.7.2):
       > "Nota sem arquivo.
       > Você registrou os dados da nota, mas o arquivo não está no acervo.
       > Enquanto não estiver, ela não entra no custo comprovável e não
       > abate a aferição do INSS.
       > Peça o arquivo ao emitente agora: nota que ficou só na conversa
       > desaparece com a conversa, e o próximo pagamento é a última hora em
       > que você tem como cobrá-la."
9. [ ] Texto da repergunta ao anexar, literal (§A.7.3):
       > "Agora com a nota na mão, confirme o que está impresso nela.
       > Você respondeu de memória quando registrou. As perguntas voltam
       > porque agora há papel para conferir — e é o papel que a
       > fiscalização lê, não o app."
10. [ ] Migration com `arquivo_path` nullable, trigger de transição única
        (impede reescrita depois do primeiro anexo — doutrina da 0009
        preservada), RPC `anexar_arquivo_documento` (`security invoker`,
        `revoke`/`grant execute to authenticated`). `e2e/privilegios.spec.ts`
        atualizado — obrigatório mesmo sem tabela nova, porque o mapa cobre
        funções e a RPC nova entra nele.
11. [ ] **Guarda de superfície** (mesma disciplina do critério 16 do
        `CONTAI-025`/`036`): campo agregado `documentosSemArquivo` no
        `ResumoObra` (padrão `TerrenoPagoSemComprovante`,
        `{quantidade, totalCentavos, href}`), fora de
        `custoConfirmadoAnoCentavos`/`pendencias`/`emPendenciaCentavos`.
        `podeGerarRelatorioAnual` ganha 5º parâmetro opaco
        `DocumentosCarregados` (produzido só por
        `documentosCarregados(painel.documentos)`, sem query nova —
        `carregarPainel` já traz `documentos`); enquanto existir documento
        "sem arquivo" fora do agregado, nenhuma saída anual é gerada — mesma
        porta única, novo braço `{ok:false, semArquivo}` em
        `PermissaoRelatorio`.
12. [ ] **Guarda-chuva de default fiscal**: nenhum campo novo deste ticket
        (checks de CPF/retenção na tela de anexar) nasce preenchido ou
        herdado — a tela de anexar nasce com os dois em branco, sempre.

## Out of Scope
- **Superfícies 5 e 6** — recusa mantida (anexo é fonte, não prova).
- **Superfície 4** (desembolso do terreno) — já entregue (`CONTAI-025`/`036`).
- **D51** (registrar de qual conta o pagamento saiu) — bloqueado por 3
  perguntas próprias do relato 005.
- **Cobrança automática do emitente** — o app torna o dado visível e datado,
  não cobra por ele.
- **Lista de documentos própria** — o CTA "Ver os documentos" do card
  agregado (mock s5) não tem alvo hoje; decisão de nascer ou apontar para
  outro lugar é do `po`/`cto-obra` antes do Gate 1, não bloqueia o mock.

## Gate Fiscal (Contador) — FECHADO
Parecer: `docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`,
ADENDO 1, §A.0-A.3, §A.5, §A.7.1-A.7.3.

Documento sem arquivo é **prova**, não fonte (emitente/CNPJ/tipo/valor já
foram lidos pelo Mateus no WhatsApp/e-mail e digitados) — esperar perde o
fato: mídia some com a conversa, e-mail some no volume, nota nunca registrada
é nota nunca cobrada, e a janela de cobrança fecha sozinha quando a última
parcela é liberada.

**As três guardas não são opcionais** (§A.5). Guarda 1 não tem a nuance do
§2.1 do corpo do parecer ("o app mostra, o Mateus decide") — essa liberdade é
só para número que **subestima**; aqui um número solto **superestimaria**,
que é o erro mais caro (redução indevida de ganho de capital, multada).

**Decisão fiscal sobre a guarda de superfície (critério 11)**: exigida, pela
mesma leitura do §A.5 — *"quatro superfícies gravando e nenhuma cobrando é
trocar 'não registra' por 'registra e esquece'"* (D47). A Guarda 3 protege a
integridade da apuração, não é sinalização ao usuário — são coisas
diferentes, e por isso a guarda de superfície é adicional, não redundante.

**Automático vs. revisão humana**: tudo automático — sem exigência de CRC.

## Pre-mortem
1. **Guarda 1 furada por um segundo caminho de soma** — se `Σ documentos`
   voltar a ser calculado fora de `sustentaCusto` (relatório anual,
   `ResumoObra`, detalhe do documento) sem o mesmo filtro. Guarda: mudar a
   assinatura de `sustentaCusto` para exigir `arquivoPath` — o typecheck
   varre os chamadores, não é convenção.
2. **Guarda 3 vira flip barato disfarçado** — se a repergunta chegar
   pré-marcada com a resposta antiga em vez de nascer vazia. Guarda: RPC
   atômica sem parâmetro opcional, critério 6 e 12 nomeados.
3. **A pendência nasce sem superfície própria** (a guarda 11 não é
   construída, ou é cortada por "economia de escopo") — vira "registra e
   esquece", repetindo a D47. Guarda: critério 11 é bloqueante, não
   ressalva.

## Viabilidade (CTO)
**Complexidade: M.** Nenhuma tabela nova — `arquivo_path` vira nullable, sem
novo valor de `status_documento` (D52 fechado: `quarentena` sobrecarregada
quebraria a constraint `documento_quarentena_coerente`, `0001:66-67`, e
colidiria com boleto `aguardando_pagamento`; "sem arquivo" é uma segunda
dimensão, não um quarto status).

**Checks "de memória" vs. "no papel": nenhuma coluna nova** —
`arquivo_path IS NULL` é o carimbo; a RPC de anexar regrava os dois checks
num ato só, tornando herança impossível por não ter parâmetro opcional.

**Critério 11 sem pegadinha**: `podeGerarRelatorioAnual` continua pura e
síncrona, `carregarPainel` já traz `documentos` — nenhuma query nova.

**Arquivos**: `supabase/migrations/0014_documento_sem_arquivo.sql` (drop not
null + trigger de transição única + RPC) · `lib/database.types.ts` (regen) ·
`lib/fiscal/documento.ts` (validação, estado derivado, textos) ·
`lib/fiscal/vinculo.ts` · `lib/fiscal/resumo.ts` (+ testes) ·
`lib/fiscal/compromisso.ts` · `lib/dados/saida-anual.ts` ·
`app/adicionar/documento/page.tsx` · `app/documento/[id]/page.tsx` +
`app/documento/[id]/anexar/page.tsx` (nova) · `app/page.tsx` +
`app/_components/pago-sem-comprovante.tsx` (card agregado — **não**
`app/obras/[id]/page.tsx`, que é o formulário "Dados da obra", sem
`ResumoObra`; correção do designer) · `e2e/privilegios.spec.ts`.

**Dívidas criadas**:
1. Regra de status duplicada TS↔SQL dentro da RPC (mesma dívida já aberta
   pela 0009 — cresce, não nasce).
2. "Arquivo null fora de tudo" vive em predicados + testes, não num tipo —
   vale uma linha de aviso no cabeçalho de `vinculo.ts` para consumidor
   futuro nunca ler `status` cru.

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: nada identificado.

## Perguntas Abertas
- **Quarentena sem arquivo entra no agregado/veto do critério 11?** O CTO
  propõe que sim (o predicado é `arquivo_path IS NULL`, sem olhar `status`),
  mas o recorte é fiscal — confirmação de uma linha do `contador` antes do
  Gate 1.
- Cor do chip "Nota sem arquivo" — proposta vermelho por paridade com "Pago
  sem comprovante" no mock; `po`/`contador` confirmam.
- Redação das duas linhas de guarda visíveis em `/documento/[id]` ("Custo
  confirmado: não" / "Abate no INSS: não") — texto do designer, não do
  parecer; `contador` revisa antes do Gate 2.
- Alvo do CTA "Ver os documentos" do card agregado — sem lista de documentos
  hoje no app; `po`/`cto-obra` decidem antes do Gate 1 (não bloqueia o mock).

## Cenário e checagem final
**Misto**: `/adicionar/documento` é captura (comportamento intocado com
arquivo; o diálogo só aparece sem arquivo, não navega — caminho de captura
continua curto). Detalhe, anexar depois e home são gestão. Serve à meta 1
(nenhum pagamento sem documento hábil — aqui, nenhuma nota some por falta de
onde registrar) e à meta 2 (aferição INSS correta — guarda 2).

**Veredito: APROVADO**, com 4 Perguntas Abertas para resolver antes ou
durante o Gate 1 (nenhuma bloqueia a aprovação do mock).
