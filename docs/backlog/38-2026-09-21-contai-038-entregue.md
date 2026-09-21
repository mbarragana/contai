# CONTAI-038 entregue — 2026-09-21

`retencao_11` (booleano fixo de 11%) sai de `documento` e `favorecido` — não
existia estruturalmente para tomador pessoa física (parecer §0). Entra o gate
`documento.retencao_na_nota` (nenhuma/destacada) no fluxo de captura, e a
tabela `documento_retencao` (linhas livres: rótulo literal, valor, composição,
tributo, desconto efetivo, quem recolhe) no fluxo de gestão — repeater inédito
no produto.

Pendência antiga `servico_sem_retencao` apagada; nasce `retencao_sem_recolhedor`
(vermelha por exceção nomeada que AGRAVA, não abranda — primeira do tipo em
`gravidadeDaRegua`). `lib/fiscal/risco.ts`/`afericao.ts` deixaram de ler
retenção para decidir abatimento do SERO — correção do §2 do parecer de 18/09:
a base nunca foi reduzida pela retenção, só pela mão de obra declarada
vinculada ao CNO (eSocial/EFD-Reinf, que o produto não captura — dívida D57).
Efeito visível: exposição de INSS na home cai, base de aferição sobe — é o
efeito correto, não regressão.

Gate 2 fiscal voltou REQUEST CHANGES numa rodada: texto de
`SEM_ARQUIVO_DIALOGO_CONSEQUENCIA` ainda citava "retenção de 11%"
(premissa morta); corrigido com redação nova do `contador`, sem cifra fixa.
Decisão de arquitetura do `cto-obra` no meio do Gate de Design: `documento_retencao`
ganhou DELETE (não soft-delete) — é afirmação do Mateus sobre o papel, não
acervo com arquivo no bucket.

Testado: 791 unitários + 217/217 E2E + validação manual no browser (gate de
captura sem repeater, repeater completo com cascata composição→tributo e
desconto→quem recolhe, pendência vermelha nascendo e aparecendo na home com
o texto exato).

## Dívidas nomeadas

- **D62** — correção do valor do gate (`documento.retencao_na_nota`) depois de
  gravado não tem caminho pela interface. Confirmado como aceitável pelo `po`:
  marcar "destacada" por engano vira pendência âmbar permanente e nomeada
  (incômodo, não risco fiscal silencioso); marcar "nenhuma" por engano tende a
  ser pego pela pendência de diferença sem explicação (§4.1) se o valor não
  bater. Caminho futuro: extensão de `corrigir_documento`.
- **D63** — correção de `rotulo_literal`/`valor` de uma linha de retenção já
  gravada não tem caminho pela interface (só `composicao`/`e_desconto_efetivo`
  têm "remover e recriar"; `quem_recolhe` tem UPDATE direto). Mesma categoria
  de D62; mesmo caminho futuro (`corrigir_documento`, cobrindo os três campos
  de uma vez).
