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
2. [x] Documento grava em `/adicionar/documento` sem arquivo anexado (hoje
       recusado em `lib/fiscal/documento.ts:117-121`). E2E no padrão de
       `e2e/ingestao.spec.ts:439`, conferindo `arquivo_path` nulo no estado
       gravado (`docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`
       §A.3).
3. [x] **Guarda 1**: documento sem arquivo (`arquivo_path IS NULL`) **não
       entra em `Σ documentos`** — não levanta o teto do custo comprovado
       (`C = min(Σ pagamentos elegíveis, Σ documentos hábeis)`). Teste em
       `sustentaCusto` (`lib/fiscal/vinculo.ts:42-44`) afirmando o "não" — a
       assinatura passa a exigir `arquivoPath`, typecheck varre os
       chamadores (§A.3, Guarda 1). **Direção do erro é inversa ao
       CONTAI-025**: lá subestimava e valia "o app mostra, o Mateus decide";
       aqui superestimaria — essa nuance não se aplica.
4. [x] **Guarda 2**: documento sem arquivo **não abate** a base de aferição
       do INSS — teste no filtro de `lib/fiscal/resumo.ts:565`. A pergunta
       de retenção de 11% continua **obrigatória** no formulário, "não sei"
       continua valendo como resposta — muda só o abatimento (§A.3, Guarda 2).
5. [x] **Guarda 3**: documento sem arquivo **não nasce `registrado`** —
       nenhum novo valor em `status_documento` (D52 fechado pelo `cto-obra`:
       `quarentena` não pode ser reaproveitada). `arquivo_path` vira
       nullable; "registrado sem arquivo" é estado **derivado**
       (`arquivo_path IS NULL`), exibido por função pura única
       (`estadoExibido`, `lib/fiscal/documento.ts`) — nenhuma tela monta o
       rótulo à mão.
6. [x] Anexar o arquivo depois (tela nova, `/documento/[id]/anexar`)
       **REPERGUNTA** os dois checks fiscais (CPF, retenção) — nascem
       **vazios**, nunca herdam a resposta anterior, mesmo que o Mateus
       responda exatamente igual. Ato atômico único: RPC
       `anexar_arquivo_documento(id, path, nota_no_cpf, retencao)`, aceita só
       documento com `arquivo_path IS NULL`, grava o path e recomputa
       `status`/`motivo_quarentena` num só ato (§A.3, Guarda 3 — impede o
       "flip barato" do parecer de 18/08).
7. [x] Texto do diálogo ao salvar sem arquivo, literal
       (`docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md` §A.7.1):
       > "Salvar sem o arquivo da nota?
       > Os dados ficam guardados e servem para cobrar a nota do emitente
       > enquanto você ainda tem parcela a liberar.
       > Sem o arquivo, esta nota **não sustenta custo nenhum** e **não
       > abate a aferição do INSS desta obra** — o abatimento depende da
       > nota de serviço com a retenção de 11%, não da lembrança dela.
       >
       > [ Salvar e cobrar a nota ]   [ Anexar agora ]"
8. [x] Chip **"Nota sem arquivo"** (distinto de "Pago sem nota") + texto da
       pendência, literal (§A.7.2):
       > "Nota sem arquivo.
       > Você registrou os dados da nota, mas o arquivo não está no acervo.
       > Enquanto não estiver, ela não entra no custo comprovável e não
       > abate a aferição do INSS.
       > Peça o arquivo ao emitente agora: nota que ficou só na conversa
       > desaparece com a conversa, e o próximo pagamento é a última hora em
       > que você tem como cobrá-la."
9. [x] Texto da repergunta ao anexar, literal (§A.7.3):
       > "Agora com a nota na mão, confirme o que está impresso nela.
       > Você respondeu de memória quando registrou. As perguntas voltam
       > porque agora há papel para conferir — e é o papel que a
       > fiscalização lê, não o app."
10. [x] Migration com `arquivo_path` nullable, trigger de transição única
        (impede reescrita depois do primeiro anexo — doutrina da 0009
        preservada), RPC `anexar_arquivo_documento` (`security invoker`,
        `revoke`/`grant execute to authenticated`). `e2e/privilegios.spec.ts`
        atualizado — obrigatório mesmo sem tabela nova, porque o mapa cobre
        funções e a RPC nova entra nele.
