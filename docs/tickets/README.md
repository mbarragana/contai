# Índice de tickets — por ordem de execução

## 🔎 O que está em aberto — 17 tickets (mais 1 parado, aguardando o Mateus)

*(2026-09-26: dois bugs relatados em produção logo após o `CONTAI-056`
viram `CONTAI-057` (legibilidade de Despesas, bloqueado por Gate 0) e
`CONTAI-058` (cache/revalidação do shell de gestão) — volta a 19.
`CONTAI-058` entregue no mesmo dia (Gate 4, 7/7 PASS) — volta a 18, com
`057` sozinho, bloqueado por Gate 0.
2026-09-23: `CONTAI-011` fatiado em três — `011` continua contando como 1
item, e `049`/`050` somam os 2 novos. `CONTAI-051` soma o 19º no mesmo dia;
`048` saiu da fila no fim do dia, entregue, voltando a 18; `051` saiu da fila
logo depois, entregue, voltando a 17 — **fila de implementação vazia**.
2026-09-24: `CONTAI-052` criado, já pronto para `/develop` — volta a 18, com
**1 item na fila de implementação**. 2026-09-25: `CONTAI-052` entregue
(Gate 4, 9/9 PASS) — volta a 17, **fila de implementação vazia de novo**.
2026-09-25, mais tarde: `CONTAI-053`/`054`/`055` criados a partir do relato
71 — volta a 20, **1 item pronto na fila** (`054`), `053` bloqueado por
Gate 0, `055` bloqueado pelos outros dois. 2026-09-25, mais tarde ainda:
`CONTAI-056` criado — **P0, bug fiscal**, achado por auditoria de código
(não relato) — volta a 21, **2 itens prontos na fila** (`056` primeiro, por
ser P0; `054` depois). 2026-09-25, ainda mais tarde: **`056` entregue**
(Gate 4, 8/8 PASS) — volta a 20, **1 item pronto na fila** (`054`).
2026-09-25, ainda mais tarde: **`054` entregue** (Gate 4, 6/6 PASS) — volta
a 19; `053` continua bloqueado por Gate 0, `055` agora só bloqueado por
`053`. 2026-09-25, ainda mais tarde: **`053` entregue** (Gate 4, 9/9 PASS)
— volta a 18; `055` fica sozinho na fila, sem bloqueio. 2026-09-25, ainda
mais tarde: **`055` entregue** (Gate 4, 5/5 PASS) — volta a 17, **fila de
implementação vazia** — fecha o backlog 71 inteiro (`053`+`054`+`055`).)*

**2026-09-26, mais tarde**: **`057` entregue** — Gate 4 (`po`), 9/9
critérios PASS. Coluna própria **"Custo confirmado"** (mono, semibold,
alinhada à direita, não sortável) entre "Valor lançado" (ex-"Valor", que
perdeu o semibold) e "Situação"; `custoComprovadoCentavos` é campo derivado
em `LinhaDeDespesa` (`lib/fiscal/despesas.ts`, soma de `comprovadoCentavos` +
`comprovadoPorRetencaoCentavos`, só no módulo puro), identificável no DOM por
`data-custo-comprovado`. Chip verde `CHIP_CUSTO_COMPROVADO` perdeu o valor
inline (o número já mora na coluna nova); chip de retenção manteve o dele.
Gate 2 técnico (`cto-obra`) aprovou direto, sem pedir mudança de mérito — só
uma nota cosmética não bloqueante (lista de colunas do
`desktop-shell-v1.md` ainda citava "Valor"), corrigida pelo coordenador
depois do APPROVE, sem mudar produto. Sem Gate Fiscal. `lib/fiscal/
vinculo.ts` intocado, nenhuma soma nova em tela. 1085 unitários + 317 E2E
verdes. **Fecha o backlog 72 (junto com o `058`) e a fila de implementação
volta a vazia.** Detalhe: `docs/tickets/CONTAI-057.md`.

**2026-09-26**: **`CONTAI-057`/`058` criados** — dois bugs que o Mateus
achou em produção, um dia depois do `CONTAI-056` ir ao ar (nenhum é erro de
cálculo fiscal; os dois são consequência de a retenção ter passado a contar
para o custo). `CONTAI-057` (P1): a coluna "Valor" de cada linha em
Despesas mostra só o pagamento em destaque, e a retenção some numa
anotação pequena — vira coluna própria "Custo comprovado". Bloqueado por
Gate 0 (`/design` nível 2). `CONTAI-058` (P1): `ProvedorDeGestao`
(`app/_components/gestao.tsx`) buscava os dados da obra uma vez só e
guardava em contexto compartilhado por toda a árvore `(gestao)/*`, sem
invalidar ao mutar em `documento/[id]/*` (e em qualquer outra rota do
grupo) — Home/Despesas ficavam com número velho até F5. **Entregue no
mesmo dia** (Gate 4, 7/7 PASS): `ProvedorDeGestao` passa a revalidar por
mudança de rota (`usePathname()`), com stale-while-revalidate (nunca some
o shell pra recarregar). 1085 unitários + 317 E2E verdes. Detalhe:
`docs/tickets/CONTAI-058.md`.

**2026-09-25, ainda mais tarde**: **`055` entregue** — Gate 4 (`po`), 5/5
critérios PASS. Último ticket do backlog 71 (retenção): a sugestão do
`CONTAI-054` (parser determinístico) passa a pré-preencher o primeiro
`FormularioDeLinha` do repeater do `CONTAI-053` quando o padrão bate, com o
rótulo sugerido em destaque visual (recomendação herdada do Gate 2 do
`054`) e sempre editável. Gate 2 técnico (`cto-obra`) achou um bug de borda
real: duas condições diferentes decidiam "campo vazio" (texto exibido vs.
valor em centavos), e um texto parcial como "1," fazia o valor herdar a
sugestão em silêncio enquanto a tela mostrava outra coisa — corrigido com
uma condição única, provado por E2E que atrasa a resposta da rota de
propósito. Gate 2 fiscal (`contador`) aprovou sem pendência. 1085
unitários + 313 E2E verdes, sem migration. **Fila de implementação volta a
vazia.** Detalhe: `docs/tickets/CONTAI-055.md`.

**2026-09-25, ainda mais tarde**: **`053` entregue** — Gate 4 (`po`), 9/9
critérios PASS. `FormularioDeLinha` (extraído de `app/_components/retencao.tsx`)
passou a aparecer também em `/adicionar/documento`, tela larga ≥880px,
quando o gate vira "destacada" — mesma validação e textos da gestão, sem
reimplementação paralela; linhas gravam em `documento_retencao` só depois
de `criarDocumento`, mesmo padrão não-transacional dos vínculos. Gate 2
técnico (`cto-obra`) pediu REQUEST CHANGES real: quarentena + falha de
gravação da retenção pulava a tela de confirmação sem mostrar o card
parcial — corrigido, com E2E novo provando as duas coisas juntas. Ajuste de
texto pós-Gate-2 (não lógico, registrado com transparência): concordância
verbal de `contagemDaRetencaoParcial` lia mal no caso `total=1`/`entraram=0`,
verbo movido para o início da frase. 1080 unitários + 307 E2E verdes, sem
migration. Detalhe: `docs/tickets/CONTAI-053.md`.

**2026-09-25, ainda mais tarde**: **`054` entregue** — Gate 4 (`po`), 6/6
critérios PASS. O Gate 1 inicial usou fixtures reconstruídas em vez de
medidas: o coordenador rodou `unpdf` de verdade contra as duas notas reais
do ticket e achou que rótulo e valor saem em linhas SEPARADAS adjacentes,
não na mesma linha como a implementação original assumia — a feature nunca
dispararia nas notas reais que a motivaram. Corrigido numa segunda rodada
(`lib/extracao/retencao-texto.ts` passou a cobrir os dois padrões), com duas
decisões técnicas novas aprovadas nos Gates 2 técnico e fiscal: filtro de
vocabulário "total"/"líquido" no rótulo da candidata removido (uma retenção
real se chama "Total das Retenções"), e combinações com líquido ≤ 0
descartadas (evita ambiguidade espúria com campos zerados da reforma
tributária). Recomendação não bloqueante herdada pelo `CONTAI-055`: o
`rotuloLiteral` sugerido precisa de destaque visual na confirmação. 1069
testes unitários + 300 E2E verdes, sem migration. Detalhe:
`docs/tickets/CONTAI-054.md`.

**2026-09-25, ainda mais tarde**: **`056` entregue** — Gate 4 (`po`), 8/8
critérios PASS. `alocarCusto` (`lib/fiscal/vinculo.ts`) passou a somar linha
de `documento_retencao` confirmada (`e_desconto_efetivo=true` +
`quem_recolhe ∈ {"empresa","nao_sei"}`) como perna de pagamento, com
data-efeito do pagamento vinculado mais antigo do mesmo documento — sem
migration. Gate 2 técnico (`cto-obra`) aprovou com uma pendência de borda não
bloqueante (**D77**, duas notas com retenção + pagamento compartilhado podem
sobrestimar custo — fixada por teste, fora de escopo). Gate 2 fiscal
(`contador`) pediu correção pontual de texto (bloco verde estava parafraseado
em vez de copiado do parecer) — corrigida antes do fechamento. Verificação
manual real no Gate 3: registrei uma nota de R$1.000,00 com retenção de
R$50,00 no stack local e confirmei visualmente a tela mudando de "Excedente —
nota ainda não paga" para "Custo comprovado: R$1.000,00" (o bruto). `afericao.ts`
(SERO) confirmado intocado. 1040 testes unitários + 300 E2E verdes. Detalhe:
`docs/tickets/CONTAI-056.md`.

**2026-09-25, mais tarde ainda**: **`056` criado** — bug **P0** fiscal.
`lib/fiscal/vinculo.ts` (`alocarCusto`) nunca soma uma linha de
`documento_retencao` confirmada (`e_desconto_efetivo=true`) como custo, então
uma nota com retenção legitimamente quitada mostra "Excedente — nota ainda
não paga" **para sempre**, mesmo com `quem_recolhe` resolvido e sem pendência
alguma aberta — subestimando o custo de aquisição na ficha Bens e Direitos, o
que infla o ganho de capital tributável na venda futura. Achado quando o
Mateus notou uma contradição entre o que o `contador` disse na sessão e o que
a tela de um documento real dele mostrava. Duas rodadas de Gate Fiscal
(ADENDO 2 + ADENDO 3 em
`docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`): a linha soma
como perna de pagamento só quando `quem_recolhe ∈ {"empresa", "nao_sei"}`
(nunca `"eu"`, que já usa uma guia real, mecanismo intocado); data-efeito é a
do pagamento vinculado mais antigo do documento, sem migration. `cto-obra`
confirmou que a aferição SERO (`afericao.ts`) não importa `vinculo.ts` e não
deve passar a importar. **Pronto para `/develop`**, sem Gate 0.

**2026-09-25, mais tarde**: **`053`/`054`/`055` criados** — relato do Mateus
durante uma dúvida fiscal sobre retenção destacada em NF de serviço PJ
(`docs/backlog/71-2026-09-25-retencao-na-captura-e-extracao-deterministica.md`).
`CONTAI-053` (P1): repeater de linha de retenção passa a aparecer também na
captura (`/adicionar/documento`, tela larga ≥880px), reusando o formulário
já validado da gestão em vez de reimplementar — achado do `cto-obra` no Gate
de viabilidade (o `BlocoRetencao` inteiro exige documento já persistido,
incompatível com a captura). **Bloqueado por Gate 0** (`/design`, nível 2).
`CONTAI-054` (P1): parser determinístico (sem IA) lê rótulo+valor da
retenção quando a nota tem campo estruturado e a aritmética
Total−Retenção=Líquido bate — nasceria como parte do 054 original, mas o
`cto-obra` fatiou porque a lib/rota é isolável e sem UI própria. **Pronto
para `/develop`**, sem bloqueio. `CONTAI-055` (P1): liga os dois — a
sugestão do `054` pré-preenche o repeater do `053`. **Bloqueado pelos dois**.
Gate Fiscal fechado nas três (`contador`): extração nunca decide o gate
`retencao_na_nota`, e os quatro campos de classificação fiscal
(`composicao`/`tributo`/`e_desconto_efetivo`/`quem_recolhe`) nunca vêm de
extração nenhuma, em nenhum ticket.

**2026-09-25**: **`052` entregue** — Gate 4 (`po`), 9/9 critérios PASS.
Estágio ortogonal de texto local (`unpdf`) → Groq (texto) → Gemini (visão,
caminho de hoje) em `lib/extracao/provider.ts`; retry/timeout extraído para
`lib/extracao/retry.ts`, fecha a **D70** (`AbortSignal.timeout()` por
tentativa + `maxDuration=60`). Gate 2 técnico (`cto-obra`) testou com `unpdf`
**real** e achou um bug bloqueante (`Buffer` rejeitado pelo PDF.js interno —
todo documento cairia em silêncio no Gemini) mais dois não pedidos
(`Number("")` virando um R$ 0,00 fiscal inventado; separador de milhar
pt-BR quebrando 1000x) — os três corrigidos antes de produção, reconfirmado
**APPROVE**. 90/90 testes em `lib/extracao`, suíte completa 1020 unitários +
296 E2E verdes, `npm run build` verde com `unpdf` em `dependencies`. Duas
dívidas nomeadas, não bloqueantes: **D71** (caminho Groq nunca testado
contra API real — falta a `GROQ_API_KEY` na Vercel) e **D72** (heurística de
"texto suficiente" calibrada só com fixtures sintéticas, sem scan real da
obra). **Fila de implementação volta a vazia.** Detalhe:
`docs/backlog/69-2026-09-25-contai-052-entregue.md`.

