# CONTAI-077 — descrição do design

Cenário: gestão

## Telas e estados
Nenhuma tela nova, nenhum layout novo — correção de mecanismo de scroll no
componente compartilhado (`RodapeDeAcao`/`ShellDeGestao`), sem mudança visual
nas 22 telas que o usam. `RodapeDeAcao` passa a renderizar por portal num
slot fora da área rolável (`<main>`), mesmo princípio que a casca de 430px
(`(captura)/layout.tsx`) já usa há muito tempo: "quem rola é o corpo, não a
página" — o shell de gestão (CONTAI-043) tinha divergido disso, e é essa
divergência que causava a sobreposição.

**Efeito colateral esperado, não é regressão**: em tela com pouco conteúdo,
o rodapé fica fixo no pé da viewport com espaço vazio entre o último card e o
botão — igual ao que já acontece na casca de 430px hoje. A decisão 4 do
`design/mocks/detalhe-no-shell-v1.md` já pede "rodapé na largura da coluna" e
"alcançável sem rolar até o fim" — as duas continuam satisfeitas.

## Campos
- SEM CAMPOS — correção de mecanismo de layout, nenhum campo novo ou alterado.

## Textos com consequência fiscal
- Nenhum texto novo. Nenhum texto existente muda.

## Navegação
- Nenhuma mudança de navegação.

## Decisões de design e perguntas abertas
- Nenhuma pergunta aberta — a correção é inteiramente técnica (ver
  Viabilidade do `cto-obra` no ticket), sem decisão visual nova a tomar.