11. [x] **Guarda de superfície** (mesma disciplina do critério 16 do
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
12. [x] **Guarda-chuva de default fiscal**: nenhum campo novo deste ticket
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
- ~~**Quarentena sem arquivo entra no agregado/veto do critério 11?**~~ —
  **CONFIRMADO pelo `contador` em 2026-09-19**: sim, o predicado é só
  `arquivo_path IS NULL`, sem olhar `status`. A guarda de superfície do
  critério 11 é adicional à quarentena, não redundante — um documento pode
  acumular as duas pendências (quarentena por CPF divergente + sem arquivo) e
  deve aparecer nas duas, nunca só numa (o mesmo buraco D47 que a guarda
  existe para fechar).
- ~~Cor do chip "Nota sem arquivo"~~ — **CONFIRMADO vermelho pelo `contador`
  em 2026-09-19**: pela régua do ADENDO 2 §A.4, sem apoio hábil nenhum (o
  arquivo que falta é o próprio documento hábil, não uma prova de pagamento
  sobre nota que já existe — mais grave que o caso PJ-âmbar).
- ~~Redação das duas linhas de guarda visíveis em `/documento/[id]`~~ —
  **AJUSTADA pelo `contador` em 2026-09-19**. "Abate no INSS: não" mantém
  (espelha a Guarda 2 literalmente). "Custo confirmado: não" **troca para
  "Sustenta custo de aquisição: não"** — o rótulo original colidia com
  `custoConfirmadoAnoCentavos` (total da obra no ano) e podia ser lido como
  "a obra não tem custo confirmado" em vez de "este documento não sustenta
  custo". "Sustentar" também carrega melhor a reversibilidade (vira "sim" no
  instante em que o arquivo sobe, Guarda 3). Texto final:
  > Sustenta custo de aquisição: não
  > Abate no INSS: não
