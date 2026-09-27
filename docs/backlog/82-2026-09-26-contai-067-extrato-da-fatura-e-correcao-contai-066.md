# 82 — 2026-09-26 — `CONTAI-067` criado (extrato da fatura) e correção de citação no `CONTAI-066`

## O que motivou

O Mateus leu o corpo original do parecer `docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md`
(o que fechou o `CONTAI-066`) e perguntou:

> *"mas o que comprova que aquele pagamento foi pago em tal fatura se não tem
> o comprovante único do pagamento?"*

O `contador` respondeu com um **ADENDO** ao mesmo arquivo: o `§2` original
respondeu certo a "quem prova que EU PAGUEI o item" (ninguém — o Mateus paga a
fatura, não o item), mas não separou essa pergunta de outra, que ficou sem
resposta: **"quem prova que ESTE item estava DENTRO desta fatura específica
que eu paguei"**. Achado técnico junto: nem `fatura` nem `fatura_desembolso`
têm hoje nenhum documento próprio da fatura em si — só existe
`fatura_desembolso.comprovante_path` (o pagamento agregado). A associação
compra↔fatura, que decide o ANO-CALENDÁRIO do custo (regime de caixa, IN SRF
84/2001 art. 17), é hoje só o campo `vencimento da fatura` que o Mateus
digita — nenhum documento de terceiro por trás.

**Requisito novo, classificado pelo próprio ADENDO como "gate fiscal, não
conveniência"**: anexar o **extrato da fatura** — PDF itemizado emitido pela
ADMINISTRADORA do cartão, um por fatura (nunca por compra/item) — como
documento que amarra a composição.

## Correção no `CONTAI-066`

O `CONTAI-066` (redirect de wayfinding para "Agendado" com data vencida)
continua correto — a exclusão de "comprovante por item" do escopo dele
permanece válida, ratificada pelo próprio ADENDO. Mas a seção Gate Fiscal
dele citava o `§2` original sozinho, sem o ADENDO, e ficou desatualizada:
corrigida para citar corpo + ADENDO, deixando explícito que o requisito do
extrato é outra pergunta, vira ticket separado (`CONTAI-067`) e **não
bloqueia** o Gate Fiscal do `066`. A seção Fora de Escopo ganhou a mesma
ressalva. Ver `docs/tickets/CONTAI-066.md`.

## `/tickets-req` do `CONTAI-067`

**Passo 1 (po)**: user story de anexar o extrato no fluxo de confirmação da
fatura (`/fatura/[id]/confirmar`), P0 fiscal. Pre-mortem: confundir os dois
campos de arquivo; retroagir sobre faturas já confirmadas (proibido, mesma
disciplina do `CONTAI-065`); extrato indisponível de fatura antiga — o
próprio ADENDO já resolveu (pendência registrada, nunca bloqueio, nunca
recusa em silêncio), sem precisar reabrir pergunta ao Mateus.

**Passo 2 (contador)**: já fechado no ADENDO do parecer original — não
rederivado.

**Passo 3 (cto-obra)**: coluna nova `fatura.extrato_path` (nunca em
`fatura_desembolso` — um extrato serve N desembolsos da mesma fatura,
cardinalidade oposta à do `comprovante_path`, que é 1 por desembolso). Grant
**de coluna** (`update (extrato_path)`, nunca `update` de tabela inteira —
`fatura` preserva `data_vencimento` como chave natural, sem UPDATE geral).
`e2e/privilegios.spec.ts` ganha mapa novo lendo `role_column_grants`, porque
grant de coluna não aparece no mapa atual (`role_table_grants`). RPC
`anexar_extrato_fatura` (padrão `security invoker`, transição única
`null→path`, trigger de imutabilidade cópia de `pagamento_comprovante_path_imutavel`
da `0019`) é o único ponto de anexo tardio e do caminho rotativo — mora em
`/fatura/[id]` (tela de detalhe, hoje só leitura), nunca em `/parcial`
(pedir o mesmo documento a cada pagamento parcial duplicaria a entrada).
`fatura_desembolso_gravar` ganha `p_extrato_path` opcional no fim da
assinatura para o caminho de `/confirmar`. Recomendação de escopo: incluir a
fila unificada de pendências no mesmo ticket (nova família
`fatura_sem_extrato`) — sem lista de faturas (`carregarFaturas` não existe
hoje), a pendência do bloco em `/fatura/[id]` fica invisível da home, mesma
lição da doutrina D47. Complexidade **L** (M sem a fila unificada).

