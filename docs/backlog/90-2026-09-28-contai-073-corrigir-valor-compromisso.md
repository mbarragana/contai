# CONTAI-073 — corrigir o valor previsto de um agendamento aberto

**Relato de origem**: Mateus, registrando compras parceladas no cartão (cada
parcela é um lançamento "à vista" separado, já que o app não aceita
"parcelado" como lançamento único), digitou o valor errado numa parcela.
Tentou editar e não achou como. Palavras dele: *"nos pagamentos parcelados
coloquei um valor errado e preciso editar o valor da parcela, mas não é
possível aparentemente"*.

**Bug/lacuna confirmada por `grep`** em `lib/data.ts`: existem
`mudarDataPrevista`/`mudarDataCompraCartao` (corrigem DATA de um
`compromisso`) e `corrigirValorDoDocumento` (corrige o valor da NOTA,
entidade `documento`), mas zero função de correção de valor do próprio
`compromisso`.

## `/tickets-req` completo — os 4 passos

**Passo 1 (po)**: escopo fechado em "correção de PREVISÃO, não de fato
consumado" — só vale com `compromisso.situacao = 'aberto'`; mexe só no
valor, nunca em `data_prevista`/`data_compra`/`favorecido_id`/
`documento_origem_id`. Achados de código relevantes para o Passo 3: dois
padrões distintos já existem no repo para "corrigir depois de criado" —
`mudarDataPrevista` usa uma tabela de histórico simples
(`compromisso_data_historico`, sem enum de motivo); `corrigirValorDoDocumento`
usa o aparato pesado de `revisao`/`entidade_revisao` (correto ali porque
mexe em número DECLARADO — custo de aquisição). `valorPrevistoCentavos` é
sempre lido de `compromisso.valor_previsto` no momento da leitura
(`lib/dados/comum.ts:356`) e agregado por `.reduce()` nas telas de fatura —
confirmado como **derivado**, nunca snapshotado (responde de antemão o
pre-mortem "precisa sincronizar `/fatura/[id]`?" — não precisa, mas precisa
de teste travando isso).

**Passo 2 (contador)**: **Gate Fiscal fechado, sem impacto fiscal.**
`compromisso.valor_previsto` não compõe custo de aquisição (regime de caixa,
a chave é `pagamento.data_pagamento`) nem base de aferição INSS — é previsão
pura. `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` §1:
"compromisso não é custo, é zero". Pergunta extra do `po` sobre o cenário de
quitação PARCIAL (compromisso `aberto` com saldo, já tem `pagamento`
vinculado via `compromisso_pagamento`): confirmado como **não-fiscal**
também (§3 do mesmo parecer) — o custo do ano já ficou gravado no
`pagamento` no ato da quitação parcial, não deriva de `valor_previsto` e não
é reaberto por esta correção. Se o `cto-obra` quiser travar alguma coisa
nesse cenário, é decisão técnica/UX, não gate fiscal.

**Passo 3 (cto-obra) — achado importante, muda o escopo original**: o
`cto-obra` discordou de deixar passar um erro silencioso possível: se o
valor novo ficar ≤ à soma já paga em quitação parcial,
`saldoDoCompromisso` (`Math.max(0, previsto − pago)`) zeraria **sem erro**,
produzindo um `aberto` com saldo zero que o app não sabe ler hoje. Virou
guarda dura, reconferida no banco, na RPC nova. Decisões fechadas:
- RPC `corrigir_valor_compromisso(p_compromisso_id, p_valor_novo, p_motivo)`
  — não par insert+update pelo client (ao contrário de `mudarDataPrevista`):
  a guarda de saldo depende de outra tabela e exige leitura+escrita atômica.
- Tabela NOVA `compromisso_valor_historico` — **não** reaproveita
  `compromisso_data_historico`, porque o contador de "adiamentos" da tela
  conta linhas dessa tabela e uma correção de valor não é um adiamento.
- Motivo em `text not null` livre, sem enum — zero fiscal, nada ramifica
  pela categoria (diferente de `motivo_revisao`, específico do aparato
  `revisao`).
- Rota nova `/compromisso/[id]/valor`, não unificada com `/data` — recusa
  explícita de misturar as duas correções numa tela só (ambiguidade sobre
  qual rastro gravar).
- Tabela e função nascem com GRANT/REVOKE explícitos, mesmo padrão da
  `0013_fatura.sql`; `e2e/privilegios.spec.ts` e `e2e/banco.ts` (`limpar`)
  atualizados.
- Complexidade M (código é S; migration + grants + regen de tipos + 2 specs
  E2E novos é o padrão de esforço da `0013`).

**Passo 4 (designer)**: nível 2 (spec + ASCII), `design/mocks/CONTAI-073.md`
— recombinação de três padrões já em produção e lidos no código antes de
escrever (estrutura de `/compromisso/[id]/data`/`cancelar`, confirmação sem
modal de `/documento/[id]/corrigir/valor`, campo de valor de
`/compromisso/[id]/confirmar`). Decisões de texto: banner de guarda de
situação idêntico ao das telas irmãs; banner + prévia de saldo quando há
pagamento parcial vinculado; 5 validações client-side em ordem de
precedência com texto exato de cada uma; confirmação é a própria frase-resumo
"de R$ A para R$ B" acima do botão Salvar, sem modal; sucesso sem tela
própria (`router.push` direto ao detalhe, mesma decisão de
`mudarDataPrevista`); novo card "Histórico do valor previsto" no detalhe.
Cenário: gestão. 3 perguntas técnicas não-bloqueantes devolvidas ao
`cto-obra`/Gate 2 (nome exato de tabela/RPC — já respondido acima; forma
exata do erro de guarda para o `catch` mapear).

**Veredito: APROVADO. Pronto para `/develop`, sem Gate 0 pendente** (spec já
escrito e completo). Detalhe: `docs/tickets/CONTAI-073.md`.
