## Terreno financiado — 2026-08-18 (absorvidas pelo `CONTAI-010`)

*Fonte normativa: `docs/pareceres/2026-08-17-terreno-financiado.md` + **adendos
1, 2 e 3 de 18/08**. Onde o corpo do parecer e os adendos divergirem, valem os
adendos.*

⚠️ **Antes das dores, uma correção de rota**: o `CONTAI-010` afirmava, na linha
86, que *"juros e correção de parcelamento do terreno ficam fora do custo"*.
**Estava errado** — juros e correção **integram** o custo de aquisição de imóvel
(IN SRF 84/2001, art. 17, I; ⚠️ a alínea é **"i"** na listagem do Perguntas e
Respostas, o `contador` corrigiu a própria citação e mandou **confirmar na IN
vigente**). A frase foi **apagada** do ticket, não riscada. No caso real são
**R$ 43.051,23 em 2025** — **72% do desembolso do ano**. É o tipo de erro que
não aparece em teste, não aparece em build, e só aparece na declaração.

| # | Dor | Origem | Prioridade |
|---|---|---|---|
| D33 | **O financiamento do terreno não tem onde morar no app.** O terreno é financiado (~20 anos, só o terreno), e o custo de 2025 — **R$ 59.934,75** de amortização + juros/correção — está **inteiro fora do sistema**. Não é hipótese: o documento existe e o Mateus já o tem na mão | `contador`, adendos de 18/08 | **P0 fiscal** → `CONTAI-010` |
| D34 | **Durante o ano corrente o painel subestima o custo do financiamento**, porque o informe anual só é publicado em jan/fev. Subestimar **em silêncio** é o defeito do `CONTAI-005` ao contrário: número errado em tela sem rótulo que o explique | `contador`, adendo 1 §6 | **P1** → `CONTAI-010`, critério 16 |

**O fato que redesenhou o ticket** (e é o que o Mateus trouxe): existe um
**"Extrato do Imposto de Renda"** da instituição credora, **um por exercício**,
que ele **baixa sozinho no site** — publicação automática para o IR, não
solicitação. **Pedidos ao banco durante o ano: zero.** O `contador` revisou o
parecer para acomodar isso e **cancelou** a exigência de captura mensal e o
pedido de extrato analítico retroativo: *"a exigência de todo mês era
rastreabilidade, não apuração"*.

Consequência: **um lançamento por ano-base + contrato**, com as rubricas
separadas. Somam no custo **amortização e juros/correção**. Ficam **fora da
soma, guardados, em revisão humana**: seguros (exclusão firme), taxa de
administração, mora/multa, a rubrica **"Diferença Teórico / Pago"** (natureza
**desconhecida** — o `contador` disse que não sabe e não supôs) e o **FCVS**,
este último marcado **candidato a inclusão**, não exclusão.

**Duas travas que o ticket carrega como critério**: a soma das rubricas tem de
**fechar com o total pago** (se não fechar, **recusar**, nunca somar o resto); e
por ano+contrato é **o informe OU as parcelas, nunca os dois** — o `cto-obra`
resolveu esta segunda na versão forte, **não construindo o caminho mensal**, de
modo que a dupla contagem seja impossível por ausência de tipo.

**Regras registradas agora para não se perderem no dia em que importarem**:
dívida quitada por **sinistro do MIP não é custo de aquisição** (não houve
desembolso dele); **reparo custeado por indenização do DFI não é dispêndio
dele** — o tratamento da indenização **em dinheiro** ficou *"confirmar"*.

**Ressalva de peso, e ela vai ao corpo do ticket**: nas palavras do `contador`,
juros nessa ordem de grandeza *"é assinatura de CRC, não decisão de app"*. Isso
**não trava o software** — o app soma, **nomeia os juros em linha própria** e
guarda cada rubrica separada. O que ele não faz é vender o resultado como
veredito: todo número deste ticket é **insumo para revisão profissional**.

**Complexidade**: o `contador` avaliou que o lançamento anual traz o ticket de
**M para ~S**. O `cto-obra` **discorda em parte e tem razão** — a *apuração* é S,
mas o ticket inteiro carrega migration com movimentação de dado em produção
(as três colunas de `obra` **morrem** e viram linhas datáveis), três tabelas
novas com `grant` explícito, e **três telas novas** com Gate 0 antes. **M
pequeno, fatiável em dois S**: Passo 1 (captura + correção do cálculo) é o
`CONTAI-010`; Passo 2 (texto da discriminação e o caso do ano da venda) vai
junto da **US-004**.

**Gate 0 do `CONTAI-010`: PENDENTE.** Há UI nova e **não existe mock** — rodar
`/design`. Cenário: **gestão em casa, sentado**, uma vez por ano. Não é captura
de canteiro e não se julga por essa régua.

---
