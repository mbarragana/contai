# CONTAI-042 Pendências — página única para as 18 famílias (derivadas + persistentes)

## Tipo e Prioridade
feature — **P1, fiscal-adjacente, PRIMEIRO da sequência da rodada
desktop-shell**. Não cria obrigação fiscal nova (nenhuma pendência nova
nasce), mas fecha um risco real da Meta 1, e o `cto-obra` (avaliação técnica
de 2026-09-21) elevou a urgência do sequenciamento: hoje **18 famílias de
pendência** — não 7 — vivem espalhadas, a maioria só agregada na home.
Implementar o shell/dashboard (`CONTAI-040`) **antes** desta unificação
obrigaria o dashboard a nascer escondendo 11 das 18 famílias (ou a carregar
a fila inteira dentro do dashboard, que é o oposto do que a convergência do
`CONTAI-039` cortou) — exatamente a classe de erro **D46/D47** (pendência
perdendo superfície). Por isso este ticket vem **antes**, não depois, do
shell.

## Dor de Origem
`design/mocks/desktop-shell-v1.md`, seção "Pendências — superfície
própria": hoje `/pendencias` só cobre a pendência **persistente** (correção
de ano anterior, CNPJ errado — `app/pendencias/page.tsx`), nunca as
**derivadas**. Relacionado à **D59**
(`docs/backlog/33-2026-09-20-tres-bugs-achados-no-teste-manual-do-contai-
033.md`): o banner "Nenhuma pendência" da home hoje só olha
`resumo.pendencias`, ignorando os agregados "fora de pendencias" — sintoma
da mesma causa raiz (nenhum lugar enumera todas as famílias juntas).

**Achado do `cto-obra` (Gate 0/avaliação técnica, 2026-09-21)**: contagem
real em `app/page.tsx` são **18 famílias**, não as 7 de
`ResumoObra.pendencias[]` que o mock desenhava. As 11 adicionais, hoje só
agregadas na home:

`PendenciaCno` · `pendenciasDeCorrecao` (persistente,
`retificadora_possivel`) · `emitenteErrado` (persistente) ·
`vinculosCruzandoObras` · `terrenoPagoSemComprovante` ·
`documentosSemArquivo` · `terrenoSemData` · `terrenoMaisDeUmaData` ·
`financiamentoFaltaLancar` · `financiamentoAguardandoInforme` · e uma 18ª
família que o achado do `cto-obra` não nomeou — **o `lead-engineer` confirma
a lista completa e fechada por `grep` em `app/page.tsx` no Gate 1**, antes
de escrever `lib/fiscal/pendencias-unificadas.ts`; este ticket não fecha o
Gate 1 com uma lista "aproximada".

## User Story
Como dono da obra querendo saber **tudo** que está pendente nesta obra antes
de fechar a declaração, quero uma única página que liste as 18 famílias de
pendência — persistentes e derivadas —, agrupada por gravidade, sem nenhuma
escondida atrás de outra tela.

## Escopo e Critérios de Aceite

**✅ Entregue em 2026-09-21, 6/6 critérios + checklist do Gate Fiscal (9/9,
parecer §10).** Gate 2 com 1 rodada de REQUEST CHANGES do `cto-obra` (6
cards tinham sido copiados de `app/page.tsx` em vez de extraídos — corrigido
em `app/_components/pendencias-derivadas.tsx`, fonte única para home e
`/pendencias`); `contador` APPROVE de primeira, com decisão formal em
`docs/pareceres/2026-09-21-gate-fiscal-contai-042.md` (as 8 famílias de cor
literal não passam por `gravidadeDaRegua` — usá-la fabricaria fato fiscal).
859 unitários + 247 E2E + validação manual no browser com 3 famílias de
pendência simultâneas. Gate 4 (`po`) PASS. Sem migration. **Destrava o
CONTAI-040.**

### Decisão de escopo já fechada (pergunta 3 do `desktop-shell-v1.md`)
Registrada em `docs/backlog/46-2026-09-21-cinco-decisoes-desktop-shell-
contai-040-042.md` (e reconciliada com o achado do `cto-obra` no mesmo
arquivo): **sim, `/pendencias` absorve todas as derivadas.** Não é só
layout — é unificação de fonte de leitura. `notasSemPagamento` **fica de
fora** desta unificação: não é pendência (nenhuma consequência bloqueante,
é o terceiro estado neutro do parecer §5.2). Onde ela mora enquanto o
`CONTAI-041` (Despesas) não existe: **continua exatamente onde já está
hoje** (painel da home) — este ticket não precisa dar casa nova a ela, só
não pode confundi-la com pendência ao montar a lista unificada.

