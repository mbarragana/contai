# CONTAI-043 Documento — detalhe migra para o shell de gestão

## Tipo e Prioridade
chore/refactor de UI — **P1, fricção de processo**. Não cria obrigação fiscal
nova: move rota e redesenha layout mantendo o texto fiscal palavra por
palavra. **Primeiro de quatro tickets** que pagam a dívida nomeada pelo
próprio `CONTAI-040` — ver Dor de Origem. Ordem sugerida entre os quatro:
`043` (este) → `044` (Pagamento+Fatura) → `045` (Compromisso+Pendências) →
`046` (Obras+Terreno); nenhum bloqueia formalmente o outro, podem ser
sequenciados fora dessa ordem se um Gate 0 ficar pronto antes.

## Dor de Origem
`app/(captura)/layout.tsx`, comentário do próprio código:

> "O nome do grupo é o do ticket. Ele hospeda hoje mais do que captura pura —
> as telas de detalhe entram no shell numa rodada futura (Fora de Escopo do
> `CONTAI-040`), e até lá é aqui que elas ficam legíveis."

Não é dor narrada por relato — é dívida técnica já registrada. A dor real,
concreta e **já em produção**: `app/_components/fila-pendencias.tsx:170`
linka `/documento/${p.documentoId}` a partir da fila de pendências
unificada (`CONTAI-042`, já dentro do shell `(gestao)`) e do dashboard; a
tela stub de `/despesas` (`CONTAI-041`) também aponta para lá via
`d.href`. Hoje o clique sai do shell de gestão (sidebar, obra ativa, ano) e
cai na casca de 430px isolada — o usuário perde o contexto no meio da
revisão que o dashboard/pendências/despesas foi desenhado para dar.

## User Story
Como dono da obra revisando uma pendência ou despesa a partir do painel de
gestão (dashboard, `/despesas` ou `/pendencias`), quando abro o detalhe de um
documento para corrigir um dado, anexar o comprovante que falta ou resolver
o CNPJ errado, quero continuar dentro do mesmo shell — sidebar, obra aberta,
sem recarregar um app diferente — para não perder o fio da revisão.

## Escopo e Critérios de Aceite

1. Mover `app/(captura)/documento/[id]/*` para `app/(gestao)/documento/[id]/*`
   (mesma técnica de route group do `CONTAI-040`): `page.tsx`, `anexar`,
   `cnpj-errado`, `corrigir/classificacao`, `corrigir/emitente`,
   `corrigir/valor`, `desligar`, `ligar`, `obra`, `outro-dado`. Comportamento
   idêntico — muda a casca, não a lógica.
2. Layout de detalhe dentro do shell: **coluna única de largura limitada
   (~560px), não full-width.** Achado técnico do Gate 2 do `CONTAI-039`/da
   avaliação do `cto-obra` que originou o `CONTAI-040`: esticar
   formulário/detalhe para a largura cheia da casca (1244px) mediu **menos**
   legível que os 430px de hoje. Esse achado nunca foi formalizado em ticket
   até este registro — a largura exata e o comportamento em telas menores
   que 560px+sidebar são do Gate 0 (ver Dependências).
3. **Nenhum texto fiscal muda.** Todo texto de `Consequencia`, aviso de
   retenção (`documento_retencao`), aviso de CNO/`cno_referenciado`, aviso de
   CNPJ errado etc. é copiado byte a byte da tela atual — zero reescrita.
   Prova de aceite: comparação do texto renderizado antes/depois por tela
   (snapshot ou grep-trava, mesma disciplina do `037`/`039`).
4. Navegação consistente com o shell: sidebar sempre visível, "obra aberta"
   e "ano" lidos de `useGestao()` (`app/_components/gestao.tsx`) — **nunca**
   uma segunda chamada a `escolherObraAtiva`/`lerObraPreferida` dentro da
   tela de detalhe. Ver Pre-mortem 1 sobre o caso do documento de outra obra.
5. `375px` deixa de ser piso obrigatório para estas telas (regra de "Cenários
   de uso" do `CLAUDE.md` — são gestão, não captura). O caminho de captura
   (`/adicionar/documento`) continua intocado, fora deste ticket.

## Fora de Escopo
- Qualquer mudança de regra fiscal, de cálculo, de texto ou de fluxo de
  correção — isto é migração de casca, não feature nova.
- `/adicionar/*` (captura) — intocado.
- Esticar a coluna para full-width — decisão já tomada em contrário no
  Gate 2 do `039`; reabrir exige achado novo, não preferência de estilo.

## Gate Fiscal (Contador)
Sem regra fiscal nova. Precisa de conferência do `contador` no Gate 2
confirmando que o reflow de layout não alterou, truncou nem escondeu atrás
de interação nenhum texto de consequência fiscal — mesma régua do `037`/
`039` ("nenhuma `Consequencia` perde legibilidade").

## Pre-mortem
1. **Documento de outra obra abrindo com a obra errada no contexto.** A fila
   unificada de pendências já mostra hoje a pendência de outra obra
   **NOMEADA** (comentário de `gestao.tsx`: "a pendência de outra obra
   aparece NOMEADA"). A tela de detalhe migrada precisa preservar esse
   comportamento — mostrar de qual obra é o documento sem forçar a troca da
   "obra aberta" da sidebar. É pergunta técnica do `cto-obra` no Gate 0/1,
   não decidida aqui: a tela lê a obra pelo parâmetro da URL ou pelo
   contexto do shell?
2. **`corrigir/obra` movendo o documento para a obra ativa do shell em vez
   da obra de destino escolhida no formulário** — mesma classe de bug que o
   `CONTAI-008` já resolveu para pagamento; conferir que a migração de casca
   não reintroduz a confusão entre "obra que a sidebar mostra" e "obra que o
   formulário está movendo o documento para".

## Dependências
- **Gate 0 RESOLVIDO em 2026-09-21**: o padrão "detalhe dentro do shell"
  está em `design/mocks/detalhe-no-shell-v1.md` + protótipo navegável
  `design/mocks/detalhe-no-shell-v1.html` (não `detalhe-no-shell.md`, nome
  provisório assumido antes de o `designer` publicar). Coluna de **640px**
  (não 560px — o `designer` alargou para não quebrar linha nos grupos de
  `Escolha`/pílulas), sidebar idêntica ao dashboard, breadcrumb no topbar no
  lugar do "Voltar" fixo, rodapé sticky só quando a tela tem UMA ação
  central de página (formulário), nunca quando as ações são por card
  (leitura com múltiplas ações). Ticket pronto para `/develop`.
- Não bloqueia nem é bloqueado pelos irmãos `044`/`045`/`046`.

## Cenário e checagem final
**Gestão** — em casa, sentado, corrigindo ou revisando. O "Teste do
Canteiro" não se aplica.
