# CONTAI-098 Reaproveitar comprovante entre pagamentos irmãos da mesma fatura (D56-b, ponta B)

## Tipo e Prioridade
feature — P1 — fricção de processo recorrente, com mitigação de risco de
acervo (meta 1) se o reaproveitamento errado for travado pela imutabilidade.
Materializa a ponta "retroativa" da dívida **D56-b**, generalizando
`ChipsDeAnexoExistente` (hoje restrito a anexos do MESMO documento) para uma
fonte nova: outros `pagamento`s da mesma fatura.

## Dor de Origem
`docs/backlog/110-2026-10-15-reaproveitar-comprovante-fatura-parcial.md`.
Mesmo caso real do CONTAI-097: fatura de cartão em 3 desembolsos parciais
gerou 7 `pagamento`s a favorecidos diferentes. `/pagamento/[id]/comprovante`
(CONTAI-061) hoje só oferece upload de arquivo NOVO — nenhuma tela de
anexo/confirmação do produto oferece "escolher anexo já existente" com fonte
"outro `pagamento`" (confirmado por leitura de código:
`app/(gestao)/pagamento/[id]/comprovante/page.tsx:355-362`). O Mateus subiu
manualmente o mesmo comprovante 4+ vezes na mesma sessão de conciliação.

**Resposta do Mateus, 2026-10-15 (fechada, não reabrir)**: quando há MAIS de
um `pagamento` irmão já com comprovante na mesma fatura (arquivos
DIFERENTES), a tela lista TODOS como chips para escolher — nunca assume "um
oficial".

## User Story
Como o Mateus, revisando em casa, sentado, um `pagamento` que ainda não tem
comprovante em `/pagamento/[id]/comprovante`, quando esse `pagamento`
pertence a uma fatura que já tem outro(s) `pagamento`(s) irmão(s) com
`comprovante_path` preenchido, quero escolher reaproveitar um desses
arquivos (ou, se preferir, subir um arquivo novo — sempre disponível), em
vez de ser obrigado a subir de novo um comprovante que já está no acervo,
para que confirmar uma fatura com N favorecidos não custe N uploads do
mesmo arquivo.

## Critérios de Aceite
1. [x] Dado o `pagamento` aberto em `/pagamento/[id]/comprovante` pertence a
   uma fatura (via `pagamento → compromisso_pagamento → compromisso →
   fatura_compromisso → fatura`) com ao menos um `pagamento` irmão já com
   `comprovante_path` preenchido, quando a tela carrega, então ela mostra um
   `Card` novo ("Ou reaproveite um comprovante já enviado nesta fatura") com
   um chip por `comprovante_path` DISTINTO entre os irmãos — generalização
   de `ChipsDeAnexoExistente`/`ChipDePapel`
   (`app/_components/corrigir.tsx:459-507`, 415-458) para a fonte nova
   "outros `pagamento`s da mesma fatura". Spec completo em
   `design/mocks/CONTAI-098.md`.
2. [x] Quando há DOIS OU MAIS arquivos distintos entre os irmãos: aparece
   **um chip por arquivo distinto** — nunca "o" comprovante oficial (resposta
   do Mateus, 2026-10-15, não reabrir).
3. [x] Cada chip mostra, no mínimo, o(s) favorecido(s) e valor(es) do(s)
   `pagamento`(s) de origem daquele `comprovante_path` — nunca só nome de
   arquivo (mitigação do pre-mortem 2: chip errado entre favorecidos
   parecidos, caso real de 3 lojas da mesma rede como favorecidos distintos
   na mesma fatura). Rótulo exato: "Usar o comprovante de {favorecidoNome}
   — {valor} (já enviado para outro pagamento desta fatura)", pluralizado
   quando há mais de uma origem para o mesmo arquivo.
4. [x] O chip "Vou anexar um arquivo novo." (`comArquivoNovo`, texto
   verbatim `CHIP_ARQUIVO_NOVO`) está **SEMPRE presente** ao lado de
   qualquer chip de reaproveitamento — nunca omitido, independente de N
   (1 ou mais arquivos distintos). **Correção explícita do `cto-obra`,
   ratificada pelo `po`, 2026-10-15**: "irmão" só é resolvível na
   granularidade de FATURA, nunca de desembolso individual (não existe
   coluna que persista qual desembolso gerou qual `pagamento`) — o único
   arquivo visível entre os irmãos pode vir de um desembolso diferente do
   que originou o `pagamento` em aberto, e não ser prova dele. Esconder o
   upload novo nesse caso trocaria uma fricção reversível por um erro
   irreversível (comprovante errado, travado por imutabilidade).
