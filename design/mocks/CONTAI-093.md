# CONTAI-093 — Colaborador na obra: gestão de acesso e shell do colaborador

Nível 1 — três telas inteiramente novas (a, b, c — a tela (c) é nova pela
Emenda 2026-10-14), nenhuma existente para fazer delta.

## EMENDA pós-Gate-4 (2026-10-14)
O Mateus respondeu, no mesmo dia, que um colaborador pode ter acesso a mais
de uma obra sua simultaneamente — desde já, não é hipótese futura. Isso
muda a tela (b): ela deixa de ser o destino final do login do colaborador e
vira só uma lista de obras com a ação "Entrar nesta obra"; o conteúdo "nada
a fazer ainda" (e, a partir de `094`/`095`, a lista de documentos/
compromissos) passa a viver numa tela (c) nova, por obra. A resposta sobre
"restrita" (próprios + pendentes da obra) não é desenhada aqui — é RLS — mas
afeta o que a tela (c), em `094`/`095`, vai mostrar.

## Cenário

- Tela (a), gestão de colaboradores: **gestão** — vive em
  `app/(gestao)/obras/[id]/colaboradores/page.tsx`, acessada a partir de
  `/obras/[id]` ("Dados da obra") pelo mesmo padrão de link que já leva a
  `/obras/[id]/terreno`.
- Telas (b) e (c), shell do colaborador: não são nem gestão nem captura no
  sentido do CLAUDE.md — não há formulário, anexo, pressa ou decisão
  fiscal; são telas de orientação/navegação. O "Teste do Canteiro" não se
  aplica (não há interação de captura aqui, isso só chega em
  `CONTAI-094`/`095`); mesmo assim permanecem legíveis e usáveis em 375px
  por default sadio de produto (é simples o bastante para isso ser
  barato), não porque a doutrina do piso exija.

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

## Tela (b) — Lista de obras do colaborador

Rota nova, fora de `(gestao)` e `(captura)` — proposta
`app/(colaborador)/colaborador/page.tsx` (a decisão de qual mecanismo
decide "este usuário é colaborador, não dono" é arquitetura do `cto-obra`,
`papelDaSessao()`, não design).

**Reescrita pela Emenda 2026-10-14** — esta tela deixou de ser o destino
final: lista as obras em que a pessoa colabora (nome da obra, cidade — sem
CNO/números fiscais), cada card com uma ação **"Entrar nesta obra"**, que
leva à tela (c) daquela obra específica. Nenhum link para Home, `/despesas`,
`/pendencias` ou relatórios anuais — por desenho, não por filtro de
permissão escondendo botão.

4 estados:
- **loading**
- **vazio**: pessoa logada como colaborador mas sem vínculo nenhum (ex.:
  acesso removido ou nunca vinculado) — "Você ainda não foi vinculado a
  nenhuma obra"
- **erro**
- **sucesso**: 1+ obra listada, cada uma com "Entrar nesta obra". Se houver
  exatamente 1 obra, a tela ainda lista normalmente — **não** pula direto
  para a tela (c) sem clique (mesma régua do `TelaTrocarObra` do dono:
  preferência de obra ativa exige ação explícita, nunca auto-escolha).

## Tela (c) — Área da obra do colaborador (nova, Emenda 2026-10-14)

Rota nova `app/(colaborador)/colaborador/[obraId]/page.tsx`. "Entrar nesta
obra" (tela b) grava a mesma preferência de obra ativa que o dono já usa
(`lib/obra-ativa.ts`) e navega para aqui — é o destino real do login quando
há 2+ obras, e também quando há só 1 (depois do clique).

Conteúdo nesta fatia: "Nada a fazer ainda" (**texto exato: pergunta
aberta**, mesma pergunta que antes vivia na tela b) + link "Trocar obra"
voltando para a tela (b). A partir de `CONTAI-094`/`095`, é aqui que a
lista de documentos/compromissos do colaborador passa a viver. Nenhum link
para Home, `/despesas`, `/pendencias` ou relatórios anuais.

