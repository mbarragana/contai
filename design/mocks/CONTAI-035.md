# CONTAI-035 — Reconciliar a régua de cor (D39) com o app

**Nível 3 — tabela antes/depois.** Confirmado: nenhuma tela nova, nenhum
componente novo, nenhum texto novo de vulto — só a classe de cor
(`cor="red"`/`border-red` ↔ `cor="amb"`/`border-amb`) muda em 17 call sites já
existentes, mais 1 frase condicional (item D) que reaproveita o esqueleto de
uma constante já em produção (`AVISO_ANO_ANTERIOR`). Nada disso muda densidade,
hierarquia ou ordem de leitura — o Mateus julga isto lendo a tabela, não vendo
mock. Concordo com a leitura do orquestrador.

Convenção de cor no código: vermelho = `cor="red"` (chip/consequência) +
`border-red` (card); âmbar = `cor="amb"` + `border-amb`. `Card`, `Chip`,
`Consequencia` são os componentes de `app/_components/ui.tsx`.

Origem da régua: D39, revisada em
`docs/backlog/25-2026-08-23-a-regua-de-cor-e-o-que-ela-escondia.md`:

> saiu? → tem apoio hábil no ano certo? → não = vermelho
> vermelho = fato consumado + consequência fiscal aberta **e nada no acervo
> sustenta o valor no lugar certo**; âmbar = nada saiu ainda, **ou** o valor já
> está sustentado e falta só corroboração.

---

## Tabela completa (17 mudam + 8 conferidos sem mudança)

| # | Item | Pendência | Arquivo:linha | Cor atual → nova | Origem da regra |
|---|---|---|---|---|---|
| 1 | B | falta lançar {ano} (home) | `app/page.tsx:569-575` | âmbar → **vermelho** | D39 revisada, `backlog/25`, item B — comentário na própria linha 514 já confessava "o dinheiro saiu, e o custo daquele ano não existe no sistema" |
| 2 | B | falta lançar (painel do terreno, ano a ano) | `app/obras/[id]/terreno/page.tsx:346-367` (branch `situacao === "falta_lancar"`: `border-amb` linha 333-334, `Chip` linha 346, `Consequencia` linha 362) | âmbar → **vermelho** | idem |
| 3 | C | Correção mexeu em ano anterior (home) | `app/page.tsx:399-424` | âmbar → **vermelho** | D39 revisada, item C — fato consumado (correção já lançada) sem apoio hábil no ano certo |
| 4 | C | Correção mexeu em ano anterior (lista de pendências) | `app/pendencias/page.tsx:162-184` | âmbar → **vermelho** | idem |
| 5 | C | Correção mexeu em ano anterior (detalhe da pendência) | `app/pendencias/[id]/page.tsx:431` | âmbar → **vermelho** | idem |
| 6 | C | Correção mexeu em ano anterior (corrigir valor) | `app/documento/[id]/corrigir/valor/page.tsx:213-221` | âmbar → **vermelho** | idem |
| 7 | C | Correção mexeu em ano anterior (corrigir valor, 2ª ocorrência — "vira pendência na home") | `app/documento/[id]/corrigir/valor/page.tsx:425-433` | âmbar → **vermelho** | idem |
| 8 | C | Correção mexeu em ano anterior (mover documento de obra) | `app/documento/[id]/obra/page.tsx:335-345` | âmbar → **vermelho** | idem |
| 9 | C | Correção mexeu em ano anterior (mover documento de obra, 2ª ocorrência) | `app/documento/[id]/obra/page.tsx:612-615` | âmbar → **vermelho** | idem |
| 10 | D | CNPJ errado — tratar (home) | `app/page.tsx:434-442` | âmbar → **condicional**: vermelho se ≥1 pagamento vinculado ao documento, senão âmbar | D39 revisada, item D — gate fiscal; condição de vínculo é a mesma já usada em `lib/fiscal/resumo.ts:543` (`p.documentoIds.includes(d.id)`) |
| 11 | D | CNPJ errado — tratar (lista de pendências) | `app/pendencias/page.tsx:194-200` | âmbar → **condicional** (mesma regra) | idem |
| 12 | D | CNPJ errado — tratar (detalhe da pendência) | `app/pendencias/[id]/page.tsx:202` | âmbar → **condicional** (mesma regra) | idem |
| 13 | D | Já marcado — CNPJ errado, a tratar | `app/documento/[id]/cnpj-errado/page.tsx:232-235` | âmbar → **condicional** (mesma regra) | idem |
| 14 | E | Contrato do financiamento não cadastrado (painel do terreno) | `app/obras/[id]/terreno/page.tsx:307-321` | ⚠️ **âmbar hoje — NÃO já vermelho, ver Achado 1 abaixo** → deveria ficar **vermelho** (a branch já é gated por `naturezaAquisicaoTerreno === "financiado"`, linha 306) | D39 revisada, item E |
| 15 | E | Sem contrato não há informe (tela de informe anual) | `app/obras/[id]/terreno/informe/[anoBase]/page.tsx:326-329` | âmbar, gate errado (`!financiamento`) → **trocar gate para `naturezaAquisicaoTerreno === "financiado"`**; vermelho quando verdadeiro | D39 revisada, item E |
| 16 | F | NF de serviço sem retenção (fonte que a home herda) | `lib/fiscal/resumo.ts:563-576` (`gravidade: "amb"` fixo, linha 574) | âmbar fixo → **condicional**: vermelho se `nf_servico`, fora de quarentena, `retencao11 !== true` (trata `false` e `null` igual — já é a condição do `if` em 566-567) **E** existe ≥1 pagamento vinculado (`pagamentos.some(p => p.documentoIds.includes(d.id))`); senão âmbar | D39 revisada, item F |
| 17 | F | NF de serviço sem retenção (detalhe do documento) | `app/documento/[id]/page.tsx:511-537` (`Banner cor="amb"`, linha 529) | âmbar fixo → **condicional** (mesma regra; `pagamentos.length > 0` já disponível na linha 104) | idem |