5. [x] `escolhido: PapelDoPacote | null` nasce **sempre `null`**, em
   qualquer contagem de irmãos (1 ou N) — nenhum chip vem pré-marcado, nunca
   pré-seleção automática. O botão de confirmar fica desabilitado até o
   clique explícito.
6. [x] Quando nenhum `pagamento` irmão da mesma fatura tem comprovante ainda
   (ou o `pagamento` em aberto não pertence a fatura nenhuma — PIX avulso a
   prestador): a tela comporta-se byte-a-byte como hoje (CONTAI-061) — só
   `CampoArquivo`, zero componente novo, zero regressão.
7. [x] Confirmar um chip de reaproveitamento grava, no `pagamento` atual, o
   MESMO `comprovante_path` do irmão escolhido — verificável por dois ou
   mais `pagamento`s da mesma fatura apontando ao idêntico
   `comprovante_path` no banco, sem gerar objeto novo no Storage.
8. [x] O trigger `pagamento_comprovante_path_imutavel` continua valendo: o
   reaproveitamento só é possível enquanto o `comprovante_path` do
   `pagamento` de destino está `null`; uma segunda tentativa (reaproveitar
   ou upload novo) sobre um `pagamento` que já tem comprovante falha
   explicitamente — idêntico ao que já vale hoje (CONTAI-061, critério 5).
9. [x] Nenhuma pergunta fiscal nova (CPF, retenção) em nenhum dos dois
   caminhos (upload ou reaproveitar) — mesma restrição do CONTAI-061.
10. [x] O delta "antes → depois" de custo confirmado (`anosAfetadosDeUmaObra`/
    `abrePendencia`, já existente na tela) é calculado para os DOIS
    caminhos pelo mesmo mecanismo: no caminho "novo", com o sentinel
    `CAMINHO_SIMULADO`; no caminho "existente", com o `comprovantePath` real
    da origem escolhida — nenhuma segunda função de cálculo.
11. [x] A gravação do reaproveitamento registra, na tabela `revisao`, o fato
    como DISTINTO de "upload novo direto": novo valor de `motivo_revisao`
    = `'comprovante_reaproveitado_de_irmao'` (diferente de
    `comprovante_chegou_depois`, já existente, CONTAI-061) — exigência
    fiscal, não cosmética (Gate Fiscal, item 4): sem essa marca, um exame
    futuro poderia contar o "comprovante provado" mais de uma vez pelo
    mesmo desembolso agregado.
12. [x] Migration nova e PRÓPRIA (anterior à que usa o valor, regra do
    Postgres já documentada no CONTAI-061) só com
    `alter type motivo_revisao add value 'comprovante_reaproveitado_de_irmao'`
    — sem `GRANT` (tipo não tem ACL de PostgREST).
13. [x] RPC nova `reaproveitar_comprovante_de_irmao(p_pagamento_id uuid,
    p_origem_pagamento_id uuid, p_anos jsonb) returns uuid` — NÃO estende
    `anexar_comprovante_pagamento` (que continua com zero diff): lê o
    `comprovante_path` da origem (nulo → exceção), valida que origem e
    destino compartilham uma `fatura` (proveniência — origem de outra
    fatura é recusada), grava só se o destino está `comprovante_path is
    null` (`for update`, mesma guarda dupla do CONTAI-061), insere em
    `revisao` com o motivo do critério 11, `security invoker`,
    `set search_path = public, pg_temp`, `revoke ... from public, anon`,
    `grant execute ... to authenticated`.
14. [x] `e2e/privilegios.spec.ts` ganha a entrada nova
    `reaproveitar_comprovante_de_irmao: "authenticated"` — tabela de
    privilégios fica vermelha com o nome da função se o `GRANT` faltar.