1. **`app/pendencias/page.tsx` de hoje** (UI atual, sem shell nenhum —
   o shell é o `CONTAI-040`, que vem depois) passa a renderizar as 18
   famílias, lidas por uma função pura nova, `lib/fiscal/pendencias-
   unificadas.ts` (nome do `cto-obra`), que recebe `ResumoObra` + o painel
   de pendências persistentes (`carregarPainelDePendencias`) e devolve uma
   lista única já ordenada por gravidade.
   - As duas famílias de `PendenciaPersistente` já cobertas hoje
     (`retificadora_possivel`, `emitente_errado`) mantêm toda a regra de
     baixa/histórico/desfecho — código existente reaproveitado, não
     reescrito.
   - `ResumoObra.pendencias[]` inteiro (as 7 famílias de `TipoPendencia`).
   - As demais famílias hoje "fora de pendencias" (a lista do achado do
     `cto-obra`, fechada por `grep` no Gate 1): `terrenoSemData`,
     `terrenoMaisDeUmaData`, `terrenoPagoSemComprovante`,
     `documentosSemArquivo`, `vinculosCruzandoObras`,
     `financiamentoFaltaLancar`, `financiamentoAguardandoInforme`,
     `PendenciaCno` e a(s) restante(s) até fechar 18.
   - `financiamentoAguardandoInforme` é aviso informativo, não pendência
     bloqueante — entra com tratamento visual próprio, nunca omitido, e
     **nunca** ganha cor da `gravidadeDaRegua` (ela não o produz hoje).
2. **Agrupamento por gravidade**: Vermelho primeiro, depois Âmbar, nunca
   misturados sem hierarquia. Sem paginação escondendo a mais grave.
3. Cada item ocupa a largura toda: chip + título + detalhe à esquerda,
   valor à direita (quando houver), botão de ação, e a `Consequencia`
   **sempre visível**, em linha própria abaixo, span da largura inteira —
   nunca truncada, mesma doutrina que o `CONTAI-041` (Despesas) vai seguir
   depois.
4. **A função `pendencias-unificadas.ts` exporta também a CONTAGEM total de
   abertas** — é este export, e nenhum outro, que o `CONTAI-040` consome
   depois para o badge da sidebar. Como este ticket roda **primeiro**, o
   `CONTAI-040` nasce já consumindo a fonte definitiva — não existe janela
   de contagem provisória divergente (o risco que existiria se a ordem
   fosse invertida).
5. Nenhuma pendência persistente muda de comportamento: baixa continua por
   acréscimo (nunca apaga, nunca edita), histórico continua visível, nada
   deste ticket toca `historico_de_correcoes` nem cria migration.
6. Pendências sem `href` de detalhe individual hoje (ex.:
   `documentosSemArquivo` com `quantidade > 1`, decisão do `po` de 19/09)
   mantêm esse comportamento — este ticket não reabre aquela decisão.

## Fora de Escopo
- Qualquer pendência nova, qualquer regra de cor nova, qualquer mudança na
  `gravidadeDaRegua` — puro reposicionamento/unificação de leitura.
- Reescrever texto de qualquer `Consequencia` — cópia literal do que já
  existe.
- O shell/sidebar (`CONTAI-040`) — este ticket entrega a lista unificada
  **dentro da UI atual** de `/pendencias`. O visual novo (shell, badge,
  agrupamento dentro do dashboard) é do `CONTAI-040`, que consome esta
  função depois.
- Corrigir o banner "Nenhuma pendência" da **home mobile** (D59) — fica
  fora, mas a função criada aqui é o insumo natural para esse conserto
  futuro.
- `notasSemPagamento` — não é pendência, fica fora; ganha superfície
  própria no `CONTAI-041`.

## Gate Fiscal (Contador)
**Obrigatório e bloqueante antes do Gate 1** — não é o sanity check
automático do resto da rodada. Motivo: a lista fechada por `grep` no Gate 1
precisa do `contador` confirmando, família a família, que (a) nenhuma
condição de abertura/fechamento muda ao migrar de tela, (b) nenhuma
pendência é contada duas vezes entre persistente e derivada (são
disjuntas por natureza — persistente é sobre correção de registro passado,
derivada é sobre estado atual — mas confirmação por leitura de código, não
suposição), e (c) `PendenciaCno` e as famílias que o `po` não tinha
mapeado antes deste achado carregam o texto de consequência certo, sem
reescrita.

## Pre-mortem
1. **Lista "quase 18" fechando o Gate 1**: se o `lead-engineer` implementar
   com a lista de 17 famílias nomeadas aqui e não confirmar a 18ª por
   `grep`, uma família fica de fora silenciosamente — o mesmo defeito que
   este ticket existe para consertar. Guarda: critério 1 e o Gate Fiscal
   exigem a lista fechada, não aproximada.
2. **`financiamentoAguardandoInforme` tratado como pendência bloqueante**
   quando é aviso informativo. Guarda: item 1 nomeia o tratamento visual
   próprio; contador confirma no Gate Fiscal.
3. **`vinculosCruzandoObras` sem valor próprio** (defeito de dado, não
   dispêndio) sendo somado num total agregado da página. Guarda: a página
   não soma valores de pendência nenhuma — mesma lição do
   `emPendenciaCentavos` morto no `CONTAI-005`.

## Dependências
- Bloqueado por: nenhum ticket — é o primeiro da sequência.
- Bloqueia: `CONTAI-040` (o badge/painel de pendências do shell consome a
  contagem e a lista que este ticket cria). Não bloqueia tecnicamente o
  `CONTAI-041`, mas a ordem de produto continua `042` → `040` → `041`.

## Cenário e checagem final
**Gestão** — em casa, sentado, revisando tudo que falta resolver antes da
declaração, ainda na tela `/pendencias` de hoje (sem shell). O "Teste do
Canteiro" não se aplica.