4 estados:
- **loading**
- **vazio**: nada a fazer ainda nesta fatia (texto acima)
- **erro**
- **sucesso**: mesmo conteúdo do estado vazio nesta fatia — não há
  diferença visível ainda entre "vazio" e "sucesso" até `094`/`095`
  existirem.

## Campos

### Tela (a) — gestão de colaboradores

- NÃO É CONTROLE — nota sobre as três entradas abaixo: nenhuma decide
  consequência tributária (Gate Fiscal do ticket, item 2), porque esta tela
  não cadastra documento, pagamento nem compromisso. É por isso — e só por
  isso — que a visibilidade pode nascer pré-marcada, o que a disciplina de
  "campo vazio pergunta" nunca permitiria num campo fiscal.
- `colabNome` "Nome" — texto livre: como o Mateus chama a pessoa, e é o nome
  que aparece em "criado por" depois. **SEM DEFAULT** — não há o que o app
  possa supor no nome de alguém.
- `colabEmail` "E-mail" — o endereço da conta dela no contai; é ele que
  concede o acesso (resposta 3 do Mateus: cadastro direto, sem convite).
  **SEM DEFAULT**.
- `colabVisibilidade` "O que ela vê" — escolha restrita/total do formulário de
  concessão — DEFAULT DECLARADO: "restrita", pré-marcada e VISÍVEL. É o acesso
  mais estreito dos dois, e a pré-marcação é explícita na tela, nunca
  implícita.
- `colabVisibilidadeDaLinha` "O que ela vê" — o mesmo controle, inline em cada
  linha da lista de colaboradores ativos — DEFAULT DECLARADO: a visibilidade
  já gravada daquele vínculo. É edição de um valor existente, não escolha
  nova: nascer vazio aqui apagaria da tela o que está em vigor.

### Telas (b) e (c) — área do colaborador

- NÃO É CONTROLE — nenhuma das duas tem formulário, campo ou anexo. São telas
  de orientação e navegação: a (b) lista obras com uma ação por cartão
  ("Entrar nesta obra"), a (c) diz "nada a fazer ainda" e oferece "Trocar
  obra". Captura pelo colaborador só chega em `CONTAI-094`/`095`, e é lá que
  os campos fiscais do formulário de documento voltam a valer, intactos.

## Textos fiscais

Nenhum — esta fatia não toca documento/pagamento/compromisso, não há
consequência fiscal para exibir, não precisa de revisão do `contador`.

## Perguntas abertas

1. Texto exato do aviso "e-mail sem conta" na tela (a).
2. A lista de colaboradores mostra só ativos, ou também removidos com um
   estado "removido" (rastro/auditoria visível na própria tela, não só no
   banco)?
3. ~~Um mesmo usuário pode ser dono de uma obra e colaborador de outra ao
   mesmo tempo?~~ — **respondida pela arquitetura na Emenda 2026-10-14**:
   esse caso (diferente de "colaborador em 2+ obras do Mateus", que já é
   escopo desde a resposta do Mateus) continua fora de escopo; o
   `papelDaSessao()` sempre abre o shell de **dono** para quem possui
   qualquer obra própria, mesmo que também colabore em obra de terceiros —
   não há ambiguidade de qual shell abrir para decidir em design.
4. Texto exato de "nada a fazer ainda" — **mudou de lugar na Emenda
   2026-10-14**: agora vive na tela (c), por obra, não mais na tela (b) de
   lista — neutro ou já anunciando funcionalidade futura (`094`/`095`)?
5. Rótulo/chip visual para "restrita" vs. "total" na lista (a) — texto puro
   ou um `Chip` dedicado? Não há precedente de chip não-fiscal no projeto
   para reaproveitar.
6. **Pergunta nova, Emenda 2026-10-14**: na tela (c) (e nas listas de
   `094`/`095`), quando um item pendente foi criado por **outro**
   colaborador, mostramos "criado por outro colaborador" sem nome, ou o
   Mateus quer o nome real (custo técnico extra — ver `CONTAI-093`,
   Pergunta Aberta 7 do ticket)?