- ~~Alvo do CTA "Ver os documentos" do card agregado~~ — **DECIDIDO pelo `po`
  em 2026-09-19: opção (b), sem lista nova.**
  `quantidade === 1` → `href` aponta para `/documento/[id]` do próprio
  documento (rota já existe, já mostra chip + pendência + "Anexar o arquivo
  agora"). `quantidade > 1` → `href = null`, card fica sem CTA clicável nesta
  rodada (quantidade + total + veto ao relatório já sinalizam o suficiente).
  `documentosSemArquivo.href` no `ResumoObra` é `string | null`, diferente de
  `TerrenoPagoSemComprovante` (que sempre tem lista). Justificativa e corte
  registrados em
  `docs/backlog/32-2026-09-19-cta-documentos-sem-arquivo-contai-033.md`.

**As 4 perguntas estão fechadas — nada bloqueia o Gate 1.**

## Cenário e checagem final
**Misto**: `/adicionar/documento` é captura (comportamento intocado com
arquivo; o diálogo só aparece sem arquivo, não navega — caminho de captura
continua curto). Detalhe, anexar depois e home são gestão. Serve à meta 1
(nenhum pagamento sem documento hábil — aqui, nenhuma nota some por falta de
onde registrar) e à meta 2 (aferição INSS correta — guarda 2).

**Veredito: APROVADO**, com 4 Perguntas Abertas para resolver antes ou
durante o Gate 1 (nenhuma bloqueia a aprovação do mock).

---

## Veredito do Gate 1 (`lead-engineer`, 2026-09-19/20)

**Os 12 critérios estão cumpridos. Nenhum corte de escopo.**

### As três guardas, e onde cada uma vive

- **Guarda 1** — `ehDocumentoHabil` (`lib/fiscal/vinculo.ts`) ganhou o terceiro
  requisito `arquivoPath !== null`, e a assinatura passou a exigir o campo: o
  typecheck varreu os chamadores e acusou **9 arquivos**, incluindo os dois
  objetos parciais de `app/adicionar/documento` e os quatro
  `ListaDeAnexos itens={[{ path: d.arquivoPath }]}` das telas de correção
  (resolvidos por `papelOriginal` + `SEM_PAPEL_NO_ACERVO`, definição única em
  `app/_components/anexo.tsx`). Não é convenção: é tipo, como o pre-mortem 1 pede.
- **Guarda 2** — comunicada pelo agregado novo e pelas duas linhas de guarda do
  detalhe. O loop `servico_sem_retencao` de `resumo.ts` **não foi tocado** (é
  sobre a RESPOSTA de retenção, não sobre o arquivo) e a pergunta continua
  obrigatória no formulário. Não existe calculador da base de aferição no código
  hoje (US-004), logo não há filtro numérico adicional a mudar — há teste
  afirmando que as duas pendências coexistem sem se substituir.
- **Guarda 3** — RPC `anexar_arquivo_documento` (migration 0014), sem parâmetro
  opcional do lado do domínio, aceitando só `arquivo_path is null`, mais o
  trigger `documento_arquivo_path_imutavel`, que preserva a doutrina da 0009
  (`arquivo_path` é NÃO CORRIGÍVEL — anexa-se adicional). A nulidade abriu **uma**
  transição, não a reescrita.

### Leitura do critério 5, explicitada para o Gate 2
O `status` gravado de uma nota sem arquivo **continua sendo `registrado`** — é o
que o próprio critério manda (*"nenhum novo valor em `status_documento`"*, D52).
O *"não nasce `registrado`"* foi implementado como o critério o define na frase
seguinte: estado **derivado**, `arquivo_path IS NULL`, exibido por `estadoExibido`.

### Defeito encontrado e corrigido DENTRO do Gate 1
`estadoExibido` é o rótulo ÚNICO e devolve **um** valor — e usá-lo como
predicado da pendência (`=== "registrado_sem_arquivo"`) escondia o bloco
exatamente no caso que a confirmação do `contador` de 2026-09-19 nomeia:
quarentena **e** sem arquivo ao mesmo tempo. Quem pegou foi o E2E
(`quarentena SEM arquivo mostra as DUAS pendências`). Conserto: predicado
próprio `faltaOArquivo` em `lib/fiscal/documento.ts`, **usado pelos três
consumidores** (a tela, o agregado do `ResumoObra` e o veto da saída anual) —
`arquivoPath === null` não aparece à mão em lugar nenhum.

O segundo defeito pego pelo E2E foi de SQL: o `case` do `status` na RPC tipava
como `text` e o UPDATE morria em runtime (`42804`). Resolvido com
`::status_documento` no primeiro braço — o plpgsql só resolve o corpo na
primeira execução, então nem o `create function` nem o typecheck o veriam.

### Cobertura de teste
- **Vitest — 639 passando** (19 arquivos). Novos: `estadoExibido` nos 4 estados +
  `faltaOArquivo`; `ehDocumentoHabil` com os três requisitos conjuntivos e a
  reversibilidade; `documentosSemArquivo` (vazio/1/2+/sem valor/quarentena) e os
  quatro "não" (fora de `pendencias`, `emPendenciaCentavos`,
  `custoConfirmadoAnoCentavos`, `notasSemPagamento`); o braço `semArquivo` de
  `podeGerarRelatorioAnual` com **precedência** do portão transversal, o `ano` que
  não recorta, e `@ts-expect-error` provando que o literal `[]` não substitui
  `documentosCarregados`.
- **Playwright — 179 passando**, incluindo os 16 novos de
  `e2e/documento-sem-arquivo.spec.ts` e os 5 de `privilegios.spec.ts` já com
  `anexar_arquivo_documento` e `documento_arquivo_path_imutavel` no mapa.
- `npm run typecheck`, `npm run lint` e `npm run build`: limpos.

### Nota de release
A **migration 0014 vai antes do `git push`** (`npx supabase db push`), pela ordem
obrigatória do `CLAUDE.md`. Ela é aditiva: `drop not null` + trigger + função com
revoke/grant. `lib/database.types.ts` foi regenerado (`arquivo_path` nullable nas
três formas e a nova função).

### Dívidas (as duas previstas no ticket, nenhuma nova)
1. Regra de `status`/`motivo_quarentena` duplicada TS↔SQL dentro da RPC — a mesma
   da 0009. O texto de `MOTIVO_QUARENTENA_CPF` está copiado char por char.
2. "Arquivo null fora de tudo" vive em predicado + testes, não num tipo. O aviso
   pedido está no cabeçalho de `ehDocumentoHabil` ("NUNCA LEIA `status` CRU PARA
   DECIDIR HABILIDADE"), e o predicado tem dono único (`faltaOArquivo`).

---

## Gate 2 (`cto-obra`, 2026-09-20)

**VEREDITO: APROVADO COM RESSALVAS** — nenhuma bloqueante; as três guardas do
parecer estão em pé e são de tipo/banco, não de convenção.

**Revisado**: o `git diff` inteiro (27 arquivos) + os 5 novos (`0014`, tela
`anexar`, card, E2E, entrada de backlog), a `0009` completa como precedente, e
o parecer ADENDO 1 §A.3–A.5. Rodei `npm run typecheck` e `npm run lint`:
limpos. Unit (639) e E2E (179) conferidos pelo orquestrador, não repetidos.

### Os três desvios do lead-engineer — os três estão certos
1. **`faltaOArquivo` separado de `estadoExibido`** — correto. Rótulo é
   injetivo em um valor; pendência é predicado aditivo. Usar o rótulo como
   predicado escondia quarentena+sem-arquivo, que é o caso que o `contador`
   nomeou. Consumidores conferidos: tela do documento, `resumo.ts` (agregado),
   `compromisso.ts` (veto). Nenhum `arquivoPath === null` solto em `lib/`.
2. **Cast `'quarentena'::status_documento`** — resolve de fato. Regra do
   Postgres para `CASE`: se TODOS os braços são literais `unknown`, o tipo cai
   em `text`; basta UM braço tipado para os outros serem coagidos. Não há
   segundo `case` com o risco na função: `retencao_11` é boolean×boolean,
   `motivo_quarentena` é text×null. `p_nota_no_cpf` nulo não abre buraco —
   `destinatario_cpf_ok` é `not null` desde a 0001, o UPDATE falha.
3. **Trigger `documento_arquivo_path_imutavel`** — fiel no espírito, mais
   forte no mecanismo. Na 0009 a imutabilidade era PROSA + convenção ("não é
   tocado em lugar nenhum desta função"); `documento` tem UPDATE para
   `authenticated` desde a 0005, então `.update({arquivo_path})` via PostgREST
   sempre foi possível. A 0014 é o primeiro guarda real, e é o diff certo para
   ele nascer, porque é o que abre a escrita da coluna. Forma (invoker,
   search_path, declarada no mapa de privilégios) idêntica à das triggers da
   0009/0010.

### Conferências pedidas
- `ehDocumentoHabil` com `arquivoPath`: 13 call sites, todos passam `Documento`
  real. O único parcial é o provisório de `pagamentosCandidatos` em
  `/adicionar/documento` (`arquivo ? "escolhido" : null`) — já era `""` antes;
  agora é honesto na única dimensão que importa (nulidade). Aceito.
- `PermissaoRelatorio` / `SaidaAnualDaObra`: precedência do transversal sobre
  `semArquivo` está certa e é consistente — `compromissosQueBloqueiam` também
  não recorta por ano. Combinar os dois vetos numa tela é melhoria de UX,
  não correção; fica para quando doer.
- `privilegios.spec.ts`: RPC `authenticated` bate com revoke/grant; trigger
  `PUBLIC,anon,authenticated` bate com o precedente das outras duas triggers.

### Ressalvas (não bloqueiam o commit; as 3 primeiras viram linha de dívida)
1. **`estadoExibido` não tem consumidor nenhum em `app/`** (`grep` confirma).
   O critério 5 diz "exibido por função pura única" — nenhuma tela exibe por
   ela; a tela do documento continua ramificando em `d.status` cru e a
   pendência vem de `faltaOArquivo`. Função de rótulo que ninguém lê é a D46
   esperando acontecer. **Apagar** (com os 4 testes) ou fazer os três `return`
   de `/documento/[id]/page.tsx` ramificarem por ela. Recomendo apagar.
2. **A dívida TS↔SQL ganhou ponto de divergência concreto**: a 0009
   (`mover_documento_de_obra`, recompute de `v_habeis`) copia
   `ehDocumentoHabil` SEM `arquivo_path is not null`; e `anexar_arquivo_documento`
   não recompõe `pagamento.status` dos vínculos já existentes (ficam
   `aguardando_nf` depois do anexo). Consequência limitada a `pagamento.status`,
   que nenhuma tela lê e `alocarCusto` não usa — mas registrar por nome, não
   como "a mesma dívida da 0009".
3. **Guarda 2 é vazia por ausência de calculador** (US-004). Hoje não há soma
   de "serviço PJ com retenção" para filtrar. Anotar no US-004 que a posição
   da aferição filtra por `ehDocumentoHabil`, nunca por `retencao11 === true`
   sozinho — senão o dia em que o calculador nascer é o dia em que a Guarda 2
   fura sem teste vermelho.
4. `app/documento/[id]/anexar/page.tsx:140` checa `d.arquivoPath !== null` à
   mão para o banner "já tem arquivo". Trocar por `!faltaOArquivo(d)` — é o
   único lugar fora de `lib/` que reimplementa o predicado.
5. Linha para a dívida 1: todo `CASE` futuro que grave em coluna enum com
   braços literais precisa de cast em pelo menos um braço — o plpgsql só
   resolve o corpo na primeira execução, e nem `db push` nem E2E que não
   passe por aquele braço acusam.

**Release**: `npx supabase db push` antes do `git push`, como o lead anotou.
A 0014 é aditiva (drop not null + trigger + função com revoke/grant).

## Veredito final — teste manual no browser (2026-09-20)

Ressalva 4 do Gate 2 **aplicada** (`app/documento/[id]/anexar/page.tsx:140`
agora usa `!faltaOArquivo(d)`).

O teste no browser (mesma disciplina do CONTAI-022: "teste automatizado prova
a regra que foi escrita para testar, não a que ninguém lembrou de escrever")
achou **três bugs** que os 639 unitários + 179 E2E do Gate 1/2 não pegaram —
detalhe completo em
`docs/backlog/33-2026-09-20-tres-bugs-achados-no-teste-manual-do-contai-033.md`:

1. **Confirmação mentia "Arquivo guardado no acervo"** ao salvar sem arquivo
   (`app/_components/registrado.tsx`, compartilhado com `/adicionar/pagamento`).
   Corrigido com a prop `arquivoNoAcervo` (default `true`).
2. **Home dizia "Nenhuma pendência"** com o card vermelho "Nota sem arquivo"
   na mesma tela — o banner só olhava `resumo.pendencias`, e
   `documentosSemArquivo` fica fora dela de propósito (crit. 11). Corrigido
   só para este campo; **D59** registra a auditoria que falta nos outros
   cinco agregados "fora de pendencias" que já existiam antes deste ticket.
3. **"Sem pagamento ligado" dizia "está em quarentena"** para uma nota que
   nunca esteve fora do CPF — `ehDocumentoHabil` ganhou um terceiro motivo
   (sem arquivo) e o texto só sabia escolher entre boleto e quarentena.
   Nova constante `VINCULO_SEM_ARQUIVO_NAO_GERA_CUSTO`
   (`lib/fiscal/vinculo.ts`) com precedência boleto → quarentena → sem
   arquivo.

**D58** registrado (não corrigido): o mesmo bug do item 1 existe em
`/adicionar/pagamento` desde o CONTAI-019/025 — pré-existente a este ticket,
fora de escopo, a prop já está pronta para quem for corrigi-lo.

Os três corrigidos ganharam trava de regressão em
`e2e/documento-sem-arquivo.spec.ts`. Depois dos três fixes: `npm run
typecheck`, `npm run lint`, `npm run test` (639/639) e `npm run test:e2e`
(180/180, incluindo a nova) rodaram limpos.

**Veredito: ENTREGUE.**