15. [x] Saídas fiscais não deduplicam: dado dois ou mais `pagamento`s
    compartilhando o mesmo `comprovante_path`, quando "Pagamentos
    Efetuados" ou a discriminação anual é gerada, cada `pagamento` continua
    linha própria com seu próprio valor digitado — nenhuma saída soma ou
    deduplica por anexo compartilhado. Base: `docs/tickets/CONTAI-027.md:
    404-427` §1 ("dupla contagem por anexo é impossível por construção") +
    ratificação explícita do `contador` neste Gate Fiscal para o caso "1
    anexo, N lançamentos" (ver Gate Fiscal abaixo) — já é o padrão em
    produção no caminho "fatura integral".
16. [x] Texto novo (rótulo do chip, dica do Card, botão de confirmar
    dinâmico, banner de sucesso "Comprovante reaproveitado ✓") é exatamente
    o fixado em `design/mocks/CONTAI-098.md`, seção "Textos de produto" —
    nenhuma variação redige "comprovante oficial" ou qualquer rótulo que
    sugira que um chip é a prova correta e os outros não (recusado
    explicitamente pelo `contador`).
17. [x] Vitest novo: `lib/fiscal/fatura.ts::comprovantesDosIrmaos` (função
    pura) — casos: sem fatura → `null`; 1 `comprovante_path`; N `paths`
    distintos; `pagamento` alvo excluído da própria lista; irmãos sem path
    ignorados.
18. [x] E2E novo (`e2e/pagamento-comprovante-tardio.spec.ts`, ampliado, ou
    arquivo próprio, contra o Postgres local): 1 arquivo distinto (chip +
    upload novo, ambos visíveis); 2+ arquivos distintos; `pagamento` avulso
    sem fatura (zero chip); `revisao.motivo` grava o valor novo; segunda
    chamada da RPC sobre destino já preenchido falha; origem de outra
    fatura é recusada pela RPC.

## Out of Scope
- **Campo de anexo na raiz** (`/fatura/[id]/parcial`→`/alocar`) — é o
  **CONTAI-097**, ticket irmão, sem dependência técnica entre os dois.
- **Generalizar `ChipsDeAnexoExistente` para QUALQUER anexo recente do
  acervo da obra** (não só da mesma fatura) — fora de escopo; dívida
  registrada, sem caso real que a peça hoje.
- **Excluir/desvincular um reaproveitamento feito por engano** — "excluir
  pagamento" já está fora do produto por desenho (CONTAI-009, acervo
  append-only); corrigir um vínculo errado exigiria CRC/retificadora, dívida
  já existente para qualquer correção pós-decadência-relevante.
- **Campo de valor por anexo / soma de comprovantes** — já derrubado pelo
  Gate Fiscal do CONTAI-027 §1; não reabrir.
- **Desambiguar dois irmãos com favorecido E valor idênticos** — caso não
  citado no relato de origem; fora de escopo desta rodada.
- **Verificar o exportador do CONTAI-011 contra comprovante compartilhado**
  — condição já existe desde o caminho "fatura integral"; correção (se
  necessária) é do CONTAI-011.

## Gate Fiscal (Contador)
**Fontes**: `docs/tickets/CONTAI-027.md:404-427` §1 (dupla contagem por
anexo impossível por construção); `docs/pareceres/2026-08-18-compromisso-
versus-pagamento.md` ADENDO 2 §1-§2 (quatro provas do comprovante no
caminho PF); `docs/tickets/CONTAI-061.md` (Gate Fiscal + Viabilidade,
mecanismo de rastro/`revisao`, trigger `pagamento_comprovante_path_
imutavel`).

**1. Toca regra fiscal — sim.** Documentação hábil (o que conta como
comprovante válido de desembolso) e relatórios anuais (como o anexo
compartilhado aparece em Pagamentos Efetuados/discriminação). Não toca
regime de caixa, retenção ou classificação material/serviço.