**2026-09-24**: **`052` criado** — extração de texto embutido do PDF
localmente (sem API) antes de qualquer IA de visão; quando suficiente, manda
o texto para a **Groq** (cota separada da do Gemini, tira essa fatia de
documentos do caminho que está no limite de 5 req/min); quando insuficiente
(scan/foto), cai no caminho de hoje (Gemini + retry, `4f8a1c6`). Motivado
pelo incidente do dia (`docs/backlog/67-2026-09-24-incidente-extracao-
gemini.md`). Decisões técnicas fechadas pelo `cto-obra` antes do Gate 1
(biblioteca `unpdf`, estágio ortogonal em `provider.ts`, heurística de 3
testes + verificação campo-contra-fonte, retry/timeout reaproveitado —
fecha a **dívida D70**), sanity check do `contador` **APROVADO** sem parecer
formal, sem `/design` (zero mudança de UX), sem migration. **P1**, pronto
para `/develop`. Detalhe:
`docs/backlog/68-2026-09-24-decisoes-tecnicas-contai-052.md`.

**2026-09-23, mais tarde ainda**: **`051` saiu da fila** — implementado
(`lead-engineer`), revisado pelo Gate 2 técnico (`cto-obra`, 1 rodada de
REQUEST CHANGES por um erro factual no docblock — dizia que 640px era "a
largura do destino do clique", mas o clique vai para `/`, full-width, não
para `/obras/[id]`; corrigido só o comentário, reconfirmado **APPROVE**),
Gate Fiscal não se aplica (reflow puro), testado (940 unitários + 296 E2E
verdes, incluindo os 3 testes novos: desktop populado, desktop vazio, piso
375px, mais validação manual no navegador confirmando 640px em 1440px e
zero scroll horizontal em ~490px) e validado pelo `po` (Gate 4 PASS, 6/6
critérios). `ColunaDeEscolha` local em `obras/page.tsx` envolve os 4
estados em `max-w-[640px]` (mesma medida de `ColunaDeDetalhe`, reaproveitada
como número); os dois `max-w-[430px]` soltos saíram. `ListaDeEscolha`
(`app/_components/obra.tsx`) intocada. Sem migration. **Fecha a fila de
implementação — nenhum item restante nela.** Detalhe:
`docs/backlog/66-2026-09-23-contai-051-entregue.md`.

**2026-09-23, fim do dia**: **`048` saiu da fila** — implementado
(`lead-engineer`, com um ajuste de limpeza depois: removeu ramo morto,
apertou o tipo de `url` no Lightbox de `string | null` para `string`,
corrigiu timeout de 2 testes E2E que flakeavam por compilação a fria),
revisado pelo Gate 2 técnico (`cto-obra` APPROVE) e fiscal (`contador`
APROVADO, sanity check: preview não interfere em `notaNoCpf`/`retencao_na_nota`
/`cnoNaNota`, nenhum arquivo de `lib/fiscal/*` tocado), ambos reconfirmados por
escrito depois do ajuste, testado (940 unitários + 9/9 E2E novos verdes + Gate
3 com validação manual no navegador usando arquivos reais imagem/PDF) e
validado pelo `po` (Gate 4 PASS, 5/5 critérios). `app/_components/anexo-
preview.tsx` (Lightbox sob demanda) + `lib/preview-anexo.ts` implementam o
mock: miniatura 120px inline para imagem, ícone para PDF/XML, botão "Ver
documento" abrindo modal com zoom (imagem) ou `<object>` (PDF, telas largas);
em tela estreita (<880px) o PDF vira link `<a target="_blank">` para o blob em
vez de embutir, correção do `cto-obra` para não degradar em silêncio no Safari
iOS. Sem migration. **Dívida nomeada D69**: validação manual em iPhone real
(Safari) + macOS Safari, com PDF real de ≥2 páginas, continua pendente — nem
CI (webkit do Playwright roda em Linux, sem viewer de PDF) nem o Gate 3 (Chrome
desktop) provam o comportamento nativo do Safari iOS, que é exatamente o que o
critério 3 deste ticket existe para corrigir. Fechado como DONE apesar disso
(ver justificativa em `docs/tickets/CONTAI-048.md`, critério 3), não como
"tudo pronto". Detalhe: `docs/backlog/65-2026-09-23-contai-048-entregue.md`.

**2026-09-23**: **`051` criado** — o coordenador auditou quais rotas já
foram adaptadas para o shell desktop e achou uma lacuna: `app/(gestao)/
obras/page.tsx` (a tela "Trocar obra") nunca entrou em nenhum dos tickets
`040`/`043`-`046`/`047`. Sem `ColunaDeDetalhe`/`CabecalhoDaTela`, sem teto
de largura na `ListaDeEscolha`, e dois `max-w-[430px]` soltos nos botões de
ação — a mesma inconsistência (lista esticada + botão apertado) que
motivou a rejeição do Conceito 1 do `CONTAI-039`. **`CONTAI-051`** (P1,
reflow de layout puro, zero mudança de campo/lógica/texto fiscal — mesma
disciplina dos `043`-`046`). **Gate 0 fechado por reaproveitamento**: não é
detalhe de um registro (é lista de nível superior, irmã de `/despesas` e
`/pendencias`), então `ColunaDeDetalhe`/`CabecalhoDaTela` não se aplicam;
a única variável de desenho (largura do envoltório da lista, sugestão de
partida 640px) fica para o `cto-obra` fechar no próprio Gate 1, sem
precisar de novo mock do `designer`. **Pronto para `/develop`**, sem
dependência. Detalhe: `docs/tickets/CONTAI-051.md`.

**2026-09-23**: **`047` saiu da fila** — implementado (`lead-engineer`),
revisado pelo Gate 2 (`cto-obra` APPROVE e `contador` APROVADO, os dois
reconfirmados por escrito depois de um commit de acabamento com 5
pendências; `contador` comparou byte a byte `lib/fiscal/documento.ts` e as
3 telas, nenhuma mudança de texto fiscal), testado (933 unitários + 284 E2E
verdes, suíte rodada 2x, mais validação manual no navegador confirmando
takeover de tela cheia, rail espelhando o formulário, colapso no piso de
375px e saída limpa ao shell) e validado pelo `po` (Gate 4 PASS, 11/11
critérios). `app/(captura)/layout.tsx` ganhou o segundo teto
(`larga:max-w-[940px]`, 880px); `documento/page.tsx` ganhou o rail (anexo +
extração + resumo somente-leitura); os três formulários ganharam
`CamposCurtos` para escalares, com pergunta fiscal preservada em coluna
única. Quatro divergências do mock/critério literal, julgadas no Gate 2 e
registradas no ticket como decisões (não pendência): grid nova no hub,
resumo do rail oculto (não visível) abaixo do piso, stepper decorativo
coexistindo com o "Passo X de Y" antigo, e um ajuste de formatação no
`.md` do spec. Sem migration. Detalhe:
`docs/backlog/60-2026-09-23-contai-047-entregue.md`.

**2026-09-22**: **`047` e `048` criados** — o Mateus respondeu a pergunta 2
de `docs/backlog/45-2026-09-21-cenario-desktop-first-contai-039.md`: a
permissão de tela larga vale também para as telas de captura (`/adicionar/*`
— hoje intocadas, mesmo depois de toda a rodada `040`/`043`-`046`), não só
para gestão. `po` consultou o `cto-obra` antes de escopar: **rejeitada** a
ideia de mover essas rotas para `(gestao)` (traria chrome de gestão para
dentro do canteiro e duplicaria "obra ativa"); recomendada casca larga
própria dentro de `(captura)` (~720px, campos escalares em grid, bloco de
pergunta fiscal em coluna única — mesma lição do Gate 2 do `039`). Vira
**`CONTAI-047`** (P1, reflow de layout puro, zero mudança de campo/
validação/texto fiscal — mesma disciplina dos `043`-`046`; bloqueado por
Gate 0 do `designer`, com contingência de fatiar se `documento/page.tsx`
ficar grande demais). Achado à parte do `cto-obra`, promovido a ticket
próprio: **`CONTAI-048`** (anexo do documento visível ao lado do formulário
em tela larga — feature nova, não casca; P1 mas **não bloqueante**, sem mock
ainda, fica fora da fila ativa até o `designer` desenhar). Nenhuma migration.
Decisão completa: `docs/backlog/58-2026-09-22-captura-tela-larga-
contai-047-048.md`.

**2026-09-22**: **Gate 0 do `047` fechado** — o `designer` publicou
`design/mocks/captura-no-desktop-v1.md`/`.html` em paralelo, e o `po`
reconciliou os dois documentos. O rail do mock (miniatura 52×52 do anexo +
botão de extração reposicionado + resumo somente-leitura do já digitado)
entra no escopo do `047` (critério 1a) por ser reflow, não feature — o
`CONTAI-048` (render legível do documento, para conferir CNPJ/valor/data)
continua **sem Gate 0**, fronteira escrita nos dois tickets. Takeover de
tela cheia ao clicar "+ Novo registro" confirmado com o `cto-obra`:
navegação normal entre `(gestao)`/`(captura)` (layouts irmãos do Next),
zero código novo — a exclusão de "modo captura" no `ShellDeGestao`
permanece. Breakpoint do grupo sobe de 720px (sugestão original, sem rail)
para **~900px** (com rail, número do mock). Nova dívida nomeada **D68**
(inconsistência pré-existente "Passo 2 de 3"/"Passo 3 de 3" em
`documento/page.tsx`, sem ticket). **`CONTAI-047` está pronto para
`/develop`** — nenhum ticket na fila ativa está mais bloqueado por Gate 0.
Decisão completa: `docs/backlog/59-2026-09-22-decisao-po-mock-captura-
desktop.md`.

