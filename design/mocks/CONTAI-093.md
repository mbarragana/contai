# CONTAI-093 — Colaborador na obra: gestão de acesso e shell do colaborador

Nível 1 — duas telas inteiramente novas, nenhuma existente para fazer delta.

## Cenário

- Tela (a), gestão de colaboradores: **gestão** — vive em
  `app/(gestao)/obras/[id]/colaboradores/page.tsx`, acessada a partir de
  `/obras/[id]` ("Dados da obra") pelo mesmo padrão de link que já leva a
  `/obras/[id]/terreno`.
- Tela (b), shell do colaborador: não é nem gestão nem captura no sentido do
  CLAUDE.md — não há formulário, anexo, pressa ou decisão fiscal; é tela de
  orientação. O "Teste do Canteiro" não se aplica (não há interação de
  captura aqui, isso só chega em `CONTAI-094`/`095`); mesmo assim permanece
  legível e usável em 375px por default sadio de produto (é simples o
  bastante para isso ser barato), não porque a doutrina do piso exija.

## Tela (a) — Gestão de colaboradores

Formulário sempre visível no topo (não escondido atrás de "+ Adicionar"):

- `nome` (texto livre — como o Mateus chama a pessoa)
- `e-mail`
- `visibilidade` — escolha restrita/total, pré-selecionada em "restrita".
  Não é campo fiscal, então o default visível e explícito é aceitável,
  diferente da proibição de default em campo fiscal.
- Botão "Adicionar colaborador"

Lista abaixo: uma linha por colaborador ativo — nome, e-mail, chip/rótulo de
visibilidade, seletor para trocar visibilidade inline, botão "Remover
acesso" (ação destrutiva na prática, mesmo que o banco preserve o registro
— sugerido diálogo de confirmação, mesmo padrão de outras ações
irreversíveis do app).

**Estado "e-mail sem conta"**: ao tentar adicionar um e-mail que não existe
no Supabase Auth, a tela não finaliza silenciosamente — mostra aviso
explicando que falta criar a conta no dashboard (passo fora do app) antes do
vínculo funcionar. **Texto exato: pergunta aberta, ver abaixo.**

4 estados:
- **loading**: componente `Carregando` reaproveitado
- **vazio**: "Nenhum colaborador cadastrado ainda" — formulário continua
  ativo
- **erro**: componente `EstadoErro` reaproveitado
- **sucesso**: lista populada

## Tela (b) — Shell do colaborador

Rota nova, fora de `(gestao)` e `(captura)` — proposta
`app/(colaborador)/colaborador/page.tsx` (a decisão de qual mecanismo
decide "este usuário é colaborador, não dono" é arquitetura do `cto-obra`,
não design).

Conteúdo: lista das obras em que a pessoa colabora (nome da obra, cidade —
sem CNO/números fiscais), cada uma com uma linha "Nada a fazer ainda"
(**texto exato: pergunta aberta**). Nenhum link para Home, `/despesas`,
`/pendencias` ou relatórios anuais — por desenho, não por filtro de
permissão escondendo botão.

4 estados:
- **loading**
- **vazio**: pessoa logada como colaborador mas sem vínculo nenhum (ex.:
  acesso removido ou nunca vinculado) — "Você ainda não foi vinculado a
  nenhuma obra"
- **erro**
- **sucesso**: 1+ obra listada

## Campos

`nome`, `e-mail`, `visibilidade` na tela (a). Nenhum é campo fiscal — não
cadastram documento/pagamento, então a disciplina "campo vazio pergunta,
nunca default fiscal" não se aplica a eles; ainda assim o default de
visibilidade deve estar visivelmente pré-marcado, nunca implícito.

## Textos fiscais

Nenhum — esta fatia não toca documento/pagamento/compromisso, não há
consequência fiscal para exibir, não precisa de revisão do `contador`.

## Perguntas abertas

1. Texto exato do aviso "e-mail sem conta" na tela (a).
2. A lista de colaboradores mostra só ativos, ou também removidos com um
   estado "removido" (rastro/auditoria visível na própria tela, não só no
   banco)?
3. Um mesmo usuário pode ser dono de uma obra e colaborador de outra ao
   mesmo tempo? Muda a lógica de qual shell abre no login.
4. Texto exato de "nada a fazer ainda" na tela (b) — neutro ou já
   anunciando funcionalidade futura (`094`/`095`)?
5. Rótulo/chip visual para "restrita" vs. "total" na lista (a) — texto puro
   ou um `Chip` dedicado? Não há precedente de chip não-fiscal no projeto
   para reaproveitar.