**2. Ratificação do critério 15 (saídas não deduplicam) — ratificado.**
**Se** o valor de um lançamento nunca é lido do anexo, mas digitado uma vez
por lançamento (`CONTAI-027.md:404-427` §1), **e** o `comprovante_path`
compartilhado prova apenas as quatro coisas do ADENDO 2 §2 (data do
desembolso, que o dinheiro saiu, que saiu da conta dele, quanto saiu **do
desembolso agregado** — nunca "quanto saiu para aquele favorecido
específico"), **então** nenhuma saída fiscal soma ou deduplica por anexo
compartilhado. **Não é caso fiscal novo** — já é o padrão em produção no
caminho "fatura integral" (as mesmas RPCs já copiam um único
`comprovante_path` para N `pagamento`s de favorecidos distintos); este
ticket só dá a esse padrão uma segunda porta de entrada (retroativa).

**3. Pergunta fiscal nova — nenhuma.** Nem o upload novo nem o
reaproveitamento perguntam CPF, retenção ou qualquer dado de documentação
hábil nova — mesma regra já fixada no CONTAI-061 para comprovante de
pagamento em geral.

**4. Rastro de revisão — exigência fiscal, não cosmética.** Reaproveitar um
`comprovante_path` existente num `pagamento` sem anexo é uma edição de
registro já gravado, do mesmo tipo que o CONTAI-061 resolveu para "anexo
chegou depois". **Se** a gravação do reaproveitamento não distinguir a
origem (motivo próprio), **então** um exame futuro (prazo do CTN art. 173,
I, que pode passar de 7 anos) poderia contar o valor "provado pelo
comprovante" mais de uma vez por desembolso agregado — o erro inverso do
que o §1 do CONTAI-027 protege. **Marcar**: motivo
`comprovante_reaproveitado_de_irmao`, distinto de `comprovante_chegou_
depois` (critério 11-13).

**5. Texto-base — autorizado por reaproveitamento, nenhuma frase nova do
Gate Fiscal.** Pode reaproveitar o texto de imutabilidade/"não pergunta
fiscal" do CONTAI-061 e a mecânica de chips do CONTAI-027/088 — mudando só
o rótulo de contexto. **Recusado explicitamente**: qualquer rótulo que
afirme um dos chips como "o comprovante oficial" ou equivalente — quando há
N arquivos distintos, nenhum tem precedência fiscal sobre os outros, e a UI
não pode insinuar que um é mais válido (critério 16).

**6. Automático × revisão humana.**
- **Automático**: ponta B quando há exatamente 1 arquivo distinto entre os
  irmãos — não há escolha real entre arquivos, é reaproveitar o único
  candidato, mas o CLIQUE de confirmar continua sendo humano (critério 4-5).
- **Exige decisão humana explícita, sem default, sem pré-seleção**: quando
  há N ≥ 2 arquivos distintos — o sistema não pode inferir qual comprovante
  corresponde ao `pagamento` em aberto (mesma proibição de "inferir vínculo
  por heurística" do §5 item 4 de `2026-08-18-compromisso-versus-
  pagamento.md`, por analogia direta).
- **Sempre humano**: o ato de gravar (upload ou reaproveitamento) continua
  sendo quem afirma o registro — nenhuma propagação grava sozinha fora de
  uma ação explícita.

## Pre-mortem
1. **Chip errado escolhido entre favorecidos parecidos.** A fatura real que
   originou este relato tem 3 lojas da mesma rede como favorecidos
   distintos. Sem o critério 3 (favorecido+valor visíveis no chip), dois
   comprovantes de valores próximos de lojas diferentes ficam
   indistinguíveis por nome de arquivo, e o Mateus liga o comprovante
   errado. Como o trigger de imutabilidade impede corrigir depois, o erro
   vira permanente no acervo que precisa sustentar até 2034 — só detectável
   em auditoria manual. Mitigado pelos critérios 3 e 5 (sem pré-seleção).
2. **"Irmão" só é resolvível por fatura, não por desembolso — o único
   arquivo visível pode não ser prova do pagamento em aberto.** Risco
   generalizado do risco 1: numa fatura com 2+ desembolsos, o arquivo do
   desembolso B pode aparecer como candidato ao `pagamento` do desembolso A.
   Mitigado pelo critério 4 (upload novo sempre visível, nunca
   reaproveitamento como única saída) — correção do `cto-obra`, ratificada
   pelo `po`.
3. **Export para o Google Drive (CONTAI-011) duplica o arquivo N vezes sem
   ninguém perceber.** Não é dívida nova deste ticket (a condição já existe
   desde o caminho integral) — registrado como pauta do CONTAI-011, fora de
   escopo aqui.

## Viabilidade (CTO)
- **Modelo de dados**: `0030_motivo_comprovante_reaproveitado.sql` (enum,
  sozinha) → `0031_reaproveitar_comprovante_de_irmao.sql` (RPC), nessa
  ordem. Nenhuma tabela/coluna/sequence/view nova → nenhum `GRANT` de
  tabela; `lib/database.types.ts` regenerado (enum). `anexar_comprovante_
  pagamento` (CONTAI-061) fica com **zero diff** — o reaproveitamento usa
  RPC própria porque o app nunca passa um path diretamente, passa a origem,
  e o banco lê o path dela (torna o rastro verificável por construção).
- **Fato de modelo que molda o desenho**: não existe `pagamento.fatura_
  desembolso_id` nem tabela que registre qual desembolso quitou qual
  compromisso — a única cadeia determinística é `pagamento →
  compromisso_pagamento → compromisso → fatura_compromisso → fatura`.
  "Irmão" é resolvível só na granularidade de FATURA, nunca de desembolso
  (daí o critério 4).
- **Arquivos**: `supabase/migrations/0030`, `0031`; `lib/database.types.ts`;
  `lib/data.ts` (`carregarIrmaosDeComprovante`, `reaproveitarComprovanteDe
  Irmao`); `lib/fiscal/fatura.ts` + `.test.ts` (`comprovantesDosIrmaos`);
  `app/_components/corrigir.tsx` (exportar `ChipDePapel`; mapa de rótulo do
  motivo ganha o valor novo); `app/_components/comprovante.tsx` (novo,
  `ChipsDeComprovanteIrmao`); `app/(gestao)/pagamento/[id]/comprovante/
  page.tsx` (carrega irmãos; `escolhido` sempre nasce `null`); `e2e/
  privilegios.spec.ts`; `e2e/pagamento-comprovante-tardio.spec.ts`.
- **Complexidade: M** (beirando L pelo volume de E2E) — migration de enum +
  RPC nova, função pura + testes, componente novo, tela com ramificação de
  fluxo, privilégios, E2E cobrindo 6 casos.
- **Dívidas novas**: (1) D56-b permanece parcialmente mitigada, não
  resolvida por completo — anexar tardiamente a um `fatura_desembolso` já
  criado continua sem RPC própria (registrada também no CONTAI-097); (2)
  sem link persistido `pagamento ↔ fatura_desembolso` — qualquer feature
  futura de "comprovante por desembolso específico" depende de criar essa
  coluna, hoje inexistente.

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: nenhum. **Sem dependência técnica com o CONTAI-097** — não
  compartilham código nem migration.

## Perguntas Abertas
Nenhuma — a discordância do `cto-obra` sobre "upload novo sempre visível"
foi resolvida pelo `po` em 2026-10-15 e já está incorporada nos critérios 4
e 7 (ver histórico desta sessão). Forma exata da consulta/join de
`carregarIrmaosDeComprovante` (view, RPC de leitura, ou `.select()` com
embeds encadeados) é decisão de implementação do Gate 1, não bloqueante —
o contrato de retorno (`ComprovanteIrmao[] | null`) já está fixado no spec.

## Cenário e checagem final
**Gestão** — anexar comprovante tardio a um pagamento já gravado é
conciliação posterior, em casa, sentado, mesmo cenário da tela-mãe
CONTAI-061. O "Teste do Canteiro" não se aplica.

Varredura de condição fiscal órfã (`grep -rniE` do `/tickets-req`): toda
condição fiscal citada acima está amarrada a `docs/tickets/CONTAI-027.md:
404-427` §1 e/ou `docs/pareceres/2026-08-18-compromisso-versus-
pagamento.md` ADENDO 2 — nenhuma condição nova sem parecer.

Veredito: **APROVADO**.

---

## Design (nível 2)
Spec completo em `design/mocks/CONTAI-098.md`. Delta sobre
`design/mocks/CONTAI-061.md` (que continua valendo por completo). Nível 2
escolhido e justificado por escrito no próprio spec: o mecanismo visual
(`ChipDePapel`/`ChipsDeAnexoExistente`, incluindo o padrão "chip de arquivo
novo sempre presente") já está em produção — o único elemento genuinamente
novo é o texto dentro do chip, que é conteúdo fechado por escrito. Cenário
gestão. Sem campo fiscal novo.