### Conferidos — sem mudança (auditoria completa da régua)

| # | Item | Pendência | Arquivo:linha | Cor | Veredito |
|---|---|---|---|---|---|
| 18 | F | NF de serviço sem retenção (formulário de cadastro) | `app/adicionar/documento/page.tsx:664-670` | âmbar | **Correto, sem mudança.** Documento ainda não existe — sem vínculo de pagamento possível, não há "≥1 pagamento vinculado" a testar. Mantido na tabela para a superfície não sumir. |
| 19 | A | Falta a data (home) | `app/page.tsx:524-530` | vermelho | Já correto — conferido, sem mudança |
| 20 | A | Um lançamento, mais de uma data (home) | `app/page.tsx:551-557` (`PendenciaDeDatas`) | vermelho | Já correto — conferido, sem mudança |
| 21 | A | Falta a data (painel do terreno) | `app/obras/[id]/terreno/page.tsx:501` | vermelho | Já correto — conferido, sem mudança |
| 22 | A | Pago sem comprovante / falta a data e comprovante (desembolsos do terreno) | `app/obras/[id]/terreno/desembolsos/page.tsx:428,672` | vermelho | Já correto — conferido, sem mudança |
| — | — | Sem pagamento ligado (documento hábil sem pagamento — "terceiro estado") | `lib/fiscal/resumo.ts:588` (`notasSemPagamento`) | fora da régua vermelho/âmbar (nem entra em `pendencias[]`, parecer §5.2 — não soma com confirmado nem com em-risco) | Âmbar legítimo por construção — nada saiu ainda |
| — | — | Boleto aguardando pagamento | `lib/fiscal/resumo.ts:409-423` (`gravidade: "amb"`, linha 421) | âmbar | Âmbar legítimo — nada saiu ainda |
| — | — | Aguardando informe anual (financiamento, ano ainda não fechado) | `app/obras/[id]/terreno/page.tsx:349` / `lib/fiscal/terreno.ts` (`AGUARDANDO_INFORME`) | âmbar | Âmbar legítimo — nada saiu ainda |
| — | — | Previsto — ainda não pago (terreno) | `app/obras/[id]/terreno/page.tsx:531` | âmbar | Âmbar legítimo — nada saiu ainda |
| — | — | Chip de agendado / vencido sem resposta | `app/_components/agendado.tsx:75,158,209,246` | âmbar | Âmbar legítimo — nada saiu ainda |
| — | — | Falta dizer como o terreno foi adquirido | `app/obras/[id]/terreno/page.tsx:253-255` | âmbar | Âmbar legítimo — natureza não decidida, nenhuma regra de custo corre ainda |
| — | Exceção | Pago sem comprovante — PJ | `lib/fiscal/pagamento.ts:213-218` (`SEM_COMPROVANTE_PJ`, `gravidade: "amb"`), consumido genericamente via `p.gravidade` em `app/page.tsx:464,470` e equivalente em `app/pendencias/page.tsx` | âmbar | **Exceção nomeada, correta** — parecer `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` §601-602: para PJ a NF já sustenta o custo, o comprovante é reforço, não constitutivo |
| — | Exceção (contraste) | Pago sem comprovante — PF | `lib/fiscal/pagamento.ts:220-225` (`SEM_COMPROVANTE_PF`, `gravidade: "red"`) | vermelho | Correto por contraste — para PF o comprovante é constitutivo |

---

## Achado 1 — a citação `app/_components/pago-sem-comprovante.tsx:81` não é o exceção-site real ⚠️

O enunciado cita `app/_components/pago-sem-comprovante.tsx:81` como o local da
exceção "PJ fica âmbar, PF fica vermelho". Fui ao arquivo: ele tem 102 linhas,
é **inteiro sobre o desembolso do terreno** (`CardPagoSemComprovante`), e a
linha 81 é `<Card className="border-red" data-pendencia="terreno-sem-comprovante">`
— sempre vermelho, sem ramo PJ nenhum (desembolso de terreno é
necessariamente PF/pessoa física, não há distinção PJ ali).