**Consulta pontual ao contador, cor da pendência**: `cto-obra` não quis
chutar vermelho×âmbar. Resposta, registrada como **ADENDO 2** no mesmo
parecer: **vermelha**. Aplicando a régua do A.4
(`docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`): "saiu?
sim — tem apoio hábil no ano certo? não" = vermelho, mesmo padrão do
precedente "mais de uma data" e do vermelho fixo de `documentosSemArquivo`.
Diferente do âmbar do Estado C do ADENDO 4 do parecer de retenção (lá o
custo já está sustentado no valor e no ano certo, falta só ação futura de
terceiro). Nuance para o `cto-obra`: o veto é só da **discriminação da ficha
Bens e Direitos** — não trava aferição INSS nem Pagamentos Efetuados, porque
compra no cartão não é mão de obra e o valor/favorecido de cada compra já
está provado pelas NFs individuais. Mecanismo exato ("qual saída trava") fica
para o Gate 2, não fechado no ticket.

**Passo 4 (designer)**: Gate 0 nível 2 fechado em `design/mocks/CONTAI-067.md`
(texto + ASCII, sem HTML). Dois `CampoArquivo` empilhados em
`/fatura/[id]/confirmar` ("Comprovante da fatura" / "Extrato da fatura
(emitido pelo cartão)"), estado "extrato já anexado" troca o campo por
`ListaDeAnexos`. Bloco novo em `/fatura/[id]` (depois do Card "Valores já
pagos", antes do Card de ações) com dois parágrafos: consequência (cita
ADENDO 1/2 — falta apoio hábil para fixar o ano-calendário na ficha Bens e
Direitos) e escopo do **NÃO-veto** (não trava Pagamentos Efetuados nem a
aferição INSS) — parágrafo deliberadamente diferente do card irmão
`documentos_sem_arquivo`, para o vermelho não sugerir um veto que o Gate
Fiscal descartou. Card da pendência unificada espelha
`CardDocumentosSemArquivo`, mesma cor vermelha, mesmo corte de CTA (1
fatura → link; N faturas → informativo). Achado do Gate 0: `PapelDeAnexo`
(`lib/types.ts`) precisa do valor `"extrato"` — virou **critério 20** do
ticket, não ficou só em nota de rodapé. **`CONTAI-067` pronto para
`/develop`.**

## Dívidas novas

- **D84** — multicartão com o mesmo vencimento colapsa num único `fatura` (já
  aceito na `0013`) agora colapsa também num único `extrato_path` — o risco
  residual antigo ganha custo documental concreto.
- **D85** — não existe hoje nenhum leitor "todas as faturas da obra"
  (`carregarFatura` é singular); pré-requisito da fila unificada do
  `CONTAI-067`.
- **D86** — anexo do extrato não ganha rastro formal em `revisao` (decisão
  deliberada — sem impacto em apuração, sem "anos afetados" a rastrear); se
  o `contador` exigir rastro explícito no futuro, `entidade_revisao` (ENUM)
  precisa de `alter type add value` em migration própria.

## Onde ficou

`docs/tickets/CONTAI-067.md` (ticket completo, bloqueado por Gate 0),
`docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md` (ADENDO +
ADENDO 2), `docs/tickets/CONTAI-066.md` (citação corrigida). `design/mocks/CONTAI-067.md`
em andamento no mesmo dia.
