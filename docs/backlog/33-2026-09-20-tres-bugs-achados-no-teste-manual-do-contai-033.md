# Três bugs achados no teste manual no browser do CONTAI-033 — 2026-09-20

Depois do `lead-engineer` e do `cto-obra` terem fechado os Gates 1 e 2 (639
unitários + 179 E2E verdes), o teste manual no browser achou três defeitos que
nenhum dos dois pegou — mesma lição do CONTAI-022 (o botão de compra-cartão
clicável com campos vazios): teste automatizado prova a regra que foi escrita
para testar, não a que ninguém lembrou de escrever.

## 1 — corrigido: confirmação mentia "Arquivo guardado no acervo"

`app/_components/registrado.tsx` é compartilhado por `/adicionar/documento` e
`/adicionar/pagamento`. O banner de sucesso sempre dizia "Arquivo guardado no
acervo — nada se apaga...", texto fixo, sem condição. Salvando um documento
**sem** arquivo (o ponto inteiro do CONTAI-033), a tela de sucesso continuava
afirmando que o arquivo tinha sido guardado — sucesso mentiroso, mesma classe
de defeito do critério 1 do CONTAI-018 (vínculo que falha e a tela não pode
fingir sucesso).

**Corrigido**: `Registrado` ganhou a prop `arquivoNoAcervo` (default `true`,
preserva o texto de sempre); `/adicionar/documento` passa `false` quando
salvou sem arquivo, com texto novo dizendo o fato. Trava em
`e2e/documento-sem-arquivo.spec.ts`.

## 2 — corrigido: home dizia "Nenhuma pendência" com uma pendência vermelha na mesma tela

`app/page.tsx` mostrava o banner verde "Nenhuma pendência. Todo documento e
pagamento registrado está com a documentação em ordem" checando só
`resumo.pendencias.length === 0` — e `documentosSemArquivo` fica **fora** de
`pendencias` de propósito (crit. 11, mesmo padrão de `terrenoPagoSemComprovante`
etc.). Resultado: o banner verde aparecia na MESMA tela, poucos pixels acima
do card vermelho "Nota sem arquivo". É o D47 ("registra e esquece") com um
rosto novo — desta vez não na superfície da pendência em si, mas no banner
"está tudo bem" que ignora a superfície.

**Corrigido só para `documentosSemArquivo`** (a condição do banner agora
também nega esse campo). **Não estendido** aos outros agregados "fora de
pendencias" que já existiam antes deste ticket (`terrenoPagoSemComprovante`,
`terrenoSemData`, `terrenoMaisDeUmaData`, `terrenoSemRegistro`,
`financiamentoAguardandoInforme`, `financiamentoFaltaLancar`) — não é sabido
se algum deles já coexiste hoje com "Nenhuma pendência" em produção sem
ninguém ter percebido, e essa auditoria é maior que este ticket. **D59** (uma
linha abaixo) registra o escopo que falta.

## 3 — corrigido: "sem pagamento ligado" dizia "está em quarentena" para nota que não está

`ehDocumentoHabil` ganhou um terceiro motivo de `false` neste ticket (sem
arquivo), mas o texto de `app/documento/[id]/page.tsx`
(`PagamentosDesteDocumento`) só sabia escolher entre boleto e quarentena —
`documento.tipo === "boleto" ? BOLETO : QUARENTENA`. Uma nota `registrado`,
CPF confirmado, só sem o arquivo, caía no `else` e a tela dizia **"Esta nota
está em quarentena"**, que é factualmente falso: ela nunca esteve fora do CPF
do dono.

**Corrigido**: nova constante `VINCULO_SEM_ARQUIVO_NAO_GERA_CUSTO`
(`lib/fiscal/vinculo.ts`) e uma escolha de três vias com a precedência
boleto → quarentena → sem arquivo (as duas primeiras são mutuamente
exclusivas com "sem arquivo" quanto ao TEXTO mostrado aqui, embora quarentena
e sem-arquivo possam coexistir como FATOS — quando coexistem, o texto de
quarentena vence porque a razão mais grave já está dita no banner do topo da
tela). Trava em `e2e/documento-sem-arquivo.spec.ts`.

## D58 — dívida NÃO corrigida: o mesmo bug do item 1 existe em `/adicionar/pagamento`

`/adicionar/pagamento` já permite salvar sem comprovante desde o CONTAI-019/025
(a pendência "pago sem comprovante" é normal e esperada) e usa o MESMO
`Registrado` com o MESMO texto fixo "Arquivo guardado no acervo" — ou seja,
este bug é **anterior** ao CONTAI-033 e mais antigo do que o item 1 corrigido
acima. Não corrigido nesta rodada porque a tela e o fluxo pertencem a outro
ticket já entregue e commitado; a prop `arquivoNoAcervo` já existe pronta em
`Registrado` — falta só `/adicionar/pagamento` passar
`arquivoNoAcervo={comprovante !== null}` na sua própria chamada.

## D59 — dívida NÃO corrigida: a auditoria completa do banner "Nenhuma pendência"

Ver item 2. Confirmar, um a um, se `terrenoPagoSemComprovante`,
`terrenoSemData`, `terrenoMaisDeUmaData`, `terrenoSemRegistro`,
`financiamentoAguardandoInforme` e `financiamentoFaltaLancar` também
contradizem o banner "Nenhuma pendência" quando `pendencias` está vazia, e
decidir se o banner devia checar TODOS os agregados "fora de pendencias" de
uma vez (um helper único, tipo `resumoTemAlgumaCoisaEmAberto(resumo)`) em vez
de crescer um `&&` por ticket.