A distinção PJ/PF de "pago sem comprovante" que o parecer §601-602 descreve é
outra: fica em `lib/fiscal/pagamento.ts:213-225` (`SEM_COMPROVANTE_PJ` /
`SEM_COMPROVANTE_PF`), consumida genericamente pela home e pela lista de
pendências via `p.gravidade` (não há componente dedicado — é o mesmo `Card`
genérico de pendência que renderiza todo o array de `resumo.ts`).

**Não mudei o veredito** (ele está certo: PJ âmbar, PF vermelho, é o que o
código faz) — só corrigi a citação de arquivo:linha na tabela acima (linha 18
do bloco de exceções), porque a original aponta para o card errado. Se em
algum outro lugar existir de fato um ramo PJ dentro de
`pago-sem-comprovante.tsx` que eu não vi, é bom confirmar — hoje ele não existe.

## Achado 2 — item E, site 1, NÃO está "já correto"

O enunciado marca `app/obras/[id]/terreno/page.tsx:307-321` como "já correto"
para o item E. Lido o arquivo: a branch **já é gated** por
`obra.naturezaAquisicaoTerreno === "financiado"` (linha 306) — isso está
correto — **mas a cor renderizada é `border-amb` / `Chip cor="amb"`** (linhas
307-308), não vermelho. Ou seja: toda vez que este card aparece, a condição do
item E (`natureza === "financiado"`) já é verdadeira por construção da
própria branch, e pela régua nova ele deveria ser **sempre vermelho** — hoje
não é. Marquei na tabela como mudança (linha 14), não como conferência.
Peço confirmação: é uma correção real que ficou de fora da adjudicação, ou
existe um site diferente que eu deveria estar olhando?

## Item D — texto exato do aviso condicional "exige CRC"

Copiado o esqueleto de `AVISO_ANO_ANTERIOR` (`lib/fiscal/revisao.ts:144-146`),
trocando só a cláusula que nomeia o fato — a cláusula de efeito
("se a DAA daquele ano já foi entregue, avalie retificadora com seu
contador") é **literal**, não reescrita:

> **Original (`AVISO_ANO_ANTERIOR`):** "Esta correção mudou o custo de um ano
> anterior; se a DAA daquele ano já foi entregue, avalie retificadora com seu
> contador."

> **Proposto para o item D** (nome sugerido: `AVISO_CNPJ_ERRADO_ANO_ANTERIOR`,
> ao lado de `EMITENTE_ERRADO_O_QUE_FALTA` em `lib/fiscal/revisao.ts`):
> "Este documento com CNPJ errado sustenta um pagamento de um ano anterior; se
> a DAA daquele ano já foi entregue, avalie retificadora com seu contador."

Aparece como uma segunda `<Consequencia cor="amb">` (a cor do texto continua
âmbar — é aviso informativo, não é ele quem carrega o vermelho da pendência)
logo abaixo da `<Consequencia cor="red">{EMITENTE_ERRADO_O_QUE_FALTA}</Consequencia>`,
nos 4 sites do item D, só no ramo em que o pagamento vinculado já está em ano
anterior ao corrente.

⚠️ **Não resolvida por mim, porque seria inventar regra fiscal**: o enunciado
diz "se o pagamento já estiver em DAA entregue", mas o app **não sabe** se uma
DAA foi entregue (é o motivo de existir `SO_SEI_QUE_E_ANO_ANTERIOR` —
`lib/fiscal/revisao.ts:150-155` — declarando exatamente essa fronteira). O
`AVISO_ANO_ANTERIOR` original dispara pela mesma heurística indireta: ano do
fato < ano corrente. Presumo que o gatilho do item D reusa essa mesma
heurística (ano do pagamento vinculado < ano corrente), não um campo
"DAA entregue" que não existe no schema — mas isso precisa ir para o
`contador`/`cto-obra` confirmarem antes do ticket de implementação, não para
mim decidir.

---

## Perguntas abertas

1. **Achado 2** — item E, site 1 (`terreno/page.tsx:307-321`): é mudança real
   (âmbar → vermelho) ou existe um site diferente que a adjudicação quis dizer
   com "já correto"?
2. **Item D, gatilho do "DAA entregue"** — confirmar com `contador`/`cto-obra`:
   reaproveita a heurística de calendário de `SO_SEI_QUE_E_ANO_ANTERIOR` (ano
   do pagamento < ano corrente), ou existe outro sinal no schema que eu não
   vi?
3. **Achado 1** — a citação de arquivo:linha da exceção PJ/PF estava errada no
   enunciado; corrigida na tabela para `lib/fiscal/pagamento.ts:213-225`. Só
   avisando para o rastro não ficar comprometido em revisão futura.