**2026-09-21**: **`043`, `044`, `045`, `046` criados** — o `po` fatiou por
família a dívida que o próprio `app/(captura)/layout.tsx` nomeia desde a
entrega do `040` ("as telas de detalhe entram no shell numa rodada
futura"): `043` Documento, `044` Pagamento+Fatura, `045` Compromisso+
Pendências, `046` Obras+Terreno — todos **P1**, todos bloqueados por **Gate
0** (spec "detalhe dentro do shell", em desenho paralelo pelo `designer`;
ainda não publicado em `design/mocks/`). Ordem sugerida **`043` → `044` →
`045` → `046`**, sem bloqueio formal entre eles. Formaliza pela primeira vez
em ticket o achado do `cto-obra` (Gate 2 do `039`): telas de detalhe usam
coluna ~560px, não full-width. `/entrar` e `/obras/nova` ficam fora em
definitivo; `/conta` fica fora desta rodada. Decisão completa:
`docs/backlog/50-2026-09-21-migracao-detalhe-para-shell.md`. **Gate 0
fechado no mesmo dia**: `design/mocks/detalhe-no-shell-v1.md`/`.html`
(coluna final **640px**, não 560px). Os quatro entram na fila, ordem
`043` → `044` → `045` → `046`.

**2026-09-21**: **`043`** saiu da fila — implementado (`lead-engineer`),
revisado pelo Gate 2 (`cto-obra` + `contador`, ambos APPROVE sem
retrabalho), testado (881 unitários + 249/250 E2E — 1 falha pré-existente
e não-relacionada, `discriminacao.spec.ts:215`, confirmada por raio de
explosão — mais validação manual no browser) e validado pelo `po` (Gate 4
PASS, 5/5 critérios). As 10 rotas de `/documento/[id]` migraram para
dentro do shell: coluna de 640px, breadcrumb no topbar, rodapé sticky só
em formulários. Achado operacional do `cto-obra`: dois agentes rodando
E2E ao mesmo tempo corrompem o Postgres local compartilhado. Sem
migration. **Destrava, na ordem sugerida, o `044`.** Detalhe:
`docs/backlog/51-2026-09-21-contai-043-entregue.md`.

**2026-09-21**: **`044`** saiu da fila — implementado (`lead-engineer`, em
**Sonnet** por instabilidade momentânea do Opus — 4 falhas de API seguidas,
`cto-obra` confirmou que isso não muda o contrato de revisão), revisado
pelo Gate 2 (`cto-obra` + `contador`, ambos APPROVE sem retrabalho),
testado (883 unitários + 252/253 E2E — mesma falha pré-existente do `043`
— mais validação manual no browser) e validado pelo `po` (Gate 4 PASS, 5/5
critérios). `pagamento/[id]` e `fatura/[id]` (+ subrotas) migraram para o
shell, mesma casca do `043`. `fatura/[id]/alocar` resolvido sem exceção de
largura (lista, não tabela densa). Sem migration. **Destrava o `045`.**
Detalhe: `docs/backlog/52-2026-09-21-contai-044-entregue.md`.

**2026-09-21**: **`045`** saiu da fila — implementado (`lead-engineer`,
Opus), revisado pelo Gate 2 (`cto-obra` + `contador`, ambos APPROVE sem
retrabalho — o `contador` conferiu com os próprios olhos que a D65
(`cValor` sem default, CONTAI-034) sobrevive à migração de casca), testado
(887 unitários + 256/257 E2E — mesma falha pré-existente — mais validação
manual no browser) e validado pelo `po` (Gate 4 PASS, 6/6 critérios).
`compromisso`/`[id]` (+ `cancelar`, `confirmar`, `data`) e
`pendencias/[id]` migraram para o shell, coluna 640px. Sem migration.
Dívida nova: duplicação `TresRespostas`+ações de página no agendamento
vencido. **Último ticket antes do `046`.** Detalhe:
`docs/backlog/53-2026-09-21-contai-045-entregue.md`.

**2026-09-22**: **`046`** saiu da fila — implementado (`lead-engineer`,
Opus), revisado pelo Gate 2 (`contador` APPROVE de primeira; `cto-obra`
REQUEST CHANGES numa rodada — corrigiu de vez um teste flaky de fuso
horário em `discriminacao.spec.ts` que existia desde 2026-09-20 e sempre
tinha sido descartado como "pré-existente" nos tickets anteriores; provado
com `TZ=Pacific/Midway` dentro da janela exata do bug), testado (890
unitários + **265/265 E2E, sem nenhuma falha conhecida** — primeira vez na
sessão — mais validação manual extensa no browser) e validado pelo `po`
(Gate 4 PASS, 6/6 critérios). `obras/[id]`, `terreno/*`,
`discriminacao/[ano]` e `notas-sem-cno` migraram para o shell, coluna
640px (discriminação sem exceção de largura). Sem migration. **Fecha os
quatro tickets da migração (`043`→`044`→`045`→`046`)** — resta só o `041`
(despesas) na rodada "desktop shell". Detalhe:
`docs/backlog/54-2026-09-22-contai-046-entregue.md`.

**2026-09-22**: **`041`** saiu da fila — implementado (`lead-engineer`),
revisado pelo Gate 2 (`contador` APPROVE de primeira, confirmando com os
próprios olhos que nenhum centavo é contado duas vezes; `cto-obra` REQUEST
CHANGES numa rodada — documento sem valor lançado virava "R$ 0,00" em vez
de "—", corrigido e confirmado), testado (925 unitários + 273 E2E +
validação manual extensa no browser) e validado pelo `po` (Gate 4 PASS,
11/11 critérios). `lib/fiscal/despesas.ts` (`linhasDeDespesa`) projeta
`Documento`/`Pagamento` linha a linha, com 8 cenários de teste garantindo
zero duplicação de valor. Sem migration. **Fecha a rodada "desktop
shell" inteira** (`042` → `040` → `043`→`044`→`045`→`046` → `041`).
Detalhe: `docs/backlog/55-2026-09-22-contai-041-entregue.md`.

**2026-09-21**: **`040`, `041`, `042` entram na fila** — o Mateus rejeitou o
layout do `CONTAI-039` ("ficou horrível... quero uma experiência de
desktop") e aprovou o mock de substituição, `design/mocks/desktop-shell-
v1.html`/`.md` ("100% better"). O `po` fechou as 5 perguntas abertas do spec
e quebrou o trabalho em três tickets. **Reconciliado no mesmo dia** com a
avaliação técnica paralela do `cto-obra`
(`docs/backlog/46-2026-09-21-cinco-decisoes-desktop-shell-contai-040-042.md`,
seção "Adendo"): a contagem real de famílias de pendência em `app/page.tsx`
é **18, não 7** — implementar o shell antes da unificação faria o dashboard
nascer escondendo 11 delas (classe **D46/D47**, pendência perdendo
superfície). **Ordem final: `042` → `040` → `041`.**
**`042`** (unificação de pendências derivadas+persistentes nas 18 famílias,
ainda na UI atual de `/pendencias`, sem shell — **P1 fiscal-adjacente**, Gate
Fiscal do `contador` obrigatório e bloqueante, sem dependência — pronto para
`/develop`). **`040`** (shell de navegação + dashboard "Visão geral" via
route groups Next 16 `(gestao)`/`(captura)` — decisão do `cto-obra`, não
breakpoint/media query —, com faixa mínima de navegação mobile para não
perder a porta do canteiro para `/adicionar`; **P1**, bloqueado pelo `042`).
**`041`** (tabela de Despesas em `/despesas`, com achado técnico de que
`resumo.despesas` é por componente e não por pagamento — precisa de
projeção nova `linhasDeDespesa`; **P1**, bloqueado pelo `040`). Design já
escrito (política vigente desde 2026-09-20: descrição escrita, sem HTML nem
gate de aprovação) — os três nascem sem dependência de mock pendente.

**2026-09-21**: **`042`** saiu da fila — implementado (`lead-engineer`),
revisado pelo Gate 2 (`contador` APPROVE de primeira, com parecer formal
sobre as 8 famílias de cor literal que não podem passar por
`gravidadeDaRegua`; `cto-obra` REQUEST CHANGES numa rodada — 6 cards
tinham sido copiados de `app/page.tsx` em vez de extraídos, corrigido em
`app/_components/pendencias-derivadas.tsx`, fonte única para home e
`/pendencias`), testado (859 unitários + 247 E2E + validação manual no
browser com 3 famílias de pendência simultâneas) e validado pelo `po`
(Gate 4 PASS, 6/6 critérios + 9/9 do checklist fiscal). Sem migration.
**Destrava o `040`.** Detalhe:
`docs/backlog/47-2026-09-21-contai-042-entregue.md`.

**2026-09-21**: **`040`** saiu da fila — implementado (`lead-engineer`),
revisado pelo Gate 2 (`cto-obra` + `po` + `contador` em paralelo, todos
APPROVE; 1 rodada de rework — `OPCOES_DE_REGISTRO` duplicada, extraída
para `lib/gestao/navegacao.ts` com teste-trava verbatim contra
`/adicionar/page.tsx`), testado (877 unitários + 248 E2E + validação
manual extensa no browser) e validado pelo `po` (Gate 4 PASS, 13/13
critérios). Route groups Next 16 — `(gestao)` com shell novo (sidebar,
dashboard "Visão geral"), `(captura)` intocado. `Secao`/`Faixa`/`largo`/
`alinharComFila`/`data-largo` do `039` apagados (órfãos). Sem migration.
**Destrava o `041`.** Detalhe:
`docs/backlog/49-2026-09-21-contai-040-entregue.md`.

**2026-09-21**: **`039`** entrou e saiu da fila no mesmo dia — layout desktop
da home, convergência entre `designer`, `cto-obra` e `po`
(`docs/backlog/43-2026-09-21-convergencia-home-desktop.md`), Conceito 2
("Régua fixa + fila de trabalho"), sanity check do `contador` antes do Gate
1 (sem regra fiscal nova). Implementado (`lead-engineer`), Gate 2 com 1
rodada de REQUEST CHANGES do `cto-obra` (aside sticky escondia
`CardAfericaoInss` — corrigido com scroll próprio; `lg:max-w`/`BarraAdicionar`
viraram opt-in por página em vez de globais, eliminando o efeito colateral
nas outras 43 telas sem precisar de dívida — a **D67** cogitada pelo `po`
nunca chegou a ser registrada). Testado (839 unitários + 242 E2E + validação
manual no browser em 1280px) e validado pelo `po` (Gate 4 PASS, 12/12
critérios). Sem migration. Detalhe:
`docs/backlog/44-2026-09-21-contai-039-entregue.md`.

*Uma linha por ticket, sem justificativa. O **porquê** de cada posição está nas
seções longas abaixo; o **porquê da decisão** está em `../backlog.md`.
Atualizado em 2026-08-24 — `004` e `036` saíram da fila (entregues e
commitados); `027` saiu de "esperando commit" (commitado em 21/08, hash
`53acc37`). Alinhamento completo da fila no mesmo dia: `032`, `022`, `033`,
`031`, `035` ganharam ticket + mock (quando aplicável); `007`, `008`, `005`
tiveram mock desenhado e aprovado. `009` **saiu da fila** — reconciliação de
24/08 achou que ele já foi entregue via `CONTAI-018`, sem citação cruzada
(`docs/backlog/29-2026-08-24-reconciliacao-contai-009.md`); o único resto vivo
virou o `037` (XS, P1), ticket + mock escritos e aprovados no mesmo dia.

**2026-09-19**: entrou **`038`** (retenção variável em NF de serviço PJ, P0
fiscal), sequenciado logo depois de `035` por dependência técnica — precisa de
`lib/fiscal/gravidade.ts` (criado pelo `035`) para nascer sem cor literal
chutada. `035` perdeu o item F de escopo no mesmo dia (premissa fiscal
substituída pelo parecer que originou o `038` — não é mudança de
comportamento, é remoção). Decisão completa:
`docs/backlog/31-2026-09-19-sequenciamento-contai-035-038.md`.
**`038` ainda não está pronto para `/develop`**: falta rodar `/design` (mock
nível 1, repeater inédito). Os outros 9 itens da fila continuam prontos.

**2026-09-19**: **`032`** e **`022`** saíram da fila — implementados, testados
(617 unitários + E2E) e commitados (`13953f2`). Ver "Em produção" abaixo.

**2026-09-20**: **`033`** saiu da fila — implementado (`lead-engineer`),
revisado (`cto-obra`, APROVADO COM RESSALVAS não bloqueantes) e testado no
browser (639 unitários + 180 E2E, incluindo 3 bugs achados no teste manual e
corrigidos na hora — `docs/backlog/33-2026-09-20-tres-bugs-achados-no-teste-manual-do-contai-033.md`).
Commitado (`3c3f4de`). Ver "Veredito final" no corpo de `docs/tickets/CONTAI-033.md`.

**2026-09-20**: **`007`** saiu da fila — implementado (`lead-engineer`),
revisado duas vezes pelo Gate 2 (`cto-obra` + `contador`; a primeira rodada
voltou REQUEST CHANGES do `contador` por um erro fiscal real no critério 7 —
ver `docs/pareceres/2026-09-20-cno-nao-bloqueia-correcao-de-obra.md` — corrigido
e reconfirmado na segunda), testado (669 unitários + 195 E2E + validação manual
no browser: registro de NF de serviço com CNO desta obra/de outra obra/sem CNO,
tela de correção de obra, `/obras/[id]/notas-sem-cno`) e validado pelo `po`
(Gate 4 PASS). **Mudança de processo no mesmo dia**: o `/design` deixou de
exigir HTML e aprovação explícita — ver "Premissas de processo" no
`CLAUDE.md`.

**2026-09-20**: **`008`** saiu da fila — implementado (`lead-engineer`),
revisado pelo Gate 2 (`cto-obra` + `contador`, ambos APPROVE sem retrabalho —
a leitura fiscal já vinha corrigida pelo Gate 2 do `007` no mesmo dia),
testado (687 unitários + 202 E2E + validação manual no browser: duas obras
com CNO diferentes, NF de serviço + PIX vinculados, move do pagamento com a
nota "vai junto" mostrando o aviso e preservando o vínculo) e validado pelo
`po` (Gate 4 PASS). `app/_components/corrigir-obra.tsx` (órfão desde o `007`)
apagado. Dívida nova: **D60** (histórico de correção de pagamento invisível
em `/pagamento/[id]`, `docs/backlog/34-2026-09-20-contai-008-entregue.md`).

**2026-09-20**: **`005`** saiu da fila — implementado (`lead-engineer`),
revisado pelo Gate 2 (`cto-obra` APPROVE; `contador` REQUEST CHANGES na
primeira rodada, respondendo duas lacunas fiscais que o mock de 16/08 não
previa — "pago sem comprovante" vira 3ª parcela do headline, `nf_servico_sem_cno`
entra na base de exposição do INSS deduplicada por documento — parecer
`docs/pareceres/2026-09-20-gate-fiscal-contai-005-rodada-2.md`, ambos APPROVE
na segunda rodada), testado (712 unitários + 201/202 E2E — a falha restante é
um teste flaky de fuso horário, não fiscal, `docs/backlog/35-...md` — validação
manual no browser confirmando a decomposição de 3 parcelas) e validado pelo
`po` (FAIL na 1ª rodada por falta de parecer transcrito, PASS após o contador
escrever o parecer formal). Dívida nova: **D61** (`terrenoPagoSemComprovante`
fora do headline por corte de escopo herdado, mesma moeda fiscal — precisa de
decisão de arquitetura do `cto-obra`, `docs/backlog/36-2026-09-20-contai-005-entregue.md`).

**2026-09-20**: **`031`** saiu da fila — implementado (`lead-engineer`), sem
UI nova nem regra fiscal nova (cobertura de teste para a condição 6, já
adjudicada). Revisado pelo Gate 2 (`cto-obra` APPROVE, com um ajuste
cosmético de âncora por conteúdo já aplicado), testado (17/17 em
`e2e/correcao.spec.ts`; suíte completa 202/203, a única falha é a mesma
pré-existente e não-fiscal já documentada) e validado no browser (correção
de classificação real, material → mão de obra, custo não muda) e pelo `po`
(Gate 4 PASS).

**2026-09-20**: **`035`** saiu da fila — implementado (`lead-engineer`),
revisado pelo Gate 2 (`cto-obra` + `contador`, ambos APPROVE — item C tinha
9 sites, não 7 como o inventário original media, extensão confirmada
técnica e fiscalmente), testado (742 unitários + 203/204 E2E — falha
restante é a mesma pré-existente e não-fiscal já documentada — validação
manual no browser confirmando o item D vermelho + aviso condicional de
retificadora) e validado pelo `po` (Gate 4 PASS). `lib/fiscal/gravidade.ts`
criado — **destrava o `038`** (falta só `/design`, sem HTML nem aprovação
pela política atual).

**2026-09-21**: **`038`** saiu da fila — `/design` rodado (3 perguntas abertas
fechadas antes do Gate 1: correção de linha = remover+recriar com DELETE
concedido em `documento_retencao`, decisão de arquitetura do `cto-obra`;
pendência nova fora de `pagoSemComprovanteCentavos`; correção do gate vira
dívida D62). Implementado (`lead-engineer`), Gate 2 com uma rodada de
REQUEST CHANGES do `contador` (texto citava premissa morta "retenção de
11%", corrigido) e ajustes cosméticos do `cto-obra`, ambos APPROVE na
segunda rodada. Testado (791 unitários + 217/217 E2E + validação manual no
browser: gate de captura sem repeater, repeater completo com cascata,
pendência vermelha nascendo e aparecendo na home). Validado pelo `po` (Gate
4 PASS). Commitado (`6dd771e`). Dívidas novas: **D62**, **D63**
(`docs/backlog/38-2026-09-21-contai-038-entregue.md`).

**2026-09-21**: **release liberado** — critério 18 do `038` rodado no banco
remoto com autorização do Mateus (`select count(*) from documento where
tipo='nf_servico' and retencao_11 is not null` → **1**; a migration `0017`
não faz backfill nenhum, a nota vira pergunta pendente na tela, comportamento
seguro por desenho). `npx supabase db push` aplicado (migration `0017`
confirmada no remoto). `git push` liberado para os quatro commits represados
(`038`, `006`, `034`, `037`). Detalhe em
`docs/backlog/42-2026-09-21-contai-038-release.md`.

**2026-09-21**: **`006`** saiu da fila — implementado (`lead-engineer`),
revisado pelo Gate 2 (`cto-obra` APPROVE com 3 pendências pequenas; a 1ª
corrigida no mesmo commit — aviso de "sem resposta" disparava também em
escrita, movido para dentro do ramo repetível, com 2 testes novos), testado
(817 unitários + 220/220 E2E + validação manual no browser: Postgres local
pausado/despausado nos 4 estados de leitura/gravação, textos exatos do spec
confirmados, ambiente restaurado sem registro órfão) e validado pelo `po`
(Gate 4 PASS, 9/9 critérios). Decisão do `cto-obra` sobre a tensão critério
3×8: teto de leitura se prova por unitário com relógio injetado, não por
rota que pendura em E2E — o 503 do PostgREST continua a única falsificação
de rede permitida. Sem migration. Dívida nova: **D64**
(`docs/backlog/39-2026-09-21-contai-006-entregue.md`).

**2026-09-21**: **`034`** saiu da fila — implementado (`lead-engineer`),
revisado pelo Gate 2 (`cto-obra` APPROVE + `contador` REQUEST CHANGES numa
rodada — achou bug fiscal real, não só nota de cobertura: `cValor` em
`/compromisso/[id]/confirmar` pré-preenchia com o saldo previsto, mesma forma
da D44; corrigido dentro do próprio ticket por decisão do `contador`, virou
**D65**, RESPONDIDA), testado (839 unitários + 239 E2E + validação manual no
browser confirmando o campo vazio e o botão nomeando o que falta) e validado
pelo `po` (Gate 4 PASS, 12/12 critérios). Prova executável do invariante
"campo fiscal nasce sem default": `data-campo` amarra spec↔DOM, parser
`fail-closed` da seção `## Campos`, `e2e/campos-fiscais.spec.ts` classificando
as 40 rotas do app. Achou também **D66** (`unidades_autonomas` nasce `"1"`
contra o CONTAI-003, não corrigida — doutrina "prova, não conserta" do
próprio ticket). Sem migration.

**2026-09-21**: **`037`** saiu da fila — implementado (`lead-engineer`),
revisado pelo Gate 2 (`cto-obra` APPROVE, sem retrabalho), testado (839
unitários + 240 E2E, novo teste provando que "Ver o pagamento" na 2ª linha
abre o pagamento clicado, não o primeiro + validação manual no browser) e
validado pelo `po` (Gate 4 PASS, 5/5 critérios). `BotaoLink` "Ver o
pagamento" em cada linha de "Pagamentos desta nota", simetria com "Ver o
documento" já existente na tela irmã. Sem regra fiscal nova (Gate Fiscal
fechado, automático), sem migration, sem dívida nova. **Esvazia a "Fila de
implementação" — nenhum item restante na fila ativa.**

**2026-09-21**: **`014`** ficou **PARADO, não fechado** — critérios 1-3
(ícone/manifest) exigem aprovação explícita do Mateus sobre a arte, e os
critérios 5-6 exigem teste no iPhone físico dele (com lembretes D+7/D+21 em
datas futuras) — nenhum dos dois é delegável a subagente. Só o **critério
4** foi implementado e fechado, isolado do resto (`maximumScale` sai do
viewport + inputs sobem para 16px, para não quebrar o auto-zoom do Safari
no canteiro), revisado pelo `cto-obra` (APPROVE) e testado (3/3 E2E novos +
suíte completa verde). Commitado (`e7dd434`). Nota de pausa no corpo do
ticket; retomar quando o Mateus puder aprovar o ícone e testar no aparelho.

### Fila de implementação — nesta ordem

`041` foi o último item da rodada "desktop shell" (aberta em 21/09 pela
rejeição do `CONTAI-039`, ordem reconciliada
`042`→`040`→`043`→`044`→`045`→`046`→`041`), entregue no mesmo dia. Em
2026-09-22, o `CONTAI-047` entrou bloqueado por Gate 0; no mesmo dia o
Gate 0 fechou (`design/mocks/captura-no-desktop-v1.md`, reconciliado pelo
`po` — `docs/backlog/59-2026-09-22-decisao-po-mock-captura-desktop.md`) e o
ticket passou a **pronto para `/develop`**, entregue em 2026-09-23 (ver
acima). **Fila de implementação vazia** — `CONTAI-048` continua fora dela:
é não-bloqueante e fica em "Depois" até ganhar mock próprio.

**2026-09-23**: `po` fechou as duas lacunas que travavam `CONTAI-011` e
`CONTAI-048` (`docs/backlog/61-2026-09-23-po-fecha-lacunas-contai-011-048.md`).
`CONTAI-011` (P0, export do acervo — serve a meta 3 diretamente): o `cto-obra`
resolveu a arquitetura da pergunta P1 (tabela `export_execucao`, migration
`0018`, leitura via `lib/data.ts`); "P2/P3" nunca existiram como conjunto
formal — declarado no cabeçalho, não inventado. Pronto para `/develop`; só o
OAuth do Google Drive (passo de dashboard do Mateus) fica fora do Gate 1 de
código, bloqueando a 1ª execução real, não o desenvolvimento. `CONTAI-048`
(P1, ver anexo ampliado ao lado do formulário): Gate 0 fechado
(`design/mocks/CONTAI-048.md`/`.html`) — lightbox sob demanda, com correção
do `cto-obra` para PDF em touch (abre em nova aba, não embute, para não
degradar em silêncio no Safari iOS). Os dois saem de "Depois" e entram na
fila, `011` primeiro por ser P0.

**2026-09-23, mais tarde**: `CONTAI-011` **fatiado em três** — o
`lead-engineer` tentou o Gate 1 real e devolveu sem implementar nada, com
dois achados de fundo que nenhuma rodada anterior tinha visto (detalhe em
`docs/backlog/62-2026-09-23-fatiamento-contai-011.md`). **`CONTAI-011`
(011-A)** fica só com a rotina periódica + sinal no app — escopo reduzido,
reescrito no mesmo arquivo, **continua pronto para `/develop`**, sem tocar
nenhum dos dois achados. **`CONTAI-049` (011-B)**, triagem completa do
objeto órfão, nasce destravada pelo `contador` (achado fiscal: "vincular" um
órfão vira duas rotas, dependendo se o documento-alvo já tem arquivo — a
migration `0014` proíbe reescrever `arquivo_path`), mas ainda precisa de
retoque de mock e de uma decisão de sequenciamento do `cto-obra` com o
`CONTAI-027`. **`CONTAI-050` (011-C)**, dossiê sob demanda, nasce destravado
pelo `cto-obra` (achado de arquitetura: o app não tinha credencial para
gerar o dossiê — resolvido com fila de pedidos no Postgres +
`workflow_dispatch` sem parâmetro nenhum, acordado por um PAT de escopo
mínimo só na Vercel), mas ainda tem uma nota fiscal em aberto (conflito R6)
e um corte de mock a fazer. `CONTAI-048` não muda.

**2026-09-23, fim do dia**: `048` **saiu da fila** — entregue, ver nota no
topo deste arquivo. `051` fica sozinho na fila ativa.

**2026-09-23, mais tarde ainda**: `051` **saiu da fila** — entregue, ver nota
no topo deste arquivo. **Fila de implementação vazia** — nenhum ticket
pronto para `/develop` aguardando início.

**2026-09-24**: **`052` entra na fila** — criado já pronto para `/develop`
(decisões técnicas do `cto-obra` fechadas, sanity check fiscal APROVADO, sem
`/design`). Ver nota no topo deste arquivo.

**2026-09-25**: **`052` sai da fila** — entregue (ver nota no topo). **`054`
entra pronto**; **`053`** aguarda `/design` (Gate 0, nível 2); **`055`**
fica fora da fila até os dois anteriores fecharem.

**2026-09-25, mais tarde ainda**: **`056` entra pronto, na frente** — é P0
(bug fiscal), fura a fila de P1 por prioridade. Não depende de `053`/`054`/`055`
nem é dependido por eles (é sobre o cálculo já usar a linha capturada, não
sobre capturá-la).

**2026-09-25, ainda mais tarde**: **`056` sai da fila** — entregue (ver nota
no topo). `054` volta a ser o único item pronto.

**2026-09-25, ainda mais tarde**: **`054` sai da fila** — entregue (ver nota
no topo). `053` continua bloqueado por Gate 0; `055` agora só bloqueado por
`053` (a lib/rota que ele consome já existe).

**2026-09-25, ainda mais tarde**: **`053` sai da fila** — entregue (ver nota
no topo). `055` fica sozinho na fila, pronto — os dois tickets que ele
consome (`053`, `054`) já existem.

**2026-09-25, ainda mais tarde**: **`055` sai da fila** — entregue (ver
nota no topo). Backlog 71 (retenção) fechado por inteiro: `053`, `054` e
`055` entregues no mesmo dia. **Fila de implementação vazia** — nenhum
ticket pronto para `/develop` aguardando início.

**2026-09-26**: **`057`/`058` entram** — dois bugs de produção pós-`056`.
`058` sai da fila no mesmo dia, entregue. `057` fica sozinho, bloqueado por
Gate 0 (`/design`).

| Ordem | # | Ticket | P | Pronto para `/develop` |
|---|---|---|---|---|
| — | 057 | Coluna própria para custo comprovado em Despesas | P1 | ⛔ bloqueado por Gate 0 (`/design`) |

### 🛑 Em espera — decisão do Mateus, 2026-09-23

O trio "Export do acervo" (**`011`/011-A**, **`049`/011-B**, **`050`/011-C**)
saiu da fila ativa. Gate 1 do `011-A` chegou a rodar até o fim (DONE, 1012
unitários + 292 E2E verdes, **não commitado**) quando o Mateus identificou uma
lacuna de requisito que nenhum agente tinha visto: todo o desenho assume um
destino único (Drive do Mateus, credencial central) e não escala se o contai
virar produto multiusuário — cada usuário precisaria conectar o **próprio**
Drive. Detalhe completo em `docs/tickets/CONTAI-011.md` (bloco "🛑 EM ESPERA"
no topo do arquivo, replicado nos outros dois).

**Condição de retorno**: só reabrir Gate 2 em diante — e qualquer `/design`
que a correção de requisito exigir — **quando o fluxo comum de registrar
despesas e apurar custo estiver estável e correto**. Guarda documental (meta
3) espera; o core do produto (metas 1 e 2) não.

**O que fica intocado enquanto isso**: nada foi commitado, `npx supabase db
push` da migration `0018` não deve rodar, e o Gate 2 (`cto-obra`/`contador`)
não deve ser iniciado até esta nota ser removida por decisão do Mateus.

| # | Ticket | P | Estado |
|---|---|---|---|
| 011 | Export do acervo — rotina periódica + sinal (011-A) | **P0** | Gate 1 DONE, não commitado, **em espera** |
| 049 | Triagem completa do objeto órfão (011-B) | P0 | destravado, **em espera** antes mesmo do Gate 1 |
| 050 | Dossiê sob demanda, por obra (011-C) | P0 | destravado, **em espera** antes mesmo do Gate 1 |

### Parado, aguardando o Mateus (fora da fila ativa)

| ID | O que é | P | O que falta |
|---|---|---|---|
| **014** | Manifest de PWA + prova no aparelho | P1 | Aprovar arte do ícone/`short_name` (critérios 1-3) e testar no iPhone físico (critérios 5-6, com lembretes D+7/D+21). Critério 4 já entregue |

### Bloco de deploy — fora da fila

| ID | O que é | P |
|---|---|---|
| **012** | Manter o Supabase acordado | P1 |
| **013** | Configuração de produção do login | **P0** |
| **014** | Prova no aparelho real | P1 |

### Depois

| ID | O que é | P | |
|---|---|---|---|
| **016** | Tipo de empreitada na obra | **P0** | ramo `total` travado pela **Q14** |
| **024** | Corrigir informe/contrato do financiamento, com rastro | P1 | |
| **023** | Tirar "regime de caixa" das 4 telas restantes | P2 | |
| **017** | Lista de notas a cobrar | — | **corte**, com condição de volta |
| **028** | Quebrar `lib/data.ts` — fatias 2-7 | P2 | **corte proposto** |
| **015** | Captcha no login | P2 | **corte re-recomendado** |
| **026** | Terreno recebido (herança, doação, permuta) | P2 | **corte proposto** |

### O que segura a fila hoje

| | |
|---|---|
| **Espera o Mateus** | apenas a **Q14** (13 dias, trava o `016`) — nenhum mock pendente na fila ativa |
| **Saiu da fila, superado** | `009` — entregue via `CONTAI-018` sem citação cruzada; resto vivo virou o `037` |
| **Saiu da fila, entregue** | `032`, `022` — commitados em 2026-09-19 (`13953f2`); `033`, `007`, `008`, `005`, `031`, `035` — entregues em 2026-09-20; `038`, `006`, `034`, `037`, `039`, `042`, `040`, `043`, `044`, `045` — entregues em 2026-09-21; `046`, `041` — entregues em 2026-09-22 (`041` ainda sem push); `047`, `048`, `051` — entregues em 2026-09-23 (`048` com dívida nomeada **D69**, validação em iPhone real ainda pendente); ver "Em produção" |
| **Parado, aguardando o Mateus** | `014` — só o critério 4 entregue; ícone/aparelho físico não são delegáveis |
| **Pronto para `/develop`** | `052` — criado em 2026-09-24 já pronto (ver topo do arquivo) |
| **Falta mock (`/design`)** | nenhum na fila ativa |

⚠️ **Esta tabela é resumo, não fonte.** Ela repete o que está abaixo — se
divergir, **vale o de baixo**, e o resumo é que está errado.

---

**Este arquivo é a FONTE DA ORDEM.** Mudou em 2026-08-23: antes a ordem canônica
vivia numa "fila revista" dentro de uma entrada datada do diário, e este arquivo
só a espelhava. Os dois divergiram — a 6ª revisão passou cinco dias dizendo que
o `CONTAI-018` era o 1º item **com ele já em produção**. Retrato datado dentro de
diário não acompanha ticket que anda; este mapa acompanha, porque é ele que o
gate atualiza.

Quem guarda o quê, e é para ficar assim:

| Fato | Dono |
|---|---|
| **ordem de execução**, prioridade, status, hash de gate | **este arquivo** |
| **por que** a ordem mudou; dores, relatos, adjudicações fiscais | `../backlog.md` + `../backlog/` |
| escopo, critérios de aceite, Gate Fiscal | o ticket, em `CONTAI-0XX.md` |

Reordenar é ato do `po`, e ele escreve o **porquê** como entrada nova no diário —
mas a ordem em si se aplica **aqui**, e em nenhum outro lugar.

✅ **7ª revisão da fila — aplicada em 2026-08-23 pelo `po`.** É a primeira que
nasce aqui em vez de nascer no diário. O **porquê** de cada movimento está em
`../backlog/21-2026-08-23-setima-revisao-da-fila.md` — inclusive o que foi
cortado e o que continua parado esperando o Mateus. A ordem, o status e os
hashes são deste arquivo.

✅ **Adendo do `contador` aplicado no mesmo dia (23/08).** A 7ª revisão nasceu
desatualizada em três pontos — o parecer
`../pareceres/2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md`
destravou o `008`, criou o `032` e trouxe o `025` para dentro da fila. O adendo
que registrava esse fato **como texto solto neste arquivo foi absorvido pela
ordem e apagado**: ele existia só para o fato não ficar sem registro enquanto o
`po` não reordenava. O **porquê** está em
`../backlog/22-2026-08-23-adendo-a-setima-revisao.md`.

**Legenda**: ✅ done · 🔨 em desenvolvimento · 🟢 pronto para `/develop`
· 🟡 bloqueado por gate · 🔴 sem arquivo (só backlog)

## ⚠️ Regra de formato — ✅ sem lastro é impossível por construção

*Criada pelo `cto-obra` em 2026-08-18, depois de o ✅ do CONTAI-003 sobreviver a
**cinco revisões de fila** sem nenhum gate registrado.*

> **Um ticket só exibe ✅ se a linha citar os quatro hashes de gate —
> `G1:x G2:y G3:z G4:w`. Sem os quatro, o status é ⚠️.**

Não é questão de atenção, é questão de formato: *"verde era uma afirmação sem
referente; com hash obrigatório, a afirmação carrega a própria prova ou não se
escreve"*.

**Verificação mecânica**, a rodar no passo de revisão de fila do `/develop`:

```sh
grep -n '^|.*✅' docs/tickets/README.md | grep -v 'G1:.*G2:.*G3:.*G4:'
```

Achou linha? A revisão falha.

*Ajuste de 18/08 (`po`): a âncora `^|` foi acrescentada porque a versão anterior
casava também com a legenda e com este próprio parágrafo — o comando falhava
sempre, e um verificador que falha sempre é um verificador que ninguém roda. Só
**linha de tabela** conta.*

**Aplicado para trás em 18/08**: o `001` e o `002` foram **rebaixados a ⚠️**. Não
é dúvida sobre eles estarem no ar — é que ✅ sem os quatro hashes é afirmação sem
referente, e o critério do `cto-obra` é do projeto, vale para trás e não depende
de quem escreveu a linha.

---

## ✅ RESOLVIDO em 24/08 — migrations 0009-0012 confirmadas no remoto

*Levantado na 7ª revisão (23/08), fechado em 24/08. Histórico, não é mais
bloqueio.*

`npx supabase migration list` em 24/08 confirma `0001`-`0012` **iguais** entre
Local e Remote — inclui `0009_correcao_documento.sql` (CONTAI-021),
`0010_terreno_anexo.sql` + `0011_resposta_recarimbada.sql` (CONTAI-027, que
ficaram pushadas em código sem a migration aplicada por 2-3 dias) e a nova
`0012_documento_numero_emissao.sql` (CONTAI-004, `db push` autorizado pelo
Mateus antes do `git push`, ordem respeitada). A regra do `CLAUDE.md`
(**migration antes de código, sempre**) segue valendo para toda migration
futura — este bloco fica só como prova de que o furo de 21-23/08 foi fechado.

## Em produção — o que já está no ar

| # | Ticket | Status | Ressalva viva |
|---|---|---|---|
| 009 | **Detalhe do pagamento** | ✅ **SUPERADO pelo `018`** | Implementado como critério 3 do `CONTAI-018` (18/08), sem citar o `009` uma vez — as duas dores de origem (D20, D21) resolvidas de carona, mas o ticket nunca apareceu como entregue nem pendente no índice. Reconciliado em 24/08 (`docs/backlog/29-2026-08-24-reconciliacao-contai-009.md`): critérios 2-7 confirmados contra o código real. Único resto vivo: pagamento CONCILIADO sem porta quando um documento tem mais de um pagamento vinculado — migrado para ticket pequeno próprio (S, P1), sem número ainda. Registrou **D56** (comprovante que falta em pagamento antigo, sem caminho de correção — fora de escopo, mock próprio no futuro) |
| 025 | **Desembolso do terreno sem data, sem comprovante, ou sem os dois** | ⚠️ `f5cc0ac` | **Fatia 1 ENTREGUE, 16/16** (Gate 4 em 24/08). A fatia 2 é o `CONTAI-036`, entregue no mesmo dia — ver linha própria abaixo. Resolveu a dor do relato 005 — o Mateus voltou a poder registrar. Fecha **D49**, **D50** e **D47**. Sem migration. Fica ⚠️ (um hash só, não os quatro de gate) pela mesma régua do `018`/`019`/`003` |
| 036 | **Fatia 2 do 025 — a linha do §4.5 nas saídas anuais, e a primeira tela de relatório anual do produto** | ⚠️ `2240931` | **Gates 0-4 fechados em 24/08, 16/16 critérios** (14 originais + 2 promovidos retroativamente no próprio Gate 4: 15 = composição material/mão-de-obra por ano, 16 = marca da porta não pode ser forjada — achado do `cto-obra`, provado com exploit plantado antes do fix pelo `lead-engineer`). `podeGerarRelatorioAnual` virou porta única com veto por bloco (`bensEDireitos`/`pagamentosEfetuados`/`afericaoInss`), destravando os dois portões que o `025` deixou fechados por tipo. Nova rota `/obras/[id]/discriminacao/[ano]`. Registrou **D55** (defeito vivo em `composicaoDaDiscriminacao`, no ar desde o `CONTAI-021` — agregado bate, peso por documento é arbitrário; não corrigido aqui, decisão do `po`). Vitest 591/591, Playwright 152/152. Sem migration. Fica ⚠️ (um hash só, não os quatro de gate) pela mesma régua do `018`/`019`/`003` |
| 004 | **Nº do documento, data de emissão e série** | ⚠️ `05cb1e7` | **17/17 critérios** (2 promovidos retroativamente: 16 = coluna `serie`, 17 = limitação assimétrica da detecção de duplicata). Migration `0012` (4 colunas nullable, sem default, sem backfill — `select count(*) from documento` no remoto confirmou zero linhas antes do push). `db push` autorizado pelo Mateus, aplicado **antes** do `git push`. `007` (CNO na NF de serviço) compartilha o mock e segue **não construído**. Fica ⚠️ pela mesma régua acima |
| 027 | **Ver o anexo, e anexar mais de um** | ✅ `G1:1ff74c9…53acc37 G2-G4:02fd6fb` | **Duas dívidas vivas: D47** (`perguntaPendente` sem superfície de tela — ticket novo, e o `contador` exige parecer do texto do chip ANTES do mock) e **D48** (a justificativa de `completarDesembolsoTerreno` não ser atômico invoca uma tela que não existe). ⚠️ **Item 12d PENDENTE**, critério 13 CORTADO. Placar: 22 itens — 20 PASS. O Gate 1 ficou **2 dias pushado sem revisor**; os Gates 2-4 rodaram em 23/08 e acharam um defeito de rastro fiscal que **nunca virou dado** só porque o banco de produção está vazio |
| 001 | Ingestão de NF/boleto | ⚠️ **rebaixado em 18/08** (era "done") | os quatro hashes **não estão registrados**. O ticket está em produção e ninguém duvida disso — o que falta é a prova em formato auditável. Ressalva viva: critério 7 (≤3 interações) transferido à US-008 |
| 002 | Autenticação | ⚠️ **rebaixado em 18/08** (era "done") | mesmos quatro hashes ausentes. Ressalva **aberta**: R2 (prova no aparelho real) **transferida ao 014**, não resolvida. **Método trocado para e-mail+senha em 18/08** — reabre a validação de tela |
| 018 | Vínculo pagamento↔nota | ⚠️ `G1:b574316 G2:22279c0 G3:1710dc6 G4:3b9c26e` | **Quatro gates fechados e em produção** (push de 18/08, `b807901`). Fica ⚠️ e não ✅ porque os hashes acima foram **reconstruídos das mensagens de commit**, não lidos de um log de gate no ticket. Vira ✅ quando o `/develop` registrar os quatro no corpo do `CONTAI-018.md`. Corte vivo: critério 18 → `CONTAI-020` |
| 003 | Cadastro de obra e obra ativa | ⚠️ `G1:5550d11 G2:e72bf35 G3:papel G4:papel` | **Desempatado em 18/08**: o `cto-obra` adotou a posição do `lead`. G3 fecha por **evidência transitiva** (o quality do CONTAI-002 rodou sobre árvore que já continha o 003 — hash no ticket), G4 vira **passe de papel em paralelo**. Vira ✅ só **junto com o commit de registro** |
| 019 | Pagamento agendado (compromisso × pagamento) | ⚠️ `G1:df36b41 G2:50958a1 G3:3ec2913 G4:7c37b45` | **Entregue em 18/08, 49/49 critérios**, depois de um FAIL de Gate 4 por lastro documental (fechado pelo ADENDO 4, `d69a3cf`). Migration **0007**. Fica ⚠️ porque o hash do G4 foi **reconstruído da mensagem de commit** — vira ✅ quando o corpo do ticket registrar os quatro. Ressalva viva: **o mock v2 está DEFASADO em 4 pontos** (borda sólida no vencido, data pré-preenchida, s12 sem as cinco resoluções, sem a tela `/compromisso`) — não bloqueia o PASS, bloqueia quem for desenhar em cima. Ressalva **D28**: a `US-004` tem de chamar `podeGerarRelatorioAnual`. **Destravou o `CONTAI-022`** |
| 010 | Terreno financiado (Passo 1: captura) | ✅ `G1:ebe0bfc G2:be31bc4 G3:f54751c G4:960578c` | **DONE em 19/08**, com o log no corpo do ticket. Migration **0008** — a primeira destrutiva do projeto, **sem backfill**, descarte autorizado pelo Mateus. ⚠️ **Ressalva viva, e não é de software**: a obra está com terreno **R$ 0,00** até o Mateus redigitar os três desembolsos com as datas e lançar o informe de 2025 — e o ano-base 2025 **já foi declarado com o terreno dentro**. Seguros seguem em aberto (ADENDO 4). Passo 2 (critérios 17 e 20) foi para a **US-004** |
| 021 | Corrigir documento já registrado | ✅ `G1:2cefc62 G2:29d6144 G3:e517cc2 G4:32914b1` | **DONE em 21/08 — os quatro gates, com o log no corpo do ticket.** Mock v2 aprovado em 19/08 (`ad07fd8`, 27 telas). Gate 2 fechou depois de um loop de **seis bloqueantes**, o primeiro fiscal: a tela do desfecho misto afirmava número **falso, sempre para MAIS**. Entregou o **critério 13** (conserto de bug em produção, `moverDocumentoDeObra`) — **só do lado do documento**; o espelho é o `008`. ⚠️ **Exige a migration `0009` no remoto** — ver o BLOQUEIO DE RELEASE no topo. Ressalvas **R1-R5** no backlog; **R1-R3 viraram os critérios 13-15 do `008`** |
| 030 | Prazo de guarda que o app afirma depois de todo registro | ⚠️ `934f81a` **(rebaixado na 7ª revisão)** | **Entregue em 22/08** e corrigiu **erro fiscal em produção**: a confirmação de TODO registro dizia *"Original guardado no acervo — fica disponível até a venda + 5 anos"* — errado no prazo **e** na palavra *Original*. Texto novo sancionado pelo `contador`, sem número de prazo em tela; o **parecer foi corrigido primeiro**, porque o LEIA-ME do `011` o copia literalmente. **Fica ⚠️, não verde**: entregue em commit único, sem os quatro hashes de gate. É a regra do `cto-obra` aplicada a quem a escreveu depois — o `grep` de verificação acusava esta linha hoje |
| 029 | Teste unitário para os mappers da camada de dados | ⚠️ `20d4d0e` **(rebaixado na 7ª revisão)** | **Entregue em 23/08**: 76 casos, 14/14 mappers, Vitest 412→488, zero código de produção no diff. Achou **D42** (condição fiscal 6 sem rede nenhuma → `CONTAI-031`) e **D43** (formato do rastro protegido por uma única asserção E2E). O critério 4 estava **pedindo um bug** e foi reescrito em 4a/4b. **Fica ⚠️, não verde**: quatro gates rodaram, um hash só foi registrado |
| 028 | Quebrar `lib/data.ts` em módulos por entidade — **fatia 1 de 7** | 🔨 `a9ef819` | **Só a fatia 1 está entregue** (23/08): os 14 mappers puros foram para `lib/dados/comum.ts`, barrel de volta a **63 exports exatos**, golden snapshot byte a byte. O ticket **segue aberto** e as fatias 2-7 estão no fim da fila — ver a proposta de corte em "Depois" |
| 032 | Tirar `data = hoje` e `meio = "pix"` do formulário de pagamento | ⚠️ `13953f2` | **7/7 critérios, entregue em 2026-09-19** junto com o `022` (mesmo commit — ver a ressalva do `022` abaixo sobre o motivo de irem juntos). `decidirRegistro` só decide o destino quando `meio` e `data` foram digitados; até lá o formulário mostra o que falta, sem gravar. `RECUSA_CARTAO`/`RECUSA_CARTAO_ONDE_REGISTRAR` saíram daqui — o cartão foi para o fluxo próprio do `022`. 617 testes unitários + E2E verdes. Fica ⚠️ (commit único, sem os quatro hashes de gate) pela mesma régua do `018`/`019`/`003` |
| 022 | Cartão de crédito (compra → fatura) | ⚠️ `13953f2` | **16/16 critérios, entregue em 2026-09-19**. Migration `0013` (3 tabelas: `fatura`, `fatura_compromisso`, `fatura_desembolso` + 4 funções transacionais + `GRANT`s explícitos). `lib/fiscal/fatura.ts` novo (matemática de alocação do rotativo). 5 telas novas, `e2e/cartao.spec.ts` (10 testes) verde contra o Postgres local. **Commitado junto com o `032`** porque os dois evoluíram nos mesmos arquivos (`compromisso.ts`, `pagamento/page.tsx`) na mesma sessão sem commit intermediário — separar agora arriscava um estado quebrado no meio. **Corte de escopo disclosed**: `/fatura/[id]/alocar` só funciona chegando via `?desembolso=`; acesso direto mostra fallback em vez de seletor de desembolso. Fica ⚠️ pela mesma régua acima |
| 033 | Captura de documento sem arquivo (CTA) | ⚠️ `3c3f4de` | **Entregue em 2026-09-20**, revisado (`cto-obra`, aprovado com ressalvas não bloqueantes) e testado no browser (639 unitários + 180 E2E, 3 bugs achados no teste manual e corrigidos na hora). Migration `0014`. Fica ⚠️ (commit único, sem os quatro hashes de gate) pela mesma régua acima |
| 007 | CNO referenciado na NF de serviço | ⚠️ *(ver nota no topo do arquivo)* | **Entregue em 2026-09-20, 9/9 critérios.** Migration `0015` (`documento.cno_referenciado` + `nota_traz_cno`, tri-estado). Gate 2 rodou duas vezes: a primeira rodada do `contador` achou erro fiscal real no critério 7 (bloqueio indevido ao corrigir obra de um documento já lançado) — parecer `docs/pareceres/2026-09-20-cno-nao-bloqueia-correcao-de-obra.md` reverteu para aviso permanente, nunca bloqueio, e **invalidou a leitura anterior do `CONTAI-008`** (pergunta 1/critério 16 — já anotado no corpo daquele ticket). 669 unitários + 195 E2E + validação manual no browser. Gate 4 (`po`) PASS. **Mudança de processo no mesmo dia**: `/design` deixou de exigir HTML e aprovação explícita |
| 008 | Mover PAGAMENTO entre obras sem quebrar o vínculo | ⚠️ *(ver nota no topo do arquivo)* | **Entregue em 2026-09-20, 16/16 critérios** (2-16; 16 substituído, ver abaixo). Migration `0016` (`mover_pagamento_de_obra`, ato transacional espelho do `moverDocumentoDeObra` do `021`; guarda de contagem de decisões aplicada também em `mover_documento_de_obra`). Gate 2 aprovou sem retrabalho — a leitura fiscal já vinha corrigida pelo Gate 2 do `007` no mesmo dia. `app/_components/corrigir-obra.tsx` (órfão desde o `007`) apagado. 687 unitários + 202 E2E + validação manual no browser (duas obras, CNO diferentes, move com "vai junto" mostrando aviso e preservando o vínculo). Gate 4 (`po`) PASS. Dívida nova: **D60** (histórico de correção de pagamento invisível em `/pagamento/[id]`) |
| 005 | Headline da home: "Custo em risco no IR" | ⚠️ *(ver nota no topo do arquivo)* | **Entregue em 2026-09-20, 6/6 critérios da Parte A.** `emPendenciaCentavos` (4 moedas fiscais somadas) removido; `custoEmRiscoIr` (3 parcelas: pago sem nota, nota fora do CPF, pago sem comprovante) + `exposicaoInssBaseCentavos` (base, deduplicada por `documento.id`). Gate 2 fiscal voltou REQUEST CHANGES na 1ª rodada — o mock de 16/08 não previa "pago sem comprovante" nem `nf_servico_sem_cno` (nasceram depois, no CONTAI-019/025); o `contador` decidiu as duas lacunas, parecer `docs/pareceres/2026-09-20-gate-fiscal-contai-005-rodada-2.md`. Gate 4 (`po`) FAIL na 1ª rodada por falta do parecer transcrito (regra "parecer só em transcript é a mesma falha"), PASS depois de escrito. 712 unitários + 201/202 E2E (falha restante é teste flaky de fuso horário, não fiscal — `docs/backlog/35-...md`) + validação manual no browser. Dívida nova: **D61** (`terrenoPagoSemComprovante` fora do headline, mesma moeda fiscal, precisa de decisão de arquitetura do `cto-obra`) |
| 031 | E2E da condição 6 do Gate Fiscal (CONTAI-028) | ⚠️ *(ver nota no topo do arquivo)* | **Entregue em 2026-09-20, 8/8 critérios.** Sem UI nova, sem regra fiscal nova — cobertura de teste para a condição 6 (corrigir classificação nunca abre pendência de retificadora nem grava ano afetado), já adjudicada. `test.describe` novo em `e2e/correcao.spec.ts` + comentário-guarda da D43 ancorado por conteúdo. Gate 2 (`cto-obra`) APPROVE. 17/17 no spec tocado; suíte completa 202/203 (falha restante pré-existente e não-fiscal, `docs/backlog/35-...md`) + validação manual no browser (correção real material → mão de obra). Gate 4 (`po`) PASS. Marca a fatia 5 do CONTAI-028 como bloqueada por este ticket |
| 035 | Reconciliar a régua de cor (D39) com todo o app | ⚠️ *(ver nota no topo do arquivo)* | **Entregue em 2026-09-20, 11/11 critérios.** `gravidadeDaRegua(...)` (`lib/fiscal/gravidade.ts`) vira único produtor de `Gravidade` branded — zero cor literal sobrevive (D54). Itens B/C/D/E reconciliados em ~19 call sites; item C tinha 9 sites, não 7 (2 a mais nasceram no `CONTAI-008`, depois do inventário original) — extensão confirmada por `cto-obra` e `contador` no Gate 2, ambos APPROVE. 742 unitários (30 novos) + 203/204 E2E (falha pré-existente e não-fiscal, `docs/backlog/35-...md`) + validação manual no browser (CNPJ errado + pagamento de ano anterior → card vermelho + aviso condicional de retificadora). Gate 4 (`po`) PASS. Sem migration. **Destrava o `038`** |
| 038 | Retenção de NF de serviço PJ vira lista de linhas | ✅ `6dd771e` | **Entregue em 2026-09-21, 18/18 critérios** (7a incluído, e 18 fechado com a contagem no remoto = 1, sem backfill). `retencao_11` sai do schema; entram o gate `retencao_na_nota` (captura) e a tabela `documento_retencao` (repeater na gestão). `retencao_sem_recolhedor` é a primeira pendência que AGRAVA a régua de cor. `lib/fiscal/risco.ts`/`afericao.ts` pararam de ler retenção para decidir abatimento do SERO (§2 do parecer 18/09 — efeito correto, não regressão). Gate 2 com 1 rodada de REQUEST CHANGES fiscal (texto desatualizado, corrigido), APPROVE na segunda. 791 unitários + 217/217 E2E + validação manual no browser. Gate 4 (`po`) PASS. Migration `0017` aplicada no remoto em 2026-09-21. Dívidas novas: **D62**, **D63** |
| 041 | Despesas — tabela de verdade (`/despesas`) | ✅ `827b135` | **Entregue em 2026-09-22, 11/11 critérios.** `lib/fiscal/despesas.ts` (`linhasDeDespesa`) projeta `Documento`/`Pagamento` em linhas (`ResumoObra.despesas` agrega por componente, não por pagamento — precisava de projeção nova), com 8 cenários de teste garantindo zero duplicação de centavo — `contador` conferiu a lógica com os próprios olhos, APPROVE de primeira. Gate 2 do `cto-obra` achou bug real: documento sem valor virava "R$ 0,00" (afirmação de zero sem dado) — corrigido para "—". Chip neutro do terceiro estado fica fora do componente `Chip`; anotação "Nota sem arquivo" (CONTAI-033) entra mesmo fora da letra do critério. 925 unitários + 273 E2E + validação manual extensa. Gate 4 (`po`) PASS. Sem migration. **Fecha a rodada "desktop shell" inteira** |
| 046 | Obra e Terreno migram para dentro do shell de gestão | ✅ `1c052a1` | **Entregue em 2026-09-22, 6/6 critérios.** `obras/[id]`, `terreno/*` (+ `desembolsos`, `financiamento`, `informe/[anoBase]`), `discriminacao/[ano]` e `notas-sem-cno` saem de `(captura)` e entram em `(gestao)`, coluna 640px (discriminação sem exceção — texto é `<pre>`, não trunca). `podeGerarRelatorioAnual` (CONTAI-036) continua porta única. Gate 2: `contador` APPROVE de primeira; `cto-obra` REQUEST CHANGES — corrigiu de vez o teste flaky de fuso horário de `discriminacao.spec.ts` (dívida desde 2026-09-20, `D35`), provado com `TZ=Pacific/Midway`. 890 unitários + **265/265 E2E, sem nenhuma falha conhecida** (primeira vez na sessão) + validação manual extensa. Gate 4 (`po`) PASS. Sem migration. **Fecha os 4 tickets da migração (`043`-`046`)** |
| 045 | Compromisso e Pendência migram para dentro do shell de gestão | ✅ `82d88a3` | **Entregue em 2026-09-21, 6/6 critérios.** `compromisso`/`[id]` (+ `cancelar`, `confirmar`, `data`) e `pendencias/[id]` saem de `(captura)` e entram em `(gestao)`, coluna 640px. `contador` conferiu com os próprios olhos que a D65 (`cValor` sem default, CONTAI-034) sobrevive à migração — trava resolve por URL, não por pasta. 3 decisões do `cto-obra` sem mudança de código: banner âmbar sem obra (correção, não regressão), `/compromisso` mantém 640px (pilha de cards, não fila), duplicação `TresRespostas` vira dívida. 887 unitários + 256/257 E2E + validação manual. Gate 4 (`po`) PASS. Sem migration. **Último antes do `046`** |
| 044 | Pagamento e Fatura migram para dentro do shell de gestão | ✅ `c36edea` | **Entregue em 2026-09-21, 5/5 critérios.** `pagamento/[id]` (+ `ligar`, `obra`) e `fatura/[id]` (+ `alocar`, `confirmar`, `parcial`) saem de `(captura)` e entram em `(gestao)`, mesma casca do `043` (coluna 640px). Telas de leitura perderam o rodapé fixo — ações foram para dentro do card. `fatura/[id]/alocar` resolvido sem exceção de largura (lista label+checkbox, não tabela densa). Implementado em **Sonnet** (Opus com 4 falhas de API seguidas nesta rodada; `cto-obra` confirmou que isso não muda o contrato de revisão). Gate 2 (`cto-obra`+`contador`) APPROVE sem retrabalho. 883 unitários + 252/253 E2E (mesma falha pré-existente do `043`) + validação manual. Gate 4 (`po`) PASS. Sem migration. **Destrava o `045`** |
| 043 | Documento migra para dentro do shell de gestão | ✅ `0181505` | **Entregue em 2026-09-21, 5/5 critérios.** As 10 rotas de `/documento/[id]` (detalhe + anexar, cnpj-errado, corrigir/{classificacao,emitente,valor}, desligar, ligar, obra, outro-dado) saem de `(captura)` (430px) e entram em `(gestao)`: `ColunaDeDetalhe` 640px, `RodapeDeAcao` sticky só em formulários, breadcrumb (`migalhaDaRota`) no lugar do botão fixo "Voltar" — removido em todas as subrotas, com 1 exceção nomeada (`corrigir/emitente?voltar=pagamento`). Nenhum texto fiscal mudou (confirmado por diff filtrado + grep-travas). Gate 2 (`cto-obra`+`contador`) APPROVE sem retrabalho. 881 unitários + 249/250 E2E (1 falha pré-existente e não-relacionada) + validação manual. Gate 4 (`po`) PASS. Sem migration. Achado operacional: dois agentes rodando E2E ao mesmo tempo corrompem o Postgres local compartilhado. **Destrava o `044`** |
| 040 | Shell de navegação desktop + Dashboard ("Visão geral") | ✅ `00b4475` | **Entregue em 2026-09-21, 13/13 critérios.** Route groups Next 16: `(gestao)` com shell novo (sidebar 264px + faixa mínima mobile, dashboard com 3 KPIs verbatim, `/despesas` stub, `/pendencias`, `/obras`) atrás de um `ProvedorDeGestao` único; `(captura)` intocado (~40 telas movidas sem mudança de comportamento). Hacks do `039` apagados (órfãos). Badge da sidebar vem de `unificarPendencias().abertas`. Gate 2 (`cto-obra`+`po`+`contador`) com 1 rework (`OPCOES_DE_REGISTRO` duplicada → `lib/gestao/navegacao.ts` com teste-trava). 877 unitários + 248 E2E + validação manual extensa. Gate 4 (`po`) PASS. Sem migration. Decisões de produto do `po`: seletor de ano vira texto (ticket futuro P1); painel usa cards completos do `ItemDaFila`. **Destrava o `041`** |
| 042 | Pendências — unificação das 18 famílias (derivadas+persistentes) | ✅ `f5867d6` | **Entregue em 2026-09-21, 6/6 critérios + 9/9 do checklist fiscal.** `lib/fiscal/pendencias-unificadas.ts` agrega as 18 famílias (7 de `pendencias[]` + 11 antes só agregadas na home) numa lista única por gravidade; `/pendencias` renderiza tudo, sem shell (isso é o `040`). Parecer do `contador`: 8 famílias de cor literal não passam por `gravidadeDaRegua` (fabricaria fato fiscal) — viraram constante nomeada, lida também pela home. Gate 2 com 1 rodada de REQUEST CHANGES (6 cards copiados em vez de extraídos — corrigido em `app/_components/pendencias-derivadas.tsx`, fonte única para home e `/pendencias`). 859 unitários + 247 E2E + validação manual no browser com 3 famílias simultâneas. Gate 4 (`po`) PASS. Sem migration. **Destrava o `040`** |
| 039 | Home ganha layout desktop (régua fixa + fila em grid) | ✅ `2e38c3b` | **Entregue em 2026-09-21, 12/12 critérios.** A partir de `lg` (1280px): `<aside>` sticky com a posição fiscal (custo confirmado/em risco/INSS) à esquerda, fila de pendências/despesas em grid 2 colunas à direita, mesma ordem fiscal de hoje. Abaixo de `lg`, idêntico ao mobile de sempre. Convergência `designer`+`cto-obra`+`po` escolheu o Conceito 2 ("Régua fixa + fila de trabalho") sobre 2 alternativas descartadas (tabela truncaria `Consequencia`; mestre-detalhe esconderia cards sempre-visíveis atrás de seleção); sanity check do `contador` antes do Gate 1 (sem regra fiscal nova). Gate 2 achou bug real: aside sticky escondia `CardAfericaoInss` quando a régua era mais alta que a viewport — corrigido com scroll próprio. Segundo achado: `lg:max-w`/`BarraAdicionar` viraram opt-in por página (`Corpo largo?`, `data-largo`, `alinharComFila`) em vez de globais, eliminando o efeito colateral nas outras 43 telas — a dívida **D67** cogitada pelo `po` nunca chegou a ser registrada. 839 unitários + 242 E2E (240 mobile + 2 desktop) + validação manual no browser em 1280px. Gate 4 (`po`) PASS. Sem migration |
| 037 | Porta para o pagamento conciliado a partir do documento | ✅ `2a39e71` | **Entregue em 2026-09-21, 5/5 critérios.** `BotaoLink` "Ver o pagamento" em cada linha de "Pagamentos desta nota" (`/documento/[id]`), simetria literal com "Ver o documento" já existente na tela irmã (`/pagamento/[id]`). Reusa `alocado.pagamentos`, sem segunda derivação (Pre-mortem 1). Sem regra fiscal nova (Gate Fiscal fechado, automático, sem CRC) — segunda porta de leitura para dado já calculado. Gate 2 (`cto-obra`) APPROVE sem retrabalho. 839 unitários + 240 E2E (novo teste prova que o clique na 2ª linha abre o pagamento clicado, não o primeiro) + validação manual no browser. Gate 4 (`po`) PASS. Sem migration, sem dívida nova. **Fecha a fila ativa** |
| 034 | Campo fiscal não nasce preenchido, e o teste prova | ✅ `79237c3` | **Entregue em 2026-09-21, 12/12 critérios.** `data-campo="<id do mock>"` amarra `design/mocks/*.md` a todo controle fiscal; `lib/design/campos-do-spec.ts` parseia a seção `## Campos` fail-closed (linha fora da gramática = vermelho com arquivo:linha, nunca `skip`); `e2e/campos-fiscais.spec.ts` exige toda rota de `app/**/page.tsx` classificada e cruza spec×DOM no instante em que a tela nasce. Provado contra a D44 real: reintroduzir `useState(hojeIso)`/`useState("pix")` deixa a suíte vermelha nomeando `fData`/`meio`. Gate 2 achou bug fiscal ativo (não só cobertura): `cValor` em `/compromisso/[id]/confirmar` pré-preenchia com o saldo previsto — mesma forma da D44 — corrigido dentro do próprio ticket por decisão do `contador` (**D65**, RESPONDIDA). 839 unitários + 239 E2E + validação manual no browser. Gate 4 (`po`) PASS. Sem migration. Dívida nova, não corrigida: **D66** (`unidades_autonomas` nasce `"1"` contra o CONTAI-003, fora do alcance da suíte hoje) |
| 006 | Estados de rede lenta/indisponível | ✅ `234db4d` | **Entregue em 2026-09-21, 9/9 critérios.** Política de rede única em `lib/rede.ts` (`db.retry:false`): leitura 3 tentativas/teto 5s com texto honesto desde a 1ª falha; gravação 1 tentativa/teto 10s, nunca repetida, distinguindo "não foi salvo" de "não deu para confirmar" (evita duplicar registro). `Carregando` virou máquina de 4 níveis (45 usos/38 arquivos); novo trio `BotaoSalvar`/`AvisoDeGravacao`/`ErroDeGravacao`. Gate 2 (`cto-obra`) APPROVE com 1 rodada de rework (aviso de "sem resposta" disparava também em escrita — falso; corrigido, 2 testes novos). Decisão do `cto-obra`: teto de leitura se prova por unitário com relógio injetado, não por rota que pendura em E2E — o 503 do PostgREST segue sendo a única falsificação de rede permitida. 817 unitários + 220/220 E2E + validação manual no browser (Postgres pausado/despausado, 4 estados, textos exatos confirmados). Gate 4 (`po`) PASS. Sem migration. Dívida nova: **D64** |
| 014 | Manifest de PWA + prova no aparelho (critério 4 apenas) | ⚠️ **commitado (`e7dd434`)** | **PARADO em 2026-09-21** — critérios 1-3 (ícone/manifest) e 5-6 (teste no iPhone físico, lembretes D+7/D+21) exigem o Mateus pessoalmente, não delegável. Só o **critério 4** entregue: `maximumScale` sai do viewport, inputs sobem para 16px (evita auto-zoom do Safari no canteiro), com E2E travando a regressão. Gate 2 (`cto-obra`) APPROVE. 3/3 E2E novos + suíte completa verde. Ver nota no topo de `docs/tickets/CONTAI-014.md` para retomar |
| 047 | Captura (`/adicionar/*`) ganha casca de tela larga | ✅ `ae477bf` | **Entregue em 2026-09-23, 11/11 critérios.** `app/(captura)/layout.tsx` ganha `larga:max-w-[940px]` (breakpoint 880px); `documento/page.tsx` ganha o rail (anexo/preview/extração + resumo somente-leitura, nada inferido); os três formulários ganham `CamposCurtos` para escalares curtos lado a lado, com bloco de pergunta fiscal preservado em coluna única. Gate 2 técnico (`cto-obra`) e fiscal (`contador`) APPROVE, os dois reconfirmados por escrito depois de um commit de acabamento com 5 pendências — `contador` comparou byte a byte `lib/fiscal/documento.ts` e as 3 telas. Quatro divergências do mock/critério literal, julgadas no Gate 2 e registradas no ticket como decisões: grid nova no hub, resumo do rail oculto (não visível) abaixo do piso de 880px, stepper decorativo coexistindo com o "Passo X de Y" antigo (a incoerência pré-existente vira **D68**, sem ticket), e um ajuste de formatação no `.md` do spec. 933 unitários + 284 E2E + validação manual extensa no browser. Gate 4 (`po`) PASS. Sem migration. Detalhe: `docs/backlog/60-2026-09-23-contai-047-entregue.md` |

## Fila de implementação

*7ª revisão, 2026-08-23, **com o adendo do mesmo dia aplicado** — o `contador`
respondeu as duas perguntas que a revisão levantou e o tabuleiro mudou em três
pontos. Raciocínio da revisão em
`../backlog/21-2026-08-23-setima-revisao-da-fila.md`; o **porquê dos movimentos
do adendo** em `../backlog/22-2026-08-23-adendo-a-setima-revisao.md`. Parecer
que os produziu:
`../pareceres/2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md`.*

**O critério de ordenação, dito uma vez**: primeiro o que já está **em voo**
(código sem revisor é a dívida mais cara do projeto), depois o **P0 fiscal** que
falha por fora (fato que não tem onde ser registrado), depois o **P0 fiscal** que
falha por dentro (registro que grava estado inválido), depois o resto.

⚠️ **O adendo de 23/08 abriu uma exceção ao critério, e ela é fundamentada**: o
par `025 + 032` passa na frente do `022` **porque o parecer mostrou que a falha
do `022` não é "por fora"**. Com `meio = "pix"` pré-selecionado, a compra no
cartão **não deixa de ser registrada — ela é registrada como PIX**, na data da
compra. Não é ausência de custo, é **custo falso no acervo**, e a doutrina do
projeto (*campo vazio pergunta, campo preenchido afirma*) põe o registro falso
acima da ausência. O `032` é o que converte a falha do `022` de *registro falso
silencioso* em *recusa explícita* — e só então o `022` fica sendo o que a 7ª
revisão descreveu.

| Ordem | # | Ticket | P | Status | O que trava |
|---|---|---|---|---|---|
⚠️ **`027`, `025` e `036` saíram desta tabela em 24/08** — os três estão
entregues e commitados; ver "Em produção" acima. `004` também saiu (entregue,
commit `05cb1e7`). **`032` e `022` saíram em 2026-09-19** (entregues,
`13953f2`). **`033`, `007`, `008`, `005`, `031`, `035`, `038`, `006`, `034`,
`037`, `039` e `042` saíram em 2026-09-20/21** (entregues — ver a nota no
topo do arquivo; todos pushados exceto `042`). `039` entrou nesta tabela e
saiu no mesmo dia (24 horas de fila, convergência → entrega); `042` nunca
chegou a entrar aqui (nasceu já com o `040`/`041` na fila resumida acima).
**`014` saiu para "Parado, aguardando o Mateus"** (só o critério 4
entregue). **Tabela vazia em 2026-09-21**; nenhum item desta tabela fica sem
construir.

### ⚠️ O que a fila diz de si mesma, e é desconfortável

**O quadro virou por completo no fim de 24/08.** Era oito de onze travados em
23/08. Uma rodada de `/tickets-req` cobrindo os quatro tickets sem arquivo
(`022`, `031`, `033`, `035`) seguida de `/design` em todos os mocks pendentes
da fila (`032`, `022`, `033`, `035`, `008`, `005`) — mais a reconciliação do
`009` (que virou `037` no meio do caminho) — deixou **os 11 itens da fila,
todos, prontos para `/develop`**. O `009` original não é mais item travado:
reconciliação de 24/08 achou que já estava entregue via `CONTAI-018` desde
18/08, sem citação cruzada nenhuma
(`docs/backlog/29-2026-08-24-reconciliacao-contai-009.md`); o único resto
vivo (porta para pagamento conciliado) virou o `037`, ticket + mock também
fechados no mesmo dia. O gargalo histórico do projeto (fila de mocks
esperando o dedo do Mateus) **zerou** nesta rodada; o volume de trabalho que
se abre agora em `/develop` é grande o suficiente para valer a pena avisar
antes de começar, não depois.

*(Nota histórica, 23/08: o `025` foi o primeiro item da classe P0 em vários
dias cuja trava não era o dedo do Mateus — Gate Fiscal fechado, sem mock novo.
Entregue no dia seguinte, junto com a fatia 2, `036`.)*

⚠️ **`CONTAI-020` está RESERVADO e não tem arquivo** — é a **fila de
conciliação**, cortada do critério 18 do `CONTAI-018` (ver
`CONTAI-018.md:201`). Ele só vira ticket se a **pergunta aberta nº 2** do 018
disser que a home não basta. Não reutilizar o ID.

## Bloco de deploy — fora da fila de implementação

*Ordem alterada na 7ª revisão: o item **0** não é ticket e vem antes de tudo.*

| # | Ticket | P | Status | Nota |
|---|---|---|---|---|
| **0** | ~~Aplicar `0009` e `0010` no projeto remoto~~ | **P0** | ✔️ **FEITO em 23/08** | **Não é ticket, é a ordem obrigatória do release invertida.** Ver o BLOQUEIO DE RELEASE no topo deste arquivo. `npx supabase db push`, conferir em Database → Migrations, e só então seguir. **Bloqueia o `013` e qualquer deploy novo** |
| 012 | Manter o Supabase acordado | P1 | 🟢 | sem tela, sem impacto fiscal |
| 013 | Configuração de produção do login | P0 | 🟢 | **encolheu** — SMTP e template saíram com a troca para senha |
| 014 | Prova no aparelho real | P1 | 🟢 | mesmo deploy de preview do 013 |

## Depois

*Reordenado na 7ª revisão. **Nenhum item daqui entra no `/develop` antes de a
fila acima esvaziar** — e três deles estão propostos para corte.*

| # | Ticket | P | Status | Nota |
|---|---|---|---|---|
| 011 | Export do acervo | **P0** | 🟡 | **O único P0 desta seção, e ele serve a META 3 diretamente.** Gate 0 aprovado em 16/08; trava é a **P1 do CTO** (fonte do estado) — decisão do `cto-obra`, **não do Mateus**. ⚠️ **Restrição nova de 21/08** (§4 do Gate Fiscal do `027`): com N anexos por lançamento, o índice do dossiê põe **cada anexo em linha própria com hash**, o **valor uma única vez** na linha do lançamento e a declaração de que os N anexos compõem **um** desembolso — *"um dossiê que induz soma errada é pior que um incompleto"*. **Sobe para a fila assim que a P1 do CTO for respondida** |
| 016 | Tipo de empreitada na obra | P0 | 🟡 | Ramo `total` **bloqueado** pela mesma coisa há 13 dias: o parecer de **empreitada total × parcial** (10/08) **só existe em transcript**. Não exige mock. ⚠️ **Amarrado à Q14** — as duas se resolvem com a mesma resposta |
| 024 | Corrigir informe/contrato do financiamento, **com rastro** | P1 | 🟡 | Criado no Gate 2 do `010`. O Gate 2 **tirou o `grant update`** de `financiamento` e `financiamento_informe`: grant sem tela não entrega o remédio que promete — informe com **duas rubricas trocadas entre si** fecha a soma, então nem a trava nem o CHECK acusam, e o `unique` trava o ano-base **para sempre**. Grant volta no mesmo diff que a tela e o histórico. Inclui `previsto` → `pago` |
| 017 | Lista de notas a cobrar (tela 14) | — | 🟡 | **cortado**, com condição de volta escrita. Depende de 004 + 007 |
| 023 | Tirar "regime de caixa" das 4 telas restantes | P2 | 🟢 | Da dor **D31**. Sem mock e sem Gate Fiscal — texto já ratificado no §F.5. **S.** Segue sendo dos primeiros a ceder se a fila apertar |
| 028 | Quebrar `lib/data.ts` — **fatias 2-7** | P2 | 🟡 | ⚠️ **CORTE PROPOSTO na 7ª revisão, com uma exceção.** As seis fatias restantes entregam **custo de leitura de agente** — que não serve a nenhuma das três metas. A fatia 1 tinha consumidor (`029`) e foi entregue; as outras não têm. **Exceção que sobrevive**: a extração de `textoDoRastro` (fatia 5), que é a cura da **D43** e tem consequência fiscal — ela se agrega ao próximo ticket que tocar aquele call-site. **Condição de volta**: um ticket fiscal medir de novo o custo de leitura de `lib/data.ts` e achá-lo proibitivo. Enquanto isso, a trava do `erros.ts` continua valendo (não ganha export novo antes do reexport nomeado) |
| 015 | Captcha no login | P2 | 🟡 | ⚠️ **CORTE RE-RECOMENDADO na 7ª revisão, com argumento novo.** O `po` já recomendara cortar por fricção com uma mão — **esse argumento morreu** com a régua de 18/08. O que o substitui é mais forte: o captcha existia para proteger o **limite de 2 e-mails/hora** do envio de código, e o login **virou e-mail+senha em 18/08** — não há mais envio a proteger. Não serve a nenhuma das três metas. **Decisão do Mateus**, que já o manteve uma vez |
| 026 | Terreno recebido (herança, doação, permuta) | P2 | 🟡 | ⚠️ **CORTE PROPOSTO na 7ª revisão.** O sistema existe para **esta** obra: o terreno **já foi adquirido e é financiado**, e nenhuma das três naturezas pode ocorrer nela. Manter o item é escrever produto para construtora, que é o escopo declarado fora. **Condição de volta escrita**: uma segunda obra cujo terreno venha por herança, doação ou permuta. O buraco real que ele nomeia — *quem escolher essa natureza fica com custo zero* — se fecha hoje **não oferecendo a natureza**, e isso é uma linha, não um ticket |


## Stories ainda sem ticket

`US-004` (relatórios anuais) · `US-005` (migrar planilha) · `US-006` (prestador
PF) · `US-008` (extração automática — **Gate Fiscal já fechado**, parecer de
17/08) · `US-009` a `US-012`.

⚠️ **A `US-004` já nasce com três obrigações herdadas, e elas NÃO podem viver só
no ticket que as transferiu** (registrado no Gate 4 do `CONTAI-027`, 23/08):

1. **D28** — a tela promete que o relatório trava e nada trava: a `US-004` **tem
   de** chamar `podeGerarRelatorioAnual`.
2. **Critério 12c do `CONTAI-027`, terceira superfície** — a pendência *"Um
   lançamento, mais de uma data"* aparece na **lista de revisão
   pré-declaração**, e ali ela **não é dispensável, adiável nem colapsável**.
3. **Critério 12d do `CONTAI-027`** — **nenhum** texto de pendência, alerta ou
   instrução nossa entra em **área copiável**, neste ou em qualquer relatório: o
   bloco é colado literalmente na ficha Bens e Direitos e aviso lá dentro vira
   **texto declarado à RFB** (IN SRF 84/2001, art. 17). **Regra geral, não
   exceção de um ticket.** Texto no §4c de
   `docs/pareceres/2026-08-21-gate-fiscal-contai-027-criterio-13.md`.

**Dores novas de 18/08, do fechamento do `CONTAI-019`**: **D26** — compra no
cartão não tem onde morar, e o comentário do código culpa uma pergunta (Q4) que
foi respondida em 08/08 → **`CONTAI-022`**; **D27** — o formulário direto recusa
gravação sem comprovante enquanto a confirmação de compromisso não recusa (dois
pesos para o mesmo fato) → **absorvida pelo `CONTAI-019`**, critérios 46-48.

**Dores novas de 18/08, do parecer do terreno financiado**: **D33** — o
financiamento do terreno **não tem onde morar no app**, e o custo de 2025
(**R$ 59.934,75**, com documento já na mão do Mateus) está inteiro fora do
sistema → **absorvida pelo `CONTAI-010`**; **D34** — durante o ano corrente o
painel **subestima** o custo do financiamento, porque o informe só sai em
jan/fev, e hoje isso seria silencioso → **absorvida pelo `CONTAI-010`**,
critério 16.

**Dores sem ticket, abertas no Gate Fiscal do `CONTAI-021` (18/08)**: **D24** —
o app não sabe qual ano-calendário já foi declarado, e sem isso nem o aviso do
021 nem o da D-018.2 conseguem ser verdadeiros (mesmo detector, construir uma
vez); **D25** — documento em duplicidade não tem saída depois do registro
("marcar como duplicata de X" é anotação, não delete).

⚠️ **Colisão de ID corrigida no Gate 4 do `CONTAI-019` (18/08)**: o número
**D24** estava sendo usado por **duas** dores abertas no mesmo dia. A do
*"regime de caixa"* foi renumerada para **D31** e virou o **`CONTAI-023`**.
**D24 = ano-calendário declarado; D31 = "regime de caixa" nas telas restantes.**
ID repetido em backlog vivo destrói a rastreabilidade que o ID existe para dar —
a partir da colisão, nenhuma das duas pode ser citada em ticket sem ambiguidade.

**Dívidas do Gate 2/4 do `CONTAI-019`**: **D28** (a tela promete que o relatório
trava e **nada trava** — a `US-004` **tem de** chamar `podeGerarRelatorioAnual`),
**D29** (`getByRole(…, { name })` sem `exact` erra na direção de **aprovar**),
**D30** (`pagamento_diferenca` aceita UPDATE no valor) e **D32** (enum fiscal sem
contrapartida em `docs/pareceres/` — vai junto com a D29, e **exige antes** a
regra de o parecer citar o identificador entre crases).

---

## Dívidas de escrituração

1. ~~**Quatro tickets decididos e não escritos**~~ — **PAGA em 18/08**: `019`,
   `016`, `017` e `006` escritos.
   **A dívida que os bloqueava encolheu à metade em 18/08**: o parecer do
   **compromisso** virou arquivo (`4e0cf87` →
   `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`) e **destravou o
   Gate 1 do 019**. ⚠️ **Continua só em transcript** o de **empreitada total ×
   parcial** (10/08, trava o ramo `total` do 016, aberto há oito dias).
   Materializar em `docs/pareceres/`.
2. ~~**CONTAI-003 sem Gates 3 e 4**~~ — **RECONCILIADO em 18/08**. O `cto-obra`
   cedeu à posição do `lead`, com emenda: *"Gate 3 não é pulado, é fechado por
   evidência registrada"*. Falta só o **commit de registro** dos dois passes.
   O gatilho de reabertura é único e está escrito: se o Gate 4 achar coisa que
   41 testes + produção não cobrem **e** que não cai no par 004+007.
3. **CONTAI-007 precisa de revisão de Passo 1** — seis pontos, incluindo uma
   contradição interna (declara que não precisa de mock e condiciona a própria
   aprovação a um).
4. ~~**Decisões tomadas sob a régua velha de cenário**~~ — **PAGA na 7ª revisão
   (23/08)**, caso a caso como o `cto-obra` pediu, e não em bloco. As três
   julgadas, com o resultado:
   1. **corte do Google Calendar — MANTIDO, com o fundamento trocado.** O veto
      original (*"não abre agenda no canteiro"*) **morreu** junto com a régua.
      O que sustenta o corte é outra coisa, e independe de onde ele usa o app:
      *"não pagar juros"* é **gestão de caixa** e não serve a nenhuma das três
      metas. O que serve — *data prevista passou sem confirmação* — o
      `CONTAI-019` já entrega **in-app, custo zero, sem OAuth**. Corte
      confirmado; o argumento do canteiro **não pode ser reusado**.
   2. **CONTAI-015 (captcha) — CORTE RE-RECOMENDADO, com argumento novo.** A
      objeção de fricção com uma mão caiu, mas a **razão de existir** do ticket
      caiu junto: ele protegia o limite de 2 e-mails/hora do código por e-mail,
      e o login virou **e-mail+senha em 18/08**. Ver a linha dele em "Depois".
      **Decisão do Mateus.**
   3. **CONTAI-007 — a contradição está RESOLVIDA: ele PRECISA de mock.** O
      *"não precisa, a tela é mínima para o polegar"* era argumento de captura
      aplicado a uma tela de **gestão**. A revisão de Passo 1 (dívida 3 acima)
      começa por este ponto, e a fila já o registra como travado em mock.
5. ~~**Dois briefs de agente contradizem o `CLAUDE.md`**~~ — **PAGA em 18/08**
   pelo Mateus, no commit `f7c22e6`: `.claude/agents/po.md` não diz mais
   *"venda + 5 anos"* e `.claude/agents/designer.md` não diz mais *"no canteiro…
   julgado nesse cenário primeiro"*. **Consequência que fica registrada**: toda
   decisão anterior a `f7c22e6` foi tomada com a régua velha reinjetada no
   prompt — quando uma delas for reaberta, o argumento "não cabe com uma mão"
   não vale sozinho para tela de gestão (é o item 4 acima).
6. **Condição fiscal em ticket sem parecer que a carimbe** — aberta em 23/08.
   O `contador` derrubou uma restrição que veio do **critério 13 do
   `CONTAI-003`**, escrita pelo `po` como *"**Restrição fiscal**: corrigir a obra
   de NF de serviço obriga a revalidar `cno_referenciado`…"*, citando **um
   ticket** (`CONTAI-007`, critério 2) e **nenhum parecer**. Ela sobreviveu 13
   dias, virou `podeCorrigirObra` — e o código a **endureceu** de *revalidar*
   para *recusar*, o que é uma segunda falha em cima da primeira — e travou um
   **P0**. Não é incidente: a **D32** já nomeara a mesma forma (*"enum fiscal sem
   contrapartida em `docs/pareceres/` é classe, não incidente"*). **Remédio
   proposto pelo `po` para o `/tickets-req`**, com a redação em
   `../backlog/22-2026-08-23-adendo-a-setima-revisao.md` — instalação em
   `.claude/commands/tickets-req.md` é do Mateus. **Varredura retroativa: o
   `grep` acha uma única linha ofensora hoje**, a do `CONTAI-003:359`, que este
   adendo já revoga.
