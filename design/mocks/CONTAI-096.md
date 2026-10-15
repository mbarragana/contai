# CONTAI-096 — Visibilidade "total": leitura de pagamento já confirmado

Nível 2 — delta de **visibilidade condicional de ação**, não de layout: três
telas já existentes (`/documento/[id]`, `/compromisso/[id]`,
`/pagamento/[id]`) ganham um modo de leitura para o colaborador com
visibilidade "total", sem adicionar campo, sem adicionar estado novo de
carregamento/erro/vazio (os quatro estados dessas telas já existem e não
mudam).

## EMENDA pós-Gate-4 (2026-10-14)
A resposta do Mateus de que "restrita" = próprios registros + todos os
pendentes de revisão da obra faz o colaborador **restrito** também abrir
registro que não criou (o pendente de outro colaborador em `/documento/[id]`
e `/compromisso/[id]`) — não só o colaborador "total". O modo leitura
descrito abaixo passa a valer nessas duas telas para **qualquer**
colaborador olhando `criado_por <> auth.uid()`, em qualquer visibilidade.
`/pagamento/[id]` não muda: continua só para visibilidade "total" (restrito
nunca lê `pagamento`).

## Cenário

Gestão, no sentido de "consulta sentada ao acervo" — mas é a versão
read-only dela. Não é captura (nenhuma ação, nenhum formulário, nenhum
anexo). O "Teste do Canteiro" não se aplica, e como são as mesmas telas de
gestão que já existem, herdam o tratamento de desktop que elas já têm —
nada de novo a decidir em termos de breakpoint ou densidade.

## O que muda, exatamente

- Em `/documento/[id]` e `/compromisso/[id]`: para **qualquer** colaborador
  (visibilidade "total" **ou** "restrita", Emenda 2026-10-14) olhando um
  registro que **não é dele** (já confirmado pelo dono, ou criado por outro
  colaborador): todos os botões de ação desaparecem condicionalmente —
  nunca edita, nunca confirma, nunca liga/desliga vínculo, nunca aciona
  `/documento/[id]/ligar`, `/compromisso/[id]/confirmar`, etc. Em
  `/pagamento/[id]`: continua só para visibilidade "**total**" (restrito
  nunca lê nenhuma linha de `pagamento`), mesma régua de sempre — este
  comportamento não muda. Essas sub-rotas de ação devem ficar inacessíveis
  também por navegação direta, não só sem link visível — isso é
  RLS/roteamento (ver ticket, Viabilidade), fora do escopo de design.
- Indicador textual discreto no topo da tela (não um banner de alerta, cor
  neutra, mesmo peso visual de uma legenda): "Modo leitura — ações são
  exclusivas do dono da obra" — aparece sempre que o item acima escondeu os
  botões, para o colaborador não ficar se perguntando por que os botões que
  ele viu em outro registro (o dele, ainda pendente de revisão) não aparecem
  aqui. **Texto exato: pergunta aberta.**
- Nenhum texto fiscal muda: quarentena, consequência de CNO, retenção etc.
  continuam aparecendo exatamente como para o dono — o colaborador com
  visão "total" vê o estado fiscal real, só não pode agir sobre ele.

## O que explicitamente não muda nesta fatia

Home, `/despesas`, `/pendencias`, relatórios anuais continuam fora do
alcance do colaborador em qualquer configuração de visibilidade — "total" é
só sobre as 3 telas de detalhe, nunca sobre os agregados/números fiscais.
Isso já está fechado no escopo da fatia e não reabre.

## Campos

- SEM CAMPOS — puramente visibilidade condicional de botões/ações já
  existentes, mais um indicador textual novo (sem campo de entrada)

## Textos com consequência fiscal

Nenhum texto fiscal novo — tudo que aparece já existe e é copiado, não
reescrito. O único texto novo é o indicador de "modo leitura", que é copy
de produto, não fiscal.

## Perguntas abertas

1. Texto exato do indicador "modo leitura".
2. Quando o colaborador (visibilidade "total") navega direto para uma
   sub-rota de ação (ex.: `/pagamento/[id]/comprovante`) por URL — a UI deve
   mostrar uma tela de "sem permissão" própria, ou isso é tratado só no
   nível de dados (RLS) e a tela nem chega a renderizar? Afeta se precisa
   desenhar um quarto estado ("sem permissão") nessas sub-rotas — tratado
   como Out of Scope na v1 do ticket.
